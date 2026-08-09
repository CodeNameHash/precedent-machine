'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const { canonicalJson, contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  DECISION_LEDGER_SCHEMA,
  validateHumanAnchorMachinePacket,
  validateHumanAnchorReviewPacket,
  validateHumanAnchorKey,
  validateHumanAnchorDecisionLedger,
  humanAnchorReviewGate,
} = require('../lib/canonical-v2/human-anchor-review');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT, 'evidence/blind-review/2026-08-09');
const SCRIPT = path.join(ROOT, 'scripts/stage-2y-0-human-anchor-review.mjs');

function read(name, json = true) {
  const value = fs.readFileSync(path.join(OUTPUT_DIR, name), 'utf8');
  return json ? JSON.parse(value) : value;
}

function artefacts() {
  return {
    machine: read('stage-2y-0-human-anchor-machine-packet.json'),
    review: read('stage-2y-0-human-anchor-review.html', false),
    key: read('stage-2y-0-human-anchor-key.json'),
    ledger: read('stage-2y-0-human-anchor-decision-ledger.json'),
  };
}

test('anchor packet conserves an 80-card, 5-class stratified selection with exact source evidence', () => {
  const { machine } = artefacts();
  assert.doesNotThrow(() => validateHumanAnchorMachinePacket(machine));
  assert.equal(machine.cards.length, 80);
  assert.deepEqual(machine.strata.by_error_class, {
    MATERIALITY_CODE: 16, OTHER: 16, PARTY_ATTRIBUTION: 16, SPAN: 16, TOPIC_BUCKET: 16,
  });
  assert.equal(Object.values(machine.strata.by_error_class).reduce((total, count) => total + count, 0), machine.cards.length);
  assert.equal(machine.cards.every((card, index) => card.card_number === index + 1
    && card.evidence.excerpt.length > 0
    && card.evidence.absolute_end > card.evidence.absolute_start
    && card.evidence.excerpt_digest.length === 64), true);
  assert.ok(Object.keys(machine.strata.by_family).length >= 20);
});

test('recorded hard-error variants are visible in the machine packet and bound by a separate sealed key', async () => {
  const { machine, key } = artefacts();
  const { buildHumanAnchorArtefacts } = await import(`${path.toNamespacedPath(SCRIPT)}?key=${Date.now()}`);
  const generated = buildHumanAnchorArtefacts({ repoRoot: ROOT });
  assert.doesNotThrow(() => validateHumanAnchorReviewPacket(generated.reviewPacket));
  assert.doesNotThrow(() => validateHumanAnchorKey({ key, machine_packet: machine, review_packet: generated.reviewPacket }));
  for (const errorClass of ['PARTY_ATTRIBUTION', 'MATERIALITY_CODE']) {
    const machineSeeds = machine.cards.filter((card) => card.seeded_wrong && card.seed_type === errorClass);
    const keyedSeeds = key.entries.filter((entry) => entry.seeded_wrong && entry.seed_type === errorClass);
    assert.equal(machineSeeds.length, 4, errorClass);
    assert.equal(keyedSeeds.length, 4, errorClass);
    assert.equal(keyedSeeds.every((entry) => entry.planted_expected_verdict === 'ERROR'), true);
  }
  assert.equal(key.entries.filter((entry) => !entry.seeded_wrong).every((entry) => entry.planted_expected_verdict === null), true);
  const forged = JSON.parse(JSON.stringify(key));
  forged.entries[0].planted_expected_verdict = forged.entries[0].planted_expected_verdict === 'ERROR' ? null : 'ERROR';
  assert.throws(() => validateHumanAnchorKey({ key: forged, machine_packet: machine, review_packet: generated.reviewPacket }));
});

