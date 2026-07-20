// Ben feedback r16 (Skechers/3G Capital review page):
//  1. Proration rows must say HOW proration works (deterministic mechanism
//     line off the clause shape), full clause behind "See provision".
//  2. "Award / contribution cutoff treatment" is DISTINCT from the equity
//     table's consideration column (it is the grant-date cutoff for new
//     awards) -- retitled and re-rendered in the table's voice.
//  3. Knowledge persons: one pill PER person/role, never an "Other named
//     person(s)" grouping.
//  4. Raw-dump conversion: intervening-event definition gets a structured
//     headline; advisers-fees-expenses detail (a genuine inline-dump site,
//     NOT covered by ProvisionTable's FULL_TEXT_COLUMNS relocation) routes
//     through the shared see-text truncation.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

let heroMod;
let equityMod;
let repsMod;
let interveningMod;
let advisersMod;
test.before(async () => {
  const dir = path.join('..', 'components', 'review', 'table-configs');
  heroMod = await import(path.join(dir, 'consideration-hero.config.js'));
  equityMod = await import(path.join(dir, 'equity-awards.config.js'));
  repsMod = await import(path.join(dir, 'representations-qualifiers.config.js'));
  interveningMod = await import(path.join(dir, 'nosol-intervening.config.js'));
  advisersMod = await import(path.join(dir, 'advisers-fees-expenses.config.js'));
});

// Stub primitives matching the shared contract: TruncatedWithSeeText marks
// gated text so assertions can distinguish inline from behind-see-text.
function primitives() {
  function PillCell({ label }) { return React.createElement('span', { className: 'pill' }, `[PILL ${label}]`); }
  function EvidenceHoverSource({ children }) { return React.createElement('span', null, children); }
  function TruncatedWithSeeText({ text }) {
    const t = String(text || '');
    if (t.length <= 160) return React.createElement('span', null, t);
    return React.createElement('span', null, `${t.slice(0, 160)} [See provision]`);
  }
  return { PillCell, EvidenceHoverSource, TruncatedWithSeeText, ClampedWithSeeText: TruncatedWithSeeText };
}

// ── Item 1: proration mechanism lines ──────────────────────────────────────

// Real Skechers shape: the CONSID-CONVERT mechanics object carries the
// non-election default with NO oversubscription clause; the oversubscription
// clause lives on the CONSID-EXCHANGE card's mechanics object.
const SKECHERS_CONVERT_PM = {
  text: 'each share of Company Common Stock with respect to which a Mixed Election or Cash Election Consideration has not been validly made or has been revoked, deemed revoked or lost before the Election Deadline ("Non-Election Shares") shall be converted automatically into the right to receive the Cash Election Consideration.',
  electionType: 'MIXED_ELECTION',
  electionDeadline: 'Election Deadline',
  oversubscriptionTreatment: null,
};
const SKECHERS_EXCHANGE_PM = {
  text: 'Each holder of Company Common Stock may specify the number of shares for which such holder elects the Mixed Election Consideration or the Cash Election Consideration.',
  electionType: 'MIXED_ELECTION',
  oversubscriptionTreatment: 'If the aggregate number of Mixed Election Shares exceeds the Maximum Equity Election Cap, then: (i) all Mixed Election Shares of each holder thereof will be converted into the right to receive the Mixed Election Consideration in respect of that number of Mixed Election Shares equal to the product obtained by multiplying (A) the number of Mixed Election Shares held by such holder by (B) a fraction, the numerator of which is the Maximum Equity Election Cap and the denominator of which is the aggregate number of Mixed Election Shares, with the remaining number of such holder’s Mixed Election Shares being converted into the right to receive the Cash Election Consideration',
};
// Real QXO shape: percentage caps in the text, symmetric cash/stock
// oversubscription clause.
const QXO_PM = {
  text: 'the maximum number of Company Shares to be converted into the right to receive Cash Consideration shall be equal to forty-five percent (45%) of the aggregate number of Company Shares issued and outstanding (the "Maximum Cash Election Number") and the maximum number of Company Shares to be converted into the right to receive Stock Consideration shall be equal to fifty-five percent (55%) of the aggregate number of Company Shares issued and outstanding (the "Maximum Stock Election Number").',
  electionType: 'MIXED_ELECTION',
  oversubscriptionTreatment: 'In the event that the aggregate number of Cash Election Shares exceeds the Maximum Cash Election Number, all Stock Election Shares shall be converted into the right to receive Stock Consideration, and all Cash Election Shares shall be prorated. In the event that the aggregate number of Stock Election Shares exceeds the Maximum Stock Election Number, all Cash Election Shares shall be converted into the right to receive Cash Consideration.',
};

