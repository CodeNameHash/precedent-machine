'use strict';

const { canonicalJson, contentId, sha256Hex, utf8Slice } = require('./canonical-bytes');

const MACHINE_PACKET_SCHEMA = 'CANONICAL_V2_HUMAN_ANCHOR_MACHINE_PACKET/V1';
const REVIEW_PACKET_SCHEMA = 'CANONICAL_V2_HUMAN_ANCHOR_REVIEW_PACKET/V1';
const KEY_SCHEMA = 'CANONICAL_V2_HUMAN_ANCHOR_KEY/V1';
const DECISION_LEDGER_SCHEMA = 'CANONICAL_V2_HUMAN_ANCHOR_DECISION_LEDGER/V1';
const DECISION_SCHEMA = 'CANONICAL_V2_HUMAN_ANCHOR_DECISION/V1';
const ERROR_CLASSES = Object.freeze(['PARTY_ATTRIBUTION', 'MATERIALITY_CODE', 'SPAN', 'TOPIC_BUCKET', 'OTHER']);
const VERDICTS = new Set(['CORRECT', 'ERROR']);
const SHA256_RE = /^[a-f0-9]{64}$/;

class HumanAnchorReviewError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'HumanAnchorReviewError';
    this.code = code;
  }
}

function fail(code, message) { throw new HumanAnchorReviewError(code, message); }
function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}
function digest(value, code) {
  if (typeof value !== 'string' || !SHA256_RE.test(value)) fail(code, 'a lowercase SHA-256 digest is required.');
  return value;
}
function string(value, code) {
  if (typeof value !== 'string' || value.length === 0) fail(code, 'a non-empty string is required.');
  return value;
}
function exactKeys(value, keys, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || canonicalJson(Object.keys(value).sort()) !== canonicalJson([...keys].sort())) {
    fail(code, 'fields do not match the versioned contract.');
  }
}
function packetDigest(packet) { return sha256Hex(canonicalJson(packet)); }
function utcMillisecondTimestamp(value, code) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    || Number.isNaN(Date.parse(value)) || new Date(value).toISOString() !== value) {
    fail(code, 'reviewed_at must be a canonical millisecond UTC timestamp.');
  }
  return value;
}
function validateIdentity(identity, code) {
  exactKeys(identity, ['claim_occurrence_id', 'claim_revision_id', 'closure_id'], code);
  digest(identity.claim_revision_id, code); digest(identity.claim_occurrence_id, code); digest(identity.closure_id, code);
}
function validateEvidence(evidence, code) {
  exactKeys(evidence, ['absolute_end', 'absolute_start', 'evidence_role', 'excerpt', 'excerpt_digest', 'excerpt_id'], code);
  digest(evidence.excerpt_id, code); digest(evidence.excerpt_digest, code);
  if (typeof evidence.excerpt !== 'string' || evidence.excerpt.length === 0
    || !Number.isInteger(evidence.absolute_start) || !Number.isInteger(evidence.absolute_end)
    || evidence.absolute_start < 0 || evidence.absolute_end <= evidence.absolute_start
    || sha256Hex(evidence.excerpt) !== evidence.excerpt_digest) fail(code, 'card evidence is invalid.');
}
function validateProposedAnalysis(analysis, code) {
  exactKeys(analysis, ['field', 'proposed_value'], code);
  string(analysis.field, code); string(analysis.proposed_value, code);
}

function evidenceFromResolved({ receipt, adapter, resolved, runName }) {
  const claim = resolved.claim;
  if (!claim?.raw_value || !Array.isArray(claim.evidence) || claim.evidence.length !== 1) {
    fail('SOURCE_CLAIM_INVALID', `${runName} needs one source claim and one evidence span.`);
  }
  const section = (receipt.resolved_sections || []).filter((item) => item.section_reference === resolved.section_reference);
  const source = adapter?.admitted_source_contexts?.[0]?.canonical_text?.text;
  if (section.length !== 1 || typeof source !== 'string') fail('SOURCE_CONTEXT_MISSING', `${runName} has no unique source section.`);
  const sectionText = utf8Slice(source, section[0].start, section[0].end);
  const span = claim.evidence[0];
  const excerpt = utf8Slice(sectionText, span.absolute_start, span.absolute_end);
  if (excerpt !== claim.raw_value) fail('SOURCE_EVIDENCE_MISMATCH', `${runName} evidence does not re-slice to the claim text.`);
  return freeze({
    evidence_role: span.evidence_role || null,
    excerpt_id: digest(span.excerpt_id, 'SOURCE_EVIDENCE_INVALID'),
    absolute_start: span.absolute_start,
    absolute_end: span.absolute_end,
    excerpt,
    excerpt_digest: sha256Hex(excerpt),
  });
}

