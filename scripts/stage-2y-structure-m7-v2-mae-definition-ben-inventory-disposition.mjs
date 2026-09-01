#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import canonicalModule from '../lib/canonical-v2/canonical-bytes.js';

const { canonicalJson, contentId, sha256Hex } = canonicalModule;
const REPO_ROOT = join(import.meta.dirname, '..');
const CONTROL = 'evidence/canonical-v2/stage-2y-structure-migration/control';
const PACKET_PATH = `${CONTROL}/m7-v2-repair-mae-4-profile-inventory-review-packet-draft.json`;
const INVENTORY_AUTHORITY_PATH =
  `${CONTROL}/m7-v2-repair-contract-work3-mae-definition-unapproved-inventory-review-authority.json`;
const DISPOSITION_PATH = `${CONTROL}/m7-v2-repair-mae-4-profile-inventory-disposition.json`;
const SESSION_PATH = `${CONTROL}/m7-v2-repair-mae-ben-inventory-session-receipt.json`;
const BEN_AUTHORITY_PATH =
  `${CONTROL}/m7-v2-repair-contract-work3-mae-definition-ben-inventory-session-successor-authority.json`;
const SEAL_AUTHORITY_PATH =
  `${CONTROL}/m7-v2-repair-contract-work3-mae-definition-family-package-seal-successor-authority.json`;
const SEAL_RECEIPT_PATH =
  `${CONTROL}/m7-v2-repair-mae-definition-family-package-seal-receipt.json`;
const REGISTRATION_AUTHORITY_PATH =
  `${CONTROL}/m7-v2-repair-contract-work3-mae-definition-registration-successor-authority.json`;
const RULINGS_PATH = 'docs/codex-program/notes/MAE-BEN-RULINGS-Q01-Q03-2026-08-24.md';
const DISPOSITION_SCHEMA =
  'STAGE_2Y_M7_V2_MAE_DEFINITION_4_PROFILE_INVENTORY_DISPOSITION/V1';
const SESSION_SCHEMA =
  'STAGE_2Y_M7_V2_MAE_DEFINITION_BEN_INVENTORY_SESSION_RECEIPT/V1';
const BEN_AUTHORITY_SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_MAE_DEFINITION_BEN_INVENTORY_SESSION_SUCCESSOR_AUTHORITY/V1';
const SEAL_AUTHORITY_SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_MAE_DEFINITION_FAMILY_PACKAGE_SEAL_SUCCESSOR_AUTHORITY/V1';
const SEAL_RECEIPT_SCHEMA =
  'STAGE_2Y_M7_V2_MAE_DEFINITION_FAMILY_PACKAGE_SEAL_RECEIPT/V1';
const REGISTRATION_AUTHORITY_SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_MAE_DEFINITION_REGISTRATION_SUCCESSOR_AUTHORITY/V1';
const SEAL_CANDIDATE_SCHEMA =
  'M7_V2_MAE_DEFINITION_WORK3_FAMILY_PACKAGE_SEAL_CANDIDATE/V1';

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

const packet = read(PACKET_PATH);
const packetBinding = binding(PACKET_PATH, packet, 'inventory_review_packet_id');
const inventoryAuthority = read(INVENTORY_AUTHORITY_PATH);
const inventoryAuthorityBinding = binding(
  INVENTORY_AUTHORITY_PATH,
  inventoryAuthority,
  'work3_mae_definition_unapproved_inventory_review_authority_id',
);
const rulingsBinding = fileDigest(RULINGS_PATH);

const profileDispositions = packet.profile_review_items.map((item) => ({
  proposed_profile_key: item.proposed_profile_key,
  ordinal: item.ordinal,
  disposition: 'APPROVE',
  review_flags_acknowledged: item.review_flags.slice(),
  self_containment_unproven_acknowledged: item.review_flags.includes(
    'MAE_DEFINITION_SELF_CONTAINMENT_UNPROVEN',
  ),
  subject_term_mismatch_acknowledged: item.review_flags.includes(
    'MAE_DEFINITION_SUBJECT_TERM_MISMATCH',
  ),
}));

