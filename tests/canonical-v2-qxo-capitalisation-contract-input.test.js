const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  validateAuthoredRelationshipInputs,
} = require('../lib/canonical-v2/canonical-contract-relationship-input-validator');
const {
  validateAuthoredTechnicalRelationshipInputs,
} = require('../lib/canonical-v2/canonical-contract-technical-relationship-validator');
const {
  FIXTURE_CONTRACT_FINGERPRINT_V13,
} = require('../lib/canonical-v2/contract-bundle');
const {
  FROZEN_QXO_REVIEW_CONTRACT_FINGERPRINT,
  validateAuthoredQxoCapitalisationInputs,
} = require('../lib/canonical-v2/qxo-capitalisation-contract-input-validator');

const ROOT = path.join(
  __dirname,
  '..',
  'contracts',
  'canonical-v2',
  'successor',
);
const PATHS = [
  'agreement/claim-definitions/general-materiality-qualifier.v1.json',
  'agreement/claim-definitions/representation-measurement-date.v1.json',
  'agreement/claim-definitions/retrospective-lookback.v1.json',
  'agreement/relationship-definitions/brings-down.v3.json',
  'agreement/relationship-definitions/uses-definition.v4.json',
  'agreement/relationship-effect-schemas/brings-down-effect.v2.json',
  'agreement/relationship-effect-schemas/uses-definition-effect.v3.json',
  'agreement/capitalisation-semantic-schema-inputs/capitalisation-representation.v1.json',
  'agreement/result-definitions/target-capitalisation-bring-down.v3.json',
  'agreement/market-metric-definitions/representation-accuracy-standard.v3.json',
  'agreement/market-metric-definitions/representation-accuracy-exception.v1.json',
  'agreement/market-metric-definitions/representation-accuracy-exception-denominator.v1.json',
  'agreement/market-metric-definitions/dated-representation-treatment.v1.json',
  'agreement/market-metric-definitions/representation-materiality-scrape.v1.json',
  'agreement/market-metric-definitions/representation-measurement-date-signing-offset.v1.json',
  'agreement/market-metric-definitions/knowledge-qualifier-state.v1.json',
  'agreement/market-metric-definitions/general-materiality-qualifier-state.v1.json',
  'agreement/market-metric-definitions/retrospective-lookback-state.v1.json',
];

