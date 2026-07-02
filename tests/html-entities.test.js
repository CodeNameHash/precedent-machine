/* Tests for lib/html-entities.js — cp1252-aware numeric entity decoding.
   Run: npm test
   Guards the bug where SEC's &#147;/&#148; (Windows-1252 curly quotes that
   delimit every defined term) decoded to C1 control chars and were then
   stripped, making inline/parenthetical definitions unfindable. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { fromCp, decodeNumericEntities } = require('../lib/html-entities');

test('cp1252 curly quotes decode to real Unicode quotes, not C1 controls', () => {
  assert.equal(fromCp(147), '“'); // left double quote “
  assert.equal(fromCp(148), '”'); // right double quote ”
  assert.equal(fromCp(145), '‘'); // left single ‘
  assert.equal(fromCp(146), '’'); // right single ’
  assert.equal(fromCp(150), '–'); // en dash –
  assert.equal(fromCp(151), '—'); // em dash —
});

test('non-cp1252 code points decode normally', () => {
  assert.equal(fromCp(8220), '“'); // Unicode-form curly quote
  assert.equal(fromCp(38), '&');
  assert.equal(fromCp(160), ' '); // nbsp (>159, normal decode)
});

test('decodeNumericEntities recovers a defined-term delimiter from SEC markup', () => {
  // SEC-style: a defined term wrapped in &#147;...&#148;.
  const raw = 'the transactions (the &#147;Transactions&#148;) contemplated hereby';
  const out = decodeNumericEntities(raw);
  assert.equal(out, 'the transactions (the “Transactions”) contemplated hereby');
  // The quotes are now matchable by definition-detection regexes.
  assert.ok(/[“”]/.test(out));
});

test('decodeNumericEntities handles hex and decimal forms', () => {
  assert.equal(decodeNumericEntities('a&#x2014;b'), 'a—b'); // hex em dash
  assert.equal(decodeNumericEntities('a&#8212;b'), 'a—b'); // decimal em dash
});
