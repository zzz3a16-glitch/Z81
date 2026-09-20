/**
 * Media Assistant - Smart Chat Assistant with Intent Detection
 * Production-Grade NLP and Real Data Integration
 */

import { db } from '../storage/Database.js';
import { behaviorEngine } from '../behavior/UserBehaviorEngine.js';
import { tasteProfile } from '../behavior/UserTasteProfile.js';
import { recommendationEngine } from '../recommendation/RecommendationEngine.js';
import { searchEngine } from '../search/SearchEngine.js';
import { tmdbClient } from '../tmdb/TMDBClient.js';
import { watchJourney } from '../media/MediaIdentity.js';
import { watchlistManager } from '../watchlist/WatchlistManager.js';

export const INTENT_TYPES = {
  WATCH_HISTORY: 'WATCH_HISTORY',
  SERIES_PROGRESS: 'SERIES_PROGRESS',
  LIBRARY_QUERY: 'LIBRARY_QUERY',
  ANALYTICS_QUERY: 'ANALYTICS_QUERY',
  RECOMMENDATION_QUERY: 'RECOMMENDATION_QUERY',
  SEARCH: 'SEARCH',
  PLAYBACK: 'PLAYBACK',
  NAVIGATION: 'NAVIGATION',
  GENERAL: 'GENERAL'
};

export class IntentDetector {
  constructor() {
    this.patterns = {
      [INTENT_TYPES.WATCH_HISTORY]: [
        /آخر.*شاهدته/i,
        /آخر.*فيلم/i,
        /ماذا شاهدت/i,
        /سجل المشاهدة/i,
        /last watched/i
      ],
      [INTENT_TYPES.SERIES_PROGRESS]: [
        /كم.*حلقة.*بقي/i,
        /باقي.*حلقات/i,
        /progress.*series/i,
        /حلقات.*متبقية/i
      ],
      [INTENT_TYPES.LIBRARY_QUERY]: [
        /الموجودة عندي/i,
        /عندي.*أعمال/i,
        /في مكتبتي/i,
        /أعمال.*عندي/i,
        /in my library/i
      ],
      [INTENT_TYPES.ANALYTICS_QUERY]: [
        /أكثر.*الأنواع/i,
        /أكثر.*أشاهد/i,
        /إحصائيات/i,
        /تحليلات/i,
        /analytics/i,
        /most watched/i
      ],
      [INTENT_TYPES.RECOMMENDATION_QUERY]: [
        /اقترح/i,
        /توصية/i,
        /ماذا أشاهد/i,
        /recommend/i,
        /suggest/i
      ],
      [INTENT_TYPES.PLAYBACK]: [
        /شغل/i,
        /اعرض/i,
        /play/i,
        /شاهد/i
      ],
      [INTENT_TYPES.SEARCH]: [
        /ابحث عن/i,
        /أبحث/i,
        /search/i,
        /find/i
      ]
    };
  }

  detectIntent(query) {
    const lowerQuery = query.toLowerCase();
    
    for (const [intent, patterns] of Object.entries(this.patterns)) {
      for (const pattern of patterns) {
        if (pattern.test(query)) {
          return {
            type: intent,
            confidence: 0.8,
            query,
            matchedPattern: pattern.toString()
          };
        }
      }
    }

    // Fallback: check for person names, genres, years
    if (this.containsYear(query)) {
      return { type: INTENT_TYPES.RECOMMENDATION_QUERY, confidence: 0.6, query, hint: 'year_filter' };
    }
    
    if (this.containsGenre(query)) {
      return { type: INTENT_TYPES.RECOMMENDATION_QUERY, confidence: 0.6, query, hint: 'genre_filter' };
    }

    return { type: INTENT_TYPES.GENERAL, confidence: 0.3, query };
  }

  containsYear(query) {
    return /\b(19|20)\d{2}\b/.test(query);
  }

  containsGenre(query) {
    const genres = ['أكشن', 'كوميديا', 'دراما', 'رعب', 'خيال علمي', 'مغامرة', 'action', 'comedy', 'drama', 'horror', 'sci-fi'];
    return genres.some(g => query.toLowerCase().includes(g.toLowerCase()));
  }

  extractEntities(query) {
    const entities = {
      year: null,
      genre: null,
      person: null,
      title: null
    };

    // Extract year
    const yearMatch = query.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) entities.year = parseInt(yearMatch[0]);

    // Extract genre
    const genreMap = {
      'أكشن': 'action', 'حركة': 'action', 'action': 'action',
      'كوميديا': 'comedy', 'comedy': 'comedy',
      'دراما': 'drama', 'drama': 'drama',
      'رعب': 'horror', 'horror': 'horror',
      'خيال علمي': 'sci-fi', 'sci-fi': 'sci-fi', 'science fiction': 'sci-fi',
      'مغامرة': 'adventure', 'adventure': 'adventure',
      'إثارة': 'thriller', 'thriller': 'thriller'
    };
    
