// Proves the 2026-08-05 programme-wide ruling (Ben): excerpt_id is not a
// unique card identity. Card/claim identity must bind on deal_id +
// provision_instance_id + excerpt_id (+ attribute where a claim can be one
// of several on the same provision), not on excerpt_id alone or
// deal_id|excerpt_id.
//
// For each of the five fixed paths this proves, in pairs:
//   (a) with unique excerpt_ids (today's corpus shape, DB-enforced), the
//       fixed keying resolves IDENTICALLY to the old excerpt_id-only
//       keying -- a no-op on today's data.
//   (b) with two sibling cards sharing ONE excerpt_id but differing
//       provision_instance_id (Ben's example: a non-reliance
//       acknowledgment and its auto-derived sibling quoting the same
//       sentence; several representation-qualifier cards on one
//       provision), each card resolves ONLY its own claims/evidence --
//       neither silently inherits the other's data, and neither is
//       dropped by a dedupe pass.
//
// Fixed paths covered:
//   1. lib/queries/claims-adapter.js claimsForCard() + its consumer
//      lib/queries/review-deal.js normalizeCard()/shapeReviewDealRows()
//   2. lib/row-market-stats/observations.js indexDataset()/cardForClaim()
//      via the exported claimMatchesScope()/buildMetricEntries() surface
//   3. lib/row-market-stats/source.js loadMarketDataset()'s dedupe(cards)
//      and dedupe(claims)
//   4. lib/queries/corpus-stats-core.js cardIdForClaim()/buildCorpusBase()
//   5. lib/queries/corpus-duration.js linkedEvidenceForClaim()
//      (via selectDurationCohort())

const test = require('node:test');
const assert = require('node:assert/strict');

const { claimsForCard, groupClaimsByExcerpt } = require('../lib/queries/claims-adapter');
const { shapeReviewDealRows } = require('../lib/queries/review-deal');
const { indexDataset, claimMatchesScope, buildMetricEntries } = require('../lib/row-market-stats/observations');
const { loadMarketDataset } = require('../lib/row-market-stats/source');
const { buildCorpusBase, cardIdForClaim } = require('../lib/queries/corpus-stats-core');
const { linkedEvidenceForClaim, normalizeDurationClaim, selectDurationCohort } = require('../lib/queries/corpus-duration');
const { QXO_5_2_TEXT } = require('./fixtures/qxo-section-5-2');

// ---------------------------------------------------------------------
// 1. claims-adapter.js claimsForCard() + review-deal.js normalizeCard()
// ---------------------------------------------------------------------

function card(overrides = {}) {
  return {
    id: overrides.id || 'row-1',
    deal_id: 'deal-1',
    provision_instance_id: overrides.provision_instance_id || overrides.id || 'card-1',
    excerpt_id: overrides.excerpt_id || `${overrides.provision_instance_id || overrides.id || 'card-1'}:0`,
    section_ref: overrides.section_ref || 'Section 1.01',
    short_title: overrides.short_title || 'Test card',
    kind: overrides.kind || 'standard',
    defined_term: null,
    defined_value: null,
    references: [],
    ...overrides,
  };
}

test('claimsForCard: (a) unique excerpt_ids -- identical to the old excerpt_id-only lookup', () => {
  const cardA = card({ id: 'card-a', provision_instance_id: 'pi-a' });
  const cardB = card({ id: 'card-b', provision_instance_id: 'pi-b' });
  const claims = [
    { excerpt_id: cardA.excerpt_id, provision_instance_id: 'pi-a', attribute: 'feature', verbatim: 'A' },
    { excerpt_id: cardB.excerpt_id, provision_instance_id: 'pi-b', attribute: 'feature', verbatim: 'B' },
  ];
  const claimsByExcerpt = groupClaimsByExcerpt(claims);
  assert.deepEqual(claimsForCard(claimsByExcerpt, cardA), [claims[0]]);
  assert.deepEqual(claimsForCard(claimsByExcerpt, cardB), [claims[1]]);
});

