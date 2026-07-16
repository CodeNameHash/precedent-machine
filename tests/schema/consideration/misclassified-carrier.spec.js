const test = require('node:test');
const assert = require('node:assert/strict');

// Misclassified-carrier guard (Bioverativ Phase-3 canary): a provision the
// AI stamped CONSID-EQUITY whose text names NO equity instrument must be
// skipped by the converter — not abort the whole ingest via the
// zero-treatments invariant. When the text DOES name an instrument and
// extraction still produced nothing, the invariant must keep firing.
const { convertConsiderationEquityProvisions } = require('../../../lib/parser-v2/consideration-equity');

test('converter skips CONSID-EQUITY provision with no instrument mentions', () => {
  const prov = {
    type: 'CONSID',
    code: 'CONSID-EQUITY',
    text: 'Notwithstanding any other provision of this Agreement, each of Parent, Merger Sub, the Surviving Corporation and the Paying Agent shall be entitled to deduct and withhold from the consideration otherwise payable amounts required under applicable Tax Law.',
    features: {},
  };
  assert.doesNotThrow(() => convertConsiderationEquityProvisions([prov]));
  assert.equal(prov.features.considerationEquity, undefined);
});

test('converter still throws when instruments are named but none extracted', () => {
  const prov = {
    type: 'CONSID',
    code: 'CONSID-EQUITY',
    text: 'Each Company Stock Option outstanding immediately prior to the Effective Time shall become fully vested and be canceled in exchange for a cash payment.',
    features: {},
  };
  assert.throws(() => convertConsiderationEquityProvisions([prov]), /zero treatments/i);
});

test('converter skips when the only instrument mention is negated', () => {
  const prov = {
    type: 'CONSID',
    code: 'CONSID-EQUITY',
    text: 'The Company represents that there are no stock appreciation rights, phantom stock or restricted stock units issued or outstanding as of the date hereof.',
    features: {},
  };
  assert.doesNotThrow(() => convertConsiderationEquityProvisions([prov]));
  assert.equal(prov.features.considerationEquity, undefined);
});

// Bioverativ round 2: definitions are routinely tagged with the topical code
// of the concept they define, so a DEF row can arrive with code
// CONSID-EQUITY while naming instruments ('"Company Equity Awards" means the
// Company Stock Options and the Company Restricted Stock Units.'). It
// carries no treatment and must not be converted — only CONSID-typed
// provisions are treatment carriers.
test('converter skips a DEF-typed provision tagged CONSID-EQUITY', () => {
  const prov = {
    type: 'DEF',
    code: 'CONSID-EQUITY',
    text: '"Company Equity Awards" means the Company Stock Options and the Company Restricted Stock Units.',
    features: { canonicalTerm: 'Company Equity Awards' },
  };
  assert.doesNotThrow(() => convertConsiderationEquityProvisions([prov]));
  assert.equal(prov.features.considerationEquity, undefined);
});
