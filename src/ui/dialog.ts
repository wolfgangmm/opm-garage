// One designed dialog replaces confirm(), prompt() and alert().
import { $, el } from './dom.ts';

interface AskOptions {
  title: string;
  /** Shown in monospace before `text`, e.g. a path or project name. */
  name?: string;
  text?: string;
  ok?: string;
  danger?: boolean;
  cancel?: boolean;
}

/** A confirmation: resolves to true for OK, false for Cancel or Escape. */
export function ask(opts: AskOptions): Promise<boolean>;
/** A prompt: resolves to the entered text, or null when cancelled. */
export function ask(opts: AskOptions & { input: string }): Promise<string | null>;
export function ask({ title, name = '', text = '', ok = 'OK', danger = false, cancel = true, input }: AskOptions & { input?: string }): Promise<boolean | string | null> {
  const dlg = $<HTMLDialogElement>('dlg'), field = $<HTMLInputElement>('dlg-input');
  const okBtn = $<HTMLButtonElement>('dlg-ok'), noBtn = $<HTMLButtonElement>('dlg-cancel');
  $('dlg-title').textContent = title;
  const p = $('dlg-text');
  p.replaceChildren();
  if (name) p.append(el('b', { textContent: name }));
  p.append(text);
  field.hidden = input === undefined; field.value = input ?? '';
  okBtn.textContent = ok; okBtn.className = 'btn ' + (danger ? 'danger' : 'primary');
  noBtn.hidden = !cancel;
  return new Promise(resolve => {
    dlg.returnValue = '';
    noBtn.onclick = () => dlg.close('cancel');
    dlg.addEventListener('close', () => {
      const yes = dlg.returnValue === 'ok';
      resolve(input === undefined ? yes : yes ? field.value : null);
    }, { once: true });
    dlg.showModal();
    if (input !== undefined) { field.focus(); field.setSelectionRange(field.value.length, field.value.length); }
    else (cancel ? noBtn : okBtn).focus();
  });
}

export const confirmDelete = (title: string, name: string, text: string) => ask({ title, name, text, ok: 'Delete', danger: true });
export const notify = (title: string, text: string, name = '') => ask({ title, name, text, cancel: false });
