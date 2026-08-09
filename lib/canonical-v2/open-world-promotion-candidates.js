'use strict';

// This module is deliberately report-only. Do not import it from a producer.
const crypto = require('node:crypto');
const { canonicalJson, sha256Hex, utf8Slice } = require('./canonical-bytes');
const {
  HOLD_SCAFFOLD_MODULES,
  loadStep2xJConsumeVocabularies,
} = require('./open-world-promotion-gate');
const { APPRAISAL_CLAIMS } = require('./tax-dividends-appraisal-product-projection');

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
function tupleKey(value) { return String(value || '').toUpperCase().replace(/[^A-Z0-9]+/g, ''); }
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

function selectorObservation(item, selectorResolution) {
  if (!selectorResolution || typeof selectorResolution !== 'object') {
    return Object.freeze({ state: 'INSUFFICIENT_EVIDENCE', reason: 'CURRENT_SELECTOR_REPLAY_MISSING' });
  }
  const excerptId = item.evidence?.[0]?.excerpt_id;
  const sameEvidence = (candidate) => {
    const claim = candidate?.claim || candidate;
    return claim?.raw_value === item.raw_value
      && (claim?.evidence || []).some((edge) => edge.excerpt_id === excerptId);
  };
  const resolved = (selectorResolution.resolved || []).filter(sameEvidence);
  const openWorld = (selectorResolution.open_world || []).filter(sameEvidence);
  if (resolved.length + openWorld.length !== 1) {
    return Object.freeze({
      state: 'INSUFFICIENT_EVIDENCE',
      reason: resolved.length + openWorld.length === 0 ? 'CURRENT_SELECTOR_OUTPUT_NOT_LOCATED' : 'CURRENT_SELECTOR_OUTPUT_AMBIGUOUS',
    });
  }
  if (resolved.length === 1) {
    return Object.freeze({
      state: 'RESOLVED',
      concept_key: resolved[0].concept_key || null,
      claim_definition_key: resolved[0].resolved_claim_definition_key || resolved[0].claim_definition_key || null,
      canonical_value: resolved[0].claim?.canonical_value ?? resolved[0].canonical_value ?? null,
    });
  }
  return Object.freeze({
    state: 'OPEN_WORLD',
    reason: openWorld[0].reason || null,
    claim_definition_key: openWorld[0].claim_definition_key || null,
  });
}

function uniqueJson(values) {
  return [...new Map(values.map((value) => [canonicalJson(value), value])).values()]
    .sort((left, right) => byteOrder(canonicalJson(left), canonicalJson(right)));
}

function authoritativeTupleAssociation(proposal) {
  if (proposal.owner_family !== 'APPRAISAL_DISSENTERS_RIGHTS') return null;
  const mapping = APPRAISAL_CLAIMS[proposal.claim_definition_key];
  if (!mapping || mapping.concept !== proposal.concept_key || !mapping.values.includes(proposal.canonical_value)) return null;
  return Object.freeze({
    authority_module: 'lib/canonical-v2/tax-dividends-appraisal-product-projection.js',
    authority_export: 'APPRAISAL_CLAIMS',
    mapping_key: proposal.claim_definition_key,
    concept_key: mapping.concept,
    value_kind: mapping.value_kind,
    allowed_values: Object.freeze([...mapping.values]),
  });
}

