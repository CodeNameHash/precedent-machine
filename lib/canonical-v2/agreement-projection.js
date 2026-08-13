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
    if (typeof member.attributes?.source_reference === 'string' && member.attributes.source_reference) {
      return member.attributes.source_reference;
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

function humaniseKey(value) {
  const text = String(value || '')
    .replace(/^M7_DETERMINISTIC_/, '')
    .replace(/_SOURCE_PROVISION$/, '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^./, (letter) => letter.toUpperCase());
  return text
    .replace(/\bDno\b/g, 'D&O')
    .replace(/\bHsr\b/g, 'HSR')
    .replace(/\bMae\b/g, 'MAE')
    .replace(/\bFirpta\b/g, 'FIRPTA')
    .replace(/\bCvr\b/g, 'CVR')
    .replace(/\bSec\b/g, 'SEC')
    .replace(/\bGaap\b/g, 'GAAP')
    .replace(/\bDgcl\b/g, 'DGCL');
}

const GENERIC_CLAIM_DEFINITION_KEYS = new Set([
  'MERGER_STRUCTURE_MECHANIC_PRESENT',
  'MISC_BOILERPLATE_MECHANIC_PRESENT',
  'SPECIFIC_PERFORMANCE_REMEDY_PRESENT',
]);

const COMPARISON_POINT_LABELS = Object.freeze({
  ACTIONS: 'Closing actions',
  BOARD_DESIGNATION: 'Board designation',
  CLOSING_LOCATION: 'Closing location',
  CLOSING_TIMING: 'Closing timing',
  CONSTRUCTION_OR_EXPENSES: 'Contract interpretation or expenses',
  DIRECTORS: 'Initial directors',
  EFFECTIVE_TIME: 'How the Effective Time is set',
  EFFECTS: 'Legal effects of the merger',
  FORUM_FALLBACK: 'Court and fallback court',
  GOVERNING_LAW: 'Governing law',
  NOTICE: 'Notice procedure',
  SPECIFIC_PERFORMANCE: 'Specific performance',
  TPB_EXCEPTION: 'Third-party beneficiary exception',
  WAIVER_OR_SURVIVAL: 'Waiver or survival provision',
});

function comparisonPointTexts(proposition) {
  const representationTopics = stableText(proposition.roles.MEMBER_FACTS
    .flatMap((member) => member.attributes?.representation_topics || []));
  if (proposition.family_key === 'REPRESENTATIONS' && representationTopics.length > 0) {
    return representationTopics.map((topic) => `Representation: ${humaniseKey(topic)}`);
  }
  return stableText(proposition.roles.LEGAL_EFFECT_OR_MECHANIC.map((effect) => {
    const claimKey = effect.claim_definition_key || '';
    const key = GENERIC_CLAIM_DEFINITION_KEYS.has(claimKey) && effect.assertion_kind
      ? effect.assertion_kind
      : claimKey || effect.assertion_kind || '';
    if (/^M7_DETERMINISTIC_.*_SOURCE_PROVISION$/.test(key)) {
      return FAMILY_LABELS[proposition.family_key] || humaniseKey(proposition.family_key);
    }
    return COMPARISON_POINT_LABELS[key] || humaniseKey(key);
  }));
}

function hasCompleteComparisonPoint(proposition) {
  const genericSourceOnly = proposition.claim_definition_keys.length > 0
    && proposition.claim_definition_keys.every((key) => /^M7_DETERMINISTIC_.*_SOURCE_PROVISION$/.test(key));
  if (!genericSourceOnly) return true;
  return proposition.family_key === 'REPRESENTATIONS'
    && proposition.roles.MEMBER_FACTS.some((member) =>
      Array.isArray(member.attributes?.representation_topics)
      && member.attributes.representation_topics.length > 0);
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
  const memberActors = proposition.roles.MEMBER_FACTS.map((member) =>
    member.party?.value ?? (typeof member.party === 'string' ? member.party : null));
  const authoredActors = stableText(memberActors);
  if (authoredActors.length > 0) return authoredActors.slice(0, 2);
  if (!proposition.required_roles.includes('ACTOR_OR_PARTIES')) return [];
  return stableText(proposition.roles.ACTOR_OR_PARTIES
    .filter((value) => value && typeof value === 'object'
      && value.provenance_kind === 'DIRECT'
      && spanInsideAuthoredSource(value.source_span, proposition.roles.AUTHORED_SOURCE))
    .filter((value) => {
      const text = firstText(value);
      return text && text.length <= 80
        && /^(?:each of |either |both |the )?(?:Parent|Company|Merger Sub|Purchaser|Buyer Parties|Parties|Surviving Corporation|Surviving Company)\b/i.test(text);
    }))
    .slice(0, 1);
}

function supplementaryTexts(values, comparisonPoints) {
  const pointKeys = new Set(comparisonPoints.map((value) => value.toLowerCase()));
  return stableText(values)
    .filter((value) => !pointKeys.has(value.toLowerCase()))
    .filter((value) => value.length <= 160)
    .slice(0, 3);
}

const ATTRIBUTE_EXCLUSIONS = new Set([
  'section_reference',
  'proposed_canonical_value',
  'container_node_occurrence_id',
  'context_chapeau_node_occurrence_id',
  'representation_topic_state',
  'representation_topic_unclassified_reason',
  'representation_topics',
]);

function structuredValue(value) {
  if (typeof value === 'string') {
    if (!value.trim() || value.length > 120) return null;
    return /^[A-Z][A-Z0-9_]+$/.test(value) ? humaniseKey(value) : value.trim();
  }
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value) && value.length <= 6) {
    const members = value.map(structuredValue).filter(Boolean);
    return members.length === value.length ? members.join(', ') : null;
  }
  return null;
}

