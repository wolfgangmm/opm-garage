// ── autosave: files are in the FS at once; the browser copy follows ───────
import { on, state } from '../state.ts';
import { snapshot } from './fs.ts';
import { putProject } from './store.ts';

let timer: ReturnType<typeof setTimeout> | undefined;

export function persistSoon(): void {
  clearTimeout(timer);
  timer = setTimeout(persistNow, 800);
}

export async function persistNow(): Promise<void> {
  clearTimeout(timer);
  if (!state.project) return;
  await putProject(state.project, snapshot(), { xml: state.xml, mode: state.mode, folder: state.folder ?? undefined, sync: state.baseline });
}

export function initAutosave(): void {
  on(['files', 'config', 'edit', 'source'], persistSoon);
}
