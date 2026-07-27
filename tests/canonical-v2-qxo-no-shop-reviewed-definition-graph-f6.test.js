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
} = require('../lib/canonical-v2/contract-bundle');
const {
  DEFINITION_SPECS,
  DEPENDENCY_SCOPE_SPECS,
  DEPENDENCY_SPECS,
  RESIDUAL_SPECS,
  USE_SPECS,
  buildQxoNoShopReviewedDefinitionGraphF6,
  validateQxoNoShopReviewedDefinitionGraphF6CarrierIdentity,
} = require('../lib/canonical-v2/qxo-no-shop-reviewed-definition-graph-f6');

const MODULE = 'lib/canonical-v2/qxo-no-shop-reviewed-definition-graph-f6.js';
const RUNNER = 'scripts/canonical-v2-staging-qxo-no-shop-clock-attestation.mjs';
const FIXTURE =
  'tests/fixtures/canonical-v2/qxo-no-shop-definition-graph-f6-staging-attestation.json';

function carrier() {
  const body = {
    schema_version: 'QXO_NO_SHOP_REVIEWED_DEFINITION_GRAPH_F6/V1',
    authority_scope: 'OFFLINE_REVIEWED_QXO_NO_SHOP_DEFINITION_GRAPH_F6_ONLY',
    contract_binding: {},
    source_binding: {},
    parser_binding: {},
    supplement_binding: {},
    governed_dependency_scopes: [],
    candidate_outcomes: [],
    candidate_dispositions: [],
    reviewed_use_bindings: [],
    definition_dependency_outcomes: [],
    definition_dependency_edges: [],
    retained_use_residuals: [],
    validated_semantic_graph: {},
    status: {},
  };
  return {
    ...body,
    qxo_no_shop_reviewed_definition_graph_f6_id: contentId(
      'QXO_NO_SHOP_REVIEWED_DEFINITION_GRAPH_F6/V1',
      body,
    ),
    canonical_payload_digest: contentId(
      'QXO_NO_SHOP_REVIEWED_DEFINITION_GRAPH_F6_PAYLOAD/V1',
      body,
    ),
  };
}

test('the reviewed F6 definition graph carrier is closed and deterministic', () => {
  const first = carrier();
  const second = carrier();
  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.equal(
    validateQxoNoShopReviewedDefinitionGraphF6CarrierIdentity(first),
    true,
  );
  const changed = JSON.parse(JSON.stringify(first));
  changed.status.release_eligible = true;
  assert.throws(
    () => validateQxoNoShopReviewedDefinitionGraphF6CarrierIdentity(changed),
    /identity has drifted/i,
  );
  assert.throws(
    () => buildQxoNoShopReviewedDefinitionGraphF6({ unknown_authority: true }),
    /outside its closed contract/i,
  );
});

test('all six source-backed definition candidates receive final accepted dispositions', () => {
  const attestation = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  assert.equal(attestation.environment, 'STAGING');
  assert.equal(
    attestation.contract_binding.contract_fingerprint,
    FIXTURE_CONTRACT_FINGERPRINT_V6,
  );
  assert.deepEqual(
    attestation.candidate_outcomes.map((outcome) => ({
      definition_key: outcome.definition_key,
      candidate_origin: outcome.candidate_origin,
      governed_ordinal: outcome.governed_ordinal,
      suppressed: outcome.suppressed,
      failure_code: outcome.failure_code,
    })),
    DEFINITION_SPECS.map((spec) => ({
      definition_key: spec.definition_key,
      candidate_origin: spec.candidate_origin,
      governed_ordinal: spec.term_interval.start,
      suppressed: false,
      failure_code: null,
    })),
  );
  assert.equal(
    attestation.candidate_outcomes.filter(
      (outcome) => outcome.candidate_origin === 'ADMITTED_PARSER_PROPOSAL',
    ).length,
    4,
  );
  assert.equal(
    attestation.candidate_outcomes.filter(
      (outcome) => outcome.candidate_origin === 'REVIEWED_SUPPLEMENT',
    ).length,
    2,
  );
  assert.equal(attestation.candidate_dispositions.length, 6);
  assert.equal(attestation.graph_summary.definition_cue_count, 6);
  assert.equal(attestation.graph_summary.definition_use_cue_count, 25);
});

test('definition and use ordinals are immutable document coordinates', () => {
  assert.deepEqual(
    DEFINITION_SPECS.map((spec) => spec.term_interval.start),
    [207258, 207553, 208354, 211573, 212832, 224306],
  );
  assert.equal(
    new Set(USE_SPECS.map((spec) => spec.interval.start)).size,
    USE_SPECS.length,
  );
  assert.equal(
    USE_SPECS.every((spec) => spec.interval.start < spec.interval.end),
    true,
  );
});

