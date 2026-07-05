/* Tests for lib/verification.js — the trust layer.
   Run: npm test  (node --test tests/) */
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeForMatch,
  quoteAppearsIn,
  collectQuotes,
  sanitizeFeatureQuotes,
  verifyDealQuotes,
  computeCoverage,
  locateProvisionInSource,
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

// ── enumerated cross-reference fallback ────────────────────────────────────

const XREF_SOURCE = normalizeForMatch(
  'would have constituted a breach of Section 5.01(a), (d), (f), (g), (k), (m), '
  + '(q), and (r) (solely to the extent related to the foregoing clauses (a), (d) '
  + 'of Section 5.01). Section 3.09. Taxes. Except as set forth in Section 6.02(b), '
  + 'the Company has filed all Tax Returns.',
);

test('expanded cross-reference (Section 5.01(f)) verifies against a compressed enumeration', () => {
  // Source only writes "Section 5.01" once, then bare (d),(f)…; the extractor
  // expands each into a standalone citation. Each must still verify.
  for (const cl of ['a', 'd', 'f', 'g', 'k', 'm', 'q', 'r']) {
    assert.equal(quoteAppearsIn(normalizeForMatch(`Section 5.01(${cl})`), XREF_SOURCE), true, `clause (${cl})`);
  }
});

test('cross-reference with trailing gloss verifies on its leading anchor', () => {
  const q = 'Section 5.01(r) (solely to the extent related to the foregoing clauses (a), (d) of Section 5.01)';
  assert.equal(quoteAppearsIn(normalizeForMatch(q), XREF_SOURCE), true);
});

test('cross-reference to a clause NOT in the enumeration fails', () => {
  // (z) is not among 5.01's enumerated clauses → must not be papered over.
  assert.equal(quoteAppearsIn(normalizeForMatch('Section 5.01(z)'), XREF_SOURCE), false);
});

test('cross-reference does not borrow a paren-clause from an unrelated section', () => {
  // (b) appears in the source, but under Section 6.02, not Section 5.01.
  assert.equal(quoteAppearsIn(normalizeForMatch('Section 5.01(b)'), XREF_SOURCE), false);
});

test('line-break-hyphenated compound in source matches a closed quote', () => {
  // Source split "covenants-not-to-sue" across a line → "covenants- not-to-sue".
  const src = normalizeForMatch('except for non-exclusive licenses and covenants- not-to-sue granted to employees');
  assert.equal(quoteAppearsIn(normalizeForMatch('covenants-not-to-sue granted to employees'), src), true);
});

test('a real dash separator (spaces both sides) is not collapsed into a word', () => {
  const src = normalizeForMatch('the Closing - which occurs at 10am - shall be final');
  // "closing which" must NOT become matchable; the separator stays a boundary.
  assert.equal(normalizeForMatch('the Closing - which occurs').includes('closing - which'), true);
  assert.equal(quoteAppearsIn(normalizeForMatch('the Closing - which occurs at 10am'), src), true);
});

// ── quote-fidelity pass: matcher artifact classes (July 2026) ──────────────

test('space-before-hyphen statutory ref ("13.1 -721") matches a closed quote', () => {
  // Kraft: EDGAR renders "Section 13.1 -721 of the VSCA"; the model quotes it
  // closed. Space AFTER the hyphen was already handled; this is the mirror.
  const src = normalizeForMatch('The Merger shall have the effects set forth in Section 13.1 -721 of the VSCA.');
  assert.equal(quoteAppearsIn(normalizeForMatch('the effects set forth in Section 13.1-721 of the VSCA'), src), true);
});

test('a spaced dash separator is still a word boundary (negative)', () => {
  const src = normalizeForMatch('the Closing - which occurs at 10am - shall be final');
  assert.equal(quoteAppearsIn(normalizeForMatch('the Closing which occurs at 10am'), src), false);
});

test('stray space inside an opening paren ("( LFRP)") matches a closed quote', () => {
  // Dyax/Sanofi/Concho: quote-mark stripping leaves '( LFRP)' in the source.
  const src = normalizeForMatch('its Licensing and Funded Research Program ( LFRP) shall not be deemed ordinary course');
  assert.equal(quoteAppearsIn(normalizeForMatch('Funded Research Program ("LFRP") shall not be deemed'), src), true);
});

