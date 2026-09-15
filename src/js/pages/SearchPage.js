/**
 * SearchPage - Production Advanced Search with NLP, Typo Tolerance, Local-First
 */

import { searchEngine } from '../services/search/SearchEngine.js';
import { advancedSearch } from '../services/search/AdvancedSearch.js';
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

  // Suggestions container
  const suggestionsContainer = document.createElement('div');
  suggestionsContainer.id = 'search-suggestions';
  suggestionsContainer.style.cssText = 'position: absolute; top: 100%; left: 0; right: 0; z-index: 10; background: var(--color-card); border: 1px solid var(--color-border); border-radius: 12px; margin-top: 8px; box-shadow: var(--shadow-lg); display: none; overflow: hidden;';
  searchInput.parentElement.style.position = 'relative';
  searchInput.parentElement.appendChild(suggestionsContainer);

  async function performSearch(query, type = 'multi') {
    if (!query?.trim()) {
      resultsContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔍</div>
          <h3 class="empty-state-title">ابحث عن محتوى</h3>
          <p class="empty-state-description">اكتب كلمة البحث للبدء. جرب:<br>
          <span style="display: inline-block; margin: 4px; padding: 6px 12px; background: var(--color-surface); border-radius: 20px; font-size: 12px;">أفلام أكشن من 2023</span>
          <span style="display: inline-block; margin: 4px; padding: 6px 12px; background: var(--color-surface); border-radius: 20px; font-size: 12px;">أفلام ليوناردو دي كابريو</span>
          <span style="display: inline-block; margin: 4px; padding: 6px 12px; background: var(--color-surface); border-radius: 20px; font-size: 12px;">مسلسلات كوميدية جديدة</span>
          </p>
        </div>
      `;
      suggestionsContainer.style.display = 'none';
      return;
    }

    resultsContainer.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
        <div style="color: var(--color-text-secondary);">جاري البحث الذكي عن "${query}"...</div>
        <div class="spinner" style="width: 16px; height: 16px; border: 2px solid var(--color-border); border-top-color: var(--color-accent); border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
      </div>
      <div class="media-grid" id="results-grid"></div>
    `;
    
    const grid = resultsContainer.querySelector('#results-grid');
    createSkeletonGrid(grid, 12);
    suggestionsContainer.style.display = 'none';

    try {
      // Unified search: local + NLP + TMDB
      const unified = await advancedSearch.unifiedSearch(query, { 
        includeLocal: true, 
        includeNatural: true, 
        includeTMDB: true,
        page: 1,
        limit: 24
      });

      // If natural language parsing found structured query, show it
      const parsed = unified.natural?.parsed;
      let parsedInfo = '';
      if (parsed && (parsed.genres.length > 0 || parsed.year || parsed.person || parsed.rating)) {
        const parts = [];
        if (parsed.genres.length) parts.push(`النوع: ${parsed.genres.map(g => g.ar).join('، ')}`);
        if (parsed.year) parts.push(`السنة: ${parsed.year}`);
        if (parsed.yearRange) parts.push(`من ${parsed.yearRange.from} إلى ${parsed.yearRange.to}`);
        if (parsed.person) parts.push(`الشخص: ${parsed.person}`);
        if (parsed.rating) parts.push(`التقييم: +${parsed.rating}`);
        if (parsed.isNew) parts.push('جديد');
        if (parsed.isOld) parts.push('كلاسيكي');
        parsedInfo = parts.join(' • ');
      }

      if (!unified.combined || unified.combined.length === 0) {
        // Try typo corrections
        const corrections = await advancedSearch.getSmartSuggestions(query, 3);
        resultsContainer.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">😕</div>
            <h3 class="empty-state-title">لا توجد نتائج</h3>
            <p class="empty-state-description">لم نجد أي نتائج لـ "${query}"</p>
            ${corrections.length ? `
              <div style="margin-top: 16px;">
                <div style="font-size: 13px; color: var(--color-text-muted); margin-bottom: 8px;">هل تقصد:</div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap; justify-content: center;">
                  ${corrections.map(c => `<button class="btn btn-sm btn-ghost suggestion-correction" data-query="${c}">${c}</button>`).join('')}
                </div>
              </div>
            ` : ''}
          </div>
        `;
        
        resultsContainer.querySelectorAll('.suggestion-correction').forEach(btn => {
          btn.addEventListener('click', () => {
            searchInput.value = btn.dataset.query;
            performSearch(btn.dataset.query, type);
          });
        });
        return;
      }

      // Show results with source info
      const localCount = unified.local?.results?.length || 0;
      const tmdbCount = unified.combined.length - localCount;

      resultsContainer.innerHTML = `
        ${parsedInfo ? `
          <div style="margin-bottom: 16px; padding: 12px 16px; background: linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 10%, transparent), color-mix(in srgb, var(--color-accent-secondary) 10%, transparent)); border: 1px solid color-mix(in srgb, var(--color-accent) 20%, transparent); border-radius: 12px; display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 1.2rem;">🧠</span>
            <div style="flex: 1;">
              <div style="font-weight: 600; font-size: 13px; margin-bottom: 2px;">فهم ذكي للبحث</div>
              <div style="font-size: 12px; color: var(--color-text-secondary);">${parsedInfo}</div>
            </div>
            ${unified.natural?.person ? `<span style="padding: 4px 8px; background: var(--color-accent); color: white; border-radius: 20px; font-size: 11px;">${unified.natural.person.name || unified.natural.person}</span>` : ''}
          </div>
        ` : ''}
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 8px;">
          <div style="color: var(--color-text-secondary); font-size: 14px;">
            تم العثور على <strong style="color: var(--color-text-primary);">${unified.total_results}</strong> نتيجة لـ "${query}"
            ${localCount ? `<span style="margin-right: 8px; padding: 2px 8px; background: var(--color-accent); color: white; border-radius: 10px; font-size: 11px;">${localCount} محلي</span>` : ''}
          </div>
          <div style="display: flex; gap: 6px;">
            <span style="font-size: 11px; padding: 4px 8px; background: var(--color-surface); border-radius: 12px; border: 1px solid var(--color-border);">محلي + TMDB + ذكاء</span>
          </div>
        </div>
        <div class="media-grid" id="results-grid"></div>
      `;
      
      createMediaGrid(unified.combined, resultsContainer.querySelector('#results-grid'));

      // Show local indicator
      if (localCount > 0) {
        const gridEl = resultsContainer.querySelector('#results-grid');
        const cards = gridEl.querySelectorAll('.media-card');
        unified.combined.forEach((item, idx) => {
          if (item.isLocal || item._type) {
            const card = cards[idx];
            if (card) {
              const badge = document.createElement('div');
              badge.style.cssText = 'position: absolute; top: 8px; left: 8px; background: var(--color-accent); color: white; padding: 2px 6px; border-radius: 6px; font-size: 10px; font-weight: 600; z-index: 2;';
              badge.textContent = 'محلي';
              card.style.position = 'relative';
              card.appendChild(badge);
            }
          }
        });
      }

    } catch (error) {
      console.warn('Advanced search failed:', error);
      // Fallback to basic search
      try {
        const fallback = await searchEngine.search(query, type);
        if (fallback.results?.length) {
          resultsContainer.innerHTML = `
            <div style="margin-bottom: 16px; padding: 8px 12px; background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 8px; font-size: 12px;">⚠️ البحث المتقدم غير متاح، تم استخدام البحث الأساسي</div>
            <div class="media-grid" id="results-grid"></div>
          `;
          createMediaGrid(fallback.results, resultsContainer.querySelector('#results-grid'));
          return;
        }
      } catch {}
      
      resultsContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⚠️</div>
          <h3 class="empty-state-title">فشل البحث</h3>
          <p class="empty-state-description">${error.message || 'حدث خطأ أثناء البحث'}</p>
          <button class="btn btn-primary" onclick="window.location.reload()" style="margin-top: 16px;">إعادة المحاولة</button>
        </div>
      `;
    }
  }

  // Smart suggestions with debounce
  let suggestionTimeout;
  searchInput.addEventListener('input', () => {
    clearTimeout(suggestionTimeout);
    const q = searchInput.value.trim();
    if (q.length < 2) {
      suggestionsContainer.style.display = 'none';
      return;
    }

    suggestionTimeout = setTimeout(async () => {
      try {
        const suggestions = await advancedSearch.getSmartSuggestions(q, 5);
        if (suggestions.length === 0) {
          suggestionsContainer.style.display = 'none';
          return;
        }

        suggestionsContainer.innerHTML = suggestions.map(s => `
          <div class="search-suggestion-item" data-query="${s}" style="padding: 12px 16px; cursor: pointer; display: flex; align-items: center; gap: 12px; transition: background 0.2s;" onmouseover="this.style.background='var(--color-surface-hover)'" onmouseout="this.style.background='transparent'">
            <span style="width: 32px; height: 32px; background: var(--color-surface); border-radius: 8px; display: flex; align-items: center; justify-content: center;">🔍</span>
            <span style="flex: 1; font-size: 14px;">${s}</span>
            <span style="font-size: 12px; color: var(--color-text-muted);">اقتراح</span>
          </div>
        `).join('');
        
        suggestionsContainer.style.display = 'block';
        
        suggestionsContainer.querySelectorAll('.search-suggestion-item').forEach(el => {
          el.addEventListener('click', () => {
            searchInput.value = el.dataset.query;
            suggestionsContainer.style.display = 'none';
            performSearch(el.dataset.query, searchType.value);
          });
        });
      } catch {
        suggestionsContainer.style.display = 'none';
      }
    }, 300);
  });

  // Hide suggestions when clicking outside
  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !suggestionsContainer.contains(e.target)) {
      suggestionsContainer.style.display = 'none';
    }
  });

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
