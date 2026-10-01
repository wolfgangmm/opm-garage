import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readToml, setToml, tomlString, unsetToml } from '../../src/project/toml.ts';

const TOML = `# comment
[transform]
odd = "odd/custom.odd"
pythonpath = ["."]

[transform.web]
template = "templates/chapbook.html.j2"
`;

test('readToml reads strings and string arrays, skipping the rest', () => {
  const cfg = readToml(TOML + 'depth = 2\n');
  assert.equal(tomlString(cfg, 'transform', 'odd'), 'odd/custom.odd');
  assert.deepEqual(cfg.transform.pythonpath, ['.']);
  assert.equal(tomlString(cfg, 'transform.web', 'template'), 'templates/chapbook.html.j2');
  assert.equal(cfg['transform.web'].depth, undefined);
  assert.equal(tomlString(cfg, 'transform.print', 'template'), '');
});

test('setToml replaces a key in place and keeps the rest of the file', () => {
  const out = setToml(TOML, 'transform.web', 'template', 'templates/journal.html.j2');
  assert.equal(out, TOML.replace('chapbook', 'journal'));
});

test('setToml adds a key to an existing section, or a new section', () => {
  assert.match(setToml(TOML, 'transform', 'css', 'a.css'), /\[transform\]\ncss = "a.css"\nodd/);
  assert.equal(setToml('', 'transform', 'odd', 'x.odd'), '[transform]\nodd = "x.odd"\n');
  assert.ok(setToml(TOML, 'transform.print', 'template', 'p.j2').endsWith('\n\n[transform.print]\ntemplate = "p.j2"\n'));
});

test('unsetToml removes only the key in the named section', () => {
  const out = unsetToml(TOML, 'transform.web', 'template');
  assert.equal(tomlString(readToml(out), 'transform.web', 'template'), '');
  assert.equal(tomlString(readToml(out), 'transform', 'odd'), 'odd/custom.odd');
  assert.equal(unsetToml(TOML, 'nope', 'template'), TOML);
});
