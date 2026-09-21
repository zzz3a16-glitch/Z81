/**
 * MoviesPage v4 — a composed page, not a grid dump (spec 18).
 * Hierarchy: My Movies (library) → featured rails → filtered discovery grid.
 */
import { tmdbClient } from '../services/tmdb/TMDBClient.js';
import { db } from '../services/storage/Database.js';
import { createMediaCard } from '../components/MediaCard.js';
import { createSkeletonGrid } from '../components/MediaCard.js';
import { el, esc, section, railEl, skelRail, errorState, emptyState, paintError } from '../ui/primitives.js';
import { icon } from '../ui/icons.js';
import { discoverPanel } from '../ui/filters.js';

const TABS = [
  ['popular', 'الأكثر رواجاً'],
  ['now_playing', 'يعرض الآن'],
  ['top_rated', 'الأعلى تقييماً'],
  ['upcoming', 'قريباً'],
  ['discover', 'استكشاف متقدم'],
];

export async function MoviesPage(params = {}, query = {}) {
  const page = el('div', 'z-page-movies');
  page.innerHTML = `
    <header class="page-header" style="padding-bottom: var(--sp-3)">
      <h1 class="page-title">أفلام</h1>
      <p class="page-subtitle">مجموعتك المحلية أولاً — ثم اكتشاف العالم عند الحاجة.</p>
    </header>
    <div id="mv-lib"></div>
    <div class="container" id="mv-filters">
      <div style="display:flex;gap: var(--sp-2);flex-wrap:wrap;align-items:center">
        ${TABS.map(([id, label]) => `<button class="chip ${id === (query.tab || 'popular') ? 'active' : ''}" data-tab="${id}">${label}</button>`).join('')}
        <span style="flex:1"></span>
        <select class="input input-sm" id="mv-genre" style="width:170px" aria-label="تصفية بالنوع">
          <option value="">كل الأنواع</option>
        </select>
      </div>
    </div>
    <div class="container" style="margin-top: var(--sp-5)">
      <div id="mv-feature"></div>
      <div style="display:flex;align-items:baseline;gap: var(--sp-3);margin-bottom: var(--sp-4)">
        <h2 style="font-size:var(--text-xl);font-weight:800" id="mv-grid-title">الأكثر رواجاً</h2>
        <span style="font-size: var(--text-2xs);color:var(--color-text-muted)">من TMDB — تعمل من الكاش عند عدم الاتصال</span>
      </div>
      <div id="mv-grid" class="media-grid"></div>
      <div style="display:flex;justify-content:center;padding: var(--sp-7) 0 var(--sp-2)">
        <button class="btn btn-secondary btn-sm" id="mv-more" style="display:none">${icon('download', 14)} تحميل المزيد</button>
      </div>
    </div>`;

  let tab = query.tab || 'popular';
  let genreId = query.genre || '';
  let page_ = 1;
  let accumulated = [];
  let seq = 0; // race guard: stale tab/filter responses are dropped
  let discoParams = null; let disco = null; let genreList = [];
  const resultsWrap = page.querySelector('#mv-grid').parentElement;

  loadMyMovies(page.querySelector('#mv-lib'));

  const grid = page.querySelector('#mv-grid');
  const title = page.querySelector('#mv-grid-title');
  const more = page.querySelector('#mv-more');

  try {
    const genres = await tmdbClient.getGenres('movie').catch(() => []);
    genreList = genres?.genres || genres || [];
    const sel = page.querySelector('#mv-genre');
    genreList.forEach((g) => {
      const o = document.createElement('option');
      o.value = g.id; o.textContent = g.name;
      if (String(g.id) === String(genreId)) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', () => { genreId = sel.value; if (tab !== 'discover') loadGrid(true); else applyDiscover(); });
  } catch { /* offline without cached genres */ }

  function showDiscover() {
    resultsWrap.style.display = 'none';
    if (!disco) {
      disco = discoverPanel({
        mediaType: 'movie', genres: genreList,
        onRun: (p) => { discoParams = p; resultsWrap.style.display = ''; loadGrid(true, p); },
        onCancel: () => { discoParams = null; },
      });
      page.querySelector('#mv-feature').appendChild(disco.root);
    } else if (genreList.length) {
      const gs = page.querySelector('.z-disco select'); // keep panel in sync once built
      void gs;
    }
    if (discoParams) { resultsWrap.style.display = ''; loadGrid(true, discoParams); }
  }
  function applyDiscover() { if (discoParams) loadGrid(true, discoParams); }

  async function loadGrid(reset = false, extra = null) {
    const my = ++seq;
    if (reset) { page_ = 1; accumulated = []; createSkeletonGrid(grid, 12); }
    try {
      const p = { page: page_, with_genres: genreId || undefined, ...(extra || {}) };
      let res;
      if (tab === 'discover') {
        if (!extra && !discoParams) { grid.innerHTML = ''; more.style.display = 'none'; return; } // explicit-criteria law
        res = await tmdbClient.discover('movie', { sort_by: 'popularity.desc', ...p });
      } else {
        res = await tmdbClient.request(`movie/${tab}`, { page: page_ });
      }
      if (my !== seq) return; // a newer tab/filter switch superseded this response
      const results = (res?.results || []).filter((m) => m.poster_path);
      accumulated = [...accumulated, ...results];
      grid.innerHTML = '';
      accumulated.forEach((m) => grid.appendChild(createMediaCard({ ...m, media_type: 'movie' }, { variant: 'poster' })));
      more.style.display = (res?.total_pages > page_) ? 'inline-flex' : 'none';
      if (!accumulated.length) grid.appendChild(emptyState({ iconName: 'search', title: 'لا نتائج هنا — جرّب تبويباً آخر' }));
    } catch (e) {
      if (my !== seq) return;
      grid.innerHTML = '';
      grid.appendChild(errorState({ desc: e.message || 'تعذّر الوصول لـ TMDB — ستعود النتائج من الكاش عند توفر الشبكة.', onRetry: () => loadGrid(true, extra) }));
    }
  }

  page.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
    page.querySelectorAll('[data-tab]').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    tab = b.dataset.tab;
    title.textContent = TABS.find(([id]) => id === tab)?.[1] || 'أفلام';
    if (tab === 'discover') { showDiscover(); return; }
    resultsWrap.style.display = '';
    loadGrid(true);
  }));
  if (tab === 'discover') showDiscover();
  more.addEventListener('click', () => { page_++; loadGrid(false); });

  await loadGrid(true);
  loadFeature(page.querySelector('#mv-feature'), tab);
  return page;
}

