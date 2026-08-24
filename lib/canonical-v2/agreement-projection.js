'use strict';

const {
  canonicalJson,
  contentId,
  sha256Hex,
} = require('./canonical-bytes');
const {
  validatedAnalysisResultForProjection,
  validateProjectionV2,
  validateViewPolicyBindingForProjection,
  validateViewPolicyForProjection,
} = require('./m7-v2-contract');

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
    .replace(/\bDno\b/gi, 'D&O')
    .replace(/\bHsr\b/gi, 'HSR')
    .replace(/\bMae\b/gi, 'MAE')
    .replace(/\bFirpta\b/gi, 'FIRPTA')
    .replace(/\bCvr\b/gi, 'CVR')
    .replace(/\bSec\b/gi, 'SEC')
    .replace(/\bGaap\b/gi, 'GAAP')
    .replace(/\bDgcl\b/gi, 'DGCL')
    .replace(/\bIoc\b/gi, 'Interim operating')
    .replace(/\bTpb\b/gi, 'third-party beneficiary')
    .replace(/\bUsd\b/gi, 'USD')
    .replace(/ present$/i, '');
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
  IOC_RESTRICTION_PRESENT: 'Interim operating restriction',
  MATERIAL_CONTRACT_BUCKET_PRESENT: 'Material contract category',
  FINANCING_OBTAIN_EFFORTS_STANDARD: 'Efforts to obtain financing',
  MEETING_ADJOURNMENT_REASON: 'Reasons the meeting may be adjourned',
  NOTICE: 'Notice procedure',
  NO_FINANCING_CONDITION_ACKNOWLEDGMENT: 'Closing is not conditional on financing',
  NO_SHOP_PROHIBITED_ACTION: 'Actions prohibited by the no-shop covenant',
  NO_SHOP_RECOMMENDATION_CHANGE_TRIGGER: 'When the board may change its recommendation',
  NO_SHOP_RECOMMENDATION_SAFE_DISCLOSURE: 'Disclosure that does not change the board recommendation',
  BOARD_RECOMMENDATION_INCLUSION: 'Board recommendation must be included',
  SPECIFIC_PERFORMANCE: 'Specific performance',
  TAX_TREATMENT_PROTECTION_COVENANT: 'Covenant to protect the intended tax treatment',
  TPB_EXCEPTION: 'Third-party beneficiary exception',
  WAIVER_OR_SURVIVAL: 'Waiver or survival provision',
});

function comparisonPointTexts(proposition) {
  const representationTopics = stableText(proposition.roles.MEMBER_FACTS
    .flatMap((member) => member.attributes?.representation_topics || []));
  if (proposition.family_key === 'REPRESENTATIONS' && representationTopics.length > 0) {
    return representationTopics.map((topic) => `Representation: ${humaniseKey(topic)}`);
  }
  const memberValues = (key) => stableText(proposition.roles.MEMBER_FACTS
    .map((member) => member.attributes?.[key]));
  if (proposition.claim_definition_keys.includes('EMPLOYEE_COMP_ITEM_STANDARD')) {
    const items = memberValues('comp_item');
    if (items.length > 0) return items.map((item) => `Employee compensation: ${structuredValue(item)}`);
  }
  if (proposition.claim_definition_keys.includes('GENERAL_COVENANT_PRESENT')) {
    const owners = memberValues('owner_id');
    if (owners.length > 0) return owners.map((owner) =>
      `${structuredValue(owner).replace(/ covenants?$/i, '')} covenant`);
  }
  if (proposition.claim_definition_keys.includes('IOC_RESTRICTION_PRESENT')) {
    const categories = memberValues('restriction_category');
    if (categories.length > 0) return categories.map((category) =>
      `Interim operating restriction: ${structuredValue(category)}`);
  }
  if (proposition.claim_definition_keys.includes('MATERIAL_CONTRACT_BUCKET_PRESENT')) {
    const buckets = memberValues('bucket_code');
    if (buckets.length > 0) return buckets.map((bucket) => `Material contract category: ${structuredValue(bucket)}`);
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
  'bucket_code',
  'carveback_source_form',
  'clause_label',
  'comp_item',
  'covenant_code',
  'definition_head_quote',
  'fee_side',
  'inherited_party_from_provision_instance_id',
  'limb_path',
  'obligor_party_scope',
  'owner_id',
  'prong_label',
  'restriction_category',
  'section_reference',
  'proposed_canonical_value',
  'container_node_occurrence_id',
  'context_chapeau_node_occurrence_id',
  'representation_topic_state',
  'representation_topic_unclassified_reason',
  'representation_topics',
  'terminating_party_scope',
  'threshold_kind',
]);

