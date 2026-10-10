// ── page side of the documentation worker ─────────────────────────────────
import type { DocMessage, DocRequest } from './docworker.ts';
import type { ProjectFiles } from '../project/zip.ts';

export interface DocSite { files: Record<string, Uint8Array>; landing: string }

let worker: Worker | null = null;
let tei: Promise<Uint8Array> | null = null;

/** The TEI schema opm merges customizations onto, served beside the wheel (opm would download it). */
function loadTei(): Promise<Uint8Array> {
  tei ??= fetch(new URL('p5all.xml.gz', import.meta.url)).then(async r => {
    if (!r.ok) throw new Error('The TEI schema (dist/p5all.xml.gz) could not be loaded: ' + r.status);
    return new Uint8Array(await r.arrayBuffer());
  }).catch(e => { tei = null; throw e; });
  return tei;
}

/** Build the documentation site for `odd`, as `opm odd document` does, off the page's thread. */
export function documentOdd(files: ProjectFiles, odd: string, progress: (label: string, done: number, total: number) => void): Promise<DocSite> {
  worker ??= new Worker(new URL('docworker.js', import.meta.url), { type: 'module' });
  const w = worker;
  return new Promise((resolve, reject) => {
    const send = (req: DocRequest) => w.postMessage(req);
    w.onerror = e => { worker = null; w.terminate(); reject(new Error(e.message || 'The documentation worker failed to start.')); };
    w.onmessage = async ({ data }: MessageEvent<DocMessage>) => {
      if (data.type === 'progress') progress(data.label, data.done, data.total);
      else if (data.type === 'needTei') {
        progress('Loading the TEI schema…', 0, 0);
        try { send({ files, odd, tei: await loadTei() }); } catch (e) { reject(e); }
      }
      else if (data.type === 'done') resolve({ files: data.files, landing: data.landing });
      else reject(new Error(data.message));
    };
    send({ files, odd });
  });
}
