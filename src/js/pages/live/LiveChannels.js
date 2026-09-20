/**
 * All Channels — the Live discovery engine (spec 10/11).
 * Windowed rendering (only visible rows exist in the DOM), instant normalized
 * search, group/country/source/category filters, grid & row views.
 */
import { el, esc } from '../../ui/primitives.js';
import { icon } from '../../ui/icons.js';
import { live, normText } from '../../services/live/LiveService.js';
import { COUNTRY_NAMES } from '../../services/live/m3u.js';
import { liveShell, channelTile, stateBlock, launchChan, toast, fmtClock } from './live-ui.js';

const TILE_H = 150, TILE_GAP = 12, ROW_H = 54;

export async function LiveChannelsPage(params, query = {}) {
  await live.init();
  await live.loadEpgDocs();
  const root = el('div', 'zlv-page zlv-channels');
  const { frag, main } = liveShell('channels');
  root.appendChild(frag);

  const state = {
    q: query.q || '', cat: query.cat || '', group: query.group || '',
    country: query.country || '', source: query.source || '',
    fav: query.fav === '1', recent: query.recent === '1',
    sort: query.sort || 'name',
    view: localStorage.getItem('zpopcn-live-view') || 'grid',
  };

  if (!live.stats().sources) {
    main.appendChild(stateBlock({
      anim: 'empty', title: 'لا مصادر بعد',
      desc: 'أضف قائمة IPTV لتظهر القنوات هنا.',
      primary: { label: 'إلى صفحة المصادر', icon: 'sources', onClick: () => (window.location.hash = '#/live/sources') },
    }));
    return root;
  }

  /* ── toolbar ── */
  const bar = el('div', 'zlv-toolbar');
  const cats = live.categories();
  const catChips = [['', 'الكل'], ['sports', 'رياضة'], ['news', 'أخبار'], ['movies', 'أفلام'], ['series', 'مسلسلات'], ['kids', 'أطفال'], ['music', 'موسيقى'], ['documentary', 'وثائقيات'], ['religious', 'دينية'], ['entertainment', 'منوعات']]
    .filter(([k]) => k === '' || (cats.get(k) || 0) > 0);
  bar.innerHTML = `
    <div class="zlv-search">${icon('search', 16)}<input type="search" placeholder="ابحث في ${live.visible().length.toLocaleString('ar-EG')} قناة — اسم، مجموعة، دولة…" aria-label="بحث القنوات"></div>
    <div class="zlv-chips">
      <button class="chip ${state.fav ? 'on' : ''}" data-special="fav">${icon('heart', 13)} المفضلة</button>
      <button class="chip ${state.recent ? 'on' : ''}" data-special="recent">${icon('clock', 13)} شوهد مؤخرًا</button>
      ${catChips.map(([k, l]) => `<button class="chip ${state.cat === k && k ? 'on' : ''}" data-cat="${k}">${esc(l)}${k ? ` <b>${cats.get(k)}</b>` : ''}</button>`).join('')}
    </div>
    <div class="zlv-filters">
      <select data-f="group" aria-label="المجموعة"><option value="">كل المجموعات</option>${live.groups().slice(0, 300).map((g) => `<option value="${esc(g.label)}" ${state.group === g.label ? 'selected' : ''}>${esc(g.label)} (${g.count})</option>`).join('')}</select>
      <select data-f="country" aria-label="الدولة"><option value="">كل الدول</option>${live.countries().map((c) => `<option value="${c.key}" ${state.country === c.key ? 'selected' : ''}>${esc(COUNTRY_NAMES[c.key] || c.key)} (${c.count})</option>`).join('')}</select>
      <select data-f="source" aria-label="المصدر"><option value="">كل المصادر</option>${live.sources.map((s) => `<option value="${s.id}" ${state.source === s.id ? 'selected' : ''}>${esc(s.name)} (${s.channelCount || 0})</option>`).join('')}</select>
      <select data-f="sort" aria-label="الترتيب">
        <option value="name" ${state.sort === 'name' ? 'selected' : ''}>أبجدي</option>
        <option value="recent" ${state.sort === 'recent' ? 'selected' : ''}>الأحدث مشاهدة</option>
        <option value="fav" ${state.sort === 'fav' ? 'selected' : ''}>المفضلة أولاً</option>
      </select>
      <button class="zlv-view" data-view title="تبديل العرض">${icon(state.view === 'grid' ? 'rows' : 'grid', 15)}</button>
    </div>
  `;
  const countEl = el('div', 'zlv-count');
  main.appendChild(bar);
  main.appendChild(countEl);

  /* ── virtual scroller ── */
  const scroller = el('div', 'zlv-scroller');
  const spacer = el('div', 'zlv-spacer');
  const win = el('div', 'zlv-win');
  spacer.appendChild(win);
  scroller.appendChild(spacer);
  main.appendChild(scroller);

  let list = [];
  let cols = 6, rows = 0, rowH = TILE_H + TILE_GAP;

  const applyFilters = () => {
    list = live.channels({
      q: state.q, cat: state.cat, group: state.group, country: state.country,
      source: state.source, sort: state.sort,
    });
    if (state.fav) {
      const favIds = new Set(live.favChannels().map((f) => f.chanId || f.id));
      list = list.filter((c) => favIds.has(c.id));
    }
    if (state.recent) {
      const seen = new Set(live.recent(200).map((h) => h.chanId));
      list = list.filter((c) => seen.has(c.id));
    }
    countEl.innerHTML = list.length
      ? `${icon('signal', 12)} <b>${list.length.toLocaleString('ar-EG')}</b> قناة${(state.q || state.cat || state.group || state.country || state.source) ? ` من ${live.visible().length.toLocaleString('ar-EG')}` : ''}`
      : '';
    layout();
  };

  const measure = () => {
    const w = scroller.clientWidth || 800;
    if (state.view === 'grid') {
      cols = Math.max(2, Math.floor((w + TILE_GAP) / (158 + TILE_GAP)));
      rowH = TILE_H + TILE_GAP;
    } else { cols = 1; rowH = ROW_H; }
    scroller.style.setProperty('--cols', String(cols)); // paint + CSS must agree, or windowing drifts
    rows = Math.ceil(list.length / cols);
    spacer.style.height = Math.max(1, rows * rowH + 8) + 'px';
  };

  const paint = () => {
    const top = scroller.scrollTop;
    const h = scroller.clientHeight || 600;
    const first = Math.max(0, Math.floor(top / rowH) - 2);
    const last = Math.min(rows, Math.ceil((top + h) / rowH) + 2);
    win.style.transform = `translateY(${first * rowH}px)`;
    win.innerHTML = '';
    const fragL = document.createDocumentFragment();
    for (let r = first; r < last; r++) {
      const rowEl = el('div', `zlv-row ${state.view === 'list' ? 'as-rows' : ''}`);
      for (let c = 0; c < cols; c++) {
        const chan = list[r * cols + c];
        if (!chan) continue;
        if (state.view === 'list') rowEl.appendChild(rowTile(chan));
        else rowEl.appendChild(channelTile(chan, { ctx: list }));
      }
      fragL.appendChild(rowEl);
    }
    win.appendChild(fragL);
  };

  function rowTile(chan) {
    const t = el('button', 'zlv-rowt');
    const cn = live.currentNext(chan);
    t.innerHTML = `
      <span class="zlv-name">${esc(chan.name)}</span>
      <span class="zlv-grp">${esc(chan.group || '')}</span>
      <span class="zlv-ctry">${chan.country ? esc(COUNTRY_NAMES[chan.country] || chan.country) : '—'}</span>
      <span class="zlv-prog">${cn?.cur
        ? `<i class="tt" style="width:${Math.round(((Date.now() - cn.cur.s) / Math.max(1, cn.cur.e - cn.cur.s)) * 100)}%"></i><b>${esc(cn.cur.t)}</b> <em>${fmtClock(cn.cur.s)}–${fmtClock(cn.cur.e)}</em>`
        : '<em class="dim">—</em>'}</span>
      <span class="zlv-racts">
        <span data-fav class="${live.isFav(chan.id) ? 'on' : ''}">${icon(live.isFav(chan.id) ? 'heartFill' : 'heart', 15)}</span>
        <span data-copy title="نسخ رابط البث">${icon('dup', 14)}</span>
        <span data-hide title="إخفاء من القوائم">${icon('eyeOff', 14)}</span>
      </span>`;
    t.addEventListener('click', (e) => {
      const act = e.target.closest('[data-fav],[data-copy],[data-hide]');
      if (!act) { if (!chan.orphan) launchChan(chan, list); return; }
      if (act.dataset.fav !== undefined) live.toggleFav(chan).then((on) => { act.classList.toggle('on', on); act.innerHTML = icon(on ? 'heartFill' : 'heart', 15); });
      if (act.dataset.copy !== undefined) live.copyStream(chan).then((ok) => toast(ok ? 'success' : 'error', ok ? 'نُسخ الرابط' : 'تعذّر النسخ', ok ? '' : 'انسخه يدويًا من معلومات القناة'));
      if (act.dataset.hide !== undefined) live.toggleHidden(chan).then(() => { toast('info', 'أُخفيت القناة', 'يمكن التراجع من إعدادات Live'); applyFilters(); });
    });
    return t;
  }

  /* ── wiring ── */
  const searchInput = bar.querySelector('input');
  searchInput.value = state.q;
  let deb = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(deb);
    deb = setTimeout(() => { state.q = searchInput.value; applyFilters(); }, 140);
  });
  bar.querySelectorAll('[data-cat]').forEach((b) => b.addEventListener('click', () => {
    state.cat = state.cat === b.dataset.cat ? '' : b.dataset.cat;
    bar.querySelectorAll('[data-cat]').forEach((x) => x.classList.toggle('on', x.dataset.cat === state.cat && state.cat));
    applyFilters();
  }));
  bar.querySelectorAll('[data-special]').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.special;
    state[k] = !state[k];
    b.classList.toggle('on', state[k]);
    applyFilters();
  }));
  bar.querySelectorAll('select[data-f]').forEach((sel) => sel.addEventListener('change', () => {
    state[sel.dataset.f] = sel.value;
    if (sel.dataset.f === 'sort') localStorage.setItem('zpopcn-live-sort', sel.value);
    applyFilters();
  }));
  bar.querySelector('[data-view]').addEventListener('click', (e) => {
    state.view = state.view === 'grid' ? 'list' : 'grid';
    localStorage.setItem('zpopcn-live-view', state.view);
    e.currentTarget.innerHTML = icon(state.view === 'grid' ? 'rows' : 'grid', 15);
    scroller.className = `zlv-scroller${state.view === 'list' ? ' list-mode' : ''}`;
    layout(true);
  });
  scroller.className = `zlv-scroller${state.view === 'list' ? ' list-mode' : ''}`;

  let raf = 0;
  scroller.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; paint(); }); }, { passive: true });
  const onResize = () => layout(true);
  window.addEventListener('resize', onResize);

  const relayoutDeb = () => layout();
  let liveEv = null;
  const onEvent = (e) => {
    const t = e.detail?.type;
    if (t === 'imported' || t === 'sources' || t === 'favs' || t === 'config') { applyFilters(); }
    if (t === 'progress' && e.detail?.partial) applyFilters(); // §31: first batch becomes browsable while parsing continues
  };
  window.addEventListener('zpopcn-live', onEvent);

  function layout(full = false) {
    measure();
    if (full) scroller.scrollTop = 0;
    paint();
  }

  root.__zpopCleanup = () => {
    window.removeEventListener('resize', onResize);
    window.removeEventListener('zpopcn-live', onEvent);
    clearTimeout(deb);
    if (raf) cancelAnimationFrame(raf);
  };

  applyFilters();
  return root;
}