test('claimsForCard: (b) two sibling cards sharing one excerpt_id, differing provision_instance_id -- each gets only its own claims', () => {
  const SHARED_EXCERPT = 'shared-excerpt:0';
  const cardA = card({ id: 'card-a', provision_instance_id: 'pi-a', excerpt_id: SHARED_EXCERPT });
  const cardB = card({ id: 'card-b', provision_instance_id: 'pi-b', excerpt_id: SHARED_EXCERPT });
  const claimA = { excerpt_id: SHARED_EXCERPT, provision_instance_id: 'pi-a', attribute: 'feature', verbatim: 'A-only' };
  const claimB = { excerpt_id: SHARED_EXCERPT, provision_instance_id: 'pi-b', attribute: 'feature', verbatim: 'B-only' };
  const claimsByExcerpt = groupClaimsByExcerpt([claimA, claimB]);

  // Sanity: the excerpt_id bucket itself DOES hold both siblings' claims
  // mixed together (groupClaimsByExcerpt is unchanged) -- claimsForCard is
  // what disambiguates them, not the bucket.
  assert.equal(claimsByExcerpt.get(SHARED_EXCERPT).length, 2);

  assert.deepEqual(claimsForCard(claimsByExcerpt, cardA), [claimA], 'card A must not inherit card B\'s claim');
  assert.deepEqual(claimsForCard(claimsByExcerpt, cardB), [claimB], 'card B must not inherit card A\'s claim');
});

test('claimsForCard: a claim with no provision_instance_id is kept, not dropped, for a single-card excerpt bucket', () => {
  const cardA = card({ id: 'card-a', provision_instance_id: 'pi-a' });
  const claim = { excerpt_id: cardA.excerpt_id, attribute: 'feature', verbatim: 'legacy row' }; // no provision_instance_id
  const claimsByExcerpt = groupClaimsByExcerpt([claim]);
  assert.deepEqual(claimsForCard(claimsByExcerpt, cardA), [claim]);
});

test('shapeReviewDealRows end-to-end: sibling cards sharing an excerpt_id each render only their own features, never merged', () => {
  const SHARED_EXCERPT = 'shared-excerpt:0';
  const nonReliance = card({
    id: 'non-reliance', provision_instance_id: 'non-reliance', excerpt_id: SHARED_EXCERPT,
    short_title: 'Non-Reliance Acknowledgment',
  });
  const autoSibling = card({
    id: 'auto-sibling', provision_instance_id: 'auto-sibling', excerpt_id: SHARED_EXCERPT,
    short_title: 'Non-Reliance Acknowledgment (auto)',
  });
  const claims = [
    { excerpt_id: SHARED_EXCERPT, provision_instance_id: 'non-reliance', attribute: 'noOtherRepsParty', canonical: 'COMPANY', verbatim: 'Company' },
    { excerpt_id: SHARED_EXCERPT, provision_instance_id: 'auto-sibling', attribute: 'noOtherRepsParty', canonical: 'PARENT', verbatim: 'Parent' },
  ];
  const shaped = shapeReviewDealRows('deal-1', [nonReliance, autoSibling], { claims });
  const primary = shaped.cards.find((c) => c.provision_instance_id === 'non-reliance');
  const sibling = shaped.cards.find((c) => c.provision_instance_id === 'auto-sibling');
  assert.equal(primary.features.noOtherRepsParty.code, 'COMPANY', 'card A renders only its own claim');
  assert.equal(sibling.features.noOtherRepsParty.code, 'PARENT', 'card B renders only its own claim, not A\'s');
});

// ---------------------------------------------------------------------
// 2. row-market-stats/observations.js indexDataset()/cardForClaim()
//    (exercised through the exported claimMatchesScope/buildMetricEntries)
// ---------------------------------------------------------------------

function deal(id) {
  return { id, acquirer: `Buyer ${id}`, target: `Target ${id}`, sector: 'Tech', announce_date: '2026-01-01', value_usd: 1e9, metadata: {} };
}

function metricSpec(overrides = {}) {
  return {
    contractVersion: 1,
    rowKey: 'row-1',
    metricKey: 'row-1.value',
    label: 'Metric',
    comparison: { status: 'comparable', kind: 'categorical' },
    cohort: { scope: 'all_deals', eligibility: 'all_deals' },
    observation: {
      presence: { strategy: 'feature_non_empty', featureKeys: ['siblingFeature'], missingState: 'absent' },
      value: { strategy: 'feature_value', featureKeys: ['siblingFeature'] },
    },
    denominator: { prevalence: 'eligible_deals', distribution: 'present_deals' },
    ...overrides,
  };
}

