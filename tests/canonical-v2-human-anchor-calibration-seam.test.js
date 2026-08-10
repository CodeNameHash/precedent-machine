'use strict';

const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const path = require('node:path');
const test = require('node:test');

const { canonicalJson, contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  CalibrationHarnessError,
  buildAnchorSetFromHumanAnchorLedger,
  buildCalibration,
} = require('../lib/canonical-v2/calibration-harness');
const { DECISION_LEDGER_SCHEMA } = require('../lib/canonical-v2/human-anchor-review');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts/stage-2y-0-human-anchor-review.mjs');

function digest(value) { return createHash('sha256').update(value).digest('hex'); }
function calibrationError(code, action) {
  assert.throws(action, (error) => error instanceof CalibrationHarnessError && error.code === code);
}

async function packetSet() {
  const { buildHumanAnchorArtefacts } = await import(`${path.toNamespacedPath(SCRIPT)}?calibration=${Date.now()}`);
  return buildHumanAnchorArtefacts({ repoRoot: ROOT });
}

function completedLedger({ reviewPacket, seedKey, verdictFor = null }) {
  const decisions = reviewPacket.cards.map((card) => ({
    decision_key: card.decision_key,
    reviewer_id: 'ben-human-anchor',
    reviewed_at: '2026-08-09T16:00:00.000Z',
    verdict: verdictFor ? verdictFor(card) : (seedKey.entries.find((entry) => entry.decision_key === card.decision_key).seeded_wrong ? 'ERROR' : 'CORRECT'),
  }));
  const body = {
    schema_version: DECISION_LEDGER_SCHEMA,
    review_packet_id: reviewPacket.review_packet_id,
    machine_packet_id: reviewPacket.machine_packet_id,
    decision_keys_digest: reviewPacket.decision_keys_digest,
    decisions,
  };
  return { ...body, decision_ledger_id: contentId(DECISION_LEDGER_SCHEMA, body) };
}

test('a complete human ledger becomes the exact anchor truth used to score adjudicators', async () => {
  const { machinePacket, reviewPacket, key } = await packetSet();
  const unseededOther = machinePacket.cards.find((card) => !card.seeded_wrong && card.error_class === 'OTHER');
  const ledger = completedLedger({
    reviewPacket,
    seedKey: key,
    verdictFor: (card) => {
      const seed = key.entries.find((entry) => entry.decision_key === card.decision_key);
      if (seed.seeded_wrong) return 'ERROR';
      return card.decision_key === unseededOther.decision_key ? 'ERROR' : 'CORRECT';
    },
  });
  const anchorSet = buildAnchorSetFromHumanAnchorLedger({
    machine_packet: machinePacket, review_packet: reviewPacket, seed_key: key, decision_ledger: ledger,
  });
  assert.equal(anchorSet.anchors.length, 96);
  assert.equal(anchorSet.anchors.find((anchor) => anchor.anchor_id === unseededOther.decision_key).human_verdict, 'ERROR');
  const adjudicators = ['a', 'b', 'c'].map((adjudicator_id, index) => ({
    adjudicator_id,
    vendor: index === 1 ? 'VENDOR_B' : 'VENDOR_A',
    requested_model_digest: digest(`model-${adjudicator_id}`),
    rubric_digest: digest(`rubric-${adjudicator_id}`),
    anchor_verdicts: anchorSet.anchors.map((anchor) => ({ anchor_id: anchor.anchor_id, verdict: anchor.human_verdict })),
  }));
  const calibration = buildCalibration({
    anchor_set: anchorSet,
    adjudicators,
    floors: { precision: 1, recall: 1, seeded_detection_rate: 1 },
  });
  assert.equal(calibration.adjudicators.every((adjudicator) => adjudicator.anchor_metrics.qualified), true);
  assert.equal(calibration.anchor_set_id, anchorSet.anchor_set_id);
});

