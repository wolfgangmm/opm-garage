// ── project files live in Pyodide's filesystem, as they would on disk ─────
import { HIDDEN } from '../config.ts';
import { py } from '../runtime/pyodide.ts';
import { resetDir } from '../runtime/opm.ts';
import { state } from '../state.ts';
import { readToml, tomlString, type TomlConfig } from './toml.ts';
import { isText, type ProjectFiles } from './zip.ts';

export interface Entry { path: string; dir: boolean }

export const base = (p: string) => p.split('/').pop() ?? '';
export const dirOf = (p: string) => p.replace(/[^/]*$/, '');
export const extOf = (p: string) => (base(p).match(/\.([^.]+)$/)?.[1] ?? '').toLowerCase();
/** Resolve `.` and `..` segments. */
export function normPath(p: string): string {
  const out: string[] = [];
  for (const seg of p.split('/')) { if (seg === '..') out.pop(); else if (seg && seg !== '.') out.push(seg); }
  return out.join('/');
}

export const abs = (p: string) => state.dir + '/' + p;
export const readText = (p: string): string => { try { return py.FS.readFile(abs(p), { encoding: 'utf8' }); } catch { return ''; } };
export const readBytes = (p: string): Uint8Array => py.FS.readFile(abs(p));
export const exists = (p: string): boolean => py.FS.analyzePath(abs(p)).exists;
export function writeFile(p: string, data: string | Uint8Array): void {
  py.FS.mkdirTree(dirOf(abs(p)).replace(/\/$/, ''));
  py.FS.writeFile(abs(p), data);
}
export function renamePath(from: string, to: string): void {
  py.FS.mkdirTree(dirOf(abs(to)).replace(/\/$/, ''));
  py.FS.rename(abs(from), abs(to));
}

/** Every file and folder in the project, depth first, alphabetical within a folder. */
export function walk(rel = ''): Entry[] {
  const out: Entry[] = [];
  for (const n of (py.FS.readdir(abs(rel).replace(/\/$/, '')) as string[]).sort()) {
    if (n === '.' || n === '..' || HIDDEN.has(n)) continue;
    const p = rel + n;
    if (py.FS.isDir(py.FS.stat(abs(p)).mode)) out.push({ path: p, dir: true }, ...walk(p + '/'));
    else out.push({ path: p, dir: false });
  }
  return out;
}
export const projectFiles = () => walk().filter(f => !f.dir).map(f => f.path);

export function snapshot(): ProjectFiles {
  const files: ProjectFiles = {};
  for (const p of projectFiles()) files[p] = isText(p) ? readText(p) : readBytes(p);
  return files;
}
/** Write a saved project into a fresh folder and make it the current one. */
export function restore(name: string, files: ProjectFiles): void {
  state.dir = '/projects/' + name;
  resetDir(state.dir);
  for (const [p, v] of Object.entries(files)) writeFile(p, v);
}

export const config = (): TomlConfig => readToml(readText('opm.toml'));
export const oddPath = () => tomlString(config(), 'transform', 'odd');
export const isOdd = (p: string) => extOf(p) === 'odd' || (extOf(p) === 'xml' && /<schemaSpec/.test(readText(p).slice(0, 20000)));
export const isSource = (p: string) => /\.(xml|tei|xhtml)$/i.test(p) && !isOdd(p);
export const firstXml = () => projectFiles().find(isSource) ?? '';
