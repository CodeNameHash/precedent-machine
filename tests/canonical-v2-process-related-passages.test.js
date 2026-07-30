const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('../lib/canonical-v2/canonical-bytes');
const {
  PRODUCT_EXACT_DETAIL_REFERENCE_SCHEMA,
} = require('../lib/canonical-v2/product-source-reader-compiler');
const {
  buildProcessPhrasebookResultIdentity,
} = require('../lib/canonical-v2/process-phrasebook-result');
const {
  ACTION_KEY,
  AUTHORITY_LIMITS,
  MAXIMUM_CHILDREN,
  PROCESS_RELATED_PASSAGE_CANDIDATE_SCHEMA,
  PROCESS_RELATED_PASSAGE_PARENT_BINDING_SCHEMA,
  PROCESS_RELATED_PASSAGE_PREVIEW_SCHEMA,
  PROCESS_RELATED_PASSAGE_RELATIONSHIP_BINDING_SCHEMA,
  PROCESS_RELATED_PASSAGE_RELEASE_PROJECTION_SCHEMA,
  PROCESS_RELATED_PASSAGES_RESPONSE_SCHEMA,
  canonicalProcessRelatedPassagesResponseBytes,
  compileProcessRelatedPassages,
  validateParentBinding,
  validateProcessRelatedPassagesResponse,
  validateReleaseProjection,
} = require('../lib/canonical-v2/process-related-passages');

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

function withIdentity(schema, idKey, body) {
  return {
    schema_version: body.schema_version,
    [idKey]: contentId(schema, body),
    ...body,
  };
}

const CONTRACT_PAIR = digest('contract-pair');
const DEAL = digest('metsera-deal');
const RELEASE = digest('candidate-release');
const RELEASE_PAYLOAD = digest('candidate-release-payload');
const SOURCE_DOCUMENT = digest('metsera-proxy');

function resultIdentity(label, governedOrdinal) {
  return buildProcessPhrasebookResultIdentity({
    frozen_contract_pair_digest: CONTRACT_PAIR,
    governed_deal_admission_id: DEAL,
    precomputed_process_narration_occurrence_id:
      digest(`${label}:narration`),
    exact_evidence_role_slot_key: 'DIRECT_PREDICATE_WITNESS',
    governed_ordinal: governedOrdinal,
  });
}

function parentBinding(identity = resultIdentity('parent', 50)) {
  const body = {
    schema_version: PROCESS_RELATED_PASSAGE_PARENT_BINDING_SCHEMA,
    parent_product_result_identity: digest('parent-product-result'),
    parent_result_identity: identity,
    candidate_release_manifest_id: RELEASE,
    candidate_release_manifest_payload_digest: RELEASE_PAYLOAD,
    source_document_identity: SOURCE_DOCUMENT,
    binding_validation_receipt_id: digest('parent-binding-receipt'),
    validation_state: 'EXTERNALLY_VALIDATED',
    authority_state: 'NOT_GRANTED',
  };
  return withIdentity(
    PROCESS_RELATED_PASSAGE_PARENT_BINDING_SCHEMA,
    'parent_binding_id',
    body,
  );
}

function relationshipBinding(
  parent,
  child,
  {
    key = 'SAME_PROCESS_PHASE',
    version = 1,
    label = 'Same process phase',
    resolutionState = 'RESOLVED',
  } = {},
) {
  const body = {
    schema_version:
      PROCESS_RELATED_PASSAGE_RELATIONSHIP_BINDING_SCHEMA,
    parent_result_id:
      parent.parent_result_identity.process_phrasebook_passage_result_id,
    related_result_id:
      child.process_phrasebook_passage_result_id,
    relationship_definition_key_and_version: { key, version },
    relationship_label: label,
    relationship_validation_receipt_id:
      digest(`relationship:${child.process_phrasebook_passage_result_id}`),
    resolution_state: resolutionState,
    validation_state: 'EXTERNALLY_VALIDATED',
    authority_state: 'NOT_GRANTED',
  };
  return withIdentity(
    PROCESS_RELATED_PASSAGE_RELATIONSHIP_BINDING_SCHEMA,
    'relationship_binding_id',
    body,
  );
}

