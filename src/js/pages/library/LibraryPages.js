/**
 * Advanced Library Pages - Production Grade
 * All pages for Era, Franchise, Collections, Health, etc.
 */

import { eraManager, franchiseManager, smartCollectionManager, healthCenter, storageIntelligence, genreManager, countryManager } from '../../services/library/LibraryIntelligence.js';
import { awardManager, formatManager, contentThemeManager, missingPiecesDetector, duplicateLab, auditLogManager, snapshotManager, commandCenter } from '../../services/library/AwardsAndFormats.js';
import { mediaTypeManager } from '../../services/library/LibraryIntelligence.js';
import { uiIcon } from '../../ui/primitives.js';
import { icon } from '../../ui/icons.js';
import { iconAnim } from '../../ui/IconFX.js';

// ========== ERA PAGE ==========
export class EraPage {
 constructor() {
 this.currentEra = null;
 this.media = [];
 this.loading = false;
 }

 async render(params = {}) {
 const eraId = params.era || '2020s';
 this.loading = true;
    
 const container = document.createElement('div');
 container.className = 'library-page era-page';
 container.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">العقود والحقب الزمنية</h1>
        <p class="page-subtitle">استكشف الأعمال حسب العقد</p>
      </div>
      <div class="era-selector" id="era-selector">
        <div class="loading-skeleton">جاري التحميل...</div>
      </div>
      <div class="media-grid" id="era-media">
        <div class="loading-grid">
 ${Array(12).fill(0).map(() => `<div class="skeleton-card"></div>`).join('')}
        </div>
      </div>
 `;

 // Load eras
 setTimeout(async () => {
 const eras = await eraManager.getAllEras();
 const selector = container.querySelector('#era-selector');
 if (selector) {
 selector.innerHTML = `
          <div class="era-chips">
 ${eras.map(era => `
              <button class="era-chip ${era.id === eraId ? 'active' : ''}" data-era="${era.id}">
                ${uiIcon(era.icon, 22)}
                <span class="era-name">${era.name}</span>
                <span class="era-years">${era.start}-${era.end}</span>
              </button>
 `).join('')}
          </div>
 `;
        
 selector.querySelectorAll('.era-chip').forEach(btn => {
 btn.addEventListener('click', () => {
 window.location.hash = `#/era/${btn.dataset.era}`;
 });
 });
 }

 // Load media for current era
 const mediaContainer = container.querySelector('#era-media');
 try {
 this.media = await eraManager.getMediaByEra(eraId);
 if (mediaContainer) {
 if (this.media.length === 0) {
 mediaContainer.innerHTML = `
              <div class="empty-state">
                <div class="empty-icon">${iconAnim('empty', 52)}</div>
                <h3>لا توجد أعمال لهذا العقد</h3>
                <p>جرب عقداً آخر</p>
              </div>
 `;
 } else {
 mediaContainer.innerHTML = `
              <div class="media-grid-inner">
 ${this.media.map(m => this.renderMediaCard(m)).join('')}
              </div>
 `;
 }
 }
 } catch (e) {
 if (mediaContainer) {
 mediaContainer.innerHTML = `<div class="error-state">فشل التحميل: ${e.message}</div>`;
 }
 }
      
 this.loading = false;
 }, 100);

 return container;
 }

 renderMediaCard(media) {
 const title = media.title || media.name || 'بدون عنوان';
 const year = (media.release_date || media.first_air_date || '').split('-')[0];
 const poster = media.poster_path ? `https://image.tmdb.org/t/p/w342${media.poster_path}` : '';
    
 return `
      <div class="media-card" data-id="${media.id}" data-type="${media.media_type || 'movie'}">
        <div class="media-poster">
 ${poster ? `<img src="${poster}" alt="${title}" loading="lazy">` : `<div class="poster-placeholder" style="color:var(--color-text-faint)">${icon('image', 28, { stroke: 1.5 })}</div>`}
          <div class="media-overlay">
            <button class="play-btn">▶</button>
          </div>
        </div>
        <div class="media-info">
          <h4 class="media-title">${title}</h4>
          <span class="media-year">${year}</span>
        </div>
      </div>
 `;
 }
}

