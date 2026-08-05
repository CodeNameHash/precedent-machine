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
  AUTHORITY_SCOPE,
  MAX_CARRIER_BYTES,
  validateQxoNoShopDefinitionControlF11CarrierIdentity,
} = require('../lib/canonical-v2/qxo-no-shop-definition-control-f11');

const MODULE =
  'lib/canonical-v2/qxo-no-shop-definition-control-f11.js';
const RUNNER =
  'scripts/canonical-v2-staging-qxo-no-shop-clock-attestation.mjs';
const FIXTURE =
  'tests/fixtures/canonical-v2/qxo-no-shop-definition-control-f11-staging-attestation.json';
const ALLOWLIST =
  '.github/phase-allowlists/wp-canonical-qxo-no-shop-definition-control-f11.json';

function fixture() {
  return JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
}

function carrier() {
  const body = {
    schema_version: 'QXO_NO_SHOP_DEFINITION_CONTROL_F11/V1',
    authority_scope: AUTHORITY_SCOPE,
    contract_binding: {},
    source_binding: {},
    upstream_bindings: {},
    scan_policy: {},
    definition_control_scans: [],
    relationship_outcomes: [],
    notice_revision_materialisation: {},
    status: {},
  };
  return {
    ...body,
    qxo_no_shop_definition_control_f11_id: contentId(
      'QXO_NO_SHOP_DEFINITION_CONTROL_F11/V1',
      body,
    ),
    canonical_payload_digest: contentId(
      'QXO_NO_SHOP_DEFINITION_CONTROL_F11_PAYLOAD/V1',
      body,
    ),
  };
}

test('the F11 carrier is closed, bounded and deterministic', () => {
  const first = carrier();
  assert.equal(canonicalJson(first), canonicalJson(carrier()));
  assert.equal(
    validateQxoNoShopDefinitionControlF11CarrierIdentity(first),
    true,
  );
  const changed = JSON.parse(JSON.stringify(first));
  changed.status.release_eligible = true;
  assert.throws(
    () => validateQxoNoShopDefinitionControlF11CarrierIdentity(changed),
    /identity has drifted/i,
  );

  const oversizedBody = {
    ...first,
    status: { retained: 'x'.repeat(MAX_CARRIER_BYTES) },
  };
  delete oversizedBody.qxo_no_shop_definition_control_f11_id;
  delete oversizedBody.canonical_payload_digest;
  const oversized = {
    ...oversizedBody,
    qxo_no_shop_definition_control_f11_id: contentId(
      'QXO_NO_SHOP_DEFINITION_CONTROL_F11/V1',
      oversizedBody,
    ),
    canonical_payload_digest: contentId(
      'QXO_NO_SHOP_DEFINITION_CONTROL_F11_PAYLOAD/V1',
      oversizedBody,
    ),
  };
  assert.throws(
    () => validateQxoNoShopDefinitionControlF11CarrierIdentity(oversized),
    /exceeds its byte limit/i,
  );
});

test('the complete-document scan resolves both selected definition controls', () => {
  const attestation = fixture();
  assert.equal(attestation.environment, 'STAGING');
  assert.equal(attestation.authority_scope, AUTHORITY_SCOPE);
  assert.equal(
    attestation.scan_policy.scan_scope,
    'COMPLETE_CANONICAL_TEXT',
  );
  assert.equal(
    attestation.scan_policy.coordinate_space,
    'ADMITTED_SOURCE_UTF8_BYTES',
  );
  assert.equal(attestation.definition_control_scans.length, 2);
  const byKey = new Map(attestation.definition_control_scans.map(
    (scan) => [scan.definition_key, scan],
  ));
  const request = byKey.get('COMPANY_REQUEST');
  const proposal = byKey.get('COMPANY_ACQUISITION_PROPOSAL');
  assert.deepEqual(
    [request.term_occurrence_count, request.declaration_candidate_count],
    [8, 1],
  );
  assert.deepEqual(
    [proposal.term_occurrence_count, proposal.declaration_candidate_count],
    [50, 1],
  );
  for (const scan of byKey.values()) {
    assert.equal(scan.competing_declaration_count, 0);
    assert.equal(scan.conclusion_code, 'CONTROLLING_DEFINITION_CONFIRMED');
    assert.match(scan.scope_closure_id, /^[a-f0-9]{64}$/);
    assert.equal(scan.full_document_span.absolute_start, 0);
    assert.equal(scan.full_document_span.absolute_end, 414782);
    assert.match(scan.term_occurrence_inventory_digest, /^[a-f0-9]{64}$/);
    assert.equal(scan.definition_index_evidence_spans.length, 1);
  }
  assert.deepEqual(
    request.occurrence_classification_counts.map(
      (entry) => entry.occurrence_count,
    ),
    [1, 0, 1, 6],
  );
  assert.deepEqual(
    proposal.occurrence_classification_counts.map(
      (entry) => entry.occurrence_count,
    ),
    [1, 1, 1, 47],
  );
});

