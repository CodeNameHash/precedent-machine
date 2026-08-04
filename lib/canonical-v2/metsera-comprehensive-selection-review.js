'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { canonicalJson, contentId, sha256Hex, utf8ByteLength, utf8Slice } = require('./canonical-bytes');
const { validateReceiptRecord } = require('./routine-primary-source-disposition-policy');
const { sectionizeAdmittedSource } = require('./native-producer/deterministic-sectionizer');
const {
  SECTION_FAMILY_RULE_CLASSIFIED,
  classifyDeterministicSectionFamily,
} = require('./native-producer/section-family-classifier');
const { getProducerPromptModule, listRegisteredSectionFamilies } = require('./native-producer/producer-prompt-registry');
const { bindNativePromptToGovernedScope } = require('./native-producer/native-prompt-binding');
const { buildV1RenderedSurfaceAcquisitionPlan } = require('./v1-output-routing-reconciliation-audit');
const { METSERA_DEAL_ID, METSERA_OCCURRENCE_ID } = require('./metsera-pilot-extension-proposal');

const REVIEW_SCHEMA = 'M3_METSERA_COMPREHENSIVE_SELECTION_REVIEW/V1';
const MODEL_PROFILE = Object.freeze({
  profile_id: 'TERRA_MEDIUM',
  model: 'gpt-5.6-terra',
  reasoning_effort: 'medium',
});

class MetseraComprehensiveSelectionReviewError extends Error {
  constructor(code, message) { super(message); this.name = 'MetseraComprehensiveSelectionReviewError'; this.code = code; }
}

function fail(code, message) { throw new MetseraComprehensiveSelectionReviewError(code, message); }

function exactKeys(value, keys) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

function isDigest(value) { return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value); }

function moduleDigest(modulePath) { return sha256Hex(fs.readFileSync(modulePath)); }

function implementationBindings() {
  const modules = Object.freeze({
    metsera_comprehensive_selection_review: moduleDigest(__filename),
    deterministic_sectionizer: moduleDigest(require.resolve('./native-producer/deterministic-sectionizer')),
    section_family_classifier: moduleDigest(require.resolve('./native-producer/section-family-classifier')),
    producer_prompt_registry: moduleDigest(require.resolve('./native-producer/producer-prompt-registry')),
    native_prompt_binding: moduleDigest(require.resolve('./native-producer/native-prompt-binding')),
    v1_output_routing_reconciliation_audit: moduleDigest(require.resolve('./v1-output-routing-reconciliation-audit')),
  });
  return Object.freeze({
    modules,
    implementation_digest: contentId('M3_METSERA_SELECTION_REVIEW_IMPLEMENTATION/V1', modules),
  });
}

function sourceRecord(receiptRecord) {
  let record;
  try { record = validateReceiptRecord(receiptRecord); } catch (error) {
    fail(error?.code || 'INVALID_METSERA_RECEIPT', error?.message || 'Metsera receipt record is invalid.');
  }
  if (record.discovery.deal_id !== METSERA_DEAL_ID
    || record.discovery.occurrence_id !== METSERA_OCCURRENCE_ID
    || record.discovery.occurrence_kind !== 'METADATA_PRIMARY_SEC_OCCURRENCE') {
    fail('METSERA_SOURCE_IDENTITY_MISMATCH', 'Review requires the exact captured Metsera primary SEC occurrence.');
  }
  return record;
}

function deriveSectionTitle(tree, node) {
  const byId = new Map(tree.nodes.map((candidate) => [candidate.section_id, candidate]));
  let current = node;
  const seen = new Set();
  while (current && !seen.has(current.section_id)) {
    seen.add(current.section_id);
    if (typeof current.heading === 'string' && current.heading.length > 0) return current.heading;
    current = current.parent_section_id ? byId.get(current.parent_section_id) : null;
  }
  return null;
}

