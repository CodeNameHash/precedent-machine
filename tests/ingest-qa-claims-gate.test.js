/* Tests for the additive claims gate in scripts/ingest-qa.js
   (SPEC-MECHANICAL-HARDENING-2026-07-23 part B, test group 4): coverage math
   on fake rows, zero-claims-with-codes failure, the 0.95 boundary, the
   override flags, and the missing-table degrade path. Pure / fakes only —
   no live DB, no network. */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  isMissingTableError,
  fetchAllClaims,
  fetchAllCards,
  computeClaimsMetrics,
  evaluateClaimsGates,
  DEFAULT_CLAIMS_GATES,
  buildDealResult,
  evaluateGates,
  evaluateDealMetadataGates,
  parseArgs,
  qaOneDeal,
} = require('../scripts/ingest-qa');

const DEAL_ID = 'deal-claims-gate-1';

function card(overrides = {}) {
  return {
    id: overrides.id || 'card-1',
    excerpt_id: overrides.excerpt_id || 'excerpt-1',
    provision_instance_id: overrides.provision_instance_id || 'instance-1',
    region_id: overrides.region_id || 'region-1',
    provision_type: 'COVENANT_NO_SOLICITATION',
    short_title: 'No Solicitation',
    region_full_text: 'Section 5.02 No Solicitation. The Company shall not solicit any Acquisition Proposal.',
    ...overrides,
  };
}

function provision(overrides = {}) {
  return {
    id: overrides.id || 'prov-1',
    type: 'NOSOL',
    category: 'No Solicitation',
    full_text: 'Section 5.02 No Solicitation. The Company shall not solicit any Acquisition Proposal.',
    ai_metadata: {},
    ...overrides,
  };
}

function codedFeatures() {
  return { carveouts: [{ code: 'PANDEMIC', label: 'Pandemic', text: 'pandemic', quotes: ['except for any pandemic'] }] };
}

// ---------------------------------------------------------------------------
// isMissingTableError
// ---------------------------------------------------------------------------

test('isMissingTableError matches the same signals as lib/queries/review-deal.js\'s isMissingTable', () => {
  assert.equal(isMissingTableError({ message: 'relation "public.claims" does not exist' }, 'claims'), true);
  assert.equal(isMissingTableError({ message: 'Could not find the table \'public.claims\' in the schema cache' }, 'claims'), true);
  assert.equal(isMissingTableError({ message: 'permission denied for table provisions' }, 'claims'), false);
});

// ---------------------------------------------------------------------------
// fetchAllClaims / fetchAllCards: pagination + missing-table degrade
// ---------------------------------------------------------------------------

function pagedSb({ table, rows, missing = false }) {
  return {
    from(name) {
      assert.equal(name, table);
      return {
        select: () => ({
          eq: () => ({
            range: (start, end) => {
              if (missing) return Promise.resolve({ data: null, error: { message: `Could not find the table 'public.${table}' in the schema cache` } });
              return Promise.resolve({ data: rows.slice(start, end + 1), error: null });
            },
          }),
        }),
      };
    },
  };
}

test('fetchAllClaims paginates like fetchAllProvisions and returns every row', async () => {
  const rows = Array.from({ length: 1200 }, (_, i) => ({ id: `c${i}`, excerpt_id: `excerpt-${i}` }));
  const sb = pagedSb({ table: 'claims', rows });
  const out = await fetchAllClaims(sb, DEAL_ID);
  assert.equal(out.length, 1200);
  assert.equal(out[0].excerpt_id, 'excerpt-0');
  assert.equal(out[1199].excerpt_id, 'excerpt-1199');
});

test('fetchAllClaims degrades to null (not []) when the claims table is unreachable', async () => {
  const sb = pagedSb({ table: 'claims', rows: [], missing: true });
  const out = await fetchAllClaims(sb, DEAL_ID);
  assert.equal(out, null);
});

test('fetchAllClaims throws on a real (non-missing-table) error', async () => {
  const sb = { from: () => ({ select: () => ({ eq: () => ({ range: () => Promise.resolve({ data: null, error: { message: 'connection reset' } }) }) }) }) };
  await assert.rejects(() => fetchAllClaims(sb, DEAL_ID), /Claims fetch failed: connection reset/);
});

