const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');
const {
  canonicalProductQueryIrBytes,
} = require('./product-query-ir');
const {
  validateProductFieldCatalogueManifest,
} = require('./product-field-catalogue');
const orderingContract = require(
  '../../contracts/canonical-v2/successor/agreement/query/agreement-comparable-result-ordering.v1.json',
);

const AGREEMENT_COMPARABLE_RESULT_ORDERING_FACT_SCHEMA =
  'AGREEMENT_COMPARABLE_RESULT_ORDERING_FACT/V1';
const AGREEMENT_COMPARABLE_RESULT_ORDERING_FAILURE_SCHEMA =
  'AGREEMENT_COMPARABLE_RESULT_ORDERING_FAILURE/V1';
const AGREEMENT_COMPARABLE_RESULT_ORDERING_PROJECTION_SCHEMA =
  'AGREEMENT_COMPARABLE_RESULT_ORDERING_PROJECTION/V1';
const AGREEMENT_ORDERING_VALIDATOR_STABLE_ID =
  'AGREEMENT_COMPARABLE_RESULT_ORDERING_PROJECTION';
const AGREEMENT_ORDERING_VALIDATOR_VERSION = 1;
const AGREEMENT_ORDERING_CONTRACT_DEFINITION_DIGEST =
  '17eb9ac896e0898febaf06618b6cbf0d23b43b9fedcbd204be325c52af8d8df0';
const SHA256_RE = /^[a-f0-9]{64}$/;
const CANONICAL_DECIMAL_RE = /^(0|[1-9]\d*)(\.\d+)?$/;
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MAX_CANDIDATES = 512;
const MIN_PAGE_SIZE = 8;
const MAX_PAGE_SIZE = 12;
const ADMITTED_AGREEMENT_RESULT_DEFINITIONS = Object.freeze([
  Object.freeze({ stable_id: 'AGREEMENT_COMPARABLE_RESULT', version: 1 }),
  Object.freeze({ stable_id: 'TARGET_CAPEX_RESTRICTION', version: 1 }),
  Object.freeze({ stable_id: 'TARGET_CAPITALISATION_BRING_DOWN', version: 3 }),
]);
const FACT_STATES = Object.freeze([
  'VALIDATED_SORT_PROJECTION',
  'ORDERING_UNAVAILABLE',
]);
const MISSING_STATES = Object.freeze([
  'CONFLICT',
  'KNOWN_MISSING',
  'NOT_APPLICABLE',
  'NOT_EXAMINED',
  'UNKNOWN',
]);
const SORTABLE_VALUE_TYPES = Object.freeze([
  'DEAL_REFERENCE',
  'DATE',
  'ENTITY_REFERENCE',
  'MONEY_WITH_BASIS',
  'ENUM',
]);
const NON_SORTABLE_VALUE_TYPES = Object.freeze([
  'PROFESSIONAL_ASSIGNMENT',
]);
const AUTHORITY_LIMITS = Object.freeze({
  execution: 'NONE',
  ordering_fact_validation: 'NONE',
  query: 'NONE',
  result_materialisation: 'NONE',
  domain_result: 'NONE',
  source_read: 'NONE',
  serving: 'NONE',
  writer: 'NONE',
  release: 'NONE',
  canonical_write: 'NONE',
  database: 'NONE',
  import: 'NONE',
  activation: 'NONE',
  production: 'NONE',
});

class AgreementComparableResultOrderError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'AgreementComparableResultOrderError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new AgreementComparableResultOrderError(code, message, details);
}

function requireObject(
  value,
  label,
  code = 'INVALID_AGREEMENT_COMPARABLE_RESULT_ORDER_INPUT',
) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(code, `${label} must be an object.`);
  }
  return value;
}

