// ── output pane: mode tabs, template menu, transform and result ───────────
import { setMode } from '../actions.ts';
import { EXT, MODES, PREVIEW, TEMPLATE_KIND, type Mode } from '../config.ts';
import { base, config, oddPath, projectFiles, readText, writeFile } from '../project/fs.ts';
import { setToml, tomlString, unsetToml } from '../project/toml.ts';
import { convert, ready } from '../runtime/opm.ts';
import { emit, on, state } from '../state.ts';
import { $, download, el } from './dom.ts';
import { DOWNLOAD } from './icons.ts';
import { markdownFrame } from './previews/markdown.ts';
import { compilePdf } from './previews/pdf.ts';
import { setStatus } from './status.ts';

interface Result { mode: Mode; name: string; result: string | Uint8Array }
let last: Result | null = null;
/** Bumped by every result shown, so a slow preview (PDF, Markdown) cannot overwrite a newer one. */
let seq = 0;

// ── transform ─────────────────────────────────────────────────────────────
let timer: ReturnType<typeof setTimeout> | undefined;
let running = false, again = false, queued = false;

/** Transform after a pause in typing. */
const schedule = () => { clearTimeout(timer); timer = setTimeout(run, 600); };
/** Transform once, however many changes asked for it in the same turn. */
function requestRun(): void {
  if (queued) return;
  queued = true;
  queueMicrotask(() => { queued = false; void run(); });
}

async function run(): Promise<void> {
  clearTimeout(timer);
  if (!ready() || !state.project) return;
  if (!state.xml) {
    last = null; hideDownload();
    showError('This project has no XML source yet. Upload one, or add a file under data/.');
    setStatus('No XML source', 'err');
    return;
  }
  if (running) { again = true; return; }
  running = true; again = false;
  setStatus('Transforming…', 'busy');
  await new Promise(r => setTimeout(r, 30)); // let the UI paint
  const t = performance.now();
  try {
    last = { mode: state.mode, name: base(state.xml), result: convert(state.dir, state.xml, state.mode) };
    showResult(last);
    setStatus('Up to date · ' + Math.round(performance.now() - t) + ' ms');
  } catch (err) {
    last = null; hideDownload();
    showError(String(err).split('\n').filter(Boolean).slice(-4).join('\n'));
    setStatus('Error', 'err');
  }
  running = false;
  if (again) void run();
}

// ── result ────────────────────────────────────────────────────────────────
export function clearOut(): void {
  seq++;
  for (const c of [...$('out').children]) if (c.id !== 'bar') c.remove();
  $('out').classList.remove('stage');
}
function showError(text: string): void {
  clearOut();
  $('out').append(el('pre', { className: 'err', textContent: text }));
}
const hideDownload = () => { $('download').hidden = true; };
function setDownload(file: string, onclick: () => void): void {
  const dl = $<HTMLButtonElement>('download');
  dl.innerHTML = DOWNLOAD; dl.append(file); dl.hidden = false;
  dl.onclick = onclick;
}

/** Show a preview on paper over a neutral ground, apart from the app's own chrome. */
function showOnPaper(frame: HTMLIFrameElement): void {
  const paper = el('div', { className: 'paper' });
  paper.append(frame);
  $('out').classList.add('stage'); $('out').append(paper);
}

function showResult({ mode, name, result }: Result): void {
  clearOut();
  const my = seq;
  const file = name.replace(/\.[^.]+$/, '') + '.' + EXT[mode];
  const save = () => download(file, result as BlobPart, typeof result === 'string' ? 'text/plain' : 'application/octet-stream');
  setDownload(file, save);
  const rendered = PREVIEW.has(mode) && state.view === 'rendered';
  if (typeof result !== 'string') {
    const card = el('div', { className: 'filecard' });
    const btn = el('button', { className: 'btn primary', textContent: '↓ Download', onclick: save });
    card.append(el('div', { className: 'ico', textContent: mode === 'epub' ? '📖' : '📄' }),
      el('div', { className: 'name', textContent: file }),
      el('div', { className: 'size', textContent: (result.length / 1024).toFixed(1) + ' KB · binary output' }), btn);
    $('out').append(card);
  } else if (mode === 'typst' && rendered) {
    void showPdf(name, result, my);
  } else if (mode === 'markdown' && rendered) {
    markdownFrame(result).then(f => { if (my === seq) showOnPaper(f); }, err => { if (my === seq) showError(String(err)); });
  } else if (rendered) {
    showOnPaper(el('iframe', { srcdoc: result }));
  } else {
    $('out').append(el('pre', { textContent: result }));
  }
}

async function showPdf(name: string, source: string, my: number): Promise<void> {
  setStatus('Compiling PDF… (first time downloads the Typst compiler)', 'busy');
  try {
    const pdf = await compilePdf(source);
    if (my !== seq) return;
    const url = URL.createObjectURL(new Blob([pdf as BlobPart], { type: 'application/pdf' }));
    $('out').append(el('iframe', { src: url }));
    const file = name.replace(/\.[^.]+$/, '') + '.pdf';
    setDownload(file, () => el('a', { href: url, download: file }).click());
    setStatus('PDF ready');
  } catch (err) {
    if (my !== seq) return;
    showError('PDF compilation failed:\n' + String((err as Error).message || err));
    setStatus('Error', 'err');
  }
}

