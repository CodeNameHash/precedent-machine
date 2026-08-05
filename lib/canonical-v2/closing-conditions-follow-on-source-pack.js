'use strict';

const { contentId, sha256Hex } = require('./canonical-bytes');

const SOURCE_PACK_SCHEMA = 'CLOSING_CONDITIONS_FOLLOW_ON_SOURCE_PACK/V2';
const GROUNDED_REPOSITORY_PRODUCTION_SNAPSHOT = 'GROUNDED_REPOSITORY_PRODUCTION_SNAPSHOT';
const OPEN_NO_GROUNDED_PRODUCTION_EVIDENCE = 'OPEN_NO_GROUNDED_PRODUCTION_EVIDENCE';
const APPROVED_RETIRED_OPEN_WORLD = 'APPROVED_RETIRED_OPEN_WORLD';
const STABLE_GROUNDED_SHAPE_AND_SEPARATE_APPROVAL = 'STABLE_GROUNDED_SHAPE_AND_SEPARATE_APPROVAL';

const DISSENT_THRESHOLD_PATTERNS = Object.freeze([
  /dissent(?:ing)?\s+shares?.{0,120}(?:not\s+exceed|less\s+than|greater\s+than|at\s+most|at\s+least|more\s+than).{0,80}\d+(?:\.\d+)?\s*%/i,
  /(?:not\s+exceed|less\s+than|greater\s+than|at\s+most|at\s+least|more\s+than).{0,120}dissent(?:ing)?\s+shares?.{0,80}\d+(?:\.\d+)?\s*%/i,
]);
const CERTIFICATE_TARGET_PATTERN = /(?:Company|Target).{0,120}certificate|certificate.{0,120}(?:Company|Target)/i;
const CERTIFIED_CONDITION_REFERENCE_PATTERN = /conditions?\s+set\s+forth\s+in\s+Sections?\s+\d+\.\d+\([a-z]\)/i;

function requireSnapshot(snapshot) {
  if (!snapshot || !Array.isArray(snapshot.triples)) throw new TypeError('Snapshot must contain triples.');
  return snapshot;
}

function citedSectionReferences(quote) {
  const matches = String(quote || '').matchAll(/(?:Section\s*)?(\d+\.\d+\([a-z]\))/gi);
  return [...new Set([...matches].map((match) => match[1]))];
}

function sourceRecord(entry) {
  const quote = String(entry.evidence_quote || '');
  return Object.freeze({
    triple_id: entry.id,
    deal_id: entry.deal_id,
    source_provision_id: entry.source_provision_id,
    extracted_at: entry.extracted_at,
    provision_subtype: entry.ai_metadata?.code || null,
    field_key: entry.field_key,
    primary_quote: quote,
    primary_quote_sha256: sha256Hex(Buffer.from(quote, 'utf8')),
    certified_condition_refs: citedSectionReferences(quote),
  });
}

function buildClosingConditionsFollowOnSourcePack(snapshot) {
  requireSnapshot(snapshot);
  const certificateSources = snapshot.triples
    .filter((entry) => entry.ai_metadata?.code === 'COND-B-CERT'
      && entry.field_key === 'certificationRequired'
      && CERTIFICATE_TARGET_PATTERN.test(String(entry.evidence_quote || ''))
      && CERTIFIED_CONDITION_REFERENCE_PATTERN.test(String(entry.evidence_quote || '')))
    .map(sourceRecord)
    .sort((a, b) => a.triple_id.localeCompare(b.triple_id));
  const dissentThresholdSources = snapshot.triples
    .filter((entry) => DISSENT_THRESHOLD_PATTERNS.some((pattern) => pattern.test(String(entry.evidence_quote || ''))))
    .map(sourceRecord)
    .sort((a, b) => a.triple_id.localeCompare(b.triple_id));
  const body = {
    schema_version: SOURCE_PACK_SCHEMA,
    certificate_target_relationship_sources: certificateSources,
    dissent_threshold_sources: dissentThresholdSources,
    dispositions: {
      CERTIFICATE_TARGET_RELATIONSHIP: certificateSources.length
        ? GROUNDED_REPOSITORY_PRODUCTION_SNAPSHOT : OPEN_NO_GROUNDED_PRODUCTION_EVIDENCE,
      DISSENT_THRESHOLD: APPROVED_RETIRED_OPEN_WORLD,
    },
    dissent_threshold_reintroduction_requirement: STABLE_GROUNDED_SHAPE_AND_SEPARATE_APPROVAL,
  };
  return Object.freeze({ ...body, source_pack_id: contentId(SOURCE_PACK_SCHEMA, body) });
}

function recommendedDissentThresholdDisposition(pack) {
  if (!pack || !pack.dispositions?.DISSENT_THRESHOLD) return null;
  return APPROVED_RETIRED_OPEN_WORLD;
}

function verifyClosingConditionsFollowOnSourcePack(pack) {
  if (!pack || pack.schema_version !== SOURCE_PACK_SCHEMA) throw new TypeError('Invalid Closing Conditions follow-on source pack.');
  for (const record of [...pack.certificate_target_relationship_sources, ...pack.dissent_threshold_sources]) {
    if (sha256Hex(Buffer.from(record.primary_quote, 'utf8')) !== record.primary_quote_sha256) {
      throw new TypeError(`Quote hash mismatch: ${record.triple_id}`);
    }
  }
  const body = {
    schema_version: pack.schema_version,
    certificate_target_relationship_sources: pack.certificate_target_relationship_sources,
    dissent_threshold_sources: pack.dissent_threshold_sources,
    dispositions: pack.dispositions,
    dissent_threshold_reintroduction_requirement: pack.dissent_threshold_reintroduction_requirement,
  };
  if (contentId(SOURCE_PACK_SCHEMA, body) !== pack.source_pack_id) throw new TypeError('Source pack content identifier mismatch.');
  return true;
}

module.exports = {
  SOURCE_PACK_SCHEMA,
  GROUNDED_REPOSITORY_PRODUCTION_SNAPSHOT,
  OPEN_NO_GROUNDED_PRODUCTION_EVIDENCE,
  APPROVED_RETIRED_OPEN_WORLD,
  STABLE_GROUNDED_SHAPE_AND_SEPARATE_APPROVAL,
  DISSENT_THRESHOLD_PATTERNS,
  buildClosingConditionsFollowOnSourcePack,
  recommendedDissentThresholdDisposition,
  verifyClosingConditionsFollowOnSourcePack,
};
