'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const {
  projectClosingConditionProductSurfaces,
} = require('../lib/canonical-v2/closing-conditions-product-projection');

const ROOT = path.resolve(__dirname, '..');
const EVIDENCE_DIR = path.join(ROOT, 'evidence/canonical-v2/metsera-closing-conditions-20260809-2xk-final');

test('Metsera 7.04 replay adds primarily caused without moving any resolved claim', async () => {
  const runReceipt = JSON.parse(fs.readFileSync(path.join(EVIDENCE_DIR, 'run-receipt.json'), 'utf8'));
  const priorResolution = JSON.parse(fs.readFileSync(path.join(EVIDENCE_DIR, 'resolution.json'), 'utf8'));
  const { replayReceipt } = await import('../scripts/stage-2y-corroboration-ladder.mjs');
  const manifest = JSON.parse(fs.readFileSync(path.join(EVIDENCE_DIR, 'run-manifest.json'), 'utf8'));
  const sourceReference = JSON.parse(fs.readFileSync(path.join(EVIDENCE_DIR, 'source-reference.json'), 'utf8'));
  const recording = JSON.parse(fs.readFileSync(path.join(EVIDENCE_DIR, 'recording.json'), 'utf8'));
  const replay = await replayReceipt({
    family: manifest.section_family,
    runName: path.basename(EVIDENCE_DIR),
    manifest,
    sourceReference,
    recording,
    oldReceipt: runReceipt,
  });
  const { resolution } = replay;

  const priorClaims = priorResolution.resolved.map((entry) => ({
    claim_revision_id: entry.claim.claim_revision_id,
    state: entry.claim.state,
    canonical_value: entry.claim.canonical_value,
  }));
  const replayClaims = new Map(resolution.resolved.map((entry) => [entry.claim.claim_revision_id, entry.claim]));
  for (const prior of priorClaims) {
    const replayed = replayClaims.get(prior.claim_revision_id);
    assert.ok(replayed, `prior claim moved or disappeared: ${prior.claim_revision_id}; replay has ${[...replayClaims.keys()].join(', ')}`);
    assert.equal(replayed.state, prior.state);
    assert.deepEqual(replayed.canonical_value, prior.canonical_value);
  }

  const causation = resolution.resolved.find((entry) => (
    entry.resolved_claim_definition_key === 'FRUSTRATION_CAUSATION_STANDARD'
  ));
  assert.ok(causation, JSON.stringify({
    review: resolution.review_queue.map((entry) => entry.reasons),
    open: resolution.open_world.map((entry) => entry.reason),
  }));
  assert.equal(causation.claim.state, 'PRESENT');
  assert.equal(causation.claim.canonical_value, 'PRIMARILY_CAUSED');

  const projection = projectClosingConditionProductSurfaces({
    resolution,
    deal_id: 'metsera-closing-conditions',
  });
  const frustrationCard = projection.cards.find((card) => card.provision_subtype === 'COND-FRUSTRATE');
  assert.ok(frustrationCard);
  assert.equal(frustrationCard.features.frustrationCausationStandard, 'PRIMARILY_CAUSED');
  assert.equal(frustrationCard.features.frustrationBreachStandard, 'MATERIAL_BREACH');

  const { conditionGroups } = await import('../components/review/table-configs/conditions.config.js');
  const groups = conditionGroups({ cards: projection.cards }, {
    primitives: {
      PillCell: ({ label }) => React.createElement('span', null, label),
    },
  });
  const row = groups.flatMap((group) => group.rows)
    .find((candidate) => candidate.marketProvisionCodes?.includes('COND-FRUSTRATE'));
  const html = renderToStaticMarkup(React.createElement(React.Fragment, null, row.children));
  assert.match(html, />Primarily caused</);
  assert.match(html, />Material breach</);
});
