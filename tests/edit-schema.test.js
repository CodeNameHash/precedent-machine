/* Tests for lib/edit-schema.js — curated per-type edit fields. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { getEditFields, resolveEditFields, isMaeDefinition } = require('../lib/edit-schema');

const keys = (fields) => fields.map((f) => f.key);

test('reps expose materiality/knowledge/exceptions/threshold and NOTHING cross-type', () => {
  for (const t of ['REP-T', 'REP-B']) {
    const f = getEditFields(t, null, 'Some Representation');
    assert.deepEqual(keys(f), ['materialityQualifier', 'knowledgeQualifier', 'permittedExceptions', 'dollarThreshold']);
    // The whole point: no disproportionate / MAE-carveout controls on a rep.
    assert.ok(!keys(f).some((k) => /disproportionate|carveout/i.test(k)));
  }
});

test('disproportionate carve-backs appear ONLY on the MAE definition', () => {
  const mae = getEditFields('DEF', 'DEF-MAE', 'Material Adverse Effect');
  assert.ok(keys(mae).includes('disproportionateImpactCarveouts'));
  assert.ok(keys(mae).includes('carveouts'));
  // A non-MAE definition does not.
  assert.equal(isMaeDefinition('DEF', 'DEF-GENERAL', 'Knowledge'), false);
});

test('isMaeDefinition detects by code or category, not other defs', () => {
  assert.equal(isMaeDefinition('DEF', 'DEF-MAE', null), true);
  assert.equal(isMaeDefinition('DEF', null, 'Company Material Adverse Effect'), true);
  assert.equal(isMaeDefinition('DEF', null, 'Acquisition Proposal'), false);
  assert.equal(isMaeDefinition('REP-T', null, 'material adverse effect'), false); // only DEF
});

test('TERMF fee-type codes edit different mechanics', () => {
  assert.deepEqual(keys(getEditFields('TERMF', 'TERMF-TARGET')), ['companyTerminationFee', 'interestOnLatePayment', 'soleAndExclusiveRemedy']);
  assert.deepEqual(keys(getEditFields('TERMF', 'TERMF-TAIL')), ['tailProvision']);
  assert.deepEqual(keys(getEditFields('TERMF', 'TERMF-REVERSE')), ['reverseTerminationFee', 'interestOnLatePayment']);
});

test('party-suffixed COND/TERMR/IOC families resolve to the base schema', () => {
  assert.deepEqual(keys(getEditFields('COND-B', 'COND-B-REP')), keys(getEditFields('COND', null)));
  assert.deepEqual(keys(getEditFields('TERMR-T', 'TERMR-SUPERIOR')), keys(getEditFields('TERMR', null)));
});

test('materiality control carries taxonomy standard options', () => {
  const mat = getEditFields('REP-T', null, 'x').find((f) => f.control === 'materiality');
  assert.ok(mat.options.length >= 5);
  assert.ok(mat.options.some((o) => o.value === 'MAT_MAE_QUALIFIED'));
  assert.ok(mat.options.every((o) => o.label && o.value));
});

test('uncurated type falls back to populated editable rubric fields only', () => {
  const r = resolveEditFields('CONSID', null, 'x', {
    perShareAmount: '$10.00',
    mainConcept: 'ignored',
    definitionText: 'locked to provision text',
    emptyList: [],
  });
  assert.equal(r.curated, false);
  const ks = keys(r.fields);
  assert.ok(ks.includes('perShareAmount'));   // populated → shown
  assert.ok(!ks.includes('mainConcept'));      // hidden by fallback
  assert.ok(!ks.includes('definitionText'));   // locked to provision text
  assert.ok(!ks.includes('emptyList'));        // empty → not shown
});