test('proration: Skechers mixed-election shape yields the cut-back mechanism + non-election default', () => {
  const line = heroMod.summarizeProrationMechanism([SKECHERS_CONVERT_PM, SKECHERS_EXCHANGE_PM]);
  assert.ok(line, 'expected a mechanism line');
  assert.match(line, /mixed \(cash \+ stock\) elections exceed the equity election cap/i);
  assert.match(line, /prorated back to the cap pro rata/i);
  assert.match(line, /remainder paid as the cash election consideration/i);
  assert.match(line, /Shares with no valid election receive the Cash Election Consideration/);
});

test('proration: QXO two-sided shape yields caps + symmetric oversubscription line', () => {
  const line = heroMod.summarizeProrationMechanism([QXO_PM]);
  assert.ok(line);
  assert.match(line, /Caps: 45% cash \/ 55% stock/);
  assert.match(line, /If either side is oversubscribed/);
  assert.match(line, /prorated back to the cap/);
});

test('proration: no confident mechanism -> null (never a raw dump, never a guess)', () => {
  assert.equal(heroMod.summarizeProrationMechanism([]), null);
  assert.equal(heroMod.summarizeProrationMechanism([{ text: 'No election shall be made available and no proration shall apply.', electionType: null, oversubscriptionTreatment: null }]), null);
});

test('proration: the consideration-hero row carries the mechanism line with the full clause as evidence', () => {
  const reviewDeal = {
    cards: [{
      id: 'convert-1',
      provision_subtype: 'CONSID-CONVERT',
      short_title: 'Conversion of Shares',
      primary_quote: 'Section 2.7 Conversion of Shares. Each share of Company Common Stock...',
      features: { considerationType: 'MIXED', perShareAmount: '63.00', prorationMechanics: SKECHERS_CONVERT_PM },
    }, {
      id: 'exchange-1',
      provision_subtype: 'CONSID-CONVERT',
      short_title: 'Exchange of Certificates',
      primary_quote: 'Section 2.9 Exchange of Certificates...',
      features: { prorationMechanics: SKECHERS_EXCHANGE_PM },
    }],
  };
  const rows = heroMod.considerationHeroConfig.selectRows(reviewDeal);
  const row = rows.find((r) => r.id === 'consideration-hero-prorationMechanics');
  assert.ok(row, 'proration row present');
  assert.ok(row.prorationSummary, 'row flagged as mechanism summary');
  assert.match(row.detail, /prorated back to the cap/i);
  // Full source language stays reachable: evidence carries the actual
  // oversubscription clause, and the rendered cell has a See provision
  // expander over it.
  assert.match(row.evidence, /Maximum Equity Election Cap/);
  const html = renderToStaticMarkup(React.createElement('div', null, heroMod.renderDetail(row, { primitives: primitives() })));
  assert.match(html, /See provision/);
  assert.match(html, /Maximum Equity Election Cap/);
});

// ── Item 2: cutoff row verdict (distinct -> retitled + summarized) ─────────

const SKECHERS_CUTOFF = 'At the Effective Time, by virtue of the Merger, each Company RSU, whether vested or unvested, that is outstanding as of immediately prior to the Effective Time and that was granted on or before the date of this Agreement shall be fully vested, cancelled and automatically converted into the right to receive the Cash Election Consideration for each share of Company Common Stock subject to such Company RSU, subject to any applicable withholding Taxes payable in respect thereof (the "Company RSU Consideration"). At the Effective Time, by virtue of the Merger, each Company RSU that is outstanding as of immediately prior to the Effective Time and that was granted after the date of this Agreement shall be treated as set forth in Section 5.2(l) of the Company Disclosure Letter.';

test('cutoff: extractCutoffSummary keeps only the grant-date-cutoff sentence (drops the duplicative RSU cash-out restatement)', () => {
  const summary = equityMod.extractCutoffSummary(SKECHERS_CUTOFF);
  assert.ok(summary);
  assert.match(summary, /granted after the date of this Agreement/);
  assert.match(summary, /Section 5\.2\(l\) of the Company Disclosure Letter/);
  assert.ok(!/granted on or before the date of this Agreement/.test(summary), 'pre-signing cash-out sentence (the duplicate of the RSU consideration cell) must be dropped from the summary');
});

