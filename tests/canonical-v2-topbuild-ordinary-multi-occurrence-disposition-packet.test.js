'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  TOPBUILD_SECOND_OCCURRENCE_ID,
  TopBuildOrdinaryMultiOccurrenceDispositionPacketError,
  buildTopBuildOrdinaryMultiOccurrenceDispositionPacket,
  validateTopBuildOrdinaryMultiOccurrenceDispositionPacket,
} = require('../lib/canonical-v2/topbuild-ordinary-multi-occurrence-disposition-packet');
const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const { makeCohort } = require('./helpers/canonical-v2-source-intake-fixture');

function input() {
  return {
    ...makeCohort({ dealCount: 1 }),
    primary_occurrence_id: 'METADATA/deal-1',
    legal_findings: {
      same_executed_agreement: true,
      matched_section_count: 62,
      total_section_count: 63,
      redaction_delta: {
        section_reference: '7.7',
        redacted_item_count: 2,
        redaction_kind: 'EMAIL_ADDRESS_ONLY',
      },
      unredacted_occurrence_id: 'METADATA/deal-1',
      redacted_occurrence_id: TOPBUILD_SECOND_OCCURRENCE_ID,
    },
  };
}

test('builds a content-addressed proposal that preserves both evidence roles without an admission conclusion', () => {
  const packet = buildTopBuildOrdinaryMultiOccurrenceDispositionPacket(input());
  assert.equal(packet.status, 'NOT_ISSUED');
  assert.equal(packet.admission_authority, 'NOT_ADMISSION_AUTHORITY');
  assert.deepEqual(packet.execution_sources, []);
  assert.deepEqual(packet.occurrences.map((item) => item.evidence_role), [
    'PRIMARY_EVIDENCE_UNREDACTED_TOPBUILD',
    'CORROBORATING_EVIDENCE_REDACTED_QXO',
  ]);
  assert.deepEqual(packet.legal_findings, {
    same_executed_agreement: true,
    matched_section_count: 62,
    total_section_count: 63,
    section_7_7_redaction_delta: { redacted_item_count: 2, redaction_kind: 'EMAIL_ADDRESS_ONLY' },
  });
  assert.deepEqual(packet.non_conclusions, {
    exclusion: 'NOT_CONCLUDED',
    exact_duplicate: 'NOT_CONCLUDED',
    separate_version: 'NOT_CONCLUDED',
  });
  assert.equal(validateTopBuildOrdinaryMultiOccurrenceDispositionPacket(packet).packet_id, packet.packet_id);
});

test('fails closed on missing cohort evidence, changed receipt binding, or a weaker legal finding', () => {
  const mutations = [
    (value) => value.receipt_records.pop(),
    (value) => { value.receipt_records[0].receipt.raw_sha256 = '0'.repeat(64); },
    (value) => { value.legal_findings.matched_section_count = 61; },
    (value) => { value.legal_findings.redaction_delta.redacted_item_count = 3; },
    (value) => { value.legal_findings.redaction_delta.section_reference = '7.8'; },
  ];
  for (const mutate of mutations) {
    const value = structuredClone(input());
    mutate(value);
    assert.throws(() => buildTopBuildOrdinaryMultiOccurrenceDispositionPacket(value),
      TopBuildOrdinaryMultiOccurrenceDispositionPacketError);
  }
  const packet = buildTopBuildOrdinaryMultiOccurrenceDispositionPacket(input());
  assert.throws(() => validateTopBuildOrdinaryMultiOccurrenceDispositionPacket({
    ...packet,
    status: 'ISSUED',
  }), TopBuildOrdinaryMultiOccurrenceDispositionPacketError);
  const forged = structuredClone(packet);
  forged.legal_findings.matched_section_count = 61;
  const forgedBody = { ...forged };
  delete forgedBody.packet_id;
  forged.packet_id = contentId(forged.schema_version, forgedBody);
  assert.throws(() => validateTopBuildOrdinaryMultiOccurrenceDispositionPacket(forged),
    TopBuildOrdinaryMultiOccurrenceDispositionPacketError);
});

test('contains no provider, transport, database, or execution path', () => {
  const source = require('node:fs').readFileSync(require.resolve(
    '../lib/canonical-v2/topbuild-ordinary-multi-occurrence-disposition-packet',
  ), 'utf8');
  assert.doesNotMatch(source, /fetch\s*\(|supabase|\.from\(|\.insert\(|\.update\(|\.upsert\(|\.delete\(|provider|node:https|node:http/i);
});