test('unseeded cards are not pre-judged and nested packet objects reject added fields', () => {
  const { machine, key } = artefacts();
  const unseeded = machine.cards.find((card) => !card.seeded_wrong);
  assert.ok(unseeded);
  const entry = key.entries.find((item) => item.decision_key === unseeded.decision_key);
  assert.deepEqual(entry, {
    decision_key: unseeded.decision_key,
    planted_expected_verdict: null,
    seeded_wrong: false,
    seed_type: null,
  });
  const forged = JSON.parse(JSON.stringify(machine));
  forged.cards[0].identity.unchecked = 'leak';
  assert.throws(() => validateHumanAnchorMachinePacket(forged));
});

test('reviewer HTML is self-contained, numbered, filterable, and has no machine or answer leakage', () => {
  const { machine, review } = artefacts();
  assert.equal((review.match(/<h2>Card /g) || []).length, machine.cards.length);
  assert.match(review, /id="family-filter"/);
  assert.match(review, /id="class-filter"/);
  assert.match(review, /Content-Security-Policy/);
  assert.match(review, /<style>/);
  assert.match(review, /<script>/);
  assert.equal(/https?:\/\//.test(review), false);
  assert.equal(/seeded_wrong|seed_type|expected_verdict|machine_packet|source_id/i.test(review), false);
  for (const seed of machine.cards.filter((card) => card.seeded_wrong)) {
    assert.match(review, new RegExp(seed.decision_key));
  }
});

test('stale and partial decision ledgers fail closed', async () => {
  const { ledger } = artefacts();
  const { buildHumanAnchorArtefacts } = await import(`${path.toNamespacedPath(SCRIPT)}?ledger=${Date.now()}`);
  const { reviewPacket } = buildHumanAnchorArtefacts({ repoRoot: ROOT });
  const first = reviewPacket.cards[0];
  const decision = { decision_key: first.decision_key, reviewer_id: 'reviewer', reviewed_at: '2026-08-09T15:00:00.000Z', verdict: 'CORRECT' };
  const partialBody = { ...ledger, decisions: [decision] };
  delete partialBody.decision_ledger_id;
  const partial = { ...partialBody, decision_ledger_id: contentId(DECISION_LEDGER_SCHEMA, partialBody) };
  const staleBody = { ...ledger, review_packet_id: 'f'.repeat(64) };
  delete staleBody.decision_ledger_id;
  const stale = { ...staleBody, decision_ledger_id: contentId(DECISION_LEDGER_SCHEMA, staleBody) };
  const badTimeBody = { ...ledger, decisions: [{ ...decision, reviewed_at: '2026-08-09T15:00:00Z' }] };
  delete badTimeBody.decision_ledger_id;
  const badTime = { ...badTimeBody, decision_ledger_id: contentId(DECISION_LEDGER_SCHEMA, badTimeBody) };
  for (const candidate of [partial, stale, badTime]) {
    assert.throws(() => validateHumanAnchorDecisionLedger({ ledger: candidate, review_packet: reviewPacket }));
    assert.throws(() => humanAnchorReviewGate({ ledger: candidate, review_packet: reviewPacket }));
  }
});

test('empty ledger validates and the review gate remains closed without publication authority', async () => {
  const check = spawnSync(process.execPath, [SCRIPT, '--check'], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr);
  const { ledger } = artefacts();
  const { buildHumanAnchorArtefacts } = await import(`${path.toNamespacedPath(SCRIPT)}?gate=${Date.now()}`);
  const { reviewPacket } = buildHumanAnchorArtefacts({ repoRoot: ROOT });
  assert.doesNotThrow(() => validateHumanAnchorDecisionLedger({ ledger, review_packet: reviewPacket }));
  assert.deepEqual(humanAnchorReviewGate({ ledger, review_packet: reviewPacket }), {
    closed: true,
    reason: 'HUMAN_ANCHOR_REVIEW_PENDING',
    reviewed_cards: 0,
    total_cards: 80,
    publication_authorisation: 'NONE',
  });
  assert.equal(canonicalJson(ledger.decisions), '[]');
});