test('cutoff: no cutoff-shaped sentence -> null (row falls back to the full text, still gated)', () => {
  assert.equal(equityMod.extractCutoffSummary('Each award is cancelled at closing for cash.'), null);
});

test('cutoff row: retitled in the table voice and rendered behind see-text, never inline', () => {
  const card = {
    id: 'skx-equity',
    provision_type: 'CONSIDERATION',
    provision_subtype: 'CONSID-EQUITY',
    short_title: 'Treatment of Equity Awards / Stock Plans',
    primary_quote: 'Section 2.8 Treatment of Company Equity Awards...',
    features: { cutoffTreatment: SKECHERS_CUTOFF },
  };
  const rows = equityMod.equityAwardRows([card]);
  const cutoff = rows.find((r) => r.id.startsWith('equity-awards-cutoff-'));
  assert.ok(cutoff, 'cutoff row present');
  assert.equal(cutoff.instrument, 'New grants / contributions after signing');
  assert.match(cutoff.considerationLabel, /granted after the date of this Agreement/);
  // The full stored clause survives on evidence for the see-text expander.
  assert.equal(cutoff.evidence, SKECHERS_CUTOFF);
  // Rendered consideration cell routes through TruncatedWithSeeText: the
  // full 790-char clause never renders inline (r16 sweep: this was one of
  // the two genuine inline-dump sites corpus-wide).
  const considerationColumn = equityMod.equityAwardsConfig.columns.find((c) => c.id === 'consideration');
  const html = renderToStaticMarkup(React.createElement('div', null, considerationColumn.renderCell(cutoff, { primitives: primitives() })));
  assert.ok(!html.includes('Company RSU Consideration'), 'tail of the long clause must not render inline');
});

// ── Item 3: per-person knowledge pills ─────────────────────────────────────

function knowledgeDefCard({ quote, definitionText, persons }) {
  return {
    id: 'def-knowledge',
    provision_type: 'DEFINITION',
    provision_subtype: 'DEF-KNOWLEDGE',
    defined_term: 'Knowledge',
    short_title: 'Knowledge',
    primary_quote: quote,
    features: { knowledgePersons: persons, definitionText },
  };
}

test('knowledge persons: named individuals each get their own entry -- never an "Other named person" grouping (Apollo shape)', () => {
  const card = knowledgeDefCard({
    quote: '"Knowledge" means, (i) with respect to the Company, the actual knowledge, after reasonable inquiry, of each of Robert Morse, Jonathan Slager, Adam O’Farrell, Katherine Elsnab, and Matthew Grant, and (ii) with respect to Parent and the Merger Subs, the actual knowledge, after reasonable inquiry, of David Sambur.',
    definitionText: '(i) with respect to the Company, the actual knowledge, after reasonable inquiry, of each of Robert Morse, Jonathan Slager, Adam O’Farrell, Katherine Elsnab, and Matthew Grant, and (ii) with respect to Parent and the Merger Subs, the actual knowledge, after reasonable inquiry, of David Sambur',
    persons: ['OTHER', 'OTHER', 'OTHER', 'OTHER', 'OTHER', 'OTHER'],
  });
  const entries = repsMod.knowledgePersonsEntries([card]);
  assert.ok(entries);
  assert.equal(entries.length, 6, 'one entry per named person');
  const labels = entries.map((e) => e.label);
  assert.deepEqual(labels, ['Robert Morse', 'Jonathan Slager', 'Adam O’Farrell', 'Katherine Elsnab', 'Matthew Grant', 'David Sambur']);
  assert.ok(!labels.some((l) => /other named person/i.test(l)));
});

test('knowledge persons: Skechers numbered role list resolves the OTHER items to their actual roles', () => {
  const card = knowledgeDefCard({
    quote: '(ss) "Knowledge" of the Company, with respect to any matter in question, means the actual knowledge of (i) the Company’s Chief Financial Officer or General Counsel, (ii) Director, Tax or (iii) Senior Vice President, Global Controller, in each case after reasonable inquiry of those employees who would reasonably be expected to have actual knowledge of the matter in question.',
    definitionText: 'with respect to any matter in question, means the actual knowledge of the Company’s Chief Financial Officer or General Counsel, Director, Tax or Senior Vice President, Global Controller, in each case after reasonable inquiry',
    persons: ['GENERAL_COUNSEL', 'OTHER', 'OTHER', 'CFO'],
  });
  const entries = repsMod.knowledgePersonsEntries([card]);
  assert.ok(entries);
  assert.equal(entries.length, 4);
  const labels = entries.map((e) => e.label);
  assert.ok(labels.includes('Director, Tax'), `expected role pill, got ${labels.join(' | ')}`);
  assert.ok(labels.includes('Senior Vice President, Global Controller'));
  assert.ok(!labels.some((l) => /other named person/i.test(l)));
});

