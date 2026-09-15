/**
 * BackupManager - Backup and restore system
 */

import { db } from '../storage/Database.js';

export class BackupManager {
  async createBackup(type = 'full') {
    const timestamp = new Date().toISOString();
    const backup = {
      schemaVersion: '1.0',
      appVersion: '2.0.0',
      createdAt: timestamp,
      type,
      data: {}
    };

    try {
      if (type === 'full' || type === 'database') {
        backup.data.database = await db.exportAll();
      }

      if (type === 'full' || type === 'settings') {
        backup.data.settings = {
          theme: localStorage.getItem('zpopcorn-theme'),
          region: localStorage.getItem('zpopcorn-region'),
          language: localStorage.getItem('zpopcorn-language'),
          customThemes: localStorage.getItem('zpopcorn-custom-themes'),
          notificationPrefs: localStorage.getItem('zpopcorn-notification-prefs')
        };
      }

      if (type === 'full' || type === 'watchHistory') {
        backup.data.watchHistory = await db.getAll('watchHistory').catch(() => []);
        backup.data.watchProgress = await db.getAll('watchProgress').catch(() => []);
      }

      if (type === 'full' || type === 'watchlists') {
        backup.data.watchlists = await db.getAll('watchlists').catch(() => []);
        backup.data.watchlistItems = await db.getAll('watchlistItems').catch(() => []);
      }

      if (type === 'full') {
        backup.data.ratings = await db.getAll('ratings').catch(() => []);
        backup.data.behaviorEvents = await db.getAll('behaviorEvents').catch(() => []);
        backup.data.tasteProfile = await db.getAll('tasteProfile').catch(() => []);
        backup.data.notifications = await db.getAll('notifications').catch(() => []);
        backup.data.favorites = await db.getAll('favorites').catch(() => []);
      }

      return backup;
    } catch (error) {
      console.error('Backup creation failed:', error);
      throw error;
    }
  }

  async exportBackup(type = 'full') {
    const backup = await this.createBackup(type);
    const filename = `zpopcorn-backup-${type}-${new Date().toISOString().split('T')[0]}.json`;
    
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Notify
    window.dispatchEvent(new CustomEvent('showtoast', {
      detail: {
        type: 'success',
        title: 'تم إنشاء النسخ الاحتياطي',
        message: `تم حفظ ${filename}`
      }
    }));

    return { backup, filename };
  }

  async validateBackup(backupData) {
    if (!backupData || typeof backupData !== 'object') {
      throw new Error('Invalid backup format: not an object');
    }

    if (!backupData.schemaVersion) {
      throw new Error('Invalid backup: missing schema version');
    }

    if (!backupData.data) {
      throw new Error('Invalid backup: missing data');
    }

    // Check version compatibility
    const majorVersion = parseInt(backupData.schemaVersion.split('.')[0]);
    if (majorVersion > 1) {
      throw new Error(`Unsupported backup version: ${backupData.schemaVersion}`);
    }

    return true;
  }

  async restoreBackup(backupData, options = {}) {
    const { createSafetyBackup = true } = options;

    // Validate first
    await this.validateBackup(backupData);

    // Create safety backup
    let safetyBackup = null;
    if (createSafetyBackup) {
      try {
        safetyBackup = await this.createBackup('full');
        localStorage.setItem('zpopcorn-safety-backup', JSON.stringify(safetyBackup));
      } catch (e) {
        console.warn('Failed to create safety backup:', e);
      }
    }

    try {
      // Restore database
      if (backupData.data.database) {
        await db.importAll(backupData.data.database);
      }

      // Restore settings
      if (backupData.data.settings) {
        Object.entries(backupData.data.settings).forEach(([key, value]) => {
          if (value !== null && value !== undefined) {
            const storageKey = `zpopcorn-${key}`;
            // Map old keys
            const keyMap = {
              theme: 'zpopcorn-theme',
              region: 'zpopcorn-region',
              language: 'zpopcorn-language',
              customThemes: 'zpopcorn-custom-themes',
              notificationPrefs: 'zpopcorn-notification-prefs'
            };
            
            const actualKey = keyMap[key] || storageKey;
            try {
              localStorage.setItem(actualKey, value);
            } catch {}
          }
        });
      }

      // Restore other data if not in database export
      if (!backupData.data.database) {
        const stores = ['watchHistory', 'watchProgress', 'watchlists', 'watchlistItems', 'ratings', 'behaviorEvents', 'tasteProfile', 'notifications', 'favorites'];
        
        for (const store of stores) {
          if (backupData.data[store]) {
            try {
              await db.clear(store);
              for (const item of backupData.data[store]) {
                await db.put(store, item);
              }
            } catch (e) {
              console.warn(`Failed to restore ${store}:`, e);
            }
          }
        }
      }

      window.dispatchEvent(new CustomEvent('showtoast', {
        detail: {
          type: 'success',
          title: 'تمت الاستعادة بنجاح',
          message: 'تم استعادة البيانات بنجاح'
        }
      }));

      // Reload after short delay
      setTimeout(() => {
        window.location.reload();
      }, 1500);

      return true;

    } catch (error) {
      console.error('Restore failed:', error);

      // Try to rollback to safety backup
      if (safetyBackup) {
        try {
          if (safetyBackup.data.database) {
            await db.importAll(safetyBackup.data.database);
          }
          
          window.dispatchEvent(new CustomEvent('showtoast', {
            detail: {
              type: 'error',
              title: 'فشلت الاستعادة',
              message: 'تمت الاستعادة إلى النسخة الاحتياطية الآمنة'
            }
          }));
        } catch (rollbackError) {
          console.error('Rollback failed:', rollbackError);
        }
      }

      throw error;
    }
  }

  async importBackupFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const data = JSON.parse(e.target.result);
          await this.validateBackup(data);
          resolve(data);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  async getBackupInfo(backupData) {
    await this.validateBackup(backupData);
    
    const info = {
      schemaVersion: backupData.schemaVersion,
      appVersion: backupData.appVersion,
      createdAt: backupData.createdAt,
      type: backupData.type,
      size: JSON.stringify(backupData).length,
      stores: {}
    };

    if (backupData.data.database) {
      Object.entries(backupData.data.database.stores || {}).forEach(([store, items]) => {
        info.stores[store] = items.length;
      });
    } else {
      Object.entries(backupData.data).forEach(([key, items]) => {
        if (Array.isArray(items)) {
          info.stores[key] = items.length;
        }
      });
    }

    return info;
  }
}

export const backupManager = new BackupManager();
export default backupManager;
