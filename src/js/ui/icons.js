/**
 * ═══════════════════════════════════════════════════════════════════════
 *  ZPOPCORN ICON LANGUAGE — v2, built from scratch
 *  A proprietary, purpose-drawn family for the desktop media library.
 *  No icon libraries, no unicode, no mixed styles.
 * ───────────────────────────────────────────────────────────────────────
 *  GRID SYSTEM
 *   • 24 × 24 canvas · 22 × 22 safe area (all marks live in 2→22)
 *   • optical center (12, 12) — round shapes ride the keyline circle r 8.5
 *   • primary stroke 1.7 (user-scalable via --zi-sw), round cap + round join
 *   • corner-radius family: frames rx 2.5 · cards/rows rx 2 · chips rx 1.5
 *   • one 45° language: chevron arms, search handle, slash cuts
 *   • media frames share a single rectangle: x 3.5 y 4.5 w 17 h 15
 *   • filled accents (hearts/dots) are r ≤ 1 solid currentColor — never blobs
 *   • every glyph must read at 14px and stand still at 24px
 *  STATES (see shell.css — ICON STATE LAYER):
 *   default currentColor · hover/selected accent-bright · active scale .92
 *   disabled --color-text-faint · focus inherits parent's ring · loading spins
 * ═══════════════════════════════════════════════════════════════════════
 */

