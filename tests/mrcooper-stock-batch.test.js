const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const { getFeaturesForType } = require('../lib/rubric');
const { buildFeatureInstructions } = require('../lib/parser-v2/extract');

let logic;
test.before(async () => {
  logic = await import(path.join('..', 'components', 'review', 'table-logic.js'));
});

test('headline consideration type derives cash, stock, and mixed election deals', () => {
  assert.equal(
    logic.deriveHeadlineConsiderationType([{ considerationType: 'all-cash', perShareAmount: '$10.00' }]),
    'CASH',
  );
  assert.equal(
    logic.deriveHeadlineConsiderationType([{ considerationType: 'all-stock', exchangeRatio: '11 shares of Parent stock' }]),
    'STOCK',
  );
  assert.equal(
    logic.deriveHeadlineConsiderationType([{ considerationType: 'mixed-cash-and-stock', prorationMechanics: { electionType: 'MIXED_ELECTION' } }]),
    'MIXED_ELECTION',
  );
  assert.equal(
    logic.deriveHeadlineConsiderationType([{ perShareAmount: '$10.00', exchangeRatio: '0.5 shares of Parent common stock' }]),
    'MIXED',
  );
  assert.equal(
    logic.deriveHeadlineConsiderationType([{ considerationType: 'mixed-cash-and-stock' }]),
    'MIXED',
  );
});

test('headline consideration labels humanize mixed and election values', () => {
  assert.equal(logic.headlineConsiderationLabel('MIXED'), 'Mixed cash / stock');
  assert.equal(logic.headlineConsiderationLabel('MIXED_ELECTION'), 'Election');
  assert.equal(
    logic.headlineConsiderationLabel('MIXED_ELECTION', [{
      consideration_equity: {
        election_mechanism: {
          election_type: 'CASH_OR_STOCK',
          options: [
            { option_type: 'CASH_ELECTION' },
            { option_type: 'STOCK_ELECTION' },
          ],
        },
      },
    }]),
    'Cash / stock election',
  );
  assert.equal(
    logic.headlineConsiderationLabel('MIXED_ELECTION', [{
      features: { prorationMechanics: { electionType: 'MIXED_ELECTION' } },
    }]),
    'Mixed election',
  );
});

test('ELECTION-REDO-SPEC-2026-07-16: findElectionMechanism scans cards for the first true (2+ option) election mechanism', () => {
  assert.equal(logic.findElectionMechanism([]), null);
  assert.equal(logic.findElectionMechanism([{ id: 'no-election' }]), null);
  // A carrier with only one option is not a true election (matches the
  // enforceElectionInvariants "at least two options" rule) -- must be
  // skipped, not returned.
  assert.equal(
    logic.findElectionMechanism([{
      consideration_equity: { election_mechanism: { options: [{ option_type: 'CASH_ELECTION' }] } },
    }]),
    null,
  );
  const mechanism = { election_type: 'CASH_OR_STOCK', options: [{ option_type: 'CASH_ELECTION' }, { option_type: 'STOCK_ELECTION' }] };
  assert.equal(
    logic.findElectionMechanism([{ id: 'other' }, { consideration_equity: { election_mechanism: mechanism } }]),
    mechanism,
  );
  // camelCase (features.considerationEquity.electionMechanism) shape from
  // the extraction pipeline resolves the same way as the snake_case API
  // shape.
  assert.equal(
    logic.findElectionMechanism([{ features: { considerationEquity: { electionMechanism: mechanism } } }]),
    mechanism,
  );
});

test('ELECTION-REDO-SPEC-2026-07-16: electionAttributionLabel ties a headline feature value to the option it belongs to', () => {
  const mechanism = {
    options: [
      { option_type: 'CASH_ELECTION', option_label: 'Cash Election', cash_per_share: 505 },
      { option_type: 'STOCK_ELECTION', option_label: 'Stock Election', stock_per_share: 20.2 },
    ],
  };
  assert.equal(logic.electionAttributionLabel(mechanism, 'perShareAmount', '$505.00'), 'Cash Election');
  assert.equal(logic.electionAttributionLabel(mechanism, 'exchangeRatio', 20.2), 'Stock Election');
  // Unmatched values and unrelated feature keys never guess.
  assert.equal(logic.electionAttributionLabel(mechanism, 'perShareAmount', '$999.00'), null);
  assert.equal(logic.electionAttributionLabel(mechanism, 'appraisalRightsAvailable', true), null);
  assert.equal(logic.electionAttributionLabel(null, 'perShareAmount', '$505.00'), null);
});