test('gap between adjacent parens ("10.2(iii) (a)") matches a closed quote', () => {
  const src = normalizeForMatch('the persons identified on Section 10.2(iii) (a) of the Company Disclosure Letter');
  assert.equal(quoteAppearsIn(normalizeForMatch('identified on Section 10.2(iii)(a) of the Company Disclosure Letter'), src), true);
});

test('paren-spacing tolerance never rescues invented content (negative)', () => {
  const src = normalizeForMatch('the persons identified on Section 10.2(iii) (a) of the Company Disclosure Letter');
  assert.equal(quoteAppearsIn(normalizeForMatch('identified on Section 10.2(iii)(q) of the Parent Schedule of Exceptions'), src), false);
});

test('short quote ending "." where the source continues ":" verifies', () => {
  // Dyax: quote "not to, directly or indirectly." / source "…indirectly: (i)".
  const src = normalizeForMatch('shall instruct its Representatives not to, directly or indirectly: (i) initiate, solicit');
  assert.equal(quoteAppearsIn(normalizeForMatch('not to, directly or indirectly.'), src), true);
});

test('elided quote whose final fragment ends "." where the source continues "," verifies', () => {
  const src = normalizeForMatch(
    'the Company shall instruct and cause its Representatives, agents and advisors not to, (i) initiate, solicit or knowingly '
    + 'encourage the making of any proposal or offer that constitutes an Acquisition Proposal, or (ii) engage in any discussions',
  );
  const q = 'the Company shall instruct and cause its Representatives ... not to, (i) initiate, solicit or knowingly encourage the making of any proposal or offer that constitutes an Acquisition Proposal.';
  assert.equal(quoteAppearsIn(normalizeForMatch(q), src), true);
});

test('trailing-period tolerance never rescues an invented fragment (negative)', () => {
  const src = normalizeForMatch(
    'the Company shall instruct and cause its Representatives, agents and advisors not to, (i) initiate, solicit or knowingly '
    + 'encourage the making of any proposal or offer that constitutes an Acquisition Proposal, or (ii) engage in any discussions',
  );
  const q = 'the Company shall instruct and cause its Representatives ... payable only in preferred stock units of the Parent.';
  assert.equal(quoteAppearsIn(normalizeForMatch(q), src), false);
});

test('trailing-period strip cannot shrink a fragment below the judgeable floor', () => {
  const src = normalizeForMatch('not to, directly or indirectly: (i) initiate');
  // "indirectly...." strips to 10 chars (< MIN_QUOTE_CHARS) — must NOT verify.
  assert.equal(quoteAppearsIn(normalizeForMatch('indirectly....'), src), false);
});

test('elision right after a sentence period (". ...") splits cleanly and verifies', () => {
  // Forest City/Concho: "…Effect. ... except…" normalizes to four glued dots;
  // the old exact-"..." split left ". except…" as an unmatchable fragment.
  const src = normalizeForMatch('would not have a Material Adverse Effect. Except in the case of clauses (ii) and (iii) above, any such breach');
  const q = 'would not have a Material Adverse Effect. ... except in the case of clauses (ii) and (iii) above';
  assert.equal(quoteAppearsIn(normalizeForMatch(q), src), true);
});