const ATTRIBUTE_LABELS = Object.freeze({
  action_code: 'Action',
  aggregation: 'How compared',
  applies_to_clause_labels: 'Applies to',
  benchmark: 'Baseline',
  bucket_code: 'Contract type',
  carveout_code: 'Carve-out',
  comparison_baseline_phrase: 'Compared with',
  definition_subject: 'Defined party',
  exclusion_code: 'Exclusion',
  financing_kind: 'Financing type',
  incremental_impact_phrase: 'Effect counted',
  knowledge_party: 'Whose knowledge',
  limb_quote: 'Definition wording',
  owner_id: 'Covenant type',
  party_making: 'Representing party',
  payer_party: 'Payer',
  prerequisite_code: 'Requirement',
  prong_code: 'MAE prong',
  qualifier_code: 'Qualifier',
  reason_code: 'Reason',
  reason_kind: 'Reason',
  right_holder_party: 'Party with the right',
  source_code: 'Source type',
  standard_kind: 'Standard',
  standard_code: 'Standard',
  terminating_party: 'Party that may terminate',
  threshold_value: 'Threshold',
  trigger_kind: 'Trigger',
});

const STRUCTURED_VALUE_LABELS = Object.freeze({
  ACTS_OF_WAR_TERRORISM: 'War or terrorism',
  CHANGE_IN_GAAP: 'Change in GAAP',
  ECONOMY_GENERAL: 'General economic conditions',
  ENCOURAGE_ACQUISITION_INQUIRY_PROPOSAL_OR_OFFER: 'Encourage an acquisition proposal or inquiry',
  EXCLUSIVITY_MFN: 'Exclusivity and MFN terms',
  FACILITATE_ACQUISITION_INQUIRY_PROPOSAL_OR_OFFER: 'Facilitate an acquisition proposal or inquiry',
  FINANCIAL_MARKETS: 'Financial markets',
  INITIATE_ACQUISITION_INQUIRY_PROPOSAL_OR_OFFER: 'Initiate an acquisition proposal or inquiry',
  ITEM_BY_ITEM: 'Each item separately',
  LISTING_DELISTING_COVENANTS: 'Stock exchange listing and delisting',
  SOLICIT_ACQUISITION_INQUIRY_PROPOSAL_OR_OFFER: 'Solicit an acquisition proposal or inquiry',
  TARGET_PRE_CLOSING: 'Target compensation immediately before closing',
  UNSPECIFIED: 'Not stated',
});

