# zPopcorn Architecture (v2.1.0 — desktop rebuild)

This document reflects the code as it stands in this repo, not aspirations.
Scope rule honored throughout: **no video engine this phase** — the player boundary is
a contract (`player.capability` → `PLAYER_NOT_IMPLEMENTED`), nothing else.

## 1. Process model

```
┌────────────────────────── Electron main (Node) ──────────────────────────┐
│ index.js: app lifecycle · single-instance lock · zpopcorn-media protocol │
│ window.js: frame, Arabic menu, bounds, navigation & permission lockdown  │
│ container.js: async createContainer() — ALL services wired here           │
│  ├ DatabaseService   (better-sqlite3 ⇄ sql.js WASM, migrations, FTS probe)│
│  ├ StoreCompat       (doc_store: legacy IndexedDB-shaped stores)          │
│  ├ SettingsService   (canonical settings; masked snapshot for renderer)   │
│  ├ FileSystemService (safePath jail, drives, recursive scan w/ guards)    │
│  ├ ImportService     (parse → TMDB match → confidence → inbox candidates)  │
│  ├ LibraryService    (works/editions/media_files registry, snapshots)      │
│  ├ TMDBService       (cache-first: SQLite cache + TTL + revalidation)       │
│  ├ ImageCacheService (disk-cached poster/backdrop/…, served via protocol)   │
│  ├ Search/History/Favorites/Collections/Recommendations                     │
│  ├ HealthService · DuplicateService · BackupService (VACUUM INTO + verify) │
│  └ SystemService (info, diagnostics, logs, dialogs, player capability stub)│
│ ipc/registry.js: binds channels.cjs ↔ handlers, fails fast on drift        │
└───────────────▲───────────────────────────────────────────────────────────┘
        typed invoke (envelope)  │  push events (whitelist)
┌───────────────┴───────────────────────────── Electron renderer ───────────┐
│ preload.cjs: builds window.zpopcorn.<ns>.<method>() ONLY from channels     │
│ contextIsolation: true · nodeIntegration: false · no require/fs           │
│ js/bridge.js: desktop/browser duality · settings mirror · event relays     │
│ js/services/storage/Database.js: same facade → IPC (desktop) or IndexedDB  │
│ App.js + 40+ pages: Arabic RTL design system, 8 themes, skeletons, toasts │
└────────────────────────────────────────────────────────────────────────────┘
```

## 2. IPC contract (centralized)

`electron/shared/channels.cjs` is the single source of truth:

- `INVOKE_CHANNELS` — 15 namespaces / 126 channels (`library`, `files`, `database`,
  `settings`, `metadata`, `cache`, `system`, `import`→`inbox`, `favorites`, `history`,
  `collections`, `health`, `duplicates`, `backup`, `player`).
- `EVENT_CHANNELS` / `EVENT_ROUTE` — 10 push events (`scan-progress`, `inbox-changed`,
  `library-changed`, `health-changed`, `settings-changed`, `backup-progress`, `toast`,
  `navigate`, `window-state`, `tmdb-status`).
- `STORE_NAMES` — the 15 legacy doc stores bridged through `database.*`.

Rules enforced at boot by `ipc/registry.js` (both directions):
every channel has exactly one handler with matching validation; unknown/missing = crash-fast.

**Envelope:** every handler resolves `{ok:true,result}` or `{ok:false,error:{code,message}}`;
preload unwraps to value / `Error` with `.code`. Validation primitives live in
`ipc/validation.js` (no electron imports, so tests and handlers share them).

## 3. Storage

- One SQLite file: `%APPDATA%\zPopcorn\database\zpopcorn.db`.
- `doc_store` table mirrors the legacy IndexedDB object stores exactly
  (store, key, indexed slots ref1–ref3, JSON payload) — this is what let 135+ existing
  call-sites keep working during migration.
- Typed relational tables for the new domains: `library_sources`, `media_files`,
  `import_candidates`, `tmdb_cache`, `image_cache_index`, `health_issues`,
  `duplicate_decisions`, `collections*`, `audit_log`, `schema_migrations`.
