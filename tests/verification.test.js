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
