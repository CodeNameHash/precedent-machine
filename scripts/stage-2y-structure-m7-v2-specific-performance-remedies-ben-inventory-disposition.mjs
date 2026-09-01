#!/usr/bin/env node
/**
 * Emit the SPECIFIC_PERFORMANCE_REMEDIES Ben inventory disposition, session receipt, and the
 * three remaining Work3 successor authorities plus the family package seal receipt.
 *
 * Disposition is APPROVE on the Skywater profile only; the other seven profiles are
 * honest HOLD rows where Termination Fee sole-remedy resolution already names this family
 * as owner. Q01-Q03 reuse sealed programme rulings; no SpecificPerformanceRemedies-specific
 * ruling is invented.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import canonicalModule from '../lib/canonical-v2/canonical-bytes.js';
import specificPerformanceRemediesAuthoring from '../lib/canonical-v2/m7-v2-specific-performance-remedies-authoring.js';

const { canonicalJson, contentId, sha256Hex } = canonicalModule;
const REPO_ROOT = join(import.meta.dirname, '..');
const CONTROL = 'evidence/canonical-v2/stage-2y-structure-migration/control';

const PACKET_PATH =
  `${CONTROL}/m7-v2-repair-specific-performance-remedies-8-profile-inventory-review-packet-draft.json`;
const INVENTORY_AUTHORITY_PATH =
  `${CONTROL}/m7-v2-repair-contract-work3-specific-performance-remedies-unapproved-inventory-review-authority.json`;
const DISPOSITION_PATH =
  `${CONTROL}/m7-v2-repair-specific-performance-remedies-8-profile-inventory-disposition.json`;
const SESSION_PATH =
  `${CONTROL}/m7-v2-repair-specific-performance-remedies-ben-inventory-session-receipt.json`;
const BEN_AUTHORITY_PATH =
  `${CONTROL}/m7-v2-repair-contract-work3-specific-performance-remedies-ben-inventory-session-successor-authority.json`;
const SEAL_AUTHORITY_PATH =
  `${CONTROL}/m7-v2-repair-contract-work3-specific-performance-remedies-family-package-seal-successor-authority.json`;
const SEAL_RECEIPT_PATH =
  `${CONTROL}/m7-v2-repair-specific-performance-remedies-family-package-seal-receipt.json`;
const REGISTRATION_AUTHORITY_PATH =
  `${CONTROL}/m7-v2-repair-contract-work3-specific-performance-remedies-registration-successor-authority.json`;
const RULINGS_PATH = `${CONTROL}/m5-programme-rulings.json`;
const ROLE_SCHEMA_PATH = `${CONTROL}/family-role-schemas/SPECIFIC_PERFORMANCE_REMEDIES.json`;

const DISPOSITION_SCHEMA =
  'STAGE_2Y_M7_V2_SPECIFIC_PERFORMANCE_REMEDIES_8_PROFILE_INVENTORY_DISPOSITION/V1';
const SESSION_SCHEMA =
  'STAGE_2Y_M7_V2_SPECIFIC_PERFORMANCE_REMEDIES_BEN_INVENTORY_SESSION_RECEIPT/V1';
const BEN_AUTHORITY_SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_SPECIFIC_PERFORMANCE_REMEDIES_BEN_INVENTORY_SESSION_SUCCESSOR_AUTHORITY/V1';
const SEAL_AUTHORITY_SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_SPECIFIC_PERFORMANCE_REMEDIES_FAMILY_PACKAGE_SEAL_SUCCESSOR_AUTHORITY/V1';
const SEAL_RECEIPT_SCHEMA =
  'STAGE_2Y_M7_V2_SPECIFIC_PERFORMANCE_REMEDIES_FAMILY_PACKAGE_SEAL_RECEIPT/V1';
const REGISTRATION_AUTHORITY_SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_SPECIFIC_PERFORMANCE_REMEDIES_REGISTRATION_SUCCESSOR_AUTHORITY/V1';
const SEAL_CANDIDATE_SCHEMA =
  'M7_V2_SPECIFIC_PERFORMANCE_REMEDIES_WORK3_FAMILY_PACKAGE_SEAL_CANDIDATE/V1';
const BEN_CANDIDATE_STATE =
  'BEN_8_PROFILE_INVENTORY_DISPOSITION_CAPTURED_PACKAGE_SEAL_NOT_RECORDED';
const SEAL_CANDIDATE_STATE =
  'BEN_SPECIFIC_PERFORMANCE_REMEDIES_FAMILY_PACKAGE_SEAL_CAPTURED_REGISTRATION_NOT_RECORDED';

const PROFILE_COUNT = specificPerformanceRemediesAuthoring.SPECIFIC_PERFORMANCE_REMEDIES_PROFILE_COUNT;
const FLAGS = specificPerformanceRemediesAuthoring.SPECIFIC_PERFORMANCE_REMEDIES_REVIEW_FLAGS;
const APPROVE_COUNT = specificPerformanceRemediesAuthoring.SPECIFIC_PERFORMANCE_REMEDIES_WORK3_APPROVE_COUNT;
const HOLD_COUNT = specificPerformanceRemediesAuthoring.SPECIFIC_PERFORMANCE_REMEDIES_WORK3_HOLD_COUNT;
const HOLD_FLAGS = specificPerformanceRemediesAuthoring.SPECIFIC_PERFORMANCE_REMEDIES_WORK3_HOLD_REVIEW_FLAGS;
const DIVERGENCE_COUNT =
  specificPerformanceRemediesAuthoring.SPECIFIC_PERFORMANCE_REMEDIES_SUBTYPE_DIVERGENCE_PROFILE_COUNT;
const OUTSIDE_CALIBRATION_COUNT =
  specificPerformanceRemediesAuthoring.SPECIFIC_PERFORMANCE_REMEDIES_OUTSIDE_CALIBRATION_PROFILE_COUNT;
const REGISTERED_BUCKETS =
  specificPerformanceRemediesAuthoring.SPECIFIC_PERFORMANCE_REMEDIES_REGISTERED_SUBTYPE_BUCKET_COUNT;
const POPULATED_BUCKETS =
  specificPerformanceRemediesAuthoring.SPECIFIC_PERFORMANCE_REMEDIES_POPULATED_SUBTYPE_BUCKET_COUNT;
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
  'work3_specific_performance_remedies_unapproved_inventory_review_authority_id',
);
const rulingsBinding = fileDigest(RULINGS_PATH);
const roleSchemaBinding = fileDigest(ROLE_SCHEMA_PATH);

const profileDispositions = packet.profile_review_items.map((item) => {
  const holdFlags = item.review_flags.filter((flag) => HOLD_FLAGS.includes(flag));
  return {
    proposed_profile_key: item.proposed_profile_key,
    ordinal: item.ordinal,
    disposition: holdFlags.length > 0 ? 'HOLD' : 'APPROVE',
    hold_reason_flags: holdFlags,
    review_flags_acknowledged: item.review_flags.slice(),
    legal_grouping_pending_acknowledged: item.review_flags.includes(FLAGS.LEGAL_GROUPING),
    owner_family_disposition_pending_acknowledged: item.review_flags.includes(FLAGS.OWNER_FAMILY),
    subtype_partition_divergence_acknowledged: item.review_flags.includes(FLAGS.SUBTYPE_DIVERGENCE),
    outside_calibration_example_acknowledged: item.review_flags.includes(FLAGS.OUTSIDE_CALIBRATION),
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
    approved_count: approvedCount,
    hold_count: holdCount,
    reject_count: 0,
    partial_count: 0,
    legal_grouping_review_pending_count: PROFILE_COUNT,
    outside_calibration_example_count: OUTSIDE_CALIBRATION_COUNT,
    populated_subtype_bucket_count: POPULATED_BUCKETS,
    registered_subtype_bucket_count: REGISTERED_BUCKETS,
    subtype_grouping_pending_legal: true,
    subtype_partition_divergence_count: DIVERGENCE_COUNT,
    subtype_partition_hold_count: holdCount,
    termination_fee_sole_remedy_owner_family_open: true,
  },
};
const dispositionId = contentId(DISPOSITION_SCHEMA, dispositionUnsigned);

const sessionUnsigned = {
  schema_version: SESSION_SCHEMA,
  session_classification: 'SPECIFIC_PERFORMANCE_REMEDIES_8_PROFILE_INVENTORY_BEN_REVIEW',
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
  'work3_specific_performance_remedies_ben_inventory_session_successor_authority_id',
  {
    authority_classification:
      'WORK3_SPECIFIC_PERFORMANCE_REMEDIES_BEN_INVENTORY_SESSION_SUCCESSOR_AUTHORITY',
    authority_state: 'AUTHORISED_BEN_MANUAL_DISPOSITION_CAPTURE_ONLY_ZERO_WORK3_OUTPUT_EFFECT',
    immutable_parent_bindings: {
      inventory_review_authority: inventoryAuthorityBinding,
      inventory_review_packet: packetBinding,
      ben_rulings_note: rulingsBinding,
    },
    implementation_contract: {
      exported_function: 'prepareSpecificPerformanceRemediesWork3BenInventorySessionDisposition',
      exact_outer_input_keys: [
        'specificPerformanceRemediesWork3BenInventorySessionDispositionEvidence',
        'specificPerformanceRemediesPhase4ReviewInput',
      ],
      exact_successor_evidence_keys: [
        'work3SpecificPerformanceRemediesUnapprovedInventoryReviewAuthority',
        'work3SpecificPerformanceRemediesBenInventorySessionSuccessorAuthority',
        'inventoryReviewPacketDraft',
        'benAuthoredInventoryDisposition',
      ],
    },
    schema_review_candidate_contract: {
      schema_version:
        'M7_V2_SPECIFIC_PERFORMANCE_REMEDIES_WORK3_BEN_INVENTORY_SESSION_DISPOSITION_CANDIDATE/V1',
      candidate_state: BEN_CANDIDATE_STATE,
      review_accounting_exact_values: {
        approved_count: APPROVE_COUNT,
        hold_count: HOLD_COUNT,
        inventory_review_count: 1,
        owner_family_disposition_hold_count: HOLD_COUNT,
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
  'work3_specific_performance_remedies_ben_inventory_session_successor_authority_id',
);

const sealAuthority = authority(
  SEAL_AUTHORITY_SCHEMA,
  'work3_specific_performance_remedies_family_package_seal_successor_authority_id',
  {
    authority_classification: 'WORK3_SPECIFIC_PERFORMANCE_REMEDIES_FAMILY_PACKAGE_SEAL_SUCCESSOR_AUTHORITY',
    authority_state: 'AUTHORISED_FAMILY_PACKAGE_SEAL_CAPTURE_ONLY_ZERO_WORK3_OUTPUT_EFFECT',
    immutable_parent_bindings: {
      ben_inventory_authority: benAuthorityBinding,
      inventory_disposition: dispositionBinding,
      ben_inventory_session_receipt: sessionBinding,
      ben_rulings_note: rulingsBinding,
    },
    implementation_contract: {
      exported_function: 'prepareSpecificPerformanceRemediesWork3FamilyPackageSeal',
      exact_outer_input_keys: [
        'specificPerformanceRemediesWork3FamilyPackageSealEvidence',
        'specificPerformanceRemediesPhase4ReviewInput',
      ],
      exact_successor_evidence_keys: [
        'work3SpecificPerformanceRemediesUnapprovedInventoryReviewAuthority',
        'work3SpecificPerformanceRemediesBenInventorySessionSuccessorAuthority',
        'work3SpecificPerformanceRemediesFamilyPackageSealSuccessorAuthority',
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
  'work3_specific_performance_remedies_family_package_seal_successor_authority_id',
);

// Mirrors prepareSpecificPerformanceRemediesWork3FamilyPackageSeal exactly; the test asserts
// the module-derived seal id equals the id recorded here.
const legalGroupingDispositionBinding = {
  ...rulingsBinding,
  disposition_status: 'PENDING_LEGAL_REVIEW',
  legal_grouping_review_pending_count: PROFILE_COUNT,
  outside_calibration_example_count: OUTSIDE_CALIBRATION_COUNT,
  populated_subtype_bucket_count: POPULATED_BUCKETS,
  registered_subtype_bucket_count: REGISTERED_BUCKETS,
  subtype_partition_divergence_count: DIVERGENCE_COUNT,
  subtype_partition_hold_count: HOLD_COUNT,
  termination_fee_sole_remedy_owner_family_open: true,
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
  seal_classification: 'SPECIFIC_PERFORMANCE_REMEDIES_WORK3_FAMILY_PACKAGE_SEAL',
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
  specific_performance_remedies_family_package_seal_receipt_id:
    contentId(SEAL_RECEIPT_SCHEMA, sealReceiptUnsigned),
};
write(SEAL_RECEIPT_PATH, sealReceipt);
const sealReceiptBinding = binding(
  SEAL_RECEIPT_PATH,
  sealReceipt,
  'specific_performance_remedies_family_package_seal_receipt_id',
);

const registrationAuthority = authority(
  REGISTRATION_AUTHORITY_SCHEMA,
  'work3_specific_performance_remedies_registration_successor_authority_id',
  {
    authority_classification: 'WORK3_SPECIFIC_PERFORMANCE_REMEDIES_REGISTRATION_SUCCESSOR_AUTHORITY',
    authority_state: 'AUTHORISED_FAMILY_PACKAGE_REGISTRATION_ONLY_ZERO_PRODUCT_WRITE_EFFECT',
    immutable_parent_bindings: {
      family_package_seal_authority: sealAuthorityBinding,
      family_package_seal_receipt: sealReceiptBinding,
    },
    implementation_contract: {
      exported_function: 'prepareSpecificPerformanceRemediesWork3FamilyPackageRegistration',
      exact_outer_input_keys: [
        'specificPerformanceRemediesWork3FamilyPackageRegistrationEvidence',
        'specificPerformanceRemediesPhase4ReviewInput',
      ],
      exact_successor_evidence_keys: [
        'work3SpecificPerformanceRemediesUnapprovedInventoryReviewAuthority',
        'work3SpecificPerformanceRemediesBenInventorySessionSuccessorAuthority',
        'work3SpecificPerformanceRemediesFamilyPackageSealSuccessorAuthority',
        'work3SpecificPerformanceRemediesRegistrationSuccessorAuthority',
        'inventoryReviewPacketDraft',
        'benAuthoredInventoryDisposition',
        'benInventorySessionReceipt',
        'familyPackageSealReceipt',
      ],
    },
    schema_review_candidate_contract: {
      schema_version: 'M7_V2_SPECIFIC_PERFORMANCE_REMEDIES_WORK3_FAMILY_PACKAGE_REGISTRATION_CANDIDATE/V1',
      candidate_state:
        'BEN_SPECIFIC_PERFORMANCE_REMEDIES_FAMILY_PACKAGE_REGISTERED_ZERO_PRODUCT_WRITE_EFFECT',
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
    'work3_specific_performance_remedies_registration_successor_authority_id',
  ),
}, null, 2)}\n`);
