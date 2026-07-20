const test = require('node:test');
const assert = require('node:assert/strict');

const { groupColumnsForCrossCut } = require('../lib/query/cross-cut-groups');

function col(field) {
  return { field, label: field };
}

test('groupColumnsForCrossCut: non-NOSOL provision type falls back to one ungrouped bucket', () => {
  const columns = [col('effortsStandard'), col('hellOrHighWater')];
  const groups = groupColumnsForCrossCut('ANTITRUST_REGULATORY', columns);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].heading, null);
  assert.deepEqual(groups[0].columns, columns);
});

test('groupColumnsForCrossCut: empty columns produce no groups', () => {
  assert.deepEqual(groupColumnsForCrossCut('COVENANT_NO_SOLICITATION', []), []);
  assert.deepEqual(groupColumnsForCrossCut('ANTITRUST_REGULATORY', []), []);
});

test('groupColumnsForCrossCut: NOSOL fields bucket under the ordered Ben-facing headings', () => {
  const columns = [
    col('noShopType'),
    col('fiduciaryOutStandard'),
    col('interveningEventStandard'), // rule 2 (fiduciary) wins over rule 3 (intervening event)
    col('interveningEventDefinition'),
    col('superiorProposalTest'),
    col('matchingPeriod'),
    col('forceTheVote'),
    col('noticePeriod'),
    col('standstillWaiver'), // rule 1 (no-shop scope) wins over rule 7 (enforcement)
    col('specificPerformance'),
    col('representativeBreachIsCompanyBreach'),
    col('someUnrelatedField'),
  ];
  const groups = groupColumnsForCrossCut('COVENANT_NO_SOLICITATION', columns);
  const byHeading = Object.fromEntries(groups.map((g) => [g.heading, g.columns.map((c) => c.field)]));

  assert.deepEqual(byHeading['No-shop scope'], ['noShopType', 'standstillWaiver']);
  assert.deepEqual(byHeading['Fiduciary out'], ['fiduciaryOutStandard', 'interveningEventStandard']);
  assert.deepEqual(byHeading['Intervening event'], ['interveningEventDefinition']);
  assert.deepEqual(byHeading['Superior proposal & match rights'], ['superiorProposalTest', 'matchingPeriod']);
  assert.deepEqual(byHeading['Force the vote'], ['forceTheVote']);
  assert.deepEqual(byHeading['Notice & information'], ['noticePeriod']);
  assert.deepEqual(byHeading['Enforcement & remedies'], ['specificPerformance', 'representativeBreachIsCompanyBreach']);
  assert.deepEqual(byHeading['Other terms'], ['someUnrelatedField']);

  // Groups render in the ordered spec order, and only non-empty groups appear.
  assert.deepEqual(groups.map((g) => g.heading), [
    'No-shop scope', 'Fiduciary out', 'Intervening event', 'Superior proposal & match rights',
    'Force the vote', 'Notice & information', 'Enforcement & remedies', 'Other terms',
  ]);
});

test('groupColumnsForCrossCut: a group spec with no matching fields is omitted entirely', () => {
  const columns = [col('noShopType')];
  const groups = groupColumnsForCrossCut('COVENANT_NO_SOLICITATION', columns);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].heading, 'No-shop scope');
});
