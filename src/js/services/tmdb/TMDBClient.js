/**
 * TMDBClient - Production-Grade TMDB API Client
 * Implements rate limiting, caching, retry logic, and error handling
 */

import { TMDB_CONFIG, TMDB_ENDPOINTS } from '../../config/tmdb.config.js';
import { TMDBCache, MetadataCache, SearchCache, ConfigCache } from './TMDBCache.js';
import { tmdbImage } from './TMDBImage.js';
import { isDesktop, api } from '../../bridge.js';

class RequestQueue {
  constructor(requestsPerSecond = 40) {
    this.queue = [];
    this.processing = false;
    this.requestsPerSecond = requestsPerSecond;
    this.lastRequestTime = 0;
    this.minInterval = 1000 / requestsPerSecond;
  }

  async add(requestFn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ requestFn, resolve, reject });
      this.process();
    });
  }

  async process() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      
      if (timeSinceLastRequest < this.minInterval) {
        await new Promise(r => setTimeout(r, this.minInterval - timeSinceLastRequest));
      }

      const { requestFn, resolve, reject } = this.queue.shift();
      this.lastRequestTime = Date.now();

      try {
        const result = await requestFn();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }
    
    this.processing = false;
  }
}

export class TMDBClient {
  constructor(config = TMDB_CONFIG) {
    this.config = config;
    this.baseUrl = config.baseUrl;
    this.apiKey = config.apiKey;
    
    // Caches
    this.metadataCache = new MetadataCache();
    this.searchCache = new SearchCache();
    this.configCache = new ConfigCache();
    this.generalCache = new TMDBCache({ storageKey: 'zpopcorn-general-cache', maxSize: 200 });
    
    // Request queue for rate limiting
    this.queue = new RequestQueue(config.rateLimit.requestsPerSecond);
    
    // Configuration
    this.tmdbConfig = null;
    this.genres = { movie: [], tv: [] };
    
    // Stats
    this.stats = {
      requests: 0,
      cacheHits: 0,
      errors: 0
    };

    // Initialize
    this.init();
  }

  async init() {
    try {
      await this.loadConfiguration();
      await this.loadGenres();
    } catch (error) {
      console.warn('TMDB initialization failed, using defaults:', error);
    }
  }

  updateApiKey(newKey) {
    this.apiKey = newKey;
    localStorage.setItem('zpopcorn-tmdb-api-key', newKey);
  }

