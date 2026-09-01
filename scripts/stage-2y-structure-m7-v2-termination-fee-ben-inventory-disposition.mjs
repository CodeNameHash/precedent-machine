#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import canonicalModule from '../lib/canonical-v2/canonical-bytes.js';
import tfAuthoring from '../lib/canonical-v2/m7-v2-termination-fee-authoring.js';

const { canonicalJson, contentId, sha256Hex } = canonicalModule;
const REPO_ROOT = join(import.meta.dirname, '..');
const CONTROL = 'evidence/canonical-v2/stage-2y-structure-migration/control';
const PACKET_PATH =
  `${CONTROL}/m7-v2-repair-termination-fee-20-profile-inventory-review-packet-draft.json`;
const INVENTORY_AUTHORITY_PATH =
  `${CONTROL}/m7-v2-repair-contract-work3-termination-fee-unapproved-inventory-review-authority.json`;
const DISPOSITION_PATH =
  `${CONTROL}/m7-v2-repair-termination-fee-20-profile-inventory-disposition.json`;
const SESSION_PATH =
  `${CONTROL}/m7-v2-repair-termination-fee-ben-inventory-session-receipt.json`;
const BEN_AUTHORITY_PATH =
  `${CONTROL}/m7-v2-repair-contract-work3-termination-fee-ben-inventory-session-successor-authority.json`;
const SEAL_AUTHORITY_PATH =
  `${CONTROL}/m7-v2-repair-contract-work3-termination-fee-family-package-seal-successor-authority.json`;
const SEAL_RECEIPT_PATH =
  `${CONTROL}/m7-v2-repair-termination-fee-family-package-seal-receipt.json`;
const REGISTRATION_AUTHORITY_PATH =
  `${CONTROL}/m7-v2-repair-contract-work3-termination-fee-registration-successor-authority.json`;
const RULINGS_PATH =
  'docs/codex-program/notes/TERMINATION-FEE-BEN-RULINGS-Q01-Q03-2026-08-24.md';
const DISPOSITION_SCHEMA =
  'STAGE_2Y_M7_V2_TERMINATION_FEE_20_PROFILE_INVENTORY_DISPOSITION/V1';
const SESSION_SCHEMA =
  'STAGE_2Y_M7_V2_TERMINATION_FEE_BEN_INVENTORY_SESSION_RECEIPT/V1';
const BEN_AUTHORITY_SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_TERMINATION_FEE_BEN_INVENTORY_SESSION_SUCCESSOR_AUTHORITY/V1';
const SEAL_AUTHORITY_SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_TERMINATION_FEE_FAMILY_PACKAGE_SEAL_SUCCESSOR_AUTHORITY/V1';
const SEAL_RECEIPT_SCHEMA =
  'STAGE_2Y_M7_V2_TERMINATION_FEE_FAMILY_PACKAGE_SEAL_RECEIPT/V1';
const REGISTRATION_AUTHORITY_SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_TERMINATION_FEE_REGISTRATION_SUCCESSOR_AUTHORITY/V1';
const SEAL_CANDIDATE_SCHEMA =
  'M7_V2_TERMINATION_FEE_WORK3_FAMILY_PACKAGE_SEAL_CANDIDATE/V1';
const DISPOSITION_CANDIDATE_STATE =
  'BEN_20_PROFILE_INVENTORY_DISPOSITION_CAPTURED_PACKAGE_SEAL_NOT_RECORDED';

const PROFILE_COUNT = tfAuthoring.TERMINATION_FEE_PROFILE_COUNT;
const APPROVE_COUNT = tfAuthoring.TERMINATION_FEE_WORK3_APPROVE_COUNT;
const HOLD_COUNT = tfAuthoring.TERMINATION_FEE_WORK3_HOLD_COUNT;
const HOLD_FLAGS = tfAuthoring.TERMINATION_FEE_WORK3_HOLD_REVIEW_FLAGS;

