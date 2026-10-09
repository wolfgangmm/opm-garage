// ── typed calls into glue.py ───────────────────────────────────────────────
import type { Mode } from '../config.ts';
import { py } from './pyodide.ts';

export interface Example { name: string; title: string; summary: string }
/** A vocabulary and its display label, e.g. ['tei', 'TEI']. */
export type Vocabulary = [string, string];

const fn = <A extends unknown[], R>(name: string) => (...args: A): R => py.globals.get(name)(...args);

export const ready = () => py !== undefined;
export const listExamples = (): Example[] => JSON.parse(fn<[], string>('list_examples')());
export const listVocabularies = (): Vocabulary[] => JSON.parse(fn<[], string>('list_vocabs')());
export const resetDir = fn<[dir: string], void>('reset_dir');
export const removePath = fn<[path: string], void>('remove_path');
/** Scaffold an empty project; returns its sample document, relative to dir. */
export const initProject = fn<[dir: string, vocabulary: string, templates: boolean], string>('init_project');
/** Copy a bundled example; returns its sample document, relative to dir. */
export const copyExample = fn<[dir: string, example: string, templates: boolean], string>('copy_example');

/** Transform root/xml in the given mode: text for text formats, bytes for epub and docx. */
export function convert(root: string, xml: string, mode: Mode): string | Uint8Array {
  const result = fn<[string, string, Mode], string | { toJs(): Uint8Array }>('convert')(root, xml, mode);
  return typeof result === 'string' ? result : result.toJs();
}

export interface ChunkRun { files: string[]; landing: string }
/** Chunk root/xml into HTML pages below the absolute folder out. */
export const chunk = (root: string, xml: string, out: string): ChunkRun => JSON.parse(fn<[string, string, string], string>('chunk')(root, xml, out));

/** Text of an ODD shipped with opm, such as teipublisher.odd, or undefined. */
export const packagedOdd = (name: string): string | undefined => fn<[string], string | undefined>('packaged_odd_text')(name) ?? undefined;
