/**
 * zPopcorn Theme Engine v2
 * ------------------------------------------------------------------
 * A real theming framework, not a color-picker veneer:
 *  - full semantic token map (colors/typography/density/radius/borders/
 *    shadows/blur/backgrounds/cards/sidebar/icons/motion)
 *  - accent modes: single / dual / gradient, with derived hover, active,
 *    soft, glow and contrast variants (never hand-set)
 *  - validated, whitelisted config — invalid props are dropped, never crash
 *  - live apply through ONE <style> element (rAF-batched, no reloads)
 *  - persistence (localStorage + custom-font data via db store)
 *  - presets, custom themes, export/import, resets, page overrides
 *  - semantic role tokens (color/surface/border families) are the ONLY vocabulary — no alias layer
 */

const LS_KEY = 'zpopcorn-appearance';
const FONT_STORE = 'appearanceFonts';

/* ============================ color utils ============================ */
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const round = (v) => Math.round(v * 1000) / 1000;

function parseColor(c) {
  if (typeof c !== 'string') return null;
  c = c.trim();
  let m = /^#([0-9a-f]{6})$/i.exec(c);
  if (m) { const n = parseInt(m[1], 16); return { r: n >> 16 & 255, g: n >> 8 & 255, b: n & 255, a: 1 }; }
  m = /^#([0-9a-f]{3})$/i.exec(c);
  if (m) { const [r, g, b] = m[1].split('').map((x) => parseInt(x + x, 16)); return { r, g, b, a: 1 }; }
  m = /^rgba?\(([^)]+)\)$/i.exec(c);
  if (m) {
    const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    if (p.length >= 3 && p.every((x) => Number.isFinite(x))) return { r: clamp(p[0], 0, 255), g: clamp(p[1], 0, 255), b: clamp(p[2], 0, 255), a: p.length > 3 ? clamp(p[3], 0, 1) : 1 };
  }
  m = /^hsla?\(([^)]+)\)$/i.exec(c);
  if (m) {
    const p = m[1].split(/[,\s/]+/).filter(Boolean).map((v, i) => parseFloat(v) / (i === 0 ? 360 : i === 1 || i === 2 ? 100 : 1));
    if (p.length >= 3) { const rgb = hslToRgb(p[0], p[1], p[2]); return { ...rgb, a: p.length > 3 ? clamp(p[3], 0, 1) : 1 }; }
  }
  return null;
}
function hslToRgb(h, s, l) {
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t) => { t = (t + 1) % 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; };
  return { r: Math.round(f(h + 1 / 3) * 255), g: Math.round(f(h) * 255), b: Math.round(f(h - 1 / 3) * 255) };
}
function rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0; const l = (mx + mn) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
    h /= 6; if (h < 0) h += 1;
  }
  return { h, s, l };
}
const toHex = ({ r, g, b }) => '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
function rgba(c, a) { return `rgba(${c.r},${c.g},${c.b},${round(a ?? c.a)})`; }
function lum({ r, g, b }) { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); }
function shift(hex, dl, ds) {
  const c = parseColor(hex); if (!c) return hex;
  const { h, s, l } = rgbToHsl(c);
  const nl = clamp(l + (dl || 0), 0, 1); const ns = clamp(s + (ds || 0), 0, 1);
  const q = nl < 0.5 ? nl * (1 + ns) : nl + ns - nl * ns; const p = 2 * nl - q;
  const f = (t) => { t = (t + 1) % 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; };
  return toHex({ r: Math.round(f(h + 1 / 3) * 255), g: Math.round(f(h) * 255), b: Math.round(f(h - 1 / 3) * 255) });
}
function contrastOn(hex) { const c = parseColor(hex); return c && lum(c) > 0.45 ? '#0B0B0D' : '#F5F5F5'; }
function mix(a, b, t) {
  const ca = parseColor(a), cb = parseColor(b); if (!ca || !cb) return a;
  return toHex({ r: ca.r + (cb.r - ca.r) * t, g: ca.g + (cb.g - ca.g) * t, b: ca.b + (cb.b - ca.b) * t });
}

/* ============================ schema/defaults ============================ */
/** Active icon weight tier (driven by icons.weight) — icon() consumes it so one
 * global choice flows into every glyph: light ≤1.44 · regular · bold ≥2.06px.
 * Huge/stroke glyphs keep the raw --zi-sw numeric. */
let _iconWeightTier = 'regular';
export const iconWeightTier = () => _iconWeightTier;

export const DENSITIES = ['compact', 'comfortable', 'spacious'];
export const RADIUS_PRESETS = { sharp: 0, subtle: 6, modern: 12, rounded: 18 };
export const BORDER_PRESETS = { none: 0, subtle: 0.06, standard: 0.09, defined: 0.14 };
export const SHADOW_PRESETS = { none: 0, subtle: 0.28, soft: 0.45, deep: 0.62 };
export const CARD_STYLES = ['cinematic', 'minimal', 'elevated', 'editorial', 'flat'];
export const HOME_SECTIONS = [
  { id: 'hero', label: 'الواجهة الرئيسية' }, { id: 'continue', label: 'متابعة المشاهدة' },
  { id: 'recent', label: 'أضيف حديثاً' }, { id: 'watched', label: 'شاهدته مؤخراً' },
  { id: 'top10', label: 'أفضل ١٠' }, { id: 'later', label: 'المشاهدة لاحقاً' },
  { id: 'recs', label: 'موصى به' }, { id: 'trending', label: 'رائج هذا الأسبوع' },
  { id: 'health', label: 'تحتاج انتباهاً' },
];
export const OVERRIDE_PAGES = [
  ['/', 'الرئيسية'], ['/movies', 'الأفلام'], ['/tv', 'المسلسلات'], ['/anime', 'الأنمي'],
  ['/library', 'المكتبة'], ['/movie/:id', 'تفاصيل فيلم'], ['/tv/:id', 'تفاصيل مسلسل'],
];

