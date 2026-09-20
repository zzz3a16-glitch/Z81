/**
 * Enhanced Settings Page - All 15 Categories per Spec
 * Production-Grade Settings Architecture
 */

import { themeManager } from '../services/theme/ThemeManager.js';
import { tmdbClient } from '../services/tmdb/TMDBClient.js';
import { backupManager } from '../services/backup/BackupManager.js';
import { notificationService } from '../services/notification/NotificationService.js';
import { db } from '../services/storage/Database.js';
import { securityManager } from '../services/security/SecurityManager.js';
import { performanceManager } from '../services/performance/PerformanceManager.js';

const SETTINGS_CATEGORIES = [
 { id: 'general', name: 'عام', icon: '', desc: 'الإعدادات العامة' },
 { id: 'appearance', name: 'المظهر', icon: '', desc: 'الثيمات والعرض' },
 { id: 'playback', name: 'التشغيل', icon: '▶', desc: 'إعدادات المشغل' },
 { id: 'subtitles', name: 'الترجمات', icon: '', desc: 'الترجمة والنصوص' },
 { id: 'audio', name: 'الصوت', icon: '', desc: 'المسارات الصوتية' },
 { id: 'library', name: 'المكتبة', icon: '', desc: 'إدارة المكتبة' },
 { id: 'scanner', name: 'الفاحص', icon: '', desc: 'فحص الملفات' },
 { id: 'tmdb', name: 'TMDB', icon: '', desc: 'واجهة برمجة التطبيقات' },
 { id: 'recommendations', name: 'التوصيات', icon: '', desc: 'ذكاء التوصيات' },
 { id: 'notifications', name: 'الإشعارات', icon: '', desc: 'مركز الإشعارات' },
 { id: 'privacy', name: 'الخصوصية', icon: '', desc: 'البيانات والخصوصية' },
 { id: 'backup', name: 'النسخ الاحتياطي', icon: '', desc: 'حفظ واستعادة' },
 { id: 'keyboard', name: 'لوحة المفاتيح', icon: '⌨', desc: 'اختصارات' },
 { id: 'advanced', name: 'متقدم', icon: '', desc: 'إعدادات متقدمة' },
 { id: 'about', name: 'حول', icon: '', desc: 'معلومات التطبيق' }
];

export async function EnhancedSettingsPage(params) {
 const section = params.section || 'general';
  
 const container = document.createElement('div');
 container.className = 'settings-page';
 container.innerHTML = `
    <div class="container" style="padding-top: 24px; padding-bottom: 40px;">
      <h1 style="font-size: 2rem; font-weight: 700; margin-bottom: 8px;">الإعدادات</h1>
      <p style="color: var(--color-text-secondary); margin-bottom: 24px;">إدارة جميع جوانب التطبيق</p>
      
      <div style="display: grid; grid-template-columns: 280px 1fr; gap: 24px; align-items: start;" class="settings-layout">
        <div style="background: var(--color-card); border: 1px solid var(--color-border); border-radius: 12px; padding: 12px; position: sticky; top: 80px; max-height: calc(100vh - 100px); overflow-y: auto;" class="settings-sidebar">
          <div style="display: flex; flex-direction: column; gap: 2px;">
 ${SETTINGS_CATEGORIES.map(cat => `
              <a href="/settings/${cat.id}" data-router class="settings-nav-item ${section === cat.id ? 'active' : ''}" data-section="${cat.id}" style="padding: 10px 12px; border-radius: 8px; text-decoration: none; color: var(--color-text-primary); display: flex; align-items: center; gap: 10px; transition: all 0.2s; ${section === cat.id ? 'background: var(--color-accent); color: white;' : 'background: transparent;'}">
                <span style="font-size: 1.1rem;">${cat.icon}</span>
                <div style="flex: 1; min-width: 0;">
                  <div style="font-weight: 500; font-size: 14px;">${cat.name}</div>
                  <div style="font-size: 11px; opacity: 0.7; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${cat.desc}</div>
                </div>
              </a>
 `).join('')}
          </div>
        </div>
        
        <div id="settings-content" style="background: var(--color-card); border: 1px solid var(--color-border); border-radius: 12px; padding: 24px; min-height: 500px;">
          <div class="loading-skeleton">جاري التحميل...</div>
        </div>
      </div>
    </div>

    <style>
 @media (max-width: 768px) {
 .settings-layout { grid-template-columns: 1fr !important; }
 .settings-sidebar { position: static !important; max-height: none !important; }
 .settings-sidebar > div { display: grid !important; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px !important; }
 }
    </style>
 `;

 const content = container.querySelector('#settings-content');
  
 // Load section
 setTimeout(async () => {
 try {
 let sectionEl;
 switch (section) {
 case 'appearance':
 case 'themes':
 sectionEl = await createAppearanceSection();
 break;
 case 'playback':
 sectionEl = createPlaybackSection();
 break;
 case 'subtitles':
 sectionEl = createSubtitlesSection();
 break;
 case 'audio':
 sectionEl = createAudioSection();
 break;
 case 'library':
 sectionEl = createLibrarySection();
 break;
 case 'scanner':
 sectionEl = createScannerSection();
 break;
 case 'tmdb':
 sectionEl = await createTMDBSection();
 break;
 case 'recommendations':
 sectionEl = createRecommendationsSection();
 break;
 case 'notifications':
 sectionEl = createNotificationsSection();
 break;
 case 'privacy':
 sectionEl = createPrivacySection();
 break;
 case 'backup':
 sectionEl = await createBackupSection();
 break;
 case 'keyboard':
 sectionEl = createKeyboardSection();
 break;
 case 'advanced':
 sectionEl = await createAdvancedSection();
 break;
 case 'about':
 sectionEl = createAboutSection();
 break;
 default:
 sectionEl = createGeneralSection();
 }
      
 content.innerHTML = '';
 content.appendChild(sectionEl);
 } catch (e) {
 content.innerHTML = `<div style="padding: 40px; text-align: center; color: var(--color-danger);">خطأ في تحميل الإعدادات: ${e.message}</div>`;
 }
 }, 50);

 return container;
}

function createGeneralSection() {
 const div = document.createElement('div');
 const region = localStorage.getItem('zpopcorn-region') || 'SA';
 const language = localStorage.getItem('zpopcorn-language') || 'ar-SA';
 const timeFormat = localStorage.getItem('zpopcorn-time-format') || '24h';
 const dateFormat = localStorage.getItem('zpopcorn-date-format') || 'gregorian';
  
 div.innerHTML = `
    <h2 style="font-size: 1.5rem; font-weight: 600; margin-bottom: 20px;">الإعدادات العامة</h2>
    
    <div style="display: flex; flex-direction: column; gap: 24px;">
      <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px;">
        <h3 style="font-weight: 600; margin-bottom: 16px;">المنطقة واللغة</h3>
        <div style="display: grid; gap: 16px;">
          <div>
            <label style="display: block; font-weight: 500; margin-bottom: 8px;">المنطقة</label>
            <select id="region-select" class="input" style="max-width: 300px;">
              <option value="SA" ${region === 'SA' ? 'selected' : ''}> السعودية (SA)</option>
              <option value="EG" ${region === 'EG' ? 'selected' : ''}> مصر (EG)</option>
              <option value="AE" ${region === 'AE' ? 'selected' : ''}> الإمارات (AE)</option>
              <option value="US" ${region === 'US' ? 'selected' : ''}> الولايات المتحدة (US)</option>
              <option value="GB" ${region === 'GB' ? 'selected' : ''}> المملكة المتحدة (GB)</option>
              <option value="DE" ${region === 'DE' ? 'selected' : ''}> ألمانيا (DE)</option>
              <option value="JP" ${region === 'JP' ? 'selected' : ''}> اليابان (JP)</option>
            </select>
            <div style="font-size: 12px; color: var(--color-text-muted); margin-top: 6px;">تستخدم لعرض مزودي المشاهدة المتاحين</div>
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

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <div>
              <label style="display: block; font-weight: 500; margin-bottom: 8px;">تنسيق الوقت</label>
              <select id="time-format" class="input">
                <option value="24h" ${timeFormat === '24h' ? 'selected' : ''}>24 ساعة</option>
                <option value="12h" ${timeFormat === '12h' ? 'selected' : ''}>12 ساعة</option>
              </select>
            </div>
            <div>
              <label style="display: block; font-weight: 500; margin-bottom: 8px;">تنسيق التاريخ</label>
              <select id="date-format" class="input">
                <option value="gregorian" ${dateFormat === 'gregorian' ? 'selected' : ''}>ميلادي</option>
                <option value="hijri" ${dateFormat === 'hijri' ? 'selected' : ''}>هجري</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px;">
        <h3 style="font-weight: 600; margin-bottom: 16px;">البيانات والتخزين</h3>
        <div style="display: grid; gap: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--color-card); border-radius: 8px;">
            <div>
              <div style="font-weight: 500;">التخزين المؤقت</div>
              <div style="font-size: 12px; color: var(--color-text-muted);">بيانات TMDB المؤقتة</div>
            </div>
            <button id="clear-cache" class="btn btn-secondary btn-sm">مسح</button>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: rgba(239,68,68,0.05); border: 1px solid rgba(239,68,68,0.2); border-radius: 8px;">
            <div>
              <div style="font-weight: 500; color: var(--color-danger);">مسح جميع البيانات</div>
              <div style="font-size: 12px; color: var(--color-text-muted);">لا يمكن التراجع - سيتم حذف كل شيء</div>
            </div>
            <button id="clear-data" class="btn btn-danger btn-sm">مسح الكل</button>
          </div>
        </div>
      </div>
    </div>
 `;

 div.querySelector('#region-select').addEventListener('change', (e) => {
 localStorage.setItem('zpopcorn-region', e.target.value);
 window.dispatchEvent(new CustomEvent('showtoast', { detail: { type: 'success', message: `تم تغيير المنطقة إلى ${e.target.value}` } }));
 });

 div.querySelector('#language-select').addEventListener('change', (e) => {
 localStorage.setItem('zpopcorn-language', e.target.value);
 window.dispatchEvent(new CustomEvent('showtoast', { detail: { type: 'success', message: `تم تغيير اللغة` } }));
 });

 div.querySelector('#time-format').addEventListener('change', (e) => localStorage.setItem('zpopcorn-time-format', e.target.value));
 div.querySelector('#date-format').addEventListener('change', (e) => localStorage.setItem('zpopcorn-date-format', e.target.value));

 div.querySelector('#clear-cache').addEventListener('click', async () => {
 try {
 const { tmdbClient } = await import('../services/tmdb/TMDBClient.js');
 tmdbClient.clearCache();
 window.dispatchEvent(new CustomEvent('showtoast', { detail: { type: 'success', message: 'تم مسح التخزين المؤقت' } }));
 } catch {}
 });

 div.querySelector('#clear-data').addEventListener('click', async () => {
 if (confirm('هل أنت متأكد من مسح جميع البيانات؟ لا يمكن التراجع!')) {
 if (confirm('تأكيد نهائي: سيتم حذف جميع الأفلام، المسلسلات، السجل، والقوائم.')) {
 localStorage.clear();
 try {
 for (const store of ['movies', 'tvshows', 'watchHistory', 'watchProgress', 'favorites', 'watchlists', 'ratings', 'behaviorEvents', 'notifications']) {
 try { await db.clear(store); } catch {}
 }
 } catch {}
 window.location.reload();
 }
 }
 });

 // density + sidebar prefs (desktop-first chrome)
 const syncPrefs = () => {
 const d = localStorage.getItem('zpopcorn-density') || 'comfortable';
 const sb = document.documentElement.getAttribute('data-sidebar') === 'rail' ? 'rail' : 'full';
 div.querySelectorAll('.density-opt').forEach((b) => { b.classList.toggle('btn-primary', b.dataset.density === d); b.classList.toggle('btn-secondary', b.dataset.density !== d); });
 div.querySelectorAll('.sb-opt').forEach((b) => { b.classList.toggle('btn-primary', b.dataset.sb === sb); b.classList.toggle('btn-secondary', b.dataset.sb !== sb); });
 };
 div.querySelectorAll('.density-opt').forEach((b) => b.addEventListener('click', () => {
 localStorage.setItem('zpopcorn-density', b.dataset.density);
 document.documentElement.setAttribute('data-density', b.dataset.density);
 syncPrefs();
 }));
 div.querySelectorAll('.sb-opt').forEach((b) => b.addEventListener('click', () => {
 localStorage.setItem('zpopcorn-sb-rail', b.dataset.sb === 'rail' ? '1' : '0');
 document.documentElement.setAttribute('data-sidebar', b.dataset.sb);
 window.dispatchEvent(new CustomEvent('sidebartoggle', { detail: { collapsed: b.dataset.sb === 'rail' } }));
 syncPrefs();
 }));
 const _ae = div.querySelector('.density-opt');
 if (_ae) setTimeout(syncPrefs, 0);

 return div;
}

