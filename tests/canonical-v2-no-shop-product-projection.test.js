'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const {
  CLAIM_TO_CONCEPTS,
  NATIVE_SOURCE,
  NoShopProductProjectionError,
  projectNoShopProductSurfaces,
} = require('../lib/canonical-v2/no-shop-product-projection');
const { previewClaimSection } = require('../lib/review-parity/rendered-row-preview');

const ROOT = path.resolve(__dirname, '..');

const FIXTURES = Object.freeze({
  NO_SHOP_PROHIBITED_ACTION: Object.freeze({ value: 'SOLICIT_ACQUISITION_INQUIRY_PROPOSAL_OR_OFFER', quote: 'The Company shall not solicit any Acquisition Proposal.' }),
  NO_SHOP_EXCEPTION_PREREQUISITE: Object.freeze({ value: 'BONA_FIDE_UNSOLICITED_WRITTEN_PROPOSAL_RECEIVED', quote: 'a bona fide unsolicited written Acquisition Proposal', attributes: Object.freeze({ permitted_action_context: 'furnish information and engage in discussions' }) }),
  NO_SHOP_NOTICE_PERIOD_DAYS: Object.freeze({ value: '2', quote: 'two business days after receipt of an Acquisition Proposal', attributes: Object.freeze({ day_kind: 'BUSINESS_DAYS' }) }),
  NO_SHOP_INITIAL_MATCH_PERIOD_DAYS: Object.freeze({ value: '4', quote: 'four business days before changing its recommendation', attributes: Object.freeze({ day_kind: 'BUSINESS_DAYS' }) }),
  NO_SHOP_SUBSEQUENT_MATCH_PERIOD_DAYS: Object.freeze({ value: '2', quote: 'two business days after a material amendment', attributes: Object.freeze({ day_kind: 'BUSINESS_DAYS' }) }),
  NO_SHOP_CEASE_ACTION: Object.freeze({ value: 'CEASE_EXISTING_DISCUSSIONS_OR_NEGOTIATIONS', quote: 'The Company shall immediately cease all discussions and negotiations.' }),
  NO_SHOP_REPRESENTATIVE_CONTROL_STANDARD: Object.freeze({ value: 'INSTRUCT_NOT_TO', quote: 'The Company shall instruct its Representatives not to solicit.' }),
  NO_SHOP_REPRESENTATIVE_BREACH_ATTRIBUTION: Object.freeze({ value: true, quote: 'Any breach by a Representative shall be deemed a breach by the Company.' }),
  NO_SHOP_STANDSTILL_ACTION: Object.freeze({ value: 'NO_WAIVER_RELEASE_OR_MODIFICATION', quote: 'The Company shall not waive or release any standstill provision.' }),
  NO_SHOP_FIDUCIARY_ENGAGEMENT_STANDARD: Object.freeze({ value: 'COULD_REASONABLY_BE_EXPECTED_TO_LEAD', quote: 'could reasonably be expected to lead to a Superior Proposal' }),
  NO_SHOP_RECOMMENDATION_CHANGE_FIDUCIARY_STANDARD: Object.freeze({ value: 'INCONSISTENT_WITH_FIDUCIARY_DUTIES', quote: 'failure to act would be inconsistent with its fiduciary duties' }),
  NO_SHOP_RECOMMENDATION_CHANGE_ACTION: Object.freeze({ value: 'WITHDRAW_QUALIFY_OR_MODIFY_RECOMMENDATION', quote: 'withdraw, qualify or modify the Company Recommendation' }),
  NO_SHOP_RECOMMENDATION_CHANGE_TRIGGER: Object.freeze({ value: 'SUPERIOR_PROPOSAL', quote: 'make a Change of Recommendation in response to a Superior Proposal' }),
  NO_SHOP_RECOMMENDATION_SAFE_DISCLOSURE: Object.freeze({ value: 'STOP_LOOK_AND_LISTEN', quote: 'make a stop, look and listen communication under Rule 14d-9(f)' }),
});

function entry(key, { suffix = key.toLowerCase(), conceptKey = CLAIM_TO_CONCEPTS[key]?.[0], claim = {}, entry: entryOverrides = {} } = {}) {
  const fixture = FIXTURES[key] || { value: 'UNKNOWN', quote: 'unknown claim' };
  const provisionId = `provision-${suffix}`;
  const party = { role: 'COVENANT_OBLIGOR', value: 'the Company', capacity: 'TARGET' };
  return {
    resolved_claim_definition_key: key,
    concept_key: conceptKey,
    section_reference: 'Section 5.3',
    party,
    provision_instance: {
      schema_version: 'PROVISION_INSTANCE/V1',
      provision_instance_id: provisionId,
      party,
    },
    claim: {
      schema_version: 'CLAIM/V1',
      claim_revision_id: `claim-${suffix}`,
      subject_occurrence_id: provisionId,
      claim_definition_key: key,
      state: 'PRESENT',
      canonical_value: fixture.value,
      raw_value: fixture.quote,
      evidence: [{ absolute_start: 0, absolute_end: Buffer.byteLength(fixture.quote, 'utf8') }],
      attributes: { ...(fixture.attributes || {}) },
      ...claim,
    },
    ...entryOverrides,
  };
}

