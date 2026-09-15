/**
 * Sidebar Component - Professional navigation
 */

import { router } from '../router.js';
import { notificationService } from '../services/notification/NotificationService.js';
import { watchlistManager } from '../services/watchlist/WatchlistManager.js';

export function createSidebar() {
  const sidebar = document.createElement('aside');
  sidebar.className = 'sidebar';
  sidebar.id = 'sidebar';
  sidebar.setAttribute('role', 'navigation');
  sidebar.setAttribute('aria-label', 'القائمة الرئيسية');

  sidebar.innerHTML = `
    <div class="sidebar-header">
      <a href="/" class="sidebar-logo" data-router>
        <span class="sidebar-logo-icon">🍿</span>
        <span class="sidebar-logo-text">zPopcorn</span>
      </a>
      <button class="btn btn-icon btn-ghost sidebar-toggle" id="sidebar-toggle" aria-label="طي القائمة">
        <span>‹</span>
      </button>
    </div>
    
    <nav class="sidebar-nav">
      <div class="sidebar-section">
        <div class="sidebar-section-title">استكشاف</div>
        <a href="/" class="sidebar-item" data-route="/" data-router>
          <span class="sidebar-item-icon">🏠</span>
          <span class="sidebar-item-label">الرئيسية</span>
        </a>
        <a href="/movies" class="sidebar-item" data-route="/movies" data-router>
          <span class="sidebar-item-icon">🎬</span>
          <span class="sidebar-item-label">أفلام</span>
        </a>
        <a href="/tv" class="sidebar-item" data-route="/tv" data-router>
          <span class="sidebar-item-icon">📺</span>
          <span class="sidebar-item-label">مسلسلات</span>
        </a>
        <a href="/anime" class="sidebar-item" data-route="/anime" data-router>
          <span class="sidebar-item-icon">🎌</span>
          <span class="sidebar-item-label">أنمي</span>
        </a>
        <a href="/platforms" class="sidebar-item" data-route="/platforms" data-router>
          <span class="sidebar-item-icon">📡</span>
          <span class="sidebar-item-label">المنصات</span>
        </a>
      </div>

      <div class="sidebar-section">
        <div class="sidebar-section-title">مكتبتي</div>
        <a href="/favorites" class="sidebar-item" data-route="/favorites" data-router>
          <span class="sidebar-item-icon">❤️</span>
          <span class="sidebar-item-label">المفضلة</span>
          <span class="sidebar-item-badge" id="favorites-badge" style="display: none;">0</span>
        </a>
        <a href="/watch-later" class="sidebar-item" data-route="/watch-later" data-router>
          <span class="sidebar-item-icon">⏰</span>
          <span class="sidebar-item-label">المشاهدة لاحقاً</span>
          <span class="sidebar-item-badge" id="watchlater-badge" style="display: none;">0</span>
        </a>
        <a href="/history" class="sidebar-item" data-route="/history" data-router>
          <span class="sidebar-item-icon">🕐</span>
          <span class="sidebar-item-label">سجل المشاهدة</span>
        </a>
        <a href="/continue-watching" class="sidebar-item" data-route="/continue-watching" data-router>
          <span class="sidebar-item-icon">▶️</span>
          <span class="sidebar-item-label">متابعة المشاهدة</span>
        </a>
      </div>

      <div class="sidebar-section">
        <div class="sidebar-section-title">ذكاء</div>
        <a href="/recommendations" class="sidebar-item" data-route="/recommendations" data-router>
          <span class="sidebar-item-icon">💡</span>
          <span class="sidebar-item-label">توصيات لك</span>
        </a>
        <a href="/analytics" class="sidebar-item" data-route="/analytics" data-router>
          <span class="sidebar-item-icon">📊</span>
          <span class="sidebar-item-label">الإحصائيات</span>
        </a>
        <a href="/search" class="sidebar-item" data-route="/search" data-router>
          <span class="sidebar-item-icon">🔍</span>
          <span class="sidebar-item-label">البحث المتقدم</span>
        </a>
      </div>

      <div class="sidebar-section">
        <div class="sidebar-section-title">النظام</div>
        <a href="/settings" class="sidebar-item" data-route="/settings" data-router>
          <span class="sidebar-item-icon">⚙️</span>
          <span class="sidebar-item-label">الإعدادات</span>
        </a>
        <a href="/settings/themes" class="sidebar-item" data-route="/settings/themes" data-router>
          <span class="sidebar-item-icon">🎨</span>
          <span class="sidebar-item-label">المظاهر</span>
        </a>
      </div>
    </nav>

    <div class="sidebar-footer">
      <div class="sidebar-user" style="display: flex; align-items: center; gap: 12px; padding: 8px; border-radius: 8px; background: var(--color-card);">
        <div style="width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, var(--color-accent), var(--color-accent-secondary)); display: flex; align-items: center; justify-content: center; color: white; font-weight: 600;">ز</div>
        <div style="flex: 1; min-width: 0;">
          <div style="font-size: 14px; font-weight: 500; color: var(--color-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">مستخدم zPopcorn</div>
          <div style="font-size: 12px; color: var(--color-text-muted);">متصل</div>
        </div>
      </div>
    </div>
  `;

  // Event listeners
  const toggleBtn = sidebar.querySelector('#sidebar-toggle');
  toggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    const isCollapsed = sidebar.classList.contains('collapsed');
    localStorage.setItem('zpopcorn-sidebar-collapsed', isCollapsed);
    toggleBtn.innerHTML = isCollapsed ? '<span>›</span>' : '<span>‹</span>';
    
    // Dispatch event for main content adjustment
    window.dispatchEvent(new CustomEvent('sidebartoggle', { 
      detail: { collapsed: isCollapsed } 
    }));
  });

  // Restore collapsed state
  const savedCollapsed = localStorage.getItem('zpopcorn-sidebar-collapsed') === 'true';
  if (savedCollapsed) {
    sidebar.classList.add('collapsed');
    toggleBtn.innerHTML = '<span>›</span>';
  }

  // Update active state based on route
  const updateActiveState = (route) => {
    const items = sidebar.querySelectorAll('.sidebar-item');
    items.forEach(item => {
      item.classList.remove('active');
      const routePath = item.dataset.route;
      if (routePath && route.actualPath) {
        if (routePath === '/' && route.actualPath === '/') {
          item.classList.add('active');
        } else if (routePath !== '/' && route.actualPath.startsWith(routePath)) {
          item.classList.add('active');
        }
      }
    });
  };

  router.onRouteChange(updateActiveState);

  // Update badges
  const updateBadges = async () => {
    try {
      const [favorites, watchLater] = await Promise.all([
        watchlistManager.getList('favorites').catch(() => null),
        watchlistManager.getList('watch-later').catch(() => null)
      ]);

      const favBadge = sidebar.querySelector('#favorites-badge');
      const watchLaterBadge = sidebar.querySelector('#watchlater-badge');

      if (favorites && favorites.items.length > 0) {
        favBadge.textContent = favorites.items.length;
        favBadge.style.display = 'block';
      } else {
        favBadge.style.display = 'none';
      }

      if (watchLater && watchLater.items.length > 0) {
        watchLaterBadge.textContent = watchLater.items.length;
        watchLaterBadge.style.display = 'block';
      } else {
        watchLaterBadge.style.display = 'none';
      }
    } catch {}
  };

  // Initial badge update and listen for changes
  updateBadges();
  window.addEventListener('watchlistupdate', updateBadges);

  // Mobile handling
  const handleMobile = () => {
    if (window.innerWidth <= 768) {
      sidebar.classList.remove('collapsed');
      sidebar.classList.add('mobile-hidden');
    } else {
      sidebar.classList.remove('mobile-hidden', 'mobile-open');
    }
  };

  window.addEventListener('resize', handleMobile);
  handleMobile();

  // Close mobile sidebar when clicking outside
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 && 
        sidebar.classList.contains('mobile-open') && 
        !sidebar.contains(e.target) && 
        !e.target.closest('#mobile-menu-btn')) {
      sidebar.classList.remove('mobile-open');
    }
  });

  return sidebar;
}

export function createMobileMenuButton() {
  const btn = document.createElement('button');
  btn.id = 'mobile-menu-btn';
  btn.className = 'btn btn-icon btn-ghost';
  btn.innerHTML = '☰';
  btn.setAttribute('aria-label', 'فتح القائمة');
  
  btn.addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
      sidebar.classList.toggle('mobile-open');
    }
  });

  return btn;
}
