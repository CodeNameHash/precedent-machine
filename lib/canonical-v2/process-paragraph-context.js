const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');
const {
  PRODUCT_PARENT_BOUND_CURSOR_SCHEMA,
} = require('./product-source-reader-compiler');
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

const PROCESS_PARAGRAPH_PROJECTION_SCHEMA =
  'VERSIONED_CANONICAL_TEXT_PARAGRAPH_PROJECTION/V1';
const PROCESS_PARAGRAPH_SCHEMA = 'CANONICAL_TEXT_PARAGRAPH/V1';
const PROCESS_PARAGRAPH_CONTEXT_PARENT_BINDING_SCHEMA =
  'PROCESS_PARAGRAPH_CONTEXT_PARENT_BINDING/V1';
const PROCESS_PARAGRAPH_CONTEXT_CURSOR_PAYLOAD_SCHEMA =
  'PROCESS_PARAGRAPH_CONTEXT_CURSOR_PAYLOAD/V1';
const PROCESS_PARAGRAPH_CONTEXT_CURSOR_ISSUANCE_SCHEMA =
  'PROCESS_PARAGRAPH_CONTEXT_CURSOR_ISSUANCE/V1';
const PROCESS_PARAGRAPH_CONTEXT_RESPONSE_SCHEMA =
  'PROCESS_PARAGRAPH_CONTEXT_RESPONSE/V1';
const DIRECTIONS = Object.freeze(['ABOVE', 'BELOW']);
const BOUNDARY_STATES = Object.freeze([
  'MORE_AVAILABLE',
  'SOURCE_BOUNDARY_REACHED',
  'GOVERNED_LIMIT_REACHED',
]);
const MAX_PARAGRAPHS_PER_DIRECTION = 12;
const MAX_PROJECTION_PARAGRAPHS = 8192;
const SHA256_RE = /^[a-f0-9]{64}$/;

class ProcessParagraphContextError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProcessParagraphContextError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new ProcessParagraphContextError(code, message, details);
}

function requireObject(
  value,
  label,
  code = 'INVALID_PROCESS_PARAGRAPH_CONTEXT_INPUT',
) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(code, `${label} must be an object.`);
  }
}

function requireExactKeys(
  value,
  expected,
  label,
  code = 'INVALID_PROCESS_PARAGRAPH_CONTEXT_INPUT',
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
  code = 'INVALID_PROCESS_PARAGRAPH_CONTEXT_INPUT',
) {
  if (!SHA256_RE.test(value || '')) {
    fail(code, `${label} must be a full SHA-256 digest.`);
  }
  return value;
}

function requireText(
  value,
  label,
  code = 'INVALID_PROCESS_PARAGRAPH_CONTEXT_INPUT',
  maximumBytes = 65536,
) {
  if (
    typeof value !== 'string'
    || value.length === 0
    || Buffer.byteLength(value, 'utf8') > maximumBytes
  ) {
    fail(code, `${label} must be bounded non-empty UTF-8 text.`);
  }
  return value;
}

