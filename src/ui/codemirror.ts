import { EditorView, basicSetup } from 'codemirror';
import { EditorState, Compartment, type Extension } from '@codemirror/state';
import { keymap, Decoration, ViewPlugin, MatchDecorator, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import { indentWithTab } from '@codemirror/commands';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { xml } from '@codemirror/lang-xml';
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { StreamLanguage } from '@codemirror/language';
import { toml } from '@codemirror/legacy-modes/mode/toml';
import { python } from '@codemirror/legacy-modes/mode/python';

const style = HighlightStyle.define([
  { tag: [t.tagName, t.angleBracket, t.typeName, t.className, t.keyword], color: 'var(--tag)' },
  { tag: [t.attributeName, t.propertyName], color: 'var(--attr)' },
  { tag: [t.string, t.attributeValue, t.number, t.color, t.unit], color: 'var(--str)' },
  { tag: [t.comment, t.processingInstruction, t.meta], color: 'var(--muted)', fontStyle: 'italic' },
  { tag: [t.atom, t.bool, t.labelName], color: 'var(--accent)' },
]);

const theme = EditorView.theme({
  '&': { height: '100%', backgroundColor: 'var(--panel)', color: 'var(--fg)', fontSize: '12.5px' },
  '.cm-scroller': { fontFamily: 'var(--mono)', lineHeight: '20px' },
  '.cm-gutters': { backgroundColor: 'var(--panel)', color: 'var(--muted)', border: 'none' },
  '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'var(--accent-soft)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-cursor': { borderLeftColor: 'var(--fg)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': { backgroundColor: 'rgba(31, 92, 85, .25)' },
  '.cm-jinja-expr': { color: 'var(--accent)' },
  '.cm-jinja-stmt': { color: 'var(--attr)', fontWeight: '600' },
  '.cm-jinja-comment': { color: 'var(--muted)', fontStyle: 'italic' },
});

// Jinja2 tags are marked on top of whatever base language the template uses
const jinjaDeco = new MatchDecorator({
  regexp: /\{\{[\s\S]*?\}\}|\{%[\s\S]*?%\}|\{#[\s\S]*?#\}/g,
  decoration: m => Decoration.mark({ class: m[0][1] === '{' ? 'cm-jinja-expr' : m[0][1] === '%' ? 'cm-jinja-stmt' : 'cm-jinja-comment' }),
});
const jinja = ViewPlugin.fromClass(class {
  decorations: DecorationSet;
  constructor(v: EditorView) { this.decorations = jinjaDeco.createDeco(v); }
  update(u: ViewUpdate) { this.decorations = jinjaDeco.updateDeco(u, this.decorations); }
}, { decorations: p => p.decorations });

export type EditorKind = 'xml' | 'odd' | 'css' | 'html' | 'jinja' | 'toml' | 'python' | '';
const LANGS: Record<Exclude<EditorKind, ''>, () => Extension[]> = { xml: () => [xml()], odd: () => [xml()], css: () => [css()], html: () => [html(), jinja], jinja: () => [jinja], toml: () => [StreamLanguage.define(toml)], python: () => [StreamLanguage.define(python)] };

export interface Editor {
  getValue(): string;
  /** Replace the text without reporting it as an edit. */
  setValue(text: string, kind: EditorKind): void;
}

export function createEditor(parent: HTMLElement, onChange: () => void): Editor {
  const lang = new Compartment();
  let silent = false;
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: '',
      extensions: [
        basicSetup, keymap.of([indentWithTab]), theme, syntaxHighlighting(style), lang.of([]),
        EditorView.updateListener.of(u => { if (u.docChanged && !silent) onChange(); }),
      ],
    }),
  });
  return {
    getValue: () => view.state.doc.toString(),
    setValue(text, kind) {
      silent = true;
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text }, effects: lang.reconfigure(kind ? LANGS[kind]() : []),
        selection: { anchor: 0 }, scrollIntoView: true });
      silent = false;
    },
  };
}
