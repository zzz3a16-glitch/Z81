/**
 * zPopcorn LIVE — renderer service (spec 04–14, 19–20).
 * One local-first manager for sources, playlists, favorites, history, EPG,
 * search and the external-player hand-off. Everything persists in doc_store;
 * the app restarts with the Live platform intact.
 *
 * Fetch policy: desktop proxies playlist/EPG downloads through main
 * (no CORS roulette, hard size caps, cancellable). Browser QA mode uses
 * direct fetch and reports honestly when a host blocks it.
 */
import { db } from '../storage/Database.js';
import { isDesktop, api } from '../../bridge.js';
import { parseM3U, parseXMLTV, parseM3U8Master, normText, progsForDay, nowNext, dayKey } from './m3u.js';

const S_SRC = 'live_sources';
const S_PL = 'live_playlists';
const S_FAV = 'live_favs';
const S_HIS = 'live_history';
const S_EPG = 'live_epg';
const CFG_KEY = 'live-config';
const SESS_KEY = 'live-session';

export const LIVE_DEFAULTS = {
  launch: 'session',        // 'session' (temp .m3u → system player) | 'direct' (open URL)
  epgMinutes: 360,          // auto refresh cadence while a Live view is mounted
  historyDays: 60,
  hideAdult: true,
};

const emit = (type, detail = {}) => {
  if (typeof window === 'undefined' || !window.dispatchEvent) return;
  window.dispatchEvent(new CustomEvent('zpopcn-live', { detail: { type, ...detail } }));
};

const uid = () => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

class LiveManager {
  constructor() {
    this.ready = null;
    this.sources = [];          // ordered
    this.playlists = new Map(); // sourceId -> {builtAt, channels[]}
    this.flat = [];             // merged channel index (hidden/adult filtered out at query time)
    this.byId = new Map();
    this.favs = new Map();      // chanId -> rec
    this.hist = new Map();     // chanId -> {chanId,lastWatch,plays,sourceId}
    this.config = { ...LIVE_DEFAULTS };
    this.session = null;        // {chanId, at, title}
    this.epgMem = new Map();    // `${srcId}|${epgId}` -> progs[] (loaded day window)
    this.epgStatus = new Map(); // srcId -> {builtAt, reason?}
    this._loading = new Map();  // sourceId -> Promise (import single-flight)
    this._epgFlight = new Map();// srcId -> Promise
    this._logoCache = new Map();// url -> renderable src | null
    this.context = null;       // channel list the session navigates within
    this._tick = null;
    this._epgTimer = null;
  }

  /* ───────────────────────── lifecycle ───────────────────────── */

  init() {
    if (!this.ready) this.ready = this._load();
    return this.ready;
  }

  async _load() {
    const [srcs, favs, hist, cfg, sess] = await Promise.all([
      db.getAll(S_SRC).catch(() => []),
      db.getAll(S_FAV).catch(() => []),
      db.getAll(S_HIS).catch(() => []),
      db.get('settings', CFG_KEY).catch(() => null),
      db.get('settings', SESS_KEY).catch(() => null),
    ]);
    srcs.sort((a, b) => (a.order ?? a.addedAt) - (b.order ?? b.addedAt));
    this.sources = srcs;
    this.favs = new Map(favs.map((f) => [f.chanId, f]));
    this.hist = new Map(hist.map((h) => [h.chanId, h]));
    this.config = { ...LIVE_DEFAULTS, ...(cfg?.value || {}) };
    this.session = sess?.value || null;
    await this._loadPlaylists();
    this.rebuildIndex();
    return this;
  }

  async _loadPlaylists() {
    const needed = this.sources.filter((s) => s.enabled !== false || s.status === 'error');
    const docs = await Promise.all(needed.map((s) => db.get(S_PL, s.id).catch(() => null)));
    this.playlists = new Map();
    for (const d of docs) if (d?.channels) this.playlists.set(d.sourceId, d);
    // EPG freshness bookkeeping from source rows
    for (const s of this.sources) if (s.epgBuiltAt) this.epgStatus.set(s.id, { builtAt: s.epgBuiltAt });
  }

