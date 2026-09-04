'use strict';

/**
 * Family-local M7 V2 repair authoring for CONSIDERATION (N1 family #15).
 *
 * Milestone A ladder, D&O-minimal path (Phase 3 reference chain skipped, because
 * every calibration provision example has an empty m3_dependency_ids list):
 *   Phase 2 partition -> Phase 4 package review -> Work3 inventory review ->
 *   Ben inventory session disposition -> family package seal -> registration.
 *
 * Deliberately self-contained: the shared spine (m7-v2-profile-authoring.js) is on a
 * separate merge track, so the helpers below are adapted copies rather than imports.
 *
 * The 7 profiles are claim-scale, one per governed comparator M4 claim across the
 * four comparator deals (Metsera, Red Hat, Skechers, TopBuild). Skechers §2.7 carries
 * two independently operative per-share cash election limbs plus appraisal linkage;
 * Q01 requires one profile per limb, not one per section.
 *
 * Subtype grouping is an open legal question — the sealed M5 role schema admits both
 * claim definition keys under all ten subtype buckets — so every profile carries
 * LEGAL_GROUPING_REVIEW_REQUIRED; all seven rows additionally carry
 * SUBTYPE_PARTITION_DIVERGES_FROM_CALIBRATION_PROPOSED_SUBTYPE because the
 * calibration pack tags every provision example CONSIDERATION_PACKAGE; and the family
 * seal records PENDING_LEGAL_REVIEW rather than a resolved taxonomy.
 */

const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');

const CONSIDERATION_PROFILE_COUNT = 7;
const CONSIDERATION_SUBTYPE_DIVERGENCE_PROFILE_COUNT = 7;
const CONSIDERATION_OUTSIDE_CALIBRATION_PROFILE_COUNT = 0;
const CONSIDERATION_REGISTERED_SUBTYPE_BUCKET_COUNT = 10;
const CONSIDERATION_POPULATED_SUBTYPE_BUCKET_COUNT = 2;

const CONSIDERATION_REVIEW_FLAGS = Object.freeze({
  LEGAL_GROUPING: 'LEGAL_GROUPING_REVIEW_REQUIRED',
  OUTSIDE_CALIBRATION: 'COMPARATOR_CLAIM_OUTSIDE_CALIBRATION_PROVISION_EXAMPLES',
  SUBTYPE_DIVERGENCE: 'SUBTYPE_PARTITION_DIVERGES_FROM_CALIBRATION_PROPOSED_SUBTYPE',
});

const CONSIDERATION_PHASE2_AUTHORITY_SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_CONTRACT_CONSIDERATION_AUTHORING_PHASE2_AUTHORITY/V2';
const CONSIDERATION_PHASE2_AUTHORITY_ID =
  'a3dfabb167080a0325c4121fb71e7440a8f1f0ac7069fd929753343076a914f1';
const CONSIDERATION_PHASE2_AUTHORITY_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-consideration-authoring-phase2-authority-v2.json';
const CONSIDERATION_PHASE2_AUTHORITY_BYTES = 40896;
const CONSIDERATION_PHASE2_AUTHORITY_SHA256 =
  '0b161e2bb3f512024e87683157521a499a2d6da6deeee4be36b9e20b9d64c5d9';

const CONSIDERATION_PHASE2_PROPOSAL_CODES = Object.freeze({
  AUTHORITY: 'M7_V2_CONSIDERATION_PHASE2_AUTHORITY',
  CONTRACT: 'M7_V2_CONSIDERATION_PHASE2_PROPOSAL_CONTRACT',
  COVERAGE: 'M7_V2_CONSIDERATION_PHASE2_SOURCE_COVERAGE',
});