// ── modes, view toggle, templates, command line ───────────────────────────
function updateModeUi(): void {
  for (const b of $('modes').children as HTMLCollectionOf<HTMLElement>) b.setAttribute('aria-pressed', String(b.dataset.mode === state.mode));
  $('out-mode').textContent = state.mode;
  const view = $('view'), preview = PREVIEW.has(state.mode);
  view.hidden = !preview;
  view.firstElementChild!.textContent = state.mode === 'typst' ? 'PDF' : 'Rendered';
  view.lastElementChild!.textContent = ({ markdown: 'Markdown', typst: 'Typst' } as Partial<Record<Mode, string>>)[state.mode] || 'HTML';
  if (!preview) state.view = 'code';
  else if (state.view === 'code' && !view.dataset.touched) state.view = 'rendered';
  for (const b of view.children as HTMLCollectionOf<HTMLElement>) b.setAttribute('aria-pressed', String(b.dataset.v === state.view));
}

// the template menu lists the project's own templates; its choice is written to opm.toml
function refreshTemplates(): void {
  const kind = TEMPLATE_KIND[state.mode];
  $('tpl-field').hidden = !kind || !state.project;
  if (!kind || !state.project) return;
  const sel = $<HTMLSelectElement>('tpl');
  sel.replaceChildren(new Option('opm default', ''));
  const suffix = kind === 'html' ? /\.html\.j2$/ : /\.typ\.j2$/;
  for (const p of projectFiles().filter(p => suffix.test(p))) sel.append(new Option(p, p));
  const cur = tomlString(config(), 'transform.' + state.mode, 'template');
  if (cur && ![...sel.options].some(o => o.value === cur)) sel.append(new Option(cur + ' (missing)', cur));
  sel.value = cur;
}

function updateCommand(): void {
  if (!state.project) { $('cmd').textContent = ''; $('warn').hidden = true; return; }
  $('cmd').textContent = `$ opm transform ${state.xml || '<no XML source>'} -t ${state.mode} -o output.${EXT[state.mode]}`;
  const w = mismatch();
  $('warn').hidden = !w; $('warn').textContent = w;
}

/** Warn when the bundled ODD in use does not match the document's vocabulary. */
function mismatch(): string {
  const src = state.xml ? readText(state.xml) : '', odd = base(oddPath());
  const root = src.match(/<(?!\?|!)([\w:.-]+)/)?.[1] ?? '';
  const head = src.slice(0, 2000);
  const kind = /^(TEI|tei:TEI)$/.test(root) ? 'tei'
    : /docbook\.org\/ns\/docbook|docbook\.org\/schema|<!DOCTYPE[^>]*docbook/i.test(head) ? 'docbook'
    : /^(article|book|chapter|section)$/.test(root) && /dtd-version|<!DOCTYPE[^>]*(jats|journalpublishing|archiving)/i.test(head) ? 'jats' : '';
  const expect = ({ 'teipublisher.odd': 'tei', 'jats.odd': 'jats', 'docbook.odd': 'docbook' } as Record<string, string>)[odd];
  return kind && expect && kind !== expect ? `⚠ ${odd} is meant for ${expect.toUpperCase()}, but the source looks like ${kind.toUpperCase()}.` : '';
}

export function initOutput(): void {
  for (const m of MODES) {
    const b = el('button', { textContent: m, onclick: () => setMode(m) });
    b.dataset.mode = m;
    $('modes').append(b);
  }
  const view = $('view');
  for (const b of view.children as HTMLCollectionOf<HTMLElement>) b.onclick = () => {
    state.view = b.dataset.v as typeof state.view; view.dataset.touched = '1';
    for (const x of view.children) x.setAttribute('aria-pressed', String(x === b));
    if (last) showResult(last);
  };
  $('tpl').onchange = () => {
    const v = $<HTMLSelectElement>('tpl').value, sec = 'transform.' + state.mode, toml = readText('opm.toml');
    writeFile('opm.toml', v ? setToml(toml, sec, 'template', v) : unsetToml(toml, sec, 'template'));
    emit('files');
  };
  $('copy-cmd').onclick = () => {
    try { void navigator.clipboard.writeText(($('cmd').textContent ?? '').replace(/^\$ /, '')); } catch {}
    $('copy-cmd').textContent = 'Copied';
    setTimeout(() => $('copy-cmd').textContent = 'Copy', 1400);
  };

  on('project', () => {
    updateModeUi(); refreshTemplates(); updateCommand();
    if (state.project) requestRun(); else { last = null; clearOut(); hideDownload(); }
  });
  on('source', () => { updateModeUi(); refreshTemplates(); updateCommand(); requestRun(); });
  on('files', () => { refreshTemplates(); updateCommand(); requestRun(); });
  on('config', () => { refreshTemplates(); updateCommand(); });
  on('edit', schedule);
  updateModeUi();
}