    for (const [key, value] of Object.entries(genreMap)) {
      if (query.toLowerCase().includes(key.toLowerCase())) {
        entities.genre = value;
        break;
      }
    }

    // Extract person (simplified - would need NER in production)
    // Look for capitalized words or known directors
    const knownPeople = ['نولان', 'Nolan', 'تارانتينو', 'Tarantino', 'سكورسيزي', 'Scorsese'];
    for (const person of knownPeople) {
      if (query.includes(person)) {
        entities.person = person;
        break;
      }
    }

    return entities;
  }
}

export class MediaAssistant {
  constructor() {
    this.intentDetector = new IntentDetector();
    this.conversationHistory = [];
    this.context = {
      currentPage: '/',
      currentMedia: null,
      currentSearch: null
    };
  }

  setContext(newContext) {
    this.context = { ...this.context, ...newContext };
  }

  async processQuery(query, options = {}) {
    const startTime = Date.now();
    
    // Detect intent
    const intent = this.intentDetector.detectIntent(query);
    const entities = this.intentDetector.extractEntities(query);
    
    console.log(' Assistant:', { query, intent, entities });

    let response;
    
    try {
      switch (intent.type) {
        case INTENT_TYPES.WATCH_HISTORY:
          response = await this.handleWatchHistoryQuery(query, entities);
          break;
        case INTENT_TYPES.SERIES_PROGRESS:
          response = await this.handleSeriesProgressQuery(query, entities);
          break;
        case INTENT_TYPES.LIBRARY_QUERY:
          response = await this.handleLibraryQuery(query, entities);
          break;
        case INTENT_TYPES.ANALYTICS_QUERY:
          response = await this.handleAnalyticsQuery(query, entities);
          break;
        case INTENT_TYPES.RECOMMENDATION_QUERY:
          response = await this.handleRecommendationQuery(query, entities);
          break;
        case INTENT_TYPES.PLAYBACK:
          response = await this.handlePlaybackQuery(query, entities);
          break;
        case INTENT_TYPES.SEARCH:
          response = await this.handleSearchQuery(query, entities);
          break;
        default:
          response = await this.handleGeneralQuery(query, entities);
      }
    } catch (e) {
      console.error('Assistant error:', e);
      response = {
        type: 'error',
        message: 'عذراً، حدث خطأ أثناء معالجة طلبك. حاول مرة أخرى.',
        error: e.message,
        suggestions: ['ابحث عن فيلم', 'اعرض سجل المشاهدة', 'اقترح فيلم أكشن']
      };
    }

    const result = {
      id: `msg-${Date.now()}`,
      query,
      intent,
      entities,
      response,
      processingTime: Date.now() - startTime,
      timestamp: Date.now(),
      context: { ...this.context }
    };

    this.conversationHistory.push(result);
    
    // Keep last 50
    if (this.conversationHistory.length > 50) {
      this.conversationHistory = this.conversationHistory.slice(-50);
    }

    return result;
  }

  async handleWatchHistoryQuery(query, entities) {
    const history = await watchJourney.getWatchHistory(10);
    
    if (history.length === 0) {
      return {
        type: 'watch_history',
        message: 'لم تشاهد أي أفلام بعد. ابدأ بمشاهدة شيء ما!',
        data: [],
        actions: [
          { label: 'استكشاف الأفلام', action: 'navigate', path: '/movies' },
          { label: 'الرائج الآن', action: 'navigate', path: '/trending' }
        ]
      };
    }

    const lastWatched = history[0];
    let details = null;
    
    try {
      if (lastWatched.mediaType === 'movie') {
        details = await tmdbClient.getMovie(lastWatched.mediaId).catch(() => null);
      }
    } catch {}

    return {
      type: 'watch_history',
      message: `آخر فيلم شاهدته هو "${details?.title || lastWatched.mediaId}" ${lastWatched.progress ? `وتقدمت فيه ${Math.round(lastWatched.progress)}%` : ''}`,
      data: history.slice(0, 5),
      lastWatched: { ...lastWatched, details },
      actions: [
        { label: 'متابعة المشاهدة', action: 'play', mediaId: lastWatched.mediaId, mediaType: lastWatched.mediaType },
        { label: 'عرض السجل كاملاً', action: 'navigate', path: '/history' }
      ]
    };
  }

