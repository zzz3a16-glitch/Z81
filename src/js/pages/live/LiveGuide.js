/**
 * TV Guide / EPG — horizontal timeline (spec 09) on ONE scroll canvas:
 * sticky time header, sticky channel column, programme blocks positioned from
 * real XMLTV data, a live "now" line, minute-scale zoom. Missing EPG says so
 * honestly and offers the fix — never fake cells.
 */
import { el, esc } from '../../ui/primitives.js';
import { icon } from '../../ui/icons.js';
import { live } from '../../services/live/LiveService.js';
import { dayKey } from '../../services/live/m3u.js';
import { liveShell, stateBlock, launchChan, fmtClock, toast } from './live-ui.js';

const DAY = 864e5;
const startOfDay = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };

export async function LiveGuidePage() {
  await live.init();
  await live.loadEpgDocs();
  const root = el('div', 'zlv-page zlv-guide');
  const { frag, main } = liveShell('guide');
  root.appendChild(frag);

  const epgSources = live.epgReadySources().filter((s) => s.enabled !== false);
  if (!epgSources.length) {
    main.appendChild(stateBlock({
      anim: 'empty', title: 'لا يوجد دليل برامج مُفعّل',
      desc: live.stats().sources
        ? 'مصادرُك لا تحمل رابط XMLTV. أضف رابط EPG لكل مصدر ليظهر الدليل — لا نختلق جداول وهمية.'
        : 'أضف مصدر IPTV أولاً، ثم اربطه برابط دليل (XMLTV).',
      primary: { label: 'إلى صفحة المصادر', icon: 'sources', onClick: () => (window.location.hash = '#/live/sources') },
    }));
    return root;
  }

  const st = { day: startOfDay(Date.now()), zoom: 3, source: '' };

  const bar = el('div', 'zlv-guidebar');
  bar.innerHTML = `
    <div class="zlv-daynav">
      <button class="z-iconbtn" data-d="-1" aria-label="أمس">${icon('chevR', 15)}</button>
      <button class="chip on" data-d="0">اليوم</button>
      <button class="chip" data-d="1">غدًا</button>
      <button class="z-iconbtn" data-d="1f" aria-label="اليوم التالي">${icon('chevL', 15)}</button>
    </div>
    <div class="zlv-daylabel">—</div>
    <span class="sp"></span>
    <select data-source aria-label="المصدر"><option value="">كل المصادر</option>${epgSources.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select>
    <div class="zlv-zoom" role="group" aria-label="مقياس زمني">
      <button class="z-iconbtn" data-zoom="-" aria-label="تصغير">${icon('minus', 13)}</button>
      <span>مقياس</span>
      <button class="z-iconbtn" data-zoom="+" aria-label="تكبير">${icon('plus', 13)}</button>
    </div>
    <button class="btn btn-ghost btn-sm" data-refresh>${icon('refresh', 14)} تحديث الدليل</button>
  `;
  const scroll = el('div', 'zlv-guidescroll');
  const canvas = el('div', 'zlv-guidecanvas');
  scroll.appendChild(canvas);
  main.appendChild(bar);
  main.appendChild(scroll);

  const dayLabel = bar.querySelector('.zlv-daylabel');

  function guideRows() {
    const srcIds = st.source ? [st.source] : epgSources.map((s) => s.id);
    const favIds = new Set(live.favChannels().map((f) => f.chanId || f.id));
    const pool = [];
    for (const c of live.visible()) {
      if (!srcIds.includes(c.src) || !c.epg) continue;
      if (!live.progs(c)) continue;
      pool.push(c);
    }
    pool.sort((a, b) => (favIds.has(b.id) - favIds.has(a.id)) || a.name.localeCompare(b.name, 'ar'));
    return pool.slice(0, 250); // bounded: 250-row guide is already a wall of text
  }

  const fmtDay = (ms) => {
    const t = startOfDay(Date.now());
    if (ms === t) return 'اليوم';
    if (ms === t + DAY) return 'غدًا';
    if (ms === t - DAY) return 'أمس';
    try { return new Intl.DateTimeFormat('ar', { weekday: 'long', day: 'numeric', month: 'long' }).format(ms); }
    catch { return new Date(ms).toLocaleDateString(); }
  };

  let rows = [];

  function render() {
    rows = guideRows();
    const pxh = st.zoom * 60;                       // px per hour
    const W = 24 * pxh;
    const from = st.day;
    const to = from + DAY;
    const nowMs = Date.now();
    const isToday = from === startOfDay(nowMs);
    const nowX = isToday ? ((Math.min(Math.max(nowMs, from), to) - from) / 3600e3) * pxh : -1;

    dayLabel.textContent = `${fmtDay(from)} — ${rows.length.toLocaleString('ar-EG')} قناة`;
    canvas.style.setProperty('--gw', `${W}px`);
    canvas.innerHTML = '';

    if (!rows.length) {
      canvas.style.removeProperty('--gw');
      canvas.appendChild(stateBlock({
        anim: 'empty', title: 'لا تطابق بين الدليل وقنواتك',
        desc: 'الدليل مُحمّل لكن لا قناة تحمل tvg-id مطابقًا له. حرّر مصادر tvg-id أو حدّث الدليل.',
        primary: { label: 'تحديث الدليل', icon: 'refresh', onClick: () => doRefresh() },
      }));
      return;
    }

    // time header row
    const ticks = [];
    for (let h = 0; h < 24; h += (st.zoom <= 2.2 ? 2 : 1)) ticks.push(`<span style="left:${h * pxh}px">${String(h).padStart(2, '0')}:00</span>`);
    canvas.insertAdjacentHTML('beforeend', `
      <div class="g-corner">القناة</div>
      <div class="g-head" style="width:${W}px">${ticks.join('')}${nowX >= 0 ? `<b class="nowdot" style="left:${nowX}px"></b>` : ''}</div>
    `);
    for (const c of rows) {
      const progs = live.dayProgs(c, dayKey(from)) || [];
      const cells = [];
      for (const p of progs) {
        const s = Math.max(p.s, from); const e = Math.min(p.e, to);
        if (e - s < 60e3) continue;
        const left = ((s - from) / 3600e3) * pxh;
        const w = Math.max(10, ((e - s) / 3600e3) * pxh - 3);
        const cur = isToday && nowMs >= p.s && nowMs < p.e;
        const pct = cur ? Math.round(((nowMs - p.s) / Math.max(1, p.e - p.s)) * 100) : 0;
        cells.push(`<button class="gp${cur ? ' cur' : ''}" data-st="${p.s}" data-en="${p.e}" style="left:${left}px;width:${w}px">
          <b>${esc(p.t)}</b>${pxh >= 150 ? `<span>${fmtClock(p.s)}</span>` : ''}
          ${cur ? `<i style="width:${pct}%"></i>` : ''}</button>`);
      }
      const srcName = live.sources.find((x) => x.id === c.src)?.name || '';
      canvas.insertAdjacentHTML('beforeend', `
        <div class="g-chan" title="${esc(c.name)} — ${esc(srcName)}">
          <span class="nm">${esc(c.name)}</span>
          <button class="fv ${live.isFav(c.id) ? 'on' : ''}" data-fav="${esc(c.id)}" aria-label="مفضلة">${icon(live.isFav(c.id) ? 'heartFill' : 'heart', 12)}</button>
        </div>
        <div class="g-lane" data-cid="${esc(c.id)}" style="width:${W}px">${cells.join('')}${nowX >= 0 ? `<s class="g-now" style="left:${nowX}px"></s>` : ''}</div>
      `);
    }
  }

  /* delegated interactions: program click → info + launch; fav toggle inline */
  canvas.addEventListener('click', (e) => {
    const fv = e.target.closest('[data-fav]');
    if (fv) {
      const c = live.channel(fv.dataset.fav);
      if (c) live.toggleFav(c).then((on) => { fv.classList.toggle('on', on); fv.innerHTML = icon(on ? 'heartFill' : 'heart', 12); });
      return;
    }
    const cell = e.target.closest('.gp');
    if (!cell) return;
    const lane = cell.closest('[data-cid]');
    const chan = live.channel(lane?.dataset.cid);
    if (!chan) return;
    const s = +cell.dataset.st;
    const prog = (live.dayProgs(chan, dayKey(st.day)) || []).find((p) => p.s === s);
    const box = el('div', 'zlv-pop');
    box.innerHTML = `
      <h4>${esc(prog?.t || cell.querySelector('b')?.textContent || '')}</h4>
      <p class="tm">${fmtClock(s)} — ${fmtClock(+cell.dataset.en)} · ${esc(chan.name)}</p>
      ${prog?.d ? `<p class="ds">${esc(prog.d)}</p>` : ''}
      <div class="ac"><button class="btn btn-primary btn-sm" type="button" data-go>${icon('play', 14)} تشغيل القناة</button></div>`;
    document.querySelector('.zlv-pop')?.remove();
    document.body.appendChild(box);
    const r = cell.getBoundingClientRect();
    box.style.top = `${Math.max(8, r.bottom + 8)}px`;
    box.style.left = `${Math.min(window.innerWidth - 310, Math.max(8, r.left))}px`;
    box.querySelector('[data-go]').addEventListener('click', () => { launchChan(chan, live.visible()); box.remove(); });
    setTimeout(() => {
      const off = (ev) => { if (!ev.target.closest('.zlv-pop')) { box.remove(); document.removeEventListener('pointerdown', off); } };
      document.addEventListener('pointerdown', off);
    }, 0);
    e.stopPropagation();
  });

  bar.addEventListener('click', (e) => {
    const d = e.target.closest('[data-d]');
    if (d) {
      const v = d.dataset.d;
      if (v === '0') st.day = startOfDay(Date.now());
      else if (v === '-1') st.day = Math.max(st.day - DAY, startOfDay(Date.now()) - DAY); // cache keeps one day back
      else if (v === '1f') st.day = Math.min(st.day + DAY, startOfDay(Date.now()) + DAY);
      bar.querySelectorAll('[data-d="0"],[data-d="1"]').forEach((b) => b.classList.remove('on'));
      if (st.day === startOfDay(Date.now())) bar.querySelector('[data-d="0"]')?.classList.add('on');
      if (st.day === startOfDay(Date.now()) + DAY) bar.querySelector('[data-d="1"]')?.classList.add('on');
      render(); scrollNearNow(); return;
    }
    const z = e.target.closest('[data-zoom]');
    if (z) { st.zoom = Math.min(10, Math.max(1.4, st.zoom * (z.dataset.zoom === '+' ? 1.3 : 1 / 1.3))); render(); scrollNearNow(); return; }
    if (e.target.closest('[data-refresh]')) doRefresh();
  });
  bar.querySelector('[data-source]').addEventListener('change', (e) => { st.source = e.target.value; render(); });

  async function doRefresh() {
    const btn = bar.querySelector('[data-refresh]');
    btn.disabled = true;
    const old = btn.innerHTML;
    btn.innerHTML = `${icon('loading', 14, { cls: 'spin' })} تحديث…`;
    const list = st.source ? epgSources.filter((s) => s.id === st.source) : epgSources;
    const results = [];
    for (const s of list) {
      if (!s) continue;
      results.push(await live.ensureEpg(s.id, { force: true }));
    }
    const ok = results.filter((r) => r.ok);
    toast(ok.length ? 'success' : 'warning', 'حالة الدليل',
      ok.length ? `تم تحديث ${ok.length} مصدر — ${ok.reduce((a, b) => a + (b.channels || 0), 0)} قناة` : 'فشل الجلب — تحقق من رابط EPG أو الاتصال');
    btn.disabled = false; btn.innerHTML = old;
    render(); scrollNearNow();
  }

  function scrollNearNow() {
    if (st.day !== startOfDay(Date.now())) return;
    const pxh = st.zoom * 60;
    const x = ((Date.now() - st.day) / 3600e3) * pxh;
    scroll.scrollTo({ left: Math.max(0, x - 140), behavior: 'smooth' });
  }

  const tick = setInterval(() => { if (root.isConnected) render(); }, 60e3);
  live.startEpgTicker();
  const onEv = (e) => { const t = e.detail?.type; if (t === 'epg' || t === 'favs' || t === 'sources' || t === 'imported') render(); };
  window.addEventListener('zpopcn-live', onEv);
  root.__zpopCleanup = () => { clearInterval(tick); window.removeEventListener('zpopcn-live', onEv); };

  render();
  requestAnimationFrame(scrollNearNow);
  return root;
}
