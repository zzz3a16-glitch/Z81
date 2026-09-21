/**
 * AdvancedSearch - Production-Grade NLP Search Service
 * Arabic RTL Primary + English Secondary
 * Features: Natural Language, Typo Tolerance, Transliteration, Semantic Search
 */

import { tmdbClient } from '../tmdb/TMDBClient.js';
import { db } from '../storage/Database.js';
import { behaviorEngine } from '../behavior/UserBehaviorEngine.js';
import { searchEngine } from './SearchEngine.js';

// Arabic transliteration map
const ARABIC_TRANSLITERATION = {
  'ا': ['a', 'e'], 'ب': ['b'], 'ت': ['t'], 'ث': ['th', 's'],
  'ج': ['j', 'g', 'dj'], 'ح': ['h', '7'], 'خ': ['kh', '5'],
  'د': ['d'], 'ذ': ['th', 'z'], 'ر': ['r'], 'ز': ['z'],
  'س': ['s'], 'ش': ['sh', 'ch'], 'ص': ['s', '9'],
  'ض': ['d', '9\''], 'ط': ['t', '6'], 'ظ': ['z', '6\''],
  'ع': ['a', '3'], 'غ': ['gh', '8'], 'ف': ['f'],
  'ق': ['q', '8', 'k'], 'ك': ['k'], 'ل': ['l'],
  'م': ['m'], 'ن': ['n'], 'ه': ['h', 'a'],
  'و': ['w', 'o', 'u'], 'ي': ['y', 'i', 'e']
};

// Arabic synonyms expansion
const ARABIC_SYNONYMS = {
  'فيلم': ['افلام', 'أفلام', 'movie', 'movies'],
  'مسلسل': ['مسلسلات', 'tv', 'series', 'show'],
  'جديد': ['جديدة', 'حديث', 'new', 'latest'],
  'قديم': ['قديمة', 'كلاسيكي', 'old', 'classic'],
  'اكشن': ['أكشن', 'action', 'اثارة'],
  'كوميدي': ['كوميديا', 'comedy', 'ضحك', 'مضحك'],
  'دراما': ['درامي', 'drama'],
  'رعب': ['مرعب', 'horror', 'خوف'],
  'رومانسي': ['حب', 'romance', 'romantic'],
  'خيال علمي': ['sci-fi', 'science fiction', 'خيال'],
  'مغامرة': ['مغامرات', 'adventure'],
  'انمي': ['أنمي', 'anime', 'كرتون']
};

// English to Arabic genre mapping
const GENRE_MAP_BILINGUAL = {
  'action': { id: 28, ar: 'أكشن', en: 'Action' },
  'adventure': { id: 12, ar: 'مغامرة', en: 'Adventure' },
  'animation': { id: 16, ar: 'رسوم متحركة', en: 'Animation' },
  'comedy': { id: 35, ar: 'كوميدي', en: 'Comedy' },
  'crime': { id: 80, ar: 'جريمة', en: 'Crime' },
  'documentary': { id: 99, ar: 'وثائقي', en: 'Documentary' },
  'drama': { id: 18, ar: 'دراما', en: 'Drama' },
  'family': { id: 10751, ar: 'عائلي', en: 'Family' },
  'fantasy': { id: 14, ar: 'خيال', en: 'Fantasy' },
  'history': { id: 36, ar: 'تاريخي', en: 'History' },
  'horror': { id: 27, ar: 'رعب', en: 'Horror' },
  'music': { id: 10402, ar: 'موسيقي', en: 'Music' },
  'mystery': { id: 9648, ar: 'غموض', en: 'Mystery' },
  'romance': { id: 10749, ar: 'رومانسي', en: 'Romance' },
  'sci-fi': { id: 878, ar: 'خيال علمي', en: 'Science Fiction' },
  'thriller': { id: 53, ar: 'إثارة', en: 'Thriller' },
  'war': { id: 10752, ar: 'حرب', en: 'War' },
  'western': { id: 37, ar: 'غرب', en: 'Western' }
};

