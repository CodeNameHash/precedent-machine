const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const {
  AUTHORITY_FIELDS,
  AUTHORITY_SCOPE,
  LAWYER_REVIEW_NOTE,
  MAX_CARRIER_BYTES,
  __test,
} = require('../lib/canonical-v2/qxo-no-shop-copy-clock-f15');

const FIXTURE =
  'tests/fixtures/canonical-v2/qxo-no-shop-copy-clock-f15-staging-attestation.json';
const MODULE =
  'lib/canonical-v2/qxo-no-shop-copy-clock-f15.js';
const RUNNER =
  'scripts/canonical-v2-staging-qxo-no-shop-clock-attestation.mjs';

function fixture() {
  return JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
}

test('F15 binds frozen V11 and materialises one V6 notice revision', () => {
  const value = fixture();
  assert.equal(value.environment, 'STAGING');
  assert.equal(value.authority_scope, AUTHORITY_SCOPE);
  assert.equal(
    value.contract_binding.contract_fingerprint,
    '7cf669cb86e8cda58b33a623b7f5405e56b7c1aa4c9dfdbe1136edb6beffa6ca',
  );
  assert.equal(value.contract_binding.notice_schema_version, 6);
  assert.equal(
    value.revision_summary.schema_version,
    'NO_SHOP_NOTICE_OBLIGATION/V6',
  );
  assert.equal(value.materialisation_status.successor_materialised, true);
});

test('the stable source occurrence remains unchanged', () => {
  const value = fixture();
  assert.equal(
    value.notice_occurrence.notice_obligation_occurrence_id,
    '5bfba36963af3a1baec65d09a4fa479e21889ab522f66aaca89de348839c7440',
  );
  assert.deepEqual(
    [
      value.notice_occurrence.exact_source_span.absolute_start,
      value.notice_occurrence.exact_source_span.absolute_end,
    ],
    [207783, 208859],
  );
  assert.equal(
    value.upstream_binding.predecessor_notice_obligation_revision_id,
    value.revision_summary.predecessor_notice_obligation_revision_id,
  );
});

test('the primary clock runs once per satisfying proposal or request receipt', () => {
  const value = fixture();
  assert.equal(
    value.interpretation_summary.primary_interpretation.code,
    'RECEIPT_OF_PRIOR_CLAUSE_COMPANY_ACQUISITION_PROPOSAL_OR_COMPANY_REQUEST',
  );
  assert.equal(
    value.interpretation_summary.primary_clock_application_scope_code,
    'EACH_SATISFYING_PRIOR_TRIGGER_OCCURRENCE',
  );
  assert.equal(
    value.revision_summary.primary_item_or_batch_cardinality_state,
    'NOT_APPLICABLE',
  );
  assert.equal(value.interpretation_summary.lawyer_review_note, LAWYER_REVIEW_NOTE);
});

test('the source-backed item-receipt alternative remains unresolved and visible', () => {
  const value = fixture();
  assert.deepEqual(value.interpretation_summary.alternative_interpretations, [{
    code: 'RECEIPT_BY_OBLIGATED_PARTY_OF_ITEM_REQUIRED_TO_BE_COPIED',
  }]);
  assert.equal(
    value.revision_summary.alternative_clock_application_scope_state,
    'UNRESOLVED_ITEM_OR_BATCH',
  );
  assert.equal(
    value.revision_summary.alternative_item_or_batch_cardinality_state,
    'UNRESOLVED',
  );
  assert.equal(
    value.revision_summary.cardinality_ambiguity_scope_code,
    'ALTERNATIVE_ITEM_RECEIPT_INTERPRETATION_ONLY',
  );
  assert.equal(value.review_projection.ambiguity_flag_visible, true);
});

