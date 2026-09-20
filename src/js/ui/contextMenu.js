/**
 * Windows-style context menus for media surfaces (spec 41).
 * Global delegate: any element with [data-zctx="media"] (+ element.__media) gets a menu.
 * Dangerous actions are visually separated at the bottom.
 */
import { icon } from './icons.js';
import { esc } from './primitives.js';
import { isDesktop, api } from '../bridge.js';
import { navigateTo } from '../components/MediaCard.js';
import { watchlistManager } from '../services/watchlist/WatchlistManager.js';
import { db } from '../services/storage/Database.js';
import { notificationService } from '../services/notification/NotificationService.js';

const toast = (message, type = 'success') => notificationService.showToast({ message, type, duration: 2600 });
let current = null;
export function closeContextMenu() { if (current) { current.remove(); current = null; } }

export function initContextMenus() {
  document.addEventListener('contextmenu', (e) => {
    const host = e.target.closest('[data-zctx="media"]');
    if (!host?.__media) return;
    e.preventDefault();
    openFor(host.__media, e.clientX, e.clientY);
  });
  ['click', 'keydown', 'wheel', 'blur'].forEach((ev) =>
    window.addEventListener(ev, (e) => {
      if (ev === 'keydown' && e.key === 'Escape') return closeContextMenu();
      if (current && !current.contains(e.target)) closeContextMenu();
    }, { passive: true }));
}

async function openFor(media, x, y) {
  closeContextMenu();
  const title = media.title || media.name || '';
  const type = media.media_type || (media.first_air_date ? 'tv' : 'movie');
  const store = type === 'tv' ? 'tvshows' : 'movies';
  const docKey = media.id != null ? String(media.id) : (media.key || null);
  const inLibrary = !!media.inLibrary || !!(media.localFiles?.length);
  const localPath = media.localFile || media.localFiles?.[0] || media.path || null;

  const menu = document.createElement('div');
  menu.className = 'z-ctx';
  menu.setAttribute('role', 'menu');
  const item = (id, label, iconName, extra = '') =>
    `<button role="menuitem" data-i="${id}">${icon(iconName, 15)}<span>${esc(label)}</span>${extra}</button>`;

  menu.innerHTML = `
    <div class="head">${esc(title || 'وسائط')}</div>
    ${item('details', 'عرض التفاصيل', 'eye')}
    ${item('fav', 'المفضلة', 'heart', '<span class="z-pill" style="margin-inline-start:auto" data-slot="fav">…</span>')}
    ${item('later', 'المشاهدة لاحقاً', 'bookmark', '<span class="z-pill" style="margin-inline-start:auto" data-slot="later">…</span>')}
    ${item('collection', 'إضافة إلى مجموعة…', 'layers')}
    <div class="sep"></div>
    ${item('refresh', 'تحديث البيانات من TMDB', 'refresh')}
    ${inLibrary ? item('remeta', 'إعادة مطابقة الوصف المحلي', 'snap') : ''}
    ${isDesktop && localPath ? item('locate', 'موقع الملف في المستكشف', 'folder') : ''}
    ${inLibrary || media.key ? item('remove', 'إزالة من المكتبة', 'trash') : ''}
  `;

  // measure + place inside viewport
  document.body.appendChild(menu);
  const r = menu.getBoundingClientRect();
  menu.style.left = Math.min(x, window.innerWidth - r.width - 10) + 'px';
  menu.style.top = Math.min(y, window.innerHeight - r.height - 10) + 'px';
  current = menu;

  // live favorite flags
  if (media.id != null) {
    Promise.all([
      watchlistManager.isInList('favorites', media.id).catch(() => false),
      watchlistManager.isInList('watch-later', media.id).catch(() => false),
    ]).then(([f, l]) => {
      const slot = (on) => (on ? icon('check', 13) : `<span style="opacity:.35">${icon('minus', 13)}</span>`);
      menu.querySelector('[data-slot="fav"]').innerHTML = slot(f);
      menu.querySelector('[data-slot="later"]').innerHTML = slot(l);
    });
  }

  menu.querySelectorAll('button').forEach((b) => b.addEventListener('click', async () => {
    const act = b.dataset.i;
    closeContextMenu();
    try {
      if (act === 'details') return navigateTo(media, type);
      if (act === 'fav') {
        const inList = await watchlistManager.isInList('favorites', media.id);
        if (inList) { await watchlistManager.removeFromList('favorites', media.id); toast('أُزيل من المفضلة', 'info'); }
        else { await watchlistManager.addToList('favorites', { ...media, media_type: type }); toast('أُضيف إلى المفضلة'); }
        window.dispatchEvent(new CustomEvent('watchlistupdate'));
        return;
      }
      if (act === 'later') {
        const inList = await watchlistManager.isInList('watch-later', media.id);
        if (inList) { await watchlistManager.removeFromList('watch-later', media.id); toast('أُزيل من المشاهدة لاحقاً', 'info'); }
        else { await watchlistManager.addToList('watch-later', { ...media, media_type: type }); toast('أُضيف إلى المشاهدة لاحقاً'); }
        window.dispatchEvent(new CustomEvent('watchlistupdate'));
        return;
      }
      if (act === 'collection') return pickCollection(media);
      if (act === 'refresh') {
        if (isDesktop && docKey && media.id != null) {
          const fresh = await api.metadata.request(`${type === 'tv' ? 'tv' : 'movie'}/${media.id}`, {}, { force: true });
          await db.put(store, { ...(await db.get(store, docKey) || {}), ...fresh, key: docKey, updatedAt: Date.now(), tmdbRefreshedAt: Date.now() });
          window.dispatchEvent(new CustomEvent('zpopcorn:library-changed'));
          toast('حُدّثت البيانات من TMDB');
        } else {
          window.location.reload(); // browser QA mode: cache lives in-memory
        }
        return;
      }
      if (act === 'remeta') {
        window.dispatchEvent(new CustomEvent('zpopcorn:request-relink', { detail: { store, key: docKey } }));
        toast('أُرسل طلب إعادة الربط للنظام', 'info');
        return;
      }
      if (act === 'locate') { await api.system.showItemInFolder(localPath); return; }
      if (act === 'remove') return removeWork(store, docKey, media, title);
    } catch (e) {
      toast(e?.message ? `تعذّر الإجراء: ${e.message}` : 'تعذّر الإجراء', 'error');
    }
  }));
}

