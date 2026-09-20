/**
 * Theme Studio — the control surface of ThemeEngine (spec 07–39).
 * One section per concern, live preview, premium color picker with
 * HEX/RGB/HSL/alpha, presets/customs manager with export/import.
 */
import { el, esc, emptyState } from '../ui/primitives.js';
import { icon } from '../ui/icons.js';
import { themeEngine, PRESETS, RADIUS_PRESETS, BORDER_PRESETS, SHADOW_PRESETS, GLASS_LEVELS, CARD_STYLES, HOME_SECTIONS, OVERRIDE_PAGES, DENSITIES } from './ThemeEngine.js';

const cfg = () => themeEngine.get();

/* ---------- tiny control factories ---------- */
const segmented = (options, value, onChange) => {
  const box = el('div', 'ts-seg');
  options.forEach(([v, label]) => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = label; b.dataset.v = v;
    if (String(v) === String(value)) b.classList.add('on');
    b.addEventListener('click', () => {
      box.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      onChange(v);
    });
    box.appendChild(b);
  });
  return box;
};
const row = (label, ...controls) => {
  const r = el('div', 'ts-row');
  const l = el('label', '', label);
  r.appendChild(l);
  const c = el('div', ''); c.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;min-width:0';
  controls.forEach((x) => c.appendChild(typeof x === 'string' ? el('span', '', x) : x));
  r.appendChild(c);
  return r;
};
const slider = (min, max, step, value, onChange, fmt = (v) => v) => {
  const w = el('div', 'ts-slider');
  const s = document.createElement('input'); s.type = 'range'; s.min = min; s.max = max; s.step = step; s.value = value;
  const o = document.createElement('output'); o.textContent = fmt(+value);
  s.addEventListener('input', () => { o.textContent = fmt(+s.value); onChange(+s.value); });
  w.append(s, o);
  return w;
};
const toggle = (value, onChange) => {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'z-switch' + (value ? ' on' : '');
  b.setAttribute('role', 'switch'); b.setAttribute('aria-checked', String(!!value));
  b.style.cssText = 'width:38px;height:22px;border-radius: var(--r-full);border:1px solid var(--color-border);background:var(--surface-4);position:relative;cursor:pointer;transition:background .15s';
  const dot = document.createElement('i');
  dot.style.cssText = 'position:absolute;top:2px;inset-inline-start:2px;width:16px;height:16px;border-radius:50%;background:var(--color-text-muted);transition:.15s';
  const paint = (v) => { b.classList.toggle('on', v); b.style.background = v ? 'var(--accent)' : 'var(--surface-4)'; dot.style.insetInlineStart = v ? '18px' : '2px'; dot.style.background = v ? 'var(--accent-contrast)' : 'var(--color-text-muted)'; b.setAttribute('aria-checked', String(v)); };
  paint(value);
  b.addEventListener('click', () => { const v = !(b.getAttribute('aria-checked') === 'true'); paint(v); onChange(v); });
  return b;
};

/* ---------- premium color popover (spec 09) ---------- */
const RECENT_KEY = 'zpopcorn-recent-colors';
const recents = () => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]').slice(0, 10); } catch { return []; } };
const pushRecent = (hex) => { const l = [hex, ...recents().filter((x) => x !== hex)].slice(0, 10); localStorage.setItem(RECENT_KEY, JSON.stringify(l)); };