function buildCompatibility({ activeBundle, proposal, rows }) {
  const contractReady = activeBundle
    && typeof activeBundle.fingerprint === 'string'
    && Array.isArray(activeBundle.concepts)
    && Array.isArray(activeBundle.claim_definitions);
  const selector = uniqueJson(rows.map((row) => selectorObservation(row.item, row.selector_resolution)));
  const replayMissing = selector.some((value) => value.state === 'INSUFFICIENT_EVIDENCE');
  if (!contractReady) {
    return Object.freeze({
      analysis_version: 'OPEN_WORLD_PROMOTION_COMPATIBILITY/V2',
      proposed_tuple: proposal,
      analysis_state: 'INSUFFICIENT_EVIDENCE',
      reasons: Object.freeze(['ACTIVE_CONTRACT_BUNDLE_UNVERIFIED', ...(replayMissing ? ['CURRENT_SELECTOR_REPLAY_MISSING'] : [])]),
      activation_allowed: false,
    });
  }
  const conceptKey = proposal.concept_key;
  const definitionKey = proposal.claim_definition_key;
  const vocabularyName = proposal.vocabulary_name;
  const conceptMatches = conceptKey
    ? activeBundle.concepts.filter((value) => value.concept_key === conceptKey).map((value) => value.concept_key)
    : [];
  const definitionMatches = definitionKey
    ? activeBundle.claim_definitions.filter((value) => value.claim_definition_key === definitionKey)
    : [];
  const vocabularyCollisions = vocabularyName
    ? [
      ...activeBundle.concepts.filter((value) => tupleKey(value.concept_key) === tupleKey(vocabularyName)).map((value) => ({ kind: 'CONCEPT_KEY', key: value.concept_key })),
      ...activeBundle.claim_definitions.filter((value) => tupleKey(value.claim_definition_key) === tupleKey(vocabularyName)).map((value) => ({ kind: 'CLAIM_DEFINITION_KEY', key: value.claim_definition_key })),
    ]
    : [];
  const consume = loadStep2xJConsumeVocabularies();
  const consumeCollisions = consume.ok && vocabularyName && consume.consume.has(vocabularyName)
    ? [vocabularyName] : [];
  const allowedValues = definitionMatches.length === 1 ? definitionMatches[0].allowed_canonical_values || null : null;
  const valueShape = definitionMatches.length === 1
    ? (allowedValues && proposal.canonical_value != null && !allowedValues.includes(proposal.canonical_value)
      ? 'CONFLICT' : 'COMPATIBLE')
    : 'NOT_APPLICABLE';
  const registeredTuple = conceptKey != null && definitionKey != null && proposal.canonical_value != null;
  const association = authoritativeTupleAssociation(proposal);
  const anyResolvedToTuple = selector.some((value) => value.state === 'RESOLVED'
    && value.concept_key === conceptKey
    && value.claim_definition_key === definitionKey
    && canonicalJson(value.canonical_value) === canonicalJson(proposal.canonical_value));
  const unresolvedReasons = [
    ...(registeredTuple ? [] : ['PROPOSED_TARGET_TUPLE_UNSPECIFIED']),
    ...(registeredTuple && !association ? ['AUTHORITATIVE_TUPLE_ASSOCIATION_MISSING'] : []),
    ...(replayMissing ? ['CURRENT_SELECTOR_REPLAY_INSUFFICIENT'] : []),
    ...(!consume.ok ? ['STEP_2X_J_CONSUME_SET_UNVERIFIED'] : []),
  ];
  const collision = registeredTuple && conceptMatches.length === 1 && definitionMatches.length === 1 && association
    ? 'EXACT_ACTIVE_TUPLE'
    : !association && registeredTuple ? 'NO_EXACT_ACTIVE_TUPLE'
      : unresolvedReasons.length ? 'INSUFFICIENT_EVIDENCE' : 'NO_EXACT_ACTIVE_TUPLE';
  return Object.freeze({
    analysis_version: 'OPEN_WORLD_PROMOTION_COMPATIBILITY/V2',
    active_contract: Object.freeze({
      schema_version: activeBundle.schema_version,
      fingerprint: activeBundle.fingerprint,
      contract_key: activeBundle.contract_key,
      concept_count: activeBundle.concepts.length,
      claim_definition_count: activeBundle.claim_definitions.length,
    }),
    proposed_tuple: proposal,
    contract_schema: Object.freeze({
      exact_concept_matches: Object.freeze(conceptMatches),
      exact_claim_definition_matches: Object.freeze(definitionMatches.map((value) => ({
        claim_definition_key: value.claim_definition_key,
        version: value.version,
        allowed_canonical_values: value.allowed_canonical_values || null,
        canonical_value_type: value.canonical_value_type || null,
        canonical_value_required_when_present: value.canonical_value_required_when_present === true,
      }))),
      vocabulary_collisions: Object.freeze(uniqueJson(vocabularyCollisions)),
      step_2x_j_consume_collisions: Object.freeze(consumeCollisions),
      value_shape: valueShape,
    }),
    authoritative_tuple_association: association
      ? Object.freeze({ state: 'VERIFIED', ...association })
      : Object.freeze({ state: 'NOT_ASSOCIATED' }),
    selector_behaviour: Object.freeze({
      current_replay_observations: Object.freeze(selector),
      exact_tuple_resolved_in_replay: anyResolvedToTuple,
    }),
    hold_scaffold_check: Object.freeze({
      known_scaffolds: Object.freeze([...HOLD_SCAFFOLD_MODULES]),
      proposed_mechanism: proposal.promotion_mechanism || null,
      result: proposal.promotion_mechanism ? (HOLD_SCAFFOLD_MODULES.includes(proposal.promotion_mechanism) ? 'COLLISION' : 'NO_COLLISION') : 'INSUFFICIENT_EVIDENCE',
    }),
    collision,
    reasons: Object.freeze(unresolvedReasons),
    activation_allowed: false,
  });
}

