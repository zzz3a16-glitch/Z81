/**
 * Favorites, Watch Later / Collections, Watch History, Ratings & behavior
 * events — thin domain services over the same doc_store tables so every
 * renderer surface and the desktop services share ONE source of truth
 * (spec 34/35/36/37/38; avoids duplicated representations).
 */
export class FavoritesService {
  constructor({ store, events }) { this.store = store; this.events = events; }

  list({ mediaType = null } = {}) {
    const all = mediaType
      ? this.store.getByIndex('favorites', 'mediaType', mediaType)
      : this.store.getAll('favorites');
    return all.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
  }

  has({ id, mediaType = 'movie' }) {
    const f = this.store.get('favorites', String(id));
    return !!(f && (!f.mediaType || f.mediaType === mediaType));
  }

  add(item) {
    if (!item || item.id === undefined || item.id === null) throw new Error('E_INVALID_ITEM');
    const rec = {
      id: String(item.id),
      mediaId: String(item.id),
      mediaType: item.mediaType || item.media_type || 'movie',
      title: item.title || item.name || null,
      poster_path: item.poster_path || null,
      year: item.year || null,
      addedAt: Date.now(),
    };
    this.store.put('favorites', rec);
    this.events?.emit('library:changed', { op: 'favorite', id: rec.id });
    return rec;
  }

  remove(id) {
    const r = this.store.delete('favorites', String(id));
    this.events?.emit('library:changed', { op: 'unfavorite', id: String(id) });
    return r;
  }

  toggle(item) {
    const id = String(item.id);
    if (this.store.get('favorites', id)) { this.remove(id); return { favorited: false }; }
    this.add(item);
    return { favorited: true };
  }
}

export class HistoryService {
  constructor({ store, events, db }) { this.store = store; this.events = events; this.db = db; }

  /** Record a meaningful activity event — aggregated, never per-keystroke (spec 36). */
  record({ type = 'OPENED', mediaId, mediaType = 'movie', title = null, payload = {} }) {
    const rec = {
      id: `${mediaId}:${Date.now()}`,
      mediaId: String(mediaId),
      mediaType, title,
      event: type,
      ...payload,
      watchedAt: Date.now(),
    };
    this.store.put('watchHistory', rec);
    this.db.run('INSERT INTO events (type, subject, payload, ts) VALUES (?,?,?,?)',
      [type, `${mediaType}:${mediaId}`, JSON.stringify(payload || {}), Date.now()]);
    return rec;
  }

  list({ limit = 200, mediaType = null } = {}) {
    let rows = this.store.getAll('watchHistory');
    if (mediaType) rows = rows.filter((r) => r.mediaType === mediaType);
    return rows.sort((a, b) => (b.watchedAt || 0) - (a.watchedAt || 0)).slice(0, Number(limit) || 200);
  }

  clear() {
    return this.store.clear('watchHistory');
  }

  setProgress({ mediaId, mediaType = 'movie', position = 0, duration = 0, completed = null }) {
    const id = String(mediaId);
    const prev = this.store.get('watchProgress', id);
    const total = duration || prev?.duration || 0;
    const done = completed !== null ? !!completed : (total > 0 && position >= total - 60);
    const rec = {
      mediaId: id,
      mediaType,
      position: Math.max(0, Number(position) || 0),
      duration: Number(total) || 0,
      completed: done,
      title: prev?.title || null,
      poster_path: prev?.poster_path || null,
      updatedAt: Date.now(),
    };
    this.store.put('watchProgress', rec);
    if (done) {
      this.record({ type: 'COMPLETED', mediaId: id, mediaType, title: rec.title });
    }
    return rec;
  }

  getProgress(mediaId) {
    return this.store.get('watchProgress', String(mediaId));
  }

  continueWatching({ limit = 20 } = {}) {
    return this.store.getAll('watchProgress')
      .filter((p) => !p.completed && p.position > 30 && Date.now() - (p.updatedAt || 0) < 60 * 86400e3)
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .slice(0, Number(limit) || 20);
  }

  stats() {
    const byType = {};
    for (const r of this.db.all('SELECT type, COUNT(*) n FROM events GROUP BY type')) byType[r.type] = r.n;
    return { history: this.store.count('watchHistory'), progress: this.store.count('watchProgress'), byType };
  }
}

export class CollectionsService {
  constructor({ store, db, events }) { this.store = store; this.db = db; this.events = events; }

  list() {
    const lists = this.store.getAll('watchlists');
    return lists.map((l) => ({
      ...l,
      count: this.store.getByIndex('watchlistItems', 'listId', l.id).length,
    }));
  }

  create({ name, description = '', smart = false, rules = null }) {
    if (!name || !String(name).trim()) throw new Error('E_INVALID_NAME');
    const id = `list-${Date.now().toString(36)}`;
    const rec = { id, name: String(name).trim(), description, smart: !!smart, rules: rules || null, createdAt: Date.now() };
    this.store.put('watchlists', rec);
    return rec;
  }