function read(path) {
  return JSON.parse(readFileSync(join(REPO_ROOT, path), 'utf8'));
}
function fileDigest(path) {
  const bytes = readFileSync(join(REPO_ROOT, path));
  return { byte_length: bytes.length, path, sha256: sha256Hex(bytes) };
}
function binding(path, record, idField) {
  const bytes = Buffer.from(`${canonicalJson(record)}\n`, 'utf8');
  return {
    byte_length: bytes.length,
    path,
    record_id: record[idField],
    record_id_field: idField,
    schema_version: record.schema_version,
    sha256: sha256Hex(bytes),
  };
}
function write(path, record) {
  writeFileSync(join(REPO_ROOT, path), `${canonicalJson(record)}\n`);
}
function authority(schema, idField, body) {
  return {
    ...body,
    schema_version: schema,
    [idField]: contentId(schema, { ...body, schema_version: schema }),
  };
}
function zeroEffect() {
  return {
    activation_count: 0,
    approval_count: 0,
    database_write_count: 0,
    package_registration_count: 0,
    product_write_count: 0,
    profile_identity_count: 0,
    work3_identity_count: 0,
  };
}

const packet = read(PACKET_PATH);
const packetBinding = binding(PACKET_PATH, packet, 'inventory_review_packet_id');
const inventoryAuthority = read(INVENTORY_AUTHORITY_PATH);
const inventoryAuthorityBinding = binding(
  INVENTORY_AUTHORITY_PATH,
  inventoryAuthority,
  'work3_termination_fee_unapproved_inventory_review_authority_id',
);
const rulingsBinding = fileDigest(RULINGS_PATH);

const profileDispositions = packet.profile_review_items.map((item) => {
  const holdFlags = item.review_flags.filter((flag) => HOLD_FLAGS.includes(flag));
  return {
    proposed_profile_key: item.proposed_profile_key,
    ordinal: item.ordinal,
    disposition: holdFlags.length > 0 ? 'HOLD' : 'APPROVE',
    hold_reason_flags: holdFlags,
    review_flags_acknowledged: item.review_flags.slice(),
    legal_grouping_pending_acknowledged: item.review_flags.includes(
      'LEGAL_GROUPING_REVIEW_REQUIRED',
    ),
  };
});
const approvedCount = profileDispositions.filter((row) => row.disposition === 'APPROVE').length;
const holdCount = profileDispositions.filter((row) => row.disposition === 'HOLD').length;
if (approvedCount !== APPROVE_COUNT || holdCount !== HOLD_COUNT) {
  throw new Error(`disposition census drift: ${approvedCount} approve / ${holdCount} hold`);
}

const dispositionUnsigned = {
  schema_version: DISPOSITION_SCHEMA,
  packet_digest: packetBinding.sha256,
  ben_rulings_digest: rulingsBinding.sha256,
  reviewer: 'BEN_GOODCHILD',
  default_disposition_applied: true,
  profile_dispositions: profileDispositions,
  session_summary: {
    approved_count: approvedCount,
    hold_count: holdCount,
    reject_count: 0,
    partial_count: 0,
    legal_grouping_review_pending_count: PROFILE_COUNT,
    subtype_partition_hold_count: holdCount,
    taxonomy_expansion_acknowledged: true,
  },
};
const dispositionId = contentId(DISPOSITION_SCHEMA, dispositionUnsigned);
const sessionUnsigned = {
  schema_version: SESSION_SCHEMA,
  session_classification: 'TERMINATION_FEE_20_PROFILE_INVENTORY_BEN_REVIEW',
  completion_state: 'COMPLETE',
  disposition_binding: {
    path: DISPOSITION_PATH,
    inventory_disposition_id: dispositionId,
  },
  packet_binding: {
    path: PACKET_PATH,
    inventory_review_packet_id: packet.inventory_review_packet_id,
    packet_digest: packetBinding.sha256,
  },
  zero_effect_boundary: {
    work3_identity_count: 0,
    package_registration_count: 0,
    product_write_count: 0,
  },
  next_governance_stop: {
    state: 'STOP_AFTER_BEN_INVENTORY_DISPOSITION_BEFORE_FAMILY_PACKAGE_SEAL',
    package_seal_state: 'NOT_RECORDED',
  },
};
const session = {
  ...sessionUnsigned,
  ben_inventory_session_receipt_id: contentId(SESSION_SCHEMA, sessionUnsigned),
};
const disposition = {
  ...dispositionUnsigned,
  inventory_disposition_id: dispositionId,
  session_receipt_id: session.ben_inventory_session_receipt_id,
};
write(DISPOSITION_PATH, disposition);
write(SESSION_PATH, session);
const dispositionBinding = binding(DISPOSITION_PATH, disposition, 'inventory_disposition_id');
const sessionBinding = binding(SESSION_PATH, session, 'ben_inventory_session_receipt_id');

