/**
 * Mobile Navigation - Bottom Navigation + Drawer
 * Production-Grade Mobile UX
 */

export function createMobileNav() {
  const nav = document.createElement('nav');
  nav.className = 'mobile-bottom-nav';
  nav.setAttribute('role', 'navigation');
  nav.setAttribute('aria-label', 'التنقل السفلي');

  nav.innerHTML = `
    <a href="/" class="mobile-nav-item" data-route="/" data-router aria-label="الرئيسية">
      <span class="mobile-nav-icon">🏠</span>
      <span class="mobile-nav-label">الرئيسية</span>
    </a>
    <a href="/movies" class="mobile-nav-item" data-route="/movies" data-router aria-label="أفلام">
      <span class="mobile-nav-icon">🎬</span>
      <span class="mobile-nav-label">أفلام</span>
    </a>
    <a href="/tv" class="mobile-nav-item" data-route="/tv" data-router aria-label="مسلسلات">
      <span class="mobile-nav-icon">📺</span>
      <span class="mobile-nav-label">مسلسلات</span>
    </a>
    <a href="/search" class="mobile-nav-item" data-route="/search" data-router aria-label="بحث">
      <span class="mobile-nav-icon">🔍</span>
      <span class="mobile-nav-label">بحث</span>
    </a>
    <a href="/library" class="mobile-nav-item" data-route="/library" data-router aria-label="مكتبتي">
      <span class="mobile-nav-icon">📚</span>
      <span class="mobile-nav-label">مكتبتي</span>
    </a>
  `;

  // Active state
  const updateActive = () => {
    const path = window.location.hash.replace('#', '') || '/';
    nav.querySelectorAll('.mobile-nav-item').forEach(item => {
      item.classList.remove('active');
      const route = item.dataset.route;
      if (route === '/' && path === '/') {
        item.classList.add('active');
      } else if (route !== '/' && path.startsWith(route)) {
        item.classList.add('active');
      }
    });
  };

  window.addEventListener('hashchange', updateActive);
  window.addEventListener('popstate', updateActive);
  setTimeout(updateActive, 100);

  // Touch feedback
  nav.querySelectorAll('.mobile-nav-item').forEach(item => {
    item.addEventListener('touchstart', () => {
      item.style.transform = 'scale(0.95)';
    }, { passive: true });
    
    item.addEventListener('touchend', () => {
      item.style.transform = '';
    }, { passive: true });
  });

  return nav;
}