test('observations.js buildMetricEntries: (a) unique excerpt_ids -- each claim resolves its own card id, as before', () => {
  const cardA = { id: 'card-a', deal_id: 'd1', excerpt_id: 'excerpt-a', provision_instance_id: 'pi-a', provision_type: 'COVENANT', provision_subtype: 'COV-A' };
  const cardB = { id: 'card-b', deal_id: 'd1', excerpt_id: 'excerpt-b', provision_instance_id: 'pi-b', provision_type: 'COVENANT', provision_subtype: 'COV-B' };
  const claimA = { id: 'claim-a', deal_id: 'd1', excerpt_id: 'excerpt-a', provision_instance_id: 'pi-a', attribute: 'siblingFeature', canonical: 'ALPHA', evidence_quote: null, provenance: {} };
  const claimB = { id: 'claim-b', deal_id: 'd1', excerpt_id: 'excerpt-b', provision_instance_id: 'pi-b', attribute: 'siblingFeature', canonical: 'BETA', evidence_quote: null, provenance: {} };
  const index = indexDataset({ deals: [deal('d1')], cards: [cardA, cardB], claims: [claimA, claimB] });
  const entries = buildMetricEntries(metricSpec(), index, {});
  const values = entries.find((entry) => entry.dealId === 'd1').values;
  assert.deepEqual(values.map((v) => [v.value, v.cardId]).sort(), [['ALPHA', 'card-a'], ['BETA', 'card-b']]);
});

test('observations.js buildMetricEntries: (b) two sibling cards sharing one excerpt_id -- each claim resolves ONLY its own card id, never conflated', () => {
  const SHARED_EXCERPT = 'shared-excerpt';
  const cardA = { id: 'card-a', deal_id: 'd1', excerpt_id: SHARED_EXCERPT, provision_instance_id: 'pi-a', provision_type: 'COVENANT', provision_subtype: 'COV-A' };
  const cardB = { id: 'card-b', deal_id: 'd1', excerpt_id: SHARED_EXCERPT, provision_instance_id: 'pi-b', provision_type: 'COVENANT', provision_subtype: 'COV-B' };
  const claimA = { id: 'claim-a', deal_id: 'd1', excerpt_id: SHARED_EXCERPT, provision_instance_id: 'pi-a', attribute: 'siblingFeature', canonical: 'ALPHA', evidence_quote: null, provenance: {} };
  const claimB = { id: 'claim-b', deal_id: 'd1', excerpt_id: SHARED_EXCERPT, provision_instance_id: 'pi-b', attribute: 'siblingFeature', canonical: 'BETA', evidence_quote: null, provenance: {} };
  const index = indexDataset({ deals: [deal('d1')], cards: [cardA, cardB], claims: [claimA, claimB] });

  // claimMatchesScope + a provision_codes cohort scoped to ONLY card A's
  // code must resolve card A for claim A and never accidentally admit
  // claim B via the shared excerpt_id.
  const specA = metricSpec({ cohort: { scope: 'provision_codes', eligibility: 'code_present', provisionCodes: ['COV-A'] } });
  assert.equal(claimMatchesScope(claimA, specA, index), true);
  assert.equal(claimMatchesScope(claimB, specA, index), false, 'claim B must not match a cohort scoped to card A\'s code');

  const entries = buildMetricEntries(metricSpec(), index, {});
  const values = entries.find((entry) => entry.dealId === 'd1').values;
  assert.deepEqual(values.map((v) => [v.value, v.cardId]).sort(), [['ALPHA', 'card-a'], ['BETA', 'card-b']],
    'each sibling claim\'s cardId points at its OWN card, not whichever card the shared excerpt_id happened to resolve to first');
});

test('observations.js indexDataset: a recovered bring-down claim carries its own card\'s provision_instance_id, so it resolves back to that card even if a sibling shares its excerpt_id', () => {
  const SHARED_EXCERPT = 'shared-excerpt';
  const closingCondition = {
    id: 'cond-card', deal_id: 'd1', excerpt_id: SHARED_EXCERPT, provision_instance_id: 'pi-cond',
    provision_type: 'CLOSING_CONDITION', provision_subtype: 'COND-B-MAE',
    primary_quote: QXO_5_2_TEXT,
  };
  // A sibling card at the SAME excerpt_id (e.g. an adjacent recital) that
  // must not receive the recovered claim.
  const sibling = { id: 'sibling-card', deal_id: 'd1', excerpt_id: SHARED_EXCERPT, provision_instance_id: 'pi-sibling', provision_type: 'RECITAL', provision_subtype: null };
  const index = indexDataset({ deals: [deal('d1')], cards: [closingCondition, sibling], claims: [] });
  const recovered = index.claims.filter((claim) => claim.attribute === 'bringDownTiers');
  assert.ok(recovered.length > 0, 'sanity: the bundled text recovers at least one bring-down claim');
  assert.ok(recovered.every((claim) => claim.provision_instance_id === 'pi-cond'),
    'every recovered claim must carry the CLOSING_CONDITION card\'s own provision_instance_id, not the sibling\'s');
});

