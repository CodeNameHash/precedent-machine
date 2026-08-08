'use strict';

/**
 * tests/canonical-v2-mae-clause-label-parse.test.js
 *
 * Direct, resolver-independent tests for mae-clause-label-parse.js (docs/
 * codex-program/notes/mae-clause-label.md) -- mirrors
 * canonical-v2-termination-fee-parse.test.js's own style for
 * selectFeeAmountGroundsCondition: every real quote below is copied
 * verbatim from evidence/canonical-v2/topbuild-mae-definition-20260806/
 * native-producer-recorded-response-3.1_a_.json (the model's own recorded
 * output) and tests/fixtures/canonical-v2/mae-definition-family/
 * topbuild-company-mae-definition.txt (the real, committed source text),
 * not invented shapes.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  verifyMaeClauseLabelAdjacency,
  selectMaeClauseLabelSibling,
  verifyMaeClauseLabelContainment,
  verifyMaeClauseLabel,
} = require('../lib/canonical-v2/native-producer/mae-clause-label-parse');

const TOPBUILD_MAE_TEXT = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'canonical-v2', 'mae-definition-family', 'topbuild-company-mae-definition.txt'),
  'utf8',
);

// Every quote/label pair below is copied verbatim from the real recorded
// TopBuild response (native-producer-recorded-response-3.1_a_.json).
const ECONOMY_GENERAL_QUOTE = 'changes or developments in economic, business or labor conditions generally in '
  + 'the United States or other countries in which the Company or any of its Subsidiaries conduct operations';
const FINANCIAL_MARKETS_QUOTE = 'any changes or developments in or affecting the securities, credit or financial markets';
const ACTS_OF_WAR_TERRORISM_QUOTE = 'acts of terrorism or sabotage, civil disturbances or unrest, war (whether or '
  + 'not declared), the commencement, continuation or escalation of a war or military action, acts of hostility';
const NATURAL_DISASTERS_QUOTE = 'storms, earthquakes, floods or other natural disasters';
const PANDEMIC_QUOTE = 'the outbreak or continuation of any epidemic, pandemic or other health crisis';
const D_DISPROPORTIONALITY_QUOTE = 'changes or developments arising out of acts of terrorism or sabotage, civil '
  + 'disturbances or unrest, war (whether or not declared), the commencement, continuation or escalation of a war '
  + 'or military action, acts of hostility, weather conditions or other acts of God (including storms, earthquakes, '
  + 'floods or other natural disasters or changes due to the outbreak or continuation of any epidemic, pandemic or '
  + 'other health crisis), including any actual or threatened material worsening of such conditions, except to the '
  + 'extent that they have a disproportionate effect on the Company and its Subsidiaries, taken as a whole, relative '
  + 'to others in the industry or industries in which the Company and its Subsidiaries operate';
const C_CARVEOUT_QUOTE = 'the announcement of this Agreement and the Transactions, including Effects as a result of '
  + 'the identification of Parent or any of its Affiliates as the acquirer of the Company, provided that this '
  + 'clause (C) shall not apply to any representation or warranty set forth in Section ‎3.1(d)(ii) (or any '
  + 'condition to any party’s obligation to consummate the Mergers relating to such representation or warranty) '
  + 'to the extent that such representation or warranty addresses the consequences of any Effect arising out of, '
  + 'relating to or resulting from the execution and delivery of this Agreement or the consummation of the Mergers';

assert.ok(TOPBUILD_MAE_TEXT.includes(ECONOMY_GENERAL_QUOTE), 'fixture must contain the (A) chapeau verbatim');
assert.ok(TOPBUILD_MAE_TEXT.includes(ACTS_OF_WAR_TERRORISM_QUOTE), 'fixture must contain the (D) war/terrorism words verbatim');
assert.ok(TOPBUILD_MAE_TEXT.includes(D_DISPROPORTIONALITY_QUOTE), 'fixture must contain the full (D) disproportionality quote verbatim');

// ═══════════════════════════════════════════════════════════════════════
// verifyMaeClauseLabelAdjacency (tier 2)
// ═══════════════════════════════════════════════════════════════════════

test('verifyMaeClauseLabelAdjacency: ADJACENT for a top-level label directly prefixing its own quote (real TopBuild (A))', () => {
  const result = verifyMaeClauseLabelAdjacency({
    sectionText: TOPBUILD_MAE_TEXT, quote: ECONOMY_GENERAL_QUOTE, clauseLabel: '(A)',
  });
  assert.deepEqual(result, { outcome: 'ADJACENT' });
});

test('verifyMaeClauseLabelAdjacency: ADJACENT for a nested sub-item label ((1) inside (A), real TopBuild)', () => {
  const result = verifyMaeClauseLabelAdjacency({
    sectionText: TOPBUILD_MAE_TEXT, quote: FINANCIAL_MARKETS_QUOTE, clauseLabel: '(1)',
  });
  assert.deepEqual(result, { outcome: 'ADJACENT' });
});

test('verifyMaeClauseLabelAdjacency: NOT_ADJACENT for a compound clause\'s narrowed sub-fragment (real TopBuild (D) war/terrorism words, preceded by shared chapeau "changes or developments arising out of")', () => {
  const result = verifyMaeClauseLabelAdjacency({
    sectionText: TOPBUILD_MAE_TEXT, quote: ACTS_OF_WAR_TERRORISM_QUOTE, clauseLabel: '(D)',
  });
  assert.deepEqual(result, { outcome: 'NOT_ADJACENT' });
});

test('verifyMaeClauseLabelAdjacency: HOSTILE -- a label absent from the source entirely is NOT_ADJACENT, never a throw or a guess', () => {
  const result = verifyMaeClauseLabelAdjacency({
    sectionText: TOPBUILD_MAE_TEXT, quote: ECONOMY_GENERAL_QUOTE, clauseLabel: '(Z)',
  });
  assert.deepEqual(result, { outcome: 'NOT_ADJACENT' });
});

test('verifyMaeClauseLabelAdjacency: HOSTILE -- a quote absent from sectionText entirely is QUOTE_NOT_LOCATED, never a throw', () => {
  const result = verifyMaeClauseLabelAdjacency({
    sectionText: TOPBUILD_MAE_TEXT, quote: 'this sentence appears nowhere in the fixture', clauseLabel: '(A)',
  });
  assert.deepEqual(result, { outcome: 'QUOTE_NOT_LOCATED', occurrences: 0 });
});

test('verifyMaeClauseLabelAdjacency: HOSTILE -- a quote appearing TWICE in sectionText is QUOTE_NOT_LOCATED (ambiguous position), never picks the first occurrence', () => {
  const duplicated = `(X) the shared clause text. Later, unrelated: (X) the shared clause text.`;
  const result = verifyMaeClauseLabelAdjacency({
    sectionText: duplicated, quote: 'the shared clause text.', clauseLabel: '(X)',
  });
  assert.deepEqual(result, { outcome: 'QUOTE_NOT_LOCATED', occurrences: 2 });
});

test('verifyMaeClauseLabelAdjacency: tolerates whitespace/newlines between the label and the quote (real filings wrap and paginate)', () => {
  const result = verifyMaeClauseLabelAdjacency({
    sectionText: '...prior clause;\n\n  (K)   \n  the wrapped clause text', quote: 'the wrapped clause text', clauseLabel: '(K)',
  });
  assert.deepEqual(result, { outcome: 'ADJACENT' });
});

test('verifyMaeClauseLabelAdjacency: throws on malformed input, same discipline as selectFeeAmountGroundsCondition', () => {
  assert.throws(() => verifyMaeClauseLabelAdjacency({ sectionText: 'text', quote: '', clauseLabel: '(A)' }), TypeError);
  assert.throws(() => verifyMaeClauseLabelAdjacency({ sectionText: 'text', quote: 'text', clauseLabel: '' }), TypeError);
  assert.throws(() => verifyMaeClauseLabelAdjacency({ sectionText: 123, quote: 'text', clauseLabel: '(A)' }), TypeError);
});

// ═══════════════════════════════════════════════════════════════════════
// selectMaeClauseLabelSibling (tier 3)
// ═══════════════════════════════════════════════════════════════════════

test('selectMaeClauseLabelSibling: SELECTED -- each of clause (D)\'s three narrowed sub-quotes is uniquely nested inside the real (D) disproportionality quote', () => {
  for (const narrow of [ACTS_OF_WAR_TERRORISM_QUOTE, NATURAL_DISASTERS_QUOTE, PANDEMIC_QUOTE]) {
    const result = selectMaeClauseLabelSibling({
      quote: narrow, candidates: [{ quote: D_DISPROPORTIONALITY_QUOTE }],
    });
    assert.equal(result.outcome, 'SELECTED');
    assert.equal(result.candidate.quote, D_DISPROPORTIONALITY_QUOTE);
  }
});

test('selectMaeClauseLabelSibling: NONE when the candidate list is empty (the ordinary case -- no sibling anchor exists)', () => {
  const result = selectMaeClauseLabelSibling({ quote: NATURAL_DISASTERS_QUOTE, candidates: [] });
  assert.deepEqual(result, { outcome: 'NONE' });
});

test('selectMaeClauseLabelSibling: NONE when candidates are real quotes, just never containing this one', () => {
  const result = selectMaeClauseLabelSibling({
    quote: NATURAL_DISASTERS_QUOTE, candidates: [{ quote: ECONOMY_GENERAL_QUOTE }, { quote: FINANCIAL_MARKETS_QUOTE }],
  });
  assert.deepEqual(result, { outcome: 'NONE' });
});

test('selectMaeClauseLabelSibling: AMBIGUOUS when two distinct siblings both contain this quote, never picked or merged', () => {
  const result = selectMaeClauseLabelSibling({
    quote: 'the shared fragment',
    candidates: [
      { quote: 'outer one contains the shared fragment here' },
      { quote: 'a totally different outer contains the shared fragment too' },
    ],
  });
  assert.deepEqual(result, { outcome: 'AMBIGUOUS', candidate_count: 2 });
});

test('selectMaeClauseLabelSibling: a candidate whose own text contains the quote MORE than once is excluded entirely, mirrors selectFeeAmountGroundsCondition\'s own ambiguous-nesting rule', () => {
  const result = selectMaeClauseLabelSibling({
    quote: 'repeat',
    candidates: [{ quote: 'repeat this word: repeat' }],
  });
  assert.deepEqual(result, { outcome: 'NONE' });
});

test('selectMaeClauseLabelSibling: a sibling identical to the quote itself is never selected as its own container', () => {
  const result = selectMaeClauseLabelSibling({
    quote: NATURAL_DISASTERS_QUOTE, candidates: [{ quote: NATURAL_DISASTERS_QUOTE }],
  });
  assert.deepEqual(result, { outcome: 'NONE' });
});

test('selectMaeClauseLabelSibling: extra fields on the winning candidate pass through unchanged', () => {
  const result = selectMaeClauseLabelSibling({
    quote: NATURAL_DISASTERS_QUOTE,
    candidates: [{ quote: D_DISPROPORTIONALITY_QUOTE, entry: { section_reference: '3.1(a)' } }],
  });
  assert.equal(result.outcome, 'SELECTED');
  assert.deepEqual(result.candidate.entry, { section_reference: '3.1(a)' });
});

test('selectMaeClauseLabelSibling: throws on malformed input', () => {
  assert.throws(() => selectMaeClauseLabelSibling({ quote: '', candidates: [] }), TypeError);
  assert.throws(() => selectMaeClauseLabelSibling({ quote: 'x', candidates: null }), TypeError);
});

// ═══════════════════════════════════════════════════════════════════════
// verifyMaeClauseLabel (the composed policy candidate-resolution.js calls)
// ═══════════════════════════════════════════════════════════════════════

test('verifyMaeClauseLabel: tier 1 -- self-referencing quote (real TopBuild (C), "this clause (C)") verifies without any sectionText at all', () => {
  assert.equal(verifyMaeClauseLabel({ quote: C_CARVEOUT_QUOTE, clauseLabel: '(C)' }), true);
});

test('verifyMaeClauseLabel: tier 1 -- a FULL clause quote (label baked in as its own leading prefix, the shape every pre-existing synthetic fixture in this repo uses) verifies without sectionText', () => {
  const fullClauseWithLabel = '(vii) earthquakes, hurricanes, tsunamis or other natural disasters';
  assert.equal(verifyMaeClauseLabel({ quote: fullClauseWithLabel, clauseLabel: '(vii)' }), true);
});

test('verifyMaeClauseLabel: tier 2 -- a correctly narrowed quote with no self-reference verifies via source adjacency (real TopBuild (G))', () => {
  const quote = 'changes or developments after the date hereof in applicable Laws, regulatory policies or the definitive interpretations thereof';
  assert.equal(verifyMaeClauseLabel({ quote, clauseLabel: '(G)', sectionText: TOPBUILD_MAE_TEXT }), true);
});

test('verifyMaeClauseLabel: tier 3 -- clause (D)\'s three real narrowed sub-quotes verify via the sibling disproportionality quote, none needing a model change', () => {
  for (const narrow of [ACTS_OF_WAR_TERRORISM_QUOTE, NATURAL_DISASTERS_QUOTE, PANDEMIC_QUOTE]) {
    const ok = verifyMaeClauseLabel({
      quote: narrow,
      clauseLabel: '(D)',
      sectionText: TOPBUILD_MAE_TEXT,
      siblingQuotes: [D_DISPROPORTIONALITY_QUOTE],
    });
    assert.equal(ok, true, narrow.slice(0, 40));
  }
});

test('verifyMaeClauseLabel: an unverified sibling is never the tier-3 anchor -- when this quote verifies at all, it is tier 4 (structural containment), and a WRONG label with the same unverified sibling still refuses', () => {
  // History: before tier 4 existed, this exact call returned false, which
  // proved tier 3 refused the unverified sibling. Tier 4 (structural clause
  // containment) now legitimately verifies this quote WITHOUT any sibling --
  // NATURAL_DISASTERS_QUOTE genuinely sits inside clause (D)'s own span --
  // so the tier-3 property is pinned in isolation below instead, and the
  // hostile case moves to a WRONG label, which every tier (including 4)
  // must still refuse even with the unverified sibling present.
  const unverifiedSibling = 'material worsening of such conditions'; // real (D) prose, but not adjacent to "(D)" and does not itself contain "(D)"

  // Tier 3 in isolation: the caller-side filter (directlyAdjacent) is what
  // excludes unverified siblings; prove the selector itself never fires
  // with an empty verified set, and that the unverified sibling would not
  // pass the adjacency filter it is gated behind.
  assert.deepEqual(selectMaeClauseLabelSibling({ quote: NATURAL_DISASTERS_QUOTE, candidates: [] }), { outcome: 'NONE' });
  assert.notEqual(
    verifyMaeClauseLabelAdjacency({ sectionText: TOPBUILD_MAE_TEXT, quote: unverifiedSibling, clauseLabel: '(D)' }).outcome,
    'ADJACENT',
    'the unverified sibling must itself fail tier-2 adjacency -- that failure is exactly what keeps it out of the tier-3 candidate set',
  );

  // The overall true result is tier 4's doing, not the sibling's:
  assert.deepEqual(
    verifyMaeClauseLabelContainment({ sectionText: TOPBUILD_MAE_TEXT, quote: NATURAL_DISASTERS_QUOTE, clauseLabel: '(D)' }),
    { outcome: 'CONTAINED' },
  );

  // HOSTILE: the same quote under a WRONG label ((C) is a real clause the
  // quote does NOT sit in) refuses through every tier, unverified sibling
  // present or not.
  assert.equal(verifyMaeClauseLabel({
    quote: NATURAL_DISASTERS_QUOTE,
    clauseLabel: '(C)',
    sectionText: TOPBUILD_MAE_TEXT,
    siblingQuotes: [unverifiedSibling],
  }), false);
});

test('verifyMaeClauseLabelContainment: fails closed on a label absent from the outline, an ambiguous quote, and a quote outside the labelled clause', () => {
  assert.deepEqual(
    verifyMaeClauseLabelContainment({ sectionText: TOPBUILD_MAE_TEXT, quote: NATURAL_DISASTERS_QUOTE, clauseLabel: '(Z)' }),
    { outcome: 'LABEL_NOT_IN_OUTLINE' },
  );
  assert.deepEqual(
    verifyMaeClauseLabelContainment({ sectionText: TOPBUILD_MAE_TEXT, quote: ECONOMY_GENERAL_QUOTE, clauseLabel: '(D)' }),
    { outcome: 'NOT_CONTAINED' },
    'a real (A) quote claimed under (D) must refuse',
  );
  // "(X)" is not a plausible outline value (alphaValue 23 can never open a
  // list), so segmentSubClauses refuses the whole outline -- an equally
  // fail-closed refusal, typed LABEL_NOT_IN_OUTLINE rather than
  // QUOTE_NOT_LOCATED. An ambiguous quote under a REAL label refuses too:
  const duplicated = '(a) shared wording appears here. Unrelated paragraph.\n(b) shared wording appears here.';
  assert.equal(
    verifyMaeClauseLabelContainment({ sectionText: duplicated, quote: 'shared wording appears here.', clauseLabel: '(a)' }).outcome,
    'QUOTE_NOT_LOCATED',
  );
  const notPlausible = '(X) shared wording appears here. Unrelated paragraph. (X) shared wording appears here.';
  assert.equal(
    verifyMaeClauseLabelContainment({ sectionText: notPlausible, quote: 'shared wording appears here.', clauseLabel: '(X)' }).outcome,
    'LABEL_NOT_IN_OUTLINE',
  );
});

test('verifyMaeClauseLabel: HOSTILE -- a label absent from the source entirely still fails, exactly as today, even with real siblings present', () => {
  const ok = verifyMaeClauseLabel({
    quote: NATURAL_DISASTERS_QUOTE,
    clauseLabel: '(Z)',
    sectionText: TOPBUILD_MAE_TEXT,
    siblingQuotes: [D_DISPROPORTIONALITY_QUOTE],
  });
  assert.equal(ok, false);
});

test('verifyMaeClauseLabel: HOSTILE -- a quote whose location in sectionText is ambiguous (appears twice) fails tier 2, and is not rescued by tier 3 unless a distinct, unambiguous sibling also contains it', () => {
  const duplicatedText = `(X) shared wording appears here. Unrelated paragraph. (X) shared wording appears here.`;
  const ok = verifyMaeClauseLabel({
    quote: 'shared wording appears here.', clauseLabel: '(X)', sectionText: duplicatedText,
  });
  assert.equal(ok, false);
});

test('verifyMaeClauseLabel: HOSTILE -- a carve-out with no clause_label at all is handled by the caller before this function is ever invoked (documented, not this function\'s own concern)', () => {
  // candidate-resolution.js's handleMaeCarveoutCandidate checks `!clauseLabel`
  // BEFORE calling verifyMaeClauseLabel at all (unchanged code) -- this
  // function itself defends the same case defensively (empty-string
  // clauseLabel) so a future caller cannot accidentally skip that gate.
  assert.equal(verifyMaeClauseLabel({ quote: NATURAL_DISASTERS_QUOTE, clauseLabel: '', sectionText: TOPBUILD_MAE_TEXT }), false);
  assert.equal(verifyMaeClauseLabel({ quote: NATURAL_DISASTERS_QUOTE, clauseLabel: null, sectionText: TOPBUILD_MAE_TEXT }), false);
});

test('verifyMaeClauseLabel: never throws on malformed input -- returns false (unlike the tier helpers it composes, which throw on malformed direct calls)', () => {
  assert.equal(verifyMaeClauseLabel({ quote: '', clauseLabel: '(A)', sectionText: TOPBUILD_MAE_TEXT }), false);
  assert.equal(verifyMaeClauseLabel({ quote: 'x', clauseLabel: '(A)' }), false); // no sectionText -> tier 1 only, correctly fails
});
