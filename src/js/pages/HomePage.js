/**
 * HomePage v4 — the control centre (spec 11–12, 16, 47).
 * Data-driven: a section exists only when it has real content. Skeletons
 * first, empty states instead of voids, Top-10 editorial, restrained hero.
 */
import { tmdbClient } from '../services/tmdb/TMDBClient.js';
import { getTMDBImageUrl } from '../services/tmdb/TMDBImage.js';
import { db } from '../services/storage/Database.js';
import { recommendationEngine } from '../services/recommendation/RecommendationEngine.js';
import { createMediaCard, createTop10 } from '../components/MediaCard.js';
import { icon } from '../ui/icons.js';
import {
  el, esc, section, railEl, skelHero, skelRail, skelGrid, emptyState,
  fmtRuntime, ratingBadge, fallbackArt,
} from '../ui/primitives.js';
import { behaviorEngine, BEHAVIOR_EVENTS } from '../services/behavior/UserBehaviorEngine.js';
import { isDesktop, api } from '../bridge.js';

export async function HomePage() {
  const page = el('div', 'home-page');

  const heroMount = el('div', '');
  page.appendChild(heroMount);

  const body = el('div', 'z-sections');
  page.appendChild(body);
  renderSections(body);

  loadHero(heroMount);
  return page;
}

/* =================== HERO =================== */
async function loadHero(mount) {
  mount.appendChild(skelHero());
  let featured = [];

  // Prefer MY library (high rated, not finished); fill with TMDB trending if thin.
  try {
    const [movies, tv] = await Promise.all([
      db.getAll('movies', 300).catch(() => []),
      db.getAll('tvshows', 300).catch(() => []),
    ]);
    const lib = [...(movies || []), ...(tv || [])].filter((m) => m.backdrop_path);
    lib.sort((a, b) => (Number(b.vote_average) || 0) - (Number(a.vote_average) || 0));
    featured = lib.slice(0, 5).map((m) => normalize(m));
  } catch { /* first run */ }

  if (featured.length < 3) {
    try {
      const tr = await tmdbClient.trending('all', 'week').catch(() => null);
      const net = (tr?.results || [])
        .filter((m) => m.backdrop_path && m.media_type !== 'person')
        .slice(0, 5 - featured.length)
        .map((m) => ({ ...normalize(m), __net: true }));
      featured = [...featured, ...net];
    } catch { /* offline */ }
  }

  mount.innerHTML = '';
  if (!featured.length) {
    mount.appendChild(emptyState({
      iconName: 'database',
      title: 'مكتبتك فارغة حتى الآن',
      desc: 'أضِف مجلد وسائط من صندوق الوارد، أو تصفّح TMDB من الاكتشاف — وستصبح هذه الصفحة مركز قيادتك.',
      actions: [
        { label: isDesktop ? 'ابدأ من صندوق الوارد' : 'تصفّح الأفلام', icon: 'inbox', onClick: () => window.router.navigate(isDesktop ? '/inbox' : '/movies') },
        { label: 'إعدادات المظهر', icon: 'palette', kind: 'ghost', onClick: () => window.router.navigate('/settings/appearance') },
      ],
    }));
    return;
  }

  buildHero(mount, featured);
}

function normalize(m) {
  return {
    ...m,
    id: m.id ?? m.key,
    title: m.title || m.name || m.original_title || '',
    year: m.year || (m.release_date || m.first_air_date || '').slice(0, 4),
    overview: m.overview || '',
    poster_path: m.poster_path,
    backdrop_path: m.backdrop_path,
    vote_average: m.vote_average,
    media_type: m.media_type || (m.first_air_date || m.seasons ? 'tv' : 'movie'),
    runtime: m.runtime,
  };
}