export class AdvancedSearch {
  constructor() {
    this.index = new Map(); // In-memory search index
    this.lastIndexUpdate = 0;
    this.indexTTL = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Build local search index from IndexedDB
   */
  async buildIndex() {
    try {
      const now = Date.now();
      if (now - this.lastIndexUpdate < this.indexTTL && this.index.size > 0) {
        return; // Still fresh
      }

      console.log(' Building search index...');
      const [movies, tvShows, watchHistory] = await Promise.all([
        db.getAll('movies').catch(() => []),
        db.getAll('tvshows').catch(() => []),
        db.getAll('watchHistory').catch(() => [])
      ]);

      this.index.clear();

      const addToIndex = (items, type) => {
        items.forEach(item => {
          const terms = this.extractTerms(item);
          terms.forEach(term => {
            if (!this.index.has(term)) {
              this.index.set(term, []);
            }
            this.index.get(term).push({ ...item, _type: type, _score: 0 });
          });
        });
      };

      addToIndex(movies, 'movie');
      addToIndex(tvShows, 'tv');

      this.lastIndexUpdate = now;
      console.log(` Index built: ${this.index.size} terms, ${movies.length + tvShows.length} items`);
    } catch (e) {
      console.warn('Index build failed:', e);
    }
  }

  extractTerms(item) {
    const terms = new Set();
    const fields = [
      item.title,
      item.name,
      item.original_title,
      item.original_name,
      item.overview
    ].filter(Boolean);

    fields.forEach(field => {
      // Tokenize
      const words = field.toLowerCase()
        .replace(/[^\w\s\u0600-\u06FF]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 1);

      words.forEach(word => {
        terms.add(word);
        // Add transliterations for Arabic
        if (/[\u0600-\u06FF]/.test(word)) {
          const latin = this.transliterateArabic(word);
          if (latin) terms.add(latin.toLowerCase());
        }
      });
    });

    return Array.from(terms);
  }

  transliterateArabic(text) {
    let result = '';
    for (const char of text) {
      if (ARABIC_TRANSLITERATION[char]) {
        result += ARABIC_TRANSLITERATION[char][0];
      } else {
        result += char;
      }
    }
    return result;
  }

  /**
   * Typo tolerance using Levenshtein distance
   */
  levenshteinDistance(a, b) {
    const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
    
    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= b.length; j++) {
      for (let i = 1; i <= a.length; i++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + cost
        );
      }
    }

