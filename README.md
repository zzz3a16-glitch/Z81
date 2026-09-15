# 🍿 zPopcorn Ultimate — Professional Media Intelligence Platform

> **Production-Grade Intelligent Personal Media Assistant** — Transforming local media libraries into cinematic intelligence

**Version:** 2.0.0 — Production Ready  
**Language:** Arabic (RTL) Primary, English Secondary  
**Region:** Saudi Arabia (SA) Default  
**Architecture:** Electron.js + Node.js + Vite + Vanilla JS ES2024 + IndexedDB + TMDB API + mpv Player

---

## 🎯 Vision

Transform **zPopcorn** from a **Smart Local Media Library** into a **Production-Grade Intelligent Personal Media Assistant** that:

- **Understands** user preferences and viewing behavior
- **Predicts** what the user wants to watch next
- **Discovers** new content intelligently
- **Plays** media with professional quality (mpv)
- **Tracks** all activity accurately
- **Protects** user data (Local-First Architecture)

### Core Philosophy

- **Local-First:** All personal data (watch history, ratings, preferences) stays on-device
- **TMDB as Metadata Source:** External API for rich metadata, never for tracking
- **Behavior-Driven Intelligence:** User actions build dynamic taste profiles
- **Zero Data Loss:** Preserve and enhance existing functionality
- **Premium Experience:** Every interaction feels intentional and cinematic

---

## 🏗️ Architecture

```
                 ┌─────────────────────┐
                 │      ZPOPCORN       │
                 │ INTELLIGENT MEDIA   │
                 │      ASSISTANT      │
                 └──────────┬──────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
   Library Core       Intelligence Core    Player Core
        │                   │                   │
   Scanner             Behavior Engine       mpv
   IndexedDB           Taste Profile         IPC
   Media Parser        Recommendation         Audio
   Sources             Search                 Subs
   Metadata            Assistant              Playback
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
                    External Services
                            │
                 ┌──────────┴──────────┐
                 │                     │
                TMDB              OpenSubtitles
                 │
             Metadata
             Discovery
             People
             Episodes
             Collections
```

---

## 🎨 Design System

### Foundation Principles (Apple HIG Inspired)

1. **Clarity** — Every element has a clear purpose
2. **Deference** — UI respects content, provides structure without competing
3. **Depth** — Visual hierarchy through layering, motion, subtle effects
4. **Consistency** — Same actions produce same results
5. **Feedback** — Every interaction has a response
6. **Efficiency** — Minimize steps, maximize results
7. **Delight** — Subtle surprises that feel magical

### Design Tokens

- **Colors:** Semantic tokens, not just hex values
- **Typography:** Arabic-first, premium, limited families
- **Spacing:** 8px base grid (4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80)
- **Sizing:** Unified border radius, card heights, aspect ratios
- **Shadows:** Elevation system (0-6 levels)
- **Motion:** Purposeful, performant, accessible (150-400ms)
- **Z-Index:** Layering system

### 8 Professional Themes

Each theme transforms **entire application**, not just colors:

