/* Regression test for the Kraft fresh-ingest collapse (lib/parser-v2/structural).

   Guards the Heinz/Kraft 2015 fresh-fetch failure class. After cleanText the
   fresh EX-2.1 text has NO "TABLE OF CONTENTS" header and NO agreement
   "ARTICLE" heading lines (both eaten by the TOC walker; articles are bare
   title lines), body headings hard-wrapped ("SECTION 1.01.\nThe Merger. (a)
   ..."), and a LONG tail after the signature blocks — a "Defined Term /
   Section Number" cross-reference annex plus attached exhibits (certificate
   of incorporation, BY-LAWS) whose own "ARTICLE I..XII" / "Section 1." lines
   DO survive cleanup. Pre-#59 findBodyStart found no same-line-content
   heading anywhere in the body, so it anchored INSIDE that tail: the
   "sections" it emitted were index entries ("9.03" titled "Heinz Financial
   Statements") and giant X-INTRO/XII-INTRO blobs from the by-laws ("Unavail-
   ability of Officers"), so the stored deal collapsed to 218 DEF (inline-
   definition sweep) + 2 OTHER (by-laws blobs) with zero REP/COND/IOC/NOSOL/
   TERM. The agreement body must win the anchor and the tail must contribute
   no sections or articles. Run: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseStructure, cleanText } = require('../lib/parser-v2/structural');

const FILLER = ' The parties agree to the covenants and undertakings set forth herein, subject to the terms and conditions of this Agreement and applicable Law, in each case as more fully described below.';
const BODY_FILLER = FILLER.repeat(3);
const EXHIBIT_FILLER = ' The Board of Directors may adopt such rules, regulations and procedures for the conduct of any meeting as it deems appropriate, consistent with applicable law and the Certificate of Incorporation.';

// Defined-terms cross-reference annex (term line, then the section-number
// line) — the exact stub layout the pre-#59 anchor mistook for body headings.
const INDEX_PAIRS = [
  ['Agreement', 'Preamble'],
  ['Code', 'Recitals'],
  ['Heinz Credit Facility', '9.03'],
  ['Heinz ERISA Affiliate', '9.03'],
  ['Heinz Financial Statements', '3.06(a)'],
  ['Heinz Share Conversion Ratio', '1.05(a)'],
  ['Kraft Equity Awards', '4.02(a)(i)'],
  ['Kraft Shareholder Approval', '4.03(a)'],
  ['Material Adverse Effect', '9.03'],
  ['Option Adjustment Ratio', '6.04(a)'],
  ['SEC', '1.03'],
  ['Special Dividend Per Share Amount', '6.15'],
];
const definedTermsIndex = INDEX_PAIRS.flatMap(([term, num]) => [term, '', num, '']);

test('Kraft fresh-fetch shape: signature-page tail (index annex + by-laws exhibit) contributes no sections', () => {
  const doc = [
    'AGREEMENT AND PLAN OF MERGER',
    '',
    'Among',
    '',
    ' H.J. HEINZ HOLDING', // mid-word line wrap straight off the EDGAR HTML
    'CORPORATION,',
    '',
    ' KITE MERGER SUB CORP.,',
    '',
    'AND',
    '',
    'KRAFT FOODS GROUP, INC.',
    '',
    ' Dated as',
    'of March 24, 2015',
    '',
    // Headerless stub TOC, post-cleanText shape: no "TABLE OF CONTENTS" line,
    // no ARTICLE lines (bare title lines only), titles on the next line.
    'Page',
    '',
    'The Merger', '',
    ' SECTION 1.01.', '', 'The Merger', '',
    ' SECTION 1.02.', '', 'Closing', '',
    'Conditions Precedent', '',
    ' SECTION 7.01.', '', "Conditions to Each Party's Obligation to Effect the Mergers", '',
    'General Provisions', '',
    ' SECTION 9.03.', '', 'Definitions', '',
    ' SECTION 9.15.', '', 'Consideration of Alternative Transaction Structures', '',
    'Exhibit A', '', 'Form of Second Amended and Restated Certificate of Incorporation of Heinz', '',
    'Exhibit B', '', 'Amended and Restated By-laws of Heinz', '',
    '',
    'AGREEMENT AND PLAN OF MERGER, dated as of March 24, 2015 (this',
    '"Agreement"), among H.J. HEINZ HOLDING CORPORATION, a Delaware corporation ("Heinz"), KITE MERGER SUB CORP., a Virginia corporation ("Merger Sub I"), and KRAFT FOODS GROUP, INC., a Virginia corporation ("Kraft").',
    '',
    'WHEREAS the respective boards of directors of Heinz and Kraft have unanimously adopted this Agreement;',
    '',
    'NOW, THEREFORE, in consideration of the foregoing, the',
    'parties hereto agree as follows:',
    '',
    'The Merger', // bare article title line — the ARTICLE I line did not survive cleanup
    '',
    ' SECTION 1.01.', // body heading with the title hard-wrapped onto the next line
    `The Merger. (a) On the terms and subject to the conditions set forth in this Agreement, and in accordance with the Virginia Stock Corporation Act, Merger Sub I shall be merged with and into Kraft.${BODY_FILLER}`,
    '',
    ' SECTION 1.02.',
    `Closing. The closing of the Merger shall take place at 9:00 a.m., New York City time, on the third Business Day.${BODY_FILLER}`,
    '',
    'Conditions Precedent',
    '',
    ' SECTION 7.01.',
    `Conditions to Each Party's Obligation to Effect the Mergers. The respective obligations of the parties are subject to the satisfaction of the following conditions.${BODY_FILLER}`,
    '',
    'General Provisions',
    '',
    ' SECTION 9.03.',
    `Definitions. As used in this Agreement, the following terms have the meanings ascribed below. "Business Day" means any day other than a Saturday or Sunday. "Material Adverse Effect" means any change, effect, event or occurrence that has a material adverse effect on the business of the applicable party.${BODY_FILLER}`,
    '',
    ' SECTION 9.15.',
    `Consideration of Alternative Transaction Structures. The parties shall consider in good faith any alternative structures proposed by the other party.${BODY_FILLER}`,
    '',
    ' [Remainder of page left intentionally blank] ',
    '',
    ' 80 ',
    '',
    ' IN WITNESS WHEREOF, Heinz, Merger Sub I and Kraft have caused this Agreement to be',
    'executed by their respective officers thereunto duly authorized as of the date first above written.',
    '',
    'H.J. HEINZ HOLDING CORPORATION,',
    '',
    'by',
    '',
    '/s/ Officer Name',
    '',
    'Name:', 'Officer Name', 'Title:', 'Chief Financial Officer',
    '',
    ' Annex A ',
    '',
    ' Defined Term',
    '',
    ' Section Number',
    '',
    ...definedTermsIndex,
    '',
    ' A-2 ',
    '',
    ' Exhibit B ',
    '',
    'Form of Amended and Restated By-laws of Heinz',
    '',
    '[attached]',
    '',
    ' EXHIBIT B ',
    '',
    'FORM OF AMENDED AND RESTATED',
    '',
    'BY-LAWS',
    '',
    'of',
    '',
    'THE KRAFT HEINZ COMPANY',
    '',
    'ARTICLE I',
    '',
    ' Offices',
    '',
    ` The Kraft Heinz Company (the "Corporation") may have an office or offices, and keep the books and records of the Corporation, at such place or places as the Board of Directors may from time to time determine.${EXHIBIT_FILLER.repeat(20)}`,
    '',
    ' ARTICLE II ',
    '',
    'Meetings of Stockholders',
    '',
    ' Section 1.',
    `Annual Meetings. The annual meeting of the stockholders for the election of directors shall be held on such date and at such time as the Board of Directors may in its discretion determine.${EXHIBIT_FILLER.repeat(20)}`,
    '',
    ' Section 2. Special Meetings. ',
    '',
    `(a) A majority of the Board of Directors or the Chairman may call special meetings of the stockholders.${EXHIBIT_FILLER.repeat(20)}`,
    '',
    'ARTICLE XI',
    '',
    ' Amendment',
    '',
    ` Subject to any limitations provided in the Certificate of Incorporation, the Board of Directors may adopt, amend or repeal the By-Laws.${EXHIBIT_FILLER.repeat(20)}`,
    '',
    'ARTICLE XII',
    '',
    'Unavailability of Officers',
    '',
    ` In the event an officer of the Corporation is unavailable to perform his or her duties for any reason, the Board of Directors is authorized to elect any director or officer of the Corporation to fill such position on a temporary basis.${EXHIBIT_FILLER.repeat(20)}`,
    '',
    ' 11 ',
  ].join('\n');

  const cleaned = cleanText(doc);
  const { sections, articles } = parseStructure(cleaned);
  const nums = sections.map((s) => String(s.number));

  // Body sections all captured.
  for (const n of ['1.01', '1.02', '7.01', '9.03', '9.15']) {
    assert.ok(nums.includes(n), `section ${n} captured (got ${nums})`);
  }

  // 9.03 is the body Definitions section, not the index entry that the
  // pre-#59 anchor surfaced under the same number ("Heinz Financial
  // Statements" et al.).
  const s903 = sections.find((s) => String(s.number) === '9.03');
  assert.match(s903.title || '', /Definitions/i, '9.03 titled from the body, not the index annex');
  assert.ok(/Material Adverse Effect/.test(s903.text || ''), '9.03 carries definitions prose');

  // Nothing after the signature page may become a section: no section starts
  // in the annex/exhibit tail.
  const witnessIdx = cleaned.indexOf('IN WITNESS WHEREOF');
  assert.ok(witnessIdx > 0, 'signature anchor present in cleaned text');
  for (const s of sections) {
    assert.ok(
      s.startChar < witnessIdx,
      `section ${s.number} "${s.title}" starts at ${s.startChar}, inside the post-signature tail (witness at ${witnessIdx})`
    );
  }

  // The by-laws exhibit's own articles (X-XII, "Unavailability of Officers")
  // must not leak into the agreement's article list.
  for (const a of articles) {
    assert.ok(
      !/Unavailability of Officers|Meetings of Stockholders/i.test(a.title || ''),
      `by-laws exhibit article leaked: ${a.number} ${a.title}`
    );
    assert.ok(
      !['X', 'XI', 'XII'].includes(String(a.number)),
      `exhibit article number leaked: ${a.number}`
    );
  }
});
