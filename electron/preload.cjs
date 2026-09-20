/**
 * zPopcorn preload — secure, typed context bridge (spec 06/07/08).
 * Only channels declared in shared/channels.cjs can cross the boundary.
 * The renderer receives window.zpopcorn.<namespace>.<method>(...) Promises.
 * No require/fs/child_process/process exposure. No generic invoke channel.
 */
const { contextBridge, ipcRenderer, webUtils } = require('electron');
const {
  IPC_VERSION, INVOKE_CHANNELS, EVENT_CHANNELS, allInvokeChannels,
} = require('./shared/channels.cjs');

const ALLOWED = new Set(allInvokeChannels());
const ALLOWED_EVENTS = new Set(EVENT_CHANNELS);

function unwrap(res) {
  if (res && typeof res === 'object' && 'ok' in res) {
    if (res.ok) return res.result;
    const e = new Error(res.error?.message || 'IPC_ERROR');
    e.code = res.error?.code || 'IPC_ERROR';
    throw e;
  }
  return res;
}

function invoke(channel) {
  return (...args) => {
    if (!ALLOWED.has(channel)) {
      return Promise.reject(new Error(`Blocked IPC channel: ${channel}`));
    }
    return ipcRenderer.invoke(channel, ...args).then(unwrap);
  };
}

function buildApi() {
  const api = {
    __meta: {
      isZpopcorn: true,
      ipcVersion: IPC_VERSION,
      platform: process.platform,
      versions: {
        electron: process.versions.electron,
        chrome: process.versions.chrome,
        node: process.versions.node,
      },
    },
    events: {
      /** Subscribe to a whitelisted push event. Returns unsubscribe fn. */
      on(name, callback) {
        const channel = `zpopcorn:event:${name}`;
        if (!ALLOWED_EVENTS.has(channel)) {
          // eslint-disable-next-line no-console
          console.warn(`Blocked event channel: ${channel}`);
          return () => {};
        }
        const listener = (_e, payload) => {
          try { callback(payload); } catch (err) {
            // eslint-disable-next-line no-console
            console.error(`[${channel}] listener error`, err);
          }
        };
        ipcRenderer.on(channel, listener);
        return () => ipcRenderer.removeListener(channel, listener);
      },
      names: EVENT_CHANNELS.map((c) => c.replace('zpopcorn:event:', '')),
    },
  };
  for (const [ns, methods] of Object.entries(INVOKE_CHANNELS)) {
    api[ns] = {};
    for (const method of Object.keys(methods)) {
      api[ns][method] = invoke(methods[method]);
    }
  }
  
  // Drag-and-drop path resolution (spec 42): synchronous, preload-local,
  // exposes ONLY a resolved string path — no fs module reaches the renderer.
  api.files = api.files || {};
  api.files.pathForFile = (file) => {
    try { return webUtils.getPathForFile(file) || null; } catch { return null; }
  };

return api;
}

contextBridge.exposeInMainWorld('zpopcorn', buildApi());
