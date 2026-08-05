'use strict';

const { canonicalJson, contentId } = require('../canonical-bytes');

const PRODUCT_PARITY_SCHEMA = 'CANONICAL_V2_NO_SHOP_PRODUCT_PARITY/V1';
const PRODUCT_ROW_SCHEMA = 'CANONICAL_V2_NO_SHOP_PRODUCT_ROW/V1';

const CLAIM_PRESENTATION = Object.freeze({
  NO_SHOP_PROHIBITED_ACTION: Object.freeze({
    field_path: 'noShop.prohibitedActions',
    label: 'Prohibited actions',
    value_kind: 'CATEGORICAL',
  }),
  NO_SHOP_EXCEPTION_PREREQUISITE: Object.freeze({
    field_path: 'noShop.exceptionPrerequisites',
    label: 'Exception prerequisites',
    value_kind: 'CATEGORICAL',
  }),
  NO_SHOP_NOTICE_PERIOD_DAYS: Object.freeze({
    field_path: 'noShop.noticePeriodDays',
    label: 'Proposal notice period',
    value_kind: 'DURATION_DAYS',
  }),
  NO_SHOP_INITIAL_MATCH_PERIOD_DAYS: Object.freeze({
    field_path: 'noShop.initialMatchPeriodDays',
    label: 'Initial matching period',
    value_kind: 'DURATION_DAYS',
  }),
  NO_SHOP_SUBSEQUENT_MATCH_PERIOD_DAYS: Object.freeze({
    field_path: 'noShop.subsequentMatchPeriodDays',
    label: 'Subsequent matching period',
    value_kind: 'DURATION_DAYS',
  }),
  NO_SHOP_CEASE_ACTION: Object.freeze({
    field_path: 'noShop.ceaseActions',
    label: 'Cease actions',
    value_kind: 'CATEGORICAL',
  }),
  NO_SHOP_REPRESENTATIVE_CONTROL_STANDARD: Object.freeze({
    field_path: 'noShop.representativeControlStandards',
    label: 'Representative control standard',
    value_kind: 'CATEGORICAL',
  }),
  NO_SHOP_REPRESENTATIVE_BREACH_ATTRIBUTION: Object.freeze({
    field_path: 'noShop.representativeBreachAttribution',
    label: 'Representative breach attribution',
    value_kind: 'BOOLEAN',
  }),
  NO_SHOP_STANDSTILL_ACTION: Object.freeze({
    field_path: 'noShop.standstillActions',
    label: 'Standstill enforcement and waiver',
    value_kind: 'CATEGORICAL',
  }),
  NO_SHOP_FIDUCIARY_ENGAGEMENT_STANDARD: Object.freeze({
    field_path: 'noShop.fiduciaryEngagementStandards',
    label: 'Fiduciary engagement standard',
    value_kind: 'CATEGORICAL',
  }),
  NO_SHOP_RECOMMENDATION_CHANGE_FIDUCIARY_STANDARD: Object.freeze({
    field_path: 'noShop.recommendationChangeFiduciaryStandards',
    label: 'Recommendation-change fiduciary standard',
    value_kind: 'CATEGORICAL',
  }),
  NO_SHOP_RECOMMENDATION_CHANGE_ACTION: Object.freeze({
    field_path: 'noShop.recommendationChangeActions',
    label: 'Recommendation-change actions',
    value_kind: 'CATEGORICAL',
  }),
  NO_SHOP_RECOMMENDATION_CHANGE_TRIGGER: Object.freeze({
    field_path: 'noShop.recommendationChangeTriggers',
    label: 'Recommendation-change triggers',
    value_kind: 'CATEGORICAL',
  }),
  NO_SHOP_RECOMMENDATION_SAFE_DISCLOSURE: Object.freeze({
    field_path: 'noShop.recommendationSafeDisclosures',
    label: 'Recommendation safe disclosures',
    value_kind: 'CATEGORICAL',
  }),
});

const KEY_TERMS_OWNED_DEFINITIONS = Object.freeze([
  'ACQUISITION_PROPOSAL_THRESHOLD_PERCENT',
  'SUPERIOR_PROPOSAL_THRESHOLD_PERCENT',
  'DEFINED_TERM_THRESHOLD_SUBSTITUTION',
  'SUPERIOR_PROPOSAL_QUALIFIER',
]);
const KEY_TERMS_OWNED_CONCEPTS = Object.freeze([
  'DEF-ACQPROPOSAL',
  'DEF-SUPERIOR',
]);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function assertCandidateResult(value, index) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`candidate_results[${index}] must be an object`);
  }
  if (typeof value.governed_deal_key !== 'string' || !value.governed_deal_key) {
    throw new TypeError(`candidate_results[${index}].governed_deal_key must be a string`);
  }
  if (!value.resolution || !Array.isArray(value.resolution.resolved)) {
    throw new TypeError(`candidate_results[${index}].resolution.resolved must be an array`);
  }
}

function comparisonTuple(entry, presentation) {
  const tuple = {
    canonical_value: clone(entry.claim.canonical_value),
  };
  if (presentation.value_kind === 'DURATION_DAYS') {
    const dayKind = entry.claim.attributes?.day_kind;
    if (!['BUSINESS_DAYS', 'CALENDAR_DAYS', 'UNSPECIFIED_DAYS'].includes(dayKind)) {
      throw new TypeError(`${entry.resolved_claim_definition_key} requires a governed day_kind`);
    }
    tuple.day_kind = dayKind;
  }
  return tuple;
}

