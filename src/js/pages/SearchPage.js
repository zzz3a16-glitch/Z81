/**
 * SearchPage - Advanced search with filters
 */

import { searchEngine } from '../services/search/SearchEngine.js';
import { createMediaGrid, createSkeletonGrid } from '../components/MediaCard.js';

export async function SearchPage(params, query) {
  const initialQuery = query.q || params.query || '';
  
  const container = document.createElement('div');
  container.className = 'search-page';
  container.innerHTML = `
    <div class="container" style="padding-top: 24px;">
      <h1 style="font-size: 2rem; font-weight: 700; margin-bottom: 24px;">🔍 البحث</h1>
      
      <div style="display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap;">
        <div style="flex: 1; min-width: 300px; position: relative;">
          <input 
            type="text" 
            id="search-input" 
            class="input" 
            placeholder="ابحث عن أفلام، مسلسلات، أشخاص..."
            value="${initialQuery}"
            style="padding-right: 44px;"
          />
          <span style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); color: var(--color-text-muted);">🔍</span>
        </div>
        <select id="search-type" class="input" style="width: 150px;">
          <option value="multi">الكل</option>
          <option value="movie">أفلام</option>
          <option value="tv">مسلسلات</option>
          <option value="person">أشخاص</option>
        </select>
        <button id="search-btn" class="btn btn-primary">بحث</button>
      </div>

      <div style="display: flex; gap: 8px; margin-bottom: 24px; flex-wrap: wrap;" id="quick-searches">
        <span style="font-size: 13px; color: var(--color-text-muted); padding: 8px 0;">بحث سريع:</span>
        <button class="btn btn-ghost btn-sm quick-search" data-query="أكشن">أكشن</button>
        <button class="btn btn-ghost btn-sm quick-search" data-query="كوميديا">كوميديا</button>
        <button class="btn btn-ghost btn-sm quick-search" data-query="دراما">دراما</button>
        <button class="btn btn-ghost btn-sm quick-search" data-query="خيال علمي">خيال علمي</button>
        <button class="btn btn-ghost btn-sm quick-search" data-query="رعب">رعب</button>
      </div>

      <div id="search-results">
        <div class="empty-state">
          <div class="empty-state-icon">🔍</div>
          <h3 class="empty-state-title">ابحث عن محتوى</h3>
          <p class="empty-state-description">اكتب كلمة البحث أعلاه للبدء. يمكنك أيضاً استخدام البحث الذكي مثل "اقترح فيلم أكشن من 2024"</p>
        </div>
      </div>
    </div>
  `;

  const searchInput = container.querySelector('#search-input');
  const searchType = container.querySelector('#search-type');
  const searchBtn = container.querySelector('#search-btn');
  const resultsContainer = container.querySelector('#search-results');

  async function performSearch(query, type = 'multi') {
    if (!query?.trim()) {
      resultsContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔍</div>
          <h3 class="empty-state-title">ابحث عن محتوى</h3>
          <p class="empty-state-description">اكتب كلمة البحث للبدء</p>
        </div>
      `;
      return;
    }

    resultsContainer.innerHTML = `
      <div style="margin-bottom: 16px; color: var(--color-text-secondary);">جاري البحث عن "${query}"...</div>
      <div class="media-grid" id="results-grid"></div>
    `;
    
    const grid = resultsContainer.querySelector('#results-grid');
    createSkeletonGrid(grid, 12);

    try {
      // Try smart search first
      let result;
      
      if (query.length > 5) {
        const smartResult = await searchEngine.smartSearch(query);
        if (smartResult.type && smartResult.type !== 'GENERAL_SEARCH') {
          result = smartResult;
          
          if (smartResult.results && smartResult.results.length > 0) {
            resultsContainer.innerHTML = `
              <div style="margin-bottom: 16px; padding: 12px; background: var(--color-card); border: 1px solid var(--color-border); border-radius: 8px;">
                <div style="font-weight: 600; margin-bottom: 4px;">${smartResult.message || 'نتائج البحث الذكي'}</div>
                <div style="font-size: 13px; color: var(--color-text-secondary);">نوع: ${smartResult.type}</div>
              </div>
              <div class="media-grid" id="results-grid"></div>
            `;
            createMediaGrid(smartResult.results, resultsContainer.querySelector('#results-grid'));
            return;
          }
        }
      }

      // Regular search
      result = await searchEngine.search(query, type);
      
      if (!result.results || result.results.length === 0) {
        resultsContainer.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">😕</div>
            <h3 class="empty-state-title">لا توجد نتائج</h3>
            <p class="empty-state-description">لم نجد أي نتائج لـ "${query}". جرب كلمات مختلفة</p>
          </div>
        `;
        return;
      }

      resultsContainer.innerHTML = `
        <div style="margin-bottom: 16px; color: var(--color-text-secondary);">تم العثور على ${result.total_results || result.results.length} نتيجة لـ "${query}"</div>
        <div class="media-grid" id="results-grid"></div>
      `;
      
      createMediaGrid(result.results, resultsContainer.querySelector('#results-grid'));

    } catch (error) {
      console.warn('Search failed:', error);
      resultsContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⚠️</div>
          <h3 class="empty-state-title">فشل البحث</h3>
          <p class="empty-state-description">${error.message || 'حدث خطأ أثناء البحث'}</p>
        </div>
      `;
    }
  }

  searchBtn.addEventListener('click', () => {
    performSearch(searchInput.value, searchType.value);
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      performSearch(searchInput.value, searchType.value);
    }
  });

  container.querySelectorAll('.quick-search').forEach(btn => {
    btn.addEventListener('click', () => {
      searchInput.value = btn.dataset.query;
      performSearch(btn.dataset.query, searchType.value);
    });
  });

  // Initial search if query provided
  if (initialQuery) {
    performSearch(initialQuery, searchType.value);
  }

  return container;
}
