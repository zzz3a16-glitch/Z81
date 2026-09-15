/**
 * SearchEngine - Advanced search with intent detection and NLP
 */

import { tmdbClient } from '../tmdb/TMDBClient.js';
import { behaviorEngine } from '../behavior/UserBehaviorEngine.js';
import { db } from '../storage/Database.js';

export class SearchEngine {
  constructor() {
    this.debounceTimer = null;
    this.debounceDelay = 300;
    this.lastQuery = '';
  }

  // Debounced search
  async search(query, type = 'multi', page = 1) {
    if (!query?.trim()) {
      return { results: [], total_pages: 0, total_results: 0 };
    }

    const trimmed = query.trim();
    
    // Track search behavior
    behaviorEngine.track('SEARCHED', { query: trimmed, type, page });

    try {
      let result;
      
      switch (type) {
        case 'movie':
          result = await tmdbClient.searchMovie(trimmed, page);
          break;
        case 'tv':
          result = await tmdbClient.searchTV(trimmed, page);
          break;
        case 'person':
          result = await tmdbClient.searchPerson(trimmed, page);
          break;
        case 'multi':
        default:
          result = await tmdbClient.searchMulti(trimmed, page);
          break;
      }

      return result;
    } catch (error) {
      console.warn('Search failed:', error);
      return { results: [], total_pages: 0, total_results: 0, error: error.message };
    }
  }

  // Debounced wrapper
  debouncedSearch(query, callback, type = 'multi') {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(async () => {
      const result = await this.search(query, type);
      callback(result);
    }, this.debounceDelay);
  }

  // Smart search with intent detection (Arabic + English)
  async smartSearch(query) {
    const intent = this.detectIntent(query);
    
    switch (intent.type) {
      case 'WATCH_HISTORY':
        return this.handleWatchHistoryIntent();
      
      case 'SERIES_PROGRESS':
        return this.handleSeriesProgressIntent(intent.entities);
      
      case 'LIBRARY_QUERY':
        return this.handleLibraryQueryIntent(intent.entities);
      
      case 'ANALYTICS_QUERY':
        return this.handleAnalyticsQueryIntent();
      
      case 'RECOMMENDATION_QUERY':
        return this.handleRecommendationQueryIntent(intent.entities);
      
      case 'PERSON_QUERY':
        return this.handlePersonQueryIntent(intent.entities);
      
      case 'GENRE_QUERY':
        return this.handleGenreQueryIntent(intent.entities);
      
      default:
        return this.search(query, 'multi');
    }
  }

  detectIntent(query) {
    const lower = query.toLowerCase().trim();
    
    // Arabic intents
    const intents = [
      {
        keywords: ['آخر فيلم شاهدته', 'اخر فيلم', 'آخر ما شاهدت'],
        type: 'WATCH_HISTORY'
      },
      {
        keywords: ['كم حلقة بقيت', 'كم حلقة بقى', 'متبقي', 'الحلقات المتبقية'],
        type: 'SERIES_PROGRESS',
        extract: (q) => {
          // Try to extract series name
          const match = q.match(/(?:في|من)\s+(.+?)(?:\؟|$)/);
          return { seriesName: match ? match[1].trim() : null };
        }
      },
      {
        keywords: ['أعمال', 'افلام', 'أفلام', 'مسلسلات', 'الموجودة عندي', 'عندي'],
        type: 'LIBRARY_QUERY',
        extract: (q) => {
          // Extract person or genre
          return { query: q.replace(/أعمال|الموجودة عندي|عندي/g, '').trim() };
        }
      },
      {
        keywords: ['أكثر الأنواع', 'اكثر الانواع', 'إحصائيات', 'احصائيات', 'ماذا أشاهد'],
        type: 'ANALYTICS_QUERY'
      },
      {
        keywords: ['اقترح', 'اقترح لي', 'رشح', 'توصية', 'ماذا أشاهد'],
        type: 'RECOMMENDATION_QUERY',
        extract: (q) => {
          const genreMatch = q.match(/(?:فيلم|مسلسل)\s+(\w+)/);
          const yearMatch = q.match(/(\d{4})/);
          return {
            genre: genreMatch ? genreMatch[1] : null,
            year: yearMatch ? yearMatch[1] : null,
            fullQuery: q
          };
        }
      },
      {
        keywords: ['ممثل', 'مخرج', 'بطولة'],
        type: 'PERSON_QUERY',
        extract: (q) => ({ personName: q.replace(/ممثل|مخرج|بطولة/g, '').trim() })
      }
    ];

    for (const intent of intents) {
      if (intent.keywords.some(kw => lower.includes(kw.toLowerCase()))) {
        return {
          type: intent.type,
          entities: intent.extract ? intent.extract(query) : {},
          confidence: 0.8,
          originalQuery: query
        };
      }
    }

    // Check for year
    if (/\b(19|20)\d{2}\b/.test(query)) {
      return {
        type: 'YEAR_QUERY',
        entities: { year: query.match(/\b(19|20)\d{2}\b/)[0] },
        confidence: 0.7,
        originalQuery: query
      };
    }

    return {
      type: 'GENERAL_SEARCH',
      entities: {},
      confidence: 0.5,
      originalQuery: query
    };
  }

