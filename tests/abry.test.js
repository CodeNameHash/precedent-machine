/* Tests for lib/abry.js — the "No Other Reps / Fraud (Abry)" summary logic,
   and the extraction-side plumbing that feeds it (lib/rubric.js FEATURES.MISC,
   lib/parser-v2/extract.js MISC prompt rule).

   THE FOUR QUESTIONS this section answers (one row each, per side):
     Q1  Buyer's non-reliance representation
     Q2  Seller's no-other-reps statement + scope
     Q3  Reciprocal of Q1 — seller non-reliance
     Q4  Reciprocal of Q2 — buyer no-other-reps + scope
   Plus a fraud line: verbatim carve-out, or "Silent on fraud".

   lib/abry.js uses ESM `export`; load it through a dynamic import so this
   test works under `node --test` without a build step (same pattern as
   components/review/table-logic.js / lib/canonical-conditions.js).
*/
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

let mod;
test.before(async () => {
  mod = await import(path.join('..', 'lib', 'abry.js'));
});

function provisionWith(type, code, features) {
  return {
    id: `${type}-${code}-${Math.random().toString(36).slice(2)}`,
    type,
    ai_metadata: { code, features },
  };
}

// ── Real-shaped fixture: Metsera/Pfizer §9.07(b)-(c), as actually stored on
//    a MISC-ENTIRE provision (fetched live from Supabase during development —
//    see the PR description for the exact ai_metadata.features shape). The
//    extraction prompt rule (lib/parser-v2/extract.js MISC block) instructs
//    the model to separate the company-side and parent-side excerpts with a
//    blank line when one section covers both directions, which is what this
//    fixture reproduces. ──
const METSERA_COMPANY_SIDE =
  'Each of Parent and Merger Sub acknowledges that, except for the representations and warranties contained in Article III, neither the Company nor any Person on behalf of the Company makes any other express or implied representation or warranty, and neither Parent nor Merger Sub is relying or has relied on any such representation or warranty, with respect to the Company or any of the Company Subsidiaries or with respect to any other information made available to Parent or Merger Sub, or their respective Representatives, in connection with the Transactions, including the accuracy or completeness thereof.';
const METSERA_PARENT_SIDE =
  "Without limiting the Company's remedies in the case of fraud, the Company acknowledges that, except for the representations and warranties contained in Article IV, none of Parent, Merger Sub or any other Person on behalf of Parent or Merger Sub makes any other express or implied representation or warranty with respect to Parent or Merger Sub or with respect to any other information made available to the Company in connection with the Transactions.";
const METSERA_FRAUD_B =
  'Except in the case of fraud, neither the Company nor any other Person will have or be subject to any liability or indemnification obligation to Parent, Merger Sub or any other Person resulting from the distribution to Parent or Merger Sub, or Parent\'s or Merger Sub\'s use of, any such information, including any information, documents, projections, forecasts or other material made available to Parent or Merger Sub in certain "data rooms" or management presentations in expectation of the Transactions.';
const METSERA_FRAUD_C = "Without limiting the Company's remedies in the case of fraud, the Company acknowledges that...";

function metseraProvision() {
  return provisionWith('MISC', 'MISC-ENTIRE', {
    mainConcept: 'Entire agreement, third-party beneficiaries, and no other representations or warranties.',
    sectionNumber: '9.07',
    noOtherRepsPresent: true,
    noOtherRepsParty: 'BOTH',
    nonRelianceClause: `${METSERA_COMPANY_SIDE}\n\n${METSERA_PARENT_SIDE}`,
    extraContractualClaimsWaived: true,
    fraudCarveout: `${METSERA_FRAUD_B}\n\n${METSERA_FRAUD_C}`,
  });
}

