/**
 * UserBehaviorEngine - Tracks and aggregates user behavior
 * Core of the intelligence system
 */

import { db } from '../storage/Database.js';

export const BEHAVIOR_EVENTS = {
  PLAY_STARTED: 'PLAY_STARTED',
  PLAY_PAUSED: 'PLAY_PAUSED',
  PLAY_RESUMED: 'PLAY_RESUMED',
  PLAY_COMPLETED: 'PLAY_COMPLETED',
  PLAY_STOPPED: 'PLAY_STOPPED',
  SEEK: 'SEEK',
  REWATCH: 'REWATCH',
  EPISODE_COMPLETED: 'EPISODE_COMPLETED',
  MOVIE_COMPLETED: 'MOVIE_COMPLETED',
  EPISODE_SKIPPED: 'EPISODE_SKIPPED',
  MOVIE_ABANDONED: 'MOVIE_ABANDONED',
  ADDED_TO_WATCHLIST: 'ADDED_TO_WATCHLIST',
  REMOVED_FROM_WATCHLIST: 'REMOVED_FROM_WATCHLIST',
  RATED: 'RATED',
  SEARCHED: 'SEARCHED',
  OPENED: 'OPENED',
  FAVORITED: 'FAVORITED',
  UNFAVORITED: 'UNFAVORITED'
};

export class UserBehaviorEngine {
  constructor() {
    this.events = [];
    this.aggregated = {
      genres: {},
      actors: {},
      directors: {},
      years: {},
      languages: {},
      keywords: {},
      contentTypes: {},
      totalWatchTime: 0,
      completedCount: 0,
      abandonedCount: 0
    };
    this.listeners = [];
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    
    try {
      const stored = await db.getAll('behaviorEvents');
      this.events = stored || [];
      this.aggregateEvents();
      this.initialized = true;
    } catch (e) {
      console.warn('Failed to load behavior events:', e);
      this.initialized = true;
    }
  }

  async track(eventType, metadata = {}) {
    await this.init();
    
    const event = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: eventType,
      timestamp: Date.now(),
      metadata: {
        ...metadata,
        userAgent: navigator.userAgent,
        url: window.location.href
      }
    };

    this.events.push(event);
    
    // Persist
    try {
      await db.put('behaviorEvents', event);
    } catch (e) {
      console.warn('Failed to persist behavior event:', e);
    }

    // Aggregate
    this.aggregateSingleEvent(event);
    
    // Notify listeners
    this.listeners.forEach(cb => {
      try {
        cb(event);
      } catch (e) {
        console.warn('Behavior listener error:', e);
      }
    });

    // Dispatch global event
    window.dispatchEvent(new CustomEvent('behavior', { detail: event }));