function openColorPicker(anchor, initial, onPick) {
  document.querySelectorAll('.ts-pop').forEach((x) => x.remove());
  const c0 = hexToHsv(initial) || hexToHsv('#7b6cf6') || { h: 250, s: 0.6, v: 0.96 };
  let { h, s, v } = c0; let a = parseAlpha(initial);
  const pop = el('div', 'ts-pop');
  const field = el('div', 'field');
  const knob = el('span', 'knob');
  field.appendChild(knob);
  const hue = document.createElement('input'); hue.type = 'range'; hue.min = 0; hue.max = 360; hue.value = Math.round(h * 360); hue.setAttribute('aria-label', 'درجة اللون');
  const alpha = document.createElement('input'); alpha.type = 'range'; alpha.min = 0; alpha.max = 100; alpha.value = Math.round(a * 100); alpha.setAttribute('aria-label', 'الشفافية');
  const hexIn = document.createElement('input'); hexIn.className = 'input'; hexIn.style.cssText = 'height:30px;font-family:var(--font-mono);font-size:12px'; hexIn.value = initial || toHexStr(h, s, v);
  const grids = el('div', 'grid4');
  const mk = (k, label, min, max, get, set) => {
    const lab = el('label', '', label);
    const i = document.createElement('input'); i.type = 'number'; i.min = min; i.max = max; i.className = 'input';
    i.value = get();
    i.addEventListener('input', () => { set(clampN(+i.value, min, max)); sync(false); });
    lab.appendChild(i); grids.appendChild(lab); return i;
  };
  pop.append(field, hue, alpha, hexIn, grids);
  const swatches = el('div', 'ts-swatchrow');
  [...recents()].forEach((hex) => {
    const b = document.createElement('button'); b.style.background = hex; b.title = hex;
    b.addEventListener('click', () => { const cc = hexToHsv(hex); if (cc) { h = cc.h; s = cc.s; v = cc.v; } a = 1; sync(true); emit(); });
    swatches.appendChild(b);
  });
  if (recents().length) pop.appendChild(swatches);
  document.body.appendChild(pop);
  const r = anchor.getBoundingClientRect();
  pop.style.insetInlineStart = `${clampN(r.left, 8, innerWidth - 280)}px`;
  pop.style.top = `${clampN(r.bottom + 6, 8, innerHeight - pop.offsetHeight - 12)}px`;
  let rgbI, ggbI, bbI;
  function buildGrids() {
    grids.innerHTML = '';
    rgbI = mk('r', 'R', 0, 255, () => hsvRgb(h, s, v).r, (val) => { const x = hsvRgb(h, s, v); setRgbPart('r', val, x); });
    ggbI = mk('g', 'G', 0, 255, () => hsvRgb(h, s, v).g, (val) => { const x = hsvRgb(h, s, v); setRgbPart('g', val, x); });
    bbI = mk('b', 'B', 0, 255, () => hsvRgb(h, s, v).b, (val) => { const x = hsvRgb(h, s, v); setRgbPart('b', val, x); });
    mk('hh', 'H', 0, 360, () => Math.round(h * 360), (val) => { h = val / 360; sync(true); emit(); });
  }
  function setRgbPart(part, val, x) { x[part] = val; const c = rgbToHsv(x); h = c.h; s = c.s; v = c.v; sync(true); emit(); }
  function paintField() {
    field.style.background = `hsl(${h * 360} 100% 50%)`;
    field.innerHTML = `<div style="position:absolute;inset:0;background:linear-gradient(to right,#fff,transparent),linear-gradient(to top,transparent,#000);border-radius:inherit"></div>`;
    field.appendChild(knob);
    knob.style.left = `${s * 100}%`; knob.style.top = `${(1 - v) * 100}%`;
    knob.style.background = toHexStr(h, s, v);
  }
  function toHexStr(hh, ss, vv) { const { r, g, b } = hsvRgb(hh, ss, vv); return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase(); }
  function sync(upd) {
    paintField(); hue.style.accentColor = `hsl(${h * 360} 100% 50%)`;
    if (upd) { hexIn.value = toHexStr(h, s, v); buildGrids(); }
    alpha.style.accentColor = hexIn.value;
  }
  function emit(keep) { onPick(hexIn.value.trim().toUpperCase(), a, keep); }
  let drag = false;
  const pick = (e) => { const b = field.getBoundingClientRect(); s = clampN((e.clientX - b.left) / b.width, 0, 1); v = clampN(1 - (e.clientY - b.top) / b.height, 0, 1); sync(true); emit(); };
  field.addEventListener('pointerdown', (e) => { drag = true; field.setPointerCapture(e.pointerId); pick(e); });
  field.addEventListener('pointermove', (e) => drag && pick(e));
  field.addEventListener('pointerup', () => { drag = false; pushRecent(hexIn.value.trim().toUpperCase()); });
  hue.addEventListener('input', () => { h = +hue.value / 360; sync(true); emit(); });
  alpha.addEventListener('input', () => { a = +alpha.value / 100; emit(); });
  hexIn.addEventListener('change', () => {
    const m = /^#?([0-9a-f]{6})$/i.exec(hexIn.value.trim());
    if (m) { const c = hexToHsv('#' + m[1]); if (c) { h = c.h; s = c.s; v = c.v; sync(true); emit(); pushRecent('#' + m[1].toUpperCase()); } }
  });
  const onDoc = (e) => { if (!pop.contains(e.target) && e.target !== anchor) { close(); } };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  function close() { document.removeEventListener('pointerdown', onDoc, true); document.removeEventListener('keydown', onKey); pop.remove(); }
  buildGrids(); sync(true);
  document.addEventListener('pointerdown', onDoc, true);
  document.addEventListener('keydown', onKey);
}
function hexToHsv(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim()); if (!m) return null;
  const n = parseInt(m[1], 16); const r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) { if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h = (h / 6 + 1) % 1; }
  return { h, s: mx === 0 ? 0 : d / mx, v: mx };
}
function hsvRgb(h, s, v) {
  const i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const [r, g, b] = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6];
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}
function rgbToHsv({ r, g, b }) { return hexToHsv('#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')) || { h: 0, s: 0, v: 0 }; }
const parseAlpha = (hex) => { const m = /rgba?\([^)]*,\s*([\d.]+)\)/i.exec(hex || ''); return m ? clampN(+m[1], 0, 1) : 1; };
const clampN = (v, a, b) => Math.min(b, Math.max(a, Number.isFinite(v) ? v : a));

/* ---------- color field row ---------- */
function colorField(label, path, placeholderHex) {
  const get = () => getByPath(cfg(), path) ?? null;
  const set = (v) => themeEngine.setPath(path, v);
  const wrap = el('div', 'ts-color');
  const sw = el('button', 'sw'); sw.type = 'button';
  const fill = el('i');
  sw.appendChild(fill);
  const hex = document.createElement('input');
  hex.type = 'text'; hex.className = 'input';
  hex.placeholder = placeholderHex || '—';
  const paint = () => {
    const v = get();
    fill.style.background = v || 'transparent';
    fill.style.display = v ? 'block' : 'none';
    if (document.activeElement !== hex) hex.value = v || '';
  };
  wrap.dataset.cfPath = path; wrap.__paint = paint;
  hex.addEventListener('change', () => { const m = /^#?([0-9a-f]{6})$/i.exec(hex.value.trim()); set(m ? '#' + m[1].toUpperCase() : null); paint(); });
  sw.addEventListener('click', () => openColorPicker(sw, get() || placeholderHex || '#7B6CF6', (v) => { set(v); paint(); }));
  const reset = el('button', 'reset', '');
  reset.type = 'button'; reset.title = 'إرجاع للقيمة الأصلية';
  reset.innerHTML = icon('refresh', 12);
  reset.addEventListener('click', () => { set(null); paint(); });
  wrap.append(sw, hex, reset);
  paint();
  const r = row(label, wrap);
  r.dataset.cfRow = path;
  return r;
}
const getByPath = (o, path) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), o);

