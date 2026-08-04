'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  STRICT_INDEPENDENT_REVIEW_SCHEMA,
  FinalPilotIndependentReviewError,
  buildFinalPilotStrictIndependentReviewInput,
} = require('../lib/canonical-v2/native-producer/m3-final-pilot-independent-review');

const PACKET_PATH = '/private/tmp/canonical-v2-m3-pilot-20260803.L3KSNP/final-review/sealed-final-pilot-review-packet.json';

test('prepares a strict twelve-item legal review with no automatic PASS', { skip: !fs.existsSync(PACKET_PATH) }, () => {
  const packet = JSON.parse(fs.readFileSync(PACKET_PATH, 'utf8'));
  const input = buildFinalPilotStrictIndependentReviewInput({ final_review_packet: packet });
  assert.equal(input.schema_version, STRICT_INDEPENDENT_REVIEW_SCHEMA);
  assert.equal(input.review_items.length, 12);
  assert.equal(input.model_call_count, 0);
  assert.equal(input.automatic_legal_passes, 0);
  assert.ok(input.review_items.every((item) => item.automatic_legal_disposition === 'NOT_DETERMINED'
    && item.independent_review_state === 'PENDING_INDEPENDENT_LEGAL_REVIEW'));
  const body = { ...input }; delete body.strict_independent_review_input_id;
  assert.equal(input.strict_independent_review_input_id, contentId(STRICT_INDEPENDENT_REVIEW_SCHEMA, body));
});

test('rejects a final packet that has any automatic legal PASS', { skip: !fs.existsSync(PACKET_PATH) }, () => {
  const packet = JSON.parse(fs.readFileSync(PACKET_PATH, 'utf8'));
  packet.legal_disposition = 'PASS';
  const body = { ...packet }; delete body.final_review_packet_id;
  packet.final_review_packet_id = contentId(packet.schema_version, body);
  assert.throws(
    () => buildFinalPilotStrictIndependentReviewInput({ final_review_packet: packet }),
    (error) => error instanceof FinalPilotIndependentReviewError && error.code === 'INVALID_FINAL_REVIEW_PACKET',
  );
});
