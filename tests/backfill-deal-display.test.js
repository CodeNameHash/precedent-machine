const test = require('node:test');
const assert = require('node:assert/strict');

const {
  BUYER_DISPLAY_ROWS,
  VALUE_ROWS,
  TYPE_GAP_DEALS,
  FINANCIAL_BUYER_ID_PREFIXES,
  considerationTypeFromFeature,
  hasGenuineElectionLanguage,
  classifyConsiderationType,
  classifyBuyerProfileForDeal,
  findDeal,
  planBuyerDisplay,
  planValue,
  planType,
  planBuyerProfile,
  parseArgs,
} = require('../scripts/backfill-deal-display');

test('spec tables carry the exact counts after the Ben review round (PR-sourced, no VERIFY rows remain)', () => {
  // 6 confident buyer-display rows (Envestnet, Endeavor, HireRight, EWC,
  // Superior, Sekisui/MDC) + United Homes (ultimateParent-only) — 0 VERIFY.
  assert.equal(BUYER_DISPLAY_ROWS.filter((r) => !r.verify && !r.ultimateParentOnly).length, 6);
  assert.equal(BUYER_DISPLAY_ROWS.find((r) => r.idPrefix === '667447f0').verify, false);
  assert.equal(BUYER_DISPLAY_ROWS.find((r) => r.idPrefix === '667447f0').acquirerDisplay, 'Oaktree-led lender group');
  // MDC's acquirer_display was ALREADY correct in the live corpus — this row
  // only backfills the missing top-level ultimateParent key (see live dry run).
  assert.equal(BUYER_DISPLAY_ROWS.find((r) => r.idPrefix === '1e4b7102').acquirerDisplay, 'Sekisui House');

  // deals-index round (2026-07-19): Catalent (bb5f062d) was in
  // FINANCIAL_BUYER_ID_PREFIXES from the start but had NO buyer-display row
  // at all — the root cause of the shell "Creek Parent, Inc." showing on
  // the live index. Added here VERIFY-gated (never written by --apply)
  // because this environment has no DB/full_text access to confirm the
  // agreement's own Guarantor recital the way every other row here does.
  const catalent = BUYER_DISPLAY_ROWS.find((r) => r.idPrefix === 'bb5f062d');
  assert.ok(catalent, 'Catalent must have a buyer-display row now');
  assert.equal(catalent.verify, true);
  assert.equal(catalent.acquirerDisplay, 'Novo Holdings');

  // All 13 value rows resolved via PR — 0 VERIFY remain.
  assert.equal(VALUE_ROWS.length, 13);
  assert.equal(VALUE_ROWS.filter((r) => r.verify).length, 0);
  assert.equal(VALUE_ROWS.filter((r) => r.provenance.kind === 'press_release').length, 12);
  assert.equal(VALUE_ROWS.filter((r) => r.provenance.kind === 'no_stated_value').length, 1);
  const superiorValue = VALUE_ROWS.find((r) => r.idPrefix === '667447f0');
  assert.equal(superiorValue.valueUsd, null);
  assert.equal(superiorValue.provenance.kind, 'no_stated_value');
  // Every resolved row carries a real source_url (SEC EX-99.1) for the provenance.
  for (const row of VALUE_ROWS) {
    assert.ok(row.provenance.sourceUrl, `${row.label} missing provenance.sourceUrl`);
    assert.match(row.provenance.sourceUrl, /^https:\/\/www\.sec\.gov\//);
  }

  // 13 headlineConsiderationType gaps
  assert.equal(TYPE_GAP_DEALS.length, 13);

  // 8 financial buyer_profile deals per spec's enumeration
  assert.equal(FINANCIAL_BUYER_ID_PREFIXES.size, 8);
});

test('no remaining VALUE_ROWS VERIFY rows; exactly one BUYER_DISPLAY_ROWS VERIFY row (Catalent, pending live-text verification)', () => {
  assert.equal(VALUE_ROWS.filter((r) => r.verify).length, 0);
  const verifyRows = BUYER_DISPLAY_ROWS.filter((r) => r.verify);
  assert.equal(verifyRows.length, 1);
  assert.equal(verifyRows[0].idPrefix, 'bb5f062d');
});

/* ── considerationType classifier — pinned fixtures matching the live corpus ── */

function provision(code, considerationType, full_text) {
  return { type: 'CONSID', ai_metadata: { code, features: considerationType ? { considerationType } : {} }, full_text };
}

test('classifyConsiderationType: all-cash / all-stock / cash-with-cvr map straight through', () => {
  assert.deepEqual(
    classifyConsiderationType([provision('CONSID-CONVERT', 'all-cash', 'Each share converted into $38.50 in cash.')]),
    { type: 'CASH', source: 'CONSID-CONVERT' },
  );
  assert.deepEqual(
    considerationTypeFromFeature('all-stock'),
    'STOCK',
  );
  assert.equal(
    classifyConsiderationType([provision('CONSID-CONVERT', 'cash-with-cvr', '$17.00 per share in cash plus one CVR.')]).type,
    'CASH_PLUS_CVR',
  );
});

test('classifyConsiderationType: mixed-cash-and-stock without election language stays MIXED (Superior, IonQ/SkyWater cases)', () => {
  // Superior: fixed formula by security class, no shareholder election.
  const superior = classifyConsiderationType([
    provision('CONSID-CONVERT', 'mixed-cash-and-stock', 'Each Common Share converted into $0.09 cash; Series A Preferred Shares receive Parent Units.'),
  ]);
  assert.deepEqual(superior, { type: 'MIXED', source: 'CONSID-CONVERT' });

  // IonQ/SkyWater: explicit NEGATION of election must win over the bare "elect" keyword.
  const ionq = classifyConsiderationType([
    provision('CONSID-CONVERT', 'mixed-cash-and-stock', 'converted into cash and stock. No election shall be made available to any holder of Company Common Stock with respect to the form of consideration, and no proration shall apply.'),
  ]);
  assert.deepEqual(ionq, { type: 'MIXED', source: 'CONSID-CONVERT' });
});

test('classifyConsiderationType: mixed-cash-and-stock WITH genuine election language becomes MIXED_ELECTION (QXO/TopBuild case)', () => {
  const qxo = classifyConsiderationType([
    provision('CONSID-CONVERT', 'mixed-cash-and-stock', 'Subject to the allocation and election procedures set forth in Section 2.1(b), each Company Share shall be converted into the right to receive Cash Consideration or Stock Consideration.'),
  ]);
  assert.deepEqual(qxo, { type: 'MIXED_ELECTION', source: 'CONSID-CONVERT' });
});

test('classifyConsiderationType falls back to a considerationType-bearing CONSID-EXCHANGE row when no CONSID-CONVERT exists (Cox case)', () => {
  const cox = classifyConsiderationType([
    provision('CONSID-ADJUST', null, 'adjustment boilerplate'),
    provision('CONSID-EXCHANGE', 'mixed-cash-and-stock', 'Columbus NewCo shall pay $3.5 billion in cash; Columbus Holdings shall issue Preferred Units.'),
  ]);
  assert.deepEqual(cox, { type: 'MIXED', source: 'CONSID-EXCHANGE' });
});

test('classifyConsiderationType returns unresolved when no headline provision or feature exists (Bridge, Endeavor, Stanley Martin/UHG cases)', () => {
  assert.deepEqual(classifyConsiderationType([]), { type: null, source: 'no-consid-provisions' });
  assert.deepEqual(
    classifyConsiderationType([provision('CONSID-WITHHOLD', null, 'withholding boilerplate')]),
    { type: null, source: 'no-headline-provision' },
  );
});

test('hasGenuineElectionLanguage requires an affirmative election-mechanics phrase, not a bare "election" mention', () => {
  assert.equal(hasGenuineElectionLanguage('election procedures set forth in Section 2.1(b)'), true);
  assert.equal(hasGenuineElectionLanguage('No election shall be made available to any holder'), false);
  assert.equal(hasGenuineElectionLanguage('the Company shall hold an election of directors'), false); // "election" present but no election-mechanics phrase
  assert.equal(hasGenuineElectionLanguage(''), false);
});

test('classifyBuyerProfileForDeal matches the spec-pinned 8 financial deals, everything else strategic', () => {
  assert.equal(classifyBuyerProfileForDeal('af4940e1'), 'financial'); // Skechers
  assert.equal(classifyBuyerProfileForDeal('667447f0'), 'financial'); // Superior
  assert.equal(classifyBuyerProfileForDeal('1f80bec7'), 'financial'); // Envestnet
  assert.equal(classifyBuyerProfileForDeal('0a043659'), 'financial'); // Endeavor
  assert.equal(classifyBuyerProfileForDeal('13211d88'), 'financial'); // HireRight
  assert.equal(classifyBuyerProfileForDeal('86a01770'), 'financial'); // EWC
  assert.equal(classifyBuyerProfileForDeal('bb5f062d'), 'financial'); // Catalent
  assert.equal(classifyBuyerProfileForDeal('f9c61065'), 'financial'); // Forest City
  // judgment calls the spec explicitly keeps strategic
  assert.equal(classifyBuyerProfileForDeal('1e4b7102'), 'strategic'); // MDC / Sekisui House
  assert.equal(classifyBuyerProfileForDeal('aad132ee'), 'strategic'); // United Homes / Stanley Martin
  assert.equal(classifyBuyerProfileForDeal('c7c16365'), 'strategic'); // Heinz/Kraft
  assert.equal(classifyBuyerProfileForDeal('65a3e3c8'), 'strategic'); // ENDRA
});

/* ── plan builders against a fixture deal set (no DB) ────────────────────── */

function fixtureDeals() {
  return [
    { id: '1f80bec7-aaaa', acquirer: 'BCPE Pequod Buyer, Inc.', target: 'Envestnet, Inc.', value_usd: null, metadata: { acquirer_display: null, ultimateParent: null, value_provenance: null, headlineConsiderationType: null, buyer_profile: null } },
    { id: '667447f0-bbbb', acquirer: 'SUP Parent Holdings, LLC', target: 'Superior Industries International, Inc.', value_usd: null, metadata: {} },
    { id: 'af4940e1-cccc', acquirer: 'Beach Acquisition Co Parent, LLC', target: 'Skechers U.S.A., Inc.', value_usd: 9_400_000_000, metadata: { acquirer_display: '3G Capital', buyer_profile: null } },
    { id: '2b9a6571-dddd', acquirer: 'IBM', target: 'Red Hat', value_usd: 34_000_000_000, metadata: { buyer_profile: 'strategic' } },
  ];
}

test('planBuyerDisplay marks Envestnet and (post review-round) Superior as WILL WRITE', () => {
  const rows = planBuyerDisplay(fixtureDeals());
  const envestnet = rows.find((r) => r.idPrefix === '1f80bec7');
  assert.equal(envestnet.found, true);
  assert.equal(envestnet.willWrite, true);
  assert.equal(envestnet.acquirerDisplay, 'Bain Capital');

  const superior = rows.find((r) => r.idPrefix === '667447f0');
  assert.equal(superior.verify, false);
  assert.equal(superior.willWrite, true);
  assert.equal(superior.acquirerDisplay, 'Oaktree-led lender group');
});

test('planBuyerDisplay: Catalent (VERIFY row) is found but never willWrite, even with --apply semantics', () => {
  const deals = [
    { id: 'bb5f062d-cccc', acquirer: 'Creek Parent, Inc.', target: 'Catalent, Inc.', metadata: {} },
  ];
  const rows = planBuyerDisplay(deals);
  const catalent = rows.find((r) => r.idPrefix === 'bb5f062d');
  assert.equal(catalent.found, true);
  assert.equal(catalent.verify, true);
  assert.equal(catalent.willWrite, false, 'VERIFY rows never write, regardless of --apply');
});

test('planBuyerDisplay marks an already-correct row (Sekisui House / MDC) as a no-op, not a write', () => {
  const deals = [
    { id: '1e4b7102-eeee', acquirer: 'SH Residential Holdings, LLC', target: 'M.D.C. Holdings, Inc.', metadata: { acquirer_display: 'Sekisui House', ultimateParent: 'Sekisui House' } },
  ];
  const rows = planBuyerDisplay(deals);
  const mdc = rows.find((r) => r.idPrefix === '1e4b7102');
  assert.equal(mdc.willWrite, false);
  assert.equal(mdc.noOpAlreadyCorrect, true);
});

test('planValue marks all 13 rows WILL WRITE post review-round, including Superior as a sourced no_stated_value write', () => {
  const rows = planValue(fixtureDeals());
  const envestnetValue = rows.find((r) => r.idPrefix === '1f80bec7');
  assert.equal(envestnetValue.willWrite, true);
  assert.equal(envestnetValue.valueUsd, 4_500_000_000);

  const superiorValue = rows.find((r) => r.idPrefix === '667447f0');
  assert.equal(superiorValue.willWrite, true);
  assert.equal(superiorValue.valueUsd, null);
  assert.equal(superiorValue.provenance.kind, 'no_stated_value');

  assert.equal(rows.filter((r) => r.found).every((r) => r.willWrite), true);
});

test('planType derives live from stored CONSID provisions and flags a MISMATCH against the spec cross-check', () => {
  const deals = [{ id: '1f80bec7-aaaa', acquirer: 'BCPE Pequod Buyer, Inc.', target: 'Envestnet, Inc.', metadata: {} }];
  const provisionsByDealId = new Map([
    ['1f80bec7-aaaa', [provision('CONSID-CONVERT', 'all-stock', 'Each share converted into 1.5 shares of Parent common stock.')]],
  ]);
  const rows = planType(deals, provisionsByDealId);
  const envestnet = rows.find((r) => r.idPrefix === '1f80bec7');
  assert.equal(envestnet.derivedType, 'STOCK'); // deliberately disagrees with the CASH cross-check
  assert.equal(envestnet.mismatch, true);
  assert.equal(envestnet.crossCheck, 'CASH');
});

test('planType falls back to the spec cross-check only when there is no derivable signal at all', () => {
  const deals = [{ id: '1dfb11d5-aaaa', acquirer: 'Apollo Global Management, Inc.', target: 'Bridge Investment Group Holdings Inc.', metadata: {} }];
  const provisionsByDealId = new Map([['1dfb11d5-aaaa', [provision('CONSID-WITHHOLD', null, 'withholding boilerplate')]]]);
  const rows = planType(deals, provisionsByDealId);
  const bridge = rows.find((r) => r.idPrefix === '1dfb11d5');
  assert.equal(bridge.derivedType, 'STOCK'); // spec cross-check fallback
  assert.equal(bridge.derivedSource, 'spec cross-check (no stored CONSID signal)');
  assert.equal(bridge.willWrite, true);
});

test('planType leaves a deal UNRESOLVED (no write) when neither live signal nor a cross-check exists', () => {
  const deals = [{ id: 'aad132ee-aaaa', acquirer: 'Stanley Martin Homes, LLC', target: 'United Homes Group, Inc.', metadata: {} }];
  const provisionsByDealId = new Map([['aad132ee-aaaa', [provision('CONSID-WITHHOLD', null, 'withholding boilerplate')]]]);
  const rows = planType(deals, provisionsByDealId);
  const uhg = rows.find((r) => r.idPrefix === 'aad132ee');
  assert.equal(uhg.derivedType, null);
  assert.equal(uhg.willWrite, false);
});

test('planBuyerProfile classifies every deal in the input and flags no-ops when already correct', () => {
  const rows = planBuyerProfile(fixtureDeals());
  const envestnet = rows.find((r) => r.idPrefix === '1f80bec7');
  assert.equal(envestnet.proposed, 'financial');
  assert.equal(envestnet.willWrite, true);

  const ibm = rows.find((r) => r.idPrefix === '2b9a6571');
  assert.equal(ibm.proposed, 'strategic');
  assert.equal(ibm.willWrite, false); // already strategic — no-op
});

test('findDeal matches by 8-char id prefix', () => {
  const deals = fixtureDeals();
  assert.equal(findDeal(deals, '1f80bec7').id, '1f80bec7-aaaa');
  assert.equal(findDeal(deals, 'nonexistent'), null);
});

/* ── CLI arg parsing / apply safety ─────────────────────────────────────── */

test('parseArgs defaults to dry run and rejects an unknown --only value', () => {
  const args = parseArgs(['node', 'script']);
  assert.equal(args.apply, false);
  assert.equal(args.only, null);

  const applyArgs = parseArgs(['node', 'script', '--apply', '--only', 'value']);
  assert.equal(applyArgs.apply, true);
  assert.equal(applyArgs.only, 'value');

  assert.throws(() => {
    const originalExit = process.exit;
    process.exit = () => { throw new Error('exit called'); };
    try {
      parseArgs(['node', 'script', '--only', 'bogus']);
    } finally {
      process.exit = originalExit;
    }
  });
});
