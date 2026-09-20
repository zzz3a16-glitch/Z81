/**
 * ImportService — Smart Import + Library Inbox (spec 15/16).
 * Scans configured sources, parses names (hardened parser), matches against
 * TMDB (cached, throttled), scores confidence, flags duplicates, and stages
 * EVERYTHING in the inbox. Only explicitly confirmed items enter the trusted
 * library (unless auto-confirm threshold is met and no duplicate exists).
 * Never overwrites existing records — new files merge into existing works.
 */
import path from 'node:path';
import { parseFilename, isMediaFile, isIgnorable, normalizeTitle } from './FileNameParser.js';

const MAX_MATCH_PER_SCAN = 400; // TMDB calls per scan run (rate budget)

export class ImportService {
  constructor({ db, store, library, tmdb, fs: fss, settings, log, events }) {
    this.db = db;
    this.store = store;
    this.library = library;
    this.tmdb = tmdb;
    this.fs = fss;
    this.settings = settings;
    this.log = log;
    this.events = events;
    this.running = false;
    this.abort = false;
    this.progress = null;
  }

  isRunning() { return this.running; }

  /** Full scan of all enabled sources -> inbox candidates (+ auto-confirm). */
  async scanAll({ sourceId = null } = {}) {
    if (this.running) throw new Error('E_SCAN_RUNNING');
    this.running = true;
    this.abort = false;
    const stats = { files: 0, newCandidates: 0, known: 0, autoConfirmed: 0, errors: 0 };
    try {
      const sources = sourceId
        ? this.db.all('SELECT * FROM library_sources WHERE id=?', [Number(sourceId)])
        : this.db.all('SELECT * FROM library_sources WHERE enabled=1');
      if (!sources.length) return { ...stats, done: true, message: 'no-sources' };

      const maxFiles = Number(this.settings.get('maxScanFiles')) || 50000;
      for (const src of sources) {
        if (this.abort) break;
        this.progress = { root: src.path, phase: 'scanning' };
        const collected = [];
        try {
          await this.fs.scan(src.path, {
            maxFiles,
            shouldStop: () => this.abort,
            dirFilter: (name) => !(name.startsWith('.') || ['@eadir', '#recycle', '$recycle.bin'].includes(name.toLowerCase())),
            fileFilter: (name) => !isIgnorable(name) && isMediaFile(name),
            onFile: (f) => { collected.push(f); },
          });
        } catch (e) {
          stats.errors++;
          this.log.warn('import', `scan failed for ${src.path}`, e.message);
        }
        stats.files += collected.length;

        const candidates = [];
        for (const f of collected) {
          const parsed = parseFilename(f.filename, { parentDirs: dirChain(f.path, src.path) });
          candidates.push(this.buildCandidate(f, parsed, src));
        }

        // ---- TMDB matching (throttled + cached) ----
        if (this.tmdb.apiKey) {
          let budget = MAX_MATCH_PER_SCAN;
          // group episodes by probable series title — one search per series
          const bySeries = new Map();
          for (const c of candidates) {
            if (!c._known && c.parsed && c.parsed.isEpisode && c.title) {
              const key = normalizeTitle(c.title);
              if (!bySeries.has(key)) bySeries.set(key, []);
              bySeries.get(key).push(c);
            }
          }
          for (const [key, items] of bySeries) {
            if (this.abort || budget-- <= 0) break;
            if (items[0].tmdb_id) continue;
            try {
              const res = await this.tmdb.search('tv', items[0].title, 1);
              const best = pickBest(res.results, items[0].title, null);
              if (best) {
                for (const it of items) {
                  it.tmdb_id = best.id;
                  it.tmdb_match = tmdbLite(best, 'tv');
                  it.confidence = Math.max(it.confidence, best._sim >= 0.8 ? 96 : 74);
                  it.media_type = 'tv';
                }
              }
            } catch { stats.errors++; }
            void key;
          }
          for (const c of candidates) {
            if (this.abort || budget-- <= 0) break;
            if (c._known || c.tmdb_id || (c.parsed && c.parsed.isEpisode)) continue;
            try {
              const res = await this.tmdb.search('movie', c.title, 1);
              const best = pickBest(res.results, c.title, c.year);
              if (best) {
                c.tmdb_id = best.id;
                c.tmdb_match = tmdbLite(best, 'movie');
                c.confidence = Math.max(c.confidence, best._sim >= 0.8 ? 94 : 70);
              }
            } catch { stats.errors++; }
          }
        }

        // ---- persist to inbox ----
        for (const c of candidates) {
          if (this.abort) break;
          const res = this.persistCandidate(c);
          if (res === 'new') stats.newCandidates++;
          else if (res === 'known') stats.known++;
          else if (res === 'auto') { stats.autoConfirmed++; stats.newCandidates++; }
        }
        this.db.run('UPDATE library_sources SET last_scan_at=?, stats=? WHERE id=?',
          [Date.now(), JSON.stringify({ scanned: collected.length, at: Date.now() }), src.id]);
        this.events?.emit('inbox:changed', { reason: 'scan-complete', root: src.path });
        this.events?.emit('scan:progress', { root: src.path, files: collected.length, phase: 'source-done' });
      }
      this.progress = { phase: 'done', ...stats };
      return { ...stats, done: true };
    } finally {
      this.running = false;
      this.events?.emit('scan:progress', { done: true, ...stats });
    }
  }

