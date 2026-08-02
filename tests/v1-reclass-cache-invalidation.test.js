/* v1 reclassification (2026-08-02) — classify prior-snapshot cache
 * invalidation (spec §2, "Retired-code enforcement"): cached provisionCode
 * values that are retired must be DROPPED (cache bypass) so
 * `--classify-only --apply` cannot carry old codes forward. Run: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const { classifySections } = require('../lib/parser-v2/classify');
const { sectionTextHash } = require('../lib/parser-v2/snapshot');

// Minimal fake Anthropic client — returns a fixed classification for
// whatever sections are sent to the AI pass, so the test never makes a
// network call.
function fakeClient(provisionType) {
  return {
    messages: {
      create: async () => ({
        content: [{
          text: JSON.stringify([{ index: 0, provisionType, confidence: 'medium', reasoning: 'fake' }]),
        }],
      }),
    },
  };
}

const section = {
  title: 'Consents and Approvals',
  heading: 'Consents and Approvals',
  text: 'Some non-deterministic section body that requires AI classification and has no title-rule match at all whatsoever, repeated for length. '.repeat(3),
  number: '3.6',
};

test('a cached provisionCode that is retired is bypassed — the section falls through to AI reclassification instead of carrying the retired code forward', async () => {
  const hash = sectionTextHash(section.text);
  const prior = new Map([[hash, { provisionType: 'REP-T', provisionCode: 'REP-T-CONSENT', confidence: 'high' }]]);

  const client = fakeClient('REP-T');
  const [result] = await classifySections([section], [], client, { prior });

  assert.notEqual(result.classifiedBy, 'cache');
  assert.notEqual(result.provisionCode, 'REP-T-CONSENT');
});

test('a cached provisionCode that is NOT retired is reused normally (cache hit, no AI call)', async () => {
  const hash = sectionTextHash(section.text);
  const prior = new Map([[hash, { provisionType: 'REP-T', provisionCode: 'REP-T-FDA', confidence: 'high' }]]);

  // No client passed at all — if this test were to fall through to the AI
  // pass it would throw (no client.messages.create), proving the cache hit
  // actually short-circuited the AI call.
  const [result] = await classifySections([section], [], null, { prior });

  assert.equal(result.classifiedBy, 'cache');
  assert.equal(result.provisionCode, 'REP-T-FDA');
});
