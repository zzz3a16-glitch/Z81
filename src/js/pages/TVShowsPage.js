/**
 * TVShowsPage v4 — same composition language as Movies, tuned for series (spec 19).
 */
import { tmdbClient } from '../services/tmdb/TMDBClient.js';
import { db } from '../services/storage/Database.js';
import { createMediaCard, createSkeletonGrid } from '../components/MediaCard.js';
import { el, section, railEl, emptyState, errorState } from '../ui/primitives.js';

import { icon } from '../ui/icons.js';

const TABS = [
  ['popular', 'الأشهر'],
  ['airing_today', 'يعرض اليوم'],
  ['top_rated', 'الأعلى تقييماً'],
  ['on_the_air', 'في الهواء'],
];

export async function TVShowsPage(params = {}, query = {}) {
  const page = el('div', 'z-page-tv');
  page.innerHTML = `
    <header class="page-header" style="padding-bottom: var(--sp-3)">
      <h1 class="page-title">مسلسلات</h1>
      <p class="page-subtitle">تتبّع الحلقات القادمة وموعد عرضها، من مكتبتك أنت.</p>
    </header>
    <div id="tv-lib"></div>
    <div class="container">
      <div style="display:flex;gap: var(--sp-2);flex-wrap:wrap;margin-bottom: var(--sp-5)">
        ${TABS.map(([id, label]) => `<button class="chip ${id === (query.tab || 'popular') ? 'active' : ''}" data-tab="${id}">${label}</button>`).join('')}
      </div>
      <h2 style="font-size:var(--text-xl);font-weight:800;margin-bottom: var(--sp-4)" id="tv-grid-title">الأشهر</h2>
      <div id="tv-grid" class="media-grid"></div>
      <div style="display:flex;justify-content:center;padding: var(--sp-6) 0 var(--sp-2)">
        <button class="btn btn-secondary btn-sm" id="tv-more" style="display:none">${icon('download', 14)} تحميل المزيد</button>
      </div>
    </div>`;

  let tab = query.tab || 'popular';
  let p_ = 1, acc = [];
  const grid = page.querySelector('#tv-grid');
  const title = page.querySelector('#tv-grid-title');
  const more = page.querySelector('#tv-more');

  loadMyShows(page.querySelector('#tv-lib'));

  async function load(reset) {
    if (reset) { p_ = 1; acc = []; createSkeletonGrid(grid, 12); }
    try {
      const res = await tmdbClient.request(`tv/${tab}`, { page: p_ });
      const rows = (res?.results || []).filter((m) => m.poster_path);
      acc = [...acc, ...rows];
      grid.innerHTML = '';
      acc.forEach((m) => grid.appendChild(createMediaCard({ ...m, media_type: 'tv' }, { variant: 'poster' })));
      more.style.display = res?.total_pages > p_ ? 'inline-flex' : 'none';
      if (!acc.length) grid.appendChild(emptyState({ iconName: 'tv', title: 'لا نتائج — تحقق من الاتصال أو جرّب تبويباً آخر' }));
    } catch (e) {
      grid.innerHTML = '';
      grid.appendChild(errorState({ onRetry: () => load(true) }));
    }
  }

  page.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
    page.querySelectorAll('[data-tab]').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    tab = b.dataset.tab;
    title.textContent = TABS.find(([id]) => id === tab)?.[1];
    load(true);
  }));
  more.addEventListener('click', () => { p_++; load(false); });

  await load(true);
  return page;
}

async function loadMyShows(mount) {
  let rows = [];
  try {
    rows = (await db.getAll('tvshows', 500).catch(() => [])) || [];
    rows = [...rows].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0)).slice(0, 18);
  } catch { rows = []; }
  if (!rows.length) return;
  const s = section({ title: 'مسلسلاتي', subtitle: `${rows.length} مسلسل — مع حالة الموسم القادم عند توفر الشبكة`, wide: true, action: { label: 'كل المكتبة' } });
  s.head.querySelector('.more').addEventListener('click', () => window.router.navigate('/library'));
  const cards = rows.map((m) => createMediaCard({ ...m, media_type: 'tv', inLibrary: true }, { variant: 'wide' }));
  const { wrap } = railEl(cards, { snapCards: 'clamp(280px, 25vw, 340px)' });
  s.body.appendChild(wrap);
  mount.appendChild(s.root);

  // next-episode badges for library shows (quiet enrichment, cache-first)
  (async () => {
    for (const m of rows.slice(0, 6)) {
      try {
        const d = await tmdbClient.getTV(m.id || m.key, ['']);
        const ep = d?.next_episode_to_air;
        if (ep) {
          const card = cards.find((c) => c.__media && String(c.__media.id) === String(m.id || m.key));
          if (card) {
            const sub = card.querySelector('.sub');
            if (sub) sub.insertAdjacentHTML('beforeend',
              `<span class="z-pill z-pill-ok" style="height:18px">الحلقة ${ep.episode_number} ${ep.air_date ? '· ' + ep.air_date.slice(5, 10) : ''}</span>`);
          }
        }
      } catch { /* offline: skip quietly */ }
    }
  })();
}
