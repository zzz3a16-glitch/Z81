/**
 * WatchlistManager - Advanced watchlists with drag & drop
 */

import { db } from '../storage/Database.js';
import { behaviorEngine, BEHAVIOR_EVENTS } from '../behavior/UserBehaviorEngine.js';

export class WatchlistManager {
  constructor() {
    this.lists = new Map();
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    
    try {
      const lists = await db.getAll('watchlists');
      
      if (lists.length === 0) {
        // Create default lists
        await this.createDefaultLists();
      } else {
        lists.forEach(list => this.lists.set(list.id, list));
      }
    } catch (e) {
      console.warn('Failed to load watchlists:', e);
      await this.createDefaultLists();
    }
    
    this.initialized = true;
  }

  async createDefaultLists() {
    const defaults = [
      { id: 'want-to-watch', name: 'أريد مشاهدته', description: 'أفلام ومسلسلات أريد مشاهدتها', icon: 'bookmark', color: '#8b5cf6', sortOrder: 0, isDefault: true },
      { id: 'favorites', name: 'المفضلة', description: 'المحتوى المفضل لدي', icon: 'heart', color: '#ef4444', sortOrder: 1, isDefault: true },
      { id: 'family', name: 'العائلة', description: 'للمشاهدة العائلية', icon: 'users', color: '#10b981', sortOrder: 2, isDefault: false },
      { id: 'watch-later', name: 'المشاهدة لاحقاً', description: 'للمشاهدة في وقت لاحق', icon: 'clock', color: '#f59e0b', sortOrder: 3, isDefault: true }
    ];

    for (const list of defaults) {
      const fullList = {
        ...list,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        items: []
      };
      
      this.lists.set(list.id, fullList);
      
      try {
        await db.put('watchlists', fullList);
      } catch {}
    }
  }