  rebuildIndex() {
    this.flat = [];
    this.byId = new Map();
    for (const src of this.sources) {
      if (src.enabled === false) continue;
      const pl = this.playlists.get(src.id);
      if (!pl) continue;
      for (const c of pl.channels) {
        const ch = c.src ? c : { ...c, src: src.id };
        if (!ch.src) ch.src = src.id;
        this.flat.push(ch);
        this.byId.set(ch.id, ch);
      }
    }
  }

  /* ───────────────────────── config / session ───────────────────────── */

  async setConfig(patch) {
    this.config = { ...this.config, ...patch };
    await db.put('settings', { key: CFG_KEY, value: this.config, updatedAt: Date.now() });
    emit('config', { config: this.config });
    return this.config;
  }

  _setSession(sess) {
    this.session = sess;
    if (sess) db.put('settings', { key: SESS_KEY, value: sess, updatedAt: Date.now() }).catch(() => {});
    else db.delete('settings', SESS_KEY).catch(() => {});
    emit('session', { session: sess });
  }

  /* ───────────────────────── sources ───────────────────────── */

  async addSource({ name, url, kind = 'url', text = null, epgUrl = '' }) {
    await this.init();
    const src = {
      id: uid(), name: String(name || 'مصدر مباشر').trim().slice(0, 80),
      kind, url: url ? String(url).trim() : '', epgUrl: epgUrl ? String(epgUrl).trim() : '',
      enabled: true, addedAt: Date.now(), order: Date.now(),
      status: 'new', channelCount: 0, groupsCount: 0, lastUpdate: 0, error: null,
    };
    if (!src.url && !text) throw Object.assign(new Error('يلزم رابط أو ملف قائمة'), { code: 'E_NO_INPUT' });
    this.sources.push(src);
    await db.put(S_SRC, src);
    if (text) await this._stashText(src.id, text); // file import path
    await this.importSource(src.id);
    return src;
  }

  async _stashText(sourceId, text) {
    await db.put(S_PL, { sourceId, builtAt: Date.now(), raw: true, text, channels: [] });
  }

  async updateSource(id, patch) {
    const src = this.sources.find((s) => s.id === id);
    if (!src) return null;
    Object.assign(src, patch);
    src.order = src.order ?? Date.now();
    await db.put(S_SRC, src);
    if (patch.enabled === false) this._cancel(id);
    this.rebuildIndex();
    emit('sources', { sources: this.sources });
    return src;
  }

  async removeSource(id) {
    await this._cancel(id);
    this.sources = this.sources.filter((s) => s.id !== id);
    this.playlists.delete(id);
    await Promise.all([
      db.delete(S_SRC, id), db.delete(S_PL, id),
      db.delete(S_EPG, `${id}|win`).catch(() => {}),
      isDesktop && api.live?.purge ? api.live.purge({ sourceId: id }).catch(() => {}) : null,
    ]);
    // favorites tied to the source become orphans → drop them (history kept, harmless)
    for (const [k, f] of [...this.favs]) if (f.sourceId === id) { this.favs.delete(k); await db.delete(S_FAV, k).catch(() => {}); }
    this.rebuildIndex();
    emit('sources', { sources: this.sources });
  }

  toggleSource(id) {
    const src = this.sources.find((s) => s.id === id);
    if (!src) return;
    return this.updateSource(id, { enabled: src.enabled === false });
  }

  async clearSourceCache(id) {
    await db.delete(S_PL, id).catch(() => {});
    await db.delete(S_EPG, `${id}|win`).catch(() => {});
    this.epgMem = new Map([...this.epgMem].filter(([k]) => !k.startsWith(`${id}|`)));
    if (isDesktop && api.live?.purge) await api.live.purge({ sourceId: id, logos: true }).catch(() => {});
    this.playlists.delete(id);
    const src = this.sources.find((s) => s.id === id);
    if (src) Object.assign(src, { status: 'new', channelCount: 0, lastUpdate: 0, error: null }), await db.put(S_SRC, src);
    this.rebuildIndex();
    emit('sources', { sources: this.sources });
  }

