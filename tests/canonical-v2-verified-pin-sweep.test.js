// tests/canonical-v2-verified-pin-sweep.test.js
//
// Plan Task 5 / spec section 5's SOURCE_SUPERSEDED executor: "the pin sweep
// re-admits a fixture source with changed canonical text and every pinned
// VERIFIED answer routes SOURCE_SUPERSEDED; unchanged hashes pass through
// untouched; answers without pins are typed residuals, never silently
// passed."

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  sweepVerifiedPins,
  SOURCE_SUPERSEDED_REASON,
  PIN_SWEEP_RESULT_SCHEMA,
} = require('../lib/canonical-v2/verified-pin-sweep');
const { buildVerifiedAnswerProvenance } = require('../lib/canonical-v2/native-producer/candidate-resolution');

const ORIGINAL_HASH = 'a'.repeat(64);
const CHANGED_HASH = 'b'.repeat(64);
const EXCERPT_ID = 'c'.repeat(64);

function verifiedAnswer(answerId, { canonicalTextHash = ORIGINAL_HASH } = {}) {
  return {
    answer_id: answerId,
    canonical_value: 'MAT_ALL_RESPECTS',
    answer_provenance: buildVerifiedAnswerProvenance({
      reviewer: 'ben@precedentmachine',
      verified_at: '2026-08-01T00:00:00.000Z',
      canonical_text_hash: canonicalTextHash,
      evidence_excerpt_id: EXCERPT_ID,
    }),
  };
}

test('SOURCE_SUPERSEDED_REASON and PIN_SWEEP_RESULT_SCHEMA are stable typed constants', () => {
  assert.equal(SOURCE_SUPERSEDED_REASON, 'SOURCE_SUPERSEDED');
  assert.equal(PIN_SWEEP_RESULT_SCHEMA, 'VERIFIED_PIN_SWEEP_RESULT/V1');
});

test('a source re-admitted with changed canonical text routes every pinned VERIFIED answer to SOURCE_SUPERSEDED', () => {
  const storedVerifiedAnswers = [
    verifiedAnswer('answer-1'),
    verifiedAnswer('answer-2'),
  ];
  const result = sweepVerifiedPins({
    stored_verified_answers: storedVerifiedAnswers,
    readmitted_source_context: { canonical_text_hash: CHANGED_HASH },
  });

  assert.equal(result.schema_version, PIN_SWEEP_RESULT_SCHEMA);
  assert.equal(result.routed.length, 2);
  assert.equal(result.unaffected.length, 0);
  assert.equal(result.residuals.length, 0);
  for (const routedEntry of result.routed) {
    assert.equal(routedEntry.reason, 'SOURCE_SUPERSEDED');
    assert.equal(routedEntry.pinned_canonical_text_hash, ORIGINAL_HASH);
    assert.equal(routedEntry.readmitted_canonical_text_hash, CHANGED_HASH);
    assert.equal(routedEntry.evidence_excerpt_id, EXCERPT_ID);
  }
  assert.deepEqual(result.routed.map((entry) => entry.answer_id).sort(), ['answer-1', 'answer-2']);
  assert.equal(result.counts.total, 2);
  assert.equal(result.counts.routed, 2);
});

test('a source re-admitted with the SAME canonical text hash leaves every pinned VERIFIED answer unaffected', () => {
  const storedVerifiedAnswers = [verifiedAnswer('answer-1'), verifiedAnswer('answer-2')];
  const result = sweepVerifiedPins({
    stored_verified_answers: storedVerifiedAnswers,
    readmitted_source_context: { canonical_text_hash: ORIGINAL_HASH },
  });

  assert.equal(result.routed.length, 0);
  assert.equal(result.unaffected.length, 2);
  assert.equal(result.residuals.length, 0);
  assert.deepEqual(result.unaffected, storedVerifiedAnswers);
});

test('a mixed sweep only routes the answers whose pin actually mismatches', () => {
  const unchanged = verifiedAnswer('unchanged', { canonicalTextHash: CHANGED_HASH });
  const stale = verifiedAnswer('stale', { canonicalTextHash: ORIGINAL_HASH });
  const result = sweepVerifiedPins({
    stored_verified_answers: [unchanged, stale],
    readmitted_source_context: { canonical_text_hash: CHANGED_HASH },
  });

  assert.equal(result.unaffected.length, 1);
  assert.equal(result.unaffected[0].answer_id, 'unchanged');
  assert.equal(result.routed.length, 1);
  assert.equal(result.routed[0].answer_id, 'stale');
});

