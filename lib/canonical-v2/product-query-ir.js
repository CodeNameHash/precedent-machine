const {
  canonicalJson,
  contentId,
} = require('./canonical-bytes');
const {
  PROCESS_QUERY_ADMISSION_CONTEXT_SCHEMA,
  PROCESS_QUERY_TEMPLATE_KEYS,
  compileProcessQueryIr,
} = require('./process-query-ir');

const PRODUCT_QUERY_ADMISSION_CONTEXT_SCHEMA =
  'PRODUCT_QUERY_ADMISSION_CONTEXT/V1';
const PRODUCT_QUERY_IR_SCHEMA = 'PRODUCT_QUERY_IR/V1';
const PRODUCT_QUERY_TEMPLATE_KEYS = PROCESS_QUERY_TEMPLATE_KEYS;
const QUERY_KEYS = Object.freeze([
  'domain_key',
  'predicate_key',
  'predicate_version',
  ...PRODUCT_QUERY_TEMPLATE_KEYS,
]);
const SHA256_RE = /^[a-f0-9]{64}$/;

class ProductQueryIrError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProductQueryIrError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProductQueryIrError(code, message, details);
}

function requireObject(
  value,
  label,
  code = 'INVALID_PRODUCT_QUERY_INPUT',
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
  code = 'INVALID_PRODUCT_QUERY_INPUT',
) {
  requireObject(value, label, code);
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  if (canonicalJson(actual) !== canonicalJson(required)) {
    fail(
      code,
      `${label} fields do not match the governed contract.`,
      { actual, expected: required },
    );
  }
}

function requireText(
  value,
  label,
  code = 'INVALID_PRODUCT_QUERY_INPUT',
) {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
    fail(code, `${label} must be a non-empty trimmed string.`);
  }
  return value;
}

function requireDigest(value, label) {
  if (!SHA256_RE.test(value || '')) {
    fail('INVALID_PRODUCT_QUERY_IR', `${label} must be a full SHA-256 digest.`);
  }
  return value;
}

function requirePositiveInteger(value, label, code) {
  if (!Number.isSafeInteger(value) || value < 1) {
    fail(code, `${label} must be a positive safe integer.`);
  }
  return value;
}

function requireArray(value, label, code) {
  if (!Array.isArray(value)) {
    fail(code, `${label} must be an array.`);
  }
  return value;
}

