'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const identity = require('../lib/canonical-v2/governed-identity-trust-contracts');
const { buildIdentityHumanReviewProjection, validateIdentityHumanReviewProjection } = require('../lib/canonical-v2/identity-human-review-projection');

const digest = (value) => value.toString(16).padStart(64, '0');
const tx = (index) => digest(index + 1);
const seed = (index) => digest(1000 + index);

function fixture() {
  const namespace_approval_request = identity.buildNamespaceApprovalRequest({ namespace_value: 'EXTERNALLY_RATIFIED_NAMESPACE/V3', pending_ben_ruling_id: digest(3), request_nonce: 'namespace-request-0001' });
  const namespace_binding = identity.bindExternallyRatifiedNamespace({ namespace_approval_request, external_ruling_id: digest(4) });
  const mapping_seed_root_id = digest(5); const source_occurrence_root_id = digest(6);
  const proofs = Array.from({ length: 40 }, (_, index) => identity.buildSerialisableCasProof({ transaction_id: tx(index), mapping_seed_root_id, nonce_registry_predecessor_id: digest(100 + index), slot_predecessor_id: digest(200 + index), serialisable_isolation_root_id: digest(300 + index), expected_slot_version: index, expected_nonce_version: index }));
  const receipts = proofs.map((proof, index) => identity.buildAllocationReceipt({ namespace_binding, namespace_approval_request, cas_proof: proof, seed_digest: seed(index), allocation_nonce: `allocation-nonce-${String(index).padStart(4, '0')}` }));
  const deal_mappings = receipts.map((receipt, index) => ({ transaction_id: receipt.transaction_id, production_deal_id: `production-deal-${String(index).padStart(2, '0')}`, seed_digest: seed(index), governed_deal_key: receipt.governed_deal_key, manifest_id: receipt.manifest_id, allocation_receipt_id: receipt.allocation_receipt_id }));
  const occurrence_mappings = receipts.map((receipt, index) => ({ occurrence_id: `OCCURRENCE/${String(index).padStart(2, '0')}`, transaction_id: receipt.transaction_id }));
  occurrence_mappings.push({ occurrence_id: identity.TOPBUILD_SECOND_OCCURRENCE_ID, transaction_id: receipts[39].transaction_id });
  const mapping_set = identity.buildMappingSet({ namespace_binding, namespace_approval_request, mapping_seed_root_id, source_occurrence_root_id, deal_mappings, occurrence_mappings });
  const deal_directory = { deals: deal_mappings.map((mapping, index) => ({ id: mapping.production_deal_id, buyer_display: `Buyer ${index}`, target_display: `Target ${index}`, signing_date: `2026-01-${String((index % 28) + 1).padStart(2, '0')}` })) };
  return { namespace_binding, namespace_approval_request, mapping_set, deal_directory };
}

test('uses named production-deal, transaction, key, manifest, allocation and occurrence associations, including TopBuild twice', () => {
  const input = fixture();
  const value = buildIdentityHumanReviewProjection(input);
  assert.equal(value.rows.length, 40);
  assert.equal(value.occurrence_association_count, 41);
  assert.equal(value.authority, 'NONE');
  assert.ok(value.rows.every((row) => row.display_evidence_only && row.seed_field_inclusion === 'FORBIDDEN' && row.opaque_tx_id && row.governed_deal_key && row.manifest_id && row.allocation_receipt_id));
  const topBuild = value.rows.find((row) => row.occurrence_ids.includes(identity.TOPBUILD_SECOND_OCCURRENCE_ID));
  assert.equal(topBuild.occurrence_ids.length, 2);
  assert.deepEqual(validateIdentityHumanReviewProjection(value, input), value);
});

test('directory reordering cannot change named identity associations', () => {
  const input = fixture();
  const first = buildIdentityHumanReviewProjection(input);
  const reordered = { ...input, deal_directory: { deals: [...input.deal_directory.deals].reverse() } };
  const second = buildIdentityHumanReviewProjection(reordered);
  assert.deepEqual(first.rows, second.rows);
});

test('missing or duplicate named associations fail before a projection can exist', () => {
  const input = fixture();
  const missing = structuredClone(input.mapping_set);
  missing.occurrence_mappings.pop();
  assert.throws(() => buildIdentityHumanReviewProjection({ ...input, mapping_set: missing }));
  const duplicate = structuredClone(input.mapping_set);
  duplicate.occurrence_mappings[1].occurrence_id = duplicate.occurrence_mappings[0].occurrence_id;
  assert.throws(() => buildIdentityHumanReviewProjection({ ...input, mapping_set: duplicate }));
  const duplicateDeal = structuredClone(input.mapping_set);
  duplicateDeal.deal_mappings[1].production_deal_id = duplicateDeal.deal_mappings[0].production_deal_id;
  assert.throws(() => buildIdentityHumanReviewProjection({ ...input, mapping_set: duplicateDeal }));
});

test('projection cannot create or approve a mapping set', () => {
  const source = fs.readFileSync(path.join(__dirname, '../lib/canonical-v2/identity-human-review-projection.js'), 'utf8');
  assert.doesNotMatch(source, /buildMappingSet|buildBenMappingApprovalRequest|writeFile|mkdir|verifySignature|issueAllocationReceipt/i);
});
