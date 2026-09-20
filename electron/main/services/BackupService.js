/**
 * BackupService — safe application-data backup/restore (spec 62/72).
 * Backups contain: database (works, editions, files, favorites, history,
 * collections, settings, themes, relationships) — NOT user media files.
 * Every backup carries a manifest (counts + sha256); restore validates the
 * backup, then keeps a pre-restore safety copy. Never overwrites blindly.
 */
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseService } from '../db/DatabaseService.js';

const PREFIX = 'zpopcorn-backup-';

export class BackupService {
  constructor({ db, paths, store, log, events }) {
    this.db = db;
    this.paths = paths;
    this.store = store;
    this.log = log;
    this.events = events;
    this.inProgress = false;
  }

  _emit(pct, phase) {
    this.events?.emit('backup:progress', { pct, phase });
  }

  async create(label = '') {
    if (this.inProgress) throw new Error('E_BACKUP_RUNNING');
    this.inProgress = true;
    try {
      this._emit(5, 'preparing');
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const base = `${PREFIX}${stamp}`;
      const dbFile = path.join(this.paths.backups, `${base}.db`);
      const metaFile = path.join(this.paths.backups, `${base}.json`);
      const counts = this.db.counts();
      this._emit(30, 'copying-database');
      this.db.writeBackupTo(dbFile);
      // settings + doc data live inside the DB — covered by the copy.
      this._emit(70, 'validating');
      const sha = DatabaseService.sha256(dbFile);
      const manifest = {
        app: 'zpopcorn', manifestVersion: 1,
        createdAt: new Date().toISOString(),
        appVersion: this.appVersion || '2.1.0',
        label, dbFile: path.basename(dbFile), metaFile: path.basename(metaFile),
        dbBytes: fs.statSync(dbFile).size, sha256: sha,
        counts,
        includes: ['database', 'settings', 'collections', 'user-metadata', 'library-relationships', 'theme-configuration'],
        excludes: ['media-files (user keeps originals in place)', 'image-cache (re-downloadable)'],
      };
      fs.writeFileSync(metaFile, JSON.stringify(manifest, null, 2));
      // validate the copy
      await this.validatePath(dbFile, metaFile);
      this._emit(100, 'done');
      this.log.info('backup', `created ${path.basename(dbFile)}`);
      return { file: path.basename(dbFile), manifest };
    } finally {
      this.inProgress = false;
    }
  }



  list() {
    const out = [];
    for (const f of fs.readdirSync(this.paths.backups)) {
      if (!f.startsWith(PREFIX) || !f.endsWith('.db')) continue;
      const metaPath = path.join(this.paths.backups, f.replace(/\.db$/, '.json'));
      let meta = null;
      try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch { /* manual copy */ }
      const st = fs.statSync(path.join(this.paths.backups, f));
      out.push({ file: f, bytes: st.size, createdAt: st.mtimeMs, manifest: meta });
    }
    return out.sort((a, b) => b.createdAt - a.createdAt).slice(0, 50);
  }

  async validate(file) {
    const dbPath = path.join(this.paths.backups, path.basename(String(file)));
    const metaPath = dbPath.replace(/\.db$/, '.json');
    return this.validatePath(dbPath, metaPath);
  }

  async validatePath(dbPath, metaPath) {
    if (!fs.existsSync(dbPath)) throw new Error('E_BACKUP_MISSING');
    let meta = null;
    try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')); } catch { /* tolerate */ }
    const info = await DatabaseService.inspectFile(dbPath);
    if (!info.tables.includes('doc_store')) throw new Error('E_BACKUP_SCHEMA');
    if (meta?.sha256) {
      const sha = DatabaseService.sha256(dbPath);
      if (sha !== meta.sha256) throw new Error('E_BACKUP_HASH_MISMATCH');
    }
    if (meta?.counts) {
      for (const t of ['doc_store', 'settings']) {
        if (meta.counts[t] !== undefined) {
          const n = info.counts[t] ?? 0;
          if (n < meta.counts[t]) {
            throw new Error(`E_BACKUP_COUNTS (${t}: expected ${meta.counts[t]}, got ${n})`);
          }
        }
      }
    }
    return { ok: true, integrity: info.integrity, meta };
  }

  /**
   * Restore sequence (spec 92): validate -> pre-restore safety copy ->
   * checkpoint+close -> swap files -> reopen -> integrity re-check -> broadcast.
   */
  async restore(file, { force = false } = {}) {
    const dbPath = path.join(this.paths.backups, path.basename(String(file)));
    const metaPath = dbPath.replace(/\.db$/, '.json');
    this._emit(10, 'validating');
    try {
      await this.validatePath(dbPath, metaPath);
    } catch (e) {
      if (!force) throw e;
      this.log.warn('backup', `restore forced despite validation error: ${e.message}`);
    }
    this._emit(35, 'safety-copy');
    const safety = this.db.backupFile('pre-restore');
    this._emit(60, 'swapping');
    this.db.close();
    try {
      fs.copyFileSync(dbPath, this.paths.dbFile);
      for (const ext of ['-wal', '-shm']) fs.rmSync(this.paths.dbFile + ext, { force: true });
      await this.db.open();
      this._emit(85, 're-validating');
      const qc = this.db.db.pragma('integrity_check', true);
      if (qc && qc !== 'ok') throw new Error('E_RESTORE_INTEGRITY');
      this.log.info('backup', `restored from ${path.basename(dbPath)}; safety copy at ${path.basename(safety)}`);
      this.events?.emit('library:changed', { op: 'restore' });
      this._emit(100, 'done');
      return { restored: true, safetyCopy: path.basename(safety) };
    } catch (e) {
      this.db.close();
      fs.copyFileSync(safety, this.paths.dbFile);
      for (const ext of ['-wal', '-shm']) fs.rmSync(this.paths.dbFile + ext, { force: true });
      await this.db.open();
      this.log.error('backup', `restore failed — rolled back to pre-restore copy: ${e.message}`);
      throw new Error('E_RESTORE_FAILED');
    }
  }

  remove(file) {
    const dbPath = path.join(this.paths.backups, path.basename(String(file)));
    this.validatePath(dbPath, dbPath.replace(/\.db$/, '.json')); // refuses while running? no—just safe name check
    fs.rmSync(dbPath, { force: true });
    fs.rmSync(dbPath.replace(/\.db$/, '.json'), { force: true });
    return true;
  }

  /** JSON export for moving data between the web/PWA app and desktop. */
  exportLegacy() {
    return this.store.exportAll();
  }

  async importLegacyJson(json) {
    let data = json;
    if (typeof json === 'string') {
      try { data = JSON.parse(json); } catch { throw new Error('E_INVALID_JSON'); }
    }
    const res = this.store.importLegacy(data);
    return res;
  }

  status() {
    return {
      inProgress: this.inProgress,
      count: fs.readdirSync(this.paths.backups).filter((f) => f.endsWith('.db')).length,
      newest: this.list()[0]?.file || null,
    };
  }
}