// ---------------------------------------------------------------------
// 3. row-market-stats/source.js loadMarketDataset()'s dedupe(cards)/dedupe(claims)
// ---------------------------------------------------------------------

function fakeSupabase(rows) {
  return {
    from(table) {
      const query = {
        select() { return query; },
        in() { return query; },
        order() { return query; },
        range() { return Promise.resolve({ data: rows[table] || [], error: null }); },
      };
      return query;
    },
  };
}

function familySpec(family, featureKeys) {
  return {
    contractVersion: 1,
    rowKey: 'row-1',
    metricKey: 'row-1.value',
    label: 'Metric',
    comparison: { status: 'comparable', kind: 'categorical' },
    cohort: { scope: 'provision_family', eligibility: 'family_present', provisionFamily: family },
    observation: {
      presence: { strategy: 'feature_non_empty', featureKeys, missingState: 'absent' },
      value: { strategy: 'feature_value', featureKeys },
    },
    denominator: { prevalence: 'eligible_deals', distribution: 'present_deals' },
  };
}

test('source.js dedupe(cards): (a) unique excerpt_ids -- an exact re-fetch of the same card still collapses to one row', async () => {
  const cardA = { id: 'card-a', deal_id: 'd1', excerpt_id: 'excerpt-a', provision_instance_id: 'pi-a', provision_type: 'COVENANT_NO_SOLICITATION', provision_subtype: 'NOSOL-MATCH' };
  const rows = { deals: [deal('d1')], provision_cards: [cardA, { ...cardA }], claims: [] };
  const dataset = await loadMarketDataset(fakeSupabase(rows), [familySpec('NOSOL', ['feature'])]);
  assert.equal(dataset.cards.length, 1, 'the exact duplicate fetch of the same card collapses to one row, as before');
});

test('source.js dedupe(cards): (b) two sibling cards sharing one excerpt_id, same provision_type/subtype, differing provision_instance_id -- BOTH survive, neither silently dropped', async () => {
  const SHARED_EXCERPT = 'shared-excerpt';
  const cardA = { id: 'card-a', deal_id: 'd1', excerpt_id: SHARED_EXCERPT, provision_instance_id: 'pi-a', provision_type: 'COVENANT_NO_SOLICITATION', provision_subtype: 'NOSOL-MATCH' };
  const cardB = { id: 'card-b', deal_id: 'd1', excerpt_id: SHARED_EXCERPT, provision_instance_id: 'pi-b', provision_type: 'COVENANT_NO_SOLICITATION', provision_subtype: 'NOSOL-MATCH' };
  // Under the OLD key (deal_id|excerpt_id|provision_type|provision_subtype)
  // these two rows are BYTE-IDENTICAL keys and the second would have been
  // silently dropped as a "duplicate".
  const rows = { deals: [deal('d1')], provision_cards: [cardA, cardB], claims: [] };
  const dataset = await loadMarketDataset(fakeSupabase(rows), [familySpec('NOSOL', ['feature'])]);
  assert.deepEqual(dataset.cards.map((c) => c.id).sort(), ['card-a', 'card-b'],
    'both sibling cards must survive dedupe -- neither is a "duplicate" of the other');
});

test('source.js dedupe(claims): (b) two sibling auto-derived claims with identical attribute/canonical/verbatim, differing only provision_instance_id -- BOTH survive, neither silently dropped', async () => {
  const SHARED_EXCERPT = 'shared-excerpt';
  // Ben's example: a non-reliance acknowledgment and its auto-derived
  // sibling quote the SAME sentence -- identical attribute/canonical/
  // verbatim, no `id` (forcing the fallback composite key), distinguished
  // ONLY by provision_instance_id.
  const claimA = { deal_id: 'd1', excerpt_id: SHARED_EXCERPT, provision_instance_id: 'pi-a', attribute: 'noOtherRepsAcknowledgment', canonical: null, verbatim: 'Company acknowledges no other representations.', evidence_quote: null, provenance: {} };
  const claimB = { deal_id: 'd1', excerpt_id: SHARED_EXCERPT, provision_instance_id: 'pi-b', attribute: 'noOtherRepsAcknowledgment', canonical: null, verbatim: 'Company acknowledges no other representations.', evidence_quote: null, provenance: {} };
  const rows = { deals: [deal('d1')], provision_cards: [], claims: [claimA, claimB] };
  const dataset = await loadMarketDataset(fakeSupabase(rows), [familySpec('NOSOL', ['noOtherRepsAcknowledgment'])]);
  assert.equal(dataset.claims.length, 2,
    'both sibling claims must survive dedupe -- an identical-text auto-derived sibling is not a "duplicate" of its source claim');
});

