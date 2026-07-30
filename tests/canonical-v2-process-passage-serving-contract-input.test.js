const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  validateAuthoredProcessServingInputs,
} = require('../lib/canonical-v2/process-serving-contract-input-validator');

const ROOT = path.join(
  __dirname,
  '../contracts/canonical-v2/successor',
);

function loadMember(relativePath) {
  const canonicalValue = JSON.parse(
    fs.readFileSync(path.join(ROOT, relativePath), 'utf8'),
  );
  return {
    object_kind: canonicalValue.object_kind,
    canonical_value: canonicalValue,
  };
}

function servingMembers() {
  return [
    loadMember('process/results/process-exclusivity-event-result.v1.json'),
    loadMember('process/results/process-phrasebook-passage-result.v1.json'),
    loadMember('process/serving/bounded-inline-passage-preview.v1.json'),
    loadMember('process/serving/parent-bound-paragraph-context.v1.json'),
    loadMember('process/serving/related-passage-child-collection.v1.json'),
  ];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function byId(members, stableId) {
  return members.find(
    (member) => member.canonical_value.stable_id === stableId,
  ).canonical_value.definition;
}

test('validates the five bounded Process serving contracts', () => {
  const members = servingMembers();
  assert.doesNotThrow(() => validateAuthoredProcessServingInputs(members));

  const result = byId(members, 'PROCESS_PHRASEBOOK_PASSAGE_RESULT');
  assert.equal(result.result_contract.output_grain, 'RESULT');
  assert.equal(result.result_contract.parent_kind, 'RESULT_ROW');
  assert.equal(
    result.result_contract.claim_or_application_join_can_mint_result,
    false,
  );
  assert.equal(result.lineage_contract.predicate_witness_required, true);
  assert.equal(
    result.ordering_contract.diversification_applies_after_total_comparator,
    true,
  );
});

test('requires one bounded verbatim preview in the result row', () => {
  const members = servingMembers();
  const preview = byId(members, 'BOUNDED_INLINE_PASSAGE_PREVIEW');

  assert.equal(preview.preview_contract.content_mode, 'VERBATIM_CANONICAL_TEXT');
  assert.equal(preview.preview_contract.maximum_utf8_bytes, 8192);
  assert.equal(
    preview.preview_contract.exact_ordered_source_interval_set_required,
    true,
  );
  assert.equal(preview.preview_contract.source_interval_order_must_match_parent, true);
  assert.equal(preview.preview_contract.multi_interval_flattening_permitted, false);
  assert.equal(preview.preview_contract.canonical_text_digest_required, true);
  assert.equal(preview.delivery_contract.delivered_with_parent_row, true);
  assert.equal(preview.delivery_contract.separate_detail_request_required, false);
  assert.equal(preview.delivery_contract.malformed_preview_blocks_parent_only, true);
});

test('binds repeatable paragraph context to a server-issued parent cursor', () => {
  const members = servingMembers();
  const context = byId(members, 'PARENT_BOUND_PARAGRAPH_CONTEXT');

  assert.equal(context.expansion_contract.paragraphs_per_request, 1);
  assert.equal(context.expansion_contract.maximum_paragraphs_per_direction, 12);
  assert.equal(context.expansion_contract.repeat_click_permitted, true);
  assert.equal(context.cursor_contract.maximum_encoded_bytes, 2048);
  assert.equal(context.cursor_contract.server_derives_every_paragraph_ordinal, true);
  assert.equal(context.cursor_contract.caller_byte_offset_permitted, false);
  assert.equal(context.cursor_contract.caller_paragraph_ordinal_permitted, false);
  assert.equal(context.cursor_contract.caller_maximum_context_permitted, false);
  assert.equal(context.failure_contract.whole_document_permission, false);
});

test('requires a precomputed bounded same-source related-passage collection', () => {
  const members = servingMembers();
  const related = byId(members, 'RELATED_PASSAGE_CHILD_COLLECTION');

  assert.equal(related.parent_contract.same_source_document_required, true);
  assert.equal(related.action_contract.route, 'BOUNDED_PARENT_CHILD_COLLECTION');
  assert.equal(related.collection_contract.maximum_children, 12);
  assert.equal(
    related.collection_contract.precomputed_release_projection_required,
    true,
  );
  assert.equal(
    related.collection_contract.application_side_graph_traversal_permitted,
    false,
  );
  assert.equal(related.child_contract.typed_relationship_label_required, true);
  assert.equal(related.child_contract.classification_can_replace_actual_drafting, false);
});

test('grants no runtime, writer, serving, release or freeze authority', () => {
  const members = servingMembers();
  for (const member of members) {
    const values = Object.values(member.canonical_value.definition.authority_contract);
    assert.equal(values.every((value) => value === false), true);
  }
});

test('rejects missing, unregistered and semantically weakened contracts', () => {
  const missing = servingMembers().slice(1);
  assert.throws(
    () => validateAuthoredProcessServingInputs(missing),
    (error) => error.code === 'PROCESS_SERVING_CONTRACT_MEMBERSHIP_MISMATCH',
  );

  const unknown = clone(servingMembers());
  unknown[0].canonical_value.stable_id = 'UNREGISTERED_RESULT';
  assert.throws(
    () => validateAuthoredProcessServingInputs(unknown),
    (error) => error.code === 'PROCESS_SERVING_CONTRACT_MEMBERSHIP_MISMATCH',
  );

  const callerOffset = clone(servingMembers());
  byId(
    callerOffset,
    'PARENT_BOUND_PARAGRAPH_CONTEXT',
  ).cursor_contract.caller_byte_offset_permitted = true;
  assert.throws(
    () => validateAuthoredProcessServingInputs(callerOffset),
    (error) => error.code === 'INVALID_PROCESS_PARAGRAPH_CONTEXT_INPUT',
  );

  const applicationTraversal = clone(servingMembers());
  byId(
    applicationTraversal,
    'RELATED_PASSAGE_CHILD_COLLECTION',
  ).collection_contract.application_side_graph_traversal_permitted = true;
  assert.throws(
    () => validateAuthoredProcessServingInputs(applicationTraversal),
    (error) => error.code === 'INVALID_PROCESS_RELATED_PASSAGE_INPUT',
  );

  const rewrittenPreview = clone(servingMembers());
  byId(
    rewrittenPreview,
    'BOUNDED_INLINE_PASSAGE_PREVIEW',
  ).preview_contract.source_text_rewrite_permitted = true;
  assert.throws(
    () => validateAuthoredProcessServingInputs(rewrittenPreview),
    (error) => error.code === 'INVALID_PROCESS_INLINE_PREVIEW_INPUT',
  );

  const flattenedPreview = clone(servingMembers());
  byId(
    flattenedPreview,
    'BOUNDED_INLINE_PASSAGE_PREVIEW',
  ).preview_contract.multi_interval_flattening_permitted = true;
  assert.throws(
    () => validateAuthoredProcessServingInputs(flattenedPreview),
    (error) => error.code === 'INVALID_PROCESS_INLINE_PREVIEW_INPUT',
  );
});
