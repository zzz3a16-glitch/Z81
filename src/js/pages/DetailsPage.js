/**
 * DetailsPage v4 — designed, not dumped (spec 23–25).
 * One system for movie & TV: cinematic backdrop → identity strip → actions →
 * editorial sections. TV gets a real season flow with premium episode rows.
 */
import { tmdbClient } from '../services/tmdb/TMDBClient.js';
import { getTMDBImageUrl } from '../services/tmdb/TMDBImage.js';
import { getMediaTitle, getMediaYear, formatRuntime } from '../utils/helpers.js';
import { createMediaCard, createEpisodeRow, createPersonCard } from '../components/MediaCard.js';
import { watchlistManager } from '../services/watchlist/WatchlistManager.js';
import { ratingManager } from '../services/rating/RatingManager.js';
import { behaviorEngine, BEHAVIOR_EVENTS } from '../services/behavior/UserBehaviorEngine.js';
import { db } from '../services/storage/Database.js';
import { notificationService } from '../services/notification/NotificationService.js';
import { isDesktop, api } from '../bridge.js';
import {
  el, esc, section, railEl, skelHero, skelLines, skelRows, skelGrid,
  fmtDateAr, fallbackArt, ratingBadge, statPill,
} from '../ui/primitives.js';
import { icon } from '../ui/icons.js';

const toast = (message, type = 'success') => notificationService.showToast({ message, type, duration: 2600 });

export async function MovieDetailsPage(params) { return DetailsPage(params, 'movie'); }
export async function TVDetailsPage(params) { return DetailsPage(params, 'tv'); }

