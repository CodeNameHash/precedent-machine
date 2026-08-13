'use strict';

const { contentId } = require('./canonical-bytes');

const FAMILY_LABELS = Object.freeze({
  ANTITRUST_REGULATORY: 'Regulatory approvals',
  APPRAISAL_DISSENTERS_RIGHTS: 'Appraisal rights',
  CAPITALISATION: 'Capitalisation',
  CLOSING_CONDITIONS: 'Closing conditions',
  CONSIDERATION: 'Merger consideration',
  DIVIDENDS: 'Dividends',
  DNO_INDEMNIFICATION: 'Directors and officers protection',
  EMPLOYEE_MATTERS: 'Employee matters',
  FINANCING_COVENANTS: 'Financing covenants',
  GENERAL_COVENANTS: 'General covenants',
  GUARANTY_FINANCING_PARTY: 'Guaranty and financing parties',
  INTERIM_OPERATING: 'Interim operating covenants',
  KEY_DEFINED_TERMS: 'Key defined terms',
  MAE_DEFINITION: 'Material adverse effect',
  MATERIAL_CONTRACTS: 'Material contracts',
  MERGER_STRUCTURE_CLOSING: 'Merger structure and closing',
  MISC_BOILERPLATE: 'General provisions',
  NO_OTHER_REPS_FRAUD: 'No other representations and fraud',
  NO_SHOP: 'Deal protection',
  PROXY_MEETING: 'Proxy and stockholder meetings',
  REPRESENTATIONS: 'Representations and warranties',
  SPECIFIC_PERFORMANCE_REMEDIES: 'Specific performance and remedies',
  TAX_MATTERS: 'Tax matters',
  TERMINATION: 'Termination rights',
  TERMINATION_FEE: 'Termination fees',
});

function fail(code, detail) {
  throw new Error(`AGREEMENT_PROJECTION_${code}: ${detail}`);
}

function deepFreeze(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

function firstText(value) {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    for (const item of value) {
      const text = firstText(item);
      if (text) return text;
    }
  }
  if (value && typeof value === 'object') {
    for (const key of ['value', 'raw_value', 'canonical_value']) {
      const text = firstText(value[key]);
      if (text) return text;
    }
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
}

function sectionReference(proposition) {
  for (const member of proposition.roles.MEMBER_FACTS) {
    if (typeof member.attributes?.section_reference === 'string' && member.attributes.section_reference) {
      return member.attributes.section_reference;
    }
  }
  return null;
}

function stableText(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const text = firstText(value);
    if (!text) continue;
    const key = text.replace(/\s+/g, ' ').trim().toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(text.replace(/\s+/g, ' ').trim());
    }
  }
  return result;
}

function ruleTexts(proposition) {
  const authoredFacts = stableText(proposition.roles.MEMBER_FACTS.flatMap((member) => [
    member.raw_value,
    member.canonical_value === true || member.canonical_value === false ? null : member.canonical_value,
  ]));
  if (authoredFacts.length > 0) return authoredFacts;
  return stableText(proposition.roles.LEGAL_EFFECT_OR_MECHANIC.map((effect) =>
    String(effect.claim_definition_key || effect.assertion_kind || '')
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/^./, (letter) => letter.toUpperCase())));
}

function spanInsideAuthoredSource(span, authoredSource) {
  if (!span || !Number.isFinite(span.start_byte) || !Number.isFinite(span.end_byte)) return false;
  return authoredSource.some((source) => {
    const extent = source?.extent_span;
    return extent
      && Number.isFinite(extent.start_byte) && Number.isFinite(extent.end_byte)
      && span.start_byte >= extent.start_byte
      && span.end_byte <= extent.end_byte;
  });
}

function actorTexts(proposition) {
  const memberActors = proposition.roles.MEMBER_FACTS.flatMap((member) => [
    member.party?.value,
    member.party,
    member.capacity,
  ]);
  const authoredActors = stableText(memberActors);
  if (authoredActors.length > 0) return authoredActors.slice(0, 2);
  if (!proposition.required_roles.includes('ACTOR_OR_PARTIES')) return [];
  return stableText(proposition.roles.ACTOR_OR_PARTIES
    .filter((value) => value && typeof value === 'object'
      && value.provenance_kind === 'DIRECT'
      && spanInsideAuthoredSource(value.source_span, proposition.roles.AUTHORED_SOURCE)))
    .slice(0, 1);
}

function supplementaryTexts(values, rules) {
  const ruleKeys = new Set(rules.map((value) => value.toLowerCase()));
  return stableText(values)
    .filter((value) => !ruleKeys.has(value.toLowerCase()))
    .filter((value) => value.length <= 500)
    .slice(0, 3);
}

