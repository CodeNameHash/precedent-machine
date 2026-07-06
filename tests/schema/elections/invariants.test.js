const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildElectionCarrierProvision,
  enforceConsiderationEquityInvariants,
} = require('../../../lib/parser-v2/consideration-equity');

const {
  buildElectionMechanism,
  enforceElectionInvariants,
} = require('../../../lib/parser-v2/elections');

test('cash-or-stock election with proration emits two options and one proration rule', () => {
  const regionFullText = [
    'Cash Election. Each holder making a Cash Election shall receive $12.50 per share, subject to the Maximum Cash Election Number equal to forty-five percent (45%) of Company Shares.',
    'Stock Election. Each holder making a Stock Election shall receive 0.25 Parent shares per Company Share, subject to the Maximum Stock Election Number equal to fifty-five percent (55%) of Company Shares.',
    'Proration. If Cash Elections are oversubscribed, the Cash Election Shares shall be reduced pro rata and excess shares shall receive Stock Consideration.',
    'Any Non-Election Share shall be deemed to have made a Stock Election.',
  ].join(' ');
  const election = buildElectionMechanism({ regionFullText });

  assert.equal(election.electionType, 'CASH_OR_STOCK');
  assert.equal(election.isProrated, true);
  assert.equal(election.options.length, 2);
  assert.deepEqual(election.options.map((o) => o.optionType), ['CASH_ELECTION', 'STOCK_ELECTION']);
  assert.equal(election.prorationRule.prorationMethod, 'PRO_RATA_REDUCTION');
  enforceElectionInvariants(election, regionFullText);
});

test('synthetic CVR inclusion election emits with-CVR and without-CVR options', () => {
  const regionFullText = [
    'CVR Election. Each holder may elect to receive consideration with CVR rights or without CVR rights.',
    'With CVR. Each share receives $10.00 in cash with a CVR.',
    'Without CVR. Each share receives $11.00 in cash without a CVR.',
  ].join(' ');
  const election = buildElectionMechanism({ regionFullText });

  assert.equal(election.electionType, 'CVR_INCLUSION');
  assert.equal(election.options.length, 2);
  assert.deepEqual(election.options.map((o) => o.cvrIncluded), [true, false]);
  enforceElectionInvariants(election, regionFullText);
});

test('single-form consideration control emits no election', () => {
  const election = buildElectionMechanism({
    regionFullText: 'Each share of Company Common Stock shall be converted into the right to receive $47.50 in cash.',
  });
  assert.equal(election, null);
});

test('shareholder cash-or-stock election in CONSID provision emits an election carrier', () => {
  const fullText = [
    'Section 2.01 Merger Consideration.',
    'Cash Election. Each holder making a Cash Election shall receive $20.00 in cash for each Company Share.',
    'Stock Election. Each holder making a Stock Election shall receive 0.50 Parent shares for each Company Share.',
    'Proration. If Cash Elections are oversubscribed, Cash Election Shares shall be reduced pro rata.',
    'Any Non-Election Share shall be deemed to have made a Stock Election.',
  ].join(' ');
  const carrier = buildElectionCarrierProvision({
    type: 'CONSID',
    code: 'CONSID-CONVERT',
    text: fullText,
    features: { sectionNumber: '2.01' },
  });

  assert.equal(carrier.provisionType, 'CONSID-ELECTION');
  assert.equal(carrier.treatments.length, 0);
  assert.equal(carrier.electionMechanism.electionType, 'CASH_OR_STOCK');
  assert.deepEqual(carrier.electionMechanism.options.map((o) => o.optionType), ['CASH_ELECTION', 'STOCK_ELECTION']);
  enforceConsiderationEquityInvariants(carrier);
});

test('election invariant rejects one option', () => {
  const regionFullText = 'Cash Election. Each holder may elect to receive $10.00 in cash.';
  assert.throws(
    () => enforceElectionInvariants({
      electionType: 'OTHER',
      isProrated: false,
      options: [{
        optionType: 'CASH_ELECTION',
        displayOrder: 1,
        sourceSpanStart: 0,
        sourceSpanEnd: regionFullText.length,
        verbatimQuote: regionFullText,
      }],
      sourceSpanStart: 0,
      sourceSpanEnd: regionFullText.length,
      verbatimQuote: regionFullText,
    }, regionFullText),
    /at least two options/,
  );
});

test('election invariant rejects display-order gaps and quote drift', () => {
  const regionFullText = 'Cash Election. Stock Election.';
  assert.throws(
    () => enforceElectionInvariants({
      electionType: 'CASH_OR_STOCK',
      isProrated: false,
      options: [
        { optionType: 'CASH_ELECTION', displayOrder: 1, cashPerShareFormula: 'cash', sourceSpanStart: 0, sourceSpanEnd: 13, verbatimQuote: 'Cash Election' },
        { optionType: 'STOCK_ELECTION', displayOrder: 3, stockPerShareFormula: 'stock', sourceSpanStart: 15, sourceSpanEnd: 29, verbatimQuote: 'Stock Election.' },
      ],
      sourceSpanStart: 0,
      sourceSpanEnd: regionFullText.length,
      verbatimQuote: regionFullText,
    }, regionFullText),
    /display_order/,
  );
});