function partyValue(claim) {
  const attributes = claim.attributes || {};
  for (const key of ['party_making', 'obligor_party', 'terminating_party', 'right_holder_party', 'control_holder_party']) {
    if (typeof attributes[key] === 'string' && attributes[key].length > 0) return { field: key, value: attributes[key] };
  }
  return null;
}

function qualifierCode(claim) {
  const code = claim.taxonomy_codes?.qualifier_code || claim.attributes?.knowledge_standard || null;
  return typeof code === 'string' && code.length > 0 ? code : null;
}

function sourceRow({ run, manifest, receipt, adapter, resolved, index }) {
  const claim = resolved.claim;
  if (!claim?.claim_occurrence_id || !claim?.closure_id || !claim?.claim_revision_id) {
    fail('SOURCE_CLAIM_IDENTITY_MISSING', `${run} claim identity is incomplete.`);
  }
  return freeze({
    source_id: `${run}:resolved:${index}`,
    run,
    deal: string(manifest.deal, 'SOURCE_MANIFEST_INVALID'),
    family: string(manifest.section_family, 'SOURCE_MANIFEST_INVALID'),
    section_reference: string(resolved.section_reference, 'SOURCE_RESOLUTION_INVALID'),
    claim_definition_key: string(resolved.resolved_claim_definition_key, 'SOURCE_RESOLUTION_INVALID'),
    identity: freeze({
      claim_revision_id: digest(claim.claim_revision_id, 'SOURCE_CLAIM_IDENTITY_MISSING'),
      claim_occurrence_id: digest(claim.claim_occurrence_id, 'SOURCE_CLAIM_IDENTITY_MISSING'),
      closure_id: digest(claim.closure_id, 'SOURCE_CLAIM_IDENTITY_MISSING'),
    }),
    evidence: evidenceFromResolved({ receipt, adapter, resolved, runName: run }),
    party: partyValue(claim),
    qualifier_code: qualifierCode(claim),
  });
}

function sourceRows({ runs }) {
  const rows = [];
  for (const run of runs) {
    for (const [index, resolved] of (run.resolution.resolved || []).entries()) {
      try {
        rows.push(sourceRow({ ...run, resolved, index }));
      } catch (error) {
        if (!(error instanceof HumanAnchorReviewError) || ![
          'SOURCE_CLAIM_INVALID', 'SOURCE_CLAIM_IDENTITY_MISSING', 'SOURCE_CONTEXT_MISSING',
          'SOURCE_EVIDENCE_MISMATCH', 'SOURCE_RESOLUTION_INVALID',
        ].includes(error.code)) throw error;
      }
    }
  }
  return rows.sort((left, right) => left.family.localeCompare(right.family)
    || left.deal.localeCompare(right.deal) || left.run.localeCompare(right.run)
    || left.identity.closure_id.localeCompare(right.identity.closure_id));
}

function eligibleFor(errorClass, row) {
  if (errorClass === 'PARTY_ATTRIBUTION') return row.party !== null;
  if (errorClass === 'MATERIALITY_CODE') return row.qualifier_code !== null;
  return true;
}

function chooseRows(rows, errorClass, count, used, familyOffset) {
  const families = [...new Set(rows.map((row) => row.family))].sort();
  const ordered = [...families.slice(familyOffset), ...families.slice(0, familyOffset)];
  const grouped = new Map(ordered.map((family) => [family, rows.filter((row) => row.family === family && eligibleFor(errorClass, row))]));
  const cursor = new Map(ordered.map((family) => [family, 0]));
  const selected = [];
  while (selected.length < count) {
    let advanced = false;
    for (const family of ordered) {
      const options = grouped.get(family);
      let index = cursor.get(family);
      while (index < options.length && used.has(options[index].source_id)) index += 1;
      cursor.set(family, index + 1);
      if (index >= options.length) continue;
      used.add(options[index].source_id);
      selected.push(options[index]);
      advanced = true;
      if (selected.length === count) break;
    }
    if (!advanced) fail('ANCHOR_SELECTION_INSUFFICIENT', `cannot select ${count} ${errorClass} cards.`);
  }
  return selected;
}

function swappedParty(value) {
  return /parent/i.test(value) && !/company/i.test(value) ? 'Company' : 'Parent';
}

