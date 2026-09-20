/**
 * TMDBService — the single centralized TMDB client (spec 19/20/21).
 * Cache-first with TTL, request de-duplication, stale-while-revalidate,
 * retry + exponential backoff, rate limiting, /configuration-driven image
 * config, region+language injection. Lives ONLY in main; renderer never
 * talks to TMDB directly in desktop mode.
 */
const ALLOWED_PATH = /^\/(configuration|genre\/(movie|tv)\/list|search\/(movie|tv|person|multi)|discover\/(movie|tv)|movie\/\d+(\/(credits|videos|images|recommendations|similar|watch\/providers|external_ids|release_dates|reviews|lists|changes|keywords))?|tv\/\d+(\/(credits|videos|images|recommendations|similar|watch\/providers|external_ids|content_ratings|keywords|reviews|changes|alternative_titles|episode_groups))?|tv\/\d+\/season\/\d+(\/(episode\/\d+|changes|videos|credits))?|person\/\d+(\/(combined_credits|movie_credits|tv_credits|external_ids|images|tagged_images))?|collection\/\d+(\/images)?|company\/\d+|network\/\d+|trending\/(all|movie|tv|person)\/(day|week))$/;

const CATEGORIES = {
  configuration: { ttl: 24 * 3600e3 },
  genres: { ttl: 24 * 3600e3 },
  search: { ttl: 3600e3 },
  trending: { ttl: 3600e3 },
  discover: { ttl: 2 * 3600e3 },
  movie: { ttl: 6 * 3600e3 },
  tv: { ttl: 6 * 3600e3 },
  season: { ttl: 12 * 3600e3 },
  episode: { ttl: 12 * 3600e3 },
  person: { ttl: 12 * 3600e3 },
  credits: { ttl: 12 * 3600e3 },
  videos: { ttl: 6 * 3600e3 },
  images: { ttl: 24 * 3600e3 },
  recommendations: { ttl: 6 * 3600e3 },
  similar: { ttl: 6 * 3600e3 },
  providers: { ttl: 12 * 3600e3 },
  collection: { ttl: 12 * 3600e3 },
  company: { ttl: 24 * 3600e3 },
};

