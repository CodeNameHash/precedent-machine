'use strict';

const { contentId } = require('./canonical-bytes');

const FAMILY_RESULT_SCHEMA = 'STAGE_2Y_FAMILY_ADAPTER_RESULT/V1';
const FAMILY_ROLE_SCHEMA = 'STAGE_2Y_FAMILY_REQUIRED_ROLE_SCHEMA/V1';

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

function consolidateAnalysis(baseAnalysis, approvedFamilyPackets) {
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

module.exports = { consolidateAnalysis };
