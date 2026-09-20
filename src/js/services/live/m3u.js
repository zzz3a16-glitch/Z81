/**
 * zPopcorn LIVE — playlist & EPG parsing (pure, DOM-free, node-testable).
 * The import pipeline (spec 05): tolerant parse → normalize → classify.
 * A single malformed line must never fail an import; huge files yield to the
 * event loop every `yieldEvery` lines so the UI never freezes (spec 15).
 */

/* ───────────────────────── utilities ───────────────────────── */

/** fold Arabic/Persian orthographic variants for stable search + compare */
export function normText(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')        // diacritics + tatweel
    .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .replace(/[[\](){}«»"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** FNV-1a — stable ids that survive re-imports (favorites keep working) */
export function chanHash(sourceId, stream, name) {
  const str = `${sourceId}|${stream || ''}|${normText(name)}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return `${sourceId}~${(h >>> 0).toString(36)}`;
}

const QUALITY_TAIL = /\s*[\[([]\s*(?:fhd|uhd|hd|sd|4k|8k|1080p?|720p?|576p?|480p?|360p?|hevc|x265?|avc|aac|multi|متعدد)\s*[\])\]]\s*$/i;
const QUALITY_MID = /\s*\b(?:fhd|uhd|4k|8k|1080p|720p|hevc|x265)\b\s*[-|]\s*$/i;
const QUALITY_END = /\s*\b(?:fhd|uhd|hd|sd|4k|8k|1080p|720p)\b\s*$/i;

export function cleanTitle(t) {
  let s = String(t || '').replace(/[\u200e\u200f\u202a-\u202e]/g, '').trim();
  for (let i = 0; i < 5; i++) {
    const p = s;
    s = s
      .replace(/^\s*[-•–]+\s*/, '')
      .replace(/^\s*\d{1,3}\s*[.)]\s+(?=\D)/, '')
      .replace(QUALITY_TAIL, '')
      .replace(QUALITY_MID, ' ')
      .replace(QUALITY_END, '')
      .trim();
    if (s === p) break;
  }
  return s || String(t || '').trim();
}

const COUNTRIES = {
  'uk': ['UK', 'UNITED KINGDOM', 'BRITAIN', 'بريطانيا'], 'us': ['USA', 'US', 'AMERICA', 'UNITED STATES', 'امريكا'],
  'sa': ['SA', 'SAUDI', 'KSA', 'السعودية', 'سعودي'], 'ae': ['UAE', 'AE', 'EMIRAT', 'الامارات'],
  'eg': ['EG', 'EGYPT', 'مصر'], 'kw': ['KW', 'KUWAIT', 'الكويت'], 'qa': ['QA', 'QATAR', 'قطر'],
  'bh': ['BH', 'BAHRAIN', 'البحرين'], 'om': ['OM', 'OMAN', 'عمان'], 'jo': ['JO', 'JORDAN', 'الاردن'],
  'iq': ['IQ', 'IRAQ', 'العراق'], 'ma': ['MA', 'MOROCCO', 'المغرب'], 'dz': ['DZ', 'ALGERIA', 'الجزائر'],
  'tn': ['TN', 'TUNISIA', 'تونس'], 'ly': ['LY', 'LIBYA', 'ليبيا'], 'ps': ['PS', 'PALESTINE', 'فلسطين'],
  'lb': ['LB', 'LEBANON', 'لبنان'], 'sy': ['SY', 'SYRIA', 'سوريا'], 'ye': ['YE', 'YEMEN', 'اليمن'],
  'sd': ['SD', 'SUDAN', 'السودان'], 'tr': ['TR', 'TURKEY', 'تركيا'], 'fr': ['FR', 'FRANCE', 'فرنسا'],
  'de': ['DE', 'GERMANY', 'المانيا'], 'it': ['IT', 'ITALY', 'ايطاليا'], 'es': ['ES', 'SPAIN', 'اسبانيا'],
  'pt': ['PT', 'PORTUGAL', 'البرتغال'], 'nl': ['NL', 'HOLLAND', 'هولندا'], 'ru': ['RU', 'RUSSIA', 'روسيا'],
  'in': ['IN', 'INDIA', 'الهند'], 'pk': ['PK', 'PAKISTAN', 'باكستان'], 'bd': ['BD', 'BANGLADESH'],
  'ir': ['IR', 'PERSIAN', 'IRAN', 'ايران'], 'br': ['BR', 'BRAZIL', 'البرازيل'], 'ar': ['AR', 'ARAB', 'العرب', 'عربي'],
  'ca': ['CA', 'CANADA'], 'au': ['AU', 'AUSTRALIA'], 'jp': ['JP', 'JAPAN', 'اليابان'], 'kr': ['KR', 'KOREA', 'كوريا'],
  'cn': ['CN', 'CHINA', 'الصين'], 'gr': ['GR', 'GREECE'], 'ro': ['RO', 'ROMANIA'], 'pl': ['PL', 'POLAND'],
  'se': ['SE', 'SWEDEN'], 'no': ['NO', 'NORWAY'], 'dk': ['DK', 'DENMARK'], 'fi': ['FI', 'FINLAND'],
};
export const COUNTRY_NAMES = {
  uk: 'المملكة المتحدة', us: 'الولايات المتحدة', sa: 'السعودية', ae: 'الإمارات', eg: 'مصر', kw: 'الكويت',
  qa: 'قطر', bh: 'البحرين', om: 'عُمان', jo: 'الأردن', iq: 'العراق', ma: 'المغرب', dz: 'الجزائر', tn: 'تونس',
  ly: 'ليبيا', ps: 'فلسطين', lb: 'لبنان', sy: 'سوريا', ye: 'اليمن', sd: 'السودان', tr: 'تركيا', fr: 'فرنسا',
  de: 'ألمانيا', it: 'إيطاليا', es: 'إسبانيا', pt: 'البرتغال', nl: 'هولندا', ru: 'روسيا', in: 'الهند',
  pk: 'باكستان', bd: 'بنغلاديش', ir: 'إيران', br: 'البرازيل', ar: 'عالمي عربي', ca: 'كندا', au: 'أستراليا',
  jp: 'اليابان', kr: 'كوريا', cn: 'الصين', gr: 'اليونان', ro: 'رومانيا', pl: 'بولندا', se: 'السويد',
  no: 'النرويج', dk: 'الدنمارك', fi: 'فنلندا',
};

/** guess a country key from tvg-country / group / name text */
export function guessCountry({ tvgCountry, group, name } = {}) {
  const explicit = normText(tvgCountry);
  if (explicit) {
    for (const [k, list] of Object.entries(COUNTRIES)) if (list.some((t) => normText(t) === explicit)) return k;
    const bag = ` ${explicit} `;
    for (const [k, list] of Object.entries(COUNTRIES)) {
      if (list.some((t) => { const n = normText(t); return n.length <= 3 ? bag.includes(` ${n} `) : bag.includes(n); })) return k;
    }
  }
  const up = `${group || ''} ${name || ''}`.toUpperCase();
  const lead = /^\s*([A-Z]{2,3})\s*[|/-]/.exec(up); // "UK| Sports" dialect
  if (lead) for (const [k, list] of Object.entries(COUNTRIES)) if (list.includes(lead[1])) return k;
  for (const [k, list] of Object.entries(COUNTRIES)) if (list.some((t) => up.includes(` ${t} `) || up.startsWith(`${t} `) || up.endsWith(` ${t}`))) return k;
  return null;
}

const CATS = [
  ['sports', ['sport', 'sports', 'football', 'soccer', 'tennis', 'basketball', 'mma', 'wrestling', 'رياضة', 'رياضي', 'كورة', 'كرة', 'الرياضية', 'دوري', 'bein', 'win sports']],
  ['news', ['news', 'breaking', 'العربية? tv', 'اخبار', 'أخبار', 'إخبارية', 'الأنباء', 'cnn', 'bbc', 'france24', 'skynews', 'المشهد', 'الحدث']],
  ['kids', ['kid', 'kids', 'children', 'cartoon', 'toy', 'disney', 'nick', 'boomerang', 'اطفال', 'أطفال', 'كرتون', 'ناشئة', 'براعم', 'عالم صغاري']],
  ['movies', ['movie', 'movies', 'film', 'films', 'cinema', 'blockbuster', 'افلام', 'أفلام', 'سينما', ' السينما', 'روتانا سينما']],
  ['series', ['serie', 'series', 'drama', 'soap', 'theatre', 'مسلسل', 'مسلسلات', 'دراما', 'الدراما', 'سيت كوم', 'sitcom']],
  ['music', ['music', 'hits', 'clips', 'concert', 'اغاني', 'أغاني', 'موسيقى', 'موسيقي', 'فنون', 'rotana clip']],
  ['documentary', ['document', 'docu', 'discovery', 'nat geo', 'national geographic', 'history', 'animal', 'science', 'thrill', 'وثائقي', 'وثائقيات', 'علوم', 'حيوان', 'تاريخ', 'معرفه', 'معرفة']],
  ['religious', ['quran', 'sunna', 'islamic', 'mecca', 'medina', 'قران', 'قرآن', 'سنة', 'دين', 'اسلام', 'إسلام', 'مكة', 'المدينة', 'القرآن الكريم', 'السنة النبوية']],
  ['entertainment', ['entertain', 'comedy', 'variety', 'show', 'talent', 'lifestyle', 'travel', 'food', 'منوعات', 'ترفيه', 'كوميديا', 'برامج', 'سفر', 'مطبخ']],
];
const ADULT = ['adult', 'xxx', '18+', 'porn', 'للكبار'];

export function classify(group = '', name = '') {
  const bag = normText(`${group} ${name}`);
  if (ADULT.some((t) => bag.includes(t))) return 'adult';
  for (const [cat, keys] of CATS) if (keys.some((k) => bag.includes(normText(k)))) return cat;
  return 'general';
}

/* ───────────────────────── M3U / M3U8 ───────────────────────── */

const ATTR = /([\w-]+)="([^"]*)"/g;

/**
 * Parse an extended M3U playlist.
 * @param {string} text raw playlist (may contain CRLF, BOM, garbage)
 * @param {{sourceId:string, yieldEvery?:number, onProgress?:(n:number)=>void}} opt
 * @returns {Promise<Array>} normalized channel descriptors
 */
export async function parseM3U(text, { sourceId, yieldEvery = 5000, onProgress, onBatch } = {}) {
  const src = String(text || '').replace(/^\uFEFF/, '');
  const isM3U = /^\s*#EXTM3U/m.test(src.slice(0, 2048));
  const lines = src.split(/\r?\n/);
  const out = [];
  const seenStreams = new Map();
  let meta = null;
  for (let i = 0; i < lines.length; i++) {
    if (onProgress && i && i % yieldEvery === 0) { onProgress(i); await null; await new Promise((r) => setTimeout(r)); }
    if (onBatch && i && i % yieldEvery === 0) onBatch(out, lines.length);
    const line = lines[i].trim();
    if (!line) continue;
    if (line.startsWith('#EXTINF:')) {
      const head = line.slice(8);
      const commaAt = head.indexOf(',');
      const attrBlob = commaAt >= 0 ? head.slice(0, commaAt) : head;
      const title = commaAt >= 0 ? head.slice(commaAt + 1) : '';
      meta = { rawTitle: title.trim(), attrs: {}, opts: {} };
      let m; ATTR.lastIndex = 0;
      while ((m = ATTR.exec(attrBlob))) meta.attrs[m[1].toLowerCase()] = m[2];
    } else if (line.startsWith('#EXTGRP:')) {
      if (meta) meta.groupOverride = line.slice(8).trim();
    } else if (line.startsWith('#EXTVLCOPT:')) {
      const kv = /http-(user-agent|referrer)\s*=\s*(.+)$/i.exec(line);
      if (kv && meta) meta.opts[`http-${kv[1].toLowerCase()}`] = kv[2].trim();
    } else if (line.startsWith('#EXTHTTP:')) {
      try { if (meta) Object.assign(meta.opts, JSON.parse(line.slice(9))); } catch { /* tolerant */ }
    } else if (line.startsWith('#')) {
      continue; // comments, KODIPROP, directives — tolerated
    } else {
      // a stream line
      const url = line;
      const looksUrl = /^[a-z][a-z0-9+.-]*:/i.test(url);
      const looksRel = isM3U && !/\s/.test(url) && (/^(\.\/|\/|\.\.\/)/.test(url) || /^[\w@%+&=.,\-/]+\.m3u8?(\?[^\s]*)?$/i.test(url));
      if (!looksUrl && !looksRel) continue; // junk line — skip (meta kept for the real URL that may follow)
      const a = meta?.attrs || {};
      const group = meta?.groupOverride || a['group-title'] || 'عام';
      const rawName = meta?.rawTitle || a['tvg-name'] || decodeURIComponent((url.split('?')[0].split('#').pop() || '').split('/').pop() || '') .replace(/\.[a-z0-9]{2,4}$/i, '') .replace(/[-_]/g, ' ') || `قناة ${i + 1}`;
      const name = cleanTitle(rawName) || `قناة ${i + 1}`;
      const country = guessCountry({ tvgCountry: a['tvg-country'], group, name });
      const dup = seenStreams.get(url);
      if (dup) { // same stream twice in one list → merge sparse metadata, never duplicate
        if (!dup.epg && a['tvg-id']) dup.epg = a['tvg-id'];
        if (!dup.logo && (a['tvg-logo'] || a['logo'])) dup.logo = a['tvg-logo'] || a['logo'];
        meta = null; continue;
      }
      const chan = {
        id: chanHash(sourceId, url, name),
        name, raw: rawName,
        stream: url,
        logo: a['tvg-logo'] || a['logo'] || '',
        group: String(group).replace(/^\s*\d+\s*[-.)]\s*/, '').trim() || 'عام',
        country,
        lang: a['tvg-language'] || (country && ['sa', 'eg', 'kw', 'qa', 'bh', 'om', 'jo', 'iq', 'ma', 'dz', 'tn', 'ly', 'ps', 'lb', 'sy', 'ye', 'sd', 'ae'].includes(country) ? 'العربية' : ''),
        epg: a['tvg-id'] || '',
        cat: classify(group, name),
        opts: meta?.opts || {},
      };
      seenStreams.set(url, chan);
      out.push(chan);
      chan.i = out.length - 1;
      meta = null;
    }
  }
  if (onBatch) onBatch(out, lines.length);
  return out;
}

/** HLS master playlist → levels (for stream info only; playback is external) */
export function parseM3U8Master(text) {
  const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/);
  const levels = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^#EXT-X-STREAM-INF:([^\n]+)$/.exec(lines[i].trim());
    if (!m) continue;
    const at = {}; let a;
    const HATTR = /([\w-]+)=(?:"([^"]*)"|([^",]+))/g;
    while ((a = HATTR.exec(m[1]))) at[a[1].toLowerCase()] = a[2] ?? a[3];
    const url = (lines[i + 1] || '').trim();
    if (url && !url.startsWith('#')) {
      const res = at.resolution ? String(at.resolution).split('x') : [];
      levels.push({ bandwidth: +at.bandwidth || 0, width: +res[0] || 0, height: +res[1] || 0, url });
      i++;
    }
  }
  return levels;
}

/** identify what the response actually is — honest routing, not blind parsing */
export function sniffFormat(text) {
  const head = String(text || '').replace(/^\uFEFF/, '').slice(0, 4096);
  if (/^\s*#EXTM3U/m.test(head)) return /#EXTINF/i.test(head) ? 'm3u' : 'm3u8-master';
  if (/^\s*<\?xml[\s\S]{0,600}?<tv\b/i.test(head)) return 'xmltv';
  if (/^\s*<(!doctype\s+html|html)|<html[\s>]/i.test(head)) return 'html';
  const t = head.trim();
  if (t.startsWith('[') || /^\{\s*"(playlists|series|streams|live|items)"/i.test(t)) return 'json';
  if (/^\{\s*"(server_info|user_info|player_api)"/i.test(t)) return 'xtream-api';
  if (head.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith('#')).every((l) => /^https?:\/\//i.test(l.trim()))) return 'bare-urls';
  return 'unknown';
}

/**
 * JSON playlist APIs: arrays of {name,title,url,stream_id,group,...} — normalized
 * through the SAME pipeline as M3U (clean/guess/classify/hash). Xtream API roots
 * are reported honestly with the fix, not silently parsed.
 */
export function parseJSONPlaylist(text, { sourceId } = {}) {
  let data;
  try { data = JSON.parse(text); }
  catch { throw Object.assign(new Error('رابط JSON غير صالح (not parseable JSON)'), { code: 'E_JSON' }); }
  if (data && typeof data === 'object' && !Array.isArray(data) && (data.server_info || data.user_info || data.player_api)) {
    throw Object.assign(new Error('هذا رابط واجهة Xtream API — استخدم رابط القائمة المباشر (…/get.php?username=…&type=m3u_plus)'), { code: 'E_XTREAM_API' });
  }
  const arr = Array.isArray(data) ? data : Array.isArray(data?.playlists) ? data.playlists : Array.isArray(data?.streams) ? data.streams : Array.isArray(data?.items) ? data.items : null;
  if (!arr) throw Object.assign(new Error('بنية JSON غير معروفة — لم نجد مصفوفة قنوات'), { code: 'E_JSON_SHAPE' });
  const out = [];
  const seen = new Map();
  for (const it of arr) {
    const url = typeof it === 'string' ? it : String(it?.url || it?.stream_url || it?.file || '');
    if (!/^https?:\/\//i.test(url)) continue; // invalid item skipped, never fatal
    if (seen.has(url)) continue;
    const rawName = String(it?.name || it?.title || '').trim() || decodeURIComponent(url.split('?')[0].split('/').pop() || '').replace(/\.[a-z0-9]{2,4}$/i, '').replace(/[-_]/g, ' ');
    const name = cleanTitle(rawName) || `قناة ${out.length + 1}`;
    const group = String(it?.group_title || it?.group || it?.category || 'عام').replace(/^\s*\d+\s*[-.)]\s*/, '').trim() || 'عام';
    const chan = {
      id: chanHash(sourceId, url, name), name, raw: rawName, stream: url,
      logo: String(it?.stream_icon || it?.logo || it?.icon || ''),
      group,
      country: guessCountry({ tvgCountry: it?.country, group, name }),
      lang: String(it?.lang || it?.language || ''),
      epg: String(it?.epg_id || it?.['tvg-id'] || it?.tv_id || (it?.stream_id != null ? `xtream.${it.stream_id}` : '')),
      cat: classify(group, name),
      opts: { ...(it?.user_agent ? { 'http-user-agent': String(it.user_agent) } : {}) },
    };
    seen.set(url, chan);
    out.push(chan);
    chan.i = out.length - 1;
  }
  return out;
}

/* ───────────────────────── XMLTV / EPG ───────────────────────── */

const T0 = (y, mo, d, h, mi, off) => {
  const base = Date.UTC(y, mo - 1, d, h, mi);
  if (!off) return base;
  const sign = off[0] === '-' ? -1 : 1;
  return base - sign * ((+off.slice(1, 3)) * 60 + (+off.slice(3, 5))) * 60000;
};
const parseTvTime = (raw) => {
  const m = /(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?\s*([+-]\d{4})?/.exec(String(raw || ''));
  if (!m) return null;
  return T0(+m[1], +m[2], +m[3], +m[4], +m[5], m[7]);
};
const ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&#39;': "'", '&ndash;': '-', '&mdash;': '-', '&nbsp;': ' ' };
const unesc = (s) => String(s || '').replace(/&[#a-z0-9]+;/gi, (m) => ENT[m.toLowerCase()] ?? (m.startsWith('&#') ? String.fromCodePoint(parseInt(m.slice(2, -1), m[1] === 'x' ? 16 : 10)) : m));
const tagText = (blob, tag) => { const m = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i').exec(blob); return m ? unesc(m[1].replace(/<[^>]+>/g, '')).trim() : ''; };

/**
 * Parse XMLTV into { channels:Map(epgId→display), progs:[{ch,s,e,t,d}] }.
 * Chunked: yields to the event loop every `yieldEvery` programmes.
 */
export async function parseXMLTV(text, { yieldEvery = 400, onProgress } = {}) {
  const src = String(text || '');
  const channels = new Map();
  // channel id → canonical display-name (first)
  for (const m of src.matchAll(/<channel\b[^>]*\bid="([^"]+)"[\s\S]*?<\/channel>/gi)) {
    const disp = tagText(m[0], 'display-name');
    if (disp) channels.set(m[1].trim(), disp);
  }
  const progs = [];
  let n = 0;
  for (const m of src.matchAll(/<programme\b([^>]*)>([\s\S]*?)<\/programme>/gi)) {
    const attrs = {}; let a; ATTR.lastIndex = 0;
    // programme attrs are unquoted-safe: start="..." channel="..."
    const at = /\b(start|stop|channel)="([^"]*)"/g;
    while ((a = at.exec(m[1]))) attrs[a[1]] = a[2];
    const s = parseTvTime(attrs.start); const e = parseTvTime(attrs.stop);
    n++;
    if (onProgress && n % yieldEvery === 0) { onProgress(n); await new Promise((r) => setTimeout(r)); }
    if (s == null || e == null || e <= s || !attrs.channel) continue; // malformed → skip, never throw
    const title = unesc(tagText(m[2], 'title') || '');
    if (!title) continue;
    progs.push({ ch: attrs.channel.trim(), s, e, t: title, d: tagText(m[2], 'desc').slice(0, 240) });
  }
  progs.sort((x, y) => x.s - y.s);
  const byChan = new Map();
  for (const p of progs) { const k = p.ch; (byChan.get(k) || byChan.set(k, []).get(k)).push(p); }
  return { channels, byChan };
}

/** the day window we keep (bounded cache — spec 19/20) */
export function dayKey(ms) { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

/** slice programmes of a day (local); progs sorted */
export function progsForDay(progs, dayISO, now = Date.now()) {
  const [y, mo, d] = dayISO.split('-').map(Number);
  const from = new Date(y, mo - 1, d).getTime();
  const to = from + 864e5;
  const out = [];
  for (const p of progs) {
    if (p.e <= from || p.s >= to) { if (p.s >= to) break; continue; }
    out.push(p);
  }
  return out;
}

/** current + next around a moment */
export function nowNext(progs, now = Date.now()) {
  let cur = null; let next = null;
  for (let i = 0; i < progs.length; i++) {
    const p = progs[i];
    if (p.s <= now && now < p.e) { cur = p; next = progs[i + 1] || null; break; }
    if (p.s > now) { next = p; break; }
  }
  return { cur, next };
}

export const pctOf = (p, now = Date.now()) => (p && p.e > p.s ? Math.min(1, Math.max(0, (now - p.s) / (p.e - p.s))) : 0);
