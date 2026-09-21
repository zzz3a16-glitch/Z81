/**
 * InboxPage — the smart-import review queue (spec 34–37).
 * Nothing enters the library without review when confidence is not certain.
 * Desktop mode drives everything through main (inbox.* / library.* IPC);
 * browser preview shows an honest, explained empty state.
 */
import { isDesktop, api } from '../bridge.js';
import { notificationService } from '../services/notification/NotificationService.js';
import { getTMDBImageUrl } from '../services/tmdb/TMDBImage.js';
import { icon } from '../ui/icons.js';
import { iconAnim } from '../ui/IconFX.js';

const toast = (o) => notificationService.showToast(o);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// zPopcorn icon family — InboxPage never ships its own glyphs (spec: one icon language)
const FAM = { inbox: 'inbox', scan: 'scan', ok: 'check', no: 'x', folder: 'folder', refresh: 'refresh', defer: 'clock', match: 'match', edit: 'edit' };
const svgIcon = (key, size = 15) => icon(FAM[key] || 'disc', size, { stroke: 1.8 });

const needsReview = (it) => !it.tmdb_id || !!it.duplicate_of || Number(it.confidence || 0) < 60;
const fmtSE = (s, e) => (s == null ? '' : `S${String(s).padStart(2, '0')}E${String(e ?? 0).padStart(2, '0')}`);
const shortPath = (p = '') => (p.length > 72 ? '…' + p.slice(-69) : p);
const fmtSize = (b) => (!b ? '' : b > 1e9 ? `${(b / 1e9).toFixed(1)} GB` : `${Math.max(1, Math.round(b / 1e6))} MB`);

export async function InboxPage() {
  const root = document.createElement('div');
  root.className = 'inbox-page';
  const view = new InboxView(root);
  await view.mount();
  return root;
}

class InboxView {
  constructor(root) {
    this.root = root;
    this.filter = 'all';
    this.status = 'pending';
    this.items = [];
    this.sources = [];
    this._onScanProgress = (e) => this.paintProgress(e.detail);
    this._onInboxChanged = () => this.refresh();
  }

  async mount() {
    this.root.innerHTML = `
      <div class="inbox-head">
        <div>
          <h1 class="inbox-title">${svgIcon('inbox', 21)} صندوق الوارد</h1>
          <p class="inbox-sub" id="inbox-summary">لا شيء معلّق بعد</p>
        </div>
        <div class="inbox-actions" id="inbox-actions"></div>
      </div>
      <div class="inbox-progress" id="inbox-progress" style="display:none;">
        <span data-role="phase">جارٍ الفحص</span>
        <div class="inbox-bar"><div class="inbox-bar-fill" data-role="bar"></div></div>
        <span data-role="num" dir="ltr"></span>
      </div>
      <div class="inbox-toolbar">
        <div class="inbox-chips" role="tablist" aria-label="تصفية">
          <button class="chip active" data-filter="all">الكل</button>
          <button class="chip" data-filter="review">يحتاج مراجعة</button>
          <button class="chip" data-filter="matched">مطابق لـ TMDB</button>
          <button class="chip" data-filter="unmatched">غير مطابق</button>
          <button class="chip" data-filter="lowconf">ثقة منخفضة</button>
        </div>
        <div class="inbox-status-tabs">
          <select id="inbox-status" class="input input-sm" aria-label="حالة العناصر">
            <option value="pending">قيد المراجعة</option>
            <option value="deferred">مؤجَّل</option>
            <option value="ignored">مرفوض</option>
            <option value="confirmed">مؤكد</option>
          </select>
        </div>
      </div>
      <div id="inbox-list" class="inbox-list"></div>
    `;

    if (!isDesktop) {
      this.root.querySelector('#inbox-list').innerHTML = `
        <div class="inbox-empty">
          <strong>صندوق الوارد يعمل في نسخة سطح المكتب</strong>
          <p>فحص المجلدات والاستيراد تُنفَّذ في عملية النظام عبر قنوات <span dir="ltr">import/inbox.*</span> — وضع المتصفح مخصص لمعاينة الواجهة فقط.</p>
        </div>`;
      this.root.querySelector('#inbox-summary').textContent = 'غير متاح في وضع المتصفح';
      this.bindStatic();
      return;
    }

    this.root.querySelector('#inbox-actions').innerHTML = `
      <select id="inbox-source" class="input input-sm" aria-label="مصدر الفحص" style="min-width:180px"></select>
      <button class="btn btn-secondary btn-sm" id="inbox-scan-btn">${icon('scan', 14, { weight: 'bold' })} فحص الآن</button>
      <button class="btn btn-ghost btn-sm" id="inbox-clear-btn">${svgIcon('refresh', 14)} تنظيف المؤكَّد</button>
    `;

    this.root.insertAdjacentHTML('beforeend', '<div class="inbox-sources" id="inbox-sources"></div>');

    this.bindStatic();
    this.bindDesktop();
    await Promise.all([this.loadSources(), this.refresh()]);

    window.addEventListener('zpopcorn:scan-progress', this._onScanProgress);
    window.addEventListener('zpopcorn:inbox-changed', this._onInboxChanged);
    window.addEventListener('zpopcorn:library-changed', this._onInboxChanged);
  }

