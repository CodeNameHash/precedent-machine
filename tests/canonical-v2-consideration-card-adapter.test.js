'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  NATIVE_SOURCE,
  projectConsiderationWaveAClaims,
} = require('../lib/canonical-v2/consideration-wave-a-product-projection');
const {
  loadTableConfig,
  toReviewDeal,
} = require('../lib/review-parity/views');
const {
  previewClaimSection,
  previewReviewDealRow,
} = require('../lib/review-parity/rendered-row-preview');

const ROOT = path.resolve(__dirname, '..');
const BASELINE_MANIFEST = path.join(
  ROOT,
  'evidence/canonical-v2/stage-2y-cd-baseline-manifest.json',
);

function considerationRuns() {
  const manifest = JSON.parse(fs.readFileSync(BASELINE_MANIFEST, 'utf8'));
  return manifest.runs
    .filter((run) => run.family === 'CONSIDERATION')
    .map((run) => ({
      deal: run.deal,
      resolution: JSON.parse(fs.readFileSync(path.resolve(ROOT, run.resolution.path), 'utf8')),
    }));
}

function projectionForEntry(entry) {
  return projectConsiderationWaveAClaims({ resolved_entries: [entry] });
}

test('governed Consideration claims project one exact-lineage Review card per claim', () => {
  const runs = considerationRuns();
  const allResolved = runs.flatMap(({ resolution }) => resolution.resolved);
  const allCards = allResolved.flatMap((entry) => projectionForEntry(entry).cards);

  assert.equal(allResolved.length, 7);
  assert.equal(allCards.length, 7);
  assert.equal(new Set(allCards.map((card) => card.id)).size, 7);

  for (const { resolution } of runs) {
    for (const entry of resolution.resolved) {
      const projection = projectionForEntry(entry);
      assert.equal(projection.cards.length, 1);
      const claimId = entry.claim.claim_revision_id;
      const matches = projection.cards.filter(
        (card) => card.canonical_v2_lineage.claim_revision_ids.includes(claimId),
      );
      assert.equal(matches.length, 1);
      const [card] = matches;
      assert.equal(card.provision_instance_id, entry.provision_instance.provision_instance_id);
      assert.equal(card.section_ref, entry.section_reference);
      assert.equal(card.primary_quote, entry.claim.raw_value);
      assert.deepEqual(card.canonical_v2_lineage, {
        source: NATIVE_SOURCE,
        claim_revision_ids: [claimId],
        claim_definition_keys: [entry.resolved_claim_definition_key],
        feature_claim_revision_ids: {
          [{
            PER_SHARE_CASH_CONSIDERATION: 'perShareAmount',
            EXCHANGE_RATIO_VALUE: 'exchangeRatio',
            APPRAISAL_RIGHTS_STATUS: 'appraisalRightsAvailable',
          }[entry.resolved_claim_definition_key]]: [claimId],
        },
      });
      assert.equal(card.provision_type, 'CONSIDERATION');
      assert.equal(card.provision_subtype, 'CONSID');
      assert.equal(Object.hasOwn(card, 'party'), false);
    }
  }
});

test('cards use only the governed resolved value for the hero feature', () => {
  const expectedField = {
    PER_SHARE_CASH_CONSIDERATION: 'perShareAmount',
    EXCHANGE_RATIO_VALUE: 'exchangeRatio',
    APPRAISAL_RIGHTS_STATUS: 'appraisalRightsAvailable',
  };

  for (const { resolution } of considerationRuns()) {
    for (const entry of resolution.resolved) {
      const projection = projectionForEntry(entry);
      const card = projection.cards.find(
        (candidate) => candidate.canonical_v2_lineage.claim_revision_ids[0]
          === entry.claim.claim_revision_id,
      );
      const field = expectedField[entry.resolved_claim_definition_key];
      const expectedValue = entry.resolved_claim_definition_key === 'APPRAISAL_RIGHTS_STATUS'
        ? entry.claim.canonical_value === 'AVAILABLE'
        : entry.claim.canonical_value;
      assert.deepEqual(card.features, { [field]: expectedValue });
      assert.deepEqual(card.ai_metadata.features, card.features);
    }
  }
});

