/**
 * DeveloperPage — live diagnostics from the main process (spec 63/64).
 * Every number here is read from the real system via typed IPC — no mock data.
 */
import { isDesktop, api } from '../bridge.js';
import { notificationService } from '../services/notification/NotificationService.js';

const toast = (o) => notificationService.showToast(o);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const kv = (k, v, ltr = false) =>
  `<div class="dev-kv"><span class="k">${esc(k)}</span><span class="v"${ltr ? ' dir="ltr"' : ''}>${esc(v)}</span></div>`;

const section = (title, id, actions = '') => `
  <section class="dev-card">
    <header class="dev-card-head"><h2>${esc(title)}</h2><div class="dev-card-actions">${actions}</div></header>
    <div class="dev-card-body" id="${id}"><div class="dev-skel"></div></div>
  </section>`;

export async function DeveloperPage() {
  const root = document.createElement('div');
  root.className = 'dev-page';
  root.innerHTML = `
    <header class="dev-head">
      <h1 class="page-title">وضع المطور</h1>
      <p>قراءات حية من عملية النظام — قاعدة البيانات، الكاش، TMDB، الصحة، السجلات.</p>
    </header>
    ${isDesktop ? `
    <div class="dev-grid">
      ${section('البيئة', 'dev-env')}
      ${section('قاعدة البيانات', 'dev-db', '<button class="btn btn-secondary btn-sm" data-act="backup">نسخة احتياطية الآن</button>')}
      ${section('الإعدادات', 'dev-settings')}
      ${section('TMDB والكاش', 'dev-cache', '<button class="btn btn-secondary btn-sm" data-act="clear-cache">تفريغ كاش الصور</button>')}
      ${section('المكتبة والوارد', 'dev-lib', '<button class="btn btn-secondary btn-sm" data-act="scan">فحص الوارد</button>')}
      ${section('الصحة والتكرار', 'dev-health', '<button class="btn btn-secondary btn-sm" data-act="health">إعادة الفحص</button>')}
      ${section('السجلات', 'dev-logs', '<button class="btn btn-secondary btn-sm" data-act="logs">تحديث</button>')}
    </div>` : `
    <div class="inbox-empty" style="padding:48px;text-align:center">
      <strong>أدوات المطور متاحة في نسخة سطح المكتب</strong>
      <p>تقرأ هذه الصفحة حالة خدمات النظام مباشرة عبر الجسر الآمن — وضع المتصفح لا يملك عملية نظام.</p>
    </div>`}
  `;

  if (!isDesktop) return root;

  const view = new DevView(root);
  await view.load();
  view.bind();
  return root;
}

class DevView {
  constructor(root) { this.root = root; this.diag = null; }

  bind() {
    this.root.querySelectorAll('[data-act]').forEach((b) => {
      b.addEventListener('click', async () => {
        b.disabled = true;
        try {
          const act = b.dataset.act;
          if (act === 'backup') { const r = await api.backup.create('manual-dev'); toast({ message: `أُنشئت نسخة احتياطية${r?.file ? `: ${String(r.file).split(/[\\\\/]/).pop()}` : ''}`, type: 'success' }); }
          if (act === 'clear-cache') { const r = await api.cache.clear({ images: 'all' }); toast({ message: `حُذف ${r?.imageFiles ?? 0} ملف صور مؤقت`, type: 'info' }); }
          if (act === 'scan') { toast({ message: 'بدأ الفحص — تابع التقدم في صندوق الوارد', type: 'info' }); api.inbox.scan({}); }
          if (act === 'health') { await api.health.run({}); toast({ message: 'اكتمل فحص الصحة', type: 'success' }); }
          if (act === 'logs') { this.loadLogs(); return; }
          await this.load();
        } catch (e) { toast({ message: e.message, type: 'error' }); } finally { b.disabled = false; }
      });
    });
  }

  put(id, html) { const el = this.root.querySelector('#' + id); if (el) el.innerHTML = html; }

