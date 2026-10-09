// ── folder sync: keep the project and a folder on disk in step, both ways ──
import { showFile } from '../actions.ts';
import { removePath } from '../runtime/opm.ts';
import { emit, on, state, type AppEvent } from '../state.ts';
import { persistSoon } from './autosave.ts';
import { gone, listDisk, permitted, readDisk, removeDisk, watchFolder, writeDisk } from './folder.ts';
import { abs, exists, extOf, firstXml, isOdd, projectFiles, readBytes, writeFile } from './fs.ts';
import { hashBytes, planSync, settle, stampChanged, type Choice, type Conflict, type DiskState, type LocalState } from './syncplan.ts';

let stopWatch = () => {};
let running = false, again = false;
/** Content hashes of the browser's files; dropped whenever they may have changed. */
let local: LocalState | null = null;
/** True while the sync itself announces changes, so they don't trigger another sync. */
let applying = false;
let timer: ReturnType<typeof setTimeout> | undefined;

function setSync(s: typeof state.sync): void {
  if (state.sync !== s) { state.sync = s; emit('sync'); }
}

function localHashes(): LocalState {
  if (!local) {
    local = {};
    for (const p of projectFiles()) local[p] = hashBytes(readBytes(p));
  }
  return local;
}

export function syncSoon(delay = 800): void {
  clearTimeout(timer);
  timer = setTimeout(() => void syncNow(), delay);
}

/** Compare the project with its folder and copy what changed; overlapping runs are folded into one. */
export async function syncNow(): Promise<void> {
  if (!state.folder || state.sync === 'permission') return;
  if (running) { again = true; return; }
  running = true;
  try {
    do { again = false; await syncOnce(); } while (again);
  } catch (err) {
    console.error('folder sync failed', err);
    // a folder that went away or lost its permission needs the user
    const lost = state.folder && !await permitted(state.folder).catch(() => false);
    setSync(lost ? 'permission' : 'error');
    if (!lost) syncSoon(5000);
  } finally {
    running = false;
  }
}

async function syncOnce(): Promise<void> {
  const root = state.folder!, project = state.project;
  const base = state.baseline;
  const disk: DiskState = {}, read = new Map<string, Uint8Array>();
  for (const [p, f] of await listDisk(root)) {
    if (!stampChanged(base[p], f.mtime, f.size)) { disk[p] = base[p]; continue; }
    const bytes = await readDisk(f.handle).catch(gone);
    if (!bytes) { syncSoon(); return; } // changing under us; look again shortly
    read.set(p, bytes);
    disk[p] = { hash: hashBytes(bytes), mtime: f.mtime, size: f.size };
  }
  // the user may have switched projects or unlinked while we read
  if (state.project !== project || state.folder !== root || state.baseline !== base) { again = true; return; }

  const plan = planSync(base, disk, localHashes());
  const busy = plan.pull.length + plan.push.length + plan.delLocal.length + plan.delDisk.length > 0;
  if (busy) setSync('busy');

  // into the browser: synchronous, so nothing can interleave
  if (plan.pull.length || plan.delLocal.length) {
    for (const p of plan.pull) writeFile(p, read.get(p)!);
    for (const p of plan.delLocal) removePath(abs(p));
    local = null;
    announce([...plan.pull, ...plan.delLocal], plan.delLocal);
  }
  // out to disk: record each new stamp so our own write isn't read back as a change
  for (const p of plan.push) {
    const bytes = readBytes(p);
    plan.baseline[p] = { hash: hashBytes(bytes), ...await writeDisk(root, p, bytes) };
  }
  for (const p of plan.delDisk) await removeDisk(root, p);

  if (state.folder !== root) return;
  state.baseline = plan.baseline;
  state.conflicts = plan.conflicts.map(path => ({ path, disk: disk[path], local: localHashes()[path] }));
  if (busy || read.size) persistSoon();
  setSync(state.conflicts.length ? 'conflict' : 'idle');
}

/** Tell the panes what the sync changed in the browser. */
function announce(changed: string[], deleted: string[]): void {
  const gone = new Set(deleted);
  const events: AppEvent[] = ['files'];
  if (changed.some(p => p === 'opm.toml' || isOdd(p) || extOf(p) === 'odd')) events.push('config');
  if (gone.has(state.xml)) { state.xml = firstXml(); events.push('source'); }
  else if (changed.includes(state.xml)) events.push('source');
  state.open = state.open.filter(p => !gone.has(p));
  applying = true;
  try {
    emit(...events);
    if (gone.has(state.file)) showFile(state.open[0] || '');
  } finally { applying = false; }
}

/** Settle conflicts as the user chose; 'both' keeps the browser's version and saves the disk's beside it. */
export async function resolve(choices: Map<string, Choice | 'both'>): Promise<void> {
  const root = state.folder;
  if (!root) return;
  let base = state.baseline;
  const files = await listDisk(root);
  for (const c of state.conflicts) {
    const choice = choices.get(c.path);
    if (!choice) continue;
    const f = files.get(c.path);
    if (choice === 'both' && f) writeFile(asideName(c.path), await readDisk(f.handle));
    base = settle(base, c, choice === 'both' ? 'local' : choice);
  }
  state.baseline = base; state.conflicts = [];
  local = null;
  setSync('idle');
  if (choices.size) emit('files');
  await syncNow();
}

/** a/b.xml → a/b.disk.xml, numbered if that exists too. */
function asideName(p: string): string {
  const ext = extOf(p), stem = ext ? p.slice(0, -ext.length - 1) : p, dot = ext ? '.' + ext : '';
  let name = stem + '.disk' + dot, i = 2;
  while (exists(name)) name = stem + '.disk-' + i++ + dot;
  return name;
}

/** Start syncing with the linked folder, if we have permission; `ask` prompts and needs a click. */
export async function connect(ask = false): Promise<void> {
  stopWatch(); stopWatch = () => {};
  const root = state.folder;
  if (!root) return;
  if (!await permitted(root, ask).catch(() => false)) { if (state.folder === root) setSync('permission'); return; }
  if (state.folder !== root) return;
  state.sync = 'idle'; emit('sync');
  stopWatch = watchFolder(root, () => void syncNow());
  await syncNow();
}

/** Link the open project to a folder; the first sync merges both sides. */
export async function linkFolder(dir: FileSystemDirectoryHandle): Promise<void> {
  state.folder = dir; state.baseline = {}; state.conflicts = [];
  await connect();
}

export function unlinkFolder(): void {
  stopWatch(); stopWatch = () => {};
  state.folder = null; state.baseline = {}; state.conflicts = [];
  setSync('idle'); emit('sync');
  persistSoon();
}

export function initSync(): void {
  on(['files', 'config', 'edit', 'source'], () => {
    local = null;
    if (state.folder && !applying) syncSoon();
  });
  on('project', () => {
    local = null; state.sync = 'idle';
    emit('sync');
    void connect();
  });
}
