/**
 * MoviesPage - Movies browsing with filters and categories
 */

import { tmdbClient } from '../services/tmdb/TMDBClient.js';
import { createMediaGrid, createSkeletonGrid } from '../components/MediaCard.js';

export async function MoviesPage(params, query) {
  const container = document.createElement('div');
  container.className = 'movies-page';
  container.innerHTML = `
    <div class="container" style="padding-top: 24px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 16px;">
        <h1 style="font-size: 2rem; font-weight: 700;">🎬 الأفلام</h1>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button class="btn btn-secondary btn-sm filter-btn active" data-filter="popular">الأشهر</button>
          <button class="btn btn-secondary btn-sm filter-btn" data-filter="trending">الرائج</button>
          <button class="btn btn-secondary btn-sm filter-btn" data-filter="now_playing">يعرض الآن</button>
          <button class="btn btn-secondary btn-sm filter-btn" data-filter="upcoming">قادم قريباً</button>
          <button class="btn btn-secondary btn-sm filter-btn" data-filter="top_rated">الأعلى تقييماً</button>
        </div>
      </div>
      
      <div style="display: flex; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; align-items: center;">
        <select id="genre-filter" class="input" style="width: 200px; height: 40px;">
          <option value="">جميع الأنواع</option>
        </select>
        <select id="year-filter" class="input" style="width: 150px; height: 40px;">
          <option value="">جميع السنوات</option>
          <option value="2024">2024</option>
          <option value="2023">2023</option>
          <option value="2022">2022</option>
          <option value="2021">2021</option>
          <option value="2020">2020</option>
        </select>
        <select id="sort-filter" class="input" style="width: 200px; height: 40px;">
          <option value="popularity.desc">الأكثر شعبية</option>
          <option value="vote_average.desc">الأعلى تقييماً</option>
          <option value="release_date.desc">الأحدث</option>
          <option value="title.asc">العنوان (أ-ي)</option>
        </select>
      </div>

      <div id="movies-grid" class="media-grid"></div>
      
      <div style="display: flex; justify-content: center; margin-top: 32px; gap: 12px;">
        <button id="load-more" class="btn btn-secondary">تحميل المزيد</button>
      </div>
    </div>
  `;

  const grid = container.querySelector('#movies-grid');
  const loadMoreBtn = container.querySelector('#load-more');
  const genreFilter = container.querySelector('#genre-filter');
  const yearFilter = container.querySelector('#year-filter');
  const sortFilter = container.querySelector('#sort-filter');
  
  let currentFilter = 'popular';
  let currentPage = 1;
  let currentMovies = [];
  let isLoading = false;

  // Load genres
  try {
    const genres = await tmdbClient.getGenres('movie');
    genres.forEach(genre => {
      const option = document.createElement('option');
      option.value = genre.id;
      option.textContent = genre.name;
      genreFilter.appendChild(option);
    });
  } catch {}

  async function loadMovies(reset = true) {
    if (isLoading) return;
    isLoading = true;

    if (reset) {
      currentPage = 1;
      currentMovies = [];
      createSkeletonGrid(grid, 12);
    } else {
      loadMoreBtn.textContent = 'جاري التحميل...';
      loadMoreBtn.disabled = true;
    }

    try {
      let result;
      
      const genreId = genreFilter.value;
      const year = yearFilter.value;
      const sortBy = sortFilter.value;

      if (genreId || year || sortBy !== 'popularity.desc' || currentFilter === 'discover') {
        const params = {
          page: currentPage,
          sort_by: sortBy
        };
        
        if (genreId) params.with_genres = genreId;
        if (year) params.primary_release_year = year;
        
        result = await tmdbClient.discoverMovie(params);
      } else {
        switch (currentFilter) {
          case 'popular':
            result = await tmdbClient.popularMovies(currentPage);
            break;
          case 'trending':
            result = await tmdbClient.trending('movie', 'week', currentPage);
            break;
          case 'now_playing':
            result = await tmdbClient.nowPlaying(currentPage);
            break;
          case 'upcoming':
            result = await tmdbClient.upcoming(currentPage);
            break;
          case 'top_rated':
            result = await tmdbClient.topRatedMovies(currentPage);
            break;
          default:
            result = await tmdbClient.popularMovies(currentPage);
        }
      }

      const movies = result.results || [];
      
      if (reset) {
        currentMovies = movies;
      } else {
        currentMovies = [...currentMovies, ...movies];
      }

      createMediaGrid(currentMovies, grid);

      // Show/hide load more
      if (result.page < result.total_pages) {
        loadMoreBtn.style.display = 'block';
        loadMoreBtn.textContent = 'تحميل المزيد';
        loadMoreBtn.disabled = false;
      } else {
        loadMoreBtn.style.display = 'none';
      }

    } catch (error) {
      console.warn('Failed to load movies:', error);
      if (reset) {
        grid.innerHTML = `
          <div class="empty-state" style="grid-column: 1 / -1;">
            <div class="empty-state-icon">⚠️</div>
            <h3 class="empty-state-title">تعذر تحميل الأفلام</h3>
            <p class="empty-state-description">تحقق من اتصالك بالإنترنت وإعدادات TMDB</p>
            <button class="btn btn-primary" onclick="window.location.reload()">إعادة المحاولة</button>
          </div>
        `;
      }
    } finally {
      isLoading = false;
    }
  }

  // Event listeners
  container.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      loadMovies(true);
    });
  });

  loadMoreBtn.addEventListener('click', () => {
    currentPage++;
    loadMovies(false);
  });

  [genreFilter, yearFilter, sortFilter].forEach(filter => {
    filter.addEventListener('change', () => {
      currentFilter = 'discover';
      loadMovies(true);
    });
  });

  // Initial load
  loadMovies(true);

  return container;
}