export function createMobileDrawer() {
  const drawer = document.createElement('div');
  drawer.className = 'mobile-drawer';
  drawer.id = 'mobile-drawer';
  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-label', 'القائمة');

  drawer.innerHTML = `
    <div class="mobile-drawer-backdrop" id="drawer-backdrop"></div>
    <div class="mobile-drawer-content">
      <div class="mobile-drawer-header">
        <div class="drawer-logo">
          <span class="logo-icon">🍿</span>
          <span class="logo-text">zPopcorn</span>
        </div>
        <button class="btn btn-icon btn-ghost" id="close-drawer" aria-label="إغلاق">✕</button>
      </div>
      
      <nav class="mobile-drawer-nav">
        <div class="drawer-section">
          <div class="drawer-section-title">استكشاف</div>
          <a href="/" class="drawer-item" data-router><span class="drawer-icon">🏠</span> الرئيسية</a>
          <a href="/movies" class="drawer-item" data-router><span class="drawer-icon">🎬</span> أفلام</a>
          <a href="/tv" class="drawer-item" data-router><span class="drawer-icon">📺</span> مسلسلات</a>
          <a href="/anime" class="drawer-item" data-router><span class="drawer-icon">🎌</span> أنمي</a>
          <a href="/trending" class="drawer-item" data-router><span class="drawer-icon">🔥</span> الرائج</a>
        </div>

        <div class="drawer-section">
          <div class="drawer-section-title">مكتبتي</div>
          <a href="/favorites" class="drawer-item" data-router><span class="drawer-icon">❤️</span> المفضلة</a>
          <a href="/watch-later" class="drawer-item" data-router><span class="drawer-icon">⏰</span> المشاهدة لاحقاً</a>
          <a href="/continue-watching" class="drawer-item" data-router><span class="drawer-icon">▶️</span> متابعة المشاهدة</a>
          <a href="/history" class="drawer-item" data-router><span class="drawer-icon">🕐</span> سجل المشاهدة</a>
        </div>

        <div class="drawer-section">
          <div class="drawer-section-title">مكتبة متقدمة</div>
          <a href="/library" class="drawer-item" data-router><span class="drawer-icon">📚</span> مركز المكتبة</a>
          <a href="/command-center" class="drawer-item" data-router><span class="drawer-icon">🎛️</span> مركز القيادة</a>
          <a href="/collections" class="drawer-item" data-router><span class="drawer-icon">📚</span> المجموعات</a>
          <a href="/franchises" class="drawer-item" data-router><span class="drawer-icon">🎬</span> السلاسل</a>
        </div>

        <div class="drawer-section">
          <div class="drawer-section-title">ذكاء</div>
          <a href="/recommendations" class="drawer-item" data-router><span class="drawer-icon">💡</span> توصيات</a>
          <a href="/analytics" class="drawer-item" data-router><span class="drawer-icon">📊</span> إحصائيات</a>
          <a href="/search" class="drawer-item" data-router><span class="drawer-icon">🔍</span> بحث متقدم</a>
        </div>

        <div class="drawer-section">
          <div class="drawer-section-title">النظام</div>
          <a href="/settings" class="drawer-item" data-router><span class="drawer-icon">⚙️</span> الإعدادات</a>
          <a href="/health" class="drawer-item" data-router><span class="drawer-icon">🏥</span> صحة المكتبة</a>
        </div>
      </nav>

      <div class="mobile-drawer-footer">
        <div class="drawer-user">
          <div class="user-avatar">ز</div>
          <div class="user-info">
            <div class="user-name">مستخدم zPopcorn</div>
            <div class="user-status">متصل • SA</div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Close handlers
  const close = () => {
    drawer.classList.remove('open');
    document.body.style.overflow = '';
  };

  drawer.querySelector('#close-drawer')?.addEventListener('click', close);
  drawer.querySelector('#drawer-backdrop')?.addEventListener('click', close);

  // Close on navigation
  drawer.querySelectorAll('[data-router]').forEach(link => {
    link.addEventListener('click', close);
  });

  // Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer.classList.contains('open')) {
      close();
    }
  });

  // Expose open method
  drawer.open = () => {
    drawer.classList.add('open');
    document.body.style.overflow = 'hidden';
  };

  drawer.close = close;

  return drawer;
}

export function createBottomSheet() {
  const sheet = document.createElement('div');
  sheet.className = 'bottom-sheet';
  sheet.id = 'bottom-sheet';
  sheet.setAttribute('role', 'dialog');

  sheet.innerHTML = `
    <div class="bottom-sheet-backdrop" id="sheet-backdrop"></div>
    <div class="bottom-sheet-content" id="sheet-content">
      <div class="bottom-sheet-handle"></div>
      <div class="bottom-sheet-body" id="sheet-body"></div>
    </div>
  `;

  const close = () => {
    sheet.classList.remove('open');
    document.body.style.overflow = '';
  };

  sheet.querySelector('#sheet-backdrop')?.addEventListener('click', close);
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sheet.classList.contains('open')) {
      close();
    }
  });

  sheet.open = (content) => {
    const body = sheet.querySelector('#sheet-body');
    if (typeof content === 'string') {
      body.innerHTML = content;
    } else if (content instanceof HTMLElement) {
      body.innerHTML = '';
      body.appendChild(content);
    }
    sheet.classList.add('open');
    document.body.style.overflow = 'hidden';
  };

  sheet.close = close;

  // Swipe to close
  let startY = 0;
  const content = sheet.querySelector('.bottom-sheet-content');
  
  content?.addEventListener('touchstart', (e) => {
    startY = e.touches[0].clientY;
  }, { passive: true });

  content?.addEventListener('touchmove', (e) => {
    const currentY = e.touches[0].clientY;
    const diff = currentY - startY;
    if (diff > 0) {
      content.style.transform = `translateY(${diff}px)`;
    }
  }, { passive: true });

  content?.addEventListener('touchend', (e) => {
    const currentY = e.changedTouches[0].clientY;
    const diff = currentY - startY;
    content.style.transform = '';
    
    if (diff > 100) {
      close();
    }
  }, { passive: true });

  return sheet;
}
