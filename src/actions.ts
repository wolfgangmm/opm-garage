// ── actions: change state, then announce what changed ─────────────────────
import { isMode } from './config.ts';
import { persistNow } from './project/autosave.ts';
import { exists, firstXml, isSource, oddPath, restore } from './project/fs.ts';
import type { ProjectMeta } from './project/store.ts';
import type { ProjectFiles } from './project/zip.ts';
import { emit, state } from './state.ts';

const LAST = 'opm-web:last'; // pre-rename key, kept so the last project still reopens
export const lastProject = (): string => { try { return localStorage.getItem(LAST) || ''; } catch { return ''; } };

/** Show a file in the editor, opening a tab for it. '' shows nothing. */
export function showFile(p: string): void {
  state.file = p;
  if (p && !state.open.includes(p)) state.open.push(p);
  emit('file');
}

/** Show a file; an XML document also becomes the one being transformed. */
export function openFile(p: string): void {
  if (isSource(p) && p !== state.xml) { state.xml = p; emit('source'); }
  showFile(p);
}

export function closeTab(p: string): void {
  const i = state.open.indexOf(p);
  state.open.splice(i, 1);
  if (state.file === p) showFile(state.open[Math.min(i, state.open.length - 1)] || '');
  else emit('file');
}

export function setMode(mode: typeof state.mode): void {
  state.mode = mode; state.docs = '';
  emit('source');
}

/** Show the documentation site of an ODD in the output pane, rebuilt each time. '' goes back to the output. */
export function documentOdd(odd: string): void {
  state.docs = odd;
  emit('docs');
}

export async function openProject(name: string, files: ProjectFiles, meta: ProjectMeta = {}): Promise<void> {
  await persistNow();
  restore(name, files);
  state.project = name; state.open = []; state.file = ''; state.docs = '';
  state.xml = meta.xml && exists(meta.xml) ? meta.xml : firstXml();
  state.mode = isMode(meta.mode) ? meta.mode : 'web';
  state.folder = meta.folder ?? null; state.baseline = meta.sync ?? {}; state.conflicts = [];
  try { localStorage.setItem(LAST, name); } catch {}
  emit('project');
  showFile(state.xml || [oddPath()].find(p => p && exists(p)) || 'opm.toml');
  await persistNow();
}

/** Leave the current project, e.g. after deleting it. */
export function closeProject(): void {
  state.project = null; state.open = []; state.folder = null;
  try { localStorage.removeItem(LAST); } catch {}
  emit('project');
  showFile('');
}
