/* ─────────────────────────────────────────────────────────────────────────
   Extraction-core correctness fixes (2026-07-15) — hermetic tests.

   EXT-1  Strategy D: alias-matched DEF provisions (emitted with
          features:{canonicalTerm}) must reach the step-5 feature-extraction
          batch. The old filter required a COMPLETELY empty features bag,
          which no DEF path ever produced — the pass was dead code and
          alias-matched MAEs shipped with no carve-outs.

   EXT-3  Strategy B: each provision parsed out of a multi-section chunk
          must carry its OWN section's startChar (+ its offset within the
          section), not the chunk's first-section startChar.

   Gap F  The per-rep features.linkedBringDownStandard stamp is no longer
          produced at extraction (its implicit MAT_MAE_QUALIFIED catch-all
          uniformly mis-stamped reps); the render derives per-rep bring-down
          from the closing-condition bringDownTiers instead.

   All tests use a mock Anthropic client — no network, no DB.
   ───────────────────────────────────────────────────────────────────────── */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const extract = require('../lib/parser-v2/extract');
const {
  strategyB,
  strategyD,
  locateProvisionStartChar,
  filterFeaturesToCodeSchema,
} = extract;

function mockClient(handler) {
  const calls = [];
  return {
    calls,
    messages: {
      create: async (args) => {
        calls.push(args);
        const body = await handler(args, calls.length);
        return { content: [{ text: JSON.stringify(body) }] };
      },
    },
  };
}

// ───────────────────────── EXT-1: Strategy D alias defs ─────────────────────

// Long MAE definition: quoted term + enumerated carve-outs pushed past the
// old 2000-char cap so the test also pins the carve-out-heavy budget.
const FILLER = 'any change, event, occurrence, development or effect that, individually or in the aggregate, has had or would reasonably be expected to have a material adverse effect on the business, financial condition or results of operations of the Company and its Subsidiaries, taken as a whole; ';
const MAE_DEF_TEXT =
  `“MAE” means ${FILLER.repeat(8)}provided, however, that none of the following shall be deemed to constitute a Material Adverse Effect: `
  + '(A) general economic or political conditions; (B) conditions generally affecting the industries in which the Company operates; '
  + '(C) any changes in financial or securities markets in general; (D) acts of war, sabotage or terrorism; '
  + '(E) any changes in applicable Laws or accounting rules; (F) the announcement or pendency of this Agreement; '
  + '(G) any natural or man-made disaster; (H) any failure by the Company to meet projections; '
  + '(I) any action required by this Agreement; and (J) ZEBRA-CARVEOUT-MARKER any matter disclosed in the Company Disclosure Letter.';

test('EXT-1: alias-matched DEF gets its features extracted (step 5 no longer dead code)', async () => {
  assert.ok(MAE_DEF_TEXT.length > 2000, 'fixture must exceed the old 2000-char cap');

  const client = mockClient(async (args) => {
    assert.match(args.messages[0].content, /Extract features from each definition/);
    return {
      results: [{
        idx: 0,
        features: {
          carveouts: ['(A) general economic or political conditions', '(J) matters disclosed'],
          disproportionateImpactClause: 'disproportionately affects the Company',
          // Model omits canonicalTerm — the regex-captured term must survive.
        },
        favorability: 'buyer-favorable',
      }],
    };
  });

  const provisions = await strategyD(
    [{ provision_type: 'DEF', text: MAE_DEF_TEXT, startChar: 4200, category: 'Definitions' }],
    client,
  );

  assert.equal(client.calls.length, 1, 'exactly one call: the step-5 feature batch');
  const mae = provisions.find((p) => p.code === 'DEF-MAE');
  assert.ok(mae, 'alias-matched DEF-MAE provision emitted');
  assert.deepEqual(mae.features.carveouts.length, 2, 'carve-outs populated on the alias-matched def');
  assert.equal(mae.features.disproportionateImpactClause, 'disproportionately affects the Company');
  assert.equal(mae.features.canonicalTerm, 'MAE', 'regex-captured term re-pinned after feature merge');
  assert.equal(mae.favorability, 'buyer-favorable');

  // Carve-out-heavy budget: the (J) tail (past char 2000) must reach the model.
  assert.match(client.calls[0].messages[0].content, /ZEBRA-CARVEOUT-MARKER/,
    'MAE definition text must not be truncated at 2000 chars in the feature batch');
});

