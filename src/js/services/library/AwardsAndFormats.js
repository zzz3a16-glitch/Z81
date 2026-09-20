/**
 * Awards, Formats, Content Themes, and other library intelligence systems
 */

import { db } from '../storage/Database.js';
import { tmdbClient } from '../tmdb/TMDBClient.js';

// ========== AWARDS & ACHIEVEMENTS ==========
export class AwardManager {
  constructor() {
    this.awards = [
      { id: 'oscar-winner', name: 'فائز بالأوسكار', icon: 'award', color: '#ffd700', query: { with_keywords: '1956' } },
      { id: 'oscar-nominee', name: 'مرشح للأوسكار', icon: 'award', color: '#c0c0c0', query: {} },
      { id: 'palme-dor', name: 'السعفة الذهبية', icon: 'award', color: '#228b22', query: {} },
      { id: 'golden-lion', name: 'الأسد الذهبي', icon: 'award', color: '#ffd700', query: {} },
      { id: 'emmy', name: 'جائزة إيمي', icon: 'tv', color: '#8b5cf6', query: {} }
    ];
  }

  async getAllAwards() {
    return this.awards;
  }

  async getAwardWinners(awardId) {
    const award = this.awards.find(a => a.id === awardId);
    if (!award) return [];
    
    try {
      // Oscar winners would be searched via keywords or specific queries
      // For now, return popular highly-rated movies as proxy
      const result = await tmdbClient.discoverMovie({
        'vote_average.gte': 8.0,
        'vote_count.gte': 1000,
        sort_by: 'vote_average.desc',
        page: 1
      });
      return result.results || [];
    } catch {
      return [];
    }
  }
}

// ========== FORMATS ==========
export class FormatManager {
  constructor() {
    this.formats = [
      { id: '4k', name: '4K Ultra HD', icon: 'tv', description: '2160p فائقة الدقة', filter: 'quality:2160p' },
      { id: 'blu-ray', name: 'Blu-ray', icon: 'disc', description: 'جودة Blu-ray الأصلية', filter: 'quality:blu-ray' },
      { id: 'remux', name: 'Remux', icon: 'film', description: 'نسخة غير مضغوطة من Blu-ray', filter: 'remux' },
      { id: 'web-dl', name: 'WEB-DL', icon: 'users', description: 'محملة من خدمات البث', filter: 'quality:web-dl' },
      { id: 'hdr', name: 'HDR', icon: 'sparkle', description: 'مدى ديناميكي عالي', filter: 'hdr' },
      { id: 'dolby-vision', name: 'Dolby Vision', icon: 'sparkle', description: 'تقنية Dolby Vision', filter: 'dolby-vision' },
      { id: 'imax', name: 'IMAX', icon: 'film', description: 'نسبة عرض IMAX', filter: 'imax' }
    ];
  }

  async getAllFormats() {
    return this.formats;
  }

  async getByFormat(formatId) {
    const format = this.formats.find(f => f.id === formatId);
    return format || null;
  }
}

// ========== CONTENT THEMES ==========
export class ContentThemeManager {
  constructor() {
    this.themes = [
      { id: 'time-travel', name: 'السفر عبر الزمن', icon: 'clock', keyword: 4379, description: 'قصص السفر عبر الزمن' },
      { id: 'dystopia', name: 'الديستوبيا', icon: 'alert', keyword: 4565, description: 'عوالم مستقبلية قاتمة' },
      { id: 'superhero', name: 'الأبطال الخارقون', icon: 'sparkle', keyword: 9715, description: 'أفلام الأبطال الخارقين' },
      { id: 'heist', name: 'السرقة', icon: 'key', keyword: 10090, description: 'أفلام السرقة والاحتيال' },
      { id: 'space', name: 'الفضاء', icon: 'sparkle', keyword: 9882, description: 'استكشاف الفضاء' },
      { id: 'zombie', name: 'الزومبي', icon: 'alert', keyword: 12377, description: 'أفلام الزومبي' },
      { id: 'martial-arts', name: 'فنون القتال', icon: 'star', keyword: 779, description: 'أفلام فنون القتال' },
      { id: 'post-apocalyptic', name: 'ما بعد نهاية العالم', icon: 'alert', keyword: 4458, description: 'عوالم ما بعد الكارثة' },
      { id: 'spy', name: 'التجسس', icon: 'eye', keyword: 470, description: 'أفلام التجسس' },
      { id: 'based-on-true', name: 'قصة حقيقية', icon: 'check', keyword: 9672, description: 'مبني على قصة حقيقية' }
    ];
  }