  stopScan() {
    this.abort = true;
    return { stopped: true };
  }

  /** Merge parser output with FS facts + duplicate scan + confidence score. */
  buildCandidate(f, parsed, src) {
    const norm = this.library.normPath(f.path);
    const known = this.db.get('SELECT id FROM media_files WHERE norm_path=?', [norm]);
    if (known) {
      this.db.run('UPDATE media_files SET size_bytes=?, mtime_ms=?, status=\'ok\', missing_since=NULL WHERE id=?',
        [f.size, f.mtimeMs, known.id]);
      return { _known: true, path: f.path, norm_path: norm };
    }
    let confidence = 40;
    if (parsed.year) confidence += 12;
    if (parsed.quality) confidence += 6;
    if (parsed.codec) confidence += 3;
    if (parsed.probableType === 'movie') confidence += 8;
    if (parsed.season !== null && parsed.episode !== null) confidence += 6;
    if (parsed.title && /[؀-ۿ]/.test(parsed.title)) confidence += 4;
    const dupByName = this.db.get(
      'SELECT id FROM media_files WHERE filename=? AND size_bytes=? AND norm_path != ?',
      [f.filename, f.size, norm]);
    if (dupByName) confidence = Math.min(confidence, 45);
    const normTitle = normalizeTitle(parsed.title || '');
    const duplicateOf = normTitle
      ? this.findWorkByTitle(normTitle, parsed.isEpisode ? 'tvshows' : 'any')
      : null;
    if (duplicateOf) confidence = Math.min(confidence, 80); // needs eyes even if parse is clean

    let mediaType = parsed.isEpisode ? 'tv' : 'movie';
    if (src.kind === 'anime') mediaType = parsed.isEpisode ? 'tv' : 'movie';
    if (src.kind === 'docs') mediaType = 'movie';

    return {
      path: f.path, norm_path: norm, filename: f.filename, size: f.size,
      parsed, title: parsed.title, year: parsed.year,
      season: parsed.season, episode: parsed.episode,
      media_type: mediaType,
      confidence: Math.min(confidence, parsed.isEpisode && !dupByName ? 99 : 90),
      duplicate_of: duplicateOf, dupFile: !!dupByName,
      tmdb_id: null, tmdb_match: null,
    };
  }

  findWorkByTitle(normTitle, store) {
    const stores = store === 'any' ? ['movies', 'tvshows'] : [store];
    for (const s of stores) {
      const rows = this.db.all('SELECT key, ref1, payload FROM doc_store WHERE store=? LIMIT 5000', [s]);
      for (const r of rows) {
        const t = normalizeTitle(r.ref1 || safeJson(r.payload).title || '');
        if (t && (t === normTitle || t.includes(normTitle) || normTitle.includes(t))) {
          return `${s}:${r.key}`;
        }
      }
    }
    return null;
  }

