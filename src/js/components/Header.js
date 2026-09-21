/**
 * TopBar v2 — quiet global chrome: context, search, status (spec 10, 29, 59).
 */
import { router } from '../router.js';
import { db } from '../services/storage/Database.js';
import { notificationService } from '../services/notification/NotificationService.js';
import { themeManager } from '../services/theme/ThemeManager.js';
import { icon } from '../ui/icons.js';
import { esc } from '../ui/primitives.js';
import { themeEngine, PRESETS } from '../theme/ThemeEngine.js';

const ROUTE_TITLES = [
  ['/', 'الرئيسية'], ['/movies', 'أفلام'], ['/tv', 'مسلسلات'], ['/anime', 'أنمي'],
  ['/library', 'المكتبة'], ['/favorites', 'المفضلة'], ['/watch-later', 'المشاهدة لاحقاً'],
  ['/history', 'سجل المشاهدة'], ['/continue-watching', 'متابعة المشاهدة'], ['/collections', 'المجموعات'],
  ['/inbox', 'صندوق الوارد'], ['/health', 'صحة المكتبة'], ['/duplicates', 'المكررات'],
  ['/storage', 'التخزين'], ['/search', 'البحث'], ['/settings', 'الإعدادات'],
  ['/developer', 'وضع المطور'], ['/assistant', 'المساعد الذكي'], ['/analytics', 'الإحصائيات'],
  ['/recommendations', 'توصيات لك'], ['/snapshots', 'اللقطات'], ['/audit', 'سجل التدقيق'],
  ['/missing', 'المفقود'], ['/networks', 'الشبكات'], ['/movie/', 'فيلم'], ['/tv/', 'مسلسل'], ['/person/', 'شخص'],
];