/* ---------- panels ---------- */
function panelColors() {
  const p = el('div', 'ts-card');
  p.innerHTML = `<h3>${icon('palette', 15)} الخلفيات والأسطح</h3><p class="hint">الفراغ = إرث السمة الأساسية. كل حقل ينعكس فوراً على الواجهة كلها.</p>`;
  const cols = el('div', 'ts-cols');
  [['colors.bg-app', 'خلفية التطبيق', '#0B0B0D'], ['colors.bg-main', 'الخلفية الرئيسية', '#101013'],
   ['colors.bg-sidebar', 'خلفية الشريط الجانبي', '#101013'], ['colors.bg-topbar', 'خلفية الشريط العلوي', '#101013'],
   ['colors.surface', 'سطح عام', '#16161A'], ['colors.surface-elev', 'سطح مرتفع', '#1B1B20'],
   ['colors.card', 'البطاقات', '#16161A'], ['colors.modal', 'النوافذ المنبثقة', '#1B1B20'], ['colors.input', 'حقول الإدخال', '#202026']]
    .forEach(([path, label, ph]) => cols.appendChild(colorField(label, path, ph)));
  p.appendChild(cols);
  const t = el('h3', '', `${icon('type', 15)} النصوص`); t.style.marginTop = '18px';
  p.appendChild(t);
  const tcols = el('div', 'ts-cols');
  [['colors.text-primary', 'أساسي', '#F5F5F5'], ['colors.text-secondary', 'ثانوي', '#A7A7AF'], ['colors.text-muted', 'خافت', '#707079'],
   ['colors.text-disabled', 'معطّل', '#5A5A62'], ['colors.text-heading', 'العناوين', '#F5F5F5'], ['colors.text-link', 'الروابط', '#9D92FF'], ['colors.text-meta', 'البيانات الوصفية', '#A7A7AF']]
    .forEach(([path, label, ph]) => tcols.appendChild(colorField(label, path, ph)));
  p.appendChild(tcols);
  const b = el('h3', '', 'الحدود'); b.style.marginTop = '18px'; p.appendChild(b);
  const bcols = el('div', 'ts-cols');
  [['colors.border-default', 'افتراضية', ''], ['colors.border-strong', 'قوية', ''], ['colors.border-focus', 'الفوكس', ''], ['colors.border-divider', 'الفواصل', ''], ['colors.border-selected', 'محدَّد', '']]
    .forEach(([path, label]) => bcols.appendChild(colorField(label, path, '')));
  p.appendChild(bcols);
  const s = el('h3', '', 'الحالات'); s.style.marginTop = '18px'; p.appendChild(s);
  const scols = el('div', 'ts-cols');
  [['colors.state-success', 'نجاح', '#34D399'], ['colors.state-warning', 'تحذير', '#EAB308'], ['colors.state-error', 'خطأ', '#F87171'], ['colors.state-info', 'معلومة', '#60A5FA']]
    .forEach(([path, label, ph]) => scols.appendChild(colorField(label, path, ph)));
  p.appendChild(scols);
  return p;
}

function panelAccent() {
  const c = cfg();
  const p = el('div', 'ts-card');
  p.innerHTML = `<h3>${icon('bolt', 15)} نظام اللهجات</h3><p class="hint">الوضع الاحترافي: لون واحد، ثنائي، أو تدرّج — النسخ (hover/active/soft/glow) تُحسب تلقائياً.</p>`;
  p.appendChild(row('الوضع', segmented([['single', 'أحادي'], ['dual', 'ثنائي'], ['gradient', 'تدرّج']], c.accentMode, (v) => { themeEngine.update({ ...cfg(), accentMode: v }); rerenderTabs(); })));
  p.appendChild(colorField('اللهجة الأساسية', 'accent.primary', '#7B6CF6'));
  if (c.accentMode !== 'single') p.appendChild(colorField('اللهجة الثانوية', 'accent.secondary', '#3FDCF2'));
  if (c.accentMode === 'gradient') {
    p.appendChild(colorField('اللوحة الثالثة (اختيارية)', 'accent.tertiary', '#B18CFF'));
    p.appendChild(row('زاوية التدرّج', slider(0, 360, 5, c.accent.angle, (v) => themeEngine.setPath('accent.angle', v), (v) => `${v}°`)));
    p.appendChild(row('عدد المحطات', segmented([[2, 'محطتان'], [3, 'ثلاث']], c.accent.stops, (v) => themeEngine.setPath('accent.stops', v))));
  }
  const prev = el('div', '');
  prev.style.cssText = 'margin-top:10px;display:flex;gap:10px;flex-wrap:wrap;align-items:center';
  const paintPrev = () => {
    const cc = cfg();
    const grad = cc.accentMode === 'gradient'
      ? `linear-gradient(${cc.accent.angle}deg, ${cc.accent.primary}, ${cc.accent.secondary}${cc.accent.stops === 3 ? `, ${cc.accent.tertiary}` : ''})`
      : cc.accent.primary;
    prev.innerHTML = '';
    const mk = (label, css) => { const d = el('div', ''); d.style.cssText = `padding:8px 16px;border-radius:var(--r-full);font-weight:700;font-size:13px;${css}`; d.textContent = label; return d; };
    prev.append(
      mk('زر أساسي', `background:${grad};color:${contrastText(cc.accent.primary)}`),
      cc.accentMode === 'dual' ? mk('ثانوية', `border:1px solid ${cc.accent.secondary};color:${cc.accent.secondary}`) : '',
      mk('تحديد', `background:${hexA(cc.accent.primary, 0.14)};box-shadow:inset 0 0 0 1px ${hexA(cc.accent.primary, 0.45)};color:${cc.accent.primary}`),
      el('div', '', `<span style="display:inline-block;width:80px;height:6px;border-radius:3px;background:${grad}"></span>`),
    );
  };
  p.appendChild(prev);
  p.dataset.prevAccent = '1'; p.__paintPrev = paintPrev;
  return p;
}
const contrastText = (hex) => { const m = /^#?(..)(..)(..)$/i.exec(hex || ''); if (!m) return '#fff'; const l = (parseInt(m[1], 16) * 0.299 + parseInt(m[2], 16) * 0.587 + parseInt(m[3], 16) * 0.114) / 255; return l > 0.55 ? '#0B0B0D' : '#F5F5F5'; };
const hexA = (hex, a) => { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return hex; const n = parseInt(m[1], 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };

function panelBackground() {
  const c = cfg();
  const p = el('div', 'ts-card');
  p.innerHTML = `<h3>${icon('image', 15)} الخلفية</h3><p class="hint">لون صلب، تدرّج، صورة (محلية — لا تُرفع لأي خادم)، أو طبقة ديناميكية خفيفة لا تضرّ بالقراءة.</p>`;
  p.appendChild(row('النوع', segmented([['solid', 'صلب'], ['gradient', 'تدرّج'], ['image', 'صورة'], ['dynamic', 'ديناميكي']], c.background.type, (v) => { themeEngine.setPath('background.type', v); rerenderTabs(); })));
  const sub = el('div', '');
  if (c.background.type === 'gradient') {
    sub.appendChild(colorField('البداية', 'background.gradient.from', '#0B0B0D'));
    sub.appendChild(colorField('النهاية', 'background.gradient.to', '#141417'));
    sub.appendChild(row('الزاوية', slider(0, 360, 5, c.background.gradient.angle, (v) => themeEngine.setPath('background.gradient.angle', v), (v) => `${v}°`)));
  }
  if (c.background.type === 'image') {
    const file = document.createElement('input'); file.type = 'file'; file.accept = 'image/*'; file.className = 'input';
    file.addEventListener('change', async () => {
      const f = file.files[0]; if (!f) return;
      if (f.size > 2_500_000) { toast('الصورة كبيرة — الحد 2.5 ميجابايت', 'error'); return; }
      const dataUrl = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f); });
      themeEngine.setPath('background.image.src', dataUrl);
    });
    sub.appendChild(row('الملف', file));
    if (c.background.image.src) {
      const cur = el('div', '');
      cur.style.cssText = 'height:96px;border-radius:var(--r-lg);overflow:hidden;border:1px solid var(--color-border);background-size:cover;background-position:center;margin-bottom:8px';
      cur.style.backgroundImage = `url("${c.background.image.src}")`;
      sub.prepend(cur);
    }
    sub.appendChild(row('الشفافية', slider(0.1, 1, 0.05, c.background.image.opacity, (v) => themeEngine.setPath('background.image.opacity', v), (v) => `${Math.round(v * 100)}%`)));
    sub.appendChild(row('التمويه', slider(0, 24, 1, c.background.image.blur, (v) => themeEngine.setPath('background.image.blur', v), (v) => `${v}px`)));
    sub.appendChild(row('الإضاءة', slider(0.2, 1.4, 0.05, c.background.image.brightness, (v) => themeEngine.setPath('background.image.brightness', v), (v) => `${Math.round(v * 100)}%`)));
    sub.appendChild(row('التشبّع', slider(0, 2, 0.05, c.background.image.saturate, (v) => themeEngine.setPath('background.image.saturate', v), (v) => `${Math.round(v * 100)}%`)));
    sub.appendChild(row('التعبئة', segmented([['cover', 'تغطية'], ['contain', 'احتواء'], ['repeat', 'تكرار']], c.background.image.size, (v) => themeEngine.setPath('background.image.size', v))));
  }
  if (c.background.type === 'dynamic') sub.innerHTML = `<p class="hint" style="margin:6px 0 0">تدرّج ناعم بطيء الحركة مبني على لهجتك؛ يتوقف تماماً عند تقليل الحركة في النظام.</p>`;
  p.appendChild(sub);
  return p;
}

