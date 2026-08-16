'use strict';

const { canonicalJson, contentId } = require('./canonical-bytes');

function isPresent(value) {
  return value !== null && value !== undefined
    && (!(typeof value === 'string') || value.length > 0)
    && (!(Array.isArray(value)) || value.length > 0)
    && (!(typeof value === 'object' && !Array.isArray(value)) || Object.keys(value).length > 0);
}

function firstProfile(schema, claim) {
  const candidates = schema.subtype_profiles.filter((profile) => profile.claim_definition_keys.includes(claim.claim_definition_key));
  if (candidates.length === 0) return null;
  const keyTokens = claim.claim_definition_key.split('_');
  return candidates.find((profile) => {
    const subtype = profile.profile_id.split('::')[1];
    return subtype.split('_').every((token) => keyTokens.includes(token));
  }) || candidates[0];
}

function evidenceFor(baseAnalysis, claim) {
  return baseAnalysis.evidence_edges
    .filter((edge) => edge.analysis_claim_id === claim.analysis_claim_id)
    .sort((a, b) => a.ordinal - b.ordinal);
}

function legacyValues(claim) {
  const legacy = claim.legacy_claim_revision || {};
  const attributes = { ...(legacy.attributes || {}) };
  delete attributes.answer_provenance;
  delete attributes.assertion_kind;
  return {
    LEGAL_ACTOR_OR_SUBJECT: claim.legacy_party || claim.legacy_capacity || legacy.party || legacy.capacity || null,
    LEGAL_OPERATION: legacy.attributes?.assertion_kind || legacy.taxonomy_codes?.assertion_kind || claim.claim_definition_key,
    OPERATIVE_OBJECT: isPresent(legacy.raw_value) ? legacy.raw_value : legacy.canonical_value,
    TEMPORAL_OR_TRIGGER_SCOPE: [legacy.applicability, legacy.day_basis, legacy.unit].filter(isPresent),
    QUALIFICATIONS: isPresent(claim.legacy_resolution_state) && (isPresent(legacy.scope) || Object.keys(attributes).length > 0)
      ? { scope: legacy.scope || null, attributes }
      : null,
  };
}

function existingCompleteValues(baseAnalysis, claim) {
  if (claim.proposition_validation_state !== 'COMPLETE') return null;
  const roles = baseAnalysis.roles.filter((role) => role.analysis_claim_id === claim.analysis_claim_id).sort((a, b) => a.ordinal - b.ordinal);
  if (roles.length < 5) return null;
  return {
    LEGAL_ACTOR_OR_SUBJECT: roles[0].normalised_value,
    LEGAL_OPERATION: roles[1].normalised_value,
    OPERATIVE_OBJECT: roles[2].normalised_value,
    TEMPORAL_OR_TRIGGER_SCOPE: roles[3].normalised_value,
    QUALIFICATIONS: roles.slice(4).map((role) => ({ role_key: role.role_key, value: role.normalised_value })),
  };
}

function roleRecord(claim, profile, roleDefinition, value, evidenceEdges, ordinal, schema) {
  const provenance = evidenceEdges.map((edge) => ({
    evidence_edge_id: edge.analysis_evidence_edge_id,
    source_node_occurrence_id: edge.source_node_occurrence_id,
    source_span: edge.source_span,
    source_role: edge.evidence_role,
  }));
  const payload = {
    analysis_claim_id: claim.analysis_claim_id,
    family_role_schema_id: schema.family_role_schema_id,
    profile_id: profile.profile_id,
    role_key: roleDefinition.role_key,
    ordinal,
    normalised_value: value,
    provenance,
  };
  return {
    schema_version: 'STAGE_2Y_M5_FAMILY_ROLE/V1',
    family_role_id: contentId('STAGE_2Y_M5_FAMILY_ROLE/V1', payload),
    ...payload,
  };
}

function adaptClaim(baseAnalysis, claim, schema) {
  const profile = firstProfile(schema, claim);
  if (!profile) {
    return {
      schema_version: 'STAGE_2Y_M5_PROPOSITION_VALIDATION/V1',
      analysis_claim_id: claim.analysis_claim_id,
      family: claim.family,
      claim_definition_key: claim.claim_definition_key,
      profile_id: null,
      validation_state: 'MISSING_REQUIRED_ROLE',
      missing_required_roles: ['APPROVED_PROFILE'],
      roles: [],
      source_evidence_edge_ids: claim.evidence_edge_ids,
      diagnostic_codes: ['NO_APPROVED_PROFILE_FOR_CLAIM_DEFINITION'],
    };
  }
  const evidenceEdges = evidenceFor(baseAnalysis, claim);
  const values = existingCompleteValues(baseAnalysis, claim) || legacyValues(claim);
  const roles = [];
  const missing = [];
  for (const [ordinal, roleDefinition] of profile.required_roles.entries()) {
    const value = values[roleDefinition.role_key];
    if (!isPresent(value) || evidenceEdges.length === 0 || evidenceEdges.some((edge) => edge.source_bytes_match !== true)) {
      missing.push(roleDefinition.role_key);
      continue;
    }
    roles.push(roleRecord(claim, profile, roleDefinition, value, evidenceEdges, ordinal, schema));
  }
  const state = missing.length === 0 ? 'COMPLETE' : 'MISSING_REQUIRED_ROLE';
  return {
    schema_version: 'STAGE_2Y_M5_PROPOSITION_VALIDATION/V1',
    analysis_claim_id: claim.analysis_claim_id,
    family: claim.family,
    claim_definition_key: claim.claim_definition_key,
    profile_id: profile.profile_id,
    validation_state: state,
    missing_required_roles: missing,
    roles,
    source_evidence_edge_ids: evidenceEdges.map((edge) => edge.analysis_evidence_edge_id),
    diagnostic_codes: state === 'COMPLETE' ? [] : ['MISSING_REQUIRED_ROLE'],
  };
}

function adaptFamily(baseAnalysis, familyTask) {
  if (!baseAnalysis || baseAnalysis.schema_version !== 'AGREEMENT_ANALYSIS/V1') throw new TypeError('baseAnalysis must be AGREEMENT_ANALYSIS/V1');
  if (!familyTask || familyTask.schema_version !== 'STAGE_2Y_FAMILY_ADAPTER_TASK/V1') throw new TypeError('familyTask must be STAGE_2Y_FAMILY_ADAPTER_TASK/V1');
  const { family_key: familyKey, approved_role_schema: schema } = familyTask;
  if (schema.family_key !== familyKey || schema.approval_state !== 'BEN_APPROVED_AND_SEALED') throw new TypeError('family task requires the matching approved role schema');
  const claims = baseAnalysis.claims.filter((claim) => claim.family === familyKey);
  const validations = claims.map((claim) => adaptClaim(baseAnalysis, claim, schema));
  const result = {
    schema_version: 'STAGE_2Y_FAMILY_ADAPTER_RESULT/V1',
    family_adapter_result_id: null,
    family_key: familyKey,
    agreement_id: baseAnalysis.agreement_id,
    base_analysis_id: baseAnalysis.agreement_analysis_id,
    approved_role_schema_id: schema.family_role_schema_id,
    claim_count: claims.length,
    complete_count: validations.filter((entry) => entry.validation_state === 'COMPLETE').length,
    missing_required_role_count: validations.filter((entry) => entry.validation_state === 'MISSING_REQUIRED_ROLE').length,
    validations,
  };
  result.family_adapter_result_id = contentId(result.schema_version, Object.fromEntries(Object.entries(result).filter(([key]) => key !== 'family_adapter_result_id')));
  return result;
}

module.exports = { adaptFamily };
