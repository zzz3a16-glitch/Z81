/**
 * zPopcorn App - Main Application Class
 * Production-Grade Architecture
 */

import { router } from './js/router.js';
import { themeManager } from './js/services/theme/ThemeManager.js';
import { createSidebar } from './js/components/Sidebar.js';
import { icon } from './js/ui/icons.js';
import { iconAnim } from './js/ui/IconFX.js';
import { themeEngine } from './js/theme/ThemeEngine.js';
import { createHeader } from './js/components/Header.js';
import { db } from './js/services/storage/Database.js';
import bridge from './js/bridge.js';
window.__zpopcornBridge = bridge;
import { behaviorEngine } from './js/services/behavior/UserBehaviorEngine.js';
import { tasteProfile } from './js/services/behavior/UserTasteProfile.js';
import { notificationService } from './js/services/notification/NotificationService.js';
import { watchlistManager } from './js/services/watchlist/WatchlistManager.js';
import { ratingManager } from './js/services/rating/RatingManager.js';

// Pages
import { HomePage } from './js/pages/HomePage.js';
import { PersonPage as NewPersonPage } from './js/pages/PersonPage.js';
import { MoviesPage } from './js/pages/MoviesPage.js';
import { TVShowsPage } from './js/pages/TVShowsPage.js';
import { AnimePage } from './js/pages/AnimePage.js';
import { MovieDetailsPage, TVDetailsPage } from './js/pages/DetailsPage.js';
import { SearchPage } from './js/pages/SearchPage.js';
import { SettingsPage } from './js/pages/SettingsPage.js';
import { EnhancedSettingsPage } from './js/pages/EnhancedSettingsPage.js';
import { AssistantPage } from './js/pages/AssistantPage.js';
import { FavoritesPage, WatchLaterPage, HistoryPage, ContinueWatchingPage, PlatformsPage, PersonPage, AnalyticsPage } from './js/pages/FavoritesPage.js';

// Advanced Library Pages
import { 
  EraPage, FranchisesPage, SmartCollectionsPage, HealthCenterPage, StoragePage,
  CommandCenterPage, GenresPage, CountriesPage, MissingPiecesPage, DuplicatesPage,
  AuditLogPage, SnapshotsPage, AwardsPage, FormatsPage, ContentThemesPage
} from './js/pages/library/LibraryPages.js';
import { MediaTypesPage, CollectionBuilderPage, LibraryHubPage, LibraryBrowsePage } from './js/pages/library/ExtraPages.js';