test('EXT-1: step-5 failure is best-effort — alias def keeps canonicalTerm and code', async () => {
  const client = {
    messages: { create: async () => { throw new Error('boom'); } },
  };
  const provisions = await strategyD(
    [{ provision_type: 'DEF', text: MAE_DEF_TEXT, startChar: 0, category: 'Definitions' }],
    client,
  );
  const mae = provisions.find((p) => p.code === 'DEF-MAE');
  assert.ok(mae);
  assert.deepEqual(mae.features, { canonicalTerm: 'MAE' });
});

test('EXT-1: AI-classified defs with substantive features are NOT re-sent to step 5', async () => {
  const defText = '“Zorp Widget Threshold” means an amount equal to $50,000,000 in the aggregate, as adjusted pursuant to Section 2.03.';
  const client = mockClient(async (args) => {
    // Only the classification call should happen.
    assert.match(args.messages[0].content, /Classify each defined term/);
    return {
      results: [{
        idx: 0,
        code: 'DEF-GENERAL',
        category: 'Zorp Widget Threshold',
        favorability: 'neutral',
        features: { definitionText: 'an amount equal to $50,000,000' },
      }],
    };
  });
  const provisions = await strategyD(
    [{ provision_type: 'DEF', text: defText, startChar: 10, category: 'Definitions' }],
    client,
  );
  assert.equal(client.calls.length, 1, 'no step-5 call when features are already substantive');
  const def = provisions.find((p) => p.features && p.features.canonicalTerm === 'Zorp Widget Threshold');
  assert.ok(def);
  assert.equal(def.features.definitionText, 'an amount equal to $50,000,000');
});

// ───────────────────────── EXT-3: Strategy B offsets ────────────────────────

const SEC_A_TEXT =
  'Section 5.02 No Solicitation. The Company shall not, and shall cause its Subsidiaries not to, directly or indirectly, '
  + 'solicit, initiate or knowingly encourage any inquiries regarding an Acquisition Proposal, or engage in negotiations '
  + 'concerning any Acquisition Proposal with any Person, in each case subject to the terms of this Agreement.';
// Deliberate double space + newline inside so a whitespace-collapsing model
// echo forces the regex fallback.
const SEC_B_TEXT =
  'Section 5.03 Change of Recommendation. The Board of Directors shall not  withdraw,\nqualify or modify the Company '
  + 'Recommendation in a manner adverse to Parent, except that, prior to the Company Stockholder Approval, the Board may '
  + 'make a Change of Recommendation in response to a Superior Proposal if certain conditions are satisfied in full.';

const CHUNK_SECTIONS = [
  { provision_type: 'NOSOL', text: SEC_A_TEXT, startChar: 1000 },
  { provision_type: 'NOSOL', text: SEC_B_TEXT, startChar: 5000 },
];

test('EXT-3: locateProvisionStartChar resolves per-section offsets', () => {
  // Head of section A → its own startChar.
  assert.equal(locateProvisionStartChar(SEC_A_TEXT.slice(0, 120), CHUNK_SECTIONS, 1000), 1000);
  // Sub-clause 40 chars into section B → 5040, not 1000.
  assert.equal(locateProvisionStartChar(SEC_B_TEXT.slice(40, 200), CHUNK_SECTIONS, 1000), 5040);
  // Whitespace-collapsed echo of the same sub-clause → regex fallback, same offset.
  const collapsed = SEC_B_TEXT.slice(40, 200).replace(/\s+/g, ' ');
  assert.notEqual(collapsed, SEC_B_TEXT.slice(40, 200), 'fixture must actually differ in whitespace');
  assert.equal(locateProvisionStartChar(collapsed, CHUNK_SECTIONS, 1000), 5040);
  // Unlocatable text → legacy fallback.
  assert.equal(
    locateProvisionStartChar('entirely fabricated text that appears in no section of this synthetic agreement whatsoever', CHUNK_SECTIONS, 1000),
    1000,
  );
});

