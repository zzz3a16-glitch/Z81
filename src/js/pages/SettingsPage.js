/**
 * SettingsPage - Comprehensive settings with all categories
 */

import { themeManager, THEMES } from '../services/theme/ThemeManager.js';
import { icon } from '../ui/icons.js';
import { tmdbClient } from '../services/tmdb/TMDBClient.js';
import { backupManager } from '../services/backup/BackupManager.js';
import { notificationService } from '../services/notification/NotificationService.js';
import { db } from '../services/storage/Database.js';

export async function SettingsPage(params) {
 const section = params.section || 'general';
  
 const container = document.createElement('div');
 container.className = 'settings-page';
 container.innerHTML = `
    <div class="container" style="padding-top: var(--sp-6); padding-bottom: var(--sp-10);">
      <h1 style="font-size: 2rem; font-weight: 700; margin-bottom: var(--sp-6);">الإعدادات</h1>
      
      <div style="display: grid; grid-template-columns: 240px 1fr; gap: var(--sp-6); align-items: start;">
        <div style="background: var(--color-card); border: 1px solid var(--color-border); border-radius: var(--r-lg); padding: var(--sp-3); position: sticky; top: 80px;">
          <div style="display: flex; flex-direction: column; gap: var(--sp-1);">
            <a href="/settings" data-router class="settings-nav-item ${section === 'general' ? 'active' : ''}" data-section="general" style="padding: var(--sp-3) var(--sp-3); border-radius: var(--r-md); text-decoration: none; color: var(--color-text-primary); display: flex; align-items: center; gap: var(--sp-2); ${section === 'general' ? 'background: var(--color-accent); color: var(--accent-contrast);' : ''}">
              <span></span> عام
            </a>
            <a href="/settings/themes" data-router class="settings-nav-item ${section === 'themes' ? 'active' : ''}" data-section="themes" style="padding: var(--sp-3) var(--sp-3); border-radius: var(--r-md); text-decoration: none; color: var(--color-text-primary); display: flex; align-items: center; gap: var(--sp-2); ${section === 'themes' ? 'background: var(--color-accent); color: var(--accent-contrast);' : ''}">
              <span></span> المظهر
            </a>
            <a href="/settings/tmdb" data-router class="settings-nav-item ${section === 'tmdb' ? 'active' : ''}" data-section="tmdb" style="padding: var(--sp-3) var(--sp-3); border-radius: var(--r-md); text-decoration: none; color: var(--color-text-primary); display: flex; align-items: center; gap: var(--sp-2); ${section === 'tmdb' ? 'background: var(--color-accent); color: var(--accent-contrast);' : ''}">
              <span></span> TMDB
            </a>
            <a href="/settings/playback" data-router class="settings-nav-item ${section === 'playback' ? 'active' : ''}" data-section="playback" style="padding: var(--sp-3) var(--sp-3); border-radius: var(--r-md); text-decoration: none; color: var(--color-text-primary); display: flex; align-items: center; gap: var(--sp-2); ${section === 'playback' ? 'background: var(--color-accent); color: var(--accent-contrast);' : ''}">
              ${'<span>' + icon('play', 14) + '</span>'} التشغيل
            </a>
            <a href="/settings/notifications" data-router class="settings-nav-item ${section === 'notifications' ? 'active' : ''}" data-section="notifications" style="padding: var(--sp-3) var(--sp-3); border-radius: var(--r-md); text-decoration: none; color: var(--color-text-primary); display: flex; align-items: center; gap: var(--sp-2); ${section === 'notifications' ? 'background: var(--color-accent); color: var(--accent-contrast);' : ''}">
              <span></span> الإشعارات
            </a>
            <a href="/settings/backup" data-router class="settings-nav-item ${section === 'backup' ? 'active' : ''}" data-section="backup" style="padding: var(--sp-3) var(--sp-3); border-radius: var(--r-md); text-decoration: none; color: var(--color-text-primary); display: flex; align-items: center; gap: var(--sp-2); ${section === 'backup' ? 'background: var(--color-accent); color: var(--accent-contrast);' : ''}">
              <span></span> النسخ الاحتياطي
            </a>
            <a href="/settings/about" data-router class="settings-nav-item ${section === 'about' ? 'active' : ''}" data-section="about" style="padding: var(--sp-3) var(--sp-3); border-radius: var(--r-md); text-decoration: none; color: var(--color-text-primary); display: flex; align-items: center; gap: var(--sp-2); ${section === 'about' ? 'background: var(--color-accent); color: var(--accent-contrast);' : ''}">
              <span></span> حول
            </a>
          </div>
        </div>
        
        <div id="settings-content" style="background: var(--color-card); border: 1px solid var(--color-border); border-radius: var(--r-lg); padding: var(--sp-6);">
          <!-- Content will be loaded here -->
        </div>
      </div>
    </div>
 `;

 const content = container.querySelector('#settings-content');
  
 // Load section content
 switch (section) {
 case 'themes':
 content.appendChild(await createThemesSection());
 break;
 case 'tmdb':
 content.appendChild(await createTMDBSection());
 break;
 case 'playback':
 content.appendChild(createPlaybackSection());
 break;
 case 'notifications':
 content.appendChild(createNotificationsSection());
 break;
 case 'backup':
 content.appendChild(await createBackupSection());
 break;
 case 'about':
 content.appendChild(createAboutSection());
 break;
 default:
 content.appendChild(createGeneralSection());
 }

 return container;
}

