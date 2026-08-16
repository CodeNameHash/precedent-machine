'use strict';

const { createHash } = require('node:crypto');

const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');
const { generateAnalysisV2 } = require('./m7-v2-deterministic-generator');

const FAMILY_RESULT_SCHEMA = 'STAGE_2Y_FAMILY_ADAPTER_RESULT/V1';
const FAMILY_ROLE_SCHEMA = 'STAGE_2Y_FAMILY_REQUIRED_ROLE_SCHEMA/V1';
const AGREEMENT_ANALYSIS_SCHEMA = 'AGREEMENT_ANALYSIS/V1';
const AGREEMENT_ANALYSIS_SET_SCHEMA = 'AGREEMENT_ANALYSIS_SET/V1';
const CONTEXT_COMPILATION_SCHEMA = 'CONTEXT_COMPILATION/V1';
const CONTEXT_COMPILATION_SET_SCHEMA = 'CONTEXT_COMPILATION_SET/V1';
const AGREEMENT_INDEX_SCHEMA = 'AGREEMENT_INDEX/V1';
const AGREEMENT_INDEX_SET_SCHEMA = 'AGREEMENT_INDEX_SET/V1';
const FAMILY_PACKET_SET_SCHEMA = 'STAGE_2Y_M7_V2_REPAIR_FAMILY_PACKET_SET/V1';
const FAMILY_PROFILE_SET_SCHEMA = 'STAGE_2Y_M7_V2_APPROVED_FAMILY_PROFILE_SET/V1';
const STRUCTURE_DISPOSITION_SET_SCHEMA =
  'STAGE_2Y_M7_V2_STRUCTURE_DISPOSITION_SET/V1';
const SOURCE_BINDING_KEYS = Object.freeze([
  'path',
  'schema_version',
  'record_id_field',
  'record_id',
  'byte_length',
  'sha256',
  'git_blob_oid',
]);
const HEX_256 = /^[0-9a-f]{64}$/u;
const HEX_160 = /^[0-9a-f]{40}$/u;

function fail(code, detail) {
  throw new Error(`AGREEMENT_ANALYSIS_CONSOLIDATION_${code}: ${detail}`);
}

function recordId(schemaVersion, idMember, unsigned) {
  return { schema_version: schemaVersion, [idMember]: contentId(schemaVersion, unsigned), ...unsigned };
}

function deepFreeze(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

function exactKeys(value, keys, code, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || Object.keys(value).sort().join('\0') !== [...keys].sort().join('\0')) {
    fail(code, `${label} has invalid members`);
  }
}

function gitBlobOid(bytes) {
  return createHash('sha1')
    .update(Buffer.from(`blob ${bytes.length}\0`, 'utf8'))
    .update(bytes)
    .digest('hex');
}

function validateSourceEntry(entry, schemaVersion, idField, label) {
  exactKeys(entry, ['record', 'binding'], 'SOURCE_ENTRY', label);
  const { record, binding } = entry;
  if (!record || typeof record !== 'object' || Array.isArray(record)
      || record.schema_version !== schemaVersion
      || typeof record[idField] !== 'string'
      || !HEX_256.test(record[idField])) {
    fail('SOURCE_RECORD', `${label} has an invalid record envelope`);
  }
  const unsigned = structuredClone(record);
  delete unsigned[idField];
  if (contentId(schemaVersion, unsigned) !== record[idField]) {
    fail('SOURCE_RECORD', `${label} has an invalid content ID`);
  }

  exactKeys(binding, SOURCE_BINDING_KEYS, 'SOURCE_BINDING', `${label}.binding`);
  const bytes = Buffer.from(`${canonicalJson(record)}\n`, 'utf8');
  if (typeof binding.path !== 'string' || binding.path.length === 0
      || binding.path.startsWith('/') || binding.path.split('/').includes('..')
      || binding.schema_version !== schemaVersion
      || binding.record_id_field !== idField
      || binding.record_id !== record[idField]
      || binding.byte_length !== bytes.length
      || binding.sha256 !== sha256Hex(bytes)
      || !HEX_256.test(binding.sha256)
      || binding.git_blob_oid !== gitBlobOid(bytes)
      || !HEX_160.test(binding.git_blob_oid)) {
    fail('SOURCE_BINDING', `${label} does not match its canonical record bytes`);
  }
  return { record, binding };
}

