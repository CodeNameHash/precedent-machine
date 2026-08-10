'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  projectTerminationFeeProductSurfaces,
  projectTerminationRightsProductSurfaces,
} = require('../lib/canonical-v2/termination-product-projection');
const { projectEmployeeDnoProductSurfaces } = require('../lib/canonical-v2/employee-dno-product-projection');
const { previewClaimSection } = require('../lib/review-parity/rendered-row-preview');

const ROOT = path.resolve(__dirname, '..');

function loadRun(directory) {
  const root = path.join(ROOT, 'evidence/canonical-v2', directory);
  return {
    manifest: JSON.parse(fs.readFileSync(path.join(root, 'run-manifest.json'), 'utf8')),
    resolution: JSON.parse(fs.readFileSync(path.join(root, 'resolution.json'), 'utf8')),
  };
}

function selected(run, definition) {
  const entry = run.resolution.resolved.find(
    (candidate) => candidate.resolved_claim_definition_key === definition,
  );
  assert.ok(entry, `${definition} must exist in the pinned run`);
  return entry;
}

function projectedCard(projection, claimRevisionId) {
  const card = projection.cards.find(
    (candidate) => candidate.canonical_v2_lineage?.claim_revision_ids?.includes(claimRevisionId),
  );
  assert.ok(card, 'the projected card must retain the source claim revision');
  return card;
}

function renderedText(run, entry) {
  return previewClaimSection({ run, resolved_entry: entry }).rows
    .flatMap((row) => row.cells.map((cell) => cell.text))
    .join(' ');
}

test('fixed date anchors remain structured and render in plain text without changing claim lineage', () => {
  const dnoRun = loadRun('concho-dno-indemnification-20260809-2xk-final');
  const dnoEntry = selected(dnoRun, 'TAIL_POLICY_PERIOD_YEARS');
  const dnoProjection = projectEmployeeDnoProductSurfaces({
    resolution: dnoRun.resolution,
    deal_id: dnoRun.manifest.deal,
  });
  const dnoCard = projectedCard(dnoProjection, dnoEntry.claim.claim_revision_id);
  assert.deepEqual(dnoCard.features.insurancePeriod, {
    value: 6,
    unit: 'years',
    trigger: 'effective_time',
  });
  assert.match(renderedText(dnoRun, dnoEntry), /6 years from Effective Time/);

  const survivalRun = loadRun('metsera-dno-indemnification-20260809-2xk-final');
  const survivalEntry = selected(survivalRun, 'INDEMNIFICATION_SURVIVAL_YEARS');
  const survivalProjection = projectEmployeeDnoProductSurfaces({
    resolution: survivalRun.resolution,
    deal_id: survivalRun.manifest.deal,
  });
  const survivalCard = projectedCard(survivalProjection, survivalEntry.claim.claim_revision_id);
  assert.deepEqual(survivalCard.features.indemnificationPeriod, {
    value: 6,
    unit: 'years',
    trigger: 'effective_time',
  });
  assert.match(renderedText(survivalRun, survivalEntry), /6 years from Effective Time/);

  const rightsRun = loadRun('metsera-termination-20260809-2xk-final');
  const cureEntry = selected(rightsRun, 'TERMINATION_CURE_PERIOD_DAYS');
  const rightsProjection = projectTerminationRightsProductSurfaces({
    resolution: rightsRun.resolution,
    deal_id: rightsRun.manifest.deal,
  });
  const cureCard = projectedCard(rightsProjection, cureEntry.claim.claim_revision_id);
  assert.deepEqual(cureCard.features.curePeriod, {
    value: '30',
    unit: 'calendar_days',
    trigger: 'written_notice',
  });
  assert.match(renderedText(rightsRun, cureEntry), /30 days after written notice/);

  const feeRun = loadRun('concho-termination-fee-20260809-2xk-final');
  const tailEntry = selected(feeRun, 'TERMINATION_FEE_TAIL_PERIOD_MONTHS');
  const feeProjection = projectTerminationFeeProductSurfaces({
    resolution: feeRun.resolution,
    deal_id: feeRun.manifest.deal,
  });
  const tailCard = projectedCard(feeProjection, tailEntry.claim.claim_revision_id);
  assert.deepEqual(tailCard.features.tailProvision, {
    period_months: '12',
    trigger: 'qualifying_termination',
  });
  assert.deepEqual(tailCard.features.tailFeeWindowMonths, {
    value: '12',
    unit: 'months',
    trigger: 'qualifying_termination',
  });
  assert.match(renderedText(feeRun, tailEntry), /12 months after qualifying termination/);
});
