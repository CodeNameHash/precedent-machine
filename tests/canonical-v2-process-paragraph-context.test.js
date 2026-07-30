const assert = require('node:assert/strict');
const test = require('node:test');

const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  MAX_PARAGRAPHS_PER_DIRECTION,
  PROCESS_PARAGRAPH_CONTEXT_PARENT_BINDING_SCHEMA,
  PROCESS_PARAGRAPH_PROJECTION_SCHEMA,
  PROCESS_PARAGRAPH_SCHEMA,
  canonicalProcessParagraphContextResponseBytes,
  compileProcessParagraphContextResponse,
  issueInitialProcessParagraphContextCursor,
  validateProcessParagraphContextParentBinding,
  validateProcessParagraphContextResponse,
  validateProcessParagraphProjection,
} = require('../lib/canonical-v2/process-paragraph-context');

function digest(label) {
  return sha256Hex(Buffer.from(label, 'utf8'));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFrozen(value) {
  if (!value || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true);
  Object.values(value).forEach(deepFrozen);
}

function projection(paragraphCount = 30) {
  const base = {
    schema_version: PROCESS_PARAGRAPH_PROJECTION_SCHEMA,
    projection_version: 1,
    source_document_identity: digest('source-document'),
    source_revision_id: digest('source-revision'),
    canonical_text_digest: digest('canonical-text'),
    candidate_release_manifest_id: digest('release'),
    candidate_release_manifest_payload_digest: digest('release-payload'),
    paragraphs: [],
    projection_validation_receipt_id: digest('projection-receipt'),
    validation_state: 'EXTERNALLY_VALIDATED',
    authority_state: 'NOT_GRANTED',
  };
  let start = 0;
  for (let ordinal = 0; ordinal < paragraphCount; ordinal += 1) {
    const verbatimText = `Exact paragraph ${ordinal}.`;
    const paragraphBase = {
      ordinal,
      start_utf8_byte: start,
      end_utf8_byte: start + Buffer.byteLength(verbatimText, 'utf8'),
      verbatim_text: verbatimText,
      verbatim_text_digest: sha256Hex(
        Buffer.from(verbatimText, 'utf8'),
      ),
    };
    base.paragraphs.push({
      paragraph_id: contentId(PROCESS_PARAGRAPH_SCHEMA, {
        source_document_identity: base.source_document_identity,
        source_revision_id: base.source_revision_id,
        projection_version: base.projection_version,
        ordinal: paragraphBase.ordinal,
        start_utf8_byte: paragraphBase.start_utf8_byte,
        end_utf8_byte: paragraphBase.end_utf8_byte,
        verbatim_text_digest: paragraphBase.verbatim_text_digest,
      }),
      ...paragraphBase,
    });
    start = paragraphBase.end_utf8_byte + 2;
  }
  return {
    schema_version: base.schema_version,
    projection_id: contentId(
      PROCESS_PARAGRAPH_PROJECTION_SCHEMA,
      base,
    ),
    ...base,
  };
}

function parentBinding(value, anchorOrdinal = 15) {
  const anchor = value.paragraphs[anchorOrdinal];
  const base = {
    schema_version: PROCESS_PARAGRAPH_CONTEXT_PARENT_BINDING_SCHEMA,
    parent_product_result_identity: digest('product-result'),
    process_phrasebook_passage_result_id: digest('process-result'),
    candidate_release_manifest_id:
      value.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      value.candidate_release_manifest_payload_digest,
    source_document_identity: value.source_document_identity,
    source_evidence_identity: digest('source-evidence'),
    selected_evidence_interval: {
      start_utf8_byte: anchor.start_utf8_byte + 1,
      end_utf8_byte: anchor.end_utf8_byte - 1,
      exact_text_digest: digest('selected-evidence'),
    },
    segmentation_projection_id: value.projection_id,
    segmentation_projection_payload_digest: sha256Hex(
      Buffer.from(canonicalJson(value), 'utf8'),
    ),
    anchor_paragraph_id: anchor.paragraph_id,
    binding_validation_receipt_id: digest('binding-receipt'),
    validation_state: 'EXTERNALLY_VALIDATED',
    authority_state: 'NOT_GRANTED',
  };
  return {
    schema_version: base.schema_version,
    parent_binding_id: contentId(
      PROCESS_PARAGRAPH_CONTEXT_PARENT_BINDING_SCHEMA,
      base,
    ),
    ...base,
  };
}

function expand(cursor, binding, paragraphProjection, direction) {
  return compileProcessParagraphContextResponse({
    caller_input: {
      direction,
      opaque_cursor: cursor.opaque_cursor,
      parent_result_id: binding.parent_product_result_identity,
    },
    parent_binding: binding,
    paragraph_projection: paragraphProjection,
  });
}

test('validates one exact versioned paragraph projection and parent binding', () => {
  const paragraphProjection = projection();
  const binding = parentBinding(paragraphProjection);
  assert.equal(validateProcessParagraphProjection(paragraphProjection), true);
  assert.equal(
    validateProcessParagraphContextParentBinding(
      binding,
      paragraphProjection,
    ),
    true,
  );
});

test('derives repeated above-context paragraphs and preserves selected evidence', () => {
  const paragraphProjection = projection();
  const binding = parentBinding(paragraphProjection);
  let cursor = issueInitialProcessParagraphContextCursor({
    parent_binding: binding,
    paragraph_projection: paragraphProjection,
    direction: 'ABOVE',
  });
  const first = expand(cursor, binding, paragraphProjection, 'ABOVE');
  assert.equal(first.context_paragraph.ordinal, 14);
  assert.equal(first.expanded_paragraph_count, 1);
  assert.deepEqual(
    first.selected_evidence_interval,
    binding.selected_evidence_interval,
  );
  assert.equal(first.boundary_state, 'MORE_AVAILABLE');
  cursor = first.next_cursor;
  const second = expand(cursor, binding, paragraphProjection, 'ABOVE');
  assert.equal(second.context_paragraph.ordinal, 13);
  assert.equal(second.expanded_paragraph_count, 2);
  assert.equal(
    second.selected_evidence_anchor_paragraph_id,
    binding.anchor_paragraph_id,
  );
  deepFrozen(second);
  assert.equal(
    canonicalProcessParagraphContextResponseBytes(second, {
      parent_binding: binding,
      paragraph_projection: paragraphProjection,
    }).toString('utf8'),
    canonicalJson(second),
  );
});

test('derives repeated below-context paragraphs in canonical order', () => {
  const paragraphProjection = projection();
  const binding = parentBinding(paragraphProjection);
  const firstCursor = issueInitialProcessParagraphContextCursor({
    parent_binding: binding,
    paragraph_projection: paragraphProjection,
    direction: 'BELOW',
  });
  const first = expand(
    firstCursor,
    binding,
    paragraphProjection,
    'BELOW',
  );
  const second = expand(
    first.next_cursor,
    binding,
    paragraphProjection,
    'BELOW',
  );
  assert.equal(first.context_paragraph.ordinal, 16);
  assert.equal(second.context_paragraph.ordinal, 17);
});

test('stops at the signed twelve-paragraph limit', () => {
  const paragraphProjection = projection(40);
  const binding = parentBinding(paragraphProjection, 20);
  let cursor = issueInitialProcessParagraphContextCursor({
    parent_binding: binding,
    paragraph_projection: paragraphProjection,
    direction: 'ABOVE',
  });
  let response;
  for (
    let count = 0;
    count < MAX_PARAGRAPHS_PER_DIRECTION;
    count += 1
  ) {
    response = expand(cursor, binding, paragraphProjection, 'ABOVE');
    cursor = response.next_cursor;
  }
  assert.equal(response.expanded_paragraph_count, 12);
  assert.equal(response.boundary_state, 'GOVERNED_LIMIT_REACHED');
  assert.equal(response.next_cursor, null);
});

test('reports the source boundary without padding or repetition', () => {
  const paragraphProjection = projection(4);
  const binding = parentBinding(paragraphProjection, 1);
  const cursor = issueInitialProcessParagraphContextCursor({
    parent_binding: binding,
    paragraph_projection: paragraphProjection,
    direction: 'ABOVE',
  });
  const response = expand(cursor, binding, paragraphProjection, 'ABOVE');
  assert.equal(response.context_paragraph.ordinal, 0);
  assert.equal(response.boundary_state, 'SOURCE_BOUNDARY_REACHED');
  assert.equal(response.next_cursor, null);
});

test('refuses caller byte offsets, ordinals and context limits', () => {
  const paragraphProjection = projection();
  const binding = parentBinding(paragraphProjection);
  const cursor = issueInitialProcessParagraphContextCursor({
    parent_binding: binding,
    paragraph_projection: paragraphProjection,
    direction: 'ABOVE',
  });
  for (const [key, value] of [
    ['start_utf8_byte', 0],
    ['paragraph_ordinal', 0],
    ['maximum_context', 100],
  ]) {
    assert.throws(
      () => compileProcessParagraphContextResponse({
        caller_input: {
          direction: 'ABOVE',
          opaque_cursor: cursor.opaque_cursor,
          parent_result_id: binding.parent_product_result_identity,
          [key]: value,
        },
        parent_binding: binding,
        paragraph_projection: paragraphProjection,
      }),
      { code: 'INVALID_PROCESS_PARAGRAPH_CONTEXT_CALLER_INPUT' },
    );
  }
});

test('refuses a cursor used for another direction, parent, release or projection', () => {
  const paragraphProjection = projection();
  const binding = parentBinding(paragraphProjection);
  const cursor = issueInitialProcessParagraphContextCursor({
    parent_binding: binding,
    paragraph_projection: paragraphProjection,
    direction: 'ABOVE',
  });
  assert.throws(
    () => expand(cursor, binding, paragraphProjection, 'BELOW'),
    { code: 'INVALID_PROCESS_PARAGRAPH_CONTEXT_CURSOR' },
  );
  const otherBinding = clone(binding);
  otherBinding.parent_product_result_identity = digest('other-result');
  otherBinding.parent_binding_id = contentId(
    PROCESS_PARAGRAPH_CONTEXT_PARENT_BINDING_SCHEMA,
    Object.fromEntries(
      Object.entries(otherBinding)
        .filter(([key]) => key !== 'parent_binding_id'),
    ),
  );
  assert.throws(
    () => expand(cursor, otherBinding, paragraphProjection, 'ABOVE'),
    { code: 'INVALID_PROCESS_PARAGRAPH_CONTEXT_CURSOR' },
  );
  const otherProjection = clone(paragraphProjection);
  otherProjection.projection_validation_receipt_id = digest('other-receipt');
  otherProjection.projection_id = contentId(
    PROCESS_PARAGRAPH_PROJECTION_SCHEMA,
    Object.fromEntries(
      Object.entries(otherProjection)
        .filter(([key]) => key !== 'projection_id'),
    ),
  );
  assert.throws(
    () => expand(cursor, binding, otherProjection, 'ABOVE'),
    { code: 'INVALID_PROCESS_PARAGRAPH_CONTEXT_PARENT_BINDING' },
  );
});

test('refuses a changed or non-canonical opaque cursor', () => {
  const paragraphProjection = projection();
  const binding = parentBinding(paragraphProjection);
  const cursor = issueInitialProcessParagraphContextCursor({
    parent_binding: binding,
    paragraph_projection: paragraphProjection,
    direction: 'ABOVE',
  });
  const changed = `${cursor.opaque_cursor.slice(0, -1)}A`;
  assert.throws(
    () => compileProcessParagraphContextResponse({
      caller_input: {
        direction: 'ABOVE',
        opaque_cursor: changed,
        parent_result_id: binding.parent_product_result_identity,
      },
      parent_binding: binding,
      paragraph_projection: paragraphProjection,
    }),
    { code: 'INVALID_PROCESS_PARAGRAPH_CONTEXT_CURSOR' },
  );
});

test('refuses reordered, overlapping or self-rehashed paragraph projections', () => {
  const paragraphProjection = projection();
  const reordered = clone(paragraphProjection);
  [reordered.paragraphs[0], reordered.paragraphs[1]] = [
    reordered.paragraphs[1],
    reordered.paragraphs[0],
  ];
  reordered.projection_id = contentId(
    PROCESS_PARAGRAPH_PROJECTION_SCHEMA,
    Object.fromEntries(
      Object.entries(reordered)
        .filter(([key]) => key !== 'projection_id'),
    ),
  );
  assert.throws(
    () => validateProcessParagraphProjection(reordered),
    { code: 'INVALID_PROCESS_PARAGRAPH_PROJECTION' },
  );
  const overlapping = clone(paragraphProjection);
  overlapping.paragraphs[1].start_utf8_byte =
    overlapping.paragraphs[0].start_utf8_byte;
  overlapping.paragraphs[1].paragraph_id = contentId(
    PROCESS_PARAGRAPH_SCHEMA,
    {
      source_document_identity: overlapping.source_document_identity,
      source_revision_id: overlapping.source_revision_id,
      projection_version: overlapping.projection_version,
      ordinal: overlapping.paragraphs[1].ordinal,
      start_utf8_byte: overlapping.paragraphs[1].start_utf8_byte,
      end_utf8_byte: overlapping.paragraphs[1].end_utf8_byte,
      verbatim_text_digest:
        overlapping.paragraphs[1].verbatim_text_digest,
    },
  );
  overlapping.projection_id = contentId(
    PROCESS_PARAGRAPH_PROJECTION_SCHEMA,
    Object.fromEntries(
      Object.entries(overlapping)
        .filter(([key]) => key !== 'projection_id'),
    ),
  );
  assert.throws(
    () => validateProcessParagraphProjection(overlapping),
    { code: 'INVALID_PROCESS_PARAGRAPH_PROJECTION' },
  );
});

test('refuses an evidence anchor outside the bound paragraph', () => {
  const paragraphProjection = projection();
  const binding = parentBinding(paragraphProjection);
  binding.selected_evidence_interval.start_utf8_byte = 0;
  binding.parent_binding_id = contentId(
    PROCESS_PARAGRAPH_CONTEXT_PARENT_BINDING_SCHEMA,
    Object.fromEntries(
      Object.entries(binding)
        .filter(([key]) => key !== 'parent_binding_id'),
    ),
  );
  assert.throws(
    () => validateProcessParagraphContextParentBinding(
      binding,
      paragraphProjection,
    ),
    { code: 'INVALID_PROCESS_PARAGRAPH_CONTEXT_PARENT_BINDING' },
  );
});

test('response validation rejects changed evidence and context without mutating siblings', () => {
  const paragraphProjection = projection();
  const binding = parentBinding(paragraphProjection);
  const cursor = issueInitialProcessParagraphContextCursor({
    parent_binding: binding,
    paragraph_projection: paragraphProjection,
    direction: 'BELOW',
  });
  const response = expand(
    cursor,
    binding,
    paragraphProjection,
    'BELOW',
  );
  const originalProjection = clone(paragraphProjection);
  const changedEvidence = clone(response);
  changedEvidence.selected_evidence_interval.exact_text_digest =
    digest('forged-evidence');
  assert.throws(
    () => validateProcessParagraphContextResponse(changedEvidence, {
      parent_binding: binding,
      paragraph_projection: paragraphProjection,
    }),
    { code: 'INVALID_PROCESS_PARAGRAPH_CONTEXT_RESPONSE' },
  );
  const changedContext = clone(response);
  changedContext.context_paragraph.verbatim_text = 'Invented context.';
  assert.throws(
    () => validateProcessParagraphContextResponse(changedContext, {
      parent_binding: binding,
      paragraph_projection: paragraphProjection,
    }),
    { code: 'INVALID_PROCESS_PARAGRAPH_CONTEXT_RESPONSE' },
  );
  assert.deepEqual(paragraphProjection, originalProjection);
});
