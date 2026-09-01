'use strict';

/**
 * Family-local M7 V2 repair authoring for INTERIM_OPERATING (N1 family #21).
 *
 * Milestone A ladder, D&O-minimal path (Phase 3 reference chain skipped, because
 * every calibration provision example has an empty m3_dependency_ids list):
 *   Phase 2 partition -> Phase 4 package review -> Work3 inventory review ->
 *   Ben inventory session disposition -> family package seal -> registration.
 *
 * Deliberately self-contained: the shared spine (m7-v2-profile-authoring.js) is on a
 * separate merge track, so the helpers below are adapted copies rather than imports.
 *
 * The 113 profiles are claim-scale, one per governed comparator M4 claim across the
 * six comparator deals (Concho, Metsera, Red Hat, Skechers, Skywater, TopBuild). Claim scale rather than
 * section scale because Concho section 6.1 carries eighteen independently operative limbs;
 * a section-scale partition would silently fold distinct restriction, consent and exception limbs.
 *
 * Subtype grouping is an open legal question — the sealed M5 role schema admits one
 * claim definition key under all five subtype buckets — so every profile
 * carries LEGAL_GROUPING_REVIEW_REQUIRED, zero rows additionally
 * carry SUBTYPE_PARTITION_DIVERGES_FROM_CALIBRATION_PROPOSED_SUBTYPE, and eight rows
 * carry COMPARATOR_CLAIM_OUTSIDE_CALIBRATION_PROVISION_EXAMPLES. The
 * family seal records PENDING_LEGAL_REVIEW rather than a resolved taxonomy.
 */

const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');

const INTERIM_OPERATING_PROFILE_COUNT = 113;
const INTERIM_OPERATING_SUBTYPE_DIVERGENCE_PROFILE_COUNT = 0;
const INTERIM_OPERATING_OUTSIDE_CALIBRATION_PROFILE_COUNT = 8;
const INTERIM_OPERATING_REGISTERED_SUBTYPE_BUCKET_COUNT = 5;
const INTERIM_OPERATING_POPULATED_SUBTYPE_BUCKET_COUNT = 1;

const INTERIM_OPERATING_REVIEW_FLAGS = Object.freeze({
  LEGAL_GROUPING: 'LEGAL_GROUPING_REVIEW_REQUIRED',
  OUTSIDE_CALIBRATION: 'COMPARATOR_CLAIM_OUTSIDE_CALIBRATION_PROVISION_EXAMPLES',
  SUBTYPE_DIVERGENCE: 'SUBTYPE_PARTITION_DIVERGES_FROM_CALIBRATION_PROPOSED_SUBTYPE',
});

const INTERIM_OPERATING_PHASE2_AUTHORITY_SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_CONTRACT_INTERIM_OPERATING_AUTHORING_PHASE2_AUTHORITY/V2';
const INTERIM_OPERATING_PHASE2_AUTHORITY_ID =
  '5cf6ffcbd8c9f1465f9c7dd34452e410c576f8430ad9b92e9e5bfffecfa827ea';
const INTERIM_OPERATING_PHASE2_AUTHORITY_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-interim-operating-authoring-phase2-authority-v2.json';
const INTERIM_OPERATING_PHASE2_AUTHORITY_BYTES = 262722;
const INTERIM_OPERATING_PHASE2_AUTHORITY_SHA256 =
  '28a1a6d1489869c67d752ec6b28f7faf47e16874119806c2414d08af8c359cb2';

const INTERIM_OPERATING_PHASE2_PROPOSAL_CODES = Object.freeze({
  AUTHORITY: 'M7_V2_INTERIM_OPERATING_PHASE2_AUTHORITY',
  CONTRACT: 'M7_V2_INTERIM_OPERATING_PHASE2_PROPOSAL_CONTRACT',
  COVERAGE: 'M7_V2_INTERIM_OPERATING_PHASE2_SOURCE_COVERAGE',
});

const INTERIM_OPERATING_PHASE2_PROPOSAL_KEYS = Object.freeze([
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
  exactKeysOrFail(source.binding, Object.keys(expectedBinding), code, `${label} binding`);
  if (!sameValue(source.binding, expectedBinding)) {
    fail(code, `${label} binding does not match the Phase2 authority.`);
  }
  validateBoundRecord(source, code, label);
}

function validateInterimOperatingProposalAuthority(envelope) {
  const code = INTERIM_OPERATING_PHASE2_PROPOSAL_CODES.AUTHORITY;
  validateEnvelopeShape(envelope, code, 'Phase2 authority');
  validateBoundRecord(envelope, code, 'Phase2 authority');
  const { binding, record } = envelope;
  if (
    binding.byte_length !== INTERIM_OPERATING_PHASE2_AUTHORITY_BYTES
    || binding.path !== INTERIM_OPERATING_PHASE2_AUTHORITY_PATH
    || binding.record_id !== INTERIM_OPERATING_PHASE2_AUTHORITY_ID
    || binding.record_id_field !== 'interim_operating_authoring_phase2_authority_id'
    || binding.schema_version !== INTERIM_OPERATING_PHASE2_AUTHORITY_SCHEMA
    || binding.sha256 !== INTERIM_OPERATING_PHASE2_AUTHORITY_SHA256
  ) {
    fail(code, 'Phase2 authority binding drift.');
  }
  if (
    record.schema_version !== INTERIM_OPERATING_PHASE2_AUTHORITY_SCHEMA
    || record.interim_operating_authoring_phase2_authority_id
      !== INTERIM_OPERATING_PHASE2_AUTHORITY_ID
  ) {
    fail(code, 'Phase2 authority identity drift.');
  }
  const unsigned = { ...record };
  delete unsigned.interim_operating_authoring_phase2_authority_id;
  if (contentId(record.schema_version, unsigned) !== INTERIM_OPERATING_PHASE2_AUTHORITY_ID) {
    fail(code, 'Phase2 authority self identity drift.');
  }
  return deepFreeze(clone(envelope));
}

function interimOperatingAgreementSources(authority, agreementEvidenceByAgreementId) {
  const code = INTERIM_OPERATING_PHASE2_PROPOSAL_CODES.COVERAGE;
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

function validateInterimOperatingProposalGovernedSources(authority, governedSources) {
  const code = INTERIM_OPERATING_PHASE2_PROPOSAL_CODES.COVERAGE;
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
    validateBoundSource(governedSources[sourceKey], parents[bindingKey], code, sourceKey);
  }
  return interimOperatingAgreementSources(
    authority,
    governedSources.agreementEvidenceByAgreementId,
  );
}

function validateInterimOperatingProposalSourceCoverage(authority, agreements) {
  const code = INTERIM_OPERATING_PHASE2_PROPOSAL_CODES.COVERAGE;
  const successor = authority.source_terminal_successor_contract;
  const terminals = successor.terminal_rule_registry;
  const expectedTerminalCount = successor.terminal_rule_registry_exact_count;
  if (!Array.isArray(terminals) || terminals.length !== expectedTerminalCount) {
    fail(code, `The terminal registry must contain exactly ${expectedTerminalCount} terminals.`);
  }
  const classificationPaths = new Map(
    successor.classification_path_registry.map((entry) => [
      entry.classification_bucket,
      entry.classification_path,
    ]),
  );
  const sourceUnitIds = [];
  const claimIds = [];
  const signatures = [];
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
    if (terminal.m4_claim_ids.length !== 1 || terminal.m4_silent_source_row_keys.length !== 0) {
      fail(
        code,
        `Claim-scale terminal must bind exactly one governed M4 claim: ${terminal.source_unit_key}.`,
      );
    }
    const member = terminal.source_closure.members[0];
    const claim = agreement.claimsById.get(terminal.m4_claim_ids[0]);
    if (
      !claim
      || claim.agreement_id !== terminal.agreement_id
      || claim.family !== 'INTERIM_OPERATING'
      || claim.claim_definition_key !== member.claim_definition_key
      || claim.claim_occurrence_id !== member.claim_occurrence_id
      || claim.section_reference !== member.section_reference
      || claim.deal !== member.deal
    ) {
      fail(code, `Comparator closure claim mismatch for ${terminal.source_unit_key}.`);
    }
    const node = agreement.nodesById.get(member.source_node_occurrence_id);
    if (
      !node
      || node.node_kind !== member.node_kind
      || !sameValue(node.extent_span, member.source_span)
      || !claim.source_node_occurrence_ids.includes(member.source_node_occurrence_id)
    ) {
      fail(code, `Source node is not proved by exact M2 evidence for ${terminal.source_unit_key}.`);
    }
    claimIds.push(terminal.m4_claim_ids[0]);
    sourceUnitIds.push(terminal.source_unit_key);
    signatures.push(terminal.required_expression_signature);
  }
  const uniqueSourceUnitIds = sortedUnique(sourceUnitIds);
  const uniqueClaimIds = sortedUnique(claimIds);
  const expectedClaimCount = successor.admitted_m4_claim_exact_count;
  if (
    uniqueClaimIds.length !== expectedClaimCount
    || claimIds.length !== expectedClaimCount
    || uniqueSourceUnitIds.length !== sourceUnitIds.length
    || sortedUnique(signatures).length !== signatures.length
  ) {
    fail(code, `The exact ${expectedClaimCount} M4 claim inventory is not closed.`);
  }
  return { terminals, sourceUnitIds: uniqueSourceUnitIds, claimIds: uniqueClaimIds };
}

