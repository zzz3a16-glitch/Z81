/**
 * TMDBImage - Image URL Resolver with Fallback Logic
 * Production-Grade Implementation
 */

import { TMDB_CONFIG } from '../../config/tmdb.config.js';
import { isDesktop } from '../../bridge.js';

class TMDBImageResolver {
  constructor() {
    this.config = null;
    this.baseUrl = TMDB_CONFIG.imageBaseUrl;
    this.fallbackImages = {
      poster: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAwIiBoZWlnaHQ9Ijc1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMWExYTFhIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzg4OCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPvCfjpDwn4yPPC90ZXh0Pjwvc3ZnPg==',
      backdrop: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4MCIgaGVpZ2h0PSI3MjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iIzFhMWExYSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMjQiIGZpbGw9IiM4ODgiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj7wn46QPC90ZXh0Pjwvc3ZnPg==',
      profile: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTg1IiBoZWlnaHQ9IjI3OCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMWExYTFhIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzg4OCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPvCfkoo8L3RleHQ+PC9zdmc+',
      logo: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTg1IiBoZWlnaHQ9IjE4NSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMWExYTFhIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMiIgZmlsbD0iIzg4OCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPuihqjwvdGV4dD48L3N2Zz4=',
      still: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjE2OSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMWExYTFhIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMiIgZmlsbD0iIzg4OCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPvCfj6E8L3RleHQ+PC9zdmc+'
    };
  }

  setConfig(config) {
    this.config = config;
    if (config?.images?.secure_base_url) {
      this.baseUrl = config.images.secure_base_url;
    }
  }

  getUrl(path, size = 'w500', type = 'poster') {
    if (!path) {
      return this.getFallback(type);
    }

    // Ensure path starts with /
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    
    // Validate size
    const validSizes = TMDB_CONFIG.imageSizes[type] || TMDB_CONFIG.imageSizes.poster;
    const finalSize = validSizes.includes(size) ? size : TMDB_CONFIG.defaultSizes[type] || 'w500';

    // Desktop: route through the private media protocol so images are served
    // from the local cache and keep working offline (spec 20/61).
    if (isDesktop) {
      return `zpopcorn-media://image/${type}/${finalSize}${cleanPath}`;
    }
    return `${this.baseUrl}/${finalSize}${cleanPath}`;
  }

  getPoster(path, size = 'w500') {
    return this.getUrl(path, size, 'poster');
  }

  getBackdrop(path, size = 'w1280') {
    return this.getUrl(path, size, 'backdrop');
  }

  getProfile(path, size = 'w185') {
    return this.getUrl(path, size, 'profile');
  }

  getLogo(path, size = 'w185') {
    return this.getUrl(path, size, 'logo');
  }

  getStill(path, size = 'w300') {
    return this.getUrl(path, size, 'still');
  }

  getFallback(type = 'poster') {
    return this.fallbackImages[type] || this.fallbackImages.poster;
  }

  getOptimizedUrl(path, type = 'poster', containerWidth = 500) {
    if (!path) return this.getFallback(type);

    // Choose appropriate size based on container width
    const sizeMap = {
      poster: [
        { maxWidth: 92, size: 'w92' },
        { maxWidth: 154, size: 'w154' },
        { maxWidth: 185, size: 'w185' },
        { maxWidth: 342, size: 'w342' },
        { maxWidth: 500, size: 'w500' },
        { maxWidth: 780, size: 'w780' },
        { maxWidth: Infinity, size: 'original' }
      ],
      backdrop: [
        { maxWidth: 300, size: 'w300' },
        { maxWidth: 780, size: 'w780' },
        { maxWidth: 1280, size: 'w1280' },
        { maxWidth: Infinity, size: 'original' }
      ],
      profile: [
        { maxWidth: 45, size: 'w45' },
        { maxWidth: 185, size: 'w185' },
        { maxWidth: 632, size: 'h632' },
        { maxWidth: Infinity, size: 'original' }
      ]
    };

    const sizes = sizeMap[type] || sizeMap.poster;
    const matched = sizes.find(s => containerWidth <= s.maxWidth);
    const size = matched ? matched.size : 'original';

    return this.getUrl(path, size, type);
  }

  // Component helper for rendering images with fallback
  createImageElement({ path, type = 'poster', size, alt = '', className = '', loading = 'lazy' }) {
    const img = document.createElement('img');
    img.src = this.getUrl(path, size, type);
    img.alt = alt;
    img.className = className;
    img.loading = loading;
    img.decoding = 'async';
    
    img.onerror = () => {
      img.src = this.getFallback(type);
      img.onerror = null;
    };

    return img;
  }
}

export const tmdbImage = new TMDBImageResolver();
export default tmdbImage;

// Helper function for templates
export function getTMDBImageUrl(path, type = 'poster', size = null) {
  if (!size) {
    size = TMDB_CONFIG.defaultSizes[type] || 'w500';
  }
  return tmdbImage.getUrl(path, size, type);
}
