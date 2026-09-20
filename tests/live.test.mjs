/**
 * LIVE parser-engine tests (node --test). Fixtures are synthetic .test streams —
 * never shipped in the app. Run: node --test tests/live.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  normText, chanHash, cleanTitle, guessCountry, classify,
  parseM3U, parseM3U8Master, parseXMLTV, dayKey, progsForDay, nowNext, pctOf,
} from '../src/js/services/live/m3u.js';

const FIX = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'live');
const read = (f) => fs.readFileSync(path.join(FIX, f), 'utf8');

test('normText folds Arabic and punctuation for search', () => {
  assert.equal(normText('قناة  الجزِيرةِ [HD]'), 'قناه الجزيره hd');
  assert.equal(normText('مـكـة'), 'مكه');
  assert.equal(normText('"الحدث"'), 'الحدث');
});

test('chanHash is stable across imports yet name-sensitive', () => {
  const a = chanHash('src1', 'http://x/stream.m3u8', 'قناة الجزيرة');
  const b = chanHash('src1', 'http://x/stream.m3u8', 'قناة  الجزيرَه [HD]'.replace(' [HD]', ''));
  const c = chanHash('src1', 'http://x/stream.m3u8', 'أخرى');
  assert.equal(a, b, 'quality/diacritic noise must not change identity');
  assert.notEqual(a, c);
  assert.ok(a.startsWith('src1~'));
});

test('cleanTitle removes decoration but never everything', () => {
  assert.equal(cleanTitle('قناة الجزيرة [HD]'), 'قناة الجزيرة');
  assert.equal(cleanTitle('beIN SPORTS 1 HD'), 'beIN SPORTS 1');
  assert.equal(cleanTitle('03. MBC 1 Iraq (SD)'), 'MBC 1 Iraq');
  assert.equal(cleanTitle('‎- • News 4K'), 'News');
  assert.equal(cleanTitle('  [4K] '), '[4K]', 'falls back when strip would empty it');
});

test('guessCountry: explicit tag, leading-code groups, and names', () => {
  assert.equal(guessCountry({ tvgCountry: 'Saudi Arabia' }), 'sa');
  assert.equal(guessCountry({ tvgCountry: 'السعودية' }), 'sa');
  assert.equal(guessCountry({ group: 'UK | Sport', name: 'Extra' }), 'uk');
  assert.equal(guessCountry({ group: 'General', name: 'MBC Iraq' }), 'iq');
  assert.equal(guessCountry({ group: 'عام', name: 'مجرد قناة' }), null);
});

test('classify maps groups/names to Arabic-friendly buckets', () => {
  assert.equal(classify('beIN SPORTS HD', ''), 'sports');
  assert.equal(classify('إخبارية', ''), 'news');
  assert.equal(classify('kids', 'Cartoon Kingdom'), 'kids');
  assert.equal(classify('', 'افلام روتانا'), 'movies');
  assert.equal(classify('وثائقيات', ''), 'documentary');
  assert.equal(classify('adult only', ''), 'adult');
  assert.equal(classify('عام', 'قناة عادية'), 'general');
});

test('parseM3U maps fields, normalizes metadata, dedupes streams', async () => {
  const chans = await parseM3U(read('sample.m3u'), { sourceId: 's0' });
  assert.equal(chans.length, 5, 'one duplicate stream merged; junk line + titleless orphan skipped');

  const [jazeera, mbc, bein, unnamed, cnn] = chans;
  assert.equal(jazeera.name, 'قناة الجزيرة');
  assert.equal(jazeera.group, 'إخبارية', 'numbered group prefix stripped');
  assert.equal(jazeera.logo, 'https://example.test/logos/jazeera.png');
  assert.equal(jazeera.epg, 'al.jazeera.qa');
  assert.equal(jazeera.cat, 'news');

  assert.equal(mbc.name, 'MBC 1 Iraq', 'index prefix + (SD) noise cleaned');
  assert.equal(mbc.country, 'sa');
  assert.equal(mbc.lang, 'Arabic');
  assert.equal(mbc.opts['http-user-agent'], 'ZPopcorn/1.0', 'EXTVLCOPT captured');
  assert.equal(mbc.opts.cookie, 'sess=abc', 'EXTHTTP captured');

  assert.equal(bein.group, 'رياضة', 'EXTGRP overrides group-title');
  assert.equal(bein.name, 'beIN SPORTS 1');
  assert.equal(bein.epg, 'dup.stream', 'dedupe merges EPG id from the duplicate entry');

  assert.equal(unnamed.name, 'stream', 'unamed EXTINF falls back to the URL slug');
  assert.equal(cnn.country, 'us', 'leading "US |" dialect');
});

test('parseM3U is deterministic — ids survive re-import', async () => {
  const a = await parseM3U(read('sample.m3u'), { sourceId: 's0' });
  const b = await parseM3U(read('sample.m3u'), { sourceId: 's0' });
  assert.deepEqual(a.map((c) => c.id), b.map((c) => c.id));
});

test('parseM3U never crashes on garbage, CRLF and missing pieces', async () => {
  const raw = read('broken.m3u');
  const chans = await parseM3U(raw, { sourceId: 'bad1' });
  assert.ok(chans.length >= 1 && chans.length <= 4);
  for (const c of chans) {
    assert.ok(c.stream && (c.stream.startsWith('http') || c.stream.startsWith('./')), 'only stream-looking lines become entries');
    assert.ok(c.id && c.name, 'every surviving channel has identity');
    assert.equal(c.name.includes('No stream follows'), false, 'an EXTINF must not attach to the next file section');
  }
});

test('parseM3U streams progress and yields for big lists without blocking', async () => {
  const lines = ['#EXTM3U'];
  for (let i = 1; i <= 12000; i++) {
    lines.push(`#EXTINF:-1 tvg-id="ch.${i}" group-title="GRP ${i % 40}",Channel ${i} [HD]`);
    lines.push(`http://stream.test/live/ch${i}/index.m3u8`);
  }
  let progress = 0;
  const t0 = performance.now();
  const chans = await parseM3U(lines.join('\n'), { sourceId: 'big', yieldEvery: 5000, onProgress: () => { progress++; } });
  const dt = performance.now() - t0;
  assert.equal(chans.length, 12000);
  assert.ok(progress >= 2, 'callback fires on each yield chunk');
  assert.ok(dt < 4000, `12k lines parsed in ${dt.toFixed(0)}ms (<4s budget)`);
  assert.ok(chans.every((c) => !c.name.includes('[HD]'), 'quality noise cleaned at scale too'));
});

test('parseM3U8Master extracts levels with bandwidth/resolution', () => {
  const master = `#EXTM3U
#EXT-X-STREAM-INF:BANDWIDTH=5400000,RESOLUTION=1920x1080
1080.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1200000,RESOLUTION=640x360
360.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2400000
720.m3u8`;
  const lv = parseM3U8Master(master);
  assert.equal(lv.length, 3);
  assert.deepEqual(lv[0], { bandwidth: 5400000, width: 1920, height: 1080, url: '1080.m3u8' });
  assert.equal(lv[2].height, 0, 'missing RESOLUTION tolerated');
});

/* ───────────────────────────── XMLTV ───────────────────────────── */

