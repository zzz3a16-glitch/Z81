/**
 * CompanyPage v4 — editorial studio page (spec 27).
 */
import { el, esc, section, emptyState, errorState } from '../ui/primitives.js';
import { getTMDBImageUrl } from '../services/tmdb/TMDBImage.js';
import { icon } from '../ui/icons.js';
import { tmdbClient } from '../services/tmdb/TMDBClient.js';
import { createMediaCard } from '../components/MediaCard.js';

export async function CompanyPage(params = {}) {
  const page = el('div', 'z-company');
  const head = el('div', 'z-narrow');
  head.style.cssText = 'padding-top: var(--sp-8)';
  page.appendChild(head);
  head.innerHTML = '<div class="sk" style="height:110px;border-radius: var(--r-xl)"></div>';

  let co = null;
  try {
    co = await tmdbClient.request(`company/${params.id}`, {});
  } catch (e) {
    head.innerHTML = '';
    head.appendChild(errorState({ desc: e.message, onRetry: () => location.reload() }));
    return page;
  }
  let works = [];
  try {
    const res = await tmdbClient.request(`company/${params.id}/movies`, {});
    works = res?.results || [];
  } catch { /* offline */ }

  head.innerHTML = `
    <div style="display:flex;gap: var(--sp-5);align-items:center;flex-wrap:wrap">
      ${co.logo_path ? `<div style="width:132px;height:72px;border-radius:var(--r-lg);background:var(--color-white);display:grid;place-items:center;overflow:hidden;flex-shrink:0">
        <img src="${getTMDBImageUrl(co.logo_path, 'poster', 'w500')}" alt="${esc(co.name)}" style="max-width:88%;max-height:80%;object-fit:contain" loading="lazy">
      </div>` : `<div class="z-sb-mark" style="width:52px;height:52px">${icon('layers', 24)}</div>`}
      <div>
        <div class="u-caps">شركة إنتاج</div>
        <h1 class="page-title" style="font-size:var(--text-3xl)">${esc(co.name)}</h1>
        <div class="z-meta-strip">
          ${co.origin_country ? `<span class="z-pill">${esc(co.origin_country)}</span>` : ''}
          ${co.headquarters ? `<span>${esc(co.headquarters)}</span>` : ''}
          ${co.homepage ? `<a class="z-pill z-pill-accent" target="_blank" rel="noopener" href="${esc(/^https?:/.test(co.homepage) ? co.homepage : 'https://' + co.homepage)}">${icon('external', 11)} الموقع الرسمي</a>` : ''}
        </div>
      </div>
    </div>
    ${co.description ? `<p style="margin-top: var(--sp-5);color:var(--color-text-secondary);max-width:82ch;line-height:1.85;font-size:var(--text-base)">${esc(co.description)}</p>` : ''}`;

  const body = el('div', '');
  page.appendChild(body);
  if (works.length) {
    const s = section({ title: 'أعمال الشركة', subtitle: 'من TMDB' });
    const grid = el('div', 'media-grid');
    works.filter((m) => m.poster_path).slice(0, 24).forEach((m) => grid.appendChild(createMediaCard({ ...m, media_type: 'movie' })));
    s.body.appendChild(grid);
    body.appendChild(s.root);
  } else {
    const s = section({ title: 'أعمال الشركة' });
    s.body.appendChild(el('div', '', '')).appendChild(emptyState({ iconName: 'layers', title: 'لا تظهر أعمال الآن', desc: 'غير متصل أو لم تُجلب بعد — جرب التحديث لاحقاً.' }));
    body.appendChild(s.root);
  }
  return page;
}
