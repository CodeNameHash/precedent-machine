const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');
const {
  validateProcessPhrasebookResultIdentity,
} = require('./process-phrasebook-result');
const {
  validateAuthoredProcessServingInputs,
} = require('./process-serving-contract-input-validator');

const servingContracts = Object.freeze([
  require(
    '../../contracts/canonical-v2/successor/process/results/process-exclusivity-event-result.v1.json',
  ),
  require(
    '../../contracts/canonical-v2/successor/process/results/process-phrasebook-passage-result.v1.json',
  ),
  require(
    '../../contracts/canonical-v2/successor/process/serving/bounded-inline-passage-preview.v1.json',
  ),
  require(
    '../../contracts/canonical-v2/successor/process/serving/parent-bound-paragraph-context.v1.json',
  ),
  require(
    '../../contracts/canonical-v2/successor/process/serving/related-passage-child-collection.v1.json',
  ),
]);

const PROCESS_RELATED_PASSAGE_PARENT_BINDING_SCHEMA =
  'PROCESS_RELATED_PASSAGE_PARENT_BINDING/V1';
const PROCESS_RELATED_PASSAGE_RELEASE_PROJECTION_SCHEMA =
  'PROCESS_RELATED_PASSAGE_RELEASE_PROJECTION/V1';
const PROCESS_RELATED_PASSAGE_CANDIDATE_SCHEMA =
  'PROCESS_RELATED_PASSAGE_CANDIDATE/V1';
const PROCESS_RELATED_PASSAGE_RELATIONSHIP_BINDING_SCHEMA =
  'PROCESS_RELATED_PASSAGE_RELATIONSHIP_BINDING/V1';
const PROCESS_RELATED_PASSAGE_PREVIEW_SCHEMA =
  'PROCESS_RELATED_PASSAGE_PREVIEW/V1';
const PROCESS_RELATED_PASSAGE_CHILD_FAILURE_SCHEMA =
  'PROCESS_RELATED_PASSAGE_CHILD_FAILURE/V1';
const PROCESS_RELATED_PASSAGES_RESPONSE_SCHEMA =
  'PROCESS_RELATED_PASSAGES_RESPONSE/V1';
const PRODUCT_EXACT_DETAIL_REFERENCE_SCHEMA =
  'PRODUCT_EXACT_DETAIL_REFERENCE/V1';
const ACTION_KEY = 'PROCESS_RELATED_PASSAGES';
const MAXIMUM_CHILDREN = 12;
const MAXIMUM_PROJECTION_CANDIDATES = 512;
const SHA256_RE = /^[a-f0-9]{64}$/;
const GOVERNED_KEY_RE = /^[A-Z0-9][A-Z0-9_-]*$/;

const AUTHORITY_LIMITS = Object.freeze({
  execution: 'NONE',
  source_read: 'NONE',
  extraction: 'NONE',
  graph_traversal: 'NONE',
  relationship_creation: 'NONE',
  query: 'NONE',
  serving: 'NONE',
  writer: 'NONE',
  release: 'NONE',
  canonical_write: 'NONE',
  database: 'NONE',
  import: 'NONE',
  activation: 'NONE',
});

class ProcessRelatedPassagesError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProcessRelatedPassagesError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProcessRelatedPassagesError(code, message, details);
}

function isPlainObject(value) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && (
      Object.getPrototypeOf(value) === Object.prototype
      || Object.getPrototypeOf(value) === null
    );
}

function requireObject(
  value,
  label,
  code = 'INVALID_PROCESS_RELATED_PASSAGES_INPUT',
) {
  if (!isPlainObject(value)) {
    fail(code, `${label} must be an object.`);
  }
}

function requireExactKeys(
  value,
  expected,
  label,
  code = 'INVALID_PROCESS_RELATED_PASSAGES_INPUT',
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
  code = 'INVALID_PROCESS_RELATED_PASSAGES_INPUT',
) {
  if (typeof value !== 'string' || !SHA256_RE.test(value)) {
    fail(code, `${label} must be a full lower-case SHA-256 digest.`);
  }
  return value;
}

