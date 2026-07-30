const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  PRODUCT_SOURCE_READER_CONTRACT_IDS,
  validateAuthoredProductSourceReaderInputs,
} = require(
  '../lib/canonical-v2/product-source-reader-contract-input-validator',
);
const {
  canonicalJson,
  sha256Hex,
} = require('../lib/canonical-v2/canonical-bytes');

const CONTRACT_PATH = path.join(
  __dirname,
  '../contracts/canonical-v2/successor/product/query/product-source-reader-definition.v1.json',
);
const PROCESS_SOURCE_PATHS = Object.freeze({
  PROCESS_PHRASEBOOK_PASSAGE_RESULT:
    '../contracts/canonical-v2/successor/process/results/process-phrasebook-passage-result.v1.json',
  BOUNDED_INLINE_PASSAGE_PREVIEW:
    '../contracts/canonical-v2/successor/process/serving/bounded-inline-passage-preview.v1.json',
  PARENT_BOUND_PARAGRAPH_CONTEXT:
    '../contracts/canonical-v2/successor/process/serving/parent-bound-paragraph-context.v1.json',
  RELATED_PASSAGE_CHILD_COLLECTION:
    '../contracts/canonical-v2/successor/process/serving/related-passage-child-collection.v1.json',
});

function loadValue() {
  return JSON.parse(fs.readFileSync(CONTRACT_PATH, 'utf8'));
}

