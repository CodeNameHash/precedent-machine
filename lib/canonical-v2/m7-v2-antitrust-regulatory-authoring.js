'use strict';

/**
 * Family-local M7 V2 repair authoring for ANTITRUST_REGULATORY (N1 family #11).
 *
 * Milestone A ladder, D&O-minimal path (Phase 3 reference chain skipped):
 *   Phase 2 partition -> Phase 4 package review -> Work3 inventory review ->
 *   Ben inventory session disposition -> family package seal -> registration.
 *
 * Deliberately self-contained: the shared spine (m7-v2-profile-authoring.js) is on a
 * separate merge track, so the helpers below are adapted copies rather than imports.
 *
 * The 70 profiles are claim-scale, one per governed comparator M4 claim across seven
 * comparator deals. Subtype grouping across the twelve sealed M5 buckets and fourteen
 * source-first comparator buckets is an open legal question, so every profile carries
 * LEGAL_GROUPING_REVIEW_REQUIRED; six rows additionally carry
 * M5_SUBTYPE_BUCKET_PARTITION_UNRESOLVED, five carry NON_HSR_FILING_REGIME, and twelve
 * carry ONE_SIDED_OBLIGOR_CAPACITY. The family seal records PENDING_LEGAL_REVIEW.
 */

const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');

const ANTITRUST_REGULATORY_PROFILE_COUNT = 70;
const ANTITRUST_REGULATORY_M5_SUBTYPE_UNRESOLVED_PROFILE_COUNT = 6;
const ANTITRUST_REGULATORY_NON_HSR_FILING_REGIME_PROFILE_COUNT = 5;
const ANTITRUST_REGULATORY_ONE_SIDED_OBLIGOR_PROFILE_COUNT = 12;
const ANTITRUST_REGULATORY_REGISTERED_SUBTYPE_BUCKET_COUNT = 12;
const ANTITRUST_REGULATORY_POPULATED_SUBTYPE_BUCKET_COUNT = 14;

const ANTITRUST_REGULATORY_REVIEW_FLAGS = Object.freeze({
  LEGAL_GROUPING: 'LEGAL_GROUPING_REVIEW_REQUIRED',
  M5_SUBTYPE: 'M5_SUBTYPE_BUCKET_PARTITION_UNRESOLVED',
  NON_HSR: 'NON_HSR_FILING_REGIME',
  ONE_SIDED: 'ONE_SIDED_OBLIGOR_CAPACITY',
});

const ANTITRUST_REGULATORY_PHASE2_AUTHORITY_SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_CONTRACT_ANTITRUST_REGULATORY_AUTHORING_PHASE2_AUTHORITY/V2';
const ANTITRUST_REGULATORY_PHASE2_AUTHORITY_ID =
  '24171f26971996c8c66029da0bf14fa417834ea164b6d6e0ffd2e1a4906e8c10';
const ANTITRUST_REGULATORY_PHASE2_AUTHORITY_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-antitrust-regulatory-authoring-phase2-authority-v2.json';
const ANTITRUST_REGULATORY_PHASE2_AUTHORITY_BYTES = 170775;
const ANTITRUST_REGULATORY_PHASE2_AUTHORITY_SHA256 =
  'e396c5b0c8027ef24741ae2f3dfe07e1383290d4123cd4e4e9b4623ccb08580f';

const ANTITRUST_REGULATORY_PHASE2_PROPOSAL_CODES = Object.freeze({
  AUTHORITY: 'M7_V2_ANTITRUST_REGULATORY_PHASE2_AUTHORITY',
  CONTRACT: 'M7_V2_ANTITRUST_REGULATORY_PHASE2_PROPOSAL_CONTRACT',
  COVERAGE: 'M7_V2_ANTITRUST_REGULATORY_PHASE2_SOURCE_COVERAGE',
});