export function defaultConfig() {
  return {
    version: 2,
    enabled: true,
    accentMode: 'single',            // single | dual | gradient
    colors: {},                        // sparse overrides only
    accent: { primary: '#7B6CF6', secondary: '#3FDCF2', tertiary: '#B18CFF', angle: 135, stops: 2 },
    radius: { preset: 'modern', base: 12 },
    borders: { preset: 'standard', thickness: 1 },
    shadows: { preset: 'soft' },
    density: 'comfortable',
    uiScale: 1,
    typography: { familyApp: '', familyHeading: '', familyBody: '', size: 15, weight: 400, lineHeight: 1.6, headingScale: 1 },
    background: { type: 'solid', gradient: { from: '#0B0B0D', to: '#141417', angle: 160 }, image: { src: null, opacity: 1, blur: 0, brightness: 0.9, saturate: 1, size: 'cover', position: 'center' } },
    cards: { style: 'cinematic', hover: 'lift', lift: 3, overlay: 0.55, rating: true, year: true, progress: true },
    sidebar: { width: 260, opacity: 1, iconSize: 18 },
    icons: { weight: 1.7, opacity: 1 },
    motion: 'full',
    home: { order: HOME_SECTIONS.map((s) => s.id), hidden: [], counts: {} },
    pageOverrides: {},                 // path -> {accent, density, cardStyle, bg}
    customThemes: [],                  // [{id,name,desc,config}]
    fonts: [],                         // [{id,family,label}] (data in db)
  };
}

export const PRESETS = [
  { id: 'midnight', name: 'منتصف الليل', desc: 'الفحمي الهادئ — هوية zPopcorn', config: {} },
  { id: 'cinema-noir', name: 'سينما نوار', desc: 'أحمر قرمزي على فحمي دافئ', config: { accent: { primary: '#D24A5F', secondary: '#C8A24B', tertiary: '#8E5A8E', angle: 135, stops: 2 }, colors: { 'bg-app': '#0D0B0C', 'bg-main': '#121011', 'surface': '#1A1618', 'card': '#1C181A' } } },
  { id: 'deep-space', name: 'الفضاء العميق', desc: 'كحلي داكن وسماوي هادئ', config: { accent: { primary: '#5B8DEF', secondary: '#43D6C4', tertiary: '#9A7BFF', angle: 120, stops: 2 }, colors: { 'bg-app': '#080B14', 'bg-main': '#0C1020', 'surface': '#121830', 'card': '#141B36' } } },
  { id: 'aurora', name: 'الشفق', config: { accentMode: 'gradient', accent: { primary: '#4CC9F0', secondary: '#B18CFF', tertiary: '#5BE9B9', angle: 100, stops: 2 }, colors: { 'bg-app': '#070B12', 'bg-main': '#0A101C', 'surface': '#101828', 'card': '#12203A' } } },
  { id: 'obsidian', name: 'أوبسيديان', desc: 'رمادي محايد، بلا ألوان زاعقة', config: { accent: { primary: '#B9BBBF', secondary: '#7F8287', tertiary: '#E4E5E7', angle: 135, stops: 2 }, cards: { style: 'minimal' }, shadows: { preset: 'subtle' } } },
  { id: 'purple-cinema', name: 'السينما البنفسجية', config: { accent: { primary: '#A855F7', secondary: '#6D28D9', tertiary: '#E9D5FF', angle: 135, stops: 2 }, colors: { 'bg-app': '#0B0A10', 'bg-main': '#100E1A', 'surface': '#171326', 'card': '#1A162B' } } },
  { id: 'electric-cyan', name: 'سماوي كهربائي', config: { accent: { primary: '#22D3EE', secondary: '#0EA5E9', tertiary: '#A5F3FC', angle: 110, stops: 2 }, colors: { 'bg-app': '#060B0E', 'bg-main': '#0A1116', 'surface': '#0F1A22', 'card': '#122230' } } },
  { id: 'lime-studio', name: 'لايم استوديو', config: { accent: { primary: '#C9F24D', secondary: '#84CC16', tertiary: '#ECFCCB', angle: 135, stops: 2 }, colors: { 'bg-app': '#0C0C0C', 'surface': '#171717', 'card': '#1D1D1D' }, cards: { style: 'editorial' } } },
  { id: 'crimson', name: 'القرمزية', config: { accent: { primary: '#E5484D', secondary: '#FF8A5C', tertiary: '#FFC7C9', angle: 135, stops: 2 }, colors: { 'bg-app': '#0D090A', 'surface': '#181114', 'card': '#1D1418' } } },
  { id: 'oceanic', name: 'محيطي', config: { accentMode: 'gradient', accent: { primary: '#2D7DFF', secondary: '#19C37D', tertiary: '#90E0EF', angle: 140, stops: 2 }, background: { type: 'gradient', gradient: { from: '#050A14', to: '#0A1A2E', angle: 160 } }, colors: { 'bg-app': '#050A14', surface: '#0C1626', card: '#0E1B30' } } },
  { id: 'monochrome', name: 'أحادي', desc: 'أسود وأبيض وحواف فقط', config: { accent: { primary: '#F5F5F5', secondary: '#A7A7AF', tertiary: '#707079', angle: 135, stops: 2 }, cards: { style: 'flat' }, borders: { preset: 'defined' }, shadows: { preset: 'none' } } },
];