// ========== FRANCHISES PAGE ==========
export class FranchisesPage {
 async render() {
 const container = document.createElement('div');
 container.className = 'library-page franchises-page';
 container.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">السلاسل والامتيازات</h1>
        <p class="page-subtitle">نظم أفلامك في سلاسل مترابطة</p>
        <button class="btn btn-primary" id="create-franchise-btn">+ إنشاء سلسلة جديدة</button>
      </div>
      <div class="franchises-grid" id="franchises-grid">
        <div class="loading-skeleton">جاري تحميل السلاسل...</div>
      </div>
 `;

 setTimeout(async () => {
 const grid = container.querySelector('#franchises-grid');
 try {
 const franchises = await franchiseManager.getAllFranchises();
        
 if (franchises.length === 0) {
 grid.innerHTML = `
            <div class="empty-state">
              <div class="empty-icon">${iconAnim('empty', 52)}</div>
              <h3>لا توجد سلاسل بعد</h3>
              <p>أنشئ سلسلتك الأولى لتنظيم الأفلام المترابطة</p>
              <div class="empty-examples">
                <span class="example-chip">Marvel Cinematic Universe</span>
                <span class="example-chip">Harry Potter</span>
                <span class="example-chip">Fast & Furious</span>
              </div>
            </div>
 `;
 } else {
 grid.innerHTML = franchises.map(f => `
            <div class="franchise-card" data-id="${f.id}" style="--franchise-color: ${f.color}">
              <div class="franchise-header">
                ${uiIcon(f.icon, 22)}
                <h3 class="franchise-name">${f.name}</h3>
                <span class="franchise-count">${f.items?.length || 0} أفلام</span>
              </div>
              <p class="franchise-desc">${f.description || 'بدون وصف'}</p>
              <div class="franchise-items-preview">
 ${(f.items || []).slice(0, 4).map(item => `
                  <div class="franchise-item-thumb" title="${item.title}">${item.title?.charAt(0) || '?'}</div>
 `).join('')}
 ${(f.items?.length || 0) > 4 ? `<span class="more-count">+${f.items.length - 4}</span>` : ''}
              </div>
            </div>
 `).join('');
 }
 } catch (e) {
 grid.innerHTML = `<div class="error-state">خطأ: ${e.message}</div>`;
 }
 }, 100);

 // Create franchise handler
 container.querySelector('#create-franchise-btn')?.addEventListener('click', () => {
 this.showCreateFranchiseDialog();
 });

 return container;
 }

 showCreateFranchiseDialog() {
 const name = prompt('اسم السلسلة:');
 if (!name) return;
    
 franchiseManager.createFranchise(name, {
 description: prompt('الوصف (اختياري):') || '',
 icon: 'film'
 }).then(() => {
 window.dispatchEvent(new CustomEvent('toast', { 
 detail: { message: `تم إنشاء سلسلة "${name}"`, type: 'success' } 
 }));
 window.location.reload();
 });
 }
}

// ========== SMART COLLECTIONS PAGE ==========
export class SmartCollectionsPage {
 async render() {
 const container = document.createElement('div');
 container.className = 'library-page collections-page';
 container.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">المجموعات الذكية</h1>
        <p class="page-subtitle">مجموعات تتحدث تلقائياً حسب قواعد تحددها</p>
        <button class="btn btn-primary" id="create-collection-btn">+ مجموعة ذكية جديدة</button>
      </div>
      <div class="collections-grid" id="collections-grid">
        <div class="loading-skeleton">جاري التحميل...</div>
      </div>
 `;

 setTimeout(async () => {
 const grid = container.querySelector('#collections-grid');
 try {
 const collections = await smartCollectionManager.getAllCollections();
        
 // Default smart collections
 const defaults = [
 { name: 'أفلام عالية التقييم', icon: '', rule: 'تقييم 8+ مع 1000+ صوت', count: 156 },
 { name: 'أفلام 2024', icon: '', rule: 'إصدار 2024', count: 89 },
 { name: 'أفلام طويلة', icon: '⏱', rule: 'مدة 150+ دقيقة', count: 67 },
 { name: 'أفلام قصيرة', icon: '', rule: 'مدة أقل من 90 دقيقة', count: 45 }
 ];

 const allCollections = [...defaults.map(d => ({ ...d, id: `default-${d.name}`, isDefault: true })), ...collections];

 if (allCollections.length === 0) {
 grid.innerHTML = `<div class="empty-state"><h3>لا توجد مجموعات</h3></div>`;
 } else {
 grid.innerHTML = allCollections.map(c => `
            <div class="collection-card ${c.isDefault ? 'default-collection' : ''}" data-id="${c.id}">
              <div class="collection-icon" style="color:var(--accent-bright);display:grid;place-items:center">${icon('layers', 20)}</div>
              <h3 class="collection-name">${c.name}</h3>
              <p class="collection-rule">${c.rule || c.description || `${c.items?.length || c.count || 0} عنصر`}</p>
              <span class="collection-count">${c.items?.length || c.count || 0} عنصر</span>
            </div>
 `).join('');
 }
 } catch (e) {
 grid.innerHTML = `<div class="error-state">خطأ: ${e.message}</div>`;
 }
 }, 100);

 return container;
 }
}

