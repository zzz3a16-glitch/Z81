/**
 * HealthService — Library Health Center (spec 17).
 * Detects issues; NEVER deletes user media. Repairs are explicit, safe,
 * and reversible (relink / remove-record-only / rescan).
 */
import fs from 'node:fs';
import path from 'node:path';

const STALE_MS = 30 * 86400e3;

export class HealthService {
  constructor({ db, store, library, log, events }) {
    this.db = db;
    this.store = store;
    this.library = library;
    this.log = log;
    this.events = events;
    this.lastRunAt = null;
  }

  idFor(type, ref) {
    return `${type}|${ref}`;
  }

  /** Run the full audit. `checkFiles` does real fs existence checks (bounded). */
  async run({ checkFiles = true } = {}) {
    const found = [];
    const seen = new Set();
    const push = (type, severity, store, key, message, detail) => {
      const id = this.idFor(type, `${store || ''}:${key || ''}:${detail?.path || ''}`);
      seen.add(id);
      found.push({ id, type, severity, store, key, message, detail });
    };

    // 1) missing files
    if (checkFiles) {
      const files = this.db.all("SELECT * FROM media_files WHERE status='ok' LIMIT 20000");
      for (const f of files) {
        let ok = true;
        try { fs.accessSync(f.path, fs.constants.F_OK); } catch { ok = false; }
        if (!ok) {
          this.db.run("UPDATE media_files SET status='missing', missing_since=COALESCE(missing_since,?) WHERE id=?", [Date.now(), f.id]);
          push('missing_file', 'error', f.store, f.work_key, `الملف مفقود: ${path.basename(f.path)}`, { file_id: f.id, path: f.path });
        } else if (f.status !== 'ok') {
          this.db.run("UPDATE media_files SET status='ok', missing_since=NULL WHERE id=?", [f.id]);
        }
      }
    } else {
      for (const f of this.db.all("SELECT * FROM media_files WHERE status='missing' LIMIT 500")) {
        push('missing_file', 'error', f.store, f.work_key, `الملف مفقود: ${path.basename(f.path)}`, { file_id: f.id, path: f.path });
      }
    }

    // 2) sources unavailable (drive removed / path gone)
    for (const src of this.db.all('SELECT * FROM library_sources')) {
      let ok = true; let access = true;
      try { fs.accessSync(src.path, fs.constants.R_OK); } catch (e) { ok = e.code !== 'ENOENT'; access = false; }
      if (!ok || !access) {
        push('source_down', access ? 'warning' : 'error', null, String(src.id),
          access ? `لا يمكن الوصول إلى مصدر: ${src.path}` : `المصدر لم يعد موجوداً: ${src.path}`, { src_id: src.id });
      }
    }

    // 3) broken relationships — episodes without a parent show
    for (const ep of this.db.all("SELECT key, payload FROM doc_store WHERE store='episodes' LIMIT 20000")) {
      const epd = JSON.parse(ep.payload);
      if (epd.showId && !this.store.get('tvshows', String(epd.showId))) {
        push('broken_link', 'error', 'episodes', ep.key, `حلقة غير مرتبطة بمسلسل (id: ${epd.showId})`, { showId: epd.showId });
      }
    }

    // 4) missing metadata / posters
    let metaChecked = 0;
    for (const store of ['movies', 'tvshows']) {
      const rows = this.db.all('SELECT key, payload FROM doc_store WHERE store=? LIMIT 5000', [store]);
      for (const r of rows) {
        if (metaChecked++ > 10000) break;
        const w = JSON.parse(r.payload);
        if (!w.poster_path && !w.localPoster) {
          push('no_poster', 'info', store, r.key, 'لا توجد صورة ملصق', {});
        }
        if (!w.overview) {
          push('no_metadata', 'info', store, r.key, 'لا توجد نبذة', {});
        }
        if (w.enrichedAt && Date.now() - w.enrichedAt > STALE_MS) {
          push('stale_metadata', 'info', store, r.key, 'بيانات TMDB قديمة — يمكن تحديثها', { enrichedAt: w.enrichedAt });
        }
      }
    }

    // 5) inbox backlog
    const pending = this.db.get("SELECT COUNT(*) n FROM import_candidates WHERE status='pending'").n;
    if (pending > 0) push('inbox_backlog', 'warning', null, null, `${pending} عنصر في صندوق الوارد بانتظار المراجعة`, { pending });

    // persist ledger (mark fixed those no longer found)
    this.db.tx(() => {
      for (const f of found) {
        this.db.run(
          `INSERT INTO health_issues (id, type, severity, ref_store, ref_key, message, detail, status, found_at, fixed_at)
           VALUES (?,?,?,?,?,?,?, 'open', ?, NULL)
           ON CONFLICT(id) DO UPDATE SET message=excluded.message, severity=excluded.severity, detail=excluded.detail,
             status = CASE WHEN health_issues.status='dismissed' THEN 'dismissed' ELSE 'open' END,
             found_at=excluded.found_at, fixed_at=NULL`,
          [f.id, f.type, f.severity, f.store, f.key, f.message, JSON.stringify(f.detail || {}), Date.now()]
        );
      }
      if (seen.size) {
        const all = this.db.all("SELECT id FROM health_issues WHERE status='open'");
        for (const row of all) {
          if (!seen.has(row.id)) this.db.run("UPDATE health_issues SET status='fixed', fixed_at=? WHERE id=?", [Date.now(), row.id]);
        }
      }
    });

    this.lastRunAt = Date.now();
    this.events?.emit('health:changed', { at: this.lastRunAt, open: found.length });
    return { checkedAt: this.lastRunAt, found: found.length };
  }