function buildHero(mount, items) {
  let i = 0;
  const hero = el('div', 'z-hero');
  hero.setAttribute('aria-roledescription', 'carousel');
  hero.innerHTML = `
    <div class="bg"></div>
    <div class="body">
      <div class="kicker"></div>
      <h2></h2>
      <div class="facts"></div>
      <p class="ov"></p>
      <div class="cta"></div>
    </div>
    <div class="pager"></div>`;
  mount.appendChild(hero);

  const pager = hero.querySelector('.pager');
  if (items.length > 1) {
    items.forEach((_, idx) => {
      const b = document.createElement('button');
      b.setAttribute('aria-label', `المميز ${idx + 1}`);
      b.addEventListener('click', () => paint(idx));
      pager.appendChild(b);
    });
  }

  let timer = null;
  function paint(idx) {
    i = ((idx % items.length) + items.length) % items.length;
    const m = items[i];
    const bg = hero.querySelector('.bg');
    const bd = m.backdrop_path ? getTMDBImageUrl(m.backdrop_path, 'backdrop', 'w1280') : null;
    bg.innerHTML = bd ? `<img src="${bd}" alt="" decoding="async">` : fallbackArt(m.title, { big: true });
    hero.querySelector('.kicker').innerHTML =
      `<span class="z-pill z-pill-accent">${m.__net ? 'رائج هذا الأسبوع' : 'من مكتبتك'}</span>`;
    hero.querySelector('h2').textContent = m.title || '—';
    hero.querySelector('.facts').innerHTML = [
      m.year ? `<span class="num">${esc(String(m.year))}</span>` : '',
      (m.genres?.[0]?.name) ? esc(m.genres[0].name) : '',
      m.runtime ? `<span class="num">${fmtRuntime(m.runtime)}</span>` : '',
      m.vote_average ? `<span class="num rate">${icon('star',13)} ${Number(m.vote_average).toFixed(1)}</span>` : '',
    ].filter(Boolean).join('<span class="sep"></span>');
    hero.querySelector('.ov').textContent = m.overview || 'لا يوجد وصف متاح لهذا العمل.';
    const cta = hero.querySelector('.cta');
    cta.innerHTML = `
      <button class="btn btn-primary btn-lg" data-go>${icon('info', 15)} بطاقة العمل</button>
      <button class="btn btn-secondary btn-lg" data-save>${icon('plus', 15)} ${m.__net ? 'إضافة للمكتبة' : 'المشاهدة لاحقاً'}</button>`;
    cta.querySelector('[data-go]').addEventListener('click', () => {
      behaviorEngine.track(BEHAVIOR_EVENTS.OPENED, { mediaId: m.id, mediaType: m.media_type, title: m.title });
      window.router.navigate(`${m.media_type === 'tv' ? '/tv/' : '/movie/'}${m.id}`);
    });
    cta.querySelector('[data-save]').addEventListener('click', async (e) => {
      const { watchlistManager } = await import('../services/watchlist/WatchlistManager.js');
      try {
        if (m.__net) {
          const store = m.media_type === 'tv' ? 'tvshows' : 'movies';
          await db.put(store, { ...m, key: String(m.id), addedAt: Date.now(), inLibrary: true });
          window.dispatchEvent(new CustomEvent('zpopcorn:library-changed'));
          window.dispatchEvent(new CustomEvent('showtoast', { detail: { message: 'أُضيف إلى مكتبتك (وصف مبدئي — حدّثه من البطاقة)', type: 'success' } }));
        } else {
          await watchlistManager.addToList('watch-later', { ...m, media_type: m.media_type });
          window.dispatchEvent(new CustomEvent('showtoast', { detail: { message: 'أُضيف إلى «المشاهدة لاحقاً»', type: 'success' } }));
        }
        e.currentTarget.innerHTML = `${icon('check', 15)} تم`;
      } catch { /* toast elsewhere */ }
    });
    pager.querySelectorAll('button').forEach((b, bi) => b.classList.toggle('on', bi === i));
    if (timer) clearInterval(timer);
    timer = setInterval(() => paint(i + 1), 9000);
  }
  hero.addEventListener('mouseenter', () => timer && clearInterval(timer));
  hero.addEventListener('mouseleave', () => { timer && clearInterval(timer); timer = setInterval(() => paint(i + 1), 9000); });
  paint(0);
}

