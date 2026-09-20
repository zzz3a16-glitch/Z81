/**
 * UserTasteProfile - Builds dynamic taste profile from behavior
 * Weighted scoring system
 */

import { db } from '../storage/Database.js';
import { behaviorEngine } from './UserBehaviorEngine.js';

export class UserTasteProfile {
  constructor() {
    this.data = {
      favoriteGenres: [],
      favoriteActors: [],
      favoriteDirectors: [],
      favoriteYears: [],
      favoriteLanguages: [],
      favoriteNetworks: [],
      favoriteKeywords: [],
      favoriteRuntimeRange: { min: 0, max: 300, ideal: 120 },
      favoriteCountries: [],
      favoriteCollections: [],
      favoriteDecades: [],
      preferredContentTypes: [],
      
      // Metrics
      completionRate: 0,
      rewatchRate: 0,
      abandonmentRate: 0,
      averageRating: 0,
      watchFrequency: 0,
      totalWatchTime: 0
    };
    this.version = 0;
    this.lastUpdated = null;
  }

  async init() {
    try {
      const stored = await db.getTasteProfile();
      if (stored) {
        this.data = { ...this.data, ...stored.data };
        this.version = stored.version || 0;
        this.lastUpdated = stored.updatedAt;
      }
    } catch (e) {
      console.warn('Failed to load taste profile:', e);
    }

    // Listen to behavior events
    behaviorEngine.onEvent(() => {
      this.updateFromBehavior();
    });

    await this.updateFromBehavior();
  }

  async updateFromBehavior() {
    await behaviorEngine.init();
    const aggregated = behaviorEngine.getAggregated();
    const events = behaviorEngine.getEvents();

    // Calculate favorite genres with weights
    this.data.favoriteGenres = this.calculateWeightedList(aggregated.genres, 10);
    this.data.favoriteActors = this.calculateWeightedList(aggregated.actors, 10);
    this.data.favoriteDirectors = this.calculateWeightedList(aggregated.directors, 10);
    this.data.favoriteYears = this.calculateWeightedList(aggregated.years, 10);
    this.data.favoriteLanguages = this.calculateWeightedList(aggregated.languages, 5);
    this.data.preferredContentTypes = this.calculateWeightedList(aggregated.contentTypes, 5);

    // Calculate decades from years
    const decades = {};
    Object.entries(aggregated.years).forEach(([year, count]) => {
      const decade = Math.floor(parseInt(year) / 10) * 10;
      decades[decade] = (decades[decade] || 0) + count;
    });
    this.data.favoriteDecades = this.calculateWeightedList(decades, 5);

    // Calculate metrics
    this.data.completionRate = behaviorEngine.getCompletionRate();
    this.data.totalWatchTime = aggregated.totalWatchTime;
    
    const watchTimeStats = behaviorEngine.getWatchTimeStats();
    this.data.watchFrequency = watchTimeStats.averagePerDay;

    // Calculate runtime preferences from completed movies
    const completedEvents = events.filter(e => e.type === 'PLAY_COMPLETED' && e.metadata.runtime);
    if (completedEvents.length > 0) {
      const runtimes = completedEvents.map(e => e.metadata.runtime);
      this.data.favoriteRuntimeRange = {
        min: Math.min(...runtimes),
        max: Math.max(...runtimes),
        ideal: Math.round(runtimes.reduce((a, b) => a + b, 0) / runtimes.length)
      };
    }

    // Calculate average rating
    const ratedEvents = events.filter(e => e.type === 'RATED');
    if (ratedEvents.length > 0) {
      const ratings = ratedEvents.map(e => e.metadata.rating);
      this.data.averageRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
      this.data.rewatchRate = events.filter(e => e.type === 'REWATCH').length / Math.max(1, ratedEvents.length);
    }

    this.version++;
    this.lastUpdated = Date.now();

    await this.save();
    
    // Dispatch event
    window.dispatchEvent(new CustomEvent('tasteprofileupdate', { 
      detail: { profile: this.data, version: this.version } 
    }));
  }