test('CONSID schema includes stock-deal feature keys', () => {
  const keys = new Set(getFeaturesForType('CONSID').map((f) => f.key));
  for (const key of [
    'exchangeRatioType',
    'exchangeRatioText',
    'collar',
    'walkAwayRight',
    'prorationMechanics',
    'dividendEquivalence',
    'taxReorgIntended',
    'taxReorgText',
  ]) {
    assert.ok(keys.has(key), `${key} present`);
  }
});

test('CONSID extraction prompt contains the stock-consideration rules verbatim', () => {
  const expected = `STOCK-CONSIDERATION FEATURES (populate ONLY when the deal pays stock in whole or part; null otherwise):
- exchangeRatioType (enum FIXED / FLOATING): FIXED when a set number of Parent shares per Company share; FLOATING when the ratio adjusts to deliver a fixed dollar value based on Parent's stock price over a measurement period. Capture the verbatim formula in exchangeRatioText.
- collar: { present (boolean), type (SYMMETRIC/ASYMMETRIC/null), floor (text), cap (text), text (verbatim) } — price bounds within which the ratio or value adjusts; outside a collar the consideration fixes or termination/walk-away rights arise.
- walkAwayRight: { present, party, trigger (verbatim price/decline test), fillOrKillOption (verbatim any top-up/"fix" right that defeats the walk-away), text } — price-based termination right in stock deals.
- prorationMechanics: { electionType (CASH_ELECTION/STOCK_ELECTION/MIXED_ELECTION/null), oversubscriptionTreatment (verbatim how oversubscribed elections are cut back pro rata), electionDeadline (text), text } — only for election deals.
- dividendEquivalence (text): treatment of Parent dividends/record dates relative to closing for the stock consideration.
- taxReorgIntended (boolean) + taxReorgText: whether the parties intend Section 368(a) reorganization treatment.
Every text field VERBATIM; absence stays null — a cash-only deal carries NONE of these.`;
  assert.ok(buildFeatureInstructions('CONSID').includes(expected));
});

test('display grouping moves equity awards and lock-up stock-consideration rows into CONSID', () => {
  assert.equal(
    logic.displayTypeForProvision({ type: 'STRUCT', category: '[PROPOSED] Treatment of Equity Awards', features: { sectionNumber: '1.5' } }, []),
    'CONSID',
  );
  assert.equal(
    logic.displayTypeForProvision({ type: 'COV', category: '[PROPOSED] Lock-Up of Stock Consideration', text: 'Transfer of Cavalier Class L Common Stock' }, []),
    'CONSID',
  );
});

test('bare IOC affirmative preamble rows display under IOC-T when target IOC exists', () => {
  const ordinary = { id: 'ord', type: 'IOC', code: 'IOC-ORDINARY', category: 'Ordinary Course Obligation' };
  const all = [ordinary, { id: 'neg', type: 'IOC-T', code: 'IOC-CHARTER', category: 'Charter' }];
  assert.equal(logic.displayTypeForProvision(ordinary, all), 'IOC-T');
});

test('D&O display values compact to Metsera-style period and cap labels', () => {
  assert.equal(logic.compactDoValue('indemnificationPeriod', 6), '6 years');
  assert.equal(
    logic.compactDoValue('insuranceCap', 'shall not be required to spend more than 300% of the current annual premium paid by the Company'),
    '300% of annual premium',
  );
  assert.equal(
    logic.compactDoValue('insuranceCap', 'shall not be required to spend more than the amount set forth on Section 6.3 of the Maverick Disclosure Schedules (the "Cap Amount")'),
    'Cap Amount',
  );
});

test('TERMF dollar formatter strips words and preserves numeric dollars', () => {
  assert.equal(logic.numericDollarOnly('($300,000,000)'), '$300,000,000');
  assert.equal(logic.numericDollarOnly('Three Hundred Million Dollars ($300,000,000)'), '$300,000,000');
});

test('IOC-B and IOC-T legacy table wiring is retired behind schema cards', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'pages', 'review', '[id].js'), 'utf8');
  assert.match(src, /<ProvisionCardTable reviewDeal=\{reviewDealForTables/, 'schema card table remains the user render path');
  assert.doesNotMatch(src, /iocProvisions=\{allFilteredIocProvisions\}/);
  assert.doesNotMatch(src, /side=\{iocSide\}/);
});

test('DealsTable has a filterable Consideration column', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'components', 'DealsTable.js'), 'utf8');
  assert.match(src, /key: 'consideration', label: 'Consideration', kind: 'text'/);
  assert.match(src, /row\.consideration/);
});