function validateAgreementIndexEntry(entry, label) {
  exactKeys(entry, ['record', 'binding'], 'SOURCE_ENTRY', label);
  const { record, binding } = entry;
  if (!record || typeof record !== 'object' || Array.isArray(record)
      || record.schema_version !== AGREEMENT_INDEX_SCHEMA
      || typeof record.agreement_index_id !== 'string'
      || !HEX_256.test(record.agreement_index_id)) {
    fail('SOURCE_RECORD', `${label} has an invalid record envelope`);
  }
  const expectedId = contentId(AGREEMENT_INDEX_SCHEMA, {
    agreement_id: record.source_binding?.agreement_id,
    canonical_text_id: record.source_binding?.canonical_text_id,
    structural_policy_digest: record.structural_policy?.policy_digest,
    root_node_occurrence_id: record.root_node_occurrence_id,
    counts: record.counts,
    node_set_digest: contentId('AGREEMENT_INDEX_NODE_SET/V1', record.nodes),
    annotation_set_digest: contentId(
      'AGREEMENT_INDEX_ANNOTATION_SET/V1', record.annotations,
    ),
    source_artefact_set_digest: contentId(
      'AGREEMENT_INDEX_SOURCE_ARTEFACT_SET/V1', record.source_artefacts,
    ),
    alias_set_digest: contentId('AGREEMENT_INDEX_ALIAS_SET/V1', record.aliases),
    ambiguity_set_digest: contentId(
      'AGREEMENT_INDEX_AMBIGUITY_SET/V1', record.ambiguities,
    ),
    diagnostic_set_digest: contentId(
      'AGREEMENT_INDEX_DIAGNOSTIC_SET/V1', record.diagnostics,
    ),
    inline_marker_disposition_set_digest: contentId(
      'AGREEMENT_INDEX_INLINE_MARKER_DISPOSITION_SET/V1',
      record.inline_marker_dispositions,
    ),
    inline_marker_partition_proof_digest: record.inline_marker_partition?.proof_digest,
    byte_coverage_proof_digest: record.byte_coverage?.proof_digest,
  });
  if (expectedId !== record.agreement_index_id) {
    fail('SOURCE_RECORD', `${label} has an invalid native AgreementIndex content ID`);
  }
  exactKeys(binding, SOURCE_BINDING_KEYS, 'SOURCE_BINDING', `${label}.binding`);
  const bytes = Buffer.from(`${canonicalJson(record)}\n`, 'utf8');
  if (typeof binding.path !== 'string' || binding.path.length === 0
      || binding.path.startsWith('/') || binding.path.split('/').includes('..')
      || binding.schema_version !== AGREEMENT_INDEX_SCHEMA
      || binding.record_id_field !== 'agreement_index_id'
      || binding.record_id !== record.agreement_index_id
      || binding.byte_length !== bytes.length
      || binding.sha256 !== sha256Hex(bytes)
      || !HEX_256.test(binding.sha256)
      || binding.git_blob_oid !== gitBlobOid(bytes)
      || !HEX_160.test(binding.git_blob_oid)) {
    fail('SOURCE_BINDING', `${label} does not match its canonical record bytes`);
  }
  return { record, binding };
}

function bindingForRecord(path, record, idField) {
  const bytes = Buffer.from(`${canonicalJson(record)}\n`, 'utf8');
  return {
    path,
    schema_version: record.schema_version,
    record_id_field: idField,
    record_id: record[idField],
    byte_length: bytes.length,
    sha256: sha256Hex(bytes),
    git_blob_oid: gitBlobOid(bytes),
  };
}