function panelType() {
  const c = cfg();
  const p = el('div', 'ts-card');
  p.innerHTML = `<h3>${icon('type', 15)} الطباعة</h3><p class="hint">الخطوط المُستوردة تُحمّل داخل التطبيق (FontFace) — لا حاجة لتثبيتها في ويندوز.</p>`;
  const fontSelect = (label, path) => {
    const s = document.createElement('select'); s.className = 'input'; s.style.cssText = 'width:auto;min-width:210px';
    themeEngine.availableFonts().forEach((f) => {
      const o = document.createElement('option'); o.value = f.value; o.textContent = f.label;
      if (f.value === getByPath(c, path)) o.selected = true;
      s.appendChild(o);
    });
    s.addEventListener('change', () => themeEngine.setPath(path, s.value));
    return row(label, s);
  };
  p.appendChild(fontSelect('خط التطبيق', 'typography.familyApp'));
  p.appendChild(fontSelect('خط العناوين', 'typography.familyHeading'));
  p.appendChild(fontSelect('خط المتن', 'typography.familyBody'));
  p.appendChild(row('حجم الخط', slider(12, 20, 0.5, c.typography.size, (v) => themeEngine.setPath('typography.size', v), (v) => `${v}px`)));
  p.appendChild(row('السماكة', segmented([[300, 'خفيف'], [400, 'عادي'], [500, 'متوسط'], [600, 'نصف'], [700, 'عريض']], c.typography.weight, (v) => themeEngine.setPath('typography.weight', +v))));
  p.appendChild(row('تباعد الأسطر', slider(1.2, 2.1, 0.05, c.typography.lineHeight, (v) => themeEngine.setPath('typography.lineHeight', v), (v) => v.toFixed(2))));
  p.appendChild(row('مقياس العناوين', slider(0.85, 1.3, 0.05, c.typography.headingScale, (v) => themeEngine.setPath('typography.headingScale', v), (v) => `${Math.round(v * 100)}%`)));
  p.appendChild(row('مقياس الواجهة', segmented([[0.9, '90%'], [1, '100%'], [1.1, '110%'], [1.2, '120%'], [1.3, '130%'], [1.4, '140%']], c.uiScale, (v) => themeEngine.setPath('uiScale', +v))));
  const fontsList = el('div', 'ts-fonts');
  c.fonts.forEach((f) => {
    const li = el('div', '');
    li.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 0;border-top:1px solid var(--color-hairline)';
    li.innerHTML = `<span style="font-family:'${f.family}',sans-serif;flex:1">${esc(f.label)} — عيّنة Aa ببت</span>`;
    const del = el('button', 'btn btn-ghost btn-sm', '');
    del.innerHTML = icon('trash', 13); del.title = 'حذف';
    del.addEventListener('click', async () => { await themeEngine.removeFont(f.family); rerenderTabs(); });
    li.appendChild(del);
    fontsList.appendChild(li);
  });
  const up = document.createElement('input');
  up.type = 'file'; up.accept = '.ttf,.otf,.woff,.woff2'; up.className = 'input';
  up.addEventListener('change', async () => {
    try { await themeEngine.addFontFile(up.files[0]); toast('حُمّل الخط داخل التطبيق'); rerenderTabs(); } catch (e) { toast(e.message || 'تعذّر تحميل الخط', 'error'); }
  });
  const uw = row('خطوط مخصصة', up);
  uw.style.gridTemplateColumns = '1fr';
  uw.appendChild(fontsList);
  p.appendChild(uw);
  return p;
}