  persistCandidate(cand) {
    if (cand._known) return 'known';
    const existing = this.db.get('SELECT id, status FROM import_candidates WHERE norm_path=?', [cand.norm_path]);
    if (existing && existing.status === 'confirmed') return 'known';
    this.db.run(
      `INSERT INTO import_candidates
         (path, norm_path, filename, size_bytes, parsed, media_type, tmdb_id, tmdb_match, confidence, season, episode, duplicate_of, status, notes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'pending',?)
       ON CONFLICT(norm_path) DO UPDATE SET
         parsed=excluded.parsed, size_bytes=excluded.size_bytes,
         tmdb_id=COALESCE(excluded.tmdb_id, import_candidates.tmdb_id),
         tmdb_match=COALESCE(excluded.tmdb_match, import_candidates.tmdb_match),
         confidence=MAX(import_candidates.confidence, excluded.confidence),
         duplicate_of=excluded.duplicate_of`,
      [cand.path, cand.norm_path, cand.filename, cand.size, JSON.stringify(cand.parsed),
        cand.media_type, cand.tmdb_id, JSON.stringify(cand.tmdb_match), cand.confidence,
        cand.season, cand.episode, cand.duplicate_of,
        cand.dupFile ? 'نسخة مكررة محتملة من ملف مسجل' : null]
    );
    if (existing) return 'known';
    const row = this.db.get('SELECT id, status FROM import_candidates WHERE norm_path=?', [cand.norm_path]);
    const th = Number(this.settings.get('autoConfirmThreshold')) || 92;
    if (cand.confidence >= th && !cand.duplicate_of && !cand.dupFile && cand.tmdb_id) {
      return this.confirm(row.id, { auto: true }) ? 'auto' : 'new';
    }
    return 'new';
  }

  list({ status = 'pending', limit = 500, offset = 0 } = {}) {
    const allowed = ['pending', 'confirmed', 'ignored', 'deferred'];
    const where = allowed.includes(status) ? `WHERE status=?` : '';
    const params = allowed.includes(status) ? [status, Number(limit) || 500, Number(offset) || 0] : [Number(limit) || 500, Number(offset) || 0];
    return this.db.all(`SELECT * FROM import_candidates ${where} ORDER BY confidence ASC, id DESC LIMIT ? OFFSET ?`, params)
      .map((r) => ({
        ...r,
        parsed: safeJson(r.parsed),
        tmdb_match: safeJson(r.tmdb_match, null),
        existing_title: this.resolveLabel(r.duplicate_of),
      }));
  }

  resolveLabel(ref) {
    if (!ref) return null;
    const [store, key] = String(ref).split(':');
    const w = this.store.get(store, key);
    return w ? (w.title || w.name || null) : null;
  }

  stats() {
    const rows = this.db.all('SELECT status, COUNT(*) AS n FROM import_candidates GROUP BY status');
    const out = { pending: 0, confirmed: 0, ignored: 0, deferred: 0 };
    for (const r of rows) out[r.status] = r.n;
    out.running = this.running;
    return out;
  }

  clearResolved() {
    return this.db.run("DELETE FROM import_candidates WHERE status IN ('confirmed','ignored')").changes;
  }

  update(id, patch) {
    const c = this.db.get('SELECT * FROM import_candidates WHERE id=?', [Number(id)]);
    if (!c) throw new Error('E_NOT_FOUND');
    const parsed = safeJson(c.parsed);
    const fields = []; const params = [];
    for (const k of ['season', 'episode', 'media_type', 'notes']) {
      if (patch[k] !== undefined) { fields.push(`${k}=?`); params.push(patch[k] === '' ? null : patch[k]); }
    }
    if (patch.title) { parsed.title = String(patch.title); fields.push('parsed=?'); }
    if (fields.length && !fields.includes('parsed=?')) { /* nothing else */ }
    if (patch.title) params.push(JSON.stringify(parsed));
    if (!fields.length) return true;
    this.db.run(`UPDATE import_candidates SET ${fields.join(', ')} WHERE id=?`, [...params, Number(id)]);
    return true;
  }

  async rematch(id) {
    const c = this.db.get('SELECT * FROM import_candidates WHERE id=?', [Number(id)]);
    if (!c) throw new Error('E_NOT_FOUND');
    const parsed = safeJson(c.parsed);
    const q = parsed.title || c.filename.replace(/\.[a-z0-9]+$/i, '');
    const res = await this.tmdb.search(c.media_type === 'tv' ? 'tv' : 'movie', q, 1);
    const best = pickBest(res.results, q, parsed.year);
    if (best) {
      this.db.run('UPDATE import_candidates SET tmdb_id=?, tmdb_match=?, confidence=? WHERE id=?',
        [best.id, JSON.stringify(tmdbLite(best, c.media_type)), Math.max(c.confidence, best._sim >= 0.8 ? 95 : 75), Number(id)]);
      return { matched: true, tmdb: tmdbLite(best, c.media_type) };
    }
    return { matched: false };
  }

