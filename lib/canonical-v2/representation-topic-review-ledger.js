'use strict';

const { canonicalJson, contentId, sha256Hex } = require('./canonical-bytes');
const { TOPIC_RULES } = require('./representation-topic-registry');

const REVIEW_PACKET_SCHEMA = 'CANONICAL_V2_REPRESENTATION_TOPIC_REVIEW_PACKET/V1';
const DECISION_LEDGER_SCHEMA = 'CANONICAL_V2_REPRESENTATION_TOPIC_DECISION_LEDGER/V1';
const SHA256_RE = /^[a-f0-9]{64}$/;
const TOPIC_CODES = new Set(TOPIC_RULES.map((rule) => rule.id.replace('REP_TOPIC_V1_', '')));
const REVIEW_VERDICTS = Object.freeze([
  'ACCEPT_PROPOSED_TOPIC',
  'REJECT_PROPOSED_TOPIC',
  'ASSIGN_TOPIC',
  'CONFIRM_UNCLASSIFIED',
]);

class RepresentationTopicReviewLedgerError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'RepresentationTopicReviewLedgerError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new RepresentationTopicReviewLedgerError(code, message);
}

function exactKeys(value, keys, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || canonicalJson(Object.keys(value).sort()) !== canonicalJson([...keys].sort())) {
    fail(code, 'fields do not match the versioned contract.');
  }
}

function digest(value, code) {
  if (typeof value !== 'string' || !SHA256_RE.test(value)) fail(code, 'a lowercase SHA-256 digest is required.');
  return value;
}