function panelShape() {
  const c = cfg();
  const p = el('div', 'ts-card');
  p.innerHTML = `<h3>${icon('grid', 15)} الشكل والحواف</h3><p class="hint">الكثافة، الحواف، الحدود، الظلال، الزجاج — قواعد عامة تطبق على كل المكونات بالتساوي.</p>`;
  p.appendChild(row('الكثافة', segmented(DENSITIES.map((d) => [d, { compact: 'مضغوطة', comfortable: 'مريحة', spacious: 'واسعة' }[d]]), c.density, (v) => themeEngine.setPath('density', v))));
  p.appendChild(row('الحواف', segmented(Object.keys(RADIUS_PRESETS).map((k) => [k, { sharp: 'حادة', subtle: 'ناعمة', modern: 'عصرية', rounded: 'مستديرة' }[k]]), c.radius.preset, (v) => {
    themeEngine.update({ ...cfg(), radius: { preset: v, base: RADIUS_PRESETS[v] } }); rerenderTabs();
  })));
  p.appendChild(row('تحكّم دقيق 0–24px', slider(0, 24, 1, c.radius.base, (v) => themeEngine.update({ ...cfg(), radius: { ...cfg().radius, preset: 'modern', base: v } }), (v) => `${v}px`)));
  p.appendChild(row('الحدود', segmented(Object.keys(BORDER_PRESETS).map((k) => [k, { none: 'بلا', subtle: 'خفيفة', standard: 'قياسية', defined: 'واضحة' }[k]]), c.borders.preset, (v) => themeEngine.setPath('borders.preset', v))));
  p.appendChild(row('سماكة الحد', slider(0.5, 2, 0.5, c.borders.thickness, (v) => themeEngine.setPath('borders.thickness', v), (v) => `${v}px`)));
  p.appendChild(row('الظلال', segmented(Object.keys(SHADOW_PRESETS).map((k) => [k, { none: 'بلا', subtle: 'خفيفة', soft: 'ناعمة', deep: 'عميقة' }[k]]), c.shadows.preset, (v) => themeEngine.setPath('shadows.preset', v))));
  p.appendChild(row('الزجاج والتمويه', segmented(Object.keys(GLASS_LEVELS).map((k) => [k, { off: 'متوقف', subtle: 'خفيف', medium: 'متوسط', strong: 'قوي' }[k]]), c.glass, (v) => themeEngine.setPath('glass', v))));
  return p;
}

function panelCards() {
  const c = cfg();
  const p = el('div', 'ts-card');
  p.innerHTML = `<h3>${icon('layers', 15)} البطاقات والأيقونات</h3><p class="hint">أسلوب البطاقة يغيّر العمق والحدّ والتعامل — بلا مساس بالبنية. الأيقونات تظل لغة zPopcorn الموحدة.</p>`;
  p.appendChild(row('أسلوب البطاقة', segmented(CARD_STYLES.map((k) => [k, { minimal: 'بسيط', cinematic: 'سينمائي', glass: 'زجاجي', elevated: 'مرتفع', editorial: 'تحريري', flat: 'مسطح' }[k]]), c.cards.style, (v) => themeEngine.setPath('cards.style', v))));
  p.appendChild(row('تفاعل المرور', segmented([['lift', 'رفع'], ['zoom', 'تكبير خفيف'], ['none', 'بلا']], c.cards.hover, (v) => themeEngine.setPath('cards.hover', v))));
  p.appendChild(row('قوة الطِلاء', slider(0, 0.9, 0.05, c.cards.overlay, (v) => themeEngine.setPath('cards.overlay', v), (v) => `${Math.round(v * 100)}%`)));
  p.appendChild(row('عرض التقييم', '', toggle(c.cards.rating, (v) => themeEngine.setPath('cards.rating', v))));
  p.appendChild(row('عرض السنة', '', toggle(c.cards.year, (v) => themeEngine.setPath('cards.year', v))));
  p.appendChild(row('عرض التقدم', '', toggle(c.cards.progress, (v) => themeEngine.setPath('cards.progress', v))));
  p.appendChild(row('سماكة الأيقونات', slider(1, 2.6, 0.1, c.icons.weight, (v) => themeEngine.setPath('icons.weight', v), (v) => v.toFixed(1))));
  p.appendChild(row('عتامة الأيقونات', slider(0.5, 1, 0.05, c.icons.opacity, (v) => themeEngine.setPath('icons.opacity', v), (v) => `${Math.round(v * 100)}%`)));
  p.appendChild(row('أحجام الأيقونات', slider(14, 24, 1, c.sidebar.iconSize, (v) => themeEngine.setPath('sidebar.iconSize', v), (v) => `${v}px`)));
  return p;
}

function panelSidebar() {
  const c = cfg();
  const p = el('div', 'ts-card');
  p.innerHTML = `<h3>${icon('list', 15)} الشريط الجانبي</h3><p class="hint">يظل قابلاً للاستخدام في كل تشكيلة؛ نمطfull/rail يُبدَّل من رأس الشريط نفسه.</p>`;
  p.appendChild(row('العرض', slider(180, 340, 4, c.sidebar.width, (v) => themeEngine.setPath('sidebar.width', v), (v) => `${v}px`)));
  p.appendChild(row('الشفافية', slider(0.3, 1, 0.05, c.sidebar.opacity, (v) => themeEngine.setPath('sidebar.opacity', v), (v) => `${Math.round(v * 100)}%`)));
  return p;
}

function panelHome() {
  const c = cfg();
  const p = el('div', 'ts-card');
  p.innerHTML = `<h3>${icon('home', 15)} ترتيب الرئيسية</h3><p class="hint">إظهار/إخفاء، إعادة ترتيب بالسحب، وعدد البطاقات لكل قسم — يُحفظ ويُطبَّق فوراً.</p>`;
  const list = el('div', '');
  const ordered = [...c.home.order];
  ordered.forEach((id, idx) => {
    const sec = HOME_SECTIONS.find((s) => s.id === id); if (!sec) return;
    const r = el('div', 'ts-listrow' + (c.home.hidden.includes(id) ? ' off' : ''));
    r.draggable = true;
    r.innerHTML = `<span class="grip" title="اسحب">${icon('rows', 14)}</span><span class="lab">${esc(sec.label)}</span>`;
    const cnt = document.createElement('input');
    cnt.type = 'number'; cnt.min = 4; cnt.max = 24; cnt.value = c.home.counts[id] || 14; cnt.className = 'input'; cnt.style.cssText = 'width:64px;height:28px;text-align:center';
    cnt.addEventListener('change', () => themeEngine.setSectionCount(id, +cnt.value));
    r.appendChild(cnt);
    const eye = el('button', 'btn btn-ghost btn-sm', '');
    eye.innerHTML = icon(c.home.hidden.includes(id) ? 'eyeOff' : 'eye', 14);
    eye.title = c.home.hidden.includes(id) ? 'إظهار' : 'إخفاء';
    eye.addEventListener('click', () => { themeEngine.toggleSection(id); rerenderTabs(); });
    r.appendChild(eye);
    const mv = (d) => { themeEngine.moveSection(id, d); rerenderTabs(); };
    const upb = el('button', 'btn btn-ghost btn-sm', ''); upb.innerHTML = icon('chevU', 13); upb.style.padding = '3px 6px';
    upb.addEventListener('click', () => mv(idx > 0 ? -1 : 0)); r.appendChild(upb);
    const dn = el('button', 'btn btn-ghost btn-sm', ''); dn.innerHTML = icon('chevD', 13); dn.style.padding = '3px 6px';
    dn.addEventListener('click', () => mv(idx < ordered.length - 1 ? 1 : 0)); r.appendChild(dn);
    r.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', String(idx)); r.classList.add('drag'); });
    r.addEventListener('dragend', () => r.classList.remove('drag'));
    r.addEventListener('dragover', (e) => e.preventDefault());
    r.addEventListener('drop', (e) => {
      e.preventDefault();
      const from = +e.dataTransfer.getData('text/plain');
      let order = [...c.home.order];
      const [moved] = order.splice(from, 1);
      order.splice(idx, 0, moved);
      themeEngine.update({ ...cfg(), home: { ...cfg().home, order } });
      rerenderTabs();
    });
    list.appendChild(r);
  });
  p.appendChild(list);
  return p;
}

