'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  FAMILY_ROUTES,
  previewResolvedClaimRow,
} = require('../lib/review-parity/rendered-row-preview');

const ROOT = path.resolve(__dirname, '..');

function pinnedRuns() {
  const manifest = JSON.parse(fs.readFileSync(path.join(
    ROOT, 'evidence', 'canonical-v2', 'stage-2y-cd-baseline-manifest.json',
  ), 'utf8'));
  return manifest.runs.filter((run) => run.family === 'NO_OTHER_REPS_FRAUD');
}

function recordedRun(pin) {
  return {
    manifest: JSON.parse(fs.readFileSync(path.resolve(ROOT, pin.run_manifest.path), 'utf8')),
    resolution: JSON.parse(fs.readFileSync(path.resolve(ROOT, pin.resolution.path), 'utf8')),
  };
}

test('No Other Reps route uses the existing atomic dark-preview row with feature-lineage validation', () => {
  assert.deepEqual(FAMILY_ROUTES.NO_OTHER_REPS_FRAUD, {
    configId: 'no-other-reps-fraud',
    projectionModule: 'lib/canonical-v2/no-other-reps-fraud-review-projection.js',
    projectionExport: 'projectNoOtherRepsFraudReviewSurfaces',
    rowMatch: 'SOURCE_CARD',
    validateFeatureLineage: true,
    featureKeyByClaimDefinition: {
      NO_OTHER_REPRESENTATIONS_DISCLAIMER_PRESENT: 'noOtherRepsFraudFact',
      NON_RELIANCE_ACKNOWLEDGMENT_PRESENT: 'noOtherRepsFraudFact',
      EXTRA_CONTRACTUAL_RELIANCE_DISCLAIMER_PRESENT: 'noOtherRepsFraudFact',
    },
    reviewDealExtra: { canonical_v2_preview_enabled: true },
  });
});

test('all 36 pinned claims reach one atomic lineage-bearing row', () => {
  let claims = 0;
  const definitions = new Map();
  for (const pin of pinnedRuns()) {
    const run = recordedRun(pin);
    assert.equal(run.resolution.resolved.length, pin.resolved_count);
    for (const entry of run.resolution.resolved) {
      const preview = previewResolvedClaimRow({ run, resolved_entry: entry });
      assert.equal(preview.section.id, 'no-other-reps-fraud');
      assert.match(preview.row.id, /^no-other-reps-fraud-dark-/);
      assert.match(preview.row.label, /\(Canonical V2 preview\)$/);
      assert.equal(preview.row.cells.find((cell) => cell.id === 'status')?.text, 'Yes');
      assert.equal(preview.claim_revision_id, entry.claim.claim_revision_id);
      definitions.set(
        entry.resolved_claim_definition_key,
        (definitions.get(entry.resolved_claim_definition_key) || 0) + 1,
      );
      claims += 1;
    }
  }

  assert.equal(claims, 36);
  assert.deepEqual(Object.fromEntries([...definitions].sort()), {
    EXTRA_CONTRACTUAL_RELIANCE_DISCLAIMER_PRESENT: 5,
    NON_RELIANCE_ACKNOWLEDGMENT_PRESENT: 9,
    NO_OTHER_REPRESENTATIONS_DISCLAIMER_PRESENT: 22,
  });
});

test('preview fails when a card loses exact feature lineage', () => {
  const pin = pinnedRuns()[0];
  const run = recordedRun(pin);
  const selected = run.resolution.resolved[0];
  const modulePath = require.resolve('../lib/canonical-v2/no-other-reps-fraud-review-projection');
  const projectionModule = require(modulePath);
  const originalProject = projectionModule.projectNoOtherRepsFraudReviewSurfaces;
  projectionModule.projectNoOtherRepsFraudReviewSurfaces = (input) => {
    const projection = structuredClone(originalProject(input));
    const card = projection.cards.find(
      (candidate) => candidate.canonical_v2_lineage.claim_revision_ids.includes(
        selected.claim.claim_revision_id,
      ),
    );
    card.canonical_v2_lineage.feature_claim_revision_ids.noOtherRepsFraudFact = [];
    return projection;
  };

  try {
    assert.throws(
      () => previewResolvedClaimRow({ run, resolved_entry: selected }),
      (error) => error.code === 'CLAIM_FEATURE_LINEAGE_MISSING'
        && error.details.claim_revision_id === selected.claim.claim_revision_id,
    );
  } finally {
    projectionModule.projectNoOtherRepsFraudReviewSurfaces = originalProject;
  }
});
