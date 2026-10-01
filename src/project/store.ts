// ── IndexedDB: saved projects live in the browser ─────────────────────────
import type { ProjectFiles } from './zip.ts';
import type { Mode } from '../config.ts';

export interface ProjectMeta { xml?: string; mode?: Mode }
export interface StoredProject { name: string; files: ProjectFiles; meta: ProjectMeta; updated: number }

// The database keeps its pre-rename name, so projects saved before stay reachable.
const db = () => new Promise<IDBDatabase>((res, rej) => {
  const r = indexedDB.open('opm-web', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('projects', { keyPath: 'name' });
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
});
async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise((res, rej) => {
    const req = fn(d.transaction('projects', mode).objectStore('projects'));
    req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error);
  });
}

/** Saved projects, newest first. */
export const listProjects = () => tx<StoredProject[]>('readonly', s => s.getAll())
  .then(a => a.map(({ name, updated }) => ({ name, updated })).sort((x, y) => y.updated - x.updated));
export const getProject = (name: string) => tx<StoredProject | undefined>('readonly', s => s.get(name));
export const putProject = (name: string, files: ProjectFiles, meta: ProjectMeta = {}) =>
  tx('readwrite', s => s.put({ name, files, meta, updated: Date.now() } satisfies StoredProject));
export const deleteProject = (name: string) => tx('readwrite', s => s.delete(name));
