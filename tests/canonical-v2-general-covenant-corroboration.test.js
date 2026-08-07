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
 * candidates (real filed Modiv text, not synthetic strings). Hostile cases
 * cross-wire those same real quotes against a DIFFERENT covenant code's
 * patterns, proving the widened lexicon still refuses a genuinely wrong
 * candidate rather than matching on generic contract language.
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

test('HOSTILE: an unknown code never corroborates, whatever the quote', () => {
  assert.equal(generalCovenantCodeCorroborated({ quote: REAL_NOTIFY_QUOTE, code: 'COV-NOT-A-REAL-CODE' }), false);
});

test('quote must be a non-empty string', () => {
  assert.throws(() => generalCovenantCodeCorroborated({ quote: '', code: 'COV-NOTIFY' }), TypeError);
  assert.throws(() => generalCovenantCodeCorroborated({ code: 'COV-NOTIFY' }), TypeError);
});