  bindStatic() {
    this.root.querySelectorAll('.chip[data-filter]').forEach((b) => {
      b.addEventListener('click', () => {
        this.root.querySelectorAll('.chip[data-filter]').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        this.filter = b.dataset.filter;
        this.renderList();
      });
    });
    this.root.querySelector('#inbox-status')?.addEventListener('change', (e) => {
      this.status = e.target.value;
      if (isDesktop) this.refresh();
    });
  }

  bindDesktop() {
    this.root.querySelector('#inbox-scan-btn')?.addEventListener('click', async () => {
      const btn = this.root.querySelector('#inbox-scan-btn');
      const sel = this.root.querySelector('#inbox-source');
      const sourceId = sel && sel.value ? Number(sel.value) : null;
      btn.disabled = true;
      this.paintProgress({ phase: 'start' });
      try {
        const res = await api.inbox.scan({ sourceId });
        this.paintProgress({ phase: 'done' });
        toast({
          message: `اكتمل الفحص — ${res.files ?? 0} ملف، ${res.newCandidates ?? 0} مرشح جديد، ${res.autoConfirmed ?? 0} أُضيف تلقائياً`,
          type: 'success',
          duration: 6000,
        });
        await this.refresh();
      } catch (e) {
        this.paintProgress({ phase: 'done' });
        toast({ message: e.code === 'E_SCAN_RUNNING' ? 'يوجد فحص قيد التشغيل حالياً' : `فشل الفحص: ${e.message}`, type: 'error' });
      } finally {
        btn.disabled = false;
      }
    });

    this.root.querySelector('#inbox-clear-btn')?.addEventListener('click', async () => {
      try {
        const n = await api.inbox.clearResolved();
        toast({ message: `أُزيل ${n ?? 0} عنصراً محسوماً من القائمة`, type: 'info' });
        this.refresh();
      } catch (e) { toast({ message: e.message, type: 'error' }); }
    });
  }

  async loadSources() {
    const sel = this.root.querySelector('#inbox-source');
    if (!sel) return;
    try {
      this.sources = (await api.library.listSources()) || [];
    } catch { this.sources = []; }
    sel.innerHTML = this.sources.length
      ? `<option value="">كل المصادر المفعّلة</option>` +
        this.sources.map((s) => `<option value="${s.id}">${esc(s.label || s.name || s.path)}</option>`).join('')
      : '<option value="">لا توجد مصادر بعد — أضِف مجلداً بالأسفل</option>';
    this.paintSources();
  }

  paintSources() {
    const strip = this.root.querySelector('#inbox-sources');
    if (!strip || !isDesktop) return;
    const chips = this.sources.map((s) => `
      <span class="src-chip${s.enabled === false ? ' off' : ''}" data-id="${s.id}">
        ${svgIcon('folder', 13)}
        <b>${esc(s.label || s.name || s.path.split(/[\\/]/).pop())}</b>
        <em dir="ltr" title="${esc(s.path)}">${esc(s.path)}</em>
        ${s.enabled === false ? '<i class="src-off">معطّل</i>' : ''}
        <button class="src-x" data-remove="${s.id}" title="إزالة المصدر (الملفات على القرص لا تُمسح)">${icon("x",14)}</button>
      </span>`).join('');
    strip.innerHTML = `
      <div class="src-list">${chips || '<span class="src-empty">لا توجد مجلدات مكتبة — أضِف مجلداً ليبدأ الفحص الذكي</span>'}</div>
      <button class="btn btn-secondary btn-sm" id="inbox-add-src">+ إضافة مجلد مكتبة</button>`;
    strip.querySelector('#inbox-add-src')?.addEventListener('click', async () => {
      try {
        const picked = await api.system.pickFolder();
        if (!picked) return;
        const id = await api.library.addSource(picked);
        toast({ message: 'أُضيف المجلد — سيُفحص الآن', type: 'success' });
        await this.loadSources();
        if (id) { try { await api.inbox.scan({ sourceId: Number(id) }); } catch { /* running elsewhere */ } }
        await this.refresh();
      } catch (e) { toast({ message: `تعذّرت الإضافة: ${e.message}`, type: 'error' }); }
    });
    strip.querySelectorAll('[data-remove]').forEach((b) => {
      b.addEventListener('click', async () => {
        if (!confirm('إزالة هذا المجلد من مصادر المكتبة؟ (الملفات الأصلية لن تُحذف)')) return;
        try {
          await api.library.removeSource(Number(b.dataset.remove));
          await this.loadSources();
        } catch (e) { toast({ message: e.message, type: 'error' }); }
      });
    });
  }

