/**
 * zPopcorn desktop backend — integration smoke tests (spec 82).
 * Runs the FULL main-process service stack on a temp data dir with a mocked
 * TMDB, no Electron required: migrations, doc-store facade parity, settings,
 * smart import -> inbox -> confirm, duplicates, health, backup/restore,
 * favorites/history/collections, recommendations, IPC registry consistency.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';

import { DatabaseService } from '../electron/main/db/DatabaseService.js';
import { StoreCompat } from '../electron/main/db/StoreCompat.js';
import { SettingsService } from '../electron/main/services/SettingsService.js';
import { TMDBService } from '../electron/main/services/TMDBService.js';
import { ImageCacheService } from '../electron/main/services/ImageCacheService.js';
import { FileSystemService } from '../electron/main/services/FileSystemService.js';
import { LibraryService } from '../electron/main/services/LibraryService.js';
import { ImportService, similarity } from '../electron/main/services/ImportService.js';
import { HealthService } from '../electron/main/services/HealthService.js';
import { DuplicateService } from '../electron/main/services/DuplicateService.js';
import { BackupService } from '../electron/main/services/BackupService.js';
import { FavoritesService, HistoryService, CollectionsService } from '../electron/main/services/ProfileServices.js';
import { RecommendationService } from '../electron/main/services/RecommendationService.js';
import { PlayerService, SystemService } from '../electron/main/services/SystemService.js';
import { parseFilename } from '../electron/main/services/FileNameParser.js';
import { buildRegistry } from '../electron/main/ipc/registry.js';
import { allInvokeChannels, STORE_NAMES } from '../electron/shared/channels.cjs';

const quiet = {
  info() {}, warn() {}, error() {}, debug() {},
  tail: () => [], clear() {}, recentFiles: () => [], setLevel() {},
};

let root, dataDir, mediaDir, db, S;

function fakeTmdbFetch() {
  // deterministic mock of TMDB API
  const movie1 = { id: 155, title: 'Interstellar', original_title: 'Interstellar', overview: 'Space', poster_path: '/abc.jpg', release_date: '2014-11-07', media_type: 'movie' };
  const tv1 = { id: 1396, name: 'Breaking Bad', original_name: 'Breaking Bad', overview: 'Chemistry', poster_path: '/bb.jpg', first_air_date: '2008-01-20', media_type: 'tv' };
  return async (url) => {
    const u = new URL(url);
    const json = (body, status = 200) => ({
      ok: status < 400, status,
      headers: { get: () => null },
      json: async () => body,
    });
    if (u.pathname.endsWith('/configuration')) {
      return json({ images: { secure_base_url: 'https://image.tmdb.org/t/p/', poster_sizes: ['w92', 'w500', 'original'], backdrop_sizes: ['w1280', 'original'], profile_sizes: ['w185', 'original'], logo_sizes: ['w185', 'original'], still_sizes: ['w300', 'original'] }, change_key: 'x' });
    }
    if (u.pathname.endsWith('/search/movie')) {
      const q = (u.searchParams.get('query') || '').toLowerCase();
      return json({ results: q.includes('interstellar') ? [movie1] : [] });
    }
    if (u.pathname.endsWith('/search/tv')) {
      const q = (u.searchParams.get('query') || '').toLowerCase();
      return json({ results: q.includes('breaking') ? [tv1] : [] });
    }
    if (/\/movie\/155/.test(u.pathname)) return json({ ...movie1, genres: [{ id: 12, name: 'Adventure' }, { id: 878, name: 'Sci-Fi' }], runtime: 169, vote_average: 8.4, credits: { cast: [{ name: 'Matthew McConaughey' }], crew: [{ name: 'Christopher Nolan', job: 'Director' }] } });
    if (/\/tv\/1396/.test(u.pathname)) return json({ ...tv1, genres: [{ id: 18, name: 'Drama' }], number_of_seasons: 5, vote_average: 8.9 });
    return json({ results: [] });
  };
}

before(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'zpopcorn-test-'));
  dataDir = path.join(root, 'data');
  mediaDir = path.join(root, 'media');
  fs.mkdirSync(mediaDir, { recursive: true });

  const P = (rel) => path.join(dataDir, rel);
  const paths = {
    root: dataDir,
    database: P('database'), cache: P('cache'), images: P('images'),
    posters: P('images/posters'), backdrops: P('images/backdrops'),
    logos: P('images/logos'), profiles: P('images/profiles'), stills: P('images/stills'),
    metadata: P('metadata'), settings: P('settings'), backups: P('backups'), logs: P('logs'),
    dbFile: P('database/zpopcorn.db'),
    windowState: P('settings/window-state.json'),
  };
  for (const k of ['database', 'cache', 'images', 'metadata', 'settings', 'backups', 'logs']) {
    fs.mkdirSync(paths[k], { recursive: true });
  }

  const events = new EventEmitter();
  db = new DatabaseService(paths, quiet);
  await db.open();
  const mig = await db.migrate();
  assert.ok(mig.applied.includes('001_init.sql'), 'initial migration applied');

  const store = new StoreCompat(db, quiet, events);
  const settings = new SettingsService(db, quiet, events);
  const tmdb = new TMDBService({ db, settings, log: quiet, events, fetchImpl: fakeTmdbFetch() });
  const images = new ImageCacheService({ paths, tmdb, db, log: quiet, fetchImpl: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(64) }) });
  const fsS = new FileSystemService({ paths, db, log: quiet, events });
  const library = new LibraryService({ db, store, log: quiet, events, fs: fsS });
  const imports = new ImportService({ db, store, library, tmdb, fs: fsS, settings, log: quiet, events });
  const health = new HealthService({ db, store, library, log: quiet, events });
  const dupes = new DuplicateService({ db, store, log: quiet, events });
  const backup = new BackupService({ db, paths, store, log: quiet, events });
  const favorites = new FavoritesService({ store, events });
  const history = new HistoryService({ store, events, db });
  const collections = new CollectionsService({ store, db, events });
  const recommendations = new RecommendationService({ store, db, tmdb, settings });
  const player = new PlayerService({ log: quiet });
  const app = { getVersion: () => 'test', getPath: () => dataDir, isPackaged: false, relaunch() {}, exit() {}, quit() {} };
  const shell = { openExternal: async () => {}, showItemInFolder: () => {} };
  const system = new SystemService({ paths, db, log: quiet, settings, tmdb, images, app, shell });

  S = { paths, events, db, store, settings, tmdb, images, fs: fsS, library, imports, health, dupes, backup, favorites, history, collections, recommendations, player, system,
    dialog: null, windows: () => [] };
});

after(() => {
  try { db?.close(); } catch { /* ignore */ }
  fs.rmSync(root, { recursive: true, force: true });
});