function buildProductRow(entry, governedDealKey) {
  const presentation = CLAIM_PRESENTATION[entry.resolved_claim_definition_key];
  if (!presentation) return null;
  if (!entry.concept_key?.startsWith('NOSOL-')) {
    throw new TypeError(`${entry.resolved_claim_definition_key} is not owned by a NOSOL concept`);
  }
  if (!entry.claim || entry.claim.state !== 'PRESENT' || !Array.isArray(entry.claim.evidence)
      || entry.claim.evidence.length === 0) {
    throw new TypeError(`${entry.resolved_claim_definition_key} requires a present evidenced claim`);
  }
  const tuple = comparisonTuple(entry, presentation);
  const body = {
    schema_version: PRODUCT_ROW_SCHEMA,
    governed_deal_key: governedDealKey,
    section_reference: entry.section_reference,
    concept_key: entry.concept_key,
    claim_definition_key: entry.resolved_claim_definition_key,
    claim_revision_id: entry.claim.claim_revision_id,
    field_path: presentation.field_path,
    label: presentation.label,
    value_kind: presentation.value_kind,
    canonical_value: clone(entry.claim.canonical_value),
    comparison_tuple: tuple,
    party: clone(entry.party),
    evidence: clone(entry.claim.evidence),
    evidence_text: entry.claim.raw_value,
  };
  return {
    ...body,
    product_row_id: contentId(PRODUCT_ROW_SCHEMA, body),
  };
}

function buildMarketStatistics(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = canonicalJson({
      field_path: row.field_path,
      comparison_tuple: row.comparison_tuple,
    });
    const existing = groups.get(key) || {
      field_path: row.field_path,
      label: row.label,
      value_kind: row.value_kind,
      comparison_tuple: clone(row.comparison_tuple),
      deal_keys: new Set(),
      observation_count: 0,
      product_row_ids: [],
    };
    existing.deal_keys.add(row.governed_deal_key);
    existing.observation_count += 1;
    existing.product_row_ids.push(row.product_row_id);
    groups.set(key, existing);
  }
  return [...groups.values()].map((group) => ({
    field_path: group.field_path,
    label: group.label,
    value_kind: group.value_kind,
    comparison_tuple: group.comparison_tuple,
    deal_count: group.deal_keys.size,
    observation_count: group.observation_count,
    product_row_ids: group.product_row_ids.sort(),
  })).sort((left, right) => (
    left.field_path.localeCompare(right.field_path)
    || canonicalJson(left.comparison_tuple).localeCompare(canonicalJson(right.comparison_tuple))
  ));
}

function compileNoShopProductParity({ candidate_results: candidateResults } = {}) {
  if (!Array.isArray(candidateResults) || candidateResults.length === 0) {
    throw new TypeError('candidate_results must be a non-empty array');
  }
  candidateResults.forEach(assertCandidateResult);
  const dealKeys = candidateResults.map((entry) => entry.governed_deal_key);
  if (new Set(dealKeys).size !== dealKeys.length) {
    throw new TypeError('candidate_results must contain one resolution per governed deal');
  }
  const rows = candidateResults.flatMap(({ governed_deal_key: governedDealKey, resolution }) => (
    resolution.resolved.map((entry) => buildProductRow(entry, governedDealKey)).filter(Boolean)
  )).sort((left, right) => (
    left.governed_deal_key.localeCompare(right.governed_deal_key)
    || left.section_reference.localeCompare(right.section_reference)
    || left.field_path.localeCompare(right.field_path)
    || left.product_row_id.localeCompare(right.product_row_id)
  ));
  if (rows.length === 0) {
    throw new TypeError('candidate_results contain no resolved No-Shop product claims');
  }
  const fieldCatalogue = Object.values(CLAIM_PRESENTATION)
    .map((entry) => clone(entry))
    .sort((left, right) => left.field_path.localeCompare(right.field_path));
  const review = rows.map((row) => ({
    product_row_id: row.product_row_id,
    governed_deal_key: row.governed_deal_key,
    section_reference: row.section_reference,
    label: row.label,
    canonical_value: clone(row.canonical_value),
    party: clone(row.party),
    evidence_text: row.evidence_text,
  }));
  const query = rows.map((row) => ({
    product_row_id: row.product_row_id,
    governed_deal_key: row.governed_deal_key,
    field_path: row.field_path,
    comparison_tuple: clone(row.comparison_tuple),
  }));
  const compare = rows.map((row) => ({
    product_row_id: row.product_row_id,
    governed_deal_key: row.governed_deal_key,
    field_path: row.field_path,
    comparison_tuple: clone(row.comparison_tuple),
  }));
  const marketStatistics = buildMarketStatistics(rows);
  const body = {
    schema_version: PRODUCT_PARITY_SCHEMA,
    family_id: 'NO_SHOP',
    ownership: {
      owned_concept_prefix: 'NOSOL-',
      key_terms_owned_concepts: [...KEY_TERMS_OWNED_CONCEPTS],
      key_terms_owned_definitions: [...KEY_TERMS_OWNED_DEFINITIONS],
    },
    field_catalogue: fieldCatalogue,
    product_rows: rows,
    surfaces: {
      REVIEW: review,
      QUERY: query,
      COMPARE: compare,
      MARKET_STATISTICS: marketStatistics,
    },
    counts: {
      deals: new Set(rows.map((row) => row.governed_deal_key)).size,
      product_rows: rows.length,
      market_groups: marketStatistics.length,
    },
  };
  return freeze({
    ...body,
    no_shop_product_parity_id: contentId(PRODUCT_PARITY_SCHEMA, body),
  });
}

module.exports = {
  CLAIM_PRESENTATION,
  KEY_TERMS_OWNED_CONCEPTS,
  KEY_TERMS_OWNED_DEFINITIONS,
  PRODUCT_PARITY_SCHEMA,
  compileNoShopProductParity,
};
