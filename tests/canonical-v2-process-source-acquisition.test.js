const assert = require('node:assert/strict');
const test = require('node:test');

const { contentId, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const {
  PROCESS_SOURCE_ACQUISITION_INPUT_SCHEMA,
  acquireProcessSources: acquireSources,
  validateProcessSourceAcquisitionReceipt,
} = require('../lib/canonical-v2/process-source-acquisition');

function digest(label) {
  return contentId('SYNTHETIC_PROCESS_SOURCE_ACQUISITION_TEST/V1', { label });
}

function source(sourceId, overrides = {}) {
  const sourceText = `Synthetic source ${sourceId}.`;
  return {
    source_id: sourceId,
    source_class: 'FILING',
    frozen_snapshot_id: digest(`${sourceId}:snapshot`),
    source_text_digest: sha256Hex(Buffer.from(sourceText, 'utf8')),
    source_identity: {
      source_document_identity: digest(`${sourceId}:document`),
      source_revision_id: digest(`${sourceId}:revision`),
      document_hash: digest(`${sourceId}:hash`),
    },
    evidence_history: [{
      evidence_id: digest(`${sourceId}:evidence`),
      evidence_digest: digest(`${sourceId}:evidence-digest`),
    }],
    intake_outcome: 'VERIFIED_INTAKE_RECEIPT',
    attempts_used: 1,
    ...overrides,
  };
}

function sourceBytesForInput(value) {
  return new Map(value.frozen_sources.map((frozenSource) => [
    frozenSource.source_identity.source_document_identity,
    Buffer.from(`Synthetic source ${frozenSource.source_id}.`, 'utf8'),
  ]));
}

function acquireProcessSources(value, sourceBytesByIdentity = sourceBytesForInput(value)) {
  return acquireSources(value, sourceBytesByIdentity);
}

function input(overrides = {}) {
  return {
    schema_version: PROCESS_SOURCE_ACQUISITION_INPUT_SCHEMA,
    governed_scope: {
      scope_id: 'METSA_SYNTHETIC_PROCESS_SCOPE',
      scope_digest: digest('scope'),
      manifest_id: digest('manifest'),
      expected_source_ids: ['SOURCE_A', 'SOURCE_B'],
      coverage_limit: {
        coverage_limit_id: 'SYNTHETIC_SCOPE_LIMIT',
        limitation_codes: ['SYNTHETIC_ONLY'],
      },
    },
    frozen_sources: [source('SOURCE_A'), source('SOURCE_B', {
      intake_outcome: 'REVIEWED_NON_RECEIPT',
    })],
    limits: {
      maximum_sources: 8,
      maximum_attempts: 8,
      maximum_total_bytes: 4096,
      maximum_runtime_ms: 1000,
      maximum_memory_bytes: 4096,
    },
    ...overrides,
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function rehashReceipt(receipt) {
  receipt.source_inventory_digest = contentId(
    'PROCESS_FROZEN_SOURCE_INVENTORY/V1',
    receipt.intake_outcomes,
  );
  const { acquisition_receipt_id: ignored, ...body } = receipt;
  receipt.acquisition_receipt_id = contentId(
    'PROCESS_SOURCE_ACQUISITION_RECEIPT/V1',
    body,
  );
  return receipt;
}

test('builds a deterministic frozen-source receipt with evidence and coverage history', () => {
  const first = acquireProcessSources(input());
  const second = acquireProcessSources(input());

  assert.deepEqual(first, second);
  assert.equal(first.authority_state, 'NOT_GRANTED');
  assert.equal(first.intake_outcomes.length, 2);
  assert.equal(first.intake_outcomes[1].intake_outcome, 'REVIEWED_NON_RECEIPT');
  assert.equal(
    input().frozen_sources.every(
      (frozenSource) => !Object.hasOwn(frozenSource, 'source_text'),
    ),
    true,
  );
  assert.deepEqual(first.coverage_limit, input().governed_scope.coverage_limit);
  assert.equal(Object.isFrozen(first), true);
  assert.doesNotThrow(
    () => validateProcessSourceAcquisitionReceipt(first, first.acquisition_receipt_id),
  );
});

test('fails closed when the source-byte side channel is missing or changed', () => {
  const value = input();
  assert.throws(
    () => acquireSources(value, new Map()),
    { code: 'INVALID_PROCESS_FROZEN_SOURCE' },
  );
  const mismatched = sourceBytesForInput(value);
  mismatched.set(
    value.frozen_sources[0].source_identity.source_document_identity,
    Buffer.from('substituted source bytes', 'utf8'),
  );
  assert.throws(
    () => acquireSources(value, mismatched),
    { code: 'INVALID_PROCESS_FROZEN_SOURCE' },
  );
});

test('rejects unmanifested, duplicate and unresolved source records', () => {
  const unmanifested = input();
  unmanifested.frozen_sources.push(source('SOURCE_X'));
  assert.throws(() => acquireProcessSources(unmanifested),
    (error) => error.code === 'UNMANIFESTED_PROCESS_SOURCE');

  const duplicate = input();
  duplicate.frozen_sources[1] = source('SOURCE_A');
  assert.throws(() => acquireProcessSources(duplicate),
    (error) => error.code === 'INVALID_PROCESS_SOURCE_ACQUISITION_INPUT');

  const unresolved = input({ frozen_sources: [source('SOURCE_A')] });
  assert.throws(() => acquireProcessSources(unresolved),
    (error) => error.code === 'UNRESOLVED_GOVERNED_PROCESS_SOURCE');
});

test('rejects hostile bytes, evidence and bounded-resource inputs', () => {
  const badDigest = input();
  badDigest.frozen_sources[0].source_text_digest = digest('wrong');
  assert.throws(() => acquireProcessSources(badDigest),
    (error) => error.code === 'INVALID_PROCESS_FROZEN_SOURCE');

  const missingEvidence = input();
  missingEvidence.frozen_sources[0].evidence_history = [];
  assert.throws(() => acquireProcessSources(missingEvidence),
    (error) => error.code === 'INVALID_PROCESS_FROZEN_SOURCE');

  const tooManyAttempts = input();
  tooManyAttempts.frozen_sources[0].attempts_used = 8;
  tooManyAttempts.frozen_sources[1].attempts_used = 8;
  assert.throws(() => acquireProcessSources(tooManyAttempts),
    (error) => error.code === 'PROCESS_SOURCE_ACQUISITION_ATTEMPT_LIMIT_EXCEEDED');

  const tamperedReceipt = clone(acquireProcessSources(input()));
  const expectedReceiptId = tamperedReceipt.acquisition_receipt_id;
  tamperedReceipt.intake_outcomes[0].source_identity.document_hash = digest('substituted');
  assert.throws(() => validateProcessSourceAcquisitionReceipt(
    tamperedReceipt,
    expectedReceiptId,
  ),
    (error) => error.code === 'INVALID_PROCESS_SOURCE_ACQUISITION_RECEIPT');
});

test('rejects fabricated receipt meaning even when all receipt hashes are recomputed', () => {
  const mutations = [
    (receipt) => { receipt.intake_outcomes[0].intake_outcome = 'FABRICATED'; },
    (receipt) => { receipt.intake_outcomes[0].source_class = 'UNKNOWN_SOURCE'; },
    (receipt) => { receipt.intake_outcomes[0].evidence_history = []; },
    (receipt) => { receipt.coverage_limit.limitation_codes = ['DUPLICATE', 'DUPLICATE']; },
    (receipt) => { receipt.limits.maximum_sources = 0; },
  ];
  for (const mutate of mutations) {
    const trusted = acquireProcessSources(input());
    const receipt = clone(trusted);
    mutate(receipt);
    rehashReceipt(receipt);
    assert.throws(
      () => validateProcessSourceAcquisitionReceipt(
        receipt,
        trusted.acquisition_receipt_id,
      ),
      { name: 'ProcessSourceAcquisitionError' },
    );
  }
});

test('rejects a valid-to-valid self-rehashed intake outcome substitution', () => {
  const trusted = acquireProcessSources(input());
  const substituted = clone(trusted);
  substituted.intake_outcomes[0].intake_outcome = 'REVIEWED_NON_RECEIPT';
  rehashReceipt(substituted);

  assert.throws(
    () => validateProcessSourceAcquisitionReceipt(
      substituted,
      trusted.acquisition_receipt_id,
    ),
    { code: 'INVALID_PROCESS_SOURCE_ACQUISITION_RECEIPT' },
  );
});
