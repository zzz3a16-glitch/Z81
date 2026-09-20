/**
 * ═══════════════════════════════════════════════════════════════════════
 *  ZPOPCORN ICON SYSTEM v3 — one language, three registers
 * ───────────────────────────────────────────────────────────────────────
 *  PHOSPHOR (primary, static)         vendored in icon-data.generated.js
 *    thin/light  → sidebar & secondary UI
 *    regular     → standard controls  (default)
 *    bold        → important actions  (CTAs, primary buttons)
 *    duotone     → special visual states (hero, active highlights)
 *    fill        → the filled pair (heartFill / bookmarkFill / star)
 *  HUGEICONS (free set, stroke)       large-format accents only (≥24px,
 *    high-impact tiles) — never mixed into 14–18px control rows.
 *  LORDICON (animated engine)         meaningful states only — see IconFX.js
 *  ─────────────────────────────────────────────────────────────────────
 *  Shared grid: Phosphor native 256 canvas (icons scale to any px),
 *  corner treatment & optical weight uniform per size:
 *    12–14px → weights thin/light 16–20px → regular (default)
 *    22–28px → bold for emphasis · 36px+ → huge/duotone allowed.
 *  Color always currentColor → hover/active/disabled states ride the
 *  existing ICON STATE LAYER (shell.css). Never emoji, never unicode.
 * ═══════════════════════════════════════════════════════════════════════
 */
import { PH, HU, BRAND } from './icon-data.generated.js';

/** legacy/data-layer names → canonical glyph (historical rows keep working) */
const A = {
  explore: 'compass', movies: 'film', tvshows: 'tv', watchLater: 'bookmark',
  watchlist: 'bookmark', collections: 'layers', folder2: 'folder',
  quality: 'hd', media: 'play', duplicate: 'dup', restore: 'backup',
  settings: 'gear', appearance: 'sun', information: 'info', cancel: 'x',
  clear: 'x', close2: 'x', back: 'arrowL', forward: 'arrowR',
  favorite: 'heart', remove: 'minus', add: 'plus', metadata: 'tag',
  theme: 'palette', subtitleToggle: 'subtitle', select: 'check',
};

/** weight tier — owned by ThemeEngine (icons.weight slider); read lazily so a
 *  single global weight choice flows into every glyph, live. */
let _tier = 'regular';
import('../theme/ThemeEngine.js').then((m) => {
  if (typeof m.iconWeightTier !== 'function') return;
  _tier = m.iconWeightTier();
  m.themeEngine?.subscribe?.(() => { _tier = m.iconWeightTier(); });
}).catch(() => {});

function resolveWeight(name, size, explicit) {
  if (explicit) return explicit;
  if (FILLNAMES.has(name)) return 'regular'; // data already baked filled
  if (_tier === 'light' && entry.light) return 'light';
  if (_tier === 'bold') return 'bold';
  if (size >= 30) return 'bold';
  return 'regular';
}
const FILLNAMES = new Set(['heartFill', 'bookmarkFill', 'star']);

/** @returns {string} inline <svg> — the ONLY static-icon renderer in the app */
export function icon(name, size = 18, opts = {}) {
  const { stroke = 1.7, cls = '', weight } = opts;
  if (BRAND[name]) {
    return `<svg class="zi zi-brand${cls ? ' ' + cls : ''}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${BRAND[name]}</svg>`;
  }
  const key = PH[name] ? name : (PH[A[name]] ? A[name] : null);
  const entry = key ? PH[key] : null;
  let inner;
  if (entry) {
    const w = resolveWeight(key, size, weight);
    inner = entry[w] || entry.regular;
  } else {
    inner = '<path d="M128,24a104,104,0,1,0,104,104A104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88,88.1,88.1,0,0,1-88,88Z"/>'; // disc fallback
  }
  return `<svg class="zi zi-fill${cls ? ' ' + cls : ''}" width="${size}" height="${size}" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true" focusable="false">${inner}</svg>`;
}

/** large-format accent glyphs — Hugeicons free set (24 grid, stroke-based).
 *  Only for 24px+ prominent tiles; stroke stays engine-controlled. */
export function iconHuge(name, size = 28, opts = {}) {
  const { stroke = 1.5, cls = '' } = opts;
  const inner = HU[name] || HU.play;
  return `<svg class="zi zi-huge${cls ? ' ' + cls : ''}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${inner}</svg>`;
}

/** duotone for special visual states */
export function iconDuo(name, size = 20, opts = {}) {
  return icon(name, size, { ...opts, weight: 'duotone' });
}

/* exports kept for older call-sites */
export const ICON_PATHS = Object.fromEntries(Object.entries(PH).map(([k, v]) => [k, v.regular]));
export const ICON_NAMES = Object.keys(PH);
export default icon;
