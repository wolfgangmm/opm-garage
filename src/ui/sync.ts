// ── folder sync: header indicator, linking a folder, settling conflicts ───
import { canUseFolders, listDisk, pickFolder } from '../project/folder.ts';
import { projectInFolder } from '../project/store.ts';
import { connect, linkFolder, resolve, unlinkFolder } from '../project/sync.ts';
import type { Choice } from '../project/syncplan.ts';
import { on, state } from '../state.ts';
import { ask, notify } from './dialog.ts';
import { $, el } from './dom.ts';

const LABEL: Record<typeof state.sync, string> = {
  idle: 'synced', busy: 'syncing…', permission: 'reconnect', conflict: 'conflict', error: 'sync failed',
};

/** Pick a folder for the open project; files already in it are merged. */
export async function chooseFolder(): Promise<void> {
  let dir: FileSystemDirectoryHandle;
  try { dir = await pickFolder(); } catch { return; } // cancelled
  const other = await projectInFolder(dir);
  if (other && other !== state.project) return void notify('Folder in use', ` is already synced with the project ${other}.`, dir.name);
  const n = (await listDisk(dir)).size;
  if (n && !await ask({ title: 'Merge with this folder?', name: dir.name,
    text: ` holds ${n} file${n > 1 ? 's' : ''}. They will be merged with the project; you decide about files that differ on both sides.`, ok: 'Merge' })) return;
  await linkFolder(dir);
}

export async function confirmUnlink(): Promise<void> {
  if (state.folder && await ask({ title: 'Stop syncing?', name: state.folder.name, text: ' and the project stay as they are, but changes no longer flow between them.', ok: 'Stop syncing' }))
    unlinkFolder();
}

// the conflicts the user put off; the dialog opens again only for new ones
let postponed = '';
const conflictKey = () => state.conflicts.map(c => c.path).join('\n');

function showConflicts(): void {
  const dlg = $<HTMLDialogElement>('sync-dlg');
  if (dlg.open || !state.conflicts.length) return;
  const rows = state.conflicts.map(c => {
    const sel = el('select');
    sel.append(
      el('option', { value: 'local', textContent: c.local === undefined ? 'Delete on disk' : 'Keep browser version' }),
      el('option', { value: 'disk', textContent: c.disk ? 'Keep disk version' : 'Delete in browser' }));
    if (c.local !== undefined && c.disk) sel.append(el('option', { value: 'both', textContent: 'Keep both' }));
    const row = el('div', { className: 'item' });
    row.append(el('span', { className: 'nm', textContent: c.path, title: c.path }), sel);
    return { path: c.path, row, sel };
  });
  $('sync-list').replaceChildren(...rows.map(r => r.row));
  $('sync-later').onclick = () => dlg.close('later');
  dlg.addEventListener('close', () => {
    if (dlg.returnValue !== 'ok') { postponed = conflictKey(); return; }
    void resolve(new Map(rows.map(r => [r.path, r.sel.value as Choice | 'both'])));
  }, { once: true });
  dlg.returnValue = '';
  dlg.showModal();
}

function render(): void {
  const btn = $('sync-ind'), show = !!(state.project && state.folder);
  btn.hidden = !show;
  if (!show) return;
  btn.dataset.state = state.sync;
  $('sync-name').textContent = state.folder!.name;
  $('sync-state').textContent = LABEL[state.sync];
  btn.title = state.sync === 'permission' ? 'Allow access to the folder again to resume syncing'
    : state.sync === 'conflict' ? 'Some files changed both here and on disk'
    : 'Synced with the folder ' + state.folder!.name;
  if (state.sync === 'conflict' && conflictKey() !== postponed) showConflicts();
}

export function initSyncUi(): void {
  $('sync-ind').onclick = () => {
    if (state.sync === 'permission') void connect(true);
    else if (state.sync === 'conflict') showConflicts();
    else if (state.sync === 'error') void connect();
  };
  $('proj-folder').hidden = !canUseFolders();
  on(['project', 'sync'], render);
}