function compactText(proposition) {
  const rules = ruleTexts(proposition);
  if (rules.length === 0) return 'Rule: Source-backed legal item requires review.';
  const linked = rules.length > 1 ? ` [${rules.length - 1} linked fact${rules.length === 2 ? '' : 's'} in full row]` : '';
  return `Rule: ${rules[0]}${linked}`;
}

function expandedText(proposition) {
  const rules = ruleTexts(proposition);
  const actors = actorTexts(proposition);
  const timing = supplementaryTexts(proposition.roles.TRIGGER_OR_TIMING, rules);
  const qualifications = supplementaryTexts(proposition.roles.QUALIFICATIONS, rules);
  const lines = [];
  for (const rule of rules) lines.push(`Rule: ${rule}`);
  if (actors.length > 0) lines.push(`Applies to: ${actors.join('; ')}`);
  if (timing.length > 0) lines.push(`Timing or trigger: ${timing.join('; ')}`);
  if (qualifications.length > 0) lines.push(`Qualifications: ${qualifications.join('; ')}`);
  return lines.join('\n');
}

function fieldLineage(proposition, fieldKey, value) {
  return {
    field_key: fieldKey,
    value,
    source_compound_proposition_ids: [proposition.compound_proposition_id],
    source_analysis_claim_ids: proposition.member_analysis_claim_ids,
    source_node_occurrence_ids: proposition.source_node_occurrence_ids,
    source_evidence_edge_ids: proposition.source_evidence_edge_ids,
  };
}

function buildRow(proposition) {
  const section = sectionReference(proposition);
  const familyLabel = FAMILY_LABELS[proposition.family_key] || proposition.family_key;
  const fields = [
    fieldLineage(proposition, 'compact_text', compactText(proposition)),
    fieldLineage(proposition, 'expanded_text', expandedText(proposition)),
    fieldLineage(proposition, 'member_facts', proposition.roles.MEMBER_FACTS),
    fieldLineage(proposition, 'actor_or_parties', proposition.roles.ACTOR_OR_PARTIES),
    fieldLineage(proposition, 'trigger_or_timing', proposition.roles.TRIGGER_OR_TIMING),
    fieldLineage(proposition, 'qualifications', proposition.roles.QUALIFICATIONS),
  ];
  const unsigned = {
    agreement_id: proposition.agreement_id,
    family_key: proposition.family_key,
    title: section ? `${familyLabel}, section ${section}` : familyLabel,
    section_reference: section,
    row_state: 'COMPLETE_COMPARISON_ROW',
    grouping_decision: 'SEPARATE_AUTHORED_LEGAL_UNIT',
    source_compound_proposition_id: proposition.compound_proposition_id,
    member_analysis_claim_ids: proposition.member_analysis_claim_ids,
    source_node_occurrence_ids: proposition.source_node_occurrence_ids,
    source_evidence_edge_ids: proposition.source_evidence_edge_ids,
    citations: proposition.roles.AUTHORED_SOURCE.map((source) => ({
      source_node_occurrence_id: source.node_occurrence_id,
      node_kind: source.node_kind,
      source_span: source.extent_span,
      exact_text: source.text,
    })),
    fields,
  };
  return {
    schema_version: 'AGREEMENT_PROJECTION_ROW/V1',
    row_id: contentId('AGREEMENT_PROJECTION_ROW/V1', unsigned),
    ...unsigned,
  };
}

function buildReviewRow(proposition) {
  const unsigned = {
    agreement_id: proposition.agreement_id,
    family_key: proposition.family_key,
    review_state: 'REVIEWABLE_PARTIAL_NOT_A_COMPLETE_LEGAL_ANSWER',
    source_compound_proposition_id: proposition.compound_proposition_id,
    missing_required_roles: proposition.missing_required_roles,
    member_analysis_claim_ids: proposition.member_analysis_claim_ids,
    source_node_occurrence_ids: proposition.source_node_occurrence_ids,
    exact_source_text: expandedText(proposition),
  };
  return {
    schema_version: 'AGREEMENT_PROJECTION_REVIEW_ROW/V1',
    review_row_id: contentId('AGREEMENT_PROJECTION_REVIEW_ROW/V1', unsigned),
    ...unsigned,
  };
}