function panelPages() {
  const c = cfg();
  const p = el('div', 'ts-card');
  p.innerHTML = `<h3>${icon('layers', 15)} تجاوزات الصفحات</h3><p class="hint">تجاوز اختياري لكل صفحة فوق السمة العامة؛ يظهر شريط «تجاوز نشط» داخل الصفحة عند الاستخدام.</p>`;
  OVERRIDE_PAGES.forEach(([path, label]) => {
    const ent = c.pageOverrides[path] || {};
    const card = el('div', '');
    card.style.cssText = 'padding:10px;border:1px solid var(--color-border);border-radius:var(--r-lg);margin-bottom:8px';
    const head = el('div', '');
    head.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:6px';
    head.innerHTML = `<b style="font-size:var(--text-sm)">${esc(label)}</b>${Object.keys(ent).length ? '<span class="z-pill z-pill-accent">تجاوز نشط</span>' : '<span style="font-size:11px;color:var(--color-text-faint)">افتراضي</span>'}`;
    const clear = el('button', 'btn btn-ghost btn-sm', 'مسح التجاوز');
    clear.style.cssText = 'margin-inline-start:auto;font-size:11px';
    clear.addEventListener('click', () => { themeEngine.clearPageOverride(path); rerenderTabs(); });
    if (Object.keys(ent).length) head.appendChild(clear);
    card.appendChild(head);
    const body = el('div', '');
    body.style.cssText = 'display:flex;gap:14px;flex-wrap:wrap;align-items:center';
    const acc = el('div', 'ts-color');
    acc.innerHTML = `<span style="font-size:var(--text-xs);color:var(--color-text-muted)">لهجة</span>`;
    const accSw = el('button', 'sw'); accSw.type = 'button'; accSw.style.cssText = 'width:24px;height:24px;border-radius: var(--r-md);border:1px solid var(--color-border-strong);cursor:pointer;position:relative';
    const accFill = el('i'); accFill.style.cssText = 'position:absolute;inset:0;border-radius:inherit;display:block';
    accFill.style.background = ent.accent || 'transparent'; accFill.style.display = ent.accent ? 'block' : 'none';
    accSw.appendChild(accFill);
    accSw.addEventListener('click', () => openColorPicker(accSw, ent.accent || '#22D3EE', (v) => { themeEngine.setPathOverride(path, { ...ent, accent: v }); rerenderTabs(); }));
    acc.appendChild(accSw);
    body.appendChild(acc);
    const dens = document.createElement('select'); dens.className = 'input'; dens.style.cssText = 'width:auto;height:28px;font-size:12px';
    [['', 'كثيفة؟ الافتراضي'], ...DENSITIES.map((d) => [d, { compact: 'مضغوطة', comfortable: 'مريحة', spacious: 'واسعة' }[d]])].forEach(([v, l]) => { const o = document.createElement('option'); o.value = v; o.textContent = l; if (v === (ent.density || '')) o.selected = true; dens.appendChild(o); });
    dens.addEventListener('change', () => { const e2 = { ...ent }; if (dens.value) e2.density = dens.value; else delete e2.density; themeEngine.setPathOverride(path, cleanEnt(e2)); rerenderTabs(); });
    body.appendChild(dens);
    const cs = document.createElement('select'); cs.className = 'input'; cs.style.cssText = 'width:auto;height:28px;font-size:12px';
    [['', 'بطاقات: الافتراضي'], ...CARD_STYLES.map((k) => [k, k])].forEach(([v, l]) => { const o = document.createElement('option'); o.value = v; o.textContent = l; if (v === (ent.cardStyle || '')) o.selected = true; cs.appendChild(o); });
    cs.addEventListener('change', () => { const e2 = { ...ent }; if (!cs.value) delete e2.cardStyle; else e2.cardStyle = cs.value; themeEngine.setPathOverride(path, cleanEnt(e2)); rerenderTabs(); });
    body.appendChild(cs);
    card.appendChild(body);
    p.appendChild(card);
  });
  return p;
}
const cleanEnt = (e) => { const o = {}; if (e.accent) o.accent = e.accent; if (e.density) o.density = e.density; if (e.cardStyle) o.cardStyle = e.cardStyle; if (e.bg && e.bg !== 'none') o.bg = e.bg; return o; };

