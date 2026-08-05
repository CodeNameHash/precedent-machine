'use strict';
const assert = require('assert'); const { shapeRemediesMiscProposals } = require('../lib/canonical-v2/native-producer/anthropic-provider');
const quote = 'each party irrevocably submits to the exclusive jurisdiction of the Court of Chancery.';
const output = shapeRemediesMiscProposals({ mechanics: [{ surface: 'FORUM_FALLBACK', quote, detail: 'exclusive Chancery forum' }], open_world_candidates: [] }, quote);
assert.strictEqual(output.proposals.length, 1); assert.strictEqual(output.proposals[0].claim_definition_key, 'OPEN_WORLD_PROPOSITION'); assert.strictEqual(output.proposals[0].canonical_value, null); console.log('canonical-v2 remedies misc follow-on tests passed');