function createGeneralSection() {
 const div = document.createElement('div');
 const region = localStorage.getItem('zpopcorn-region') || 'SA';
 const language = localStorage.getItem('zpopcorn-language') || 'ar-SA';
  
 div.innerHTML = `
    <h2 style="font-size: 1.5rem; font-weight: 600; margin-bottom: var(--sp-5);">الإعدادات العامة</h2>
    
    <div style="display: flex; flex-direction: column; gap: var(--sp-5);">
      <div>
        <label style="display: block; font-weight: 500; margin-bottom: var(--sp-2);">المنطقة</label>
        <select id="region-select" class="input" style="max-width: 300px;">
          <option value="SA" ${region === 'SA' ? 'selected' : ''}>السعودية (SA)</option>
          <option value="EG" ${region === 'EG' ? 'selected' : ''}>مصر (EG)</option>
          <option value="AE" ${region === 'AE' ? 'selected' : ''}>الإمارات (AE)</option>
          <option value="US" ${region === 'US' ? 'selected' : ''}>الولايات المتحدة (US)</option>
          <option value="GB" ${region === 'GB' ? 'selected' : ''}>المملكة المتحدة (GB)</option>
        </select>
        <div style="font-size: var(--text-sm); color: var(--color-text-muted); margin-top: var(--sp-2);">تستخدم لعرض مزودي المشاهدة المتاحين في منطقتك</div>
      </div>
      
      <div>
        <label style="display: block; font-weight: 500; margin-bottom: var(--sp-2);">اللغة</label>
        <select id="language-select" class="input" style="max-width: 300px;">
          <option value="ar-SA" ${language === 'ar-SA' ? 'selected' : ''}>العربية (السعودية)</option>
          <option value="ar" ${language === 'ar' ? 'selected' : ''}>العربية</option>
          <option value="en-US" ${language === 'en-US' ? 'selected' : ''}>English (US)</option>
          <option value="en" ${language === 'en' ? 'selected' : ''}>English</option>
        </select>
      </div>
      
      <div style="height: 1px; background: var(--color-border); margin: var(--sp-2) 0;"></div>
      
      <div>
        <h3 style="font-weight: 600; margin-bottom: var(--sp-3);">البيانات</h3>
        <div style="display: flex; gap: var(--sp-3); flex-wrap: wrap;">
          <button id="clear-cache" class="btn btn-secondary">مسح التخزين المؤقت</button>
          <button id="clear-data" class="btn btn-danger">مسح جميع البيانات</button>
        </div>
      </div>
    </div>
 `;

 div.querySelector('#region-select').addEventListener('change', (e) => {
 localStorage.setItem('zpopcorn-region', e.target.value);
 window.dispatchEvent(new CustomEvent('showtoast', {
 detail: { type: 'success', title: 'تم الحفظ', message: `تم تغيير المنطقة إلى ${e.target.value}` }
 }));
 });

 div.querySelector('#language-select').addEventListener('change', (e) => {
 localStorage.setItem('zpopcorn-language', e.target.value);
 window.dispatchEvent(new CustomEvent('showtoast', {
 detail: { type: 'success', title: 'تم الحفظ', message: `تم تغيير اللغة إلى ${e.target.value}` }
 }));
 });

 div.querySelector('#clear-cache').addEventListener('click', async () => {
 try {
 tmdbClient.clearCache();
 window.dispatchEvent(new CustomEvent('showtoast', {
 detail: { type: 'success', title: 'تم المسح', message: 'تم مسح التخزين المؤقت' }
 }));
 } catch (e) {
 console.warn(e);
 }
 });

 div.querySelector('#clear-data').addEventListener('click', async () => {
 if (confirm('هل أنت متأكد من مسح جميع البيانات؟ لا يمكن التراجع عن هذا الإجراء.')) {
 try {
 localStorage.clear();
 await db.exportAll().then(() => {}).catch(() => {});
 // Clear all stores
 for (const store of ['movies', 'tvshows', 'watchHistory', 'watchProgress', 'favorites', 'watchlists', 'ratings', 'behaviorEvents', 'notifications']) {
 try { await db.clear(store); } catch {}
 }
 window.dispatchEvent(new CustomEvent('showtoast', {
 detail: { type: 'success', title: 'تم المسح', message: 'تم مسح جميع البيانات' }
 }));
 setTimeout(() => window.location.reload(), 1000);
 } catch (e) {
 console.warn(e);
 }
 }
 });

 return div;
}

