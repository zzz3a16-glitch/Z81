/**
 * zPopcorn shared filter system (directive §11/§12/§10/§41).
 * One discover-criteria panel reused by Movies/TV (and any future type).
 * Law: the panel NEVER runs a query by itself — it only calls onRun() when the
 * user presses البحث with at least one explicit criterion (no endless auto-load).
 */
import { el, esc } from './primitives.js';
import { icon } from './icons.js';

/* Full ISO-639-1 set rendered in Arabic via Intl — §41 (no truncation, no English-only names). */
const LANG_CODES = ('aa ab ae af ak am ar as av ay az ba be bg bi bm bn bo br bs ca ce ch co cr cs cu cv cy da de dv dz ee el en eo es et eu fa ff fi fj fo fr fy ga gd gl gn gu gv ha he hi ho hr ht hu hy hz ia id ie ig ii ik is it iu ja jv ka kg ki kj kk km kn ko kr ks ku kv kw ky la lg li ln lo lt lu lv mg mh mi mk ml mn mr ms mt my na nb nd ne ng nl nn no nr nv ny oc oj om or os pa pi pl ps pt qu rm rn ro ru rw sa sc sd se sg si sk sl sm sn so sq sr ss st su sv sw ta te tg th ti tk tl tn to tr ts tt tw ug uk ur uz ve vi vo wa wo xh yi yo za zh zu').split(' ');
export function languageOptions() {
  let dn = null;
  try { dn = new Intl.DisplayNames(['ar'], { type: 'language' }); } catch { /* Intl lacks ar type */ }
  return LANG_CODES.map((code) => {
    let name = code;
    try { name = (dn && dn.of(code)) || code; } catch { /* some codes unmapped */ }
    return { code, name };
  });
}
/* Region subset for the country filter, Arabic-localized. */
const REGION_CODES = 'AE AR AT AU BA BE BH BD BO BR CA CH CL CN CO DE DZ EG ES FI FR GB GE GR HK HN HU ID IE IL IN IQ IR IS IT JO JP KR LB LY MA MX NG NL NO OM PE PL PT QA RO RS RU SA SD SE SY TH TN TR TW UA US UY YE ZA'.split(' ');
export function regionOptions() {
  let dn = null;
  try { dn = new Intl.DisplayNames(['ar'], { type: 'region' }); } catch { /* noop */ }
  return REGION_CODES.map((code) => {
    let name = code;
    try { name = (dn && dn.of(code)) || code; } catch { /* noop */ }
    return { code, name };
  });
}

const SORTS = [
  ['popularity.desc', 'الأكثر رواجاً'],
  ['vote_average.desc', 'الأعلى تقييماً'],
  ['vote_count.desc', 'الأكثر تصويتاً'],
  ['primary_release_date.desc', 'الأحدث إصداراً'],
  ['primary_release_date.asc', 'الأقدم إصداراً'],
  ['original_title.asc', 'أبجدياً'],
];

/**
 * @param {object} o
 * @param {'movie'|'tv'} o.mediaType
 * @param {Array<{id:number,name:string}>} [o.genres] - optional genre list (else hidden)
 * @param {(params: object) => void} o.onRun - called ONLY on explicit search press
 * @param {() => void} [o.onCancel]
 */
