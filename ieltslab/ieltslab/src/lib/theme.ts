import { prefs } from './format';

export type ThemePref = 'system' | 'light' | 'dark';

export function getThemePref(): ThemePref {
  const v = prefs.get('bw-theme');
  return v === 'light' || v === 'dark' ? v : 'system';
}

export function applyTheme(pref: ThemePref) {
  const root = document.documentElement;
  if (pref === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', pref);
  prefs.set('bw-theme', pref);
}

export function effectiveTheme(pref: ThemePref): 'light' | 'dark' {
  if (pref !== 'system') return pref;
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}