function assertSameBinding(actual, expected, label) {
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    fail('GOVERNANCE_BINDING', `${label} does not match verified governance`);
  }
}

function sealSet(schemaVersion, idField, members) {
  const unsigned = { schema_version: schemaVersion, members };
  return { ...unsigned, [idField]: contentId(schemaVersion, unsigned) };
}

function buildSourceSets(input) {
  exactKeys(input, ['baseAnalyses', 'contextCompilations'], 'SOURCE_INPUT', 'input');
  if (!Array.isArray(input.baseAnalyses) || input.baseAnalyses.length === 0
      || !Array.isArray(input.contextCompilations)
      || input.contextCompilations.length !== input.baseAnalyses.length) {
    fail('SOURCE_INPUT', 'source arrays must be non-empty and have equal length');
  }

  const contextsById = new Map();
  for (const [index, entry] of input.contextCompilations.entries()) {
    const selected = validateSourceEntry(
      entry, CONTEXT_COMPILATION_SCHEMA, 'context_compilation_id',
      `contextCompilations[${index}]`,
    );
    const contextId = selected.record.context_compilation_id;
    if (contextsById.has(contextId)) fail('SOURCE_INPUT', `duplicate context ${contextId}`);
    contextsById.set(contextId, selected);
  }

  const seenAgreementIds = new Set();
  const usedContextIds = new Set();
  const paired = input.baseAnalyses.map((entry, index) => {
    const base = validateSourceEntry(
      entry, AGREEMENT_ANALYSIS_SCHEMA, 'agreement_analysis_id', `baseAnalyses[${index}]`,
    );
    const agreementId = base.record.agreement_id;
    const nativeContextBinding = base.record.context_compilation_binding;
    if (typeof agreementId !== 'string' || !HEX_256.test(agreementId)
        || !nativeContextBinding || typeof nativeContextBinding !== 'object') {
      fail('SOURCE_INPUT', `baseAnalyses[${index}] has an invalid agreement identity`);
    }
    if (seenAgreementIds.has(agreementId)) {
      fail('SOURCE_INPUT', `duplicate agreement ${agreementId}`);
    }
    seenAgreementIds.add(agreementId);

    const context = contextsById.get(nativeContextBinding.context_compilation_id);
    if (!context || usedContextIds.has(context.record.context_compilation_id)
        || nativeContextBinding.agreement_id !== agreementId
        || nativeContextBinding.agreement_index_id
          !== context.record.agreement_index_binding?.agreement_index_id
        || nativeContextBinding.path !== context.binding.path
        || nativeContextBinding.schema_version !== context.binding.schema_version
        || nativeContextBinding.context_compilation_id !== context.binding.record_id
        || nativeContextBinding.byte_length !== context.binding.byte_length
        || nativeContextBinding.sha256 !== context.binding.sha256) {
      fail('SOURCE_INPUT', `baseAnalyses[${index}] does not bind one exact context compilation`);
    }
    usedContextIds.add(context.record.context_compilation_id);
    return { agreementId, base, context };
  }).sort((left, right) => left.agreementId.localeCompare(right.agreementId));

  if (usedContextIds.size !== contextsById.size) {
    fail('SOURCE_INPUT', 'one or more context compilations are unbound');
  }

  const agreementAnalysisSet = sealSet(
    AGREEMENT_ANALYSIS_SET_SCHEMA,
    'agreement_analysis_set_id',
    paired.map(({ agreementId, base }) => ({
      agreement_id: agreementId,
      agreement_analysis_binding: structuredClone(base.binding),
    })),
  );
  const contextCompilationSet = sealSet(
    CONTEXT_COMPILATION_SET_SCHEMA,
    'context_compilation_set_id',
    paired.map(({ agreementId, context }) => ({
      agreement_id: agreementId,
      context_compilation_binding: structuredClone(context.binding),
    })),
  );
  return deepFreeze({ agreementAnalysisSet, contextCompilationSet });
}

