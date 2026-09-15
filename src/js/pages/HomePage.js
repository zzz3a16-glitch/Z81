/**
 * HomePage - Complete rebuild with all required sections
 */

import { tmdbClient } from '../services/tmdb/TMDBClient.js';
import { getTMDBImageUrl } from '../services/tmdb/TMDBImage.js';
import { recommendationEngine } from '../services/recommendation/RecommendationEngine.js';
import { createRail, createSkeletonGrid } from '../components/MediaCard.js';
import { behaviorEngine } from '../services/behavior/UserBehaviorEngine.js';
import { tasteProfile } from '../services/behavior/UserTasteProfile.js';
import { db } from '../services/storage/Database.js';

export async function HomePage() {
  const container = document.createElement('div');
  container.className = 'home-page';
  container.innerHTML = `
    <div id="hero-section"></div>
    <div class="container">
      <div id="continue-watching-section"></div>
      <div id="recommended-section"></div>
      <div id="because-watched-section"></div>
      <div id="new-library-section"></div>
      <div id="discover-section"></div>
      <div id="trending-section"></div>
      <div id="movies-section"></div>
      <div id="tv-section"></div>
    </div>
  `;

  // Load all sections
  loadHeroSection(container.querySelector('#hero-section'));
  loadContinueWatching(container.querySelector('#continue-watching-section'));
  loadRecommended(container.querySelector('#recommended-section'));
  loadBecauseYouWatched(container.querySelector('#because-watched-section'));
  loadNewInLibrary(container.querySelector('#new-library-section'));
  loadDiscover(container.querySelector('#discover-section'));
  loadTrending(container.querySelector('#trending-section'));
  loadMovies(container.querySelector('#movies-section'));
  loadTVShows(container.querySelector('#tv-section'));

  return container;
}