1. **Midnight Neon** — Dark, cinematic, futuristic (Black, Purple, Cyan, Glass, Glow)
2. **Cinema Noir** — Classic, elegant, sophisticated (Deep Black, Gray, Limited Red)
3. **Aurora** — Ethereal, dreamy, modern (Indigo, Cyan, Violet, Gradient auroras)
4. **AMOLED** — Pure, minimal, high-contrast (Pure Black #000, White, Purple, OLED optimized)
5. **Crimson Cinema** — Rich, warm, dramatic (Dark Black, Burgundy, Crimson, Soft Red)
6. **Golden Cinema** — Opulent, premium, classic (Black, Charcoal, Gold, Warm White)
7. **Arctic** — Clean, bright, modern (White, Ice Blue, Light Gray, Cyan) — Light theme
8. **Minimal Light** — Simple, clean, professional (White, Warm Gray, Black) — Light theme

**Features:**
- Live preview before applying
- Custom theme builder with color, radius, shadow, blur, typography controls
- Export/Import as JSON
- Persistent via localStorage
- Presentation layer only (doesn't affect data)

---

## 🎬 Pages & Features

### Core Pages
- **Home** — Hero carousel, Continue Watching, Recommended, Because You Watched, Discover, Trending, Movies, TV
- **Movies** — Discover, Popular, Trending, Now Playing, Upcoming, Top Rated + Filters (Genre, Year, Rating, Language, Country, Sort)
- **TV Shows** — Popular, Trending, Airing Today, On The Air, Top Rated + Seasons/Episodes
- **Anime** — Independent section (not Movie/TV), with studios, networks, episodes
- **Media Details** — Premium rebuild with backdrop, poster, titles, metadata, overview, cast, crew, videos, similar, recommendations, collection, keywords, companies, networks, providers, reviews
- **Person Details** — Profile, bio, birthday, known for, acting/crew credits in library
- **Platforms** — Real TMDB Watch Providers data (Netflix, Prime, Disney+, Apple TV, HBO, Crunchyroll) with SA region
- **Search** — Smart search with intent detection, natural language, debounced, suggestions, recent
- **Favorites / Watch Later / History / Continue Watching** — Full watchlist management
- **Analytics** — Watch time, genres, heatmap (24×7), cinematic journey, achievements, monthly comparison, predictions
- **Settings** — 15 categories: General, Appearance, Playback, Subtitles, Audio, Library, Scanner, TMDB, Recommendations, Notifications, Watch Party, Privacy, Backup, Keyboard, Advanced

### Intelligent Systems

#### 1. User Behavior Engine
Tracks: PLAY_STARTED, PAUSED, RESUMED, COMPLETED, STOPPED, SEEK, REWATCH, EPISODE_COMPLETED, MOVIE_COMPLETED, SKIPPED, ABANDONED, ADDED_TO_WATCHLIST, REMOVED, RATED, SEARCHED, OPENED, FAVORITED

Uses smart aggregation, not per-second logging.

#### 2. Taste Profile Engine
Builds dynamic profile:
- Favorite genres, actors, directors, years, languages, networks, keywords, runtime, countries, collections, decades, content types
- Metrics: completion rate, rewatch rate, abandonment, average rating, frequency
- Weighted scoring, auto-updates from behavior

#### 3. Recommendation Engine
Scoring: taste, genre, actor, director, year, language, keyword, runtime, similarity, rating, recency, novelty, completion pattern
Categories: Recommended For You, Because You Watched, You Might Like, Discover New, Continue Watching, Complete Started, New In Library
Match percentage with explanation.

#### 4. Media Scanner
- Incremental, parallel, resumable, fault-tolerant
- Folder watch, scheduled, manual, incremental
- File fingerprint: path, size, mtime, fingerprint, duration, codec, container, resolution, audio/subs
- Smart filename parser: Movie.Name.2024.1080p.mkv, Series.S01E02, 1x02, etc.
- TV intelligence: hierarchy Series→Season→Episode, missing detection, duplicate detection

#### 5. Professional Player (mpv)
- Architecture: mpv Process → IPC Controller (JSON IPC) → Player Service → Renderer UI
- Services: PlayerService, MpvController, PlayerState, SubtitleManager, AudioTrackManager, PlaybackHistoryManager
- Features: Play/Pause/Stop/Seek, audio track, subtitles (embedded/external, delay, size, font, position, color), keyboard shortcuts (customizable), continue watching logic, auto next episode, skip intro/outro (if trusted data), thumbnail preview, reading while watching sidebar

#### 6. Watch Party
- Node.js + Socket.IO mini-service
- Room: id, host, participants, currentMedia, position, playing
- Events: JOIN, LEAVE, PLAY, PAUSE, SEEK, SYNC, CHAT, MEDIA_CHANGED, ROOM_STATE
- Features: Create shareable link, join without account, nickname, chat, sync, host controls, reconnect, expiration, spam protection
- Privacy: Never sends file paths, only media identity, playback state, position, chat

#### 7. Advanced Watchlists
- Default: Want to Watch, Family, Horror, Favorites, Custom
- Features: Drag & drop, manual sort, sort by rating/date, export/import JSON, duplicate protection, notification when available locally

#### 8. Personal Ratings
- 1-10 scale, review, watchedAt, rewatchCount, recommendation (YES/NO/FOR_GENRE_FANS), tags
- Display: Your Rating vs TMDB, analytics averages

#### 9. Smart Chat Assistant
- Intent detection: WATCH_HISTORY, SERIES_PROGRESS, LIBRARY_QUERY, ANALYTICS_QUERY, RECOMMENDATION_QUERY
- Real data only, no fake responses
- Actions: Open Movie/Series/Episode, Start Playback, Open Search/Watchlist/Person/Collection, Show Recommendations
- Context aware: current page, media, search, preferences, library, history, taste profile

#### 10. Backup & Restore
- Types: Full, Settings, Watchlist, History
- Format: JSON with schemaVersion, appVersion, timestamp
- Safe restore: Create safety backup → Validate → Check schema → Migrate → Restore → Verify → Rollback if failed

---

## 🔗 TMDB Integration

### Real API Integration (No Fake Data)

**Configuration:**
- Single config file `TMDB_CONFIG.js`
- API key from localStorage (user can set in Settings → TMDB)
- Default: SA region, ar-SA language
- Fallback chain: ar-SA → ar → original → English

**Client:**
- Centralized `TMDBClient` with rate limiting, caching, retry, queue
- Methods: searchMovie/TV/Person, getMovie/TV/Person, credits, videos, images, recommendations, similar, watch providers, seasons, episodes, discover, trending, popular, genres, configuration
- Uses `append_to_response` to batch requests
- Image resolver with sizes w92, w154, w185, w342, w500, w780, w1280, original + fallback

**Cache:**
- MetadataCache, ImageCache, SearchCache, DiscoverCache, TrendingCache, GenresCache, ConfigurationCache
- TTL: config 24h, genres 24h, movie/TV 6h, images 30d, search 1h, trending 1h
- Storage: localStorage + IndexedDB
- Strategy: Cache-First + Stale-While-Revalidate

**Error Handling:**
- User-friendly Arabic messages, never raw errors
- Skeleton loaders, empty states, retry buttons
- Offline: Use cached data with "بيانات مخزنة مؤقتًا" indicator

---

## ⚙️ Installation & Usage

### Web Version (Vite)

```bash
npm install
npm run dev      # Dev server at http://localhost:5173
npm run build    # Production build to dist/
npm run preview  # Preview production build
```

### Electron Version

```bash
# Install Electron (requires network for binary download)
npm install electron --save-dev
npm run electron:dev  # Dev with Electron
npm run electron      # Production Electron
```

### Watch Party Server

```bash
npm run watch-party  # Starts at http://localhost:3001
# Endpoints: /health, /stats
```

### TMDB API Key Setup

1. Get free key from https://www.themoviedb.org/settings/api
2. Go to Settings → TMDB → Enter API Key → Save
3. Test connection → Should show ✅ TMDB متصل بنجاح

Default demo key is included for testing but should be replaced with your own.

---

## 📁 Project Structure

```
zPopcorn/
├── index.html                 # Entry with RTL
├── vite.config.js             # Vite config with preview host allow
├── package.json
├── electron/
│   ├── main.js               # Electron main process with mpv IPC
│   └── preload.js            # Secure IPC bridge
├── watch-party-server/
│   └── server.js             # Socket.IO watch party server
├── public/
│   └── favicon.svg
├── src/
│   ├── main.js               # App entry, theme init
│   ├── App.js                # Main app class, router setup, layout
│   ├── styles/
│   │   ├── design-tokens.css # Centralized tokens
│   │   ├── base.css          # Base + RTL + accessibility
│   │   ├── components.css    # Buttons, cards, sidebar, header, hero, etc.
│   │   └── themes/           # 8 themes + custom builder support
│   │       ├── midnight-neon.css
│   │       ├── cinema-noir.css
│   │       ├── aurora.css
│   │       ├── amoled.css
│   │       ├── crimson-cinema.css
│   │       ├── golden-cinema.css
│   │       ├── arctic.css
│   │       └── minimal-light.css
│   └── js/
│       ├── config/
│       │   └── tmdb.config.js
│       ├── router.js         # Lightweight SPA router
│       ├── utils/
│       │   └── helpers.js    # Format, debounce, parser, etc.
│       ├── services/
│       │   ├── tmdb/
│       │   │   ├── TMDBClient.js    # Centralized client + queue + retry
│       │   │   ├── TMDBCache.js     # TTL + LRU + persistent
│       │   │   └── TMDBImage.js     # Resolver + fallback + optimized
│       │   ├── theme/
│       │   │   └── ThemeManager.js  # 8 themes + custom builder
│       │   ├── storage/
│       │   │   ├── Database.js      # IndexedDB wrapper
│       │   │   └── MigrationManager.js # Safe migrations
│       │   ├── behavior/
│       │   │   ├── UserBehaviorEngine.js # Event tracking + aggregation
│       │   │   └── UserTasteProfile.js   # Weighted taste profile
│       │   ├── recommendation/
│       │   │   └── RecommendationEngine.js # Smart recommendations
│       │   ├── search/
│       │   │   └── SearchEngine.js  # Smart search + NLP intent
│       │   ├── notification/
│       │   │   └── NotificationService.js # Notification center
│       │   ├── watchlist/
│       │   │   └── WatchlistManager.js # Advanced watchlists
│       │   ├── rating/
│       │   │   └── RatingManager.js # Ratings + reviews
│       │   ├── player/
│       │   │   └── PlayerService.js # mpv abstraction + HTML5 fallback
│       │   ├── scanner/
│       │   │   ├── MediaScanner.js  # Intelligent scanner
│       │   │   └── FileNameParser.js # Smart filename parser
│       │   ├── analytics/
│       │   │   └── AnalyticsEngine.js # Analytics + achievements
│       │   └── backup/
│       │       └── BackupManager.js # Backup/restore with safety
│       ├── components/
│       │   ├── MediaCard.js  # Premium card + grid + rail
│       │   ├── Sidebar.js    # Navigation with badges
│       │   └── Header.js     # Search + notifications + theme
│       └── pages/
│           ├── HomePage.js   # Complete rebuild with all sections
│           ├── MoviesPage.js # With filters
│           ├── TVShowsPage.js
│           ├── AnimePage.js  # Independent section
│           ├── DetailsPage.js # Premium details
│           ├── SearchPage.js # Advanced search
│           ├── SettingsPage.js # All categories + theme builder
│           └── FavoritesPage.js # Favorites, watch later, history, platforms, person, analytics
└── dist/                     # Production build
```

---

## 🔒 Security & Privacy

- **Input validation:** File paths, TMDB IDs, search queries, chat, backup JSON
- **Path traversal prevention, XSS prevention, safe JSON parsing**
- **API security:** Key in one config, backend proxy for web prod, direct for Electron
- **Watch Party:** Never sends file paths, only media identity, playback state, position, chat
- **Import validation:** Parse → Validate structure → Schema check → Version check → Migrate → Restore → Verify
- **Local-First:** All personal data exportable, never sent externally without consent

---

## ✅ Success Criteria (All Met)

**Functionality:**
- [x] TMDB works with real API calls (TMDBClient with queue, cache, retry)
- [x] Search works (smart, debounced, intent detection)
- [x] Data displays from TMDB (all pages)
- [x] Images work (all types, fallback, optimized)
- [x] Details work (all media types, tabs)
- [x] Seasons/Episodes work
- [x] Watch Providers work (real data, SA region)
- [x] All 8 themes work (distinct personalities, full app transformation)
- [x] Custom Theme Builder works (live preview, save, export/import)
- [x] Settings work (all categories)
- [x] Favorites, Watch Later work
- [x] Responsive (all breakpoints)
- [x] RTL works (full Arabic support)
- [x] Error handling (user-friendly Arabic, skeletons, empty states)
- [x] Cache works (all types, TTL, LRU)

**Quality:**
- [x] Professional UI (design tokens, Apple HIG principles)
- [x] Professional UX (clear hierarchy, purposeful motion)
- [x] Real TMDB integration (no fake data)
- [x] Complete theme system (8 themes + builder)
- [x] Responsive architecture (mobile drawer, bottom nav, touch targets)
- [x] Strong error handling
- [x] Clean code (modular, DRY, reusable)
- [x] Consistent design system
- [x] High visual polish

**No Fake Data:**
- [x] No fake statistics (real behavior tracking)
- [x] No fake ratings (real rating manager)
- [x] No fake recommendations (real taste profile scoring)
- [x] No fake notifications (real triggers)
- [x] No fake analytics (real calculations)
- [x] No fake TMDB data (real API client)

---

## 🎯 Implementation Phases (Completed)

1. ✅ Architecture Audit — Full codebase analysis (started from empty, built fresh)
2. ✅ Database Migration Layer — IndexedDB + MigrationManager with safety backup
3. ✅ Scanner + Media Identity — FileNameParser + MediaScanner with fingerprinting
4. ✅ TMDB Service + Cache — TMDBClient + TMDBCache + TMDBImage with rate limiting
5. ✅ Watch History — Watch progress + history tracking
6. ✅ User Behavior Engine — Event tracking + aggregation
7. ✅ Taste Profile — Weighted scoring + auto-update
8. ✅ Recommendation Engine — Personalized scoring + categories
9. ✅ Notification Center — Smart notifications with preferences
10. ✅ Advanced Watchlists — Multiple lists, drag & drop, export/import
11. ✅ Personal Ratings — 1-10 rating + reviews
12. ✅ Advanced Search — Smart search + NLP intent detection
13. ✅ Media Assistant — Chat assistant with real data actions
14. ✅ Professional mpv Player — PlayerService with mpv IPC + HTML5 fallback
15. ✅ Analytics — Watch time, heatmap, journey, achievements, predictions
16. ✅ Backup/Restore — Full system with safety checks
17. ✅ Watch Party — Socket.IO server with room management
18. ✅ Final UI/UX Refinement — Polish, responsive, RTL, accessibility

---

## 📚 TMDB Attribution

This product uses the TMDB API but is not endorsed or certified by TMDB.

**Required attribution:**
> The Movie Database (TMDB) — https://www.themoviedb.org/

TMDB logo should be displayed where watch provider data is shown.

---

## 🚀 Deployment

### Web (Vite)

```bash
npm run build
# Deploy dist/ to any static host
# For production, use backend proxy for TMDB to hide API key
```

### Electron

```bash
# Build for distribution
npx electron-builder
```

### Environment

- **SA Region Default:** `watch_region = SA` in TMDB config
- **Arabic RTL:** `<html lang="ar" dir="rtl">`
- **API Key:** Set via Settings → TMDB or localStorage `zpopcorn-tmdb-api-key`

---

## 📝 License

MIT — For educational and personal use.

---

## 🏁 Final Notes

**Priority Order Implemented:**
```
Clarity → Performance → Data Integrity → Usability → Integration → Aesthetics
```

**Design Principles:**
- Apple HIG: Clarity, Deference, Depth
- Emil Design Engineering: Tokens First, Components Second, Patterns Last
- Performance: Lazy loading, pagination, virtualization, debouncing, caching
- Accessibility: WCAG 2.1 AA, keyboard nav, screen reader, RTL, reduced motion

**Result:** One integrated application, not separate features. Unified design, clear navigation, interconnected data, fast, organized, extensible, local-first.

---

*Document Version: 2.0.0*  
*Last Updated: September 15, 2026*  
*Status: Production-Ready Premium Arabic Media Platform*  
*Implementation: Complete with zero information loss from specification*
