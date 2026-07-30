const {
  canonicalJson,
  contentId,
} = require('./canonical-bytes');
const {
  canonicalProductQueryIrBytes,
} = require('./product-query-ir');
const {
  PRODUCT_QUERY_ACTION_CONTRACT_DEFINITIONS,
  validateAuthoredProductQueryActionInputs,
} = require('./product-query-action-contract-input-validator');
const {
  PRODUCT_QUERY_RESULT_CONTRACT_DEFINITIONS,
  validateAuthoredProductQueryResultInputs,
} = require('./product-query-result-contract-input-validator');
const savedQueryContract = require(
  '../../contracts/canonical-v2/successor/product/query/product-saved-query-definition.v1.json',
);
const rerunContract = require(
  '../../contracts/canonical-v2/successor/product/query/product-rerun-on-active-release.v1.json',
);
const resultContract = require(
  '../../contracts/canonical-v2/successor/product/query/product-query-result-definition.v1.json',
);
const processPhrasebookProductResultAdapterContract = require(
  '../../contracts/canonical-v2/successor/product/query/process-phrasebook-product-result-adapter.v1.json',
);

const PRODUCT_SAVED_QUERY_DEFINITION_SCHEMA =
  'PRODUCT_SAVED_QUERY_DEFINITION/V1';
const PRODUCT_SAVED_QUERY_OWNER_BINDING_SCHEMA =
  'PRODUCT_SAVED_QUERY_OWNER_BINDING/V1';
const RELEASE_MODES = Object.freeze([
  'FOLLOW_ACTIVE',
  'PINNED',
]);
const SHA256_RE = /^[a-f0-9]{64}$/;
const TEMPLATE_KEYS = Object.freeze([
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
const CONTRACT_BINDING = Object.freeze({
  product_saved_query_contract_definition_digest:
    PRODUCT_QUERY_ACTION_CONTRACT_DEFINITIONS
      .PRODUCT_SAVED_QUERY_DEFINITION.definition_digest,
  product_rerun_contract_definition_digest:
    PRODUCT_QUERY_ACTION_CONTRACT_DEFINITIONS
      .PRODUCT_RERUN_ON_ACTIVE_RELEASE.definition_digest,
  product_query_result_contract_definition_digest:
    PRODUCT_QUERY_RESULT_CONTRACT_DEFINITIONS
      .PRODUCT_QUERY_RESULT_DEFINITION.definition_digest,
});

class ProductSavedQueryCompilerError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProductSavedQueryCompilerError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProductSavedQueryCompilerError(code, message, details);
}

function requireObject(value, label, code = 'INVALID_PRODUCT_SAVED_QUERY') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(code, `${label} must be an object.`);
  }
}

