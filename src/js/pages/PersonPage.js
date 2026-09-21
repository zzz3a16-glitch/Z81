/**
 * PersonPage v4 — cinematic profile (spec 26): identity, bio, known-for,
 * credits grouped in the library card language.
 */
import { getTMDBImageUrl } from '../services/tmdb/TMDBImage.js';
import { createMediaCard } from '../components/MediaCard.js';
import { el, esc, section, fmtDateAr, fallbackArt, errorState } from '../ui/primitives.js';
import { icon } from '../ui/icons.js';
import { tmdbClient as tmdb } from '../services/tmdb/TMDBClient.js';

export async function PersonPage(params = {}) {
  const page = el('div', 'z-person');
  page.innerHTML = `<div class="z-narrow" style="padding:40px var(--page-gutter)"><div class="sk" style="height:120px;border-radius: var(--r-xl)"></div></div>`;
  let person = null;
  try {
    person = await tmdb.getPerson(params.id);
  } catch (e) {
    page.innerHTML = '';
    page.appendChild(errorState({ desc: e.message, onRetry: () => location.reload() }));
    return page;
  }
  let credits = { cast: [], crew: [] };
  try {
    const cc = await tmdb.getPersonCredits(params.id);
    credits = { cast: cc?.cast || [], crew: cc?.crew || [] };
  } catch { /* offline: identity only */ }

  const knownFor = credits.cast.filter((c) => c.profile_path).sort((a, b) => (b.popularity || 0) - (a.popularity || 0)).slice(0, 6);
  const birthday = person.birthday ? fmtDateAr(person.birthday) : '';
  const place = person.place_of_birth || '';

  page.innerHTML = `
    <div class="z-narrow" style="padding-top: var(--sp-8)">
      <div style="display:grid;grid-template-columns:180px minmax(0,1fr);gap: var(--sp-7);align-items:start">
        <div style="border-radius:50% 50% var(--r-xl) var(--r-xl);overflow:hidden;border:1px solid var(--color-border);aspect-ratio:3/4;background:var(--surface-2)">
          ${person.profile_path
            ? `<img src="${getTMDBImageUrl(person.profile_path, 'profile', 'w342')}" alt="" style="width:100%;height:100%;object-fit:cover" fetchpriority="high">`
            : fallbackArt(person.name || '', { big: true })}
        </div>
        <div>
          <div class="u-caps" style="margin-bottom: var(--sp-2)">شخص</div>
          <h1 class="page-title" style="font-size:var(--text-4xl)">${esc(person.name || '')}</h1>
          ${person.also_known_as?.length ? `<div style="color:var(--color-text-muted);font-size: var(--text-sm);margin-top: var(--sp-2)">يُعرف أيضاً: ${esc(person.also_known_as.slice(0, 3).join('، '))}</div>` : ''}
          <div class="z-meta-strip">
            ${person.known_for_department ? `<span class="z-pill z-pill-accent">${esc(person.known_for_department)}</span>` : ''}
            ${birthday ? `<span>${birthday}${place ? ` · ${esc(place)}` : ''}</span>` : ''}
            ${person.birthday && person.deathday ? `<span>توفي: ${fmtDateAr(person.deathday)}</span>` : ''}
          </div>
          ${person.biography ? `
            <p id="person-bio" style="margin-top: var(--sp-4);color:var(--color-text-secondary);font-size:var(--text-base);line-height:1.85;max-width:78ch;
              display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden;cursor:pointer">${esc(person.biography)}</p>` : '<p style="margin-top: var(--sp-4);color:var(--color-text-muted);font-size: var(--text-sm)">لا سيرة متاحة — ستظهر عند توفر اتصال بالشبكة.</p>'}
        </div>
      </div>
    </div>
    <div id="person-sections" style="margin-top: var(--sp-10)"></div>`;

  const bio = page.querySelector('#person-bio');
  if (bio) bio.addEventListener('click', () => {
    const open = bio.style.webkitLineClamp === 'unset';
    bio.style.webkitLineClamp = open ? '4' : 'unset';
  });

  const secs = page.querySelector('#person-sections');
  if (knownFor.length) {
    const s = section({ title: 'أعمال عُرف بها' });
    const g = el('div', 'media-grid');
    knownFor.forEach((c) => g.appendChild(createMediaCard(cardFromCredit(c), { variant: 'wide' })));
    s.body.appendChild(g);
    secs.appendChild(s.root);
  }
  const byDept = {};
  [...credits.cast, ...credits.crew].forEach((c) => {
    const d = c.department || 'أخرى';
    (byDept[d] = byDept[d] || []).push(c);
  });
  Object.entries(byDept)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 4)
    .forEach(([dept, list]) => {
      const rows = list
        .filter((c) => c.title || c.name)
        .sort((a, b) => String(b.release_date || b.first_air_date || '').localeCompare(String(a.release_date || a.first_air_date || '')))
        .slice(0, 14);
      if (!rows.length) return;
      const s = section({ title: dept === 'Actors' ? 'تمثيل' : dept === 'Writing' ? 'تأليف' : dept === 'Directing' ? 'إخراج' : dept === 'Production' ? 'إنتاج' : dept, subtitle: `${list.length} عمل` });
      const g = el('div', 'media-grid');
      rows.forEach((c) => g.appendChild(createMediaCard(cardFromCredit(c), { variant: 'poster' })));
      s.body.appendChild(g);
      secs.appendChild(s.root);
    });
  return page;
}

function cardFromCredit(c) {
  return {
    id: c.id,
    title: c.title || c.name,
    media_type: c.media_type || (c.first_air_date ? 'tv' : 'movie'),
    poster_path: c.poster_path,
    backdrop_path: c.backdrop_path,
    vote_average: c.vote_average,
    year: (c.release_date || c.first_air_date || '').slice(0, 4),
    character: c.character,
    job: c.job,
  };
}
