const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const {
  canonicalJson,
  contentId,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  buildQxoNoShopActionsParserBoundReviewSeed,
  validateQxoNoShopActionsParserBoundReviewSeedCarrierIdentity,
} = require('../lib/canonical-v2/qxo-no-shop-actions-parser-bridge');

const MODULE =
  'lib/canonical-v2/qxo-no-shop-actions-parser-bridge.js';
const RUNNER =
  'scripts/canonical-v2-staging-qxo-no-shop-clock-attestation.mjs';
const FIXTURE =
  'tests/fixtures/canonical-v2/qxo-no-shop-actions-staging-attestation.json';

function collectKeys(value, keys = new Set()) {
  if (!value || typeof value !== 'object') return keys;
  if (Array.isArray(value)) {
    value.forEach((item) => collectKeys(item, keys));
    return keys;
  }
  Object.entries(value).forEach(([key, child]) => {
    keys.add(key);
    collectKeys(child, keys);
  });
  return keys;
}

function reviewSeedCarrier() {
  const body = {
    schema_version: 'QXO_NO_SHOP_ACTIONS_PARSER_BOUND_REVIEW_SEED/V1',
    authority_scope:
      'OFFLINE_REVIEW_ONLY_NO_CANONICAL_MARKET_OR_SERVING_AUTHORITY',
    contract_binding: {},
    source_binding: {},
    parser_binding: {},
    reviewed_mapping_reference: {},
    action_outcomes: [],
    exception_context_outcome: {},
    status: {},
  };
  return {
    ...body,
    qxo_no_shop_actions_parser_bound_review_seed_id: contentId(
      'QXO_NO_SHOP_ACTIONS_PARSER_BOUND_REVIEW_SEED/V1',
      body,
    ),
    canonical_payload_digest: contentId(
      'QXO_NO_SHOP_ACTIONS_PARSER_BOUND_REVIEW_SEED_PAYLOAD/V1',
      body,
    ),
  };
}

test('actions bridge enforces deterministic carrier identity and a closed input', () => {
  const first = reviewSeedCarrier();
  const second = reviewSeedCarrier();
  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.equal(
    validateQxoNoShopActionsParserBoundReviewSeedCarrierIdentity(first),
    true,
  );
  const changed = JSON.parse(JSON.stringify(first));
  changed.status.release_eligible = true;
  assert.throws(
    () => validateQxoNoShopActionsParserBoundReviewSeedCarrierIdentity(changed),
    /identity has drifted/i,
  );
  assert.throws(
    () => buildQxoNoShopActionsParserBoundReviewSeed({
      unknown_authority: true,
    }),
    /input is outside its closed contract/i,
  );
});

test('staging identity binds four action claims and rejects the defective exception context', () => {
  const attestation = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  assert.equal(attestation.environment, 'STAGING');
  assert.equal(
    attestation.parser_binding.section_4_3_exact_bytes_digest,
    'ffbffb81e798af99509dd998c5a5793c2127eaf3ada937ae662306e99a86c524',
  );
  assert.deepEqual(
    [
      attestation.parser_binding.section_4_3_absolute_start,
      attestation.parser_binding.section_4_3_absolute_end,
    ],
    [201370, 226862],
  );
  assert.equal(attestation.parser_binding.retained_parser_residual_count, 1);
  assert.equal(attestation.parser_binding.publication_blocked, true);
  assert.equal(attestation.failure_isolation_verified, true);
  assert.deepEqual(
    attestation.action_dependencies.map((item) => [
      item.action_key,
      item.suppressed,
      item.failure_code,
    ]),
    [
      ['SOLICIT_INITIATE_ENCOURAGE_FACILITATE', false, null],
      ['DISCUSS_OR_NEGOTIATE', false, null],
      ['ENTER_ALTERNATIVE_TRANSACTION_AGREEMENT', false, null],
      ['APPROVE_AUTHORISE_OR_ANNOUNCE_INTENTION', false, null],
    ],
  );
  assert.deepEqual(attestation.exception_context_dependency, {
    suppressed: true,
    failure_code: 'EXCEPTION_SOURCE_MAPPING_REQUIRES_CORRECTION',
    prerequisite_count: 0,
    relationship_count: 0,
    relationship_effect_authority: null,
  });
  assert.match(attestation.reviewed_action_reference_set_id, /^[a-f0-9]{64}$/);
  assert.match(attestation.rejected_source_reviewed_mapping_id, /^[a-f0-9]{64}$/);
});

