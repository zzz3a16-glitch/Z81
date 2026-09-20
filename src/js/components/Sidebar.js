/**
 * Sidebar v3 — minimal, grouped, expandable, keyboard-first (spec 08–09).
 * Hierarchy: Home / Discover / My Library / Manage / System — features live
 * inside groups, "more" rows unfold. Collapses to an icon rail with tooltips.
 */
import { router } from '../router.js';
import { watchlistManager } from '../services/watchlist/WatchlistManager.js';
import { isDesktop, api } from '../bridge.js';
import { icon } from '../ui/icons.js';

const GROUPS = [
  { id: 'discover', label: 'اكتشاف', items: [
    ['/movies', 'film', 'أفلام'],
    ['/tv', 'tv', 'مسلسلات'],
    ['/anime', 'sparkle', 'أنمي'],
    ['/platforms', 'globe', 'المنصات'],
  ], more: [
    ['/genres', 'palette', 'الأنواع'],
    ['/countries', 'globe', 'الدول'],
    ['/eras', 'calendar', 'العقود والحقب'],
    ['/franchises', 'film', 'السلاسل السينمائية'],
    ['/awards', 'award', 'الجوائز'],
    ['/formats', 'hd', 'الصيغ والجودات'],
  ] },
  { id: 'live', label: 'مباشر', items: [
    ['/live', 'live', 'البث المباشر'],
    ['/live/channels', 'grid', 'كل القنوات'],
  ], more: [
    ['/live/guide', 'guide', 'دليل القنوات'],
    ['/live/sources', 'sources', 'مصادر IPTV'],
    ['/live/settings', 'gear', 'إعدادات البث'],
  ] },
  { id: 'library', label: 'مكتبتي', items: [
    ['/library', 'database', 'المكتبة'],
    ['/favorites', 'heart', 'المفضلة', 'favorites-badge'],
    ['/watch-later', 'bookmark', 'المشاهدة لاحقاً', 'watchlater-badge'],
    ['/history', 'history', 'سجل المشاهدة'],
    ['/continue-watching', 'playCircle', 'متابعة المشاهدة'],
    ['/collections', 'layers', 'المجموعات'],
  ], more: [
    ['/recommendations', 'bulb', 'توصيات لك'],
    ['/assistant', 'robot', 'المساعد الذكي'],
    ['/analytics', 'chart', 'الإحصائيات'],
    ['/missing', 'alert', 'الحلقات المفقودة'],
    ['/media-types', 'list', 'أنواع الوسائط'],
  ] },
  { id: 'manage', label: 'الإدارة والصحة', items: [
    ['/inbox', 'inbox', 'صندوق الوارد', 'inbox-badge'],
    ['/health', 'shield', 'صحة المكتبة', 'health-badge'],
    ['/duplicates', 'dup', 'المكررات'],
    ['/storage', 'drive', 'التخزين'],
  ], more: [
    ['/snapshots', 'snap', 'اللقطات', null, 'restore'],
    ['/audit', 'list', 'سجل التدقيق'],
    ['/content-themes', 'palette', 'ثيمات المحتوى'],
  ] },
  { id: 'system', label: 'النظام', items: [
    ['/settings', 'gear', 'الإعدادات'],
    ['/settings/appearance', 'palette', 'المظهر والسمة'],
  ] },
];