/* =================== SECTIONS (each hides when empty) =================== */
async function renderSections(body) {
  const FNS = {
    continue: loadContinue, recent: loadRecentlyAdded, watched: loadRecentlyWatched,
    top10: loadTop10, later: loadWatchLater, recs: loadRecommended,
    trending: loadTrending, health: loadHealthStrip,
  };
  let eng = null;
  try { eng = (await import('../theme/ThemeEngine.js')).themeEngine; } catch { /* defaults */ }
  const order = eng ? eng.homeOrder().filter((id) => FNS[id]) : Object.keys(FNS);
  const tasks = order.map((id) => [id, FNS[id]]);
  // reserve skeleton placeholders per section while resolving, then swap/remove
  const mounts = new Map();
  for (const [id] of tasks) {
    const holder = el('div', '');
    if (id !== 'hero') holder.appendChild(elRailSkeleton());
    mounts.set(id, holder);
    body.appendChild(holder);
  }
  await Promise.all(tasks.map(async ([id, fn]) => {
    const holder = mounts.get(id);
    try {
      const node = await fn(eng ? eng.sectionCount(id) : undefined);
      holder.replaceChildren(...(node ? [node] : []));
      if (!node) holder.remove();
    } catch { holder.remove(); }
  }));
}

function elRailSkeleton() {
  const f = document.createDocumentFragment();
  const s = section({ title: '…', wide: true });
  s.body.appendChild(el('div', '')).appendChild(skelRail(6, false));
  s.root.querySelectorAll('.sk-card').forEach((x) => { x.style.width = 'var(--card-w)'; x.style.minWidth = '150px'; });
  f.appendChild(s.root);
  return f;
}

function railSection(title, cards, opts = {}) {
  if (!cards.length) return null;
  const s = section({ title, subtitle: opts.subtitle, wide: true, action: opts.more ? { label: 'عرض الكل' } : null });
  if (opts.more) s.head.querySelector('.more').addEventListener('click', () => window.router.navigate(opts.more));
  const { wrap } = railEl(cards, opts.wide ? { snapCards: 'clamp(280px, 26vw, 360px)' } : undefined);
  s.body.appendChild(wrap);
  return s.root;
}

async function loadContinue(n = 12) {
  let rows = [];
  if (isDesktop) {
    try {
      const cw = await api.history.continueWatching(18);
      rows = Array.isArray(cw) ? cw : [];
    } catch { rows = []; }
  }
  if (!rows.length) {
    const prog = await db.getAll('watchProgress').catch(() => []);
    rows = (prog || []).filter((p) => p.percentage > 2 && p.percentage < 96).slice(-12).reverse();
  }
  if (!rows.length) return null;
  const cards = rows.slice(0, n).map((p) => {
    const media = {
      id: p.mediaId || p.media_id || p.id, title: p.title || '', media_type: p.mediaType || p.media_type || 'movie',
      backdrop_path: p.backdrop_path, poster_path: p.poster_path,
      progress: p.percentage || p.percent || 0,
      timeLeft: p.remainingMin || p.remaining_minutes || '',
      season: p.season, episode: p.episode,
    };
    return createMediaCard(media, { variant: 'continue' });
  });
  return railSection('متابعة المشاهدة', cards, { subtitle: 'من حيث توقفت', more: '/continue-watching' });
}

async function loadRecentlyAdded(n = 14) {
  const [movies, tv] = await Promise.all([
    db.getAll('movies', 500).catch(() => []),
    db.getAll('tvshows', 500).catch(() => []),
  ]);
  const rows = [...(movies || []), ...(tv || [])]
    .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0))
    .slice(0, n);
  if (!rows.length) return null;
  return railSection('أضيف حديثاً', rows.map((m) => createMediaCard(normalize(m), { variant: 'wide' })), { wide: true, more: '/library' });
}

async function loadRecentlyWatched(n = 12) {
  let rows = [];
  try {
    const hist = await db.getAll('watchHistory', 24).catch(() => []);
    rows = (hist || []).slice(-n).reverse();
  } catch { rows = []; }
  if (!rows.length) return null;
  const cards = rows.map((h) => createMediaCard({
    id: h.mediaId, title: h.title, media_type: h.mediaType || 'movie',
    poster_path: h.poster_path, backdrop_path: h.backdrop_path,
    year: h.year,
  }, { variant: 'poster' }));
  return railSection('شاهدته مؤخراً', cards, { more: '/history' });
}

