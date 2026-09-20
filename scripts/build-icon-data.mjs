/**
 * build-icon-data.mjs — vendors the zPopcorn icon language into src/js/ui/icon-data.generated.js
 * Sources: @phosphor-icons/core (static family) + @hugeicons/core-free-icons (bold/large accents).
 * Run: node scripts/build-icon-data.mjs   (only when the map below changes)
 * The generated file is committed — the app never reads node_modules at runtime.
 */
import fs from 'node:fs';
import path from 'node:path';

const PH_BASE = 'node_modules/@phosphor-icons/core/assets';
const HU_BASE = 'node_modules/@hugeicons/core-free-icons/dist/esm';

/* app icon name → phosphor glyph (weights per usage policy:
   light/thin = sidebar & secondary · regular = standard controls
   bold = important actions · duotone = special visual states)      */
const MAP = {
  home: ['house'],
  explore: ['compass', 'thin'],
  compass: ['compass', 'thin'],
  film: ['film-strip', 'fill'],
  movie: ['film-strip'],
  tv: ['television'],
  series: ['monitor-play', 'tv'],
  anime: ['sparkle'],
  sparkle: ['sparkle'],
  library: ['books'],
  search: ['magnifying-glass'],
  filter: ['funnel'],
  sort: ['sort-ascending'],
  grid: ['squares-four'],
  list: ['list'],
  rows: ['rows'],
  menu: ['list'],
  more: ['dots-three'],
  chevL: ['caret-left'],
  chevR: ['caret-right'],
  chevD: ['caret-down'],
  chevU: ['caret-up'],
  arrowL: ['arrow-left'],
  arrowR: ['arrow-right'],
  expand: ['arrows-out'],
  collapse: ['arrows-in'],
  play: ['play', 'fill'],
  playCircle: ['play-circle'],
  pause: ['pause', 'fill'],
  disc: ['disc'],
  monitor: ['monitor'],
  cast: ['screencast'],
  image: ['image'],
  hd: ['high-definition'],
  subtitle: ['subtitles'],
  episodes: ['monitor-play'],
  seasons: ['calendar-check'],
  calendar: ['calendar-blank'],
  clock: ['clock'],
  duration: ['timer'],
  rating: ['star'],
  star: ['star', 'fill'],
  language: ['translate'],
  folder: ['folder-simple'],
  folderOpen: ['folder-open'],
  import: ['tray-arrow-down'],
  export: ['tray-arrow-up'],
  download: ['download-simple'],
  upload: ['upload-simple'],
  scan: ['barcode'],
  snap: ['camera'],
  drive: ['hard-drive'],
  layers: ['stack'],
  live: ['broadcast'],
  guide: ['calendar-dots'],
  sources: ['plugs-connected'],
  signal: ['cell-tower'],
  collection: ['bookmarks'],
  dup: ['copy'],
  metadata: ['tag'],
  archive: ['archive'],
  refresh: ['arrows-clockwise'],
  plus: ['plus'],
  minus: ['minus'],
  add: ['plus'],
  remove: ['minus'],
  check: ['check'],
  x: ['x'],
  close: ['x'],
  heart: ['heart'],
  favorite: ['heart'],
  heartFill: ['heart'],
  bookmark: ['bookmark'],
  bookmarkFill: ['bookmark'],
  match: ['crosshair'],
  edit: ['pencil-simple'],
  delete: ['trash-simple'],
  trash: ['trash-simple'],
  save: ['floppy-disk'],
  share: ['share-network'],
  external: ['arrow-square-out'],
  pin: ['map-pin'],
  eye: ['eye'],
  eyeOff: ['eye-slash'],
  info: ['info'],
  information: ['info'],
  history: ['clock-counter-clockwise'],
  gear: ['gear'],
  settings: ['gear'],
  slider: ['sliders-horizontal'],
  sliders: ['sliders-horizontal'],
  palette: ['palette'],
  theme: ['circle-half'],
  appearance: ['sun'],
  sun: ['sun'],
  moon: ['moon'],
  storage: ['database'],
  cache: ['hard-drives'],
  backup: ['shield-check'],
  updates: ['arrow-counter-clockwise'],
  power: ['power'],
  bell: ['bell'],
  key: ['key'],
  lock: ['lock'],
  shield: ['shield-check'],
  terminal: ['terminal-window'],
  bolt: ['lightning'],
  wifi: ['wifi-high'],
  wifiOff: ['wifi-slash'],
  alert: ['warning-circle'],
  warning: ['warning'],
  error: ['x-circle'],
  success: ['check-circle'],
  loading: ['circle-notch'],
  bulb: ['lightbulb'],
  robot: ['robot'],
  chart: ['chart-bar'],
  globe: ['globe'],
  users: ['users-four'],
  award: ['medal'],
  type: ['text-t'],
  inbox: ['tray'],
  database: ['database'],
};
/* names rendered filled (use the fill weight of the mapped glyph) */
const FILLED = new Set(['heartFill', 'bookmarkFill', 'star']);

