/**
 * zPopcorn Ultimate - Main Entry Point
 * Production-Grade Media Intelligence Platform
 * 
 * Architecture: Electron shell + typed IPC bridge + Vite + Vanilla JS ES2024
 *               SQLite in main (better-sqlite3/sql.js) · TMDB via main-side cache
 *               (browser mode keeps the legacy IndexedDB stack for QA only)
 *               Player engine is a separate future phase — capability-gated, not shipped
 * Language: Arabic (RTL) Primary
 * Region: Saudi Arabia (SA) Default
 */
// Styles - Design System - Production Grade
import './styles/design-tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/library.css';
import './styles/shell.css';
import './styles/identity.css';
import './styles/theme-engine.css';
import './styles/mobile.css';
import './styles/assistant.css';
import './styles/live.css';
// Themes - All 8 themes + custom builder support
import './styles/themes/midnight-neon.css';
import './styles/themes/neon-lime.css';
import './styles/themes/cinema-noir.css';
import './styles/themes/aurora.css';
import './styles/themes/amoled.css';
import './styles/themes/crimson-cinema.css';
import './styles/themes/golden-cinema.css';
import './styles/themes/arctic.css';
import './styles/themes/minimal-light.css';
// Core App
import { App } from './App.js';
import bridge from './js/bridge.js';
import { themeManager } from './js/services/theme/ThemeManager.js';
console.log(`
 zPopcorn Ultimate v2.0.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Production-Grade Media Intelligence Platform
Architecture: Electron + Vite + Vanilla JS ES2024
Region: SA (Saudi Arabia) Default
Language: Arabic RTL Primary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
// Desktop: hydrate localStorage mirror from canonical settings first
const __bridgeReady = bridge.init();
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
    await __bridgeReady;
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
        <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; text-align: center; background: #0a0a0f; color: var(--color-white);">
          <div>
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="1.7" style="margin-bottom:14px"><path d="M12 3.5 2.6 20h18.8z"/><path d="M12 10v4m0 3h.01"/></svg>
            <h1 style="font-size: 1.5rem; margin-bottom: 8px;">فشل تحميل التطبيق</h1>
            <p style="color: rgba(255,255,255,0.7); margin-bottom: 24px; max-width: 400px;">${error.message || 'حدث خطأ غير متوقع'}</p>
            <button onclick="window.location.reload()" style="background: #8b5cf6; color: var(--color-white); border: none; padding: 12px 24px; border-radius: var(--r-md); cursor: pointer; font-weight: 500;">إعادة المحاولة</button>
            <div style="margin-top: 24px; font-size: 12px; color: rgba(255,255,255,0.5);">
              <p>تحقق من وحدة التحكم للمزيد من التفاصيل</p>
              <p style="margin-top: 8px; font-family: monospace; background: rgba(255,255,255,0.1); padding: 8px; border-radius: var(--r-xs); text-align: left; direction: ltr;">${error.stack || error.message}</p>
            </div>
          </div>
        </div>
      `;
    }
  }
}
// After hydration, reapply canonical theme (desktop may have changed it since last load)
__bridgeReady.then(() => {
  try {
    const t = JSON.parse(localStorage.getItem('zpopcorn-theme') || 'null');
    if (t) document.documentElement.setAttribute('data-theme', typeof t === 'string' ? t : t.id || 'midnight-neon');
  } catch { /* keep initial */ }
});
// Theme engine v2 — load config, custom fonts, and paint before first render
import { themeEngine } from './js/theme/ThemeEngine.js';
themeEngine.init().catch(() => { /* defaults remain */ });

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

// Icon FX — hydrate the animated register (lord-icon engine, offline-safe fallbacks)
import('./js/ui/IconFX.js').then((m) => { m.watchIconFX(); m.hydrateIconFX(document); }).catch(() => {});

// Live Dock — companion for the external player; idle-mounted, hidden without a session
{
  const mount = () => import('./js/ui/live/LiveDock.js').then((m) => m.mountLiveDock()).catch(() => {});
  if (window.requestIdleCallback) window.requestIdleCallback(mount, { timeout: 4000 });
  else setTimeout(mount, 1800);
}