function structuredValue(value) {
  if (typeof value === 'string') {
    if (!value.trim() || value.length > 120) return null;
    if (/^[a-f0-9]{24,}$/i.test(value)) return null;
    if (STRUCTURED_VALUE_LABELS[value]) return STRUCTURED_VALUE_LABELS[value];
    return /^[A-Z][A-Z0-9_-]+$/.test(value)
      ? humaniseKey(value.replace(/-/g, '_'))
      : value.trim();
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
        || (key.endsWith('_id') && key !== 'owner_id')
        || key.endsWith('_ref')
        || key.endsWith('_parse_version')
        || key.startsWith('source_')) return [];
      const rendered = structuredValue(value);
      return rendered ? [`${ATTRIBUTE_LABELS[key] || humaniseKey(key)}: ${rendered}`] : [];
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

function viewPolicyForLegacyV1(familyOrder) {
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

function projectLegacyAgreementV1(analysis, viewPolicy) {
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

function failV2(code, detail) {
  const error = new TypeError(`${code}: ${detail}`);
  error.code = code;
  throw error;
}

function indexBy(values, key, label) {
  if (!Array.isArray(values)) failV2('M7_V2_SCHEMA', `${label} must be an array`);
  const indexed = new Map();
  for (const value of values) {
    const id = value?.[key];
    if (typeof id !== 'string' || id.length === 0 || indexed.has(id)) {
      failV2('M7_V2_SCHEMA', `${label} has an invalid or duplicate ${key}`);
    }
    indexed.set(id, value);
  }
  return indexed;
}

function v2TitleEnum(value) {
  return value.toLowerCase().split('_')
    .map((word, index) => index === 0 ? word[0].toUpperCase() + word.slice(1) : word)
    .join(' ');
}

function renderV2Fact(fact, formatterId) {
  if (fact.value_type === 'PARTY_SET' && formatterId === 'party-set-v1') {
    return fact.typed_value.parties.join('; ');
  }
  if (fact.value_type === 'PARTY' && formatterId === 'string-v1') {
    return fact.typed_value;
  }
  if (fact.value_type === 'ENUM' && formatterId === 'enum-title-v1') {
    return v2TitleEnum(fact.typed_value);
  }
  if (['DEFINED_TERM', 'REFERENCE'].includes(fact.value_type)
      && formatterId === 'string-v1') {
    return fact.typed_value;
  }
  if (fact.value_type === 'NUMBER' && formatterId === 'number-v1') {
    return String(fact.typed_value);
  }
  if (fact.value_type === 'PERCENTAGE' && formatterId === 'percentage-v1') {
    return `${fact.typed_value}%`;
  }
  if (fact.value_type === 'MONEY' && formatterId === 'money-v1') {
    return `${fact.typed_value.currency} ${fact.typed_value.amount}`;
  }
  if (fact.value_type === 'DATE' && formatterId === 'date-iso-v1') {
    return fact.typed_value;
  }
  if (fact.value_type === 'BOOLEAN' && formatterId === 'yes-no-v1') {
    return fact.typed_value ? 'Yes' : 'No';
  }
  if ((fact.value_type === 'DURATION' || fact.value_type === 'PERIOD')
      && formatterId === 'duration-v1') {
    const bound = v2TitleEnum(fact.typed_value.bound_type);
    const unit = fact.typed_value.unit.toLowerCase();
    return `${bound} ${fact.typed_value.count} ${unit}${fact.typed_value.count === 1 ? '' : 's'}`;
  }
  failV2('M7_V2_RENDER_RECONCILIATION',
    `no deterministic formatter is registered for ${fact.value_type}`);
}

function v2Classification(rule, facts, profile) {
  const parties = rule.applies_to_fact_ids.map((factId) => facts.get(factId)).map((fact) => {
    if (fact?.value_type === 'PARTY') return fact.typed_value;
    if (fact?.value_type === 'PARTY_SET') return fact.typed_value.parties.join('; ');
    failV2('M7_V2_LAYOUT_RECONCILIATION',
      'classification has no proved applies-to value');
  });
  if (parties.length === 0) {
    failV2('M7_V2_LAYOUT_RECONCILIATION',
      'classification has no proved applies-to value');
  }
  return [
    { level: 'APPLIES_TO', value: parties.join('; ') },
    ...profile.classification_path.map((value, index) => ({
      level: index === 0 ? 'PROVISION_TYPE'
        : index === 1 ? 'SUB_PROVISION_TYPE'
          : index === 2 ? 'NESTED_SUBTYPE' : `NESTED_SUBTYPE_${index - 1}`,
      value,
    })),
  ];
}

function v2RenderBinding(fact, fieldKey, labelId, layoutId, formatterId,
  ownershipLinkId = null) {
  const renderedValue = renderV2Fact(fact, formatterId);
  return {
    fact_id: fact.fact_id,
    ownership_link_id: ownershipLinkId,
    field_key: fieldKey,
    label_id: labelId,
    typed_value_digest: sha256Hex(canonicalJson(fact.typed_value)),
    rendered_value: renderedValue,
    rendered_value_digest: sha256Hex(renderedValue),
    layout_id: layoutId,
  };
}

function projectAgreement(analysis, viewPolicy) {
  if (arguments.length !== 2) {
    failV2('M7_V2_INPUT_CONSUMPTION',
      'projectAgreement accepts only analysis and view policy');
  }
  if (analysis?.schema_version !== 'AGREEMENT_ANALYSIS/V2') {
    failV2('M7_V2_SCHEMA', 'projectAgreement requires AGREEMENT_ANALYSIS/V2');
  }

  const analysisValidation = validatedAnalysisResultForProjection(analysis);
  validateViewPolicyForProjection(viewPolicy);
  validateViewPolicyBindingForProjection(analysis, viewPolicy);

  const facts = indexBy(analysis.facts, 'fact_id', 'analysis facts');
  const profiles = indexBy(analysis.profile_snapshots, 'profile_id', 'analysis profiles');
  const rules = indexBy(analysis.rules, 'rule_id', 'analysis rules');
  const ownershipLinks = indexBy(
    analysis.ownership_links, 'link_id', 'analysis ownership links',
  );
  const dispositions = indexBy(
    analysis.dispositions, 'input_occurrence_id', 'analysis dispositions',
  );
  const formatterByType = new Map(viewPolicy.formatters.map(
    (entry) => [entry.value_type, entry.formatter_id],
  ));
  const labelByField = new Map(viewPolicy.labels.map(
    (entry) => [entry.field_key, entry],
  ));
  const rows = analysis.rules.filter(
    (rule) => ['NORMAL', 'APPROVED_LIMITED'].includes(
      rule.validation.output_disposition,
    ),
  ).map((rule) => {
    const profile = profiles.get(rule.profile_id);
    if (!profile) failV2('M7_V2_LAYOUT_RECONCILIATION', 'row profile is absent');
    const classificationLevels = v2Classification(rule, facts, profile);
    const orderedFacts = rule.fact_ids.map((factId) => facts.get(factId)).sort(
      (left, right) => profile.display_order.indexOf(left.field_key)
        - profile.display_order.indexOf(right.field_key),
    );
    const delegatedEntries = profile.excluded_or_delegated_dimensions.filter(
      (dimension) => dimension.disposition === 'DELEGATED',
    ).map((dimension) => {
      const matches = [...ownershipLinks.values()].filter((link) => {
        const ownerFact = facts.get(link.owner_fact_id);
        const ownerRule = rules.get(link.owner_rule_id);
        return link.consumer_rule_id === rule.rule_id
          && ownerFact?.field_key === dimension.owner_field_key
          && ownerRule?.profile_id === dimension.owner_profile_id;
      });
      const label = labelByField.get(dimension.dimension_key);
      if (matches.length !== 1 || !label) {
        failV2('M7_V2_LAYOUT_RECONCILIATION',
          `delegated field ${dimension.dimension_key} has no exact owner or label`);
      }
      const link = matches[0];
      return {
        fact: facts.get(link.owner_fact_id),
        field_key: dimension.dimension_key,
        label_id: label.label_id,
        ownership_link_id: link.link_id,
      };
    });
    const layouts = viewPolicy.layouts.map((layout) => {
      const omissionRuleId = layout.permitted_omission_rule_ids[0] ?? null;
      const omissionPermitted = omissionRuleId !== null;
      const requiredFields = new Set(layout.required_field_keys);
      const omittedFacts = orderedFacts.filter((fact) => {
        if (fact.display_rule === 'NEVER_DISPLAY') {
          if (!omissionPermitted || requiredFields.has(fact.field_key)) {
            failV2('M7_V2_LAYOUT_RECONCILIATION',
              `layout ${layout.layout_id} cannot account for NEVER_DISPLAY fact ${fact.fact_id}`);
          }
          return true;
        }
        return fact.display_rule === 'DISPLAY_OPTIONAL'
          && fact.materiality === 'NON_MATERIAL'
          && omissionPermitted
          && !requiredFields.has(fact.field_key);
      });
      const omittedIds = new Set(omittedFacts.map((fact) => fact.fact_id));
      const renderedEntries = [
        ...orderedFacts.filter((fact) => !omittedIds.has(fact.fact_id)).map((fact) => ({
          fact,
          field_key: fact.field_key,
          label_id: fact.label_id,
          ownership_link_id: null,
        })),
        ...delegatedEntries,
      ].sort((left, right) => profile.display_order.indexOf(left.field_key)
        - profile.display_order.indexOf(right.field_key));
      return {
        layout_id: layout.layout_id,
        classification_levels: structuredClone(classificationLevels),
        render_bindings: renderedEntries.map((entry) => v2RenderBinding(
          entry.fact,
          entry.field_key,
          entry.label_id,
          layout.layout_id,
          formatterByType.get(entry.fact.value_type),
          entry.ownership_link_id,
        )),
        omission_ledger: omittedFacts.map((fact) => ({
          fact_id: fact.fact_id,
          omission_rule_id: omissionRuleId,
        })),
      };
    });
    const disposition = dispositions.get(rule.input_occurrence_id);
    const proofs = disposition.absence_proofs.filter((proof) => proof.rule_id === rule.rule_id);
    const sourceLimitation = rule.validation.output_disposition === 'APPROVED_LIMITED' ? {
      text: 'Not expressly stated in the complete reviewed clause',
      source_closure_id: disposition.source_closure_id,
      authored_unit_id: disposition.authored_unit_id,
      field_keys: [...new Set(proofs.map((proof) => proof.field_key))].sort(),
      lawyer_ruling_ids: [...new Set(proofs.map((proof) => proof.lawyer_ruling_id))].sort(),
    } : null;
    const unsigned = {
      rule_id: rule.rule_id,
      disposition_id: disposition.disposition_id,
      output_disposition: rule.validation.output_disposition,
      classification_levels: structuredClone(classificationLevels),
      equivalence_signature: structuredClone(rule.equivalence_signature),
      source_limitation: sourceLimitation,
      group_id: null,
      layouts,
    };
    return {
      row_id: contentId('AGREEMENT_PROJECTION_ROW/V2', unsigned),
      ...unsigned,
    };
  });
  const reviewRows = analysis.dispositions.filter(
    (disposition) => disposition.output_disposition === 'REVIEW_ONLY',
  ).map((disposition) => ({
    disposition_id: disposition.disposition_id,
    input_occurrence_id: disposition.input_occurrence_id,
    rule_ids: structuredClone(disposition.rule_ids),
    issues: structuredClone(disposition.issues),
  }));
  const nonOutputDispositions = [
    ...analysis.rules.filter(
      (rule) => rule.validation.output_disposition === 'NO_COMPARISON',
    ).map((rule) => ({
      disposition_id: dispositions.get(rule.input_occurrence_id).disposition_id,
      input_occurrence_id: rule.input_occurrence_id,
      rule_id: rule.rule_id,
      output_disposition: 'NO_COMPARISON',
    })),
    ...analysis.dispositions.filter(
      (disposition) => disposition.output_disposition === 'NO_OUTPUT',
    ).map((disposition) => ({
      disposition_id: disposition.disposition_id,
      input_occurrence_id: disposition.input_occurrence_id,
      rule_id: null,
      output_disposition: 'NO_OUTPUT',
    })),
  ];
  const unsigned = {
    agreement_id: analysis.agreement_id,
    agreement_analysis_id: analysis.agreement_analysis_id,
    analysis_validation: analysisValidation,
    view_policy_id: viewPolicy.view_policy_id,
    view_policy_binding: structuredClone(analysis.governance.view_policy_binding),
    rows,
    review_rows: reviewRows,
    non_output_dispositions: nonOutputDispositions,
    disposition_ledger: structuredClone(analysis.dispositions),
    counts: {
      normal_rows: rows.length,
      review_rows: reviewRows.length,
      non_output_dispositions: nonOutputDispositions.length,
      disposition_records: analysis.dispositions.length,
    },
  };
  const projection = deepFreeze({
    schema_version: 'AGREEMENT_PROJECTION/V2',
    agreement_projection_id: contentId('AGREEMENT_PROJECTION/V2', unsigned),
    ...unsigned,
  });
  validateProjectionV2({ projection, analysis, viewPolicy });
  return projection;
}

module.exports = {
  projectAgreement,
  projectLegacyAgreementV1,
  viewPolicyForLegacyV1,
};
