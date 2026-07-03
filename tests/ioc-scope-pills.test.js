/* Regression for MetsFB2 §3a (repeat): the Applies-To pills on split IOC
   obligations must derive from the provision's OWN full_text enumeration —
   complete per the agreement — not from canonical defaults. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { IOC_AFFIRMATIVE_SCOPE_META } = require('../lib/taxonomy');

const codesFromText = (text) => {
  const hits = [];
  for (const [code, meta] of Object.entries(IOC_AFFIRMATIVE_SCOPE_META || {})) {
    for (const re of (meta.synonyms || [])) { if (re.test(text)) { hits.push(code); break; } }
  }
  return hits;
};

test('Metsera-shaped preservation text yields licensors/licensees (and no phantom customers)', () => {
  const text = 'use its reasonable best efforts to preserve substantially intact its business organization and to preserve its present relationships with suppliers, licensors, licensees, Governmental Entities and other Persons with which it has significant business relations';
  const codes = codesFromText(text);
  assert.ok(codes.includes('LICENSORS_LICENSEES'), 'licensors/licensees must be derived');
  assert.ok(codes.includes('SUPPLIERS'));
  assert.ok(!codes.includes('CUSTOMERS'), 'no phantom pill for a party the text does not enumerate');
});
