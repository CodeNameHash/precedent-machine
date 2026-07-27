const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {
  withoutF20RollbackOnlyCertification,
} = require('./helpers/canonical-v2-staging-runner-scope');

const {
  canonicalJson,
  contentId,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  buildQxoNoShopClockParserBoundReviewSeed,
  validateQxoNoShopClockParserBoundReviewSeedCarrierIdentity,
} = require('../lib/canonical-v2/qxo-no-shop-clock-parser-bridge');
const {
  normaliseDurationToDays,
} = require('../lib/canonical-v2/observation-normalisers');

const MODULE = 'lib/canonical-v2/qxo-no-shop-clock-parser-bridge.js';
const RUNNER =
  'scripts/canonical-v2-staging-qxo-no-shop-clock-attestation.mjs';
const FIXTURE =
  'tests/fixtures/canonical-v2/qxo-no-shop-clock-staging-attestation.json';

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
    schema_version: 'QXO_NO_SHOP_CLOCK_PARSER_BOUND_REVIEW_SEED/V1',
    authority_scope:
      'OFFLINE_REVIEW_ONLY_NO_CANONICAL_MARKET_OR_SERVING_AUTHORITY',
    contract_binding: {},
    source_binding: {},
    parser_binding: {},
    reviewed_mapping_reference: {},
    clock_outcomes: [],
    status: {},
  };
  return {
    ...body,
    qxo_no_shop_clock_parser_bound_review_seed_id: contentId(
      'QXO_NO_SHOP_CLOCK_PARSER_BOUND_REVIEW_SEED/V1',
      body,
    ),
    canonical_payload_digest: contentId(
      'QXO_NO_SHOP_CLOCK_PARSER_BOUND_REVIEW_SEED_PAYLOAD/V1',
      body,
    ),
  };
}

test('bridge module executes deterministic carrier identity and closed-input validation', () => {
  const first = reviewSeedCarrier();
  const second = reviewSeedCarrier();
  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.equal(
    validateQxoNoShopClockParserBoundReviewSeedCarrierIdentity(first),
    true,
  );
  const changed = JSON.parse(JSON.stringify(first));
  changed.status.release_eligible = true;
  assert.throws(
    () => validateQxoNoShopClockParserBoundReviewSeedCarrierIdentity(changed),
    /identity has drifted/i,
  );
  assert.throws(
    () => buildQxoNoShopClockParserBoundReviewSeed({
      unknown_authority: true,
    }),
    /input is outside its closed contract/i,
  );
});

test('checked staging identity binds one exact Section 4.3 parent and two independent clocks', () => {
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
    attestation.clock_dependencies.map((item) => [
      item.clock_key,
      item.suppressed,
      item.failure_code,
    ]),
    [
      ['NOTICE', false, null],
      ['INITIAL_MATCH', false, null],
    ],
  );
});

test('24 elapsed hours canonicalise to one day while four business days retain their basis', () => {
  const attestation = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  const [notice, match] = attestation.clock_dependencies;
  assert.deepEqual(notice.raw_duration, {
    magnitude: '24',
    unit: 'HOURS',
  });
  assert.deepEqual(notice.canonical_duration, {
    magnitude: '1',
    unit: 'DAYS',
    day_basis: 'ELAPSED',
    trigger: 'RECEIPT_OF_COMPETING_PROPOSAL',
  });
  assert.deepEqual(match.raw_duration, {
    magnitude: '4',
    unit: 'DAYS',
  });
  assert.deepEqual(match.canonical_duration, {
    magnitude: '4',
    unit: 'DAYS',
    day_basis: 'BUSINESS',
    trigger: 'SUPERIOR_PROPOSAL_NOTICE',
  });
  assert.notEqual(
    notice.canonical_duration.day_basis,
    match.canonical_duration.day_basis,
  );
  assert.equal(normaliseDurationToDays({
    rawMagnitude: '24',
    rawUnit: 'HOURS',
    dayBasis: 'ELAPSED',
    trigger: 'RECEIPT_OF_COMPETING_PROPOSAL',
    derivationVersion: 'QXO_ADMITTED_NO_SHOP_NOTICE/V1',
  }).normalisation_payload_digest, notice.normalisation_payload_digest);
  assert.equal(normaliseDurationToDays({
    rawMagnitude: '4',
    rawUnit: 'DAYS',
    dayBasis: 'BUSINESS',
    trigger: 'SUPERIOR_PROPOSAL_NOTICE',
    derivationVersion: 'QXO_ADMITTED_NO_SHOP_NOTICE/V1',
  }).normalisation_payload_digest, match.normalisation_payload_digest);
});

test('review seed grants no taxonomy, result, market, query, serving, write or release authority', () => {
  const attestation = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  const status = attestation.seed_status;
  assert.equal(
    attestation.authority_scope,
    'OFFLINE_REVIEW_ONLY_NO_CANONICAL_MARKET_OR_SERVING_AUTHORITY',
  );
  for (const authority of [
    'canonical_write_authority',
    'taxonomy_authority',
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
  assert.equal(status.failure_isolation, 'SUPPRESS_AFFECTED_CLOCK_ONLY');
  assert.equal(status.blocker_codes.includes('PARSER_RESIDUAL_RETAINED'), true);
  const keys = collectKeys(attestation);
  for (const forbidden of [
    'cohort',
    'corpus_release_id',
    'market_observation',
    'metric_slot_key',
    'relationship_revision_id',
    'result_inputs',
    'serving_namespace_id',
  ]) {
    assert.equal(keys.has(forbidden), false, `forbidden field: ${forbidden}`);
  }
});

test('bridge keeps parser authority structural and isolates clock-reference failures', () => {
  const source = fs.readFileSync(MODULE, 'utf8');
  assert.match(source, /EXACT_SECTION_PARENT_ONLY/);
  assert.match(source, /semantic_clock_detection_authority: 'NONE'/);
  assert.match(source, /EXISTING_REVIEWED_MAPPING_REFERENCE_ONLY/);
  assert.match(source, /SUPPRESS_AFFECTED_CLOCK_ONLY/);
  assert.match(source, /clockOutcome/);
  assert.match(source, /CLOCK_RESIDUAL_OVERLAP/);
  assert.match(source, /buildQxoAdmittedNoShopNoticeSlice/);
  assert.match(source, /validateAdmittedParserProposalEnvelope/);
  assert.doesNotMatch(source, /resultInputs|RESULT_INPUTS/);
  assert.doesNotMatch(source, /canonical-writer|candidate-release|serving-projection|lib\/query/);
  assert.doesNotMatch(source, /node:fs|node:child_process|supabase/);
});

test('staging verifier is one bounded read-only source reconstruction with no source text output', () => {
  const source = withoutF20RollbackOnlyCertification(
    fs.readFileSync(RUNNER, 'utf8'),
  );
  assert.match(source, /deal-corpus-canonical-v2-staging/);
  assert.match(source, /Refusing to run outside/);
  assert.match(source, /SELECT canonical_payload/);
  assert.match(source, /MAX_RESPONSE_BYTES/);
  assert.match(source, /--verify/);
  assert.doesNotMatch(source, /\bINSERT\b|\bUPDATE\b|\bDELETE\b|canonical_v2_write/);
  assert.doesNotMatch(source, /exact_text|canonical_text\.text|source_bytes_base64/);
});
