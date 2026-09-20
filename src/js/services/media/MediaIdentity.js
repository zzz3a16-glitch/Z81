/**
 * Media Identity System - Production Grade
 * Stable internal identifiers, edition management, watch journey, personal archive
 */

import { db } from '../storage/Database.js';
import { tmdbClient } from '../tmdb/TMDBClient.js';

export class MediaIdentityManager {
  constructor() {
    this.cache = new Map();
  }

  /**
   * Generate stable internal ID from TMDB ID + type
   * Prevents duplicates even if filename/path changes
   */
  generateIdentity(tmdbId, mediaType, extra = {}) {
    // Stable ID: mediaType:tmdbId
    // For episodes: tv:tmdbId:season:episode
    const base = `${mediaType}:${tmdbId}`;
    if (extra.season !== undefined && extra.episode !== undefined) {
      return `${base}:s${extra.season}e${extra.episode}`;
    }
    return base;
  }

  async resolveIdentity(file, parsedInfo) {
    // Try to resolve TMDB ID from parsed info
    let tmdbData = null;
    let mediaType = 'movie';
    let confidence = 0;

    // Check if already has identity
    if (file.identity) {
      return { identity: file.identity, confidence: 1, source: 'existing' };
    }

    // Try TMDB search
    try {
      if (parsedInfo.season !== null && parsedInfo.episode !== null) {
        mediaType = 'tv';
        const results = await tmdbClient.searchTV(parsedInfo.title).catch(() => ({ results: [] }));
        if (results.results?.[0]) {
          tmdbData = results.results[0];
          confidence = 0.8;
        }
      } else {
        // Try movie first, then TV
        const movieResults = await tmdbClient.searchMovie(parsedInfo.title, 1, { year: parsedInfo.year }).catch(() => ({ results: [] }));
        if (movieResults.results?.[0]) {
          tmdbData = movieResults.results[0];
          mediaType = 'movie';
          confidence = parsedInfo.year ? 0.9 : 0.7;
        } else {
          const tvResults = await tmdbClient.searchTV(parsedInfo.title).catch(() => ({ results: [] }));
          if (tvResults.results?.[0]) {
            tmdbData = tvResults.results[0];
            mediaType = 'tv';
            confidence = 0.6;
          }
        }
      }
    } catch (e) {
      console.warn('TMDB identity resolution failed:', e);
    }

    if (tmdbData) {
      const identity = this.generateIdentity(tmdbData.id, mediaType, parsedInfo);
      return {
        identity,
        tmdbId: tmdbData.id,
        mediaType,
        tmdbData,
        confidence,
        source: 'tmdb',
        parsedInfo
      };
    }

    // Fallback: local identity based on file hash + title
    const localId = `local:${this.hashString(parsedInfo.title + (parsedInfo.year || ''))}`;
    return {
      identity: localId,
      tmdbId: null,
      mediaType: parsedInfo.season !== null ? 'tv' : 'movie',
      tmdbData: null,
      confidence: 0.3,
      source: 'local',
      parsedInfo
    };
  }

  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  async saveIdentity(identityData) {
    try {
      await db.put('metadata', {
        key: `identity:${identityData.identity}`,
        value: identityData,
        updatedAt: Date.now()
      });
      this.cache.set(identityData.identity, identityData);
    } catch (e) {
      console.warn('Failed to save identity:', e);
    }
  }

  async getIdentity(identityId) {
    if (this.cache.has(identityId)) {
      return this.cache.get(identityId);
    }
    try {
      const stored = await db.get('metadata', `identity:${identityId}`);
      if (stored) {
        this.cache.set(identityId, stored.value);
        return stored.value;
      }
    } catch {}
    return null;
  }
}

export class EditionManager {
  constructor() {
    this.editions = new Map();
  }

  async init() {
    try {
      const stored = await db.get('metadata', 'editions:all');
      if (stored?.value) {
        Object.entries(stored.value).forEach(([id, data]) => {
          this.editions.set(id, data);
        });
      }
    } catch {}
  }

