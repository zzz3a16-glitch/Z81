/**
 * Extra Library Pages - Media Types, Custom Collections Builder, Library Hub
 */
import { mediaTypeManager, smartCollectionManager } from '../../services/library/LibraryIntelligence.js';
import { uiIcon } from '../../ui/primitives.js';
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
              <span style="display:block;margin-bottom:8px;color:var(--accent-bright)">${uiIcon(t.icon, 26)}</span>
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
 const icon = prompt('أيقونة (emoji):', '') || '';
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
 const col = await smartCollectionManager.createCollection(name, rules, { description: desc, icon: '' });
 container.querySelector('#builder-result').innerHTML = `
            <div style="padding: 16px; background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.3); border-radius: var(--radius-lg);">
 تم إنشاء المجموعة "${col.name}" مع ${col.items?.length || 0} عنصر
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
 const { el, esc } = await import('../../ui/primitives.js');
 const { icon } = await import('../../ui/icons.js');
 const TOOLS = [
 ['command-center', 'gauge', 'مركز القيادة', 'نظرة شاملة على مكتبتك وأذواقك'],
 ['eras', 'calendar', 'العقود والحقب', 'استكشاف حسب الزمن'],
 ['franchises', 'layers', 'السلاسل والامتيازات', 'تنظيم الأعمال المترابطة'],
 ['collections', 'collection', 'المجموعات الذكية', 'مجموعات بقواعد تلقائية'],
 ['collection-builder', 'plus', 'منشئ المجموعات', 'أنشئ مجموعات مخصصة'],
 ['media-types', 'disc', 'أنواع الوسائط', 'فيلم، مسلسل، أومد، OV...'],
 ['genres', 'grid', 'تصفح بالأنواع', 'دراما، خيال، إثارة'],
 ['countries', 'globe', 'الدول والمناطق', 'سينما عالمية'],
 ['awards', 'star', 'الجوائز', 'أعمال حائزة على جوائز'],
 ['formats', 'sparkle', 'الصيغ والجودة', '4K · HDR · Dolby'],
 ['content-themes', 'palette', 'ثيمات المحتوى', 'حسب الموضوع والقصة'],
 ['health', 'shield', 'صحة المكتبة', 'فشل الوصف، مفقود، مكرر'],
 ['storage', 'database', 'ذكاء التخزين', 'تحليل المساحة — قراءة فقط'],
 ['duplicates', 'copy', 'مختبر المكررات', 'قبل الدمج ومراجعته'],
 ['missing', 'alert', 'القطع المفقودة', 'حلقات وأجزاء ناقصة'],
 ['audit', 'activity', 'سجل التدقيق', 'ماذا تغيّر ومتى'],
 ['snapshots', 'clock', 'لقطات المكتبة', 'نقاط استعادة'],
 ];
 const page = el('div', '');
 page.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">مركز المكتبة</h1>
        <p class="page-subtitle">أدوات التنظيم والذكاء — كلها تقرأ المكتبة ولا تعدّل ملفاتك إطلاقاً.</p>
      </div>`;
 const grid = el('div', '');
 grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px;padding:0 var(--page-gutter) 40px';
 TOOLS.forEach(([id, ic, name, desc]) => {
 const a = el('button', 'z-toolcard');
 a.style.cssText = 'cursor:pointer;text-align:start;font:inherit;color:inherit;display:flex;gap:12px;align-items:center;padding:16px;background:var(--surface-2);border:1px solid var(--color-border);border-radius:var(--r-lg);transition:border-color .15s,transform .15s';
 a.innerHTML = `<span style="display:grid;place-items:center;width:36px;height:36px;border-radius:10px;background:var(--surface-3);color:var(--accent-bright);flex-shrink:0">${icon(ic, 17)}</span>
        <span><b style="display:block;font-size:14px">${name}</b><span style="font-size:12px;color:var(--color-text-muted)">${desc}</span></span>
        <span style="margin-inline-start:auto;color:var(--color-text-faint)">${icon('chevronL', 15)}</span>`;
 a.addEventListener('mouseenter', () => { a.style.borderColor = 'var(--accent-line)'; a.style.transform = 'translateY(-2px)'; });
 a.addEventListener('mouseleave', () => { a.style.borderColor = 'var(--color-border)'; a.style.transform = ''; });
 a.addEventListener('click', () => window.router.navigate('/' + id));
 grid.appendChild(a);
 });
 page.appendChild(grid);
 return page;
 }
}