function requireExactKeys(
  value,
  expected,
  label,
  code = 'INVALID_AGREEMENT_COMPARABLE_RESULT_ORDER_INPUT',
) {
  requireObject(value, label, code);
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  if (canonicalJson(actual) !== canonicalJson(required)) {
    fail(code, `${label} fields do not match the governed contract.`, {
      actual,
      expected: required,
    });
  }
}

function requireDigest(
  value,
  label,
  code = 'INVALID_AGREEMENT_COMPARABLE_RESULT_ORDER_INPUT',
) {
  if (!SHA256_RE.test(value || '')) {
    fail(code, `${label} must be a full SHA-256 digest.`);
  }
  return value;
}

function requireText(
  value,
  label,
  code = 'INVALID_AGREEMENT_COMPARABLE_RESULT_ORDER_INPUT',
) {
  if (
    typeof value !== 'string'
    || value.length === 0
    || value.trim() !== value
    || Buffer.byteLength(value, 'utf8') > 256
  ) {
    fail(code, `${label} must be a bounded non-empty trimmed string.`);
  }
  return value;
}

function clone(
  value,
  code = 'INVALID_AGREEMENT_COMPARABLE_RESULT_ORDER_INPUT',
) {
  try {
    return JSON.parse(canonicalJson(value));
  } catch (error) {
    fail(code, 'The Agreement ordering input is not canonical JSON.', {
      cause: error.message,
    });
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function compareText(left, right) {
  return Buffer.compare(
    Buffer.from(left, 'utf8'),
    Buffer.from(right, 'utf8'),
  );
}

function compareDecimals(left, right) {
  const [leftInteger, leftFraction = ''] = left.split('.');
  const [rightInteger, rightFraction = ''] = right.split('.');
  const scale = Math.max(leftFraction.length, rightFraction.length);
  const leftScaled = BigInt(
    `${leftInteger}${leftFraction.padEnd(scale, '0')}`,
  );
  const rightScaled = BigInt(
    `${rightInteger}${rightFraction.padEnd(scale, '0')}`,
  );
  if (leftScaled < rightScaled) return -1;
  if (leftScaled > rightScaled) return 1;
  return 0;
}

function validateContractBinding() {
  const code = 'INVALID_AGREEMENT_COMPARABLE_RESULT_ORDER_CONTRACT_BINDING';
  requireExactKeys(orderingContract, [
    'object_kind',
    'stable_id',
    'schema_version',
    'definition',
  ], 'Agreement ordering contract', code);
  if (
    orderingContract.object_kind
      !== 'AGREEMENT_QUERY_ORDERING_CONTRACT_INPUT'
    || orderingContract.stable_id
      !== AGREEMENT_ORDERING_VALIDATOR_STABLE_ID
    || orderingContract.schema_version
      !== 'AGREEMENT_QUERY_ORDERING_CONTRACT_INPUT/V1'
    || orderingContract.definition?.domain_key !== 'AGREEMENT'
    || orderingContract.definition?.contract_type
      !== 'COMPARABLE_RESULT_ORDERING_DEFINITION'
    || orderingContract.definition?.contract_version !== 1
  ) {
    fail(code, 'The Agreement ordering contract identity changed.');
  }
  const digest = sha256Hex(Buffer.from(
    canonicalJson(orderingContract.definition),
    'utf8',
  ));
  if (digest !== AGREEMENT_ORDERING_CONTRACT_DEFINITION_DIGEST) {
    fail(code, 'The Agreement ordering contract definition changed.', {
      expected_definition_digest:
        AGREEMENT_ORDERING_CONTRACT_DEFINITION_DIGEST,
      actual_definition_digest: digest,
    });
  }
}

function validateQueryAndCatalogue(queryIr, catalogue) {
  const code = 'INVALID_AGREEMENT_COMPARABLE_RESULT_ORDER_BINDING';
  try {
    canonicalProductQueryIrBytes(queryIr);
  } catch (error) {
    fail(code, 'The Product Query IR is invalid.', {
      cause: error.code || error.message,
    });
  }
  try {
    validateProductFieldCatalogueManifest(catalogue);
  } catch (error) {
    fail(code, 'The Product field catalogue is invalid.', {
      cause: error.code || error.message,
    });
  }
  const release = queryIr.release_contract;
  if (
    queryIr.semantic_contract.domain_key !== 'AGREEMENT'
    || !ADMITTED_AGREEMENT_RESULT_DEFINITIONS.some((definition) => (
      canonicalJson(definition)
        === canonicalJson(queryIr.semantic_contract.result_definition)
    ))
  ) {
    fail(code, 'The query does not select the Agreement result definition.');
  }
  if (
    catalogue.approved_pm_data_version_id
      !== release.approved_pm_data_version_id
    || catalogue.candidate_release_manifest_id
      !== release.candidate_release_manifest_id
    || catalogue.candidate_release_manifest_payload_digest
      !== release.candidate_release_manifest_payload_digest
    || catalogue.manifest_id
      !== release.product_field_catalogue_manifest_id
    || catalogue.canonical_payload_digest
      !== release.product_field_catalogue_payload_digest
  ) {
    fail(code, 'The query and Product field catalogue do not bind.');
  }
  if (
    !Number.isSafeInteger(queryIr.pagination_contract.page_size)
    || queryIr.pagination_contract.page_size < MIN_PAGE_SIZE
    || queryIr.pagination_contract.page_size > MAX_PAGE_SIZE
  ) {
    fail(
      'INVALID_AGREEMENT_COMPARABLE_RESULT_PAGE_SIZE',
      'The Agreement result page size must be between 8 and 12.',
    );
  }
}

function fieldIdentity(value) {
  return `${value.field_key}\0${value.field_version}`;
}

function selectSortFields(queryIr, catalogue) {
  const code = 'INVALID_AGREEMENT_COMPARABLE_RESULT_SORT';
  const definitions = new Map(catalogue.field_definitions.map(
    (field) => [fieldIdentity(field), field],
  ));
  return queryIr.presentation_contract.sort.map((sort, index) => {
    const field = definitions.get(fieldIdentity(sort));
    if (!field) {
      fail(code, 'A query sort field is absent from the Product catalogue.', {
        sort_index: index,
        field_key: sort.field_key,
        field_version: sort.field_version,
      });
    }
    if (
      !field.supported_domains.includes('AGREEMENT')
      || !field.permitted_result_definitions.includes(
        queryIr.semantic_contract.result_definition.stable_id,
      )
    ) {
      fail(code, 'A query sort field is not admitted for Agreement results.', {
        sort_index: index,
        field_key: sort.field_key,
        field_version: sort.field_version,
      });
    }
    if (
      field.capabilities.sort !== true
      || NON_SORTABLE_VALUE_TYPES.includes(field.value_type)
      || !SORTABLE_VALUE_TYPES.includes(field.value_type)
    ) {
      fail(
        'SORT_FIELD_TYPE_NOT_SUPPORTED',
        'The Agreement query uses a non-sortable field type.',
        {
          sort_index: index,
          field_key: sort.field_key,
          field_version: sort.field_version,
          value_type: field.value_type,
        },
      );
    }
    return {
      field_key: sort.field_key,
      field_version: sort.field_version,
      direction: sort.direction,
      value_type: field.value_type,
    };
  });
}

function requireGovernedCode(value, label, code) {
  requireText(value, label, code);
  if (!/^[A-Z][A-Z0-9]*(?:[_:-][A-Z0-9]+)*$/.test(value)) {
    fail(code, `${label} must be a governed code, not display text.`);
  }
  return value;
}

function validateCalendarDate(value, label, code) {
  const match = ISO_DATE_RE.exec(value || '');
  if (!match) {
    fail(code, `${label} must be an ISO 8601 calendar date.`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime())
    || date.toISOString().slice(0, 10) !== value
  ) {
    fail(code, `${label} is not a real calendar date.`);
  }
}

function validateComparableValue(valueType, value, label, code) {
  if (valueType === 'DEAL_REFERENCE') {
    requireExactKeys(value, ['governed_deal_id'], label, code);
    requireDigest(value.governed_deal_id, `${label} governed_deal_id`, code);
    return;
  }
  if (valueType === 'DATE') {
    requireExactKeys(value, ['iso_8601_calendar_date'], label, code);
    validateCalendarDate(
      value.iso_8601_calendar_date,
      `${label} iso_8601_calendar_date`,
      code,
    );
    return;
  }
  if (valueType === 'ENTITY_REFERENCE') {
    requireExactKeys(value, ['governed_entity_id'], label, code);
    requireDigest(
      value.governed_entity_id,
      `${label} governed_entity_id`,
      code,
    );
    return;
  }
  if (valueType === 'MONEY_WITH_BASIS') {
    requireExactKeys(value, [
      'value_basis_code',
      'iso_4217_currency_code',
      'canonical_decimal_amount',
    ], label, code);
    requireGovernedCode(
      value.value_basis_code,
      `${label} value_basis_code`,
      code,
    );
    if (!/^[A-Z]{3}$/.test(value.iso_4217_currency_code || '')) {
      fail(code, `${label} currency must be an ISO 4217 code.`);
    }
    if (!CANONICAL_DECIMAL_RE.test(value.canonical_decimal_amount || '')) {
      fail(code, `${label} amount must be a canonical decimal string.`);
    }
    return;
  }
  if (valueType === 'ENUM') {
    requireExactKeys(value, ['ordered_governed_enum_codes'], label, code);
    if (
      !Array.isArray(value.ordered_governed_enum_codes)
      || value.ordered_governed_enum_codes.length === 0
      || value.ordered_governed_enum_codes.length > 64
    ) {
      fail(code, `${label} must contain governed enum codes.`);
    }
    value.ordered_governed_enum_codes.forEach((entry, index) => {
      requireGovernedCode(entry, `${label} enum code ${index}`, code);
    });
    if (
      new Set(value.ordered_governed_enum_codes).size
        !== value.ordered_governed_enum_codes.length
    ) {
      fail(code, `${label} contains a duplicate governed enum code.`);
    }
    return;
  }
  fail('SORT_FIELD_TYPE_NOT_SUPPORTED', 'The sort value type is unsupported.', {
    value_type: valueType,
  });
}

function validateSortProjection(projection, sortField, index, code) {
  const label = `Agreement sort projection ${index}`;
  requireExactKeys(projection, [
    'field_reference',
    'value_type',
    'value_state',
    'value',
  ], label, code);
  requireExactKeys(
    projection.field_reference,
    ['field_key', 'field_version'],
    `${label} field_reference`,
    code,
  );
  if (
    projection.field_reference.field_key !== sortField.field_key
    || projection.field_reference.field_version
      !== sortField.field_version
    || projection.value_type !== sortField.value_type
  ) {
    fail(code, `${label} does not match the ordered query sort field.`);
  }
  if (projection.value_state === 'COMPARABLE_VALUE') {
    validateComparableValue(
      projection.value_type,
      projection.value,
      `${label} value`,
      code,
    );
    return;
  }
  if (!MISSING_STATES.includes(projection.value_state)) {
    fail(code, `${label} uses an unknown typed missing state.`);
  }
  if (projection.value !== null) {
    fail(code, `${label} recasts a typed missing state as a value.`);
  }
}

function orderingFailureIdentityBody(value) {
  const body = clone(value);
  delete body.failure_identity;
  return body;
}

function validateOrderingFailure(value, code) {
  requireExactKeys(value, [
    'schema_version',
    'failure_identity',
    'disposition',
  ], 'Agreement ordering failure', code);
  if (
    value.schema_version
      !== AGREEMENT_COMPARABLE_RESULT_ORDERING_FAILURE_SCHEMA
  ) {
    fail(code, 'The Agreement ordering failure schema is invalid.');
  }
  requireDigest(
    value.failure_identity,
    'Agreement ordering failure identity',
    code,
  );
  requireGovernedCode(
    value.disposition,
    'Agreement ordering failure disposition',
    code,
  );
  if (
    value.failure_identity !== contentId(
      AGREEMENT_COMPARABLE_RESULT_ORDERING_FAILURE_SCHEMA,
      orderingFailureIdentityBody(value),
    )
  ) {
    fail(code, 'The Agreement ordering failure identity is invalid.');
  }
}

function orderingFactIdentityBody(value) {
  const body = clone(value);
  delete body.ordering_fact_id;
  return body;
}

function validateOrderingFact(value, sortFields) {
  const code = 'INVALID_AGREEMENT_COMPARABLE_RESULT_ORDERING_FACT';
  requireExactKeys(value, [
    'schema_version',
    'ordering_fact_id',
    'fact_state',
    'product_query_result_identity',
    'agreement_comparable_result_identity',
    'governed_deal_admission_id',
    'sort_projections',
    'external_field_projection_validation_receipt_id',
    'external_candidate_membership_validation_receipt_id',
    'ordering_failure',
    'authority_state',
  ], 'Agreement comparable-result ordering fact', code);
  if (
    value.schema_version
      !== AGREEMENT_COMPARABLE_RESULT_ORDERING_FACT_SCHEMA
    || !FACT_STATES.includes(value.fact_state)
    || value.authority_state !== 'NOT_GRANTED'
  ) {
    fail(code, 'The Agreement ordering fact state is invalid.');
  }
  [
    'ordering_fact_id',
    'product_query_result_identity',
    'agreement_comparable_result_identity',
    'governed_deal_admission_id',
    'external_field_projection_validation_receipt_id',
    'external_candidate_membership_validation_receipt_id',
  ].forEach((key) => requireDigest(
    value[key],
    `Agreement ordering fact ${key}`,
    code,
  ));
  if (!Array.isArray(value.sort_projections)) {
    fail(code, 'Agreement sort_projections must be an array.');
  }
  if (value.fact_state === 'VALIDATED_SORT_PROJECTION') {
    if (
      value.ordering_failure !== null
      || value.sort_projections.length !== sortFields.length
    ) {
      fail(code, 'A validated Agreement ordering fact is incomplete.');
    }
    value.sort_projections.forEach((projection, index) => (
      validateSortProjection(
        projection,
        sortFields[index],
        index,
        code,
      )
    ));
  } else {
    if (value.sort_projections.length !== 0) {
      fail(code, 'An unavailable ordering fact contains a sort projection.');
    }
    validateOrderingFailure(value.ordering_failure, code);
  }
  if (
    value.ordering_fact_id !== contentId(
      AGREEMENT_COMPARABLE_RESULT_ORDERING_FACT_SCHEMA,
      orderingFactIdentityBody(value),
    )
  ) {
    fail(code, 'The Agreement ordering fact identity is invalid.');
  }
  return true;
}

function compareEnumSequences(left, right) {
  const maximum = Math.max(left.length, right.length);
  for (let index = 0; index < maximum; index += 1) {
    if (index >= left.length) return -1;
    if (index >= right.length) return 1;
    const result = compareText(left[index], right[index]);
    if (result !== 0) return result;
  }
  return 0;
}

function compareComparableValues(valueType, left, right) {
  if (valueType === 'DEAL_REFERENCE') {
    return compareText(left.governed_deal_id, right.governed_deal_id);
  }
  if (valueType === 'DATE') {
    return compareText(
      left.iso_8601_calendar_date,
      right.iso_8601_calendar_date,
    );
  }
  if (valueType === 'ENTITY_REFERENCE') {
    return compareText(left.governed_entity_id, right.governed_entity_id);
  }
  if (valueType === 'MONEY_WITH_BASIS') {
    const basis = compareText(
      left.value_basis_code,
      right.value_basis_code,
    );
    if (basis !== 0) return basis;
    const currency = compareText(
      left.iso_4217_currency_code,
      right.iso_4217_currency_code,
    );
    if (currency !== 0) return currency;
    return compareDecimals(
      left.canonical_decimal_amount,
      right.canonical_decimal_amount,
    );
  }
  if (valueType === 'ENUM') {
    return compareEnumSequences(
      left.ordered_governed_enum_codes,
      right.ordered_governed_enum_codes,
    );
  }
  fail('SORT_FIELD_TYPE_NOT_SUPPORTED', 'The sort value type is unsupported.', {
    value_type: valueType,
  });
}

function compareProjections(left, right, sortField) {
  const leftComparable = left.value_state === 'COMPARABLE_VALUE';
  const rightComparable = right.value_state === 'COMPARABLE_VALUE';
  if (leftComparable !== rightComparable) {
    return leftComparable ? -1 : 1;
  }
  if (!leftComparable) {
    return MISSING_STATES.indexOf(left.value_state)
      - MISSING_STATES.indexOf(right.value_state);
  }
  const result = compareComparableValues(
    sortField.value_type,
    left.value,
    right.value,
  );
  return sortField.direction === 'DESC' ? -result : result;
}

function compareFacts(left, right, sortFields) {
  for (let index = 0; index < sortFields.length; index += 1) {
    const result = compareProjections(
      left.sort_projections[index],
      right.sort_projections[index],
      sortFields[index],
    );
    if (result !== 0) return result;
  }
  return compareText(
    left.agreement_comparable_result_identity,
    right.agreement_comparable_result_identity,
  );
}

function diversifyByDeal(sortedFacts) {
  const buckets = [];
  const byDeal = new Map();
  for (const fact of sortedFacts) {
    let bucket = byDeal.get(fact.governed_deal_admission_id);
    if (!bucket) {
      bucket = [];
      byDeal.set(fact.governed_deal_admission_id, bucket);
      buckets.push(bucket);
    }
    bucket.push(fact);
  }
  const ordered = [];
  let remaining = true;
  for (let index = 0; remaining; index += 1) {
    remaining = false;
    for (const bucket of buckets) {
      if (index < bucket.length) {
        ordered.push(bucket[index]);
        remaining = true;
      }
    }
  }
  return ordered;
}

function projectionIdentityBody(value) {
  const body = clone(value);
  delete body.ordering_projection_id;
  delete body.canonical_payload_digest;
  return body;
}

function buildAgreementComparableResultOrder({
  product_query_ir: queryIr,
  product_field_catalogue_manifest: catalogue,
  ordering_facts: orderingFacts,
}, validateOutput) {
  validateContractBinding();
  validateQueryAndCatalogue(queryIr, catalogue);
  const sortFields = selectSortFields(queryIr, catalogue);
  if (
    !Array.isArray(orderingFacts)
    || orderingFacts.length > MAX_CANDIDATES
  ) {
    fail(
      'INVALID_AGREEMENT_COMPARABLE_RESULT_ORDERING_FACT_SET',
      'The Agreement ordering fact set is invalid or too large.',
    );
  }
  orderingFacts.forEach((fact) => validateOrderingFact(fact, sortFields));
  for (const [label, identities] of [
    [
      'Product query result',
      orderingFacts.map((fact) => fact.product_query_result_identity),
    ],
    [
      'Agreement comparable result',
      orderingFacts.map(
        (fact) => fact.agreement_comparable_result_identity,
      ),
    ],
  ]) {
    if (new Set(identities).size !== identities.length) {
      fail(
        'DUPLICATE_AGREEMENT_COMPARABLE_RESULT_CANDIDATE',
        `A ${label} candidate appears more than once.`,
      );
    }
  }
  const canonicalFacts = [...orderingFacts].sort((left, right) => (
    compareText(left.ordering_fact_id, right.ordering_fact_id)
  ));
  const orderable = canonicalFacts.filter(
    (fact) => fact.fact_state === 'VALIDATED_SORT_PROJECTION',
  );
  const unavailable = canonicalFacts.filter(
    (fact) => fact.fact_state === 'ORDERING_UNAVAILABLE',
  ).sort((left, right) => compareText(
    left.agreement_comparable_result_identity,
    right.agreement_comparable_result_identity,
  ));
  const totalOrder = [...orderable].sort(
    (left, right) => compareFacts(left, right, sortFields),
  );
  const diversified = diversifyByDeal(totalOrder);
  const orderedFacts = [...diversified, ...unavailable];
  const orderedIds = orderedFacts.map(
    (fact) => fact.agreement_comparable_result_identity,
  );
  const failedIds = unavailable.map(
    (fact) => fact.agreement_comparable_result_identity,
  );
  const release = queryIr.release_contract;
  const diversity = queryIr.presentation_contract.diversity;
  const pageSize = queryIr.pagination_contract.page_size;
  const body = {
    schema_version:
      AGREEMENT_COMPARABLE_RESULT_ORDERING_PROJECTION_SCHEMA,
    ordering_validator_stable_id:
      AGREEMENT_ORDERING_VALIDATOR_STABLE_ID,
    ordering_validator_version: AGREEMENT_ORDERING_VALIDATOR_VERSION,
    product_query_definition_id: queryIr.query_definition_id,
    approved_pm_data_version_id:
      release.approved_pm_data_version_id,
    candidate_release_manifest_id:
      release.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      release.candidate_release_manifest_payload_digest,
    product_field_catalogue_id: catalogue.manifest_id,
    product_field_catalogue_payload_digest:
      catalogue.canonical_payload_digest,
    ordered_query_sort_vector:
      clone(queryIr.presentation_contract.sort),
    query_diversity_definition_id: diversity.definition_id,
    query_diversity_payload_digest: diversity.payload_digest,
    ordering_contract_definition_digest:
      AGREEMENT_ORDERING_CONTRACT_DEFINITION_DIGEST,
    canonical_ordering_fact_set_digest: sha256Hex(Buffer.from(
      canonicalJson(canonicalFacts),
      'utf8',
    )),
    product_query_ir: clone(queryIr),
    product_field_catalogue_manifest: clone(catalogue),
    validated_ordering_facts: clone(canonicalFacts),
    candidate_count: orderingFacts.length,
    page_size: pageSize,
    ordered_agreement_result_identities: orderedIds,
    first_page_agreement_result_identities:
      orderedIds.slice(0, pageSize),
    ordered_failed_agreement_result_identities: failedIds,
    comparator_state: 'GOVERNED_TYPED_TOTAL_COMPARATOR_APPLIED',
    diversification_state:
      'STABLE_GOVERNED_DEAL_ROUND_ROBIN_APPLIED',
    failure_state: unavailable.length === 0
      ? 'NO_ORDERING_FAILURES'
      : 'TYPED_ORDERING_FAILURES_RETAINED',
    no_padding_or_repetition: true,
    projection_state: 'ORDERING_ONLY',
    serving_state: 'NOT_SERVED',
    authority_limits: clone(AUTHORITY_LIMITS),
  };
  const identityBody = projectionIdentityBody(body);
  const projection = {
    ...body,
    ordering_projection_id: contentId(
      AGREEMENT_COMPARABLE_RESULT_ORDERING_PROJECTION_SCHEMA,
      identityBody,
    ),
    canonical_payload_digest: sha256Hex(Buffer.from(
      canonicalJson(identityBody),
      'utf8',
    )),
  };
  if (validateOutput) {
    validateAgreementComparableResultOrderProjection(projection);
  }
  return deepFreeze(clone(projection));
}

function compileAgreementComparableResultOrder(input) {
  return buildAgreementComparableResultOrder(input, true);
}

function validateAgreementComparableResultOrderProjection(value) {
  const code = 'INVALID_AGREEMENT_COMPARABLE_RESULT_ORDERING_PROJECTION';
  requireExactKeys(value, [
    'schema_version',
    'ordering_projection_id',
    'canonical_payload_digest',
    'ordering_validator_stable_id',
    'ordering_validator_version',
    'product_query_definition_id',
    'approved_pm_data_version_id',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'product_field_catalogue_id',
    'product_field_catalogue_payload_digest',
    'ordered_query_sort_vector',
    'query_diversity_definition_id',
    'query_diversity_payload_digest',
    'ordering_contract_definition_digest',
    'canonical_ordering_fact_set_digest',
    'product_query_ir',
    'product_field_catalogue_manifest',
    'validated_ordering_facts',
    'candidate_count',
    'page_size',
    'ordered_agreement_result_identities',
    'first_page_agreement_result_identities',
    'ordered_failed_agreement_result_identities',
    'comparator_state',
    'diversification_state',
    'failure_state',
    'no_padding_or_repetition',
    'projection_state',
    'serving_state',
    'authority_limits',
  ], 'Agreement comparable-result ordering projection', code);
  if (
    value.schema_version
      !== AGREEMENT_COMPARABLE_RESULT_ORDERING_PROJECTION_SCHEMA
    || value.ordering_validator_stable_id
      !== AGREEMENT_ORDERING_VALIDATOR_STABLE_ID
    || value.ordering_validator_version
      !== AGREEMENT_ORDERING_VALIDATOR_VERSION
    || value.comparator_state
      !== 'GOVERNED_TYPED_TOTAL_COMPARATOR_APPLIED'
    || value.diversification_state
      !== 'STABLE_GOVERNED_DEAL_ROUND_ROBIN_APPLIED'
    || ![
      'NO_ORDERING_FAILURES',
      'TYPED_ORDERING_FAILURES_RETAINED',
    ].includes(value.failure_state)
    || value.no_padding_or_repetition !== true
    || value.projection_state !== 'ORDERING_ONLY'
    || value.serving_state !== 'NOT_SERVED'
    || canonicalJson(value.authority_limits)
      !== canonicalJson(AUTHORITY_LIMITS)
  ) {
    fail(code, 'The Agreement ordering projection state is invalid.');
  }
  const rebuilt = buildAgreementComparableResultOrder({
    product_query_ir: value.product_query_ir,
    product_field_catalogue_manifest:
      value.product_field_catalogue_manifest,
    ordering_facts: value.validated_ordering_facts,
  }, false);
  if (canonicalJson(rebuilt) !== canonicalJson(value)) {
    fail(code, 'The Agreement ordering projection was changed.');
  }
  return true;
}

module.exports = {
  AGREEMENT_COMPARABLE_RESULT_ORDERING_FACT_SCHEMA,
  AGREEMENT_COMPARABLE_RESULT_ORDERING_FAILURE_SCHEMA,
  AGREEMENT_COMPARABLE_RESULT_ORDERING_PROJECTION_SCHEMA,
  AGREEMENT_ORDERING_CONTRACT_DEFINITION_DIGEST,
  AGREEMENT_ORDERING_VALIDATOR_STABLE_ID,
  AGREEMENT_ORDERING_VALIDATOR_VERSION,
  ADMITTED_AGREEMENT_RESULT_DEFINITIONS,
  AUTHORITY_LIMITS,
  FACT_STATES,
  MAX_CANDIDATES,
  MAX_PAGE_SIZE,
  MIN_PAGE_SIZE,
  MISSING_STATES,
  NON_SORTABLE_VALUE_TYPES,
  SORTABLE_VALUE_TYPES,
  AgreementComparableResultOrderError,
  compileAgreementComparableResultOrder,
  validateAgreementComparableResultOrderProjection,
  validateOrderingFact,
};