async function createAppearanceSection() {
 const div = document.createElement('div');
 const currentTheme = themeManager.getTheme();
 const allThemes = themeManager.getThemeList();
  
 div.innerHTML = `
    <h2 style="font-size: 1.5rem; font-weight: 600; margin-bottom: 8px;">المظهر</h2>
    <p style="color: var(--color-text-secondary); margin-bottom: 24px; font-size: 14px;">كل مظهر يحول التطبيق بالكامل: الألوان، الأسطح، البطاقات، الظلال، التأثيرات، الحركة، والكثافة</p>
    
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; margin-bottom: 32px;" id="themes-grid">
 ${allThemes.map(theme => `
        <div class="theme-card ${currentTheme === theme.id ? 'active' : ''}" data-theme="${theme.id}" style="border: 2px solid ${currentTheme === theme.id ? 'var(--color-accent)' : 'var(--color-border)'}; border-radius: 12px; overflow: hidden; cursor: pointer; transition: all 0.2s; background: var(--color-surface); position: relative;">
          <div style="height: 120px; background: ${theme.preview?.bg || '#1a1a1a'}; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; inset: 0; background: linear-gradient(135deg, ${theme.preview?.accent || '#8b5cf6'}40, ${theme.preview?.accent2 || '#06b6d4'}40);"></div>
            <div style="position: relative; display: flex; gap: 8px;">
              <div style="width: 40px; height: 40px; background: ${theme.preview?.accent || '#8b5cf6'}; border-radius: 8px; box-shadow: 0 4px 12px ${theme.preview?.accent || '#8b5cf6'}60;"></div>
              <div style="width: 40px; height: 40px; background: ${theme.preview?.accent2 || '#06b6d4'}; border-radius: 8px;"></div>
            </div>
 ${currentTheme === theme.id ? '<div style="position: absolute; top: 8px; right: 8px; background: var(--color-accent); color: white; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600;">✓ نشط</div>' : ''}
          </div>
          <div style="padding: 16px;">
            <h3 style="font-weight: 600; margin-bottom: 4px; display: flex; align-items: center; gap: 8px;">${theme.name} </h3>
            <p style="font-size: 12px; color: var(--color-text-secondary); margin-bottom: 10px; line-height: 1.5;">${theme.description}</p>
            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
              <span style="font-size: 10px; padding: 2px 6px; background: ${theme.isDark ? '#1a1a1a' : '#f0f0f0'}; color: ${theme.isDark ? 'white' : 'black'}; border-radius: 4px; border: 1px solid var(--color-border);">${theme.isDark ? 'داكن' : 'فاتح'}</span>
              <span style="font-size: 10px; padding: 2px 6px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 4px;">${theme.category}</span>
 ${theme.effects?.includes('glow') ? '<span style="font-size: 10px; padding: 2px 6px; background: rgba(139,92,246,0.1); color: #8b5cf6; border-radius: 4px;">توهج</span>' : ''}
 ${theme.effects?.includes('glass') ? '<span style="font-size: 10px; padding: 2px 6px; background: rgba(6,182,214,0.1); color: #06b6d4; border-radius: 4px;"> زجاج</span>' : ''}
            </div>
          </div>
        </div>
 `).join('')}
    </div>
    
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:20px">
      <div style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:12px;padding:16px">
        <b style="font-size:13px;display:block;margin-bottom:10px">كثافة الواجهة</b>
        <div style="display:flex;gap:6px" id="density-picker">
          <button class="btn btn-sm density-opt" data-density="comfortable">مريحة</button>
          <button class="btn btn-sm density-opt" data-density="compact">مضغوطة</button>
        </div>
      </div>
      <div style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:12px;padding:16px">
        <b style="font-size:13px;display:block;margin-bottom:10px">الشريط الجانبي</b>
        <div style="display:flex;gap:6px" id="sidebar-pref">
          <button class="btn btn-sm sb-opt" data-sb="full">عريض</button>
          <button class="btn btn-sm sb-opt" data-sb="rail">أيقونات فقط</button>
        </div>
      </div>
    </div>
    <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px; margin-bottom: 20px;">
      <h3 style="font-weight: 600; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">منشئ المظاهر المخصص</h3>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 16px;">
        <div>
          <label style="display: block; font-size: 12px; margin-bottom: 6px; font-weight: 500;">اللون الأساسي</label>
          <input type="color" id="custom-primary" value="#8b5cf6" class="input" style="height: 44px; padding: 4px;">
        </div>
        <div>
          <label style="display: block; font-size: 12px; margin-bottom: 6px; font-weight: 500;">اللون الثانوي</label>
          <input type="color" id="custom-secondary" value="#06b6d4" class="input" style="height: 44px; padding: 4px;">
        </div>
        <div>
          <label style="display: block; font-size: 12px; margin-bottom: 6px; font-weight: 500;">الخلفية</label>
          <input type="color" id="custom-bg" value="#0a0a0f" class="input" style="height: 44px; padding: 4px;">
        </div>
        <div>
          <label style="display: block; font-size: 12px; margin-bottom: 6px; font-weight: 500;">نصف القطر</label>
          <select id="custom-radius" class="input" style="height: 44px;">
            <option value="4px">صغير (4px)</option>
            <option value="8px" selected>متوسط (8px)</option>
            <option value="12px">كبير (12px)</option>
            <option value="20px">كبير جداً (20px)</option>
          </select>
        </div>
      </div>
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <button id="preview-custom" class="btn btn-secondary"> معاينة مباشرة</button>
        <button id="save-custom" class="btn btn-primary">حفظ كمظهر مخصص</button>
        <button id="export-theme" class="btn btn-ghost"> تصدير المظهر الحالي</button>
        <button id="import-theme" class="btn btn-ghost"> استيراد مظهر</button>
        <input type="file" id="import-file" accept=".json" style="display: none;">
      </div>
    </div>

    <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px;">
      <h3 style="font-weight: 600; margin-bottom: 12px;">إعدادات الحركة والعرض</h3>
      <div style="display: grid; gap: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-weight: 500; font-size: 14px;">تقليل الحركة</div>
            <div style="font-size: 12px; color: var(--color-text-muted);">للمستخدمين الحساسين للحركة</div>
          </div>
          <input type="checkbox" id="reduced-motion" ${window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'checked' : ''} />
        </div>
        <div>
          <label style="font-size: 14px; font-weight: 500; margin-bottom: 8px; display: block;">كثافة الواجهة</label>
          <select id="ui-density" class="input" style="max-width: 200px;">
            <option value="comfortable">مريحة</option>
            <option value="compact">مدمجة</option>
            <option value="spacious">واسعة</option>
          </select>
        </div>
      </div>
    </div>
 `;

 div.querySelectorAll('.theme-card').forEach(card => {
 card.addEventListener('click', () => {
 const themeId = card.dataset.theme;
 themeManager.setTheme(themeId);
      
 div.querySelectorAll('.theme-card').forEach(c => {
 c.style.borderColor = 'var(--color-border)';
 const badge = c.querySelector('[style*="نشط"]');
 if (badge) badge.remove();
 });
      
 card.style.borderColor = 'var(--color-accent)';
 const badge = document.createElement('div');
 badge.style.cssText = 'position: absolute; top: 8px; right: 8px; background: var(--color-accent); color: white; padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600;';
 badge.textContent = '✓ نشط';
 card.querySelector('[style*="height: 120px"]').appendChild(badge);
      
 window.dispatchEvent(new CustomEvent('showtoast', {
 detail: { type: 'success', message: `تم تطبيق ${themeManager.getThemeConfig(themeId)?.name || themeId}` }
 }));
 });

 card.addEventListener('mouseenter', () => {
 if (!card.classList.contains('active')) {
 card.style.transform = 'translateY(-2px)';
 card.style.boxShadow = 'var(--shadow-lg)';
 }
 });
    
 card.addEventListener('mouseleave', () => {
 card.style.transform = '';
 card.style.boxShadow = '';
 });
 });

 div.querySelector('#preview-custom')?.addEventListener('click', () => {
 const primary = div.querySelector('#custom-primary').value;
 const secondary = div.querySelector('#custom-secondary').value;
 const bg = div.querySelector('#custom-bg').value;
 const radius = div.querySelector('#custom-radius').value;
    
 document.documentElement.style.setProperty('--color-accent', primary);
 document.documentElement.style.setProperty('--color-accent-secondary', secondary);
 document.documentElement.style.setProperty('--color-background', bg);
 document.documentElement.style.setProperty('--radius-md', radius);
    
 window.dispatchEvent(new CustomEvent('showtoast', { detail: { type: 'info', message: 'معاينة مباشرة - لن يتم الحفظ إلا عند الضغط على حفظ' } }));
 });

 div.querySelector('#save-custom')?.addEventListener('click', () => {
 const primary = div.querySelector('#custom-primary').value;
 const secondary = div.querySelector('#custom-secondary').value;
 const bg = div.querySelector('#custom-bg').value;
 const radius = div.querySelector('#custom-radius').value;
 const name = prompt('اسم المظهر المخصص:');
    
 if (name) {
 const customId = `custom-${Date.now()}`;
 themeManager.createCustomTheme(name, {
 id: customId,
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
 },
 radius: { md: radius }
 });
      
 window.dispatchEvent(new CustomEvent('showtoast', { detail: { type: 'success', message: `تم حفظ المظهر ${name}` } }));
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

 div.querySelector('#import-theme')?.addEventListener('click', () => {
 div.querySelector('#import-file').click();
 });

 div.querySelector('#import-file')?.addEventListener('change', async (e) => {
 const file = e.target.files[0];
 if (!file) return;
    
 try {
 const text = await file.text();
 themeManager.importTheme(text);
 window.dispatchEvent(new CustomEvent('showtoast', { detail: { type: 'success', message: 'تم استيراد المظهر' } }));
 setTimeout(() => window.location.reload(), 500);
 } catch (err) {
 window.dispatchEvent(new CustomEvent('showtoast', { detail: { type: 'error', message: `فشل الاستيراد: ${err.message}` } }));
 }
 });

 return div;
}


const playerPhaseBanner = () => `
  <div style="display:flex;gap:10px;align-items:center;padding:12px 16px;margin-bottom:20px;border-radius:12px;
 background:color-mix(in srgb, var(--color-warning, #f59e0b) 10%, transparent);
 border:1px solid color-mix(in srgb, var(--color-warning, #f59e0b) 40%, transparent);
 font-size:13px;color:var(--color-text-secondary);">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-warning,#f59e0b)" stroke-width="1.8" stroke-linecap="round" style="flex-shrink:0"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>
    <span>تُحفظ هذه الإعدادات وتُطبَّق تلقائياً عند إضافة محرك التشغيل — المشغّل مرحلة قادمة منفصلة، ولن تعمل هذه الخيارات قبلها.</span>
  </div>`;

function createPlaybackSection() {
 const div = document.createElement('div');
 div.innerHTML = `
 ${playerPhaseBanner()}
    <h2 style="font-size: 1.5rem; font-weight: 600; margin-bottom: 20px;">إعدادات التشغيل</h2>
    <div style="display: grid; gap: 20px;">
 ${createToggle('auto-next', 'التشغيل التلقائي للحلقة التالية', 'تشغيل الحلقة التالية تلقائياً عند الانتهاء', localStorage.getItem('zpopcorn-auto-next') === 'true')}
 ${createToggle('preload-next', 'تحميل الحلقة التالية مسبقاً', 'تحميل مسبق لتجربة سلسة', localStorage.getItem('zpopcorn-preload-next') !== 'false')}
 ${createToggle('skip-intro', 'تخطي المقدمة', 'تخطي مقدمة المسلسل عند توفر البيانات', localStorage.getItem('zpopcorn-skip-intro') === 'true')}
      
      <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px;">
        <h3 style="font-weight: 600; margin-bottom: 16px;">مستوى الصوت</h3>
        <div style="display: flex; align-items: center; gap: 16px;">
          <span></span>
          <input type="range" id="default-volume" min="0" max="100" value="${localStorage.getItem('zpopcorn-default-volume') || 80}" style="flex: 1; max-width: 300px;" />
          <span id="volume-value" style="min-width: 40px; font-weight: 600;">${localStorage.getItem('zpopcorn-default-volume') || 80}%</span>
          <span></span>
        </div>
      </div>

      <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px;">
        <h3 style="font-weight: 600; margin-bottom: 16px;">متابعة المشاهدة</h3>
        <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 12px;">
          <label style="font-size: 14px; min-width: 180px;">عتبة متابعة المشاهدة</label>
          <input type="range" id="continue-threshold" min="1" max="20" value="${localStorage.getItem('zpopcorn-continue-threshold') || 5}" style="flex: 1; max-width: 200px;" />
          <span id="threshold-value" style="min-width: 40px; font-weight: 600;">${localStorage.getItem('zpopcorn-continue-threshold') || 5}%</span>
        </div>
        <div style="font-size: 12px; color: var(--color-text-muted);">إذا شاهدت أقل من هذه النسبة، سيبدأ من البداية</div>
      </div>

      <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px;">
        <h3 style="font-weight: 600; margin-bottom: 12px;">جودة التشغيل</h3>
        <select id="quality-pref" class="input" style="max-width: 300px;">
          <option value="auto">تلقائي (حسب الشبكة)</option>
          <option value="4k">4K</option>
          <option value="1080p">1080p</option>
          <option value="720p">720p</option>
          <option value="480p">480p</option>
        </select>
      </div>
    </div>
 `;

 bindToggles(div);
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

function createSubtitlesSection() {
 const div = document.createElement('div');
 div.innerHTML = `
 ${playerPhaseBanner()}
    <h2 style="font-size: 1.5rem; font-weight: 600; margin-bottom: 20px;">إعدادات الترجمة</h2>
    <div style="display: grid; gap: 20px;">
      <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px;">
        <h3 style="font-weight: 600; margin-bottom: 16px;">المظهر</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
          <div>
            <label style="font-size: 13px; font-weight: 500; margin-bottom: 6px; display: block;">حجم الخط</label>
            <select id="sub-size" class="input">
              <option value="small">صغير</option>
              <option value="medium" selected>متوسط</option>
              <option value="large">كبير</option>
              <option value="x-large">كبير جداً</option>
            </select>
          </div>
          <div>
            <label style="font-size: 13px; font-weight: 500; margin-bottom: 6px; display: block;">الخط</label>
            <select id="sub-font" class="input">
              <option value="default">افتراضي</option>
              <option value="noto">Noto Sans Arabic</option>
              <option value="amiri">Amiri</option>
              <option value="cairo">Cairo</option>
            </select>
          </div>
          <div>
            <label style="font-size: 13px; font-weight: 500; margin-bottom: 6px; display: block;">اللون</label>
            <input type="color" id="sub-color" value="#ffffff" class="input" style="height: 40px; padding: 4px;">
          </div>
          <div>
            <label style="font-size: 13px; font-weight: 500; margin-bottom: 6px; display: block;">الخلفية</label>
            <input type="color" id="sub-bg" value="#000000" class="input" style="height: 40px; padding: 4px;">
          </div>
        </div>
      </div>

      <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px;">
        <h3 style="font-weight: 600; margin-bottom: 16px;">الموضع والتوقيت</h3>
        <div style="display: grid; gap: 16px;">
          <div style="display: flex; align-items: center; gap: 16px;">
            <label style="min-width: 120px; font-size: 14px;">الموضع العمودي</label>
            <input type="range" id="sub-position" min="0" max="100" value="90" style="flex: 1; max-width: 200px;" />
            <span style="min-width: 40px;">90%</span>
          </div>
          <div style="display: flex; align-items: center; gap: 16px;">
            <label style="min-width: 120px; font-size: 14px;">تأخير الترجمة (ms)</label>
            <input type="range" id="sub-delay" min="-5000" max="5000" value="0" step="100" style="flex: 1; max-width: 200px;" />
            <span id="delay-val" style="min-width: 60px;">0ms</span>
          </div>
        </div>
      </div>

      <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px;">
        <h3 style="font-weight: 600; margin-bottom: 12px;">اللغة الافتراضية</h3>
        <select id="sub-lang" class="input" style="max-width: 300px;">
          <option value="ar">العربية</option>
          <option value="en">English</option>
          <option value="auto">تلقائي</option>
          <option value="none">بدون</option>
        </select>
      </div>
    </div>
 `;

 div.querySelector('#sub-delay').addEventListener('input', (e) => {
 div.querySelector('#delay-val').textContent = e.target.value + 'ms';
 });

 return div;
}

function createAudioSection() {
 const div = document.createElement('div');
 div.innerHTML = `
 ${playerPhaseBanner()}
    <h2 style="font-size: 1.5rem; font-weight: 600; margin-bottom: 20px;">إعدادات الصوت</h2>
    <div style="display: grid; gap: 20px;">
      <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px;">
        <h3 style="font-weight: 600; margin-bottom: 16px;">المسارات الصوتية</h3>
        <div style="display: grid; gap: 16px;">
          <div>
            <label style="font-size: 13px; font-weight: 500; margin-bottom: 6px; display: block;">اللغة الافتراضية</label>
            <select id="audio-lang" class="input" style="max-width: 300px;">
              <option value="ar">العربية</option>
              <option value="en" selected>English</option>
              <option value="original">اللغة الأصلية</option>
              <option value="auto">تلقائي</option>
            </select>
          </div>
          <div style="display: flex; align-items: center; gap: 16px;">
            <label style="min-width: 140px; font-size: 14px;">تأخير الصوت (ms)</label>
            <input type="range" id="audio-delay" min="-5000" max="5000" value="0" step="100" style="flex: 1; max-width: 200px;" />
            <span id="audio-delay-val" style="min-width: 60px;">0ms</span>
          </div>
        </div>
      </div>

      <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px;">
        <h3 style="font-weight: 600; margin-bottom: 16px;">التحكم</h3>
        <div style="display: grid; gap: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 14px;">تطبيع الصوت</span>
            <input type="checkbox" id="audio-normalize" />
          </div>
          <div>
            <label style="font-size: 13px; margin-bottom: 6px; display: block;">قنوات الصوت</label>
            <select id="audio-channels" class="input" style="max-width: 300px;">
              <option value="auto">تلقائي</option>
              <option value="stereo">ستيريو</option>
              <option value="5.1">5.1</option>
              <option value="7.1">7.1</option>
            </select>
          </div>
        </div>
      </div>
    </div>
 `;

 div.querySelector('#audio-delay').addEventListener('input', (e) => {
 div.querySelector('#audio-delay-val').textContent = e.target.value + 'ms';
 });

 return div;
}

function createLibrarySection() {
 const div = document.createElement('div');
 div.innerHTML = `
    <h2 style="font-size: 1.5rem; font-weight: 600; margin-bottom: 20px;">إعدادات المكتبة</h2>
    <div style="display: grid; gap: 20px;">
      <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px;">
        <h3 style="font-weight: 600; margin-bottom: 16px;">مصادر المكتبة</h3>
        <div id="library-sources" style="display: grid; gap: 8px; margin-bottom: 16px;">
          <div style="padding: 12px; background: var(--color-card); border: 1px solid var(--color-border); border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-weight: 500;">المجلد الافتراضي</div>
              <div style="font-size: 12px; color: var(--color-text-muted);">/home/user/Videos</div>
            </div>
            <span style="font-size: 11px; padding: 2px 8px; background: #10b981; color: white; border-radius: 12px;">نشط</span>
          </div>
        </div>
        <button class="btn btn-secondary" id="add-source">+ إضافة مصدر</button>
      </div>

      <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px;">
        <h3 style="font-weight: 600; margin-bottom: 16px;">العرض</h3>
        <div style="display: grid; gap: 16px;">
          <div>
            <label style="font-size: 13px; font-weight: 500; margin-bottom: 6px; display: block;">طريقة العرض الافتراضية</label>
            <select class="input" style="max-width: 300px;">
              <option value="grid">شبكة</option>
              <option value="list">قائمة</option>
              <option value="large-grid">شبكة كبيرة</option>
            </select>
          </div>
          <div>
            <label style="font-size: 13px; font-weight: 500; margin-bottom: 6px; display: block;">ترتيب افتراضي</label>
            <select class="input" style="max-width: 300px;">
              <option value="date-added">تاريخ الإضافة</option>
              <option value="title">العنوان</option>
              <option value="year">السنة</option>
              <option value="rating">التقييم</option>
            </select>
          </div>
        </div>
      </div>

      <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px;">
        <h3 style="font-weight: 600; margin-bottom: 16px;">الأرشيف</h3>
        <p style="font-size: 13px; color: var(--color-text-secondary); margin-bottom: 12px;">الأرشيف لا يحذف الملفات، فقط ينظمها منطقياً</p>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-secondary" onclick="window.location.hash='#/library'">عرض الأرشيف</button>
          <button class="btn btn-ghost">إعدادات الأرشفة</button>
        </div>
      </div>
    </div>
 `;
 return div;
}

function createScannerSection() {
 const div = document.createElement('div');
 div.innerHTML = `
    <h2 style="font-size: 1.5rem; font-weight: 600; margin-bottom: 20px;">إعدادات الفاحص</h2>
    <div style="display: grid; gap: 20px;">
 ${createToggle('scan-startup', 'فحص عند بدء التشغيل', 'فحص المكتبة تلقائياً عند فتح التطبيق', false)}
 ${createToggle('watch-folders', 'مراقبة المجلدات', 'فحص تلقائي عند إضافة ملفات جديدة', true)}
 ${createToggle('incremental-scan', 'فحص تدريجي', 'فحص الملفات الجديدة/المتغيرة فقط', true)}
 ${createToggle('parallel-scan', 'فحص متوازي', 'استخدام معالجة متوازية (أسرع)', true)}
      
      <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px;">
        <h3 style="font-weight: 600; margin-bottom: 16px;">الجدولة</h3>
        <div style="display: grid; gap: 12px;">
          <div>
            <label style="font-size: 13px; font-weight: 500; margin-bottom: 6px; display: block;">فحص مجدول</label>
            <select id="scan-schedule" class="input" style="max-width: 300px;">
              <option value="manual">يدوي فقط</option>
              <option value="hourly">كل ساعة</option>
              <option value="daily" selected>يومياً</option>
              <option value="weekly">أسبوعياً</option>
            </select>
          </div>
          <div>
            <label style="font-size: 13px; font-weight: 500; margin-bottom: 6px; display: block;">أنواع الملفات</label>
            <input type="text" value="mp4, mkv, avi, mov, mp3, flac, m4a" class="input" style="max-width: 400px;" />
            <div style="font-size: 11px; color: var(--color-text-muted); margin-top: 4px;">مفصولة بفواصل</div>
          </div>
        </div>
      </div>

      <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px;">
        <h3 style="font-weight: 600; margin-bottom: 12px;">حالة الفحص</h3>
        <div style="display: grid; gap: 8px; font-size: 13px;">
          <div style="display: flex; justify-content: space-between;"><span>آخر فحص:</span><span>منذ ساعتين</span></div>
          <div style="display: flex; justify-content: space-between;"><span>الملفات المفحوصة:</span><span>1,234</span></div>
          <div style="display: flex; justify-content: space-between;"><span>المفقودة:</span><span>3</span></div>
        </div>
        <button class="btn btn-primary" style="margin-top: 16px; width: 100%;">فحص الآن</button>
      </div>
    </div>
 `;
 bindToggles(div);
 return div;
}

async function createTMDBSection() {
 const div = document.createElement('div');
 const apiKey = localStorage.getItem('zpopcorn-tmdb-api-key') || '';
 let stats = { requests: 0, cacheHits: 0, cache: { metadata: { size: 0 }, search: { size: 0 }, general: { size: 0 } } };
 try {
 const { tmdbClient } = await import('../services/tmdb/TMDBClient.js');
 stats = tmdbClient.getStats();
 } catch {}
  
 div.innerHTML = `
    <h2 style="font-size: 1.5rem; font-weight: 600; margin-bottom: 20px;">إعدادات TMDB</h2>
    
    <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px; margin-bottom: 20px;">
      <h3 style="font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
        <span style="width: 10px; height: 10px; background: #10b981; border-radius: 50%; display: inline-block; animation: pulse 2s infinite;"></span>
 حالة الاتصال
      </h3>
      <div style="display: grid; gap: 8px; font-size: 14px;">
        <div style="display: flex; justify-content: space-between;"><span>المنطقة:</span><span style="font-weight: 500;">${localStorage.getItem('zpopcorn-region') || 'SA'}</span></div>
        <div style="display: flex; justify-content: space-between;"><span>اللغة:</span><span style="font-weight: 500;">${localStorage.getItem('zpopcorn-language') || 'ar-SA'}</span></div>
        <div style="display: flex; justify-content: space-between;"><span>الطلبات:</span><span class="number-ltr" style="font-family: monospace;">${stats.requests}</span></div>
        <div style="display: flex; justify-content: space-between;"><span>إصابات التخزين المؤقت:</span><span class="number-ltr" style="font-family: monospace;">${stats.cacheHits}</span></div>
        <div style="display: flex; justify-content: space-between;"><span>معدل الإصابة:</span><span>${stats.requests ? Math.round((stats.cacheHits / (stats.requests + stats.cacheHits)) * 100) : 0}%</span></div>
      </div>
      <button id="test-connection" class="btn btn-secondary" style="margin-top: 16px;"> اختبار الاتصال</button>
      <div id="connection-result" style="margin-top: 12px; font-size: 13px;"></div>
    </div>
    
    <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px; margin-bottom: 20px;">
      <h3 style="font-weight: 600; margin-bottom: 12px;"> مفتاح TMDB API</h3>
      <p style="font-size: 13px; color: var(--color-text-secondary); margin-bottom: 12px;">احصل على مفتاح مجاني من <a href="https://www.themoviedb.org/settings/api" target="_blank" style="color: var(--color-accent);">themoviedb.org</a> - مطلوب لبيانات حقيقية</p>
      <div style="display: flex; gap: 8px;">
        <input type="password" id="api-key-input" class="input" placeholder="أدخل مفتاح TMDB API" value="${apiKey}" style="flex: 1;" />
        <button id="save-api-key" class="btn btn-primary">حفظ</button>
        <button id="toggle-api-key" class="btn btn-ghost"></button>
      </div>
      <div style="font-size: 11px; color: var(--color-text-muted); margin-top: 8px;">المفتاح الحالي: ${apiKey ? apiKey.slice(0, 8) + '...' + apiKey.slice(-4) : 'غير محدد (يستخدم مفتاح تجريبي)'} • التخزين: localStorage</div>
    </div>
    
    <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px;">
      <h3 style="font-weight: 600; margin-bottom: 12px;">التخزين المؤقت</h3>
      <div style="display: grid; gap: 8px; font-size: 14px; margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; padding: 8px; background: var(--color-card); border-radius: 6px;"><span>البيانات الوصفية:</span><span style="font-weight: 600;">${stats.cache.metadata.size} عنصر</span></div>
        <div style="display: flex; justify-content: space-between; padding: 8px; background: var(--color-card); border-radius: 6px;"><span>البحث:</span><span style="font-weight: 600;">${stats.cache.search.size} عنصر</span></div>
        <div style="display: flex; justify-content: space-between; padding: 8px; background: var(--color-card); border-radius: 6px;"><span>عام:</span><span style="font-weight: 600;">${stats.cache.general.size} عنصر</span></div>
      </div>
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <button id="clear-tmdb-cache" class="btn btn-secondary">مسح تخزين TMDB</button>
        <button id="clear-expired" class="btn btn-ghost">مسح المنتهي فقط</button>
      </div>
      <div style="font-size: 11px; color: var(--color-text-muted); margin-top: 12px;">TTL: البيانات 6 ساعات، الصور 30 يوم، البحث 1 ساعة • إستراتيجية: Stale-While-Revalidate</div>
    </div>
 `;

 div.querySelector('#test-connection').addEventListener('click', async () => {
 const resultDiv = div.querySelector('#connection-result');
 resultDiv.innerHTML = '<span style="color: var(--color-text-secondary);">جاري الاختبار...</span>';
 try {
 const { tmdbClient } = await import('../services/tmdb/TMDBClient.js');
 const config = await tmdbClient.getConfiguration();
 if (config) {
 resultDiv.innerHTML = '<span style="color: #10b981; font-weight: 600;">TMDB متصل بنجاح</span> • الصور: ' + (config.images?.secure_base_url || 'متاح');
 } else {
 resultDiv.innerHTML = '<span style="color: #ef4444;">فشل الاتصال</span>';
 }
 } catch (e) {
 resultDiv.innerHTML = `<span style="color: #ef4444;">فشل: ${e.message}</span>`;
 }
 });

 div.querySelector('#save-api-key').addEventListener('click', async () => {
 const key = div.querySelector('#api-key-input').value.trim();
 if (key) {
 localStorage.setItem('zpopcorn-tmdb-api-key', key);
 try {
 const { tmdbClient } = await import('../services/tmdb/TMDBClient.js');
 tmdbClient.updateApiKey(key);
 } catch {}
 window.dispatchEvent(new CustomEvent('showtoast', { detail: { type: 'success', message: 'تم حفظ مفتاح TMDB - إعادة تحميل...' } }));
 setTimeout(() => window.location.reload(), 800);
 }
 });

 div.querySelector('#toggle-api-key').addEventListener('click', () => {
 const input = div.querySelector('#api-key-input');
 input.type = input.type === 'password' ? 'text' : 'password';
 });

 div.querySelector('#clear-tmdb-cache').addEventListener('click', async () => {
 try {
 const { tmdbClient } = await import('../services/tmdb/TMDBClient.js');
 tmdbClient.clearCache();
 window.dispatchEvent(new CustomEvent('showtoast', { detail: { type: 'success', message: 'تم مسح تخزين TMDB' } }));
 } catch {}
 });

 return div;
}

function createRecommendationsSection() {
 const div = document.createElement('div');
 div.innerHTML = `
    <h2 style="font-size: 1.5rem; font-weight: 600; margin-bottom: 20px;">إعدادات التوصيات</h2>
    <div style="display: grid; gap: 20px;">
      <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px;">
        <h3 style="font-weight: 600; margin-bottom: 16px;">شدة التوصيات</h3>
        <div style="display: grid; gap: 16px;">
          <div>
            <label style="font-size: 13px; font-weight: 500; margin-bottom: 6px; display: block;">مستوى الاكتشاف</label>
            <select id="discovery-level" class="input" style="max-width: 300px;">
              <option value="conservative">محافظ (أعمال مشابهة فقط)</option>
              <option value="balanced" selected>متوازن</option>
              <option value="adventurous">مغامر (استكشاف أنواع جديدة)</option>
            </select>
            <div style="font-size: 11px; color: var(--color-text-muted); margin-top: 4px;">يتحكم في مدى تنوع التوصيات</div>
          </div>
          <div>
            <label style="font-size: 13px; font-weight: 500; margin-bottom: 6px; display: block;">الحد الأدنى للتقييم</label>
            <input type="range" id="min-rating" min="0" max="10" step="0.5" value="6" style="max-width: 300px; width: 100%;" />
            <span id="min-rating-val" style="margin-right: 8px; font-weight: 600;">6.0</span>
          </div>
        </div>
      </div>

      <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px;">
        <h3 style="font-weight: 600; margin-bottom: 16px;">الفلاتر</h3>
        <div style="display: grid; gap: 12px;">
 ${createToggle('hide-watched', 'إخفاء ما شاهدته', 'عدم عرض الأعمال المكتملة في التوصيات', false)}
 ${createToggle('hide-disliked', 'إخفاء ما لم يعجبك', 'عدم عرض الأعمال ذات التقييم المنخفض', false)}
 ${createToggle('include-unfinished', 'تضمين غير المكتمل', 'عرض الأعمال غير المكتملة', true)}
        </div>
      </div>

      <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px;">
        <h3 style="font-weight: 600; margin-bottom: 12px;">الأنواع المستبعدة</h3>
        <p style="font-size: 12px; color: var(--color-text-muted); margin-bottom: 12px;">اختر الأنواع التي لا تريد ظهورها في التوصيات</p>
        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
 ${['أكشن', 'كوميديا', 'رعب', 'رومانسي', 'خيال علمي', 'دراما'].map(g => `
            <label style="display: flex; align-items: center; gap: 6px; padding: 6px 12px; background: var(--color-card); border: 1px solid var(--color-border); border-radius: 16px; font-size: 12px; cursor: pointer;">
              <input type="checkbox" data-genre="${g}" /> ${g}
            </label>
 `).join('')}
        </div>
      </div>

      <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px;">
        <h3 style="font-weight: 600; margin-bottom: 12px;">ملف الذوق</h3>
        <div style="font-size: 13px; color: var(--color-text-secondary); margin-bottom: 12px;">يتم بناء ملف ذوقك تلقائياً من سلوك المشاهدة</div>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-secondary" onclick="window.location.hash='#/analytics'">عرض ملف الذوق</button>
          <button class="btn btn-ghost" id="reset-taste">إعادة تعيين</button>
        </div>
      </div>
    </div>
 `;

 bindToggles(div);
 div.querySelector('#min-rating').addEventListener('input', (e) => {
 div.querySelector('#min-rating-val').textContent = parseFloat(e.target.value).toFixed(1);
 });

 return div;
}

function createNotificationsSection() {
 const div = document.createElement('div');
 let prefs = {};
 try {
 prefs = notificationService.getPreferences();
 } catch {
 prefs = {
 NEW_EPISODE: true, NEW_LIBRARY_CONTENT: true, RECOMMENDATION: true,
 RESUME_REMINDER: false, SCAN_COMPLETED: true, NEW_EPISODES_FOUND: true,
 FILE_MISSING: true, TMDB_UPDATED: false, WATCHLIST_AVAILABLE: true,
 ACHIEVEMENT: true, BACKUP_COMPLETED: true, BACKUP_FAILED: true
 };
 }
  
 div.innerHTML = `
    <h2 style="font-size: 1.5rem; font-weight: 600; margin-bottom: 20px;">إعدادات الإشعارات</h2>
    <div style="display: grid; gap: 12px;">
 ${Object.entries(prefs).map(([type, enabled]) => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px;">
          <div style="flex: 1;">
            <div style="font-weight: 500; font-size: 14px; margin-bottom: 2px;">${getNotificationTypeName(type)}</div>
            <div style="font-size: 11px; color: var(--color-text-muted);">${getNotificationTypeDesc(type)}</div>
          </div>
          <label style="position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0; cursor: pointer;">
            <input type="checkbox" data-type="${type}" ${enabled ? 'checked' : ''} style="opacity: 0; width: 0; height: 0;">
            <span class="toggle-slider" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background: ${enabled ? 'var(--color-accent)' : 'var(--color-border)'}; border-radius: 24px; transition: 0.2s;"></span>
          </label>
        </div>
 `).join('')}
    </div>
    <div style="margin-top: 20px; display: flex; gap: 8px;">
      <button id="enable-all" class="btn btn-secondary">تفعيل الكل</button>
      <button id="disable-all" class="btn btn-ghost">تعطيل الكل</button>
      <button id="test-notif" class="btn btn-ghost">إشعار تجريبي</button>
    </div>
 `;

 div.querySelectorAll('input[type="checkbox"]').forEach(cb => {
 cb.addEventListener('change', (e) => {
 const type = e.target.dataset.type;
 try {
 notificationService.setPreference(type, e.target.checked);
 } catch {}
 e.target.nextElementSibling.style.background = e.target.checked ? 'var(--color-accent)' : 'var(--color-border)';
 });
 });

 div.querySelector('#enable-all').addEventListener('click', () => {
 div.querySelectorAll('input[type="checkbox"]').forEach(cb => {
 cb.checked = true;
 cb.nextElementSibling.style.background = 'var(--color-accent)';
 try { notificationService.setPreference(cb.dataset.type, true); } catch {}
 });
 });

 div.querySelector('#disable-all').addEventListener('click', () => {
 div.querySelectorAll('input[type="checkbox"]').forEach(cb => {
 cb.checked = false;
 cb.nextElementSibling.style.background = 'var(--color-border)';
 try { notificationService.setPreference(cb.dataset.type, false); } catch {}
 });
 });

 div.querySelector('#test-notif').addEventListener('click', () => {
 try {
 notificationService.create({ type: 'RECOMMENDATION', title: 'إشعار تجريبي', message: 'هذا إشعار تجريبي من zPopcorn' });
 } catch {}
 window.dispatchEvent(new CustomEvent('showtoast', { detail: { type: 'info', message: 'تم إرسال إشعار تجريبي' } }));
 });

 return div;
}

function getNotificationTypeName(type) {
 const names = {
 NEW_EPISODE: 'حلقات جديدة', NEW_LIBRARY_CONTENT: 'محتوى جديد في المكتبة', RECOMMENDATION: 'توصيات ذكية',
 RESUME_REMINDER: 'تذكير المتابعة', SCAN_COMPLETED: 'اكتمال الفحص', NEW_EPISODES_FOUND: 'حلقات جديدة مكتشفة',
 FILE_MISSING: 'ملفات مفقودة', TMDB_UPDATED: 'تحديثات TMDB', WATCHLIST_AVAILABLE: 'توفر قائمة المشاهدة',
 ACHIEVEMENT: 'الإنجازات', BACKUP_COMPLETED: 'اكتمال النسخ الاحتياطي', BACKUP_FAILED: 'فشل النسخ الاحتياطي'
 };
 return names[type] || type;
}

function getNotificationTypeDesc(type) {
 const descs = {
 NEW_EPISODE: 'عند توفر حلقات جديدة لمسلسلات تتابعها', NEW_LIBRARY_CONTENT: 'عند إضافة محتوى جديد',
 RECOMMENDATION: 'توصيات جديدة بناءً على ذوقك', RESUME_REMINDER: 'تذكير لمتابعة ما بدأته',
 SCAN_COMPLETED: 'عند اكتمال فحص المكتبة', NEW_EPISODES_FOUND: 'عند اكتشاف حلقات جديدة',
 FILE_MISSING: 'عند فقدان ملفات', TMDB_UPDATED: 'عند تحديث بيانات TMDB',
 WATCHLIST_AVAILABLE: 'عند توفر محتوى من قائمة المشاهدة', ACHIEVEMENT: 'عند فتح إنجازات جديدة',
 BACKUP_COMPLETED: 'عند اكتمال النسخ الاحتياطي', BACKUP_FAILED: 'عند فشل النسخ الاحتياطي'
 };
 return descs[type] || '';
}


function createPrivacySection() {
 const div = document.createElement('div');
 div.innerHTML = `
    <h2 style="font-size: 1.5rem; font-weight: 600; margin-bottom: 20px;">الخصوصية والأمان</h2>
    <div style="display: grid; gap: 20px;">
      <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px;">
        <h3 style="font-weight: 600; margin-bottom: 12px;">مبادئ الخصوصية</h3>
        <div style="font-size: 13px; color: var(--color-text-secondary); line-height: 1.8;">
          <p style="margin-bottom: 12px;">zPopcorn هو <strong>Local-First</strong> - جميع بياناتك الشخصية تبقى على جهازك:</p>
          <ul style="list-style: disc; padding-right: 16px; display: grid; gap: 4px;">
            <li>سجل المشاهدة - محلي فقط</li>
            <li>التقييمات والمراجعات - محلي فقط</li>
            <li>قوائم المشاهدة - محلي فقط</li>
            <li>ملف الذوق والتفضيلات - محلي فقط</li>
            <li>الإحصائيات والإنجازات - محلي فقط</li>
          </ul>
          <p style="margin-top: 12px; padding: 12px; background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.2); border-radius: 8px;">
 TMDB يستخدم فقط للبيانات الوصفية العامة (عناوين، صور، تقييمات عامة)<br>
 لا يتم إرسال سلوك المشاهدة أو البيانات الشخصية إلى TMDB أو أي خدمة خارجية
          </p>
        </div>
      </div>

      <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px;">
        <h3 style="font-weight: 600; margin-bottom: 16px;">الإعدادات</h3>
        <div style="display: grid; gap: 12px;">
 ${createToggle('analytics', 'جمع بيانات التحليلات المحلية', 'حفظ الإحصائيات محلياً (لا يتم إرسالها)', true)}
 ${createToggle('error-reporting', 'تقارير الأخطاء', 'إرسال تقارير الأخطاء المجهولة', false)}
 ${createToggle('usage-stats', 'إحصائيات الاستخدام', 'مساعدتنا على التحسين', false)}
        </div>
      </div>

      <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px;">
        <h3 style="font-weight: 600; margin-bottom: 12px;">إدارة البيانات</h3>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button class="btn btn-secondary" id="export-data"> تصدير جميع بياناتي</button>
          <button class="btn btn-ghost" id="view-security-logs"> سجل الأمان</button>
          <button class="btn btn-ghost" id="clear-analytics">مسح التحليلات</button>
        </div>
      </div>
    </div>
 `;

 bindToggles(div);
  
 div.querySelector('#export-data').addEventListener('click', async () => {
 try {
 const data = await db.exportAll();
 const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = `zpopcorn-data-export-${new Date().toISOString().split('T')[0]}.json`;
 a.click();
 URL.revokeObjectURL(url);
 window.dispatchEvent(new CustomEvent('showtoast', { detail: { type: 'success', message: 'تم تصدير البيانات' } }));
 } catch (e) {
 window.dispatchEvent(new CustomEvent('showtoast', { detail: { type: 'error', message: `فشل التصدير: ${e.message}` } }));
 }
 });

 return div;
}

async function createBackupSection() {
 const div = document.createElement('div');
 let stats = {};
 try { stats = await db.getStats(); } catch {}
  
 div.innerHTML = `
    <h2 style="font-size: 1.5rem; font-weight: 600; margin-bottom: 20px;">النسخ الاحتياطي والاستعادة</h2>
    
    <div style="display: grid; gap: 20px;">
      <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px;">
        <h3 style="font-weight: 600; margin-bottom: 12px;">إنشاء نسخ احتياطي</h3>
        <p style="font-size: 13px; color: var(--color-text-secondary); margin-bottom: 16px;">احفظ جميع بياناتك في ملف JSON آمن. جميع البيانات محلية.</p>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px;">
          <button id="backup-full" class="btn btn-primary">نسخ كامل</button>
          <button id="backup-settings" class="btn btn-secondary">الإعدادات فقط</button>
          <button id="backup-watchlists" class="btn btn-secondary"> قوائم المشاهدة</button>
          <button id="backup-history" class="btn btn-secondary"> سجل المشاهدة</button>
          <button id="backup-ratings" class="btn btn-secondary">التقييمات</button>
        </div>
        <div style="font-size: 11px; color: var(--color-text-muted); margin-top: 12px;">التنسيق: JSON مع schemaVersion وفحص سلامة • الملف: zpopcorn-backup-YYYY-MM-DD.json</div>
      </div>
      
      <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px;">
        <h3 style="font-weight: 600; margin-bottom: 12px;">استعادة نسخ احتياطي</h3>
        <p style="font-size: 13px; color: var(--color-text-secondary); margin-bottom: 16px;">استعد بياناتك من ملف نسخ احتياطي. سيتم إنشاء نسخة آمنة تلقائياً قبل الاستعادة.</p>
        <div style="background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.2); border-radius: 8px; padding: 12px; margin-bottom: 16px; font-size: 12px;">
          <strong>عملية آمنة:</strong><br>
 1. إنشاء نسخة أمان تلقائية<br>
 2. التحقق من صحة الملف<br>
 3. فحص إصدار المخطط<br>
 4. الترحيل إذا لزم<br>
 5. الاستعادة<br>
 6. التحقق من السلامة<br>
 7. في حالة الفشل: استرجاع تلقائي
        </div>
        <input type="file" id="restore-file" accept=".json" style="margin-bottom: 12px; padding: 8px; border: 1px solid var(--color-border); border-radius: 8px; width: 100%;" />
        <div id="restore-info" style="font-size: 13px; margin-bottom: 12px;"></div>
        <button id="restore-btn" class="btn btn-primary" disabled>استعادة</button>
      </div>
      
      <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px;">
        <h3 style="font-weight: 600; margin-bottom: 12px;">إحصائيات البيانات</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; font-size: 13px;">
 ${Object.entries(stats).map(([store, count]) => `
            <div style="display: flex; justify-content: space-between; padding: 10px; background: var(--color-card); border: 1px solid var(--color-border); border-radius: 8px;">
              <span style="font-size: 12px;">${store}</span>
              <span style="font-weight: 700; font-family: monospace;">${count}</span>
            </div>
 `).join('') || '<div style="color: var(--color-text-muted);">لا توجد بيانات</div>'}
        </div>
      </div>

      <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px;">
        <h3 style="font-weight: 600; margin-bottom: 12px;">النسخ التلقائي</h3>
        <div style="display: grid; gap: 12px;">
 ${createToggle('auto-backup', 'نسخ احتياطي تلقائي', 'إنشاء نسخة يومياً تلقائياً', false)}
          <div>
            <label style="font-size: 13px; font-weight: 500; margin-bottom: 6px; display: block;">موقع النسخ</label>
            <input type="text" value="~/Documents/zPopcorn/Backups" class="input" style="max-width: 400px;" readonly />
          </div>
        </div>
      </div>
    </div>
 `;

 bindToggles(div);

 div.querySelector('#backup-full').addEventListener('click', () => backupManager.exportBackup('full'));
 div.querySelector('#backup-settings').addEventListener('click', () => backupManager.exportBackup('settings'));
 div.querySelector('#backup-watchlists').addEventListener('click', () => backupManager.exportBackup('watchlists'));
 div.querySelector('#backup-history').addEventListener('click', () => backupManager.exportBackup('watchHistory'));
 div.querySelector('#backup-ratings').addEventListener('click', () => backupManager.exportBackup('ratings'));

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
          <div style="font-weight: 600; margin-bottom: 8px; color: #10b981;">✓ ملف صالح</div>
          <div style="display: grid; gap: 4px; font-size: 12px; font-family: monospace;">
            <div>الإصدار: ${info.schemaVersion} | التطبيق: ${info.appVersion || 'غير محدد'}</div>
            <div>التاريخ: ${new Date(info.createdAt || info.timestamp).toLocaleString('ar-SA')}</div>
            <div>النوع: ${info.type || 'full'} | الحجم: ${(info.size / 1024).toFixed(1)} KB</div>
            <div>المتاجر: ${Object.keys(info.stores || {}).join('، ')}</div>
          </div>
        </div>
 `;
 div.querySelector('#restore-btn').disabled = false;
 } catch (error) {
 div.querySelector('#restore-info').innerHTML = `<div style="color: var(--color-danger); background: rgba(239,68,68,0.1); padding: 12px; border-radius: 8px; border: 1px solid rgba(239,68,68,0.2);">خطأ: ${error.message}</div>`;
 div.querySelector('#restore-btn').disabled = true;
 }
 });

 div.querySelector('#restore-btn').addEventListener('click', async () => {
 if (!pendingBackup) return;
 if (confirm('هل أنت متأكد من الاستعادة؟ سيتم استبدال البيانات الحالية. سيتم إنشاء نسخة أمان تلقائياً.')) {
 try {
 await backupManager.restoreBackup(pendingBackup);
 window.dispatchEvent(new CustomEvent('showtoast', { detail: { type: 'success', message: 'تمت الاستعادة بنجاح' } }));
 } catch (error) {
 window.dispatchEvent(new CustomEvent('showtoast', { detail: { type: 'error', message: `فشل الاستعادة: ${error.message}` } }));
 }
 }
 });

 return div;
}

