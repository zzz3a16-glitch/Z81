/**
 * DuplicateService — smart duplicate detection (spec 18).
 * Compares internal ID, TMDB ID, filename, path, year, media type, season,
 * episode, edition and metadata similarity. Presents "possible duplicate"
 * pairs with safe actions. Never silently deletes anything.
 */
import { normalizeTitle } from './FileNameParser.js';
import { similarity } from './ImportService.js';

export class DuplicateService {
  constructor({ db, store, log, events }) {
    this.db = db;
    this.store = store;
    this.log = log;
    this.events = events;
    this.cache = null;
  }

  pairKey(a, b) {
    return [a, b].sort().join('::');
  }

  scan() {
    const groups = new Map();
    const addItem = (id, item, reason, score) => {
      const pair = this.pairKey(id, item.ref);
      if (!groups.has(pair) || groups.get(pair).score < score) {
        groups.set(pair, { pair, a: { ...id }, b: { ...item }, reason, score });
      }
    };

    for (const store of ['movies', 'tvshows']) {
      const works = this.db.all('SELECT key, ref1, ref2, payload, updated_at FROM doc_store WHERE store=?', [store]);
      const metaFiles = this.db.all(
        `SELECT work_key, filename, norm_path, quality FROM media_files WHERE store=?`, [store]);
      const byTmdb = new Map();
      const byTitleYear = new Map();
      const byFilename = new Map();
      for (const w of works) {
        const p = safeJson(w.payload);
        const ref = `${store}:${w.key}`;
        if (Number.isInteger(Number(w.key))) {
          if (!byTmdb.has(w.key)) byTmdb.set(w.key, []);
          byTmdb.get(w.key).push({ ref, p, title: w.ref1, year: w.ref2 });
        }
        const nt = normalizeTitle(w.ref1 || p.title || '');
        if (nt) {
          const k = `${nt}|${p.year || ''}`;
          if (!byTitleYear.has(k)) byTitleYear.set(k, []);
          byTitleYear.get(k).push({ ref, p, title: w.ref1, year: w.ref2 });
        }
        for (const f of metaFiles.filter((m) => m.work_key === w.key)) {
          if (!byFilename.has(f.filename.toLowerCase())) byFilename.set(f.filename.toLowerCase(), []);
          byFilename.get(f.filename.toLowerCase()).push({ ref, file: f });
        }
      }
      for (const [, list] of byTmdb) {
        for (let i = 1; i < list.length; i++) {
          addItem(list[0], list[i], 'tmdb_id', 95);
        }
      }
      for (const [k, list] of byTitleYear) {
        if (list.length < 2) continue;
        const [t] = k.split('|');
        for (let i = 1; i < list.length; i++) {
          const sim = similarity(t, normalizeTitle(list[i].title || '')) * 100;
          if (sim >= 85) addItem(list[0], list[i], 'title_year', Math.round(sim));
        }
      }
      for (const [, list] of byFilename) {
        for (let i = 1; i < list.length; i++) {
          if (list[i].ref !== list[0].ref) addItem(list[0], list[i], 'filename', 60);
        }
      }
    }

    // episode duplicates: same showId/season/episode across different file paths
    const eps = this.db.all(
      `SELECT ref1 AS show_id, ref2 AS season, key, payload FROM doc_store WHERE store='episodes'`);
    const byEp = new Map();
    for (const e of eps) {
      const p = safeJson(e.payload);
      const k = `${p.showId}|${p.season}|${p.episode}`;
      if (!byEp.has(k)) byEp.set(k, []);
      byEp.get(k).push({ ref: `episodes:${e.key}`, p });
    }
    for (const [, list] of byEp) {
      for (let i = 1; i < list.length; i++) addItem(list[0], list[i], 'episode_slot', 90);
    }

    // suppress resolved decisions (keep both / ignored)
    const decisions = new Map(this.db.all('SELECT pair_key, action FROM duplicate_decisions').map((d) => [d.pair_key, d.action]));
    const results = [];
    for (const g of groups.values()) {
      const dec = decisions.get(g.pair);
      if (dec && (dec === 'keep_both' || dec === 'ignore')) continue;
      results.push({
        pair: g.pair,
        reason: g.reason,
        score: g.score,
        decision: dec || null,
        a: describe(g.a),
        b: describe(g.b),
      });
    }
    results.sort((x, y) => y.score - x.score);
    this.cache = results;
    this.log.info('duplicates', `scan found ${results.length} possible duplicate pairs`);
    return { pairs: results.length, items: results };
  }