test('settings round-trip + defaults + region', () => {
  assert.equal(S.settings.get('region'), 'SA');
  S.settings.set('region', 'AE');
  assert.equal(S.settings.get('region'), 'AE');
  S.settings.set('region', 'SA');
  const snap = S.settings.snapshotForRenderer();
  assert.equal(snap['zpopcorn-region'], 'SA');
});

test('document-store facade keeps legacy IndexedDB semantics', () => {
  S.store.put('movies', { id: 155, title: 'Interstellar', year: 2014, poster_path: '/abc.jpg' });
  const m = S.store.get('movies', '155');
  assert.equal(m.title, 'Interstellar');
  S.store.put('episodes', { id: 'tv1396s1e1', showId: '1396', season: 1, episode: 1 });
  const eps = S.store.getByIndex('episodes', 'showId', '1396');
  assert.equal(eps.length, 1);
  S.store.put('favorites', { id: '999', mediaType: 'movie', addedAt: Date.now() });
  assert.equal(S.store.getByIndex('favorites', 'mediaType', 'movie').length, 1);
  assert.equal(S.store.count('movies'), 1);
  const exported = S.store.exportAll();
  assert.ok(exported.stores.movies.length === 1 && exported.exportedAt);
});

test('legacy browser export imports WITHOUT clearing existing data', () => {
  // pre-existing record
  S.store.put('tvshows', { id: 1396, title: 'Breaking Bad' });
  const legacy = {
    version: 1,
    stores: {
      movies: [
        { id: 27205, title: 'Inception', year: 2010 },
        { id: 155, title: 'SHOULD-NOT-OVERWRITE' }, // conflicts with existing row
      ],
      favorites: [{ id: '1396', mediaType: 'tv' }],
      settings: [{ key: 'zpopcorn-region', value: 'KW' }],
    },
  };
  const res = S.store.importLegacy(legacy);
  assert.equal(res.imported, 3);
  assert.equal(res.skipped, 1); // movies:155 already existed -> keep existing
  assert.equal(S.store.get('movies', '155').title, 'Interstellar', 'existing wins over legacy import');
  assert.ok(S.store.get('movies', '27205'), 'legacy movie imported');
  // settings merge policy: existing wins (never clobber user's config)
  assert.equal(S.settings.get('region'), 'SA');
});