test('deriveAbrySummary: Metsera-shaped MISC-ENTIRE provision answers all four questions + fraud', () => {
  const summary = mod.deriveAbrySummary([metseraProvision()]);

  assert.equal(summary.q1.status, 'yes');
  assert.equal(summary.q1.quote, METSERA_COMPANY_SIDE);

  assert.equal(summary.q2.status, 'yes');
  assert.equal(summary.q2.quote, METSERA_COMPANY_SIDE);
  assert.match(summary.q2.scope, /data room/);
  assert.match(summary.q2.scope, /management presentations/);

  assert.equal(summary.q3.status, 'yes');
  assert.equal(summary.q3.quote, METSERA_PARENT_SIDE);

  assert.equal(summary.q4.status, 'yes');
  assert.equal(summary.q4.quote, METSERA_PARENT_SIDE);
  // The parent-side excerpt itself names no data room / management
  // presentation — the scope label must not fabricate specifics the
  // quote doesn't support, even though extraContractualClaimsWaived is
  // shared true across the whole section.
  assert.equal(summary.q4.scope, 'Agreement + extra-contractual materials');

  assert.equal(summary.fraud.status, 'present');
  assert.match(summary.fraud.quote, /Except in the case of fraud/);
  assert.match(summary.fraud.quote, /Without limiting the Company's remedies/);
});

test('deriveAbrySummary: separate titled provisions (COMPANY-only + PARENT-only) each answer their own pair', () => {
  const companyOnly = provisionWith('REP-T', 'REP-T-NOREP', {
    noOtherRepsPresent: true,
    noOtherRepsParty: 'COMPANY',
    nonRelianceClause: 'Parent has not relied on any representation not expressly set forth in Article III.',
    extraContractualClaimsWaived: false,
  });
  const parentOnly = provisionWith('REP-B', 'REP-B-ANTIRELIANCE', {
    noOtherRepsPresent: true,
    noOtherRepsParty: 'PARENT',
    nonRelianceClause: 'The Company has not relied on any representation not expressly set forth in Article IV.',
    extraContractualClaimsWaived: false,
  });
  const summary = mod.deriveAbrySummary([companyOnly, parentOnly]);

  assert.equal(summary.q1.status, 'yes');
  assert.match(summary.q1.quote, /Parent has not relied/);
  assert.equal(summary.q2.status, 'yes');
  assert.equal(summary.q2.scope, 'Agreement only');

  assert.equal(summary.q3.status, 'yes');
  assert.match(summary.q3.quote, /The Company has not relied/);
  assert.equal(summary.q4.status, 'yes');
  assert.equal(summary.q4.scope, 'Agreement only');

  // Neither provision populated fraudCarveout — silence is meaningful.
  assert.equal(summary.fraud.status, 'silent');
});

test('deriveAbrySummary: no Abry-tagged provision anywhere — all four "not present", fraud "silent"', () => {
  const ordinary = provisionWith('MISC', 'MISC-GOVLAW', {
    mainConcept: 'Delaware governing law.',
    governingLaw: 'Delaware',
  });
  const summary = mod.deriveAbrySummary([ordinary]);
  assert.equal(summary.q1.status, 'not_present');
  assert.equal(summary.q2.status, 'not_present');
  assert.equal(summary.q3.status, 'not_present');
  assert.equal(summary.q4.status, 'not_present');
  assert.equal(summary.fraud.status, 'silent');
});

test('deriveAbrySummary: empty / missing provisions never throws', () => {
  assert.doesNotThrow(() => mod.deriveAbrySummary([]));
  assert.doesNotThrow(() => mod.deriveAbrySummary(null));
  assert.doesNotThrow(() => mod.deriveAbrySummary(undefined));
});

test('deriveAbrySummary: fraud carve-out is picked up even without a full BOTH-party MISC-ENTIRE match', () => {
  const parentOnlyWithFraud = provisionWith('REP-B', 'REP-B-ANTIRELIANCE', {
    noOtherRepsPresent: true,
    noOtherRepsParty: 'PARENT',
    nonRelianceClause: 'The Company has not relied on any representation not expressly set forth in Article IV.',
    extraContractualClaimsWaived: true,
    fraudCarveout: 'nothing in this Section shall limit any claim for fraud',
  });
  const summary = mod.deriveAbrySummary([parentOnlyWithFraud]);
  assert.equal(summary.fraud.status, 'present');
  assert.match(summary.fraud.quote, /claim for fraud/);
  // Q1/Q2 (company side) genuinely absent — no COMPANY/BOTH provision exists.
  assert.equal(summary.q1.status, 'not_present');
  assert.equal(summary.q2.status, 'not_present');
});

// ── Unit tests for the smaller helpers ──────────────────────────────────

test('splitDualSegments: blank-line-separated text splits into two trimmed segments', () => {
  const segs = mod.splitDualSegments(`${METSERA_COMPANY_SIDE}\n\n${METSERA_PARENT_SIDE}`);
  assert.equal(segs.length, 2);
  assert.equal(segs[0], METSERA_COMPANY_SIDE);
  assert.equal(segs[1], METSERA_PARENT_SIDE);
});

test('splitDualSegments: single-paragraph text stays one segment', () => {
  const segs = mod.splitDualSegments(METSERA_COMPANY_SIDE);
  assert.deepEqual(segs, [METSERA_COMPANY_SIDE]);
});

test('splitDualSegments: null/empty input returns an empty array', () => {
  assert.deepEqual(mod.splitDualSegments(null), []);
  assert.deepEqual(mod.splitDualSegments(''), []);
  assert.deepEqual(mod.splitDualSegments(undefined), []);
});

test('deriveScopeLabel: waived=false is always "Agreement only", regardless of quote content', () => {
  assert.equal(mod.deriveScopeLabel('mentions data rooms and management presentations', false), 'Agreement only');
});

test('deriveScopeLabel: waived=true names the specific extra-contractual materials the quote mentions', () => {
  const label = mod.deriveScopeLabel(METSERA_FRAUD_B, true);
  assert.match(label, /data room/);
  assert.match(label, /management presentations/);
  assert.match(label, /projections\/forecasts/);
});

test('deriveScopeLabel: waived=true with no matching keyword falls back to a generic label (never fabricates specifics)', () => {
  assert.equal(mod.deriveScopeLabel('a short clause with no named materials', true), 'Agreement + extra-contractual materials');
});

test('textOf: unwraps citable { value, quotes } and legacy { value, text } wrappers, and tagged items', () => {
  assert.equal(mod.textOf('bare string'), 'bare string');
  assert.equal(mod.textOf({ value: 'x', quotes: ['the real quote'] }), 'the real quote');
  assert.equal(mod.textOf({ value: 'x', text: 'legacy quote' }), 'legacy quote');
  assert.equal(mod.textOf({ code: 'FOO', label: 'Foo', text: 'tagged quote' }), 'tagged quote');
  assert.equal(mod.textOf(null), null);
  assert.equal(mod.textOf(''), null);
  assert.equal(mod.textOf('   '), null);
});

test('partyOf: accepts only the three canonical party values, case-insensitively', () => {
  assert.equal(mod.partyOf('company'), 'COMPANY');
  assert.equal(mod.partyOf('Parent'), 'PARENT');
  assert.equal(mod.partyOf('BOTH'), 'BOTH');
  assert.equal(mod.partyOf('neither'), null);
  assert.equal(mod.partyOf(null), null);
});

// ── Extraction-side plumbing: the MISC-embedded landing that feeds the
//    fixtures above (lib/rubric.js FEATURES.MISC + the MISC prompt rule in
//    lib/parser-v2/extract.js). CommonJS — required directly, no dynamic
//    import needed. ──
const { buildFeatureInstructions } = require('../lib/parser-v2/extract');
const { FEATURES, getFeaturesForType } = require('../lib/rubric');
const { validateFeatures } = require('../lib/feature-validation');

const ABRY_KEYS = ['noOtherRepsPresent', 'noOtherRepsParty', 'nonRelianceClause', 'extraContractualClaimsWaived', 'fraudCarveout'];

test('FEATURES.MISC registers the five Abry fields so MISC-ENTIRE picks them up via the bare-type fallback', () => {
  const miscKeys = FEATURES.MISC.map((f) => f.key);
  for (const k of ABRY_KEYS) assert.ok(miscKeys.includes(k), `FEATURES.MISC missing ${k}`);
  // MISC-ENTIRE has no dedicated FEATURES entry — getFeaturesForType must
  // fall back to the bare MISC schema and therefore include these keys too.
  assert.ok(!FEATURES['MISC-ENTIRE'], 'MISC-ENTIRE should keep using the bare MISC fallback, not a dedicated entry');
  const entireKeys = getFeaturesForType('MISC', 'MISC-ENTIRE').map((f) => f.key);
  for (const k of ABRY_KEYS) assert.ok(entireKeys.includes(k), `getFeaturesForType('MISC','MISC-ENTIRE') missing ${k}`);
});

test('MISC prompt instructs the model to detect embedded no-other-reps/non-reliance language, anchored on real Metsera phrasing', () => {
  const instr = buildFeatureInstructions('MISC');
  assert.match(instr, /MISC-EMBEDDED NO-OTHER-REPS \/ NON-RELIANCE \(ABRY\) DETECTION/);
  for (const k of ABRY_KEYS) assert.match(instr, new RegExp(k), k);
  assert.match(instr, /SILENCE IS LEGALLY MEANINGFUL/);
  // Anchored on the real Metsera §9.07 phrasing (not invented example text).
  // \s+ tolerates the prompt's own line-wrapping of this long quote.
  assert.match(instr, /neither Parent nor Merger Sub is\s+relying or has relied/);
  assert.match(instr, /Without limiting the Company's remedies in the case of fraud/);
  assert.match(instr, /separated by a blank line/i);
});

test('validateFeatures("MISC", ...) accepts a fully-populated Abry feature bag with no unknown-key warnings', () => {
  const features = {
    mainConcept: 'Entire agreement; no other representations or warranties.',
    noOtherRepsPresent: true,
    noOtherRepsParty: 'BOTH',
    nonRelianceClause: 'company-side excerpt\n\nparent-side excerpt',
    extraContractualClaimsWaived: true,
    fraudCarveout: 'Except in the case of fraud, ...',
  };
  const { errors, warnings } = validateFeatures('MISC', features);
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings.filter((w) => w.kind === 'unknown-key'), []);
});

test('validateFeatures("MISC", ...) accepts silence on fraud (null) as valid, not an error', () => {
  const features = {
    mainConcept: 'Entire agreement; no other representations or warranties.',
    noOtherRepsPresent: true,
    noOtherRepsParty: 'COMPANY',
    nonRelianceClause: 'Parent has not relied on anything beyond Article III.',
    extraContractualClaimsWaived: false,
    fraudCarveout: null,
  };
  const { errors, warnings } = validateFeatures('MISC', features);
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings.filter((w) => w.kind === 'unknown-key'), []);
});

test('ordinary MISC provisions (governing law, notices) are unaffected — Abry fields simply stay absent', () => {
  const features = { mainConcept: 'Delaware governing law.', governingLaw: 'Delaware' };
  const { errors, warnings } = validateFeatures('MISC', features);
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings.filter((w) => w.kind === 'unknown-key'), []);
});
