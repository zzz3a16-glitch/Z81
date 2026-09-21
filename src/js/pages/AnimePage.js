/**
 * AnimePage v4 — an intentional anime experience (spec 20):
 * seasons/episodes-first, status + airing, studios, my-anime rail; not a movies clone.
 */
import { tmdbClient } from '../services/tmdb/TMDBClient.js';
import { db } from '../services/storage/Database.js';
import { createMediaCard, createSkeletonGrid } from '../components/MediaCard.js';
import { el, section, railEl, emptyState, errorState, fmtDateAr } from '../ui/primitives.js';
import { getTMDBImageUrl } from '../services/tmdb/TMDBImage.js';
import { icon } from '../ui/icons.js';
import { discoverPanel } from '../ui/filters.js';
import { rankedTop10 } from '../ui/ranked.js';

const SORTS = [
  ['popularity.desc', 'الأكثر رواجاً'],
  ['vote_average.desc', 'الأعلى تقييماً'],
  ['first_air_date.desc', 'الأحدث بثاً'],
  ['next_episode_to_air.desc', 'قريب من العرض'],
];

export async function AnimePage() {
  const page = el('div', 'z-page-anime');
  page.innerHTML = `
    <header class="page-header" style="padding-bottom: var(--sp-3)">
      <h1 class="page-title">أنمي</h1>
      <p class="page-subtitle">مواسم وحلقات ومواعيد بث — كل ما يهم متابع الأنمي حقاً.</p>
    </header>
    <div id="an-top10"></div>
    <div id="an-airing"></div>
    <div id="an-lib"></div>
    <div class="container" style="margin-bottom: var(--sp-4)">
      <div style="display:flex;gap: var(--sp-2);flex-wrap:wrap;align-items:center">
        ${SORTS.map(([v, l], i) => `<button class="chip ${i === 0 ? 'active' : ''}" data-sort="${v}">${l}</button>`).join('')}
        <button class="chip" id="an-f" type="button" aria-expanded="false">${icon('slider', 12)} فلاتر أنمي</button>
        <span style="flex:1"></span>
        <span style="font-size: var(--text-3xs);color:var(--color-text-faint)">ياباني · تصنيف 16 · مدعوم بالكاش</span>
      </div>
    </div>
    <div class="container">
      <div id="an-panel" hidden></div>
      <div id="an-discover"></div>
    </div>`;

  const discGrid = el('div', 'media-grid');
  const discHead = section({ title: 'اكتشف أنمي' });
  discHead.body.appendChild(discGrid);
  page.querySelector('#an-discover').appendChild(discHead.root);

  let sort = 'popularity.desc';
  let dseq = 0;
  let extra = null;
  let panel = null;
  async function loadDiscover() {
    const my = ++dseq;
    createSkeletonGrid(discGrid, 12);
    try {
      const res = await tmdbClient.discoverTV({
        with_genres: 16,
        with_original_language: 'ja',
        sort_by: sort,
        'vote_count.gte': sort === 'vote_average.desc' ? 500 : 50,
        page: 1,
        ...extra,
      });
      const rows = (res?.results || []).filter((m) => m.poster_path);
      if (my !== dseq) return; // stale sort response
      discGrid.innerHTML = '';
      if (!rows.length) { discGrid.appendChild(emptyState({ iconName: 'sparkle', title: 'لا نتائج — جرّب ترتيباً آخر أو اتصالاً بالإنترنت' })); return; }
      rows.slice(0, 24).forEach((m) => discGrid.appendChild(createMediaCard({ ...m, media_type: 'tv', anime: true }, { variant: 'poster' })));
    } catch (e) {
      discGrid.innerHTML = '';
      discGrid.appendChild(errorState({ desc: 'تعذّر جلب الاكتشاف — الكاش المحلي ما زال يعمل في مكتبتك.', onRetry: loadDiscover }));
    }
  }
  page.querySelectorAll('[data-sort]').forEach((b) => b.addEventListener('click', () => {
    page.querySelectorAll('[data-sort]').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    sort = b.dataset.sort;
    loadDiscover();
  }));

  const fBtn = page.querySelector('#an-f');
  const panelMount = page.querySelector('#an-panel');
  fBtn.addEventListener('click', () => {
    if (!panelMount.hidden) { panelMount.hidden = true; fBtn.setAttribute('aria-expanded', 'false'); return; }
    if (!panel) {
      // anime-specific criteria set (§11): NOT the generic movies panel — types are tv shapes,
      // base pins genre 16 + ja, status covers airing/ended.
      panel = discoverPanel({
        mediaType: 'tv',
        types: [['tv', 'سلسلة'], ['tv_special', 'حلقة خاصة'], ['miniseries', 'ميني-سلسلة'], ['movie', 'فيلم أنمي']],
        base: { with_genres: 16, with_original_language: 'ja' },
        onRun: (p) => { extra = p; fBtn.classList.add('active'); panelMount.hidden = true; fBtn.setAttribute('aria-expanded', 'false'); loadDiscover(); },
        onCancel: () => { extra = null; fBtn.classList.remove('active'); loadDiscover(); },
      });
      panelMount.appendChild(panel.root);
    }
    panelMount.hidden = false;
    fBtn.setAttribute('aria-expanded', 'true');
  });

  // 1) Airing soon — from library shows (real data, not fake calendar)
  loadAiringSoon(page.querySelector('#an-airing'));
  // 2) My anime rail
  loadMyAnime(page.querySelector('#an-lib'));
  // 3) Top-10 — same rank system as every other page (§07/§31)
  rankedTop10({ mount: page.querySelector('#an-top10'), endpoint: 'discover/tv',
    params: { with_genres: 16, with_original_language: 'ja', sort_by: 'popularity.desc', 'vote_count.gte': 1000, page: 1 },
    title: 'أفضل ١٠ أنمي', subtitle: 'رائج ومُقيَّم — نفس نظام الأرقام في كل الصفحات' });
  // 3) discovery
  await loadDiscover();
  return page;
}

