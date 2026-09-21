/**
 * LibraryService — works / editions / media files / sources / snapshots and
 * the local full-text index (spec 11/12/25/40). Works live in doc_store
 * (movies / tvshows / episodes) preserving the legacy contract; the
 * Work→Edition→File identity chain is enforced through media_files & editions.
 */
import fs from 'node:fs';
import path from 'node:path';
import { normalizeTitle } from './FileNameParser.js';

export class LibraryService {
  constructor({ db, store, log, events, fs: fss }) {
    this.db = db;
    this.store = store;
    this.log = log;
    this.events = events;
    this.fs = fss;
    events?.on('library:changed', (e) => {
      if (e?.store === 'movies' && e?.key) this.indexWork('movies', e.key);
      if (e?.store === 'tvshows' && e?.key) this.indexWork('tvshows', e.key);
      if (e?.op === 'clear' || e?.op === 'importLegacy') this.reindexAll();
    });
  }

  // ---------- works ----------
  list({ type = 'movies', limit = 500, offset = 0, sort = 'addedAt', dir = 'desc' } = {}) {
    const order = { addedAt: 'updated_at', title: 'ref1', year: 'ref2' }[sort] || 'updated_at';
    const rows = this.db.all(
      `SELECT key, payload FROM doc_store WHERE store=? ORDER BY ${order} ${dir === 'asc' ? 'ASC' : 'DESC'} LIMIT ? OFFSET ?`,
      [type, Math.min(2000, Number(limit) || 500), Number(offset) || 0]
    );
    return rows.map((r) => JSON.parse(r.payload));
  }

  get(store, key) {
    return this.store.get(store, String(key));
  }

  /** Upsert a work from a TMDB result (adds local flags; never overwrites richer local payload). */
  upsert({ type = 'movies', data, files = [] }) {
    if (!data || !Number.isInteger(Number(data.id))) throw new Error('E_INVALID_WORK');
    const store = type === 'tv' || type === 'tvshows' ? 'tvshows' : 'movies';
    const key = String(data.id);
    const existing = this.store.get(store, key);
    const now = Date.now();
    const merged = {
      ...(existing || {}),
      ...data,
      media_type: store === 'movies' ? 'movie' : 'tv',
      inLibrary: true,
      addedAt: existing?.addedAt || now,
      updatedAt: now,
    };
    // user edits win over TMDB refresh (spec 44)
    if (existing?.custom?.title) merged.title = existing.custom.title;
    if (existing?.custom?.overview) merged.overview = existing.custom.overview;
    if (existing?.custom?.rating !== undefined) merged.userRating = existing.custom.rating;
    this.store.put(store, merged);
    for (const f of files) this.addMediaFile(store, key, f);
    this.events?.emit('library:changed', { store, key, op: 'upsert' });
    return merged;
  }

  /** Remove ONLY the library record — never the user's file (spec 17/37). */
  remove({ store, key }) {
    const k = String(key);
    this.db.run('DELETE FROM media_files WHERE store=? AND work_key=?', [store, k]);
    this.db.run('DELETE FROM editions WHERE store=? AND work_key=?', [store, k]);
    if (this.db.hasFts) this.db.run('DELETE FROM work_fts WHERE store=? AND key=?', [store, k]);
    const r = this.store.delete(store, k);
    this.events?.emit('library:changed', { store, key: k, op: 'delete' });
    return r;
  }

  setFlags({ store, key, flags }) {
    const k = String(key);
    const cur = this.store.get(store, k);
    if (!cur) throw new Error('E_NOT_FOUND');
    const next = { ...cur, ...flags, custom: { ...(cur.custom || {}), ...(flags.custom || {}) } };
    delete next.custom;
    next.custom = { ...(cur.custom || {}), ...(flags.custom || {}) };
    this.store.put(store, next);
    return next;
  }

  // ---------- editions & media files ----------
  upsertEdition({ store = 'movies', workKey, name, kind = 'quality', primary = false }) {
    const k = String(workKey);
    if (!name) throw new Error('E_INVALID_EDITION');
    this.db.run(
      `INSERT INTO editions (store, work_key, name, kind, is_primary) VALUES (?,?,?,?,?)
       ON CONFLICT(store, work_key, name) DO UPDATE SET kind=excluded.kind`,
      [store, k, name, kind, 0]
    );
    if (primary) {
      this.db.run('UPDATE editions SET is_primary=0 WHERE store=? AND work_key=?', [store, k]);
      this.db.run('UPDATE editions SET is_primary=1 WHERE store=? AND work_key=? AND name=?', [store, k, name]);
    }
    return this.db.get('SELECT * FROM editions WHERE store=? AND work_key=? AND name=?', [store, k, name]);
  }

  editionsFor(store, workKey) {
    const eds = this.db.all('SELECT * FROM editions WHERE store=? AND work_key=?', [store, String(workKey)]);
    for (const e of eds) e.files = this.db.all('SELECT * FROM media_files WHERE edition_id=?', [e.id]);
    return eds;
  }

