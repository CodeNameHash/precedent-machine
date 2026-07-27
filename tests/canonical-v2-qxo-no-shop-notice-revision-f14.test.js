const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const {
  AUTHORITY_FIELDS,
  AUTHORITY_SCOPE,
  MAX_CARRIER_BYTES,
  REMAINING_BLOCKER,
  __test,
} = require('../lib/canonical-v2/qxo-no-shop-notice-revision-f14');

const FIXTURE =
  'tests/fixtures/canonical-v2/qxo-no-shop-notice-revision-f14-staging-attestation.json';
const MODULE =
  'lib/canonical-v2/qxo-no-shop-notice-revision-f14.js';
const RUNNER =
  'scripts/canonical-v2-staging-qxo-no-shop-clock-attestation.mjs';

function fixture() {
  return JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
}

test('F14 binds the frozen V10 contract and materialises one V5 revision', () => {
  const value = fixture();
  assert.equal(value.environment, 'STAGING');
  assert.equal(value.authority_scope, AUTHORITY_SCOPE);
  assert.equal(
    value.contract_binding.contract_fingerprint,
    'aee4b40ead2e76ed744b0f20967a48493c618125959a023f8262612da23aa0e5',
  );
  assert.equal(value.contract_binding.notice_schema_version, 5);
  assert.equal(
    value.revision_summary.schema_version,
    'NO_SHOP_NOTICE_OBLIGATION/V5',
  );
  assert.match(
    value.revision_summary.notice_obligation_revision_id,
    /^[a-f0-9]{64}$/,
  );
  assert.equal(value.materialisation_status.revision_materialised, true);
});

test('the stable notice occurrence remains the revision anchor', () => {
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
  assert.deepEqual(value.notice_occurrence.party, {
    capacity: 'TARGET',
    role: 'COVENANT_OBLIGOR',
    value: 'COMPANY',
  });
});

test('F14 remints the overall scope while retaining the exact F13 closure', () => {
  const revision = fixture().revision_summary;
  assert.match(revision.scope_closure_id, /^[a-f0-9]{64}$/);
  assert.notEqual(
    revision.scope_closure_id,
    revision.predecessor_scope_closure_id,
  );
  assert.equal(
    revision.definition_scope_closure_id,
    '58d8f42f20fc8be31af4a1b7b2e57a17b4da60894bffe61cb8ee5babacc76b17',
  );
});

test('the revision binds the complete sorted F13 relationship set', () => {
  const revision = fixture().revision_summary;
  assert.equal(revision.definition_use_relationship_count, 30);
  assert.equal(
    revision.definition_use_relationship_ids_digest,
    'dd580ad0c42882311b379f75df9a6b86e9018ed39db0acf715e91e0dddd5f29c',
  );
});

test('notice evidence stays direct and bounded instead of absorbing definition evidence', () => {
  const revision = fixture().revision_summary;
  assert.equal(revision.evidence_excerpt_count, 30);
  assert.ok(revision.evidence_excerpt_count <= 32);
  assert.equal(
    revision.evidence_excerpt_ids_digest,
    'c7b61d29e7364682ad76c3b4285c3f867f39b6d3d2d314b1e4d9402df3ecc691',
  );
});