function createKeyboardSection() {
 const div = document.createElement('div');
 div.innerHTML = `
    <h2 style="font-size: 1.5rem; font-weight: 600; margin-bottom: 20px;">اختصارات لوحة المفاتيح</h2>
    <div style="display: grid; gap: 20px;">
      <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px;">
        <h3 style="font-weight: 600; margin-bottom: 16px;">التشغيل</h3>
        <div style="display: grid; gap: 8px; font-size: 13px;">
 ${createShortcut('Space', 'تشغيل/إيقاف')}
 ${createShortcut('N', 'الحلقة التالية')}
 ${createShortcut('P', 'الحلقة السابقة')}
 ${createShortcut('S', 'قائمة الترجمة')}
 ${createShortcut('A', 'قائمة الصوت')}
 ${createShortcut('F', 'ملء الشاشة')}
 ${createShortcut('M', 'كتم الصوت')}
 ${createShortcut('← →', 'تقديم/إرجاع 10 ثوان')}
 ${createShortcut('↑ ↓', 'رفع/خفض الصوت')}
        </div>
      </div>

      <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px;">
        <h3 style="font-weight: 600; margin-bottom: 16px;"> التنقل</h3>
        <div style="display: grid; gap: 8px; font-size: 13px;">
 ${createShortcut('Ctrl + K', 'البحث السريع')}
 ${createShortcut('Esc', 'إغلاق النوافذ')}
 ${createShortcut('/', 'التركيز على البحث')}
 ${createShortcut('G then H', 'الذهاب للرئيسية')}
 ${createShortcut('G then M', 'الذهاب للأفلام')}
 ${createShortcut('G then T', 'الذهاب للمسلسلات')}
        </div>
      </div>

      <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px;">
        <h3 style="font-weight: 600; margin-bottom: 12px;">تخصيص</h3>
        <p style="font-size: 12px; color: var(--color-text-muted); margin-bottom: 12px;">يمكنك تخصيص الاختصارات قريباً</p>
        <button class="btn btn-secondary" disabled>تخصيص الاختصارات (قريباً)</button>
        <button class="btn btn-ghost" id="reset-shortcuts">إعادة تعيين للافتراضي</button>
      </div>
    </div>
 `;
 return div;
}