  async createList(name, options = {}) {
    await this.init();
    
    const id = `list-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const list = {
      id,
      name,
      description: options.description || '',
      icon: options.icon || 'list',
      color: options.color || '#8b5cf6',
      sortOrder: this.lists.size,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isDefault: false,
      items: [],
      ...options
    };

    this.lists.set(id, list);
    
    try {
      await db.put('watchlists', list);
    } catch (e) {
      console.warn('Failed to save watchlist:', e);
    }

    return list;
  }

  async getList(listId) {
    await this.init();
    return this.lists.get(listId) || null;
  }

  async getAllLists() {
    await this.init();
    return Array.from(this.lists.values()).sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async addToList(listId, media) {
    await this.init();
    
    const list = this.lists.get(listId);
    if (!list) throw new Error('Watchlist not found');

    // Check duplicate
    const exists = list.items.some(item => 
      item.mediaId === media.id && item.mediaType === (media.media_type || media.type || 'movie')
    );
    
    if (exists) {
      return { success: false, reason: 'already_exists' };
    }

    const item = {
      id: `${listId}-${media.id}-${Date.now()}`,
      listId,
      mediaId: media.id,
      mediaType: media.media_type || media.type || 'movie',
      title: media.title || media.name,
      poster_path: media.poster_path,
      addedAt: Date.now(),
      media: media // Store full media for quick access
    };

    list.items.push(item);
    list.updatedAt = Date.now();

    try {
      await db.put('watchlists', list);
      await db.put('watchlistItems', item);
      
      behaviorEngine.track(BEHAVIOR_EVENTS.ADDED_TO_WATCHLIST, {
        mediaId: media.id,
        mediaType: item.mediaType,
        listId
      });
    } catch (e) {
      console.warn('Failed to add to watchlist:', e);
    }

    window.dispatchEvent(new CustomEvent('watchlistupdate', { detail: { listId, action: 'added', item } }));

    return { success: true, item };
  }

  async removeFromList(listId, mediaId) {
    await this.init();
    
    const list = this.lists.get(listId);
    if (!list) throw new Error('Watchlist not found');

    const itemIndex = list.items.findIndex(item => item.mediaId == mediaId);
    if (itemIndex === -1) {
      return { success: false, reason: 'not_found' };
    }

    const [removed] = list.items.splice(itemIndex, 1);
    list.updatedAt = Date.now();

    try {
      await db.put('watchlists', list);
      await db.delete('watchlistItems', removed.id);
      
      behaviorEngine.track(BEHAVIOR_EVENTS.REMOVED_FROM_WATCHLIST, {
        mediaId,
        mediaType: removed.mediaType,
        listId
      });
    } catch (e) {
      console.warn('Failed to remove from watchlist:', e);
    }

    window.dispatchEvent(new CustomEvent('watchlistupdate', { detail: { listId, action: 'removed', mediaId } }));

    return { success: true, removed };
  }

  async reorderList(listId, newOrder) {
    await this.init();
    
    const list = this.lists.get(listId);
    if (!list) throw new Error('Watchlist not found');

    // newOrder is array of mediaIds in new order
    const reordered = [];
    newOrder.forEach(mediaId => {
      const item = list.items.find(i => i.mediaId == mediaId);
      if (item) reordered.push(item);
    });

    // Add any items not in newOrder at the end
    list.items.forEach(item => {
      if (!reordered.find(r => r.mediaId === item.mediaId)) {
        reordered.push(item);
      }
    });

    list.items = reordered;
    list.updatedAt = Date.now();

    try {
      await db.put('watchlists', list);
    } catch {}

    window.dispatchEvent(new CustomEvent('watchlistupdate', { detail: { listId, action: 'reordered' } }));

    return list;
  }

  async isInList(listId, mediaId) {
    await this.init();
    const list = this.lists.get(listId);
    if (!list) return false;
    return list.items.some(item => item.mediaId == mediaId);
  }

  async isInAnyList(mediaId) {
    await this.init();
    const results = [];
    
    for (const list of this.lists.values()) {
      if (list.items.some(item => item.mediaId == mediaId)) {
        results.push(list.id);
      }
    }
    
    return results;
  }

  async getListItems(listId, options = {}) {
    await this.init();
    const list = this.lists.get(listId);
    if (!list) return [];

    let items = [...list.items];

    if (options.sortBy === 'rating') {
      items.sort((a, b) => (b.media?.vote_average || 0) - (a.media?.vote_average || 0));
    } else if (options.sortBy === 'date') {
      items.sort((a, b) => b.addedAt - a.addedAt);
    } else if (options.sortBy === 'title') {
      items.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    }

    if (options.limit) {
      items = items.slice(0, options.limit);
    }

    return items;
  }

  async deleteList(listId) {
    await this.init();
    
    const list = this.lists.get(listId);
    if (!list) return false;
    
    if (list.isDefault) {
      throw new Error('Cannot delete default list');
    }

    this.lists.delete(listId);

    try {
      await db.delete('watchlists', listId);
      // Delete all items
      const items = await db.getByIndex('watchlistItems', 'listId', listId);
      for (const item of items) {
        await db.delete('watchlistItems', item.id);
      }
    } catch {}

    window.dispatchEvent(new CustomEvent('watchlistupdate', { detail: { listId, action: 'deleted' } }));

    return true;
  }

  async exportList(listId) {
    await this.init();
    const list = this.lists.get(listId);
    if (!list) throw new Error('List not found');

    return {
      ...list,
      exportedAt: new Date().toISOString(),
      version: '2.0.0'
    };
  }

  async importList(data) {
    await this.init();
    
    if (!data.name || !data.items) {
      throw new Error('Invalid list format');
    }

    const list = await this.createList(data.name, {
      description: data.description,
      icon: data.icon,
      color: data.color
    });

    // Import items
    for (const item of data.items) {
      try {
        await this.addToList(list.id, item.media || { id: item.mediaId, title: item.title, poster_path: item.poster_path });
      } catch {}
    }

    return list;
  }

  async getStats() {
    await this.init();
    
    const stats = {
      totalLists: this.lists.size,
      totalItems: 0,
      byType: { movie: 0, tv: 0 },
      lists: []
    };

    for (const list of this.lists.values()) {
      stats.totalItems += list.items.length;
      stats.lists.push({
        id: list.id,
        name: list.name,
        count: list.items.length
      });

      list.items.forEach(item => {
        if (item.mediaType === 'movie') stats.byType.movie++;
        else if (item.mediaType === 'tv') stats.byType.tv++;
      });
    }

    return stats;
  }
}

export const watchlistManager = new WatchlistManager();
export default watchlistManager;