function previewPanel() {
  const p = el('aside', 'ts-side-preview');
  const box = el('div', 'ts-preview');
  box.innerHTML = `
    <div class="cap">${icon('eye', 13)} معاينة حية</div>
    <div class="ts-app">
      <div class="sb">
        <i class="on" style="background:var(--accent-soft)"></i><i style="background:var(--surface-4)"></i><i style="background:var(--surface-4)"></i><i style="background:var(--surface-4)"></i>
      </div>
      <div class="main">
        <div class="bar"><span class="btnp">تشغيل</span><span class="btng">إضافة</span><span class="inp">بحث…</span></div>
        <div class="cards">
          <div class="cd"><div class="img" style="background:linear-gradient(140deg,var(--accent-soft),var(--surface-3))"></div><div class="t"><b>فيلم</b><span>2024 · ${icon('star',11,{weight:'fill'})} 8.1</span></div><div class="prog"><i></i></div></div>
          <div class="cd"><div class="img" style="background:linear-gradient(140deg,var(--accent-2-soft, var(--accent-soft)),var(--surface-3))"></div><div class="t"><b>مسلسل</b><span>2023 · ${icon('star',11,{weight:'fill'})} 7.4</span></div></div>
          <div class="cd"><div class="img" style="background:var(--surface-4)"></div><div class="t"><b>أنمي</b><span>قيد البث</span></div></div>
        </div>
        <div class="row2">
          <div class="dlg"><b>حوار</b><p style="color:var(--color-text-muted);margin:2px 0 6px">نص الوصف داخل النافذة</p><span class="btnp" style="padding:2px 8px;display:inline-block">تأكيد</span></div>
          <div class="ntc"><span class="ic">${icon('check', 11)}</span><span>أُضيف إلى المفضلة</span></div>
        </div>
        <div class="typo">
          <h4>عنوان تحريري</h4>
          <p style="margin:0">نص المتن على سطح البطاقة — السطرية والتباعد كما ستراهما في التطبيق فعلياً.</p>
        </div>
      </div>
    </div>`;
  p.appendChild(box);
  return p;
}