  addMediaFile(store, workKey, file) {
    const norm = this.normPath(file.path);
    const ed = file.edition ? this.upsertEdition({ store, workKey, name: file.edition, kind: 'edition' }) : null;
    this.db.run(
      `INSERT INTO media_files (store, work_key, edition_id, path, norm_path, filename, size_bytes, mtime_ms, quality, source_kind, languages, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?, 'ok')
       ON CONFLICT(norm_path) DO UPDATE SET
         work_key=excluded.work_key, size_bytes=excluded.size_bytes, mtime_ms=excluded.mtime_ms,
         quality=excluded.quality, source_kind=excluded.source_kind, status='ok', missing_since=NULL`,
      [store, String(workKey), ed?.id ?? null, file.path, norm, path.basename(file.path),
        file.size ?? null, file.mtimeMs ?? null, file.quality ?? null, file.sourceKind ?? null,
        JSON.stringify(file.languages || [])]
    );
    return this.db.get('SELECT * FROM media_files WHERE norm_path=?', [norm]);
  }

  listMediaFiles(store, workKey) {
    const rows = this.db.all('SELECT mf.*, e.name AS edition FROM media_files mf LEFT JOIN editions e ON e.id=mf.edition_id WHERE mf.store=? AND mf.work_key=?', [store, String(workKey)]);
    return rows.map((r) => ({ ...r, languages: safeJson(r.languages), status_text: r.status === 'missing' ? 'الملف مفقود' : null }));
  }

  removeMediaFile(id) {
    return this.db.run('DELETE FROM media_files WHERE id=?', [Number(id)]).changes > 0;
  }

  /** Relink a missing file to a new path (safe repair — never touches files). */
  relinkMediaFile(id, newPath) {
    const row = this.db.get('SELECT * FROM media_files WHERE id=?', [Number(id)]);
    if (!row) throw new Error('E_NOT_FOUND');
    let st = null;
    try { st = fs.statSync(newPath); } catch { /* missing */ }
    // New path must be a real file — typically picked through the native dialog.
    if (!st || !st.isFile()) throw new Error('E_FILE_NOT_FOUND');
    this.db.run(
      `UPDATE media_files SET path=?, norm_path=?, filename=?, size_bytes=?, mtime_ms=?, status='ok', missing_since=NULL WHERE id=?`,
      [newPath, this.normPath(newPath), path.basename(newPath), st.size, st.mtimeMs, Number(id)]
    );
    this.events?.emit('library:changed', { op: 'relink', id: Number(id) });
    return true;
  }

  normPath(p) {
    return String(p).replace(/\\/g, '/').replace(/\/+/g, '/').toLowerCase();
  }

  // ---------- sources ----------
  listSources() {
    return this.db.all('SELECT * FROM library_sources ORDER BY id').map((s) => ({
      ...s, enabled: !!s.enabled, stats: safeJson(s.stats),
    }));
  }

  addSource({ path: p, label, kind = 'mixed' }) {
    if (typeof p !== 'string' || p.length < 2) throw new Error('E_INVALID_PATH');
    const norm = this.normPath(p);
    const dup = this.db.get('SELECT id FROM library_sources WHERE norm_path=?', [norm]);
    if (dup) return dup.id;
    const r = this.db.run(
      'INSERT INTO library_sources (path, norm_path, label, kind) VALUES (?,?,?,?)',
      [p, norm, label || path.basename(p) || p, kind]
    );
    this.events?.emit('library:changed', { op: 'source-added' });
    return r.lastInsertRowid;
  }

  removeSource(id, { keepLibrary = true } = {}) {
    const r = this.db.run('DELETE FROM library_sources WHERE id=?', [Number(id)]);
    if (!keepLibrary) {
      // remove records of files under that source ONLY (files themselves untouched)
      const src = this.db.get('SELECT norm_path FROM library_sources WHERE id=?', [Number(id)]);
      if (src) this.db.run('DELETE FROM media_files WHERE norm_path LIKE ?', [src.norm_path + '/%']);
    }
    this.events?.emit('library:changed', { op: 'source-removed' });
    return r.changes > 0;
  }

  // ---------- snapshots ----------
  createSnapshot(label) {
    const counts = {
      movies: this.store.count('movies'), tvshows: this.store.count('tvshows'),
      episodes: this.store.count('episodes'), favorites: this.store.count('favorites'),
      mediaFiles: this.db.get('SELECT COUNT(*) c FROM media_files').c,
    };
    this.db.run('INSERT INTO snapshots (label, counts) VALUES (?,?)',
      [label || new Date().toLocaleString('ar-SA'), JSON.stringify(counts)]);
    const backup = this.db.backupFile('snapshot');
    return { id: this.db.get('SELECT last_insert_rowid() id').id, counts, backupFile: path.basename(backup) };
  }

  listSnapshots() {
    return this.db.all('SELECT * FROM snapshots ORDER BY id DESC LIMIT 100')
      .map((s) => ({ ...s, counts: safeJson(s.counts) }));
  }