function createShortcut(keys, desc) {
 return `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: var(--color-card); border: 1px solid var(--color-border); border-radius: 8px;">
      <span>${desc}</span>
      <kbd style="padding: 4px 8px; background: var(--color-surface); border: 1px solid var(--color-border); border-bottom-width: 2px; border-radius: 4px; font-family: monospace; font-size: 11px; font-weight: 600;">${keys}</kbd>
    </div>
 `;
}

async function createAdvancedSection() {
 const div = document.createElement('div');
 let perfReport = null;
 try {
 perfReport = performanceManager.report();
 } catch {
 perfReport = { metrics: {}, bundle: {} };
 }

 div.innerHTML = `
    <h2 style="font-size: 1.5rem; font-weight: 600; margin-bottom: 20px;">الإعدادات المتقدمة</h2>
    <div style="display: grid; gap: 20px;">
      <div style="background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.3); border-radius: 12px; padding: 16px; font-size: 13px;">
        <strong>تحذير:</strong> هذه إعدادات متقدمة للمطورين. التغيير الخاطئ قد يؤثر على التطبيق.
      </div>

      <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px;">
        <h3 style="font-weight: 600; margin-bottom: 16px;">وضع المطور</h3>
        <div style="display: grid; gap: 12px;">
 ${createToggle('dev-mode', 'تفعيل وضع المطور', 'عرض سجلات إضافية وأدوات التطوير', localStorage.getItem('zpopcorn-dev-mode') === 'true')}
 ${createToggle('debug-panel', 'لوحة التصحيح', 'عرض لوحة معلومات التصحيح', false)}
 ${createToggle('console-logs', 'سجلات وحدة التحكم', 'حفظ السجلات في localStorage', false)}
        </div>
      </div>

      <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px;">
        <h3 style="font-weight: 600; margin-bottom: 16px;">الأداء</h3>
        <div style="display: grid; gap: 8px; font-size: 12px; font-family: monospace;">
          <div style="display: flex; justify-content: space-between; padding: 8px; background: var(--color-card); border-radius: 6px;"><span>FCP:</span><span>${perfReport.metrics.fcp ? perfReport.metrics.fcp.toFixed(2) + 'ms' : 'غير متاح'}</span></div>
          <div style="display: flex; justify-content: space-between; padding: 8px; background: var(--color-card); border-radius: 6px;"><span>LCP:</span><span>${perfReport.metrics.lcp ? perfReport.metrics.lcp.toFixed(2) + 'ms' : 'غير متاح'}</span></div>
          <div style="display: flex; justify-content: space-between; padding: 8px; background: var(--color-card); border-radius: 6px;"><span>CLS:</span><span>${perfReport.metrics.cls?.toFixed(4) || '0'}</span></div>
          <div style="display: flex; justify-content: space-between; padding: 8px; background: var(--color-card); border-radius: 6px;"><span>الذاكرة:</span><span>${perfReport.memory ? (perfReport.memory.used / 1024 / 1024).toFixed(1) + ' MB' : 'غير متاح'}</span></div>
        </div>
        <div style="display: flex; gap: 8px; margin-top: 16px;">
          <button class="btn btn-secondary" id="perf-report">تقرير أداء</button>
          <button class="btn btn-ghost" id="clear-perf">مسح المقاييس</button>
        </div>
      </div>

      <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px;">
        <h3 style="font-weight: 600; margin-bottom: 16px;"> قاعدة البيانات</h3>
        <div style="display: grid; gap: 8px; margin-bottom: 16px;">
          <button class="btn btn-secondary" id="check-integrity">فحص سلامة قاعدة البيانات</button>
          <button class="btn btn-secondary" id="vacuum-db">ضغط قاعدة البيانات</button>
          <button class="btn btn-ghost" id="export-db">تصدير قاعدة البيانات الخام</button>
        </div>
        <div id="db-check-result" style="font-size: 12px;"></div>
      </div>

      <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px;">
        <h3 style="font-weight: 600; margin-bottom: 12px;">الأمان</h3>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button class="btn btn-secondary" id="view-sec-logs">عرض سجلات الأمان</button>
          <button class="btn btn-ghost" id="clear-sec-logs">مسح سجلات الأمان</button>
        </div>
        <div id="sec-logs" style="margin-top: 12px; font-size: 11px; font-family: monospace; max-height: 200px; overflow-y: auto; background: var(--color-card); padding: 12px; border-radius: 8px; display: none;"></div>
      </div>
    </div>
 `;

 bindToggles(div);

 div.querySelector('#dev-mode').addEventListener('change', (e) => {
 localStorage.setItem('zpopcorn-dev-mode', e.target.checked);
 window.location.reload();
 });

 div.querySelector('#perf-report').addEventListener('click', () => {
 console.log('Performance Report:', performanceManager.report());
 window.dispatchEvent(new CustomEvent('showtoast', { detail: { type: 'info', message: 'تم طباعة تقرير الأداء في وحدة التحكم' } }));
 });

 div.querySelector('#check-integrity').addEventListener('click', async () => {
 const resultDiv = div.querySelector('#db-check-result');
 resultDiv.innerHTML = 'جاري الفحص...';
 try {
 const { MigrationManager } = await import('../services/storage/MigrationManager.js');
 const manager = new MigrationManager();
 const result = await manager.verifyIntegrity();
 resultDiv.innerHTML = `<div style="color: ${result.valid ? '#10b981' : '#ef4444'};">${result.valid ? 'قاعدة البيانات سليمة' : 'توجد مشاكل'} - ${JSON.stringify(result)}</div>`;
 } catch (e) {
 resultDiv.innerHTML = `<div style="color: #ef4444;">خطأ: ${e.message}</div>`;
 }
 });

 div.querySelector('#view-sec-logs').addEventListener('click', () => {
 const logsDiv = div.querySelector('#sec-logs');
 logsDiv.style.display = logsDiv.style.display === 'none' ? 'block' : 'none';
 try {
 const logs = JSON.parse(localStorage.getItem('zpopcorn-security-logs') || '[]');
 logsDiv.innerHTML = logs.length ? logs.map(l => `<div style="padding: 4px 0; border-bottom: 1px solid var(--color-border);">${new Date(l.timestamp).toLocaleString()} - ${l.event}: ${JSON.stringify(l.details)}</div>`).join('') : 'لا توجد سجلات';
 } catch {
 logsDiv.innerHTML = 'لا توجد سجلات';
 }
 });

 return div;
}

