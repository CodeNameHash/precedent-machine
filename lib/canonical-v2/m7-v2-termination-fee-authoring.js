'use strict';

/**
 * TERMINATION_FEE Work3 Milestone A authoring, family-local.
 *
 * Self-contained (no `m7-v2-profile-authoring` spine dependency) so the family
 * slice can land while the shared spine merge is in flight. Covers Phase 2
 * partition, Phase 4 package review, and the Work3 inventory -> Ben disposition
 * -> family package seal -> registration ladder. Phase 3 reference
 * materialisation is deliberately absent: every comparator terminal carries an
 * empty dependency contract, so no unresolved M3 reference edge blocks a
 * required role.
 */

const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');

const TERMINATION_FEE_PHASE2_AUTHORITY_SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_FEE_AUTHORING_PHASE2_AUTHORITY/V2';
const TERMINATION_FEE_PHASE2_AUTHORITY_ID =
  '9e0a80b30e7b1f39ffd5795ad3ed929e0433ccb6cc061b8e6263610f903e5682';
const TERMINATION_FEE_PHASE2_AUTHORITY_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-termination-fee-authoring-phase2-authority-v2.json';
const TERMINATION_FEE_PHASE2_AUTHORITY_BYTES = 68551;
const TERMINATION_FEE_PHASE2_AUTHORITY_SHA256 =
  '0c3d2e0d7642ca2eddb178d9c86e53ef5a53ab71be6c3aca6aa5d13ef1665e98';

const TERMINATION_FEE_PROFILE_COUNT = 20;

const TERMINATION_FEE_PHASE2_PROPOSAL_CODES = Object.freeze({
  AUTHORITY: 'M7_V2_TERMINATION_FEE_PHASE2_AUTHORITY',
  CONTRACT: 'M7_V2_TERMINATION_FEE_PHASE2_PROPOSAL_CONTRACT',
  COVERAGE: 'M7_V2_TERMINATION_FEE_PHASE2_SOURCE_COVERAGE',
});