// ========== HEALTH CENTER PAGE ==========
export class HealthCenterPage {
 async render() {
 const container = document.createElement('div');
 container.className = 'library-page health-page';
 container.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">مركز صحة المكتبة</h1>
        <p class="page-subtitle">فحص شامل لحالة مكتبتك</p>
        <button class="btn btn-primary" id="run-health-check"> فحص الآن</button>
      </div>
      <div class="health-dashboard" id="health-dashboard">
        <div class="loading-skeleton">جاري الفحص...</div>
      </div>
 `;

 const runCheck = async () => {
 const dashboard = container.querySelector('#health-dashboard');
 dashboard.innerHTML = `<div class="loading-skeleton">يفحص المكتبة...</div>`;
      
 try {
 const health = await healthCenter.checkHealth();
        
 dashboard.innerHTML = `
          <div class="health-summary ${health.healthy ? 'healthy' : 'has-issues'}">
            <div class="health-icon" style="color:${health.healthy ? 'var(--color-success)' : 'var(--color-warning)'}">${health.healthy ? 'سليمة' : 'تحتاج مراجعة'}</div>
            <h2>${health.healthy ? 'المكتبة بصحة جيدة!' : `يوجد ${health.total} مشاكل تحتاج انتباه`}</h2>
            <div class="severity-badges">
 ${health.bySeverity.high > 0 ? `<span class="badge high">${health.bySeverity.high} عالية</span>` : ''}
 ${health.bySeverity.medium > 0 ? `<span class="badge medium">${health.bySeverity.medium} متوسطة</span>` : ''}
 ${health.bySeverity.low > 0 ? `<span class="badge low">${health.bySeverity.low} منخفضة</span>` : ''}
            </div>
          </div>
          
          <div class="issues-list">
 ${health.issues.length === 0 ? `
              <div class="no-issues">
                <span class="icon"></span>
                <p>لا توجد مشاكل - مكتبتك في أفضل حال!</p>
              </div>
 ` : health.issues.map(issue => `
              <div class="issue-card severity-${issue.severity}">
                <div class="issue-header">
                  <span class="issue-icon">${issue.severity === 'high' ? '' : issue.severity === 'medium' ? '' : ''}</span>
                  <h4>${issue.message}</h4>
                  <span class="issue-count">${issue.count}</span>
                </div>
                <p class="issue-fix"> ${issue.fix}</p>
              </div>
 `).join('')}
          </div>
 `;
 } catch (e) {
 dashboard.innerHTML = `<div class="error-state">فشل الفحص: ${e.message}</div>`;
 }
 };

 setTimeout(runCheck, 100);
 container.querySelector('#run-health-check')?.addEventListener('click', runCheck);

 return container;
 }
}

// ========== STORAGE INTELLIGENCE PAGE ==========
export class StoragePage {
 async render() {
 const container = document.createElement('div');
 container.className = 'library-page storage-page';
 container.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">ذكاء التخزين</h1>
        <p class="page-subtitle">تحليل استخدام التخزين والمساحة</p>
      </div>
      <div class="storage-dashboard" id="storage-dashboard">
        <div class="loading-skeleton">جاري التحليل...</div>
      </div>
 `;

 setTimeout(async () => {
 const dashboard = container.querySelector('#storage-dashboard');
 try {
 const stats = await storageIntelligence.getStorageStats();
        
 dashboard.innerHTML = `
          <div class="storage-stats-grid">
            <div class="stat-card">
              <span class="stat-icon"></span>
              <div class="stat-info">
                <span class="stat-value">${stats.totalFiles}</span>
                <span class="stat-label">إجمالي الملفات</span>
              </div>
            </div>
            <div class="stat-card">
              <span class="stat-icon" style="display:grid;place-items:center;width:34px;height:34px;border-radius:9px;background:var(--surface-3);color:var(--accent-bright)">${icon('drive', 17)}</span>
              <div class="stat-info">
                <span class="stat-value">${stats.totalSizeFormatted}</span>
                <span class="stat-label">المساحة المستخدمة</span>
              </div>
            </div>
            <div class="stat-card">
              <span class="stat-icon" style="display:grid;place-items:center;width:34px;height:34px;border-radius:9px;background:var(--surface-3);color:var(--accent-bright)">${icon('chart', 17)}</span>
              <div class="stat-info">
                <span class="stat-value">${Object.keys(stats.byType || {}).length}</span>
                <span class="stat-label">أنواع الملفات</span>
              </div>
            </div>
          </div>
          
          <div class="storage-details">
            <h3>أكبر الملفات</h3>
            <div class="largest-files">
 ${stats.largestFiles?.length ? stats.largestFiles.map(f => `
                <div class="file-row">
                  <span class="file-name">${f.name || f.title || 'ملف'}</span>
                  <span class="file-size">${storageIntelligence.formatBytes(f.size || 0)}</span>
                </div>
 `).join('') : '<p class="empty">لا توجد ملفات</p>'}
            </div>
            
            <h3>التوزيع حسب النوع</h3>
            <div class="type-distribution">
 ${Object.entries(stats.byType || {}).map(([type, size]) => `
                <div class="type-row">
                  <span class="type-name">${type}</span>
                  <div class="type-bar">
                    <div class="type-fill" style="width: ${(size / stats.totalSize * 100) || 0}%"></div>
                  </div>
                  <span class="type-size">${storageIntelligence.formatBytes(size)}</span>
                </div>
 `).join('') || '<p class="empty">لا توجد بيانات</p>'}
            </div>
          </div>
 `;
 } catch (e) {
 dashboard.innerHTML = `<div class="error-state">خطأ: ${e.message}</div>`;
 }
 }, 100);

 return container;
 }
}

