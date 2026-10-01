import assert from 'node:assert/strict';
import { test } from 'node:test';
import { zipSync, strToU8 } from 'fflate';
import { fromZip, isText, toZip } from '../../src/project/zip.ts';

test('a project round-trips through a zip, text as text and binaries as bytes', () => {
  const files = { 'opm.toml': '[transform]\n', 'data/a.xml': '<TEI/>', 'templates/default.docx': new Uint8Array([1, 2, 3]) };
  assert.deepEqual(fromZip(toZip(files)), files);
});

test('a zip of a folder loses its common top directory', () => {
  const zip = zipSync({ 'proj/opm.toml': strToU8('x'), 'proj/data/a.xml': strToU8('<a/>') });
  assert.deepEqual(Object.keys(fromZip(zip)).sort(), ['data/a.xml', 'opm.toml']);
});

test('macOS leftovers are skipped', () => {
  const zip = zipSync({ 'opm.toml': strToU8('x'), '__MACOSX/._opm.toml': strToU8('x'), '.DS_Store': strToU8('x') });
  assert.deepEqual(Object.keys(fromZip(zip)), ['opm.toml']);
});

test('isText knows the project file types', () => {
  assert.ok(isText('odd/custom.odd') && isText('templates/chapbook.html.j2') && isText('opm.toml'));
  assert.ok(!isText('templates/default.docx') && !isText('img/logo.png'));
});