function preview(
  parent,
  child,
  {
    text = `Exact related drafting for ${child.governed_ordinal}.`,
    sourceDocumentIdentity = SOURCE_DOCUMENT,
  } = {},
) {
  const body = {
    schema_version: PROCESS_RELATED_PASSAGE_PREVIEW_SCHEMA,
    candidate_release_manifest_id: RELEASE,
    candidate_release_manifest_payload_digest: RELEASE_PAYLOAD,
    source_document_identity: sourceDocumentIdentity,
    source_revision_id: digest('source-revision'),
    canonical_text_digest: digest('canonical-text'),
    exact_source_interval: {
      start_utf8_byte: child.governed_ordinal * 100,
      end_utf8_byte:
        (child.governed_ordinal * 100)
        + Buffer.byteLength(text, 'utf8'),
      exact_text_digest: sha256Hex(Buffer.from(text, 'utf8')),
    },
    evidence_role_key: child.exact_evidence_role_slot_key,
    source_local_narration_id:
      child.precomputed_process_narration_occurrence_id,
    segmentation_projection_id: digest('segmentation-projection'),
    verbatim_text: text,
    verbatim_text_digest: sha256Hex(Buffer.from(text, 'utf8')),
    truncation_state: 'COMPLETE',
    preview_validation_receipt_id:
      digest(`preview:${child.process_phrasebook_passage_result_id}`),
    validation_state: 'EXTERNALLY_VALIDATED',
    authority_state: 'NOT_GRANTED',
  };
  return withIdentity(
    PROCESS_RELATED_PASSAGE_PREVIEW_SCHEMA,
    'preview_id',
    body,
  );
}

function exactDetailReference(
  child,
  {
    sourceDocumentIdentity = SOURCE_DOCUMENT,
    release = RELEASE,
    releasePayload = RELEASE_PAYLOAD,
  } = {},
) {
  const childId = child.process_phrasebook_passage_result_id;
  const body = {
    schema_version: PRODUCT_EXACT_DETAIL_REFERENCE_SCHEMA,
    binding_kind: 'RELATED_CHILD_RESULT',
    binding_identity: childId,
    candidate_release_manifest_id: release,
    candidate_release_manifest_payload_digest: releasePayload,
    source_document_identity: sourceDocumentIdentity,
    source_evidence_identity: digest(`evidence:${childId}`),
    domain_reference_identity: digest(`domain-reference:${childId}`),
    reference_validation_receipt_id:
      digest(`reference-receipt:${childId}`),
    validation_state: 'EXTERNALLY_VALIDATED',
    execution_authority_state: 'NOT_GRANTED',
  };
  return withIdentity(
    PRODUCT_EXACT_DETAIL_REFERENCE_SCHEMA,
    'exact_detail_reference_id',
    body,
  );
}

function candidate(
  parent,
  child,
  {
    key,
    version,
    label,
    resolutionState,
    sourceDocumentIdentity = SOURCE_DOCUMENT,
    release = RELEASE,
    releasePayload = RELEASE_PAYLOAD,
    text,
  } = {},
) {
  const body = {
    schema_version: PROCESS_RELATED_PASSAGE_CANDIDATE_SCHEMA,
    related_result_identity: child,
    candidate_release_manifest_id: release,
    candidate_release_manifest_payload_digest: releasePayload,
    source_document_identity: sourceDocumentIdentity,
    relationship_binding: relationshipBinding(parent, child, {
      key,
      version,
      label,
      resolutionState,
    }),
    verbatim_passage_preview: preview(parent, child, {
      text,
      sourceDocumentIdentity,
    }),
    exact_detail_reference: exactDetailReference(child, {
      sourceDocumentIdentity,
      release,
      releasePayload,
    }),
    candidate_validation_receipt_id:
      digest(`candidate:${child.process_phrasebook_passage_result_id}`),
    validation_state: 'EXTERNALLY_VALIDATED',
    authority_state: 'NOT_GRANTED',
  };
  return withIdentity(
    PROCESS_RELATED_PASSAGE_CANDIDATE_SCHEMA,
    'candidate_id',
    body,
  );
}

