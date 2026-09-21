/**
 * FileSystemService — the ONLY place the main process touches user media
 * directly for UI-triggered operations (spec 66/67). Windows-safe:
 * spaces, Arabic/Unicode names, long paths, missing drives, read-only
 * folders, permission errors. Raw fs calls never scatter into the renderer.
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

const WIN_LONG_PREFIX = '\\\\?\\';

/** Apply \\?\ long-path prefix on Windows when needed (already-prefixed or UNC-safe). */
export function safePath(p) {
  if (process.platform !== 'win32') return p;
  if (p.startsWith(WIN_LONG_PREFIX)) return p;
  if (p.length < 240 && !p.includes('?.') && !/[*?"<>|]/.test(p)) return p;
  if (p.startsWith('\\\\')) return WIN_LONG_PREFIX + p; // UNC
  return WIN_LONG_PREFIX + path.resolve(p);
}

export function isPathInside(child, parent) {
  const c = path.resolve(child).toLowerCase();
  const pr = path.resolve(parent).toLowerCase();
  return c === pr || c.startsWith(pr.endsWith(path.sep) ? pr : pr + path.sep);
}

export class FileSystemService {
  constructor({ paths, db, log, events }) {
    this.paths = paths;
    this.db = db;
    this.log = log;
    this.events = events;
    this.scanAbort = new Set();
  }

  // ---------- guarded access ----------
  /**
   * A path is readable if it lies under a configured library source or under
   * the app data root. This is the renderer-facing sandbox.
   */
  isAllowed(p) {
    if (typeof p !== 'string' || p.includes('\0')) return false;
    let real;
    try { real = fs.realpathSync(path.resolve(p)); } catch { real = path.resolve(p); }
    if (isPathInside(real, this.paths.root)) return true;
    const sources = this.db.all("SELECT path FROM library_sources WHERE enabled=1");
    return sources.some((s) => isPathInside(real, s.path));
  }

  async exists(p) {
    if (!this.isAllowed(p)) return { exists: false, error: 'E_PATH_NOT_ALLOWED' };
    try {
      await fsp.access(safePath(p), fs.constants.F_OK);
      return { exists: true };
    } catch {
      return { exists: false };
    }
  }

  async stat(p) {
    if (!this.isAllowed(p)) return { error: 'E_PATH_NOT_ALLOWED' };
    try {
      const st = await fsp.stat(safePath(p));
      return {
        exists: true,
        isFile: st.isFile(),
        isDirectory: st.isDirectory(),
        size: st.size,
        mtimeMs: st.mtimeMs,
        birthtimeMs: st.birthtimeMs,
        readonly: (() => { try { fs.accessSync(safePath(p), fs.constants.W_OK); return false; } catch { return true; } })(),
      };
    } catch (e) {
      if (e.code === 'ENOENT') return { exists: false };
      if (e.code === 'EPERM' || e.code === 'EACCES') return { exists: true, error: 'E_PERMISSION' };
      return { exists: false, error: e.code || 'E_STAT' };
    }
  }

  /** List immediate directory entries (for folder browser UX). Guarded. */
  async listDir(p, opts = {}) {
    if (!this.isAllowed(p)) return { error: 'E_PATH_NOT_ALLOWED', entries: [] };
    try {
      const entries = await fsp.readdir(safePath(p), { withFileTypes: true });
      const out = [];
      for (const ent of entries.slice(0, opts.limit || 2000)) {
        const full = path.join(p, ent.name);
        let st = null;
        try { st = await fsp.stat(safePath(full)).catch(() => null); } catch { /* ignore */ }
        out.push({
          name: ent.name,
          path: full,
          isDirectory: ent.isDirectory(),
          isFile: ent.isFile(),
          size: st?.size ?? null,
          mtimeMs: st?.mtimeMs ?? null,
        });
      }
      out.sort((a, b) => (b.isDirectory - a.isDirectory) || a.name.localeCompare(b.name, 'ar'));
      return { entries: out };
    } catch (e) {
      if (e.code === 'ENOENT') return { error: 'E_NOT_FOUND', entries: [] };
      if (e.code === 'EACCES' || e.code === 'EPERM') return { error: 'E_PERMISSION', entries: [] };
      return { error: 'E_READDIR', entries: [] };
    }
  }

  /** Windows drive enumeration — never assumes letters stay mounted (spec 66). */
  async getDrives() {
    const drives = [];
    if (process.platform === 'win32') {
      for (let c = 65; c <= 90; c++) {
        const letter = String.fromCharCode(c);
        const root = `${letter}:\\`;
        try {
          await fsp.access(root);
          let total = null; let free = null;
          try {
            const st = await fsp.statfs(root);
            total = st.bsize * st.blocks;
            free = st.bsize * st.bavail;
          } catch { /* ignore */ }
          drives.push({ letter, root, type: root === 'C:\\' ? 'fixed' : 'removable-or-network', total, free });
        } catch { /* not present */ }
      }
      return drives;
    }
    try {
      const st = await fsp.statfs('/');
      drives.push({ letter: '/', root: '/', type: 'unix', total: st.bsize * st.blocks, free: st.bsize * st.bavail });
    } catch { /* ignore */ }
    return drives;
  }

  /**
   * Recursive media scan with cancellation + progress events.
   * @param {string} root
   * @param {{onFile: Function, shouldStop?: () => boolean, maxFiles?: number, exts?: Set<string>}} opts
   */
  async scan(root, opts) {
    const { onFile, shouldStop, maxFiles = 50000 } = opts;
    const seen = new Set();
    let count = 0; let dirs = 0; let errors = 0;
    const stack = [root];
    while (stack.length) {
      if (shouldStop?.() || count >= maxFiles) break;
      const dir = stack.pop();
      dirs++;
      let entries;
      try {
        entries = await fsp.readdir(safePath(dir), { withFileTypes: true });
      } catch (e) {
        errors++;
        this.log.debug('fs', `readdir failed: ${dir}`, e.code);
        continue;
      }
      for (const ent of entries) {
        if (shouldStop?.() || count >= maxFiles) break;
        const full = path.join(dir, ent.name);
        // symlink & hardlink loop guard
        try {
          const real = fs.realpathSync(safePath(full));
          if (seen.has(real)) continue;
          seen.add(real);
        } catch { continue; }
        if (ent.isDirectory()) {
          if (opts.dirFilter && !opts.dirFilter(ent.name, dir)) continue;
          stack.push(full);
        } else if (ent.isFile()) {
          if (opts.fileFilter && !opts.fileFilter(ent.name, dir)) continue;
          try {
            const st = await fsp.stat(safePath(full));
            await onFile({ path: full, filename: ent.name, dir, size: st.size, mtimeMs: st.mtimeMs });
            count++;
          } catch { errors++; }
        }
      }
      if (dirs % 25 === 0) {
        this.events?.emit('scan:progress', { root, files: count, dirs, errors });
      }
    }
    this.events?.emit('scan:progress', { root, files: count, dirs, errors, done: true });
    return { files: count, dirs, errors, truncated: count >= maxFiles };
  }
}
