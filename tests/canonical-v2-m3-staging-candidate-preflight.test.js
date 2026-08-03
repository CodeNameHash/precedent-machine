'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  listRegisteredSectionFamilies,
} = require('../lib/canonical-v2/native-producer/producer-prompt-registry');

const {
  COLLECTIONS,
  FAMILY_OUTPUT_SCHEMA,
  M3StagingCandidateError,
  buildM3StagingCandidatePreflight,
} = require('../lib/canonical-v2/m3-staging-candidate-preflight');

const digest = (seed) => seed.repeat(64).slice(0, 64);

function authority() {
  return {
    source_ordinal: 0,
    immutable_source_document_id: digest('a'),
    source_admission_manifest_id: digest('b'),
    semantic_extraction_input_envelope_id: digest('c'),
    canonical_text_id: digest('d'),
    canonical_text_sha256: digest('e'),
  };
}

function writeSet(deal, source) {
  return {
    source_references: [{
      schema_version: 'ADMITTED_SOURCE_REFERENCE/V1',
      immutable_source_document_id: source.immutable_source_document_id,
      source_admission_manifest_id: source.source_admission_manifest_id,
      semantic_extraction_input_envelope_id: source.semantic_extraction_input_envelope_id,
      canonical_text_id: source.canonical_text_id,
      governed_deal_key: deal.deal_key,
      deal_admission_id: deal.deal_admission_id,
      source_ordinal: source.source_ordinal,
    }],
    deal,
    write_set_origin: 'NATIVE_PRODUCER',
    ...Object.fromEntries(Object.keys(COLLECTIONS).map((key) => [key, []])),
  };
}

function sealFamilyOutput(output) {
  const { family_output_id: _oldId, ...body } = output;
  return {
    ...body,
    family_output_id: contentId(FAMILY_OUTPUT_SCHEMA, body),
  };
}

function familyOutput(familyId, deal, source) {
  return sealFamilyOutput({
    schema_version: FAMILY_OUTPUT_SCHEMA,
    family_id: familyId,
    completion_state: 'COMPLETE',
    contract_fingerprint: digest('2'),
    run_receipt_id: digest(familyId.charCodeAt(0).toString(16).at(-1)),
    resolution_receipt_id: digest(familyId.charCodeAt(familyId.length - 1).toString(16).at(-1)),
    source_authority: [source],
    write_set: writeSet(deal, source),
  });
}

function candidate() {
  const source = authority();
  const deal = {
    deal_key: 'deal:m3-preflight-test',
    deal_admission_id: digest('f'),
    document_hash: digest('1'),
    dimensions: { sector: 'test' },
  };
  return {
    deal,
    family_outputs: listRegisteredSectionFamilies().map((familyId) => familyOutput(familyId, deal, source)),
  };
}

function manifest() {
  return {
    contract_fingerprint: digest('2'),
    candidates: [candidate()],
  };
}