// ---------------------------------------------------------------------
// 4. queries/corpus-stats-core.js cardIdForClaim()/buildCorpusBase()
// ---------------------------------------------------------------------

test('corpus-stats-core cardIdForClaim: (a) unique excerpt_ids -- resolves identically to the old deal_id|excerpt_id key', () => {
  const cards = [
    { id: 'card-a', deal_id: 'd1', excerpt_id: 'excerpt-a', provision_instance_id: 'pi-a' },
    { id: 'card-b', deal_id: 'd1', excerpt_id: 'excerpt-b', provision_instance_id: 'pi-b' },
  ];
  const base = buildCorpusBase({ deals: [deal('d1')], cards, subjectDealId: null, filters: {} });
  assert.equal(cardIdForClaim({ deal_id: 'd1', excerpt_id: 'excerpt-a', provision_instance_id: 'pi-a' }, base.cardIdByKey), 'card-a');
  assert.equal(cardIdForClaim({ deal_id: 'd1', excerpt_id: 'excerpt-b', provision_instance_id: 'pi-b' }, base.cardIdByKey), 'card-b');
});

test('corpus-stats-core cardIdForClaim: (b) two sibling cards sharing one excerpt_id -- each claim resolves ONLY its own card id', () => {
  const SHARED_EXCERPT = 'shared-excerpt';
  const cards = [
    { id: 'card-a', deal_id: 'd1', excerpt_id: SHARED_EXCERPT, provision_instance_id: 'pi-a' },
    { id: 'card-b', deal_id: 'd1', excerpt_id: SHARED_EXCERPT, provision_instance_id: 'pi-b' },
  ];
  const base = buildCorpusBase({ deals: [deal('d1')], cards, subjectDealId: null, filters: {} });
  const claimA = { deal_id: 'd1', excerpt_id: SHARED_EXCERPT, provision_instance_id: 'pi-a' };
  const claimB = { deal_id: 'd1', excerpt_id: SHARED_EXCERPT, provision_instance_id: 'pi-b' };
  assert.equal(cardIdForClaim(claimA, base.cardIdByKey), 'card-a');
  assert.equal(cardIdForClaim(claimB, base.cardIdByKey), 'card-b');
});

test('corpus-stats-core cardIdForClaim: falls back to the legacy deal_id|excerpt_id key for a caller/claim that predates provision_instance_id (e.g. tests/query/relative-periods.test.js\'s hand-built fixture)', () => {
  const legacyCardIdByKey = new Map([['d1|only-excerpt', 'legacy-card']]);
  const claimWithNoProvisionInstanceId = { deal_id: 'd1', excerpt_id: 'only-excerpt' };
  assert.equal(cardIdForClaim(claimWithNoProvisionInstanceId, legacyCardIdByKey), 'legacy-card');
});

// ---------------------------------------------------------------------
// 5. queries/corpus-duration.js linkedEvidenceForClaim()
// ---------------------------------------------------------------------

test('corpus-duration linkedEvidenceForClaim: (a) unique excerpt_ids -- resolves identically to the old deal_id|excerpt_id key', () => {
  const evidenceByCardKey = new Map([
    ['d1|excerpt-a|pi-a', 'Evidence for card A'],
    ['d1|excerpt-b|pi-b', 'Evidence for card B'],
  ]);
  assert.equal(linkedEvidenceForClaim({ deal_id: 'd1', excerpt_id: 'excerpt-a', provision_instance_id: 'pi-a' }, evidenceByCardKey), 'Evidence for card A');
  assert.equal(linkedEvidenceForClaim({ deal_id: 'd1', excerpt_id: 'excerpt-b', provision_instance_id: 'pi-b' }, evidenceByCardKey), 'Evidence for card B');
});