function projectionError(code) {
  return (error) => error instanceof NoShopProductProjectionError && error.code === code;
}

test('all governed No-Shop claims map to native nosol cards with exact values and claim lineage', () => {
  const projection = projectNoShopProductSurfaces({
    deal_id: 'deal:test-no-shop',
    resolution: { resolved: Object.keys(FIXTURES).map((key) => entry(key)) },
  });
  assert.equal(projection.source, NATIVE_SOURCE);
  assert.equal(projection.cards.length, Object.keys(FIXTURES).length);
  assert.ok(projection.cards.every((card) => card.provision_type === 'COVENANT_NO_SOLICITATION'));
  assert.ok(projection.cards.every((card) => card.canonical_v2_lineage.claim_revision_ids.length === 1));
  for (const [key, fixture] of Object.entries(FIXTURES)) {
    const claims = projection.claims.filter((claim) => claim.provenance.source_claim_definition_key === key);
    assert.ok(claims.length > 0, key);
    assert.ok(claims.every((claim) => claim.provenance.source_canonical_value === fixture.value));
    assert.ok(claims.every((claim) => claim.evidence_quote === fixture.quote));
  }
  const prohibited = projection.cards.find((card) => card.provision_subtype === 'NOSOL-PROHIBIT');
  assert.equal(prohibited.features.ceaseDiscussionsProhibitedList[0].code, FIXTURES.NO_SHOP_PROHIBITED_ACTION.value);
  assert.equal(prohibited.features.ceaseDiscussionsProhibitedList[0].text, FIXTURES.NO_SHOP_PROHIBITED_ACTION.quote);
  const exception = projection.cards.find((card) => card.provision_subtype === 'NOSOL-EXCEPT'
    && card.features.ceaseDiscussionsExceptions);
  assert.equal(exception.features.ceaseDiscussionsExceptions[0].permitted_action_context, 'furnish information and engage in discussions');
  const initial = projection.cards.find((card) => card.provision_subtype === 'NOSOL-MATCH');
  assert.equal(initial.features.initialMatchPeriodDays, 4);
  assert.equal(initial.features.matchingPeriod, 4);
  const initialClaim = projection.claims.find((claim) => (
    claim.provenance.source_claim_definition_key === 'NO_SHOP_INITIAL_MATCH_PERIOD_DAYS'
  ));
  assert.equal(initialClaim.provenance.source_claim_attributes.day_kind, 'BUSINESS_DAYS');
});

test('claims on one governed provision merge into one card without losing claim lineage', () => {
  const cease = entry('NO_SHOP_CEASE_ACTION', { suffix: 'shared-cease' });
  const control = entry('NO_SHOP_REPRESENTATIVE_CONTROL_STANDARD', { suffix: 'shared-cease', claim: { claim_revision_id: 'claim-shared-control' } });
  const attribution = entry('NO_SHOP_REPRESENTATIVE_BREACH_ATTRIBUTION', { suffix: 'shared-cease', claim: { claim_revision_id: 'claim-shared-attribution' } });
  const projection = projectNoShopProductSurfaces({
    deal_id: 'deal:shared-cease',
    resolution: { resolved: [cease, control, attribution] },
  });
  assert.equal(projection.cards.length, 1);
  const card = projection.cards[0];
  assert.deepEqual(card.canonical_v2_lineage.claim_revision_ids, [
    'claim-shared-attribution',
    'claim-shared-cease',
    'claim-shared-control',
  ]);
  assert.equal(card.features.ceaseDiscussionsProhibitedList[0].code, 'CEASE_EXISTING_DISCUSSIONS_OR_NEGOTIATIONS');
  assert.equal(card.features.representativesStandard, 'INSTRUCT_NOT_TO');
  assert.equal(card.features.representativeBreachIsCompanyBreach, true);
  assert.match(card.primary_quote, /cease all discussions/);
  assert.match(card.primary_quote, /deemed a breach/);
});