test('each definition has one declaration while operative uses remain dependency-scoped', () => {
  const attestation = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  for (const spec of DEFINITION_SPECS) {
    const declarations = attestation.reviewed_use_bindings.filter(
      (binding) => binding.definition_key === spec.definition_key
        && binding.inventory_scope === 'DECLARATION_COMPLETE',
    );
    assert.deepEqual(
      declarations.map((binding) => [binding.absolute_start, binding.absolute_end]),
      [[spec.term_interval.start, spec.term_interval.end]],
      spec.definition_key,
    );
  }
  assert.equal(
    attestation.reviewed_use_bindings
      .filter((binding) => binding.inventory_scope === 'DEPENDENCY_SCOPED')
      .every((binding) => binding.purpose_codes.length > 0),
    true,
  );
  assert.equal(attestation.graph_status.dependency_scoped_use_inventory, true);
  assert.equal(
    attestation.graph_status.governed_dependency_use_inventory_complete,
    false,
  );
  assert.equal(attestation.graph_status.absence_authority, 'NONE');
});

test('nested dependencies include the complete Superior Proposal transitive uses', () => {
  const attestation = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  assert.deepEqual(
    attestation.definition_dependency_edges.map((edge) => ({
      container_definition_key: edge.container_definition_key,
      referenced_definition_key: edge.referenced_definition_key,
      governed_ordinal: edge.governed_ordinal,
    })),
    DEPENDENCY_SPECS.map((spec) => ({
      container_definition_key: spec.container_definition_key,
      referenced_definition_key: spec.referenced_definition_key,
      governed_ordinal: spec.use_interval.start,
    })),
  );
  assert.deepEqual(
    attestation.definition_dependency_edges
      .filter(
        (edge) => edge.container_definition_key === 'COMPANY_SUPERIOR_PROPOSAL',
      )
      .map((edge) => edge.governed_ordinal),
    [212900, 213708, 214004, 214097],
  );
  assert.equal(
    attestation.definition_dependency_outcomes.every(
      (outcome) => !outcome.suppressed && outcome.failure_code === null,
    ),
    true,
  );
});

test('one failed definition preserves the other five and suppresses only dependent graph members', () => {
  const attestation = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  assert.equal(attestation.candidate_failure_isolation_verified, true);
  assert.equal(attestation.candidate_outcomes.length, 6);
  assert.equal(
    attestation.candidate_outcomes.every((outcome) => !outcome.suppressed),
    true,
  );
});

test('the plural Company Requests use blocks only complete first-sentence notice closure', () => {
  const attestation = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  assert.deepEqual(
    attestation.governed_dependency_scopes.map((scope) => ({
      scope_key: scope.scope_key,
      absolute_start: scope.evidence_span.absolute_start,
      absolute_end: scope.evidence_span.absolute_end,
    })),
    DEPENDENCY_SCOPE_SPECS.map((spec) => ({
      scope_key: spec.scope_key,
      absolute_start: spec.interval.start,
      absolute_end: spec.interval.end,
    })),
  );
  assert.equal(RESIDUAL_SPECS.length, 1);
  const [residual] = attestation.retained_use_residuals;
  assert.equal(residual.observed_text, 'Company Requests');
  assert.deepEqual(
    [residual.evidence_span.absolute_start, residual.evidence_span.absolute_end],
    [208683, 208699],
  );
  assert.equal(
    residual.semantic_impact_code,
    'BLOCKS_COMPLETE_NOTICE_DEFINITION_USE_CLOSURE',
  );
  assert.deepEqual(residual.dependent_result_keys, ['NO_SHOP_COMPLETE_NOTICE']);
  assert.equal(residual.publication_effect, 'BLOCK_DEPENDENT_RESULT_ONLY');
  assert.equal(residual.absence_authority, 'NONE');
});

test('the review graph grants no downstream or publication authority', () => {
  const attestation = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  const status = attestation.graph_status;
  assert.equal(status.definition_candidate_dispositions_complete, true);
  assert.equal(status.review_source_graph_authority, 'EXACT_SOURCE_ONLY');
  assert.equal(status.definition_graph_authority, 'NONE');
  assert.equal(status.review_renderable, true);
  assert.equal(status.publication_blocked, true);
  assert.equal(status.release_eligible, false);
  for (const key of [
    'canonical_write_authority',
    'result_authority',
    'metric_authority',
    'comparability_authority',
    'query_authority',
    'serving_authority',
    'release_authority',
  ]) {
    assert.equal(status[key], 'NONE', key);
  }
  assert.equal(
    FIXTURE_SERVING_CONTRACT_FINGERPRINTS.includes(
      attestation.contract_binding.contract_fingerprint,
    ),
    false,
  );
});

test('staging verification remains one bounded read with no write path', () => {
  const moduleSource = fs.readFileSync(MODULE, 'utf8');
  const runnerSource = withoutF20RollbackOnlyCertification(
    fs.readFileSync(RUNNER, 'utf8'),
  );
  assert.match(runnerSource, /--definition-graph-f6-print/);
  assert.match(runnerSource, /--definition-graph-f6-verify/);
  assert.match(runnerSource, /SELECT canonical_payload/);
  assert.match(runnerSource, /LIMIT 2/);
  assert.match(runnerSource, /timeout: 90_000/);
  assert.match(runnerSource, /MAX_RESPONSE_BYTES = 4 \* 1024 \* 1024/);
  assert.doesNotMatch(
    runnerSource,
    /\b(?:INSERT\s+INTO|UPDATE\s+[a-z_]|DELETE\s+FROM|UPSERT)\b/i,
  );
  assert.doesNotMatch(
    moduleSource,
    /canonical-writer|candidate-release|serving-projection|lib\/query/,
  );
});
