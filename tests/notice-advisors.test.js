/* Tests for lib/parser-v2/notice-advisors.js — deterministic extraction of
   outside counsel (firm + lawyers per side) from NOTICES provisions.
   Fixtures are condensed from real merger-agreement notice sections in the
   corpus, covering the hard cases the parser must survive.
   Run: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  extractNoticeAdvisors,
  buildAdvisorsV2,
  buildDealNames,
  extractAttentionNames,
  looksLikePersonName,
} = require('../lib/parser-v2/notice-advisors');

const DEAL = (acquirer, target, meta = {}) => ({ acquirer, target, metadata: meta });

// ── Canonical two-block layout ("if to Parent" / "if to the Company") ──────

const STANDARD = `
Section 9.2. Notices. All notices must be in writing, in each case to:
(i) if to Parent or Purchaser, to:

BuyerCo Inc.
1 Main Street
New York, NY 10001

Attention: General Counsel
with a copy (which shall not constitute notice) to:

Paul, Weiss, Rifkind, Wharton & Garrison LLP

1285 Avenue of the Americas

New York, New York 10019

Attention: Krishna Veeraraghavan; Benjamin Goodchild

(ii) if to the Company, to:

TargetCo Inc.
2 Side Street
Boston, MA 02110

Attention: Chief Executive Officer
with a copy (which shall not constitute notice) to:

Cooley LLP

55 Hudson Yards

New York, New York 10001

Attention: Kevin Cooper

Eric Blanchard

Email: [***]
`;

test('standard notices: firm + lawyers attributed to the right sides', () => {
  const deal = DEAL('BuyerCo Inc.', 'TargetCo Inc.');
  const { blocks } = extractNoticeAdvisors(STANDARD, buildDealNames(deal));
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].side, 'buyer');
  assert.equal(blocks[0].firms.length, 1);
  assert.equal(blocks[0].firms[0].firm_raw, 'Paul, Weiss, Rifkind, Wharton & Garrison LLP');
  assert.deepEqual(blocks[0].firms[0].lawyers, ['Krishna Veeraraghavan', 'Benjamin Goodchild']);
  assert.equal(blocks[1].side, 'seller');
  assert.equal(blocks[1].firms[0].firm_raw, 'Cooley LLP');
  assert.deepEqual(blocks[1].firms[0].lawyers, ['Kevin Cooper', 'Eric Blanchard']);
});

test('buildAdvisorsV2 flattens blocks into the advisors_v2 shape', () => {
  const deal = DEAL('BuyerCo Inc.', 'TargetCo Inc.');
  const v2 = buildAdvisorsV2([{ id: 'p1', full_text: STANDARD }], deal);
  assert.equal(v2.buyer_firm, 'Paul, Weiss, Rifkind, Wharton & Garrison LLP');
  assert.deepEqual(v2.buyer_lawyers, ['Krishna Veeraraghavan', 'Benjamin Goodchild']);
  assert.equal(v2.seller_firm, 'Cooley LLP');
  assert.deepEqual(v2.seller_lawyers, ['Kevin Cooper', 'Eric Blanchard']);
  assert.equal(v2.raw.source_provision_id, 'p1');
  assert.equal(v2.raw.blocks.length, 2);
});

// ── Internal "copy to" blocks (party's own GC) must not become the firm ────

const INTERNAL_COPY = `
Notices. Notices shall be given, if to Parent or Merger Sub, to:

MegaCorp Industries Inc.
100 Corporate Drive
Chicago, IL 60601

Attention: Corporate Secretary
with a copy (which shall not constitute notice) to:

MegaCorp Industries Inc.
100 Corporate Drive
Chicago, IL 60601

Attention: General Counsel
with an additional copy (which will not constitute notice) to:

Kirkland & Ellis LLP

601 Lexington Avenue
New York, New York 10022

Attention: Sarkis Jebejian, P.C.; Steven M. Choi
if to the Company, to:

SmallBio Inc.
5 Lab Way
Cambridge, MA 02139

Attention: Chief Executive Officer
with a copy to:

Goodwin Procter LLP
100 Northern Avenue
Boston, MA 02210
Attention: Jane Q. Partner
`;

test('internal counsel copies are skipped; outside firm wins', () => {
  const deal = DEAL('MegaCorp Industries Inc.', 'SmallBio Inc.');
  const v2 = buildAdvisorsV2([{ id: 'p1', full_text: INTERNAL_COPY }], deal);
  assert.equal(v2.buyer_firm, 'Kirkland & Ellis LLP');
  assert.deepEqual(v2.buyer_lawyers, ['Sarkis Jebejian', 'Steven M. Choi']);
  assert.equal(v2.seller_firm, 'Goodwin Procter LLP');
  assert.deepEqual(v2.seller_lawyers, ['Jane Q. Partner']);
});

// ── Codename headers: side resolved from the block's address line ──────────

const CODENAMES = `
Notices. All notices shall be given, if to Cavalier, to:

Rocket Companies, Inc.
1050 Woodward Avenue
Detroit, MI 48226

Attention: [***]

with a copy to:

Paul, Weiss, Rifkind, Wharton & Garrison LLP
1285 Avenue of the Americas
New York, NY 10019

Attention: Scott A. Barshay

if to Maverick, to:

Mr. Cooper Group Inc.
8950 Cypress Waters Blvd.
Coppell, Texas 75019

Attention: [***]

with a copy to:

Wachtell, Lipton, Rosen & Katz
51 West 52nd Street
New York, NY 10019

Attention: Mark F. Veblen
`;

test('codename headers resolve sides via the address entity line', () => {
  const deal = DEAL('Rocket Companies, Inc.', 'MR. COOPER GROUP INC.');
  const v2 = buildAdvisorsV2([{ id: 'p1', full_text: CODENAMES }], deal);
  assert.equal(v2.buyer_firm, 'Paul, Weiss, Rifkind, Wharton & Garrison LLP');
  assert.equal(v2.seller_firm, 'Wachtell, Lipton, Rosen & Katz');
  assert.deepEqual(v2.seller_lawyers, ['Mark F. Veblen']);
});

// ── Both headers mention "Merger Sub": party names must win over keywords ──

const BOTH_MERGER_SUB = `
Notices. Notices shall be given as follows:
(a) if to Marriott, Marriott Corporate Merger Sub or Marriott LLC Merger Sub, to:

Marriott International, Inc.
10400 Fernwood Road
Bethesda, Maryland 20817

with a copy (which shall not constitute notice) to:

Gibson, Dunn & Crutcher LLP
1050 Connecticut Avenue, N.W.
Washington, D.C. 20036

Attention: Stephen I. Glover

(b) if to Starwood, Holdco or Starwood Merger Sub, to:

Starwood Hotels & Resorts Worldwide, Inc.
One Star Point
Stamford, Connecticut 06902

with a copy (which shall not constitute notice) to:

Cravath, Swaine & Moore LLP
825 Eighth Avenue
New York, New York 10019

Attention: Scott A. Barshay
`;

test('party-name match beats "Merger Sub" keyword when both headers have it', () => {
  const deal = DEAL('Marriott International, Inc.', 'Starwood Hotels & Resorts Worldwide, Inc.', {
    acquirer_display: 'Marriott',
    target_display: 'Starwood',
  });
  const v2 = buildAdvisorsV2([{ id: 'p1', full_text: BOTH_MERGER_SUB }], deal);
  assert.equal(v2.buyer_firm, 'Gibson, Dunn & Crutcher LLP');
  assert.equal(v2.seller_firm, 'Cravath, Swaine & Moore LLP');
});

// ── One-line block (firm, address, Attention all on one physical line) ─────

const ONE_LINE = `
Notices. Notices shall be given as follows:

if to the Company:

TargetCo Inc.
2 Side Street
Waltham, MA 02451

Attention: General Counsel
with a copy (which shall not constitute notice) to:

Paul, Weiss, Rifkind, Wharton & Garrison LLP 1285 Avenue of the Americas New York, New York 10019 Attention: Scott A. Barshay and Jeffrey D.  Marell Facsimile No.: (212) 757-3990 Email: sbarshay@paulweiss.com and jmarell@paulweiss.com if to Parent or Merger Sub:

BuyerCo S.A.
54, rue Principale
Paris, France

Attention: General Counsel
with a copy (which shall not constitute notice) to:

Weil, Gotshal & Manges LLP
 767 Fifth Avenue
 New York, New York 10153
 Attention: Michael J. Aiello and Sachin Kohli Facsimile No.: (212) 310-8007
`;

test('one-line firm blocks parse (firm cut at LLP, inline Attention names)', () => {
  const deal = DEAL('BuyerCo S.A.', 'TargetCo Inc.');
  const v2 = buildAdvisorsV2([{ id: 'p1', full_text: ONE_LINE }], deal);
  assert.equal(v2.seller_firm, 'Paul, Weiss, Rifkind, Wharton & Garrison LLP');
  assert.deepEqual(v2.seller_lawyers, ['Scott A. Barshay', 'Jeffrey D. Marell']);
  assert.equal(v2.buyer_firm, 'Weil, Gotshal & Manges LLP');
  assert.deepEqual(v2.buyer_lawyers, ['Michael J. Aiello', 'Sachin Kohli']);
});

// ── Firm name wrapped across lines + email lines must not become firms ─────

const WRAPPED = `
Notices. All notices shall be given, if to Parent, to:

BuyerCo Inc.
200 Innovation Way
Akron, OH 44316

Email: contact@buyerco.com

Attention: David E. Phillips with a copy to:

 Paul, Weiss,
Rifkind, Wharton & Garrison LLP

 1285 Avenue of the Americas

New York, NY 10019

 Email: sbarshay@paulweiss.com kseifried@paulweiss.com

Attention: Scott A. Barshay

 Kyle T. Seifried

(b) if to the Company, to:

TargetCo Inc.
701 Lima Avenue
Findlay, Ohio 45840

Attention: Stephen Zamansky with a copy to:

 Jones Day
Vesey Street
 New York, NY 10281
Attention: James P. Dougherty and

 Jones Day
North Point
 901 Lakeside Avenue
 Cleveland, Ohio 44114
Attention: Benjamin L. Stulberg
`;

test('wrapped firm names join; email lines are not firms; same firm merges', () => {
  const deal = DEAL('BuyerCo Inc.', 'TargetCo Inc.');
  const v2 = buildAdvisorsV2([{ id: 'p1', full_text: WRAPPED }], deal);
  assert.deepEqual(v2.buyer_firms, ['Paul, Weiss, Rifkind, Wharton & Garrison LLP']);
  assert.deepEqual(v2.buyer_lawyers, ['Scott A. Barshay', 'Kyle T. Seifried']);
  // Two offices of Jones Day merge into one firm with both lawyers.
  assert.deepEqual(v2.seller_firms, ['Jones Day']);
  assert.deepEqual(v2.seller_lawyers, ['James P. Dougherty', 'Benjamin L. Stulberg']);
});

// Summit Materials shape (2026-07-19 law-firms backfill investigation): the
// continuation line starts with "&" instead of the prior line ending with
// one ("Davis Polk\n& Wardwell LLP") — the join heuristic only checked the
// trailing-punctuation case and split this into two fake firms ("Davis
// Polk", "Wardwell LLP").
const AMPERSAND_LEAD_WRAP = `
Notices. All notices shall be given, if to Parent, to:

Quikrete
Holdings, Inc.

with a copy to:

Troutman Sanders LLP
600 Peachtree St. NE
Attention: David Ghegan

if to the Company, to:

Summit Materials,
Inc.

with a copy to:

Davis Polk
& Wardwell LLP
450 Lexington Avenue
Attention: James P. Dougherty
`;

test('firm name wrapped BEFORE a leading "&" continuation line joins into one firm (Summit Materials shape)', () => {
  const deal = DEAL('Quikrete Holdings, Inc.', 'Summit Materials, Inc.');
  const v2 = buildAdvisorsV2([{ id: 'p1', full_text: AMPERSAND_LEAD_WRAP }], deal);
  assert.deepEqual(v2.seller_firms, ['Davis Polk & Wardwell LLP']);
});

// ── Attention-name capture unit tests ───────────────────────────────────────

test('extractAttentionNames handles wrapped names and stop lines', () => {
  const names = extractAttentionNames(
    'Email:\n\n a@x.com\n\nAttention:\n\n Scott A. Barshay\n\n Steven J.\nWilliams\n if to the Company, to:'
  );
  assert.deepEqual(names, ['Scott A. Barshay', 'Steven J. Williams']);
});

test('extractAttentionNames rejects titles and redactions', () => {
  assert.deepEqual(extractAttentionNames('Attention: General Counsel'), []);
  assert.deepEqual(extractAttentionNames('Attention: [***]'), []);
  assert.deepEqual(
    extractAttentionNames('Attention: Andrew Ashe, COO & General Counsel'),
    ['Andrew Ashe']
  );
});

test('looksLikePersonName accepts real names, rejects titles/addresses', () => {
  assert.equal(looksLikePersonName('Krishna Veeraraghavan'), true);
  assert.equal(looksLikePersonName('Brandon Van Dyke'), true);
  assert.equal(looksLikePersonName('O. Keith Hallam, III'), true);
  assert.equal(looksLikePersonName('General Counsel'), false);
  assert.equal(looksLikePersonName('Corporate Secretary'), false);
  assert.equal(looksLikePersonName('1285 Avenue of the Americas'), false);
  assert.equal(looksLikePersonName('Steven J.'), false); // dangling initial
});

// ── No usable provision ─────────────────────────────────────────────────────

test('buildAdvisorsV2 returns null when no provision has address blocks', () => {
  const deal = DEAL('A Inc.', 'B Inc.');
  assert.equal(buildAdvisorsV2([], deal), null);
  assert.equal(
    buildAdvisorsV2([{ id: 'p1', full_text: 'Service of process may be made by mail.' }], deal),
    null
  );
});
