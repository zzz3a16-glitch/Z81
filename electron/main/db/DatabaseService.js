/**
 * DatabaseService — SQLite in the Electron main process (spec 13/72).
 *
 * Dual driver, same SQL surface:
 *   1. better-sqlite3 (native, WAL, true incremental persistence) — used when
 *      the compiled binary matches the running Electron ABI (normal case for
 *      the packaged Windows app; electron-builder rebuilds it at package time).
 *   2. sql.js (SQLite compiled to WASM) — automatic fallback: zero native
 *      deps, works on any platform/arch (incl. future Windows ARM64), and
 *      makes this codebase testable anywhere. Persistence = atomic file
 *      swaps (tmp + rename) + debounce flush + synchronous flush on
 *      checkpoint/close.
 *
 * Guarantees:
 *  - Local, persistent, transaction-safe, versioned (PRAGMA user_version).
 *  - Migration runner: pre-migration backup first; each .sql applied inside
 *    a transaction; post-validation (foreign_key_check + quick_check);
 *    on failure the pre-migration copy is restored. User data is never reset.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const MIGRATIONS_DIR = path.join(import.meta.dirname, 'migrations');

// ------------------------------------------------------------------ drivers
class NativeDriver {
  name = 'better-sqlite3';
  constructor(file, Database) {
    this.db = new Database(file);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('busy_timeout = 5000');
    this.file = file;
  }
  exec(sql) { this.db.exec(sql); }
  all(sql, params) { return this.db.prepare(sql).all(params || []); }
  get(sql, params) { return this.db.prepare(sql).get(params || []); }
  run(sql, params) {
    const r = this.db.prepare(sql).run(params || []);
    return { changes: r.changes, lastInsertRowid: Number(r.lastInsertRowid) };
  }
  pragma(sql, simple) {
    const r = this.db.pragma(sql, simple ? { simple: true } : {});
    return r;
  }
  transaction(fn) { return this.db.transaction(fn)(); }
  flush() { /* native file is already durable */ }
  checkpoint() { try { this.db.pragma('wal_checkpoint(TRUNCATE)'); } catch { /* ignore */ } }
  save() { /* no-op */ }
  close() { this.checkpoint(); this.db.close(); }
}

class WasmDriver {
  name = 'sql.js';
  constructor(file, SQL) {
    this.file = file;
    this.SQL = SQL;
    this.db = fs.existsSync(file)
      ? new SQL.Database(fs.readFileSync(file))
      : new SQL.Database();
    this.db.run('PRAGMA foreign_keys = ON');
    this.dirty = false;
    this.timer = null;
    this.savePath = file;
  }
  _touch() {
    this.dirty = true;
    if (!this.timer) {
      this.timer = setTimeout(() => { this.timer = null; this.flush(); }, 400);
      this.timer.unref?.();
    }
  }
  exec(sql) { this.db.exec(sql); this._touch(); }
  all(sql, params) {
    const stmt = this.db.prepare(sql);
    try {
      if (params?.length) stmt.bind(params);
      const out = [];
      while (stmt.step()) out.push(stmt.getAsObject());
      return out;
    } finally { stmt.free(); }
  }
  get(sql, params) {
    const r = this.all(sql, params);
    return r.length ? r[0] : undefined;
  }
  run(sql, params) {
    this.db.run(sql, params && params.length ? params : undefined);
    const changes = this.db.getRowsModified();
    const li = this.db.exec('SELECT last_insert_rowid() AS id');
    const lastInsertRowid = li[0]?.values?.[0]?.[0] ?? 0;
    this._touch();
    return { changes, lastInsertRowid: Number(lastInsertRowid) };
  }
  pragma(sql, simple) {
    const r = this.db.exec(`PRAGMA ${sql}`);
    if (!r.length) return undefined;
    if (simple) return r[0].values[0][0];
    return r[0].values.map((v) => Object.fromEntries(r[0].columns.map((c, i) => [c, v[i]])));
  }
  transaction(fn) {
    this.db.run('BEGIN');
    try { const r = fn(); this.db.run('COMMIT'); this._touch(); return r; }
    catch (e) { try { this.db.run('ROLLBACK'); } catch { /* ignore */ } throw e; }
  }
  flush() { if (this.dirty) this.save(); }
  checkpoint() { this.flush(); }
  save() {
    if (!this.dirty && fs.existsSync(this.savePath)) return;
    const data = Buffer.from(this.db.export());
    const tmp = this.savePath + '.tmp';
    fs.mkdirSync(path.dirname(this.savePath), { recursive: true });
    fs.writeFileSync(tmp, data);
    fs.renameSync(tmp, this.savePath);
    this.dirty = false;
  }
  close() { this.save(); this.db.close(); }
}