  async refresh() {
    const list = this.root.querySelector('#inbox-list');
    if (!list) return;
    list.innerHTML = Array.from({ length: 4 }, () => '<div class="inbox-card-skel"></div>').join('');
    try {
      this.items = (await api.inbox.list({ status: this.status, limit: 500 })) || [];
    } catch (e) {
      this.items = [];
      toast({ message: `تعذّر تحميل صندوق الوارد: ${e.message}`, type: 'error' });
    }
    this.renderList();
    this.paintSummary();
  }

  paintSummary() {
    const s = this.root.querySelector('#inbox-summary');
    if (!s || !isDesktop) return;
    api.inbox.stats().then((st) => {
      const review = this.items.filter(needsReview).length;
      s.innerHTML = `${st.pending ?? 0} قيد المراجعة · ${review} يحتاج تدخلاً · ${st.confirmed ?? 0} مؤكد · ${st.ignored ?? 0} مرفوض${st.running ? ` · <span class="z-run">${iconAnim('importing', 20)}<b>فحص جارٍ الآن</b></span>` : ''}`;
    }).catch(() => { s.textContent = `${this.items.length} عنصر`; });
  }

  paintProgress(p = {}) {
    const el = this.root.querySelector('#inbox-progress');
    if (!el) return;
    const phaseLabels = { start: 'بدء الفحص', collect: 'جمع الملفات', parse: 'تحليل الأسماء', match: 'مطابقة TMDB', index: 'فهرسة المكتبة', 'source-done': 'إنهاء مصدر', done: null };
    if (!p || p.phase === 'done' || p.done) {
      el.style.display = 'none';
      const num = el.querySelector('[data-role=num]');
      if (num && p && p.done) num.textContent = `${p.newCandidates ?? 0} جديد`;
      return;
    }
    el.style.display = 'flex';
    el.querySelector('[data-role=phase]').textContent = phaseLabels[p.phase] || p.phase || 'جارٍ العمل';
    el.querySelector('[data-role=num]').textContent = p.files != null ? `${p.files} ملف` : '';
    if (p.files != null) {
      const pct = Math.min(95, 10 + Math.log10(1 + p.files) * 40);
      el.querySelector('[data-role=bar]').style.width = `${pct}%`;
    }
  }