function dispatchableNodes(tree) {
  const nodes = tree.nodes.filter((node) => node.reference);
  const byId = new Map(tree.nodes.map((node) => [node.section_id, node]));
  const hasSectionDescendant = (candidate) => nodes.some((node) => {
    if (node.kind !== 'SECTION' || !node.parent_section_id) return false;
    let parent = node.parent_section_id;
    const seen = new Set();
    while (parent && !seen.has(parent)) {
      if (parent === candidate.section_id) return true;
      seen.add(parent);
      parent = byId.get(parent)?.parent_section_id || null;
    }
    return false;
  });
  const primary = nodes.filter((node) => node.kind === 'SECTION'
    || (node.kind === 'ARTICLE' && !hasSectionDescendant(node)));
  return primary.length > 0 ? primary : nodes.filter((node) => node.kind === 'SUBSECTION');
}

function candidateWorkItem(record, node, classification, text) {
  const promptBuilder = getProducerPromptModule(classification.section_family);
  if (!promptBuilder) fail('UNREGISTERED_POSITIVE_FAMILY', `No prompt builder is registered for ${classification.section_family}.`);
  const scope = Object.freeze({
    schema_version: 'NATIVE_GOVERNED_SCOPE/V1',
    document_hash: record.conversion.canonical_text_sha256,
    section_reference: node.reference,
    section_id: node.section_id,
    parent_section_id: node.parent_section_id,
    kind: node.kind,
    depth: node.depth,
    start: node.start,
    end: node.end,
    text_sha256: node.text_sha256,
    source_text: text,
    ...(classification.covenant_side ? { covenant_side: classification.covenant_side } : {}),
  });
  const rawPrompt = promptBuilder({ source_text: text, governed_scope: scope, known_definitions: [] });
  const prompt = bindNativePromptToGovernedScope({ prompt: rawPrompt, governed_scope: scope });
  const body = {
    occurrence_id: record.discovery.occurrence_id,
    source_digest: record.conversion.canonical_text_sha256,
    section_id: node.section_id,
    section_reference: node.reference,
    family_id: classification.section_family,
    prompt_id: prompt.prompt_id,
    prompt_version: prompt.prompt_version,
    model_profile: MODEL_PROFILE.profile_id,
  };
  return Object.freeze({
    candidate_work_item_id: contentId('M3_METSERA_SELECTION_REVIEW_WORK_ITEM/V1', body),
    ...body,
    section_kind: node.kind,
    section_text_sha256: node.text_sha256,
    section_text_byte_length: utf8ByteLength(text),
    prompt_binding_schema: prompt.prompt_binding_schema,
    prompt_digest: contentId('M3_METSERA_SELECTION_REVIEW_PROMPT/V1', prompt),
    prompt_byte_length: utf8ByteLength(canonicalJson(prompt.messages)),
    classifier_provenance: classification.provenance,
    classifier_version: classification.classifier_version,
    ...(classification.covenant_side ? { covenant_side: classification.covenant_side } : {}),
  });
}

function deterministicCandidates(record, families) {
  const sourceText = record.conversion.canonical_text;
  const tree = sectionizeAdmittedSource({
    source_text: sourceText,
    document_hash: record.conversion.canonical_text_sha256,
  });
  const candidates = [];
  for (const node of dispatchableNodes(tree)) {
    const text = utf8Slice(sourceText, node.start, node.end);
    const classification = classifyDeterministicSectionFamily({
      title: deriveSectionTitle(tree, node),
      article_context: node.article_context || null,
      source_text: text,
    });
    if (!classification || classification.provenance !== SECTION_FAMILY_RULE_CLASSIFIED
      || !families.includes(classification.section_family)) continue;
    candidates.push(candidateWorkItem(record, node, classification, text));
  }
  return Object.freeze(candidates.sort((left, right) => left.candidate_work_item_id.localeCompare(right.candidate_work_item_id)));
}

function renderedSurfaceEvidenceState(repositoryRoot) {
  const plan = buildV1RenderedSurfaceAcquisitionPlan({ repository_root: repositoryRoot });
  return Object.freeze({
    acquisition_plan: plan,
    status: plan.status,
  });
}

