// Regression tests for splitOfferConditionAnnex in lib/parser-v2/extract.js.
//
// Tender-offer deals put closing conditions in an "Annex I/A — Conditions to
// the Offer" rather than a normal conditions article. structural.js captures
// the whole annex as ONE pseudo-section; splitSubClauses then deliberately
// SKIPS roman-numeral markers for COND types (a guard meant to stop nested
// cross-reference romans inside an already-lettered sub-clause from creating
// spurious splits) — which left annexes that enumerate with romans as ONE
// giant un-split provision (Pharmasset: 5,199 chars, COND count 5, one row).
// splitOfferConditionAnnex is a deterministic, parse-only pre-split that fires
// only on that annex shape and is a no-op everywhere else.
const test = require('node:test');
const assert = require('node:assert/strict');

const { splitOfferConditionAnnex } = require('../lib/parser-v2/extract.js');

// Padding so each condition body clears the char-count floor a real offer
// condition carries (annex conditions run a full sentence or more, not a
// three-word stub) without changing the enumeration shape under test.
const PAD = ' This condition is measured as of the Expiration Time and may be waived by Parent in its sole discretion to the extent permitted by applicable Law.';

const CHAPEAU =
  'Notwithstanding any other provision of this Agreement or the Offer, Merger Sub shall not be required to accept for payment, or, subject to the applicable rules and regulations of the SEC, pay for, any Shares tendered pursuant to the Offer, and may terminate the Offer, if at any time on or after the date of this Agreement and prior to the Expiration Time, any of the following events shall occur and remain in effect:';

// Pharmasset-shaped fixture per the task spec: chapeau + untitled (a)-(g)
// lettered conditions (no headings — offer-condition items are typically
// bare lettered/roman paragraphs, not titled sub-clauses).
const LETTERED_ANNEX = [
  CHAPEAU,
  `(a) there shall not have been validly tendered and not withdrawn a number of Shares that, together with Shares owned by Parent, represents at least a majority of the then outstanding Shares on a fully diluted basis.${PAD}`,
  `(b) any applicable waiting period under the HSR Act shall not have expired or been terminated.${PAD}`,
  `(c) any representation or warranty of the Company contained in this Agreement shall not be true and correct in all material respects.${PAD}`,
  `(d) the Company shall not have performed in all material respects its obligations required to be performed prior to the Expiration Time.${PAD}`,
  `(e) the Company shall have failed to deliver a certificate certifying satisfaction of the conditions in paragraphs (c) and (d) above.${PAD}`,
  `(f) there shall be in effect any Order of a court of competent jurisdiction restraining or prohibiting consummation of the Offer.${PAD}`,
  `(g) this Agreement shall have been terminated in accordance with its terms.${PAD}`,
].join('\n\n');

// Real Pharmasset/Gilead Annex A shape: same chapeau, but the enumeration
// uses ROMAN numerals (i)-(viii) — the actual root-cause shape that
// splitSubClauses' skipRoman guard was silently leaving whole.
const ROMAN_ANNEX = [
  CHAPEAU,
  `(i) there shall not have been validly tendered and not withdrawn a number of Shares that, together with Shares owned by Parent, represents at least a majority of the then outstanding Shares on a fully diluted basis.${PAD}`,
  `(ii) any applicable waiting period under the HSR Act shall not have expired or been terminated.${PAD}`,
  `(iii) any representation or warranty of the Company contained in this Agreement shall not be true and correct in all material respects.${PAD}`,
  `(iv) the Company shall not have performed in all material respects its obligations required to be performed prior to the Expiration Time.${PAD}`,
  `(v) the Company shall have failed to deliver a certificate certifying satisfaction of the conditions in paragraphs (iii) and (iv) above.${PAD}`,
  `(vi) there shall be in effect any Order of a court of competent jurisdiction restraining or prohibiting consummation of the Offer.${PAD}`,
  `(vii) there shall be pending any Proceeding by a Governmental Entity challenging the consummation of the Offer or the Merger.${PAD}`,
  `(viii) this Agreement shall have been terminated in accordance with its terms.${PAD}`,
].join('\n\n');

test('lettered annex: chapeau + (a)-(g) splits into preamble + 7 provisions', () => {
  const parts = splitOfferConditionAnnex(LETTERED_ANNEX, 'COND-B');
  assert.ok(parts, 'should split');
  assert.equal(parts.length, 8); // 1 chapeau + 7 conditions
  assert.equal(parts[0].letter, '_preamble');
  assert.ok(/shall not be required to accept for payment/.test(parts[0].text));
  const letters = parts.slice(1).map((p) => p.letter);
  assert.deepEqual(letters, ['a', 'b', 'c', 'd', 'e', 'f', 'g']);
  // Verbatim discipline: every item's text is an exact substring of the source.
  for (const p of parts) {
    assert.ok(LETTERED_ANNEX.includes(p.text), `part ${p.letter} must be a verbatim substring`);
  }
});

test('roman-numeral annex (real Pharmasset shape): chapeau + (i)-(viii) splits into preamble + 8 provisions', () => {
  const parts = splitOfferConditionAnnex(ROMAN_ANNEX, 'COND-B');
  assert.ok(parts, 'should split');
  assert.equal(parts.length, 9); // 1 chapeau + 8 conditions
  assert.equal(parts[0].letter, '_preamble');
  const markers = parts.slice(1).map((p) => p.letter);
  assert.deepEqual(markers, ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii']);
  for (const p of parts) {
    assert.ok(ROMAN_ANNEX.includes(p.text), `part ${p.letter} must be a verbatim substring`);
  }
});

test('normal short 2-condition COND section passes through untouched (returns null)', () => {
  // Mutual/buyer/target conditions articles that already split correctly via
  // splitSubClauses must never be captured by the annex pre-split.
  const shortSection =
    'SECTION 6.1. Conditions to Each Party\'s Obligations. The obligations of ' +
    'each party to consummate the Merger are subject to the satisfaction of ' +
    'the following conditions: (a) the Company Stockholder Approval shall ' +
    'have been obtained; (b) no Law shall prohibit the consummation of the Merger.';
  const parts = splitOfferConditionAnnex(shortSection, 'COND-M');
  assert.equal(parts, null);
});

test('a long non-COND section (e.g. an IOC section) is never touched', () => {
  const parts = splitOfferConditionAnnex(LETTERED_ANNEX, 'IOC');
  assert.equal(parts, null);
});

test('a long COND section with only 3 enumerated items does not qualify (below ANNEX_MIN_ITEMS)', () => {
  // Padded well past ANNEX_MIN_CHARS so this isolates the ITEM-COUNT guard,
  // not the length guard.
  const bigPad = PAD.repeat(6);
  const threeItemAnnex = [
    CHAPEAU,
    `(a) there shall not have been validly tendered a majority of the outstanding Shares.${bigPad}`,
    `(b) any applicable waiting period under the HSR Act shall not have expired.${bigPad}`,
    `(c) this Agreement shall have been terminated in accordance with its terms.${bigPad}`,
  ].join('\n\n');
  assert.ok(threeItemAnnex.length > 2000, 'fixture must clear the length gate on its own');
  const parts = splitOfferConditionAnnex(threeItemAnnex, 'COND-B');
  assert.equal(parts, null);
});