// ------------------------------------------------------------------ service
export class DatabaseService {
  /** @param {{ensurePaths?:boolean}} [opts] */
  constructor(paths, log, opts = {}) {
    this.paths = paths;
    this.log = log;
    this.db = null;
    this.driver = null;
    this.stats = { queries: 0, migrations: 0, lastError: null };
    this.opts = opts;
  }

  get isOpen() { return !!this.db; }

  static async loadWasm() {
    const initSqlJs = (await import('sql.js')).default;
    const wasmPath = (await import('node:url')).fileURLToPath(
      new URL('../../../node_modules/sql.js/dist/sql-wasm.wasm', import.meta.url));
    return initSqlJs({ locateFile: () => wasmPath });
  }

  /** Try native driver; fall back to WASM. Must be awaited. */
  async open() {
    if (this.db) return this.db;
    if (this.opts.ensurePaths !== false) fs.mkdirSync(this.paths.database, { recursive: true });
    let Database = null;
    try {
      Database = (await import('better-sqlite3')).default;
    } catch { Database = null; }
    if (Database) {
      try {
        this.driver = new NativeDriver(this.paths.dbFile, Database);
        this.log.info('db', 'driver: better-sqlite3 (native)');
      } catch (e) {
        this.log.warn('db', `native driver failed (${e.message.split('\n')[0]}) — falling back to sql.js WASM`);
      }
    }
    if (!this.driver) {
      const SQL = await DatabaseService.loadWasm();
      this.driver = new WasmDriver(this.paths.dbFile, SQL);
      this.log.info('db', 'driver: sql.js (WASM)');
    }
    this.db = this.driver;
    this.ensureFts();
    return this.db;
  }

  listMigrations() {
    return fs.readdirSync(MIGRATIONS_DIR).filter((f) => /^\d+_.*\.sql$/.test(f)).sort();
  }

  currentVersion() {
    const v = this.db.pragma('user_version', true);
    return Number(v) || 0;
  }

  /** True when the active driver supports FTS5 (native build does; sql.js does not). */
  get hasFts() { return this._hasFts === true; }

