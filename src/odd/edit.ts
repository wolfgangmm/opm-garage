// ── text edits behind the visual ODD editor ────────────────────────────────
// Every edit takes the whole ODD text and returns the new text. Only the
// affected <elementSpec> is rewritten, so formatting elsewhere is kept.
// Adapted from ODDity's oddEditorProvider.ts and elementSpecInsert.ts.
import { parse } from '@xml-tools/parser';
import { buildAst } from '@xml-tools/ast';
import { parseOdd } from './oddModel.ts';
import { serializeElementSpec } from './oddSerialize.ts';
import { spliceElementSpec } from './oddSplice.ts';
import type { ElementSpec, OddModel } from './oddTypes.ts';
import { attr, localName, visit } from './xmlUtils.ts';

export type EditResult = { text: string; ident?: string } | { error: string };

/** Rewrite the spec at `index` in place. Returns the text unchanged if nothing differs. */
export function updateSpec(text: string, index: number, spec: ElementSpec): string {
  const model = parseOdd(text), target = model.elementSpecs[index];
  if (model.xmlError || !target?.range) return text;
  // The splice prefixes its result with the line's indent; when other markup
  // precedes the spec on its line, keep that markup and drop the prefix again
  const { start, end } = target.range, indent = lineIndent(text, start);
  const xml = spliceElementSpec(indent, model.indentUnit, spec, text.slice(start, end)).slice(indent.length);
  return text.slice(0, start) + xml + text.slice(end);
}

export function deleteSpec(text: string, index: number): string {
  const target = parseOdd(text).elementSpecs[index];
  if (!target?.range) return text;
  // A spec on lines of its own goes with its indentation and trailing newline
  const lineStart = lineStartOffset(text, target.range.start), ownLine = startsLine(text, target.range.start);
  const start = ownLine ? lineStart : target.range.start;
  const end = target.range.end + (ownLine && text[target.range.end] === '\n' ? 1 : 0);
  return text.slice(0, start) + text.slice(end);
}

/**
 * Add an elementSpec for `ident`. When the parent ODD defines it, its definition
 * is copied in with mode="change"; otherwise a blank model is inserted.
 */
export function addSpec(text: string, ident: string, parentText?: string): EditResult {
  const model = parseOdd(text);
  if (model.empty || model.schemaSpecBodyEnd === undefined) return { error: 'No <schemaSpec> found in this ODD.' };
  const id = ident.trim(), error = validateIdent(id, definedIdents(model));
  if (!id || error) return { error: error ?? 'Enter an element name.' };
  const raw = parentText ? extractElementSpecs(parentText).get(id) : undefined;
  const block = raw
    ? reindentRaw(forceModeChange(raw), lineIndent(parentText!, parentText!.indexOf(raw)), model.elementSpecIndent)
    : serializeElementSpec(model.elementSpecIndent, model.indentUnit,
      { ident: id, mode: 'change', models: [{ type: 'model', behaviour: 'inline', params: [], renditions: [], models: [] }] });
  return { text: insertBeforeSchemaSpecEnd(text, model, block), ident: id };
}

/** Insert a copied spec, renaming it if its ident is taken. */
export function pasteSpec(text: string, spec: ElementSpec): EditResult {
  const model = parseOdd(text);
  if (model.empty || model.schemaSpecBodyEnd === undefined) return { error: 'No <schemaSpec> found in this ODD.' };
  const ident = uniqueIdent(spec.ident?.trim() || 'copy', definedIdents(model));
  const xml = serializeElementSpec(model.elementSpecIndent, model.indentUnit, { ...spec, ident });
  return { text: insertBeforeSchemaSpecEnd(text, model, xml), ident };
}

/** Idents the parent ODD defines that this ODD does not yet override. */
export function inheritable(text: string, parentText: string): string[] {
  const defined = definedIdents(parseOdd(text));
  return [...extractElementSpecs(parentText).keys()].filter(id => !defined.has(id)).sort();
}

export function validateIdent(value: string, defined: Set<string>): string | undefined {
  const v = value.trim();
  if (!v) return undefined;
  if (defined.has(v)) return `An elementSpec with ident "${v}" already exists.`;
  if (!/^[A-Za-z_][\w.-]*(:[A-Za-z_][\w.-]*)?$/.test(v)) return 'Not a valid element name.';
  return undefined;
}

const definedIdents = (model: OddModel) => new Set(model.elementSpecs.map(s => s.ident).filter(Boolean));

function uniqueIdent(base: string, defined: Set<string>): string {
  if (!defined.has(base)) return base;
  let candidate = `${base}_copy`, n = 2;
  while (defined.has(candidate)) candidate = `${base}_copy${n++}`;
  return candidate;
}

// Single-entry memo: the parent ODD rarely changes between calls
let memoText: string | undefined, memoSpecs: Map<string, string> | undefined;

/** Source of each `<elementSpec ident="…">`, keyed by ident. */
export function extractElementSpecs(text: string): Map<string, string> {
  if (text === memoText && memoSpecs) return memoSpecs;
  const { cst, tokenVector } = parse(text);
  const map = new Map<string, string>();
  visit(buildAst(cst as never, tokenVector), el => {
    if (localName(el.name) !== 'elementSpec') return;
    const ident = attr(el, 'ident'), p = el.position;
    if (ident && !map.has(ident) && p && p.startOffset >= 0) map.set(ident, text.slice(p.startOffset, p.endOffset + 1));
  });
  memoText = text; memoSpecs = map;
  return map;
}

/** Set mode="change" on the start tag only, so template content stays byte-for-byte. */
export function forceModeChange(raw: string): string {
  const gt = raw.indexOf('>');
  if (gt === -1) return raw;
  let open = raw.slice(0, gt);
  if (/\bmode\s*=\s*"[^"]*"/.test(open)) open = open.replace(/\bmode\s*=\s*"[^"]*"/, 'mode="change"');
  else if (/\bident\s*=\s*"[^"]*"/.test(open)) open = open.replace(/(\bident\s*=\s*"[^"]*")/, '$1 mode="change"');
  else open = open.replace(/^(<\s*[\w:]+)/, '$1 mode="change"');
  return open + raw.slice(gt);
}

function reindentRaw(raw: string, parentIndent: string, targetIndent: string): string {
  return raw.split('\n').map((line, i) =>
    i === 0 ? targetIndent + line
      : parentIndent && line.startsWith(parentIndent) ? targetIndent + line.slice(parentIndent.length) : line).join('\n');
}

/**
 * Put a block of lines just before `</schemaSpec>`: on the line above it when
 * the closing tag starts its line, otherwise on lines of its own before it, so
 * the block never lands inside the preceding elementSpec.
 */
function insertBeforeSchemaSpecEnd(text: string, model: OddModel, block: string): string {
  const end = model.schemaSpecBodyEnd!;
  if (startsLine(text, end)) {
    const at = lineStartOffset(text, end);
    return text.slice(0, at) + block + '\n' + text.slice(at);
  }
  return text.slice(0, end) + '\n' + block + '\n' + text.slice(end);
}

const lineStartOffset = (text: string, offset: number) => text.lastIndexOf('\n', offset - 1) + 1;

/** True when only whitespace precedes `offset` on its line. */
const startsLine = (text: string, offset: number) => /^[ \t]*$/.test(text.slice(lineStartOffset(text, offset), offset));

function lineIndent(text: string, offset: number): string {
  return (/^[ \t]*/.exec(text.slice(lineStartOffset(text, offset), offset)) ?? [''])[0];
}
