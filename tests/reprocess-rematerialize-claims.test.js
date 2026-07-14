const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeHead,
  matchCardsToProvisions,
  matchTypeBucket,
  provisionHasCodedFeatures,
  buildDealPlan,
} = require('../scripts/reprocess/rematerialize-claims');

const DEAL_ID = '885edae5-49e8-464a-9f33-edd229119d7c';

// Realistic fixtures: provision_cards.provision_type carries CARD-MODEL
// types (COVENANT_NO_SOLICITATION, ...) while provisions.type carries RUBRIC
// types (NOSOL, ...). The two vocabularies are DISJOINT in the real DB — the
// matcher must bridge them via store-cards.js's provisionType().
function card(overrides = {}) {
  return {
    id: 'card-1',
    excerpt_id: 'excerpt-1',
    provision_instance_id: 'instance-1',
    region_id: 'region-1',
    provision_type: 'COVENANT_NO_SOLICITATION',
    short_title: 'No Solicitation',
    region_full_text: 'Section 5.02 No Solicitation. The Company shall not solicit any Acquisition Proposal.',
    ...overrides,
  };
}

function provision(overrides = {}) {
  return {
    id: 'prov-1',
    type: 'NOSOL',
    category: 'No Solicitation',
    full_text: 'Section 5.02 No Solicitation. The Company shall not solicit any Acquisition Proposal.',
    ai_metadata: {},
    extraction_version: 'v2',
    extracted_at: '2026-07-08T00:00:00.000Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. Rung 1 — unique title match; duplicate title falls through.
// ---------------------------------------------------------------------------

test('matchTypeBucket: rung 1 matches on a unique title', () => {
  const cards = [card()];
  const provisions = [provision()];
  const { matches, ambiguities, unmatchedCards, unmatchedProvisions } = matchTypeBucket(cards, provisions);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].rung, 1);
  assert.equal(matches[0].card.id, 'card-1');
  assert.equal(matches[0].provision.id, 'prov-1');
  assert.deepEqual(ambiguities, []);
  assert.deepEqual(unmatchedCards, []);
  assert.deepEqual(unmatchedProvisions, []);
});

test('matchTypeBucket: a duplicated title does not match at rung 1, falls through to rung 2 (exact text)', () => {
  const cards = [
    card({ id: 'card-a', excerpt_id: 'excerpt-a', short_title: 'No Solicitation', region_full_text: 'Text A body only, distinct.' }),
    card({ id: 'card-b', excerpt_id: 'excerpt-b', short_title: 'No Solicitation', region_full_text: 'Text B body only, distinct.' }),
  ];
  const provisions = [
    provision({ id: 'prov-a', category: 'No Solicitation', full_text: 'Text A body only, distinct.' }),
    provision({ id: 'prov-b', category: 'No Solicitation', full_text: 'Text B body only, distinct.' }),
  ];
  const { matches, ambiguities } = matchTypeBucket(cards, provisions);
  // Title collided (2 cards, 2 provisions) so rung 1 could not resolve it;
  // rung 2's exact-text match resolves both pairs uniquely instead.
  assert.equal(matches.length, 2);
  assert.ok(matches.every((m) => m.rung === 2));
  assert.deepEqual(ambiguities, []);
  const byCard = Object.fromEntries(matches.map((m) => [m.card.id, m.provision.id]));
  assert.equal(byCard['card-a'], 'prov-a');
  assert.equal(byCard['card-b'], 'prov-b');
});

// ---------------------------------------------------------------------------
// 2. Rung 2 — exact text match (titles differ, so rung 1 can't touch them).
// ---------------------------------------------------------------------------

test('matchTypeBucket: rung 2 matches on unique exact text when titles differ', () => {
  const cards = [card({ short_title: 'No-Solicitation Covenant', region_full_text: 'Exact shared body text.' })];
  const provisions = [provision({ category: 'Non-Solicitation', full_text: 'Exact shared body text.' })];
  const { matches } = matchTypeBucket(cards, provisions);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].rung, 2);
});

// ---------------------------------------------------------------------------
// 3. Rung 3 — normalized-head match.
// ---------------------------------------------------------------------------

