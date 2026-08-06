'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { V1_FIXTURE_DEAL_IDS, V1_RECLASS_EXTRACTION_VERSION } = require('./v1-reclassification-pins');
const { validateReceipt } = require('./v1-apply-receipt');

const SEQUENCE_STATE_FILE = 'reports/v1-apply-sequence-state.json';
const DEAL_LABELS = Object.freeze({
  [V1_FIXTURE_DEAL_IDS[0]]: 'TopBuild',
  [V1_FIXTURE_DEAL_IDS[1]]: 'Skechers',
  [V1_FIXTURE_DEAL_IDS[2]]: 'Modiv',
});
const V1_APPLY_STEPS = Object.freeze([
  Object.freeze({ id: 'classify', requiresPriorStepIds: [], mustFollowStepIds: [], buildArgv: (id) => ['node', 'scripts/reprocess.js', '--deal', DEAL_LABELS[id], '--classify-only', '--apply', '--v1-reclass'] }),
  Object.freeze({ id: 'extract', requiresPriorStepIds: ['classify'], mustFollowStepIds: ['classify'], buildArgv: (id) => ['node', 'scripts/reprocess.js', '--deal', DEAL_LABELS[id], '--types', 'REP-T,REP-B,MISC', '--apply', '--no-rematerialize', '--v1-reclass'] }),
  Object.freeze({ id: 'backfill', requiresPriorStepIds: ['classify', 'extract'], mustFollowStepIds: ['extract'], buildArgv: (id) => ['node', 'scripts/backfill/extract-to-cards.js', '--deal', id, '--apply', '--extraction-version', V1_RECLASS_EXTRACTION_VERSION] }),
  Object.freeze({ id: 'rematerialize', requiresPriorStepIds: ['classify', 'extract', 'backfill'], mustFollowStepIds: ['backfill'], buildArgv: (id) => ['node', 'scripts/reprocess/rematerialize-claims.js', '--deal', id, '--apply'] }),
]);

function assertFixtureDeal(dealId) {
  if (!V1_FIXTURE_DEAL_IDS.includes(dealId)) throw new Error('v1 apply harness accepts only the three pinned fixture deal IDs.');
}
function assertFixtureOrder(dealId, sequenceState = {}) {
  assertFixtureDeal(dealId);
  const index = V1_FIXTURE_DEAL_IDS.indexOf(dealId);
  for (const prior of V1_FIXTURE_DEAL_IDS.slice(0, index)) {
    if (sequenceState[prior]?.status !== 'complete') throw new Error(`Fixture order requires ${DEAL_LABELS[prior]} to be complete first.`);
  }
  for (const id of Object.keys(sequenceState)) assertFixtureDeal(id);
}
function assertNoRematerializeBeforeCardBackfill(steps) {
  const ids = steps.map((step) => step.id);
  if (ids.indexOf('rematerialize') < ids.indexOf('backfill')) throw new Error('Claims rematerialisation cannot precede card backfill.');
  const extract = steps.find((step) => step.id === 'extract');
  if (!extract?.argv?.includes('--no-rematerialize')) throw new Error('The extract step must carry --no-rematerialize.');
}
function buildSequencePlan(dealId, sequenceState = {}) {
  assertFixtureOrder(dealId, sequenceState);
  const steps = V1_APPLY_STEPS.map((step) => ({ ...step, argv: step.buildArgv(dealId) }));
  assertNoRematerializeBeforeCardBackfill(steps);
  return Object.freeze({ deal_id: dealId, deal_label: DEAL_LABELS[dealId], steps: Object.freeze(steps) });
}
function verifiedCompletedSteps(dealId, sequenceState, verifyReceipt) {
  const entry = sequenceState[dealId] || {};
  const completed = entry.completed_step_ids || [];
  if (!completed.length) return completed;
  if (!Array.isArray(entry.receipts) || typeof verifyReceipt !== 'function') throw new Error('Completed steps require independently verified receipts.');
  const receiptByStep = new Map(entry.receipts.map((receipt) => [receipt.step, receipt]));
  for (const stepId of completed) {
    const receipt = receiptByStep.get(stepId);
    if (!receipt || receipt.dealId !== dealId || !validateReceipt(receipt) || verifyReceipt(receipt) !== true) throw new Error(`Completed step ${stepId} has no independently verified receipt.`);
  }
  return completed;
}
function assertStepEligible(dealId, stepId, sequenceState = {}, { verifyReceipt } = {}) {
  const step = V1_APPLY_STEPS.find((entry) => entry.id === stepId);
  if (!step) throw new Error('Unknown v1 apply step.');
  assertFixtureOrder(dealId, sequenceState);
  const done = verifiedCompletedSteps(dealId, sequenceState, verifyReceipt);
  if (!step.requiresPriorStepIds.every((id) => done.includes(id))) throw new Error(`${stepId} requires all earlier pinned steps to be complete.`);
  return true;
}
function loadSequenceState(file = SEQUENCE_STATE_FILE) { return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {}; }
function updateSequenceState(update, file = SEQUENCE_STATE_FILE) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const lock = `${file}.lock`;
  let lockFd;
  try {
    lockFd = fs.openSync(lock, 'wx');
    const next = update(loadSequenceState(file));
    if (!next || typeof next !== 'object' || Array.isArray(next)) throw new Error('Sequence state update must return an object.');
    const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(temp, `${JSON.stringify(next, null, 2)}\n`, { flag: 'wx' });
    fs.renameSync(temp, file);
    return next;
  } finally {
    if (lockFd !== undefined) fs.closeSync(lockFd);
    if (fs.existsSync(lock)) fs.unlinkSync(lock);
  }
}
function saveSequenceState(state, file = SEQUENCE_STATE_FILE) { return updateSequenceState(() => state, file); }

module.exports = { DEAL_LABELS, SEQUENCE_STATE_FILE, V1_APPLY_STEPS, assertFixtureOrder, assertNoRematerializeBeforeCardBackfill, assertStepEligible, buildSequencePlan, loadSequenceState, saveSequenceState, updateSequenceState, verifiedCompletedSteps };
