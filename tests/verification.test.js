/* Tests for lib/verification.js — the trust layer.
   Run: npm test  (node --test tests/) */
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeForMatch,
  quoteAppearsIn,
  collectQuotes,
  verifyDealQuotes,
  computeCoverage,
} = require('../lib/verification');

// ── normalizeForMatch ──────────────────────────────────────────────────────

test('normalizeForMatch strips pipeline markers and stray space-before-punctuation', () => {
  assert.equal(
    normalizeForMatch('subject to [[REF]]Article VII[[/REF]], the closing (the Closing)'),
    'subject to article vii, the closing (the closing)',
  );
});

test('normalizeForMatch removes quote marks/apostrophes, normalizes dashes/whitespace', () => {
  assert.equal(
    normalizeForMatch('“Company’s  best\n efforts” — always'),
    'companys best efforts - always',
  );
});

test('apostrophe-stripped source still matches an apostrophed quote', () => {
  // The cleaning pipeline drops possessives from the stored source.
  const src = normalizeForMatch('any change in the market price of the Companys stock');
  assert.equal(quoteAppearsIn(normalizeForMatch("the market price of the Company's stock"), src), true);
});

test('unquoted stored definition matches quoted source term', () => {
  const src = normalizeForMatch('"Acquisition Proposal" means any inquiry, proposal or offer from any Person');
  assert.equal(quoteAppearsIn(normalizeForMatch('Acquisition Proposal means any inquiry, proposal or offer'), src), true);
});

test('mid-ellipsis quote verifies fragment-by-fragment', () => {
  const src = normalizeForMatch(
    'each option to purchase Shares granted under a Company Equity Plan that is outstanding shall vest, having an exercise price per Share',
  );
  assert.equal(
    quoteAppearsIn(normalizeForMatch('granted under a Company Equity Plan ... having an exercise price'), src),
    true,
  );
  assert.equal(
    quoteAppearsIn(normalizeForMatch('granted under a Company Equity Plan ... payable in preferred stock units'), src),
    false,
  );
});

// ── quoteAppearsIn ─────────────────────────────────────────────────────────

const SOURCE = normalizeForMatch(`
  Section 7.3. Termination Fee. The Company shall pay Parent a fee of
  $190,000,000 (the “Company Termination Fee”) upon termination pursuant to
  [[REF]]Section 7.1(g)[[/REF]] — a Superior Proposal termination — within two
  (2) Business Days after such termination.
`);

test('exact quote verifies despite marker/typography differences', () => {
  assert.equal(
    quoteAppearsIn(normalizeForMatch('The Company shall pay Parent a fee of $190,000,000'), SOURCE),
    true,
  );
});

test('truncated quote with trailing ellipsis verifies on its head', () => {
  assert.equal(
    quoteAppearsIn(normalizeForMatch('upon termination pursuant to Section 7.1(g)…'), SOURCE),
    true,
  );
});

test('invented quote fails verification', () => {
  assert.equal(
    quoteAppearsIn(normalizeForMatch('the fee shall be reduced by fifty percent in all events'), SOURCE),
    false,
  );
});

test('too-short quote is unjudgeable (null), not falsely verified', () => {
  assert.equal(quoteAppearsIn(normalizeForMatch('the fee'), SOURCE), null);
});

// ── collectQuotes ──────────────────────────────────────────────────────────

test('collectQuotes finds quotes arrays, legacy text, tagged text — not plain values', () => {
  const feats = {
    feeAmount: { value: '$190,000,000', quotes: ['a fee of $190,000,000 (the "Company Termination Fee")'] },
    soleRemedy: { value: true, text: 'shall be the sole and exclusive remedy' }, // legacy citable
    carveouts: [
      { code: 'PANDEMIC', label: 'Pandemic', text: 'any pandemic or epidemic' }, // tagged
    ],
    mainConcept: 'a plain summary string that is NOT a quote',
    nested: { deeper: { quotes: ['nested quote content here'] } },
  };
  const got = collectQuotes(feats).map((q) => q.quote);
  assert.deepEqual(got.sort(), [
    'a fee of $190,000,000 (the "Company Termination Fee")',
    'any pandemic or epidemic',
    'nested quote content here',
    'shall be the sole and exclusive remedy',
  ].sort());
});