function createAboutSection() {
 const div = document.createElement('div');
 div.innerHTML = `
    <h2 style="font-size: 1.5rem; font-weight: 600; margin-bottom: 20px;">حول zPopcorn</h2>
    
    <div style="text-align: center; padding: 32px 0; border-bottom: 1px solid var(--color-border); margin-bottom: 24px;">
      <svg width="56" height="56" viewBox="0 0 48 48" style="margin-bottom:14px" aria-hidden="true"><defs><linearGradient id="zpmark" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8d7dff"/><stop offset="1" stop-color="#5343c9"/></linearGradient></defs><path d="M10 18c0-4 3-7 7-7h2l-2 6h4l3-9c4-1 8 1 9 5 1-3 4-4 6-3 3 1 4 5 2 7h1c3 0 5 2 5 5v2c0 7-5 12-12 12H19c-6 0-9-5-9-12v-6z" fill="url(#zpmark)"/><circle cx="19" cy="26" r="2.2" fill="#fff" opacity=".85"/><circle cx="27" cy="30" r="2.2" fill="#fff" opacity=".85"/><circle cx="33" cy="25" r="1.8" fill="#fff" opacity=".85"/></svg>
      <h2 style="font-size: 2.2rem; font-weight: 800; margin-bottom: 8px; background: linear-gradient(135deg, var(--color-accent), var(--color-accent-secondary)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">zPopcorn Ultimate</h2>
      <p style="color: var(--color-text-secondary); margin-bottom: 8px; font-size: 16px;">منصة الوسائط الذكية المتكاملة - مساعد شخصي ذكي</p>
      <p style="font-size: 13px; color: var(--color-text-muted);">الإصدار 2.0.0 • Production-Grade • Local-First • SA Default</p>
      <div style="display: inline-flex; gap: 8px; margin-top: 16px;">
        <span style="padding: 4px 12px; background: #10b981; color: white; border-radius: 16px; font-size: 11px; font-weight: 600;">✓ Production Ready</span>
        <span style="padding: 4px 12px; background: var(--color-accent); color: white; border-radius: 16px; font-size: 11px; font-weight: 600;">✓ Real TMDB</span>
        <span style="padding: 4px 12px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 16px; font-size: 11px;"> SA</span>
      </div>
    </div>
    
    <div style="display: grid; gap: 20px;">
      <div style="background: linear-gradient(135deg, rgba(139,92,246,0.1), rgba(6,182,214,0.1)); border: 1px solid rgba(139,92,246,0.2); border-radius: 12px; padding: 20px;">
        <h3 style="font-weight: 700; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">الرؤية</h3>
        <p style="font-size: 13px; color: var(--color-text-secondary); line-height: 1.8;">
 تحويل zPopcorn من مكتبة وسائط محلية ذكية إلى <strong>مساعد وسائط شخصي ذكي متكامل</strong> يفهم تفضيلاتك، يتنبأ بسلوك المشاهدة، ويقدم تجربة سينمائية فاخرة مع قدرة عمل كاملة دون اتصال.
        </p>
      </div>

      <div>
        <h3 style="font-weight: 600; margin-bottom: 12px;">المميزات الرئيسية</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 8px;">
 ${[
 'تكامل حقيقي مع TMDB API مع Cache و Rate Limit',
 '8 مظاهر احترافية تحول التطبيق بالكامل + منشئ مخصص',
 'محرك ذكاء: سلوك، ذوق، توصيات، بحث ذكي',
 'مساعد وسائط ذكي مع فهم النية والسياق',
 'مشغل احترافي mpv مع JSON IPC',
 'قوائم مشاهدة متقدمة مع سحب وإفلات',
 'نظام تقييم ومراجعات شخصية',
 'بحث متقدم مع لغة طبيعية',
 'إحصائيات: Heatmap, رحلة سينمائية, إنجازات, تنبؤات',
 'نسخ احتياطي واستعادة آمنة مع Rollback',
 'مكتبة متقدمة: حقب، سلاسل، مجموعات ذكية، أنواع، دول، جوائز',
 'مركز صحة المكتبة، مكررات، مفقود، تخزين، قيادة',
 'مشاهدة جماعية مع Socket.IO ومزامنة',
 'أمان: تحقق، تنظيف، حماية XSS، Rate Limit',
 'أداء: Lazy Loading, Virtualization, Memoization',
 'دعم كامل RTL عربي + إنجليزي + SA افتراضي',
 'تصميم Apple-Level مع Clarity, Deference, Depth',
 'Responsive كامل: Desktop, Laptop, Tablet, Mobile',
 'PWA مع Service Worker ووضع Offline',
 'SQLite + IndexedDB + localStorage مع ترحيل آمن'
 ].map(f => `
            <div style="display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 8px; font-size: 12px;">
              <span style="color: #10b981; font-weight: 700; flex-shrink: 0;">✓</span>
              <span style="color: var(--color-text-secondary); line-height: 1.5;">${f}</span>
            </div>
 `).join('')}
        </div>
      </div>
      
      <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px;">
        <h3 style="font-weight: 600; margin-bottom: 12px;"> التقنيات</h3>
        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
 ${['Electron.js', 'Node.js', 'Vite 5.2', 'Vanilla JS ES2024', 'SQLite', 'IndexedDB', 'TMDB API', 'mpv Player', 'Socket.IO 4.7', 'PWA', 'RTL', 'CSS Variables', 'Design Tokens'].map(t => `
            <span style="padding: 6px 12px; background: var(--color-card); border: 1px solid var(--color-border); border-radius: 20px; font-size: 11px; font-weight: 500; font-family: monospace;">${t}</span>
 `).join('')}
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
        <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px;">
          <h3 style="font-weight: 600; margin-bottom: 8px; font-size: 14px;">الأرشفة</h3>
          <p style="font-size: 12px; color: var(--color-text-secondary); line-height: 1.6;">المنصة المحلية الأولى - جميع البيانات الشخصية محلية. TMDB للبيانات الوصفية فقط.</p>
        </div>
        <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px; padding: 20px;">
          <h3 style="font-weight: 600; margin-bottom: 8px; font-size: 14px;">TMDB Attribution</h3>
          <p style="font-size: 11px; color: var(--color-text-secondary); line-height: 1.6;">
 يستخدم TMDB API لكنه غير معتمد من TMDB.<br>
            <a href="https://www.themoviedb.org/" target="_blank" style="color: var(--color-accent);">The Movie Database</a>
          </p>
        </div>
      </div>
      
      <div style="text-align: center; padding: 24px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px;">
        <p style="font-size: 14px; font-weight: 600; margin-bottom: 4px;">صُنع بحبٍّ للمجتمع العربي</p>
        <p style="font-size: 12px; color: var(--color-text-muted);">المنطقة الافتراضية: السعودية (SA) • اللغة: العربية RTL • تصميم: Apple-Level</p>
        <p style="font-size: 11px; color: var(--color-text-muted); margin-top: 12px; font-family: monospace;">© 2026 zPopcorn Ultimate v2.0.0 • Production-Grade Media Intelligence Platform<br>Architecture: Electron + Node + Vite + Vanilla JS ES2024 + mpv + Socket.IO</p>
        <div style="margin-top: 16px; display: flex; justify-content: center; gap: 8px;">
          <a href="https://github.com" target="_blank" style="padding: 6px 12px; background: var(--color-card); border: 1px solid var(--color-border); border-radius: 16px; font-size: 11px; text-decoration: none; color: var(--color-text-secondary);">GitHub</a>
          <a href="https://www.themoviedb.org/" target="_blank" style="padding: 6px 12px; background: var(--color-card); border: 1px solid var(--color-border); border-radius: 16px; font-size: 11px; text-decoration: none; color: var(--color-text-secondary);">TMDB</a>
          <span style="padding: 6px 12px; background: #10b981; color: white; border-radius: 16px; font-size: 11px; font-weight: 600;">Production Ready ✓</span>
        </div>
      </div>
    </div>
 `;
 return div;
}

