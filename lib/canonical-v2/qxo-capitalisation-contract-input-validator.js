const { canonicalJson } = require('./canonical-bytes');
const {
  BRINGS_DOWN_EFFECT_SCHEMA_V1,
  CAPITALISATION_REPRESENTATION_SCHEMA_V1,
  FIXTURE_CONTRACT_FINGERPRINT_V13,
  GENERAL_MATERIALITY_QUALIFIER_CLAIM_DEFINITION_V1,
  REPRESENTATION_MEASUREMENT_DATE_CLAIM_DEFINITION_V1,
  RETROSPECTIVE_LOOKBACK_CLAIM_DEFINITION_V1,
  USES_DEFINITION_EFFECT_SCHEMA_V3,
} = require('./contract-bundle');

const RESULT_DEFINITION_V3 = require(
  '../../contracts/canonical-v2/successor/agreement/result-definitions/target-capitalisation-bring-down.v3.json',
);
const METRIC_DEFINITIONS = Object.freeze([
  require('../../contracts/canonical-v2/successor/agreement/market-metric-definitions/representation-accuracy-standard.v3.json'),
  require('../../contracts/canonical-v2/successor/agreement/market-metric-definitions/representation-accuracy-exception.v1.json'),
  require('../../contracts/canonical-v2/successor/agreement/market-metric-definitions/representation-accuracy-exception-denominator.v1.json'),
  require('../../contracts/canonical-v2/successor/agreement/market-metric-definitions/dated-representation-treatment.v1.json'),
  require('../../contracts/canonical-v2/successor/agreement/market-metric-definitions/representation-materiality-scrape.v1.json'),
  require('../../contracts/canonical-v2/successor/agreement/market-metric-definitions/representation-measurement-date-signing-offset.v1.json'),
  require('../../contracts/canonical-v2/successor/agreement/market-metric-definitions/knowledge-qualifier-state.v1.json'),
  require('../../contracts/canonical-v2/successor/agreement/market-metric-definitions/general-materiality-qualifier-state.v1.json'),
  require('../../contracts/canonical-v2/successor/agreement/market-metric-definitions/retrospective-lookback-state.v1.json'),
]);
const METRIC_STABLE_IDS = Object.freeze(
  METRIC_DEFINITIONS.map((entry) => entry.stable_id).sort(),
);
const ALLOWED_MARKET_METRIC_FAILURE_REASON_CODES = Object.freeze([
  'METRIC_VALUE_VALIDATION_FAILED',
]);

const FROZEN_QXO_REVIEW_CONTRACT_FINGERPRINT =
  '3c8ca48ff4f1f2f482b14a188045aa3a1ec7072704d396f7306b483e6338f2ac';

const QXO_OBJECT_KINDS = Object.freeze([
  'CAPITALISATION_SEMANTIC_SCHEMA_INPUT',
  'MARKET_METRIC_DEFINITION_INPUT',
  'RESULT_DEFINITION_INPUT',
]);

class QxoCapitalisationContractInputError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'QxoCapitalisationContractInputError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new QxoCapitalisationContractInputError(code, message, details);
}

