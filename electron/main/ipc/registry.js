/**
 * Central IPC registry (spec 08). ALL channel binding happens here —
 * never inside components. Every handler is validated + error-contained:
 * the renderer receives {ok, result} or {ok:false, error:{code,message}}.
 * Unknown channels are never registered; the preload never asks for them.
 */
import { allInvokeChannels } from '../../shared/channels.cjs';
import { registerHandlers } from './handlers.js';

/**
 * @param {object} services container
 * @param {(ch:string,payload:any)=>void} broadcast
 * @returns {Map<string, {validate?:Function, handler: Function}>}
 */
export function buildRegistry(services, broadcast) {
  const handlers = registerHandlers(services, broadcast);
  // Contract consistency: every declared channel has a handler, and vice versa.
  const declared = new Set(allInvokeChannels());
  for (const ch of declared) {
    if (!handlers.has(ch)) throw new Error(`IPC contract violation: no handler for ${ch}`);
  }
  for (const ch of handlers.keys()) {
    if (!declared.has(ch)) throw new Error(`IPC contract violation: handler for undeclared ${ch}`);
  }
  return handlers;
}
