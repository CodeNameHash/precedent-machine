const test = require('node:test');
const assert = require('node:assert/strict');

const { safeNextPath } = require('../lib/auth/safe-next-path');

test('a normal app-relative path is preserved', () => {
  assert.equal(safeNextPath('/review/abc-123'), '/review/abc-123');
  assert.equal(safeNextPath('/'), '/');
  assert.equal(safeNextPath('/query/whats-market/adhoc?x=1'), '/query/whats-market/adhoc?x=1');
});

test('absolute URLs to another host are rejected (would be an open redirect)', () => {
  assert.equal(safeNextPath('https://evil.com/steal'), '/');
  assert.equal(safeNextPath('http://evil.com'), '/');
});

test('scheme-relative "//host" paths are rejected — the classic startsWith("/") bypass', () => {
  assert.equal(safeNextPath('//evil.com'), '/');
  assert.equal(safeNextPath('//evil.com/looks/legit'), '/');
});

test('backslash-based scheme-relative paths are rejected (some browsers treat \\ like /)', () => {
  assert.equal(safeNextPath('/\\evil.com'), '/');
});

test('non-string, empty, or missing input falls back to /', () => {
  assert.equal(safeNextPath(undefined), '/');
  assert.equal(safeNextPath(null), '/');
  assert.equal(safeNextPath(''), '/');
  assert.equal(safeNextPath(42), '/');
  assert.equal(safeNextPath(['/x']), '/'); // router.query can hand back an array
});

test('a path not starting with / is rejected', () => {
  assert.equal(safeNextPath('review/abc'), '/');
  assert.equal(safeNextPath('javascript:alert(1)'), '/');
});
