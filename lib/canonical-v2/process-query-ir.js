const {
  canonicalJson,
  contentId,
} = require('./canonical-bytes');

const PROCESS_QUERY_IR_SCHEMA = 'PROCESS_QUERY_IR/V1';
const PROCESS_QUERY_ADMISSION_CONTEXT_SCHEMA =
  'PROCESS_QUERY_ADMISSION_CONTEXT/V1';
const SHA256_RE = /^[a-f0-9]{64}$/;
const QUERY_KEYS = Object.freeze([
  'domain_key',
  'predicate_key',
  'predicate_version',
  'result_definition',
  'evidence_requirement_ids',
  'cohort',
  'filters',
  'sort',
  'diversity',
  'requested_columns',
  'pagination',
  'detail_actions',
  'coverage',
]);
const PROCESS_QUERY_TEMPLATE_KEYS = Object.freeze([
  'result_definition',
  'evidence_requirement_ids',
  'cohort',
  'filters',
  'sort',
  'diversity',
  'requested_columns',
  'pagination',
  'detail_actions',
  'coverage',
]);

class ProcessQueryIrError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProcessQueryIrError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProcessQueryIrError(code, message, details);
}

function requireObject(value, label, code = 'INVALID_PROCESS_QUERY_INPUT') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(code, `${label} must be an object.`);
  }
  return value;
}

function requireExactKeys(
  value,
  expected,
  label,
  code = 'INVALID_PROCESS_QUERY_INPUT',
) {
  requireObject(value, label, code);
  const actual = Object.keys(value).sort();
  const orderedExpected = [...expected].sort();
  if (canonicalJson(actual) !== canonicalJson(orderedExpected)) {
    fail(code, `${label} fields do not match the governed contract.`, {
      actual,
      expected: orderedExpected,
    });
  }
}

function requireText(value, label, code = 'INVALID_PROCESS_QUERY_INPUT') {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
    fail(code, `${label} must be a non-empty trimmed string.`);
  }
  return value;
}

function requireDigest(value, label, code = 'INVALID_PROCESS_QUERY_INPUT') {
  if (!SHA256_RE.test(value || '')) {
    fail(code, `${label} must be a full SHA-256 digest.`);
  }
  return value;
}

function requirePositiveInteger(
  value,
  label,
  code = 'INVALID_PROCESS_QUERY_INPUT',
) {
  if (!Number.isSafeInteger(value) || value < 1) {
    fail(code, `${label} must be a positive safe integer.`);
  }
  return value;
}

function requireArray(value, label, code = 'INVALID_PROCESS_QUERY_INPUT') {
  if (!Array.isArray(value)) {
    fail(code, `${label} must be an array.`);
  }
  return value;
}

