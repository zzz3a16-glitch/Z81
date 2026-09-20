/**
 * zPopcorn UI primitives — the shared vocabulary every page must use
 * (spec 17, 30–32, 51). No page should hand-roll a header, empty state,
 * skeleton or rail again.
 */
import { icon } from './icons.js';

export const el = (tag, cls = '', html = '') => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html) n.innerHTML = html;
  return n;
};
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- section (title + subtitle + action + content) ---------- */
export function section({ title, subtitle = '', action = null, cls = '', wide = false }) {
  const root = el('section', `z-section ${cls}`);
  const head = el('header', 'z-section-head', `
    <h2 class="t">${esc(title)}</h2>
    ${subtitle ? `<p class="s">${esc(subtitle)}</p>` : ''}
    <span class="spacer"></span>
    ${action ? `<a class="more" role="button" tabindex="0">${esc(action.label)}${icon(action.icon || 'chevL', 14)}</a>` : ''}
  `);
  root.appendChild(head);
  if (action?.onClick) {
    const a = head.querySelector('.more');
    a.addEventListener('click', action.onClick);
    a.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); action.onClick(); } });
  }
  return { root, head, body: appendBody(root, wide) };
}
function appendBody(root, wide) {
  const body = el('div', wide ? 'z-rail-wrap' : '');
  root.appendChild(body);
  return body;
}

/* ---------- grids ---------- */
export function gridEl(cls = '') { return el('div', `media-grid ${cls}`); }
export function skelGrid(count = 10, wide = false) {
  const g = el('div', 'media-grid');
  for (let i = 0; i < count; i++) g.appendChild(el('div', `sk sk-card ${wide ? 'wide' : ''}`));
  return g;
}
export function skelRail(count = 6, wide = true) {
  const r = el('div', 'z-rail');
  for (let i = 0; i < count; i++) r.appendChild(el('div', `sk sk-card ${wide ? 'wide' : ''}`));
  return r;
}
export const skelHero = () => el('div', 'sk sk-hero');
export const skelLines = (n = 3) => {
  const b = el('div', '');
  b.style.cssText = 'display:flex;flex-direction:column;gap:10px;';
  for (let i = 0; i < n; i++) b.appendChild(el('div', 'sk sk-line', '')).style.width = `${100 - i * 12}%`;
  return b;
};
export const skelRows = (n = 5) => {
  const b = el('div', '');
  b.style.cssText = 'display:flex;flex-direction:column;gap:6px;';
  for (let i = 0; i < n; i++) b.appendChild(el('div', 'sk sk-row'));
  return b;
};

/* ---------- horizontal rail with scroll buttons ---------- */
export function railEl(cards = [], { snapCards = 'var(--card-w)' } = {}) {
  const wrap = el('div', 'z-rail-wrap');
  const rail = el('div', 'z-rail');
  rail.style.gridAutoColumns = `minmax(${snapCards}, ${snapCards})`;
  cards.forEach((c) => rail.appendChild(c));
  const prev = railBtn('prev');
  const next = railBtn('next');
  const go = (dir) => rail.scrollBy({ left: dir * Math.max(280, rail.clientWidth * 0.8), behavior: 'smooth' });
  prev.addEventListener('click', () => go(-1));
  next.addEventListener('click', () => go(1));
  wrap.append(rail, prev, next);
  const sync = () => {
    const rtl = getComputedStyle(rail).direction === 'rtl';
    const max = rail.scrollWidth - rail.clientWidth - 2;
    prev.style.opacity = (rtl ? rail.scrollLeft >= max : rail.scrollLeft <= 2) ? .25 : 1;
    next.style.opacity = (rtl ? rail.scrollLeft <= 2 : rail.scrollLeft >= max) ? .25 : 1;
  };
  rail.addEventListener('scroll', sync, { passive: true });
  requestAnimationFrame(sync);
  return { wrap, rail, sync };
}
function railBtn(dir) {
  const b = el('button', `z-rail-btn ${dir}`, icon(dir === 'prev' ? 'chevL' : 'chevR', 16));
  b.setAttribute('aria-label', dir === 'prev' ? 'السابق' : 'التالي');
  b.tabIndex = -1;
  return b;
}
/** section + rail composed in one call (the standard "row" on Home/Movies…) */
export function railSection(title, cards, opts = {}) {
  const { subtitle, action, wide, cardWidth } = opts;
  const s = section({ title, subtitle, action, wide: true });
  if (!cards.length) return null;
  const { wrap, rail } = railEl(cards, { snapCards: cardWidth || (wide ? 'clamp(280px, 26vw, 360px)' : 'var(--card-w)') });
  s.body.appendChild(wrap);
  if (wide) rail.style.gridAutoColumns = 'minmax(clamp(280px, 26vw, 360px), clamp(280px, 26vw, 360px))';
  return s.root;
}

