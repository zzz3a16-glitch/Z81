/**
 * TVShowsPage
 */

import { tmdbClient } from '../services/tmdb/TMDBClient.js';
import { createMediaGrid, createSkeletonGrid } from '../components/MediaCard.js';

export async function TVShowsPage() {
  const container = document.createElement('div');
  container.className = 'tv-page';
  container.innerHTML = `
    <div class="container" style="padding-top: 24px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 16px;">
        <h1 style="font-size: 2rem; font-weight: 700;">📺 المسلسلات</h1>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button class="btn btn-secondary btn-sm filter-btn active" data-filter="popular">الأشهر</button>
          <button class="btn btn-secondary btn-sm filter-btn" data-filter="trending">الرائج</button>
          <button class="btn btn-secondary btn-sm filter-btn" data-filter="airing_today">يعرض اليوم</button>
          <button class="btn btn-secondary btn-sm filter-btn" data-filter="on_the_air">يعرض الآن</button>
          <button class="btn btn-secondary btn-sm filter-btn" data-filter="top_rated">الأعلى تقييماً</button>
        </div>
      </div>
      <div id="tv-grid" class="media-grid"></div>
      <div style="display: flex; justify-content: center; margin-top: 32px;">
        <button id="load-more" class="btn btn-secondary">تحميل المزيد</button>
      </div>
    </div>
  `;

  const grid = container.querySelector('#tv-grid');
  const loadMoreBtn = container.querySelector('#load-more');
  let currentFilter = 'popular';
  let currentPage = 1;
  let currentShows = [];
  let isLoading = false;

  async function loadShows(reset = true) {
    if (isLoading) return;
    isLoading = true;

    if (reset) {
      currentPage = 1;
      currentShows = [];
      createSkeletonGrid(grid, 12);
    } else {
      loadMoreBtn.textContent = 'جاري التحميل...';
      loadMoreBtn.disabled = true;
    }

    try {
      let result;
      
      switch (currentFilter) {
        case 'popular':
          result = await tmdbClient.popularTV(currentPage);
          break;
        case 'trending':
          result = await tmdbClient.trending('tv', 'week', currentPage);
          break;
        case 'airing_today':
          result = await tmdbClient.airingToday(currentPage);
          break;
        case 'on_the_air':
          result = await tmdbClient.onTheAir(currentPage);
          break;
        case 'top_rated':
          result = await tmdbClient.topRatedTV(currentPage);
          break;
        default:
          result = await tmdbClient.popularTV(currentPage);
      }

      const shows = result.results || [];
      
      if (reset) {
        currentShows = shows;
      } else {
        currentShows = [...currentShows, ...shows];
      }

      createMediaGrid(currentShows, grid);

      if (result.page < result.total_pages) {
        loadMoreBtn.style.display = 'block';
        loadMoreBtn.textContent = 'تحميل المزيد';
        loadMoreBtn.disabled = false;
      } else {
        loadMoreBtn.style.display = 'none';
      }

    } catch (error) {
      console.warn('Failed to load TV shows:', error);
      if (reset) {
        grid.innerHTML = `
          <div class="empty-state" style="grid-column: 1 / -1;">
            <div class="empty-state-icon">⚠️</div>
            <h3 class="empty-state-title">تعذر تحميل المسلسلات</h3>
            <p class="empty-state-description">تحقق من اتصالك بالإنترنت</p>
          </div>
        `;
      }
    } finally {
      isLoading = false;
    }
  }

  container.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      loadShows(true);
    });
  });

  loadMoreBtn.addEventListener('click', () => {
    currentPage++;
    loadShows(false);
  });

  loadShows(true);

  return container;
}