test('fetchAllCards degrades to null when provision_cards is unreachable', async () => {
  const sb = pagedSb({ table: 'provision_cards', rows: [], missing: true });
  const out = await fetchAllCards(sb, DEAL_ID);
  assert.equal(out, null);
});

// ---------------------------------------------------------------------------
// computeClaimsMetrics: coverage math on mixed coded/uncoded provisions,
// cards with/without claims.
// ---------------------------------------------------------------------------

test('computeClaimsMetrics: a coded provision whose matched card has a claim counts toward coverage', () => {
  const codedProv = provision({ id: 'prov-coded', ai_metadata: { features: codedFeatures() } });
  const codedCard = card({ id: 'card-coded', excerpt_id: 'excerpt-coded' });
  const claims = [{ id: 'claim-1', excerpt_id: 'excerpt-coded' }];

  const metrics = computeClaimsMetrics(DEAL_ID, [codedProv], [codedCard], claims);
  assert.equal(metrics.claimsCount, 1);
  assert.equal(metrics.codedCardsTotal, 1);
  assert.equal(metrics.codedCardsWithClaim, 1);
  assert.equal(metrics.codedCardCoverage, 1);
  assert.equal(metrics.anyCodedFeatures, true);
});

test('computeClaimsMetrics: a coded provision whose matched card has NO claim drags coverage down', () => {
  const codedProv1 = provision({ id: 'prov-coded-1', category: 'A', full_text: 'Body A distinct.', ai_metadata: { features: codedFeatures() } });
  const codedProv2 = provision({ id: 'prov-coded-2', category: 'B', full_text: 'Body B distinct.', ai_metadata: { features: codedFeatures() } });
  const cardA = card({ id: 'card-a', excerpt_id: 'excerpt-a', short_title: 'A', region_full_text: 'Body A distinct.' });
  const cardB = card({ id: 'card-b', excerpt_id: 'excerpt-b', short_title: 'B', region_full_text: 'Body B distinct.' });
  const claims = [{ id: 'claim-1', excerpt_id: 'excerpt-a' }]; // only cardA has a claim

  const metrics = computeClaimsMetrics(DEAL_ID, [codedProv1, codedProv2], [cardA, cardB], claims);
  assert.equal(metrics.codedCardsTotal, 2);
  assert.equal(metrics.codedCardsWithClaim, 1);
  assert.equal(metrics.codedCardCoverage, 0.5);
});

test('computeClaimsMetrics: uncoded provisions never enter the coverage denominator', () => {
  const uncodedProv = provision({ id: 'prov-uncoded', ai_metadata: { features: { mainConcept: 'MAE' } } });
  const uncodedCard = card({ id: 'card-uncoded', excerpt_id: 'excerpt-uncoded' });
  const metrics = computeClaimsMetrics(DEAL_ID, [uncodedProv], [uncodedCard], []);
  assert.equal(metrics.codedCardsTotal, 0);
  assert.equal(metrics.codedCardCoverage, 1, 'vacuous pass when nothing coded to grade — same convention as computeCanonicalRate');
  assert.equal(metrics.anyCodedFeatures, false);
  assert.equal(metrics.claimsCount, 0);
});

test('computeClaimsMetrics: a coded provision that never matched any card is excluded from the coverage ratio (buildDealPlan reports it as a coverageFailure instead)', () => {
  const orphanCoded = provision({ id: 'prov-orphan', category: 'Orphan', full_text: 'Wholly unmatched body.', ai_metadata: { features: codedFeatures() } });
  const metrics = computeClaimsMetrics(DEAL_ID, [orphanCoded], [], []);
  assert.equal(metrics.codedCardsTotal, 0);
  assert.equal(metrics.codedCardCoverage, 1);
  assert.equal(metrics.anyCodedFeatures, true, 'still true at the deal level even though no card matched it');
});

// ---------------------------------------------------------------------------
// evaluateClaimsGates: zero-claims-with-codes fails; 0.95 boundary; override.
// ---------------------------------------------------------------------------

test('evaluateClaimsGates: fails when claimsCount == 0 while any coded features exist', () => {
  const metrics = { claimsCount: 0, codedCardsTotal: 1, codedCardsWithClaim: 0, codedCardCoverage: 0, anyCodedFeatures: true };
  const result = evaluateClaimsGates(metrics);
  assert.equal(result.ok, false);
  const claimsCheck = result.checks.find((c) => c.label === 'claims present (coded features exist)');
  assert.equal(claimsCheck.pass, false);
});

