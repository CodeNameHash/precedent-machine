const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  AGREEMENT_REVISION,
  classifyAgreementRevision,
  exhibitTitleText,
} = require('../lib/agreement-revision-classifier');
const { normalizeAgreementText } = require('../lib/edgar-catalog');

const ROOT = path.join(__dirname, '..');

// ---------------------------------------------------------------------------
// Exhibit titles below are marked REAL or CONSTRUCTED.
//
// REAL titles are taken verbatim from filings recorded in this repository:
//   * Metsera/Pfizer, evidence/process-intelligence/pilot/metsera-source-universe-manifest.json
//       "d921605dex21.htm (EX-2.1, Agreement and Plan of Merger)"          (original)
//       "d50740dex21.htm (EX-2.1, Amendment No. 1 to Agreement and Plan of Merger)"
//   * TopBuild/QXO, Modiv/GNL, Skechers and Landos/AbbVie exhibit headers, read
//     off the pinned raw SEC documents listed in REAL_ORIGINAL_FIXTURES.
//
// CONSTRUCTED titles and document bodies are written here because the corpus
// contains no example. There is no amended and restated merger agreement in the
// repository at all, and no amendment body: only the Metsera amendment's title
// survives in the evidence manifests. Amendment and restatement bodies below
// are modelled on the standard form those documents take.
// ---------------------------------------------------------------------------

// REAL: pinned SEC bytes for four original merger agreements.
const REAL_ORIGINAL_FIXTURES = [
  ['TopBuild/QXO', 'tests/fixtures/canonical-v2/mae-definition-family/topbuild-raw-fetched.htm', 'EX-2.1 EXHIBIT 2.1 tm2612209d1_ex2-1.htm'],
  ['Modiv/GNL', 'tests/fixtures/canonical-v2/mae-definition-family/modiv-raw-fetched.htm', 'EX-2.1 EXHIBIT 2.1 ef20072329_ex2-1.htm'],
  ['Skechers', 'tests/fixtures/canonical-v2/skechers-first-live-run/skechers-raw-fetched.htm', 'EX-2.1 EX-2.1 d943603dex21.htm'],
  ['Landos/AbbVie', '__fixtures__/demo-deal/landos-abbvie-agreement.txt', 'EX-2.1 EX-2.1 d779916dex21.htm'],
];

