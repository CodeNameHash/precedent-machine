'use strict';
const assert = require('assert');
const { shapeIocProposals } = require('../lib/canonical-v2/native-producer/anthropic-provider');
const { getProducerPromptModule } = require('../lib/canonical-v2/native-producer/producer-prompt-registry');
const { classifySectionFamily } = require('../lib/canonical-v2/native-producer/section-family-classifier');

const quote = 'except as required by applicable Law, conduct its business in the ordinary course.';
const output = shapeIocProposals({
  ioc_mechanics: [{ surface: 'EXCEPTION', quote, detail: 'required-law exception to ordinary-course covenant' }],
  open_world_candidates: [],
}, quote);
assert.strictEqual(output.proposals.length, 1);
assert.strictEqual(output.proposals[0].claim_definition_key, 'OPEN_WORLD_PROPOSITION');
assert.strictEqual(output.proposals[0].canonical_value, null);
assert.match(output.proposals[0].attributes.why_unmapped, /^EXCEPTION:/);
assert.strictEqual(Object.hasOwn(output.proposals[0].attributes, 'covenant_side'), false);
assert.strictEqual(typeof getProducerPromptModule('INTERIM_OPERATING'), 'function');

(async () => {
  const classified = await classifySectionFamily({ title: 'Conduct of Business' });
  assert.strictEqual(classified.section_family, 'INTERIM_OPERATING');
  console.log('canonical-v2 IOC remaining tests passed');
})();