test('each governed corpus claim reaches its supported consideration-hero row', () => {
  const config = loadTableConfig(
    'components/review/table-configs/consideration-hero.config.js',
    'considerationHeroConfig',
  );
  const expectedRow = {
    PER_SHARE_CASH_CONSIDERATION: 'consideration-hero-per-share',
    EXCHANGE_RATIO_VALUE: 'consideration-hero-exchangeRatio',
    APPRAISAL_RIGHTS_STATUS: 'consideration-hero-appraisalRightsAvailable',
  };

  for (const { deal, resolution } of considerationRuns()) {
    for (const entry of resolution.resolved) {
      const projection = projectionForEntry(entry);
      const claimId = entry.claim.claim_revision_id;
      const card = projection.cards.find(
        (candidate) => candidate.canonical_v2_lineage.claim_revision_ids[0] === claimId,
      );
      const rows = config.selectRows(toReviewDeal(deal, [card]));
      assert.ok(rows.some((row) => row.id === expectedRow[entry.resolved_claim_definition_key]));
    }
  }
});

test('adding cards does not change the existing records projection', () => {
  for (const { resolution } of considerationRuns()) {
    const records = resolution.resolved.map((entry) => projectionForEntry(entry).records[0]).map((record) => ({
      claim_revision_id: record.claim_revision_id,
      provision_instance_id: record.provision_instance_id,
      field_key: record.query.field_key,
      query_value: record.query.value,
      compare_value: record.compare.value,
      market_value: record.market.canonical_value,
    }));
    const expected = resolution.resolved.map((entry) => {
      const field = {
        PER_SHARE_CASH_CONSIDERATION: 'perShareAmount',
        EXCHANGE_RATIO_VALUE: 'exchangeRatio',
        APPRAISAL_RIGHTS_STATUS: 'appraisalRightsAvailable',
      }[entry.resolved_claim_definition_key];
      const value = entry.resolved_claim_definition_key === 'APPRAISAL_RIGHTS_STATUS'
        ? entry.claim.canonical_value === 'AVAILABLE'
        : entry.claim.canonical_value;
      return {
        claim_revision_id: entry.claim.claim_revision_id,
        provision_instance_id: entry.provision_instance.provision_instance_id,
        field_key: field,
        query_value: value,
        compare_value: value,
        market_value: entry.claim.canonical_value,
      };
    }).sort((left, right) => left.claim_revision_id.localeCompare(right.claim_revision_id));
    records.sort((left, right) => left.claim_revision_id.localeCompare(right.claim_revision_id));
    assert.deepEqual(records, expected);
  }
});

test('each governed Consideration claim reaches a content-bearing headless preview row', () => {
  const expectedRow = {
    PER_SHARE_CASH_CONSIDERATION: 'consideration-hero-per-share',
    EXCHANGE_RATIO_VALUE: 'consideration-hero-exchangeRatio',
    APPRAISAL_RIGHTS_STATUS: 'consideration-hero-appraisalRightsAvailable',
  };
  for (const runPin of JSON.parse(fs.readFileSync(BASELINE_MANIFEST, 'utf8')).runs
    .filter((run) => run.family === 'CONSIDERATION')) {
    const run = {
      manifest: JSON.parse(fs.readFileSync(path.resolve(ROOT, runPin.run_manifest.path), 'utf8')),
      resolution: JSON.parse(fs.readFileSync(path.resolve(ROOT, runPin.resolution.path), 'utf8')),
    };
    for (const entry of run.resolution.resolved) {
      const preview = previewClaimSection({ run, resolved_entry: entry });
      assert.equal(preview.section.id, 'consideration-hero');
      assert.ok(preview.rows.some((row) => row.cells.some((cell) => String(cell.text || '').trim())));
      const matches = preview.rows.filter((row) => row.matches_claim_key);
      assert.equal(matches.length, 1);
      assert.equal(matches[0].id, expectedRow[entry.resolved_claim_definition_key]);
    }
  }
});

