import type { ElementSpec, ModelNode, ModelType, OddClipboardState } from "../../odd/oddTypes.ts";

/**
 * Clipboard for model rules and whole elementSpecs, shared by every ODD the
 * page opens so copy/paste works across elementSpecs and files.
 */
let clip: OddClipboardState = null;
const listeners = new Set<() => void>();

export function copyModel(model: ModelNode): void {
  const data = cloneModel(model);
  clip = { kind: "model", data };
  listeners.forEach((fn) => fn());
}

export function copyElementSpec(spec: ElementSpec): void {
  const data = stripElementSpec(spec);
  clip = { kind: "elementSpec", data };
  listeners.forEach((fn) => fn());
}

/** Subscribe to clipboard changes (so paste affordances can update). */
export function onClipChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** A fresh clone of the clipboard model, or null when empty or not a model. */
export function pasteModel(): ModelNode | null {
  if (clip?.kind !== "model") {
    return null;
  }
  return cloneModel(clip.data);
}

export function hasModelClip(): boolean {
  return clip?.kind === "model";
}

/** Type of the copied rule, so a paste target can refuse what it can't hold. */
export function modelClipType(): ModelType | null {
  return clip?.kind === "model" ? clip.data.type : null;
}

export function hasElementSpecClip(): boolean {
  return clip?.kind === "elementSpec";
}

/** A fresh clone of the copied elementSpec, or null. */
export function pasteElementSpec(): ElementSpec | null {
  return clip?.kind === "elementSpec" ? JSON.parse(JSON.stringify(clip.data)) : null;
}

function cloneModel(model: ModelNode): ModelNode {
  return JSON.parse(JSON.stringify(model));
}

function stripElementSpec(spec: ElementSpec): ElementSpec {
  const { range, hasUnmodeled, otherChildren, ...rest } = spec;
  void range;
  void hasUnmodeled;
  void otherChildren;
  return JSON.parse(JSON.stringify(rest));
}