  renderList() {
    const list = this.root.querySelector('#inbox-list');
    if (!list) return;
    if (!isDesktop) return;
    const f = this.filter;
    const items = this.items.filter((it) => {
      if (f === 'all') return true;
      if (f === 'review') return needsReview(it);
      if (f === 'matched') return !!it.tmdb_id;
      if (f === 'unmatched') return !it.tmdb_id;
      if (f === 'lowconf') return Number(it.confidence || 0) < 60;
      return true;
    });
    if (!items.length) {
      list.innerHTML = `<div class="inbox-empty">${this.items.length ? 'لا نتائج لهذا التصفية' : this.status === 'pending' ? `<div style="display:grid;justify-items:center;gap: var(--sp-3);padding: var(--sp-5) 0">${iconAnim('empty', 56)}<div>لا شيء معلّق — المكتبة محدثة</div></div>` : 'القائمة فارغة'}</div>`;
      return;
    }
    list.innerHTML = items.map((it) => this.cardHtml(it)).join('');

    list.querySelectorAll('[data-act]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = Number(btn.dataset.id);
        const it = this.items.find((x) => x.id === id);
        const act = btn.dataset.act;
        if (!it) return;
        btn.disabled = true;
        try {
          if (act === 'confirm') {
            const ok = await api.inbox.confirm(id);
            toast({ message: ok ? 'تمت الإضافة إلى المكتبة' : 'لم تُقبل العنصر — تحقق من الصحة', type: ok ? 'success' : 'warning' });
            await this.refresh();
          } else if (act === 'ignore') {
            await api.inbox.ignore(id);
            toast({ message: 'تم الرفض', type: 'info', duration: 2200 });
            await this.refresh();
          } else if (act === 'defer') {
            await api.inbox.defer(id);
            toast({ message: 'تم التأجيل', type: 'info', duration: 2200 });
            await this.refresh();
          } else if (act === 'rematch') {
            const r = await api.inbox.rematch(id);
            toast({ message: r && r.matched ? `وُجدت مطابقة: ${r.tmdb?.title || r.tmdb?.name || ''}` : 'لا توجد مطابقة مناسبة', type: r && r.matched ? 'success' : 'warning' });
            await this.refresh();
          } else if (act === 'show') {
            await api.system.showItemInFolder(it.path);
          } else if (act === 'edit') {
            this.openEditor(it);
          }
        } catch (e) {
          toast({ message: e.message, type: 'error' });
        } finally {
          btn.disabled = false;
        }
      });
    });
  }

  cardHtml(it) {
    const parsed = it.parsed || {};
    const conf = Math.round(Number(it.confidence || 0));
    const confColor = conf >= 92 ? 'var(--color-success)' : conf >= 60 ? 'var(--color-warning)' : 'var(--color-danger)';
    const kindLabel = it.media_type === 'tv'
      ? (it.episode != null ? `حلقة ${fmtSE(it.season, it.episode)}` : 'مسلسل')
      : it.media_type === 'anime' ? 'أنمي' : it.media_type === 'documentary' ? 'وثائقي' : 'فيلم';
    const match = it.tmdb_match || null;
    const poster = match?.poster ? `<img class="inbox-poster" src="${esc(getTMDBImageUrl(match.poster, 'poster', 'w154'))}" alt="" loading="lazy" onerror="this.style.display='none'">` : '<div class="inbox-poster inbox-poster-none">؟</div>';
    const flags = [];
    if (it.duplicate_of) flags.push(`<span class="flag flag-warn">مطابق لـ «${esc(it.existing_title || String(it.duplicate_of).split(':')[1] || '')}»</span>`);
    if (parsed.edition) flags.push(`<span class="flag">${esc(parsed.edition)}</span>`);
    if (parsed.quality) flags.push(`<span class="flag">${esc(parsed.quality)}</span>`);
    if (parsed.codec) flags.push(`<span class="flag" dir="ltr">${esc(parsed.codec)}</span>`);
    if (parsed.releaseGroup) flags.push(`<span class="flag" dir="ltr">[${esc(parsed.releaseGroup)}]</span>`);
    if (parsed.isEpisode && it.media_type !== 'tv') flags.push('<span class="flag flag-review">يبدو أنه حلقة — صحّح النوع</span>');
    if (needsReview(it)) flags.push('<span class="flag flag-review">مراجعة يدوية</span>');

    return `
      <article class="inbox-card" data-id="${it.id}">
        ${poster}
        <div class="inbox-body">
          <h3 class="inbox-card-title">
            ${esc(it.parsed?.title || match?.title || it.filename)}
            ${it.parsed?.year ? `<span class="muted">(${it.parsed.year})</span>` : ''}
            <span class="muted">· ${kindLabel}</span>
          </h3>
          <div class="inbox-file" dir="ltr" title="${esc(it.path)}">${esc(shortPath(it.filename))}${it.size_bytes ? ` · ${fmtSize(it.size_bytes)}` : ''}</div>
          ${match ? `<div class="inbox-match">${svgIcon('match', 13)} TMDB: ${esc(match.title || match.name || '')}${match.release_date ? ` (${String(match.release_date).slice(0, 4)})` : ''}</div>` : '<div class="inbox-nomatch">لا توجد مطابقة TMDB — يمكن البحث مجدداً أو التأكيد يدوياً</div>'}
          <div class="inbox-flags">${flags.join('')}</div>
        </div>
        <div class="inbox-side">
          <div class="inbox-conf" title="درجة الثقة ${conf}/100">
            <svg width="46" height="46" viewBox="0 0 46 46" aria-hidden="true">
              <circle cx="23" cy="23" r="19" fill="none" stroke="var(--color-border)" stroke-width="4"/>
              <circle cx="23" cy="23" r="19" fill="none" stroke="${confColor}" stroke-width="4"
                stroke-dasharray="${(conf / 100 * 119.4).toFixed(1)} 119.4" stroke-linecap="round"
                transform="rotate(-90 23 23)"/>
              <text x="23" y="27" text-anchor="middle" font-size="12" fill="currentColor">${conf}</text>
            </svg>
          </div>
          <div class="inbox-card-actions">
            ${this.status === 'pending' ? `
              <button class="btn btn-primary btn-sm" data-act="confirm" data-id="${it.id}">${svgIcon('ok', 13)} تأكيد</button>
              <button class="btn btn-ghost btn-sm" data-act="defer" data-id="${it.id}" title="تأجيل">${svgIcon('defer', 13)}</button>
              <button class="btn btn-ghost btn-sm" data-act="ignore" data-id="${it.id}" title="رفض">${svgIcon('no', 13)}</button>
            ` : `
              <button class="btn btn-secondary btn-sm" data-act="confirm" data-id="${it.id}">${svgIcon('ok', 13)} تأكيد الآن</button>
            `}
            ${!it.tmdb_id ? `<button class="btn btn-ghost btn-sm" data-act="rematch" data-id="${it.id}">بحث TMDB</button>` : ''}
            <button class="btn btn-ghost btn-sm" data-act="edit" data-id="${it.id}" title="تصحيح">${svgIcon('edit', 13)}</button>
            <button class="btn btn-ghost btn-sm" data-act="show" data-id="${it.id}" title="موقع الملف">${svgIcon('folder', 13)}</button>
          </div>
        </div>
      </article>`;
  }

  openEditor(it) {
    const card = this.root.querySelector(`.inbox-card[data-id="${it.id}"]`);
    if (!card || card.querySelector('.inbox-edit')) return;
    const row = document.createElement('div');
    row.className = 'inbox-edit';
    row.innerHTML = `
      <label>العنوان <input class="input input-sm" data-k="title" value="${esc(it.parsed?.title || '')}"></label>
      <label>السنة <input class="input input-sm" data-k="year" inputmode="numeric" style="width:84px" value="${it.parsed?.year || ''}"></label>
      <label>النوع
        <select class="input input-sm" data-k="media_type" style="width:130px">
          ${[['movie', 'فيلم'], ['tv', 'مسلسل'], ['anime', 'أنمي'], ['documentary', 'وثائقي'], ['special', 'خاص']]
            .map(([v, l]) => `<option value="${v}"${it.media_type === v ? ' selected' : ''}>${l}</option>`).join('')}
        </select>
      </label>
      <label>موسم <input class="input input-sm" data-k="season" inputmode="numeric" style="width:64px" value="${it.season ?? ''}"></label>
      <label>حلقة <input class="input input-sm" data-k="episode" inputmode="numeric" style="width:64px" value="${it.episode ?? ''}"></label>
      <span class="spacer"></span>
      <button class="btn btn-secondary btn-sm" data-x>إلغاء</button>
      <button class="btn btn-primary btn-sm" data-save>حفظ التصحيح</button>`;
    card.appendChild(row);
    row.querySelector('[data-x]').addEventListener('click', () => row.remove());
    row.querySelector('[data-save]').addEventListener('click', async () => {
      const val = (k) => row.querySelector(`[data-k="${k}"]`).value.trim();
      const patch = {
        media_type: val('media_type'),
        season: val('season') ? Number(val('season')) : '',
        episode: val('episode') ? Number(val('episode')) : '',
      };
      if (val('title') && val('title') !== (it.parsed?.title || '')) patch.title = val('title');
      const year = val('year') ? Number(val('year')) : null;
      if (year && year !== (it.parsed?.year || null)) patch.year = year;
      try {
        await api.inbox.update(it.id, patch);
        if (year && !it.tmdb_id) { try { await api.inbox.rematch(it.id); } catch { /* best effort */ } }
        toast({ message: 'تم الحفظ', type: 'success', duration: 2000 });
        await this.refresh();
      } catch (e) {
        toast({ message: `تعذّر الحفظ: ${e.message}`, type: 'error' });
      }
    });
    row.querySelector('[data-k="title"]')?.focus();
  }
}
