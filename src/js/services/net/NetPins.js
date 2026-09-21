/**
 * NetPins — pinned networks/providers/studios (directive §24/§21).
 * ONE tiny state module; cards read/write it, Home renders from it.
 * Keys are namespaced ('n:id' network, 'p:id' provider, 'c:id' company/studio)
 * so ids from different TMDB collections never collide.
 */
const KEY = 'zpopco…-pins';

function read() {
  try {
    const a = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(a) ? a.filter((x) => typeof x === 'string') : [];
  } catch { return []; }
}
function write(list) {
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent('zpopcorn:pins-changed', { detail: { list } }));
}

export const netPins = {
  list: () => read(),
  has: (key) => read().includes(key),
  /** returns true when newly pinned */
  toggle(key) {
    const list = read();
    const i = list.indexOf(key);
    if (i >= 0) list.splice(i, 1); else list.push(key);
    write(list);
    return i < 0;
  },
};
