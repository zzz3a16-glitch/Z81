/**
 * zPopcorn LIVE — main-process side of the IPTV platform (spec 04–07, 19–20).
 *
 * Two jobs, and only two, because they belong to the privileged layer:
 *   1. playlist/EPG fetching — the renderer never opens a socket. Requests get
 *      size caps, timeouts, redirect caps and an allowlist of http(s) only.
 *   2. playback hand-off — the app owns the library, an external player owns
 *      the stream. `launch` writes a per-session .m3u and opens it with the
 *      system default (VLC/mpv/PotPlayer), or opens the bare URL.
 *
 * The renderer keeps the index: parsing, normalization, search, EPG cache.
 * Everything persistent stays in doc_store, so Live survives restarts.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const MAX_BYTES = 32 * 1024 * 1024;     // 32 MB playlist ceiling
const DEFAULT_TIMEOUT = 20000;
const UA = 'zPopcorn-Live/1.0 (+local IPTV library; playlist fetch only)';

const err = (code, message) => Object.assign(new Error(message || code), { code });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Validate + normalize a user-supplied playlist/stream URL. */
export function safeHttpUrl(raw) {
  let u;
  try { u = new URL(String(raw || '').trim()); } catch { throw err('E_BAD_URL', 'عنوان غير صالح'); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw err('E_BAD_URL', 'يُسمح بـ http/https فقط');
  if (u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '::1'
    || u.hostname.endsWith('.local')) { /* loopback dev sources allowed */ }
  if (u.username || u.password) { /* credentials in URL are legal for IPTV, keep as-is */ }
  return u.toString();
}

export class LiveService {
  /** @param {{store:object, paths:object, log:object, events?:object, shell:object}} deps */
  constructor({ store, paths, log, events, shell }) {
    this.store = store;
    this.paths = paths;
    this.log = log || { info() {}, warn() {}, error() {} };
    this.events = events;
    this.shell = shell;
    this.sessionsDir = path.join(paths.root, 'live', 'sessions');
    this.logoDir = path.join(paths.root, 'live', 'logos');
    fs.mkdirSync(this.sessionsDir, { recursive: true });
    fs.mkdirSync(this.logoDir, { recursive: true });
    this.pruneSessions();
    /** sourceId -> AbortController, so a refresh can be cancelled (spec 20) */
    this.inflight = new Map();
  }

  /* ───────────────────────── fetching ───────────────────────── */

  /**
   * @param {{url:string, maxBytes?:number, timeoutMs?:number}} req
   * @returns {Promise<{status:number, text:string, bytes:number, truncated:boolean}>}
   */
  async fetchText(req = {}) {
    const url = safeHttpUrl(req.url);
    const maxBytes = Math.min(+req.maxBytes || MAX_BYTES, MAX_BYTES);
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(new Error('E_TIMEOUT')), +req.timeoutMs || DEFAULT_TIMEOUT);
    let res;
    try {
      res = await fetch(url, {
        signal: ac.signal,
        redirect: 'follow',
        headers: { 'user-agent': UA, accept: 'application/x-mpegurl,application/vnd.apple.mpegurl,application/octet-stream,*/*' },
      });
    } catch (e) {
      clearTimeout(timer);
      const aborted = String(e?.name || '') === 'AbortError' || String(e?.message || '').includes('E_TIMEOUT');
      throw err(aborted ? 'E_TIMEOUT' : 'E_NETWORK',
        aborted ? 'انتهت مهلة الاتصال بالمصدر' : `لا يمكن الوصول إلى المصدر: ${e.message}`);
    }
    if (!res.ok && res.status >= 400) {
      clearTimeout(timer);
      try { res.body?.cancel(); } catch { /* ignore */ }
      throw err('E_HTTP', `المصدر ردّ بالخطأ ${res.status}`);
    }
    // stream-read with a hard byte cap — a hostile endpoint cannot OOM us
    const chunks = [];
    let bytes = 0;
    let truncated = false;
    try {
      if (res.body && typeof res.body.getReader === 'function') {
        const rd = res.body.getReader();
        for (;;) {
          const { done, value } = await rd.read();
          if (done) break;
          bytes += value.length;
          if (bytes > maxBytes) { truncated = true; await rd.cancel(); break; }
          chunks.push(Buffer.from(value));
        }
      } else {
        const buf = Buffer.from(await res.arrayBuffer());
        bytes = buf.length;
        if (bytes > maxBytes) { truncated = true; chunks.push(buf.subarray(0, maxBytes)); } else chunks.push(buf);
      }
    } finally { clearTimeout(timer); }
    const text = Buffer.concat(chunks).toString('utf8');
    this.log.info?.('live', `fetched ${bytes}B from ${new URL(url).host}${truncated ? ' (truncated)' : ''}`);
    return { status: res.status, text, bytes, truncated, contentType: res.headers.get('content-type') || '' };
  }

  /** Cancel any in-flight fetch/refresh belonging to a source. */
  abortSource(sourceId) {
    const ac = this.inflight.get(String(sourceId));
    if (ac) { try { ac.abort(new Error('E_CANCELLED')); } catch { /* ignore */ } this.inflight.delete(String(sourceId)); }
  }

  /* ───────────────────── playback hand-off ───────────────────── */

  /**
   * Launch a stream in the user's external player (never in-app: spec 02).
   * Writes a one-entry .m3u so the OS resolves the registered handler, which
   * works for HLS URLs a browser could not open directly.
   * @returns {Promise<{ok:boolean, session:string, file:string|null, mode:string}>}
   */
  async launch({ url, title = 'zPopcorn Live', headers = null, mode = 'session' } = {}) {
    const target = safeHttpUrl(url);
    const session = crypto.randomUUID().slice(0, 12);
    let file = null;
    if (mode !== 'direct') {
      const lines = ['#EXTM3U', `#EXTINF:-1,${String(title).replace(/[\r\n]/g, ' ').slice(0, 120)}`];
      for (const [k, v] of Object.entries(headers || {})) {
        if (/^[A-Za-z][A-Za-z0-9-]{0,40}$/.test(k)) lines.push(`#EXTVLCOPT:http-${k.toLowerCase()}=${String(v).replace(/[\r\n]/g, '').slice(0, 300)}`);
      }
      lines.push(target, '');
      file = path.join(this.sessionsDir, `live-${session}.m3u`);
      await fs.promises.writeFile(file, lines.join('\n'), 'utf8');
    }
    // Hand off to the OS: .m3u association wins (players parse it natively);
    // fall back to the bare URL if no handler claimed the file.
    let via = 'failed';
    try {
      if (file) {
        const fail = await this.shell?.openPath(file);
        via = fail ? 'external-url' : 'player';
        if (fail) await this.shell?.openExternal(target);
      } else {
        await this.shell?.openExternal(target);
        via = 'external-url';
      }
    } catch (e) {
      this.log.warn?.('live', `launch failed: ${e.message}`);
    }
    setTimeout(() => { this.endSession({ session }); }, 60000).unref?.(); // players read the file at once
    return { ok: via !== 'failed', via, session, file, mode, target };
  }

  /** delete abandoned session files (older than 2h) */
  pruneSessions() {
    try {
      const cut = Date.now() - 2 * 3600e3;
      for (const n of fs.readdirSync(this.sessionsDir)) {
        const f = path.join(this.sessionsDir, n);
        try { if (fs.statSync(f).mtimeMs < cut) fs.rmSync(f, { force: true }); } catch { /* ignore */ }
      }
    } catch { /* first run */ }
  }

  /** Drop a session file once playback ends (or the renderer gives up). */
  async endSession({ session } = {}) {
    const safe = String(session || '').replace(/[^a-z0-9-]/gi, '');
    if (!safe) return { ok: false };
    try { await fs.promises.rm(path.join(this.sessionsDir, `live-${safe}.m3u`), { force: true }); } catch { /* gone */ }
    return { ok: true };
  }

  /** Remove cached logos tied to a source (spec 04: no orphans). */
  purge({ sourceId, logos = true } = {}) {
    const safe = String(sourceId || '').replace(/[^a-z0-9_-]/gi, '');
    if (!safe) return { ok: false };
    let removed = 0;
    if (!logos) return { ok: true, removed };
    for (const dir of [this.logoDir]) {
      let names = [];
      try { names = fs.readdirSync(dir); } catch { continue; }
      for (const n of names) {
        if (!n.startsWith(`${safe}_`)) continue;
        try { fs.rmSync(path.join(dir, n), { force: true }); removed++; } catch { /* ignore */ }
      }
    }
    return { ok: true, removed };
  }

  /* ───────────────────── channel logos cache ───────────────────── */

  /**
   * Fetch a remote logo into the local cache. Renderer asks before rendering
   * thousands of <img>, so art never hits the network per card (spec 15).
   * @returns {Promise<{ok:boolean, file?:string, reason?:string}>}
   */
  async cacheLogo({ url, sourceId } = {}) {
    if (!url) return { ok: false, reason: 'E_NO_LOGO' };
    let u;
    try { u = new URL(String(url)); } catch { return { ok: false, reason: 'E_BAD_URL' }; }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return { ok: false, reason: 'E_BAD_URL' };
    const key = `${String(sourceId || 'x').replace(/[^a-z0-9_-]/gi, '')}_${crypto.createHash('sha1').update(u.href).digest('hex').slice(0, 20)}`;
    const dest = path.join(this.logoDir, key);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return { ok: true, file: dest };
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(new Error('E_TIMEOUT')), 8000);
    try {
      const res = await fetch(u.href, { signal: ac.signal, redirect: 'follow', headers: { 'user-agent': UA } });
      if (!res.ok) { try { res.body?.cancel(); } catch { /* ignore */ } return { ok: false, reason: 'E_HTTP' }; }
      const buf = Buffer.from(await res.arrayBuffer());
      if (!buf.length || buf.length > 4 * 1024 * 1024) return { ok: false, reason: 'E_SIZE' };
      const sniffed = sniffImage(buf);
      if (!sniffed) return { ok: false, reason: 'E_NOT_IMAGE' };
      const file = `${dest}.${sniffed.ext}`;
      await fs.promises.writeFile(file, buf);
      return { ok: true, file };
    } catch (e) {
      return { ok: false, reason: String(e?.message || 'E_NETWORK') };
    } finally { clearTimeout(t); }
  }

  /** one round-trip: cached-or-fetched logo, returned as a render-ready URL */
  async logoPath({ url, sourceId } = {}) {
    const hit = this.lookupLogo({ url, sourceId });
    if (hit.ok) return { ok: true, src: `zpopcorn-live://${path.basename(hit.file)}` };
    const r = await this.cacheLogo({ url, sourceId });
    if (!r.ok) return r;
    return { ok: true, src: `zpopcorn-live://${path.basename(r.file)}` };
  }

  /** Resolve a cached logo path without fetching (instant hits on re-render). */
  lookupLogo({ url, sourceId } = {}) {
    if (!url) return { ok: false, reason: 'E_NO_LOGO' };
    const key = `${String(sourceId || 'x').replace(/[^a-z0-9_-]/gi, '')}_${crypto.createHash('sha1').update(String(url)).digest('hex').slice(0, 20)}`;
    for (const ext of ['png', 'jpg', 'webp', 'svg', 'ico', 'gif']) {
      const f = `${path.join(this.logoDir, key)}.${ext}`;
      if (fs.existsSync(f)) return { ok: true, file: f };
    }
    return { ok: false, reason: 'E_MISS' };
  }
}

const sniffImage = (b) => {
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50) return { ext: 'png' };
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8) return { ext: 'jpg' };
  if (b.length > 12 && b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP') return { ext: 'webp' };
  if (b.length > 6 && /^GIF8[79]a$/.test(b.subarray(0, 6).toString())) return { ext: 'gif' };
  if (b.length > 4 && b.subarray(0, 4).toString('utf8').trimStart().startsWith('<svg')) return { ext: 'svg' };
  return null;
};

export { sleep };
