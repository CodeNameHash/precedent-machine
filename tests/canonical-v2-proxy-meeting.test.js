'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { compileFixtureContractV26 } = require('../lib/canonical-v2/contract-bundle');
const { parseDayCount, parseAdjournmentCount } = require('../lib/canonical-v2/native-producer/proxy-meeting-count-parse');
const { buildProxyMeetingProducerPrompt } = require('../lib/canonical-v2/native-producer/proxy-meeting-producer-prompt');
const { shapeProxyMeetingProposals, PROXY_MEETING_COVENANT_CLAIM_KEY } = require('../lib/canonical-v2/native-producer/anthropic-provider');
const { classifySectionFamily } = require('../lib/canonical-v2/native-producer/section-family-classifier');

test('proxy-meeting v26 contract registers both concepts and six claims', () => {
  const bundle = compileFixtureContractV26();
  assert.ok(bundle.concepts.some((row) => row.concept_key === 'COV-PROXY'));
  assert.ok(bundle.concepts.some((row) => row.concept_key === 'COV-MEETING'));
  assert.ok(bundle.claim_definitions.some((row) => row.claim_definition_key === 'MEETING_CONVENE_OBLIGATION'));
});

test('proxy-meeting parser resolves supported day and occurrence counts and refuses ambiguity', () => {
  assert.deepEqual(parseDayCount('within thirty (30) calendar days'), { outcome: 'RESOLVED', canonical_value: '30', matched_text: 'thirty (30) calendar days' });
  assert.equal(parseDayCount('the fortieth (40th) day').reason, 'ORDINAL_DAY_FORM');
  assert.equal(parseDayCount('thirty (30) calendar days and ten (10) Business Days').reason, 'MULTIPLE_DAY_COUNTS');
  assert.deepEqual(parseAdjournmentCount('no more than two (2) such postponement or adjournments'), { outcome: 'RESOLVED', canonical_value: '2', matched_text: 'two (2) such postponement' });
});

test('proxy-meeting provider shape retains only byte-exact proposed facts', () => {
  const quote = 'the Company shall schedule a special meeting to be held within forty-five (45) days of the initial mailing of the Proxy Statement';
  const prompt = buildProxyMeetingProducerPrompt({ source_text: quote, governed_scope: { section_reference: '6.3' } });
  assert.equal(prompt.prompt_id, 'native-producer-proxy-meeting/v1');
  const shaped = shapeProxyMeetingProposals({ proxy_meeting_assertions: [{ section_reference: '6.3', assertion_kind: 'MEETING_DEADLINE', anchor_kind: 'MAILING', day_kind: 'CALENDAR', meeting_ref: 'special meeting', quote }], open_world_candidates: [] }, quote);
  assert.equal(shaped.proposals[0].claim_definition_key, PROXY_MEETING_COVENANT_CLAIM_KEY);
});

test('proxy and meeting titles classify as one family after punctuation-only normalisation', async () => {
  assert.equal((await classifySectionFamily({ title: 'Proxy Statement.' })).section_family, 'PROXY_MEETING');
  assert.equal((await classifySectionFamily({ title: 'Stockholder Vote Failure' })).section_family, null);
});