async function libraryAnime() {
  let rows = [];
  try { rows = (await db.getAll('tvshows', 500).catch(() => [])) || []; } catch { rows = []; }
  const isAnimeish = (m) => m.isAnime || m.anime || (m.genre_ids || []).includes(16) || /anime|أنمي/i.test(m.origin_country?.[0] === 'JP' ? 'anime' : '') || m.origin_country?.includes?.('JP');
  return rows.filter(isAnimeish);
}

async function loadMyAnime(mount) {
  let rows = await libraryAnime();
  let label = 'أنمي في مكتبتك';
  if (!rows.length) {
    // fall back to library TV shows with anime-flagged children OR any tv (honest label)
    try { rows = ((await db.getAll('tvshows', 60).catch(() => [])) || []).slice(0, 12); label = 'مسلسلاتك القريبة من الأنمي — صنّفها من البطاقة'; } catch { rows = []; }
  }
  if (!rows.length) return;
  const s = section({ title: label, wide: true, action: { label: 'المكتبة' } });
  s.head.querySelector('.more').addEventListener('click', () => window.router.navigate('/library'));
  const { wrap } = railEl(rows.slice(0, 14).map((m) => createMediaCard({ ...m, media_type: 'tv', inLibrary: true }, { variant: 'wide' })), { snapCards: 'clamp(280px, 25vw, 340px)' });
  s.body.appendChild(wrap);
  mount.appendChild(s.root);
}

async function loadAiringSoon(mount) {
  const rows = (await libraryAnime()).slice(0, 10);
  if (!rows.length) return;
  const s = section({ title: 'قريباً — من متابَعاتك', subtitle: 'مواعيد الحلقات الجديدة لمكتبتك' });
  const box = el('div', '');
  box.style.cssText = 'display:flex;flex-direction:column;gap: var(--sp-2);padding-inline:var(--page-gutter)';
  s.body.appendChild(box);
  mount.appendChild(s.root);
  let painted = 0;
  for (const m of rows) {
    try {
      const d = await tmdbClient.getTV(m.id || m.key, ['']);
      const ep = d?.next_episode_to_air;
      if (!ep) continue;
      painted++;
      const row = el('button', 'z-ep');
      row.style.cursor = 'pointer';
      row.innerHTML = `
        <div class="sthumb">${ep.still_path
          ? `<img src="${getTMDBImageUrl(ep.still_path, 'still', 'w300')}" alt="" loading="lazy">`
          : `<div class="fallback">${icon('sparkle', 20)}</div>`}
          <span class="en num">S${String(ep.season_number).padStart(2, '0')}E${String(ep.episode_number).padStart(2, '0')}</span>
        </div>
        <div class="ebody">
          <b>${ep.name || m.title || m.name}</b>
          <span class="mt"><span>${fmtDateAr(ep.air_date)}</span><span class="num">${ep.runtime ? ep.runtime + 'د' : ''}</span></span>
        </div>
        <div class="etail"><span class="z-pill z-pill-accent">قادمة</span></div>`;
      row.addEventListener('click', () => window.router.navigate(`/tv/${m.id || m.key}`));
      box.appendChild(row);
    } catch { /* offline → no calendar */ }
  }
  if (!painted) s.root.remove();
}
