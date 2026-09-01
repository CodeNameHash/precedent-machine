#!/usr/bin/env node
/**
 * Generate Ben 45-profile inventory disposition + session receipt evidence files.
 * Matches terminationBenInventoryDispositionEnvelope pattern in work3.test.js.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { canonicalJson, contentId } from '../lib/canonical-v2/canonical-bytes.js';

const REPO_ROOT = join(import.meta.dirname, '..');
const PACKET_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-termination-45-profile-inventory-review-packet-draft.json';
const DISPOSITION_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-termination-45-profile-inventory-disposition.json';
const RECEIPT_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-termination-ben-inventory-session-receipt.json';

const DISPOSITION_SCHEMA = 'STAGE_2Y_M7_V2_TERMINATION_45_PROFILE_INVENTORY_DISPOSITION/V1';
const RECEIPT_SCHEMA = 'STAGE_2Y_M7_V2_TERMINATION_BEN_INVENTORY_SESSION_RECEIPT/V1';
const PACKET_SHA256 =
  '4420906a7c6b6de4ad9a0c54a22d3c029e8e6e6d6c8cfeddfacfa16ec681f53d';
const RULINGS_SHA256 =
  '7bdc740d6fc9ac18dac4dee5f84310a081218089d0812936564ac46376ac7d27';
const CONCHO_PROFILE_KEY =
  'abfa845bbb08d51182b6ed8aa925e53c91be68b4248f35283e4beeee7b929bef';

const TERMINATION_OUTSIDE_DATE_OPTION_B_PARTIAL_APPROVE_PROFILE_KEYS = new Set([
  '261c8790a3247cc495222c2c63e3c82bf09bbcabeae4caa4cb4ff99031a5a6a6',
  '4ea33624832698aaae46dae9e7328de732f0b6a6f7c0206888edacd4c064b20d',
  'e30648500c6a76071927c51739c941a31f0d141c1fbf35f105a015e9dc9e148c',
  'f41fd796b656dceb8b37f020ea30a3816f73248f5072d9b1d51d901134c89f14',
]);

function outsideDateDeferred(item) {
  return (
    item.classification_path.includes('OUTSIDE_DATE_RIGHT') ||
    item.review_flags.includes('HOLD_RECOMMENDED_UNTIL_EXTENSION_DISPOSITION') ||
    item.ben_review_completion_state === 'HOLD_EXTENSION_DISPOSITION_PENDING'
  );
}

const packet = JSON.parse(readFileSync(join(REPO_ROOT, PACKET_PATH), 'utf8'));
const profileDispositions = packet.profile_review_items.map((item) => {
  const deferred = outsideDateDeferred(item);
  const isConcho = item.proposed_profile_key === CONCHO_PROFILE_KEY;
  const isOptionBPartial =
    deferred &&
    TERMINATION_OUTSIDE_DATE_OPTION_B_PARTIAL_APPROVE_PROFILE_KEYS.has(
      item.proposed_profile_key,
    );
  let disposition = 'APPROVE';
  if (deferred && !isConcho && !isOptionBPartial) disposition = 'HOLD';
  if (isOptionBPartial) disposition = 'PARTIAL_APPROVE';
  const row = {
    proposed_profile_key: item.proposed_profile_key,
    ordinal: item.ordinal,
    disposition,
    review_flags_acknowledged: item.review_flags.slice(),
    extension_deferred_acknowledged: Boolean(deferred && !isConcho),
  };
  if (deferred && !isConcho && !isOptionBPartial) {
    row.disposition_reason = 'OUTSIDE_DATE_EXTENSION_DEFERRED_DEFAULT_HOLD';
  }
  if (isOptionBPartial) {
    row.disposition_reason = 'OUTSIDE_DATE_OPTION_B_PARTIAL_APPROVE_LINKS_ACKNOWLEDGED';
  }
  if (isConcho) {
    row.no_extension_complete = true;
    row.disposition_reason = 'OUTSIDE_DATE_NO_EXTENSION_COMPLETE';
  }
  return row;
});

const approvedCount = profileDispositions.filter((r) => r.disposition === 'APPROVE').length;
const holdCount = profileDispositions.filter((r) => r.disposition === 'HOLD').length;
const partialCount = profileDispositions.filter((r) => r.disposition === 'PARTIAL_APPROVE').length;

const dispositionUnsigned = {
  schema_version: DISPOSITION_SCHEMA,
  packet_digest: PACKET_SHA256,
  ben_rulings_digest: RULINGS_SHA256,
  reviewer: 'BEN_GOODCHILD',
  default_disposition_applied: true,
  profile_dispositions: profileDispositions,
  session_summary: {
    approved_count: approvedCount,
    hold_count: holdCount,
    reject_count: 0,
    partial_count: partialCount,
    outside_date_hold_count: profileDispositions.filter(
      (row) => row.disposition === 'HOLD' && row.extension_deferred_acknowledged,
    ).length,
    b9e_note_only_acknowledged: true,
    taxonomy_expansion_acknowledged: true,
  },
};

const dispositionRecord = {
  ...dispositionUnsigned,
  inventory_disposition_id: contentId(DISPOSITION_SCHEMA, dispositionUnsigned),
  session_receipt_id: 'PENDING_SESSION_RECEIPT_DERIVATION',
};

const receiptUnsigned = {
  schema_version: RECEIPT_SCHEMA,
  session_classification: 'TERMINATION_45_PROFILE_INVENTORY_BEN_REVIEW',
  completion_state: 'COMPLETE',
  disposition_binding: {
    path: DISPOSITION_PATH,
    inventory_disposition_id: dispositionRecord.inventory_disposition_id,
  },
  packet_binding: {
    path: PACKET_PATH,
    inventory_review_packet_id: packet.inventory_review_packet_id,
    packet_digest: PACKET_SHA256,
  },
  zero_effect_boundary: {
    work3_identity_count: 0,
    package_registration_count: 0,
    product_write_count: 0,
  },
  next_governance_stop: {
    state: 'STOP_AFTER_BEN_INVENTORY_DISPOSITION_BEFORE_EXTENSION_OR_SEAL',
    required_successor_sequence: [
      'WORK3_TERMINATION_OUTSIDE_DATE_EXTENSION_DISPOSITION',
      'WORK3_TERMINATION_FAMILY_PACKAGE_SEAL_SUCCESSOR_AUTHORITY',
    ],
  },
};

const sessionReceipt = {
  ...receiptUnsigned,
  ben_inventory_session_receipt_id: contentId(RECEIPT_SCHEMA, receiptUnsigned),
};

dispositionRecord.session_receipt_id = sessionReceipt.ben_inventory_session_receipt_id;

writeFileSync(join(REPO_ROOT, DISPOSITION_PATH), `${canonicalJson(dispositionRecord)}\n`);
writeFileSync(join(REPO_ROOT, RECEIPT_PATH), `${canonicalJson(sessionReceipt)}\n`);

console.log(
  JSON.stringify({
    approved_count: approvedCount,
    hold_count: holdCount,
    inventory_disposition_id: dispositionRecord.inventory_disposition_id,
    ben_inventory_session_receipt_id: sessionReceipt.ben_inventory_session_receipt_id,
  }),
);
