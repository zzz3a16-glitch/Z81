/**
 * zPopcorn App - Main Application Class
 * Production-Grade Architecture
 */

import { router } from './js/router.js';
import { themeManager } from './js/services/theme/ThemeManager.js';
import { createSidebar } from './js/components/Sidebar.js';
import { createHeader } from './js/components/Header.js';
import { db } from './js/services/storage/Database.js';
import { behaviorEngine } from './js/services/behavior/UserBehaviorEngine.js';
import { tasteProfile } from './js/services/behavior/UserTasteProfile.js';
import { notificationService } from './js/services/notification/NotificationService.js';
import { watchlistManager } from './js/services/watchlist/WatchlistManager.js';
import { ratingManager } from './js/services/rating/RatingManager.js';

// Pages
import { HomePage } from './js/pages/HomePage.js';
import { MoviesPage } from './js/pages/MoviesPage.js';
import { TVShowsPage } from './js/pages/TVShowsPage.js';
import { AnimePage } from './js/pages/AnimePage.js';
import { MovieDetailsPage, TVDetailsPage } from './js/pages/DetailsPage.js';
import { SearchPage } from './js/pages/SearchPage.js';
import { SettingsPage } from './js/pages/SettingsPage.js';
import { FavoritesPage, WatchLaterPage, HistoryPage, ContinueWatchingPage, PlatformsPage, PersonPage, AnalyticsPage } from './js/pages/FavoritesPage.js';