function consolidateAnalysis(input) {
  exactKeys(input, [
    'baseAnalysis',
    'agreementIndex',
    'contextCompilation',
    'approvedFamilyPackets',
    'approvedFamilyProfileSet',
    'approvedStructureDispositions',
    'governance',
  ], 'V2_INPUT', 'input');
  const baseAnalysis = validateSourceEntry(
    input.baseAnalysis, AGREEMENT_ANALYSIS_SCHEMA, 'agreement_analysis_id', 'baseAnalysis',
  );
  const agreementIndex = validateAgreementIndexEntry(input.agreementIndex, 'agreementIndex');
  const contextCompilation = validateSourceEntry(
    input.contextCompilation, CONTEXT_COMPILATION_SCHEMA, 'context_compilation_id',
    'contextCompilation',
  );
  const approvedFamilyPackets = validateSourceEntry(
    input.approvedFamilyPackets, FAMILY_PACKET_SET_SCHEMA, 'family_packet_set_id',
    'approvedFamilyPackets',
  );
  const approvedFamilyProfileSet = validateSourceEntry(
    input.approvedFamilyProfileSet, FAMILY_PROFILE_SET_SCHEMA, 'family_profile_set_id',
    'approvedFamilyProfileSet',
  );
  const approvedStructureDispositions = validateSourceEntry(
    input.approvedStructureDispositions, STRUCTURE_DISPOSITION_SET_SCHEMA,
    'structure_disposition_set_id', 'approvedStructureDispositions',
  );
  const governance = input.governance;
  if (!governance || typeof governance !== 'object' || Array.isArray(governance)
      || !Array.isArray(governance.semantic_input_bindings)) {
    fail('GOVERNANCE', 'verified governance is missing its semantic input bindings');
  }
  const governedBindings = new Map(governance.semantic_input_bindings.map((entry) => [
    entry.role, entry.binding,
  ]));
  if (governedBindings.size !== 6) {
    fail('GOVERNANCE', 'verified governance must bind the exact six semantic inputs');
  }

  const sourceSets = buildSourceSets({
    baseAnalyses: [baseAnalysis],
    contextCompilations: [contextCompilation],
  });
  const agreementAnalysisSetBinding = bindingForRecord(
    governedBindings.get('BASE_ANALYSIS_SET')?.path,
    sourceSets.agreementAnalysisSet,
    'agreement_analysis_set_id',
  );
  const contextCompilationSetBinding = bindingForRecord(
    governedBindings.get('CONTEXT_COMPILATION_SET')?.path,
    sourceSets.contextCompilationSet,
    'context_compilation_set_id',
  );
  const secondaryIndexBindings = approvedStructureDispositions.record.members.flatMap(
    (member) => member.inline_list_overlay?.agreement_index_binding === undefined
      ? [] : [member.inline_list_overlay.agreement_index_binding],
  );
  const indexMembers = [agreementIndex.binding, ...secondaryIndexBindings].filter(
    (binding, index, values) => values.findIndex(
      (candidate) => candidate.path === binding.path
        && candidate.record_id === binding.record_id,
    ) === index,
  ).sort((left, right) => left.path.localeCompare(right.path));
  const agreementIndexSet = sealSet(
    AGREEMENT_INDEX_SET_SCHEMA, 'agreement_index_set_id', indexMembers,
  );
  const agreementIndexSetBinding = bindingForRecord(
    governedBindings.get('AGREEMENT_INDEX_SET')?.path,
    agreementIndexSet,
    'agreement_index_set_id',
  );
  assertSameBinding(
    agreementAnalysisSetBinding, governedBindings.get('BASE_ANALYSIS_SET'),
    'BASE_ANALYSIS_SET',
  );
  assertSameBinding(
    agreementIndexSetBinding, governedBindings.get('AGREEMENT_INDEX_SET'),
    'AGREEMENT_INDEX_SET',
  );
  assertSameBinding(
    contextCompilationSetBinding, governedBindings.get('CONTEXT_COMPILATION_SET'),
    'CONTEXT_COMPILATION_SET',
  );
  assertSameBinding(
    approvedFamilyPackets.binding, governedBindings.get('APPROVED_FAMILY_PACKET_SET'),
    'APPROVED_FAMILY_PACKET_SET',
  );
  assertSameBinding(
    approvedFamilyProfileSet.binding,
    governedBindings.get('APPROVED_FAMILY_PROFILE_SET'),
    'APPROVED_FAMILY_PROFILE_SET',
  );
  assertSameBinding(
    approvedStructureDispositions.binding,
    governedBindings.get('APPROVED_STRUCTURE_DISPOSITION_SET'),
    'APPROVED_STRUCTURE_DISPOSITION_SET',
  );
  assertSameBinding(
    approvedFamilyProfileSet.binding, governance.family_profile_set_binding,
    'family_profile_set_binding',
  );
  assertSameBinding(
    approvedStructureDispositions.binding, governance.structure_disposition_set_binding,
    'structure_disposition_set_binding',
  );
  if (approvedFamilyPackets.record.state
        !== 'LEGAL_EVIDENCE_ORACLE_NOT_EXECUTABLE_PROFILE_AUTHORITY'
      || approvedFamilyProfileSet.record.state !== 'BEN_APPROVED_PROFILE_SET'
      || approvedStructureDispositions.record.state
        !== 'BEN_APPROVED_STRUCTURE_DISPOSITION_SET') {
    fail('AUTHORITY_STATE', 'one or more approved input sets has an invalid state');
  }
  return generateAnalysisV2({
    baseAnalysis: cloneForGenerator(baseAnalysis.record),
    agreementIndex: withBinding(agreementIndex),
    contextCompilation: cloneForGenerator(contextCompilation.record),
    approvedFamilyPackets: cloneForGenerator(approvedFamilyPackets.record),
    approvedFamilyProfileSet: withBinding(approvedFamilyProfileSet),
    approvedStructureDispositions: cloneForGenerator(
      approvedStructureDispositions.record,
    ),
    governance: cloneForGenerator(governance),
  });
}

