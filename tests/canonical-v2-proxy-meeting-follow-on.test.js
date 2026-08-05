'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  PROXY_MEETING_ASSERTION_KINDS,
  shapeProxyMeetingProposals,
} = require('../lib/canonical-v2/native-producer/anthropic-provider');
const {
  INSTRUCTIONS,
  RESPONSE_SHAPE,
  buildProxyMeetingProducerPrompt,
} = require('../lib/canonical-v2/native-producer/proxy-meeting-producer-prompt');
const {
  COMPOSITE_SEC_ROW_IDS,
  ROW_COVERAGE,
  coverageForRowId,
} = require('../lib/canonical-v2/proxy-meeting-product-coverage');

const ROOT = path.resolve(__dirname, '..');
const COVERAGE = JSON.parse(fs.readFileSync(path.join(
  ROOT,
  'docs/codex-program/m3-proxy-meeting-follow-on-coverage.json',
), 'utf8'));

test('the follow-on producer carries the grounded meeting fact kinds without crossing family boundaries', () => {
  for (const kind of [
    'MAILING_DEADLINE',
    'RECORD_DATE_ESTABLISHMENT',
    'BROKER_SEARCH_OBLIGATION',
    'ADJOURNMENT_REASON',
    'ADJOURNMENT_CONTROL',
    'ADJOURNMENT_CONSENT_OVERRIDE',
    'PARENT_APPROVAL',
    'MERGER_SUB_APPROVAL',
  ]) {
    assert.ok(PROXY_MEETING_ASSERTION_KINDS.includes(kind), kind);
    assert.match(RESPONSE_SHAPE, new RegExp(kind));
  }
  assert.match(INSTRUCTIONS, /recommendation-change/);
  assert.match(INSTRUCTIONS, /vote-failure termination/);
  assert.match(INSTRUCTIONS, /tender-offer minimum condition belongs to closing conditions/);
  assert.match(INSTRUCTIONS, /Schedule TO.*merger-structure family/);
  assert.match(RESPONSE_SHAPE, /SOLE_HOLDER_WRITTEN_CONSENT/);
  assert.match(RESPONSE_SHAPE, /ALL_RECORD_HOLDERS_WRITTEN_CONSENT/);
});

test('record date, broker search and separate approval facts remain byte-bound generic candidates', () => {
  const sourceText = [
    'The Company shall establish a record date and complete a broker search.',
    'Parent shall cause the sole stockholder of Merger Sub to adopt this Agreement by written consent immediately following execution.',
  ].join(' ');
  const shaped = shapeProxyMeetingProposals({
    proxy_meeting_assertions: [
      {
        section_reference: '6.4',
        assertion_kind: 'RECORD_DATE_ESTABLISHMENT',
        obligated_party: 'The Company',
        quote: 'The Company shall establish a record date and complete a broker search.',
      },
      {
        section_reference: '6.4',
        assertion_kind: 'BROKER_SEARCH_OBLIGATION',
        obligated_party: 'The Company',
        quote: 'The Company shall establish a record date and complete a broker search.',
      },
      {
        section_reference: '6.18',
        assertion_kind: 'MERGER_SUB_APPROVAL',
        obligated_party: 'Parent',
        adoption_mechanism: 'WRITTEN_CONSENT',
        adoption_timing: 'immediately following execution',
        quote: 'Parent shall cause the sole stockholder of Merger Sub to adopt this Agreement by written consent immediately following execution.',
      },
    ],
    open_world_candidates: [],
  }, sourceText);

  assert.equal(shaped.proposals.length, 3);
  assert.deepEqual(
    shaped.proposals.map((proposal) => proposal.attributes.assertion_kind),
    ['RECORD_DATE_ESTABLISHMENT', 'BROKER_SEARCH_OBLIGATION', 'MERGER_SUB_APPROVAL'],
  );
  assert.equal(shaped.proposals[2].attributes.adoption_mechanism, 'WRITTEN_CONSENT');
  assert.equal(shaped.evidence_residuals.length, 0);
});

test('the product coverage register inventories render, query, compare and market sources and the three Ben decisions', () => {
  assert.equal(COVERAGE.schema, 'CANONICAL_V2_PROXY_MEETING_FOLLOW_ON_COVERAGE/V1');
  assert.equal(COVERAGE.ben_decisions.length, 3);
  assert.ok(COVERAGE.product_rows.some((row) => row.row_id === 'votes-approvals-meeting-broker-search'));
  assert.ok(COVERAGE.product_rows.some((row) => row.row_id === 'sec-meeting-tenderOfferMinimumCondition'
    && row.owner_id === 'CLOSING_CONDITIONS'
    && row.render === 'EXCLUDED_FROM_COMPOSITE'));
  assert.deepEqual(
    [...new Set(COVERAGE.source_inventory.map((source) => source.source_kind))].sort(),
    ['COMPARE_FIELD', 'DERIVED_VALUE', 'MARKET_FIELD', 'QUERY_FIELD', 'RENDERED_ROW'],
  );
  for (const source of COVERAGE.source_inventory) {
    const sourcePath = path.join(ROOT, source.source_path);
    assert.ok(fs.existsSync(sourcePath), source.source_path);
    assert.ok(fs.readFileSync(sourcePath, 'utf8').includes(source.source_locator), source.source_locator);
  }
});

test('every composite offer row stays visible but owned by merger structure', () => {
  assert.equal(COMPOSITE_SEC_ROW_IDS.length, 5);
  assert.ok(!COMPOSITE_SEC_ROW_IDS.includes('sec-meeting-tenderOfferMinimumCondition'));
  for (const secRowId of COMPOSITE_SEC_ROW_IDS) {
    const rowId = `votes-approvals-meeting-${secRowId.slice('sec-meeting-'.length)}`;
    assert.equal(coverageForRowId(rowId).owner_id, 'MERGER_STRUCTURE_CLOSING');
  }
  assert.equal(ROW_COVERAGE['sec-meeting-tenderOfferMinimumCondition'].owner_id, 'CLOSING_CONDITIONS');
});
