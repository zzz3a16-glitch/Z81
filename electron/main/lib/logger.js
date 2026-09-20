/**
 * Structured application logging (spec section 71).
 * - daily rotating files under <userData>/logs/app-YYYY-MM-DD.log
 * - levels: debug < info < warn < error; debug only when devMode
 * - secrets redacted; bounded in-memory ring for the Developer panel
 */
import fs from 'node:fs';
import path from 'node:path';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const RING_SIZE = 500;
const REDACT = /(api_key|apikey|token|authorization)=[^&\s"]+/gi;

export class LogService {
  constructor(paths, opts = {}) {
    this.paths = paths;
    this.level = opts.level || 'info';
    this.ring = [];
    this.currentFile = null;
    this.currentDay = null;
    this.keepDays = 7;
  }

  setLevel(level) {
    if (LEVELS[level]) this.level = level;
  }

  _file() {
    const day = new Date().toISOString().slice(0, 10);
    if (day !== this.currentDay) {
      this.currentDay = day;
      this.currentFile = path.join(this.paths.logs, `app-${day}.log`);
      this._rotate();
    }
    return this.currentFile;
  }

  _rotate() {
    try {
      const cutoff = Date.now() - this.keepDays * 86400000;
      for (const f of fs.readdirSync(this.paths.logs)) {
        if (!f.startsWith('app-') || !f.endsWith('.log')) continue;
        const full = path.join(this.paths.logs, f);
        if (fs.statSync(full).mtimeMs < cutoff) fs.rmSync(full, { force: true });
      }
    } catch { /* logging must never crash the app */ }
  }

  log(level, scope, message, detail) {
    if ((LEVELS[level] || 20) < LEVELS[this.level]) return;
    const rec = {
      t: new Date().toISOString(),
      level,
      scope,
      msg: String(message).replace(REDACT, '$1=[redacted]'),
    };
    if (detail !== undefined) {
      try {
        rec.detail = JSON.parse(JSON.stringify(detail));
        rec.detail = String(JSON.stringify(rec.detail)).replace(REDACT, '$1=[redacted]').slice(0, 2000);
      } catch { rec.detail = String(detail).slice(0, 500); }
    }
    this.ring.push(rec);
    if (this.ring.length > RING_SIZE) this.ring.shift();

    const line = `${rec.t} [${level.toUpperCase()}] [${scope}] ${rec.msg}${rec.detail ? ' ' + rec.detail : ''}`;
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);

    try { fs.appendFileSync(this._file(), line + '\n'); } catch { /* ignore */ }
  }

  debug(scope, msg, d) { this.log('debug', scope, msg, d); }
  info(scope, msg, d) { this.log('info', scope, msg, d); }
  warn(scope, msg, d) { this.log('warn', scope, msg, d); }
  error(scope, msg, d) { this.log('error', scope, msg, d); }

  tail(n = 200) {
    return this.ring.slice(-n);
  }

  clear() {
    this.ring.length = 0;
  }

  recentFiles() {
    try {
      return fs.readdirSync(this.paths.logs)
        .filter((f) => f.endsWith('.log'))
        .map((f) => path.join(this.paths.logs, f));
    } catch {
      return [];
    }
  }
}
