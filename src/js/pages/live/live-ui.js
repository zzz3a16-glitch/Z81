/**
 * zPopcorn LIVE — shared UI kit (spec 17): tiles, rails, states, shell.
 * One visual grammar for the whole Live platform; everything theme-token
 * driven (no colors here), RTL-safe, logos lazy via a shared observer.
 */
import { el, esc } from '../../ui/primitives.js';
import { icon } from '../../ui/icons.js';
import { live } from '../../services/live/LiveService.js';

export const fmtClock = (ms) => {
  try { return new Intl.DateTimeFormat('ar-EG-u-nu-latn', { hour: '2-digit', minute: '2-digit', hour12: false }).format(ms); }
  catch { const d = new Date(ms); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }
};
export const fmtDur = (mins) => (mins >= 60 ? `${Math.floor(mins / 60)} س ${mins % 60} د` : `${mins} د`);
export const ago = (t) => {
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (m < 1) return 'الآن';
  if (m < 60) return `قبل ${m} د`;
  const h = Math.round(m / 60); if (h < 24) return `قبل ${h} س`;
  return `قبل ${Math.round(h / 24)} يوم`;
};

export const toast = (type, title, message) =>
  window.dispatchEvent(new CustomEvent('showtoast', { detail: { type, title, message, duration: 4200 } }));

export async function launchChan(chan, ctx) {
  try {
    const r = await live.launch(chan, { context: ctx });
    if (r?.via === 'failed') toast('warning', 'تعذّر الفتح', 'لم يستجب أي مشغّل مرتبط — جرّب وضع الرابط المباشر من الإعدادات.');
    else toast('success', 'تم التشغيل', `${chan.name} — فُتحت في المشغّل الخارجي`);
  } catch (e) {
    toast('error', 'خطأ في التشغيل', e?.message || 'تعذّر تشغيل القناة');
  }
}

/* ── shared lazy-logo machinery: only visible tiles ever touch the cache ── */
let logoObs = null;
function observeLogos() {
  if (logoObs || typeof IntersectionObserver === 'undefined') return null;
  logoObs = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      logoObs.unobserve(en.target);
      fillLogo(en.target);
    }
  }, { rootMargin: '220px' });
  return logoObs;
}
async function fillLogo(box) {
  const chan = box.__chan; if (!chan) return;
  let src = live.logoSrc(chan);
  if (src === undefined) { src = await live.ensureLogo(chan); }
  if (!src) return;
  if (!box.isConnected) return;
  box.classList.add('has-logo');
  box.innerHTML = `<img src="${esc(src)}" alt="" loading="lazy" decoding="async" onerror="this.closest('.zlv-logo').classList.remove('has-logo')">`;
}

/* ── channel tile ── */
export function channelTile(chan, { list = false, ctx = null } = {}) {
  const obs = observeLogos();
  const fav = live.isFav(chan.id);
  const cn = live.currentNext(chan);
  const t = el('button', `zlv-tile${list ? ' as-row' : ''}${chan.orphan ? ' is-orphan' : ''}`);
  t.type = 'button';
  t.dataset.chan = chan.id;
  t.innerHTML = `
    <span class="zlv-logo${list ? ' sm' : ''}" aria-hidden="true">${esc((chan.name || '?').slice(0, 2).toUpperCase())}</span>
    <span class="zlv-meta">
      <span class="zlv-name">${esc(chan.name)}</span>
      ${list ? '' : `<span class="zlv-group">${esc(chan.group || '')}</span>`}
      ${cn?.cur ? `<span class="zlv-now">${icon('bolt', 11, { weight: 'fill' })}${esc(cn.cur.t)}</span>` : ''}
    </span>
    ${cn?.cur ? `<span class="zlv-tt" style="--p:${Math.round((cn.pct ?? (Date.now() - cn.cur.s) / (cn.cur.e - cn.cur.s)) * 100)}%"></span>` : ''}
    <span class="zlv-hover">
      <span class="zlv-play">${icon(list ? 'playCircle' : 'play', list ? 22 : 26, { weight: 'bold' })}</span>
    </span>
    <span class="zlv-fav${fav ? ' on' : ''}" data-fav title="المفضلة">${icon(fav ? 'heartFill' : 'heart', 15)}</span>
    ${chan.orphan ? '<span class="zlv-orphan" title="اختفت من المصدر بعد آخر تحديث">معلّقة</span>' : ''}
  `;
  const logoBox = t.querySelector('.zlv-logo');
  logoBox.__chan = chan;
  const direct = live.logoSrc(chan);
  if (direct) fillLogo(logoBox); else if (obs) obs.observe(logoBox);
  t.addEventListener('click', (e) => {
    if (e.target.closest('[data-fav]')) {
      live.toggleFav(chan).then((on) => {
        const f = t.querySelector('.zlv-fav');
        f.classList.toggle('on', on);
        f.innerHTML = icon(on ? 'heartFill' : 'heart', 15);
      });
      return;
    }
    if (chan.orphan) { toast('warning', 'القناة غير متاحة', 'لم تعد هذه القناة في قائمة المصدر — حدّث المصدر من صفحة المصادر.'); return; }
    launchChan(chan, ctx);
  });
  return t;
}

