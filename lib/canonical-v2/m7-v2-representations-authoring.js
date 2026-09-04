'use strict';

/**
 * Family-local M7 V2 repair authoring for REPRESENTATIONS (N1 family #6).
 *
 * Milestone A ladder, D&O-minimal path (Phase 3 reference chain skipped):
 *   Phase 2 partition -> Phase 4 package review -> Work3 inventory review ->
 *   Ben inventory session disposition -> family package seal -> registration.
 *
 * Deliberately self-contained: the shared spine (m7-v2-profile-authoring.js) is on a
 * separate merge track, so the helpers below are adapted copies rather than imports.
 *
 * The 70 profiles are claim-scale, one per governed comparator M4 claim across six
 * comparator deals. Subtype grouping across the six M5 candidate buckets is an open
 * legal question, so every profile carries LEGAL_GROUPING_REVIEW_REQUIRED and the
 * family seal records PENDING_LEGAL_REVIEW rather than a resolved taxonomy.
 */

const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');

const REPRESENTATIONS_PROFILE_COUNT = 70;
const REPRESENTATIONS_KNOWLEDGE_QUALIFIER_PROFILE_COUNT = 15;

const REPRESENTATIONS_PHASE2_AUTHORITY_SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_CONTRACT_REPRESENTATIONS_AUTHORING_PHASE2_AUTHORITY/V2';
const REPRESENTATIONS_PHASE2_AUTHORITY_ID =
  '6d5d519b5fadc1e2981f2f1c1d139659dc4c2e7b3808cacabd4b312d8b63438c';
const REPRESENTATIONS_PHASE2_AUTHORITY_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-representations-authoring-phase2-authority-v2.json';
const REPRESENTATIONS_PHASE2_AUTHORITY_BYTES = 165232;
const REPRESENTATIONS_PHASE2_AUTHORITY_SHA256 =
  '4f79dec0bdf9353b64c96f48196282023dc228d556f341d7438c67a3c04a6eb9';

const REPRESENTATIONS_PHASE2_PROPOSAL_CODES = Object.freeze({
  AUTHORITY: 'M7_V2_REPRESENTATIONS_PHASE2_AUTHORITY',
  CONTRACT: 'M7_V2_REPRESENTATIONS_PHASE2_PROPOSAL_CONTRACT',
  COVERAGE: 'M7_V2_REPRESENTATIONS_PHASE2_SOURCE_COVERAGE',
});