function releaseProjection(parent, children) {
  const body = {
    schema_version:
      PROCESS_RELATED_PASSAGE_RELEASE_PROJECTION_SCHEMA,
    parent_binding_id: parent.parent_binding_id,
    candidate_release_manifest_id: RELEASE,
    candidate_release_manifest_payload_digest: RELEASE_PAYLOAD,
    source_document_identity: SOURCE_DOCUMENT,
    candidate_children: children,
    projection_validation_receipt_id: digest('projection-receipt'),
    validation_state: 'EXTERNALLY_VALIDATED',
    authority_state: 'NOT_GRANTED',
  };
  return withIdentity(
    PROCESS_RELATED_PASSAGE_RELEASE_PROJECTION_SCHEMA,
    'projection_id',
    body,
  );
}

function callerInput(parent) {
  return {
    action_key: ACTION_KEY,
    parent_result_id:
      parent.parent_result_identity.process_phrasebook_passage_result_id,
  };
}

function compile(parent, projection, input = callerInput(parent)) {
  return compileProcessRelatedPassages({
    caller_input: input,
    parent_binding: parent,
    release_projection: projection,
  });
}

function rehash(value, schema, idKey) {
  const body = clone(value);
  delete body[idKey];
  return withIdentity(schema, idKey, body);
}

test('compiles actual drafting in governed source order', () => {
  const parent = parentBinding();
  const late = resultIdentity('late', 30);
  const early = resultIdentity('early', 10);
  const middle = resultIdentity('middle', 20);
  const projection = releaseProjection(parent, [
    candidate(parent, late, { label: 'Later discussion' }),
    candidate(parent, early, { label: 'Earlier discussion' }),
    candidate(parent, middle, { label: 'Middle discussion' }),
  ]);
  const response = compile(parent, projection);
  assert.equal(
    response.schema_version,
    PROCESS_RELATED_PASSAGES_RESPONSE_SCHEMA,
  );
  assert.deepEqual(
    response.children.map((child) => child.related_result_id),
    [
      early.process_phrasebook_passage_result_id,
      middle.process_phrasebook_passage_result_id,
      late.process_phrasebook_passage_result_id,
    ],
  );
  assert.equal(
    response.children[0].verbatim_passage_preview.verbatim_text,
    'Exact related drafting for 10.',
  );
  assert.equal(
    response.classification_state,
    'SECONDARY_TO_VERBATIM_DRAFTING',
  );
  assert.equal(response.failed_child_count, 0);
  assert.deepEqual(response.authority_limits, AUTHORITY_LIMITS);
});

test('does not use the projection array order as ranking authority', () => {
  const parent = parentBinding();
  const first = candidate(parent, resultIdentity('first', 1));
  const second = candidate(parent, resultIdentity('second', 2));
  const forward = compile(
    parent,
    releaseProjection(parent, [first, second]),
  );
  const reverse = compile(
    parent,
    releaseProjection(parent, [second, first]),
  );
  assert.deepEqual(forward.children, reverse.children);
});

test('publishes at most twelve children without padding or repetition', () => {
  const parent = parentBinding();
  const candidates = Array.from({ length: 15 }, (_, index) => (
    candidate(parent, resultIdentity(`child-${index}`, index + 1))
  ));
  const response = compile(
    parent,
    releaseProjection(parent, candidates.reverse()),
  );
  assert.equal(response.children.length, MAXIMUM_CHILDREN);
  assert.equal(response.valid_child_count, 15);
  assert.equal(response.published_child_count, 12);
  assert.equal(response.omitted_valid_child_count, 3);
  assert.equal(
    new Set(response.children.map((child) => child.related_result_id))
      .size,
    12,
  );
});

