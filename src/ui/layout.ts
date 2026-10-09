// ── collapsing: files and output fold to a labelled rail ──────────────────
import { $ } from './dom.ts';
import { ENLARGE, SHRINK } from './icons.ts';

const open = { tree: true, out: true };
let enlarged = false;

// ── splitting: share of the source + output width taken by the output ────
const SPLIT = 'opm-split';
let split = (() => { try { const v = Number(localStorage.getItem(SPLIT)); return v > 0 && v < 1 ? v : 0.5; } catch { return 0.5; } })();

function apply(): void {
  const out = open.out ? `minmax(0, ${split}fr)` : '40px';
  $('main').style.setProperty('--cols', `${open.tree ? '248px' : '40px'} minmax(0, ${open.out ? 1 - split : 1}fr) ${out}`);
  $('explorer').classList.toggle('collapsed', !open.tree);
  $('p-out').classList.toggle('collapsed', !open.out);
  // ── enlarging: the output pane over the whole window ──
  $('p-out').classList.toggle('enlarged', enlarged);
  const btn = $('enlarge');
  btn.innerHTML = enlarged ? SHRINK : ENLARGE;
  btn.title = enlarged ? 'Back to the editor (Esc)' : 'Enlarge output to the whole window';
  btn.setAttribute('aria-pressed', String(enlarged));
}

function setEnlarged(on: boolean): void {
  enlarged = on;
  if (on) open.out = true;
  apply();
}

function initSplitter(): void {
  const handle = $('splitter');
  const save = () => { try { localStorage.setItem(SPLIT, String(split)); } catch {} };
  handle.onpointerdown = e => {
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    const left = $('p-src').getBoundingClientRect().left, right = $('p-out').getBoundingClientRect().right;
    // iframes in the preview would otherwise swallow the pointer while dragging
    document.body.classList.add('resizing');
    handle.onpointermove = m => { split = Math.min(0.85, Math.max(0.15, (right - m.clientX) / (right - left))); apply(); };
    handle.onpointerup = handle.onpointercancel = () => {
      handle.onpointermove = handle.onpointerup = handle.onpointercancel = null;
      document.body.classList.remove('resizing');
      save();
    };
  };
  handle.ondblclick = () => { split = 0.5; apply(); save(); };
}

export function initLayout(): void {
  for (const [id, key, box] of [['t-tree', 'tree', 'explorer'], ['t-out', 'out', 'p-out']] as const) {
    $(id).onclick = e => { e.stopPropagation(); open[key] = !open[key]; apply(); };
    // a click anywhere on a collapsed rail opens it again
    $(box).addEventListener('click', e => { if (!open[key] && (e.target as Element).closest('#' + box) === $(box)) { open[key] = true; apply(); } });
  }
  $('enlarge').onclick = () => setEnlarged(!enlarged);
  // Esc inside the preview frame never reaches this page; the button is always there to leave
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && enlarged && !document.querySelector('dialog[open]')) setEnlarged(false); });
  initSplitter();
  apply();
}
