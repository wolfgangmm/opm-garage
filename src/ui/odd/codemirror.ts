import { LitElement, html } from "lit";
import { EditorView, drawSelection, keymap, showPanel, type Panel } from "@codemirror/view";
import { EditorState, EditorSelection, StateEffect, StateField } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { xml } from "@codemirror/lang-xml";
import { css } from "@codemirror/lang-css";
import { xQuery } from "@codemirror/legacy-modes/mode/xquery";
import {
  syntaxHighlighting,
  bracketMatching,
  StreamLanguage,
  syntaxTree,
} from "@codemirror/language";
import { highlightStyle } from "../codemirror.ts";

/** Form fields look like the app's inputs and share the editor's syntax colours. */
const fieldTheme = EditorView.theme({
  "&": {
    color: "var(--fg)",
    backgroundColor: "var(--panel)",
    border: "1px solid var(--btn-line)",
    borderRadius: "6px",
    fontSize: "12px",
  },
  ".cm-content": { fontFamily: "var(--mono)", caretColor: "var(--fg)", padding: "5px 0" },
  ".cm-line": { padding: "0 8px" },
  "&.cm-focused": { outline: "none", borderColor: "var(--accent)" },
  ".cm-cursor": { borderLeftColor: "var(--fg)" },
  ".cm-activeLine": { backgroundColor: "transparent" },
  ".cm-selectionBackground, &.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
    backgroundColor: "color-mix(in srgb, var(--accent) 40%, transparent) !important",
  },
  ".cm-gutters": { backgroundColor: "transparent", color: "var(--faint)", border: "none" },
  ".cm-input-panel": { padding: "4px 6px", borderTop: "1px solid var(--line-2)" },
  ".cm-input-panel input": {
    width: "100%",
    boxSizing: "border-box",
    height: "26px",
    padding: "0 6px",
    color: "var(--fg)",
    backgroundColor: "var(--panel)",
    border: "1px solid var(--btn-line)",
    borderRadius: "4px",
    fontFamily: "var(--sans)",
  },
});

/**
 * The element-name prompt for the "enclose with" command is implemented as a
 * CodeMirror panel rather than `window.prompt`.
 * Toggling the state field shows/hides the input at the bottom of the editor.
 */
const toggleEncloseWith = StateEffect.define<boolean>();

const encloseWithState = StateField.define<boolean>({
  create: () => false,
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(toggleEncloseWith)) {
        value = e.value;
      }
    }
    return value;
  },
  provide: (f) =>
    showPanel.from(f, (on) => (on ? createEncloseWithPanel : null)),
});

/** Wrap each selection range with `start`/`end`, keeping the text selected. */
function wrapSelection(view: EditorView, start: string, end: string) {
  view.dispatch(
    view.state.changeByRange((range) => ({
      changes: [
        { from: range.from, insert: start },
        { from: range.to, insert: end },
      ],
      range: EditorSelection.range(
        range.from + start.length,
        range.to + start.length
      ),
    }))
  );
}

function createEncloseWithPanel(view: EditorView): Panel {
  const dom = document.createElement("div");
  dom.className = "cm-input-panel";
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Element name (Enter to confirm, Esc to cancel)";
  input.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      const tag = input.value.trim();
      view.dispatch({ effects: toggleEncloseWith.of(false) });
      if (tag) {
        wrapSelection(view, `<${tag}>`, `</${tag}>`);
      }
      view.focus();
    } else if (ev.key === "Escape") {
      ev.preventDefault();
      view.dispatch({ effects: toggleEncloseWith.of(false) });
      view.focus();
    }
  });
  dom.appendChild(input);
  return { top: false, dom, mount: () => setTimeout(() => input.focus(), 50) };
}

/**
 * A single-value CodeMirror field as a custom element. Set `value` and
 * `language` ("xml" | "css" | "xquery" | "text"); emits a `cm-change` event
 * (detail = string) on every edit. Used for predicate (XPath-ish), template,
 * rendition-CSS and parameter-value (XQuery) fields.
 */
export class CmField extends LitElement {
  static properties = {
    value: {},
    language: {},
  };
  declare value: string;
  declare language: "xml" | "css" | "xquery" | "text";
  private view?: EditorView;
  /** Suppress cm-change while syncing the document from the value property. */
  private syncing = false;

