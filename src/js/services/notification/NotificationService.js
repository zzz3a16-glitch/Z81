/**
 * NotificationService - Smart notification center
 */

import { db } from '../storage/Database.js';

export const NOTIFICATION_TYPES = {
  NEW_EPISODE: 'NEW_EPISODE',
  NEW_LIBRARY_CONTENT: 'NEW_LIBRARY_CONTENT',
  RECOMMENDATION: 'RECOMMENDATION',
  RESUME_REMINDER: 'RESUME_REMINDER',
  SCAN_COMPLETED: 'SCAN_COMPLETED',
  NEW_EPISODES_FOUND: 'NEW_EPISODES_FOUND',
  FILE_MISSING: 'FILE_MISSING',
  TMDB_UPDATED: 'TMDB_UPDATED',
  WATCHLIST_AVAILABLE: 'WATCHLIST_AVAILABLE',
  ACHIEVEMENT: 'ACHIEVEMENT',
  BACKUP_COMPLETED: 'BACKUP_COMPLETED',
  BACKUP_FAILED: 'BACKUP_FAILED'
};

export class NotificationService {
  constructor() {
    this.notifications = [];
    this.preferences = this.loadPreferences();
    this.listeners = [];
    this.initialized = false;
  }

  loadPreferences() {
    try {
      const stored = localStorage.getItem('zpopcorn-notification-prefs');
      if (stored) return JSON.parse(stored);
    } catch {}
    
    return {
      [NOTIFICATION_TYPES.NEW_EPISODE]: true,
      [NOTIFICATION_TYPES.NEW_LIBRARY_CONTENT]: true,
      [NOTIFICATION_TYPES.RECOMMENDATION]: true,
      [NOTIFICATION_TYPES.RESUME_REMINDER]: true,
      [NOTIFICATION_TYPES.SCAN_COMPLETED]: true,
      [NOTIFICATION_TYPES.NEW_EPISODES_FOUND]: true,
      [NOTIFICATION_TYPES.FILE_MISSING]: true,
      [NOTIFICATION_TYPES.TMDB_UPDATED]: false,
      [NOTIFICATION_TYPES.WATCHLIST_AVAILABLE]: true,
      [NOTIFICATION_TYPES.ACHIEVEMENT]: true,
      [NOTIFICATION_TYPES.BACKUP_COMPLETED]: true,
      [NOTIFICATION_TYPES.BACKUP_FAILED]: true
    };
  }

  savePreferences() {
    try {
      localStorage.setItem('zpopcorn-notification-prefs', JSON.stringify(this.preferences));
    } catch {}
  }

  async init() {
    if (this.initialized) return;
    
    try {
      this.notifications = await db.getAll('notifications') || [];
      this.notifications.sort((a, b) => b.createdAt - a.createdAt);
    } catch {
      this.notifications = [];
    }
    
    this.initialized = true;
  }

  async create(notification) {
    await this.init();
    
    if (!this.preferences[notification.type]) {
      return null; // User disabled this type
    }

    const newNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      createdAt: Date.now(),
      read: false,
      entityType: notification.entityType || null,
      entityId: notification.entityId || null,
      action: notification.action || null,
      icon: notification.icon || this.getIconForType(notification.type),
      ...notification
    };

    this.notifications.unshift(newNotification);
    
    // Keep only last 100
    if (this.notifications.length > 100) {
      this.notifications = this.notifications.slice(0, 100);
    }

    try {
      await db.put('notifications', newNotification);
    } catch (e) {
      console.warn('Failed to persist notification:', e);
    }

    this.notifyListeners(newNotification);
    
    // Show toast
    this.showToast(newNotification);