// Advanced Library Pages
import { 
  EraPage, FranchisesPage, SmartCollectionsPage, HealthCenterPage, StoragePage,
  CommandCenterPage, GenresPage, CountriesPage, MissingPiecesPage, DuplicatesPage,
  AuditLogPage, SnapshotsPage, AwardsPage, FormatsPage, ContentThemesPage
} from './js/pages/library/LibraryPages.js';

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
    
    console.log('🍿 zPopcorn Ultimate - Initializing...');
    
    // Initialize database
    try {
      await db.init();
      console.log('✓ Database initialized');
    } catch (e) {
      console.warn('Database init failed:', e);
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
      console.log('✓ Services initialized');
    } catch (e) {
      console.warn('Services init failed:', e);
    }

    // Setup DOM
    this.setupDOM();
    
    // Setup router
    this.setupRouter();
    
    // Setup global event listeners
    this.setupGlobalEvents();
    
    // Hide loading
    const loading = document.getElementById('app-loading');
    if (loading) {
      loading.style.opacity = '0';
      setTimeout(() => loading.remove(), 300);
    }

    this.initialized = true;
    console.log('✓ zPopcorn ready!');
    
    // Dispatch ready event
    window.dispatchEvent(new CustomEvent('zpopcornready'));
  }

  setupDOM() {
    const appContainer = document.getElementById('app');
    
    appContainer.innerHTML = `
      <div id="app-layout" style="display: flex; min-height: 100vh;">
        <div id="sidebar-container"></div>
        <div id="main-container" style="flex: 1; margin-right: var(--sidebar-width); transition: margin-right 0.25s ease; min-width: 0;">
          <div id="header-container"></div>
          <main id="main-content" style="min-height: calc(100vh - var(--header-height));"></main>
          <footer style="padding: 24px; border-top: 1px solid var(--color-border); text-align: center; color: var(--color-text-muted); font-size: 13px; background: var(--color-card);">
            <div style="display: flex; justify-content: center; align-items: center; gap: 16px; flex-wrap: wrap;">
              <span>🍿 zPopcorn Ultimate v2.0.0</span>
              <span>•</span>
              <span>بيانات من <a href="https://www.themoviedb.org/" target="_blank" style="color: var(--color-accent);">TMDB</a></span>
              <span>•</span>
              <span>المنطقة: ${localStorage.getItem('zpopcorn-region') || 'SA'}</span>
            </div>
          </footer>
        </div>
      </div>
      
      <div id="toast-container" class="toast-container"></div>
      <div id="modal-container"></div>
      <div id="player-container" style="display: none;"></div>
    `;

    // Create sidebar
    this.sidebar = createSidebar();
    document.getElementById('sidebar-container').appendChild(this.sidebar);

    // Create header
    this.header = createHeader();
    document.getElementById('header-container').appendChild(this.header);

    this.mainContent = document.getElementById('main-content');
    this.container = document.getElementById('app-layout');

    // Handle sidebar toggle
    window.addEventListener('sidebartoggle', (e) => {
      const mainContainer = document.getElementById('main-container');
      if (e.detail.collapsed) {
        mainContainer.style.marginRight = 'var(--sidebar-collapsed-width)';
      } else {
        mainContainer.style.marginRight = 'var(--sidebar-width)';
      }
    });

    // Handle mobile
    const handleResize = () => {
      const mainContainer = document.getElementById('main-container');
      if (window.innerWidth <= 768) {
        mainContainer.style.marginRight = '0';
      } else {
        const isCollapsed = this.sidebar.classList.contains('collapsed');
        mainContainer.style.marginRight = isCollapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)';
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    // Expose router globally for components
    window.router = router;
  }

  setupRouter() {
    router.addRoutes({
      '/': () => this.renderPage(HomePage),
      '/movies': () => this.renderPage(MoviesPage),
      '/tv': () => this.renderPage(TVShowsPage),
      '/anime': () => this.renderPage(AnimePage),
      '/movie/:id': (params) => this.renderPage(() => MovieDetailsPage(params)),
      '/tv/:id': (params) => this.renderPage(() => TVDetailsPage(params)),
      '/person/:id': (params) => this.renderPage(() => PersonPage(params)),
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
      // System
      '/settings': () => this.renderPage(() => SettingsPage({})),
      '/settings/:section': (params) => this.renderPage(() => SettingsPage(params)),
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

  async renderPage(pageFactory) {
    if (!this.mainContent) return;

    try {
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
      this.mainContent.appendChild(page);

      // Trigger animations
      requestAnimationFrame(() => {
        this.mainContent.style.opacity = '1';
      });

    } catch (error) {
      console.error('Failed to render page:', error);
      this.mainContent.innerHTML = `
        <div class="container" style="padding: 80px 24px; text-align: center;">
          <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
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
    
    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ'
    };

    toast.innerHTML = `
      <div class="toast-icon">${icons[type] || icons.info}</div>
      <div class="toast-content">
        ${title ? `<div class="toast-title">${title}</div>` : ''}
        ${message ? `<div class="toast-message">${message}</div>` : ''}
      </div>
      <button class="toast-close">✕</button>
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
    const playerContainer = document.getElementById('player-container');
    
    playerContainer.style.display = 'block';
    playerContainer.style.position = 'fixed';
    playerContainer.style.inset = '0';
    playerContainer.style.background = 'rgba(0,0,0,0.95)';
    playerContainer.style.zIndex = '1000';
    playerContainer.style.display = 'flex';
    playerContainer.style.flexDirection = 'column';
    
    playerContainer.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; background: rgba(0,0,0,0.8); border-bottom: 1px solid rgba(255,255,255,0.1);">
        <h3 style="color: white; font-weight: 600;">${media.title || media.name || 'تشغيل'}</h3>
        <button id="close-player" class="btn btn-ghost" style="color: white;">✕ إغلاق</button>
      </div>
      <div style="flex: 1; display: flex; align-items: center; justify-content: center; padding: 24px;">
        <div style="text-align: center; color: white; max-width: 600px;">
          <div style="font-size: 64px; margin-bottom: 24px;">🎬</div>
          <h2 style="font-size: 1.5rem; margin-bottom: 12px;">${media.title || media.name || 'مشغل الوسائط'}</h2>
          <p style="opacity: 0.7; margin-bottom: 24px; line-height: 1.6;">
            في إصدار Electron، سيتم تشغيل هذا المحتوى عبر mpv Player مع دعم كامل للترجمات والمسارات الصوتية.<br>
            في إصدار الويب، هذه معاينة لواجهة المشغل الاحترافي.
          </p>
          <div style="background: rgba(255,255,255,0.1); border-radius: 12px; padding: 20px; margin-bottom: 24px; text-align: right;">
            <h4 style="margin-bottom: 12px;">معلومات التشغيل:</h4>
            <div style="display: grid; gap: 8px; font-size: 14px; opacity: 0.8;">
              <div style="display: flex; justify-content: space-between;"><span>المعرف:</span><span class="number-ltr">${media.id}</span></div>
              <div style="display: flex; justify-content: space-between;"><span>النوع:</span><span>${media.media_type || 'movie'}</span></div>
              <div style="display: flex; justify-content: space-between;"><span>التقييم:</span><span>${media.vote_average || 'غير متوفر'}</span></div>
            </div>
          </div>
          <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
            <button class="btn btn-primary" onclick="window.router.navigate('/movie/${media.id}')">عرض التفاصيل</button>
            <button class="btn btn-secondary" style="background: rgba(255,255,255,0.15); color: white; border: 1px solid rgba(255,255,255,0.3);" id="close-player-2">إغلاق المشغل</button>
          </div>
          <div style="margin-top: 24px; padding: 16px; background: rgba(139, 92, 246, 0.15); border: 1px solid rgba(139, 92, 246, 0.3); border-radius: 8px; font-size: 13px;">
            <strong>اختصارات لوحة المفاتيح:</strong><br>
            مسافة = تشغيل/إيقاف • N = التالي • P = السابق • S = الترجمات • A = الصوت • F = ملء الشاشة • M = كتم الصوت
          </div>
        </div>
      </div>
    `;

    const closePlayer = () => {
      playerContainer.style.display = 'none';
      playerContainer.innerHTML = '';
    };

    playerContainer.querySelectorAll('#close-player, #close-player-2').forEach(btn => {
      btn.addEventListener('click', closePlayer);
    });

    playerContainer.addEventListener('click', (e) => {
      if (e.target === playerContainer) {
        closePlayer();
      }
    });

    document.addEventListener('keydown', function escHandler(e) {
      if (e.key === 'Escape') {
        closePlayer();
        document.removeEventListener('keydown', escHandler);
      }
    });
  }
}

// Additional pages
async function RecommendationsPage() {
  const container = document.createElement('div');
  container.innerHTML = `
    <div class="container" style="padding-top: 24px;">
      <h1 style="font-size: 2rem; font-weight: 700; margin-bottom: 8px;">💡 موصى به لك</h1>
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
      <h1 style="font-size: 2rem; font-weight: 700; margin-bottom: 24px;">🔥 الرائج الآن</h1>
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
      <div style="font-size: 64px; margin-bottom: 16px;">🔍</div>
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