function clone(value) {
  try {
    return JSON.parse(canonicalJson(value));
  } catch (error) {
    fail('INVALID_PROCESS_QUERY_INPUT', 'The query input is not canonical JSON.', {
      cause: error.message,
    });
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function compareCanonical(left, right) {
  const leftBytes = canonicalJson(left);
  const rightBytes = canonicalJson(right);
  return leftBytes < rightBytes ? -1 : leftBytes > rightBytes ? 1 : 0;
}

function requireUnique(values, label, identity = (value) => canonicalJson(value)) {
  const seen = new Set();
  for (const value of values) {
    const key = identity(value);
    if (seen.has(key)) {
      fail('INVALID_PROCESS_QUERY_INPUT', `${label} contains a duplicate.`, {
        duplicate_identity: key,
      });
    }
    seen.add(key);
  }
}

function validateFieldDefinition(field, index) {
  const label = `Product field ${index}`;
  requireObject(field, label);
  const required = [
    'field_key',
    'field_version',
    'permitted_result_definitions',
    'filter_scope',
    'multiplicity',
    'capabilities',
    'permitted_operators',
    'completeness_semantics',
  ];
  for (const key of required) {
    if (!Object.hasOwn(field, key)) {
      fail('INVALID_PROCESS_QUERY_ADMISSION', `${label} has no ${key}.`);
    }
  }
  requireText(field.field_key, `${label} field_key`);
  requirePositiveInteger(field.field_version, `${label} field_version`);
  requireText(field.filter_scope, `${label} filter_scope`);
  requireText(field.multiplicity, `${label} multiplicity`);
  requireText(
    field.completeness_semantics,
    `${label} completeness_semantics`,
  );
  requireObject(field.capabilities, `${label} capabilities`);
  for (const capability of ['display', 'filter', 'sort']) {
    if (typeof field.capabilities[capability] !== 'boolean') {
      fail(
        'INVALID_PROCESS_QUERY_ADMISSION',
        `${label} capability ${capability} must be Boolean.`,
      );
    }
  }
  requireArray(
    field.permitted_result_definitions,
    `${label} permitted_result_definitions`,
  ).forEach((value, valueIndex) => requireText(
    value,
    `${label} permitted_result_definitions[${valueIndex}]`,
  ));
  requireArray(
    field.permitted_operators,
    `${label} permitted_operators`,
  ).forEach((value, valueIndex) => requireText(
    value,
    `${label} permitted_operators[${valueIndex}]`,
  ));
  requireUnique(
    field.permitted_result_definitions,
    `${label} permitted_result_definitions`,
    String,
  );
  requireUnique(
    field.permitted_operators,
    `${label} permitted_operators`,
    String,
  );
}

function validatePredicateAdmission(value, index) {
  const label = `Predicate admission ${index}`;
  requireExactKeys(value, [
    'domain_key',
    'predicate_key',
    'predicate_version',
    'admission_id',
    'result_definitions',
    'evidence_requirement_ids',
  ], label, 'INVALID_PROCESS_QUERY_ADMISSION');
  requireText(value.domain_key, `${label} domain_key`);
  requireText(value.predicate_key, `${label} predicate_key`);
  requirePositiveInteger(value.predicate_version, `${label} predicate_version`);
  requireDigest(value.admission_id, `${label} admission_id`);
  requireArray(value.result_definitions, `${label} result_definitions`)
    .forEach((result, resultIndex) => {
      requireExactKeys(result, [
        'stable_id',
        'version',
      ], `${label} result definition ${resultIndex}`);
      requireText(result.stable_id, `${label} result stable_id`);
      requirePositiveInteger(result.version, `${label} result version`);
    });
  requireUnique(
    value.result_definitions,
    `${label} result_definitions`,
    (result) => `${result.stable_id}\0${result.version}`,
  );
  requireArray(
    value.evidence_requirement_ids,
    `${label} evidence_requirement_ids`,
  ).forEach((requirement, requirementIndex) => requireText(
    requirement,
    `${label} evidence_requirement_ids[${requirementIndex}]`,
  ));
  requireUnique(
    value.evidence_requirement_ids,
    `${label} evidence_requirement_ids`,
    String,
  );
}

function validateAdmission(admission) {
  const code = 'INVALID_PROCESS_QUERY_ADMISSION';
  requireExactKeys(admission, [
    'schema_version',
    'approved_pm_data_version_id',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'canonical_contract_identity',
    'product_field_catalogue',
    'navigation_catalogue',
    'predicate_admissions',
    'exact_detail_actions',
    'coverage_identities',
    'route_budget',
  ], 'Process query admission context', code);
  if (admission.schema_version !== PROCESS_QUERY_ADMISSION_CONTEXT_SCHEMA) {
    fail(code, 'The Process query admission schema is not supported.');
  }
  requireDigest(
    admission.approved_pm_data_version_id,
    'approved_pm_data_version_id',
    code,
  );
  requireDigest(
    admission.candidate_release_manifest_id,
    'candidate_release_manifest_id',
    code,
  );
  requireDigest(
    admission.candidate_release_manifest_payload_digest,
    'candidate_release_manifest_payload_digest',
    code,
  );

  requireExactKeys(admission.canonical_contract_identity, [
    'stable_id',
    'version',
    'payload_digest',
  ], 'Canonical contract identity', code);
  requireText(
    admission.canonical_contract_identity.stable_id,
    'Canonical contract stable_id',
    code,
  );
  requirePositiveInteger(
    admission.canonical_contract_identity.version,
    'Canonical contract version',
    code,
  );
  requireDigest(
    admission.canonical_contract_identity.payload_digest,
    'Canonical contract payload_digest',
    code,
  );

  requireExactKeys(admission.product_field_catalogue, [
    'stable_id',
    'manifest_id',
    'payload_digest',
    'field_definitions',
  ], 'Product field catalogue', code);
  if (admission.product_field_catalogue.stable_id !== 'PRODUCT_FIELD_CATALOGUE') {
    fail(code, 'The one PM-wide ProductFieldCatalogueManifest is required.');
  }
  requireDigest(
    admission.product_field_catalogue.manifest_id,
    'Product field catalogue manifest_id',
    code,
  );
  requireDigest(
    admission.product_field_catalogue.payload_digest,
    'Product field catalogue payload_digest',
    code,
  );
  const fields = requireArray(
    admission.product_field_catalogue.field_definitions,
    'Product field catalogue field_definitions',
    code,
  );
  fields.forEach(validateFieldDefinition);
  requireUnique(
    fields,
    'Product field catalogue field_definitions',
    (field) => `${field.field_key}\0${field.field_version}`,
  );

  requireExactKeys(admission.navigation_catalogue, [
    'stable_id',
    'catalogue_id',
    'payload_digest',
  ], 'Product navigation catalogue', code);
  if (admission.navigation_catalogue.stable_id !== 'PRODUCT_NAVIGATION_CATALOGUE') {
    fail(code, 'The one PM-wide navigation catalogue is required.');
  }
  requireDigest(
    admission.navigation_catalogue.catalogue_id,
    'Product navigation catalogue catalogue_id',
    code,
  );
  requireDigest(
    admission.navigation_catalogue.payload_digest,
    'Product navigation catalogue payload_digest',
    code,
  );

  const predicateAdmissions = requireArray(
    admission.predicate_admissions,
    'predicate_admissions',
    code,
  );
  predicateAdmissions.forEach(validatePredicateAdmission);
  requireUnique(
    predicateAdmissions,
    'predicate_admissions',
    (predicate) => (
      `${predicate.domain_key}\0${predicate.predicate_key}\0${predicate.predicate_version}`
    ),
  );

  const exactDetailActions = requireArray(
    admission.exact_detail_actions,
    'exact_detail_actions',
    code,
  );
  exactDetailActions.forEach((action, index) => requireText(
    action,
    `exact_detail_actions[${index}]`,
    code,
  ));
  requireUnique(exactDetailActions, 'exact_detail_actions', String);

  const coverageIdentities = requireArray(
    admission.coverage_identities,
    'coverage_identities',
    code,
  );
  coverageIdentities.forEach((identity, index) => requireDigest(
    identity,
    `coverage_identities[${index}]`,
    code,
  ));
  requireUnique(coverageIdentities, 'coverage_identities', String);

  requireExactKeys(admission.route_budget, [
    'maximum_page_size',
  ], 'Process query route budget', code);
  requirePositiveInteger(
    admission.route_budget.maximum_page_size,
    'maximum_page_size',
    code,
  );

  return {
    fields,
    predicateAdmissions,
    exactDetailActions: new Set(exactDetailActions),
    coverageIdentities: new Set(coverageIdentities),
  };
}

function findField(fields, fieldKey, fieldVersion) {
  return fields.find(
    (field) => (
      field.field_key === fieldKey
      && field.field_version === fieldVersion
    ),
  );
}

function requireFieldForResult(
  fields,
  fieldKey,
  fieldVersion,
  resultDefinition,
  capability,
) {
  const field = findField(fields, fieldKey, fieldVersion);
  if (!field) {
    fail('FIELD_NOT_ADMITTED', 'The requested field is not admitted.', {
      field_key: fieldKey,
      field_version: fieldVersion,
    });
  }
  if (field.capabilities[capability] !== true) {
    fail('FIELD_CAPABILITY_NOT_ADMITTED', 'The requested field capability is not admitted.', {
      field_key: fieldKey,
      field_version: fieldVersion,
      capability,
    });
  }
  if (!field.permitted_result_definitions.includes(resultDefinition.stable_id)) {
    fail('FIELD_NOT_ADMITTED_FOR_RESULT', 'The field is not admitted for this result definition.', {
      field_key: fieldKey,
      result_definition: resultDefinition.stable_id,
    });
  }
  return field;
}

function validateFilterValue(operator, value, field) {
  if (operator === 'EXISTS') {
    if (value !== null) {
      fail('INVALID_FILTER_VALUE', 'EXISTS requires a null value.');
    }
    return;
  }
  if (operator === 'ALL') {
    if (!Array.isArray(value) || value.length === 0) {
      fail('INVALID_FILTER_VALUE', 'ALL requires at least one selected value.');
    }
    if (!field.completeness_semantics.includes('NON_VACUOUS_ALL')) {
      fail('INVALID_FILTER_VALUE', 'The field does not admit non-vacuous ALL semantics.');
    }
  }
  if (['IN', 'CANONICAL_SET'].includes(operator)) {
    if (!Array.isArray(value) || value.length === 0) {
      fail('INVALID_FILTER_VALUE', `${operator} requires at least one selected value.`);
    }
  }
  if (operator === 'NONE' && value !== null) {
    if (!Array.isArray(value) || value.length === 0) {
      fail(
        'INVALID_FILTER_VALUE',
        'NONE requires null for absence or a non-empty selected value set.',
      );
    }
  }
  if (!['EXISTS', 'NONE'].includes(operator) && value === null) {
    fail('INVALID_FILTER_VALUE', `${operator} requires a value.`);
  }
  clone(value);
}

function compileFilters(filters, fields, resultDefinition) {
  requireArray(filters, 'Query filters');
  const compiled = filters.map((filter, index) => {
    requireExactKeys(filter, [
      'field_key',
      'field_version',
      'operator',
      'value',
    ], `Query filter ${index}`);
    requireText(filter.field_key, `Query filter ${index} field_key`);
    requirePositiveInteger(
      filter.field_version,
      `Query filter ${index} field_version`,
    );
    requireText(filter.operator, `Query filter ${index} operator`);
    const field = requireFieldForResult(
      fields,
      filter.field_key,
      filter.field_version,
      resultDefinition,
      'filter',
    );
    if (!field.permitted_operators.includes(filter.operator)) {
      fail('OPERATOR_NOT_ADMITTED', 'The filter operator is not admitted for this field.', {
        field_key: filter.field_key,
        operator: filter.operator,
      });
    }
    validateFilterValue(filter.operator, filter.value, field);
    return {
      field_key: filter.field_key,
      field_version: filter.field_version,
      operator: filter.operator,
      value: clone(filter.value),
      field_scope: field.filter_scope,
      multiplicity: field.multiplicity,
      completeness_semantics: field.completeness_semantics,
    };
  }).sort(compareCanonical);
  requireUnique(compiled, 'Query filters');
  return compiled;
}

function compileSort(sort, fields, resultDefinition) {
  requireArray(sort, 'Query sort');
  const compiled = sort.map((item, index) => {
    requireExactKeys(item, [
      'field_key',
      'field_version',
      'direction',
    ], `Query sort ${index}`);
    if (!['ASC', 'DESC'].includes(item.direction)) {
      fail('INVALID_SORT_DIRECTION', 'Sort direction must be ASC or DESC.');
    }
    const field = requireFieldForResult(
      fields,
      item.field_key,
      item.field_version,
      resultDefinition,
      'sort',
    );
    return {
      field_key: field.field_key,
      field_version: field.field_version,
      direction: item.direction,
    };
  });
  requireUnique(
    compiled,
    'Query sort',
    (item) => `${item.field_key}\0${item.field_version}`,
  );
  return compiled;
}

function compileColumns(columns, fields, resultDefinition) {
  requireArray(columns, 'Requested columns');
  if (columns.length === 0) {
    fail('INVALID_PROCESS_QUERY_INPUT', 'At least one requested column is required.');
  }
  const compiled = columns.map((column, index) => {
    requireExactKeys(column, [
      'field_key',
      'field_version',
    ], `Requested column ${index}`);
    const field = requireFieldForResult(
      fields,
      column.field_key,
      column.field_version,
      resultDefinition,
      'display',
    );
    return {
      field_key: field.field_key,
      field_version: field.field_version,
    };
  });
  requireUnique(
    compiled,
    'Requested columns',
    (column) => `${column.field_key}\0${column.field_version}`,
  );
  return compiled;
}

function validateResultDefinition(value) {
  requireExactKeys(value, [
    'stable_id',
    'version',
  ], 'Result definition');
  requireText(value.stable_id, 'Result definition stable_id');
  requirePositiveInteger(value.version, 'Result definition version');
  return clone(value);
}

function validateCohort(value) {
  requireExactKeys(value, [
    'cohort_definition_id',
    'cohort_definition_payload_digest',
  ], 'Cohort contract');
  requireDigest(value.cohort_definition_id, 'cohort_definition_id');
  requireDigest(
    value.cohort_definition_payload_digest,
    'cohort_definition_payload_digest',
  );
  return clone(value);
}

function validateDiversity(value) {
  requireExactKeys(value, [
    'definition_id',
    'payload_digest',
  ], 'Diversity definition');
  requireDigest(value.definition_id, 'Diversity definition_id');
  requireDigest(value.payload_digest, 'Diversity payload_digest');
  return clone(value);
}

function validatePagination(value, maximumPageSize) {
  requireExactKeys(value, [
    'page_size',
    'cursor',
  ], 'Pagination contract');
  requirePositiveInteger(value.page_size, 'Pagination page_size');
  if (value.page_size > maximumPageSize) {
    fail('QUERY_BUDGET_EXCEEDED', 'The requested page size exceeds the admitted route budget.', {
      requested_page_size: value.page_size,
      maximum_page_size: maximumPageSize,
    });
  }
  if (value.cursor !== null) {
    requireExactKeys(value.cursor, [
      'cursor_id',
      'payload_digest',
    ], 'Pagination cursor');
    requireDigest(value.cursor.cursor_id, 'Pagination cursor_id');
    requireDigest(value.cursor.payload_digest, 'Pagination cursor payload_digest');
  }
  return clone(value);
}

function validateCoverage(value, coverageIdentities) {
  requireExactKeys(value, [
    'coverage_identity',
    'coverage_payload_digest',
    'covered_set_identity',
    'exclusions_identity',
  ], 'Coverage contract');
  for (const key of [
    'coverage_identity',
    'coverage_payload_digest',
    'covered_set_identity',
    'exclusions_identity',
  ]) {
    requireDigest(value[key], `Coverage ${key}`);
  }
  if (!coverageIdentities.has(value.coverage_identity)) {
    fail('COVERAGE_NOT_ADMITTED', 'The requested coverage identity is not admitted.');
  }
  return clone(value);
}

function compileDetailActions(actions, admittedActions) {
  requireArray(actions, 'Exact-detail actions');
  const compiled = actions.map((action, index) => requireText(
    action,
    `Exact-detail action ${index}`,
  )).sort();
  requireUnique(compiled, 'Exact-detail actions', String);
  const unadmitted = compiled.filter((action) => !admittedActions.has(action));
  if (unadmitted.length > 0) {
    fail('DETAIL_ACTION_NOT_ADMITTED', 'An exact-detail action is not admitted.', {
      actions: unadmitted,
    });
  }
  return compiled;
}

function compileProcessQueryIr({ admission, query }) {
  const admitted = validateAdmission(admission);
  requireExactKeys(query, QUERY_KEYS, 'Process query');
  if (query.domain_key !== 'PROCESS') {
    fail(
      'TYPED_UNSUPPORTED',
      'This compiler accepts exactly one Process domain plan.',
      { domain_key: query.domain_key },
    );
  }
  requireText(query.predicate_key, 'predicate_key');
  requirePositiveInteger(query.predicate_version, 'predicate_version');

  const predicateAdmission = admitted.predicateAdmissions.find(
    (predicate) => (
      predicate.domain_key === query.domain_key
      && predicate.predicate_key === query.predicate_key
      && predicate.predicate_version === query.predicate_version
    ),
  );
  if (!predicateAdmission) {
    fail('PREDICATE_NOT_ADMITTED', 'The requested predicate is not admitted.', {
      domain_key: query.domain_key,
      predicate_key: query.predicate_key,
      predicate_version: query.predicate_version,
    });
  }

  const resultDefinition = validateResultDefinition(query.result_definition);
  if (!predicateAdmission.result_definitions.some(
    (result) => (
      result.stable_id === resultDefinition.stable_id
      && result.version === resultDefinition.version
    ),
  )) {
    fail(
      'RESULT_DEFINITION_NOT_ADMITTED',
      'The result definition is not admitted for the predicate.',
    );
  }

  const evidenceRequirementIds = requireArray(
    query.evidence_requirement_ids,
    'evidence_requirement_ids',
  ).map((value, index) => requireText(
    value,
    `evidence_requirement_ids[${index}]`,
  )).sort();
  requireUnique(
    evidenceRequirementIds,
    'evidence_requirement_ids',
    String,
  );
  const admittedEvidence = [...predicateAdmission.evidence_requirement_ids].sort();
  if (canonicalJson(evidenceRequirementIds) !== canonicalJson(admittedEvidence)) {
    fail(
      'EVIDENCE_REQUIREMENTS_NOT_ADMITTED',
      'The exact admitted predicate evidence requirements are required.',
    );
  }

  const filterContract = {
    clauses: compileFilters(
      query.filters,
      admitted.fields,
      resultDefinition,
    ),
  };
  const presentationContract = {
    sort: compileSort(query.sort, admitted.fields, resultDefinition),
    diversity: validateDiversity(query.diversity),
    requested_columns: compileColumns(
      query.requested_columns,
      admitted.fields,
      resultDefinition,
    ),
  };
  const detailActionContract = {
    actions: compileDetailActions(
      query.detail_actions,
      admitted.exactDetailActions,
    ),
  };
  const releaseContract = {
    approved_pm_data_version_id: admission.approved_pm_data_version_id,
    candidate_release_manifest_id: admission.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      admission.candidate_release_manifest_payload_digest,
    canonical_contract_identity: clone(admission.canonical_contract_identity),
    product_field_catalogue_manifest_id:
      admission.product_field_catalogue.manifest_id,
    product_field_catalogue_payload_digest:
      admission.product_field_catalogue.payload_digest,
    navigation_catalogue_id: admission.navigation_catalogue.catalogue_id,
    navigation_catalogue_payload_digest:
      admission.navigation_catalogue.payload_digest,
  };
  const semanticContract = {
    domain_key: query.domain_key,
    predicate_key: query.predicate_key,
    predicate_version: query.predicate_version,
    predicate_admission_id: predicateAdmission.admission_id,
    result_definition: resultDefinition,
    evidence_requirement_ids: evidenceRequirementIds,
  };
  const identityPayload = {
    schema_version: PROCESS_QUERY_IR_SCHEMA,
    release_contract: releaseContract,
    semantic_contract: semanticContract,
    cohort_contract: validateCohort(query.cohort),
    filter_contract: filterContract,
    presentation_contract: presentationContract,
    pagination_contract: validatePagination(
      query.pagination,
      admission.route_budget.maximum_page_size,
    ),
    detail_action_contract: detailActionContract,
    coverage_contract: validateCoverage(
      query.coverage,
      admitted.coverageIdentities,
    ),
  };
  const queryIr = {
    schema_version: PROCESS_QUERY_IR_SCHEMA,
    query_definition_id: contentId(
      'PROCESS_QUERY_IR/V1',
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
  };
  return deepFreeze(clone(queryIr));
}

function canonicalProcessQueryIrBytes(queryIr) {
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
  ], 'Process Query IR');
  if (queryIr.schema_version !== PROCESS_QUERY_IR_SCHEMA) {
    fail('INVALID_PROCESS_QUERY_IR', 'The Process Query IR schema is not supported.');
  }
  requireDigest(queryIr.query_definition_id, 'query_definition_id');
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
  const expectedId = contentId(PROCESS_QUERY_IR_SCHEMA, identityPayload);
  if (queryIr.query_definition_id !== expectedId) {
    fail(
      'INVALID_PROCESS_QUERY_IR',
      'The Process Query IR identity does not match its canonical contents.',
      {
        expected: expectedId,
        actual: queryIr.query_definition_id,
      },
    );
  }
  return Buffer.from(canonicalJson(queryIr), 'utf8');
}

function compileProcessQueryTemplate({
  admission,
  query_template: queryTemplate,
  domain_key: domainKey,
  predicate_key: predicateKey,
  predicate_version: predicateVersion,
}) {
  requireExactKeys(
    queryTemplate,
    PROCESS_QUERY_TEMPLATE_KEYS,
    'Process query template',
  );
  return compileProcessQueryIr({
    admission,
    query: {
      domain_key: domainKey,
      predicate_key: predicateKey,
      predicate_version: predicateVersion,
      ...clone(queryTemplate),
    },
  });
}

module.exports = {
  PROCESS_QUERY_ADMISSION_CONTEXT_SCHEMA,
  PROCESS_QUERY_IR_SCHEMA,
  PROCESS_QUERY_TEMPLATE_KEYS,
  ProcessQueryIrError,
  canonicalProcessQueryIrBytes,
  compileProcessQueryIr,
  compileProcessQueryTemplate,
};
