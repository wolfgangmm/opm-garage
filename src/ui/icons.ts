import { IMAGES } from '../config.ts';
import { extOf } from '../project/fs.ts';

const ICON: Record<string, string> = { xml: 'XML', odd: 'ODD', tei: 'XML', css: 'CSS', j2: 'J2', toml: 'TOML', py: 'PY', md: 'MD', json: 'JSON', svg: 'SVG' };

/** The short type tag shown before a file name in tabs and the tree. */
export const icon = (p: string) => IMAGES.has(extOf(p)) ? 'IMG' : ICON[extOf(p)] || '·';

export const DOWNLOAD = '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 2v9M4.5 7.5L8 11l3.5-3.5M2.5 14h11"/></svg>';
