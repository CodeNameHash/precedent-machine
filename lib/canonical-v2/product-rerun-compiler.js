const {
  canonicalJson,
  contentId,
} = require('./canonical-bytes');
const {
  PRODUCT_QUERY_ADMISSION_CONTEXT_SCHEMA,
  canonicalProductQueryIrBytes,
  compileProductQueryTemplate,
} = require('./product-query-ir');
const {
  canonicalProductSavedQueryDefinitionBytes,
  validateProductSavedQueryDefinition,
} = require('./product-saved-query-compiler');

const PRODUCT_ACTIVE_RELEASE_RERUN_ACTION_SCHEMA =
  'PRODUCT_ACTIVE_RELEASE_RERUN_ACTION/V1';
const PRODUCT_ACTIVE_RELEASE_RESOLUTION_SCHEMA =
  'PRODUCT_ACTIVE_RELEASE_RESOLUTION/V1';
const PRODUCT_ACTIVE_RELEASE_RERUN_SCHEMA =
  'PRODUCT_ACTIVE_RELEASE_RERUN/V1';
const PRODUCT_ACTIVE_RELEASE_RERUN_REFUSAL_SCHEMA =
  'PRODUCT_ACTIVE_RELEASE_RERUN_REFUSAL/V1';
const SHA256_RE = /^[a-f0-9]{64}$/;
const INCOMPATIBLE_QUERY_CODES = Object.freeze([
  'COVERAGE_NOT_ADMITTED',
  'DETAIL_ACTION_NOT_ADMITTED',
  'EVIDENCE_REQUIREMENTS_NOT_ADMITTED',
  'FIELD_CAPABILITY_NOT_ADMITTED',
  'FIELD_NOT_ADMITTED',
  'FIELD_NOT_ADMITTED_FOR_DOMAIN',
  'FIELD_NOT_ADMITTED_FOR_RESULT',
  'OPERATOR_NOT_ADMITTED',
  'PREDICATE_NOT_ADMITTED',
  'QUERY_BUDGET_EXCEEDED',
  'RESULT_DEFINITION_NOT_ADMITTED',
  'TYPED_UNSUPPORTED',
]);

class ProductRerunCompilerError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProductRerunCompilerError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProductRerunCompilerError(code, message, details);
}

function requireObject(
  value,
  label,
  code = 'INVALID_PRODUCT_RERUN_INPUT',
) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(code, `${label} must be an object.`);
  }
}

function requireExactKeys(
  value,
  expected,
  label,
  code = 'INVALID_PRODUCT_RERUN_INPUT',
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
  code = 'INVALID_PRODUCT_RERUN_INPUT',
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
  code = 'INVALID_PRODUCT_RERUN_INPUT',
) {
  if (!SHA256_RE.test(value || '')) {
    fail(code, `${label} must be a full SHA-256 digest.`);
  }
  return value;
}

function requirePositiveInteger(
  value,
  label,
  code = 'INVALID_PRODUCT_RERUN_INPUT',
) {
  if (!Number.isSafeInteger(value) || value < 1) {
    fail(code, `${label} must be a positive safe integer.`);
  }
  return value;
}