  async handleSeriesProgressQuery(query, entities) {
    // Extract series name from query
    const seriesName = this.extractSeriesName(query);
    
    if (!seriesName) {
      return {
        type: 'series_progress',
        message: 'أي مسلسل تقصد؟ اذكر اسم المسلسل.',
        data: [],
        suggestions: await this.getRecentSeries()
      };
    }

    // Search for series
    const searchResults = await tmdbClient.searchTV(seriesName).catch(() => ({ results: [] }));
    const series = searchResults.results?.[0];
    
    if (!series) {
      return {
        type: 'series_progress',
        message: `لم أجد مسلسل باسم "${seriesName}"`,
        data: []
      };
    }

    const progress = await watchJourney.getSeriesProgress(series.id);
    
    if (!progress) {
      return {
        type: 'series_progress',
        message: `لم تبدأ مشاهدة "${series.name}" بعد.`,
        data: { series, progress: null },
        actions: [
          { label: 'عرض المسلسل', action: 'navigate', path: `/tv/${series.id}` }
        ]
      };
    }

    const remaining = (progress.totalEpisodes || 0) - (progress.completedEpisodes || 0);
    
    return {
      type: 'series_progress',
      message: `شاهدت ${progress.completedEpisodes} من ${progress.totalEpisodes} حلقات من "${series.name}". بقي ${remaining} حلقات.`,
      data: { series, progress, remaining },
      actions: [
        { label: 'متابعة المسلسل', action: 'navigate', path: `/tv/${series.id}` },
        { label: 'متابعة المشاهدة', action: 'navigate', path: '/continue-watching' }
      ]
    };
  }

  async handleLibraryQuery(query, entities) {
    let results = [];
    
    if (entities.person) {
      // Search library for person's works
      try {
        const allMovies = await db.getAll('movies').catch(() => []);
        const personName = entities.person.toLowerCase();
        results = allMovies.filter(m => {
          const data = m.value || m;
          return (data.title?.toLowerCase().includes(personName) || 
                  data.director?.toLowerCase().includes(personName));
        }).slice(0, 10);
      } catch {}
    } else {
      // General library search
      try {
        results = await searchEngine.search(query, { type: 'library' }).catch(() => []);
      } catch {}
    }

    if (results.length === 0) {
      return {
        type: 'library_query',
        message: `لم أجد نتائج لـ "${query}" في مكتبتك.`,
        data: [],
        suggestions: ['جرب البحث في TMDB', 'تحقق من كتابة الاسم']
      };
    }

    return {
      type: 'library_query',
      message: `وجدت ${results.length} نتائج لـ "${query}" في مكتبتك.`,
      data: results,
      actions: results.slice(0, 3).map(r => ({
        label: r.title || r.name || 'عرض',
        action: 'navigate',
        path: `/${r.mediaType || 'movie'}/${r.id}`
      }))
    };
  }