/* ── rail of tiles (horizontal) ── */
export function rail(chans, { ctx = null } = {}) {
  const r = el('div', 'zlv-rail');
  const list = chans.slice(0, 16);
  for (const c of list) r.appendChild(channelTile(c, { ctx }));
  return r;
}

export function sectionBlock({ title, sub = '', action = null }) {
  const sec = el('section', 'zlv-sec');
  const h = el('header', 'zlv-sec-head', `
    <h3>${esc(title)}</h3>
    ${sub ? `<p>${esc(sub)}</p>` : ''}
    <span class="sp"></span>
    ${action ? `<a role="button" tabindex="0" class="zlv-more">${esc(action.label)}${icon('chevL', 13)}</a>` : ''}
  `);
  if (action?.href) {
    const a = h.querySelector('.zlv-more');
    a.addEventListener('click', () => (window.location.hash = action.href));
    a.addEventListener('keydown', (e) => { if (e.key === 'Enter') window.location.hash = action.href; });
  } else if (action?.onClick) {
    const a = h.querySelector('.zlv-more');
    a.addEventListener('click', action.onClick);
  }
  sec.appendChild(h);
  return { sec, head: h };
}

/* ── premium state block with a real action (spec 16) ── */
export function stateBlock({ icon: ic = 'inbox', anim = null, title, desc = '', primary = null, secondary = null, size = 56 }) {
  const box = el('div', 'zlv-state');
  box.innerHTML = `
    <div class="art">${ic}</div>
    <h4>${esc(title)}</h4>
    ${desc ? `<p>${esc(desc)}</p>` : ''}
    <div class="acts"></div>
  `;
  const art = box.querySelector('.art');
  if (anim) import('../../ui/IconFX.js').then((m) => { art.innerHTML = m.iconAnim(anim, size); });
  else art.innerHTML = icon(ic, size, { weight: 'duotone' });
  const acts = box.querySelector('.acts');
  const mkBtn = (a, cls) => {
    const b = el('button', cls, `${a.icon ? icon(a.icon, 15) : ''} ${esc(a.label)}`);
    b.type = 'button';
    b.addEventListener('click', () => a.onClick());
    acts.appendChild(b);
  };
  if (primary) mkBtn(primary, 'btn btn-primary btn-sm');
  if (secondary) mkBtn(secondary, 'btn btn-ghost btn-sm');
  return box;
}

export function statusPill(src) {
  const map = {
    ok: ['ok', 'يعمل', 'check'], importing: ['busy', 'جارٍ التحديث…', 'loading'],
    error: ['err', 'فشل', 'alert'], empty: ['warn', 'فارغ', 'inbox'], new: ['dim', 'جديد', 'sparkle'],
  };
  const [cls, label, ic] = map[src.status] || map.new;
  return `<span class="zlv-pill ${cls}">${icon(ic, 12)} ${esc(label)}</span>`;
}

/* ── page shell with tabs ── */
export function liveShell(active) {
  const frag = document.createDocumentFragment();
  const head = el('div', 'zlv-head');
  head.innerHTML = `
    <h1 class="zlv-title">${icon('live', 22, { weight: 'bold' })} مباشر</h1>
    <nav class="zlv-tabs" role="tablist">
      ${[['', 'الرئيسية', 'home'], ['channels', 'القنوات', 'grid'], ['guide', 'دليل TV', 'guide'], ['sources', 'المصادر', 'sources'], ['settings', 'الإعدادات', 'gear']]
    .map(([k, l, ic]) => `<a href="#/live${k ? `/${k}` : ''}" class="zlv-tab${active === k ? ' on' : ''}" role="tab" aria-selected="${active === k}">${icon(ic, 15)}<span>${l}</span></a>`).join('')}
    </nav>
  `;
  frag.appendChild(head);
  const main = el('div', 'zlv-body');
  frag.appendChild(main);
  return { frag, main };
}
