'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { compileFixtureContractV26, compileFixtureContractV29 } = require('../lib/canonical-v2/contract-bundle');
const { parseDayCount, parseAdjournmentCount } = require('../lib/canonical-v2/native-producer/proxy-meeting-count-parse');
const { buildProxyMeetingProducerPrompt, PROMPT_VERSION } = require('../lib/canonical-v2/native-producer/proxy-meeting-producer-prompt');
const { shapeProxyMeetingProposals, PROXY_MEETING_COVENANT_CLAIM_KEY } = require('../lib/canonical-v2/native-producer/anthropic-provider');
const { classifySectionFamily } = require('../lib/canonical-v2/native-producer/section-family-classifier');
const {
  proxyMeetingKindsAreCompatible,
} = require('../lib/canonical-v2/native-producer/candidate-resolution');

test('proxy-meeting v26 contract registers both concepts and six claims', () => {
  const bundle = compileFixtureContractV26();
  assert.ok(bundle.concepts.some((row) => row.concept_key === 'COV-PROXY'));
  assert.ok(bundle.concepts.some((row) => row.concept_key === 'COV-MEETING'));
  assert.ok(bundle.claim_definitions.some((row) => row.claim_definition_key === 'MEETING_CONVENE_OBLIGATION'));
});

test('proxy-meeting v29 contract registers the three adopted follow-ons', () => {
  const bundle = compileFixtureContractV29();
  for (const conceptKey of ['COV-PROXY-PARENT-APPROVAL', 'COV-PROXY-MERGERSUB-APPROVAL']) {
    assert.ok(bundle.concepts.some((row) => row.concept_key === conceptKey), conceptKey);
  }
  for (const claimKey of [
    'RECORD_DATE_ESTABLISHMENT_PRESENT',
    'BROKER_SEARCH_OBLIGATION_PRESENT',
    'PARENT_APPROVAL_OBLIGATION',
    'MERGER_SUB_APPROVAL_OBLIGATION',
    'MEETING_ADJOURNMENT_REASON',
  ]) assert.ok(bundle.claim_definitions.some((row) => row.claim_definition_key === claimKey), claimKey);
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

test('proxy-meeting prompt routes qualitative timing to open world', () => {
  const prompt = buildProxyMeetingProducerPrompt({ source_text: 'The Company shall act as promptly as reasonably practicable.', governed_scope: { section_reference: '6.3' } });
  assert.equal(PROMPT_VERSION, 2);
  assert.equal(prompt.prompt_version, 2);
  assert.match(prompt.messages[0].content, /qualitative timing.*open_world_candidates/i);
});

test('proxy and meeting titles classify as one family after punctuation-only normalisation', async () => {
  assert.equal((await classifySectionFamily({ title: 'Proxy Statement.' })).section_family, 'PROXY_MEETING');
  assert.equal((await classifySectionFamily({ title: 'Stockholder Vote Failure' })).section_family, null);
});

test('only the adopted meeting-convene and meeting-deadline pair may share one quote', () => {
  assert.equal(proxyMeetingKindsAreCompatible(['MEETING_DEADLINE', 'CONVENE_OBLIGATION']), true);
  assert.equal(proxyMeetingKindsAreCompatible(['CONVENE_OBLIGATION', 'MEETING_DEADLINE']), true);
  assert.equal(proxyMeetingKindsAreCompatible(['RECORD_DATE_ESTABLISHMENT', 'BROKER_SEARCH_OBLIGATION']), false);
  assert.equal(proxyMeetingKindsAreCompatible(['ADJOURNMENT_COUNT_CAP', 'ADJOURNMENT_DURATION_CAP']), false);
  assert.equal(proxyMeetingKindsAreCompatible(['MEETING_DEADLINE', 'CONVENE_OBLIGATION', 'BROKER_SEARCH_OBLIGATION']), false);
  assert.equal(proxyMeetingKindsAreCompatible(['MEETING_DEADLINE']), false);
});