  async getAllThemes() {
    return this.themes;
  }

  async getByTheme(themeId) {
    const theme = this.themes.find(t => t.id === themeId);
    if (!theme) return [];

    try {
      const result = await tmdbClient.discoverMovie({
        with_keywords: theme.keyword,
        sort_by: 'popularity.desc',
        page: 1
      });
      return result.results || [];
    } catch {
      return [];
    }
  }
}

// ========== MISSING PIECES DETECTION ==========
export class MissingPiecesDetector {
  async detectMissing() {
    const missing = {
      sequels: [],
      prequels: [],
      seasons: [],
      episodes: [],
      total: 0
    };

    try {
      // Check franchises for missing sequels
      const franchises = await db.getSetting('franchises', []);
      
      for (const franchise of franchises) {
        if (!franchise.items || franchise.items.length === 0) continue;
        
        // Try to find if franchise has more movies via TMDB collection
        for (const item of franchise.items) {
          try {
            const details = await tmdbClient.getMovieDetails(item.mediaId, { append_to_response: 'belongs_to_collection' }).catch(() => null);
            if (details?.belongs_to_collection) {
              const collection = await tmdbClient.getCollection(details.belongs_to_collection.id).catch(() => null);
              if (collection?.parts) {
                const existingIds = new Set(franchise.items.map(i => i.mediaId));
                const missingParts = collection.parts.filter(p => !existingIds.has(p.id));
                
                missingParts.forEach(part => {
                  missing.sequels.push({
                    type: 'movie',
                    title: part.title,
                    franchise: franchise.name,
                    franchiseId: franchise.id,
                    media: part,
                    reason: 'جزء مفقود من السلسلة'
                  });
                });
              }
            }
          } catch {}
        }
      }

      // Check for missing TV seasons
      const tvShows = await db.getAll('tvshows').catch(() => []);
      for (const showWrapper of tvShows.slice(0, 10)) { // Limit to 10 for performance
        try {
          const show = showWrapper.value || showWrapper;
          if (!show.id) continue;
          
          const details = await tmdbClient.getTVDetails(show.id).catch(() => null);
          if (details?.seasons) {
            const existingSeasons = show.seasons || [];
            const missingSeasons = details.seasons.filter(s => 
              s.season_number > 0 && !existingSeasons.includes(s.season_number)
            );
            
            missingSeasons.forEach(season => {
              missing.seasons.push({
                type: 'season',
                title: `${show.name || show.title} - الموسم ${season.season_number}`,
                showId: show.id,
                seasonNumber: season.season_number,
                media: season,
                reason: 'موسم مفقود'
              });
            });
          }
        } catch {}
      }

      missing.total = missing.sequels.length + missing.prequels.length + missing.seasons.length + missing.episodes.length;
      
    } catch (e) {
      console.warn('Missing detection failed:', e);
    }

    return missing;
  }
}

