/**
 * MediaCard v4 — ONE card language for the whole app (spec 13–16).
 * Variants share typography, radius, hover, actions and image treatment:
 *   poster | wide (16:9 editorial) | continue | row | compact | person
 */
import { getTMDBImageUrl } from '../services/tmdb/TMDBImage.js';
import { getMediaTitle, getMediaYear, truncate } from '../utils/helpers.js';
import { watchlistManager } from '../services/watchlist/WatchlistManager.js';
import { behaviorEngine, BEHAVIOR_EVENTS } from '../services/behavior/UserBehaviorEngine.js';
import { notificationService } from '../services/notification/NotificationService.js';
import { isDesktop, api } from '../bridge.js';
import { icon, iconHuge } from '../ui/icons.js';
import { esc, ratingBadge, fallbackArt, fmtRuntime, emptyState } from '../ui/primitives.js';

export function cardThumb(media, variant) {
  const wantBackdrop = variant !== 'poster' && variant !== 'compact';
  const path = wantBackdrop
    ? (media.backdrop_path || media.still_path || media.poster_path || media.profile_path)
    : (media.poster_path || media.profile_path || media.backdrop_path);
  const name = getMediaTitle(media) || '';
  if (!path) return fallbackArt(name, { big: variant !== 'compact' });
  const size = variant === 'compact' ? 'w154' : wantBackdrop ? 'w780' : 'w342';
  return `<img src="${esc(getTMDBImageUrl(path, wantBackdrop ? 'backdrop' : 'poster', size))}" alt=""
    loading="lazy" decoding="async"
    onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'fallback'}))">`;
}

export function createMediaCard(media, options = {}) {
  const {
    variant = 'poster', showActions = true, showProgress = true, showYear = true,
    onClick = null, card = null,
  } = options;

  const title = getMediaTitle(media);
  const year = getMediaYear(media);
  const mediaType = media.media_type || media.type || (media.first_air_date || media.season_number != null ? 'tv' : 'movie');
  const root = card || document.createElement('article');
  root.className = `zcard ${variant}`;
  root.tabIndex = 0;
  root.setAttribute('role', 'link');
  root.setAttribute('aria-label', title || 'وسائط');
  root.dataset.zctx = 'media';
  root.__media = media;

  const rating = Number(media.vote_average) || 0;
  const progress = Number(media.progress || 0); // 0..100 resume position when known
  const inLibrary = media.inLibrary || media.localFiles?.length > 0;

  const tagHtml = variant === 'poster'
    ? `${mediaType === 'tv' ? '<span class="tag">TV</span>' : mediaType === 'person' ? '' : ''}${inLibrary ? '<span class="tag lib">في المكتبة</span>' : ''}`
    : (inLibrary ? '<span class="tag lib">مكتبتك</span>' : '');

  root.innerHTML = `
    <div class="thumb">
      ${cardThumb(media, variant)}
      ${tagHtml}
      ${variant === 'continue' ? `
        <div class="resume"><span class="pp">${iconHuge('play', 18)}</span></div>
        ${media.timeLeft ? `<span class="timeleft">${esc(typeof media.timeLeft === 'number' ? fmtRuntime(media.timeLeft) : media.timeLeft)} متبقية</span>` : ''}
        ${showProgress && progress ? `<span class="prog"><i style="width:${Math.min(100, progress)}%"></i></span>` : ''}
      ` : ''}
      ${showActions && variant !== 'row' ? `
        <div class="acts">
          <button data-act="favorite" title="المفضلة" aria-label="إضافة إلى المفضلة">${icon(media.__isFav ? 'heartFill' : 'heart', 14)}</button>
          <button data-act="watchlist" title="المشاهدة لاحقاً" aria-label="إضافة إلى المشاهدة لاحقاً">${icon(media.__inList ? 'bookmarkFill' : 'bookmark', 14)}</button>
          ${variant === 'continue' ? `<button data-act="play" title="متابعة" aria-label="متابعة المشاهدة">${icon('play', 14)}</button>` : ''}
        </div>` : ''}
    </div>
    ${variant === 'wide' ? `
      <div class="ovl" style="position:relative;background:linear-gradient(180deg, transparent, rgba(8,8,10,.2));padding: var(--sp-3) var(--sp-3) var(--sp-2);">
        <span class="name">${esc(truncate(title, 46))}</span>
        <span class="sub">${year && showYear ? `<span class="num">${year}</span>` : ''} ${rating ? ratingBadge(rating) : ''} ${media.episodeCount ? `<span>${media.episodeCount} حلقة</span>` : ''}</span>
      </div>` : `
      <div class="meta">
        <span class="name" title="${esc(title)}">${esc(variant === 'row' ? title : truncate(title, 44))}</span>
        <span class="sub">
          ${year && showYear ? `<span class="num">${year}</span>` : ''}
          ${year && (rating || media.runtime) ? '<span class="dot"></span>' : ''}
          ${rating ? ratingBadge(rating) : ''}
          ${media.runtime ? `<span class="num">${fmtRuntime(media.runtime)}</span>` : ''}
          ${media.season != null && media.episode != null ? `<span class="num">S${String(media.season).padStart(2, '0')}E${String(media.episode).padStart(2, '0')}</span>` : ''}
          ${media.quality ? `<span>${esc(media.quality)}</span>` : ''}
        </span>
      </div>`}
    ${media.matchPercentage ? `<span class="prog" title="نسبة المطابقة"><i style="width:${media.matchPercentage}%"></i></span>` : ''}
    ${showProgress && progress && variant !== 'continue' ? `<span class="prog" title="شاهدت ${progress}%"><i style="width:${Math.min(100, progress)}%"></i></span>` : ''}
  `;

  root.addEventListener('click', (e) => {
    const actBtn = e.target.closest('[data-act]');
    if (actBtn) { e.stopPropagation(); handleCardAction(actBtn.dataset.act, media, root); return; }
    if (onClick) return onClick(media);
    behaviorEngine.track(BEHAVIOR_EVENTS.OPENED, { mediaId: media.id, mediaType, title });
    navigateTo(media, mediaType);
  });
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') root.click();
  });
  if (mediaType && (media.id != null)) primeFavoriteState(media, root);
  return root;
}