function swappedCode(value) {
  return value === 'MAT_ALL_MATERIAL' ? 'MAT_MAE_QUALIFIED' : 'MAT_ALL_MATERIAL';
}

function analysisFor(row, errorClass, seeded) {
  if (errorClass === 'PARTY_ATTRIBUTION') {
    return freeze({ field: row.party.field, proposed_value: seeded ? swappedParty(row.party.value) : row.party.value });
  }
  if (errorClass === 'MATERIALITY_CODE') {
    return freeze({ field: 'qualifier_code', proposed_value: seeded ? swappedCode(row.qualifier_code) : row.qualifier_code });
  }
  if (errorClass === 'SPAN') return freeze({ field: 'evidence_span', proposed_value: `${row.evidence.absolute_start}:${row.evidence.absolute_end}` });
  return freeze({ field: 'claim_definition_key', proposed_value: row.claim_definition_key });
}

function cardFromRow({ row, errorClass, seeded }) {
  const body = {
    source_id: row.source_id,
    run: row.run,
    deal: row.deal,
    family: row.family,
    section_reference: row.section_reference,
    claim_definition_key: row.claim_definition_key,
    identity: row.identity,
    evidence: row.evidence,
    error_class: errorClass,
    proposed_analysis: analysisFor(row, errorClass, seeded),
    seeded_wrong: seeded,
    seed_type: seeded ? errorClass : null,
  };
  return freeze({
    ...body,
    decision_key: contentId('CANONICAL_V2_HUMAN_ANCHOR_DECISION_KEY/V1', {
      source_id: row.source_id,
      error_class: errorClass,
      proposed_analysis: body.proposed_analysis,
    }),
  });
}