function same(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function clone(value) {
  return JSON.parse(canonicalJson(value));
}

function exactKeys(value, expected, label) {
  if (
    !value
    || typeof value !== 'object'
    || Array.isArray(value)
    || !same(Object.keys(value).sort(), [...expected].sort())
  ) {
    fail(
      'INVALID_QXO_CAPITALISATION_CONTRACT_INPUT',
      `${label} fields do not match the reviewed contract.`,
    );
  }
}

function expectedBringsDownEffectV2() {
  return {
    ...clone(BRINGS_DOWN_EFFECT_SCHEMA_V1),
    schema_version: 'BRINGS_DOWN_EFFECT/V2',
    relationship_definition_version: 3,
  };
}

function onlyMember(authoredMembers, objectKind, stableId) {
  const matches = authoredMembers.filter(
    (member) => member?.object_kind === objectKind
      && member.canonical_value?.stable_id === stableId,
  );
  if (matches.length !== 1) {
    fail(
      'QXO_CAPITALISATION_CONTRACT_MEMBER_CARDINALITY',
      'The QXO contract requires exactly one selected member.',
      { object_kind: objectKind, stable_id: stableId, actual_count: matches.length },
    );
  }
  return matches[0].canonical_value;
}

function validateClaim(value, expected) {
  const stableId = expected.claim_definition_key;
  const expectedValue = {
    ...clone(expected),
    object_kind: 'CLAIM_DEFINITION',
    schema_version: 'CLAIM_DEFINITION/V1',
    stable_id: stableId,
  };
  if (!same(value, expectedValue)) {
    fail(
      'QXO_CAPITALISATION_CLAIM_DRIFT',
      'A QXO claim definition differs from the frozen legal review.',
      { stable_id: stableId },
    );
  }
}

function validateRelationship(value, expected) {
  if (!same(value, expected)) {
    fail(
      'QXO_CAPITALISATION_RELATIONSHIP_DRIFT',
      'A QXO relationship definition differs from the successor contract.',
      { stable_id: expected.stable_id },
    );
  }
}

function validateEffect(value, expectedDefinition, version) {
  const expected = {
    object_kind: 'RELATIONSHIP_EFFECT_SCHEMA',
    stable_id: expectedDefinition.relationship_key === 'BRINGS_DOWN'
      ? 'BRINGS_DOWN_EFFECT'
      : 'USES_DEFINITION_EFFECT',
    schema_version: 'RELATIONSHIP_EFFECT_SCHEMA/V1',
    effect_schema_key: expectedDefinition.relationship_key === 'BRINGS_DOWN'
      ? 'BRINGS_DOWN_EFFECT'
      : 'USES_DEFINITION_EFFECT',
    effect_schema_version: version,
    definition: expectedDefinition,
  };
  if (!same(value, expected)) {
    fail(
      'QXO_CAPITALISATION_EFFECT_SCHEMA_DRIFT',
      'A QXO relationship effect differs from the frozen legal review.',
      { stable_id: expected.stable_id },
    );
  }
}

function validateAuthoredQxoCapitalisationInputs(authoredMembers) {
  if (!Array.isArray(authoredMembers)) {
    throw new TypeError('authoredMembers must be an array');
  }
  const selected = authoredMembers.filter((member) => (
    QXO_OBJECT_KINDS.includes(member?.object_kind)
    || [
      'GENERAL_MATERIALITY_QUALIFIER',
      'REPRESENTATION_MEASUREMENT_DATE',
      'RETROSPECTIVE_LOOKBACK',
    ].includes(member?.canonical_value?.stable_id)
  ));
  if (selected.length === 0) return;

  if (FIXTURE_CONTRACT_FINGERPRINT_V13 !== FROZEN_QXO_REVIEW_CONTRACT_FINGERPRINT) {
    fail(
      'QXO_F13_REVIEW_CONTRACT_MOVED',
      'The frozen QXO review contract fingerprint changed.',
    );
  }

  validateClaim(
    onlyMember(
      authoredMembers,
      'CLAIM_DEFINITION',
      'REPRESENTATION_MEASUREMENT_DATE',
    ),
    REPRESENTATION_MEASUREMENT_DATE_CLAIM_DEFINITION_V1,
  );
  validateClaim(
    onlyMember(
      authoredMembers,
      'CLAIM_DEFINITION',
      'GENERAL_MATERIALITY_QUALIFIER',
    ),
    GENERAL_MATERIALITY_QUALIFIER_CLAIM_DEFINITION_V1,
  );
  validateClaim(
    onlyMember(authoredMembers, 'CLAIM_DEFINITION', 'RETROSPECTIVE_LOOKBACK'),
    RETROSPECTIVE_LOOKBACK_CLAIM_DEFINITION_V1,
  );

  validateRelationship(
    onlyMember(authoredMembers, 'RELATIONSHIP_DEFINITION', 'BRINGS_DOWN'),
    {
      effect_mode: 'TYPED_LEGAL_EFFECT',
      effect_schema: 'BRINGS_DOWN_EFFECT/V2',
      object_kind: 'RELATIONSHIP_DEFINITION',
      relationship_key: 'BRINGS_DOWN',
      schema_version: 'RELATIONSHIP_DEFINITION/V1',
      stable_id: 'BRINGS_DOWN',
      version: 3,
    },
  );
  validateEffect(
    onlyMember(
      authoredMembers,
      'RELATIONSHIP_EFFECT_SCHEMA',
      'BRINGS_DOWN_EFFECT',
    ),
    expectedBringsDownEffectV2(),
    2,
  );
  validateRelationship(
    onlyMember(authoredMembers, 'RELATIONSHIP_DEFINITION', 'USES_DEFINITION'),
    {
      effect_mode: 'TYPED_LEGAL_EFFECT',
      effect_schema: 'USES_DEFINITION_EFFECT/V3',
      object_kind: 'RELATIONSHIP_DEFINITION',
      relationship_key: 'USES_DEFINITION',
      schema_version: 'RELATIONSHIP_DEFINITION/V1',
      stable_id: 'USES_DEFINITION',
      version: 4,
    },
  );
  validateEffect(
    onlyMember(
      authoredMembers,
      'RELATIONSHIP_EFFECT_SCHEMA',
      'USES_DEFINITION_EFFECT',
    ),
    clone(USES_DEFINITION_EFFECT_SCHEMA_V3),
    3,
  );

  const capitalisation = onlyMember(
    authoredMembers,
    'CAPITALISATION_SEMANTIC_SCHEMA_INPUT',
    'CAPITALISATION_REPRESENTATION',
  );
  exactKeys(capitalisation, [
    'authored_schema',
    'object_kind',
    'schema_version',
    'stable_id',
  ], 'capitalisation schema');
  if (
    capitalisation.object_kind !== 'CAPITALISATION_SEMANTIC_SCHEMA_INPUT'
    || capitalisation.schema_version !== 'CAPITALISATION_SEMANTIC_SCHEMA_INPUT/V1'
    || !same(capitalisation.authored_schema, CAPITALISATION_REPRESENTATION_SCHEMA_V1)
  ) {
    fail(
      'QXO_CAPITALISATION_SCHEMA_DRIFT',
      'The capitalisation schema differs from the frozen legal review.',
    );
  }

  const result = onlyMember(
    authoredMembers,
    'RESULT_DEFINITION_INPUT',
    'TARGET_CAPITALISATION_BRING_DOWN',
  );
  exactKeys(result, [
    'authored_definition',
    'object_kind',
    'schema_version',
    'stable_id',
  ], 'capitalisation result');
  if (
    !same(
      result.authored_definition.market_request_contract
        ?.allowed_market_metric_failure_reason_codes,
      ALLOWED_MARKET_METRIC_FAILURE_REASON_CODES,
    )
    || result.authored_definition.market_request_contract
      ?.subject_membership_receipt_required !== true
    || !same(
      result.authored_definition.market_request_contract
        ?.subject_membership_receipt_identity_inputs,
      [
        'status',
        'exclusion_reason',
        'cohort_digest',
        'subject_deal_key',
        'subject_metric_output_id',
        'counts_digest',
      ],
    )
  ) {
    fail(
      'QXO_CAPITALISATION_MARKET_RESULT_CONTRACT_DRIFT',
      'The capitalisation cohort receipt or failure-code contract changed.',
    );
  }
  if (
    result.object_kind !== 'RESULT_DEFINITION_INPUT'
    || result.schema_version !== 'RESULT_DEFINITION_INPUT/V1'
    || !same(result, RESULT_DEFINITION_V3)
  ) {
    fail(
      'QXO_CAPITALISATION_RESULT_DRIFT',
      'The capitalisation result differs from the reviewed composition.',
    );
  }

  const actualMetricStableIds = authoredMembers
    .filter((member) => (
      member?.object_kind === 'MARKET_METRIC_DEFINITION_INPUT'
      && METRIC_STABLE_IDS.includes(member.canonical_value?.stable_id)
    ))
    .map((member) => member.canonical_value.stable_id)
    .sort();
  if (!same(actualMetricStableIds, METRIC_STABLE_IDS)) {
    fail(
      'QXO_CAPITALISATION_METRIC_INVENTORY_DRIFT',
      'The capitalisation market metric inventory is incomplete or duplicated.',
      {
        actual_metric_stable_ids: actualMetricStableIds,
        expected_metric_stable_ids: METRIC_STABLE_IDS,
      },
    );
  }
  for (const expectedMetric of METRIC_DEFINITIONS) {
    const metric = onlyMember(
      authoredMembers,
      'MARKET_METRIC_DEFINITION_INPUT',
      expectedMetric.stable_id,
    );
    exactKeys(metric, [
      'authored_definition',
      'object_kind',
      'schema_version',
      'stable_id',
    ], 'capitalisation metric');
    if (!same(metric, expectedMetric)) {
      fail(
        'QXO_CAPITALISATION_METRIC_DRIFT',
        'A capitalisation market metric differs from the reviewed comparison rule.',
        { stable_id: expectedMetric.stable_id },
      );
    }
  }
}

module.exports = {
  ALLOWED_MARKET_METRIC_FAILURE_REASON_CODES,
  FROZEN_QXO_REVIEW_CONTRACT_FINGERPRINT,
  METRIC_DEFINITIONS,
  METRIC_STABLE_IDS,
  QxoCapitalisationContractInputError,
  RESULT_DEFINITION_V3,
  validateAuthoredQxoCapitalisationInputs,
};