  update(id, patch) {
    const cur = this.store.get('watchlists', String(id));
    if (!cur) throw new Error('E_NOT_FOUND');
    const next = { ...cur, ...patch, id: cur.id };
    this.store.put('watchlists', next);
    return next;
  }

  remove(id) {
    const items = this.store.getByIndex('watchlistItems', 'listId', String(id));
    for (const it of items) this.store.delete('watchlistItems', it.id);
    return this.store.delete('watchlists', String(id));
  }

  items(collectionId, { sort = 'addedAt' } = {}) {
    const rows = this.store.getByIndex('watchlistItems', 'listId', String(collectionId));
    if (sort === 'title') return rows.sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'ar'));
    if (sort === 'title-asc') return rows.sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'ar'));
    return rows.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
  }

  addItem(collectionId, media) {
    const id = String(collectionId);
    if (!this.store.get('watchlists', id)) throw new Error('E_LIST_NOT_FOUND');
    const mediaKey = `${media.mediaType || media.media_type || 'movie'}:${media.id}`;
    const itemId = `${id}::${mediaKey}`;
    const rec = {
      id: itemId, listId: id, mediaKey,
      mediaId: media.id, mediaType: media.mediaType || media.media_type || 'movie',
      title: media.title || media.name || null,
      poster_path: media.poster_path || null,
      year: media.year || null,
      addedAt: Date.now(),
    };
    this.store.put('watchlistItems', rec);
    return rec;
  }

  removeItem(collectionId, mediaKey) {
    return this.store.delete('watchlistItems', `${String(collectionId)}::${mediaKey}`);
  }

  /**
   * Smart collection rules (spec 38): AND of simple predicates evaluated
   * against library works. Updated automatically by callers on library change.
   * rule: {field: 'genre'|'year'|'rating'|'type'|'watched'|'favorite'|'studio'|'language'|'country'|'tag',
   *        op: '='|'!='|'>='|'<='|'in'|'contains', value}
   */
  evaluateRules({ rules = [], store: storeFilter = 'any', limit = 200 }) {
    const works = [];
    for (const s of ['movies', 'tvshows']) {
      if (storeFilter !== 'any' && storeFilter !== s) continue;
      for (const w of this.store.getAll(s)) works.push({ ...w, _store: s });
    }
    const watched = new Set(this.store.getAll('watchHistory').map((h) => String(h.mediaId)));
    const favs = new Set(this.store.getAll('favorites').map((f) => String(f.id)));
    const out = [];
    for (const w of works) {
      if (!rules.length) continue;
      const ok = rules.every((r) => matchRule(w, r, { watched, favs }));
      if (ok) { out.push(w); if (out.length >= (Number(limit) || 200)) break; }
    }
    return out;
  }
}

function matchRule(w, r, { watched, favs }) {
  const { field, op = '=', value } = r || {};
  let actual;
  switch (field) {
    case 'genre':
      actual = (w.genres || []).map((g) => (typeof g === 'string' ? g : g.name)).join('|');
      return containsLoose(actual, String(value || ''));
    case 'year': actual = Number(w.year || String(w.release_date || w.first_air_date || '').slice(0, 4) || 0); break;
    case 'rating': actual = Number(w.vote_average || w.userRating || 0); break;
    case 'type': actual = w.media_type || (w._store === 'movies' ? 'movie' : 'tv'); break;
    case 'watched': actual = watched.has(String(w.id)); return op === '=' ? actual === truthy(value) : actual !== truthy(value);
    case 'favorite': actual = favs.has(String(w.id)); return op === '=' ? actual === truthy(value) : actual !== truthy(value);
    case 'studio':
      actual = (w.production_companies || []).map((c) => c.name || c).join('|');
      return containsLoose(actual, String(value || ''));
    case 'language': actual = w.original_language || ''; return op === 'contains' ? String(actual).includes(value) : String(actual) === value;
    case 'country':
      actual = (w.production_countries || []).join('|');
      return containsLoose(actual, String(value || ''));
    case 'tag':
      actual = (w.tags || []).join('|');
      return containsLoose(actual, String(value || ''));
    default: return false;
  }
  const v = Number(value);
  switch (op) {
    case '>=': return actual >= v;
    case '<=': return actual <= v;
    case '>': return actual > v;
    case '<': return actual < v;
    case '!=': return actual !== v;
    case 'in': return Array.isArray(value) && value.includes(actual);
    default: return actual === v;
  }
}
const truthy = (v) => v === true || v === 'true' || v === 1 || v === '1';
function containsLoose(hay, needle) {
  if (!hay || !needle) return false;
  return String(hay).toLowerCase().includes(String(needle).toLowerCase());
}
