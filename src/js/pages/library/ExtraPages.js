/**
 * Extra Library Pages - Media Types, Custom Collections Builder, Library Hub
 */
import { mediaTypeManager, smartCollectionManager } from '../../services/library/LibraryIntelligence.js';
import { snapshotManager } from '../../services/library/AwardsAndFormats.js';

export class MediaTypesPage {
  async render() {
    const container = document.createElement('div');
    container.className = 'library-page media-types-page';
    container.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">أنواع الوسائط المخصصة</h1>
        <p class="page-subtitle">نظم مكتبتك بأنواع مخصصة</p>
        <button class="btn btn-primary" id="create-type">+ نوع مخصص</button>
      </div>
      <div class="types-grid" id="types-grid"><div class="loading-skeleton">جاري التحميل...</div></div>
    `;

    setTimeout(async () => {
      const grid = container.querySelector('#types-grid');
      const types = await mediaTypeManager.getAllTypes();
      grid.innerHTML = `
        <div class="types-list" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px;">
          ${types.map(t => `
            <div class="type-card" style="background: var(--color-card); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: 20px; text-align: center;">
              <span style="font-size: 2rem; display: block; margin-bottom: 8px;">${t.icon}</span>
              <h4>${t.name}</h4>
              <span style="display: inline-block; width: 12px; height: 12px; background: ${t.color}; border-radius: 50%; margin-top: 8px;"></span>
              ${t.custom ? '<span style="font-size: 0.7rem; background: var(--color-accent); color: white; padding: 2px 6px; border-radius: 999px; margin-right: 8px;">مخصص</span>' : ''}
            </div>
          `).join('')}
        </div>
      `;
    }, 100);

    container.querySelector('#create-type')?.addEventListener('click', async () => {
      const name = prompt('اسم النوع المخصص:');
      if (!name) return;
      const icon = prompt('أيقونة (emoji):', '📁') || '📁';
      await mediaTypeManager.createCustomType(name, icon);
      window.dispatchEvent(new CustomEvent('toast', { detail: { message: `تم إنشاء النوع "${name}"`, type: 'success' } }));
      container.querySelector('#types-grid').innerHTML = '<div class="loading-skeleton">جاري التحديث...</div>';
      setTimeout(() => window.location.reload(), 500);
    });

    return container;
  }
}

export class CollectionBuilderPage {
  async render() {
    const container = document.createElement('div');
    container.className = 'library-page builder-page';
    container.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">منشئ المجموعات الذكية</h1>
        <p class="page-subtitle">أنشئ مجموعات ذكية بقواعد مخصصة</p>
      </div>
      <div class="builder-form" style="background: var(--color-card); border: 1px solid var(--color-border); border-radius: var(--radius-xl); padding: 24px; max-width: 600px;">
        <div style="display: grid; gap: 16px;">
          <label>اسم المجموعة
            <input id="col-name" class="input" placeholder="مثال: أفلام أكشن عالية التقييم" style="margin-top: 8px;">
          </label>
          <label>الوصف
            <input id="col-desc" class="input" placeholder="وصف اختياري" style="margin-top: 8px;">
          </label>
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
            <label>الحقل
              <select id="rule-field" class="input" style="margin-top: 8px;">
                <option value="genre">النوع</option>
                <option value="year">السنة</option>
                <option value="rating">التقييم</option>
                <option value="country">الدولة</option>
              </select>
            </label>
            <label>العامل
              <select id="rule-op" class="input" style="margin-top: 8px;">
                <option value="includes">يحتوي</option>
                <option value="gte">أكبر أو يساوي</option>
                <option value="equals">يساوي</option>
                <option value="lte">أصغر أو يساوي</option>
              </select>
            </label>
            <label>القيمة
              <input id="rule-value" class="input" placeholder="28 أو 2020 أو 8.0" style="margin-top: 8px;">
            </label>
          </div>
          <button class="btn btn-primary" id="create-smart">إنشاء المجموعة الذكية</button>
        </div>
        <div id="builder-result" style="margin-top: 24px;"></div>
      </div>
    `;

    setTimeout(() => {
      container.querySelector('#create-smart')?.addEventListener('click', async () => {
        const name = container.querySelector('#col-name').value.trim();
        const desc = container.querySelector('#col-desc').value.trim();
        const field = container.querySelector('#rule-field').value;
        const operator = container.querySelector('#rule-op').value;
        const value = container.querySelector('#rule-value').value.trim();
        
        if (!name || !value) {
          window.dispatchEvent(new CustomEvent('toast', { detail: { message: 'أدخل اسم المجموعة والقيمة', type: 'warning' } }));
          return;
        }

        const rules = [{ field, operator, value: isNaN(value) ? value : Number(value) }];
        
        try {
          const col = await smartCollectionManager.createCollection(name, rules, { description: desc, icon: '🧠' });
          container.querySelector('#builder-result').innerHTML = `
            <div style="padding: 16px; background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.3); border-radius: var(--radius-lg);">
              ✅ تم إنشاء المجموعة "${col.name}" مع ${col.items?.length || 0} عنصر
            </div>
          `;
          window.dispatchEvent(new CustomEvent('toast', { detail: { message: 'تم إنشاء المجموعة الذكية', type: 'success' } }));
        } catch (e) {
          container.querySelector('#builder-result').innerHTML = `<div style="color: var(--color-danger);">خطأ: ${e.message}</div>`;
        }
      });
    }, 100);

    return container;
  }
}

