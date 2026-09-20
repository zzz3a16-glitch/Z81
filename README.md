# zPopcorn — Intelligent Local Media Library for Windows

**v2.1.0 — Electron desktop rebuild (player engine deferred to its own phase)**

Arabic-first (RTL) premium desktop app that turns your local movie/series folders into a
curated library: smart filename parsing, TMDB matching with a cache-first metadata layer,
an inbox review queue (nothing auto-approves when uncertain), duplicate & health
detection, themes, favorites, history, collections, and SQLite persistence.

## What runs where (the short version)

| Layer | Owner | Notes |
|---|---|---|
| Window, menus, dialogs, protocol | Electron **main** | `electron/main/index.js`, `window.js` |
| SQLite (better-sqlite3, sql.js WASM fallback) | main | `%APPDATA%\zPopcorn\database\zpopcorn.db` |
| All services (library, import, TMDB, images, health, backup…) | main | `electron/main/services/` |
| IPC surface | central registry | `electron/shared/channels.cjs` — the only contract file |
| UI (pages, components, design system) | renderer | `src/` — sandboxed, `window.zpopcorn.*` typed API only |

- Renderer never touches `fs`, `require`, or raw `ipcRenderer` (contextIsolation on, nodeIntegration off).
- Media files are **referenced in place** — zPopcorn never copies or moves your files.
- User data always lives under `%APPDATA%\zPopcorn` (never beside the install).
- **Video playback is intentionally not implemented this phase.** `PlayerService` ships as an
  abstraction; capability is `PLAYER_NOT_IMPLEMENTED` end-to-end. No mpv/VLC/FFmpeg anywhere.

## Run it

```bash
npm install                 # better-sqlite3 needs a native build; sql.js WASM is the fallback
npm run dev                 # renderer browser preview (QA mode; browser keeps IndexedDB stack)
npm run dev:desktop         # run inside Electron against dist/
npm test                    # backend suite (node --test, uses the WASM driver — no native build needed)
npm run dist                # package zPopcorn-Setup-2.1.0-x64.exe (electron-builder + NSIS)
```

First launch with no database → you get the Library Hub; add folders (native picker),
scan, review the **Inbox**, confirm — items land in the library. TMDB key is pre-seeded
with a public demo key (Settings → TMDB to change).

## Packaging facts (Windows)

- Installer: NSIS x64, `zPopcorn-Setup-2.1.0-x64.exe`, per-user, start-menu + desktop shortcuts.
- `deleteAppDataOnUninstall: false` — uninstalling **never** deletes your library data.
- `better-sqlite3` is rebuilt against Electron's ABI by electron-builder (`npmRebuild`),
  unpacked from asar (`**/*.node`). If the native module is unavailable at runtime,
  the app falls back to `sql.js` (WASM) automatically — persistence identical.
- CSP is injected into `dist/index.html` at build time; dev server stays HMR-friendly.
- `zpopcorn-media://` private protocol serves cached posters/backdrops offline.

## Repo map

```
electron/
  shared/channels.cjs        # all IPC channel names + event routes (single source)
  main/
    index.js                 # boot, lifecycle, media protocol, envelope IPC wrapper
    window.js                # BrowserWindow, Arabic menu, bounds persistence
    lib/paths.js lib/logger.js
    db/DatabaseService.js     # dual-driver SQLite + migrations + FTS probe
    db/migrations/001_init.sql
    db/StoreCompat.js         # legacy IndexedDB-shaped doc_store layer
    ipc/registry.js validation.js handlers.js
    services/                 # Library, Import, TMDB, ImageCache, Filesystem, Settings,
                              # Search, History, Favorites, Collections, Duplicates,
                              # Health, Backup, System(+Player capability stub), …
  preload.cjs                # typed contextBridge; generated from channels.cjs
src/                          # renderer (vanilla ESM + Vite)
  js/bridge.js               # desktop/browser duality, settings mirror, event relays
  js/services/storage/Database.js  # dual-mode store facade (IPC or IndexedDB)
  js/pages/…                 # InboxPage, DeveloperPage, 40+ pages
  styles/                    # design tokens, 8 themes, RTL-first
tests/backend.test.mjs        # 18-test suite for the whole main-process stack
```

## Phase plan

1. **This phase (done):** architecture, security, SQLite, services, UI rebuild, inbox,
   metadata, themes, packaging config, tests.
2. **Next phase (separate):** playback engine (mpv) wired behind `PlayerService` —
   no app restructuring required; the boundary is already contracted.

## Known trade-offs (honest list)

- `sandbox: false` on the BrowserWindow — the preload `require`s `shared/channels.cjs`.
  Everything else is hardened (isolation on, no node in renderer, will-navigate lock,
  permissions denied, CSP, path-validated filesystem access only).
- sql.js fallback keeps one in-memory DB copy; writes are debounced (400 ms) + atomic
  rename + flush on quit/backup. The native driver has none of this cost.
- FTS5 is used only if the active SQLite build has it (probed at runtime); otherwise
  search degrades to normalized-title scans — behaviour identical, speed differs.
- Browser mode exists purely for QA/preview; it is not a product target.