  async request(endpoint, params = {}, options = {}) {
    const {
      useCache = true,
      cacheTTL = null,
      retries = this.config.rateLimit.maxRetries,
      appendToResponse = []
    } = options;

    // Desktop mode: ALL TMDB traffic is centralized in main (cache-first,
    // rate-limited, offline-aware). Renderer never fetches (spec 19/20).
    if (isDesktop) {
      const p = { ...params };
      if (appendToResponse.length > 0) {
        p.append_to_response = appendToResponse.join(',');
      }
      this.stats.requests++;
      return api.metadata.request(endpoint, p, { force: options.force === true });
    }

    // Build cache key
    const cacheKey = this.generalCache.generateKey(endpoint, { ...params, append: appendToResponse.join(',') });
    
    // Check cache (browser mode only — main handles caching on desktop)
    if (useCache && !isDesktop) {
      const cached = this.generalCache.get(cacheKey) || this.metadataCache.get(cacheKey);
      if (cached) {
        this.stats.cacheHits++;
        return cached;
      }
    }

    // Build URL
    const urlParams = new URLSearchParams({
      api_key: this.apiKey,
      language: params.language || this.config.defaultLanguage,
      region: params.region || this.config.defaultRegion,
      ...params
    });

    if (appendToResponse.length > 0) {
      urlParams.set('append_to_response', appendToResponse.join(','));
    }

    // Remove undefined params
    for (const [key, value] of urlParams.entries()) {
      if (value === undefined || value === null || value === 'undefined') {
        urlParams.delete(key);
      }
    }

    const url = `${this.baseUrl}${endpoint}?${urlParams.toString()}`;

    // Execute with queue and retry logic
    const executeRequest = async (attempt = 0) => {
      try {
        this.stats.requests++;
        
        const response = await fetch(url, {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          if (response.status === 429 && attempt < retries) {
            // Rate limited, wait and retry
            const retryAfter = response.headers.get('Retry-After') || 2;
            await new Promise(r => setTimeout(r, parseInt(retryAfter) * 1000));
            return executeRequest(attempt + 1);
          }
          
          if (response.status >= 500 && attempt < retries) {
            // Server error, retry with exponential backoff
            await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
            return executeRequest(attempt + 1);
          }

          throw new Error(`TMDB API Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        // Cache the result
        if (useCache) {
          const ttl = cacheTTL || this.config.cacheTTL.movie || 6 * 60 * 60 * 1000;
          this.generalCache.set(cacheKey, data, ttl);
        }

        return data;
      } catch (error) {
        if (attempt < retries && error.name !== 'AbortError') {
          await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
          return executeRequest(attempt + 1);
        }
        this.stats.errors++;
        throw error;
      }
    };

    try {
      return await this.queue.add(() => executeRequest());
    } catch (error) {
      console.error(`TMDB request failed for ${endpoint}:`, error);
      
      // Try to return cached data even if expired as fallback
      const staleCache = this.generalCache.cache.get(cacheKey);
      if (staleCache) {
        console.warn('Returning stale cache for', endpoint);
        return staleCache.data;
      }
      
      throw error;
    }
  }

  // Configuration
  async loadConfiguration() {
    const cacheKey = 'tmdb-configuration';
    const cached = this.configCache.get(cacheKey);
    
    if (cached) {
      this.tmdbConfig = cached;
      tmdbImage.setConfig(cached);
      return cached;
    }

    try {
      const config = await this.request(TMDB_ENDPOINTS.configuration, {}, { useCache: false });
      this.tmdbConfig = config;
      tmdbImage.setConfig(config);
      this.configCache.set(cacheKey, config, this.config.cacheTTL.configuration);
      return config;
    } catch (error) {
      console.warn('Failed to load TMDB configuration:', error);
      return null;
    }
  }

  async getConfiguration() {
    if (this.tmdbConfig) return this.tmdbConfig;
    return this.loadConfiguration();
  }

  // Genres
  async loadGenres() {
    try {
      const [movieGenres, tvGenres] = await Promise.all([
        this.request(TMDB_ENDPOINTS.genres.movie, {}, { cacheTTL: this.config.cacheTTL.genres }),
        this.request(TMDB_ENDPOINTS.genres.tv, {}, { cacheTTL: this.config.cacheTTL.genres })
      ]);

      this.genres = {
        movie: movieGenres.genres || [],
        tv: tvGenres.genres || []
      };

      return this.genres;
    } catch (error) {
      console.warn('Failed to load genres:', error);
      return this.genres;
    }
  }

  async getGenres(type = 'movie') {
    if (this.genres[type]?.length > 0) {
      return this.genres[type];
    }
    await this.loadGenres();
    return this.genres[type] || [];
  }

  // Search
  async searchMovie(query, page = 1, options = {}) {
    if (!query?.trim()) return { results: [], total_pages: 0, total_results: 0 };
    
    const cacheKey = `search-movie-${query}-${page}`;
    const cached = this.searchCache.get(cacheKey);
    if (cached) return cached;

    const result = await this.request(TMDB_ENDPOINTS.search.movie, {
      query: query.trim(),
      page,
      include_adult: false,
      ...options
    }, { cacheTTL: this.config.cacheTTL.search });

    this.searchCache.set(cacheKey, result, this.config.cacheTTL.search);
    return result;
  }

  async searchTV(query, page = 1, options = {}) {
    if (!query?.trim()) return { results: [], total_pages: 0, total_results: 0 };
    
    const cacheKey = `search-tv-${query}-${page}`;
    const cached = this.searchCache.get(cacheKey);
    if (cached) return cached;

    const result = await this.request(TMDB_ENDPOINTS.search.tv, {
      query: query.trim(),
      page,
      include_adult: false,
      ...options
    }, { cacheTTL: this.config.cacheTTL.search });

    this.searchCache.set(cacheKey, result, this.config.cacheTTL.search);
    return result;
  }

  async searchPerson(query, page = 1) {
    if (!query?.trim()) return { results: [], total_pages: 0, total_results: 0 };
    
    const cacheKey = `search-person-${query}-${page}`;
    const cached = this.searchCache.get(cacheKey);
    if (cached) return cached;

    const result = await this.request(TMDB_ENDPOINTS.search.person, {
      query: query.trim(),
      page
    }, { cacheTTL: this.config.cacheTTL.search });

    this.searchCache.set(cacheKey, result, this.config.cacheTTL.search);
    return result;
  }

  async searchMulti(query, page = 1) {
    if (!query?.trim()) return { results: [], total_pages: 0, total_results: 0 };
    
    const cacheKey = `search-multi-${query}-${page}`;
    const cached = this.searchCache.get(cacheKey);
    if (cached) return cached;

    const result = await this.request(TMDB_ENDPOINTS.search.multi, {
      query: query.trim(),
      page,
      include_adult: false
    }, { cacheTTL: this.config.cacheTTL.search });

    this.searchCache.set(cacheKey, result, this.config.cacheTTL.search);
    return result;
  }

  // Movie details
  async getMovie(id, appendToResponse = ['credits', 'videos', 'images', 'recommendations', 'similar']) {
    if (!id) throw new Error('Movie ID is required');
    
    const cacheKey = `movie-${id}-${appendToResponse.join(',')}`;
    const cached = this.metadataCache.get(cacheKey);
    if (cached) return cached;

    const result = await this.request(TMDB_ENDPOINTS.movie(id), {}, {
      appendToResponse,
      cacheTTL: this.config.cacheTTL.movie
    });

    this.metadataCache.set(cacheKey, result, this.config.cacheTTL.movie);
    return result;
  }

  async getMovieCredits(id) {
    return this.request(TMDB_ENDPOINTS.movieCredits(id), {}, {
      cacheTTL: this.config.cacheTTL.movie
    });
  }

  async getMovieVideos(id) {
    return this.request(TMDB_ENDPOINTS.movieVideos(id), {}, {
      cacheTTL: this.config.cacheTTL.movie
    });
  }

  async getMovieImages(id) {
    return this.request(TMDB_ENDPOINTS.movieImages(id), {}, {
      cacheTTL: this.config.cacheTTL.movie
    });
  }

  async getMovieRecommendations(id, page = 1) {
    return this.request(TMDB_ENDPOINTS.movieRecommendations(id), { page }, {
      cacheTTL: this.config.cacheTTL.movie
    });
  }

  async getMovieSimilar(id, page = 1) {
    return this.request(TMDB_ENDPOINTS.movieSimilar(id), { page }, {
      cacheTTL: this.config.cacheTTL.movie
    });
  }

  async getMovieWatchProviders(id) {
    return this.request(TMDB_ENDPOINTS.movieWatchProviders(id), {}, {
      cacheTTL: this.config.cacheTTL.movie
    });
  }

  // TV details
  async getTV(id, appendToResponse = ['credits', 'videos', 'images', 'recommendations', 'similar']) {
    if (!id) throw new Error('TV ID is required');
    
    const cacheKey = `tv-${id}-${appendToResponse.join(',')}`;
    const cached = this.metadataCache.get(cacheKey);
    if (cached) return cached;

    const result = await this.request(TMDB_ENDPOINTS.tv(id), {}, {
      appendToResponse,
      cacheTTL: this.config.cacheTTL.tv
    });

    this.metadataCache.set(cacheKey, result, this.config.cacheTTL.tv);
    return result;
  }

  async getTVCredits(id) {
    return this.request(TMDB_ENDPOINTS.tvCredits(id), {}, {
      cacheTTL: this.config.cacheTTL.tv
    });
  }

  async getTVVideos(id) {
    return this.request(TMDB_ENDPOINTS.tvVideos(id), {}, {
      cacheTTL: this.config.cacheTTL.tv
    });
  }

  async getTVImages(id) {
    return this.request(TMDB_ENDPOINTS.tvImages(id), {}, {
      cacheTTL: this.config.cacheTTL.tv
    });
  }

  async getTVRecommendations(id, page = 1) {
    return this.request(TMDB_ENDPOINTS.tvRecommendations(id), { page }, {
      cacheTTL: this.config.cacheTTL.tv
    });
  }

  async getTVSimilar(id, page = 1) {
    return this.request(TMDB_ENDPOINTS.tvSimilar(id), { page }, {
      cacheTTL: this.config.cacheTTL.tv
    });
  }

  async getTVWatchProviders(id) {
    return this.request(TMDB_ENDPOINTS.tvWatchProviders(id), {}, {
      cacheTTL: this.config.cacheTTL.tv
    });
  }

  async getTVSeason(tvId, seasonNumber) {
    return this.request(TMDB_ENDPOINTS.tvSeason(tvId, seasonNumber), {}, {
      cacheTTL: this.config.cacheTTL.tv
    });
  }

  async getTVEpisode(tvId, seasonNumber, episodeNumber) {
    return this.request(TMDB_ENDPOINTS.tvEpisode(tvId, seasonNumber, episodeNumber), {}, {
      cacheTTL: this.config.cacheTTL.tv
    });
  }

  // Person
  async getPerson(id, appendToResponse = ['combined_credits', 'images']) {
    if (!id) throw new Error('Person ID is required');
    
    const cacheKey = `person-${id}-${appendToResponse.join(',')}`;
    const cached = this.metadataCache.get(cacheKey);
    if (cached) return cached;

    const result = await this.request(TMDB_ENDPOINTS.person(id), {}, {
      appendToResponse,
      cacheTTL: this.config.cacheTTL.person
    });

    this.metadataCache.set(cacheKey, result, this.config.cacheTTL.person);
    return result;
  }

  async getPersonCredits(id) {
    return this.request(TMDB_ENDPOINTS.personCredits(id), {}, {
      cacheTTL: this.config.cacheTTL.person
    });
  }

  async getPersonImages(id) {
    return this.request(TMDB_ENDPOINTS.personImages(id), {}, {
      cacheTTL: this.config.cacheTTL.person
    });
  }

  // Discover
  async discoverMovie(params = {}) {
    return this.request(TMDB_ENDPOINTS.discover.movie, params, {
      cacheTTL: this.config.cacheTTL.discover
    });
  }

  async discoverTV(params = {}) {
    return this.request(TMDB_ENDPOINTS.discover.tv, params, {
      cacheTTL: this.config.cacheTTL.discover
    });
  }

  // Trending & Popular
  async trending(mediaType = 'all', timeWindow = 'day', page = 1) {
    return this.request(TMDB_ENDPOINTS.trending(mediaType, timeWindow), { page }, {
      cacheTTL: this.config.cacheTTL.trending
    });
  }

  async popularMovies(page = 1) {
    return this.request(TMDB_ENDPOINTS.popular.movie, { page }, {
      cacheTTL: this.config.cacheTTL.trending
    });
  }

  async popularTV(page = 1) {
    return this.request(TMDB_ENDPOINTS.popular.tv, { page }, {
      cacheTTL: this.config.cacheTTL.trending
    });
  }

  async topRatedMovies(page = 1) {
    return this.request(TMDB_ENDPOINTS.topRated.movie, { page }, {
      cacheTTL: this.config.cacheTTL.trending
    });
  }

  async topRatedTV(page = 1) {
    return this.request(TMDB_ENDPOINTS.topRated.tv, { page }, {
      cacheTTL: this.config.cacheTTL.trending
    });
  }

  async nowPlaying(page = 1) {
    return this.request(TMDB_ENDPOINTS.nowPlaying, { page }, {
      cacheTTL: this.config.cacheTTL.trending
    });
  }

  async upcoming(page = 1) {
    return this.request(TMDB_ENDPOINTS.upcoming, { page }, {
      cacheTTL: this.config.cacheTTL.trending
    });
  }

  async airingToday(page = 1) {
    return this.request(TMDB_ENDPOINTS.airingToday, { page }, {
      cacheTTL: this.config.cacheTTL.trending
    });
  }

  async onTheAir(page = 1) {
    return this.request(TMDB_ENDPOINTS.onTheAir, { page }, {
      cacheTTL: this.config.cacheTTL.trending
    });
  }

  // Stats
  getStats() {
    return {
      ...this.stats,
      cache: {
        metadata: this.metadataCache.getStats(),
        search: this.searchCache.getStats(),
        general: this.generalCache.getStats()
      }
    };
  }

  clearCache() {
    this.metadataCache.clear();
    this.searchCache.clear();
    this.generalCache.clear();
    this.configCache.clear();
  }
}

// Singleton instance
export const tmdbClient = new TMDBClient();
export default tmdbClient;
