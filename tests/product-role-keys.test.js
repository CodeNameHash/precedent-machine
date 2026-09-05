'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { canonicalRoleKeys } = require('../lib/product/role-keys');

test('maps unique ASCII case variants and preserves values', () => {
  const value = { nested: true }; const input = { legal_actor_or_subject: value, exact: 'x', 'not-a-role': 2 };
  const result = canonicalRoleKeys(input, ['LEGAL_ACTOR_OR_SUBJECT', 'EXACT']);
  assert.deepEqual(result.roles, { LEGAL_ACTOR_OR_SUBJECT: value, EXACT: 'x', 'not-a-role': 2 });
  assert.deepEqual(input, { legal_actor_or_subject: value, exact: 'x', 'not-a-role': 2 });
  assert.deepEqual(result.collisions, []);
});

test('preserves unknown and ambiguous schema keys', () => {
  assert.deepEqual(canonicalRoleKeys({ Legal_Actor: 'v' }, ['LEGAL_ACTOR']).roles, { LEGAL_ACTOR: 'v' });
  const result = canonicalRoleKeys({ role: 'v' }, ['ROLE', 'role']);
  assert.deepEqual(result.roles, { role: 'v' });
  assert.equal(result.collisions.length, 1);
});

test('preserves colliding supplied keys and reports collision', () => {
  const result = canonicalRoleKeys({ ROLE: 'a', role: 'b' }, ['ROLE']);
  assert.deepEqual(result.roles, { ROLE: 'a', role: 'b' });
  assert.deepEqual(result.collisions, [{ target: ['ROLE'], keys: ['ROLE', 'role'] }]);
});

test('preserves two-way collisions in either order and three-way collisions', () => {
  for (const input of [{ legal_operation: 'first', LEGAL_OPERATION: 'second' }, { LEGAL_OPERATION: 'second', legal_operation: 'first' }, { legal_operation: 'a', LEGAL_OPERATION: 'b', LeGaL_OpErAtIoN: 'c' }]) {
    const result = canonicalRoleKeys(input, ['LEGAL_OPERATION']);
    assert.deepEqual(result.roles, input);
    assert.equal(result.collisions[0].keys.length, Object.keys(input).length);
  }
});

test('does not fold punctuation, non-ASCII, or mutate input', () => {
  const input = { 'ROLE-NAME': 'a', rôle: 'b' }; const before = JSON.stringify(input);
  const result = canonicalRoleKeys(input, ['ROLE_NAME', 'ROLE']);
  assert.deepEqual(result.roles, input); assert.equal(JSON.stringify(input), before);
});

test('preserves __proto__ as an own unknown key', () => {
  const result = canonicalRoleKeys(JSON.parse('{"__proto__":"safe"}'), ['ROLE']);
  assert.equal(Object.prototype.hasOwnProperty.call(result.roles, '__proto__'), true);
  assert.equal(result.roles.__proto__, 'safe');
});
