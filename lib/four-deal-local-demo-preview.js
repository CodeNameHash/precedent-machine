'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const metseraFixture = require('../__fixtures__/canonical-v2/metsera-exclusivity-p8.json');
const { getFourDealLocalDemo } = require('./four-deal-local-demo');

const FOUR_DEAL_LOCAL_DEMO_RESULT_SCHEMA = 'FOUR_DEAL_LOCAL_DEMO_RESULT/V1';
const DEFAULT_M3_ARTIFACT_ROOT = '/private/tmp/canonical-v2-m3-pilot-20260803.L3KSNP';
const M3_EXECUTION_PATHS = Object.freeze([
  'final-output/execution-result.json',
  'iteration-2/execution-result.json',
]);

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

function readCurrentM3Execution(artifactRoot) {
  for (const relativePath of M3_EXECUTION_PATHS) {
    const absolutePath = path.join(artifactRoot, relativePath);
    if (!fs.existsSync(absolutePath)) continue;
    const bytes = fs.readFileSync(absolutePath);
    const execution = JSON.parse(bytes.toString('utf8'));
    if (!Array.isArray(execution.work_results) || typeof execution.execution_result_id !== 'string') {
      throw new Error(`four-deal local preview artifact is invalid: ${relativePath}`);
    }
    return Object.freeze({
      relative_path: relativePath,
      sha256: sha256(bytes),
      execution,
    });
  }
  throw new Error(`four-deal local preview artifact is unavailable: ${artifactRoot}`);
}

function sourceCitation(entry) {
  return entry.source_citation || entry.section_reference || 'Source citation unavailable';
}

function reviewedState(entry) {
  if (entry?.triage?.auto_pass === true) return 'REVIEWED';
  return 'REVIEW_REQUIRED';
}

function m3Rows(workResults) {
  const rows = [];
  for (const work of workResults) {
    const resolution = work.resolution || {};
    const queueByClaimRevisionId = new Map(
      (resolution.review_queue || [])
        .filter((entry) => entry.has_resolution && entry.claim_revision_id)
        .map((entry) => [entry.claim_revision_id, entry]),
    );
    for (const entry of resolution.resolved || []) {
      const review = queueByClaimRevisionId.get(entry.claim?.claim_revision_id);
      rows.push({
        row_id: entry.claim?.claim_revision_id || `${work.work_item_id}:resolved:${rows.length}`,
        family: work.family_id,
        work_item_id: work.work_item_id,
        result_type: 'GOVERNED_VALUE',
        governed_field: entry.resolved_claim_definition_key || entry.generic_claim_key,
        governed_value: displayValue(entry.claim?.canonical_value),
        source_quote: entry.claim?.raw_value || '',
        source_citation: sourceCitation(entry),
        review_state: reviewedState(entry),
        review_reasons: review?.reasons || entry.triage?.reasons || [],
        warning: null,
      });
    }
    for (const entry of (resolution.review_queue || []).filter((item) => !item.has_resolution)) {
      rows.push({
        row_id: entry.original_claim_occurrence_id || `${work.work_item_id}:review:${rows.length}`,
        family: work.family_id,
        work_item_id: work.work_item_id,
        result_type: 'REVIEW_ITEM',
        governed_field: entry.resolved_claim_definition_key || entry.generic_claim_key,
        governed_value: displayValue(entry.canonical_value),
        source_quote: entry.raw_value || '',
        source_citation: sourceCitation(entry),
        review_state: 'REVIEW_REQUIRED',
        review_reasons: entry.reasons || [],
        warning: 'This M3 output has no closed governed value.',
      });
    }
    for (const entry of resolution.open_world || []) {
      rows.push({
        row_id: entry.closure_id || `${work.work_item_id}:open-world:${rows.length}`,
        family: work.family_id,
        work_item_id: work.work_item_id,
        result_type: 'OPEN_WORLD_WARNING',
        governed_field: entry.claim_definition_key || 'OPEN_WORLD',
        governed_value: displayValue(entry.canonical_value),
        source_quote: entry.raw_value || '',
        source_citation: sourceCitation(entry),
        review_state: 'OPEN_WORLD',
        review_reasons: [],
        warning: entry.reason || 'This text is outside the currently governed value set.',
      });
    }
  }
  return rows;
}

function m3DealResult(deal, execution) {
  const target = String(deal.target_display || '').toLowerCase();
  const sourcePrefix = target === 'topbuild' ? 'topbuild-'
    : target === 'skechers' ? 'skechers-'
      : 'modiv-';
  const workResults = execution.work_results.filter((work) => (
    typeof work.work_item_id === 'string' && work.work_item_id.startsWith(sourcePrefix)
  ));
  return {
    deal_id: deal.id,
    deal_name: deal.target_display,
    result_domain: 'M3_CANONICAL_REVIEW',
    result_state: 'IMMUTABLE_ARTIFACT_BOUND',
    rows: m3Rows(workResults),
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
      review_state: metseraFixture.release_state,
      review_reasons: [],
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

function getFrozenFourDealLocalDemoResult({ artifact_root: artifactRoot = process.env.CANONICAL_V2_M3_PREVIEW_ARTIFACT_ROOT || DEFAULT_M3_ARTIFACT_ROOT } = {}) {
  const demo = getFourDealLocalDemo();
  const artifact = readCurrentM3Execution(artifactRoot);
  const deals = demo.deals.map((deal) => (
    deal.target_display === 'Metsera'
      ? metseraDealResult(deal)
      : m3DealResult(deal, artifact.execution)
  ));
  const body = {
    schema_version: FOUR_DEAL_LOCAL_DEMO_RESULT_SCHEMA,
    mode: 'FROZEN_READ_ONLY_PREVIEW',
    write_authority: 'NONE',
    m3_artifact: {
      root: artifactRoot,
      relative_path: artifact.relative_path,
      sha256: artifact.sha256,
      execution_result_id: artifact.execution.execution_result_id,
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