function clone(value, code = 'INVALID_PRODUCT_QUERY_INPUT') {
  try {
    return JSON.parse(canonicalJson(value));
  } catch (error) {
    fail(
      code,
      'The Product query input is not canonical JSON.',
      { cause: error.message },
    );
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function translateSharedCompilerError(
  error,
  details = error?.details || {},
) {
  if (error instanceof ProductQueryIrError) throw error;
  const code = {
    INVALID_PROCESS_QUERY_ADMISSION: 'INVALID_PRODUCT_QUERY_ADMISSION',
    INVALID_PROCESS_QUERY_INPUT: 'INVALID_PRODUCT_QUERY_INPUT',
    INVALID_PROCESS_QUERY_IR: 'INVALID_PRODUCT_QUERY_IR',
  }[error?.code] || error?.code || 'INVALID_PRODUCT_QUERY_INPUT';
  fail(
    code,
    (error?.message || 'The Product query is invalid.')
      .replace(/\bProcess\b/g, 'Product'),
    details,
  );
}

function domainAliasMap(predicateAdmissions, selectedDomainKey) {
  if (!Array.isArray(predicateAdmissions)) {
    fail(
      'INVALID_PRODUCT_QUERY_INPUT',
      'Product query predicate_admissions must be an array.',
    );
  }
  const domainKeys = [...new Set(predicateAdmissions.map((admission, index) => {
    requireObject(admission, `Predicate admission ${index}`);
    return requireText(
      admission.domain_key,
      `Predicate admission ${index} domain_key`,
    );
  }))].sort();
  const aliases = new Map();
  let otherIndex = 0;
  for (const domainKey of domainKeys) {
    if (domainKey === selectedDomainKey) {
      aliases.set(domainKey, 'PROCESS');
    } else {
      otherIndex += 1;
      aliases.set(
        domainKey,
        `PRODUCT_VALIDATION_DOMAIN_${String(otherIndex).padStart(4, '0')}`,
      );
    }
  }
  return aliases;
}

function validateSelectedDomainFields(admission, queryIr, domainKey) {
  const fields = admission?.product_field_catalogue?.field_definitions;
  if (!Array.isArray(fields)) {
    fail(
      'INVALID_PRODUCT_QUERY_ADMISSION',
      'Product field definitions must be an array.',
    );
  }
  for (const [index, field] of fields.entries()) {
    requireObject(field, `Product field ${index}`);
    if (
      !Array.isArray(field.supported_domains)
      || field.supported_domains.length === 0
    ) {
      fail(
        'INVALID_PRODUCT_QUERY_ADMISSION',
        `Product field ${index} must have supported_domains.`,
      );
    }
    field.supported_domains.forEach((value, domainIndex) => requireText(
      value,
      `Product field ${index} supported_domains[${domainIndex}]`,
    ));
    if (new Set(field.supported_domains).size !== field.supported_domains.length) {
      fail(
        'INVALID_PRODUCT_QUERY_ADMISSION',
        `Product field ${index} supported_domains contains a duplicate.`,
      );
    }
    if (
      canonicalJson([...field.supported_domains].sort())
        !== canonicalJson(field.supported_domains)
    ) {
      fail(
        'INVALID_PRODUCT_QUERY_ADMISSION',
        `Product field ${index} supported_domains is not in canonical order.`,
      );
    }
  }

  const references = [
    ...queryIr.filter_contract.clauses,
    ...queryIr.presentation_contract.sort,
    ...queryIr.presentation_contract.requested_columns,
  ];
  const checked = new Set();
  for (const reference of references) {
    const identity = `${reference.field_key}\0${reference.field_version}`;
    if (checked.has(identity)) continue;
    checked.add(identity);
    const field = fields.find((candidate) => (
      candidate.field_key === reference.field_key
      && candidate.field_version === reference.field_version
    ));
    if (!field?.supported_domains.includes(domainKey)) {
      fail(
        'FIELD_NOT_ADMITTED_FOR_DOMAIN',
        'The field is not admitted for the selected Product domain.',
        {
          domain_key: domainKey,
          field_key: reference.field_key,
          field_version: reference.field_version,
        },
      );
    }
  }
}

function compileThroughSharedV1({ admission, query }) {
  const translatedAdmission = clone(admission);
  translatedAdmission.schema_version =
    PROCESS_QUERY_ADMISSION_CONTEXT_SCHEMA;
  const translatedQuery = clone(query);
  if (query.domain_key !== 'PROCESS') {
    const aliases = domainAliasMap(
      translatedAdmission.predicate_admissions,
      query.domain_key,
    );
    translatedAdmission.predicate_admissions = (
      translatedAdmission.predicate_admissions.map((predicate) => ({
        ...predicate,
        domain_key: aliases.get(predicate.domain_key),
      }))
    );
    translatedQuery.domain_key = 'PROCESS';
  }

  // V1 has one shared byte contract. Closed aliases reuse its full validator
  // while keeping each admitted domain distinct and restoring the selected one.
  let shared;
  try {
    shared = compileProcessQueryIr({
      admission: translatedAdmission,
      query: translatedQuery,
    });
  } catch (error) {
    const details = {
      ...(error?.details || {}),
    };
    if (details.domain_key === 'PROCESS') {
      details.domain_key = query.domain_key;
    }
    translateSharedCompilerError(error, details);
  }
  validateSelectedDomainFields(admission, shared, query.domain_key);
  const identityPayload = {
    schema_version: PRODUCT_QUERY_IR_SCHEMA,
    release_contract: shared.release_contract,
    semantic_contract: {
      ...shared.semantic_contract,
      domain_key: query.domain_key,
    },
    cohort_contract: shared.cohort_contract,
    filter_contract: shared.filter_contract,
    presentation_contract: shared.presentation_contract,
    pagination_contract: shared.pagination_contract,
    detail_action_contract: shared.detail_action_contract,
    coverage_contract: shared.coverage_contract,
  };
  return deepFreeze(clone({
    schema_version: identityPayload.schema_version,
    query_definition_id: contentId(
      PRODUCT_QUERY_IR_SCHEMA,
      identityPayload,
    ),
    release_contract: identityPayload.release_contract,
    semantic_contract: identityPayload.semantic_contract,
    cohort_contract: identityPayload.cohort_contract,
    filter_contract: identityPayload.filter_contract,
    presentation_contract: identityPayload.presentation_contract,
    pagination_contract: identityPayload.pagination_contract,
    detail_action_contract: identityPayload.detail_action_contract,
    coverage_contract: identityPayload.coverage_contract,
  }));
}

function compileProductQueryIr({ admission, query }) {
  try {
    requireObject(admission, 'Product query admission');
    if (admission.schema_version !== PRODUCT_QUERY_ADMISSION_CONTEXT_SCHEMA) {
      fail(
        'INVALID_PRODUCT_QUERY_ADMISSION',
        'The Product query admission schema is not supported.',
      );
    }
    requireExactKeys(query, QUERY_KEYS, 'Product query');
    requireText(query.domain_key, 'Product query domain_key');
    return compileThroughSharedV1({
      admission: clone(admission),
      query: clone(query),
    });
  } catch (error) {
    translateSharedCompilerError(error);
  }
}

function requireUnique(values, label, identity, code) {
  const identities = values.map(identity);
  if (new Set(identities).size !== identities.length) {
    fail(code, `${label} contains a duplicate.`);
  }
}

function requireCanonicalOrder(values, label, code) {
  const sorted = [...values].sort((left, right) => {
    const leftBytes = canonicalJson(left);
    const rightBytes = canonicalJson(right);
    return leftBytes < rightBytes ? -1 : leftBytes > rightBytes ? 1 : 0;
  });
  if (canonicalJson(values) !== canonicalJson(sorted)) {
    fail(code, `${label} is not in canonical order.`);
  }
}

function validateTextArray(value, label, code, { sorted = false } = {}) {
  const values = requireArray(value, label, code);
  values.forEach((entry, index) => requireText(
    entry,
    `${label}[${index}]`,
    code,
  ));
  requireUnique(values, label, String, code);
  if (sorted) requireCanonicalOrder(values, label, code);
  return values;
}

function validateFieldReference(value, label, code) {
  requireExactKeys(
    value,
    ['field_key', 'field_version'],
    label,
    code,
  );
  requireText(value.field_key, `${label} field_key`, code);
  requirePositiveInteger(
    value.field_version,
    `${label} field_version`,
    code,
  );
}

function validateClosedProductQueryIr(queryIr) {
  const code = 'INVALID_PRODUCT_QUERY_IR';
  requireExactKeys(queryIr, [
    'schema_version',
    'query_definition_id',
    'release_contract',
    'semantic_contract',
    'cohort_contract',
    'filter_contract',
    'presentation_contract',
    'pagination_contract',
    'detail_action_contract',
    'coverage_contract',
  ], 'Product Query IR', code);
  if (queryIr.schema_version !== PRODUCT_QUERY_IR_SCHEMA) {
    fail(code, 'The Product Query IR schema is not supported.');
  }
  requireDigest(queryIr.query_definition_id, 'query_definition_id');

  requireExactKeys(queryIr.release_contract, [
    'approved_pm_data_version_id',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'canonical_contract_identity',
    'product_field_catalogue_manifest_id',
    'product_field_catalogue_payload_digest',
    'navigation_catalogue_id',
    'navigation_catalogue_payload_digest',
  ], 'Product Query IR release contract', code);
  for (const key of [
    'approved_pm_data_version_id',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'product_field_catalogue_manifest_id',
    'product_field_catalogue_payload_digest',
    'navigation_catalogue_id',
    'navigation_catalogue_payload_digest',
  ]) {
    requireDigest(queryIr.release_contract[key], `Release ${key}`);
  }
  requireExactKeys(
    queryIr.release_contract.canonical_contract_identity,
    ['stable_id', 'version', 'payload_digest'],
    'Canonical contract identity',
    code,
  );
  requireText(
    queryIr.release_contract.canonical_contract_identity.stable_id,
    'Canonical contract stable_id',
    code,
  );
  requirePositiveInteger(
    queryIr.release_contract.canonical_contract_identity.version,
    'Canonical contract version',
    code,
  );
  requireDigest(
    queryIr.release_contract.canonical_contract_identity.payload_digest,
    'Canonical contract payload_digest',
  );

  requireExactKeys(queryIr.semantic_contract, [
    'domain_key',
    'predicate_key',
    'predicate_version',
    'predicate_admission_id',
    'result_definition',
    'evidence_requirement_ids',
  ], 'Product Query IR semantic contract', code);
  requireText(
    queryIr.semantic_contract.domain_key,
    'Semantic domain_key',
    code,
  );
  requireText(
    queryIr.semantic_contract.predicate_key,
    'Semantic predicate_key',
    code,
  );
  requirePositiveInteger(
    queryIr.semantic_contract.predicate_version,
    'Semantic predicate_version',
    code,
  );
  requireDigest(
    queryIr.semantic_contract.predicate_admission_id,
    'Semantic predicate_admission_id',
  );
  requireExactKeys(
    queryIr.semantic_contract.result_definition,
    ['stable_id', 'version'],
    'Semantic result definition',
    code,
  );
  requireText(
    queryIr.semantic_contract.result_definition.stable_id,
    'Semantic result stable_id',
    code,
  );
  requirePositiveInteger(
    queryIr.semantic_contract.result_definition.version,
    'Semantic result version',
    code,
  );
  validateTextArray(
    queryIr.semantic_contract.evidence_requirement_ids,
    'Semantic evidence requirements',
    code,
    { sorted: true },
  );

  requireExactKeys(
    queryIr.cohort_contract,
    ['cohort_definition_id', 'cohort_definition_payload_digest'],
    'Product Query IR cohort contract',
    code,
  );
  requireDigest(
    queryIr.cohort_contract.cohort_definition_id,
    'Cohort definition ID',
  );
  requireDigest(
    queryIr.cohort_contract.cohort_definition_payload_digest,
    'Cohort definition payload digest',
  );

  requireExactKeys(
    queryIr.filter_contract,
    ['clauses'],
    'Product Query IR filter contract',
    code,
  );
  const clauses = requireArray(
    queryIr.filter_contract.clauses,
    'Filter clauses',
    code,
  );
  clauses.forEach((clause, index) => {
    const label = `Filter clause ${index}`;
    requireExactKeys(clause, [
      'field_key',
      'field_version',
      'operator',
      'value',
      'field_scope',
      'multiplicity',
      'completeness_semantics',
    ], label, code);
    requireText(clause.field_key, `${label} field_key`, code);
    requirePositiveInteger(
      clause.field_version,
      `${label} field_version`,
      code,
    );
    requireText(clause.operator, `${label} operator`, code);
    requireText(clause.field_scope, `${label} field_scope`, code);
    requireText(clause.multiplicity, `${label} multiplicity`, code);
    requireText(
      clause.completeness_semantics,
      `${label} completeness_semantics`,
      code,
    );
    clone(clause.value, code);
  });
  requireUnique(clauses, 'Filter clauses', canonicalJson, code);
  requireCanonicalOrder(clauses, 'Filter clauses', code);

  requireExactKeys(queryIr.presentation_contract, [
    'sort',
    'diversity',
    'requested_columns',
  ], 'Product Query IR presentation contract', code);
  const sort = requireArray(
    queryIr.presentation_contract.sort,
    'Presentation sort',
    code,
  );
  sort.forEach((item, index) => {
    const label = `Presentation sort ${index}`;
    requireExactKeys(
      item,
      ['field_key', 'field_version', 'direction'],
      label,
      code,
    );
    requireText(item.field_key, `${label} field_key`, code);
    requirePositiveInteger(
      item.field_version,
      `${label} field_version`,
      code,
    );
    if (!['ASC', 'DESC'].includes(item.direction)) {
      fail(code, `${label} direction is invalid.`);
    }
  });
  requireUnique(
    sort,
    'Presentation sort',
    (item) => `${item.field_key}\0${item.field_version}`,
    code,
  );
  requireExactKeys(
    queryIr.presentation_contract.diversity,
    ['definition_id', 'payload_digest'],
    'Presentation diversity',
    code,
  );
  requireDigest(
    queryIr.presentation_contract.diversity.definition_id,
    'Diversity definition ID',
  );
  requireDigest(
    queryIr.presentation_contract.diversity.payload_digest,
    'Diversity payload digest',
  );
  const columns = requireArray(
    queryIr.presentation_contract.requested_columns,
    'Requested columns',
    code,
  );
  if (columns.length === 0) {
    fail(code, 'Requested columns cannot be empty.');
  }
  columns.forEach((column, index) => validateFieldReference(
    column,
    `Requested column ${index}`,
    code,
  ));
  requireUnique(
    columns,
    'Requested columns',
    (column) => `${column.field_key}\0${column.field_version}`,
    code,
  );

  requireExactKeys(
    queryIr.pagination_contract,
    ['page_size', 'cursor'],
    'Product Query IR pagination contract',
    code,
  );
  requirePositiveInteger(
    queryIr.pagination_contract.page_size,
    'Pagination page_size',
    code,
  );
  if (queryIr.pagination_contract.cursor !== null) {
    requireExactKeys(
      queryIr.pagination_contract.cursor,
      ['cursor_id', 'payload_digest'],
      'Pagination cursor',
      code,
    );
    requireDigest(
      queryIr.pagination_contract.cursor.cursor_id,
      'Pagination cursor ID',
    );
    requireDigest(
      queryIr.pagination_contract.cursor.payload_digest,
      'Pagination cursor payload digest',
    );
  }

  requireExactKeys(
    queryIr.detail_action_contract,
    ['actions'],
    'Product Query IR detail action contract',
    code,
  );
  validateTextArray(
    queryIr.detail_action_contract.actions,
    'Detail actions',
    code,
    { sorted: true },
  );

  requireExactKeys(queryIr.coverage_contract, [
    'coverage_identity',
    'coverage_payload_digest',
    'covered_set_identity',
    'exclusions_identity',
  ], 'Product Query IR coverage contract', code);
  for (const key of [
    'coverage_identity',
    'coverage_payload_digest',
    'covered_set_identity',
    'exclusions_identity',
  ]) {
    requireDigest(queryIr.coverage_contract[key], `Coverage ${key}`);
  }
}

function compileProductQueryTemplate({
  admission,
  query_template: queryTemplate,
  domain_key: domainKey,
  predicate_key: predicateKey,
  predicate_version: predicateVersion,
}) {
  requireExactKeys(
    queryTemplate,
    PRODUCT_QUERY_TEMPLATE_KEYS,
    'Product query template',
  );
  return compileProductQueryIr({
    admission,
    query: {
      domain_key: domainKey,
      predicate_key: predicateKey,
      predicate_version: predicateVersion,
      ...clone(queryTemplate),
    },
  });
}

function canonicalProductQueryIrBytes(queryIr) {
  try {
    validateClosedProductQueryIr(queryIr);
    const identityPayload = {
      schema_version: queryIr.schema_version,
      release_contract: queryIr.release_contract,
      semantic_contract: queryIr.semantic_contract,
      cohort_contract: queryIr.cohort_contract,
      filter_contract: queryIr.filter_contract,
      presentation_contract: queryIr.presentation_contract,
      pagination_contract: queryIr.pagination_contract,
      detail_action_contract: queryIr.detail_action_contract,
      coverage_contract: queryIr.coverage_contract,
    };
    const expectedId = contentId(PRODUCT_QUERY_IR_SCHEMA, identityPayload);
    if (queryIr.query_definition_id !== expectedId) {
      fail(
        'INVALID_PRODUCT_QUERY_IR',
        'The Product Query IR identity does not match its canonical contents.',
        {
          expected: expectedId,
          actual: queryIr.query_definition_id,
        },
      );
    }
    return Buffer.from(canonicalJson(queryIr), 'utf8');
  } catch (error) {
    translateSharedCompilerError(error);
  }
}

module.exports = {
  PRODUCT_QUERY_ADMISSION_CONTEXT_SCHEMA,
  PRODUCT_QUERY_IR_SCHEMA,
  PRODUCT_QUERY_TEMPLATE_KEYS,
  ProductQueryIrError,
  canonicalProductQueryIrBytes,
  compileProductQueryIr,
  compileProductQueryTemplate,
};