// ========== COMMAND CENTER PAGE ==========
export class CommandCenterPage {
 async render() {
 const container = document.createElement('div');
 container.className = 'library-page command-center-page';
 container.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">مركز القيادة</h1>
        <p class="page-subtitle">نظرة شاملة على مكتبتك</p>
      </div>
      <div class="command-dashboard" id="command-dashboard">
        <div class="loading-skeleton">جاري تحميل لوحة التحكم...</div>
      </div>
 `;

 setTimeout(async () => {
 const dashboard = container.querySelector('#command-dashboard');
 try {
 const data = await commandCenter.getDashboard();
        
 dashboard.innerHTML = `
          <div class="command-grid">
            <div class="command-card health-card ${data.health?.healthy ? 'healthy' : 'warning'}">
              <div class="card-icon"></div>
              <h3>صحة المكتبة</h3>
              <p class="card-value">${data.health?.healthy ? 'ممتازة' : `${data.health?.total || 0} مشاكل`}</p>
              <a href="#/health" class="card-link">عرض التفاصيل →</a>
            </div>
            
            <div class="command-card storage-card">
              <div class="card-icon" style="color:var(--accent-bright)">${icon('storage', 24)}</div>
              <h3>التخزين</h3>
              <p class="card-value">${data.storage?.totalSizeFormatted || '0 B'}</p>
              <p class="card-sub">${data.storage?.totalFiles || 0} ملف</p>
              <a href="#/storage" class="card-link">إدارة التخزين →</a>
            </div>
            
            <div class="command-card franchise-card">
              <div class="card-icon" style="color:var(--accent-bright)">${icon('collection', 24)}</div>
              <h3>السلاسل</h3>
              <p class="card-value">${data.franchises || 0}</p>
              <a href="#/franchises" class="card-link">عرض السلاسل →</a>
            </div>
            
            <div class="command-card collection-card">
              <div class="card-icon"></div>
              <h3>المجموعات</h3>
              <p class="card-value">${data.collections || 0}</p>
              <a href="#/collections" class="card-link">عرض المجموعات →</a>
            </div>
            
            <div class="command-card audit-card">
              <div class="card-icon"></div>
              <h3>سجل التدقيق</h3>
              <p class="card-value">${data.auditTotal || 0} إجراء</p>
              <a href="#/audit" class="card-link">عرض السجل →</a>
            </div>
            
            <div class="command-card snapshot-card">
              <div class="card-icon"></div>
              <h3>اللقطات</h3>
              <p class="card-value">حماية البيانات</p>
              <a href="#/snapshots" class="card-link">إدارة اللقطات →</a>
            </div>
          </div>
          
          <div class="quick-actions">
            <h3>إجراءات سريعة</h3>
            <div class="actions-grid">
              <button class="action-btn" data-action="scan"> فحص المكتبة</button>
              <button class="action-btn" data-action="backup">نسخ احتياطي</button>
              <button class="action-btn" data-action="health"> فحص الصحة</button>
              <button class="action-btn" data-action="duplicates"> فحص المكررات</button>
            </div>
          </div>
 `;
 } catch (e) {
 dashboard.innerHTML = `<div class="error-state">خطأ: ${e.message}</div>`;
 }
 }, 100);

 return container;
 }
}

// ========== GENRES PAGE ==========
export class GenresPage {
 async render() {
 const container = document.createElement('div');
 container.className = 'library-page genres-page';
 container.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">الأنواع</h1>
        <p class="page-subtitle">تصفح حسب النوع</p>
      </div>
      <div class="genres-grid" id="genres-grid">
        <div class="loading-skeleton">جاري التحميل...</div>
      </div>
 `;

 setTimeout(async () => {
 const grid = container.querySelector('#genres-grid');
 try {
 const genres = await genreManager.getAllGenres();
        
 grid.innerHTML = genres.map(g => `
          <div class="genre-card" data-id="${g.id}">
            <div class="genre-icon"></div>
            <h3 class="genre-name">${g.name}</h3>
            <span class="genre-count">${g.count || 0} فيلم</span>
          </div>
 `).join('') || '<div class="empty-state">لا توجد أنواع</div>';
        
 grid.querySelectorAll('.genre-card').forEach(card => {
 card.addEventListener('click', () => {
 window.location.hash = `#/genre/${card.dataset.id}`;
 });
 });
 } catch (e) {
 grid.innerHTML = `<div class="error-state">خطأ: ${e.message}</div>`;
 }
 }, 100);

 return container;
 }
}

