import { parse } from "@xml-tools/parser";
import { buildAst, type XMLElement } from "@xml-tools/ast";
import { attr, localName } from "./xmlUtils.ts";

/**
 * Re-indent the schema definition elements of an ODD.
 *
 * Only whitespace between the children of the elements below is rewritten.
 * Everything else is copied byte for byte: prose, `<desc>`, `<egXML>`,
 * `<outputRendition>`, templates, comments, entities and the prolog. ODDs may
 * contain TEI prose, so a container is left alone if it holds any text of its
 * own, and the subtrees of prose and example elements are never searched.
 */
const STRUCTURE = new Set([
  "schemaSpec", "specGrp", "elementSpec", "classSpec", "macroSpec", "dataSpec",
  "classes", "attList", "attDef", "valList",
  "model", "modelGrp", "modelSequence",
]);

/** Elements whose content is prose or example code; never searched for structure. */
const PROSE = new Set(["egXML", "eg", "p", "desc", "gloss", "ab", "note", "code", "outputRendition", "exemplum"]);

/** TEI elements that only hold other elements; their gaps beside a definition may break lines. */
const WRAPPER = new Set(["TEI", "teiCorpus", "text", "body", "front", "back", "div"]);

type Edits = { from: number; to: number; text: string }[];

const FILLER = /\s+|<!--[\s\S]*?-->|<\?[\s\S]*?\?>/y;

/** Format an ODD. Returns the text unchanged if it is not well-formed. */
export function formatOdd(text: string): string {
  const { cst, tokenVector, lexErrors, parseErrors } = parse(text);
  if (lexErrors.length || parseErrors.length) return text;
  const root = buildAst(cst as any, tokenVector).rootElement;
  if (!root) return text;

  const edits: Edits = [];
  const find = (el: XMLElement, chain: XMLElement[]) => {
    const name = localName(el.name);
    if (STRUCTURE.has(name)) {
      const out = formatElement(text, el, chain, edits);
      if (out !== null) edits.push({ from: el.position.startOffset, to: el.position.endOffset + 1, text: out });
      return;
    }
    if (PROSE.has(name) || attr(el, "xml:space") === "preserve") return;
    el.subElements.forEach(c => find(c, [...chain, el]));
  };
  find(root, []);

  let result = text;
  // back to front; at the same offset the longer edit goes first
  for (const e of edits.sort((a, b) => b.from - a.from || b.to - a.to)) result = result.slice(0, e.from) + e.text + result.slice(e.to);
  return result;
}

/** Offset just past the `>` that closes the start tag at `from`. */
function openTagEnd(text: string, from: number): number {
  let quote = "";
  for (let i = from; i < text.length; i++) {
    const c = text[i];
    if (quote) { if (c === quote) quote = ""; }
    else if (c === '"' || c === "'") quote = c;
    else if (c === ">") return i + 1;
  }
  return -1;
}

/** Whitespace in front of the line an offset is on, or null if other text precedes it. */
function lineIndent(text: string, offset: number): string | null {
  const start = text.lastIndexOf("\n", offset - 1) + 1;
  const before = text.slice(start, offset);
  return /^[ \t]*$/.test(before) ? before : null;
}

/** Leading whitespace of the line an offset is on, whatever else is on that line. */
function lineStartIndent(text: string, offset: number): string {
  const start = text.lastIndexOf("\n", offset - 1) + 1;
  return /^[ \t]*/.exec(text.slice(start, offset))![0];
}

/**
 * The element reformatted, or null if it is not safe to touch. In a minified file the
 * definition's tags are run together with the TEI wrapper around it; the wrapper's gaps
 * next to the definition are split onto lines too, and nothing else in it is touched.
 */
