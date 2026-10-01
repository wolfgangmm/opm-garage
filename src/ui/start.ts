// ── start screen: new project, examples, saved projects, zip import ───────
import { closeProject, openProject } from '../actions.ts';
import { persistNow } from '../project/autosave.ts';
import { snapshot } from '../project/fs.ts';
import { deleteProject, getProject, listProjects } from '../project/store.ts';
import { fromZip } from '../project/zip.ts';
import { copyExample, initProject, listExamples, listVocabularies } from '../runtime/opm.ts';
import { on, state } from '../state.ts';
import { confirmDelete, notify } from './dialog.ts';
import { $, el, lastErrorLine } from './dom.ts';
import { setStatus } from './status.ts';

export function showStart(on: boolean): void {
  $('start').classList.toggle('on', on);
  $('start-close').hidden = !state.project;
  if (on) void refreshProjectList();
}

const safe = (n: string) => n.trim().replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '');
async function uniqueName(want: string): Promise<string> {
  const have = new Set((await listProjects()).map(p => p.name));
  const n = safe(want) || 'project';
  let name = n, i = 2;
  while (have.has(name)) name = n + '-' + i++;
  return name;
}

export async function openSaved(name: string): Promise<void> {
  const p = await getProject(name);
  if (p) await openProject(name, p.files, p.meta);
}

async function createProject(kind: 'example' | 'vocab', what: string): Promise<void> {
  const all = $<HTMLInputElement>('all-tpl').checked, cards = document.querySelectorAll<HTMLButtonElement>('.card');
  cards.forEach(c => c.disabled = true);
  setStatus('Creating project…', 'busy');
  try {
    const name = await uniqueName($<HTMLInputElement>('new-name').value || (kind === 'example' ? what : what + '-project'));
    await persistNow(); state.project = null; // the old project is saved; scaffold into a fresh folder
    state.dir = '/projects/' + name;
    const sample = (kind === 'example' ? copyExample : initProject)(state.dir, what, all);
    await openProject(name, snapshot(), { xml: sample });
    $<HTMLInputElement>('new-name').value = '';
  } catch (err) {
    setStatus('Error', 'err');
    void notify('Could not create the project', lastErrorLine(err));
  }
  cards.forEach(c => c.disabled = false);
}

export async function importZip(f: File): Promise<void> {
  try {
    const files = fromZip(new Uint8Array(await f.arrayBuffer()));
    await openProject(await uniqueName(f.name.replace(/\.zip$/i, '')), files);
  } catch (err) {
    showStart(true);
    void notify('Could not read the zip', (err as Error).message);
  }
}

async function refreshProjectList(): Promise<void> {
  const list = $('proj-list');
  list.replaceChildren();
  for (const { name, updated } of await listProjects()) {
    const open = el('button', { className: 'btn', textContent: 'Open', onclick: () => void openSaved(name) });
    const del = el('button', { className: 'btn', textContent: '✕', title: 'Delete' });
    del.onclick = async () => {
      if (!await confirmDelete('Delete project?', name, ' will be removed from this browser. Export it first if you want to keep a copy.')) return;
      await deleteProject(name);
      if (state.project === name) closeProject();
      showStart(true);
    };
    const row = el('div', { className: 'item' });
    row.append(el('span', { className: 'nm', textContent: name }), el('small', { textContent: new Date(updated).toLocaleDateString() }), open, del);
    list.append(row);
  }
}

function card(title: string, sub: string, onclick: () => void): HTMLButtonElement {
  const b = el('button', { className: 'card', onclick });
  b.append(el('b', { textContent: title }), el('small', { textContent: sub }));
  return b;
}

/** Fill the example and vocabulary cards; needs the Python runtime. */
export function renderCards(): void {
  $('ex-cards').replaceChildren(...listExamples().map(e => card(e.title, e.summary, () => void createProject('example', e.name))));
  $('new-cards').replaceChildren(...listVocabularies().map(([v, label]) => card(label, 'stub ODD, templates, sample document', () => void createProject('vocab', v))));
}

export function initStart(): void {
  $('start-close').onclick = () => showStart(false);
  $('proj-import').onclick = () => $('file-zip').click();
  $<HTMLInputElement>('file-zip').onchange = e => {
    const input = e.target as HTMLInputElement, f = input.files?.[0];
    input.value = '';
    if (f) void importZip(f);
  };
  on('project', () => showStart(!state.project));
}
