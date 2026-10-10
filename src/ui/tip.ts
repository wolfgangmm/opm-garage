// ── popovers describing controls, shown on hover or keyboard focus ────────
// Markup only: an element with data-tip (and optionally data-tip-title) gets
// one, and so does an icon button, from its aria-label. The listeners sit on
// the document, so controls rendered later (the ODD editor's) need nothing
// more. One popover element for the page, placed with fixed coordinates, so
// it is never clipped by a parent that hides its overflow.
import { el } from './dom.ts';

const SOURCE = '[data-tip], button[aria-label]';
let box: HTMLElement | null = null, timer: ReturnType<typeof setTimeout> | undefined, shown: HTMLElement | null = null;

const sourceOf = (t: EventTarget | null) => (t instanceof Element ? t.closest<HTMLElement>(SOURCE) : null);

function show(target: HTMLElement): void {
  const text = target.dataset.tip ?? target.getAttribute('aria-label');
  if (!text || !target.isConnected) return;
  const title = target.dataset.tipTitle;
  box ??= document.body.appendChild(el('div', { className: 'tip', role: 'tooltip', id: 'tip' }));
  box.replaceChildren(...(title ? [el('strong', { textContent: title })] : []), el('span', { textContent: text }));
  box.hidden = false;
  const r = target.getBoundingClientRect(), w = box.offsetWidth, h = box.offsetHeight;
  box.style.left = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, innerWidth - w - 8)) + 'px';
  box.style.top = (r.bottom + 8 + h <= innerHeight ? r.bottom + 8 : r.top - 8 - h) + 'px';
  // an aria-label already names the control; only a data-tip adds a description
  if (target.dataset.tip) target.setAttribute('aria-describedby', 'tip');
  shown = target;
}

function hide(): void {
  clearTimeout(timer);
  if (box) box.hidden = true;
  shown?.removeAttribute('aria-describedby');
  shown = null;
}

export function initTips(): void {
  document.addEventListener('pointerover', e => {
    const t = sourceOf(e.target);
    if (t === shown) return;
    hide();
    if (t) timer = setTimeout(() => show(t), 350);
  });
  document.addEventListener('pointerout', e => {
    if (sourceOf(e.target) && !sourceOf(e.relatedTarget)) hide();
  });
  document.addEventListener('focusin', e => {
    const t = sourceOf(e.target);
    hide();
    // not while typing into a field: there the popover would sit on the text
    if (t && t.matches(':focus-visible') && !t.matches('input, textarea, select, [contenteditable]')) show(t);
  });
  document.addEventListener('focusout', hide);
  document.addEventListener('pointerdown', hide, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hide(); });
  // scrolling moves the control away from its popover
  document.addEventListener('scroll', hide, true);
}