async function removeWork(store, key, media, title) {
  const ok = await new Promise((resolve) => {
    const bd = document.createElement('div');
    bd.className = 'modal-backdrop active';
    bd.style.zIndex = 'var(--z-modal-backdrop, 400)';
    bd.innerHTML = `
      <div class="modal" style="max-width:440px;padding:24px;position:relative;">
        <h3 style="font-size:17px;font-weight:700;margin-bottom:8px;">إزالة «${esc(title)}» من المكتبة؟</h3>
        <p style="font-size:13.5px;color:var(--color-text-secondary);line-height:1.7;">
          ستُزال بطاقة العمل وسجلاته من مكتبتك فقط. <b>لن تُمسّ ملفات الوسائط الأصلية على القرص نهائياً.</b>
        </p>
        <div style="display:flex;gap:10px;justify-content:flex-start;margin-top:18px;">
          <button class="btn btn-danger btn-sm" data-x="del">إزالة من المكتبة</button>
          <button class="btn btn-ghost btn-sm" data-x="no">إلغاء</button>
        </div>
      </div>`;
    document.body.appendChild(bd);
    bd.addEventListener('click', (e) => {
      const x = e.target.closest('[data-x]')?.dataset.x;
      if (x) { bd.remove(); resolve(x === 'del'); }
      else if (e.target === bd) { bd.remove(); resolve(false); }
    });
  });
  if (!ok) return;
  if (isDesktop && key) await api.library.remove(store, key);
  else await db.delete(store, key);
  window.dispatchEvent(new CustomEvent('zpopcorn:library-changed'));
  toast(`أُزيل «${title}» من المكتبة — الملفات الأصلية سليمة`, 'info');
}

async function pickCollection(media) {
  let cols = [];
  try {
    if (isDesktop) cols = (await api.collections.list()) || [];
    else { const { smartCollectionManager } = await import('../services/library/LibraryIntelligence.js').catch(() => ({})); cols = (await smartCollectionManager?.getAllCollections?.()) || []; }
  cols = cols.filter((c) => c && c.id);
  } catch { cols = []; }
  const menu = document.createElement('div');
  menu.className = 'z-ctx';
  menu.innerHTML = `
    <div class="head">إضافة إلى مجموعة</div>
    ${cols.length ? cols.map((c) => `<button data-c="${c.id}">${icon('layers', 15)}<span>${esc(c.name)}</span>${c.itemCount ? `<span class="z-pill" style="margin-inline-start:auto">${c.itemCount}</span>` : ''}</button>`).join('') : `<button disabled style="opacity:.5">${icon('layers', 15)}<span>${cols.length ? '' : 'لا توجد مجموعات بعد — أنشئ واحدة من صفحة المجموعات'}</span></button>`}
    <div class="sep"></div>
    <button data-c="__new">${icon('plus', 15)}<span>مجموعة جديدة…</span></button>`;
  document.body.appendChild(menu);
  const r = menu.getBoundingClientRect();
  current = menu;
  menu.querySelectorAll('[data-c]').forEach((b) => b.addEventListener('click', async () => {
    closeContextMenu();
    const cid = b.dataset.c;
    if (cid === '__new') return window.router?.navigate('/collections');
    try {
      if (isDesktop) await api.collections.addItem(String(cid), { id: String(media.id), media_type: media.media_type || 'movie', title: media.title || media.name, poster_path: media.poster_path });
      else {
        const { smartCollectionManager: scm } = await import('../services/library/LibraryIntelligence.js');
        await scm.init?.();
        const coll = scm.collections.get(cid);
        if (coll) {
          coll.items = coll.items || [];
          if (!coll.items.some((i) => String(i.id) === String(media.id))) {
            coll.items.push({ id: String(media.id), media_type: media.media_type || 'movie', title: media.title || media.name });
          }
          coll.updatedAt = Date.now();
          await scm.save();
        } else throw new Error('مجموعة غير موجودة');
      }
      toast('أُضيف إلى المجموعة');
    } catch (e) { toast(e.message || 'تعذّرت الإضافة', 'error'); }
  }));
}