function requireInteger(
  value,
  minimum,
  maximum,
  label,
  code = 'INVALID_PROCESS_PARAGRAPH_CONTEXT_INPUT',
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

function clone(value, code = 'INVALID_PROCESS_PARAGRAPH_CONTEXT_INPUT') {
  try {
    return JSON.parse(canonicalJson(value));
  } catch (error) {
    fail(code, 'The Process paragraph-context value is not canonical JSON.', {
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

function projectionDigest(value) {
  return sha256Hex(Buffer.from(canonicalJson(value), 'utf8'));
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
      'INVALID_PROCESS_PARAGRAPH_CONTEXT_CONTRACT_BINDING',
      'The signed Process paragraph-context contract has changed.',
      { cause: error.code || error.message },
    );
  }
}

function paragraphIdentityPayload(paragraph, projection) {
  return {
    source_document_identity: projection.source_document_identity,
    source_revision_id: projection.source_revision_id,
    projection_version: projection.projection_version,
    ordinal: paragraph.ordinal,
    start_utf8_byte: paragraph.start_utf8_byte,
    end_utf8_byte: paragraph.end_utf8_byte,
    verbatim_text_digest: paragraph.verbatim_text_digest,
  };
}

function validateParagraph(paragraph, projection, index, previousEnd) {
  const code = 'INVALID_PROCESS_PARAGRAPH_PROJECTION';
  requireExactKeys(paragraph, [
    'paragraph_id',
    'ordinal',
    'start_utf8_byte',
    'end_utf8_byte',
    'verbatim_text',
    'verbatim_text_digest',
  ], `Paragraph ${index}`, code);
  requireDigest(paragraph.paragraph_id, `Paragraph ${index} ID`, code);
  requireInteger(
    paragraph.ordinal,
    0,
    MAX_PROJECTION_PARAGRAPHS - 1,
    `Paragraph ${index} ordinal`,
    code,
  );
  requireInteger(
    paragraph.start_utf8_byte,
    0,
    Number.MAX_SAFE_INTEGER,
    `Paragraph ${index} start`,
    code,
  );
  requireInteger(
    paragraph.end_utf8_byte,
    1,
    Number.MAX_SAFE_INTEGER,
    `Paragraph ${index} end`,
    code,
  );
  requireText(paragraph.verbatim_text, `Paragraph ${index} text`, code);
  requireDigest(
    paragraph.verbatim_text_digest,
    `Paragraph ${index} text digest`,
    code,
  );
  if (
    paragraph.ordinal !== index
    || paragraph.end_utf8_byte <= paragraph.start_utf8_byte
    || paragraph.start_utf8_byte < previousEnd
    || paragraph.verbatim_text_digest
      !== sha256Hex(Buffer.from(paragraph.verbatim_text, 'utf8'))
    || paragraph.paragraph_id !== contentId(
      PROCESS_PARAGRAPH_SCHEMA,
      paragraphIdentityPayload(paragraph, projection),
    )
  ) {
    fail(code, `Paragraph ${index} is not the canonical projection member.`);
  }
}

function validateProcessParagraphProjection(value) {
  const code = 'INVALID_PROCESS_PARAGRAPH_PROJECTION';
  requireExactKeys(value, [
    'schema_version',
    'projection_id',
    'projection_version',
    'source_document_identity',
    'source_revision_id',
    'canonical_text_digest',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'paragraphs',
    'projection_validation_receipt_id',
    'validation_state',
    'authority_state',
  ], 'Process paragraph projection', code);
  if (
    value.schema_version !== PROCESS_PARAGRAPH_PROJECTION_SCHEMA
    || value.validation_state !== 'EXTERNALLY_VALIDATED'
    || value.authority_state !== 'NOT_GRANTED'
  ) {
    fail(code, 'The Process paragraph projection state is invalid.');
  }
  requireInteger(
    value.projection_version,
    1,
    Number.MAX_SAFE_INTEGER,
    'Paragraph projection version',
    code,
  );
  [
    'projection_id',
    'source_document_identity',
    'source_revision_id',
    'canonical_text_digest',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'projection_validation_receipt_id',
  ].forEach((key) => requireDigest(value[key], `Projection ${key}`, code));
  if (
    !Array.isArray(value.paragraphs)
    || value.paragraphs.length < 1
    || value.paragraphs.length > MAX_PROJECTION_PARAGRAPHS
  ) {
    fail(code, 'The Process paragraph projection cardinality is invalid.');
  }
  let previousEnd = 0;
  value.paragraphs.forEach((paragraph, index) => {
    validateParagraph(paragraph, value, index, previousEnd);
    previousEnd = paragraph.end_utf8_byte;
  });
  if (
    value.projection_id !== contentId(
      PROCESS_PARAGRAPH_PROJECTION_SCHEMA,
      without(value, 'projection_id'),
    )
  ) {
    fail(code, 'The Process paragraph projection identity is invalid.');
  }
  return true;
}

function validateEvidenceInterval(value, code) {
  requireExactKeys(value, [
    'start_utf8_byte',
    'end_utf8_byte',
    'exact_text_digest',
  ], 'Selected evidence interval', code);
  requireInteger(
    value.start_utf8_byte,
    0,
    Number.MAX_SAFE_INTEGER,
    'Selected evidence start',
    code,
  );
  requireInteger(
    value.end_utf8_byte,
    1,
    Number.MAX_SAFE_INTEGER,
    'Selected evidence end',
    code,
  );
  requireDigest(
    value.exact_text_digest,
    'Selected evidence text digest',
    code,
  );
  if (value.end_utf8_byte <= value.start_utf8_byte) {
    fail(code, 'The selected evidence interval is empty or reversed.');
  }
}

function validateProcessParagraphContextParentBinding(
  value,
  paragraphProjection,
) {
  const code = 'INVALID_PROCESS_PARAGRAPH_CONTEXT_PARENT_BINDING';
  validateProcessParagraphProjection(paragraphProjection);
  requireExactKeys(value, [
    'schema_version',
    'parent_binding_id',
    'parent_product_result_identity',
    'process_phrasebook_passage_result_id',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'source_document_identity',
    'source_evidence_identity',
    'selected_evidence_interval',
    'segmentation_projection_id',
    'segmentation_projection_payload_digest',
    'anchor_paragraph_id',
    'binding_validation_receipt_id',
    'validation_state',
    'authority_state',
  ], 'Process paragraph-context parent binding', code);
  if (
    value.schema_version
      !== PROCESS_PARAGRAPH_CONTEXT_PARENT_BINDING_SCHEMA
    || value.validation_state !== 'EXTERNALLY_VALIDATED'
    || value.authority_state !== 'NOT_GRANTED'
  ) {
    fail(code, 'The paragraph-context parent binding state is invalid.');
  }
  [
    'parent_binding_id',
    'parent_product_result_identity',
    'process_phrasebook_passage_result_id',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'source_document_identity',
    'source_evidence_identity',
    'segmentation_projection_id',
    'segmentation_projection_payload_digest',
    'anchor_paragraph_id',
    'binding_validation_receipt_id',
  ].forEach((key) => requireDigest(value[key], `Parent binding ${key}`, code));
  validateEvidenceInterval(value.selected_evidence_interval, code);
  if (
    value.candidate_release_manifest_id
      !== paragraphProjection.candidate_release_manifest_id
    || value.candidate_release_manifest_payload_digest
      !== paragraphProjection.candidate_release_manifest_payload_digest
    || value.source_document_identity
      !== paragraphProjection.source_document_identity
    || value.segmentation_projection_id
      !== paragraphProjection.projection_id
    || value.segmentation_projection_payload_digest
      !== projectionDigest(paragraphProjection)
  ) {
    fail(code, 'The parent binding does not bind the paragraph projection.');
  }
  const anchor = paragraphProjection.paragraphs.find(
    (paragraph) => paragraph.paragraph_id === value.anchor_paragraph_id,
  );
  if (
    !anchor
    || value.selected_evidence_interval.start_utf8_byte
      < anchor.start_utf8_byte
    || value.selected_evidence_interval.end_utf8_byte
      > anchor.end_utf8_byte
  ) {
    fail(code, 'The selected evidence is not inside its anchor paragraph.');
  }
  if (
    value.parent_binding_id !== contentId(
      PROCESS_PARAGRAPH_CONTEXT_PARENT_BINDING_SCHEMA,
      without(value, 'parent_binding_id'),
    )
  ) {
    fail(code, 'The paragraph-context parent binding identity is invalid.');
  }
  return true;
}

function paragraphIndexForCount(
  parentBinding,
  paragraphProjection,
  direction,
  expandedParagraphCount,
) {
  const anchorIndex = paragraphProjection.paragraphs.findIndex(
    (paragraph) => paragraph.paragraph_id
      === parentBinding.anchor_paragraph_id,
  );
  const distance = expandedParagraphCount + 1;
  return direction === 'ABOVE'
    ? anchorIndex - distance
    : anchorIndex + distance;
}

function cursorTokenPayload(
  parentBinding,
  paragraphProjection,
  direction,
  expandedParagraphCount,
  nextParagraphId,
) {
  return {
    schema_version: PROCESS_PARAGRAPH_CONTEXT_CURSOR_PAYLOAD_SCHEMA,
    parent_binding_id: parentBinding.parent_binding_id,
    parent_product_result_identity:
      parentBinding.parent_product_result_identity,
    candidate_release_manifest_id:
      parentBinding.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      parentBinding.candidate_release_manifest_payload_digest,
    segmentation_projection_id: paragraphProjection.projection_id,
    segmentation_projection_payload_digest:
      projectionDigest(paragraphProjection),
    direction,
    expanded_paragraph_count: expandedParagraphCount,
    next_paragraph_id: nextParagraphId,
  };
}

function issueCursor(
  parentBinding,
  paragraphProjection,
  direction,
  expandedParagraphCount,
) {
  const nextIndex = paragraphIndexForCount(
    parentBinding,
    paragraphProjection,
    direction,
    expandedParagraphCount,
  );
  const nextParagraph = paragraphProjection.paragraphs[nextIndex];
  if (
    expandedParagraphCount >= MAX_PARAGRAPHS_PER_DIRECTION
    || !nextParagraph
  ) {
    return null;
  }
  const tokenBase = cursorTokenPayload(
    parentBinding,
    paragraphProjection,
    direction,
    expandedParagraphCount,
    nextParagraph.paragraph_id,
  );
  const serverIssuanceReceiptId = contentId(
    PROCESS_PARAGRAPH_CONTEXT_CURSOR_ISSUANCE_SCHEMA,
    tokenBase,
  );
  const token = {
    ...tokenBase,
    server_issuance_receipt_id: serverIssuanceReceiptId,
  };
  const opaqueCursor = Buffer.from(
    canonicalJson(token),
    'utf8',
  ).toString('base64url');
  if (Buffer.byteLength(opaqueCursor, 'utf8') > 2048) {
    fail(
      'INVALID_PROCESS_PARAGRAPH_CONTEXT_CURSOR',
      'The server-issued paragraph cursor exceeds its governed bound.',
    );
  }
  const body = {
    schema_version: PRODUCT_PARENT_BOUND_CURSOR_SCHEMA,
    opaque_cursor: opaqueCursor,
    opaque_cursor_digest:
      sha256Hex(Buffer.from(opaqueCursor, 'utf8')),
    parent_product_result_identity:
      parentBinding.parent_product_result_identity,
    candidate_release_manifest_id:
      parentBinding.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      parentBinding.candidate_release_manifest_payload_digest,
    direction,
    expanded_paragraph_count: expandedParagraphCount,
    server_issuance_receipt_id: serverIssuanceReceiptId,
    validation_state: 'EXTERNALLY_VALIDATED',
    execution_authority_state: 'NOT_GRANTED',
  };
  return deepFreeze({
    schema_version: body.schema_version,
    cursor_id: contentId(
      PRODUCT_PARENT_BOUND_CURSOR_SCHEMA,
      body,
    ),
    opaque_cursor: body.opaque_cursor,
    opaque_cursor_digest: body.opaque_cursor_digest,
    parent_product_result_identity:
      body.parent_product_result_identity,
    candidate_release_manifest_id:
      body.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      body.candidate_release_manifest_payload_digest,
    direction: body.direction,
    expanded_paragraph_count: body.expanded_paragraph_count,
    server_issuance_receipt_id:
      body.server_issuance_receipt_id,
    validation_state: body.validation_state,
    execution_authority_state:
      body.execution_authority_state,
  });
}

function decodeCursorToken(opaqueCursor, code) {
  requireText(opaqueCursor, 'Opaque paragraph cursor', code, 2048);
  let parsed;
  try {
    const decoded = Buffer.from(opaqueCursor, 'base64url');
    parsed = JSON.parse(decoded.toString('utf8'));
    if (
      decoded.toString('base64url') !== opaqueCursor
      || Buffer.from(canonicalJson(parsed), 'utf8').toString('base64url')
        !== opaqueCursor
    ) {
      fail(code, 'The opaque paragraph cursor is not canonical.');
    }
  } catch (error) {
    if (error instanceof ProcessParagraphContextError) throw error;
    fail(code, 'The opaque paragraph cursor cannot be decoded.', {
      cause: error.message,
    });
  }
  return parsed;
}

function validateToken(
  token,
  parentBinding,
  paragraphProjection,
  direction,
) {
  const code = 'INVALID_PROCESS_PARAGRAPH_CONTEXT_CURSOR';
  requireExactKeys(token, [
    'schema_version',
    'parent_binding_id',
    'parent_product_result_identity',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'segmentation_projection_id',
    'segmentation_projection_payload_digest',
    'direction',
    'expanded_paragraph_count',
    'next_paragraph_id',
    'server_issuance_receipt_id',
  ], 'Process paragraph-context cursor token', code);
  if (
    token.schema_version
      !== PROCESS_PARAGRAPH_CONTEXT_CURSOR_PAYLOAD_SCHEMA
    || token.parent_binding_id !== parentBinding.parent_binding_id
    || token.parent_product_result_identity
      !== parentBinding.parent_product_result_identity
    || token.candidate_release_manifest_id
      !== parentBinding.candidate_release_manifest_id
    || token.candidate_release_manifest_payload_digest
      !== parentBinding.candidate_release_manifest_payload_digest
    || token.segmentation_projection_id
      !== paragraphProjection.projection_id
    || token.segmentation_projection_payload_digest
      !== projectionDigest(paragraphProjection)
    || token.direction !== direction
  ) {
    fail(code, 'The paragraph cursor does not bind its parent and projection.');
  }
  requireInteger(
    token.expanded_paragraph_count,
    0,
    MAX_PARAGRAPHS_PER_DIRECTION - 1,
    'Cursor expanded paragraph count',
    code,
  );
  requireDigest(token.next_paragraph_id, 'Cursor next paragraph ID', code);
  requireDigest(
    token.server_issuance_receipt_id,
    'Cursor issuance receipt ID',
    code,
  );
  const nextIndex = paragraphIndexForCount(
    parentBinding,
    paragraphProjection,
    direction,
    token.expanded_paragraph_count,
  );
  const expectedParagraph = paragraphProjection.paragraphs[nextIndex];
  const tokenBase = clone(token, code);
  delete tokenBase.server_issuance_receipt_id;
  if (
    !expectedParagraph
    || token.next_paragraph_id !== expectedParagraph.paragraph_id
    || token.server_issuance_receipt_id !== contentId(
      PROCESS_PARAGRAPH_CONTEXT_CURSOR_ISSUANCE_SCHEMA,
      tokenBase,
    )
  ) {
    fail(code, 'The paragraph cursor next member is not server-derived.');
  }
  return expectedParagraph;
}

function validateProductCursor(
  cursor,
  token,
  parentBinding,
  direction,
) {
  const code = 'INVALID_PROCESS_PARAGRAPH_CONTEXT_CURSOR';
  requireExactKeys(cursor, [
    'schema_version',
    'cursor_id',
    'opaque_cursor',
    'opaque_cursor_digest',
    'parent_product_result_identity',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'direction',
    'expanded_paragraph_count',
    'server_issuance_receipt_id',
    'validation_state',
    'execution_authority_state',
  ], 'Product parent-bound cursor', code);
  if (
    cursor.schema_version !== PRODUCT_PARENT_BOUND_CURSOR_SCHEMA
    || cursor.parent_product_result_identity
      !== parentBinding.parent_product_result_identity
    || cursor.candidate_release_manifest_id
      !== parentBinding.candidate_release_manifest_id
    || cursor.candidate_release_manifest_payload_digest
      !== parentBinding.candidate_release_manifest_payload_digest
    || cursor.direction !== direction
    || cursor.expanded_paragraph_count
      !== token.expanded_paragraph_count
    || cursor.server_issuance_receipt_id
      !== token.server_issuance_receipt_id
    || cursor.validation_state !== 'EXTERNALLY_VALIDATED'
    || cursor.execution_authority_state !== 'NOT_GRANTED'
  ) {
    fail(code, 'The Product parent-bound cursor state is invalid.');
  }
  [
    'cursor_id',
    'opaque_cursor_digest',
    'parent_product_result_identity',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'server_issuance_receipt_id',
  ].forEach((key) => requireDigest(cursor[key], `Product cursor ${key}`, code));
  if (
    cursor.opaque_cursor_digest
      !== sha256Hex(Buffer.from(cursor.opaque_cursor, 'utf8'))
    || cursor.cursor_id !== contentId(
      PRODUCT_PARENT_BOUND_CURSOR_SCHEMA,
      without(cursor, 'cursor_id'),
    )
  ) {
    fail(code, 'The Product parent-bound cursor identity is invalid.');
  }
}

function issueInitialProcessParagraphContextCursor({
  parent_binding: parentBinding,
  paragraph_projection: paragraphProjection,
  direction,
}) {
  validateContractBinding();
  validateProcessParagraphContextParentBinding(
    parentBinding,
    paragraphProjection,
  );
  if (!DIRECTIONS.includes(direction)) {
    fail(
      'INVALID_PROCESS_PARAGRAPH_CONTEXT_DIRECTION',
      'The paragraph-context direction is not governed.',
    );
  }
  return issueCursor(parentBinding, paragraphProjection, direction, 0);
}

function responseIdentityPayload(value) {
  return without(value, 'response_id');
}

function validateProcessParagraphContextResponse(
  value,
  {
    parent_binding: parentBinding,
    paragraph_projection: paragraphProjection,
  },
) {
  validateContractBinding();
  const code = 'INVALID_PROCESS_PARAGRAPH_CONTEXT_RESPONSE';
  validateProcessParagraphContextParentBinding(
    parentBinding,
    paragraphProjection,
  );
  requireExactKeys(value, [
    'schema_version',
    'response_id',
    'parent_result_id',
    'parent_binding_id',
    'candidate_release_manifest_id',
    'candidate_release_manifest_payload_digest',
    'source_document_identity',
    'source_revision_id',
    'segmentation_projection_id',
    'segmentation_projection_payload_digest',
    'direction',
    'expanded_paragraph_count',
    'context_paragraph',
    'selected_evidence_interval',
    'selected_evidence_anchor_paragraph_id',
    'next_cursor',
    'boundary_state',
    'selected_evidence_remains_highlighted',
    'selected_evidence_remains_visible',
    'execution_state',
    'authority_state',
  ], 'Process paragraph-context response', code);
  if (
    value.schema_version !== PROCESS_PARAGRAPH_CONTEXT_RESPONSE_SCHEMA
    || !DIRECTIONS.includes(value.direction)
    || !BOUNDARY_STATES.includes(value.boundary_state)
    || value.parent_result_id
      !== parentBinding.parent_product_result_identity
    || value.parent_binding_id !== parentBinding.parent_binding_id
    || value.candidate_release_manifest_id
      !== parentBinding.candidate_release_manifest_id
    || value.candidate_release_manifest_payload_digest
      !== parentBinding.candidate_release_manifest_payload_digest
    || value.source_document_identity
      !== parentBinding.source_document_identity
    || value.source_revision_id !== paragraphProjection.source_revision_id
    || value.segmentation_projection_id
      !== paragraphProjection.projection_id
    || value.segmentation_projection_payload_digest
      !== projectionDigest(paragraphProjection)
    || canonicalJson(value.selected_evidence_interval)
      !== canonicalJson(parentBinding.selected_evidence_interval)
    || value.selected_evidence_anchor_paragraph_id
      !== parentBinding.anchor_paragraph_id
    || value.selected_evidence_remains_highlighted !== true
    || value.selected_evidence_remains_visible !== true
    || value.execution_state !== 'COMPILED_NOT_SERVED'
    || value.authority_state !== 'NOT_GRANTED'
  ) {
    fail(code, 'The paragraph-context response binding is invalid.');
  }
  requireDigest(value.response_id, 'Paragraph-context response ID', code);
  requireInteger(
    value.expanded_paragraph_count,
    1,
    MAX_PARAGRAPHS_PER_DIRECTION,
    'Response expanded paragraph count',
    code,
  );
  const index = paragraphIndexForCount(
    parentBinding,
    paragraphProjection,
    value.direction,
    value.expanded_paragraph_count - 1,
  );
  const expectedParagraph = paragraphProjection.paragraphs[index];
  if (
    !expectedParagraph
    || canonicalJson(value.context_paragraph)
      !== canonicalJson(expectedParagraph)
  ) {
    fail(code, 'The response paragraph was not derived from the projection.');
  }
  const expectedNext = issueCursor(
    parentBinding,
    paragraphProjection,
    value.direction,
    value.expanded_paragraph_count,
  );
  const expectedBoundary = value.expanded_paragraph_count
    >= MAX_PARAGRAPHS_PER_DIRECTION
    ? 'GOVERNED_LIMIT_REACHED'
    : expectedNext === null
      ? 'SOURCE_BOUNDARY_REACHED'
      : 'MORE_AVAILABLE';
  if (
    value.boundary_state !== expectedBoundary
    || canonicalJson(value.next_cursor) !== canonicalJson(expectedNext)
  ) {
    fail(code, 'The response boundary or repeat cursor is invalid.');
  }
  if (value.next_cursor !== null) {
    const token = decodeCursorToken(value.next_cursor.opaque_cursor, code);
    validateToken(
      token,
      parentBinding,
      paragraphProjection,
      value.direction,
    );
    validateProductCursor(
      value.next_cursor,
      token,
      parentBinding,
      value.direction,
    );
  }
  if (
    value.response_id !== contentId(
      PROCESS_PARAGRAPH_CONTEXT_RESPONSE_SCHEMA,
      responseIdentityPayload(value),
    )
  ) {
    fail(code, 'The paragraph-context response identity is invalid.');
  }
  return true;
}

function compileProcessParagraphContextResponse({
  caller_input: callerInput,
  parent_binding: parentBinding,
  paragraph_projection: paragraphProjection,
}) {
  validateContractBinding();
  validateProcessParagraphContextParentBinding(
    parentBinding,
    paragraphProjection,
  );
  const code = 'INVALID_PROCESS_PARAGRAPH_CONTEXT_CALLER_INPUT';
  requireExactKeys(callerInput, [
    'direction',
    'opaque_cursor',
    'parent_result_id',
  ], 'Process paragraph-context caller input', code);
  if (
    !DIRECTIONS.includes(callerInput.direction)
    || callerInput.parent_result_id
      !== parentBinding.parent_product_result_identity
  ) {
    fail(code, 'The paragraph-context caller input is not parent-bound.');
  }
  requireDigest(callerInput.parent_result_id, 'Caller parent result ID', code);
  const token = decodeCursorToken(
    callerInput.opaque_cursor,
    'INVALID_PROCESS_PARAGRAPH_CONTEXT_CURSOR',
  );
  const contextParagraph = validateToken(
    token,
    parentBinding,
    paragraphProjection,
    callerInput.direction,
  );
  const productCursor = issueCursor(
    parentBinding,
    paragraphProjection,
    callerInput.direction,
    token.expanded_paragraph_count,
  );
  if (
    !productCursor
    || productCursor.opaque_cursor !== callerInput.opaque_cursor
  ) {
    fail(
      'INVALID_PROCESS_PARAGRAPH_CONTEXT_CURSOR',
      'The paragraph cursor was not issued for this request.',
    );
  }
  validateProductCursor(
    productCursor,
    token,
    parentBinding,
    callerInput.direction,
  );
  const expandedParagraphCount = token.expanded_paragraph_count + 1;
  const nextCursor = issueCursor(
    parentBinding,
    paragraphProjection,
    callerInput.direction,
    expandedParagraphCount,
  );
  const boundaryState = expandedParagraphCount
    >= MAX_PARAGRAPHS_PER_DIRECTION
    ? 'GOVERNED_LIMIT_REACHED'
    : nextCursor === null
      ? 'SOURCE_BOUNDARY_REACHED'
      : 'MORE_AVAILABLE';
  const body = {
    schema_version: PROCESS_PARAGRAPH_CONTEXT_RESPONSE_SCHEMA,
    parent_result_id: parentBinding.parent_product_result_identity,
    parent_binding_id: parentBinding.parent_binding_id,
    candidate_release_manifest_id:
      parentBinding.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      parentBinding.candidate_release_manifest_payload_digest,
    source_document_identity: parentBinding.source_document_identity,
    source_revision_id: paragraphProjection.source_revision_id,
    segmentation_projection_id: paragraphProjection.projection_id,
    segmentation_projection_payload_digest:
      projectionDigest(paragraphProjection),
    direction: callerInput.direction,
    expanded_paragraph_count: expandedParagraphCount,
    context_paragraph: clone(contextParagraph),
    selected_evidence_interval:
      clone(parentBinding.selected_evidence_interval),
    selected_evidence_anchor_paragraph_id:
      parentBinding.anchor_paragraph_id,
    next_cursor: clone(nextCursor),
    boundary_state: boundaryState,
    selected_evidence_remains_highlighted: true,
    selected_evidence_remains_visible: true,
    execution_state: 'COMPILED_NOT_SERVED',
    authority_state: 'NOT_GRANTED',
  };
  const response = {
    schema_version: body.schema_version,
    response_id: contentId(
      PROCESS_PARAGRAPH_CONTEXT_RESPONSE_SCHEMA,
      body,
    ),
    parent_result_id: body.parent_result_id,
    parent_binding_id: body.parent_binding_id,
    candidate_release_manifest_id:
      body.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      body.candidate_release_manifest_payload_digest,
    source_document_identity: body.source_document_identity,
    source_revision_id: body.source_revision_id,
    segmentation_projection_id: body.segmentation_projection_id,
    segmentation_projection_payload_digest:
      body.segmentation_projection_payload_digest,
    direction: body.direction,
    expanded_paragraph_count: body.expanded_paragraph_count,
    context_paragraph: body.context_paragraph,
    selected_evidence_interval: body.selected_evidence_interval,
    selected_evidence_anchor_paragraph_id:
      body.selected_evidence_anchor_paragraph_id,
    next_cursor: body.next_cursor,
    boundary_state: body.boundary_state,
    selected_evidence_remains_highlighted:
      body.selected_evidence_remains_highlighted,
    selected_evidence_remains_visible:
      body.selected_evidence_remains_visible,
    execution_state: body.execution_state,
    authority_state: body.authority_state,
  };
  validateProcessParagraphContextResponse(response, {
    parent_binding: parentBinding,
    paragraph_projection: paragraphProjection,
  });
  return deepFreeze(clone(response));
}

function canonicalProcessParagraphContextResponseBytes(
  value,
  context,
) {
  validateProcessParagraphContextResponse(value, context);
  return Buffer.from(canonicalJson(value), 'utf8');
}

module.exports = {
  BOUNDARY_STATES,
  DIRECTIONS,
  MAX_PARAGRAPHS_PER_DIRECTION,
  PROCESS_PARAGRAPH_CONTEXT_CURSOR_ISSUANCE_SCHEMA,
  PROCESS_PARAGRAPH_CONTEXT_CURSOR_PAYLOAD_SCHEMA,
  PROCESS_PARAGRAPH_CONTEXT_PARENT_BINDING_SCHEMA,
  PROCESS_PARAGRAPH_CONTEXT_RESPONSE_SCHEMA,
  PROCESS_PARAGRAPH_PROJECTION_SCHEMA,
  PROCESS_PARAGRAPH_SCHEMA,
  ProcessParagraphContextError,
  canonicalProcessParagraphContextResponseBytes,
  compileProcessParagraphContextResponse,
  issueInitialProcessParagraphContextCursor,
  validateProcessParagraphContextParentBinding,
  validateProcessParagraphContextResponse,
  validateProcessParagraphProjection,
};