function formatElement(text: string, el: XMLElement, chain: XMLElement[], edits: Edits): string | null {
  let indent = lineStartIndent(text, el.position.startOffset);
  const unit = unitOf(text, el, indent);
  const gaps: Edits = [];
  // The wrappers directly around the definition, outermost first
  let up = chain.length;
  while (up > 0 && WRAPPER.has(localName(chain[up - 1].name)) && attr(chain[up - 1], "xml:space") !== "preserve") up--;
  const wrappers = chain.slice(up);
  if (wrappers.length) {
    const path = [...wrappers, el], inds: string[] = [];
    path.forEach((e, i) => {
      const own = lineIndent(text, e.position.startOffset);
      inds.push(own ?? (i ? inds[i - 1] + unit : lineStartIndent(text, e.position.startOffset)));
    });
    indent = inds[inds.length - 1];
    wrappers.forEach((w, i) => splitGaps(text, w, path[i + 1], inds[i], inds[i + 1], gaps));
  }
  const out = format(text, el, indent, unit);
  if (out !== null) for (const g of gaps) if (!edits.some(e => e.from === g.from && e.to === g.to)) edits.push(g);
  return out;
}

/** Put a line break on either side of a child that is run together with its parent's tags. */
function splitGaps(text: string, parent: XMLElement, child: XMLElement, parentIndent: string, childIndent: string, edits: Edits): void {
  const kids = parent.subElements, k = kids.indexOf(child), last = k === kids.length - 1;
  const before = k ? kids[k - 1].position.endOffset + 1 : openTagEnd(text, parent.position.startOffset);
  const after = child.position.endOffset + 1;
  const next = last ? text.lastIndexOf("</", parent.position.endOffset) : kids[k + 1].position.startOffset;
  const set = (from: number, to: number, indent: string) => {
    if (/^\s*$/.test(text.slice(from, to)) && !text.slice(from, to).includes("\n") && !edits.some(e => e.from === from && e.to === to)) edits.push({ from, to, text: "\n" + indent });
  };
  set(before, child.position.startOffset, childIndent);
  set(after, next, last ? parentIndent : childIndent);
}

/** One indentation step, taken from how the element's first child is indented now. */
function unitOf(text: string, el: XMLElement, indent: string): string {
  for (const child of el.subElements) {
    const ci = lineIndent(text, child.position.startOffset);
    if (ci !== null && ci.length > indent.length && ci.startsWith(indent)) return ci.slice(indent.length);
  }
  return indent.includes("\t") ? "\t" : "  ";
}

function format(text: string, el: XMLElement, indent: string, unit: string): string | null {
  const { startOffset, endOffset } = el.position;
  const raw = text.slice(startOffset, endOffset + 1);
  if (raw.endsWith("/>")) return raw;
  const open = openTagEnd(text, startOffset);
  const close = raw.lastIndexOf("</") + startOffset;
  if (open < 0 || close < open) return null;

  // Gather the children and comments in order; anything else means mixed content
  const nodes: { text: string; comment: boolean; before: string }[] = [];
  const gap = (from: number, to: number): boolean => {
    let pos = from, ws = "";
    while (pos < to) {
      FILLER.lastIndex = pos;
      const m = FILLER.exec(text);
      if (!m || pos + m[0].length > to) return false;
      if (/^\s/.test(m[0])) ws += m[0];
      else { nodes.push({ text: m[0], comment: true, before: ws }); ws = ""; }
      pos += m[0].length;
    }
    pending = ws;
    return true;
  };
  let pending = "", pos = open;
  for (const child of el.subElements) {
    const { startOffset: s, endOffset: e } = child.position;
    if (!gap(pos, s)) return null;
    const lead = pending; pending = "";
    const nested = STRUCTURE.has(localName(child.name))
      ? format(text, child, indent + unit, unit) : null;
    nodes.push({ text: nested ?? text.slice(s, e + 1), comment: false, before: lead });
    pos = e + 1;
  }
  if (!gap(pos, close)) return null;
  if (!nodes.length) return raw;

  // Lay the nodes out one per line, keeping a blank line wherever there was one
  let out = text.slice(startOffset, open);
  nodes.forEach((n, i) => {
    const breaks = (n.before.match(/\n/g) || []).length;
    if (n.comment && i > 0 && breaks === 0) out += n.before ? " " : "";
    else out += "\n".repeat(Math.min(Math.max(breaks, 1), 2)) + indent + unit;
    out += n.text;
  });
  return out + "\n" + indent + text.slice(close, endOffset + 1);
}
