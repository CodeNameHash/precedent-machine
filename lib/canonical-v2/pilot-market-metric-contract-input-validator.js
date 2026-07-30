const { canonicalJson, sha256Hex } = require('./canonical-bytes');

const MARKET_METRIC_DEFINITION_INPUT_KIND =
  'MARKET_METRIC_DEFINITION_INPUT';
const MARKET_METRIC_DEFINITION_INPUT_SCHEMA =
  'MARKET_METRIC_DEFINITION_INPUT/V1';
const PILOT_MARKET_METRIC_IDS = Object.freeze([
  'IOC_CAPEX_THRESHOLD_PERCENT_OF_DEAL_VALUE',
  'NO_SHOP_INITIAL_MATCH_PERIOD_DAYS',
]);
const PILOT_MARKET_METRIC_DEFINITIONS = Object.freeze({
  IOC_CAPEX_THRESHOLD_PERCENT_OF_DEAL_VALUE: Object.freeze({
    definition_digest:
      '0ef1df6cfb5b50bdcbbe5ffa2d2c32f92cb57f995a11ea3d462a130d20eafd33',
    error_code: 'INVALID_PILOT_IOC_MONEY_METRIC_INPUT',
  }),
  NO_SHOP_INITIAL_MATCH_PERIOD_DAYS: Object.freeze({
    definition_digest:
      '0d16d01bc2245d35f435f25c68ee2d319a57cd13b3e6088cf296c1bba21d423c',
    error_code: 'INVALID_PILOT_DURATION_METRIC_INPUT',
  }),
});

class PilotMarketMetricContractInputError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'PilotMarketMetricContractInputError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new PilotMarketMetricContractInputError(code, message, details);
}

function requireExactKeys(value, expected, label, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(code, `${label} must be an object.`);
  }
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  if (canonicalJson(actual) !== canonicalJson(required)) {
    fail(code, `${label} fields do not match the governed contract.`, {
      actual,
      expected: required,
    });
  }
}

function validateMember(member) {
  const value = member.canonical_value;
  const registered = PILOT_MARKET_METRIC_DEFINITIONS[value?.stable_id];
  const code = registered?.error_code
    || 'INVALID_PILOT_MARKET_METRIC_INPUT';

  requireExactKeys(value, [
    'authored_definition',
    'object_kind',
    'schema_version',
    'stable_id',
  ], 'Pilot market MetricDefinition input', code);

  if (
    !registered
    || value.object_kind !== MARKET_METRIC_DEFINITION_INPUT_KIND
    || value.schema_version !== MARKET_METRIC_DEFINITION_INPUT_SCHEMA
    || value.authored_definition?.metric_key !== value.stable_id
    || value.authored_definition?.metric_version !== 1
    || value.authored_definition?.source_lineage_required !== true
  ) {
    fail(code, 'The pilot market MetricDefinition identity is not registered.');
  }

  let actualDigest;
  try {
    actualDigest = sha256Hex(
      Buffer.from(canonicalJson(value.authored_definition), 'utf8'),
    );
  } catch (error) {
    fail(code, 'The pilot market MetricDefinition is not canonical JSON.', {
      cause: error.message,
    });
  }
  if (actualDigest !== registered.definition_digest) {
    fail(code, 'The pilot market MetricDefinition has changed.', {
      expected_definition_digest: registered.definition_digest,
      actual_definition_digest: actualDigest,
    });
  }
}

function validateAuthoredPilotMarketMetricInputs(authoredMembers) {
  if (!Array.isArray(authoredMembers)) {
    throw new TypeError('authoredMembers must be an array');
  }
  const members = authoredMembers.filter(
    (member) => member?.object_kind === MARKET_METRIC_DEFINITION_INPUT_KIND
      && PILOT_MARKET_METRIC_IDS.includes(
        member.canonical_value?.stable_id,
      ),
  );
  if (members.length === 0) return;

  const stableIds = members
    .map((member) => member.canonical_value?.stable_id)
    .sort();
  if (canonicalJson(stableIds) !== canonicalJson(PILOT_MARKET_METRIC_IDS)) {
    fail(
      'PILOT_MARKET_METRIC_MEMBERSHIP_MISMATCH',
      'The pilot market MetricDefinition set is incomplete or duplicated.',
      {
        actual_stable_ids: stableIds,
        expected_stable_ids: PILOT_MARKET_METRIC_IDS,
      },
    );
  }
  members.forEach(validateMember);
}

module.exports = {
  MARKET_METRIC_DEFINITION_INPUT_KIND,
  MARKET_METRIC_DEFINITION_INPUT_SCHEMA,
  PILOT_MARKET_METRIC_DEFINITIONS,
  PILOT_MARKET_METRIC_IDS,
  PilotMarketMetricContractInputError,
  validateAuthoredPilotMarketMetricInputs,
};
