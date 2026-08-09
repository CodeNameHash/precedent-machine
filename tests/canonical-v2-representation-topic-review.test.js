'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const { canonicalJson, contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  DECISION_LEDGER_SCHEMA,
  buildRepresentationTopicReviewPacket,
  buildEmptyRepresentationTopicDecisionLedger,
  validateRepresentationTopicDecisionLedger,
  ordinaryRepresentationTopicReviewGate,
} = require('../lib/canonical-v2/representation-topic-review-ledger');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts/stage-2y-h-representation-topic-review.mjs');
const HTML = path.join(ROOT, 'evidence/canonical-v2/stage-2y-h-representation-topic-review.html');
const LEDGER = path.join(ROOT, 'evidence/canonical-v2/stage-2y-h-representation-topic-decision-ledger.json');

test('review packet conserves all 623 limbs without forced classification', async () => {
  const { buildRepresentationTopicReplay } = await import(`${path.toNamespacedPath(path.join(ROOT, 'scripts/stage-2y-h-representation-topic-replay.mjs'))}?review=${Date.now()}`);
  const replay = buildRepresentationTopicReplay({ repoRoot: ROOT });
  const packet = buildRepresentationTopicReviewPacket({ representation_rows: replay.representation_rows });
  const classified = packet.cards.filter((card) => card.state === 'CLASSIFIED');
  const unclassified = packet.cards.filter((card) => card.state === 'UNCLASSIFIED');
  assert.equal(packet.cards.length, 623);
  assert.equal(classified.length, 324);
  assert.equal(unclassified.length, 299);
  assert.equal(classified.length + unclassified.length, packet.cards.length);
  assert.equal(unclassified.every((card) => card.proposed_topic === null && card.unclassified_reason), true);
  assert.equal(packet.cards.every((card, index) => card.card_number === index + 1 && card.decision_key && card.raw_value), true);
  assert.equal(packet.cards.every((card) => card.raw_value.length > 0 && card.evidence.utf8_digest), true);
});

test('empty decision ledger is deterministic and keeps the ordinary review gate closed', async () => {
  const { buildReviewArtefacts } = await import(`${path.toNamespacedPath(SCRIPT)}?artefacts=${Date.now()}`);
  const first = buildReviewArtefacts({ repoRoot: ROOT });
  const second = buildReviewArtefacts({ repoRoot: ROOT });
  assert.equal(canonicalJson(first.reviewPacket), canonicalJson(second.reviewPacket));
  assert.equal(canonicalJson(first.decisionLedger), canonicalJson(second.decisionLedger));
  assert.equal(first.decisionLedger.decisions.length, 0);
  assert.deepEqual(first.gate, { closed: true, reason: 'ORDINARY_REVIEW_PENDING', reviewed_cards: 0, total_cards: 623 });
  assert.doesNotThrow(() => validateRepresentationTopicDecisionLedger({ ledger: first.decisionLedger, review_packet: first.reviewPacket }));
  assert.deepEqual(ordinaryRepresentationTopicReviewGate({ ledger: first.decisionLedger, review_packet: first.reviewPacket }), first.gate);
});

test('unknown, stale and partial decision ledgers fail closed', async () => {
  const { buildReviewArtefacts } = await import(`${path.toNamespacedPath(SCRIPT)}?hostile=${Date.now()}`);
  const { reviewPacket, decisionLedger } = buildReviewArtefacts({ repoRoot: ROOT });
  const [first] = reviewPacket.cards;
  const decision = { decision_key: first.decision_key, reviewer_id: 'reviewer', reviewed_at: '2026-08-09T12:00:00.000Z', verdict: 'ACCEPT_PROPOSED_TOPIC', decided_topic: first.proposed_topic };
  const partialBody = { ...decisionLedger, decisions: [decision] };
  delete partialBody.decision_ledger_id;
  const partial = { ...partialBody, decision_ledger_id: contentId(DECISION_LEDGER_SCHEMA, partialBody) };
  const unknownBody = { ...partialBody, decisions: [{ ...decision, decision_key: 'f'.repeat(64) }] };
  const unknown = { ...unknownBody, decision_ledger_id: contentId(DECISION_LEDGER_SCHEMA, unknownBody) };
  const staleBody = { ...decisionLedger, review_packet_id: 'f'.repeat(64) };
  delete staleBody.decision_ledger_id;
  const stale = { ...staleBody, decision_ledger_id: contentId(DECISION_LEDGER_SCHEMA, staleBody) };
  for (const ledger of [partial, unknown, stale]) {
    assert.throws(() => validateRepresentationTopicDecisionLedger({ ledger, review_packet: reviewPacket }));
    assert.throws(() => ordinaryRepresentationTopicReviewGate({ ledger, review_packet: reviewPacket }));
  }
});