export class App {
  constructor() {
    this.container = null;
    this.sidebar = null;
    this.header = null;
    this.mainContent = null;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    
    console.log(' zPopcorn Ultimate - Initializing Production-Grade...');

    // Initialize performance monitoring
    try {
      const { performanceManager } = await import('./js/services/performance/PerformanceManager.js');
      performanceManager.init();
      console.log('✓ Performance manager initialized');
    } catch (e) {
      console.warn('Performance manager init failed:', e);
    }
    
    // Initialize database with migration
    try {
      await db.init();
      const { MigrationManager } = await import('./js/services/storage/MigrationManager.js');
      const migrator = new MigrationManager();
      await migrator.migrate();
      console.log('✓ Database + migrations initialized');
    } catch (e) {
      console.warn('Database init failed:', e);
    }

    // Initialize media identity systems
    try {
      const { editionManager, personalArchive } = await import('./js/services/media/MediaIdentity.js');
      await editionManager.init();
      await personalArchive.init();
      console.log('✓ Media identity systems initialized');
    } catch (e) {
      console.warn('Media identity init failed:', e);
    }

    // Initialize behavior engine
    try {
      await behaviorEngine.init();
      console.log('✓ Behavior engine initialized');
    } catch (e) {
      console.warn('Behavior engine init failed:', e);
    }

    // Initialize taste profile
    try {
      await tasteProfile.init();
      console.log('✓ Taste profile initialized');
    } catch (e) {
      console.warn('Taste profile init failed:', e);
    }

    // Initialize other services
    try {
      await notificationService.init();
      await watchlistManager.init();
      await ratingManager.init();
      console.log('✓ Core services initialized');
    } catch (e) {
      console.warn('Services init failed:', e);
    }

    // Initialize security
    try {
      const { securityManager } = await import('./js/services/security/SecurityManager.js');
      securityManager.cleanup();
      console.log('✓ Security manager initialized');
    } catch {}

    // Setup DOM
    this.setupDOM();
    
    // Expose router globally (components + inline handlers)
    window.router = router;

    // Setup router
    this.setupRouter();
    
    // Setup global event listeners
    this.setupGlobalEvents();

    // Desktop: menu/native accelerators for search focus
    window.addEventListener('zpopcorn:focus-search', () => window.zpFocusSearch?.());
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); window.zpFocusSearch?.(); }
    });

    // Scan trigger from first-run / drop / manual
    window.addEventListener('zpopcorn:run-scan', async () => {
      const { isDesktop, api } = window.__zpopcornBridge || {};
      if (!isDesktop) return;
      try { await api.inbox.scan({}); } catch { /* running */ }
    });

    // First run flow (spec 55) — after DOM, non-blocking
    import('./js/ui/firstRun.js').then((m) => m.maybeFirstRun(router)).catch(() => {});

    // Reveal the app — splash fade
    const loading = document.getElementById('app-loading');
    if (loading) { loading.style.opacity = '0'; setTimeout(() => loading.remove(), 300); }
    const splash = document.getElementById('z-splash');
    if (splash) {
      splash.classList.add('hide');
      setTimeout(() => splash.remove(), 600);
    }

    this.initialized = true;
    console.log('✓ zPopcorn ready!');
    
    // Dispatch ready event
    window.dispatchEvent(new CustomEvent('zpopcornready'));
  }

  setupDOM() {
    const appContainer = document.getElementById('app');

    appContainer.innerHTML = `
      <div class="z-app" id="z-root">
        <div id="sidebar-slot" style="display:contents"></div>
        <div class="z-frame">
          <div id="header-slot" style="display:contents"></div>
          <main class="z-content"><div id="main-content" style="min-height:calc(100vh - var(--topbar-h));"></div></main>
        </div>
      </div>

      <div id="toast-container"></div>
      <div id="modal-container"></div>
      <div id="player-container" style="display: none;"></div>
      <div class="z-drop" id="z-drop">
        <div class="z-drop-card">
          <span class="ic">${icon('folderOpen', 26, { weight: 'duotone' })}
          </span>
          <span>أفلِت المجلد لإضافته إلى المكتبة</span>
          <small>لن تُنسخ أو تُنقل أي ملفات — يُضاف المسار كمصدر فحص فقط</small>
        </div>
      </div>
      <div class="z-offlinechip">
        ${icon('wifiOff', 14, { stroke: 1.8 })}
        غير متصل — مكتبتك المحلية تعمل كالمعتاد
      </div>
    `;

    // Sidebar & header
    this.sidebar = createSidebar();
    document.getElementById('sidebar-slot').appendChild(this.sidebar);
    this.header = createHeader();
    document.getElementById('header-slot').appendChild(this.header);

    this.mainContent = document.getElementById('main-content');
    this.container = document.getElementById('z-root');

    // Desktop drag-and-drop → add library source (spec 42)
    this.initDragDrop();

    // Global media context menus (spec 41)
    import('./js/ui/contextMenu.js').then((m) => m.initContextMenus()).catch(() => {});
  }

  initDragDrop() {
    const { isDesktop, api } = window.__zpopcornBridge || {};
    const drop = document.getElementById('z-drop');
    if (!drop) return;
    let depth = 0;
    const hasFiles = (e) => Array.from(e.dataTransfer?.types || []).includes('Files');
    window.addEventListener('dragenter', (e) => {
      if (!isDesktop || !hasFiles(e)) return;
      depth++; drop.classList.add('on');
    });
    window.addEventListener('dragover', (e) => { if (isDesktop && hasFiles(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
    window.addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; drop.classList.remove('on'); } });
    window.addEventListener('drop', async (e) => {
      if (!isDesktop || !hasFiles(e)) return;
      e.preventDefault(); depth = 0; drop.classList.remove('on');
      const files = Array.from(e.dataTransfer.files || []);
      const paths = files.map((f) => window.zpopcorn?.files?.pathForFile?.(f)).filter(Boolean);
      const dirs = new Set(paths.map((p) => {
        const idx = Math.max(p.lastIndexOf('\\'), p.lastIndexOf('/'));
        return idx > 1 ? p.slice(0, idx) : p;
      }));
      let added = 0;
      for (const d of dirs) {
        try { await api.library.addSource(d); added++; } catch { /* dup or rejected */ }
      }
      if (!added) {
        window.dispatchEvent(new CustomEvent('showtoast', { detail: { message: 'لم يُضف شيء — قد تكون المجلدات مسجّلة مسبقاً', type: 'info' } }));
        return;
      }
      window.dispatchEvent(new CustomEvent('showtoast', { detail: { message: `أُضيف ${added} مجلد — يبدأ الفحص الآن`, type: 'success' } }));
      window.dispatchEvent(new CustomEvent('zpopcorn:run-scan'));
      window.router?.navigate('/inbox');
    });
  }

  setupRouter() {
    router.addRoutes({
      '/': () => this.renderPage(HomePage),
      '/movies': (params, query) => this.renderPage(() => MoviesPage(params, query)),
      '/tv': (params, query) => this.renderPage(() => TVShowsPage(params, query)),
      '/anime': () => this.renderPage(AnimePage),
      '/company/:id': (params) => this.renderPage(() => import('./js/pages/CompanyPage.js').then((m) => m.CompanyPage(params))),
      '/movie/:id': (params) => this.renderPage(() => MovieDetailsPage(params)),
      '/tv/:id': (params) => this.renderPage(() => TVDetailsPage(params)),
      '/person/:id': (params) => this.renderPage(() => NewPersonPage(params)),
      '/search': (params, query) => this.renderPage(() => SearchPage(params, query)),
      '/favorites': () => this.renderPage(FavoritesPage),
      '/watch-later': () => this.renderPage(WatchLaterPage),
      '/watchlist/:id': (params) => this.renderPage(() => WatchlistPage(params)),
      '/history': () => this.renderPage(HistoryPage),
      '/continue-watching': () => this.renderPage(ContinueWatchingPage),
      '/platforms': () => this.renderPage(PlatformsPage),
      '/analytics': () => this.renderPage(AnalyticsPage),
      '/recommendations': () => this.renderPage(RecommendationsPage),
      '/trending': () => this.renderPage(TrendingPage),
      // LIVE — IPTV (lazy: whole module tree is route-split)
      '/live': () => this.renderPage(() => import('./js/pages/live/LiveHome.js').then((m) => m.LiveHomePage())),
      '/live/channels': (params, query) => this.renderPage(() => import('./js/pages/live/LiveChannels.js').then((m) => m.LiveChannelsPage(params, query))),
      '/live/guide': () => this.renderPage(() => import('./js/pages/live/LiveGuide.js').then((m) => m.LiveGuidePage())),
      '/live/sources': () => this.renderPage(() => import('./js/pages/live/LiveSources.js').then((m) => m.LiveSourcesPage())),
      '/live/settings': () => this.renderPage(() => import('./js/pages/live/LiveSettings.js').then((m) => m.LiveSettingsPage())),
      // Advanced Library - Era & Time
      '/eras': () => this.renderPage(() => new EraPage().render()),
      '/era/:era': (params) => this.renderPage(() => new EraPage().render(params)),
      // Franchises & Collections
      '/franchises': () => this.renderPage(() => new FranchisesPage().render()),
      '/collections': () => this.renderPage(() => new SmartCollectionsPage().render()),
      '/genres': () => this.renderPage(() => new GenresPage().render()),
      '/genre/:id': (params) => this.renderPage(() => new GenresPage().render(params)),
      '/countries': () => this.renderPage(() => new CountriesPage().render()),
      '/awards': () => this.renderPage(() => new AwardsPage().render()),
      '/formats': () => this.renderPage(() => new FormatsPage().render()),
      '/content-themes': () => this.renderPage(() => new ContentThemesPage().render()),
      // Health & Organization
      '/command-center': () => this.renderPage(() => new CommandCenterPage().render()),
      '/health': () => this.renderPage(() => new HealthCenterPage().render()),
      '/storage': () => this.renderPage(() => new StoragePage().render()),
      '/duplicates': () => this.renderPage(() => new DuplicatesPage().render()),
      '/missing': () => this.renderPage(() => new MissingPiecesPage().render()),
      '/audit': () => this.renderPage(() => new AuditLogPage().render()),
      '/snapshots': () => this.renderPage(() => new SnapshotsPage().render()),
      '/media-types': () => this.renderPage(() => new MediaTypesPage().render()),
      '/collection-builder': () => this.renderPage(() => new CollectionBuilderPage().render()),
      '/library': () => this.renderPage((params, query) => new LibraryBrowsePage().render(params, query)),
      '/library-hub': () => this.renderPage(() => new LibraryHubPage().render()),
      '/assistant': () => this.renderPage(() => AssistantPage()),
      '/chat': () => this.renderPage(() => AssistantPage()),
      // System - Enhanced Settings with 15 categories
      '/settings': () => this.renderPage(() => EnhancedSettingsPage({})),
      '/settings/:section': (params) => this.renderPage(() => EnhancedSettingsPage(params)),
      '/settings-old': () => this.renderPage(() => SettingsPage({})),
      '/settings-old/:section': (params) => this.renderPage(() => SettingsPage(params)),
      '/inbox': () => import('./js/pages/InboxPage.js').then(m => this.renderPage(() => m.InboxPage())),
      '/developer': () => import('./js/pages/DeveloperPage.js').then(m => this.renderPage(() => m.DeveloperPage())),
      '/404': () => this.renderPage(NotFoundPage)
    });

    router.beforeEach((path) => {
      // Show loading for page transitions
      if (this.mainContent) {
        this.mainContent.style.opacity = '0.7';
      }
      return true;
    });

    router.afterEach(() => {
      if (this.mainContent) {
        this.mainContent.style.opacity = '1';
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });

    router.init();
  }

  /** Page-specific appearance overrides (spec 36/37) */
  applyPageAppearance() {
    const main = this.mainContent;
    if (!main) return;
    if (this.__ovProps) for (const prop of this.__ovProps) main.style.removeProperty(prop);
    this.__ovProps = null;
    main.removeAttribute('data-density-ov');
    main.removeAttribute('data-z-card');
    this.__ovChip?.remove(); this.__ovChip = null;
    let path = '/';
    try { path = window.router?.currentRoute?.path || '/'; } catch { /* */ }
    let ent = null;
    try { ent = themeEngine.pageOverride(path); } catch { return; }
    if (!ent) return;
    const vars = themeEngine.varsForOverride(ent);
    this.__ovProps = Object.keys(vars);
    for (const [k, v] of Object.entries(vars)) if (v) main.style.setProperty(k, v);
    if (ent.density) main.setAttribute('data-density-ov', ent.density);
    if (ent.cardStyle) main.setAttribute('data-z-card', ent.cardStyle);
    const chip = document.createElement('div');
    chip.className = 'z-ovchip';
    chip.innerHTML = `${icon('layers', 13)}<span>تجاوز مظهر خاص بهذه الصفحة</span><button type="button">${icon('x', 11)} إلغاء التجاوز</button>`;
    chip.querySelector('button').addEventListener('click', () => {
      try { themeEngine.clearPageOverride(path); } catch { /* */ }
      this.applyPageAppearance();
    });
    document.body.appendChild(chip);
    this.__ovChip = chip;
  }

  async renderPage(pageFactory) {
    if (!this.mainContent) return;

    try {
      // Page teardown hook — pages may attach __zpopCleanup() for listeners/timers
      try { this.mainContent.firstElementChild?.__zpopCleanup?.(); } catch { /* page owns its errors */ }
      // Clear current content
      this.mainContent.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; min-height: 60vh;">
          <div style="text-align: center;">
            <div class="app-loading-spinner" style="margin: 0 auto 16px;"></div>
            <p style="color: var(--color-text-secondary);">جاري التحميل...</p>
          </div>
        </div>
      `;

      const page = await pageFactory();
      
      this.mainContent.innerHTML = '';
      if (page?.classList) page.classList.add('z-page');
      this.mainContent.appendChild(page);
      window.scrollTo({ top: 0 });
      this.applyPageAppearance();

      // Trigger animations
      requestAnimationFrame(() => {
        this.mainContent.style.opacity = '1';
      });

    } catch (error) {
      console.error('Failed to render page:', error);
      this.mainContent.innerHTML = `
        <div class="container" style="padding: 80px 24px; text-align: center;">
          <span style="display:inline-flex;margin-bottom:14px">${iconAnim('error', 56)}</span>
          <h2 style="margin-bottom: 8px;">حدث خطأ</h2>
          <p style="color: var(--color-text-secondary); margin-bottom: 24px;">${error.message || 'فشل تحميل الصفحة'}</p>
          <button class="btn btn-primary" onclick="window.router.navigate('/')">العودة للرئيسية</button>
        </div>
      `;
    }
  }

  setupGlobalEvents() {
    // Toast system
    window.addEventListener('showtoast', (e) => {
      this.showToast(e.detail);
    });

    // Player
    window.addEventListener('playmedia', (e) => {
      this.showPlayer(e.detail);
    });

    // Handle offline
    window.addEventListener('offline', () => {
      this.showToast({
        type: 'warning',
        title: 'غير متصل',
        message: 'أنت الآن في وضع عدم الاتصال. سيتم استخدام البيانات المخزنة مؤقتاً',
        duration: 5000
      });
    });

    window.addEventListener('online', () => {
      this.showToast({
        type: 'success',
        title: 'متصل',
        message: 'تم استعادة الاتصال بالإنترنت',
        duration: 3000
      });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('global-search-input')?.focus();
      }
      
      if (e.key === 'Escape') {
        // Close modals, panels, etc.
        document.querySelectorAll('.modal-backdrop.active').forEach(modal => {
          modal.classList.remove('active');
        });
      }
    });
  }

  showToast({ type = 'info', title, message, duration = 4000 }) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // meaningful states, per icon system: duotone marks a state (spec: special visual states)
    const icons = {
      success: icon('success', 17, { weight: 'duotone' }),
      error: icon('error', 17, { weight: 'duotone' }),
      warning: icon('warning', 17, { weight: 'duotone' }),
      info: icon('info', 17, { weight: 'duotone' })
    };

    toast.innerHTML = `
      <div class="toast-icon">${icons[type] || icons.info}</div>
      <div class="toast-content">
        ${title ? `<div class="toast-title">${title}</div>` : ''}
        ${message ? `<div class="toast-message">${message}</div>` : ''}
      </div>
      <button class="toast-close" aria-label="إغلاق">${icon('x', 13)}</button>
    `;

    container.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    // Auto dismiss
    const dismissTimer = setTimeout(() => {
      dismissToast();
    }, duration);

    const dismissToast = () => {
      clearTimeout(dismissTimer);
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    };

    toast.querySelector('.toast-close').addEventListener('click', dismissToast);
    
    // Dismiss on click
    toast.addEventListener('click', (e) => {
      if (!e.target.closest('.toast-close')) {
        dismissToast();
      }
    });
  }

  showPlayer(media) {
    // spec 02: the playback engine is a SEPARATE future phase.
    // This panel is honest about state; no video element, no mpv, no decoder.
    const playerContainer = document.getElementById('player-container');
    playerContainer.style.display = 'flex';
    playerContainer.style.position = 'fixed';
    playerContainer.style.inset = '0';
    playerContainer.style.background = 'rgba(0,0,0,0.92)';
    playerContainer.style.zIndex = '1000';
    playerContainer.style.flexDirection = 'column';
    playerContainer.style.alignItems = 'center';
    playerContainer.style.justifyContent = 'center';
    playerContainer.innerHTML = `
      <div style="max-width: 640px; margin: 24px; padding: 32px; text-align: center; background: var(--color-surface, #12121c); border: 1px solid var(--color-border); border-radius: 16px; color: var(--color-text-primary); box-shadow: 0 24px 64px rgba(0,0,0,0.5);">
        <div style="width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;background:var(--color-accent,#8b5cf6)22;border:1px solid var(--color-accent,#8b5cf6)55;color:var(--color-accent,#8b5cf6);font-size:22px;">▶</div>
        <h2 style="font-size:1.25rem;margin-bottom:8px;">${media.title || media.name || 'وسائط'}</h2>
        <p style="color:var(--color-text-secondary);line-height:1.7;margin-bottom:20px;">
          مشغّل الوسائط غير مُفعّل بعد — تم تصميم بنية zPopcorn على أن يكون محرك
          التشغيل مرحلة منفصلة قادمة، وستُضاف له كامل دعم المسارات والترجمات تلقائياً.
        </p>
        <div data-playback-flags style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:20px;"></div>
        <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
          ${media.id ? `<button class="btn btn-primary" id="playback-details">عرض التفاصيل</button>` : ''}
          ${media.localFile || (media.localFiles && media.localFiles[0]) ? `<button class="btn btn-secondary" id="playback-show" style="background:rgba(255,255,255,0.08);color:inherit;border:1px solid var(--color-border);">فتح موقع الملف</button>` : ''}
          <button class="btn btn-ghost" id="playback-close" style="color:var(--color-text-secondary);">إغلاق</button>
        </div>
      </div>
    `;
    const close = () => {
      playerContainer.style.display = 'none';
      playerContainer.innerHTML = '';
      document.removeEventListener('keydown', esc);
    };
    const esc = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', esc);
    playerContainer.querySelector('#playback-close')?.addEventListener('click', close);
    playerContainer.querySelector('#playback-details')?.addEventListener('click', () => {
      close();
      const t = (media.media_type || 'movie') === 'tv' ? '/tv/' : '/movie/';
      window.router?.navigate(`${t}${media.id}`);
    });
    playerContainer.querySelector('#playback-show')?.addEventListener('click', async () => {
      const { isDesktop, api } = window.__zpopcornBridge || {};
      const filePath = media.localFile || (media.localFiles && media.localFiles[0]);
      if (!isDesktop || !filePath) { close(); return; }
      try { await api.system.showItemInFolder(filePath); }
      catch { window.dispatchEvent(new CustomEvent('showtoast', { detail: { message: 'تعذّر فتح موقع الملف', type: 'warning' } })); }
    });
    (async () => {
      const flags = playerContainer.querySelector('[data-playback-flags]');
      if (!flags) return;
      const { isDesktop, api } = window.__zpopcornBridge || {};
      const store = (media.media_type === 'tv') ? 'tvshows' : 'movies';
      let files = [];
      if (isDesktop && media.id) {
        try { files = await api.library.listMediaFiles(store, media.id); } catch { /* ok */ }
      } else if (media.localFiles && media.localFiles.length) {
        files = media.localFiles.map((f) => ({ path: f, status: 'ok' }));
      }
      const items = [];
      items.push(`<span class="badge" style="padding:4px 10px;border-radius:999px;border:1px solid var(--color-border);font-size:12px;">المحرك: غير مُفعّل بعد</span>`);
      if (files.length) {
        items.push(`<span class="badge" style="padding:4px 10px;border-radius:999px;background:rgba(16,185,129,.12);color:#10b981;border:1px solid rgba(16,185,129,.4);font-size:12px;" dir="ltr">${files.length} ملف محلي</span>`);
      } else {
        items.push(`<span class="badge" style="padding:4px 10px;border-radius:999px;border:1px solid var(--color-border);font-size:12px;color:var(--color-text-muted);">لا يوجد ملف محلي مرتبط</span>`);
      }
      flags.innerHTML = items.join('');
    })();
    this._trackPlaybackIntent?.(media);
  }
}

// Additional pages
async function RecommendationsPage() {
  const container = document.createElement('div');
  container.innerHTML = `
    <div class="container" style="padding-top: 24px;">
      <h1 style="font-size: 2rem; font-weight: 700; margin-bottom: 8px;"> موصى به لك</h1>
      <p style="color: var(--color-text-secondary); margin-bottom: 24px;">توصيات ذكية بناءً على ذوقك وسلوك المشاهدة</p>
      <div id="recs-grid" class="media-grid"></div>
    </div>
  `;

  const grid = container.querySelector('#recs-grid');
  grid.innerHTML = '<div class="skeleton-card skeleton"></div>'.repeat(12);

  try {
    const { recommendationEngine } = await import('./js/services/recommendation/RecommendationEngine.js');
    const recs = await recommendationEngine.getRecommendations(20);
    
    if (recs.length > 0) {
      const { createMediaGrid } = await import('./js/components/MediaCard.js');
      createMediaGrid(recs, grid);
    } else {
      grid.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1;"><p>لا توجد توصيات بعد. ابدأ بمشاهدة محتوى لبناء ملف ذوقك</p></div>`;
    }
  } catch (e) {
    grid.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1;"><p>فشل تحميل التوصيات</p></div>`;
  }

  return container;
}

async function TrendingPage() {
  const container = document.createElement('div');
  container.innerHTML = `
    <div class="container" style="padding-top: 24px;">
      <h1 style="font-size: 2rem; font-weight: 700; margin-bottom: 24px;"> الرائج الآن</h1>
      <div id="trending-grid" class="media-grid"></div>
    </div>
  `;

  const grid = container.querySelector('#trending-grid');
  grid.innerHTML = '<div class="skeleton-card skeleton"></div>'.repeat(12);

  try {
    const { tmdbClient } = await import('./js/services/tmdb/TMDBClient.js');
    const trending = await tmdbClient.trending('all', 'week');
    
    if (trending.results?.length > 0) {
      const { createMediaGrid } = await import('./js/components/MediaCard.js');
      createMediaGrid(trending.results, grid);
    }
  } catch {}

  return container;
}

function NotFoundPage() {
  const div = document.createElement('div');
  div.innerHTML = `
    <div class="container" style="padding: 80px 24px; text-align: center;">
      <div style="font-size: 64px; margin-bottom: 16px;"></div>
      <h2 style="font-size: 1.5rem; margin-bottom: 8px;">الصفحة غير موجودة</h2>
      <p style="color: var(--color-text-secondary); margin-bottom: 24px;">الصفحة التي تبحث عنها غير موجودة أو تم نقلها</p>
      <button class="btn btn-primary" onclick="window.router.navigate('/')">العودة للرئيسية</button>
    </div>
  `;
  return div;
}

async function WatchlistPage(params) {
  const { FavoritesPage } = await import('./js/pages/FavoritesPage.js');
  // This is a generic handler, actual implementation in FavoritesPage.js exports WatchlistPage
  const module = await import('./js/pages/FavoritesPage.js');
  if (module.WatchlistPage) {
    return module.WatchlistPage(params);
  }
  return NotFoundPage();
}