function loadMembers() {
  const canonicalValue = loadValue();
  return [{
    object_kind: canonicalValue.object_kind,
    canonical_value: canonicalValue,
  }];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('registers one PM-wide Product source-reader definition', () => {
  const members = loadMembers();
  assert.doesNotThrow(
    () => validateAuthoredProductSourceReaderInputs(members),
  );
  assert.deepEqual(
    PRODUCT_SOURCE_READER_CONTRACT_IDS,
    ['PRODUCT_SOURCE_READER_DEFINITION'],
  );
  assert.equal(
    members[0].canonical_value.schema_version,
    'PRODUCT_SOURCE_READER_CONTRACT_INPUT/V1',
  );
  assert.equal(
    members[0].canonical_value.definition.action_contract.schema_version,
    'PRODUCT_SOURCE_READER_ACTION/V1',
  );
});

test('binds every action to one exact Product result and release', () => {
  const definition = loadValue().definition;

  assert.equal(
    definition.action_contract.parent_definition_stable_id,
    'PRODUCT_QUERY_RESULT_DEFINITION',
  );
  assert.equal(
    definition.action_contract.parent_schema_version,
    'PRODUCT_QUERY_RESULT/V1',
  );
  assert.equal(
    definition.parent_binding_contract
      .exact_parent_product_result_identity_required,
    true,
  );
  assert.equal(
    definition.parent_binding_contract
      .exact_candidate_release_manifest_id_and_payload_digest_required,
    true,
  );
  assert.equal(
    definition.parent_binding_contract
      .requested_domain_source_action_must_be_query_and_release_admitted,
    true,
  );
});

test('delegates Process source reading to the exact admitted definitions', () => {
  const process = loadValue().definition.process_binding_contract;

  assert.equal(
    process.domain_result_definition_stable_id,
    'PROCESS_PHRASEBOOK_PASSAGE_RESULT',
  );
  assert.deepEqual(
    process.required_source_definitions.map((item) => item.stable_id),
    [
      'PROCESS_PHRASEBOOK_PASSAGE_RESULT',
      'BOUNDED_INLINE_PASSAGE_PREVIEW',
      'PARENT_BOUND_PARAGRAPH_CONTEXT',
      'RELATED_PASSAGE_CHILD_COLLECTION',
    ],
  );
  assert.equal(
    process.required_source_definitions.every(
      (item) => /^[a-f0-9]{64}$/.test(item.definition_digest),
    ),
    true,
  );
  for (const item of process.required_source_definitions) {
    const sourceValue = JSON.parse(fs.readFileSync(
      path.join(__dirname, PROCESS_SOURCE_PATHS[item.stable_id]),
      'utf8',
    ));
    assert.equal(sourceValue.stable_id, item.stable_id);
    assert.equal(sourceValue.schema_version, item.schema_version);
    assert.equal(
      sha256Hex(Buffer.from(canonicalJson(sourceValue.definition), 'utf8')),
      item.definition_digest,
    );
  }
  assert.equal(
    process.selected_source_uses_parent_exact_detail_reference,
    true,
  );
  assert.equal(
    process.related_source_uses_child_exact_detail_reference,
    true,
  );
});

test('delegates Agreement source reading without a Product fallback', () => {
  const agreement = loadValue().definition.agreement_binding_contract;

  assert.equal(agreement.domain_key, 'AGREEMENT');
  assert.equal(
    agreement.selected_source_uses_query_admitted_exact_detail_action,
    true,
  );
  assert.equal(
    agreement.exact_detail_action_stable_id_version_and_digest_required,
    true,
  );
  assert.equal(
    agreement.context_or_related_action_requires_separate_release_admission,
    true,
  );
  assert.equal(
    agreement.missing_context_or_related_action_disposition,
    'SOURCE_ACTION_NOT_ADMITTED',
  );
  assert.equal(agreement.product_fallback_source_action_permitted, false);
});

test('opens the exact checked drafting without a caller source locator', () => {
  const selected = loadValue().definition.selected_source_contract;

  assert.equal(
    selected.exact_detail_reference_must_come_from_checked_domain_result,
    true,
  );
  assert.equal(selected.exact_release_and_result_identity_preserved, true);
  assert.equal(selected.selected_evidence_remains_highlighted, true);
  assert.equal(selected.source_text_can_be_rewritten_or_summarised, false);
  assert.equal(selected.caller_source_locator_permitted, false);
  assert.equal(selected.whole_document_permission_created, false);
});

test('adds one checked paragraph per repeated context action', () => {
  const context = loadValue().definition.context_expansion_contract;

  assert.equal(
    context.domain_action_stable_id,
    'PARENT_BOUND_PARAGRAPH_CONTEXT',
  );
  assert.equal(context.paragraphs_added_per_action, 1);
  assert.equal(context.maximum_paragraphs_per_direction, 12);
  assert.equal(context.repeat_click_permitted, true);
  assert.equal(context.server_issued_parent_bound_cursor_required, true);
  assert.equal(
    context.caller_byte_offset_or_paragraph_ordinal_permitted,
    false,
  );
  assert.equal(
    context.selected_evidence_identity_and_bytes_remain_unchanged,
    true,
  );
  assert.equal(context.context_can_replace_selected_passage, false);
});

test('shows checked same-proxy drafting and never a summary substitute', () => {
  const related = loadValue().definition.related_passage_contract;

  assert.equal(
    related.domain_action_stable_id,
    'RELATED_PASSAGE_CHILD_COLLECTION',
  );
  assert.equal(related.same_source_document_as_parent_required, true);
  assert.equal(related.maximum_related_passages, 12);
  assert.equal(related.precomputed_release_projection_required, true);
  assert.equal(related.typed_relationship_label_required, true);
  assert.equal(related.verbatim_preview_required, true);
  assert.equal(related.child_exact_detail_reference_required, true);
  assert.equal(
    related.child_must_belong_to_exact_parent_collection_and_release,
    true,
  );
  assert.equal(
    related.classification_can_replace_actual_drafting,
    false,
  );
  assert.equal(related.runtime_relationship_discovery_permitted, false);
});

test('keeps unavailable domain actions inactive without a second engine', () => {
  const definition = loadValue().definition;

  assert.equal(
    definition.delegation_contract
      .product_can_create_second_source_retrieval_engine,
    false,
  );
  assert.equal(
    definition.extensibility_contract
      .domain_without_admitted_context_or_related_action_keeps_that_action_inactive,
    true,
  );
  assert.equal(
    definition.extensibility_contract
      .agreement_process_and_future_cvr_use_same_product_action_schema,
    true,
  );
  assert.equal(
    definition.extensibility_contract
      .new_domain_can_create_second_product_source_reader,
    false,
  );
});

test('isolates cursor and child failures without changing the passage', () => {
  const failure = loadValue().definition.failure_contract;

  assert.equal(failure.invalid_cursor_disposition, 'INVALID_PARENT_BOUND_CURSOR');
  assert.equal(
    failure.invalid_child_disposition,
    'RELATED_PASSAGE_NOT_IN_PARENT_COLLECTION',
  );
  assert.equal(failure.failure_affects_requested_action_only, true);
  assert.equal(
    failure.valid_parent_and_sibling_results_remain_unchanged,
    true,
  );
  assert.equal(
    failure.failure_can_remove_or_replace_selected_passage,
    false,
  );
  assert.equal(failure.failure_can_redirect_to_newer_release, false);
});

test('uses action-specific identity inputs without cursor leakage', () => {
  const identity = loadValue().definition.identity_contract;

  assert.equal(
    identity.common_identity_inputs.includes(
      'server_issued_parent_bound_cursor',
    ),
    false,
  );
  assert.deepEqual(
    identity.action_specific_identity_inputs.OPEN_SELECTED_SOURCE,
    ['parent_exact_detail_reference'],
  );
  assert.deepEqual(
    identity.action_specific_identity_inputs.EXPAND_ONE_PARAGRAPH_ABOVE,
    ['server_issued_parent_bound_cursor'],
  );
  assert.deepEqual(
    identity.action_specific_identity_inputs.OPEN_RELATED_SOURCE,
    [
      'related_child_result_identity',
      'child_exact_detail_reference',
    ],
  );
});

test('rejects missing, duplicate and semantically changed definitions', () => {
  assert.doesNotThrow(
    () => validateAuthoredProductSourceReaderInputs([]),
  );
  assert.throws(
    () => validateAuthoredProductSourceReaderInputs([
      ...loadMembers(),
      clone(loadMembers()[0]),
    ]),
    { code: 'PRODUCT_SOURCE_READER_CONTRACT_MEMBERSHIP_MISMATCH' },
  );

  const changedCursor = loadMembers();
  changedCursor[0].canonical_value.definition.context_expansion_contract
    .caller_byte_offset_or_paragraph_ordinal_permitted = true;
  assert.throws(
    () => validateAuthoredProductSourceReaderInputs(changedCursor),
    { code: 'INVALID_PRODUCT_SOURCE_READER_DEFINITION_INPUT' },
  );

  const changedRelated = loadMembers();
  changedRelated[0].canonical_value.definition.related_passage_contract
    .classification_can_replace_actual_drafting = true;
  assert.throws(
    () => validateAuthoredProductSourceReaderInputs(changedRelated),
    { code: 'INVALID_PRODUCT_SOURCE_READER_DEFINITION_INPUT' },
  );

  const nested = loadMembers();
  nested[0].canonical_value.definition.identity_contract
    .invented_authority = true;
  assert.throws(
    () => validateAuthoredProductSourceReaderInputs(nested),
    { code: 'INVALID_PRODUCT_SOURCE_READER_DEFINITION_INPUT' },
  );
});

test('grants no runtime, data, source, write or production authority', () => {
  const authority = loadValue().definition.authority_contract;
  assert.equal(
    Object.values(authority).every((value) => value === false),
    true,
  );

  const sources = [
    fs.readFileSync(CONTRACT_PATH, 'utf8'),
    fs.readFileSync(
      path.join(
        __dirname,
        '../lib/canonical-v2/product-source-reader-contract-input-validator.js',
      ),
      'utf8',
    ),
  ];
  for (const source of sources) {
    for (const prohibited of [
      'fetch(',
      'XMLHttpRequest',
      'supabase',
      'openai',
      'anthropic',
    ]) {
      assert.equal(source.includes(prohibited), false, prohibited);
    }
  }
});