const benAuthority = authority(
  BEN_AUTHORITY_SCHEMA,
  'work3_termination_fee_ben_inventory_session_successor_authority_id',
  {
    authority_classification:
      'WORK3_TERMINATION_FEE_BEN_INVENTORY_SESSION_SUCCESSOR_AUTHORITY',
    authority_state:
      'AUTHORISED_BEN_MANUAL_DISPOSITION_CAPTURE_ONLY_ZERO_WORK3_OUTPUT_EFFECT',
    immutable_parent_bindings: {
      inventory_review_authority: inventoryAuthorityBinding,
      inventory_review_packet: packetBinding,
      ben_rulings_note: rulingsBinding,
    },
    implementation_contract: {
      exported_function: 'prepareTerminationFeeWork3BenInventorySessionDisposition',
      exact_outer_input_keys: [
        'terminationFeeWork3BenInventorySessionDispositionEvidence',
        'terminationFeePhase4ReviewInput',
      ],
      exact_successor_evidence_keys: [
        'work3TerminationFeeUnapprovedInventoryReviewAuthority',
        'work3TerminationFeeBenInventorySessionSuccessorAuthority',
        'inventoryReviewPacketDraft',
        'benAuthoredInventoryDisposition',
      ],
    },
    schema_review_candidate_contract: {
      schema_version:
        'M7_V2_TERMINATION_FEE_WORK3_BEN_INVENTORY_SESSION_DISPOSITION_CANDIDATE/V1',
      candidate_state: DISPOSITION_CANDIDATE_STATE,
      review_accounting_exact_values: {
        approved_count: APPROVE_COUNT,
        hold_count: HOLD_COUNT,
        inventory_review_count: 1,
        profile_disposition_count: PROFILE_COUNT,
        runtime_validator_acceptance_count: 1,
        work3_identity_count: 0,
      },
    },
    zero_effect_boundary: zeroEffect(),
  },
);
write(BEN_AUTHORITY_PATH, benAuthority);
const benAuthorityBinding = binding(
  BEN_AUTHORITY_PATH,
  benAuthority,
  'work3_termination_fee_ben_inventory_session_successor_authority_id',
);

