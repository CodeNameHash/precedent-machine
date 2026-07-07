const test = require('node:test');
const assert = require('node:assert/strict');

const { checkAliasIntegrity } = require('../../scripts/schema-shape/check-alias-integrity');
const { checkVersionPins } = require('../../scripts/schema-shape/version-pin-check');
const { assertKeyKnown, historicalKeys, resolveKey } = require('../../lib/schema-shape/resolve-feature-key');

test('PH0C-L: alias resolver deterministic and empty-registry integrity', () => {
  const registry = { aliases: [], schema_version: 1 };
  for (let i = 0; i < 100; i += 1) {
    assert.equal(resolveKey('anyKey', registry), 'anyKey');
    assert.deepEqual(historicalKeys('anyKey', registry), []);
  }
  assert.throws(() => assertKeyKnown('nonexistentKey', [], registry), /Unknown feature key/);
  assert.deepEqual(checkAliasIntegrity(), { ok: true, failures: [] });
});

test('PH0C-L: committed version pins pass', () => {
  assert.deepEqual(checkVersionPins(), { ok: true, failures: [] });
});