function realOriginalText(relativePath) {
  return normalizeAgreementText(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

// CONSTRUCTED: modelled on the standard form of a merger-agreement amendment.
// The operative section changes two sections of an agreement filed elsewhere.
function constructedAmendmentText({ caption = 'AMENDMENT NO. 1 TO AGREEMENT AND PLAN OF MERGER' } = {}) {
  return [
    'Exhibit 2.1',
    '',
    caption,
    '',
    `This ${caption} (this "Amendment"), dated as of November 7, 2025, is entered into by and among Pfizer Inc., a Delaware corporation ("Parent"), Mustang Merger Sub Inc., a Delaware corporation and a wholly owned subsidiary of Parent ("Merger Sub"), and Metsera, Inc., a Delaware corporation (the "Company").`,
    '',
    'WHEREAS, Parent, Merger Sub and the Company are parties to that certain Agreement and Plan of Merger, dated as of September 21, 2025 (the "Merger Agreement");',
    '',
    'WHEREAS, Section 9.2 of the Merger Agreement provides that the Merger Agreement may be amended by an instrument in writing signed on behalf of each of the parties;',
    '',
    'NOW, THEREFORE, in consideration of the mutual covenants contained herein, and intending to be legally bound, the parties agree as follows:',
    '',
    '1. Amendment to Section 1.6. Section 1.6 of the Merger Agreement is hereby amended and restated in its entirety to read as follows: "Section 1.6 Closing. The closing of the Merger shall take place on the second business day following satisfaction of the conditions set forth in Article VII."',
    '',
    '2. Amendment to Section 1.7. The reference to "$47.50" in Section 1.7(a) of the Merger Agreement is hereby deleted and replaced with "$65.60".',
    '',
    '3. No Other Amendments. Except as expressly amended by this Amendment, the Merger Agreement remains in full force and effect in accordance with its terms, and nothing in this Amendment shall be construed as a waiver of any right or obligation under the Merger Agreement.',
    '',
    '4. Miscellaneous. Sections 9.4 through 9.12 of the Merger Agreement are incorporated into this Amendment by reference and apply to this Amendment as if set out in full.',
    '',
    'IN WITNESS WHEREOF, the parties have caused this Amendment to be executed as of the date first written above.',
  ].join('\n');
}

// CONSTRUCTED: a restatement is a complete agreement, so it has the same shape
// as the real originals above. Only its caption differs.
function constructedRestatementText({ caption = 'AMENDED AND RESTATED AGREEMENT AND PLAN OF MERGER' } = {}) {
  const articles = [
    'ARTICLE I THE MERGER',
    'ARTICLE II EFFECT ON CAPITAL STOCK',
    'ARTICLE III REPRESENTATIONS AND WARRANTIES OF THE COMPANY',
    'ARTICLE IV REPRESENTATIONS AND WARRANTIES OF PARENT',
    'ARTICLE V COVENANTS',
    'ARTICLE VI ADDITIONAL AGREEMENTS',
    'ARTICLE VII CONDITIONS PRECEDENT',
    'ARTICLE VIII TERMINATION',
    'ARTICLE IX GENERAL PROVISIONS',
  ];
  const body = articles
    .map((heading, index) => `${heading}\n\nSection ${index + 1}.1 ${'The parties agree to customary covenants, conditions and representations. '.repeat(12)}`)
    .join('\n\n');
  return [
    'Exhibit 2.1',
    '',
    caption,
    '',
    'by and among BIG BUYER INC., MERGER SUB INC. and TARGET CO.',
    '',
    'Dated as of July 1, 2026',
    '',
    'TABLE OF CONTENTS',
    '',
    articles.join('\n'),
    '',
    body,
  ].join('\n');
}

test('every pinned real original agreement classifies as an original', () => {
  for (const [name, relativePath, title] of REAL_ORIGINAL_FIXTURES) {
    const verdict = classifyAgreementRevision({ title, text: realOriginalText(relativePath) });
    assert.equal(verdict.revision, AGREEMENT_REVISION.ORIGINAL, `${name} should classify as original`);
    assert.equal(verdict.is_agreement_document, true, name);
    assert.equal(verdict.needs_human_review, false, name);
    assert.equal(verdict.supersedes_earlier_agreement, false, name);
  }
});

test('charter and bylaw restatements inside a real original do not make it a restatement', () => {
  // Skechers names an "Amended and Restated Parent LLCA" about sixty characters
  // before the words "AGREEMENT AND PLAN OF MERGER" in its exhibit list, and
  // TopBuild restates a certificate of incorporation in Section 1.6. Neither is
  // a restatement of the merger agreement.
  for (const [name, relativePath, title] of REAL_ORIGINAL_FIXTURES) {
    const text = realOriginalText(relativePath);
    assert.ok(/amended\s+and\s+restated/i.test(text), `${name} fixture should contain the loose phrase`);
    const verdict = classifyAgreementRevision({ title, text });
    assert.equal(verdict.signals.caption.restatement, false, name);
    assert.equal(verdict.revision, AGREEMENT_REVISION.ORIGINAL, name);
  }
});

test('real Metsera amendment title is an amendment; real Metsera original title is not', () => {
  // REAL: both descriptors, verbatim from the Metsera source-universe manifest.
  const amendment = classifyAgreementRevision({
    title: exhibitTitleText({ type: 'EX-2.1', description: 'Amendment No. 1 to Agreement and Plan of Merger', document: 'd50740dex21.htm' }),
  });
  assert.equal(amendment.revision, AGREEMENT_REVISION.AMENDMENT);
  assert.equal(amendment.is_agreement_document, false);
  assert.equal(amendment.needs_human_review, true);

  const original = classifyAgreementRevision({
    title: exhibitTitleText({ type: 'EX-2.1', description: 'Agreement and Plan of Merger', document: 'd921605dex21.htm' }),
  });
  assert.equal(original.revision, AGREEMENT_REVISION.UNKNOWN);
  assert.equal(original.needs_human_review, false);
  assert.equal(original.needs_text_confirmation, true);
});

test('an amendment is not fooled by carrying the original agreement name in its title', () => {
  // Both titles contain "Agreement and Plan of Merger" and score identically
  // under exhibitScore. Only the classification separates them.
  const amendmentTitles = [
    'EX-2.1 Amendment No. 1 to Agreement and Plan of Merger d50740dex21.htm', // REAL
    'EX-2.1 AMENDMENT TO AGREEMENT AND PLAN OF MERGER ex2-1.htm', // CONSTRUCTED
    'EX-2.1 First Amendment to the Agreement and Plan of Merger ex2-1.htm', // CONSTRUCTED
    'EX-2.1 Amendment No. 2 to Merger Agreement ex2-1.htm', // CONSTRUCTED
  ];
  for (const title of amendmentTitles) {
    const verdict = classifyAgreementRevision({ title });
    assert.equal(verdict.revision, AGREEMENT_REVISION.AMENDMENT, title);
    assert.equal(verdict.is_agreement_document, false, title);
  }
});

test('"AMENDED AND RESTATED AGREEMENT AND PLAN OF MERGER" is distinguished from an original', () => {
  // CONSTRUCTED: the corpus has no restatement.
  const byTitle = classifyAgreementRevision({
    title: 'EX-2.1 AMENDED AND RESTATED AGREEMENT AND PLAN OF MERGER ex2-1.htm',
  });
  assert.equal(byTitle.revision, AGREEMENT_REVISION.AMENDED_AND_RESTATED);
  assert.equal(byTitle.is_agreement_document, true);
  assert.equal(byTitle.supersedes_earlier_agreement, true);
  assert.equal(byTitle.needs_text_confirmation, true);

  const confirmed = classifyAgreementRevision({
    title: 'EX-2.1 EX-2.1 ex2-1.htm',
    text: constructedRestatementText(),
  });
  assert.equal(confirmed.revision, AGREEMENT_REVISION.AMENDED_AND_RESTATED);
  assert.equal(confirmed.supersedes_earlier_agreement, true);
  assert.equal(confirmed.needs_text_confirmation, false);

  const original = classifyAgreementRevision({
    title: 'EX-2.1 EX-2.1 ex2-1.htm',
    text: constructedRestatementText({ caption: 'AGREEMENT AND PLAN OF MERGER' }),
  });
  assert.equal(original.revision, AGREEMENT_REVISION.ORIGINAL);
  assert.equal(original.supersedes_earlier_agreement, false);
});

test('an ordinal restatement caption still reads as a restatement', () => {
  const verdict = classifyAgreementRevision({
    title: 'EX-2.1 Second Amended and Restated Agreement and Plan of Merger ex2-1.htm', // CONSTRUCTED
  });
  assert.equal(verdict.revision, AGREEMENT_REVISION.AMENDED_AND_RESTATED);
});

test('an amendment filed under a bare exhibit descriptor is caught by its text', () => {
  // Skechers proves bare descriptors are real: its filing-index description is
  // literally "EX-2.1". An amendment filed the same way has nothing in the
  // title to catch, so the document has to give it away.
  const verdict = classifyAgreementRevision({
    title: 'EX-2.1 EX-2.1 d50740dex21.htm',
    text: constructedAmendmentText(),
  });
  assert.equal(verdict.revision, AGREEMENT_REVISION.AMENDMENT);
  assert.equal(verdict.is_agreement_document, false);
  assert.equal(verdict.needs_human_review, true);
  assert.equal(verdict.needs_text_confirmation, false);
  assert.ok(verdict.signals.operative_amendment_language.present);
  assert.ok(verdict.reason.length > 0);
});

test('an amendment to a restated agreement is an amendment, not a restatement', () => {
  const verdict = classifyAgreementRevision({
    title: 'EX-2.1 Amendment No. 2 to the Amended and Restated Agreement and Plan of Merger ex2-1.htm', // CONSTRUCTED
  });
  assert.equal(verdict.revision, AGREEMENT_REVISION.AMENDMENT);
  assert.equal(verdict.signals.title.nested, true);
});

test('ambiguity: a title naming a restatement before an amendment is not resolved', () => {
  const verdict = classifyAgreementRevision({
    title: 'EX-2.1 Amended and Restated Agreement and Plan of Merger (Amendment No. 3) ex2-1.htm', // CONSTRUCTED
  });
  assert.equal(verdict.revision, AGREEMENT_REVISION.AMBIGUOUS);
  assert.equal(verdict.needs_human_review, true);
  assert.equal(verdict.is_agreement_document, false);
});

test('ambiguity: title and document caption disagree', () => {
  const verdict = classifyAgreementRevision({
    title: 'EX-2.1 Amendment No. 1 to Agreement and Plan of Merger ex2-1.htm', // REAL descriptor
    text: constructedRestatementText(), // caption says restatement
  });
  assert.equal(verdict.revision, AGREEMENT_REVISION.AMBIGUOUS);
  assert.match(verdict.reason, /disagree/i);
});

test('ambiguity: named an amendment but shaped like a complete agreement', () => {
  const verdict = classifyAgreementRevision({
    title: 'EX-2.1 Amendment No. 1 to Agreement and Plan of Merger ex2-1.htm', // REAL descriptor
    text: constructedRestatementText({ caption: 'AGREEMENT AND PLAN OF MERGER' }),
  });
  assert.equal(verdict.revision, AGREEMENT_REVISION.AMBIGUOUS);
  assert.equal(verdict.needs_human_review, true);
  assert.match(verdict.reason, /complete agreement/i);
});

test('ambiguity: named a restatement but behaves like an amendment', () => {
  const verdict = classifyAgreementRevision({
    title: 'EX-2.1 Amended and Restated Agreement and Plan of Merger ex2-1.htm', // CONSTRUCTED
    text: constructedAmendmentText({ caption: 'AMENDED AND RESTATED AGREEMENT AND PLAN OF MERGER' }),
  });
  assert.equal(verdict.revision, AGREEMENT_REVISION.AMBIGUOUS);
  assert.equal(verdict.needs_human_review, true);
  assert.match(verdict.reason, /operative language/i);
});

test('a thin document that names no revision is an original, not an ambiguity', () => {
  // The boundary of the ambiguity rule. This document is too thin to be a real
  // merger agreement, but nothing about it is ambiguous as to revision: it does
  // not name a restatement or an amendment and uses no language for changing
  // another document. Whether it is long enough to ingest is the caller's
  // minimum-length gate, not this classifier's question. Widening ambiguity to
  // cover thinness would route ordinary filings to a human for no reason.
  const verdict = classifyAgreementRevision({
    title: 'EX-2.1 EXHIBIT 2.1 Agreement and Plan of Merger ex2-1.htm',
    text: 'Exhibit 2.1 Agreement and Plan of Merger by and among Big Buyer Inc. ("Parent"), Merger Sub Inc. ("Merger Sub") and Target Co. ("Company") dated July 1, 2026.',
  });
  assert.equal(verdict.revision, AGREEMENT_REVISION.ORIGINAL);
  assert.equal(verdict.needs_human_review, false);
  assert.equal(verdict.signals.looks_like_complete_document, false);
});

test('a thin document that DOES name an amendment is still an amendment', () => {
  const verdict = classifyAgreementRevision({
    title: 'EX-2.1 Amendment No. 1 to Agreement and Plan of Merger d50740dex21.htm', // REAL
    text: 'Exhibit 2.1 AMENDMENT NO. 1 TO AGREEMENT AND PLAN OF MERGER, dated as of November 7, 2025.',
  });
  assert.equal(verdict.revision, AGREEMENT_REVISION.AMENDMENT);
  assert.equal(verdict.needs_human_review, true);
});

test('a title with nothing to say is unknown, not a failure', () => {
  const verdict = classifyAgreementRevision({ title: 'EX-2.1 EX-2.1 d943603dex21.htm' }); // REAL Skechers descriptor
  assert.equal(verdict.revision, AGREEMENT_REVISION.UNKNOWN);
  assert.equal(verdict.needs_human_review, false);
  assert.equal(verdict.is_agreement_document, false);
  assert.equal(verdict.needs_text_confirmation, true);
});

test('no input at all is unknown rather than an assumed original', () => {
  const verdict = classifyAgreementRevision();
  assert.equal(verdict.revision, AGREEMENT_REVISION.UNKNOWN);
  assert.equal(verdict.is_agreement_document, false);
});

test('exhibitTitleText reads type, description and filename together', () => {
  assert.equal(
    exhibitTitleText({ type: 'EX-2.1', description: 'Amendment No. 1 to Agreement and Plan of Merger', document: 'd50740dex21.htm' }),
    'EX-2.1 Amendment No. 1 to Agreement and Plan of Merger d50740dex21.htm',
  );
  assert.equal(exhibitTitleText('EX-2.1'), 'EX-2.1');
  assert.equal(exhibitTitleText(null), '');
});