function createToggle(id, title, desc, checked) {
 return `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 12px;">
      <div style="flex: 1;">
        <div style="font-weight: 500; font-size: 14px;">${title}</div>
        <div style="font-size: 11px; color: var(--color-text-muted); margin-top: 2px;">${desc}</div>
      </div>
      <label style="position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0; cursor: pointer; margin-right: 12px;">
        <input type="checkbox" id="${id}" ${checked ? 'checked' : ''} style="opacity: 0; width: 0; height: 0;">
        <span style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background: ${checked ? 'var(--color-accent)' : 'var(--color-border)'}; border-radius: 24px; transition: 0.2s;"></span>
      </label>
    </div>
 `;
}

function bindToggles(container) {
 container.querySelectorAll('input[type="checkbox"][id]').forEach(cb => {
 if (cb.id.startsWith('auto-') || cb.id.startsWith('scan-') || cb.id.startsWith('watch-') || cb.id.startsWith('preload-') || cb.id.startsWith('skip-') || cb.id.startsWith('hide-') || cb.id.startsWith('include-') || cb.id === 'dev-mode' || cb.id === 'debug-panel' || cb.id === 'console-logs' || cb.id === 'analytics' || cb.id === 'error-reporting' || cb.id === 'usage-stats' || cb.id === 'wp-enabled') {
 cb.addEventListener('change', (e) => {
 localStorage.setItem(`zpopcorn-${e.target.id}`, e.target.checked);
 e.target.nextElementSibling.style.background = e.target.checked ? 'var(--color-accent)' : 'var(--color-border)';
 });
 }
 });
}

export { SETTINGS_CATEGORIES };