// ── verifyDealQuotes ───────────────────────────────────────────────────────

test('verifyDealQuotes separates verified / unverified / skipped', () => {
  const source = 'The Company shall pay Parent a fee of $190,000,000 within two Business Days.';
  const provisions = [{
    id: 'p1', type: 'TERMF', category: 'Fee', full_text: source,
    ai_metadata: { features: {
      good: { value: 1, quotes: ['a fee of $190,000,000 within two Business Days'] },
      bad: { value: 2, quotes: ['a fee of $250,000,000 payable in stock consideration'] },
      tiny: { value: 3, quotes: ['a fee'] },
    } },
  }];
  const r = verifyDealQuotes(provisions, source);
  assert.equal(r.total, 3);
  assert.equal(r.verified, 1);
  assert.equal(r.unverified, 1);
  assert.equal(r.skipped, 1);
  assert.equal(r.failures[0].in_provision_text, false);
});

// ── computeCoverage ────────────────────────────────────────────────────────

test('computeCoverage merges overlapping provisions and finds the gap', () => {
  const block = (label) => `${label} ${'lorem ipsum dolor sit amet consectetur '.repeat(20)}`;
  const a = block('SECTION ONE.');
  const b = block('SECTION TWO.');
  const gap = block('MISSED BLOCK.');
  const c = block('SECTION THREE.');
  const source = [a, b, gap, c].join(' ');
  const provisions = [
    { full_text: a }, { full_text: b }, { full_text: c },
    { full_text: b }, // duplicate → overlap must not double-count
  ];
  const r = computeCoverage(provisions, source, { minGapChars: 100 });
  assert.equal(r.located, 4);
  assert.equal(r.unlocated, 0);
  assert.ok(r.pct > 65 && r.pct < 90, `pct=${r.pct}`);
  assert.equal(r.gaps.length, 1);
  assert.ok(r.gaps[0].preview.startsWith('missed block.'));
});

test('computeCoverage reports unlocated provisions instead of failing', () => {
  const r = computeCoverage(
    [{ full_text: 'this text does not appear anywhere in the source document at all, definitely not' }],
    'a completely different agreement body text that goes on for a while and has nothing in common',
  );
  assert.equal(r.located, 0);
  assert.equal(r.unlocated, 1);
  assert.equal(r.pct, 0);
});

// ── splitSubClauses: conflated COND refinement ─────────────────────────────

test('conflated tender-offer condition splits at the covenant/reps boundary', () => {
  const { splitSubClauses } = require('../lib/parser-v2/extract');
  const annex = `(a) there is a pending injunction prohibiting consummation of the Offer and related matters.
(b) (i) the Company has breached or failed to comply in any material respect with any of its agreements or covenants to be performed or complied with by it under the Agreement on or before the Acceptance Time, (ii) the representations and warranties of the Company contained in the Agreement and that (x) are not made as of a specific date are not true and correct as of the Expiration Date and (y) are made as of a specific date are not true as of such date, except where the failure would not have a Company Material Adverse Effect.
(c) the Company has not delivered a certificate signed by an executive officer confirming the foregoing.`;
  const parts = splitSubClauses(annex, 'COND-B');
  const letters = parts.map((p) => p.letter);
  assert.deepEqual(letters, ['a', 'b.1', 'b.2', 'c']);
  assert.match(parts[1].text, /covenants/);
  assert.match(parts[2].text, /representations and warranties/);
  assert.match(parts[2].text, /\(y\)/); // date mechanics stay with the reps limb
});

