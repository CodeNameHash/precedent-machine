const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DIGEST_FRAME,
  SIGNATURE_FRAME,
  canonicalBytes,
  canonicalDigest,
  domainDigest,
  signatureBytes,
} = require('../lib/programme-gates/bytes');

test('programme-gate canonical bytes reuse the canonical-v2 JSON contract', () => {
  const first = { z: [3, 2, 1], a: { y: true, x: '£' } };
  const second = { a: { x: '£', y: true }, z: [3, 2, 1] };

  assert.deepEqual(canonicalBytes(first), canonicalBytes(second));
  assert.equal(canonicalBytes(first).toString('utf8'), '{"a":{"x":"£","y":true},"z":[3,2,1]}');
  assert.match(canonicalDigest(first), /^[a-f0-9]{64}$/);
  assert.equal(canonicalDigest(first), canonicalDigest(second));
});

test('artefact identities are domain separated', () => {
  const payload = { gate_id: 'G0_MARKET_STATS_CONTAINED' };
  const evidence = domainDigest('PROGRAMME_GATE_EVIDENCE/V2', payload);
  const subject = domainDigest('PROGRAMME_GATE_EVIDENCE_SUBJECT/V1', payload);

  assert.match(evidence, /^[a-f0-9]{64}$/);
  assert.notEqual(evidence, subject);
  assert.notEqual(evidence, canonicalDigest(payload));
  assert.ok(DIGEST_FRAME.startsWith('PROGRAMME_GATE_DIGEST/'));
  assert.throws(
    () => domainDigest('free form', payload),
    /closed uppercase programme-gate token/,
  );
});

test('signature bytes bind a closed domain and role without ambiguous framing', () => {
  const payload = { gate_id: 'G0_MARKET_STATS_CONTAINED', state: 'PASS' };
  const evidence = signatureBytes({
    domain: 'PROGRAMME_GATE_EVIDENCE/V2',
    role: 'VALIDATOR',
    payload,
  });
  const status = signatureBytes({
    domain: 'PROGRAMME_GATE_STATUS/V2',
    role: 'VALIDATOR',
    payload,
  });
  const controller = signatureBytes({
    domain: 'PROGRAMME_GATE_EVIDENCE/V2',
    role: 'REVIEW_CONTROLLER',
    payload,
  });

  assert.ok(evidence.subarray(0, SIGNATURE_FRAME.length).equals(Buffer.from(SIGNATURE_FRAME)));
  assert.notDeepEqual(evidence, status);
  assert.notDeepEqual(evidence, controller);
  assert.deepEqual(evidence, signatureBytes({
    role: 'VALIDATOR',
    payload: { state: 'PASS', gate_id: 'G0_MARKET_STATS_CONTAINED' },
    domain: 'PROGRAMME_GATE_EVIDENCE/V2',
  }));
});

test('canonical and signature byte builders reject unsupported or open-ended inputs', () => {
  assert.throws(() => canonicalBytes({ value: undefined }), /does not support undefined/);
  assert.throws(() => canonicalBytes({ value: Number.POSITIVE_INFINITY }), /finite numbers/);
  assert.throws(
    () => signatureBytes({ domain: 'free form', role: 'VALIDATOR', payload: {} }),
    /closed uppercase programme-gate token/,
  );
  assert.throws(
    () => signatureBytes({ domain: 'PROGRAMME_GATE_STATUS/V2', role: 'validator', payload: {} }),
    /closed uppercase programme-gate token/,
  );
});
