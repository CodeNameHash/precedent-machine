'use strict';

const { contentId } = require('../canonical-bytes');

const PILOT_ADJUDICATION_SCHEMA = 'M3_PILOT_UNRESOLVED_OUTPUT_ADJUDICATION/V1';
const REVIEW_PACKET_SCHEMA = 'M3_12_CALL_PILOT_REVIEW_PACKET/V1';
const ALLOWED_DISPOSITIONS = new Set([
  'REVIEWED_OPEN_WORLD',
  'DEFINED_TERM_ONLY_NO_NUMERIC_PUBLICATION',
  'DEFERRED_TO_GOVERNED_OWNER',
]);

function fail(message) {
  throw new TypeError(message);
}

function text(value, name) {
  if (typeof value !== 'string' || !value) fail(`${name} must be a non-empty string`);
  return value;
}

function exactPacketId(packet) {
  if (!packet || typeof packet !== 'object') fail('review_packet must be an object');
  const { review_packet_id: reviewPacketId, ...body } = packet;
  if (text(reviewPacketId, 'review_packet.review_packet_id') !== contentId(REVIEW_PACKET_SCHEMA, body)) {
    fail('review_packet_id does not seal the supplied review packet');
  }
  return reviewPacketId;
}

function unresolvedItems(reviewPacket) {
  const output = reviewPacket.resolved_output;
  if (!output || !Array.isArray(output.open_world) || !Array.isArray(output.review_queue)) {
    fail('review_packet.resolved_output must carry open_world and review_queue arrays');
  }
  const items = [
    ...output.open_world.map((entry) => ({ closure_id: entry?.closure_id, output_kind: 'OPEN_WORLD' })),
    ...output.review_queue.map((entry) => ({ closure_id: entry?.closure_id, output_kind: 'REVIEW_QUEUE' })),
  ];
  if (items.some((entry) => typeof entry.closure_id !== 'string' || !entry.closure_id)) {
    fail('each unresolved review-packet item must carry a closure_id');
  }
  const keys = items.map((entry) => `${entry.output_kind}:${entry.closure_id}`);
  if (new Set(keys).size !== keys.length) fail('review packet has duplicate unresolved closure bindings');
  return items.sort((left, right) => (
    `${left.output_kind}:${left.closure_id}`.localeCompare(`${right.output_kind}:${right.closure_id}`)
  ));
}

function buildPilotAdjudication({ review_packet: reviewPacket, dispositions_by_closure_id: dispositions } = {}) {
  const reviewPacketId = exactPacketId(reviewPacket);
  if (!dispositions || typeof dispositions !== 'object' || Array.isArray(dispositions)) {
    fail('dispositions_by_closure_id must be an object');
  }
  const items = unresolvedItems(reviewPacket).map((item) => {
    const disposition = dispositions[item.closure_id];
    if (!ALLOWED_DISPOSITIONS.has(disposition)) fail('every unresolved closure requires an allowed disposition');
    return Object.freeze({ ...item, disposition });
  });
  if (Object.keys(dispositions).length !== items.length) fail('adjudication must not contain unlisted unresolved closures');
  const body = {
    schema_version: PILOT_ADJUDICATION_SCHEMA,
    work_item_id: text(reviewPacket.work_item_id, 'review_packet.work_item_id'),
    review_packet_id: reviewPacketId,
    execution_result_id: text(reviewPacket.provenance?.execution_result_id, 'review_packet.provenance.execution_result_id'),
    reviewer_disposition: 'PASS',
    unresolved_items: Object.freeze(items),
  };
  return Object.freeze({ ...body, adjudication_id: contentId(PILOT_ADJUDICATION_SCHEMA, body) });
}

function validatePilotAdjudication({ adjudication, review_packet: reviewPacket } = {}) {
  try {
    const reviewPacketId = exactPacketId(reviewPacket);
    if (!adjudication || typeof adjudication !== 'object') fail('adjudication must be an object');
    const { adjudication_id: adjudicationId, ...body } = adjudication;
    if (body.schema_version !== PILOT_ADJUDICATION_SCHEMA
      || text(adjudicationId, 'adjudication.adjudication_id') !== contentId(PILOT_ADJUDICATION_SCHEMA, body)) {
      fail('adjudication_id does not seal the supplied adjudication');
    }
    if (body.work_item_id !== reviewPacket.work_item_id
      || body.review_packet_id !== reviewPacketId
      || body.execution_result_id !== reviewPacket.provenance?.execution_result_id
      || body.reviewer_disposition !== 'PASS'
      || !Array.isArray(body.unresolved_items)) {
      fail('adjudication does not bind the supplied review packet');
    }
    const expected = unresolvedItems(reviewPacket);
    const actual = body.unresolved_items.map((item) => ({
      closure_id: item?.closure_id,
      output_kind: item?.output_kind,
      disposition: item?.disposition,
    })).sort((left, right) => (
      `${left.output_kind}:${left.closure_id}`.localeCompare(`${right.output_kind}:${right.closure_id}`)
    ));
    if (actual.length !== expected.length
      || actual.some((item, index) => item.closure_id !== expected[index].closure_id
        || item.output_kind !== expected[index].output_kind
        || !ALLOWED_DISPOSITIONS.has(item.disposition))) {
      fail('adjudication does not cover every exact unresolved closure');
    }
    return Object.freeze({ valid: true, reason: null });
  } catch (error) {
    return Object.freeze({ valid: false, reason: error.message });
  }
}

module.exports = {
  ALLOWED_DISPOSITIONS,
  PILOT_ADJUDICATION_SCHEMA,
  buildPilotAdjudication,
  validatePilotAdjudication,
};