export function createSidebar() {
  const nav = document.createElement('aside');
  nav.className = 'z-sidebar';
  nav.id = 'sidebar';
  nav.setAttribute('role', 'navigation');
  nav.setAttribute('aria-label', 'القائمة الرئيسية');

  const devMode = ['true', '"true"'].includes(String(localStorage.getItem('zpopcorn-dev-mode')));
  const groupsFor = JSON.parse(localStorage.getItem('zpopcorn-sb-groups') || '{}');
  const moreOpen = JSON.parse(localStorage.getItem('zpopcorn-sb-more') || '{}');

  const itemHtml = ([href, ic, label, badge]) => `
    <a href="#${href}" class="z-sb-item" data-route="${href}" data-tip="${label}" data-ic="${ic}" tabindex="-1">
      ${icon(ic, 18, { weight: 'light' })}<span>${label}</span>${badge ? `<span class="sb-badge" id="${badge}" style="display:none">0</span>` : ''}
    </a>`;

  nav.innerHTML = `
    <div class="z-sb-brand">
      <span class="z-sb-mark">${icon('logo', 19)}</span>
      <span class="z-sb-name">zPopcorn</span>
    </div>
    <nav class="z-sb-nav">
      <div class="z-sb-group">
        <a href="#/" class="z-sb-item" data-route="/" data-tip="الرئيسية" data-ic="home">${icon('home', 18, { weight: 'light' })}<span>الرئيسية</span></a>
      </div>
      ${GROUPS.map((g) => `
        <div class="z-sb-group" data-g="${g.id}">
          <div class="z-sb-grouptitle"><b>${g.label}</b></div>
          ${g.items.map(itemHtml).join('')}
          ${(g.more?.length && (g.id !== 'system' || devMode)) ? `
            <button class="z-sb-item z-sb-more-btn" data-more="${g.id}" aria-expanded="${!!moreOpen[g.id]}" tabindex="-1">
              ${icon('more', 15)}<span>أكثر</span><span class="chev">${icon('chevD', 13)}</span>
            </button>
            <div class="z-sb-sub ${moreOpen[g.id] ? 'open' : ''}" data-sub="${g.id}">
              ${g.more.map(itemHtml).join('')}
              ${g.id === 'system' && devMode ? `
                <a href="#/developer" class="z-sb-item" data-route="/developer" data-tip="وضع المطور" tabindex="-1">
                  ${icon('terminal')}<span>وضع المطور</span><span class="sb-badge" style="display:grid;background:var(--surface-4);color:var(--color-text-secondary)">DEV</span>
                </a>` : ''}
            </div>` : ''}
        </div>`).join('')}
    </nav>
    <div class="z-sb-foot">
      <button class="z-sb-railtoggle" id="sb-rail-toggle" aria-label="طي/توسيع القائمة">
        ${icon('chevR', 15)}<span>طي القائمة</span>
      </button>
    </div>
  `;

  /* ---------- rail mode (root attribute drives the grid) ---------- */
  const rootStyle = document.documentElement;
  const setRail = (rail, persist = true) => {
    rootStyle.setAttribute('data-sidebar', rail ? 'rail' : 'full');
    if (persist) localStorage.setItem('zpopcorn-sb-rail', rail ? '1' : '0');
    window.dispatchEvent(new CustomEvent('sidebartoggle', { detail: { collapsed: rail } }));
  };
  setRail(localStorage.getItem('zpopcorn-sb-rail') === '1', false);
  nav.querySelector('#sb-rail-toggle').addEventListener('click', () =>
    setRail(rootStyle.getAttribute('data-sidebar') !== 'rail'));
  nav.querySelector('#sb-rail-toggle svg').style.transition = 'transform var(--dur-2)';
  const syncChev = () => {
    const b = nav.querySelector('#sb-rail-toggle');
    if (b) b.querySelector('svg').style.transform = rootStyle.getAttribute('data-sidebar') === 'rail' ? 'rotate(180deg)' : '';
  };
  syncChev();
  window.addEventListener('sidebartoggle', syncChev);

  /* ---------- "more" disclosure ---------- */
  nav.querySelectorAll('[data-more]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.more;
      const sub = nav.querySelector(`[data-sub="${id}"]`);
      const open = !sub.classList.contains('open');
      sub.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', String(open));
      moreOpen[id] = open;
      localStorage.setItem('zpopcorn-sb-more', JSON.stringify(moreOpen));
    });
  });

  /* ---------- active route + roving focus (keyboard) ---------- */
  const applyActive = (route) => {
    nav.querySelectorAll('.z-sb-item').forEach((a) => {
      const r = a.dataset.route;
      const on = r === '/' ? route.actualPath === '/' : r && route.actualPath?.startsWith(r);
      a.classList.toggle('z-active', !!on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
      if (a.dataset.ic) {
        const g = a.querySelector('svg.zi');
        if (g) g.outerHTML = icon(a.dataset.ic, +g.getAttribute('width') || 18, { weight: on ? 'duotone' : 'light' });
      }
    });
  };
  router.onRouteChange(applyActive);
  applyActive({ actualPath: window.location.hash.replace(/^#/, '') || '/' });

  nav.addEventListener('keydown', (e) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    const items = [...nav.querySelectorAll('.z-sb-item')].filter((i) => i.offsetParent !== null);
    const i = items.indexOf(document.activeElement);
    if (i === -1) return;
    e.preventDefault();
    const next = e.key === 'ArrowDown' ? Math.min(items.length - 1, i + 1)
      : e.key === 'ArrowUp' ? Math.max(0, i - 1)
      : e.key === 'Home' ? 0 : items.length - 1;
    items.forEach((x) => x.tabIndex = -1);
    items[next].tabIndex = 0;
    items[next].focus();
  });
  nav.addEventListener('focusin', () => {
    const f = nav.querySelector('.z-sb-item:focus-visible');
    if (f) { nav.querySelectorAll('.z-sb-item').forEach((x) => x.tabIndex = -1); f.tabIndex = 0; }
  });

  /* ---------- navigation: always via router (works in both modes) ---------- */
  nav.addEventListener('click', (e) => {
    const a = e.target.closest('a.z-sb-item');
    if (!a || !a.dataset.route) return;
    e.preventDefault();
    router.navigate(a.dataset.route);
    if (window.innerWidth <= 900) a.closest('.z-sidebar')?.classList.remove('mobile-open');
  });

  /* ---------- badges ---------- */
  const setBadge = (id, n, warn = false) => {
    const b = nav.querySelector('#' + id);
    if (!b) return;
    b.textContent = n > 99 ? '99+' : String(n);
    b.style.display = n > 0 ? 'grid' : 'none';
    if (warn) { b.style.background = 'var(--color-warning)'; b.style.color = '#141005'; }
  };
  const refreshBadges = async () => {
    try {
      const [fav, later] = await Promise.all([
        watchlistManager.getList('favorites').catch(() => null),
        watchlistManager.getList('watch-later').catch(() => null),
      ]);
      setBadge('favorites-badge', fav?.items?.length || 0);
      setBadge('watchlater-badge', later?.items?.length || 0);
    } catch { /* ok */ }
    if (isDesktop) {
      try { const st = await api.inbox.stats(); setBadge('inbox-badge', st.pending || 0); } catch { /* ok */ }
      try { const h = await api.health.stats(); setBadge('health-badge', h.total || 0, true); } catch { /* ok */ }
    }
  };
  refreshBadges();
  window.addEventListener('watchlistupdate', refreshBadges);
  window.addEventListener('zpopcorn:inbox-changed', refreshBadges);
  window.addEventListener('zpopcorn:library-changed', refreshBadges);
  window.addEventListener('zpopcorn:health-changed', refreshBadges);

  return nav;
}

/* ---------- mobile: fixed overlay drawer ---------- */
export function createMobileMenuButton() {
  const btn = document.createElement('button');
  btn.id = 'mobile-menu-btn';
  btn.className = 'z-iconbtn';
  btn.innerHTML = icon('list', 18);
  btn.setAttribute('aria-label', 'فتح القائمة');
  btn.addEventListener('click', () => document.getElementById('sidebar')?.classList.toggle('mobile-open'));
  return btn;
}
