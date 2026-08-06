'use strict';

/**
 * tests/canonical-v2-bare-citation-trigger-parser.test.js
 *
 * docs/codex-program/notes/citation-scope-design.md Part 6.7's own test
 * plan pointer: "pin `parseBareCitationTriggerQuote` directly against every
 * real quote in this evidence bundle (9 bare, at least the topping-fee
 * quote as a real not-bare negative case) and against the disjunctive
 * '...Section 7.1(c)(ii) or Section 7.1(c)(iii)' shape specifically, since
 * that is the one real quote in this corpus that must yield two
 * references, not one."
 *
 * Every "bare" quote below is copied verbatim (byte-for-byte, not retyped)
 * from evidence/canonical-v2/modiv-termination-fee-promptv3-20260805's
 * three recorded responses -- this task's own working evidence, not the
 * older modiv-termination-fee-scope-correction-20260805 run the design doc
 * itself analysed (that run's Section 7.3 response had SIX fee_trigger_
 * assertions entries and Section 8.12 had five SEPARATE ones; the
 * promptv3 run this file pins instead has FIVE in 7.3 -- the topping-fee
 * quote is correctly routed to wave_b_mechanics/TAIL_FEE_STRUCTURE under
 * PROMPT_VERSION 3, not into fee_trigger_assertions at all -- and TWO
 * disjunctive ones in 8.12, each citing multiple Section 7.3(b) sub-clauses
 * at once). The topping-fee negative case below is still pinned verbatim
 * from the OLDER run specifically because it is the one real quote on
 * record that a bare-citation classifier must reject, and because
 * candidate-resolution.js's own existing MODIV_TOPPING_FEE_NULL_TRIGGER_
 * QUOTE fixture (tests/canonical-v2-termination-fee-resolution.test.js)
 * already pins the identical string for a different purpose -- reusing it
 * here, rather than inventing a new "real-shaped" negative quote, keeps
 * both files testing the exact same bytes.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parseBareCitationTriggerQuote,
} = require('../lib/canonical-v2/native-producer/bare-citation-trigger-parser');

// ─── Real bare quotes, verbatim, evidence/canonical-v2/modiv-termination-
// fee-promptv3-20260805/native-producer-recorded-response-7.3.json
// fee_trigger_assertions[0..4].quote ───

test('promptv3 7.3[0]: "by Parent pursuant to Section 7.1(d)(ii)" is bare, cites 7.1(d)(ii)', () => {
  const result = parseBareCitationTriggerQuote('by Parent pursuant to Section 7.1(d)(ii)');
  assert.equal(result.is_bare_citation, true);
  assert.deepEqual(result.cited_references, ['7.1(d)(ii)']);
});

test('promptv3 7.3[1]: "by the Company pursuant to Section 7.1(c)(i)" is bare, cites 7.1(c)(i)', () => {
  const result = parseBareCitationTriggerQuote('by the Company pursuant to Section 7.1(c)(i)');
  assert.equal(result.is_bare_citation, true);
  assert.deepEqual(result.cited_references, ['7.1(c)(i)']);
});

test('promptv3 7.3[2]: "by Parent pursuant to Section 7.1(d)(i)" is bare, cites 7.1(d)(i)', () => {
  const result = parseBareCitationTriggerQuote('by Parent pursuant to Section 7.1(d)(i)');
  assert.equal(result.is_bare_citation, true);
  assert.deepEqual(result.cited_references, ['7.1(d)(i)']);
});

test('promptv3 7.3[3]: "by Parent pursuant to Section 7.1(d)(iii)" is bare, cites 7.1(d)(iii)', () => {
  const result = parseBareCitationTriggerQuote('by Parent pursuant to Section 7.1(d)(iii)');
  assert.equal(result.is_bare_citation, true);
  assert.deepEqual(result.cited_references, ['7.1(d)(iii)']);
});

test('promptv3 7.3[4] (disjunctive): "by the Company pursuant to Section 7.1(c)(ii) or Section 7.1(c)(iii)" is bare and yields TWO references, not one', () => {
  const result = parseBareCitationTriggerQuote('by the Company pursuant to Section 7.1(c)(ii) or Section 7.1(c)(iii)');
  assert.equal(result.is_bare_citation, true);
  assert.deepEqual(result.cited_references, ['7.1(c)(ii)', '7.1(c)(iii)']);
});

// ─── Real bare quotes, verbatim, evidence/canonical-v2/modiv-termination-
// fee-promptv3-20260805/native-producer-recorded-response-8.12.json
// fee_trigger_assertions[0..1].quote -- each disjunctively cites MULTIPLE
// Section 7.3(b) sub-clauses at once. ───

test('promptv3 8.12[0] (disjunctive, 3-way): "if payable pursuant to Section 7.3(b)(i), Section 7.3(b)(ii) or Section 7.3(b)(iii)" is bare and yields three references', () => {
  const result = parseBareCitationTriggerQuote(
    'if payable pursuant to Section 7.3(b)(i), Section 7.3(b)(ii) or Section 7.3(b)(iii)',
  );
  assert.equal(result.is_bare_citation, true);
  assert.deepEqual(result.cited_references, ['7.3(b)(i)', '7.3(b)(ii)', '7.3(b)(iii)']);
});

test('promptv3 8.12[1] (disjunctive, 2-way): "if payable pursuant to Section 7.3(b)(iv) or Section 7.3(b)(v)" is bare and yields two references', () => {
  const result = parseBareCitationTriggerQuote('if payable pursuant to Section 7.3(b)(iv) or Section 7.3(b)(v)');
  assert.equal(result.is_bare_citation, true);
  assert.deepEqual(result.cited_references, ['7.3(b)(iv)', '7.3(b)(v)']);
});

// ─── The design doc's own canonical bare-quote example (Part 6.3), from
// the OLDER scope-correction run's phrasing (includes a leading
// "terminated" the promptv3 run's own equivalent quote does not carry --
// pinned here specifically because the design doc names this exact string
// as a quote a correct implementation MUST classify as bare, and the
// offline harness's own cruder prototype (scripts/canonical-v2-citation-
// scope-resolution-harness.mjs) gets this one wrong on the word
// "terminated"). ───

test('design-doc canonical example: "terminated by the Company pursuant to Section 7.1(c)(ii) or Section 7.1(c)(iii)" is bare (the word "terminated" must not defeat classification)', () => {
  const result = parseBareCitationTriggerQuote(
    'terminated by the Company pursuant to Section 7.1(c)(ii) or Section 7.1(c)(iii)',
  );
  assert.equal(result.is_bare_citation, true);
  assert.deepEqual(result.cited_references, ['7.1(c)(ii)', '7.1(c)(iii)']);
});

// ─── Negative case: real descriptive text alongside a citation. This
// quote already has a fair, honest chance to resolve on its own text
// (feeTriggerCorroboratedCodes runs against it directly) -- citation-
// following must never be licensed for it. Verbatim from
// tests/canonical-v2-termination-fee-resolution.test.js's own
// MODIV_TOPPING_FEE_NULL_TRIGGER_QUOTE constant. ───

const MODIV_TOPPING_FEE_NULL_TRIGGER_QUOTE = '(A) (1) by the Company or Parent pursuant to Section 7.1(b)(ii) and a Company Acquisition Proposal shall have been received by the Company or its Representatives after the date of this Agreement or (2) by the Company or Parent pursuant to Section 7.1(b)(iii) and a Person shall have publicly proposed or publicly announced, after the date hereof and prior to the Company Common Stockholders’ Meeting, an intention (whether or not conditional) to make a Company Acquisition Proposal and (B) within twelve (12) months after a termination referred to in this Section 7.3(b)(iii) the Company enters into a definitive agreement relating to, or consummates, any Company Acquisition Proposal';

test('negative (real recorded bytes): the Modiv topping-fee arming quote is NOT bare -- it names its own ground and merely cites sections in passing', () => {
  const result = parseBareCitationTriggerQuote(MODIV_TOPPING_FEE_NULL_TRIGGER_QUOTE);
  assert.equal(result.is_bare_citation, false);
  // cited_references is still populated -- the quote DOES mention these
  // sections, it just is not LICENSED to follow them (see the module's own
  // doc comment on why cited_references is unconditional).
  assert.deepEqual(result.cited_references, ['7.1(b)(ii)', '7.1(b)(iii)', '7.3(b)(iii)']);
});

test('negative: the real Section 7.1(c)(i) Superior Proposal quote (no citation at all) is not bare and cites nothing', () => {
  const quote = 'the Company Board has approved, and substantially concurrently with the termination of this Agreement, '
    + 'the Company enters into, a definitive agreement providing for the implementation of a Superior Proposal';
  const result = parseBareCitationTriggerQuote(quote);
  assert.equal(result.is_bare_citation, false);
  assert.deepEqual(result.cited_references, []);
});

test('negative: real ground text plus a passing section mention stays not-bare', () => {
  const quote = 'the Company shall pay Parent the Company Termination Fee if the Company terminates for a Superior '
    + 'Proposal as described in Section 3.1(c)';
  const result = parseBareCitationTriggerQuote(quote);
  assert.equal(result.is_bare_citation, false);
  assert.deepEqual(result.cited_references, ['3.1(c)']);
});

// ─── Chain-detection shape: a CITED candidate's own raw_value, matching
// the model's own OBSERVED quote-extraction behaviour on this exact
// corpus (isolating the bare citation cleanly, even when the surrounding
// sectionizer node text also carries payment-mechanics prose -- compare
// 7.3(b)(v)'s full 886-byte node text, "(v) by Parent pursuant to Section
// 7.1(d)(iii), then the Company shall pay ... by wire transfer ...", with
// what the SAME model extracted as its OWN fee_trigger_assertions[3].quote
// when shown all of Section 7.3 containing it: "by Parent pursuant to
// Section 7.1(d)(iii)" -- the payment-mechanics tail is dropped, not
// carried into the quote). This is why this parser is only ever run
// against a candidate's raw_value (a model-produced quote), never against
// a raw sectionizer node's full text -- see bare-citation-trigger-
// parser.js's own file header. ───

test('chain-detection shape: a cited candidate quoting only its own bare citation (list-marker prefixed) is bare', () => {
  const result = parseBareCitationTriggerQuote('(i) by Parent pursuant to Section 7.1(d)(ii),');
  assert.equal(result.is_bare_citation, true);
  assert.deepEqual(result.cited_references, ['7.1(d)(ii)']);
});

// ─── Edge cases ───

test('a quote with no "Section X" citation at all is never bare, regardless of length', () => {
  assert.deepEqual(parseBareCitationTriggerQuote('the Company shall pay the fee'), {
    is_bare_citation: false, cited_references: [],
  });
});

test('empty and non-string input never throws and is never bare', () => {
  assert.deepEqual(parseBareCitationTriggerQuote(''), { is_bare_citation: false, cited_references: [] });
  assert.deepEqual(parseBareCitationTriggerQuote(null), { is_bare_citation: false, cited_references: [] });
  assert.deepEqual(parseBareCitationTriggerQuote(undefined), { is_bare_citation: false, cited_references: [] });
});

test('a repeated citation to the SAME reference is deduplicated in cited_references, first-appearance order', () => {
  const result = parseBareCitationTriggerQuote('by Parent pursuant to Section 7.1(d)(ii) or Section 7.1(d)(ii)');
  assert.deepEqual(result.cited_references, ['7.1(d)(ii)']);
});

test('the returned shape is frozen', () => {
  const result = parseBareCitationTriggerQuote('by Parent pursuant to Section 7.1(d)(ii)');
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.cited_references), true);
});