function requireText(
  value,
  label,
  code = 'INVALID_PROCESS_RELATED_PASSAGES_INPUT',
  maximumBytes = 256,
  trimRequired = true,
) {
  if (
    typeof value !== 'string'
    || value.length === 0
    || (trimRequired && value.trim() !== value)
    || Buffer.byteLength(value, 'utf8') > maximumBytes
  ) {
    fail(code, `${label} must be bounded non-empty UTF-8 text.`);
  }
  return value;
}

function requireGovernedKey(
  value,
  label,
  code = 'INVALID_PROCESS_RELATED_PASSAGES_INPUT',
) {
  if (
    typeof value !== 'string'
    || !GOVERNED_KEY_RE.test(value)
    || Buffer.byteLength(value, 'utf8') > 128
  ) {
    fail(code, `${label} must be a bounded governed upper-case key.`);
  }
  return value;
}

function requireInteger(
  value,
  minimum,
  maximum,
  label,
  code = 'INVALID_PROCESS_RELATED_PASSAGES_INPUT',
) {
  if (
    !Number.isSafeInteger(value)
    || value < minimum
    || value > maximum
  ) {
    fail(code, `${label} is outside the governed range.`);
  }
  return value;
}

function clone(
  value,
  code = 'INVALID_PROCESS_RELATED_PASSAGES_INPUT',
) {
  try {
    return JSON.parse(canonicalJson(value));
  } catch (error) {
    fail(code, 'The Process related-passage value is not canonical JSON.', {
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

function without(value, key) {
  const payload = clone(value);
  delete payload[key];
  return payload;
}

function payloadDigest(value) {
  return sha256Hex(Buffer.from(canonicalJson(value), 'utf8'));
}

function compareText(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function validateContractBinding() {
  try {
    validateAuthoredProcessServingInputs(
      servingContracts.map((canonicalValue) => ({
        object_kind: canonicalValue.object_kind,
        canonical_value: canonicalValue,
      })),
    );
  } catch (error) {
    fail(
      'INVALID_PROCESS_RELATED_PASSAGES_CONTRACT_BINDING',
      'The signed Process related-passage contract has changed.',
      { cause: error.code || error.message },
    );
  }
}

function validateReleaseBinding(value, release, label, code) {
  if (
    value.candidate_release_manifest_id
      !== release.candidate_release_manifest_id
    || value.candidate_release_manifest_payload_digest
      !== release.candidate_release_manifest_payload_digest
  ) {
    fail(code, `${label} does not bind the exact candidate release.`);
  }
}

function validateParentBinding(value) {
  const code = 'INVALID_PROCESS_RELATED_PASSAGE_PARENT_BINDING';
  requireExactKeys(value, [
    'schema_version',
    'parent_binding_id',
    'parent_product_result_identity',
    'parent_result_identity',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'source_document_identity',
    'binding_validation_receipt_id',
    'validation_state',
    'authority_state',
  ], 'Process related-passage parent binding', code);
  if (
    value.schema_version
      !== PROCESS_RELATED_PASSAGE_PARENT_BINDING_SCHEMA
    || value.validation_state !== 'EXTERNALLY_VALIDATED'
    || value.authority_state !== 'NOT_GRANTED'
  ) {
    fail(code, 'The Process related-passage parent state is invalid.');
  }
  [
    'parent_binding_id',
    'parent_product_result_identity',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'source_document_identity',
    'binding_validation_receipt_id',
  ].forEach((key) => requireDigest(value[key], `Parent ${key}`, code));
  try {
    validateProcessPhrasebookResultIdentity(value.parent_result_identity);
  } catch (error) {
    fail(code, 'The parent is not a checked Process phrasebook result.', {
      cause: error.code || error.message,
    });
  }
  if (
    value.parent_binding_id !== contentId(
      PROCESS_RELATED_PASSAGE_PARENT_BINDING_SCHEMA,
      without(value, 'parent_binding_id'),
    )
  ) {
    fail(code, 'The Process related-passage parent identity is invalid.');
  }
  return true;
}

function validateReleaseProjection(value, parentBinding) {
  const code = 'INVALID_PROCESS_RELATED_PASSAGE_RELEASE_PROJECTION';
  validateParentBinding(parentBinding);
  requireExactKeys(value, [
    'schema_version',
    'projection_id',
    'parent_binding_id',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'source_document_identity',
    'candidate_children',
    'projection_validation_receipt_id',
    'validation_state',
    'authority_state',
  ], 'Process related-passage release projection', code);
  if (
    value.schema_version
      !== PROCESS_RELATED_PASSAGE_RELEASE_PROJECTION_SCHEMA
    || value.parent_binding_id !== parentBinding.parent_binding_id
    || value.source_document_identity
      !== parentBinding.source_document_identity
    || value.validation_state !== 'EXTERNALLY_VALIDATED'
    || value.authority_state !== 'NOT_GRANTED'
  ) {
    fail(code, 'The Process related-passage projection state is invalid.');
  }
  [
    'projection_id',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'source_document_identity',
    'projection_validation_receipt_id',
  ].forEach((key) => requireDigest(value[key], `Projection ${key}`, code));
  validateReleaseBinding(value, parentBinding, 'Projection', code);
  if (
    !Array.isArray(value.candidate_children)
    || value.candidate_children.length > MAXIMUM_PROJECTION_CANDIDATES
  ) {
    fail(code, 'The related-passage projection candidate set is invalid.');
  }
  value.candidate_children.forEach((candidate) => {
    clone(candidate, code);
  });
  if (
    value.projection_id !== contentId(
      PROCESS_RELATED_PASSAGE_RELEASE_PROJECTION_SCHEMA,
      without(value, 'projection_id'),
    )
  ) {
    fail(code, 'The related-passage projection identity is invalid.');
  }
  return true;
}

function validateRelationshipDefinition(value, code) {
  requireExactKeys(value, [
    'key',
    'version',
  ], 'Related-passage relationship definition', code);
  requireGovernedKey(value.key, 'Relationship definition key', code);
  requireInteger(
    value.version,
    1,
    Number.MAX_SAFE_INTEGER,
    'Relationship definition version',
    code,
  );
}

function validateRelationshipBinding(
  value,
  parentBinding,
  relatedResultIdentity,
) {
  const code = 'INVALID_PROCESS_RELATED_PASSAGE_RELATIONSHIP';
  requireExactKeys(value, [
    'schema_version',
    'relationship_binding_id',
    'parent_result_id',
    'related_result_id',
    'relationship_definition_key_and_version',
    'relationship_label',
    'relationship_validation_receipt_id',
    'resolution_state',
    'validation_state',
    'authority_state',
  ], 'Process related-passage relationship binding', code);
  if (
    value.schema_version
      !== PROCESS_RELATED_PASSAGE_RELATIONSHIP_BINDING_SCHEMA
    || value.parent_result_id
      !== parentBinding.parent_result_identity
        .process_phrasebook_passage_result_id
    || value.related_result_id
      !== relatedResultIdentity.process_phrasebook_passage_result_id
    || value.resolution_state !== 'RESOLVED'
    || value.validation_state !== 'EXTERNALLY_VALIDATED'
    || value.authority_state !== 'NOT_GRANTED'
  ) {
    fail(
      value.resolution_state === 'UNRESOLVED'
        ? 'UNRESOLVED_PROCESS_RELATED_PASSAGE_RELATIONSHIP'
        : code,
      'The related-passage relationship is not resolved and parent-bound.',
    );
  }
  [
    'relationship_binding_id',
    'parent_result_id',
    'related_result_id',
    'relationship_validation_receipt_id',
  ].forEach((key) => requireDigest(value[key], `Relationship ${key}`, code));
  validateRelationshipDefinition(
    value.relationship_definition_key_and_version,
    code,
  );
  requireText(value.relationship_label, 'Relationship label', code);
  if (
    value.relationship_binding_id !== contentId(
      PROCESS_RELATED_PASSAGE_RELATIONSHIP_BINDING_SCHEMA,
      without(value, 'relationship_binding_id'),
    )
  ) {
    fail(code, 'The related-passage relationship identity is invalid.');
  }
}

function validateSourceInterval(value, code) {
  requireExactKeys(value, [
    'start_utf8_byte',
    'end_utf8_byte',
    'exact_text_digest',
  ], 'Related-passage source interval', code);
  requireInteger(
    value.start_utf8_byte,
    0,
    Number.MAX_SAFE_INTEGER,
    'Source interval start',
    code,
  );
  requireInteger(
    value.end_utf8_byte,
    1,
    Number.MAX_SAFE_INTEGER,
    'Source interval end',
    code,
  );
  requireDigest(value.exact_text_digest, 'Source interval text digest', code);
  if (value.end_utf8_byte <= value.start_utf8_byte) {
    fail(code, 'The related-passage source interval is empty or reversed.');
  }
}

function validatePreview(value, candidate, parentBinding) {
  const code = 'INVALID_PROCESS_RELATED_PASSAGE_PREVIEW';
  requireExactKeys(value, [
    'schema_version',
    'preview_id',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'source_document_identity',
    'source_revision_id',
    'canonical_text_digest',
    'exact_source_interval',
    'evidence_role_key',
    'source_local_narration_id',
    'segmentation_projection_id',
    'verbatim_text',
    'verbatim_text_digest',
    'truncation_state',
    'preview_validation_receipt_id',
    'validation_state',
    'authority_state',
  ], 'Process related-passage preview', code);
  if (
    value.schema_version !== PROCESS_RELATED_PASSAGE_PREVIEW_SCHEMA
    || value.source_document_identity
      !== parentBinding.source_document_identity
    || value.evidence_role_key
      !== candidate.related_result_identity.exact_evidence_role_slot_key
    || value.source_local_narration_id
      !== candidate.related_result_identity
        .precomputed_process_narration_occurrence_id
    || !['COMPLETE', 'TRUNCATED'].includes(value.truncation_state)
    || value.validation_state !== 'EXTERNALLY_VALIDATED'
    || value.authority_state !== 'NOT_GRANTED'
  ) {
    fail(code, 'The related-passage preview binding is invalid.');
  }
  [
    'preview_id',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'source_document_identity',
    'source_revision_id',
    'canonical_text_digest',
    'source_local_narration_id',
    'segmentation_projection_id',
    'verbatim_text_digest',
    'preview_validation_receipt_id',
  ].forEach((key) => requireDigest(value[key], `Preview ${key}`, code));
  validateReleaseBinding(value, parentBinding, 'Preview', code);
  validateSourceInterval(value.exact_source_interval, code);
  requireGovernedKey(value.evidence_role_key, 'Preview evidence role', code);
  requireText(
    value.verbatim_text,
    'Related-passage verbatim text',
    code,
    8192,
    false,
  );
  if (
    value.verbatim_text_digest
      !== sha256Hex(Buffer.from(value.verbatim_text, 'utf8'))
    || value.preview_id !== contentId(
      PROCESS_RELATED_PASSAGE_PREVIEW_SCHEMA,
      without(value, 'preview_id'),
    )
  ) {
    fail(code, 'The related-passage preview identity or text is invalid.');
  }
}

function validateExactDetailReference(
  value,
  candidate,
  parentBinding,
) {
  const code = 'INVALID_PROCESS_RELATED_PASSAGE_EXACT_DETAIL_REFERENCE';
  requireExactKeys(value, [
    'schema_version',
    'exact_detail_reference_id',
    'binding_kind',
    'binding_identity',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'source_document_identity',
    'source_evidence_identity',
    'domain_reference_identity',
    'reference_validation_receipt_id',
    'validation_state',
    'execution_authority_state',
  ], 'Related-passage exact-detail reference', code);
  const relatedResultId = candidate.related_result_identity
    .process_phrasebook_passage_result_id;
  if (
    value.schema_version !== PRODUCT_EXACT_DETAIL_REFERENCE_SCHEMA
    || value.binding_kind !== 'RELATED_CHILD_RESULT'
    || value.binding_identity !== relatedResultId
    || value.source_document_identity
      !== parentBinding.source_document_identity
    || value.validation_state !== 'EXTERNALLY_VALIDATED'
    || value.execution_authority_state !== 'NOT_GRANTED'
  ) {
    fail(code, 'The related-passage exact-detail binding is invalid.');
  }
  [
    'exact_detail_reference_id',
    'binding_identity',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'source_document_identity',
    'source_evidence_identity',
    'domain_reference_identity',
    'reference_validation_receipt_id',
  ].forEach((key) => requireDigest(value[key], `Exact-detail ${key}`, code));
  validateReleaseBinding(value, parentBinding, 'Exact-detail reference', code);
  if (
    value.exact_detail_reference_id !== contentId(
      PRODUCT_EXACT_DETAIL_REFERENCE_SCHEMA,
      without(value, 'exact_detail_reference_id'),
    )
  ) {
    fail(code, 'The related-passage exact-detail identity is invalid.');
  }
}

function validateCandidate(candidate, parentBinding) {
  const code = 'INVALID_PROCESS_RELATED_PASSAGE_CHILD';
  requireExactKeys(candidate, [
    'schema_version',
    'candidate_id',
    'related_result_identity',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'source_document_identity',
    'relationship_binding',
    'verbatim_passage_preview',
    'exact_detail_reference',
    'candidate_validation_receipt_id',
    'validation_state',
    'authority_state',
  ], 'Process related-passage candidate', code);
  if (
    candidate.schema_version !== PROCESS_RELATED_PASSAGE_CANDIDATE_SCHEMA
    || candidate.validation_state !== 'EXTERNALLY_VALIDATED'
    || candidate.authority_state !== 'NOT_GRANTED'
  ) {
    fail(code, 'The related-passage candidate state is invalid.');
  }
  [
    'candidate_id',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'source_document_identity',
    'candidate_validation_receipt_id',
  ].forEach((key) => requireDigest(candidate[key], `Candidate ${key}`, code));
  try {
    validateProcessPhrasebookResultIdentity(
      candidate.related_result_identity,
    );
  } catch (error) {
    fail(code, 'The related child is not a Process phrasebook result.', {
      cause: error.code || error.message,
    });
  }
  const parentIdentity = parentBinding.parent_result_identity;
  const childIdentity = candidate.related_result_identity;
  if (
    childIdentity.process_phrasebook_passage_result_id
      === parentIdentity.process_phrasebook_passage_result_id
    || childIdentity.frozen_contract_pair_digest
      !== parentIdentity.frozen_contract_pair_digest
    || childIdentity.governed_deal_admission_id
      !== parentIdentity.governed_deal_admission_id
  ) {
    fail(
      'PROCESS_RELATED_PASSAGE_PARENT_CHILD_MISMATCH',
      'The related child does not bind a distinct result in the parent deal.',
    );
  }
  validateReleaseBinding(candidate, parentBinding, 'Candidate', code);
  if (
    candidate.source_document_identity
      !== parentBinding.source_document_identity
  ) {
    fail(
      'PROCESS_RELATED_PASSAGE_SOURCE_DOCUMENT_MISMATCH',
      'The related child is not in the parent source document.',
    );
  }
  validateRelationshipBinding(
    candidate.relationship_binding,
    parentBinding,
    childIdentity,
  );
  validatePreview(
    candidate.verbatim_passage_preview,
    candidate,
    parentBinding,
  );
  validateExactDetailReference(
    candidate.exact_detail_reference,
    candidate,
    parentBinding,
  );
  if (
    candidate.candidate_id !== contentId(
      PROCESS_RELATED_PASSAGE_CANDIDATE_SCHEMA,
      without(candidate, 'candidate_id'),
    )
  ) {
    fail(code, 'The related-passage candidate identity is invalid.');
  }
  return true;
}

function candidateInputDigest(candidate) {
  return payloadDigest(candidate);
}

function childFailure(candidate, error, disposition = null) {
  const relatedResultId = SHA256_RE.test(
    candidate?.related_result_identity
      ?.process_phrasebook_passage_result_id || '',
  )
    ? candidate.related_result_identity.process_phrasebook_passage_result_id
    : null;
  const body = {
    schema_version: PROCESS_RELATED_PASSAGE_CHILD_FAILURE_SCHEMA,
    candidate_input_digest: candidateInputDigest(candidate),
    related_result_id: relatedResultId,
    disposition: disposition || (
      error.code === 'UNRESOLVED_PROCESS_RELATED_PASSAGE_RELATIONSHIP'
        ? 'UNRESOLVED_RELATIONSHIP'
        : 'MALFORMED_CHILD'
    ),
    failure_code:
      error.code || 'INVALID_PROCESS_RELATED_PASSAGE_CHILD',
    failure_state: 'ISOLATED_NOT_PUBLISHED',
    authority_state: 'NOT_GRANTED',
  };
  return {
    schema_version: body.schema_version,
    failure_id: contentId(
      PROCESS_RELATED_PASSAGE_CHILD_FAILURE_SCHEMA,
      body,
    ),
    ...body,
  };
}

function compareCandidates(left, right) {
  const leftIdentity = left.related_result_identity;
  const rightIdentity = right.related_result_identity;
  const ordinal = leftIdentity.governed_ordinal
    - rightIdentity.governed_ordinal;
  if (ordinal !== 0) return ordinal;
  const leftDefinition =
    left.relationship_binding.relationship_definition_key_and_version;
  const rightDefinition =
    right.relationship_binding.relationship_definition_key_and_version;
  const key = compareText(leftDefinition.key, rightDefinition.key);
  if (key !== 0) return key;
  const version = leftDefinition.version - rightDefinition.version;
  if (version !== 0) return version;
  return compareText(
    leftIdentity.process_phrasebook_passage_result_id,
    rightIdentity.process_phrasebook_passage_result_id,
  );
}

function outputChild(candidate) {
  return {
    related_result_id:
      candidate.related_result_identity
        .process_phrasebook_passage_result_id,
    relationship_definition_key_and_version: clone(
      candidate.relationship_binding
        .relationship_definition_key_and_version,
    ),
    relationship_label:
      candidate.relationship_binding.relationship_label,
    verbatim_passage_preview:
      clone(candidate.verbatim_passage_preview),
    exact_detail_reference: clone(candidate.exact_detail_reference),
  };
}

function compileCandidateSet(projection, parentBinding) {
  const validated = [];
  const failures = [];
  const canonicalCandidates = [...projection.candidate_children].sort(
    (left, right) => compareText(
      candidateInputDigest(left),
      candidateInputDigest(right),
    ),
  );
  for (const candidate of canonicalCandidates) {
    try {
      validateCandidate(candidate, parentBinding);
      validated.push(candidate);
    } catch (error) {
      failures.push(childFailure(candidate, error));
    }
  }
  const counts = new Map();
  for (const candidate of validated) {
    const resultId = candidate.related_result_identity
      .process_phrasebook_passage_result_id;
    counts.set(resultId, (counts.get(resultId) || 0) + 1);
  }
  const unique = [];
  for (const candidate of validated) {
    const resultId = candidate.related_result_identity
      .process_phrasebook_passage_result_id;
    if (counts.get(resultId) > 1) {
      failures.push(childFailure(
        candidate,
        {
          code: 'DUPLICATE_PROCESS_RELATED_PASSAGE_RESULT',
        },
        'DUPLICATE_CHILD_RESULT_ID',
      ));
    } else {
      unique.push(candidate);
    }
  }
  unique.sort(compareCandidates);
  failures.sort((left, right) => (
    compareText(left.candidate_input_digest, right.candidate_input_digest)
    || compareText(left.failure_code, right.failure_code)
    || compareText(left.failure_id, right.failure_id)
  ));
  return { failures, valid: unique };
}

function responseIdentityPayload(value) {
  return without(value, 'response_id');
}

function buildResponse(callerInput, parentBinding, projection) {
  validateContractBinding();
  validateParentBinding(parentBinding);
  validateReleaseProjection(projection, parentBinding);
  const code = 'INVALID_PROCESS_RELATED_PASSAGES_CALLER_INPUT';
  requireExactKeys(callerInput, [
    'action_key',
    'parent_result_id',
  ], 'Process related-passages caller input', code);
  const parentResultId = parentBinding.parent_result_identity
    .process_phrasebook_passage_result_id;
  if (
    callerInput.action_key !== ACTION_KEY
    || callerInput.parent_result_id !== parentResultId
  ) {
    fail(code, 'The related-passages request is not parent-bound.');
  }
  requireDigest(callerInput.parent_result_id, 'Caller parent result ID', code);
  const compiled = compileCandidateSet(projection, parentBinding);
  const published = compiled.valid.slice(0, MAXIMUM_CHILDREN);
  const body = {
    schema_version: PROCESS_RELATED_PASSAGES_RESPONSE_SCHEMA,
    action_key: ACTION_KEY,
    parent_result_id: parentResultId,
    parent_product_result_identity:
      parentBinding.parent_product_result_identity,
    parent_binding_id: parentBinding.parent_binding_id,
    candidate_release_manifest_id:
      parentBinding.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      parentBinding.candidate_release_manifest_payload_digest,
    source_document_identity: parentBinding.source_document_identity,
    release_projection_id: projection.projection_id,
    release_projection_payload_digest: payloadDigest(projection),
    projection_validation_receipt_id:
      projection.projection_validation_receipt_id,
    children: published.map(outputChild),
    child_failures: clone(compiled.failures),
    candidate_count: projection.candidate_children.length,
    valid_child_count: compiled.valid.length,
    published_child_count: published.length,
    omitted_valid_child_count:
      compiled.valid.length - published.length,
    failed_child_count: compiled.failures.length,
    order_state: 'GOVERNED_SOURCE_ORDER_APPLIED',
    malformed_child_state: 'ISOLATED_FROM_VALID_SIBLINGS',
    classification_state: 'SECONDARY_TO_VERBATIM_DRAFTING',
    execution_state: 'COMPILED_NOT_SERVED',
    authority_limits: clone(AUTHORITY_LIMITS),
  };
  return {
    schema_version: body.schema_version,
    response_id: contentId(
      PROCESS_RELATED_PASSAGES_RESPONSE_SCHEMA,
      body,
    ),
    ...body,
  };
}

function validateProcessRelatedPassagesResponse(
  value,
  {
    caller_input: callerInput,
    parent_binding: parentBinding,
    release_projection: projection,
  },
) {
  const code = 'INVALID_PROCESS_RELATED_PASSAGES_RESPONSE';
  requireExactKeys(value, [
    'schema_version',
    'response_id',
    'action_key',
    'parent_result_id',
    'parent_product_result_identity',
    'parent_binding_id',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'source_document_identity',
    'release_projection_id',
    'release_projection_payload_digest',
    'projection_validation_receipt_id',
    'children',
    'child_failures',
    'candidate_count',
    'valid_child_count',
    'published_child_count',
    'omitted_valid_child_count',
    'failed_child_count',
    'order_state',
    'malformed_child_state',
    'classification_state',
    'execution_state',
    'authority_limits',
  ], 'Process related-passages response', code);
  const rebuilt = buildResponse(callerInput, parentBinding, projection);
  if (canonicalJson(value) !== canonicalJson(rebuilt)) {
    fail(code, 'The Process related-passages response was changed.');
  }
  return true;
}

function compileProcessRelatedPassages({
  caller_input: callerInput,
  parent_binding: parentBinding,
  release_projection: projection,
}) {
  const response = buildResponse(
    callerInput,
    parentBinding,
    projection,
  );
  validateProcessRelatedPassagesResponse(response, {
    caller_input: callerInput,
    parent_binding: parentBinding,
    release_projection: projection,
  });
  return deepFreeze(clone(response));
}

function canonicalProcessRelatedPassagesResponseBytes(value, context) {
  validateProcessRelatedPassagesResponse(value, context);
  return Buffer.from(canonicalJson(value), 'utf8');
}

module.exports = {
  ACTION_KEY,
  AUTHORITY_LIMITS,
  MAXIMUM_CHILDREN,
  MAXIMUM_PROJECTION_CANDIDATES,
  PROCESS_RELATED_PASSAGE_CANDIDATE_SCHEMA,
  PROCESS_RELATED_PASSAGE_CHILD_FAILURE_SCHEMA,
  PROCESS_RELATED_PASSAGE_PARENT_BINDING_SCHEMA,
  PROCESS_RELATED_PASSAGE_PREVIEW_SCHEMA,
  PROCESS_RELATED_PASSAGE_RELATIONSHIP_BINDING_SCHEMA,
  PROCESS_RELATED_PASSAGE_RELEASE_PROJECTION_SCHEMA,
  PROCESS_RELATED_PASSAGES_RESPONSE_SCHEMA,
  ProcessRelatedPassagesError,
  canonicalProcessRelatedPassagesResponseBytes,
  compileProcessRelatedPassages,
  validateParentBinding,
  validateProcessRelatedPassagesResponse,
  validateReleaseProjection,
};