// ========== DUPLICATE LAB ==========
export class DuplicateLab {
  async analyzeDuplicates() {
    try {
      const { mediaScanner } = await import('../scanner/MediaScanner.js');
      const duplicates = await mediaScanner.detectDuplicates ? await mediaScanner.detectDuplicates() : [];
      
      const analysis = {
        total: duplicates.length,
        byType: {},
        recommendations: [],
        groups: []
      };

      // Group duplicates
      const groups = new Map();
      
      duplicates.forEach(dup => {
        const key = `${dup.title || dup.file?.title}-${dup.year || dup.file?.year}`;
        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key).push(dup);
      });

      analysis.groups = Array.from(groups.values())
        .filter(g => g.length > 1)
        .map(group => ({
          title: group[0].title || group[0].file?.title || 'Unknown',
          count: group.length,
          items: group,
          totalSize: group.reduce((sum, item) => sum + (item.size || item.file?.size || 0), 0),
          recommendation: this.getRecommendation(group)
        }));

      // By type
      analysis.byType = {
        exact: analysis.groups.filter(g => g.items.every(i => i.probability >= 90)).length,
        likely: analysis.groups.filter(g => g.items.some(i => i.probability >= 70 && i.probability < 90)).length,
        possible: analysis.groups.filter(g => g.items.some(i => i.probability < 70)).length
      };

      return analysis;
    } catch (e) {
      return {
        total: 0,
        byType: { exact: 0, likely: 0, possible: 0 },
        recommendations: [],
        groups: [],
        error: e.message
      };
    }
  }

  getRecommendation(group) {
    // Recommend keeping highest quality
    const sorted = [...group].sort((a, b) => {
      const qualityScore = { '2160p': 4, '1080p': 3, '720p': 2, '480p': 1 };
      const aQ = qualityScore[a.quality || a.file?.quality] || 0;
      const bQ = qualityScore[b.quality || b.file?.quality] || 0;
      if (aQ !== bQ) return bQ - aQ;
      return (b.size || b.file?.size || 0) - (a.size || a.file?.size || 0);
    });

    return {
      keep: sorted[0],
      remove: sorted.slice(1),
      reason: 'الاحتفاظ بأعلى جودة'
    };
  }
}

// ========== PERSONAL METADATA LAYERS ==========
export class MetadataLayerManager {
  constructor() {
    this.layers = ['personal', 'community', 'official'];
  }

  async addPersonalNote(mediaId, mediaType, note, tags = []) {
    const layer = {
      id: `note-${Date.now()}`,
      mediaId,
      mediaType,
      type: 'note',
      content: note,
      tags,
      layer: 'personal',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    try {
      const existing = await db.getSetting(`metadata-layers-${mediaId}`, []);
      existing.push(layer);
      await db.setSetting(`metadata-layers-${mediaId}`, existing);
      return layer;
    } catch (e) {
      console.warn('Failed to save note:', e);
      return null;
    }
  }

  async getLayers(mediaId) {
    try {
      return await db.getSetting(`metadata-layers-${mediaId}`, []);
    } catch {
      return [];
    }
  }

  async getAllPersonalNotes() {
    try {
      const all = [];
      // This would need to iterate through all metadata keys - simplified for now
      const keys = ['metadata-layers'];
      return all;
    } catch {
      return [];
    }
  }
}

// ========== AUDIT LOG ==========
export class AuditLogManager {
  async log(action, entity, details = {}) {
    const entry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      action, // created, updated, deleted, watched, rated, etc.
      entity, // movie, tv, watchlist, etc.
      entityId: details.entityId || null,
      details,
      timestamp: Date.now(),
      user: 'local'
    };

    try {
      const logs = await db.getSetting('auditLog', []);
      logs.unshift(entry);
      // Keep last 1000 entries
      if (logs.length > 1000) logs.length = 1000;
      await db.setSetting('auditLog', logs);
    } catch {}

    return entry;
  }

  async getLogs(filters = {}) {
    try {
      let logs = await db.getSetting('auditLog', []);
      
      if (filters.action) {
        logs = logs.filter(l => l.action === filters.action);
      }
      if (filters.entity) {
        logs = logs.filter(l => l.entity === filters.entity);
      }
      if (filters.since) {
        logs = logs.filter(l => l.timestamp >= filters.since);
      }
      
      return logs;
    } catch {
      return [];
    }
  }

  async getStats() {
    const logs = await this.getLogs();
    const byAction = {};
    const byEntity = {};
    
    logs.forEach(log => {
      byAction[log.action] = (byAction[log.action] || 0) + 1;
      byEntity[log.entity] = (byEntity[log.entity] || 0) + 1;
    });

    return {
      total: logs.length,
      byAction,
      byEntity,
      recent: logs.slice(0, 10)
    };
  }
}

