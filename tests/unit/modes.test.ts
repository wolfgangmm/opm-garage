import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { MODES } from '../../src/config.ts';

// The mode buttons are written out in index.html; the code knows the modes from MODES.
test('index.html has one described button per output mode, in order', () => {
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  const bar = html.match(/<div class="seg" id="modes">([\s\S]*?)<\/div>/)?.[1] ?? '';
  const buttons = [...bar.matchAll(/<button\b([^>]*)>/g)].map(m => m[1]);
  assert.deepEqual(buttons.map(a => a.match(/data-mode="([^"]*)"/)?.[1]), [...MODES]);
  for (const a of buttons) assert.match(a, /data-tip="[^"]+"/, 'every mode button needs a data-tip');
});