export class LibraryHubPage {
  async render() {
    const container = document.createElement('div');
    container.className = 'library-page hub-page';
    container.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">مركز المكتبة المتقدمة</h1>
        <p class="page-subtitle">جميع أدوات تنظيم وذكاء المكتبة في مكان واحد</p>
      </div>
      <div class="hub-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px;">
        ${[
          { id: 'command-center', icon: '🎛️', name: 'مركز القيادة', desc: 'نظرة شاملة على مكتبتك', color: '#8b5cf6' },
          { id: 'eras', icon: '📅', name: 'العقود والحقب', desc: 'استكشاف حسب الزمن', color: '#06b6d4' },
          { id: 'franchises', icon: '🎬', name: 'السلاسل والامتيازات', desc: 'تنظيم السلاسل المترابطة', color: '#f59e0b' },
          { id: 'collections', icon: '📚', name: 'المجموعات الذكية', desc: 'مجموعات بقواعد ذكية', color: '#10b981' },
          { id: 'collection-builder', icon: '🧠', name: 'منشئ المجموعات', desc: 'أنشئ مجموعات مخصصة', color: '#8b5cf6' },
          { id: 'media-types', icon: '🎞️', name: 'أنواع الوسائط', desc: '11 نوع + مخصص', color: '#ef4444' },
          { id: 'genres', icon: '🎭', name: 'الأنواع', desc: 'تصفح حسب النوع', color: '#ec4899' },
          { id: 'countries', icon: '🌍', name: 'الدول والمناطق', desc: 'سينما عالمية', color: '#06b6d4' },
          { id: 'awards', icon: '🏆', name: 'الجوائز', desc: 'أفلام حائزة على جوائز', color: '#ffd700' },
          { id: 'formats', icon: '💿', name: 'الصيغ والجودة', desc: '4K, Blu-ray, HDR', color: '#6366f1' },
          { id: 'content-themes', icon: '🎨', name: 'ثيمات المحتوى', desc: 'حسب الموضوع والقصة', color: '#f59e0b' },
          { id: 'health', icon: '🏥', name: 'صحة المكتبة', desc: 'فحص شامل', color: '#10b981' },
          { id: 'storage', icon: '💾', name: 'ذكاء التخزين', desc: 'تحليل المساحة', color: '#06b6d4' },
          { id: 'duplicates', icon: '👥', name: 'مختبر المكررات', desc: 'اكتشاف المكررات', color: '#f59e0b' },
          { id: 'missing', icon: '🧩', name: 'القطع المفقودة', desc: 'أجزاء ناقصة', color: '#ef4444' },
          { id: 'audit', icon: '📝', name: 'سجل التدقيق', desc: 'تتبع التغييرات', color: '#6b7280' },
          { id: 'snapshots', icon: '📸', name: 'لقطات المكتبة', desc: 'نقاط استعادة', color: '#8b5cf6' },
        ].map(item => `
          <a href="#/${item.id}" class="hub-card" style="background: var(--color-card); border: 1px solid var(--color-border); border-radius: var(--radius-xl); padding: 24px; text-decoration: none; color: inherit; transition: all 0.2s; display: block; border-right: 4px solid ${item.color};">
            <div style="font-size: 2rem; margin-bottom: 12px;">${item.icon}</div>
            <h3 style="font-size: 1.1rem; margin-bottom: 6px; color: var(--color-text-primary);">${item.name}</h3>
            <p style="font-size: 0.85rem; color: var(--color-text-secondary);">${item.desc}</p>
          </a>
        `).join('')}
      </div>
    `;

    setTimeout(() => {
      container.querySelectorAll('.hub-card').forEach(card => {
        card.addEventListener('mouseenter', () => {
          card.style.transform = 'translateY(-4px)';
          card.style.boxShadow = 'var(--shadow-lg)';
          card.style.borderColor = 'var(--color-accent)';
        });
        card.addEventListener('mouseleave', () => {
          card.style.transform = '';
          card.style.boxShadow = '';
          card.style.borderColor = '';
        });
      });
    }, 100);

    return container;
  }
}