test('24 hours uses the governed normaliser and retains its F6 lineage', () => {
  const projection = fixture().review_projection;
  assert.deepEqual(projection.raw_duration, {
    magnitude: '24',
    unit: 'HOURS',
    day_basis: 'ELAPSED',
  });
  assert.deepEqual(projection.canonical_duration, {
    magnitude: '1',
    unit: 'DAYS',
    day_basis: 'ELAPSED',
  });
  assert.equal(
    projection.basis_key,
    'DAYS:ELAPSED:PROPOSAL_OR_REQUEST_RECEIPT',
  );
  assert.equal(
    projection.normalisation_payload_digest,
    'ae652eba2dfb5bc6fca4418455c21d9ab802eff9f46e6f86c8251d48d28349c7',
  );
  assert.equal(
    projection.source_timing_claim_revision_id,
    'fdc473bb486f0104c3e29e5afb263ee81c7a2953b6da67de42a0c3737322a177',
  );
  assert.equal(
    projection.source_normalisation_payload_digest,
    '5bfd481545b53ec694ffa59ce51bd39019294b3d61a8c7b8a690a215ddb2b4fc',
  );
  assert.equal(projection.promptly_qualifier_visible, true);
});

test('semantic comparability is primary-only and ambiguity-qualified', () => {
  const value = fixture();
  assert.equal(
    value.revision_summary.comparability_state,
    'PRIMARY_INTERPRETATION_COMPARABLE_WITH_AMBIGUITY_FLAG',
  );
  assert.equal(
    value.review_projection.market_comparison_state,
    'BLOCKED_PENDING_GOVERNED_RELEASE',
  );
  assert.equal(value.materialisation_status.comparison_blocked, true);
});

test('the former blocker becomes a review note rather than disappearing', () => {
  const status = fixture().materialisation_status;
  assert.deepEqual(status.blocker_codes, []);
  assert.deepEqual(status.review_note_codes, [
    'COPY_CLOCK_SOURCE_AMBIGUITY_RETAINED',
  ]);
  assert.equal(status.overall_resolution_state, 'RESOLVED_WITH_REVIEW_NOTE');
  assert.equal(status.materialisation_authority, 'REVIEW_IDENTITY_ONLY');
});

test('only the copy-clock child changes state', () => {
  assert.deepEqual(fixture().revision_summary.child_resolution_states, [
    {
      child_key: 'TRIGGER_EXPRESSION',
      resolution_state: 'RESOLVED_CLEAR',
    },
    {
      child_key: 'INITIAL_NOTICE_CLOCK_SCOPE',
      resolution_state: 'RESOLVED_CLEAR',
    },
    {
      child_key: 'COPY_CLOCK_SCOPE',
      resolution_state: 'RESOLVED_WITH_REVIEW_NOTE',
    },
    {
      child_key: 'DEFINITION_USES',
      resolution_state: 'RESOLVED_CLEAR',
    },
    {
      child_key: 'DEFINITION_DEPENDENCY',
      resolution_state: 'RESOLVED_WITH_REVIEW_NOTE',
    },
    {
      child_key: 'DEFINITION_SCOPE',
      resolution_state: 'RESOLVED_WITH_REVIEW_NOTE',
    },
  ]);
});

test('definition closure, relationships and direct evidence remain exact', () => {
  const revision = fixture().revision_summary;
  assert.equal(
    revision.definition_scope_closure_id,
    '58d8f42f20fc8be31af4a1b7b2e57a17b4da60894bffe61cb8ee5babacc76b17',
  );
  assert.equal(revision.definition_use_relationship_count, 30);
  assert.equal(revision.evidence_excerpt_count, 30);
  assert.ok(revision.evidence_excerpt_count <= 32);
});

test('V2 interpretation, clock, scope and revision identities are reminted', () => {
  const revision = fixture().revision_summary;
  assert.equal(
    fixture().interpretation_summary.schema_version,
    'NOTICE_CLOCK_INTERPRETATION/V2',
  );
  assert.equal(revision.copy_clock_schema_version, 'NOTICE_COPY_CLOCK_SCOPE/V2');
  assert.notEqual(
    revision.copy_clock_scope_id,
    revision.predecessor_copy_clock_scope_id,
  );
  assert.notEqual(
    revision.scope_closure_id,
    revision.predecessor_scope_closure_id,
  );
  assert.notEqual(
    revision.notice_obligation_revision_id,
    revision.predecessor_notice_obligation_revision_id,
  );
});

