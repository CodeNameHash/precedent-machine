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
const EXPECTED_ROW_BY_CLAIM = Object.freeze({
  MAE_DEFINITION_PRONG: 'mae-definitions-prongs',
  MAE_CARVEOUT: 'mae-definitions-carveouts',
  MAE_DISPROPORTIONALITY_CARVEBACK: 'mae-definitions-disproportionality-relationships',
});

function recordedRun(directory) {
  const dir = path.join(ROOT, 'evidence', 'canonical-v2', directory);
  return {
    manifest: JSON.parse(fs.readFileSync(path.join(dir, 'run-manifest.json'), 'utf8')),
    resolution: JSON.parse(fs.readFileSync(path.join(dir, 'resolution.json'), 'utf8')),
  };
}

function pinnedMaeRuns() {
  const baseline = JSON.parse(fs.readFileSync(path.join(
    ROOT, 'evidence', 'canonical-v2', 'stage-2y-cd-baseline-manifest.json',
  ), 'utf8'));
  return baseline.runs.filter((run) => run.family === 'MAE_DEFINITION');
}

test('MAE route binds atomic features and fails closed on grouped feature lineage', () => {
  assert.deepEqual(FAMILY_ROUTES.MAE_DEFINITION, {
    configId: 'mae-definitions',
    projectionModule: 'lib/canonical-v2/key-terms-mae-product-projection.js',
    projectionExport: 'projectKeyTermsMaeClaims',
    projectionArgs: 'RESOLVED_ENTRIES',
    cardArrayKey: 'mae_review_cards',
    rowMatch: 'FEATURE_LINEAGE',
    featureKeyByClaimDefinition: {
      MAE_DEFINITION_PRONG: 'maeDefinitionProngs',
      MAE_CARVEOUT: 'carveouts',
      MAE_DISPROPORTIONALITY_CARVEBACK: 'maeDisproportionalityRelationships',
    },
  });

  let claims = 0;
  const rowCounts = new Map();
  const failureCounts = new Map();
  for (const runSpec of pinnedMaeRuns()) {
    const run = recordedRun(runSpec.directory);
    assert.equal(run.resolution.resolved.length, runSpec.resolved_count);
    for (const entry of run.resolution.resolved) {
      const expectedRowId = EXPECTED_ROW_BY_CLAIM[entry.resolved_claim_definition_key];
      assert.ok(expectedRowId, entry.resolved_claim_definition_key);
      try {
        const preview = previewResolvedClaimRow({ run, resolved_entry: entry });
        assert.equal(preview.section.id, 'mae-definitions');
        assert.equal(preview.row.id, expectedRowId, `${runSpec.directory}:${entry.claim.claim_revision_id}`);
        const signals = preview.row.cells.find((cell) => cell.id === 'signals');
        assert.ok(signals?.text?.trim(), `${runSpec.directory}:${entry.claim.claim_revision_id}`);
        assert.equal(preview.claim_revision_id, entry.claim.claim_revision_id);
        rowCounts.set(expectedRowId, (rowCounts.get(expectedRowId) || 0) + 1);
      } catch (error) {
        assert.equal(error.code, 'CLAIM_FEATURE_ROW_MISSING');
        const key = entry.resolved_claim_definition_key;
        failureCounts.set(key, (failureCounts.get(key) || 0) + 1);
      }
      claims += 1;
    }
  }

  assert.equal(claims, 108);
  assert.deepEqual(Object.fromEntries(rowCounts), {
    'mae-definitions-disproportionality-relationships': 4,
    'mae-definitions-prongs': 4,
  });
  assert.deepEqual(Object.fromEntries(failureCounts), {
    MAE_DEFINITION_PRONG: 8,
    MAE_CARVEOUT: 78,
    MAE_DISPROPORTIONALITY_CARVEBACK: 14,
  });
});

test('MAE preview fails with a precise reason when projected feature lineage drops the supplied claim', () => {
  const run = recordedRun('metsera-mae-definition-20260809-2xk-final');
  const selected = run.resolution.resolved.find(
    (entry) => entry.resolved_claim_definition_key === 'MAE_DEFINITION_PRONG',
  );
  assert.ok(selected);

  const projectionPath = require.resolve('../lib/canonical-v2/key-terms-mae-product-projection');
  const projectionModule = require(projectionPath);
  const originalProject = projectionModule.projectKeyTermsMaeClaims;
  projectionModule.projectKeyTermsMaeClaims = (input) => {
    const projected = structuredClone(originalProject(input));
    const card = projected.mae_review_cards.find(
      (candidate) => candidate.canonical_v2_lineage.claim_revision_ids.includes(selected.claim.claim_revision_id),
    );
    card.canonical_v2_lineage.feature_claim_revision_ids.maeDefinitionProngs = [];
    return projected;
  };

  try {
    assert.throws(
      () => previewResolvedClaimRow({ run, resolved_entry: selected }),
      (error) => error.code === 'CLAIM_FEATURE_LINEAGE_MISSING'
        && error.details.claim_revision_id === selected.claim.claim_revision_id
        && error.details.feature_key === 'maeDefinitionProngs',
    );
  } finally {
    projectionModule.projectKeyTermsMaeClaims = originalProject;
  }
});
