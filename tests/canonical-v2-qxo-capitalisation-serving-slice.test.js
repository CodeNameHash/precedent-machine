const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { canonicalJson, contentId, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContract } = require('../lib/canonical-v2/contract-bundle');
const {
  EXACT_DETAIL_BLOCKING_REASON,
  TIER_C_BLOCKING_REASON,
  buildQxoCapitalisationServingSlice,
  validateQxoCapitalisationServingSlice,
} = require('../lib/canonical-v2/qxo-capitalisation-serving-slice');
const {
  CAPITAL_STRUCTURE_INTERVAL,
  SECTION_5_2_INTERVAL,
  buildQxoReviewedCapitalisationSlice,
} = require('../lib/canonical-v2/reviewed-qxo-capitalisation-slice');
const { adaptSharedServingRows } = require('../lib/canonical-v2/shared-row-adapter');
const { validateProjectedMetricSlotOutput } = require('../lib/canonical-v2/serving-projection');
const { validateSharedServingRow } = require('../lib/canonical-v2/shared-serving-row');
const { QXO_5_2_TEXT } = require('./fixtures/qxo-section-5-2');

const contractBundle = compileFixtureContract();
const capitalText = fs.readFileSync('tests/fixtures/qxo-section-3-1-b.txt', 'utf8');
const corpusReleaseId = contentId('CORPUS_RELEASE/V1', 'qxo-capitalisation-serving-slice');
const servingNamespaceId = contentId('SERVING_NAMESPACE/V1', 'qxo-capitalisation-serving-slice');

function digest(label) {
  return contentId('QXO_CAPITALISATION_SERVING_TEST/V1', label);
}

function sourceContext() {
  const chunks = [' '.repeat(CAPITAL_STRUCTURE_INTERVAL.start), capitalText];
  const afterCapital = CAPITAL_STRUCTURE_INTERVAL.start + Buffer.byteLength(capitalText, 'utf8');
  chunks.push(' '.repeat(SECTION_5_2_INTERVAL.start - afterCapital), QXO_5_2_TEXT);
  const afterCondition = SECTION_5_2_INTERVAL.start + Buffer.byteLength(QXO_5_2_TEXT, 'utf8');
  chunks.push(' '.repeat(SECTION_5_2_INTERVAL.end - afterCondition));
  const text = chunks.join('');
  const canonicalTextId = digest(`canonical:${sha256Hex(text)}`);
  return Object.freeze({
    schema_version: 'ADMITTED_SEMANTIC_SOURCE_CONTEXT/V1',
    governed_deal_key: 'deal:qxo-topbuild',
    deal_admission_id: digest('deal-admission'),
    source_ordinal: 0,
    immutable_source_document_id: digest('immutable-source'),
    source_admission_manifest_id: digest('source-admission-v2'),
    semantic_extraction_input_envelope_id: digest('semantic-envelope'),
    source_content_id: digest('source-content'),
    source_occurrence_id: digest('source-occurrence'),
    source_occurrence_key: digest('source-occurrence-key'),
    source_kind: 'ORIGINAL_BYTES',
    document_hash: digest('original-sec-response-bytes'),
    source_byte_length: Buffer.byteLength(text, 'utf8') + 1000,
    canonical_text_id: canonicalTextId,
    canonical_text_sha256: sha256Hex(text),
    canonical_text_byte_length: Buffer.byteLength(text, 'utf8'),
    canonical_text: Object.freeze({
      schema_version: 'ADMITTED_CANONICAL_TEXT_RUNTIME/V1',
      canonical_text_id: canonicalTextId,
      text,
    }),
    admitted_semantic_source_context_id: digest(`context:${sha256Hex(text)}`),
  });
}

function build() {
  const context = sourceContext();
  const slice = buildQxoReviewedCapitalisationSlice({
    sourceContext: context,
    contractBundle,
  });
  const serving = buildQxoCapitalisationServingSlice({
    sourceContext: context,
    slice,
    contractBundle,
    corpusReleaseId,
    servingNamespaceId,
    dealDimensions: { sector: 'Industrials', buyer: 'QXO' },
  });
  return { context, slice, serving };
}