    return matrix[b.length][a.length];
  }

  findSimilarTerms(query, maxDistance = 2) {
    const results = [];
    const lowerQuery = query.toLowerCase();

    for (const term of this.index.keys()) {
      const distance = this.levenshteinDistance(lowerQuery, term);
      if (distance <= maxDistance) {
        results.push({ term, distance, items: this.index.get(term) });
      }
    }

    return results.sort((a, b) => a.distance - b.distance);
  }

  /**
   * Expand query with synonyms
   */
  expandQuery(query) {
    const expanded = new Set([query]);
    const lower = query.toLowerCase();

    for (const [key, synonyms] of Object.entries(ARABIC_SYNONYMS)) {
      if (lower.includes(key.toLowerCase()) || synonyms.some(s => lower.includes(s.toLowerCase()))) {
        expanded.add(key);
        synonyms.forEach(s => expanded.add(s));
      }
    }

    return Array.from(expanded);
  }

  /**
   * Parse natural language query
   * Examples:
   * - "أفلام أكشن من 2023"
   * - "مسلسلات كوميدية جديدة"
   * - "أفلام ليوناردو دي كابريو"
   * - "أفلام رعب تقيمها عالي"
   */
  parseNaturalLanguage(query) {
    const lower = query.toLowerCase();
    const parsed = {
      original: query,
      type: 'multi',
      genres: [],
      year: null,
      yearRange: null,
      rating: null,
      person: null,
      keywords: [],
      sortBy: 'popularity.desc',
      isNew: false,
      isOld: false
    };

    // Detect type
    if (/(فيلم|افلام|أفلام|movie)/i.test(lower)) parsed.type = 'movie';
    if (/(مسلسل|مسلسلات|tv|series|show)/i.test(lower)) parsed.type = 'tv';

    // Detect genres
    for (const [key, genre] of Object.entries(GENRE_MAP_BILINGUAL)) {
      const patterns = [key, genre.ar, genre.en].map(s => s.toLowerCase());
      if (patterns.some(p => lower.includes(p))) {
        parsed.genres.push(genre);
      }
    }

    // Also check Arabic synonyms
    for (const [arKey, synonyms] of Object.entries(ARABIC_SYNONYMS)) {
      const genreEntry = Object.values(GENRE_MAP_BILINGUAL).find(g => 
        g.ar === arKey || synonyms.includes(arKey)
      );
      if (genreEntry && lower.includes(arKey)) {
        if (!parsed.genres.find(g => g.id === genreEntry.id)) {
          parsed.genres.push(genreEntry);
        }
      }
    }

    // Detect year
    const yearMatch = lower.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) {
      parsed.year = parseInt(yearMatch[0]);
    }

    // Year ranges
    if (/من\s+(\d{4})\s+الى\s+(\d{4})/.test(lower) || /from\s+(\d{4})\s+to\s+(\d{4})/i.test(lower)) {
      const rangeMatch = lower.match(/(\d{4})\s+(?:الى|to)\s+(\d{4})/);
      if (rangeMatch) {
        parsed.yearRange = { from: parseInt(rangeMatch[1]), to: parseInt(rangeMatch[2]) };
      }
    }

    // Detect rating
    const ratingMatch = lower.match(/(?:تقيم|تقييم|rating)\s*(?:عالي|مرتفع|high)?\s*(\d+(?:\.\d+)?)?/);
    if (ratingMatch || /تقيم.*عالي|high.*rat/.test(lower)) {
      parsed.rating = ratingMatch && ratingMatch[1] ? parseFloat(ratingMatch[1]) : 7.5;
      parsed.sortBy = 'vote_average.desc';
    }

    // Detect new/old
    if (/(جديد|جديدة|حديث|new|latest|recent)/i.test(lower)) {
      parsed.isNew = true;
      parsed.sortBy = 'primary_release_date.desc';
    }
    if (/(قديم|قديمة|كلاسيكي|old|classic)/i.test(lower)) {
      parsed.isOld = true;
      parsed.sortBy = 'primary_release_date.asc';
    }

    // Extract remaining keywords (remove detected entities)
    let keywords = lower;
    // Remove genre words
    parsed.genres.forEach(g => {
      keywords = keywords.replace(new RegExp(g.ar, 'gi'), '').replace(new RegExp(g.en, 'gi'), '');
    });
    // Remove type words
    keywords = keywords.replace(/(فيلم|افلام|مسلسل|مسلسلات|movie|tv|series)/gi, '');
    // Remove year
    keywords = keywords.replace(/\b(19|20)\d{2}\b/g, '');
    // Remove common words
    keywords = keywords.replace(/(من|في|الى|منذ|عن|الى|with|from|in|of|the|a|an)/gi, '');
    
    parsed.keywords = keywords.trim().split(/\s+/).filter(w => w.length > 2);

    // Try to detect person name (remaining 2+ words that are capitalized or Arabic)
    const personCandidate = query.match(/(?:لـ|ل|بطولة|مع|للممثل|starring|with|featuring)\s+([A-Za-z\u0600-\u06FF\s]+)/i);
    if (personCandidate) {
      parsed.person = personCandidate[1].trim();
    } else if (parsed.keywords.length >= 2 && !parsed.genres.length) {
      // If no genres detected and we have 2+ keywords, might be a person
      const possiblePerson = parsed.keywords.join(' ');
      if (possiblePerson.length > 3 && /^[A-Za-z\u0600-\u06FF\s]+$/.test(possiblePerson)) {
        // Check if it's not a common word
        if (!/(جديد|قديم|افلام|مسلسلات|جيد|رائع)/i.test(possiblePerson)) {
          parsed.person = possiblePerson;
        }
      }
    }

    return parsed;
  }

  /**
   * Execute natural language search
   */
  async naturalSearch(query, page = 1) {
    await this.buildIndex();

    const parsed = this.parseNaturalLanguage(query);
    console.log(' Parsed NL query:', parsed);

    // Track behavior
    behaviorEngine.track('NATURAL_SEARCH', { query, parsed });

    // If person detected, search person first
    if (parsed.person) {
      try {
        const personResults = await tmdbClient.searchPerson(parsed.person, page);
        if (personResults.results?.length > 0) {
          // Get person's movies
          const personId = personResults.results[0].id;
          const credits = await tmdbClient.getPersonMovieCredits(personId).catch(() => null);
          if (credits?.cast?.length) {
            return {
              results: credits.cast.slice(0, 20),
              total_pages: 1,
              total_results: credits.cast.length,
              parsed,
              type: 'person_credits',
              person: personResults.results[0]
            };
          }
          return { ...personResults, parsed, type: 'person' };
        }
      } catch (e) {
        console.warn('Person search failed:', e);
      }
    }

    // Build discover params
    const params = {
      page,
      sort_by: parsed.sortBy,
      language: 'ar-SA'
    };

    if (parsed.genres.length > 0) {
      params.with_genres = parsed.genres.map(g => g.id).join(',');
    }

    if (parsed.year) {
      if (parsed.type === 'movie') {
        params.primary_release_year = parsed.year;
      } else {
        params.first_air_date_year = parsed.year;
      }
    }

    if (parsed.yearRange) {
      params['primary_release_date.gte'] = `${parsed.yearRange.from}-01-01`;
      params['primary_release_date.lte'] = `${parsed.yearRange.to}-12-31`;
    }

    if (parsed.rating) {
      params['vote_average.gte'] = parsed.rating;
      params['vote_count.gte'] = 100; // Ensure meaningful ratings
    }

    if (parsed.isNew) {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      params['primary_release_date.gte'] = oneYearAgo.toISOString().split('T')[0];
    }

    if (parsed.isOld) {
      params['primary_release_date.lte'] = '2000-01-01';
    }

    // If we have structured params, use discover
    if (parsed.genres.length > 0 || parsed.year || parsed.yearRange || parsed.rating || parsed.isNew || parsed.isOld) {
      try {
        let results;
        if (parsed.type === 'tv') {
          results = await tmdbClient.discoverTV(params);
        } else {
          results = await tmdbClient.discoverMovie(params);
        }
        
        // If we also have keywords, filter further
        if (parsed.keywords.length > 0 && results.results?.length) {
          const keywordLower = parsed.keywords.join(' ').toLowerCase();
          // For now return discover results, keyword filtering would need client-side
        }

        return { ...results, parsed, type: 'discover' };
      } catch (e) {
        console.warn('Discover failed:', e);
      }
    }

    // Fallback to regular search with expanded query
    const expandedQueries = this.expandQuery(query);
    const primaryQuery = expandedQueries[0];

    try {
      const searchResults = await searchEngine.search(primaryQuery, parsed.type, page);
      return { ...searchResults, parsed, expandedQueries, type: 'search' };
    } catch (e) {
      return {
        results: [],
        total_pages: 0,
        total_results: 0,
        parsed,
        error: e.message,
        type: 'error'
      };
    }
  }

  /**
   * Local-first search with typo tolerance
   */
  async localSearch(query, options = {}) {
    await this.buildIndex();

    const { typoTolerance = true, limit = 20 } = options;
    const lower = query.toLowerCase();
    const results = new Map();

    // Exact matches
    for (const [term, items] of this.index.entries()) {
      if (term.includes(lower) || lower.includes(term)) {
        items.forEach(item => {
          const existing = results.get(item.id);
          if (!existing || existing._score < 100) {
            results.set(item.id, { ...item, _score: 100 });
          }
        });
      }
    }

    // Typo tolerant matches
    if (typoTolerance && results.size < limit) {
      const similar = this.findSimilarTerms(lower, 2);
      similar.forEach(({ term, distance, items }) => {
        items.forEach(item => {
          if (!results.has(item.id)) {
            const score = Math.max(0, 80 - distance * 20);
            results.set(item.id, { ...item, _score: score });
          }
        });
      });
    }

    // Sort by score and return
    const sorted = Array.from(results.values())
      .sort((a, b) => b._score - a._score)
      .slice(0, limit);

    return {
      results: sorted,
      total_results: sorted.length,
      query,
      type: 'local',
      hasTypoCorrections: sorted.some(r => r._score < 100)
    };
  }

  /**
   * Unified search - local + TMDB + natural
   */
  async unifiedSearch(query, options = {}) {
    const {
      includeLocal = true,
      includeTMDB = true,
      includeNatural = true,
      page = 1,
      limit = 20
    } = options;

    const results = {
      query,
      local: null,
      tmdb: null,
      natural: null,
      combined: [],
      total_results: 0
    };

    const promises = [];

    if (includeLocal) {
      promises.push(
        this.localSearch(query, { limit })
          .then(r => { results.local = r; })
          .catch(() => {})
      );
    }

    if (includeNatural) {
      promises.push(
        this.naturalSearch(query, page)
          .then(r => { results.natural = r; })
          .catch(() => {})
      );
    }

    if (includeTMDB && !includeNatural) {
      promises.push(
        searchEngine.search(query, 'multi', page)
          .then(r => { results.tmdb = r; })
          .catch(() => {})
      );
    }

    await Promise.all(promises);

    // Combine results with deduplication
    const seen = new Set();
    const combined = [];

    // Priority: local first, then natural, then TMDB
    const sources = [results.local, results.natural, results.tmdb].filter(Boolean);

    for (const source of sources) {
      const items = source.results || [];
      for (const item of items) {
        const key = `${item.media_type || item._type || 'movie'}-${item.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          combined.push(item);
        }
        if (combined.length >= limit) break;
      }
      if (combined.length >= limit) break;
    }

    results.combined = combined;
    results.total_results = combined.length;

    return results;
  }

  /**
   * Get search suggestions with typo tolerance
   */
  async getSmartSuggestions(query, limit = 5) {
    if (!query || query.length < 2) return [];

    await this.buildIndex();

    const suggestions = new Set();
    const lower = query.toLowerCase();

    // From index
    for (const term of this.index.keys()) {
      if (term.startsWith(lower) && term.length > lower.length) {
        suggestions.add(term);
        if (suggestions.size >= limit) break;
      }
    }

    // From behavior
    try {
      const recent = behaviorEngine.getRecentSearches(limit * 2);
      recent.forEach(r => {
        const q = r.metadata.query;
        if (q.toLowerCase().includes(lower) && q.toLowerCase() !== lower) {
          suggestions.add(q);
        }
      });
    } catch {}

    // Typo corrections
    if (suggestions.size < limit) {
      const similar = this.findSimilarTerms(lower, 1);
      similar.slice(0, 2).forEach(({ term }) => {
        if (term !== lower) {
          suggestions.add(term);
        }
      });
    }

    return Array.from(suggestions).slice(0, limit);
  }
}

export const advancedSearch = new AdvancedSearch();
export default advancedSearch;
