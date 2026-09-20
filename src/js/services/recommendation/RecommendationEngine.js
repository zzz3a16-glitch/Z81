/**
 * RecommendationEngine - Smart recommendations based on taste profile
 */

import { tasteProfile } from '../behavior/UserTasteProfile.js';
import { tmdbClient } from '../tmdb/TMDBClient.js';
import { db } from '../storage/Database.js';

export class RecommendationEngine {
  constructor() {
    this.cache = new Map();
    this.cacheTTL = 30 * 60 * 1000; // 30 minutes
  }

  async getRecommendations(limit = 20, options = {}) {
    const cacheKey = `recs-${limit}-${JSON.stringify(options)}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }

    try {
      const profile = tasteProfile.getProfile();
      const recommendations = [];

      // Get user's favorite genres
      const topGenres = profile.favoriteGenres.slice(0, 3).map(g => g.id);
      
      // If no history, use trending
      if (topGenres.length === 0) {
        const trending = await tmdbClient.trending('all', 'week');
        const scored = (trending.results || []).slice(0, limit).map(item => ({
          ...item,
          recommendationScore: 70 + Math.random() * 20,
          matchPercentage: Math.round(70 + Math.random() * 20),
          reasons: ['رائج هذا الأسبوع']
        }));
        this.cache.set(cacheKey, { data: scored, timestamp: Date.now() });
        return scored;
      }

      // Discover based on favorite genres
      const discoverParams = {
        with_genres: topGenres.join(','),
        sort_by: 'popularity.desc',
        page: 1
      };

      // Add year filter if user has preference
      if (profile.favoriteDecades.length > 0) {
        const topDecade = profile.favoriteDecades[0].id;
        discoverParams['primary_release_date.gte'] = `${topDecade}-01-01`;
        discoverParams['primary_release_date.lte'] = `${topDecade + 9}-12-31`;
      }

      const [movieResults, tvResults] = await Promise.all([
        tmdbClient.discoverMovie(discoverParams).catch(() => ({ results: [] })),
        tmdbClient.discoverTV({ with_genres: topGenres.join(','), sort_by: 'popularity.desc' }).catch(() => ({ results: [] }))
      ]);

      const allResults = [...(movieResults.results || []), ...(tvResults.results || [])];
      
      // Score each result
      const scored = allResults.map(item => {
        const score = tasteProfile.getScore(item);
        return {
          ...item,
          recommendationScore: score,
          matchPercentage: score,
          reasons: tasteProfile.explainScore(item)
        };
      })
      .sort((a, b) => b.recommendationScore - a.recommendationScore)
      .slice(0, limit);

      this.cache.set(cacheKey, { data: scored, timestamp: Date.now() });
      return scored;

    } catch (error) {
      console.warn('Failed to get recommendations:', error);
      // Fallback to trending
      try {
        const trending = await tmdbClient.trending('all', 'week');
        return (trending.results || []).slice(0, limit).map(item => ({
          ...item,
          recommendationScore: 50,
          matchPercentage: 50,
          reasons: []
        }));
      } catch {
        return [];
      }
    }
  }

  async getBecauseYouWatched(mediaId, mediaType = 'movie', limit = 10) {
    try {
      const recommendations = mediaType === 'movie' 
        ? await tmdbClient.getMovieRecommendations(mediaId)
        : await tmdbClient.getTVRecommendations(mediaId);

      const results = (recommendations.results || []).slice(0, limit).map(item => ({
        ...item,
        recommendationScore: tasteProfile.getScore(item),
        matchPercentage: tasteProfile.getScore(item),
        reasons: [`لأنك شاهدت ${mediaType === 'movie' ? 'هذا الفيلم' : 'هذا المسلسل'}`]
      }));

      return results;
    } catch (error) {
      console.warn('Failed to get because you watched:', error);
      return [];
    }
  }

  async getSimilar(mediaId, mediaType = 'movie', limit = 10) {
    try {
      const similar = mediaType === 'movie'
        ? await tmdbClient.getMovieSimilar(mediaId)
        : await tmdbClient.getTVSimilar(mediaId);

      return (similar.results || []).slice(0, limit).map(item => ({
        ...item,
        recommendationScore: tasteProfile.getScore(item),
        matchPercentage: tasteProfile.getScore(item)
      }));
    } catch (error) {
      console.warn('Failed to get similar:', error);
      return [];
    }
  }

  async getContinueWatching() {
    try {
      const progress = await db.getAll('watchProgress');
      return progress
        .filter(p => p.progress > 5 && p.progress < 95)
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 10);
    } catch {
      return [];
    }
  }

  async getNewInLibrary(limit = 10) {
    try {
      const movies = await db.getAll('movies');
      return movies
        .sort((a, b) => b.addedAt - a.addedAt)
        .slice(0, limit);
    } catch {
      return [];
    }
  }

  async getDiscoverSomethingNew(limit = 10) {
    const profile = tasteProfile.getProfile();
    
    // Find genres user hasn't watched much
    const allGenres = await tmdbClient.getGenres('movie').catch(() => []);
    const watchedGenreIds = profile.favoriteGenres.map(g => g.id);
    const unwatchedGenres = allGenres.filter(g => !watchedGenreIds.includes(g.id)).slice(0, 3);

    if (unwatchedGenres.length === 0) {
      return this.getRecommendations(limit);
    }

    try {
      const discover = await tmdbClient.discoverMovie({
        with_genres: unwatchedGenres.map(g => g.id).join(','),
        sort_by: 'vote_average.desc',
        'vote_count.gte': 100,
        page: 1
      });

      return (discover.results || []).slice(0, limit).map(item => ({
        ...item,
        recommendationScore: 60,
        matchPercentage: 60,
        reasons: [`اكتشف نوع جديد: ${unwatchedGenres[0]?.name}`],
        isDiscovery: true
      }));
    } catch {
      return [];
    }
  }

  calculateScore(media, userProfile) {
    return tasteProfile.getScore(media);
  }

  clearCache() {
    this.cache.clear();
  }
}

export const recommendationEngine = new RecommendationEngine();
export default recommendationEngine;
