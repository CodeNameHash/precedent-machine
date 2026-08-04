'use strict';

const COMPARISON_SCHEMA = 'NEUTRAL_DEFINED_TERM_SAME_TERM_COMPARISON/V1';
const COMPARISON_BASIS = 'SAME_NORMALIZED_DEFINED_TERM_IDENTITY_ONLY';

function fail(message) { throw new TypeError(message); }
function plain(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function requireText(value, label) {
  if (typeof value !== 'string' || value.length === 0) fail(`${label} must be non-empty text.`);
  return value;
}
function freeze(value) { return Object.freeze(structuredClone(value)); }

function normaliseDefinedTermIdentity(value) {
  const term = requireText(value, 'Defined term');
  const normalised = term.normalize('NFKC').replace(/[“”"']/g, '')
    .replace(/[^A-Za-z0-9]+/g, ' ').trim().toLowerCase();
  if (!normalised) fail('Defined term has no normalised identity.');
  return normalised;
}

function readNeutralDefinitionRecord(value, index) {
  if (!plain(value)) fail(`Neutral definition record ${index} must be an object.`);
  const { deal_id: dealId, neutral_record_id: recordId, definition_envelope: envelope, source_evidence: sourceEvidence } = value;
  requireText(dealId, `Neutral definition record ${index} deal_id`);
  requireText(recordId, `Neutral definition record ${index} neutral_record_id`);
  if (!plain(envelope)) fail(`Neutral definition record ${index} definition_envelope must be an object.`);
  requireText(envelope.defined_term, `Neutral definition record ${index} defined_term`);
  requireText(envelope.definition_body_quote, `Neutral definition record ${index} definition_body_quote`);
  if (!Array.isArray(sourceEvidence) || sourceEvidence.length === 0) fail(`Neutral definition record ${index} source_evidence must be a non-empty array.`);
  return freeze({
    deal_id: dealId,
    neutral_record_id: recordId,
    normalised_defined_term_identity: normaliseDefinedTermIdentity(envelope.defined_term),
    definition_envelope: envelope,
    source_evidence: sourceEvidence,
  });
}

function adaptNativeNeutralDefinitionOpenWorldRecords({ deal_id: dealId, open_world: openWorld } = {}) {
  requireText(dealId, 'deal_id');
  if (!Array.isArray(openWorld)) fail('open_world must be an array.');
  return freeze(openWorld.flatMap((entry, index) => {
    const envelope = entry?.attributes?.definition_envelope;
    if (envelope === undefined) return [];
    if (entry?.claim_definition_key !== 'OPEN_WORLD_PROPOSITION') {
      fail(`Open-world definition record ${index} has an unsupported claim definition.`);
    }
    const recordId = entry.claim_occurrence_id || entry.closure_id || entry.subject_occurrence_id;
    const sourceEvidence = entry.source_evidence || entry.evidence;
    return [readNeutralDefinitionRecord({
      deal_id: dealId,
      neutral_record_id: recordId,
      definition_envelope: envelope,
      source_evidence: sourceEvidence,
    }, index)];
  }));
}

function buildNeutralDefinedTermSameTermComparison({ neutral_records: neutralRecords } = {}) {
  if (!Array.isArray(neutralRecords)) fail('neutral_records must be an array.');
  const records = neutralRecords.map(readNeutralDefinitionRecord);
  if (new Set(records.map((record) => `${record.deal_id}:${record.neutral_record_id}`)).size !== records.length) {
    fail('Neutral definition record identifiers must be unique within their deal.');
  }
  const byIdentity = new Map();
  for (const record of records) {
    const group = byIdentity.get(record.normalised_defined_term_identity) || [];
    group.push(record); byIdentity.set(record.normalised_defined_term_identity, group);
  }
  const groups = [...byIdentity.entries()]
    .filter(([, group]) => new Set(group.map((record) => record.deal_id)).size > 1)
    .map(([identity, group]) => freeze({
      normalised_defined_term_identity: identity,
      comparison_basis: COMPARISON_BASIS,
      records: group.sort((left, right) => (
        left.deal_id.localeCompare(right.deal_id) || left.neutral_record_id.localeCompare(right.neutral_record_id)
      )),
    }))
    .sort((left, right) => left.normalised_defined_term_identity.localeCompare(right.normalised_defined_term_identity));
  return freeze({
    schema_version: COMPARISON_SCHEMA,
    comparison_scope: COMPARISON_BASIS,
    market_statistics: 'NOT_CALCULATED',
    groups,
  });
}

module.exports = {
  COMPARISON_BASIS,
  COMPARISON_SCHEMA,
  adaptNativeNeutralDefinitionOpenWorldRecords,
  buildNeutralDefinedTermSameTermComparison,
  normaliseDefinedTermIdentity,
};
