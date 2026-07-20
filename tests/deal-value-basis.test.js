const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DEAL_VALUE_BASES,
  classifyDealValueBasis,
  classifyDealValueBasisDetailed,
} = require('../lib/deal-value-basis');

test('explicit metadata basis is authoritative and returned in canonical form', () => {
  const deal = { metadata: { deal_value_basis: 'equity value' } };
  assert.equal(classifyDealValueBasis(deal), DEAL_VALUE_BASES.EQUITY_VALUE);
  assert.deepEqual(classifyDealValueBasisDetailed(deal), {
    basis: 'equity_value',
    source: 'metadata.deal_value_basis',
    reason: 'explicit-basis',
  });
});

test('conflicting or unrecognised explicit basis fields fail closed to unknown', () => {
  assert.equal(classifyDealValueBasis({
    metadata: {
      deal_value_basis: 'equity_value',
      value_provenance: { basis: 'enterprise_value' },
    },
  }), 'unknown');
  assert.equal(classifyDealValueBasis({ metadata: { value_basis: 'purchase price basis' } }), 'unknown');
});

test('per-share value derivation is explicitly an equity-value basis', () => {
  assert.deepEqual(classifyDealValueBasisDetailed({
    value_usd: 2_000_000_000,
    metadata: { value_provenance: { kind: 'derived_per_share', note: '$20/sh × 100m fully diluted shares' } },
  }), {
    basis: 'equity_value',
    source: 'value_provenance.kind',
    reason: 'derived-per-share',
  });
});

test('press-release provenance distinguishes equity, enterprise and headline transaction values', () => {
  assert.equal(classifyDealValueBasis({ metadata: { value_provenance: {
    kind: 'press_release',
    note: 'The transaction has an implied equity value of approximately $330 million.',
  } } }), 'equity_value');

  assert.equal(classifyDealValueBasis({ metadata: { value_provenance: {
    kind: 'press_release',
    note: 'The all-cash transaction represents a total enterprise value of approximately $1.65 billion.',
  } } }), 'enterprise_value');

  assert.equal(classifyDealValueBasis({ metadata: { value_provenance: {
    kind: 'press_release',
    note: 'The parties entered into a transaction valuing the Company at $4.5 billion.',
  } } }), 'headline_transaction_value');
});

test('QXO-shaped acquire-for provenance is a headline value, not silently called equity value', () => {
  assert.equal(classifyDealValueBasis({ metadata: { value_provenance: {
    kind: 'press_release',
    note: 'QXO entered into a definitive agreement to acquire TopBuild Corp. for approximately $17 billion.',
  } } }), 'headline_transaction_value');
});

test('specific basis language takes precedence over generic transaction wording', () => {
  assert.equal(classifyDealValueBasis({ metadata: { value_provenance: {
    kind: 'press_release',
    quote: 'An all-stock transaction with an equity value of approximately $1.5 billion.',
    note: 'Headline transaction value announced in February.',
  } } }), 'equity_value');
});

test('conflicting equity and enterprise provenance language fails closed', () => {
  assert.deepEqual(classifyDealValueBasisDetailed({ metadata: { value_provenance: {
    kind: 'press_release',
    quote: 'The transaction has an equity value of $1 billion.',
    note: 'The release also calls the same figure an enterprise value of $1 billion.',
  } } }), {
    basis: 'unknown',
    source: 'value_provenance.quote,value_provenance.note',
    reason: 'conflicting-provenance-language',
  });
});

test('press_release and stated_in_agreement kinds alone do not invent a basis', () => {
  assert.equal(classifyDealValueBasis({ metadata: { value_provenance: { kind: 'press_release' } } }), 'unknown');
  assert.equal(classifyDealValueBasis({ metadata: { value_provenance: { kind: 'stated_in_agreement' } } }), 'unknown');
});

test('no_stated_value remains explicitly unknown even when its note mentions excluded values', () => {
  assert.deepEqual(classifyDealValueBasisDetailed({ metadata: { value_provenance: {
    kind: 'no_stated_value',
    note: 'No headline transaction or equity value was stated.',
  } } }), {
    basis: 'unknown',
    source: 'value_provenance.kind',
    reason: 'no-stated-value',
  });
});
