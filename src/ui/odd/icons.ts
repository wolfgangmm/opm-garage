// ── 14px stroke icons for the ODD form, drawn like the ones in index.html ───
import { svg } from 'lit';

const icon = (d: ReturnType<typeof svg>) =>
  svg`<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">${d}</svg>`;

export const COPY = icon(svg`<rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 5.5V4A1.5 1.5 0 0 0 9 2.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1.5"/>`);
export const PASTE = icon(svg`<rect x="3" y="3" width="10" height="11" rx="1.5"/><path d="M6 3V2h4v1M6 7h4M6 10h4"/>`);
export const TRASH = icon(svg`<path d="M2.5 4.5h11M6 4.5V3h4v1.5M4 4.5l.7 8.6A1 1 0 0 0 5.7 14h4.6a1 1 0 0 0 1-.9l.7-8.6"/>`);
export const ADD = icon(svg`<path d="M8 3v10M3 8h10"/>`);
export const SEARCH = icon(svg`<circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/>`);