  calculateWeightedList(countMap, limit = 10) {
    const total = Object.values(countMap).reduce((a, b) => a + b, 0);
    if (total === 0) return [];

    return Object.entries(countMap)
      .map(([id, count]) => ({
        id: isNaN(id) ? id : parseInt(id),
        count,
        weight: count / total,
        percentage: Math.round((count / total) * 100)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  async save() {
    try {
      await db.saveTasteProfile({
        data: this.data,
        version: this.version
      });
    } catch (e) {
      console.warn('Failed to save taste profile:', e);
    }
  }

  getProfile() {
    return { ...this.data, version: this.version, lastUpdated: this.lastUpdated };
  }

  getScore(media) {
    if (!media) return 0;

    let score = 0;
    let maxScore = 0;

    // Genre score (30 points)
    if (media.genres || media.genre_ids) {
      const mediaGenres = media.genres ? media.genres.map(g => g.id || g) : media.genre_ids;
      const genreScore = this.calculateListScore(mediaGenres, this.data.favoriteGenres);
      score += genreScore * 30;
      maxScore += 30;
    }

    // Actor score (20 points)
    if (media.credits?.cast || media.actors) {
      const actors = (media.credits?.cast || media.actors || []).slice(0, 5).map(a => a.id);
      const actorScore = this.calculateListScore(actors, this.data.favoriteActors);
      score += actorScore * 20;
      maxScore += 20;
    }

    // Director score (20 points)
    if (media.credits?.crew || media.directors) {
      const directors = (media.credits?.crew || media.directors || [])
        .filter(c => c.job === 'Director' || c.department === 'Directing')
        .map(d => d.id);
      const directorScore = this.calculateListScore(directors, this.data.favoriteDirectors);
      score += directorScore * 20;
      maxScore += 20;
    }

    // Year score (7 points)
    if (media.release_date || media.first_air_date || media.year) {
      const year = media.year || 
        (media.release_date ? new Date(media.release_date).getFullYear() : null) ||
        (media.first_air_date ? new Date(media.first_air_date).getFullYear() : null);
      
      if (year) {
        const yearScore = this.calculateYearScore(year);
        score += yearScore * 7;
        maxScore += 7;
      }
    }

    // Language score (5 points)
    if (media.original_language) {
      const langMatch = this.data.favoriteLanguages.find(l => l.id === media.original_language);
      if (langMatch) {
        score += langMatch.weight * 5;
      }
      maxScore += 5;
    }

    // Runtime score (3 points) - if we have ideal runtime
    if (media.runtime && this.data.favoriteRuntimeRange.ideal) {
      const runtimeDiff = Math.abs(media.runtime - this.data.favoriteRuntimeRange.ideal);
      const runtimeScore = Math.max(0, 1 - runtimeDiff / 120); // 120 min tolerance
      score += runtimeScore * 3;
      maxScore += 3;
    }

    // Content type score (5 points)
    if (media.media_type || media.type) {
      const type = media.media_type || media.type;
      const typeMatch = this.data.preferredContentTypes.find(t => t.id === type);
      if (typeMatch) {
        score += typeMatch.weight * 5;
      }
      maxScore += 5;
    }

    // Normalize to 0-100
    if (maxScore === 0) return 50; // Neutral if no data
    return Math.round((score / maxScore) * 100);
  }

  calculateListScore(mediaList, favoriteList) {
    if (!mediaList || !favoriteList || favoriteList.length === 0) return 0;
    
    let score = 0;
    mediaList.forEach(id => {
      const match = favoriteList.find(f => f.id === id || f.id == id);
      if (match) {
        score += match.weight;
      }
    });
    
    return Math.min(1, score);
  }

  calculateYearScore(year) {
    if (this.data.favoriteYears.length === 0) return 0.5;
    
    const yearMatch = this.data.favoriteYears.find(y => y.id === year);
    if (yearMatch) return yearMatch.weight;

    // Check decade
    const decade = Math.floor(year / 10) * 10;
    const decadeMatch = this.data.favoriteDecades.find(d => d.id === decade);
    if (decadeMatch) return decadeMatch.weight * 0.7;

    return 0;
  }

  getTopGenres(limit = 3) {
    return this.data.favoriteGenres.slice(0, limit);
  }

  getTopActors(limit = 3) {
    return this.data.favoriteActors.slice(0, limit);
  }

  explainScore(media) {
    const explanations = [];
    
    if (media.genres) {
      const topGenres = this.getTopGenres();
      const matchingGenres = media.genres.filter(g => 
        topGenres.some(tg => tg.id === (g.id || g))
      );
      if (matchingGenres.length > 0) {
        explanations.push(`تحب ${matchingGenres.map(g => g.name || g).join('، ')} (${topGenres[0]?.percentage || 0}% من مشاهداتك)`);
      }
    }

    if (this.data.favoriteYears.length > 0) {
      const year = media.year || (media.release_date ? new Date(media.release_date).getFullYear() : null);
      if (year) {
        const decade = Math.floor(year / 10) * 10;
        const decadeMatch = this.data.favoriteDecades.find(d => d.id === decade);
        if (decadeMatch) {
          explanations.push(`تفضل أفلام ${decade} (${decadeMatch.percentage}% من مشاهداتك)`);
        }
      }
    }

    return explanations;
  }

  async clear() {
    this.data = {
      favoriteGenres: [],
      favoriteActors: [],
      favoriteDirectors: [],
      favoriteYears: [],
      favoriteLanguages: [],
      favoriteNetworks: [],
      favoriteKeywords: [],
      favoriteRuntimeRange: { min: 0, max: 300, ideal: 120 },
      favoriteCountries: [],
      favoriteCollections: [],
      favoriteDecades: [],
      preferredContentTypes: [],
      completionRate: 0,
      rewatchRate: 0,
      abandonmentRate: 0,
      averageRating: 0,
      watchFrequency: 0,
      totalWatchTime: 0
    };
    this.version = 0;
    await this.save();
  }
}

export const tasteProfile = new UserTasteProfile();
export default tasteProfile;