function familyMatrix(families, candidates, renderedSurfaceStatus) {
  const candidateByFamily = new Map();
  for (const candidate of candidates) {
    const rows = candidateByFamily.get(candidate.family_id) || [];
    rows.push(candidate.candidate_work_item_id);
    candidateByFamily.set(candidate.family_id, rows);
  }
  return Object.freeze(families.map((familyId) => {
    const candidateIds = Object.freeze([...(candidateByFamily.get(familyId) || [])].sort());
    const disposition = candidateIds.length > 0
      ? 'DETERMINISTIC_SIGNAL_REQUIRES_RENDERED_SURFACE_CAPTURE_AND_SELECTION_REVIEW'
      : 'UNRESOLVED_NO_SIGNAL_REQUIRES_RENDERED_SURFACE_CAPTURE_AND_COVERAGE_ATTESTATION';
    return Object.freeze({
      family_id: familyId,
      candidate_work_item_ids: candidateIds,
      rendered_surface_evidence_state: renderedSurfaceStatus,
      disposition,
    });
  }));
}

function buildMetseraComprehensiveSelectionReview({ receipt_record: receiptRecord, repository_root: repositoryRoot } = {}) {
  if (typeof repositoryRoot !== 'string' || !path.isAbsolute(repositoryRoot)) {
    fail('REPOSITORY_ROOT_REQUIRED', 'An explicit repository root is required for the V1 output inventory.');
  }
  const record = sourceRecord(receiptRecord);
  const families = Object.freeze(listRegisteredSectionFamilies());
  const candidates = deterministicCandidates(record, families);
  const renderedSurface = renderedSurfaceEvidenceState(repositoryRoot);
  const matrix = familyMatrix(families, candidates, renderedSurface.status);
  const bindings = implementationBindings();
  const unresolved = Object.freeze(matrix
    .filter((entry) => entry.disposition !== 'CORROBORATED_DETERMINISTIC_AND_V1_SIGNAL_REQUIRES_SELECTION_REVIEW')
    .map((entry) => entry.family_id));
  const body = {
    schema_version: REVIEW_SCHEMA,
    status: 'REVIEW_REQUIRED_NOT_AUTHORITY',
    scope: 'COMPLETE_METSERA_REGISTERED_FAMILY_REVIEW',
    separate_from_pilot_work_item_set: 'M3_12_CALL_PILOT',
    authority: Object.freeze({
      provider_authority: 'NONE', execution_authority: 'NONE', source_admission_authority: 'NONE',
      database_authority: 'NONE', production_authority: 'NONE',
    }),
    source: Object.freeze({
      occurrence_id: record.discovery.occurrence_id,
      discovery_id: record.discovery.discovery_id,
      receipt_id: record.receipt.receipt_id,
      raw_sha256: record.receipt.raw_sha256,
      canonical_text_sha256: record.conversion.canonical_text_sha256,
      canonical_text_byte_length: record.conversion.canonical_text_byte_length,
    }),
    input_digests: Object.freeze({
      source_record_digest: contentId('M3_METSERA_SELECTION_REVIEW_SOURCE_RECORD/V1', {
        discovery_id: record.discovery.discovery_id,
        receipt_id: record.receipt.receipt_id,
        raw_sha256: record.receipt.raw_sha256,
        canonical_text_sha256: record.conversion.canonical_text_sha256,
      }),
      v1_rendered_surface_acquisition_plan_digest: renderedSurface.acquisition_plan.acquisition_plan_id,
      implementation_digest: bindings.implementation_digest,
    }),
    implementation_bindings: bindings,
    model_profile: MODEL_PROFILE,
    registered_families: families,
    deterministic_candidate_work_items: candidates,
    rendered_surface_evidence_state: renderedSurface.status,
    v1_rendered_surface_acquisition_plan: renderedSurface.acquisition_plan,
    family_review_matrix: matrix,
    unresolved_family_ids: unresolved,
    selection_boundary: 'NO_WORK_ITEM_IS_SELECTED_OR_EXECUTABLE_UNTIL_REVIEW_ISSUES_A_SEPARATE_AUTHORITY',
  };
  return Object.freeze({ ...body, review_id: contentId(REVIEW_SCHEMA, body) });
}