test('isolates a malformed child and retains valid siblings', () => {
  const parent = parentBinding();
  const valid = candidate(parent, resultIdentity('valid', 1));
  const projection = releaseProjection(parent, [
    { invented: 'classification without drafting' },
    valid,
  ]);
  const response = compile(parent, projection);
  assert.equal(response.children.length, 1);
  assert.equal(
    response.children[0].related_result_id,
    valid.related_result_identity.process_phrasebook_passage_result_id,
  );
  assert.equal(response.failed_child_count, 1);
  assert.equal(
    response.child_failures[0].disposition,
    'MALFORMED_CHILD',
  );
  assert.equal(
    response.child_failures[0].failure_state,
    'ISOLATED_NOT_PUBLISHED',
  );
});

test('isolates an unresolved relationship', () => {
  const parent = parentBinding();
  const child = resultIdentity('unresolved', 1);
  const unresolved = candidate(parent, child, {
    resolutionState: 'UNRESOLVED',
  });
  const response = compile(
    parent,
    releaseProjection(parent, [unresolved]),
  );
  assert.equal(response.children.length, 0);
  assert.equal(response.failed_child_count, 1);
  assert.equal(
    response.child_failures[0].disposition,
    'UNRESOLVED_RELATIONSHIP',
  );
});

test('rejects every duplicate child result and retains other children', () => {
  const parent = parentBinding();
  const duplicate = resultIdentity('duplicate', 1);
  const distinct = resultIdentity('distinct', 2);
  const response = compile(
    parent,
    releaseProjection(parent, [
      candidate(parent, duplicate, {
        key: 'SAME_PROCESS_PHASE',
        label: 'Same process phase',
      }),
      candidate(parent, duplicate, {
        key: 'SAME_BIDDER_TRACK',
        label: 'Same bidder track',
      }),
      candidate(parent, distinct),
    ]),
  );
  assert.deepEqual(
    response.children.map((child) => child.related_result_id),
    [distinct.process_phrasebook_passage_result_id],
  );
  assert.equal(response.failed_child_count, 2);
  assert.equal(
    response.child_failures.every(
      (failure) => failure.disposition
        === 'DUPLICATE_CHILD_RESULT_ID',
    ),
    true,
  );
});

test('isolates children from another release or source document', () => {
  const parent = parentBinding();
  const wrongRelease = candidate(
    parent,
    resultIdentity('wrong-release', 1),
    {
      release: digest('other-release'),
      releasePayload: digest('other-release-payload'),
    },
  );
  const wrongSource = candidate(
    parent,
    resultIdentity('wrong-source', 2),
    { sourceDocumentIdentity: digest('other-document') },
  );
  const valid = candidate(parent, resultIdentity('same-source', 3));
  const response = compile(
    parent,
    releaseProjection(parent, [
      wrongRelease,
      wrongSource,
      valid,
    ]),
  );
  assert.equal(response.children.length, 1);
  assert.equal(response.failed_child_count, 2);
  assert.deepEqual(
    response.child_failures.map((failure) => failure.failure_code).sort(),
    [
      'INVALID_PROCESS_RELATED_PASSAGE_CHILD',
      'PROCESS_RELATED_PASSAGE_SOURCE_DOCUMENT_MISMATCH',
    ],
  );
});

test('isolates a forged exact-detail reference', () => {
  const parent = parentBinding();
  const child = resultIdentity('forged-reference', 1);
  const forged = candidate(parent, child);
  forged.exact_detail_reference = exactDetailReference(child, {
    sourceDocumentIdentity: digest('forged-document'),
  });
  const rehashed = rehash(
    forged,
    PROCESS_RELATED_PASSAGE_CANDIDATE_SCHEMA,
    'candidate_id',
  );
  const response = compile(
    parent,
    releaseProjection(parent, [rehashed]),
  );
  assert.equal(response.children.length, 0);
  assert.equal(
    response.child_failures[0].failure_code,
    'INVALID_PROCESS_RELATED_PASSAGE_EXACT_DETAIL_REFERENCE',
  );
});