test('normalizeHead strips a Section heading line and leading (a)/(i) markers, lowercases and collapses whitespace', () => {
  const withHeading = normalizeHead('Section 5.02 No Solicitation. (a) The Company shall not solicit any Acquisition Proposal.');
  const bareBody = normalizeHead('the company   SHALL not solicit any Acquisition   Proposal.');
  assert.equal(withHeading, 'the company shall not solicit any acquisition proposal.');
  assert.equal(bareBody, withHeading);
});

test('normalizeHead strips ALL-CAPS "SECTION 5.02." heading with no title text', () => {
  const out = normalizeHead('SECTION 5.02. The Company shall not solicit.');
  assert.equal(out, 'the company shall not solicit.');
});

test('normalizeHead strips roman-numeral and pinpoint-ref subsection markers', () => {
  const out1 = normalizeHead('(i) no direct or indirect solicitation shall occur');
  const out2 = normalizeHead('5.02(f) no direct or indirect solicitation shall occur');
  assert.equal(out1, 'no direct or indirect solicitation shall occur');
  assert.equal(out2, 'no direct or indirect solicitation shall occur');
});

test('matchTypeBucket: rung 3 matches when heads agree despite differing titles and surface text (whitespace/markers)', () => {
  const cards = [card({
    short_title: 'Non-Solicit',
    region_full_text: 'Section 5.02 No Solicitation. (a) The Company shall not solicit any Proposal.',
  })];
  const provisions = [provision({
    category: 'No-Shop',
    full_text: '5.02(a)   the company shall NOT solicit any proposal.',
  })];
  const { matches } = matchTypeBucket(cards, provisions);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].rung, 4);
});

test('matchTypeBucket: rung 4 strips a leading sub-heading phrase so 200-char heads agree', () => {
  const operative = 'Except as provided by Section 5.3(d), at no time after the date hereof may the Company Board or a committee thereof withhold, withdraw, amend, qualify or modify, or publicly propose to withhold, withdraw, amend, qualify or modify, the Company Board Recommendation in a manner adverse to Parent in any material respect, or fail to make the Company Board Recommendation in the Proxy Statement.';
  const cards = [card({
    short_title: 'Change of Recommendation',
    region_full_text: operative,
  })];
  const provisions = [provision({
    category: 'COR (operative)',
    full_text: `(c) No Change in Company Board Recommendation or Entry into an Alternative Acquisition Agreement. ${operative} And more trailing text beyond the head window.`,
  })];
  const { matches } = matchTypeBucket(cards, provisions);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].rung, 4);
});

test('matchTypeBucket: rung 5 unique containment catches short and elided card texts', () => {
  const provText = 'During the period commencing with the execution and delivery of this Agreement, Parent shall not terminate, amend, modify or waive any provision of any standstill agreement, and Parent shall enforce each such agreement to the fullest extent permitted.';
  const cards = [
    card({ id: 'card-elided', short_title: 'Enforcement of Standstills', region_full_text: '(f) During the period commencing with the execution and delivery of this Agreement, Parent shall not terminate, amend, modify or waive any provision ... shall enforce each such agreement to the fullest extent permitted.' }),
  ];
  const provisions = [
    provision({ id: 'prov-parent', category: 'Enforcement of Standstills', full_text: provText }),
    provision({ id: 'prov-company', category: 'Enforcement of Standstills', full_text: provText.replace(/Parent/g, 'the Company') }),
  ];
  const { matches } = matchTypeBucket(cards, provisions);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].rung, 5);
  assert.equal(matches[0].provision.id, 'prov-parent');
});

test('matchTypeBucket: rung 5 never matches when a card is contained in two provisions', () => {
  const shared = 'each party hereto shall make or cause to be made an appropriate filing of a Notification and Report Form pursuant to the HSR Act with respect to the Transactions promptly';
  const cards = [card({ id: 'card-x', short_title: 'Filing', region_full_text: shared })];
  const provisions = [
    provision({ id: 'p1', category: 'A', full_text: `Alpha. ${shared} tail one.` }),
    provision({ id: 'p2', category: 'B', full_text: `Beta. ${shared} tail two.` }),
  ];
  const { matches, unmatchedCards } = matchTypeBucket(cards, provisions);
  assert.equal(matches.length, 0);
  assert.equal(unmatchedCards.length, 1);
});

