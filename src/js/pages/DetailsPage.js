/**
 * DetailsPage - Premium media details page
 */

import { tmdbClient } from '../services/tmdb/TMDBClient.js';
import { getTMDBImageUrl } from '../services/tmdb/TMDBImage.js';
import { getMediaTitle, getMediaYear, formatRuntime, formatDate } from '../utils/helpers.js';
import { createMediaGrid } from '../components/MediaCard.js';
import { watchlistManager } from '../services/watchlist/WatchlistManager.js';
import { ratingManager } from '../services/rating/RatingManager.js';
import { behaviorEngine, BEHAVIOR_EVENTS } from '../services/behavior/UserBehaviorEngine.js';

export async function MovieDetailsPage(params) {
  return DetailsPage(params, 'movie');
}

export async function TVDetailsPage(params) {
  return DetailsPage(params, 'tv');
}

export async function DetailsPage(params, mediaType = 'movie') {
  const id = params.id;
  const container = document.createElement('div');
  container.className = 'details-page';
  container.innerHTML = `
    <div class="details-loading" style="min-height: 100vh; display: flex; align-items: center; justify-content: center;">
      <div style="text-align: center;">
        <div class="app-loading-spinner" style="margin: 0 auto 16px;"></div>
        <p>جاري تحميل التفاصيل...</p>
      </div>
    </div>
  `;

  try {
    let media;
    
    if (mediaType === 'tv') {
      media = await tmdbClient.getTV(id);
    } else {
      media = await tmdbClient.getMovie(id);
    }

    behaviorEngine.track(BEHAVIOR_EVENTS.OPENED, {
      mediaId: id,
      mediaType,
      title: media.title || media.name
    });

    const title = getMediaTitle(media);
    const originalTitle = media.original_title || media.original_name;
    const year = getMediaYear(media);
    const runtime = media.runtime || (media.episode_run_time ? media.episode_run_time[0] : null);
    const rating = media.vote_average;
    const backdropUrl = media.backdrop_path ? getTMDBImageUrl(media.backdrop_path, 'backdrop', 'w1280') : '';
    const posterUrl = media.poster_path ? getTMDBImageUrl(media.poster_path, 'poster', 'w500') : '';
    const genres = media.genres || [];
    const overview = media.overview || 'لا يوجد وصف متاح';
    const cast = media.credits?.cast?.slice(0, 10) || [];
    const crew = media.credits?.crew?.slice(0, 6) || [];
    const videos = media.videos?.results?.slice(0, 3) || [];
    const recommendations = media.recommendations?.results?.slice(0, 10) || [];
    const similar = media.similar?.results?.slice(0, 10) || [];

    // Get user rating
    const userRating = await ratingManager.getRating(id).catch(() => null);
    const isFavorite = await watchlistManager.isInList('favorites', id).catch(() => false);
    const inWatchLater = await watchlistManager.isInList('watch-later', id).catch(() => false);

    container.innerHTML = `
      <div class="details-hero" style="position: relative; min-height: 70vh; overflow: hidden;">
        ${backdropUrl ? `
          <div style="position: absolute; inset: 0;">
            <img src="${backdropUrl}" alt="${title}" style="width: 100%; height: 100%; object-fit: cover;" />
            <div style="position: absolute; inset: 0; background: linear-gradient(to right, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.7) 50%, rgba(0,0,0,0.3) 100%);"></div>
            <div style="position: absolute; inset: 0; background: linear-gradient(to top, var(--color-background) 0%, transparent 50%);"></div>
          </div>
        ` : `<div style="position: absolute; inset: 0; background: var(--color-surface);"></div>`}
        
        <div class="container" style="position: relative; z-index: 2; padding-top: 80px; padding-bottom: 40px;">
          <button class="btn btn-ghost" onclick="window.router.goBack()" style="margin-bottom: 24px; color: white; background: rgba(0,0,0,0.5); backdrop-filter: blur(10px);">
            ← العودة
          </button>
          
          <div style="display: flex; gap: 32px; align-items: flex-start; flex-wrap: wrap;">
            ${posterUrl ? `
              <div style="width: 300px; flex-shrink: 0; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5); border: 2px solid rgba(255,255,255,0.1);">
                <img src="${posterUrl}" alt="${title}" style="width: 100%; aspect-ratio: 2/3; object-fit: cover;" />
              </div>
            ` : ''}
            
            <div style="flex: 1; min-width: 300px; color: white;">
              <h1 style="font-size: 2.5rem; font-weight: 700; line-height: 1.2; margin-bottom: 8px; text-shadow: 0 2px 20px rgba(0,0,0,0.8);">${title}</h1>
              ${originalTitle && originalTitle !== title ? `<div style="font-size: 1.25rem; opacity: 0.8; margin-bottom: 16px;">${originalTitle}</div>` : ''}
              
              <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px;">
                ${rating ? `<span style="background: rgba(255,215,0,0.2); border: 1px solid rgba(255,215,0,0.3); color: #ffd700; padding: 6px 12px; border-radius: 20px; font-size: 13px; backdrop-filter: blur(10px);">★ ${rating.toFixed(1)}/10</span>` : ''}
                ${year ? `<span style="background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.2); padding: 6px 12px; border-radius: 20px; font-size: 13px; backdrop-filter: blur(10px);">${year}</span>` : ''}
                ${runtime ? `<span style="background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.2); padding: 6px 12px; border-radius: 20px; font-size: 13px; backdrop-filter: blur(10px);">${formatRuntime(runtime)}</span>` : ''}
                ${mediaType === 'tv' ? `<span style="background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.2); padding: 6px 12px; border-radius: 20px; font-size: 13px; backdrop-filter: blur(10px);">${media.number_of_seasons || '?'} مواسم</span>` : ''}
                <span style="background: var(--color-accent); padding: 6px 12px; border-radius: 20px; font-size: 13px;">${mediaType === 'tv' ? 'مسلسل' : 'فيلم'}</span>
              </div>

              ${genres.length > 0 ? `
                <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px;">
                  ${genres.map(g => `<span style="background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.2); padding: 4px 10px; border-radius: 16px; font-size: 12px; backdrop-filter: blur(10px); cursor: pointer;" onclick="window.router.navigate('/movies?genre=${g.id}')">${g.name}</span>`).join('')}
                </div>
              ` : ''}

              <p style="font-size: 1.1rem; line-height: 1.7; opacity: 0.9; margin-bottom: 24px; max-width: 600px; text-shadow: 0 1px 10px rgba(0,0,0,0.8);">${overview}</p>

              <div style="display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 24px;">
                <button class="btn btn-primary btn-lg" id="play-btn" style="background: var(--color-accent);">
                  <span>▶️</span> مشاهدة
                </button>
                <button class="btn btn-secondary btn-lg" id="favorite-btn" style="background: rgba(255,255,255,0.15); color: white; border: 1px solid rgba(255,255,255,0.3); backdrop-filter: blur(10px);">
                  <span>${isFavorite ? '❤️' : '🤍'}</span> ${isFavorite ? 'في المفضلة' : 'إضافة للمفضلة'}
                </button>
                <button class="btn btn-secondary btn-lg" id="watchlist-btn" style="background: rgba(255,255,255,0.15); color: white; border: 1px solid rgba(255,255,255,0.3); backdrop-filter: blur(10px);">
                  <span>🔖</span> ${inWatchLater ? 'في قائمة المشاهدة' : 'المشاهدة لاحقاً'}
                </button>
                <button class="btn btn-secondary btn-lg" id="share-btn" style="background: rgba(255,255,255,0.15); color: white; border: 1px solid rgba(255,255,255,0.3); backdrop-filter: blur(10px);">
                  <span>↗️</span> مشاركة
                </button>
              </div>

              ${userRating ? `
                <div style="background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 16px; backdrop-filter: blur(10px); max-width: 400px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="font-weight: 600;">تقييمك</span>
                    <span style="background: var(--color-accent); padding: 4px 12px; border-radius: 20px; font-weight: 600;">${userRating.personalRating}/10</span>
                  </div>
                  ${userRating.review ? `<p style="font-size: 14px; opacity: 0.8; margin-top: 8px;">"${userRating.review}"</p>` : ''}
                </div>
              ` : `
                <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                  <span style="font-size: 14px; opacity: 0.8;">قيم هذا العمل:</span>
                  <div id="rating-stars" style="display: flex; gap: 4px;">
                    ${[1,2,3,4,5,6,7,8,9,10].map(n => `<button class="rating-star" data-rating="${n}" style="background: none; border: none; font-size: 20px; cursor: pointer; opacity: 0.5; transition: all 0.2s;">★</button>`).join('')}
                  </div>
                </div>
              `}
            </div>
          </div>
        </div>
      </div>

      <div class="container" style="padding-top: 32px; padding-bottom: 32px;">
        <div style="display: flex; gap: 8px; margin-bottom: 32px; border-bottom: 1px solid var(--color-border); padding-bottom: 16px; overflow-x: auto;">
          <button class="tab-btn active" data-tab="overview" style="padding: 8px 16px; background: var(--color-accent); color: white; border: none; border-radius: 20px; cursor: pointer; white-space: nowrap;">نظرة عامة</button>
          <button class="tab-btn" data-tab="cast" style="padding: 8px 16px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 20px; cursor: pointer; white-space: nowrap;">طاقم العمل</button>
          <button class="tab-btn" data-tab="videos" style="padding: 8px 16px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 20px; cursor: pointer; white-space: nowrap;">الفيديوهات</button>
          <button class="tab-btn" data-tab="similar" style="padding: 8px 16px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 20px; cursor: pointer; white-space: nowrap;">أعمال مشابهة</button>
          ${mediaType === 'tv' ? `<button class="tab-btn" data-tab="seasons" style="padding: 8px 16px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 20px; cursor: pointer; white-space: nowrap;">المواسم</button>` : ''}
        </div>

        <div id="tab-overview" class="tab-content">
          <div style="display: grid; grid-template-columns: 1fr 300px; gap: 32px; align-items: start;">
            <div>
              <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 16px;">القصة</h3>
              <p style="line-height: 1.8; color: var(--color-text-secondary); margin-bottom: 24px;">${overview}</p>
              
              ${mediaType === 'tv' && media.seasons ? `
                <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 16px; margin-top: 32px;">المواسم</h3>
                <div style="display: grid; gap: 12px;">
                  ${media.seasons.map(season => `
                    <div style="display: flex; gap: 16px; padding: 16px; background: var(--color-card); border: 1px solid var(--color-border); border-radius: 12px; cursor: pointer;" onclick="window.router.navigate('/tv/${id}/season/${season.season_number}')">
                      ${season.poster_path ? `<img src="${getTMDBImageUrl(season.poster_path, 'poster', 'w185')}" style="width: 80px; aspect-ratio: 2/3; object-fit: cover; border-radius: 8px;" />` : '<div style="width: 80px; aspect-ratio: 2/3; background: var(--color-surface); border-radius: 8px; display: flex; align-items: center; justify-content: center;">🎬</div>'}
                      <div style="flex: 1;">
                        <h4 style="font-weight: 600; margin-bottom: 4px;">${season.name}</h4>
                        <div style="font-size: 13px; color: var(--color-text-secondary); margin-bottom: 8px;">${season.episode_count || 0} حلقة • ${season.air_date ? new Date(season.air_date).getFullYear() : 'غير معروف'}</div>
                        <p style="font-size: 14px; color: var(--color-text-secondary); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${season.overview || 'لا يوجد وصف'}</p>
                      </div>
                    </div>
                  `).join('')}
                </div>
              ` : ''}
            </div>
            
            <div style="background: var(--color-card); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px;">
              <h4 style="font-weight: 600; margin-bottom: 16px;">معلومات</h4>
              <div style="display: flex; flex-direction: column; gap: 12px; font-size: 14px;">
                ${media.release_date || media.first_air_date ? `<div><span style="color: var(--color-text-muted);">تاريخ الإصدار:</span><br><span>${formatDate(media.release_date || media.first_air_date)}</span></div>` : ''}
                ${media.production_companies?.length ? `<div><span style="color: var(--color-text-muted);">الشركات المنتجة:</span><br><span>${media.production_companies.slice(0, 3).map(c => c.name).join('، ')}</span></div>` : ''}
                ${media.networks?.length ? `<div><span style="color: var(--color-text-muted);">الشبكات:</span><br><span>${media.networks.map(n => n.name).join('، ')}</span></div>` : ''}
                ${media.status ? `<div><span style="color: var(--color-text-muted);">الحالة:</span><br><span>${media.status}</span></div>` : ''}
                ${media.original_language ? `<div><span style="color: var(--color-text-muted);">اللغة الأصلية:</span><br><span>${media.original_language.toUpperCase()}</span></div>` : ''}
                ${media.budget ? `<div><span style="color: var(--color-text-muted);">الميزانية:</span><br><span class="number-ltr">$${(media.budget / 1000000).toFixed(1)}M</span></div>` : ''}
              </div>
            </div>
          </div>
        </div>

        <div id="tab-cast" class="tab-content" style="display: none;">
          <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 16px;">طاقم التمثيل</h3>
          <div class="media-grid" style="grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));">
            ${cast.map(person => `
              <div style="background: var(--color-card); border: 1px solid var(--color-border); border-radius: 12px; overflow: hidden; cursor: pointer; transition: all 0.2s;" onclick="window.router.navigate('/person/${person.id}')">
                ${person.profile_path ? `<img src="${getTMDBImageUrl(person.profile_path, 'profile', 'w185')}" style="width: 100%; aspect-ratio: 2/3; object-fit: cover;" />` : '<div style="width: 100%; aspect-ratio: 2/3; background: var(--color-surface); display: flex; align-items: center; justify-content: center; font-size: 32px;">👤</div>'}
                <div style="padding: 12px;">
                  <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${person.name}</div>
                  <div style="font-size: 12px; color: var(--color-text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${person.character || person.job || ''}</div>
                </div>
              </div>
            `).join('')}
          </div>
          
          ${crew.length > 0 ? `
            <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 16px; margin-top: 32px;">طاقم العمل</h3>
            <div style="display: grid; gap: 8px;">
              ${crew.map(person => `
                <div style="display: flex; justify-content: space-between; padding: 12px; background: var(--color-card); border: 1px solid var(--color-border); border-radius: 8px;">
                  <span style="font-weight: 500;">${person.name}</span>
                  <span style="color: var(--color-text-secondary); font-size: 13px;">${person.job}</span>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>

        <div id="tab-videos" class="tab-content" style="display: none;">
          <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 16px;">الفيديوهات</h3>
          ${videos.length > 0 ? `
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px;">
              ${videos.map(video => `
                <div style="background: var(--color-card); border: 1px solid var(--color-border); border-radius: 12px; overflow: hidden; cursor: pointer;" onclick="window.open('https://www.youtube.com/watch?v=${video.key}', '_blank')">
                  <div style="position: relative; aspect-ratio: 16/9; background: #000; display: flex; align-items: center; justify-content: center;">
                    <img src="https://img.youtube.com/vi/${video.key}/hqdefault.jpg" style="width: 100%; height: 100%; object-fit: cover;" />
                    <div style="position: absolute; inset: 0; background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
                      <div style="width: 60px; height: 60px; background: rgba(255,0,0,0.9); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; color: white;">▶️</div>
                    </div>
                  </div>
                  <div style="padding: 12px;">
                    <div style="font-weight: 600; margin-bottom: 4px;">${video.name}</div>
                    <div style="font-size: 12px; color: var(--color-text-secondary);">${video.type} • ${video.site}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : `
            <div class="empty-state">
              <div class="empty-state-icon">🎬</div>
              <h3 class="empty-state-title">لا توجد فيديوهات</h3>
              <p class="empty-state-description">لا توجد فيديوهات متاحة لهذا العمل</p>
            </div>
          `}
        </div>

        <div id="tab-similar" class="tab-content" style="display: none;">
          <div style="margin-bottom: 32px;">
            <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 16px;">توصيات</h3>
            <div id="recommendations-grid" class="media-grid"></div>
          </div>
          <div>
            <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 16px;">أعمال مشابهة</h3>
            <div id="similar-grid" class="media-grid"></div>
          </div>
        </div>
      </div>
    `;

    // Tab switching
    container.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.tab-btn').forEach(b => {
          b.classList.remove('active');
          b.style.background = 'var(--color-surface)';
          b.style.color = 'var(--color-text-primary)';
        });
        btn.classList.add('active');
        btn.style.background = 'var(--color-accent)';
        btn.style.color = 'white';

        const tabName = btn.dataset.tab;
        container.querySelectorAll('.tab-content').forEach(tab => {
          tab.style.display = 'none';
        });
        container.querySelector(`#tab-${tabName}`).style.display = 'block';

        // Load tab content if needed
        if (tabName === 'similar') {
          loadSimilarContent();
        }
      });
    });

    async function loadSimilarContent() {
      const recGrid = container.querySelector('#recommendations-grid');
      const simGrid = container.querySelector('#similar-grid');

      if (recommendations.length > 0) {
        createMediaGrid(recommendations, recGrid);
      } else {
        recGrid.innerHTML = '<p style="color: var(--color-text-muted);">لا توجد توصيات</p>';
      }

      if (similar.length > 0) {
        createMediaGrid(similar, simGrid);
      } else {
        simGrid.innerHTML = '<p style="color: var(--color-text-muted);">لا توجد أعمال مشابهة</p>';
      }
    }

    // Action buttons
    container.querySelector('#play-btn')?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('playmedia', { detail: media }));
    });

    container.querySelector('#favorite-btn')?.addEventListener('click', async () => {
      const btn = container.querySelector('#favorite-btn');
      try {
        if (isFavorite) {
          await watchlistManager.removeFromList('favorites', id);
          btn.innerHTML = '<span>🤍</span> إضافة للمفضلة';
        } else {
          await watchlistManager.addToList('favorites', media);
          btn.innerHTML = '<span>❤️</span> في المفضلة';
        }
      } catch (e) {
        console.warn('Favorite toggle failed:', e);
      }
    });

    container.querySelector('#watchlist-btn')?.addEventListener('click', async () => {
      const btn = container.querySelector('#watchlist-btn');
      try {
        if (inWatchLater) {
          await watchlistManager.removeFromList('watch-later', id);
          btn.innerHTML = '<span>🔖</span> المشاهدة لاحقاً';
        } else {
          await watchlistManager.addToList('watch-later', media);
          btn.innerHTML = '<span>🔖</span> في قائمة المشاهدة';
        }
      } catch {}
    });

    container.querySelector('#share-btn')?.addEventListener('click', async () => {
      const url = `${window.location.origin}/${mediaType}/${id}`;
      try {
        await navigator.clipboard.writeText(url);
        window.dispatchEvent(new CustomEvent('showtoast', {
          detail: { type: 'success', title: 'تم النسخ', message: 'تم نسخ الرابط' }
        }));
      } catch {
        window.dispatchEvent(new CustomEvent('showtoast', {
          detail: { type: 'info', title: 'مشاركة', message: url }
        }));
      }
    });

    // Rating stars
    container.querySelectorAll('.rating-star').forEach(star => {
      star.addEventListener('click', async () => {
        const rating = parseInt(star.dataset.rating);
        try {
          await ratingManager.rate(id, rating, null, { mediaType, title });
          window.dispatchEvent(new CustomEvent('showtoast', {
            detail: { type: 'success', title: 'تم التقييم', message: `قيمت بـ ${rating}/10` }
          }));
          // Reload to show rating
          setTimeout(() => window.location.reload(), 500);
        } catch (e) {
          console.warn('Rating failed:', e);
        }
      });

      star.addEventListener('mouseenter', () => {
        const rating = parseInt(star.dataset.rating);
        container.querySelectorAll('.rating-star').forEach((s, index) => {
          s.style.opacity = index < rating ? '1' : '0.3';
          s.style.color = index < rating ? '#ffd700' : 'var(--color-text-muted)';
        });
      });
    });

    container.querySelector('#rating-stars')?.addEventListener('mouseleave', () => {
      container.querySelectorAll('.rating-star').forEach(s => {
        s.style.opacity = '0.5';
        s.style.color = 'var(--color-text-muted)';
      });
    });

  } catch (error) {
    console.error('Failed to load details:', error);
    container.innerHTML = `
      <div class="container" style="padding: 80px 24px; text-align: center;">
        <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
        <h2 style="margin-bottom: 8px;">تعذر تحميل التفاصيل</h2>
        <p style="color: var(--color-text-secondary); margin-bottom: 24px;">${error.message || 'حدث خطأ أثناء تحميل البيانات'}</p>
        <button class="btn btn-primary" onclick="window.router.goBack()">العودة</button>
        <button class="btn btn-secondary" onclick="window.location.reload()" style="margin-right: 8px;">إعادة المحاولة</button>
      </div>
    `;
  }

  return container;
}