  constructor() {
    super();
    this.value = "";
    this.language = "text";
  }

  render() {
    return html`<div class="cm-host"></div>`;
  }

  firstUpdated() {
    const host = this.renderRoot.querySelector(".cm-host") as HTMLElement;
    const extensions = [
      history(),
      drawSelection(),
      keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
      syntaxHighlighting(highlightStyle, { fallback: true }),
      bracketMatching(),
      EditorView.lineWrapping,
      encloseWithState,
      fieldTheme,
      EditorView.updateListener.of((u) => {
        if (u.docChanged && !this.syncing) {
          this.value = u.state.doc.toString();
          this.dispatchEvent(
            new CustomEvent("cm-change", {
              detail: this.value,
              bubbles: true,
              composed: true,
            })
          );
        }
      }),
    ];
    if (this.language === "xml") {
      extensions.push(xml());
    } else if (this.language === "css") {
      extensions.push(css());
    } else if (this.language === "xquery") {
      extensions.push(StreamLanguage.define(xQuery));
    }
    this.view = new EditorView({
      parent: host,
      state: EditorState.create({ doc: this.value ?? "", extensions }),
    });
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has("value") && this.view) {
      const current = this.view.state.doc.toString();
      // The ODD is re-read after each save and parsed values are trimmed; don't
      // wipe a trailing newline or space the user is in the middle of typing.
      const typing =
        this.view.hasFocus && current.trim() === (this.value ?? "").trim();
      if (!typing && current !== (this.value ?? "")) {
        this.syncing = true;
        try {
          this.view.dispatch({
            changes: { from: 0, to: current.length, insert: this.value ?? "" },
          });
        } finally {
          this.syncing = false;
        }
      }
    }
  }

  /** Insert text at the current cursor (used by the template toolbar). */
  insert(text: string) {
    if (!this.view) {
      return;
    }
    const { from, to } = this.view.state.selection.main;
    this.view.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: from + text.length },
    });
    this.view.focus();
  }

  /** Find the innermost XML element node enclosing the given position. */
  private enclosingElement(pos: number) {
    const tree = syntaxTree(this.view!.state);
    // Try both sides so a cursor sitting on a tag boundary (e.g. at the very
    // start of the document, before any click into the editor) still resolves.
    for (const side of [1, -1] as const) {
      const node = tree.resolveInner(pos, side);
      for (let cur: typeof node | null = node; cur; cur = cur.parent) {
        if (cur.name === "Element") {
          return cur;
        }
      }
    }
    return null;
  }

  /** Extend each selection to cover the XML element around the cursor. */
  selectElement() {
    const view = this.view;
    if (!view) {
      return;
    }
    view.dispatch(
      view.state.changeByRange((range) => {
        const el = this.enclosingElement(range.from);
        if (el) {
          const sel = EditorSelection.range(el.from, el.to);
          return { selection: sel, range: sel };
        }
        return { range };
      })
    );
    view.focus();
  }

  /** Prompt for an element name and wrap the current selection in it. */
  encloseWith() {
    const view = this.view;
    if (!view) {
      return;
    }
    view.dispatch({
      effects: toggleEncloseWith.of(!view.state.field(encloseWithState)),
    });
  }

  /** Strip the start/end (or self-closing) tags of the enclosing element. */
  removeEnclosing() {
    const view = this.view;
    if (!view) {
      return;
    }
    view.dispatch(
      view.state.changeByRange((range) => {
        const el = this.enclosingElement(range.from);
        const startTag = el?.firstChild;
        const endTag = el?.lastChild;
        if (!el || !startTag || !endTag) {
          return { range };
        }
        if (startTag.name === "SelfClosingTag") {
          return {
            range: EditorSelection.cursor(startTag.from),
            changes: [{ from: startTag.from, to: startTag.to, insert: "" }],
          };
        }
        return {
          range: EditorSelection.range(
            startTag.from,
            endTag.from - (startTag.to - startTag.from)
          ),
          changes: [
            { from: startTag.from, to: startTag.to, insert: "" },
            { from: endTag.from, to: endTag.to, insert: "" },
          ],
        };
      })
    );
    view.focus();
  }
}

customElements.define("cm-field", CmField);
