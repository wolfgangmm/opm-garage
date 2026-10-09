// ── a small popover describing a control, shown on hover or keyboard focus ──
// One element for the whole page, placed with fixed coordinates, so it is never
// clipped by a parent that hides its overflow (the mode bar does).
import { el } from './dom.ts';

let box: HTMLElement | null = null, timer: ReturnType<typeof setTimeout> | undefined;

function show(target: HTMLElement, title: string, text: string): void {
  box ??= document.body.appendChild(el('div', { className: 'tip', role: 'tooltip', id: 'tip' }));
  box.replaceChildren(el('strong', { textContent: title }), el('span', { textContent: text }));
  box.hidden = false;
  const r = target.getBoundingClientRect(), w = box.offsetWidth, h = box.offsetHeight;
  const left = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, innerWidth - w - 8));
  const below = r.bottom + 8 + h <= innerHeight;
  box.style.left = left + 'px';
  box.style.top = (below ? r.bottom + 8 : r.top - 8 - h) + 'px';
  target.setAttribute('aria-describedby', 'tip');
}

function hide(target?: HTMLElement): void {
  clearTimeout(timer);
  if (box) box.hidden = true;
  target?.removeAttribute('aria-describedby');
}

/** Describe `target` in a popover: after a short pause on hover, at once on keyboard focus. */
export function tip(target: HTMLElement, title: string, text: string): void {
  target.addEventListener('pointerenter', () => { clearTimeout(timer); timer = setTimeout(() => show(target, title, text), 350); });
  target.addEventListener('focus', () => { if (target.matches(':focus-visible')) show(target, title, text); });
  for (const ev of ['pointerleave', 'blur', 'click']) target.addEventListener(ev, () => hide(target));
  target.addEventListener('keydown', e => { if (e.key === 'Escape') hide(target); });
}
