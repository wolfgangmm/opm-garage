// ── chunked output: a folder of pages, served to the preview frame by sw.js ──
// The page can't run a server, so each run's files go into Cache Storage under
// preview/<run>/ and the service worker answers the frame's requests from there.

const CACHE = 'opm-preview';
const TYPES: Record<string, string> = {
  html: 'text/html', css: 'text/css', js: 'text/javascript', mjs: 'text/javascript', json: 'application/json',
  svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
  ico: 'image/x-icon', woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf', txt: 'text/plain', xml: 'application/xml',
};
const typeOf = (p: string) => {
  const t = TYPES[p.split('.').pop()!.toLowerCase()] ?? 'application/octet-stream';
  return t.startsWith('text/') || t.endsWith('json') || t.endsWith('xml') ? t + '; charset=utf-8' : t;
};

let runs = 0;

/** Put the files of one run where the service worker finds them; returns the run's base URL. */
export async function publishSite(files: string[], read: (p: string) => Uint8Array): Promise<string> {
  if (!('serviceWorker' in navigator) || !('caches' in window)) throw new Error('The chunked preview needs a service worker, which this browser does not offer here.');
  // an active worker is enough: the frame is a client of its own, served by it even when
  // this page is not (after a hard reload); showSite checks the frame once it has loaded
  const reg = await Promise.race([navigator.serviceWorker.ready, new Promise(r => setTimeout(r, 10000))]);
  if (!reg) throw new Error('The service worker did not start, so the chunked preview cannot be served. Check its status in the browser\'s developer tools (Application → Service workers).');
  const base = new URL(`preview/${Date.now().toString(36)}-${++runs}/`, location.href).href;
  const cache = await caches.open(CACHE);
  await Promise.all(files.map(p => cache.put(base + p, new Response(read(p) as BlobPart, { headers: { 'Content-Type': typeOf(p) } }))));
  // drop earlier runs, including those left over from a previous visit
  for (const req of await cache.keys()) if (!req.url.startsWith(base)) void cache.delete(req);
  return base;
}

/** Whether a loaded preview frame was served by the service worker rather than the dev or web server. */
export function servedByWorker(frame: HTMLIFrameElement): boolean {
  try { return !!frame.contentWindow?.navigator.serviceWorker?.controller; } catch { return false; }
}

/** The page shown in a preview frame, relative to the run it belongs to, or ''. */
export function framePage(frame: HTMLIFrameElement | null, base: string): string {
  try {
    const href = frame?.contentWindow?.location.href.replace(/[?#].*$/, '') ?? '';
    return href.startsWith(base) ? href.slice(base.length) : '';
  } catch { return ''; }
}