test('tier B publishes while the ungoverned tier C effect fails closed as an isolated sibling', () => {
  const { serving } = build();
  assert.equal(serving.projections.length, 2);
  serving.projections.forEach((output) => assert.equal(validateProjectedMetricSlotOutput(output), true));
  assert.equal(serving.projections[0].observation.canonical_value, 'MAT_ALL_RESPECTS_DE_MINIMIS');
  assert.equal(serving.projections[0].exclusion, null);
  assert.equal(serving.projections[1].observation, null);
  assert.equal(serving.projections[1].exclusion.exclusion_reason, 'RESULT_NOT_COMPARABLE');
  assert.equal(serving.projections[1].exclusion.comparability_state, 'NOT_COMPARABLE');
  assert.equal(serving.results[1].certification_state, 'NOT_CERTIFIED');
  assert.equal(serving.results[1].blocking_reason, TIER_C_BLOCKING_REASON);
  assert.equal(serving.shared_rows.length, 1);
  assert.equal(validateSharedServingRow(serving.shared_rows[0]), true);
  assert.deepEqual(serving.shared_rows[0].canonical_result.components.map((component) => ({
    slot: component.component_slot_key,
    ordinal: component.governed_ordinal,
    state: component.component_state,
  })), [
    { slot: 'CAPITALISATION_LIMBS_I_AND_III', ordinal: 0, state: 'PRESENT' },
    { slot: 'ACCURACY_EXCEPTION', ordinal: 1, state: 'PRESENT' },
    { slot: 'KNOWLEDGE_QUALIFIER_LIMB_I', ordinal: 2, state: 'ABSENT' },
    { slot: 'KNOWLEDGE_QUALIFIER_LIMB_III', ordinal: 3, state: 'ABSENT' },
  ]);

  const adapted = adaptSharedServingRows(serving.shared_rows);
  assert.equal(adapted.length, 1);
  assert.equal(adapted[0].render_kind, 'ROW');
  assert.equal(adapted[0].prepared.resolution.label, 'Accuracy of representations');
});

test('the comparable row cryptographically retains the two non-contiguous tier B limbs', () => {
  const { slice, serving } = build();
  const tierB = slice.relationships[0];
  const rowComponent = serving.shared_rows[0].canonical_result.components[0];
  const result = serving.results[0].result;

  assert.deepEqual(tierB.target_occurrence_ids, [
    slice.components[0].provision_component_id,
    slice.components[2].provision_component_id,
  ]);
  assert.ok(slice.components[0].absolute_end < slice.components[2].absolute_start);
  assert.equal(rowComponent.component_revision_id, result.component_revision_id);
  assert.equal(rowComponent.result_input_lineage_digest, result.input_lineage_digest);
  assert.deepEqual(rowComponent.relationship_revision_ids, [tierB.relationship_revision_id]);
  assert.deepEqual(rowComponent.bounded_relationship_effects[0].effect, tierB.effect);
  assert.equal(rowComponent.canonical_value, 'MAT_ALL_RESPECTS_DE_MINIMIS');
});

test('the tier C exclusion retains its exact result input without inventing a materiality claim', () => {
  const { slice, serving } = build();
  const tierCInput = slice.resultInputs[1];
  const tierCResult = serving.results[1].result;
  const tierCExclusion = serving.projections[1].exclusion;

  assert.deepEqual(tierCResult.relationship_revision_ids, [
    tierCInput.relationships[0].relationship_revision_id,
  ]);
  assert.equal(tierCExclusion.result_input_lineage_digest, tierCResult.input_lineage_digest);
  assert.deepEqual(tierCExclusion.relationship_effects[0].effect.materiality_scrape, {
    applied: true,
    disregarded_qualifiers: ['MATERIAL', 'MATERIALITY', 'COMPANY_MATERIAL_ADVERSE_EFFECT'],
  });
  assert.equal(slice.claims.some(
    (claim) => claim.claim_definition_key === 'MATERIALITY_QUALIFIER',
  ), false);
  assert.equal(canonicalJson(serving).includes('MATERIALITY_QUALIFIER'), false);
});

