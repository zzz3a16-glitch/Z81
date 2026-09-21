/**
 * IconFX — Lordicon-powered meaningful states (the animated register of the
 * zPopcorn icon language). The @lordicon/element player is bundled from npm;
 * the six animation files are vendored zPopcorn Lotties (src/assets/anim)
 * authored on the same grid/weight as the static family — so the app works
 * fully offline, and the accent color is injected at hydration time.
 *
 * Usage: `iconAnim('loading', 48)` inside any template, then the global
 * hydrator (wired in App) mounts real <lord-icon> elements over a static
 * Phosphor duotone fallback. If the player or a file fails, the fallback
 * simply stays — a state is never left iconless.
 */
import { icon } from './icons.js';

import loadingUrl from '../../assets/anim/loading.json?url';
import successUrl from '../../assets/anim/success.json?url';
import errorUrl from '../../assets/anim/error.json?url';
import syncingUrl from '../../assets/anim/syncing.json?url';
import importingUrl from '../../assets/anim/importing.json?url';
import emptyUrl from '../../assets/anim/empty.json?url';

/** kind → {file, loop, fallback (phosphor name), static weight} */
export const ANIM = {
  loading:   { url: loadingUrl,  loop: true,  fb: 'loading', size: [36, 56] },
  success:   { url: successUrl,  loop: false, fb: 'success' },
  error:     { url: errorUrl,    loop: false, fb: 'error' },
  syncing:   { url: syncingUrl,  loop: true,  fb: 'refresh' },
  importing: { url: importingUrl, loop: true, fb: 'import' },
  empty:     { url: emptyUrl,    loop: true,  fb: 'inbox' },
};

/** Render placeholder markup — cheap, sync, SSR-safe. */
export function iconAnim(kind, size = 40, opts = {}) {
  const a = ANIM[kind];
  if (!a) return icon('disc', size, opts);
  const cls = opts.cls ? ` ${opts.cls}` : '';
  return `<span class="zanim${cls}" data-anim="${kind}" data-size="${size}" style="--zanim-sz:${size}px">`
    + `<span class="zanim-fb">${icon(a.fb, Math.max(20, Math.round(size * 0.82)), { weight: 'duotone' })}</span>`
    + `</span>`;
}

let playerPromise = null;
function loadPlayer() {
  if (!playerPromise) playerPromise = import('@lordicon/element');
  return playerPromise;
}
const blobCache = new Map();
async function tintedSrc(url) {
  if (blobCache.has(url)) return blobCache.get(url);
  const acc = (getComputedStyle(document.documentElement).getPropertyValue('--accent') || '#7B6CF6').trim();
  const rgb = /^#?([0-9a-f]{6})$/i.exec(acc);
  const c = rgb
    ? [parseInt(rgb[1].slice(0, 2), 16) / 255, parseInt(rgb[1].slice(2, 4), 16) / 255, parseInt(rgb[1].slice(4, 6), 16) / 255, 1].join(',')
    : '0.48,0.42,0.96,1';
  try {
    const txt = await (await fetch(url)).text();
    const blob = URL.createObjectURL(new Blob([txt.replaceAll('@@AC@@', `[${c}]`)], { type: 'application/json' }));
    blobCache.set(url, blob);
    return blob;
  } catch { return null; }
}

/** Hydrate every .zanim under root (idempotent). */
export async function hydrateIconFX(root = document) {
  const hosts = [...root.querySelectorAll('.zanim:not([data-on])')];
  if (!hosts.length) return;
  let ok = true;
  try { await loadPlayer(); } catch { ok = false; }
  for (const h of hosts) {
    h.dataset.on = '1';
    if (!ok) continue;
    const kind = h.dataset.anim;
    const a = ANIM[kind];
    if (!a) continue;
    const size = +h.dataset.size || 40;
    const src = await tintedSrc(a.url);
    if (!src) continue;
    const el = document.createElement('lord-icon');
    el.setAttribute('src', `lottie:${src}`);
    el.setAttribute('trigger', a.loop ? 'loop-on-infinite' : 'main');
    el.setAttribute('aria-hidden', 'true');
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    el.addEventListener('error', () => el.remove(), { once: true });
    h.appendChild(el);
    h.classList.add('ld-live');
  }
}

/** Auto-hydrate new DOM under #main-content (cheap MutationObserver, rAF-batched). */
let watching = false;
export function watchIconFX() {
  if (watching || typeof MutationObserver === 'undefined') return;
  watching = true;
  let queued = false;
  const flush = () => { queued = false; hydrateIconFX(document); };
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(flush);
  }).observe(document.documentElement, { childList: true, subtree: true });
}