  list({ includeDismissed = false } = {}) {
    const rows = this.db.all(
      `SELECT * FROM health_issues ${includeDismissed ? '' : "WHERE status='open'"} ORDER BY CASE severity WHEN 'error' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, found_at DESC LIMIT 1000`);
    return rows.map((r) => ({ ...r, detail: safeJson(r.detail) }));
  }

  stats() {
    const rows = this.db.all("SELECT severity, COUNT(*) n FROM health_issues WHERE status='open' GROUP BY severity");
    const out = { error: 0, warning: 0, info: 0, total: 0, lastRunAt: this.lastRunAt };
    for (const r of rows) { out[r.severity] = r.n; out.total += r.n; }
    return out;
  }

  dismiss(id) {
    return this.db.run("UPDATE health_issues SET status='dismissed' WHERE id=?", [String(id)]).changes > 0;
  }

  /** Safe repair: relink a missing media file to a user-picked path. */
  relink(issueId, newPath) {
    const issue = this.db.get('SELECT * FROM health_issues WHERE id=?', [String(issueId)]);
    if (!issue) throw new Error('E_NOT_FOUND');
    const detail = safeJson(issue.detail);
    if (detail.file_id) {
      this.library.relinkMediaFile(detail.file_id, newPath);
      this.db.run("UPDATE health_issues SET status='fixed', fixed_at=? WHERE id=?", [Date.now(), issue.id]);
      this.events?.emit('health:changed', { fixed: issue.id });
      return true;
    }
    return false;
  }

  /** Remove ONLY the DB record (never the file itself). */
  removeRecord(issueId) {
    const issue = this.db.get('SELECT * FROM health_issues WHERE id=?', [String(issueId)]);
    if (!issue) throw new Error('E_NOT_FOUND');
    const detail = safeJson(issue.detail);
    if (detail.file_id) {
      this.db.run('DELETE FROM media_files WHERE id=?', [detail.file_id]);
    } else if (issue.ref_store === 'movies' || issue.ref_store === 'tvshows') {
      this.library.remove({ store: issue.ref_store, key: issue.ref_key });
    }
    this.db.run("UPDATE health_issues SET status='fixed', fixed_at=? WHERE id=?", [Date.now(), issue.id]);
    return true;
  }
}

function safeJson(s, fb = {}) {
  if (s == null) return fb;
  try { return typeof s === 'string' ? JSON.parse(s) : s; } catch { return fb; }
}
