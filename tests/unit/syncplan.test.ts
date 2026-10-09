import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hashBytes, planSync, settle, stampChanged, type Baseline } from '../../src/project/syncplan.ts';

const at = (hash: string, mtime = 1) => ({ hash, mtime, size: 1 });
const base: Baseline = { 'a.xml': at('A') };

test('nothing changed: nothing to do', () => {
  const p = planSync(base, { 'a.xml': at('A') }, { 'a.xml': 'A' });
  assert.deepEqual([p.pull, p.push, p.delLocal, p.delDisk, p.conflicts], [[], [], [], [], []]);
  assert.deepEqual(p.baseline, base);
});

test('changed or added on disk: pull', () => {
  const p = planSync(base, { 'a.xml': at('B', 2), 'n.css': at('N') }, { 'a.xml': 'A' });
  assert.deepEqual(p.pull.sort(), ['a.xml', 'n.css']);
  assert.deepEqual(p.baseline['a.xml'], at('B', 2));
});

test('changed or added in the browser: push', () => {
  const p = planSync(base, { 'a.xml': at('A') }, { 'a.xml': 'B', 'n.css': 'N' });
  assert.deepEqual(p.push.sort(), ['a.xml', 'n.css']);
  assert.equal(p.baseline['a.xml'], undefined);
});

test('deleted on one side: delete on the other', () => {
  assert.deepEqual(planSync(base, {}, { 'a.xml': 'A' }).delLocal, ['a.xml']);
  assert.deepEqual(planSync(base, { 'a.xml': at('A') }, {}).delDisk, ['a.xml']);
});

test('deleted on both sides: forgotten', () => {
  const p = planSync(base, {}, {});
  assert.deepEqual([p.delLocal, p.delDisk, p.conflicts, p.baseline], [[], [], [], {}]);
});

test('the same change on both sides is no conflict', () => {
  const p = planSync(base, { 'a.xml': at('B', 2) }, { 'a.xml': 'B' });
  assert.deepEqual([p.pull, p.push, p.conflicts], [[], [], []]);
  assert.deepEqual(p.baseline['a.xml'], at('B', 2));
});

test('different changes, or change against delete, are conflicts', () => {
  assert.deepEqual(planSync(base, { 'a.xml': at('B') }, { 'a.xml': 'C' }).conflicts, ['a.xml']);
  assert.deepEqual(planSync(base, { 'a.xml': at('B') }, {}).conflicts, ['a.xml']);
  assert.deepEqual(planSync(base, {}, { 'a.xml': 'C' }).conflicts, ['a.xml']);
  assert.deepEqual(planSync(base, {}, { 'a.xml': 'C' }).baseline, base);
});

test('linking with an empty baseline merges both sides', () => {
  const p = planSync({}, { 'disk.xml': at('D'), 'same.xml': at('S'), 'both.xml': at('X') }, { 'web.xml': 'W', 'same.xml': 'S', 'both.xml': 'Y' });
  assert.deepEqual([p.pull, p.push, p.conflicts], [['disk.xml'], ['web.xml'], ['both.xml']]);
  assert.deepEqual(Object.keys(p.baseline).sort(), ['disk.xml', 'same.xml']);
});

test('our own write is not read back: an unchanged stamp skips the file', () => {
  assert.ok(!stampChanged(at('A', 5), 5, 1));
  assert.ok(stampChanged(at('A', 5), 6, 1) && stampChanged(undefined, 5, 1));
});

test('hashes tell content apart', () => {
  const enc = new TextEncoder();
  assert.equal(hashBytes(enc.encode('<TEI/>')), hashBytes(enc.encode('<TEI/>')));
  assert.notEqual(hashBytes(enc.encode('<TEI/>')), hashBytes(enc.encode('<TEI />')));
});

test('a settled conflict copies the winner on the next sync', () => {
  const disk = { 'a.xml': at('B', 2) }, local = { 'a.xml': 'C' };
  const c = { path: 'a.xml', disk: disk['a.xml'], local: 'C' };
  assert.deepEqual(planSync(settle(base, c, 'local'), disk, local).push, ['a.xml']);
  assert.deepEqual(planSync(settle(base, c, 'disk'), disk, local).pull, ['a.xml']);
});

test('settling against a deletion deletes', () => {
  const gone = { path: 'a.xml', local: 'C' }; // deleted on disk, changed here
  assert.deepEqual(planSync(settle(base, gone, 'disk'), {}, { 'a.xml': 'C' }).delLocal, ['a.xml']);
  assert.deepEqual(planSync(settle(base, gone, 'local'), {}, { 'a.xml': 'C' }).push, ['a.xml']);
  const kept = { path: 'a.xml', disk: at('B', 2) }; // changed on disk, deleted here
  assert.deepEqual(planSync(settle(base, kept, 'local'), { 'a.xml': at('B', 2) }, {}).delDisk, ['a.xml']);
  assert.deepEqual(planSync(settle(base, kept, 'disk'), { 'a.xml': at('B', 2) }, {}).pull, ['a.xml']);
});