test('does not permit classification to replace verbatim drafting', () => {
  const parent = parentBinding();
  const child = resultIdentity('empty-drafting', 1);
  const empty = candidate(parent, child);
  empty.verbatim_passage_preview.verbatim_text = '';
  empty.verbatim_passage_preview.verbatim_text_digest =
    sha256Hex(Buffer.from('', 'utf8'));
  empty.verbatim_passage_preview = rehash(
    empty.verbatim_passage_preview,
    PROCESS_RELATED_PASSAGE_PREVIEW_SCHEMA,
    'preview_id',
  );
  const rehashed = rehash(
    empty,
    PROCESS_RELATED_PASSAGE_CANDIDATE_SCHEMA,
    'candidate_id',
  );
  const response = compile(
    parent,
    releaseProjection(parent, [rehashed]),
  );
  assert.equal(response.children.length, 0);
  assert.equal(
    response.child_failures[0].failure_code,
    'INVALID_PROCESS_RELATED_PASSAGE_PREVIEW',
  );
});

test('refuses caller ranks, offsets, graph traversal and callbacks', () => {
  const parent = parentBinding();
  const projection = releaseProjection(parent, []);
  for (const [key, value] of [
    ['rank', 1],
    ['offset', 0],
    ['graph_traversal', true],
    ['relationship_callback', 'discover'],
    ['maximum_children', 99],
    ['authority_granted', true],
  ]) {
    assert.throws(
      () => compile(parent, projection, {
        ...callerInput(parent),
        [key]: value,
      }),
      { code: 'INVALID_PROCESS_RELATED_PASSAGES_CALLER_INPUT' },
    );
  }
});

test('validates the parent and precomputed release projection as one tuple', () => {
  const parent = parentBinding();
  const projection = releaseProjection(parent, []);
  assert.equal(validateParentBinding(parent), true);
  assert.equal(validateReleaseProjection(projection, parent), true);

  const changedProjection = clone(projection);
  changedProjection.projection_validation_receipt_id =
    digest('changed-receipt');
  assert.throws(
    () => validateReleaseProjection(changedProjection, parent),
    { code: 'INVALID_PROCESS_RELATED_PASSAGE_RELEASE_PROJECTION' },
  );

  const changedParent = clone(parent);
  changedParent.parent_result_identity.governed_ordinal = 999;
  const rehashedParent = rehash(
    changedParent,
    PROCESS_RELATED_PASSAGE_PARENT_BINDING_SCHEMA,
    'parent_binding_id',
  );
  assert.throws(
    () => validateParentBinding(rehashedParent),
    { code: 'INVALID_PROCESS_RELATED_PASSAGE_PARENT_BINDING' },
  );
});

test('emits immutable canonical bytes and rejects a rehashed response forgery', () => {
  const parent = parentBinding();
  const projection = releaseProjection(parent, [
    candidate(parent, resultIdentity('child', 1)),
  ]);
  const context = {
    caller_input: callerInput(parent),
    parent_binding: parent,
    release_projection: projection,
  };
  const response = compileProcessRelatedPassages(context);
  deepFrozen(response);
  assert.equal(
    canonicalProcessRelatedPassagesResponseBytes(
      response,
      context,
    ).toString('utf8'),
    canonicalJson(response),
  );
  const changed = clone(response);
  changed.children[0].relationship_label = 'Invented label';
  const rehashed = rehash(
    changed,
    PROCESS_RELATED_PASSAGES_RESPONSE_SCHEMA,
    'response_id',
  );
  assert.throws(
    () => validateProcessRelatedPassagesResponse(rehashed, context),
    { code: 'INVALID_PROCESS_RELATED_PASSAGES_RESPONSE' },
  );
});

test('contains no I/O, runtime graph traversal or Product-reader dependency', () => {
  const source = fs.readFileSync(
    path.join(
      __dirname,
      '..',
      'lib',
      'canonical-v2',
      'process-related-passages.js',
    ),
    'utf8',
  );
  for (const prohibited of [
    "require('node:fs')",
    "require('node:child_process')",
    "require('pg')",
    "require('@supabase/supabase-js')",
    "require('./product-source-reader-compiler')",
    'process.env',
    'fetch(',
  ]) {
    assert.equal(source.includes(prohibited), false, prohibited);
  }
});
