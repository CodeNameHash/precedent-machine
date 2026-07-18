const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  normalizeIocLimbEffortsStandards,
  liftIncludedObligationsFromLimbText,
} = require('../lib/parser-v2/extract');

const ROOT = path.resolve(__dirname, '..');

test('liftIncludedObligationsFromLimbText nests Charter/Cox including duties and removes duplicate peer limbs', () => {
  const fullText = 'Columbus shall use commercially reasonable efforts to conduct its business and operations in the Ordinary Course, including using commercially reasonable efforts to preserve intact its business and relationships with customers, suppliers and Governmental Entities, and to retain all of the Columbus Franchises, including (i) using commercially reasonable efforts to perform material obligations under those Franchises and (ii) using commercially reasonable efforts to renew material Columbus Governmental Authorizations expiring before Closing.';
  const provisions = [{
    type: 'IOC-T',
    code: 'IOC-POSITIVE-PREAMBLE',
    full_text: fullText,
    features: {
      positiveObligations: [
        {
          obligation: 'conduct its business and operations in the Ordinary Course, including using commercially reasonable efforts to preserve intact its business and relationships with customers, suppliers and Governmental Entities',
          appliesTo: ['BUSINESS'],
        },
        {
          obligation: 'preserve intact its business and relationships with customers, suppliers and Governmental Entities',
          appliesTo: ['CUSTOMERS', 'SUPPLIERS', 'GOVERNMENTAL_ENTITIES'],
        },
        {
          obligation: 'retain all of the Columbus Franchises, including (i) using commercially reasonable efforts to perform material obligations under those Franchises and (ii) using commercially reasonable efforts to renew material Columbus Governmental Authorizations expiring before Closing',
          appliesTo: ['OTHER_RELATIONSHIPS'],
        },
        {
          obligation: 'perform material obligations under those Franchises',
          appliesTo: ['OTHER_RELATIONSHIPS'],
        },
        {
          obligation: 'renew material Columbus Governmental Authorizations expiring before Closing',
          appliesTo: ['GOVERNMENTAL_ENTITIES'],
        },
      ],
    },
  }];

  normalizeIocLimbEffortsStandards(provisions);
  liftIncludedObligationsFromLimbText(provisions);

  const limbs = provisions[0].features.positiveObligations;
  assert.equal(limbs.length, 2);
  assert.match(limbs[0].obligation, /^conduct its business and operations in the Ordinary Course/);
  assert.equal(limbs[0].includedObligations.length, 1);
  assert.match(limbs[0].includedObligations[0].obligation, /preserve intact its business/);
  assert.match(limbs[1].obligation, /^retain all of the Columbus Franchises/);
  assert.equal(limbs[1].includedObligations.length, 2);
  assert.match(limbs[1].includedObligations[0].obligation, /perform material obligations/);
  assert.match(limbs[1].includedObligations[1].obligation, /renew material Columbus Governmental Authorizations/);

  for (const limb of limbs) {
    assert.equal(limb.efforts_standard, 'COMMERCIALLY_REASONABLE_EFFORTS');
    for (const child of limb.includedObligations) {
      assert.equal(child.efforts_standard, 'COMMERCIALLY_REASONABLE_EFFORTS');
    }
  }
});

test('IOC prompt asks for includedObligations and party_role', () => {
  const src = fs.readFileSync(path.join(ROOT, 'lib/parser-v2/extract.js'), 'utf8');
  assert.match(src, /includedObligations/);
  assert.match(src, /"party_role"/);
  assert.match(src, /Columbus shall[\s\S]*COLUMBUS/);
  assert.match(src, /Cabot Parties[\s\S]*CABOT/);
});

test('review page directly renders IOC-POSITIVE-PREAMBLE and suppresses heading-only IOC rows', () => {
  const src = fs.readFileSync(path.join(ROOT, 'pages/review-v1/[id].js'), 'utf8');
  assert.match(src, /IOC_POSITIVE_PREAMBLE_BUCKET/);
  assert.match(src, /bucket\.synthetic/);
  assert.match(src, /positiveObligationLimbsForDisplay/);
  assert.match(src, /function isHeadingOnlyIocRow/);
  assert.match(src, /if \(isHeadingOnlyIocRow\(p\)\) return false;/);
  assert.match(src, /groupIocProvisionsByPartyRole/);
});