export function discoverPanel({ mediaType, genres = [], networks = [], onRun, onCancel }) {
  const root = el('div', 'z-disco');
  const yearA = numInput('year', 1900, 2100, 'yyyy');
  const yearB = numInput('year', 1900, 2100, 'yyyy');
  const minRate = numInput('number', 0, 10, '0.0 – 10');
  const minVotes = selectInput([['', 'أي عدد تصويتات'], ['50', '50+'], ['250', '250+'], ['500', '500+'], ['1000', '1000+']]);
  const sort = selectInput([['', 'الترتيب: رواج'], ...SORTS]);
  const lang = selectInput([['', 'كل اللغات'], ...languageOptions().map((l) => [l.code, l.name])], true);
  const region = selectInput([['', 'كل الدول'], ...regionOptions().map((r) => [r.code, r.name])], true);
  const genreSel = genres.length
    ? selectInput([['', 'كل الأنواع'], ...genres.map((g) => [String(g.id), g.name])], true)
    : null;
  const STATUS = mediaType === 'movie'
    ? [['', 'الحالة: الكل'], ['released', 'صدر'], ['upcoming', 'قريباً']]
    : [['', 'الحالة: الكل'], ['0', 'يعرض الآن'], ['1', 'مُخطط'], ['2', 'ملغى'], ['4', 'انتهى']];
  const statusSel = selectInput(STATUS, true);
  const netSel = networks.length
    ? selectInput([['', 'كل الشبكات'], ...networks.map((n) => [String(n.id), n.name])], true)
    : null;

  const fields = [
    ['سنة من', yearA], ['سنة إلى', yearB], ['تقييم أدنى', minRate], ['تصويتات أدنى', minVotes],
    ['الترتيب', sort], ['الحالة', statusSel], ['اللغة', lang], ['الدولة', region],
  ];
  if (genreSel) fields.push(['النوع', genreSel]);
  if (netSel) fields.push(['الشبكة', netSel]);

  const grid = el('div', 'z-disco-grid');
  grid.innerHTML = fields.map(([label, node]) => `<div class="f"><label>${esc(label)}</label></div>`).join('');
  grid.querySelectorAll('.f').forEach((f, i) => f.appendChild(fields[i][1]));

  const runBtn = el('button', 'btn btn-primary btn-sm', `${icon('search', 14)} بحث`);
  const clearBtn = el('button', 'btn btn-tertiary btn-sm', 'تفريغ');
  runBtn.disabled = true;
  const anyCriterion = () => [yearA, yearB, minRate, minVotes, lang, region, genreSel, sort, statusSel, netSel]
    .some((c) => c && c.value !== '');
  const refresh = () => { runBtn.disabled = !anyCriterion(); };
  [yearA, yearB, minRate, minVotes, lang, region, genreSel, sort, statusSel, netSel].forEach((c) => c && c.addEventListener('input', refresh));

  runBtn.addEventListener('click', () => {
    if (runBtn.disabled) return;
    const p = {};
    if (yearA.value) p[mediaType === 'movie' ? 'primary_release_date.gte' : 'first_air_date.gte'] = `${yearA.value}-01-01`;
    if (yearB.value) p[mediaType === 'movie' ? 'primary_release_date.lte' : 'first_air_date.lte'] = `${yearB.value}-12-31`;
    if (minRate.value) p['vote_average.gte'] = Math.max(0, Math.min(10, +minRate.value));
    if (minVotes.value) p['vote_count.gte'] = +minVotes.value;
    if (lang.value) p.with_original_language = lang.value;
    if (region.value) { p.watch_region = region.value; p.with_original_country = region.value; }
    if (genreSel && genreSel.value) p.with_genres = genreSel.value;
    if (netSel && netSel.value) p.with_networks = netSel.value;
    if (sort.value) p.sort_by = sort.value;
    if (statusSel.value) {
      if (mediaType === 'movie') {
        if (statusSel.value === 'released') p['primary_release_date.lte'] = new Date().toISOString().slice(0, 10);
        else p['primary_release_date.gte'] = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
      } else p.with_status = statusSel.value;
    }
    onRun(p);
  });
  clearBtn.addEventListener('click', () => {
    [yearA, yearB, minRate, minVotes, lang, region, genreSel, sort, statusSel, netSel].forEach((c) => c && (c.value = ''));
    refresh();
    onCancel && onCancel();
  });
  const bar = el('div', 'z-disco-bar');
  bar.append(runBtn, clearBtn);
  root.append(grid, bar);
  return { root };
}

function numInput(type, min, max, ph) {
  const i = el('input', 'input input-sm');
  i.type = type; i.min = min; i.max = max; i.placeholder = ph;
  i.style.maxWidth = '92px';
  return i;
}
function selectInput(pairs, wide = false) {
  const s = el('select', 'input input-sm');
  if (!wide) s.style.maxWidth = '170px';
  for (const [v, t] of pairs) {
    const o = document.createElement('option');
    o.value = v; o.textContent = t; s.appendChild(o);
  }
  return s;
}