  defer(id) {
    return this.db.run("UPDATE import_candidates SET status='deferred' WHERE id=?", [Number(id)]).changes > 0;
  }

  ignore(id) {
    return this.db.run("UPDATE import_candidates SET status='ignored', resolved_at=? WHERE id=?", [Date.now(), Number(id)]).changes > 0;
  }

  /**
   * Confirm: the ONLY path into the trusted library (spec 16).
   * Work / Edition / File separation enforced via doc payload + media_files.
   */
  confirm(id, { auto = false } = {}) {
    const c = this.db.get('SELECT * FROM import_candidates WHERE id=?', [Number(id)]);
    if (!c || c.status === 'confirmed') return false;
    const parsed = safeJson(c.parsed);
    const isEpisode = c.media_type === 'tv' || parsed.isEpisode;
    this.db.tx(() => {
      if (isEpisode) this.confirmEpisode(c, parsed);
      else this.confirmMovie(c, parsed);
      this.db.run("UPDATE import_candidates SET status='confirmed', resolved_at=?, notes=? WHERE id=?",
        [Date.now(), auto ? 'auto' : null, Number(id)]);
    });
    this.events?.emit('inbox:changed', { id: Number(id), status: 'confirmed', auto });
    return true;
  }

  confirmMany(ids) {
    let n = 0;
    for (const id of ids || []) if (this.confirm(id)) n++;
    return { confirmed: n };
  }

  fileFor(c, parsed) {
    return {
      path: c.path, size: c.size_bytes, quality: parsed.quality,
      edition: parsed.edition, languages: parsed.languages || [], sourceKind: parsed.source_kind,
    };
  }

  confirmMovie(c, parsed) {
    const file = this.fileFor(c, parsed);
    const store = 'movies';
    const key = c.tmdb_id ? String(c.tmdb_id) : `local-${hash(c.norm_path.split('/').slice(0, -1).join('/') || c.norm_path)}`;
    const existing = this.store.get(store, key);
    const base = existing || {
      id: c.tmdb_id ? Number(c.tmdb_id) : key,
      media_type: 'movie',
      title: parsed.title || c.filename.replace(/\.[a-z0-9]+$/i, ''),
      original_title: parsed.title,
      year: parsed.year || null,
      overview: c.tmdb_match?.overview || null,
      poster_path: c.tmdb_match?.poster_path || null,
      backdrop_path: c.tmdb_match?.backdrop_path || null,
      addedAt: Date.now(),
    };
    const next = {
      ...base,
      media_type: 'movie',
      inLibrary: true,
      localFiles: [...new Set([...(base.localFiles || []), c.path])],
      editions: dedupeEditions(base.editions, parsed),
      addedAt: base.addedAt || Date.now(),
      updatedAt: Date.now(),
    };
    this.store.put(store, next);
    this.library.addMediaFile(store, key, file);
    this.library.indexWork(store, key);
    if (c.tmdb_id) this.scheduleEnrichment(store, key, c.tmdb_id);
  }

  confirmEpisode(c, parsed) {
    const showId = c.tmdb_id ? String(c.tmdb_id) : `local-${hash(normalizeTitle(parsed.title || 'series'))}`;
    const showStore = 'tvshows';
    const existingShow = this.store.get(showStore, showId);
    const show = existingShow || {
      id: c.tmdb_id ? Number(c.tmdb_id) : showId,
      media_type: 'tv',
      title: c.tmdb_match?.title || parsed.title || 'مسلسل',
      name: c.tmdb_match?.title || parsed.title,
      poster_path: c.tmdb_match?.poster_path || null,
      addedAt: Date.now(),
      inLibrary: true,
    };
    this.store.put(showStore, {
      ...show,
      localFiles: [...new Set([...(show.localFiles || []), c.path])],
      updatedAt: Date.now(),
      inLibrary: true,
      media_type: 'tv',
    });
    const epId = `tv${showId}s${parsed.season ?? 1}e${parsed.episode ?? 0}`;
    const existingEp = this.store.get('episodes', epId);
    this.store.put('episodes', {
      ...(existingEp || {}),
      id: epId, showId, season: parsed.season ?? 1, episode: parsed.episode ?? 0,
      name: existingEp?.name || `الحلقة ${parsed.episode ?? '?'}`,
      still_path: existingEp?.still_path || null,
      localFile: c.path,
      addedAt: existingEp?.addedAt || Date.now(),
      updatedAt: Date.now(),
    });
    this.library.addMediaFile('episodes', epId, this.fileFor(c, parsed));
    this.library.indexWork(showStore, showId);
    if (c.tmdb_id) this.scheduleEnrichment(showStore, showId, c.tmdb_id);
  }