  /* ───────────────────────── import pipeline ───────────────────────── */

  _cancel(sourceId) {
    if (isDesktop) api.live?.abortSource?.({ sourceId })?.catch?.(() => {});
    this._loading.delete(sourceId);
  }

  importSource(sourceId, { force = false } = {}) {
    if (this._loading.has(sourceId)) return this._loading.get(sourceId);
    const p = this._import(sourceId, force).finally(() => this._loading.delete(sourceId));
    this._loading.set(sourceId, p);
    return p;
  }

  async _import(sourceId, force) {
    const src = this.sources.find((s) => s.id === sourceId);
    if (!src) return;
    const existing = await db.get(S_PL, sourceId).catch(() => null);
    const setStatus = async (status, error = null, extra = {}) => {
      Object.assign(src, { status, error, ...extra });
      await db.put(S_SRC, src).catch(() => {});
      emit('progress', { sourceId, status, error, ...extra });
    };
    await setStatus('importing');
    try {
      let text = '';
      const stashed = existing?.raw ? existing.text : null;
      if (stashed) {
        text = stashed;
      } else if (src.url) {
        const res = await this._fetch(src.url, { timeoutMs: 25000 });
        text = res.text;
        if (res.truncated) emit('progress', { sourceId, warn: 'truncated' });
      } else throw Object.assign(new Error('لا رابط ولا ملف للمصدر'), { code: 'E_NO_INPUT' });

      // choose the parser: extended m3u vs raw m3u8 master vs bare list
      const looksM3U8 = /\.m3u8(\?|$)/i.test(src.url || '') && !/#EXTINF/i.test(text);
      let channels = [];
      let levels = [];
      if (looksM3U8) {
        levels = parseM3U8Master(text);
        const base = (src.url || '').split('?')[0];
        if (levels.length) {
          channels = levels.map((lv, i) => ({
            id: `${sourceId}~lv${i}`, name: `${src.name} — ${lv.height ? `${lv.height}p` : `جودة ${i + 1}`}`,
            raw: '', stream: new URL(lv.url, base).href, logo: '', group: 'عام', country: null, lang: '', epg: '',
            cat: 'general', i, opts: {},
          }));
        } else channels = [{ id: `${sourceId}~lv0`, name: src.name, raw: '', stream: src.url, logo: '', group: 'عام', country: null, lang: '', epg: '', cat: 'general', i: 0, opts: {} }];
      } else {
        channels = await parseM3U(text, {
          sourceId,
          onProgress: (lines) => emit('progress', { sourceId, status: 'importing', lines }),
        });
      }
      if (!channels.length) {
        await db.delete(S_PL, sourceId).catch(() => {});
        this.playlists.delete(sourceId);
        await setStatus('empty', 'لم تُعثر على أي قناة في القائمة');
        this.rebuildIndex();
        return;
      }
      const groups = new Set(channels.map((c) => c.group));
      const doc = { sourceId, builtAt: Date.now(), count: channels.length, channels: channels.map((c) => ({ ...c, src: sourceId })) };
      await db.put(S_PL, doc);
      this.playlists.set(sourceId, doc);
      await setStatus('ok', null, { channelCount: channels.length, groupsCount: groups.size, lastUpdate: Date.now() });
      this.rebuildIndex();
      emit('imported', { sourceId, count: channels.length });
    } catch (e) {
      if (String(e?.message || '').includes('E_CANCELLED')) { await setStatus('new'); return; }
      await setStatus('error', String(e?.message || 'فشل الاستيراد').slice(0, 200));
      emit('error', { sourceId, message: e?.message });
    }
  }

  async refreshAll() {
    for (const s of this.sources.filter((x) => x.enabled !== false)) {
      try { await this.importSource(s.id, { force: true }); } catch { /* isolated per source */ }
    }
  }