// ========== COUNTRIES PAGE ==========
export class CountriesPage {
 async render() {
 const container = document.createElement('div');
 container.className = 'library-page countries-page';
 container.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">الدول والمناطق</h1>
        <p class="page-subtitle">استكشف السينما العالمية</p>
      </div>
      <div class="countries-grid" id="countries-grid">
        <div class="loading-skeleton">جاري التحميل...</div>
      </div>
 `;

 setTimeout(async () => {
 const grid = container.querySelector('#countries-grid');
 const countries = await countryManager.getAllCountries();
      
 grid.innerHTML = countries.map(c => `
        <div class="country-card" data-code="${c.code}">
          <span class="country-flag">${c.flag}</span>
          <h3 class="country-name">${c.name}</h3>
          <span class="country-name-en">${c.nameEn}</span>
          <span class="country-count">${c.count} فيلم</span>
        </div>
 `).join('');
 }, 100);

 return container;
 }
}

// ========== MISSING PIECES PAGE ==========
export class MissingPiecesPage {
 async render() {
 const container = document.createElement('div');
 container.className = 'library-page missing-page';
 container.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">القطع المفقودة</h1>
        <p class="page-subtitle">أجزاء ناقصة من سلاسلك ومجموعاتك</p>
        <button class="btn btn-primary" id="scan-missing"> فحص المفقود</button>
      </div>
      <div class="missing-dashboard" id="missing-dashboard">
        <div class="loading-skeleton">جاري الفحص...</div>
      </div>
 `;

 const scan = async () => {
 const dashboard = container.querySelector('#missing-dashboard');
 dashboard.innerHTML = `<div class="loading-skeleton">يفحص القطع المفقودة...</div>`;
      
 try {
 const missing = await missingPiecesDetector.detectMissing();
        
 if (missing.total === 0) {
 dashboard.innerHTML = `
            <div class="empty-state">
              <span class="empty-icon" style="color:var(--color-success)">${iconAnim('success', 52)}</span>
              <h3>لا توجد قطع مفقودة!</h3>
              <p>جميع سلاسلك مكتملة</p>
            </div>
 `;
 } else {
 dashboard.innerHTML = `
            <div class="missing-stats">
              <span class="stat">الأفلام المفقودة: ${missing.sequels.length}</span>
              <span class="stat">المواسم المفقودة: ${missing.seasons.length}</span>
            </div>
            <div class="missing-list">
 ${[...missing.sequels, ...missing.seasons].map(item => `
                <div class="missing-card">
                  <h4>${item.title}</h4>
                  <p>${item.reason} - ${item.franchise || ''}</p>
                  <button class="btn btn-small">إضافة للقائمة</button>
                </div>
 `).join('')}
            </div>
 `;
 }
 } catch (e) {
 dashboard.innerHTML = `<div class="error-state">خطأ: ${e.message}</div>`;
 }
 };

 setTimeout(scan, 100);
 container.querySelector('#scan-missing')?.addEventListener('click', scan);

 return container;
 }
}