function members() {
  return PATHS.map((relativePath) => {
    const canonicalValue = JSON.parse(
      fs.readFileSync(path.join(ROOT, relativePath), 'utf8'),
    );
    return {
      object_kind: canonicalValue.object_kind,
      stable_id: canonicalValue.stable_id,
      canonical_value: canonicalValue,
    };
  });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function member(values, stableId) {
  return values.find((value) => value.stable_id === stableId);
}

test('accepts the complete QXO capitalisation successor contract', () => {
  const authored = members();
  assert.doesNotThrow(() => validateAuthoredRelationshipInputs(authored));
  assert.doesNotThrow(() => validateAuthoredTechnicalRelationshipInputs(authored));
  assert.doesNotThrow(() => validateAuthoredQxoCapitalisationInputs(authored));
});

test('keeps the reviewed F13 bytes fixed while selecting successor relationship versions', () => {
  const authored = members();
  assert.equal(
    FIXTURE_CONTRACT_FINGERPRINT_V13,
    FROZEN_QXO_REVIEW_CONTRACT_FINGERPRINT,
  );
  assert.equal(
    member(authored, 'BRINGS_DOWN').canonical_value.version,
    3,
  );
  assert.equal(
    member(authored, 'BRINGS_DOWN_EFFECT').canonical_value.effect_schema_version,
    2,
  );
  assert.equal(
    member(authored, 'USES_DEFINITION').canonical_value.version,
    4,
  );
});

test('binds the measurement date to one calendar day before signing', () => {
  const authored = members();
  const contract = member(
    authored,
    'CAPITALISATION_REPRESENTATION',
  ).canonical_value.authored_schema.measurement_date_claim_contract;
  assert.equal(contract.qxo_required_measurement_date, '2026-04-17');
  assert.equal(contract.qxo_required_signing_date, '2026-04-18');
  assert.equal(contract.qxo_required_signing_relative_offset, -1);
  assert.equal(contract.required_day_basis, 'CALENDAR_DAY');
  assert.equal(contract.retrospective_lookback_projection_forbidden, true);
});

test('keeps knowledge, materiality and lookback as independently closed absence claims', () => {
  const contract = member(
    members(),
    'CAPITALISATION_REPRESENTATION',
  ).canonical_value.authored_schema.qualifier_absence_scope_contract;
  assert.deepEqual(contract.claim_definition_keys, [
    'KNOWLEDGE_QUALIFIER',
    'GENERAL_MATERIALITY_QUALIFIER',
    'RETROSPECTIVE_LOOKBACK',
  ]);
  assert.equal(contract.required_claim_state, 'ABSENT');
  assert.equal(contract.independent_scope_closure_per_claim_required, true);
  assert.equal(contract.candidate_selected_scope_forbidden, true);
});

test('keeps the three buyer-side entities in one reviewed buyer group', () => {
  const party = member(
    members(),
    'CAPITALISATION_REPRESENTATION',
  ).canonical_value.authored_schema.party_contract;
  assert.equal(party.result_party.value, 'BUYER_GROUP');
  assert.deepEqual(
    party.buyer_group_members.map((entry) => entry.value),
    ['PARENT', 'TITANIUM_MERGER_SUB', 'FORWARD_MERGER_SUB'],
  );
  assert.equal(party.one_result_and_observation_party_required, true);
});

test('rejects a correctly shaped change to the signing-relative date', () => {
  const authored = clone(members());
  member(
    authored,
    'CAPITALISATION_REPRESENTATION',
  ).canonical_value.authored_schema.measurement_date_claim_contract
    .qxo_required_signing_relative_offset = 0;
  assert.throws(
    () => validateAuthoredQxoCapitalisationInputs(authored),
    (error) => error.code === 'QXO_CAPITALISATION_SCHEMA_DRIFT',
  );
});

test('rejects regression to the conflicting older successor relationship version', () => {
  const authored = clone(members());
  const relationship = member(authored, 'BRINGS_DOWN').canonical_value;
  relationship.version = 2;
  relationship.effect_schema = 'BRINGS_DOWN_EFFECT/V1';
  assert.throws(
    () => validateAuthoredQxoCapitalisationInputs(authored),
    (error) => error.code === 'QXO_CAPITALISATION_RELATIONSHIP_DRIFT',
  );
});

test('rejects cross-class aggregation and a forged relation version in the result', () => {
  const authored = clone(members());
  const result = member(
    authored,
    'TARGET_CAPITALISATION_BRING_DOWN',
  ).canonical_value.authored_definition;
  result.class_aggregation_forbidden = false;
  result.primary_comparison_slots[0].required_relationship_version = 2;
  assert.throws(
    () => validateAuthoredQxoCapitalisationInputs(authored),
    (error) => error.code === 'QXO_CAPITALISATION_RESULT_DRIFT',
  );
});

test('rejects removal of the QXO definition denominator selection rule', () => {
  const authored = clone(members());
  delete member(
    authored,
    'USES_DEFINITION_EFFECT',
  ).canonical_value.definition.definition_application_contract;
  assert.throws(
    () => validateAuthoredQxoCapitalisationInputs(authored),
    (error) => error.code === 'QXO_CAPITALISATION_EFFECT_SCHEMA_DRIFT',
  );
});

test('governs fourteen atomic market slots without cross-class aggregation', () => {
  const authored = members();
  const result = member(
    authored,
    'TARGET_CAPITALISATION_BRING_DOWN',
  ).canonical_value.authored_definition;
  assert.equal(result.result_version, 3);
  assert.equal(result.market_metric_slot_count, 14);
  assert.deepEqual(
    result.market_metric_slots.map((entry) => ({
      value_slot_key: entry.value_slot_key,
      comparison_class_key: entry.comparison_class_key,
      metric_count: entry.metric_keys.length,
    })),
    [
      {
        value_slot_key: 'CAPITALISATION_CLAUSE_B_LIMBS_I_III',
        comparison_class_key: 'CAPITALISATION_CLAUSE_B_LIMBS_I_III',
        metric_count: 5,
      },
      {
        value_slot_key: 'CAPITALISATION_CLAUSE_C_LIMBS_II_IV_V',
        comparison_class_key: 'CAPITALISATION_CLAUSE_C_LIMBS_II_IV_V',
        metric_count: 5,
      },
      {
        value_slot_key: 'CAPITALISATION_MEASUREMENT_DATE',
        comparison_class_key: null,
        metric_count: 1,
      },
      {
        value_slot_key: 'GENERAL_KNOWLEDGE_QUALIFIER',
        comparison_class_key: null,
        metric_count: 1,
      },
      {
        value_slot_key: 'GENERAL_MATERIALITY_QUALIFIER',
        comparison_class_key: null,
        metric_count: 1,
      },
      {
        value_slot_key: 'RETROSPECTIVE_LOOKBACK',
        comparison_class_key: null,
        metric_count: 1,
      },
    ],
  );
  assert.equal(result.market_request_contract.database_call_budget, 1);
  assert.equal(result.market_request_contract.immediate_retries, 0);
  assert.equal(result.market_request_contract.failure_isolation, 'PER_METRIC_SLOT');
});

test('rejects an omitted or duplicated metric definition', () => {
  const omitted = clone(members()).filter(
    (entry) => entry.stable_id !== 'DATED_REPRESENTATION_TREATMENT',
  );
  assert.throws(
    () => validateAuthoredQxoCapitalisationInputs(omitted),
    (error) => error.code === 'QXO_CAPITALISATION_METRIC_INVENTORY_DRIFT',
  );
  const duplicated = clone(members());
  duplicated.push(clone(member(
    duplicated,
    'DATED_REPRESENTATION_TREATMENT',
  )));
  assert.throws(
    () => validateAuthoredQxoCapitalisationInputs(duplicated),
    (error) => error.code === 'QXO_CAPITALISATION_METRIC_INVENTORY_DRIFT',
  );
});

test('rejects denominator party drift and absence-state laundering', () => {
  const denominator = clone(members());
  member(
    denominator,
    'REPRESENTATION_ACCURACY_EXCEPTION_DENOMINATOR',
  ).canonical_value.authored_definition.allowed_denominator_party_values = [
    'PARENT',
  ];
  assert.throws(
    () => validateAuthoredQxoCapitalisationInputs(denominator),
    (error) => error.code === 'QXO_CAPITALISATION_METRIC_DRIFT',
  );

  const knowledge = clone(members());
  member(
    knowledge,
    'KNOWLEDGE_QUALIFIER_STATE',
  ).canonical_value.authored_definition.complete_scope_required_for_absent =
    false;
  assert.throws(
    () => validateAuthoredQxoCapitalisationInputs(knowledge),
    (error) => error.code === 'QXO_CAPITALISATION_METRIC_DRIFT',
  );
});

test('keeps measurement-date and lookback metrics legally separate', () => {
  const authored = members();
  const measurement = member(
    authored,
    'REPRESENTATION_MEASUREMENT_DATE_SIGNING_OFFSET',
  ).canonical_value.authored_definition;
  const lookback = member(
    authored,
    'RETROSPECTIVE_LOOKBACK_STATE',
  ).canonical_value.authored_definition;
  assert.equal(
    measurement.canonical_unit,
    'CALENDAR_DAYS_RELATIVE_TO_SIGNING',
  );
  assert.equal(measurement.raw_absolute_date_is_not_cohort_key, true);
  assert.deepEqual(measurement.allowed_observation_states, [
    'PRESENT',
    'ABSENT',
    'NOT_EXAMINED',
  ]);
  assert.equal(measurement.unresolved_signing_anchor_state, 'NOT_EXAMINED');
  assert.equal(lookback.measurement_date_is_not_retrospective_lookback, true);
});

test('rejects removal of the unresolved signing-anchor state', () => {
  const authored = clone(members());
  member(
    authored,
    'REPRESENTATION_MEASUREMENT_DATE_SIGNING_OFFSET',
  ).canonical_value.authored_definition.allowed_observation_states = [
    'PRESENT',
    'ABSENT',
  ];
  assert.throws(
    () => validateAuthoredQxoCapitalisationInputs(authored),
    (error) => error.code === 'QXO_CAPITALISATION_METRIC_DRIFT',
  );
});