const subtypePartitionBinding = {
  ...rulingsBinding,
  disposition_status: 'DEFERRED',
  legal_grouping_review_pending_count: PROFILE_COUNT,
  subtype_partition_hold_count: HOLD_COUNT,
};
const sealAuthority = authority(
  SEAL_AUTHORITY_SCHEMA,
  'work3_termination_fee_family_package_seal_successor_authority_id',
  {
    authority_classification: 'WORK3_TERMINATION_FEE_FAMILY_PACKAGE_SEAL_SUCCESSOR_AUTHORITY',
    authority_state: 'AUTHORISED_FAMILY_PACKAGE_SEAL_CAPTURE_ONLY_ZERO_WORK3_OUTPUT_EFFECT',
    immutable_parent_bindings: {
      ben_inventory_authority: benAuthorityBinding,
      inventory_disposition: dispositionBinding,
      ben_inventory_session_receipt: sessionBinding,
      ben_rulings_note: rulingsBinding,
    },
    implementation_contract: {
      exported_function: 'prepareTerminationFeeWork3FamilyPackageSeal',
      exact_outer_input_keys: [
        'terminationFeeWork3FamilyPackageSealEvidence',
        'terminationFeePhase4ReviewInput',
      ],
      exact_successor_evidence_keys: [
        'work3TerminationFeeUnapprovedInventoryReviewAuthority',
        'work3TerminationFeeBenInventorySessionSuccessorAuthority',
        'work3TerminationFeeFamilyPackageSealSuccessorAuthority',
        'inventoryReviewPacketDraft',
        'benAuthoredInventoryDisposition',
        'benInventorySessionReceipt',
      ],
    },
    schema_review_candidate_contract: {
      schema_version: SEAL_CANDIDATE_SCHEMA,
      candidate_state:
        'BEN_TERMINATION_FEE_FAMILY_PACKAGE_SEAL_CAPTURED_REGISTRATION_NOT_RECORDED',
      review_accounting_exact_values: {
        inventory_review_count: 1,
        inventory_session_disposition_count: 1,
        profile_disposition_count: PROFILE_COUNT,
        runtime_validator_acceptance_count: 1,
        subtype_partition_hold_count: HOLD_COUNT,
        work3_identity_count: 0,
      },
    },
    zero_effect_boundary: zeroEffect(),
  },
);
write(SEAL_AUTHORITY_PATH, sealAuthority);
const sealAuthorityBinding = binding(
  SEAL_AUTHORITY_PATH,
  sealAuthority,
  'work3_termination_fee_family_package_seal_successor_authority_id',
);

const sealUnsigned = {
  schema_version: SEAL_CANDIDATE_SCHEMA,
  candidate_state: sealAuthority.schema_review_candidate_contract.candidate_state,
  authority_binding: sealAuthorityBinding,
  inventory_session_disposition_reference: {
    inventory_disposition_id: disposition.inventory_disposition_id,
    candidate_state: DISPOSITION_CANDIDATE_STATE,
  },
  ben_rulings_binding: rulingsBinding,
  disposition_binding: dispositionBinding,
  session_receipt_binding: sessionBinding,
  subtype_partition_disposition_binding: subtypePartitionBinding,
  review_accounting: sealAuthority.schema_review_candidate_contract.review_accounting_exact_values,
  withheld_work3_fields: [
    'activation_id',
    'family_profile_package_id',
    'profile_id',
    'registration_id',
  ],
  next_governance_stop: {
    state: 'STOP_AFTER_FAMILY_PACKAGE_SEAL_CAPTURE_BEFORE_REGISTRATION',
    package_seal_state: 'CAPTURED',
    registration_permitted: false,
  },
  zero_effect_boundary: sealAuthority.zero_effect_boundary,
};
const familyPackageSealId = contentId(SEAL_CANDIDATE_SCHEMA, sealUnsigned);
const sealReceiptUnsigned = {
  schema_version: SEAL_RECEIPT_SCHEMA,
  seal_classification: 'TERMINATION_FEE_WORK3_FAMILY_PACKAGE_SEAL',
  completion_state: 'COMPLETE',
  reviewer: 'BEN_GOODCHILD',
  family_package_seal_id: familyPackageSealId,
  disposition_binding: dispositionBinding,
  session_receipt_binding: sessionBinding,
  ben_rulings_binding: rulingsBinding,
  subtype_partition_disposition_binding: subtypePartitionBinding,
  zero_effect_boundary: {
    work3_identity_count: 0,
    package_registration_count: 0,
    product_write_count: 0,
  },
  next_governance_stop: {
    state: 'STOP_AFTER_FAMILY_PACKAGE_SEAL_RECEIPT_BEFORE_REGISTRATION',
    package_seal_state: 'RECORDED',
    registration_permitted: false,
  },
};
const sealReceipt = {
  ...sealReceiptUnsigned,
  termination_fee_family_package_seal_receipt_id:
    contentId(SEAL_RECEIPT_SCHEMA, sealReceiptUnsigned),
};
write(SEAL_RECEIPT_PATH, sealReceipt);
const sealReceiptBinding = binding(
  SEAL_RECEIPT_PATH,
  sealReceipt,
  'termination_fee_family_package_seal_receipt_id',
);

