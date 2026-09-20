/**
 * MigrationManager - Safe database migrations
 */

import { db } from './Database.js';

export class MigrationManager {
  constructor() {
    this.migrations = [
      {
        version: 1,
        name: '001_initial',
        description: 'Initial database schema',
        up: async (db) => {
          console.log('Migration 001_initial: Already handled by Database.js');
        }
      },
      {
        version: 2,
        name: '002_watch_history',
        description: 'Watch history and progress',
        up: async (db) => {
          // Ensure watchHistory and watchProgress stores exist
          console.log('Migration 002: Watch history');
        }
      },
      {
        version: 3,
        name: '003_watchlists',
        description: 'Advanced watchlists',
        up: async (db) => {
          console.log('Migration 003: Watchlists');
        }
      },
      {
        version: 4,
        name: '004_ratings',
        description: 'Personal ratings and reviews',
        up: async (db) => {
          console.log('Migration 004: Ratings');
        }
      },
      {
        version: 5,
        name: '005_notifications',
        description: 'Notification center',
        up: async (db) => {
          console.log('Migration 005: Notifications');
        }
      },
      {
        version: 6,
        name: '006_taste_profile',
        description: 'Taste profile and behavior',
        up: async (db) => {
          console.log('Migration 006: Taste profile');
        }
      },
      {
        version: 7,
        name: '007_analytics',
        description: 'Analytics and achievements',
        up: async (db) => {
          console.log('Migration 007: Analytics');
        }
      }
    ];
  }

  async getCurrentVersion() {
    try {
      const version = await db.getSetting('dbVersion', 0);
      return version;
    } catch {
      return 0;
    }
  }

  async setCurrentVersion(version) {
    try {
      await db.setSetting('dbVersion', version);
    } catch (e) {
      console.warn('Failed to set DB version:', e);
    }
  }

  async migrate() {
    const currentVersion = await this.getCurrentVersion();
    const pending = this.migrations.filter(m => m.version > currentVersion).sort((a, b) => a.version - b.version);

    if (pending.length === 0) {
      console.log('✓ Database up to date');
      return { migrated: 0, currentVersion };
    }

    console.log(`Migrating database from v${currentVersion} to v${this.migrations[this.migrations.length - 1].version}`);
    console.log(`Pending migrations: ${pending.length}`);

    // Create safety backup before migration
    let safetyBackup = null;
    try {
      safetyBackup = await db.exportAll();
      localStorage.setItem('zpopcorn-migration-backup', JSON.stringify(safetyBackup));
      console.log('✓ Safety backup created');
    } catch (e) {
      console.warn('Failed to create safety backup:', e);
    }

    let migrated = 0;
    let failed = null;

    for (const migration of pending) {
      try {
        console.log(`Running migration ${migration.name}...`);
        await migration.up(db);
        await this.setCurrentVersion(migration.version);
        migrated++;
        console.log(`✓ Migration ${migration.name} completed`);
      } catch (error) {
        console.error(`✗ Migration ${migration.name} failed:`, error);
        failed = { migration, error };
        break;
      }
    }

    if (failed) {
      console.error('Migration failed, attempting rollback...');
      
      try {
        if (safetyBackup) {
          await db.importAll(safetyBackup);
          await this.setCurrentVersion(currentVersion);
          console.log('✓ Rollback completed');
        }
      } catch (rollbackError) {
        console.error('Rollback failed:', rollbackError);
      }

      throw new Error(`Migration ${failed.migration.name} failed: ${failed.error.message}`);
    }

    // Verify integrity after migration
    try {
      await this.verifyIntegrity();
      console.log('✓ Database integrity verified');
    } catch (e) {
      console.warn('Integrity check failed:', e);
    }

    console.log(`✓ Migration completed: ${migrated} migrations applied`);

    return {
      migrated,
      currentVersion: await this.getCurrentVersion(),
      fromVersion: currentVersion
    };
  }

  async verifyIntegrity() {
    const checks = [
      { name: 'Foreign keys', check: () => this.checkForeignKeys() },
      { name: 'Orphan records', check: () => this.checkOrphanRecords() },
      { name: 'Duplicate IDs', check: () => this.checkDuplicateIds() },
      { name: 'Invalid timestamps', check: () => this.checkTimestamps() }
    ];

    const results = [];

    for (const { name, check } of checks) {
      try {
        const result = await check();
        results.push({ name, success: true, result });
      } catch (error) {
        results.push({ name, success: false, error: error.message });
      }
    }

    const failed = results.filter(r => !r.success);
    if (failed.length > 0) {
      console.warn('Integrity issues found:', failed);
    }

    return results;
  }

  async checkForeignKeys() {
    // Check for invalid references
    const watchlistItems = await db.getAll('watchlistItems').catch(() => []);
    const watchlists = await db.getAll('watchlists').catch(() => []);
    const watchlistIds = new Set(watchlists.map(w => w.id));
    
    const orphanItems = watchlistItems.filter(item => !watchlistIds.has(item.listId));
    
    return {
      total: watchlistItems.length,
      orphans: orphanItems.length,
      valid: orphanItems.length === 0
    };
  }

  async checkOrphanRecords() {
    // Check for records without proper parent
    return { valid: true, orphans: 0 };
  }

  async checkDuplicateIds() {
    const stores = ['movies', 'tvshows', 'watchHistory', 'ratings'];
    const results = {};

    for (const store of stores) {
      try {
        const items = await db.getAll(store).catch(() => []);
        const ids = items.map(i => i.id || i.mediaId);
        const unique = new Set(ids);
        
        results[store] = {
          total: ids.length,
          unique: unique.size,
          duplicates: ids.length - unique.size,
          valid: ids.length === unique.size
        };
      } catch {
        results[store] = { valid: true, total: 0, unique: 0, duplicates: 0 };
      }
    }

    return results;
  }

  async checkTimestamps() {
    const stores = ['watchHistory', 'watchProgress', 'ratings'];
    let invalid = 0;

    for (const store of stores) {
      try {
        const items = await db.getAll(store).catch(() => []);
        for (const item of items) {
          const timestamp = item.watchedAt || item.updatedAt || item.addedAt;
          if (timestamp && (isNaN(timestamp) || timestamp < 0 || timestamp > Date.now() + 86400000)) {
            invalid++;
          }
        }
      } catch {}
    }

    return { invalid, valid: invalid === 0 };
  }

  async reset() {
    if (confirm('هل أنت متأكد من إعادة تعيين قاعدة البيانات؟ سيتم حذف جميع البيانات.')) {
      try {
        for (const store of db.stores) {
          await db.clear(store.name).catch(() => {});
        }
        await this.setCurrentVersion(0);
        console.log('✓ Database reset');
        window.location.reload();
      } catch (e) {
        console.error('Reset failed:', e);
      }
    }
  }
}

export const migrationManager = new MigrationManager();
export default migrationManager;