test('EXT-3: strategyB stamps each provision with its own section startChar', async () => {
  const client = mockClient(async () => ({
    provisions: [
      { code: 'NOSOL-PROHIBIT', category: 'Solicitation Prohibition', present: true, favorability: 'neutral', features: {}, text: SEC_A_TEXT.slice(0, 180) },
      { code: 'NOSOL-COR', category: 'Change of Recommendation', present: true, favorability: 'neutral', features: {}, text: SEC_B_TEXT.slice(40, 220) },
      { code: 'NOSOL-FIDUCIARY', category: 'Fiduciary Out', present: true, favorability: 'neutral', features: {}, text: 'fabricated span that matches no section text at all — must fall back gracefully' },
    ],
  }));

  const provisions = await strategyB(CHUNK_SECTIONS, client);
  assert.equal(provisions.length, 3);
  assert.equal(provisions[0].startChar, 1000, 'first section provision keeps section-A offset');
  assert.equal(provisions[1].startChar, 5040, 'second section provision gets ITS section offset + local index');
  assert.equal(provisions[2].startChar, 1000, 'unlocatable text falls back to chunk-first offset (legacy behavior)');
});

test('EXT-3: strategyB error fallback keeps per-section offsets (unchanged)', async () => {
  const client = { messages: { create: async () => { throw new Error('api down'); } } };
  const provisions = await strategyB(CHUNK_SECTIONS, client);
  assert.deepEqual(provisions.map((p) => p.startChar), [1000, 5000]);
  assert.ok(provisions.every((p) => p._error));
});

// ───────────────────────── Gap F: linkedBringDownStandard ───────────────────

test('Gap F: extraction no longer produces the per-rep linkedBringDownStandard stamp', () => {
  // 1. The post-pass producer is gone.
  assert.equal(extract.linkBringDownToReps, undefined, 'linkBringDownToReps must be removed');

  // 2. No extraction code path assigns the feature anymore.
  const src = fs.readFileSync(path.join(__dirname, '..', 'lib', 'parser-v2', 'extract.js'), 'utf-8');
  assert.doesNotMatch(src, /\.\s*linkedBringDownStandard\s*=/, 'extract.js must not assign features.linkedBringDownStandard');

  // 3. The schema filter no longer force-allows it: for a code whose schema
  //    lacks the key, a (hypothetical) hallucinated value is stripped.
  const filtered = filterFeaturesToCodeSchema(
    { mainConcept: 'HSR filing within 10 business days', linkedBringDownStandard: { code: 'MAT_MAE_QUALIFIED' } },
    'ANTI-FILING',
  );
  assert.equal(filtered.linkedBringDownStandard, undefined);
  assert.equal(filtered.mainConcept, 'HSR filing within 10 business days');

  // 4. The read side stays intact: the rubric still declares the field for
  //    REP types (existing corpus rows + render-time derivation read it),
  //    and it remains model-readonly so it never re-enters prompts.
  const { getFeaturesForType } = require('../lib/rubric');
  const repKeys = getFeaturesForType('REP-T').map((f) => f.key);
  assert.ok(repKeys.includes('linkedBringDownStandard'), 'rubric declaration must remain for render/back-compat');
  const { MODEL_READONLY_KEYS } = require('../lib/schema/prompt');
  assert.ok(MODEL_READONLY_KEYS.has('linkedBringDownStandard'));
});