  async addEdition(workIdentity, fileInfo, editionType = 'default') {
    await this.init();
    
    const editionId = `${workIdentity}:${editionType}:${fileInfo.fingerprint || Date.now()}`;
    
    const edition = {
      id: editionId,
      workIdentity,
      type: editionType, // '1080p', '4k', 'directors-cut', 'arabic-sub', etc.
      file: {
        path: fileInfo.path,
        size: fileInfo.size,
        fingerprint: fileInfo.fingerprint,
        quality: fileInfo.quality,
        codec: fileInfo.codec,
        container: fileInfo.container,
        resolution: fileInfo.resolution,
        duration: fileInfo.duration
      },
      addedAt: Date.now(),
      lastVerified: Date.now(),
      status: 'available', // available, missing, offline
      preferred: false
    };

    // Group by work
    if (!this.editions.has(workIdentity)) {
      this.editions.set(workIdentity, []);
    }
    
    const workEditions = this.editions.get(workIdentity);
    if (Array.isArray(workEditions)) {
      // Remove duplicate by fingerprint
      const existingIndex = workEditions.findIndex(e => e.file.fingerprint === fileInfo.fingerprint);
      if (existingIndex >= 0) {
        workEditions[existingIndex] = edition;
      } else {
        workEditions.push(edition);
      }
    } else {
      this.editions.set(workIdentity, [edition]);
    }

    await this.save();
    return edition;
  }

  async getEditions(workIdentity) {
    await this.init();
    const editions = this.editions.get(workIdentity);
    return Array.isArray(editions) ? editions : (editions ? [editions] : []);
  }

  async setPreferredEdition(workIdentity, editionId) {
    const editions = await this.getEditions(workIdentity);
    editions.forEach(e => {
      e.preferred = e.id === editionId;
    });
    await this.save();
  }

  async getPreferredEdition(workIdentity) {
    const editions = await this.getEditions(workIdentity);
    const preferred = editions.find(e => e.preferred && e.status === 'available');
    if (preferred) return preferred;
    
    // Fallback: highest quality available
    const available = editions.filter(e => e.status === 'available');
    if (available.length === 0) return null;
    
    // Sort by quality
    const qualityOrder = { '4k': 4, '2160p': 4, '1080p': 3, '720p': 2, '480p': 1 };
    available.sort((a, b) => {
      const qa = qualityOrder[a.file.quality?.toLowerCase()] || 0;
      const qb = qualityOrder[b.file.quality?.toLowerCase()] || 0;
      return qb - qa;
    });
    
    return available[0];
  }

  async markMissing(workIdentity, editionId) {
    const editions = await this.getEditions(workIdentity);
    const edition = editions.find(e => e.id === editionId);
    if (edition) {
      edition.status = 'missing';
      edition.missingSince = Date.now();
      await this.save();
    }
  }

  async save() {
    try {
      const obj = {};
      for (const [key, value] of this.editions) {
        obj[key] = value;
      }
      await db.put('metadata', {
        key: 'editions:all',
        value: obj,
        updatedAt: Date.now()
      });
    } catch (e) {
      console.warn('Failed to save editions:', e);
    }
  }
}

export class WatchJourney {
  constructor() {
    this.journeys = new Map();
  }

  async trackProgress(mediaId, mediaType, position, duration, metadata = {}) {
    const progress = Math.min(100, Math.max(0, (position / duration) * 100));
    
    const journeyEntry = {
      mediaId,
      mediaType,
      position,
      duration,
      progress,
      timestamp: Date.now(),
      ...metadata
    };

    try {
      // Save to watchProgress
      await db.put('watchProgress', {
        mediaId: mediaId.toString(),
        mediaType,
        position,
        duration,
        progress,
        updatedAt: Date.now(),
        lastWatched: Date.now(),
        completed: progress >= 95,
        startedAt: metadata.startedAt || Date.now()
      });

      // Save to watchHistory if significant progress
      if (progress > 5) {
        const historyId = `${mediaId}-${Date.now()}`;
        await db.put('watchHistory', {
          id: historyId,
          mediaId: mediaId.toString(),
          mediaType,
          position,
          duration,
          progress,
          watchedAt: Date.now(),
          completed: progress >= 95
        });
      }

      // For episodes, track series progress
      if (mediaType === 'episode' && metadata.seriesId) {
        await this.updateSeriesProgress(metadata.seriesId, mediaId, progress);
      }

    } catch (e) {
      console.warn('Failed to track progress:', e);
    }

    return journeyEntry;
  }

