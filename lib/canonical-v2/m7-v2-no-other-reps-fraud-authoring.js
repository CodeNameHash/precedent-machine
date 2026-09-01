'use strict';

/**
 * Family-local M7 V2 repair authoring for NO_OTHER_REPS_FRAUD (N1 family #8).
 *
 * Milestone A ladder, D&O-minimal path (Phase 3 reference chain skipped):
 *   Phase 2 partition -> Phase 4 package review -> Work3 inventory review ->
 *   Ben inventory session disposition -> family package seal -> registration.
 *
 * Deliberately self-contained: the shared spine (m7-v2-profile-authoring.js) is on a
 * separate merge track, so the helpers below are adapted copies rather than imports.
 *
 * The 36 profiles are claim-scale, one per governed comparator M4 claim across seven
 * comparator deals. Subtype grouping across the four sealed M5 candidate buckets is an
 * open legal question — the sealed role schema admits all three claim definition keys
 * under all four buckets — so every profile carries LEGAL_GROUPING_REVIEW_REQUIRED and
 * the family seal records PENDING_LEGAL_REVIEW rather than a resolved taxonomy.
 *
 * Two evidence-derived link flags ride alongside, neither of which assigns ownership:
 * SHARED_SOURCE_CITATION_LINK_ONLY (24 rows sharing one authored citation, Q01) and
 * CROSS_FAMILY_REPRESENTATIONS_LINK_ONLY (3 rows whose printed section also carries a
 * sealed REPRESENTATIONS terminal, Q02). The section classifier already suppresses
 * duplicate REPRESENTATIONS classification at M2 node level, and no NO_OTHER_REPS_FRAUD
 * terminal shares an M2 source node with a REPRESENTATIONS terminal.
 */

const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');

const NO_OTHER_REPS_FRAUD_PROFILE_COUNT = 36;
const NO_OTHER_REPS_FRAUD_SHARED_SOURCE_CITATION_PROFILE_COUNT = 24;
const NO_OTHER_REPS_FRAUD_CROSS_FAMILY_LINK_PROFILE_COUNT = 3;

const NO_OTHER_REPS_FRAUD_PHASE2_AUTHORITY_SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_CONTRACT_NO_OTHER_REPS_FRAUD_AUTHORING_PHASE2_AUTHORITY/V2';
const NO_OTHER_REPS_FRAUD_PHASE2_AUTHORITY_ID =
  '1ea23a5d981bb5597438dd9635981a06bc5193f09ac492f0642ea50d6218f9f5';
const NO_OTHER_REPS_FRAUD_PHASE2_AUTHORITY_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-no-other-reps-fraud-authoring-phase2-authority-v2.json';
const NO_OTHER_REPS_FRAUD_PHASE2_AUTHORITY_BYTES = 121883;
const NO_OTHER_REPS_FRAUD_PHASE2_AUTHORITY_SHA256 =
  '23de576cc600b31329022817b3cca7b2d6efb7703e96e5d06d8f74cd9b7d182e';

const NO_OTHER_REPS_FRAUD_PHASE2_PROPOSAL_CODES = Object.freeze({
  AUTHORITY: 'M7_V2_NO_OTHER_REPS_FRAUD_PHASE2_AUTHORITY',
  CONTRACT: 'M7_V2_NO_OTHER_REPS_FRAUD_PHASE2_PROPOSAL_CONTRACT',
  COVERAGE: 'M7_V2_NO_OTHER_REPS_FRAUD_PHASE2_SOURCE_COVERAGE',
});

const NO_OTHER_REPS_FRAUD_PHASE2_PROPOSAL_KEYS = Object.freeze([
  'schema_version',
  'proposal_id',
  'family_key',
  'proposal_state',
  'profile_approval_state',
  'authority_binding',
  'm4_claim_accounting',
  'source_terminal_coverage',
  'zero_m4_claim_gaps',
  'symbolic_temporal_graphs',
  'temporal_state_reference_edges',
  'authorised_rule_components',
  'proposed_partition',
  'derived_profile_count',
  'inventory_digest',
  'unresolved_items',
]);

function fail(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  throw error;
}

