const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {
  withoutF20RollbackOnlyCertification,
} = require('./helpers/canonical-v2-staging-runner-scope');

const { canonicalJson, contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  FIXTURE_CONTRACT_FINGERPRINT_V6,
  FIXTURE_SERVING_CONTRACT_FINGERPRINTS,
  NO_SHOP_ACTION_CODES_V2,
} = require('../lib/canonical-v2/contract-bundle');
const {
  buildQxoNoShopActionsF6ParserBoundReviewSeed,
  validateQxoNoShopActionsF6ParserBoundReviewSeedCarrierIdentity,
} = require('../lib/canonical-v2/qxo-no-shop-actions-f6-parser-bridge');

const MODULE = 'lib/canonical-v2/qxo-no-shop-actions-f6-parser-bridge.js';
const RUNNER = 'scripts/canonical-v2-staging-qxo-no-shop-clock-attestation.mjs';
const FIXTURE =
  'tests/fixtures/canonical-v2/qxo-no-shop-actions-f6-staging-attestation.json';

function carrier() {
  const body = {
    schema_version: 'QXO_NO_SHOP_ACTIONS_F6_PARSER_BOUND_REVIEW_SEED/V1',
    authority_scope: 'OFFLINE_REVIEWED_QXO_F6_ATOMIC_ACTION_REFERENCES_ONLY',
    contract_binding: {},
    source_binding: {},
    parser_binding: {},
    reviewed_mapping_reference: {},
    action_outcomes: [],
    status: {},
  };
  return {
    ...body,
    qxo_no_shop_actions_f6_parser_bound_review_seed_id: contentId(
      'QXO_NO_SHOP_ACTIONS_F6_PARSER_BOUND_REVIEW_SEED/V1',
      body,
    ),
    canonical_payload_digest: contentId(
      'QXO_NO_SHOP_ACTIONS_F6_PARSER_BOUND_REVIEW_SEED_PAYLOAD/V1',
      body,
    ),
  };
}

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

test('F6 actions bridge has deterministic carrier identity and a closed input', () => {
  const first = carrier();
  const second = carrier();
  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.equal(
    validateQxoNoShopActionsF6ParserBoundReviewSeedCarrierIdentity(first),
    true,
  );
  const changed = JSON.parse(JSON.stringify(first));
  changed.status.release_eligible = true;
  assert.throws(
    () => validateQxoNoShopActionsF6ParserBoundReviewSeedCarrierIdentity(changed),
    /identity has drifted/i,
  );
  assert.throws(
    () => buildQxoNoShopActionsF6ParserBoundReviewSeed({
      unknown_authority: true,
    }),
    /outside its closed contract/i,
  );
});

test('staging attests 24 exact occurrences, 23 action types and local semantics', () => {
  const attestation = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  assert.equal(attestation.environment, 'STAGING');
  assert.equal(
    attestation.contract_binding.contract_fingerprint,
    FIXTURE_CONTRACT_FINGERPRINT_V6,
  );
  assert.equal(attestation.action_dependencies.length, 24);
  assert.equal(attestation.action_dependencies.some((item) => item.suppressed), false);
  assert.deepEqual(
    [...new Set(attestation.action_dependencies.map((item) => item.action_code))].sort(),
    [...NO_SHOP_ACTION_CODES_V2].sort(),
  );
  assert.equal(
    attestation.action_dependencies.filter(
      (item) => item.action_code === 'FURNISH_NONPUBLIC_INFORMATION',
    ).length,
    2,
  );
  assert.deepEqual(
    attestation.action_dependencies.filter(
      (item) => item.knowledge_qualifier_code === 'KNOWINGLY',
    ).map((item) => item.occurrence_key),
    ['A_FACILITATE', 'A_ENCOURAGE'],
  );
  assert.equal(
    attestation.action_dependencies.find(
      (item) => item.occurrence_key === 'A_FURNISH_METHOD',
    ).method_of_action_occurrence_ids.length,
    2,
  );
  assert.equal(
    attestation.action_dependencies.find(
      (item) => item.occurrence_key === 'B_FURNISH',
    ).method_of_action_occurrence_ids.length,
    0,
  );
  for (const item of attestation.action_dependencies) {
    assert.match(item.action_occurrence_id, /^[a-f0-9]{64}$/);
    assert.match(item.action_occurrence_revision_id, /^[a-f0-9]{64}$/);
    assert.match(item.claim_revision_id, /^[a-f0-9]{64}$/);
  }
});