export function navigateTo(media, mediaType) {
  const t = mediaType || media.media_type || (media.first_air_date ? 'tv' : 'movie');
  if (t === 'person') window.router?.navigate(`/person/${media.id}`);
  else if (t === 'tv') window.router?.navigate(`/tv/${media.id}`);
  else window.router?.navigate(`/movie/${media.id}`);
}

async function primeFavoriteState(media, root) {
  if (media.id == null || root.__primed) return;
  root.__primed = true;
  try {
    const [fav, later] = await Promise.all([
      watchlistManager.isInList('favorites', media.id).catch(() => false),
      watchlistManager.isInList('watch-later', media.id).catch(() => false),
    ]);
    const fb = root.querySelector('[data-act="favorite"]');
    const wb = root.querySelector('[data-act="watchlist"]');
    if (fb && fav) { fb.classList.add('on'); fb.innerHTML = icon('heartFill', 14); }
    if (wb && later) { wb.classList.add('on'); wb.innerHTML = icon('bookmarkFill', 14); }
  } catch { /* offline lists unavailable */ }
}

export async function handleCardAction(action, media, root) {
  const id = media.id;
  const title = getMediaTitle(media);
  const toast = (message, type = 'success') => notificationService.showToast({ message, type, title: '', duration: 2600 });
  try {
    if (action === 'favorite' || action === 'watchlist') {
      const listId = action === 'favorite' ? 'favorites' : 'watch-later';
      const inList = await watchlistManager.isInList(listId, id);
      if (inList) {
        await watchlistManager.removeFromList(listId, id);
        toast('أُزيل من قائمتك', 'info');
      } else {
        await watchlistManager.addToList(listId, { ...media, media_type: media.media_type || 'movie' });
        toast(action === 'favorite' ? 'أُضيف إلى المفضلة' : 'أُضيف إلى «المشاهدة لاحقاً»');
      }
      root.__primed = false;
      primeFavoriteState(media, root);
    } else if (action === 'play') {
      window.dispatchEvent(new CustomEvent('playmedia', { detail: media }));
    }
  } catch (e) { toast(e.message || 'تعذّر تنفيذ الإجراء', 'error'); }
}

/* ---------- collection helpers used everywhere ---------- */
export function createMediaGrid(medias, container, options = {}) {
  if (!container) return;
  container.innerHTML = '';
  const list = (medias || []).filter(Boolean);
  if (!list.length) {
    const st = document.createElement('div');
    st.style.gridColumn = '1 / -1';
    st.appendChild(emptyState({ iconName: options.emptyIcon || 'inbox', title: options.emptyTitle || 'لا يوجد محتوى هنا بعد', desc: options.emptyDesc || '' }));
    container.appendChild(st);
    return;
  }
  list.forEach((m) => container.appendChild(createMediaCard(m, options)));
}

export function createSkeletonGrid(container, count = 12) {
  if (!container) return;
  container.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const s = document.createElement('div');
    s.className = 'sk sk-card';
    container.appendChild(s);
  }
}