test('evaluateClaimsGates: does not fail the claims-present check when there are no coded features at all, even with zero claims', () => {
  const metrics = { claimsCount: 0, codedCardsTotal: 0, codedCardsWithClaim: 0, codedCardCoverage: 1, anyCodedFeatures: false };
  const result = evaluateClaimsGates(metrics);
  assert.equal(result.ok, true);
});

test('evaluateClaimsGates: 0.95 coverage boundary — exactly at threshold passes, just below fails', () => {
  const atThreshold = { claimsCount: 100, codedCardsTotal: 20, codedCardsWithClaim: 19, codedCardCoverage: 0.95, anyCodedFeatures: true };
  const belowThreshold = { claimsCount: 100, codedCardsTotal: 1000, codedCardsWithClaim: 949, codedCardCoverage: 0.949, anyCodedFeatures: true };

  const passResult = evaluateClaimsGates(atThreshold);
  const coverageCheckPass = passResult.checks.find((c) => c.label === 'coded card coverage');
  assert.equal(coverageCheckPass.pass, true);
  assert.equal(passResult.ok, true);

  const failResult = evaluateClaimsGates(belowThreshold);
  const coverageCheckFail = failResult.checks.find((c) => c.label === 'coded card coverage');
  assert.equal(coverageCheckFail.pass, false);
  assert.equal(failResult.ok, false);
});

test('evaluateClaimsGates: default thresholds match DEFAULT_CLAIMS_GATES (0.95 coverage, 1 minClaimsWhenCoded)', () => {
  assert.equal(DEFAULT_CLAIMS_GATES.codedCardCoverage, 0.95);
  assert.equal(DEFAULT_CLAIMS_GATES.minClaimsWhenCoded, 1);
});

test('evaluateClaimsGates: --min-coded-card-coverage / --min-claims-when-coded overrides work, same style as existing gates', () => {
  const metrics = { claimsCount: 0, codedCardsTotal: 10, codedCardsWithClaim: 8, codedCardCoverage: 0.8, anyCodedFeatures: true };

  // Default: fails both (coverage below 0.95, and zero claims with coded features).
  const withDefaults = evaluateClaimsGates(metrics);
  assert.equal(withDefaults.ok, false);

  // Loosen both via overrides, same shape as { repT, repB, ... } gate overrides.
  const loosened = evaluateClaimsGates(metrics, { codedCardCoverage: 0.5, minClaimsWhenCoded: 0 });
  assert.equal(loosened.ok, true);
});

test('parseArgs: --min-claims-when-coded / --min-coded-card-coverage parse into args.gates without disturbing existing flags', () => {
  const parsed = parseArgs(['node', 'ingest-qa.js', '--all', '--min-claims-when-coded', '2', '--min-coded-card-coverage', '0.8', '--min-rep-t', '10']);
  assert.equal(parsed.gates.minClaimsWhenCoded, 2);
  assert.equal(parsed.gates.codedCardCoverage, 0.8);
  assert.equal(parsed.gates.repT, 10);

  const plain = parseArgs(['node', 'ingest-qa.js', '--all']);
  assert.deepEqual(plain.gates, {});
});

// ---------------------------------------------------------------------------
// buildDealResult: claimsEval is optional/additive and only merges when present.
// ---------------------------------------------------------------------------

function baseMetricsAndEvals() {
  const metrics = {
    counts: { total: 10, repT: 20, repB: 8, def: 50, cond: 10, ioc: 0, nosol: 0, termr: 0, termf: 0 },
    coveragePct: 96, rawCoveragePct: 90, excludedChars: 0, excludedRegions: [],
    unverified: 0, duplicates: 0, canonicalRate: 0.85,
  };
  const evalResult = evaluateGates(metrics);
  const deal = { id: 'deal-x', acquirer: 'A', target: 'B', value_usd: 1, announce_date: '2025-01-01', metadata: { headlineConsiderationType: 'CASH', buyer_profile: 'strategic' } };
  const metaEval = evaluateDealMetadataGates(deal);
  return { deal, metrics, evalResult, metaEval };
}