test('rep bring-down WITHOUT a covenant limb is never split', () => {
  const { splitSubClauses } = require('../lib/parser-v2/extract');
  const oneStep = `(a) the representations and warranties of the Company that (i) are not made as of a specific date are true and correct and (ii) are made as of a date are true as of such date, except where failure would not have an MAE, and such representations shall survive in accordance with their terms as set forth herein.
(b) no Legal Restraint is in effect enjoining or otherwise prohibiting the consummation of the Merger or the other transactions.`;
  const parts = splitSubClauses(oneStep, 'COND-B');
  assert.deepEqual(parts.map((p) => p.letter), ['a', 'b']);
});

// ── ancillary-document exclusion in coverage ───────────────────────────────

const { detectAncillaryRegions } = require('../lib/verification');

function buildFiling() {
  const body = `Section 1.1 ${'the merger agreement operative body text goes here and continues at length '.repeat(60)}`;
  const sig = 'IN WITNESS WHEREOF, the parties have caused this Agreement to be executed as of the date first written above.';
  const exhibitADefs = `Exhibit A Certain Definitions ${'Acquisition Proposal means any proposal or offer. Affiliate means a controlled entity. '.repeat(20)}`;
  // A real attached agreement (has preamble) + a defined-term reference (does not).
  const cvr = `Exhibit B Contingent Value Rights Agreement This Contingent Value Rights Agreement is made and entered into as of the date hereof by and between Parent and the Rights Agent. ${'CVR payment mechanics and milestone definitions follow at length here. '.repeat(60)}`;
  return { body, sig, exhibitADefs, cvr, full: `${body}\n${sig}\n${exhibitADefs}\n${cvr}` };
}

test('detectAncillaryRegions excludes the attached CVR agreement, keeps Exhibit A defs', () => {
  const f = buildFiling();
  const norm = normalizeForMatch(f.full);
  const regions = detectAncillaryRegions(norm);
  assert.equal(regions.length, 1);
  assert.match(regions[0][2], /contingent value rights agreement/);
  // The excluded span starts at the CVR agreement, not at Exhibit A.
  const start = regions[0][0];
  assert.ok(norm.slice(start, start + 60).includes('contingent value rights agreement'));
  assert.ok(!norm.slice(start).includes('acquisition proposal means')); // Exhibit A is before it → kept
});

test('a defined-term reference to an agreement (no preamble) is NOT excluded', () => {
  const withRef = `Section 1.1 body ${'x '.repeat(200)}. IN WITNESS WHEREOF, the parties have caused this Agreement to be executed. Exhibit A Certain Definitions Ancillary Agreements means, collectively, the Voting Agreement and the CVR Agreement, in each case as amended.`;
  const regions = detectAncillaryRegions(normalizeForMatch(withRef));
  assert.equal(regions.length, 0); // no attached agreement, just a definition mentioning them
});

test('computeCoverage denominator excludes ancillary; rawPct includes it', () => {
  const f = buildFiling();
  // Code the body + Exhibit A defs, but NOT the CVR agreement.
  const provisions = [{ full_text: f.body }, { full_text: f.exhibitADefs }];
  const cov = computeCoverage(provisions, f.full);
  assert.ok(cov.excludedChars > 2000, `excluded=${cov.excludedChars}`);
  assert.ok(cov.pct > cov.rawPct, `pct ${cov.pct} should exceed rawPct ${cov.rawPct}`);
  assert.ok(cov.pct >= 85, `effective coverage should be high once CVR excluded, got ${cov.pct}`);
  // The CVR agreement is not reported as a "missed" gap.
  assert.ok(!cov.gaps.some((g) => g.preview.includes('cvr payment mechanics')));
});

test('includeAncillary:true measures the raw filing (no exclusion)', () => {
  const f = buildFiling();
  const provisions = [{ full_text: f.body }, { full_text: f.exhibitADefs }];
  const cov = computeCoverage(provisions, f.full, { includeAncillary: true });
  assert.equal(cov.excludedChars, 0);
  assert.equal(cov.pct, cov.rawPct);
});
