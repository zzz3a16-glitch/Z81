/**
 * RecommendationService — genuinely local, data-driven (spec 74/76).
 * Builds a taste profile from favorites + history + ratings + behavior
 * events, then scores the USER'S OWN library by shared genres / people /
 * studios / era. Falls back to cached TMDB recommendations only when the
 * library is too small. Never invents content; empty input -> empty output.
 */
import { normalizeTitle } from './FileNameParser.js';

const WEIGHTS = { genre: 3, director: 5, actor: 1.5, studio: 2, year: 1, rating: 2 };

export class RecommendationService {
  constructor({ store, db, tmdb, settings }) {
    this.store = store;
    this.db = db;
    this.tmdb = tmdb;
    this.settings = settings;
  }

  tasteProfile({ days = 180 } = {}) {
    const since = Date.now() - days * 86400e3;
    const weights = new Map();
    const bump = (bucket, key, w) => {
      if (!key) return;
      const k = `${bucket}:${key}`;
      weights.set(k, (weights.get(k) || 0) + w);
    };
    const signal = (w, type) => w * ({ OPENED: 0.5, STARTED: 1, COMPLETED: 2, REWATCHED: 1.5, FAVORITED: 2, WATCH_LATER: 1, RATED: 2 }[type] ?? 1);

    const collect = (work, w) => {
      for (const g of work.genres || []) bump('genre', typeof g === 'string' ? g : g.name, w);
      for (const c of work.crew?.filter?.((x) => x.job === 'Director') || []) bump('director', c.name, w * WEIGHTS.director / 3);
      for (const c of (work.cast || work.credit_cast || []).slice(0, 8)) bump('actor', c.name, w * WEIGHTS.actor / 2);
      for (const p of work.production_companies || []) bump('studio', p.name, w * WEIGHTS.studio / 2);
      const y = Number(work.year || String(work.release_date || work.first_air_date || '').slice(0, 4));
      if (y) bump('era', `d${Math.floor(y / 10) * 10}`, w * WEIGHTS.year);
    };

    for (const f of this.store.getAll('favorites')) {
      const work = this.store.get(f.mediaType === 'tv' ? 'tvshows' : 'movies', f.id) || f;
      collect(work, signal(WEIGHTS.rating, 'FAVORITED'));
    }
    for (const h of this.store.getAll('watchHistory')) {
      if ((h.watchedAt || 0) < since) continue;
      const work = this.store.get(h.mediaType === 'tv' ? 'tvshows' : 'movies', h.mediaId) || h;
      collect(work, signal(1, h.event || 'OPENED'));
    }
    for (const r of this.store.getAll('ratings')) {
      const work = this.store.get('movies', r.mediaId) || this.store.get('tvshows', r.mediaId);
      if (work && r.rating >= 7) collect(work, WEIGHTS.rating);
    }
    return [...weights.entries()]
      .map(([k, v]) => ({ feature: k, weight: v }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 60);
  }

  /** Score in-library works the user hasn't watched (primary, works offline). */
  local({ limit = 24 } = {}) {
    const taste = this.tasteProfile();
    if (!taste.length) return { items: [], basis: 'no-signal' };
    const watched = new Set(this.store.getAll('watchHistory').map((h) => String(h.mediaId)));
    const scored = [];
    const featureSet = (work) => {
      const s = new Set();
      for (const g of work.genres || []) s.add(`genre:${typeof g === 'string' ? g : g.name}`);
      for (const c of work.cast || []) s.add(`actor:${c.name}`);
      for (const c of work.crew || []) if (c.job === 'Director') s.add(`director:${c.name}`);
      for (const p of work.production_companies || []) s.add(`studio:${p.name}`);
      const y = Number(work.year || String(work.release_date || '').slice(0, 4));
      if (y) s.add(`era:d${Math.floor(y / 10) * 10}`);
      return s;
    };
    for (const store of ['movies', 'tvshows']) {
      for (const w of this.store.getAll(store)) {
        if (watched.has(String(w.id))) continue;
        const feats = featureSet(w);
        let score = 0;
        const reasons = [];
        for (const { feature, weight } of taste) {
          if (feats.has(feature)) {
            score += weight;
            const [, val] = feature.split(':');
            if (reasons.length < 3) reasons.push(labelFor(feature, val));
          }
        }
        if (score > 0) scored.push({ ...w, _store: store, _score: Math.round(score), reasons });
      }
    }
    scored.sort((a, b) => b._score - a._score);
    return { items: scored.slice(0, Number(limit) || 24), basis: 'library' };
  }

  /** For a specific work: shared-features neighbours from the library first,
   *  then (online only) cached TMDB recommendations. Honest labels either way. */
  forWork({ store = 'movies', key, limit = 20 }) {
    const work = this.store.get(store, String(key));
    if (!work) return { items: [], basis: 'missing' };
    const feats = new Set([
      ...(work.genres || []).map((g) => (typeof g === 'string' ? g : g.name)),
      ...(work.crew || []).filter((c) => c.job === 'Director').map((c) => c.name),
      ...(work.cast || []).slice(0, 10).map((c) => c.name),
    ]);
    const neighbours = [];
    for (const s of ['movies', 'tvshows']) {
      for (const w of this.store.getAll(s)) {
        if (String(w.id) === String(key)) continue;
        let n = 0;
        const shared = [];
        for (const g of w.genres || []) {
          const name = typeof g === 'string' ? g : g.name;
          if (feats.has(name)) { n += 3; shared.push(name); }
        }
        for (const c of (w.cast || []).slice(0, 10)) {
          if (feats.has(c.name)) { n += 1.5; if (shared.length < 4) shared.push(c.name); }
        }
        if (n > 0) neighbours.push({ ...w, _score: Math.round(n), reasons: shared.slice(0, 3) });
      }
    }
    neighbours.sort((a, b) => b._score - a._score);
    if (neighbours.length >= Math.min(8, limit)) {
      return { items: neighbours.slice(0, limit), basis: 'library' };
    }
    return { items: neighbours, basis: 'library-partial', tmdbWork: work.id && !String(work.id).startsWith('local-') ? Number(work.id) : null };
  }

  async fromTmdb({ type = 'movie', id, limit = 20 }) {
    const idn = Number(id);
    if (!Number.isInteger(idn)) return { items: [], basis: 'invalid' };
    try {
      const res = await this.tmdb.recommendations(type, idn, 1);
      const normSeen = new Set();
      const items = (res.results || []).filter((r) => {
        const k = normalizeTitle(r.title || r.name || '');
        if (!k || normSeen.has(k)) return false;
        normSeen.add(k);
        return true;
      }).slice(0, limit);
      return { items, basis: 'tmdb' };
    } catch {
      return { items: [], basis: 'offline' };
    }
  }
}

function labelFor(feature, val) {
  const bucket = feature.split(':')[0];
  switch (bucket) {
    case 'genre': return `يعجبك تصنيف ${val}`;
    case 'director': return `من إخراج ${val}`;
    case 'actor': return `من بطولة ${val}`;
    case 'studio': return `من إنتاج ${val}`;
    case 'era': {
      const d = String(val || '').replace(/^d/, '');
      return d ? `من حقبة ${d}م` : null;
    }
    default: return null;
  }
}
