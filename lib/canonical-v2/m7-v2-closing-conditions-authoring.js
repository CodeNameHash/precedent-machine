'use strict';

/**
 * CLOSING_CONDITIONS Work3 Milestone A authoring, family-local.
 *
 * Self-contained (no `m7-v2-profile-authoring` spine dependency) so the family
 * slice can land while the shared spine merge is in flight. Covers Phase 2
 * partition, Phase 4 package review, and the Work3 inventory -> Ben disposition
 * -> family package seal -> registration ladder. Phase 3 reference
 * materialisation is deliberately absent: no comparator terminal proves an
 * unresolved M3 reference edge for this family.
 */

const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');

const CLOSING_CONDITIONS_PHASE2_AUTHORITY_SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_CONTRACT_CLOSING_CONDITIONS_AUTHORING_PHASE2_AUTHORITY/V2';
const CLOSING_CONDITIONS_PHASE2_AUTHORITY_ID =
  '7c891fb19c4084ecb572cc209ceb02a7d8b4d856ceb5f3096d2c8bfa5f68dfe6';
const CLOSING_CONDITIONS_PHASE2_AUTHORITY_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-closing-conditions-authoring-phase2-authority-v2.json';
const CLOSING_CONDITIONS_PHASE2_AUTHORITY_BYTES = 126452;
const CLOSING_CONDITIONS_PHASE2_AUTHORITY_SHA256 =
  '2672bcf63c318d51d248855ec792dcb199aae3c1dff3a490c52279f3b6cd5909';

const CLOSING_CONDITIONS_PROFILE_COUNT = 57;

const CLOSING_CONDITIONS_PHASE2_PROPOSAL_CODES = Object.freeze({
  AUTHORITY: 'M7_V2_CLOSING_CONDITIONS_PHASE2_AUTHORITY',
  CONTRACT: 'M7_V2_CLOSING_CONDITIONS_PHASE2_PROPOSAL_CONTRACT',
  COVERAGE: 'M7_V2_CLOSING_CONDITIONS_PHASE2_SOURCE_COVERAGE',
});

