'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const metseraFixture = require('../__fixtures__/canonical-v2/metsera-exclusivity-p8.json');
const { getFourDealLocalDemo } = require('./four-deal-local-demo');

const FOUR_DEAL_LOCAL_DEMO_RESULT_SCHEMA = 'FOUR_DEAL_LOCAL_DEMO_RESULT/V1';
const DEFAULT_M3_ARTIFACT_ROOT = '/private/tmp/canonical-v2-m3-pilot-20260803.L3KSNP';
const FINAL_REVIEW_PACKET_PATH = 'final-review/sealed-final-pilot-review-packet.json';

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function displayValue(value) {
  if (value === null || value === undefined) return 'Not stated';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function readJsonArtifact(absolutePath, label) {
  if (!fs.existsSync(absolutePath)) throw new Error(`four-deal local preview ${label} is unavailable: ${absolutePath}`);
  const bytes = fs.readFileSync(absolutePath);
  let content;
  try {
    content = JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    throw new Error(`four-deal local preview ${label} is malformed: ${absolutePath}`);
  }
  return Object.freeze({ path: absolutePath, sha256: sha256(bytes), content });
}

function sourceCitation(entry) {
  return entry.source_citation || entry.section_reference || 'Source citation unavailable';
}

function resolutionForFinalWorkItem(workItem) {
  const source = workItem.source_kind === 'REPAIRED_REPLAY'
    ? workItem.repaired_replay
    : workItem.source_kind === 'ADJUDICATED_FIRST_PASS'
      ? workItem.first_work_result
      : workItem.source_kind === 'PASSED_ITERATION_2'
        ? workItem.iteration_2_work_result
        : workItem.source_kind === 'REPLAY_ONLY'
          ? workItem.replay_result
          : null;
  if (!source?.resolution || source.work_item_id !== workItem.work_item_id) {
    throw new Error(`four-deal local preview cannot resolve final work item: ${workItem.work_item_id}`);
  }
  return source.resolution;
}

function m3Rows(workItems, legalFindingsByWorkItem) {
  const rows = [];
  for (const work of workItems) {
    const resolution = resolutionForFinalWorkItem(work);
    const legalFinding = legalFindingsByWorkItem.get(work.work_item_id) || null;
    const legalReviewState = legalFinding ? legalFinding.status : 'PENDING_INDEPENDENT_REVIEW';
    const queueByClaimRevisionId = new Map(
      (resolution.review_queue || [])
        .filter((entry) => entry.has_resolution && entry.claim_revision_id)
        .map((entry) => [entry.claim_revision_id, entry]),
    );
    for (const entry of resolution.resolved || []) {
      const review = queueByClaimRevisionId.get(entry.claim?.claim_revision_id);
      rows.push({
        row_id: entry.claim?.claim_revision_id || `${work.work_item_id}:resolved:${rows.length}`,
        family: entry.concept_key || 'M3',
        work_item_id: work.work_item_id,
        source_kind: work.source_kind,
        result_type: 'GOVERNED_VALUE',
        governed_field: entry.resolved_claim_definition_key || entry.generic_claim_key,
        governed_value: displayValue(entry.claim?.canonical_value),
        source_quote: entry.claim?.raw_value || '',
        source_citation: sourceCitation(entry),
        legal_review_state: legalReviewState,
        legal_review_reason: legalFinding?.reason || null,
        resolver_state: 'RESOLVED',
        resolver_reasons: review?.reasons || entry.triage?.reasons || [],
        warning: null,
      });
    }
    for (const entry of (resolution.review_queue || []).filter((item) => !item.has_resolution)) {
      rows.push({
        row_id: entry.original_claim_occurrence_id || `${work.work_item_id}:review:${rows.length}`,
        family: entry.concept_key || 'M3',
        work_item_id: work.work_item_id,
        source_kind: work.source_kind,
        result_type: 'REVIEW_ITEM',
        governed_field: entry.resolved_claim_definition_key || entry.generic_claim_key,
        governed_value: displayValue(entry.canonical_value),
        source_quote: entry.raw_value || '',
        source_citation: sourceCitation(entry),
        legal_review_state: legalReviewState,
        legal_review_reason: legalFinding?.reason || null,
        resolver_state: 'REVIEW_QUEUE',
        resolver_reasons: entry.reasons || [],
        warning: 'This M3 output has no closed governed value.',
      });
    }
    for (const entry of resolution.open_world || []) {
      rows.push({
        row_id: entry.closure_id || `${work.work_item_id}:open-world:${rows.length}`,
        family: entry.concept_key || 'M3',
        work_item_id: work.work_item_id,
        source_kind: work.source_kind,
        result_type: 'OPEN_WORLD_WARNING',
        governed_field: entry.claim_definition_key || 'OPEN_WORLD',
        governed_value: displayValue(entry.canonical_value),
        source_quote: entry.raw_value || '',
        source_citation: sourceCitation(entry),
        legal_review_state: legalReviewState,
        legal_review_reason: legalFinding?.reason || null,
        resolver_state: 'OPEN_WORLD',
        resolver_reasons: [],
        warning: entry.reason || 'This text is outside the currently governed value set.',
      });
    }
  }
  return rows;
}

function finalLegalFindings(paths) {
  const findings = new Map();
  const artifacts = paths.map((pathname) => readJsonArtifact(pathname, 'final legal findings'));
  for (const artifact of artifacts) {
    if (!Array.isArray(artifact.content.findings)) throw new Error(`four-deal local preview final legal findings lack findings: ${artifact.path}`);
    for (const finding of artifact.content.findings) {
      if (!finding?.work_item_id || !['PASS', 'FAIL'].includes(finding.status) || findings.has(finding.work_item_id)) {
        throw new Error(`four-deal local preview final legal findings are invalid: ${artifact.path}`);
      }
      findings.set(finding.work_item_id, Object.freeze({ status: finding.status, reason: finding.reason || '' }));
    }
  }
  return Object.freeze({ findings, artifacts });
}

function m3DealResult(deal, finalWorkItems, legalFindingsByWorkItem) {
  const target = String(deal.target_display || '').toLowerCase();
  const sourcePrefix = target === 'topbuild' ? 'topbuild-'
    : target === 'skechers' ? 'skechers-'
      : 'modiv-';
  const workItems = finalWorkItems.filter((work) => (
    typeof work.work_item_id === 'string' && work.work_item_id.startsWith(sourcePrefix)
  ));
  const hasCompleteLegalFindings = workItems.length > 0
    && workItems.every((work) => legalFindingsByWorkItem.has(work.work_item_id));
  return {
    deal_id: deal.id,
    deal_name: deal.target_display,
    result_domain: 'M3_CANONICAL_REVIEW',
    result_state: hasCompleteLegalFindings ? 'SEALED_FINAL_LEGAL_FINDINGS_BOUND' : 'PENDING_INDEPENDENT_REVIEW',
    rows: m3Rows(workItems, legalFindingsByWorkItem),
    work_items: workItems.map((work) => ({
      work_item_id: work.work_item_id,
      source_kind: work.source_kind,
      legal_review_state: legalFindingsByWorkItem.get(work.work_item_id)?.status || 'PENDING_INDEPENDENT_REVIEW',
    })),
    product_component: null,
  };
}

function metseraDealResult(deal) {
  const shared = metseraFixture.shared_result;
  const citation = shared.exact_citation;
  const processSlot = metseraFixture.presentation?.result_slots?.find((slot) => slot.slot_state === 'VALID') || null;
  return {
    deal_id: deal.id,
    deal_name: deal.target_display,
    result_domain: 'PROCESS_PRODUCT',
    result_state: metseraFixture.release_state,
    rows: [{
      row_id: shared.product_query_result_identity,
      family: 'PROCESS_EXCLUSIVITY',
      work_item_id: metseraFixture.candidate_product_result_id,
      result_type: 'GOVERNED_VALUE',
      governed_field: shared.result_fields?.[0]?.field_reference?.field_key || 'process_outcome',
      governed_value: displayValue(shared.result_fields?.[0]?.value),
      source_quote: shared.domain_result_payload,
      source_citation: citation.human_readable_source_label,
      legal_review_state: null,
      legal_review_reason: null,
      product_result_state: metseraFixture.release_state,
      resolver_state: 'PROCESS_PRODUCT_RESULT',
      resolver_reasons: [],
      warning: 'This sealed Process Product result is an inactive candidate and is not a production release.',
    }],
    product_component: processSlot ? {
      slot_identity: processSlot.slot_identity,
      slot_state: processSlot.slot_state,
      exact_content: processSlot.exact_content,
      preview: processSlot.preview,
      metadata: processSlot.metadata,
      exact_citation: processSlot.exact_citation,
      action_targets: [],
    } : null,
  };
}

function getFrozenFourDealLocalDemoResult({
  artifact_root: artifactRoot = process.env.CANONICAL_V2_M3_PREVIEW_ARTIFACT_ROOT || DEFAULT_M3_ARTIFACT_ROOT,
  final_legal_finding_paths: finalLegalFindingPaths = process.env.CANONICAL_V2_M3_FINAL_LEGAL_FINDINGS_PATHS
    ? process.env.CANONICAL_V2_M3_FINAL_LEGAL_FINDINGS_PATHS.split(path.delimiter).filter(Boolean)
    : [],
} = {}) {
  const demo = getFourDealLocalDemo();
  const artifact = readJsonArtifact(path.join(artifactRoot, FINAL_REVIEW_PACKET_PATH), 'final review packet');
  if (!Array.isArray(artifact.content.work_items) || artifact.content.work_items.length !== 12
    || typeof artifact.content.final_review_packet_id !== 'string') {
    throw new Error('four-deal local preview final review packet is invalid');
  }
  const legal = finalLegalFindings(finalLegalFindingPaths);
  const deals = demo.deals.map((deal) => (
    deal.target_display === 'Metsera'
      ? metseraDealResult(deal)
      : m3DealResult(deal, artifact.content.work_items, legal.findings)
  ));
  const body = {
    schema_version: FOUR_DEAL_LOCAL_DEMO_RESULT_SCHEMA,
    mode: 'FROZEN_READ_ONLY_PREVIEW',
    write_authority: 'NONE',
    m3_artifact: {
      root: artifactRoot,
      relative_path: FINAL_REVIEW_PACKET_PATH,
      sha256: artifact.sha256,
      final_review_packet_id: artifact.content.final_review_packet_id,
      final_legal_findings: legal.artifacts.map((entry) => ({ path: entry.path, sha256: entry.sha256 })),
    },
    metsera_product_result_identity: metseraFixture.shared_result.product_query_result_identity,
    deals,
  };
  return freeze({
    ...body,
    result_contract_id: sha256(JSON.stringify(body)),
  });
}

module.exports = {
  DEFAULT_M3_ARTIFACT_ROOT,
  FOUR_DEAL_LOCAL_DEMO_RESULT_SCHEMA,
  getFrozenFourDealLocalDemoResult,
  m3Rows,
};