function string(value, code) {
  if (typeof value !== 'string' || value.length === 0) fail(code, 'a non-empty string is required.');
  return value;
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function cardBody(row) {
  if (!row || row.family !== 'REPRESENTATIONS' || !row.identity?.closure_id || !row.evidence?.utf8_text) {
    fail('INVALID_REVIEW_INPUT', 'each review row must be a representation limb with exact evidence.');
  }
  const classification = row.classifier_result || {};
  const state = classification.state;
  if (!['CLASSIFIED', 'UNCLASSIFIED'].includes(state)) {
    fail('INVALID_REVIEW_INPUT', 'each review row must preserve a classifier state.');
  }
  const body = {
    run: string(row.run, 'INVALID_REVIEW_INPUT'),
    deal: string(row.deal, 'INVALID_REVIEW_INPUT'),
    family: row.family,
    section_reference: string(row.section_reference, 'INVALID_REVIEW_INPUT'),
    subject: row.subject === null ? null : string(row.subject, 'INVALID_REVIEW_INPUT'),
    raw_value: row.evidence.utf8_text,
    proposed_topic: state === 'CLASSIFIED' ? string(classification.canonical_value, 'INVALID_REVIEW_INPUT') : null,
    unclassified_reason: state === 'UNCLASSIFIED' ? string(classification.reason, 'INVALID_REVIEW_INPUT') : null,
    state,
    evidence: {
      evidence_role: row.evidence.evidence_role === null ? null : string(row.evidence.evidence_role, 'INVALID_REVIEW_INPUT'),
      excerpt_id: row.evidence.excerpt_id === null ? null : digest(row.evidence.excerpt_id, 'INVALID_REVIEW_INPUT'),
      absolute_start: row.evidence.absolute_start,
      absolute_end: row.evidence.absolute_end,
      utf8_digest: digest(row.evidence.utf8_digest, 'INVALID_REVIEW_INPUT'),
    },
    identity: {
      claim_occurrence_id: row.identity.claim_occurrence_id === null ? null : digest(row.identity.claim_occurrence_id, 'INVALID_REVIEW_INPUT'),
      closure_id: digest(row.identity.closure_id, 'INVALID_REVIEW_INPUT'),
    },
    registry_digest: digest(row.registry_digest, 'INVALID_REVIEW_INPUT'),
    topic_match_rule_id: classification.topic_match_rule_id === null ? null : string(classification.topic_match_rule_id, 'INVALID_REVIEW_INPUT'),
  };
  if (!Number.isSafeInteger(body.evidence.absolute_start) || !Number.isSafeInteger(body.evidence.absolute_end)
    || body.evidence.absolute_start < 0 || body.evidence.absolute_end <= body.evidence.absolute_start) {
    fail('INVALID_REVIEW_INPUT', 'each review evidence span must be an ordered byte range.');
  }
  return body;
}

function buildRepresentationTopicReviewPacket({ representation_rows: rows } = {}) {
  if (!Array.isArray(rows) || rows.length === 0) fail('INVALID_REVIEW_INPUT', 'representation rows are required.');
  const cardBodies = rows.map(cardBody).sort((left, right) => (
    left.run.localeCompare(right.run)
    || left.section_reference.localeCompare(right.section_reference)
    || left.identity.closure_id.localeCompare(right.identity.closure_id)
  ));
  if (new Set(cardBodies.map((row) => row.identity.closure_id)).size !== cardBodies.length) {
    fail('INVALID_REVIEW_INPUT', 'review input contains duplicate closure ids.');
  }
  const reviewInputDigest = sha256Hex(canonicalJson(cardBodies));
  const cards = cardBodies.map((body, index) => freeze({
    card_number: index + 1,
    decision_key: contentId('CANONICAL_V2_REPRESENTATION_TOPIC_REVIEW_DECISION/V1', {
      review_input_digest: reviewInputDigest,
      closure_id: body.identity.closure_id,
    }),
    ...body,
  }));
  const body = {
    schema_version: REVIEW_PACKET_SCHEMA,
    review_input_digest: reviewInputDigest,
    cards,
  };
  return freeze({ ...body, review_packet_id: contentId(REVIEW_PACKET_SCHEMA, body) });
}

function buildEmptyRepresentationTopicDecisionLedger({ review_packet: reviewPacket } = {}) {
  validateRepresentationTopicReviewPacket(reviewPacket);
  const body = {
    schema_version: DECISION_LEDGER_SCHEMA,
    review_packet_id: reviewPacket.review_packet_id,
    review_input_digest: reviewPacket.review_input_digest,
    decision_keys_digest: sha256Hex(canonicalJson(reviewPacket.cards.map((card) => card.decision_key))),
    decisions: [],
  };
  return freeze({ ...body, decision_ledger_id: contentId(DECISION_LEDGER_SCHEMA, body) });
}

function validateRepresentationTopicReviewPacket(packet) {
  exactKeys(packet, ['cards', 'review_input_digest', 'review_packet_id', 'schema_version'], 'INVALID_REVIEW_PACKET');
  if (packet.schema_version !== REVIEW_PACKET_SCHEMA || !Array.isArray(packet.cards) || packet.cards.length === 0) {
    fail('INVALID_REVIEW_PACKET', 'review packet schema or cards are invalid.');
  }
  digest(packet.review_input_digest, 'INVALID_REVIEW_PACKET');
  digest(packet.review_packet_id, 'INVALID_REVIEW_PACKET');
  const cards = packet.cards.map((card) => {
    exactKeys(card, [
      'card_number', 'deal', 'decision_key', 'evidence', 'family', 'identity', 'proposed_topic',
      'raw_value', 'registry_digest', 'run', 'section_reference', 'state', 'subject', 'topic_match_rule_id',
      'unclassified_reason',
    ], 'INVALID_REVIEW_PACKET');
    if (!Number.isSafeInteger(card.card_number) || card.card_number < 1) fail('INVALID_REVIEW_PACKET', 'card numbers must be positive integers.');
    return { ...card };
  });
  if (canonicalJson(cards.map(({ card_number: _number, decision_key: _key, ...body }) => body))
    !== canonicalJson(cards.map(({ card_number: _number, decision_key: _key, ...body }) => body).sort((left, right) => (
      left.run.localeCompare(right.run) || left.section_reference.localeCompare(right.section_reference) || left.identity.closure_id.localeCompare(right.identity.closure_id)
    )))) fail('INVALID_REVIEW_PACKET', 'review cards are not in deterministic order.');
  const recomputedInput = sha256Hex(canonicalJson(cards.map(({ card_number: _number, decision_key: _key, ...body }) => body)));
  if (recomputedInput !== packet.review_input_digest) fail('INVALID_REVIEW_PACKET', 'review packet input digest is stale.');
  const expectedCards = cards.map((card, index) => {
    if (card.card_number !== index + 1) fail('INVALID_REVIEW_PACKET', 'review cards are not consecutively numbered.');
    const expected = contentId('CANONICAL_V2_REPRESENTATION_TOPIC_REVIEW_DECISION/V1', {
      review_input_digest: packet.review_input_digest,
      closure_id: card.identity.closure_id,
    });
    if (card.decision_key !== expected) fail('INVALID_REVIEW_PACKET', 'review card decision key does not bind its source row.');
    return card;
  });
  const body = { schema_version: packet.schema_version, review_input_digest: packet.review_input_digest, cards: expectedCards };
  if (contentId(REVIEW_PACKET_SCHEMA, body) !== packet.review_packet_id) fail('INVALID_REVIEW_PACKET', 'review packet id is invalid.');
  return true;
}

function validateRepresentationTopicDecisionLedger({ ledger, review_packet: reviewPacket } = {}) {
  validateRepresentationTopicReviewPacket(reviewPacket);
  exactKeys(ledger, ['decision_keys_digest', 'decision_ledger_id', 'decisions', 'review_input_digest', 'review_packet_id', 'schema_version'], 'INVALID_DECISION_LEDGER');
  if (ledger.schema_version !== DECISION_LEDGER_SCHEMA || !Array.isArray(ledger.decisions)) fail('INVALID_DECISION_LEDGER', 'decision ledger schema is invalid.');
  if (ledger.review_packet_id !== reviewPacket.review_packet_id || ledger.review_input_digest !== reviewPacket.review_input_digest) {
    fail('STALE_DECISION_LEDGER', 'decision ledger does not bind this exact review packet.');
  }
  const expectedKeys = reviewPacket.cards.map((card) => card.decision_key);
  if (ledger.decision_keys_digest !== sha256Hex(canonicalJson(expectedKeys))) fail('STALE_DECISION_LEDGER', 'decision ledger decision-key digest is stale.');
  const seen = new Set();
  const cardsByDecisionKey = new Map(reviewPacket.cards.map((card) => [card.decision_key, card]));
  for (const decision of ledger.decisions) {
    exactKeys(decision, ['decided_topic', 'decision_key', 'reviewer_id', 'reviewed_at', 'verdict'], 'INVALID_DECISION_LEDGER');
    if (!expectedKeys.includes(decision.decision_key) || seen.has(decision.decision_key)) fail('UNKNOWN_DECISION_KEY', 'decision key is unknown or duplicated.');
    seen.add(decision.decision_key);
    if (!REVIEW_VERDICTS.includes(decision.verdict)) fail('INVALID_DECISION_LEDGER', 'decision verdict is invalid.');
    string(decision.reviewer_id, 'INVALID_DECISION_LEDGER');
    string(decision.reviewed_at, 'INVALID_DECISION_LEDGER');
    const card = cardsByDecisionKey.get(decision.decision_key);
    const topic = decision.decided_topic;
    if (decision.verdict === 'ACCEPT_PROPOSED_TOPIC') {
      if (card.state !== 'CLASSIFIED' || topic !== card.proposed_topic) {
        fail('INVALID_DECISION_COMBINATION', 'acceptance must preserve a classified card\'s proposed topic.');
      }
    } else if (decision.verdict === 'REJECT_PROPOSED_TOPIC') {
      if (card.state !== 'CLASSIFIED' || topic !== null) {
        fail('INVALID_DECISION_COMBINATION', 'rejection must turn a classified proposal into no assigned topic.');
      }
    } else if (decision.verdict === 'ASSIGN_TOPIC') {
      if (typeof topic !== 'string' || !TOPIC_CODES.has(topic)
        || (card.state === 'CLASSIFIED' && topic === card.proposed_topic)) {
        fail('INVALID_DECISION_COMBINATION', 'assignment must name a different approved topic when a proposal exists.');
      }
    } else if (decision.verdict === 'CONFIRM_UNCLASSIFIED') {
      if (card.state !== 'UNCLASSIFIED' || topic !== null) {
        fail('INVALID_DECISION_COMBINATION', 'confirmation must preserve an unclassified card with no topic.');
      }
    }
  }
  if (ledger.decisions.length > 0 && seen.size !== expectedKeys.length) {
    fail('PARTIAL_DECISION_LEDGER', 'a non-empty decision ledger must cover every review card.');
  }
  const body = {
    schema_version: ledger.schema_version,
    review_packet_id: ledger.review_packet_id,
    review_input_digest: ledger.review_input_digest,
    decision_keys_digest: ledger.decision_keys_digest,
    decisions: ledger.decisions,
  };
  if (contentId(DECISION_LEDGER_SCHEMA, body) !== ledger.decision_ledger_id) fail('INVALID_DECISION_LEDGER', 'decision ledger id is invalid.');
  return true;
}

function ordinaryRepresentationTopicReviewGate({ ledger, review_packet: reviewPacket } = {}) {
  validateRepresentationTopicDecisionLedger({ ledger, review_packet: reviewPacket });
  return freeze({
    closed: true,
    reason: ledger.decisions.length === 0 ? 'ORDINARY_REVIEW_PENDING' : 'TOPIC_ACTIVATION_NOT_IMPLEMENTED',
    reviewed_cards: ledger.decisions.length,
    total_cards: reviewPacket.cards.length,
  });
}

module.exports = {
  REVIEW_PACKET_SCHEMA,
  DECISION_LEDGER_SCHEMA,
  REVIEW_VERDICTS,
  TOPIC_CODES,
  RepresentationTopicReviewLedgerError,
  buildRepresentationTopicReviewPacket,
  validateRepresentationTopicReviewPacket,
  buildEmptyRepresentationTopicDecisionLedger,
  validateRepresentationTopicDecisionLedger,
  ordinaryRepresentationTopicReviewGate,
};
