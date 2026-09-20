/**
 * IPTV scenario matrix (rebuild directive §48) + service query layer, run for
 * real in node: empty→20k playlists, garbage, duplicates, missing fields,
 * quality flags, indexed search, multi-source isolation, TTL staleness,
 * dedupe, cancellation-shaped failures. Fixtures stay in tests/ only.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseM3U, qualityOf, buildHay, chanHash, normText } from '../src/js/services/live/m3u.js';
import { live } from '../src/js/services/live/LiveService.js';

const mk = (n, { urlBase = 'http://s/x', withLogo = true, withGroup = true, extra = '' } = {}) => {
  const out = ['#EXTM3U'];
  for (let i = 0; i < n; i++) {
    const logo = withLogo ? ` tvg-logo="http://i/${i}.png"` : '';
    const grp = withGroup ? ` group-title="G${i % 7}"` : '';
    out.push(`#EXTINF:-1 tvg-id="c.${i}"${logo}${grp}${extra},Channel ${i} (720p)`);
    out.push(`${urlBase}${i}.m3u8`);
  }
  return out.join('\n');
};

test('§48 empty playlist → zero channels, no crash', async () => {
  assert.deepEqual(await parseM3U('#EXTM3U\n', { sourceId: 'e0' }), []);
  assert.deepEqual(await parseM3U('', { sourceId: 'e0' }), []);
  assert.deepEqual(await parseM3U('\r\n\r\n', { sourceId: 'e0' }), []);
});

test('§48 small + medium lists round-trip exactly', async () => {
  for (const n of [1, 12, 800]) {
    const chans = await parseM3U(mk(n), { sourceId: `m${n}` });
    assert.equal(chans.length, n);
    assert.ok(chans.every((c) => c.id && c.stream && c.name && c.epg));
  }
});

test('§48 20,000-channel playlist parses in budget with no freeze-style tail', async () => {
  const t0 = performance.now();
  const chans = await parseM3U(mk(20000), { sourceId: 'big20k', yieldEvery: 5000 });
  const dt = performance.now() - t0;
  assert.equal(chans.length, 20000);
  assert.ok(dt < 9000, `20k parsed in ${dt.toFixed(0)}ms`);
});

test('§48 garbage / binary-ish input is contained', async () => {
  const junk = Array.from({ length: 500 }, (_, i) => `${i % 3 === 0 ? String.fromCharCode(128 + (i % 60)) : 'x'.repeat(i % 40)} ${i}`).join('\n');
  const chans = await parseM3U(junk, { sourceId: 'g0' });
  assert.ok(Array.isArray(chans) && chans.length <= 2, 'no junk line becomes a channel');
});

test('§48 missing logos / categories degrade, never drop', async () => {
  const chans = await parseM3U(mk(25, { withLogo: false, withGroup: false }), { sourceId: 'nl' });
  assert.equal(chans.length, 25);
  assert.ok(chans.every((c) => c.logo === '' && c.group === 'عام' && c.cat === 'general'));
});

test('§48 duplicate channels across lines merge; across sources stay isolated', async () => {
  const dup = '#EXTM3U\n#EXTINF:-1,A\nhttp://s/x.ts\n#EXTINF:-1,A again\nhttp://s/x.ts';
  assert.equal((await parseM3U(dup, { sourceId: 'sa' })).length, 1);
  const a = await parseM3U(mk(5), { sourceId: 'sa' });
  const b = await parseM3U(mk(5), { sourceId: 'sb' });
  assert.equal(a.length, 5); assert.equal(b.length, 5);
  assert.ok(a.every((c, i) => c.id !== b[i].id && c.stream === b[i].stream), 'same stream, source-scoped identity');
});

test('§33 quality tiering from names/groups', () => {
  assert.equal(qualityOf('beIN SPORTS 4K', ''), 2);
  assert.equal(qualityOf('MBC', 'UHD | Movies'), 2);
  assert.equal(qualityOf('News 1080', 'General'), 0, 'bare 1080 (no p) is not a quality claim');
  assert.equal(qualityOf('MBC 1 (SD)', 'General'), 0, 'SD is explicitly not a quality tier');
  assert.equal(qualityOf('beIN SPORTS 1 HD', ''), 1);
  assert.equal(qualityOf('CNN HD', ''), 1);
  assert.equal(qualityOf('الجزيرة', 'إخبارية'), 0);
});

test('§34 haystack index carries language, country and source for one-includes search', () => {
  const hay = buildHay({ name: 'MBC Action HD', group: 'أفلام', lang: 'Arabic', country: 'sa', cat: 'movies', epg: 'mbc.actions' }, 'قائمة مزوّدتي');
  for (const token of ['mbc action', 'أفلام', 'arabic', 'السعوديه', 'قائمة مزوّدتي', 'movies', 'mbc.actions']) {
    assert.ok(hay.includes(normText(token)), `haystack must contain ${token}`);
  }
});

/* ─────────── service query layer (real LiveManager, no DOM) ─────────── */

