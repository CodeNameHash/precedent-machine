'use strict';

/**
 * Family-local M7 V2 repair authoring for DIVIDENDS (N1 family #19).
 *
 * Milestone A ladder, D&O-minimal path (Phase 3 reference chain skipped, because
 * every calibration provision example has an empty m3_dependency_ids list):
 *   Phase 2 partition -> Phase 4 package review -> Work3 inventory review ->
 *   Ben inventory session disposition -> family package seal -> registration.
 *
 * Deliberately self-contained: the shared spine (m7-v2-profile-authoring.js) is on a
 * separate merge track, so the helpers below are adapted copies rather than imports.
 *
 * The single profile is claim-scale: one governed M4 claim on the Concho comparator
 * deal (§6.21 dividend-coordination covenant). Q01 requires one profile per operative
 * limb; this family has exactly one comparator-resolved claim.
 *
 * Subtype grouping is an open legal question — the sealed M5 role schema admits the
 * sole claim definition key under all five subtype buckets — so the profile carries
 * LEGAL_GROUPING_REVIEW_REQUIRED. The calibration pack tags every provision example
 * DIVIDEND_COORDINATION, matching the comparator claim's authored bucket; the family
 * seal records PENDING_LEGAL_REVIEW rather than a resolved taxonomy. Consideration (#15)
 * and Interim Operating (#21) Q02 link-only boundaries apply only when those rows
 * surface elsewhere.
 */

const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');

const DIVIDENDS_PROFILE_COUNT = 1;
const DIVIDENDS_SUBTYPE_DIVERGENCE_PROFILE_COUNT = 0;
const DIVIDENDS_OUTSIDE_CALIBRATION_PROFILE_COUNT = 0;
const DIVIDENDS_REGISTERED_SUBTYPE_BUCKET_COUNT = 5;
const DIVIDENDS_POPULATED_SUBTYPE_BUCKET_COUNT = 1;

const DIVIDENDS_REVIEW_FLAGS = Object.freeze({
  LEGAL_GROUPING: 'LEGAL_GROUPING_REVIEW_REQUIRED',
  OUTSIDE_CALIBRATION: 'COMPARATOR_CLAIM_OUTSIDE_CALIBRATION_PROVISION_EXAMPLES',
  SUBTYPE_DIVERGENCE: 'SUBTYPE_PARTITION_DIVERGES_FROM_CALIBRATION_PROPOSED_SUBTYPE',
});

const DIVIDENDS_PHASE2_AUTHORITY_SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_CONTRACT_DIVIDENDS_AUTHORING_PHASE2_AUTHORITY/V2';
const DIVIDENDS_PHASE2_AUTHORITY_ID =
  'b8b1f881e2e99b1910867c7582ebbbc99c3134cb5ec56ec2f95a19a103b87a10';
const DIVIDENDS_PHASE2_AUTHORITY_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-dividends-authoring-phase2-authority-v2.json';
const DIVIDENDS_PHASE2_AUTHORITY_BYTES = 22942;
const DIVIDENDS_PHASE2_AUTHORITY_SHA256 =
  '8f241af23258736d1e3689ef1549d2ee83242f1b1618432b7f28635a28608942';

const DIVIDENDS_PHASE2_PROPOSAL_CODES = Object.freeze({
  AUTHORITY: 'M7_V2_DIVIDENDS_PHASE2_AUTHORITY',
  CONTRACT: 'M7_V2_DIVIDENDS_PHASE2_PROPOSAL_CONTRACT',
  COVERAGE: 'M7_V2_DIVIDENDS_PHASE2_SOURCE_COVERAGE',
});

