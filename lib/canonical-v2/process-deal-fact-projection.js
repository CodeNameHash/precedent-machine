const {
  canonicalJson,
  contentId,
} = require('./canonical-bytes');
const {
  validateSharedAuthorityConsumedContractManifest,
  validateSharedAuthorityConsumerReleaseBinding,
} = require('./shared-authority-consumed-contract-manifest');

const CANONICAL_PROJECTION_SCHEMA =
  'CANONICAL_DEAL_FACT_PROJECTION_REVISION/V1';
const CANONICAL_PROJECTION_TYPE = 'CanonicalDealFactProjection';
const CANONICAL_PROJECTION_ID_DOMAIN =
  'CANONICAL_DEAL_FACT_PROJECTION/V1';
const CANONICAL_PROJECTION_REVISION_ID_DOMAIN =
  'CANONICAL_DEAL_FACT_PROJECTION_REVISION/V1';
const PROCESS_PROJECTION_SCHEMA = 'PROCESS_DEAL_FACT_PROJECTION/V1';
const PROCESS_PROJECTION_ID_DOMAIN = 'PROCESS_DEAL_FACT_PROJECTION/V1';
const PROCESS_PROJECTION_PAYLOAD_DOMAIN =
  'PROCESS_DEAL_FACT_PROJECTION_PAYLOAD/V1';

const RELEASE_IDENTITY_KEYS = Object.freeze([
  'canonical_contract_fingerprint',
  'serving_namespace_id',
  'corpus_release_id',
  'governed_deal_id',
  'projection_version',
]);

const LINEAGE_KEYS = Object.freeze([
  'terminal_type',
  'stable_occurrence_or_subject_id',
  'selected_revision_id',
  'canonical_payload_digest',
  'exact_detail_action',
  'release_identity',
]);

const AUTHORITY_LIMITS = Object.freeze({
  source_authority: 'SHARED_CANONICAL_PROJECTION_ONLY',
  canonical_write: 'NONE',
  candidate_release_write: 'NONE',
  active_release_write: 'NONE',
  database_write: 'NONE',
  activation: 'NONE',
  service_role_credential: 'PROHIBITED',
  direct_write_path: 'PROHIBITED',
  legacy_value_fallback: 'PROHIBITED',
});

const ALLOWED_STATES = new Set([
  'PRESENT',
  'ABSENT',
  'NOT_APPLICABLE',
  'NOT_EXAMINED',
  'FAILED',
]);

const FORBIDDEN_INPUT_KEYS = new Set([
  'database_row_id',
  'direct_write_path',
  'legacy_deal_facts',
  'service_role_key',
  'supabase_service_role_key',
  'write_credentials',
]);

class ProcessDealFactProjectionError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProcessDealFactProjectionError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new ProcessDealFactProjectionError(code, message, details);
}

function isPlainObject(value) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype
      || Object.getPrototypeOf(value) === null);
}

function requireObject(value, label, code) {
  if (!isPlainObject(value)) fail(code, `${label} must be an object.`);
}

function requireExactKeys(value, expected, label, code) {
  requireObject(value, label, code);
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  if (canonicalJson(actual) !== canonicalJson(required)) {
    fail(code, `${label} does not have the exact required keys.`, {
      expected: required,
      actual,
    });
  }
}

function requireExactValue(actual, expected, label, code) {
  let matches = false;
  try {
    matches = canonicalJson(actual) === canonicalJson(expected);
  } catch (error) {
    fail(code, `${label} is not canonical JSON.`, {
      cause: error.message,
    });
  }
  if (!matches) {
    fail(code, `${label} does not match the shared authority.`, {
      expected,
      actual,
    });
  }
}

function requireSha256(value, label, code) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) {
    fail(code, `${label} must be a lower-case SHA-256 value.`);
  }
}

