'use strict';

/**
 * tests/canonical-v2-general-covenant-corroboration.test.js
 *
 * Unit tests for general-covenant-corroboration.js (PLAN.md Step 3G, defect
 * 2) -- the lexicon that replaced generalCovenantGroundingFailure's old
 * rubric.js label/alias corroboration.
 *
 * Positive cases are drawn verbatim from
 * evidence/canonical-v2/modiv-general-covenants-20260807-replay's own
 * candidates (real filed Modiv text, not synthetic strings). Most hostile
 * cases cross-wire those same real quotes against a DIFFERENT covenant
 * code's patterns, proving the widened lexicon still refuses a genuinely
 * wrong candidate rather than matching on generic contract language -- those
 * pairs are textually disjoint and refuse trivially. Two further hostile
 * cases (review condition 2a) pin the genuinely CONFUSABLE pairs instead:
 * real drafting shapes where two codes' vocabularies legitimately overlap
 * and BOTH corroborate on the same quote (COV-NOTIFY/COV-LITNOTIFY on a
 * litigation-notice clause; COV-PUBLICITY/COV-SECREPORT on a publicity
 * clause that also mentions SEC filings). Corroborating a code is not the
 * same question as the resolver CHOOSING between two codes that both
 * corroborate -- see candidate-resolution.js's `generalCovenantDoubleFire`
 * for the routing rule that catches the choice, not just the match.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  generalCovenantCodeCorroborated,
  GENERAL_COVENANT_CODE_PATTERNS,
} = require('../lib/canonical-v2/native-producer/general-covenant-corroboration');

// Real quotes, copied verbatim from
// evidence/canonical-v2/modiv-general-covenants-20260807-replay/run-receipt.json.
const REAL_ACCESS_QUOTE = 'the Company shall, and shall cause each Company Subsidiary to, (i) give Parent and its '
  + 'authorized Representatives reasonable access during normal business hours to all properties, facilities, '
  + 'personnel and books and records of the Company and each Company Subsidiary';
const REAL_CONFIDENTIALITY_QUOTE = 'Each party will hold and will cause their authorized Representatives to hold '
  + 'in confidence all documents and information concerning the other party or its subsidiaries made available or '
  + 'provided to them or their Representatives by the first party or their Representatives in connection with the '
  + 'Mergers and the other Transactions pursuant to the terms of that certain Mutual Non-Disclosure Agreement';
const REAL_PUBLICITY_QUOTE_1 = 'shall consult with each other before issuing any press release or otherwise '
  + 'making any public statements that may, or could reasonably be expected to, delay the consummation of the '
  + 'Mergers or with respect to this Agreement or the Mergers';
const REAL_PUBLICITY_QUOTE_2 = 'shall not issue any such press release or make any such public statement without '
  + 'the prior written consent of the other parties hereto (which consent shall not be unreasonably withheld, '
  + 'conditioned or delayed)';
const REAL_NOTIFY_QUOTE = 'The Company shall give prompt notice to Parent, and Parent shall give prompt notice to '
  + 'the Company, of any notice or other communication received by such party from any Person alleging that the '
  + 'consent of such Person is or may be required in connection with the Mergers or the other Transactions.';
const REAL_TAKEOVER_QUOTE_1 = 'None of the Parties will take any action that would cause the Transactions to be '
  + 'subject to requirements imposed by any Takeover Laws';
const REAL_TAKEOVER_QUOTE_2 = 'each of them will take all reasonable steps within its control to exempt (or ensure '
  + 'the continued exemption of) the Transactions from the Takeover Laws of any state that purport to apply to this '
  + 'Agreement or the Transactions';
const REAL_SEC_REPORT_QUOTE = 'The Post-Closing SEC Reports provided by the Company in accordance with this '
  + 'Section 6.12 will (i) not contain any untrue statement of a material fact or omit to state any material fact '
  + 'required to be stated therein or necessary in order to make the statements made therein, in the light of the '
  + 'circumstances under which they were made, not misleading and (ii) comply in all material respects with the '
  + 'provisions of applicable Laws.';
const REAL_MERGESUB_QUOTE_1 = 'Parent shall take all action necessary to cause Merger Sub and the Surviving '
  + 'Corporation to perform their respective obligations under this Agreement.';
const REAL_MERGESUB_QUOTE_2 = 'Parent shall cause Merger Sub or the Surviving Corporation, as applicable, to '
  + 'comply with all of its respective obligations under this Agreement.';
const REAL_MERGESUB_QUOTE_3 = 'Parent will take all action necessary to cause Merger Sub and the Surviving '
  + 'Corporation to perform their respective obligations pursuant to this Agreement and to consummate the Mergers.';
const REAL_MERGESUB_QUOTE_4 = 'Parent shall take all actions necessary to cause each of the Merger Subsidiaries '
  + 'to perform its respective obligations under this Agreement and to consummate the Mergers on the terms set forth herein.';

test('every GENERAL_COVENANT_FOLLOW_ON_OWNERS code has at least one pattern', () => {
  const { GENERAL_COVENANT_FOLLOW_ON_OWNERS } = require('../lib/canonical-v2/p0-product-surface-routing');
  for (const code of Object.keys(GENERAL_COVENANT_FOLLOW_ON_OWNERS)) {
    assert.ok(
      Array.isArray(GENERAL_COVENANT_CODE_PATTERNS[code]) && GENERAL_COVENANT_CODE_PATTERNS[code].length > 0,
      `${code} has no corroboration pattern`,
    );
  }
});

test('real Modiv COV-ACCESS candidates corroborate', () => {
  assert.equal(generalCovenantCodeCorroborated({ quote: REAL_ACCESS_QUOTE, code: 'COV-ACCESS' }), true);
  assert.equal(generalCovenantCodeCorroborated({ quote: REAL_CONFIDENTIALITY_QUOTE, code: 'COV-ACCESS' }), true);
});

test('real Modiv COV-PUBLICITY candidates corroborate', () => {
  assert.equal(generalCovenantCodeCorroborated({ quote: REAL_PUBLICITY_QUOTE_1, code: 'COV-PUBLICITY' }), true);
  assert.equal(generalCovenantCodeCorroborated({ quote: REAL_PUBLICITY_QUOTE_2, code: 'COV-PUBLICITY' }), true);
});

test('real Modiv COV-NOTIFY candidate corroborates', () => {
  assert.equal(generalCovenantCodeCorroborated({ quote: REAL_NOTIFY_QUOTE, code: 'COV-NOTIFY' }), true);
});

test('Step 2X-B corpus-pass Takeover Laws candidates corroborate through operative text', () => {
  assert.equal(generalCovenantCodeCorroborated({ quote: REAL_TAKEOVER_QUOTE_1, code: 'COV-TAKEOVER' }), true);
  assert.equal(generalCovenantCodeCorroborated({ quote: REAL_TAKEOVER_QUOTE_2, code: 'COV-TAKEOVER' }), true);
  assert.deepEqual(generalCovenantPrimaryMatchingCodes(REAL_TAKEOVER_QUOTE_1), ['COV-TAKEOVER']);
  assert.deepEqual(generalCovenantPrimaryMatchingCodes(REAL_TAKEOVER_QUOTE_2), ['COV-TAKEOVER']);
});

test('Step 2X-B corpus-pass Post-Closing SEC Reports candidate corroborates through operative text', () => {
  assert.equal(generalCovenantCodeCorroborated({ quote: REAL_SEC_REPORT_QUOTE, code: 'COV-SECREPORT' }), true);
  assert.deepEqual(generalCovenantPrimaryMatchingCodes(REAL_SEC_REPORT_QUOTE), ['COV-SECREPORT']);
});

test('Step 2X-G recurring Merger Sub compliance candidates corroborate without joint-obligor expansion', () => {
  for (const quote of [
    REAL_MERGESUB_QUOTE_1,
    REAL_MERGESUB_QUOTE_2,
    REAL_MERGESUB_QUOTE_3,
    REAL_MERGESUB_QUOTE_4,
  ]) {
    assert.equal(generalCovenantCodeCorroborated({ quote, code: 'COV-MERGESUB' }), true);
    assert.deepEqual(generalCovenantPrimaryMatchingCodes(quote), ['COV-MERGESUB']);
  }
});

// HOSTILE: real Modiv operative text, cross-wired against a covenant code it
// does NOT belong to. Each of these is a genuinely wrong candidate -- proof
// the widened lexicon does not degrade into "any operative clause matches
// any code".
test('HOSTILE: real ACCESS quote does not corroborate as PUBLICITY, NOTIFY, or CONSENT', () => {
  assert.equal(generalCovenantCodeCorroborated({ quote: REAL_ACCESS_QUOTE, code: 'COV-PUBLICITY' }), false);
  assert.equal(generalCovenantCodeCorroborated({ quote: REAL_ACCESS_QUOTE, code: 'COV-NOTIFY' }), false);
  assert.equal(generalCovenantCodeCorroborated({ quote: REAL_ACCESS_QUOTE, code: 'COV-CONSENT' }), false);
});

test('HOSTILE: real PUBLICITY quote does not corroborate as ACCESS or NOTIFY', () => {
  assert.equal(generalCovenantCodeCorroborated({ quote: REAL_PUBLICITY_QUOTE_1, code: 'COV-ACCESS' }), false);
  assert.equal(generalCovenantCodeCorroborated({ quote: REAL_PUBLICITY_QUOTE_1, code: 'COV-NOTIFY' }), false);
});

test('HOSTILE: real NOTIFY quote does not corroborate as ACCESS, PUBLICITY, or INDEMN', () => {
  assert.equal(generalCovenantCodeCorroborated({ quote: REAL_NOTIFY_QUOTE, code: 'COV-ACCESS' }), false);
  assert.equal(generalCovenantCodeCorroborated({ quote: REAL_NOTIFY_QUOTE, code: 'COV-PUBLICITY' }), false);
  assert.equal(generalCovenantCodeCorroborated({ quote: REAL_NOTIFY_QUOTE, code: 'COV-INDEMN' }), false);
});

test('HOSTILE: Step 2X-B corpus-pass phrases do not cross-corrobate', () => {
  assert.equal(generalCovenantCodeCorroborated({ quote: REAL_TAKEOVER_QUOTE_1, code: 'COV-SECREPORT' }), false);
  assert.equal(generalCovenantCodeCorroborated({ quote: REAL_SEC_REPORT_QUOTE, code: 'COV-TAKEOVER' }), false);
});

test('HOSTILE: Takeover Laws and Post-Closing SEC Reports noun mentions are not operative covenants', () => {
  assert.equal(generalCovenantCodeCorroborated({
    quote: 'The definition of Takeover Laws appears in Section 1.1.',
    code: 'COV-TAKEOVER',
  }), false);
  assert.equal(generalCovenantCodeCorroborated({
    quote: 'The disclosure schedule identifies the Post-Closing SEC Reports.',
    code: 'COV-SECREPORT',
  }), false);
});

// HOSTILE (review condition 2a). The pairs above are textually disjoint and
// refuse trivially. These two pairs are the genuinely confusable ones the
// review located: real drafting shapes that legitimately fire BOTH codes'
// patterns at once, because the two codes' vocabularies actually overlap in
// ordinary usage. generalCovenantCodeCorroborated corroborating a code is a
// DIFFERENT question from the resolver CHOOSING between two codes that both
// corroborate -- these tests pin the corroboration-level fact (both fire);
// the double-fire routing rule below is what stops the resolver from
// silently trusting the model's pick between them.
test('HOSTILE (confusable pair): a Transaction-Litigation notice quote fires both COV-NOTIFY and COV-LITNOTIFY', () => {
  const quote = 'The Company shall promptly notify Parent of any Transaction Litigation of which it becomes aware.';
  assert.equal(generalCovenantCodeCorroborated({ quote, code: 'COV-NOTIFY' }), true);
  assert.equal(generalCovenantCodeCorroborated({ quote, code: 'COV-LITNOTIFY' }), true);
});

test('HOSTILE: a publicity covenant that only mentions SEC filings does not become an SEC-reporting covenant', () => {
  const quote = 'The Company shall not issue any press release or other public announcement or SEC filings '
    + 'without the prior written consent of Parent.';
  assert.equal(generalCovenantCodeCorroborated({ quote, code: 'COV-PUBLICITY' }), true);
  assert.equal(generalCovenantCodeCorroborated({ quote, code: 'COV-SECREPORT' }), false);
});

test('HOSTILE: an unknown code never corroborates, whatever the quote', () => {
  assert.equal(generalCovenantCodeCorroborated({ quote: REAL_NOTIFY_QUOTE, code: 'COV-NOT-A-REAL-CODE' }), false);
});

test('quote must be a non-empty string', () => {
  assert.throws(() => generalCovenantCodeCorroborated({ quote: '', code: 'COV-NOTIFY' }), TypeError);
  assert.throws(() => generalCovenantCodeCorroborated({ code: 'COV-NOTIFY' }), TypeError);
});

const {
  applyGeneralCovenantSpecificity,
  resolveGeneralCovenantSpecificity,
  GENERAL_COVENANT_SPECIFICITY_PRECEDENCE,
  generalCovenantPrimaryMatchingCodes,
} = require('../lib/canonical-v2/native-producer/general-covenant-corroboration');
const { GENERAL_COVENANT_FOLLOW_ON_OWNERS } = require('../lib/canonical-v2/p0-product-surface-routing');

test('specificity: NOTIFY+LITNOTIFY suppresses NOTIFY', () => {
  const matches = ['COV-LITNOTIFY', 'COV-NOTIFY'];
  assert.deepEqual(applyGeneralCovenantSpecificity(matches), ['COV-LITNOTIFY']);
  assert.equal(GENERAL_COVENANT_SPECIFICITY_PRECEDENCE[0].winner, 'COV-LITNOTIFY');
});

test('specificity: asserted NOTIFY remaps to LITNOTIFY on dual-coding quote', () => {
  const quote = 'The Company shall promptly notify Parent of any Transaction Litigation of which it becomes aware.';
  const result = resolveGeneralCovenantSpecificity({
    quote,
    assertedCode: 'COV-NOTIFY',
    owners: GENERAL_COVENANT_FOLLOW_ON_OWNERS,
  });
  assert.equal(result.action, 'REMAP');
  assert.equal(result.code, 'COV-LITNOTIFY');
  assert.equal(result.from, 'COV-NOTIFY');
});

test('specificity: asserted LITNOTIFY passes when NOTIFY also matches', () => {
  const quote = 'The Company shall promptly notify Parent of any Transaction Litigation of which it becomes aware.';
  const result = resolveGeneralCovenantSpecificity({
    quote,
    assertedCode: 'COV-LITNOTIFY',
    owners: GENERAL_COVENANT_FOLLOW_ON_OWNERS,
  });
  assert.equal(result.action, 'PASS');
});

test('COV-MERGESUB no longer fires on Rule 16b-3 joint-obligor drafting', () => {
  const quote = 'Parent, Merger Sub and the Company shall take all such steps as may be required to cause any dispositions of equity securities of the Company to be exempt under Rule 16b-3 under the Exchange Act.';
  const matches = generalCovenantPrimaryMatchingCodes(quote);
  assert.ok(matches.includes('COV-16B'));
  assert.ok(!matches.includes('COV-MERGESUB'), `unexpected MERGESUB hit: ${matches.join(',')}`);
});

test('COV-MERGESUB no longer fires on publicity joint-obligor drafting', () => {
  const quote = 'Parent and Merger Sub, on the one hand, and the Company, on the other hand, shall consult with each other before issuing any press release or other public statements.';
  const matches = generalCovenantPrimaryMatchingCodes(quote);
  assert.ok(matches.includes('COV-PUBLICITY'));
  assert.ok(!matches.includes('COV-MERGESUB'), `unexpected MERGESUB hit: ${matches.join(',')}`);
});

test('HOSTILE: COV-MERGESUB does not jump from a different Merger Sub action to another subject performance clause', () => {
  const quote = 'Parent shall cause Merger Sub to enter the agreement and the Surviving Corporation to perform its obligations.';
  assert.equal(generalCovenantCodeCorroborated({ quote, code: 'COV-MERGESUB' }), false);
});
