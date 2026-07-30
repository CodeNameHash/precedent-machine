const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');
const productQueryContract = require(
  '../../contracts/canonical-v2/successor/product/query/product-query-ir.v1.json',
);

const PRODUCT_QUERY_ADMISSION_CONTEXT_SCHEMA =
  'PRODUCT_QUERY_ADMISSION_CONTEXT/V1';
const PRODUCT_QUERY_IR_SCHEMA = 'PRODUCT_QUERY_IR/V1';
const PRODUCT_QUERY_TEMPLATE_KEYS = Object.freeze([
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
const QUERY_KEYS = Object.freeze([
  'domain_key',
  'predicate_key',
  'predicate_version',
  ...PRODUCT_QUERY_TEMPLATE_KEYS,
]);
const SHA256_RE = /^[a-f0-9]{64}$/;
const PRODUCT_QUERY_CONTRACT_DEFINITION_DIGEST =
  '3c57cdc2827cb7275fff90084f5c12d81311358bc2b2d13704f6823b14d4b7a1';

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

function requireDigest(
  value,
  label,
  code = 'INVALID_PRODUCT_QUERY_IR',
) {
  if (!SHA256_RE.test(value || '')) {
    fail(code, `${label} must be a full SHA-256 digest.`);
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

function validateProductQueryContractBinding() {
  const code = 'INVALID_PRODUCT_QUERY_CONTRACT_BINDING';
  requireExactKeys(
    productQueryContract,
    ['object_kind', 'stable_id', 'schema_version', 'definition'],
    'Product Query IR contract',
    code,
  );
  if (
    productQueryContract.object_kind !== 'PRODUCT_QUERY_CONTRACT_INPUT'
    || productQueryContract.stable_id !== 'PRODUCT_QUERY_IR'
    || productQueryContract.schema_version !== 'PRODUCT_QUERY_CONTRACT_INPUT/V1'
    || productQueryContract.definition?.domain_key !== 'PRODUCT'
    || productQueryContract.definition?.contract_type !== 'QUERY_IR_DEFINITION'
    || productQueryContract.definition?.contract_version !== 1
    || productQueryContract.definition?.query_ir_contract?.schema_version
      !== PRODUCT_QUERY_IR_SCHEMA
    || productQueryContract.definition?.query_ir_contract
      ?.admission_context_schema_version
      !== PRODUCT_QUERY_ADMISSION_CONTEXT_SCHEMA
  ) {
    fail(code, 'The Product Query IR contract identity is invalid.');
  }
  let digest;
  try {
    digest = sha256Hex(Buffer.from(
      canonicalJson(productQueryContract.definition),
      'utf8',
    ));
  } catch (error) {
    fail(code, 'The Product Query IR contract is not canonical JSON.', {
      cause: error.message,
    });
  }
  if (digest !== PRODUCT_QUERY_CONTRACT_DEFINITION_DIGEST) {
    fail(code, 'The Product Query IR contract definition has changed.', {
      expected_definition_digest: PRODUCT_QUERY_CONTRACT_DEFINITION_DIGEST,
      actual_definition_digest: digest,
    });
  }
}

function compareCanonical(left, right) {
  const leftBytes = canonicalJson(left);
  const rightBytes = canonicalJson(right);
  return leftBytes < rightBytes ? -1 : leftBytes > rightBytes ? 1 : 0;
}

function validateFieldDefinition(field, index) {
  const code = 'INVALID_PRODUCT_QUERY_ADMISSION';
  const label = `Product field ${index}`;
  requireObject(field, label, code);
  for (const key of [
    'field_key',
    'field_version',
    'permitted_result_definitions',
    'filter_scope',
    'multiplicity',
    'capabilities',
    'supported_domains',
    'permitted_operators',
    'completeness_semantics',
  ]) {
    if (!Object.hasOwn(field, key)) {
      fail(code, `${label} has no ${key}.`);
    }
  }
  requireText(field.field_key, `${label} field_key`, code);
  requirePositiveInteger(field.field_version, `${label} field_version`, code);
  requireText(field.filter_scope, `${label} filter_scope`, code);
  requireText(field.multiplicity, `${label} multiplicity`, code);
  requireText(
    field.completeness_semantics,
    `${label} completeness_semantics`,
    code,
  );
  requireObject(field.capabilities, `${label} capabilities`, code);
  for (const capability of ['display', 'filter', 'sort']) {
    if (typeof field.capabilities[capability] !== 'boolean') {
      fail(code, `${label} capability ${capability} must be Boolean.`);
    }
  }
  for (const [key, values] of [
    ['permitted_result_definitions', field.permitted_result_definitions],
    ['supported_domains', field.supported_domains],
    ['permitted_operators', field.permitted_operators],
  ]) {
    const checked = requireArray(values, `${label} ${key}`, code);
    if (key === 'supported_domains' && checked.length === 0) {
      fail(code, `${label} supported_domains cannot be empty.`);
    }
    checked.forEach((value, valueIndex) => requireText(
      value,
      `${label} ${key}[${valueIndex}]`,
      code,
    ));
    requireUnique(checked, `${label} ${key}`, String, code);
  }
  requireCanonicalOrder(
    field.supported_domains,
    `${label} supported_domains`,
    code,
  );
}

function validatePredicateAdmission(value, index) {
  const code = 'INVALID_PRODUCT_QUERY_ADMISSION';
  const label = `Predicate admission ${index}`;
  requireExactKeys(value, [
    'domain_key',
    'predicate_key',
    'predicate_version',
    'admission_id',
    'result_definitions',
    'evidence_requirement_ids',
  ], label, code);
  requireText(value.domain_key, `${label} domain_key`, code);
  requireText(value.predicate_key, `${label} predicate_key`, code);
  requirePositiveInteger(
    value.predicate_version,
    `${label} predicate_version`,
    code,
  );
  requireDigest(value.admission_id, `${label} admission_id`, code);
  const results = requireArray(
    value.result_definitions,
    `${label} result_definitions`,
    code,
  );
  results.forEach((result, resultIndex) => {
    requireExactKeys(
      result,
      ['stable_id', 'version'],
      `${label} result definition ${resultIndex}`,
      code,
    );
    requireText(result.stable_id, `${label} result stable_id`, code);
    requirePositiveInteger(
      result.version,
      `${label} result version`,
      code,
    );
  });
  requireUnique(
    results,
    `${label} result_definitions`,
    (result) => `${result.stable_id}\0${result.version}`,
    code,
  );
  const evidence = requireArray(
    value.evidence_requirement_ids,
    `${label} evidence_requirement_ids`,
    code,
  );
  evidence.forEach((requirement, requirementIndex) => requireText(
    requirement,
    `${label} evidence_requirement_ids[${requirementIndex}]`,
    code,
  ));
  requireUnique(
    evidence,
    `${label} evidence_requirement_ids`,
    String,
    code,
  );
}

function validateProductAdmission(admission) {
  const code = 'INVALID_PRODUCT_QUERY_ADMISSION';
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
  ], 'Product query admission context', code);
  if (admission.schema_version !== PRODUCT_QUERY_ADMISSION_CONTEXT_SCHEMA) {
    fail(code, 'The Product query admission schema is not supported.');
  }
  for (const key of [
    'approved_pm_data_version_id',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
  ]) {
    requireDigest(admission[key], key, code);
  }
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
    code,
  );

  requireExactKeys(admission.navigation_catalogue, [
    'stable_id',
    'catalogue_id',
    'payload_digest',
  ], 'Product navigation catalogue', code);
  if (admission.navigation_catalogue.stable_id
    !== 'PRODUCT_NAVIGATION_CATALOGUE') {
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
    code,
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
  requireUnique(exactDetailActions, 'exact_detail_actions', String, code);

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
  requireUnique(coverageIdentities, 'coverage_identities', String, code);

  requireExactKeys(
    admission.route_budget,
    ['maximum_page_size'],
    'Product query route budget',
    code,
  );
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

function findField(fields, fieldKey, fieldVersion) {
  return fields.find((field) => (
    field.field_key === fieldKey && field.field_version === fieldVersion
  ));
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
    fail(
      'FIELD_CAPABILITY_NOT_ADMITTED',
      'The requested field capability is not admitted.',
      { field_key: fieldKey, field_version: fieldVersion, capability },
    );
  }
  if (!field.permitted_result_definitions.includes(resultDefinition.stable_id)) {
    fail(
      'FIELD_NOT_ADMITTED_FOR_RESULT',
      'The field is not admitted for this result definition.',
      { field_key: fieldKey, result_definition: resultDefinition.stable_id },
    );
  }
  return field;
}

function validateFilterValue(operator, value, field) {
  if (operator === 'EXISTS') {
    if (value !== null) fail('INVALID_FILTER_VALUE', 'EXISTS requires null.');
    return;
  }
  if (operator === 'ALL') {
    if (!Array.isArray(value) || value.length === 0) {
      fail('INVALID_FILTER_VALUE', 'ALL requires selected values.');
    }
    if (!field.completeness_semantics.includes('NON_VACUOUS_ALL')) {
      fail(
        'INVALID_FILTER_VALUE',
        'The field does not admit non-vacuous ALL semantics.',
      );
    }
  }
  if (['IN', 'CANONICAL_SET'].includes(operator)
    && (!Array.isArray(value) || value.length === 0)) {
    fail('INVALID_FILTER_VALUE', `${operator} requires selected values.`);
  }
  if (operator === 'NONE' && value !== null
    && (!Array.isArray(value) || value.length === 0)) {
    fail(
      'INVALID_FILTER_VALUE',
      'NONE requires null for absence or selected values.',
    );
  }
  if (!['EXISTS', 'NONE'].includes(operator) && value === null) {
    fail('INVALID_FILTER_VALUE', `${operator} requires a value.`);
  }
  clone(value);
}

function compileFilters(filters, fields, resultDefinition) {
  const compiled = requireArray(filters, 'Query filters').map(
    (filter, index) => {
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
        fail(
          'OPERATOR_NOT_ADMITTED',
          'The filter operator is not admitted for this field.',
          { field_key: filter.field_key, operator: filter.operator },
        );
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
    },
  ).sort(compareCanonical);
  requireUnique(compiled, 'Query filters', canonicalJson);
  return compiled;
}

function compileSort(sort, fields, resultDefinition) {
  const compiled = requireArray(sort, 'Query sort').map((item, index) => {
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
  const values = requireArray(columns, 'Requested columns');
  if (values.length === 0) {
    fail(
      'INVALID_PRODUCT_QUERY_INPUT',
      'At least one requested column is required.',
    );
  }
  const compiled = values.map((column, index) => {
    requireExactKeys(
      column,
      ['field_key', 'field_version'],
      `Requested column ${index}`,
    );
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
  requireExactKeys(value, ['stable_id', 'version'], 'Result definition');
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
  requireExactKeys(
    value,
    ['definition_id', 'payload_digest'],
    'Diversity definition',
  );
  requireDigest(value.definition_id, 'Diversity definition_id');
  requireDigest(value.payload_digest, 'Diversity payload_digest');
  return clone(value);
}

function validatePagination(value, maximumPageSize) {
  requireExactKeys(value, ['page_size', 'cursor'], 'Pagination contract');
  requirePositiveInteger(value.page_size, 'Pagination page_size');
  if (value.page_size > maximumPageSize) {
    fail(
      'QUERY_BUDGET_EXCEEDED',
      'The requested page size exceeds the admitted route budget.',
      {
        requested_page_size: value.page_size,
        maximum_page_size: maximumPageSize,
      },
    );
  }
  if (value.cursor !== null) {
    requireExactKeys(
      value.cursor,
      ['cursor_id', 'payload_digest'],
      'Pagination cursor',
    );
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
    fail('COVERAGE_NOT_ADMITTED', 'The coverage identity is not admitted.');
  }
  return clone(value);
}

function compileDetailActions(actions, admittedActions) {
  const compiled = requireArray(actions, 'Exact-detail actions').map(
    (action, index) => requireText(
      action,
      `Exact-detail action ${index}`,
    ),
  ).sort();
  requireUnique(compiled, 'Exact-detail actions', String);
  const unadmitted = compiled.filter((action) => !admittedActions.has(action));
  if (unadmitted.length > 0) {
    fail(
      'DETAIL_ACTION_NOT_ADMITTED',
      'An exact-detail action is not admitted.',
      { actions: unadmitted },
    );
  }
  return compiled;
}

function compileProductQueryIr({ admission, query }) {
  validateProductQueryContractBinding();
  const inputAdmission = clone(admission);
  const inputQuery = clone(query);
  const admitted = validateProductAdmission(inputAdmission);
  requireExactKeys(inputQuery, QUERY_KEYS, 'Product query');
  const selectedDomain = requireText(
    inputQuery.domain_key,
    'Product query domain_key',
  );
  requirePositiveInteger(
    inputQuery.predicate_version,
    'Product query predicate_version',
  );
  requireText(inputQuery.predicate_key, 'Product query predicate_key');
  const predicateAdmission = admitted.predicateAdmissions.find(
    (predicate) => (
      predicate.domain_key === selectedDomain
      && predicate.predicate_key === inputQuery.predicate_key
      && predicate.predicate_version === inputQuery.predicate_version
    ),
  );
  if (!predicateAdmission) {
    fail('PREDICATE_NOT_ADMITTED', 'The requested predicate is not admitted.', {
      domain_key: selectedDomain,
      predicate_key: inputQuery.predicate_key,
      predicate_version: inputQuery.predicate_version,
    });
  }
  const resultDefinition = validateResultDefinition(
    inputQuery.result_definition,
  );
  if (!predicateAdmission.result_definitions.some((result) => (
    result.stable_id === resultDefinition.stable_id
    && result.version === resultDefinition.version
  ))) {
    fail(
      'RESULT_DEFINITION_NOT_ADMITTED',
      'The result definition is not admitted for the predicate.',
    );
  }
  const evidenceRequirementIds = requireArray(
    inputQuery.evidence_requirement_ids,
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
  if (canonicalJson(evidenceRequirementIds)
    !== canonicalJson([...predicateAdmission.evidence_requirement_ids].sort())) {
    fail(
      'EVIDENCE_REQUIREMENTS_NOT_ADMITTED',
      'The exact admitted predicate evidence requirements are required.',
    );
  }

  const filterContract = {
    clauses: compileFilters(
      inputQuery.filters,
      admitted.fields,
      resultDefinition,
    ),
  };
  const presentationContract = {
    sort: compileSort(inputQuery.sort, admitted.fields, resultDefinition),
    diversity: validateDiversity(inputQuery.diversity),
    requested_columns: compileColumns(
      inputQuery.requested_columns,
      admitted.fields,
      resultDefinition,
    ),
  };
  const detailActionContract = {
    actions: compileDetailActions(
      inputQuery.detail_actions,
      admitted.exactDetailActions,
    ),
  };
  const releaseContract = {
    approved_pm_data_version_id: inputAdmission.approved_pm_data_version_id,
    candidate_release_manifest_id:
      inputAdmission.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      inputAdmission.candidate_release_manifest_payload_digest,
    canonical_contract_identity: clone(
      inputAdmission.canonical_contract_identity,
    ),
    product_field_catalogue_manifest_id:
      inputAdmission.product_field_catalogue.manifest_id,
    product_field_catalogue_payload_digest:
      inputAdmission.product_field_catalogue.payload_digest,
    navigation_catalogue_id:
      inputAdmission.navigation_catalogue.catalogue_id,
    navigation_catalogue_payload_digest:
      inputAdmission.navigation_catalogue.payload_digest,
  };
  const identityPayload = {
    schema_version: PRODUCT_QUERY_IR_SCHEMA,
    release_contract: releaseContract,
    semantic_contract: {
      domain_key: selectedDomain,
      predicate_key: inputQuery.predicate_key,
      predicate_version: inputQuery.predicate_version,
      predicate_admission_id: predicateAdmission.admission_id,
      result_definition: resultDefinition,
      evidence_requirement_ids: evidenceRequirementIds,
    },
    cohort_contract: validateCohort(inputQuery.cohort),
    filter_contract: filterContract,
    presentation_contract: presentationContract,
    pagination_contract: validatePagination(
      inputQuery.pagination,
      inputAdmission.route_budget.maximum_page_size,
    ),
    detail_action_contract: detailActionContract,
    coverage_contract: validateCoverage(
      inputQuery.coverage,
      admitted.coverageIdentities,
    ),
  };
  const productQueryIr = {
    schema_version: PRODUCT_QUERY_IR_SCHEMA,
    query_definition_id: contentId(PRODUCT_QUERY_IR_SCHEMA, identityPayload),
    release_contract: identityPayload.release_contract,
    semantic_contract: identityPayload.semantic_contract,
    cohort_contract: identityPayload.cohort_contract,
    filter_contract: identityPayload.filter_contract,
    presentation_contract: identityPayload.presentation_contract,
    pagination_contract: identityPayload.pagination_contract,
    detail_action_contract: identityPayload.detail_action_contract,
    coverage_contract: identityPayload.coverage_contract,
  };
  validateClosedProductQueryIr(productQueryIr);
  validateSelectedDomainFields(inputAdmission, productQueryIr, selectedDomain);
  return deepFreeze(clone(productQueryIr));
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
    validateProductQueryContractBinding();
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
    if (error instanceof ProductQueryIrError) throw error;
    fail('INVALID_PRODUCT_QUERY_IR', 'The Product Query IR is invalid.', {
      cause: error?.message || String(error),
    });
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
