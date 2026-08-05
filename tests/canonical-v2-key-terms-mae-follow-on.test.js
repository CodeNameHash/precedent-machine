'use strict';
const assert = require('assert'); const { shapeKeyTermsMaeFollowOnProposals } = require('../lib/canonical-v2/native-producer/anthropic-provider');
const quote = 'disproportionately affected thereby as compared with other participants in the industries.';
const output = shapeKeyTermsMaeFollowOnProposals({ mechanics: [{ surface: 'MAE_CLAUSE_DISPROPORTIONALITY', quote, detail: 'comparison baseline text' }], open_world_candidates: [] }, quote);
assert.strictEqual(output.proposals.length, 1); assert.strictEqual(output.proposals[0].claim_definition_key, 'OPEN_WORLD_PROPOSITION'); assert.strictEqual(output.proposals[0].canonical_value, null); console.log('canonical-v2 key terms MAE follow-on tests passed');