function validateMetseraComprehensiveSelectionReview(review) {
  const keys = [
    'schema_version', 'status', 'scope', 'separate_from_pilot_work_item_set', 'authority', 'source',
    'input_digests', 'implementation_bindings', 'model_profile', 'registered_families',
    'deterministic_candidate_work_items', 'rendered_surface_evidence_state', 'v1_rendered_surface_acquisition_plan', 'family_review_matrix', 'unresolved_family_ids', 'selection_boundary', 'review_id',
  ];
  if (!exactKeys(review, keys) || review.schema_version !== REVIEW_SCHEMA
    || review.status !== 'REVIEW_REQUIRED_NOT_AUTHORITY'
    || review.scope !== 'COMPLETE_METSERA_REGISTERED_FAMILY_REVIEW'
    || review.separate_from_pilot_work_item_set !== 'M3_12_CALL_PILOT'
    || !exactKeys(review.authority, ['provider_authority', 'execution_authority', 'source_admission_authority', 'database_authority', 'production_authority'])
    || Object.values(review.authority).some((value) => value !== 'NONE')
    || !exactKeys(review.source, ['occurrence_id', 'discovery_id', 'receipt_id', 'raw_sha256', 'canonical_text_sha256', 'canonical_text_byte_length'])
    || review.source.occurrence_id !== METSERA_OCCURRENCE_ID
    || !isDigest(review.source.discovery_id) || !isDigest(review.source.receipt_id) || !isDigest(review.source.raw_sha256) || !isDigest(review.source.canonical_text_sha256)
    || !Number.isSafeInteger(review.source.canonical_text_byte_length) || review.source.canonical_text_byte_length < 1
    || !exactKeys(review.input_digests, ['source_record_digest', 'v1_rendered_surface_acquisition_plan_digest', 'implementation_digest'])
    || Object.values(review.input_digests).some((value) => !isDigest(value))
    || !exactKeys(review.implementation_bindings, ['modules', 'implementation_digest'])
    || !isDigest(review.implementation_bindings.implementation_digest)
    || review.implementation_bindings.implementation_digest !== contentId(
      'M3_METSERA_SELECTION_REVIEW_IMPLEMENTATION/V1',
      review.implementation_bindings.modules,
    )
    || review.implementation_bindings.implementation_digest !== review.input_digests.implementation_digest
    || !Array.isArray(review.registered_families)
    || canonicalJson(review.registered_families) !== canonicalJson(listRegisteredSectionFamilies())
    || !Array.isArray(review.deterministic_candidate_work_items)
    || review.rendered_surface_evidence_state !== 'STATIC_EVIDENCE_INCOMPLETE'
    || !review.v1_rendered_surface_acquisition_plan
    || review.v1_rendered_surface_acquisition_plan.status !== 'STATIC_EVIDENCE_INCOMPLETE'
    || !Array.isArray(review.family_review_matrix)
    || review.family_review_matrix.length !== review.registered_families.length
    || !Array.isArray(review.unresolved_family_ids)
    || review.selection_boundary !== 'NO_WORK_ITEM_IS_SELECTED_OR_EXECUTABLE_UNTIL_REVIEW_ISSUES_A_SEPARATE_AUTHORITY') {
    fail('METSERA_COMPREHENSIVE_REVIEW_INVALID', 'Metsera comprehensive selection review has an invalid review-only shape.');
  }
  const matrixFamilies = review.family_review_matrix.map((entry) => entry?.family_id);
  if (canonicalJson(matrixFamilies) !== canonicalJson(review.registered_families)
    || review.input_digests.source_record_digest !== contentId('M3_METSERA_SELECTION_REVIEW_SOURCE_RECORD/V1', {
      discovery_id: review.source.discovery_id,
      receipt_id: review.source.receipt_id,
      raw_sha256: review.source.raw_sha256,
      canonical_text_sha256: review.source.canonical_text_sha256,
    })
    || review.input_digests.v1_rendered_surface_acquisition_plan_digest !== review.v1_rendered_surface_acquisition_plan.acquisition_plan_id) {
    fail('METSERA_COMPREHENSIVE_REVIEW_INVALID', 'Metsera comprehensive selection review does not bind its complete family or V1 inventory.');
  }
  const { review_id: reviewId, ...body } = review;
  if (!isDigest(reviewId) || reviewId !== contentId(REVIEW_SCHEMA, body)) {
    fail('METSERA_COMPREHENSIVE_REVIEW_ID_MISMATCH', 'Metsera comprehensive selection review does not match its content identity.');
  }
  return Object.freeze({ ...review });
}

