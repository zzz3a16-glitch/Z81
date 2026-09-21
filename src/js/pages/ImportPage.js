/**
 * §33 Media Import — the structured TMDB matching + review workflow.
 *
 * Law: never force the user to re-enter what TMDB already knows.
 * 1) paste a filename/path or a title (filenames are parsed locally first);
 * 2) explicit search — no auto-queries while typing;
 * 3) pick the actual work;
 * 4) the editor opens PREFILLED from TMDB (poster, logo, year, genres, seasons,
 *    episodes, cast, networks, studios) — every field stays editable;
 * 5) save writes to the same local stores the library reads (db 'movies'/'tvshows')
 *    and emits zpopcorn:library-changed — zero new data paths.
 */
import { tmdbClient } from '../services/tmdb/TMDBClient.js';
import { db } from '../services/storage/Database.js';
import { fileNameParser } from '../services/scanner/FileNameParser.js';
import { getTMDBImageUrl } from '../services/tmdb/TMDBImage.js';
import { el, esc, emptyState, paintError } from '../ui/primitives.js';
import { icon } from '../ui/icons.js';

const toast = (type, message, desc = '') => window.dispatchEvent(
  new CustomEvent('showtoast', { detail: { type, message: desc ? `${message} — ${desc}` : message } }));

export class ImportPage {
  render() {
    const page = el('div', 'z-import');
    page.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">استيراد وسائط</h1>
        <p class="page-subtitle">الصق مسار ملف أو اسم العمل — نطابقه مع TMDB، ثم راجع كل حقل قبل الحفظ.</p>
      </div>`;
    const body = el('div', 'z-import-body');
    const form = el('form', 'z-import-lookup');
    form.innerHTML = `
      <input id="imp-q" class="input" type="text" autocomplete="off"
        placeholder="مثال: Dune.2021.2160p.mkv أو اسم العمل" aria-label="مسار الملف أو اسم العمل">
      <button class="btn btn-primary" type="submit">${icon('search', 14)} بحث في TMDB</button>`;
    const results = el('div', 'z-import-results');
    const editor = el('div', '');
    body.append(form, results, editor);
    page.appendChild(body);

    const input = form.querySelector('#imp-q');
    let searchSeq = 0;
    let picked = null;          // { media_type, id } currently being edited
    let detail = null;          // full TMDB details for picked

    results.appendChild(emptyState({
      iconName: 'inbox', title: 'ابدأ بمسار أو اسم',
      desc: 'لا نتائج تُحمَّل من تلقاء نفسها — البحث يبدأ عند الضغط فقط.',
    }));

    const showSkeleton = () => {
      results.innerHTML = '';
      results.appendChild(el('div', 'loading-skeleton'));
      results.lastChild.setAttribute('aria-busy', 'true');
      results.lastChild.innerHTML = '<i></i><i style="width:78%"></i><i style="width:56%"></i>';
    };

    const runSearch = async () => {
      let q = input.value.trim();
      if (!q) return;
      // A path/filename gets parsed locally first — year improves match precision.
      let hintYear = '';
      if (/\.[A-Za-z0-9]{2,4}$/.test(q) || /[\\/]/.test(q)) {
        const parsed = fileNameParser.parse(q.split(/[\\/]/).pop()) || {};
        if (parsed.title) { q = parsed.title + (parsed.year ? ` ${parsed.year}` : ''); hintYear = String(parsed.year || ''); }
      }
      const my = ++searchSeq;
      showSkeleton();
      editor.innerHTML = '';
      picked = null;
      try {
        const res = await tmdbClient.request('search/multi', { query: q, include_adult: false, page: 1 });
        if (my !== searchSeq) return;   // a newer search replaced this one
        const items = (res?.results || [])
          .filter((r) => r.media_type === 'movie' || r.media_type === 'tv')
          .slice(0, 20);
        paintResults(items, q, hintYear);
      } catch (e) {
        if (my !== searchSeq) return;
        paintError(results, e, runSearch);
      }
    };
    form.addEventListener('submit', (ev) => { ev.preventDefault(); runSearch(); });

    const paintResults = (items, q, hintYear) => {
      results.innerHTML = '';
      const head = el('p', 'z-imp-note', `نتائج «${esc(q)}»${hintYear ? ` · سنة ${esc(hintYear)}` : ''} — اختر العمل الصحيح:`);
      results.appendChild(head);
      if (!items.length) {
        results.appendChild(emptyState({
          iconName: 'search', title: 'لا مطابقة', desc: 'جرّب اسمًا أقرب أو دقّق السنة.',
        }));
        return;
      }
      items.forEach((it) => {
        const row = el('button', 'z-imp-row');
        row.type = 'button';
        const date = it.release_date || it.first_air_date || '';
        row.innerHTML = `
          ${it.poster_path ? `<img src="${esc(getTMDBImageUrl(it.poster_path, 'poster', 'w92'))}" alt="" loading="lazy">` : `<span style="width:44px;height:66px;border-radius:var(--r-sm);background:var(--surface-3)"></span>`}
          <span style="flex:1"><span class="t">${esc(it.title || it.name || '—')}</span>
            <span class="m">${it.media_type === 'tv' ? 'مسلسل' : 'فيلم'} · ${esc(date.slice(0, 4) || '—')}${it.vote_average ? ` · تقييم ${Number(it.vote_average).toFixed(1)}/10` : ''}</span></span>
          <span style="color:var(--color-text-faint)">${icon('chevL', 15)}</span>`;
        row.addEventListener('click', () => loadDetails(it.media_type, it.id));
        results.appendChild(row);
      });
    };

    const loadDetails = async (type, id) => {
      const my = ++searchSeq;
      showSkeleton();
      try {
        const [d, cr] = await Promise.all([
          tmdbClient.request(`${type}/${id}`),
          tmdbClient.request(`${type}/${id}/credits`).catch(() => null),
        ]);
        if (my !== searchSeq) return;
        picked = { type, id };
        detail = d;
        results.innerHTML = '';
        results.appendChild(el('p', 'z-imp-note', `المُختار: ${esc(d.title || d.name || '')} — عدّل ما يلزم ثم احفظ.`));
        paintEditor(cr);
      } catch (e) {
        if (my !== searchSeq) return;
        paintError(results, e, () => loadDetails(type, id));
      }
    };

    const field = (label, inner) => `<div class="z-imp-f"><label>${label}</label>${inner}</div>`;

    const paintEditor = (credits) => {
      const d = detail;
      const isTv = picked.type === 'tv';
      const dateKey = isTv ? 'first_air_date' : 'release_date';
      const cast = (credits?.cast || []).slice(0, 10)
        .map((c) => `${c.name}${c.character ? ` (${c.character})` : ''}`).join('\n');
      editor.innerHTML = `
        <div class="z-imp-editor">
          <div class="z-imp-preview">
            ${d.poster_path ? `<img src="${esc(getTMDBImageUrl(d.poster_path, 'poster', 'w185'))}" alt="الملصق" style="width:92px;height:138px;object-fit:cover">` : ''}
            ${d.logo_path ? `<img src="${esc(getTMDBImageUrl(d.logo_path, 'logo', 'w300'))}" alt="الشعار" style="height:44px;object-fit:contain;background:var(--surface-2)">` : ''}
            ${d.backdrop_path ? `<img src="${esc(getTMDBImageUrl(d.backdrop_path, 'backdrop', 'w500'))}" alt="الخلفية" style="width:210px;height:118px;object-fit:cover">` : ''}
          </div>
          <div class="z-imp-grid">
            ${field('العنوان', `<input class="input" id="e-title" value="${esc(d.title || d.name || '')}">`)}
            ${field('العنوان الأصلي', `<input class="input" id="e-orig" value="${esc(d.original_title || d.original_name || '')}">`)}
            ${field(isTv ? 'تاريخ العرض الأول' : 'تاريخ الإصدار', `<input class="input" id="e-date" type="date" value="${esc(d[dateKey] || '')}">`)}
            ${field('اللغة الأصلية', `<input class="input" id="e-lang" maxlength="2" value="${esc(d.original_language || '')}">`)}
            ${isTv ? field('المواسم', `<input class="input" id="e-seasons" type="number" min="0" value="${d.number_of_seasons ?? 0}">`) : field('مدة الدقائق', `<input class="input" id="e-runtime" type="number" min="0" value="${d.runtime ?? 0}">`)}
            ${isTv ? field('عدد الحلقات الكلي', `<input class="input" id="e-episodes" type="number" min="0" value="${d.number_of_episodes ?? 0}">`) : ''}
            ${field('مسار/رابط الملف', `<input class="input" id="e-path" value="${esc(input.value.trim())}" dir="ltr">`)}
            ${field('ملصق (path أو رابط)', `<input class="input" id="e-poster" value="${esc(d.poster_path || '')}" dir="ltr">`)}
            ${field('شعار (path أو رابط)', `<input class="input" id="e-logo" value="${esc(d.logo_path || '')}" dir="ltr">`)}
            ${field('شبكات البث', `<input class="input" id="e-networks" value="${esc((d.networks || []).map((n) => n.name).join('، ') || '')}">`)}
            ${field('الاستوديوهات', `<input class="input" id="e-studios" value="${esc((d.production_companies || []).map((n) => n.name).join('، ') || '')}">`)}
          </div>
          <div class="z-imp-f"><label>القصة</label><textarea class="input" id="e-overview" rows="4">${esc(d.overview || '')}</textarea></div>
          <div class="z-imp-f"><label>الأنواع</label><div class="z-imp-cast" id="e-genres">
            ${(d.genres || []).map((g) => `<label class="chip"><input type="checkbox" value="${g.id}" data-name="${esc(g.name)}" checked> ${esc(g.name)}</label>`).join('')}
          </div></div>
          ${isTv && (d.seasons || []).length ? `
          <div class="z-imp-f"><label>المواسم والحلقات</label>
            <div class="z-imp-grid" id="e-seasons-list">
              ${d.seasons.filter((s) => s.season_number > 0).map((s) => field(esc(s.name || `م${s.season_number}`), `<input class="input" type="number" min="0" data-sn="${s.season_number}" value="${s.episode_count ?? 0}" style="max-width:90px">`)).join('')}
            </div></div>` : ''}
          <div class="z-imp-f"><label>الطاقم (سطر لكل عنصر — عدّل كما تشاء)</label><textarea class="input" id="e-cast" rows="4">${esc(cast)}</textarea></div>
          <div class="z-imp-actions">
            <button class="btn btn-ghost" id="e-cancel" type="button">إلغاء</button>
            <button class="btn btn-secondary" id="e-open" type="button">${icon('film', 14)} فتح صفحة العمل</button>
            <button class="btn btn-primary" id="e-save" type="button">${icon('download', 14)} حفظ في المكتبة</button>
          </div>
        </div>`;

      editor.querySelector('#e-cancel').addEventListener('click', () => { editor.innerHTML = ''; });
      editor.querySelector('#e-open').addEventListener('click', () => window.router.navigate(`/${picked.type}/${picked.id}`));
      editor.querySelector('#e-save').addEventListener('click', save);
    };

    const save = async () => {
      if (!picked || !detail) return;
      const g = (sel) => editor.querySelector(sel);
      const isTv = picked.type === 'tv';
      const genres = [...editor.querySelectorAll('#e-genres input:checked')].map((c) => ({ id: +c.value, name: c.dataset.name }));
      const list = (v) => v.split(/[،,]\s*/).map((s) => ({ name: s.trim() })).filter((x) => x.name);
      const castLines = g('#e-cast').value.split('\n').map((s) => s.trim()).filter(Boolean);
      const seasonEdits = [...editor.querySelectorAll('#e-seasons-list input[data-sn]')]
        .map((i) => ({ season_number: +i.dataset.sn, episode_count: +i.value || 0 }));
      const d = detail;
      const obj = {
        ...d,
        title: isTv ? undefined : g('#e-title').value.trim(),
        name: isTv ? g('#e-title').value.trim() : undefined,
        original_title: isTv ? undefined : g('#e-orig').value.trim(),
        original_name: isTv ? g('#e-orig').value.trim() : undefined,
        overview: g('#e-overview').value.trim(),
        genres, genre_ids: genres.map((x) => x.id),
        original_language: g('#e-lang').value.trim().toLowerCase() || d.original_language,
        poster_path: g('#e-poster').value.trim(),
        logo_path: g('#e-logo').value.trim(),
        source_path: g('#e-path').value.trim(),
        cast: castLines,
        networks: isTv ? list(g('#e-networks').value) : d.networks,
        production_companies: list(g('#e-studios').value),
        imported: true, addedAt: Date.now(), media_type: picked.type,
      };
      if (isTv) {
        obj.first_air_date = g('#e-date').value || d.first_air_date;
        obj.number_of_seasons = +g('#e-seasons').value || d.number_of_seasons;
        obj.number_of_episodes = +g('#e-episodes').value || d.number_of_episodes;
        if (seasonEdits.length) obj.seasons = (d.seasons || []).map((s) => ({ ...s, episode_count: seasonEdits.find((e) => e.season_number === s.season_number)?.episode_count ?? s.episode_count }));
      } else {
        obj.release_date = g('#e-date').value || d.release_date;
        obj.runtime = +g('#e-runtime').value || d.runtime;
      }
      try {
        await db.put(isTv ? 'tvshows' : 'movies', obj);
        window.dispatchEvent(new CustomEvent('zpopcorn:library-changed'));
        toast('success', 'أُضيف إلى المكتبة', obj.title || obj.name || '');
        editor.innerHTML = '';
        results.innerHTML = '';
        results.appendChild(emptyState({ iconName: 'check', title: 'حُفظ في مكتبتك', desc: 'متاح الآن في المكتبة وصفحة الترشيحات.' }));
      } catch (e) {
        toast('error', 'تعذّر الحفظ', e?.message || 'خطأ غير معروف');
      }
    };

    return page;
  }
}