test('buildDealResult: without claimsEval (existing callers), behavior and checks[] length are unchanged', () => {
  const { deal, metrics, evalResult, metaEval } = baseMetricsAndEvals();
  const result = buildDealResult(deal, metrics, evalResult, metaEval, { staging: false });
  assert.equal(result.pass, evalResult.ok && metaEval.ok);
  assert.ok(result.checks.every((c) => c.group === 'gate' || c.group === 'metadata'));
});

test('buildDealResult: with a failing claimsEval, overall pass flips to false and claims checks are tagged group "claims"', () => {
  const { deal, metrics, evalResult, metaEval } = baseMetricsAndEvals();
  assert.equal(evalResult.ok, true);
  assert.equal(metaEval.ok, true);
  const claimsEval = evaluateClaimsGates({ claimsCount: 0, codedCardsTotal: 1, codedCardsWithClaim: 0, codedCardCoverage: 0, anyCodedFeatures: true });
  assert.equal(claimsEval.ok, false);

  const result = buildDealResult(deal, metrics, evalResult, metaEval, { staging: false, claimsEval });
  assert.equal(result.pass, false);
  assert.ok(result.checks.some((c) => c.group === 'claims'));
});

test('buildDealResult: with a passing claimsEval, overall pass is unaffected', () => {
  const { deal, metrics, evalResult, metaEval } = baseMetricsAndEvals();
  const claimsEval = evaluateClaimsGates({ claimsCount: 5, codedCardsTotal: 5, codedCardsWithClaim: 5, codedCardCoverage: 1, anyCodedFeatures: true });
  assert.equal(claimsEval.ok, true);
  const result = buildDealResult(deal, metrics, evalResult, metaEval, { staging: false, claimsEval });
  assert.equal(result.pass, true);
});

// ---------------------------------------------------------------------------
// End-to-end (qaOneDeal, fake sb): missing-table degrade path — "claims gate
// skipped", never fails the run, ingest-qa must keep working against
// databases predating claims.
// ---------------------------------------------------------------------------

function pagedTable(rows, { missing = false, tableName = 'table' } = {}) {
  return {
    select: () => ({
      eq: () => ({
        range: (start, end) => {
          if (missing) return Promise.resolve({ data: null, error: { message: `Could not find the table 'public.${tableName}' in the schema cache` } });
          return Promise.resolve({ data: rows.slice(start, end + 1), error: null });
        },
      }),
    }),
  };
}

function fakeIngestQaSb({ provisions = [], claims = [], cards = [], claimsMissing = false, cardsMissing = false } = {}) {
  return {
    from(table) {
      if (table === 'provisions') return pagedTable(provisions, { tableName: 'provisions' });
      if (table === 'claims') return pagedTable(claims, { missing: claimsMissing, tableName: 'claims' });
      if (table === 'provision_cards') return pagedTable(cards, { missing: cardsMissing, tableName: 'provision_cards' });
      throw new Error(`unexpected table: ${table}`);
    },
  };
}

async function withCapturedLog(fn) {
  const logs = [];
  const orig = console.log;
  console.log = (...a) => logs.push(a.join(' '));
  try {
    const result = await fn();
    return { result, logs };
  } finally {
    console.log = orig;
  }
}

test('qaOneDeal: claims/provision_cards table unreachable prints "claims gate skipped" and does not affect pass/fail vs. the same deal with an empty (non-coded) claims table', async () => {
  const deal = { id: 'deal-degrade-1', acquirer: 'A', target: 'B', metadata: { full_text: 'Some agreement text.' } };

  const sbMissing = fakeIngestQaSb({ provisions: [], claimsMissing: true, cardsMissing: true });
  const { result: captured, logs } = await withCapturedLog(() => qaOneDeal(sbMissing, deal, {}));
  assert.ok(logs.some((l) => /claims gate skipped/.test(l)));
  assert.ok(logs.some((l) => /pre-claims-schema database/.test(l)));

  const sbPresentEmpty = fakeIngestQaSb({ provisions: [], claims: [], cards: [] });
  const { result: presentResult } = await withCapturedLog(() => qaOneDeal(sbPresentEmpty, deal, {}));

  // No coded features anywhere in either scenario, so the claims gate is
  // vacuously fine whether it ran (present-empty) or was skipped
  // (missing-table) — degrading must not change the deal's overall outcome.
  assert.equal(captured.ok, presentResult.ok);
  assert.equal(captured.result.pass, presentResult.result.pass);
});
