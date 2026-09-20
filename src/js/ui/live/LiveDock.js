/**
 * Live Dock — the always-available companion for the external player (spec 07/18):
 * who is on air, program progress, next program, hop prev/next, favorite,
 * re-launch, end session. Mounted once; state survives navigation.
 */
import { el, esc } from '../primitives.js';
import { icon } from '../icons.js';
import { live } from '../../services/live/LiveService.js';
import { fmtClock } from '../../pages/live/live-ui.js';

let dock = null;
let timer = null;

export function mountLiveDock() {
  if (dock) return dock;
  dock = el('aside', 'zlv-dock');
  dock.hidden = true;
  document.body.appendChild(dock);

  window.addEventListener('zpopcn-live', (e) => {
    const t = e.detail?.type;
    if (t === 'session' || t === 'imported' || t === 'sources' || t === 'favs') paint();
  });
  paint();
  return dock;
}

function paint() {
  if (!dock) return;
  const sess = live.session;
  const chan = sess ? live.sessionChannel() : null;
  if (!sess || !chan) { hide(); return; }
  const cn = live.currentNext(chan);
  const cur = cn?.cur;
  const pct = cur ? Math.round(((Date.now() - cur.s) / Math.max(1, cur.e - cur.s)) * 100) : 0;
  const agoMin = Math.round((Date.now() - sess.at) / 60000);
  const fav = live.isFav(chan.id);
  const logo = live.logoSrc(chan);

  dock.hidden = false;
  dock.innerHTML = `
    <span class="dlogo">${logo ? `<img src="${esc(logo)}" alt="" onerror="this.parentNode.classList.remove('has')">` : esc((chan.name || '?').slice(0, 2))}</span>
    <div class="dmeta">
      <b>${esc(chan.name)}</b>
      ${cur ? `<span class="dprog"><i style="width:${pct}%"></i><em>${esc(cur.t)} · ينتهي ${fmtClock(cur.e)}</em></span>`
        : `<span class="dprog dim"><em>على الهواء — لا دليل لهذه القناة</em></span>`}
      ${cn?.next ? `<span class="dnext">بعد قليل: ${esc(cn.next.t)} · ${fmtClock(cn.next.s)}</span>` : ''}
    </div>
    <span class="dstat" title="مدة الجلسة">${agoMin < 1 ? 'الآن' : `${agoMin} د`}</span>
    <div class="dacts">
      <button class="z-iconbtn" data-a="prev" title="القناة السابقة">${icon('chevR', 15)}</button>
      <button class="z-iconbtn" data-a="fav" title="المفضلة">${icon(fav ? 'heartFill' : 'heart', 15)}</button>
      <button class="z-iconbtn" data-a="again" title="إعادة الفتح">${icon('play', 15)}</button>
      <button class="z-iconbtn" data-a="next" title="القناة التالية">${icon('chevL', 15)}</button>
      <button class="z-iconbtn" data-a="close" title="إنهاء الجلسة">${icon('x', 14)}</button>
    </div>`;
  if (logo) dock.querySelector('.dlogo')?.classList.add('has');
  if (timer) clearInterval(timer);
  timer = setInterval(() => { if (dock && !dock.hidden) paint(); }, 30e3);

  dock.querySelector('.dacts').addEventListener('click', async (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (!a) return;
    if (a === 'prev') live.hop(-1);
    if (a === 'next') live.hop(1);
    if (a === 'fav') live.toggleFav(chan);
    if (a === 'again') live.launch(chan, { context: live.context });
    if (a === 'close') { live.endSession(); hide(); }
  });
}

function hide() {
  if (!dock) return;
  dock.hidden = true;
  dock.innerHTML = '';
  if (timer) { clearInterval(timer); timer = null; }
}