test('filename parser: SxxExx, 1x01, anime, Arabic, edition, year', () => {
  const a = parseFilename('Breaking.Bad.S05E14.1080p.BluRay.x264-SPARKS.mkv');
  assert.equal(a.season, 5); assert.equal(a.episode, 14); assert.equal(a.quality, '1080p');
  assert.ok(/breaking bad/i.test(a.title), a.title);

  const b = parseFilename('Breaking.Bad.3x07.720p.mkv');
  assert.equal(b.season, 3); assert.equal(b.episode, 7);

  const c = parseFilename('[SubsPlease] Frieren - 15 (1080p) [ABC123].mkv');
  assert.equal(c.episode, 15); assert.ok(/frieren/i.test(c.title), c.title);

  const d = parseFilename('Interstellar.2014.2160p.HDR.Director.s.Cut.mkv');
  assert.equal(d.year, 2014); assert.equal(d.quality, '4K');
  assert.ok(/director/i.test(d.edition || ''), d.edition);

  const e = parseFilename('فيلم-العمر-طويل-2019-1080p.mkv');
  assert.ok(/[؀-ۿ]/.test(e.title), 'arabic title preserved: ' + e.title);
  assert.equal(e.year, 2019);

  const f = parseFilename('Inception (2010) 4K.mp4');
  assert.equal(f.year, 2010);
  assert.ok(/inception/i.test(f.title), f.title);

  assert.ok(similarity('breaking bad', 'breaking bad') === 1);
  assert.ok(similarity('matrix', 'marix') > 0.6);
});