  restoreSnapshot(id) {
    const s = this.db.get('SELECT * FROM snapshots WHERE id=?', [Number(id)]);
    if (!s || !s.backup_file) {
      // snapshots keep counts only; actual restore is via BackupService
      throw new Error('E_RESTORE_USE_BACKUP');
    }
    return true;
  }

  // ---------- search / index ----------
  indexWork(store, key) {
    if (!this.db.hasFts) return;
    const work = this.store.get(store, key);
    if (!work) return;
    if (this.db.hasFts) this.db.run('DELETE FROM work_fts WHERE store=? AND key=?', [store, String(key)]);
    const names = [work.title, work.original_name, work.name, work.original_title];
    const files = this.db.all('SELECT filename FROM media_files WHERE store=? AND work_key=?', [store, String(key)]);
    const genres = (work.genres || []).map((g) => g.name || g).join(' ');
    const body = [...names, ...files.map((f) => f.filename), genres, String(work.year || '')].filter(Boolean).join(' \u2022 ');
    if (body.trim() && this.db.hasFts) {
      this.db.run('INSERT INTO work_fts (body, store, key) VALUES (?,?,?)', [body, store, String(key)]);
    }
  }

  reindexAll() {
    if (!this.db.hasFts) { this.log.info('library', 'FTS index unavailable — search uses normalized scan'); return; }
    if (this.db.hasFts) this.db.run('DELETE FROM work_fts');
    for (const store of ['movies', 'tvshows']) {
      for (const row of this.db.all('SELECT key, payload FROM doc_store WHERE store=?', [store])) {
        this.indexWork(store, row.key);
      }
    }
    this.log.info('library', 'full-text index rebuilt');
  }

  /** Offline-capable library search (spec 25): FTS + normalized title fallback. */
  search(query, { limit = 50 } = {}) {
    const q = String(query || '').trim();
    if (!q) return [];
    let hits = [];
    try {
      if (!this.db.hasFts) throw new Error('no-fts');
      hits = this.db.all(
        `SELECT store, key, bm25(work_fts) AS score FROM work_fts WHERE work_fts MATCH ? ORDER BY score LIMIT ?`,
        [ftsQuote(q), Number(limit) * 2]
      );
    } catch { hits = []; }
    const out = [];
    const seen = new Set();
    for (const h of hits) {
      const work = this.store.get(h.store, h.key);
      if (!work) continue;
      const id = `${h.store}:${h.key}`;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({ ...work, _store: h.store, _score: -h.score });
    }
    if (out.length < limit) {
      // filename tokens (works with or without FTS5)
      try {
        const fileRows = this.db.all(
          `SELECT store, work_key FROM media_files WHERE filename LIKE ? LIMIT ?`,
          [`%${q.replace(/[%_]/g, '')}%`, Number(limit)]);
        for (const fr of fileRows) {
          const id = `${fr.store}:${fr.work_key}`;
          if (seen.has(id)) continue;
          const work = this.store.get(fr.store, fr.work_key);
          if (!work) continue;
          seen.add(id);
          out.push({ ...work, _store: fr.store, _score: 0.05 });
        }
      } catch { /* ignore */ }
    }
    if (out.length < limit) {
      const norm = normalizeTitle(q);
      for (const store of ['movies', 'tvshows']) {
        for (const row of this.db.all('SELECT key, payload FROM doc_store WHERE store=? LIMIT 5000', [store])) {
          if (out.length >= limit) break;
          const id = `${store}:${row.key}`;
          if (seen.has(id)) continue;
          const work = JSON.parse(row.payload);
          const hay = normalizeTitle([work.title, work.original_title, work.name, work.original_name].filter(Boolean).join(' '));
          if (hay && norm && (hay.includes(norm) || norm.includes(hay))) {
            seen.add(id);
            out.push({ ...work, _store: store, _score: 0.1 });
          }
        }
      }
    }
    return out;
  }

  stats() {
    const perStore = this.store.stats();
    const files = this.db.get(
      `SELECT COUNT(*) AS n, COALESCE(SUM(size_bytes),0) AS bytes,
              SUM(CASE WHEN status='missing' THEN 1 ELSE 0 END) AS missing
       FROM media_files`);
    return { ...perStore, mediaFiles: files.n, mediaBytes: files.bytes, missingFiles: files.missing || 0,
      sources: this.db.get('SELECT COUNT(*) n FROM library_sources').n,
      inboxPending: this.db.get("SELECT COUNT(*) n FROM import_candidates WHERE status='pending'").n };
  }
}

function ftsQuote(q) {
  const clean = q.replace(/["*()^]/g, ' ').trim();
  return clean.split(/\s+/).filter(Boolean).map((t) => `"${t}"*`).join(' ');
}
function safeJson(s, fb = {}) {
  if (s === null || s === undefined) return fb;
  try { return JSON.parse(s); } catch { return fb; }
}