function nativeProposal(label, ownerFamily) {
  return Object.freeze({
    proposal_kind: 'NATIVE_OPEN_WORLD_LABEL',
    owner_family: ownerFamily,
    vocabulary_name: label,
    concept_key: null,
    claim_definition_key: null,
    canonical_value: null,
    promotion_mechanism: null,
    source_claim_definition_key: NATIVE_KEY,
  });
}

function appraisalProposal() {
  return Object.freeze({
    proposal_kind: 'TYPED_OPEN_WORLD_ASSERTION',
    owner_family: 'APPRAISAL_DISSENTERS_RIGHTS',
    vocabulary_name: 'APPRAISAL_SETTLEMENT_CONSENT',
    concept_key: 'APPR-SETTLE',
    claim_definition_key: 'APPRAISAL_SETTLEMENT_CONSENT',
    canonical_value: true,
    promotion_mechanism: null,
    source_claim_definition_key: APPRAISAL_KEY,
  });
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
    const { resolution, source, runReceipt, selector_resolution } = loaded;
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
      rows.push({ receipt, item, selector_resolution, exclusion, evidence: evidenceTuple({ item, receipt, source, runReceipt, ...receipt }) });
    }
    for (const item of resolution.open_world || []) {
      if (item.reason === APPRAISAL_REASON && item.claim_definition_key === APPRAISAL_KEY && item.attributes?.assertion_kind === 'SETTLEMENT_CONSENT') {
        appraisal.push({ receipt, item, selector_resolution, evidence: evidenceTuple({ item, receipt, source, runReceipt, ...receipt }) });
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
      compatibility: buildCompatibility({
        activeBundle,
        proposal: nativeProposal(label, identity.owner_family),
        rows: eligible,
      }),
      disposition: 'held', approved: false, rejected: false, held: true, hold_reasons: ['NO_COMMITTED_HUMAN_DECISION'], decision: null, activation: { allowed: false, active_registry_change: false, resolver_change: false },
    };
    payload.candidate_revision_id = id('owpc-revision:sha256:', payload);
    candidates.push(payload);
  }
  if (appraisal.length) {
    const semantic_key = 'OWPC/V1|APPRAISAL_DISSENTERS_RIGHTS|SETTLEMENT_CONSENT'; const identity = { semantic_key, owner_family: 'APPRAISAL_DISSENTERS_RIGHTS', candidate_kind: 'TYPED_OPEN_WORLD_ASSERTION' };
    const payload = { candidate_id: id('owpc:sha256:', identity), candidate_kind: identity.candidate_kind, semantic_key, display_name: 'Appraisal settlement-consent covenant', owner_family: identity.owner_family, cluster_status: 'EXACT_LABEL', recurrence: { raw_deal_ids: [...new Set(appraisal.map((row) => row.receipt.deal_id))].sort(byteOrder), raw_deal_count: new Set(appraisal.map((row) => row.receipt.deal_id)).size, raw_occurrence_count: appraisal.length, eligible_deal_ids: [...new Set(appraisal.map((row) => row.receipt.deal_id))].sort(byteOrder), eligible_deal_count: new Set(appraisal.map((row) => row.receipt.deal_id)).size, eligible_occurrence_count: appraisal.length, threshold: 3, strength: 'NEW' }, evidence: appraisal.map((row) => row.evidence).sort((a,b)=>byteOrder(canonicalJson(a),canonicalJson(b))), exclusions: [], compatibility: buildCompatibility({ activeBundle, proposal: appraisalProposal(), rows: appraisal }), disposition: 'held', approved: false, rejected: false, held: true, hold_reasons: ['NO_COMMITTED_HUMAN_DECISION'], decision: null, activation: { allowed: false, active_registry_change: false, resolver_change: false } }; payload.candidate_revision_id = id('owpc-revision:sha256:', payload); candidates.push(payload);
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

module.exports = { collect, labelOf, isFragment, digest, buildCompatibility, nativeProposal, appraisalProposal, selectorObservation };
