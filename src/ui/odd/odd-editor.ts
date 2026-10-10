import { LitElement, html, nothing, type TemplateResult } from "lit";
import { live } from "lit/directives/live.js";
import type { OddModel, ElementSpec } from "../../odd/oddTypes.ts";
import { parseOdd } from "../../odd/oddModel.ts";
import { addSpec, deleteSpec, inheritable, pasteSpec, updateSpec, type EditResult } from "../../odd/edit.ts";
import { normalizeXPathFields } from "../../odd/xpathUtils.ts";
import { hasElementSpecClip, onClipChange, pasteElementSpec } from "./clipboard.ts";
import { ModelOpenState } from "./model-open-state.ts";
import { validateElementSpecXml } from "../../odd/templateValidation.ts";
import { ADD, PASTE } from "./icons.ts";
import "./elementspec-panel.ts";

/** Where the form reads and writes the ODD it shows. */
export interface OddHost {
  read(): string;
  write(text: string): void;
  /** Text of the ODD named in schemaSpec/@source, if it can be found. */
  parent(source: string): string | undefined;
  /** Switch the editor to the XML source. */
  showSource(): void;
}

/**
 * The visual ODD editor: a list of elementSpecs on the left and the selected
 * one's model cards on the right. Field edits are debounced and spliced into
 * the ODD text; structural changes (add, paste, delete) are written at once.
 * Adapted from ODDity's webview, with the extension host replaced by OddHost.
 */
export class OddEditor extends LitElement {
  static properties = {
    model: { attribute: false, state: true },
    selected: { attribute: false, state: true },
    channel: { attribute: false },
  };
  declare model?: OddModel;
  declare selected: number;
  /** Output mode of the preview, to mark the rules that fire for it. */
  declare channel: string;

  host?: OddHost;
  private newIdent = "";
  private addError = "";
  private filter = "";
  private parentText?: string;
  private saveTimer?: number;
  private unsubClip?: () => void;
  private readonly modelOpenState = new ModelOpenState();

