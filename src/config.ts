export const PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/';
export const WHEEL = 'open_processing_model-0.9.0-py3-none-any.whl';
export const MARKED = 'https://cdn.jsdelivr.net/npm/marked@15/lib/marked.esm.js';
export const MARKED_FOOTNOTE = 'https://cdn.jsdelivr.net/npm/marked-footnote@1/dist/index.js';
export const TYPST = 'https://cdn.jsdelivr.net/npm/@myriaddreamin/';

export const MODES = ['web', 'print', 'epub', 'markdown', 'docx', 'typst', 'json', 'chunk'] as const;
export type Mode = typeof MODES[number];
export const isMode = (m: unknown): m is Mode => MODES.includes(m as Mode);

/** File extension of each mode's output. */
export const EXT: Record<Mode, string> = { web: 'html', print: 'html', epub: 'epub', markdown: 'md', docx: 'docx', typst: 'typ', json: 'json', chunk: 'zip' };
/** What each mode produces, shown in a popover over its button. */
export const MODE_INFO: Record<Mode, [title: string, text: string]> = {
  web: ['HTML page', 'One HTML page for the browser, built from the web template and styled with the ODD\'s CSS.'],
  print: ['HTML for print', 'HTML laid out for paged-media CSS: page size, running heads and page breaks, ready for printing to PDF.'],
  epub: ['EPUB e-book', 'An EPUB 3 e-book for readers such as Apple Books or Calibre. Download only.'],
  markdown: ['Markdown', 'Plain Markdown text, previewed as rendered HTML.'],
  docx: ['Word document', 'A .docx file for Word or LibreOffice, based on the project\'s Word template if it has one. Download only.'],
  typst: ['Typst → PDF', 'Typst markup, compiled to PDF in the browser for the preview.'],
  json: ['Processing log', 'Not a rendering: records which ODD model and behaviour handled each element, and what text it produced.'],
  chunk: ['Chunked site', 'Splits the document into a sequence of linked HTML pages, as configured under [chunking] in opm.toml. Preview the site here, or download it as a zip.'],
};
/** Modes with a rendered view beside the code view. */
export const PREVIEW = new Set<Mode>(['web', 'print', 'markdown', 'typst']);
/** Modes that take a template, and which kind. */
export const TEMPLATE_KIND: Partial<Record<Mode, 'html' | 'typ'>> = { web: 'html', print: 'html', typst: 'typ' };

/** Never listed in the explorer. */
export const HIDDEN = new Set(['chunks', '__pycache__', '.git', '.DS_Store', 'node_modules']);
export const IMAGES = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'bmp']);