test('projected cards satisfy the existing nosol section selectors without the reviewed Landos adapter', async () => {
  const { buildGroups, nosolSectionConfig } = await import(path.join('..', 'components', 'review', 'table-configs', 'nosol-section.config.js'));
  const entries = [
    entry('NO_SHOP_PROHIBITED_ACTION'),
    entry('NO_SHOP_CEASE_ACTION'),
    entry('NO_SHOP_EXCEPTION_PREREQUISITE'),
    entry('NO_SHOP_STANDSTILL_ACTION'),
    entry('NO_SHOP_INITIAL_MATCH_PERIOD_DAYS'),
    entry('NO_SHOP_SUBSEQUENT_MATCH_PERIOD_DAYS'),
    entry('NO_SHOP_RECOMMENDATION_CHANGE_ACTION'),
  ];
  const projection = projectNoShopProductSurfaces({ deal_id: 'deal:config', resolution: { resolved: entries } });
  assert.equal(nosolSectionConfig.selectRows({ cards: projection.cards }).length, 1);
  const groups = buildGroups({ cards: projection.cards });
  const rowIds = groups.flatMap((group) => group.rows.map((row) => row.id));
  for (const rowId of [
    'nosol-noshop-cease',
    'nosol-noshop-prohibit',
    'nosol-noshop-exceptions',
    'nosol-noshop-standstill-enforce',
    'nosol-fiduciary-initial-match',
    'nosol-fiduciary-subsequent-match',
    'nosol-fiduciary-change-of-rec-items',
  ]) assert.ok(rowIds.includes(rowId), rowId);
});

test('projection rejects absent legal ownership, invalid governed values and broken claim lineage', () => {
  assert.throws(
    () => projectNoShopProductSurfaces({ deal_id: 'deal:wrong-concept', resolution: { resolved: [entry('NO_SHOP_CEASE_ACTION', { conceptKey: 'NOSOL-PROHIBIT' })] } }),
    projectionError('CONCEPT_OWNERSHIP_MISMATCH'),
  );
  assert.throws(
    () => projectNoShopProductSurfaces({ deal_id: 'deal:bad-value', resolution: { resolved: [entry('NO_SHOP_INITIAL_MATCH_PERIOD_DAYS', { claim: { canonical_value: '-1' } })] } }),
    projectionError('INVALID_GOVERNED_CLAIM'),
  );
  assert.throws(
    () => projectNoShopProductSurfaces({ deal_id: 'deal:bad-lineage', resolution: { resolved: [entry('NO_SHOP_PROHIBITED_ACTION', { claim: { subject_occurrence_id: 'other-provision' } })] } }),
    projectionError('INVALID_PROVISION_BINDING'),
  );
  assert.throws(
    () => projectNoShopProductSurfaces({ deal_id: 'deal:unmapped', resolution: { resolved: [entry('NO_SHOP_COPY_DELIVERY_PERIOD_DAYS')] } }),
    projectionError('UNGOVERNED_NO_SHOP_CLAIM'),
  );
});

test('Skechers recommendation-change trigger renders through the Intervening Event row', () => {
  const manifest = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'evidence/canonical-v2/stage-2y-cd-baseline-manifest.json'),
    'utf8',
  ));
  const pin = manifest.runs.find((run) => run.family === 'NO_SHOP' && run.deal === 'skechers');
  assert.ok(pin);
  const run = {
    manifest: JSON.parse(fs.readFileSync(path.resolve(ROOT, pin.run_manifest.path), 'utf8')),
    resolution: JSON.parse(fs.readFileSync(path.resolve(ROOT, pin.resolution.path), 'utf8')),
  };
  const resolvedEntry = run.resolution.resolved.find((candidate) => (
    candidate.claim.claim_revision_id === '9d47df05490185fbf8094acfe34c8c193addc2fe5a8a788487e77424cdd341fb'
  ));
  assert.ok(resolvedEntry);

  const preview = previewClaimSection({ run, resolved_entry: resolvedEntry });

  assert.equal(preview.section.id, 'nosol');
  assert.equal(preview.row_count, 1);
  assert.equal(preview.rows[0].id, 'nosol-section-body');
  assert.match(
    preview.rows[0].cells.map((cell) => cell.text).join(' '),
    /Intervening Event provision/,
  );
  assert.match(
    preview.rows[0].cells.map((cell) => cell.text).join(' '),
    /material event or development or material change in circumstances/,
  );
});

test('all pinned No-Shop claims reach a content row', () => {
  const manifest = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'evidence/canonical-v2/stage-2y-cd-baseline-manifest.json'),
    'utf8',
  ));
  const pins = manifest.runs.filter((run) => run.family === 'NO_SHOP');
  assert.ok(pins.length > 0);
  const failures = [];
  for (const pin of pins) {
    const run = {
      manifest: JSON.parse(fs.readFileSync(path.resolve(ROOT, pin.run_manifest.path), 'utf8')),
      resolution: JSON.parse(fs.readFileSync(path.resolve(ROOT, pin.resolution.path), 'utf8')),
    };
    for (const entry of run.resolution.resolved) {
      try {
        const preview = previewClaimSection({ run, resolved_entry: entry });
        assert.equal(preview.section.id, 'nosol');
        assert.ok(preview.rows.some((row) => row.cells.some((cell) => String(cell.text || '').trim())));
      } catch (error) {
        failures.push({
          deal: pin.deal,
          definition: entry.resolved_claim_definition_key,
          claim_revision_id: entry.claim.claim_revision_id,
          code: error.code,
        });
      }
    }
  }
  assert.deepEqual(failures, []);
});
