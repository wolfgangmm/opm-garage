import { MARKED } from '../../config.ts';

interface Marked { parse(src: string): string }
let marked: Promise<Marked> | null = null;

/** Load the Markdown renderer from the CDN; called early so the first preview is not delayed. */
export function loadMarked(): Promise<Marked> {
  marked ??= (import(MARKED) as Promise<{ marked: Marked }>).then(m => m.marked).catch(e => { marked = null; throw e; });
  return marked;
}

const CSS = 'body{font:15px/1.6 system-ui,sans-serif;max-width:46rem;margin:1.5rem auto;padding:0 1rem;color:#222}pre,code{font-family:ui-monospace,monospace;background:#f3f3f0}pre{padding:.75rem;overflow:auto}blockquote{margin-left:0;padding-left:1rem;border-left:3px solid #ccc;color:#555}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:.25rem .5rem}img{max-width:100%}';

/** A sandboxed frame showing the rendered Markdown; raw HTML in it stays inert. */
export async function markdownFrame(source: string): Promise<HTMLIFrameElement> {
  const f = document.createElement('iframe');
  f.sandbox.value = '';
  f.srcdoc = `<style>${CSS}</style>` + (await loadMarked()).parse(source);
  return f;
}