  ensureFts() {
    if (!this.db) return;
    try {
      this.db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS work_fts USING fts5(
        body,
        store UNINDEXED,
        key UNINDEXED,
        tokenize = "unicode61 remove_diacritics 2"
      )`);
      this._hasFts = true;
    } catch {
      this._hasFts = false;
      this.log.info('db', 'FTS5 unavailable in this SQLite build — normalized search fallback active');
    }
  }

  async migrate() {
    await this.open();
    const target = this.listMigrations().length;
    let from = this.currentVersion();
    if (from === 0) {
      const has = this.get("SELECT name FROM sqlite_master WHERE type='table' AND name='doc_store'");
      if (has) { // legacy dev database already at schema — adopt without touching rows
        this.db.pragma(`user_version = ${target}`);
        from = target;
      }
    }
    if (from >= target) {
      this.ensureFts();
      this._validate();
      return { applied: [], backedUpTo: null, driver: this.driver.name };
    }

    const backupPath = this.backupFile('pre-migration');
    const applied = [];
    try {
      const files = this.listMigrations();
      for (let i = from; i < target; i++) {
        const file = files[i];
        const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
        this.transaction(() => {
          this.db.exec(sql);
          this.db.pragma(`user_version = ${i + 1}`);
        });
        applied.push(file);
        this.stats.migrations++;
        this.log.info('db', `migration applied: ${file}`);
      }
      this.ensureFts();
      this._validate();
      this.driver.save();
      return { applied, backedUpTo: backupPath, driver: this.driver.name };
    } catch (err) {
      this.log.error('db', 'migration failed — restoring pre-migration copy', { err: err.message });
      this.close();
      fs.copyFileSync(backupPath, this.paths.dbFile);
      for (const ext of ['-wal', '-shm']) {
        try { fs.rmSync(this.paths.dbFile + ext, { force: true }); } catch { /* ignore */ }
      }
      await this.open();
      this.stats.lastError = err.message;
      throw err;
    }
  }

  _validate() {
    const fk = this.db.pragma('foreign_key_check');
    if (Array.isArray(fk) && fk.length) throw new Error(`foreign key violations: ${fk.length}`);
    const qc = this.db.pragma('integrity_check', true);
    if (qc && qc !== 'ok') throw new Error(`integrity check failed: ${qc}`);
  }

  /** Durable snapshot copy. Returns absolute path. */
  backupFile(label = 'manual') {
    fs.mkdirSync(this.paths.backups, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const target = path.join(this.paths.backups, `zpopcorn-${label}-${stamp}.db`);
    this.writeBackupTo(target);
    this.log.info('db', `backup written: ${path.basename(target)}`);
    return target;
  }

  /** Serialize the current DB state to an arbitrary file (sync-safe). */
  writeBackupTo(target) {
    if (this.driver?.name === 'sql.js') {
      this.driver.dirty = true;
      const data = Buffer.from(this.driver.db.export());
      fs.writeFileSync(target, data);
      return target;
    }
    // native: VACUUM INTO writes a consistent copy without await
    try { fs.rmSync(target, { force: true }); } catch { /* ignore */ }
    this.db.db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
    return target;
  }

  counts() {
    const out = {};
    const tables = this.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").map((r) => r.name);
    for (const t of tables) {
      try { out[t] = this.get(`SELECT COUNT(*) AS c FROM "${t}"`).c; } catch { out[t] = -1; }
    }
    return out;
  }

  status() {
    let size = 0; let integrity = 'unknown';
    try { size = fs.statSync(this.paths.dbFile).size; } catch { /* fresh */ }
    try { if (this.db) integrity = this.db.pragma('quick_check', true) || 'ok'; } catch (e) {
      integrity = 'error: ' + e.message;
    }
    return {
      path: this.paths.dbFile,
      driver: this.driver?.name || 'closed',
      sizeBytes: size,
      integrity,
      version: this.db ? this.currentVersion() : null,
      queries: this.stats.queries,
      migrationsApplied: this.stats.migrations,
      lastError: this.stats.lastError,
    };
  }

  // ---------- query helpers ----------
  all(sql, params = []) {
    this.stats.queries++;
    return this.db.all(sql, params);
  }
  get(sql, params = []) {
    this.stats.queries++;
    const r = this.db.get(sql, params);
    return r === undefined ? null : r;
  }
  run(sql, params = []) {
    this.stats.queries++;
    return this.db.run(sql, params);
  }
  transaction(fn) { return this.db.transaction(fn); }
  /** alias kept for call-site clarity */
  tx(fn) { return this.db.transaction(fn); }

  static sha256(file) {
    const h = crypto.createHash('sha256');
    h.update(fs.readFileSync(file));
    return h.digest('hex');
  }

  /** Validate an arbitrary .db file with whatever driver is available. */
  static async inspectFile(file) {
    if (!fs.existsSync(file)) throw new Error('E_BACKUP_MISSING');
    let Database = null;
    try { Database = (await import('better-sqlite3')).default; } catch { Database = null; }
    if (Database) {
      try {
        const db = new Database(file, { readonly: true, fileMustExist: true });
        try {
          const ok = db.pragma('integrity_check', { simple: true });
          if (ok !== 'ok') throw new Error('E_BACKUP_CORRUPT');
          return {
            integrity: 'ok',
            counts: countOf(db),
            tables: db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => r.name),
          };
        } finally { db.close(); }
      } catch (e) {
        if (String(e.message).startsWith('E_BACKUP')) throw e;
        // fall through to wasm
      }
    }
    const SQL = await DatabaseService.loadWasm();
    let db = null;
    try { db = new SQL.Database(fs.readFileSync(file)); }
    catch { throw new Error('E_BACKUP_CORRUPT'); }
    try {
      const r = db.exec('PRAGMA integrity_check');
      void r;
      const ok = r[0]?.values?.[0]?.[0] === 'ok';
      if (!ok) throw new Error('E_BACKUP_CORRUPT');
      if (!db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='doc_store'").length) {
        throw new Error('E_BACKUP_SCHEMA');
      }
      const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
      const names = tables[0]?.values.map((v) => v[0]) || [];
      const counts = {};
      for (const t of names) {
        const c = db.exec(`SELECT COUNT(*) FROM "${t}"`);
        counts[t] = c[0]?.values?.[0]?.[0] ?? 0;
      }
      return { integrity: 'ok', counts, tables: names };
    } catch (e) {
      if (String(e.message).startsWith('E_BACKUP')) throw e;
      throw new Error('E_BACKUP_CORRUPT');
    } finally { try { db.close(); } catch { /* ignore */ } }
  }

  close() {
    if (this.db) {
      try { this.db.close(); } catch { /* ignore */ }
      this.db = null;
      this.driver = null;
    }
  }

  reopen() { return this.open(); }
}

function countOf(db) {
  const out = {};
  for (const t of ['doc_store', 'settings', 'media_files']) {
    try { out[t] = db.prepare(`SELECT COUNT(*) c FROM "${t}"`).get().c; } catch { out[t] = -1; }
  }
  return out;
}