test('an answer without a VERIFIED tag is a typed PIN_SWEEP_NOT_VERIFIED residual, never silently passed', () => {
  const mechanicalAnswer = {
    answer_id: 'mechanical-1',
    answer_provenance: { tag: 'MECHANICAL', pins: { mapping_table_version: 3 } },
  };
  const noProvenanceAnswer = { answer_id: 'bare-1' };

  const result = sweepVerifiedPins({
    stored_verified_answers: [mechanicalAnswer, noProvenanceAnswer],
    readmitted_source_context: { canonical_text_hash: CHANGED_HASH },
  });

  assert.equal(result.routed.length, 0);
  assert.equal(result.unaffected.length, 0);
  assert.equal(result.residuals.length, 2);
  assert.ok(result.residuals.every((residual) => residual.residual_type === 'PIN_SWEEP_NOT_VERIFIED'));
  assert.deepEqual(result.residuals.map((residual) => residual.answer_id).sort(), ['bare-1', 'mechanical-1']);
});

test('a VERIFIED answer with no pinned canonical_text_hash/evidence_excerpt_id is a typed PIN_SWEEP_MISSING_PIN residual', () => {
  const missingHash = {
    answer_id: 'missing-hash',
    answer_provenance: { tag: 'VERIFIED', pins: { reviewer: 'ben', verified_at: '2026-08-01', evidence_excerpt_id: EXCERPT_ID } },
  };
  const missingExcerpt = {
    answer_id: 'missing-excerpt',
    answer_provenance: { tag: 'VERIFIED', pins: { reviewer: 'ben', verified_at: '2026-08-01', canonical_text_hash: ORIGINAL_HASH } },
  };
  const noPinsAtAll = {
    answer_id: 'no-pins',
    answer_provenance: { tag: 'VERIFIED', pins: {} },
  };

  const result = sweepVerifiedPins({
    stored_verified_answers: [missingHash, missingExcerpt, noPinsAtAll],
    readmitted_source_context: { canonical_text_hash: CHANGED_HASH },
  });

  assert.equal(result.routed.length, 0);
  assert.equal(result.unaffected.length, 0);
  assert.equal(result.residuals.length, 3);
  assert.ok(result.residuals.every((residual) => residual.residual_type === 'PIN_SWEEP_MISSING_PIN'));
});

test('sweepVerifiedPins is a pure function: identical inputs produce a deep-equal result, no mutation of the input array', () => {
  const storedVerifiedAnswers = Object.freeze([verifiedAnswer('answer-1'), verifiedAnswer('answer-2')]);
  const before = JSON.parse(JSON.stringify(storedVerifiedAnswers));

  const first = sweepVerifiedPins({
    stored_verified_answers: storedVerifiedAnswers,
    readmitted_source_context: { canonical_text_hash: CHANGED_HASH },
  });
  const second = sweepVerifiedPins({
    stored_verified_answers: storedVerifiedAnswers,
    readmitted_source_context: { canonical_text_hash: CHANGED_HASH },
  });

  assert.deepEqual(JSON.parse(JSON.stringify(storedVerifiedAnswers)), before, 'input array is never mutated');
  assert.deepEqual(
    first.routed.map((entry) => entry.answer_id),
    second.routed.map((entry) => entry.answer_id),
  );
  assert.equal(first.counts.routed, second.counts.routed);
});

test('sweepVerifiedPins fails closed on invalid inputs rather than silently sweeping nothing', () => {
  assert.throws(() => sweepVerifiedPins({
    stored_verified_answers: 'not-an-array',
    readmitted_source_context: { canonical_text_hash: CHANGED_HASH },
  }), TypeError);
  assert.throws(() => sweepVerifiedPins({
    stored_verified_answers: [],
    readmitted_source_context: {},
  }), TypeError);
  assert.throws(() => sweepVerifiedPins({
    stored_verified_answers: [],
  }), TypeError);
});
