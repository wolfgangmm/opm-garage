import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';

/** Project files by path: text files as strings, everything else as bytes. */
export type ProjectFiles = Record<string, string | Uint8Array>;

const TEXT = /\.(xml|odd|css|j2|toml|json|md|txt|py|html|typ|svg|xsd|rng|xsl|xslt)$/i;
export const isText = (p: string) => TEXT.test(p);

export function toZip(files: ProjectFiles): Uint8Array {
  const o: Record<string, Uint8Array> = {};
  for (const [p, v] of Object.entries(files)) o[p] = typeof v === 'string' ? strToU8(v) : v;
  return zipSync(o);
}

export function fromZip(bytes: Uint8Array): ProjectFiles {
  const raw = unzipSync(bytes), files: ProjectFiles = {};
  const names = Object.keys(raw).filter(p => !p.endsWith('/') && !p.startsWith('__MACOSX/') && !/(^|\/)\.DS_Store$/.test(p));
  // a zip of a folder has one common top directory; drop it
  const first = names[0]?.split('/')[0];
  const top = names.length && !names.includes('opm.toml') && names.every(p => p.includes('/') && p.split('/')[0] === first) ? first + '/' : '';
  for (const p of names) files[p.slice(top.length)] = isText(p) ? strFromU8(raw[p]) : raw[p];
  return files;
}
