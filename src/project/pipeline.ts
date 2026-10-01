// What a file does in the pipeline, as opm.toml wires it up.
import { TEMPLATE_KIND } from '../config.ts';
import { state } from '../state.ts';
import { config, dirOf, exists, normPath, readText } from './fs.ts';
import { tomlString } from './toml.ts';

export interface Pipeline { source: string; odd: string; css: string; template: string }

export function pipelineFiles(): Pipeline {
  const cfg = config(), sec = 'transform.' + state.mode;
  const odd = tomlString(cfg, 'transform', 'odd');
  let css = '';
  if (odd && exists(odd)) {
    // the ODD names its stylesheet in a <rendition source="…">
    const ref = readText(odd).match(/<rendition[^>]*\ssource="([^"]+\.css)"/)?.[1];
    if (ref) css = normPath(dirOf(odd) + ref);
  }
  if (!css) css = tomlString(cfg, sec, 'css') || tomlString(cfg, 'transform', 'css');
  const template = TEMPLATE_KIND[state.mode] ? tomlString(cfg, sec, 'template') : '';
  return { source: state.xml, odd, css, template };
}

export function roleOf(p: string, f = pipelineFiles()): string {
  return p === f.source ? 'Source document' : p === f.odd ? 'ODD' : p === f.css ? 'ODD stylesheet'
    : p === f.template ? 'Template · ' + state.mode : p === 'opm.toml' ? 'Project config' : '';
}
