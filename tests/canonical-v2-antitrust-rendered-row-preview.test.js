'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  SUPPORTED_DEFINITIONS,
  projectAntitrustProductSurfaces,
} = require('../lib/canonical-v2/antitrust-product-projection');
const {
  FAMILY_ROUTES,
  previewClaimSection,
  previewResolvedClaimRow,
} = require('../lib/review-parity/rendered-row-preview');

const ROOT = path.resolve(__dirname, '..');
const FEATURE_BY_DEFINITION = Object.freeze({
  REGULATORY_EFFORTS_STANDARD: 'antitrustEffortsStandard',
  REGULATORY_BURDEN_COMMITMENT: 'burdenCommitment',
  REGULATORY_DIVESTITURE_CAP_AMOUNT: 'divestitureCapAmount',
  REGULATORY_LITIGATION_OBLIGATION: 'litigationObligation',
  REGULATORY_TIMING_AGREEMENT_RESTRICTION: 'timingAgreement',
  REGULATORY_WITHDRAWAL_REFILING_RESTRICTION: 'pullRefile',
  HSR_FILING_DEADLINE_DAYS: 'hsrFilingDeadlineDays',
  REGULATORY_FILING_OBLIGATION: Object.freeze(['regulatoryFilingFacts', 'hsrFilingRequired']),
  REGULATORY_FILING_DEADLINE_DAYS: 'regulatoryFilingFacts',
  REGULATORY_STRATEGY_CONTROL: 'regulatoryStrategyControlTagged',
  REGULATORY_CONSULTATION_RIGHT: 'consultationTier',
  REGULATORY_NON_IMPEDIMENT_COVENANT: 'regulatoryNonImpedimentRequired',
  REGULATORY_COOPERATION_OBLIGATION: 'regulatoryCooperationRequired',
  REGULATORY_INFORMATION_SHARING_OBLIGATION: 'regulatoryInformationSharingRequired',
  REGULATORY_NOTIFICATION_OBLIGATION: 'regulatoryNotificationRequired',
  REGULATORY_FILING_TIMING_STANDARD: 'regulatoryFilingTimingStandard',
});

function pinnedRuns() {
  const manifest = JSON.parse(fs.readFileSync(path.join(
    ROOT, 'evidence', 'canonical-v2', 'stage-2y-cd-baseline-manifest.json',
  ), 'utf8'));
  return manifest.runs.filter((run) => run.family === 'ANTITRUST_REGULATORY');
}

function recordedRun(pin) {
  return {
    manifest: JSON.parse(fs.readFileSync(path.resolve(ROOT, pin.run_manifest.path), 'utf8')),
    resolution: JSON.parse(fs.readFileSync(path.resolve(ROOT, pin.resolution.path), 'utf8')),
  };
}

test('Antitrust uses one exact Review V2 feature route for every supported claim definition', () => {
  assert.deepEqual(FAMILY_ROUTES.ANTITRUST_REGULATORY, {
    configId: 'antitrust-regulatory',
    projectionModule: 'lib/canonical-v2/antitrust-product-projection.js',
    projectionExport: 'projectAntitrustProductSurfaces',
    rowMatch: 'FEATURE_LINEAGE',
    featureKeyByClaimDefinition: FEATURE_BY_DEFINITION,
  });
  assert.deepEqual([...SUPPORTED_DEFINITIONS].sort(), Object.keys(FEATURE_BY_DEFINITION).sort());
});

test('all 70 latest recorded Antitrust claims either match one row or fail on merged lineage', () => {
  let claimCount = 0;
  const mergedLineageFailures = [];
  for (const pin of pinnedRuns()) {
    const run = recordedRun(pin);
    const projection = projectAntitrustProductSurfaces({
      resolution: run.resolution,
      deal_id: pin.deal,
    });
    for (const card of projection.cards.filter(
      (candidate) => candidate.canonical_v2_lineage.source === 'CANONICAL_V2_NATIVE_CLAIM',
    )) {
      assert.deepEqual(
        Object.keys(card.canonical_v2_lineage.feature_claim_revision_ids).sort(),
        Object.keys(card.features).sort(),
      );
    }
    for (const entry of run.resolution.resolved) {
      const claimId = entry.claim.claim_revision_id;
      try {
        const preview = previewResolvedClaimRow({ run, resolved_entry: entry });
        const section = previewClaimSection({ run, resolved_entry: entry });
        assert.equal(preview.section.id, 'antitrust-regulatory');
        assert.equal(preview.claim_revision_id, claimId);
        assert.ok(preview.row.cells.some((cell) => cell.text?.trim()), `${pin.directory}:${claimId}`);
        assert.equal(section.rows.filter((row) => row.matches_claim_key).length, 1, `${pin.directory}:${claimId}`);
      } catch (error) {
        assert.equal(error.code, 'CLAIM_FEATURE_ROW_MISSING');
        mergedLineageFailures.push(`${pin.deal}:${claimId}`);
      }
      claimCount += 1;
    }
  }
  assert.equal(claimCount, 70);
  assert.deepEqual(mergedLineageFailures.sort(), [
    'metsera:dce48a0cbe6982f61c269d6181aa0e93cb3de892827753d550a3b8ce2733510e',
    'modiv:1a525dc3c918588a17798ef7bfe22499823437ff51a8e23ee535b8f6b0eadbcd',
    'modiv:9e30ede5d447ed0051f45de03ab206ddc0406440189ec5982e10411334abcfbf',
    'redhat:2c4515e754916cf7fb62f5357724507d8dd79eec5071238a58c892e86f731c62',
    'redhat:4a535ccdf1eed4b23f5c3983ebab1f479b6b3f77ea244aff6210b201f30c04fc',
    'topbuild:0f4a1c208b59217cc8b7c12a2d52ab2bf81d62956273e1e874b0e969a9d68d75',
    'topbuild:57e13c3f0b024654ca3b233aa1ce10da5233e3adc891d7eba9447a7fdaeec2c3',
  ]);
});

