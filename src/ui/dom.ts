/** Element by id; the type parameter names what the markup holds there. */
export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

/** Create an element with properties, e.g. el('pre', { className: 'err', textContent }). */
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}): HTMLElementTagNameMap[K] {
  return Object.assign(document.createElement(tag), props);
}

/** Offer bytes or text to the user as a file download. */
export function download(file: string, data: BlobPart | string, type = 'application/octet-stream'): void {
  el('a', { href: URL.createObjectURL(new Blob([data], { type })), download: file }).click();
}

export const lastErrorLine = (err: unknown) => String(err).split('\n').filter(Boolean).pop() ?? String(err);