test('failure isolation retains the complete F14 review fallback', () => {
  assert.equal(fixture().failure_isolation_verified, true);
  const source = fs.readFileSync(MODULE, 'utf8');
  assert.match(source, /fallback_review_revision/);
  assert.match(source, /COPY_CLOCK_MATERIALISATION_FAILED/);
  assert.match(source, /COPY_CLOCK_ITEM_OR_BATCH_CARDINALITY_UNRESOLVED/);
  assert.match(source, /unaffected_child_keys/);
});

test('the F15 scope identity is recomputed and tamper-rejected', () => {
  const predecessor = {
    notice_occurrence: {
      exact_source_span: {
        absolute_start: 207783,
        absolute_end: 208859,
      },
    },
    notice_revision: {
      evidence_excerpt_ids: ['evidence-a', 'evidence-b'],
      scope_closure_id: 'predecessor-scope',
    },
  };
  const revision = {
    scope_closure_id: __test.buildScopeClosureId(predecessor),
  };
  assert.equal(
    __test.validateScopeClosureIdentity(revision, predecessor),
    true,
  );
  assert.throws(
    () => __test.validateScopeClosureIdentity({
      scope_closure_id: 'f'.repeat(64),
    }, predecessor),
    (error) => error?.code === 'SCOPE_CLOSURE_IDENTITY_MISMATCH',
  );
});

test('every live authority remains denied', () => {
  const status = fixture().materialisation_status;
  assert.equal(status.review_renderable, true);
  assert.equal(status.publication_blocked, true);
  assert.equal(status.release_eligible, false);
  for (const field of AUTHORITY_FIELDS) {
    assert.equal(status[field], 'NONE', field);
  }
});

test('all F15 identities are deterministic and bounded', () => {
  const value = fixture();
  assert.match(value.qxo_no_shop_copy_clock_f15_id, /^[a-f0-9]{64}$/);
  assert.match(value.canonical_payload_digest, /^[a-f0-9]{64}$/);
  assert.match(
    value.interpretation_summary.interpretation_payload_id,
    /^[a-f0-9]{64}$/,
  );
  assert.match(
    value.revision_summary.notice_obligation_revision_id,
    /^[a-f0-9]{64}$/,
  );
  assert.equal(MAX_CARRIER_BYTES, 256 * 1024);
});

test('F15 rejects contract, upstream, source and semantic drift', () => {
  const source = fs.readFileSync(MODULE, 'utf8');
  assert.match(source, /CONTRACT_BINDING_DRIFT/);
  assert.match(source, /UPSTREAM_BINDING_DRIFT/);
  assert.match(source, /SOURCE_BINDING_DRIFT/);
  assert.match(source, /PREDECESSOR_COPY_CLOCK_DRIFT/);
  assert.match(source, /PREDECESSOR_SEMANTIC_DRIFT/);
  assert.match(source, /CARRIER_IDENTITY_MISMATCH/);
});

test('the F15 attestation performs one bounded staging read with no write path', () => {
  const runner = fs.readFileSync(RUNNER, 'utf8');
  assert.match(runner, /--copy-clock-f15-print/);
  assert.match(runner, /--copy-clock-f15-verify/);
  assert.equal((runner.match(/function readCapture\(\)/g) || []).length, 1);
  assert.match(runner, /LIMIT 2/);
  assert.match(runner, /timeout: 90_000/);
  const source = fs.readFileSync(MODULE, 'utf8');
  assert.doesNotMatch(
    source,
    /supabase|fetch\(|canonicalWriter|writeSet|publication_authority: '(?!NONE)/,
  );
});
