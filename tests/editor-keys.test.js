const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveEditorKey, parseEditorKeys } = require('../lib/corrections/editor-keys');

const ENV = 'ben:sekrit1,alex:sekrit2';

test('resolveEditorKey: approved key resolves to the editor name', () => {
  const result = resolveEditorKey('sekrit1', ENV);
  assert.deepEqual(result, { name: 'ben' });
});

test('resolveEditorKey: a different approved key resolves to its own name', () => {
  const result = resolveEditorKey('sekrit2', ENV);
  assert.deepEqual(result, { name: 'alex' });
});

test('resolveEditorKey: unknown key resolves to null', () => {
  assert.equal(resolveEditorKey('not-a-real-key', ENV), null);
});

test('resolveEditorKey: absent header resolves to null', () => {
  assert.equal(resolveEditorKey(undefined, ENV), null);
  assert.equal(resolveEditorKey('', ENV), null);
  assert.equal(resolveEditorKey(null, ENV), null);
});

test('resolveEditorKey: unset EDITOR_KEYS env resolves everything to null', () => {
  assert.equal(resolveEditorKey('sekrit1', undefined), null);
  assert.equal(resolveEditorKey('sekrit1', ''), null);
});

test('resolveEditorKey: whitespace around the header value is trimmed', () => {
  assert.deepEqual(resolveEditorKey('  sekrit1  ', ENV), { name: 'ben' });
});

test('parseEditorKeys: tolerates malformed entries without throwing', () => {
  const map = parseEditorKeys('ben:sekrit1,, garbage ,alex:sekrit2,noSecret:');
  assert.equal(map.get('sekrit1'), 'ben');
  assert.equal(map.get('sekrit2'), 'alex');
  assert.equal(map.size, 2);
});
