/**
 * Live Settings (spec 14) — every switch drives real behavior:
 * launch mode → LiveService.launch · EPG cadence → ticker · retention → queries ·
 * data ops → doc_store clears. No dead controls.
 */
import { el, esc } from '../../ui/primitives.js';
import { icon } from '../../ui/icons.js';
import { live } from '../../services/live/LiveService.js';
import { db } from '../../services/storage/Database.js';
import { isDesktop, api } from '../../bridge.js';
import { liveShell, toast } from './live-ui.js';

function row({ title, desc = '', control }) {
  const r = el('div', 'zlv-setrow');
  r.innerHTML = `<div class="t"><b>${esc(title)}</b>${desc ? `<p>${esc(desc)}</p>` : ''}</div>`;
  r.appendChild(control);
  return r;
}
const seg = (opts, value, onChange, icons = {}) => {
  const s = el('div', 'zlv-seg');
  s.innerHTML = opts.map(([v, l]) => `<button type="button" data-v="${v}" class="${v === value ? 'on' : ''}">${icons[v] ? icon(icons[v], 13) : ''} ${esc(l)}</button>`).join('');
  s.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-v]'); if (!b) return;
    s.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    await onChange(b.dataset.v);
  });
  return s;
};
const toggle = (value, onChange) => {
  const t = el('button', `zlv-switch${value ? ' on' : ''}`);
  t.type = 'button'; t.setAttribute('role', 'switch'); t.setAttribute('aria-checked', String(!!value));
  t.innerHTML = '<i></i>';
  t.addEventListener('click', async () => {
    const next = !t.classList.contains('on');
    t.classList.toggle('on', next); t.setAttribute('aria-checked', String(next));
    await onChange(next);
  });
  return t;
};
const dangerBtn = (label, iconN, run, done) => {
  const b = el('button', 'btn btn-ghost btn-sm danger', `${icon(iconN, 14)} ${esc(label)}`);
  b.type = 'button';
  let armed = false;
  b.addEventListener('click', async () => {
    if (!armed) { armed = true; b.innerHTML = `${icon('warning', 14)} اضغط للتأكيد`; setTimeout(() => { if (b.isConnected) { armed = false; b.innerHTML = `${icon(iconN, 14)} ${esc(label)}`; } }, 4500); return; }
    b.disabled = true;
    await run();
    b.disabled = false; armed = false; b.innerHTML = `${icon(iconN, 14)} ${esc(label)}`;
    toast('success', 'تم', done);
  });
  return b;
};