function cloneCanonical(value, label, code) {
  try {
    return JSON.parse(canonicalJson(value));
  } catch (error) {
    fail(code, `${label} is not canonical JSON.`, {
      cause: error.message,
    });
  }
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function rejectForbiddenInput(value, path = '$') {
  if (Array.isArray(value)) {
    value.forEach((child, index) => rejectForbiddenInput(child, `${path}[${index}]`));
    return;
  }
  if (!isPlainObject(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_INPUT_KEYS.has(key)) {
      fail(
        'SHARED_PROJECTION_FORBIDDEN_INPUT',
        `The shared projection contains forbidden input ${path}.${key}.`,
      );
    }
    rejectForbiddenInput(child, `${path}.${key}`);
  }
}

function validateReleaseIdentity({ identity, binding, code }) {
  requireExactKeys(
    identity,
    RELEASE_IDENTITY_KEYS,
    'Projection release identity',
    code,
  );
  for (const key of [
    'canonical_contract_fingerprint',
    'serving_namespace_id',
    'corpus_release_id',
  ]) {
    requireSha256(identity[key], `Projection ${key}`, code);
    if (identity[key] !== binding[key]) {
      fail(
        'SHARED_PROJECTION_RELEASE_MISMATCH',
        `Projection ${key} is not the bound shared release.`,
      );
    }
  }
  if (
    typeof identity.governed_deal_id !== 'string'
    || identity.governed_deal_id.length === 0
    || !Number.isInteger(identity.projection_version)
    || identity.projection_version < 1
  ) {
    fail(code, 'Projection deal identity or version is invalid.');
  }
}

function validateLineage({
  lineage,
  entry,
  releaseIdentity,
  terminalTypes,
}) {
  const code = 'SHARED_PROJECTION_LINEAGE_MISMATCH';
  requireExactKeys(lineage, LINEAGE_KEYS, `${entry.field_key} typed lineage`, code);
  if (!terminalTypes.includes(lineage.terminal_type)) {
    fail(
      code,
      `${entry.field_key} uses an unregistered terminal lineage type.`,
      { terminal_type: lineage.terminal_type },
    );
  }
  requireSha256(
    lineage.stable_occurrence_or_subject_id,
    `${entry.field_key} stable occurrence or subject ID`,
    code,
  );
  requireSha256(
    lineage.selected_revision_id,
    `${entry.field_key} selected revision ID`,
    code,
  );
  requireSha256(
    lineage.canonical_payload_digest,
    `${entry.field_key} canonical payload digest`,
    code,
  );
  if (
    typeof lineage.exact_detail_action !== 'string'
    || lineage.exact_detail_action.length === 0
  ) {
    fail(code, `${entry.field_key} has no typed exact-detail action.`);
  }
  requireExactValue(
    lineage.release_identity,
    releaseIdentity,
    `${entry.field_key} lineage release identity`,
    'SHARED_PROJECTION_RELEASE_MISMATCH',
  );
  if (lineage.exact_detail_action !== entry.exact_detail_action) {
    fail(
      'SHARED_PROJECTION_EXACT_DETAIL_MISMATCH',
      `${entry.field_key} changes the shared exact-detail action.`,
    );
  }
}

function validateState(entry) {
  if (!ALLOWED_STATES.has(entry.typed_state)) {
    fail(
      'SHARED_PROJECTION_STATE_MISMATCH',
      `${entry.field_key} has an invalid typed state.`,
    );
  }
  if (
    entry.typed_state === 'PRESENT'
      ? entry.canonical_value === null
      : entry.canonical_value !== null
  ) {
    fail(
      'SHARED_PROJECTION_STATE_MISMATCH',
      `${entry.field_key} has a value that is inconsistent with its typed state.`,
    );
  }
  if (
    entry.display_label !== null
    && typeof entry.display_label !== 'string'
  ) {
    fail(
      'SHARED_PROJECTION_STATE_MISMATCH',
      `${entry.field_key} has an invalid display label.`,
    );
  }
}

function validateDerivation(entry) {
  if (entry.derivation_reference !== null) {
    requireSha256(
      entry.derivation_reference,
      `${entry.field_key} derivation reference`,
      'SHARED_PROJECTION_DERIVATION_MISMATCH',
    );
  }
  if (
    entry.typed_lineage.terminal_type === 'REGISTERED_DERIVATION'
    && entry.derivation_reference === null
  ) {
    fail(
      'SHARED_PROJECTION_DERIVATION_MISMATCH',
      `${entry.field_key} has registered derivation lineage without its derivation identity.`,
    );
  }
}

function validateBuyerAuthority(entry) {
  if (entry.field_key !== 'buyer' || entry.typed_state !== 'PRESENT') return;
  const code = 'SHARED_BUYER_AUTHORITY_MISMATCH';
  requireExactKeys(
    entry.canonical_value,
    ['governed_entity_id'],
    'Buyer canonical entity reference',
    code,
  );
  requireSha256(
    entry.canonical_value.governed_entity_id,
    'Buyer governed entity ID',
    code,
  );
  if (
    entry.typed_lineage.terminal_type !== 'PARTICIPANT_RELATIONSHIP_REVISION'
    || entry.exact_detail_action !== 'DEAL_PARTICIPANT_RELATIONSHIP_EVIDENCE'
  ) {
    fail(
      code,
      'A buyer requires a governed EntitySubject ID and DealParticipantRelationship lineage.',
    );
  }
}

function validateFieldEntries({
  entries,
  manifest,
  binding,
  releaseIdentity,
}) {
  if (!Array.isArray(entries)) {
    fail(
      'SHARED_PROJECTION_FIELD_SET_MISMATCH',
      'The shared projection has no field-entry array.',
    );
  }
  if (entries.some((entry) => !isPlainObject(entry))) {
    fail(
      'SHARED_PROJECTION_FIELD_SET_MISMATCH',
      'The shared projection contains a malformed field entry.',
    );
  }
  const fieldBindings = manifest.field_catalogue_contract.field_bindings;
  const expectedKeys = fieldBindings.map((field) => field.field_key);
  const actualKeys = entries.map((entry) => entry?.field_key);
  requireExactValue(
    actualKeys,
    expectedKeys,
    'Projection field order and membership',
    'SHARED_PROJECTION_FIELD_SET_MISMATCH',
  );

  const requiredEntryKeys = manifest.projection_contract.field_entry_required_keys;
  entries.forEach((entry, index) => {
    const fieldBinding = fieldBindings[index];
    requireExactKeys(
      entry,
      requiredEntryKeys,
      `${fieldBinding.field_key} field entry`,
      'SHARED_PROJECTION_FIELD_SHAPE_MISMATCH',
    );
    if (entry.field_version !== fieldBinding.field_version) {
      fail(
        'SHARED_PROJECTION_FIELD_VERSION_MISMATCH',
        `${entry.field_key} does not use the release-admitted field version.`,
      );
    }
    requireExactValue(
      entry.release_identity,
      releaseIdentity,
      `${entry.field_key} release identity`,
      'SHARED_PROJECTION_RELEASE_MISMATCH',
    );
    if (typeof entry.exact_detail_action !== 'string'
      || entry.exact_detail_action.length === 0) {
      fail(
        'SHARED_PROJECTION_EXACT_DETAIL_MISMATCH',
        `${entry.field_key} has no exact-detail action.`,
      );
    }
    if (typeof entry.conflict_indicator !== 'boolean') {
      fail(
        'SHARED_PROJECTION_CONFLICT_MISMATCH',
        `${entry.field_key} has no typed conflict indicator.`,
      );
    }
    cloneCanonical(
      entry.canonical_value,
      `${entry.field_key} canonical value`,
      'SHARED_PROJECTION_FIELD_SHAPE_MISMATCH',
    );
    rejectForbiddenInput(entry);
    validateState(entry);
    validateLineage({
      lineage: entry.typed_lineage,
      entry,
      releaseIdentity,
      terminalTypes: manifest.projection_contract.terminal_lineage_types,
    });
    validateDerivation(entry);
    validateBuyerAuthority(entry);
    validateReleaseIdentity({
      identity: entry.release_identity,
      binding,
      code: 'SHARED_PROJECTION_RELEASE_MISMATCH',
    });
  });
}

function validateCanonicalProjectionRevision({
  manifest,
  binding,
  revision,
}) {
  if (revision === null || revision === undefined) {
    fail(
      'SHARED_PROJECTION_REQUIRED',
      'The release promises a shared projection, but no projection was supplied.',
    );
  }
  const code = 'INVALID_SHARED_PROJECTION';
  requireExactKeys(revision, [
    'schema_version',
    'projection_type',
    'canonical_deal_fact_projection_id',
    'canonical_deal_fact_projection_revision_id',
    'field_entries',
    'projection_payload_digest',
    'release_identity',
    'revision_status',
  ], 'Canonical deal-fact projection revision', code);
  if (
    revision.schema_version !== CANONICAL_PROJECTION_SCHEMA
    || revision.projection_type !== CANONICAL_PROJECTION_TYPE
  ) {
    fail(code, 'The supplied object is not the approved shared projection type.');
  }
  if (revision.revision_status !== 'SELECTED') {
    fail(
      'SHARED_PROJECTION_NOT_SELECTED',
      'Process can read only the selected shared projection revision.',
    );
  }
  requireSha256(
    revision.projection_payload_digest,
    'Projection payload digest',
    code,
  );
  validateReleaseIdentity({
    identity: revision.release_identity,
    binding,
    code,
  });

  const expectedProjectionId = contentId(
    CANONICAL_PROJECTION_ID_DOMAIN,
    revision.release_identity,
  );
  if (revision.canonical_deal_fact_projection_id !== expectedProjectionId) {
    fail(
      'SHARED_PROJECTION_IDENTITY_MISMATCH',
      'The shared projection ID does not bind its exact release and deal.',
    );
  }

  validateFieldEntries({
    entries: revision.field_entries,
    manifest,
    binding,
    releaseIdentity: revision.release_identity,
  });

  const expectedRevisionId = contentId(
    CANONICAL_PROJECTION_REVISION_ID_DOMAIN,
    {
      canonical_deal_fact_projection_id:
        revision.canonical_deal_fact_projection_id,
      field_entries: revision.field_entries,
      projection_payload_digest: revision.projection_payload_digest,
      release_identity: revision.release_identity,
      revision_status: revision.revision_status,
    },
  );
  if (
    revision.canonical_deal_fact_projection_revision_id
    !== expectedRevisionId
  ) {
    fail(
      'SHARED_PROJECTION_REVISION_MISMATCH',
      'The selected shared projection revision ID does not bind its exact fields.',
    );
  }
  rejectForbiddenInput(revision);
  return revision;
}

function processProjectionIdentity(body) {
  return {
    process_deal_fact_projection_id: contentId(
      PROCESS_PROJECTION_ID_DOMAIN,
      body,
    ),
    canonical_payload_digest: contentId(
      PROCESS_PROJECTION_PAYLOAD_DOMAIN,
      body,
    ),
  };
}

function buildProcessDealFactProjection({
  manifest,
  binding,
  canonical_projection_revision,
}) {
  validateSharedAuthorityConsumedContractManifest(manifest);
  validateSharedAuthorityConsumerReleaseBinding({ manifest, binding });
  validateCanonicalProjectionRevision({
    manifest,
    binding,
    revision: canonical_projection_revision,
  });

  const body = {
    schema_version: PROCESS_PROJECTION_SCHEMA,
    consumer_domain: 'PROCESS',
    authority: 'READ_ONLY_SHARED_PROJECTION',
    shared_authority_consumer_release_binding_id:
      binding.shared_authority_consumer_release_binding_id,
    projection_contract_digest: binding.projection_contract_digest,
    field_catalogue_digest: binding.field_catalogue_digest,
    compatibility_rule: binding.compatibility_rule,
    projection_type: canonical_projection_revision.projection_type,
    canonical_deal_fact_projection_id:
      canonical_projection_revision.canonical_deal_fact_projection_id,
    canonical_deal_fact_projection_revision_id:
      canonical_projection_revision.canonical_deal_fact_projection_revision_id,
    projection_payload_digest:
      canonical_projection_revision.projection_payload_digest,
    release_identity: cloneCanonical(
      canonical_projection_revision.release_identity,
      'Projection release identity',
      'INVALID_SHARED_PROJECTION',
    ),
    revision_status: canonical_projection_revision.revision_status,
    field_entries: cloneCanonical(
      canonical_projection_revision.field_entries,
      'Projection field entries',
      'INVALID_SHARED_PROJECTION',
    ),
    field_catalogue: cloneCanonical(
      manifest.field_catalogue_contract,
      'Shared field catalogue',
      'INVALID_SHARED_PROJECTION',
    ),
    authority_limits: cloneCanonical(
      AUTHORITY_LIMITS,
      'Process projection authority limits',
      'INVALID_SHARED_PROJECTION',
    ),
  };
  return deepFreeze({
    ...body,
    ...processProjectionIdentity(body),
  });
}

function validateProcessDealFactProjection({
  manifest,
  binding,
  projection,
}) {
  validateSharedAuthorityConsumedContractManifest(manifest);
  validateSharedAuthorityConsumerReleaseBinding({ manifest, binding });
  const code = 'INVALID_PROCESS_DEAL_FACT_PROJECTION';
  requireExactKeys(projection, [
    'schema_version',
    'consumer_domain',
    'authority',
    'shared_authority_consumer_release_binding_id',
    'projection_contract_digest',
    'field_catalogue_digest',
    'compatibility_rule',
    'projection_type',
    'canonical_deal_fact_projection_id',
    'canonical_deal_fact_projection_revision_id',
    'projection_payload_digest',
    'release_identity',
    'revision_status',
    'field_entries',
    'field_catalogue',
    'authority_limits',
    'process_deal_fact_projection_id',
    'canonical_payload_digest',
  ], 'Process deal-fact projection', code);

  const body = { ...projection };
  delete body.process_deal_fact_projection_id;
  delete body.canonical_payload_digest;
  requireExactValue(
    processProjectionIdentity(body),
    {
      process_deal_fact_projection_id:
        projection.process_deal_fact_projection_id,
      canonical_payload_digest: projection.canonical_payload_digest,
    },
    'Process projection identity',
    code,
  );
  if (
    projection.schema_version !== PROCESS_PROJECTION_SCHEMA
    || projection.consumer_domain !== 'PROCESS'
    || projection.authority !== 'READ_ONLY_SHARED_PROJECTION'
    || projection.shared_authority_consumer_release_binding_id
      !== binding.shared_authority_consumer_release_binding_id
    || projection.projection_contract_digest
      !== binding.projection_contract_digest
    || projection.field_catalogue_digest !== binding.field_catalogue_digest
    || projection.compatibility_rule !== binding.compatibility_rule
  ) {
    fail(code, 'The Process projection is not bound to the shared release.');
  }
  requireExactValue(
    projection.field_catalogue,
    manifest.field_catalogue_contract,
    'Process field catalogue',
    code,
  );
  requireExactValue(
    projection.authority_limits,
    AUTHORITY_LIMITS,
    'Process projection authority limits',
    code,
  );

  try {
    validateCanonicalProjectionRevision({
      manifest,
      binding,
      revision: {
        schema_version: CANONICAL_PROJECTION_SCHEMA,
        projection_type: projection.projection_type,
        canonical_deal_fact_projection_id:
          projection.canonical_deal_fact_projection_id,
        canonical_deal_fact_projection_revision_id:
          projection.canonical_deal_fact_projection_revision_id,
        field_entries: projection.field_entries,
        projection_payload_digest: projection.projection_payload_digest,
        release_identity: projection.release_identity,
        revision_status: projection.revision_status,
      },
    });
  } catch (error) {
    if (error instanceof ProcessDealFactProjectionError) {
      fail(
        'PROCESS_PROJECTION_SOURCE_MISMATCH',
        'The Process view does not preserve the selected shared projection.',
        { source_error_code: error.code },
      );
    }
    throw error;
  }
  return projection;
}

module.exports = {
  ProcessDealFactProjectionError,
  buildProcessDealFactProjection,
  validateProcessDealFactProjection,
};
