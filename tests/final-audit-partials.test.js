const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

let tableLogic;
let conditions;

test.before(async () => {
  tableLogic = await import(path.join('..', 'components', 'review', 'table-logic.js'));
  conditions = await import(path.join('..', 'lib', 'canonical-conditions.js'));
});

test('NOSOL material-improvement limbs split on the deliverability anchor, not an earlier "and"', () => {
  const source = 'would be more favorable, from a financial point of view, to the Company Stockholders than the Merger, taking into account all financial, legal, regulatory and other aspects of such proposal and this Agreement and is reasonably likely to be consummated on the terms proposed';
  const limbs = tableLogic.superiorProposalLimbs(source);

  assert.equal(limbs.length, 2);
  assert.equal(limbs[0].label, 'Value limb');
  assert.match(limbs[0].text, /taking into account all financial, legal, regulatory and other aspects of such proposal and this Agreement$/);
  assert.doesNotMatch(limbs[0].text, /reasonably likely/i);
  assert.equal(limbs[1].label, 'Deliverability limb');
  assert.match(limbs[1].text, /^is reasonably likely to be consummated/i);
});

test('NOSOL material-improvement limbs render value first even when deliverability is drafted first', () => {
  const source = 'is reasonably likely to be consummated on the terms proposed and would result in greater value to the stockholders of the Company from a financial point of view than the transactions contemplated by this Agreement';
  const limbs = tableLogic.superiorProposalLimbs(source);

  assert.equal(limbs.length, 2);
  assert.equal(limbs[0].label, 'Value limb');
  assert.match(limbs[0].text, /^would result in greater value/i);
  assert.equal(limbs[1].label, 'Deliverability limb');
  assert.match(limbs[1].text, /^is reasonably likely to be consummated/i);
});

test('Skechers buyer-side bring-down is already represented by COND-S-REP tiers', () => {
  const row = conditions.CANONICAL_CONDITIONS_S.find((r) => /Bring[\s-]*Down/i.test(r.label));
  const provision = {
    category: 'Accuracy of Buyer Reps',
    ai_metadata: {
      code: 'COND-S-REP',
      features: {
        bringDownTiers: [
          {
            standard: 'MAT_MAE_AGGREGATE',
            standard_label: 'Would not, individually or in aggregate, have MAE',
            reps_covered: 'Buyer Parties representations and warranties other than Section 4.14(c) and Section 4.15',
          },
          {
            standard: 'MAT_ALL_MATERIAL',
            standard_label: 'In all material respects',
            reps_covered: 'Buyer Parties representations and warranties in Section 4.14(c)',
          },
          {
            standard: 'MAT_ALL_RESPECTS_DE_MINIMIS',
            standard_label: 'True except for de minimis inaccuracies',
            reps_covered: 'Buyer Parties representations and warranties in Section 4.15',
          },
        ],
      },
    },
  };

  assert.equal(conditions.conditionRowMatches(row, provision, provision.ai_metadata.code), true);
  const lines = tableLogic.buildBringdownTierLines(provision.ai_metadata.features.bringDownTiers, {});
  assert.deepEqual(lines.map((line) => line.std), ['MAE standard', 'In all material respects', 'De minimis']);
});

test('audit-2 cosmetics remain covered by source-level fixes', () => {
  const shared = fs.readFileSync(path.join(__dirname, '..', 'components', 'review', 'shared.js'), 'utf8');
  assert.match(shared, /'DGCL'/);
  assert.match(shared, /export function prettifyEnumValue/);
  assert.equal(tableLogic.buildAocNoMaeLimbText(true, null), 'No MAE since [date not specified]');
});
