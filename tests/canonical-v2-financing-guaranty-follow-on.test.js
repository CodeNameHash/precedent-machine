'use strict';
const assert = require('assert');
const { shapeFinancingGuarantyProposals } = require('../lib/canonical-v2/native-producer/anthropic-provider');
const quote = 'the Debt Financing may be replaced with alternative financing on terms not materially less favourable.';
const output = shapeFinancingGuarantyProposals({ financing_mechanics: [{ surface: 'ALTERNATIVE_FINANCING', quote, detail: 'replacement financing covenant' }], open_world_candidates: [] }, quote);
assert.strictEqual(output.proposals.length, 1);
assert.strictEqual(output.proposals[0].claim_definition_key, 'OPEN_WORLD_PROPOSITION');
assert.strictEqual(output.proposals[0].canonical_value, null);
console.log('canonical-v2 financing and guaranty follow-on tests passed');
