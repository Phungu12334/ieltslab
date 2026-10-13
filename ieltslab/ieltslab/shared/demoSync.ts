// Decide which built-in materials are new since a content bank was last seeded.
// Items an administrator deleted are never re-added: only ids never offered before are returned.
import type { Material } from './types';

/** Ids from the first two built-in sets, for installs that predate per-id tracking. */
const LEGACY_PREFIXES = ['demo-', 'demo2-'];

export function newBuiltIns(all: Material[], offered: string[] | null): Material[] {
  const known = new Set(offered ?? all.filter((m) => LEGACY_PREFIXES.some((p) => m.id.startsWith(p))).map((m) => m.id));
  return all.filter((m) => !known.has(m.id));
}