test('knowledge persons: unextractable OTHER items still render per-item (no collapse of distinct items)', () => {
  const card = knowledgeDefCard({
    quote: '"Knowledge" means the actual knowledge of the specified individuals.',
    definitionText: 'the actual knowledge of the specified individuals',
    persons: ['OTHER', 'OTHER'],
  });
  const entries = repsMod.knowledgePersonsEntries([card]);
  assert.ok(entries);
  assert.equal(entries.length, 2, 'each OTHER item keeps its own entry -- never merged into one');
});

// ── Item 4: structured-vs-dump conversions ─────────────────────────────────

test('intervening definition: Skechers clause shape yields the structured headline', () => {
  const line = interveningMod.summarizeInterveningDefinition('any material event or development or material change in circumstances with respect to the Company that (A) was not actually known to, or reasonably expected by, the Company Board as of the date hereof; and (B) does not relate to (1) any Acquisition Proposal; or (2) the mere fact, in and of itself, that the Company meets or exceeds any internal or published projections, forecasts, estimates or predictions of revenue, earnings or other financial or operating metrics');
  assert.ok(line);
  assert.match(line, /^Material event, development or change not known \(or reasonably foreseeable\) to the Board at signing/);
  assert.match(line, /excludes Acquisition Proposal-related events and meeting\/exceeding projections/);
});

test('intervening definition: no knowledge-gate shape -> null (falls back to collapsed prose, never a fabricated summary)', () => {
  assert.equal(interveningMod.summarizeInterveningDefinition('a positive development affecting the Company.'), null);
});

test('intervening definition row renders the headline pill with the full definition behind See provision', () => {
  const card = {
    id: 'nosol-int',
    provision_type: 'COVENANT_NO_SOLICITATION',
    provision_subtype: 'NOSOL-INTERVENING',
    short_title: 'Intervening Event',
    primary_quote: 'the Company Board may effect a Company Board Recommendation Change in response to an Intervening Event...',
    features: { interveningEventDefinition: 'any material event or development or material change in circumstances with respect to the Company that (A) was not actually known to, or reasonably expected by, the Company Board as of the date hereof; and (B) does not relate to (1) any Acquisition Proposal' },
  };
  const rows = interveningMod.nosolInterveningConfig.selectRows({ cards: [card] });
  const definitionRow = rows.find((r) => r.id === 'nosol-intervening-definition');
  assert.ok(definitionRow);
  assert.ok(definitionRow.summary, 'structured headline derived');
  const html = renderToStaticMarkup(React.createElement('div', null, interveningMod.renderSignals(definitionRow, { primitives: primitives() })));
  assert.match(html, /\[PILL Material event, development or change not known/);
  assert.match(html, /See provision/);
});

test('advisers-fees-expenses detail: long clause routes through see-text truncation, never inline (genuine inline-dump site)', () => {
  const longClause = 'each of Marriott and Starwood shall bear and pay one-half of the costs and expenses (other than the fees and expenses of each party’s attorneys and accountants, which shall be paid by the party incurring such expenses) incurred in connection with the filing, printing and mailing of the Joint Proxy Statement and the Form S-4 and any amendments or supplements thereto, and one-half of any filing fees required under the HSR Act or other antitrust laws.';
  const row = { id: 'advisers-fees-expenses-fee-expense', label: 'Fee / expense allocation', detail: longClause, evidence: longClause, sourceCard: null, present: true };
  const detailColumn = advisersMod.advisersFeesExpensesConfig.columns.find((c) => c.id === 'detail');
  const html = renderToStaticMarkup(React.createElement('div', null, detailColumn.renderCell(row, { primitives: primitives() })));
  assert.ok(!html.includes('other antitrust laws'), 'tail of the long clause must not render inline');
  assert.match(html, /See provision/);
});
