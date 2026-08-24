/**
 * Emit a human-reviewable 45-profile Termination inventory packet for Ben.
 * Sources: Stage B blueprint proposal (preferred) or Phase4 profile_review_schedule.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import canonicalModule from '../lib/canonical-v2/canonical-bytes.js';
import profileAuthoring from '../lib/canonical-v2/m7-v2-profile-authoring.js';

const { canonicalJson, contentId, sha256Hex } = canonicalModule;

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');

const PACKET_SCHEMA =
  'STAGE_2Y_M7_V2_TERMINATION_45_PROFILE_INVENTORY_REVIEW_PACKET/V1';
const DEFAULT_PHASE4_AUTHORITY_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-termination-authoring-phase4-family-profile-package-review-authority.json';
const DEFAULT_OUT_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-termination-45-profile-inventory-review-packet-draft.json';

const B9E_PROFILE_KEY =
  'b9e3024406e1a399f7bcf363f4f6267545b265dafb0ed12cd43c71b154c16712';
const B9E_DISPLAY_TEXT = 'contained in non-public disclosure letter';
const B9E_DISPOSITION_KIND = 'NON_PUBLIC_DISCLOSURE_LOCATION';
const B9E_MISSING_FIELD = 'JURISDICTION_LIST_REFERENCE';

const STAGE_A_AUTHORITY_BINDING = Object.freeze({
  path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-governed-disclosure-note-schema-package-analysis-projection-successor-authority.json',
  schema_version:
    'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_GOVERNED_DISCLOSURE_NOTE_SCHEMA_PACKAGE_ANALYSIS_PROJECTION_SUCCESSOR_AUTHORITY/V1',
  record_id_field:
    'work3_governed_disclosure_note_schema_package_analysis_projection_successor_authority_id',
  record_id: '054de9dc959cbb12062099efea3620e9582578fc64c90c6d21b878e009adf28a',
  byte_length: 44726,
  sha256: '850c9170b0367e83a9030c54f8e896be30cfac14a7b9ba8b15a49cab3270b45b',
});
const COMPLETION_RECEIPT_BINDING = Object.freeze({
  path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-termination-authoring-phase5-governed-disclosure-note-execution-completion-incident-lineage-superseding-evidence-receipt.json',
  schema_version:
    'STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_AUTHORING_PHASE5_GOVERNED_DISCLOSURE_NOTE_EXECUTION_COMPLETION_INCIDENT_LINEAGE_SUPERSEDING_EVIDENCE_RECEIPT/V1',
  record_id_field:
    'termination_authoring_phase5_governed_disclosure_note_execution_completion_incident_lineage_superseding_evidence_receipt_id',
  record_id: '1e9c53620dbeac0e3f582ebfca91000111611ede9054193ed174173a78f12e49',
  byte_length: 8867,
  sha256: '905b824dd9a76aab8ca2164d08e647ee798143473ef49dbf40d9e6a768dbfe52',
});
const WORK3_ENTRY_CORRECTION_BINDING = Object.freeze({
  path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-entry-correction-authority.json',
  schema_version: 'STAGE_2Y_M7_V2_REPAIR_WORK3_ENTRY_CORRECTION_AUTHORITY/V1',
  record_id_field: 'correction_authority_id',
  record_id: '561e48f1865259ba58d69f33cefcdf1c1ac606cf9468925dee47227603fad873',
  byte_length: 237749,
  sha256: '42dce2b3bc1f8730bb9a9532e8e9b34872f14117a38cdd97ba1be659e7647deb',
});
const CAPTURE_AUTHORITY_BINDING = Object.freeze({
  path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-termination-authoring-phase5-governed-disclosure-note-ruling-authority.json',
  schema_version:
    'STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_AUTHORING_PHASE5_GOVERNED_DISCLOSURE_NOTE_RULING_AUTHORITY/V1',
  record_id_field:
    'termination_authoring_phase5_governed_disclosure_note_ruling_authority_id',
  record_id: '98ee4f4779c5ac12e4c0b87a856c3383c1a40e10d014441b2f7f01094e9888fa',
  byte_length: 7933,
  sha256: '66dacd7e6151e261e2eeb422443e340787be6699ec8a7a5e15673376c1034b98',
});
const B9E_RULING_BINDING = Object.freeze({
  path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-ruling-termination-b9e-jurisdiction-list-disclosure-note.json',
  schema_version:
    'STAGE_2Y_M7_V2_REPAIR_TERMINATION_B9E_JURISDICTION_LIST_DISCLOSURE_NOTE_RULING/V1',
  record_id_field: 'lawyer_ruling_id',
  record_id: '5612a68b5416a51e26e604c525b8d93ec7285a51f6eba2edca6d251043aa7567',
  byte_length: 1639,
  sha256: 'f0e1155fe4f07f2f710666815afacea109f6978a6c9d04d581016301fe6efa5a',
});
const PHASE5_AUTHORITY_BINDING = Object.freeze({
  path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-termination-authoring-phase5-governed-disclosure-note-authority.json',
  schema_version:
    'STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_AUTHORING_PHASE5_GOVERNED_DISCLOSURE_NOTE_AUTHORITY/V1',
  record_id_field:
    'termination_authoring_phase5_governed_disclosure_note_authority_id',
  record_id: '10bcf58ff7c7a95794fcc1cb2788ce7b768c49865a5f8b2271f1a2d6e2b1f126',
  byte_length: 22512,
  sha256: '11022734a686d0f6efeee52b957e2d6e125f2b2167e7136a14e3d3d69dd786e8',
});
const PHASE4_AUTHORITY_BINDING = Object.freeze({
  path: DEFAULT_PHASE4_AUTHORITY_PATH,
  schema_version:
    'STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_AUTHORING_PHASE4_FAMILY_PROFILE_PACKAGE_REVIEW_AUTHORITY/V1',
  record_id_field:
    'termination_authoring_phase4_family_profile_package_review_authority_id',
  record_id: '3f92e9ec3192933a22eb5a6d193296a164fd25b5612c2ece52fa97636943d41e',
  byte_length: 115221,
  sha256: '2425b103b19a228e26676d347656706be9d1a7b5e693512bcf1c450eba43db18',
});

const TERMINATION_PHASE2_AUTHORITY_BINDING = Object.freeze({
  path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-termination-authoring-phase2-authority-v2.json',
  schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_AUTHORING_PHASE2_AUTHORITY/V2',
  record_id_field: 'termination_authoring_phase2_authority_id',
  record_id: 'df1e3d4711e1b2fca09ea681e43db19a6b7cbfe1055e6a57c3ea48b2f588bf15',
  byte_length: 787442,
  sha256: '897022076002dc07d16d7a60071dd932c829428fe0763d42d9b70fd1b21055cb',
});
const TERMINATION_PHASE3_REFERENCE_REVIEW_AUTHORITY_BINDING = Object.freeze({
  path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-termination-authoring-phase3-reference-review-authority.json',
  schema_version:
    'STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_AUTHORING_PHASE3_REFERENCE_REVIEW_AUTHORITY/V1',
  record_id_field: 'termination_authoring_phase3_reference_review_authority_id',
  record_id: 'd466e16fb7fcd505028915490dfb9faf763e520c3b41dc8ed0eb13c9f39b9187',
  byte_length: 257497,
  sha256: 'd890455c92915f086ce7638c4604d9ad9f767ec3c69826d0b299ba0ff35d940a',
});
const TERMINATION_PHASE3_TARGET_EVIDENCE_AUTHORITY_BINDING = Object.freeze({
  path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-termination-authoring-phase3-reference-target-evidence-authority.json',
  schema_version:
    'STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_AUTHORING_PHASE3_REFERENCE_TARGET_EVIDENCE_AUTHORITY/V1',
  record_id_field:
    'termination_authoring_phase3_reference_target_evidence_authority_id',
  record_id: '5561951e4aa04b5abb34ec1de169d8b85f1117277511e2cd506d9a364d390bfa',
  byte_length: 266529,
  sha256: '1ac96462036fbaadab74f6808706b6e96db7feff75a4ab4430538133a83717c4',
});
const TERMINATION_PHASE3_SOURCE_NORMALISER_AUTHORITY_BINDING = Object.freeze({
  path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-termination-authoring-phase3-reference-source-normaliser-authority.json',
  schema_version:
    'STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_AUTHORING_PHASE3_REFERENCE_SOURCE_NORMALISER_AUTHORITY/V1',
  record_id_field:
    'termination_authoring_phase3_reference_source_normaliser_authority_id',
  record_id: 'e0f0848b106d06a35d341a2359a9bf6494ebd0930ea1f28cef82221c62b901f0',
  byte_length: 151288,
  sha256: '9127af004564fc4a2cc21ffb09ebd71e022780c8fc5beeec6538fcb1273fb26a',
});
const TERMINATION_PHASE3_REFERENCE_EDGE_VALUE_AUTHORITY_BINDING = Object.freeze({
  path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-termination-authoring-phase3-reference-edge-value-authority.json',
  schema_version:
    'STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_AUTHORING_PHASE3_REFERENCE_EDGE_VALUE_AUTHORITY/V1',
  record_id_field:
    'termination_authoring_phase3_reference_edge_value_authority_id',
  record_id: '59121d8247deab7b687e08d7e214c40010ce95cedf69933e4f6cbba4a1c8db73',
  byte_length: 72911,
  sha256: 'ec0060d8e05393a757957385694a2cf60a7bd8b6b367f9f1a461b651511d220e',
});
const TERMINATION_PHASE3_LINKED_RULE_REFERENCE_VALUE_AUTHORITY_BINDING = Object.freeze({
  path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-termination-authoring-phase3-linked-rule-reference-value-authority.json',
  schema_version:
    'STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_AUTHORING_PHASE3_LINKED_RULE_REFERENCE_VALUE_AUTHORITY/V1',
  record_id_field:
    'termination_authoring_phase3_linked_rule_reference_value_authority_id',
  record_id: 'c81adc75621a0803d7d6b77c6e24a7d31fcb68f4dfb8e277662f7c14c223f132',
  byte_length: 89096,
  sha256: 'e688564c3c12d27d1c06f10d2fcb0c8ff250c942add02bee63682a877a0ca560',
});
const TERMINATION_PHASE3_RAW_M2_REFERENCE_OWNER_VALUE_AUTHORITY_BINDING = Object.freeze({
  path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-termination-authoring-phase3-raw-m2-reference-owner-value-authority.json',
  schema_version:
    'STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_AUTHORING_PHASE3_RAW_M2_REFERENCE_OWNER_VALUE_AUTHORITY/V1',
  record_id_field:
    'termination_authoring_phase3_raw_m2_reference_owner_value_authority_id',
  record_id: '2c0ddcf958608fd29af0a3b8e25bb3df2a970e91a30b5131c8a7b475e10d5922',
  byte_length: 87185,
  sha256: '54f3d78528357ff839b7d011358868d3fcf53c1cd91bb090b5f574b5f9ed7b2f',
});
const TERMINATION_PHASE3_SOURCE_OCCURRENCE_SELF_REFERENCE_VALUE_AUTHORITY_BINDING = Object.freeze({
  path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-termination-authoring-phase3-source-occurrence-self-reference-value-authority.json',
  schema_version:
    'STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_AUTHORING_PHASE3_SOURCE_OCCURRENCE_SELF_REFERENCE_VALUE_AUTHORITY/V1',
  record_id_field:
    'termination_authoring_phase3_source_occurrence_self_reference_value_authority_id',
  record_id: '70ec2fb9a7b0e4c0346d9f7ee4549bf3c7dc6d4d5f1764d4bfe77a48cf7f3a7e',
  byte_length: 99021,
  sha256: '76b407edb52e510b918e9eeceb6d31f3dd1ad4344b15264ff7356993c7f9c94f',
});
const TERMINATION_PHASE3_AGREEMENT_DATE_SOURCE_PAIR_REFERENCE_VALUE_AUTHORITY_BINDING = Object.freeze({
  path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-termination-authoring-phase3-agreement-date-source-pair-reference-value-authority.json',
  schema_version:
    'STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_AUTHORING_PHASE3_AGREEMENT_DATE_SOURCE_PAIR_REFERENCE_VALUE_AUTHORITY/V1',
  record_id_field:
    'termination_authoring_phase3_agreement_date_source_pair_reference_value_authority_id',
  record_id: '7a12c30c856c4b70552dcd649b759baeeb857386d0827626e3a63cb9f6ff874a',
  byte_length: 63778,
  sha256: '8444a80d040d773fa200a3d590179b73947516d4cbc4b90c8ac943f95d74eb55',
});
const TERMINATION_PHASE3_COMPANY_STOCKHOLDERS_MEETING_EVENT_REFERENCE_VALUE_AUTHORITY_BINDING = Object.freeze({
  path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-termination-authoring-phase3-company-stockholders-meeting-event-reference-value-authority.json',
  schema_version:
    'STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_AUTHORING_PHASE3_COMPANY_STOCKHOLDERS_MEETING_EVENT_REFERENCE_VALUE_AUTHORITY/V1',
  record_id_field:
    'termination_authoring_phase3_company_stockholders_meeting_event_reference_value_authority_id',
  record_id: 'fa6f5fe95a168261cc2a42a8fc86eece406a0a034aeb4f802e23e2333d02f451',
  byte_length: 118849,
  sha256: '176c09fea829c7395573b4fe5dcd4bd07d78ce83cb34d9791b98aaf0d2760411',
});
const TERMINATION_PHASE3_RED_HAT_COMPANY_LETTER_SOURCE_DISCOVERY_FRONTIER_AUTHORITY_BINDING = Object.freeze({
  path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-termination-authoring-phase3-red-hat-company-letter-section-6-01-c-source-discovery-frontier-authority.json',
  schema_version:
    'STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_AUTHORING_PHASE3_RED_HAT_COMPANY_LETTER_SECTION_6_01_C_SOURCE_DISCOVERY_FRONTIER_AUTHORITY/V3',
  record_id_field:
    'termination_authoring_phase3_red_hat_company_letter_section_6_01_c_source_discovery_frontier_authority_id',
  record_id: '692f3eae2f160c48a0f8ac624498cc18f2ee0731e49c0fbf2c09f56c5310aa5f',
  byte_length: 326103,
  sha256: 'b479b305775e4a165769311bd37bdc5c4421cb9e0bfced3baab7cdd977d11712',
});
const TERMINATION_PHASE3_REFERENCE_VALUE_MATERIALISATION_AUTHORITY_BINDING = Object.freeze({
  path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-termination-authoring-phase3-reference-value-materialisation-authority.json',
  schema_version:
    'STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_AUTHORING_PHASE3_REFERENCE_VALUE_MATERIALISATION_AUTHORITY/V1',
  record_id_field:
    'termination_authoring_phase3_reference_value_materialisation_authority_id',
  record_id: '7b76d93eb880e4dd5eaeae65829d1059b3a5fb19ef12fc7b45fa179e416c6126',
  byte_length: 300160,
  sha256: '3d16169299072a2a3e8485bc51084fe17172edbf98fba350fe5164d21d540156',
});

function repoPath(relativePath) {
  return path.join(REPO_ROOT, relativePath);
}

function readRecord(relativePath) {
  return JSON.parse(readFileSync(repoPath(relativePath), 'utf8'));
}

function sourceEnvelope(binding) {
  return {
    binding: structuredClone(binding),
    record: readRecord(binding.path),
  };
}

function terminationPhase2GovernedSources(authorityRecord) {
  const parents = authorityRecord.immutable_parent_bindings;
  const agreementEvidenceByAgreementId = Object.fromEntries(
    parents.m2_m3_m4.map((agreement) => [agreement.agreement_id, {
      canonicalTextIdentity: {
        canonical_text_id: agreement.canonical_text_id,
        canonical_text_byte_length: agreement.canonical_text_byte_length,
        canonical_text_sha256: agreement.canonical_text_sha256,
      },
      m2: sourceEnvelope(agreement.m2),
      m3: sourceEnvelope(agreement.m3),
      m4: sourceEnvelope(agreement.m4),
    }]),
  );
  return {
    baseContractPolicy: sourceEnvelope(parents.base_policy),
    temporalPhase1Authority: sourceEnvelope(parents.phase1),
    c3CorrectionAuthority: sourceEnvelope(parents.c3),
    work3Manifest: sourceEnvelope(parents.work3_manifest),
    familyRolePolicy: sourceEnvelope(parents.family_role_policy),
    calibrationPack: sourceEnvelope(parents.calibration_pack),
    agreementEvidenceByAgreementId,
  };
}

function terminationPhase2ProposalFixture() {
  const terminationAuthoringPhase2Authority =
    sourceEnvelope(TERMINATION_PHASE2_AUTHORITY_BINDING);
  return {
    terminationAuthoringPhase2Authority,
    governedSources: terminationPhase2GovernedSources(
      terminationAuthoringPhase2Authority.record,
    ),
  };
}

function terminationPhase3ReferenceReviewFixture() {
  const phase2 = terminationPhase2ProposalFixture();
  return {
    terminationPhase3ReviewAuthority:
      sourceEnvelope(TERMINATION_PHASE3_REFERENCE_REVIEW_AUTHORITY_BINDING),
    terminationAuthoringPhase2Authority:
      phase2.terminationAuthoringPhase2Authority,
    governedSources: phase2.governedSources,
  };
}

function terminationPhase3TargetEvidenceFixture() {
  return {
    terminationPhase3TargetEvidenceAuthority:
      sourceEnvelope(TERMINATION_PHASE3_TARGET_EVIDENCE_AUTHORITY_BINDING),
    ...terminationPhase3ReferenceReviewFixture(),
  };
}

function terminationPhase3SourceNormaliserFixture() {
  return {
    terminationPhase3ReferenceSourceNormaliserAuthority:
      sourceEnvelope(TERMINATION_PHASE3_SOURCE_NORMALISER_AUTHORITY_BINDING),
    ...terminationPhase3TargetEvidenceFixture(),
  };
}

function terminationPhase3ReferenceEdgeValueFixture() {
  return {
    terminationPhase3ReferenceEdgeValueAuthority:
      sourceEnvelope(TERMINATION_PHASE3_REFERENCE_EDGE_VALUE_AUTHORITY_BINDING),
    ...terminationPhase3SourceNormaliserFixture(),
  };
}

function terminationPhase3LinkedRuleReferenceValueFixture() {
  return {
    terminationPhase3LinkedRuleReferenceValueAuthority:
      sourceEnvelope(TERMINATION_PHASE3_LINKED_RULE_REFERENCE_VALUE_AUTHORITY_BINDING),
    ...terminationPhase3ReferenceEdgeValueFixture(),
  };
}

function terminationPhase3RawM2ReferenceOwnerValueFixture() {
  return {
    terminationPhase3RawM2ReferenceOwnerValueAuthority:
      sourceEnvelope(TERMINATION_PHASE3_RAW_M2_REFERENCE_OWNER_VALUE_AUTHORITY_BINDING),
    ...terminationPhase3LinkedRuleReferenceValueFixture(),
  };
}

function terminationPhase3SourceOccurrenceSelfReferenceValueFixture() {
  return {
    terminationPhase3SourceOccurrenceSelfReferenceValueAuthority:
      sourceEnvelope(
        TERMINATION_PHASE3_SOURCE_OCCURRENCE_SELF_REFERENCE_VALUE_AUTHORITY_BINDING,
      ),
    ...terminationPhase3RawM2ReferenceOwnerValueFixture(),
  };
}

function terminationPhase3AgreementDateSourcePairReferenceValueFixture() {
  return {
    terminationPhase3AgreementDateSourcePairReferenceValueAuthority:
      sourceEnvelope(
        TERMINATION_PHASE3_AGREEMENT_DATE_SOURCE_PAIR_REFERENCE_VALUE_AUTHORITY_BINDING,
      ),
    ...terminationPhase3SourceOccurrenceSelfReferenceValueFixture(),
  };
}

function terminationPhase3CompanyStockholdersMeetingEventReferenceValueFixture() {
  return {
    terminationPhase3CompanyStockholdersMeetingEventReferenceValueAuthority:
      sourceEnvelope(
        TERMINATION_PHASE3_COMPANY_STOCKHOLDERS_MEETING_EVENT_REFERENCE_VALUE_AUTHORITY_BINDING,
      ),
    ...terminationPhase3AgreementDateSourcePairReferenceValueFixture(),
  };
}

function terminationPhase3ReferenceValueMaterialisationFixture() {
  return {
    terminationPhase3ReferenceValueMaterialisationAuthority:
      sourceEnvelope(TERMINATION_PHASE3_REFERENCE_VALUE_MATERIALISATION_AUTHORITY_BINDING),
    terminationPhase3RedHatCompanyLetterSourceDiscoveryFrontierAuthority:
      sourceEnvelope(
        TERMINATION_PHASE3_RED_HAT_COMPANY_LETTER_SOURCE_DISCOVERY_FRONTIER_AUTHORITY_BINDING,
      ),
    ...terminationPhase3CompanyStockholdersMeetingEventReferenceValueFixture(),
  };
}

function buildStageBBlueprintInput() {
  return {
    terminationWork3SchemaSuccessorEvidence: {
      work3EntryCorrectionAuthority: sourceEnvelope(WORK3_ENTRY_CORRECTION_BINDING),
      phase5ExecutionCompletionReceipt: sourceEnvelope(COMPLETION_RECEIPT_BINDING),
      work3GovernedDisclosureNoteSchemaSuccessorAuthority:
        sourceEnvelope(STAGE_A_AUTHORITY_BINDING),
    },
    terminationPhase5ResolutionInput: {
      terminationPhase5ResolutionEvidence: {
        governedDisclosureNoteRulingAuthority: sourceEnvelope(CAPTURE_AUTHORITY_BINDING),
        governedDisclosureNoteRuling: sourceEnvelope(B9E_RULING_BINDING),
        familyProfilePackageResolutionAuthority:
          sourceEnvelope(PHASE5_AUTHORITY_BINDING),
      },
      terminationFamilyProfilePackageReviewInput: {
        terminationPhase4FamilyProfilePackageReviewAuthority:
          sourceEnvelope(PHASE4_AUTHORITY_BINDING),
        terminationReferenceValueMaterialisationInput:
          terminationPhase3ReferenceValueMaterialisationFixture(),
      },
    },
  };
}

function runStageBBlueprintProposal() {
  const input = buildStageBBlueprintInput();
  return profileAuthoring.prepareTerminationWork3StageBBlueprintProposal(input);
}

function summariseGovernedDisclosureNotes(notes) {
  if (!Array.isArray(notes) || notes.length === 0) return [];
  return notes.map((note) => ({
    governed_disclosure_note_id: note.governed_disclosure_note_id,
    profile_key: note.profile_key,
    field_key: note.field_key,
    reference_slot_key: note.reference_slot_key,
    disposition_kind: note.disposition_kind,
    display_text: note.display_text,
    lawyer_ruling_id: note.lawyer_ruling_id,
  }));
}

function completionStateFromValidation(proposedValidation) {
  if (
    proposedValidation?.extraction_state === 'COMPLETE' &&
    proposedValidation?.output_disposition === 'NORMAL'
  ) {
    return 'COMPLETE';
  }
  if (proposedValidation?.extraction_state === 'INCOMPLETE') {
    return 'INCOMPLETE';
  }
  return proposedValidation?.extraction_state === 'COMPLETE'
    ? 'COMPLETE'
    : 'INCOMPLETE';
}

function buildProfileReviewItem(profile, ordinal, options = {}) {
  const {
    includePhase3ProfileKey = true,
    includeReferenceAccounting = true,
    includeValidationDetail = true,
  } = options;
  const tuple = profile.canonical_tuple ?? {};
  const item = {
    ordinal,
    proposed_profile_key: profile.proposed_profile_key,
    classification_path: tuple.classification_path ?? [],
    required_expression_signature: tuple.required_expression_signature ?? null,
    completion_state: completionStateFromValidation(profile.proposed_validation),
    missing_required_field_keys: [...(profile.missing_required_field_keys ?? [])],
    governed_disclosure_notes:
      summariseGovernedDisclosureNotes(profile.governed_disclosure_notes),
    is_b9e_profile: profile.proposed_profile_key === B9E_PROFILE_KEY,
  };
  if (includePhase3ProfileKey && profile.phase3_profile_key) {
    item.phase3_profile_key = profile.phase3_profile_key;
  }
  if (includeValidationDetail && profile.proposed_validation) {
    item.proposed_validation = {
      extraction_state: profile.proposed_validation.extraction_state,
      source_quality: profile.proposed_validation.source_quality,
      output_disposition: profile.proposed_validation.output_disposition,
      issue_codes: [...(profile.proposed_validation.issue_codes ?? [])],
    };
  }
  if (includeReferenceAccounting) {
    item.reference_accounting = {
      reference_occurrence_count: profile.reference_occurrence_count ?? null,
      materialised_reference_value_count:
        profile.materialised_reference_value_count ?? null,
      unresolved_reference_value_count:
        profile.unresolved_reference_value_count ?? null,
      work3_fixture_consumable_reference_value_count:
        profile.work3_fixture_consumable_reference_value_count ?? null,
    };
    if (Array.isArray(profile.reference_value_reviews)) {
      item.reference_value_null_count = profile.reference_value_reviews.filter(
        (review) => review.typed_value === null,
      ).length;
    }
  }
  item.source_unit_count = Array.isArray(profile.source_unit_keys)
    ? profile.source_unit_keys.length
    : null;
  item.m4_claim_count = Array.isArray(profile.m4_claim_ids)
    ? profile.m4_claim_ids.length
    : null;
  return item;
}

function buildPacketFromStageB(stageB) {
  const profiles = [...stageB.proposed_profiles].sort((left, right) => (
    left.proposed_profile_key.localeCompare(right.proposed_profile_key)
  ));
  const unsigned = {
    schema_version: PACKET_SCHEMA,
    packet_kind: 'DRAFT_NOT_AUTHORITY',
    source_mode: 'STAGE_B_BLUEPRINT_PROPOSAL',
    stage_b_schema_version: stageB.schema_version,
    blueprint_proposal_id: stageB.blueprint_proposal_id,
    candidate_state: stageB.candidate_state,
    profile_approval_state: stageB.profile_approval_state,
    profile_count: stageB.proposed_profile_count,
    complete_profile_count: stageB.complete_profile_count,
    incomplete_profile_count: stageB.incomplete_profile_count,
    b9e_profile_key: B9E_PROFILE_KEY,
    b9e_ruling: {
      display_text: B9E_DISPLAY_TEXT,
      disposition_kind: B9E_DISPOSITION_KIND,
      missing_field_key: B9E_MISSING_FIELD,
      lawyer_ruling_binding: B9E_RULING_BINDING,
    },
    review_workflow: {
      intended_reviewer: 'BEN_GOODCHILD',
      session_goal: 'Approve all 45 subtype proposals in one review after core integration lands.',
      default_disposition: 'APPROVE_ALL_EXCEPT_EXPLICIT_GAPS',
      b9e_already_ruled: true,
      retained_source_gap_count: stageB.retained_source_gaps?.length ?? 0,
      next_governance_stop: stageB.next_governance_stop,
    },
    retained_source_gaps: stageB.retained_source_gaps ?? [],
    profile_review_items: profiles.map((profile, index) => (
      buildProfileReviewItem(profile, index + 1)
    )),
    source_bindings: {
      phase4_authority: PHASE4_AUTHORITY_BINDING,
      stage_a_authority: STAGE_A_AUTHORITY_BINDING,
      phase5_authority: PHASE5_AUTHORITY_BINDING,
      b9e_ruling: B9E_RULING_BINDING,
    },
  };
  return {
    ...unsigned,
    inventory_review_packet_id: contentId(PACKET_SCHEMA, unsigned),
  };
}

function buildPacketFromPhase4Schedule(authority) {
  const schedule = [...authority.profile_review_schedule].sort((left, right) => (
    left.proposed_profile_key.localeCompare(right.proposed_profile_key)
  ));
  const profiles = schedule.map((item, index) => {
    const tuple = item.canonical_tuple ?? {};
    const profile = {
      proposed_profile_key: item.proposed_profile_key,
      phase3_profile_key: item.phase3_profile_key,
      canonical_tuple: item.canonical_tuple,
      source_unit_keys: item.source_unit_keys,
      m4_claim_ids: item.m4_claim_ids,
      proposed_validation: item.proposed_validation,
      missing_required_field_keys: item.missing_required_field_keys,
      governed_disclosure_notes: [],
      reference_occurrence_count: item.reference_occurrence_count,
      materialised_reference_value_count: item.materialised_reference_value_count,
      unresolved_reference_value_count: item.unresolved_reference_value_count,
      work3_fixture_consumable_reference_value_count:
        item.work3_fixture_consumable_reference_value_count,
    };
    return buildProfileReviewItem(profile, index + 1, {
      includeReferenceAccounting: true,
      includeValidationDetail: true,
    });
  });
  const completeCount = profiles.filter(
    (item) => item.completion_state === 'COMPLETE',
  ).length;
  const unsigned = {
    schema_version: PACKET_SCHEMA,
    packet_kind: 'DRAFT_NOT_AUTHORITY',
    source_mode: 'PHASE4_PROFILE_REVIEW_SCHEDULE',
    phase4_authority_id:
      authority.termination_authoring_phase4_family_profile_package_review_authority_id,
    profile_review_schedule_sha256:
      authority.profile_review_schedule_contract?.schedule_sha256 ?? null,
    profile_count: profiles.length,
    complete_profile_count: completeCount,
    incomplete_profile_count: profiles.length - completeCount,
    b9e_profile_key: B9E_PROFILE_KEY,
    b9e_ruling: {
      display_text: B9E_DISPLAY_TEXT,
      disposition_kind: B9E_DISPOSITION_KIND,
      missing_field_key: B9E_MISSING_FIELD,
      lawyer_ruling_binding: B9E_RULING_BINDING,
      note: 'Phase4 schedule mode does not attach governed_disclosure_notes; use stage-b mode after integration.',
    },
    review_workflow: {
      intended_reviewer: 'BEN_GOODCHILD',
      session_goal: 'Approve all 45 subtype proposals in one review after core integration lands.',
      default_disposition: 'APPROVE_ALL_EXCEPT_EXPLICIT_GAPS',
      b9e_already_ruled: true,
      retained_source_gap_count: profiles.filter(
        (item) => item.missing_required_field_keys.length > 0,
      ).length,
    },
    retained_source_gaps: profiles
      .filter((item) => item.missing_required_field_keys.length > 0)
      .map((item) => ({
        proposed_profile_key: item.proposed_profile_key,
        phase3_profile_key: item.phase3_profile_key,
        missing_required_field_keys: item.missing_required_field_keys,
      })),
    profile_review_items: profiles,
    source_bindings: {
      phase4_authority: PHASE4_AUTHORITY_BINDING,
      b9e_ruling: B9E_RULING_BINDING,
    },
  };
  return {
    ...unsigned,
    inventory_review_packet_id: contentId(PACKET_SCHEMA, unsigned),
  };
}

function parseArgs(argv) {
  const args = {
    mode: 'stage-b',
    phase4AuthorityPath: DEFAULT_PHASE4_AUTHORITY_PATH,
    outPath: DEFAULT_OUT_PATH,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--mode') {
      args.mode = argv[++index] ?? args.mode;
      continue;
    }
    if (token === '--phase4-authority') {
      args.phase4AuthorityPath = argv[++index] ?? args.phase4AuthorityPath;
      continue;
    }
    if (token === '--out') {
      args.outPath = argv[++index] ?? args.outPath;
      continue;
    }
    if (token === '--help' || token === '-h') {
      args.help = true;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }
  if (!['stage-b', 'phase4-schedule'].includes(args.mode)) {
    throw new Error(`Unsupported --mode ${args.mode}; use stage-b or phase4-schedule`);
  }
  return args;
}

function printHelp() {
  process.stdout.write(
    'Usage: node scripts/stage-2y-structure-m7-v2-termination-inventory-review-packet.mjs\n'
      + '  [--mode stage-b|phase4-schedule]\n'
      + '  [--phase4-authority <path>]\n'
      + '  [--out <path>]\n\n'
      + 'Default mode runs prepareTerminationWork3StageBBlueprintProposal with governed\n'
      + 'test fixtures. phase4-schedule reads profile_review_schedule only (no disclosure notes).\n',
  );
}

function writePacket(outPath, packet) {
  const absoluteOut = repoPath(outPath);
  mkdirSync(path.dirname(absoluteOut), { recursive: true });
  writeFileSync(absoluteOut, `${JSON.stringify(packet, null, 2)}\n`, 'utf8');
  return absoluteOut;
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  let packet;
  if (args.mode === 'stage-b') {
    const stageB = runStageBBlueprintProposal();
    packet = buildPacketFromStageB(stageB);
  } else {
    const authority = readRecord(args.phase4AuthorityPath);
    if (!Array.isArray(authority.profile_review_schedule)) {
      throw new Error('Phase4 authority missing profile_review_schedule');
    }
    if (authority.profile_review_schedule.length !== 45) {
      throw new Error(
        `Expected 45 schedule items, got ${authority.profile_review_schedule.length}`,
      );
    }
    packet = buildPacketFromPhase4Schedule(authority);
  }

  const writtenPath = writePacket(args.outPath, packet);
  const digest = sha256Hex(Buffer.from(canonicalJson(packet), 'utf8'));
  process.stdout.write(
    `${writtenPath}\n`
      + `inventory_review_packet_id=${packet.inventory_review_packet_id}\n`
      + `profile_count=${packet.profile_count}\n`
      + `complete=${packet.complete_profile_count} incomplete=${packet.incomplete_profile_count}\n`
      + `canonical_sha256=${digest}\n`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}

export {
  buildPacketFromPhase4Schedule,
  buildPacketFromStageB,
  buildStageBBlueprintInput,
  runStageBBlueprintProposal,
};