test('each action keeps its own claim and evidence identity', () => {
  const attestation = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  for (const item of attestation.action_dependencies) {
    assert.match(item.claim_revision_id, /^[a-f0-9]{64}$/);
    assert.match(item.provision_component_id, /^[a-f0-9]{64}$/);
    assert.match(item.evidence_excerpt_id, /^[a-f0-9]{64}$/);
  }
  assert.notEqual(
    attestation.action_dependencies[0].claim_revision_id,
    attestation.action_dependencies[1].claim_revision_id,
  );
  assert.equal(
    attestation.action_dependencies[2].provision_component_id,
    attestation.action_dependencies[3].provision_component_id,
  );
  assert.notEqual(
    attestation.action_dependencies[2].claim_revision_id,
    attestation.action_dependencies[3].claim_revision_id,
  );
});

test('actions seed grants no relationship, result, market, query, serving, write or release authority', () => {
  const attestation = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  const status = attestation.seed_status;
  assert.equal(
    attestation.authority_scope,
    'OFFLINE_REVIEW_ONLY_NO_CANONICAL_MARKET_OR_SERVING_AUTHORITY',
  );
  for (const authority of [
    'canonical_write_authority',
    'taxonomy_authority',
    'relationship_effect_authority',
    'result_authority',
    'metric_authority',
    'comparability_authority',
    'query_authority',
    'serving_authority',
    'release_authority',
  ]) {
    assert.equal(status[authority], 'NONE');
  }
  assert.equal(status.release_eligible, false);
  assert.equal(status.action_reference_complete, true);
  assert.equal(status.review_reference_complete, false);
  assert.equal(
    status.exception_context_state,
    'REJECTED_REQUIRES_REVIEWED_REPLACEMENT',
  );
  assert.equal(
    status.failure_isolation,
    'SUPPRESS_AFFECTED_ACTION_OR_SHARED_EXCEPTION_CONTEXT_ONLY',
  );
  for (const blocker of [
    'COMPOSITION_SCOPE_CLOSURE_NOT_FROZEN',
    'EXCEPTED_BY_EFFECT_CONTRACT_NOT_FROZEN',
    'EXCEPTION_PREREQUISITE_CODEBOOK_AMENDMENT_REQUIRED',
    'EXCEPTION_SOURCE_MAPPING_REQUIRES_CORRECTION',
    'EXPECTED_LINEAGE_SLOTS_NOT_FROZEN',
    'PARSER_RESIDUAL_RETAINED',
    'QUERY_METRIC_CONTRACT_REQUIRED',
    'RESULT_DEFINITION_NOT_FROZEN',
  ]) {
    assert.equal(status.blocker_codes.includes(blocker), true, blocker);
  }
  const keys = collectKeys(attestation);
  for (const forbidden of [
    'cohort',
    'corpus_release_id',
    'market_observation',
    'metric_slot_key',
    'result_inputs',
    'serving_namespace_id',
  ]) {
    assert.equal(keys.has(forbidden), false, `forbidden field: ${forbidden}`);
  }
});

test('bridge keeps parser authority structural and ignores legacy resultInputs', () => {
  const source = fs.readFileSync(MODULE, 'utf8');
  assert.match(source, /EXACT_SECTION_PARENT_ONLY/);
  assert.match(source, /semantic_action_detection_authority: 'NONE'/);
  assert.match(source, /semantic_exception_detection_authority: 'NONE'/);
  assert.match(source, /EXISTING_REVIEWED_MAPPING_REFERENCE_ONLY/);
  assert.match(
    source,
    /SUPPRESS_AFFECTED_ACTION_OR_SHARED_EXCEPTION_CONTEXT_ONLY/,
  );
  assert.match(source, /EXCEPTED_BY_EFFECT_CONTRACT_NOT_FROZEN/);
  assert.match(source, /preflightReviewedSlice/);
  assert.match(source, /REJECTED_FOR_EXCEPTION_SEMANTIC_DEFECTS/);
  assert.match(source, /actionOutcome/);
  assert.match(source, /exceptionContextOutcome/);
  assert.match(source, /ACTION_RESIDUAL_OVERLAP/);
  assert.match(source, /buildQxoAdmittedNoShopActionsSlice/);
  assert.match(source, /validateAdmittedParserProposalEnvelope/);
  assert.doesNotMatch(source, /resultInputs|RESULT_INPUTS/);
  assert.doesNotMatch(
    source,
    /canonical-writer|candidate-release|serving-projection|lib\/query/,
  );
  assert.doesNotMatch(source, /node:fs|node:child_process|supabase/);
});

test('staging verifier remains one bounded read-only reconstruction with no source text output', () => {
  const source = fs.readFileSync(RUNNER, 'utf8');
  assert.match(source, /deal-corpus-canonical-v2-staging/);
  assert.match(source, /Refusing to run outside/);
  assert.match(source, /SELECT canonical_payload/);
  assert.match(source, /MAX_RESPONSE_BYTES/);
  assert.match(source, /--actions-verify/);
  assert.doesNotMatch(source, /\bINSERT\b|\bUPDATE\b|\bDELETE\b|canonical_v2_write/);
  assert.doesNotMatch(source, /exact_text|canonical_text\.text|source_bytes_base64/);
});
