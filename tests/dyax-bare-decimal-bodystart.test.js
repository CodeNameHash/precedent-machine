/* Regression test for the Dyax/Shire TOC-less bare-decimal body-start bug
   (lib/parser-v2/structural findBodyStart).

   Failure mechanism: Dyax's stored merger-agreement text has NO "TABLE OF
   CONTENTS", no surviving "ARTICLE" heading line, and no "SECTION"/"Section"
   keyword on its first section — the body opens directly with a bare
   "1.1 The Merger. Upon the terms ..." right after the cover page, with no
   WHEREAS recitals surviving cleanup either. None of findBodyStart's
   existing anchor paths (preamble, TOC, keyworded "SECTION 1.0?1") match
   that shape, so the search kept going — and landed on the APPENDED CVR
   AGREEMENT exhibit's own genuine "TABLE OF CONTENTS" + preamble + Article I
   "1.1 Definitions", discarding the entire merger agreement (Articles
   I-IX). Confirmed against the real stored deals.metadata.full_text for
   Dyax: pre-fix bodyStart landed at char ~266k (33 sections, all from the
   appended CVR/bylaws exhibits); post-fix bodyStart lands at char 163 (48
   sections, 1.1 through 9.13, all from the real merger agreement).

   The fix adds a fallback anchor that only engages once the existing
   cascades land implausibly late (mirrors repairRunawayTocBlock's own
   late-offset discriminator for the same class of bug), and only accepts a
   bare "1.1"/"1.01" match near the front of the document whose same-line
   text is a Title-Case, period-terminated phrase — the same validation
   parseSections' strictBare pattern already applies to bare headings
   elsewhere in the body, so prose like "1.1 million shares" (lowercase word
   right after the number) can never anchor.
   Run: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseStructure } = require('../lib/parser-v2/structural');

const FILLER = ' The parties agree to perform their respective obligations under this Agreement in accordance with its terms and applicable Law, subject in each case to the exceptions and qualifications set forth herein, and to cooperate in good faith to consummate the transactions contemplated hereby.';
const BODY_FILLER = FILLER.repeat(20);

test('Dyax shape: TOC-less bare-decimal body start beats an appended CVR-agreement exhibit with its own TOC', () => {
  const doc = [
    'EXHIBIT 2.1',
    '',
    ' AGREEMENT AND',
    'PLAN OF MERGER',
    '',
    ' Among',
    '',
    ' DYAX',
    'CORP.,',
    '',
    'SHIRE PHARMACEUTICALS INTERNATIONAL,',
    '',
    'PARQUET COURTS, INC.',
    '',
    ' and',
    '',
    ' Dated as of',
    'November 2, 2015',
    '',
    // Prose containing a bare "1.1" that must NOT anchor the body: it opens
    // a paragraph right after a blank line (same shape a real heading
    // would), but the word immediately after the number is lowercase, so
    // the Title-Case lookahead the fallback requires can't match it.
    '1.1 million shares of restricted stock were issued to certain employees of the Company prior to the date hereof.',
    '',
    // The REAL body start: bare decimal, no "ARTICLE"/"SECTION" keyword, no
    // preamble/WHEREAS recitals survive before it — exactly Dyax's shape.
    `1.1 The Merger. Upon the terms and subject to the conditions set forth in this Agreement, and in accordance with the General Corporation Law of the State of Delaware, at the Effective Time, Merger Sub shall be merged with and into the Company.${BODY_FILLER}`,
    '',
    `1.2 Closing. The closing of the Merger shall take place at the offices of counsel to Parent as soon as practicable after satisfaction of the conditions set forth in Article VII.${BODY_FILLER}`,
    '',
    `1.3 Effective Time. The Company and Parent shall cause a certificate of merger to be executed and filed with the Secretary of State of the State of Delaware.${BODY_FILLER}`,
    '',
    'ARTICLE VII',
    '',
    'Conditions',
    '',
    `7.1 Conditions to Each Party's Obligations. The respective obligations of each party to effect the Merger are subject to the satisfaction of the following conditions.${BODY_FILLER}`,
    '',
    'ARTICLE VIII',
    '',
    'Termination',
    '',
    `8.1 Termination by Mutual Consent. This Agreement may be terminated at any time prior to the Effective Time by mutual written consent of the Company and Parent.${BODY_FILLER}`,
    '',
    ' IN WITNESS WHEREOF, the parties have caused this Agreement to be executed as of the date first written above.',
    '',
    'DYAX CORP.',
    '',
    'By: /s/ Officer Name',
    '',
    // Appended exhibit: a genuine, well-formed TOC + preamble + Article I —
    // exactly the structure the pre-fix anchor search mistook for the body.
    ' EXHIBIT C',
    '',
    'FORM OF CONTINGENT VALUE RIGHTS AGREEMENT',
    '',
    'EXHIBIT C',
    '',
    'CONTINGENT VALUE RIGHTS AGREEMENT',
    '',
    ' By and between',
    '',
    ' DYAX CORP.',
    '',
    ' and',
    '',
    ' AMERICAN STOCK TRANSFER & TRUST COMPANY, LLC',
    '',
    ' as Rights Agent',
    '',
    'Dated as of [ ], 2015',
    '',
    'TABLE OF CONTENTS',
    '',
    'Article I',
    '',
    'Definitions',
    '',
    ' 1.1',
    '',
    ' Definitions',
    '',
    ' 1.2',
    '',
    ' Additional Definitions',
    '',
    'Article II',
    '',
    'Contingent Value Rights',
    '',
    ' 2.1',
    '',
    ' CVRs',
    '',
    'CONTINGENT VALUE RIGHTS AGREEMENT, dated as of [ ], 2015 (this "Agreement"), by and between DYAX CORP. and AMERICAN STOCK TRANSFER & TRUST COMPANY, LLC, as Rights Agent.',
    '',
    'Article I',
    '',
    'Definitions',
    '',
    `1.1 Definitions. Capitalized terms used in this Agreement and not otherwise defined shall have the meanings assigned to them in the Merger Agreement.${BODY_FILLER}`,
    '',
    'Article II',
    '',
    'Contingent Value Rights',
    '',
    `2.1 CVRs. Each CVR shall represent the contractual right to receive contingent payments pursuant to the terms of this Agreement.${BODY_FILLER}`,
  ].join('\n');

  const { sections, diagnostics } = parseStructure(doc);

  // bodyStart anchors at the real "1.1 The Merger." heading near the front
  // of the document, not ~30k chars in at the appended exhibit's own
  // "1.1 Definitions".
  const realHeadingIdx = doc.indexOf('1.1 The Merger.');
  assert.ok(
    diagnostics.bodyStart <= realHeadingIdx && diagnostics.bodyStart > realHeadingIdx - 20,
    `bodyStart (${diagnostics.bodyStart}) should anchor at the real "1.1 The Merger." heading (~${realHeadingIdx}), not the appended exhibit`
  );

  const nums = sections.map((s) => String(s.number));
  for (const n of ['1.1', '1.2', '1.3', '7.1', '8.1']) {
    assert.ok(nums.includes(n), `section ${n} captured (got ${nums})`);
  }

  // 1.1 is the merger agreement's own section, not the exhibit's "Definitions".
  const s11 = sections.find((s) => String(s.number) === '1.1');
  assert.match(s11.title || '', /The Merger/, '1.1 titled from the real body, not the CVR exhibit');
  assert.match(s11.text || '', /General Corporation Law/, '1.1 carries the real merger-agreement prose');

  // The prose "1.1 million shares" never becomes a section of its own.
  assert.ok(!nums.includes('1.1') || sections.filter((s) => String(s.number) === '1.1').length === 1, 'no duplicate 1.1 section from the prose');

  // Nothing after the signature block (the appended CVR exhibit) leaks into
  // the section list.
  const witnessIdx = doc.indexOf('IN WITNESS WHEREOF');
  assert.ok(witnessIdx > 0, 'signature anchor present');
  for (const s of sections) {
    assert.ok(
      s.startChar < witnessIdx,
      `section ${s.number} "${s.title}" starts at ${s.startChar}, inside the appended exhibit (witness at ${witnessIdx})`
    );
  }
});

test('Negative: a normal TOC + SECTION-style agreement does not take the bare-decimal fallback', () => {
  const doc = [
    'AGREEMENT AND PLAN OF MERGER',
    '',
    'Among',
    '',
    'PARENT CORP.,',
    '',
    'MERGER SUB, INC.',
    '',
    'and',
    '',
    'TARGET INC.',
    '',
    ' Dated as of January 1, 2026',
    '',
    'TABLE OF CONTENTS',
    '',
    'ARTICLE I',
    '',
    'THE MERGER',
    '',
    'SECTION 1.01.',
    '',
    'The Merger',
    '',
    'ARTICLE II',
    '',
    'REPRESENTATIONS AND WARRANTIES',
    '',
    'SECTION 2.01.',
    '',
    'Organization',
    '',
    'AGREEMENT AND PLAN OF MERGER, dated as of January 1, 2026 (this "Agreement"), among PARENT CORP., a Delaware corporation, MERGER SUB, INC., a Delaware corporation, and TARGET INC., a Delaware corporation.',
    '',
    'WHEREAS the respective boards of directors of Parent and the Company have approved this Agreement;',
    '',
    'NOW, THEREFORE, the parties agree as follows:',
    '',
    'ARTICLE I',
    '',
    'THE MERGER',
    '',
    `SECTION 1.01. The Merger. Upon the terms and subject to the conditions set forth in this Agreement, Merger Sub shall be merged with and into the Company.${BODY_FILLER}`,
    '',
    'ARTICLE II',
    '',
    'REPRESENTATIONS AND WARRANTIES',
    '',
    `SECTION 2.01. Organization. The Company is a corporation duly organized, validly existing and in good standing under the laws of the State of Delaware.${BODY_FILLER}`,
  ].join('\n');

  const { sections, diagnostics } = parseStructure(doc);
  const realHeadingIdx = doc.indexOf('SECTION 1.01. The Merger.');

  // The normal preamble/TOC-scan anchor wins; the new bare-decimal fallback
  // is never reached (the legacy result isn't "too late").
  assert.ok(
    diagnostics.bodyStart <= realHeadingIdx && diagnostics.bodyStart > realHeadingIdx - 500,
    `bodyStart (${diagnostics.bodyStart}) should anchor at the real body ARTICLE I (~${realHeadingIdx}) via the normal path`
  );

  const nums = sections.map((s) => String(s.number));
  assert.ok(nums.includes('1.01') && nums.includes('2.01'), `both real sections captured (got ${nums})`);
});
