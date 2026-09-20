/**
 * SettingsPage - Comprehensive settings with all categories
 */

import { themeManager, THEMES } from '../services/theme/ThemeManager.js';
import { tmdbClient } from '../services/tmdb/TMDBClient.js';
import { backupManager } from '../services/backup/BackupManager.js';
import { notificationService } from '../services/notification/NotificationService.js';
import { db } from '../services/storage/Database.js';

export async function SettingsPage(params) {
 const section = params.section || 'general';
  
 const container = document.createElement('div');
 container.className = 'settings-page';
 container.innerHTML = `
    <div class="container" style="padding-top: 24px; padding-bottom: 40px;">
      <h1 style="font-size: 2rem; font-weight: 700; margin-bottom: 24px;">الإعدادات</h1>
      
      <div style="display: grid; grid-template-columns: 240px 1fr; gap: 24px; align-items: start;">
        <div style="background: var(--color-card); border: 1px solid var(--color-border); border-radius: 12px; padding: 12px; position: sticky; top: 80px;">
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <a href="/settings" data-router class="settings-nav-item ${section === 'general' ? 'active' : ''}" data-section="general" style="padding: 10px 12px; border-radius: 8px; text-decoration: none; color: var(--color-text-primary); display: flex; align-items: center; gap: 8px; ${section === 'general' ? 'background: var(--color-accent); color: white;' : ''}">
              <span></span> عام
            </a>
            <a href="/settings/themes" data-router class="settings-nav-item ${section === 'themes' ? 'active' : ''}" data-section="themes" style="padding: 10px 12px; border-radius: 8px; text-decoration: none; color: var(--color-text-primary); display: flex; align-items: center; gap: 8px; ${section === 'themes' ? 'background: var(--color-accent); color: white;' : ''}">
              <span></span> المظهر
            </a>
            <a href="/settings/tmdb" data-router class="settings-nav-item ${section === 'tmdb' ? 'active' : ''}" data-section="tmdb" style="padding: 10px 12px; border-radius: 8px; text-decoration: none; color: var(--color-text-primary); display: flex; align-items: center; gap: 8px; ${section === 'tmdb' ? 'background: var(--color-accent); color: white;' : ''}">
              <span></span> TMDB
            </a>
            <a href="/settings/playback" data-router class="settings-nav-item ${section === 'playback' ? 'active' : ''}" data-section="playback" style="padding: 10px 12px; border-radius: 8px; text-decoration: none; color: var(--color-text-primary); display: flex; align-items: center; gap: 8px; ${section === 'playback' ? 'background: var(--color-accent); color: white;' : ''}">
              <span>▶</span> التشغيل
            </a>
            <a href="/settings/notifications" data-router class="settings-nav-item ${section === 'notifications' ? 'active' : ''}" data-section="notifications" style="padding: 10px 12px; border-radius: 8px; text-decoration: none; color: var(--color-text-primary); display: flex; align-items: center; gap: 8px; ${section === 'notifications' ? 'background: var(--color-accent); color: white;' : ''}">
              <span></span> الإشعارات
            </a>
            <a href="/settings/backup" data-router class="settings-nav-item ${section === 'backup' ? 'active' : ''}" data-section="backup" style="padding: 10px 12px; border-radius: 8px; text-decoration: none; color: var(--color-text-primary); display: flex; align-items: center; gap: 8px; ${section === 'backup' ? 'background: var(--color-accent); color: white;' : ''}">
              <span></span> النسخ الاحتياطي
            </a>
            <a href="/settings/about" data-router class="settings-nav-item ${section === 'about' ? 'active' : ''}" data-section="about" style="padding: 10px 12px; border-radius: 8px; text-decoration: none; color: var(--color-text-primary); display: flex; align-items: center; gap: 8px; ${section === 'about' ? 'background: var(--color-accent); color: white;' : ''}">
              <span></span> حول
            </a>
          </div>
        </div>
        
        <div id="settings-content" style="background: var(--color-card); border: 1px solid var(--color-border); border-radius: 12px; padding: 24px;">
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
    <h2 style="font-size: 1.5rem; font-weight: 600; margin-bottom: 20px;">الإعدادات العامة</h2>
    
    <div style="display: flex; flex-direction: column; gap: 20px;">
      <div>
        <label style="display: block; font-weight: 500; margin-bottom: 8px;">المنطقة</label>
        <select id="region-select" class="input" style="max-width: 300px;">
          <option value="SA" ${region === 'SA' ? 'selected' : ''}>السعودية (SA)</option>
          <option value="EG" ${region === 'EG' ? 'selected' : ''}>مصر (EG)</option>
          <option value="AE" ${region === 'AE' ? 'selected' : ''}>الإمارات (AE)</option>
          <option value="US" ${region === 'US' ? 'selected' : ''}>الولايات المتحدة (US)</option>
          <option value="GB" ${region === 'GB' ? 'selected' : ''}>المملكة المتحدة (GB)</option>
        </select>
        <div style="font-size: 13px; color: var(--color-text-muted); margin-top: 6px;">تستخدم لعرض مزودي المشاهدة المتاحين في منطقتك</div>
      </div>
      
      <div>
        <label style="display: block; font-weight: 500; margin-bottom: 8px;">اللغة</label>
        <select id="language-select" class="input" style="max-width: 300px;">
          <option value="ar-SA" ${language === 'ar-SA' ? 'selected' : ''}>العربية (السعودية)</option>
          <option value="ar" ${language === 'ar' ? 'selected' : ''}>العربية</option>
          <option value="en-US" ${language === 'en-US' ? 'selected' : ''}>English (US)</option>
          <option value="en" ${language === 'en' ? 'selected' : ''}>English</option>
        </select>
      </div>
      
      <div style="height: 1px; background: var(--color-border); margin: 8px 0;"></div>
      
      <div>
        <h3 style="font-weight: 600; margin-bottom: 12px;">البيانات</h3>
        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
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
    <h2 style="font-size: 1.5rem; font-weight: 600; margin-bottom: 20px;">المظاهر</h2>
    <p style="color: var(--color-text-secondary); margin-bottom: 24px;">اختر مظهراً يناسب ذوقك. كل مظهر يحول التطبيق بالكامل وليس الألوان فقط.</p>
    
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; margin-bottom: 32px;" id="themes-grid">
 ${allThemes.map(theme => `
        <div class="theme-card ${currentTheme === theme.id ? 'active' : ''}" data-theme="${theme.id}" style="border: 2px solid ${currentTheme === theme.id ? 'var(--color-accent)' : 'var(--color-border)'}; border-radius: 12px; overflow: hidden; cursor: pointer; transition: all 0.2s; background: var(--color-surface);">
          <div style="height: 120px; background: ${theme.preview.bg}; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; inset: 0; background: linear-gradient(135deg, ${theme.preview.accent}40, ${theme.preview.accent2}40);"></div>
            <div style="position: relative; display: flex; gap: 8px;">
              <div style="width: 40px; height: 40px; background: ${theme.preview.accent}; border-radius: 8px; box-shadow: 0 4px 12px ${theme.preview.accent}60;"></div>
              <div style="width: 40px; height: 40px; background: ${theme.preview.accent2}; border-radius: 8px; box-shadow: 0 4px 12px ${theme.preview.accent2}60;"></div>
            </div>
 ${currentTheme === theme.id ? '<div style="position: absolute; top: 8px; right: 8px; background: var(--color-accent); color: white; padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;">نشط</div>' : ''}
          </div>
          <div style="padding: 16px;">
            <h3 style="font-weight: 600; margin-bottom: 4px;">${theme.name}</h3>
            <p style="font-size: 13px; color: var(--color-text-secondary); margin-bottom: 8px;">${theme.description}</p>
            <div style="display: flex; gap: 6px; align-items: center;">
              <span style="font-size: 11px; padding: 2px 6px; background: ${theme.isDark ? '#1a1a1a' : '#f0f0f0'}; color: ${theme.isDark ? 'white' : 'black'}; border-radius: 4px;">${theme.isDark ? 'داكن' : 'فاتح'}</span>
              <span style="font-size: 11px; color: var(--color-text-muted);">${theme.category}</span>
            </div>
          </div>
        </div>
 `).join('')}
    </div>
    
    <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px;">
      <h3 style="font-weight: 600; margin-bottom: 16px;">منشئ المظاهر المخصص</h3>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 16px;">
        <div>
          <label style="display: block; font-size: 13px; margin-bottom: 6px;">اللون الأساسي</label>
          <input type="color" id="custom-primary" value="#8b5cf6" class="input" style="height: 44px; padding: 4px;">
        </div>
        <div>
          <label style="display: block; font-size: 13px; margin-bottom: 6px;">اللون الثانوي</label>
          <input type="color" id="custom-secondary" value="#06b6d4" class="input" style="height: 44px; padding: 4px;">
        </div>
        <div>
          <label style="display: block; font-size: 13px; margin-bottom: 6px;">الخلفية</label>
          <input type="color" id="custom-bg" value="#0a0a0f" class="input" style="height: 44px; padding: 4px;">
        </div>
      </div>
      <div style="display: flex; gap: 8px;">
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
 badge.style.cssText = 'position: absolute; top: 8px; right: 8px; background: var(--color-accent); color: white; padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: 600;';
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
    <h2 style="font-size: 1.5rem; font-weight: 600; margin-bottom: 20px;">إعدادات TMDB</h2>
    
    <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px; margin-bottom: 20px;">
      <h3 style="font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
        <span style="width: 10px; height: 10px; background: #10b981; border-radius: 50%; display: inline-block;"></span>
 حالة الاتصال
      </h3>
      <div style="display: grid; gap: 8px; font-size: 14px;">
        <div style="display: flex; justify-content: space-between;"><span>المنطقة:</span><span style="font-weight: 500;">${localStorage.getItem('zpopcorn-region') || 'SA'}</span></div>
        <div style="display: flex; justify-content: space-between;"><span>اللغة:</span><span style="font-weight: 500;">${localStorage.getItem('zpopcorn-language') || 'ar-SA'}</span></div>
        <div style="display: flex; justify-content: space-between;"><span>الطلبات:</span><span class="number-ltr">${stats.requests}</span></div>
        <div style="display: flex; justify-content: space-between;"><span>إصابات التخزين المؤقت:</span><span class="number-ltr">${stats.cacheHits}</span></div>
      </div>
      <button id="test-connection" class="btn btn-secondary" style="margin-top: 16px;">اختبار الاتصال</button>
      <div id="connection-result" style="margin-top: 12px; font-size: 13px;"></div>
    </div>
    
    <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px; margin-bottom: 20px;">
      <h3 style="font-weight: 600; margin-bottom: 12px;">مفتاح TMDB API</h3>
      <p style="font-size: 13px; color: var(--color-text-secondary); margin-bottom: 12px;">احصل على مفتاح مجاني من <a href="https://www.themoviedb.org/settings/api" target="_blank" style="color: var(--color-accent);">themoviedb.org</a></p>
      <div style="display: flex; gap: 8px;">
        <input type="password" id="api-key-input" class="input" placeholder="أدخل مفتاح TMDB API" value="${apiKey}" style="flex: 1;" />
        <button id="save-api-key" class="btn btn-primary">حفظ</button>
        <button id="toggle-api-key" class="btn btn-ghost"></button>
      </div>
      <div style="font-size: 12px; color: var(--color-text-muted); margin-top: 8px;">المفتاح الحالي: ${apiKey ? apiKey.slice(0, 8) + '...' : 'غير محدد (يستخدم مفتاح تجريبي)'}</div>
    </div>
    
    <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px;">
      <h3 style="font-weight: 600; margin-bottom: 12px;">التخزين المؤقت</h3>
      <div style="display: grid; gap: 8px; font-size: 14px; margin-bottom: 16px;">
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
 resultDiv.innerHTML = '<span style="color: #10b981;">✅ TMDB متصل بنجاح</span>';
 } else {
 resultDiv.innerHTML = '<span style="color: #ef4444;">❌ فشل الاتصال</span>';
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
    <h2 style="font-size: 1.5rem; font-weight: 600; margin-bottom: 20px;">إعدادات التشغيل</h2>
    
    <div style="display: flex; flex-direction: column; gap: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 8px;">
        <div>
          <div style="font-weight: 500;">التشغيل التلقائي للحلقة التالية</div>
          <div style="font-size: 13px; color: var(--color-text-secondary);">تشغيل الحلقة التالية تلقائياً</div>
        </div>
        <label style="position: relative; display: inline-block; width: 44px; height: 24px;">
          <input type="checkbox" id="auto-next" ${localStorage.getItem('zpopcorn-auto-next') === 'true' ? 'checked' : ''} style="opacity: 0; width: 0; height: 0;">
          <span style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background: var(--color-border); border-radius: 24px; transition: 0.2s;"></span>
        </label>
      </div>
      
      <div>
        <label style="display: block; font-weight: 500; margin-bottom: 8px;">مستوى الصوت الافتراضي</label>
        <input type="range" id="default-volume" min="0" max="100" value="${localStorage.getItem('zpopcorn-default-volume') || 80}" style="width: 100%; max-width: 300px;" />
        <span id="volume-value" style="margin-right: 12px;">${localStorage.getItem('zpopcorn-default-volume') || 80}%</span>
      </div>
      
      <div>
        <label style="display: block; font-weight: 500; margin-bottom: 8px;">عتبة متابعة المشاهدة (%)</label>
        <input type="range" id="continue-threshold" min="1" max="20" value="${localStorage.getItem('zpopcorn-continue-threshold') || 5}" style="width: 100%; max-width: 300px;" />
        <span id="threshold-value" style="margin-right: 12px;">${localStorage.getItem('zpopcorn-continue-threshold') || 5}%</span>
        <div style="font-size: 12px; color: var(--color-text-muted); margin-top: 4px;">إذا شاهدت أقل من هذه النسبة، سيبدأ من البداية</div>
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
    <h2 style="font-size: 1.5rem; font-weight: 600; margin-bottom: 20px;">إعدادات الإشعارات</h2>
    
    <div style="display: flex; flex-direction: column; gap: 12px;">
 ${Object.entries(prefs).map(([type, enabled]) => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 8px;">
          <div>
            <div style="font-weight: 500;">${getNotificationTypeName(type)}</div>
            <div style="font-size: 12px; color: var(--color-text-secondary);">${getNotificationTypeDesc(type)}</div>
          </div>
          <label style="position: relative; display: inline-block; width: 44px; height: 24px;">
            <input type="checkbox" data-type="${type}" ${enabled ? 'checked' : ''} style="opacity: 0; width: 0; height: 0;">
            <span class="toggle-slider" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background: ${enabled ? 'var(--color-accent)' : 'var(--color-border)'}; border-radius: 24px; transition: 0.2s;"></span>
          </label>
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
    <h2 style="font-size: 1.5rem; font-weight: 600; margin-bottom: 20px;">النسخ الاحتياطي والاستعادة</h2>
    
    <div style="display: grid; gap: 20px;">
      <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px;">
        <h3 style="font-weight: 600; margin-bottom: 12px;">إنشاء نسخ احتياطي</h3>
        <p style="font-size: 13px; color: var(--color-text-secondary); margin-bottom: 16px;">احفظ جميع بياناتك في ملف JSON</p>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button id="backup-full" class="btn btn-primary">نسخ احتياطي كامل</button>
          <button id="backup-settings" class="btn btn-secondary">الإعدادات فقط</button>
          <button id="backup-watchlists" class="btn btn-secondary">قوائم المشاهدة</button>
          <button id="backup-history" class="btn btn-secondary">سجل المشاهدة</button>
        </div>
      </div>
      
      <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px;">
        <h3 style="font-weight: 600; margin-bottom: 12px;">استعادة نسخ احتياطي</h3>
        <p style="font-size: 13px; color: var(--color-text-secondary); margin-bottom: 16px;">استعد بياناتك من ملف نسخ احتياطي. سيتم إنشاء نسخة آمنة قبل الاستعادة.</p>
        <input type="file" id="restore-file" accept=".json" style="margin-bottom: 12px;" />
        <div id="restore-info" style="font-size: 13px; margin-bottom: 12px;"></div>
        <button id="restore-btn" class="btn btn-primary" disabled>استعادة</button>
      </div>
      
      <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px;">
        <h3 style="font-weight: 600; margin-bottom: 12px;">إحصائيات البيانات</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; font-size: 13px;">
 ${Object.entries(stats).map(([store, count]) => `
            <div style="display: flex; justify-content: space-between; padding: 8px; background: var(--color-card); border-radius: 6px;">
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
        <div style="background: var(--color-card); padding: 12px; border-radius: 8px; border: 1px solid var(--color-border);">
          <div style="font-weight: 500; margin-bottom: 8px;">معلومات النسخ الاحتياطي:</div>
          <div style="display: grid; gap: 4px; font-size: 12px;">
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
    <h2 style="font-size: 1.5rem; font-weight: 600; margin-bottom: 20px;">حول zPopcorn</h2>
    
    <div style="text-align: center; padding: 32px 0; border-bottom: 1px solid var(--color-border); margin-bottom: 24px;">
      <div style="font-size: 64px; margin-bottom: 16px;"></div>
      <h2 style="font-size: 2rem; font-weight: 700; margin-bottom: 8px; background: linear-gradient(135deg, var(--color-accent), var(--color-accent-secondary)); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">zPopcorn Ultimate</h2>
      <p style="color: var(--color-text-secondary); margin-bottom: 8px;">منصة الوسائط الذكية المتكاملة</p>
      <p style="font-size: 13px; color: var(--color-text-muted);">الإصدار 2.0.0 - Production-Grade</p>
    </div>
    
    <div style="display: grid; gap: 20px;">
      <div>
        <h3 style="font-weight: 600; margin-bottom: 12px;">المميزات</h3>
        <ul style="list-style: none; display: grid; gap: 8px; font-size: 14px; color: var(--color-text-secondary);">
          <li style="display: flex; align-items: center; gap: 8px;"><span class="z-dot-ok" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--color-success)"></span> تكامل حقيقي مع TMDB API</li>
          <li style="display: flex; align-items: center; gap: 8px;"><span class="z-dot-ok" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--color-success)"></span> 8 مظاهر احترافية + منشئ مظاهر مخصص</li>
          <li style="display: flex; align-items: center; gap: 8px;"><span class="z-dot-ok" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--color-success)"></span> محرك ذكاء وتوصيات ذكية</li>
          <li style="display: flex; align-items: center; gap: 8px;"><span class="z-dot-ok" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--color-success)"></span> تتبع السلوك وملف الذوق</li>
          <li style="display: flex; align-items: center; gap: 8px;"><span class="z-dot-ok" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--color-success)"></span> مشغل احترافي مع mpv</li>
          <li style="display: flex; align-items: center; gap: 8px;"><span class="z-dot-ok" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--color-success)"></span> قوائم مشاهدة متقدمة</li>
          <li style="display: flex; align-items: center; gap: 8px;"><span class="z-dot-ok" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--color-success)"></span> بحث ذكي ومساعد وسائط</li>
          <li style="display: flex; align-items: center; gap: 8px;"><span class="z-dot-ok" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--color-success)"></span> إحصائيات وتحليلات متقدمة</li>
          <li style="display: flex; align-items: center; gap: 8px;"><span class="z-dot-ok" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--color-success)"></span> نسخ احتياطي واستعادة آمنة</li>
          <li style="display: flex; align-items: center; gap: 8px;"><span class="z-dot-ok" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--color-success)"></span> دعم كامل للعربية RTL</li>
        </ul>
      </div>
      
      <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px;">
        <h3 style="font-weight: 600; margin-bottom: 12px;">التقنيات</h3>
        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
          <span style="padding: 4px 8px; background: var(--color-card); border: 1px solid var(--color-border); border-radius: 16px; font-size: 12px;">Electron.js</span>
          <span style="padding: 4px 8px; background: var(--color-card); border: 1px solid var(--color-border); border-radius: 16px; font-size: 12px;">Node.js</span>
          <span style="padding: 4px 8px; background: var(--color-card); border: 1px solid var(--color-border); border-radius: 16px; font-size: 12px;">Vite</span>
          <span style="padding: 4px 8px; background: var(--color-card); border: 1px solid var(--color-border); border-radius: 16px; font-size: 12px;">Vanilla JS ES2024</span>
          <span style="padding: 4px 8px; background: var(--color-card); border: 1px solid var(--color-border); border-radius: 16px; font-size: 12px;">SQLite</span>
          <span style="padding: 4px 8px; background: var(--color-card); border: 1px solid var(--color-border); border-radius: 16px; font-size: 12px;">IndexedDB</span>
          <span style="padding: 4px 8px; background: var(--color-card); border: 1px solid var(--color-border); border-radius: 16px; font-size: 12px;">TMDB API</span>
          <span style="padding: 4px 8px; background: var(--color-card); border: 1px solid var(--color-border); border-radius: 16px; font-size: 12px;">mpv Player</span>
          <span style="padding: 4px 8px; background: var(--color-card); border: 1px solid var(--color-border); border-radius: 16px; font-size: 12px;">Socket.IO</span>
        </div>
      </div>
      
      <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px;">
        <h3 style="font-weight: 600; margin-bottom: 8px;">نسب TMDB</h3>
        <p style="font-size: 13px; color: var(--color-text-secondary); line-height: 1.6;">
 هذا المنتج يستخدم TMDB API لكنه غير معتمد أو مصدق من قبل TMDB.<br>
          <a href="https://www.themoviedb.org/" target="_blank" style="color: var(--color-accent);">The Movie Database (TMDB)</a>
        </p>
        <div style="margin-top: 12px;">
          <img src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_short-8e8b30f73a4020632fe363630cd67723f4ec8d71fcf6f3c8b8d0a9e1b3a0e0a.svg" alt="TMDB" style="height: 20px; opacity: 0.7;" />
        </div>
      </div>
      
      <div style="text-align: center; padding: 20px; color: var(--color-text-muted); font-size: 13px;">
        <p>صُنع بحبٍّ للمجتمع العربي</p>
        <p style="margin-top: 4px;">المنطقة الافتراضية: السعودية (SA) • اللغة: العربية</p>
        <p style="margin-top: 8px;">© 2026 zPopcorn Ultimate - Production-Grade Media Intelligence Platform</p>
      </div>
    </div>
 `;

 return div;
}