test('empty, partial, stale, and seed-key-mismatched inputs cannot become an anchor set', async () => {
  const { machinePacket, reviewPacket, key, ledger: emptyLedger } = await packetSet();
  calibrationError('HUMAN_ANCHOR_UNREVIEWED', () => buildAnchorSetFromHumanAnchorLedger({
    machine_packet: machinePacket, review_packet: reviewPacket, seed_key: key, decision_ledger: emptyLedger,
  }));
  const complete = completedLedger({ reviewPacket, seedKey: key });
  const partialBody = { ...complete, decisions: complete.decisions.slice(0, 1) };
  const partial = { ...partialBody, decision_ledger_id: contentId(DECISION_LEDGER_SCHEMA, partialBody) };
  calibrationError('HUMAN_ANCHOR_LEDGER_INVALID', () => buildAnchorSetFromHumanAnchorLedger({
    machine_packet: machinePacket, review_packet: reviewPacket, seed_key: key, decision_ledger: partial,
  }));
  const staleBody = { ...complete, review_packet_id: 'f'.repeat(64) };
  const stale = { ...staleBody, decision_ledger_id: contentId(DECISION_LEDGER_SCHEMA, staleBody) };
  calibrationError('HUMAN_ANCHOR_LEDGER_INVALID', () => buildAnchorSetFromHumanAnchorLedger({
    machine_packet: machinePacket, review_packet: reviewPacket, seed_key: key, decision_ledger: stale,
  }));
  const cantJudge = completedLedger({
    reviewPacket,
    seedKey: key,
    verdictFor: (card) => card.decision_key === reviewPacket.cards.find((item) => item.error_class === 'SPAN').decision_key
      ? 'CANT_JUDGE'
      : (key.entries.find((entry) => entry.decision_key === card.decision_key).seeded_wrong ? 'ERROR' : 'CORRECT'),
  });
  calibrationError('HUMAN_ANCHOR_UNJUDGEABLE', () => buildAnchorSetFromHumanAnchorLedger({
    machine_packet: machinePacket, review_packet: reviewPacket, seed_key: key, decision_ledger: cantJudge,
  }));
  const mismatchedKey = JSON.parse(JSON.stringify(key));
  const seed = mismatchedKey.entries.find((entry) => entry.seeded_wrong);
  seed.planted_expected_verdict = null;
  delete mismatchedKey.key_id;
  mismatchedKey.key_id = contentId('CANONICAL_V2_HUMAN_ANCHOR_KEY/V1', mismatchedKey);
  calibrationError('HUMAN_ANCHOR_KEY_INVALID', () => buildAnchorSetFromHumanAnchorLedger({
    machine_packet: machinePacket, review_packet: reviewPacket, seed_key: mismatchedKey, decision_ledger: complete,
  }));
});

test('a complete ledger that contradicts a planted error still fails closed', async () => {
  const { machinePacket, reviewPacket, key } = await packetSet();
  const seededCard = machinePacket.cards.find((card) => card.seeded_wrong);
  const ledger = completedLedger({
    reviewPacket,
    seedKey: key,
    verdictFor: (card) => card.decision_key === seededCard.decision_key ? 'CORRECT' : (key.entries.find((entry) => entry.decision_key === card.decision_key).seeded_wrong ? 'ERROR' : 'CORRECT'),
  });
  calibrationError('HUMAN_ANCHOR_SEED_MISMATCH', () => buildAnchorSetFromHumanAnchorLedger({
    machine_packet: machinePacket, review_packet: reviewPacket, seed_key: key, decision_ledger: ledger,
  }));
});

test('the seam has no publication authority or family switch output', async () => {
  const { machinePacket, reviewPacket, key } = await packetSet();
  const anchorSet = buildAnchorSetFromHumanAnchorLedger({
    machine_packet: machinePacket,
    review_packet: reviewPacket,
    seed_key: key,
    decision_ledger: completedLedger({ reviewPacket, seedKey: key }),
  });
  assert.equal(Object.hasOwn(anchorSet, 'publication_authorisation'), false);
  assert.equal(Object.hasOwn(anchorSet, 'family_switches'), false);
  assert.equal(canonicalJson(anchorSet).includes('PUBLISHED'), false);
});