const DIVIDENDS_PHASE2_PROPOSAL_KEYS = Object.freeze([
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

function validateDividendsProposalAuthority(envelope) {
  const code = DIVIDENDS_PHASE2_PROPOSAL_CODES.AUTHORITY;
  validateEnvelopeShape(envelope, code, 'Phase2 authority');
  validateBoundRecord(envelope, code, 'Phase2 authority');
  const { binding, record } = envelope;
  if (
    binding.byte_length !== DIVIDENDS_PHASE2_AUTHORITY_BYTES
    || binding.path !== DIVIDENDS_PHASE2_AUTHORITY_PATH
    || binding.record_id !== DIVIDENDS_PHASE2_AUTHORITY_ID
    || binding.record_id_field !== 'dividends_authoring_phase2_authority_id'
    || binding.schema_version !== DIVIDENDS_PHASE2_AUTHORITY_SCHEMA
    || binding.sha256 !== DIVIDENDS_PHASE2_AUTHORITY_SHA256
  ) {
    fail(code, 'Phase2 authority binding drift.');
  }
  if (
    record.schema_version !== DIVIDENDS_PHASE2_AUTHORITY_SCHEMA
    || record.dividends_authoring_phase2_authority_id
      !== DIVIDENDS_PHASE2_AUTHORITY_ID
  ) {
    fail(code, 'Phase2 authority identity drift.');
  }
  const unsigned = { ...record };
  delete unsigned.dividends_authoring_phase2_authority_id;
  if (contentId(record.schema_version, unsigned) !== DIVIDENDS_PHASE2_AUTHORITY_ID) {
    fail(code, 'Phase2 authority self identity drift.');
  }
  return deepFreeze(clone(envelope));
}

function dividendsAgreementSources(authority, agreementEvidenceByAgreementId) {
  const code = DIVIDENDS_PHASE2_PROPOSAL_CODES.COVERAGE;
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

function validateDividendsProposalGovernedSources(authority, governedSources) {
  const code = DIVIDENDS_PHASE2_PROPOSAL_CODES.COVERAGE;
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
  return dividendsAgreementSources(
    authority,
    governedSources.agreementEvidenceByAgreementId,
  );
}

function validateDividendsProposalSourceCoverage(authority, agreements) {
  const code = DIVIDENDS_PHASE2_PROPOSAL_CODES.COVERAGE;
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
      || claim.family !== 'DIVIDENDS'
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

function dividendsProposalCoverageRecords(authority, coverage) {
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

function dividendsProposalPartition(coverage) {
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

function dividendsProposalInventoryDigest(coverage, proposedPartition) {
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

function prepareDividendsPhase2FamilyProposal(input) {
  const contractCode = DIVIDENDS_PHASE2_PROPOSAL_CODES.CONTRACT;
  exactKeysOrFail(
    input,
    ['dividendsAuthoringPhase2Authority', 'governedSources'],
    contractCode,
    'Dividends proposal input',
  );
  const authorityEnvelope = validateDividendsProposalAuthority(
    input.dividendsAuthoringPhase2Authority,
  );
  const authority = authorityEnvelope.record;
  const agreements = validateDividendsProposalGovernedSources(
    authority,
    input.governedSources,
  );
  const coverage = validateDividendsProposalSourceCoverage(authority, agreements);
  const accounting = dividendsProposalCoverageRecords(authority, coverage);
  const proposedPartition = dividendsProposalPartition(coverage);
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
    'DIVIDENDS_Q01_Q02_Q03_BOUND_TO_SEALED_M5_PROGRAMME_RULINGS',
    DIVIDENDS_REVIEW_FLAGS.LEGAL_GROUPING,
  ].sort(compareStrings);
  const unsignedProposal = {
    schema_version: 'M7_V2_DIVIDENDS_FAMILY_PROPOSAL/V1',
    family_key: 'DIVIDENDS',
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
    inventory_digest: dividendsProposalInventoryDigest(coverage, proposedPartition),
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

const DIVIDENDS_PHASE4_AUTHORITY_SCHEMA =
  'STAGE_2Y_M7_V2_REPAIR_CONTRACT_DIVIDENDS_AUTHORING_PHASE4_FAMILY_PROFILE_PACKAGE_REVIEW_AUTHORITY/V1';
const DIVIDENDS_PHASE4_AUTHORITY_ID =
  '626fa736c7878d27e729edb9ea579e512be6db33bb1b7f41b5a09130037d931f';
const DIVIDENDS_PHASE4_AUTHORITY_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control/m7-v2-repair-contract-dividends-authoring-phase4-family-profile-package-review-authority.json';
const DIVIDENDS_PHASE4_AUTHORITY_BYTES = 9591;
const DIVIDENDS_PHASE4_AUTHORITY_SHA256 =
  'a21c5d483f936b185676e9864215d6403e9d99a7d480a11cb9e65d1c3a22e3a8';
const DIVIDENDS_PHASE4_SCHEDULE_SHA256 =
  'b59fc36a91dbca6dbb796fc4fd094ff013eda4f867215436d07286f1deeaa635';
const DIVIDENDS_PHASE4_CANDIDATE_SCHEMA =
  'M7_V2_DIVIDENDS_PHASE4_FAMILY_PROFILE_PACKAGE_REVIEW_CANDIDATE/V1';
const DIVIDENDS_PHASE4_CANDIDATE_STATE =
  'REVIEW_ONLY_1_PROFILES_UNAPPROVED_AWAITING_BEN_INVENTORY';

const DIVIDENDS_PHASE4_REVIEW_CODES = Object.freeze({
  CONTRACT: 'M7_V2_DIVIDENDS_PHASE4_REVIEW_CONTRACT',
  AUTHORITY: 'M7_V2_DIVIDENDS_PHASE4_REVIEW_AUTHORITY',
  PHASE2_PROPOSAL: 'M7_V2_DIVIDENDS_PHASE4_PHASE2_PROPOSAL',
  PROFILE_SCHEDULE: 'M7_V2_DIVIDENDS_PHASE4_PROFILE_SCHEDULE',
  REVIEW_OUTPUT: 'M7_V2_DIVIDENDS_PHASE4_REVIEW_OUTPUT',
});

const DIVIDENDS_PHASE4_REVIEW_INPUT_KEYS = Object.freeze([
  'dividendsAuthoringPhase4FamilyProfilePackageReviewAuthority',
  'dividendsAuthoringPhase2Authority',
  'governedSources',
]);

const DIVIDENDS_PHASE4_REVIEW_OUTPUT_KEYS = Object.freeze([
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

const DIVIDENDS_PHASE4_AUTHORITY_ROOT_KEYS = Object.freeze([
  'authority_classification',
  'authority_state',
  'candidate_output_contract',
  'design_basis',
  'execution_schedule',
  'dividends_authoring_phase4_family_profile_package_review_authority_id',
  'first_legal_stop_contract',
  'forbidden_output_contract',
  'immutable_parent_bindings',
  'implementation_contract',
  'profile_review_schedule',
  'profile_review_schedule_contract',
  'schema_version',
  'zero_effect_boundary',
]);

function dividendsPhase4ExpectedParentBindings() {
  return {
    dividends_authoring_phase2_authority: {
      byte_length: DIVIDENDS_PHASE2_AUTHORITY_BYTES,
      path: DIVIDENDS_PHASE2_AUTHORITY_PATH,
      record_id: DIVIDENDS_PHASE2_AUTHORITY_ID,
      record_id_field: 'dividends_authoring_phase2_authority_id',
      schema_version: DIVIDENDS_PHASE2_AUTHORITY_SCHEMA,
      sha256: DIVIDENDS_PHASE2_AUTHORITY_SHA256,
    },
  };
}

function dividendsContainsForbiddenKey(value, forbiddenKeys, seen = new Set()) {
  if (!value || typeof value !== 'object') return false;
  if (seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) {
    return value.some((member) => dividendsContainsForbiddenKey(
      member,
      forbiddenKeys,
      seen,
    ));
  }
  for (const [key, member] of Object.entries(value)) {
    if (forbiddenKeys.has(key)) return true;
    if (dividendsContainsForbiddenKey(member, forbiddenKeys, seen)) return true;
  }
  return false;
}

function validateDividendsPhase4FamilyProfilePackageReviewAuthority(envelope) {
  const code = DIVIDENDS_PHASE4_REVIEW_CODES.AUTHORITY;
  validateEnvelopeShape(envelope, code, 'Phase4 family profile package review authority');
  const { binding, record } = envelope;
  if (
    binding.byte_length !== DIVIDENDS_PHASE4_AUTHORITY_BYTES
    || binding.path !== DIVIDENDS_PHASE4_AUTHORITY_PATH
    || binding.record_id !== DIVIDENDS_PHASE4_AUTHORITY_ID
    || binding.record_id_field
      !== 'dividends_authoring_phase4_family_profile_package_review_authority_id'
    || binding.schema_version !== DIVIDENDS_PHASE4_AUTHORITY_SCHEMA
    || binding.sha256 !== DIVIDENDS_PHASE4_AUTHORITY_SHA256
  ) {
    fail(code, 'Phase4 family profile package review authority binding drift.');
  }
  validateBoundRecord(envelope, code, 'Phase4 family profile package review authority');
  if (
    !exactKeys(record, DIVIDENDS_PHASE4_AUTHORITY_ROOT_KEYS)
    || record.schema_version !== DIVIDENDS_PHASE4_AUTHORITY_SCHEMA
    || record.dividends_authoring_phase4_family_profile_package_review_authority_id
      !== DIVIDENDS_PHASE4_AUTHORITY_ID
  ) {
    fail(code, 'Phase4 family profile package review authority identity drift.');
  }
  const unsigned = { ...record };
  delete unsigned.dividends_authoring_phase4_family_profile_package_review_authority_id;
  if (contentId(record.schema_version, unsigned) !== DIVIDENDS_PHASE4_AUTHORITY_ID) {
    fail(code, 'Phase4 family profile package review authority self identity drift.');
  }

  const implementation = record.implementation_contract;
  const output = record.candidate_output_contract;
  const scheduleContract = record.profile_review_schedule_contract;
  const schedule = record.profile_review_schedule;
  const expectedErrorCodes = Object.values(DIVIDENDS_PHASE4_REVIEW_CODES);
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
      dividendsPhase4ExpectedParentBindings(),
    )
    || !sameValue(
      implementation.exact_outer_input_keys,
      DIVIDENDS_PHASE4_REVIEW_INPUT_KEYS,
    )
    || implementation.exported_function !== 'prepareDividendsFamilyProfilePackageReview'
    || implementation.phase2_internal_function
      !== 'prepareDividendsPhase2FamilyProposal'
    || implementation.phase3_internal_function !== null
    || implementation.caller_produced_candidate_input_forbidden !== true
    || !Array.isArray(implementation.error_precedence)
    || implementation.error_precedence.length !== expectedErrorCodes.length
    || implementation.error_precedence.some((entry, index) => (
      entry.order !== index + 1 || entry.code !== expectedErrorCodes[index]
    ))
    || output.schema_version !== DIVIDENDS_PHASE4_CANDIDATE_SCHEMA
    || output.record_id_field !== 'review_candidate_id'
    || output.candidate_state !== DIVIDENDS_PHASE4_CANDIDATE_STATE
    || output.profile_approval_state !== 'UNAPPROVED'
    || !sameValue(output.exact_keys, DIVIDENDS_PHASE4_REVIEW_OUTPUT_KEYS)
    || schedule.length !== DIVIDENDS_PROFILE_COUNT
    || scheduleContract.exact_profile_count !== DIVIDENDS_PROFILE_COUNT
    || scheduleContract.exact_complete_profile_count !== DIVIDENDS_PROFILE_COUNT
    || scheduleContract.exact_incomplete_profile_count !== 0
    || scheduleContract.schedule_canonical_json_sha256
      !== DIVIDENDS_PHASE4_SCHEDULE_SHA256
    || sha256Hex(scheduleBytes) !== DIVIDENDS_PHASE4_SCHEDULE_SHA256
    || scheduleContract.schedule_canonical_json_byte_length !== scheduleBytes.length
  ) {
    fail(code, 'Phase4 family profile package review authority contract drift.');
  }
  return deepFreeze(clone(envelope));
}

function dividendsPhase4ValidatePhase2Proposal(proposal) {
  const code = DIVIDENDS_PHASE4_REVIEW_CODES.PHASE2_PROPOSAL;
  if (
    !isObject(proposal)
    || proposal.schema_version !== 'M7_V2_DIVIDENDS_FAMILY_PROPOSAL/V1'
    || proposal.family_key !== 'DIVIDENDS'
    || proposal.profile_approval_state !== 'UNAPPROVED'
    || proposal.source_terminal_coverage.accounted_count !== DIVIDENDS_PROFILE_COUNT
    || proposal.m4_claim_accounting.accounted_count !== DIVIDENDS_PROFILE_COUNT
    || proposal.derived_profile_count !== DIVIDENDS_PROFILE_COUNT
    || !Array.isArray(proposal.proposed_partition.proposed_profiles)
    || proposal.proposed_partition.proposed_profiles.length !== DIVIDENDS_PROFILE_COUNT
    || proposal.proposed_partition.source_unit_assignment_count
      !== DIVIDENDS_PROFILE_COUNT
    || proposal.proposed_partition.m4_claim_assignment_count !== DIVIDENDS_PROFILE_COUNT
  ) {
    fail(code, 'Phase4 fresh Phase2 proposal drift.');
  }
  const unsigned = { ...proposal };
  delete unsigned.proposal_id;
  if (contentId(proposal.schema_version, unsigned) !== proposal.proposal_id) {
    fail(code, 'Phase4 fresh Phase2 proposal identity drift.');
  }
}

function dividendsPhase4DeriveProfiles(authority, phase2Proposal) {
  const scheduleCode = DIVIDENDS_PHASE4_REVIEW_CODES.PROFILE_SCHEDULE;
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
        'DIVIDENDS',
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

function prepareDividendsFamilyProfilePackageReview(input) {
  const contractCode = DIVIDENDS_PHASE4_REVIEW_CODES.CONTRACT;
  exactKeysOrFail(
    input,
    DIVIDENDS_PHASE4_REVIEW_INPUT_KEYS,
    contractCode,
    'Dividends Phase4 package review input',
  );
  const authorityEnvelope = validateDividendsPhase4FamilyProfilePackageReviewAuthority(
    input.dividendsAuthoringPhase4FamilyProfilePackageReviewAuthority,
  );
  const authority = authorityEnvelope.record;
  const phase2AuthorityEnvelope = validateDividendsProposalAuthority(
    input.dividendsAuthoringPhase2Authority,
  );
  if (
    phase2AuthorityEnvelope.binding.record_id
      !== authority.immutable_parent_bindings
        .dividends_authoring_phase2_authority.record_id
  ) {
    fail(
      DIVIDENDS_PHASE4_REVIEW_CODES.AUTHORITY,
      'Phase4 parent Phase2 authority pin drift.',
    );
  }
  validateDividendsProposalGovernedSources(
    phase2AuthorityEnvelope.record,
    input.governedSources,
  );

  let phase2Proposal;
  try {
    phase2Proposal = prepareDividendsPhase2FamilyProposal({
      dividendsAuthoringPhase2Authority: input.dividendsAuthoringPhase2Authority,
      governedSources: input.governedSources,
    });
  } catch (error) {
    fail(
      DIVIDENDS_PHASE4_REVIEW_CODES.PHASE2_PROPOSAL,
      'Phase4 fresh Phase2 proposal failed.',
      { cause_code: typeof error.code === 'string' ? error.code : null },
    );
  }
  dividendsPhase4ValidatePhase2Proposal(phase2Proposal);
  const proposedProfiles = dividendsPhase4DeriveProfiles(authority, phase2Proposal);
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
    schema_version: DIVIDENDS_PHASE4_CANDIDATE_SCHEMA,
    family_key: 'DIVIDENDS',
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
    !exactKeys(candidate, DIVIDENDS_PHASE4_REVIEW_OUTPUT_KEYS)
    || proposedProfiles.length !== DIVIDENDS_PROFILE_COUNT
    || proposedProfiles.some((profile) => (
      !exactKeys(profile, outputContract.profile_exact_keys)
      || !exactKeys(profile.proposed_validation, outputContract.proposed_validation_exact_keys)
      || !profile.review_flags.includes(DIVIDENDS_REVIEW_FLAGS.LEGAL_GROUPING)
    ))
    || proposedProfiles.filter((profile) => profile.review_flags.includes(
      DIVIDENDS_REVIEW_FLAGS.SUBTYPE_DIVERGENCE,
    )).length !== DIVIDENDS_SUBTYPE_DIVERGENCE_PROFILE_COUNT
    || proposedProfiles.filter((profile) => profile.review_flags.includes(
      DIVIDENDS_REVIEW_FLAGS.OUTSIDE_CALIBRATION,
    )).length !== DIVIDENDS_OUTSIDE_CALIBRATION_PROFILE_COUNT
    || !sameValue(candidate.review_accounting, outputContract.review_accounting_exact_values)
    || !sameValue(candidate.unresolved_items, outputContract.unresolved_items)
    || !sameValue(candidate.withheld_work3_fields, outputContract.withheld_work3_fields)
    || !sameValue(candidate.first_legal_stop, authority.first_legal_stop_contract)
    || !sameValue(candidate.zero_effect_boundary, authority.zero_effect_boundary)
    || dividendsContainsForbiddenKey(candidate, forbiddenKeys)
  ) {
    fail(
      DIVIDENDS_PHASE4_REVIEW_CODES.REVIEW_OUTPUT,
      'Phase4 package review output boundary drift.',
    );
  }
  return deepFreeze(clone(candidate));
}

const DIVIDENDS_WORK3_CONTROL_PATH =
  'evidence/canonical-v2/stage-2y-structure-migration/control';

/**
 * Q01-Q03 are answered by the sealed programme rulings the M5 role schema already
 * binds, not by a Dividends-specific ruling note. Nothing here invents a
 * lawyer decision.
 */
const DIVIDENDS_WORK3_RULINGS_BINDING = Object.freeze({
  byte_length: 1519,
  path: `${DIVIDENDS_WORK3_CONTROL_PATH}/m5-programme-rulings.json`,
  sha256: '2711dc5c958da271bfd86a154712c251978ac1f1aec713d22302946bf8f87497',
});
const DIVIDENDS_WORK3_INVENTORY_AUTHORITY_BINDING = Object.freeze({
  byte_length: 2043,
  path: `${DIVIDENDS_WORK3_CONTROL_PATH}/m7-v2-repair-contract-work3-dividends-unapproved-inventory-review-authority.json`,
  record_id: '2607841294b5f236ec61851d2ff2bd1651342c4989077f63489506eda7bdaa54',
  record_id_field: 'work3_dividends_unapproved_inventory_review_authority_id',
  schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_DIVIDENDS_UNAPPROVED_INVENTORY_REVIEW_AUTHORITY/V1',
  sha256: 'd33685efb816492f164a7b9343f485e07ec64ef19bdfa5fb95af9aca2ca1b8c5',
});
const DIVIDENDS_WORK3_PACKET_BINDING = Object.freeze({
  byte_length: 2387,
  path: `${DIVIDENDS_WORK3_CONTROL_PATH}/m7-v2-repair-dividends-1-profile-inventory-review-packet-draft.json`,
  record_id: '719e194e750d41beb5400e9f8771ee5c2d69cc19b64c4362d8c1bf63a80514a3',
  record_id_field: 'inventory_review_packet_id',
  schema_version: 'STAGE_2Y_M7_V2_DIVIDENDS_1_PROFILE_INVENTORY_REVIEW_PACKET/V1',
  sha256: 'fdde3ea31bdc2821de307d5fda89bb1b7a25b60b72180700e2defe84f0ff06b1',
});
const DIVIDENDS_WORK3_DISPOSITION_BINDING = Object.freeze({
  byte_length: 1867,
  path: `${DIVIDENDS_WORK3_CONTROL_PATH}/m7-v2-repair-dividends-1-profile-inventory-disposition.json`,
  record_id: '2a8bced08d00987060a30861cdb53ed0c2b78ebf7f428cd784ecfe1ed6c8f689',
  record_id_field: 'inventory_disposition_id',
  schema_version: 'STAGE_2Y_M7_V2_DIVIDENDS_1_PROFILE_INVENTORY_DISPOSITION/V1',
  sha256: '44cbeeda2e96460aa1b1b1cf96ce31bc4711a50661e53e78005f94187bafcef9',
});
const DIVIDENDS_WORK3_SESSION_BINDING = Object.freeze({
  byte_length: 1099,
  path: `${DIVIDENDS_WORK3_CONTROL_PATH}/m7-v2-repair-dividends-ben-inventory-session-receipt.json`,
  record_id: '5790414e5d3525cce40ca89a6922d339310d6aa8c419f2acbbf520749828a017',
  record_id_field: 'ben_inventory_session_receipt_id',
  schema_version: 'STAGE_2Y_M7_V2_DIVIDENDS_BEN_INVENTORY_SESSION_RECEIPT/V1',
  sha256: 'e20a2a22c4ffc7aabdd12353e173e664000df9b6e80cadc73165fe388616857c',
});
const DIVIDENDS_WORK3_BEN_AUTHORITY_BINDING = Object.freeze({
  byte_length: 2723,
  path: `${DIVIDENDS_WORK3_CONTROL_PATH}/m7-v2-repair-contract-work3-dividends-ben-inventory-session-successor-authority.json`,
  record_id: '13a77f180980a2c485b50d9f59a7263f44c2104b665525adb82f50d98903601d',
  record_id_field: 'work3_dividends_ben_inventory_session_successor_authority_id',
  schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_DIVIDENDS_BEN_INVENTORY_SESSION_SUCCESSOR_AUTHORITY/V1',
  sha256: 'b5a333dfe4bc8fc81e7a2213809e0732031223d88e288aaae5be7e0f83c3eba7',
});
const DIVIDENDS_WORK3_SEAL_AUTHORITY_BINDING = Object.freeze({
  byte_length: 3218,
  path: `${DIVIDENDS_WORK3_CONTROL_PATH}/m7-v2-repair-contract-work3-dividends-family-package-seal-successor-authority.json`,
  record_id: '021b9c749f86bd34a0567cbc880c98a0f569a7195e9c8c3066a6494a47d178f3',
  record_id_field: 'work3_dividends_family_package_seal_successor_authority_id',
  schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_DIVIDENDS_FAMILY_PACKAGE_SEAL_SUCCESSOR_AUTHORITY/V1',
  sha256: '7941928134a8f6105ee1b02380d3aab09ac49aa6f3071b905a43caeb7245ee1b',
});
const DIVIDENDS_WORK3_SEAL_RECEIPT_BINDING = Object.freeze({
  byte_length: 2238,
  path: `${DIVIDENDS_WORK3_CONTROL_PATH}/m7-v2-repair-dividends-family-package-seal-receipt.json`,
  record_id: '96396c292a86e63cfade899891942ebc0e6c0bd7450e69aea1479bc136a4bc96',
  record_id_field: 'dividends_family_package_seal_receipt_id',
  schema_version: 'STAGE_2Y_M7_V2_DIVIDENDS_FAMILY_PACKAGE_SEAL_RECEIPT/V1',
  sha256: '5797baf16641401fe5d5ed63c97ff3843f4db1597bc30be745bbcf21276d2439',
});
const DIVIDENDS_WORK3_REGISTRATION_AUTHORITY_BINDING = Object.freeze({
  byte_length: 2748,
  path: `${DIVIDENDS_WORK3_CONTROL_PATH}/m7-v2-repair-contract-work3-dividends-registration-successor-authority.json`,
  record_id: '3d4e7ba3c345d6e3148b009ca1d5e4ba15dd3bdc186e2b2c824c357aa224d41a',
  record_id_field: 'work3_dividends_registration_successor_authority_id',
  schema_version: 'STAGE_2Y_M7_V2_REPAIR_CONTRACT_WORK3_DIVIDENDS_REGISTRATION_SUCCESSOR_AUTHORITY/V1',
  sha256: '893eee79fcdf885b0376ed783cff09f372ffad2fcc9fbadf91c5889d6fdf8190',
});

const DIVIDENDS_WORK3_CODES = Object.freeze({
  CONTRACT: 'M7_V2_DIVIDENDS_WORK3_CONTRACT',
  AUTHORITY: 'M7_V2_DIVIDENDS_WORK3_AUTHORITY',
  INVENTORY: 'M7_V2_DIVIDENDS_WORK3_INVENTORY',
  DISPOSITION: 'M7_V2_DIVIDENDS_WORK3_DISPOSITION',
  RECEIPT: 'M7_V2_DIVIDENDS_WORK3_RECEIPT',
  OUTPUT: 'M7_V2_DIVIDENDS_WORK3_OUTPUT',
});

const DIVIDENDS_WORK3_WITHHELD_FIELDS = Object.freeze([
  'activation_id',
  'family_profile_package_id',
  'profile_id',
  'registration_id',
]);

function dividendsWork3ValidatePinnedEnvelope(envelope, expected, label) {
  validateEnvelopeShape(envelope, DIVIDENDS_WORK3_CODES.AUTHORITY, label);
  if (!sameValue(envelope.binding, expected)) {
    fail(DIVIDENDS_WORK3_CODES.AUTHORITY, `${label} binding drift.`);
  }
  validateBoundRecord(envelope, DIVIDENDS_WORK3_CODES.AUTHORITY, label);
  const unsigned = clone(envelope.record);
  delete unsigned[expected.record_id_field];
  if (expected.record_id_field === 'inventory_disposition_id') {
    delete unsigned.session_receipt_id;
  }
  if (contentId(envelope.record.schema_version, unsigned) !== expected.record_id) {
    fail(DIVIDENDS_WORK3_CODES.AUTHORITY, `${label} self identity drift.`);
  }
  return deepFreeze(clone(envelope));
}

function dividendsWork3ValidateInput(input, outerKeys, evidenceKey, evidenceKeys) {
  exactKeysOrFail(
    input,
    outerKeys,
    DIVIDENDS_WORK3_CODES.CONTRACT,
    'Dividends Work3 input',
  );
  const evidence = input[evidenceKey];
  exactKeysOrFail(
    evidence,
    evidenceKeys,
    DIVIDENDS_WORK3_CODES.CONTRACT,
    'Dividends Work3 evidence bundle',
  );
  for (const key of evidenceKeys) {
    if (
      !isObject(evidence[key])
      || !isObject(evidence[key].binding)
      || !isObject(evidence[key].record)
    ) {
      fail(
        DIVIDENDS_WORK3_CODES.CONTRACT,
        `Dividends Work3 ${key} envelope drift.`,
      );
    }
  }
  return evidence;
}

function dividendsWork3Phase4(input) {
  try {
    return prepareDividendsFamilyProfilePackageReview(input);
  } catch (error) {
    fail(
      DIVIDENDS_WORK3_CODES.INVENTORY,
      'Dividends Work3 Phase4 review derivation failed.',
      { cause_code: typeof error.code === 'string' ? error.code : null },
    );
  }
}

function validateDividendsUnapprovedInventoryReviewEvidence(evidence) {
  if (
    !isObject(evidence)
    || evidence.profile_approval_state !== 'UNAPPROVED'
    || evidence.profile_count !== DIVIDENDS_PROFILE_COUNT
    || evidence.complete_profile_count !== DIVIDENDS_PROFILE_COUNT
    || evidence.incomplete_profile_count !== 0
    || !Array.isArray(evidence.proposed_profiles)
    || evidence.proposed_profiles.length !== DIVIDENDS_PROFILE_COUNT
    || !Array.isArray(evidence.retained_source_gaps)
    || evidence.retained_source_gaps.length !== 0
    || sortedUnique(evidence.proposed_profiles.map((profile) => profile.proposed_profile_key))
      .length !== DIVIDENDS_PROFILE_COUNT
  ) {
    fail(
      DIVIDENDS_WORK3_CODES.INVENTORY,
      'Dividends unapproved inventory review evidence census drift.',
    );
  }
  return deepFreeze({
    schema_version: 'M7_V2_DIVIDENDS_UNAPPROVED_INVENTORY_REVIEW_VALIDATOR_ACCEPTANCE/V1',
    status: 'PASS',
    profile_count: DIVIDENDS_PROFILE_COUNT,
    complete_profile_count: DIVIDENDS_PROFILE_COUNT,
    incomplete_profile_count: 0,
    retained_source_gap_count: 0,
  });
}

function prepareDividendsWork3UnapprovedInventoryReview(input) {
  const evidence = dividendsWork3ValidateInput(
    input,
    [
      'dividendsWork3UnapprovedInventoryReviewEvidence',
      'dividendsPhase4ReviewInput',
    ],
    'dividendsWork3UnapprovedInventoryReviewEvidence',
    ['work3DividendsUnapprovedInventoryReviewAuthority'],
  );
  const authorityEnvelope = dividendsWork3ValidatePinnedEnvelope(
    evidence.work3DividendsUnapprovedInventoryReviewAuthority,
    DIVIDENDS_WORK3_INVENTORY_AUTHORITY_BINDING,
    'Dividends Work3 inventory authority',
  );
  const phase4 = dividendsWork3Phase4(input.dividendsPhase4ReviewInput);
  const validator = validateDividendsUnapprovedInventoryReviewEvidence({
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
      profile_count: DIVIDENDS_PROFILE_COUNT,
      complete_profile_count: DIVIDENDS_PROFILE_COUNT,
      incomplete_profile_count: 0,
      retained_source_gap_count: 0,
    },
    validator_acceptance_reference: clone(validator),
    review_accounting: clone(contract.review_accounting_exact_values),
    withheld_work3_fields: clone(DIVIDENDS_WORK3_WITHHELD_FIELDS),
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

function dividendsWork3ValidatePacket(envelope) {
  dividendsWork3ValidatePinnedEnvelope(
    envelope,
    DIVIDENDS_WORK3_PACKET_BINDING,
    'Dividends inventory packet',
  );
  const record = envelope.record;
  const items = record.profile_review_items;
  if (
    record.profile_count !== DIVIDENDS_PROFILE_COUNT
    || record.complete_profile_count !== DIVIDENDS_PROFILE_COUNT
    || record.incomplete_profile_count !== 0
    || record.retained_source_gap_count !== 0
    || !Array.isArray(items)
    || items.length !== DIVIDENDS_PROFILE_COUNT
    || items.some((item) => typeof item.shape_summary !== 'string' || item.shape_summary === '')
    || items.filter((item) => item.review_flags.includes(
      DIVIDENDS_REVIEW_FLAGS.LEGAL_GROUPING,
    )).length !== DIVIDENDS_PROFILE_COUNT
    || items.filter((item) => item.review_flags.includes(
      DIVIDENDS_REVIEW_FLAGS.SUBTYPE_DIVERGENCE,
    )).length !== DIVIDENDS_SUBTYPE_DIVERGENCE_PROFILE_COUNT
    || items.filter((item) => item.review_flags.includes(
      DIVIDENDS_REVIEW_FLAGS.OUTSIDE_CALIBRATION,
    )).length !== DIVIDENDS_OUTSIDE_CALIBRATION_PROFILE_COUNT
  ) {
    fail(
      DIVIDENDS_WORK3_CODES.INVENTORY,
      'Dividends inventory packet census drift.',
    );
  }
  return record;
}

function dividendsWork3ValidateDisposition(envelope) {
  dividendsWork3ValidatePinnedEnvelope(
    envelope,
    DIVIDENDS_WORK3_DISPOSITION_BINDING,
    'Dividends Ben disposition',
  );
  const record = envelope.record;
  const rows = record.profile_dispositions;
  const summary = record.session_summary;
  if (
    record.reviewer !== 'BEN_GOODCHILD'
    || record.default_disposition_applied !== true
    || record.packet_digest !== DIVIDENDS_WORK3_PACKET_BINDING.sha256
    || record.ben_rulings_digest !== DIVIDENDS_WORK3_RULINGS_BINDING.sha256
    || !Array.isArray(rows)
    || rows.length !== DIVIDENDS_PROFILE_COUNT
    || rows.filter((row) => row.disposition === 'APPROVE').length
      !== DIVIDENDS_PROFILE_COUNT
    || summary.approved_count !== DIVIDENDS_PROFILE_COUNT
    || summary.hold_count !== 0
    || summary.legal_grouping_review_pending_count !== DIVIDENDS_PROFILE_COUNT
    || summary.subtype_partition_divergence_count
      !== DIVIDENDS_SUBTYPE_DIVERGENCE_PROFILE_COUNT
    || summary.outside_calibration_example_count
      !== DIVIDENDS_OUTSIDE_CALIBRATION_PROFILE_COUNT
    || summary.subtype_grouping_pending_legal !== true
    || summary.taxonomy_expansion_acknowledged !== true
  ) {
    fail(
      DIVIDENDS_WORK3_CODES.DISPOSITION,
      'Dividends Ben inventory disposition drift.',
    );
  }
  return record;
}

function prepareDividendsWork3BenInventorySessionDisposition(input) {
  const evidenceKeys = [
    'work3DividendsUnapprovedInventoryReviewAuthority',
    'work3DividendsBenInventorySessionSuccessorAuthority',
    'inventoryReviewPacketDraft',
    'benAuthoredInventoryDisposition',
  ];
  const evidence = dividendsWork3ValidateInput(
    input,
    [
      'dividendsWork3BenInventorySessionDispositionEvidence',
      'dividendsPhase4ReviewInput',
    ],
    'dividendsWork3BenInventorySessionDispositionEvidence',
    evidenceKeys,
  );
  const authorityEnvelope = dividendsWork3ValidatePinnedEnvelope(
    evidence.work3DividendsBenInventorySessionSuccessorAuthority,
    DIVIDENDS_WORK3_BEN_AUTHORITY_BINDING,
    'Dividends Ben inventory authority',
  );
  dividendsWork3ValidatePacket(evidence.inventoryReviewPacketDraft);
  const disposition = dividendsWork3ValidateDisposition(
    evidence.benAuthoredInventoryDisposition,
  );
  const inventory = prepareDividendsWork3UnapprovedInventoryReview({
    dividendsWork3UnapprovedInventoryReviewEvidence: {
      work3DividendsUnapprovedInventoryReviewAuthority:
        evidence.work3DividendsUnapprovedInventoryReviewAuthority,
    },
    dividendsPhase4ReviewInput: input.dividendsPhase4ReviewInput,
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
      path: DIVIDENDS_WORK3_DISPOSITION_BINDING.path,
      inventory_disposition_id: disposition.inventory_disposition_id,
      packet_digest: disposition.packet_digest,
      profile_disposition_count: DIVIDENDS_PROFILE_COUNT,
      session_summary: clone(disposition.session_summary),
    },
    packet_binding: clone(DIVIDENDS_WORK3_PACKET_BINDING),
    ben_rulings_binding: clone(DIVIDENDS_WORK3_RULINGS_BINDING),
    session_receipt_reference: {
      schema_version: DIVIDENDS_WORK3_SESSION_BINDING.schema_version,
      ben_inventory_session_receipt_id: disposition.session_receipt_id,
      completion_state: 'COMPLETE',
    },
    review_accounting: clone(contract.review_accounting_exact_values),
    withheld_work3_fields: clone(DIVIDENDS_WORK3_WITHHELD_FIELDS),
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

function dividendsWork3ValidateSessionReceipt(envelope) {
  dividendsWork3ValidatePinnedEnvelope(
    envelope,
    DIVIDENDS_WORK3_SESSION_BINDING,
    'Dividends Ben session receipt',
  );
  const record = envelope.record;
  if (
    record.completion_state !== 'COMPLETE'
    || record.disposition_binding.inventory_disposition_id
      !== DIVIDENDS_WORK3_DISPOSITION_BINDING.record_id
    || record.zero_effect_boundary.work3_identity_count !== 0
  ) {
    fail(
      DIVIDENDS_WORK3_CODES.RECEIPT,
      'Dividends Ben session receipt drift.',
    );
  }
  return record;
}

function prepareDividendsWork3FamilyPackageSeal(input) {
  const evidenceKeys = [
    'work3DividendsUnapprovedInventoryReviewAuthority',
    'work3DividendsBenInventorySessionSuccessorAuthority',
    'work3DividendsFamilyPackageSealSuccessorAuthority',
    'inventoryReviewPacketDraft',
    'benAuthoredInventoryDisposition',
    'benInventorySessionReceipt',
  ];
  const evidence = dividendsWork3ValidateInput(
    input,
    [
      'dividendsWork3FamilyPackageSealEvidence',
      'dividendsPhase4ReviewInput',
    ],
    'dividendsWork3FamilyPackageSealEvidence',
    evidenceKeys,
  );
  const authorityEnvelope = dividendsWork3ValidatePinnedEnvelope(
    evidence.work3DividendsFamilyPackageSealSuccessorAuthority,
    DIVIDENDS_WORK3_SEAL_AUTHORITY_BINDING,
    'Dividends family package seal authority',
  );
  const dispositionCandidate = prepareDividendsWork3BenInventorySessionDisposition({
    dividendsWork3BenInventorySessionDispositionEvidence: {
      work3DividendsUnapprovedInventoryReviewAuthority:
        evidence.work3DividendsUnapprovedInventoryReviewAuthority,
      work3DividendsBenInventorySessionSuccessorAuthority:
        evidence.work3DividendsBenInventorySessionSuccessorAuthority,
      inventoryReviewPacketDraft: evidence.inventoryReviewPacketDraft,
      benAuthoredInventoryDisposition: evidence.benAuthoredInventoryDisposition,
    },
    dividendsPhase4ReviewInput: input.dividendsPhase4ReviewInput,
  });
  dividendsWork3ValidateSessionReceipt(evidence.benInventorySessionReceipt);
  if (
    dispositionCandidate.session_receipt_reference.ben_inventory_session_receipt_id
      !== evidence.benInventorySessionReceipt.record.ben_inventory_session_receipt_id
  ) {
    fail(
      DIVIDENDS_WORK3_CODES.RECEIPT,
      'Dividends session receipt identity drift.',
    );
  }
  const contract = authorityEnvelope.record.schema_review_candidate_contract;
  const unsigned = {
    schema_version: contract.schema_version,
    candidate_state: contract.candidate_state,
    authority_binding: clone(authorityEnvelope.binding),
    inventory_session_disposition_reference: {
      inventory_disposition_id: DIVIDENDS_WORK3_DISPOSITION_BINDING.record_id,
      candidate_state: dispositionCandidate.candidate_state,
    },
    ben_rulings_binding: clone(DIVIDENDS_WORK3_RULINGS_BINDING),
    disposition_binding: clone(DIVIDENDS_WORK3_DISPOSITION_BINDING),
    session_receipt_binding: clone(DIVIDENDS_WORK3_SESSION_BINDING),
    legal_grouping_disposition_binding: {
      ...clone(DIVIDENDS_WORK3_RULINGS_BINDING),
      disposition_status: 'PENDING_LEGAL_REVIEW',
      legal_grouping_review_pending_count: DIVIDENDS_PROFILE_COUNT,
      outside_calibration_example_count: DIVIDENDS_OUTSIDE_CALIBRATION_PROFILE_COUNT,
      populated_subtype_bucket_count: DIVIDENDS_POPULATED_SUBTYPE_BUCKET_COUNT,
      registered_subtype_bucket_count: DIVIDENDS_REGISTERED_SUBTYPE_BUCKET_COUNT,
      subtype_partition_divergence_count: DIVIDENDS_SUBTYPE_DIVERGENCE_PROFILE_COUNT,
    },
    review_accounting: clone(contract.review_accounting_exact_values),
    withheld_work3_fields: clone(DIVIDENDS_WORK3_WITHHELD_FIELDS),
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

function dividendsWork3ValidateSealReceipt(envelope) {
  dividendsWork3ValidatePinnedEnvelope(
    envelope,
    DIVIDENDS_WORK3_SEAL_RECEIPT_BINDING,
    'Dividends family seal receipt',
  );
  const record = envelope.record;
  if (
    record.completion_state !== 'COMPLETE'
    || record.reviewer !== 'BEN_GOODCHILD'
    || record.disposition_binding.record_id
      !== DIVIDENDS_WORK3_DISPOSITION_BINDING.record_id
    || record.legal_grouping_disposition_binding.disposition_status !== 'PENDING_LEGAL_REVIEW'
    || record.zero_effect_boundary.work3_identity_count !== 0
  ) {
    fail(
      DIVIDENDS_WORK3_CODES.RECEIPT,
      'Dividends family seal receipt drift.',
    );
  }
  return record;
}

function prepareDividendsWork3FamilyPackageRegistration(input) {
  const evidenceKeys = [
    'work3DividendsUnapprovedInventoryReviewAuthority',
    'work3DividendsBenInventorySessionSuccessorAuthority',
    'work3DividendsFamilyPackageSealSuccessorAuthority',
    'work3DividendsRegistrationSuccessorAuthority',
    'inventoryReviewPacketDraft',
    'benAuthoredInventoryDisposition',
    'benInventorySessionReceipt',
    'familyPackageSealReceipt',
  ];
  const evidence = dividendsWork3ValidateInput(
    input,
    [
      'dividendsWork3FamilyPackageRegistrationEvidence',
      'dividendsPhase4ReviewInput',
    ],
    'dividendsWork3FamilyPackageRegistrationEvidence',
    evidenceKeys,
  );
  const authorityEnvelope = dividendsWork3ValidatePinnedEnvelope(
    evidence.work3DividendsRegistrationSuccessorAuthority,
    DIVIDENDS_WORK3_REGISTRATION_AUTHORITY_BINDING,
    'Dividends registration authority',
  );
  const sealCandidate = prepareDividendsWork3FamilyPackageSeal({
    dividendsWork3FamilyPackageSealEvidence: {
      work3DividendsUnapprovedInventoryReviewAuthority:
        evidence.work3DividendsUnapprovedInventoryReviewAuthority,
      work3DividendsBenInventorySessionSuccessorAuthority:
        evidence.work3DividendsBenInventorySessionSuccessorAuthority,
      work3DividendsFamilyPackageSealSuccessorAuthority:
        evidence.work3DividendsFamilyPackageSealSuccessorAuthority,
      inventoryReviewPacketDraft: evidence.inventoryReviewPacketDraft,
      benAuthoredInventoryDisposition: evidence.benAuthoredInventoryDisposition,
      benInventorySessionReceipt: evidence.benInventorySessionReceipt,
    },
    dividendsPhase4ReviewInput: input.dividendsPhase4ReviewInput,
  });
  const sealReceipt = dividendsWork3ValidateSealReceipt(
    evidence.familyPackageSealReceipt,
  );
  if (sealReceipt.family_package_seal_id !== sealCandidate.family_package_seal_id) {
    fail(
      DIVIDENDS_WORK3_CODES.RECEIPT,
      'Dividends family seal candidate and receipt identity drift.',
    );
  }
  const phase4 = dividendsWork3Phase4(input.dividendsPhase4ReviewInput);
  const dispositionByKey = new Map(
    evidence.benAuthoredInventoryDisposition.record.profile_dispositions.map(
      (row) => [row.proposed_profile_key, row],
    ),
  );
  const registeredProfiles = phase4.proposed_profiles.map((profile) => {
    const disposition = dispositionByKey.get(profile.proposed_profile_key);
    if (!disposition) {
      fail(
        DIVIDENDS_WORK3_CODES.OUTPUT,
        'Dividends registration disposition missing.',
      );
    }
    const identityInput = {
      family_key: 'DIVIDENDS',
      proposed_profile_key: profile.proposed_profile_key,
      phase3_profile_key: null,
      profile_set_version: 1,
    };
    return {
      profile_id: contentId(
        'M7_V2_DIVIDENDS_WORK3_REGISTERED_PROFILE_IDENTITY/V1',
        identityInput,
      ),
      proposed_profile_key: profile.proposed_profile_key,
      phase3_profile_key: null,
      inventory_disposition: disposition.disposition,
      legal_grouping_pending_acknowledged: disposition.legal_grouping_pending_acknowledged,
    };
  });
  const packageUnsigned = {
    family_key: 'DIVIDENDS',
    profile_set_version: 1,
    package_state: 'BEN_SEALED_IN_MEMORY_REGISTRATION_ONLY',
    profile_id_count: DIVIDENDS_PROFILE_COUNT,
    profile_ids: registeredProfiles.map((profile) => profile.profile_id),
    inventory_disposition_id: DIVIDENDS_WORK3_DISPOSITION_BINDING.record_id,
    family_package_seal_receipt_id: DIVIDENDS_WORK3_SEAL_RECEIPT_BINDING.record_id,
    legal_grouping_disposition_state: 'PENDING_LEGAL_REVIEW',
  };
  const packageIdentity = {
    family_profile_package_id: contentId(
      'M7_V2_DIVIDENDS_WORK3_FAMILY_PROFILE_PACKAGE_IDENTITY/V1',
      packageUnsigned,
    ),
    family_key: packageUnsigned.family_key,
    profile_set_version: 1,
    package_state: packageUnsigned.package_state,
    profile_id_count: DIVIDENDS_PROFILE_COUNT,
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
    family_package_seal_receipt_binding: clone(DIVIDENDS_WORK3_SEAL_RECEIPT_BINDING),
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
      state: 'STOP_AFTER_DIVIDENDS_FAMILY_PACKAGE_REGISTRATION_BEFORE_ACTIVATION',
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
    result.registered_profile_identities.length !== DIVIDENDS_PROFILE_COUNT
    || result.review_accounting.profile_identity_count !== DIVIDENDS_PROFILE_COUNT
    || result.review_accounting.work3_identity_count !== DIVIDENDS_PROFILE_COUNT + 1
    || result.zero_effect_boundary.activation_count !== 0
    || dividendsContainsForbiddenKey(result, new Set(['activation_id']))
  ) {
    fail(
      DIVIDENDS_WORK3_CODES.OUTPUT,
      'Dividends family registration boundary drift.',
    );
  }
  return result;
}

module.exports = {
  DIVIDENDS_OUTSIDE_CALIBRATION_PROFILE_COUNT,
  DIVIDENDS_PHASE2_AUTHORITY_BYTES,
  DIVIDENDS_PHASE2_AUTHORITY_ID,
  DIVIDENDS_PHASE2_AUTHORITY_PATH,
  DIVIDENDS_PHASE2_AUTHORITY_SCHEMA,
  DIVIDENDS_PHASE2_AUTHORITY_SHA256,
  DIVIDENDS_PHASE2_PROPOSAL_CODES,
  DIVIDENDS_PHASE2_PROPOSAL_KEYS,
  DIVIDENDS_PHASE4_AUTHORITY_BYTES,
  DIVIDENDS_PHASE4_AUTHORITY_ID,
  DIVIDENDS_PHASE4_AUTHORITY_PATH,
  DIVIDENDS_PHASE4_AUTHORITY_SCHEMA,
  DIVIDENDS_PHASE4_AUTHORITY_SHA256,
  DIVIDENDS_PHASE4_CANDIDATE_SCHEMA,
  DIVIDENDS_PHASE4_CANDIDATE_STATE,
  DIVIDENDS_PHASE4_REVIEW_CODES,
  DIVIDENDS_PHASE4_REVIEW_INPUT_KEYS,
  DIVIDENDS_PHASE4_REVIEW_OUTPUT_KEYS,
  DIVIDENDS_PHASE4_SCHEDULE_SHA256,
  DIVIDENDS_POPULATED_SUBTYPE_BUCKET_COUNT,
  DIVIDENDS_PROFILE_COUNT,
  DIVIDENDS_REGISTERED_SUBTYPE_BUCKET_COUNT,
  DIVIDENDS_REVIEW_FLAGS,
  DIVIDENDS_SUBTYPE_DIVERGENCE_PROFILE_COUNT,
  dividendsProposalPartition,
  prepareDividendsFamilyProfilePackageReview,
  prepareDividendsPhase2FamilyProposal,
  prepareDividendsWork3BenInventorySessionDisposition,
  prepareDividendsWork3FamilyPackageRegistration,
  prepareDividendsWork3FamilyPackageSeal,
  prepareDividendsWork3UnapprovedInventoryReview,
  validateDividendsUnapprovedInventoryReviewEvidence,
};