  async _fetch(url, opts = {}) {
    if (isDesktop && api?.live?.fetchText) {
      return api.live.fetchText({ url, timeoutMs: opts.timeoutMs || 20000 });
    }
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), opts.timeoutMs || 15000);
    try {
      const res = await fetch(url, { signal: ac.signal, redirect: 'follow' });
      if (!res.ok) throw Object.assign(new Error(`المصدر ردّ بالخطأ ${res.status}`), { code: 'E_HTTP' });
      const buf = await res.arrayBuffer();
      const capped = buf.byteLength > 24 * 1024 * 1024;
      const text = new TextDecoder('utf-8', { fatal: false }).decode(capped ? buf.slice(0, 24 * 1024 * 1024) : buf);
      return { status: res.status, text, truncated: capped };
    } catch (e) {
      const blocked = e?.name === 'AbortError' ? 'انتهت المهلة' : 'تعذّر الجلب — متصفح المعاينة يحجب بعض المصادر (CORS). استخدم تطبيق سطح المكتب.';
      throw Object.assign(new Error(e?.message && e.code ? e.message : blocked), { code: e?.code || 'E_NETWORK' });
    } finally { clearTimeout(t); }
  }

  /* ───────────────────────── queries ───────────────────────── */

  /** visibility view honoring hide-adult + per-channel hidden list */
  visible() {
    const hidden = this.config.hidden instanceof Set ? this.config.hidden : new Set(this.config.hidden || []);
    const hideA = this.config.hideAdult !== false;
    return this.flat.filter((c) => !hidden.has(c.id) && !(hideA && c.cat === 'adult'));
  }

  channel(id) { return this.byId.get(id) || this.favs.get(id) || null; }

  channels({ q = '', group = '', country = '', cat = '', source = '', lang = '', sort = 'name', limit = 0 } = {}) {
    let list = this.visible();
    if (source) list = list.filter((c) => c.src === source);
    if (group) list = list.filter((c) => c.group === group);
    if (country) list = list.filter((c) => c.country === country);
    if (cat) list = list.filter((c) => c.cat === cat);
    if (lang) list = list.filter((c) => (c.lang || '').includes(lang));
    const query = normText(q);
    if (query) {
      const toks = query.split(' ').filter(Boolean);
      list = list.filter((c) => {
        const hay = c._hay || (c._hay = `${normText(c.name)} ${normText(c.group)} ${normText(c.raw)}`);
        return toks.every((t) => hay.includes(t));
      });
    }
    const byName = (a, b) => a.name.localeCompare(b.name, 'ar');
    if (sort === 'recent') {
      const h = this.hist;
      list = [...list].sort((a, b) => ((h.get(b.id)?.lastWatch) || 0) - ((h.get(a.id)?.lastWatch) || 0) || byName(a, b));
    } else if (sort === 'added') {
      list = [...list].sort((a, b) => (b._added || 0) - (a._added || 0) || byName(a, b));
    } else if (sort === 'fav') {
      const f = this.favs;
      list = [...list].sort((a, b) => (f.has(b.id) - f.has(a.id)) || byName(a, b));
    } else if (!query) list = [...list].sort(byName);
    return limit ? list.slice(0, limit) : list;
  }

  groups() {
    const m = new Map();
    for (const c of this.visible()) m.set(c.group, (m.get(c.group) || 0) + 1);
    return [...m].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
  }

  countries() {
    const m = new Map();
    for (const c of this.visible()) if (c.country) m.set(c.country, (m.get(c.country) || 0) + 1);
    return [...m].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
  }

  categories() {
    const m = new Map();
    for (const c of this.visible()) { const k = c.cat || 'general'; m.set(k, (m.get(k) || 0) + 1); }
    return m;
  }

  /** channels that actually have EPG ids (drives guide honesty) */
  epgReadySources() { return this.sources.filter((s) => s.enabled !== false && s.epgUrl); }

  /* ───────────────────────── favorites / history ───────────────────────── */

  isFav(id) { return this.favs.has(id); }

  async toggleFav(chan) {
    const id = chan.id;
    if (this.favs.has(id)) {
      this.favs.delete(id);
      await db.delete(S_FAV, id).catch(() => {});
    } else {
      const rec = { chanId: id, sourceId: chan.src, name: chan.name, logo: chan.logo || '', group: chan.group || '', addedAt: Date.now() };
      this.favs.set(id, rec);
      await db.put(S_FAV, rec).catch(() => {});
    }
    emit('favs', { count: this.favs.size });
    return this.favs.has(id);
  }

  favChannels() {
    const out = [];
    for (const f of this.favs.values()) out.push(this.byId.get(f.chanId) || { ...f, id: f.chanId, orphan: true });
    return out.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
  }

  async recordWatch(chan) {
    const prev = this.hist.get(chan.id);
    const rec = { chanId: chan.id, sourceId: chan.src, lastWatch: Date.now(), plays: (prev?.plays || 0) + 1 };
    this.hist.set(chan.id, rec);
    await db.put(S_HIS, rec).catch(() => {});
    emit('history', { chanId: chan.id });
  }

  recent(limit = 12) {
    const cut = Date.now() - (this.config.historyDays || 60) * 864e5;
    return [...this.hist.values()]
      .filter((h) => h.lastWatch >= cut)
      .sort((a, b) => b.lastWatch - a.lastWatch)
      .slice(0, limit)
      .map((h) => ({ ...h, chan: this.byId.get(h.chanId) || null }));
  }

  /** honest local "trending": most launched channels of the past week */
  trending(limit = 12) {
    const cut = Date.now() - 7 * 864e5;
    return [...this.hist.values()]
      .filter((h) => h.lastWatch >= cut && h.plays > 1)
      .sort((a, b) => b.plays - a.plays)
      .slice(0, limit)
      .map((h) => ({ ...h, chan: this.byId.get(h.chanId) || null }));
  }

  recentlyAdded(limit = 12) {
    const srcAdded = new Map(this.sources.map((s) => [s.id, s.addedAt || 0]));
    return this.visible()
      .filter((c) => Date.now() - (srcAdded.get(c.src) || 0) < 14 * 864e5)
      .slice(0, limit);
  }

  clearHistory() {
    this.hist = new Map();
    return db.clear(S_HIS).then(() => emit('history', { cleared: true }));
  }

  async toggleHidden(chan) {
    const set = new Set(this.config.hidden || []);
    set.has(chan.id) ? set.delete(chan.id) : set.add(chan.id);
    await this.setConfig({ hidden: [...set].slice(-5000) });
  }

  /* ───────────────────────── launch (external playback, spec 06/07) ───────────────────────── */

  async launch(chan, { context = null } = {}) {
    if (!chan?.stream) throw Object.assign(new Error('لا رابط بث لهذا المصدر'), { code: 'E_STREAM' });
    await this.recordWatch(chan);
    const headers = { ...chan.opts };
    let res = { ok: true, via: 'browser' };
    if (isDesktop && api?.live?.launch) {
      res = await api.live.launch({ url: chan.stream, title: chan.name, headers, mode: this.config.launch === 'direct' ? 'direct' : 'session' });
    } else {
      // Browser QA: a per-click blob playlist a registered player/OS can open, else new tab.
      try {
        const blob = new Blob([`#EXTM3U\n#EXTINF:-1,${chan.name}\n${chan.stream}\n`], { type: 'audio/x-mpegurl' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = `${(chan.name || 'zpop-live').replace(/[\\/:*?"<>|]/g, '_')}.m3u`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 30000);
      } catch {
        window.open(chan.stream, '_blank', 'noopener');
      }
    }
    this._setSession({ chanId: chan.id, at: Date.now(), file: res.session || null, via: res.via || 'browser', context: context || undefined });
    this.context = context || this.visible().slice(0, 2000); // quick prev/next neighbourhood
    return res;
  }

  endSession() {
    const file = this.session?.file;
    this._setSession(null);
    if (file && isDesktop && api?.live?.endSession) api.live.endSession({ session: file }).catch(() => {});
  }

  sessionChannel() { return this.session ? this.byId.get(this.session.chanId) || this.favs.get(this.session.chanId) : null; }

  /** move to prev/next within the active context; launches immediately */
  hop(dir = 1) {
    const list = this.context?.length ? this.context : this.visible();
    if (!list.length || !this.session) return null;
    const i = list.findIndex((c) => c.id === this.session.chanId);
    const nxt = list[(i + dir + list.length) % list.length];
    if (nxt) this.launch(nxt, { context: this.context });
    return nxt;
  }

  async copyStream(chan) {
    try { await navigator.clipboard.writeText(chan.stream); return true; } catch {
      const t = document.createElement('textarea'); t.value = chan.stream; document.body.appendChild(t); t.select();
      const ok = document.execCommand?.('copy'); t.remove(); return !!ok;
    }
  }

  /* ───────────────────────── EPG ───────────────────────── */

  /** programmes for a channel in the loaded window (never fetches) */
  progs(chan) {
    if (!chan?.epg) return null;
    const p = this.epgMem.get(`${chan.src}|${chan.epg}`);
    return p && p.length ? p : null;
  }

  currentNext(chan, now = Date.now()) {
    const p = this.progs(chan);
    if (!p) return null;
    return nowNext(p, now);
  }

  dayProgs(chan, dayISO) {
    const p = this.progs(chan);
    return p ? progsForDay(p, dayISO) : null;
  }

  /** ensure EPG window for a source; resolves {ok, count, reason?} */
  ensureEpg(sourceId, { force = false } = {}) {
    const key = sourceId;
    if (this._epgFlight.has(key)) return this._epgFlight.get(key);
    const p = this._ensureEpg(sourceId, force).finally(() => this._epgFlight.delete(key));
    this._epgFlight.set(key, p);
    return p;
  }

  async _ensureEpg(sourceId, force) {
    const src = this.sources.find((s) => s.id === sourceId);
    if (!src) return { ok: false, reason: 'E_NO_SRC' };
    if (!src.epgUrl) return { ok: false, reason: 'E_NO_EPG_URL' };
    const st = this.epgStatus.get(sourceId);
    const fresh = st && Date.now() - st.builtAt < (this.config.epgMinutes || 360) * 60e3;
    if (fresh && !force && this._epgHas(src)) return { ok: true, cached: true };
    try {
      emit('epg', { sourceId, phase: 'fetch' });
      const res = await this._fetch(src.epgUrl, { timeoutMs: 60000 });
      emit('epg', { sourceId, phase: 'parse' });
      const today = dayKey(Date.now());
      const winFrom = new Date(`${today}T00:00:00`).getTime() - 864e5;
      const winTo = winFrom + 3 * 864e5;
      const { byChan } = await parseXMLTV(res.text, { onProgress: (n) => emit('epg', { sourceId, phase: 'parse', n }) });
      // split: load into memory + persist compact per-source-day doc
      const keep = new Map();
      let count = 0;
      for (const [epgId, progs] of byChan) {
        const sel = progs.filter((p) => p.e > winFrom && p.s < winTo);
        if (!sel.length) continue;
        count += sel.length;
        keep.set(epgId, sel);
        this.epgMem.set(`${sourceId}|${epgId}`, sel);
      }
      await db.put(S_EPG, { key: `${sourceId}|win`, sourceId, builtAt: Date.now(), from: winFrom, to: winTo, chanCount: keep.size, progCount: count, byChan: Object.fromEntries(keep) });
      this.epgStatus.set(sourceId, { builtAt: Date.now(), count });
      Object.assign(src, { epgBuiltAt: Date.now(), epgChannels: keep.size });
      await db.put(S_SRC, src).catch(() => {});
      emit('epg', { sourceId, phase: 'done', channels: keep.size, programs: count });
      return { ok: true, channels: keep.size };
    } catch (e) {
      this.epgStatus.set(sourceId, { builtAt: st?.builtAt || 0, reason: String(e?.message || 'E_EPG').slice(0, 160) });
      emit('epg', { sourceId, phase: 'error', message: e?.message });
      return { ok: false, reason: e?.message };
    }
  }

  _epgHas(src) {
    for (const k of this.epgMem.keys()) if (k.startsWith(`${src.id}|`)) return true;
    return false;
  }

  async loadEpgDocs() {
    if (this._epgLoaded) return;
    this._epgLoaded = true;
    const docs = await Promise.all(this.sources.map((s) => db.get(S_EPG, `${s.id}|win`).catch(() => null)));
    const now = Date.now();
    for (const d of docs) {
      if (!d?.byChan || now - d.builtAt > (this.config.epgMinutes || 360) * 60e3) continue;
      for (const [epgId, progs] of Object.entries(d.byChan)) {
        // keep only ±1d window around now (docs are already bounded; guard stale sizes)
        this.epgMem.set(`${d.sourceId}|${epgId}`, progs);
      }
      this.epgStatus.set(d.sourceId, { builtAt: d.builtAt, count: d.progCount });
    }
  }

  async refreshEpgAll() {
    for (const s of this.epgReadySources()) await this.ensureEpg(s.id, { force: true });
  }

  async clearEpg() {
    this.epgMem = new Map();
    this.epgStatus = new Map();
    for (const s of this.sources) { db.delete(S_EPG, `${s.id}|win`).catch(() => {}); Object.assign(s, { epgBuiltAt: 0 }); db.put(S_SRC, s).catch(() => {}); }
    emit('epg', { cleared: true });
  }

  /** gentle background cadence while a Live view is mounted */
  startEpgTicker() {
    this.stopEpgTicker();
    this._epgTimer = setInterval(() => {
      for (const s of this.epgReadySources()) {
        const st = this.epgStatus.get(s.id);
        if (!st || Date.now() - st.builtAt > (this.config.epgMinutes || 360) * 60e3) this.ensureEpg(s.id).catch(() => {});
      }
    }, 60e3);
  }
  stopEpgTicker() { if (this._epgTimer) clearInterval(this._epgTimer); this._epgTimer = null; }

  /* ───────────────────────── data management ───────────────────────── */

  async resetAll() {
    this._loading.forEach((_, id) => this._cancel(id));
    await Promise.all([db.clear(S_SRC), db.clear(S_PL), db.clear(S_FAV), db.clear(S_HIS), db.clear(S_EPG)]);
    db.delete('settings', CFG_KEY).catch(() => {});
    db.delete('settings', SESS_KEY).catch(() => {});
    this.sources = []; this.playlists = new Map(); this.favs = new Map(); this.hist = new Map();
    this.epgMem = new Map(); this.epgStatus = new Map();
    this.config = { ...LIVE_DEFAULTS }; this.session = null;
    this.rebuildIndex();
    emit('reset', {});
  }

  stats() {
    const epgChannels = new Set([...this.epgMem.keys()].map((k) => k.split('|').slice(1).join('|'))).size;
    return {
      sources: this.sources.length,
      active: this.sources.filter((s) => s.enabled !== false).length,
      channels: this.flat.length,
      groups: this.groups().length,
      favs: this.favs.size,
      history: this.hist.size,
      epgChannels,
    };
  }

  /* ───────────────────────── logos ───────────────────────── */

  /** desktop: cached src; browser: direct URL. null = none/no-cache yet */
  logoSrc(chan) {
    const url = chan?.logo;
    if (!url) return null;
    if (!isDesktop) return url;
    return this._logoCache.get(url) ?? undefined; // undefined = not resolved yet
  }

  async ensureLogo(chan) {
    const url = chan?.logo;
    if (!url || !isDesktop || !api?.live?.logoPath) return null;
    if (this._logoCache.has(url)) return this._logoCache.get(url);
    this._logoCache.set(url, null); // single-flight stamp (negative cache too)
    try {
      const r = await api.live.logoPath({ url, sourceId: chan.src || 'x' });
      const src = r?.ok ? r.src : null;
      this._logoCache.set(url, src);
      return src;
    } catch { return null; }
  }
}

export const live = new LiveManager();
export { normText, dayKey };