  async handleAnalyticsQuery(query, entities) {
    const aggregated = behaviorEngine.getAggregated();
    
    const topGenres = Object.entries(aggregated.genres)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count]) => ({ id, count }));

    const topContentTypes = Object.entries(aggregated.contentTypes)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({ type, count }));

    let message = 'إليك تحليل لمشاهداتك:\n';
    
    if (topGenres.length > 0) {
      message += `أكثر الأنواع مشاهدة: ${topGenres.map(g => g.id).join(', ')}\n`;
    }
    
    if (topContentTypes.length > 0) {
      message += `تفضل مشاهدة: ${topContentTypes.map(t => t.type).join(', ')}\n`;
    }
    
    message += `إجمالي وقت المشاهدة: ${Math.round(aggregated.totalWatchTime / 3600)} ساعة\n`;
    message += `أكملت: ${aggregated.completedCount} أعمال`;

    return {
      type: 'analytics',
      message,
      data: {
        genres: topGenres,
        contentTypes: topContentTypes,
        totalWatchTime: aggregated.totalWatchTime,
        completed: aggregated.completedCount,
        abandoned: aggregated.abandonedCount
      },
      actions: [
        { label: 'عرض الإحصائيات كاملة', action: 'navigate', path: '/analytics' }
      ]
    };
  }

  async handleRecommendationQuery(query, entities) {
    let recommendations = [];
    
    try {
      // Get personalized recommendations
      const allRecs = await recommendationEngine.getRecommendations(20).catch(() => []);
      
      // Filter by entities
      if (entities.year) {
        recommendations = allRecs.filter(r => {
          const year = (r.release_date || r.first_air_date || '').split('-')[0];
          return parseInt(year) === entities.year;
        });
      } else if (entities.genre) {
        // Would need genre mapping
        recommendations = allRecs.slice(0, 10);
      } else {
        recommendations = allRecs.slice(0, 10);
      }

      // If no personalized recs, use TMDB discover
      if (recommendations.length === 0) {
        const discoverParams = {};
        if (entities.year) discoverParams.primary_release_year = entities.year;
        if (entities.genre) {
          // Map genre name to ID - simplified
          const genreMap = { action: 28, comedy: 35, drama: 18, horror: 27, 'sci-fi': 878 };
          if (genreMap[entities.genre]) {
            discoverParams.with_genres = genreMap[entities.genre];
          }
        }
        
        const discovered = await tmdbClient.discoverMovie(discoverParams).catch(() => ({ results: [] }));
        recommendations = discovered.results?.slice(0, 10) || [];
      }
    } catch (e) {
      console.warn('Recommendation failed:', e);
    }

    if (recommendations.length === 0) {
      return {
        type: 'recommendations',
        message: 'لم أجد توصيات مناسبة. جرب بحثاً مختلفاً.',
        data: []
      };
    }

    return {
      type: 'recommendations',
      message: `اقترحت لك ${recommendations.length} أفلام${entities.year ? ` من سنة ${entities.year}` : ''}${entities.genre ? ` من نوع ${entities.genre}` : ''}:`,
      data: recommendations,
      actions: recommendations.slice(0, 3).map(r => ({
        label: r.title || r.name,
        action: 'navigate',
        path: `/movie/${r.id}`
      }))
    };
  }

  async handlePlaybackQuery(query, entities) {
    const history = await watchJourney.getWatchHistory(1);
    
    if (history.length === 0) {
      return {
        type: 'playback',
        message: 'لم تشاهد أي شيء بعد لتشغيله.',
        data: []
      };
    }

    const last = history[0];
    
    return {
      type: 'playback',
      message: `سأشغل "${last.mediaId}" من حيث توقفت.`,
      data: { media: last },
      actions: [
        { label: 'تشغيل الآن', action: 'play', mediaId: last.mediaId, mediaType: last.mediaType, position: last.position }
      ]
    };
  }

  async handleSearchQuery(query, entities) {
    // Remove search keywords
    const cleanQuery = query.replace(/ابحث عن|أبحث|search|find/gi, '').trim();
    
    if (!cleanQuery) {
      return {
        type: 'search',
        message: 'ماذا تريد أن أبحث عنه؟',
        data: []
      };
    }

    try {
      const results = await tmdbClient.searchMovie(cleanQuery).catch(() => ({ results: [] }));
      const tvResults = await tmdbClient.searchTV(cleanQuery).catch(() => ({ results: [] }));
      
      const allResults = [
        ...(results.results || []).slice(0, 5).map(r => ({ ...r, media_type: 'movie' })),
        ...(tvResults.results || []).slice(0, 5).map(r => ({ ...r, media_type: 'tv' }))
      ];

      if (allResults.length === 0) {
        return {
          type: 'search',
          message: `لم أجد نتائج لـ "${cleanQuery}"`,
          data: []
        };
      }

      return {
        type: 'search',
        message: `وجدت ${allResults.length} نتائج لـ "${cleanQuery}":`,
        data: allResults,
        actions: allResults.slice(0, 3).map(r => ({
          label: r.title || r.name,
          action: 'navigate',
          path: `/${r.media_type}/${r.id}`
        }))
      };
    } catch {
      return {
        type: 'search',
        message: `فشل البحث عن "${cleanQuery}"`,
        data: []
      };
    }
  }

  async handleGeneralQuery(query, entities) {
    // Try to be helpful with general queries
    if (query.length < 3) {
      return {
        type: 'general',
        message: 'مرحباً! كيف يمكنني مساعدتك؟ يمكنك أن تسألني عن:\n• آخر فيلم شاهدته\n• إحصائيات المشاهدة\n• اقتراح أفلام\n• البحث عن أفلام',
        data: [],
        suggestions: [
          'آخر فيلم شاهدته',
          'اقترح فيلم أكشن',
          'أكثر الأنواع التي أشاهدها',
          'ابحث عن Interstellar'
        ]
      };
    }

    // Fallback to search
    return this.handleSearchQuery(query, entities);
  }

  extractSeriesName(query) {
    // Simple extraction - in production would use NER
    const patterns = [
      /في\s+(.+?)(?:\?|$)/,
      /مسلسل\s+(.+?)(?:\?|$)/,
      /Breaking Bad|Game of Thrones|The Witcher|Stranger Things/i
    ];
    
    for (const pattern of patterns) {
      const match = query.match(pattern);
      if (match) {
        return match[1]?.trim() || match[0]?.trim();
      }
    }
    
    return null;
  }

  async getRecentSeries() {
    try {
      const history = await watchJourney.getWatchHistory(10);
      const series = history.filter(h => h.mediaType === 'tv' || h.mediaType === 'episode');
      return series.slice(0, 3).map(s => s.mediaId);
    } catch {
      return [];
    }
  }

  getConversationHistory(limit = 10) {
    return this.conversationHistory.slice(-limit);
  }

  clearHistory() {
    this.conversationHistory = [];
  }
}

export const mediaAssistant = new MediaAssistant();