const TERMINATION_FEE_PHASE2_PROPOSAL_KEYS = Object.freeze([
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

const TERMINATION_FEE_PHASE2_UNRESOLVED_ITEMS = Object.freeze([
  'COMPARATOR_OWNER_FAMILY_ASSIGNMENT_UNRESOLVED',
  'EXACT_PROFILE_INVENTORY_REQUIRES_SEPARATE_APPROVAL',
  'FEE_SIDE_PARTITION_UNRESOLVED',
  'LEGAL_GROUPING_REVIEW_REQUIRED',
  'TERMINATION_FEE_Q01_Q02_Q03_OPEN_REQUIRES_BEN_RULING',
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

function validateTerminationFeeProposalAuthority(envelope) {
  const code = TERMINATION_FEE_PHASE2_PROPOSAL_CODES.AUTHORITY;
  validateEnvelopeShape(envelope, code, 'Phase2 authority');
  validateBoundRecord(envelope, code, 'Phase2 authority');
  const { binding, record } = envelope;
  if (
    binding.byte_length !== TERMINATION_FEE_PHASE2_AUTHORITY_BYTES
    || binding.path !== TERMINATION_FEE_PHASE2_AUTHORITY_PATH
    || binding.record_id !== TERMINATION_FEE_PHASE2_AUTHORITY_ID
    || binding.record_id_field !== 'termination_fee_authoring_phase2_authority_id'
    || binding.schema_version !== TERMINATION_FEE_PHASE2_AUTHORITY_SCHEMA
    || binding.sha256 !== TERMINATION_FEE_PHASE2_AUTHORITY_SHA256
  ) {
    fail(code, 'Phase2 authority binding drift.');
  }
  if (
    record.schema_version !== TERMINATION_FEE_PHASE2_AUTHORITY_SCHEMA
    || record.termination_fee_authoring_phase2_authority_id
      !== TERMINATION_FEE_PHASE2_AUTHORITY_ID
  ) {
    fail(code, 'Phase2 authority identity drift.');
  }
  const unsigned = { ...record };
  delete unsigned.termination_fee_authoring_phase2_authority_id;
  if (contentId(record.schema_version, unsigned) !== TERMINATION_FEE_PHASE2_AUTHORITY_ID) {
    fail(code, 'Phase2 authority self identity drift.');
  }
  return deepFreeze(clone(envelope));
}

function terminationFeeAgreementSources(authority, agreementEvidenceByAgreementId) {
  const code = TERMINATION_FEE_PHASE2_PROPOSAL_CODES.COVERAGE;
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
    const claimsById = new Map(
      evidence.m4.record.claims.map((claim) => [claim.analysis_claim_id, claim]),
    );
    agreements.set(agreementId, { claimsById });
  }
  return agreements;
}

function validateTerminationFeeProposalGovernedSources(authority, governedSources) {
  const code = TERMINATION_FEE_PHASE2_PROPOSAL_CODES.COVERAGE;
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
  return terminationFeeAgreementSources(
    authority,
    governedSources.agreementEvidenceByAgreementId,
  );
}

function validateTerminationFeeProposalSourceCoverage(authority, agreements) {
  const code = TERMINATION_FEE_PHASE2_PROPOSAL_CODES.COVERAGE;
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
      || terminal.m4_claim_ids.length !== 1
      || terminal.signature_binding_kind !== 'COMPARATOR_DERIVED'
    ) {
      fail(code, `Comparator closure shape drift for ${terminal.source_unit_key}.`);
    }
    const member = terminal.source_closure.members[0];
    const claim = agreement.claimsById.get(terminal.m4_claim_ids[0]);
    if (
      !claim
      || claim.agreement_id !== terminal.agreement_id
      || claim.family !== 'TERMINATION_FEE'
      || claim.claim_definition_key !== member.claim_definition_key
    ) {
      fail(code, `M4 claim proof mismatch for ${terminal.source_unit_key}.`);
    }
    const expectedSourceUnitKey = contentId('TERMINATION_FEE_TERMINAL_SOURCE_UNIT/V1', {
      agreement_id: terminal.agreement_id,
      concept_key: member.concept_key,
      m4_claim_id: terminal.m4_claim_ids[0],
      claim_revision_id: member.claim_revision_id,
    });
    if (expectedSourceUnitKey !== terminal.source_unit_key) {
      fail(code, `Derived source-unit identity drift for ${terminal.source_unit_key}.`);
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
    || uniqueSourceUnitIds.length !== expectedTerminalCount
  ) {
    fail(code, `The exact ${expectedClaimCount} M4 claim inventory is not closed.`);
  }
  return {
    terminals,
    sourceUnitIds: uniqueSourceUnitIds,
    claimIds: uniqueClaimIds,
  };
}

function terminationFeeProposalCoverageRecords(authority, coverage) {
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

function terminationFeeProposalPartition(coverage) {
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
    compareStrings(left.proposed_profile_key, right.proposed_profile_key),
  );
  return {
    proposed_profiles: proposedProfiles,
    source_unit_assignment_count: coverage.sourceUnitIds.length,
    m4_claim_assignment_count: coverage.claimIds.length,
  };
}

function terminationFeeProposalInventoryDigest(coverage, proposedPartition) {
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

function prepareTerminationFeePhase2FamilyProposal(input) {
  const contractCode = TERMINATION_FEE_PHASE2_PROPOSAL_CODES.CONTRACT;
  exactKeysOrFail(
    input,
    ['terminationFeeAuthoringPhase2Authority', 'governedSources'],
    contractCode,
    'Termination fee proposal input',
  );
  const authorityEnvelope = validateTerminationFeeProposalAuthority(
    input.terminationFeeAuthoringPhase2Authority,
  );
  const authority = authorityEnvelope.record;
  const agreements = validateTerminationFeeProposalGovernedSources(
    authority,
    input.governedSources,
  );
  const coverage = validateTerminationFeeProposalSourceCoverage(authority, agreements);
  const accounting = terminationFeeProposalCoverageRecords(authority, coverage);
  const proposedPartition = terminationFeeProposalPartition(coverage);
  const authorityBinding = {
    path: authorityEnvelope.binding.path,
    schema_version: authorityEnvelope.binding.schema_version,
    record_id_field: authorityEnvelope.binding.record_id_field,
    record_id: authorityEnvelope.binding.record_id,
    byte_length: authorityEnvelope.binding.byte_length,
    sha256: authorityEnvelope.binding.sha256,
  };
  const unsignedProposal = {
    schema_version: 'M7_V2_TERMINATION_FEE_FAMILY_PROPOSAL/V1',
    family_key: 'TERMINATION_FEE',
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
    inventory_digest: terminationFeeProposalInventoryDigest(coverage, proposedPartition),
    unresolved_items: [...TERMINATION_FEE_PHASE2_UNRESOLVED_ITEMS],
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

const TERMINATION_FEE_PHASE4_AUTHORITY_SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_CONTRACT_TERMINATION_FEE_AUTHORING_PHASE4_FAMILY_PROFILE_PACKAGE_REVIEW_AUTHORITY/V1';
const TERMINATION_FEE_PHASE4_AUTHORITY_ID =
  '14b52cda98e3d7026f341ad15285358cb2de7a5e0c42d5b7c24087e46c07feb9';
const TERMINATION_FEE_PHASE4_AUTHORITY_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-termination-fee-authoring-phase4-family-profile-package-review-authority.json';
const TERMINATION_FEE_PHASE4_AUTHORITY_BYTES = 27799;
const TERMINATION_FEE_PHASE4_AUTHORITY_SHA256 =
  '1a3159f453c62619cebf741136a092cabff59ff43167c8a632dfebbeaca01759';
const TERMINATION_FEE_PHASE4_SCHEDULE_SHA256 =
  '47c30b4d9512e36541447836957deabe7aba7361306b76cd5c12f027bf7bbca6';
const TERMINATION_FEE_PHASE4_CANDIDATE_SCHEMA =
  'M7_V2_TERMINATION_FEE_PHASE4_FAMILY_PROFILE_PACKAGE_REVIEW_CANDIDATE/V1';
const TERMINATION_FEE_PHASE4_CANDIDATE_STATE =
  'REVIEW_ONLY_20_PROFILES_UNAPPROVED_AWAITING_BEN_INVENTORY';

const TERMINATION_FEE_PHASE4_REVIEW_CODES = Object.freeze({
  CONTRACT: 'M7_V2_TERMINATION_FEE_PHASE4_REVIEW_CONTRACT',
  AUTHORITY: 'M7_V2_TERMINATION_FEE_PHASE4_REVIEW_AUTHORITY',
  PHASE2_PROPOSAL: 'M7_V2_TERMINATION_FEE_PHASE4_PHASE2_PROPOSAL',
  PROFILE_SCHEDULE: 'M7_V2_TERMINATION_FEE_PHASE4_PROFILE_SCHEDULE',
  REVIEW_OUTPUT: 'M7_V2_TERMINATION_FEE_PHASE4_REVIEW_OUTPUT',
});

const TERMINATION_FEE_PHASE4_REVIEW_INPUT_KEYS = Object.freeze([
  'terminationFeeAuthoringPhase4FamilyProfilePackageReviewAuthority',
  'terminationFeeAuthoringPhase2Authority',
  'governedSources',
]);

const TERMINATION_FEE_PHASE4_REVIEW_OUTPUT_KEYS = Object.freeze([
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

const TERMINATION_FEE_PHASE4_AUTHORITY_ROOT_KEYS = Object.freeze([
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
  'schema_version',
  'termination_fee_authoring_phase4_family_profile_package_review_authority_id',
  'zero_effect_boundary',
]);

function terminationFeePhase4ExpectedParentBindings() {
  return {
    termination_fee_authoring_phase2_authority: {
      byte_length: TERMINATION_FEE_PHASE2_AUTHORITY_BYTES,
      path: TERMINATION_FEE_PHASE2_AUTHORITY_PATH,
      record_id: TERMINATION_FEE_PHASE2_AUTHORITY_ID,
      record_id_field: 'termination_fee_authoring_phase2_authority_id',
      schema_version: TERMINATION_FEE_PHASE2_AUTHORITY_SCHEMA,
      sha256: TERMINATION_FEE_PHASE2_AUTHORITY_SHA256,
    },
  };
}

function terminationFeeContainsForbiddenKey(value, forbiddenKeys, seen = new Set()) {
  if (!value || typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) {
    return value.some((member) => terminationFeeContainsForbiddenKey(member, forbiddenKeys, seen));
  }
  for (const [key, member] of Object.entries(value)) {
    if (forbiddenKeys.has(key)) return true;
    if (terminationFeeContainsForbiddenKey(member, forbiddenKeys, seen)) return true;
  }
  return false;
}

function validateTerminationFeePhase4FamilyProfilePackageReviewAuthority(envelope) {
  const code = TERMINATION_FEE_PHASE4_REVIEW_CODES.AUTHORITY;
  validateEnvelopeShape(envelope, code, 'Phase4 family profile package review authority');
  const { binding, record } = envelope;
  if (
    binding.byte_length !== TERMINATION_FEE_PHASE4_AUTHORITY_BYTES
    || binding.path !== TERMINATION_FEE_PHASE4_AUTHORITY_PATH
    || binding.record_id !== TERMINATION_FEE_PHASE4_AUTHORITY_ID
    || binding.record_id_field
      !== 'termination_fee_authoring_phase4_family_profile_package_review_authority_id'
    || binding.schema_version !== TERMINATION_FEE_PHASE4_AUTHORITY_SCHEMA
    || binding.sha256 !== TERMINATION_FEE_PHASE4_AUTHORITY_SHA256
  ) {
    fail(code, 'Phase4 family profile package review authority binding drift.');
  }
  validateBoundRecord(envelope, code, 'Phase4 family profile package review authority');
  if (
    !exactKeys(record, TERMINATION_FEE_PHASE4_AUTHORITY_ROOT_KEYS)
    || record.schema_version !== TERMINATION_FEE_PHASE4_AUTHORITY_SCHEMA
    || record.termination_fee_authoring_phase4_family_profile_package_review_authority_id
      !== TERMINATION_FEE_PHASE4_AUTHORITY_ID
  ) {
    fail(code, 'Phase4 family profile package review authority identity drift.');
  }
  const unsigned = { ...record };
  delete unsigned.termination_fee_authoring_phase4_family_profile_package_review_authority_id;
  if (contentId(record.schema_version, unsigned) !== TERMINATION_FEE_PHASE4_AUTHORITY_ID) {
    fail(code, 'Phase4 family profile package review authority self identity drift.');
  }

  const implementation = record.implementation_contract;
  const output = record.candidate_output_contract;
  const scheduleContract = record.profile_review_schedule_contract;
  const schedule = record.profile_review_schedule;
  const expectedErrorCodes = Object.values(TERMINATION_FEE_PHASE4_REVIEW_CODES);
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
    || !sameValue(record.immutable_parent_bindings, terminationFeePhase4ExpectedParentBindings())
    || !sameValue(implementation.exact_outer_input_keys, TERMINATION_FEE_PHASE4_REVIEW_INPUT_KEYS)
    || implementation.exported_function !== 'prepareTerminationFeeFamilyProfilePackageReview'
    || implementation.phase2_internal_function !== 'prepareTerminationFeePhase2FamilyProposal'
    || implementation.phase3_internal_function !== null
    || implementation.caller_produced_candidate_input_forbidden !== true
    || !Array.isArray(implementation.error_precedence)
    || implementation.error_precedence.length !== expectedErrorCodes.length
    || implementation.error_precedence.some((entry, index) => (
      entry.order !== index + 1 || entry.code !== expectedErrorCodes[index]
    ))
    || output.schema_version !== TERMINATION_FEE_PHASE4_CANDIDATE_SCHEMA
    || output.record_id_field !== 'review_candidate_id'
    || output.candidate_state !== TERMINATION_FEE_PHASE4_CANDIDATE_STATE
    || output.profile_approval_state !== 'UNAPPROVED'
    || !sameValue(output.exact_keys, TERMINATION_FEE_PHASE4_REVIEW_OUTPUT_KEYS)
    || schedule.length !== TERMINATION_FEE_PROFILE_COUNT
    || scheduleContract.exact_profile_count !== TERMINATION_FEE_PROFILE_COUNT
    || scheduleContract.exact_complete_profile_count !== TERMINATION_FEE_PROFILE_COUNT
    || scheduleContract.exact_incomplete_profile_count !== 0
    || scheduleContract.schedule_canonical_json_sha256 !== TERMINATION_FEE_PHASE4_SCHEDULE_SHA256
    || sha256Hex(scheduleBytes) !== TERMINATION_FEE_PHASE4_SCHEDULE_SHA256
    || scheduleContract.schedule_canonical_json_byte_length !== scheduleBytes.length
  ) {
    fail(code, 'Phase4 family profile package review authority contract drift.');
  }
  return deepFreeze(clone(envelope));
}

function terminationFeePhase4ValidatePhase2Proposal(proposal) {
  const code = TERMINATION_FEE_PHASE4_REVIEW_CODES.PHASE2_PROPOSAL;
  if (
    !isObject(proposal)
    || proposal.schema_version !== 'M7_V2_TERMINATION_FEE_FAMILY_PROPOSAL/V1'
    || proposal.family_key !== 'TERMINATION_FEE'
    || proposal.profile_approval_state !== 'UNAPPROVED'
    || proposal.source_terminal_coverage.accounted_count !== TERMINATION_FEE_PROFILE_COUNT
    || proposal.m4_claim_accounting.accounted_count !== TERMINATION_FEE_PROFILE_COUNT
    || proposal.derived_profile_count !== TERMINATION_FEE_PROFILE_COUNT
    || !Array.isArray(proposal.proposed_partition.proposed_profiles)
    || proposal.proposed_partition.proposed_profiles.length !== TERMINATION_FEE_PROFILE_COUNT
    || proposal.proposed_partition.source_unit_assignment_count !== TERMINATION_FEE_PROFILE_COUNT
    || proposal.proposed_partition.m4_claim_assignment_count !== TERMINATION_FEE_PROFILE_COUNT
  ) {
    fail(code, 'Phase4 fresh Phase2 proposal drift.');
  }
  const unsigned = { ...proposal };
  delete unsigned.proposal_id;
  if (contentId(proposal.schema_version, unsigned) !== proposal.proposal_id) {
    fail(code, 'Phase4 fresh Phase2 proposal identity drift.');
  }
}

function terminationFeePhase4DeriveProfiles(authority, phase2Proposal) {
  const scheduleCode = TERMINATION_FEE_PHASE4_REVIEW_CODES.PROFILE_SCHEDULE;
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
      || expected.package_profile_key
        !== [
          'PROFILE',
          'TERMINATION_FEE',
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

function prepareTerminationFeeFamilyProfilePackageReview(input) {
  const contractCode = TERMINATION_FEE_PHASE4_REVIEW_CODES.CONTRACT;
  exactKeysOrFail(
    input,
    TERMINATION_FEE_PHASE4_REVIEW_INPUT_KEYS,
    contractCode,
    'Termination fee Phase4 package review input',
  );
  const authorityEnvelope = validateTerminationFeePhase4FamilyProfilePackageReviewAuthority(
    input.terminationFeeAuthoringPhase4FamilyProfilePackageReviewAuthority,
  );
  const authority = authorityEnvelope.record;
  const phase2AuthorityEnvelope = validateTerminationFeeProposalAuthority(
    input.terminationFeeAuthoringPhase2Authority,
  );
  if (
    phase2AuthorityEnvelope.binding.record_id
      !== authority.immutable_parent_bindings
        .termination_fee_authoring_phase2_authority.record_id
  ) {
    fail(TERMINATION_FEE_PHASE4_REVIEW_CODES.AUTHORITY, 'Phase4 parent Phase2 authority pin drift.');
  }
  validateTerminationFeeProposalGovernedSources(
    phase2AuthorityEnvelope.record,
    input.governedSources,
  );

  let phase2Proposal;
  try {
    phase2Proposal = prepareTerminationFeePhase2FamilyProposal({
      terminationFeeAuthoringPhase2Authority: input.terminationFeeAuthoringPhase2Authority,
      governedSources: input.governedSources,
    });
  } catch (error) {
    fail(
      TERMINATION_FEE_PHASE4_REVIEW_CODES.PHASE2_PROPOSAL,
      'Phase4 fresh Phase2 proposal failed.',
      { cause_code: typeof error.code === 'string' ? error.code : null },
    );
  }
  terminationFeePhase4ValidatePhase2Proposal(phase2Proposal);
  const proposedProfiles = terminationFeePhase4DeriveProfiles(authority, phase2Proposal);
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
    schema_version: TERMINATION_FEE_PHASE4_CANDIDATE_SCHEMA,
    family_key: 'TERMINATION_FEE',
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
    !exactKeys(candidate, TERMINATION_FEE_PHASE4_REVIEW_OUTPUT_KEYS)
    || proposedProfiles.length !== TERMINATION_FEE_PROFILE_COUNT
    || proposedProfiles.some((profile) => (
      !exactKeys(profile, outputContract.profile_exact_keys)
      || !exactKeys(profile.proposed_validation, outputContract.proposed_validation_exact_keys)
    ))
    || !sameValue(candidate.review_accounting, outputContract.review_accounting_exact_values)
    || !sameValue(candidate.unresolved_items, outputContract.unresolved_items)
    || !sameValue(candidate.withheld_work3_fields, outputContract.withheld_work3_fields)
    || !sameValue(candidate.first_legal_stop, authority.first_legal_stop_contract)
    || !sameValue(candidate.zero_effect_boundary, authority.zero_effect_boundary)
    || terminationFeeContainsForbiddenKey(candidate, forbiddenKeys)
  ) {
    fail(
      TERMINATION_FEE_PHASE4_REVIEW_CODES.REVIEW_OUTPUT,
      'Phase4 package review output boundary drift.',
    );
  }
  return deepFreeze(clone(candidate));
}

const TERMINATION_FEE_WORK3_CONTROL_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control';
const TERMINATION_FEE_WORK3_APPROVE_COUNT = 8;
const TERMINATION_FEE_WORK3_HOLD_COUNT = 12;

/**
 * A row carrying either flag is an honest hold. Ten sole-remedy rows are
 * assigned to `SPECIFIC_PERFORMANCE_REMEDIES` by the comparator resolution
 * itself, so sealed Q02 (one semantic owner) is unsettled for them; two
 * reverse-side fee rows carry a BUYER fee side that the single sealed
 * `FEE_AMOUNT` label does not distinguish. Neither is a defect in the
 * extracted source.
 */
const TERMINATION_FEE_WORK3_HOLD_REVIEW_FLAGS = Object.freeze([
  'COMPARATOR_OWNER_FAMILY_DISPOSITION_REQUIRED',
  'FEE_SIDE_PARTITION_DISPOSITION_REQUIRED',
]);

const TERMINATION_FEE_WORK3_RULINGS_BINDING = Object.freeze({
  byte_length: 5815,
  path: 'docs/codex-program/notes/TERMINATION-FEE-BEN-RULINGS-Q01-Q03-2026-08-24.md',
  sha256: '94b5bf97818c6bd5f36cf409c8e341488a1c038e9dc6a8dd51af1fd17ce21ae4',
});
const TERMINATION_FEE_WORK3_INVENTORY_AUTHORITY_BINDING = Object.freeze({
  byte_length: 1990,
  path: `${TERMINATION_FEE_WORK3_CONTROL_PATH}/m7-v2-repair-contract-work3-termination-fee-unapproved-inventory-review-authority.json`,
  record_id: '9fe2de9350a622a7ef338b6fc76872579835f03ac915b8a0da6bf6fe0b1d3bf1',
  record_id_field: 'work3_termination_fee_unapproved_inventory_review_authority_id',
  schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_TERMINATION_FEE_UNAPPROVED_INVENTORY_REVIEW_AUTHORITY/V1',
  sha256: '421f1dc92e5c45c529878a180bd4582a51095603840d6720927c43fbc71b4428',
});
const TERMINATION_FEE_WORK3_PACKET_BINDING = Object.freeze({
  byte_length: 28015,
  path: `${TERMINATION_FEE_WORK3_CONTROL_PATH}/m7-v2-repair-termination-fee-20-profile-inventory-review-packet-draft.json`,
  record_id: '8c51a6cc3bfdcc1f2f7415350b5ed081ffa883273f1e4a27f982f9445a644157',
  record_id_field: 'inventory_review_packet_id',
  schema_version: 'STAGE_2Y_M7_V2_TERMINATION_FEE_20_PROFILE_INVENTORY_REVIEW_PACKET/V1',
  sha256: '63ec37f494447320193bc6bb60366a65ba9e360bede5751113d19d6188520e7c',
});
const TERMINATION_FEE_WORK3_DISPOSITION_BINDING = Object.freeze({
  byte_length: 8293,
  path: `${TERMINATION_FEE_WORK3_CONTROL_PATH}/m7-v2-repair-termination-fee-20-profile-inventory-disposition.json`,
  record_id: '4ddda88e01d79526a4e32d53fed6313b5079178bfcd70f4f0543e9f471b4ab37',
  record_id_field: 'inventory_disposition_id',
  schema_version: 'STAGE_2Y_M7_V2_TERMINATION_FEE_20_PROFILE_INVENTORY_DISPOSITION/V1',
  sha256: '99316ade43bc84003004092a94ce62e7abf5fbde07d9ab8ec6832f3f51a5a70e',
});
const TERMINATION_FEE_WORK3_SESSION_BINDING = Object.freeze({
  byte_length: 1126,
  path: `${TERMINATION_FEE_WORK3_CONTROL_PATH}/m7-v2-repair-termination-fee-ben-inventory-session-receipt.json`,
  record_id: 'de12ab0a73d257a608b84bfe2feef36c22c624ab99d1f601c2a2cefdd4d9849a',
  record_id_field: 'ben_inventory_session_receipt_id',
  schema_version: 'STAGE_2Y_M7_V2_TERMINATION_FEE_BEN_INVENTORY_SESSION_RECEIPT/V1',
  sha256: '3197970e3976d51cf02d90d90246aff116ef860174278a2c425ab5a5aad52087',
});
const TERMINATION_FEE_WORK3_BEN_AUTHORITY_BINDING = Object.freeze({
  byte_length: 2759,
  path: `${TERMINATION_FEE_WORK3_CONTROL_PATH}/m7-v2-repair-contract-work3-termination-fee-ben-inventory-session-successor-authority.json`,
  record_id: '0bc108ee89d43a7b57f86cbfa664606ff652c62f44de921c64429da7cd2a929c',
  record_id_field: 'work3_termination_fee_ben_inventory_session_successor_authority_id',
  schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_TERMINATION_FEE_BEN_INVENTORY_SESSION_SUCCESSOR_AUTHORITY/V1',
  sha256: '73b3bfd8113bb879c2193490d3217cd00069b2d436416ed48ae81ccab4d7d339',
});
const TERMINATION_FEE_WORK3_SEAL_AUTHORITY_BINDING = Object.freeze({
  byte_length: 3308,
  path: `${TERMINATION_FEE_WORK3_CONTROL_PATH}/m7-v2-repair-contract-work3-termination-fee-family-package-seal-successor-authority.json`,
  record_id: '77d6da32f222daac9914689e43e8709282bf58667af60266c1eab053b6a07149',
  record_id_field: 'work3_termination_fee_family_package_seal_successor_authority_id',
  schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_TERMINATION_FEE_FAMILY_PACKAGE_SEAL_SUCCESSOR_AUTHORITY/V1',
  sha256: '07fc5191aa706e31dff23dd5f14940d40d74adf6e442f3968b9892f9fe1e990f',
});
const TERMINATION_FEE_WORK3_SEAL_RECEIPT_BINDING = Object.freeze({
  byte_length: 2141,
  path: `${TERMINATION_FEE_WORK3_CONTROL_PATH}/m7-v2-repair-termination-fee-family-package-seal-receipt.json`,
  record_id: '003ce2ce3c72c6f0e712134a2ab30af3a2fc2b214fa9564b138565b2dd42d42b',
  record_id_field: 'termination_fee_family_package_seal_receipt_id',
  schema_version: 'STAGE_2Y_M7_V2_TERMINATION_FEE_FAMILY_PACKAGE_SEAL_RECEIPT/V1',
  sha256: '2fa63a85a39640354c8637886a1c86c1aac083d1c9f8eb56de1f5ae830ae5119',
});
const TERMINATION_FEE_WORK3_REGISTRATION_AUTHORITY_BINDING = Object.freeze({
  byte_length: 2888,
  path: `${TERMINATION_FEE_WORK3_CONTROL_PATH}/m7-v2-repair-contract-work3-termination-fee-registration-successor-authority.json`,
  record_id: 'fb963d723491c53e37905101baa4d6e4ad56df30238175b33d6e056ef327df67',
  record_id_field: 'work3_termination_fee_registration_successor_authority_id',
  schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_TERMINATION_FEE_REGISTRATION_SUCCESSOR_AUTHORITY/V1',
  sha256: 'b96b22dbba021a7402ce1e792bf02c08ad651ff7bfc38749f3eca2a36a68c954',
});

const TERMINATION_FEE_WORK3_CODES = Object.freeze({
  CONTRACT: 'M7_V2_TERMINATION_FEE_WORK3_CONTRACT',
  AUTHORITY: 'M7_V2_TERMINATION_FEE_WORK3_AUTHORITY',
  INVENTORY: 'M7_V2_TERMINATION_FEE_WORK3_INVENTORY',
  DISPOSITION: 'M7_V2_TERMINATION_FEE_WORK3_DISPOSITION',
  RECEIPT: 'M7_V2_TERMINATION_FEE_WORK3_RECEIPT',
  OUTPUT: 'M7_V2_TERMINATION_FEE_WORK3_OUTPUT',
});
const TERMINATION_FEE_WORK3_WITHHELD_FIELDS = Object.freeze([
  'activation_id',
  'family_profile_package_id',
  'profile_id',
  'registration_id',
]);

function terminationFeeWork3ValidatePinnedEnvelope(envelope, expected, label) {
  validateEnvelopeShape(envelope, TERMINATION_FEE_WORK3_CODES.AUTHORITY, label);
  if (!sameValue(envelope.binding, expected)) {
    fail(TERMINATION_FEE_WORK3_CODES.AUTHORITY, `${label} binding drift.`);
  }
  validateBoundRecord(envelope, TERMINATION_FEE_WORK3_CODES.AUTHORITY, label);
  const unsigned = clone(envelope.record);
  delete unsigned[expected.record_id_field];
  if (expected.record_id_field === 'inventory_disposition_id') {
    delete unsigned.session_receipt_id;
  }
  if (contentId(envelope.record.schema_version, unsigned) !== expected.record_id) {
    fail(TERMINATION_FEE_WORK3_CODES.AUTHORITY, `${label} self identity drift.`);
  }
  return deepFreeze(clone(envelope));
}

function terminationFeeWork3ValidateInput(input, outerKeys, evidenceKey, evidenceKeys) {
  exactKeysOrFail(
    input,
    outerKeys,
    TERMINATION_FEE_WORK3_CODES.CONTRACT,
    'Termination fee Work3 input',
  );
  const evidence = input[evidenceKey];
  exactKeysOrFail(
    evidence,
    evidenceKeys,
    TERMINATION_FEE_WORK3_CODES.CONTRACT,
    'Termination fee Work3 evidence bundle',
  );
  for (const key of evidenceKeys) {
    if (
      !isObject(evidence[key])
      || !isObject(evidence[key].binding)
      || !isObject(evidence[key].record)
    ) {
      fail(
        TERMINATION_FEE_WORK3_CODES.CONTRACT,
        `Termination fee Work3 ${key} envelope drift.`,
      );
    }
  }
  return evidence;
}

function terminationFeeWork3Phase4(input) {
  try {
    return prepareTerminationFeeFamilyProfilePackageReview(input);
  } catch (error) {
    fail(
      TERMINATION_FEE_WORK3_CODES.INVENTORY,
      'Termination fee Work3 Phase4 review derivation failed.',
      { cause_code: typeof error.code === 'string' ? error.code : null },
    );
  }
}

function validateTerminationFeeUnapprovedInventoryReviewEvidence(evidence) {
  if (
    !isObject(evidence)
    || evidence.profile_approval_state !== 'UNAPPROVED'
    || evidence.profile_count !== TERMINATION_FEE_PROFILE_COUNT
    || evidence.complete_profile_count !== TERMINATION_FEE_PROFILE_COUNT
    || evidence.incomplete_profile_count !== 0
    || !Array.isArray(evidence.proposed_profiles)
    || evidence.proposed_profiles.length !== TERMINATION_FEE_PROFILE_COUNT
    || !Array.isArray(evidence.retained_source_gaps)
    || evidence.retained_source_gaps.length !== 0
    || sortedUnique(evidence.proposed_profiles.map(
      (profile) => profile.proposed_profile_key,
    )).length !== TERMINATION_FEE_PROFILE_COUNT
  ) {
    fail(
      TERMINATION_FEE_WORK3_CODES.INVENTORY,
      'Termination fee unapproved inventory review evidence census drift.',
    );
  }
  return deepFreeze({
    schema_version:
      'M7_V2_TERMINATION_FEE_UNAPPROVED_INVENTORY_REVIEW_VALIDATOR_ACCEPTANCE/V1',
    status: 'PASS',
    profile_count: TERMINATION_FEE_PROFILE_COUNT,
    complete_profile_count: TERMINATION_FEE_PROFILE_COUNT,
    incomplete_profile_count: 0,
    retained_source_gap_count: 0,
  });
}

function prepareTerminationFeeWork3UnapprovedInventoryReview(input) {
  const evidence = terminationFeeWork3ValidateInput(
    input,
    [
      'terminationFeeWork3UnapprovedInventoryReviewEvidence',
      'terminationFeePhase4ReviewInput',
    ],
    'terminationFeeWork3UnapprovedInventoryReviewEvidence',
    ['work3TerminationFeeUnapprovedInventoryReviewAuthority'],
  );
  const authorityEnvelope = terminationFeeWork3ValidatePinnedEnvelope(
    evidence.work3TerminationFeeUnapprovedInventoryReviewAuthority,
    TERMINATION_FEE_WORK3_INVENTORY_AUTHORITY_BINDING,
    'Termination fee Work3 inventory authority',
  );
  const phase4 = terminationFeeWork3Phase4(input.terminationFeePhase4ReviewInput);
  const validator = validateTerminationFeeUnapprovedInventoryReviewEvidence({
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
      profile_count: TERMINATION_FEE_PROFILE_COUNT,
      complete_profile_count: TERMINATION_FEE_PROFILE_COUNT,
      incomplete_profile_count: 0,
      retained_source_gap_count: 0,
    },
    validator_acceptance_reference: clone(validator),
    review_accounting: clone(contract.review_accounting_exact_values),
    withheld_work3_fields: clone(TERMINATION_FEE_WORK3_WITHHELD_FIELDS),
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

function terminationFeeWork3ValidatePacket(envelope) {
  terminationFeeWork3ValidatePinnedEnvelope(
    envelope,
    TERMINATION_FEE_WORK3_PACKET_BINDING,
    'Termination fee inventory packet',
  );
  const record = envelope.record;
  if (
    record.profile_count !== TERMINATION_FEE_PROFILE_COUNT
    || record.complete_profile_count !== TERMINATION_FEE_PROFILE_COUNT
    || record.incomplete_profile_count !== 0
    || record.retained_source_gap_count !== 0
    || !Array.isArray(record.profile_review_items)
    || record.profile_review_items.length !== TERMINATION_FEE_PROFILE_COUNT
    || record.profile_review_items.filter((item) => item.review_flags.includes(
      'LEGAL_GROUPING_REVIEW_REQUIRED',
    )).length !== TERMINATION_FEE_PROFILE_COUNT
    || record.profile_review_items.filter((item) => item.review_flags.some(
      (flag) => TERMINATION_FEE_WORK3_HOLD_REVIEW_FLAGS.includes(flag),
    )).length !== TERMINATION_FEE_WORK3_HOLD_COUNT
  ) {
    fail(
      TERMINATION_FEE_WORK3_CODES.INVENTORY,
      'Termination fee inventory packet census drift.',
    );
  }
  return record;
}

function terminationFeeWork3ValidateDisposition(envelope) {
  terminationFeeWork3ValidatePinnedEnvelope(
    envelope,
    TERMINATION_FEE_WORK3_DISPOSITION_BINDING,
    'Termination fee Ben disposition',
  );
  const record = envelope.record;
  const rows = record.profile_dispositions;
  const summary = record.session_summary;
  if (
    record.reviewer !== 'BEN_GOODCHILD'
    || record.default_disposition_applied !== true
    || record.packet_digest !== TERMINATION_FEE_WORK3_PACKET_BINDING.sha256
    || record.ben_rulings_digest !== TERMINATION_FEE_WORK3_RULINGS_BINDING.sha256
    || !Array.isArray(rows)
    || rows.length !== TERMINATION_FEE_PROFILE_COUNT
    || rows.filter((row) => row.disposition === 'APPROVE').length
      !== TERMINATION_FEE_WORK3_APPROVE_COUNT
    || rows.filter((row) => row.disposition === 'HOLD').length
      !== TERMINATION_FEE_WORK3_HOLD_COUNT
    || summary.approved_count !== TERMINATION_FEE_WORK3_APPROVE_COUNT
    || summary.hold_count !== TERMINATION_FEE_WORK3_HOLD_COUNT
    || summary.reject_count !== 0
    || summary.legal_grouping_review_pending_count !== TERMINATION_FEE_PROFILE_COUNT
    || summary.taxonomy_expansion_acknowledged !== true
  ) {
    fail(
      TERMINATION_FEE_WORK3_CODES.DISPOSITION,
      'Termination fee Ben inventory disposition drift.',
    );
  }
  return record;
}

function prepareTerminationFeeWork3BenInventorySessionDisposition(input) {
  const evidenceKeys = [
    'work3TerminationFeeUnapprovedInventoryReviewAuthority',
    'work3TerminationFeeBenInventorySessionSuccessorAuthority',
    'inventoryReviewPacketDraft',
    'benAuthoredInventoryDisposition',
  ];
  const evidence = terminationFeeWork3ValidateInput(
    input,
    [
      'terminationFeeWork3BenInventorySessionDispositionEvidence',
      'terminationFeePhase4ReviewInput',
    ],
    'terminationFeeWork3BenInventorySessionDispositionEvidence',
    evidenceKeys,
  );
  const authorityEnvelope = terminationFeeWork3ValidatePinnedEnvelope(
    evidence.work3TerminationFeeBenInventorySessionSuccessorAuthority,
    TERMINATION_FEE_WORK3_BEN_AUTHORITY_BINDING,
    'Termination fee Ben inventory authority',
  );
  terminationFeeWork3ValidatePacket(evidence.inventoryReviewPacketDraft);
  const disposition = terminationFeeWork3ValidateDisposition(
    evidence.benAuthoredInventoryDisposition,
  );
  const inventory = prepareTerminationFeeWork3UnapprovedInventoryReview({
    terminationFeeWork3UnapprovedInventoryReviewEvidence: {
      work3TerminationFeeUnapprovedInventoryReviewAuthority:
        evidence.work3TerminationFeeUnapprovedInventoryReviewAuthority,
    },
    terminationFeePhase4ReviewInput: input.terminationFeePhase4ReviewInput,
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
      path: TERMINATION_FEE_WORK3_DISPOSITION_BINDING.path,
      inventory_disposition_id: disposition.inventory_disposition_id,
      packet_digest: disposition.packet_digest,
      profile_disposition_count: TERMINATION_FEE_PROFILE_COUNT,
      session_summary: clone(disposition.session_summary),
    },
    packet_binding: clone(TERMINATION_FEE_WORK3_PACKET_BINDING),
    ben_rulings_binding: clone(TERMINATION_FEE_WORK3_RULINGS_BINDING),
    session_receipt_reference: {
      schema_version: TERMINATION_FEE_WORK3_SESSION_BINDING.schema_version,
      ben_inventory_session_receipt_id: disposition.session_receipt_id,
      completion_state: 'COMPLETE',
    },
    review_accounting: clone(contract.review_accounting_exact_values),
    withheld_work3_fields: clone(TERMINATION_FEE_WORK3_WITHHELD_FIELDS),
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

function terminationFeeWork3ValidateSessionReceipt(envelope) {
  terminationFeeWork3ValidatePinnedEnvelope(
    envelope,
    TERMINATION_FEE_WORK3_SESSION_BINDING,
    'Termination fee Ben session receipt',
  );
  const record = envelope.record;
  if (
    record.completion_state !== 'COMPLETE'
    || record.disposition_binding.inventory_disposition_id
      !== TERMINATION_FEE_WORK3_DISPOSITION_BINDING.record_id
    || record.zero_effect_boundary.work3_identity_count !== 0
  ) {
    fail(
      TERMINATION_FEE_WORK3_CODES.RECEIPT,
      'Termination fee Ben session receipt drift.',
    );
  }
  return record;
}

function prepareTerminationFeeWork3FamilyPackageSeal(input) {
  const evidenceKeys = [
    'work3TerminationFeeUnapprovedInventoryReviewAuthority',
    'work3TerminationFeeBenInventorySessionSuccessorAuthority',
    'work3TerminationFeeFamilyPackageSealSuccessorAuthority',
    'inventoryReviewPacketDraft',
    'benAuthoredInventoryDisposition',
    'benInventorySessionReceipt',
  ];
  const evidence = terminationFeeWork3ValidateInput(
    input,
    [
      'terminationFeeWork3FamilyPackageSealEvidence',
      'terminationFeePhase4ReviewInput',
    ],
    'terminationFeeWork3FamilyPackageSealEvidence',
    evidenceKeys,
  );
  const authorityEnvelope = terminationFeeWork3ValidatePinnedEnvelope(
    evidence.work3TerminationFeeFamilyPackageSealSuccessorAuthority,
    TERMINATION_FEE_WORK3_SEAL_AUTHORITY_BINDING,
    'Termination fee family package seal authority',
  );
  const dispositionCandidate = prepareTerminationFeeWork3BenInventorySessionDisposition({
    terminationFeeWork3BenInventorySessionDispositionEvidence: {
      work3TerminationFeeUnapprovedInventoryReviewAuthority:
        evidence.work3TerminationFeeUnapprovedInventoryReviewAuthority,
      work3TerminationFeeBenInventorySessionSuccessorAuthority:
        evidence.work3TerminationFeeBenInventorySessionSuccessorAuthority,
      inventoryReviewPacketDraft: evidence.inventoryReviewPacketDraft,
      benAuthoredInventoryDisposition: evidence.benAuthoredInventoryDisposition,
    },
    terminationFeePhase4ReviewInput: input.terminationFeePhase4ReviewInput,
  });
  terminationFeeWork3ValidateSessionReceipt(evidence.benInventorySessionReceipt);
  if (
    dispositionCandidate.session_receipt_reference.ben_inventory_session_receipt_id
      !== evidence.benInventorySessionReceipt.record.ben_inventory_session_receipt_id
  ) {
    fail(
      TERMINATION_FEE_WORK3_CODES.RECEIPT,
      'Termination fee session receipt identity drift.',
    );
  }
  const contract = authorityEnvelope.record.schema_review_candidate_contract;
  const unsigned = {
    schema_version: contract.schema_version,
    candidate_state: contract.candidate_state,
    authority_binding: clone(authorityEnvelope.binding),
    inventory_session_disposition_reference: {
      inventory_disposition_id: TERMINATION_FEE_WORK3_DISPOSITION_BINDING.record_id,
      candidate_state: dispositionCandidate.candidate_state,
    },
    ben_rulings_binding: clone(TERMINATION_FEE_WORK3_RULINGS_BINDING),
    disposition_binding: clone(TERMINATION_FEE_WORK3_DISPOSITION_BINDING),
    session_receipt_binding: clone(TERMINATION_FEE_WORK3_SESSION_BINDING),
    subtype_partition_disposition_binding: {
      ...clone(TERMINATION_FEE_WORK3_RULINGS_BINDING),
      disposition_status: 'DEFERRED',
      legal_grouping_review_pending_count: TERMINATION_FEE_PROFILE_COUNT,
      subtype_partition_hold_count: TERMINATION_FEE_WORK3_HOLD_COUNT,
    },
    review_accounting: clone(contract.review_accounting_exact_values),
    withheld_work3_fields: clone(TERMINATION_FEE_WORK3_WITHHELD_FIELDS),
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

function terminationFeeWork3ValidateSealReceipt(envelope) {
  terminationFeeWork3ValidatePinnedEnvelope(
    envelope,
    TERMINATION_FEE_WORK3_SEAL_RECEIPT_BINDING,
    'Termination fee family seal receipt',
  );
  const record = envelope.record;
  if (
    record.completion_state !== 'COMPLETE'
    || record.reviewer !== 'BEN_GOODCHILD'
    || record.disposition_binding.record_id
      !== TERMINATION_FEE_WORK3_DISPOSITION_BINDING.record_id
    || record.subtype_partition_disposition_binding.disposition_status !== 'DEFERRED'
    || record.zero_effect_boundary.work3_identity_count !== 0
  ) {
    fail(
      TERMINATION_FEE_WORK3_CODES.RECEIPT,
      'Termination fee family seal receipt drift.',
    );
  }
  return record;
}

function prepareTerminationFeeWork3FamilyPackageRegistration(input) {
  const evidenceKeys = [
    'work3TerminationFeeUnapprovedInventoryReviewAuthority',
    'work3TerminationFeeBenInventorySessionSuccessorAuthority',
    'work3TerminationFeeFamilyPackageSealSuccessorAuthority',
    'work3TerminationFeeRegistrationSuccessorAuthority',
    'inventoryReviewPacketDraft',
    'benAuthoredInventoryDisposition',
    'benInventorySessionReceipt',
    'familyPackageSealReceipt',
  ];
  const evidence = terminationFeeWork3ValidateInput(
    input,
    [
      'terminationFeeWork3FamilyPackageRegistrationEvidence',
      'terminationFeePhase4ReviewInput',
    ],
    'terminationFeeWork3FamilyPackageRegistrationEvidence',
    evidenceKeys,
  );
  const authorityEnvelope = terminationFeeWork3ValidatePinnedEnvelope(
    evidence.work3TerminationFeeRegistrationSuccessorAuthority,
    TERMINATION_FEE_WORK3_REGISTRATION_AUTHORITY_BINDING,
    'Termination fee registration authority',
  );
  const sealCandidate = prepareTerminationFeeWork3FamilyPackageSeal({
    terminationFeeWork3FamilyPackageSealEvidence: {
      work3TerminationFeeUnapprovedInventoryReviewAuthority:
        evidence.work3TerminationFeeUnapprovedInventoryReviewAuthority,
      work3TerminationFeeBenInventorySessionSuccessorAuthority:
        evidence.work3TerminationFeeBenInventorySessionSuccessorAuthority,
      work3TerminationFeeFamilyPackageSealSuccessorAuthority:
        evidence.work3TerminationFeeFamilyPackageSealSuccessorAuthority,
      inventoryReviewPacketDraft: evidence.inventoryReviewPacketDraft,
      benAuthoredInventoryDisposition: evidence.benAuthoredInventoryDisposition,
      benInventorySessionReceipt: evidence.benInventorySessionReceipt,
    },
    terminationFeePhase4ReviewInput: input.terminationFeePhase4ReviewInput,
  });
  const sealReceipt = terminationFeeWork3ValidateSealReceipt(evidence.familyPackageSealReceipt);
  if (sealReceipt.family_package_seal_id !== sealCandidate.family_package_seal_id) {
    fail(
      TERMINATION_FEE_WORK3_CODES.RECEIPT,
      'Termination fee family seal candidate and receipt identity drift.',
    );
  }
  const phase4 = terminationFeeWork3Phase4(input.terminationFeePhase4ReviewInput);
  const dispositionByKey = new Map(
    evidence.benAuthoredInventoryDisposition.record.profile_dispositions.map(
      (row) => [row.proposed_profile_key, row],
    ),
  );
  const registeredProfiles = phase4.proposed_profiles.map((profile) => {
    const disposition = dispositionByKey.get(profile.proposed_profile_key);
    if (!disposition) {
      fail(
        TERMINATION_FEE_WORK3_CODES.OUTPUT,
        'Termination fee registration disposition missing.',
      );
    }
    const identityInput = {
      family_key: 'TERMINATION_FEE',
      proposed_profile_key: profile.proposed_profile_key,
      phase3_profile_key: null,
      profile_set_version: 1,
    };
    return {
      profile_id: contentId(
        'M7_V2_TERMINATION_FEE_WORK3_REGISTERED_PROFILE_IDENTITY/V1',
        identityInput,
      ),
      proposed_profile_key: profile.proposed_profile_key,
      phase3_profile_key: null,
      inventory_disposition: disposition.disposition,
      subtype_partition_hold: disposition.disposition === 'HOLD',
      legal_grouping_pending_acknowledged: disposition.legal_grouping_pending_acknowledged,
    };
  });
  const packageUnsigned = {
    family_key: 'TERMINATION_FEE',
    profile_set_version: 1,
    package_state: 'BEN_SEALED_IN_MEMORY_REGISTRATION_ONLY',
    profile_id_count: TERMINATION_FEE_PROFILE_COUNT,
    profile_ids: registeredProfiles.map((profile) => profile.profile_id),
    inventory_disposition_id: TERMINATION_FEE_WORK3_DISPOSITION_BINDING.record_id,
    family_package_seal_receipt_id: TERMINATION_FEE_WORK3_SEAL_RECEIPT_BINDING.record_id,
    subtype_partition_disposition_state: 'DEFERRED',
  };
  const packageIdentity = {
    family_profile_package_id: contentId(
      'M7_V2_TERMINATION_FEE_WORK3_FAMILY_PROFILE_PACKAGE_IDENTITY/V1',
      packageUnsigned,
    ),
    family_key: packageUnsigned.family_key,
    profile_set_version: 1,
    package_state: packageUnsigned.package_state,
    profile_id_count: TERMINATION_FEE_PROFILE_COUNT,
    inventory_disposition_id: packageUnsigned.inventory_disposition_id,
    family_package_seal_receipt_id: packageUnsigned.family_package_seal_receipt_id,
    subtype_partition_disposition_state: 'DEFERRED',
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
    family_package_seal_receipt_binding: clone(TERMINATION_FEE_WORK3_SEAL_RECEIPT_BINDING),
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
      state: 'STOP_AFTER_TERMINATION_FEE_FAMILY_PACKAGE_REGISTRATION_BEFORE_ACTIVATION',
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
    result.registered_profile_identities.length !== TERMINATION_FEE_PROFILE_COUNT
    || result.review_accounting.profile_identity_count !== TERMINATION_FEE_PROFILE_COUNT
    || result.review_accounting.work3_identity_count !== TERMINATION_FEE_PROFILE_COUNT + 1
    || result.registered_profile_identities.filter(
      (profile) => profile.inventory_disposition === 'HOLD',
    ).length !== TERMINATION_FEE_WORK3_HOLD_COUNT
    || result.zero_effect_boundary.activation_count !== 0
    || terminationFeeContainsForbiddenKey(result, new Set(['activation_id']))
  ) {
    fail(
      TERMINATION_FEE_WORK3_CODES.OUTPUT,
      'Termination fee family registration boundary drift.',
    );
  }
  return result;
}

module.exports = {
  TERMINATION_FEE_PHASE2_AUTHORITY_BYTES,
  TERMINATION_FEE_PHASE2_AUTHORITY_ID,
  TERMINATION_FEE_PHASE2_AUTHORITY_PATH,
  TERMINATION_FEE_PHASE2_AUTHORITY_SCHEMA,
  TERMINATION_FEE_PHASE2_AUTHORITY_SHA256,
  TERMINATION_FEE_PHASE2_PROPOSAL_CODES,
  TERMINATION_FEE_PHASE2_PROPOSAL_KEYS,
  TERMINATION_FEE_PHASE4_AUTHORITY_BYTES,
  TERMINATION_FEE_PHASE4_AUTHORITY_ID,
  TERMINATION_FEE_PHASE4_AUTHORITY_PATH,
  TERMINATION_FEE_PHASE4_AUTHORITY_SCHEMA,
  TERMINATION_FEE_PHASE4_AUTHORITY_SHA256,
  TERMINATION_FEE_PHASE4_CANDIDATE_SCHEMA,
  TERMINATION_FEE_PHASE4_REVIEW_CODES,
  TERMINATION_FEE_PHASE4_REVIEW_INPUT_KEYS,
  TERMINATION_FEE_PHASE4_REVIEW_OUTPUT_KEYS,
  TERMINATION_FEE_PHASE4_SCHEDULE_SHA256,
  TERMINATION_FEE_PROFILE_COUNT,
  TERMINATION_FEE_WORK3_APPROVE_COUNT,
  TERMINATION_FEE_WORK3_HOLD_COUNT,
  TERMINATION_FEE_WORK3_HOLD_REVIEW_FLAGS,
  prepareTerminationFeeFamilyProfilePackageReview,
  prepareTerminationFeePhase2FamilyProposal,
  prepareTerminationFeeWork3BenInventorySessionDisposition,
  prepareTerminationFeeWork3FamilyPackageRegistration,
  prepareTerminationFeeWork3FamilyPackageSeal,
  prepareTerminationFeeWork3UnapprovedInventoryReview,
  terminationFeeProposalPartition,
  validateTerminationFeeUnapprovedInventoryReviewEvidence,
};