// ========== REVIEW QUEUE ==========
export class ReviewQueueManager {
  async getQueue() {
    try {
      const queue = await db.getSetting('reviewQueue', []);
      return queue;
    } catch {
      return [];
    }
  }

  async addToQueue(item, reason = 'needs_review') {
    const entry = {
      id: `review-${Date.now()}`,
      ...item,
      reason,
      addedAt: Date.now(),
      status: 'pending'
    };

    try {
      const queue = await this.getQueue();
      queue.push(entry);
      await db.setSetting('reviewQueue', queue);
      return entry;
    } catch {
      return null;
    }
  }

  async resolveQueueItem(id, resolution) {
    try {
      const queue = await this.getQueue();
      const index = queue.findIndex(item => item.id === id);
      if (index === -1) return false;
      
      queue[index].status = 'resolved';
      queue[index].resolution = resolution;
      queue[index].resolvedAt = Date.now();
      
      await db.setSetting('reviewQueue', queue);
      return true;
    } catch {
      return false;
    }
  }
}

// ========== LIBRARY SNAPSHOTS ==========
export class SnapshotManager {
  async createSnapshot(name, description = '') {
    try {
      const snapshot = {
        id: `snapshot-${Date.now()}`,
        name: name || `لقطة ${new Date().toLocaleDateString('ar-SA')}`,
        description,
        createdAt: Date.now(),
        data: await db.exportAll(),
        stats: await db.getStats().catch(() => ({}))
      };

      const snapshots = await db.getSetting('snapshots', []);
      snapshots.unshift(snapshot);
      
      // Keep only last 10 snapshots to save space
      if (snapshots.length > 10) snapshots.length = 10;
      
      await db.setSetting('snapshots', snapshots);
      return snapshot;
    } catch (e) {
      console.warn('Snapshot failed:', e);
      return null;
    }
  }

  async getSnapshots() {
    try {
      return await db.getSetting('snapshots', []);
    } catch {
      return [];
    }
  }

  async restoreSnapshot(snapshotId) {
    try {
      const snapshots = await this.getSnapshots();
      const snapshot = snapshots.find(s => s.id === snapshotId);
      if (!snapshot) throw new Error('Snapshot not found');
      
      await db.importAll(snapshot.data);
      return { success: true, snapshot };
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
}

// ========== COMMAND CENTER ==========
export class CommandCenter {
  async getDashboard() {
    const [
      health,
      storage,
      franchises,
      collections,
      auditStats
    ] = await Promise.all([
      import('./LibraryIntelligence.js').then(m => m.healthCenter.checkHealth()).catch(() => ({ healthy: true, issues: [] })),
      import('./LibraryIntelligence.js').then(m => m.storageIntelligence.getStorageStats()).catch(() => ({})),
      import('./LibraryIntelligence.js').then(m => m.franchiseManager.getAllFranchises()).catch(() => []),
      import('./LibraryIntelligence.js').then(m => m.smartCollectionManager.getAllCollections()).catch(() => []),
      import('./AwardsAndFormats.js').then(m => new AuditLogManager().getStats()).catch(() => ({ total: 0 }))
    ]);

    return {
      health,
      storage,
      franchises: franchises.length,
      collections: collections.length,
      auditTotal: auditStats.total || 0,
      generatedAt: Date.now()
    };
  }
}

// Singletons
export const awardManager = new AwardManager();
export const formatManager = new FormatManager();
export const contentThemeManager = new ContentThemeManager();
export const missingPiecesDetector = new MissingPiecesDetector();
export const duplicateLab = new DuplicateLab();
export const metadataLayerManager = new MetadataLayerManager();
export const auditLogManager = new AuditLogManager();
export const reviewQueueManager = new ReviewQueueManager();
export const snapshotManager = new SnapshotManager();
export const commandCenter = new CommandCenter();