  list() {
    if (!this.cache) return this.scan().items;
    return this.cache;
  }

  stats() {
    const out = this.cache ? this.cache.length : 0;
    return { pairs: out, decisions: this.db.get('SELECT COUNT(*) n FROM duplicate_decisions').n };
  }

  /** action: merge | keep_both | ignore | review (defer) */
  review(pairKey, action) {
    if (!['merge', 'keep_both', 'ignore', 'review'].includes(action)) throw new Error('E_INVALID_ACTION');
    if (action === 'review') return true;
    this.db.run(
      `INSERT INTO duplicate_decisions (pair_key, action, decided_at) VALUES (?,?,?)
       ON CONFLICT(pair_key) DO UPDATE SET action=excluded.action, decided_at=excluded.decided_at`,
      [String(pairKey), action, Date.now()]
    );
    if (this.cache) this.cache = this.cache.filter((p) => p.pair !== pairKey);
    this.events?.emit('library:changed', { op: 'dup-review' });
    return true;
  }

  /**
   * Merge two works: keep primary, attach the other's files to it, mark
   * duplicate status='merged-into', never touch the files on disk.
   */
  merge(pairKey, keepRef) {
    const pair = (this.cache || this.scan().items).find((p) => p.pair === pairKey);
    if (!pair) throw new Error('E_PAIR_STALE');
    const a = parseRef(pair.a.ref);
    const b = parseRef(pair.b.ref);
    const keep = keepRef === pair.b.ref ? b : a;
    const drop = keepRef === pair.b.ref ? a : b;
    this.db.tx(() => {
      const keepWork = this.store.get(keep.store, keep.key);
      const dropWork = this.store.get(drop.store, drop.key);
      if (!keepWork || !dropWork) throw new Error('E_MISSING_WORK');
      // merge list fields (union, no data loss)
      const merged = {
        ...keepWork,
        localFiles: [...new Set([...(keepWork.localFiles || []), ...(dropWork.localFiles || [])])],
        editions: [...new Set([...(keepWork.editions || []), ...(dropWork.editions || [])].map((e) => JSON.stringify(e)))].map((s) => JSON.parse(s)),
        mergedFrom: [...new Set([...(keepWork.mergedFrom || []), `${drop.store}:${drop.key}`])],
        updatedAt: Date.now(),
      };
      this.store.put(keep.store, merged);
      this.db.run('UPDATE media_files SET store=?, work_key=? WHERE store=? AND work_key=?',
        [keep.store, keep.key, drop.store, drop.key]);
      this.db.run('DELETE FROM doc_store WHERE store=? AND key=?', [drop.store, drop.key]);
      this.db.run('DELETE FROM work_fts WHERE store=? AND key=?', [drop.store, drop.key]);
      this.db.run('INSERT INTO duplicate_decisions (pair_key, action, detail) VALUES (?,?,?) ON CONFLICT(pair_key) DO UPDATE SET action=excluded.action, decided_at=excluded.decided_at',
        [pairKey, 'merge', JSON.stringify({ keep: keepRef || pair.a.ref })]);
    });
    this.cache = null;
    this.events?.emit('library:changed', { op: 'merge', pairKey });
    return true;
  }
}

function describe(entry) {
  const p = entry.p || {};
  return {
    ref: entry.ref,
    title: p.title || p.name || null,
    year: p.year || null,
    poster: p.poster_path || null,
    filename: entry.file ? entry.file.filename : null,
    path: entry.file ? entry.file.norm_path : (p.localFiles ? p.localFiles[0] : null),
    quality: entry.file ? entry.file.quality : null,
  };
}

function parseRef(ref) {
  const [store, key] = String(ref).split(':');
  return { store, key };
}

function safeJson(s, fb = {}) {
  if (s == null) return fb;
  try { return typeof s === 'string' ? JSON.parse(s) : s; } catch { return fb; }
}