test('post-period elision still fails on invented continuation (negative)', () => {
  const src = normalizeForMatch('would not have a Material Adverse Effect. Except in the case of clauses (ii) and (iii) above, any such breach');
  const q = 'would not have a Material Adverse Effect. ... except where the Buyer waives such clauses in writing';
  assert.equal(quoteAppearsIn(normalizeForMatch(q), src), false);
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

test('sanitizeFeatureQuotes removes compressed Glow-style MAE quotes before QA', () => {
  const source = [
    'any failure, in and of itself, by the Company Group to meet (1) any public analyst estimates',
    "or expectations of the Company Group's revenue, earnings or other financial performance or results of operations",
    'for any period; or (2) any internal projections or forecasts of its revenues, earnings or other financial performance',
  ].join(' ');
  const compressed = 'any failure, in and of itself, by the Company Group to meet any public analyst estimates or expectations or internal projections or forecasts';
  const good = 'any public analyst estimates or expectations of the Company Group';
  const features = {
    carveouts: [
      { code: 'FAILURE_TO_MEET_PROJECTIONS', label: 'Failure to meet projections', text: source },
    ],
    nonDisproportionateImpactCarveouts: [
      { code: 'FAILURE_TO_MEET_PROJECTIONS', label: 'Failure to meet projections', text: compressed },
    ],
    failureToMeetProjectionCarveout: { value: true, quotes: [compressed, good] },
  };

  const scrub = sanitizeFeatureQuotes(features, source, { provisionText: source });

  assert.equal(scrub.repaired, 1);
  assert.equal(scrub.removed, 1);
  assert.equal(features.nonDisproportionateImpactCarveouts[0].text, source);
  assert.deepEqual(features.failureToMeetProjectionCarveout.quotes, [good]);
  assert.deepEqual(scrub.details.map((d) => d.path), [
    'nonDisproportionateImpactCarveouts[0].text',
    'failureToMeetProjectionCarveout.quotes[0]',
  ]);

  const verified = verifyDealQuotes([{
    id: 'p1',
    type: 'DEF',
    category: 'Material Adverse Effect',
    full_text: source,
    ai_metadata: { features },
  }], source);
  assert.equal(verified.unverified, 0);
});

test('sanitizeFeatureQuotes does not repair MAE subset quotes from ambiguous same-code carveouts', () => {
  const source = 'changes in GAAP or changes in accounting standards shall not constitute a Material Adverse Effect';
  const features = {
    carveouts: [
      { code: 'ACCOUNTING', label: 'Accounting', text: 'changes in GAAP' },
      { code: 'ACCOUNTING', label: 'Accounting', text: 'changes in accounting standards' },
    ],
    disproportionateImpactCarveouts: [
      { code: 'ACCOUNTING', label: 'Accounting', text: 'changes in GAAP or accounting standards combined summary' },
    ],
  };

  const scrub = sanitizeFeatureQuotes(features, source, { provisionText: source });

  assert.equal(scrub.repaired, 0);
  assert.equal(scrub.removed, 1);
  assert.equal(features.disproportionateImpactCarveouts[0].text, null);
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

test('locateProvisionInSource prefers matching text after the parent IOC heading', () => {
  const duplicate = '(i) declare, set aside or pay any dividend or make any other distribution in respect of capital stock without consent. ';
  const source = [
    'Table of Contents 6.2 Conduct of Parent Business Pending the Merger',
    '6.1 Conduct of Company Business Pending the Merger.',
    duplicate.repeat(3),
    '6.2 Conduct of Parent Business Pending the Merger.',
    duplicate.repeat(3),
    '6.3 No Solicitation by the Company.',
  ].join(' ');
  const provision = {
    type: 'IOC-B',
    full_text: duplicate.repeat(3),
    ai_metadata: { features: { sectionNumber: '6.2(i)' } },
  };
  const located = locateProvisionInSource(provision, source);
  const normSource = normalizeForMatch(source);
  const parentHeading = normSource.lastIndexOf('6.2 conduct of parent business pending the merger.');
  assert.ok(parentHeading > 0);
  assert.ok(located.start > parentHeading, `located ${located.start} should be after parent heading ${parentHeading}`);
});

test('locateProvisionInSource uses parent NoSol section hints for duplicate parent-side clauses', () => {
  const duplicate = '(f) Parent shall not waive any standstill provision unless the Parent Board determines that failure to do so would be inconsistent with its fiduciary duties. ';
  const source = [
    'Table of Contents 6.4 No Solicitation by Parent',
    '6.3 No Solicitation by the Company.',
    duplicate.repeat(3),
    '6.4 No Solicitation by Parent.',
    duplicate.repeat(3),
  ].join(' ');
  const provision = {
    type: 'NOSOL',
    full_text: duplicate.repeat(3),
    ai_metadata: { features: { canonicalCode: 'NOSOL-STANDSTILL-WAIVER' } },
  };
  const located = locateProvisionInSource(provision, source);
  const normSource = normalizeForMatch(source);
  const parentHeading = normSource.lastIndexOf('6.4 no solicitation by parent.');
  assert.ok(parentHeading > 0);
  assert.ok(located.start > parentHeading, `located ${located.start} should be after parent heading ${parentHeading}`);
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

test('attached charter/bylaws exhibit is excluded from the coverage denominator', () => {
  const { detectAncillaryRegions, normalizeForMatch } = require('../lib/verification');
  const body = 'Section 9.1 Amendments. This Agreement may be amended. '.repeat(300);
  const sig = ' IN WITNESS WHEREOF, the parties have caused this Agreement to be executed as of the date first written above. ';
  const charter = ' EXHIBIT A ARTICLES OF INCORPORATION OF CSRA INC. ARTICLE I The name of the corporation is CSRA Inc. Its registered office in the State of Nevada is located at 100 Main St. ' + 'Offices and places of business either within or without the State of Nevada may be established. '.repeat(60);
  const norm = normalizeForMatch(body + sig + charter);
  const regions = detectAncillaryRegions(norm);
  assert.equal(regions.length, 1);
  assert.ok(/articles of incorporation/.test(regions[0][2]));
});

test('detectAncillaryRegions: def-appendix mid-tail carves out ONLY the appendix (Kraft shape)', () => {
  // Kraft tail order: signature → charter exhibit → index of defined terms →
  // by-laws → EOF. The old carve-back ended the exclusion at the index header,
  // returning ~200k of by-laws to the denominator (coverage 59.6% on a
  // fully-extracted deal). Both exhibit spans must be excluded; the appendix
  // span stays in.
  const { detectAncillaryRegions } = require('../lib/verification');
  const pad = (label, n) => `${label} ${'lorem ipsum dolor sit '.repeat(n)}`;
  // Body must be long enough that the charter exhibit sits past the 40%-of-doc
  // scan floor in detectAncillaryRegions.
  const body = pad('agreement and plan of merger dated as of march 24, 2015. section 1.01. the merger.', 600);
  const sig = 'in witness whereof, the parties have caused this agreement to be executed by their officers. ';
  const charter = pad('exhibit a certificate of incorporation of the surviving corporation. the name of the corporation is kraft heinz. registered office in delaware.', 200);
  const appendix = pad('index of defined terms term section acceptable confidentiality agreement 5.05 acquisition proposal 5.05', 100);
  const bylaws = pad('by-laws of the kraft heinz company article i offices. the registered office shall be in the city of wilmington.', 300);
  const source = [body, sig, charter, appendix, bylaws].join(' ');

  const spans = detectAncillaryRegions(source.toLowerCase());
  assert.equal(spans.length, 2, `expected 2 excluded spans, got ${JSON.stringify(spans)}`);
  const charterAt = source.toLowerCase().indexOf('exhibit a certificate');
  const appendixAt = source.toLowerCase().indexOf('index of defined terms');
  const bylawsAt = source.toLowerCase().indexOf('by-laws of');
  // Span 1 covers the charter and ends at the appendix.
  assert.ok(Math.abs(spans[0][0] - charterAt) < 200, `span1 start ${spans[0][0]} vs charter ${charterAt}`);
  assert.ok(Math.abs(spans[0][1] - appendixAt) < 200, `span1 end ${spans[0][1]} vs appendix ${appendixAt}`);
  // Span 2 starts at the by-laws and runs to EOF — the appendix itself is kept.
  assert.ok(Math.abs(spans[1][0] - bylawsAt) < 200, `span2 start ${spans[1][0]} vs bylaws ${bylawsAt}`);
  assert.equal(spans[1][1], source.length);
});

test('detectAncillaryRegions does not keep charter article definitions as merger-agreement definitions', () => {
  const { detectAncillaryRegions } = require('../lib/verification');
  const pad = (label, n) => `${label} ${'lorem ipsum dolor sit '.repeat(n)}`;
  const body = pad('agreement and plan of merger section 9.01 termination.', 600);
  const sig = 'in witness whereof, the parties have caused this agreement to be executed by their officers. ';
  const charterStart = pad('exhibit a certificate of incorporation. the name of the corporation is the kraft heinz company. registered office in delaware.', 80);
  const preferred = pad('certain definitions for purposes of this article iv the following terms shall have the meanings indicated. base amount means series a preferred stock redemption amounts. dividends shall accrue daily.', 260);
  const bylaws = pad('by-laws of the kraft heinz company article i offices.', 160);
  const source = [body, sig, charterStart, preferred, bylaws].join(' ').toLowerCase();

  const spans = detectAncillaryRegions(source);
  assert.equal(spans.length, 1, `expected one excluded charter span, got ${JSON.stringify(spans)}`);
  const charterAt = source.indexOf('exhibit a certificate');
  assert.ok(Math.abs(spans[0][0] - charterAt) < 200, `span start ${spans[0][0]} vs charter ${charterAt}`);
  assert.equal(spans[0][1], source.length);
});