async function createThemesSection() {
 const div = document.createElement('div');
 const currentTheme = themeManager.getTheme();
 const allThemes = themeManager.getThemeList();
  
 div.innerHTML = `
    <h2 style="font-size: 1.5rem; font-weight: 600; margin-bottom: var(--sp-5);">المظاهر</h2>
    <p style="color: var(--color-text-secondary); margin-bottom: var(--sp-6);">اختر مظهراً يناسب ذوقك. كل مظهر يحول التطبيق بالكامل وليس الألوان فقط.</p>
    
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: var(--sp-4); margin-bottom: var(--sp-8);" id="themes-grid">
 ${allThemes.map(theme => `
        <div class="theme-card ${currentTheme === theme.id ? 'active' : ''}" data-theme="${theme.id}" style="border: 2px solid ${currentTheme === theme.id ? 'var(--color-accent)' : 'var(--color-border)'}; border-radius: var(--r-lg); overflow: hidden; cursor: pointer; transition: all 0.2s; background: var(--color-surface);">
          <div style="height: 120px; background: ${theme.preview.bg}; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; inset: 0; background: linear-gradient(135deg, ${theme.preview.accent}40, ${theme.preview.accent2}40);"></div>
            <div style="position: relative; display: flex; gap: var(--sp-2);">
              <div style="width: 40px; height: 40px; background: ${theme.preview.accent}; border-radius: var(--r-md); box-shadow: 0 4px 12px ${theme.preview.accent}60;"></div>
              <div style="width: 40px; height: 40px; background: ${theme.preview.accent2}; border-radius: var(--r-md); box-shadow: 0 4px 12px ${theme.preview.accent2}60;"></div>
            </div>
 ${currentTheme === theme.id ? '<div style="position: absolute; top: 8px; right: 8px; background: var(--color-accent); color: var(--accent-contrast); padding: var(--sp-1) var(--sp-2); border-radius: var(--r-lg); font-size: var(--text-3xs); font-weight: 600;">نشط</div>' : ''}
          </div>
          <div style="padding: var(--sp-4);">
            <h3 style="font-weight: 600; margin-bottom: var(--sp-1);">${theme.name}</h3>
            <p style="font-size: var(--text-sm); color: var(--color-text-secondary); margin-bottom: var(--sp-2);">${theme.description}</p>
            <div style="display: flex; gap: var(--sp-2); align-items: center;">
              <span style="font-size: var(--text-3xs); padding: 2px var(--sp-2); background: ${theme.isDark ? '#1a1a1a' : '#f0f0f0'}; color: ${theme.isDark ? 'var(--color-white)' : 'var(--color-text-primary)'}; border-radius: var(--r-xs);">${theme.isDark ? 'داكن' : 'فاتح'}</span>
              <span style="font-size: var(--text-3xs); color: var(--color-text-muted);">${theme.category}</span>
            </div>
          </div>
        </div>
 `).join('')}
    </div>
    
    <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--r-lg); padding: var(--sp-5);">
      <h3 style="font-weight: 600; margin-bottom: var(--sp-4);">منشئ المظاهر المخصص</h3>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--sp-4); margin-bottom: var(--sp-4);">
        <div>
          <label style="display: block; font-size: var(--text-sm); margin-bottom: var(--sp-2);">اللون الأساسي</label>
          <input type="color" id="custom-primary" value="#8b5cf6" class="input" style="height: 44px; padding: var(--sp-1);">
        </div>
        <div>
          <label style="display: block; font-size: var(--text-sm); margin-bottom: var(--sp-2);">اللون الثانوي</label>
          <input type="color" id="custom-secondary" value="#06b6d4" class="input" style="height: 44px; padding: var(--sp-1);">
        </div>
        <div>
          <label style="display: block; font-size: var(--text-sm); margin-bottom: var(--sp-2);">الخلفية</label>
          <input type="color" id="custom-bg" value="#0a0a0f" class="input" style="height: 44px; padding: var(--sp-1);">
        </div>
      </div>
      <div style="display: flex; gap: var(--sp-2);">
        <button id="preview-custom" class="btn btn-secondary">معاينة</button>
        <button id="save-custom" class="btn btn-primary">حفظ كمظهر مخصص</button>
        <button id="export-theme" class="btn btn-ghost">تصدير المظهر الحالي</button>
      </div>
    </div>
 `;

 div.querySelectorAll('.theme-card').forEach(card => {
 card.addEventListener('click', () => {
 const themeId = card.dataset.theme;
 themeManager.setTheme(themeId);
      
 div.querySelectorAll('.theme-card').forEach(c => {
 c.classList.remove('active');
 c.style.borderColor = 'var(--color-border)';
 const badge = c.querySelector('[style*="نشط"]');
 if (badge) badge.remove();
 });
      
 card.classList.add('active');
 card.style.borderColor = 'var(--color-accent)';
      
 const badge = document.createElement('div');
 badge.style.cssText = 'position: absolute; top: 8px; right: 8px; background: var(--color-accent); color: var(--accent-contrast); padding: var(--sp-1) var(--sp-2); border-radius: var(--r-lg); font-size: var(--text-3xs); font-weight: 600;';
 badge.textContent = 'نشط';
 card.querySelector('[style*="height: 120px"]').appendChild(badge);
      
 window.dispatchEvent(new CustomEvent('showtoast', {
 detail: { type: 'success', title: 'تم تغيير المظهر', message: `تم تطبيق مظهر ${themeManager.getThemeConfig(themeId).name}` }
 }));
 });
 });

 div.querySelector('#preview-custom')?.addEventListener('click', () => {
 const primary = div.querySelector('#custom-primary').value;
 const secondary = div.querySelector('#custom-secondary').value;
 const bg = div.querySelector('#custom-bg').value;
    
 document.documentElement.style.setProperty('--color-accent', primary);
 document.documentElement.style.setProperty('--color-accent-secondary', secondary);
 document.documentElement.style.setProperty('--color-background', bg);
 });

 div.querySelector('#save-custom')?.addEventListener('click', () => {
 const primary = div.querySelector('#custom-primary').value;
 const secondary = div.querySelector('#custom-secondary').value;
 const bg = div.querySelector('#custom-bg').value;
 const name = prompt('اسم المظهر المخصص:');
    
 if (name) {
 themeManager.createCustomTheme(name, {
 isDark: true,
 colors: {
 background: bg,
 surface: '#121212',
 card: 'rgba(255,255,255,0.05)',
 border: 'rgba(255,255,255,0.1)',
 accent: primary,
 accentSecondary: secondary,
 textPrimary: '#ffffff',
 textSecondary: 'rgba(255,255,255,0.7)',
 textMuted: 'rgba(255,255,255,0.5)'
 }
 });
      
 window.dispatchEvent(new CustomEvent('showtoast', {
 detail: { type: 'success', title: 'تم الحفظ', message: `تم حفظ المظهر ${name}` }
 }));
      
 setTimeout(() => window.location.reload(), 500);
 }
 });

 div.querySelector('#export-theme')?.addEventListener('click', () => {
 const current = themeManager.getTheme();
 const exported = themeManager.exportTheme(current);
    
 if (exported) {
 const blob = new Blob([exported], { type: 'application/json' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = `zpopcorn-theme-${current}.json`;
 a.click();
 URL.revokeObjectURL(url);
 }
 });

 return div;
}

async function createTMDBSection() {
 const div = document.createElement('div');
 const apiKey = localStorage.getItem('zpopcorn-tmdb-api-key') || '';
 const stats = tmdbClient.getStats();
  
 div.innerHTML = `
    <h2 style="font-size: 1.5rem; font-weight: 600; margin-bottom: var(--sp-5);">إعدادات TMDB</h2>
    
    <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--r-lg); padding: var(--sp-5); margin-bottom: var(--sp-5);">
      <h3 style="font-weight: 600; margin-bottom: var(--sp-3); display: flex; align-items: center; gap: var(--sp-2);">
        <span style="width: 10px; height: 10px; background: var(--color-success); border-radius: 50%; display: inline-block;"></span>
 حالة الاتصال
      </h3>
      <div style="display: grid; gap: var(--sp-2); font-size: var(--text-sm);">
        <div style="display: flex; justify-content: space-between;"><span>المنطقة:</span><span style="font-weight: 500;">${localStorage.getItem('zpopcorn-region') || 'SA'}</span></div>
        <div style="display: flex; justify-content: space-between;"><span>اللغة:</span><span style="font-weight: 500;">${localStorage.getItem('zpopcorn-language') || 'ar-SA'}</span></div>
        <div style="display: flex; justify-content: space-between;"><span>الطلبات:</span><span class="number-ltr">${stats.requests}</span></div>
        <div style="display: flex; justify-content: space-between;"><span>إصابات التخزين المؤقت:</span><span class="number-ltr">${stats.cacheHits}</span></div>
      </div>
      <button id="test-connection" class="btn btn-secondary" style="margin-top: var(--sp-4);">اختبار الاتصال</button>
      <div id="connection-result" style="margin-top: var(--sp-3); font-size: var(--text-sm);"></div>
    </div>
    
    <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--r-lg); padding: var(--sp-5); margin-bottom: var(--sp-5);">
      <h3 style="font-weight: 600; margin-bottom: var(--sp-3);">مفتاح TMDB API</h3>
      <p style="font-size: var(--text-sm); color: var(--color-text-secondary); margin-bottom: var(--sp-3);">احصل على مفتاح مجاني من <a href="https://www.themoviedb.org/settings/api" target="_blank" style="color: var(--color-accent);">themoviedb.org</a></p>
      <div style="display: flex; gap: var(--sp-2);">
        <input type="password" id="api-key-input" class="input" placeholder="أدخل مفتاح TMDB API" value="${apiKey}" style="flex: 1;" />
        <button id="save-api-key" class="btn btn-primary">حفظ</button>
        <button id="toggle-api-key" class="btn btn-ghost"></button>
      </div>
      <div style="font-size: var(--text-2xs); color: var(--color-text-muted); margin-top: var(--sp-2);">المفتاح الحالي: ${apiKey ? apiKey.slice(0, 8) + '...' : 'غير محدد (يستخدم مفتاح تجريبي)'}</div>
    </div>
    
    <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--r-lg); padding: var(--sp-5);">
      <h3 style="font-weight: 600; margin-bottom: var(--sp-3);">التخزين المؤقت</h3>
      <div style="display: grid; gap: var(--sp-2); font-size: var(--text-sm); margin-bottom: var(--sp-4);">
        <div style="display: flex; justify-content: space-between;"><span>البيانات الوصفية:</span><span>${stats.cache.metadata.size} عنصر</span></div>
        <div style="display: flex; justify-content: space-between;"><span>البحث:</span><span>${stats.cache.search.size} عنصر</span></div>
        <div style="display: flex; justify-content: space-between;"><span>عام:</span><span>${stats.cache.general.size} عنصر</span></div>
      </div>
      <button id="clear-tmdb-cache" class="btn btn-secondary">مسح تخزين TMDB المؤقت</button>
    </div>
 `;

 div.querySelector('#test-connection').addEventListener('click', async () => {
 const resultDiv = div.querySelector('#connection-result');
 resultDiv.innerHTML = 'جاري الاختبار...';
    
 try {
 const config = await tmdbClient.getConfiguration();
 if (config) {
 resultDiv.innerHTML = '<span style="color: var(--color-success);">TMDB متصل بنجاح</span>';
 } else {
 resultDiv.innerHTML = '<span style="color: var(--color-danger);">فشل الاتصال</span>';
 }
 } catch (e) {
 resultDiv.innerHTML = `<span style="color: #ef4444;">فشل: ${e.message}</span>`;
 }
 });

 div.querySelector('#save-api-key').addEventListener('click', () => {
 const key = div.querySelector('#api-key-input').value.trim();
 if (key) {
 localStorage.setItem('zpopcorn-tmdb-api-key', key);
 tmdbClient.updateApiKey(key);
 window.dispatchEvent(new CustomEvent('showtoast', {
 detail: { type: 'success', title: 'تم الحفظ', message: 'تم حفظ مفتاح TMDB' }
 }));
 setTimeout(() => window.location.reload(), 500);
 }
 });

 div.querySelector('#toggle-api-key').addEventListener('click', () => {
 const input = div.querySelector('#api-key-input');
 input.type = input.type === 'password' ? 'text' : 'password';
 });

 div.querySelector('#clear-tmdb-cache').addEventListener('click', () => {
 tmdbClient.clearCache();
 window.dispatchEvent(new CustomEvent('showtoast', {
 detail: { type: 'success', title: 'تم المسح', message: 'تم مسح تخزين TMDB' }
 }));
 });

 return div;
}

function createPlaybackSection() {
 const div = document.createElement('div');
  
 div.innerHTML = `
    <h2 style="font-size: 1.5rem; font-weight: 600; margin-bottom: var(--sp-5);">إعدادات التشغيل</h2>
    
    <div style="display: flex; flex-direction: column; gap: var(--sp-5);">
      <div style="display: flex; justify-content: space-between; align-items: center; padding: var(--sp-4); background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--r-md);">
        <div>
          <div style="font-weight: 500;">التشغيل التلقائي للحلقة التالية</div>
          <div style="font-size: var(--text-sm); color: var(--color-text-secondary);">تشغيل الحلقة التالية تلقائياً</div>
        </div>
        <label style="position: relative; display: inline-block; width: 44px; height: 24px;">
          <input type="checkbox" id="auto-next" ${localStorage.getItem('zpopcorn-auto-next') === 'true' ? 'checked' : ''} style="opacity: 0; width: 0; height: 0;">
          <span style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background: var(--color-border); border-radius: var(--r-2xl); transition: 0.2s;"></span>
        </label>
      </div>
      
      <div>
        <label style="display: block; font-weight: 500; margin-bottom: var(--sp-2);">مستوى الصوت الافتراضي</label>
        <input type="range" id="default-volume" min="0" max="100" value="${localStorage.getItem('zpopcorn-default-volume') || 80}" style="width: 100%; max-width: 300px;" />
        <span id="volume-value" style="margin-right: var(--sp-3);">${localStorage.getItem('zpopcorn-default-volume') || 80}%</span>
      </div>
      
      <div>
        <label style="display: block; font-weight: 500; margin-bottom: var(--sp-2);">عتبة متابعة المشاهدة (%)</label>
        <input type="range" id="continue-threshold" min="1" max="20" value="${localStorage.getItem('zpopcorn-continue-threshold') || 5}" style="width: 100%; max-width: 300px;" />
        <span id="threshold-value" style="margin-right: var(--sp-3);">${localStorage.getItem('zpopcorn-continue-threshold') || 5}%</span>
        <div style="font-size: var(--text-2xs); color: var(--color-text-muted); margin-top: var(--sp-1);">إذا شاهدت أقل من هذه النسبة، سيبدأ من البداية</div>
      </div>
    </div>
 `;

 div.querySelector('#auto-next').addEventListener('change', (e) => {
 localStorage.setItem('zpopcorn-auto-next', e.target.checked);
 });

 div.querySelector('#default-volume').addEventListener('input', (e) => {
 div.querySelector('#volume-value').textContent = e.target.value + '%';
 localStorage.setItem('zpopcorn-default-volume', e.target.value);
 });

 div.querySelector('#continue-threshold').addEventListener('input', (e) => {
 div.querySelector('#threshold-value').textContent = e.target.value + '%';
 localStorage.setItem('zpopcorn-continue-threshold', e.target.value);
 });

 return div;
}

function createNotificationsSection() {
 const div = document.createElement('div');
 const prefs = notificationService.getPreferences();
  
 div.innerHTML = `
    <h2 style="font-size: 1.5rem; font-weight: 600; margin-bottom: var(--sp-5);">إعدادات الإشعارات</h2>
    
    <div style="display: flex; flex-direction: column; gap: var(--sp-3);">
 ${Object.entries(prefs).map(([type, enabled]) => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: var(--sp-3) var(--sp-4); background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--r-md);">
          <div>
            <div style="font-weight: 500;">${getNotificationTypeName(type)}</div>
            <div style="font-size: var(--text-2xs); color: var(--color-text-secondary);">${getNotificationTypeDesc(type)}</div>
          </div>
          <label class="z-switch"><input type="checkbox" data-type="${type}" ${enabled ? 'checked' : ''}><span class="track"></span></label>
        </div>
 `).join('')}
    </div>
 `;

 div.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
 checkbox.addEventListener('change', (e) => {
 const type = e.target.dataset.type;
 notificationService.setPreference(type, e.target.checked);
 e.target.nextElementSibling.style.background = e.target.checked ? 'var(--color-accent)' : 'var(--color-border)';
 });
 });

 return div;
}

function getNotificationTypeName(type) {
 const names = {
 NEW_EPISODE: 'حلقات جديدة',
 NEW_LIBRARY_CONTENT: 'محتوى جديد في المكتبة',
 RECOMMENDATION: 'توصيات',
 RESUME_REMINDER: 'تذكير المتابعة',
 SCAN_COMPLETED: 'اكتمال الفحص',
 NEW_EPISODES_FOUND: 'حلقات جديدة مكتشفة',
 FILE_MISSING: 'ملفات مفقودة',
 TMDB_UPDATED: 'تحديثات TMDB',
 WATCHLIST_AVAILABLE: 'توفر قائمة المشاهدة',
 ACHIEVEMENT: 'الإنجازات',
 BACKUP_COMPLETED: 'اكتمال النسخ الاحتياطي',
 BACKUP_FAILED: 'فشل النسخ الاحتياطي'
 };
 return names[type] || type;
}

function getNotificationTypeDesc(type) {
 const descs = {
 NEW_EPISODE: 'عند توفر حلقات جديدة لمسلسلات تتابعها',
 NEW_LIBRARY_CONTENT: 'عند إضافة محتوى جديد لمكتبتك',
 RECOMMENDATION: 'توصيات جديدة بناءً على ذوقك',
 RESUME_REMINDER: 'تذكير لمتابعة ما بدأته',
 SCAN_COMPLETED: 'عند اكتمال فحص المكتبة',
 NEW_EPISODES_FOUND: 'عند اكتشاف حلقات جديدة',
 FILE_MISSING: 'عند فقدان ملفات',
 TMDB_UPDATED: 'عند تحديث بيانات TMDB',
 WATCHLIST_AVAILABLE: 'عند توفر محتوى من قائمة المشاهدة',
 ACHIEVEMENT: 'عند فتح إنجازات جديدة',
 BACKUP_COMPLETED: 'عند اكتمال النسخ الاحتياطي',
 BACKUP_FAILED: 'عند فشل النسخ الاحتياطي'
 };
 return descs[type] || '';
}

async function createBackupSection() {
 const div = document.createElement('div');
 const stats = await db.getStats().catch(() => ({}));
  
 div.innerHTML = `
    <h2 style="font-size: 1.5rem; font-weight: 600; margin-bottom: var(--sp-5);">النسخ الاحتياطي والاستعادة</h2>
    
    <div style="display: grid; gap: var(--sp-5);">
      <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--r-lg); padding: var(--sp-5);">
        <h3 style="font-weight: 600; margin-bottom: var(--sp-3);">إنشاء نسخ احتياطي</h3>
        <p style="font-size: var(--text-sm); color: var(--color-text-secondary); margin-bottom: var(--sp-4);">احفظ جميع بياناتك في ملف JSON</p>
        <div style="display: flex; gap: var(--sp-2); flex-wrap: wrap;">
          <button id="backup-full" class="btn btn-primary">نسخ احتياطي كامل</button>
          <button id="backup-settings" class="btn btn-secondary">الإعدادات فقط</button>
          <button id="backup-watchlists" class="btn btn-secondary">قوائم المشاهدة</button>
          <button id="backup-history" class="btn btn-secondary">سجل المشاهدة</button>
        </div>
      </div>
      
      <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--r-lg); padding: var(--sp-5);">
        <h3 style="font-weight: 600; margin-bottom: var(--sp-3);">استعادة نسخ احتياطي</h3>
        <p style="font-size: var(--text-sm); color: var(--color-text-secondary); margin-bottom: var(--sp-4);">استعد بياناتك من ملف نسخ احتياطي. سيتم إنشاء نسخة آمنة قبل الاستعادة.</p>
        <input type="file" id="restore-file" accept=".json" style="margin-bottom: var(--sp-3);" />
        <div id="restore-info" style="font-size: var(--text-sm); margin-bottom: var(--sp-3);"></div>
        <button id="restore-btn" class="btn btn-primary" disabled>استعادة</button>
      </div>
      
      <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--r-lg); padding: var(--sp-5);">
        <h3 style="font-weight: 600; margin-bottom: var(--sp-3);">إحصائيات البيانات</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: var(--sp-3); font-size: var(--text-sm);">
 ${Object.entries(stats).map(([store, count]) => `
            <div style="display: flex; justify-content: space-between; padding: var(--sp-2); background: var(--color-card); border-radius: var(--r-sm);">
              <span>${store}</span>
              <span style="font-weight: 600;">${count}</span>
            </div>
 `).join('')}
        </div>
      </div>
    </div>
 `;

 div.querySelector('#backup-full').addEventListener('click', () => backupManager.exportBackup('full'));
 div.querySelector('#backup-settings').addEventListener('click', () => backupManager.exportBackup('settings'));
 div.querySelector('#backup-watchlists').addEventListener('click', () => backupManager.exportBackup('watchlists'));
 div.querySelector('#backup-history').addEventListener('click', () => backupManager.exportBackup('watchHistory'));

 let pendingBackup = null;
  
 div.querySelector('#restore-file').addEventListener('change', async (e) => {
 const file = e.target.files[0];
 if (!file) return;

 try {
 const data = await backupManager.importBackupFile(file);
 const info = await backupManager.getBackupInfo(data);
      
 pendingBackup = data;
      
 div.querySelector('#restore-info').innerHTML = `
        <div style="background: var(--color-card); padding: var(--sp-3); border-radius: var(--r-md); border: 1px solid var(--color-border);">
          <div style="font-weight: 500; margin-bottom: var(--sp-2);">معلومات النسخ الاحتياطي:</div>
          <div style="display: grid; gap: var(--sp-1); font-size: var(--text-2xs);">
            <div>الإصدار: ${info.schemaVersion}</div>
            <div>التاريخ: ${new Date(info.createdAt).toLocaleString('ar-SA')}</div>
            <div>النوع: ${info.type}</div>
            <div>الحجم: ${(info.size / 1024).toFixed(1)} KB</div>
            <div>المتاجر: ${Object.keys(info.stores).join('، ')}</div>
          </div>
        </div>
 `;
      
 div.querySelector('#restore-btn').disabled = false;
 } catch (error) {
 div.querySelector('#restore-info').innerHTML = `<div style="color: var(--color-danger);">خطأ: ${error.message}</div>`;
 div.querySelector('#restore-btn').disabled = true;
 }
 });

 div.querySelector('#restore-btn').addEventListener('click', async () => {
 if (!pendingBackup) return;
    
 if (confirm('هل أنت متأكد من الاستعادة؟ سيتم استبدال البيانات الحالية.')) {
 try {
 await backupManager.restoreBackup(pendingBackup);
 } catch (error) {
 window.dispatchEvent(new CustomEvent('showtoast', {
 detail: { type: 'error', title: 'فشل الاستعادة', message: error.message }
 }));
 }
 }
 });

 return div;
}

function createAboutSection() {
 const div = document.createElement('div');
  
 div.innerHTML = `
    <h2 style="font-size: 1.5rem; font-weight: 600; margin-bottom: var(--sp-5);">حول zPopcorn</h2>
    
    <div style="text-align: center; padding: var(--sp-8) 0; border-bottom: 1px solid var(--color-border); margin-bottom: var(--sp-6);">
      <div style="font-size: 64px; margin-bottom: var(--sp-4);"></div>
      <h2 style="font-size: 2rem; font-weight: 700; margin-bottom: var(--sp-2); background: linear-gradient(135deg, var(--color-accent), var(--color-accent-secondary)); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">zPopcorn Ultimate</h2>
      <p style="color: var(--color-text-secondary); margin-bottom: var(--sp-2);">منصة الوسائط الذكية المتكاملة</p>
      <p style="font-size: var(--text-sm); color: var(--color-text-muted);">الإصدار 2.0.0 - Production-Grade</p>
    </div>
    
    <div style="display: grid; gap: var(--sp-5);">
      <div>
        <h3 style="font-weight: 600; margin-bottom: var(--sp-3);">المميزات</h3>
        <ul style="list-style: none; display: grid; gap: var(--sp-2); font-size: var(--text-sm); color: var(--color-text-secondary);">
          <li style="display: flex; align-items: center; gap: var(--sp-2);"><span class="z-dot-ok" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--color-success)"></span> تكامل حقيقي مع TMDB API</li>
          <li style="display: flex; align-items: center; gap: var(--sp-2);"><span class="z-dot-ok" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--color-success)"></span> 8 مظاهر احترافية + منشئ مظاهر مخصص</li>
          <li style="display: flex; align-items: center; gap: var(--sp-2);"><span class="z-dot-ok" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--color-success)"></span> محرك ذكاء وتوصيات ذكية</li>
          <li style="display: flex; align-items: center; gap: var(--sp-2);"><span class="z-dot-ok" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--color-success)"></span> تتبع السلوك وملف الذوق</li>
          <li style="display: flex; align-items: center; gap: var(--sp-2);"><span class="z-dot-ok" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--color-success)"></span> مشغل احترافي مع mpv</li>
          <li style="display: flex; align-items: center; gap: var(--sp-2);"><span class="z-dot-ok" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--color-success)"></span> قوائم مشاهدة متقدمة</li>
          <li style="display: flex; align-items: center; gap: var(--sp-2);"><span class="z-dot-ok" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--color-success)"></span> بحث ذكي ومساعد وسائط</li>
          <li style="display: flex; align-items: center; gap: var(--sp-2);"><span class="z-dot-ok" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--color-success)"></span> إحصائيات وتحليلات متقدمة</li>
          <li style="display: flex; align-items: center; gap: var(--sp-2);"><span class="z-dot-ok" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--color-success)"></span> نسخ احتياطي واستعادة آمنة</li>
          <li style="display: flex; align-items: center; gap: var(--sp-2);"><span class="z-dot-ok" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--color-success)"></span> دعم كامل للعربية RTL</li>
        </ul>
      </div>
      
      <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--r-lg); padding: var(--sp-5);">
        <h3 style="font-weight: 600; margin-bottom: var(--sp-3);">التقنيات</h3>
        <div style="display: flex; flex-wrap: wrap; gap: var(--sp-2);">
          <span style="padding: var(--sp-1) var(--sp-2); background: var(--color-card); border: 1px solid var(--color-border); border-radius: var(--r-xl); font-size: var(--text-2xs);">Electron.js</span>
          <span style="padding: var(--sp-1) var(--sp-2); background: var(--color-card); border: 1px solid var(--color-border); border-radius: var(--r-xl); font-size: var(--text-2xs);">Node.js</span>
          <span style="padding: var(--sp-1) var(--sp-2); background: var(--color-card); border: 1px solid var(--color-border); border-radius: var(--r-xl); font-size: var(--text-2xs);">Vite</span>
          <span style="padding: var(--sp-1) var(--sp-2); background: var(--color-card); border: 1px solid var(--color-border); border-radius: var(--r-xl); font-size: var(--text-2xs);">Vanilla JS ES2024</span>
          <span style="padding: var(--sp-1) var(--sp-2); background: var(--color-card); border: 1px solid var(--color-border); border-radius: var(--r-xl); font-size: var(--text-2xs);">SQLite</span>
          <span style="padding: var(--sp-1) var(--sp-2); background: var(--color-card); border: 1px solid var(--color-border); border-radius: var(--r-xl); font-size: var(--text-2xs);">IndexedDB</span>
          <span style="padding: var(--sp-1) var(--sp-2); background: var(--color-card); border: 1px solid var(--color-border); border-radius: var(--r-xl); font-size: var(--text-2xs);">TMDB API</span>
          <span style="padding: var(--sp-1) var(--sp-2); background: var(--color-card); border: 1px solid var(--color-border); border-radius: var(--r-xl); font-size: var(--text-2xs);">mpv Player</span>
          <span style="padding: var(--sp-1) var(--sp-2); background: var(--color-card); border: 1px solid var(--color-border); border-radius: var(--r-xl); font-size: var(--text-2xs);">Socket.IO</span>
        </div>
      </div>
      
      <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--r-lg); padding: var(--sp-5);">
        <h3 style="font-weight: 600; margin-bottom: var(--sp-2);">نسب TMDB</h3>
        <p style="font-size: var(--text-sm); color: var(--color-text-secondary); line-height: 1.6;">
 هذا المنتج يستخدم TMDB API لكنه غير معتمد أو مصدق من قبل TMDB.<br>
          <a href="https://www.themoviedb.org/" target="_blank" style="color: var(--color-accent);">The Movie Database (TMDB)</a>
        </p>
        <div style="margin-top: var(--sp-3);">
          <img src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_short-8e8b30f73a4020632fe363630cd67723f4ec8d71fcf6f3c8b8d0a9e1b3a0e0a.svg" alt="TMDB" style="height: 20px; opacity: 0.7;" />
        </div>
      </div>
      
      <div style="text-align: center; padding: var(--sp-5); color: var(--color-text-muted); font-size: var(--text-sm);">
        <p>صُنع بحبٍّ للمجتمع العربي</p>
        <p style="margin-top: var(--sp-1);">المنطقة الافتراضية: السعودية (SA) • اللغة: العربية</p>
        <p style="margin-top: var(--sp-2);">© 2026 zPopcorn Ultimate - Production-Grade Media Intelligence Platform</p>
      </div>
    </div>
 `;

 return div;
}