  constructor() {
    super();
    this.selected = -1;
    this.channel = "";
  }

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.modelOpenState.onChange = () => this.requestUpdate();
    this.addEventListener("odd-change", this.scheduleSave);
    this.addEventListener("spec-ident-change", this.onIdentChange);
    this.unsubClip = onClipChange(() => this.requestUpdate());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.flush();
    this.unsubClip?.();
  }

  /** Show a (possibly different) ODD; keeps the selection when it is the same file. */
  open(host: OddHost, fresh: boolean): void {
    this.flush();
    this.host = host;
    if (fresh) {
      this.selected = -1;
      this.filter = "";
      this.addError = "";
      this.modelOpenState.clear();
    }
    this.reload();
  }

  /** Re-read the ODD, e.g. after it changed outside the form. */
  reload(selectIdent?: string): void {
    if (!this.host || this.saveTimer !== undefined) return;
    const text = this.host.read();
    this.model = parseOdd(text);
    this.model.xmlError ??= wellFormednessError(text);
    const source = this.model.meta.source;
    this.parentText = source ? this.host.parent(source) : undefined;
    const specs = this.model.elementSpecs;
    if (selectIdent) {
      const i = specs.findIndex((s) => s.ident === selectIdent);
      if (i >= 0) this.selected = i;
    }
    if (this.selected < 0 || this.selected >= specs.length) this.selected = specs.length ? 0 : -1;
    this.requestUpdate();
    if (selectIdent) this.scrollSelectedIntoView();
  }

  /** Write a pending field edit now instead of waiting for the debounce. */
  flush(): void {
    if (this.saveTimer === undefined) return;
    clearTimeout(this.saveTimer);
    this.save();
  }

  private scrollSelectedIntoView(): void {
    void this.updateComplete.then(() =>
      this.querySelector(".spec-item.active")?.scrollIntoView({ block: "nearest" }));
  }

  private onIdentChange = () => {
    // Refresh the label in the list without touching the selection
    this.requestUpdate();
  };

  private scheduleSave = () => {
    if (this.saveTimer !== undefined) clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => this.save(), 300);
  };

  private save() {
    this.saveTimer = undefined;
    const spec = this.model?.elementSpecs[this.selected];
    if (!this.host || !spec || this.model?.xmlError) return;
    // Invalid template or description markup stays in the form until fixed
    if (validateElementSpecXml(spec)) {
      this.requestUpdate();
      return;
    }
    normalizeXPathFields(spec);
    const before = this.host.read(), after = updateSpec(before, this.selected, stripRange(spec));
    if (after !== before) this.host.write(after);
    // Pick up the new source ranges for the next edit
    this.reload();
  }

  private apply(result: EditResult): void {
    if ("error" in result) {
      this.addError = result.error;
      this.requestUpdate();
      return;
    }
    this.addError = "";
    this.host!.write(result.text);
    this.reload(result.ident);
  }

  private addSpec() {
    this.flush();
    if (!this.newIdent.trim()) return;
    this.apply(addSpec(this.host!.read(), this.newIdent, this.parentText));
    if (!this.addError) this.newIdent = "";
  }

  private pasteSpec() {
    const spec = pasteElementSpec();
    if (!spec) return;
    this.flush();
    this.apply(pasteSpec(this.host!.read(), spec));
  }

  private deleteSpec() {
    if (this.selected < 0) return;
    this.flush();
    this.modelOpenState.removeSpec(this.selected);
    this.host!.write(deleteSpec(this.host!.read(), this.selected));
    this.reload();
  }

  render(): TemplateResult {
    const model = this.model;
    if (!model) return html``;
    if (model.xmlError) {
      return html`<div class="odd-error" role="alert">
        <span><b>The ODD is not well-formed.</b> ${model.xmlError.replace(/\.$/, "")}. Fix it in the source view to continue editing here.</span>
        <button class="btn" @click=${() => this.host?.showSource()}>Open source view</button>
      </div>`;
    }
    if (model.empty) {
      return html`<div class="odd-error">
        <span>This file has no &lt;schemaSpec&gt; to edit.</span>
        <button class="btn" @click=${() => this.host?.showSource()}>Open source view</button>
      </div>`;
    }
    const options = this.parentText && this.host ? inheritable(this.host.read(), this.parentText) : [];
    return html`
      <aside class="odd-side">
        <div class="odd-meta">
          <span class="odd-title">${model.meta.title || model.meta.ident || "ODD"}</span>
          ${model.meta.source ? html`<span class="odd-source">source: ${model.meta.source}</span>` : nothing}
        </div>
        <div class="odd-add">
          <input
            type="text"
            list="odd-inheritable"
            placeholder="Add element…"
            data-tip=${options.length ? `Pick an element from ${model.meta.source} to override, or type a new one` : "Element name"}
            .value=${live(this.newIdent)}
            @input=${(e: Event) => (this.newIdent = (e.target as HTMLInputElement).value)}
            @keydown=${(e: KeyboardEvent) => { if (e.key === "Enter") this.addSpec(); }}
          />
          <datalist id="odd-inheritable">${options.map((id) => html`<option value=${id}></option>`)}</datalist>
          <button class="ibtn" aria-label="Add elementSpec" @click=${() => this.addSpec()}>${ADD}</button>
          ${hasElementSpecClip()
            ? html`<button class="ibtn" aria-label="Paste elementSpec" @click=${() => this.pasteSpec()}>${PASTE}</button>`
            : nothing}
        </div>
        ${this.addError ? html`<div class="odd-add-error">${this.addError}</div>` : nothing}
        <div class="cap">ELEMENTSPECS</div>
        <input
          class="odd-filter"
          type="search"
          placeholder="Filter"
          .value=${live(this.filter)}
          @input=${(e: Event) => { this.filter = (e.target as HTMLInputElement).value; this.requestUpdate(); }}
          @keydown=${(e: KeyboardEvent) => { if (e.key === "Enter") this.pickFirstMatch(); }}
        />
        <div class="spec-list">${this.specList(model)}</div>
      </aside>
      <div class="odd-main">
        <elementspec-panel
          .spec=${model.elementSpecs[this.selected]}
          .specIndex=${this.selected}
          .channel=${this.channel}
          .modelOpenState=${this.modelOpenState}
          .onDelete=${() => this.deleteSpec()}
        ></elementspec-panel>
      </div>
    `;
  }

  /** Display order only: entries keep their index in the document. */
  private visibleSpecs(model: OddModel) {
    const f = this.filter.trim().toLowerCase();
    return model.elementSpecs
      .map((spec, index) => ({ spec, index }))
      .filter(({ spec }) => !f || spec.ident.toLowerCase().includes(f))
      .sort((a, b) => (a.spec.ident || "").localeCompare(b.spec.ident || "", undefined, { sensitivity: "base" }));
  }

  private pickFirstMatch() {
    const first = this.model && this.visibleSpecs(this.model)[0];
    if (first) this.select(first.index);
  }

  private select(index: number) {
    this.flush();
    this.selected = index;
  }

  private specList(model: OddModel): TemplateResult[] {
    return this.visibleSpecs(model).map(({ spec, index }) => html`
      <button class="spec-item ${index === this.selected ? "active" : ""}" @click=${() => this.select(index)}>
        <span class="ident">${spec.ident || "(no ident)"}</span>
        ${spec.mode ? html`<span class="mode-badge ${spec.mode}">${spec.mode}</span>` : nothing}
      </button>`);
  }
}

/** The browser parser's complaint about malformed XML, if any. */
function wellFormednessError(text: string): string | undefined {
  const err = new DOMParser().parseFromString(text, "application/xml").querySelector("parsererror");
  if (!err) return undefined;
  const msg = (err.querySelector("div")?.textContent ?? err.textContent ?? "").trim();
  return msg.split("\n")[0].replace(/^This page contains the following errors:\s*/, "") || "Malformed XML";
}

function stripRange(spec: ElementSpec): ElementSpec {
  const { range, ...rest } = spec;
  void range;
  return rest;
}

customElements.define("odd-editor", OddEditor);