- Driver policy: try `better-sqlite3` (native, journal WAL); on failure use `sql.js`
  (WASM; debounced atomic snapshot persistence, VACUUM INTO for backups).
- FTS5 probed at runtime; absent → normalized-title LIKE fallback (same results, slower).
- `settings` doc-store reads/writes route to `SettingsService` (renderer settings UI keeps
  using its legacy calls; canonical state stays in main; `db.clear('settings')` refused: `E_PROTECTED`).

## 4. Import pipeline (the heart)

```
sources → FileSystemService.scan (loops guarded) → FileNameParser (movies/series/anime/Arabic)
 → confidence scoring (base 40 + evidence; caps for duplicates) → TMDBService search (cache-first)
 → candidate rows (status pending|confirmed|ignored|deferred)
 → auto-confirm only iff confidence ≥ threshold (default 92) AND tmdb_id AND not duplicate —
   everything else WAITS IN THE INBOX for a human.
```

Inbox UI (`/inbox`): review queue, filters (needs-review / matched / low-confidence),
per-item confirm / defer / reject / rematch / inline correction (title, year, type, S/E),
source management (add folder via native dialog — never copies media; remove source keeps
files). Live progress via `scan-progress` events. Confirmed items produce TMDB-shaped
library docs + `media_files` rows + editions.

## 5. Metadata & images

- Renderer never fetches TMDB directly. `TMDBClient.request()` in desktop mode is one IPC
  hop to `metadata.request`; main serves from `tmdb_cache` (TTL by category + revalidation,
  rate-limit aware, lastError surfaced in diagnostics). Offline = cache answers.
- Posters/backdrops: `TMDBImage` emits `zpopcorn-media://image/<cat>/<size><path>` URLs;
  main resolves file → memory → TMDB download, stores under `images/`, serves with
  7-day immutable cache. Works offline, never touches renderer disk APIs.

## 6. Renderer duality (why browser mode still exists)

`js/bridge.js` decides once at boot:

- desktop: hydrates localStorage from the canonical settings snapshot; patches
  `localStorage.setItem` (single choke-point) to write recognized keys back through
  `settings.set` (debounced); relays main events to the existing UI events;
  `window.__zpopcornHashMode` flips the router to hash navigation for `file://`.
- browser: everything falls back to the legacy IndexedDB stack — same facade, same UI —
  used ONLY for QA/preview.

## 7. Security posture

- contextIsolation + typed preload API; no generic `invoke` exposed; sender validation.
- CSP (production build injected by vite plugin): `default-src 'self' zpopcorn-media:`;
  scripts `'self'`; no eval; no remote scripts/styles beyond Google Fonts (with fallbacks).
- `will-navigate` locked to app origin; window.open denied; permissions denied.
- Filesystem access: only (a) registered library roots, (b) paths returned by pickers,
  (c) APPDATA layout — enforced inside FileSystemService (`safePath`), not in the renderer.
- Logs redact `api_key`/token patterns; rotate daily; renderer can tail but not write.

## 8. Player boundary (deferred phase — by design)

`player.capability` (main) and `PlayerService` (renderer) both report
`{implemented:false, code:'PLAYER_NOT_IMPLEMENTED', phase:'future', contractVersion:1}`.
UI gates honestly (play buttons → availability panel; settings playback/subtitle/audio
sections carry a phase banner). The future engine phase plugs into this contract without
touching pages/services/IPC layout.

## 9. Test & QA strategy

`tests/backend.test.mjs` (node --test, WASM driver — runs anywhere): schema/migration
idempotency, settings (masking, legacy bridge), parser corpus (Arabic, anime, editions,
groups), scan→inbox→confirm flow incl. auto-confirm rules & duplicates, TMDB cache
first-hit/no-fetch and TTL, search, favorites/history/collections, backup create/verify/
restore incl. corrupt & foreign DB rejection, StoreCompat merge-safety, registry contract
& ban-list, diagnostics & player stub. 18/18 green. UI QA is per-page manual (see
QA_REPORT.md) — Electron itself can't boot in the sandbox, so runtime clicks are done
via browser preview + code audit.