async function loadTop10() {
  const [movies, tv] = await Promise.all([
    db.getAll('movies', 500).catch(() => []),
    db.getAll('tvshows', 500).catch(() => []),
  ]);
  const rows = [...(movies || []), ...(tv || [])]
    .filter((m) => m.vote_average || m.localScore)
    .sort((a, b) => (b.localScore || Number(b.vote_average) || 0) - (a.localScore || Number(a.vote_average) || 0))
    .slice(0, 10)
    .map(normalize);
  if (rows.length < 3) return null;
  const s = section({ title: 'أفضل ١٠ في مكتبتك', subtitle: 'مرتبة بالتقييم — الأرقام جزء من التصميم', wide: true, action: { label: 'المكتبة' } });
  s.head.querySelector('.more').addEventListener('click', () => window.router.navigate('/library'));
  s.body.appendChild(createTop10(rows));
  return s.root;
}

async function loadWatchLater(n = 14) {
  let items = [];
  try {
    const { watchlistManager } = await import('../services/watchlist/WatchlistManager.js');
    const list = await watchlistManager.getList('watch-later');
    items = (list?.items || []).slice(-n).reverse();
  } catch { items = []; }
  if (!items.length) return null;
  return railSection('المشاهدة لاحقاً', items.map((m) => createMediaCard(normalize({ ...m, ...m.data }), { variant: 'poster' })), { more: '/watch-later' });
}

async function loadRecommended(n = 14) {
  let recs = [];
  try { recs = (await recommendationEngine.getRecommendations(n)) || []; } catch { recs = []; }
  if (!recs.length) return null;
  return railSection('موصى به لذوقك', recs.map((m) => createMediaCard(normalize(m), { variant: 'poster' })), { subtitle: 'يتعلّم من مشاهداتك' });
}

async function loadTrending(n = 14) {
  let tr = null;
  try { tr = await tmdbClient.trending('all', 'week').catch(() => null); } catch { tr = null; }
  const results = (tr?.results || []).filter((m) => m.media_type !== 'person').slice(0, n);
  if (!results.length) return null;
  return railSection('رائج هذا الأسبوع', results.map((m) => createMediaCard(normalize(m), { variant: 'poster' })));
}

async function loadHealthStrip() {
  if (!isDesktop) return null;
  let st = null; let inbox = null;
  try { st = await api.health.stats(); inbox = await api.inbox.stats(); } catch { return null; }
  const issues = st?.total || 0;
  const pending = inbox?.pending || 0;
  if (!issues && !pending) return null;
  const s = section({ title: 'تحتاج انتباهاً', subtitle: 'صيانة المكتبة — لا شيء عاجل' });
  const grid = el('div', 'z-stats');
  const mk = (iconName, title, desc, to, tone) => {
    const b = el('button', 'z-stat');
    b.style.cssText = 'cursor:pointer;text-align:start;display:flex;flex-direction:column;font:inherit;color:inherit';
    b.innerHTML = `<span style="display:flex;align-items:center;gap: var(--sp-2)">${icon(iconName, 15)}<b class="num">${title}</b></span><span style="margin-top: var(--sp-1)">${desc}</span>${tone ? `<span class="z-pill z-pill-warn" style="width:fit-content;margin-top: var(--sp-2)">${tone}</span>` : ''}`;
    b.addEventListener('click', () => window.router.navigate(to));
    return b;
  };
  if (pending) grid.appendChild(mk('inbox', `${pending} عنصر`, 'بانتظار مراجعتك في صندوق الوارد', '/inbox', 'مراجعة'));
  if (issues) grid.appendChild(mk('shield', `${issues} ملاحظة`, 'مشاكل صحة مكتبة مفتوحة', '/health', issues > 5 ? 'فحص' : ''));
  s.body.appendChild(grid);
  return s.root;
}
