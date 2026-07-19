const test = require('node:test');
const assert = require('node:assert/strict');

const { evaluateDealMetadataGates, hasAdvisorsFound, hasLawFirmsFound } = require('../scripts/ingest-qa');

function cleanDeal(overrides = {}) {
  const { metadata: metadataOverrides, ...rest } = overrides;
  return {
    id: 'deal-1',
    acquirer: 'Pfizer Inc.',
    target: 'Metsera, Inc.',
    value_usd: 7_000_000_000,
    announce_date: '2025-09-08',
    ...rest,
    metadata: {
      acquirer_display: 'Pfizer',
      headlineConsiderationType: 'CASH',
      buyer_profile: 'strategic',
      ...metadataOverrides,
    },
  };
}

test('a fully-populated clean deal passes every gated check', () => {
  const result = evaluateDealMetadataGates(cleanDeal());
  assert.equal(result.ok, true);
  for (const c of result.checks.filter((c) => c.gated)) assert.equal(c.pass, true, c.label);
});

test('buyer_display fails when resolveBuyerDisplay lands on a shell name', () => {
  const deal = cleanDeal({ acquirer: 'SUP Parent Holdings, LLC', metadata: { acquirer_display: null, ultimateParent: null, parent_entity: null, headlineConsiderationType: 'MIXED', buyer_profile: 'financial' } });
  const result = evaluateDealMetadataGates(deal);
  assert.equal(result.checks.find((c) => c.label === 'buyer_display').pass, false);
  assert.equal(result.ok, false);
});

test('value passes when value_usd is set OR value_provenance.kind is no_stated_value, fails on bare silence', () => {
  const withValue = evaluateDealMetadataGates(cleanDeal({ value_usd: 1_000_000_000 }));
  assert.equal(withValue.checks.find((c) => c.label === 'value').pass, true);

  const withProvenance = evaluateDealMetadataGates(cleanDeal({ value_usd: null, metadata: { value_provenance: { kind: 'no_stated_value' } } }));
  assert.equal(withProvenance.checks.find((c) => c.label === 'value').pass, true);
  assert.equal(withProvenance.ok, true);

  const silent = evaluateDealMetadataGates(cleanDeal({ value_usd: null, metadata: {} }));
  assert.equal(silent.checks.find((c) => c.label === 'value').pass, false);
  assert.equal(silent.ok, false);
});

test('consideration_type and buyer_profile gate on presence / valid enum', () => {
  const noType = evaluateDealMetadataGates(cleanDeal({ metadata: { headlineConsiderationType: null } }));
  assert.equal(noType.checks.find((c) => c.label === 'consideration_type').pass, false);

  const badProfile = evaluateDealMetadataGates(cleanDeal({ metadata: { buyer_profile: 'public' } }));
  assert.equal(badProfile.checks.find((c) => c.label === 'buyer_profile').pass, false);

  const financial = evaluateDealMetadataGates(cleanDeal({ metadata: { buyer_profile: 'financial' } }));
  assert.equal(financial.checks.find((c) => c.label === 'buyer_profile').pass, true);
});

test('signing_date requires a full YYYY-MM-DD, not a month-year truncation', () => {
  const full = evaluateDealMetadataGates(cleanDeal({ announce_date: '2025-09-08' }));
  assert.equal(full.checks.find((c) => c.label === 'signing_date').pass, true);

  const truncated = evaluateDealMetadataGates(cleanDeal({ announce_date: '2025-09' }));
  assert.equal(truncated.checks.find((c) => c.label === 'signing_date').pass, false);

  const missing = evaluateDealMetadataGates(cleanDeal({ announce_date: null }));
  assert.equal(missing.checks.find((c) => c.label === 'signing_date').pass, false);
});

test('advisors_found is informational only — never affects overall ok', () => {
  const noAdvisors = evaluateDealMetadataGates(cleanDeal({ metadata: {} }));
  assert.equal(noAdvisors.checks.find((c) => c.label === 'advisors_found').gated, false);
  assert.equal(noAdvisors.ok, true); // every gated check still passes despite missing advisors
});

test('hasAdvisorsFound reads either advisors_v2 firms or the legacy advisors array', () => {
  assert.equal(hasAdvisorsFound({ advisors_v2: { buyer_firms: ['Wachtell'], seller_firms: [] } }), true);
  assert.equal(hasAdvisorsFound({ advisors_v2: { buyer_firms: [], seller_firms: [] } }), false);
  assert.equal(hasAdvisorsFound({ advisors: [{ firm: 'Paul, Weiss' }] }), true);
  assert.equal(hasAdvisorsFound({}), false);
});

// law_firms_found — same soft-check family as advisors_found (Ben,
// deals-index round 2026-07-19: metadata.law_firms is populated at ingest
// time by lib/ingest/deal-metadata-prompt.js's extractLawFirms()).
test('law_firms_found is informational only — never affects overall ok', () => {
  const noFirms = evaluateDealMetadataGates(cleanDeal({ metadata: {} }));
  assert.equal(noFirms.checks.find((c) => c.label === 'law_firms_found').gated, false);
  assert.equal(noFirms.ok, true); // every gated check still passes despite missing law firms
});

test('hasLawFirmsFound reads metadata.law_firms.{target,acquirer}', () => {
  assert.equal(hasLawFirmsFound({ law_firms: { target: ['Cooley LLP'], acquirer: [] } }), true);
  assert.equal(hasLawFirmsFound({ law_firms: { target: [], acquirer: ['Paul, Weiss'] } }), true);
  assert.equal(hasLawFirmsFound({ law_firms: { target: [], acquirer: [] } }), false);
  assert.equal(hasLawFirmsFound({}), false);
  assert.equal(hasLawFirmsFound({ law_firms: null }), false);
});
