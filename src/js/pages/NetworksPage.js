/**
 * §24/§25 — Networks page: one place uniting broadcast networks, streaming
 * platforms and studios over REAL TMDB data + real logos.
 * Laws honored: pinned = a STATE of the same card (never a second component);
 * no fake/curated lists; unavailable data → honest empty/error state.
 */
import { el, esc, emptyState, paintError, skelGrid } from '../ui/primitives.js';
import { icon } from '../ui/icons.js';
import { getTMDBImageUrl } from '../services/tmdb/TMDBImage.js';
import { tmdbClient } from '../services/tmdb/TMDBClient.js';
import { netPins } from '../services/net/NetPins.js';

const region = () => localStorage.getItem('zpopcorn-region') || 'SA';

export async function NetworksPage() {
  const page = el('div', 'z-nets');
  page.innerHTML = `
    <div class="page-header">
      <h1 class="page-title">الشبكات</h1>
      <p class="page-subtitle">شبكات البث، منصات المشاهدة، والاستوديوهات — بشعاراتها الحقيقية من TMDB. ثبّت ما تتابعه ليصل إلى الرئيسية.</p>
    </div>
    <div class="container z-nets-bar">
      <div class="z-nets-tabs" role="tablist" aria-label="نوع المصدر">
        <button class="chip active" role="tab" aria-selected="true" data-src="networks">شبكات البث</button>
        <button class="chip" role="tab" aria-selected="false" data-src="providers">منصات المشاهدة</button>
        <button class="chip" role="tab" aria-selected="false" data-src="studios">الاستوديوهات</button>
      </div>
      <input class="input input-sm" id="net-q" placeholder="بحث بالاسم…" aria-label="بحث في الشبكات" autocomplete="off" style="width:200px">
    </div>
    <div class="container">
      <p class="z-nets-note" id="net-note" hidden></p>
      <div class="media-grid" id="net-grid"></div>
    </div>`;

  const grid = page.querySelector('#net-grid');
  const note = page.querySelector('#net-note');
  const qInput = page.querySelector('#net-q');
  let src = 'networks';
  let rows = [];          // current tab's loaded rows
  let q = '';
  let seq = 0;

  const paint = () => {
    grid.innerHTML = '';
    const pinOrder = netPins.list();
    let list = rows;
    if (q) {
      const lq = q.toLowerCase();
      list = list.filter((r) => r.name.toLowerCase().includes(lq));
    }
    if (!list.length) {
      grid.appendChild(emptyState({
        iconName: src === 'studios' ? 'search' : 'inbox',
        title: src === 'studios' ? 'اكتب اسم الاستوديو للبحث' : 'لا نتائج مطابقة',
        desc: src === 'studios'
          ? 'الاستوديوهات تُبحث في TMDB بالاسم — اكتب حرفين على الأقل.'
          : (q ? 'جرّب كلمة أخرى.' : 'تعذّر جلب القائمة — تحقق من الاتصال.'),
      }));
      return;
    }
    // Pinned first — same card, changed state (§24).
    list = [...list].sort((a, b) => {
      const pa = pinOrder.indexOf(a.key), pb = pinOrder.indexOf(b.key);
      if ((pb >= 0) - (pa >= 0) !== 0) return (pb >= 0) - (pa >= 0);
      return (b.rank || 0) - (a.rank || 0);
    });
    const frag = document.createDocumentFragment();
    list.forEach((r) => frag.appendChild(card(r)));
    grid.appendChild(frag);
  };

  const card = (r) => {
    const pinned = netPins.has(r.key);
    const c = el('article', 'z-netcard' + (pinned ? ' on' : ''));
    c.tabIndex = 0;
    c.innerHTML = `
      <button class="z-netpin${pinned ? ' on' : ''}" type="button" aria-pressed="${pinned}"
        title="${pinned ? 'إلغاء التثبيت' : 'تثبيت في الرئيسية'}">${icon('pin', 13)}</button>
      <div class="logo">
        ${r.logo ? `<img src="${esc(getTMDBImageUrl(r.logo, 'logo', 'w300'))}" alt="" loading="lazy">` : `<span>${esc(r.name.slice(0, 2).toUpperCase())}</span>`}
      </div>
      <h3>${esc(r.name)}</h3>
      <div class="z-netmeta">
        ${r.country ? `<span class="z-pill">${esc(r.country)}</span>` : ''}
        ${r.avail ? `<span class="z-pill z-pill-ok">متاحة في ${esc(r.avail)}</span>` : ''}
        ${pinned ? '<span class="z-pill z-pill-accent">مثبتة</span>' : ''}
      </div>`;
    const go = (e) => {
      if (e.target.closest('.z-netpin')) return;
      if (r.link) window.open(r.link, '_blank', 'noopener');
      else window.router.navigate(`/company/${r.id}`);
    };
    c.addEventListener('click', go);
    c.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(e); } });
    c.querySelector('.z-netpin').addEventListener('click', (e) => {
      e.stopPropagation();
      const now = netPins.toggle(r.key);
      c.classList.toggle('on', now);
      const b = c.querySelector('.z-netpin');
      b.classList.toggle('on', now);
      b.setAttribute('aria-pressed', String(now));
      b.title = now ? 'إلغاء التثبيت' : 'تثبيت في الرئيسية';
    });
    return c;
  };

  const load = async () => {
    const my = ++seq;
    grid.innerHTML = '';
    grid.appendChild(skelGrid(12));
    note.hidden = true;
    rows = [];
    try {
      if (src === 'networks') {
        const res = await tmdbClient.request('tv/networks');
        rows = (res?.results || []).map((n) => ({
          key: `n:${n.id}`, id: n.id, name: n.name || '—', logo: n.logo_path,
          country: n.origin_country || '', rank: 1,
        }));
      } else if (src === 'providers') {
        const wp = await tmdbClient.request('watch/providers/movie');
        const rg = region();
        rows = Object.entries(wp?.results || {}).map(([id, p]) => ({
          key: `p:${id}`, id, name: p.provider_name || id, logo: p.logo_path,
          avail: p[rg] ? rg : '', rank: p.display_priority || 0,
          link: (p[rg] || p['US'] || {}).link || '',
        }));
        note.hidden = false;
        note.textContent = `تُعرض إتاحة ${rg} حسب TMDB Watch Providers — المنصة غير المتاحة هنا تظهر بلا شارة إتاحة.`;
      }
      if (my !== seq) return;   // a newer tab replaced this load
      paint();
    } catch (e) {
      if (my !== seq) return;
      grid.innerHTML = '';
      paintError(grid, e, load);
    }
  };

  // studios tab is search-driven against TMDB — never a curated fake list.
  let stq = null;
  qInput.addEventListener('input', () => {
    clearTimeout(stq);
    stq = setTimeout(async () => {
      const v = qInput.value.trim();
      if (src !== 'studios') { q = v; paint(); return; }
      if (v.length < 2) { rows = []; q = v; paint(); return; }
      const my = ++seq;
      grid.innerHTML = '';
      grid.appendChild(skelGrid(6));
      try {
        const res = await tmdbClient.request('search/company', { query: v });
        if (my !== seq) return;
        rows = (res?.results || []).map((c) => ({
          key: `c:${c.id}`, id: c.id, name: c.name || '—', logo: c.logo_path,
          country: c.origin_country || '', rank: 1,
        }));
        q = '';
        paint();
      } catch (e) { if (my === seq) { grid.innerHTML = ''; paintError(grid, e, () => qInput.dispatchEvent(new Event('input'))); } }
    }, 350);
  });

  page.querySelectorAll('[data-src]').forEach((b) => b.addEventListener('click', () => {
    src = b.dataset.src;
    page.querySelectorAll('[data-src]').forEach((x) => {
      x.classList.toggle('active', x === b);
      x.setAttribute('aria-selected', String(x === b));
    });
    qInput.value = '';
    q = '';
    if (src !== 'studios') load(); else { rows = []; paint(); }
  }));

  window.addEventListener('zpopcorn:pins-changed', paint);
  load();
  return page;
}