function interimOperatingProposalCoverageRecords(authority, coverage) {
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

function interimOperatingProposalPartition(coverage) {
  const groups = new Map();
  for (const terminal of coverage.terminals) {
    const canonicalTuple = {
      classification_path: terminal.classification_path,
      required_expression_signature: terminal.required_expression_signature,
    };
    const tupleKey = canonicalJson(canonicalTuple);
    let group = groups.get(tupleKey);
    if (!group) {
      group = { canonicalTuple, sourceUnitKeys: [], claimIds: [] };
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
    compareStrings(left.proposed_profile_key, right.proposed_profile_key));
  return {
    proposed_profiles: proposedProfiles,
    source_unit_assignment_count: coverage.sourceUnitIds.length,
    m4_claim_assignment_count: coverage.claimIds.length,
  };
}

function interimOperatingProposalInventoryDigest(coverage, proposedPartition) {
  const tuplesByCanonical = new Map();
  for (const profile of proposedPartition.proposed_profiles) {
    tuplesByCanonical.set(canonicalJson(profile.canonical_tuple), profile.canonical_tuple);
  }
  const proposedProfileTuples = [...tuplesByCanonical.entries()]
    .sort(([left], [right]) => compareStrings(left, right))
    .map(([, tuple]) => tuple);
  return sha256Hex(canonicalJson({
    m4_claim_ids: coverage.claimIds,
    source_unit_ids: coverage.sourceUnitIds,
    authorised_component_ids: [],
    proposed_profile_tuples: proposedProfileTuples,
  }));
}

function prepareInterimOperatingPhase2FamilyProposal(input) {
  const contractCode = INTERIM_OPERATING_PHASE2_PROPOSAL_CODES.CONTRACT;
  exactKeysOrFail(
    input,
    ['interimOperatingAuthoringPhase2Authority', 'governedSources'],
    contractCode,
    'Interim Operating proposal input',
  );
  const authorityEnvelope = validateInterimOperatingProposalAuthority(
    input.interimOperatingAuthoringPhase2Authority,
  );
  const authority = authorityEnvelope.record;
  const agreements = validateInterimOperatingProposalGovernedSources(
    authority,
    input.governedSources,
  );
  const coverage = validateInterimOperatingProposalSourceCoverage(authority, agreements);
  const accounting = interimOperatingProposalCoverageRecords(authority, coverage);
  const proposedPartition = interimOperatingProposalPartition(coverage);
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
    'INTERIM_OPERATING_Q01_Q02_Q03_BOUND_TO_SEALED_M5_PROGRAMME_RULINGS',
    INTERIM_OPERATING_REVIEW_FLAGS.LEGAL_GROUPING,
  ].sort(compareStrings);
  const unsignedProposal = {
    schema_version: 'M7_V2_INTERIM_OPERATING_FAMILY_PROPOSAL/V1',
    family_key: 'INTERIM_OPERATING',
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
    inventory_digest: interimOperatingProposalInventoryDigest(coverage, proposedPartition),
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

const INTERIM_OPERATING_PHASE4_AUTHORITY_SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_CONTRACT_INTERIM_OPERATING_AUTHORING_PHASE4_FAMILY_PROFILE_PACKAGE_REVIEW_AUTHORITY/V1';
const INTERIM_OPERATING_PHASE4_AUTHORITY_ID =
  '079d93a4b7b75be16dbfe5edd05c04dbf137c65b18195415daa2b776673c060d';
const INTERIM_OPERATING_PHASE4_AUTHORITY_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-interim-operating-authoring-phase4-family-profile-package-review-authority.json';
const INTERIM_OPERATING_PHASE4_AUTHORITY_BYTES = 112993;
const INTERIM_OPERATING_PHASE4_AUTHORITY_SHA256 =
  '8e2bafe127941a2a8abce239ad20dc78a8668076371828142acd413df8ef0ac4';
const INTERIM_OPERATING_PHASE4_SCHEDULE_SHA256 =
  '5a2840909915fa718c1d5ec8a4e2f6bcb309957df47cedc42893d8d9f3e74dd4';
const INTERIM_OPERATING_PHASE4_CANDIDATE_SCHEMA =
  'M7_V2_INTERIM_OPERATING_PHASE4_FAMILY_PROFILE_PACKAGE_REVIEW_CANDIDATE/V1';
const INTERIM_OPERATING_PHASE4_CANDIDATE_STATE =
  'REVIEW_ONLY_113_PROFILES_UNAPPROVED_AWAITING_BEN_INVENTORY';

const INTERIM_OPERATING_PHASE4_REVIEW_CODES = Object.freeze({
  CONTRACT: 'M7_V2_INTERIM_OPERATING_PHASE4_REVIEW_CONTRACT',
  AUTHORITY: 'M7_V2_INTERIM_OPERATING_PHASE4_REVIEW_AUTHORITY',
  PHASE2_PROPOSAL: 'M7_V2_INTERIM_OPERATING_PHASE4_PHASE2_PROPOSAL',
  PROFILE_SCHEDULE: 'M7_V2_INTERIM_OPERATING_PHASE4_PROFILE_SCHEDULE',
  REVIEW_OUTPUT: 'M7_V2_INTERIM_OPERATING_PHASE4_REVIEW_OUTPUT',
});

const INTERIM_OPERATING_PHASE4_REVIEW_INPUT_KEYS = Object.freeze([
  'interimOperatingAuthoringPhase4FamilyProfilePackageReviewAuthority',
  'interimOperatingAuthoringPhase2Authority',
  'governedSources',
]);

const INTERIM_OPERATING_PHASE4_REVIEW_OUTPUT_KEYS = Object.freeze([
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

const INTERIM_OPERATING_PHASE4_AUTHORITY_ROOT_KEYS = Object.freeze([
  'authority_classification',
  'authority_state',
  'candidate_output_contract',
  'design_basis',
  'execution_schedule',
  'interim_operating_authoring_phase4_family_profile_package_review_authority_id',
  'first_legal_stop_contract',
  'forbidden_output_contract',
  'immutable_parent_bindings',
  'implementation_contract',
  'profile_review_schedule',
  'profile_review_schedule_contract',
  'schema_version',
  'zero_effect_boundary',
]);

function interimOperatingPhase4ExpectedParentBindings() {
  return {
    interim_operating_authoring_phase2_authority: {
      byte_length: INTERIM_OPERATING_PHASE2_AUTHORITY_BYTES,
      path: INTERIM_OPERATING_PHASE2_AUTHORITY_PATH,
      record_id: INTERIM_OPERATING_PHASE2_AUTHORITY_ID,
      record_id_field: 'interim_operating_authoring_phase2_authority_id',
      schema_version: INTERIM_OPERATING_PHASE2_AUTHORITY_SCHEMA,
      sha256: INTERIM_OPERATING_PHASE2_AUTHORITY_SHA256,
    },
  };
}

function interimOperatingContainsForbiddenKey(value, forbiddenKeys, seen = new Set()) {
  if (!value || typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) {
    return value.some((member) => interimOperatingContainsForbiddenKey(
      member,
      forbiddenKeys,
      seen,
    ));
  }
  for (const [key, member] of Object.entries(value)) {
    if (forbiddenKeys.has(key)) return true;
    if (interimOperatingContainsForbiddenKey(member, forbiddenKeys, seen)) return true;
  }
  return false;
}

function validateInterimOperatingPhase4FamilyProfilePackageReviewAuthority(envelope) {
  const code = INTERIM_OPERATING_PHASE4_REVIEW_CODES.AUTHORITY;
  validateEnvelopeShape(envelope, code, 'Phase4 family profile package review authority');
  const { binding, record } = envelope;
  if (
    binding.byte_length !== INTERIM_OPERATING_PHASE4_AUTHORITY_BYTES
    || binding.path !== INTERIM_OPERATING_PHASE4_AUTHORITY_PATH
    || binding.record_id !== INTERIM_OPERATING_PHASE4_AUTHORITY_ID
    || binding.record_id_field
      !== 'interim_operating_authoring_phase4_family_profile_package_review_authority_id'
    || binding.schema_version !== INTERIM_OPERATING_PHASE4_AUTHORITY_SCHEMA
    || binding.sha256 !== INTERIM_OPERATING_PHASE4_AUTHORITY_SHA256
  ) {
    fail(code, 'Phase4 family profile package review authority binding drift.');
  }
  validateBoundRecord(envelope, code, 'Phase4 family profile package review authority');
  if (
    !exactKeys(record, INTERIM_OPERATING_PHASE4_AUTHORITY_ROOT_KEYS)
    || record.schema_version !== INTERIM_OPERATING_PHASE4_AUTHORITY_SCHEMA
    || record.interim_operating_authoring_phase4_family_profile_package_review_authority_id
      !== INTERIM_OPERATING_PHASE4_AUTHORITY_ID
  ) {
    fail(code, 'Phase4 family profile package review authority identity drift.');
  }
  const unsigned = { ...record };
  delete unsigned.interim_operating_authoring_phase4_family_profile_package_review_authority_id;
  if (contentId(record.schema_version, unsigned) !== INTERIM_OPERATING_PHASE4_AUTHORITY_ID) {
    fail(code, 'Phase4 family profile package review authority self identity drift.');
  }

  const implementation = record.implementation_contract;
  const output = record.candidate_output_contract;
  const scheduleContract = record.profile_review_schedule_contract;
  const schedule = record.profile_review_schedule;
  const expectedErrorCodes = Object.values(INTERIM_OPERATING_PHASE4_REVIEW_CODES);
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
      interimOperatingPhase4ExpectedParentBindings(),
    )
    || !sameValue(
      implementation.exact_outer_input_keys,
      INTERIM_OPERATING_PHASE4_REVIEW_INPUT_KEYS,
    )
    || implementation.exported_function !== 'prepareInterimOperatingFamilyProfilePackageReview'
    || implementation.phase2_internal_function
      !== 'prepareInterimOperatingPhase2FamilyProposal'
    || implementation.phase3_internal_function !== null
    || implementation.caller_produced_candidate_input_forbidden !== true
    || !Array.isArray(implementation.error_precedence)
    || implementation.error_precedence.length !== expectedErrorCodes.length
    || implementation.error_precedence.some((entry, index) => (
      entry.order !== index + 1 || entry.code !== expectedErrorCodes[index]
    ))
    || output.schema_version !== INTERIM_OPERATING_PHASE4_CANDIDATE_SCHEMA
    || output.record_id_field !== 'review_candidate_id'
    || output.candidate_state !== INTERIM_OPERATING_PHASE4_CANDIDATE_STATE
    || output.profile_approval_state !== 'UNAPPROVED'
    || !sameValue(output.exact_keys, INTERIM_OPERATING_PHASE4_REVIEW_OUTPUT_KEYS)
    || schedule.length !== INTERIM_OPERATING_PROFILE_COUNT
    || scheduleContract.exact_profile_count !== INTERIM_OPERATING_PROFILE_COUNT
    || scheduleContract.exact_complete_profile_count !== INTERIM_OPERATING_PROFILE_COUNT
    || scheduleContract.exact_incomplete_profile_count !== 0
    || scheduleContract.schedule_canonical_json_sha256
      !== INTERIM_OPERATING_PHASE4_SCHEDULE_SHA256
    || sha256Hex(scheduleBytes) !== INTERIM_OPERATING_PHASE4_SCHEDULE_SHA256
    || scheduleContract.schedule_canonical_json_byte_length !== scheduleBytes.length
  ) {
    fail(code, 'Phase4 family profile package review authority contract drift.');
  }
  return deepFreeze(clone(envelope));
}

function interimOperatingPhase4ValidatePhase2Proposal(proposal) {
  const code = INTERIM_OPERATING_PHASE4_REVIEW_CODES.PHASE2_PROPOSAL;
  if (
    !isObject(proposal)
    || proposal.schema_version !== 'M7_V2_INTERIM_OPERATING_FAMILY_PROPOSAL/V1'
    || proposal.family_key !== 'INTERIM_OPERATING'
    || proposal.profile_approval_state !== 'UNAPPROVED'
    || proposal.source_terminal_coverage.accounted_count !== INTERIM_OPERATING_PROFILE_COUNT
    || proposal.m4_claim_accounting.accounted_count !== INTERIM_OPERATING_PROFILE_COUNT
    || proposal.derived_profile_count !== INTERIM_OPERATING_PROFILE_COUNT
    || !Array.isArray(proposal.proposed_partition.proposed_profiles)
    || proposal.proposed_partition.proposed_profiles.length !== INTERIM_OPERATING_PROFILE_COUNT
    || proposal.proposed_partition.source_unit_assignment_count
      !== INTERIM_OPERATING_PROFILE_COUNT
    || proposal.proposed_partition.m4_claim_assignment_count !== INTERIM_OPERATING_PROFILE_COUNT
  ) {
    fail(code, 'Phase4 fresh Phase2 proposal drift.');
  }
  const unsigned = { ...proposal };
  delete unsigned.proposal_id;
  if (contentId(proposal.schema_version, unsigned) !== proposal.proposal_id) {
    fail(code, 'Phase4 fresh Phase2 proposal identity drift.');
  }
}

function interimOperatingPhase4DeriveProfiles(authority, phase2Proposal) {
  const scheduleCode = INTERIM_OPERATING_PHASE4_REVIEW_CODES.PROFILE_SCHEDULE;
  const schedule = authority.profile_review_schedule;
  const scheduleContract = authority.profile_review_schedule_contract;
  const outputContract = authority.candidate_output_contract;
  const phase2Profiles = [...phase2Proposal.proposed_partition.proposed_profiles]
    .sort((left, right) => compareStrings(
      left.proposed_profile_key,
      right.proposed_profile_key,
    ));
  const proposedProfileKeys = phase2Profiles.map((profile) => profile.proposed_profile_key);
  if (!sameValue(proposedProfileKeys, schedule.map((profile) => profile.proposed_profile_key))) {
    fail(scheduleCode, 'Phase4 profile schedule order drift.');
  }

  return phase2Profiles.map((phase2Profile, index) => {
    const expected = schedule[index];
    if (
      !exactKeys(phase2Profile.canonical_tuple, scheduleContract.canonical_tuple_base_exact_keys)
      || expected.proposed_profile_key !== phase2Profile.proposed_profile_key
      || expected.package_profile_key !== [
        'PROFILE',
        'INTERIM_OPERATING',
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
      if (key === 'package_profile_key') return [key, expected.package_profile_key];
      if (key === 'proposed_validation') return [key, clone(expected.proposed_validation)];
      if (key === 'review_flags') return [key, clone(expected.review_flags)];
      if (key === 'missing_required_field_keys') {
        return [key, clone(expected.missing_required_field_keys)];
      }
      if (key === 'authorised_component_ids') {
        return [key, clone(phase2Profile.authorised_component_ids)];
      }
      if (key === 'canonical_tuple') return [key, clone(phase2Profile.canonical_tuple)];
      if (key === 'm4_claim_ids') return [key, clone(phase2Profile.m4_claim_ids)];
      if (key === 'source_unit_keys') return [key, clone(phase2Profile.source_unit_keys)];
      return [key, phase2Profile.proposed_profile_key];
    }));
  });
}

function prepareInterimOperatingFamilyProfilePackageReview(input) {
  const contractCode = INTERIM_OPERATING_PHASE4_REVIEW_CODES.CONTRACT;
  exactKeysOrFail(
    input,
    INTERIM_OPERATING_PHASE4_REVIEW_INPUT_KEYS,
    contractCode,
    'Interim Operating Phase4 package review input',
  );
  const authorityEnvelope = validateInterimOperatingPhase4FamilyProfilePackageReviewAuthority(
    input.interimOperatingAuthoringPhase4FamilyProfilePackageReviewAuthority,
  );
  const authority = authorityEnvelope.record;
  const phase2AuthorityEnvelope = validateInterimOperatingProposalAuthority(
    input.interimOperatingAuthoringPhase2Authority,
  );
  if (
    phase2AuthorityEnvelope.binding.record_id
      !== authority.immutable_parent_bindings
        .interim_operating_authoring_phase2_authority.record_id
  ) {
    fail(
      INTERIM_OPERATING_PHASE4_REVIEW_CODES.AUTHORITY,
      'Phase4 parent Phase2 authority pin drift.',
    );
  }
  validateInterimOperatingProposalGovernedSources(
    phase2AuthorityEnvelope.record,
    input.governedSources,
  );

  let phase2Proposal;
  try {
    phase2Proposal = prepareInterimOperatingPhase2FamilyProposal({
      interimOperatingAuthoringPhase2Authority: input.interimOperatingAuthoringPhase2Authority,
      governedSources: input.governedSources,
    });
  } catch (error) {
    fail(
      INTERIM_OPERATING_PHASE4_REVIEW_CODES.PHASE2_PROPOSAL,
      'Phase4 fresh Phase2 proposal failed.',
      { cause_code: typeof error.code === 'string' ? error.code : null },
    );
  }
  interimOperatingPhase4ValidatePhase2Proposal(phase2Proposal);
  const proposedProfiles = interimOperatingPhase4DeriveProfiles(authority, phase2Proposal);
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
    schema_version: INTERIM_OPERATING_PHASE4_CANDIDATE_SCHEMA,
    family_key: 'INTERIM_OPERATING',
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
    review_candidate_id: contentId(unsignedCandidate.schema_version, unsignedCandidate),
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
    !exactKeys(candidate, INTERIM_OPERATING_PHASE4_REVIEW_OUTPUT_KEYS)
    || proposedProfiles.length !== INTERIM_OPERATING_PROFILE_COUNT
    || proposedProfiles.some((profile) => (
      !exactKeys(profile, outputContract.profile_exact_keys)
      || !exactKeys(profile.proposed_validation, outputContract.proposed_validation_exact_keys)
      || !profile.review_flags.includes(INTERIM_OPERATING_REVIEW_FLAGS.LEGAL_GROUPING)
    ))
    || proposedProfiles.filter((profile) => profile.review_flags.includes(
      INTERIM_OPERATING_REVIEW_FLAGS.SUBTYPE_DIVERGENCE,
    )).length !== INTERIM_OPERATING_SUBTYPE_DIVERGENCE_PROFILE_COUNT
    || proposedProfiles.filter((profile) => profile.review_flags.includes(
      INTERIM_OPERATING_REVIEW_FLAGS.OUTSIDE_CALIBRATION,
    )).length !== INTERIM_OPERATING_OUTSIDE_CALIBRATION_PROFILE_COUNT
    || !sameValue(candidate.review_accounting, outputContract.review_accounting_exact_values)
    || !sameValue(candidate.unresolved_items, outputContract.unresolved_items)
    || !sameValue(candidate.withheld_work3_fields, outputContract.withheld_work3_fields)
    || !sameValue(candidate.first_legal_stop, authority.first_legal_stop_contract)
    || !sameValue(candidate.zero_effect_boundary, authority.zero_effect_boundary)
    || interimOperatingContainsForbiddenKey(candidate, forbiddenKeys)
  ) {
    fail(
      INTERIM_OPERATING_PHASE4_REVIEW_CODES.REVIEW_OUTPUT,
      'Phase4 package review output boundary drift.',
    );
  }
  return deepFreeze(clone(candidate));
}

const INTERIM_OPERATING_WORK3_CONTROL_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control';

/**
 * Q01-Q03 are answered by the sealed programme rulings the M5 role schema already
 * binds, not by a Interim Operating-specific ruling note. Nothing here invents a
 * lawyer decision.
 */
const INTERIM_OPERATING_WORK3_RULINGS_BINDING = Object.freeze({
  byte_length: 1519,
  path: `${INTERIM_OPERATING_WORK3_CONTROL_PATH}/m5-programme-rulings.json`,
  sha256: '2711dc5c958da271bfd86a154712c251978ac1f1aec713d22302946bf8f87497',
});
const INTERIM_OPERATING_WORK3_INVENTORY_AUTHORITY_BINDING = Object.freeze({
  byte_length: 2143,
  path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-interim-operating-unapproved-inventory-review-authority.json',
  record_id: '2f7e0f950dc99cf6a248622ebf096c581d81c59964aa6499c1753e27bc1d3d64',
  record_id_field: 'work3_interim_operating_unapproved_inventory_review_authority_id',
  schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_INTERIM_OPERATING_UNAPPROVED_INVENTORY_REVIEW_AUTHORITY/V1',
  sha256: 'e142c3f907db2b8443034375a63cc7a994f0752887db87b46b049d70722357f6',
});
const INTERIM_OPERATING_WORK3_PACKET_BINDING = Object.freeze({
  byte_length: 129268,
  path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-interim-operating-113-profile-inventory-review-packet-draft.json',
  record_id: '4227e263550d0be3688f3ce70dcc2384db6ef06020edd4b4bb39005e26867cc3',
  record_id_field: 'inventory_review_packet_id',
  schema_version: 'STAGE_2Y_M7_V2_INTERIM_OPERATING_113_PROFILE_INVENTORY_REVIEW_PACKET/V1',
  sha256: '6a96d87205fceba135708866084c90c042d4f6fc142551faa77c51f6b282fa83',
});
const INTERIM_OPERATING_WORK3_DISPOSITION_BINDING = Object.freeze({
  byte_length: 39759,
  path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-interim-operating-113-profile-inventory-disposition.json',
  record_id: '26d4a2b856351019383bb40b0dfd43bec7459b619c87100e7b61d30e8663eb70',
  record_id_field: 'inventory_disposition_id',
  schema_version: 'STAGE_2Y_M7_V2_INTERIM_OPERATING_113_PROFILE_INVENTORY_DISPOSITION/V1',
  sha256: '39bed2651c04612b13f7aebb3a70754b47eccffc48df511c4b7f2c04efd83e6c',
});
const INTERIM_OPERATING_WORK3_SESSION_BINDING = Object.freeze({
  byte_length: 1137,
  path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-interim-operating-ben-inventory-session-receipt.json',
  record_id: '9c86a0bc063ab90694836c526696df17eab5cfbf560b1e02711b4da4eac4bb0f',
  record_id_field: 'ben_inventory_session_receipt_id',
  schema_version: 'STAGE_2Y_M7_V2_INTERIM_OPERATING_BEN_INVENTORY_SESSION_RECEIPT/V1',
  sha256: '9e276c95eb209ac5dd446447dec57866a9bb8a4c437ebddd3a991a84b5aa54ee',
});
const INTERIM_OPERATING_WORK3_BEN_AUTHORITY_BINDING = Object.freeze({
  byte_length: 2842,
  path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-interim-operating-ben-inventory-session-successor-authority.json',
  record_id: 'bd40a0e5344f82bc831f7dc7a817e7fb1dfce1f21d2af9a2ec8b51fd44811f41',
  record_id_field: 'work3_interim_operating_ben_inventory_session_successor_authority_id',
  schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_INTERIM_OPERATING_BEN_INVENTORY_SESSION_SUCCESSOR_AUTHORITY/V1',
  sha256: 'ae92136400c07668a0bc87944f3bb6c01fcb39c916e2fa998f29327b47d426df',
});
const INTERIM_OPERATING_WORK3_SEAL_AUTHORITY_BINDING = Object.freeze({
  byte_length: 3363,
  path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-interim-operating-family-package-seal-successor-authority.json',
  record_id: '50d77232f2e758783b94fd6b570cd23f0283b0cdbaf15d4e1e04c4a49fdb5dd0',
  record_id_field: 'work3_interim_operating_family_package_seal_successor_authority_id',
  schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_INTERIM_OPERATING_FAMILY_PACKAGE_SEAL_SUCCESSOR_AUTHORITY/V1',
  sha256: 'af81c93c0504109f15975fffef9ffaf1ecd909cf9ff4716d4c8b7443e9407fba',
});
const INTERIM_OPERATING_WORK3_SEAL_RECEIPT_BINDING = Object.freeze({
  byte_length: 2301,
  path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-interim-operating-family-package-seal-receipt.json',
  record_id: '32ab4e7567d7ca44a8e9475f635ab98197bb51ea38fd0f2bcbe31a8fc5092da7',
  record_id_field: 'interim_operating_family_package_seal_receipt_id',
  schema_version: 'STAGE_2Y_M7_V2_INTERIM_OPERATING_FAMILY_PACKAGE_SEAL_RECEIPT/V1',
  sha256: 'c122ea458f115210321c16db904294874414bd179f3463632d9be02ab0adf258',
});
const INTERIM_OPERATING_WORK3_REGISTRATION_AUTHORITY_BINDING = Object.freeze({
  byte_length: 2895,
  path: 'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-work3-interim-operating-registration-successor-authority.json',
  record_id: '6bb0511d04ec6994ba4365f8653f89e1095da466f07c05d4eeaad6847876b902',
  record_id_field: 'work3_interim_operating_registration_successor_authority_id',
  schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_INTERIM_OPERATING_REGISTRATION_SUCCESSOR_AUTHORITY/V1',
  sha256: '292b1a8fb16424a8845fa65e0ccbfcf2fc1837ee7349d676f9c77c87d6beac29',
});

const INTERIM_OPERATING_WORK3_CODES = Object.freeze({
  CONTRACT: 'M7_V2_INTERIM_OPERATING_WORK3_CONTRACT',
  AUTHORITY: 'M7_V2_INTERIM_OPERATING_WORK3_AUTHORITY',
  INVENTORY: 'M7_V2_INTERIM_OPERATING_WORK3_INVENTORY',
  DISPOSITION: 'M7_V2_INTERIM_OPERATING_WORK3_DISPOSITION',
  RECEIPT: 'M7_V2_INTERIM_OPERATING_WORK3_RECEIPT',
  OUTPUT: 'M7_V2_INTERIM_OPERATING_WORK3_OUTPUT',
});

const INTERIM_OPERATING_WORK3_WITHHELD_FIELDS = Object.freeze([
  'activation_id',
  'family_profile_package_id',
  'profile_id',
  'registration_id',
]);

function interimOperatingWork3ValidatePinnedEnvelope(envelope, expected, label) {
  validateEnvelopeShape(envelope, INTERIM_OPERATING_WORK3_CODES.AUTHORITY, label);
  if (!sameValue(envelope.binding, expected)) {
    fail(INTERIM_OPERATING_WORK3_CODES.AUTHORITY, `${label} binding drift.`);
  }
  validateBoundRecord(envelope, INTERIM_OPERATING_WORK3_CODES.AUTHORITY, label);
  const unsigned = clone(envelope.record);
  delete unsigned[expected.record_id_field];
  if (expected.record_id_field === 'inventory_disposition_id') {
    delete unsigned.session_receipt_id;
  }
  if (contentId(envelope.record.schema_version, unsigned) !== expected.record_id) {
    fail(INTERIM_OPERATING_WORK3_CODES.AUTHORITY, `${label} self identity drift.`);
  }
  return deepFreeze(clone(envelope));
}

function interimOperatingWork3ValidateInput(input, outerKeys, evidenceKey, evidenceKeys) {
  exactKeysOrFail(
    input,
    outerKeys,
    INTERIM_OPERATING_WORK3_CODES.CONTRACT,
    'Interim Operating Work3 input',
  );
  const evidence = input[evidenceKey];
  exactKeysOrFail(
    evidence,
    evidenceKeys,
    INTERIM_OPERATING_WORK3_CODES.CONTRACT,
    'Interim Operating Work3 evidence bundle',
  );
  for (const key of evidenceKeys) {
    if (
      !isObject(evidence[key])
      || !isObject(evidence[key].binding)
      || !isObject(evidence[key].record)
    ) {
      fail(
        INTERIM_OPERATING_WORK3_CODES.CONTRACT,
        `Interim Operating Work3 ${key} envelope drift.`,
      );
    }
  }
  return evidence;
}

function interimOperatingWork3Phase4(input) {
  try {
    return prepareInterimOperatingFamilyProfilePackageReview(input);
  } catch (error) {
    fail(
      INTERIM_OPERATING_WORK3_CODES.INVENTORY,
      'Interim Operating Work3 Phase4 review derivation failed.',
      { cause_code: typeof error.code === 'string' ? error.code : null },
    );
  }
}

function validateInterimOperatingUnapprovedInventoryReviewEvidence(evidence) {
  if (
    !isObject(evidence)
    || evidence.profile_approval_state !== 'UNAPPROVED'
    || evidence.profile_count !== INTERIM_OPERATING_PROFILE_COUNT
    || evidence.complete_profile_count !== INTERIM_OPERATING_PROFILE_COUNT
    || evidence.incomplete_profile_count !== 0
    || !Array.isArray(evidence.proposed_profiles)
    || evidence.proposed_profiles.length !== INTERIM_OPERATING_PROFILE_COUNT
    || !Array.isArray(evidence.retained_source_gaps)
    || evidence.retained_source_gaps.length !== 0
    || sortedUnique(evidence.proposed_profiles.map((profile) => profile.proposed_profile_key))
      .length !== INTERIM_OPERATING_PROFILE_COUNT
  ) {
    fail(
      INTERIM_OPERATING_WORK3_CODES.INVENTORY,
      'Interim Operating unapproved inventory review evidence census drift.',
    );
  }
  return deepFreeze({
    schema_version: 'M7_V2_INTERIM_OPERATING_UNAPPROVED_INVENTORY_REVIEW_VALIDATOR_ACCEPTANCE/V1',
    status: 'PASS',
    profile_count: INTERIM_OPERATING_PROFILE_COUNT,
    complete_profile_count: INTERIM_OPERATING_PROFILE_COUNT,
    incomplete_profile_count: 0,
    retained_source_gap_count: 0,
  });
}

function prepareInterimOperatingWork3UnapprovedInventoryReview(input) {
  const evidence = interimOperatingWork3ValidateInput(
    input,
    [
      'interimOperatingWork3UnapprovedInventoryReviewEvidence',
      'interimOperatingPhase4ReviewInput',
    ],
    'interimOperatingWork3UnapprovedInventoryReviewEvidence',
    ['work3InterimOperatingUnapprovedInventoryReviewAuthority'],
  );
  const authorityEnvelope = interimOperatingWork3ValidatePinnedEnvelope(
    evidence.work3InterimOperatingUnapprovedInventoryReviewAuthority,
    INTERIM_OPERATING_WORK3_INVENTORY_AUTHORITY_BINDING,
    'Interim Operating Work3 inventory authority',
  );
  const phase4 = interimOperatingWork3Phase4(input.interimOperatingPhase4ReviewInput);
  const validator = validateInterimOperatingUnapprovedInventoryReviewEvidence({
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
      profile_count: INTERIM_OPERATING_PROFILE_COUNT,
      complete_profile_count: INTERIM_OPERATING_PROFILE_COUNT,
      incomplete_profile_count: 0,
      retained_source_gap_count: 0,
    },
    validator_acceptance_reference: clone(validator),
    review_accounting: clone(contract.review_accounting_exact_values),
    withheld_work3_fields: clone(INTERIM_OPERATING_WORK3_WITHHELD_FIELDS),
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

function interimOperatingWork3ValidatePacket(envelope) {
  interimOperatingWork3ValidatePinnedEnvelope(
    envelope,
    INTERIM_OPERATING_WORK3_PACKET_BINDING,
    'Interim Operating inventory packet',
  );
  const record = envelope.record;
  const items = record.profile_review_items;
  if (
    record.profile_count !== INTERIM_OPERATING_PROFILE_COUNT
    || record.complete_profile_count !== INTERIM_OPERATING_PROFILE_COUNT
    || record.incomplete_profile_count !== 0
    || record.retained_source_gap_count !== 0
    || !Array.isArray(items)
    || items.length !== INTERIM_OPERATING_PROFILE_COUNT
    || items.some((item) => typeof item.shape_summary !== 'string' || item.shape_summary === '')
    || items.filter((item) => item.review_flags.includes(
      INTERIM_OPERATING_REVIEW_FLAGS.LEGAL_GROUPING,
    )).length !== INTERIM_OPERATING_PROFILE_COUNT
    || items.filter((item) => item.review_flags.includes(
      INTERIM_OPERATING_REVIEW_FLAGS.SUBTYPE_DIVERGENCE,
    )).length !== INTERIM_OPERATING_SUBTYPE_DIVERGENCE_PROFILE_COUNT
    || items.filter((item) => item.review_flags.includes(
      INTERIM_OPERATING_REVIEW_FLAGS.OUTSIDE_CALIBRATION,
    )).length !== INTERIM_OPERATING_OUTSIDE_CALIBRATION_PROFILE_COUNT
  ) {
    fail(
      INTERIM_OPERATING_WORK3_CODES.INVENTORY,
      'Interim Operating inventory packet census drift.',
    );
  }
  return record;
}

function interimOperatingWork3ValidateDisposition(envelope) {
  interimOperatingWork3ValidatePinnedEnvelope(
    envelope,
    INTERIM_OPERATING_WORK3_DISPOSITION_BINDING,
    'Interim Operating Ben disposition',
  );
  const record = envelope.record;
  const rows = record.profile_dispositions;
  const summary = record.session_summary;
  if (
    record.reviewer !== 'BEN_GOODCHILD'
    || record.default_disposition_applied !== true
    || record.packet_digest !== INTERIM_OPERATING_WORK3_PACKET_BINDING.sha256
    || record.ben_rulings_digest !== INTERIM_OPERATING_WORK3_RULINGS_BINDING.sha256
    || !Array.isArray(rows)
    || rows.length !== INTERIM_OPERATING_PROFILE_COUNT
    || rows.filter((row) => row.disposition === 'APPROVE').length
      !== INTERIM_OPERATING_PROFILE_COUNT
    || summary.approved_count !== INTERIM_OPERATING_PROFILE_COUNT
    || summary.hold_count !== 0
    || summary.legal_grouping_review_pending_count !== INTERIM_OPERATING_PROFILE_COUNT
    || summary.subtype_partition_divergence_count
      !== INTERIM_OPERATING_SUBTYPE_DIVERGENCE_PROFILE_COUNT
    || summary.outside_calibration_example_count
      !== INTERIM_OPERATING_OUTSIDE_CALIBRATION_PROFILE_COUNT
    || summary.subtype_grouping_pending_legal !== true
    || summary.taxonomy_expansion_acknowledged !== true
  ) {
    fail(
      INTERIM_OPERATING_WORK3_CODES.DISPOSITION,
      'Interim Operating Ben inventory disposition drift.',
    );
  }
  return record;
}

function prepareInterimOperatingWork3BenInventorySessionDisposition(input) {
  const evidenceKeys = [
    'work3InterimOperatingUnapprovedInventoryReviewAuthority',
    'work3InterimOperatingBenInventorySessionSuccessorAuthority',
    'inventoryReviewPacketDraft',
    'benAuthoredInventoryDisposition',
  ];
  const evidence = interimOperatingWork3ValidateInput(
    input,
    [
      'interimOperatingWork3BenInventorySessionDispositionEvidence',
      'interimOperatingPhase4ReviewInput',
    ],
    'interimOperatingWork3BenInventorySessionDispositionEvidence',
    evidenceKeys,
  );
  const authorityEnvelope = interimOperatingWork3ValidatePinnedEnvelope(
    evidence.work3InterimOperatingBenInventorySessionSuccessorAuthority,
    INTERIM_OPERATING_WORK3_BEN_AUTHORITY_BINDING,
    'Interim Operating Ben inventory authority',
  );
  interimOperatingWork3ValidatePacket(evidence.inventoryReviewPacketDraft);
  const disposition = interimOperatingWork3ValidateDisposition(
    evidence.benAuthoredInventoryDisposition,
  );
  const inventory = prepareInterimOperatingWork3UnapprovedInventoryReview({
    interimOperatingWork3UnapprovedInventoryReviewEvidence: {
      work3InterimOperatingUnapprovedInventoryReviewAuthority:
        evidence.work3InterimOperatingUnapprovedInventoryReviewAuthority,
    },
    interimOperatingPhase4ReviewInput: input.interimOperatingPhase4ReviewInput,
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
      path: INTERIM_OPERATING_WORK3_DISPOSITION_BINDING.path,
      inventory_disposition_id: disposition.inventory_disposition_id,
      packet_digest: disposition.packet_digest,
      profile_disposition_count: INTERIM_OPERATING_PROFILE_COUNT,
      session_summary: clone(disposition.session_summary),
    },
    packet_binding: clone(INTERIM_OPERATING_WORK3_PACKET_BINDING),
    ben_rulings_binding: clone(INTERIM_OPERATING_WORK3_RULINGS_BINDING),
    session_receipt_reference: {
      schema_version: INTERIM_OPERATING_WORK3_SESSION_BINDING.schema_version,
      ben_inventory_session_receipt_id: disposition.session_receipt_id,
      completion_state: 'COMPLETE',
    },
    review_accounting: clone(contract.review_accounting_exact_values),
    withheld_work3_fields: clone(INTERIM_OPERATING_WORK3_WITHHELD_FIELDS),
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

function interimOperatingWork3ValidateSessionReceipt(envelope) {
  interimOperatingWork3ValidatePinnedEnvelope(
    envelope,
    INTERIM_OPERATING_WORK3_SESSION_BINDING,
    'Interim Operating Ben session receipt',
  );
  const record = envelope.record;
  if (
    record.completion_state !== 'COMPLETE'
    || record.disposition_binding.inventory_disposition_id
      !== INTERIM_OPERATING_WORK3_DISPOSITION_BINDING.record_id
    || record.zero_effect_boundary.work3_identity_count !== 0
  ) {
    fail(
      INTERIM_OPERATING_WORK3_CODES.RECEIPT,
      'Interim Operating Ben session receipt drift.',
    );
  }
  return record;
}

function prepareInterimOperatingWork3FamilyPackageSeal(input) {
  const evidenceKeys = [
    'work3InterimOperatingUnapprovedInventoryReviewAuthority',
    'work3InterimOperatingBenInventorySessionSuccessorAuthority',
    'work3InterimOperatingFamilyPackageSealSuccessorAuthority',
    'inventoryReviewPacketDraft',
    'benAuthoredInventoryDisposition',
    'benInventorySessionReceipt',
  ];
  const evidence = interimOperatingWork3ValidateInput(
    input,
    [
      'interimOperatingWork3FamilyPackageSealEvidence',
      'interimOperatingPhase4ReviewInput',
    ],
    'interimOperatingWork3FamilyPackageSealEvidence',
    evidenceKeys,
  );
  const authorityEnvelope = interimOperatingWork3ValidatePinnedEnvelope(
    evidence.work3InterimOperatingFamilyPackageSealSuccessorAuthority,
    INTERIM_OPERATING_WORK3_SEAL_AUTHORITY_BINDING,
    'Interim Operating family package seal authority',
  );
  const dispositionCandidate = prepareInterimOperatingWork3BenInventorySessionDisposition({
    interimOperatingWork3BenInventorySessionDispositionEvidence: {
      work3InterimOperatingUnapprovedInventoryReviewAuthority:
        evidence.work3InterimOperatingUnapprovedInventoryReviewAuthority,
      work3InterimOperatingBenInventorySessionSuccessorAuthority:
        evidence.work3InterimOperatingBenInventorySessionSuccessorAuthority,
      inventoryReviewPacketDraft: evidence.inventoryReviewPacketDraft,
      benAuthoredInventoryDisposition: evidence.benAuthoredInventoryDisposition,
    },
    interimOperatingPhase4ReviewInput: input.interimOperatingPhase4ReviewInput,
  });
  interimOperatingWork3ValidateSessionReceipt(evidence.benInventorySessionReceipt);
  if (
    dispositionCandidate.session_receipt_reference.ben_inventory_session_receipt_id
      !== evidence.benInventorySessionReceipt.record.ben_inventory_session_receipt_id
  ) {
    fail(
      INTERIM_OPERATING_WORK3_CODES.RECEIPT,
      'Interim Operating session receipt identity drift.',
    );
  }
  const contract = authorityEnvelope.record.schema_review_candidate_contract;
  const unsigned = {
    schema_version: contract.schema_version,
    candidate_state: contract.candidate_state,
    authority_binding: clone(authorityEnvelope.binding),
    inventory_session_disposition_reference: {
      inventory_disposition_id: INTERIM_OPERATING_WORK3_DISPOSITION_BINDING.record_id,
      candidate_state: dispositionCandidate.candidate_state,
    },
    ben_rulings_binding: clone(INTERIM_OPERATING_WORK3_RULINGS_BINDING),
    disposition_binding: clone(INTERIM_OPERATING_WORK3_DISPOSITION_BINDING),
    session_receipt_binding: clone(INTERIM_OPERATING_WORK3_SESSION_BINDING),
    legal_grouping_disposition_binding: {
      ...clone(INTERIM_OPERATING_WORK3_RULINGS_BINDING),
      disposition_status: 'PENDING_LEGAL_REVIEW',
      legal_grouping_review_pending_count: INTERIM_OPERATING_PROFILE_COUNT,
      outside_calibration_example_count: INTERIM_OPERATING_OUTSIDE_CALIBRATION_PROFILE_COUNT,
      populated_subtype_bucket_count: INTERIM_OPERATING_POPULATED_SUBTYPE_BUCKET_COUNT,
      registered_subtype_bucket_count: INTERIM_OPERATING_REGISTERED_SUBTYPE_BUCKET_COUNT,
      subtype_partition_divergence_count: INTERIM_OPERATING_SUBTYPE_DIVERGENCE_PROFILE_COUNT,
    },
    review_accounting: clone(contract.review_accounting_exact_values),
    withheld_work3_fields: clone(INTERIM_OPERATING_WORK3_WITHHELD_FIELDS),
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

function interimOperatingWork3ValidateSealReceipt(envelope) {
  interimOperatingWork3ValidatePinnedEnvelope(
    envelope,
    INTERIM_OPERATING_WORK3_SEAL_RECEIPT_BINDING,
    'Interim Operating family seal receipt',
  );
  const record = envelope.record;
  if (
    record.completion_state !== 'COMPLETE'
    || record.reviewer !== 'BEN_GOODCHILD'
    || record.disposition_binding.record_id
      !== INTERIM_OPERATING_WORK3_DISPOSITION_BINDING.record_id
    || record.legal_grouping_disposition_binding.disposition_status !== 'PENDING_LEGAL_REVIEW'
    || record.zero_effect_boundary.work3_identity_count !== 0
  ) {
    fail(
      INTERIM_OPERATING_WORK3_CODES.RECEIPT,
      'Interim Operating family seal receipt drift.',
    );
  }
  return record;
}

function prepareInterimOperatingWork3FamilyPackageRegistration(input) {
  const evidenceKeys = [
    'work3InterimOperatingUnapprovedInventoryReviewAuthority',
    'work3InterimOperatingBenInventorySessionSuccessorAuthority',
    'work3InterimOperatingFamilyPackageSealSuccessorAuthority',
    'work3InterimOperatingRegistrationSuccessorAuthority',
    'inventoryReviewPacketDraft',
    'benAuthoredInventoryDisposition',
    'benInventorySessionReceipt',
    'familyPackageSealReceipt',
  ];
  const evidence = interimOperatingWork3ValidateInput(
    input,
    [
      'interimOperatingWork3FamilyPackageRegistrationEvidence',
      'interimOperatingPhase4ReviewInput',
    ],
    'interimOperatingWork3FamilyPackageRegistrationEvidence',
    evidenceKeys,
  );
  const authorityEnvelope = interimOperatingWork3ValidatePinnedEnvelope(
    evidence.work3InterimOperatingRegistrationSuccessorAuthority,
    INTERIM_OPERATING_WORK3_REGISTRATION_AUTHORITY_BINDING,
    'Interim Operating registration authority',
  );
  const sealCandidate = prepareInterimOperatingWork3FamilyPackageSeal({
    interimOperatingWork3FamilyPackageSealEvidence: {
      work3InterimOperatingUnapprovedInventoryReviewAuthority:
        evidence.work3InterimOperatingUnapprovedInventoryReviewAuthority,
      work3InterimOperatingBenInventorySessionSuccessorAuthority:
        evidence.work3InterimOperatingBenInventorySessionSuccessorAuthority,
      work3InterimOperatingFamilyPackageSealSuccessorAuthority:
        evidence.work3InterimOperatingFamilyPackageSealSuccessorAuthority,
      inventoryReviewPacketDraft: evidence.inventoryReviewPacketDraft,
      benAuthoredInventoryDisposition: evidence.benAuthoredInventoryDisposition,
      benInventorySessionReceipt: evidence.benInventorySessionReceipt,
    },
    interimOperatingPhase4ReviewInput: input.interimOperatingPhase4ReviewInput,
  });
  const sealReceipt = interimOperatingWork3ValidateSealReceipt(
    evidence.familyPackageSealReceipt,
  );
  if (sealReceipt.family_package_seal_id !== sealCandidate.family_package_seal_id) {
    fail(
      INTERIM_OPERATING_WORK3_CODES.RECEIPT,
      'Interim Operating family seal candidate and receipt identity drift.',
    );
  }
  const phase4 = interimOperatingWork3Phase4(input.interimOperatingPhase4ReviewInput);
  const dispositionByKey = new Map(
    evidence.benAuthoredInventoryDisposition.record.profile_dispositions.map(
      (row) => [row.proposed_profile_key, row],
    ),
  );
  const registeredProfiles = phase4.proposed_profiles.map((profile) => {
    const disposition = dispositionByKey.get(profile.proposed_profile_key);
    if (!disposition) {
      fail(
        INTERIM_OPERATING_WORK3_CODES.OUTPUT,
        'Interim Operating registration disposition missing.',
      );
    }
    const identityInput = {
      family_key: 'INTERIM_OPERATING',
      proposed_profile_key: profile.proposed_profile_key,
      phase3_profile_key: null,
      profile_set_version: 1,
    };
    return {
      profile_id: contentId(
        'M7_V2_INTERIM_OPERATING_WORK3_REGISTERED_PROFILE_IDENTITY/V1',
        identityInput,
      ),
      proposed_profile_key: profile.proposed_profile_key,
      phase3_profile_key: null,
      inventory_disposition: disposition.disposition,
      legal_grouping_pending_acknowledged: disposition.legal_grouping_pending_acknowledged,
    };
  });
  const packageUnsigned = {
    family_key: 'INTERIM_OPERATING',
    profile_set_version: 1,
    package_state: 'BEN_SEALED_IN_MEMORY_REGISTRATION_ONLY',
    profile_id_count: INTERIM_OPERATING_PROFILE_COUNT,
    profile_ids: registeredProfiles.map((profile) => profile.profile_id),
    inventory_disposition_id: INTERIM_OPERATING_WORK3_DISPOSITION_BINDING.record_id,
    family_package_seal_receipt_id: INTERIM_OPERATING_WORK3_SEAL_RECEIPT_BINDING.record_id,
    legal_grouping_disposition_state: 'PENDING_LEGAL_REVIEW',
  };
  const packageIdentity = {
    family_profile_package_id: contentId(
      'M7_V2_INTERIM_OPERATING_WORK3_FAMILY_PROFILE_PACKAGE_IDENTITY/V1',
      packageUnsigned,
    ),
    family_key: packageUnsigned.family_key,
    profile_set_version: 1,
    package_state: packageUnsigned.package_state,
    profile_id_count: INTERIM_OPERATING_PROFILE_COUNT,
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
    family_package_seal_receipt_binding: clone(INTERIM_OPERATING_WORK3_SEAL_RECEIPT_BINDING),
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
      state: 'STOP_AFTER_INTERIM_OPERATING_FAMILY_PACKAGE_REGISTRATION_BEFORE_ACTIVATION',
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
    result.registered_profile_identities.length !== INTERIM_OPERATING_PROFILE_COUNT
    || result.review_accounting.profile_identity_count !== INTERIM_OPERATING_PROFILE_COUNT
    || result.review_accounting.work3_identity_count !== INTERIM_OPERATING_PROFILE_COUNT + 1
    || result.zero_effect_boundary.activation_count !== 0
    || interimOperatingContainsForbiddenKey(result, new Set(['activation_id']))
  ) {
    fail(
      INTERIM_OPERATING_WORK3_CODES.OUTPUT,
      'Interim Operating family registration boundary drift.',
    );
  }
  return result;
}

module.exports = {
  INTERIM_OPERATING_OUTSIDE_CALIBRATION_PROFILE_COUNT,
  INTERIM_OPERATING_PHASE2_AUTHORITY_BYTES,
  INTERIM_OPERATING_PHASE2_AUTHORITY_ID,
  INTERIM_OPERATING_PHASE2_AUTHORITY_PATH,
  INTERIM_OPERATING_PHASE2_AUTHORITY_SCHEMA,
  INTERIM_OPERATING_PHASE2_AUTHORITY_SHA256,
  INTERIM_OPERATING_PHASE2_PROPOSAL_CODES,
  INTERIM_OPERATING_PHASE2_PROPOSAL_KEYS,
  INTERIM_OPERATING_PHASE4_AUTHORITY_BYTES,
  INTERIM_OPERATING_PHASE4_AUTHORITY_ID,
  INTERIM_OPERATING_PHASE4_AUTHORITY_PATH,
  INTERIM_OPERATING_PHASE4_AUTHORITY_SCHEMA,
  INTERIM_OPERATING_PHASE4_AUTHORITY_SHA256,
  INTERIM_OPERATING_PHASE4_CANDIDATE_SCHEMA,
  INTERIM_OPERATING_PHASE4_CANDIDATE_STATE,
  INTERIM_OPERATING_PHASE4_REVIEW_CODES,
  INTERIM_OPERATING_PHASE4_REVIEW_INPUT_KEYS,
  INTERIM_OPERATING_PHASE4_REVIEW_OUTPUT_KEYS,
  INTERIM_OPERATING_PHASE4_SCHEDULE_SHA256,
  INTERIM_OPERATING_POPULATED_SUBTYPE_BUCKET_COUNT,
  INTERIM_OPERATING_PROFILE_COUNT,
  INTERIM_OPERATING_REGISTERED_SUBTYPE_BUCKET_COUNT,
  INTERIM_OPERATING_REVIEW_FLAGS,
  INTERIM_OPERATING_SUBTYPE_DIVERGENCE_PROFILE_COUNT,
  interimOperatingProposalPartition,
  prepareInterimOperatingFamilyProfilePackageReview,
  prepareInterimOperatingPhase2FamilyProposal,
  prepareInterimOperatingWork3BenInventorySessionDisposition,
  prepareInterimOperatingWork3FamilyPackageRegistration,
  prepareInterimOperatingWork3FamilyPackageSeal,
  prepareInterimOperatingWork3UnapprovedInventoryReview,
  validateInterimOperatingUnapprovedInventoryReviewEvidence,
};
