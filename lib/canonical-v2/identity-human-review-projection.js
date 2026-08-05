'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { canonicalJson, contentId, sha256Hex } = require('./canonical-bytes');
const {
  MAPPING_SET_SCHEMA,
  NOT_ISSUED,
  TOPBUILD_SECOND_OCCURRENCE_ID,
  validateMappingSet,
} = require('./governed-identity-trust-contracts');

const SCHEMA = 'IDENTITY_HUMAN_REVIEW_PROJECTION/V2';

function displayDirectory({ deal_directory, deal_directory_path = path.resolve(__dirname, '../generated/home-deal-directory-v1.json') } = {}) {
  if (deal_directory) return { directory: deal_directory, digest: sha256Hex(Buffer.from(canonicalJson(deal_directory), 'utf8')) };
  const bytes = fs.readFileSync(deal_directory_path);
  return { directory: JSON.parse(bytes), digest: sha256Hex(bytes) };
}

function buildIdentityHumanReviewProjection({ mapping_set, namespace_binding, namespace_approval_request, deal_directory, deal_directory_path } = {}) {
  const mappingSet = validateMappingSet(mapping_set, { namespace_binding, namespace_approval_request });
  const display = displayDirectory({ deal_directory, deal_directory_path });
  const directoryByProductionId = new Map((display.directory.deals || []).map((deal) => [deal.id, deal]));
  if (directoryByProductionId.size !== 40 || mappingSet.deal_mappings.length !== 40 || mappingSet.occurrence_mappings.length !== 41) {
    throw new Error('identity review projection requires the exact 40-deal/41-occurrence named mapping set and display directory.');
  }
  const occurrenceIdsByTransaction = new Map();
  for (const occurrence of mappingSet.occurrence_mappings) {
    const values = occurrenceIdsByTransaction.get(occurrence.transaction_id) || [];
    values.push(occurrence.occurrence_id);
    occurrenceIdsByTransaction.set(occurrence.transaction_id, values);
  }
  const rows = mappingSet.deal_mappings.map((mapping) => {
    const directoryDeal = directoryByProductionId.get(mapping.production_deal_id);
    const occurrence_ids = [...(occurrenceIdsByTransaction.get(mapping.transaction_id) || [])].sort();
    if (!directoryDeal || occurrence_ids.length === 0) throw new Error('identity review projection requires one display row and named occurrence association for every production deal.');
    return Object.freeze({
      production_deal_id: mapping.production_deal_id,
      opaque_tx_id: mapping.transaction_id,
      governed_deal_key: mapping.governed_deal_key,
      manifest_id: mapping.manifest_id,
      allocation_receipt_id: mapping.allocation_receipt_id,
      occurrence_ids: Object.freeze(occurrence_ids),
      buyer: directoryDeal.buyer_display,
      target: directoryDeal.target_display,
      signing_date: directoryDeal.signing_date,
      display_evidence_only: true,
      seed_field_inclusion: 'FORBIDDEN',
    });
  }).sort((left, right) => left.production_deal_id.localeCompare(right.production_deal_id));
  if (new Set(rows.map((row) => row.production_deal_id)).size !== 40
    || !rows.some((row) => row.occurrence_ids.includes(TOPBUILD_SECOND_OCCURRENCE_ID))) {
    throw new Error('identity review projection requires unique named deal associations and the named TopBuild second occurrence.');
  }
  const body = {
    schema_version: SCHEMA,
    status: NOT_ISSUED,
    authority: 'NONE',
    mapping_set_schema: MAPPING_SET_SCHEMA,
    mapping_set_id: mappingSet.mapping_set_id,
    directory_digest: display.digest,
    occurrence_association_count: mappingSet.occurrence_mappings.length,
    rows: Object.freeze(rows),
    blockers: Object.freeze(['IDENTITY_KEY_REGISTRY_AMENDMENT_REQUIRED', 'IDENTITY_BEN_BATCH_MAPPING_SIGNATURE_REQUIRED']),
  };
  return Object.freeze({ ...body, identity_human_review_projection_id: contentId(SCHEMA, body) });
}

function validateIdentityHumanReviewProjection(value, input) {
  const expected = buildIdentityHumanReviewProjection(input);
  if (canonicalJson(value) !== canonicalJson(expected)) throw new Error('identity human review projection is stale');
  return expected;
}

module.exports = { SCHEMA, buildIdentityHumanReviewProjection, validateIdentityHumanReviewProjection };
