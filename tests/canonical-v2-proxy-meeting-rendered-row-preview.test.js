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
const {
  NATIVE_SOURCE,
  projectProxyMeetingProductSurfaces,
} = require('../lib/canonical-v2/proxy-meeting-product-projection');

const ROOT = path.resolve(__dirname, '..');
const FEATURE_BY_DEFINITION = Object.freeze({
  BOARD_RECOMMENDATION_INCLUSION: 'boardRecommendationInclusion',
  BROKER_SEARCH_OBLIGATION_PRESENT: 'brokerSearchObligation',
  MEETING_ADJOURNMENT_REASON: 'adjournmentRights',
  MEETING_CONVENE_OBLIGATION: 'meetingConveneObligation',
  MEETING_DEADLINE_DAYS: 'meetingDeadline',
  PROXY_FILING_DEADLINE_DAYS: 'proxyFilingDeadline',
  RECORD_DATE_ESTABLISHMENT_PRESENT: 'meetingRecordDate',
});

function pinnedRuns() {
  const manifest = JSON.parse(fs.readFileSync(path.join(
    ROOT, 'evidence', 'canonical-v2', 'stage-2y-cd-baseline-manifest.json',
  ), 'utf8'));
  return manifest.runs.filter((run) => run.family === 'PROXY_MEETING');
}

function recordedRun(pin) {
  return {
    manifest: JSON.parse(fs.readFileSync(path.resolve(ROOT, pin.run_manifest.path), 'utf8')),
    resolution: JSON.parse(fs.readFileSync(path.resolve(ROOT, pin.resolution.path), 'utf8')),
  };
}

test('Proxy and Meeting uses exact feature lineage for every governed claim type', () => {
  assert.deepEqual(FAMILY_ROUTES.PROXY_MEETING, {
    configId: 'votes-approvals-meeting',
    projectionModule: 'lib/canonical-v2/proxy-meeting-product-projection.js',
    projectionExport: 'projectProxyMeetingProductSurfaces',
    rowMatch: 'FEATURE_LINEAGE',
    featureKeyByClaimDefinition: FEATURE_BY_DEFINITION,
  });
});

test('all 31 pinned Proxy and Meeting claims match exactly one lineage-bearing row', () => {
  let claimCount = 0;
  const definitions = new Map();

  for (const pin of pinnedRuns()) {
    const run = recordedRun(pin);
    assert.equal(run.resolution.resolved.length, pin.resolved_count);
    for (const entry of run.resolution.resolved) {
      const claimId = entry.claim.claim_revision_id;
      const preview = previewResolvedClaimRow({ run, resolved_entry: entry });
      const section = previewClaimSection({ run, resolved_entry: entry });
      assert.equal(preview.section.id, 'votes-approvals-meeting');
      assert.equal(preview.claim_revision_id, claimId);
      assert.ok(preview.row.cells.some((cell) => cell.text?.trim()), `${pin.directory}:${claimId}`);
      assert.equal(section.rows.filter((row) => row.matches_claim_key).length, 1, `${pin.directory}:${claimId}`);
      definitions.set(
        entry.resolved_claim_definition_key,
        (definitions.get(entry.resolved_claim_definition_key) || 0) + 1,
      );
      claimCount += 1;
    }
  }

  assert.equal(claimCount, 31);
  assert.deepEqual(Object.fromEntries([...definitions].sort()), {
    BOARD_RECOMMENDATION_INCLUSION: 4,
    BROKER_SEARCH_OBLIGATION_PRESENT: 3,
    MEETING_ADJOURNMENT_REASON: 8,
    MEETING_CONVENE_OBLIGATION: 7,
    MEETING_DEADLINE_DAYS: 3,
    PROXY_FILING_DEADLINE_DAYS: 2,
    RECORD_DATE_ESTABLISHMENT_PRESENT: 4,
  });
});