test('all six child states are mechanically assembled', () => {
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
      resolution_state: 'BLOCKING_UNRESOLVED',
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

test('definition child states are derived from F13 rather than independently relabelled', () => {
  assert.deepEqual(__test.deriveChildResolutionStates({
    notice_child_state_projection: {
      child_resolution_states: [
        {
          child_key: 'DEFINITION_SCOPE',
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
      ],
    },
  }), fixture().revision_summary.child_resolution_states);
});

test('the approved receipt interpretation and visible ambiguity survive unchanged', () => {
  const value = fixture();
  assert.equal(
    value.revision_summary.primary_receipt_interpretation_code,
    'RECEIPT_OF_PRIOR_CLAUSE_COMPANY_ACQUISITION_PROPOSAL_OR_COMPANY_REQUEST',
  );
  assert.equal(value.review_projection.ambiguity_flag_visible, true);
  assert.equal(
    value.revision_summary.item_or_batch_cardinality_state,
    'UNRESOLVED',
  );
  assert.equal(
    value.revision_summary.copy_clock_resolution_state,
    'BLOCKING_UNRESOLVED',
  );
});

test('F14 removes only revision deferral and preserves the real blocker', () => {
  const status = fixture().materialisation_status;
  assert.deepEqual(status.blocker_codes, [REMAINING_BLOCKER]);
  assert.equal(
    status.blocker_codes.includes('NOTICE_REVISION_MATERIALISATION_DEFERRED'),
    false,
  );
  assert.equal(status.overall_resolution_state, 'BLOCKING_UNRESOLVED');
  assert.equal(status.materialisation_authority, 'REVIEW_IDENTITY_ONLY');
});

test('review renders while every live authority remains denied', () => {
  const value = fixture();
  const status = value.materialisation_status;
  assert.equal(value.review_projection.renderable, true);
  assert.equal(value.review_projection.reviewed_terminal_outcome_count, 11);
  assert.equal(value.review_projection.comparison_state, 'BLOCKED');
  assert.equal(status.review_renderable, true);
  assert.equal(status.publication_blocked, true);
  assert.equal(status.comparison_blocked, true);
  assert.equal(status.release_eligible, false);
  for (const field of AUTHORITY_FIELDS) {
    assert.equal(status[field], 'NONE', field);
  }
});

test('a revision assembly failure remains isolated from review rendering', () => {
  assert.equal(fixture().failure_isolation_verified, true);
  const source = fs.readFileSync(MODULE, 'utf8');
  assert.match(source, /NOTICE_REVISION_MATERIALISATION_FAILED/);
  assert.match(source, /failed_component_code/);
  assert.match(source, /unaffected_child_keys/);
});

test('F14 rejects upstream drift and cardinality upgrades', () => {
  const source = fs.readFileSync(MODULE, 'utf8');
  assert.match(source, /UPSTREAM_BINDING_DRIFT/);
  assert.match(source, /SOURCE_BINDING_DRIFT/);
  assert.match(source, /RELATIONSHIP_SET_MISMATCH/);
  assert.match(source, /COPY_CLOCK_AUTHORITY_DRIFT/);
  assert.match(source, /item_or_batch_cardinality_state[\s\S]*'UNRESOLVED'/);
  assert.match(source, /resolution_state[\s\S]*'BLOCKING_UNRESOLVED'/);
});

test('revision and carrier identities are content-addressed and bounded', () => {
  const source = fs.readFileSync(MODULE, 'utf8');
  assert.match(
    source,
    /contentId\(\s*'NO_SHOP_NOTICE_OBLIGATION\/V5'/,
  );
  assert.match(
    source,
    /contentId\(\s*'QXO_NO_SHOP_NOTICE_SCOPE_F14\/V1'/,
  );
  assert.match(source, /CARRIER_IDENTITY_MISMATCH/);
  assert.equal(MAX_CARRIER_BYTES, 256 * 1024);
  assert.match(fixture().qxo_no_shop_notice_revision_f14_id, /^[a-f0-9]{64}$/);
  assert.match(fixture().canonical_payload_digest, /^[a-f0-9]{64}$/);
});

test('the F14 attestation performs one bounded staging read with no write path', () => {
  const runner = fs.readFileSync(RUNNER, 'utf8');
  assert.match(runner, /--notice-revision-f14-print/);
  assert.match(runner, /--notice-revision-f14-verify/);
  assert.equal((runner.match(/function readCapture\(\)/g) || []).length, 1);
  assert.match(runner, /LIMIT 2/);
  assert.match(runner, /timeout: 90_000/);
  const source = fs.readFileSync(MODULE, 'utf8');
  assert.doesNotMatch(
    source,
    /supabase|fetch\(|canonicalWriter|writeSet|publication_authority: '(?!NONE)/,
  );
});
