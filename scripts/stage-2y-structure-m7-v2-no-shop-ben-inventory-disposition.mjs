#!/usr/bin/env node
/**
 * Emit the NO_SHOP Ben inventory disposition, session receipt, and the
 * three remaining Work3 successor authorities plus the family package seal receipt.
 *
 * Disposition is APPROVE on all 365 profiles with the subtype-grouping question
 * stamped as an open hold. Q01-Q03 reuse the sealed M5 programme rulings the family
 * role schema already binds; no NoShop-specific ruling is invented.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import canonicalModule from '../lib/canonical-v2/canonical-bytes.js';
import noShopAuthoring from '../lib/canonical-v2/m7-v2-no-shop-authoring.js';

const { canonicalJson, contentId, sha256Hex } = canonicalModule;
const REPO_ROOT = join(import.meta.dirname, '..');
const CONTROL = 'evidence/canonical-v2/stage-2y-structure-migration/control';

const PACKET_PATH =
  `${CONTROL}/m7-v2-repair-no-shop-365-profile-inventory-review-packet-draft.json`;
const INVENTORY_AUTHORITY_PATH =
  `${CONTROL}/m7-v2-repair-contract-work3-no-shop-unapproved-inventory-review-authority.json`;
const DISPOSITION_PATH =
  `${CONTROL}/m7-v2-repair-no-shop-365-profile-inventory-disposition.json`;
const SESSION_PATH =
  `${CONTROL}/m7-v2-repair-no-shop-ben-inventory-session-receipt.json`;
const BEN_AUTHORITY_PATH =
  `${CONTROL}/m7-v2-repair-contract-work3-no-shop-ben-inventory-session-successor-authority.json`;
const SEAL_AUTHORITY_PATH =
  `${CONTROL}/m7-v2-repair-contract-work3-no-shop-family-package-seal-successor-authority.json`;
const SEAL_RECEIPT_PATH =
  `${CONTROL}/m7-v2-repair-no-shop-family-package-seal-receipt.json`;
const REGISTRATION_AUTHORITY_PATH =
  `${CONTROL}/m7-v2-repair-contract-work3-no-shop-registration-successor-authority.json`;
const RULINGS_PATH = `${CONTROL}/m5-programme-rulings.json`;
const ROLE_SCHEMA_PATH = `${CONTROL}/family-role-schemas/NO_SHOP.json`;

const DISPOSITION_SCHEMA =
  'STAGE_2Y_M7_V2_NO_SHOP_365_PROFILE_INVENTORY_DISPOSITION/V1';
const SESSION_SCHEMA =
  'STAGE_2Y_M7_V2_NO_SHOP_BEN_INVENTORY_SESSION_RECEIPT/V1';
const BEN_AUTHORITY_SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_NO_SHOP_BEN_INVENTORY_SESSION_SUCCESSOR_AUTHORITY/V1';
const SEAL_AUTHORITY_SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_NO_SHOP_FAMILY_PACKAGE_SEAL_SUCCESSOR_AUTHORITY/V1';
const SEAL_RECEIPT_SCHEMA =
  'STAGE_2Y_M7_V2_NO_SHOP_FAMILY_PACKAGE_SEAL_RECEIPT/V1';
const REGISTRATION_AUTHORITY_SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_NO_SHOP_REGISTRATION_SUCCESSOR_AUTHORITY/V1';
const SEAL_CANDIDATE_SCHEMA =
  'M7_V2_NO_SHOP_WORK3_FAMILY_PACKAGE_SEAL_CANDIDATE/V1';
const BEN_CANDIDATE_STATE =
  'BEN_365_PROFILE_INVENTORY_DISPOSITION_CAPTURED_PACKAGE_SEAL_NOT_RECORDED';
const SEAL_CANDIDATE_STATE =
  'BEN_NO_SHOP_FAMILY_PACKAGE_SEAL_CAPTURED_REGISTRATION_NOT_RECORDED';

const PROFILE_COUNT = noShopAuthoring.NO_SHOP_PROFILE_COUNT;
const FLAGS = noShopAuthoring.NO_SHOP_REVIEW_FLAGS;
const DIVERGENCE_COUNT =
  noShopAuthoring.NO_SHOP_SUBTYPE_DIVERGENCE_PROFILE_COUNT;
const OUTSIDE_CALIBRATION_COUNT =
  noShopAuthoring.NO_SHOP_OUTSIDE_CALIBRATION_PROFILE_COUNT;
const REGISTERED_BUCKETS =
  noShopAuthoring.NO_SHOP_REGISTERED_SUBTYPE_BUCKET_COUNT;
const POPULATED_BUCKETS =
  noShopAuthoring.NO_SHOP_POPULATED_SUBTYPE_BUCKET_COUNT;
const WITHHELD_WORK3_FIELDS = Object.freeze([
  'activation_id',
  'family_profile_package_id',
  'profile_id',
  'registration_id',
]);

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
  const unsigned = { ...body, schema_version: schema };
  return { ...unsigned, [idField]: contentId(schema, unsigned) };
}

const packet = read(PACKET_PATH);
const packetBinding = binding(PACKET_PATH, packet, 'inventory_review_packet_id');
const inventoryAuthority = read(INVENTORY_AUTHORITY_PATH);
const inventoryAuthorityBinding = binding(
  INVENTORY_AUTHORITY_PATH,
  inventoryAuthority,
  'work3_no_shop_unapproved_inventory_review_authority_id',
);
const rulingsBinding = fileDigest(RULINGS_PATH);
const roleSchemaBinding = fileDigest(ROLE_SCHEMA_PATH);

const profileDispositions = packet.profile_review_items.map((item) => ({
  proposed_profile_key: item.proposed_profile_key,
  ordinal: item.ordinal,
  disposition: 'APPROVE',
  review_flags_acknowledged: item.review_flags.slice(),
  legal_grouping_pending_acknowledged: item.review_flags.includes(FLAGS.LEGAL_GROUPING),
  subtype_partition_divergence_acknowledged: item.review_flags.includes(FLAGS.SUBTYPE_DIVERGENCE),
  outside_calibration_example_acknowledged: item.review_flags.includes(FLAGS.OUTSIDE_CALIBRATION),
}));

const dispositionUnsigned = {
  schema_version: DISPOSITION_SCHEMA,
  packet_digest: packetBinding.sha256,
  ben_rulings_digest: rulingsBinding.sha256,
  reviewer: 'BEN_GOODCHILD',
  default_disposition_applied: true,
  profile_dispositions: profileDispositions,
  sealed_ruling_reuse: {
    approval_id: 'BEN_M5_PROGRAMME_RULES_2026_08_12',
    new_family_specific_ruling_count: 0,
    ruling_ids: [
      'M5-RULING-FAIL-DEPENDENT-PROPOSITION',
      'M5-RULING-ONE-OPERATIVE-LIMB',
      'M5-RULING-ONE-SEMANTIC-OWNER',
    ],
    role_schema_binding: roleSchemaBinding,
    rulings_binding: rulingsBinding,
  },
  session_summary: {
    approved_count: PROFILE_COUNT,
    hold_count: 0,
    reject_count: 0,
    partial_count: 0,
    legal_grouping_review_pending_count: PROFILE_COUNT,
    outside_calibration_example_count: OUTSIDE_CALIBRATION_COUNT,
    populated_subtype_bucket_count: POPULATED_BUCKETS,
    registered_subtype_bucket_count: REGISTERED_BUCKETS,
    subtype_grouping_pending_legal: true,
    subtype_partition_divergence_count: DIVERGENCE_COUNT,
    taxonomy_expansion_acknowledged: true,
  },
};
const dispositionId = contentId(DISPOSITION_SCHEMA, dispositionUnsigned);

const sessionUnsigned = {
  schema_version: SESSION_SCHEMA,
  session_classification: 'NO_SHOP_365_PROFILE_INVENTORY_BEN_REVIEW',
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
  'work3_no_shop_ben_inventory_session_successor_authority_id',
  {
    authority_classification:
      'WORK3_NO_SHOP_BEN_INVENTORY_SESSION_SUCCESSOR_AUTHORITY',
    authority_state: 'AUTHORISED_BEN_MANUAL_DISPOSITION_CAPTURE_ONLY_ZERO_WORK3_OUTPUT_EFFECT',
    immutable_parent_bindings: {
      inventory_review_authority: inventoryAuthorityBinding,
      inventory_review_packet: packetBinding,
      ben_rulings_note: rulingsBinding,
    },
    implementation_contract: {
      exported_function: 'prepareNoShopWork3BenInventorySessionDisposition',
      exact_outer_input_keys: [
        'noShopWork3BenInventorySessionDispositionEvidence',
        'noShopPhase4ReviewInput',
      ],
      exact_successor_evidence_keys: [
        'work3NoShopUnapprovedInventoryReviewAuthority',
        'work3NoShopBenInventorySessionSuccessorAuthority',
        'inventoryReviewPacketDraft',
        'benAuthoredInventoryDisposition',
      ],
    },
    schema_review_candidate_contract: {
      schema_version:
        'M7_V2_NO_SHOP_WORK3_BEN_INVENTORY_SESSION_DISPOSITION_CANDIDATE/V1',
      candidate_state: BEN_CANDIDATE_STATE,
      review_accounting_exact_values: {
        approved_count: PROFILE_COUNT,
        hold_count: 0,
        inventory_review_count: 1,
        profile_disposition_count: PROFILE_COUNT,
        runtime_validator_acceptance_count: 1,
        subtype_partition_divergence_count: DIVERGENCE_COUNT,
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
  'work3_no_shop_ben_inventory_session_successor_authority_id',
);

const sealAuthority = authority(
  SEAL_AUTHORITY_SCHEMA,
  'work3_no_shop_family_package_seal_successor_authority_id',
  {
    authority_classification: 'WORK3_NO_SHOP_FAMILY_PACKAGE_SEAL_SUCCESSOR_AUTHORITY',
    authority_state: 'AUTHORISED_FAMILY_PACKAGE_SEAL_CAPTURE_ONLY_ZERO_WORK3_OUTPUT_EFFECT',
    immutable_parent_bindings: {
      ben_inventory_authority: benAuthorityBinding,
      inventory_disposition: dispositionBinding,
      ben_inventory_session_receipt: sessionBinding,
      ben_rulings_note: rulingsBinding,
    },
    implementation_contract: {
      exported_function: 'prepareNoShopWork3FamilyPackageSeal',
      exact_outer_input_keys: [
        'noShopWork3FamilyPackageSealEvidence',
        'noShopPhase4ReviewInput',
      ],
      exact_successor_evidence_keys: [
        'work3NoShopUnapprovedInventoryReviewAuthority',
        'work3NoShopBenInventorySessionSuccessorAuthority',
        'work3NoShopFamilyPackageSealSuccessorAuthority',
        'inventoryReviewPacketDraft',
        'benAuthoredInventoryDisposition',
        'benInventorySessionReceipt',
      ],
    },
    schema_review_candidate_contract: {
      schema_version: SEAL_CANDIDATE_SCHEMA,
      candidate_state: SEAL_CANDIDATE_STATE,
      review_accounting_exact_values: {
        inventory_review_count: 1,
        inventory_session_disposition_count: 1,
        profile_disposition_count: PROFILE_COUNT,
        runtime_validator_acceptance_count: 1,
        subtype_partition_divergence_count: DIVERGENCE_COUNT,
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
  'work3_no_shop_family_package_seal_successor_authority_id',
);

// Mirrors prepareNoShopWork3FamilyPackageSeal exactly; the test asserts
// the module-derived seal id equals the id recorded here.
const legalGroupingDispositionBinding = {
  ...rulingsBinding,
  disposition_status: 'PENDING_LEGAL_REVIEW',
  legal_grouping_review_pending_count: PROFILE_COUNT,
  outside_calibration_example_count: OUTSIDE_CALIBRATION_COUNT,
  populated_subtype_bucket_count: POPULATED_BUCKETS,
  registered_subtype_bucket_count: REGISTERED_BUCKETS,
  subtype_partition_divergence_count: DIVERGENCE_COUNT,
};
const sealUnsigned = {
  schema_version: SEAL_CANDIDATE_SCHEMA,
  candidate_state: SEAL_CANDIDATE_STATE,
  authority_binding: sealAuthorityBinding,
  inventory_session_disposition_reference: {
    inventory_disposition_id: dispositionBinding.record_id,
    candidate_state: BEN_CANDIDATE_STATE,
  },
  ben_rulings_binding: rulingsBinding,
  disposition_binding: dispositionBinding,
  session_receipt_binding: sessionBinding,
  legal_grouping_disposition_binding: legalGroupingDispositionBinding,
  review_accounting: sealAuthority.schema_review_candidate_contract.review_accounting_exact_values,
  withheld_work3_fields: [...WITHHELD_WORK3_FIELDS],
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
  seal_classification: 'NO_SHOP_WORK3_FAMILY_PACKAGE_SEAL',
  completion_state: 'COMPLETE',
  reviewer: 'BEN_GOODCHILD',
  family_package_seal_id: familyPackageSealId,
  disposition_binding: dispositionBinding,
  session_receipt_binding: sessionBinding,
  ben_rulings_binding: rulingsBinding,
  legal_grouping_disposition_binding: legalGroupingDispositionBinding,
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
  no_shop_family_package_seal_receipt_id:
    contentId(SEAL_RECEIPT_SCHEMA, sealReceiptUnsigned),
};
write(SEAL_RECEIPT_PATH, sealReceipt);
const sealReceiptBinding = binding(
  SEAL_RECEIPT_PATH,
  sealReceipt,
  'no_shop_family_package_seal_receipt_id',
);

const registrationAuthority = authority(
  REGISTRATION_AUTHORITY_SCHEMA,
  'work3_no_shop_registration_successor_authority_id',
  {
    authority_classification: 'WORK3_NO_SHOP_REGISTRATION_SUCCESSOR_AUTHORITY',
    authority_state: 'AUTHORISED_FAMILY_PACKAGE_REGISTRATION_ONLY_ZERO_PRODUCT_WRITE_EFFECT',
    immutable_parent_bindings: {
      family_package_seal_authority: sealAuthorityBinding,
      family_package_seal_receipt: sealReceiptBinding,
    },
    implementation_contract: {
      exported_function: 'prepareNoShopWork3FamilyPackageRegistration',
      exact_outer_input_keys: [
        'noShopWork3FamilyPackageRegistrationEvidence',
        'noShopPhase4ReviewInput',
      ],
      exact_successor_evidence_keys: [
        'work3NoShopUnapprovedInventoryReviewAuthority',
        'work3NoShopBenInventorySessionSuccessorAuthority',
        'work3NoShopFamilyPackageSealSuccessorAuthority',
        'work3NoShopRegistrationSuccessorAuthority',
        'inventoryReviewPacketDraft',
        'benAuthoredInventoryDisposition',
        'benInventorySessionReceipt',
        'familyPackageSealReceipt',
      ],
    },
    schema_review_candidate_contract: {
      schema_version: 'M7_V2_NO_SHOP_WORK3_FAMILY_PACKAGE_REGISTRATION_CANDIDATE/V1',
      candidate_state:
        'BEN_NO_SHOP_FAMILY_PACKAGE_REGISTERED_ZERO_PRODUCT_WRITE_EFFECT',
      review_accounting_exact_values: {
        family_package_count: 1,
        inventory_review_count: 1,
        inventory_session_disposition_count: 1,
        package_registration_count: 1,
        profile_disposition_count: PROFILE_COUNT,
        profile_identity_count: PROFILE_COUNT,
        registration_count: 1,
        runtime_validator_acceptance_count: 1,
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

process.stdout.write(`${JSON.stringify({
  disposition: dispositionBinding,
  session: sessionBinding,
  ben_authority: benAuthorityBinding,
  seal_authority: sealAuthorityBinding,
  seal_receipt: sealReceiptBinding,
  family_package_seal_id: familyPackageSealId,
  registration_authority: binding(
    REGISTRATION_AUTHORITY_PATH,
    registrationAuthority,
    'work3_no_shop_registration_successor_authority_id',
  ),
}, null, 2)}\n`);
