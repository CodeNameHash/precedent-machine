'use strict';

const { canonicalJson, sha256Hex } = require('./canonical-bytes');

const DECISION_SCHEMA = 'OPEN_WORLD_PROMOTION_DECISIONS/V1';
const CLUSTER_RULES_SCHEMA = 'OPEN_WORLD_PROMOTION_CLUSTER_RULES/V1';
const DECISIONS = new Set(['APPROVED', 'REJECTED', 'HELD']);
const digest = (value) => `sha256:${sha256Hex(Buffer.from(canonicalJson(value), 'utf8'))}`;
const escapeHtml = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const isTimestamp = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value;
const nonEmpty = (value) => typeof value === 'string' && value.trim().length > 0;
const exactKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).sort().join('\0') === [...keys].sort().join('\0');

function compatibilityDigest(candidate) { return digest(candidate.compatibility || {}); }
function candidateSetDigest(candidateSet) { return digest(candidateSet); }
function decisionSetId({ candidate_set_digest, decisions }) {
  return `owpd:sha256:${sha256Hex(Buffer.from(canonicalJson({ schema_version: DECISION_SCHEMA, candidate_set_digest, decisions }), 'utf8'))}`;
}
function decisionErrors(decision, candidate) {
  const errors = [];
  if (!exactKeys(decision, ['candidate_id', 'candidate_revision_id', 'disposition', 'reviewed_by', 'reviewed_at', 'rationale', 'compatibility_acknowledgement'])) errors.push('DECISION_KEYS_INVALID');
  if (!DECISIONS.has(decision?.disposition)) errors.push('DECISION_DISPOSITION_INVALID');
  if (decision?.candidate_revision_id !== candidate.candidate_revision_id) errors.push('DECISION_STALE_CANDIDATE_REVISION');
  if (!nonEmpty(decision?.reviewed_by)) errors.push('DECISION_REVIEWER_MISSING');
  if (!isTimestamp(decision?.reviewed_at)) errors.push('DECISION_TIMESTAMP_INVALID');
  if (!nonEmpty(decision?.rationale)) errors.push('DECISION_RATIONALE_MISSING');
  const acknowledgement = decision?.compatibility_acknowledgement;
  if (!exactKeys(acknowledgement, ['acknowledged', 'candidate_revision_id', 'compatibility_digest']) || acknowledgement.acknowledged !== true || acknowledgement.candidate_revision_id !== candidate.candidate_revision_id || acknowledgement.compatibility_digest !== compatibilityDigest(candidate)) errors.push('DECISION_COMPATIBILITY_ACKNOWLEDGEMENT_INVALID');
  return errors;
}
function validatePromotionReview({ candidateSet, decisions, clusterRules }) {
  const errors = [];
  if (!candidateSet || !Array.isArray(candidateSet.candidates)) throw new TypeError('candidate set is required');
  const setDigest = candidateSetDigest(candidateSet);
  if (!exactKeys(decisions, ['schema_version', 'candidate_set_digest', 'decision_set_id', 'decisions']) || decisions.schema_version !== DECISION_SCHEMA || !Array.isArray(decisions.decisions)) errors.push('DECISIONS_MALFORMED');
  else {
    if (decisions.candidate_set_digest !== setDigest) errors.push('DECISION_CANDIDATE_SET_DIGEST_MISMATCH');
    if (decisions.decision_set_id !== decisionSetId(decisions)) errors.push('DECISION_SET_ID_FORGED');
  }
  if (!exactKeys(clusterRules, ['schema_version', 'rules']) || clusterRules.schema_version !== CLUSTER_RULES_SCHEMA || !Array.isArray(clusterRules.rules)) errors.push('CLUSTER_RULES_MALFORMED');
  if (Array.isArray(clusterRules?.rules) && clusterRules.rules.length > 0) errors.push('CLUSTER_RULES_UNIMPLEMENTED');
  const candidates = [...candidateSet.candidates].sort((left, right) => left.candidate_id.localeCompare(right.candidate_id));
  const known = new Map(candidates.map((candidate) => [candidate.candidate_id, candidate]));
  const byCandidate = new Map();
  for (const decision of decisions?.decisions || []) {
    if (!decision || typeof decision !== 'object' || !nonEmpty(decision.candidate_id)) { errors.push('DECISION_CANDIDATE_ID_INVALID'); continue; }
    if (!known.has(decision.candidate_id)) { errors.push('DECISION_UNKNOWN_CANDIDATE'); continue; }
    if (byCandidate.has(decision.candidate_id)) { errors.push('DECISION_DUPLICATE_CANDIDATE'); continue; }
    byCandidate.set(decision.candidate_id, decision);
  }
  const cards = candidates.map((candidate) => {
    const decision = byCandidate.get(candidate.candidate_id) || null;
    const errorsForCandidate = decision ? decisionErrors(decision, candidate) : ['DECISION_MISSING'];
    errors.push(...errorsForCandidate);
    return {
      candidate,
      review_disposition: errorsForCandidate.length ? 'HELD' : decision.disposition,
      decision,
      decision_errors: errorsForCandidate,
      compatibility_digest: compatibilityDigest(candidate),
      activation_allowed: false,
    };
  });
  const uniqueErrors = [...new Set(errors)].sort();
  const complete = cards.every((card) => card.decision_errors.length === 0) && uniqueErrors.length === 0;
  return Object.freeze({
    schema_version: 'OPEN_WORLD_PROMOTION_REVIEW_PACKET/V1',
    candidate_set_digest: setDigest,
    candidate_count: cards.length,
    decision_set_state: complete ? 'COMPLETE_REVIEWED_NO_ACTIVATION' : (uniqueErrors.some((error) => error !== 'DECISION_MISSING') ? 'INVALID_OR_STALE' : 'INCOMPLETE'),
    decision_validation_errors: uniqueErrors,
    activation: Object.freeze({ closed: true, reason: 'REVIEW_PACKET_NEVER_MUTATES_ACTIVE_TAXONOMY' }),
    cards: Object.freeze(cards),
  });
}
function evidenceHtml(evidence) {
  const path = `../../../../${encodeURIComponent(evidence.run_id)}/resolution.json`;
  return `<li><code>${escapeHtml(evidence.deal_id)} · ${escapeHtml(evidence.family)} · §${escapeHtml(evidence.section_reference)} · ${escapeHtml(evidence.excerpt_id)} · [${escapeHtml(evidence.absolute_start_byte)}, ${escapeHtml(evidence.absolute_end_byte)})</code> <a href="${path}">resolution</a><pre>${escapeHtml(evidence.quote_utf8)}</pre><small>${escapeHtml(evidence.source_reason)} · ${escapeHtml(evidence.source_claim_definition_key)} · ${escapeHtml(evidence.quote_sha256)}</small></li>`;
}
function cardHtml(card, number) {
  const candidate = card.candidate; const recurrence = candidate.recurrence; const compatibility = candidate.compatibility || {};
  const decisions = card.decision ? `<pre>${escapeHtml(canonicalJson(card.decision))}</pre>` : '<p>No decision committed.</p>';
  const errors = card.decision_errors.length ? `<p class="errors">${escapeHtml(card.decision_errors.join(', '))}</p>` : '<p class="clear">Validated review decision.</p>';
  const exclusions = candidate.exclusions?.length ? `<ol>${candidate.exclusions.map((entry) => `<li><strong>${escapeHtml(entry.reason)}</strong><ol>${evidenceHtml(entry.evidence)}</ol></li>`).join('')}</ol>` : '<p>None.</p>';
  return `<article class="card" data-family="${escapeHtml(candidate.owner_family)}" data-disposition="${escapeHtml(card.review_disposition)}"><h2>${number}. ${escapeHtml(candidate.display_name)}</h2><p><strong>Candidate:</strong> <code>${escapeHtml(candidate.candidate_id)}</code><br><strong>Concept:</strong> <code>${escapeHtml(candidate.semantic_key)}</code><br><strong>Review state:</strong> ${escapeHtml(card.review_disposition)}<br><strong>Recurrence:</strong> ${escapeHtml(recurrence.eligible_deal_count)} deals, ${escapeHtml(recurrence.eligible_occurrence_count)} eligible occurrences, threshold ${escapeHtml(recurrence.threshold)}<br><strong>Deals:</strong> ${escapeHtml(recurrence.eligible_deal_ids.join(', '))}</p><details open><summary>Evidence (${candidate.evidence.length})</summary><ol>${candidate.evidence.map(evidenceHtml).join('')}</ol></details><details><summary>Excluded occurrences (${candidate.exclusions.length})</summary>${exclusions}</details><details><summary>Compatibility</summary><pre>${escapeHtml(canonicalJson(compatibility))}</pre><p><strong>Acknowledgement digest:</strong> <code>${escapeHtml(card.compatibility_digest)}</code></p></details><details open><summary>Decision contract</summary>${errors}${decisions}</details></article>`;
}
function renderPromotionReviewPacket(review) {
  const families = [...new Set(review.cards.map((card) => card.candidate.owner_family))].sort();
  const dispositions = [...DECISIONS].sort();
  const cards = review.cards.map((card, index) => cardHtml(card, index + 1)).join('\n');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Open-world promotion review packet</title><style>body{margin:0;background:#f6f7f9;color:#17202c;font:14px/1.45 system-ui,sans-serif}main{max-width:1200px;margin:auto;padding:24px}.summary,.controls,.card{background:#fff;border:1px solid #d9dee7;border-radius:8px;padding:16px;margin:14px 0}.controls{position:sticky;top:0;z-index:1}label{margin-right:14px}select{margin-left:6px}h1,h2{margin-top:0}h2{font-size:16px}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f1f3f6;padding:10px;border-radius:4px}.card>details{margin-top:10px}.card ol{padding-left:24px}.card li{margin:10px 0}.hidden{display:none}.errors{color:#9d1c1c}.clear{color:#17633b}small{color:#4b5563}</style></head><body><main><h1>Open-world promotion review packet</h1><div class="summary"><p><strong>Decision state:</strong> ${escapeHtml(review.decision_set_state)}<br><strong>Activation:</strong> CLOSED, this packet cannot mutate taxonomy or production behaviour.<br><strong>Candidate set digest:</strong> <code>${escapeHtml(review.candidate_set_digest)}</code><br><strong>Validation errors:</strong> ${escapeHtml(review.decision_validation_errors.join(', ') || 'none')}</p></div><div class="controls"><label>Family <select id="family"><option value="">All</option>${families.map((value) => `<option>${escapeHtml(value)}</option>`).join('')}</select></label><label>Review state <select id="disposition"><option value="">All</option>${dispositions.map((value) => `<option>${escapeHtml(value)}</option>`).join('')}</select></label><strong id="count"></strong></div>${cards}</main><script>const cards=[...document.querySelectorAll('.card')],family=document.querySelector('#family'),disposition=document.querySelector('#disposition'),count=document.querySelector('#count');function filter(){let visible=0;for(const card of cards){const show=(!family.value||card.dataset.family===family.value)&&(!disposition.value||card.dataset.disposition===disposition.value);card.classList.toggle('hidden',!show);if(show)visible+=1}count.textContent=visible+' / '+cards.length+' candidates'}family.onchange=filter;disposition.onchange=filter;filter()</script></body></html>\n`;
}

module.exports = { DECISION_SCHEMA, CLUSTER_RULES_SCHEMA, compatibilityDigest, candidateSetDigest, decisionSetId, validatePromotionReview, renderPromotionReviewPacket };
