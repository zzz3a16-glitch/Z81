/**
 * AnimePage - Dedicated anime section
 */

import { tmdbClient } from '../services/tmdb/TMDBClient.js';
import { createMediaGrid, createSkeletonGrid } from '../components/MediaCard.js';

export async function AnimePage() {
  const container = document.createElement('div');
  container.className = 'anime-page';
  container.innerHTML = `
    <div class="container" style="padding-top: 24px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
        <div>
          <h1 style="font-size: 2rem; font-weight: 700;">🎌 الأنمي</h1>
          <p style="color: var(--color-text-secondary); margin-top: 4px;">عالم الأنمي الياباني والكوري</p>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-secondary btn-sm filter-btn active" data-filter="popular">الأشهر</button>
          <button class="btn btn-secondary btn-sm filter-btn" data-filter="top_rated">الأعلى تقييماً</button>
          <button class="btn btn-secondary btn-sm filter-btn" data-filter="airing">يعرض الآن</button>
        </div>
      </div>
      <div id="anime-grid" class="media-grid"></div>
      <div style="display: flex; justify-content: center; margin-top: 32px;">
        <button id="load-more" class="btn btn-secondary">تحميل المزيد</button>
      </div>
    </div>
  `;

  const grid = container.querySelector('#anime-grid');
  const loadMoreBtn = container.querySelector('#load-more');
  let currentFilter = 'popular';
  let currentPage = 1;
  let currentAnime = [];

  async function loadAnime(reset = true) {
    if (reset) {
      currentPage = 1;
      currentAnime = [];
      createSkeletonGrid(grid, 12);
    }

    try {
      let result;
      
      // Anime is genre 16 (Animation) + Japanese/Korean origin
      const animeParams = {
        with_genres: '16',
        with_original_language: 'ja',
        sort_by: currentFilter === 'top_rated' ? 'vote_average.desc' : 'popularity.desc',
        page: currentPage,
        'vote_count.gte': currentFilter === 'top_rated' ? 100 : 10
      };

      if (currentFilter === 'airing') {
        animeParams.air_date_gte = new Date().toISOString().split('T')[0];
      }

      // Try TV anime first
      result = await tmdbClient.discoverTV(animeParams);
      
      // If no results, try movies
      if (!result.results || result.results.length === 0) {
        result = await tmdbClient.discoverMovie(animeParams);
      }

      const anime = result.results || [];
      
      if (reset) {
        currentAnime = anime;
      } else {
        currentAnime = [...currentAnime, ...anime];
      }

      createMediaGrid(currentAnime, grid);

      if (result.page < result.total_pages) {
        loadMoreBtn.style.display = 'block';
      } else {
        loadMoreBtn.style.display = 'none';
      }

    } catch (error) {
      console.warn('Failed to load anime:', error);
      if (reset) {
        grid.innerHTML = `
          <div class="empty-state" style="grid-column: 1 / -1;">
            <div class="empty-state-icon">🎌</div>
            <h3 class="empty-state-title">قسم الأنمي</h3>
            <p class="empty-state-description">يتم تحميل محتوى الأنمي من TMDB. الأنمي يعامل كقسم مستقل وليس مجرد أفلام/مسلسلات</p>
          </div>
        `;
      }
    }
  }

  container.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      loadAnime(true);
    });
  });

  loadMoreBtn.addEventListener('click', () => {
    currentPage++;
    loadAnime(false);
  });

  loadAnime(true);

  return container;
}
