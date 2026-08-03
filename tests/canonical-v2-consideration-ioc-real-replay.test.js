'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { shapeConsiderationProposals, shapeIocProposals } = require('../lib/canonical-v2/native-producer/anthropic-provider');

const pack = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'canonical-v2', 'm3-consideration-ioc-real-replay.json'), 'utf8'));

test('recorded multi-deal Consideration pack preserves exact evidence and routes CVR and election mechanics open-world', () => {
  assert.equal(pack.consideration.length, 4);
  for (const item of pack.consideration) assert.ok(item.card_id && item.quote.length > 30);
  const cvr = pack.consideration[2];
  const election = pack.consideration[3];
  const output = shapeConsiderationProposals({ consideration_assertions: [], consideration_mechanics: [
    { surface: 'CVR', quote: cvr.quote, detail: 'contractual contingent value right' },
    { surface: 'PRORATION_FORMULA', quote: election.quote, detail: 'named numerator and denominator operands' },
  ], open_world_candidates: [] }, `${cvr.quote}\n${election.quote}`);
  assert.equal(output.proposals.length, 2);
  assert.ok(output.proposals.every((item) => item.proposal_kind === 'OPEN_WORLD'));
  assert.ok(output.proposals.every((item) => item.canonical_value === null));
});

test('recorded IOC pack preserves governed restrictions and exhaustive long-tail open-world capture', () => {
  assert.equal(pack.ioc.length, 2);
  const source = pack.ioc.map((item) => item.quote).join('\n');
  const output = shapeIocProposals({ ioc_restriction_assertions: [{ section_reference: '5.1', assertion_kind: 'RESTRICTION_PRESENT', restriction_category: 'DEBT', threshold_basis: null, quote: pack.ioc[0].quote }], ioc_mechanics: [
    { surface: 'LONG_TAIL_RESTRICTION', quote: pack.ioc[1].quote, detail: 'dividend restriction preserved without inferred qualifier' },
  ], open_world_candidates: [] }, source, { covenant_side: 'TARGET' });
  assert.equal(output.proposals.length, 2);
  assert.equal(output.proposals[0].proposal_kind, 'IOC_RESTRICTION');
  assert.equal(output.proposals[1].proposal_kind, 'OPEN_WORLD');
});