test('the termination-fee override is retained but excluded from the notice scope', () => {
  const proposal = fixture().definition_control_scans.find(
    (scan) => scan.definition_key === 'COMPANY_ACQUISITION_PROPOSAL',
  );
  assert.equal(proposal.local_override_count, 1);
  assert.equal(
    proposal.local_override_scope,
    'SECTION_6_5_B_TERMINATION_FEE_CLAUSE_ONLY',
  );
  assert.equal(proposal.local_override_evidence_spans.length, 1);
  assert.equal(
    proposal.selected_scope_code,
    'AGREEMENT_WIDE_SECTION_4_3_E_DEFINITION',
  );
  assert.match(proposal.interpretation_note, /solely/i);
  assert.match(proposal.interpretation_note, /does not govern the notice/i);
});

test('the plural use is source-local and never becomes an alias', () => {
  const attestation = fixture();
  const request = attestation.definition_control_scans.find(
    (scan) => scan.definition_key === 'COMPANY_REQUEST',
  );
  assert.equal(request.separately_defined_plural_count, 0);
  assert.equal(request.plural_term_occurrence_count, 2);
  const plural = attestation.controlled_relationships.find(
    (relationship) => relationship.raw_use_form === 'Company Requests',
  );
  assert.equal(
    plural.use_form_code,
    'DECLARED_TERM_PLUS_ASCII_LOWERCASE_S',
  );
  assert.equal(plural.alias_authority, 'NONE');
  assert.match(request.interpretation_note, /source-local inflection/i);
});

test('all seven stable occurrences receive successor effects with clear control', () => {
  const relationships = fixture().controlled_relationships;
  assert.equal(relationships.length, 7);
  assert.equal(new Set(relationships.map(
    (relationship) => relationship.relationship_occurrence_id,
  )).size, 7);
  assert.equal(new Set(relationships.map(
    (relationship) => relationship.relationship_effect_revision_id,
  )).size, 7);
  for (const relationship of relationships) {
    assert.equal(
      relationship.definition_precedence_review,
      'CONTROLLING_DEFINITION_CONFIRMED',
    );
    assert.equal(relationship.interpretation_clarity_state, 'CLEAR');
    assert.deepEqual(relationship.ambiguity_dimension_codes, []);
    assert.equal(
      relationship.comparison_state,
      'ALLOWED_IF_DEPENDENT_NOTICE_COMPLETE',
    );
    assert.equal(
      relationship.publication_state,
      'REVIEWED_CONTROL_CONFIRMED_NOT_WRITTEN',
    );
  }
  const nestedProposal = relationships.find(
    (relationship) => (
      relationship.predecessor_relationship_effect_revision_id
        === '52a0ec7900227c2d88907ee8e0d0880be4705759c530bad39dd55307e6344efc'
    ),
  );
  for (const relationship of relationships.filter(
    (entry) => entry.raw_use_form.startsWith('Company Request'),
  )) {
    assert.deepEqual(
      relationship.recursive_dependency_relationship_ids,
      [nestedProposal.relationship_effect_revision_id],
    );
  }
});

test('F11 removes only the precedence blocker and grants no live authority', () => {
  const status = fixture().materialisation_status;
  assert.equal(
    status.definition_precedence_state,
    'CONTROLLING_DEFINITION_CONFIRMED',
  );
  assert.equal(
    status.blocker_codes.includes(
      'DEFINITION_PRECEDENCE_CONFLICT_AND_OVERRIDE_SCAN_UNRESOLVED',
    ),
    false,
  );
  assert.deepEqual(status.blocker_codes, [
    'COPY_CLOCK_ITEM_OR_BATCH_CARDINALITY_UNRESOLVED',
    'NOTICE_COMPLETE_DEFINITION_SCOPE_UNRESOLVED',
    'NOTICE_REVISION_MATERIALISATION_DEFERRED',
  ]);
  assert.equal(status.publication_blocked, true);
  assert.equal(status.comparison_blocked, true);
  assert.equal(status.relationship_authority, 'REVIEW_IDENTITY_ONLY');
  for (const key of [
    'absence_authority',
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
  assert.equal(status.release_eligible, false);
});

test('the F11 proof is one bounded staging read with no writer or serving path', () => {
  assert.equal(fixture().carrier_drift_rejected, true);
  assert.equal(fixture().source_drift_rejected, true);
  const runner = withoutF20RollbackOnlyCertification(
    fs.readFileSync(RUNNER, 'utf8'),
  );
  assert.match(runner, /--definition-control-f11-verify/);
  assert.match(runner, /LIMIT 2/);
  assert.match(runner, /timeout: 90_000/);
  assert.equal((runner.match(/function readCapture\(\)/g) || []).length, 1);
  assert.doesNotMatch(
    runner,
    /\b(?:INSERT\s+INTO|UPDATE\s+\S+\s+SET|DELETE\s+FROM|UPSERT\s+INTO|CREATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE|TRUNCATE\s+TABLE)\b/i,
  );

  const moduleSource = fs.readFileSync(MODULE, 'utf8');
  assert.doesNotMatch(
    moduleSource,
    /(?:supabase|canonical-writer|candidate-release|serving-projection|lib\/query)/i,
  );
  const allowlist = JSON.parse(fs.readFileSync(ALLOWLIST, 'utf8'));
  for (const denied of [
    'lib/canonical-v2/canonical-writer.js',
    'lib/canonical-v2/candidate-release.js',
    'lib/canonical-v2/serving-projection.js',
    'sql/**',
    'supabase/**',
  ]) {
    assert.equal(allowlist.denied.includes(denied), true, denied);
  }
});