function categoryFor(path) {
  if (path.startsWith('/configuration')) return 'configuration';
  if (path.startsWith('/genre')) return 'genres';
  if (path.startsWith('/search')) return 'search';
  if (path.startsWith('/trending')) return 'trending';
  if (path.startsWith('/discover')) return 'discover';
  if (/^\/tv\/\d+\/season\/\d+\/episode\//.test(path)) return 'episode';
  if (/^\/tv\/\d+\/season\//.test(path)) return 'season';
  if (path.startsWith('/movie')) return 'movie';
  if (path.startsWith('/tv')) return 'tv';
  if (path.startsWith('/person')) return 'person';
  if (path.endsWith('/credits')) return 'credits';
  if (path.endsWith('/videos')) return 'videos';
  if (path.endsWith('/images')) return 'images';
  if (path.endsWith('/recommendations')) return 'recommendations';
  if (path.endsWith('/similar')) return 'similar';
  if (path.includes('/watch/providers')) return 'providers';
  if (path.startsWith('/collection')) return 'collection';
  if (path.startsWith('/company') || path.startsWith('/network')) return 'company';
  return 'misc';
}

class RateQueue {
  constructor(rps = 30) {
    this.minInterval = 1000 / rps;
    this.last = 0;
    this.chain = Promise.resolve();
  }
  add(fn) {
    const run = async () => {
      const wait = this.last + this.minInterval - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      this.last = Date.now();
      return fn();
    };
    this.chain = this.chain.then(run, run);
    return this.chain;
  }
}

export class TMDBService {
  /**
   * @param {{db: import('../db/DatabaseService.js').DatabaseService, settings: any, log: any, events?: any, fetchImpl?: Function}} deps
   */
  constructor({ db, settings, log, events, fetchImpl }) {
    this.db = db;
    this.settings = settings;
    this.log = log;
    this.events = events;
    this.fetch = fetchImpl || globalThis.fetch;
    this.baseUrl = 'https://api.themoviedb.org/3';
    this.inflight = new Map();
    this.queue = new RateQueue(30);
    this.stats = { requests: 0, cacheHits: 0, staleHits: 0, errors: 0, retries: 0, lastOkAt: null, lastError: null };
    this.imageConfig = null;
    events?.on('settings:changed', (e) => {
      if (e.key === 'tmdbApiKey' || e.key === 'region' || e.key === 'language') this._loadedConfig = false;
    });
  }

  get apiKey() {
    return this.settings.get('tmdbApiKey') || '';
  }

  get region() { return this.settings.get('region') || 'SA'; }
  get language() { return this.settings.get('language') || 'ar-SA'; }
  get ttlScale() { return Number(this.settings.get('cacheTtlScale')) || 1; }

  _cacheGet(key) {
    const row = this.db.get('SELECT payload, fetched_at, ttl_ms, category FROM tmdb_cache WHERE key=?', [key]);
    if (!row) return null;
    const age = Date.now() - row.fetched_at;
    return { payload: JSON.parse(row.payload), age, ttl: row.ttl_ms, fresh: age < row.ttl_ms, category: row.category };
  }

  _cacheSet(key, category, payload, ttl) {
    this.db.run(
      `INSERT INTO tmdb_cache (key, category, payload, fetched_at, ttl_ms, hits)
       VALUES (?,?,?,?,?,0)
       ON CONFLICT(key) DO UPDATE SET payload=excluded.payload, fetched_at=excluded.fetched_at, ttl_ms=excluded.ttl_ms, category=excluded.category`,
      [key, category, JSON.stringify(payload), Date.now(), ttl]
    );
  }

  _cacheTouch(key) {
    this.db.run('UPDATE tmdb_cache SET hits = hits + 1 WHERE key=?', [key]);
  }

  cacheStats() {
    const g = this.db.get(
      `SELECT COUNT(*) AS n, COALESCE(SUM(LENGTH(payload)),0) AS bytes FROM tmdb_cache`
    );
    return { entries: g.n, bytes: g.bytes, ...this.stats };
  }

  clearCache(category = null) {
    if (category && CATEGORIES[category]) {
      return this.db.run('DELETE FROM tmdb_cache WHERE category=?', [category]).changes;
    }
    return this.db.run('DELETE FROM tmdb_cache').changes;
  }

  /**
   * Central request funnel: cache -> (stale -> background refresh) -> network.
   * @param {string} pathname e.g. "/movie/155"
   * @param {Record<string,string|number|boolean|undefined>} [params]
   * @param {{force?:boolean, language?:string}} [opts]
   */
  async request(pathname, params = {}, opts = {}) {
    if (typeof pathname !== 'string' || !ALLOWED_PATH.test(pathname.split('?')[0])) {
      throw new Error('E_IPC_PATH_NOT_ALLOWED');
    }
    const category = categoryFor(pathname);
    const ttl = (CATEGORIES[category]?.ttl || 6 * 3600e3) * this.ttlScale;
    const merged = {
      language: opts.language || this.language,
      include_adult: 'false',
      ...params,
    };
    if (['discover', 'providers'].includes(category) && !merged.watch_region && !merged.region) {
      merged.watch_region = this.region;
    }
    if (pathname.endsWith('/watch/providers') && !merged.watch_region) merged.watch_region = this.region;
    if (pathname.startsWith('/discover') && !merged.region && category === 'movie') merged.region = undefined;

    const key = `${pathname}?${new URLSearchParams(
      Object.fromEntries(Object.entries(merged).filter(([, v]) => v !== undefined && v !== ''))
    ).toString()}`;

    if (!opts.force) {
      const hit = this._cacheGet(key);
      if (hit) {
        this._cacheTouch(key);
        if (hit.fresh) {
          this.stats.cacheHits++;
          return hit.payload;
        }
        // stale-while-revalidate: return now, refresh in background
        this.stats.staleHits++;
        this._refresh(pathname, merged, key, category, ttl).catch(() => {});
        return hit.payload;
      }
    }

    if (this.inflight.has(key)) return this.inflight.get(key);
    const p = this._refresh(pathname, merged, key, category, ttl).finally(() => this.inflight.delete(key));
    this.inflight.set(key, p);
    return p;
  }

  async _refresh(pathname, params, key, category, ttl) {
    if (!this.apiKey) throw new Error('E_TMDB_NO_KEY');
    const url = new URL(this.baseUrl + pathname);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }
    url.searchParams.set('api_key', this.apiKey);

    let attempt = 0;
    let lastErr = null;
    while (attempt < 3) {
      try {
        const res = await this.queue.add(() =>
          this.fetch(url.toString(), { signal: AbortSignal.timeout(12000) })
        );
        if (res.status === 429 || res.status >= 500) {
          const retryAfter = Number(res.headers.get('retry-after')) || 0;
          const back = Math.max(retryAfter * 1000, 500 * 2 ** attempt);
          this.stats.retries++;
          this.log.warn('tmdb', `HTTP ${res.status} — retry ${attempt + 1} in ${back}ms`);
          await new Promise((r) => setTimeout(r, back));
          attempt++;
          continue;
        }
        if (!res.ok) {
          const err = new Error(`E_TMDB_HTTP_${res.status}`);
          err.status = res.status;
          throw err;
        }
        const json = await res.json();
        if (json && (json.success === false || json.status_code && json.status_message)) {
          throw new Error(`E_TMDB_API_${json.status_code || 'ERR'}`);
        }
        this.stats.requests++;
        this.stats.lastOkAt = Date.now();
        // keep last known good copy as meta for offline fallbacks
        this.db.run(
          'INSERT OR REPLACE INTO tmdb_meta (key,value) VALUES (?,?)',
          [`last:${key}`, JSON.stringify(json)]
        );
        this._cacheSet(key, category, json, ttl);
        this._prune();
        return json;
      } catch (e) {
        lastErr = e;
        if (String(e.message).startsWith('E_TMDB_HTTP_') || String(e.message).startsWith('E_TMDB_API')) break;
        attempt++;
        if (attempt < 3) await new Promise((r) => setTimeout(r, 300 * 2 ** attempt));
      }
    }
    this.stats.errors++;
    this.stats.lastError = `${lastErr?.message || lastErr}`;
    // offline fallback: serve stale data if available
    const fallback = this.db.get('SELECT value FROM tmdb_meta WHERE key=?', [`last:${key}`]);
    const hit = this._cacheGet(key);
    const stale = fallback ? JSON.parse(fallback.value) : (hit ? hit.payload : null);
    if (stale) {
      this.log.warn('tmdb', `network failed — serving cached copy for ${pathname}`);
      return stale;
    }
    throw new Error('E_TMDB_UNAVAILABLE');
  }

  _prune() {
    // bound cache growth: keep newest 5000 rows
    this.db.run(
      `DELETE FROM tmdb_cache WHERE key IN (
         SELECT key FROM tmdb_cache ORDER BY fetched_at DESC LIMIT -1 OFFSET 5000)`
    );
  }

  async getImageConfig() {
    if (this.imageConfig) return this.imageConfig;
    try {
      const cfg = await this.request('/configuration');
      this.imageConfig = {
        baseUrl: cfg.images?.secure_base_url || 'https://image.tmdb.org/t/p/',
        posterSizes: cfg.images?.poster_sizes || ['w92','w154','w185','w342','w500','w780','original'],
        backdropSizes: cfg.images?.backdrop_sizes || ['w300','w780','w1280','original'],
        profileSizes: cfg.images?.profile_sizes || ['w45','w185','h632','original'],
        logoSizes: cfg.images?.logo_sizes || ['w45','w92','w154','w185','w300','w500','original'],
        stillSizes: cfg.images?.still_sizes || ['w92','w185','w300','original'],
        changeKey: cfg.change_key,
      };
      this.db.run('INSERT OR REPLACE INTO tmdb_meta (key,value) VALUES (?,?)',
        ['imageConfig', JSON.stringify(this.imageConfig)]);
    } catch {
      const row = this.db.get('SELECT value FROM tmdb_meta WHERE key=?', ['imageConfig']);
      this.imageConfig = row ? JSON.parse(row.value) : {
        baseUrl: 'https://image.tmdb.org/t/p/',
        posterSizes: ['w92','w154','w185','w342','w500','w780','original'],
        backdropSizes: ['w300','w780','w1280','original'],
        profileSizes: ['w45','w185','h632','original'],
        logoSizes: ['w45','w92','w154','w185','w300','w500','original'],
        stillSizes: ['w92','w185','w300','original'],
      };
    }
    return this.imageConfig;
  }

  // ---------- convenience mirrors of the renderer TMDBClient API ----------
  trending(mediaType = 'all', timeWindow = 'day', page = 1) {
    return this.request(`/trending/${['all','movie','tv','person'].includes(mediaType) ? mediaType : 'all'}/${['day','week'].includes(timeWindow) ? timeWindow : 'day'}`, { page });
  }
  search(type, query, page = 1) {
    const t = ['movie', 'tv', 'person', 'multi'].includes(type) ? type : 'multi';
    return this.request(`/search/${t}`, { query, page, include_language: undefined });
  }
  discover(type, params = {}) {
    const t = type === 'tv' ? 'tv' : 'movie';
    return this.request(`/discover/${t}`, params);
  }
  details(type, id, append) {
    const t = ['movie', 'tv'].includes(type) ? type : 'movie';
    const idn = Number(id);
    if (!Number.isInteger(idn) || idn <= 0) throw new Error('E_INVALID_ID');
    return this.request(`/${t}/${idn}`, append_to(append));
  }
  credits(type, id) {
    const t = ['movie', 'tv'].includes(type) ? type : 'movie';
    const idn = Number(id);
    if (!Number.isInteger(idn)) throw new Error('E_INVALID_ID');
    return this.request(`/${t}/${idn}/credits`);
  }
  videos(type, id) {
    const t = ['movie', 'tv'].includes(type) ? type : 'movie';
    const idn = Number(id);
    if (!Number.isInteger(idn)) throw new Error('E_INVALID_ID');
    return this.request(`/${t}/${idn}/videos`);
  }
  images(type, id) {
    const t = ['movie', 'tv', 'person'].includes(type) ? type : 'movie';
    const idn = Number(id);
    if (!Number.isInteger(idn)) throw new Error('E_INVALID_ID');
    return this.request(`/${t}/${idn}/images`);
  }
  recommendations(type, id, page = 1) {
    const t = ['movie', 'tv'].includes(type) ? type : 'movie';
    const idn = Number(id);
    if (!Number.isInteger(idn)) throw new Error('E_INVALID_ID');
    return this.request(`/${t}/${idn}/recommendations`, { page });
  }
  similar(type, id, page = 1) {
    const t = ['movie', 'tv'].includes(type) ? type : 'movie';
    const idn = Number(id);
    if (!Number.isInteger(idn)) throw new Error('E_INVALID_ID');
    return this.request(`/${t}/${idn}/similar`, { page });
  }
  watchProviders(type, id) {
    const t = ['movie', 'tv'].includes(type) ? type : 'movie';
    const idn = Number(id);
    if (!Number.isInteger(idn)) throw new Error('E_INVALID_ID');
    return this.request(`/${t}/${idn}/watch/providers`, { watch_region: this.region });
  }
  collection(id) {
    const idn = Number(id);
    if (!Number.isInteger(idn)) throw new Error('E_INVALID_ID');
    return this.request(`/collection/${idn}`, appendTo('images'));
  }
  season(tvId, seasonNo) {
    const idn = Number(tvId);
    const s = Number(seasonNo);
    if (!Number.isInteger(idn) || !Number.isInteger(s)) throw new Error('E_INVALID_ID');
    return this.request(`/tv/${idn}/season/${s}`);
  }
  episode(tvId, seasonNo, epNo) {
    const idn = Number(tvId); const s = Number(seasonNo); const e = Number(epNo);
    if (![idn, s, e].every(Number.isInteger)) throw new Error('E_INVALID_ID');
    return this.request(`/tv/${idn}/season/${s}/episode/${e}`);
  }
  person(id, append) {
    const idn = Number(id);
    if (!Number.isInteger(idn)) throw new Error('E_INVALID_ID');
    return this.request(`/person/${idn}`, append_to(append));
  }
  genres(type = 'movie') {
    return this.request(`/genre/${type === 'tv' ? 'tv' : 'movie'}/list`);
  }

  status() {
    return {
      configured: !!this.apiKey,
      lastOkAt: this.stats.lastOkAt,
      lastError: this.stats.lastError,
      ...this.cacheStats(),
    };
  }
}

function append_to(append) {
  return append ? { append_to_response: append } : {};
}
function appendTo(append) {
  return { append_to_response: append };
}