  async handleWatchHistoryIntent() {
    const history = behaviorEngine.getWatchHistory(10);
    const mediaIds = history.map(h => h.metadata.mediaId).filter(Boolean);
    
    // Try to get details for these
    const results = [];
    for (const id of mediaIds.slice(0, 5)) {
      try {
        const movie = await tmdbClient.getMovie(id).catch(() => null);
        if (movie) results.push(movie);
      } catch {}
    }

    return {
      type: 'watch_history',
      results,
      message: 'آخر ما شاهدته'
    };
  }

  async handleSeriesProgressIntent(entities) {
    if (!entities.seriesName) {
      return { type: 'series_progress', results: [], message: 'يرجى تحديد اسم المسلسل' };
    }

    try {
      const search = await tmdbClient.searchTV(entities.seriesName);
      if (search.results?.length > 0) {
        const series = search.results[0];
        // Get watch progress for this series
        const progress = await db.getByIndex('watchProgress', 'mediaId', series.id.toString()).catch(() => []);
        return {
          type: 'series_progress',
          results: [series],
          progress,
          message: `تقدمك في ${series.name}`
        };
      }
    } catch (e) {
      console.warn('Series progress intent failed:', e);
    }

    return { type: 'series_progress', results: [], message: 'لم يتم العثور على المسلسل' };
  }

  async handleLibraryQueryIntent(entities) {
    const query = entities.query;
    if (!query) return { type: 'library', results: [] };

    // Search in local DB first
    try {
      const localMovies = await db.getAll('movies');
      const filtered = localMovies.filter(m => 
        m.title?.toLowerCase().includes(query.toLowerCase()) ||
        m.original_title?.toLowerCase().includes(query.toLowerCase())
      );

      if (filtered.length > 0) {
        return { type: 'library', results: filtered, message: `موجود في مكتبتك: ${query}` };
      }
    } catch {}

    // Fallback to TMDB
    return this.search(query, 'multi');
  }

  async handleAnalyticsQueryIntent() {
    const profile = await import('../behavior/UserTasteProfile.js').then(m => m.tasteProfile.getProfile());
    
    return {
      type: 'analytics',
      profile,
      message: 'إحصائيات المشاهدة',
      results: []
    };
  }

  async handleRecommendationQueryIntent(entities) {
    const { genre, year } = entities;
    
    let params = { sort_by: 'popularity.desc', page: 1 };
    
    if (genre) {
      // Map Arabic genre names to IDs
      const genreMap = {
        'اكشن': 28, 'أكشن': 28, 'action': 28,
        'كوميدي': 35, 'كوميديا': 35, 'comedy': 35,
        'دراما': 18, 'drama': 18,
        'رعب': 27, 'horror': 27,
        'خيال علمي': 878, 'sci-fi': 878, 'sci fi': 878,
        'مغامرة': 12, 'adventure': 12
      };
      
      const genreId = genreMap[genre.toLowerCase()];
      if (genreId) {
        params.with_genres = genreId;
      }
    }

    if (year) {
      params.primary_release_year = year;
    }

    try {
      const result = await tmdbClient.discoverMovie(params);
      return {
        type: 'recommendation',
        results: result.results || [],
        message: `اقتراحات ${genre || ''} ${year || ''}`.trim(),
        params
      };
    } catch {
      return { type: 'recommendation', results: [], message: 'تعذر جلب التوصيات' };
    }
  }

  async handlePersonQueryIntent(entities) {
    if (!entities.personName) return { type: 'person', results: [] };
    return this.search(entities.personName, 'person');
  }

  async handleGenreQueryIntent(entities) {
    return this.search(entities.query || '', 'movie');
  }

  // Local search
  async searchLocal(query) {
    try {
      const [movies, tvshows] = await Promise.all([
        db.getAll('movies').catch(() => []),
        db.getAll('tvshows').catch(() => [])
      ]);

      const lower = query.toLowerCase();
      const results = [
        ...movies.filter(m => 
          m.title?.toLowerCase().includes(lower) ||
          m.original_title?.toLowerCase().includes(lower)
        ).map(m => ({ ...m, media_type: 'movie', isLocal: true })),
        ...tvshows.filter(t => 
          t.name?.toLowerCase().includes(lower) ||
          t.original_name?.toLowerCase().includes(lower)
        ).map(t => ({ ...t, media_type: 'tv', isLocal: true }))
      ];

      return results;
    } catch {
      return [];
    }
  }

  // Get search suggestions
  async getSuggestions(query, limit = 5) {
    if (!query || query.length < 2) return [];

    const recent = behaviorEngine.getRecentSearches(limit);
    const filtered = recent.filter(r => 
      r.metadata.query.toLowerCase().includes(query.toLowerCase())
    ).map(r => r.metadata.query);

    return [...new Set(filtered)].slice(0, limit);
  }
}

export const searchEngine = new SearchEngine();
export default searchEngine;