const dispositionUnsigned = {
  schema_version: DISPOSITION_SCHEMA,
  packet_digest: packetBinding.sha256,
  ben_rulings_digest: rulingsBinding.sha256,
  reviewer: 'BEN_GOODCHILD',
  default_disposition_applied: true,
  profile_dispositions: profileDispositions,
  session_summary: {
    approved_count: 4,
    hold_count: 0,
    reject_count: 0,
    partial_count: 0,
    self_containment_unproven_acknowledged: true,
    subject_term_mismatch_acknowledged: true,
    taxonomy_expansion_acknowledged: true,
  },
};
const dispositionId = contentId(DISPOSITION_SCHEMA, dispositionUnsigned);
const sessionUnsigned = {
  schema_version: SESSION_SCHEMA,
  session_classification: 'MAE_DEFINITION_4_PROFILE_INVENTORY_BEN_REVIEW',
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
  'work3_mae_definition_ben_inventory_session_successor_authority_id',
  {
    authority_classification: 'WORK3_MAE_DEFINITION_BEN_INVENTORY_SESSION_SUCCESSOR_AUTHORITY',
    authority_state:
      'AUTHORISED_BEN_MANUAL_DISPOSITION_CAPTURE_ONLY_ZERO_WORK3_OUTPUT_EFFECT',
    immutable_parent_bindings: {
      inventory_review_authority: inventoryAuthorityBinding,
      inventory_review_packet: packetBinding,
      ben_rulings_note: rulingsBinding,
    },
    implementation_contract: {
      exported_function: 'prepareMaeDefinitionWork3BenInventorySessionDisposition',
      exact_outer_input_keys: [
        'maeDefinitionWork3BenInventorySessionDispositionEvidence',
        'maeDefinitionPhase4ReviewInput',
      ],
      exact_successor_evidence_keys: [
        'work3MaeDefinitionUnapprovedInventoryReviewAuthority',
        'work3MaeDefinitionBenInventorySessionSuccessorAuthority',
        'inventoryReviewPacketDraft',
        'benAuthoredInventoryDisposition',
      ],
    },
    schema_review_candidate_contract: {
      schema_version:
        'M7_V2_MAE_DEFINITION_WORK3_BEN_INVENTORY_SESSION_DISPOSITION_CANDIDATE/V1',
      candidate_state:
        'BEN_4_PROFILE_INVENTORY_DISPOSITION_CAPTURED_PACKAGE_SEAL_NOT_RECORDED',
      review_accounting_exact_values: {
        inventory_review_count: 1,
        profile_disposition_count: 4,
        approved_count: 4,
        hold_count: 0,
        runtime_validator_acceptance_count: 1,
        work3_identity_count: 0,
      },
    },
    zero_effect_boundary: {
      activation_count: 0,
      approval_count: 0,
      database_write_count: 0,
      package_registration_count: 0,
      product_write_count: 0,
      profile_identity_count: 0,
      work3_identity_count: 0,
    },
  },
);
write(BEN_AUTHORITY_PATH, benAuthority);
const benAuthorityBinding = binding(
  BEN_AUTHORITY_PATH,
  benAuthority,
  'work3_mae_definition_ben_inventory_session_successor_authority_id',
);

const reviewStampsBinding = {
  ...rulingsBinding,
  self_containment_status: 'UNPROVEN_ACKNOWLEDGED',
  subject_term_mismatch_status: 'FLAGGED_ACKNOWLEDGED',
};
const sealAuthority = authority(
  SEAL_AUTHORITY_SCHEMA,
  'work3_mae_definition_family_package_seal_successor_authority_id',
  {
    authority_classification: 'WORK3_MAE_DEFINITION_FAMILY_PACKAGE_SEAL_SUCCESSOR_AUTHORITY',
    authority_state: 'AUTHORISED_FAMILY_PACKAGE_SEAL_CAPTURE_ONLY_ZERO_WORK3_OUTPUT_EFFECT',
    immutable_parent_bindings: {
      ben_inventory_authority: benAuthorityBinding,
      inventory_disposition: dispositionBinding,
      ben_inventory_session_receipt: sessionBinding,
      ben_rulings_note: rulingsBinding,
    },
    implementation_contract: {
      exported_function: 'prepareMaeDefinitionWork3FamilyPackageSeal',
      exact_outer_input_keys: [
        'maeDefinitionWork3FamilyPackageSealEvidence',
        'maeDefinitionPhase4ReviewInput',
      ],
      exact_successor_evidence_keys: [
        'work3MaeDefinitionUnapprovedInventoryReviewAuthority',
        'work3MaeDefinitionBenInventorySessionSuccessorAuthority',
        'work3MaeDefinitionFamilyPackageSealSuccessorAuthority',
        'inventoryReviewPacketDraft',
        'benAuthoredInventoryDisposition',
        'benInventorySessionReceipt',
      ],
    },
    schema_review_candidate_contract: {
      schema_version: SEAL_CANDIDATE_SCHEMA,
      candidate_state:
        'BEN_MAE_DEFINITION_FAMILY_PACKAGE_SEAL_CAPTURED_REGISTRATION_NOT_RECORDED',
      review_accounting_exact_values: {
        inventory_review_count: 1,
        inventory_session_disposition_count: 1,
        profile_disposition_count: 4,
        runtime_validator_acceptance_count: 1,
        work3_identity_count: 0,
      },
    },
    zero_effect_boundary: {
      activation_count: 0,
      approval_count: 0,
      database_write_count: 0,
      package_registration_count: 0,
      product_write_count: 0,
      profile_identity_count: 0,
      work3_identity_count: 0,
    },
  },
);
write(SEAL_AUTHORITY_PATH, sealAuthority);
const sealAuthorityBinding = binding(
  SEAL_AUTHORITY_PATH,
  sealAuthority,
  'work3_mae_definition_family_package_seal_successor_authority_id',
);

