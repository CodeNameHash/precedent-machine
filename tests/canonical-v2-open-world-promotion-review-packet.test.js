'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { compatibilityDigest, candidateSetDigest, decisionSetId, validatePromotionReview, renderPromotionReviewPacket } = require('../lib/canonical-v2/open-world-promotion-review-packet');

const ROOT = path.resolve(__dirname, '..');
const CANDIDATE_SET = JSON.parse(fs.readFileSync(path.join(ROOT, 'evidence/canonical-v2/open-world-promotion/candidates/b607809bd087e801f20e924e987289711ddaab0ed9e37c07b7c6418f5f7ffe6c/candidate-set.v1.json'), 'utf8'));
const EMPTY_RULES = { schema_version: 'OPEN_WORLD_PROMOTION_CLUSTER_RULES/V1', rules: [] };
const decisionFor = (candidate, disposition = 'HELD') => ({
  candidate_id: candidate.candidate_id,
  candidate_revision_id: candidate.candidate_revision_id,
  disposition,
  reviewed_by: 'reviewer',
  reviewed_at: '2026-08-09T18:00:00.000Z',
  rationale: 'Evidence and compatibility were reviewed.',
  compatibility_acknowledgement: {
    acknowledged: true,
    candidate_revision_id: candidate.candidate_revision_id,
    compatibility_digest: compatibilityDigest(candidate),
  },
});
const ledger = (decisions) => {
  const candidate_set_digest = candidateSetDigest(CANDIDATE_SET);
  return { schema_version: 'OPEN_WORLD_PROMOTION_DECISIONS/V1', candidate_set_digest, decision_set_id: decisionSetId({ candidate_set_digest, decisions }), decisions };
};
const review = (decisions) => validatePromotionReview({ candidateSet: CANDIDATE_SET, decisions: ledger(decisions), clusterRules: EMPTY_RULES });

test('Stage 2Y-J review packet is self-contained, numbered, and held by the empty decision contract', () => {
  const result = review([]); const html = renderPromotionReviewPacket(result);
  assert.equal(result.candidate_count, 15);
  assert.equal(result.decision_set_state, 'INCOMPLETE');
  assert.equal(result.activation.closed, true);
  assert.ok(result.cards.every((card) => card.review_disposition === 'HELD' && card.decision_errors.includes('DECISION_MISSING')));
  assert.match(html, /Content-Security-Policy/);
  assert.doesNotMatch(html, /https?:\/\//);
  assert.equal((html.match(/data-family=/g) || []).length, 15);
  assert.match(html, /id="family"/);
  assert.match(html, /id="disposition"/);
  assert.match(html, /resolution\.json/);
  assert.match(html, /Acknowledgement digest/);
});

test('partial, stale, unknown, and forged decisions stay closed', () => {
  const candidate = CANDIDATE_SET.candidates[0];
  const partial = review([decisionFor(candidate, 'APPROVED')]);
  assert.equal(partial.decision_set_state, 'INCOMPLETE');
  assert.equal(partial.activation.closed, true);
  const stale = decisionFor(candidate); stale.candidate_revision_id = 'stale';
  const staleResult = review([stale]);
  assert.equal(staleResult.decision_set_state, 'INVALID_OR_STALE');
  assert.ok(staleResult.decision_validation_errors.includes('DECISION_STALE_CANDIDATE_REVISION'));
  assert.equal(staleResult.activation.closed, true);
  const unknown = decisionFor(candidate); unknown.candidate_id = 'unknown';
  const unknownResult = review([unknown]);
  assert.ok(unknownResult.decision_validation_errors.includes('DECISION_UNKNOWN_CANDIDATE'));
  assert.equal(unknownResult.activation.closed, true);
  const forged = decisionFor(candidate); forged.compatibility_acknowledgement.compatibility_digest = 'sha256:forged';
  const forgedResult = review([forged]);
  assert.ok(forgedResult.decision_validation_errors.includes('DECISION_COMPATIBILITY_ACKNOWLEDGEMENT_INVALID'));
  assert.equal(forgedResult.activation.closed, true);
});

test('decision ledgers reject extra keys, forged ids and digests, and noncanonical timestamps', () => {
  const candidate = CANDIDATE_SET.candidates[0];
  const extraDecision = decisionFor(candidate); extraDecision.extra = true;
  assert.ok(review([extraDecision]).decision_validation_errors.includes('DECISION_KEYS_INVALID'));
  const extraAcknowledgement = decisionFor(candidate); extraAcknowledgement.compatibility_acknowledgement.extra = true;
  assert.ok(review([extraAcknowledgement]).decision_validation_errors.includes('DECISION_COMPATIBILITY_ACKNOWLEDGEMENT_INVALID'));
  const noncanonicalTime = decisionFor(candidate); noncanonicalTime.reviewed_at = '2026-08-09T18:00:00Z';
  assert.ok(review([noncanonicalTime]).decision_validation_errors.includes('DECISION_TIMESTAMP_INVALID'));
  const forgedId = ledger([]); forgedId.decision_set_id = 'owpd:sha256:forged';
  assert.ok(validatePromotionReview({ candidateSet: CANDIDATE_SET, decisions: forgedId, clusterRules: EMPTY_RULES }).decision_validation_errors.includes('DECISION_SET_ID_FORGED'));
  const forgedDigest = ledger([]); forgedDigest.candidate_set_digest = 'sha256:forged'; forgedDigest.decision_set_id = decisionSetId(forgedDigest);
  assert.ok(validatePromotionReview({ candidateSet: CANDIDATE_SET, decisions: forgedDigest, clusterRules: EMPTY_RULES }).decision_validation_errors.includes('DECISION_CANDIDATE_SET_DIGEST_MISMATCH'));
  const extraLedger = ledger([]); extraLedger.extra = true;
  assert.ok(validatePromotionReview({ candidateSet: CANDIDATE_SET, decisions: extraLedger, clusterRules: EMPTY_RULES }).decision_validation_errors.includes('DECISIONS_MALFORMED'));
  const extraRules = { ...EMPTY_RULES, extra: true };
  assert.ok(validatePromotionReview({ candidateSet: CANDIDATE_SET, decisions: ledger([]), clusterRules: extraRules }).decision_validation_errors.includes('CLUSTER_RULES_MALFORMED'));
  const duplicate = decisionFor(candidate);
  assert.ok(review([duplicate, duplicate]).decision_validation_errors.includes('DECISION_DUPLICATE_CANDIDATE'));
});

test('a complete valid decision set records dispositions but cannot activate production', () => {
  const decisions = CANDIDATE_SET.candidates.map((candidate, index) => decisionFor(candidate, index % 3 === 0 ? 'APPROVED' : (index % 3 === 1 ? 'REJECTED' : 'HELD')));
  const forward = review(decisions); const reverse = review([...decisions].reverse());
  assert.equal(forward.decision_set_state, 'COMPLETE_REVIEWED_NO_ACTIVATION');
  assert.equal(forward.activation.closed, true);
  assert.equal(renderPromotionReviewPacket(forward), renderPromotionReviewPacket(reverse));
});

test('Stage 2Y-J packet artefact is mechanically current', () => {
  const script = path.join(ROOT, 'scripts/audit/stage-2y-open-world-promotion-review-packet.mjs');
  const result = spawnSync(process.execPath, [script, '--check'], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, CI: 'true' } });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /CHECKED/);
});