test('M3 candidate preflight seals complete native family outputs into one deterministic staging writer request', () => {
  const first = buildM3StagingCandidatePreflight(manifest());
  const replay = buildM3StagingCandidatePreflight(manifest());
  assert.equal(first.m3_staging_candidate_preflight_id, replay.m3_staging_candidate_preflight_id);
  assert.equal(first.plans.length, 1);
  assert.equal(first.plans[0].receipt.status, 'COMMITTED');
  assert.match(first.candidate_set_id, /^[a-f0-9]{64}$/);
  assert.match(first.plans[0].candidate_key, /^[a-f0-9]{64}$/);
  assert.equal(first.authority_scope, 'ROLLBACK_ONLY_ISOLATED_STAGING');
  assert.equal(first.durable_write_authority, 'NONE');
  assert.equal(first.plans[0].transaction_policy, 'ROLLBACK');
  assert.equal(first.plans[0].write_set.source_references.length, 1);
  assert.equal(first.plans[0].write_set.write_set_origin, undefined);
  assert.equal(first.plans[0].family_scope_digest.length, 64);
  assert.equal(first.plans[0].source_authority_digest.length, 64);
  assert.match(first.plans[0].idempotency_key, /M3_STAGING_DEAL_SCOPE\/[a-f0-9]{64}\//);
});

test('M3 candidate preflight fails closed if a required family is missing, incomplete, or exceeds declared scope', () => {
  const missing = manifest();
  missing.candidates[0].family_outputs.pop();
  assert.throws(() => buildM3StagingCandidatePreflight(missing), (error) => (
    error instanceof M3StagingCandidateError && error.code === 'INCOMPLETE_FAMILY_SCOPE'
  ));

  const incomplete = manifest();
  incomplete.candidates[0].family_outputs[0].completion_state = 'IN_PROGRESS';
  assert.throws(() => buildM3StagingCandidatePreflight(incomplete), (error) => (
    error instanceof M3StagingCandidateError && error.code === 'INCOMPLETE_FAMILY_SCOPE'
  ));

  const extra = manifest();
  extra.candidates[0].family_outputs.push(structuredClone(extra.candidates[0].family_outputs[0]));
  assert.throws(() => buildM3StagingCandidatePreflight(extra), (error) => (
    error instanceof M3StagingCandidateError && error.code === 'INCOMPLETE_FAMILY_SCOPE'
  ));
});

test('M3 candidate preflight rejects an output whose source reference is not bound to its admitted source authority', () => {
  const bad = manifest();
  bad.candidates[0].family_outputs[0].write_set.source_references[0].canonical_text_id = digest('9');
  bad.candidates[0].family_outputs[0] = sealFamilyOutput(bad.candidates[0].family_outputs[0]);
  assert.throws(() => buildM3StagingCandidatePreflight(bad), (error) => (
    error instanceof M3StagingCandidateError && error.code === 'SOURCE_AUTHORITY_MISMATCH'
  ));
});

test('M3 candidate preflight requires native origin and exact use of every declared source authority', () => {
  const reviewed = manifest();
  reviewed.candidates[0].family_outputs[0].write_set.write_set_origin = 'REVIEWED_SLICE';
  reviewed.candidates[0].family_outputs[0] = sealFamilyOutput(reviewed.candidates[0].family_outputs[0]);
  assert.throws(() => buildM3StagingCandidatePreflight(reviewed), (error) => (
    error instanceof M3StagingCandidateError && error.code === 'NON_NATIVE_FAMILY_OUTPUT'
  ));

  const unbound = manifest();
  unbound.candidates[0].family_outputs[0].source_authority.push({
    ...authority(), immutable_source_document_id: digest('f'),
  });
  unbound.candidates[0].family_outputs[0] = sealFamilyOutput(unbound.candidates[0].family_outputs[0]);
  assert.throws(() => buildM3StagingCandidatePreflight(unbound), (error) => (
    error instanceof M3StagingCandidateError && error.code === 'UNBOUND_SOURCE_AUTHORITY'
  ));
});

test('M3 candidate and candidate-set identities come from sealed outputs, never manifest labels', () => {
  const input = manifest();
  const first = buildM3StagingCandidatePreflight(input);
  input.candidates[0].family_outputs[0].run_receipt_id = digest('8');
  input.candidates[0].family_outputs[0] = sealFamilyOutput(input.candidates[0].family_outputs[0]);
  const changed = buildM3StagingCandidatePreflight(input);

  assert.notEqual(first.plans[0].candidate_key, changed.plans[0].candidate_key);
  assert.notEqual(first.candidate_set_id, changed.candidate_set_id);
  assert.throws(() => buildM3StagingCandidatePreflight({
    ...manifest(), candidate_set_id: 'operator-label',
  }), (error) => error instanceof M3StagingCandidateError && error.code === 'INVALID_INPUT');
});

test('M3 candidate preflight rejects a changed family output until it is resealed', () => {
  const bad = manifest();
  bad.candidates[0].family_outputs[0].run_receipt_id = digest('9');
  assert.throws(() => buildM3StagingCandidatePreflight(bad), (error) => (
    error instanceof M3StagingCandidateError && error.code === 'FAMILY_OUTPUT_ID_MISMATCH'
  ));
});

test('M3 candidate preflight binds each admitted source reference to the candidate deal', () => {
  const bad = manifest();
  bad.candidates[0].family_outputs[0].write_set.source_references[0].governed_deal_key = 'deal:other';
  bad.candidates[0].family_outputs[0] = sealFamilyOutput(bad.candidates[0].family_outputs[0]);
  assert.throws(() => buildM3StagingCandidatePreflight(bad), (error) => (
    error instanceof M3StagingCandidateError && error.code === 'SOURCE_AUTHORITY_MISMATCH'
  ));
});

test('M3 candidate preflight preserves the writer requirement for unique source documents and canonical texts', () => {
  const bad = manifest();
  for (const output of bad.candidates[0].family_outputs) {
    output.source_authority.push({ ...output.source_authority[0], source_ordinal: 1 });
    output.write_set.source_references.push({
      ...output.write_set.source_references[0], source_ordinal: 1,
    });
  }
  bad.candidates[0].family_outputs = bad.candidates[0].family_outputs.map(sealFamilyOutput);
  assert.throws(() => buildM3StagingCandidatePreflight(bad), (error) => (
    error instanceof M3StagingCandidateError && error.code === 'SOURCE_REFERENCE_CONFLICT'
  ));
});

test('M3 staging runner has a dry run and rolls back writer verification without a production target', () => {
  const source = fs.readFileSync('scripts/canonical-v2-m3-staging-candidate-preflight.mjs', 'utf8');
  assert.match(source, /--dry-run\|--verify/);
  assert.match(source, /createCanonicalV2StagingRuntime/);
  assert.match(source, /runtime\.guardProject\(\)/);
  assert.match(source, /runtime\.runSql\(sqlWriterCall\(plan\), \{ commit: false \}\)/);
  assert.match(source, /result\.receiptId !== plan\.receipt\.receiptId/);
  assert.match(source, /result\.inputDigest !== plan\.input_digest/);
  assert.match(source, /result\.status !== 'COMMITTED'/);
  assert.match(source, /canonical_v2_staging\.write_receipts/);
  assert.match(source, /receipt_absent/);
  assert.match(source, /transaction_outcome: 'ROLLED_BACK'/);
  assert.match(source, /durable_rows_written: 0/);
  assert.doesNotMatch(source, /commit:\s*true|tzulhdasmioeechxapdy/);
});