const ANTITRUST_REGULATORY_PHASE2_PROPOSAL_KEYS = Object.freeze([
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

function validateAntitrustRegulatoryProposalAuthority(envelope) {
  const code = ANTITRUST_REGULATORY_PHASE2_PROPOSAL_CODES.AUTHORITY;
  validateEnvelopeShape(envelope, code, 'Phase2 authority');
  validateBoundRecord(envelope, code, 'Phase2 authority');
  const { binding, record } = envelope;
  if (
    binding.byte_length !== ANTITRUST_REGULATORY_PHASE2_AUTHORITY_BYTES
    || binding.path !== ANTITRUST_REGULATORY_PHASE2_AUTHORITY_PATH
    || binding.record_id !== ANTITRUST_REGULATORY_PHASE2_AUTHORITY_ID
    || binding.record_id_field !== 'antitrust_regulatory_authoring_phase2_authority_id'
    || binding.schema_version !== ANTITRUST_REGULATORY_PHASE2_AUTHORITY_SCHEMA
    || binding.sha256 !== ANTITRUST_REGULATORY_PHASE2_AUTHORITY_SHA256
  ) {
    fail(code, 'Phase2 authority binding drift.');
  }
  if (
    record.schema_version !== ANTITRUST_REGULATORY_PHASE2_AUTHORITY_SCHEMA
    || record.antitrust_regulatory_authoring_phase2_authority_id
      !== ANTITRUST_REGULATORY_PHASE2_AUTHORITY_ID
  ) {
    fail(code, 'Phase2 authority identity drift.');
  }
  const unsigned = { ...record };
  delete unsigned.antitrust_regulatory_authoring_phase2_authority_id;
  if (contentId(record.schema_version, unsigned) !== ANTITRUST_REGULATORY_PHASE2_AUTHORITY_ID) {
    fail(code, 'Phase2 authority self identity drift.');
  }
  return deepFreeze(clone(envelope));
}

function antitrustRegulatoryAgreementSources(authority, agreementEvidenceByAgreementId) {
  const code = ANTITRUST_REGULATORY_PHASE2_PROPOSAL_CODES.COVERAGE;
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

function validateAntitrustRegulatoryProposalGovernedSources(authority, governedSources) {
  const code = ANTITRUST_REGULATORY_PHASE2_PROPOSAL_CODES.COVERAGE;
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
  return antitrustRegulatoryAgreementSources(
    authority,
    governedSources.agreementEvidenceByAgreementId,
  );
}

function validateAntitrustRegulatoryProposalSourceCoverage(authority, agreements) {
  const code = ANTITRUST_REGULATORY_PHASE2_PROPOSAL_CODES.COVERAGE;
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
      fail(code, `Claim-scale terminal must bind exactly one M4 claim: ${terminal.source_unit_key}.`);
    }
    const member = terminal.source_closure.members[0];
    const claim = agreement.claimsById.get(terminal.m4_claim_ids[0]);
    if (
      !claim
      || claim.agreement_id !== terminal.agreement_id
      || claim.family !== 'ANTITRUST_REGULATORY'
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

function antitrustRegulatoryProposalCoverageRecords(authority, coverage) {
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

function antitrustRegulatoryProposalPartition(coverage) {
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

function antitrustRegulatoryProposalInventoryDigest(coverage, proposedPartition) {
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

function prepareAntitrustRegulatoryPhase2FamilyProposal(input) {
  const contractCode = ANTITRUST_REGULATORY_PHASE2_PROPOSAL_CODES.CONTRACT;
  exactKeysOrFail(
    input,
    ['antitrustRegulatoryAuthoringPhase2Authority', 'governedSources'],
    contractCode,
    'Antitrust regulatory proposal input',
  );
  const authorityEnvelope = validateAntitrustRegulatoryProposalAuthority(
    input.antitrustRegulatoryAuthoringPhase2Authority,
  );
  const authority = authorityEnvelope.record;
  const agreements = validateAntitrustRegulatoryProposalGovernedSources(
    authority,
    input.governedSources,
  );
  const coverage = validateAntitrustRegulatoryProposalSourceCoverage(authority, agreements);
  const accounting = antitrustRegulatoryProposalCoverageRecords(authority, coverage);
  const proposedPartition = antitrustRegulatoryProposalPartition(coverage);
  const authorityBinding = {
    path: authorityEnvelope.binding.path,
    schema_version: authorityEnvelope.binding.schema_version,
    record_id_field: authorityEnvelope.binding.record_id_field,
    record_id: authorityEnvelope.binding.record_id,
    byte_length: authorityEnvelope.binding.byte_length,
    sha256: authorityEnvelope.binding.sha256,
  };
  const unresolvedItems = [
    'ANTITRUST_REGULATORY_Q01_Q02_Q03_OPEN_REQUIRES_BEN_RULING',
    'EXACT_PROFILE_INVENTORY_REQUIRES_SEPARATE_APPROVAL',
    'FILING_REGIME_PARTITION_UNRESOLVED',
    'LEGAL_GROUPING_REVIEW_REQUIRED',
    'M5_SUBTYPE_BUCKET_PARTITION_UNRESOLVED',
  ].sort(compareStrings);
  const unsignedProposal = {
    schema_version: 'M7_V2_ANTITRUST_REGULATORY_FAMILY_PROPOSAL/V1',
    family_key: 'ANTITRUST_REGULATORY',
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
    inventory_digest: antitrustRegulatoryProposalInventoryDigest(coverage, proposedPartition),
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

const ANTITRUST_REGULATORY_PHASE4_AUTHORITY_SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_CONTRACT_ANTITRUST_REGULATORY_AUTHORING_PHASE4_FAMILY_PROFILE_PACKAGE_REVIEW_AUTHORITY/V1';
const ANTITRUST_REGULATORY_PHASE4_AUTHORITY_ID =
  '958a45194f2f49bf6dfc4b3d8877e73a85465257ee9a541b41e99128a3611dbb';
const ANTITRUST_REGULATORY_PHASE4_AUTHORITY_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-antitrust-regulatory-authoring-phase4-family-profile-package-review-authority.json';
const ANTITRUST_REGULATORY_PHASE4_AUTHORITY_BYTES = 71421;
const ANTITRUST_REGULATORY_PHASE4_AUTHORITY_SHA256 =
  '2f8301f2469b7d0102e3dd914af96c24809d38dba59f79490e74492bf4263eea';
const ANTITRUST_REGULATORY_PHASE4_SCHEDULE_SHA256 =
  '1acefd7815917142ea91981bad6d61f5f284d9125c15ac7dc9e5c21986ebbd96';
const ANTITRUST_REGULATORY_PHASE4_CANDIDATE_SCHEMA =
  'M7_V2_ANTITRUST_REGULATORY_PHASE4_FAMILY_PROFILE_PACKAGE_REVIEW_CANDIDATE/V1';
const ANTITRUST_REGULATORY_PHASE4_CANDIDATE_STATE =
  'REVIEW_ONLY_70_PROFILES_UNAPPROVED_AWAITING_BEN_INVENTORY';

const ANTITRUST_REGULATORY_PHASE4_REVIEW_CODES = Object.freeze({
  CONTRACT: 'M7_V2_ANTITRUST_REGULATORY_PHASE4_REVIEW_CONTRACT',
  AUTHORITY: 'M7_V2_ANTITRUST_REGULATORY_PHASE4_REVIEW_AUTHORITY',
  PHASE2_PROPOSAL: 'M7_V2_ANTITRUST_REGULATORY_PHASE4_PHASE2_PROPOSAL',
  PROFILE_SCHEDULE: 'M7_V2_ANTITRUST_REGULATORY_PHASE4_PROFILE_SCHEDULE',
  REVIEW_OUTPUT: 'M7_V2_ANTITRUST_REGULATORY_PHASE4_REVIEW_OUTPUT',
});

const ANTITRUST_REGULATORY_PHASE4_REVIEW_INPUT_KEYS = Object.freeze([
  'antitrustRegulatoryAuthoringPhase4FamilyProfilePackageReviewAuthority',
  'antitrustRegulatoryAuthoringPhase2Authority',
  'governedSources',
]);

const ANTITRUST_REGULATORY_PHASE4_REVIEW_OUTPUT_KEYS = Object.freeze([
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

const ANTITRUST_REGULATORY_PHASE4_AUTHORITY_ROOT_KEYS = Object.freeze([
  'authority_classification',
  'authority_state',
  'candidate_output_contract',
  'design_basis',
  'execution_schedule',
  'first_legal_stop_contract',
  'forbidden_output_contract',
  'immutable_parent_bindings',
  'implementation_contract',
  'profile_review_schedule',
  'profile_review_schedule_contract',
  'antitrust_regulatory_authoring_phase4_family_profile_package_review_authority_id',
  'schema_version',
  'zero_effect_boundary',
]);

function antitrustRegulatoryPhase4ExpectedParentBindings() {
  return {
    antitrust_regulatory_authoring_phase2_authority: {
      byte_length: ANTITRUST_REGULATORY_PHASE2_AUTHORITY_BYTES,
      path: ANTITRUST_REGULATORY_PHASE2_AUTHORITY_PATH,
      record_id: ANTITRUST_REGULATORY_PHASE2_AUTHORITY_ID,
      record_id_field: 'antitrust_regulatory_authoring_phase2_authority_id',
      schema_version: ANTITRUST_REGULATORY_PHASE2_AUTHORITY_SCHEMA,
      sha256: ANTITRUST_REGULATORY_PHASE2_AUTHORITY_SHA256,
    },
  };
}

function antitrustRegulatoryContainsForbiddenKey(value, forbiddenKeys, seen = new Set()) {
  if (!value || typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) {
    return value.some((member) => antitrustRegulatoryContainsForbiddenKey(
      member,
      forbiddenKeys,
      seen,
    ));
  }
  for (const [key, member] of Object.entries(value)) {
    if (forbiddenKeys.has(key)) return true;
    if (antitrustRegulatoryContainsForbiddenKey(member, forbiddenKeys, seen)) return true;
  }
  return false;
}

function validateAntitrustRegulatoryPhase4FamilyProfilePackageReviewAuthority(envelope) {
  const code = ANTITRUST_REGULATORY_PHASE4_REVIEW_CODES.AUTHORITY;
  validateEnvelopeShape(envelope, code, 'Phase4 family profile package review authority');
  const { binding, record } = envelope;
  if (
    binding.byte_length !== ANTITRUST_REGULATORY_PHASE4_AUTHORITY_BYTES
    || binding.path !== ANTITRUST_REGULATORY_PHASE4_AUTHORITY_PATH
    || binding.record_id !== ANTITRUST_REGULATORY_PHASE4_AUTHORITY_ID
    || binding.record_id_field
      !== 'antitrust_regulatory_authoring_phase4_family_profile_package_review_authority_id'
    || binding.schema_version !== ANTITRUST_REGULATORY_PHASE4_AUTHORITY_SCHEMA
    || binding.sha256 !== ANTITRUST_REGULATORY_PHASE4_AUTHORITY_SHA256
  ) {
    fail(code, 'Phase4 family profile package review authority binding drift.');
  }
  validateBoundRecord(
    envelope,
    code,
    'Phase4 family profile package review authority',
  );
  if (
    !exactKeys(record, ANTITRUST_REGULATORY_PHASE4_AUTHORITY_ROOT_KEYS)
    || record.schema_version !== ANTITRUST_REGULATORY_PHASE4_AUTHORITY_SCHEMA
    || record.antitrust_regulatory_authoring_phase4_family_profile_package_review_authority_id
      !== ANTITRUST_REGULATORY_PHASE4_AUTHORITY_ID
  ) {
    fail(code, 'Phase4 family profile package review authority identity drift.');
  }
  const unsigned = { ...record };
  delete unsigned
    .antitrust_regulatory_authoring_phase4_family_profile_package_review_authority_id;
  if (contentId(record.schema_version, unsigned) !== ANTITRUST_REGULATORY_PHASE4_AUTHORITY_ID) {
    fail(code, 'Phase4 family profile package review authority self identity drift.');
  }

  const implementation = record.implementation_contract;
  const output = record.candidate_output_contract;
  const scheduleContract = record.profile_review_schedule_contract;
  const schedule = record.profile_review_schedule;
  const expectedErrorCodes = Object.values(ANTITRUST_REGULATORY_PHASE4_REVIEW_CODES);
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
    || !sameValue(record.immutable_parent_bindings, antitrustRegulatoryPhase4ExpectedParentBindings())
    || !sameValue(
      implementation.exact_outer_input_keys,
      ANTITRUST_REGULATORY_PHASE4_REVIEW_INPUT_KEYS,
    )
    || implementation.exported_function
      !== 'prepareAntitrustRegulatoryFamilyProfilePackageReview'
    || implementation.phase2_internal_function
      !== 'prepareAntitrustRegulatoryPhase2FamilyProposal'
    || implementation.phase3_internal_function !== null
    || implementation.caller_produced_candidate_input_forbidden !== true
    || !Array.isArray(implementation.error_precedence)
    || implementation.error_precedence.length !== expectedErrorCodes.length
    || implementation.error_precedence.some((entry, index) => (
      entry.order !== index + 1 || entry.code !== expectedErrorCodes[index]
    ))
    || output.schema_version !== ANTITRUST_REGULATORY_PHASE4_CANDIDATE_SCHEMA
    || output.record_id_field !== 'review_candidate_id'
    || output.candidate_state !== ANTITRUST_REGULATORY_PHASE4_CANDIDATE_STATE
    || output.profile_approval_state !== 'UNAPPROVED'
    || !sameValue(output.exact_keys, ANTITRUST_REGULATORY_PHASE4_REVIEW_OUTPUT_KEYS)
    || schedule.length !== ANTITRUST_REGULATORY_PROFILE_COUNT
    || scheduleContract.exact_profile_count !== ANTITRUST_REGULATORY_PROFILE_COUNT
    || scheduleContract.exact_complete_profile_count !== ANTITRUST_REGULATORY_PROFILE_COUNT
    || scheduleContract.exact_incomplete_profile_count !== 0
    || scheduleContract.schedule_canonical_json_sha256
      !== ANTITRUST_REGULATORY_PHASE4_SCHEDULE_SHA256
    || sha256Hex(scheduleBytes) !== ANTITRUST_REGULATORY_PHASE4_SCHEDULE_SHA256
    || scheduleContract.schedule_canonical_json_byte_length !== scheduleBytes.length
  ) {
    fail(code, 'Phase4 family profile package review authority contract drift.');
  }
  return deepFreeze(clone(envelope));
}

function antitrustRegulatoryPhase4ValidatePhase2Proposal(proposal) {
  const code = ANTITRUST_REGULATORY_PHASE4_REVIEW_CODES.PHASE2_PROPOSAL;
  if (
    !isObject(proposal)
    || proposal.schema_version !== 'M7_V2_ANTITRUST_REGULATORY_FAMILY_PROPOSAL/V1'
    || proposal.family_key !== 'ANTITRUST_REGULATORY'
    || proposal.profile_approval_state !== 'UNAPPROVED'
    || proposal.source_terminal_coverage.accounted_count !== ANTITRUST_REGULATORY_PROFILE_COUNT
    || proposal.m4_claim_accounting.accounted_count !== ANTITRUST_REGULATORY_PROFILE_COUNT
    || proposal.derived_profile_count !== ANTITRUST_REGULATORY_PROFILE_COUNT
    || !Array.isArray(proposal.proposed_partition.proposed_profiles)
    || proposal.proposed_partition.proposed_profiles.length !== ANTITRUST_REGULATORY_PROFILE_COUNT
    || proposal.proposed_partition.source_unit_assignment_count !== ANTITRUST_REGULATORY_PROFILE_COUNT
    || proposal.proposed_partition.m4_claim_assignment_count !== ANTITRUST_REGULATORY_PROFILE_COUNT
  ) {
    fail(code, 'Phase4 fresh Phase2 proposal drift.');
  }
  const unsigned = { ...proposal };
  delete unsigned.proposal_id;
  if (contentId(proposal.schema_version, unsigned) !== proposal.proposal_id) {
    fail(code, 'Phase4 fresh Phase2 proposal identity drift.');
  }
}

function antitrustRegulatoryPhase4DeriveProfiles(authority, phase2Proposal) {
  const scheduleCode = ANTITRUST_REGULATORY_PHASE4_REVIEW_CODES.PROFILE_SCHEDULE;
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
          'ANTITRUST_REGULATORY',
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

function prepareAntitrustRegulatoryFamilyProfilePackageReview(input) {
  const contractCode = ANTITRUST_REGULATORY_PHASE4_REVIEW_CODES.CONTRACT;
  exactKeysOrFail(
    input,
    ANTITRUST_REGULATORY_PHASE4_REVIEW_INPUT_KEYS,
    contractCode,
    'Antitrust regulatory Phase4 package review input',
  );
  const authorityEnvelope =
    validateAntitrustRegulatoryPhase4FamilyProfilePackageReviewAuthority(
      input.antitrustRegulatoryAuthoringPhase4FamilyProfilePackageReviewAuthority,
    );
  const authority = authorityEnvelope.record;
  const phase2AuthorityEnvelope = validateAntitrustRegulatoryProposalAuthority(
    input.antitrustRegulatoryAuthoringPhase2Authority,
  );
  if (
    phase2AuthorityEnvelope.binding.record_id
      !== authority.immutable_parent_bindings
        .antitrust_regulatory_authoring_phase2_authority.record_id
  ) {
    fail(
      ANTITRUST_REGULATORY_PHASE4_REVIEW_CODES.AUTHORITY,
      'Phase4 parent Phase2 authority pin drift.',
    );
  }
  validateAntitrustRegulatoryProposalGovernedSources(
    phase2AuthorityEnvelope.record,
    input.governedSources,
  );

  let phase2Proposal;
  try {
    phase2Proposal = prepareAntitrustRegulatoryPhase2FamilyProposal({
      antitrustRegulatoryAuthoringPhase2Authority:
        input.antitrustRegulatoryAuthoringPhase2Authority,
      governedSources: input.governedSources,
    });
  } catch (error) {
    fail(
      ANTITRUST_REGULATORY_PHASE4_REVIEW_CODES.PHASE2_PROPOSAL,
      'Phase4 fresh Phase2 proposal failed.',
      { cause_code: typeof error.code === 'string' ? error.code : null },
    );
  }
  antitrustRegulatoryPhase4ValidatePhase2Proposal(phase2Proposal);
  const proposedProfiles = antitrustRegulatoryPhase4DeriveProfiles(authority, phase2Proposal);
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
    schema_version: ANTITRUST_REGULATORY_PHASE4_CANDIDATE_SCHEMA,
    family_key: 'ANTITRUST_REGULATORY',
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
    !exactKeys(candidate, ANTITRUST_REGULATORY_PHASE4_REVIEW_OUTPUT_KEYS)
    || proposedProfiles.length !== ANTITRUST_REGULATORY_PROFILE_COUNT
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
    || antitrustRegulatoryContainsForbiddenKey(candidate, forbiddenKeys)
  ) {
    fail(
      ANTITRUST_REGULATORY_PHASE4_REVIEW_CODES.REVIEW_OUTPUT,
      'Phase4 package review output boundary drift.',
    );
  }
  return deepFreeze(clone(candidate));
}

const ANTITRUST_REGULATORY_WORK3_CONTROL_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control';
const ANTITRUST_REGULATORY_WORK3_RULINGS_BINDING = Object.freeze({
  byte_length: 1519,
  path: `${ANTITRUST_REGULATORY_WORK3_CONTROL_PATH}/m5-programme-rulings.json`,
  sha256: '2711dc5c958da271bfd86a154712c251978ac1f1aec713d22302946bf8f87497',
});
const ANTITRUST_REGULATORY_WORK3_INVENTORY_AUTHORITY_BINDING = Object.freeze({
  byte_length: 2050,
  path: `${ANTITRUST_REGULATORY_WORK3_CONTROL_PATH}/m7-v2-repair-contract-work3-antitrust-regulatory-unapproved-inventory-review-authority.json`,
  record_id: '0d1d77aaba5fa12a31c89245d0b473dcc3784d125c5744c0cd3bece9fb85b4cf',
  record_id_field: 'work3_antitrust_regulatory_unapproved_inventory_review_authority_id',
  schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_ANTITRUST_REGULATORY_UNAPPROVED_INVENTORY_REVIEW_AUTHORITY/V1',
  sha256: 'f8ecf198eb0f9e7af967dab8fd175375796938a08d95b6cff8650aa545fe11c8',
});
const ANTITRUST_REGULATORY_WORK3_PACKET_BINDING = Object.freeze({
  byte_length: 83533,
  path: `${ANTITRUST_REGULATORY_WORK3_CONTROL_PATH}/m7-v2-repair-antitrust-regulatory-70-profile-inventory-review-packet-draft.json`,
  record_id: 'ad790f284e854c67adfb6d68dbeceb08c8ec174bb43ca21afad84ff677caae7f',
  record_id_field: 'inventory_review_packet_id',
  schema_version: 'STAGE_2Y_M7_V2_ANTITRUST_REGULATORY_70_PROFILE_INVENTORY_REVIEW_PACKET/V1',
  sha256: '444b487bc0b72929005d3bc027430ac30cce06954a16f60e2b230bb05a0aa533',
});
const ANTITRUST_REGULATORY_WORK3_DISPOSITION_BINDING = Object.freeze({
  byte_length: 27477,
  path: `${ANTITRUST_REGULATORY_WORK3_CONTROL_PATH}/m7-v2-repair-antitrust-regulatory-70-profile-inventory-disposition.json`,
  record_id: '896b22b67502d4f893302620432d9ab760924e4b7394513cd06ab9f45f48825e',
  record_id_field: 'inventory_disposition_id',
  schema_version: 'STAGE_2Y_M7_V2_ANTITRUST_REGULATORY_70_PROFILE_INVENTORY_DISPOSITION/V1',
  sha256: 'd58415a35b6329137b4ab802e555a8099dcdc723ea89b14d4906a68b30db772f',
});
const ANTITRUST_REGULATORY_WORK3_SESSION_BINDING = Object.freeze({
  byte_length: 1146,
  path: `${ANTITRUST_REGULATORY_WORK3_CONTROL_PATH}/m7-v2-repair-antitrust-regulatory-ben-inventory-session-receipt.json`,
  record_id: 'b9e7487bac0d1f61fe9d8b2c746b4433f6cd29ae8bcf770092e418c88281f864',
  record_id_field: 'ben_inventory_session_receipt_id',
  schema_version: 'STAGE_2Y_M7_V2_ANTITRUST_REGULATORY_BEN_INVENTORY_SESSION_RECEIPT/V1',
  sha256: '48848f47bf0b5e80a5b6c9b7f8415525b94a77c46d746b92cecd7d355a7d1fcf',
});
const ANTITRUST_REGULATORY_WORK3_BEN_AUTHORITY_BINDING = Object.freeze({
  byte_length: 2880,
  path: `${ANTITRUST_REGULATORY_WORK3_CONTROL_PATH}/m7-v2-repair-contract-work3-antitrust-regulatory-ben-inventory-session-successor-authority.json`,
  record_id: '9a3d3c0da46b51152345e1f0f2d782c2c6434cfb3dd9d582bd88b47c92bfbf4b',
  record_id_field: 'work3_antitrust_regulatory_ben_inventory_session_successor_authority_id',
  schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_ANTITRUST_REGULATORY_BEN_INVENTORY_SESSION_SUCCESSOR_AUTHORITY/V1',
  sha256: '88d7184993ae5d280ca6b10bfe142be9809371dfc9cf22958a3a0f207a68f752',
});
const ANTITRUST_REGULATORY_WORK3_SEAL_AUTHORITY_BINDING = Object.freeze({
  byte_length: 3416,
  path: `${ANTITRUST_REGULATORY_WORK3_CONTROL_PATH}/m7-v2-repair-contract-work3-antitrust-regulatory-family-package-seal-successor-authority.json`,
  record_id: 'e8e842aa34096fab99745e0c9f9ae0922b2ad4b4d6bc00a88589f1b8061aa921',
  record_id_field: 'work3_antitrust_regulatory_family_package_seal_successor_authority_id',
  schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_ANTITRUST_REGULATORY_FAMILY_PACKAGE_SEAL_SUCCESSOR_AUTHORITY/V1',
  sha256: 'd3b951f67f1907f62aedb962a33b7b34fe0410d77819a231c3429d2f2f134482',
});
const ANTITRUST_REGULATORY_WORK3_SEAL_RECEIPT_BINDING = Object.freeze({
  byte_length: 2364,
  path: `${ANTITRUST_REGULATORY_WORK3_CONTROL_PATH}/m7-v2-repair-antitrust-regulatory-family-package-seal-receipt.json`,
  record_id: 'f09a8e6936ea9f43088584e44753e2ec8b7373f18efe6dd3c69e20af823d0c61',
  record_id_field: 'antitrust_regulatory_family_package_seal_receipt_id',
  schema_version: 'STAGE_2Y_M7_V2_ANTITRUST_REGULATORY_FAMILY_PACKAGE_SEAL_RECEIPT/V1',
  sha256: '5c002fea77efe119e1e29d3004acb18b6dd8a20067cd25396c5f971dc9dffd89',
});
const ANTITRUST_REGULATORY_WORK3_REGISTRATION_AUTHORITY_BINDING = Object.freeze({
  byte_length: 2985,
  path: `${ANTITRUST_REGULATORY_WORK3_CONTROL_PATH}/m7-v2-repair-contract-work3-antitrust-regulatory-registration-successor-authority.json`,
  record_id: 'd40f182128e550528a6eb22ef443fc64d2a779cfd91a65f60f27c0f23304aa63',
  record_id_field: 'work3_antitrust_regulatory_registration_successor_authority_id',
  schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_ANTITRUST_REGULATORY_REGISTRATION_SUCCESSOR_AUTHORITY/V1',
  sha256: 'defe7ccffcef20bab1952fe55fa94b0b3a6fca78e63fbd812d44871b84422b73',
});

const ANTITRUST_REGULATORY_WORK3_CODES = Object.freeze({
  CONTRACT: 'M7_V2_ANTITRUST_REGULATORY_WORK3_CONTRACT',
  AUTHORITY: 'M7_V2_ANTITRUST_REGULATORY_WORK3_AUTHORITY',
  INVENTORY: 'M7_V2_ANTITRUST_REGULATORY_WORK3_INVENTORY',
  DISPOSITION: 'M7_V2_ANTITRUST_REGULATORY_WORK3_DISPOSITION',
  RECEIPT: 'M7_V2_ANTITRUST_REGULATORY_WORK3_RECEIPT',
  OUTPUT: 'M7_V2_ANTITRUST_REGULATORY_WORK3_OUTPUT',
});
const ANTITRUST_REGULATORY_WORK3_WITHHELD_FIELDS = Object.freeze([
  'activation_id',
  'family_profile_package_id',
  'profile_id',
  'registration_id',
]);

function antitrustRegulatoryWork3ValidatePinnedEnvelope(envelope, expected, label) {
  validateEnvelopeShape(envelope, ANTITRUST_REGULATORY_WORK3_CODES.AUTHORITY, label);
  if (!sameValue(envelope.binding, expected)) {
    fail(ANTITRUST_REGULATORY_WORK3_CODES.AUTHORITY, `${label} binding drift.`);
  }
  validateBoundRecord(envelope, ANTITRUST_REGULATORY_WORK3_CODES.AUTHORITY, label);
  const unsigned = clone(envelope.record);
  delete unsigned[expected.record_id_field];
  if (expected.record_id_field === 'inventory_disposition_id') {
    delete unsigned.session_receipt_id;
  }
  if (contentId(envelope.record.schema_version, unsigned) !== expected.record_id) {
    fail(ANTITRUST_REGULATORY_WORK3_CODES.AUTHORITY, `${label} self identity drift.`);
  }
  return deepFreeze(clone(envelope));
}

function antitrustRegulatoryWork3ValidateInput(input, outerKeys, evidenceKey, evidenceKeys) {
  exactKeysOrFail(input, outerKeys, ANTITRUST_REGULATORY_WORK3_CODES.CONTRACT, 'Antitrust regulatory Work3 input');
  const evidence = input[evidenceKey];
  exactKeysOrFail(
    evidence,
    evidenceKeys,
    ANTITRUST_REGULATORY_WORK3_CODES.CONTRACT,
    'Antitrust regulatory Work3 evidence bundle',
  );
  for (const key of evidenceKeys) {
    if (
      !isObject(evidence[key])
      || !isObject(evidence[key].binding)
      || !isObject(evidence[key].record)
    ) {
      fail(ANTITRUST_REGULATORY_WORK3_CODES.CONTRACT, `Antitrust regulatory Work3 ${key} envelope drift.`);
    }
  }
  return evidence;
}

function antitrustRegulatoryWork3Phase4(input) {
  try {
    return prepareAntitrustRegulatoryFamilyProfilePackageReview(input);
  } catch (error) {
    fail(ANTITRUST_REGULATORY_WORK3_CODES.INVENTORY, 'Antitrust regulatory Work3 Phase4 review derivation failed.', {
      cause_code: typeof error.code === 'string' ? error.code : null,
    });
  }
}

function validateAntitrustRegulatoryUnapprovedInventoryReviewEvidence(evidence) {
  if (
    !isObject(evidence)
    || evidence.profile_approval_state !== 'UNAPPROVED'
    || evidence.profile_count !== ANTITRUST_REGULATORY_PROFILE_COUNT
    || evidence.complete_profile_count !== ANTITRUST_REGULATORY_PROFILE_COUNT
    || evidence.incomplete_profile_count !== 0
    || !Array.isArray(evidence.proposed_profiles)
    || evidence.proposed_profiles.length !== ANTITRUST_REGULATORY_PROFILE_COUNT
    || !Array.isArray(evidence.retained_source_gaps)
    || evidence.retained_source_gaps.length !== 0
    || sortedUnique(evidence.proposed_profiles.map((profile) => profile.proposed_profile_key))
      .length !== ANTITRUST_REGULATORY_PROFILE_COUNT
  ) {
    fail(
      ANTITRUST_REGULATORY_WORK3_CODES.INVENTORY,
      'Antitrust regulatory unapproved inventory review evidence census drift.',
    );
  }
  return deepFreeze({
    schema_version: 'M7_V2_ANTITRUST_REGULATORY_UNAPPROVED_INVENTORY_REVIEW_VALIDATOR_ACCEPTANCE/V1',
    status: 'PASS',
    profile_count: ANTITRUST_REGULATORY_PROFILE_COUNT,
    complete_profile_count: ANTITRUST_REGULATORY_PROFILE_COUNT,
    incomplete_profile_count: 0,
    retained_source_gap_count: 0,
  });
}

function prepareAntitrustRegulatoryWork3UnapprovedInventoryReview(input) {
  const evidence = antitrustRegulatoryWork3ValidateInput(
    input,
    ['antitrustRegulatoryWork3UnapprovedInventoryReviewEvidence', 'antitrustRegulatoryPhase4ReviewInput'],
    'antitrustRegulatoryWork3UnapprovedInventoryReviewEvidence',
    ['work3AntitrustRegulatoryUnapprovedInventoryReviewAuthority'],
  );
  const authorityEnvelope = antitrustRegulatoryWork3ValidatePinnedEnvelope(
    evidence.work3AntitrustRegulatoryUnapprovedInventoryReviewAuthority,
    ANTITRUST_REGULATORY_WORK3_INVENTORY_AUTHORITY_BINDING,
    'Antitrust regulatory Work3 inventory authority',
  );
  const phase4 = antitrustRegulatoryWork3Phase4(input.antitrustRegulatoryPhase4ReviewInput);
  const validator = validateAntitrustRegulatoryUnapprovedInventoryReviewEvidence({
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
      profile_count: ANTITRUST_REGULATORY_PROFILE_COUNT,
      complete_profile_count: ANTITRUST_REGULATORY_PROFILE_COUNT,
      incomplete_profile_count: 0,
      retained_source_gap_count: 0,
    },
    validator_acceptance_reference: clone(validator),
    review_accounting: clone(contract.review_accounting_exact_values),
    withheld_work3_fields: clone(ANTITRUST_REGULATORY_WORK3_WITHHELD_FIELDS),
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

function antitrustRegulatoryWork3ValidatePacket(envelope) {
  antitrustRegulatoryWork3ValidatePinnedEnvelope(
    envelope,
    ANTITRUST_REGULATORY_WORK3_PACKET_BINDING,
    'Antitrust regulatory inventory packet',
  );
  const record = envelope.record;
  if (
    record.profile_count !== ANTITRUST_REGULATORY_PROFILE_COUNT
    || record.complete_profile_count !== ANTITRUST_REGULATORY_PROFILE_COUNT
    || record.incomplete_profile_count !== 0
    || record.retained_source_gap_count !== 0
    || !Array.isArray(record.profile_review_items)
    || record.profile_review_items.length !== ANTITRUST_REGULATORY_PROFILE_COUNT
    || record.profile_review_items.filter((item) => item.review_flags.includes(
      'LEGAL_GROUPING_REVIEW_REQUIRED',
    )).length !== ANTITRUST_REGULATORY_PROFILE_COUNT
    || record.profile_review_items.filter((item) => item.review_flags.includes(
      ANTITRUST_REGULATORY_REVIEW_FLAGS.M5_SUBTYPE,
    )).length !== ANTITRUST_REGULATORY_M5_SUBTYPE_UNRESOLVED_PROFILE_COUNT
    || record.profile_review_items.filter((item) => item.review_flags.includes(
      ANTITRUST_REGULATORY_REVIEW_FLAGS.NON_HSR,
    )).length !== ANTITRUST_REGULATORY_NON_HSR_FILING_REGIME_PROFILE_COUNT
    || record.profile_review_items.filter((item) => item.review_flags.includes(
      ANTITRUST_REGULATORY_REVIEW_FLAGS.ONE_SIDED,
    )).length !== ANTITRUST_REGULATORY_ONE_SIDED_OBLIGOR_PROFILE_COUNT
  ) fail(ANTITRUST_REGULATORY_WORK3_CODES.INVENTORY, 'Antitrust regulatory inventory packet census drift.');
  return record;
}

function antitrustRegulatoryWork3ValidateDisposition(envelope) {
  antitrustRegulatoryWork3ValidatePinnedEnvelope(
    envelope,
    ANTITRUST_REGULATORY_WORK3_DISPOSITION_BINDING,
    'Antitrust regulatory Ben disposition',
  );
  const record = envelope.record;
  const rows = record.profile_dispositions;
  const summary = record.session_summary;
  if (
    record.reviewer !== 'BEN_GOODCHILD'
    || record.default_disposition_applied !== true
    || record.packet_digest !== ANTITRUST_REGULATORY_WORK3_PACKET_BINDING.sha256
    || record.ben_rulings_digest !== ANTITRUST_REGULATORY_WORK3_RULINGS_BINDING.sha256
    || !Array.isArray(rows)
    || rows.length !== ANTITRUST_REGULATORY_PROFILE_COUNT
    || rows.filter((row) => row.disposition === 'APPROVE').length !== ANTITRUST_REGULATORY_PROFILE_COUNT
    || summary.approved_count !== ANTITRUST_REGULATORY_PROFILE_COUNT
    || summary.hold_count !== 0
    || summary.legal_grouping_review_pending_count !== ANTITRUST_REGULATORY_PROFILE_COUNT
    || summary.m5_subtype_bucket_partition_unresolved_count
      !== ANTITRUST_REGULATORY_M5_SUBTYPE_UNRESOLVED_PROFILE_COUNT
    || summary.non_hsr_filing_regime_count
      !== ANTITRUST_REGULATORY_NON_HSR_FILING_REGIME_PROFILE_COUNT
    || summary.one_sided_obligor_capacity_count
      !== ANTITRUST_REGULATORY_ONE_SIDED_OBLIGOR_PROFILE_COUNT
    || summary.taxonomy_expansion_acknowledged !== true
  ) fail(ANTITRUST_REGULATORY_WORK3_CODES.DISPOSITION, 'Antitrust regulatory Ben inventory disposition drift.');
  return record;
}

function prepareAntitrustRegulatoryWork3BenInventorySessionDisposition(input) {
  const evidenceKeys = [
    'work3AntitrustRegulatoryUnapprovedInventoryReviewAuthority',
    'work3AntitrustRegulatoryBenInventorySessionSuccessorAuthority',
    'inventoryReviewPacketDraft',
    'benAuthoredInventoryDisposition',
  ];
  const evidence = antitrustRegulatoryWork3ValidateInput(
    input,
    ['antitrustRegulatoryWork3BenInventorySessionDispositionEvidence', 'antitrustRegulatoryPhase4ReviewInput'],
    'antitrustRegulatoryWork3BenInventorySessionDispositionEvidence',
    evidenceKeys,
  );
  const authorityEnvelope = antitrustRegulatoryWork3ValidatePinnedEnvelope(
    evidence.work3AntitrustRegulatoryBenInventorySessionSuccessorAuthority,
    ANTITRUST_REGULATORY_WORK3_BEN_AUTHORITY_BINDING,
    'Antitrust regulatory Ben inventory authority',
  );
  antitrustRegulatoryWork3ValidatePacket(evidence.inventoryReviewPacketDraft);
  const disposition = antitrustRegulatoryWork3ValidateDisposition(
    evidence.benAuthoredInventoryDisposition,
  );
  const inventory = prepareAntitrustRegulatoryWork3UnapprovedInventoryReview({
    antitrustRegulatoryWork3UnapprovedInventoryReviewEvidence: {
      work3AntitrustRegulatoryUnapprovedInventoryReviewAuthority:
        evidence.work3AntitrustRegulatoryUnapprovedInventoryReviewAuthority,
    },
    antitrustRegulatoryPhase4ReviewInput: input.antitrustRegulatoryPhase4ReviewInput,
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
      path: ANTITRUST_REGULATORY_WORK3_DISPOSITION_BINDING.path,
      inventory_disposition_id: disposition.inventory_disposition_id,
      packet_digest: disposition.packet_digest,
      profile_disposition_count: ANTITRUST_REGULATORY_PROFILE_COUNT,
      session_summary: clone(disposition.session_summary),
    },
    packet_binding: clone(ANTITRUST_REGULATORY_WORK3_PACKET_BINDING),
    ben_rulings_binding: clone(ANTITRUST_REGULATORY_WORK3_RULINGS_BINDING),
    session_receipt_reference: {
      schema_version: ANTITRUST_REGULATORY_WORK3_SESSION_BINDING.schema_version,
      ben_inventory_session_receipt_id: disposition.session_receipt_id,
      completion_state: 'COMPLETE',
    },
    review_accounting: clone(contract.review_accounting_exact_values),
    withheld_work3_fields: clone(ANTITRUST_REGULATORY_WORK3_WITHHELD_FIELDS),
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

function antitrustRegulatoryWork3ValidateSessionReceipt(envelope) {
  antitrustRegulatoryWork3ValidatePinnedEnvelope(
    envelope,
    ANTITRUST_REGULATORY_WORK3_SESSION_BINDING,
    'Antitrust regulatory Ben session receipt',
  );
  const record = envelope.record;
  if (
    record.completion_state !== 'COMPLETE'
    || record.disposition_binding.inventory_disposition_id
      !== ANTITRUST_REGULATORY_WORK3_DISPOSITION_BINDING.record_id
    || record.zero_effect_boundary.work3_identity_count !== 0
  ) fail(ANTITRUST_REGULATORY_WORK3_CODES.RECEIPT, 'Antitrust regulatory Ben session receipt drift.');
  return record;
}

function prepareAntitrustRegulatoryWork3FamilyPackageSeal(input) {
  const evidenceKeys = [
    'work3AntitrustRegulatoryUnapprovedInventoryReviewAuthority',
    'work3AntitrustRegulatoryBenInventorySessionSuccessorAuthority',
    'work3AntitrustRegulatoryFamilyPackageSealSuccessorAuthority',
    'inventoryReviewPacketDraft',
    'benAuthoredInventoryDisposition',
    'benInventorySessionReceipt',
  ];
  const evidence = antitrustRegulatoryWork3ValidateInput(
    input,
    ['antitrustRegulatoryWork3FamilyPackageSealEvidence', 'antitrustRegulatoryPhase4ReviewInput'],
    'antitrustRegulatoryWork3FamilyPackageSealEvidence',
    evidenceKeys,
  );
  const authorityEnvelope = antitrustRegulatoryWork3ValidatePinnedEnvelope(
    evidence.work3AntitrustRegulatoryFamilyPackageSealSuccessorAuthority,
    ANTITRUST_REGULATORY_WORK3_SEAL_AUTHORITY_BINDING,
    'Antitrust regulatory family package seal authority',
  );
  const dispositionCandidate = prepareAntitrustRegulatoryWork3BenInventorySessionDisposition({
    antitrustRegulatoryWork3BenInventorySessionDispositionEvidence: {
      work3AntitrustRegulatoryUnapprovedInventoryReviewAuthority:
        evidence.work3AntitrustRegulatoryUnapprovedInventoryReviewAuthority,
      work3AntitrustRegulatoryBenInventorySessionSuccessorAuthority:
        evidence.work3AntitrustRegulatoryBenInventorySessionSuccessorAuthority,
      inventoryReviewPacketDraft: evidence.inventoryReviewPacketDraft,
      benAuthoredInventoryDisposition: evidence.benAuthoredInventoryDisposition,
    },
    antitrustRegulatoryPhase4ReviewInput: input.antitrustRegulatoryPhase4ReviewInput,
  });
  antitrustRegulatoryWork3ValidateSessionReceipt(evidence.benInventorySessionReceipt);
  if (
    dispositionCandidate.session_receipt_reference.ben_inventory_session_receipt_id
      !== evidence.benInventorySessionReceipt.record.ben_inventory_session_receipt_id
  ) fail(ANTITRUST_REGULATORY_WORK3_CODES.RECEIPT, 'Antitrust regulatory session receipt identity drift.');
  const contract = authorityEnvelope.record.schema_review_candidate_contract;
  const unsigned = {
    schema_version: contract.schema_version,
    candidate_state: contract.candidate_state,
    authority_binding: clone(authorityEnvelope.binding),
    inventory_session_disposition_reference: {
      inventory_disposition_id: ANTITRUST_REGULATORY_WORK3_DISPOSITION_BINDING.record_id,
      candidate_state: dispositionCandidate.candidate_state,
    },
    ben_rulings_binding: clone(ANTITRUST_REGULATORY_WORK3_RULINGS_BINDING),
    disposition_binding: clone(ANTITRUST_REGULATORY_WORK3_DISPOSITION_BINDING),
    session_receipt_binding: clone(ANTITRUST_REGULATORY_WORK3_SESSION_BINDING),
    legal_grouping_disposition_binding: {
      ...clone(ANTITRUST_REGULATORY_WORK3_RULINGS_BINDING),
      disposition_status: 'PENDING_LEGAL_REVIEW',
      legal_grouping_review_pending_count: ANTITRUST_REGULATORY_PROFILE_COUNT,
      populated_subtype_bucket_count: ANTITRUST_REGULATORY_POPULATED_SUBTYPE_BUCKET_COUNT,
      registered_subtype_bucket_count: ANTITRUST_REGULATORY_REGISTERED_SUBTYPE_BUCKET_COUNT,
      m5_subtype_bucket_partition_unresolved_count:
        ANTITRUST_REGULATORY_M5_SUBTYPE_UNRESOLVED_PROFILE_COUNT,
      non_hsr_filing_regime_count: ANTITRUST_REGULATORY_NON_HSR_FILING_REGIME_PROFILE_COUNT,
      one_sided_obligor_capacity_count: ANTITRUST_REGULATORY_ONE_SIDED_OBLIGOR_PROFILE_COUNT,
    },
    review_accounting: clone(contract.review_accounting_exact_values),
    withheld_work3_fields: clone(ANTITRUST_REGULATORY_WORK3_WITHHELD_FIELDS),
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

function antitrustRegulatoryWork3ValidateSealReceipt(envelope) {
  antitrustRegulatoryWork3ValidatePinnedEnvelope(
    envelope,
    ANTITRUST_REGULATORY_WORK3_SEAL_RECEIPT_BINDING,
    'Antitrust regulatory family seal receipt',
  );
  const record = envelope.record;
  if (
    record.completion_state !== 'COMPLETE'
    || record.reviewer !== 'BEN_GOODCHILD'
    || record.disposition_binding.record_id !== ANTITRUST_REGULATORY_WORK3_DISPOSITION_BINDING.record_id
    || record.legal_grouping_disposition_binding.disposition_status !== 'PENDING_LEGAL_REVIEW'
    || record.zero_effect_boundary.work3_identity_count !== 0
  ) fail(ANTITRUST_REGULATORY_WORK3_CODES.RECEIPT, 'Antitrust regulatory family seal receipt drift.');
  return record;
}

function prepareAntitrustRegulatoryWork3FamilyPackageRegistration(input) {
  const evidenceKeys = [
    'work3AntitrustRegulatoryUnapprovedInventoryReviewAuthority',
    'work3AntitrustRegulatoryBenInventorySessionSuccessorAuthority',
    'work3AntitrustRegulatoryFamilyPackageSealSuccessorAuthority',
    'work3AntitrustRegulatoryRegistrationSuccessorAuthority',
    'inventoryReviewPacketDraft',
    'benAuthoredInventoryDisposition',
    'benInventorySessionReceipt',
    'familyPackageSealReceipt',
  ];
  const evidence = antitrustRegulatoryWork3ValidateInput(
    input,
    ['antitrustRegulatoryWork3FamilyPackageRegistrationEvidence', 'antitrustRegulatoryPhase4ReviewInput'],
    'antitrustRegulatoryWork3FamilyPackageRegistrationEvidence',
    evidenceKeys,
  );
  const authorityEnvelope = antitrustRegulatoryWork3ValidatePinnedEnvelope(
    evidence.work3AntitrustRegulatoryRegistrationSuccessorAuthority,
    ANTITRUST_REGULATORY_WORK3_REGISTRATION_AUTHORITY_BINDING,
    'Antitrust regulatory registration authority',
  );
  const sealCandidate = prepareAntitrustRegulatoryWork3FamilyPackageSeal({
    antitrustRegulatoryWork3FamilyPackageSealEvidence: {
      work3AntitrustRegulatoryUnapprovedInventoryReviewAuthority:
        evidence.work3AntitrustRegulatoryUnapprovedInventoryReviewAuthority,
      work3AntitrustRegulatoryBenInventorySessionSuccessorAuthority:
        evidence.work3AntitrustRegulatoryBenInventorySessionSuccessorAuthority,
      work3AntitrustRegulatoryFamilyPackageSealSuccessorAuthority:
        evidence.work3AntitrustRegulatoryFamilyPackageSealSuccessorAuthority,
      inventoryReviewPacketDraft: evidence.inventoryReviewPacketDraft,
      benAuthoredInventoryDisposition: evidence.benAuthoredInventoryDisposition,
      benInventorySessionReceipt: evidence.benInventorySessionReceipt,
    },
    antitrustRegulatoryPhase4ReviewInput: input.antitrustRegulatoryPhase4ReviewInput,
  });
  const sealReceipt = antitrustRegulatoryWork3ValidateSealReceipt(evidence.familyPackageSealReceipt);
  if (sealReceipt.family_package_seal_id !== sealCandidate.family_package_seal_id) {
    fail(
      ANTITRUST_REGULATORY_WORK3_CODES.RECEIPT,
      'Antitrust regulatory family seal candidate and receipt identity drift.',
    );
  }
  const phase4 = antitrustRegulatoryWork3Phase4(input.antitrustRegulatoryPhase4ReviewInput);
  const dispositionByKey = new Map(
    evidence.benAuthoredInventoryDisposition.record.profile_dispositions.map(
      (row) => [row.proposed_profile_key, row],
    ),
  );
  const registeredProfiles = phase4.proposed_profiles.map((profile) => {
    const disposition = dispositionByKey.get(profile.proposed_profile_key);
    if (!disposition) {
      fail(ANTITRUST_REGULATORY_WORK3_CODES.OUTPUT, 'Antitrust regulatory registration disposition missing.');
    }
    const identityInput = {
      family_key: 'ANTITRUST_REGULATORY',
      proposed_profile_key: profile.proposed_profile_key,
      phase3_profile_key: null,
      profile_set_version: 1,
    };
    return {
      profile_id: contentId('M7_V2_ANTITRUST_REGULATORY_WORK3_REGISTERED_PROFILE_IDENTITY/V1', identityInput),
      proposed_profile_key: profile.proposed_profile_key,
      phase3_profile_key: null,
      inventory_disposition: disposition.disposition,
      legal_grouping_pending_acknowledged: disposition.legal_grouping_pending_acknowledged,
    };
  });
  const packageUnsigned = {
    family_key: 'ANTITRUST_REGULATORY',
    profile_set_version: 1,
    package_state: 'BEN_SEALED_IN_MEMORY_REGISTRATION_ONLY',
    profile_id_count: ANTITRUST_REGULATORY_PROFILE_COUNT,
    profile_ids: registeredProfiles.map((profile) => profile.profile_id),
    inventory_disposition_id: ANTITRUST_REGULATORY_WORK3_DISPOSITION_BINDING.record_id,
    family_package_seal_receipt_id: ANTITRUST_REGULATORY_WORK3_SEAL_RECEIPT_BINDING.record_id,
    legal_grouping_disposition_state: 'PENDING_LEGAL_REVIEW',
  };
  const packageIdentity = {
    family_profile_package_id: contentId(
      'M7_V2_ANTITRUST_REGULATORY_WORK3_FAMILY_PROFILE_PACKAGE_IDENTITY/V1',
      packageUnsigned,
    ),
    family_key: packageUnsigned.family_key,
    profile_set_version: 1,
    package_state: packageUnsigned.package_state,
    profile_id_count: ANTITRUST_REGULATORY_PROFILE_COUNT,
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
    family_package_seal_receipt_binding: clone(ANTITRUST_REGULATORY_WORK3_SEAL_RECEIPT_BINDING),
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
      state: 'STOP_AFTER_ANTITRUST_REGULATORY_FAMILY_PACKAGE_REGISTRATION_BEFORE_ACTIVATION',
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
    result.registered_profile_identities.length !== ANTITRUST_REGULATORY_PROFILE_COUNT
    || result.review_accounting.profile_identity_count !== ANTITRUST_REGULATORY_PROFILE_COUNT
    || result.review_accounting.work3_identity_count !== ANTITRUST_REGULATORY_PROFILE_COUNT + 1
    || result.zero_effect_boundary.activation_count !== 0
    || antitrustRegulatoryContainsForbiddenKey(result, new Set(['activation_id']))
  ) fail(ANTITRUST_REGULATORY_WORK3_CODES.OUTPUT, 'Antitrust regulatory family registration boundary drift.');
  return result;
}

module.exports = {
  ANTITRUST_REGULATORY_M5_SUBTYPE_UNRESOLVED_PROFILE_COUNT,
  ANTITRUST_REGULATORY_NON_HSR_FILING_REGIME_PROFILE_COUNT,
  ANTITRUST_REGULATORY_ONE_SIDED_OBLIGOR_PROFILE_COUNT,
  ANTITRUST_REGULATORY_POPULATED_SUBTYPE_BUCKET_COUNT,
  ANTITRUST_REGULATORY_REGISTERED_SUBTYPE_BUCKET_COUNT,
  ANTITRUST_REGULATORY_REVIEW_FLAGS,
  ANTITRUST_REGULATORY_PHASE2_AUTHORITY_BYTES,
  ANTITRUST_REGULATORY_PHASE2_AUTHORITY_ID,
  ANTITRUST_REGULATORY_PHASE2_AUTHORITY_PATH,
  ANTITRUST_REGULATORY_PHASE2_AUTHORITY_SCHEMA,
  ANTITRUST_REGULATORY_PHASE2_AUTHORITY_SHA256,
  ANTITRUST_REGULATORY_PHASE2_PROPOSAL_CODES,
  ANTITRUST_REGULATORY_PHASE2_PROPOSAL_KEYS,
  ANTITRUST_REGULATORY_PHASE4_AUTHORITY_BYTES,
  ANTITRUST_REGULATORY_PHASE4_AUTHORITY_ID,
  ANTITRUST_REGULATORY_PHASE4_AUTHORITY_PATH,
  ANTITRUST_REGULATORY_PHASE4_AUTHORITY_SCHEMA,
  ANTITRUST_REGULATORY_PHASE4_AUTHORITY_SHA256,
  ANTITRUST_REGULATORY_PHASE4_CANDIDATE_SCHEMA,
  ANTITRUST_REGULATORY_PHASE4_CANDIDATE_STATE,
  ANTITRUST_REGULATORY_PHASE4_REVIEW_CODES,
  ANTITRUST_REGULATORY_PHASE4_REVIEW_INPUT_KEYS,
  ANTITRUST_REGULATORY_PHASE4_REVIEW_OUTPUT_KEYS,
  ANTITRUST_REGULATORY_PHASE4_SCHEDULE_SHA256,
  ANTITRUST_REGULATORY_PROFILE_COUNT,
  prepareAntitrustRegulatoryFamilyProfilePackageReview,
  prepareAntitrustRegulatoryPhase2FamilyProposal,
  prepareAntitrustRegulatoryWork3BenInventorySessionDisposition,
  prepareAntitrustRegulatoryWork3FamilyPackageRegistration,
  prepareAntitrustRegulatoryWork3FamilyPackageSeal,
  prepareAntitrustRegulatoryWork3UnapprovedInventoryReview,
  antitrustRegulatoryProposalPartition,
  validateAntitrustRegulatoryUnapprovedInventoryReviewEvidence,
};
