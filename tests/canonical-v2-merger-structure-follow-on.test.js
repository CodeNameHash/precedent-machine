'use strict';
const assert = require('assert');
const { shapeMergerStructureProposals } = require('../lib/canonical-v2/native-producer/anthropic-provider');
const quote = 'the Merger will be governed by and effected under Section 251(h) of the DGCL.';
const output = shapeMergerStructureProposals({ structure_mechanics: [{ surface: 'SHORT_FORM_251H', quote, detail: 'DGCL short-form mechanism' }], open_world_candidates: [] }, quote);
assert.strictEqual(output.proposals.length, 0);
console.log('canonical-v2 merger structure follow-on tests passed');