test('two claims on one Antitrust card match their different governed rows', () => {
  const pin = pinnedRuns().find((candidate) => candidate.deal === 'skywater');
  const run = recordedRun(pin);
  const entries = run.resolution.resolved.filter((entry) => [
    'REGULATORY_WITHDRAWAL_REFILING_RESTRICTION',
    'REGULATORY_TIMING_AGREEMENT_RESTRICTION',
  ].includes(entry.resolved_claim_definition_key));
  assert.equal(entries.length, 2);
  assert.equal(
    entries[0].provision_instance.provision_instance_id,
    entries[1].provision_instance.provision_instance_id,
  );

  const matches = entries.map((entry) => {
    const section = previewClaimSection({ run, resolved_entry: entry });
    assert.equal(section.row_count, 2);
    const rows = section.rows.filter((row) => row.matches_claim_key);
    assert.equal(rows.length, 1);
    return rows[0].id;
  });
  assert.deepEqual(new Set(matches), new Set([
    'antitrust-regulatory-pull-refile',
    'antitrust-regulatory-timing-agreements',
  ]));
});

test('Antitrust preview rejects missing exact feature lineage', () => {
  const pin = pinnedRuns()[0];
  const run = recordedRun(pin);
  const selected = run.resolution.resolved.find(
    (entry) => entry.resolved_claim_definition_key === 'REGULATORY_EFFORTS_STANDARD',
  );
  const projectionPath = require.resolve('../lib/canonical-v2/antitrust-product-projection');
  const projectionModule = require(projectionPath);
  const originalProject = projectionModule.projectAntitrustProductSurfaces;
  projectionModule.projectAntitrustProductSurfaces = (input) => {
    const projected = structuredClone(originalProject(input));
    const card = projected.cards.find(
      (candidate) => candidate.canonical_v2_lineage.claim_revision_ids.includes(selected.claim.claim_revision_id),
    );
    card.canonical_v2_lineage.feature_claim_revision_ids.antitrustEffortsStandard = [];
    return projected;
  };

  try {
    assert.throws(
      () => previewResolvedClaimRow({ run, resolved_entry: selected }),
      (error) => error.code === 'CLAIM_FEATURE_LINEAGE_MISSING'
        && error.details.claim_revision_id === selected.claim.claim_revision_id
        && error.details.feature_key === 'antitrustEffortsStandard',
    );
  } finally {
    projectionModule.projectAntitrustProductSurfaces = originalProject;
  }
});

test('Antitrust preview rejects a merged feature row without atomic claim identity', () => {
  const pin = pinnedRuns()[0];
  const run = recordedRun(pin);
  const selected = run.resolution.resolved.find(
    (entry) => entry.resolved_claim_definition_key === 'REGULATORY_EFFORTS_STANDARD',
  );
  const projectionPath = require.resolve('../lib/canonical-v2/antitrust-product-projection');
  const projectionModule = require(projectionPath);
  const originalProject = projectionModule.projectAntitrustProductSurfaces;
  projectionModule.projectAntitrustProductSurfaces = (input) => {
    const projected = structuredClone(originalProject(input));
    const card = projected.cards.find(
      (candidate) => candidate.canonical_v2_lineage.claim_revision_ids.includes(selected.claim.claim_revision_id),
    );
    card.canonical_v2_lineage.feature_claim_revision_ids.antitrustEffortsStandard.push('sibling-claim');
    return projected;
  };

  try {
    assert.throws(
      () => previewResolvedClaimRow({ run, resolved_entry: selected }),
      (error) => error.code === 'CLAIM_FEATURE_ROW_MISSING'
        && error.details.feature_key === 'antitrustEffortsStandard',
    );
  } finally {
    projectionModule.projectAntitrustProductSurfaces = originalProject;
  }
});