const REPRESENTATIONS_PHASE2_PROPOSAL_KEYS = Object.freeze([
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

function validateRepresentationsProposalAuthority(envelope) {
  const code = REPRESENTATIONS_PHASE2_PROPOSAL_CODES.AUTHORITY;
  validateEnvelopeShape(envelope, code, 'Phase2 authority');
  validateBoundRecord(envelope, code, 'Phase2 authority');
  const { binding, record } = envelope;
  if (
    binding.byte_length !== REPRESENTATIONS_PHASE2_AUTHORITY_BYTES
    || binding.path !== REPRESENTATIONS_PHASE2_AUTHORITY_PATH
    || binding.record_id !== REPRESENTATIONS_PHASE2_AUTHORITY_ID
    || binding.record_id_field !== 'representations_authoring_phase2_authority_id'
    || binding.schema_version !== REPRESENTATIONS_PHASE2_AUTHORITY_SCHEMA
    || binding.sha256 !== REPRESENTATIONS_PHASE2_AUTHORITY_SHA256
  ) {
    fail(code, 'Phase2 authority binding drift.');
  }
  if (
    record.schema_version !== REPRESENTATIONS_PHASE2_AUTHORITY_SCHEMA
    || record.representations_authoring_phase2_authority_id
      !== REPRESENTATIONS_PHASE2_AUTHORITY_ID
  ) {
    fail(code, 'Phase2 authority identity drift.');
  }
  const unsigned = { ...record };
  delete unsigned.representations_authoring_phase2_authority_id;
  if (contentId(record.schema_version, unsigned) !== REPRESENTATIONS_PHASE2_AUTHORITY_ID) {
    fail(code, 'Phase2 authority self identity drift.');
  }
  return deepFreeze(clone(envelope));
}

function representationsAgreementSources(authority, agreementEvidenceByAgreementId) {
  const code = REPRESENTATIONS_PHASE2_PROPOSAL_CODES.COVERAGE;
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

function validateRepresentationsProposalGovernedSources(authority, governedSources) {
  const code = REPRESENTATIONS_PHASE2_PROPOSAL_CODES.COVERAGE;
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
  return representationsAgreementSources(
    authority,
    governedSources.agreementEvidenceByAgreementId,
  );
}

function validateRepresentationsProposalSourceCoverage(authority, agreements) {
  const code = REPRESENTATIONS_PHASE2_PROPOSAL_CODES.COVERAGE;
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
      || claim.family !== 'REPRESENTATIONS'
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

function representationsProposalCoverageRecords(authority, coverage) {
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

function representationsProposalPartition(coverage) {
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

function representationsProposalInventoryDigest(coverage, proposedPartition) {
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

function prepareRepresentationsPhase2FamilyProposal(input) {
  const contractCode = REPRESENTATIONS_PHASE2_PROPOSAL_CODES.CONTRACT;
  exactKeysOrFail(
    input,
    ['representationsAuthoringPhase2Authority', 'governedSources'],
    contractCode,
    'Representations proposal input',
  );
  const authorityEnvelope = validateRepresentationsProposalAuthority(
    input.representationsAuthoringPhase2Authority,
  );
  const authority = authorityEnvelope.record;
  const agreements = validateRepresentationsProposalGovernedSources(
    authority,
    input.governedSources,
  );
  const coverage = validateRepresentationsProposalSourceCoverage(authority, agreements);
  const accounting = representationsProposalCoverageRecords(authority, coverage);
  const proposedPartition = representationsProposalPartition(coverage);
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
    'REPRESENTATIONS_Q01_Q02_Q03_OPEN_REQUIRES_BEN_RULING',
  ].sort(compareStrings);
  const unsignedProposal = {
    schema_version: 'M7_V2_REPRESENTATIONS_FAMILY_PROPOSAL/V1',
    family_key: 'REPRESENTATIONS',
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
    inventory_digest: representationsProposalInventoryDigest(coverage, proposedPartition),
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

const REPRESENTATIONS_PHASE4_AUTHORITY_SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_CONTRACT_REPRESENTATIONS_AUTHORING_PHASE4_FAMILY_PROFILE_PACKAGE_REVIEW_AUTHORITY/V1';
const REPRESENTATIONS_PHASE4_AUTHORITY_ID =
  'da65ea3a5f350d0943573246bd5b71fbb50bc3e8e4316a037713b597f1b4062c';
const REPRESENTATIONS_PHASE4_AUTHORITY_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-representations-authoring-phase4-family-profile-package-review-authority.json';
const REPRESENTATIONS_PHASE4_AUTHORITY_BYTES = 75724;
const REPRESENTATIONS_PHASE4_AUTHORITY_SHA256 =
  '4b6c66712a012edbcb212ab27718ad9f8bbcd967504266cf60dc3ff5c8de1aad';
const REPRESENTATIONS_PHASE4_SCHEDULE_SHA256 =
  '42fb638a3fdbc4819ccd9bacb2f6dda734c7b1252179b586baa2cf450f04dd32';
const REPRESENTATIONS_PHASE4_CANDIDATE_SCHEMA =
  'M7_V2_REPRESENTATIONS_PHASE4_FAMILY_PROFILE_PACKAGE_REVIEW_CANDIDATE/V1';
const REPRESENTATIONS_PHASE4_CANDIDATE_STATE =
  'REVIEW_ONLY_70_PROFILES_UNAPPROVED_AWAITING_BEN_INVENTORY';

const REPRESENTATIONS_PHASE4_REVIEW_CODES = Object.freeze({
  CONTRACT: 'M7_V2_REPRESENTATIONS_PHASE4_REVIEW_CONTRACT',
  AUTHORITY: 'M7_V2_REPRESENTATIONS_PHASE4_REVIEW_AUTHORITY',
  PHASE2_PROPOSAL: 'M7_V2_REPRESENTATIONS_PHASE4_PHASE2_PROPOSAL',
  PROFILE_SCHEDULE: 'M7_V2_REPRESENTATIONS_PHASE4_PROFILE_SCHEDULE',
  REVIEW_OUTPUT: 'M7_V2_REPRESENTATIONS_PHASE4_REVIEW_OUTPUT',
});

const REPRESENTATIONS_PHASE4_REVIEW_INPUT_KEYS = Object.freeze([
  'representationsAuthoringPhase4FamilyProfilePackageReviewAuthority',
  'representationsAuthoringPhase2Authority',
  'governedSources',
]);

const REPRESENTATIONS_PHASE4_REVIEW_OUTPUT_KEYS = Object.freeze([
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

const REPRESENTATIONS_PHASE4_AUTHORITY_ROOT_KEYS = Object.freeze([
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
  'representations_authoring_phase4_family_profile_package_review_authority_id',
  'schema_version',
  'zero_effect_boundary',
]);

function representationsPhase4ExpectedParentBindings() {
  return {
    representations_authoring_phase2_authority: {
      byte_length: REPRESENTATIONS_PHASE2_AUTHORITY_BYTES,
      path: REPRESENTATIONS_PHASE2_AUTHORITY_PATH,
      record_id: REPRESENTATIONS_PHASE2_AUTHORITY_ID,
      record_id_field: 'representations_authoring_phase2_authority_id',
      schema_version: REPRESENTATIONS_PHASE2_AUTHORITY_SCHEMA,
      sha256: REPRESENTATIONS_PHASE2_AUTHORITY_SHA256,
    },
  };
}

function representationsContainsForbiddenKey(value, forbiddenKeys, seen = new Set()) {
  if (!value || typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) {
    return value.some((member) => representationsContainsForbiddenKey(
      member,
      forbiddenKeys,
      seen,
    ));
  }
  for (const [key, member] of Object.entries(value)) {
    if (forbiddenKeys.has(key)) return true;
    if (representationsContainsForbiddenKey(member, forbiddenKeys, seen)) return true;
  }
  return false;
}

function validateRepresentationsPhase4FamilyProfilePackageReviewAuthority(envelope) {
  const code = REPRESENTATIONS_PHASE4_REVIEW_CODES.AUTHORITY;
  validateEnvelopeShape(envelope, code, 'Phase4 family profile package review authority');
  const { binding, record } = envelope;
  if (
    binding.byte_length !== REPRESENTATIONS_PHASE4_AUTHORITY_BYTES
    || binding.path !== REPRESENTATIONS_PHASE4_AUTHORITY_PATH
    || binding.record_id !== REPRESENTATIONS_PHASE4_AUTHORITY_ID
    || binding.record_id_field
      !== 'representations_authoring_phase4_family_profile_package_review_authority_id'
    || binding.schema_version !== REPRESENTATIONS_PHASE4_AUTHORITY_SCHEMA
    || binding.sha256 !== REPRESENTATIONS_PHASE4_AUTHORITY_SHA256
  ) {
    fail(code, 'Phase4 family profile package review authority binding drift.');
  }
  validateBoundRecord(
    envelope,
    code,
    'Phase4 family profile package review authority',
  );
  if (
    !exactKeys(record, REPRESENTATIONS_PHASE4_AUTHORITY_ROOT_KEYS)
    || record.schema_version !== REPRESENTATIONS_PHASE4_AUTHORITY_SCHEMA
    || record.representations_authoring_phase4_family_profile_package_review_authority_id
      !== REPRESENTATIONS_PHASE4_AUTHORITY_ID
  ) {
    fail(code, 'Phase4 family profile package review authority identity drift.');
  }
  const unsigned = { ...record };
  delete unsigned
    .representations_authoring_phase4_family_profile_package_review_authority_id;
  if (contentId(record.schema_version, unsigned) !== REPRESENTATIONS_PHASE4_AUTHORITY_ID) {
    fail(code, 'Phase4 family profile package review authority self identity drift.');
  }

  const implementation = record.implementation_contract;
  const output = record.candidate_output_contract;
  const scheduleContract = record.profile_review_schedule_contract;
  const schedule = record.profile_review_schedule;
  const expectedErrorCodes = Object.values(REPRESENTATIONS_PHASE4_REVIEW_CODES);
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
    || !sameValue(record.immutable_parent_bindings, representationsPhase4ExpectedParentBindings())
    || !sameValue(
      implementation.exact_outer_input_keys,
      REPRESENTATIONS_PHASE4_REVIEW_INPUT_KEYS,
    )
    || implementation.exported_function
      !== 'prepareRepresentationsFamilyProfilePackageReview'
    || implementation.phase2_internal_function
      !== 'prepareRepresentationsPhase2FamilyProposal'
    || implementation.phase3_internal_function !== null
    || implementation.caller_produced_candidate_input_forbidden !== true
    || !Array.isArray(implementation.error_precedence)
    || implementation.error_precedence.length !== expectedErrorCodes.length
    || implementation.error_precedence.some((entry, index) => (
      entry.order !== index + 1 || entry.code !== expectedErrorCodes[index]
    ))
    || output.schema_version !== REPRESENTATIONS_PHASE4_CANDIDATE_SCHEMA
    || output.record_id_field !== 'review_candidate_id'
    || output.candidate_state !== REPRESENTATIONS_PHASE4_CANDIDATE_STATE
    || output.profile_approval_state !== 'UNAPPROVED'
    || !sameValue(output.exact_keys, REPRESENTATIONS_PHASE4_REVIEW_OUTPUT_KEYS)
    || schedule.length !== REPRESENTATIONS_PROFILE_COUNT
    || scheduleContract.exact_profile_count !== REPRESENTATIONS_PROFILE_COUNT
    || scheduleContract.exact_complete_profile_count !== REPRESENTATIONS_PROFILE_COUNT
    || scheduleContract.exact_incomplete_profile_count !== 0
    || scheduleContract.schedule_canonical_json_sha256
      !== REPRESENTATIONS_PHASE4_SCHEDULE_SHA256
    || sha256Hex(scheduleBytes) !== REPRESENTATIONS_PHASE4_SCHEDULE_SHA256
    || scheduleContract.schedule_canonical_json_byte_length !== scheduleBytes.length
  ) {
    fail(code, 'Phase4 family profile package review authority contract drift.');
  }
  return deepFreeze(clone(envelope));
}

function representationsPhase4ValidatePhase2Proposal(proposal) {
  const code = REPRESENTATIONS_PHASE4_REVIEW_CODES.PHASE2_PROPOSAL;
  if (
    !isObject(proposal)
    || proposal.schema_version !== 'M7_V2_REPRESENTATIONS_FAMILY_PROPOSAL/V1'
    || proposal.family_key !== 'REPRESENTATIONS'
    || proposal.profile_approval_state !== 'UNAPPROVED'
    || proposal.source_terminal_coverage.accounted_count !== REPRESENTATIONS_PROFILE_COUNT
    || proposal.m4_claim_accounting.accounted_count !== REPRESENTATIONS_PROFILE_COUNT
    || proposal.derived_profile_count !== REPRESENTATIONS_PROFILE_COUNT
    || !Array.isArray(proposal.proposed_partition.proposed_profiles)
    || proposal.proposed_partition.proposed_profiles.length !== REPRESENTATIONS_PROFILE_COUNT
    || proposal.proposed_partition.source_unit_assignment_count !== REPRESENTATIONS_PROFILE_COUNT
    || proposal.proposed_partition.m4_claim_assignment_count !== REPRESENTATIONS_PROFILE_COUNT
  ) {
    fail(code, 'Phase4 fresh Phase2 proposal drift.');
  }
  const unsigned = { ...proposal };
  delete unsigned.proposal_id;
  if (contentId(proposal.schema_version, unsigned) !== proposal.proposal_id) {
    fail(code, 'Phase4 fresh Phase2 proposal identity drift.');
  }
}

function representationsPhase4DeriveProfiles(authority, phase2Proposal) {
  const scheduleCode = REPRESENTATIONS_PHASE4_REVIEW_CODES.PROFILE_SCHEDULE;
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
          'REPRESENTATIONS',
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

function prepareRepresentationsFamilyProfilePackageReview(input) {
  const contractCode = REPRESENTATIONS_PHASE4_REVIEW_CODES.CONTRACT;
  exactKeysOrFail(
    input,
    REPRESENTATIONS_PHASE4_REVIEW_INPUT_KEYS,
    contractCode,
    'Representations Phase4 package review input',
  );
  const authorityEnvelope =
    validateRepresentationsPhase4FamilyProfilePackageReviewAuthority(
      input.representationsAuthoringPhase4FamilyProfilePackageReviewAuthority,
    );
  const authority = authorityEnvelope.record;
  const phase2AuthorityEnvelope = validateRepresentationsProposalAuthority(
    input.representationsAuthoringPhase2Authority,
  );
  if (
    phase2AuthorityEnvelope.binding.record_id
      !== authority.immutable_parent_bindings
        .representations_authoring_phase2_authority.record_id
  ) {
    fail(
      REPRESENTATIONS_PHASE4_REVIEW_CODES.AUTHORITY,
      'Phase4 parent Phase2 authority pin drift.',
    );
  }
  validateRepresentationsProposalGovernedSources(
    phase2AuthorityEnvelope.record,
    input.governedSources,
  );

  let phase2Proposal;
  try {
    phase2Proposal = prepareRepresentationsPhase2FamilyProposal({
      representationsAuthoringPhase2Authority:
        input.representationsAuthoringPhase2Authority,
      governedSources: input.governedSources,
    });
  } catch (error) {
    fail(
      REPRESENTATIONS_PHASE4_REVIEW_CODES.PHASE2_PROPOSAL,
      'Phase4 fresh Phase2 proposal failed.',
      { cause_code: typeof error.code === 'string' ? error.code : null },
    );
  }
  representationsPhase4ValidatePhase2Proposal(phase2Proposal);
  const proposedProfiles = representationsPhase4DeriveProfiles(authority, phase2Proposal);
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
    schema_version: REPRESENTATIONS_PHASE4_CANDIDATE_SCHEMA,
    family_key: 'REPRESENTATIONS',
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
    !exactKeys(candidate, REPRESENTATIONS_PHASE4_REVIEW_OUTPUT_KEYS)
    || proposedProfiles.length !== REPRESENTATIONS_PROFILE_COUNT
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
    || representationsContainsForbiddenKey(candidate, forbiddenKeys)
  ) {
    fail(
      REPRESENTATIONS_PHASE4_REVIEW_CODES.REVIEW_OUTPUT,
      'Phase4 package review output boundary drift.',
    );
  }
  return deepFreeze(clone(candidate));
}

const REPRESENTATIONS_WORK3_CONTROL_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control';
const REPRESENTATIONS_WORK3_RULINGS_BINDING = Object.freeze({
  byte_length: 5549,
  path: 'docs/codex-program/notes/REPRESENTATIONS-BEN-RULINGS-Q01-Q03-2026-08-24.md',
  sha256: '707c7e2df981885d6e62a2ecace37cd3d5030ec08d9ed763032b651cf10b3ade',
});
const REPRESENTATIONS_WORK3_INVENTORY_AUTHORITY_BINDING = Object.freeze({
  byte_length: 1994,
  path: `${REPRESENTATIONS_WORK3_CONTROL_PATH}/m7-v2-repair-contract-work3-representations-unapproved-inventory-review-authority.json`,
  record_id: '54a21da8da87fceae46aff72c0d3d08e8d7aa7f9283b476c22e877d6141321fb',
  record_id_field: 'work3_representations_unapproved_inventory_review_authority_id',
  schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_REPRESENTATIONS_UNAPPROVED_INVENTORY_REVIEW_AUTHORITY/V1',
  sha256: 'b32fe50c9908eb4b75df232e9753f2933505cede1dc379abe98b09bacc17a594',
});
const REPRESENTATIONS_WORK3_PACKET_BINDING = Object.freeze({
  byte_length: 91350,
  path: `${REPRESENTATIONS_WORK3_CONTROL_PATH}/m7-v2-repair-representations-70-profile-inventory-review-packet-draft.json`,
  record_id: 'e0eedadf6b3944a4c4d9f63528eb16c7bac5ff827b9a5dc60ceae373f2c4355a',
  record_id_field: 'inventory_review_packet_id',
  schema_version: 'STAGE_2Y_M7_V2_REPRESENTATIONS_70_PROFILE_INVENTORY_REVIEW_PACKET/V1',
  sha256: '9eb1cf48d48558f66eaeb3e009a2566f94d6379b75f2308342aaafb164c77870',
});
const REPRESENTATIONS_WORK3_DISPOSITION_BINDING = Object.freeze({
  byte_length: 23190,
  path: `${REPRESENTATIONS_WORK3_CONTROL_PATH}/m7-v2-repair-representations-70-profile-inventory-disposition.json`,
  record_id: 'f45a5a0118d90cd10bbd4355dccfeb32eb31893313a0c461e71d6ee8ee712b65',
  record_id_field: 'inventory_disposition_id',
  schema_version: 'STAGE_2Y_M7_V2_REPRESENTATIONS_70_PROFILE_INVENTORY_DISPOSITION/V1',
  sha256: '347e2ef5fc339d5ce7932425a0a53335e2eb50b4e320f02f29bb04c5ea0ceaf2',
});
const REPRESENTATIONS_WORK3_SESSION_BINDING = Object.freeze({
  byte_length: 1126,
  path: `${REPRESENTATIONS_WORK3_CONTROL_PATH}/m7-v2-repair-representations-ben-inventory-session-receipt.json`,
  record_id: '8ca0e9c6c48f72368d698eb23db7c53d61688ba8bd35b7a2b93d5ccbad9382c8',
  record_id_field: 'ben_inventory_session_receipt_id',
  schema_version: 'STAGE_2Y_M7_V2_REPRESENTATIONS_BEN_INVENTORY_SESSION_RECEIPT/V1',
  sha256: 'c02180657c0aa90f8e7e64fb69f0cf571a053cc8d6accd8904dedf968321693f',
});
const REPRESENTATIONS_WORK3_BEN_AUTHORITY_BINDING = Object.freeze({
  byte_length: 2805,
  path: `${REPRESENTATIONS_WORK3_CONTROL_PATH}/m7-v2-repair-contract-work3-representations-ben-inventory-session-successor-authority.json`,
  record_id: '27e1082d45136c9bc6d7f78bc166f1498522d6f762439ca3325135eee371bd3b',
  record_id_field: 'work3_representations_ben_inventory_session_successor_authority_id',
  schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_REPRESENTATIONS_BEN_INVENTORY_SESSION_SUCCESSOR_AUTHORITY/V1',
  sha256: 'dd84a1d11a299c5d4c57877d57539bcaa8fa3d095c38b69415ff1b9e3be14a47',
});
const REPRESENTATIONS_WORK3_SEAL_AUTHORITY_BINDING = Object.freeze({
  byte_length: 3322,
  path: `${REPRESENTATIONS_WORK3_CONTROL_PATH}/m7-v2-repair-contract-work3-representations-family-package-seal-successor-authority.json`,
  record_id: '2e6e86f44a54a3460dfb98c5bedaad1faa5d75f825552ac218f3d14c8a6cf57b',
  record_id_field: 'work3_representations_family_package_seal_successor_authority_id',
  schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_REPRESENTATIONS_FAMILY_PACKAGE_SEAL_SUCCESSOR_AUTHORITY/V1',
  sha256: '059269aab18f95bd01e688bb43ea1bab4750815e8144074031aae24f2ab6afdb',
});
const REPRESENTATIONS_WORK3_SEAL_RECEIPT_BINDING = Object.freeze({
  byte_length: 2188,
  path: `${REPRESENTATIONS_WORK3_CONTROL_PATH}/m7-v2-repair-representations-family-package-seal-receipt.json`,
  record_id: '511852dda8b6f96120718d8ded052065cf09805c00a9b8dd023aa3f2e2afce69',
  record_id_field: 'representations_family_package_seal_receipt_id',
  schema_version: 'STAGE_2Y_M7_V2_REPRESENTATIONS_FAMILY_PACKAGE_SEAL_RECEIPT/V1',
  sha256: '345daeaf213bef76da990b5866ac963e5e97fa282105013833532b35742ce70f',
});
const REPRESENTATIONS_WORK3_REGISTRATION_AUTHORITY_BINDING = Object.freeze({
  byte_length: 2902,
  path: `${REPRESENTATIONS_WORK3_CONTROL_PATH}/m7-v2-repair-contract-work3-representations-registration-successor-authority.json`,
  record_id: '14dfe476c724396857247973f8880f353615b31e5133910722f07150e6416e9c',
  record_id_field: 'work3_representations_registration_successor_authority_id',
  schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_REPRESENTATIONS_REGISTRATION_SUCCESSOR_AUTHORITY/V1',
  sha256: 'd9c4695234b30535d6184cfa64e456209613c02ff695a76ffb2555c90cba21e9',
});

const REPRESENTATIONS_WORK3_CODES = Object.freeze({
  CONTRACT: 'M7_V2_REPRESENTATIONS_WORK3_CONTRACT',
  AUTHORITY: 'M7_V2_REPRESENTATIONS_WORK3_AUTHORITY',
  INVENTORY: 'M7_V2_REPRESENTATIONS_WORK3_INVENTORY',
  DISPOSITION: 'M7_V2_REPRESENTATIONS_WORK3_DISPOSITION',
  RECEIPT: 'M7_V2_REPRESENTATIONS_WORK3_RECEIPT',
  OUTPUT: 'M7_V2_REPRESENTATIONS_WORK3_OUTPUT',
});
const REPRESENTATIONS_WORK3_WITHHELD_FIELDS = Object.freeze([
  'activation_id',
  'family_profile_package_id',
  'profile_id',
  'registration_id',
]);

function representationsWork3ValidatePinnedEnvelope(envelope, expected, label) {
  validateEnvelopeShape(envelope, REPRESENTATIONS_WORK3_CODES.AUTHORITY, label);
  if (!sameValue(envelope.binding, expected)) {
    fail(REPRESENTATIONS_WORK3_CODES.AUTHORITY, `${label} binding drift.`);
  }
  validateBoundRecord(envelope, REPRESENTATIONS_WORK3_CODES.AUTHORITY, label);
  const unsigned = clone(envelope.record);
  delete unsigned[expected.record_id_field];
  if (expected.record_id_field === 'inventory_disposition_id') {
    delete unsigned.session_receipt_id;
  }
  if (contentId(envelope.record.schema_version, unsigned) !== expected.record_id) {
    fail(REPRESENTATIONS_WORK3_CODES.AUTHORITY, `${label} self identity drift.`);
  }
  return deepFreeze(clone(envelope));
}

function representationsWork3ValidateInput(input, outerKeys, evidenceKey, evidenceKeys) {
  exactKeysOrFail(input, outerKeys, REPRESENTATIONS_WORK3_CODES.CONTRACT, 'Representations Work3 input');
  const evidence = input[evidenceKey];
  exactKeysOrFail(
    evidence,
    evidenceKeys,
    REPRESENTATIONS_WORK3_CODES.CONTRACT,
    'Representations Work3 evidence bundle',
  );
  for (const key of evidenceKeys) {
    if (
      !isObject(evidence[key])
      || !isObject(evidence[key].binding)
      || !isObject(evidence[key].record)
    ) {
      fail(REPRESENTATIONS_WORK3_CODES.CONTRACT, `Representations Work3 ${key} envelope drift.`);
    }
  }
  return evidence;
}

function representationsWork3Phase4(input) {
  try {
    return prepareRepresentationsFamilyProfilePackageReview(input);
  } catch (error) {
    fail(REPRESENTATIONS_WORK3_CODES.INVENTORY, 'Representations Work3 Phase4 review derivation failed.', {
      cause_code: typeof error.code === 'string' ? error.code : null,
    });
  }
}

function validateRepresentationsUnapprovedInventoryReviewEvidence(evidence) {
  if (
    !isObject(evidence)
    || evidence.profile_approval_state !== 'UNAPPROVED'
    || evidence.profile_count !== REPRESENTATIONS_PROFILE_COUNT
    || evidence.complete_profile_count !== REPRESENTATIONS_PROFILE_COUNT
    || evidence.incomplete_profile_count !== 0
    || !Array.isArray(evidence.proposed_profiles)
    || evidence.proposed_profiles.length !== REPRESENTATIONS_PROFILE_COUNT
    || !Array.isArray(evidence.retained_source_gaps)
    || evidence.retained_source_gaps.length !== 0
    || sortedUnique(evidence.proposed_profiles.map((profile) => profile.proposed_profile_key))
      .length !== REPRESENTATIONS_PROFILE_COUNT
  ) {
    fail(
      REPRESENTATIONS_WORK3_CODES.INVENTORY,
      'Representations unapproved inventory review evidence census drift.',
    );
  }
  return deepFreeze({
    schema_version: 'M7_V2_REPRESENTATIONS_UNAPPROVED_INVENTORY_REVIEW_VALIDATOR_ACCEPTANCE/V1',
    status: 'PASS',
    profile_count: REPRESENTATIONS_PROFILE_COUNT,
    complete_profile_count: REPRESENTATIONS_PROFILE_COUNT,
    incomplete_profile_count: 0,
    retained_source_gap_count: 0,
  });
}

function prepareRepresentationsWork3UnapprovedInventoryReview(input) {
  const evidence = representationsWork3ValidateInput(
    input,
    ['representationsWork3UnapprovedInventoryReviewEvidence', 'representationsPhase4ReviewInput'],
    'representationsWork3UnapprovedInventoryReviewEvidence',
    ['work3RepresentationsUnapprovedInventoryReviewAuthority'],
  );
  const authorityEnvelope = representationsWork3ValidatePinnedEnvelope(
    evidence.work3RepresentationsUnapprovedInventoryReviewAuthority,
    REPRESENTATIONS_WORK3_INVENTORY_AUTHORITY_BINDING,
    'Representations Work3 inventory authority',
  );
  const phase4 = representationsWork3Phase4(input.representationsPhase4ReviewInput);
  const validator = validateRepresentationsUnapprovedInventoryReviewEvidence({
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
      profile_count: REPRESENTATIONS_PROFILE_COUNT,
      complete_profile_count: REPRESENTATIONS_PROFILE_COUNT,
      incomplete_profile_count: 0,
      retained_source_gap_count: 0,
    },
    validator_acceptance_reference: clone(validator),
    review_accounting: clone(contract.review_accounting_exact_values),
    withheld_work3_fields: clone(REPRESENTATIONS_WORK3_WITHHELD_FIELDS),
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

function representationsWork3ValidatePacket(envelope) {
  representationsWork3ValidatePinnedEnvelope(
    envelope,
    REPRESENTATIONS_WORK3_PACKET_BINDING,
    'Representations inventory packet',
  );
  const record = envelope.record;
  if (
    record.profile_count !== REPRESENTATIONS_PROFILE_COUNT
    || record.complete_profile_count !== REPRESENTATIONS_PROFILE_COUNT
    || record.incomplete_profile_count !== 0
    || record.retained_source_gap_count !== 0
    || !Array.isArray(record.profile_review_items)
    || record.profile_review_items.length !== REPRESENTATIONS_PROFILE_COUNT
    || record.profile_review_items.filter((item) => item.review_flags.includes(
      'LEGAL_GROUPING_REVIEW_REQUIRED',
    )).length !== REPRESENTATIONS_PROFILE_COUNT
    || record.profile_review_items.filter((item) => item.review_flags.includes(
      'CROSS_FAMILY_KNOWLEDGE_DEFINITION_LINK_ONLY',
    )).length !== REPRESENTATIONS_KNOWLEDGE_QUALIFIER_PROFILE_COUNT
  ) fail(REPRESENTATIONS_WORK3_CODES.INVENTORY, 'Representations inventory packet census drift.');
  return record;
}

function representationsWork3ValidateDisposition(envelope) {
  representationsWork3ValidatePinnedEnvelope(
    envelope,
    REPRESENTATIONS_WORK3_DISPOSITION_BINDING,
    'Representations Ben disposition',
  );
  const record = envelope.record;
  const rows = record.profile_dispositions;
  const summary = record.session_summary;
  if (
    record.reviewer !== 'BEN_GOODCHILD'
    || record.default_disposition_applied !== true
    || record.packet_digest !== REPRESENTATIONS_WORK3_PACKET_BINDING.sha256
    || record.ben_rulings_digest !== REPRESENTATIONS_WORK3_RULINGS_BINDING.sha256
    || !Array.isArray(rows)
    || rows.length !== REPRESENTATIONS_PROFILE_COUNT
    || rows.filter((row) => row.disposition === 'APPROVE').length !== REPRESENTATIONS_PROFILE_COUNT
    || summary.approved_count !== REPRESENTATIONS_PROFILE_COUNT
    || summary.hold_count !== 0
    || summary.legal_grouping_review_pending_count !== REPRESENTATIONS_PROFILE_COUNT
    || summary.cross_family_knowledge_definition_link_only_count
      !== REPRESENTATIONS_KNOWLEDGE_QUALIFIER_PROFILE_COUNT
    || summary.taxonomy_expansion_acknowledged !== true
  ) fail(REPRESENTATIONS_WORK3_CODES.DISPOSITION, 'Representations Ben inventory disposition drift.');
  return record;
}

function prepareRepresentationsWork3BenInventorySessionDisposition(input) {
  const evidenceKeys = [
    'work3RepresentationsUnapprovedInventoryReviewAuthority',
    'work3RepresentationsBenInventorySessionSuccessorAuthority',
    'inventoryReviewPacketDraft',
    'benAuthoredInventoryDisposition',
  ];
  const evidence = representationsWork3ValidateInput(
    input,
    ['representationsWork3BenInventorySessionDispositionEvidence', 'representationsPhase4ReviewInput'],
    'representationsWork3BenInventorySessionDispositionEvidence',
    evidenceKeys,
  );
  const authorityEnvelope = representationsWork3ValidatePinnedEnvelope(
    evidence.work3RepresentationsBenInventorySessionSuccessorAuthority,
    REPRESENTATIONS_WORK3_BEN_AUTHORITY_BINDING,
    'Representations Ben inventory authority',
  );
  representationsWork3ValidatePacket(evidence.inventoryReviewPacketDraft);
  const disposition = representationsWork3ValidateDisposition(
    evidence.benAuthoredInventoryDisposition,
  );
  const inventory = prepareRepresentationsWork3UnapprovedInventoryReview({
    representationsWork3UnapprovedInventoryReviewEvidence: {
      work3RepresentationsUnapprovedInventoryReviewAuthority:
        evidence.work3RepresentationsUnapprovedInventoryReviewAuthority,
    },
    representationsPhase4ReviewInput: input.representationsPhase4ReviewInput,
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
      path: REPRESENTATIONS_WORK3_DISPOSITION_BINDING.path,
      inventory_disposition_id: disposition.inventory_disposition_id,
      packet_digest: disposition.packet_digest,
      profile_disposition_count: REPRESENTATIONS_PROFILE_COUNT,
      session_summary: clone(disposition.session_summary),
    },
    packet_binding: clone(REPRESENTATIONS_WORK3_PACKET_BINDING),
    ben_rulings_binding: clone(REPRESENTATIONS_WORK3_RULINGS_BINDING),
    session_receipt_reference: {
      schema_version: REPRESENTATIONS_WORK3_SESSION_BINDING.schema_version,
      ben_inventory_session_receipt_id: disposition.session_receipt_id,
      completion_state: 'COMPLETE',
    },
    review_accounting: clone(contract.review_accounting_exact_values),
    withheld_work3_fields: clone(REPRESENTATIONS_WORK3_WITHHELD_FIELDS),
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

function representationsWork3ValidateSessionReceipt(envelope) {
  representationsWork3ValidatePinnedEnvelope(
    envelope,
    REPRESENTATIONS_WORK3_SESSION_BINDING,
    'Representations Ben session receipt',
  );
  const record = envelope.record;
  if (
    record.completion_state !== 'COMPLETE'
    || record.disposition_binding.inventory_disposition_id
      !== REPRESENTATIONS_WORK3_DISPOSITION_BINDING.record_id
    || record.zero_effect_boundary.work3_identity_count !== 0
  ) fail(REPRESENTATIONS_WORK3_CODES.RECEIPT, 'Representations Ben session receipt drift.');
  return record;
}

function prepareRepresentationsWork3FamilyPackageSeal(input) {
  const evidenceKeys = [
    'work3RepresentationsUnapprovedInventoryReviewAuthority',
    'work3RepresentationsBenInventorySessionSuccessorAuthority',
    'work3RepresentationsFamilyPackageSealSuccessorAuthority',
    'inventoryReviewPacketDraft',
    'benAuthoredInventoryDisposition',
    'benInventorySessionReceipt',
  ];
  const evidence = representationsWork3ValidateInput(
    input,
    ['representationsWork3FamilyPackageSealEvidence', 'representationsPhase4ReviewInput'],
    'representationsWork3FamilyPackageSealEvidence',
    evidenceKeys,
  );
  const authorityEnvelope = representationsWork3ValidatePinnedEnvelope(
    evidence.work3RepresentationsFamilyPackageSealSuccessorAuthority,
    REPRESENTATIONS_WORK3_SEAL_AUTHORITY_BINDING,
    'Representations family package seal authority',
  );
  const dispositionCandidate = prepareRepresentationsWork3BenInventorySessionDisposition({
    representationsWork3BenInventorySessionDispositionEvidence: {
      work3RepresentationsUnapprovedInventoryReviewAuthority:
        evidence.work3RepresentationsUnapprovedInventoryReviewAuthority,
      work3RepresentationsBenInventorySessionSuccessorAuthority:
        evidence.work3RepresentationsBenInventorySessionSuccessorAuthority,
      inventoryReviewPacketDraft: evidence.inventoryReviewPacketDraft,
      benAuthoredInventoryDisposition: evidence.benAuthoredInventoryDisposition,
    },
    representationsPhase4ReviewInput: input.representationsPhase4ReviewInput,
  });
  representationsWork3ValidateSessionReceipt(evidence.benInventorySessionReceipt);
  if (
    dispositionCandidate.session_receipt_reference.ben_inventory_session_receipt_id
      !== evidence.benInventorySessionReceipt.record.ben_inventory_session_receipt_id
  ) fail(REPRESENTATIONS_WORK3_CODES.RECEIPT, 'Representations session receipt identity drift.');
  const contract = authorityEnvelope.record.schema_review_candidate_contract;
  const unsigned = {
    schema_version: contract.schema_version,
    candidate_state: contract.candidate_state,
    authority_binding: clone(authorityEnvelope.binding),
    inventory_session_disposition_reference: {
      inventory_disposition_id: REPRESENTATIONS_WORK3_DISPOSITION_BINDING.record_id,
      candidate_state: dispositionCandidate.candidate_state,
    },
    ben_rulings_binding: clone(REPRESENTATIONS_WORK3_RULINGS_BINDING),
    disposition_binding: clone(REPRESENTATIONS_WORK3_DISPOSITION_BINDING),
    session_receipt_binding: clone(REPRESENTATIONS_WORK3_SESSION_BINDING),
    legal_grouping_disposition_binding: {
      ...clone(REPRESENTATIONS_WORK3_RULINGS_BINDING),
      disposition_status: 'PENDING_LEGAL_REVIEW',
      legal_grouping_review_pending_count: REPRESENTATIONS_PROFILE_COUNT,
      populated_subtype_bucket_count: 1,
      registered_subtype_bucket_count: 6,
    },
    review_accounting: clone(contract.review_accounting_exact_values),
    withheld_work3_fields: clone(REPRESENTATIONS_WORK3_WITHHELD_FIELDS),
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

function representationsWork3ValidateSealReceipt(envelope) {
  representationsWork3ValidatePinnedEnvelope(
    envelope,
    REPRESENTATIONS_WORK3_SEAL_RECEIPT_BINDING,
    'Representations family seal receipt',
  );
  const record = envelope.record;
  if (
    record.completion_state !== 'COMPLETE'
    || record.reviewer !== 'BEN_GOODCHILD'
    || record.disposition_binding.record_id !== REPRESENTATIONS_WORK3_DISPOSITION_BINDING.record_id
    || record.legal_grouping_disposition_binding.disposition_status !== 'PENDING_LEGAL_REVIEW'
    || record.zero_effect_boundary.work3_identity_count !== 0
  ) fail(REPRESENTATIONS_WORK3_CODES.RECEIPT, 'Representations family seal receipt drift.');
  return record;
}

function prepareRepresentationsWork3FamilyPackageRegistration(input) {
  const evidenceKeys = [
    'work3RepresentationsUnapprovedInventoryReviewAuthority',
    'work3RepresentationsBenInventorySessionSuccessorAuthority',
    'work3RepresentationsFamilyPackageSealSuccessorAuthority',
    'work3RepresentationsRegistrationSuccessorAuthority',
    'inventoryReviewPacketDraft',
    'benAuthoredInventoryDisposition',
    'benInventorySessionReceipt',
    'familyPackageSealReceipt',
  ];
  const evidence = representationsWork3ValidateInput(
    input,
    ['representationsWork3FamilyPackageRegistrationEvidence', 'representationsPhase4ReviewInput'],
    'representationsWork3FamilyPackageRegistrationEvidence',
    evidenceKeys,
  );
  const authorityEnvelope = representationsWork3ValidatePinnedEnvelope(
    evidence.work3RepresentationsRegistrationSuccessorAuthority,
    REPRESENTATIONS_WORK3_REGISTRATION_AUTHORITY_BINDING,
    'Representations registration authority',
  );
  const sealCandidate = prepareRepresentationsWork3FamilyPackageSeal({
    representationsWork3FamilyPackageSealEvidence: {
      work3RepresentationsUnapprovedInventoryReviewAuthority:
        evidence.work3RepresentationsUnapprovedInventoryReviewAuthority,
      work3RepresentationsBenInventorySessionSuccessorAuthority:
        evidence.work3RepresentationsBenInventorySessionSuccessorAuthority,
      work3RepresentationsFamilyPackageSealSuccessorAuthority:
        evidence.work3RepresentationsFamilyPackageSealSuccessorAuthority,
      inventoryReviewPacketDraft: evidence.inventoryReviewPacketDraft,
      benAuthoredInventoryDisposition: evidence.benAuthoredInventoryDisposition,
      benInventorySessionReceipt: evidence.benInventorySessionReceipt,
    },
    representationsPhase4ReviewInput: input.representationsPhase4ReviewInput,
  });
  const sealReceipt = representationsWork3ValidateSealReceipt(evidence.familyPackageSealReceipt);
  if (sealReceipt.family_package_seal_id !== sealCandidate.family_package_seal_id) {
    fail(
      REPRESENTATIONS_WORK3_CODES.RECEIPT,
      'Representations family seal candidate and receipt identity drift.',
    );
  }
  const phase4 = representationsWork3Phase4(input.representationsPhase4ReviewInput);
  const dispositionByKey = new Map(
    evidence.benAuthoredInventoryDisposition.record.profile_dispositions.map(
      (row) => [row.proposed_profile_key, row],
    ),
  );
  const registeredProfiles = phase4.proposed_profiles.map((profile) => {
    const disposition = dispositionByKey.get(profile.proposed_profile_key);
    if (!disposition) {
      fail(REPRESENTATIONS_WORK3_CODES.OUTPUT, 'Representations registration disposition missing.');
    }
    const identityInput = {
      family_key: 'REPRESENTATIONS',
      proposed_profile_key: profile.proposed_profile_key,
      phase3_profile_key: null,
      profile_set_version: 1,
    };
    return {
      profile_id: contentId('M7_V2_REPRESENTATIONS_WORK3_REGISTERED_PROFILE_IDENTITY/V1', identityInput),
      proposed_profile_key: profile.proposed_profile_key,
      phase3_profile_key: null,
      inventory_disposition: disposition.disposition,
      legal_grouping_pending_acknowledged: disposition.legal_grouping_pending_acknowledged,
    };
  });
  const packageUnsigned = {
    family_key: 'REPRESENTATIONS',
    profile_set_version: 1,
    package_state: 'BEN_SEALED_IN_MEMORY_REGISTRATION_ONLY',
    profile_id_count: REPRESENTATIONS_PROFILE_COUNT,
    profile_ids: registeredProfiles.map((profile) => profile.profile_id),
    inventory_disposition_id: REPRESENTATIONS_WORK3_DISPOSITION_BINDING.record_id,
    family_package_seal_receipt_id: REPRESENTATIONS_WORK3_SEAL_RECEIPT_BINDING.record_id,
    legal_grouping_disposition_state: 'PENDING_LEGAL_REVIEW',
  };
  const packageIdentity = {
    family_profile_package_id: contentId(
      'M7_V2_REPRESENTATIONS_WORK3_FAMILY_PROFILE_PACKAGE_IDENTITY/V1',
      packageUnsigned,
    ),
    family_key: packageUnsigned.family_key,
    profile_set_version: 1,
    package_state: packageUnsigned.package_state,
    profile_id_count: REPRESENTATIONS_PROFILE_COUNT,
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
    family_package_seal_receipt_binding: clone(REPRESENTATIONS_WORK3_SEAL_RECEIPT_BINDING),
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
      state: 'STOP_AFTER_REPRESENTATIONS_FAMILY_PACKAGE_REGISTRATION_BEFORE_ACTIVATION',
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
    result.registered_profile_identities.length !== REPRESENTATIONS_PROFILE_COUNT
    || result.review_accounting.profile_identity_count !== REPRESENTATIONS_PROFILE_COUNT
    || result.review_accounting.work3_identity_count !== REPRESENTATIONS_PROFILE_COUNT + 1
    || result.zero_effect_boundary.activation_count !== 0
    || representationsContainsForbiddenKey(result, new Set(['activation_id']))
  ) fail(REPRESENTATIONS_WORK3_CODES.OUTPUT, 'Representations family registration boundary drift.');
  return result;
}

module.exports = {
  REPRESENTATIONS_KNOWLEDGE_QUALIFIER_PROFILE_COUNT,
  REPRESENTATIONS_PHASE2_AUTHORITY_BYTES,
  REPRESENTATIONS_PHASE2_AUTHORITY_ID,
  REPRESENTATIONS_PHASE2_AUTHORITY_PATH,
  REPRESENTATIONS_PHASE2_AUTHORITY_SCHEMA,
  REPRESENTATIONS_PHASE2_AUTHORITY_SHA256,
  REPRESENTATIONS_PHASE2_PROPOSAL_CODES,
  REPRESENTATIONS_PHASE2_PROPOSAL_KEYS,
  REPRESENTATIONS_PHASE4_AUTHORITY_BYTES,
  REPRESENTATIONS_PHASE4_AUTHORITY_ID,
  REPRESENTATIONS_PHASE4_AUTHORITY_PATH,
  REPRESENTATIONS_PHASE4_AUTHORITY_SCHEMA,
  REPRESENTATIONS_PHASE4_AUTHORITY_SHA256,
  REPRESENTATIONS_PHASE4_CANDIDATE_SCHEMA,
  REPRESENTATIONS_PHASE4_CANDIDATE_STATE,
  REPRESENTATIONS_PHASE4_REVIEW_CODES,
  REPRESENTATIONS_PHASE4_REVIEW_INPUT_KEYS,
  REPRESENTATIONS_PHASE4_REVIEW_OUTPUT_KEYS,
  REPRESENTATIONS_PHASE4_SCHEDULE_SHA256,
  REPRESENTATIONS_PROFILE_COUNT,
  prepareRepresentationsFamilyProfilePackageReview,
  prepareRepresentationsPhase2FamilyProposal,
  prepareRepresentationsWork3BenInventorySessionDisposition,
  prepareRepresentationsWork3FamilyPackageRegistration,
  prepareRepresentationsWork3FamilyPackageSeal,
  prepareRepresentationsWork3UnapprovedInventoryReview,
  representationsProposalPartition,
  validateRepresentationsUnapprovedInventoryReviewEvidence,
};