function cloneForGenerator(value) {
  return structuredClone(value);
}

function withBinding(entry) {
  return { ...cloneForGenerator(entry.record), __binding: cloneForGenerator(entry.binding) };
}

function roleDefinition(schema, validation, role) {
  const profile = schema.subtype_profiles.find((candidate) => candidate.profile_id === validation.profile_id);
  const definition = profile?.required_roles.find((candidate) => candidate.role_key === role.role_key);
  if (!definition) fail('ROLE_NOT_APPROVED', `${validation.analysis_claim_id}:${role.role_key}`);
  return definition;
}

function convertRole(role, validation, schema) {
  const definition = roleDefinition(schema, validation, role);
  const provenance = role.provenance.map((source) => recordId(
    'AGREEMENT_ANALYSIS_ROLE_PROVENANCE/V1',
    'role_provenance_id',
    {
      role_id: role.family_role_id,
      provenance_kind: 'DIRECT',
      source_node_occurrence_id: source.source_node_occurrence_id,
      source_spans: [source.source_span],
      context_fact_ids: [],
      scope_edge_ids: [],
      reference_edge_ids: [],
      definition_edge_ids: [],
      semantic_relationship_ids: [],
      derivation_rule_id: schema.approval_id,
      derivation_rule_version: 1,
    },
  ));
  const sourceSpans = provenance.flatMap((entry) => entry.source_spans);
  const unsignedRole = {
    analysis_claim_id: role.analysis_claim_id,
    required_role_schema_id: schema.family_role_schema_id,
    role_key: role.role_key,
    role_type: definition.value_type,
    ordinal: role.ordinal,
    normalised_value: structuredClone(role.normalised_value),
    source_spans: sourceSpans,
  };
  const roleId = contentId('AGREEMENT_ANALYSIS_ROLE/V1', unsignedRole);
  for (const entry of provenance) entry.role_id = roleId;
  for (const entry of provenance) {
    const unsigned = structuredClone(entry);
    delete unsigned.role_provenance_id;
    delete unsigned.schema_version;
    entry.role_provenance_id = contentId(entry.schema_version, unsigned);
  }
  return {
    role: {
      schema_version: 'AGREEMENT_ANALYSIS_ROLE/V1',
      role_id: roleId,
      analysis_claim_id: role.analysis_claim_id,
      required_role_schema_id: schema.family_role_schema_id,
      role_key: role.role_key,
      role_type: definition.value_type,
      ordinal: role.ordinal,
      cardinality_state: definition.cardinality,
      normalised_value: structuredClone(role.normalised_value),
      validation_state: 'SATISFIED',
      provenance_ids: provenance.map((entry) => entry.role_provenance_id),
      dependency_edge_ids: [],
    },
    provenance,
  };
}

