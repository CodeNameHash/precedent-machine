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

const TRANSACTION_PATHS = [
  'shared/transactions/deal-participant-relationship.v1.json',
  'shared/transactions/share-purchase-interest-component.v1.json',
  'shared/transactions/source-transaction-leg-occurrence.v1.json',
  'shared/transactions/transaction-control-outcome-occurrence.v1.json',
  'shared/transactions/transaction-leg-resolution-occurrence.v1.json',
  'shared/transactions/transaction-structure-resolution-occurrence.v1.json',
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
  return TRANSACTION_PATHS.map(loadMember);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function byId(values, stableId) {
  return values.find((member) => member.canonical_value.stable_id === stableId);
}

test('compiles all six transaction contract inputs without granting release authority', () => {
  const first = compileCanonicalContractInput({ root_directory: ROOT });
  const second = compileCanonicalContractInput({ root_directory: ROOT });

  assert.deepEqual(first, second);
  assert.deepEqual(
    first.authored_members
      .filter((member) => member.relative_path.startsWith('shared/transactions/'))
      .map((member) => member.stable_id),
    [
      'CONSIDERATION_PACKAGE',
      'DEAL_PARTICIPANT_RELATIONSHIP',
      'SHARE_PURCHASE_INTEREST_COMPONENT',
      'SOURCE_TRANSACTION_LEG_OCCURRENCE',
      'TRANSACTION_CONTROL_OUTCOME_OCCURRENCE',
      'TRANSACTION_LEG_RESOLUTION_OCCURRENCE',
      'TRANSACTION_STRUCTURE_RESOLUTION_OCCURRENCE',
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

test('accepts the exact participant, leg, structure, control and share-purchase contracts', () => {
  assert.doesNotThrow(() => validateAuthoredSharedAuthorityInputs(members()));
});

test('permits a merger of equals without inventing Target or Buyer', () => {
  const participant = byId(members(), 'DEAL_PARTICIPANT_RELATIONSHIP')
    .canonical_value.definition.type_contract;

  assert.equal(participant.target_and_buyer_optional, true);
  assert.equal(participant.combination_party_permitted_without_target_or_buyer, true);
  assert.ok(participant.transaction_roles.includes('COMBINATION_PARTY'));
});

test('keeps reverse merger, reverse triangular merger and control separate', () => {
  const values = members();
  const structure = byId(values, 'TRANSACTION_STRUCTURE_RESOLUTION_OCCURRENCE')
    .canonical_value.definition.type_contract;
  const participant = byId(values, 'DEAL_PARTICIPANT_RELATIONSHIP')
    .canonical_value.definition.type_contract;
  const control = byId(values, 'TRANSACTION_CONTROL_OUTCOME_OCCURRENCE')
    .canonical_value.definition.type_contract;

  assert.ok(structure.legal_structure_codes.includes('REVERSE_MERGER'));
  assert.ok(structure.legal_structure_codes.includes('REVERSE_TRIANGULAR_MERGER'));
  assert.equal(structure.reverse_merger_is_not_reverse_triangular_merger, true);
  assert.equal(participant.surviving_entity_infers_buyer, false);
  assert.equal(participant.share_issuer_infers_buyer, false);
  assert.equal(control.surviving_entity_infers_control, false);
  assert.equal(control.share_issuer_infers_control, false);
});

test('requires separate Reverse Morris Trust and tender-offer steps', () => {
  const structure = byId(members(), 'TRANSACTION_STRUCTURE_RESOLUTION_OCCURRENCE')
    .canonical_value.definition.type_contract;

  assert.deepEqual(structure.required_separate_leg_groups.REVERSE_MORRIS_TRUST, [
    ['DISTRIBUTION_OR_SPIN_OFF'],
    ['CONTRIBUTION', 'OTHER_GOVERNED_STEP'],
    [
      'DIRECT_MERGER',
      'FORWARD_TRIANGULAR_MERGER',
      'REVERSE_TRIANGULAR_MERGER',
      'OTHER_GOVERNED_STEP',
    ],
  ]);
  assert.deepEqual(
    structure.required_separate_leg_groups.TENDER_OFFER_WITH_SECOND_STEP_MERGER,
    [['TENDER_OFFER'], ['SECOND_STEP_MERGER']],
  );
  assert.equal(
    structure.rmt_requires_stated_distribution_reorganisation_and_merger,
    true,
  );
  assert.equal(structure.new_holdco_infers_buyer, false);
  assert.equal(structure.new_holdco_infers_control, false);
});

test('keeps each share purchase endpoint, interest and consideration together', () => {
  const component = byId(members(), 'SHARE_PURCHASE_INTEREST_COMPONENT')
    .canonical_value.definition.type_contract;

  assert.deepEqual(component.required_endpoint_roles, [
    'BUYER',
    'ACQUIRED_ENTITY',
    'SELLING_SHAREHOLDER',
  ]);
  assert.equal(component.security_class_required_when_present, true);
  assert.equal(component.amount_or_percentage_preserved_when_stated, true);
  assert.equal(component.consideration_bound_to_component, true);
  assert.equal(component.independent_parallel_arrays_permitted, false);
  assert.equal(component.converts_to_asset_acquisition, false);
});

test('rejects false buyer, false control and collapsed structure rules', () => {
  const falseBuyer = clone(byId(members(), 'DEAL_PARTICIPANT_RELATIONSHIP'));
  falseBuyer.canonical_value.definition.type_contract.surviving_entity_infers_buyer = true;
  assert.throws(
    () => validateAuthoredSharedAuthorityInputs([falseBuyer]),
    (error) => error.code === 'INVALID_SHARED_AUTHORITY_LOGICAL_TYPE_INPUT',
  );

  const falseControl = clone(byId(members(), 'TRANSACTION_CONTROL_OUTCOME_OCCURRENCE'));
  falseControl.canonical_value.definition.type_contract.share_issuer_infers_control = true;
  assert.throws(
    () => validateAuthoredSharedAuthorityInputs([falseControl]),
    (error) => error.code === 'INVALID_SHARED_AUTHORITY_LOGICAL_TYPE_INPUT',
  );

  const collapsedRmt = clone(
    byId(members(), 'TRANSACTION_STRUCTURE_RESOLUTION_OCCURRENCE'),
  );
  collapsedRmt.canonical_value.definition.type_contract
    .required_separate_leg_groups.REVERSE_MORRIS_TRUST.pop();
  assert.throws(
    () => validateAuthoredSharedAuthorityInputs([collapsedRmt]),
    (error) => error.code === 'INVALID_SHARED_AUTHORITY_LOGICAL_TYPE_INPUT',
  );
});

test('rejects value-derived share-purchase identity and asset reclassification', () => {
  const valueIdentity = clone(byId(members(), 'SHARE_PURCHASE_INTEREST_COMPONENT'));
  valueIdentity.canonical_value.definition.occurrence_identity.stable_id_inputs[0] =
    'consideration';
  assert.throws(
    () => validateAuthoredSharedAuthorityInputs([valueIdentity]),
    (error) => error.code === 'SHARED_AUTHORITY_VALUE_DERIVED_OCCURRENCE_ID',
  );

  const assetConversion = clone(byId(members(), 'SHARE_PURCHASE_INTEREST_COMPONENT'));
  assetConversion.canonical_value.definition.type_contract.converts_to_asset_acquisition = true;
  assert.throws(
    () => validateAuthoredSharedAuthorityInputs([assetConversion]),
    (error) => error.code === 'INVALID_SHARED_AUTHORITY_LOGICAL_TYPE_INPUT',
  );
});
