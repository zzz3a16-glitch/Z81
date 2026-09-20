/**
 * IPC input validation — shared primitives. Kept dependency-free so the
 * registry and handler modules can both import it without a cycle.
 */
import { STORE_NAMES } from '../../shared/channels.cjs';

export function err(code, message) {
  const e = new Error(message || code);
  e.code = code;
  return e;
}

export const isStr = (v) => typeof v === 'string' && v.length > 0 && v.length < 8 * 1024;

export const VALIDATORS = {
  storeKey: (store, key) => {
    if (!STORE_NAMES.includes(store)) throw err('E_BAD_STORE');
    if (key === undefined || key === null) throw err('E_BAD_KEY');
  },
  storeOnly: (store) => {
    if (!STORE_NAMES.includes(store)) throw err('E_BAD_STORE');
  },
  str: (v) => { if (!isStr(v)) throw err('E_BAD_ARG'); },
  json: (v) => {
    try {
      const s = JSON.stringify(v);
      if (s && s.length > 32 * 1024 * 1024) throw err('E_PAYLOAD_TOO_LARGE');
    } catch (e) {
      if (e.code) throw e;
      throw err('E_BAD_JSON');
    }
  },
};
