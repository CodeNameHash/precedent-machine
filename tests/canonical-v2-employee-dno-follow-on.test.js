'use strict';
const assert = require('assert'); const { shapeEmployeeDnoProposals } = require('../lib/canonical-v2/native-producer/anthropic-provider');
const quote = 'expenses shall be advanced within ten (10) days after receipt of an undertaking.';
const output = shapeEmployeeDnoProposals({ employee_dno_mechanics: [{ surface: 'ADVANCEMENT_TIMING', quote, detail: 'advancement day count' }], open_world_candidates: [] }, quote);
assert.strictEqual(output.proposals.length, 1); assert.strictEqual(output.proposals[0].claim_definition_key, 'OPEN_WORLD_PROPOSITION'); assert.strictEqual(output.proposals[0].canonical_value, null); console.log('canonical-v2 employee and D&O follow-on tests passed');
