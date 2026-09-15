/**
 * Header Component - Top navigation with search and actions
 */

import { searchEngine } from '../services/search/SearchEngine.js';
import { notificationService } from '../services/notification/NotificationService.js';
import { themeManager } from '../services/theme/ThemeManager.js';

export function createHeader() {
  const header = document.createElement('header');
  header.className = 'header';
  header.id = 'header';
  header.setAttribute('role', 'banner');

  header.innerHTML = `
    <div class="header-start">
      <div id="mobile-menu-container"></div>
      <div class="header-search" id="header-search">
        <span class="header-search-icon">🔍</span>
        <input 
          type="text" 
          class="header-search-input" 
          placeholder="ابحث عن أفلام، مسلسلات، أشخاص..."
          id="global-search-input"
          autocomplete="off"
        />
        <div class="search-suggestions" id="search-suggestions" style="display: none;"></div>
      </div>
    </div>
    
    <div class="header-center" id="header-center">
      <!-- Breadcrumbs or page title can go here -->
    </div>
    
    <div class="header-end">
      <button class="btn btn-icon btn-ghost" id="theme-toggle" title="تغيير المظهر">
        <span id="theme-icon">🎨</span>
      </button>
      
      <button class="btn btn-icon btn-ghost" id="notifications-btn" title="الإشعارات" style="position: relative;">
        <span>🔔</span>
        <span class="notification-badge" id="notification-badge" style="display: none; position: absolute; top: 4px; right: 4px; width: 18px; height: 18px; background: var(--color-danger); color: white; font-size: 10px; border-radius: 50%; display: flex; align-items: center; justify-content: center;">0</span>
      </button>
      
      <div class="header-divider" style="width: 1px; height: 24px; background: var(--color-border); margin: 0 8px;"></div>
      
      <button class="btn btn-ghost btn-sm" id="settings-btn" title="الإعدادات">
        <span>⚙️</span>
        <span style="margin-right: 8px;">الإعدادات</span>
      </button>
    </div>

    <div class="notifications-panel" id="notifications-panel" style="display: none; position: absolute; top: 100%; left: 16px; width: 380px; max-height: 500px; background: var(--color-surface-elevated); border: 1px solid var(--color-border); border-radius: 12px; box-shadow: var(--shadow-xl); z-index: 100; overflow: hidden;">
      <div style="padding: 16px; border-bottom: 1px solid var(--color-border); display: flex; justify-content: space-between; align-items: center;">
        <h3 style="font-size: 16px; font-weight: 600;">الإشعارات</h3>
        <button class="btn btn-ghost btn-sm" id="mark-all-read">تحديد الكل كمقروء</button>
      </div>
      <div id="notifications-list" style="max-height: 400px; overflow-y: auto;"></div>
      <div style="padding: 12px; border-top: 1px solid var(--color-border); text-align: center;">
        <a href="/settings/notifications" data-router style="font-size: 13px; color: var(--color-accent);">إدارة الإشعارات</a>
      </div>
    </div>
  `;

  // Search functionality
  const searchInput = header.querySelector('#global-search-input');
  const suggestionsContainer = header.querySelector('#search-suggestions');
  let searchTimeout;

  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    
    if (searchTimeout) clearTimeout(searchTimeout);
    
    if (query.length < 2) {
      suggestionsContainer.style.display = 'none';
      return;
    }

    searchTimeout = setTimeout(async () => {
      try {
        const suggestions = await searchEngine.getSuggestions(query, 5);
        const recentSearches = suggestions.length > 0 ? suggestions : [];
        
        if (recentSearches.length > 0 || query.length >= 2) {
          suggestionsContainer.innerHTML = `
            ${recentSearches.length > 0 ? `
              <div style="padding: 8px 12px; font-size: 11px; color: var(--color-text-muted); text-transform: uppercase;">عمليات بحث سابقة</div>
              ${recentSearches.map(s => `
                <div class="search-suggestion-item" data-query="${s}" style="padding: 10px 12px; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: background 0.15s;">
                  <span style="color: var(--color-text-muted);">🕐</span>
                  <span>${s}</span>
                </div>
              `).join('')}
              <div style="height: 1px; background: var(--color-border); margin: 8px 0;"></div>
            ` : ''}
            <div class="search-suggestion-item" data-query="${query}" data-action="search" style="padding: 10px 12px; cursor: pointer; display: flex; align-items: center; gap: 8px; background: var(--color-surface-hover);">
              <span>🔍</span>
              <span>ابحث عن "${query}"</span>
            </div>
          `;
          
          suggestionsContainer.style.display = 'block';
          suggestionsContainer.style.position = 'absolute';
          suggestionsContainer.style.top = '100%';
          suggestionsContainer.style.left = '0';
          suggestionsContainer.style.right = '0';
          suggestionsContainer.style.background = 'var(--color-surface-elevated)';
          suggestionsContainer.style.border = '1px solid var(--color-border)';
          suggestionsContainer.style.borderRadius = '12px';
          suggestionsContainer.style.marginTop = '8px';
          suggestionsContainer.style.boxShadow = 'var(--shadow-xl)';
          suggestionsContainer.style.zIndex = '100';
          suggestionsContainer.style.overflow = 'hidden';

          // Add click handlers
          suggestionsContainer.querySelectorAll('.search-suggestion-item').forEach(item => {
            item.addEventListener('click', () => {
              const q = item.dataset.query;
              searchInput.value = q;
              suggestionsContainer.style.display = 'none';
              window.router?.navigate(`/search?q=${encodeURIComponent(q)}`);
            });
            
            item.addEventListener('mouseenter', () => {
              item.style.background = 'var(--color-surface-hover)';
            });
            
            item.addEventListener('mouseleave', () => {
              item.style.background = item.dataset.action === 'search' ? 'var(--color-surface-hover)' : 'transparent';
            });
          });
        }
      } catch {}
    }, 300);
  });

  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const query = searchInput.value.trim();
      if (query) {
        suggestionsContainer.style.display = 'none';
        window.router?.navigate(`/search?q=${encodeURIComponent(query)}`);
      }
    } else if (e.key === 'Escape') {
      suggestionsContainer.style.display = 'none';
    }
  });

  // Hide suggestions when clicking outside
  document.addEventListener('click', (e) => {
    if (!header.contains(e.target)) {
      suggestionsContainer.style.display = 'none';
    }
  });

  // Theme toggle
  const themeToggle = header.querySelector('#theme-toggle');
  themeToggle.addEventListener('click', () => {
    window.router?.navigate('/settings/themes');
  });

  // Notifications
  const notificationsBtn = header.querySelector('#notifications-btn');
  const notificationsPanel = header.querySelector('#notifications-panel');
  const notificationsList = header.querySelector('#notifications-list');
  const notificationBadge = header.querySelector('#notification-badge');
  const markAllReadBtn = header.querySelector('#mark-all-read');

  const updateNotifications = () => {
    const notifications = notificationService.getAll({ limit: 10 });
    const unreadCount = notificationService.getUnreadCount();

    // Update badge
    if (unreadCount > 0) {
      notificationBadge.textContent = unreadCount > 99 ? '99+' : unreadCount;
      notificationBadge.style.display = 'flex';
    } else {
      notificationBadge.style.display = 'none';
    }

    // Update list
    if (notifications.length === 0) {
      notificationsList.innerHTML = `
        <div style="padding: 40px 20px; text-align: center; color: var(--color-text-muted);">
          <div style="font-size: 32px; margin-bottom: 12px;">🔕</div>
          <div>لا توجد إشعارات</div>
        </div>
      `;
    } else {
      notificationsList.innerHTML = notifications.map(notif => `
        <div class="notification-item" data-id="${notif.id}" style="padding: 12px 16px; border-bottom: 1px solid var(--color-border-subtle); cursor: pointer; background: ${notif.read ? 'transparent' : 'var(--color-card)'}; transition: background 0.15s;">
          <div style="display: flex; gap: 12px;">
            <div style="font-size: 20px; flex-shrink: 0;">${notif.icon || '🔔'}</div>
            <div style="flex: 1; min-width: 0;">
              <div style="font-size: 14px; font-weight: ${notif.read ? '400' : '600'}; color: var(--color-text-primary); margin-bottom: 4px;">${notif.title}</div>
              <div style="font-size: 13px; color: var(--color-text-secondary); line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${notif.message}</div>
              <div style="font-size: 11px; color: var(--color-text-muted); margin-top: 6px;">${formatTimeAgo(notif.createdAt)}</div>
            </div>
            ${!notif.read ? '<div style="width: 8px; height: 8px; background: var(--color-accent); border-radius: 50%; flex-shrink: 0; margin-top: 6px;"></div>' : ''}
          </div>
        </div>
      `).join('');

      // Add click handlers
      notificationsList.querySelectorAll('.notification-item').forEach(item => {
        item.addEventListener('click', async () => {
          const id = item.dataset.id;
          const notification = notifications.find(n => n.id === id);
          
          await notificationService.markAsRead(id);
          
          if (notification?.action) {
            window.router?.navigate(notification.action);
            notificationsPanel.style.display = 'none';
          }
        });
      });
    }
  };

  notificationsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isVisible = notificationsPanel.style.display !== 'none';
    notificationsPanel.style.display = isVisible ? 'none' : 'block';
    
    if (!isVisible) {
      updateNotifications();
    }
  });

  markAllReadBtn.addEventListener('click', async () => {
    await notificationService.markAllAsRead();
    updateNotifications();
  });

  // Close panel when clicking outside
  document.addEventListener('click', (e) => {
    if (!header.contains(e.target)) {
      notificationsPanel.style.display = 'none';
    }
  });

  // Listen for notification updates
  notificationService.onUpdate(updateNotifications);
  updateNotifications();

  // Settings button
  const settingsBtn = header.querySelector('#settings-btn');
  settingsBtn.addEventListener('click', () => {
    window.router?.navigate('/settings');
  });

  // Scroll behavior - transparent to solid
  let lastScroll = 0;
  const handleScroll = () => {
    const currentScroll = window.scrollY;
    
    if (currentScroll > 100) {
      header.classList.add('solid');
      header.classList.remove('transparent');
    } else {
      header.classList.remove('solid');
      // Only transparent on home page with hero
      if (window.location.pathname === '/' && document.querySelector('.hero')) {
        header.classList.add('transparent');
      }
    }
    
    lastScroll = currentScroll;
  };

  window.addEventListener('scroll', handleScroll, { passive: true });

  return header;
}

function formatTimeAgo(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'الآن';
  if (minutes < 60) return `منذ ${minutes} دقيقة`;
  if (hours < 24) return `منذ ${hours} ساعة`;
  if (days < 7) return `منذ ${days} يوم`;
  
  return new Date(timestamp).toLocaleDateString('ar-SA');
}
