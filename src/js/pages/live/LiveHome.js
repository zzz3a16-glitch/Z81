/**
 * Live Home — designed for live television (spec 03), not a movie layout:
 * an on-air billboard, then intelligence-driven rails that appear only when
 * real local data exists. First-run ships an inline source-onboarding card.
 */
import { el, esc } from '../../ui/primitives.js';
import { icon } from '../../ui/icons.js';
import { live } from '../../services/live/LiveService.js';
import { liveShell, rail, sectionBlock, stateBlock, channelTile, launchChan, fmtClock, toast } from './live-ui.js';

const CAT_LABELS = {
  sports: 'رياضة', news: 'أخبار', movies: 'أفلام', kids: 'أطفال', music: 'موسيقى',
  documentary: 'وثائقيات', entertainment: 'منوعات', series: 'مسلسلات', religious: 'مناسك وقرآن',
};

export async function LiveHomePage() {
  await live.init();
  await live.loadEpgDocs();
  const root = el('div', 'zlv-page zlv-home');
  const { frag, main } = liveShell('');
  root.appendChild(frag);

  let unsub = () => {};

  const render = () => {
    main.innerHTML = '';
    const st = live.stats();
    if (!st.sources) { main.appendChild(onboarding()); return; }

    const importing = live.sources.some((s) => s.status === 'importing');
    if (!st.channels && importing) { main.appendChild(importingState()); return; }
    if (!st.channels) { main.appendChild(noChannelsState()); return; }

    const vis = live.visible();

    /* ── on-air billboard ── */
    main.appendChild(billboard(vis));

    /* ── rails: only with data ── */
    const rows = [];
    const favs = live.favChannels().map((f) => (f.orphan ? f : live.byId.get(f.chanId || f.id) || f));
    if (favs.length) rows.push(['مفضلاتك', '', favs, '/live/channels?fav=1']);
    const recents = live.recent(14).map((r) => r.chan).filter(Boolean);
    if (recents.length) rows.push(['شوهد مؤخرًا', st.history > 14 ? '' : '', recents, '/live/channels?sort=recent']);
    const trend = live.trending(14).map((r) => r.chan).filter(Boolean);
    if (trend.length) rows.push(['الأكثر متابعة لديك', 'إحصاء محلي — لا مغادرة لجهازك', trend, null]);
    const added = live.recentlyAdded(14);
    if (added.length) rows.push(['أُضيفت مؤخرًا', 'خلال آخر ١٤ يومًا من المصادر', added, null]);

    const cats = live.categories();
    const ranked = Object.entries(CAT_LABELS)
      .map(([k, label]) => [k, label, cats.get(k) || 0])
      .filter(([, , n]) => n >= 3)
      .sort((a, b) => b[2] - a[2])
      .slice(0, 4);
    for (const [k, label] of ranked) {
      const chans = vis.filter((c) => c.cat === k).slice(0, 16);
      if (chans.length) rows.push([label, '', chans, `/live/channels?cat=${k}`]);
    }

    for (const [title, sub, chans, moreHref] of rows) {
      if (!chans.length) continue;
      const { sec } = sectionBlock({ title, sub, action: moreHref ? { label: 'عرض الكل', href: moreHref } : null });
      sec.appendChild(rail(chans, { ctx: chans }));
      main.appendChild(sec);
    }

    if (live.sources.some((s) => s.status === 'error')) main.appendChild(errorsNote());
  };

  /* onboarding — add the first playlist without leaving home (spec 03/16) */
  function onboarding() {
    const box = el('div', 'zlv-onboard');
    box.innerHTML = `
      ${icon('live', 30, { weight: 'duotone' })}
      <h2>منصة البث المباشر تنتظر قائمة قنواتك</h2>
      <p>zPopcorn لا يوزّع أي محتوى — أضف رابط M3U الخاص بك أو استورد ملفًا محليًا،
         ويُحلَّل كل شيء ويخزَّن على جهازك فقط.</p>
      <div class="zlv-addrow">
        <input type="url" dir="ltr" placeholder="https://example.com/playlist.m3u" aria-label="رابط قائمة التشغيل">
        <button class="btn btn-primary btn-sm" type="button">${icon('download', 15)} إضافة واستيراد</button>
        <label class="zlv-file btn btn-ghost btn-sm" tabindex="0">${icon('folderOpen', 15)} ملف محلي…
          <input type="file" accept=".m3u,.m3u8,.txt,audio/x-mpegurl,application/x-mpegurl" hidden></label>
      </div>
      <a class="zlv-altlink" href="#/live/sources">${icon('sources', 14)} إدارة المصادر المتقدمة (EPG، مصادر متعددة)</a>
    `;
    const input = box.querySelector('input[type=url]');
    const btn = box.querySelector('button');
    const file = box.querySelector('input[type=file]');
    const doUrl = async () => {
      const url = input.value.trim();
      if (!/^https?:\/\//i.test(url)) { toast('warning', 'رابط غير صالح', 'استخدم رابط http/https كاملاً.'); input.focus(); return; }
      btn.disabled = true; btn.innerHTML = `${icon('loading', 15, { cls: 'spin' })} جارٍ الجلب…`;
      try {
        const name = url.replace(/^https?:\/\//i, '').split('/')[0];
        await live.addSource({ name, url });
        toast('success', 'تم', `استُورد المصدر (${live.sources.at(-1)?.channelCount || 0} قناة)`);
        render();
      } catch (e) { toast('error', 'فشل الاستيراد', e?.message || 'خطأ غير معروف'); }
      finally { btn.disabled = false; btn.innerHTML = `${icon('download', 15)} إضافة واستيراد`; }
    };
    btn.addEventListener('click', doUrl);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doUrl(); });
    file.addEventListener('change', () => {
      const f = file.files?.[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = async () => {
        try {
          await live.addSource({ name: f.name.replace(/\.[a-z0-9]+$/i, ''), kind: 'file', text: String(rd.result) });
          toast('success', 'تم', `استُوردت القائمة (${live.sources.at(-1)?.channelCount || 0} قناة)`);
          render();
        } catch (e) { toast('error', 'ملف غير صالح', e?.message); }
      };
      rd.readAsText(f);
    });
    return box;
  }

  function importingState() {
    const s = live.sources.find((x) => x.status === 'importing');
    const box = stateBlock({
      anim: 'importing', title: 'جارٍ استيراد القائمة…',
      desc: s ? `المصدر: ${s.name} — تجري القراءة والتحليل دون تجميد الواجهة.` : '',
      secondary: { label: 'إلغاء', icon: 'x', onClick: () => { if (s) live.cancelImport(s.id); render(); } },
    });
    box.dataset.liveWatch = '1';
    return box;
  }

  function noChannelsState() {
    const failed = live.sources.filter((s) => s.status === 'error');
    return stateBlock({
      anim: 'empty',
      title: failed.length ? 'كل المصادر معطّلة أو فشلت' : 'لا قنوات بعد',
      desc: failed.length ? `أحدث فشل: ${failed[0].error || ''}` : 'المصادر مضافة لكن لم تُخزَّن أي قائمة بعد.',
      primary: { label: 'تحديث كل المصادر', icon: 'refresh', onClick: async () => { await live.refreshAll(); render(); } },
      secondary: { label: 'إلى صفحة المصادر', icon: 'sources', onClick: () => (window.location.hash = '#/live/sources') },
    });
  }

  function errorsNote() {
    const bad = live.sources.filter((s) => s.status === 'error');
    const n = el('div', 'zlv-note');
    n.innerHTML = `${icon('alert', 16)} <span>مصدر${bad.length > 1 ? 'ات' : ''} بفشل تحديث — البقية تعمل كالمعتاد (عزل كامل).</span>
      <a role="button" tabindex="0" href="#/live/sources">معالجة</a>`;
    return n;
  }

  /* billboard: the live-TV hero — now playing, on-air program, one action */
  function billboard(vis) {
    const b = el('section', 'zlv-billboard');
    const chan = live.sessionChannel() || live.favChannels().map((f) => live.byId.get(f.chanId || f.id) || f)[0]
      || live.recent(1)[0]?.chan || vis[0];
    if (!chan) return el('div', '');
    const cn = live.currentNext(chan);
    const pct = cn?.cur ? Math.round(((Date.now() - cn.cur.s) / Math.max(1, cn.cur.e - cn.cur.s)) * 100) : 0;
    b.innerHTML = `
      <div class="bg" style="--logo:''"></div>
      <div class="inner">
        <span class="onair">${icon('signal', 12)} على الهواء الآن</span>
        <div class="row">
          <span class="zlv-logo big" data-bb></span>
          <div class="txt">
            <h2>${esc(chan.name)}</h2>
            ${cn?.cur ? `
              <p class="prog">${esc(cn.cur.t)}
                <span class="times">${fmtClock(cn.cur.s)} — ${fmtClock(cn.cur.e)}</span></p>
              <div class="tt"><i style="width:${pct}%"></i></div>
              ${cn.next ? `<p class="next">بعد قليل: ${esc(cn.next.t)} · ${fmtClock(cn.next.s)}</p>` : ''}`
        : `<p class="prog dim">لا بيانات دليل — أضف رابط EPG من صفحة المصادر لعرض البرنامج الحالي.</p>`}
            <div class="acts">
              <button class="btn btn-primary" type="button" data-play>${icon('play', 17, { weight: 'bold' })} تشغيل مباشر</button>
              <button class="btn btn-ghost" type="button" data-fav>${icon(live.isFav(chan.id) ? 'heartFill' : 'heart', 16)} ${live.isFav(chan.id) ? 'في المفضلة' : 'للمفضلة'}</button>
            </div>
          </div>
        </div>
      </div>
    `;
    const logo = b.querySelector('[data-bb]');
    logo.__chan = chan;
    const fill = live.logoSrc(chan);
    if (fill !== undefined) fill && (logo.classList.add('has-logo'), (logo.innerHTML = `<img src="${esc(fill)}" alt="" onerror="this.closest('.zlv-logo').classList.remove('has-logo')">`));
    else live.ensureLogo(chan).then((src) => {
      if (src && logo.isConnected) { logo.classList.add('has-logo'); logo.innerHTML = `<img src="${esc(src)}" alt="" onerror="this.closest('.zlv-logo').classList.remove('has-logo')">`; }
    });
    b.querySelector('[data-play]').addEventListener('click', () => launchChan(chan, [chan, ...vis.slice(0, 400)]));
    b.querySelector('[data-fav]').addEventListener('click', (e) => {
      live.toggleFav(chan).then((on) => {
        e.currentTarget.innerHTML = `${icon(on ? 'heartFill' : 'heart', 16)} ${on ? 'في المفضلة' : 'للمفضلة'}`;
      });
    });
    return b;
  }

  /* live updates without full re-render churn */
  const onLiveEvent = (e) => {
    const t = e.detail?.type;
    if (t === 'imported' || t === 'sources' || t === 'config' || t === 'session' || t === 'favs') render();
    if (t === 'progress' || t === 'epg') {
      const importing = live.sources.some((s) => s.status === 'importing');
      if (!importing && live.stats().channels) render();
      if (e.detail?.partial) render(); // channels arrive while parsing continues
    }
  };
  window.addEventListener('zpopcn-live', onLiveEvent);
  unsub = () => {
    window.removeEventListener('zpopcn-live', onLiveEvent);
    if (!location.hash.startsWith('#/live')) live.stopEpgTicker();
  };
  live.startEpgTicker();
  root.__zpopCleanup = () => { unsub(); live.stopEpgTicker(); };

  render();
  return root;
}
