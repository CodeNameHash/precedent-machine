'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  IOC_PROMPT_VERSION,
  RESTRICTION_CATEGORIES,
  buildIocProducerPrompt,
} = require('../lib/canonical-v2/native-producer/ioc-producer-prompt');
const { classifySectionFamily } = require('../lib/canonical-v2/native-producer/section-family-classifier');
const { shapeIocProposals } = require('../lib/canonical-v2/native-producer/anthropic-provider');

test('IOC producer prompt owns the governed categories and split discipline', () => {
  const source = 'The Company shall not incur indebtedness in excess of $10,000,000 in the aggregate.';
  const prompt = buildIocProducerPrompt({
    source_text: source,
    governed_scope: { section_reference: '5.1' },
  });
  assert.equal(prompt.prompt_version, IOC_PROMPT_VERSION);
  assert.equal(IOC_PROMPT_VERSION, 4);
  assert.deepEqual(RESTRICTION_CATEGORIES, [
    'MERGE', 'CONTRACT', 'COMP', 'DEBT', 'TAX', 'CHARTER', 'ISSUE',
    'ACCOUNTING', 'SETTLE', 'DIVIDEND', 'CAPEX',
  ]);
  assert.match(prompt.messages[0].content, /GOVERNED RESTRICTIONS/);
  assert.match(prompt.messages[0].content, /POSITIVES ONLY/);
  assert.match(prompt.messages[0].content, /parent-section chapeau supplies the governed party/);
  assert.match(prompt.messages[0].content, /QUOTE THE RESTRICTION LIMB/);
  assert.match(prompt.messages[0].content, /narrowest restriction limb/);
  assert.match(prompt.messages[0].content, /MECHANIC COMPLETENESS/);
  assert.match(prompt.messages[0].content, /MUST contain both a surface and one non-empty, exact, contiguous quote/);
  assert.match(prompt.messages[0].content, /Each non-null field must occur inside that mechanism quote/);
  assert.match(prompt.messages[0].content, /\$25 million means 25000000 USD/);
  assert.ok(prompt.messages[0].content.endsWith(source));
});

test('IOC classifier preserves buyer-before-target order and provider shaping stamps its side', async () => {
  const buyer = await classifySectionFamily({ title: 'Interim Operations of Parent' });
  const target = await classifySectionFamily({ title: 'Conduct of Business' });
  assert.equal(buyer.section_family, 'INTERIM_OPERATING');
  assert.equal(buyer.covenant_side, 'BUYER');
  assert.equal(target.covenant_side, 'TARGET');
  const source = 'The Company shall not incur indebtedness in excess of $10,000,000 in the aggregate.';
  const shaped = shapeIocProposals({ ioc_restriction_assertions: [{ section_reference: '5.1', assertion_kind: 'RESTRICTION_PRESENT', restriction_category: 'DEBT', threshold_basis: null, quote: source }], ioc_mechanics: [], open_world_candidates: [] }, source, { covenant_side: 'TARGET' });
  assert.equal(shaped.proposals[0].attributes.covenant_side, 'TARGET');
  const numeric = shapeIocProposals({ ioc_restriction_assertions: [{ section_reference: '5.1', assertion_kind: 'THRESHOLD_AMOUNT', restriction_category: 'DEBT', threshold_basis: 'AGGREGATE', quote: source }], ioc_mechanics: [], open_world_candidates: [] }, source, { covenant_side: 'TARGET' });
  assert.equal(numeric.proposals[0].claim_definition_key, 'OPEN_WORLD_PROPOSITION');
  assert.equal(numeric.proposals[0].attributes.why_unmapped, 'IOC_ASSERTION_KIND_UNADJUDICATED');
  assert.equal(shapeIocProposals({ open_world_candidates: [] }, source).proposals.length, 0);
});

test('IOC prompt rejects malformed scope inputs', () => {
  assert.throws(() => buildIocProducerPrompt({ source_text: '', governed_scope: {} }), TypeError);
  assert.throws(() => buildIocProducerPrompt({ source_text: 'x' }), TypeError);
  assert.throws(() => buildIocProducerPrompt({ source_text: 'x', governed_scope: {}, known_definitions: null }), TypeError);
});
