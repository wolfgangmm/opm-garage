// ── a folder on disk, through the File System Access API (Chromium only) ──
import { HIDDEN } from '../config.ts';

export interface DiskFile { handle: FileSystemFileHandle; mtime: number; size: number }

export const canUseFolders = () => typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';

/** Ask the user for a folder; needs a click or key press. */
export const pickFolder = () => window.showDirectoryPicker!({ id: 'opm-project', mode: 'readwrite' });

/** Whether we may read and write the folder; `ask` prompts, which needs a click. */
export async function permitted(dir: FileSystemDirectoryHandle, ask = false): Promise<boolean> {
  const o = { mode: 'readwrite' as const };
  if (await dir.queryPermission(o) === 'granted') return true;
  return ask && await dir.requestPermission(o) === 'granted';
}

/** Every file below the folder, by project-relative path, with its stamp. */
export async function listDisk(dir: FileSystemDirectoryHandle, rel = '', out = new Map<string, DiskFile>()): Promise<Map<string, DiskFile>> {
  for await (const [name, h] of dir.entries()) {
    // Chromium writes through a temporary .crswap file next to the target
    if (HIDDEN.has(name) || name.endsWith('.crswap')) continue;
    if (h.kind === 'directory') await listDisk(h as FileSystemDirectoryHandle, rel + name + '/', out);
    else {
      const f = await (h as FileSystemFileHandle).getFile().catch(gone);
      if (f) out.set(rel + name, { handle: h as FileSystemFileHandle, mtime: f.lastModified, size: f.size });
    }
  }
  return out;
}

/** A file removed while we look at it is simply not there; anything else is an error. */
export function gone(err: unknown): undefined {
  if ((err as DOMException).name !== 'NotFoundError') throw err;
}

export const readDisk = async (h: FileSystemFileHandle) => new Uint8Array(await (await h.getFile()).arrayBuffer());

async function parentOf(root: FileSystemDirectoryHandle, path: string, create: boolean): Promise<[FileSystemDirectoryHandle, string]> {
  const segs = path.split('/'), name = segs.pop()!;
  let dir = root;
  for (const s of segs) dir = await dir.getDirectoryHandle(s, { create });
  return [dir, name];
}

/** Write a file, creating folders as needed; returns the new stamp. */
export async function writeDisk(root: FileSystemDirectoryHandle, path: string, data: Uint8Array): Promise<{ mtime: number; size: number }> {
  const [dir, name] = await parentOf(root, path, true);
  const fh = await dir.getFileHandle(name, { create: true });
  const w = await fh.createWritable();
  await w.write(data as BlobPart);
  await w.close();
  const f = await fh.getFile();
  return { mtime: f.lastModified, size: f.size };
}

export async function removeDisk(root: FileSystemDirectoryHandle, path: string): Promise<void> {
  try {
    const [dir, name] = await parentOf(root, path, false);
    await dir.removeEntry(name);
  } catch (err) { gone(err); }
}

/** Call `fn` when the folder may have changed; returns a function that stops watching. */
export function watchFolder(dir: FileSystemDirectoryHandle, fn: () => void): () => void {
  const onFocus = () => fn();
  window.addEventListener('focus', onFocus);
  if (typeof FileSystemObserver !== 'undefined') {
    const obs = new FileSystemObserver(() => fn());
    let stopped = false;
    obs.observe(dir, { recursive: true }).catch(() => { if (!stopped) stopPoll = poll(fn); });
    let stopPoll = () => {};
    return () => { stopped = true; obs.disconnect(); stopPoll(); window.removeEventListener('focus', onFocus); };
  }
  const stopPoll = poll(fn);
  return () => { stopPoll(); window.removeEventListener('focus', onFocus); };
}

function poll(fn: () => void): () => void {
  const t = setInterval(() => { if (!document.hidden) fn(); }, 2000);
  return () => clearInterval(t);
}