    return newNotification;
  }

  getIconForType(type) {
    const icons = {
      [NOTIFICATION_TYPES.NEW_EPISODE]: 'tv',
      [NOTIFICATION_TYPES.NEW_LIBRARY_CONTENT]: 'film',
      [NOTIFICATION_TYPES.RECOMMENDATION]: 'bulb',
      [NOTIFICATION_TYPES.RESUME_REMINDER]: 'play',
      [NOTIFICATION_TYPES.SCAN_COMPLETED]: 'check',
      [NOTIFICATION_TYPES.NEW_EPISODES_FOUND]: 'sparkle',
      [NOTIFICATION_TYPES.FILE_MISSING]: 'alert',
      [NOTIFICATION_TYPES.TMDB_UPDATED]: 'refresh',
      [NOTIFICATION_TYPES.WATCHLIST_AVAILABLE]: 'pin',
      [NOTIFICATION_TYPES.ACHIEVEMENT]: 'award',
      [NOTIFICATION_TYPES.BACKUP_COMPLETED]: 'save',
      [NOTIFICATION_TYPES.BACKUP_FAILED]: 'alert'
    };
    return icons[type] || 'bell';
  }

  showToast(notification) {
    window.dispatchEvent(new CustomEvent('showtoast', {
      detail: {
        type: notification.type === NOTIFICATION_TYPES.FILE_MISSING || notification.type === NOTIFICATION_TYPES.BACKUP_FAILED ? 'error' : 'info',
        title: notification.title,
        message: notification.message,
        duration: 5000
      }
    }));
  }

  async markAsRead(id) {
    const notification = this.notifications.find(n => n.id === id);
    if (notification) {
      notification.read = true;
      try {
        await db.put('notifications', notification);
      } catch {}
      this.notifyListeners();
    }
  }

  async markAllAsRead() {
    this.notifications.forEach(n => n.read = true);
    try {
      for (const notif of this.notifications) {
        await db.put('notifications', notif);
      }
    } catch {}
    this.notifyListeners();
  }

  async clear() {
    this.notifications = [];
    try {
      await db.clear('notifications');
    } catch {}
    this.notifyListeners();
  }

  async delete(id) {
    this.notifications = this.notifications.filter(n => n.id !== id);
    try {
      await db.delete('notifications', id);
    } catch {}
    this.notifyListeners();
  }

  getUnreadCount() {
    return this.notifications.filter(n => !n.read).length;
  }

  getAll(filter = {}) {
    let filtered = [...this.notifications];
    
    if (filter.type) {
      filtered = filtered.filter(n => n.type === filter.type);
    }
    
    if (filter.unreadOnly) {
      filtered = filtered.filter(n => !n.read);
    }
    
    if (filter.limit) {
      filtered = filtered.slice(0, filter.limit);
    }
    
    return filtered;
  }

  setPreference(type, enabled) {
    this.preferences[type] = enabled;
    this.savePreferences();
  }

  getPreferences() {
    return { ...this.preferences };
  }

  onUpdate(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  notifyListeners(newNotification = null) {
    this.listeners.forEach(cb => {
      try {
        cb(this.notifications, newNotification);
      } catch {}
    });
    
    window.dispatchEvent(new CustomEvent('notificationsupdate', {
      detail: { notifications: this.notifications, new: newNotification }
    }));
  }

  // Convenience methods
  async notifyNewEpisode(showName, episodeCount, showId) {
    return this.create({
      type: NOTIFICATION_TYPES.NEW_EPISODE,
      title: 'حلقات جديدة متاحة',
      message: `تم اكتشاف ${episodeCount} حلقات جديدتين من مسلسل ${showName}`,
      entityType: 'tv',
      entityId: showId,
      action: `/tv/${showId}`
    });
  }

  async notifyScanCompleted(fileCount) {
    return this.create({
      type: NOTIFICATION_TYPES.SCAN_COMPLETED,
      title: 'اكتمل الفحص',
      message: `تم فحص ${fileCount} ملف بنجاح`,
      action: '/library'
    });
  }

  async notifyAchievement(title, message) {
    return this.create({
      type: NOTIFICATION_TYPES.ACHIEVEMENT,
      title,
      message,
      action: '/analytics'
    });
  }

  async notifyRecommendation(mediaTitle, mediaId, mediaType) {
    return this.create({
      type: NOTIFICATION_TYPES.RECOMMENDATION,
      title: 'توصية جديدة',
      message: `نعتقد أنك ستحب ${mediaTitle}`,
      entityType: mediaType,
      entityId: mediaId,
      action: `/${mediaType}/${mediaId}`
    });
  }
}

export const notificationService = new NotificationService();
export default notificationService;