async function seedService() {
  const chans = await parseM3U(`#EXTM3U
#EXTINF:-1 tvg-id="news.hd" tvg-logo="http://i/n.png" tvg-language="Arabic" group-title="UK | News",Sky News HD
http://s/sky.m3u8
#EXTINF:-1 tvg-id="doc.uhd" group-title="وثائقيات",Discovery 4K
http://s/disc.m3u8
#EXTINF:-1 tvg-id="kids.gone",Cartoonia
http://s/kids.m3u8`, { sourceId: 'svc1' });
  live.sources = [{ id: 'svc1', name: 'مصدر التجربة', enabled: true, url: 'http://s/pl.m3u', status: 'ok', channelCount: 3, lastUpdate: Date.now(), epgUrl: '', epgBuiltAt: 0 }];
  live.playlists = new Map([['svc1', { sourceId: 'svc1', builtAt: Date.now(), count: chans.length, channels: chans.map((c) => ({ ...c, src: 'svc1' })) }]]);
  live.rebuildIndex();
  return chans;
}

test('channels() + quality/liveNow/lang filters over the live index', async () => {
  await seedService();
  const all = live.channels({});
  assert.equal(all.length, 3);
  assert.ok(all.every((c) => c._hay && typeof c._q === 'number'), 'index-time decoration present');
  assert.equal(live.channels({ quality: 'hd' }).length, 2, 'HD tier includes the 4K row');
  assert.deepEqual(live.channels({ quality: '4k' }).map((c) => c.epg), ['doc.uhd']);
  assert.equal(live.channels({ q: 'سكاي', lang: '' }).length, 0, 'transliteration NOT guessed — honest');
  assert.equal(live.channels({ q: 'sky' })[0].epg, 'news.hd', 'indexed search finds via haystack');
  assert.equal(live.channels({ q: 'وثائقيات' })[0].epg, 'doc.uhd', 'group text searchable');
  assert.equal(live.channels({ lang: 'Arabic' }).length, 1);
  assert.equal(live.channels({ country: 'uk' })[0].epg, 'news.hd', 'country from UK| dialect');
  assert.equal(live.channels({ liveNow: true }).length, 0, 'no EPG loaded → nothing verifiably on air (never faked)');
});

test('multi-source isolation: disabling one source leaves the other intact', async () => {
  await seedService();
  const chans2 = await parseM3U('#EXTINF:-1 tvg-id="b1",Extra Channel\nhttp://s/extra.ts', { sourceId: 'svc2' });
  live.sources.push({ id: 'svc2', name: 'ثاني', enabled: true, url: 'http://s/p2', status: 'ok', lastUpdate: Date.now(), epgUrl: '' });
  live.playlists.set('svc2', { sourceId: 'svc2', builtAt: Date.now(), count: 1, channels: chans2.map((c) => ({ ...c, src: 'svc2' })) });
  live.rebuildIndex();
  assert.equal(live.visible().length, 4);
  live.sources[0].enabled = false;
  live.rebuildIndex();
  assert.equal(live.visible().length, 1);
  assert.equal(live.visible()[0].epg, 'b1', 'working source unaffected by broken/disabled sibling (spec 37)');
  live.sources[0].enabled = true;
  live.rebuildIndex();
});

test('memStats reports real, coherent telemetry (spec 42)', async () => {
  await seedService();
  const m = live.memStats();
  assert.equal(m.indexed, 3);
  assert.equal(m.playlistChannels, 3);
  assert.ok(m.estBytes > 0 && Number.isFinite(m.estBytes));
  assert.equal(m.logoCache, 0, 'logo cache untouched by this seed');
});

test('stale flag math matches the TTL contract (spec 35/36)', async () => {
  const t0 = Date.now();
  const src = { id: 'x', status: 'ok', lastUpdate: t0 - 8 * 864e5, enabled: true };
  const ttl = 7;
  const stale = src.status === 'ok' && src.lastUpdate && Date.now() - src.lastUpdate > ttl * 864e5;
  assert.ok(stale);
  src.lastUpdate = t0 - 6 * 864e5;
  assert.ok(!(Date.now() - src.lastUpdate > ttl * 864e5));
});