export async function LiveSettingsPage() {
  await live.init();
  const root = el('div', 'zlv-page zlv-settings');
  const { frag, main } = liveShell('settings');
  root.appendChild(frag);

  const cfg = live.config;

  const block = (title, iconName, rows) => {
    const b = el('section', 'zlv-setblock');
    b.innerHTML = `<h3>${icon(iconName, 16)} ${esc(title)}</h3>`;
    for (const r of rows) b.appendChild(r);
    main.appendChild(b);
    return b;
  };

  /* ── تشغيل ── */
  block('التشغيل', 'play', [
    row({
      title: 'طريقة فتح البث',
      desc: 'zPopcorn لا يشغّل الفيديو داخليًا — يسلّم القناة للمشغّل الخارجي المرتبط بنظامك (VLC / mpv…).',
      control: seg([['session', 'ملف جلسة (يُنصح)', ], ['direct', 'رابط مباشر']], cfg.launch || 'session',
        async (v) => { await live.setConfig({ launch: v }); }, { session: 'save', direct: 'external' }),
    }),
    row({
      title: 'إظهار قناة واحدة في كل مرة',
      desc: 'تبديل القناة يُغلق جلسة التشغيل السابقة وينظّف ملفها.',
      control: toggle(cfg.oneSession !== false, async (v) => await live.setConfig({ oneSession: v })),
    }),
  ]);

  /* ── الدليل ── */
  const epgRows = [
    row({
      title: 'تحديث الدليل تلقائيًا',
      desc: 'الفصل الزمني بين التحديثات أثناء تصفح أقسام LIVE.',
      control: seg([['60', 'ساعة'], ['360', '6 ساعات'], ['720', '12 ساعة'], ['1440', 'يومي']], String(cfg.epgMinutes || 360),
        async (v) => await live.setConfig({ epgMinutes: +v }), {}),
    }),
    row({
      title: 'حالة الدليل',
      desc: 'ملفات XMLTV المربوطة بمصادر فعّالة.',
      control: (() => {
        const box = el('div', 'zlv-epgstate');
        const paint = () => {
          const ready = live.epgReadySources().filter((s) => s.enabled !== false);
          const built = ready.filter((s) => live.epgStatus.get(s.id)?.builtAt);
          box.innerHTML = `<span class="pill">${icon('guide', 13)} ${built.length}/${ready.length || 0} مصدر مزوّد بدليل</span>
            <button class="btn btn-ghost btn-sm" data-upd>${icon('refresh', 14)} تحديث الآن</button>`;
          box.querySelector('[data-upd]')?.addEventListener('click', async (e) => {
            const b = e.currentTarget; b.disabled = true; b.innerHTML = `${icon('loading', 14, { cls: 'spin' })} تحديث…`;
            await live.refreshEpgAll(); paint();
            b.disabled = false;
          });
        };
        paint();
        box.__paint = paint;
        return box;
      })(),
    }),
    row({
      title: 'مسح ذاكرة الدليل',
      desc: 'يحذف برنامج cache اليومي لكل مصدر — يُعاد الجلب عند الحاجة.',
      control: dangerBtn('مسح الدليل', 'trash', async () => { await live.clearEpg(); }, 'مُسحت بيانات الدليل'),
    }),
  ];
  block('دليل البرامج (EPG)', 'guide', epgRows);

  /* ── البيانات ── */
  let statsBox;
  const paintStats = async () => {
    const [pl, fh, hc, ep] = await Promise.all([
      db.getAll('live_playlists').catch(() => []), db.getAll('live_favs').catch(() => []),
      db.getAll('live_history').catch(() => []), db.getAll('live_epg').catch(() => []),
    ]);
    const st = live.stats();
    statsBox.innerHTML = `
      <span>${icon('sources', 13)} <b>${st.sources}</b> مصدر</span>
      <span>${icon('tv', 13)} <b>${(st.channels || 0).toLocaleString('ar-EG')}</b> قناة</span>
      <span>${icon('layers', 13)} ${st.groups} مجموعة</span>
      <span>${icon('heart', 13)} ${st.favs} مفضلة</span>
      <span>${icon('history', 13)} ${st.history} في السجل</span>
      <span>${icon('guide', 13)} ${ep.length} ملف دليل</span>`;
  };
  block('البيانات', 'database', [
    row({ title: 'محتوى قسم LIVE', desc: 'محلي بالكامل — لا يُرسل أي شيء لأي خدمة.', control: (() => { statsBox = el('div', 'zlv-stats'); return statsBox; })() }),
    row({
      title: 'إعادة تحليل كل القوائم',
      desc: 'يُعيد تشغيل خط الأنابيب: جلب → تحليل → تطبيع → تصنيف → تخزين. المصادر تُحدَّث واحدة تلو الأخرى.',
      control: (() => {
        const b = el('button', 'btn btn-ghost btn-sm', `${icon('refresh', 14)} إعادة التحليل`);
        b.type = 'button';
        b.addEventListener('click', async () => {
          b.disabled = true; b.innerHTML = `${icon('loading', 14, { cls: 'spin' })} قيد التحليل…`;
          await live.refreshAll();
          b.disabled = false; b.innerHTML = `${icon('refresh', 14)} إعادة التحليل`;
          toast('success', 'اكتمل', 'أُعيد تحليل جميع المصادر.');
          paintStats();
        });
        return b;
      })(),
    }),
    row({
      title: 'صلاحية القوائم المحفوظة',
      desc: 'بعد انقضائها تُوسم البطاقات «قائمة قديمة» مع دعوة للتحديث — لا يُجلب شيء تلقائيًا في الخلفية.',
      control: seg([['3', '٣ أيام'], ['7', 'أسبوع'], ['30', 'شهر'], ['90', '٣ أشهر']], String(cfg.liveTtlDays ?? 7),
        async (v) => { await live.setConfig({ liveTtlDays: +v }); for (const x of live.sources) x.stale = x.status === 'ok' && x.lastUpdate && Date.now() - x.lastUpdate > (+v) * 864e5; }, {}),
    }),
    row({
      title: 'مسح سجل المشاهدة',
      desc: 'يحذف تتبع القنوات التي شاهدتها (لن يمس المفضلة).',
      control: dangerBtn('مسح السجل', 'history', async () => { await live.clearHistory(); paintStats(); }, 'مُسح سجل المشاهدة'),
    }),
    row({
      title: 'مسح كل المخزّن للقنوات',
      desc: 'يحذف القوائم المُحللة وصور الشعارات — المصادر تبقى كما هي.',
      control: dangerBtn('مسح القوائم', 'trash', async () => {
        for (const s of live.sources) { await live.clearSourceCache(s.id); }
        if (isDesktop && api.live) await api.live.purge({ sourceId: '*', logos: true }).catch(() => {});
        paintStats();
      }, 'أُفرغت مخازن القنوات'),
    }),
    row({
      title: 'تصفير قسم LIVE بالكامل',
      desc: 'يحذف كل شيء: المصادر، المفضلة، السجل، الدليل، الإعدادات. لا تراجع.',
      control: dangerBtn('تصفير LIVE', 'alert', async () => {
        await live.resetAll();
        if (isDesktop && api.live) await api.live.purge({ sourceId: '*', logos: true }).catch(() => {});
        paintStats();
      }, 'تم تصفير قسم LIVE'),
    }),
  ]);

  /* ── الخصوصية ── */
  block('الخصوصية والشبكة', 'shield', [
    row({
      title: 'إخفاء محتوى الكبار',
      desc: 'يزيل تصنيف adult من كل القوائم والبحث والدليل.',
      control: toggle(cfg.hideAdult !== false, async (v) => await live.setConfig({ hideAdult: v })),
    }),
    row({
      title: 'مدة الاحتفاظ بسجل المشاهدة',
      desc: 'تُصفّى السجلات الأقدم تلقائيًا من أقسام «شوهد مؤخرًا».',
      control: seg([['14', 'أسبوعين'], ['60', 'شهرين'], ['180', '٦ أشهر'], ['0', 'بلا حدود']], String(cfg.historyDays ?? 60),
        async (v) => await live.setConfig({ historyDays: +v }), {}),
    }),
    row({
      title: 'الاتصال الخارجي',
      desc: 'يُستخدم فقط لجلب قوائم ودلائل المصادر التي أضفتها أنت — لا شيء آخر.',
      control: (() => {
        const p = el('span', 'zlv-notebox', `${icon('wifi', 13)} ${live.sources.filter((s) => s.enabled !== false).length} مصدر نشط`);
        return p;
      })(),
    }),
  ]);

  paintStats();
  const onEv = (e) => { if (['imported', 'sources', 'epg', 'reset'].includes(e.detail?.type)) paintStats(); };
  window.addEventListener('zpopcn-live', onEv);
  root.__zpopCleanup = () => window.removeEventListener('zpopcn-live', onEv);
  return root;
}
