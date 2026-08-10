'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const { canonicalJson, contentId, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const {
  DECISION_LEDGER_SCHEMA,
  validateHumanAnchorMachinePacket,
  validateHumanAnchorReviewPacket,
  validateHumanAnchorKey,
  validateHumanAnchorDecisionLedger,
  humanAnchorReviewGate,
} = require('../lib/canonical-v2/human-anchor-review');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT, 'evidence/blind-review/2026-08-10');
const SCRIPT = path.join(ROOT, 'scripts/stage-2y-0-human-anchor-review.mjs');

function read(name, json = true) {
  const value = fs.readFileSync(path.join(OUTPUT_DIR, name), 'utf8');
  return json ? JSON.parse(value) : value;
}

function artefacts() {
  return {
    machine: read('stage-2y-0-human-anchor-machine-packet.json'),
    key: read('stage-2y-0-human-anchor-key.json'),
    ledger: read('stage-2y-0-human-anchor-decision-ledger.json'),
  };
}

test('anchor packet preserves the 80-card core and appends 16 hard-class seeds', () => {
  const { machine } = artefacts();
  assert.doesNotThrow(() => validateHumanAnchorMachinePacket(machine));
  assert.equal(machine.cards.length, 96);
  assert.deepEqual(machine.strata.by_error_class, {
    MATERIALITY_CODE: 24, OTHER: 16, PARTY_ATTRIBUTION: 24, SPAN: 16, TOPIC_BUCKET: 16,
  });
  assert.equal(Object.values(machine.strata.by_error_class).reduce((total, count) => total + count, 0), machine.cards.length);
  assert.equal(machine.cards.every((card, index) => card.card_number === index + 1
    && card.evidence.excerpt.length > 0
    && card.evidence.absolute_end > card.evidence.absolute_start
    && card.evidence.excerpt_digest.length === 64
    && card.governing_context.governing_sentence.text.length > 0
    && card.governing_context.governing_sentence.document_start_byte
      === card.governing_context.section_start_byte + card.governing_context.governing_sentence.start_byte), true);
  assert.ok(Object.keys(machine.strata.by_family).length >= 20);
  const renderedCards = machine.cards.filter((card) => card.rendered_row !== null);
  // Was 12 cards across {CLOSING_CONDITIONS, TERMINATION}, the only two families
  // 2Y-N could render when this packet was first built. Re-pinned 2026-08-10
  // after FAMILY_ROUTES gained seven more, and the new number is the point: the
  // re-sit now carries a rendered row on 34 of 96 cards across nine families
  // rather than 12 across two, so a reviewer judges output rather than a code on
  // a third of the packet instead of an eighth. Assert the SET as a superset
  // check rather than an equality, so adding a route is not a test failure --
  // but keep the count exact, because a silent DROP in rendered coverage is
  // exactly what this pin exists to catch.
  assert.equal(renderedCards.length, 34);
  const renderedFamilies = [...new Set(renderedCards.map((card) => card.family))].sort();
  for (const required of ['CLOSING_CONDITIONS', 'TERMINATION']) {
    assert.ok(renderedFamilies.includes(required), `${required} must still render`);
  }
  assert.equal(renderedCards.every((card) => card.rendered_row_absent === null), true);
  assert.equal(machine.cards.filter((card) => card.rendered_row === null)
    .every((card) => card.rendered_row_absent === 'FAMILY_NOT_RENDERABLE'), true);
  const materialityCore = machine.cards.filter((card) => card.error_class === 'MATERIALITY_CODE' && !card.seed_extension)
    .map(({ source_id, proposed_analysis, seed_type, seeded_wrong }) => ({ source_id, proposed_analysis, seed_type, seeded_wrong }))
    .sort((left, right) => left.source_id.localeCompare(right.source_id));
  assert.equal(sha256Hex(canonicalJson(materialityCore)), 'd5f35cc91efd304fca75fe3a3544f6f2c982d5085c3f7b00e6ebb854b80cf0f0');
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
    assert.equal(machineSeeds.length, 12, errorClass);
    assert.equal(keyedSeeds.length, 12, errorClass);
    assert.equal(machineSeeds.filter((card) => !card.seed_extension).length, 4, errorClass);
    assert.equal(keyedSeeds.every((entry) => entry.planted_expected_verdict === 'ERROR'), true);
  }
  assert.equal(key.entries.filter((entry) => !entry.seeded_wrong).every((entry) => entry.planted_expected_verdict === null), true);
  assert.equal(machine.cards.filter((card) => card.seed_extension && card.error_class === 'MATERIALITY_CODE')
    .every((card) => ['MAT_ALL_MATERIAL', 'MAT_MAE_QUALIFIED'].includes(card.proposed_analysis.proposed_value)), true);
  assert.equal(machine.cards.filter((card) => card.seed_extension && card.error_class === 'PARTY_ATTRIBUTION')
    .every((card) => ['Company', 'Parent'].includes(card.proposed_analysis.proposed_value)), true);
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
  const shifted = JSON.parse(JSON.stringify(machine));
  shifted.cards[0].governing_context.governing_sentence.document_start_byte += 1;
  shifted.cards[0].governing_context.governing_sentence.document_end_byte += 1;
  assert.throws(() => validateHumanAnchorMachinePacket(shifted));
  const omittedRenderedRow = JSON.parse(JSON.stringify(machine));
  delete omittedRenderedRow.cards[0].rendered_row;
  assert.throws(() => validateHumanAnchorMachinePacket(omittedRenderedRow));
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
  const gate = humanAnchorReviewGate({ ledger, review_packet: reviewPacket });
  assert.equal(gate.closed, true);
  assert.equal(gate.reason, 'HUMAN_ANCHOR_REVIEW_PENDING');
  assert.equal(gate.reviewed_cards, 0);
  assert.equal(gate.answered_cards, 0);
  assert.equal(gate.total_cards, 96);
  assert.equal(gate.answer_rate_floor, 0.9);
  assert.equal(gate.publication_authorisation, 'NONE');
  assert.equal(Object.values(gate.by_error_class).every((entry) => entry.answered === 0), true);
  assert.equal(canonicalJson(ledger.decisions), '[]');
});

