/**
 * FileNameParser (main-process port, hardened) — smart media filename analysis
 * for Smart Import (spec 15). Supports S01E01 / S1E2 / 1x01 / Episode N /
 * [group] Title - 05 v2, years, quality, codec, audio, subtitles, edition
 * detection, Arabic & Unicode filenames, spaces, dots, underscores.
 */

const VIDEO_EXT = new Set(['mkv','mp4','avi','mov','wmv','flv','webm','m4v','mpg','mpeg','ts','m2ts','iso','ogv','3gp','vob']);
const AUDIO_EXT = new Set(['mp3','flac','m4a','wav','aac','ogg','opus','alac','ape','wma']);
const IGNORED_BASENAMES = new Set(['thumbs.db','desktop.ini','.ds_store','ehthumbs.db','autorun.inf']);
const IGNORED_EXTS = new Set(['nfo','srt','ass','ssa','sub','idx','txt','jpg','png','gif','sfv','sfv','md5','exe','url','rar','zip','7z','torrent','part','down','tmp','!qB']);

export function isMediaFile(filename) {
  const ext = extensionOf(filename);
  return VIDEO_EXT.has(ext) || AUDIO_EXT.has(ext);
}

export function isIgnorable(filename, dirName) {
  const lower = filename.toLowerCase();
  if (lower.startsWith('.')) return true;
  if (IGNORED_BASENAMES.has(lower)) return true;
  if (IGNORED_EXTS.has(extensionOf(lower))) return true;
  if (/\.(sample|trailer|teaser)\b/i.test(lower)) return false; // keep, flagged later
  const dir = (dirName || '').toLowerCase();
  if (dir === '@eaDir' || dir === '#recycle' || dir === '$recycle.bin' || dir.startsWith('.')) return true;
  return false;
}

function extensionOf(filename) {
  const m = /\.([A-Za-z0-9]{1,6})$/.exec(filename);
  return m ? m[1].toLowerCase() : '';
}

