import { $ } from './dom.ts';

export type StatusKind = '' | 'busy' | 'err';

/** The status line in the output header; 'busy' also runs the progress bar. */
export function setStatus(text: string, kind: StatusKind = ''): void {
  $('status-text').textContent = text;
  $('dot').className = 'dot' + (kind ? ' ' + kind : '');
  $('bar').classList.toggle('on', kind === 'busy');
}