function consolidateLegacyAnalysisV1(baseAnalysis, approvedFamilyPackets) {
  if (baseAnalysis?.schema_version !== 'AGREEMENT_ANALYSIS/V1') fail('BASE_SCHEMA', baseAnalysis?.schema_version);
  if (!Array.isArray(approvedFamilyPackets) || approvedFamilyPackets.length === 0) fail('PACKETS', 'empty');

  const packetByFamily = new Map();
  const validationByClaim = new Map();
  for (const packet of approvedFamilyPackets) {
    const schema = packet?.approved_role_schema;
    const result = packet?.adapter_result;
    if (schema?.schema_version !== FAMILY_ROLE_SCHEMA || schema.approval_state !== 'BEN_APPROVED_AND_SEALED') {
      fail('SCHEMA', packet?.family_key);
    }
    if (schema.family_key !== packet.family_key || packetByFamily.has(packet.family_key)) fail('FAMILY', packet.family_key);
    if (result !== null && (result?.schema_version !== FAMILY_RESULT_SCHEMA
      || result.family_key !== packet.family_key
      || result.agreement_id !== baseAnalysis.agreement_id
      || result.base_analysis_id !== baseAnalysis.agreement_analysis_id
      || result.approved_role_schema_id !== schema.family_role_schema_id)) {
      fail('RESULT_BINDING', packet.family_key);
    }
    packetByFamily.set(packet.family_key, packet);
    for (const validation of result?.validations || []) {
      if (validationByClaim.has(validation.analysis_claim_id)) fail('DUPLICATE_CLAIM', validation.analysis_claim_id);
      validationByClaim.set(validation.analysis_claim_id, { validation, schema });
    }
  }

  const claims = [];
  const roles = [];
  const provenance = [];
  const validations = [];
  for (const baseClaim of baseAnalysis.claims) {
    const governed = validationByClaim.get(baseClaim.analysis_claim_id);
    if (!governed) fail('MISSING_CLAIM_RESULT', baseClaim.analysis_claim_id);
    if (governed.validation.family !== baseClaim.family) fail('CLAIM_FAMILY', baseClaim.analysis_claim_id);
    const converted = governed.validation.roles.map((role) => convertRole(role, governed.validation, governed.schema));
    roles.push(...converted.map((entry) => entry.role));
    provenance.push(...converted.flatMap((entry) => entry.provenance));
    const complete = governed.validation.validation_state === 'COMPLETE';
    const ordered = converted.map((entry) => ({
      role_key: entry.role.role_key,
      role_type: entry.role.role_type,
      normalised_value: structuredClone(entry.role.normalised_value),
    }));
    const completeProposition = complete ? {
      profile_id: governed.validation.profile_id,
      ordered_role_semantic_payloads: ordered,
    } : null;
    const completeRevision = complete ? contentId('COMPLETE_PROPOSITION_CLAIM_REVISION/V1', {
      claim_occurrence_id: baseClaim.claim_occurrence_id,
      claim_definition_key: baseClaim.claim_definition_key,
      claim_definition_version: baseClaim.claim_definition_version,
      profile_id: governed.validation.profile_id,
      ordered_role_semantic_payloads: ordered,
    }) : null;
    claims.push({
      ...structuredClone(baseClaim),
      complete_proposition_claim_revision_id: completeRevision,
      proposition_validation_state: governed.validation.validation_state,
      required_role_schema_id: governed.schema.family_role_schema_id,
      projection_eligibility: 'BLOCKED',
      projection_block_reason: complete ? 'M6_NOT_STARTED' : 'MISSING_REQUIRED_ROLE',
      role_ids: converted.map((entry) => entry.role.role_id),
      complete_proposition: completeProposition,
      diagnostic_codes: [...new Set([
        ...(baseClaim.diagnostic_codes || []),
        ...governed.validation.diagnostic_codes,
      ])].sort(),
    });
    const requiredRoleStates = governed.schema.subtype_profiles
      .find((profile) => profile.profile_id === governed.validation.profile_id)?.required_roles.map((definition) => ({
        role_key: definition.role_key,
        validation_state: governed.validation.missing_required_roles.includes(definition.role_key)
          ? 'MISSING_REQUIRED_ROLE' : 'SATISFIED',
      })) || [];
    validations.push(recordId('PROPOSITION_VALIDATION_RESULT/V1', 'validation_result_id', {
      analysis_claim_id: baseClaim.analysis_claim_id,
      required_role_schema_id: governed.schema.family_role_schema_id,
      scenario: 'BASELINE',
      removed_role_key: null,
      required_role_states: requiredRoleStates,
      missing_role_keys: [...governed.validation.missing_required_roles],
      unresolved_role_keys: [],
      proposition_validation_state: governed.validation.validation_state,
      projection_eligible: false,
      renderable: false,
    }));
  }
  if (validationByClaim.size !== baseAnalysis.claims.length) fail('EXTRA_CLAIM_RESULT', validationByClaim.size);

  const completeCount = claims.filter((claim) => claim.proposition_validation_state === 'COMPLETE').length;
  const missingCount = claims.length - completeCount;
  const unsigned = {
    ...structuredClone(baseAnalysis),
    agreement_analysis_id: undefined,
    claims,
    roles,
    role_provenance: provenance,
    proposition_validation_results: validations,
    m5_consolidation: {
      schema_version: 'STAGE_2Y_M5_ANALYSIS_CONSOLIDATION/V1',
      base_analysis_id: baseAnalysis.agreement_analysis_id,
      applied_family_results: approvedFamilyPackets.map((packet) => ({
        family_key: packet.family_key,
        family_role_schema_id: packet.approved_role_schema.family_role_schema_id,
        family_adapter_result_id: packet.adapter_result?.family_adapter_result_id || null,
        claim_count: packet.adapter_result?.claim_count || 0,
      })),
      complete_count: completeCount,
      missing_required_role_count: missingCount,
      current_product_effects: 0,
      m6_started: false,
    },
    counts: {
      ...structuredClone(baseAnalysis.counts),
      pending_claim_count: 0,
      schema_approval_pending_claim_count: 0,
      complete_claim_count: completeCount,
      missing_required_role_claim_count: missingCount,
      role_count: roles.length,
      role_provenance_count: provenance.length,
      baseline_validation_count: validations.length,
      role_deletion_validation_count: 0,
    },
  };
  delete unsigned.agreement_analysis_id;
  return deepFreeze(recordId('AGREEMENT_ANALYSIS/V1', 'agreement_analysis_id', unsigned));
}

module.exports = { buildSourceSets, consolidateAnalysis, consolidateLegacyAnalysisV1 };