    return event;
  }

  aggregateEvents() {
    this.aggregated = {
      genres: {},
      actors: {},
      directors: {},
      years: {},
      languages: {},
      keywords: {},
      contentTypes: {},
      totalWatchTime: 0,
      completedCount: 0,
      abandonedCount: 0
    };

    this.events.forEach(event => this.aggregateSingleEvent(event, false));
  }

  aggregateSingleEvent(event, updateProfile = true) {
    const { type, metadata } = event;

    // Content type aggregation
    if (metadata.mediaType) {
      this.aggregated.contentTypes[metadata.mediaType] = 
        (this.aggregated.contentTypes[metadata.mediaType] || 0) + 1;
    }

    // Genre aggregation
    if (metadata.genres) {
      metadata.genres.forEach(genre => {
        const id = genre.id || genre;
        this.aggregated.genres[id] = (this.aggregated.genres[id] || 0) + 1;
      });
    }

    // Actor aggregation
    if (metadata.actors) {
      metadata.actors.forEach(actor => {
        const id = actor.id || actor;
        this.aggregated.actors[id] = (this.aggregated.actors[id] || 0) + 1;
      });
    }

    // Director aggregation
    if (metadata.directors) {
      metadata.directors.forEach(director => {
        const id = director.id || director;
        this.aggregated.directors[id] = (this.aggregated.directors[id] || 0) + 1;
      });
    }

    // Year aggregation
    if (metadata.year) {
      this.aggregated.years[metadata.year] = (this.aggregated.years[metadata.year] || 0) + 1;
    }

    // Language aggregation
    if (metadata.language) {
      this.aggregated.languages[metadata.language] = (this.aggregated.languages[metadata.language] || 0) + 1;
    }

    // Watch time
    if (type === BEHAVIOR_EVENTS.PLAY_COMPLETED && metadata.duration) {
      this.aggregated.totalWatchTime += metadata.duration;
      this.aggregated.completedCount++;
    }

    if (type === BEHAVIOR_EVENTS.MOVIE_ABANDONED) {
      this.aggregated.abandonedCount++;
    }
  }

  getAggregated() {
    return { ...this.aggregated };
  }

  getEvents(filter = {}) {
    let filtered = [...this.events];

    if (filter.type) {
      filtered = filtered.filter(e => e.type === filter.type);
    }

    if (filter.mediaId) {
      filtered = filtered.filter(e => e.metadata.mediaId === filter.mediaId);
    }

    if (filter.mediaType) {
      filtered = filtered.filter(e => e.metadata.mediaType === filter.mediaType);
    }

    if (filter.since) {
      filtered = filtered.filter(e => e.timestamp >= filter.since);
    }

    if (filter.limit) {
      filtered = filtered.slice(-filter.limit);
    }

    return filtered.sort((a, b) => b.timestamp - a.timestamp);
  }

  getWatchHistory(limit = 50) {
    return this.getEvents({ 
      type: BEHAVIOR_EVENTS.PLAY_COMPLETED,
      limit 
    });
  }

  getRecentSearches(limit = 10) {
    const searches = this.getEvents({ type: BEHAVIOR_EVENTS.SEARCHED });
    const unique = [];
    const seen = new Set();
    
    for (const event of searches) {
      const query = event.metadata.query;
      if (query && !seen.has(query.toLowerCase())) {
        seen.add(query.toLowerCase());
        unique.push(event);
        if (unique.length >= limit) break;
      }
    }
    
    return unique;
  }

  getFavoriteGenres(limit = 5) {
    const genres = Object.entries(this.aggregated.genres)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id, count]) => ({ id: parseInt(id), count }));
    
    return genres;
  }

  getCompletionRate() {
    const total = this.aggregated.completedCount + this.aggregated.abandonedCount;
    if (total === 0) return 0;
    return this.aggregated.completedCount / total;
  }

  getWatchTimeStats() {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    
    const today = this.events.filter(e => 
      e.type === BEHAVIOR_EVENTS.PLAY_COMPLETED && 
      e.timestamp > now - day
    ).reduce((sum, e) => sum + (e.metadata.duration || 0), 0);

    const week = this.events.filter(e => 
      e.type === BEHAVIOR_EVENTS.PLAY_COMPLETED && 
      e.timestamp > now - 7 * day
    ).reduce((sum, e) => sum + (e.metadata.duration || 0), 0);

    return {
      total: this.aggregated.totalWatchTime,
      today,
      week,
      averagePerDay: this.aggregated.totalWatchTime / Math.max(1, Math.ceil((now - (this.events[0]?.timestamp || now)) / day))
    };
  }

  onEvent(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  async clear() {
    this.events = [];
    this.aggregated = {
      genres: {},
      actors: {},
      directors: {},
      years: {},
      languages: {},
      keywords: {},
      contentTypes: {},
      totalWatchTime: 0,
      completedCount: 0,
      abandonedCount: 0
    };
    
    try {
      await db.clear('behaviorEvents');
    } catch (e) {
      console.warn('Failed to clear behavior events:', e);
    }
  }

  async export() {
    await this.init();
    return {
      events: this.events,
      aggregated: this.aggregated,
      exportedAt: Date.now()
    };
  }
}

export const behaviorEngine = new UserBehaviorEngine();
export default behaviorEngine;