async function loadHeroSection(container) {
  container.innerHTML = `
    <div class="hero skeleton-hero skeleton">
      <div style="height: 100%; display: flex; align-items: center; justify-content: center; color: var(--color-text-muted);">
        جاري تحميل المحتوى المميز...
      </div>
    </div>
  `;

  try {
    const trending = await tmdbClient.trending('all', 'day').catch(() => ({ results: [] }));
    const items = trending.results || [];
    
    if (items.length === 0) {
      container.innerHTML = `
        <div class="hero" style="background: linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-secondary) 100%); height: 70vh; min-height: 500px; display: flex; align-items: center; justify-content: center; text-align: center; color: white;">
          <div>
            <h1 style="font-size: 3rem; margin-bottom: 16px;">🍿 zPopcorn</h1>
            <p style="font-size: 1.25rem; opacity: 0.9; margin-bottom: 24px;">منصة الوسائط الذكية المتكاملة</p>
            <p style="opacity: 0.7;">قم بإعداد مفتاح TMDB في الإعدادات لبدء الاستكشاف</p>
            <button class="btn btn-secondary" style="margin-top: 24px; background: white; color: black;" onclick="window.router.navigate('/settings')">الذهاب للإعدادات</button>
          </div>
        </div>
      `;
      return;
    }

    // Pick random hero item
    const heroItem = items[Math.floor(Math.random() * Math.min(5, items.length))];
    
    // Get full details
    let details = heroItem;
    try {
      if (heroItem.media_type === 'tv') {
        details = await tmdbClient.getTV(heroItem.id);
      } else {
        details = await tmdbClient.getMovie(heroItem.id);
      }
    } catch {}

    const backdropUrl = details.backdrop_path ? getTMDBImageUrl(details.backdrop_path, 'backdrop', 'w1280') : '';
    const posterUrl = details.poster_path ? getTMDBImageUrl(details.poster_path, 'poster', 'w500') : '';
    const title = details.title || details.name || 'بدون عنوان';
    const overview = details.overview || 'لا يوجد وصف متاح';
    const rating = details.vote_average ? details.vote_average.toFixed(1) : null;
    const year = details.release_date ? new Date(details.release_date).getFullYear() : details.first_air_date ? new Date(details.first_air_date).getFullYear() : null;
    const runtime = details.runtime || (details.episode_run_time ? details.episode_run_time[0] : null);

    container.innerHTML = `
      <div class="hero">
        <div class="hero-backdrop">
          <img src="${backdropUrl}" alt="${title}" loading="eager" />
        </div>
        <div class="hero-overlay"></div>
        <div class="hero-content">
          ${posterUrl ? `
            <div class="hero-poster">
              <img src="${posterUrl}" alt="${title}" loading="eager" />
            </div>
          ` : ''}
          <div class="hero-info">
            <h1 class="hero-title">${title}</h1>
            ${details.original_title && details.original_title !== title ? `<div class="hero-title-arabic">${details.original_title}</div>` : ''}
            <div class="hero-meta">
              ${rating ? `<span class="hero-rating">★ ${rating}</span>` : ''}
              ${year ? `<span class="hero-badge">${year}</span>` : ''}
              ${runtime ? `<span class="hero-badge">${Math.floor(runtime / 60)}س ${runtime % 60}د</span>` : ''}
              ${details.genres ? details.genres.slice(0, 2).map(g => `<span class="hero-badge">${g.name}</span>`).join('') : ''}
              <span class="hero-badge">${details.media_type === 'tv' ? 'مسلسل' : 'فيلم'}</span>
            </div>
            <p class="hero-description">${overview}</p>
            <div class="hero-actions">
              <button class="hero-action-primary" data-action="play" data-id="${details.id}" data-type="${details.media_type || 'movie'}">
                <span>▶️</span> مشاهدة
              </button>
              <button class="hero-action-secondary" data-action="details" data-id="${details.id}" data-type="${details.media_type || 'movie'}">
                <span>ℹ️</span> التفاصيل
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Add event listeners
    container.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const type = btn.dataset.type;
        const action = btn.dataset.action;
        
        if (action === 'play') {
          window.dispatchEvent(new CustomEvent('playmedia', { detail: details }));
        } else {
          window.router.navigate(`/${type}/${id}`);
        }
      });
    });

  } catch (error) {
    console.warn('Failed to load hero:', error);
    container.innerHTML = `
      <div class="hero" style="background: var(--color-surface); height: 50vh; min-height: 400px; display: flex; align-items: center; justify-content: center; text-align: center;">
        <div>
          <h2>مرحباً بك في zPopcorn</h2>
          <p style="color: var(--color-text-secondary); margin-top: 8px;">منصة الوسائط الذكية</p>
        </div>
      </div>
    `;
  }
}

async function loadContinueWatching(container) {
  container.innerHTML = '<div class="section"><div class="media-grid"><div class="skeleton-card skeleton"></div><div class="skeleton-card skeleton"></div><div class="skeleton-card skeleton"></div></div></div>';

  try {
    const progress = await db.getAll('watchProgress').catch(() => []);
    const inProgress = progress.filter(p => p.progress > 5 && p.progress < 95).slice(0, 10);
    
    if (inProgress.length === 0) {
      container.innerHTML = '';
      return;
    }

    const rail = createRail(inProgress, {
      title: 'متابعة المشاهدة',
      subtitle: 'أكمل من حيث توقفت',
      icon: '▶️',
      onViewAll: () => window.router.navigate('/continue-watching')
    });
    
    container.innerHTML = '';
    container.appendChild(rail);

  } catch {
    container.innerHTML = '';
  }
}

async function loadRecommended(container) {
  container.innerHTML = '<div class="section"><h2 class="section-title" style="padding: 0 24px; margin-bottom: 16px;">💡 موصى به لك</h2><div class="media-grid"><div class="skeleton-card skeleton"></div><div class="skeleton-card skeleton"></div><div class="skeleton-card skeleton"></div><div class="skeleton-card skeleton"></div></div></div>';

  try {
    const recommendations = await recommendationEngine.getRecommendations(10);
    
    if (recommendations.length === 0) {
      container.innerHTML = '';
      return;
    }

    const profile = tasteProfile.getProfile();
    const subtitle = profile.favoriteGenres.length > 0 
      ? `بناءً على تفضيلك لـ ${profile.favoriteGenres[0]?.id || 'المحتوى المفضل'}`
      : 'بناءً على ذوقك';

    const rail = createRail(recommendations, {
      title: 'موصى به لك',
      subtitle,
      icon: '💡',
      onViewAll: () => window.router.navigate('/recommendations')
    });
    
    container.innerHTML = '';
    container.appendChild(rail);

  } catch (e) {
    console.warn('Failed to load recommendations:', e);
    container.innerHTML = '';
  }
}

async function loadBecauseYouWatched(container) {
  try {
    const history = behaviorEngine.getWatchHistory(1);
    if (history.length === 0) {
      container.innerHTML = '';
      return;
    }

    const lastWatched = history[0];
    const mediaId = lastWatched.metadata.mediaId;
    const mediaType = lastWatched.metadata.mediaType || 'movie';

    const recommendations = await recommendationEngine.getBecauseYouWatched(mediaId, mediaType, 10);
    
    if (recommendations.length === 0) {
      container.innerHTML = '';
      return;
    }

    const rail = createRail(recommendations, {
      title: `لأنك شاهدت ${lastWatched.metadata.title || 'محتوى سابق'}`,
      subtitle: 'قد يعجبك أيضاً',
      icon: '🎯'
    });
    
    container.innerHTML = '';
    container.appendChild(rail);

  } catch {
    container.innerHTML = '';
  }
}

async function loadNewInLibrary(container) {
  // This would show recently added local files
  // For now, skip if no local library
  container.innerHTML = '';
}

async function loadDiscover(container) {
  container.innerHTML = '<div class="section"><h2 class="section-title" style="padding: 0 24px; margin-bottom: 16px;">🔍 اكتشف شيئاً جديداً</h2><div class="media-grid"><div class="skeleton-card skeleton"></div><div class="skeleton-card skeleton"></div><div class="skeleton-card skeleton"></div><div class="skeleton-card skeleton"></div></div></div>';

  try {
    const discover = await recommendationEngine.getDiscoverSomethingNew(10);
    
    if (discover.length === 0) {
      container.innerHTML = '';
      return;
    }

    const rail = createRail(discover, {
      title: 'اكتشف شيئاً جديداً',
      subtitle: 'استكشاف محتوى جديد قد يعجبك',
      icon: '🔍'
    });
    
    container.innerHTML = '';
    container.appendChild(rail);

  } catch {
    container.innerHTML = '';
  }
}

async function loadTrending(container) {
  container.innerHTML = '<div class="section"><h2 class="section-title" style="padding: 0 24px; margin-bottom: 16px;">🔥 الرائج الآن</h2><div class="media-grid"><div class="skeleton-card skeleton"></div><div class="skeleton-card skeleton"></div><div class="skeleton-card skeleton"></div><div class="skeleton-card skeleton"></div></div></div>';

  try {
    const trending = await tmdbClient.trending('all', 'week');
    const results = (trending.results || []).slice(0, 10);
    
    if (results.length === 0) {
      container.innerHTML = '';
      return;
    }

    const rail = createRail(results, {
      title: 'الرائج الآن',
      subtitle: 'الأكثر مشاهدة هذا الأسبوع',
      icon: '🔥',
      onViewAll: () => window.router.navigate('/trending')
    });
    
    container.innerHTML = '';
    container.appendChild(rail);

  } catch {
    container.innerHTML = '';
  }
}

async function loadMovies(container) {
  container.innerHTML = '<div class="section"><h2 class="section-title" style="padding: 0 24px; margin-bottom: 16px;">🎬 أفلام مميزة</h2><div class="media-grid"><div class="skeleton-card skeleton"></div><div class="skeleton-card skeleton"></div><div class="skeleton-card skeleton"></div><div class="skeleton-card skeleton"></div></div></div>';

  try {
    const movies = await tmdbClient.popularMovies();
    const results = (movies.results || []).slice(0, 10);
    
    if (results.length === 0) {
      container.innerHTML = '';
      return;
    }

    const rail = createRail(results, {
      title: 'أفلام مميزة',
      subtitle: 'أشهر الأفلام حالياً',
      icon: '🎬',
      onViewAll: () => window.router.navigate('/movies')
    });
    
    container.innerHTML = '';
    container.appendChild(rail);

  } catch {
    container.innerHTML = '';
  }
}

async function loadTVShows(container) {
  container.innerHTML = '<div class="section"><h2 class="section-title" style="padding: 0 24px; margin-bottom: 16px;">📺 مسلسلات مميزة</h2><div class="media-grid"><div class="skeleton-card skeleton"></div><div class="skeleton-card skeleton"></div><div class="skeleton-card skeleton"></div><div class="skeleton-card skeleton"></div></div></div>';

  try {
    const tvshows = await tmdbClient.popularTV();
    const results = (tvshows.results || []).slice(0, 10);
    
    if (results.length === 0) {
      container.innerHTML = '';
      return;
    }

    const rail = createRail(results, {
      title: 'مسلسلات مميزة',
      subtitle: 'أشهر المسلسلات حالياً',
      icon: '📺',
      onViewAll: () => window.router.navigate('/tv')
    });
    
    container.innerHTML = '';
    container.appendChild(rail);

  } catch {
    container.innerHTML = '';
  }
}