const P = {
  /* ── Navigation ─────────────────────────────────────────────────────── */
  home: '<path d="M3.5 10.5 12 3.5l8.5 7"/><path d="M6 9.5v11h4.2v-5h3.6v5H18v-11"/>',
  compass: '<circle cx="12" cy="12" r="8.5"/><path d="m15.6 8.4-2.1 5.1-5.1 2.1 2.1-5.1z"/>',
  explore: '<circle cx="12" cy="12" r="8.5"/><path d="m15.6 8.4-2.1 5.1-5.1 2.1 2.1-5.1z"/>',
  film: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M7.5 4.5v15M16.5 4.5v15M3.5 9.5h4M3.5 14.5h4M16.5 9.5h4M16.5 14.5h4"/>',
  tv: '<rect x="3" y="6" width="18" height="12.5" rx="2.5"/><path d="M8.5 21.5h7M12 18.5v3"/><path d="m7.5 2.8 4.5 3 4.5-3"/>',
  series: '<rect x="3" y="6" width="18" height="12.5" rx="2.5"/><path d="M8.5 21.5h7M12 18.5v3"/>',
  sparkle: '<path d="M11 3.6 12.9 8.4 17.7 10.3 12.9 12.2 11 17 9.1 12.2 4.3 10.3 9.1 8.4z"/><path d="m18.3 15.3.8 2.3 2.3.8-2.3.8-.8 2.3-.8-2.3-2.3-.8 2.3-.8z"/>',
  anime: '<path d="M11 3.6 12.9 8.4 17.7 10.3 12.9 12.2 11 17 9.1 12.2 4.3 10.3 9.1 8.4z"/><path d="m18.3 15.3.8 2.3 2.3.8-2.3.8-.8 2.3-.8-2.3-2.3-.8 2.3-.8z"/>',
  library: '<rect x="4" y="4.5" width="4.5" height="15" rx="1.5"/><rect x="10.5" y="4.5" width="4.5" height="15" rx="1.5"/><path d="m17.4 5.6 3.2 14.1"/>',
  database: '<ellipse cx="12" cy="6" rx="7.5" ry="2.6"/><path d="M4.5 6v12c0 1.4 3.4 2.6 7.5 2.6s7.5-1.2 7.5-2.6V6"/><path d="M4.5 12c0 1.4 3.4 2.6 7.5 2.6s7.5-1.2 7.5-2.6"/>',
  search: '<circle cx="10.75" cy="10.75" r="7"/><path d="m16 16 4.5 4.5"/>',
  filter: '<path d="M4 5.5h16l-6.2 7.2v5.1l-3.6 1.7v-6.8z"/>',
  sort: '<path d="M7 4.5v15m0 0-3.2-3.2M7 19.5l3.2-3.2M17 19.5v-15m0 0-3.2 3.2M17 4.5l3.2 3.2"/>',
  grid: '<rect x="3.5" y="3.5" width="7.5" height="7.5" rx="2"/><rect x="13" y="3.5" width="7.5" height="7.5" rx="2"/><rect x="3.5" y="13" width="7.5" height="7.5" rx="2"/><rect x="13" y="13" width="7.5" height="7.5" rx="2"/>',
  list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="5" cy="6.5" r=".95" fill="currentColor" stroke="none"/><circle cx="5" cy="12" r=".95" fill="currentColor" stroke="none"/><circle cx="5" cy="17.5" r=".95" fill="currentColor" stroke="none"/>',
  rows: '<rect x="3.5" y="5" width="17" height="5.5" rx="2"/><rect x="3.5" y="13.5" width="17" height="5.5" rx="2"/>',
  menu: '<path d="M4 6.8h16M4 12h16M4 17.2h16"/>',
  more: '<circle cx="5.5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1" fill="currentColor" stroke="none"/>',
  chevL: '<path d="m14.25 6.75-5.5 5.25 5.5 5.25"/>',
  chevR: '<path d="m9.75 6.75 5.5 5.25-5.5 5.25"/>',
  chevD: '<path d="m6.75 9.75 5.25 5.5 5.25-5.5"/>',
  chevU: '<path d="m6.75 14.25 5.25-5.5 5.25 5.5"/>',
  arrowL: '<path d="M19.5 12h-15m0 0 5.5-5.5M4.5 12 10 17.5"/>',
  arrowR: '<path d="M4.5 12h15m0 0-5.5-5.5M19.5 12 14 17.5"/>',
  expand: '<path d="M4.5 9.5v-5h5M19.5 9.5v-5h-5M4.5 14.5v5h5M19.5 14.5v5h-5"/>',
  collapse: '<path d="M9.5 4.5v5h-5M14.5 4.5v5h5M9.5 19.5v-5h-5M14.5 19.5v-5h5"/>',

  /* ── Media ──────────────────────────────────────────────────────────── */
  play: '<path d="M8.5 5.3v13.4L18.9 12z"/>',
  playCircle: '<circle cx="12" cy="12" r="8.5"/><path d="M10.2 8.4v7.2L15.6 12z"/>',
  pause: '<path d="M9.2 5.5v13M14.8 5.5v13"/>',
  disc: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.5"/>',
  monitor: '<rect x="3.5" y="4.5" width="17" height="12.5" rx="2.5"/><path d="M8.5 21h7M12 17v4"/>',
  cast: '<path d="M4 19.5a2 2 0 0 0 2-2 2 2 0 0 0-2 2zm-.5-4.5a7 7 0 0 1 7 7"/><path d="M3.5 6.5A14.5 14.5 0 0 1 18 21"/><path d="M3.5 10.5A10.5 10.5 0 0 1 14 21"/><path d="M20.5 12v6.5a2 2 0 0 1-2 2h-5"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="m4.5 17.5 4.8-4.2 3.6 3 3-2.4 4.3 3.6"/>',
  hd: '<rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/><path d="M7.5 9.5v5M7.5 12h2.6M7.5 9.5h2.6a2.5 2.5 0 0 1 0 5M14.5 14.5v-5h1.6a2.5 2.5 0 0 1 0 5z"/>',
  subtitle: '<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><path d="M7 10.5h5M7 14h3.5M14 14h3"/>',
  episodes: '<rect x="3.5" y="7.5" width="17" height="12" rx="2.5"/><path d="M7.5 4.5h11a3 3 0 0 1 3 3"/><path d="m9.5 11.5 4.5 2.25-4.5 2.25z" fill="currentColor" stroke="none"/><path d="M6.5 12v3"/>',
  seasons: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 9.5h17M8.5 2.8v4.4M15.5 2.8v4.4"/><path d="M8.5 13.5h7a3.5 3.5 0 0 1-4.6 3.9m1.6-3.9-2 2m2-2 2 2"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 9.5h17M8.5 2.8v4.4M15.5 2.8v4.4"/><circle cx="8" cy="13.5" r="1" fill="currentColor" stroke="none"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.2V12l3.5 2.1"/>',
  duration: '<circle cx="12" cy="12" r="8.5"/><path d="M12 8v4.4"/><path d="M6.4 3.4 4.5 5.4M17.6 3.4l1.9 2"/>',
  rating: '<path d="m12 3.6 2.4 5.1 5.5.7-4.1 3.9 1.1 5.6L12 16.2l-4.9 2.7 1.1-5.6-4.1-3.9 5.5-.7z"/>',
  star: '<path d="m12 3.6 2.4 5.1 5.5.7-4.1 3.9 1.1 5.6L12 16.2l-4.9 2.7 1.1-5.6-4.1-3.9 5.5-.7z"/>',
  language: '<path d="M4.5 5.5h8M8.5 5.5v-.8m0 .8c-.3 3.6-2.8 6.7-5.8 8.1M5.8 9.2c1.1 2.3 3 4 5.2 4.8"/><path d="m12.5 19.5 3.7-9 3.7 9m-6-2.1h5.1"/>',

  /* ── Collections & library ops ──────────────────────────────────────── */
  folder: '<path d="M3.5 7.5A2.5 2.5 0 0 1 6 5h3.2a2 2 0 0 1 1.6.8l.9 1.2H18A2.5 2.5 0 0 1 20.5 10v7.5a2.5 2.5 0 0 1-2.5 2.5H6a2.5 2.5 0 0 1-2.5-2.5z"/>',
  folderOpen: '<path d="M3.5 17.5V7.5A2.5 2.5 0 0 1 6 5h3.2a2 2 0 0 1 1.6.8l.9 1.2H18a2.5 2.5 0 0 1 2.5 2.5v1.2"/><path d="M3.2 10.5H20.9l-2 8.3a1.6 1.6 0 0 1-1.6 1.2H6.9a1.6 1.6 0 0 1-1.6-1.3z"/>',
  import: '<path d="M12 3.5v10.5m0 0 4-4m-4 4-4-4"/><path d="M4 15.5v2A3 3 0 0 0 7 20.5h10a3 3 0 0 0 3-3v-2"/>',
  export: '<path d="M12 15.5V5m0 0-4 4m4-4 4 4"/><path d="M4 15.5v2A3 3 0 0 0 7 20.5h10a3 3 0 0 0 3-3v-2"/>',
  download: '<path d="M12 4v11.5m0 0 4.2-4.2M12 15.5 7.8 11.3"/><path d="M4.5 17.5v1a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-1"/>',
  upload: '<path d="M12 15V3.5m0 0-4.2 4.2M12 3.5l4.2 4.2"/><path d="M4.5 17.5v1a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-1"/>',
  scan: '<path d="M3.5 8.5v-3a2 2 0 0 1 2-2h3M15.5 3.5h3a2 2 0 0 1 2 2v3M20.5 15.5v3a2 2 0 0 1-2 2h-3M8.5 20.5h-3a2 2 0 0 1-2-2v-3"/><path d="M3.5 12h17"/>',
  snap: '<rect x="3.5" y="6.5" width="17" height="13" rx="2.5"/><path d="m8.2 6.5 1.4-2.2h4.8l1.4 2.2"/><circle cx="12" cy="13" r="3.4"/>',
  drive: '<rect x="3" y="13" width="18" height="6.5" rx="2"/><path d="m5.5 13 2.6-7.5A2 2 0 0 1 10 4.2h4a2 2 0 0 1 1.9 1.3L18.5 13"/><path d="M7 16.2h.01M10.5 16.2h.01"/>',
  layers: '<path d="m12 3.2 8.7 4.4-8.7 4.4-8.7-4.4z"/><path d="m3.3 12.2 8.7 4.4 8.7-4.4M3.3 16.4l8.7 4.4 8.7-4.4"/>',
  collection: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="m8.6 12.4 2.4 2.4 4.4-4.6"/>',
  dup: '<rect x="3.5" y="3.5" width="13" height="13" rx="2.5"/><path d="M10.5 20.5H18a2.5 2.5 0 0 0 2.5-2.5v-7.5"/>',
  metadata: '<path d="M4 11.4V5.5A1.5 1.5 0 0 1 5.5 4h5.9a1.5 1.5 0 0 1 1.1.4l7.1 7.1a1.5 1.5 0 0 1 0 2.1l-6.5 6.5a1.5 1.5 0 0 1-2.1 0L4.4 12.5a1.5 1.5 0 0 1-.4-1.1z"/><circle cx="8.2" cy="8.2" r="1.1" fill="currentColor" stroke="none"/>',
  archive: '<rect x="3.5" y="4.5" width="17" height="5" rx="1.5"/><path d="M5 9.5v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8"/><path d="M10 13h4"/>',
  refresh: '<path d="M19.7 12a7.7 7.7 0 1 1-2.3-5.5"/><path d="M19.7 3.8v3.9h-3.9"/>',

  /* ── Actions ────────────────────────────────────────────────────────── */
  plus: '<path d="M12 5.5v13M5.5 12h13"/>',
  minus: '<path d="M5.5 12h13"/>',
  add: '<path d="M12 5.5v13M5.5 12h13"/>',
  remove: '<path d="M5.5 12h13"/>',
  check: '<path d="m5.2 12.6 4.6 4.6L18.8 7.4"/>',
  x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  heart: '<path d="M12 20.2S5.2 15.9 3.4 11.7C2.2 8.7 4.1 5.4 7.4 5.4c1.9 0 3.4 1 4.6 2.4 1.2-1.4 2.7-2.4 4.6-2.4 3.3 0 5.2 3.3 4 6.3-1.8 4.2-8.6 8.5-8.6 8.5z"/>',
  favorite: '<path d="M12 20.2S5.2 15.9 3.4 11.7C2.2 8.7 4.1 5.4 7.4 5.4c1.9 0 3.4 1 4.6 2.4 1.2-1.4 2.7-2.4 4.6-2.4 3.3 0 5.2 3.3 4 6.3-1.8 4.2-8.6 8.5-8.6 8.5z"/>',
  heartFill: '<path fill="currentColor" stroke="none" d="M12 20.2S5.2 15.9 3.4 11.7C2.2 8.7 4.1 5.4 7.4 5.4c1.9 0 3.4 1 4.6 2.4 1.2-1.4 2.7-2.4 4.6-2.4 3.3 0 5.2 3.3 4 6.3-1.8 4.2-8.6 8.5-8.6 8.5z"/>',
  bookmark: '<path d="M6.5 4h11v16l-5.5-4.2L6.5 20z"/>',
  bookmarkFill: '<path fill="currentColor" stroke="none" d="M6.5 4h11v16l-5.5-4.2L6.5 20z"/>',
  match: '<circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="2.2"/><path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3"/>',
  edit: '<path d="m4.5 19.5.9-3.9L16.3 5.6a1.9 1.9 0 0 1 2.7 0l.4.4a1.9 1.9 0 0 1 0 2.7L8.4 18.6z"/><path d="m14.8 7.2 2.9 2.9"/>',
  delete: '<path d="M4.5 6.5h15M9.7 6.5V4.9A1.4 1.4 0 0 1 11.1 3.5h1.8a1.4 1.4 0 0 1 1.4 1.4v1.6"/><path d="m6.6 6.5.85 12.1a1.7 1.7 0 0 0 1.7 1.6h5.7a1.7 1.7 0 0 0 1.7-1.6l.85-12.1"/><path d="M10 10v6.5M14 10v6.5"/>',
  trash: '<path d="M4.5 6.5h15M9.7 6.5V4.9A1.4 1.4 0 0 1 11.1 3.5h1.8a1.4 1.4 0 0 1 1.4 1.4v1.6"/><path d="m6.6 6.5.85 12.1a1.7 1.7 0 0 0 1.7 1.6h5.7a1.7 1.7 0 0 0 1.7-1.6l.85-12.1"/><path d="M10 10v6.5M14 10v6.5"/>',
  save: '<path d="M5.5 5h10.4L19 8.1V18a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 18V6.5A1.5 1.5 0 0 1 6.5 5z"/><path d="M8.5 5v4.5h6V5.6M8.5 15h7"/>',
  share: '<circle cx="6" cy="12" r="2.4"/><circle cx="17.5" cy="6.5" r="2.4"/><circle cx="17.5" cy="17.5" r="2.4"/><path d="m8.2 10.8 7.1-3.2M8.2 13.2l7.1 3.1"/>',
  external: '<path d="M14 4.5h5.5V10M19.5 4.5 12 12"/><path d="M18 13.5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4.5"/>',
  pin: '<path d="M12 21c.9-4.6 5.5-6.6 5.5-10.4A5.5 5.5 0 0 0 6.5 10.6C6.5 14.4 11.1 16.4 12 21z"/><circle cx="12" cy="10.4" r="2.2"/>',
  eye: '<path d="M2.8 12S6.3 5.5 12 5.5 21.2 12 21.2 12 17.7 18.5 12 18.5 2.8 12 2.8 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="m4 4 16 16"/><path d="M9.9 5.2A9.6 9.6 0 0 1 12 5c5 0 8.5 4.2 9.6 6.2a12 12 0 0 1-2.2 2.8M6.4 7.3C4.6 8.6 3.3 10.3 2.4 11.9 3.5 13.9 7 18 12 18a9.4 9.4 0 0 0 3.5-.7"/><path d="M9.9 10a3 3 0 0 0 4.2 4.2"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11.2v5M12 7.9h.01"/>',
  history: '<path d="M4 12a8 8 0 1 0 2.4-5.7M4.2 3.6v3.5h3.5"/><path d="M12 8v4.2l3 1.8"/>',

  /* ── System & states ────────────────────────────────────────────────── */
  gear: '<circle cx="12" cy="12" r="3.1"/><circle cx="12" cy="12" r="6.6"/><path d="M12 3.1v2.3M12 18.6v2.3M3.1 12h2.3M18.6 12h2.3M5.7 5.7l1.6 1.6M16.7 16.7l1.6 1.6M18.3 5.7l-1.6 1.6M7.3 16.7l-1.6 1.6"/>',
  settings: '<circle cx="12" cy="12" r="3.1"/><circle cx="12" cy="12" r="6.6"/><path d="M12 3.1v2.3M12 18.6v2.3M3.1 12h2.3M18.6 12h2.3M5.7 5.7l1.6 1.6M16.7 16.7l1.6 1.6M18.3 5.7l-1.6 1.6M7.3 16.7l-1.6 1.6"/>',
  slider: '<path d="M4 7.2h7M15.8 7.2H20M4 16.8h3.4M12.2 16.8H20"/><circle cx="13.1" cy="7.2" r="2.2"/><circle cx="9.5" cy="16.8" r="2.2"/>',
  sliders: '<path d="M4 7.2h7M15.8 7.2H20M4 16.8h3.4M12.2 16.8H20"/><circle cx="13.1" cy="7.2" r="2.2"/><circle cx="9.5" cy="16.8" r="2.2"/>',
  palette: '<path d="M12 3.4a8.6 8.6 0 1 0 0 17.2c1.7 0 2-1.2 1.2-2-.9-1-.3-2.7 1.2-2.7H18a2.9 2.9 0 0 0 2.9-3C20.3 7.2 16.5 3.4 12 3.4z"/><circle cx="7.7" cy="11.2" r=".95" fill="currentColor" stroke="none"/><circle cx="10.2" cy="7.4" r=".95" fill="currentColor" stroke="none"/><circle cx="14.6" cy="7.9" r=".95" fill="currentColor" stroke="none"/>',
  theme: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17a8.5 8.5 0 0 0 0-17z" fill="currentColor" stroke="none"/>',
  appearance: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2.4M12 18.6V21M5 5l1.7 1.7M17.3 17.3 19 19M3 12h2.4M18.6 12H21M5 19l1.7-1.7M17.3 6.7 19 5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.8v2.4M12 18.8v2.4M4.6 4.6l1.7 1.7M17.7 17.7l1.7 1.7M2.8 12h2.4M18.8 12h2.4M4.6 19.4l1.7-1.7M17.7 6.3l1.7-1.7"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z"/>',
  storage: '<ellipse cx="12" cy="6" rx="7.5" ry="2.6"/><path d="M4.5 6v5c0 1.4 3.4 2.6 7.5 2.6s7.5-1.2 7.5-2.6V6"/><path d="M4.5 11v5c0 1.4 3.4 2.6 7.5 2.6s7.5-1.2 7.5-2.6v-5"/><path d="M4.5 16v2c0 1.4 3.4 2.6 7.5 2.6s7.5-1.2 7.5-2.6v-2"/>',
  cache: '<rect x="5.5" y="5.5" width="13" height="13" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M9 2.5v3M15 2.5v3M9 18.5v3M15 18.5v3M2.5 9h3M2.5 15h3M18.5 9h3M18.5 15h3"/>',
  backup: '<circle cx="8.5" cy="8.5" r="5"/><circle cx="15.5" cy="15.5" r="5"/><path d="M13.5 6h3.7a1.8 1.8 0 0 1 1.8 1.8V10M10.5 18H6.8A1.8 1.8 0 0 1 5 16.2V12.5"/>',
  updates: '<circle cx="12" cy="12" r="8.5"/><path d="M12 15.5v-7m0 0-3 3m3-3 3 3"/>',
  power: '<path d="M12 3.5v8.5"/><path d="M6.8 6.5a7.5 7.5 0 1 0 10.4 0"/>',
  bell: '<path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 4.2 1.7 5.5 1.7 5.5H4.8S6.5 14.2 6.5 10z"/><path d="M10.3 19a2 2 0 0 0 3.4 0"/>',
  key: '<circle cx="8.2" cy="15.8" r="3.7"/><path d="m10.9 13.1 7.2-7.2M15.8 8.2l2.4 2.4M18.1 5.9 20.5 8.3"/>',
  lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  shield: '<path d="M12 3 19 5.8v5.4c0 4.3-3 7.3-7 8.8-4-1.5-7-4.5-7-8.8V5.8z"/><path d="m9 11.7 2.2 2.2 4.3-4.3"/>',
  terminal: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="m7.5 9.5 3 2.5-3 2.5M13 15h4"/>',
  bolt: '<path d="M13 2.8 5.4 13.6h5.7L10 21.2l7.6-10.8H12z"/>',
  wifi: '<path d="M2.8 9.5a13 13 0 0 1 18.4 0M6 12.8a8.5 8.5 0 0 1 12 0M9.3 16a4 4 0 0 1 5.4 0"/><circle cx="12" cy="19.2" r=".95" fill="currentColor" stroke="none"/>',
  wifiOff: '<path d="M2.8 9.5a13 13 0 0 1 6-3.3M15 6.5a13 13 0 0 1 6.2 3M6 12.8a8.5 8.5 0 0 1 3.2-2M9.3 16a4 4 0 0 1 5.4 0M3.5 3.5l17 17"/>',
  alert: '<path d="M12 3.8 21 19.5H3z"/><path d="M12 9.8v4.4M12 17.2h.01"/>',
  warning: '<path d="M12 3.8 21 19.5H3z"/><path d="M12 9.8v4.4M12 17.2h.01"/>',
  error: '<circle cx="12" cy="12" r="8.5"/><path d="m9 9 6 6m0-6-6 6"/>',
  success: '<circle cx="12" cy="12" r="8.5"/><path d="m8.2 12.2 2.6 2.6 5-5"/>',
  loading: '<path d="M12 3.5a8.5 8.5 0 1 1-8.1 11"/>',
  bulb: '<path d="M9.7 17.5h4.6M10.5 20.5h3"/><path d="M12 3.4a5.9 5.9 0 0 1 3.5 10.6c-.7.6-1.1 1.3-1.1 2.1h-4.8c0-.8-.4-1.5-1.1-2.1A5.9 5.9 0 0 1 12 3.4z"/>',
  robot: '<rect x="4.5" y="7.5" width="15" height="11.5" rx="2.5"/><path d="M12 3.8v3.7M3 12.5v3M21 12.5v3"/><circle cx="9.3" cy="12.8" r="1" fill="currentColor" stroke="none"/><circle cx="14.7" cy="12.8" r="1" fill="currentColor" stroke="none"/><path d="M9.5 16.2h5"/>',
  chart: '<path d="M4.5 20V11M10 20V4.5M15.5 20v-6M20.5 20h-18"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.5 3.7 5.4 3.7 8.5s-1.3 6-3.7 8.5c-2.4-2.5-3.7-5.4-3.7-8.5s1.3-6 3.7-8.5z"/>',
  users: '<circle cx="9" cy="8.5" r="3.4"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 5.6a3.4 3.4 0 0 1 0 5.8M17.5 19a5.4 5.4 0 0 0-1.7-3.9"/>',
  award: '<circle cx="12" cy="9.2" r="5.2"/><path d="m8.7 13.6-1.4 6.9 4.7-2.5 4.7 2.5-1.4-6.9"/>',
  type: '<path d="M5 7V5.5h14V7M12 5.5V19m-2.2 0h4.4"/>',
  inbox: '<path d="M6 4.5h12l3.5 9v5a2.5 2.5 0 0 1-2.5 2.5h-14A2.5 2.5 0 0 1 2.5 18.5v-5z"/><path d="M2.5 13.5h5l1.3 2.4h6.4l1.3-2.4h5"/>',

  /* ── Brand (fixed geometry — not part of the stroke system) ─────────── */
  logo: '<path d="M7 10.5C6 9.8 6 8 7.2 7.2 8.4 6.4 10 7 10.4 8.2c.6-1.4 2.4-1.8 3.6-.8 1.2.9 1.2 2.7.1 3.5"/><path d="M6.8 10.8h10.4l-1.1 8a1.8 1.8 0 0 1-1.8 1.6H9.7a1.8 1.8 0 0 1-1.8-1.6zM9.4 13.5v4.2M12 13v4.8M14.6 13.5v4.2"/>',
};

/** aliases kept so old call-sites never render a fallback */
const A = {
  tvshows: 'tv', movies: 'film', watchLater: 'bookmark', watchlist: 'bookmark',
  close2: 'x', cancel: 'x', clear: 'x',
  restore: 'backup', duplicate: 'dup', collections: 'layers', folder2: 'folder',
  quality: 'hd', media: 'play', subtitleToggle: 'subtitle',
};

/** @returns {string} inline <svg> — the ONLY icon renderer in the app */
export function icon(name, size = 18, opts = {}) {
  const { stroke = 1.7, cls = '' } = opts;
  let key = P[name] ? name : (A[name] || 'disc');
  const auto = key === 'loading' ? ' spin' : '';
  return `<svg class="zi${auto}${cls ? ' ' + cls : ''}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${P[key]}</svg>`;
}
export const ICON_NAMES = Object.keys(P);
export { P as ICON_PATHS };
export default icon;