const CLOSING_CONDITIONS_PHASE2_PROPOSAL_KEYS = Object.freeze([
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

const CLOSING_CONDITIONS_PHASE2_UNRESOLVED_ITEMS = Object.freeze([
  'CLOSING_CONDITIONS_Q01_Q02_Q03_OPEN_REQUIRES_BEN_RULING',
  'EXACT_PROFILE_INVENTORY_REQUIRES_SEPARATE_APPROVAL',
  'LEGAL_GROUPING_REVIEW_REQUIRED',
  'M5_SUBTYPE_BUCKET_PARTITION_UNRESOLVED',
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

function validateClosingConditionsProposalAuthority(envelope) {
  const code = CLOSING_CONDITIONS_PHASE2_PROPOSAL_CODES.AUTHORITY;
  validateEnvelopeShape(envelope, code, 'Phase2 authority');
  validateBoundRecord(envelope, code, 'Phase2 authority');
  const { binding, record } = envelope;
  if (
    binding.byte_length !== CLOSING_CONDITIONS_PHASE2_AUTHORITY_BYTES
    || binding.path !== CLOSING_CONDITIONS_PHASE2_AUTHORITY_PATH
    || binding.record_id !== CLOSING_CONDITIONS_PHASE2_AUTHORITY_ID
    || binding.record_id_field !== 'closing_conditions_authoring_phase2_authority_id'
    || binding.schema_version !== CLOSING_CONDITIONS_PHASE2_AUTHORITY_SCHEMA
    || binding.sha256 !== CLOSING_CONDITIONS_PHASE2_AUTHORITY_SHA256
  ) {
    fail(code, 'Phase2 authority binding drift.');
  }
  if (
    record.schema_version !== CLOSING_CONDITIONS_PHASE2_AUTHORITY_SCHEMA
    || record.closing_conditions_authoring_phase2_authority_id
      !== CLOSING_CONDITIONS_PHASE2_AUTHORITY_ID
  ) {
    fail(code, 'Phase2 authority identity drift.');
  }
  const unsigned = { ...record };
  delete unsigned.closing_conditions_authoring_phase2_authority_id;
  if (contentId(record.schema_version, unsigned) !== CLOSING_CONDITIONS_PHASE2_AUTHORITY_ID) {
    fail(code, 'Phase2 authority self identity drift.');
  }
  return deepFreeze(clone(envelope));
}

function closingConditionsAgreementSources(authority, agreementEvidenceByAgreementId) {
  const code = CLOSING_CONDITIONS_PHASE2_PROPOSAL_CODES.COVERAGE;
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

function validateClosingConditionsProposalGovernedSources(authority, governedSources) {
  const code = CLOSING_CONDITIONS_PHASE2_PROPOSAL_CODES.COVERAGE;
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
  return closingConditionsAgreementSources(
    authority,
    governedSources.agreementEvidenceByAgreementId,
  );
}

function validateClosingConditionsProposalSourceCoverage(authority, agreements) {
  const code = CLOSING_CONDITIONS_PHASE2_PROPOSAL_CODES.COVERAGE;
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
      || claim.family !== 'CLOSING_CONDITIONS'
      || claim.claim_definition_key !== member.claim_definition_key
    ) {
      fail(code, `M4 claim proof mismatch for ${terminal.source_unit_key}.`);
    }
    const expectedSourceUnitKey = contentId('CLOSING_CONDITIONS_TERMINAL_SOURCE_UNIT/V1', {
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

function closingConditionsProposalCoverageRecords(authority, coverage) {
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

function closingConditionsProposalPartition(coverage) {
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

function closingConditionsProposalInventoryDigest(coverage, proposedPartition) {
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

function prepareClosingConditionsPhase2FamilyProposal(input) {
  const contractCode = CLOSING_CONDITIONS_PHASE2_PROPOSAL_CODES.CONTRACT;
  exactKeysOrFail(
    input,
    ['closingConditionsAuthoringPhase2Authority', 'governedSources'],
    contractCode,
    'Closing conditions proposal input',
  );
  const authorityEnvelope = validateClosingConditionsProposalAuthority(
    input.closingConditionsAuthoringPhase2Authority,
  );
  const authority = authorityEnvelope.record;
  const agreements = validateClosingConditionsProposalGovernedSources(
    authority,
    input.governedSources,
  );
  const coverage = validateClosingConditionsProposalSourceCoverage(authority, agreements);
  const accounting = closingConditionsProposalCoverageRecords(authority, coverage);
  const proposedPartition = closingConditionsProposalPartition(coverage);
  const authorityBinding = {
    path: authorityEnvelope.binding.path,
    schema_version: authorityEnvelope.binding.schema_version,
    record_id_field: authorityEnvelope.binding.record_id_field,
    record_id: authorityEnvelope.binding.record_id,
    byte_length: authorityEnvelope.binding.byte_length,
    sha256: authorityEnvelope.binding.sha256,
  };
  const unsignedProposal = {
    schema_version: 'M7_V2_CLOSING_CONDITIONS_FAMILY_PROPOSAL/V1',
    family_key: 'CLOSING_CONDITIONS',
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
    inventory_digest: closingConditionsProposalInventoryDigest(coverage, proposedPartition),
    unresolved_items: [...CLOSING_CONDITIONS_PHASE2_UNRESOLVED_ITEMS],
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

const CLOSING_CONDITIONS_PHASE4_AUTHORITY_SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_CONTRACT_CLOSING_CONDITIONS_AUTHORING_PHASE4_FAMILY_PROFILE_PACKAGE_REVIEW_AUTHORITY/V1';
const CLOSING_CONDITIONS_PHASE4_AUTHORITY_ID =
  '8407e438c73f9e7a75421818437487174a2f34586c682a89f4df1f36aac74137';
const CLOSING_CONDITIONS_PHASE4_AUTHORITY_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-closing-conditions-authoring-phase4-family-profile-package-review-authority.json';
const CLOSING_CONDITIONS_PHASE4_AUTHORITY_BYTES = 60569;
const CLOSING_CONDITIONS_PHASE4_AUTHORITY_SHA256 =
  '5551fc9fed9f705ed9be3501567faa422b3f5a42a3e8a147293407e31faaf9fa';
const CLOSING_CONDITIONS_PHASE4_SCHEDULE_SHA256 =
  '6cf2739ba194296eecbbd0a9b7d1fca4156356f3065038bb936a6c0dd65bc7fb';
const CLOSING_CONDITIONS_PHASE4_CANDIDATE_SCHEMA =
  'M7_V2_CLOSING_CONDITIONS_PHASE4_FAMILY_PROFILE_PACKAGE_REVIEW_CANDIDATE/V1';
const CLOSING_CONDITIONS_PHASE4_CANDIDATE_STATE =
  'REVIEW_ONLY_57_PROFILES_UNAPPROVED_AWAITING_BEN_INVENTORY';

const CLOSING_CONDITIONS_PHASE4_REVIEW_CODES = Object.freeze({
  CONTRACT: 'M7_V2_CLOSING_CONDITIONS_PHASE4_REVIEW_CONTRACT',
  AUTHORITY: 'M7_V2_CLOSING_CONDITIONS_PHASE4_REVIEW_AUTHORITY',
  PHASE2_PROPOSAL: 'M7_V2_CLOSING_CONDITIONS_PHASE4_PHASE2_PROPOSAL',
  PROFILE_SCHEDULE: 'M7_V2_CLOSING_CONDITIONS_PHASE4_PROFILE_SCHEDULE',
  REVIEW_OUTPUT: 'M7_V2_CLOSING_CONDITIONS_PHASE4_REVIEW_OUTPUT',
});

const CLOSING_CONDITIONS_PHASE4_REVIEW_INPUT_KEYS = Object.freeze([
  'closingConditionsAuthoringPhase4FamilyProfilePackageReviewAuthority',
  'closingConditionsAuthoringPhase2Authority',
  'governedSources',
]);

const CLOSING_CONDITIONS_PHASE4_REVIEW_OUTPUT_KEYS = Object.freeze([
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

const CLOSING_CONDITIONS_PHASE4_AUTHORITY_ROOT_KEYS = Object.freeze([
  'authority_classification',
  'authority_state',
  'candidate_output_contract',
  'closing_conditions_authoring_phase4_family_profile_package_review_authority_id',
  'design_basis',
  'execution_schedule',
  'first_legal_stop_contract',
  'forbidden_output_contract',
  'immutable_parent_bindings',
  'implementation_contract',
  'profile_review_schedule',
  'profile_review_schedule_contract',
  'schema_version',
  'zero_effect_boundary',
]);

function closingConditionsPhase4ExpectedParentBindings() {
  return {
    closing_conditions_authoring_phase2_authority: {
      byte_length: CLOSING_CONDITIONS_PHASE2_AUTHORITY_BYTES,
      path: CLOSING_CONDITIONS_PHASE2_AUTHORITY_PATH,
      record_id: CLOSING_CONDITIONS_PHASE2_AUTHORITY_ID,
      record_id_field: 'closing_conditions_authoring_phase2_authority_id',
      schema_version: CLOSING_CONDITIONS_PHASE2_AUTHORITY_SCHEMA,
      sha256: CLOSING_CONDITIONS_PHASE2_AUTHORITY_SHA256,
    },
  };
}

function closingConditionsContainsForbiddenKey(value, forbiddenKeys, seen = new Set()) {
  if (!value || typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) {
    return value.some((member) => closingConditionsContainsForbiddenKey(
      member,
      forbiddenKeys,
      seen,
    ));
  }
  for (const [key, member] of Object.entries(value)) {
    if (forbiddenKeys.has(key)) return true;
    if (closingConditionsContainsForbiddenKey(member, forbiddenKeys, seen)) return true;
  }
  return false;
}

function validateClosingConditionsPhase4FamilyProfilePackageReviewAuthority(envelope) {
  const code = CLOSING_CONDITIONS_PHASE4_REVIEW_CODES.AUTHORITY;
  validateEnvelopeShape(envelope, code, 'Phase4 family profile package review authority');
  const { binding, record } = envelope;
  if (
    binding.byte_length !== CLOSING_CONDITIONS_PHASE4_AUTHORITY_BYTES
    || binding.path !== CLOSING_CONDITIONS_PHASE4_AUTHORITY_PATH
    || binding.record_id !== CLOSING_CONDITIONS_PHASE4_AUTHORITY_ID
    || binding.record_id_field
      !== 'closing_conditions_authoring_phase4_family_profile_package_review_authority_id'
    || binding.schema_version !== CLOSING_CONDITIONS_PHASE4_AUTHORITY_SCHEMA
    || binding.sha256 !== CLOSING_CONDITIONS_PHASE4_AUTHORITY_SHA256
  ) {
    fail(code, 'Phase4 family profile package review authority binding drift.');
  }
  validateBoundRecord(envelope, code, 'Phase4 family profile package review authority');
  if (
    !exactKeys(record, CLOSING_CONDITIONS_PHASE4_AUTHORITY_ROOT_KEYS)
    || record.schema_version !== CLOSING_CONDITIONS_PHASE4_AUTHORITY_SCHEMA
    || record.closing_conditions_authoring_phase4_family_profile_package_review_authority_id
      !== CLOSING_CONDITIONS_PHASE4_AUTHORITY_ID
  ) {
    fail(code, 'Phase4 family profile package review authority identity drift.');
  }
  const unsigned = { ...record };
  delete unsigned
    .closing_conditions_authoring_phase4_family_profile_package_review_authority_id;
  if (
    contentId(record.schema_version, unsigned) !== CLOSING_CONDITIONS_PHASE4_AUTHORITY_ID
  ) {
    fail(code, 'Phase4 family profile package review authority self identity drift.');
  }

  const implementation = record.implementation_contract;
  const output = record.candidate_output_contract;
  const scheduleContract = record.profile_review_schedule_contract;
  const schedule = record.profile_review_schedule;
  const expectedErrorCodes = Object.values(CLOSING_CONDITIONS_PHASE4_REVIEW_CODES);
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
      closingConditionsPhase4ExpectedParentBindings(),
    )
    || !sameValue(
      implementation.exact_outer_input_keys,
      CLOSING_CONDITIONS_PHASE4_REVIEW_INPUT_KEYS,
    )
    || implementation.exported_function
      !== 'prepareClosingConditionsFamilyProfilePackageReview'
    || implementation.phase2_internal_function
      !== 'prepareClosingConditionsPhase2FamilyProposal'
    || implementation.phase3_internal_function !== null
    || implementation.caller_produced_candidate_input_forbidden !== true
    || !Array.isArray(implementation.error_precedence)
    || implementation.error_precedence.length !== expectedErrorCodes.length
    || implementation.error_precedence.some((entry, index) => (
      entry.order !== index + 1 || entry.code !== expectedErrorCodes[index]
    ))
    || output.schema_version !== CLOSING_CONDITIONS_PHASE4_CANDIDATE_SCHEMA
    || output.record_id_field !== 'review_candidate_id'
    || output.candidate_state !== CLOSING_CONDITIONS_PHASE4_CANDIDATE_STATE
    || output.profile_approval_state !== 'UNAPPROVED'
    || !sameValue(output.exact_keys, CLOSING_CONDITIONS_PHASE4_REVIEW_OUTPUT_KEYS)
    || schedule.length !== CLOSING_CONDITIONS_PROFILE_COUNT
    || scheduleContract.exact_profile_count !== CLOSING_CONDITIONS_PROFILE_COUNT
    || scheduleContract.exact_complete_profile_count !== CLOSING_CONDITIONS_PROFILE_COUNT
    || scheduleContract.exact_incomplete_profile_count !== 0
    || scheduleContract.schedule_canonical_json_sha256
      !== CLOSING_CONDITIONS_PHASE4_SCHEDULE_SHA256
    || sha256Hex(scheduleBytes) !== CLOSING_CONDITIONS_PHASE4_SCHEDULE_SHA256
    || scheduleContract.schedule_canonical_json_byte_length !== scheduleBytes.length
  ) {
    fail(code, 'Phase4 family profile package review authority contract drift.');
  }
  return deepFreeze(clone(envelope));
}

function closingConditionsPhase4ValidatePhase2Proposal(proposal) {
  const code = CLOSING_CONDITIONS_PHASE4_REVIEW_CODES.PHASE2_PROPOSAL;
  if (
    !isObject(proposal)
    || proposal.schema_version !== 'M7_V2_CLOSING_CONDITIONS_FAMILY_PROPOSAL/V1'
    || proposal.family_key !== 'CLOSING_CONDITIONS'
    || proposal.profile_approval_state !== 'UNAPPROVED'
    || proposal.source_terminal_coverage.accounted_count !== CLOSING_CONDITIONS_PROFILE_COUNT
    || proposal.m4_claim_accounting.accounted_count !== CLOSING_CONDITIONS_PROFILE_COUNT
    || proposal.derived_profile_count !== CLOSING_CONDITIONS_PROFILE_COUNT
    || !Array.isArray(proposal.proposed_partition.proposed_profiles)
    || proposal.proposed_partition.proposed_profiles.length !== CLOSING_CONDITIONS_PROFILE_COUNT
    || proposal.proposed_partition.source_unit_assignment_count
      !== CLOSING_CONDITIONS_PROFILE_COUNT
    || proposal.proposed_partition.m4_claim_assignment_count !== CLOSING_CONDITIONS_PROFILE_COUNT
  ) {
    fail(code, 'Phase4 fresh Phase2 proposal drift.');
  }
  const unsigned = { ...proposal };
  delete unsigned.proposal_id;
  if (contentId(proposal.schema_version, unsigned) !== proposal.proposal_id) {
    fail(code, 'Phase4 fresh Phase2 proposal identity drift.');
  }
}

function closingConditionsPhase4DeriveProfiles(authority, phase2Proposal) {
  const scheduleCode = CLOSING_CONDITIONS_PHASE4_REVIEW_CODES.PROFILE_SCHEDULE;
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
          'CLOSING_CONDITIONS',
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

function prepareClosingConditionsFamilyProfilePackageReview(input) {
  const contractCode = CLOSING_CONDITIONS_PHASE4_REVIEW_CODES.CONTRACT;
  exactKeysOrFail(
    input,
    CLOSING_CONDITIONS_PHASE4_REVIEW_INPUT_KEYS,
    contractCode,
    'Closing conditions Phase4 package review input',
  );
  const authorityEnvelope =
    validateClosingConditionsPhase4FamilyProfilePackageReviewAuthority(
      input.closingConditionsAuthoringPhase4FamilyProfilePackageReviewAuthority,
    );
  const authority = authorityEnvelope.record;
  const phase2AuthorityEnvelope = validateClosingConditionsProposalAuthority(
    input.closingConditionsAuthoringPhase2Authority,
  );
  if (
    phase2AuthorityEnvelope.binding.record_id
      !== authority.immutable_parent_bindings
        .closing_conditions_authoring_phase2_authority.record_id
  ) {
    fail(
      CLOSING_CONDITIONS_PHASE4_REVIEW_CODES.AUTHORITY,
      'Phase4 parent Phase2 authority pin drift.',
    );
  }
  validateClosingConditionsProposalGovernedSources(
    phase2AuthorityEnvelope.record,
    input.governedSources,
  );

  let phase2Proposal;
  try {
    phase2Proposal = prepareClosingConditionsPhase2FamilyProposal({
      closingConditionsAuthoringPhase2Authority:
        input.closingConditionsAuthoringPhase2Authority,
      governedSources: input.governedSources,
    });
  } catch (error) {
    fail(
      CLOSING_CONDITIONS_PHASE4_REVIEW_CODES.PHASE2_PROPOSAL,
      'Phase4 fresh Phase2 proposal failed.',
      { cause_code: typeof error.code === 'string' ? error.code : null },
    );
  }
  closingConditionsPhase4ValidatePhase2Proposal(phase2Proposal);
  const proposedProfiles = closingConditionsPhase4DeriveProfiles(authority, phase2Proposal);
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
    schema_version: CLOSING_CONDITIONS_PHASE4_CANDIDATE_SCHEMA,
    family_key: 'CLOSING_CONDITIONS',
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
    !exactKeys(candidate, CLOSING_CONDITIONS_PHASE4_REVIEW_OUTPUT_KEYS)
    || proposedProfiles.length !== CLOSING_CONDITIONS_PROFILE_COUNT
    || proposedProfiles.some((profile) => (
      !exactKeys(profile, outputContract.profile_exact_keys)
      || !exactKeys(
        profile.proposed_validation,
        outputContract.proposed_validation_exact_keys,
      )
    ))
    || !sameValue(candidate.review_accounting, outputContract.review_accounting_exact_values)
    || !sameValue(candidate.unresolved_items, outputContract.unresolved_items)
    || !sameValue(candidate.withheld_work3_fields, outputContract.withheld_work3_fields)
    || !sameValue(candidate.first_legal_stop, authority.first_legal_stop_contract)
    || !sameValue(candidate.zero_effect_boundary, authority.zero_effect_boundary)
    || closingConditionsContainsForbiddenKey(candidate, forbiddenKeys)
  ) {
    fail(
      CLOSING_CONDITIONS_PHASE4_REVIEW_CODES.REVIEW_OUTPUT,
      'Phase4 package review output boundary drift.',
    );
  }
  return deepFreeze(clone(candidate));
}

const CLOSING_CONDITIONS_WORK3_CONTROL_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control';
const CLOSING_CONDITIONS_WORK3_APPROVE_COUNT = 41;
const CLOSING_CONDITIONS_WORK3_HOLD_COUNT = 16;

/**
 * A row carrying either flag is an honest hold: the comparator bucket has no
 * sealed M5 subtype label, or the sealed Metsera frustration branch key needs an
 * explicit legal disposition. Neither is a defect in the extracted source.
 */
const CLOSING_CONDITIONS_WORK3_HOLD_REVIEW_FLAGS = Object.freeze([
  'M5_SUBTYPE_BUCKET_PARTITION_UNRESOLVED',
  'METSERA_FRUSTRATION_BRANCH_DISPOSITION_REQUIRED',
]);

const CLOSING_CONDITIONS_WORK3_RULINGS_BINDING = Object.freeze({
  byte_length: 5023,
  path: 'docs/codex-program/notes/CLOSING-CONDITIONS-BEN-RULINGS-Q01-Q03-2026-08-24.md',
  sha256: 'd245a19637fa08088c012ca950cd1d2d822c60320b710278c7a9c6edeeb1a8f3',
});
const CLOSING_CONDITIONS_WORK3_INVENTORY_AUTHORITY_BINDING = Object.freeze({
  byte_length: 2026,
  path: `${CLOSING_CONDITIONS_WORK3_CONTROL_PATH}/m7-v2-repair-contract-work3-closing-conditions-unapproved-inventory-review-authority.json`,
  record_id: '8f18ec232b2963e4790538029af3058301078229a31436022d0f420b33650b9a',
  record_id_field: 'work3_closing_conditions_unapproved_inventory_review_authority_id',
  schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_CLOSING_CONDITIONS_UNAPPROVED_INVENTORY_REVIEW_AUTHORITY/V1',
  sha256: 'edc9d7dfc5a3621cc85651d511beaca779c20e5dabba7da6a102e3a5513a2b1f',
});
const CLOSING_CONDITIONS_WORK3_PACKET_BINDING = Object.freeze({
  byte_length: 60503,
  path: `${CLOSING_CONDITIONS_WORK3_CONTROL_PATH}/m7-v2-repair-closing-conditions-57-profile-inventory-review-packet-draft.json`,
  record_id: '7f776cd1701803469d253a15d8c9654699394ae46afbe7a30b24c17108a59570',
  record_id_field: 'inventory_review_packet_id',
  schema_version: 'STAGE_2Y_M7_V2_CLOSING_CONDITIONS_57_PROFILE_INVENTORY_REVIEW_PACKET/V1',
  sha256: '9369ae687af3b5188d63d8ed6d47e02edd3b8c9063a2b05c65341371ff2881cf',
});
const CLOSING_CONDITIONS_WORK3_DISPOSITION_BINDING = Object.freeze({
  byte_length: 17826,
  path: `${CLOSING_CONDITIONS_WORK3_CONTROL_PATH}/m7-v2-repair-closing-conditions-57-profile-inventory-disposition.json`,
  record_id: 'b715428f1317f070f6503c58adb5e5e9b79f0f94dce24caf2e6c835298eec1a8',
  record_id_field: 'inventory_disposition_id',
  schema_version: 'STAGE_2Y_M7_V2_CLOSING_CONDITIONS_57_PROFILE_INVENTORY_DISPOSITION/V1',
  sha256: '054c83aa5fda2ac59d836ba0dc67c24747b7570e1ba36a5727e0fd87d1992fad',
});
const CLOSING_CONDITIONS_WORK3_SESSION_BINDING = Object.freeze({
  byte_length: 1138,
  path: `${CLOSING_CONDITIONS_WORK3_CONTROL_PATH}/m7-v2-repair-closing-conditions-ben-inventory-session-receipt.json`,
  record_id: '1e4d745793602dc5b6db048bb5e61f621be2133bd8523b9570d987bfe6671fa5',
  record_id_field: 'ben_inventory_session_receipt_id',
  schema_version: 'STAGE_2Y_M7_V2_CLOSING_CONDITIONS_BEN_INVENTORY_SESSION_RECEIPT/V1',
  sha256: 'aaabeb52801f944538ee546b27750603af4f1dee424674ab4946709e53132f58',
});
const CLOSING_CONDITIONS_WORK3_BEN_AUTHORITY_BINDING = Object.freeze({
  byte_length: 2805,
  path: `${CLOSING_CONDITIONS_WORK3_CONTROL_PATH}/m7-v2-repair-contract-work3-closing-conditions-ben-inventory-session-successor-authority.json`,
  record_id: 'ca354e360aa4fc8596902bf9fe3ba138248ffb90bae9ee784427eb09e887c008',
  record_id_field: 'work3_closing_conditions_ben_inventory_session_successor_authority_id',
  schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_CLOSING_CONDITIONS_BEN_INVENTORY_SESSION_SUCCESSOR_AUTHORITY/V1',
  sha256: '9efaedceed5fa3da813ab599102ee340733731af0685acb37f9ac4c810292d98',
});
const CLOSING_CONDITIONS_WORK3_SEAL_AUTHORITY_BINDING = Object.freeze({
  byte_length: 3366,
  path: `${CLOSING_CONDITIONS_WORK3_CONTROL_PATH}/m7-v2-repair-contract-work3-closing-conditions-family-package-seal-successor-authority.json`,
  record_id: '9c7bb2dab9255a82ca09723404ba388c2a80c5050443cb4e041740c72c1d9d65',
  record_id_field: 'work3_closing_conditions_family_package_seal_successor_authority_id',
  schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_CLOSING_CONDITIONS_FAMILY_PACKAGE_SEAL_SUCCESSOR_AUTHORITY/V1',
  sha256: 'c43eefe28cdd8b2a0437bad82ef47c2a2414c88b6c5b7aad60691b5451cf16e3',
});
const CLOSING_CONDITIONS_WORK3_SEAL_RECEIPT_BINDING = Object.freeze({
  byte_length: 2169,
  path: `${CLOSING_CONDITIONS_WORK3_CONTROL_PATH}/m7-v2-repair-closing-conditions-family-package-seal-receipt.json`,
  record_id: '0c9f7d42ad65097a0915b4312de8f219bad67b581536c217e0bfbfef375370e5',
  record_id_field: 'closing_conditions_family_package_seal_receipt_id',
  schema_version: 'STAGE_2Y_M7_V2_CLOSING_CONDITIONS_FAMILY_PACKAGE_SEAL_RECEIPT/V1',
  sha256: '964290f90ac54add6e1c94885f1d06b3a5e7bdd0332507612c1e9ac3b77bdbdc',
});
const CLOSING_CONDITIONS_WORK3_REGISTRATION_AUTHORITY_BINDING = Object.freeze({
  byte_length: 2942,
  path: `${CLOSING_CONDITIONS_WORK3_CONTROL_PATH}/m7-v2-repair-contract-work3-closing-conditions-registration-successor-authority.json`,
  record_id: 'f982e8f13f8fb70d7f7f4b0ab038c74053e9c2eeded8ab7710e10296d6c4127a',
  record_id_field: 'work3_closing_conditions_registration_successor_authority_id',
  schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_CLOSING_CONDITIONS_REGISTRATION_SUCCESSOR_AUTHORITY/V1',
  sha256: '54218aa53c07c9b8d7c913f54e7fb768c0e8cf32060ec38a3bc8a39740202264',
});

const CLOSING_CONDITIONS_WORK3_CODES = Object.freeze({
  CONTRACT: 'M7_V2_CLOSING_CONDITIONS_WORK3_CONTRACT',
  AUTHORITY: 'M7_V2_CLOSING_CONDITIONS_WORK3_AUTHORITY',
  INVENTORY: 'M7_V2_CLOSING_CONDITIONS_WORK3_INVENTORY',
  DISPOSITION: 'M7_V2_CLOSING_CONDITIONS_WORK3_DISPOSITION',
  RECEIPT: 'M7_V2_CLOSING_CONDITIONS_WORK3_RECEIPT',
  OUTPUT: 'M7_V2_CLOSING_CONDITIONS_WORK3_OUTPUT',
});
const CLOSING_CONDITIONS_WORK3_WITHHELD_FIELDS = Object.freeze([
  'activation_id',
  'family_profile_package_id',
  'profile_id',
  'registration_id',
]);

function closingConditionsWork3ValidatePinnedEnvelope(envelope, expected, label) {
  validateEnvelopeShape(envelope, CLOSING_CONDITIONS_WORK3_CODES.AUTHORITY, label);
  if (!sameValue(envelope.binding, expected)) {
    fail(CLOSING_CONDITIONS_WORK3_CODES.AUTHORITY, `${label} binding drift.`);
  }
  validateBoundRecord(envelope, CLOSING_CONDITIONS_WORK3_CODES.AUTHORITY, label);
  const unsigned = clone(envelope.record);
  delete unsigned[expected.record_id_field];
  if (expected.record_id_field === 'inventory_disposition_id') {
    delete unsigned.session_receipt_id;
  }
  if (contentId(envelope.record.schema_version, unsigned) !== expected.record_id) {
    fail(CLOSING_CONDITIONS_WORK3_CODES.AUTHORITY, `${label} self identity drift.`);
  }
  return deepFreeze(clone(envelope));
}

function closingConditionsWork3ValidateInput(input, outerKeys, evidenceKey, evidenceKeys) {
  exactKeysOrFail(
    input,
    outerKeys,
    CLOSING_CONDITIONS_WORK3_CODES.CONTRACT,
    'Closing conditions Work3 input',
  );
  const evidence = input[evidenceKey];
  exactKeysOrFail(
    evidence,
    evidenceKeys,
    CLOSING_CONDITIONS_WORK3_CODES.CONTRACT,
    'Closing conditions Work3 evidence bundle',
  );
  for (const key of evidenceKeys) {
    if (
      !isObject(evidence[key])
      || !isObject(evidence[key].binding)
      || !isObject(evidence[key].record)
    ) {
      fail(
        CLOSING_CONDITIONS_WORK3_CODES.CONTRACT,
        `Closing conditions Work3 ${key} envelope drift.`,
      );
    }
  }
  return evidence;
}

function closingConditionsWork3Phase4(input) {
  try {
    return prepareClosingConditionsFamilyProfilePackageReview(input);
  } catch (error) {
    fail(
      CLOSING_CONDITIONS_WORK3_CODES.INVENTORY,
      'Closing conditions Work3 Phase4 review derivation failed.',
      { cause_code: typeof error.code === 'string' ? error.code : null },
    );
  }
}

function validateClosingConditionsUnapprovedInventoryReviewEvidence(evidence) {
  if (
    !isObject(evidence)
    || evidence.profile_approval_state !== 'UNAPPROVED'
    || evidence.profile_count !== CLOSING_CONDITIONS_PROFILE_COUNT
    || evidence.complete_profile_count !== CLOSING_CONDITIONS_PROFILE_COUNT
    || evidence.incomplete_profile_count !== 0
    || !Array.isArray(evidence.proposed_profiles)
    || evidence.proposed_profiles.length !== CLOSING_CONDITIONS_PROFILE_COUNT
    || !Array.isArray(evidence.retained_source_gaps)
    || evidence.retained_source_gaps.length !== 0
    || sortedUnique(evidence.proposed_profiles.map(
      (profile) => profile.proposed_profile_key,
    )).length !== CLOSING_CONDITIONS_PROFILE_COUNT
  ) {
    fail(
      CLOSING_CONDITIONS_WORK3_CODES.INVENTORY,
      'Closing conditions unapproved inventory review evidence census drift.',
    );
  }
  return deepFreeze({
    schema_version:
      'M7_V2_CLOSING_CONDITIONS_UNAPPROVED_INVENTORY_REVIEW_VALIDATOR_ACCEPTANCE/V1',
    status: 'PASS',
    profile_count: CLOSING_CONDITIONS_PROFILE_COUNT,
    complete_profile_count: CLOSING_CONDITIONS_PROFILE_COUNT,
    incomplete_profile_count: 0,
    retained_source_gap_count: 0,
  });
}

function prepareClosingConditionsWork3UnapprovedInventoryReview(input) {
  const evidence = closingConditionsWork3ValidateInput(
    input,
    [
      'closingConditionsWork3UnapprovedInventoryReviewEvidence',
      'closingConditionsPhase4ReviewInput',
    ],
    'closingConditionsWork3UnapprovedInventoryReviewEvidence',
    ['work3ClosingConditionsUnapprovedInventoryReviewAuthority'],
  );
  const authorityEnvelope = closingConditionsWork3ValidatePinnedEnvelope(
    evidence.work3ClosingConditionsUnapprovedInventoryReviewAuthority,
    CLOSING_CONDITIONS_WORK3_INVENTORY_AUTHORITY_BINDING,
    'Closing conditions Work3 inventory authority',
  );
  const phase4 = closingConditionsWork3Phase4(input.closingConditionsPhase4ReviewInput);
  const validator = validateClosingConditionsUnapprovedInventoryReviewEvidence({
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
      profile_count: CLOSING_CONDITIONS_PROFILE_COUNT,
      complete_profile_count: CLOSING_CONDITIONS_PROFILE_COUNT,
      incomplete_profile_count: 0,
      retained_source_gap_count: 0,
    },
    validator_acceptance_reference: clone(validator),
    review_accounting: clone(contract.review_accounting_exact_values),
    withheld_work3_fields: clone(CLOSING_CONDITIONS_WORK3_WITHHELD_FIELDS),
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

function closingConditionsWork3ValidatePacket(envelope) {
  closingConditionsWork3ValidatePinnedEnvelope(
    envelope,
    CLOSING_CONDITIONS_WORK3_PACKET_BINDING,
    'Closing conditions inventory packet',
  );
  const record = envelope.record;
  if (
    record.profile_count !== CLOSING_CONDITIONS_PROFILE_COUNT
    || record.complete_profile_count !== CLOSING_CONDITIONS_PROFILE_COUNT
    || record.incomplete_profile_count !== 0
    || record.retained_source_gap_count !== 0
    || !Array.isArray(record.profile_review_items)
    || record.profile_review_items.length !== CLOSING_CONDITIONS_PROFILE_COUNT
    || record.profile_review_items.filter((item) => item.review_flags.includes(
      'LEGAL_GROUPING_REVIEW_REQUIRED',
    )).length !== CLOSING_CONDITIONS_PROFILE_COUNT
    || record.profile_review_items.filter((item) => item.review_flags.some(
      (flag) => CLOSING_CONDITIONS_WORK3_HOLD_REVIEW_FLAGS.includes(flag),
    )).length !== CLOSING_CONDITIONS_WORK3_HOLD_COUNT
  ) {
    fail(
      CLOSING_CONDITIONS_WORK3_CODES.INVENTORY,
      'Closing conditions inventory packet census drift.',
    );
  }
  return record;
}

function closingConditionsWork3ValidateDisposition(envelope) {
  closingConditionsWork3ValidatePinnedEnvelope(
    envelope,
    CLOSING_CONDITIONS_WORK3_DISPOSITION_BINDING,
    'Closing conditions Ben disposition',
  );
  const record = envelope.record;
  const rows = record.profile_dispositions;
  const summary = record.session_summary;
  if (
    record.reviewer !== 'BEN_GOODCHILD'
    || record.default_disposition_applied !== true
    || record.packet_digest !== CLOSING_CONDITIONS_WORK3_PACKET_BINDING.sha256
    || record.ben_rulings_digest !== CLOSING_CONDITIONS_WORK3_RULINGS_BINDING.sha256
    || !Array.isArray(rows)
    || rows.length !== CLOSING_CONDITIONS_PROFILE_COUNT
    || rows.filter((row) => row.disposition === 'APPROVE').length
      !== CLOSING_CONDITIONS_WORK3_APPROVE_COUNT
    || rows.filter((row) => row.disposition === 'HOLD').length
      !== CLOSING_CONDITIONS_WORK3_HOLD_COUNT
    || summary.approved_count !== CLOSING_CONDITIONS_WORK3_APPROVE_COUNT
    || summary.hold_count !== CLOSING_CONDITIONS_WORK3_HOLD_COUNT
    || summary.reject_count !== 0
    || summary.legal_grouping_review_pending_count !== CLOSING_CONDITIONS_PROFILE_COUNT
    || summary.taxonomy_expansion_acknowledged !== true
  ) {
    fail(
      CLOSING_CONDITIONS_WORK3_CODES.DISPOSITION,
      'Closing conditions Ben inventory disposition drift.',
    );
  }
  return record;
}

function prepareClosingConditionsWork3BenInventorySessionDisposition(input) {
  const evidenceKeys = [
    'work3ClosingConditionsUnapprovedInventoryReviewAuthority',
    'work3ClosingConditionsBenInventorySessionSuccessorAuthority',
    'inventoryReviewPacketDraft',
    'benAuthoredInventoryDisposition',
  ];
  const evidence = closingConditionsWork3ValidateInput(
    input,
    [
      'closingConditionsWork3BenInventorySessionDispositionEvidence',
      'closingConditionsPhase4ReviewInput',
    ],
    'closingConditionsWork3BenInventorySessionDispositionEvidence',
    evidenceKeys,
  );
  const authorityEnvelope = closingConditionsWork3ValidatePinnedEnvelope(
    evidence.work3ClosingConditionsBenInventorySessionSuccessorAuthority,
    CLOSING_CONDITIONS_WORK3_BEN_AUTHORITY_BINDING,
    'Closing conditions Ben inventory authority',
  );
  closingConditionsWork3ValidatePacket(evidence.inventoryReviewPacketDraft);
  const disposition = closingConditionsWork3ValidateDisposition(
    evidence.benAuthoredInventoryDisposition,
  );
  const inventory = prepareClosingConditionsWork3UnapprovedInventoryReview({
    closingConditionsWork3UnapprovedInventoryReviewEvidence: {
      work3ClosingConditionsUnapprovedInventoryReviewAuthority:
        evidence.work3ClosingConditionsUnapprovedInventoryReviewAuthority,
    },
    closingConditionsPhase4ReviewInput: input.closingConditionsPhase4ReviewInput,
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
      path: CLOSING_CONDITIONS_WORK3_DISPOSITION_BINDING.path,
      inventory_disposition_id: disposition.inventory_disposition_id,
      packet_digest: disposition.packet_digest,
      profile_disposition_count: CLOSING_CONDITIONS_PROFILE_COUNT,
      session_summary: clone(disposition.session_summary),
    },
    packet_binding: clone(CLOSING_CONDITIONS_WORK3_PACKET_BINDING),
    ben_rulings_binding: clone(CLOSING_CONDITIONS_WORK3_RULINGS_BINDING),
    session_receipt_reference: {
      schema_version: CLOSING_CONDITIONS_WORK3_SESSION_BINDING.schema_version,
      ben_inventory_session_receipt_id: disposition.session_receipt_id,
      completion_state: 'COMPLETE',
    },
    review_accounting: clone(contract.review_accounting_exact_values),
    withheld_work3_fields: clone(CLOSING_CONDITIONS_WORK3_WITHHELD_FIELDS),
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

function closingConditionsWork3ValidateSessionReceipt(envelope) {
  closingConditionsWork3ValidatePinnedEnvelope(
    envelope,
    CLOSING_CONDITIONS_WORK3_SESSION_BINDING,
    'Closing conditions Ben session receipt',
  );
  const record = envelope.record;
  if (
    record.completion_state !== 'COMPLETE'
    || record.disposition_binding.inventory_disposition_id
      !== CLOSING_CONDITIONS_WORK3_DISPOSITION_BINDING.record_id
    || record.zero_effect_boundary.work3_identity_count !== 0
  ) {
    fail(
      CLOSING_CONDITIONS_WORK3_CODES.RECEIPT,
      'Closing conditions Ben session receipt drift.',
    );
  }
  return record;
}

function prepareClosingConditionsWork3FamilyPackageSeal(input) {
  const evidenceKeys = [
    'work3ClosingConditionsUnapprovedInventoryReviewAuthority',
    'work3ClosingConditionsBenInventorySessionSuccessorAuthority',
    'work3ClosingConditionsFamilyPackageSealSuccessorAuthority',
    'inventoryReviewPacketDraft',
    'benAuthoredInventoryDisposition',
    'benInventorySessionReceipt',
  ];
  const evidence = closingConditionsWork3ValidateInput(
    input,
    [
      'closingConditionsWork3FamilyPackageSealEvidence',
      'closingConditionsPhase4ReviewInput',
    ],
    'closingConditionsWork3FamilyPackageSealEvidence',
    evidenceKeys,
  );
  const authorityEnvelope = closingConditionsWork3ValidatePinnedEnvelope(
    evidence.work3ClosingConditionsFamilyPackageSealSuccessorAuthority,
    CLOSING_CONDITIONS_WORK3_SEAL_AUTHORITY_BINDING,
    'Closing conditions family package seal authority',
  );
  const dispositionCandidate = prepareClosingConditionsWork3BenInventorySessionDisposition({
    closingConditionsWork3BenInventorySessionDispositionEvidence: {
      work3ClosingConditionsUnapprovedInventoryReviewAuthority:
        evidence.work3ClosingConditionsUnapprovedInventoryReviewAuthority,
      work3ClosingConditionsBenInventorySessionSuccessorAuthority:
        evidence.work3ClosingConditionsBenInventorySessionSuccessorAuthority,
      inventoryReviewPacketDraft: evidence.inventoryReviewPacketDraft,
      benAuthoredInventoryDisposition: evidence.benAuthoredInventoryDisposition,
    },
    closingConditionsPhase4ReviewInput: input.closingConditionsPhase4ReviewInput,
  });
  closingConditionsWork3ValidateSessionReceipt(evidence.benInventorySessionReceipt);
  if (
    dispositionCandidate.session_receipt_reference.ben_inventory_session_receipt_id
      !== evidence.benInventorySessionReceipt.record.ben_inventory_session_receipt_id
  ) {
    fail(
      CLOSING_CONDITIONS_WORK3_CODES.RECEIPT,
      'Closing conditions session receipt identity drift.',
    );
  }
  const contract = authorityEnvelope.record.schema_review_candidate_contract;
  const unsigned = {
    schema_version: contract.schema_version,
    candidate_state: contract.candidate_state,
    authority_binding: clone(authorityEnvelope.binding),
    inventory_session_disposition_reference: {
      inventory_disposition_id: CLOSING_CONDITIONS_WORK3_DISPOSITION_BINDING.record_id,
      candidate_state: dispositionCandidate.candidate_state,
    },
    ben_rulings_binding: clone(CLOSING_CONDITIONS_WORK3_RULINGS_BINDING),
    disposition_binding: clone(CLOSING_CONDITIONS_WORK3_DISPOSITION_BINDING),
    session_receipt_binding: clone(CLOSING_CONDITIONS_WORK3_SESSION_BINDING),
    subtype_partition_disposition_binding: {
      ...clone(CLOSING_CONDITIONS_WORK3_RULINGS_BINDING),
      disposition_status: 'DEFERRED',
      legal_grouping_review_pending_count: CLOSING_CONDITIONS_PROFILE_COUNT,
      subtype_partition_hold_count: CLOSING_CONDITIONS_WORK3_HOLD_COUNT,
    },
    review_accounting: clone(contract.review_accounting_exact_values),
    withheld_work3_fields: clone(CLOSING_CONDITIONS_WORK3_WITHHELD_FIELDS),
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

function closingConditionsWork3ValidateSealReceipt(envelope) {
  closingConditionsWork3ValidatePinnedEnvelope(
    envelope,
    CLOSING_CONDITIONS_WORK3_SEAL_RECEIPT_BINDING,
    'Closing conditions family seal receipt',
  );
  const record = envelope.record;
  if (
    record.completion_state !== 'COMPLETE'
    || record.reviewer !== 'BEN_GOODCHILD'
    || record.disposition_binding.record_id
      !== CLOSING_CONDITIONS_WORK3_DISPOSITION_BINDING.record_id
    || record.subtype_partition_disposition_binding.disposition_status !== 'DEFERRED'
    || record.zero_effect_boundary.work3_identity_count !== 0
  ) {
    fail(
      CLOSING_CONDITIONS_WORK3_CODES.RECEIPT,
      'Closing conditions family seal receipt drift.',
    );
  }
  return record;
}

function prepareClosingConditionsWork3FamilyPackageRegistration(input) {
  const evidenceKeys = [
    'work3ClosingConditionsUnapprovedInventoryReviewAuthority',
    'work3ClosingConditionsBenInventorySessionSuccessorAuthority',
    'work3ClosingConditionsFamilyPackageSealSuccessorAuthority',
    'work3ClosingConditionsRegistrationSuccessorAuthority',
    'inventoryReviewPacketDraft',
    'benAuthoredInventoryDisposition',
    'benInventorySessionReceipt',
    'familyPackageSealReceipt',
  ];
  const evidence = closingConditionsWork3ValidateInput(
    input,
    [
      'closingConditionsWork3FamilyPackageRegistrationEvidence',
      'closingConditionsPhase4ReviewInput',
    ],
    'closingConditionsWork3FamilyPackageRegistrationEvidence',
    evidenceKeys,
  );
  const authorityEnvelope = closingConditionsWork3ValidatePinnedEnvelope(
    evidence.work3ClosingConditionsRegistrationSuccessorAuthority,
    CLOSING_CONDITIONS_WORK3_REGISTRATION_AUTHORITY_BINDING,
    'Closing conditions registration authority',
  );
  const sealCandidate = prepareClosingConditionsWork3FamilyPackageSeal({
    closingConditionsWork3FamilyPackageSealEvidence: {
      work3ClosingConditionsUnapprovedInventoryReviewAuthority:
        evidence.work3ClosingConditionsUnapprovedInventoryReviewAuthority,
      work3ClosingConditionsBenInventorySessionSuccessorAuthority:
        evidence.work3ClosingConditionsBenInventorySessionSuccessorAuthority,
      work3ClosingConditionsFamilyPackageSealSuccessorAuthority:
        evidence.work3ClosingConditionsFamilyPackageSealSuccessorAuthority,
      inventoryReviewPacketDraft: evidence.inventoryReviewPacketDraft,
      benAuthoredInventoryDisposition: evidence.benAuthoredInventoryDisposition,
      benInventorySessionReceipt: evidence.benInventorySessionReceipt,
    },
    closingConditionsPhase4ReviewInput: input.closingConditionsPhase4ReviewInput,
  });
  const sealReceipt = closingConditionsWork3ValidateSealReceipt(
    evidence.familyPackageSealReceipt,
  );
  if (sealReceipt.family_package_seal_id !== sealCandidate.family_package_seal_id) {
    fail(
      CLOSING_CONDITIONS_WORK3_CODES.RECEIPT,
      'Closing conditions family seal candidate and receipt identity drift.',
    );
  }
  const phase4 = closingConditionsWork3Phase4(input.closingConditionsPhase4ReviewInput);
  const dispositionByKey = new Map(
    evidence.benAuthoredInventoryDisposition.record.profile_dispositions.map(
      (row) => [row.proposed_profile_key, row],
    ),
  );
  const registeredProfiles = phase4.proposed_profiles.map((profile) => {
    const disposition = dispositionByKey.get(profile.proposed_profile_key);
    if (!disposition) {
      fail(
        CLOSING_CONDITIONS_WORK3_CODES.OUTPUT,
        'Closing conditions registration disposition missing.',
      );
    }
    const identityInput = {
      family_key: 'CLOSING_CONDITIONS',
      proposed_profile_key: profile.proposed_profile_key,
      phase3_profile_key: null,
      profile_set_version: 1,
    };
    return {
      profile_id: contentId(
        'M7_V2_CLOSING_CONDITIONS_WORK3_REGISTERED_PROFILE_IDENTITY/V1',
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
    family_key: 'CLOSING_CONDITIONS',
    profile_set_version: 1,
    package_state: 'BEN_SEALED_IN_MEMORY_REGISTRATION_ONLY',
    profile_id_count: CLOSING_CONDITIONS_PROFILE_COUNT,
    profile_ids: registeredProfiles.map((profile) => profile.profile_id),
    inventory_disposition_id: CLOSING_CONDITIONS_WORK3_DISPOSITION_BINDING.record_id,
    family_package_seal_receipt_id: CLOSING_CONDITIONS_WORK3_SEAL_RECEIPT_BINDING.record_id,
    subtype_partition_disposition_state: 'DEFERRED',
  };
  const packageIdentity = {
    family_profile_package_id: contentId(
      'M7_V2_CLOSING_CONDITIONS_WORK3_FAMILY_PROFILE_PACKAGE_IDENTITY/V1',
      packageUnsigned,
    ),
    family_key: packageUnsigned.family_key,
    profile_set_version: 1,
    package_state: packageUnsigned.package_state,
    profile_id_count: CLOSING_CONDITIONS_PROFILE_COUNT,
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
    family_package_seal_receipt_binding: clone(CLOSING_CONDITIONS_WORK3_SEAL_RECEIPT_BINDING),
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
      state: 'STOP_AFTER_CLOSING_CONDITIONS_FAMILY_PACKAGE_REGISTRATION_BEFORE_ACTIVATION',
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
    result.registered_profile_identities.length !== CLOSING_CONDITIONS_PROFILE_COUNT
    || result.review_accounting.profile_identity_count !== CLOSING_CONDITIONS_PROFILE_COUNT
    || result.review_accounting.work3_identity_count !== CLOSING_CONDITIONS_PROFILE_COUNT + 1
    || result.registered_profile_identities.filter(
      (profile) => profile.inventory_disposition === 'HOLD',
    ).length !== CLOSING_CONDITIONS_WORK3_HOLD_COUNT
    || result.zero_effect_boundary.activation_count !== 0
    || closingConditionsContainsForbiddenKey(result, new Set(['activation_id']))
  ) {
    fail(
      CLOSING_CONDITIONS_WORK3_CODES.OUTPUT,
      'Closing conditions family registration boundary drift.',
    );
  }
  return result;
}

module.exports = {
  CLOSING_CONDITIONS_PHASE2_AUTHORITY_BYTES,
  CLOSING_CONDITIONS_PHASE2_AUTHORITY_ID,
  CLOSING_CONDITIONS_PHASE2_AUTHORITY_PATH,
  CLOSING_CONDITIONS_PHASE2_AUTHORITY_SCHEMA,
  CLOSING_CONDITIONS_PHASE2_AUTHORITY_SHA256,
  CLOSING_CONDITIONS_PHASE2_PROPOSAL_CODES,
  CLOSING_CONDITIONS_PHASE2_PROPOSAL_KEYS,
  CLOSING_CONDITIONS_PHASE4_AUTHORITY_BYTES,
  CLOSING_CONDITIONS_PHASE4_AUTHORITY_ID,
  CLOSING_CONDITIONS_PHASE4_AUTHORITY_PATH,
  CLOSING_CONDITIONS_PHASE4_AUTHORITY_SCHEMA,
  CLOSING_CONDITIONS_PHASE4_AUTHORITY_SHA256,
  CLOSING_CONDITIONS_PHASE4_CANDIDATE_SCHEMA,
  CLOSING_CONDITIONS_PHASE4_REVIEW_CODES,
  CLOSING_CONDITIONS_PHASE4_REVIEW_INPUT_KEYS,
  CLOSING_CONDITIONS_PHASE4_REVIEW_OUTPUT_KEYS,
  CLOSING_CONDITIONS_PHASE4_SCHEDULE_SHA256,
  CLOSING_CONDITIONS_PROFILE_COUNT,
  CLOSING_CONDITIONS_WORK3_APPROVE_COUNT,
  CLOSING_CONDITIONS_WORK3_HOLD_COUNT,
  CLOSING_CONDITIONS_WORK3_HOLD_REVIEW_FLAGS,
  closingConditionsProposalPartition,
  prepareClosingConditionsFamilyProfilePackageReview,
  prepareClosingConditionsPhase2FamilyProposal,
  prepareClosingConditionsWork3BenInventorySessionDisposition,
  prepareClosingConditionsWork3FamilyPackageRegistration,
  prepareClosingConditionsWork3FamilyPackageSeal,
  prepareClosingConditionsWork3UnapprovedInventoryReview,
  validateClosingConditionsUnapprovedInventoryReviewEvidence,
};
