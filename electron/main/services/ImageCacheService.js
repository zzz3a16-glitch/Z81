/**
 * ImageCacheService — downloads TMDB artwork into %APPDATA%\zPopcorn\images
 * and serves it through the private `zpopcorn-media://` protocol so posters
 * and backdrops keep working offline (spec 20/21/61).
 *
 * URL format (resolved in renderer via TMDBImage):
 *   zpopcorn-media://image/poster/w342/abc123.jpg
 */
import fs from 'node:fs';
import path from 'node:path';
import { imageDirFor } from '../lib/paths.js';

const SAFE = /^[a-zA-Z0-9._/-]+$/;
const SIZE_TOKEN = /^[a-z]\d{2,4}$|^original$|^h\d{3}$/;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export class ImageCacheService {
  constructor({ paths, tmdb, db, log, fetchImpl }) {
    this.paths = paths;
    this.tmdb = tmdb;
    this.db = db;
    this.log = log;
    this.fetch = fetchImpl || globalThis.fetch;
  }

  static parseUrl(rawUrl) {
    // zpopcorn-media://image/<category>/<size>/<path>
    try {
      const u = new URL(rawUrl);
      if (u.protocol !== 'zpopcorn-media:') return null;
      const parts = (u.host ? u.host + '/' : '') + u.pathname.replace(/^\/+/, '');
      const segs = parts.split('/').filter(Boolean);
      return ImageCacheService._parseSegs(segs);
    } catch {
      return null;
    }
  }

  static _parseSegs(segs) {
    if (segs[0] !== 'image' || segs.length < 4) return null;
    const [, category, size, ...rest] = segs;
    const imgPath = rest.join('/');
    if (!['poster','backdrop','logo','profile','still'].includes(category)) return null;
    if (!SIZE_TOKEN.test(size) || !SAFE.test(imgPath) || imgPath.includes('..')) return null;
    return { category, size, path: '/' + imgPath };
  }

  _cacheFile(category, size, imgPath) {
    const flat = `${size}_${imgPath.replace(/^\/+/, '').replace(/[\\/]/g, '_')}`;
    return path.join(imageDirFor(this.paths, category), flat);
  }

  lookup(pathKey, size) {
    return this.db.get('SELECT file_rel, bytes FROM image_cache_index WHERE path=? AND size_token=?',
      [pathKey, size || '_all']);
  }

  /** Ensure an image exists on disk; returns file path or null. */
  async ensure({ category, size, path: imgPath }) {
    const file = this._cacheFile(category, size, imgPath);
    if (fs.existsSync(file) && fs.statSync(file).size > 0) return file;
    const cfg = await this.tmdb.getImageConfig();
    if (!cfg?.baseUrl) return null;
    const url = `${cfg.baseUrl}${size}${imgPath}`;
    try {
      const res = await this.fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) return null;
      const ab = await res.arrayBuffer();
      if (ab.byteLength > MAX_IMAGE_BYTES || ab.byteLength === 0) return null;
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, Buffer.from(ab));
      this.db.run(
        `INSERT INTO image_cache_index (path, category, size_token, file_rel, bytes)
         VALUES (?,?,?,?,?)
         ON CONFLICT(path) DO UPDATE SET bytes=excluded.bytes, cached_at=excluded.cached_at, file_rel=excluded.file_rel`,
        [imgPath, category, size || '_all', path.relative(this.paths.images, file), ab.byteLength]
      );
      return file;
    } catch (e) {
      this.log.debug('images', `cache miss (offline?) for ${imgPath}`, e.message);
      return null;
    }
  }

  stats() {
    let bytes = 0; let count = 0;
    for (const cat of ['posters', 'backdrops', 'logos', 'profiles', 'stills']) {
      try {
        for (const f of fs.readdirSync(this.paths[cat])) {
          try {
            bytes += fs.statSync(path.join(this.paths[cat], f)).size;
            count++;
          } catch { /* race */ }
        }
      } catch { /* dir may not exist yet */ }
    }
    return { imageCount: count, bytes };
  }

  clear(category) {
    const cats = category && category !== 'all' ? [category + 's'] : ['posters','backdrops','logos','profiles','stills'];
    let removed = 0;
    for (const c of cats) {
      try {
        for (const f of fs.readdirSync(this.paths[c])) {
          fs.rmSync(path.join(this.paths[c], f), { force: true });
          removed++;
        }
      } catch { /* ignore */ }
    }
    if (category && category !== 'all') {
      this.db.run('DELETE FROM image_cache_index WHERE category=?', [category]);
    } else {
      this.db.run('DELETE FROM image_cache_index');
    }
    return removed;
  }
}