test('normalizeHead: does NOT strip a leading operative sentence as a heading', () => {
  const head = normalizeHead('The Company shall not solicit. Further obligations follow here.');
  assert.ok(head.startsWith('the company shall not solicit.'));
});

test('matchTypeBucket: rung 3 pairs identical text by title when two categories share the text', () => {
  const sharedText = 'Without limiting the generality of the foregoing, each party shall make an appropriate HSR filing.';
  const cards = [
    card({ id: 'card-rfd', short_title: 'Regulatory Filing Deadline', region_full_text: sharedText }),
    card({ id: 'card-rfd-2', short_title: 'Regulatory Filing Deadline', region_full_text: 'A completely different second card that blocks rung 1 title uniqueness for this shared title.' }),
  ];
  const provisions = [
    provision({ id: 'prov-title-match', category: 'Regulatory Filing Deadline', full_text: sharedText }),
    provision({ id: 'prov-other-cat', category: 'Foreign Regulatory Approvals', full_text: sharedText }),
  ];
  const { matches } = matchTypeBucket(cards, provisions);
  const r3 = matches.find((m) => m.rung === 3);
  assert.ok(r3, 'expected a rung-3 text+title match');
  assert.equal(r3.card.id, 'card-rfd');
  assert.equal(r3.provision.id, 'prov-title-match');
});

// ---------------------------------------------------------------------------
// 4. Ambiguity: two cards + two provisions sharing one title, and text/heads
//    also fail to disambiguate them -> hard stop.
// ---------------------------------------------------------------------------

test('matchTypeBucket: persistent collision across all three rungs is reported as an ambiguity, not matched', () => {
  const cards = [
    card({ id: 'card-a', excerpt_id: 'excerpt-a', short_title: 'No Solicitation', region_full_text: 'Section 5.02 No Solicitation. Identical body text here.' }),
    card({ id: 'card-b', excerpt_id: 'excerpt-b', short_title: 'No Solicitation', region_full_text: 'Section 5.02 No Solicitation. Identical body text here.' }),
  ];
  const provisions = [
    provision({ id: 'prov-a', category: 'No Solicitation', full_text: 'Section 5.02 No Solicitation. Identical body text here.' }),
    provision({ id: 'prov-b', category: 'No Solicitation', full_text: 'Section 5.02 No Solicitation. Identical body text here.' }),
  ];
  const { matches, ambiguities, unmatchedCards, unmatchedProvisions } = matchTypeBucket(cards, provisions);
  assert.equal(matches.length, 0);
  assert.ok(ambiguities.length > 0);
  assert.equal(unmatchedCards.length, 2);
  assert.equal(unmatchedProvisions.length, 2);
  const ids = ambiguities.flatMap((a) => a.cardIds);
  assert.ok(ids.includes('card-a') && ids.includes('card-b'));
});

test('matchCardsToProvisions: bubbles ambiguities up with the type attached, plan.ok would be false', () => {
  const cards = [
    card({ id: 'card-a', excerpt_id: 'excerpt-a' }),
    card({ id: 'card-b', excerpt_id: 'excerpt-b' }),
  ];
  const provisions = [
    provision({ id: 'prov-a' }),
    provision({ id: 'prov-b' }),
  ];
  const { ambiguities } = matchCardsToProvisions(cards, provisions);
  assert.ok(ambiguities.length > 0);
  assert.equal(ambiguities[0].type, 'COVENANT_NO_SOLICITATION');
});

// ---------------------------------------------------------------------------
// Type-vocabulary bridging (regression for the production defect where
// `card.provision_type === provision.type` never held: provision_cards
// carry card-model types, provisions carry rubric types — disjoint).
// ---------------------------------------------------------------------------

test('regression: a NOSOL provision matches a COVENANT_NO_SOLICITATION card at rung 1', () => {
  const cards = [card({ provision_type: 'COVENANT_NO_SOLICITATION' })];
  const provisions = [provision({ type: 'NOSOL' })];
  const { matches, unmatchedCards, unmatchedProvisions } = matchCardsToProvisions(cards, provisions);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].rung, 1);
  assert.deepEqual(unmatchedCards, []);
  assert.deepEqual(unmatchedProvisions, []);
});

