/**
 * MediaCard Component - Premium media card with all states
 */

import { getTMDBImageUrl } from '../services/tmdb/TMDBImage.js';
import { getMediaTitle, getMediaYear, getRatingColor, truncate } from '../utils/helpers.js';
import { watchlistManager } from '../services/watchlist/WatchlistManager.js';
import { behaviorEngine, BEHAVIOR_EVENTS } from '../services/behavior/UserBehaviorEngine.js';

export function createMediaCard(media, options = {}) {
  const {
    size = 'md',
    showRating = true,
    showYear = true,
    showType = true,
    showActions = true,
    onClick = null
  } = options;

  const title = getMediaTitle(media);
  const year = getMediaYear(media);
  const rating = media.vote_average ? media.vote_average.toFixed(1) : null;
  const posterPath = media.poster_path || media.profile_path;
  const mediaType = media.media_type || media.type || (media.first_air_date ? 'tv' : 'movie');
  
  const card = document.createElement('div');
  card.className = `media-card media-card-${size}`;
  card.dataset.mediaId = media.id;
  card.dataset.mediaType = mediaType;

  const imageUrl = posterPath ? getTMDBImageUrl(posterPath, 'poster', 'w342') : null;
  const fallbackUrl = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="342" height="513" viewBox="0 0 342 513"><rect width="100%" height="100%" fill="%231a1a1a"/><text x="50%" y="50%" font-family="Arial" font-size="14" fill="%23666" text-anchor="middle" dy=".3em">🎬</text></svg>`;

  card.innerHTML = `
    ${mediaType ? `<div class="media-card-badge">${mediaType === 'movie' ? 'فيلم' : mediaType === 'tv' ? 'مسلسل' : 'شخص'}</div>` : ''}
    <img 
      class="media-card-image" 
      src="${imageUrl || fallbackUrl}" 
      alt="${title}"
      loading="lazy"
      decoding="async"
      onerror="this.src='${fallbackUrl}'"
    />
    <div class="media-card-overlay">
      <div class="media-card-overlay-content">
        <h3 class="media-card-title-overlay">${truncate(title, 50)}</h3>
        <div class="media-card-meta-overlay">
          ${year ? `<span>${year}</span>` : ''}
          ${rating ? `<span style="color: ${getRatingColor(rating)}">★ ${rating}</span>` : ''}
        </div>
      </div>
    </div>
    <div class="media-card-content">
      <h3 class="media-card-title" title="${title}">${truncate(title, 30)}</h3>
      <div class="media-card-meta">
        ${year && showYear ? `<span class="number-ltr">${year}</span>` : ''}
        ${rating && showRating ? `<span class="media-card-rating" style="background: ${getRatingColor(rating)}20; color: ${getRatingColor(rating)}; border: 1px solid ${getRatingColor(rating)}40">★ ${rating}</span>` : ''}
      </div>
    </div>
    ${showActions ? `
      <div class="media-card-actions">
        <button class="media-card-action" data-action="favorite" title="المفضلة">❤️</button>
        <button class="media-card-action" data-action="watchlist" title="قائمة المشاهدة">🔖</button>
        <button class="media-card-action" data-action="play" title="تشغيل">▶️</button>
      </div>
    ` : ''}
    ${media.matchPercentage ? `
      <div class="media-card-match" style="position: absolute; bottom: 60px; left: 8px; right: 8px; background: linear-gradient(90deg, var(--color-accent) ${media.matchPercentage}%, rgba(0,0,0,0.6) ${media.matchPercentage}%); padding: 4px 8px; border-radius: 4px; font-size: 11px; color: white; font-weight: 600;">
        ${media.matchPercentage}% تطابق
      </div>
    ` : ''}
  `;

  // Click handler
  card.addEventListener('click', (e) => {
    const actionBtn = e.target.closest('.media-card-action');
    
    if (actionBtn) {
      e.stopPropagation();
      const action = actionBtn.dataset.action;
      handleCardAction(action, media, card);
      return;
    }

    if (onClick) {
      onClick(media);
    } else {
      // Default navigation
      behaviorEngine.track(BEHAVIOR_EVENTS.OPENED, {
        mediaId: media.id,
        mediaType,
        title
      });

      if (mediaType === 'person') {
        window.router?.navigate(`/person/${media.id}`);
      } else if (mediaType === 'tv') {
        window.router?.navigate(`/tv/${media.id}`);
      } else {
        window.router?.navigate(`/movie/${media.id}`);
      }
    }
  });

  return card;
}

async function handleCardAction(action, media, cardElement) {
  const mediaType = media.media_type || media.type || 'movie';
  
  switch (action) {
    case 'favorite':
      try {
        const result = await watchlistManager.addToList('favorites', media);
        if (result.success) {
          showCardFeedback(cardElement, 'تمت الإضافة للمفضلة', 'success');
        } else {
          await watchlistManager.removeFromList('favorites', media.id);
          showCardFeedback(cardElement, 'تمت الإزالة من المفضلة', 'info');
        }
      } catch (e) {
        showCardFeedback(cardElement, 'حدث خطأ', 'error');
      }
      break;
      
    case 'watchlist':
      try {
        const result = await watchlistManager.addToList('watch-later', media);
        if (result.success) {
          showCardFeedback(cardElement, 'تمت الإضافة لقائمة المشاهدة', 'success');
        } else {
          showCardFeedback(cardElement, 'موجود بالفعل', 'warning');
        }
      } catch (e) {
        showCardFeedback(cardElement, 'حدث خطأ', 'error');
      }
      break;
      
    case 'play':
      behaviorEngine.track(BEHAVIOR_EVENTS.PLAY_STARTED, {
        mediaId: media.id,
        mediaType,
        title: getMediaTitle(media)
      });
      
      window.dispatchEvent(new CustomEvent('playmedia', { detail: media }));
      break;
  }
}

function showCardFeedback(cardElement, message, type = 'info') {
  window.dispatchEvent(new CustomEvent('showtoast', {
    detail: { type, message, title: 'تم', duration: 2000 }
  }));
}

export function createMediaGrid(medias, container, options = {}) {
  if (!container) return;
  
  container.innerHTML = '';
  
  if (!medias || medias.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon">🎬</div>
        <h3 class="empty-state-title">لا يوجد محتوى</h3>
        <p class="empty-state-description">لم يتم العثور على أي محتوى لعرضه</p>
      </div>
    `;
    return;
  }

  medias.forEach(media => {
    const card = createMediaCard(media, options);
    container.appendChild(card);
  });
}