/* ---------- overview: presets + customs + save/export ---------- */
function panelOverview() {
  const c = cfg();
  const p = el('div', '');
  const activeId = themeEngine.activePresetId();
  const grid = el('div', 'ts-grid-cards');
  const mkCard = (t, isCustom) => {
    const conf = t.config || {};
    const bg = conf.colors?.['bg-app'] || '#0B0B0D';
    const acc = conf.accent?.primary || '#7B6CF6';
    const acc2 = conf.accent?.secondary || '#3FDCF2';
    const card = el('button', 'ts-themecard' + (activeId === t.id ? ' on' : ''));
    card.type = 'button';
    card.innerHTML = `
      <div class="prev" style="background:${bg}">
        <div class="sbw" style="background:${mixHex(bg, '#FFFFFF', 0.06)}">
          <i style="background:${acc}"></i><i style="background:${mixHex(bg, '#FFFFFF', 0.25)}"></i><i style="background:${mixHex(bg, '#FFFFFF', 0.18)}"></i>
        </div>
        <div class="mw">
          <div class="bar" style="height:26px;background:linear-gradient(100deg, ${acc}, ${acc2})"></div>
          <div style="display:flex;gap:6px">
            <div class="bar" style="flex:1;height:30px;background:${mixHex(bg, '#FFFFFF', 0.07)};border:1px solid ${hexA('#fff', .09)}"></div>
            <div class="bar" style="flex:1;height:30px;background:${mixHex(bg, '#FFFFFF', 0.07)};border:1px solid ${hexA('#fff', .09)}"></div>
            <div class="bar" style="flex:1;height:30px;background:${mixHex(bg, '#FFFFFF', 0.07)};border:1px solid ${hexA('#fff', .09)}"></div>
          </div>
        </div>
      </div>
      <div class="foot">
        <span><b>${esc(t.name)}</b><small>${esc(t.desc || '')}</small></span>
        <span class="acts"></span>
      </div>`;
    card.querySelector('.prev').addEventListener?.('click', () => {});
    card.addEventListener('click', (e) => { if (e.target.closest('.acts')) return; themeEngine.applyPreset(t.id); toast(`طُبِّق «${t.name}»`); rerenderTabs(); });
    const acts = card.querySelector('.acts');
    const mkBtn = (ic, title, fn, danger) => { const b = el('button', danger ? 'danger' : '', ''); b.type = 'button'; b.innerHTML = icon(ic, 13); b.title = title; b.addEventListener('click', (e) => { e.stopPropagation(); fn(); }); acts.appendChild(b); };
    mkBtn('dup', 'تكرار كنسخة قابلة للتعديل', () => { themeEngine.saveCustomTheme(`${t.name} (نسخة)`, 'نسخة من ' + (t.desc || t.name)); toast('نُسخت إلى المظاهر المخصصة'); rerenderTabs(); });
    if (isCustom) {
      mkBtn('edit', 'إعادة التسمية', () => {
        const name = prompt('اسم المظهر', t.name); if (name) { themeEngine.renameTheme(t.id, name); rerenderTabs(); }
      });
      mkBtn('download', 'تصدير JSON', () => downloadThemeFile({ format: 'zpopcorn-theme', version: 2, meta: { name: t.name }, config: t.config }, `${slug(t.name)}.zpopcorn-theme.json`));
      mkBtn('trash', 'حذف', () => { if (confirm(`حذف «${t.name}»؟`)) { themeEngine.deleteTheme(t.id); rerenderTabs(); } }, true);
    } else {
      mkBtn('download', 'تصدير JSON', () => downloadThemeFile({ format: 'zpopcorn-theme', version: 2, meta: { name: t.name }, config: { ...defaultView(conf) } }, `${slug(t.name)}.zpopcorn-theme.json`));
    }
    return card;
  };
  PRESETS.forEach((t) => grid.appendChild(mkCard(t, false)));
  c.customThemes.forEach((t) => grid.appendChild(mkCard(t, true)));
  p.appendChild(grid);

  const ops = el('div', 'ts-card');
  ops.style.marginTop = '14px';
  ops.innerHTML = `<h3>${icon('save', 15)} إدارة المظاهر</h3><p class="hint">حفظ التكوين الحالي، تصدير ملف ‎.zpopcorn-theme.json محمول، استيراد مع فحص كامل قبل التطبيق.</p>`;
  const bar = el('div', ''); bar.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap';
  const nameIn = document.createElement('input'); nameIn.className = 'input'; nameIn.placeholder = 'اسم المظهر الجديد'; nameIn.style.cssText = 'width:200px;height:32px';
  const save = el('button', 'btn btn-secondary btn-sm', 'حفظ الحالي كمظهر');
  save.addEventListener('click', () => {
    if (!nameIn.value.trim()) { toast('اكتب اسماً أولاً', 'error'); nameIn.focus(); return; }
    themeEngine.saveCustomTheme(nameIn.value.trim(), 'مظهر مخصص'); toast('حُفظ المظهر'); nameIn.value = ''; rerenderTabs();
  });
  const exp = el('button', 'btn btn-secondary btn-sm', ''); exp.innerHTML = `${icon('download', 13)} تصدير التكوين الحالي`;
  exp.addEventListener('click', () => downloadThemeFile({ format: 'zpopcorn-theme', version: 2, meta: { name: 'zPopcorn Theme' }, config: c }, 'zpopcorn-theme.zpopcorn-theme.json'));
  const imp = el('button', 'btn btn-secondary btn-sm', ''); imp.innerHTML = `${icon('upload', 13)} استيراد`;
  const fileIn = document.createElement('input'); fileIn.type = 'file'; fileIn.accept = '.json,application/json'; fileIn.style.display = 'none';
  fileIn.addEventListener('change', async () => {
    const f = fileIn.files[0]; if (!f) return;
    try {
      const text = await f.text();
      themeEngine.importTheme(text);
      toast('استُورد المظهر وطُبِّق');
      rerenderTabs();
    } catch (e) {
      toast(e.message === 'E_BAD_JSON' ? 'ملف غير صالح — ليس JSON' : e.message === 'E_NOT_THEME' ? 'الملف ليس مظهر zPopcorn — لم يتغير شيء' : 'تعذّر الاستيراد — السمة الحالية سليمة', 'error');
    }
  });
  imp.addEventListener('click', () => fileIn.click());
  bar.append(nameIn, save, exp, imp, fileIn);
  ops.appendChild(bar);
  const dang = el('div', '');
  dang.style.cssText = 'display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;padding-top:12px;border-top:1px solid var(--color-hairline)';
  const rBtn = (label, need, fn) => {
    const b = el('button', 'btn btn-ghost btn-sm', '');
    b.innerHTML = `${icon('refresh', 12)} ${label}`;
    b.style.color = 'var(--color-text-muted)';
    b.addEventListener('click', () => { if (!need || confirm('سيُحذف تخصيصك نهائياً — متابعة؟')) { fn(); toast('تمت الإعادة'); rerenderTabs(); } });
    return b;
  };
  dang.append(
    rBtn('إرجاع الألوان فقط', false, () => themeEngine.resetColors()),
    rBtn('إرجاع المظهر كاملاً', true, () => themeEngine.resetAppearance()),
    rBtn('استعادة سمة zPopcorn الافتراضية', true, () => { themeEngine.resetAll(); document.documentElement.setAttribute('data-theme', 'midnight-neon'); localStorage.setItem('zpopcorn-theme', '"midnight-neon"'); }),
  );
  ops.appendChild(dang);
  p.appendChild(ops);
  return p;
}
const defaultView = (conf) => ({ ...conf, accentMode: conf.accentMode || 'single' });
const slug = (s) => (s || 'theme').replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 30);
function mixHex(a, b, t) {
  const pa = /^#?([0-9a-f]{6})$/i.exec(a), pb = /^#?([0-9a-f]{6})$/i.exec(b);
  if (!pa || !pb) return a;
  const A = parseInt(pa[1], 16), B = parseInt(pb[1], 16);
  const m = ['r', 'g', 'b'].map((_, i) => { const sh = 16 - i * 8; const x = (A >> sh & 255), y = (B >> sh & 255); return Math.round(x + (y - x) * t); });
  return '#' + m.map((x) => x.toString(16).padStart(2, '0')).join('');
}
function downloadThemeFile(obj, name) {
  const blob = new Blob([JSON.stringify(obj, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('نُزِّل ملف المظهر');
}
const toast = (message, type = 'success') => window.dispatchEvent(new CustomEvent('showtoast', { detail: { message, type } }));

/* ---------- shell ---------- */
let TABS_MOUNT = null;
let CURRENT_TAB = 'overview';
const TABS = [
  ['overview', 'النظرة العامة', 'grid'], ['colors', 'الألوان', 'palette'], ['accent', 'اللهجة', 'bolt'],
  ['background', 'الخلفية', 'image'], ['type', 'الطباعة', 'type'], ['shape', 'الشكل والحواف', 'rows'],
  ['cards', 'البطاقات والأيقونات', 'layers'], ['sidebar', 'الشريط الجانبي', 'list'],
  ['home', 'صفحة الرئيسية', 'home'], ['pages', 'تجاوزات الصفحات', 'compass'],
];
function rerenderTabs() { if (TABS_MOUNT) renderTab(TABS_MOUNT, CURRENT_TAB); }
function renderTab(mount, id) {
  CURRENT_TAB = id;
  mount.querySelectorAll('.ts-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === id));
  const body = mount.querySelector('.ts-panel');
  body.innerHTML = '';
  const maker = { colors: panelColors, accent: panelAccent, background: panelBackground, type: panelType, shape: panelShape, cards: panelCards, sidebar: panelSidebar, home: panelHome, pages: panelPages, overview: panelOverview }[id];
  body.appendChild(maker ? maker() : emptyState({ title: 'قريباً' }));
  refreshLive(mount);
}
/** repaint every data-bound field after a config change */
function refreshLive(root) {
  if (!root) return;
  root.querySelectorAll('[data-cf-row]').forEach((r) => {
    const f = r.querySelector('[data-cf-path]');
    f?.__paint?.();
  });
  root.querySelectorAll('[data-prev-accent]').forEach((c) => c.__paintPrev?.());
}
export function ThemeStudio() {
  const root = el('section', 'ts-root');
  const tabs = el('nav', 'ts-tabs'); tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'أقسام المظهر');
  TABS.forEach(([id, label, ic]) => {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.tab = id; b.setAttribute('role', 'tab');
    b.innerHTML = `${icon(ic, 14)} ${esc(label)}`;
    b.addEventListener('click', () => renderTab(root, id));
    tabs.appendChild(b);
  });
  const panel = el('div', 'ts-panel');
  root.append(tabs, panel, previewPanel());
  const header = el('div', '');
  header.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap';
  header.innerHTML = `<h2 style="font-size:var(--text-2xl);font-weight:800;margin:0">استوديو المظهر</h2>
    <span class="z-pill z-pill-accent">محرك zPopcorn v2</span>
    <span style="font-size:var(--text-xs);color:var(--color-text-muted)">كل تغيير يُطبَّق ويُحفظ لحظياً — لا إعادة تشغيل</span>`;
  const wrap = el('div', '');
  wrap.append(header, root);
  TABS_MOUNT = wrap;
  themeEngine.subscribe(() => refreshLive(wrap));
  renderTab(wrap, 'overview');
  return wrap;
}