test('REP-T and REP-B provisions both land in the REPRESENTATION card bucket', () => {
  const cards = [
    card({ id: 'card-t', excerpt_id: 'excerpt-t', provision_type: 'REPRESENTATION', short_title: 'Company Capitalization', region_full_text: 'Target rep body.' }),
    card({ id: 'card-b', excerpt_id: 'excerpt-b', provision_type: 'REPRESENTATION', short_title: 'Parent Authority', region_full_text: 'Buyer rep body.' }),
  ];
  const provisions = [
    provision({ id: 'prov-t', type: 'REP-T', category: 'Company Capitalization', full_text: 'Target rep body.' }),
    provision({ id: 'prov-b', type: 'REP-B', category: 'Parent Authority', full_text: 'Buyer rep body.' }),
  ];
  const { matches, ambiguities, unmatchedCards, unmatchedProvisions } = matchCardsToProvisions(cards, provisions);
  assert.equal(matches.length, 2);
  assert.deepEqual(ambiguities, []);
  assert.deepEqual(unmatchedCards, []);
  assert.deepEqual(unmatchedProvisions, []);
  const byCard = Object.fromEntries(matches.map((m) => [m.card.id, m.provision.id]));
  assert.equal(byCard['card-t'], 'prov-t');
  assert.equal(byCard['card-b'], 'prov-b');
});

test('an unknown rubric type like SECTION-LEFTOVER defaults to the MISC_BOILERPLATE bucket', () => {
  const cards = [card({ id: 'card-m', excerpt_id: 'excerpt-m', provision_type: 'MISC_BOILERPLATE', short_title: 'Leftover Section', region_full_text: 'Leftover body.' })];
  const provisions = [provision({ id: 'prov-m', type: 'SECTION-LEFTOVER', category: 'Leftover Section', full_text: 'Leftover body.' })];
  const { matches } = matchCardsToProvisions(cards, provisions);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].rung, 1);
  assert.equal(matches[0].provision.id, 'prov-m');
});

test('a TERMF provision never matches a card in another bucket, even with an identical title', () => {
  const cards = [card({ provision_type: 'COVENANT_NO_SOLICITATION', short_title: 'Shared Title' })];
  const provisions = [provision({ type: 'TERMF', category: 'Shared Title', ai_metadata: { features: {} } })];
  const { matches, unmatchedCards, unmatchedProvisions } = matchCardsToProvisions(cards, provisions);
  assert.equal(matches.length, 0);
  assert.equal(unmatchedCards.length, 1);
  assert.equal(unmatchedProvisions.length, 1);
});

// ---------------------------------------------------------------------------
// 5. Coverage failure: an unmatched provision with coded features is flagged;
//    without, it is not.
// ---------------------------------------------------------------------------

test('provisionHasCodedFeatures: true when a feature key\'s registry entry has listItemTagFamily', () => {
  const prov = provision({ ai_metadata: { features: { carveouts: [{ code: 'PANDEMIC', text: 'pandemic' }] } } });
  assert.equal(provisionHasCodedFeatures(prov), true);
});

test('provisionHasCodedFeatures: true when a raw value itself is a {code,label,text} tagged object, even citable-wrapped', () => {
  const prov = provision({ ai_metadata: { features: { effortsStandard: { value: { code: 'RBE', text: 'reasonable best efforts' }, quotes: [] } } } });
  assert.equal(provisionHasCodedFeatures(prov), true);
});

test('provisionHasCodedFeatures: false for plain scalar / untagged features', () => {
  const prov = provision({ ai_metadata: { features: { mainConcept: 'Material Adverse Effect', preventDelayProng: true } } });
  assert.equal(provisionHasCodedFeatures(prov), false);
});

test('provisionHasCodedFeatures: false when there is no feature bag at all', () => {
  assert.equal(provisionHasCodedFeatures(provision({ ai_metadata: {} })), false);
  assert.equal(provisionHasCodedFeatures(provision({ ai_metadata: null })), false);
});

