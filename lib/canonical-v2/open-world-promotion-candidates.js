'use strict';

// This module is deliberately report-only. Do not import it from a producer.
const crypto = require('node:crypto');
const { canonicalJson, sha256Hex, utf8Slice } = require('./canonical-bytes');

const NATIVE_REASON = 'NATIVE_OPEN_WORLD_PROPOSAL';
const NATIVE_KEY = 'OPEN_WORLD_PROPOSITION';
const APPRAISAL_REASON = 'APPRAISAL_ASSERTION_OPEN_WORLD';
const APPRAISAL_KEY = 'NATIVE_APPRAISAL_CANDIDATE';
const byteOrder = (left, right) => Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
const digest = (value) => `sha256:${sha256Hex(Buffer.from(canonicalJson(value), 'utf8'))}`;
const id = (prefix, value) => `${prefix}${sha256Hex(Buffer.from(canonicalJson(value), 'utf8'))}`;

function labelOf(value) {
  const match = /^([A-Z][A-Z0-9_]*):/.exec(value?.attributes?.why_unmapped || '');
  return match ? match[1] : null;
}
function isFragment(value) {
  const quote = value.raw_value || '';
  return Buffer.byteLength(quote, 'utf8') < 60
    || /^[a-z]/.test(quote)
    || /^(other than|except|provided(?: that)?|however|\(|subject to)\b/i.test(quote);
}
function normalise(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ''); }
function rawIdentity(value) { return String(value || '').toLowerCase().replace(/[.,;:!?]/g, ''); }
function overlaps(left, right) {
  return left && right && left.excerpt_id === right.excerpt_id
    && left.absolute_start < right.absolute_end && right.absolute_start < left.absolute_end;
}
function strictEvidenceDuplicate(row, resolved) {
  return (resolved || []).some((item) => (item.claim?.evidence || []).some((evidence) => overlaps(row.evidence?.[0], evidence)));
}
function citationContextDuplicate(row, resolved) {
  const quote = normalise(row.raw_value);
  if (quote.length < 40) return false;
  return (resolved || []).some((item) => normalise(item.governing_context_quote).includes(quote));
}
function evidenceTuple({ item, receipt, source, runReceipt, deal_id, family, run_id }) {
  const edge = item.evidence?.find((value) => value.evidence_role === 'OPERATIVE_TEXT') || item.evidence?.[0];
  const text = source?.canonical_text?.text;
  if (!edge || typeof text !== 'string') throw new Error(`EVIDENCE_SPAN_UNVERIFIED:${run_id}`);
  const section = (runReceipt?.resolved_sections || []).find((value) => value.section_reference === (item.section_reference || item.attributes?.section_reference));
  const base = section?.start || 0;
  const quote = utf8Slice(text, base + edge.absolute_start, base + edge.absolute_end);
  if (quote !== item.raw_value) throw new Error(`EVIDENCE_SPAN_UNVERIFIED:${run_id}:${edge.excerpt_id}`);
  return {
    deal_id, family, run_id, resolution_sha256: receipt.resolution_sha256,
    canonical_text_sha256: receipt.canonical_text_sha256, excerpt_id: edge.excerpt_id,
    section_reference: item.section_reference || item.attributes?.section_reference || null,
    absolute_start_byte: base + edge.absolute_start, absolute_end_byte: base + edge.absolute_end,
    quote_utf8: quote, quote_utf8_byte_length: Buffer.byteLength(quote, 'utf8'), quote_sha256: sha256Hex(Buffer.from(quote, 'utf8')),
    source_reason: item.reason, source_claim_definition_key: item.claim_definition_key,
    source_attributes: { why_unmapped: item.attributes?.why_unmapped || null, nearest_concept: item.attributes?.nearest_concept ?? null },
  };
}
function collect({ cohort, loadReceipt, activeBundle = {} }) {
  const rows = []; const appraisal = [];
  const seenCohort = new Set();
  for (const receipt of cohort.receipts) {
    const identity = `${receipt.deal_id}\0${receipt.family}`;
    if (seenCohort.has(identity)) throw new Error(`DUPLICATE_COHORT_RECEIPT:${identity}`);
    seenCohort.add(identity);
    const loaded = loadReceipt(receipt);
    if (!loaded || loaded.resolution_sha256 !== receipt.resolution_sha256 || loaded.canonical_text_sha256 !== receipt.canonical_text_sha256) throw new Error(`RECEIPT_DIGEST_MISMATCH:${receipt.run_id}`);
    const { resolution, source, runReceipt } = loaded;
    const native = (resolution.open_world || []).filter((item) => item.reason === NATIVE_REASON && item.claim_definition_key === NATIVE_KEY);
    const strictSeen = new Set(); const self = new Set();
    for (const item of native) {
      const normalised = normalise(item.raw_value);
      const strict = strictEvidenceDuplicate(item, resolution.resolved) && !strictSeen.has(normalised);
      if (strict) strictSeen.add(normalised);
      const sameRun = !strict && self.has(rawIdentity(item.raw_value));
      const text = !strict && !sameRun && citationContextDuplicate(item, resolution.resolved);
      self.add(rawIdentity(item.raw_value));
      const exclusion = strict ? 'RESOLVED_CLAIM_EVIDENCE_SPAN_DUPLICATE'
        : sameRun ? 'LATER_SAME_RUN_IDENTICAL_DUPLICATE'
          : text ? 'RESOLVED_CLAIM_CITATION_CONTEXT_DUPLICATE'
            : isFragment(item) ? 'FRAGMENT' : null;
      rows.push({ receipt, item, exclusion, evidence: evidenceTuple({ item, receipt, source, runReceipt, ...receipt }) });
    }
    for (const item of resolution.open_world || []) {
      if (item.reason === APPRAISAL_REASON && item.claim_definition_key === APPRAISAL_KEY && item.attributes?.assertion_kind === 'SETTLEMENT_CONSENT') {
        appraisal.push({ receipt, item, evidence: evidenceTuple({ item, receipt, source, runReceipt, ...receipt }) });
      }
    }
  }
  const byLabel = new Map();
  for (const row of rows) { const label = labelOf(row.item); if (!label) continue; const entries = byLabel.get(label) || []; entries.push(row); byLabel.set(label, entries); }
  const candidates = [];
  for (const [label, entries] of byLabel) {
    const rawDealIds = [...new Set(entries.map((row) => row.receipt.deal_id))].sort(byteOrder);
    const eligible = entries.filter((row) => !row.exclusion);
    const eligibleDealIds = [...new Set(eligible.map((row) => row.receipt.deal_id))].sort(byteOrder);
    if (eligibleDealIds.length < 3) continue;
    const semantic_key = `OWPC/V1|${eligible[0].receipt.family}|${NATIVE_KEY}|${label}`;
    const identity = { semantic_key, owner_family: eligible[0].receipt.family, candidate_kind: 'NATIVE_OPEN_WORLD_LABEL' };
    const payload = {
      candidate_id: id('owpc:sha256:', identity), candidate_kind: identity.candidate_kind, semantic_key, display_name: label.replaceAll('_', ' '), owner_family: identity.owner_family,
      cluster_status: ['DEFINITION_ENVELOPE', 'EXCEPTION'].includes(label) ? 'HELD_AMBIGUOUS_CLUSTER' : 'EXACT_LABEL',
      recurrence: { raw_deal_ids: rawDealIds, raw_deal_count: rawDealIds.length, raw_occurrence_count: entries.length, eligible_deal_ids: eligibleDealIds, eligible_deal_count: eligibleDealIds.length, eligible_occurrence_count: eligible.length, threshold: 3, strength: 'NEW' },
      evidence: eligible.map((row) => row.evidence).sort((a, b) => byteOrder(canonicalJson(a), canonicalJson(b))),
      exclusions: entries.filter((row) => row.exclusion).map((row) => ({ reason: row.exclusion, evidence: row.evidence })).sort((a, b) => byteOrder(canonicalJson(a), canonicalJson(b))),
      compatibility: { active_contract_bundle_fingerprint: activeBundle.fingerprint || null, mapping_table_version: activeBundle.mapping_table_version || null, existing_concept_matches: [], existing_claim_definition_matches: [], resolver_route_matches: [], vocabulary_collisions: [], step_2x_j_consume_collisions: [], hold_scaffold_collisions: [], value_shape_conflict: false, owner_family_conflict: false, cross_family_evidence: new Set(entries.map((row) => row.receipt.family)).size > 1, source_state_mixture: false, required_future_changes: ['CONTRACT_BUNDLE', 'RESOLVER', 'PROMPT', 'REPLAY'], activation_allowed: false },
      disposition: 'held', approved: false, rejected: false, held: true, hold_reasons: ['NO_COMMITTED_HUMAN_DECISION'], decision: null, activation: { allowed: false, active_registry_change: false, resolver_change: false },
    };
    payload.candidate_revision_id = id('owpc-revision:sha256:', payload);
    candidates.push(payload);
  }
  if (appraisal.length) {
    const semantic_key = 'OWPC/V1|APPRAISAL_DISSENTERS_RIGHTS|SETTLEMENT_CONSENT'; const identity = { semantic_key, owner_family: 'APPRAISAL_DISSENTERS_RIGHTS', candidate_kind: 'TYPED_OPEN_WORLD_ASSERTION' };
    const payload = { candidate_id: id('owpc:sha256:', identity), candidate_kind: identity.candidate_kind, semantic_key, display_name: 'Appraisal settlement-consent covenant', owner_family: identity.owner_family, cluster_status: 'EXACT_LABEL', recurrence: { raw_deal_ids: [...new Set(appraisal.map((row) => row.receipt.deal_id))].sort(byteOrder), raw_deal_count: new Set(appraisal.map((row) => row.receipt.deal_id)).size, raw_occurrence_count: appraisal.length, eligible_deal_ids: [...new Set(appraisal.map((row) => row.receipt.deal_id))].sort(byteOrder), eligible_deal_count: new Set(appraisal.map((row) => row.receipt.deal_id)).size, eligible_occurrence_count: appraisal.length, threshold: 3, strength: 'NEW' }, evidence: appraisal.map((row) => row.evidence).sort((a,b)=>byteOrder(canonicalJson(a),canonicalJson(b))), exclusions: [], compatibility: { exact_active_match: 'APPR-SETTLE / APPRAISAL_SETTLEMENT_CONSENT', topbuild_observation: 'EXACT_ACTIVE_MATCH', proposed_action: 'NONE', activation_allowed: false }, disposition: 'held', approved: false, rejected: false, held: true, hold_reasons: ['NO_COMMITTED_HUMAN_DECISION'], decision: null, activation: { allowed: false, active_registry_change: false, resolver_change: false } }; payload.candidate_revision_id = id('owpc-revision:sha256:', payload); candidates.push(payload);
  }
  candidates.sort((a,b)=>byteOrder(a.candidate_id,b.candidate_id));
  const nativeCandidates = candidates.filter((candidate) => candidate.candidate_kind === 'NATIVE_OPEN_WORLD_LABEL');
  const recurring = [...byLabel.values()].filter((entries) => new Set(entries.map((row) => row.receipt.deal_id)).size >= 3);
  const counts = {
    native_open_world_occurrences: rows.length,
    raw_recurrence_labels_at_threshold: recurring.length,
    eligible_concepts: nativeCandidates.length,
    eligible_occurrences: nativeCandidates.reduce((total, candidate) => total + candidate.recurrence.eligible_occurrence_count, 0),
    resolved_claim_evidence_span_duplicates: rows.filter((row) => row.exclusion === 'RESOLVED_CLAIM_EVIDENCE_SPAN_DUPLICATE').length,
    resolved_claim_citation_context_duplicates: rows.filter((row) => row.exclusion === 'RESOLVED_CLAIM_CITATION_CONTEXT_DUPLICATE').length,
    resolved_claim_duplicates: rows.filter((row) => String(row.exclusion).startsWith('RESOLVED_CLAIM_')).length,
    later_same_run_identical_duplicates: rows.filter((row) => row.exclusion === 'LATER_SAME_RUN_IDENTICAL_DUPLICATE').length,
    duplicate_exclusions: rows.filter((row) => String(row.exclusion).includes('DUPLICATE')).length,
    fragment_exclusions: rows.filter((row) => row.exclusion === 'FRAGMENT').length,
  };
  return { schema_version: 'OPEN_WORLD_PROMOTION_CANDIDATE_SET/V1', cohort: { cohort_id: cohort.cohort_id, digest: digest(cohort) }, algorithm: { version: 'stage2y-open-world-promotion/v1', fragment_policy_version: 'v1', duplicate_policy_version: 'v1', cluster_rule_set_digest: digest({ schema_version: 'OPEN_WORLD_PROMOTION_CLUSTER_RULES/V1', rules: [] }) }, counts, candidates, exclusions: rows.filter((row)=>row.exclusion).map((row)=>({reason:row.exclusion,evidence:row.evidence})).sort((a,b)=>byteOrder(canonicalJson(a),canonicalJson(b))) };
}

module.exports = { collect, labelOf, isFragment, digest };