/* ---------- states (spec 30/32) ---------- */
export function emptyState({ iconName = 'inbox', title, desc = '', actions = [] }) {
  const s = el('div', 'z-state', `
    <div class="art">${icon(iconName, 30, { stroke: 1.5 })}</div>
    <h3>${esc(title)}</h3>
    ${desc ? `<p>${esc(desc)}</p>` : ''}
  `);
  if (actions.length) {
    const a = el('div', 'acts');
    actions.forEach((act) => {
      const b = el('button', `btn ${act.kind === 'ghost' ? 'btn-ghost' : 'btn-primary'} btn-sm`, `${act.icon ? icon(act.icon, 14) : ''}${esc(act.label)}`);
      b.addEventListener('click', () => act.onClick?.());
      a.appendChild(b);
    });
    s.appendChild(a);
  }
  return s;
}
export function errorState({ title = 'لم نتمكن من تحميل هذا المحتوى', desc = '', onRetry = null }) {
  const s = el('div', 'z-state err', `
    <div class="art">${icon('alert', 30, { stroke: 1.6 })}</div>
    <h3>${esc(title)}</h3>
    ${desc ? `<p>${esc(desc)}</p>` : ''}
  `);
  if (onRetry) {
    const a = el('div', 'acts');
    const b = el('button', 'btn btn-secondary btn-sm', `${icon('refresh', 14)} إعادة المحاولة`);
    b.addEventListener('click', onRetry);
    a.appendChild(b);
    s.appendChild(a);
  }
  return s;
}
/** render into a page container: paint an error state, never a bare stack */
export function paintError(container, err, onRetry) {
  container.innerHTML = '';
  container.appendChild(errorState({ desc: err?.message || '', onRetry }));
}

/* ---------- tiny bits ---------- */
export const pill = (txt, kind = '') => `<span class="z-pill ${kind ? `z-pill-${kind}` : ''}">${esc(txt)}</span>`;
export function statPill(value, label) {
  return el('div', 'z-stat', `<b class="num">${esc(value)}</b><span>${esc(label)}</span>`);
}
export const fmtRuntime = (min) => (!min ? '' : min < 60 ? `${min}د` : `${Math.floor(min / 60)}س ${min % 60}د`);
export function fmtDateAr(d) {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('ar-SA-u-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' }); }
  catch { return String(d); }
}
export const ratingTone = (v) => (v >= 7.5 ? 'var(--color-success)' : v >= 6 ? 'var(--color-warning)' : v ? 'var(--color-danger)' : 'var(--color-text-faint)');
export function ratingBadge(v, { ring = false } = {}) {
  if (!v) return '';
  const n = Number(v);
  if (ring) {
    const c = ratingTone(n);
    const pct = (n / 10) * 113;
    return `<span class="ring" title="التقييم ${n.toFixed(1)}/10">
      <i style="background:conic-gradient(${c} ${pct}deg, var(--surface-4) 0); color:transparent">•</i>${n.toFixed(1)}</span>`;
  }
  return `<span class="rate" style="color:${ratingTone(n)}">${icon('star', 12)}<span class="num">${n.toFixed(1)}</span></span>`;
}
export function fallbackArt(name = '', { big = false } = {}) {
  return `<div class="fallback">
    <span class="mk">${icon('logo', big ? 26 : 18)}</span>
    ${big ? `<span style="font-size:11px;max-width:80%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(name)}</span>` : ''}
  </div>`;
}

/** Resolve a data-layer icon token (or legacy emoji) into the zPopcorn icon system. */
export function uiIcon(name, size = 16, cls = '') {
  const n = typeof name === 'string' ? name.trim() : '';
  const key = /^[a-z][a-z0-9]*$/i.test(n) ? n : 'disc';
  return icon(key, size, cls ? { cls } : undefined);
}