test('buildDealPlan: unmatched provision WITH coded features is a coverage failure; without is fine', () => {
  const coded = provision({ id: 'prov-coded', category: 'Orphan Coded', full_text: 'Totally unrelated body A.', ai_metadata: { features: { carveouts: [{ code: 'PANDEMIC', text: 'pandemic' }] } } });
  const uncoded = provision({ id: 'prov-uncoded', category: 'Orphan Uncoded', full_text: 'Totally unrelated body B.', ai_metadata: { features: { mainConcept: 'MAE' } } });
  const plan = buildDealPlan(DEAL_ID, [], [coded, uncoded]);
  assert.equal(plan.coverageFailures.length, 1);
  assert.equal(plan.coverageFailures[0].provisionId, 'prov-coded');
  assert.equal(plan.ok, false);
});

test('buildDealPlan: fully clean plan (all matched, no leftovers) is ok', () => {
  const plan = buildDealPlan(DEAL_ID, [card()], [provision()]);
  assert.equal(plan.ok, true);
  assert.equal(plan.ambiguities.length, 0);
  assert.equal(plan.coverageFailures.length, 0);
});

// ---------------------------------------------------------------------------
// 6/7/8. Claim writing via a mock sb client, idempotency, no card writes.
// ---------------------------------------------------------------------------

function richProvision(overrides = {}) {
  return provision({
    id: 'prov-rich',
    type: 'NOSOL',
    category: 'No Solicitation',
    full_text: 'Section 5.02 No Solicitation. The Company shall not solicit any Acquisition Proposal.',
    ai_metadata: {
      features: {
        mainConcept: 'Acquisition Proposal',
        preventDelayProng: true,
        carveouts: [
          { code: 'PANDEMIC', label: 'Pandemic', text: 'pandemic', quotes: ['except for any pandemic'] },
        ],
      },
    },
    ...overrides,
  });
}

function richCard(overrides = {}) {
  return card({
    id: 'card-rich',
    excerpt_id: 'excerpt-rich',
    provision_instance_id: 'instance-rich',
    region_id: 'region-rich',
    provision_type: 'COVENANT_NO_SOLICITATION',
    short_title: 'No Solicitation',
    region_full_text: 'Section 5.02 No Solicitation. The Company shall not solicit any Acquisition Proposal.',
    ...overrides,
  });
}

function makeMockSb() {
  const tables = { claims: [], provision_cards: [] };
  const calls = { provision_cards: [] };
  return {
    tables,
    calls,
    from(table) {
      if (table === 'provision_cards') {
        return {
          insert: (...a) => { calls.provision_cards.push(['insert', ...a]); return Promise.resolve({ error: null }); },
          update: (...a) => { calls.provision_cards.push(['update', ...a]); return Promise.resolve({ error: null }); },
          upsert: (...a) => { calls.provision_cards.push(['upsert', ...a]); return Promise.resolve({ error: null }); },
          delete: (...a) => {
            calls.provision_cards.push(['delete', ...a]);
            return { eq: () => ({ in: () => Promise.resolve({ error: null }) }) };
          },
          select: () => ({ eq: () => Promise.resolve({ data: tables.provision_cards, error: null }) }),
        };
      }
      return {
        upsert(rows, options) {
          for (const row of rows) {
            const idx = tables.claims.findIndex((r) => r[options.onConflict] === row[options.onConflict]);
            if (idx >= 0) tables.claims[idx] = { ...tables.claims[idx], ...row };
            else tables.claims.push({ ...row });
          }
          return Promise.resolve({ error: null });
        },
        select() {
          return {
            eq(column, value) {
              const filtered = tables.claims.filter((r) => r[column] === value);
              return {
                in(column2, values) {
                  const valueSet = new Set(values);
                  return Promise.resolve({ data: filtered.filter((r) => valueSet.has(r[column2])), error: null });
                },
              };
            },
          };
        },
        delete() {
          return {
            eq(column, value) {
              return {
                in(column2, values) {
                  const valueSet = new Set(values);
                  tables.claims = tables.claims.filter((r) => !(r[column] === value && valueSet.has(r[column2])));
                  return Promise.resolve({ error: null });
                },
              };
            },
          };
        },
      };
    },
  };
}