test('the admitted exact-detail handoff preserves every V2 identity and exact tier B evidence span', () => {
  const { context, slice, serving } = build();
  const handoff = serving.admitted_exact_detail_inputs[0];
  const tierB = slice.relationships[0];

  assert.equal(handoff.adapter_status, 'READY_FOR_ADMITTED_V2_PACKAGE');
  assert.equal(handoff.blocking_reason, EXACT_DETAIL_BLOCKING_REASON);
  assert.deepEqual(handoff.source_lineage, {
    governed_deal_key: context.governed_deal_key,
    deal_admission_id: context.deal_admission_id,
    source_ordinal: context.source_ordinal,
    immutable_source_document_id: context.immutable_source_document_id,
    source_admission_manifest_id: context.source_admission_manifest_id,
    semantic_extraction_input_envelope_id: context.semantic_extraction_input_envelope_id,
    source_content_id: context.source_content_id,
    source_occurrence_id: context.source_occurrence_id,
    source_occurrence_key: context.source_occurrence_key,
    source_kind: context.source_kind,
    document_hash: context.document_hash,
    source_byte_length: context.source_byte_length,
    canonical_text_id: context.canonical_text_id,
    canonical_text_sha256: context.canonical_text_sha256,
    canonical_text_byte_length: context.canonical_text_byte_length,
  });
  assert.deepEqual(handoff.components.map((entry) => ({
    slot: entry.component.value_slot_key,
    claim: entry.claim.claim_definition_key,
    state: entry.claim.state,
    relationships: entry.relationships.length,
  })), [
    {
      slot: 'CAPITALISATION_LIMBS_I_AND_III',
      claim: 'REPRESENTATION_ACCURACY_STANDARD',
      state: 'PRESENT',
      relationships: 1,
    },
    {
      slot: 'ACCURACY_EXCEPTION',
      claim: 'REPRESENTATION_ACCURACY_EXCEPTION',
      state: 'PRESENT',
      relationships: 0,
    },
    {
      slot: 'KNOWLEDGE_QUALIFIER_LIMB_I',
      claim: 'KNOWLEDGE_QUALIFIER',
      state: 'ABSENT',
      relationships: 0,
    },
    {
      slot: 'KNOWLEDGE_QUALIFIER_LIMB_III',
      claim: 'KNOWLEDGE_QUALIFIER',
      state: 'ABSENT',
      relationships: 0,
    },
  ]);
  assert.deepEqual(handoff.relationship_target_occurrence_ids, tierB.target_occurrence_ids);
  assert.deepEqual(handoff.ordered_excerpt_ids, [
    slice.excerpts.limb_i.excerpt_id,
    slice.excerpts.limb_iii.excerpt_id,
    slice.excerpts.tier_b.excerpt_id,
    slice.excerpts.earlier_date.excerpt_id,
    slice.excerpts.de_minimis_definition.excerpt_id,
  ]);
  assert.equal(serving.release_readiness.status, 'AWAITING_EXACT_DETAIL');
  assert.deepEqual(serving.release_readiness.blocking_reasons, [EXACT_DETAIL_BLOCKING_REASON]);
  assert.equal(serving.candidate_release_member_intents[1].shared_row, null);
  assert.equal(serving.candidate_release_member_intents[1].admitted_exact_detail_input_id, null);
});

test('the serving slice is deterministic and validation rejects source-lineage drift', () => {
  const first = build();
  const second = build();
  assert.equal(canonicalJson(first.serving), canonicalJson(second.serving));
  assert.equal(validateQxoCapitalisationServingSlice({
    candidate: first.serving,
    sourceContext: first.context,
    slice: first.slice,
    contractBundle,
    corpusReleaseId,
    servingNamespaceId,
    dealDimensions: { sector: 'Industrials', buyer: 'QXO' },
  }), true);

  const changed = structuredClone(first.serving);
  changed.admitted_exact_detail_inputs[0].source_lineage.document_hash = digest('wrong-source');
  assert.throws(() => validateQxoCapitalisationServingSlice({
    candidate: changed,
    sourceContext: first.context,
    slice: first.slice,
    contractBundle,
    corpusReleaseId,
    servingNamespaceId,
    dealDimensions: { sector: 'Industrials', buyer: 'QXO' },
  }), /identity or lineage has drifted/);
});