function compareStrings(left, right) {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function clone(value) {
  return structuredClone(value);
}

function deepFreeze(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value, expectedKeys) {
  return isObject(value)
    && canonicalJson(Object.keys(value).sort(compareStrings))
      === canonicalJson([...expectedKeys].sort(compareStrings));
}

function exactKeysOrFail(value, expectedKeys, code, label) {
  if (!exactKeys(value, expectedKeys)) {
    fail(code, `${label} has unexpected keys.`);
  }
}

function sameValue(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function sortedUnique(values) {
  return [...new Set(values)].sort(compareStrings);
}

function validateEnvelopeShape(envelope, code, label) {
  exactKeysOrFail(envelope, ['binding', 'record'], code, label);
  exactKeysOrFail(
    envelope.binding,
    ['byte_length', 'path', 'record_id', 'record_id_field', 'schema_version', 'sha256'],
    code,
    `${label} binding`,
  );
}

function boundSourceRecordBytes(record) {
  if (record.schema_version === 'STAGE_2Y_FAMILY_CALIBRATION_PACK/V1') {
    return Buffer.from(`${JSON.stringify(record, null, 2)}\n`, 'utf8');
  }
  return Buffer.from(`${canonicalJson(record)}\n`, 'utf8');
}

function validateBoundRecord(envelope, code, label) {
  let bytes;
  try {
    bytes = boundSourceRecordBytes(envelope.record);
  } catch {
    fail(code, `${label} is not canonical JSON data.`);
  }
  const { binding, record } = envelope;
  if (
    !Number.isSafeInteger(binding.byte_length)
    || binding.byte_length !== bytes.length
    || binding.sha256 !== sha256Hex(bytes)
    || record.schema_version !== binding.schema_version
    || record[binding.record_id_field] !== binding.record_id
  ) {
    fail(code, `${label} does not match its canonical record binding.`);
  }
}

function validateBoundSource(source, expectedBinding, code, label) {
  validateEnvelopeShape(source, code, label);
  exactKeysOrFail(
    source.binding,
    Object.keys(expectedBinding),
    code,
    `${label} binding`,
  );
  if (!sameValue(source.binding, expectedBinding)) {
    fail(code, `${label} binding does not match the Phase2 authority.`);
  }
  validateBoundRecord(source, code, label);
}

function validateNoOtherRepsFraudProposalAuthority(envelope) {
  const code = NO_OTHER_REPS_FRAUD_PHASE2_PROPOSAL_CODES.AUTHORITY;
  validateEnvelopeShape(envelope, code, 'Phase2 authority');
  validateBoundRecord(envelope, code, 'Phase2 authority');
  const { binding, record } = envelope;
  if (
    binding.byte_length !== NO_OTHER_REPS_FRAUD_PHASE2_AUTHORITY_BYTES
    || binding.path !== NO_OTHER_REPS_FRAUD_PHASE2_AUTHORITY_PATH
    || binding.record_id !== NO_OTHER_REPS_FRAUD_PHASE2_AUTHORITY_ID
    || binding.record_id_field !== 'no_other_reps_fraud_authoring_phase2_authority_id'
    || binding.schema_version !== NO_OTHER_REPS_FRAUD_PHASE2_AUTHORITY_SCHEMA
    || binding.sha256 !== NO_OTHER_REPS_FRAUD_PHASE2_AUTHORITY_SHA256
  ) {
    fail(code, 'Phase2 authority binding drift.');
  }
  if (
    record.schema_version !== NO_OTHER_REPS_FRAUD_PHASE2_AUTHORITY_SCHEMA
    || record.no_other_reps_fraud_authoring_phase2_authority_id
      !== NO_OTHER_REPS_FRAUD_PHASE2_AUTHORITY_ID
  ) {
    fail(code, 'Phase2 authority identity drift.');
  }
  const unsigned = { ...record };
  delete unsigned.no_other_reps_fraud_authoring_phase2_authority_id;
  if (
    contentId(record.schema_version, unsigned) !== NO_OTHER_REPS_FRAUD_PHASE2_AUTHORITY_ID
  ) {
    fail(code, 'Phase2 authority self identity drift.');
  }
  return deepFreeze(clone(envelope));
}

function noOtherRepsFraudAgreementSources(authority, agreementEvidenceByAgreementId) {
  const code = NO_OTHER_REPS_FRAUD_PHASE2_PROPOSAL_CODES.COVERAGE;
  if (!isObject(agreementEvidenceByAgreementId)) {
    fail(code, 'agreementEvidenceByAgreementId must be an object.');
  }
  const bindings = authority.immutable_parent_bindings.m2_m3_m4;
  const expectedAgreementIds = bindings
    .map((binding) => binding.agreement_id)
    .sort(compareStrings);
  const actualAgreementIds = Object.keys(agreementEvidenceByAgreementId).sort(compareStrings);
  if (!sameValue(actualAgreementIds, expectedAgreementIds)) {
    fail(code, 'Agreement evidence inventory does not match the Phase2 authority.');
  }
  const agreements = new Map();
  for (const binding of bindings) {
    const agreementId = binding.agreement_id;
    const evidence = agreementEvidenceByAgreementId[agreementId];
    exactKeysOrFail(
      evidence,
      ['canonicalTextIdentity', 'm2', 'm3', 'm4'],
      code,
      `Agreement evidence ${agreementId}`,
    );
    exactKeysOrFail(
      evidence.canonicalTextIdentity,
      ['canonical_text_id', 'canonical_text_byte_length', 'canonical_text_sha256'],
      code,
      `Canonical text identity ${agreementId}`,
    );
    const expectedCanonicalIdentity = {
      canonical_text_id: binding.canonical_text_id,
      canonical_text_byte_length: binding.canonical_text_byte_length,
      canonical_text_sha256: binding.canonical_text_sha256,
    };
    if (!sameValue(evidence.canonicalTextIdentity, expectedCanonicalIdentity)) {
      fail(code, `Canonical text identity drift for ${agreementId}.`);
    }
    validateBoundSource(evidence.m2, binding.m2, code, `M2 ${agreementId}`);
    validateBoundSource(evidence.m3, binding.m3, code, `M3 ${agreementId}`);
    validateBoundSource(evidence.m4, binding.m4, code, `M4 ${agreementId}`);
    if (!Array.isArray(evidence.m2.record.nodes)) {
      fail(code, `M2 nodes missing for ${agreementId}.`);
    }
    if (!Array.isArray(evidence.m4.record.claims)) {
      fail(code, `M4 claims missing for ${agreementId}.`);
    }
    const nodesById = new Map(
      evidence.m2.record.nodes.map((node) => [node.node_occurrence_id, node]),
    );
    const claimsById = new Map(
      evidence.m4.record.claims.map((claim) => [claim.analysis_claim_id, claim]),
    );
    agreements.set(agreementId, { nodesById, claimsById });
  }
  return agreements;
}

function validateNoOtherRepsFraudProposalGovernedSources(authority, governedSources) {
  const code = NO_OTHER_REPS_FRAUD_PHASE2_PROPOSAL_CODES.COVERAGE;
  exactKeysOrFail(
    governedSources,
    [
      'baseContractPolicy',
      'temporalPhase1Authority',
      'c3CorrectionAuthority',
      'work3Manifest',
      'familyRolePolicy',
      'calibrationPack',
      'agreementEvidenceByAgreementId',
    ],
    code,
    'governedSources',
  );
  const parents = authority.immutable_parent_bindings;
  const singletonSources = [
    ['baseContractPolicy', 'base_policy'],
    ['temporalPhase1Authority', 'phase1'],
    ['c3CorrectionAuthority', 'c3'],
    ['work3Manifest', 'work3_manifest'],
    ['familyRolePolicy', 'family_role_policy'],
    ['calibrationPack', 'calibration_pack'],
  ];
  for (const [sourceKey, bindingKey] of singletonSources) {
    validateBoundSource(
      governedSources[sourceKey],
      parents[bindingKey],
      code,
      sourceKey,
    );
  }
  return noOtherRepsFraudAgreementSources(
    authority,
    governedSources.agreementEvidenceByAgreementId,
  );
}

function validateNoOtherRepsFraudProposalSourceCoverage(authority, agreements) {
  const code = NO_OTHER_REPS_FRAUD_PHASE2_PROPOSAL_CODES.COVERAGE;
  const successor = authority.source_terminal_successor_contract;
  const terminals = successor.terminal_rule_registry;
  const expectedTerminalCount = successor.terminal_rule_registry_exact_count;
  if (!Array.isArray(terminals) || terminals.length !== expectedTerminalCount) {
    fail(
      code,
      `The terminal registry must contain exactly ${expectedTerminalCount} terminals.`,
    );
  }
  const classificationPaths = new Map(
    successor.classification_path_registry.map((entry) => [
      entry.classification_bucket,
      entry.classification_path,
    ]),
  );
  const sourceUnitIds = [];
  const claimIds = [];
  for (const terminal of terminals) {
    const agreement = agreements.get(terminal.agreement_id);
    if (!agreement) {
      fail(code, `Missing agreement proof for ${terminal.source_unit_key}.`);
    }
    if (
      !sameValue(
        classificationPaths.get(terminal.classification_bucket),
        terminal.classification_path,
      )
    ) {
      fail(code, `Classification path mismatch for ${terminal.source_unit_key}.`);
    }
    if (
      !Array.isArray(terminal.source_closure.members)
      || terminal.source_closure.members.length !== 1
    ) {
      fail(code, `Source closure missing for ${terminal.source_unit_key}.`);
    }
    if (terminal.m4_claim_ids.length !== 1) {
      fail(
        code,
        `Claim-scale terminal must bind exactly one M4 claim: ${terminal.source_unit_key}.`,
      );
    }
    const member = terminal.source_closure.members[0];
    const claim = agreement.claimsById.get(terminal.m4_claim_ids[0]);
    if (
      !claim
      || claim.agreement_id !== terminal.agreement_id
      || claim.family !== 'NO_OTHER_REPS_FRAUD'
      || claim.claim_definition_key !== member.claim_definition_key
      || claim.section_reference !== member.section_reference
    ) {
      fail(code, `Comparator closure claim mismatch for ${terminal.source_unit_key}.`);
    }
    claimIds.push(terminal.m4_claim_ids[0]);
    sourceUnitIds.push(terminal.source_unit_key);
  }
  const uniqueSourceUnitIds = sortedUnique(sourceUnitIds);
  const uniqueClaimIds = sortedUnique(claimIds);
  const expectedClaimCount = successor.admitted_m4_claim_exact_count;
  if (
    uniqueClaimIds.length !== expectedClaimCount
    || claimIds.length !== expectedClaimCount
    || uniqueSourceUnitIds.length !== sourceUnitIds.length
  ) {
    fail(code, `The exact ${expectedClaimCount} M4 claim inventory is not closed.`);
  }
  return {
    terminals,
    sourceUnitIds: uniqueSourceUnitIds,
    claimIds: uniqueClaimIds,
  };
}

function noOtherRepsFraudProposalCoverageRecords(authority, coverage) {
  const assignments = [...coverage.terminals]
    .sort((left, right) => compareStrings(left.source_unit_key, right.source_unit_key))
    .map((terminal) => ({
      source_unit_key: terminal.source_unit_key,
      classification_bucket: terminal.classification_bucket,
      source_row_keys: [terminal.source_unit_key],
      m4_claim_ids: sortedUnique(terminal.m4_claim_ids),
      m4_silent_source_row_keys: sortedUnique(terminal.m4_silent_source_row_keys),
    }));
  const classificationBuckets =
    authority.implementation_contract.output_member_contracts.source_terminal_coverage
      .classification_buckets;
  return {
    claimAccounting: {
      state: 'COMPLETE',
      expected_claim_ids: [...coverage.claimIds],
      accounted_claim_ids: [...coverage.claimIds],
      expected_count: coverage.claimIds.length,
      accounted_count: coverage.claimIds.length,
      claim_ids_sha256: sha256Hex(canonicalJson(coverage.claimIds)),
    },
    sourceCoverage: {
      state: 'COMPLETE',
      classification_buckets: [...classificationBuckets],
      source_unit_assignments: assignments,
      expected_source_unit_ids: [...coverage.sourceUnitIds],
      accounted_source_unit_ids: [...coverage.sourceUnitIds],
      expected_count: coverage.sourceUnitIds.length,
      accounted_count: coverage.sourceUnitIds.length,
    },
  };
}

function noOtherRepsFraudProposalPartition(coverage) {
  const groups = new Map();
  for (const terminal of coverage.terminals) {
    const canonicalTuple = {
      classification_path: terminal.classification_path,
      required_expression_signature: terminal.required_expression_signature,
    };
    const tupleKey = canonicalJson(canonicalTuple);
    let group = groups.get(tupleKey);
    if (!group) {
      group = {
        canonicalTuple,
        sourceUnitKeys: [],
        claimIds: [],
      };
      groups.set(tupleKey, group);
    }
    group.sourceUnitKeys.push(terminal.source_unit_key);
    group.claimIds.push(...terminal.m4_claim_ids);
  }
  const proposedProfiles = [...groups.values()].map((group) => ({
    proposed_profile_key: sha256Hex(canonicalJson(group.canonicalTuple)),
    canonical_tuple: group.canonicalTuple,
    source_unit_keys: sortedUnique(group.sourceUnitKeys),
    m4_claim_ids: sortedUnique(group.claimIds),
    authorised_component_ids: [],
  }));
  proposedProfiles.sort((left, right) =>
    compareStrings(left.proposed_profile_key, right.proposed_profile_key),
  );
  return {
    proposed_profiles: proposedProfiles,
    source_unit_assignment_count: coverage.sourceUnitIds.length,
    m4_claim_assignment_count: coverage.claimIds.length,
  };
}

function noOtherRepsFraudProposalInventoryDigest(coverage, proposedPartition) {
  const tuplesByCanonical = new Map();
  for (const profile of proposedPartition.proposed_profiles) {
    tuplesByCanonical.set(
      canonicalJson(profile.canonical_tuple),
      profile.canonical_tuple,
    );
  }
  const proposedProfileTuples = [...tuplesByCanonical.entries()]
    .sort(([left], [right]) => compareStrings(left, right))
    .map(([, tuple]) => tuple);
  const digestInput = {
    m4_claim_ids: coverage.claimIds,
    source_unit_ids: coverage.sourceUnitIds,
    authorised_component_ids: [],
    proposed_profile_tuples: proposedProfileTuples,
  };
  return sha256Hex(canonicalJson(digestInput));
}

function prepareNoOtherRepsFraudPhase2FamilyProposal(input) {
  const contractCode = NO_OTHER_REPS_FRAUD_PHASE2_PROPOSAL_CODES.CONTRACT;
  exactKeysOrFail(
    input,
    ['noOtherRepsFraudAuthoringPhase2Authority', 'governedSources'],
    contractCode,
    'No other reps proposal input',
  );
  const authorityEnvelope = validateNoOtherRepsFraudProposalAuthority(
    input.noOtherRepsFraudAuthoringPhase2Authority,
  );
  const authority = authorityEnvelope.record;
  const agreements = validateNoOtherRepsFraudProposalGovernedSources(
    authority,
    input.governedSources,
  );
  const coverage = validateNoOtherRepsFraudProposalSourceCoverage(authority, agreements);
  const accounting = noOtherRepsFraudProposalCoverageRecords(authority, coverage);
  const proposedPartition = noOtherRepsFraudProposalPartition(coverage);
  const authorityBinding = {
    path: authorityEnvelope.binding.path,
    schema_version: authorityEnvelope.binding.schema_version,
    record_id_field: authorityEnvelope.binding.record_id_field,
    record_id: authorityEnvelope.binding.record_id,
    byte_length: authorityEnvelope.binding.byte_length,
    sha256: authorityEnvelope.binding.sha256,
  };
  const unresolvedItems = [
    'EXACT_PROFILE_INVENTORY_REQUIRES_SEPARATE_APPROVAL',
    'LEGAL_GROUPING_REVIEW_REQUIRED',
    'NO_OTHER_REPS_FRAUD_Q01_Q02_Q03_OPEN_REQUIRES_BEN_RULING',
  ].sort(compareStrings);
  const unsignedProposal = {
    schema_version: 'M7_V2_NO_OTHER_REPS_FRAUD_FAMILY_PROPOSAL/V1',
    family_key: 'NO_OTHER_REPS_FRAUD',
    proposal_state: 'TREE_OUTPUT_INCOMPLETE',
    profile_approval_state: 'UNAPPROVED',
    authority_binding: authorityBinding,
    m4_claim_accounting: accounting.claimAccounting,
    source_terminal_coverage: accounting.sourceCoverage,
    zero_m4_claim_gaps: true,
    symbolic_temporal_graphs: [],
    temporal_state_reference_edges: [],
    authorised_rule_components: [],
    proposed_partition: proposedPartition,
    derived_profile_count: proposedPartition.proposed_profiles.length,
    inventory_digest: noOtherRepsFraudProposalInventoryDigest(coverage, proposedPartition),
    unresolved_items: unresolvedItems,
  };
  const proposal = {
    schema_version: unsignedProposal.schema_version,
    proposal_id: contentId(unsignedProposal.schema_version, unsignedProposal),
    family_key: unsignedProposal.family_key,
    proposal_state: unsignedProposal.proposal_state,
    profile_approval_state: unsignedProposal.profile_approval_state,
    authority_binding: unsignedProposal.authority_binding,
    m4_claim_accounting: unsignedProposal.m4_claim_accounting,
    source_terminal_coverage: unsignedProposal.source_terminal_coverage,
    zero_m4_claim_gaps: unsignedProposal.zero_m4_claim_gaps,
    symbolic_temporal_graphs: unsignedProposal.symbolic_temporal_graphs,
    temporal_state_reference_edges: unsignedProposal.temporal_state_reference_edges,
    authorised_rule_components: unsignedProposal.authorised_rule_components,
    proposed_partition: unsignedProposal.proposed_partition,
    derived_profile_count: unsignedProposal.derived_profile_count,
    inventory_digest: unsignedProposal.inventory_digest,
    unresolved_items: unsignedProposal.unresolved_items,
  };
  return deepFreeze(clone(proposal));
}

const NO_OTHER_REPS_FRAUD_PHASE4_AUTHORITY_SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_CONTRACT_NO_OTHER_REPS_FRAUD_AUTHORING_PHASE4_FAMILY_PROFILE_PACKAGE_REVIEW_AUTHORITY/V1';
const NO_OTHER_REPS_FRAUD_PHASE4_AUTHORITY_ID =
  'f94e967f88e309c2800196b914215fda907e665fbec0acd8cb58270364783366';
const NO_OTHER_REPS_FRAUD_PHASE4_AUTHORITY_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-no-other-reps-fraud-authoring-phase4-family-profile-package-review-authority.json';
const NO_OTHER_REPS_FRAUD_PHASE4_AUTHORITY_BYTES = 46207;
const NO_OTHER_REPS_FRAUD_PHASE4_AUTHORITY_SHA256 =
  '252de1fa9cb89cdfe631d8438e313eaf20376f035bd55f3175dcb555eb90216a';
const NO_OTHER_REPS_FRAUD_PHASE4_SCHEDULE_SHA256 =
  'e741a8f345e7c88550b9a08e208b9c4ea7f383e4f9a1e5450f7de95ee25a1abe';
const NO_OTHER_REPS_FRAUD_PHASE4_CANDIDATE_SCHEMA =
  'M7_V2_NO_OTHER_REPS_FRAUD_PHASE4_FAMILY_PROFILE_PACKAGE_REVIEW_CANDIDATE/V1';
const NO_OTHER_REPS_FRAUD_PHASE4_CANDIDATE_STATE =
  'REVIEW_ONLY_36_PROFILES_UNAPPROVED_AWAITING_BEN_INVENTORY';

const NO_OTHER_REPS_FRAUD_PHASE4_REVIEW_CODES = Object.freeze({
  CONTRACT: 'M7_V2_NO_OTHER_REPS_FRAUD_PHASE4_REVIEW_CONTRACT',
  AUTHORITY: 'M7_V2_NO_OTHER_REPS_FRAUD_PHASE4_REVIEW_AUTHORITY',
  PHASE2_PROPOSAL: 'M7_V2_NO_OTHER_REPS_FRAUD_PHASE4_PHASE2_PROPOSAL',
  PROFILE_SCHEDULE: 'M7_V2_NO_OTHER_REPS_FRAUD_PHASE4_PROFILE_SCHEDULE',
  REVIEW_OUTPUT: 'M7_V2_NO_OTHER_REPS_FRAUD_PHASE4_REVIEW_OUTPUT',
});

const NO_OTHER_REPS_FRAUD_PHASE4_REVIEW_INPUT_KEYS = Object.freeze([
  'noOtherRepsFraudAuthoringPhase4FamilyProfilePackageReviewAuthority',
  'noOtherRepsFraudAuthoringPhase2Authority',
  'governedSources',
]);

const NO_OTHER_REPS_FRAUD_PHASE4_REVIEW_OUTPUT_KEYS = Object.freeze([
  'schema_version',
  'review_candidate_id',
  'family_key',
  'candidate_state',
  'profile_approval_state',
  'authority_binding',
  'phase2_proposal_reference',
  'proposed_profiles',
  'review_accounting',
  'unresolved_items',
  'withheld_work3_fields',
  'first_legal_stop',
  'zero_effect_boundary',
]);

const NO_OTHER_REPS_FRAUD_PHASE4_AUTHORITY_ROOT_KEYS = Object.freeze([
  'authority_classification',
  'authority_state',
  'candidate_output_contract',
  'design_basis',
  'execution_schedule',
  'first_legal_stop_contract',
  'forbidden_output_contract',
  'immutable_parent_bindings',
  'implementation_contract',
  'no_other_reps_fraud_authoring_phase4_family_profile_package_review_authority_id',
  'profile_review_schedule',
  'profile_review_schedule_contract',
  'schema_version',
  'zero_effect_boundary',
]);

function noOtherRepsFraudPhase4ExpectedParentBindings() {
  return {
    no_other_reps_fraud_authoring_phase2_authority: {
      byte_length: NO_OTHER_REPS_FRAUD_PHASE2_AUTHORITY_BYTES,
      path: NO_OTHER_REPS_FRAUD_PHASE2_AUTHORITY_PATH,
      record_id: NO_OTHER_REPS_FRAUD_PHASE2_AUTHORITY_ID,
      record_id_field: 'no_other_reps_fraud_authoring_phase2_authority_id',
      schema_version: NO_OTHER_REPS_FRAUD_PHASE2_AUTHORITY_SCHEMA,
      sha256: NO_OTHER_REPS_FRAUD_PHASE2_AUTHORITY_SHA256,
    },
  };
}

function noOtherRepsFraudContainsForbiddenKey(value, forbiddenKeys, seen = new Set()) {
  if (!value || typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) {
    return value.some((member) => noOtherRepsFraudContainsForbiddenKey(
      member,
      forbiddenKeys,
      seen,
    ));
  }
  for (const [key, member] of Object.entries(value)) {
    if (forbiddenKeys.has(key)) return true;
    if (noOtherRepsFraudContainsForbiddenKey(member, forbiddenKeys, seen)) return true;
  }
  return false;
}

function validateNoOtherRepsFraudPhase4FamilyProfilePackageReviewAuthority(envelope) {
  const code = NO_OTHER_REPS_FRAUD_PHASE4_REVIEW_CODES.AUTHORITY;
  validateEnvelopeShape(envelope, code, 'Phase4 family profile package review authority');
  const { binding, record } = envelope;
  if (
    binding.byte_length !== NO_OTHER_REPS_FRAUD_PHASE4_AUTHORITY_BYTES
    || binding.path !== NO_OTHER_REPS_FRAUD_PHASE4_AUTHORITY_PATH
    || binding.record_id !== NO_OTHER_REPS_FRAUD_PHASE4_AUTHORITY_ID
    || binding.record_id_field
      !== 'no_other_reps_fraud_authoring_phase4_family_profile_package_review_authority_id'
    || binding.schema_version !== NO_OTHER_REPS_FRAUD_PHASE4_AUTHORITY_SCHEMA
    || binding.sha256 !== NO_OTHER_REPS_FRAUD_PHASE4_AUTHORITY_SHA256
  ) {
    fail(code, 'Phase4 family profile package review authority binding drift.');
  }
  validateBoundRecord(
    envelope,
    code,
    'Phase4 family profile package review authority',
  );
  if (
    !exactKeys(record, NO_OTHER_REPS_FRAUD_PHASE4_AUTHORITY_ROOT_KEYS)
    || record.schema_version !== NO_OTHER_REPS_FRAUD_PHASE4_AUTHORITY_SCHEMA
    || record.no_other_reps_fraud_authoring_phase4_family_profile_package_review_authority_id
      !== NO_OTHER_REPS_FRAUD_PHASE4_AUTHORITY_ID
  ) {
    fail(code, 'Phase4 family profile package review authority identity drift.');
  }
  const unsigned = { ...record };
  delete unsigned
    .no_other_reps_fraud_authoring_phase4_family_profile_package_review_authority_id;
  if (
    contentId(record.schema_version, unsigned) !== NO_OTHER_REPS_FRAUD_PHASE4_AUTHORITY_ID
  ) {
    fail(code, 'Phase4 family profile package review authority self identity drift.');
  }

  const implementation = record.implementation_contract;
  const output = record.candidate_output_contract;
  const scheduleContract = record.profile_review_schedule_contract;
  const schedule = record.profile_review_schedule;
  const expectedErrorCodes = Object.values(NO_OTHER_REPS_FRAUD_PHASE4_REVIEW_CODES);
  let scheduleBytes;
  try {
    scheduleBytes = Buffer.from(canonicalJson(schedule), 'utf8');
  } catch {
    fail(code, 'Phase4 family profile package review schedule is not canonical.');
  }
  if (
    !isObject(implementation)
    || !isObject(output)
    || !isObject(scheduleContract)
    || !Array.isArray(schedule)
    || !sameValue(
      record.immutable_parent_bindings,
      noOtherRepsFraudPhase4ExpectedParentBindings(),
    )
    || !sameValue(
      implementation.exact_outer_input_keys,
      NO_OTHER_REPS_FRAUD_PHASE4_REVIEW_INPUT_KEYS,
    )
    || implementation.exported_function
      !== 'prepareNoOtherRepsFraudFamilyProfilePackageReview'
    || implementation.phase2_internal_function
      !== 'prepareNoOtherRepsFraudPhase2FamilyProposal'
    || implementation.phase3_internal_function !== null
    || implementation.caller_produced_candidate_input_forbidden !== true
    || !Array.isArray(implementation.error_precedence)
    || implementation.error_precedence.length !== expectedErrorCodes.length
    || implementation.error_precedence.some((entry, index) => (
      entry.order !== index + 1 || entry.code !== expectedErrorCodes[index]
    ))
    || output.schema_version !== NO_OTHER_REPS_FRAUD_PHASE4_CANDIDATE_SCHEMA
    || output.record_id_field !== 'review_candidate_id'
    || output.candidate_state !== NO_OTHER_REPS_FRAUD_PHASE4_CANDIDATE_STATE
    || output.profile_approval_state !== 'UNAPPROVED'
    || !sameValue(output.exact_keys, NO_OTHER_REPS_FRAUD_PHASE4_REVIEW_OUTPUT_KEYS)
    || schedule.length !== NO_OTHER_REPS_FRAUD_PROFILE_COUNT
    || scheduleContract.exact_profile_count !== NO_OTHER_REPS_FRAUD_PROFILE_COUNT
    || scheduleContract.exact_complete_profile_count !== NO_OTHER_REPS_FRAUD_PROFILE_COUNT
    || scheduleContract.exact_incomplete_profile_count !== 0
    || scheduleContract.schedule_canonical_json_sha256
      !== NO_OTHER_REPS_FRAUD_PHASE4_SCHEDULE_SHA256
    || sha256Hex(scheduleBytes) !== NO_OTHER_REPS_FRAUD_PHASE4_SCHEDULE_SHA256
    || scheduleContract.schedule_canonical_json_byte_length !== scheduleBytes.length
  ) {
    fail(code, 'Phase4 family profile package review authority contract drift.');
  }
  return deepFreeze(clone(envelope));
}

function noOtherRepsFraudPhase4ValidatePhase2Proposal(proposal) {
  const code = NO_OTHER_REPS_FRAUD_PHASE4_REVIEW_CODES.PHASE2_PROPOSAL;
  if (
    !isObject(proposal)
    || proposal.schema_version !== 'M7_V2_NO_OTHER_REPS_FRAUD_FAMILY_PROPOSAL/V1'
    || proposal.family_key !== 'NO_OTHER_REPS_FRAUD'
    || proposal.profile_approval_state !== 'UNAPPROVED'
    || proposal.source_terminal_coverage.accounted_count !== NO_OTHER_REPS_FRAUD_PROFILE_COUNT
    || proposal.m4_claim_accounting.accounted_count !== NO_OTHER_REPS_FRAUD_PROFILE_COUNT
    || proposal.derived_profile_count !== NO_OTHER_REPS_FRAUD_PROFILE_COUNT
    || !Array.isArray(proposal.proposed_partition.proposed_profiles)
    || proposal.proposed_partition.proposed_profiles.length
      !== NO_OTHER_REPS_FRAUD_PROFILE_COUNT
    || proposal.proposed_partition.source_unit_assignment_count
      !== NO_OTHER_REPS_FRAUD_PROFILE_COUNT
    || proposal.proposed_partition.m4_claim_assignment_count
      !== NO_OTHER_REPS_FRAUD_PROFILE_COUNT
  ) {
    fail(code, 'Phase4 fresh Phase2 proposal drift.');
  }
  const unsigned = { ...proposal };
  delete unsigned.proposal_id;
  if (contentId(proposal.schema_version, unsigned) !== proposal.proposal_id) {
    fail(code, 'Phase4 fresh Phase2 proposal identity drift.');
  }
}

function noOtherRepsFraudPhase4DeriveProfiles(authority, phase2Proposal) {
  const scheduleCode = NO_OTHER_REPS_FRAUD_PHASE4_REVIEW_CODES.PROFILE_SCHEDULE;
  const schedule = authority.profile_review_schedule;
  const scheduleContract = authority.profile_review_schedule_contract;
  const outputContract = authority.candidate_output_contract;
  const phase2Profiles = [...phase2Proposal.proposed_partition.proposed_profiles]
    .sort((left, right) => compareStrings(
      left.proposed_profile_key,
      right.proposed_profile_key,
    ));
  const proposedProfileKeys = phase2Profiles.map(
    (profile) => profile.proposed_profile_key,
  );
  if (
    !sameValue(proposedProfileKeys, schedule.map((profile) => profile.proposed_profile_key))
  ) {
    fail(scheduleCode, 'Phase4 profile schedule order drift.');
  }

  return phase2Profiles.map((phase2Profile, index) => {
    const expected = schedule[index];
    if (
      !exactKeys(
        phase2Profile.canonical_tuple,
        scheduleContract.canonical_tuple_base_exact_keys,
      )
      || expected.proposed_profile_key !== phase2Profile.proposed_profile_key
      || expected.package_profile_key
        !== [
          'PROFILE',
          'NO_OTHER_REPS_FRAUD',
          phase2Profile.canonical_tuple.classification_path[1],
          phase2Profile.proposed_profile_key,
        ].join(':')
      || !sameValue(expected.canonical_tuple, phase2Profile.canonical_tuple)
      || !sameValue(expected.source_unit_keys, phase2Profile.source_unit_keys)
      || !sameValue(expected.m4_claim_ids, phase2Profile.m4_claim_ids)
    ) {
      fail(scheduleCode, 'Phase4 tuple or profile binding drift.');
    }
    return Object.fromEntries(outputContract.profile_exact_keys.map((key) => {
      if (key === 'package_profile_key') {
        return [key, expected.package_profile_key];
      }
      if (key === 'proposed_validation') {
        return [key, clone(expected.proposed_validation)];
      }
      if (key === 'review_flags') {
        return [key, clone(expected.review_flags)];
      }
      if (key === 'missing_required_field_keys') {
        return [key, clone(expected.missing_required_field_keys)];
      }
      if (key === 'authorised_component_ids') {
        return [key, clone(phase2Profile.authorised_component_ids)];
      }
      if (key === 'canonical_tuple') {
        return [key, clone(phase2Profile.canonical_tuple)];
      }
      if (key === 'm4_claim_ids') {
        return [key, clone(phase2Profile.m4_claim_ids)];
      }
      if (key === 'source_unit_keys') {
        return [key, clone(phase2Profile.source_unit_keys)];
      }
      return [key, phase2Profile.proposed_profile_key];
    }));
  });
}

function prepareNoOtherRepsFraudFamilyProfilePackageReview(input) {
  const contractCode = NO_OTHER_REPS_FRAUD_PHASE4_REVIEW_CODES.CONTRACT;
  exactKeysOrFail(
    input,
    NO_OTHER_REPS_FRAUD_PHASE4_REVIEW_INPUT_KEYS,
    contractCode,
    'No other reps Phase4 package review input',
  );
  const authorityEnvelope =
    validateNoOtherRepsFraudPhase4FamilyProfilePackageReviewAuthority(
      input.noOtherRepsFraudAuthoringPhase4FamilyProfilePackageReviewAuthority,
    );
  const authority = authorityEnvelope.record;
  const phase2AuthorityEnvelope = validateNoOtherRepsFraudProposalAuthority(
    input.noOtherRepsFraudAuthoringPhase2Authority,
  );
  if (
    phase2AuthorityEnvelope.binding.record_id
      !== authority.immutable_parent_bindings
        .no_other_reps_fraud_authoring_phase2_authority.record_id
  ) {
    fail(
      NO_OTHER_REPS_FRAUD_PHASE4_REVIEW_CODES.AUTHORITY,
      'Phase4 parent Phase2 authority pin drift.',
    );
  }
  validateNoOtherRepsFraudProposalGovernedSources(
    phase2AuthorityEnvelope.record,
    input.governedSources,
  );

  let phase2Proposal;
  try {
    phase2Proposal = prepareNoOtherRepsFraudPhase2FamilyProposal({
      noOtherRepsFraudAuthoringPhase2Authority:
        input.noOtherRepsFraudAuthoringPhase2Authority,
      governedSources: input.governedSources,
    });
  } catch (error) {
    fail(
      NO_OTHER_REPS_FRAUD_PHASE4_REVIEW_CODES.PHASE2_PROPOSAL,
      'Phase4 fresh Phase2 proposal failed.',
      { cause_code: typeof error.code === 'string' ? error.code : null },
    );
  }
  noOtherRepsFraudPhase4ValidatePhase2Proposal(phase2Proposal);
  const proposedProfiles = noOtherRepsFraudPhase4DeriveProfiles(authority, phase2Proposal);
  const authorityBinding = {
    path: authorityEnvelope.binding.path,
    schema_version: authorityEnvelope.binding.schema_version,
    record_id_field: authorityEnvelope.binding.record_id_field,
    record_id: authorityEnvelope.binding.record_id,
    byte_length: authorityEnvelope.binding.byte_length,
    sha256: authorityEnvelope.binding.sha256,
  };
  const outputContract = authority.candidate_output_contract;
  const unsignedCandidate = {
    schema_version: NO_OTHER_REPS_FRAUD_PHASE4_CANDIDATE_SCHEMA,
    family_key: 'NO_OTHER_REPS_FRAUD',
    candidate_state: outputContract.candidate_state,
    profile_approval_state: outputContract.profile_approval_state,
    authority_binding: clone(authorityBinding),
    phase2_proposal_reference: {
      schema_version: phase2Proposal.schema_version,
      proposal_id: phase2Proposal.proposal_id,
      source_unit_count: phase2Proposal.source_terminal_coverage.accounted_count,
      claim_count: phase2Proposal.m4_claim_accounting.accounted_count,
      derived_profile_count: phase2Proposal.derived_profile_count,
    },
    proposed_profiles: clone(proposedProfiles),
    review_accounting: clone(outputContract.review_accounting_exact_values),
    unresolved_items: clone(outputContract.unresolved_items),
    withheld_work3_fields: clone(outputContract.withheld_work3_fields),
    first_legal_stop: clone(authority.first_legal_stop_contract),
    zero_effect_boundary: clone(authority.zero_effect_boundary),
  };
  const candidate = {
    schema_version: unsignedCandidate.schema_version,
    review_candidate_id: contentId(
      unsignedCandidate.schema_version,
      unsignedCandidate,
    ),
    family_key: unsignedCandidate.family_key,
    candidate_state: unsignedCandidate.candidate_state,
    profile_approval_state: unsignedCandidate.profile_approval_state,
    authority_binding: unsignedCandidate.authority_binding,
    phase2_proposal_reference: unsignedCandidate.phase2_proposal_reference,
    proposed_profiles: unsignedCandidate.proposed_profiles,
    review_accounting: unsignedCandidate.review_accounting,
    unresolved_items: unsignedCandidate.unresolved_items,
    withheld_work3_fields: unsignedCandidate.withheld_work3_fields,
    first_legal_stop: unsignedCandidate.first_legal_stop,
    zero_effect_boundary: unsignedCandidate.zero_effect_boundary,
  };
  const forbiddenKeys = new Set(
    authority.forbidden_output_contract.recursively_forbidden_candidate_keys,
  );
  if (
    !exactKeys(candidate, NO_OTHER_REPS_FRAUD_PHASE4_REVIEW_OUTPUT_KEYS)
    || proposedProfiles.length !== NO_OTHER_REPS_FRAUD_PROFILE_COUNT
    || proposedProfiles.some((profile) => (
      !exactKeys(profile, outputContract.profile_exact_keys)
      || !exactKeys(
        profile.proposed_validation,
        outputContract.proposed_validation_exact_keys,
      )
      || !profile.review_flags.includes('LEGAL_GROUPING_REVIEW_REQUIRED')
    ))
    || !sameValue(candidate.review_accounting, outputContract.review_accounting_exact_values)
    || !sameValue(candidate.unresolved_items, outputContract.unresolved_items)
    || !sameValue(candidate.withheld_work3_fields, outputContract.withheld_work3_fields)
    || !sameValue(candidate.first_legal_stop, authority.first_legal_stop_contract)
    || !sameValue(candidate.zero_effect_boundary, authority.zero_effect_boundary)
    || noOtherRepsFraudContainsForbiddenKey(candidate, forbiddenKeys)
  ) {
    fail(
      NO_OTHER_REPS_FRAUD_PHASE4_REVIEW_CODES.REVIEW_OUTPUT,
      'Phase4 package review output boundary drift.',
    );
  }
  return deepFreeze(clone(candidate));
}

const NO_OTHER_REPS_FRAUD_WORK3_CONTROL_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control';
const NO_OTHER_REPS_FRAUD_WORK3_RULINGS_BINDING = Object.freeze({
  byte_length: 7536,
  path: 'docs/codex-program/notes/NO-OTHER-REPS-FRAUD-BEN-RULINGS-Q01-Q03-2026-08-24.md',
  sha256: '39237140365a260269a71802562e479e9ff756f15d80d9b6af26ed5df0366820',
});
const NO_OTHER_REPS_FRAUD_WORK3_INVENTORY_AUTHORITY_BINDING = Object.freeze({
  byte_length: 2030,
  path: `${NO_OTHER_REPS_FRAUD_WORK3_CONTROL_PATH}/m7-v2-repair-contract-work3-no-other-reps-fraud-unapproved-inventory-review-authority.json`,
  record_id: '2429271c479b65d107ddc02efa4b3ddf14fafad4a87921cbb2bf9d7d155132cc',
  record_id_field: 'work3_no_other_reps_fraud_unapproved_inventory_review_authority_id',
  schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_NO_OTHER_REPS_FRAUD_UNAPPROVED_INVENTORY_REVIEW_AUTHORITY/V1',
  sha256: '5efb4345043cfb422f23d1826308b8e6da958c35809ae46d3bd6452d27212329',
});
const NO_OTHER_REPS_FRAUD_WORK3_PACKET_BINDING = Object.freeze({
  byte_length: 52906,
  path: `${NO_OTHER_REPS_FRAUD_WORK3_CONTROL_PATH}/m7-v2-repair-no-other-reps-fraud-36-profile-inventory-review-packet-draft.json`,
  record_id: '4f70e99c2d8d6f71be732f23f969f67077a8a54be64715baad19b2c792dc29f7',
  record_id_field: 'inventory_review_packet_id',
  schema_version: 'STAGE_2Y_M7_V2_NO_OTHER_REPS_FRAUD_36_PROFILE_INVENTORY_REVIEW_PACKET/V1',
  sha256: '4f9c1f88ce1caa35577fe82da7de2ea68dac871f8f45b8509ffd79fe053801bf',
});
const NO_OTHER_REPS_FRAUD_WORK3_DISPOSITION_BINDING = Object.freeze({
  byte_length: 14249,
  path: `${NO_OTHER_REPS_FRAUD_WORK3_CONTROL_PATH}/m7-v2-repair-no-other-reps-fraud-36-profile-inventory-disposition.json`,
  record_id: 'b4ebd739e11d2a09e835af4674e3ee2938f6b00851544454ea3c9713444f7b70',
  record_id_field: 'inventory_disposition_id',
  schema_version: 'STAGE_2Y_M7_V2_NO_OTHER_REPS_FRAUD_36_PROFILE_INVENTORY_DISPOSITION/V1',
  sha256: '1f1ae30bbcdf0fa271c4378983db9a85d5c5cafd0064220ac3ae036f56930c61',
});
const NO_OTHER_REPS_FRAUD_WORK3_SESSION_BINDING = Object.freeze({
  byte_length: 1142,
  path: `${NO_OTHER_REPS_FRAUD_WORK3_CONTROL_PATH}/m7-v2-repair-no-other-reps-fraud-ben-inventory-session-receipt.json`,
  record_id: '69f00e73da1b463e0b605f9dc80581e6c1c417ecef251e2524ab2db3afef2dc5',
  record_id_field: 'ben_inventory_session_receipt_id',
  schema_version: 'STAGE_2Y_M7_V2_NO_OTHER_REPS_FRAUD_BEN_INVENTORY_SESSION_RECEIPT/V1',
  sha256: 'ff9b6c383bc65b87e6651bcd065e7e75823b64a6c42cefb82739501e45bb2988',
});
const NO_OTHER_REPS_FRAUD_WORK3_BEN_AUTHORITY_BINDING = Object.freeze({
  byte_length: 2943,
  path: `${NO_OTHER_REPS_FRAUD_WORK3_CONTROL_PATH}/m7-v2-repair-contract-work3-no-other-reps-fraud-ben-inventory-session-successor-authority.json`,
  record_id: '3d17a94abf7431b45d4aa11aa25cb58f2475c789c551727d4312fd07fbc78a73',
  record_id_field: 'work3_no_other_reps_fraud_ben_inventory_session_successor_authority_id',
  schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_NO_OTHER_REPS_FRAUD_BEN_INVENTORY_SESSION_SUCCESSOR_AUTHORITY/V1',
  sha256: 'c2430ff44223f3521a2cdbd97324af6446f0f279c04e348f7e43f8b1bcd17ff6',
});
const NO_OTHER_REPS_FRAUD_WORK3_SEAL_AUTHORITY_BINDING = Object.freeze({
  byte_length: 3473,
  path: `${NO_OTHER_REPS_FRAUD_WORK3_CONTROL_PATH}/m7-v2-repair-contract-work3-no-other-reps-fraud-family-package-seal-successor-authority.json`,
  record_id: 'c3f2eb38f56da216c44a65efe5f0ce2591dc4a22e4fc34ba99b7ecc2086b82f0',
  record_id_field: 'work3_no_other_reps_fraud_family_package_seal_successor_authority_id',
  schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_NO_OTHER_REPS_FRAUD_FAMILY_PACKAGE_SEAL_SUCCESSOR_AUTHORITY/V1',
  sha256: '5076f9cb58191f2b6a37f72e1b873ee74d395a9709ca7c12a1c00a3274c87a15',
});
const NO_OTHER_REPS_FRAUD_WORK3_SEAL_RECEIPT_BINDING = Object.freeze({
  byte_length: 2224,
  path: `${NO_OTHER_REPS_FRAUD_WORK3_CONTROL_PATH}/m7-v2-repair-no-other-reps-fraud-family-package-seal-receipt.json`,
  record_id: 'b20fe5bf6a1ad2d43a21b97547de21a720efd0d14acb4b5bc04b4cbf4bdd43c0',
  record_id_field: 'no_other_reps_fraud_family_package_seal_receipt_id',
  schema_version: 'STAGE_2Y_M7_V2_NO_OTHER_REPS_FRAUD_FAMILY_PACKAGE_SEAL_RECEIPT/V1',
  sha256: '44475eb645a18fc7a7eef2996bb79c3625a571f5a0b149b3211fa532cc0c76b1',
});
const NO_OTHER_REPS_FRAUD_WORK3_REGISTRATION_AUTHORITY_BINDING = Object.freeze({
  byte_length: 3046,
  path: `${NO_OTHER_REPS_FRAUD_WORK3_CONTROL_PATH}/m7-v2-repair-contract-work3-no-other-reps-fraud-registration-successor-authority.json`,
  record_id: 'f8bd2cb7ce4a4b7aed28717c32196326c2c6d92511474b7b6c95dd17c7e2ce5e',
  record_id_field: 'work3_no_other_reps_fraud_registration_successor_authority_id',
  schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_NO_OTHER_REPS_FRAUD_REGISTRATION_SUCCESSOR_AUTHORITY/V1',
  sha256: 'b7da7cbd6d53815b95ca0c389ca360b5310542140f463104bd62b5595d2c7923',
});

const NO_OTHER_REPS_FRAUD_WORK3_CODES = Object.freeze({
  CONTRACT: 'M7_V2_NO_OTHER_REPS_FRAUD_WORK3_CONTRACT',
  AUTHORITY: 'M7_V2_NO_OTHER_REPS_FRAUD_WORK3_AUTHORITY',
  INVENTORY: 'M7_V2_NO_OTHER_REPS_FRAUD_WORK3_INVENTORY',
  DISPOSITION: 'M7_V2_NO_OTHER_REPS_FRAUD_WORK3_DISPOSITION',
  RECEIPT: 'M7_V2_NO_OTHER_REPS_FRAUD_WORK3_RECEIPT',
  OUTPUT: 'M7_V2_NO_OTHER_REPS_FRAUD_WORK3_OUTPUT',
});
const NO_OTHER_REPS_FRAUD_WORK3_WITHHELD_FIELDS = Object.freeze([
  'activation_id',
  'family_profile_package_id',
  'profile_id',
  'registration_id',
]);

function noOtherRepsFraudWork3ValidatePinnedEnvelope(envelope, expected, label) {
  validateEnvelopeShape(envelope, NO_OTHER_REPS_FRAUD_WORK3_CODES.AUTHORITY, label);
  if (!sameValue(envelope.binding, expected)) {
    fail(NO_OTHER_REPS_FRAUD_WORK3_CODES.AUTHORITY, `${label} binding drift.`);
  }
  validateBoundRecord(envelope, NO_OTHER_REPS_FRAUD_WORK3_CODES.AUTHORITY, label);
  const unsigned = clone(envelope.record);
  delete unsigned[expected.record_id_field];
  if (expected.record_id_field === 'inventory_disposition_id') {
    delete unsigned.session_receipt_id;
  }
  if (contentId(envelope.record.schema_version, unsigned) !== expected.record_id) {
    fail(NO_OTHER_REPS_FRAUD_WORK3_CODES.AUTHORITY, `${label} self identity drift.`);
  }
  return deepFreeze(clone(envelope));
}

function noOtherRepsFraudWork3ValidateInput(input, outerKeys, evidenceKey, evidenceKeys) {
  exactKeysOrFail(
    input,
    outerKeys,
    NO_OTHER_REPS_FRAUD_WORK3_CODES.CONTRACT,
    'No other reps Work3 input',
  );
  const evidence = input[evidenceKey];
  exactKeysOrFail(
    evidence,
    evidenceKeys,
    NO_OTHER_REPS_FRAUD_WORK3_CODES.CONTRACT,
    'No other reps Work3 evidence bundle',
  );
  for (const key of evidenceKeys) {
    if (
      !isObject(evidence[key])
      || !isObject(evidence[key].binding)
      || !isObject(evidence[key].record)
    ) {
      fail(
        NO_OTHER_REPS_FRAUD_WORK3_CODES.CONTRACT,
        `No other reps Work3 ${key} envelope drift.`,
      );
    }
  }
  return evidence;
}

function noOtherRepsFraudWork3Phase4(input) {
  try {
    return prepareNoOtherRepsFraudFamilyProfilePackageReview(input);
  } catch (error) {
    fail(
      NO_OTHER_REPS_FRAUD_WORK3_CODES.INVENTORY,
      'No other reps Work3 Phase4 review derivation failed.',
      { cause_code: typeof error.code === 'string' ? error.code : null },
    );
  }
}

function validateNoOtherRepsFraudUnapprovedInventoryReviewEvidence(evidence) {
  if (
    !isObject(evidence)
    || evidence.profile_approval_state !== 'UNAPPROVED'
    || evidence.profile_count !== NO_OTHER_REPS_FRAUD_PROFILE_COUNT
    || evidence.complete_profile_count !== NO_OTHER_REPS_FRAUD_PROFILE_COUNT
    || evidence.incomplete_profile_count !== 0
    || !Array.isArray(evidence.proposed_profiles)
    || evidence.proposed_profiles.length !== NO_OTHER_REPS_FRAUD_PROFILE_COUNT
    || !Array.isArray(evidence.retained_source_gaps)
    || evidence.retained_source_gaps.length !== 0
    || sortedUnique(evidence.proposed_profiles.map((profile) => profile.proposed_profile_key))
      .length !== NO_OTHER_REPS_FRAUD_PROFILE_COUNT
  ) {
    fail(
      NO_OTHER_REPS_FRAUD_WORK3_CODES.INVENTORY,
      'No other reps unapproved inventory review evidence census drift.',
    );
  }
  return deepFreeze({
    schema_version:
      'M7_V2_NO_OTHER_REPS_FRAUD_UNAPPROVED_INVENTORY_REVIEW_VALIDATOR_ACCEPTANCE/V1',
    status: 'PASS',
    profile_count: NO_OTHER_REPS_FRAUD_PROFILE_COUNT,
    complete_profile_count: NO_OTHER_REPS_FRAUD_PROFILE_COUNT,
    incomplete_profile_count: 0,
    retained_source_gap_count: 0,
  });
}

function prepareNoOtherRepsFraudWork3UnapprovedInventoryReview(input) {
  const evidence = noOtherRepsFraudWork3ValidateInput(
    input,
    [
      'noOtherRepsFraudWork3UnapprovedInventoryReviewEvidence',
      'noOtherRepsFraudPhase4ReviewInput',
    ],
    'noOtherRepsFraudWork3UnapprovedInventoryReviewEvidence',
    ['work3NoOtherRepsFraudUnapprovedInventoryReviewAuthority'],
  );
  const authorityEnvelope = noOtherRepsFraudWork3ValidatePinnedEnvelope(
    evidence.work3NoOtherRepsFraudUnapprovedInventoryReviewAuthority,
    NO_OTHER_REPS_FRAUD_WORK3_INVENTORY_AUTHORITY_BINDING,
    'No other reps Work3 inventory authority',
  );
  const phase4 = noOtherRepsFraudWork3Phase4(input.noOtherRepsFraudPhase4ReviewInput);
  const validator = validateNoOtherRepsFraudUnapprovedInventoryReviewEvidence({
    profile_approval_state: phase4.profile_approval_state,
    profile_count: phase4.proposed_profiles.length,
    complete_profile_count: phase4.review_accounting.complete_profile_count,
    incomplete_profile_count: phase4.review_accounting.incomplete_profile_count,
    proposed_profiles: phase4.proposed_profiles,
    retained_source_gaps: [],
  });
  const contract = authorityEnvelope.record.schema_review_candidate_contract;
  const unsigned = {
    schema_version: contract.schema_version,
    candidate_state: contract.candidate_state,
    authority_binding: clone(authorityEnvelope.binding),
    phase4_review_reference: {
      review_candidate_id: phase4.review_candidate_id,
      candidate_state: phase4.candidate_state,
      profile_approval_state: phase4.profile_approval_state,
    },
    inventory_packet_reference: {
      profile_count: NO_OTHER_REPS_FRAUD_PROFILE_COUNT,
      complete_profile_count: NO_OTHER_REPS_FRAUD_PROFILE_COUNT,
      incomplete_profile_count: 0,
      retained_source_gap_count: 0,
    },
    validator_acceptance_reference: clone(validator),
    review_accounting: clone(contract.review_accounting_exact_values),
    withheld_work3_fields: clone(NO_OTHER_REPS_FRAUD_WORK3_WITHHELD_FIELDS),
    next_governance_stop: {
      state: 'STOP_AFTER_INVENTORY_REVIEW_GREEN_BEFORE_BEN_MANUAL_APPROVAL_AND_PACKAGE_SEAL',
      ben_approval_state: 'NOT_RECORDED',
      package_approval_permitted: false,
    },
    zero_effect_boundary: clone(authorityEnvelope.record.zero_effect_boundary),
  };
  return deepFreeze({
    ...unsigned,
    inventory_review_id: contentId(contract.schema_version, unsigned),
  });
}

function noOtherRepsFraudWork3ValidatePacket(envelope) {
  noOtherRepsFraudWork3ValidatePinnedEnvelope(
    envelope,
    NO_OTHER_REPS_FRAUD_WORK3_PACKET_BINDING,
    'No other reps inventory packet',
  );
  const record = envelope.record;
  if (
    record.profile_count !== NO_OTHER_REPS_FRAUD_PROFILE_COUNT
    || record.complete_profile_count !== NO_OTHER_REPS_FRAUD_PROFILE_COUNT
    || record.incomplete_profile_count !== 0
    || record.retained_source_gap_count !== 0
    || !Array.isArray(record.profile_review_items)
    || record.profile_review_items.length !== NO_OTHER_REPS_FRAUD_PROFILE_COUNT
    || record.profile_review_items.filter((item) => item.review_flags.includes(
      'LEGAL_GROUPING_REVIEW_REQUIRED',
    )).length !== NO_OTHER_REPS_FRAUD_PROFILE_COUNT
    || record.profile_review_items.filter((item) => item.review_flags.includes(
      'SHARED_SOURCE_CITATION_LINK_ONLY',
    )).length !== NO_OTHER_REPS_FRAUD_SHARED_SOURCE_CITATION_PROFILE_COUNT
    || record.profile_review_items.filter((item) => item.review_flags.includes(
      'CROSS_FAMILY_REPRESENTATIONS_LINK_ONLY',
    )).length !== NO_OTHER_REPS_FRAUD_CROSS_FAMILY_LINK_PROFILE_COUNT
  ) {
    fail(
      NO_OTHER_REPS_FRAUD_WORK3_CODES.INVENTORY,
      'No other reps inventory packet census drift.',
    );
  }
  return record;
}

function noOtherRepsFraudWork3ValidateDisposition(envelope) {
  noOtherRepsFraudWork3ValidatePinnedEnvelope(
    envelope,
    NO_OTHER_REPS_FRAUD_WORK3_DISPOSITION_BINDING,
    'No other reps Ben disposition',
  );
  const record = envelope.record;
  const rows = record.profile_dispositions;
  const summary = record.session_summary;
  if (
    record.reviewer !== 'BEN_GOODCHILD'
    || record.default_disposition_applied !== true
    || record.packet_digest !== NO_OTHER_REPS_FRAUD_WORK3_PACKET_BINDING.sha256
    || record.ben_rulings_digest !== NO_OTHER_REPS_FRAUD_WORK3_RULINGS_BINDING.sha256
    || !Array.isArray(rows)
    || rows.length !== NO_OTHER_REPS_FRAUD_PROFILE_COUNT
    || rows.filter((row) => row.disposition === 'APPROVE').length
      !== NO_OTHER_REPS_FRAUD_PROFILE_COUNT
    || summary.approved_count !== NO_OTHER_REPS_FRAUD_PROFILE_COUNT
    || summary.hold_count !== 0
    || summary.legal_grouping_review_pending_count !== NO_OTHER_REPS_FRAUD_PROFILE_COUNT
    || summary.shared_source_citation_link_only_count
      !== NO_OTHER_REPS_FRAUD_SHARED_SOURCE_CITATION_PROFILE_COUNT
    || summary.cross_family_representations_link_only_count
      !== NO_OTHER_REPS_FRAUD_CROSS_FAMILY_LINK_PROFILE_COUNT
    || summary.taxonomy_expansion_acknowledged !== true
  ) {
    fail(
      NO_OTHER_REPS_FRAUD_WORK3_CODES.DISPOSITION,
      'No other reps Ben inventory disposition drift.',
    );
  }
  return record;
}

function prepareNoOtherRepsFraudWork3BenInventorySessionDisposition(input) {
  const evidenceKeys = [
    'work3NoOtherRepsFraudUnapprovedInventoryReviewAuthority',
    'work3NoOtherRepsFraudBenInventorySessionSuccessorAuthority',
    'inventoryReviewPacketDraft',
    'benAuthoredInventoryDisposition',
  ];
  const evidence = noOtherRepsFraudWork3ValidateInput(
    input,
    [
      'noOtherRepsFraudWork3BenInventorySessionDispositionEvidence',
      'noOtherRepsFraudPhase4ReviewInput',
    ],
    'noOtherRepsFraudWork3BenInventorySessionDispositionEvidence',
    evidenceKeys,
  );
  const authorityEnvelope = noOtherRepsFraudWork3ValidatePinnedEnvelope(
    evidence.work3NoOtherRepsFraudBenInventorySessionSuccessorAuthority,
    NO_OTHER_REPS_FRAUD_WORK3_BEN_AUTHORITY_BINDING,
    'No other reps Ben inventory authority',
  );
  noOtherRepsFraudWork3ValidatePacket(evidence.inventoryReviewPacketDraft);
  const disposition = noOtherRepsFraudWork3ValidateDisposition(
    evidence.benAuthoredInventoryDisposition,
  );
  const inventory = prepareNoOtherRepsFraudWork3UnapprovedInventoryReview({
    noOtherRepsFraudWork3UnapprovedInventoryReviewEvidence: {
      work3NoOtherRepsFraudUnapprovedInventoryReviewAuthority:
        evidence.work3NoOtherRepsFraudUnapprovedInventoryReviewAuthority,
    },
    noOtherRepsFraudPhase4ReviewInput: input.noOtherRepsFraudPhase4ReviewInput,
  });
  const contract = authorityEnvelope.record.schema_review_candidate_contract;
  const unsigned = {
    schema_version: contract.schema_version,
    candidate_state: contract.candidate_state,
    authority_binding: clone(authorityEnvelope.binding),
    inventory_review_reference: {
      inventory_review_id: inventory.inventory_review_id,
      candidate_state: inventory.candidate_state,
    },
    disposition_binding: {
      path: NO_OTHER_REPS_FRAUD_WORK3_DISPOSITION_BINDING.path,
      inventory_disposition_id: disposition.inventory_disposition_id,
      packet_digest: disposition.packet_digest,
      profile_disposition_count: NO_OTHER_REPS_FRAUD_PROFILE_COUNT,
      session_summary: clone(disposition.session_summary),
    },
    packet_binding: clone(NO_OTHER_REPS_FRAUD_WORK3_PACKET_BINDING),
    ben_rulings_binding: clone(NO_OTHER_REPS_FRAUD_WORK3_RULINGS_BINDING),
    session_receipt_reference: {
      schema_version: NO_OTHER_REPS_FRAUD_WORK3_SESSION_BINDING.schema_version,
      ben_inventory_session_receipt_id: disposition.session_receipt_id,
      completion_state: 'COMPLETE',
    },
    review_accounting: clone(contract.review_accounting_exact_values),
    withheld_work3_fields: clone(NO_OTHER_REPS_FRAUD_WORK3_WITHHELD_FIELDS),
    next_governance_stop: {
      state: 'STOP_AFTER_BEN_INVENTORY_DISPOSITION_BEFORE_FAMILY_PACKAGE_SEAL',
      package_seal_state: 'NOT_RECORDED',
      package_approval_permitted: false,
    },
    zero_effect_boundary: clone(authorityEnvelope.record.zero_effect_boundary),
  };
  return deepFreeze({
    ...unsigned,
    inventory_session_disposition_id: contentId(contract.schema_version, unsigned),
  });
}

function noOtherRepsFraudWork3ValidateSessionReceipt(envelope) {
  noOtherRepsFraudWork3ValidatePinnedEnvelope(
    envelope,
    NO_OTHER_REPS_FRAUD_WORK3_SESSION_BINDING,
    'No other reps Ben session receipt',
  );
  const record = envelope.record;
  if (
    record.completion_state !== 'COMPLETE'
    || record.disposition_binding.inventory_disposition_id
      !== NO_OTHER_REPS_FRAUD_WORK3_DISPOSITION_BINDING.record_id
    || record.zero_effect_boundary.work3_identity_count !== 0
  ) {
    fail(
      NO_OTHER_REPS_FRAUD_WORK3_CODES.RECEIPT,
      'No other reps Ben session receipt drift.',
    );
  }
  return record;
}

function prepareNoOtherRepsFraudWork3FamilyPackageSeal(input) {
  const evidenceKeys = [
    'work3NoOtherRepsFraudUnapprovedInventoryReviewAuthority',
    'work3NoOtherRepsFraudBenInventorySessionSuccessorAuthority',
    'work3NoOtherRepsFraudFamilyPackageSealSuccessorAuthority',
    'inventoryReviewPacketDraft',
    'benAuthoredInventoryDisposition',
    'benInventorySessionReceipt',
  ];
  const evidence = noOtherRepsFraudWork3ValidateInput(
    input,
    [
      'noOtherRepsFraudWork3FamilyPackageSealEvidence',
      'noOtherRepsFraudPhase4ReviewInput',
    ],
    'noOtherRepsFraudWork3FamilyPackageSealEvidence',
    evidenceKeys,
  );
  const authorityEnvelope = noOtherRepsFraudWork3ValidatePinnedEnvelope(
    evidence.work3NoOtherRepsFraudFamilyPackageSealSuccessorAuthority,
    NO_OTHER_REPS_FRAUD_WORK3_SEAL_AUTHORITY_BINDING,
    'No other reps family package seal authority',
  );
  const dispositionCandidate = prepareNoOtherRepsFraudWork3BenInventorySessionDisposition({
    noOtherRepsFraudWork3BenInventorySessionDispositionEvidence: {
      work3NoOtherRepsFraudUnapprovedInventoryReviewAuthority:
        evidence.work3NoOtherRepsFraudUnapprovedInventoryReviewAuthority,
      work3NoOtherRepsFraudBenInventorySessionSuccessorAuthority:
        evidence.work3NoOtherRepsFraudBenInventorySessionSuccessorAuthority,
      inventoryReviewPacketDraft: evidence.inventoryReviewPacketDraft,
      benAuthoredInventoryDisposition: evidence.benAuthoredInventoryDisposition,
    },
    noOtherRepsFraudPhase4ReviewInput: input.noOtherRepsFraudPhase4ReviewInput,
  });
  noOtherRepsFraudWork3ValidateSessionReceipt(evidence.benInventorySessionReceipt);
  if (
    dispositionCandidate.session_receipt_reference.ben_inventory_session_receipt_id
      !== evidence.benInventorySessionReceipt.record.ben_inventory_session_receipt_id
  ) {
    fail(
      NO_OTHER_REPS_FRAUD_WORK3_CODES.RECEIPT,
      'No other reps session receipt identity drift.',
    );
  }
  const contract = authorityEnvelope.record.schema_review_candidate_contract;
  const unsigned = {
    schema_version: contract.schema_version,
    candidate_state: contract.candidate_state,
    authority_binding: clone(authorityEnvelope.binding),
    inventory_session_disposition_reference: {
      inventory_disposition_id: NO_OTHER_REPS_FRAUD_WORK3_DISPOSITION_BINDING.record_id,
      candidate_state: dispositionCandidate.candidate_state,
    },
    ben_rulings_binding: clone(NO_OTHER_REPS_FRAUD_WORK3_RULINGS_BINDING),
    disposition_binding: clone(NO_OTHER_REPS_FRAUD_WORK3_DISPOSITION_BINDING),
    session_receipt_binding: clone(NO_OTHER_REPS_FRAUD_WORK3_SESSION_BINDING),
    legal_grouping_disposition_binding: {
      ...clone(NO_OTHER_REPS_FRAUD_WORK3_RULINGS_BINDING),
      disposition_status: 'PENDING_LEGAL_REVIEW',
      legal_grouping_review_pending_count: NO_OTHER_REPS_FRAUD_PROFILE_COUNT,
      populated_subtype_bucket_count: 1,
      registered_subtype_bucket_count: 4,
    },
    review_accounting: clone(contract.review_accounting_exact_values),
    withheld_work3_fields: clone(NO_OTHER_REPS_FRAUD_WORK3_WITHHELD_FIELDS),
    next_governance_stop: {
      state: 'STOP_AFTER_FAMILY_PACKAGE_SEAL_CAPTURE_BEFORE_REGISTRATION',
      package_seal_state: 'CAPTURED',
      registration_permitted: false,
    },
    zero_effect_boundary: clone(authorityEnvelope.record.zero_effect_boundary),
  };
  return deepFreeze({
    ...unsigned,
    family_package_seal_id: contentId(contract.schema_version, unsigned),
  });
}

function noOtherRepsFraudWork3ValidateSealReceipt(envelope) {
  noOtherRepsFraudWork3ValidatePinnedEnvelope(
    envelope,
    NO_OTHER_REPS_FRAUD_WORK3_SEAL_RECEIPT_BINDING,
    'No other reps family seal receipt',
  );
  const record = envelope.record;
  if (
    record.completion_state !== 'COMPLETE'
    || record.reviewer !== 'BEN_GOODCHILD'
    || record.disposition_binding.record_id
      !== NO_OTHER_REPS_FRAUD_WORK3_DISPOSITION_BINDING.record_id
    || record.legal_grouping_disposition_binding.disposition_status !== 'PENDING_LEGAL_REVIEW'
    || record.zero_effect_boundary.work3_identity_count !== 0
  ) {
    fail(
      NO_OTHER_REPS_FRAUD_WORK3_CODES.RECEIPT,
      'No other reps family seal receipt drift.',
    );
  }
  return record;
}

function prepareNoOtherRepsFraudWork3FamilyPackageRegistration(input) {
  const evidenceKeys = [
    'work3NoOtherRepsFraudUnapprovedInventoryReviewAuthority',
    'work3NoOtherRepsFraudBenInventorySessionSuccessorAuthority',
    'work3NoOtherRepsFraudFamilyPackageSealSuccessorAuthority',
    'work3NoOtherRepsFraudRegistrationSuccessorAuthority',
    'inventoryReviewPacketDraft',
    'benAuthoredInventoryDisposition',
    'benInventorySessionReceipt',
    'familyPackageSealReceipt',
  ];
  const evidence = noOtherRepsFraudWork3ValidateInput(
    input,
    [
      'noOtherRepsFraudWork3FamilyPackageRegistrationEvidence',
      'noOtherRepsFraudPhase4ReviewInput',
    ],
    'noOtherRepsFraudWork3FamilyPackageRegistrationEvidence',
    evidenceKeys,
  );
  const authorityEnvelope = noOtherRepsFraudWork3ValidatePinnedEnvelope(
    evidence.work3NoOtherRepsFraudRegistrationSuccessorAuthority,
    NO_OTHER_REPS_FRAUD_WORK3_REGISTRATION_AUTHORITY_BINDING,
    'No other reps registration authority',
  );
  const sealCandidate = prepareNoOtherRepsFraudWork3FamilyPackageSeal({
    noOtherRepsFraudWork3FamilyPackageSealEvidence: {
      work3NoOtherRepsFraudUnapprovedInventoryReviewAuthority:
        evidence.work3NoOtherRepsFraudUnapprovedInventoryReviewAuthority,
      work3NoOtherRepsFraudBenInventorySessionSuccessorAuthority:
        evidence.work3NoOtherRepsFraudBenInventorySessionSuccessorAuthority,
      work3NoOtherRepsFraudFamilyPackageSealSuccessorAuthority:
        evidence.work3NoOtherRepsFraudFamilyPackageSealSuccessorAuthority,
      inventoryReviewPacketDraft: evidence.inventoryReviewPacketDraft,
      benAuthoredInventoryDisposition: evidence.benAuthoredInventoryDisposition,
      benInventorySessionReceipt: evidence.benInventorySessionReceipt,
    },
    noOtherRepsFraudPhase4ReviewInput: input.noOtherRepsFraudPhase4ReviewInput,
  });
  const sealReceipt = noOtherRepsFraudWork3ValidateSealReceipt(
    evidence.familyPackageSealReceipt,
  );
  if (sealReceipt.family_package_seal_id !== sealCandidate.family_package_seal_id) {
    fail(
      NO_OTHER_REPS_FRAUD_WORK3_CODES.RECEIPT,
      'No other reps family seal candidate and receipt identity drift.',
    );
  }
  const phase4 = noOtherRepsFraudWork3Phase4(input.noOtherRepsFraudPhase4ReviewInput);
  const dispositionByKey = new Map(
    evidence.benAuthoredInventoryDisposition.record.profile_dispositions.map(
      (row) => [row.proposed_profile_key, row],
    ),
  );
  const registeredProfiles = phase4.proposed_profiles.map((profile) => {
    const disposition = dispositionByKey.get(profile.proposed_profile_key);
    if (!disposition) {
      fail(
        NO_OTHER_REPS_FRAUD_WORK3_CODES.OUTPUT,
        'No other reps registration disposition missing.',
      );
    }
    const identityInput = {
      family_key: 'NO_OTHER_REPS_FRAUD',
      proposed_profile_key: profile.proposed_profile_key,
      phase3_profile_key: null,
      profile_set_version: 1,
    };
    return {
      profile_id: contentId(
        'M7_V2_NO_OTHER_REPS_FRAUD_WORK3_REGISTERED_PROFILE_IDENTITY/V1',
        identityInput,
      ),
      proposed_profile_key: profile.proposed_profile_key,
      phase3_profile_key: null,
      inventory_disposition: disposition.disposition,
      legal_grouping_pending_acknowledged: disposition.legal_grouping_pending_acknowledged,
    };
  });
  const packageUnsigned = {
    family_key: 'NO_OTHER_REPS_FRAUD',
    profile_set_version: 1,
    package_state: 'BEN_SEALED_IN_MEMORY_REGISTRATION_ONLY',
    profile_id_count: NO_OTHER_REPS_FRAUD_PROFILE_COUNT,
    profile_ids: registeredProfiles.map((profile) => profile.profile_id),
    inventory_disposition_id: NO_OTHER_REPS_FRAUD_WORK3_DISPOSITION_BINDING.record_id,
    family_package_seal_receipt_id: NO_OTHER_REPS_FRAUD_WORK3_SEAL_RECEIPT_BINDING.record_id,
    legal_grouping_disposition_state: 'PENDING_LEGAL_REVIEW',
  };
  const packageIdentity = {
    family_profile_package_id: contentId(
      'M7_V2_NO_OTHER_REPS_FRAUD_WORK3_FAMILY_PROFILE_PACKAGE_IDENTITY/V1',
      packageUnsigned,
    ),
    family_key: packageUnsigned.family_key,
    profile_set_version: 1,
    package_state: packageUnsigned.package_state,
    profile_id_count: NO_OTHER_REPS_FRAUD_PROFILE_COUNT,
    inventory_disposition_id: packageUnsigned.inventory_disposition_id,
    family_package_seal_receipt_id: packageUnsigned.family_package_seal_receipt_id,
    legal_grouping_disposition_state: 'PENDING_LEGAL_REVIEW',
  };
  const contract = authorityEnvelope.record.schema_review_candidate_contract;
  const inventoryFingerprint = sha256Hex(Buffer.from(canonicalJson({
    family_profile_package_id: packageIdentity.family_profile_package_id,
    profile_ids: registeredProfiles.map((profile) => profile.profile_id),
    inventory_disposition_id: packageIdentity.inventory_disposition_id,
    family_package_seal_receipt_id: packageIdentity.family_package_seal_receipt_id,
  }), 'utf8'));
  const unsigned = {
    schema_version: contract.schema_version,
    candidate_state: contract.candidate_state,
    authority_binding: clone(authorityEnvelope.binding),
    family_package_seal_receipt_binding: clone(
      NO_OTHER_REPS_FRAUD_WORK3_SEAL_RECEIPT_BINDING,
    ),
    family_package_seal_reference: {
      family_package_seal_id: sealCandidate.family_package_seal_id,
      candidate_state: sealCandidate.candidate_state,
    },
    family_profile_package_identity: packageIdentity,
    registered_profile_identities: registeredProfiles,
    inventory_fingerprint: inventoryFingerprint,
    review_accounting: clone(contract.review_accounting_exact_values),
    withheld_work3_fields: ['activation_id'],
    next_governance_stop: {
      state: 'STOP_AFTER_NO_OTHER_REPS_FRAUD_FAMILY_PACKAGE_REGISTRATION_BEFORE_ACTIVATION',
      registration_state: 'RECORDED',
      activation_permitted: false,
    },
    zero_effect_boundary: clone(authorityEnvelope.record.zero_effect_boundary),
  };
  const result = deepFreeze({
    ...unsigned,
    family_package_registration_id: contentId(contract.schema_version, unsigned),
  });
  if (
    result.registered_profile_identities.length !== NO_OTHER_REPS_FRAUD_PROFILE_COUNT
    || result.review_accounting.profile_identity_count !== NO_OTHER_REPS_FRAUD_PROFILE_COUNT
    || result.review_accounting.work3_identity_count !== NO_OTHER_REPS_FRAUD_PROFILE_COUNT + 1
    || result.zero_effect_boundary.activation_count !== 0
    || noOtherRepsFraudContainsForbiddenKey(result, new Set(['activation_id']))
  ) {
    fail(
      NO_OTHER_REPS_FRAUD_WORK3_CODES.OUTPUT,
      'No other reps family registration boundary drift.',
    );
  }
  return result;
}

module.exports = {
  NO_OTHER_REPS_FRAUD_CROSS_FAMILY_LINK_PROFILE_COUNT,
  NO_OTHER_REPS_FRAUD_PHASE2_AUTHORITY_BYTES,
  NO_OTHER_REPS_FRAUD_PHASE2_AUTHORITY_ID,
  NO_OTHER_REPS_FRAUD_PHASE2_AUTHORITY_PATH,
  NO_OTHER_REPS_FRAUD_PHASE2_AUTHORITY_SCHEMA,
  NO_OTHER_REPS_FRAUD_PHASE2_AUTHORITY_SHA256,
  NO_OTHER_REPS_FRAUD_PHASE2_PROPOSAL_CODES,
  NO_OTHER_REPS_FRAUD_PHASE2_PROPOSAL_KEYS,
  NO_OTHER_REPS_FRAUD_PHASE4_AUTHORITY_BYTES,
  NO_OTHER_REPS_FRAUD_PHASE4_AUTHORITY_ID,
  NO_OTHER_REPS_FRAUD_PHASE4_AUTHORITY_PATH,
  NO_OTHER_REPS_FRAUD_PHASE4_AUTHORITY_SCHEMA,
  NO_OTHER_REPS_FRAUD_PHASE4_AUTHORITY_SHA256,
  NO_OTHER_REPS_FRAUD_PHASE4_CANDIDATE_SCHEMA,
  NO_OTHER_REPS_FRAUD_PHASE4_CANDIDATE_STATE,
  NO_OTHER_REPS_FRAUD_PHASE4_REVIEW_CODES,
  NO_OTHER_REPS_FRAUD_PHASE4_REVIEW_INPUT_KEYS,
  NO_OTHER_REPS_FRAUD_PHASE4_REVIEW_OUTPUT_KEYS,
  NO_OTHER_REPS_FRAUD_PHASE4_SCHEDULE_SHA256,
  NO_OTHER_REPS_FRAUD_PROFILE_COUNT,
  NO_OTHER_REPS_FRAUD_SHARED_SOURCE_CITATION_PROFILE_COUNT,
  noOtherRepsFraudProposalPartition,
  prepareNoOtherRepsFraudFamilyProfilePackageReview,
  prepareNoOtherRepsFraudPhase2FamilyProposal,
  prepareNoOtherRepsFraudWork3BenInventorySessionDisposition,
  prepareNoOtherRepsFraudWork3FamilyPackageRegistration,
  prepareNoOtherRepsFraudWork3FamilyPackageSeal,
  prepareNoOtherRepsFraudWork3UnapprovedInventoryReview,
  validateNoOtherRepsFraudUnapprovedInventoryReviewEvidence,
};