function viewPolicyFor(familyOrder) {
  if (!Array.isArray(familyOrder) || familyOrder.length !== 25) fail('FAMILY_ORDER', familyOrder?.length);
  const unsigned = {
    approval_state: 'BEN_APPROVED_AND_SEALED',
    ben_approval_id: 'BEN-M6-2026-08-12',
    normal_row_rule: 'COMPLETE_PROPOSITIONS_ONLY',
    partial_rule: 'SEPARATE_CLEARLY_LABELLED_REVIEW_LANE',
    grouping_rule: 'ONE_ROW_PER_AUTHORED_LEGAL_UNIT_NO_CROSS_STANDARD_GROUPING',
    ownership_rule: 'ONE_SEMANTIC_OWNER_WITH_LINKED_CONSUMERS',
    compact_rule: 'PLAIN_LEGAL_WORDS_WITH_ALL_DETAIL_IN_EXPANDED_VIEW',
    citation_rule: 'EXACT_SOURCE_NODE_SPAN_AND_TEXT',
    family_display_policies: familyOrder.map((entry) => ({
      family_key: entry.family_key,
      ordinal: entry.ordinal,
      output_owner: entry.family_key,
      normal_output: entry.family_key === 'CAPITALISATION' ? 'PARKED_NO_CURRENT_PROPOSITIONS' : 'ROW',
      grouping: 'SEPARATE_AUTHORED_LEGAL_UNIT',
    })),
    publication_authorisation: 'NONE',
  };
  return {
    schema_version: 'STAGE_2Y_M6_VIEW_POLICY/V1',
    view_policy_id: contentId('STAGE_2Y_M6_VIEW_POLICY/V1', unsigned),
    ...unsigned,
  };
}

function projectAgreement(analysis, viewPolicy) {
  if (analysis?.schema_version !== 'AGREEMENT_ANALYSIS/V1' || analysis?.m5_correction?.semantic_projection_collection !== 'compound_propositions') {
    fail('ANALYSIS', 'corrected M5 AgreementAnalysis required');
  }
  if (viewPolicy?.schema_version !== 'STAGE_2Y_M6_VIEW_POLICY/V1' || viewPolicy?.approval_state !== 'BEN_APPROVED_AND_SEALED') {
    fail('VIEW_POLICY', 'approved M6 view policy required');
  }
  const policyFamilies = new Set(viewPolicy.family_display_policies.map((entry) => entry.family_key));
  if (policyFamilies.size !== 25) fail('FAMILY_POLICY', policyFamilies.size);
  const rows = [];
  const reviewRows = [];
  const omissions = [];
  for (const proposition of analysis.compound_propositions) {
    if (!policyFamilies.has(proposition.family_key)) fail('UNOWNED_FAMILY', proposition.family_key);
    if (proposition.proposition_validation_state === 'COMPLETE') {
      const row = buildRow(proposition);
      rows.push(row);
      omissions.push({
        compound_proposition_id: proposition.compound_proposition_id,
        normal_row_disposition: 'DISPLAYED',
        compact_omission: 'EXPANDED_VIEW_RETAINS_ALL_MEMBER_FACTS_AND_EXACT_SOURCE',
        material_fact_omitted: false,
        row_id: row.row_id,
      });
    } else {
      const reviewRow = buildReviewRow(proposition);
      reviewRows.push(reviewRow);
      omissions.push({
        compound_proposition_id: proposition.compound_proposition_id,
        normal_row_disposition: 'OMITTED_FROM_NORMAL_COMPARISON',
        omission_reason: 'REVIEWABLE_PARTIAL_NOT_COMPLETE',
        material_fact_omitted: false,
        review_row_id: reviewRow.review_row_id,
      });
    }
  }
  rows.sort((a, b) => a.family_key.localeCompare(b.family_key) || a.row_id.localeCompare(b.row_id));
  reviewRows.sort((a, b) => a.family_key.localeCompare(b.family_key) || a.review_row_id.localeCompare(b.review_row_id));
  omissions.sort((a, b) => a.compound_proposition_id.localeCompare(b.compound_proposition_id));
  const unsigned = {
    agreement_id: analysis.agreement_id,
    agreement_analysis_id: analysis.agreement_analysis_id,
    view_policy_id: viewPolicy.view_policy_id,
    projection_state: 'SHADOW_ONLY_NOT_SERVED',
    rows,
    review_rows: reviewRows,
    omissions,
    counts: {
      compound_proposition_count: analysis.compound_propositions.length,
      normal_row_count: rows.length,
      review_row_count: reviewRows.length,
      omission_ledger_count: omissions.length,
      silent_no_row_count: 0,
      material_fact_omission_count: 0,
    },
  };
  return deepFreeze({
    schema_version: 'AGREEMENT_PROJECTION/V1',
    agreement_projection_id: contentId('AGREEMENT_PROJECTION/V1', unsigned),
    ...unsigned,
  });
}

module.exports = { projectAgreement, viewPolicyFor };
