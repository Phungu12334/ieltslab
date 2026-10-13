import { createLocalApi } from './local';
import { createServerApi } from './server';
import type { Api, Health } from './types';

declare const __DEMO_BUILD__: boolean;

/** Use the Node server when it answers; otherwise fall back to browser-only storage. */
export async function connectApi(): Promise<Api> {
  if (typeof __DEMO_BUILD__ !== 'undefined' && __DEMO_BUILD__) return createLocalApi();
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch('/api/health', { signal: ctrl.signal, credentials: 'same-origin' });
    clearTimeout(t);
    if (res.ok) {
      const health = (await res.json()) as Health;
      if (health.mode === 'server') return createServerApi(health);
    }
  } catch {
    /* no server: use local mode */
  }
  return createLocalApi();
}

export * from './types';