const registrationAuthority = authority(
  REGISTRATION_AUTHORITY_SCHEMA,
  'work3_termination_fee_registration_successor_authority_id',
  {
    authority_classification: 'WORK3_TERMINATION_FEE_REGISTRATION_SUCCESSOR_AUTHORITY',
    authority_state: 'AUTHORISED_FAMILY_PACKAGE_REGISTRATION_ONLY_ZERO_PRODUCT_WRITE_EFFECT',
    immutable_parent_bindings: {
      family_package_seal_authority: sealAuthorityBinding,
      family_package_seal_receipt: sealReceiptBinding,
    },
    implementation_contract: {
      exported_function: 'prepareTerminationFeeWork3FamilyPackageRegistration',
      exact_outer_input_keys: [
        'terminationFeeWork3FamilyPackageRegistrationEvidence',
        'terminationFeePhase4ReviewInput',
      ],
      exact_successor_evidence_keys: [
        'work3TerminationFeeUnapprovedInventoryReviewAuthority',
        'work3TerminationFeeBenInventorySessionSuccessorAuthority',
        'work3TerminationFeeFamilyPackageSealSuccessorAuthority',
        'work3TerminationFeeRegistrationSuccessorAuthority',
        'inventoryReviewPacketDraft',
        'benAuthoredInventoryDisposition',
        'benInventorySessionReceipt',
        'familyPackageSealReceipt',
      ],
    },
    schema_review_candidate_contract: {
      schema_version: 'M7_V2_TERMINATION_FEE_WORK3_FAMILY_PACKAGE_REGISTRATION_CANDIDATE/V1',
      candidate_state:
        'BEN_TERMINATION_FEE_FAMILY_PACKAGE_REGISTERED_ZERO_PRODUCT_WRITE_EFFECT',
      review_accounting_exact_values: {
        family_package_count: 1,
        inventory_review_count: 1,
        inventory_session_disposition_count: 1,
        package_registration_count: 1,
        profile_disposition_count: PROFILE_COUNT,
        profile_identity_count: PROFILE_COUNT,
        registration_count: 1,
        runtime_validator_acceptance_count: 1,
        subtype_partition_hold_count: HOLD_COUNT,
        work3_identity_count: PROFILE_COUNT + 1,
      },
    },
    zero_effect_boundary: {
      activation_count: 0,
      approval_count: 0,
      database_write_count: 0,
      family_package_count: 1,
      package_registration_count: 1,
      product_write_count: 0,
      profile_identity_count: PROFILE_COUNT,
      registration_count: 1,
      work3_identity_count: PROFILE_COUNT + 1,
    },
  },
);
write(REGISTRATION_AUTHORITY_PATH, registrationAuthority);

console.log(JSON.stringify({
  disposition: dispositionBinding,
  session: sessionBinding,
  ben_authority: benAuthorityBinding,
  seal_authority: sealAuthorityBinding,
  seal_receipt: sealReceiptBinding,
  family_package_seal_id: familyPackageSealId,
  registration_authority: binding(
    REGISTRATION_AUTHORITY_PATH,
    registrationAuthority,
    'work3_termination_fee_registration_successor_authority_id',
  ),
  rulings: rulingsBinding,
  approved_count: approvedCount,
  hold_count: holdCount,
}, null, 2));
