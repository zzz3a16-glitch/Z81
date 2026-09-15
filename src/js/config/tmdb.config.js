/**
 * TMDB Configuration - Centralized API Configuration
 * Production-Grade Implementation
 */

export const TMDB_CONFIG = {
  // API Configuration
  apiKey: localStorage.getItem('zpopcorn-tmdb-api-key') || 'e547e17d4e91f3e62a571655cd1ccaff', // Demo key fallback
  baseUrl: 'https://api.themoviedb.org/3',
  imageBaseUrl: 'https://image.tmdb.org/t/p',
  
  // Regional Settings - Saudi Arabia Default
  defaultRegion: localStorage.getItem('zpopcorn-region') || 'SA',
  defaultLanguage: localStorage.getItem('zpopcorn-language') || 'ar-SA',
  
  // Fallback language chain
  languageFallback: ['ar-SA', 'ar', 'en-US', 'en'],
  
  // Image sizes per TMDB docs
  imageSizes: {
    poster: ['w92', 'w154', 'w185', 'w342', 'w500', 'w780', 'original'],
    backdrop: ['w300', 'w780', 'w1280', 'original'],
    profile: ['w45', 'w185', 'h632', 'original'],
    logo: ['w45', 'w92', 'w154', 'w185', 'w300', 'w500', 'original'],
    still: ['w92', 'w185', 'w300', 'original']
  },
  
  // Default sizes
  defaultSizes: {
    poster: 'w500',
    backdrop: 'w1280',
    profile: 'w185',
    logo: 'w185',
    still: 'w300'
  },
  
  // Rate limiting
  rateLimit: {
    requestsPerSecond: 40,
    burstLimit: 50,
    retryAfter: 10000,
    maxRetries: 3
  },
  
  // Cache TTL (milliseconds)
  cacheTTL: {
    configuration: 24 * 60 * 60 * 1000, // 24 hours
    genres: 24 * 60 * 60 * 1000,
    movie: 6 * 60 * 60 * 1000, // 6 hours
    tv: 6 * 60 * 60 * 1000,
    person: 12 * 60 * 60 * 1000,
    search: 60 * 60 * 1000, // 1 hour
    trending: 60 * 60 * 1000,
    discover: 2 * 60 * 60 * 1000
  }
};

export const TMDB_ENDPOINTS = {
  configuration: '/configuration',
  genres: {
    movie: '/genre/movie/list',
    tv: '/genre/tv/list'
  },
  search: {
    movie: '/search/movie',
    tv: '/search/tv',
    person: '/search/person',
    multi: '/search/multi'
  },
  movie: (id) => `/movie/${id}`,
  tv: (id) => `/tv/${id}`,
  person: (id) => `/person/${id}`,
  movieCredits: (id) => `/movie/${id}/credits`,
  tvCredits: (id) => `/tv/${id}/credits`,
  personCredits: (id) => `/person/${id}/combined_credits`,
  movieVideos: (id) => `/movie/${id}/videos`,
  tvVideos: (id) => `/tv/${id}/videos`,
  movieImages: (id) => `/movie/${id}/images`,
  tvImages: (id) => `/tv/${id}/images`,
  personImages: (id) => `/person/${id}/images`,
  movieRecommendations: (id) => `/movie/${id}/recommendations`,
  tvRecommendations: (id) => `/tv/${id}/recommendations`,
  movieSimilar: (id) => `/movie/${id}/similar`,
  tvSimilar: (id) => `/tv/${id}/similar`,
  movieWatchProviders: (id) => `/movie/${id}/watch/providers`,
  tvWatchProviders: (id) => `/tv/${id}/watch/providers`,
  tvSeasons: (id) => `/tv/${id}`,
  tvSeason: (id, season) => `/tv/${id}/season/${season}`,
  tvEpisode: (id, season, episode) => `/tv/${id}/season/${season}/episode/${episode}`,
  discover: {
    movie: '/discover/movie',
    tv: '/discover/tv'
  },
  trending: (mediaType = 'all', timeWindow = 'day') => `/trending/${mediaType}/${timeWindow}`,
  popular: {
    movie: '/movie/popular',
    tv: '/tv/popular'
  },
  topRated: {
    movie: '/movie/top_rated',
    tv: '/tv/top_rated'
  },
  nowPlaying: '/movie/now_playing',
  upcoming: '/movie/upcoming',
  airingToday: '/tv/airing_today',
  onTheAir: '/tv/on_the_air'
};

export default TMDB_CONFIG;
