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
  'shared/deal-facts/deal-fact-resolution-occurrence.v1.json',
  'shared/deal-facts/source-deal-fact-occurrence.v1.json',
  'shared/temporal/temporal-expression.v1.json',
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

test('compiles source facts, resolved facts and temporal expressions without release authority', () => {
  const first = compileCanonicalContractInput({ root_directory: ROOT });
  const second = compileCanonicalContractInput({ root_directory: ROOT });

  assert.deepEqual(first, second);
  assert.deepEqual(
    first.authored_members
      .filter((member) => (
        member.relative_path.startsWith('shared/deal-facts/')
        || member.relative_path.startsWith('shared/temporal/')
      ))
      .map((member) => member.stable_id),
    [
      'DEAL_FACT_RESOLUTION_OCCURRENCE',
      'SOURCE_DEAL_FACT_OCCURRENCE',
      'TEMPORAL_EXPRESSION',
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

test('accepts the exact source-fact, resolved-fact and temporal contracts', () => {
  assert.doesNotThrow(() => validateAuthoredSharedAuthorityInputs(members()));
});

test('keeps press-release values, value bases and CVR economics separate', () => {
  const source = byId(members(), 'SOURCE_DEAL_FACT_OCCURRENCE')
    .canonical_value.definition.type_contract;

  assert.ok(source.source_roles.includes('ANNOUNCEMENT_PRESS_RELEASE'));
  assert.equal(source.announcement_release_preferred_for_stated_headline_value, true);
  assert.equal(source.preferred_source_silently_overrides_other_sources, false);
  assert.equal(source.different_basis_is_automatic_conflict, false);
  assert.ok(source.value_types.includes('EQUITY_VALUE'));
  assert.ok(source.value_types.includes('ENTERPRISE_VALUE'));
  assert.ok(source.value_types.includes('CVR_MAXIMUM_PAYMENT'));
  assert.ok(source.value_types.includes('CVR_EXPECTED_PAYMENT'));
  assert.equal(source.cvr_expected_payment_requires_later_governed_method, true);
});

test('requires complete source selection and a registered normalised-equity derivation', () => {
  const resolution = byId(members(), 'DEAL_FACT_RESOLUTION_OCCURRENCE')
    .canonical_value.definition.type_contract;

  assert.equal(resolution.complete_ordered_source_revision_set_required, true);
  assert.equal(
    resolution.unresolved_conflict_blocks_filter_group_sort_and_denominator,
    true,
  );
  assert.deepEqual(resolution.candidate_only_dispositions, ['UNRESOLVED_CONFLICT']);
  assert.equal(
    resolution.registered_derivation_required_for_normalised_equity_value,
    true,
  );
  assert.ok(
    resolution.normalised_equity_derivation_inputs
      .includes('EXACT_SOURCE_EVIDENCE_FOR_EACH_INPUT'),
  );
  assert.equal(resolution.enterprise_value_can_be_renamed_equity_value, false);
  assert.equal(resolution.cvr_ceiling_can_be_treated_as_certain_cash, false);
  assert.equal(
    resolution.target_paid_dividend_requires_approved_inclusion_rule,
    true,
  );
  assert.equal(resolution.incompatible_dates_can_be_combined, false);
  assert.equal(resolution.unexplained_share_count_permitted, false);
  assert.equal(resolution.cross_deal_derivation_input_permitted, false);
});

test('starts the temporal node registry empty and preserves raw expressions', () => {
  const temporal = byId(members(), 'TEMPORAL_EXPRESSION')
    .canonical_value.definition.type_contract;

  assert.ok(temporal.consumer_domains.includes('PROCESS_EVENT'));
  assert.ok(temporal.consumer_domains.includes('CVR_MILESTONE'));
  assert.deepEqual(temporal.structured_node_registry, []);
  assert.equal(temporal.raw_source_expression_required, true);
  assert.equal(temporal.structured_node_release_permitted, false);
  assert.equal(temporal.pilot_can_record_raw_expressions, true);
  assert.equal(temporal.pilot_can_certify_structured_nodes, false);
  assert.equal(temporal.runtime_node_admission_permitted, false);
  assert.equal(temporal.new_node_requires_successor_contract_and_fixtures, true);
  assert.equal(temporal.computed_value_replaces_source_expression, false);
});

test('rejects silent source override and invented economic conversions', () => {
  const override = clone(byId(members(), 'SOURCE_DEAL_FACT_OCCURRENCE'));
  override.canonical_value.definition.type_contract
    .preferred_source_silently_overrides_other_sources = true;
  assert.throws(
    () => validateAuthoredSharedAuthorityInputs([override]),
    (error) => error.code === 'INVALID_SHARED_AUTHORITY_LOGICAL_TYPE_INPUT',
  );

  const renamed = clone(byId(members(), 'DEAL_FACT_RESOLUTION_OCCURRENCE'));
  renamed.canonical_value.definition.type_contract
    .enterprise_value_can_be_renamed_equity_value = true;
  assert.throws(
    () => validateAuthoredSharedAuthorityInputs([renamed]),
    (error) => error.code === 'INVALID_SHARED_AUTHORITY_LOGICAL_TYPE_INPUT',
  );

  const cvrCash = clone(byId(members(), 'DEAL_FACT_RESOLUTION_OCCURRENCE'));
  cvrCash.canonical_value.definition.type_contract
    .cvr_ceiling_can_be_treated_as_certain_cash = true;
  assert.throws(
    () => validateAuthoredSharedAuthorityInputs([cvrCash]),
    (error) => error.code === 'INVALID_SHARED_AUTHORITY_LOGICAL_TYPE_INPUT',
  );
});

test('rejects a runtime temporal node and a value-derived fact identity', () => {
  const temporalNode = clone(byId(members(), 'TEMPORAL_EXPRESSION'));
  temporalNode.canonical_value.definition.type_contract
    .structured_node_registry.push('UNREVIEWED_NODE');
  assert.throws(
    () => validateAuthoredSharedAuthorityInputs([temporalNode]),
    (error) => error.code === 'INVALID_SHARED_AUTHORITY_LOGICAL_TYPE_INPUT',
  );

  const valueIdentity = clone(byId(members(), 'SOURCE_DEAL_FACT_OCCURRENCE'));
  valueIdentity.canonical_value.definition.occurrence_identity.stable_id_inputs[0] =
    'canonical_value';
  assert.throws(
    () => validateAuthoredSharedAuthorityInputs([valueIdentity]),
    (error) => error.code === 'SHARED_AUTHORITY_VALUE_DERIVED_OCCURRENCE_ID',
  );
});