  async updateSeriesProgress(seriesId, episodeId, progress) {
    try {
      const existing = await db.get('watchProgress', `series:${seriesId}`) || {
        mediaId: `series:${seriesId}`,
        seriesId,
        episodes: {},
        completedEpisodes: 0,
        totalEpisodes: 0,
        progress: 0
      };

      existing.episodes[episodeId] = {
        progress,
        completed: progress >= 95,
        lastWatched: Date.now()
      };

      const episodes = Object.values(existing.episodes);
      existing.completedEpisodes = episodes.filter(e => e.completed).length;
      existing.totalEpisodes = episodes.length;
      existing.progress = existing.totalEpisodes > 0 ? (existing.completedEpisodes / existing.totalEpisodes) * 100 : 0;
      existing.updatedAt = Date.now();

      await db.put('watchProgress', existing);
    } catch (e) {
      console.warn('Failed to update series progress:', e);
    }
  }

  async getContinueWatching(limit = 20) {
    try {
      const allProgress = await db.getAll('watchProgress');
      const inProgress = allProgress
        .filter(p => p.progress > 5 && p.progress < 95 && !p.mediaId?.startsWith('series:'))
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
        .slice(0, limit);

      // Enrich with TMDB data if needed
      const enriched = await Promise.all(inProgress.map(async (item) => {
        try {
          if (item.mediaType === 'movie') {
            const details = await tmdbClient.getMovie(item.mediaId).catch(() => null);
            return { ...item, details };
          } else if (item.mediaType === 'tv' || item.mediaType === 'episode') {
            const details = await tmdbClient.getTV(item.mediaId).catch(() => null);
            return { ...item, details };
          }
        } catch {}
        return item;
      }));

      return enriched;
    } catch {
      return [];
    }
  }

  async getWatchHistory(limit = 50) {
    try {
      const history = await db.getAll('watchHistory');
      return history
        .sort((a, b) => (b.watchedAt || 0) - (a.watchedAt || 0))
        .slice(0, limit);
    } catch {
      return [];
    }
  }

  async getSeriesProgress(seriesId) {
    try {
      return await db.get('watchProgress', `series:${seriesId}`);
    } catch {
      return null;
    }
  }
}

export class PersonalArchive {
  constructor() {
    this.archived = new Set();
  }

  async init() {
    try {
      const stored = await db.get('metadata', 'archive:all');
      if (stored?.value) {
        this.archived = new Set(stored.value);
      }
    } catch {}
  }

  async archive(mediaId, reason = 'user') {
    await this.init();
    this.archived.add(mediaId.toString());
    
    try {
      await db.put('metadata', {
        key: `archive:${mediaId}`,
        value: {
          mediaId: mediaId.toString(),
          archivedAt: Date.now(),
          reason,
          originalData: await db.get('movies', parseInt(mediaId)).catch(() => null) || await db.get('tvshows', parseInt(mediaId)).catch(() => null)
        }
      });
      
      await db.put('metadata', {
        key: 'archive:all',
        value: Array.from(this.archived),
        updatedAt: Date.now()
      });

      // Log to audit
      const { auditLogManager } = await import('../library/AwardsAndFormats.js');
      await auditLogManager.log('archived', 'media', { entityId: mediaId, reason });

    } catch (e) {
      console.warn('Archive failed:', e);
    }
  }

  async restore(mediaId) {
    await this.init();
    this.archived.delete(mediaId.toString());
    
    try {
      await db.put('metadata', {
        key: 'archive:all',
        value: Array.from(this.archived),
        updatedAt: Date.now()
      });

      const { auditLogManager } = await import('../library/AwardsAndFormats.js');
      await auditLogManager.log('restored', 'media', { entityId: mediaId });
    } catch {}
  }

  async isArchived(mediaId) {
    await this.init();
    return this.archived.has(mediaId.toString());
  }

  async getArchived() {
    await this.init();
    return Array.from(this.archived);
  }

  async getArchivedWithData() {
    const ids = await this.getArchived();
    const result = [];
    
    for (const id of ids) {
      try {
        const archivedData = await db.get('metadata', `archive:${id}`);
        if (archivedData) {
          result.push(archivedData.value);
        }
      } catch {}
    }
    
    return result;
  }
}

// Singletons
export const mediaIdentityManager = new MediaIdentityManager();
export const editionManager = new EditionManager();
export const watchJourney = new WatchJourney();
export const personalArchive = new PersonalArchive();