const t = (day, h, mi) => { const d = new Date(); d.setHours(0, 0, 0, 0); return new Date(d.getTime() + day * 864e5 + (h * 60 + mi) * 60e3); };
const xtime = (d, off = '+0000') => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}00 ${off}`;

test('parseXMLTV: tolerant of malformed programmes, decodes entities', async () => {
  const a = t(0, 0, 0); const b = t(0, 12, 0); const c = t(0, 13, 30); const d = t(1, 0, 0);
  const xml = `<?xml version="1.0"?>
<tv>
  <channel id="ch.news"><display-name xml:lang="ar">الجزيرة</display-name></channel>
  <programme start="${xtime(a)}" stop="${xtime(b)}" channel="ch.news">
    <title>نشرة الأخبار &amp; آخر التطورات</title><desc>تغطية مباشرة</desc>
  </programme>
  <programme start="garbage-date" stop="${xtime(c)}" channel="ch.news"><title>Broken start</title></programme>
  <programme start="${xtime(b)}" stop="${xtime(a)}" channel="ch.news"><title>End before start</title></programme>
  <programme start="${xtime(b)}" stop="${xtime(c)}" channel=""><title>No channel</title></programme>
  <programme start="${xtime(b)}" stop="${xtime(c)}" channel="ch.news"><title>مباراة النهائي</title></programme>
  <programme start="${xtime(c)}" stop="${xtime(d)}" channel="ch.movie"><title>Late Night Movie</title></programme>
</tv>`;
  const { channels, byChan } = await parseXMLTV(xml);
  assert.equal(channels.get('ch.news'), 'الجزيرة');
  const news = byChan.get('ch.news');
  assert.equal(news.length, 2, 'three malformed programme rows skipped');
  assert.equal(news[0].t, 'نشرة الأخبار & آخر التطورات', 'entity decoded');
  assert.equal(news[0].d, 'تغطية مباشرة');
  assert.ok(news.every((p) => p.e > p.s));
  assert.equal(byChan.get('ch.movie').length, 1);
});

test('XMLTV offsets convert to correct local instants', async () => {
  const xml = `<tv><programme start="20260101120000 +0300" stop="20260101130000 +0300" channel="x"><title>Noon Riyadh</title></programme></tv>`;
  const { byChan } = await parseXMLTV(xml);
  const p = byChan.get('x')[0];
  assert.equal(p.s, Date.UTC(2026, 0, 1, 9, 0), '12:00+0300 === 09:00Z');
});

test('progsForDay / nowNext / pctOf power the guide queries', async () => {
  const progs = [
    { ch: 'x', s: t(0, 6, 0).getTime(), e: t(0, 9, 0).getTime(), t: 'صباح الخير' },
    { ch: 'x', s: t(0, 9, 0).getTime(), e: t(0, 12, 0).getTime(), t: 'النشرة' },
    { ch: 'x', s: t(0, 22, 0).getTime(), e: t(1, 1, 0).getTime(), t: 'يمتد لغدًا' },
    { ch: 'x', s: t(1, 5, 0).getTime(), e: t(1, 8, 0).getTime(), t: 'غدًا صباحًا' },
  ];
  const day0 = dayKey(t(0, 10, 0).getTime());
  const slice = progsForDay(progs, day0);
  assert.equal(slice.length, 3, 'tomorrow-only programme excluded; day-spanner kept');
  const nn = nowNext(progs, t(0, 10, 0).getTime());
  assert.equal(nn.cur.t, 'النشرة');
  assert.equal(nn.next.t, 'يمتد لغدًا');
  assert.ok(Math.abs(pctOf(nn.cur, t(0, 10, 30).getTime()) - 0.5) < 1e-9);
  const ahead = nowNext(progs, t(0, 5, 0).getTime());
  assert.equal(ahead.cur, null);
  assert.equal(ahead.next.t, 'صباح الخير', 'next scheduled before the day counts');
  assert.equal(pctOf({ s: 5, e: 10 }, 0), 0, 'clamped');
});