function requireExactKeys(
  value,
  expected,
  label,
  code = 'INVALID_PRODUCT_SAVED_QUERY',
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

function requireText(
  value,
  label,
  code = 'INVALID_PRODUCT_SAVED_QUERY',
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

function requireDigest(
  value,
  label,
  code = 'INVALID_PRODUCT_SAVED_QUERY',
) {
  if (!SHA256_RE.test(value || '')) {
    fail(code, `${label} must be a full SHA-256 digest.`);
  }
  return value;
}

function requirePositiveInteger(
  value,
  label,
  code = 'INVALID_PRODUCT_SAVED_QUERY',
) {
  if (!Number.isSafeInteger(value) || value < 1) {
    fail(code, `${label} must be a positive safe integer.`);
  }
  return value;
}

function clone(value, code = 'INVALID_PRODUCT_SAVED_QUERY') {
  try {
    return JSON.parse(canonicalJson(value));
  } catch (error) {
    fail(code, 'The Product saved-query input is not canonical JSON.', {
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

function contractMember(canonicalValue) {
  return {
    object_kind: canonicalValue.object_kind,
    canonical_value: canonicalValue,
  };
}

function validateRuntimeContractBinding() {
  try {
    validateAuthoredProductQueryActionInputs([
      contractMember(rerunContract),
      contractMember(savedQueryContract),
    ]);
    validateAuthoredProductQueryResultInputs([
      contractMember(processPhrasebookProductResultAdapterContract),
      contractMember(resultContract),
    ]);
  } catch (error) {
    fail(
      'INVALID_PRODUCT_QUERY_ACTION_CONTRACT_BINDING',
      'The Product query-action runtime contracts have changed.',
      { cause: error.code || error.message },
    );
  }
}

function extractProductQuerySemanticTemplate(queryIr) {
  canonicalProductQueryIrBytes(queryIr);
  if (queryIr.pagination_contract.cursor !== null) {
    fail(
      'SAVED_QUERY_CURSOR_FORBIDDEN',
      'A saved Product query must not contain a pagination cursor.',
    );
  }
  return deepFreeze(clone({
    domain_key: queryIr.semantic_contract.domain_key,
    predicate_key: queryIr.semantic_contract.predicate_key,
    predicate_version: queryIr.semantic_contract.predicate_version,
    query_template: {
      result_definition: queryIr.semantic_contract.result_definition,
      evidence_requirement_ids:
        queryIr.semantic_contract.evidence_requirement_ids,
      cohort: queryIr.cohort_contract,
      filters: queryIr.filter_contract.clauses.map((clause) => ({
        field_key: clause.field_key,
        field_version: clause.field_version,
        operator: clause.operator,
        value: clause.value,
      })),
      sort: queryIr.presentation_contract.sort,
      diversity: queryIr.presentation_contract.diversity,
      requested_columns:
        queryIr.presentation_contract.requested_columns,
      pagination: queryIr.pagination_contract,
      detail_actions: queryIr.detail_action_contract.actions,
      coverage: queryIr.coverage_contract,
    },
  }));
}

function validateOwnerBinding(binding) {
  const code = 'INVALID_PRODUCT_SAVED_QUERY_OWNER';
  requireExactKeys(binding, [
    'schema_version',
    'owner_principal_id',
    'owner_authority_binding_id',
    'runtime_authorisation_state',
  ], 'Product saved-query owner binding', code);
  if (
    binding.schema_version !== PRODUCT_SAVED_QUERY_OWNER_BINDING_SCHEMA
    || binding.runtime_authorisation_state
      !== 'REQUIRED_BEFORE_USE'
  ) {
    fail(code, 'The Product saved-query owner binding is invalid.');
  }
  requireText(binding.owner_principal_id, 'Owner principal ID', code);
  requireDigest(
    binding.owner_authority_binding_id,
    'Owner authority binding ID',
    code,
  );
}

function validateReleasePolicy(policy, sourceQueryIr) {
  const code = 'INVALID_PRODUCT_SAVED_QUERY_RELEASE_POLICY';
  requireExactKeys(policy, [
    'mode',
    'source_candidate_release_manifest_id',
    'source_candidate_release_manifest_payload_digest',
    'pinned_preflight_requirement',
    'follow_active_preflight_requirement',
    'historical_serving_permitted',
  ], 'Product saved-query release policy', code);
  if (!RELEASE_MODES.includes(policy.mode)) {
    fail(code, 'The Product saved-query release mode is not registered.');
  }
  requireDigest(
    policy.source_candidate_release_manifest_id,
    'Source candidate release manifest ID',
    code,
  );
  requireDigest(
    policy.source_candidate_release_manifest_payload_digest,
    'Source candidate release manifest payload digest',
    code,
  );
  if (
    policy.source_candidate_release_manifest_id
      !== sourceQueryIr.release_contract.candidate_release_manifest_id
    || policy.source_candidate_release_manifest_payload_digest
      !== sourceQueryIr.release_contract
        .candidate_release_manifest_payload_digest
    || policy.pinned_preflight_requirement !== (
      policy.mode === 'PINNED'
        ? 'ACTIVE_MANIFEST_BYTE_EQUALITY_REQUIRED'
        : 'NOT_APPLICABLE'
    )
    || policy.follow_active_preflight_requirement !== (
      policy.mode === 'FOLLOW_ACTIVE'
        ? 'FRESH_ACTIVE_RELEASE_RECOMPILE_REQUIRED'
        : 'NOT_APPLICABLE'
    )
    || policy.historical_serving_permitted !== false
  ) {
    fail(
      code,
      'The Product saved-query release policy does not match its source query.',
    );
  }
}

function validateSemanticTemplate(template, sourceQueryIr) {
  const code = 'INVALID_PRODUCT_SAVED_QUERY_TEMPLATE';
  requireExactKeys(template, [
    'domain_key',
    'predicate_key',
    'predicate_version',
    'query_template',
  ], 'Product saved-query semantic template', code);
  requireText(template.domain_key, 'Template domain key', code);
  requireText(template.predicate_key, 'Template predicate key', code);
  requirePositiveInteger(
    template.predicate_version,
    'Template predicate version',
    code,
  );
  requireExactKeys(
    template.query_template,
    TEMPLATE_KEYS,
    'Product saved-query query template',
    code,
  );
  const expected = extractProductQuerySemanticTemplate(sourceQueryIr);
  if (canonicalJson(template) !== canonicalJson(expected)) {
    fail(
      code,
      'The Product saved-query semantic template does not match its source Query IR.',
    );
  }
}

function savedQueryIdentityPayload(definition) {
  const payload = clone(definition);
  delete payload.saved_query_definition_id;
  return payload;
}

function validateProductSavedQueryDefinition(definition) {
  validateRuntimeContractBinding();
  requireExactKeys(definition, [
    'schema_version',
    'saved_query_definition_id',
    'definition_version',
    'owner_binding',
    'release_policy',
    'source_query_ir',
    'semantic_template',
    'contract_binding',
    'authority_state',
  ], 'Product saved-query definition');
  if (
    definition.schema_version !== PRODUCT_SAVED_QUERY_DEFINITION_SCHEMA
    || definition.definition_version !== 1
    || definition.authority_state !== 'CANONICAL_DEFINITION_ONLY'
  ) {
    fail(
      'INVALID_PRODUCT_SAVED_QUERY',
      'The Product saved-query definition identity is invalid.',
    );
  }
  requireDigest(
    definition.saved_query_definition_id,
    'Product saved-query definition ID',
  );
  validateOwnerBinding(definition.owner_binding);
  canonicalProductQueryIrBytes(definition.source_query_ir);
  validateReleasePolicy(
    definition.release_policy,
    definition.source_query_ir,
  );
  validateSemanticTemplate(
    definition.semantic_template,
    definition.source_query_ir,
  );
  if (
    canonicalJson(definition.contract_binding)
      !== canonicalJson(CONTRACT_BINDING)
  ) {
    fail(
      'INVALID_PRODUCT_QUERY_ACTION_CONTRACT_BINDING',
      'The Product saved-query contract binding is invalid.',
    );
  }
  const expectedId = contentId(
    PRODUCT_SAVED_QUERY_DEFINITION_SCHEMA,
    savedQueryIdentityPayload(definition),
  );
  if (definition.saved_query_definition_id !== expectedId) {
    fail(
      'INVALID_PRODUCT_SAVED_QUERY',
      'The Product saved-query identity does not match its canonical contents.',
      {
        expected: expectedId,
        actual: definition.saved_query_definition_id,
      },
    );
  }
  return true;
}

function compileProductSavedQueryDefinition({
  query_ir: queryIr,
  release_mode: releaseMode,
  owner_binding: ownerBinding,
} = {}) {
  validateRuntimeContractBinding();
  canonicalProductQueryIrBytes(queryIr);
  if (!RELEASE_MODES.includes(releaseMode)) {
    fail(
      'INVALID_PRODUCT_SAVED_QUERY_RELEASE_POLICY',
      'The Product saved-query release mode is not registered.',
    );
  }
  validateOwnerBinding(ownerBinding);
  const sourceQueryIr = clone(queryIr);
  const body = {
    schema_version: PRODUCT_SAVED_QUERY_DEFINITION_SCHEMA,
    definition_version: 1,
    owner_binding: clone(ownerBinding),
    release_policy: {
      mode: releaseMode,
      source_candidate_release_manifest_id:
        sourceQueryIr.release_contract.candidate_release_manifest_id,
      source_candidate_release_manifest_payload_digest:
        sourceQueryIr.release_contract
          .candidate_release_manifest_payload_digest,
      pinned_preflight_requirement: releaseMode === 'PINNED'
        ? 'ACTIVE_MANIFEST_BYTE_EQUALITY_REQUIRED'
        : 'NOT_APPLICABLE',
      follow_active_preflight_requirement: releaseMode === 'FOLLOW_ACTIVE'
        ? 'FRESH_ACTIVE_RELEASE_RECOMPILE_REQUIRED'
        : 'NOT_APPLICABLE',
      historical_serving_permitted: false,
    },
    source_query_ir: sourceQueryIr,
    semantic_template:
      clone(extractProductQuerySemanticTemplate(sourceQueryIr)),
    contract_binding: clone(CONTRACT_BINDING),
    authority_state: 'CANONICAL_DEFINITION_ONLY',
  };
  const definition = {
    schema_version: body.schema_version,
    saved_query_definition_id: contentId(
      PRODUCT_SAVED_QUERY_DEFINITION_SCHEMA,
      body,
    ),
    definition_version: body.definition_version,
    owner_binding: body.owner_binding,
    release_policy: body.release_policy,
    source_query_ir: body.source_query_ir,
    semantic_template: body.semantic_template,
    contract_binding: body.contract_binding,
    authority_state: body.authority_state,
  };
  validateProductSavedQueryDefinition(definition);
  return deepFreeze(clone(definition));
}

function canonicalProductSavedQueryDefinitionBytes(definition) {
  validateProductSavedQueryDefinition(definition);
  return Buffer.from(canonicalJson(definition), 'utf8');
}

module.exports = {
  PRODUCT_SAVED_QUERY_DEFINITION_SCHEMA,
  PRODUCT_SAVED_QUERY_OWNER_BINDING_SCHEMA,
  ProductSavedQueryCompilerError,
  canonicalProductSavedQueryDefinitionBytes,
  compileProductSavedQueryDefinition,
  extractProductQuerySemanticTemplate,
  validateProductSavedQueryDefinition,
};