async function loadFeature(mount, tab) {
  const s = section({ title: 'مختارات سريعة', wide: true });
  mount.appendChild(s.root);
  s.body.appendChild(skelRail(5, true));
  try {
    const res = await tmdbClient.trending('movie', 'week');
    const rows = (res?.results || []).filter((m) => m.backdrop_path).slice(0, 8);
    if (!rows.length) { s.root.remove(); return; }
    s.body.innerHTML = '';
    const { wrap } = railEl(rows.map((m) => createMediaCard({ ...m, media_type: 'movie' }, { variant: 'wide' })), { snapCards: 'clamp(300px, 28vw, 400px)' });
    s.body.appendChild(wrap);
  } catch { s.root.remove(); }
}

async function loadMyMovies(mount) {
  let rows = [];
  try {
    rows = (await db.getAll('movies', 500).catch(() => [])) || [];
    rows = [...rows].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0)).slice(0, 18);
  } catch { rows = []; }
  if (!rows.length) return;
  const s = section({ title: 'أفلامي', subtitle: `${rows.length} فيلم في مكتبتك — محلي أولاً`, wide: true, action: { label: 'كل المكتبة' } });
  s.head.querySelector('.more').addEventListener('click', () => window.router.navigate('/library'));
  const cards = rows.map((m) => createMediaCard({ ...m, media_type: 'movie', inLibrary: true }, { variant: 'wide' }));
  const { wrap } = railEl(cards, { snapCards: 'clamp(280px, 25vw, 340px)' });
  s.body.appendChild(wrap);
  mount.appendChild(s.root);
}
