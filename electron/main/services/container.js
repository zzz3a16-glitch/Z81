/**
 * Service container — constructs the application service layer (spec 09).
 * Every service has one responsibility; cross-service communication goes
 * through the shared event bus.
 */
import { EventEmitter } from 'node:events';
import { createPaths } from '../lib/paths.js';
import { LogService } from '../lib/logger.js';
import { DatabaseService } from '../db/DatabaseService.js';
import { StoreCompat } from '../db/StoreCompat.js';
import { SettingsService } from '../services/SettingsService.js';
import { TMDBService } from '../services/TMDBService.js';
import { ImageCacheService } from '../services/ImageCacheService.js';
import { FileSystemService } from '../services/FileSystemService.js';
import { LibraryService } from '../services/LibraryService.js';
import { ImportService } from '../services/ImportService.js';
import { HealthService } from '../services/HealthService.js';
import { DuplicateService } from '../services/DuplicateService.js';
import { BackupService } from '../services/BackupService.js';
import { FavoritesService, HistoryService, CollectionsService } from '../services/ProfileServices.js';
import { RecommendationService } from '../services/RecommendationService.js';
import { PlayerService, SystemService } from '../services/SystemService.js';

export async function createContainer({ app, shell, dialog, windows }) {
  const paths = createPaths(app);
  const log = new LogService(paths);
  const events = new EventEmitter();
  events.setMaxListeners(25);

  const db = new DatabaseService(paths, log);
  await db.open();

  const store = new StoreCompat(db, log, events);
  const settings = new SettingsService(db, log, events);
  log.setLevel(settings.get('devMode') ? 'debug' : 'info');

  const tmdb = new TMDBService({ db, settings, log, events });
  const images = new ImageCacheService({ paths, tmdb, db, log });
  const fs = new FileSystemService({ paths, db, log, events });
  const library = new LibraryService({ db, store, log, events, fs });
  const imports = new ImportService({ db, store, library, tmdb, fs, settings, log, events });
  const health = new HealthService({ db, store, library, log, events });
  const dupes = new DuplicateService({ db, store, log, events });
  const backup = new BackupService({ db, paths, store, log, events });
  const favorites = new FavoritesService({ store, events });
  const history = new HistoryService({ store, events, db });
  const collections = new CollectionsService({ store, db, events });
  const recommendations = new RecommendationService({ store, db, tmdb, settings });
  const player = new PlayerService({ log });
  const system = new SystemService({
    paths, db, log, settings, tmdb, images, app, shell,
  });

  return {
    app, shell, dialog, windows,
    paths, log, events, db, store, settings, tmdb, images, fs,
    library, imports, health, dupes, backup, favorites, history,
    collections, recommendations, player, system,
  };
}
