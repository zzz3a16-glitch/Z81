/**
 * SystemService + PlayerService (abstraction only).
 *
 * PlayerService implements NO playback: no mpv, no libVLC, no ffmpeg, no
 * HTML5 engine (spec 02). It exposes the future contract and answers every
 * capability check honestly so the UI can present a proper disabled state.
 * The real engine lands in a separate future phase and plugs in behind this
 * exact boundary without touching the rest of the app.
 */
import fs from 'node:fs';
import path from 'node:path';

export class PlayerService {
  constructor({ log }) {
    this.log = log;
    this.state = { status: 'not-implemented', session: null };
  }

  static CONTRACT_VERSION = 1;

  /** Stable capability descriptor — the UI reads this to gate playback UIs. */
  capability() {
    return {
      implemented: false,
      code: 'PLAYER_NOT_IMPLEMENTED',
      phase: 'future',
      contractVersion: PlayerService.CONTRACT_VERSION,
      supportedCommands: ['open', 'play', 'pause', 'stop', 'seek', 'volume', 'subtitles', 'audioTracks', 'fullscreen'],
      message: 'مشغّل الوسائط غير مفعّل في هذه المرحلة — البنية جاهزة لمرحلة المحرك القادمة',
    };
  }

  async open(/* mediaRef, options */) {
    const err = new Error('PLAYER_NOT_IMPLEMENTED');
    err.code = 'PLAYER_NOT_IMPLEMENTED';
    throw err;
  }

  async play() { return this._refuse(); }
  async pause() { return this._refuse(); }
  async stop() { return this._refuse(); }
  async seek() { return this._refuse(); }
  async volume() { return this._refuse(); }
  async subtitles() { return this._refuse(); }
  async audioTracks() { return this._refuse(); }
  async fullscreen() { return this._refuse(); }

  async command(/* name, ...args */) { return this._refuse(); }

  getState() {
    return { ...this.state, capability: this.capability() };
  }

  close() { this.state = { status: 'not-implemented', session: null }; return true; }

  _refuse() {
    const err = new Error('PLAYER_NOT_IMPLEMENTED');
    err.code = 'PLAYER_NOT_IMPLEMENTED';
    throw err;
  }
}

export class SystemService {
  /**
   * @param {{paths:any, db:any, log:any, settings:any, tmdb:any, images:any,
   *          app: {getVersion():string, getPath(name:string):string, isPackaged:boolean,
   *                relaunch():void, quit():void},
   *          shell: {openExternal(u:string):Promise<void>, showItemInFolder(p:string):void}}} deps
   */
  constructor({ paths, db, log, settings, tmdb, images, app, shell }) {
    this.paths = paths;
    this.db = db;
    this.log = log;
    this.settings = settings;
    this.tmdb = tmdb;
    this.images = images;
    this.app = app;
    this.shell = shell;
    /** recently picked paths — explicitly user-authorized one-shot access */
    this.recentPicks = new Set();
  }

  authorize(p) { this.recentPicks.add(p); }

  getInfo() {
    return {
      name: 'zPopcorn',
      version: this.app.getVersion(),
      electron: process.versions.electron || 'n/a',
      chrome: process.versions.chrome || 'n/a',
      node: process.versions.node,
      platform: process.platform,
      arch: process.arch,
      packaged: !!this.app.isPackaged,
      paths: {
        root: this.paths.root,
        database: this.paths.dbFile,
        backups: this.paths.backups,
        logs: this.paths.logs,
        images: this.paths.images,
      },
    };
  }

  getPaths() {
    const p = (n) => { try { return this.app.getPath(n); } catch { return null; } };
    return {
      userData: p('userData'),
      videos: p('videos'),
      pictures: p('pictures'),
      documents: p('documents'),
    };
  }

  async getDiagnostics() {
    let online = null;
    try { online = this.tmdb?.stats?.lastOkAt ? Date.now() - this.tmdb.stats.lastOkAt < 10 * 60e3 : null; } catch { /* ignore */ }
    return {
      app: this.getInfo(),
      database: this.db.status(),
      counts: this.db.counts(),
      tmdb: this.tmdb?.status?.() || null,
      cache: {
        images: this.images?.stats?.() || null,
        metadata: this.tmdb?.cacheStats?.() || null,
      },
      settings: { region: this.settings.get('region'), language: this.settings.get('language'), devMode: this.settings.get('devMode') },
      logs: this.log.tail(150),
      recentError: this.tmdb?.stats?.lastError || null,
      online: typeof online === 'boolean' ? online : null,
    };
  }

  async openExternal(url) {
    let parsed;
    try { parsed = new URL(String(url)); } catch { throw new Error('E_INVALID_URL'); }
    if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('E_URL_PROTOCOL');
    await this.shell.openExternal(String(url));
    return true;
  }

  async showItemInFolder(p) {
    const target = String(p || '');
    const inside = this.paths.root && (target.startsWith(this.paths.root));
    const allowed = inside || this.recentPicks.has(target) || this.db.get('SELECT 1 x FROM media_files WHERE norm_path=?', [String(target).toLowerCase()]);
    if (!allowed) throw new Error('E_PATH_NOT_ALLOWED');
    if (!fs.existsSync(target)) throw new Error('E_FILE_NOT_FOUND');
    this.shell.showItemInFolder(target);
    return true;
  }

  async getLogs(tail = 200) {
    const files = this.log.recentFiles();
    let last = null;
    try {
      const latest = files.sort()[files.length - 1];
      if (latest) {
        const content = fs.readFileSync(latest, 'utf8').split('\n');
        last = content.slice(-(Number(tail) || 200)).join('\n');
      }
    } catch { /* ignore */ }
    return { tail: this.log.tail(Number(tail) || 200), file: last ? path.basename(files[files.length - 1]) : null };
  }

  clearLogs() {
    this.log.clear();
    return true;
  }

  restart() {
    this.app.relaunch();
    this.app.exit(0);
    return true;
  }

  quit() {
    this.app.quit();
    return true;
  }
}
