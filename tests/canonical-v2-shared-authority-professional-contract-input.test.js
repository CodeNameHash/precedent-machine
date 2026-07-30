const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  compileCanonicalContractInput,
} = require('../lib/canonical-v2/canonical-contract-input-compiler');
const {
  validateAuthoredSharedAuthorityInputs,
} = require('../lib/canonical-v2/shared-authority-contract-input-validator');

const ROOT = path.join(__dirname, '../contracts/canonical-v2/successor');

const PATHS = [
  'shared/professionals/lawyer-firm-affiliation-relationship.v1.json',
  'shared/professionals/professional-assignment-relationship.v1.json',
];

function loadMember(relativePath) {
  const canonicalValue = JSON.parse(
    fs.readFileSync(path.join(ROOT, relativePath), 'utf8'),
  );
  return {
    object_kind: canonicalValue.object_kind,
    canonical_value: canonicalValue,
  };
}

function members() {
  return PATHS.map(loadMember);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function byId(values, stableId) {
  return values.find((member) => member.canonical_value.stable_id === stableId);
}

test('compiles professional assignments and affiliations without release authority', () => {
  const first = compileCanonicalContractInput({ root_directory: ROOT });
  const second = compileCanonicalContractInput({ root_directory: ROOT });

  assert.deepEqual(first, second);
  assert.deepEqual(
    first.authored_members
      .filter((member) => member.relative_path.startsWith('shared/professionals/'))
      .map((member) => member.stable_id),
    [
      'LAWYER_FIRM_AFFILIATION_RELATIONSHIP',
      'PROFESSIONAL_ASSIGNMENT_RELATIONSHIP',
    ],
  );
  assert.equal(
    first.authored_universe_assessment.status,
    'COMPLETE_AGAINST_GOVERNED_REQUIRED_KIND_REGISTRY',
  );
  assert.equal(first.disposition.status, 'AUTHORED_UNIVERSE_MECHANICALLY_COMPLETE');
  assert.equal(first.disposition.freeze_eligible, false);
  assert.equal(first.disposition.canonical_contract_bundle_authority, 'NONE');
});

test('accepts the exact professional assignment and affiliation contracts', () => {
  assert.doesNotThrow(() => validateAuthoredSharedAuthorityInputs(members()));
});

test('keeps counsel, advisers and named lawyers as separate assignments', () => {
  const assignment = byId(members(), 'PROFESSIONAL_ASSIGNMENT_RELATIONSHIP')
    .canonical_value.definition.type_contract;

  assert.ok(assignment.professional_roles.includes('LEGAL_COUNSEL'));
  assert.ok(assignment.professional_roles.includes('FINANCIAL_ADVISER'));
  assert.ok(assignment.professional_roles.includes('NAMED_LAWYER'));
  assert.equal(assignment.professional_endpoints_per_assignment_occurrence, 'EXACTLY_ONE');
  assert.equal(assignment.several_professionals_use_separate_occurrences, true);
  assert.equal(assignment.represented_endpoints_per_assignment_occurrence, 'EXACTLY_ONE');
});

test('does not infer missing advisers or copy assignments across bidder tracks', () => {
  const assignment = byId(members(), 'PROFESSIONAL_ASSIGNMENT_RELATIONSHIP')
    .canonical_value.definition.type_contract;

  assert.equal(assignment.silence_proves_no_adviser, false);
  assert.equal(assignment.no_adviser_stated_requires_positive_fact_evidence, true);
  assert.equal(
    assignment.absent_state_meaning,
    'NO_DISCLOSED_ASSIGNMENT_IN_COMPLETE_REQUIRED_SOURCE_SCOPE',
  );
  assert.equal(assignment.absent_state_proves_no_professional_engaged, false);
  assert.equal(assignment.role_inheritance_from_general_side_label, false);
  assert.equal(assignment.bidder_track_required_when_assignment_varies_by_bidder, true);
  assert.deepEqual(assignment.candidate_only_reasons, ['CONFLICTING_ASSIGNMENTS']);
});

test('requires exact source and time scope for a lawyer-firm affiliation', () => {
  const affiliation = byId(members(), 'LAWYER_FIRM_AFFILIATION_RELATIONSHIP')
    .canonical_value.definition.type_contract;

  assert.equal(affiliation.lawyer_endpoint_subject_class, 'NATURAL_PERSON');
  assert.equal(affiliation.law_firm_endpoint_classification, 'LAW_FIRM');
  assert.equal(affiliation.effective_time_expression_required, true);
  assert.equal(affiliation.name_match_sufficient, false);
  assert.equal(affiliation.firm_level_deal_assignment_sufficient, false);
  assert.equal(affiliation.text_proximity_sufficient, false);
  assert.equal(
    affiliation.professional_assignment_use_requires_matching_source_scope,
    true,
  );
  assert.equal(
    affiliation.professional_assignment_use_requires_matching_time_scope,
    true,
  );
});

test('keeps unresolved lawyer names visible but blocks a canonical firm filter', () => {
  const affiliation = byId(members(), 'LAWYER_FIRM_AFFILIATION_RELATIONSHIP')
    .canonical_value.definition.type_contract;

  assert.equal(affiliation.unresolved_source_local_lawyer_name_remains_displayable, true);
  assert.equal(affiliation.unresolved_affiliation_blocks_canonical_firm_filter, true);
});

test('rejects side-label inheritance and name-only affiliation', () => {
  const inherited = clone(byId(members(), 'PROFESSIONAL_ASSIGNMENT_RELATIONSHIP'));
  inherited.canonical_value.definition.type_contract
    .role_inheritance_from_general_side_label = true;
  assert.throws(
    () => validateAuthoredSharedAuthorityInputs([inherited]),
    (error) => error.code === 'INVALID_SHARED_AUTHORITY_LOGICAL_TYPE_INPUT',
  );

  const nameOnly = clone(byId(members(), 'LAWYER_FIRM_AFFILIATION_RELATIONSHIP'));
  nameOnly.canonical_value.definition.type_contract.name_match_sufficient = true;
  assert.throws(
    () => validateAuthoredSharedAuthorityInputs([nameOnly]),
    (error) => error.code === 'INVALID_SHARED_AUTHORITY_LOGICAL_TYPE_INPUT',
  );
});

test('rejects value-derived professional identity and combined professional arrays', () => {
  const valueIdentity = clone(byId(members(), 'PROFESSIONAL_ASSIGNMENT_RELATIONSHIP'));
  valueIdentity.canonical_value.definition.occurrence_identity.stable_id_inputs[0] =
    'professional_entity_id';
  assert.throws(
    () => validateAuthoredSharedAuthorityInputs([valueIdentity]),
    (error) => error.code === 'SHARED_AUTHORITY_VALUE_DERIVED_OCCURRENCE_ID',
  );

  const combined = clone(byId(members(), 'PROFESSIONAL_ASSIGNMENT_RELATIONSHIP'));
  combined.canonical_value.definition.type_contract
    .professional_endpoints_per_assignment_occurrence = 'ONE_OR_MORE';
  assert.throws(
    () => validateAuthoredSharedAuthorityInputs([combined]),
    (error) => error.code === 'INVALID_SHARED_AUTHORITY_LOGICAL_TYPE_INPUT',
  );

  const falseAbsence = clone(byId(members(), 'PROFESSIONAL_ASSIGNMENT_RELATIONSHIP'));
  falseAbsence.canonical_value.definition.type_contract
    .absent_state_proves_no_professional_engaged = true;
  assert.throws(
    () => validateAuthoredSharedAuthorityInputs([falseAbsence]),
    (error) => error.code === 'INVALID_SHARED_AUTHORITY_LOGICAL_TYPE_INPUT',
  );
});