function clone(value, code = 'INVALID_PRODUCT_RERUN_INPUT') {
  try {
    return JSON.parse(canonicalJson(value));
  } catch (error) {
    fail(code, 'The Product rerun input is not canonical JSON.', {
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

function releaseBindingFromSaved(definition) {
  return {
    candidate_release_manifest_id:
      definition.release_policy
        .source_candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      definition.release_policy
        .source_candidate_release_manifest_payload_digest,
  };
}

function releaseBindingFromAdmission(admission) {
  requireObject(
    admission,
    'Product query admission',
    'INVALID_PRODUCT_QUERY_ADMISSION',
  );
  if (admission.schema_version !== PRODUCT_QUERY_ADMISSION_CONTEXT_SCHEMA) {
    fail(
      'INVALID_PRODUCT_QUERY_ADMISSION',
      'The Product query admission schema is not supported.',
    );
  }
  return {
    candidate_release_manifest_id: requireDigest(
      admission.candidate_release_manifest_id,
      'Active candidate release manifest ID',
      'INVALID_PRODUCT_QUERY_ADMISSION',
    ),
    candidate_release_manifest_payload_digest: requireDigest(
      admission.candidate_release_manifest_payload_digest,
      'Active candidate release manifest payload digest',
      'INVALID_PRODUCT_QUERY_ADMISSION',
    ),
  };
}

function validateReleaseBinding(binding, label) {
  requireExactKeys(binding, [
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
  ], label);
  requireDigest(
    binding.candidate_release_manifest_id,
    `${label} manifest ID`,
  );
  requireDigest(
    binding.candidate_release_manifest_payload_digest,
    `${label} manifest payload digest`,
  );
}

function resolutionIdentityPayload(resolution) {
  const payload = clone(resolution);
  delete payload.resolution_id;
  return payload;
}

function validateProductActiveReleaseResolution(resolution) {
  const code = 'INVALID_PRODUCT_ACTIVE_RELEASE_RESOLUTION';
  requireExactKeys(resolution, [
    'schema_version',
    'resolution_id',
    'active_fence_identity',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'resolution_state',
    'execution_authority_state',
  ], 'Product active-release resolution', code);
  if (
    resolution.schema_version !== PRODUCT_ACTIVE_RELEASE_RESOLUTION_SCHEMA
    || resolution.resolution_state !== 'FRESH_EXTERNAL_RESOLUTION'
    || resolution.execution_authority_state !== 'NOT_GRANTED'
  ) {
    fail(
      code,
      'The Product active-release carrier is not a fresh external resolution.',
    );
  }
  requireDigest(resolution.resolution_id, 'Active resolution ID', code);
  requireDigest(
    resolution.active_fence_identity,
    'Active fence identity',
    code,
  );
  requireDigest(
    resolution.candidate_release_manifest_id,
    'Resolved active release manifest ID',
    code,
  );
  requireDigest(
    resolution.candidate_release_manifest_payload_digest,
    'Resolved active release manifest payload digest',
    code,
  );
  const expectedId = contentId(
    PRODUCT_ACTIVE_RELEASE_RESOLUTION_SCHEMA,
    resolutionIdentityPayload(resolution),
  );
  if (resolution.resolution_id !== expectedId) {
    fail(
      code,
      'The Product active-release resolution identity does not match its contents.',
    );
  }
  return true;
}

function releaseBindingFromResolution(resolution) {
  validateProductActiveReleaseResolution(resolution);
  return {
    candidate_release_manifest_id:
      resolution.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      resolution.candidate_release_manifest_payload_digest,
  };
}

function requireResolutionMatchesAdmission(resolution, admission) {
  const resolved = releaseBindingFromResolution(resolution);
  const admitted = releaseBindingFromAdmission(admission);
  if (canonicalJson(resolved) !== canonicalJson(admitted)) {
    fail(
      'ACTIVE_RELEASE_ADMISSION_MISMATCH',
      'The fresh active-release resolution does not match the Product admission.',
    );
  }
  return resolved;
}

function actionIdentityPayload(action) {
  const payload = clone(action);
  delete payload.action_id;
  return payload;
}

function validateProductActiveReleaseRerunAction({
  action,
  savedQueryDefinition,
  activeReleaseResolution,
  activeReleaseBinding,
}) {
  const code = 'INVALID_PRODUCT_RERUN_ACTION';
  requireExactKeys(action, [
    'schema_version',
    'action_id',
    'actor_principal_id',
    'saved_query_definition_id',
    'source_query_definition_id',
    'active_release_resolution_id',
    'requested_active_release_manifest_id',
    'requested_active_release_manifest_payload_digest',
    'user_action_binding_id',
    'changed_results_warning_acknowledged',
    'execution_authority_state',
  ], 'Product active-release rerun action', code);
  if (
    action.schema_version !== PRODUCT_ACTIVE_RELEASE_RERUN_ACTION_SCHEMA
    || action.changed_results_warning_acknowledged !== true
    || action.execution_authority_state !== 'NOT_GRANTED'
  ) {
    fail(
      code,
      'The Product active-release rerun requires an explicit warning acknowledgement.',
    );
  }
  requireDigest(action.action_id, 'Product rerun action ID', code);
  requireText(action.actor_principal_id, 'Rerun actor principal ID', code);
  requireDigest(
    action.saved_query_definition_id,
    'Saved query definition ID',
    code,
  );
  requireDigest(
    action.source_query_definition_id,
    'Source query definition ID',
    code,
  );
  requireDigest(
    action.active_release_resolution_id,
    'Active release resolution ID',
    code,
  );
  requireDigest(
    action.requested_active_release_manifest_id,
    'Requested active release manifest ID',
    code,
  );
  requireDigest(
    action.requested_active_release_manifest_payload_digest,
    'Requested active release manifest payload digest',
    code,
  );
  requireDigest(
    action.user_action_binding_id,
    'User action binding ID',
    code,
  );
  validateProductActiveReleaseResolution(activeReleaseResolution);
  validateReleaseBinding(
    activeReleaseBinding,
    'Action active release binding',
  );
  if (
    canonicalJson(releaseBindingFromResolution(activeReleaseResolution))
      !== canonicalJson(activeReleaseBinding)
    || action.actor_principal_id
      !== savedQueryDefinition.owner_binding.owner_principal_id
    || action.saved_query_definition_id
      !== savedQueryDefinition.saved_query_definition_id
    || action.source_query_definition_id
      !== savedQueryDefinition.source_query_ir.query_definition_id
    || action.active_release_resolution_id
      !== activeReleaseResolution.resolution_id
    || action.requested_active_release_manifest_id
      !== activeReleaseBinding.candidate_release_manifest_id
    || action.requested_active_release_manifest_payload_digest
      !== activeReleaseBinding
        .candidate_release_manifest_payload_digest
  ) {
    fail(
      code,
      'The Product rerun action does not bind the saved query, owner and active release.',
    );
  }
  const expectedId = contentId(
    PRODUCT_ACTIVE_RELEASE_RERUN_ACTION_SCHEMA,
    actionIdentityPayload(action),
  );
  if (action.action_id !== expectedId) {
    fail(
      code,
      'The Product rerun action identity does not match its canonical contents.',
    );
  }
}

function ensureReleaseChanged(original, active) {
  if (
    original.candidate_release_manifest_id
      === active.candidate_release_manifest_id
    && original.candidate_release_manifest_payload_digest
      === active.candidate_release_manifest_payload_digest
  ) {
    fail(
      'SOURCE_RELEASE_STILL_ACTIVE',
      'The saved Product query already binds the active release.',
    );
  }
}

function compileProductActiveReleaseRerunAction({
  saved_query_definition: savedQueryDefinition,
  active_admission: activeAdmission,
  active_release_resolution: activeReleaseResolution,
  actor_principal_id: actorPrincipalId,
  user_action_binding_id: userActionBindingId,
  changed_results_warning_acknowledged:
    changedResultsWarningAcknowledged,
} = {}) {
  validateProductSavedQueryDefinition(savedQueryDefinition);
  const original = releaseBindingFromSaved(savedQueryDefinition);
  const active = requireResolutionMatchesAdmission(
    activeReleaseResolution,
    activeAdmission,
  );
  ensureReleaseChanged(original, active);
  if (changedResultsWarningAcknowledged !== true) {
    fail(
      'INVALID_PRODUCT_RERUN_ACTION',
      'The changed-results warning must be acknowledged before rerun.',
    );
  }
  requireText(
    actorPrincipalId,
    'Rerun actor principal ID',
    'INVALID_PRODUCT_RERUN_ACTION',
  );
  requireDigest(
    userActionBindingId,
    'User action binding ID',
    'INVALID_PRODUCT_RERUN_ACTION',
  );
  const body = {
    schema_version: PRODUCT_ACTIVE_RELEASE_RERUN_ACTION_SCHEMA,
    actor_principal_id: actorPrincipalId,
    saved_query_definition_id:
      savedQueryDefinition.saved_query_definition_id,
    source_query_definition_id:
      savedQueryDefinition.source_query_ir.query_definition_id,
    active_release_resolution_id:
      activeReleaseResolution.resolution_id,
    requested_active_release_manifest_id:
      active.candidate_release_manifest_id,
    requested_active_release_manifest_payload_digest:
      active.candidate_release_manifest_payload_digest,
    user_action_binding_id: userActionBindingId,
    changed_results_warning_acknowledged: true,
    execution_authority_state: 'NOT_GRANTED',
  };
  const action = {
    schema_version: body.schema_version,
    action_id: contentId(
      PRODUCT_ACTIVE_RELEASE_RERUN_ACTION_SCHEMA,
      body,
    ),
    actor_principal_id: body.actor_principal_id,
    saved_query_definition_id: body.saved_query_definition_id,
    source_query_definition_id: body.source_query_definition_id,
    active_release_resolution_id:
      body.active_release_resolution_id,
    requested_active_release_manifest_id:
      body.requested_active_release_manifest_id,
    requested_active_release_manifest_payload_digest:
      body.requested_active_release_manifest_payload_digest,
    user_action_binding_id: body.user_action_binding_id,
    changed_results_warning_acknowledged:
      body.changed_results_warning_acknowledged,
    execution_authority_state: body.execution_authority_state,
  };
  validateProductActiveReleaseRerunAction({
    action,
    savedQueryDefinition,
    activeReleaseResolution,
    activeReleaseBinding: active,
  });
  return deepFreeze(clone(action));
}

function outcomeIdentityPayload(outcome, idKey) {
  const payload = clone(outcome);
  delete payload[idKey];
  return payload;
}

function validateSuccess(outcome) {
  requireExactKeys(outcome, [
    'schema_version',
    'rerun_compilation_id',
    'original_saved_query_definition',
    'user_action',
    'original_release_binding',
    'active_release_resolution',
    'active_release_binding',
    'compiled_query_ir',
    'result_state',
    'authority_state',
  ], 'Product active-release rerun');
  if (
    outcome.schema_version !== PRODUCT_ACTIVE_RELEASE_RERUN_SCHEMA
    || outcome.authority_state !== 'CANONICAL_COMPILATION_ONLY'
  ) {
    fail(
      'INVALID_PRODUCT_RERUN_OUTCOME',
      'The Product rerun compilation identity is invalid.',
    );
  }
  requireDigest(outcome.rerun_compilation_id, 'Product rerun compilation ID');
  validateProductSavedQueryDefinition(
    outcome.original_saved_query_definition,
  );
  validateReleaseBinding(
    outcome.original_release_binding,
    'Original release binding',
  );
  validateProductActiveReleaseResolution(
    outcome.active_release_resolution,
  );
  validateReleaseBinding(
    outcome.active_release_binding,
    'Active release binding',
  );
  if (
    canonicalJson(releaseBindingFromResolution(
      outcome.active_release_resolution,
    )) !== canonicalJson(outcome.active_release_binding)
  ) {
    fail(
      'INVALID_PRODUCT_RERUN_OUTCOME',
      'The rerun active-release carrier does not match its release binding.',
    );
  }
  if (
    canonicalJson(outcome.original_release_binding)
      !== canonicalJson(releaseBindingFromSaved(
        outcome.original_saved_query_definition,
      ))
  ) {
    fail(
      'INVALID_PRODUCT_RERUN_OUTCOME',
      'The original rerun release does not match the saved query.',
    );
  }
  ensureReleaseChanged(
    outcome.original_release_binding,
    outcome.active_release_binding,
  );
  validateProductActiveReleaseRerunAction({
    action: outcome.user_action,
    savedQueryDefinition: outcome.original_saved_query_definition,
    activeReleaseResolution: outcome.active_release_resolution,
    activeReleaseBinding: outcome.active_release_binding,
  });
  canonicalProductQueryIrBytes(outcome.compiled_query_ir);
  if (
    outcome.compiled_query_ir.release_contract
      .candidate_release_manifest_id
      !== outcome.active_release_binding.candidate_release_manifest_id
    || outcome.compiled_query_ir.release_contract
      .candidate_release_manifest_payload_digest
      !== outcome.active_release_binding
        .candidate_release_manifest_payload_digest
  ) {
    fail(
      'INVALID_PRODUCT_RERUN_OUTCOME',
      'The rerun Query IR does not bind the requested active release.',
    );
  }
  requireExactKeys(outcome.result_state, [
    'execution_state',
    'product_query_result_state',
    'changed_results_warning_retained',
    'original_saved_definition_state',
  ], 'Product rerun result state');
  if (
    outcome.result_state.execution_state !== 'NOT_EXECUTED'
    || outcome.result_state.product_query_result_state
      !== 'NOT_MATERIALISED'
    || outcome.result_state.changed_results_warning_retained !== true
    || outcome.result_state.original_saved_definition_state
      !== 'PRESERVED'
  ) {
    fail(
      'INVALID_PRODUCT_RERUN_OUTCOME',
      'The Product rerun result state exceeds canonical compilation authority.',
    );
  }
  const expectedId = contentId(
    PRODUCT_ACTIVE_RELEASE_RERUN_SCHEMA,
    outcomeIdentityPayload(outcome, 'rerun_compilation_id'),
  );
  if (outcome.rerun_compilation_id !== expectedId) {
    fail(
      'INVALID_PRODUCT_RERUN_OUTCOME',
      'The Product rerun compilation identity does not match its contents.',
    );
  }
}

function validateRefusal(outcome) {
  requireExactKeys(outcome, [
    'schema_version',
    'rerun_refusal_id',
    'original_saved_query_definition',
    'user_action',
    'original_release_binding',
    'active_release_resolution',
    'requested_active_release_binding',
    'reason',
    'result_state',
    'authority_state',
  ], 'Product active-release rerun refusal');
  if (
    outcome.schema_version
      !== PRODUCT_ACTIVE_RELEASE_RERUN_REFUSAL_SCHEMA
    || outcome.authority_state !== 'CANONICAL_REFUSAL_ONLY'
  ) {
    fail(
      'INVALID_PRODUCT_RERUN_REFUSAL',
      'The Product rerun refusal identity is invalid.',
    );
  }
  requireDigest(outcome.rerun_refusal_id, 'Product rerun refusal ID');
  validateProductSavedQueryDefinition(
    outcome.original_saved_query_definition,
  );
  validateReleaseBinding(
    outcome.original_release_binding,
    'Original release binding',
  );
  validateProductActiveReleaseResolution(
    outcome.active_release_resolution,
  );
  validateReleaseBinding(
    outcome.requested_active_release_binding,
    'Requested active release binding',
  );
  if (
    canonicalJson(releaseBindingFromResolution(
      outcome.active_release_resolution,
    )) !== canonicalJson(outcome.requested_active_release_binding)
  ) {
    fail(
      'INVALID_PRODUCT_RERUN_REFUSAL',
      'The refusal active-release carrier does not match its release binding.',
    );
  }
  if (
    canonicalJson(outcome.original_release_binding)
      !== canonicalJson(releaseBindingFromSaved(
        outcome.original_saved_query_definition,
      ))
  ) {
    fail(
      'INVALID_PRODUCT_RERUN_REFUSAL',
      'The refusal original release does not match the saved query.',
    );
  }
  ensureReleaseChanged(
    outcome.original_release_binding,
    outcome.requested_active_release_binding,
  );
  validateProductActiveReleaseRerunAction({
    action: outcome.user_action,
    savedQueryDefinition: outcome.original_saved_query_definition,
    activeReleaseResolution: outcome.active_release_resolution,
    activeReleaseBinding: outcome.requested_active_release_binding,
  });
  requireExactKeys(outcome.reason, [
    'code',
    'domain_key',
    'predicate_key',
    'predicate_version',
  ], 'Product rerun refusal reason');
  if (!INCOMPATIBLE_QUERY_CODES.includes(outcome.reason.code)) {
    fail(
      'INVALID_PRODUCT_RERUN_REFUSAL',
      'The Product rerun refusal reason is not registered.',
    );
  }
  requireText(outcome.reason.domain_key, 'Refusal domain key');
  requireText(outcome.reason.predicate_key, 'Refusal predicate key');
  requirePositiveInteger(
    outcome.reason.predicate_version,
    'Refusal predicate version',
  );
  requireExactKeys(outcome.result_state, [
    'disposition',
    'empty_result_rendering_permitted',
    'original_saved_definition_state',
    'changed_results_warning_retained',
  ], 'Product rerun refusal state');
  if (
    outcome.result_state.disposition !== 'TYPED_REFUSAL'
    || outcome.result_state.empty_result_rendering_permitted !== false
    || outcome.result_state.original_saved_definition_state
      !== 'PRESERVED'
    || outcome.result_state.changed_results_warning_retained !== true
  ) {
    fail(
      'INVALID_PRODUCT_RERUN_REFUSAL',
      'The Product rerun refusal state is invalid.',
    );
  }
  const expectedId = contentId(
    PRODUCT_ACTIVE_RELEASE_RERUN_REFUSAL_SCHEMA,
    outcomeIdentityPayload(outcome, 'rerun_refusal_id'),
  );
  if (outcome.rerun_refusal_id !== expectedId) {
    fail(
      'INVALID_PRODUCT_RERUN_REFUSAL',
      'The Product rerun refusal identity does not match its contents.',
    );
  }
}

function validateProductActiveReleaseRerunOutcome(outcome) {
  requireObject(outcome, 'Product active-release rerun outcome');
  if (outcome.schema_version === PRODUCT_ACTIVE_RELEASE_RERUN_SCHEMA) {
    validateSuccess(outcome);
    return true;
  }
  if (
    outcome.schema_version
      === PRODUCT_ACTIVE_RELEASE_RERUN_REFUSAL_SCHEMA
  ) {
    validateRefusal(outcome);
    return true;
  }
  fail(
    'INVALID_PRODUCT_RERUN_OUTCOME',
    'The Product rerun outcome schema is not supported.',
  );
}

function refusalOutcome({
  savedQueryDefinition,
  action,
  original,
  active,
  activeReleaseResolution,
  error,
}) {
  const semantic = savedQueryDefinition.semantic_template;
  const body = {
    schema_version: PRODUCT_ACTIVE_RELEASE_RERUN_REFUSAL_SCHEMA,
    original_saved_query_definition: clone(savedQueryDefinition),
    user_action: clone(action),
    original_release_binding: clone(original),
    active_release_resolution: clone(activeReleaseResolution),
    requested_active_release_binding: clone(active),
    reason: {
      code: error.code,
      domain_key: semantic.domain_key,
      predicate_key: semantic.predicate_key,
      predicate_version: semantic.predicate_version,
    },
    result_state: {
      disposition: 'TYPED_REFUSAL',
      empty_result_rendering_permitted: false,
      original_saved_definition_state: 'PRESERVED',
      changed_results_warning_retained: true,
    },
    authority_state: 'CANONICAL_REFUSAL_ONLY',
  };
  const outcome = {
    schema_version: body.schema_version,
    rerun_refusal_id: contentId(
      PRODUCT_ACTIVE_RELEASE_RERUN_REFUSAL_SCHEMA,
      body,
    ),
    original_saved_query_definition:
      body.original_saved_query_definition,
    user_action: body.user_action,
    original_release_binding: body.original_release_binding,
    active_release_resolution: body.active_release_resolution,
    requested_active_release_binding:
      body.requested_active_release_binding,
    reason: body.reason,
    result_state: body.result_state,
    authority_state: body.authority_state,
  };
  validateProductActiveReleaseRerunOutcome(outcome);
  return deepFreeze(clone(outcome));
}

function compileProductActiveReleaseRerun({
  saved_query_definition: savedQueryDefinition,
  active_admission: activeAdmission,
  active_release_resolution: activeReleaseResolution,
  user_action: userAction,
} = {}) {
  validateProductSavedQueryDefinition(savedQueryDefinition);
  canonicalProductSavedQueryDefinitionBytes(savedQueryDefinition);
  const original = releaseBindingFromSaved(savedQueryDefinition);
  const active = requireResolutionMatchesAdmission(
    activeReleaseResolution,
    activeAdmission,
  );
  ensureReleaseChanged(original, active);
  validateProductActiveReleaseRerunAction({
    action: userAction,
    savedQueryDefinition,
    activeReleaseResolution,
    activeReleaseBinding: active,
  });
  const semantic = savedQueryDefinition.semantic_template;
  let compiledQueryIr;
  try {
    compiledQueryIr = compileProductQueryTemplate({
      admission: activeAdmission,
      query_template: semantic.query_template,
      domain_key: semantic.domain_key,
      predicate_key: semantic.predicate_key,
      predicate_version: semantic.predicate_version,
    });
  } catch (error) {
    if (INCOMPATIBLE_QUERY_CODES.includes(error?.code)) {
      return refusalOutcome({
        savedQueryDefinition,
        action: userAction,
        original,
        active,
        activeReleaseResolution,
        error,
      });
    }
    throw error;
  }
  const body = {
    schema_version: PRODUCT_ACTIVE_RELEASE_RERUN_SCHEMA,
    original_saved_query_definition: clone(savedQueryDefinition),
    user_action: clone(userAction),
    original_release_binding: clone(original),
    active_release_resolution: clone(activeReleaseResolution),
    active_release_binding: clone(active),
    compiled_query_ir: clone(compiledQueryIr),
    result_state: {
      execution_state: 'NOT_EXECUTED',
      product_query_result_state: 'NOT_MATERIALISED',
      changed_results_warning_retained: true,
      original_saved_definition_state: 'PRESERVED',
    },
    authority_state: 'CANONICAL_COMPILATION_ONLY',
  };
  const outcome = {
    schema_version: body.schema_version,
    rerun_compilation_id: contentId(
      PRODUCT_ACTIVE_RELEASE_RERUN_SCHEMA,
      body,
    ),
    original_saved_query_definition:
      body.original_saved_query_definition,
    user_action: body.user_action,
    original_release_binding: body.original_release_binding,
    active_release_resolution: body.active_release_resolution,
    active_release_binding: body.active_release_binding,
    compiled_query_ir: body.compiled_query_ir,
    result_state: body.result_state,
    authority_state: body.authority_state,
  };
  validateProductActiveReleaseRerunOutcome(outcome);
  return deepFreeze(clone(outcome));
}

function canonicalProductActiveReleaseRerunOutcomeBytes(outcome) {
  validateProductActiveReleaseRerunOutcome(outcome);
  return Buffer.from(canonicalJson(outcome), 'utf8');
}

module.exports = {
  PRODUCT_ACTIVE_RELEASE_RERUN_ACTION_SCHEMA,
  PRODUCT_ACTIVE_RELEASE_RESOLUTION_SCHEMA,
  PRODUCT_ACTIVE_RELEASE_RERUN_REFUSAL_SCHEMA,
  PRODUCT_ACTIVE_RELEASE_RERUN_SCHEMA,
  ProductRerunCompilerError,
  canonicalProductActiveReleaseRerunOutcomeBytes,
  compileProductActiveReleaseRerun,
  compileProductActiveReleaseRerunAction,
  validateProductActiveReleaseRerunAction,
  validateProductActiveReleaseRerunOutcome,
  validateProductActiveReleaseResolution,
};