test('corpus-duration linkedEvidenceForClaim: (b) two sibling claims sharing one excerpt_id, differing provision_instance_id -- each resolves ONLY its own evidence', () => {
  const SHARED_EXCERPT = 'shared-excerpt';
  const evidenceByCardKey = new Map([
    [`d1|${SHARED_EXCERPT}|pi-a`, 'Evidence text belonging to card A'],
    [`d1|${SHARED_EXCERPT}|pi-b`, 'Evidence text belonging to card B'],
  ]);
  const claimA = { deal_id: 'd1', excerpt_id: SHARED_EXCERPT, provision_instance_id: 'pi-a' };
  const claimB = { deal_id: 'd1', excerpt_id: SHARED_EXCERPT, provision_instance_id: 'pi-b' };
  assert.equal(linkedEvidenceForClaim(claimA, evidenceByCardKey), 'Evidence text belonging to card A');
  assert.equal(linkedEvidenceForClaim(claimB, evidenceByCardKey), 'Evidence text belonging to card B',
    'must not fall through to card A\'s evidence just because the excerpt_id is shared');
});

test('corpus-duration linkedEvidenceForClaim: falls back to the legacy deal_id|excerpt_id key when provision_instance_id is unresolved (today\'s tests/corpus-duration.test.js fixture shape)', () => {
  const evidenceByCardKey = new Map([['qxo|qxo-intervening', 'Parent receives four (4) business days prior written notice.']]);
  const claim = { deal_id: 'qxo', excerpt_id: 'qxo-intervening' }; // no provision_instance_id, matching the existing test fixture
  assert.equal(linkedEvidenceForClaim(claim, evidenceByCardKey), 'Parent receives four (4) business days prior written notice.');
});

test('corpus-duration: linkedEvidenceForClaim + normalizeDurationClaim together resolve a rematerialized claim using ONLY its own sibling\'s evidence, never a co-located sibling\'s', () => {
  // Mirrors tests/corpus-duration.test.js's "can use the linked card quote
  // when a rematerialized claim lost its evidence" scenario, but with a
  // SIBLING card sharing the same excerpt_id whose evidence describes a
  // DIFFERENT clock. If evidence resolution ever fell back to the bare
  // excerpt_id, claimA would receive card B's ten-calendar-days text
  // instead of its own four-business-days text and either resolve to the
  // wrong value or fail closed.
  const SHARED_EXCERPT = 'shared-excerpt';
  const claimA = {
    deal_id: 'd1', excerpt_id: SHARED_EXCERPT, provision_instance_id: 'pi-a',
    attribute: 'noticePeriod', canonical: null, verbatim: '4', evidence_quote: null,
    provenance: { code: 'NOSOL-INTERVENING', feature_key: 'noticePeriod', feature_value: 4 },
  };
  const evidenceByCardKey = new Map([
    [`d1|${SHARED_EXCERPT}|pi-a`, 'Parent receives four (4) business days prior written notice.'],
    [`d1|${SHARED_EXCERPT}|pi-b`, 'Parent receives ten (10) calendar days prior written notice.'],
  ]);
  const linked = linkedEvidenceForClaim(claimA, evidenceByCardKey);
  assert.equal(linked, 'Parent receives four (4) business days prior written notice.', 'must resolve card A\'s own evidence, not card B\'s');
  assert.deepEqual(normalizeDurationClaim(claimA, linked), { value: 4, unit: 'business_days' });
});

test('corpus-duration: selectDurationCohort (existing exported entry point) still resolves the QXO rematerialized-claim scenario unchanged with the richer key in place', () => {
  const claims = [
    { deal_id: 'qxo', attribute: 'noticePeriod', canonical: null, verbatim: '4', evidence_quote: null, excerpt_id: 'qxo-intervening', provenance: { code: 'NOSOL-INTERVENING', feature_key: 'noticePeriod', feature_value: 4 } },
    { deal_id: 'peer', attribute: 'noticePeriod', canonical: null, verbatim: '4', evidence_quote: 'four (4) business days prior notice', excerpt_id: 'peer-excerpt', provenance: { code: 'NOSOL-INTERVENING', feature_key: 'noticePeriod', feature_value: 4 } },
  ];
  const evidenceByCardKey = new Map([['qxo|qxo-intervening', 'Parent receives four (4) business days prior written notice.']]);
  const { cohort, reason } = selectDurationCohort({ claims, subjectDealId: 'qxo', requestedCode: 'NOSOL-INTERVENING', evidenceByCardKey });
  assert.equal(reason, null);
  assert.equal(cohort.subjectValue, 4);
  assert.deepEqual(cohort.entries.map((entry) => entry.claim.deal_id).sort(), ['peer', 'qxo']);
});
