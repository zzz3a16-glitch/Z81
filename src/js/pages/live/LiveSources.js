/**
 * IPTV Sources — full lifecycle per source (spec 04): add URL/file, edit,
 * enable/disable, refresh, re-import, clear cache, delete. Every source is
 * isolated: a broken playlist degrades its own card only.
 */
import { el, esc } from '../../ui/primitives.js';
import { icon } from '../../ui/icons.js';
import { live } from '../../services/live/LiveService.js';
import { isDesktop, api } from '../../bridge.js';
import { liveShell, statusPill, stateBlock, ago, toast } from './live-ui.js';

const hostOf = (u) => { try { return new URL(u).host; } catch { return u || 'ملف محلي'; } };

export async function LiveSourcesPage() {
  await live.init();
  const root = el('div', 'zlv-page zlv-sources');
  const { frag, main } = liveShell('sources');
  root.appendChild(frag);

  /* ── add panel ── */
  const add = el('div', 'zlv-addpanel');
  add.innerHTML = `
    <h3>${icon('plus', 16)} إضافة مصدر IPTV</h3>
    <div class="grid">
      <label>اسم المصدر<input type="text" data-n placeholder="مثال: قائمة مزوّدتي"></label>
      <label>رابط قائمة M3U / M3U8<input dir="ltr" type="url" data-u placeholder="https://…/playlist.m3u"></label>
      <label>رابط الدليل XMLTV (اختياري)<input dir="ltr" type="url" data-e placeholder="https://…/epg.xml.gz→لا يُدعم الضغط بعد؛ xml عادي"></label>
    </div>
    <div class="row">
      <button class="btn btn-primary btn-sm" data-add>${icon('download', 15)} إضافة واستيراد</button>
      <label class="btn btn-ghost btn-sm" tabindex="0">${icon('folderOpen', 15)} استيراد ملف .m3u محلي…
        <input type="file" data-file accept=".m3u,.m3u8,.txt,audio/x-mpegurl,application/x-mpegurl" hidden></label>
      <span class="sp"></span>
      <button class="btn btn-ghost btn-sm" data-refreshall>${icon('refresh', 15)} تحديث الكل</button>
    </div>
    <p class="hint">${icon('shield', 13)} تُجلب القوائم عبر طبقة آمنة بحدّ حجم وزمن؛ قناة تالفة واحدة لا تُسقط الاستيراد.</p>
  `;
  main.appendChild(add);

  const list = el('div', 'zlv-srclist');
  main.appendChild(list);

  /* ── add logic ── */
  const btnAdd = add.querySelector('[data-add]');
  const doAdd = async () => {
    const url = add.querySelector('[data-u]').value.trim();
    const name = add.querySelector('[data-n]').value.trim();
    const epg = add.querySelector('[data-e]').value.trim();
    if (!/^https?:\/\//i.test(url)) { toast('warning', 'رابط غير صالح', 'استخدم رابط http/https كاملاً للقائمة.'); return; }
    btnAdd.disabled = true;
    try {
      const out = await live.addSource({ name: name || hostOf(url), url, epgUrl: epg });
      const imp = out?.import || {};
      if (imp.status === 'ok') {
        toast('success', 'تم التحميل', `${(imp.count || 0).toLocaleString('ar-EG')} قناة جاهزة في ${(imp.ms / 1000).toFixed(1)} ث`);
        add.querySelector('[data-u]').value = ''; add.querySelector('[data-n]').value = ''; add.querySelector('[data-e]').value = '';
      } else if (imp.status === 'cancelled') toast('info', 'أُلغيت العملية', 'الحفظ في القائمة لا يزال متاحًا.');
      else toast('error', 'أُضيف المصدر لكن لم تُحمّل قنوات', `${imp.error || 'تعذّر الجلب'} — افتحي «التشخيص» في بطاقة المصدر.`);
      render();
    } catch (e) {
      toast('error', 'تعذّرت الإضافة', e?.message || 'خطأ غير معروف');
      render();
    } finally { btnAdd.disabled = false; }
  };
  btnAdd.addEventListener('click', doAdd);
  add.querySelector('[data-refreshall]').addEventListener('click', async (e) => {
    const b = e.currentTarget; b.disabled = true; b.innerHTML = `${icon('loading', 15, { cls: 'spin' })} تحديث الكل…`;
    await live.refreshAll();
    b.disabled = false; b.innerHTML = `${icon('refresh', 15)} تحديث الكل`;
    render();
  });
  const fileIn = add.querySelector('[data-file]');
  fileIn.addEventListener('change', () => {
    const f = fileIn.files?.[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = async () => {
      try {
        const out = await live.addSource({ name: f.name.replace(/\.[a-z0-9]+$/i, ''), kind: 'file', text: String(rd.result) });
        const imp = out?.import || {};
        if (imp.status === 'ok') toast('success', 'استُورد الملف', `${(imp.count || 0).toLocaleString('ar-EG')} قناة — محفوظ محليًا ويُعاد تحليله عند الحاجة.`);
        else toast('error', 'الملف لا يحوي قنوات', `${imp.error || 'صيغة غير مفهومة'} — استخدمي قائمة m3u صالحة.`);
        render();
      } catch (e) { toast('error', 'ملف غير صالح', e?.message); }
      fileIn.value = '';
    };
    rd.readAsText(f);
  });

  /* ── cards ── */
  function card(src) {
    const c = el('div', `zlv-src s-${src.status}${src.enabled === false ? ' off' : ''}`);
    c.dataset.sid = src.id;
    const epgLine = src.epgUrl
      ? (src.epgBuiltAt
        ? `${icon('check', 12)} دليل مُحدّث ${ago(src.epgBuiltAt)} · ${src.epgChannels || 0} قناة`
        : `${icon('clock', 12)} دليل لم يُجلب بعد`)
      : `${icon('eyeOff', 12)} بلا دليل`;
    c.innerHTML = `
      <div class="top">
        <h4>${esc(src.name)}</h4>
        ${statusPill(src)}
      </div>
      <p class="u" dir="ltr">${esc(src.url ? hostOf(src.url) + src.url.replace(/^https?:\/\/[^/]+/, '').slice(0, 44) : 'ملف محلي')}</p>
      <div class="meta">
        <span>${icon('tv', 13)} <b data-count>${(src.channelCount || 0).toLocaleString('ar-EG')}</b> قناة</span>
        <span>${icon('layers', 13)} ${src.groupsCount || 0} مجموعة</span>
        <span>${icon('refresh', 13)} ${src.lastUpdate ? ago(src.lastUpdate) : 'لم يُحدَّث'}</span>
        <span class="epg" title="${src.epgUrl ? 'EPG' : 'لا رابط دليل'}">${epgLine}</span>
      </div>
      ${src.error ? `<p class="err">${icon('alert', 13)} ${esc(src.error)}</p>` : ''}
      ${src.status === 'importing' ? `<p class="imp" data-imp>${icon('loading', 13, { cls: 'spin' })} جارٍ الجلب والتحليل… <button class="btn btn-ghost btn-sm" data-act="cancelimp" type="button">إلغاء</button></p>` : ''}
      ${src.status === 'ok' && src.stale ? `<p class="imp stale">${icon('clock', 13)} القائمة قديمة (مضت أكثر من ${live.config.liveTtlDays || 7} أيام على آخر تحديث) — حدّثيها.</p>` : ''}
      <div class="acts">
        <button class="btn btn-ghost btn-sm" data-act="refresh">${icon('refresh', 14)} تحديث</button>
        <button class="btn btn-ghost btn-sm" data-act="toggle">${src.enabled === false ? `${icon('check', 14)} تفعيل` : `${icon('eyeOff', 14)} تعطيل`}</button>
        <button class="btn btn-ghost btn-sm" data-act="edit">${icon('edit', 14)} تحرير</button>
        <button class="btn btn-ghost btn-sm" data-act="diag">${icon('chart', 14)} التشخيص</button>
        <button class="btn btn-ghost btn-sm" data-act="cache">${icon('trash', 14)} مسح المخزن</button>
        <button class="btn btn-ghost btn-sm danger" data-act="del">${icon('delete', 14)} حذف</button>
      </div>
      <div class="zlv-diag" hidden></div>
      <div class="editpanel" hidden>
        <label>الاسم<input data-en value="${esc(src.name)}"></label>
        <label>رابط القائمة<input dir="ltr" data-eu value="${esc(src.url || '')}"></label>
        <label>رابط الدليل<input dir="ltr" data-ee value="${esc(src.epgUrl || '')}"></label>
        <div class="row"><button class="btn btn-primary btn-sm" data-act="save">حفظ</button>
        <button class="btn btn-ghost btn-sm" data-act="cancel">إلغاء</button></div>
      </div>`;
    if (isDesktop && src.logoCount) { /* future: show cached logo stats */ }
    c.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const act = b.dataset.act;
      if (act === 'refresh') { b.disabled = true; await live.importSource(src.id, { force: true }); b.disabled = false; render(); }
      if (act === 'cancelimp') { live.cancelImport(src.id); setTimeout(render, 350); }
      if (act === 'diag') {
        const d = c.querySelector('.zlv-diag');
        if (!d.hidden) { d.hidden = true; return; }
        d.hidden = false; renderDiag(d, src);
      }
      if (act === 'toggle') { await live.toggleSource(src.id); render(); }
      if (act === 'edit') { const p = c.querySelector('.editpanel'); p.hidden = !p.hidden; p.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
      if (act === 'cancel') c.querySelector('.editpanel').hidden = true;
      if (act === 'save') {
        const p = c.querySelector('.editpanel');
        await live.updateSource(src.id, {
          name: p.querySelector('[data-en]').value.trim() || src.name,
          url: p.querySelector('[data-eu]').value.trim(),
          epgUrl: p.querySelector('[data-ee]').value.trim(),
        });
        toast('success', 'حُفظ', 'استُعيد الإعداد — حدّث المصدر لتطبيق التغييرات.');
        render();
      }
      if (act === 'cache') {
        if (b.dataset.armed === '1') {
          await live.clearSourceCache(src.id);
          if (isDesktop && api.live) await api.live.purge({ sourceId: src.id, logos: true }).catch(() => {});
          toast('success', 'مُسح المخزن', 'احذف وأعد الاستيراد لاستعادة القنوات.');
          render();
        } else { b.dataset.armed = '1'; b.innerHTML = `${icon('warning', 14)} اضغط للتأكيد`; setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.innerHTML = `${icon('trash', 14)} مسح المخزن`; } }, 4000); }
      }
      if (act === 'del') {
        if (b.dataset.armed === '1') {
          await live.removeSource(src.id);
          toast('success', 'حُذف المصدر', 'أُزيلت قوائمه ودليله وصوره المخزنة.');
          render();
        } else { b.dataset.armed = '1'; b.innerHTML = `${icon('warning', 14)} تأكيد الحذف نهائيًا`; setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.innerHTML = `${icon('delete', 14)} حذف`; } }, 4000); }
      }
    });
  function renderDiag(d, src) {
    const g = src.diag || {};
    const rows = [
      ['الحالة', src.error ? `${src.error}` : { ok: 'تعمل', importing: 'جارٍ التحديث', new: 'لم تُستورد بعد', empty: 'فارغة', error: 'فشل', invalid: 'صيغة غير صالحة' }[src.status] || src.status || '—'],
      ['HTTP', g.httpStatus ?? g.test?.httpStatus ?? '—'],
      ['زمن الاستجابة', g.ms ? `${g.ms} ms` : g.failMs ? `${g.failMs} ms (فشل)` : '—'],
      ['حجم الاستجابة', g.bytes ? `${Math.max(1, Math.round(g.bytes / 1024))} KB${g.truncated ? ' (مقطوعة عند السقف)' : ''}` : '—'],
      ['نوع المحتوى', g.contentType || '—'],
      ['الصيغة المكتشفة', g.format || g.test?.format || '—'],
      ['أسطر البث', g.lines ?? g.test?.streamLines ?? '—'],
      ['آخر نجاح', src.lastSuccessAt ? new Date(src.lastSuccessAt).toLocaleString('ar-EG') : src.lastUpdate ? ago(src.lastUpdate) : 'لا يوجد'],
      ['مسار الاتصال', g.via === 'desktop' ? 'طبقة النظام (Electron)' : g.via === 'dev-proxy' ? 'وسيط المطوّرين (QA)' : g.via === 'direct' ? 'مباشر (CORS مسموح)' : g.via === 'browser' ? 'متصفح' : '—'],
      ['سجل الكاش', live.playlists.has(src.id) ? (live.playlists.get(src.id).partial ? 'مؤقت أثناء التحليل' : 'يوجد — لا يُعاد الجلب إلا عند التحديث') : 'لا يوجد — سيُجلب عند أول استخدام'],
      ['الخطأ الأخير', src.error || 'لا أخطاء'],
    ];
    d.innerHTML = `<h5>${icon('chart', 14)} تشخيص المصدر <button class="btn btn-ghost btn-sm" data-test type="button">${icon('bolt', 13)} اختبار المصدر الآن</button></h5>
      <div class="kv">${rows.map(([k, v]) => `<b>${esc(k)}</b><span dir="auto">${esc(String(v))}</span>`).join('')}</div>
      <div class="sample" hidden></div>`;
    d.querySelector('[data-test]').addEventListener('click', async (e) => {
      const btn = e.currentTarget; btn.disabled = true; btn.innerHTML = `${icon('loading', 13, { cls: 'spin' })} اختبار…`;
      const r = await live.testSource(src.id);
      btn.disabled = false; btn.innerHTML = `${icon('bolt', 13)} اختبار المصدر الآن`;
      const sm = d.querySelector('.sample'); sm.hidden = false;
      sm.innerHTML = r.ok
        ? `<p class="good">${icon('check', 12)} ${r.ms} ms · HTTP ${r.httpStatus} · صيغة: ${esc(r.format)} · ${r.streamLines} سطر بث${r.truncated ? ' · مقاطع' : ''}</p>${(r.preview || []).map((l) => `<code dir="ltr">${esc(l)}</code>`).join('')}`
        : `<p class="bad">${icon('alert', 12)} ${esc(r.message)}${r.ms ? ` · بعد ${r.ms} ms` : ''}</p>`;
    });
  }

    return c;
  }

  function render() {
    list.innerHTML = '';
    const srcs = live.sources;
    if (!srcs.length) {
      list.appendChild(stateBlock({
        anim: 'empty', title: 'لا مصادر — ابدأ بمصدر واحد',
        desc: 'الصق رابط M3U أو اختر ملفًا من جهازك؛ يبقى كل شيء محليًا.',
      }));
      return;
    }
    for (const s of srcs) list.appendChild(card(s));
  }

  /* progress live-updates without rebuilding every card */
  const onEv = (e) => {
    const d = e.detail || {};
    if (d.type === 'progress' && d.sourceId) {
      const c = list.querySelector(`[data-sid="${d.sourceId}"]`);
      if (!c) { render(); return; }
      const imp = c.querySelector('[data-imp]');
      if (d.status === 'importing' && imp) imp.innerHTML = `${icon('loading', 13, { cls: 'spin' })} جارٍ الجلب والتحليل…${d.lines ? ` (${d.lines.toLocaleString('ar-EG')} سطر)` : ''}${d.channels ? ` · ${d.channels.toLocaleString('ar-EG')} قناة متاحة الآن` : ''} <button class="btn btn-ghost btn-sm" data-act="cancelimp" type="button">إلغاء</button>`;
      else render();
    }
    if (d.type === 'imported' || d.type === 'sources' || d.type === 'error') render();
  };
  window.addEventListener('zpopcn-live', onEv);
  root.__zpopCleanup = () => window.removeEventListener('zpopcn-live', onEv);

  render();
  return root;
}