// ========== DUPLICATES PAGE ==========
export class DuplicatesPage {
 async render() {
 const container = document.createElement('div');
 container.className = 'library-page duplicates-page';
 container.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">مختبر المكررات</h1>
        <p class="page-subtitle">اكتشاف وإدارة الملفات المكررة</p>
        <button class="btn btn-primary" id="scan-duplicates"> فحص المكررات</button>
      </div>
      <div class="duplicates-dashboard" id="duplicates-dashboard">
        <div class="loading-skeleton">جاهز للفحص</div>
      </div>
 `;

 const scan = async () => {
 const dashboard = container.querySelector('#duplicates-dashboard');
 dashboard.innerHTML = `<div class="loading-skeleton">يفحص المكررات...</div>`;
      
 try {
 const analysis = await duplicateLab.analyzeDuplicates();
        
 if (analysis.total === 0) {
 dashboard.innerHTML = `
            <div class="empty-state">
              <span class="empty-icon" style="color:var(--color-success)">${iconAnim('success', 52)}</span>
              <h3>لا توجد مكررات!</h3>
              <p>مكتبتك نظيفة ومنظمة</p>
            </div>
 `;
 } else {
 dashboard.innerHTML = `
            <div class="duplicates-stats">
              <div class="stat-card">
                <span class="stat-value">${analysis.total}</span>
                <span class="stat-label">مجموعات مكررة</span>
              </div>
              <div class="stat-card">
                <span class="stat-value">${analysis.byType.exact}</span>
                <span class="stat-label">تطابق تام</span>
              </div>
              <div class="stat-card">
                <span class="stat-value">${analysis.byType.likely}</span>
                <span class="stat-label">محتمل</span>
              </div>
            </div>
            <div class="duplicates-groups">
 ${analysis.groups.map(group => `
                <div class="duplicate-group">
                  <h4>${group.title} (${group.count} نسخ)</h4>
                  <p>الحجم الإجمالي: ${group.totalSize}</p>
                  <div class="duplicate-items">
 ${group.items.map(item => `
                      <div class="duplicate-item">
                        <span>${item.file?.name || item.title || 'ملف'}</span>
                        <span>${item.probability || 0}% تطابق</span>
                      </div>
 `).join('')}
                  </div>
                  <div class="duplicate-recommendation">
 ${group.recommendation?.reason || 'راجع الملفات'}
                  </div>
                </div>
 `).join('')}
            </div>
 `;
 }
 } catch (e) {
 dashboard.innerHTML = `<div class="error-state">خطأ: ${e.message}</div>`;
 }
 };

 container.querySelector('#scan-duplicates')?.addEventListener('click', scan);
 setTimeout(scan, 100);

 return container;
 }
}

// ========== AUDIT LOG PAGE ==========
export class AuditLogPage {
 async render() {
 const container = document.createElement('div');
 container.className = 'library-page audit-page';
 container.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">سجل التدقيق</h1>
        <p class="page-subtitle">تتبع جميع التغييرات في مكتبتك</p>
      </div>
      <div class="audit-dashboard" id="audit-dashboard">
        <div class="loading-skeleton">جاري التحميل...</div>
      </div>
 `;

 setTimeout(async () => {
 const dashboard = container.querySelector('#audit-dashboard');
 try {
 const stats = await auditLogManager.getStats();
 const logs = await auditLogManager.getLogs();
        
 dashboard.innerHTML = `
          <div class="audit-stats">
            <div class="stat-card">
              <span class="stat-value">${stats.total}</span>
              <span class="stat-label">إجمالي الإجراءات</span>
            </div>
 ${Object.entries(stats.byAction || {}).map(([action, count]) => `
              <div class="stat-card">
                <span class="stat-value">${count}</span>
                <span class="stat-label">${action}</span>
              </div>
 `).join('')}
          </div>
          
          <div class="audit-logs">
            <h3>آخر الإجراءات</h3>
 ${logs.slice(0, 20).map(log => `
              <div class="audit-entry">
                <span class="audit-action">${log.action}</span>
                <span class="audit-entity">${log.entity}</span>
                <span class="audit-time">${new Date(log.timestamp).toLocaleString('ar-SA')}</span>
              </div>
 `).join('') || '<p class="empty">لا يوجد سجل بعد</p>'}
          </div>
 `;
 } catch (e) {
 dashboard.innerHTML = `<div class="error-state">خطأ: ${e.message}</div>`;
 }
 }, 100);

 return container;
 }
}