function validateMetseraComprehensiveSelectionReviewAgainstInputs({
  review,
  receipt_record: receiptRecord,
  repository_root: repositoryRoot,
} = {}) {
  const validated = validateMetseraComprehensiveSelectionReview(review);
  if (typeof repositoryRoot !== 'string' || !path.isAbsolute(repositoryRoot)) {
    fail('REPOSITORY_ROOT_REQUIRED', 'An explicit repository root is required to recompute V1 input digests.');
  }
  const record = sourceRecord(receiptRecord);
  const expectedSource = {
    occurrence_id: record.discovery.occurrence_id,
    discovery_id: record.discovery.discovery_id,
    receipt_id: record.receipt.receipt_id,
    raw_sha256: record.receipt.raw_sha256,
    canonical_text_sha256: record.conversion.canonical_text_sha256,
    canonical_text_byte_length: record.conversion.canonical_text_byte_length,
  };
  const expectedSourceDigest = contentId('M3_METSERA_SELECTION_REVIEW_SOURCE_RECORD/V1', {
    discovery_id: expectedSource.discovery_id,
    receipt_id: expectedSource.receipt_id,
    raw_sha256: expectedSource.raw_sha256,
    canonical_text_sha256: expectedSource.canonical_text_sha256,
  });
  if (canonicalJson(validated.source) !== canonicalJson(expectedSource)
    || validated.input_digests.source_record_digest !== expectedSourceDigest) {
    fail('METSERA_REVIEW_SOURCE_STALE_OR_SUBSTITUTED', 'Metsera review does not bind the recomputed source receipt.');
  }
  const renderedSurface = renderedSurfaceEvidenceState(repositoryRoot);
  if (validated.rendered_surface_evidence_state !== renderedSurface.status
    || canonicalJson(validated.v1_rendered_surface_acquisition_plan) !== canonicalJson(renderedSurface.acquisition_plan)
    || validated.input_digests.v1_rendered_surface_acquisition_plan_digest !== renderedSurface.acquisition_plan.acquisition_plan_id) {
    fail('METSERA_REVIEW_V1_INPUTS_STALE_OR_SUBSTITUTED', 'Metsera review does not bind the recomputed V1 output inventory.');
  }
  const currentBindings = implementationBindings();
  if (canonicalJson(validated.implementation_bindings) !== canonicalJson(currentBindings)
    || validated.input_digests.implementation_digest !== currentBindings.implementation_digest) {
    fail('METSERA_REVIEW_IMPLEMENTATION_STALE_OR_SUBSTITUTED', 'Metsera review does not bind the current deterministic implementation.');
  }
  return validated;
}

module.exports = {
  METSERA_DEAL_ID,
  METSERA_OCCURRENCE_ID,
  MODEL_PROFILE,
  REVIEW_SCHEMA,
  MetseraComprehensiveSelectionReviewError,
  buildMetseraComprehensiveSelectionReview,
  validateMetseraComprehensiveSelectionReview,
  validateMetseraComprehensiveSelectionReviewAgainstInputs,
};
