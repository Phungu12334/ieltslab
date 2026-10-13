export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(h ? 2 : 1, '0');
  return `${h ? h + ':' : ''}${mm}:${String(sec).padStart(2, '0')}`;
}

export function formatDuration(sec: number): string {
  const s = Math.round(sec);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return s % 60 ? `${m}m ${s % 60}s` : `${m} min`;
}

export function formatDate(iso?: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

export function formatBand(b: number | null | undefined): string {
  return typeof b === 'number' ? b.toFixed(1) : '—';
}

/** First name for greetings, skipping titles such as "Ms" or "Dr". */
export function firstName(name: string): string {
  const parts = name.trim().split(/\s+/);
  const skip = /^(mr|mrs|ms|miss|mx|dr|prof|sir)\.?$/i;
  return (parts.find((p) => !skip.test(p)) || parts[0] || '').slice(0, 24);
}

export function plural(n: number, one: string, many = one + 's'): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Safe localStorage access (storage can be blocked in private windows and sandboxed frames). */
export const prefs = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
  },
};
