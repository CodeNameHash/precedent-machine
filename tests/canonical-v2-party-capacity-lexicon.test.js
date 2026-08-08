'use strict';

/**
 * Step 3F (docs/core/PLAN.md, "Decide what a joint obligation's party
 * capacity is"). `PARTY_CAPACITY_LEXICON`
 * (lib/canonical-v2/native-producer/candidate-resolution.js) assumes one
 * party per string: `resolvePartyCapacity` used to scan the WHOLE raw string
 * once and return the first array entry whose pattern matched anywhere in
 * it. Correct for "the Company" or "Parent"; silently wrong for a genuine
 * joint obligor naming parties from BOTH sides of the deal at once -- the
 * resolved `party.capacity` picked one side and discarded that the
 * obligation actually binds the other side too, and the result read as an
 * ordinary, correct single-party resolution.
 *
 * THE REAL CORPUS STRING THIS FILE PROVES AGAINST. The antitrust family's
 * INFORMATION_SHARING_OBLIGATION `obligor_party`, copied verbatim from
 * evidence/canonical-v2/modiv-antitrust-20260806/run-receipt.json (also
 * present, byte-identical, in modiv-antitrust-20260807-replay/run-
 * receipt.json):
 *
 *   "Parent, Company Merger Sub, Parent OpCo, the Company and the
 *   Partnership each"
 *
 * -- five parties, both buyer-side (Parent, Company Merger Sub, Parent
 * OpCo) and target-side (the Company, the Partnership), all bound by the
 * same obligation. Grounded below by reading the real committed evidence
 * file, not by re-typing the string and hoping it still matches.
 *
 * A second, independent real corpus string -- general covenants' COV-
 * PUBLICITY `covenant_obligor`, evidence/canonical-v2/modiv-general-
 * covenants-20260807-replay/run-receipt.json: "The Company and Parent, and
 * their respective Subsidiaries" -- is used as a second grounded example so
 * the fix is not proven against only one string shape.
 *
 * THE FIX. `resolvePartyCapacity` now segments a multi-segment raw string
 * (split on its own list conjunctions: comma, "and", "or", "&") and, if the
 * segments' resolved capacities span more than one SIDE of the deal
 * (PARTY_CAPACITY_SIDE_OF: TARGET/SELLER are sell-side, BUYER/BUYER_AFFILIATE
 * are buy-side), returns a new governed marker, `JOINT_MULTI_PARTY_CAPACITY`
 * ("JOINT_MULTI_PARTY"), instead of the first segment's capacity. The party
 * object `resolveParty` mints stays exactly `{ role, value, capacity }` --
 * NOT additive with the member capacities, on purpose: lib/canonical-v2/
 * source-structure.js's `assertParty` requires that exact shape before a
 * provision instance is ever minted and rejects a fourth key outright (this
 * was found the hard way -- see the file-level note in candidate-
 * resolution.js next to JOINT_MULTI_PARTY_CAPACITY). The member capacities
 * remain recoverable from `party.value` via the exported
 * `resolveJointPartyCapacities`, exercised directly below.
 *
 * SIDE-KEYING, NOT CAPACITY-KEYING, AND WHY. A naive "more than one distinct
 * CAPACITY among the segments" rule would also flag a financing-covenant
 * obligor like "Each of Parent and Merger Sub" as joint (BUYER +
 * BUYER_AFFILIATE are different capacity labels) even though both are
 * buy-side -- and tests/canonical-v2-financing-guaranty-resolution.test.js
 * already depends on that real string resolving the single ordinary
 * capacity BUYER. Grouping by SIDE first is what keeps that test green
 * (reconfirmed below, not just by that file's own unchanged pass) while
 * still catching the genuinely cross-side five-party string above.
 *
 * TWO TRAPS RECORDED IN COMMIT 34059a2f, BOTH PROVEN STILL TRUE BELOW:
 *
 *   1. The list is scanned in order and first match wins; Modiv's own
 *      Parent OpCo is also a partnership, and "the Partnership" pattern
 *      sits deliberately AFTER the buyer patterns so a single-party
 *      "Parent OpCo" string still resolves BUYER, not TARGET. Untouched by
 *      this fix: a single-segment string (no list separator present) never
 *      enters the new joint-detection branch at all.
 *   2. A merger sub named after the target ("Company Merger Sub") matches
 *      the target `company` pattern first -- wrong in principle, and this
 *      step does not fix it (the plan is explicit that it is "not currently
 *      reached by any single-party candidate"). Proven unchanged: a bare
 *      "Company Merger Sub" string still resolves TARGET after this fix,
 *      exactly as before it.
 *
 * STEP 3F1 (docs/core/PLAN.md, "Stop the joint-capacity fix manufacturing
 * phantom joints, and give the marker a downstream contract"). Trap 2 above
 * was recorded as "not currently reached by any single-party candidate", and
 * that was true when Step 3F landed -- but Step 3F's own per-segment
 * joint-detection loop scanned each segment through PARTY_CAPACITY_LEXICON
 * in its WHOLE-STRING order, so `\bcompany\b` matched a "Company Merger Sub"
 * SEGMENT before `merger\s*sub` did, and trap 2 became reachable on every
 * multi-party string naming a target-prefixed merger sub, not just a bare
 * one. Modiv's own real buyer group -- "Parent, Company Merger Sub, Parent
 * OpCo and OpCo Merger Sub" (7.1(c)(ii)/(c)(iii)'s own quotes) -- read as
 * spanning both sides before this fix, even though every name in it is
 * buyer-side.
 *
 * THE FIX. A second lexicon, `PARTY_CAPACITY_SEGMENT_LEXICON`, used ONLY by
 * the per-segment loops (never by the final single-segment whole-string
 * fallback, so trap 1 and trap 2 stay exactly as recorded above for a bare
 * single-party string): `merger\s*sub` moved to the front, every other
 * pattern's relative order unchanged. `resolvePartyCapacity` also now
 * returns the single side's own capacity directly when segments span only
 * ONE side, instead of falling through to a fresh whole-string scan that
 * could re-trigger the same trap (a purely buyer-side list still contains
 * the substring "Company" inside "Company Merger Sub").
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  resolvePartyCapacity,
  resolveParty,
  resolveJointPartyCapacities,
  JOINT_MULTI_PARTY_CAPACITY,
  PARTY_CAPACITY_LEXICON,
} = require('../lib/canonical-v2/native-producer/candidate-resolution');

// ─────────────────────────────────────────────────────────────────────────
// Grounding: the joint-obligor strings this file tests against are copied
// verbatim from the committed evidence, not invented.
// ─────────────────────────────────────────────────────────────────────────

const ANTITRUST_EVIDENCE_PATH = path.join(
  __dirname, '..', 'evidence', 'canonical-v2', 'modiv-antitrust-20260806', 'run-receipt.json',
);
const GENERAL_COVENANTS_EVIDENCE_PATH = path.join(
  __dirname, '..', 'evidence', 'canonical-v2', 'modiv-general-covenants-20260807-replay', 'run-receipt.json',
);

const FIVE_PARTY_JOINT_OBLIGOR = 'Parent, Company Merger Sub, Parent OpCo, the Company and the Partnership each';
const GENERAL_COVENANTS_JOINT_OBLIGOR = 'The Company and Parent, and their respective Subsidiaries';

test('grounding: the five-party joint obligor string is present verbatim in the committed antitrust evidence', () => {
  const receipt = JSON.parse(fs.readFileSync(ANTITRUST_EVIDENCE_PATH, 'utf8'));
  const obligorValues = receipt.compiled_candidates
    .map((entry) => entry?.candidate?.claim?.attributes?.obligor_party)
    .filter((value) => typeof value === 'string');
  assert.ok(
    obligorValues.includes(FIVE_PARTY_JOINT_OBLIGOR),
    'the exact five-party string must appear as a real obligor_party in the committed evidence, not be invented for this test',
  );
});

test('grounding: the general-covenants joint obligor string is present verbatim in the committed evidence', () => {
  const receipt = JSON.parse(fs.readFileSync(GENERAL_COVENANTS_EVIDENCE_PATH, 'utf8'));
  const obligorValues = receipt.compiled_candidates
    .map((entry) => entry?.candidate?.claim?.attributes?.covenant_obligor)
    .filter((value) => typeof value === 'string');
  assert.ok(
    obligorValues.includes(GENERAL_COVENANTS_JOINT_OBLIGOR),
    'the exact general-covenants joint string must appear as a real covenant_obligor in the committed evidence',
  );
});

// ─────────────────────────────────────────────────────────────────────────
// The fix: a real joint-obligation string resolves to a multi-party
// capacity, not the first match.
// ─────────────────────────────────────────────────────────────────────────

test('the five-party joint obligor resolves to JOINT_MULTI_PARTY_CAPACITY, not the first-matched single capacity', () => {
  assert.equal(resolvePartyCapacity(FIVE_PARTY_JOINT_OBLIGOR), JOINT_MULTI_PARTY_CAPACITY);
  // Never TARGET -- the wrong, silent, pre-fix answer (the `company` pattern
  // matches first, inside "Company Merger Sub", scanning the whole string).
  assert.notEqual(resolvePartyCapacity(FIVE_PARTY_JOINT_OBLIGOR), 'TARGET');
});

test('resolveJointPartyCapacities lists both sides genuinely present in the five-party obligor', () => {
  const members = resolveJointPartyCapacities(FIVE_PARTY_JOINT_OBLIGOR);
  assert.ok(members, 'must not be null for a genuinely joint string');
  assert.ok(members.includes('BUYER'), 'Parent, Parent OpCo are buyer-side');
  assert.ok(members.includes('TARGET'), 'the Company, the Partnership are target-side');
});

test('resolveParty mints a JOINT_MULTI_PARTY_CAPACITY party for the five-party obligor, shaped exactly { role, value, capacity }', () => {
  const party = resolveParty({
    attributes: { obligor_party: FIVE_PARTY_JOINT_OBLIGOR },
    mapping: { party_field: 'obligor_party', party_role: 'REGULATORY_COVENANT_OBLIGOR' },
  });
  assert.ok(party, 'a joint obligor must still resolve a party, not fall through to PARTY_UNRESOLVED');
  assert.equal(party.role, 'REGULATORY_COVENANT_OBLIGOR');
  assert.equal(party.value, FIVE_PARTY_JOINT_OBLIGOR);
  assert.equal(party.capacity, JOINT_MULTI_PARTY_CAPACITY);
  // Exactly three keys -- lib/canonical-v2/source-structure.js's assertParty
  // rejects a fourth, even an additive one (see the note next to
  // JOINT_MULTI_PARTY_CAPACITY in candidate-resolution.js). The member
  // capacities are recovered from party.value via resolveJointPartyCapacities
  // instead, proven in the next test.
  assert.deepEqual(Object.keys(party).sort(), ['capacity', 'role', 'value']);
});

test('the joint member capacities are still recoverable from the resolved party\'s own value via resolveJointPartyCapacities', () => {
  const party = resolveParty({
    attributes: { obligor_party: FIVE_PARTY_JOINT_OBLIGOR },
    mapping: { party_field: 'obligor_party', party_role: 'REGULATORY_COVENANT_OBLIGOR' },
  });
  const members = resolveJointPartyCapacities(party.value);
  // Step 3F1: BUYER_AFFILIATE now appears here too -- before that fix,
  // "Company Merger Sub" (this string's own buyer-side merger sub) was
  // itself misclassified TARGET by the per-segment scan's whole-string
  // pattern order, so the member list undercounted at BUYER/TARGET even
  // though the overall JOINT determination (driven by "the Company"/"the
  // Partnership" alone) already happened to be correct.
  assert.deepEqual([...members].sort(), ['BUYER', 'BUYER_AFFILIATE', 'TARGET']);
});

test('the general-covenants joint obligor also resolves to JOINT_MULTI_PARTY_CAPACITY (second real corpus example)', () => {
  assert.equal(resolvePartyCapacity(GENERAL_COVENANTS_JOINT_OBLIGOR), JOINT_MULTI_PARTY_CAPACITY);
  const members = resolveJointPartyCapacities(GENERAL_COVENANTS_JOINT_OBLIGOR);
  assert.deepEqual([...members].sort(), ['BUYER', 'TARGET']);
});

// ─────────────────────────────────────────────────────────────────────────
// The existing ordering test: Parent OpCo (single-party, buyer-side) must
// still resolve buyer-side after this fix. This is what stops the fix
// creating the worse bug -- moving `the Partnership` earlier, or otherwise
// letting the joint path leak into single-party resolution, would silently
// attribute the buyer's operating partnership's obligations to the target.
// ─────────────────────────────────────────────────────────────────────────

test('ordering (commit 34059a2f, trap 1): "Parent OpCo" alone still resolves BUYER, never TARGET, after the joint-obligation fix', () => {
  assert.equal(resolvePartyCapacity('Parent OpCo'), 'BUYER');
  assert.equal(resolveJointPartyCapacities('Parent OpCo'), null, 'a single-segment string never takes the joint path');
});

test('ordering: "the Partnership" alone (no buyer word present) still resolves TARGET, exactly as before this fix', () => {
  assert.equal(resolvePartyCapacity('the Partnership'), 'TARGET');
});

test('side-keying (not capacity-keying) is what keeps the real financing-covenant obligor un-joint: "Each of Parent and Merger Sub" is two capacities but one side', () => {
  // Grounds tests/canonical-v2-financing-guaranty-resolution.test.js's own
  // FINANCING_QUOTE obligor, reproduced here as an explicit regression
  // guard against a capacity-keyed (rather than side-keyed) implementation.
  assert.equal(resolvePartyCapacity('Each of Parent and Merger Sub'), 'BUYER');
  assert.notEqual(resolvePartyCapacity('Each of Parent and Merger Sub'), JOINT_MULTI_PARTY_CAPACITY);
  assert.equal(resolveJointPartyCapacities('Each of Parent and Merger Sub'), null);
});

test('a multi-name, single-side list ("the Company, Surviving Company, the Partnership, the Surviving OpCo or any of their respective affiliates") still resolves the single capacity TARGET', () => {
  const multiNameSameSide = 'the Company, Surviving Company, the Partnership, the Surviving OpCo or any of their respective affiliates';
  assert.equal(resolvePartyCapacity(multiNameSameSide), 'TARGET');
  assert.equal(resolveJointPartyCapacities(multiNameSameSide), null);
});

test('trap 2 (commit 34059a2f, unfixed by this step, proven unchanged): a bare "Company Merger Sub" still matches the target `company` pattern, not BUYER_AFFILIATE', () => {
  assert.equal(resolvePartyCapacity('Company Merger Sub'), 'TARGET');
});

// ─────────────────────────────────────────────────────────────────────────
// Step 3F1: the two probe strings from docs/core/PLAN.md, both confirmed
// live (returned JOINT_MULTI_PARTY_CAPACITY) before this fix. The second is
// Modiv's own real buyer group, verbatim from 7.1(c)(ii)/(c)(iii)'s quotes
// -- grounded below by reading it out of the committed termination evidence,
// not retyped.
// ─────────────────────────────────────────────────────────────────────────

const MODIV_TERMINATION_EVIDENCE_PATH = path.join(
  __dirname, '..', 'evidence', 'canonical-v2', 'modiv-termination-20260806', 'run-receipt.json',
);
// Verbatim from the committed evidence -- "or", not the plan's illustrative
// "and" (docs/core/PLAN.md's probe reads "...Parent OpCo and OpCo Merger
// Sub"; the real filed text at 7.1(c)(ii)/(c)(iii) says "or"). Both
// conjunctions split identically in segmentPartyListString, so this is a
// wording difference only, not a behavioural one -- using the real string
// here rather than the plan's paraphrase.
const MODIV_BUYER_GROUP_QUOTE = 'Parent, Company Merger Sub, Parent OpCo or OpCo Merger Sub';

test('grounding: the four-party buyer-group string is present verbatim in the committed termination evidence (7.1(c)(ii)/(c)(iii))', () => {
  const receipt = JSON.parse(fs.readFileSync(MODIV_TERMINATION_EVIDENCE_PATH, 'utf8'));
  const rawValues = receipt.compiled_candidates
    .map((entry) => entry?.candidate?.claim?.raw_value)
    .filter((value) => typeof value === 'string');
  assert.ok(
    rawValues.some((value) => value.includes(MODIV_BUYER_GROUP_QUOTE)),
    'the exact buyer-group string must appear inside a real quote in the committed evidence, not be invented for this test',
  );
});

test('PLAN probe 1: "Parent and Company Merger Sub" resolves buyer-side, never JOINT_MULTI_PARTY_CAPACITY (was JOINT [BUYER, TARGET] before this fix)', () => {
  assert.equal(resolvePartyCapacity('Parent and Company Merger Sub'), 'BUYER');
  assert.notEqual(resolvePartyCapacity('Parent and Company Merger Sub'), JOINT_MULTI_PARTY_CAPACITY);
  assert.equal(resolveJointPartyCapacities('Parent and Company Merger Sub'), null);
});

test('PLAN probe 2: Modiv\'s own real buyer group resolves buyer-side, never JOINT_MULTI_PARTY_CAPACITY (was JOINT [BUYER, TARGET, BUYER_AFFILIATE] before this fix)', () => {
  assert.equal(resolvePartyCapacity(MODIV_BUYER_GROUP_QUOTE), 'BUYER');
  assert.notEqual(resolvePartyCapacity(MODIV_BUYER_GROUP_QUOTE), JOINT_MULTI_PARTY_CAPACITY);
  assert.equal(resolveJointPartyCapacities(MODIV_BUYER_GROUP_QUOTE), null);
});

test('the "Company Merger Sub" segment inside a multi-party buyer list resolves BUYER_AFFILIATE, not TARGET, via the per-segment lexicon', () => {
  // Direct proof of the mechanism, not just the aggregate outcome: put
  // "Company Merger Sub" alongside ONE real target-side name so the string
  // is genuinely joint, and confirm the member breakdown now classifies it
  // correctly as buyer-side.
  const mixedSide = 'Company Merger Sub and the Partnership';
  assert.equal(resolvePartyCapacity(mixedSide), JOINT_MULTI_PARTY_CAPACITY);
  const members = resolveJointPartyCapacities(mixedSide);
  assert.deepEqual([...members].sort(), ['BUYER_AFFILIATE', 'TARGET']);
});

// ─────────────────────────────────────────────────────────────────────────
// Hostile: a string with no recognisable party at all must still resolve
// nothing, joint or otherwise -- the joint path must never invent a capacity
// where the ordinary single-party path would have found none.
// ─────────────────────────────────────────────────────────────────────────

test('hostile: a comma-separated list with no recognised party words anywhere resolves null, not a spurious joint capacity', () => {
  assert.equal(resolvePartyCapacity('Acme Widgets, Foo Holdings and Bar Industries'), null);
  assert.equal(resolveJointPartyCapacities('Acme Widgets, Foo Holdings and Bar Industries'), null);
});

test('hostile: a joint-shaped string where only ONE side is actually recognised (the rest unmatched) resolves the single recognised capacity, not JOINT_MULTI_PARTY_CAPACITY', () => {
  // Only "Parent" resolves; "Acme Widgets" and "Foo Holdings" match nothing
  // in PARTY_CAPACITY_LEXICON, so this must stay a single-capacity result.
  assert.equal(resolvePartyCapacity('Parent, Acme Widgets and Foo Holdings'), 'BUYER');
});

// Sanity: the lexicon itself still has exactly the entries this file's
// side-grouping assumptions were verified against -- if this fails, the
// tests above are exercising a lexicon shape this file no longer describes.
test('sanity: PARTY_CAPACITY_LEXICON still carries exactly the four capacity labels this file assumes', () => {
  assert.deepEqual(
    [...new Set(PARTY_CAPACITY_LEXICON.map((entry) => entry.capacity))].sort(),
    ['BUYER', 'BUYER_AFFILIATE', 'SELLER', 'TARGET'],
  );
});