test('decision verdicts carry an exact permitted topic outcome', async () => {
  const { buildReviewArtefacts } = await import(`${path.toNamespacedPath(SCRIPT)}?verdicts=${Date.now()}`);
  const { reviewPacket, decisionLedger } = buildReviewArtefacts({ repoRoot: ROOT });
  const classified = reviewPacket.cards.find((card) => card.state === 'CLASSIFIED');
  const unclassified = reviewPacket.cards.find((card) => card.state === 'UNCLASSIFIED');
  const base = { reviewer_id: 'reviewer', reviewed_at: '2026-08-09T12:00:00.000Z' };
  const ledgerFor = (decision) => {
    const body = { ...decisionLedger, decisions: [decision] };
    delete body.decision_ledger_id;
    return { ...body, decision_ledger_id: contentId(DECISION_LEDGER_SCHEMA, body) };
  };
  for (const decision of [
    { ...base, decision_key: classified.decision_key, verdict: 'ACCEPT_PROPOSED_TOPIC', decided_topic: null },
    { ...base, decision_key: unclassified.decision_key, verdict: 'REJECT_PROPOSED_TOPIC', decided_topic: null },
    { ...base, decision_key: classified.decision_key, verdict: 'ASSIGN_TOPIC', decided_topic: classified.proposed_topic },
    { ...base, decision_key: unclassified.decision_key, verdict: 'ASSIGN_TOPIC', decided_topic: 'NOT_A_TOPIC' },
    { ...base, decision_key: classified.decision_key, verdict: 'CONFIRM_UNCLASSIFIED', decided_topic: null },
    { ...base, decision_key: unclassified.decision_key, verdict: 'CONFIRM_UNCLASSIFIED', decided_topic: 'TAX' },
  ]) {
    assert.throws(() => validateRepresentationTopicDecisionLedger({ ledger: ledgerFor(decision), review_packet: reviewPacket }));
  }
  const accepted = ledgerFor({ ...base, decision_key: classified.decision_key, verdict: 'ACCEPT_PROPOSED_TOPIC', decided_topic: classified.proposed_topic });
  const rejected = ledgerFor({ ...base, decision_key: classified.decision_key, verdict: 'REJECT_PROPOSED_TOPIC', decided_topic: null });
  const assigned = ledgerFor({ ...base, decision_key: unclassified.decision_key, verdict: 'ASSIGN_TOPIC', decided_topic: 'TAX' });
  const confirmed = ledgerFor({ ...base, decision_key: unclassified.decision_key, verdict: 'CONFIRM_UNCLASSIFIED', decided_topic: null });
  for (const ledger of [accepted, rejected, assigned, confirmed]) {
    assert.throws(() => validateRepresentationTopicDecisionLedger({ ledger, review_packet: reviewPacket }), /cover every review card/);
  }
});

test('self-contained HTML review artefact has all cards and inline family, topic and state filters', () => {
  const check = spawnSync(process.execPath, [SCRIPT, '--check'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr);
  const html = fs.readFileSync(HTML, 'utf8');
  const ledger = JSON.parse(fs.readFileSync(LEDGER, 'utf8'));
  assert.equal((html.match(/<h2>Card /g) || []).length, 623);
  assert.match(html, /id="family"/);
  assert.match(html, /id="topic"/);
  assert.match(html, /id="state"/);
  assert.match(html, /<style>/);
  assert.match(html, /<script>/);
  assert.match(html, /Permitted decision template/);
  assert.match(html, /ACCEPT_PROPOSED_TOPIC/);
  assert.match(html, /CONFIRM_UNCLASSIFIED/);
  assert.equal(/https?:\/\//.test(html), false);
  assert.equal(ledger.decisions.length, 0);
});
