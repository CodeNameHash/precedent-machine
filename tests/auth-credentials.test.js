const test = require('node:test');
const assert = require('node:assert/strict');

const { verifyCredentials, constantTimeEqual, DEFAULT_USERNAME } = require('../lib/auth/credentials');

test('DEFAULT_USERNAME is ben', () => {
  assert.equal(DEFAULT_USERNAME, 'ben');
});

test('correct password with default username succeeds', () => {
  const result = verifyCredentials(
    { username: 'ben', password: 'correct-horse-battery-staple' },
    { AUTH_PASSWORD: 'correct-horse-battery-staple' },
  );
  assert.equal(result.ok, true);
  assert.equal(result.sub, 'ben');
});

test('correct password with a configured custom username succeeds', () => {
  const result = verifyCredentials(
    { username: 'alice', password: 'hunter2' },
    { AUTH_USERNAME: 'alice', AUTH_PASSWORD: 'hunter2' },
  );
  assert.equal(result.ok, true);
  assert.equal(result.sub, 'alice');
});

test('wrong password fails with reason invalid', () => {
  const result = verifyCredentials(
    { username: 'ben', password: 'wrong' },
    { AUTH_PASSWORD: 'correct-horse-battery-staple' },
  );
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'invalid');
});

test('wrong username fails even with the right password', () => {
  const result = verifyCredentials(
    { username: 'not-ben', password: 'correct-horse-battery-staple' },
    { AUTH_PASSWORD: 'correct-horse-battery-staple' },
  );
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'invalid');
});

test('AUTH_PASSWORD unset fails closed with reason not-configured, not a silent pass', () => {
  const result = verifyCredentials({ username: 'ben', password: 'anything' }, {});
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'not-configured');
});

test('empty AUTH_PASSWORD env is treated as unset (fail closed)', () => {
  const result = verifyCredentials({ username: 'ben', password: '' }, { AUTH_PASSWORD: '' });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'not-configured');
});

test('constantTimeEqual: equal strings match', () => {
  assert.equal(constantTimeEqual('abc123', 'abc123'), true);
});

test('constantTimeEqual: different content or length does not match', () => {
  assert.equal(constantTimeEqual('abc123', 'abc1234'), false);
  assert.equal(constantTimeEqual('abc123', 'abc124'), false);
  assert.equal(constantTimeEqual('', ''), true);
  assert.equal(constantTimeEqual(null, undefined), true);
  assert.equal(constantTimeEqual(null, 'x'), false);
});