  async load() {
    try {
      this.diag = await api.system.getDiagnostics();
    } catch (e) {
      this.put('dev-env', `<div class="dev-err">تعذّر جلب التشخيصات: ${esc(e.message)}</div>`);
      return;
    }
    const d = this.diag;
    const app = d.app || {};
    const paths = app.paths || {};

    this.put('dev-env', `
      ${kv('الإصدار', `${app.version || '—'} (${app.packaged ? 'مُغلَّف' : 'تطوير'})`, true)}
      ${kv('Electron / Chrome / Node', `${app.electron} · ${app.chrome} · ${app.node}`, true)}
      ${kv('النظام', `${app.platform} ${app.arch}`, true)}
      ${kv('اتصال TMDB', d.online === true ? 'متصل حديثاً' : d.online === false ? 'متقطّع — يخدم من الكاش' : 'غير معروف')}
    `);

    const dbS = d.database || {};
    const counts = d.counts || {};
    this.put('dev-db', `
      ${kv('المحرك', dbS.driver || '—', true)}
      ${kv('الملف', dbS.path || paths.database || '—', true)}
      ${kv('الحجم', dbS.sizeBytes != null ? `${(dbS.sizeBytes / 1024 / 1024).toFixed(2)} MB` : dbS.size || '—', true)}
      ${kv('الفحص السريع', dbS.integrity || '—', true)}
      ${kv('إصدار المخطط', dbS.version != null ? String(dbS.version) : '—', true)}
      ${kv('الاستعلامات', String(dbS.queries ?? 0), true)}
      ${kv('الجداول', Object.entries(counts).map(([k, n]) => `${k}:${n}`).join(' · ') || '—', true)}
    `);

    const s = d.settings || {};
    this.put('dev-settings', `
      ${kv('المنطقة', s.region || '—')}${kv('اللغة', s.language || '—', true)}
      ${kv('وضع المطور', s.devMode ? 'مفعّل' : 'غير مفعّل')}
    `);

    const t = d.tmdb || {};
    const c = d.cache || {};
    this.put('dev-cache', `
      ${kv('مفتاح TMDB', t.configured ? 'مضبوط' : 'غير مضبوط')}
      ${kv('آخر نجاح شبكي', t.lastOkAt ? new Date(t.lastOkAt).toLocaleString('ar-SA') : 'لا يوجد')}
      ${kv('آخر خطأ', t.lastError || 'لا شيء', true)}
      ${kv('إدخالات كاش الميتاداتا', String(c.metadata?.entries ?? t.entries ?? 0), true)}
      ${kv('إصابات الكاش', String(c.metadata?.hits ?? t.hits ?? 0), true)}
      ${kv('ملفات الصور', String(c.images?.imageCount ?? c.images?.files ?? 0), true)}
      ${kv('حجم الصور', c.images?.bytes != null ? `${(c.images.bytes / 1024 / 1024).toFixed(1)} MB` : '—', true)}
    `);

    let inbox = null; let libStats = null;
    try { inbox = await api.inbox.stats(); } catch { /* ignore */ }
    try { libStats = await api.library.stats(); } catch { /* ignore */ }
    this.put('dev-lib', `
      ${kv('أفلام', String(libStats?.movies ?? '—'), true)}
      ${kv('مسلسلات', String(libStats?.tv ?? libStats?.tvshows ?? '—'), true)}
      ${kv('ملفات وسائط', String(libStats?.files ?? '—'), true)}
      ${kv('وارد معلّق', String(inbox?.pending ?? '—'), true)}
      ${kv('وارد مؤكد', String(inbox?.confirmed ?? '—'), true)}
      ${kv('حالة الفحص', inbox?.running ? 'جارٍ الآن' : 'خامل')}
    `);

    let hs = null; let ds = null;
    try { hs = await api.health.stats(); } catch { /* ignore */ }
    try { ds = await api.duplicates.stats(); } catch { /* ignore */ }
    this.put('dev-health', `
      ${kv('إجمالي المشاكل المفتوحة', hs ? String(hs.total ?? 0) : 'لم يُشغَّل بعد', true)}
      ${hs ? kv('أخطاء / تحذيرات / معلومات', `${hs.error} / ${hs.warning} / ${hs.info}`, true) : ''}
      ${kv('أزواج مكررة', ds ? String(ds.pairs ?? 0) : '—', true)}
      ${kv('قرارات تكرار محفوظة', ds ? String(ds.decisions ?? 0) : '—', true)}
      ${hs?.lastRunAt ? kv('آخر فحص', new Date(hs.lastRunAt).toLocaleString('ar-SA')) : ''}
    `);

    this.loadLogs(d.logs);
  }

  async loadLogs(existing) {
    const el = this.root.querySelector('#dev-logs');
    if (!el) return;
    try {
      const logs = existing ?? await api.system.getLogs(250);
      const text = Array.isArray(logs) ? logs.join('\n') : String(logs || '');
      if (!text.trim()) { el.innerHTML = '<div class="dev-err">لا توجد سجلات بعد</div>'; return; }
      el.innerHTML = `<pre class="dev-logs" dir="ltr">${text.split('\n').slice(-250).map((l) => `<span class="${/\bERROR\b/.test(l) ? 'lv-e' : /\bWARN\b/.test(l) ? 'lv-w' : ''}">${esc(l)}</span>`).join('\n')}</pre>`;
    } catch (e) {
      el.innerHTML = `<div class="dev-err">تعذّر قراءة السجلات: ${esc(e.message)}</div>`;
    }
  }
}
