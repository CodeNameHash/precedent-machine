const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  validateAuthoredPilotMarketMetricInputs,
} = require(
  '../lib/canonical-v2/pilot-market-metric-contract-input-validator',
);
const {
  validateAuthoredSharedAuthorityInputs,
} = require(
  '../lib/canonical-v2/shared-authority-contract-input-validator',
);

const ROOT = path.join(
  __dirname,
  '../contracts/canonical-v2/successor',
);
const METRIC_PATHS = [
  'agreement/market-metric-definitions/ioc-capex-threshold-percent-of-deal-value.v1.json',
  'agreement/market-metric-definitions/no-shop-initial-match-period-days.v1.json',
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

function metricMembers() {
  return METRIC_PATHS.map(loadMember);
}

function metric(stableId) {
  return metricMembers().find(
    (member) => member.canonical_value.stable_id === stableId,
  ).canonical_value.authored_definition;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('validates the exact pilot money and duration MetricDefinitions', () => {
  assert.doesNotThrow(
    () => validateAuthoredPilotMarketMetricInputs(metricMembers()),
  );
  assert.deepEqual(
    metricMembers().map((member) => member.canonical_value.stable_id),
    [
      'IOC_CAPEX_THRESHOLD_PERCENT_OF_DEAL_VALUE',
      'NO_SHOP_INITIAL_MATCH_PERIOD_DAYS',
    ],
  );
});

test('binds IOC money to its denominator, relationship and source lineage', () => {
  const money = metric('IOC_CAPEX_THRESHOLD_PERCENT_OF_DEAL_VALUE');

  assert.equal(money.value_dimension, 'MONEY_RELATIVE_TO_DEAL_VALUE');
  assert.equal(money.canonical_unit, 'PERCENT_OF_DEAL_VALUE');
  assert.equal(money.denominator_basis, 'HEADLINE_TRANSACTION_VALUE');
  assert.equal(money.denominator_lineage_required, true);
  assert.equal(money.owner_lineage_mode, 'RESULT_RELATIONSHIP');
  assert.equal(money.required_relationship_key, 'EXCEPTED_BY');
  assert.equal(money.required_result_key, 'TARGET_CAPEX_RESTRICTION');
  assert.equal(money.required_value_slot_key, 'CAPEX_THRESHOLD');
  assert.ok(
    money.required_lineage_fields.includes(
      'DENOMINATOR_SOURCE_LINEAGE_IDS',
    ),
  );
  assert.ok(
    money.required_lineage_fields.includes('RESULT_INPUT_LINEAGE_DIGEST'),
  );
});

test('binds duration to legal clock inputs and complete result lineage', () => {
  const duration = metric('NO_SHOP_INITIAL_MATCH_PERIOD_DAYS');

  assert.equal(duration.value_dimension, 'DURATION');
  assert.equal(duration.canonical_unit, 'DAYS');
  assert.deepEqual(duration.allowed_day_bases, ['BUSINESS']);
  assert.equal(duration.trigger, 'SUPERIOR_PROPOSAL_NOTICE');
  assert.equal(duration.required_result_key, 'BUYER_INITIAL_MATCH_RIGHT');
  assert.equal(duration.required_value_slot_key, 'INITIAL_MATCH_PERIOD');
  assert.deepEqual(duration.duration_lineage_required, [
    'RAW_MAGNITUDE',
    'RAW_UNIT',
    'DAY_BASIS',
    'START_LEGAL_EVENT',
    'INCLUSIVITY',
    'TIMEZONE_IF_STATED',
    'COUNTING_RULE',
    'CALENDAR_IF_APPLICABLE',
    'NORMALISATION_DERIVATION_VERSION',
  ]);
  assert.ok(
    duration.required_lineage_fields.includes(
      'COMPOSITION_SCOPE_CLOSURE_ID',
    ),
  );
});

test('keeps process_event_time unadmitted and fails closed for the pilot', () => {
  const temporal = loadMember(
    'shared/temporal/temporal-expression.v1.json',
  );
  const temporalType =
    temporal.canonical_value.definition.type_contract;
  const fieldCatalogue = loadMember(
    'process/fields/process-field-definition-catalogue.v1.json',
  ).canonical_value.definition;
  const processEventTime = fieldCatalogue.field_definitions.find(
    (field) => field.field_key === 'process_event_time',
  );

  assert.deepEqual(temporalType.structured_node_registry, []);
  assert.equal(temporalType.structured_node_release_permitted, false);
  assert.equal(temporalType.pilot_can_certify_structured_nodes, false);
  assert.equal(temporalType.runtime_node_admission_permitted, false);
  assert.equal(processEventTime.release_admission_required, true);
  assert.equal(
    processEventTime.required_value_registry,
    'TEMPORAL_EXPRESSION.type_contract.structured_node_registry',
  );
  assert.equal(
    processEventTime.unavailable_reason,
    'TEMPORAL_FORM_NOT_ADMITTED_IN_SELECTED_RELEASE',
  );

  const inventedNode = clone(temporal);
  inventedNode.canonical_value.definition.type_contract
    .structured_node_registry.push('PILOT_INVENTED_DATE');
  assert.throws(
    () => validateAuthoredSharedAuthorityInputs([inventedNode]),
    { code: 'INVALID_SHARED_AUTHORITY_LOGICAL_TYPE_INPUT' },
  );
});

test('rejects missing and semantically weakened pilot MetricDefinitions', () => {
  assert.throws(
    () => validateAuthoredPilotMarketMetricInputs(
      metricMembers().slice(1),
    ),
    { code: 'PILOT_MARKET_METRIC_MEMBERSHIP_MISMATCH' },
  );

  const money = clone(metricMembers());
  money[0].canonical_value.authored_definition
    .denominator_lineage_required = false;
  assert.throws(
    () => validateAuthoredPilotMarketMetricInputs(money),
    { code: 'INVALID_PILOT_IOC_MONEY_METRIC_INPUT' },
  );

  const duration = clone(metricMembers());
  duration[1].canonical_value.authored_definition
    .duration_lineage_required = [];
  assert.throws(
    () => validateAuthoredPilotMarketMetricInputs(duration),
    { code: 'INVALID_PILOT_DURATION_METRIC_INPUT' },
  );
});

test('grants no serving, database, writer, release or production authority', () => {
  const forbiddenAuthorityFields = [
    'creates_runtime_metric',
    'creates_query_execution_authority',
    'creates_canonical_write_authority',
    'creates_writer_authority',
    'creates_serving_authority',
    'creates_database_authority',
    'creates_release_authority',
    'creates_activation_authority',
    'creates_production_authority',
  ];

  for (const member of metricMembers()) {
    for (const field of forbiddenAuthorityFields) {
      assert.equal(
        Object.hasOwn(member.canonical_value.authored_definition, field),
        false,
      );
    }
  }
});
