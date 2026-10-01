// ── shared state and the events that tell panes to redraw ──────────────────
// Panes never call each other. An action changes `state`, then emits what
// changed; each pane listens for the events that affect what it shows.
import type { Mode } from './config.ts';

export interface AppState {
  /** Name of the open project, or null on the start page before one is opened. */
  project: string | null;
  /** The project's folder in the Pyodide file system. */
  dir: string;
  /** Open editor tabs, as project-relative paths. */
  open: string[];
  /** The file shown in the editor. */
  file: string;
  /** The XML document being transformed. */
  xml: string;
  mode: Mode;
  /** Output pane view: the rendered preview or the generated code. */
  view: 'rendered' | 'code';
}

export const state: AppState = { project: null, dir: '', open: [], file: '', xml: '', mode: 'web', view: 'rendered' };

/**
 * - `project`: a project was opened or closed
 * - `files`: files were added, removed or renamed, or changed outside the editor
 * - `config`: opm.toml or an ODD was edited (pipeline and templates may differ)
 * - `edit`: the file in the editor was typed into
 * - `file`: another file is shown, or the open tabs changed
 * - `source`: the XML document or output mode changed
 */
export type AppEvent = 'project' | 'files' | 'config' | 'edit' | 'file' | 'source';

const handlers = new Map<AppEvent, Set<() => void>>();

export function on(events: AppEvent | AppEvent[], fn: () => void): void {
  for (const e of ([] as AppEvent[]).concat(events)) (handlers.get(e) ?? handlers.set(e, new Set()).get(e)!).add(fn);
}

/** Run every handler for the given events once, even if it listens to several. */
export function emit(...events: AppEvent[]): void {
  const run = new Set<() => void>();
  for (const e of events) for (const fn of handlers.get(e) ?? []) run.add(fn);
  for (const fn of run) fn();
}
