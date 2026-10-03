import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { formatOdd } from '../../src/odd/oddFormat.ts';

const squash = (s: string) => s.replace(/>\s+</g, '><');
/** Prose and example content, which must survive formatting byte for byte. */
const opaque = (s: string) => s.match(/<(desc|egXML|outputRendition|p|gloss|param)\b[^>]*>[\s\S]*?<\/\1>/g) ?? [];

const MESSY = `<?xml version="1.0"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body>
<p>Prose with <hi>inline</hi><hi>content</hi> that <gi>stays</gi>.</p>
<egXML xmlns="http://www.tei-c.org/ns/Examples"><schemaSpec><elementSpec ident="x"><model/></elementSpec></schemaSpec></egXML>
      <schemaSpec ident="a"   source="b">
 <!-- keep -->
   <elementSpec ident="p" mode="change"><desc>One <hi>two</hi><hi>three</hi></desc>
<model behaviour="paragraph"><param name="a" value="b > c"/>   <outputRendition>
  x { color: red }
</outputRendition></model>


<model behaviour="block"/> <!-- trailing -->
</elementSpec>
</schemaSpec></body></text></TEI>
`;

test('only whitespace between schema elements changes', () => {
  const out = formatOdd(MESSY);
  assert.notEqual(out, MESSY);
  assert.equal(squash(out), squash(MESSY));
  assert.deepEqual(opaque(out), opaque(MESSY));
  assert.ok(out.includes('<p>Prose with <hi>inline</hi><hi>content</hi> that <gi>stays</gi>.</p>'));
  assert.ok(out.includes('<egXML xmlns="http://www.tei-c.org/ns/Examples"><schemaSpec><elementSpec ident="x"><model/></elementSpec></schemaSpec></egXML>'));
});

test('formatting is idempotent and keeps blank lines and trailing comments', () => {
  const out = formatOdd(MESSY);
  assert.equal(formatOdd(out), out);
  assert.match(out, /<model behaviour="paragraph">\n {12}<param name="a" value="b > c"\/>\n/);
  assert.match(out, /<\/model>\n\n {10}<model behaviour="block"\/> <!-- trailing -->\n/);
});

test('mixed content and malformed input are left alone', () => {
  const mixed = '<TEI><schemaSpec>text<elementSpec ident="p"/></schemaSpec></TEI>';
  assert.equal(formatOdd(mixed), mixed);
  assert.equal(formatOdd('<TEI><schemaSpec>'), '<TEI><schemaSpec>');
});

for (const f of ['teipublisher', 'jats', 'docbook', 'tagdocs']) {
  test(`${f}.odd formats safely`, () => {
    const src = readFileSync(`../tei-publisher-py/src/opm/resources/odd/${f}.odd`, 'utf8');
    const out = formatOdd(src);
    assert.equal(squash(out), squash(src));
    assert.deepEqual(opaque(out), opaque(src));
    assert.equal(formatOdd(out), out);
  });
}

test('a minified ODD is laid out relative to its line', () => {
  const src = '<TEI xmlns="http://www.tei-c.org/ns/1.0"><text><body><schemaSpec ident="a"><elementSpec ident="p" mode="change"><model behaviour="paragraph"><param name="x" value="y"/></model></elementSpec></schemaSpec></body></text></TEI>';
  const out = formatOdd(src);
  assert.equal(out, [
    '<TEI xmlns="http://www.tei-c.org/ns/1.0">',
    '  <text>',
    '    <body>',
    '      <schemaSpec ident="a">',
    '        <elementSpec ident="p" mode="change">',
    '          <model behaviour="paragraph">',
    '            <param name="x" value="y"/>',
    '          </model>',
    '        </elementSpec>',
    '      </schemaSpec>',
    '    </body>',
    '  </text>',
    '</TEI>',
  ].join('\n'));
  assert.equal(formatOdd(out), out);
});