function countBy(cards, field) {
  const counts = new Map();
  for (const card of cards) counts.set(card[field], (counts.get(card[field]) || 0) + 1);
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function buildHumanAnchorMachinePacket({ runs, cards_per_error_class = 16, seeds_per_hard_class = 4 } = {}) {
  if (!Array.isArray(runs) || runs.length === 0) fail('ANCHOR_INPUT_REQUIRED', 'recorded corpus runs are required.');
  if (!Number.isInteger(cards_per_error_class) || cards_per_error_class < 12) fail('ANCHOR_SELECTION_INVALID', 'cards_per_error_class must be an integer of at least twelve.');
  if (!Number.isInteger(seeds_per_hard_class) || seeds_per_hard_class < 1 || seeds_per_hard_class >= cards_per_error_class) {
    fail('ANCHOR_SELECTION_INVALID', 'seeds_per_hard_class must be positive and below the class size.');
  }
  const source = sourceRows({ runs });
  const used = new Set();
  const cards = [];
  for (const [classIndex, errorClass] of ERROR_CLASSES.entries()) {
    const rows = chooseRows(source, errorClass, cards_per_error_class, used, (classIndex * 8) % new Set(source.map((row) => row.family)).size);
    for (const [index, row] of rows.entries()) {
      cards.push(cardFromRow({ row, errorClass, seeded: ['PARTY_ATTRIBUTION', 'MATERIALITY_CODE'].includes(errorClass) && index < seeds_per_hard_class }));
    }
  }
  const orderedCards = cards.sort((left, right) => left.error_class.localeCompare(right.error_class)
    || left.family.localeCompare(right.family) || left.deal.localeCompare(right.deal)
    || left.decision_key.localeCompare(right.decision_key)).map((card, index) => freeze({ card_number: index + 1, ...card }));
  const strata = freeze({ by_error_class: countBy(orderedCards, 'error_class'), by_family: countBy(orderedCards, 'family') });
  const seeds = orderedCards.filter((card) => card.seeded_wrong);
  if (orderedCards.length < 60 || orderedCards.length > 100 || new Set(orderedCards.map((card) => card.source_id)).size !== orderedCards.length
    || seeds.filter((card) => card.seed_type === 'PARTY_ATTRIBUTION').length === 0
    || seeds.filter((card) => card.seed_type === 'MATERIALITY_CODE').length === 0) {
    fail('ANCHOR_PACKET_INVALID', 'packet must contain 60 to 100 unique cards and hard-class seeds.');
  }
  const body = {
    schema_version: MACHINE_PACKET_SCHEMA,
    selection: freeze({ cards_per_error_class, seeds_per_hard_class, source_card_count: source.length, selected_card_count: orderedCards.length }),
    strata,
    cards: orderedCards,
  };
  return freeze({ ...body, machine_packet_id: contentId(MACHINE_PACKET_SCHEMA, body) });
}

function reviewerCard(card) {
  return freeze({
    card_number: card.card_number,
    decision_key: card.decision_key,
    deal: card.deal,
    family: card.family,
    section_reference: card.section_reference,
    claim_definition_key: card.claim_definition_key,
    identity: card.identity,
    evidence: card.evidence,
    error_class: card.error_class,
    proposed_analysis: card.proposed_analysis,
  });
}

function buildHumanAnchorReviewPacket({ machine_packet: machinePacket } = {}) {
  validateHumanAnchorMachinePacket(machinePacket);
  const cards = machinePacket.cards.map(reviewerCard);
  const body = {
    schema_version: REVIEW_PACKET_SCHEMA,
    machine_packet_id: machinePacket.machine_packet_id,
    machine_packet_digest: packetDigest(machinePacket),
    decision_keys_digest: sha256Hex(canonicalJson(cards.map((card) => card.decision_key))),
    cards,
  };
  return freeze({ ...body, review_packet_id: contentId(REVIEW_PACKET_SCHEMA, body) });
}

function buildHumanAnchorKey({ machine_packet: machinePacket, review_packet: reviewPacket } = {}) {
  validateHumanAnchorMachinePacket(machinePacket);
  validateHumanAnchorReviewPacket(reviewPacket);
  if (reviewPacket.machine_packet_id !== machinePacket.machine_packet_id || reviewPacket.machine_packet_digest !== packetDigest(machinePacket)) {
    fail('KEY_PACKET_BINDING_INVALID', 'review packet does not bind the machine packet.');
  }
  const entries = machinePacket.cards.map((card) => freeze({
    decision_key: card.decision_key,
    planted_expected_verdict: card.seeded_wrong ? 'ERROR' : null,
    seeded_wrong: card.seeded_wrong,
    seed_type: card.seed_type,
  }));
  const body = {
    schema_version: KEY_SCHEMA,
    machine_packet_id: machinePacket.machine_packet_id,
    machine_packet_digest: packetDigest(machinePacket),
    review_packet_id: reviewPacket.review_packet_id,
    decision_keys_digest: reviewPacket.decision_keys_digest,
    entries,
  };
  return freeze({ ...body, key_id: contentId(KEY_SCHEMA, body) });
}

function buildEmptyHumanAnchorDecisionLedger({ review_packet: reviewPacket } = {}) {
  validateHumanAnchorReviewPacket(reviewPacket);
  const body = {
    schema_version: DECISION_LEDGER_SCHEMA,
    review_packet_id: reviewPacket.review_packet_id,
    machine_packet_id: reviewPacket.machine_packet_id,
    decision_keys_digest: reviewPacket.decision_keys_digest,
    decisions: [],
  };
  return freeze({ ...body, decision_ledger_id: contentId(DECISION_LEDGER_SCHEMA, body) });
}

function validateHumanAnchorMachinePacket(packet) {
  exactKeys(packet, ['cards', 'machine_packet_id', 'schema_version', 'selection', 'strata'], 'INVALID_MACHINE_PACKET');
  if (packet.schema_version !== MACHINE_PACKET_SCHEMA || !Array.isArray(packet.cards) || packet.cards.length < 60 || packet.cards.length > 100) {
    fail('INVALID_MACHINE_PACKET', 'packet card count or schema is invalid.');
  }
  const ids = new Set();
  const seeded = new Map([['PARTY_ATTRIBUTION', 0], ['MATERIALITY_CODE', 0]]);
  for (const [index, card] of packet.cards.entries()) {
    exactKeys(card, ['card_number', 'claim_definition_key', 'deal', 'decision_key', 'error_class', 'evidence', 'family', 'identity', 'proposed_analysis', 'run', 'section_reference', 'seed_type', 'seeded_wrong', 'source_id'], 'INVALID_MACHINE_PACKET');
    if (card.card_number !== index + 1 || !ERROR_CLASSES.includes(card.error_class) || ids.has(card.decision_key)) fail('INVALID_MACHINE_PACKET', 'card order, error class, or decision keys are invalid.');
    ids.add(card.decision_key); digest(card.decision_key, 'INVALID_MACHINE_PACKET');
    validateIdentity(card.identity, 'INVALID_MACHINE_PACKET'); validateEvidence(card.evidence, 'INVALID_MACHINE_PACKET'); validateProposedAnalysis(card.proposed_analysis, 'INVALID_MACHINE_PACKET');
    if (card.seeded_wrong !== (card.seed_type !== null)) fail('INVALID_MACHINE_PACKET', 'seed marker and type must agree.');
    if (card.seeded_wrong && seeded.has(card.seed_type)) seeded.set(card.seed_type, seeded.get(card.seed_type) + 1);
  }
  if ([...seeded.values()].some((count) => count === 0) || canonicalJson(packet.strata) !== canonicalJson({ by_error_class: countBy(packet.cards, 'error_class'), by_family: countBy(packet.cards, 'family') })) {
    fail('INVALID_MACHINE_PACKET', 'packet strata or hard seeds are invalid.');
  }
  const body = { schema_version: packet.schema_version, selection: packet.selection, strata: packet.strata, cards: packet.cards };
  if (contentId(MACHINE_PACKET_SCHEMA, body) !== packet.machine_packet_id) fail('INVALID_MACHINE_PACKET', 'machine packet id is invalid.');
  return true;
}

function validateHumanAnchorReviewPacket(packet) {
  exactKeys(packet, ['cards', 'decision_keys_digest', 'machine_packet_digest', 'machine_packet_id', 'review_packet_id', 'schema_version'], 'INVALID_REVIEW_PACKET');
  if (packet.schema_version !== REVIEW_PACKET_SCHEMA || !Array.isArray(packet.cards) || packet.cards.length < 60 || packet.cards.length > 100) fail('INVALID_REVIEW_PACKET', 'review packet schema is invalid.');
  const keys = [];
  for (const [index, card] of packet.cards.entries()) {
    exactKeys(card, ['card_number', 'claim_definition_key', 'deal', 'decision_key', 'error_class', 'evidence', 'family', 'identity', 'proposed_analysis', 'section_reference'], 'INVALID_REVIEW_PACKET');
    if (card.card_number !== index + 1) fail('INVALID_REVIEW_PACKET', 'review cards are not consecutively numbered.');
    keys.push(digest(card.decision_key, 'INVALID_REVIEW_PACKET'));
    validateIdentity(card.identity, 'INVALID_REVIEW_PACKET'); validateEvidence(card.evidence, 'INVALID_REVIEW_PACKET'); validateProposedAnalysis(card.proposed_analysis, 'INVALID_REVIEW_PACKET');
    if (Object.hasOwn(card, 'seeded_wrong') || Object.hasOwn(card, 'seed_type') || Object.hasOwn(card, 'source_id') || Object.hasOwn(card, 'run')) fail('BLIND_REVIEW_LEAK', 'review cards expose machine-only fields.');
  }
  if (new Set(keys).size !== keys.length || packet.decision_keys_digest !== sha256Hex(canonicalJson(keys))) fail('INVALID_REVIEW_PACKET', 'review decision keys are invalid.');
  const body = { schema_version: packet.schema_version, machine_packet_id: packet.machine_packet_id, machine_packet_digest: packet.machine_packet_digest, decision_keys_digest: packet.decision_keys_digest, cards: packet.cards };
  if (contentId(REVIEW_PACKET_SCHEMA, body) !== packet.review_packet_id) fail('INVALID_REVIEW_PACKET', 'review packet id is invalid.');
  return true;
}

function validateHumanAnchorKey({ key, machine_packet: machinePacket, review_packet: reviewPacket } = {}) {
  validateHumanAnchorMachinePacket(machinePacket); validateHumanAnchorReviewPacket(reviewPacket);
  exactKeys(key, ['decision_keys_digest', 'entries', 'key_id', 'machine_packet_digest', 'machine_packet_id', 'review_packet_id', 'schema_version'], 'INVALID_ANCHOR_KEY');
  if (key.schema_version !== KEY_SCHEMA || key.machine_packet_id !== machinePacket.machine_packet_id
    || key.machine_packet_digest !== packetDigest(machinePacket) || key.review_packet_id !== reviewPacket.review_packet_id
    || key.decision_keys_digest !== reviewPacket.decision_keys_digest || !Array.isArray(key.entries)) fail('STALE_ANCHOR_KEY', 'key does not bind the exact packets.');
  const expected = new Map(machinePacket.cards.map((card) => [card.decision_key, card]));
  if (key.entries.length !== expected.size) fail('INVALID_ANCHOR_KEY', 'key must cover every packet card.');
  for (const entry of key.entries) {
    exactKeys(entry, ['decision_key', 'planted_expected_verdict', 'seed_type', 'seeded_wrong'], 'INVALID_ANCHOR_KEY');
    const card = expected.get(entry.decision_key);
    if (!card || entry.seeded_wrong !== card.seeded_wrong || entry.seed_type !== card.seed_type
      || entry.planted_expected_verdict !== (card.seeded_wrong ? 'ERROR' : null)) fail('INVALID_ANCHOR_KEY', 'key entry does not bind its machine card.');
    expected.delete(entry.decision_key);
  }
  if (expected.size !== 0) fail('INVALID_ANCHOR_KEY', 'key card coverage is incomplete.');
  const body = { schema_version: key.schema_version, machine_packet_id: key.machine_packet_id, machine_packet_digest: key.machine_packet_digest, review_packet_id: key.review_packet_id, decision_keys_digest: key.decision_keys_digest, entries: key.entries };
  if (contentId(KEY_SCHEMA, body) !== key.key_id) fail('INVALID_ANCHOR_KEY', 'key id is invalid.');
  return true;
}

function validateHumanAnchorDecisionLedger({ ledger, review_packet: reviewPacket } = {}) {
  validateHumanAnchorReviewPacket(reviewPacket);
  exactKeys(ledger, ['decision_keys_digest', 'decision_ledger_id', 'decisions', 'machine_packet_id', 'review_packet_id', 'schema_version'], 'INVALID_DECISION_LEDGER');
  if (ledger.schema_version !== DECISION_LEDGER_SCHEMA || ledger.review_packet_id !== reviewPacket.review_packet_id
    || ledger.machine_packet_id !== reviewPacket.machine_packet_id || ledger.decision_keys_digest !== reviewPacket.decision_keys_digest || !Array.isArray(ledger.decisions)) {
    fail('STALE_DECISION_LEDGER', 'decision ledger does not bind the exact review packet.');
  }
  const expected = new Set(reviewPacket.cards.map((card) => card.decision_key));
  const seen = new Set();
  for (const decision of ledger.decisions) {
    exactKeys(decision, ['decision_key', 'reviewed_at', 'reviewer_id', 'verdict'], 'INVALID_DECISION_LEDGER');
    if (!expected.has(decision.decision_key) || seen.has(decision.decision_key)) fail('UNKNOWN_DECISION_KEY', 'decision key is unknown or duplicated.');
    if (!VERDICTS.has(decision.verdict)) fail('INVALID_DECISION_LEDGER', 'decision verdict is invalid.');
    string(decision.reviewer_id, 'INVALID_DECISION_LEDGER'); utcMillisecondTimestamp(decision.reviewed_at, 'INVALID_DECISION_LEDGER'); seen.add(decision.decision_key);
  }
  if (ledger.decisions.length > 0 && seen.size !== expected.size) fail('PARTIAL_DECISION_LEDGER', 'a non-empty decision ledger must cover every review card.');
  const body = { schema_version: ledger.schema_version, review_packet_id: ledger.review_packet_id, machine_packet_id: ledger.machine_packet_id, decision_keys_digest: ledger.decision_keys_digest, decisions: ledger.decisions };
  if (contentId(DECISION_LEDGER_SCHEMA, body) !== ledger.decision_ledger_id) fail('INVALID_DECISION_LEDGER', 'decision ledger id is invalid.');
  return true;
}

function humanAnchorReviewGate({ ledger, review_packet: reviewPacket } = {}) {
  validateHumanAnchorDecisionLedger({ ledger, review_packet: reviewPacket });
  return freeze({
    closed: true,
    reason: ledger.decisions.length === 0 ? 'HUMAN_ANCHOR_REVIEW_PENDING' : 'CALIBRATION_AUTHORITY_NOT_IMPLEMENTED',
    reviewed_cards: ledger.decisions.length,
    total_cards: reviewPacket.cards.length,
    publication_authorisation: 'NONE',
  });
}

module.exports = {
  MACHINE_PACKET_SCHEMA,
  REVIEW_PACKET_SCHEMA,
  KEY_SCHEMA,
  DECISION_LEDGER_SCHEMA,
  HumanAnchorReviewError,
  buildHumanAnchorMachinePacket,
  buildHumanAnchorReviewPacket,
  buildHumanAnchorKey,
  buildEmptyHumanAnchorDecisionLedger,
  validateHumanAnchorMachinePacket,
  validateHumanAnchorReviewPacket,
  validateHumanAnchorKey,
  validateHumanAnchorDecisionLedger,
  humanAnchorReviewGate,
};
