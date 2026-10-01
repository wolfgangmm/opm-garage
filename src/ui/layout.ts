// ── collapsing: files and output fold to a labelled rail ──────────────────
import { $ } from './dom.ts';

const open = { tree: true, out: true };

function apply(): void {
  $('main').style.setProperty('--cols', `${open.tree ? '248px' : '40px'} minmax(0, 1fr) ${open.out ? 'minmax(0, 1fr)' : '40px'}`);
  $('explorer').classList.toggle('collapsed', !open.tree);
  $('p-out').classList.toggle('collapsed', !open.out);
}

export function initLayout(): void {
  for (const [id, key, box] of [['t-tree', 'tree', 'explorer'], ['t-out', 'out', 'p-out']] as const) {
    $(id).onclick = e => { e.stopPropagation(); open[key] = !open[key]; apply(); };
    // a click anywhere on a collapsed rail opens it again
    $(box).addEventListener('click', e => { if (!open[key] && (e.target as Element).closest('#' + box) === $(box)) { open[key] = true; apply(); } });
  }
  apply();
}
