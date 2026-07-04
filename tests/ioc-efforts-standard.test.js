// FB3 item 2 — IOC affirmative-covenant limbs must carry EXACTLY ONE
// standard field (efforts_standard), never a second, independently-derived
// materialityQualifier on the same limb. Live Metsera bug: the Preservation-
// of-Relationships limb carried efforts_standard: COMMERCIALLY_REASONABLE_EFFORTS
// *and* materialityQualifier: FLAT simultaneously, rendering as two
// contradictory pills in the review UI. deriveIocLimbEffortsStandard
// deterministically re-derives the standard from the limb's own text (never
// trusting the LLM's guess to be internally consistent), and
// normalizeIocLimbEffortsStandards applies it to every limb + strips the
// legacy materialityQualifier/materiality keys.
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  deriveIocLimbEffortsStandard,
  normalizeIocLimbEffortsStandards,
  splitIocPreamble,
  buildFeatureInstructions,
} = require('../lib/parser-v2/extract.js');
const { EFFORTS_STANDARDS } = require('../lib/taxonomy');

test('EFFORTS_STANDARDS includes FLAT for the unqualified case', () => {
  assert.ok(EFFORTS_STANDARDS.FLAT, 'FLAT must be a registered EFFORTS_STANDARDS code');
});

test('deriveIocLimbEffortsStandard: unqualified ordinary-course limb is FLAT', () => {
  assert.equal(
    deriveIocLimbEffortsStandard('conduct its business in the ordinary course'),
    'FLAT',
  );
});

test('deriveIocLimbEffortsStandard: unqualified "material respects" limb is FLAT, not MATERIAL_RESPECTS', () => {
  assert.equal(
    deriveIocLimbEffortsStandard('maintain its material assets and business organization intact in all material respects'),
    'FLAT',
  );
});

test('deriveIocLimbEffortsStandard: "use commercially reasonable efforts to preserve ..." is COMMERCIALLY_REASONABLE_EFFORTS', () => {
  assert.equal(
    deriveIocLimbEffortsStandard('use commercially reasonable efforts to preserve its present relationships with suppliers'),
    'COMMERCIALLY_REASONABLE_EFFORTS',
  );
});

test('deriveIocLimbEffortsStandard: "reasonable best efforts" is not misread as plain "best efforts"', () => {
  assert.equal(
    deriveIocLimbEffortsStandard('use reasonable best efforts to retain key employees'),
    'REASONABLE_BEST_EFFORTS',
  );
});

test('deriveIocLimbEffortsStandard: plain "best efforts" resolves correctly', () => {
  assert.equal(deriveIocLimbEffortsStandard('use best efforts to obtain consents'), 'BEST_EFFORTS');
});

test('normalizeIocLimbEffortsStandards fixes the live Metsera contradiction (CRE + FLAT on one limb)', () => {
  // Real Metsera shape: the LLM's "obligation" phrase omitted the "use
  // commercially reasonable efforts to" prefix (it landed only in the
  // separate, contradictory efforts_standard/materialityQualifier fields) —
  // but the provision's OWN text (from splitIocPreamble) carries the full
  // qualifying phrase, which the derivation must fall back to.
  const preserveProvision = {
    type: 'IOC',
    code: 'IOC-PRESERVE',
    text: 'use commercially reasonable efforts to preserve its present relationships with suppliers, licensors, licensees, Governmental Entities and others having material business dealings with it,',
    features: {
      positiveObligations: [
        {
          appliesTo: ['SUPPLIERS', 'LICENSORS_LICENSEES'],
          obligation: 'preserve its present relationships with suppliers, licensors, licensees, Governmental Entities and others having material business dealings with it',
          efforts_standard: 'COMMERCIALLY_REASONABLE_EFFORTS',
          materialityQualifier: 'FLAT',
        },
      ],
    },
  };
  normalizeIocLimbEffortsStandards([preserveProvision]);
  const limb = preserveProvision.features.positiveObligations[0];
  assert.equal(limb.efforts_standard, 'COMMERCIALLY_REASONABLE_EFFORTS');
  assert.equal('materialityQualifier' in limb, false, 'legacy materialityQualifier must be stripped');
});

test('normalizeIocLimbEffortsStandards re-derives FLAT for the ordinary-course limb, overriding a wrong LLM guess', () => {
  const ordinaryProvision = {
    type: 'IOC',
    code: 'IOC-ORDINARY',
    features: {
      positiveObligations: [
        {
          appliesTo: ['BUSINESS'],
          obligation: 'conduct its business in the ordinary course',
          efforts_standard: null,
          materialityQualifier: 'ORDINARY_COURSE',
        },
      ],
    },
  };
  normalizeIocLimbEffortsStandards([ordinaryProvision]);
  const limb = ordinaryProvision.features.positiveObligations[0];
  assert.equal(limb.efforts_standard, 'FLAT');
  assert.equal('materialityQualifier' in limb, false);
});

test('normalizeIocLimbEffortsStandards is a no-op for provisions with no positiveObligations', () => {
  const p = { type: 'IOC', code: 'IOC-GENERAL-EXCEPTIONS', features: { text: 'except as required by law' } };
  normalizeIocLimbEffortsStandards([p]);
  assert.deepEqual(p.features, { text: 'except as required by law' });
});

test('the IOC preamble prompt instructs efforts_standard as the SOLE standard, with FLAT for unqualified duties', () => {
  const instr = buildFeatureInstructions('IOC', { scope: 'preamble' });
  assert.match(instr, /efforts_standard is the SOLE standard/);
  assert.match(instr, /NEVER echo the limb's own covenant CONTENT/);
  assert.match(instr, /FLAT/);
});

// Regression guard: splitIocPreamble itself (the deterministic text
// splitter) must keep working unchanged — the fix lives in the standard
// DERIVATION, not the text-splitting logic tested in
// tests/ioc-preamble-split.test.js.
test('splitIocPreamble still detects all limbs on the Metsera-shaped preamble', () => {
  const preamble =
    'the Company shall, and shall cause each Company Subsidiary to, conduct its ' +
    'business in the ordinary course and, to the extent consistent therewith, ' +
    'use commercially reasonable efforts to preserve its present relationships ' +
    'with suppliers, licensors, licensees, Governmental Entities and other ' +
    'Persons with which it has material business relations and maintain its ' +
    'material assets and business organization intact in all material respects.';
  const split = splitIocPreamble(preamble);
  assert.ok(split, 'preamble should split');
  const keys = split.obligations.map((o) => o.key);
  assert.ok(keys.includes('IOC-ORDINARY'));
  assert.ok(keys.includes('IOC-PRESERVE'));
  assert.ok(keys.includes('IOC-MAINTAIN'));
});
