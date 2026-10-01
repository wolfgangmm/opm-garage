// The splash covers the app until Python, opm and the last project are loaded.
import { $ } from './dom.ts';

export function splash(step: string, pct: number): void {
  $('splash-step').textContent = step;
  $('splash-fill').style.width = pct + '%';
}

export function hideSplash(): void {
  const s = $('splash');
  s.classList.add('done');
  setTimeout(() => s.remove(), 300);
}

/** Keep the splash up with the error, rather than leave a half-working page. */
export function splashFailed(err: unknown): void {
  $('splash').classList.add('failed');
  splash('Could not start: ' + ((err as Error)?.message || err) + '. Reload to try again.', 100);
}