test('the review gate measures at least 90 percent answered per class without turning CANT_JUDGE into truth', async () => {
  const { buildHumanAnchorArtefacts } = await import(`${path.toNamespacedPath(SCRIPT)}?answer-rate=${Date.now()}`);
  const { reviewPacket } = buildHumanAnchorArtefacts({ repoRoot: ROOT });
  const makeLedger = (cantJudgeByClass) => {
    const seen = new Map();
    const body = {
      schema_version: DECISION_LEDGER_SCHEMA,
      review_packet_id: reviewPacket.review_packet_id,
      machine_packet_id: reviewPacket.machine_packet_id,
      decision_keys_digest: reviewPacket.decision_keys_digest,
      decisions: reviewPacket.cards.map((card) => {
        const index = seen.get(card.error_class) || 0;
        seen.set(card.error_class, index + 1);
        return {
          decision_key: card.decision_key,
          reviewer_id: 'test-human',
          reviewed_at: '2026-08-10T12:00:00.000Z',
          verdict: index < (cantJudgeByClass[card.error_class] || 0) ? 'CANT_JUDGE' : 'CORRECT',
        };
      }),
    };
    return { ...body, decision_ledger_id: contentId(DECISION_LEDGER_SCHEMA, body) };
  };
  const passing = humanAnchorReviewGate({
    ledger: makeLedger({ MATERIALITY_CODE: 2, PARTY_ATTRIBUTION: 2, SPAN: 1, TOPIC_BUCKET: 1, OTHER: 1 }),
    review_packet: reviewPacket,
  });
  assert.equal(passing.reason, 'CALIBRATION_AUTHORITY_NOT_IMPLEMENTED');
  assert.equal(Object.values(passing.by_error_class).every((entry) => entry.rate >= 0.9), true);
  const failing = humanAnchorReviewGate({ ledger: makeLedger({ SPAN: 2 }), review_packet: reviewPacket });
  assert.equal(failing.reason, 'HUMAN_ANCHOR_ANSWER_RATE_BELOW_FLOOR');
  assert.equal(failing.by_error_class.SPAN.rate, 0.875);
});

test('completed imported ledger validates without rebuilding the empty ledger template', async () => {
  const { buildHumanAnchorArtefacts } = await import(`${path.toNamespacedPath(SCRIPT)}?imported-ledger=${Date.now()}`);
  const { reviewPacket, key } = buildHumanAnchorArtefacts({ repoRoot: ROOT });
  const body = {
    schema_version: DECISION_LEDGER_SCHEMA,
    review_packet_id: reviewPacket.review_packet_id,
    machine_packet_id: reviewPacket.machine_packet_id,
    decision_keys_digest: reviewPacket.decision_keys_digest,
    decisions: reviewPacket.cards.map((card) => ({
      decision_key: card.decision_key,
      reviewer_id: 'test-human',
      reviewed_at: '2026-08-09T16:00:00.000Z',
      verdict: key.entries.find((entry) => entry.decision_key === card.decision_key).seeded_wrong ? 'ERROR' : 'CORRECT',
    })),
  };
  const ledger = { ...body, decision_ledger_id: contentId(DECISION_LEDGER_SCHEMA, body) };
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'stage-2y-0-ledger-'));
  const ledgerPath = path.join(directory, 'completed-ledger.json');
  try {
    fs.writeFileSync(ledgerPath, `${canonicalJson(ledger)}\n`);
    const validation = spawnSync(process.execPath, [SCRIPT, '--validate-ledger', ledgerPath], { cwd: ROOT, encoding: 'utf8' });
    assert.equal(validation.status, 0, validation.stderr);
    assert.match(validation.stdout, /human anchor ledger validated: 96; anchor set: [a-f0-9]{64}/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