/** legacy-compatible rail builder (returns a full .z-section) */
export function createRail(medias, options = {}) {
  const { title, subtitle, onViewAll = null, variant = 'poster' } = options;
  return Promise.resolve().then(async () => {
    const { section, railEl } = await import('../ui/primitives.js');
    const s = section({ title, subtitle, wide: true, action: onViewAll ? { label: 'عرض الكل' } : null });
    if (onViewAll) s.head.querySelector('.more')?.addEventListener('click', onViewAll);
    const cards = (medias || []).filter(Boolean).map((m) => createMediaCard(m, { ...options, variant }));
    const { wrap } = railEl(cards);
    s.body.appendChild(wrap);
    return s.root;
  });
}

/* ---------- person chip (cast) ---------- */
export function createPersonCard(person) {
  const n = document.createElement('div');
  n.className = 'z-personchip';
  n.setAttribute('role', 'link');
  n.tabIndex = 0;
  const img = person.profile_path
    ? `<img src="${esc(getTMDBImageUrl(person.profile_path, 'profile', 'w185'))}" alt="" loading="lazy">`
    : fallbackArt(person.name || '');
  n.innerHTML = `
    <div class="av" style="position:relative">${img}</div>
    <b>${esc(person.name || '')}</b>
    <span>${esc(person.character || person.job || '')}</span>`;
  const go = () => window.router?.navigate(`/person/${person.id}`);
  n.addEventListener('click', go);
  n.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  return n;
}

/* ---------- premium horizontal episode row (spec 25) ---------- */
export function createEpisodeRow(ep, { onOpen = null, season = null, showProgress = true } = {}) {
  const root = document.createElement('div');
  root.className = 'z-ep';
  root.tabIndex = 0;
  const img = ep.still_path
    ? `<img src="${esc(getTMDBImageUrl(ep.still_path, 'still', 'w300'))}" alt="" loading="lazy">`
    : `<div class="fallback">${icon('playCircle', 22)}</div>`;
  const progress = Number(ep.progress || 0);
  root.innerHTML = `
    <div class="sthumb">${img}
      <span class="en num">${ep.episode_number != null ? String(ep.episode_number).padStart(2, '0') : ''}</span>
      <span class="pp">${icon('playCircle', 30)}</span>
    </div>
    <div class="ebody">
      <b>${esc(ep.name || `الحلقة ${ep.episode_number}`)}</b>
      <span class="mt">
        ${ep.air_date ? `<span class="num">${esc(ep.air_date)}</span>` : ''}
        ${ep.runtime ? `· <span class="num">${fmtRuntime(ep.runtime)}</span>` : ''}
        ${ep.vote_average ? `· <span class="num rate">${icon('star',12)} ${Number(ep.vote_average).toFixed(1)}</span>` : ''}
      </span>
      <p>${esc(ep.overview || 'لا يوجد وصف لهذه الحلقة.')}</p>
    </div>
    <div class="etail">
      ${season != null && ep.episode_number != null ? `<span class="z-pill num">S${String(season).padStart(2, '0')}E${String(ep.episode_number).padStart(2, '0')}</span>` : ''}
      ${ep.still_path ? '' : ''}
    </div>`;
  if (progress && showProgress) {
    const w = root.querySelector('.etail');
    const bar = document.createElement('span');
    bar.className = 'prog eprog';
    bar.style.cssText = 'position:relative;width:84px;height:3px;border-radius:3px;background:var(--surface-4);';
    bar.innerHTML = `<i style="display:block;height:100%;width:${Math.min(100, progress)}%;background:var(--accent);border-radius:3px;"></i>`;
    w.prepend(bar);
  }
  const go = () => (onOpen ? onOpen(ep) : null);
  root.addEventListener('click', go);
  root.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  return root;
}

/* ---------- editorial Top 10 (spec 16) ---------- */
export function createTop10(medias) {
  const rail = document.createElement('div');
  rail.className = 'z-top10';
  medias.slice(0, 10).forEach((m, i) => {
    const item = document.createElement('article');
    item.className = 'z-top10-item';
    item.tabIndex = 0;
    const path = m.poster_path;
    item.innerHTML = `
      <span class="rank">${i + 1}</span>
      <div class="poster">${path
        ? `<img src="${esc(getTMDBImageUrl(path, 'poster', 'w342'))}" alt="" loading="lazy">`
        : fallbackArt(getMediaTitle(m))}</div>
      <div class="tinfo">
        <b>${esc(truncate(getMediaTitle(m), 40))}</b>
        <span class="num">${getMediaYear(m) || ''} ${m.vote_average ? `· <span class="rate">${icon('star',12)} ${Number(m.vote_average).toFixed(1)}</span>` : ''}</span>
      </div>`;
    item.dataset.zctx = 'media';
    item.__media = m;
    const go = () => navigateTo(m, m.media_type || (m.first_air_date ? 'tv' : 'movie'));
    item.addEventListener('click', go);
    item.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    rail.appendChild(item);
  });
  return rail;
}

export default createMediaCard;