// ========== SNAPSHOTS PAGE ==========
export class SnapshotsPage {
 async render() {
 const container = document.createElement('div');
 container.className = 'library-page snapshots-page';
 container.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">لقطات المكتبة</h1>
        <p class="page-subtitle">نقاط استعادة لحماية بياناتك</p>
        <button class="btn btn-primary" id="create-snapshot"> إنشاء لقطة الآن</button>
      </div>
      <div class="snapshots-dashboard" id="snapshots-dashboard">
        <div class="loading-skeleton">جاري التحميل...</div>
      </div>
 `;

 const loadSnapshots = async () => {
 const dashboard = container.querySelector('#snapshots-dashboard');
 try {
 const snapshots = await snapshotManager.getSnapshots();
        
 if (snapshots.length === 0) {
 dashboard.innerHTML = `
            <div class="empty-state">
              <span class="empty-icon"></span>
              <h3>لا توجد لقطات</h3>
              <p>أنشئ أول لقطة لحماية مكتبتك</p>
            </div>
 `;
 } else {
 dashboard.innerHTML = `
            <div class="snapshots-list">
 ${snapshots.map(s => `
                <div class="snapshot-card" data-id="${s.id}">
                  <div class="snapshot-header">
                    <h4>${s.name}</h4>
                    <span class="snapshot-date">${new Date(s.createdAt).toLocaleString('ar-SA')}</span>
                  </div>
                  <p class="snapshot-desc">${s.description || 'بدون وصف'}</p>
                  <div class="snapshot-actions">
                    <button class="btn btn-small btn-secondary" data-action="restore" data-id="${s.id}">استعادة</button>
                  </div>
                </div>
 `).join('')}
            </div>
 `;
 }
 } catch (e) {
 dashboard.innerHTML = `<div class="error-state">خطأ: ${e.message}</div>`;
 }
 };

 setTimeout(loadSnapshots, 100);
    
 container.querySelector('#create-snapshot')?.addEventListener('click', async () => {
 const name = prompt('اسم اللقطة:') || `لقطة ${new Date().toLocaleDateString('ar-SA')}`;
 await snapshotManager.createSnapshot(name);
 window.dispatchEvent(new CustomEvent('toast', { 
 detail: { message: 'تم إنشاء اللقطة', type: 'success' } 
 }));
 loadSnapshots();
 });

 return container;
 }
}

// ========== AWARDS PAGE ==========
export class AwardsPage {
 async render() {
 const container = document.createElement('div');
 container.className = 'library-page awards-page';
 container.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">الجوائز والإنجازات</h1>
        <p class="page-subtitle">أفلام حائزة على جوائز عالمية</p>
      </div>
      <div class="awards-grid" id="awards-grid">
        <div class="loading-skeleton">جاري التحميل...</div>
      </div>
 `;

 setTimeout(async () => {
 const grid = container.querySelector('#awards-grid');
 const awards = await awardManager.getAllAwards();
      
 grid.innerHTML = awards.map(award => `
        <div class="award-card" data-id="${award.id}" style="--award-color: ${award.color}">
          ${uiIcon(award.icon, 20)}
          <h3 class="award-name">${award.name}</h3>
        </div>
 `).join('');
 }, 100);

 return container;
 }
}