/** Full library browser: grid/table views over the local DB (spec 21-22). */
export class LibraryBrowsePage {
 async render(params = {}, query = {}) {
 const { el, esc, emptyState, skelGrid } = await import('../../ui/primitives.js');
 const { icon } = await import('../../ui/icons.js');
 const { db } = await import('../../services/storage/Database.js');
 const { createMediaCard } = await import('../../components/MediaCard.js');

 const page = el('div', '');
 const VIEW_KEY = 'zpopcorn-lib-view';
 let view = localStorage.getItem(VIEW_KEY) || 'grid';
 let type = query.type || 'all';
 let sort = 'added';
 let q = '';
 let rows = [];

 page.innerHTML = `
      <div class="page-header" style="display:flex;align-items:flex-end;gap:18px;flex-wrap:wrap">
        <div style="flex:1;min-width:240px">
          <h1 class="page-title">كل المكتبة</h1>
          <p class="page-subtitle" id="lb-count">…</p>
        </div>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
          <input id="lb-q" class="input input-sm" style="width:190px" placeholder="بحث في مكتبتك…" aria-label="بحث في المكتبة">
 ${[['all', 'الكل'], ['movie', 'أفلام'], ['tv', 'مسلسلات']].map(([v, l]) => `<button class="chip" data-type="${v}">${l}</button>`).join('')}
          <select id="lb-sort" class="input input-sm" style="width:auto" aria-label="الترتيب">
            <option value="added">الأحدث إضافة</option>
            <option value="title">العنوان أ-ي</option>
            <option value="rating">التقييم</option>
            <option value="year">السنة</option>
          </select>
          <div style="display:flex;gap:2px;background:var(--surface-2);border:1px solid var(--color-border);border-radius:var(--r-md);padding:2px">
            <button class="z-iconbtn on" data-view="grid" title="شبكة">${icon('grid', 15)}</button>
            <button class="z-iconbtn" data-view="table" title="جدول">${icon('list', 15)}</button>
          </div>
        </div>
      </div>
      <div class="container" id="lb-body"></div>`;

 const body = page.querySelector('#lb-body');
 page.querySelectorAll('[data-type]').forEach((b) => b.classList.toggle('active', b.dataset.type === type));
 body.appendChild(skelGrid(8));

 try {
 const [m, t] = await Promise.all([db.getAll('movies', 2000).catch(() => []), db.getAll('tvshows', 2000).catch(() => [])]);
 rows = [...(m || []).map((x) => ({ ...x, media_type: 'movie' })), ...(t || []).map((x) => ({ ...x, media_type: 'tv' }))];
 } catch { rows = []; }

 const paint = () => {
 page.querySelectorAll('[data-view]').forEach((b) => b.classList.toggle('on', b.dataset.view === view));
 let list = rows.filter((r) => type === 'all' || r.media_type === type);
 if (q) { const lq = q.toLowerCase(); list = list.filter((r) => (r.title || r.name || '').toLowerCase().includes(lq) || (r.original_title || r.original_name || '').toLowerCase().includes(lq)); }
 list.sort((a, b) => {
 if (sort === 'title') return String(a.title || a.name || '').localeCompare(String(b.title || b.name || ''), 'ar');
 if (sort === 'rating') return (Number(b.vote_average) || 0) - (Number(a.vote_average) || 0);
 if (sort === 'year') return String(b.release_date || b.first_air_date || '').localeCompare(String(a.release_date || a.first_air_date || ''));
 return (b.addedAt || 0) - (a.addedAt || 0);
 });
 page.querySelector('#lb-count').textContent = `${rows.length} عمل — ${list.length} معروض · ${(rows.filter((r) => r.userRating || r.watched).length)} تم مشاهدتها`;
 body.innerHTML = '';
 if (!list.length) {
 body.appendChild(emptyState({
 iconName: rows.length ? 'search' : 'database',
 title: rows.length ? 'لا نتائج للفلتر الحالي' : 'مكتبتك لم تُبنَ بعد',
 desc: rows.length ? 'جرّب مسح البحث أو النوع — مكتبتك لم تتغير.' : 'أضِف مجلد وسائط من صندوق الوارد، أو أضِف أعمالاً من بطاقاتها. zPopcorn لا ينقل ولا يعدّل ملفاتك إطلاقاً.',
 actions: rows.length ? [] : [
 { label: 'صندوق الوارد', icon: 'inbox', onClick: () => window.router.navigate('/inbox') },
 { label: 'تصفح الأفلام', icon: 'film', kind: 'ghost', onClick: () => window.router.navigate('/movies') },
 ],
 }));
 return;
 }
 if (view === 'grid') {
 const g = el('div', 'media-grid');
 list.forEach((r) => g.appendChild(createMediaCard({ ...r, inLibrary: true, year: (r.release_date || r.first_air_date || '').slice(0, 4) }, { variant: 'poster' })));
 body.appendChild(g);
 } else {
 const wrap = el('div', 'z-tablewrap');
 wrap.innerHTML = `<table class="ztable"><thead><tr>
          <th>العنوان</th><th>النوع</th><th>السنة</th><th>التقييم</th><th>الحالة</th><th>أُضيف</th></tr></thead>
          <tbody>${list.slice(0, 300).map((r) => `
            <tr data-id="${esc(String(r.id ?? r.key))}" data-t="${r.media_type}">
              <td style="font-weight:700">${esc(r.title || r.name || '—')}</td>
              <td>${r.media_type === 'tv' ? 'مسلسل' : 'فيلم'}</td>
              <td class="num">${(r.release_date || r.first_air_date || '').slice(0, 4) || '—'}</td>
              <td class="num">${r.vote_average ? Number(r.vote_average).toFixed(1) : '—'}</td>
              <td>${r.watched ? '<span class="z-pill z-pill-ok">شوهد</span>' : r.userRating ? '<span class="z-pill">مقيَّم</span>' : '<span class="z-pill">في المكتبة</span>'}</td>
              <td style="color:var(--color-text-faint);font-size:11.5px">${r.addedAt ? new Date(r.addedAt).toLocaleDateString('ar') : '—'}</td>
            </tr>`).join('')}</tbody></table>`;
 wrap.querySelectorAll('tbody tr').forEach((tr) => {
 tr.style.cursor = 'pointer';
 tr.addEventListener('click', () => window.router.navigate(`/${tr.dataset.t === 'tv' ? 'tv' : 'movie'}/${tr.dataset.id}`));
 });
 body.appendChild(wrap);
 }
 };

 page.querySelectorAll('[data-type]').forEach((b) => b.addEventListener('click', () => {
 type = b.dataset.type;
 page.querySelectorAll('[data-type]').forEach((x) => x.classList.toggle('active', x === b));
 paint();
 }));
 page.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => { view = b.dataset.view; localStorage.setItem(VIEW_KEY, view); paint(); }));
 page.querySelector('#lb-sort').addEventListener('change', (e) => { sort = e.target.value; paint(); });
 let tq = null;
 page.querySelector('#lb-q').addEventListener('input', (e) => { clearTimeout(tq); tq = setTimeout(() => { q = e.target.value.trim(); paint(); }, 180); });
 paint();
 return page;
 }
}