  /** Queue lazy enrichment: full TMDB details fetched in background for confirmed works. */
  scheduleEnrichment(store, key, tmdbId) {
    if (!tmdbId) return;
    setImmediate(async () => {
      try {
        const cur = this.store.get(store, String(key));
        if (cur?.enrichedAt && Date.now() - cur.enrichedAt < 7 * 86400e3) return;
        const full = await this.tmdb.details(store === 'movies' ? 'movie' : 'tv', tmdbId, 'credits');
        if (!full) return;
        const fresh = this.store.get(store, String(key)) || {};
        this.store.put(store, {
          ...fresh, ...full,
          media_type: store === 'movies' ? 'movie' : 'tv',
          inLibrary: true,
          addedAt: fresh.addedAt, localFiles: fresh.localFiles,
          enrichedAt: Date.now(), updatedAt: Date.now(),
        });
        this.library.indexWork(store, String(key));
      } catch { /* offline — next scan enriches */ }
    });
  }
}

function groupSeries() { return new Map(); }

function pickBest(results, title, year) {
  if (!Array.isArray(results) || !results.length) return null;
  const want = normalizeTitle(title || '');
  let best = null;
  for (const r of results.slice(0, 5)) {
    const rt = normalizeTitle(r.title || r.name || '');
    if (!rt || !want) continue;
    let sim = similarity(rt, want);
    const ry = Number(String(r.release_date || r.first_air_date || '').slice(0, 4)) || null;
    if (year && ry) {
      if (Math.abs(ry - year) <= 1) sim += 0.08;
      else if (Math.abs(ry - year) > 3) sim -= 0.2;
    }
    const score = sim;
    if (!best || score > best._sim) best = { ...r, _sim: sim };
  }
  if (!best) return null;
  best._sim = Math.max(0, best._sim);
  return best._sim >= (year ? 0.55 : 0.72) ? best : null;
}

/** Normalized Levenshtein similarity (Arabic-safe). */
export function similarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const m = a.length; const n = b.length;
  if (Math.max(m, n) > 255) {
    // cheap prefix check for very long strings
    const min = Math.min(m, n);
    let same = 0;
    while (same < min && a[same] === b[same]) same++;
    return same / Math.max(m, n);
  }
  const prev = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    let last = prev[0];
    prev[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, last + (a[i - 1] === b[j - 1] ? 0 : 1));
      last = tmp;
    }
  }
  return 1 - prev[n] / Math.max(m, n);
}

function tmdbLite(r, type) {
  return {
    id: r.id,
    title: r.title || r.name || null,
    year: Number(String(r.release_date || r.first_air_date || '').slice(0, 4)) || null,
    poster_path: r.poster_path || null,
    backdrop_path: r.backdrop_path || null,
    overview: r.overview ? String(r.overview).slice(0, 300) : null,
    media_type: type,
  };
}

function dedupeEditions(list, parsed) {
  const out = Array.isArray(list) ? [...list] : [];
  const name = parsed.edition || parsed.quality || null;
  if (name && !out.some((e) => (e.name || e) === name)) {
    out.push({ name, kind: parsed.edition ? 'cut' : 'quality', quality: parsed.quality });
  }
  return out;
}

function dirChain(file, root) {
  const rel = path.relative(root, path.dirname(file));
  return rel ? rel.split(path.sep).reverse() : [];
}

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

function safeJson(s, fb = {}) {
  if (s == null) return fb;
  try { return typeof s === 'string' ? JSON.parse(s) : s; } catch { return fb; }
}