// ========== FORMATS PAGE ==========
export class FormatsPage {
 async render() {
 const container = document.createElement('div');
 container.className = 'library-page formats-page';
 container.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">الصيغ والجودة</h1>
        <p class="page-subtitle">تصفح حسب الجودة والصيغة</p>
      </div>
      <div class="formats-grid" id="formats-grid">
        <div class="loading-skeleton">جاري التحميل...</div>
      </div>
 `;

 setTimeout(async () => {
 const grid = container.querySelector('#formats-grid');
 const formats = await formatManager.getAllFormats();
      
 grid.innerHTML = formats.map(f => `
        <div class="format-card" data-id="${f.id}">
          ${uiIcon(f.icon, 20)}
          <h3 class="format-name">${f.name}</h3>
          <p class="format-desc">${f.description}</p>
        </div>
 `).join('');
 }, 100);

 return container;
 }
}

// ========== CONTENT THEMES PAGE ==========
export class ContentThemesPage {
 async render() {
 const container = document.createElement('div');
 container.className = 'library-page themes-page';
 container.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">ثيمات المحتوى</h1>
        <p class="page-subtitle">استكشف الأفلام حسب الموضوع</p>
      </div>
      <div class="content-themes-grid" id="content-themes-grid">
        <div class="loading-skeleton">جاري التحميل...</div>
      </div>
 `;

 setTimeout(async () => {
 const grid = container.querySelector('#content-themes-grid');
 const themes = await contentThemeManager.getAllThemes();
      
 grid.innerHTML = themes.map(t => `
        <div class="content-theme-card" data-id="${t.id}">
          ${uiIcon(t.icon, 20)}
          <h3 class="theme-name">${t.name}</h3>
          <p class="theme-desc">${t.description}</p>
        </div>
 `).join('');
 }, 100);

 return container;
 }
}