test('pinned corpus renders every legal-person obligated party and refuses document subjects', () => {
  let legalPartyClaims = 0;
  let partylessDocumentSubjects = 0;

  for (const pin of pinnedRuns()) {
    const run = recordedRun(pin);
    for (const entry of run.resolution.resolved) {
      const obligatedParty = String(entry.claim.attributes?.obligated_party || '').trim();
      const isLegalPerson = /\b(?:company|parent|buyer|seller|acquir|merger\s+sub|target)\b/iu.test(obligatedParty);
      const preview = previewResolvedClaimRow({ run, resolved_entry: entry });
      const visible = preview.row.cells.map((cell) => cell.text || '').join(' ');
      if (isLegalPerson) {
        legalPartyClaims += 1;
        assert.match(visible, new RegExp(`Party: ${obligatedParty.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
      } else {
        partylessDocumentSubjects += 1;
        assert.doesNotMatch(visible, /Party:/);
      }
    }
  }

  assert.equal(legalPartyClaims, 29);
  assert.equal(partylessDocumentSubjects, 2);
});

test('every projected Proxy feature and repeated rendered item exposes exact claim lineage', async () => {
  const { votesApprovalsMeetingConfig } = await import('../components/review/table-configs/votes-approvals-meeting.config.js');

  for (const pin of pinnedRuns()) {
    const run = recordedRun(pin);
    const projection = projectProxyMeetingProductSurfaces({
      resolution: run.resolution,
      deal_id: pin.deal,
    });
    const nativeCards = projection.cards.filter(
      (card) => card.canonical_v2_lineage.source === NATIVE_SOURCE,
    );
    for (const card of nativeCards) {
      const lineage = card.canonical_v2_lineage.feature_claim_revision_ids;
      for (const featureKey of Object.keys(card.features)) {
        assert.ok(Array.isArray(lineage[featureKey]) && lineage[featureKey].length > 0, `${pin.directory}:${card.id}:${featureKey}`);
        assert.ok(lineage[featureKey].every((claimId) => card.canonical_v2_lineage.claim_revision_ids.includes(claimId)));
      }
    }

    const rows = votesApprovalsMeetingConfig.selectRows({ cards: projection.cards });
    const lineageRows = rows.filter((row) => row.sourceCard?.canonical_v2_lineage?.source === NATIVE_SOURCE);
    assert.ok(lineageRows.every((row) => typeof row.featureKey === 'string' && row.featureKey));
    const repeatedRows = lineageRows.filter((row, index, all) => all.some(
      (candidate, candidateIndex) => candidateIndex !== index
        && candidate.sourceCard?.id === row.sourceCard?.id
        && candidate.featureKey === row.featureKey,
    ));
    for (const row of repeatedRows) {
      assert.equal(typeof row.claimRevisionId, 'string', `${pin.directory}:${row.id}`);
      assert.ok(
        row.sourceCard.canonical_v2_lineage.feature_claim_revision_ids[row.featureKey].includes(row.claimRevisionId),
        `${pin.directory}:${row.id}:${row.claimRevisionId}`,
      );
    }
  }
});

test('repeated meeting deadlines and adjournment reasons select their exact claim rows', () => {
  const cases = [
    ['topbuild', 'MEETING_DEADLINE_DAYS', 2],
    ['redhat', 'MEETING_ADJOURNMENT_REASON', 3],
  ];

  for (const [deal, definition, expectedCount] of cases) {
    const pin = pinnedRuns().find((candidate) => candidate.deal === deal);
    const run = recordedRun(pin);
    const entries = run.resolution.resolved.filter(
      (entry) => entry.resolved_claim_definition_key === definition,
    );
    assert.equal(entries.length, expectedCount);
    const previews = entries.map((entry) => previewResolvedClaimRow({ run, resolved_entry: entry }));
    assert.equal(new Set(previews.map((preview) => preview.row.id)).size, expectedCount);
  }
});

test('Proxy preview fails when a projected feature loses exact claim lineage', () => {
  const pin = pinnedRuns()[0];
  const run = recordedRun(pin);
  const selected = run.resolution.resolved[0];
  const featureKey = FEATURE_BY_DEFINITION[selected.resolved_claim_definition_key];
  const projectionPath = require.resolve('../lib/canonical-v2/proxy-meeting-product-projection');
  const projectionModule = require(projectionPath);
  const originalProject = projectionModule.projectProxyMeetingProductSurfaces;
  projectionModule.projectProxyMeetingProductSurfaces = (input) => {
    const projected = structuredClone(originalProject(input));
    const card = projected.cards.find(
      (candidate) => candidate.canonical_v2_lineage.claim_revision_ids.includes(selected.claim.claim_revision_id),
    );
    card.canonical_v2_lineage.feature_claim_revision_ids[featureKey] = [];
    return projected;
  };

  try {
    assert.throws(
      () => previewResolvedClaimRow({ run, resolved_entry: selected }),
      (error) => error.code === 'CLAIM_FEATURE_LINEAGE_MISSING'
        && error.details.claim_revision_id === selected.claim.claim_revision_id
        && error.details.feature_key === featureKey,
    );
  } finally {
    projectionModule.projectProxyMeetingProductSurfaces = originalProject;
  }
});
