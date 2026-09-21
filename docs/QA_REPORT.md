# zPopcorn v2.1.0 — QA / Audit Report (desktop rebuild phase)

Date: 2026-09-20 · Scope: architecture + renderer migration phase (no playback engine, by design).
Honesty rule: anything not actually executed is listed as *user-side verification*, not "passed".

## 1. Automated — executed here, passing

```
$ node --test tests/backend.test.mjs
# tests 18 · # pass 18 · # fail 0     (sql.js WASM driver — same code path as native minus the binding)
$ npx vite build                        # ✓ builds, 64 modules, main chunk ~380 kB
$ node --check on all touched electron files  # ✓
```

Covered by the suite: migrations (fresh + idempotent re-open), settings masking + legacy
`db.setSetting` bridge + `clear('settings')` refusal, FileNameParser corpus (Arabic titles,
`1x01`, anime `- 15` with group/quality parens in any order, editions, release groups),
scan→inbox→confirm flow (auto-confirm only ≥92+tmdb, duplicates cap at 80/45, defer/ignore),
TMDB cache-first (no network on warm hit, TTL expiry), search incl. no-FTS fallback,
favorites/history/collections, backup create/validate/restore + corrupt-file +
foreign-schema rejection, StoreCompat importLegacy merge safety (existing wins),
IPC registry contract + banned-channel guard, diagnostics + player `NOT_IMPLEMENTED`.

## 2. Static audit of renderer (this session)

Checked by reading + build graph; all 40+ routes reviewed against spec:

| Area | Result |
|---|---|
| Routing | hash mode under `file://` (desktop), pushState in browser; deep links `#/movie/155` work |
| Storage | every `db.*` call-site (135+, 20+ services) flows through dual-mode facade unchanged |
| TMDB | no direct `fetch(api.themoviedb.org)` left in renderer desktop path (verified grep) |
| Images | all cards/details use `TMDBImage` → `zpopcorn-media://` on desktop; SVG fallbacks kept |
| Player | embedded mpv-style fake player REMOVED from `App.showPlayer`; replaced by honest availability panel; capability gate wired |
| PWA leftovers | `sw.js`, `manifest.json`, service-worker registration REMOVED; watch-party server REMOVED; mobile-only nav CSS import kept for responsive but no fake "mobile app" surface |
| Settings | region `SA` default from main snapshot; playback/subtitles/audio sections carry real values + explicit "applies when engine lands" banner (no silent promises) |
| Inbox | new page + sidebar entry + badge driven by `inbox.stats` |
| Developer | new page: live diagnostics (driver, sizes, cache hit-rates, health, logs tail) — no mock data |
| Icons | sidebar rebuilt with inline SVG (emoji-as-icon removed); toasts/modals use design tokens |
| CSP | injected only in `dist/index.html` (verified in build output); dev mode unaffected |

## 3. What could NOT be executed here (sandbox limits) — user-side checklist

Electron binary/native modules are not downloadable in this environment
(nodejs.org + GitHub release CDN blocked), so:

1. `npm install` on Windows (builds/uses prebuilt `better-sqlite3`).
2. `npm run dev:desktop` → first run: onboarding → add folder → scan → inbox → confirm.
3. `npm run dist` → `zPopcorn-Setup-2.1.0-x64.exe` installs, starts `zPopcorn.exe`,
   data lands in `%APPDATA%\zPopcorn` (check `database\zpopcorn.db`, `logs\`).
4. Uninstall → data survives (deleteAppDataOnUninstall:false); reinstall → library intact.
5. Airplane-mode relaunch → posters (from `zpopcorn-media` cache) and metadata still render.

If any of these fail on a real machine, the failure points to exactly one layer
(preload channels / native driver / protocol handler) — all are isolated by design.

## 4. Known accepted trade-offs (documented, not hidden)

- `sandbox:false` on the window (preload `require`s shared channel list). Isolation,
  CSP, channel whitelist, navigation lock remain; upgrading to a bundled ESM preload
  would let sandbox flip on — noted for the player phase.
- sql.js fallback persists via debounced atomic snapshots (not WAL). Native driver avoids it.
- `getByIndex` on desktop maps to indexed `doc_store` ref columns only for the two real
  composite indexes used by the UI (watchlistItems.listId, watchProgress.mediaId).
- Image cache index/files: `cache.clear({images:'all'})` wipes both (fixed this phase:
  category-scoped clear no longer nukes the whole index).
- Recommendations remain heuristic (taste-profile cosine, no ML) — matches stub contract.

## 5. Performance notes from the audit

- Lists: doc_store queries are index-backed (sqlite indexes on store+ref1..3), pages
  lazy-import per route, images lazy-loaded, TMDB warm from SQLite cache.
- Scan loop has depth/entry guards; UI progress comes from events, no polling.
- Bundle: single CSS (73 kB), main JS 382 kB raw / ~96 kB gz — no framework weight.
