// ── folder sync: decide what to copy, comparing both sides to the last sync ──
// Pure: no DOM, no file system. src/project/sync.ts gathers the inputs and
// carries out the plan.

/** A file as it was at the last sync: its content hash, and the disk file's stamp then. */
export interface Synced { hash: string; mtime: number; size: number }
export type Baseline = Record<string, Synced>;
/** Files on disk now; `hash` is the baseline's when the stamp has not changed. */
export type DiskState = Record<string, Synced>;
/** Content hashes of the files in the browser now. */
export type LocalState = Record<string, string>;

export interface SyncPlan {
  /** Copy from disk into the browser. */
  pull: string[];
  /** Copy from the browser to disk; the caller records the new disk stamp. */
  push: string[];
  /** Delete in the browser, deleted on disk. */
  delLocal: string[];
  /** Delete on disk, deleted in the browser. */
  delDisk: string[];
  /** Changed differently on both sides: the user decides. */
  conflicts: string[];
  /** The baseline after the plan, except the pushed files. */
  baseline: Baseline;
}

/** cyrb53: a fast 53-bit hash, plenty to tell file versions apart. */
export function hashBytes(b: Uint8Array): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < b.length; i++) {
    h1 = Math.imul(h1 ^ b[i], 2654435761);
    h2 = Math.imul(h2 ^ b[i], 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36) + ':' + b.length;
}

/** The disk file needs reading only when its stamp differs from the last sync. */
export const stampChanged = (b: Synced | undefined, mtime: number, size: number) => !b || b.mtime !== mtime || b.size !== size;

export function planSync(base: Baseline, disk: DiskState, local: LocalState): SyncPlan {
  const plan: SyncPlan = { pull: [], push: [], delLocal: [], delDisk: [], conflicts: [], baseline: {} };
  for (const p of new Set([...Object.keys(base), ...Object.keys(disk), ...Object.keys(local)])) {
    const b = base[p], d = disk[p], w = local[p];
    const dChanged = d ? !b || d.hash !== b.hash : !!b;
    const wChanged = w !== undefined ? !b || w !== b.hash : !!b;
    if (!dChanged && !wChanged) { if (d) plan.baseline[p] = d; }
    else if (!wChanged) { if (d) { plan.pull.push(p); plan.baseline[p] = d; } else plan.delLocal.push(p); }
    else if (!dChanged) { if (w !== undefined) plan.push.push(p); else plan.delDisk.push(p); }
    else if (d && d.hash === w) plan.baseline[p] = d;
    else if (d || w !== undefined) { plan.conflicts.push(p); if (b) plan.baseline[p] = b; }
  }
  return plan;
}

/** A file changed differently on both sides, as the sync saw it. */
export interface Conflict { path: string; disk?: Synced; local?: string }
export type Choice = 'local' | 'disk';

/**
 * Settle a conflict by rewriting its baseline so that the losing side looks
 * unchanged; the next sync then copies (or deletes) the winner over it.
 */
export function settle(base: Baseline, c: Conflict, keep: Choice): Baseline {
  const next = { ...base };
  const lose = keep === 'local' ? c.disk : c.local !== undefined ? { hash: c.local, mtime: -1, size: -1 } : undefined;
  if (lose) next[c.path] = lose; else delete next[c.path];
  return next;
}