const QUALITY = [
  [/\b(2160p|4K|UHD)\b/i, '4K'],
  [/\b(1080p|FHD)\b/i, '1080p'],
  [/\b(720p|HD)\b/i, '720p'],
  [/\b(480p|SD|576p)\b/i, '480p'],
];
const SOURCE_KIND = [
  [/\b(BLU-?RAY|BRRip|BDRip|REMUX)\b/i, 'BluRay'],
  [/\b(WEB-?DL|WEBRip|WEB-?DL|WEB)\b/i, 'WEB-DL'],
  [/\bHDTV\b/i, 'HDTV'],
  [/\b(DVDRip|DVD-R|DVD)\b/i, 'DVD'],
  [/\bHDRip\b/i, 'HDTV'],
];
const CODEC = [
  [/\b(x264|H[.\s]?264|AVC)\b/i, 'H.264'],
  [/\b(x265|H[.\s]?265|HEVC)\b/i, 'H.265'],
  [/\bAV1\b/i, 'AV1'],
  [/\bVP9\b/i, 'VP9'],
];
const EDITION = [
  [/\bdirector[\s.'’]*s?\s*cut\b/i, "Director's Cut"],
  [/\b(extended\s*(cut|edition))\b/i, 'Extended'],
  [/\b(theatrical\s*(cut|version))\b/i, 'Theatrical'],
  [/\b(imax\s*(enhanced)?)\b/i, 'IMAX'],
  [/\b(remaster(ed)?)\b/i, 'Remastered'],
  [/\b(uncut)\b/i, 'Uncut'],
  [/\b(4k\s*remaster)\b/i, '4K Remaster'],
];
const LANGS = [
  [/\b(AR|Arabic|عربي|العربية)\b/i, 'ar'],
  [/\b(EN|Eng|English|إنجليزي)\b/i, 'en'],
  [/\b(FR|French|فرنسي)\b/i, 'fr'],
  [/\b(JA|JP|JAP|Japanese|ياباني)\b/i, 'ja'],
  [/\b(KO|Korean|كوري)\b/i, 'ko'],
  [/\b(ES|Spanish|إسباني)\b/i, 'es'],
];
const SUB_MARKERS = /\b(WS|Sub(s|bed)?|Arabic\s*Sub|مترجم|ثانوية|Eng\s*Sub)\b|\bMulti[- ]?Sub\b/i;

/**
 * @param {string} filename e.g. "The.Matrix.1999.2160p.x265.10bit.HDR.ENG.ARB.SUB.mkv"
 * @param {{dirName?: string, parentDirs?: string[]}} [ctx] directory context improves episode parsing
 */
export function parseFilename(filename, ctx = {}) {
  const base = filename.replace(/[\\/:*?"<>|]+/g, ' ');
  const ext = extensionOf(base);
  const name = base.replace(/\.[A-Za-z0-9]{1,6}$/, '');

  const out = {
    originalFilename: filename,
    extension: ext,
    container: containerOf(ext),
    isVideo: VIDEO_EXT.has(ext),
    isAudio: AUDIO_EXT.has(ext),
    year: null,
    season: null,
    episode: null,
    episodes: [],
    title: null,
    titleParts: [],
    quality: null,
    sourceKind: null,
    codec: null,
    audio: [],
    hasSubtitles: false,
    languages: [],
    edition: null,
    releaseGroup: null,
    isEpisode: false,
    probableType: null, // movie | episode
    vNumber: null,
  };

  // separators normalization
  const work = name.replace(/[._]+/g, ' ').replace(/\s+/g, ' ').trim();

  // [release group] prefix (anime style): [SubsPlease] Show - 05 (1080p)
  const bracketGroup = /^\[([^\]]+)\]\s*/.exec(work);
  let body = work;
  if (bracketGroup) {
    out.releaseGroup = bracketGroup[1].trim();
    body = work.slice(bracketGroup[0].length);
  }

  // quality
  for (const [re, v] of QUALITY) if (re.test(body)) { out.quality = v; break; }
  for (const [re, v] of SOURCE_KIND) if (re.test(body)) { out.sourceKind = v; break; }
  for (const [re, v] of CODEC) if (re.test(body)) { out.codec = v; break; }
  for (const [re, v] of EDITION) if (re.test(body)) { out.edition = v; break; }
  if (SUB_MARKERS.test(body)) out.hasSubtitles = true;

  const audioRe = /\b(AAC|AC-?3|E-?AC-?3|DDP?5\.1|DTS[- ]?HD|DTS|TrueHD|Atmos|MP3|FLAC|Opus|5\.1|7\.1|2\.0)\b/gi;
  let am;
  while ((am = audioRe.exec(body))) {
    const v = am[1].toUpperCase().replace(/[-\s]/g, '');
    if (!out.audio.includes(v)) out.audio.push(v);
  }

  // languages
  for (const [re, code] of LANGS) if (re.test(body)) {
    if (!out.languages.includes(code)) out.languages.push(code);
  }

  // version tag like (1) / v2 — anime
  const vtag = /\b(?:\((\d{1,2})\)|v(\d+))\s*(?=\[|$)/.exec(body);
  if (vtag) out.vNumber = Number(vtag[1] || vtag[2]);

  // season/episode patterns
  const dirHints = ctx.parentDirs || (ctx.dirName ? [ctx.dirName] : []);
  const seasonFromDir = dirHints.map((d) => /\b(?:season|staffel| الموسم|الموسم)\s*[._ -]?(\d{1,2})\b/i.exec(d) || /\bS(\d{1,2})\b/.exec(d))
    .filter(Boolean).map((m) => Number(m[1])).find((n) => n >= 0 && n <= 50);

  let epMatch = null;
  const patterns = [
    /\bS(\d{1,2})\s*E(\d{1,3})\b/i,                 // S01E02
    /\bS(\d{1,2})\s*[\s.-]\s*E(?:pisode)?\s*(\d{1,3})\b/i, // S01 - 02
    /\b(\d{1,2})\s*[xX]\s*(\d{1,3})\b/,             // 1x02
    /\bSeason\s*(\d{1,2})\s*Episode\s*(\d{1,3})\b/i,
    /\bالموسم\s*(\d+)\s*الحلقة\s*(\d+)\b/,           // Arabic: الموسم 2 الحلقة 5
    /\bEpisode\s*(\d{1,3})\b/i,
  ];
  for (const re of patterns) {
    const m = re.exec(body);
    if (m) {
      epMatch = m;
      if (m[2] !== undefined) {
        out.season = Number(m[1]);
        out.episode = Number(m[2]);
      } else {
        out.episode = Number(m[1]);
        if (seasonFromDir !== undefined) out.season = seasonFromDir;
        else out.season = 1;
      }
      break;
    }
  }
  // anime "[group] Title - 05" or "Title - 007"
  if (!epMatch) {
    const dashEp = /\s-\s(\d{1,3})((?:\s*(?:\[[^\]]*\]|\([^)]*\)))*)$/;
    const m = dashEp.exec(body);
    const seriesContext = seasonFromDir !== undefined
      || /(?:episode|ep|المسلسل|أنمي)/i.test(dirHints.join(' ') + ' ' + name);
    const animeContext = !!bracketGroup || !!out.quality || out.vNumber !== null;
    if (m && (seriesContext || (animeContext && Number(m[1]) <= 999))) {
      out.episode = Number(m[1]);
      out.season = seasonFromDir ?? 1;
      out.isEpisode = true;
      out.probableType = 'episode';
      body = body.slice(0, m.index);
    }
  }
  // season-only
  if (out.season === null) {
    const m = /\bS(\d{1,2})\b(?!\d)/.exec(body);
    if (m) out.season = Number(m[1]);
    else if (seasonFromDir !== undefined) out.season = seasonFromDir;
  }

  if (out.episode !== null) {
    out.isEpisode = true;
    out.probableType = 'episode';
    if (epMatch) {
      // multi-episode like E03-E05 or 03-05
      const multi = /E(\d{1,3})\s*[-–]\s*E?(\d{1,3})/i.exec(body);
      if (multi) out.episodes = [Number(multi[1]), Number(multi[2])];
    }
  } else {
    out.probableType = 'movie';
  }

  // year: last standalone 19xx/20xx not part of episode; also (2010) style
  const yearMatches = [...body.matchAll(/\b(19\d{2}|20[0-3]\d)\b/g)];
  if (yearMatches.length) {
    // prefer year in trailing parentheses or at end
    const paren = /\((19\d{2}|20[0-3]\d)\)\s*(?:\[[^\]]*\])?\s*$/.exec(body);
    const chosen = paren ? paren[1] : yearMatches[yearMatches.length - 1][1];
    out.year = Number(chosen);
  }

  // title extraction: strip release tokens, years, ep codes, groups
  let title = body
    .replace(/\bS\d{1,2}\s*E\d{1,3}\b/gi, ' ')
    .replace(/\b\d{1,2}[xX]\d{1,3}\b/g, ' ')
    .replace(/\bالموسم\s*\d+\s*الحلقة\s*\d+\b/g, ' ')
    .replace(/\bEpisode\s*\d{1,3}\b/gi, ' ')
    .replace(/\b\d{1,3}\s*[-–]\s*\d{1,3}\b(?=\s*$|\s*\[)/g, ' ')
    .replace(/\s-\s\d{1,3}(?:\(\d{1,2}\))?(?=\s*(\[|$))/g, ' ')
    .replace(/\b(19\d{2}|20[0-3]\d)\b/g, ' ')
    .replace(/\b(2160p|1080p|720p|480p|4K|UHD|FHD|HD|SD|BluRay|BRRip|BDRip|REMUX|WEB-?DL|WEBRip|HDTV|HDRip|DVDRip|DVD)\b/gi, ' ')
    .replace(/\b(x264|x265|H[.\s]?264|H[.\s]?265|AVC|HEVC|AV1|VP9|10-?bit|8-?bit|HDR10\+?|HDR|SDR|DoVi|Dolby[\s.]?Vision)\b/gi, ' ')
    .replace(/\b(AAC|AC-?3|E-?AC-?3|DDP?5\.1|DTS[- ]?HD|DTS|TrueHD|Atmos|MP3|FLAC|Opus|5\.1|7\.1|2\.0)\b/gi, ' ')
    .replace(/\b(Director'?s\s*Cut|Extended\s*(Cut|Edition)?|Theatrical|Remastered?|Uncut|IMAX(\s*Enhanced)?|V\d)\b/gi, ' ')
    .replace(/\[.*?\]/g, ' ')
    .replace(/\(.*?\)/g, ' ')
    .replace(/[|]+/g, ' ')
    .replace(/\bdirector[\s.'’]*s?\s*cut\b/gi, ' ')
    .replace(/-+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // dash-suffixed release group: "Show Title -GROUP" / "Title - GROUP"
  const dg = /(?:\s|-)([A-Z][A-Z0-9]{2,11})$/.exec(title);
  if (dg && !out.isEpisode) {
    out.releaseGroup = out.releaseGroup || dg[1];
    title = title.slice(0, dg.index).trim();
  } else if (dg && /\s-\s?\d{1,3}$/.test(dg[1]) === false) {
    // episodes: only strip when clearly a group token (not a number)
  }

  // release group trailing token (ALLCAPS short word at the end)
  const tWords = title.split(' ');
  if (tWords.length > 1) {
    const last = tWords[tWords.length - 1];
    if (/^[A-Z][A-Z0-9]{2,11}$/.test(last)) {
      out.releaseGroup = out.releaseGroup || last;
      tWords.pop();
      title = tWords.join(' ').trim();
    }
  }

  out.title = title || name.trim() || filename;
  out.titleParts = title.split(/\s+/).filter(Boolean);
  return out;
}

function containerOf(ext) {
  const map = { mp4: 'MPEG-4', mkv: 'Matroska', avi: 'AVI', mov: 'QuickTime', wmv: 'WMV',
    flv: 'Flash Video', webm: 'WebM', m4v: 'MPEG-4 Video', ts: 'MPEG-TS', m2ts: 'BluRay TS',
    mp3: 'MP3', flac: 'FLAC', m4a: 'M4A', aac: 'AAC', ogg: 'Ogg', opus: 'Opus', wav: 'WAV' };
  return map[ext] || (ext ? ext.toUpperCase() : null);
}

/** Normalized title for matching/dedup (Arabic-safe). */
export function normalizeTitle(t) {
  if (!t) return '';
  return String(t)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    // Arabic normalization: أ إ آ -> ا, ة -> ه, ى -> ي, remove tashkeel
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي');
}