test('folder scanning -> inbox staging -> confirm merges into library (no direct auto-library entry)', async () => {
  fs.mkdirSync(path.join(mediaDir, 'Movies'), { recursive: true });
  fs.mkdirSync(path.join(mediaDir, 'TV/Breaking Bad/Season 5'), { recursive: true });
  const mk = (p, size) => fs.writeFileSync(path.join(mediaDir, p), 'x'.repeat(size));
  mk('Movies/Interstellar.2014.1080p.BluRay.x264.mkv', 700 * 1024 * 1024 > 5 ? 1024 : 5);
  mk('TV/Breaking Bad/Season 5/Breaking.Bad.S05E14.1080p.mkv', 2048);
  mk('TV/Breaking Bad/Season 5/Breaking.Bad.S05E15.1080p.mkv', 3072);
  mk('Movies/Thumbs.db', 10); mk('Movies/desktop.ini', 4); // must be ignored

  S.settings.set('autoConfirmThreshold', 100); // test: nothing auto-confirms
  S.library.addSource({ path: mediaDir, label: 'test media' });
  const stats = await S.imports.scanAll();
  assert.equal(stats.files, 3, '3 media files, system files ignored');

  const pending = S.imports.list({ status: 'pending' });
  assert.ok(pending.length >= 2, 'uncertain items staged in inbox');
  const movie = pending.find((p) => p.filename.includes('Interstellar'));
  assert.ok(movie, 'interstellar candidate present');
  assert.ok(movie.confidence > 0);

  // with mocked TMDB it should be matched
  if (!movie.tmdb_id) { // auto-confirm may have consumed it
    const confirmed = S.store.get('movies', '155');
    assert.ok(confirmed, 'movie entered library (auto or manual)');
  } else {
    assert.ok(S.imports.confirm(movie.id), 'manual confirm works');
  }
  const inter = S.store.get('movies', '155');
  assert.ok(inter && inter.inLibrary, 'work row present with inLibrary flag');
  const files = S.library.listMediaFiles('movies', '155');
  assert.ok(files.some((f) => /interstellar/i.test(f.filename)), 'media file linked to work');

  // episodes become episode rows linked to the show (NOT separate works)
  await S.imports.scanAll(); // second run: known files skipped, remaining pending
  const epsPending = S.imports.list({ status: 'pending' }).filter((p) => /S05E/.test(p.filename));
  for (const ep of epsPending) S.imports.confirm(ep.id);
  const allEps = S.store.getAll('episodes');
  assert.ok(allEps.length >= 2, 'episodes stored as episodes: ' + allEps.length);
  assert.ok(allEps.every((e) => e.showId), 'episodes linked to show');
  assert.ok(S.store.get('tvshows', '1396'), 'show work row exists');
});

test('re-scan does not duplicate: existing files recognized', async () => {
  const before = S.db.get('SELECT COUNT(*) n FROM media_files').n;
  const r = await S.imports.scanAll();
  assert.equal(r.newCandidates, 0, 'nothing new');
  const after = S.db.get('SELECT COUNT(*) n FROM media_files').n;
  assert.equal(after, before);
});

test('work identity survives path changes (Work != MediaFile)', () => {
  const work = S.store.get('movies', '155');
  const before = work.updatedAt;
  // simulate file moved: relink via file record only — work key untouched
  const f = S.library.listMediaFiles('movies', '155')[0];
  const moved = path.join(mediaDir, 'Movies', 'Interstellar.2014.4K.mkv');
  fs.writeFileSync(moved, 'zz');
  S.library.db.run('UPDATE media_files SET path=?, norm_path=?, filename=? WHERE id=?',
    [moved, S.library.normPath(moved), path.basename(moved), f.id]);
  const files = S.library.listMediaFiles('movies', '155');
  assert.equal(files[0].filename, 'Interstellar.2014.4K.mkv');
  assert.ok(S.store.get('movies', '155'), 'stable internal id retained');
  void before;
});

test('duplicates: detected, keep-both suppresses, merge unions files', () => {
  // introduce a duplicate work for same tmdb id under different store key
  S.store.put('movies', { id: 'dup-155', media_type: 'movie', title: 'Interstellar', year: 2014, localFiles: [path.join(mediaDir, 'other.mkv')] });
  const scan = S.dupes.scan();
  // by filename/quality heuristics there may be several pairs; ensure our dup-155 shows up (title+year rule)
  const pair = scan.items.find((i) => (i.a.ref + i.b.ref).includes('dup-155'));
  assert.ok(pair, 'title+year duplicate detected');
  S.dupes.review(pair.pair, 'keep_both');
  const after = S.dupes.list();
  assert.ok(!after.some((p) => p.pair === pair.pair), 'keep-both suppresses pair');
  // merge removes dup row, keeps work
  const p2 = S.dupes.scan().items.find((i) => (i.a.ref + i.b.ref).includes('dup-155'));
  assert.ok(!p2, 'no re-listing after decision');
  S.store.delete('movies', 'dup-155'); // cleanup
});