export function createSkeletonGrid(container, count = 12) {
  if (!container) return;
  
  container.innerHTML = '';
  
  for (let i = 0; i < count; i++) {
    const skeleton = document.createElement('div');
    skeleton.className = 'skeleton-card skeleton';
    container.appendChild(skeleton);
  }
}

export function createRail(medias, options = {}) {
  const { title, subtitle, icon = '🎬', onViewAll = null } = options;
  
  const rail = document.createElement('div');
  rail.className = 'rail-section section';
  
  rail.innerHTML = `
    <div class="section-header">
      <div>
        <h2 class="section-title">
          ${icon ? `<span class="section-title-icon">${icon}</span>` : ''}
          ${title}
        </h2>
        ${subtitle ? `<p class="section-subtitle">${subtitle}</p>` : ''}
      </div>
      ${onViewAll ? `<button class="btn btn-ghost btn-sm" data-action="view-all">عرض الكل</button>` : ''}
    </div>
    <div class="rail">
      <button class="rail-nav prev" data-direction="prev">‹</button>
      <div class="rail-container"></div>
      <button class="rail-nav next" data-direction="next">›</button>
    </div>
  `;

  const container = rail.querySelector('.rail-container');
  const viewAllBtn = rail.querySelector('[data-action="view-all"]');
  
  if (viewAllBtn && onViewAll) {
    viewAllBtn.addEventListener('click', onViewAll);
  }

  // Create cards
  medias.forEach(media => {
    const cardWrapper = document.createElement('div');
    cardWrapper.className = 'rail-card';
    cardWrapper.appendChild(createMediaCard(media, options));
    container.appendChild(cardWrapper);
  });

  // Navigation
  const navButtons = rail.querySelectorAll('.rail-nav');
  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const direction = btn.dataset.direction;
      const scrollAmount = 400;
      
      if (direction === 'prev') {
        container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
      } else {
        container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      }
    });
  });

  return rail;
}
