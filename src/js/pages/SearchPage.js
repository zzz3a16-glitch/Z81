/**
 * SearchPage v4 — instant, grouped, library-first (spec 29).
 * "في مكتبتك" is separated from TMDB discovery so provenance is always clear.
 */
import { tmdbClient } from '../services/tmdb/TMDBClient.js';
import { db } from '../services/storage/Database.js';
import { createMediaCard, createPersonCard } from '../components/MediaCard.js';
import { el, esc, section, emptyState, skelGrid } from '../ui/primitives.js';
import { icon } from '../ui/icons.js';

const RECENT_KEY = 'zpopcorn-recent-searches';
const getRecent = () => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; } };
function pushRecent(q) {
  const list = [q, ...getRecent().filter((x) => x !== q)].slice(0, 8);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list));
}

export async function SearchPage(params = {}, query = {}) {
  const page = el('div', 'z-page-search');
  const q0 = (query.q || '').trim();
  page.innerHTML = `
    <div class="z-narrow" style="padding-top: var(--sp-2)">
      <div class="z-tb-search" style="width:100%;max-width:640px;margin-inline:auto">
        <div class="box" style="height:46px;border-radius:var(--r-lg);background:var(--surface-2);border:1px solid var(--color-border)">
          ${icon('search', 17)}
          <input id="sp-input" type="search" placeholder="ابحث عنواناً، ممثلاً، أو اسمًا بالأصلية..." value="${esc(q0)}" style="font-size: var(--text-base)" />
          <kbd>Enter</kbd>
        </div>
      </div>
      <div id="sp-recent" style="display:flex;gap: var(--sp-2);flex-wrap:wrap;justify-content:center;margin-top: var(--sp-4)"></div>
    </div>
    <div class="container" id="sp-results" style="margin-top: var(--sp-8)"></div>`;

  const input = page.querySelector('#sp-input');
  const results = page.querySelector('#sp-results');
  const recentBox = page.querySelector('#sp-recent');

  const paintRecent = () => {
    const list = getRecent();
    recentBox.innerHTML = list.length
      ? `<button class="btn btn-tertiary btn-sm" id="sp-clearrecent" style="font-size: var(--text-3xs);color:var(--color-text-faint)">${icon('x', 12)} مسح السجل</button>` +
        list.map((x) => `<button class="chip" data-q="${esc(x)}">${icon('history', 13)} ${esc(x)}</button>`).join('')
      : '';
    recentBox.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => run(b.dataset.q)));
    recentBox.querySelector('#sp-clearrecent')?.addEventListener('click', () => { localStorage.removeItem(RECENT_KEY); paintRecent(); });
  };
  paintRecent();

  let timer = null;
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => run(input.value.trim(), true), 260); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(input.value.trim()); });
  input.focus();

  async function run(q, soft = false) {
    q = (q || '').trim();
    if (!q) { results.innerHTML = ''; paintRecent(); return; }
    if (!soft) pushRecent(q);
    results.innerHTML = '';
    const skel = section({ title: 'جارٍ البحث…' });
    skel.body.appendChild(skelGrid(8));
    results.appendChild(skel.root);

    const [libMovies, libTV] = await Promise.all([
      db.getAll('movies', 500).catch(() => []),
      db.getAll('tvshows', 500).catch(() => []),
    ]);
    const low = q.toLowerCase();
    const inLib = [...(libMovies || []), ...(libTV || [])]
      .filter((m) => (m.title || m.name || '').toLowerCase().includes(low)
        || (m.original_title || m.original_name || '').toLowerCase().includes(low)
        || (m.localFileName || '').toLowerCase().includes(low));

    results.innerHTML = '';

    if (inLib.length) {
      const s = section({ title: `${inLib.length} نتيجة في مكتبتك` });
      const grid = el('div', 'media-grid');
      inLib.forEach((m) => grid.appendChild(createMediaCard({ ...m, inLibrary: true, media_type: m.media_type || (m.first_air_date ? 'tv' : 'movie') })));
      s.body.appendChild(grid);
      results.appendChild(s.root);
    }

    try {
      const res = await tmdbClient.searchMulti(q);
      const rows = (res?.results || [])
        .filter((r) => !inLib.some((l) => String(l.id) === String(r.id)))
        .slice(0, 36);
      const works = rows.filter((r) => r.media_type !== 'person');
      const people = rows.filter((r) => r.media_type === 'person' && r.profile_path);

      if (works.length) {
        const s = section({ title: 'من TMDB — للاكتشاف', subtitle: inLib.length ? 'غير موجودة في مكتبتك بعد' : '' });
        const head = s.head;
        head.insertAdjacentHTML('afterbegin', '<em class="z-pill" style="height:18px;font-size: var(--text-3xs);align-self:center">TMDB</em>');
        const grid = el('div', 'media-grid');
        works.forEach((m) => grid.appendChild(createMediaCard(m, { variant: 'poster' })));
        s.body.appendChild(grid);
        results.appendChild(s.root);
      }
      if (people.length) {
        const s = section({ title: 'أشخاص' });
        const row = el('div', '');
        row.style.cssText = 'display:flex;gap: var(--sp-4);flex-wrap:wrap';
        people.slice(0, 12).forEach((p) => row.appendChild(createPersonCard({ ...p, name: p.name })));
        s.body.appendChild(row);
        results.appendChild(s.root);
      }
      if (!works.length && !people.length && !inLib.length) {
        results.appendChild(emptyState({
          iconName: 'search',
          title: `لا نتائج لـ «${q}»`,
          desc: 'جرّب كتابة الاسم الأصلي للعمل، أو تحقق من الاتصال — البحث المحلي يعمل حتى دون إنترنت.',
        }));
      }
    } catch (e) {
      if (inLib.length) {
        const note = el('div', '');
        note.innerHTML = `<div class="z-hbar" style="border-color:color-mix(in srgb, var(--color-warning) 30%, transparent)"><span class="pulse sev-warn" style="color:var(--color-warning)"></span><span style="font-size: var(--text-sm)">TMDB غير متاح الآن — عُرضت نتائج مكتبتك فقط.</span></div>`;
        results.appendChild(note);
      } else {
        results.innerHTML = '';
        results.appendChild(emptyState({ iconName: 'wifiOff', title: 'غير متصل ولا توجد نتائج محلية', desc: 'أضِف أعمالاً إلى مكتبتك ليصبح البحث يعمل دون إنترنت.' }));
      }
    }
    paintRecent();
  }

  if (q0) run(q0, true);
  return page;
}
