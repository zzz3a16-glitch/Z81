/**
 * zPopcorn Ultimate - Main Entry Point
 * Production-Grade Media Intelligence Platform
 * 
 * Architecture: Electron.js + Node.js + Vite + Vanilla JS ES2024 + IndexedDB + TMDB API + mpv Player
 * Language: Arabic (RTL) Primary
 * Region: Saudi Arabia (SA) Default
 */

// Styles - Design System
import './styles/design-tokens.css';
import './styles/base.css';
import './styles/components.css';

// Themes - All 8 themes + custom builder support
import './styles/themes/midnight-neon.css';
import './styles/themes/cinema-noir.css';
import './styles/themes/aurora.css';
import './styles/themes/amoled.css';
import './styles/themes/crimson-cinema.css';
import './styles/themes/golden-cinema.css';
import './styles/themes/arctic.css';
import './styles/themes/minimal-light.css';

// Core App
import { App } from './App.js';
import { themeManager } from './js/services/theme/ThemeManager.js';

console.log(`
🍿 zPopcorn Ultimate v2.0.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Production-Grade Media Intelligence Platform
Architecture: Electron + Vite + Vanilla JS ES2024
Region: SA (Saudi Arabia) Default
Language: Arabic RTL Primary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

// Initialize theme immediately to prevent flash
const savedTheme = localStorage.getItem('zpopcorn-theme');
if (savedTheme) {
  try {
    const themeName = JSON.parse(savedTheme);
    document.documentElement.setAttribute('data-theme', themeName);
  } catch {
    document.documentElement.setAttribute('data-theme', 'midnight-neon');
  }
} else {
  document.documentElement.setAttribute('data-theme', 'midnight-neon');
}

// Initialize app when DOM is ready
async function initApp() {
  try {
    const app = new App();
    await app.init();
    
    // Expose for debugging (only in dev)
    if (import.meta.env.DEV) {
      window.zPopcorn = {
        app,
        themeManager,
        version: '2.0.0'
      };
    }
    
  } catch (error) {
    console.error('Failed to initialize zPopcorn:', error);
    
    // Show error UI
    const appContainer = document.getElementById('app');
    if (appContainer) {
      appContainer.innerHTML = `
        <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; text-align: center; background: #0a0a0f; color: white;">
          <div>
            <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
            <h1 style="font-size: 1.5rem; margin-bottom: 8px;">فشل تحميل التطبيق</h1>
            <p style="color: rgba(255,255,255,0.7); margin-bottom: 24px; max-width: 400px;">${error.message || 'حدث خطأ غير متوقع'}</p>
            <button onclick="window.location.reload()" style="background: #8b5cf6; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 500;">إعادة المحاولة</button>
            <div style="margin-top: 24px; font-size: 12px; color: rgba(255,255,255,0.5);">
              <p>تحقق من وحدة التحكم للمزيد من التفاصيل</p>
              <p style="margin-top: 8px; font-family: monospace; background: rgba(255,255,255,0.1); padding: 8px; border-radius: 4px; text-align: left; direction: ltr;">${error.stack || error.message}</p>
            </div>
          </div>
        </div>
      `;
    }
  }
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// Handle unhandled errors
window.addEventListener('error', (event) => {
  console.error('Unhandled error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

// Service Worker registration (for PWA/offline support)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // SW registration failed, not critical
    });
  });
}