/* curated Hugeicons — only for large, prominent, high-impact elements */
const HUGE = {
  play: 'PlayIcon',
  playCircle: 'PlayCircleIcon',
  movie: 'Film01Icon',
  discover: 'DiscoverCircleIcon',
  grid: 'GridViewIcon',
  list: 'ListViewIcon',
  search: 'Search01Icon',
  noresult: 'Search01Icon',
  download: 'Download01Icon',
  folder: 'Folder01Icon',
  archive: 'ArchiveIcon',
  database: 'DatabaseIcon',
  clock: 'Clock01Icon',
  calendar: 'Calendar01Icon',
  heart: 'HeartIcon',
  star: 'StarIcon',
  user: 'UserIcon',
  settings: 'Settings01Icon',
  video: 'AiVideo01Icon',
  box: 'PackageIcon',
};

/* weight budget (keeps bundle lean — the registers each name actually uses):
   every glyph embeds regular + light (sidebar/tier), bold only for CTA
   candidates, duotone only for state candidates, fill only for filled pair. */
const BOLD_SET = new Set(['play', 'scan', 'chevL', 'chevR', 'download', 'share', 'plus', 'add', 'check', 'x', 'refresh', 'heart', 'bookmark', 'search', 'edit', 'delete', 'trash']);
const DUO_SET = new Set(['home', 'compass', 'film', 'tv', 'series', 'anime', 'sparkle', 'library', 'database', 'search', 'heart', 'bookmark', 'clock', 'history', 'gear', 'settings', 'inbox', 'tray', 'info', 'success', 'error', 'warning', 'alert', 'circle-notch', 'check-circle', 'warning-circle', 'arrows-clockwise', 'tray-arrow-down', 'folderOpen', 'scan', 'loading', 'layers', 'collection', 'star', 'play']);
const kebab = (s) => s.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
const BRAND_LOGO = '<path d="M7 10.5C6 9.8 6 8 7.2 7.2 8.4 6.4 10 7 10.4 8.2c.6-1.4 2.4-1.8 3.6-.8 1.2.9 1.2 2.7.1 3.5"/><path d="M6.8 10.8h10.4l-1.1 8a1.8 1.8 0 0 1-1.8 1.6H9.7a1.8 1.8 0 0 1-1.8-1.6zM9.4 13.5v4.2M12 13v4.8M14.6 13.5v4.2"/>';

function phInner(weight, base) {
  const suffix = weight === 'regular' ? '' : '-' + weight;
  const f = path.join(PH_BASE, weight, base + suffix + '.svg');
  if (!fs.existsSync(f)) return null;
  const svg = fs.readFileSync(f, 'utf8');
  return svg.replace(/^[\s\S]*?>/, '').replace(/<\/svg>\s*$/, '').trim();
}
function huInner(iconName) {
  const f = path.join(HU_BASE, iconName + '.js');
  if (!fs.existsSync(f)) return null;
  const src = fs.readFileSync(f, 'utf8');
  // const X = [ ["path", { d: "...", ...}], ... ];
  const m = src.match(/=\s*(\[[\s\S]*?\])\s*;\s*\n/);
  if (!m) return null;
  const arr = eval(m[1]); // build-time trusted data from node_modules
  return arr.map(([tag, at]) =>
    `<${tag} ${Object.entries(at).filter(([k]) => k !== 'key').map(([k, v]) => `${kebab(k)}="${v}"`).join(' ')}/>`
  ).join('');
}

const esc = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
let out = `/* GENERATED by scripts/build-icon-data.mjs — zPopcorn icon language data.
   Phosphor® (MIT) static glyphs vendored per-weight; Hugeicons® (free set) vendored
   for large-format accents. Do not edit by hand; rerun the builder instead. */
export const PH = {`;
const warns = [];
for (const [name, [base, extra]] of Object.entries(MAP)) {
  const entry = {};
  const want = FILLED.has(name)
    ? ['fill']
    : ['regular', 'light', ...(BOLD_SET.has(name) ? ['bold'] : []), ...(DUO_SET.has(name) ? ['duotone'] : [])];
  for (const w of want) {
    const inner = phInner(w, base);
    if (inner) entry[w] = inner;
    else if (w === 'regular') { warns.push(`${name}: missing regular ${base}`); }
  }
  if (FILLED.has(name) && entry.fill) entry.regular = entry.fill; // bare name stays outline? no — filled variant wins for that name
  if (!entry.regular) { warns.push(`${name}: NO GLYPH (${base})`); continue; }
  out += `,\n  ${name}: {${Object.entries(entry).map(([w, d]) => `${w}: '${esc(d)}'`).join(', ')}}`;
}
out += `\n};\nexport const HU = {`;
for (const [name, hn] of Object.entries(HUGE)) {
  const inner = huInner(hn);
  if (!inner) { warns.push(`huge ${name}: ${hn} missing`); continue; }
  out += `,\n  ${name}: '${esc(inner)}'`;
}
out += `\n};\n`;
out += '\n/** zPopcorn brand mark — proprietary, 24 grid, stroke-based (never replaced by a library) */\nexport const BRAND = { logo: ' + "'" + esc(BRAND_LOGO) + "'" + ' };\n';
out = out.replace('{,\n', '{\n').replace('{,\n', '{\n');
fs.writeFileSync('src/js/ui/icon-data.generated.js', out);
console.log('wrote src/js/ui/icon-data.generated.js —',
  (fs.statSync('src/js/ui/icon-data.generated.js').size / 1024).toFixed(1) + 'KB');
console.log(warns.length ? 'WARNINGS:\n' + warns.join('\n') : 'no warnings ✓');