export async function DetailsPage(params, mediaType = 'movie') {
  const id = params.id;
  const page = el('div', 'z-detail');
  page.appendChild(skelHero());
  const sk = el('div', '');
  sk.style.cssText = 'padding: var(--sp-7) var(--sp-2)';
  sk.appendChild(skelLines(4));
  page.appendChild(sk);

  let media = null;
  try {
    media = mediaType === 'tv' ? await tmdbClient.getTV(id) : await tmdbClient.getMovie(id);
  } catch (e) {
    page.innerHTML = '';
    page.appendChild(el('div', '', `<div class="z-state err" style="padding: var(--sp-20) 0"><div class="art">${icon('alert', 28)}</div><h3>تعذّر تحميل بطاقة العمل</h3><p>${esc(e?.message || 'قد يكون الجهاز غير متصل — جرّب من مكتبتك إن كان العمل مضافاً.')}</p><div class="acts"><button class="btn btn-secondary btn-sm" id="retry-d">${icon('refresh', 14)} إعادة المحاولة</button><button class="btn btn-ghost btn-sm" id="back-d">رجوع</button></div></div>`));
    page.querySelector('#retry-d').addEventListener('click', () => window.location.reload());
    page.querySelector('#back-d').addEventListener('click', () => window.router.goBack());
    return page;
  }
  if (!media || media.not_found) {
    page.innerHTML = '';
    page.appendChild(el('div', '', `<div class="z-state"><h3>غير موجود</h3><p>لم نجد عملاً بالمعرّف ${esc(String(id))}.</p></div>`));
    return page;
  }

  behaviorEngine.track(BEHAVIOR_EVENTS.OPENED, { mediaId: id, mediaType, title: getMediaTitle(media) });

  // library linkage (desktop truth, browser mirror)
  let libRec = null, localFiles = [];
  try { libRec = await db.get(mediaType === 'tv' ? 'tvshows' : 'movies', String(id)); } catch { /* */ }
  if (isDesktop && !libRec) { try { libRec = await api.library.get(mediaType === 'tv' ? 'tvshows' : 'movies', String(id)); } catch { /* */ } }
  try { localFiles = libRec?.localFiles || []; if (isDesktop) localFiles = await api.library.listMediaFiles(mediaType === 'tv' ? 'tvshows' : 'movies', String(id)) || []; } catch { /* */ }
  const inLibrary = !!libRec;

  page.innerHTML = '';
  const title = getMediaTitle(media);
  const originalTitle = media.original_title || media.original_name;
  const year = getMediaYear(media);
  const rating = Number(media.vote_average) || 0;
  const overview = media.overview || 'لا يوجد وصف متاح لهذا العمل.';
  const backdrop = media.backdrop_path ? getTMDBImageUrl(media.backdrop_path, 'backdrop', 'w1280') : null;
  const poster = media.poster_path ? getTMDBImageUrl(media.poster_path, 'poster', 'w500') : null;
  const runtime = media.runtime || media.episode_run_time?.[0] || null;
  const userRating = await ratingManager.getRating(id).catch(() => null);

  /* ---- backdrop + identity ---- */
  page.insertAdjacentHTML('beforeend', `
    <div class="backdrop">
      ${backdrop ? `<img src="${backdrop}" alt="" fetchpriority="high">` : fallbackArt(title, { big: true })}
    </div>
    <div class="head">
      <div class="poster-fr">${poster ? `<img src="${poster}" alt="${esc(title)}" fetchpriority="high">` : fallbackArt(title, { big: true })}</div>
      <div class="identity">
        <div style="display:flex;gap: var(--sp-2);align-items:center;margin-bottom: var(--sp-3)">
          ${inLibrary ? `<span class="z-pill z-pill-accent">${icon('database', 12)} في مكتبتك${localFiles.length ? ` · ${localFiles.length} ملف` : ''}</span>` : ''}
          <span class="z-pill">${mediaType === 'tv' ? 'مسلسل' : 'فيلم'}</span>
          ${media.status && media.status !== 'Released' ? `<span class="z-pill">${esc(media.status)}</span>` : ''}
        </div>
        ${media.images?.logos?.length ? `<img class="z-dlogo" src="${esc(getTMDBImageUrl(media.images.logos.slice().sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0))[0].file_path, 'logo', 'w300'))}" alt="${esc(title)}">` : ''}
        <h1>${esc(title)}</h1>
        ${originalTitle && originalTitle !== title ? `<div class="orig">${esc(originalTitle)}</div>` : ''}
        <div class="z-meta-strip">
          ${year ? `<span class="num">${year}</span>` : ''}
          ${runtime ? `· <span class="num">${formatRuntime(runtime)}</span>` : ''}
          ${mediaType === 'tv' && media.number_of_seasons ? `· <span class="num">${media.number_of_seasons} موسم</span>` : ''}
          ${mediaType === 'tv' && media.number_of_episodes ? `· <span class="num">${media.number_of_episodes} حلقة</span>` : ''}
          ${ratingBadge(rating, { ring: true })}
          ${media.release_date || media.first_air_date ? `· <span>${fmtDateAr(media.release_date || media.first_air_date)}</span>` : ''}
        </div>
        <div class="z-actions" id="d-actions">
          <button class="btn btn-primary" data-a="play">${icon('play', 15, { weight: 'bold' })} ${localFiles.length ? 'تشغيل الملف المحلي' : 'مشاهدة'}</button>
          <button class="btn btn-secondary" data-a="fav">${icon('heart', 15)} <span>المفضلة</span></button>
          <button class="btn btn-secondary" data-a="later">${icon('bookmark', 15)} <span>لاحقاً</span></button>
          ${!inLibrary ? `<button class="btn btn-secondary" data-a="addlib">${icon('database', 15)} <span>إضافة للمكتبة</span></button>` : ''}
          ${isDesktop && localFiles[0] ? `<button class="btn btn-ghost" data-a="locate" title="موقع الملف">${icon('folderOpen', 15)}</button>` : ''}
          <button class="btn btn-ghost" data-a="share" title="مشاركة">${icon('share', 15)}</button>
        </div>
        <p style="margin-top: var(--sp-5)" class="z-overview">${esc(overview)}</p>
        ${(media.genres || []).length ? `<div class="z-genres" style="margin-top: var(--sp-4)">${media.genres.map((g) => `<button class="chip" data-genre="${g.id}">${esc(g.name)}</button>`).join('')}</div>` : ''}
      </div>
    </div>`);

  const act = page.querySelector('#d-actions');
  act.querySelectorAll('[data-a]').forEach((b) => b.addEventListener('click', async () => {
    const a = b.dataset.a;
    if (a === 'play') { window.dispatchEvent(new CustomEvent('playmedia', { detail: { ...media, media_type: mediaType, localFiles: localFiles.map((f) => f.path || f) } })); return; }
    if (a === 'locate') { try { await api.system.showItemInFolder(localFiles[0].path || localFiles[0]); } catch (e) { toast(e.message || 'تعذّر الفتح', 'error'); } return; }
    if (a === 'share') {
      try { await navigator.clipboard.writeText(`https://www.themoviedb.org/${mediaType}/${id}`); toast('نُسخ رابط TMDB'); } catch { /* */ }
      return;
    }
    if (a === 'addlib') {
      try {
        const doc = { ...media, media_type: mediaType, key: String(id), id, inLibrary: true, addedAt: Date.now(), updatedAt: Date.now() };
        if (isDesktop) await api.library.upsert({ type: mediaType === 'tv' ? 'tvshows' : 'movies', data: doc });
        else await db.put(mediaType === 'tv' ? 'tvshows' : 'movies', doc);
        window.dispatchEvent(new CustomEvent('zpopcorn:library-changed'));
        toast('أُضيف إلى المكتبة — اربط ملفاته من صندوق الوارد عند توفرها');
        b.outerHTML = `<span class="z-pill z-pill-ok">${icon('check', 12)} في مكتبتك</span>`;
      } catch (e) { toast(e.message, 'error'); }
      return;
    }
    const listId = a === 'fav' ? 'favorites' : 'watch-later';
    try {
      const isIn = await watchlistManager.isInList(listId, id);
      if (isIn) { await watchlistManager.removeFromList(listId, id); toast('أُزيل من القائمة', 'info'); }
      else { await watchlistManager.addToList(listId, { ...media, media_type: mediaType }); toast(a === 'fav' ? 'أُضيف إلى المفضلة' : 'أُضيف إلى المشاهدة لاحقاً'); }
      window.dispatchEvent(new CustomEvent('watchlistupdate'));
    } catch (e) { toast(e.message, 'error'); }
  }));
  page.querySelectorAll('[data-genre]').forEach((b) => b.addEventListener('click', () => window.router.navigate(mediaType === 'tv' ? '/tv' : '/movies', {}, { query: { genre: b.dataset.genre } })));

  /* ---- personal rating strip ---- */
  const rateSec = section({ title: 'تقييمك', subtitle: 'محلي — لا يغادر جهازك' });
  {
    const wrapEl = el('div', '');
    wrapEl.style.cssText = 'display:flex;align-items:center;gap: var(--sp-3);flex-wrap:wrap;padding-inline:var(--page-gutter)';
    wrapEl.innerHTML = Array.from({ length: 10 }, (_, i) => {
      const n = i + 1;
      const on = userRating && n <= Math.round(userRating.personalRating / 2);
      return `<button data-r="${n}" title="${n}/10" class="z-iconbtn" style="width:30px;height:30px;border:1px solid ${on ? 'var(--accent-line)' : 'transparent'};border-radius: var(--r-md);color:${on ? 'var(--accent-bright)' : 'var(--color-text-faint)'}">${n}</button>`;
    }).join('');
    rateSec.body.appendChild(wrapEl);
    wrapEl.querySelectorAll('[data-r]').forEach((b) => b.addEventListener('click', async () => {
      try {
        await ratingManager.setRating(id, Number(b.dataset.r) * 2, mediaType, title);
        window.dispatchEvent(new CustomEvent('rating-updated', { detail: { id } }));
        toast('سُجّل تقييمك — يُغذّي ملف ذوقك');
        rateSec.root.querySelector('.s') && (rateSec.root.querySelector('.s').textContent = 'شكراً — حُدّث');
      } catch (e) { toast(e.message, 'error'); }
    }));
    page.appendChild(rateSec.root);
  }

  /* ---- facts grid ---- */
  const facts = [
    ['الحالة', media.status], ['تاريخ الإصدار', media.release_date || media.first_air_date],
    ['اللغة الأصلية', media.original_language?.toUpperCase()],
    ['الميزانية', media.budget ? `$${(media.budget / 1e6).toFixed(1)}M` : null],
    ['الإيرادات', media.revenue ? `$${(media.revenue / 1e6).toFixed(1)}M` : null],
    ['الشبكات', media.networks?.map((n) => n.name).join('، ')],
    ['الشركات المنتجة', (media.production_companies || []).map((c) => c.name).slice(0, 3).join('، ')],
    mediaType === 'tv' ? ['مواعيد البث', media.episode_run_time?.[0] ? `${media.episode_run_time[0]} دقيقة/حلقة` : null] : null,
  ].filter(Boolean).filter(([, v]) => v);
  if (facts.length) {
    const fs = section({ title: 'بيانات العمل', subtitle: 'حقول TMDB الوصفية — بقية التفاصيل في بطاقة المكتبة' });
    const g = el('div', 'z-facts');
    g.style.cssText = 'padding-inline:var(--page-gutter)';
    g.innerHTML = facts.map(([k, v]) => `<div class="z-fact"><span class="k">${esc(k)}</span><span class="v"${/[A-Za-z0-9$.\-:\/]/.test(String(v)) && !/[\u0600-\u06FF]/.test(String(v)) ? ' dir="ltr"' : ''}>${esc(v)}</span></div>`).join('');
    fs.body.appendChild(g);
    page.appendChild(fs.root);
  }

  /* ---- TV: seasons + premium episodes ---- */
  if (mediaType === 'tv' && (media.seasons || []).length) {
    const valid = media.seasons.filter((s) => s.season_number > 0);
    const ss = section({ title: 'المواسم والحلقات', subtitle: 'اختر موسماً لعرض حلقاته' });
    const holder = el('div', '');
    holder.style.cssText = 'padding-inline:var(--page-gutter);display:flex;flex-direction:column;gap: var(--sp-3)';
    ss.body.appendChild(holder);
    page.appendChild(ss.root);

    const sel = el('div', 'z-seasonsel');
    sel.innerHTML = `
      <select class="input" id="season-sel" aria-label="اختيار الموسم" style="width:auto;min-width:170px">
        ${valid.map((s) => `<option value="${s.season_number}">الموسم ${s.season_number}${s.episode_count ? ` · ${s.episode_count} حلقة` : ''}</option>`).join('')}
      </select>
      <span style="font-size: var(--text-2xs);color:var(--color-text-muted)" id="season-year"></span>`;
    holder.appendChild(sel);
    const list = el('div', '');
    holder.appendChild(list);

    const loadSeason = async (n) => {
      list.innerHTML = '';
      list.appendChild(skelRows(5));
      try {
        const season = await tmdbClient.getTVSeason(id, n);
        holder.querySelector('#season-year').textContent = season.air_date ? `بداية البث: ${fmtDateAr(season.air_date)}` : '';
        if (season.overview) {
          const o = el('p', 'z-overview');
          o.style.cssText = 'font-size: var(--text-sm);margin-bottom: var(--sp-2);color:var(--color-text-muted);max-width:70ch';
          o.textContent = season.overview;
          o.dataset.seasonOver = '1';
          holder.querySelectorAll('[data-season-over]').forEach((x) => x.remove());
          list.before(o);
        }
        // progress from local history
        let progRows = [];
        try { progRows = await db.getByIndex('watchProgress', 'mediaId', `tv${id}s${n}`) || []; } catch { /* */ }
        list.innerHTML = '';
        (season.episodes || []).forEach((ep) => {
          const pr = progRows.find((p) => p.episode === ep.episode_number);
          list.appendChild(createEpisodeRow({ ...ep, progress: pr?.percentage || ep.__progress || 0 }, {
            season: n,
            onOpen: (e2) => window.dispatchEvent(new CustomEvent('playmedia', {
              detail: { id: `${id}s${n}e${e2.episode_number}`, title: `${title} — ${e2.name || 'الحلقة ' + e2.episode_number}`, media_type: 'tv', season: n, episode: e2.episode_number, parent: media },
            })),
          }));
        });
        if (!season.episodes?.length) list.appendChild(el('div', 'z-state', '<p style="font-size: var(--text-sm)">لا حلقات موسومة لهذا الموسم بعد في TMDB.</p>'));
      } catch (e) {
        list.innerHTML = '';
        list.appendChild(el('div', '', `<div class="z-hbar" style="border-color:var(--color-border)"><span class="pulse sev-warn" style="color:var(--color-warning)"></span><span style="font-size: var(--text-sm)">تعذّر جلب الموسم الآن (غير متصل؟) — الأوصاف المحفوظة تظل متاحة.</span></div>`));
      }
    };
    sel.querySelector('#season-sel').addEventListener('change', (e) => loadSeason(e.target.value));
    loadSeason(valid[0]?.season_number || 1);
  }

  /* ---- cast ---- */
  const cast = (media.credits?.cast || []).slice(0, 14);
  if (cast.length) {
    const cs = section({ title: 'الطاقم الرئيسي', wide: true });
    const cards = cast.map((p) => createPersonCard(p));
    const { wrap } = railEl(cards, { snapCards: '104px' });
    cs.body.appendChild(wrap);
    page.appendChild(cs.root);
    const crew = (media.credits?.crew || []).slice(0, 4);
    if (crew.length) {
      const strip = el('div', 'z-facts');
      strip.style.cssText = 'padding:10px var(--page-gutter) 0';
      strip.innerHTML = crew.map((c) => `<div class="z-fact"><span class="k">${esc(c.job)}</span><span class="v">${esc(c.name)}</span></div>`).join('');
      cs.body.appendChild(strip);
    }
  }

  /* ---- videos ---- */
  const vids = (media.videos?.results || []).filter((v) => v.site === 'YouTube').slice(0, 4);
  if (vids.length) {
    const vs = section({ title: 'مقاطع', subtitle: 'تُفتح خارج التطبيق — لا مشغّل مضمّن' , wide: true});
    const { wrap } = railEl(vids.map((v) => {
      const c = el('article', 'zcard wide');
      c.innerHTML = `<div class="thumb" style="aspect-ratio:16/9;display:grid;place-items:center;background:linear-gradient(140deg, var(--surface-3), var(--surface-2))">
        <span class="fallback" style="position:static">${icon('playCircle', 26)}</span>
        <span class="tag">${esc(v.type || 'فيديو')}</span></div>
      <div class="meta"><span class="name">${esc(v.name)}</span><span class="sub">يُفتح في المتصفح</span></div>`;
      c.addEventListener('click', () => {
        const url = `https://www.youtube.com/watch?v=${v.key}`;
        if (isDesktop) api.system.openExternal(url).catch(() => window.open(url, '_blank', 'noopener'));
        else window.open(url, '_blank', 'noopener');
      });
      return c;
    }), { snapCards: 'clamp(260px,24vw,320px)' });
    vs.body.appendChild(wrap);
    page.appendChild(vs.root);
  }

  /* ---- recommendations / similar ---- */
  for (const [key, list] of [['توصيات لمن شاهد هذا', media.recommendations?.results || []], ['أعمال مشابهة', media.similar?.results || []]]) {
    const rows = list.filter((m) => m.poster_path).slice(0, 14);
    if (!rows.length) continue;
    const s2 = section({ title: key, wide: true });
    const { wrap } = railEl(rows.map((m) => createMediaCard({ ...m, media_type: m.media_type || mediaType }, { variant: 'poster' })));
    s2.body.appendChild(wrap);
    page.appendChild(s2.root);
  }

  /* ---- local files (desktop) ---- */
  if (localFiles.length) {
    const ls = section({ title: 'ملفاتك المرتبطة', subtitle: 'تبقى في مكانها — zPopcorn يشير إليها فقط' });
    const box = el('div', '');
    box.style.cssText = 'display:flex;flex-direction:column;gap: var(--sp-2);padding-inline:var(--page-gutter)';
    localFiles.forEach((f) => {
      const r = el('div', 'z-ep');
      r.style.gridTemplateColumns = 'auto 1fr auto';
      r.innerHTML = `
        <span class="z-pill">${icon('disc', 13)}</span>
        <span dir="ltr" class="u-ltr" style="font-size: var(--text-xs);color:var(--color-text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(f.path || f)}</span>
        <span class="etail" style="display:flex;gap: var(--sp-2)">${f.quality ? `<span class="z-pill">${esc(f.quality)}</span>` : ''}${isDesktop ? `<button class="btn btn-ghost btn-sm" data-loc>${icon('folderOpen', 13)} افتح الموقع</button>` : ''}</span>`;
      r.querySelector('[data-loc]')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        try { await api.system.showItemInFolder(f.path || f); } catch (err) { toast(err.message, 'error'); }
      });
      box.appendChild(r);
    });
    ls.body.appendChild(box);
    page.appendChild(ls.root);
  }

  return page;
}
