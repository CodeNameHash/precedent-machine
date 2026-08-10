'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  FAMILY_ROUTES,
  previewClaimSection,
  previewResolvedClaimRow,
} = require('../lib/review-parity/rendered-row-preview');

const ROOT = path.resolve(__dirname, '..');
const FAMILIES = Object.freeze([
  'DNO_INDEMNIFICATION',
  'GENERAL_COVENANTS',
  'NO_SHOP',
  'SPECIFIC_PERFORMANCE_REMEDIES',
]);
const HONEST_FAILURES = new Set([
  'CLAIM_PROJECTION_FAILED',
  'CLAIM_PROJECTED_CARD_NOT_UNIQUE',
  'CLAIM_RENDERED_AMBIGUOUS_ROWS',
  'CLAIM_RENDERED_NO_ROW',
  'CLAIM_SCOPED_ROW_NOT_UNIQUE',
]);

function pinnedRuns(familyId) {
  const manifest = JSON.parse(fs.readFileSync(path.join(
    ROOT, 'evidence', 'canonical-v2', 'stage-2y-cd-baseline-manifest.json',
  ), 'utf8'));
  return manifest.runs.filter((run) => run.family === familyId);
}

function recordedRun(pin) {
  return {
    manifest: JSON.parse(fs.readFileSync(path.resolve(ROOT, pin.run_manifest.path), 'utf8')),
    resolution: JSON.parse(fs.readFileSync(path.resolve(ROOT, pin.resolution.path), 'utf8')),
  };
}

function claimIds(entries) {
  return entries.map((entry) => entry?.claim?.claim_revision_id);
}

test('single-row inheritance routes declare exact claim projection scope', () => {
  for (const familyId of FAMILIES) {
    assert.equal(FAMILY_ROUTES[familyId].rowMatch, 'SINGLE_SCOPED_ROW', familyId);
    assert.equal(FAMILY_ROUTES[familyId].projectionScope, 'CLAIM', familyId);
  }
});

test('every pinned claim projects alone and either owns one content row or fails explicitly', () => {
  const counts = {};

  for (const familyId of FAMILIES) {
    const route = FAMILY_ROUTES[familyId];
    const modulePath = path.resolve(ROOT, route.projectionModule);
    const projectionModule = require(modulePath);
    const originalProject = projectionModule[route.projectionExport];
    const calls = [];
    projectionModule[route.projectionExport] = (input) => {
      const projected = originalProject(input);
      calls.push({
        resolvedClaimIds: claimIds(input.resolution.resolved),
        cards: projected.cards,
      });
      return projected;
    };

    let total = 0;
    let rows = 0;
    let failures = 0;
    try {
      for (const pin of pinnedRuns(familyId)) {
        const run = recordedRun(pin);
        for (const entry of run.resolution.resolved) {
          const claimId = entry.claim.claim_revision_id;
          const callStart = calls.length;
          total += 1;
          try {
            const preview = previewResolvedClaimRow({ run, resolved_entry: entry });
            assert.equal(preview.claim_revision_id, claimId);
            assert.ok(preview.row.cells.some((cell) => cell.text?.trim()), `${pin.directory}:${claimId}`);
            const section = previewClaimSection({ run, resolved_entry: entry });
            assert.equal(
              section.rows.filter((row) => row.matches_claim_key).length,
              1,
              `${pin.directory}:${claimId}`,
            );
            rows += 1;
          } catch (error) {
            assert.ok(HONEST_FAILURES.has(error.code), `${pin.directory}:${claimId}:${error.code || error.message}`);
            failures += 1;
          }

          const claimCalls = calls.slice(callStart);
          assert.ok(claimCalls.length > 0, `${pin.directory}:${claimId}:projection-not-called`);
          for (const call of claimCalls) {
            assert.deepEqual(call.resolvedClaimIds, [claimId], `${pin.directory}:${claimId}:projection-input`);
            for (const card of call.cards) {
              assert.deepEqual(
                card?.canonical_v2_lineage?.claim_revision_ids,
                [claimId],
                `${pin.directory}:${claimId}:${card.id}`,
              );
            }
          }
        }
      }
    } finally {
      projectionModule[route.projectionExport] = originalProject;
    }
    counts[familyId] = { total, rows, failures };
  }

  assert.deepEqual(counts, {
    DNO_INDEMNIFICATION: { total: 31, rows: 31, failures: 0 },
    GENERAL_COVENANTS: { total: 54, rows: 54, failures: 0 },
    NO_SHOP: { total: 365, rows: 365, failures: 0 },
    SPECIFIC_PERFORMANCE_REMEDIES: { total: 8, rows: 8, failures: 0 },
  });
});