function attributeTexts(proposition) {
  const facts = proposition.roles.MEMBER_FACTS.flatMap((member) => Object.entries(member.attributes || {})
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([key, value]) => {
      if (ATTRIBUTE_EXCLUSIONS.has(key)
        || key.endsWith('_ref')
        || key.endsWith('_parse_version')
        || key.startsWith('source_')) return [];
      const rendered = structuredValue(value);
      return rendered ? [`${humaniseKey(key)}: ${rendered}`] : [];
    }));
  return stableText(facts).slice(0, 6);
}

function structuredSupplementaryTexts(values, comparisonPoints) {
  const rendered = values
    .filter((value) => !(value && typeof value === 'object'
      && (value.source_span || value.extraction_state)))
    .map((value) => structuredValue(value))
    .filter(Boolean);
  return supplementaryTexts(rendered, comparisonPoints);
}

function compactText(proposition) {
  const points = comparisonPointTexts(proposition);
  if (points.length === 0) return 'Comparison point: Source-backed item requires review.';
  const linked = points.length > 1 ? ` [${points.length - 1} linked point${points.length === 2 ? '' : 's'} in full row]` : '';
  return `Comparison point: ${points[0]}${linked}`;
}

function expandedText(proposition) {
  const points = comparisonPointTexts(proposition);
  const actors = actorTexts(proposition);
  const attributes = attributeTexts(proposition);
  const timing = structuredSupplementaryTexts(proposition.roles.TRIGGER_OR_TIMING, points);
  const qualifications = structuredSupplementaryTexts(proposition.roles.QUALIFICATIONS, points);
  const lines = [];
  if (points.length === 0) lines.push('Comparison point: Source-backed item requires review.');
  else for (const point of points) lines.push(`Comparison point: ${point}`);
  if (actors.length > 0) lines.push(`Applies to: ${actors.join('; ')}`);
  if (attributes.length > 0) lines.push(`Key facts: ${attributes.join('; ')}`);
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

function buildReviewRow(proposition, comparisonPointIncomplete = false) {
  const missingRequiredRoles = comparisonPointIncomplete
    ? [...new Set([...proposition.missing_required_roles, 'COMPARISON_POINT_DETAIL'])]
    : proposition.missing_required_roles;
  const unsigned = {
    agreement_id: proposition.agreement_id,
    family_key: proposition.family_key,
    review_state: 'REVIEWABLE_PARTIAL_NOT_A_COMPLETE_LEGAL_ANSWER',
    source_compound_proposition_id: proposition.compound_proposition_id,
    missing_required_roles: missingRequiredRoles,
    review_reason: comparisonPointIncomplete
      ? 'SOURCE_PROVISION_IDENTIFIED_BUT_SPECIFIC_COMPARISON_POINT_NOT_YET_PROVED'
      : 'LEGAL_PROPOSITION_MISSING_REQUIRED_ROLE',
    section_reference: sectionReference(proposition),
    member_analysis_claim_ids: proposition.member_analysis_claim_ids,
    source_node_occurrence_ids: proposition.source_node_occurrence_ids,
    exact_source_text: proposition.roles.AUTHORED_SOURCE.map((source) => source.text).join('\n\n'),
    proposed_comparison_text: expandedText(proposition),
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
    const comparisonPointIncomplete = proposition.proposition_validation_state === 'COMPLETE'
      && !hasCompleteComparisonPoint(proposition);
    if (proposition.proposition_validation_state === 'COMPLETE' && !comparisonPointIncomplete) {
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
      const reviewRow = buildReviewRow(proposition, comparisonPointIncomplete);
      reviewRows.push(reviewRow);
      omissions.push({
        compound_proposition_id: proposition.compound_proposition_id,
        normal_row_disposition: 'OMITTED_FROM_NORMAL_COMPARISON',
        omission_reason: comparisonPointIncomplete
          ? 'SOURCE_PROVISION_WITHOUT_PROVED_COMPARISON_POINT_DETAIL'
          : 'REVIEWABLE_PARTIAL_NOT_COMPLETE',
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