test('untyped dimensions and all omitted Section 4.3 duties remain source-backed blockers', () => {
  const attestation = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  assert.equal(attestation.retained_source_residuals.length, 13);
  assert.deepEqual(attestation.source_binding.retained_source_span_digests, [
    'd6371497801974cbbe6bd407d948ee9d97b41b42e6a71a9ce2139be5509cde6b',
    '75c1adeb3f8f146f30d5c14d11377de9d9ae9c79f05f995836a7259e9e886223',
    '1bb0fdbf3c24675198260b44df6f85dcbb1d077785951aef15d34e713cc02b4c',
  ]);
  assert.equal(attestation.seed_status.section_4_3_scope_complete, false);
  assert.equal(attestation.seed_status.retained_source_residual_count, 13);
  assert.equal(
    attestation.retained_source_residuals.every(
      (item) => item.state === 'PENDING_REVIEWED_DISPOSITION'
        && item.publication_effect === 'BLOCK'
        && /^[a-f0-9]{64}$/.test(item.exact_bytes_digest),
    ),
    true,
  );
  for (const code of [
    'NO_SHOP_EXPRESS_PERMISSION_RESERVATION_UNTYPED',
    'NO_SHOP_ACTOR_SCOPE_UNTYPED',
    'NO_SHOP_CEASE_EXISTING_PROCESS_DUTY_UNMAPPED',
    'NO_SHOP_RETURN_OR_DESTROY_INFORMATION_DUTY_UNMAPPED',
    'NO_SHOP_TERMINATE_DATA_ROOM_ACCESS_DUTY_UNMAPPED',
    'NO_SHOP_TEMPORAL_SCOPE_UNTYPED',
    'NO_SHOP_DIRECT_OR_INDIRECT_MODE_UNTYPED',
    'NO_SHOP_ACQUISITION_PROPOSAL_THRESHOLD_UNTYPED',
    'NO_SHOP_RECIPIENT_AND_PURPOSE_UNTYPED',
    'NO_SHOP_ALTERNATIVE_AGREEMENT_FORM_ATTRIBUTES_UNTYPED',
    'NO_SHOP_DGCL_203_WAIVER_METHOD_RELATIONSHIP_UNRESOLVED',
    'NO_SHOP_POST_RESTRICTION_A_DUTIES_UNMAPPED',
    'NO_SHOP_LATER_NOTICE_C_DUTIES_UNMAPPED',
  ]) {
    assert.equal(
      attestation.retained_source_residuals.some(
        (item) => item.residual_code === code,
      ),
      true,
      code,
    );
  }
  assert.deepEqual(
    attestation.deferred_semantic_families.map(
      (family) => [family.family_key, family.ordered_source_dependency_ids.length],
    ),
    [
      ['NO_SHOP_ACTION_COMPARISON_ROLLUP', 24],
      ['NO_SHOP_INLINE_PERMISSION_EFFECT', 1],
      ['NO_SHOP_EXCEPTION_EFFECT', 1],
      ['NO_SHOP_NOTICE_OBLIGATION', 1],
    ],
  );
});

test('F6 action references grant no write, market, query, serving or release authority', () => {
  const attestation = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  const status = attestation.seed_status;
  assert.equal(attestation.failure_isolation_verified, true);
  assert.equal(status.action_reference_complete, true);
  assert.equal(status.release_eligible, false);
  for (const authority of [
    'canonical_write_authority',
    'taxonomy_authority',
    'parser_semantic_classification_authority',
    'rollup_authority',
    'relationship_effect_authority',
    'notice_obligation_authority',
    'result_authority',
    'metric_authority',
    'comparability_authority',
    'query_authority',
    'serving_authority',
    'release_authority',
  ]) {
    assert.equal(status[authority], 'NONE', authority);
  }
  for (const blocker of [
    'F6_SECTION_4_3_SCOPE_INCOMPLETE',
    'F6_RETAINED_SOURCE_DIMENSIONS_PENDING',
    'F6_ROLLUP_SOURCE_BINDING_DEFERRED',
    'F6_INLINE_PERMISSION_SOURCE_BINDING_DEFERRED',
    'F6_EXCEPTION_SOURCE_BINDING_DEFERRED',
    'F6_COMPLETE_NOTICE_SOURCE_BINDING_DEFERRED',
    'F6_RESULT_DEFINITION_DEFERRED',
    'PARSER_RESIDUAL_RETAINED',
  ]) {
    assert.equal(status.blocker_codes.includes(blocker), true, blocker);
  }
  assert.equal(
    FIXTURE_SERVING_CONTRACT_FINGERPRINTS.includes(FIXTURE_CONTRACT_FINGERPRINT_V6),
    false,
  );
  const keys = collectKeys(attestation);
  for (const forbidden of [
    'cohort',
    'corpus_release_id',
    'market_observation',
    'metric_slot_key',
    'serving_namespace_id',
  ]) {
    assert.equal(keys.has(forbidden), false, forbidden);
  }
});

test('bridge remains review-only and staging verification is one bounded read', () => {
  const bridge = fs.readFileSync(MODULE, 'utf8');
  assert.match(bridge, /EXACT_SECTION_PARENT_ONLY/);
  assert.match(bridge, /semantic_action_detection_authority: 'NONE'/);
  assert.match(bridge, /SUPPRESS_AFFECTED_ATOMIC_ACTION_ONLY/);
  assert.match(bridge, /UNEXPECTED_ACTION_OCCURRENCE/);
  assert.match(bridge, /ACTION_METHOD_DEPENDENCY_UNRESOLVED/);
  assert.match(bridge, /validateAdmittedParserProposalEnvelope/);
  assert.doesNotMatch(
    bridge,
    /canonical-writer|candidate-release|serving-projection|lib\/query/,
  );
  assert.doesNotMatch(bridge, /node:fs|node:child_process|supabase/);

  const runner = withoutF20RollbackOnlyCertification(
    fs.readFileSync(RUNNER, 'utf8'),
  );
  assert.match(runner, /deal-corpus-canonical-v2-staging/);
  assert.match(runner, /Refusing to run outside/);
  assert.match(runner, /SELECT canonical_payload/);
  assert.match(runner, /MAX_RESPONSE_BYTES/);
  assert.match(runner, /--actions-f6-print/);
  assert.match(runner, /--actions-f6-verify/);
  assert.doesNotMatch(runner, /\bINSERT\b|\bUPDATE\b|\bDELETE\b|canonical_v2_write/);
  assert.doesNotMatch(
    runner,
    /exact_text|canonical_text\.text|source_bytes_base64/,
  );
});
