/**
 * zPopcorn data paths — Windows application-data layout (spec section 10).
 * Never store mutable user data in the installation directory.
 * Uses Electron's userData API (%APPDATA%\zPopcorn on Windows).
 */
import path from 'node:path';
import fs from 'node:fs';

const LAYOUT = {
  database: 'database',
  cache: 'cache',
  images: 'images',
  posters: 'images/posters',
  backdrops: 'images/backdrops',
  logos: 'images/logos',
  profiles: 'images/profiles',
  stills: 'images/stills',
  metadata: 'metadata',
  settings: 'settings',
  backups: 'backups',
  logs: 'logs',
};

export function createPaths(app) {
  const root = app.getPath('userData');
  const p = { root };
  for (const [k, rel] of Object.entries(LAYOUT)) {
    p[k] = path.join(root, ...rel.split('/'));
  }
  p.dbFile = path.join(p.database, 'zpopcorn.db');
  p.windowState = path.join(p.settings, 'window-state.json');

  p.ensure = function ensure() {
    for (const dir of Object.values(LAYOUT)) {
      fs.mkdirSync(path.join(root, ...dir.split('/')), { recursive: true });
    }
  };
  p.ensure();
  return p;
}

/** Map a cache category key to its image directory. */
export function imageDirFor(paths, category) {
  const map = { poster: 'posters', backdrop: 'backdrops', logo: 'logos', profile: 'profiles', still: 'stills' };
  return paths[map[category] || 'posters'];
}
