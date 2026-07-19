// Drift guard for lib/query/field-options.js — the client-safe generated map
// behind the query builder's dependent field dropdown. Regenerates the map
// from the real registry (featureDefsForWpType + DERIVED_FIELDS, both
// Node-side) and fails if the checked-in file differs, so registry changes
// can't silently leave the dropdown stale.
const test = require('node:test');
const assert = require('node:assert');

const types = require('../lib/query/types.js');
const { DERIVED_FIELDS } = require('../lib/query/derived-fields.js');
const { FIELD_OPTIONS_BY_PROVISION_TYPE } = require('../lib/query/field-options.js');

function cleanLabel(l) {
  return String(l || '')
    .replace(/\s+[—-]\s+object\s*\{[^}]*\}\s*$/i, '')
    .replace(/\s+\(.*?\)\s*$/, '')
    .trim();
}

function regenerate() {
  const map = {};
  for (const pt of types.PROVISION_CARD_TYPES) {
    const derived = Object.entries(DERIVED_FIELDS)
      .filter(([, def]) => !def.provisionType || def.provisionType === pt)
      .map(([key, def]) => ({ key, label: cleanLabel(def.label) || key, type: def.type || 'text' }));
    const defs = types.featureDefsForWpType(pt).map((d) => ({
      key: d.key,
      label: cleanLabel(d.label) || d.key,
      type: d.type || 'text',
      ...(Array.isArray(d.options) && d.options.length ? { options: d.options } : {}),
    }));
    const seen = new Set();
    map[pt] = [...derived, ...defs]
      .filter((o) => o.key && !seen.has(o.key) && seen.add(o.key))
      .sort((a, b) => a.label.localeCompare(b.label));
  }
  return map;
}

test('field-options map matches a fresh regeneration from the registry', () => {
  assert.deepEqual(
    FIELD_OPTIONS_BY_PROVISION_TYPE,
    regenerate(),
    'lib/query/field-options.js is stale — regenerate it from lib/query/types.js featureDefsForWpType + DERIVED_FIELDS (see the generator snippet in that file header / this test)',
  );
});

test('every provision type in the dropdown map is a real PROVISION_CARD_TYPES entry and vice versa', () => {
  assert.deepEqual(Object.keys(FIELD_OPTIONS_BY_PROVISION_TYPE).sort(), [...types.PROVISION_CARD_TYPES].sort());
});

test('known fields surface for their types (goShopPresent under NOSOL, feePctOfDealValue derived under TERMINATION_FEE)', () => {
  const nosolKeys = FIELD_OPTIONS_BY_PROVISION_TYPE.COVENANT_NO_SOLICITATION.map((o) => o.key);
  assert.ok(nosolKeys.includes('forceTheVote'), 'forceTheVote listed for NOSOL');
  const termfKeys = FIELD_OPTIONS_BY_PROVISION_TYPE.TERMINATION_FEE.map((o) => o.key);
  assert.ok(termfKeys.includes('feePctOfDealValue'), 'derived field listed for TERMINATION_FEE');
  assert.ok(termfKeys.includes('companyTerminationFee'));
});