const sealUnsigned = {
  schema_version: SEAL_CANDIDATE_SCHEMA,
  candidate_state: sealAuthority.schema_review_candidate_contract.candidate_state,
  authority_binding: sealAuthorityBinding,
  inventory_session_disposition_reference: {
    inventory_disposition_id: disposition.inventory_disposition_id,
    candidate_state:
      'BEN_4_PROFILE_INVENTORY_DISPOSITION_CAPTURED_PACKAGE_SEAL_NOT_RECORDED',
  },
  ben_rulings_binding: rulingsBinding,
  disposition_binding: dispositionBinding,
  session_receipt_binding: sessionBinding,
  review_stamps_binding: reviewStampsBinding,
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
  seal_classification: 'MAE_DEFINITION_WORK3_FAMILY_PACKAGE_SEAL',
  completion_state: 'COMPLETE',
  reviewer: 'BEN_GOODCHILD',
  family_package_seal_id: familyPackageSealId,
  disposition_binding: dispositionBinding,
  session_receipt_binding: sessionBinding,
  ben_rulings_binding: rulingsBinding,
  review_stamps_binding: reviewStampsBinding,
  zero_effect_boundary: {
    work3_identity_count: 0,
    package_registration_count: 0,
    product_write_count: 0,
  },
  next_governance_stop: {
    state: 'STOP_AFTER_FAMILY_PACKAGE_SEAL_RECEIPT_BEFORE_REGISTRATION',
    package_seal_state: 'RECORDED',
    registration_permitted: true,
  },
};
const sealReceipt = {
  ...sealReceiptUnsigned,
  mae_definition_family_package_seal_receipt_id:
    contentId(SEAL_RECEIPT_SCHEMA, sealReceiptUnsigned),
};
write(SEAL_RECEIPT_PATH, sealReceipt);
const sealReceiptBinding = binding(
  SEAL_RECEIPT_PATH,
  sealReceipt,
  'mae_definition_family_package_seal_receipt_id',
);

const registrationAuthority = authority(
  REGISTRATION_AUTHORITY_SCHEMA,
  'work3_mae_definition_registration_successor_authority_id',
  {
    authority_classification: 'WORK3_MAE_DEFINITION_REGISTRATION_SUCCESSOR_AUTHORITY',
    authority_state: 'AUTHORISED_FAMILY_PACKAGE_REGISTRATION_ONLY_ZERO_PRODUCT_WRITE_EFFECT',
    immutable_parent_bindings: {
      family_package_seal_authority: sealAuthorityBinding,
      family_package_seal_receipt: sealReceiptBinding,
    },
    implementation_contract: {
      exported_function: 'prepareMaeDefinitionWork3FamilyPackageRegistration',
      exact_outer_input_keys: [
        'maeDefinitionWork3FamilyPackageRegistrationEvidence',
        'maeDefinitionPhase4ReviewInput',
      ],
      exact_successor_evidence_keys: [
        'work3MaeDefinitionUnapprovedInventoryReviewAuthority',
        'work3MaeDefinitionBenInventorySessionSuccessorAuthority',
        'work3MaeDefinitionFamilyPackageSealSuccessorAuthority',
        'work3MaeDefinitionRegistrationSuccessorAuthority',
        'inventoryReviewPacketDraft',
        'benAuthoredInventoryDisposition',
        'benInventorySessionReceipt',
        'familyPackageSealReceipt',
      ],
    },
    schema_review_candidate_contract: {
      schema_version: 'M7_V2_MAE_DEFINITION_WORK3_FAMILY_PACKAGE_REGISTRATION_CANDIDATE/V1',
      candidate_state:
        'BEN_MAE_DEFINITION_FAMILY_PACKAGE_REGISTERED_ZERO_PRODUCT_WRITE_EFFECT',
      review_accounting_exact_values: {
        family_package_count: 1,
        inventory_review_count: 1,
        inventory_session_disposition_count: 1,
        package_registration_count: 1,
        profile_disposition_count: 4,
        profile_identity_count: 4,
        registration_count: 1,
        runtime_validator_acceptance_count: 1,
        work3_identity_count: 5,
      },
    },
    zero_effect_boundary: {
      activation_count: 0,
      approval_count: 0,
      database_write_count: 0,
      family_package_count: 1,
      package_registration_count: 1,
      product_write_count: 0,
      profile_identity_count: 4,
      registration_count: 1,
      work3_identity_count: 5,
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
    'work3_mae_definition_registration_successor_authority_id',
  ),
}));
