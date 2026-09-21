/**
 * RatingManager - Personal ratings and reviews
 */

import { db } from '../storage/Database.js';
import { behaviorEngine, BEHAVIOR_EVENTS } from '../behavior/UserBehaviorEngine.js';

export class RatingManager {
  constructor() {
    this.ratings = new Map();
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    
    try {
      const ratings = await db.getAll('ratings');
      ratings.forEach(r => this.ratings.set(r.mediaId, r));
    } catch (e) {
      console.warn('Failed to load ratings:', e);
    }
    
    this.initialized = true;
  }

  async rate(mediaId, rating, review = null, options = {}) {
    await this.init();
    
    if (rating < 1 || rating > 10) {
      throw new Error('Rating must be between 1 and 10');
    }

    const existing = this.ratings.get(mediaId.toString());
    
    const ratingData = {
      mediaId: mediaId.toString(),
      mediaType: options.mediaType || 'movie',
      personalRating: rating,
      review: review || existing?.review || null,
      watchedAt: existing?.watchedAt || Date.now(),
      updatedAt: Date.now(),
      rewatchCount: existing?.rewatchCount || 0,
      recommendation: options.recommendation || existing?.recommendation || null,
      tags: options.tags || existing?.tags || [],
      title: options.title || existing?.title || null
    };

    this.ratings.set(mediaId.toString(), ratingData);

    try {
      await db.put('ratings', ratingData);
      
      behaviorEngine.track(BEHAVIOR_EVENTS.RATED, {
        mediaId,
        mediaType: ratingData.mediaType,
        rating
      });
    } catch (e) {
      console.warn('Failed to save rating:', e);
    }

    window.dispatchEvent(new CustomEvent('ratingupdate', { 
      detail: { mediaId, rating: ratingData } 
    }));

    return ratingData;
  }

  async getRating(mediaId) {
    await this.init();
    return this.ratings.get(mediaId.toString()) || null;
  }

  async getAllRatings(filter = {}) {
    await this.init();
    
    let ratings = Array.from(this.ratings.values());

    if (filter.mediaType) {
      ratings = ratings.filter(r => r.mediaType === filter.mediaType);
    }

    if (filter.minRating) {
      ratings = ratings.filter(r => r.personalRating >= filter.minRating);
    }

    if (filter.sortBy === 'rating') {
      ratings.sort((a, b) => b.personalRating - a.personalRating);
    } else if (filter.sortBy === 'date') {
      ratings.sort((a, b) => b.updatedAt - a.updatedAt);
    }

    if (filter.limit) {
      ratings = ratings.slice(0, filter.limit);
    }

    return ratings;
  }

  async removeRating(mediaId) {
    await this.init();
    
    this.ratings.delete(mediaId.toString());
    
    try {
      await db.delete('ratings', mediaId.toString());
    } catch {}

    window.dispatchEvent(new CustomEvent('ratingupdate', { 
      detail: { mediaId, rating: null, action: 'deleted' } 
    }));

    return true;
  }

  async addReview(mediaId, review) {
    await this.init();
    
    const existing = this.ratings.get(mediaId.toString());
    if (!existing) {
      throw new Error('Must rate before reviewing');
    }

    existing.review = review;
    existing.updatedAt = Date.now();

    try {
      await db.put('ratings', existing);
    } catch {}

    return existing;
  }

  async incrementRewatch(mediaId) {
    await this.init();
    
    const existing = this.ratings.get(mediaId.toString());
    if (!existing) return null;

    existing.rewatchCount = (existing.rewatchCount || 0) + 1;
    existing.updatedAt = Date.now();

    try {
      await db.put('ratings', existing);
      
      behaviorEngine.track(BEHAVIOR_EVENTS.REWATCH, {
        mediaId,
        mediaType: existing.mediaType
      });
    } catch {}

    return existing;
  }

  getAverageRating(mediaType = null) {
    const ratings = Array.from(this.ratings.values());
    const filtered = mediaType ? ratings.filter(r => r.mediaType === mediaType) : ratings;
    
    if (filtered.length === 0) return 0;
    
    const sum = filtered.reduce((acc, r) => acc + r.personalRating, 0);
    return sum / filtered.length;
  }

  getStats() {
    const ratings = Array.from(this.ratings.values());
    
    return {
      total: ratings.length,
      average: this.getAverageRating(),
      averageMovies: this.getAverageRating('movie'),
      averageTV: this.getAverageRating('tv'),
      byRating: this.getDistribution(),
      totalRewatches: ratings.reduce((acc, r) => acc + (r.rewatchCount || 0), 0)
    };
  }

  getDistribution() {
    const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 };
    
    this.ratings.forEach(r => {
      const rounded = Math.round(r.personalRating);
      dist[rounded] = (dist[rounded] || 0) + 1;
    });

    return dist;
  }
}

export const ratingManager = new RatingManager();
export default ratingManager;