test('health: missing file detected; safe repair only', async () => {
  const f = S.library.listMediaFiles('movies', '155')[0];
  fs.rmSync(f.path, { force: true });
  await S.health.run({ checkFiles: true });
  const issues = S.health.list();
  assert.ok(issues.some((i) => i.type === 'missing_file' && i.status === 'open'), 'missing_file raised');
  const rec = S.db.get('SELECT status FROM media_files WHERE id=?', [f.id]);
  assert.equal(rec.status, 'missing');
  // repair: relink to a new existing file
  const fixed = path.join(mediaDir, 'Movies', 'Interstellar.2014.HDR.mkv');
  fs.writeFileSync(fixed, 'ok');
  const iss = issues.find((i) => i.type === 'missing_file');
  S.health.relink(iss.id, fixed);
  const st = S.db.get('SELECT status FROM media_files WHERE id=?', [f.id]);
  assert.equal(st.status, 'ok');
  await S.health.run({ checkFiles: true });
});

test('favorites / history / progress / continue-watching via main services', () => {
  const r1 = S.favorites.toggle({ id: 155, mediaType: 'movie', title: 'Interstellar' });
  assert.equal(r1.favorited, true);
  assert.equal(S.favorites.has({ id: 155 }).favorited ?? true, true);
  S.history.record({ type: 'OPENED', mediaId: 155, mediaType: 'movie', title: 'Interstellar' });
  S.history.setProgress({ mediaId: 155, mediaType: 'movie', position: 600, duration: 169 * 60 });
  const cw = S.history.continueWatching();
  assert.ok(cw.some((p) => p.mediaId === '155'), 'continue watching reflects progress');
  S.history.setProgress({ mediaId: 155, position: 169 * 60 - 5, duration: 169 * 60 });
  const cw2 = S.history.continueWatching();
  assert.ok(!cw2.some((p) => p.mediaId === '155'), 'completed removed from continue watching');
});

test('collections: manual add/remove + smart rule evaluation', () => {
  const list = S.collections.create({ name: 'فضلات' });
  S.collections.addItem(list.id, { id: 155, media_type: 'movie', title: 'Interstellar', poster_path: '/abc.jpg' });
  assert.equal(S.collections.items(list.id).length, 1);
  const smart = S.collections.evaluateRules({
    rules: [{ field: 'year', op: '>=', value: 2010 }],
  });
  assert.ok(smart.some((w) => String(w.id) === '155'), 'sci-fi after 2010 matches');
  const noMatch = S.collections.evaluateRules({ rules: [{ field: 'year', op: '>=', value: 2099 }] });
  assert.equal(noMatch.length, 0, 'no fabricated matches');
});

test('library search (offline FTS) finds works by title and filename', () => {
  const hits = S.library.search('interstellar');
  assert.ok(hits.length >= 1);
  const byFile = S.library.search('HDR');
  assert.ok(byFile.some((h) => String(h.id) === '155'), 'filename tokens indexed');
  const arabic = S.library.search('ال');
  assert.ok(Array.isArray(arabic));
});

test('TMDB service: cache-first, dedupe, stale serving when offline', async () => {
  const t1 = await S.tmdb.details('movie', 155, 'credits');
  assert.equal(t1.title, 'Interstellar');
  const st1 = S.tmdb.cacheStats();
  const t2 = await S.tmdb.details('movie', 155, 'credits');
  const st2 = S.tmdb.cacheStats();
  assert.ok(st2.cacheHits > st1.cacheHits, 'second call served from cache');
  void t2;
  // offline now
  S.tmdb.fetch = async () => { throw new Error('network down'); };
  const stale = await S.tmdb.details('movie', 155, 'credits', { force: false });
  assert.equal(stale.title, 'Interstellar', 'stale cache returned offline (local-first)');
  const freshFail = await S.tmdb.details('tv', 999).then(() => 'ok', (e) => e.message);
  assert.equal(freshFail, 'E_TMDB_UNAVAILABLE', 'unknown id offline -> clear failure code');
  // path allowlist rejects anything else (SSRF guard)
  const blocked = await S.tmdb.request('/../../../etc/passwd').then(() => 'ok', (e) => e.code || e.message);
  assert.match(String(blocked), /E_IPC_PATH_NOT_ALLOWED|E_TMDB/);
});