test('the governed exchange-ratio claim binds only the exchange-ratio row', () => {
  const runRoot = path.join(ROOT, 'evidence/canonical-v2/modiv-consideration-20260809-2xk-r2');
  const run = {
    manifest: JSON.parse(fs.readFileSync(path.join(runRoot, 'run-manifest.json'), 'utf8')),
    resolution: JSON.parse(fs.readFileSync(path.join(runRoot, 'resolution.json'), 'utf8')),
  };
  const entry = run.resolution.resolved.find(
    (candidate) => candidate.resolved_claim_definition_key === 'EXCHANGE_RATIO_VALUE',
  );
  assert.ok(entry);
  const preview = previewClaimSection({ run, resolved_entry: entry });
  assert.deepEqual(
    preview.rows.filter((row) => row.matches_claim_key).map((row) => row.id),
    ['consideration-hero-exchangeRatio'],
  );
  assert.equal(
    preview.rows.find((row) => row.id === 'consideration-hero-headline').matches_claim_key,
    false,
  );
});

test('projection refuses missing claim identity, source text, or evidence', () => {
  const source = considerationRuns()[0].resolution.resolved[0];
  for (const field of ['claim_revision_id', 'raw_value', 'evidence']) {
    const entry = JSON.parse(JSON.stringify(source));
    entry.claim[field] = field === 'evidence' ? [] : '';
    assert.throws(
      () => projectConsiderationWaveAClaims({ resolved_entries: [entry] }),
      (error) => error?.code === 'INVALID_CLAIM_SOURCE',
      field,
    );
  }
});

test('the full Skechers run refuses conflicting product fields even though their claim ids differ', () => {
  const run = considerationRuns().find(({ resolution }) => (
    resolution.resolved.filter(
      (entry) => entry.resolved_claim_definition_key === 'PER_SHARE_CASH_CONSIDERATION',
    ).length > 1
  ));
  assert.ok(run);
  const cashClaims = run.resolution.resolved.filter(
    (entry) => entry.resolved_claim_definition_key === 'PER_SHARE_CASH_CONSIDERATION',
  );
  assert.equal(new Set(cashClaims.map((entry) => entry.claim.claim_revision_id)).size, 2);
  assert.equal(new Set(cashClaims.map((entry) => entry.claim.canonical_value)).size, 2);
  assert.equal(new Set(cashClaims.map((entry) => entry.provision_instance.provision_instance_id)).size, 1);
  assert.throws(
    () => projectConsiderationWaveAClaims({ resolved_entries: run.resolution.resolved }),
    (error) => error?.code === 'DUPLICATE_PRODUCT_FIELD',
  );
});

test('a consideration row binds to its source claim and not a different claim with the same feature', () => {
  const run = considerationRuns().find(({ resolution }) => (
    resolution.resolved.filter(
      (entry) => entry.resolved_claim_definition_key === 'PER_SHARE_CASH_CONSIDERATION',
    ).length > 1
  ));
  assert.ok(run);
  const projections = run.resolution.resolved.map(projectionForEntry);
  const projection = { cards: projections.flatMap((item) => item.cards) };
  const cashCards = projection.cards.filter((card) => Object.hasOwn(card.features, 'perShareAmount'));
  assert.ok(cashCards.length > 1);
  const config = loadTableConfig(
    'components/review/table-configs/consideration-hero.config.js',
    'considerationHeroConfig',
  );
  const reviewDeal = toReviewDeal(run.deal, projection.cards);
  const row = config.selectRows(reviewDeal).find((candidate) => candidate.featureKey === 'perShareAmount');
  assert.ok(row?.sourceCard);
  const boundCard = cashCards.find((card) => card.id === row.sourceCard.id);
  const differentCard = cashCards.find((card) => card.id !== row.sourceCard.id);
  assert.ok(boundCard);
  assert.ok(differentCard);

  const boundPreview = previewReviewDealRow({
    family_id: 'CONSIDERATION',
    review_deal: reviewDeal,
    target_card_id: boundCard.id,
  });
  assert.equal(boundPreview.row.id, 'consideration-hero-per-share');
  assert.throws(
    () => previewReviewDealRow({
      family_id: 'CONSIDERATION',
      review_deal: reviewDeal,
      target_card_id: differentCard.id,
    }),
    (error) => error?.code === 'CLAIM_FEATURE_ROW_MISSING',
  );

  const differentPreview = previewReviewDealRow({
    family_id: 'CONSIDERATION',
    review_deal: toReviewDeal(run.deal, [differentCard]),
    target_card_id: differentCard.id,
  });
  assert.equal(differentPreview.row.id, 'consideration-hero-per-share');
});