test('buildDealPlan + writer: claim rows come from buildClaimRowsForCard, and stale cleanup is scoped to matched excerpt_ids only', async () => {
  const { upsertClaims, deleteStaleClaimsForSurvivors } = require('../lib/parser-v2/store-claims');
  const sb = makeMockSb();
  // Seed a stale claim for the matched excerpt (must be swept) and a claim
  // on an untouched excerpt (must survive untouched).
  sb.tables.claims.push({ id: 'stale-claim', deal_id: DEAL_ID, excerpt_id: 'excerpt-rich', attribute: 'oldAttr' });
  sb.tables.claims.push({ id: 'untouched-claim', deal_id: DEAL_ID, excerpt_id: 'excerpt-untouched', attribute: 'x' });

  const plan = buildDealPlan(DEAL_ID, [richCard()], [richProvision()]);
  assert.equal(plan.ok, true);
  assert.ok(plan.claimRows.length > 0);
  assert.ok(plan.claimRows.every((row) => row.excerpt_id === 'excerpt-rich'));

  await upsertClaims(sb, plan.claimRows);
  const staleDeleted = await deleteStaleClaimsForSurvivors(sb, DEAL_ID, plan.matchedExcerptIds, plan.keepClaimIds);

  assert.equal(staleDeleted, 1);
  assert.ok(!sb.tables.claims.some((r) => r.id === 'stale-claim'));
  assert.ok(sb.tables.claims.some((r) => r.id === 'untouched-claim'), 'claims on unmatched cards must be left alone');
  assert.equal(sb.calls.provision_cards.length, 0, 'no provision_cards writes, ever');
});

test('idempotency: building the plan twice from identical state produces identical claim ids, and the second stale-delete pass is empty', async () => {
  const { upsertClaims, deleteStaleClaimsForSurvivors } = require('../lib/parser-v2/store-claims');
  const sb = makeMockSb();

  const planA = buildDealPlan(DEAL_ID, [richCard()], [richProvision()]);
  await upsertClaims(sb, planA.claimRows);
  const firstStale = await deleteStaleClaimsForSurvivors(sb, DEAL_ID, planA.matchedExcerptIds, planA.keepClaimIds);
  assert.equal(firstStale, 0);
  const countAfterFirst = sb.tables.claims.length;

  const planB = buildDealPlan(DEAL_ID, [richCard()], [richProvision()]);
  assert.deepEqual(planA.claimRows.map((r) => r.id).sort(), planB.claimRows.map((r) => r.id).sort());

  await upsertClaims(sb, planB.claimRows);
  const secondStale = await deleteStaleClaimsForSurvivors(sb, DEAL_ID, planB.matchedExcerptIds, planB.keepClaimIds);
  assert.equal(secondStale, 0, 'second pass over identical state must find zero stale claims');
  assert.equal(sb.tables.claims.length, countAfterFirst, 'no duplicate rows created by the second pass');
});

test('no card writes: mock sb never receives insert/update/upsert/delete on provision_cards even across a full plan+write cycle', async () => {
  const { upsertClaims, deleteStaleClaimsForSurvivors } = require('../lib/parser-v2/store-claims');
  const sb = makeMockSb();
  const plan = buildDealPlan(DEAL_ID, [richCard()], [richProvision()]);
  await upsertClaims(sb, plan.claimRows);
  await deleteStaleClaimsForSurvivors(sb, DEAL_ID, plan.matchedExcerptIds, plan.keepClaimIds);
  assert.equal(sb.calls.provision_cards.length, 0);
});

// ---------------------------------------------------------------------------
// Unmatched-with-no-coded-features is fine (not a failure), just reported.
// ---------------------------------------------------------------------------

test('buildDealPlan: unmatched cards and unmatched provisions without coded features do not block ok', () => {
  const extraCard = card({ id: 'card-extra', excerpt_id: 'excerpt-extra', short_title: 'Orphan Card Title', region_full_text: 'Body unique to the card only.' });
  const extraProvision = provision({ id: 'prov-extra', category: 'Orphan Provision Title', full_text: 'Body unique to the provision only.', ai_metadata: { features: { mainConcept: 'MAE' } } });
  const plan = buildDealPlan(DEAL_ID, [card(), extraCard], [provision(), extraProvision]);
  assert.equal(plan.ok, true);
  assert.equal(plan.unmatchedCards.length, 1);
  assert.equal(plan.unmatchedProvisions.length, 1);
});
