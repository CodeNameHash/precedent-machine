'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { indexAgreement } = require('../lib/canonical-v2/agreement-index');
const { compileContext } = require('../lib/canonical-v2/context-compilation');
const { adaptCompoundFamily, policyForFamily } = require('../lib/canonical-v2/family-compound-adapter');
const { projectLegacyAgreementV1 } = require('../lib/canonical-v2/agreement-projection');
const { canonicalJson } = require('../lib/canonical-v2/canonical-bytes');
const {
  buildBaseAnalysis,
  deriveSemanticPolicy,
  selectFamilySections,
} = require('../lib/canonical-v2/m7-deterministic-generalisation');

const ROOT = path.resolve(__dirname, '..');
const BASE = 'evidence/canonical-v2/stage-2y-structure-migration';

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

test('M2 repairs an orphaned Lilly / Verve annex limb without changing authored bytes', () => {
  const structuralPolicy = readJson(`${BASE}/control/structural-policy.json`);
  const sourceReceipt = readJson(`${BASE}/receipts/stage-2y-structure-m7-source-admission.json`);
  const agreement = sourceReceipt.candidates.find((entry) => entry.candidate_key === 'lilly-verve');
  const canonical = agreement.output_bindings.find((entry) => entry.path.endsWith('/canonical.txt'));
  const raw = agreement.output_bindings.find((entry) => entry.path.endsWith('/response.html'));
  const canonicalText = fs.readFileSync(path.join(ROOT, canonical.path), 'utf8');
  const index = indexAgreement({
    agreement_id: agreement.immutable_source_document_id,
    deal: agreement.candidate_key,
    canonical_text: canonicalText,
    canonical_text_id: agreement.canonical_text_id,
    canonical_text_sha256: canonical.sha256,
    immutable_source_document_id: agreement.immutable_source_document_id,
    raw_source_sha256: raw.sha256,
    raw_source_byte_length: raw.byte_length,
    source_path: canonical.path,
    source_bindings: { governed_deal_key: agreement.governed_deal_key },
  }, structuralPolicy);
  assert.equal(index.source_binding.agreement_id, agreement.immutable_source_document_id);
  const nodeIds = new Set(index.nodes.map((node) => node.node_occurrence_id));
  assert.equal(nodeIds.size, index.nodes.length);
  assert.ok(index.nodes.every((node) => node.parent_node_occurrence_id === null
    || nodeIds.has(node.parent_node_occurrence_id)));
  assert.ok(index.diagnostics.some((entry) => entry.diagnostic_type === 'PARENT_REPAIRED'
    && entry.detail.reason === 'MISSING_INTERNAL_PARENT'));
  assert.ok(index.diagnostics.some((entry) => entry.diagnostic_type === 'NODE_COLLISION_DROPPED'));
});

test('M7 deterministic additive path identifies source without pretending it proved a comparison point', () => {
  const structuralPolicy = readJson(`${BASE}/control/structural-policy.json`);
  const semanticPolicy = readJson(`${BASE}/control/semantic-policy.json`);
  const viewPolicy = readJson(`${BASE}/control/m6-view-policy.json`);
  const familyOrder = readJson(`${BASE}/control/m5-calibration-policy.json`).family_order_contract.families;
  const agreement = readJson(`${BASE}/control/m7-generalisation-cohort.json`).agreements[0];
  const canonicalText = fs.readFileSync(path.join(ROOT, agreement.canonical_source_binding.path), 'utf8');
  const index = indexAgreement({
    agreement_id: agreement.agreement_id,
    deal: agreement.candidate_key,
    canonical_text: canonicalText,
    canonical_text_id: agreement.canonical_text_id,
    canonical_text_sha256: agreement.canonical_source_binding.sha256,
    immutable_source_document_id: agreement.immutable_source_document_id,
    raw_source_sha256: agreement.raw_source_binding.sha256,
    raw_source_byte_length: agreement.raw_source_binding.byte_length,
    source_path: agreement.canonical_source_binding.path,
    source_bindings: { governed_deal_key: agreement.governed_deal_key },
  }, structuralPolicy);
  const indexBytes = Buffer.from(`${canonicalJson(index)}\n`, 'utf8');
  const derived = deriveSemanticPolicy(semanticPolicy, index, 'test-index.json', indexBytes);
  const context = compileContext(derived.focusNodeIds, index, derived.policy);
  const inputs = selectFamilySections(index, familyOrder);
  assert.equal(inputs.length, 25);
  assert.ok(inputs.some((entry) => entry.state === 'RECORDED_INPUT_BINDING'));
  const nodeById = new Map(index.nodes.map((node) => [node.node_occurrence_id, node]));
  assert.ok(inputs.filter((entry) => entry.state === 'RECORDED_INPUT_BINDING')
    .every((entry) => nodeById.get(entry.source_node_occurrence_id)?.node_kind !== 'SECTION'),
  'a section with authored child units must not become one comparison item');
  const analysis = buildBaseAnalysis(index, context, inputs);
  const misc = familyOrder.find((entry) => entry.family_key === 'MISC_BOILERPLATE');
  const adapted = adaptCompoundFamily(analysis, index, context, policyForFamily(misc.family_key, misc.wave));
  assert.ok(adapted.complete_proposition_count >= 1);
  const corrected = {
    ...analysis,
    compound_propositions: adapted.propositions,
    m5_correction: { semantic_projection_collection: 'compound_propositions' },
  };
  const projection = projectLegacyAgreementV1(corrected, viewPolicy);
  assert.equal(projection.counts.normal_row_count, 0);
  assert.ok(projection.counts.review_row_count >= 1);
  assert.ok(projection.review_rows.every((row) =>
    row.review_reason === 'SOURCE_PROVISION_IDENTIFIED_BUT_SPECIFIC_COMPARISON_POINT_NOT_YET_PROVED'));
  assert.equal(projection.projection_state, 'SHADOW_ONLY_NOT_SERVED');
});

test('M7 cohort is exactly three agreements and records all 25 family states', () => {
  const cohort = readJson(`${BASE}/control/m7-generalisation-cohort.json`);
  assert.equal(cohort.agreements.length, 3);
  assert.equal(new Set(cohort.agreements.map((entry) => entry.agreement_id)).size, 3);
  for (const agreement of cohort.agreements) {
    assert.equal(agreement.family_input_states.length, 25);
    assert.ok(agreement.family_input_states.every((entry) => [
      'RECORDED_INPUT_BINDING',
      'DETERMINISTIC_NO_PROVIDER',
      'INPUT_NOT_AVAILABLE',
    ].includes(entry.state)));
  }
});

test('M7 authority prohibits every external and product effect', () => {
  const authority = readJson(`${BASE}/control/m7-generalisation-authority.json`);
  assert.equal(authority.limits.model_call_count, 0);
  assert.equal(authority.limits.database_write_count, 0);
  assert.equal(authority.limits.product_write_count, 0);
  assert.equal(authority.limits.serving_change_count, 0);
  assert.equal(authority.limits.publication_count, 0);
  assert.equal(authority.limits.selector_change_count, 0);
});