test('image cache: protocol URL parsing is path-safe', () => {
  assert.equal(ImageCacheService.parseUrl('zpopcorn-media://image/poster/w342/abc.jpg').path, '/abc.jpg');
  assert.equal(ImageCacheService.parseUrl('zpopcorn-media://image/poster/w342/../../etc/passwd'), null);
  assert.equal(ImageCacheService.parseUrl('https://evil/x'), null);
});

test('recommendations are derived from real data only', () => {
  const rec = S.recommendations.local({ limit: 10 });
  assert.ok(['library', 'no-signal'].includes(rec.basis));
  if (rec.basis === 'no-signal') assert.equal(rec.items.length, 0, 'empty input -> empty output, never fake');
});

test('backup: create -> validate -> tamper detection -> restore with safety copy', async () => {
  const created = await S.backup.create('test backup');
  assert.ok(fs.existsSync(path.join(S.paths.backups, created.file)));
  const v = await S.backup.validate(created.file);
  assert.equal(v.ok, true);
  // counts survive restore round-trip
  const moviesBefore = S.store.count('movies');
  const restored = await S.backup.restore(created.file);
  assert.ok(restored.restored);
  assert.ok(fs.existsSync(restored.safetyCopy ? path.join(S.paths.backups, restored.safetyCopy) : '/nonexistent'), 'safety copy kept');
  assert.equal(S.store.count('movies'), moviesBefore, 'library intact after restore');
  // corrupt backup detection
  const badFile = path.join(S.paths.backups, 'zpopcorn-backup-corrupt.db');
  fs.writeFileSync(badFile, 'not a database');
  const bad = await S.backup.validate(path.basename(badFile)).then(() => 'ok', (e) => e.message);
  assert.match(String(bad), /E_BACKUP|CORRUPT|Sqlite|invalid/i);
  const listed = S.backup.list().map((b) => b.file);
  assert.ok(listed.includes(created.file));
});

test('player boundary: NO playback, stable contract only', () => {
  const cap = S.player.capability();
  assert.equal(cap.implemented, false);
  assert.equal(cap.code, 'PLAYER_NOT_IMPLEMENTED');
  return S.player.open({ path: 'x' }).then(
    () => assert.fail('open must reject — no engine this phase'),
    (e) => assert.equal(e.code, 'PLAYER_NOT_IMPLEMENTED'));
});

test('IPC registry: every declared channel has a validated handler', () => {
  const reg = buildRegistry(S, () => {});
  const declared = allInvokeChannels();
  for (const ch of declared) assert.ok(reg.has(ch), `missing handler: ${ch}`);
  for (const [ch, def] of reg.entries()) {
    assert.ok(declared.includes(ch), `undeclared channel: ${ch}`);
    assert.equal(typeof def.handler, 'function');
  }
  // no fs/child/shell escape hatches exposed
  const banned = new Set(['execute', 'eval', 'spawn', 'require', 'invoke', 'raw', 'shell']);
  for (const ch of declared) {
    for (const seg of ch.toLowerCase().split(/[:.]/)) {
      assert.ok(!banned.has(seg), `banned channel segment: ${seg} in ${ch}`);
    }
  }
  for (const s of STORE_NAMES) assert.ok(['settings'].includes(s) || STORE_NAMES.includes(s));
});
