const test = require('node:test');
const assert = require('node:assert/strict');

const { createSessionToken, verifySessionToken, DEFAULT_TTL_SECONDS } = require('../lib/auth/session');

const SECRET = 'test-session-secret-please-do-not-use-in-prod';

test('sign then verify round-trips the subject and succeeds', async () => {
  const token = await createSessionToken({ sub: 'ben', secret: SECRET });
  const result = await verifySessionToken(token, { secret: SECRET });
  assert.equal(result.valid, true);
  assert.equal(result.claims.sub, 'ben');
  assert.equal(typeof result.claims.iat, 'number');
  assert.equal(typeof result.claims.exp, 'number');
});

test('token has exactly two dot-separated parts (payload.signature, no alg header)', async () => {
  const token = await createSessionToken({ sub: 'ben', secret: SECRET });
  assert.equal(token.split('.').length, 2);
});

test('wrong secret fails verification', async () => {
  const token = await createSessionToken({ sub: 'ben', secret: SECRET });
  const result = await verifySessionToken(token, { secret: 'a-different-secret' });
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'bad-signature');
});

test('tampering with the payload invalidates the signature', async () => {
  const token = await createSessionToken({ sub: 'ben', secret: SECRET });
  const [payloadB64, sigB64] = token.split('.');
  // Flip the payload to claim a different subject, keeping the original signature.
  const forgedPayload = Buffer.from(JSON.stringify({ sub: 'attacker', iat: Date.now(), exp: Date.now() + 999999 }))
    .toString('base64url');
  const forged = `${forgedPayload}.${sigB64}`;
  const result = await verifySessionToken(forged, { secret: SECRET });
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'bad-signature');
  void payloadB64;
});

test('tampering with the signature invalidates the token', async () => {
  const token = await createSessionToken({ sub: 'ben', secret: SECRET });
  const [payloadB64, sigB64] = token.split('.');
  const flippedChar = sigB64[0] === 'A' ? 'B' : 'A';
  const forged = `${payloadB64}.${flippedChar}${sigB64.slice(1)}`;
  const result = await verifySessionToken(forged, { secret: SECRET });
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'bad-signature');
});

test('expired token is refused even with a correct signature', async () => {
  const issuedAt = 1_000_000;
  const token = await createSessionToken({ sub: 'ben', secret: SECRET, ttlSeconds: 60, now: issuedAt });
  const justBeforeExpiry = await verifySessionToken(token, { secret: SECRET, now: issuedAt + 59_000 });
  assert.equal(justBeforeExpiry.valid, true);
  const afterExpiry = await verifySessionToken(token, { secret: SECRET, now: issuedAt + 60_000 });
  assert.equal(afterExpiry.valid, false);
  assert.equal(afterExpiry.reason, 'expired');
});

test('malformed tokens (wrong shape) are refused, not thrown', async () => {
  for (const bad of ['', 'not-a-token', 'one.two.three', '.', 'onlyonepart']) {
    // eslint-disable-next-line no-await-in-loop
    const result = await verifySessionToken(bad, { secret: SECRET });
    assert.equal(result.valid, false, `expected ${JSON.stringify(bad)} to be invalid`);
  }
});

test('missing token is refused with reason "missing"', async () => {
  assert.equal((await verifySessionToken(null, { secret: SECRET })).reason, 'missing');
  assert.equal((await verifySessionToken(undefined, { secret: SECRET })).reason, 'missing');
  assert.equal((await verifySessionToken('', { secret: SECRET })).reason, 'missing');
});

test('missing secret fails closed with reason "not-configured", not an open pass', async () => {
  const token = await createSessionToken({ sub: 'ben', secret: SECRET });
  const result = await verifySessionToken(token, { secret: '' });
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'not-configured');
});

test('createSessionToken requires a secret and a sub', async () => {
  await assert.rejects(() => createSessionToken({ sub: 'ben', secret: '' }));
  await assert.rejects(() => createSessionToken({ sub: '', secret: SECRET }));
});

test('default TTL is one week', () => {
  assert.equal(DEFAULT_TTL_SECONDS, 7 * 24 * 60 * 60);
});

test('two tokens signed at the same instant for the same subject are byte-identical (deterministic HMAC)', async () => {
  const now = 5_000_000;
  const a = await createSessionToken({ sub: 'ben', secret: SECRET, now });
  const b = await createSessionToken({ sub: 'ben', secret: SECRET, now });
  assert.equal(a, b);
});