const CONSIDERATION_PHASE2_PROPOSAL_KEYS = Object.freeze([
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

function validateConsiderationProposalAuthority(envelope) {
  const code = CONSIDERATION_PHASE2_PROPOSAL_CODES.AUTHORITY;
  validateEnvelopeShape(envelope, code, 'Phase2 authority');
  validateBoundRecord(envelope, code, 'Phase2 authority');
  const { binding, record } = envelope;
  if (
    binding.byte_length !== CONSIDERATION_PHASE2_AUTHORITY_BYTES
    || binding.path !== CONSIDERATION_PHASE2_AUTHORITY_PATH
    || binding.record_id !== CONSIDERATION_PHASE2_AUTHORITY_ID
    || binding.record_id_field !== 'consideration_authoring_phase2_authority_id'
    || binding.schema_version !== CONSIDERATION_PHASE2_AUTHORITY_SCHEMA
    || binding.sha256 !== CONSIDERATION_PHASE2_AUTHORITY_SHA256
  ) {
    fail(code, 'Phase2 authority binding drift.');
  }
  if (
    record.schema_version !== CONSIDERATION_PHASE2_AUTHORITY_SCHEMA
    || record.consideration_authoring_phase2_authority_id
      !== CONSIDERATION_PHASE2_AUTHORITY_ID
  ) {
    fail(code, 'Phase2 authority identity drift.');
  }
  const unsigned = { ...record };
  delete unsigned.consideration_authoring_phase2_authority_id;
  if (contentId(record.schema_version, unsigned) !== CONSIDERATION_PHASE2_AUTHORITY_ID) {
    fail(code, 'Phase2 authority self identity drift.');
  }
  return deepFreeze(clone(envelope));
}

function considerationAgreementSources(authority, agreementEvidenceByAgreementId) {
  const code = CONSIDERATION_PHASE2_PROPOSAL_CODES.COVERAGE;
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

function validateConsiderationProposalGovernedSources(authority, governedSources) {
  const code = CONSIDERATION_PHASE2_PROPOSAL_CODES.COVERAGE;
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
  return considerationAgreementSources(
    authority,
    governedSources.agreementEvidenceByAgreementId,
  );
}

function validateConsiderationProposalSourceCoverage(authority, agreements) {
  const code = CONSIDERATION_PHASE2_PROPOSAL_CODES.COVERAGE;
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
      || claim.family !== 'CONSIDERATION'
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

function considerationProposalCoverageRecords(authority, coverage) {
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

function considerationProposalPartition(coverage) {
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

function considerationProposalInventoryDigest(coverage, proposedPartition) {
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

function prepareConsiderationPhase2FamilyProposal(input) {
  const contractCode = CONSIDERATION_PHASE2_PROPOSAL_CODES.CONTRACT;
  exactKeysOrFail(
    input,
    ['considerationAuthoringPhase2Authority', 'governedSources'],
    contractCode,
    'Consideration proposal input',
  );
  const authorityEnvelope = validateConsiderationProposalAuthority(
    input.considerationAuthoringPhase2Authority,
  );
  const authority = authorityEnvelope.record;
  const agreements = validateConsiderationProposalGovernedSources(
    authority,
    input.governedSources,
  );
  const coverage = validateConsiderationProposalSourceCoverage(authority, agreements);
  const accounting = considerationProposalCoverageRecords(authority, coverage);
  const proposedPartition = considerationProposalPartition(coverage);
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
    'CONSIDERATION_Q01_Q02_Q03_BOUND_TO_SEALED_M5_PROGRAMME_RULINGS',
    CONSIDERATION_REVIEW_FLAGS.LEGAL_GROUPING,
  ].sort(compareStrings);
  const unsignedProposal = {
    schema_version: 'M7_V2_CONSIDERATION_FAMILY_PROPOSAL/V1',
    family_key: 'CONSIDERATION',
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
    inventory_digest: considerationProposalInventoryDigest(coverage, proposedPartition),
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

const CONSIDERATION_PHASE4_AUTHORITY_SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_CONTRACT_CONSIDERATION_AUTHORING_PHASE4_FAMILY_PROFILE_PACKAGE_REVIEW_AUTHORITY/V1';
const CONSIDERATION_PHASE4_AUTHORITY_ID =
  'a8d3a69e02bdd1458a55d42cd1eab83799b875938e95b3a5ccc6dd03081ce6c0';
const CONSIDERATION_PHASE4_AUTHORITY_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-consideration-authoring-phase4-family-profile-package-review-authority.json';
const CONSIDERATION_PHASE4_AUTHORITY_BYTES = 15353;
const CONSIDERATION_PHASE4_AUTHORITY_SHA256 =
  '3f3589d5ebbb8a8ae4daf52eca6a68071cb48e8306df097ed81e1ca47c63952c';
const CONSIDERATION_PHASE4_SCHEDULE_SHA256 =
  'cda6cdaa5ce1b1cc68320cae2db4b63dcdc64f3e46f0e55ab9731b4077ff427e';
const CONSIDERATION_PHASE4_CANDIDATE_SCHEMA =
  'M7_V2_CONSIDERATION_PHASE4_FAMILY_PROFILE_PACKAGE_REVIEW_CANDIDATE/V1';
const CONSIDERATION_PHASE4_CANDIDATE_STATE =
  'REVIEW_ONLY_7_PROFILES_UNAPPROVED_AWAITING_BEN_INVENTORY';

const CONSIDERATION_PHASE4_REVIEW_CODES = Object.freeze({
  CONTRACT: 'M7_V2_CONSIDERATION_PHASE4_REVIEW_CONTRACT',
  AUTHORITY: 'M7_V2_CONSIDERATION_PHASE4_REVIEW_AUTHORITY',
  PHASE2_PROPOSAL: 'M7_V2_CONSIDERATION_PHASE4_PHASE2_PROPOSAL',
  PROFILE_SCHEDULE: 'M7_V2_CONSIDERATION_PHASE4_PROFILE_SCHEDULE',
  REVIEW_OUTPUT: 'M7_V2_CONSIDERATION_PHASE4_REVIEW_OUTPUT',
});

const CONSIDERATION_PHASE4_REVIEW_INPUT_KEYS = Object.freeze([
  'considerationAuthoringPhase4FamilyProfilePackageReviewAuthority',
  'considerationAuthoringPhase2Authority',
  'governedSources',
]);

const CONSIDERATION_PHASE4_REVIEW_OUTPUT_KEYS = Object.freeze([
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

const CONSIDERATION_PHASE4_AUTHORITY_ROOT_KEYS = Object.freeze([
  'authority_classification',
  'authority_state',
  'candidate_output_contract',
  'design_basis',
  'execution_schedule',
  'consideration_authoring_phase4_family_profile_package_review_authority_id',
  'first_legal_stop_contract',
  'forbidden_output_contract',
  'immutable_parent_bindings',
  'implementation_contract',
  'profile_review_schedule',
  'profile_review_schedule_contract',
  'schema_version',
  'zero_effect_boundary',
]);

function considerationPhase4ExpectedParentBindings() {
  return {
    consideration_authoring_phase2_authority: {
      byte_length: CONSIDERATION_PHASE2_AUTHORITY_BYTES,
      path: CONSIDERATION_PHASE2_AUTHORITY_PATH,
      record_id: CONSIDERATION_PHASE2_AUTHORITY_ID,
      record_id_field: 'consideration_authoring_phase2_authority_id',
      schema_version: CONSIDERATION_PHASE2_AUTHORITY_SCHEMA,
      sha256: CONSIDERATION_PHASE2_AUTHORITY_SHA256,
    },
  };
}

function considerationContainsForbiddenKey(value, forbiddenKeys, seen = new Set()) {
  if (!value || typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) {
    return value.some((member) => considerationContainsForbiddenKey(
      member,
      forbiddenKeys,
      seen,
    ));
  }
  for (const [key, member] of Object.entries(value)) {
    if (forbiddenKeys.has(key)) return true;
    if (considerationContainsForbiddenKey(member, forbiddenKeys, seen)) return true;
  }
  return false;
}

function validateConsiderationPhase4FamilyProfilePackageReviewAuthority(envelope) {
  const code = CONSIDERATION_PHASE4_REVIEW_CODES.AUTHORITY;
  validateEnvelopeShape(envelope, code, 'Phase4 family profile package review authority');
  const { binding, record } = envelope;
  if (
    binding.byte_length !== CONSIDERATION_PHASE4_AUTHORITY_BYTES
    || binding.path !== CONSIDERATION_PHASE4_AUTHORITY_PATH
    || binding.record_id !== CONSIDERATION_PHASE4_AUTHORITY_ID
    || binding.record_id_field
      !== 'consideration_authoring_phase4_family_profile_package_review_authority_id'
    || binding.schema_version !== CONSIDERATION_PHASE4_AUTHORITY_SCHEMA
    || binding.sha256 !== CONSIDERATION_PHASE4_AUTHORITY_SHA256
  ) {
    fail(code, 'Phase4 family profile package review authority binding drift.');
  }
  validateBoundRecord(envelope, code, 'Phase4 family profile package review authority');
  if (
    !exactKeys(record, CONSIDERATION_PHASE4_AUTHORITY_ROOT_KEYS)
    || record.schema_version !== CONSIDERATION_PHASE4_AUTHORITY_SCHEMA
    || record.consideration_authoring_phase4_family_profile_package_review_authority_id
      !== CONSIDERATION_PHASE4_AUTHORITY_ID
  ) {
    fail(code, 'Phase4 family profile package review authority identity drift.');
  }
  const unsigned = { ...record };
  delete unsigned.consideration_authoring_phase4_family_profile_package_review_authority_id;
  if (contentId(record.schema_version, unsigned) !== CONSIDERATION_PHASE4_AUTHORITY_ID) {
    fail(code, 'Phase4 family profile package review authority self identity drift.');
  }

  const implementation = record.implementation_contract;
  const output = record.candidate_output_contract;
  const scheduleContract = record.profile_review_schedule_contract;
  const schedule = record.profile_review_schedule;
  const expectedErrorCodes = Object.values(CONSIDERATION_PHASE4_REVIEW_CODES);
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
      considerationPhase4ExpectedParentBindings(),
    )
    || !sameValue(
      implementation.exact_outer_input_keys,
      CONSIDERATION_PHASE4_REVIEW_INPUT_KEYS,
    )
    || implementation.exported_function !== 'prepareConsiderationFamilyProfilePackageReview'
    || implementation.phase2_internal_function
      !== 'prepareConsiderationPhase2FamilyProposal'
    || implementation.phase3_internal_function !== null
    || implementation.caller_produced_candidate_input_forbidden !== true
    || !Array.isArray(implementation.error_precedence)
    || implementation.error_precedence.length !== expectedErrorCodes.length
    || implementation.error_precedence.some((entry, index) => (
      entry.order !== index + 1 || entry.code !== expectedErrorCodes[index]
    ))
    || output.schema_version !== CONSIDERATION_PHASE4_CANDIDATE_SCHEMA
    || output.record_id_field !== 'review_candidate_id'
    || output.candidate_state !== CONSIDERATION_PHASE4_CANDIDATE_STATE
    || output.profile_approval_state !== 'UNAPPROVED'
    || !sameValue(output.exact_keys, CONSIDERATION_PHASE4_REVIEW_OUTPUT_KEYS)
    || schedule.length !== CONSIDERATION_PROFILE_COUNT
    || scheduleContract.exact_profile_count !== CONSIDERATION_PROFILE_COUNT
    || scheduleContract.exact_complete_profile_count !== CONSIDERATION_PROFILE_COUNT
    || scheduleContract.exact_incomplete_profile_count !== 0
    || scheduleContract.schedule_canonical_json_sha256
      !== CONSIDERATION_PHASE4_SCHEDULE_SHA256
    || sha256Hex(scheduleBytes) !== CONSIDERATION_PHASE4_SCHEDULE_SHA256
    || scheduleContract.schedule_canonical_json_byte_length !== scheduleBytes.length
  ) {
    fail(code, 'Phase4 family profile package review authority contract drift.');
  }
  return deepFreeze(clone(envelope));
}

function considerationPhase4ValidatePhase2Proposal(proposal) {
  const code = CONSIDERATION_PHASE4_REVIEW_CODES.PHASE2_PROPOSAL;
  if (
    !isObject(proposal)
    || proposal.schema_version !== 'M7_V2_CONSIDERATION_FAMILY_PROPOSAL/V1'
    || proposal.family_key !== 'CONSIDERATION'
    || proposal.profile_approval_state !== 'UNAPPROVED'
    || proposal.source_terminal_coverage.accounted_count !== CONSIDERATION_PROFILE_COUNT
    || proposal.m4_claim_accounting.accounted_count !== CONSIDERATION_PROFILE_COUNT
    || proposal.derived_profile_count !== CONSIDERATION_PROFILE_COUNT
    || !Array.isArray(proposal.proposed_partition.proposed_profiles)
    || proposal.proposed_partition.proposed_profiles.length !== CONSIDERATION_PROFILE_COUNT
    || proposal.proposed_partition.source_unit_assignment_count
      !== CONSIDERATION_PROFILE_COUNT
    || proposal.proposed_partition.m4_claim_assignment_count !== CONSIDERATION_PROFILE_COUNT
  ) {
    fail(code, 'Phase4 fresh Phase2 proposal drift.');
  }
  const unsigned = { ...proposal };
  delete unsigned.proposal_id;
  if (contentId(proposal.schema_version, unsigned) !== proposal.proposal_id) {
    fail(code, 'Phase4 fresh Phase2 proposal identity drift.');
  }
}

function considerationPhase4DeriveProfiles(authority, phase2Proposal) {
  const scheduleCode = CONSIDERATION_PHASE4_REVIEW_CODES.PROFILE_SCHEDULE;
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
        'CONSIDERATION',
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

function prepareConsiderationFamilyProfilePackageReview(input) {
  const contractCode = CONSIDERATION_PHASE4_REVIEW_CODES.CONTRACT;
  exactKeysOrFail(
    input,
    CONSIDERATION_PHASE4_REVIEW_INPUT_KEYS,
    contractCode,
    'Consideration Phase4 package review input',
  );
  const authorityEnvelope = validateConsiderationPhase4FamilyProfilePackageReviewAuthority(
    input.considerationAuthoringPhase4FamilyProfilePackageReviewAuthority,
  );
  const authority = authorityEnvelope.record;
  const phase2AuthorityEnvelope = validateConsiderationProposalAuthority(
    input.considerationAuthoringPhase2Authority,
  );
  if (
    phase2AuthorityEnvelope.binding.record_id
      !== authority.immutable_parent_bindings
        .consideration_authoring_phase2_authority.record_id
  ) {
    fail(
      CONSIDERATION_PHASE4_REVIEW_CODES.AUTHORITY,
      'Phase4 parent Phase2 authority pin drift.',
    );
  }
  validateConsiderationProposalGovernedSources(
    phase2AuthorityEnvelope.record,
    input.governedSources,
  );

  let phase2Proposal;
  try {
    phase2Proposal = prepareConsiderationPhase2FamilyProposal({
      considerationAuthoringPhase2Authority: input.considerationAuthoringPhase2Authority,
      governedSources: input.governedSources,
    });
  } catch (error) {
    fail(
      CONSIDERATION_PHASE4_REVIEW_CODES.PHASE2_PROPOSAL,
      'Phase4 fresh Phase2 proposal failed.',
      { cause_code: typeof error.code === 'string' ? error.code : null },
    );
  }
  considerationPhase4ValidatePhase2Proposal(phase2Proposal);
  const proposedProfiles = considerationPhase4DeriveProfiles(authority, phase2Proposal);
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
    schema_version: CONSIDERATION_PHASE4_CANDIDATE_SCHEMA,
    family_key: 'CONSIDERATION',
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
    !exactKeys(candidate, CONSIDERATION_PHASE4_REVIEW_OUTPUT_KEYS)
    || proposedProfiles.length !== CONSIDERATION_PROFILE_COUNT
    || proposedProfiles.some((profile) => (
      !exactKeys(profile, outputContract.profile_exact_keys)
      || !exactKeys(profile.proposed_validation, outputContract.proposed_validation_exact_keys)
      || !profile.review_flags.includes(CONSIDERATION_REVIEW_FLAGS.LEGAL_GROUPING)
    ))
    || proposedProfiles.filter((profile) => profile.review_flags.includes(
      CONSIDERATION_REVIEW_FLAGS.SUBTYPE_DIVERGENCE,
    )).length !== CONSIDERATION_SUBTYPE_DIVERGENCE_PROFILE_COUNT
    || proposedProfiles.filter((profile) => profile.review_flags.includes(
      CONSIDERATION_REVIEW_FLAGS.OUTSIDE_CALIBRATION,
    )).length !== CONSIDERATION_OUTSIDE_CALIBRATION_PROFILE_COUNT
    || !sameValue(candidate.review_accounting, outputContract.review_accounting_exact_values)
    || !sameValue(candidate.unresolved_items, outputContract.unresolved_items)
    || !sameValue(candidate.withheld_work3_fields, outputContract.withheld_work3_fields)
    || !sameValue(candidate.first_legal_stop, authority.first_legal_stop_contract)
    || !sameValue(candidate.zero_effect_boundary, authority.zero_effect_boundary)
    || considerationContainsForbiddenKey(candidate, forbiddenKeys)
  ) {
    fail(
      CONSIDERATION_PHASE4_REVIEW_CODES.REVIEW_OUTPUT,
      'Phase4 package review output boundary drift.',
    );
  }
  return deepFreeze(clone(candidate));
}

const CONSIDERATION_WORK3_CONTROL_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control';

/**
 * Q01-Q03 are answered by the sealed programme rulings the M5 role schema already
 * binds, not by a Consideration-specific ruling note. Nothing here invents a
 * lawyer decision.
 */
const CONSIDERATION_WORK3_RULINGS_BINDING = Object.freeze({
  byte_length: 1519,
  path: `${CONSIDERATION_WORK3_CONTROL_PATH}/m5-programme-rulings.json`,
  sha256: '2711dc5c958da271bfd86a154712c251978ac1f1aec713d22302946bf8f87497',
});
const CONSIDERATION_WORK3_INVENTORY_AUTHORITY_BINDING = Object.freeze({
  byte_length: 2092,
  path: `${CONSIDERATION_WORK3_CONTROL_PATH}/m7-v2-repair-contract-work3-consideration-unapproved-inventory-review-authority.json`,
  record_id: '06fae6e667380d81ed7d8fe58e9dd36f260e0a63f13b6f4bd2c42eb96c29f8ae',
  record_id_field: 'work3_consideration_unapproved_inventory_review_authority_id',
  schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_CONSIDERATION_UNAPPROVED_INVENTORY_REVIEW_AUTHORITY/V1',
  sha256: '4be8dc2c32e22de9de44303d14526b66edc7a28fb281ec1a93bf1c9864f274d0',
});
const CONSIDERATION_WORK3_PACKET_BINDING = Object.freeze({
  byte_length: 9235,
  path: `${CONSIDERATION_WORK3_CONTROL_PATH}/m7-v2-repair-consideration-7-profile-inventory-review-packet-draft.json`,
  record_id: '9ea8e8be8c6324727944caa0398bd4bb1d0900b40ca96c675e5f3ecfa559ee94',
  record_id_field: 'inventory_review_packet_id',
  schema_version: 'STAGE_2Y_M7_V2_CONSIDERATION_7_PROFILE_INVENTORY_REVIEW_PACKET/V1',
  sha256: '837d081a8ed8b6a7d65ebda46d39f2a9a44f8cdf040fd7338e9415bafd947197',
});
const CONSIDERATION_WORK3_DISPOSITION_BINDING = Object.freeze({
  byte_length: 4308,
  path: `${CONSIDERATION_WORK3_CONTROL_PATH}/m7-v2-repair-consideration-7-profile-inventory-disposition.json`,
  record_id: '8c8f47d7974a9dc27eae37b5c53308ef4d07375983180ec1a7242c2d737ee5d3',
  record_id_field: 'inventory_disposition_id',
  schema_version: 'STAGE_2Y_M7_V2_CONSIDERATION_7_PROFILE_INVENTORY_DISPOSITION/V1',
  sha256: 'd0221e39b816f22c0a256f1b26e3eb4ed5208820fb5f9b07298f8cc399897e57',
});
const CONSIDERATION_WORK3_SESSION_BINDING = Object.freeze({
  byte_length: 1115,
  path: `${CONSIDERATION_WORK3_CONTROL_PATH}/m7-v2-repair-consideration-ben-inventory-session-receipt.json`,
  record_id: '0dbce38400328a43572ab3d152de6ddd2e4e27548b99df0e5da2ab7e52ac015b',
  record_id_field: 'ben_inventory_session_receipt_id',
  schema_version: 'STAGE_2Y_M7_V2_CONSIDERATION_BEN_INVENTORY_SESSION_RECEIPT/V1',
  sha256: '0794273e24cb3862f8a42577c9dc4f76ca0018c923647f2e9cd10e4ace6a537a',
});
const CONSIDERATION_WORK3_BEN_AUTHORITY_BINDING = Object.freeze({
  byte_length: 2779,
  path: `${CONSIDERATION_WORK3_CONTROL_PATH}/m7-v2-repair-contract-work3-consideration-ben-inventory-session-successor-authority.json`,
  record_id: 'cbd99cc6898e77f615a8a4538fc8204c40b5fae6c806a6267bf340d46beef490',
  record_id_field: 'work3_consideration_ben_inventory_session_successor_authority_id',
  schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_CONSIDERATION_BEN_INVENTORY_SESSION_SUCCESSOR_AUTHORITY/V1',
  sha256: '5be5ec4fa7408273646be7d4a7b53e77c73f3d1835a16bb66d9112d3ece311b0',
});
const CONSIDERATION_WORK3_SEAL_AUTHORITY_BINDING = Object.freeze({
  byte_length: 3290,
  path: `${CONSIDERATION_WORK3_CONTROL_PATH}/m7-v2-repair-contract-work3-consideration-family-package-seal-successor-authority.json`,
  record_id: '723156b9661236e256cd2d9f287663c69c68f0fb16b98972e83770107b398ac7',
  record_id_field: 'work3_consideration_family_package_seal_successor_authority_id',
  schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_CONSIDERATION_FAMILY_PACKAGE_SEAL_SUCCESSOR_AUTHORITY/V1',
  sha256: 'bb438787b50bac1dee294a009a7d5d753ddf8c0a53a4192456415d6ff4c7d064',
});
const CONSIDERATION_WORK3_SEAL_RECEIPT_BINDING = Object.freeze({
  byte_length: 2267,
  path: `${CONSIDERATION_WORK3_CONTROL_PATH}/m7-v2-repair-consideration-family-package-seal-receipt.json`,
  record_id: 'edd588a96cdb41fcb47e6c982e1701f2f993c2ca8f2ecc7b3fff69f0985b2657',
  record_id_field: 'consideration_family_package_seal_receipt_id',
  schema_version: 'STAGE_2Y_M7_V2_CONSIDERATION_FAMILY_PACKAGE_SEAL_RECEIPT/V1',
  sha256: 'f94be33527b71e565712c8a2147e7d01afe79cd3d35758b2ddd8463fa308af7e',
});
const CONSIDERATION_WORK3_REGISTRATION_AUTHORITY_BINDING = Object.freeze({
  byte_length: 2820,
  path: `${CONSIDERATION_WORK3_CONTROL_PATH}/m7-v2-repair-contract-work3-consideration-registration-successor-authority.json`,
  record_id: '6b1c099021bbc21a5c620ad91fe266a618c1b39c47760eae078370c1b7db0516',
  record_id_field: 'work3_consideration_registration_successor_authority_id',
  schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_CONSIDERATION_REGISTRATION_SUCCESSOR_AUTHORITY/V1',
  sha256: '84e34ea475a2c619133c071166dc6c1499d74afa7830ad3a49983a2867aa251a',
});

const CONSIDERATION_WORK3_CODES = Object.freeze({
  CONTRACT: 'M7_V2_CONSIDERATION_WORK3_CONTRACT',
  AUTHORITY: 'M7_V2_CONSIDERATION_WORK3_AUTHORITY',
  INVENTORY: 'M7_V2_CONSIDERATION_WORK3_INVENTORY',
  DISPOSITION: 'M7_V2_CONSIDERATION_WORK3_DISPOSITION',
  RECEIPT: 'M7_V2_CONSIDERATION_WORK3_RECEIPT',
  OUTPUT: 'M7_V2_CONSIDERATION_WORK3_OUTPUT',
});

const CONSIDERATION_WORK3_WITHHELD_FIELDS = Object.freeze([
  'activation_id',
  'family_profile_package_id',
  'profile_id',
  'registration_id',
]);

function considerationWork3ValidatePinnedEnvelope(envelope, expected, label) {
  validateEnvelopeShape(envelope, CONSIDERATION_WORK3_CODES.AUTHORITY, label);
  if (!sameValue(envelope.binding, expected)) {
    fail(CONSIDERATION_WORK3_CODES.AUTHORITY, `${label} binding drift.`);
  }
  validateBoundRecord(envelope, CONSIDERATION_WORK3_CODES.AUTHORITY, label);
  const unsigned = clone(envelope.record);
  delete unsigned[expected.record_id_field];
  if (expected.record_id_field === 'inventory_disposition_id') {
    delete unsigned.session_receipt_id;
  }
  if (contentId(envelope.record.schema_version, unsigned) !== expected.record_id) {
    fail(CONSIDERATION_WORK3_CODES.AUTHORITY, `${label} self identity drift.`);
  }
  return deepFreeze(clone(envelope));
}

function considerationWork3ValidateInput(input, outerKeys, evidenceKey, evidenceKeys) {
  exactKeysOrFail(
    input,
    outerKeys,
    CONSIDERATION_WORK3_CODES.CONTRACT,
    'Consideration Work3 input',
  );
  const evidence = input[evidenceKey];
  exactKeysOrFail(
    evidence,
    evidenceKeys,
    CONSIDERATION_WORK3_CODES.CONTRACT,
    'Consideration Work3 evidence bundle',
  );
  for (const key of evidenceKeys) {
    if (
      !isObject(evidence[key])
      || !isObject(evidence[key].binding)
      || !isObject(evidence[key].record)
    ) {
      fail(
        CONSIDERATION_WORK3_CODES.CONTRACT,
        `Consideration Work3 ${key} envelope drift.`,
      );
    }
  }
  return evidence;
}

function considerationWork3Phase4(input) {
  try {
    return prepareConsiderationFamilyProfilePackageReview(input);
  } catch (error) {
    fail(
      CONSIDERATION_WORK3_CODES.INVENTORY,
      'Consideration Work3 Phase4 review derivation failed.',
      { cause_code: typeof error.code === 'string' ? error.code : null },
    );
  }
}

function validateConsiderationUnapprovedInventoryReviewEvidence(evidence) {
  if (
    !isObject(evidence)
    || evidence.profile_approval_state !== 'UNAPPROVED'
    || evidence.profile_count !== CONSIDERATION_PROFILE_COUNT
    || evidence.complete_profile_count !== CONSIDERATION_PROFILE_COUNT
    || evidence.incomplete_profile_count !== 0
    || !Array.isArray(evidence.proposed_profiles)
    || evidence.proposed_profiles.length !== CONSIDERATION_PROFILE_COUNT
    || !Array.isArray(evidence.retained_source_gaps)
    || evidence.retained_source_gaps.length !== 0
    || sortedUnique(evidence.proposed_profiles.map((profile) => profile.proposed_profile_key))
      .length !== CONSIDERATION_PROFILE_COUNT
  ) {
    fail(
      CONSIDERATION_WORK3_CODES.INVENTORY,
      'Consideration unapproved inventory review evidence census drift.',
    );
  }
  return deepFreeze({
    schema_version: 'M7_V2_CONSIDERATION_UNAPPROVED_INVENTORY_REVIEW_VALIDATOR_ACCEPTANCE/V1',
    status: 'PASS',
    profile_count: CONSIDERATION_PROFILE_COUNT,
    complete_profile_count: CONSIDERATION_PROFILE_COUNT,
    incomplete_profile_count: 0,
    retained_source_gap_count: 0,
  });
}

function prepareConsiderationWork3UnapprovedInventoryReview(input) {
  const evidence = considerationWork3ValidateInput(
    input,
    [
      'considerationWork3UnapprovedInventoryReviewEvidence',
      'considerationPhase4ReviewInput',
    ],
    'considerationWork3UnapprovedInventoryReviewEvidence',
    ['work3ConsiderationUnapprovedInventoryReviewAuthority'],
  );
  const authorityEnvelope = considerationWork3ValidatePinnedEnvelope(
    evidence.work3ConsiderationUnapprovedInventoryReviewAuthority,
    CONSIDERATION_WORK3_INVENTORY_AUTHORITY_BINDING,
    'Consideration Work3 inventory authority',
  );
  const phase4 = considerationWork3Phase4(input.considerationPhase4ReviewInput);
  const validator = validateConsiderationUnapprovedInventoryReviewEvidence({
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
      profile_count: CONSIDERATION_PROFILE_COUNT,
      complete_profile_count: CONSIDERATION_PROFILE_COUNT,
      incomplete_profile_count: 0,
      retained_source_gap_count: 0,
    },
    validator_acceptance_reference: clone(validator),
    review_accounting: clone(contract.review_accounting_exact_values),
    withheld_work3_fields: clone(CONSIDERATION_WORK3_WITHHELD_FIELDS),
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

function considerationWork3ValidatePacket(envelope) {
  considerationWork3ValidatePinnedEnvelope(
    envelope,
    CONSIDERATION_WORK3_PACKET_BINDING,
    'Consideration inventory packet',
  );
  const record = envelope.record;
  const items = record.profile_review_items;
  if (
    record.profile_count !== CONSIDERATION_PROFILE_COUNT
    || record.complete_profile_count !== CONSIDERATION_PROFILE_COUNT
    || record.incomplete_profile_count !== 0
    || record.retained_source_gap_count !== 0
    || !Array.isArray(items)
    || items.length !== CONSIDERATION_PROFILE_COUNT
    || items.some((item) => typeof item.shape_summary !== 'string' || item.shape_summary === '')
    || items.filter((item) => item.review_flags.includes(
      CONSIDERATION_REVIEW_FLAGS.LEGAL_GROUPING,
    )).length !== CONSIDERATION_PROFILE_COUNT
    || items.filter((item) => item.review_flags.includes(
      CONSIDERATION_REVIEW_FLAGS.SUBTYPE_DIVERGENCE,
    )).length !== CONSIDERATION_SUBTYPE_DIVERGENCE_PROFILE_COUNT
    || items.filter((item) => item.review_flags.includes(
      CONSIDERATION_REVIEW_FLAGS.OUTSIDE_CALIBRATION,
    )).length !== CONSIDERATION_OUTSIDE_CALIBRATION_PROFILE_COUNT
  ) {
    fail(
      CONSIDERATION_WORK3_CODES.INVENTORY,
      'Consideration inventory packet census drift.',
    );
  }
  return record;
}

function considerationWork3ValidateDisposition(envelope) {
  considerationWork3ValidatePinnedEnvelope(
    envelope,
    CONSIDERATION_WORK3_DISPOSITION_BINDING,
    'Consideration Ben disposition',
  );
  const record = envelope.record;
  const rows = record.profile_dispositions;
  const summary = record.session_summary;
  if (
    record.reviewer !== 'BEN_GOODCHILD'
    || record.default_disposition_applied !== true
    || record.packet_digest !== CONSIDERATION_WORK3_PACKET_BINDING.sha256
    || record.ben_rulings_digest !== CONSIDERATION_WORK3_RULINGS_BINDING.sha256
    || !Array.isArray(rows)
    || rows.length !== CONSIDERATION_PROFILE_COUNT
    || rows.filter((row) => row.disposition === 'APPROVE').length
      !== CONSIDERATION_PROFILE_COUNT
    || summary.approved_count !== CONSIDERATION_PROFILE_COUNT
    || summary.hold_count !== 0
    || summary.legal_grouping_review_pending_count !== CONSIDERATION_PROFILE_COUNT
    || summary.subtype_partition_divergence_count
      !== CONSIDERATION_SUBTYPE_DIVERGENCE_PROFILE_COUNT
    || summary.outside_calibration_example_count
      !== CONSIDERATION_OUTSIDE_CALIBRATION_PROFILE_COUNT
    || summary.subtype_grouping_pending_legal !== true
    || summary.taxonomy_expansion_acknowledged !== true
  ) {
    fail(
      CONSIDERATION_WORK3_CODES.DISPOSITION,
      'Consideration Ben inventory disposition drift.',
    );
  }
  return record;
}

function prepareConsiderationWork3BenInventorySessionDisposition(input) {
  const evidenceKeys = [
    'work3ConsiderationUnapprovedInventoryReviewAuthority',
    'work3ConsiderationBenInventorySessionSuccessorAuthority',
    'inventoryReviewPacketDraft',
    'benAuthoredInventoryDisposition',
  ];
  const evidence = considerationWork3ValidateInput(
    input,
    [
      'considerationWork3BenInventorySessionDispositionEvidence',
      'considerationPhase4ReviewInput',
    ],
    'considerationWork3BenInventorySessionDispositionEvidence',
    evidenceKeys,
  );
  const authorityEnvelope = considerationWork3ValidatePinnedEnvelope(
    evidence.work3ConsiderationBenInventorySessionSuccessorAuthority,
    CONSIDERATION_WORK3_BEN_AUTHORITY_BINDING,
    'Consideration Ben inventory authority',
  );
  considerationWork3ValidatePacket(evidence.inventoryReviewPacketDraft);
  const disposition = considerationWork3ValidateDisposition(
    evidence.benAuthoredInventoryDisposition,
  );
  const inventory = prepareConsiderationWork3UnapprovedInventoryReview({
    considerationWork3UnapprovedInventoryReviewEvidence: {
      work3ConsiderationUnapprovedInventoryReviewAuthority:
        evidence.work3ConsiderationUnapprovedInventoryReviewAuthority,
    },
    considerationPhase4ReviewInput: input.considerationPhase4ReviewInput,
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
      path: CONSIDERATION_WORK3_DISPOSITION_BINDING.path,
      inventory_disposition_id: disposition.inventory_disposition_id,
      packet_digest: disposition.packet_digest,
      profile_disposition_count: CONSIDERATION_PROFILE_COUNT,
      session_summary: clone(disposition.session_summary),
    },
    packet_binding: clone(CONSIDERATION_WORK3_PACKET_BINDING),
    ben_rulings_binding: clone(CONSIDERATION_WORK3_RULINGS_BINDING),
    session_receipt_reference: {
      schema_version: CONSIDERATION_WORK3_SESSION_BINDING.schema_version,
      ben_inventory_session_receipt_id: disposition.session_receipt_id,
      completion_state: 'COMPLETE',
    },
    review_accounting: clone(contract.review_accounting_exact_values),
    withheld_work3_fields: clone(CONSIDERATION_WORK3_WITHHELD_FIELDS),
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

function considerationWork3ValidateSessionReceipt(envelope) {
  considerationWork3ValidatePinnedEnvelope(
    envelope,
    CONSIDERATION_WORK3_SESSION_BINDING,
    'Consideration Ben session receipt',
  );
  const record = envelope.record;
  if (
    record.completion_state !== 'COMPLETE'
    || record.disposition_binding.inventory_disposition_id
      !== CONSIDERATION_WORK3_DISPOSITION_BINDING.record_id
    || record.zero_effect_boundary.work3_identity_count !== 0
  ) {
    fail(
      CONSIDERATION_WORK3_CODES.RECEIPT,
      'Consideration Ben session receipt drift.',
    );
  }
  return record;
}

function prepareConsiderationWork3FamilyPackageSeal(input) {
  const evidenceKeys = [
    'work3ConsiderationUnapprovedInventoryReviewAuthority',
    'work3ConsiderationBenInventorySessionSuccessorAuthority',
    'work3ConsiderationFamilyPackageSealSuccessorAuthority',
    'inventoryReviewPacketDraft',
    'benAuthoredInventoryDisposition',
    'benInventorySessionReceipt',
  ];
  const evidence = considerationWork3ValidateInput(
    input,
    [
      'considerationWork3FamilyPackageSealEvidence',
      'considerationPhase4ReviewInput',
    ],
    'considerationWork3FamilyPackageSealEvidence',
    evidenceKeys,
  );
  const authorityEnvelope = considerationWork3ValidatePinnedEnvelope(
    evidence.work3ConsiderationFamilyPackageSealSuccessorAuthority,
    CONSIDERATION_WORK3_SEAL_AUTHORITY_BINDING,
    'Consideration family package seal authority',
  );
  const dispositionCandidate = prepareConsiderationWork3BenInventorySessionDisposition({
    considerationWork3BenInventorySessionDispositionEvidence: {
      work3ConsiderationUnapprovedInventoryReviewAuthority:
        evidence.work3ConsiderationUnapprovedInventoryReviewAuthority,
      work3ConsiderationBenInventorySessionSuccessorAuthority:
        evidence.work3ConsiderationBenInventorySessionSuccessorAuthority,
      inventoryReviewPacketDraft: evidence.inventoryReviewPacketDraft,
      benAuthoredInventoryDisposition: evidence.benAuthoredInventoryDisposition,
    },
    considerationPhase4ReviewInput: input.considerationPhase4ReviewInput,
  });
  considerationWork3ValidateSessionReceipt(evidence.benInventorySessionReceipt);
  if (
    dispositionCandidate.session_receipt_reference.ben_inventory_session_receipt_id
      !== evidence.benInventorySessionReceipt.record.ben_inventory_session_receipt_id
  ) {
    fail(
      CONSIDERATION_WORK3_CODES.RECEIPT,
      'Consideration session receipt identity drift.',
    );
  }
  const contract = authorityEnvelope.record.schema_review_candidate_contract;
  const unsigned = {
    schema_version: contract.schema_version,
    candidate_state: contract.candidate_state,
    authority_binding: clone(authorityEnvelope.binding),
    inventory_session_disposition_reference: {
      inventory_disposition_id: CONSIDERATION_WORK3_DISPOSITION_BINDING.record_id,
      candidate_state: dispositionCandidate.candidate_state,
    },
    ben_rulings_binding: clone(CONSIDERATION_WORK3_RULINGS_BINDING),
    disposition_binding: clone(CONSIDERATION_WORK3_DISPOSITION_BINDING),
    session_receipt_binding: clone(CONSIDERATION_WORK3_SESSION_BINDING),
    legal_grouping_disposition_binding: {
      ...clone(CONSIDERATION_WORK3_RULINGS_BINDING),
      disposition_status: 'PENDING_LEGAL_REVIEW',
      legal_grouping_review_pending_count: CONSIDERATION_PROFILE_COUNT,
      outside_calibration_example_count: CONSIDERATION_OUTSIDE_CALIBRATION_PROFILE_COUNT,
      populated_subtype_bucket_count: CONSIDERATION_POPULATED_SUBTYPE_BUCKET_COUNT,
      registered_subtype_bucket_count: CONSIDERATION_REGISTERED_SUBTYPE_BUCKET_COUNT,
      subtype_partition_divergence_count: CONSIDERATION_SUBTYPE_DIVERGENCE_PROFILE_COUNT,
    },
    review_accounting: clone(contract.review_accounting_exact_values),
    withheld_work3_fields: clone(CONSIDERATION_WORK3_WITHHELD_FIELDS),
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

function considerationWork3ValidateSealReceipt(envelope) {
  considerationWork3ValidatePinnedEnvelope(
    envelope,
    CONSIDERATION_WORK3_SEAL_RECEIPT_BINDING,
    'Consideration family seal receipt',
  );
  const record = envelope.record;
  if (
    record.completion_state !== 'COMPLETE'
    || record.reviewer !== 'BEN_GOODCHILD'
    || record.disposition_binding.record_id
      !== CONSIDERATION_WORK3_DISPOSITION_BINDING.record_id
    || record.legal_grouping_disposition_binding.disposition_status !== 'PENDING_LEGAL_REVIEW'
    || record.zero_effect_boundary.work3_identity_count !== 0
  ) {
    fail(
      CONSIDERATION_WORK3_CODES.RECEIPT,
      'Consideration family seal receipt drift.',
    );
  }
  return record;
}

function prepareConsiderationWork3FamilyPackageRegistration(input) {
  const evidenceKeys = [
    'work3ConsiderationUnapprovedInventoryReviewAuthority',
    'work3ConsiderationBenInventorySessionSuccessorAuthority',
    'work3ConsiderationFamilyPackageSealSuccessorAuthority',
    'work3ConsiderationRegistrationSuccessorAuthority',
    'inventoryReviewPacketDraft',
    'benAuthoredInventoryDisposition',
    'benInventorySessionReceipt',
    'familyPackageSealReceipt',
  ];
  const evidence = considerationWork3ValidateInput(
    input,
    [
      'considerationWork3FamilyPackageRegistrationEvidence',
      'considerationPhase4ReviewInput',
    ],
    'considerationWork3FamilyPackageRegistrationEvidence',
    evidenceKeys,
  );
  const authorityEnvelope = considerationWork3ValidatePinnedEnvelope(
    evidence.work3ConsiderationRegistrationSuccessorAuthority,
    CONSIDERATION_WORK3_REGISTRATION_AUTHORITY_BINDING,
    'Consideration registration authority',
  );
  const sealCandidate = prepareConsiderationWork3FamilyPackageSeal({
    considerationWork3FamilyPackageSealEvidence: {
      work3ConsiderationUnapprovedInventoryReviewAuthority:
        evidence.work3ConsiderationUnapprovedInventoryReviewAuthority,
      work3ConsiderationBenInventorySessionSuccessorAuthority:
        evidence.work3ConsiderationBenInventorySessionSuccessorAuthority,
      work3ConsiderationFamilyPackageSealSuccessorAuthority:
        evidence.work3ConsiderationFamilyPackageSealSuccessorAuthority,
      inventoryReviewPacketDraft: evidence.inventoryReviewPacketDraft,
      benAuthoredInventoryDisposition: evidence.benAuthoredInventoryDisposition,
      benInventorySessionReceipt: evidence.benInventorySessionReceipt,
    },
    considerationPhase4ReviewInput: input.considerationPhase4ReviewInput,
  });
  const sealReceipt = considerationWork3ValidateSealReceipt(
    evidence.familyPackageSealReceipt,
  );
  if (sealReceipt.family_package_seal_id !== sealCandidate.family_package_seal_id) {
    fail(
      CONSIDERATION_WORK3_CODES.RECEIPT,
      'Consideration family seal candidate and receipt identity drift.',
    );
  }
  const phase4 = considerationWork3Phase4(input.considerationPhase4ReviewInput);
  const dispositionByKey = new Map(
    evidence.benAuthoredInventoryDisposition.record.profile_dispositions.map(
      (row) => [row.proposed_profile_key, row],
    ),
  );
  const registeredProfiles = phase4.proposed_profiles.map((profile) => {
    const disposition = dispositionByKey.get(profile.proposed_profile_key);
    if (!disposition) {
      fail(
        CONSIDERATION_WORK3_CODES.OUTPUT,
        'Consideration registration disposition missing.',
      );
    }
    const identityInput = {
      family_key: 'CONSIDERATION',
      proposed_profile_key: profile.proposed_profile_key,
      phase3_profile_key: null,
      profile_set_version: 1,
    };
    return {
      profile_id: contentId(
        'M7_V2_CONSIDERATION_WORK3_REGISTERED_PROFILE_IDENTITY/V1',
        identityInput,
      ),
      proposed_profile_key: profile.proposed_profile_key,
      phase3_profile_key: null,
      inventory_disposition: disposition.disposition,
      legal_grouping_pending_acknowledged: disposition.legal_grouping_pending_acknowledged,
    };
  });
  const packageUnsigned = {
    family_key: 'CONSIDERATION',
    profile_set_version: 1,
    package_state: 'BEN_SEALED_IN_MEMORY_REGISTRATION_ONLY',
    profile_id_count: CONSIDERATION_PROFILE_COUNT,
    profile_ids: registeredProfiles.map((profile) => profile.profile_id),
    inventory_disposition_id: CONSIDERATION_WORK3_DISPOSITION_BINDING.record_id,
    family_package_seal_receipt_id: CONSIDERATION_WORK3_SEAL_RECEIPT_BINDING.record_id,
    legal_grouping_disposition_state: 'PENDING_LEGAL_REVIEW',
  };
  const packageIdentity = {
    family_profile_package_id: contentId(
      'M7_V2_CONSIDERATION_WORK3_FAMILY_PROFILE_PACKAGE_IDENTITY/V1',
      packageUnsigned,
    ),
    family_key: packageUnsigned.family_key,
    profile_set_version: 1,
    package_state: packageUnsigned.package_state,
    profile_id_count: CONSIDERATION_PROFILE_COUNT,
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
    family_package_seal_receipt_binding: clone(CONSIDERATION_WORK3_SEAL_RECEIPT_BINDING),
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
      state: 'STOP_AFTER_CONSIDERATION_FAMILY_PACKAGE_REGISTRATION_BEFORE_ACTIVATION',
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
    result.registered_profile_identities.length !== CONSIDERATION_PROFILE_COUNT
    || result.review_accounting.profile_identity_count !== CONSIDERATION_PROFILE_COUNT
    || result.review_accounting.work3_identity_count !== CONSIDERATION_PROFILE_COUNT + 1
    || result.zero_effect_boundary.activation_count !== 0
    || considerationContainsForbiddenKey(result, new Set(['activation_id']))
  ) {
    fail(
      CONSIDERATION_WORK3_CODES.OUTPUT,
      'Consideration family registration boundary drift.',
    );
  }
  return result;
}

module.exports = {
  CONSIDERATION_OUTSIDE_CALIBRATION_PROFILE_COUNT,
  CONSIDERATION_PHASE2_AUTHORITY_BYTES,
  CONSIDERATION_PHASE2_AUTHORITY_ID,
  CONSIDERATION_PHASE2_AUTHORITY_PATH,
  CONSIDERATION_PHASE2_AUTHORITY_SCHEMA,
  CONSIDERATION_PHASE2_AUTHORITY_SHA256,
  CONSIDERATION_PHASE2_PROPOSAL_CODES,
  CONSIDERATION_PHASE2_PROPOSAL_KEYS,
  CONSIDERATION_PHASE4_AUTHORITY_BYTES,
  CONSIDERATION_PHASE4_AUTHORITY_ID,
  CONSIDERATION_PHASE4_AUTHORITY_PATH,
  CONSIDERATION_PHASE4_AUTHORITY_SCHEMA,
  CONSIDERATION_PHASE4_AUTHORITY_SHA256,
  CONSIDERATION_PHASE4_CANDIDATE_SCHEMA,
  CONSIDERATION_PHASE4_CANDIDATE_STATE,
  CONSIDERATION_PHASE4_REVIEW_CODES,
  CONSIDERATION_PHASE4_REVIEW_INPUT_KEYS,
  CONSIDERATION_PHASE4_REVIEW_OUTPUT_KEYS,
  CONSIDERATION_PHASE4_SCHEDULE_SHA256,
  CONSIDERATION_POPULATED_SUBTYPE_BUCKET_COUNT,
  CONSIDERATION_PROFILE_COUNT,
  CONSIDERATION_REGISTERED_SUBTYPE_BUCKET_COUNT,
  CONSIDERATION_REVIEW_FLAGS,
  CONSIDERATION_SUBTYPE_DIVERGENCE_PROFILE_COUNT,
  considerationProposalPartition,
  prepareConsiderationFamilyProfilePackageReview,
  prepareConsiderationPhase2FamilyProposal,
  prepareConsiderationWork3BenInventorySessionDisposition,
  prepareConsiderationWork3FamilyPackageRegistration,
  prepareConsiderationWork3FamilyPackageSeal,
  prepareConsiderationWork3UnapprovedInventoryReview,
  validateConsiderationUnapprovedInventoryReviewEvidence,
};