/* ============================ validation ============================ */
const COLOR_KEYS = [
  'bg-app', 'bg-main', 'bg-sidebar', 'bg-topbar', 'surface', 'surface-elev', 'card', 'modal', 'input',
  'text-primary', 'text-secondary', 'text-muted', 'text-disabled', 'text-heading', 'text-link', 'text-meta',
  'border-default', 'border-strong', 'border-focus', 'border-divider', 'border-selected',
  'state-success', 'state-warning', 'state-error', 'state-info',
];
function validateConfig(raw) {
  const d = defaultConfig();
  if (!raw || typeof raw !== 'object') return d;
  const c = structuredClone(d);
  const okColor = (v) => typeof v === 'string' && parseColor(v) != null;
  if (raw.enabled === false) c.enabled = false;
  if (['single', 'dual', 'gradient'].includes(raw.accentMode)) c.accentMode = raw.accentMode;
  if (raw.accent && typeof raw.accent === 'object') {
    for (const k of ['primary', 'secondary', 'tertiary']) if (okColor(raw.accent[k])) c.accent[k] = raw.accent[k].toUpperCase();
    if (Number.isFinite(+raw.accent.angle)) c.accent.angle = clamp(+raw.accent.angle, 0, 360);
    if ([1, 2, 3].includes(+raw.accent.stops)) c.accent.stops = +raw.accent.stops;
  }
  if (raw.colors && typeof raw.colors === 'object') {
    for (const [k, v] of Object.entries(raw.colors)) {
      if (COLOR_KEYS.includes(k) && (v === null || okColor(v))) c.colors[k] = v === null ? null : v.toUpperCase();
    }
  }
  if (raw.radius && typeof raw.radius === 'object') {
    if (RADIUS_PRESETS[raw.radius.preset] !== undefined) c.radius.preset = raw.radius.preset;
    if (Number.isFinite(+raw.radius.base)) c.radius.base = clamp(+raw.radius.base, 0, 24);
  }
  if (raw.borders && typeof raw.borders === 'object') {
    if (BORDER_PRESETS[raw.borders.preset] !== undefined) c.borders.preset = raw.borders.preset;
    if (Number.isFinite(+raw.borders.thickness)) c.borders.thickness = clamp(+raw.borders.thickness, 0.5, 2);
  }
  if (SHADOW_PRESETS[raw.shadows?.preset] !== undefined) c.shadows.preset = raw.shadows.preset;
  if (DENSITIES.includes(raw.density)) c.density = raw.density;
  if (Number.isFinite(+raw.uiScale)) c.uiScale = clamp(+raw.uiScale, 0.9, 1.4);
  if (raw.typography && typeof raw.typography === 'object') {
    const t = c.typography;
    for (const k of ['familyApp', 'familyHeading', 'familyBody']) {
      const v = raw.typography[k];
      if (typeof v === 'string' && v.length < 80) t[k] = v.replace(/["'\\;]/g, '');
    }
    if (Number.isFinite(+raw.typography.size)) t.size = clamp(+raw.typography.size, 12, 20);
    if ([300, 400, 500, 600, 700].includes(+raw.typography.weight)) t.weight = +raw.typography.weight;
    if (Number.isFinite(+raw.typography.lineHeight)) t.lineHeight = clamp(+raw.typography.lineHeight, 1.2, 2.1);
    if (Number.isFinite(+raw.typography.headingScale)) t.headingScale = clamp(+raw.typography.headingScale, 0.85, 1.3);
  }
  if (['solid', 'gradient', 'image', 'dynamic'].includes(raw.background?.type)) c.background.type = raw.background.type;
  if (raw.background?.gradient && typeof raw.background.gradient === 'object') {
    if (okColor(raw.background.gradient.from)) c.background.gradient.from = raw.background.gradient.from.toUpperCase();
    if (okColor(raw.background.gradient.to)) c.background.gradient.to = raw.background.gradient.to.toUpperCase();
    if (Number.isFinite(+raw.background.gradient.angle)) c.background.gradient.angle = clamp(+raw.background.gradient.angle, 0, 360);
  }
  if (raw.background?.image && typeof raw.background.image === 'object') {
    const bi = c.background.image;
    if (typeof raw.background.image.src === 'string' && raw.background.image.src.startsWith('data:image/') && raw.background.image.src.length < 3_000_000) bi.src = raw.background.image.src;
    for (const k of ['opacity', 'brightness', 'saturate']) if (Number.isFinite(+raw.background.image[k])) bi[k] = clamp(+raw.background.image[k], 0, 2);
    if (Number.isFinite(+raw.background.image.blur)) bi.blur = clamp(+raw.background.image.blur, 0, 24);
    if (['cover', 'contain', 'repeat'].includes(raw.background.image.size)) bi.size = raw.background.image.size;
    if (typeof raw.background.image.position === 'string') bi.position = raw.background.image.position.slice(0, 40);
  }
  if (CARD_STYLES.includes(raw.cards?.style)) c.cards.style = raw.cards.style;
  if (['lift', 'zoom', 'none'].includes(raw.cards?.hover)) c.cards.hover = raw.cards.hover;
  if (Number.isFinite(+raw.cards?.overlay)) c.cards.overlay = clamp(+raw.cards.overlay, 0, 0.9);
  for (const k of ['rating', 'year', 'progress']) if (raw.cards?.[k] === false) c.cards[k] = false;
  if (raw.sidebar && typeof raw.sidebar === 'object') {
    if (Number.isFinite(+raw.sidebar.width)) c.sidebar.width = clamp(+raw.sidebar.width, 180, 340);
    if (Number.isFinite(+raw.sidebar.opacity)) c.sidebar.opacity = clamp(+raw.sidebar.opacity, 0.3, 1);
    if (Number.isFinite(+raw.sidebar.iconSize)) c.sidebar.iconSize = clamp(+raw.sidebar.iconSize, 14, 24);
  }
  if (raw.icons && typeof raw.icons === 'object') {
    if (Number.isFinite(+raw.icons.weight)) c.icons.weight = clamp(+raw.icons.weight, 1, 2.6);
    if (Number.isFinite(+raw.icons.opacity)) c.icons.opacity = clamp(+raw.icons.opacity, 0.5, 1);
  }
  if (['full', 'reduced', 'off'].includes(raw.motion)) c.motion = raw.motion;
  if (Array.isArray(raw.home?.order)) {
    const ids = HOME_SECTIONS.map((s) => s.id);
    const order = raw.home.order.filter((id) => ids.includes(id));
    for (const id of ids) if (!order.includes(id)) order.push(id);
    c.home.order = order;
  }
  if (Array.isArray(raw.home?.hidden)) c.home.hidden = raw.home.hidden.filter((id) => HOME_SECTIONS.some((s) => s.id === id));
  if (raw.home?.counts && typeof raw.home.counts === 'object') {
    for (const [k, v] of Object.entries(raw.home.counts)) if (HOME_SECTIONS.some((s) => s.id === k) && Number.isFinite(+v)) c.home.counts[k] = clamp(+v, 4, 24);
  }
  if (raw.pageOverrides && typeof raw.pageOverrides === 'object') {
    for (const [path, o] of Object.entries(raw.pageOverrides)) {
      if (!OVERRIDE_PAGES.some(([p]) => p === path) || !o || typeof o !== 'object') continue;
      const ent = {};
      if (okColor(o.accent)) ent.accent = o.accent.toUpperCase();
      if (DENSITIES.includes(o.density)) ent.density = o.density;
      if (CARD_STYLES.includes(o.cardStyle)) ent.cardStyle = o.cardStyle;
      if (o.bg === 'none' || okColor(o.bg)) ent.bg = o.bg;
      if (Object.keys(ent).length) c.pageOverrides[path] = ent;
    }
  }
  if (Array.isArray(raw.customThemes)) {
    c.customThemes = raw.customThemes.slice(0, 50).filter((t) => t && typeof t === 'object' && typeof t.name === 'string').map((t) => ({ id: String(t.id || `theme-${Date.now()}`).slice(0, 40), name: t.name.slice(0, 40), desc: String(t.desc || '').slice(0, 120), config: validateConfig(t.config) }));
  }
  if (Array.isArray(raw.fonts)) {
    c.fonts = raw.fonts.slice(0, 20).filter((f) => f && typeof f.family === 'string').map((f) => ({ id: String(f.id).slice(0, 40), family: f.family.replace(/["'\\;]/g, '').slice(0, 60), label: String(f.label || f.family).slice(0, 60) }));
  }
  return c;
}

/* ============================ engine ============================ */
class ThemeEngine {
  constructor() {
    this.config = defaultConfig();
    this.listeners = new Set();
    this._styleEl = null;
    this._bgEl = null;
    this._raf = 0;
    this._persistT = 0;
    this._loadedFonts = new Map();
  }

  async init() {
    try {
      const stored = localStorage.getItem(LS_KEY);
      if (stored) this.config = validateConfig(JSON.parse(stored));
    } catch { this.config = defaultConfig(); }
    await this._loadCustomFonts();
    this.apply();
    window.addEventListener('zpopcorn:theme-external', () => this.apply());
    return this;
  }

  get() { return this.config; }
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  _emit() { for (const fn of this.listeners) { try { fn(this.config); } catch { /* */ } } }

  /** patch = partial config (validated). live:true → immediate repaint (rAF-batched) */
  update(patch, { persist = true } = {}) {
    const merged = validateConfig({ ...structuredClone(this.config), ...patch });
    this.config = merged;
    this._scheduleApply();
    if (persist) this._schedulePersist();
    return true;
  }
  setPath(path, value) {
    const clone = structuredClone(this.config);
    const segs = path.split('.');
    let o = clone;
    for (let i = 0; i < segs.length - 1; i++) o = o[segs[i]];
    o[segs[segs.length - 1]] = value;
    return this.update(clone);
  }

  _scheduleApply() {
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => { this._raf = 0; this.apply(); });
  }
  _schedulePersist() {
    clearTimeout(this._persistT);
    this._persistT = setTimeout(() => {
      try {
        const slim = structuredClone(this.config);
        // strip oversized payloads to protect storage
        const s = JSON.stringify(slim);
        if (s.length > 4_500_000 && slim.background?.image?.src) slim.background.image.src = null;
        localStorage.setItem(LS_KEY, s);
      } catch { /* quota — drop image and retry */
        try { const slim = structuredClone(this.config); slim.background.image.src = null; localStorage.setItem(LS_KEY, JSON.stringify(slim)); } catch { /* */ }
      }
    }, 300);
  }

  /* ---------- derived accent system (spec 08) ---------- */
  accentVars() {
    const { accent, accentMode } = this.config;
    const p = accent.primary;
    const v = {
      '--accent': p,
      '--accent-bright': shift(p, 0.12),
      '--accent-deep': shift(p, -0.12),
      '--accent-contrast': contrastOn(p),
      '--accent-soft': rgba(parseColor(p), 0.13),
      '--accent-line': rgba(parseColor(p), 0.42),
      '--accent-glow': rgba(parseColor(p), 0.16),
      '--color-accent-secondary': accent.secondary,
      '--accent-2-soft': rgba(parseColor(accent.secondary), 0.13),
      '--accent-3': accent.tertiary,
    };
    if (accentMode === 'gradient') {
      const stops = accent.stops >= 3 ? `${p}, ${accent.secondary}, ${accent.tertiary}` : `${p}, ${accent.secondary}`;
      v['--accent-grad'] = `linear-gradient(${accent.angle}deg, ${stops})`;
      v['--accent-grad-soft'] = `linear-gradient(${accent.angle}deg, ${rgba(parseColor(p), 0.14)}, ${rgba(parseColor(accent.secondary), 0.14)})`;
      v['--accent-grad-hover'] = `linear-gradient(${accent.angle}deg, ${shift(p, 0.08)}, ${shift(accent.secondary, 0.08)})`;
    }
    return v;
  }

  /** full var map for a (sub)config — reused for page overrides */
  varMap(cfg) {
    const v = { ...this.accentVars() };
    const c = cfg.colors || {};
    const put = (tok, val) => { if (val) v[tok] = val; };
    // backgrounds / surfaces
    put('--surface-0', c['bg-app']); put('--color-background', c['bg-app']);
    put('--surface-1', c['bg-main'] || c['bg-sidebar']); put('--color-surface', c['bg-main']);
    if (c['bg-sidebar']) v['--z-sb-bg'] = c['bg-sidebar'];
    if (c['bg-topbar']) v['--z-tb-bg'] = c['bg-topbar'];
    put('--surface-2', c['surface'] || c['card']); put('--color-card', c['card'] || c['surface']);
    put('--surface-3', c['surface-elev']); put('--color-card-hover', c['surface-elev']);
    put('--surface-4', c['input']); put('--color-surface-hover', c['surface-elev']);
    if (c['modal']) v['--z-modal-bg'] = c['modal'];
    // text
    put('--color-text-primary', c['text-primary']); if (c['text-primary']) put('--color-text-heading', c['text-heading'] || c['text-primary']);
    put('--color-text-secondary', c['text-secondary']); put('--color-text-muted', c['text-muted']);
    if (c['text-disabled']) v['--color-text-disabled'] = c['text-disabled'];
    if (c['text-link']) v['--z-link'] = c['text-link'];
    if (c['text-meta']) v['--z-meta'] = c['text-meta'] || c['text-muted'];
    put('--color-text-faint', c['text-muted'] && rgba(parseColor(c['text-muted']), 0.6));
    // states
    put('--color-success', c['state-success']); put('--color-warning', c['state-warning']);
    put('--color-danger', c['state-error']); put('--color-info', c['state-info']);
    // borders
    const bo = BORDER_PRESETS[cfg.borders.preset];
    if (bo !== undefined) {
      const t = clamp(+cfg.borders.thickness || 1, 0.5, 2);
      const mk = (a) => a === 0 ? 'transparent' : `rgba(255,255,255,${round(a)})`;
      if (!c['border-default']) {
        v['--color-border'] = mk(bo); v['--color-border-strong'] = mk(bo * 1.35);
        v['--color-border-subtle'] = mk(bo * 0.66); v['--color-hairline'] = mk(bo * 0.66);
        if (c['border-focus'] === undefined) v['--z-border-focus'] = rgba(parseColor(cfg.accent.primary), 0.55);
      }
      put('--color-border', c['border-default']); put('--color-border-strong', c['border-strong']);
      if (c['border-focus']) v['--z-border-focus'] = c['border-focus'];
      if (c['border-divider']) v['--color-hairline'] = c['border-divider'];
      if (c['border-selected']) v['--z-border-selected'] = c['border-selected'];
      v['--z-bw'] = `${t}px`;
    }
    // radius ladder from base
    const base = cfg.radius.preset === 'sharp' ? 0 : clamp(Number.isFinite(+cfg.radius.base) ? +cfg.radius.base : (RADIUS_PRESETS[cfg.radius.preset] ?? 12), 0, 24);
    v['--r-xs'] = `${Math.round(base * 0.25)}px`; v['--r-sm'] = `${Math.round(base * 0.5)}px`;
    v['--r-md'] = `${Math.round(base * 0.66)}px`; v['--r-lg'] = `${base}px`;
    v['--r-xl'] = `${Math.min(28, Math.round(base * 1.33))}px`; v['--r-2xl'] = `${Math.min(32, Math.round(base * 1.66))}px`;
    // shadows
    v['--card-lift'] = `${(+cfg.cards.lift || 3)}px`;
    v['--card-hover-transform'] = cfg.cards.hover === 'none' ? 'none' : cfg.cards.hover === 'zoom' ? 'scale(1.025)' : 'translateY(calc(-1 * var(--card-lift)))';
    const sa = SHADOW_PRESETS[cfg.shadows.preset];
    if (sa !== undefined) {
      v['--shadow-1'] = `0 1px 2px rgba(0,0,0,${round(sa * 0.7)})`;
      v['--shadow-2'] = `0 2px 6px rgba(0,0,0,${round(sa * 0.55)}), 0 10px 28px rgba(0,0,0,${round(sa * 0.5)})`;
      v['--shadow-3'] = `0 4px 10px rgba(0,0,0,${round(sa * 0.6)}), 0 22px 56px rgba(0,0,0,${round(sa * 0.7)})`;
      v['--shadow-pop'] = `0 18px 48px rgba(0,0,0,${round(sa * 0.85)})`;
    }
    // typography
    const t = cfg.typography;
    const uiFont = t.familyApp || t.familyBody;
    if (uiFont) {
      v['--font-ui'] = `"${uiFont}", "IBM Plex Sans Arabic", "Noto Sans Arabic", "Segoe UI", sans-serif`;
      v['--font-family'] = `var(--font-ui)`;
    }
    if (t.familyHeading) {
      v['--font-display'] = `"${t.familyHeading}", ${t.familyApp ? `"${t.familyApp}", ` : ''}"Noto Sans Arabic", "Cairo", sans-serif`;
    }
    if (t.familyBody) v['--z-font-body'] = `"${t.familyBody}", var(--font-ui)`;
    const s = +t.size || 15;
    v['--text-base'] = `${s}px`; v['--text-sm'] = `${round(s * 0.87)}px`; v['--text-xs'] = `${round(s * 0.81)}px`;
    v['--text-2xs'] = `${round(s * 0.75)}px`; v['--text-lg'] = `${round(s * 1.1)}px`;
    const hs = +t.headingScale || 1;
    v['--text-xl'] = `${round(19.5 * hs)}px`; v['--text-2xl'] = `${round(25 * hs)}px`;
    v['--text-3xl'] = `${round(32 * hs)}px`; v['--text-4xl'] = `${round(43 * hs)}px`; v['--text-5xl'] = `${round(58 * hs)}px`;
    v['--leading-base'] = `${t.lineHeight || 1.6}`;
    v['--z-weight'] = `${t.weight || 400}`;
    // scale
    if (+cfg.uiScale && cfg.uiScale !== 1) v['--z-ui-scale'] = `${cfg.uiScale}`;
    else v['--z-ui-scale'] = '1';
    return v;
  }

  apply() {
    const cfg = this.config;
    const root = document.documentElement;
    if (!this._styleEl) { this._styleEl = document.createElement('style'); this._styleEl.id = 'z-theme-engine'; document.head.appendChild(this._styleEl); }
    if (!cfg.enabled) {
      this._styleEl.textContent = '';
      root.removeAttribute('data-z-bg'); root.removeAttribute('data-z-card');
      root.removeAttribute('data-z-accent-mode'); root.removeAttribute('data-motion');
      root.style.removeProperty('--z-ui-scale');
      this._destroyBg();
      return;
    }
    const v = this.varMap(cfg);
    const decls = Object.entries(v).filter(([, val]) => val).map(([k, val]) => `${k}:${val};`).join('');
    this._styleEl.textContent = `:root.z-theme-live{${decls}}`;
    root.classList.add('z-theme-live');
    root.setAttribute('data-density', cfg.density);
    root.setAttribute('data-z-card', cfg.cards.style);
    root.setAttribute('data-z-accent-mode', cfg.accentMode);
    root.setAttribute('data-motion', cfg.motion === 'off' ? 'off' : cfg.motion === 'reduced' ? 'reduced' : 'full');
    v['--zi-sw'] = `${cfg.icons.weight}`; v['--zi-op'] = `${cfg.icons.opacity}`;
    root.style.setProperty('--zi-sw', `${cfg.icons.weight}`);
    root.style.setProperty('--zi-op', `${cfg.icons.opacity}`);
    _iconWeightTier = cfg.icons.weight > 2.05 ? 'bold' : cfg.icons.weight < 1.45 ? 'light' : 'regular';
    root.style.setProperty('--z-sb-w', `${cfg.sidebar.width}px`);
    root.style.setProperty('--z-sb-op', `${cfg.sidebar.opacity}`);
    root.style.setProperty('--z-sb-ic', `${cfg.sidebar.iconSize}px`);
    if (cfg.radius.preset === 'sharp') root.setAttribute('data-z-sharp', '1'); else root.removeAttribute('data-z-sharp');
    if (cfg.borders.preset === 'none') root.setAttribute('data-z-noborder', '1'); else root.removeAttribute('data-z-noborder');
    const cc = cfg.colors || {};
    const on = (k, v) => { if (v) root.setAttribute(k, '1'); else root.removeAttribute(k); };
    on('data-z-sb-bg', cc['bg-sidebar']); on('data-z-tb-bg', cc['bg-topbar']);
    on('data-z-modal-bg', cc['modal']); on('data-z-input-bg', cc['input']);
    if (+cfg.sidebar.opacity !== 1) root.setAttribute('data-z-sb-op', '1'); else root.removeAttribute('data-z-sb-op');
    this._applyBackground(cfg);
    if (cfg.cards.rating === false) root.setAttribute('data-z-hide-rating', '1'); else root.removeAttribute('data-z-hide-rating');
    if (cfg.cards.year === false) root.setAttribute('data-z-hide-year', '1'); else root.removeAttribute('data-z-hide-year');
    if (cfg.cards.progress === false) root.setAttribute('data-z-hide-progress', '1'); else root.removeAttribute('data-z-hide-progress');
    root.style.setProperty('--z-card-overlay', `${cfg.cards.overlay}`);
    root.style.setProperty('--z-card-hover', cfg.cards.hover === 'none' ? 'none' : cfg.cards.hover === 'zoom' ? 'scale(1.025)' : 'translateY(calc(-1 * var(--card-lift)))');
    this._emit();
  }

  _applyBackground(cfg) {
    const root = document.documentElement;
    const b = cfg.background;
    root.setAttribute('data-z-bg', b.type);
    if (b.type === 'gradient') {
      root.style.setProperty('--z-bg-gradient', `linear-gradient(${b.gradient.angle}deg, ${b.gradient.from}, ${b.gradient.to})`);
      this._destroyBg();
    } else if (b.type === 'image' && b.image.src) {
      this._destroyBg();
      const el = document.createElement('div');
      el.id = 'z-bg-image';
      el.setAttribute('aria-hidden', 'true');
      el.style.cssText = `position:fixed;inset:0;z-index:-1;pointer-events:none;background-image:url("${b.image.src}");background-size:${b.image.size};background-position:${b.image.position};background-repeat:${b.image.size === 'repeat' ? 'repeat' : 'no-repeat'};opacity:${b.image.opacity};filter:blur(${b.image.blur}px) brightness(${b.image.brightness}) saturate(${b.image.saturate});`;
      document.body.prepend(el);
      this._bgEl = el;
    } else this._destroyBg();
  }
  _destroyBg() { this._bgEl?.remove(); this._bgEl = null; }

  /* ---------- presets / customs / apply targets ---------- */
  applyPreset(id) {
    const p = PRESETS.find((x) => x.id === id) || [...this.config.customThemes].find((x) => x.id === id);
    if (!p) return false;
    const base = defaultConfig();
    return this.update({ ...base, ...structuredClone(p.config), customThemes: this.config.customThemes, fonts: this.config.fonts, home: this.config.home, pageOverrides: this.config.pageOverrides });
  }
  activePresetId() {
    const cur = JSON.stringify({ c: this.config.colors, a: this.config.accent, m: this.config.accentMode });
    for (const p of [...PRESETS, ...this.config.customThemes]) {
      const probe = validateConfig({ ...defaultConfig(), ...structuredClone(p.config || {}) });
      if (JSON.stringify({ c: probe.colors, a: probe.accent, m: probe.accentMode }) === cur) return p.id;
    }
    return null;
  }
  saveCustomTheme(name, desc) {
    const id = `theme-${Date.now()}`;
    const cfg = structuredClone(this.config);
    delete cfg.customThemes; delete cfg.pageOverrides; delete cfg.home; delete cfg.fonts;
    const t = { id, name: name.slice(0, 40), desc: (desc || '').slice(0, 120), config: cfg };
    const list = [...this.config.customThemes, t];
    this.update({ ...this.config, customThemes: list });
    return t;
  }
  duplicateTheme(id) {
    const t = this.config.customThemes.find((x) => x.id === id); if (!t) return false;
    return this.saveCustomTheme(`${t.name} (نسخة)`, t.desc);
  }
  renameTheme(id, name) {
    const list = this.config.customThemes.map((t) => (t.id === id ? { ...t, name: name.slice(0, 40) } : t));
    return this.update({ ...this.config, customThemes: validateConfig({ customThemes: list }).customThemes });
  }
  deleteTheme(id) {
    const list = this.config.customThemes.filter((t) => t.id !== id);
    return this.update({ ...this.config, customThemes: list });
  }
  exportTheme() {
    const cfg = structuredClone(this.config);
    const { customThemes, pageOverrides, home, fonts } = cfg;
    const file = { format: 'zpopcorn-theme', version: 2, exportedAt: new Date().toISOString(), meta: { name: 'zPopcorn Theme' }, config: { ...cfg } };
    return JSON.stringify(file, null, 1);
  }
  importTheme(text) {
    let data;
    try { data = JSON.parse(text); } catch { throw new Error('E_BAD_JSON'); }
    const raw = data?.format === 'zpopcorn-theme' ? data.config : data;
    if (!raw || typeof raw !== 'object') throw new Error('E_NOT_THEME');
    const validated = validateConfig(raw);   // drops junk; safe even if partial
    const kept = { customThemes: this.config.customThemes, fonts: this.config.fonts };
    validated.customThemes = raw?.customThemes ? validateConfig(raw).customThemes : kept.customThemes;
    validated.fonts = kept.fonts;
    this.update(validated);
    return true;
  }
  resetColors() { this.update({ colors: {} }); }
  resetAppearance() {
    const keep = { customThemes: this.config.customThemes, fonts: this.config.fonts, home: this.config.home };
    this.update({ ...defaultConfig(), ...keep });
  }
  resetAll() { this.update(defaultConfig()); }

  /* ---------- page overrides ---------- */
  pageOverride(path) { return this.config.pageOverrides[path] || null; }
  setPathOverride(path, ent) {
    const po = { ...this.config.pageOverrides };
    if (!ent || !Object.keys(ent).length) delete po[path]; else po[path] = ent;
    return this.update({ ...this.config, pageOverrides: po });
  }
  clearPageOverride(path) { return this.setPathOverride(path, null); }
  varsForOverride(ent) {
    if (!ent) return {};
    const probe = structuredClone(this.config);
    if (ent.accent) probe.accent = { ...probe.accent, primary: ent.accent };
    if (ent.bg && ent.bg !== 'none') probe.colors = { ...probe.colors, 'bg-app': ent.bg };
    return this.varMap(probe);
  }

  /* ---------- home layout ---------- */
  homeOrder() { return this.config.home.order.filter((id) => !this.config.home.hidden.includes(id)); }
  isSectionVisible(id) { return this.homeOrder().includes(id); }
  sectionCount(id) { return this.config.home.counts[id] || 14; }
  moveSection(id, delta) {
    const order = [...this.config.home.order];
    const i = order.indexOf(id); const j = i + delta;
    if (i < 0 || j < 0 || j >= order.length) return false;
    order.splice(i, 1); order.splice(j, 0, id);
    return this.update({ ...this.config, home: { ...this.config.home, order } });
  }
  toggleSection(id) {
    const hidden = new Set(this.config.home.hidden);
    if (hidden.has(id)) hidden.delete(id); else hidden.add(id);
    return this.update({ ...this.config, home: { ...this.config.home, hidden: [...hidden] } });
  }
  setSectionCount(id, n) {
    return this.update({ ...this.config, home: { ...this.config.home, counts: { ...this.config.home.counts, [id]: clamp(n, 4, 24) } } });
  }

  /* ---------- custom fonts (no OS install required) ---------- */
  async _loadCustomFonts() {
    let records = [];
    try {
      const { db } = await import('../services/storage/Database.js');
      records = (await db.getAll(FONT_STORE)) || [];
    } catch { records = []; }
    for (const rec of records) await this._registerFont(rec);
  }
  async _registerFont(rec) {
    if (!rec?.family || !rec?.data || this._loadedFonts.has(rec.family)) return;
    try {
      const ff = new FontFace(rec.family, `url(${rec.data})`, { display: 'swap' });
      await ff.load();
      document.fonts.add(ff);
      this._loadedFonts.set(rec.family, rec);
    } catch (e) { console.warn('font load failed', e); }
  }
  async addFontFile(file) {
    if (!file || !/\.(ttf|otf|woff2?|woff)$/i.test(file.name)) throw new Error('صيغة غير مدعومة — استخدم TTF/OTF/WOFF');
    const buf = await file.arrayBuffer();
    if (buf.byteLength > 4_000_000) throw new Error('حجم الخط كبير (الحد 4 ميجابايت)');
    const b64 = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(file); });
    const label = file.name.replace(/\.[^.]+$/, '');
    const family = `zFont-${label.replace(/[^a-z0-9]+/gi, '')}-${Date.now().toString(36)}`;
    const rec = { key: family, id: family, family, label, data: b64, format: file.name.split('.').pop() };
    try {
      const { db } = await import('../services/storage/Database.js');
      await db.put(FONT_STORE, rec);
    } catch { /* session-only */ }
    await this._registerFont(rec);
    const fonts = [...this.config.fonts.filter((f) => f.family !== family), { id: family, family, label }];
    this.update({ ...this.config, fonts });
    return { family, label };
  }
  async removeFont(family) {
    try {
      const { db } = await import('../services/storage/Database.js');
      await db.delete(FONT_STORE, family);
    } catch { /* */ }
    for (const f of document.fonts) if (f.family === `"${family}"` || f.family === family) document.fonts.delete(f);
    this._loadedFonts.delete(family);
    this.update({ ...this.config, fonts: this.config.fonts.filter((f) => f.family !== family) });
  }
  availableFonts() {
    const custom = this.config.fonts.map((f) => ({ value: f.family, label: f.label }));
    return [
      { value: '', label: 'افتراضي zPopcorn (IBM Plex + Noto)' },
      ...custom,
    ];
  }
}

export const themeEngine = new ThemeEngine();

/* quick token snapshot for the pre-paint script (index.html reads only this) */
export function prePaintMap(cfg) {
  try {
    const e = new ThemeEngine(); e.config = validateConfig(cfg);
    const v = e.varMap(e.config);
    const keys = ['--surface-0', '--accent', '--accent-2', '--accent-grad', '--z-ui-scale', '--r-lg'];
    const out = {};
    for (const k of keys) if (v[k]) out[k] = v[k];
    return { density: e.config.density, vars: out };
  } catch { return null; }
}