export function createHeader() {
  const header = document.createElement('header');
  header.className = 'z-topbar';
  header.setAttribute('role', 'banner');

  header.innerHTML = `
    <div class="z-tb-left">
      <button class="z-tb-navbtn z-menu-btn" id="tb-menu" aria-label="القائمة" style="display:none">${icon('menu', 17)}</button>
      <div class="z-tb-navbtns">
        <button class="z-tb-navbtn" id="tb-back" title="رجوع (Alt+←)" aria-label="رجوع">${icon('arrowR', 16)}</button>
        <button class="z-tb-navbtn" id="tb-fwd" title="تقدم (Alt+→)" aria-label="تقدم">${icon('arrowL', 16)}</button>
      </div>
      <span class="z-tb-context" id="tb-context"></span>
    </div>
    <div class="z-tb-search" role="search">
      <div class="box">
        ${icon('search', 15)}
        <input id="global-search-input" type="search" placeholder="ابحث في مكتبتك و TMDB…" autocomplete="off" aria-label="بحث عام" />
        <kbd>Ctrl K</kbd>
      </div>
      <div class="z-tb-suggest" id="tb-suggest"></div>
    </div>
    <div class="z-tb-right">
      <button class="z-libstat" id="tb-libstat" title="حالة المكتبة">
        <span class="net-dot"></span>
        <span class="lib-count" id="tb-libcount">—</span>
        <span class="net-label-online" style="color:var(--color-text-muted)">محلي</span>
        <span class="net-label-offline" style="color:var(--color-text-muted)">غير متصل — المكتبة تعمل</span>
      </button>
      <button class="z-iconbtn" id="tb-bell" title="الإشعارات" aria-label="الإشعارات">${icon('bell', 17)}<span class="nbadge" id="tb-nbadge" style="display:none">0</span></button>
      <button class="z-iconbtn" id="tb-theme" title="تبديل سريع للسمة (Ctrl+T)" aria-label="السمة">${icon('palette', 17)}</button>
      <div class="z-npanel" id="tb-npanel">
        <div class="z-npanel-head">
          <h3>الإشعارات</h3>
          <div style="display:flex;gap: var(--sp-1)">
            <button class="btn btn-ghost btn-sm" id="tb-nread">تحديد كمقروء</button>
            <button class="btn btn-ghost btn-sm" id="tb-nclear">تنظيف</button>
          </div>
        </div>
        <div class="z-npanel-body" id="tb-nlist"></div>
      </div>
    </div>
  `;

  /* context label + nav buttons */
  const ctx = header.querySelector('#tb-context');
  const setCtx = (route) => {
    const p = route?.actualPath || location.hash.replace(/^#/, '') || '/';
    const hit = ROUTE_TITLES.find(([m]) => (m.endsWith('/') ? p.startsWith(m) && p !== '/' : p === m || p.startsWith(m)));
    const label = p === '/' ? 'الرئيسية' : (hit ? hit[1] : p.split('/')[1] || 'zPopcorn');
    ctx.textContent = label;
    document.title = `${label === 'zPopcorn' ? '' : label + ' — '}zPopcorn`;
    const canGo = (typeof history.state?.idx === 'number') || history.length > 2;
    header.querySelector('#tb-back').disabled = !canGo;
  };
  router.onRouteChange(setCtx);
  setCtx({ actualPath: location.hash.replace(/^#/, '') || '/' });
  // mobile drawer
  const scrim = document.createElement('div');
  scrim.className = 'z-scrim';
  document.body.appendChild(scrim);
  const drawerToggle = () => {
    const sb = document.querySelector('.z-sidebar');
    if (!sb) return;
    const open = sb.classList.toggle('mobile-open');
    scrim.classList.toggle('on', open);
  };
  scrim.addEventListener('click', drawerToggle);
  header.querySelector('#tb-menu')?.addEventListener('click', drawerToggle);
  window.addEventListener('hashchange', () => { document.querySelector('.z-sidebar')?.classList.remove('mobile-open'); scrim.classList.remove('on'); });

  header.querySelector('#tb-back').addEventListener('click', () => router.goBack());
  header.querySelector('#tb-fwd').addEventListener('click', () => history.forward());

  /* offline state mirrors on <html class> (CSS drives both chips) */
  const paintNet = () => document.documentElement.classList.toggle('z-offline', !navigator.onLine);
  paintNet();
  window.addEventListener('online', paintNet);
  window.addEventListener('offline', paintNet);

  /* library count (local, cheap) */
  const countEl = header.querySelector('#tb-libcount');
  const refreshCount = async () => {
    try {
      const [m, t] = await Promise.all([db.count('movies').catch(() => 0), db.count('tvshows').catch(() => 0)]);
      countEl.textContent = `${m + t} عمل`;
    } catch { countEl.textContent = 'مكتبتك'; }
  };
  refreshCount();
  window.addEventListener('zpopcorn:library-changed', refreshCount);
  window.addEventListener('watchlistupdate', () => {});
  header.querySelector('#tb-libstat').addEventListener('click', () => router.navigate('/library'));

  /* ---------- instant search ---------- */
  const input = header.querySelector('#global-search-input');
  const box = header.querySelector('#tb-suggest');
  let timer = null;
  const suggestions = [];
  const closeSug = () => { box.classList.remove('open'); box.innerHTML = ''; };
  const doSearch = async (q) => {
    if (!q || q.length < 2) return closeSug();
    const low = q.toLowerCase();
    const rows = [];
    try {
      const [movies, tv] = await Promise.all([
        db.getAll('movies', 200).catch(() => []),
        db.getAll('tvshows', 200).catch(() => []),
      ]);
      for (const m of [...(movies || []), ...(tv || [])]) {
        const t = (m.title || m.name || '');
        if (t.toLowerCase().includes(low) || (m.original_title || m.original_name || '').toLowerCase().includes(low)) {
          rows.push({ id: m.id || m.key, title: t, type: m.media_type || (m.first_air_date || m.title == null && m.name ? 'tv' : 'movie'), year: m.year || (m.release_date || m.first_air_date || '').slice(0, 4) });
          if (rows.length >= 7) break;
        }
      }
    } catch { /* stores may be empty */ }
    if (window.zpSearchEngineSuggest) {
      try { rows.push(...(await window.zpSearchEngineSuggest(q))); } catch { /* optional */ }
    }
    box.innerHTML = rows.length
      ? rows.map((r, i) => `
          <div class="sug-row ${i === 0 ? 'hl' : ''}" data-type="${r.type}" data-id="${esc(String(r.id))}">
            ${icon(r.type === 'tv' ? 'tv' : r.type === 'person' ? 'cast' : 'film', 15)}
            <span>${esc(r.title)}</span>${r.year ? `<span class="num" style="color:var(--color-text-faint)">${esc(r.year)}</span>` : ''}
            <span class="grp">${r.src === 'net' ? 'TMDB' : 'مكتبتك'}</span>
          </div>`).join('')
      : `<div class="sug-row" style="color:var(--color-text-faint);cursor:default">${icon('search', 15)}<span>اضغط Enter للبحث الشامل عن «${esc(q)}»</span></div>`;
    box.classList.add('open');
    box.querySelectorAll('[data-id]').forEach((row) => row.addEventListener('mousedown', (e) => {
      e.preventDefault();
      closeSug(); input.value = '';
      const { type, id } = row.dataset;
      router.navigate(type === 'tv' ? `/tv/${id}` : type === 'person' ? `/person/${id}` : `/movie/${id}`);
    }));
  };
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => doSearch(input.value.trim()), 180); });
  input.addEventListener('focus', () => { if (input.value.trim().length >= 2) doSearch(input.value.trim()); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { closeSug(); router.navigate('/search', {}, { query: { q: input.value.trim() } }); input.blur(); }
    if (e.key === 'Escape') { closeSug(); input.blur(); }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const rows = [...box.querySelectorAll('[data-id]')];
      if (!rows.length) return;
      e.preventDefault();
      let i = rows.findIndex((r) => r.classList.contains('hl'));
      rows.forEach((r) => r.classList.remove('hl'));
      i = e.key === 'ArrowDown' ? (i + 1) % rows.length : (i - 1 + rows.length) % rows.length;
      rows[i].classList.add('hl');
    }
    if (e.key === 'Enter' && box.querySelector('.sug-row.hl')) { /* handled by mousedown fallback below */ }
  });
  document.addEventListener('click', (e) => { if (!header.contains(e.target)) closeSug(); });

  /* ---------- notifications ---------- */
  const bell = header.querySelector('#tb-bell');
  const panel = header.querySelector('#tb-npanel');
  const nbadge = header.querySelector('#tb-nbadge');
  const nlist = header.querySelector('#tb-nlist');
  const paintBadge = () => {
    const n = notificationService.getUnreadCount?.() || 0;
    nbadge.style.display = n ? 'grid' : 'none';
    nbadge.textContent = String(Math.min(99, n));
  };
  paintBadge();
  const paintList = async () => {
    const items = (await notificationService.getAll?.()) || notificationService.notifications || [];
    nlist.innerHTML = items.length ? items.slice(-24).reverse().map((x) => `
      <div class="z-note ${x.read ? '' : 'unread'}">
        <div style="flex:1">
          <b style="font-size:var(--text-xs)">${esc(x.title || '')}</b>
          <div style="color:var(--color-text-secondary);margin-top:2px">${esc(x.message || '')}</div>
          <div class="nt">${x.createdAt ? new Date(x.createdAt).toLocaleString('ar-SA-u-nu-latn', { dateStyle: 'short', timeStyle: 'short' }) : ''}</div>
        </div>
      </div>`).join('')
      : `<div class="z-state" style="padding: var(--sp-7)"><h3 style="font-size:var(--text-sm)">لا إشعارات بعد</h3><p style="font-size:var(--text-xs)">تصلك تنبيهات الحلقات الجديدة ونتائج الفحص هنا.</p></div>`;
  };
  bell.addEventListener('click', async (e) => {
    e.stopPropagation();
    const open = panel.classList.toggle('open');
    if (open) { await paintList(); setTimeout(() => document.addEventListener('click', closePanel, { once: true }), 0); }
  });
  const closePanel = (e) => { if (!panel.contains(e.target)) panel.classList.remove('open'); };
  header.querySelector('#tb-nread').addEventListener('click', async () => { await notificationService.markAllAsRead?.(); paintBadge(); panel.classList.remove('open'); });
  header.querySelector('#tb-nclear').addEventListener('click', async () => { await notificationService.clear?.(); paintBadge(); panel.classList.remove('open'); });

  /* theme quick cycle → jump to appearance (spec 34 owns switching) */
  /* ---- quick theme switcher popover (spec 39) ---- */
  let qts = null;
  const qtsClose = () => { qts?.remove(); qts = null; document.removeEventListener('pointerdown', qtsOutside, true); };
  const qtsOutside = (e) => { if (qts && !qts.contains(e.target) && !e.target.closest('#tb-theme')) qtsClose(); };
  function qtsOpen(anchor) {
    qtsClose();
    qts = document.createElement('div');
    qts.className = 'z-qts'; qts.setAttribute('role', 'menu');
    const c = themeEngine.get();
    const all = [...PRESETS, ...c.customThemes.map((t) => ({ ...t, custom: true }))];
    const activeId = themeEngine.activePresetId();
    qts.innerHTML = '<div data-role="title">مظاهر zPopcorn</div>';
    all.forEach((t) => {
      const conf = t.config || {};
      const bg = conf.colors?.['bg-app'] || '#0B0B0D';
      const acc = conf.accent?.primary || '#7B6CF6';
      const acc2 = conf.accent?.secondary || '#3FDCF2';
      const b = document.createElement('button');
      b.type = 'button';
      if (activeId === t.id) b.classList.add('on');
      b.innerHTML = `<span class="sw" style="background:${bg}"><i style="background:${acc}"></i><i style="background:${acc2}"></i></span><span>${esc(t.name)}</span>${t.custom ? '<span class="z-pill" style="margin-inline-start:auto;font-size: var(--text-3xs)">مخصص</span>' : ''}`;
      b.addEventListener('click', () => {
        themeEngine.applyPreset(t.id);
        window.dispatchEvent(new CustomEvent('showtoast', { detail: { message: `طُبِّق «${t.name}»`, type: 'success' } }));
        qtsClose();
      });
      qts.appendChild(b);
    });
    qts.insertAdjacentHTML('beforeend', `<div class="sep"></div><button type="button" class="more">${icon('sliders', 14)} استوديو المظهر الكامل</button>`);
    qts.querySelector('.more').addEventListener('click', () => { qtsClose(); router.navigate('/settings/appearance'); });
    document.body.appendChild(qts);
    const r = anchor.getBoundingClientRect();
    qts.style.top = `${r.bottom + 8}px`;
    qts.style.left = `${Math.max(8, Math.min(r.left, innerWidth - 312))}px`;
    qts.style.right = 'auto';
    setTimeout(() => document.addEventListener('pointerdown', qtsOutside, true), 0);
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') qtsClose(); }, { once: true });
  }
  header.querySelector('#tb-theme').addEventListener('click', (e) => {
    if (qts) { qtsClose(); return; }
    qtsOpen(e.currentTarget);
  });
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 't') {
      e.preventDefault();
      const c = themeEngine.get();
      const all = [...PRESETS, ...c.customThemes];
      if (!all.length) return;
      const cur = all.findIndex((x) => x.id === themeEngine.activePresetId());
      const next = all[(cur + 1) % all.length];
      themeEngine.applyPreset(next.id);
      window.dispatchEvent(new CustomEvent('showtoast', { detail: { message: `السمة: «${next.name}»`, type: 'info', duration: 1400 } }));
    }
  });

  /* Ctrl+K focuses (native menu also emits navigate on desktop) */
  const focusSearch = () => { input.focus(); input.select(); };
  window.zpFocusSearch = focusSearch;

  return header;
}
