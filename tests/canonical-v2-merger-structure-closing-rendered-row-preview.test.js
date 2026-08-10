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
const ROW_BY_ASSERTION_KIND = Object.freeze({
  ACTIONS: 'structure-mechanics-closing-actions',
  BOARD_DESIGNATION: 'structure-mechanics-board-designation',
  CLOSING_LOCATION: 'structure-mechanics-closing-location',
  CLOSING_TIMING: 'structure-mechanics-closing-timing',
  DIRECTORS: 'structure-mechanics-directors-officers',
  EFFECTIVE_TIME: 'structure-mechanics-effective-time',
  EFFECTS: 'structure-mechanics-effects',
});

function recordedRun(pin) {
  return {
    manifest: JSON.parse(fs.readFileSync(path.resolve(ROOT, pin.run_manifest.path), 'utf8')),
    resolution: JSON.parse(fs.readFileSync(path.resolve(ROOT, pin.resolution.path), 'utf8')),
  };
}

function pinnedRuns() {
  const manifest = JSON.parse(fs.readFileSync(path.join(
    ROOT, 'evidence', 'canonical-v2', 'stage-2y-cd-baseline-manifest.json',
  ), 'utf8'));
  return manifest.runs.filter((run) => run.family === 'MERGER_STRUCTURE_CLOSING');
}

test('merger structure route binds assertion and step claims to exact Review V2 features', () => {
  assert.deepEqual(FAMILY_ROUTES.MERGER_STRUCTURE_CLOSING, {
    configId: 'structure-mechanics',
    projectionModule: 'lib/canonical-v2/merger-structure-closing-product-projection.js',
    projectionExport: 'projectMergerStructureClosingProductSurfaces',
    rowMatch: 'FEATURE_LINEAGE',
    featureKeyByClaimDefinition: { MERGER_TRANSACTION_STEP: 'transactionSteps' },
    featureKeyByAssertionKind: {
      ACTIONS: 'closingActions',
      BOARD_DESIGNATION: 'buyerBoardDesignation',
      CLOSING_LOCATION: 'closingLocation',
      CLOSING_TIMING: 'closingTiming',
      DIRECTORS: 'directorsAtEffectiveTime',
      EFFECTIVE_TIME: 'clause',
      EFFECTS: 'effectsOfMergerReference',
      SHORT_FORM_251H: 'section251h',
    },
    reviewDealArrayFeature: { field: 'transactionSteps', feature: 'transactionSteps' },
  });
});

test('all 103 pinned merger structure claims reach one content-bearing governed row', () => {
  let claims = 0;
  const rowCounts = new Map();
  for (const pin of pinnedRuns()) {
    const run = recordedRun(pin);
    assert.equal(run.resolution.resolved.length, pin.resolved_count);
    for (const entry of run.resolution.resolved) {
      const definitionKey = entry.resolved_claim_definition_key;
      const assertionKind = entry.claim.attributes.assertion_kind;
      const expectedRow = definitionKey === 'MERGER_TRANSACTION_STEP'
        ? 'structure-mechanics-merger-form'
        : ROW_BY_ASSERTION_KIND[assertionKind];
      assert.ok(expectedRow, `${pin.directory}:${assertionKind || definitionKey}`);
      const preview = previewResolvedClaimRow({ run, resolved_entry: entry });
      assert.equal(preview.section.id, 'structure-mechanics');
      assert.equal(preview.row.id, expectedRow, `${pin.directory}:${entry.claim.claim_revision_id}`);
      assert.ok(
        preview.row.cells.some((cell) => String(cell.text || '').trim()),
        `${pin.directory}:${entry.claim.claim_revision_id}`,
      );
      if (assertionKind === 'ACTIONS') {
        const provisionCell = preview.row.cells.find((cell) => cell.id === 'signals');
        assert.equal(provisionCell?.text, entry.claim.raw_value);
      }
      assert.equal(preview.claim_revision_id, entry.claim.claim_revision_id);
      rowCounts.set(expectedRow, (rowCounts.get(expectedRow) || 0) + 1);
      claims += 1;
    }
  }

  assert.equal(claims, 103);
  assert.deepEqual(Object.fromEntries([...rowCounts].sort()), {
    'structure-mechanics-board-designation': 2,
    'structure-mechanics-closing-actions': 3,
    'structure-mechanics-closing-location': 10,
    'structure-mechanics-closing-timing': 10,
    'structure-mechanics-directors-officers': 7,
    'structure-mechanics-effective-time': 21,
    'structure-mechanics-effects': 35,
    'structure-mechanics-merger-form': 15,
  });
});
