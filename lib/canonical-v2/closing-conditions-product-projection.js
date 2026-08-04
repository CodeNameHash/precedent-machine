'use strict';

const { canonicalJson, contentId } = require('./canonical-bytes');

const PROJECTION_SCHEMA = 'CANONICAL_V2_CLOSING_CONDITIONS_PRODUCT_PROJECTION/V1';
const SOURCE = 'CANONICAL_V2_NATIVE_CLAIM';

const TITLES = Object.freeze({
  'COND-M-STOCKHOLDER': 'Stockholder Approval',
  'COND-M-LEGAL': 'No Legal Restraint',
  'COND-M-S4': 'S-4 / Proxy Effective',
  'COND-M-LISTING': 'Stock Exchange Listing',
  'COND-S-FUNDS': 'Financing / Sufficient Funds',
  'COND-B-CERT': "Officer's Certificate",
  'COND-S-CERT': "Officer's Certificate (Parent)",
  'COND-FRUSTRATE': 'Condition Frustration / Prevention',
});

const SUPPORTED_DEFINITIONS = new Set([
  'STOCKHOLDER_APPROVAL_CONDITION', 'LEGAL_RESTRAINT_CONDITION',
  'GOVERNMENT_PROCEEDING_CONDITION', 'S4_CONDITION_COMPONENT',
  'LISTING_CONDITION', 'FUNDS_AVAILABILITY_CONDITION',
  'OFFICER_CERTIFICATE_REQUIRED', 'FRUSTRATION_CAUSATION_STANDARD',
  'FRUSTRATION_BREACH_STANDARD', 'CONDITION_DOLLAR_THRESHOLD',
  'BURDENSOME_CONDITION',
]);

function clone(value) {
  return JSON.parse(canonicalJson(value));
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function claimQuote(claim) {
  return typeof claim?.raw_value === 'string' ? claim.raw_value : '';
}

function addFeature(features, key, value) {
  if (value === null || value === undefined || value === '') return;
  if (features[key] === undefined) features[key] = value;
  else if (canonicalJson(features[key]) !== canonicalJson(value)) {
    features[key] = [...new Set([].concat(features[key], value))];
  }
}

function projectedFeatures(entry) {
  const definition = entry.resolved_claim_definition_key;
  const claim = entry.claim;
  const attrs = claim.attributes || {};
  const quote = claimQuote(claim);
  const features = {};
  if (definition === 'STOCKHOLDER_APPROVAL_CONDITION') {
    addFeature(features, 'stockholderApprovalRequired', true);
    addFeature(features, 'approvalDefinition', attrs.approval_definition_ref);
  } else if (definition === 'LEGAL_RESTRAINT_CONDITION') {
    addFeature(features, 'absenceOfEnjoiningOrderPresent', true);
    addFeature(features, 'absenceOfEnjoiningOrderDetails', quote);
  } else if (definition === 'GOVERNMENT_PROCEEDING_CONDITION') {
    addFeature(features, 'governmentProceedingConditionPresent', true);
  } else if (definition === 'S4_CONDITION_COMPONENT') {
    addFeature(features, 's4ConditionComponents', attrs.s4_component || claim.canonical_value);
  } else if (definition === 'LISTING_CONDITION') {
    addFeature(features, 'listingConditionPresent', true);
    addFeature(features, 'listingVenue', attrs.listing_venue_ref);
  } else if (definition === 'FUNDS_AVAILABILITY_CONDITION') {
    addFeature(features, 'fundsCondition', true);
  } else if (definition === 'OFFICER_CERTIFICATE_REQUIRED') {
    addFeature(features, 'certificationRequired', true);
    addFeature(features, 'certificateSide', attrs.certificate_side);
    addFeature(features, 'certifiedConditionRefs', attrs.certified_condition_refs);
    addFeature(features, 'certificateRelationshipStatus', attrs.certificate_relationship_status);
  } else if (definition === 'FRUSTRATION_CAUSATION_STANDARD') {
    addFeature(features, 'frustrationCausationStandard', claim.canonical_value);
  } else if (definition === 'FRUSTRATION_BREACH_STANDARD') {
    addFeature(features, 'frustrationBreachStandard', claim.canonical_value);
  } else if (definition === 'CONDITION_DOLLAR_THRESHOLD') {
    addFeature(features, 'dollarThreshold', claim.canonical_value);
    addFeature(features, 'conditionThresholdRole', attrs.threshold_role);
  } else if (definition === 'BURDENSOME_CONDITION') {
    addFeature(features, 'burdensomeConditionPresent', true);
    addFeature(features, 'burdensomeConditionScope', attrs.burdensome_scope);
  }
  addFeature(features, 'mainCondition', quote);
  return features;
}

function featureClaims({ entry, dealId, excerptId, conceptKey, features }) {
  return Object.entries(features).map(([attribute, value], ordinal) => ({
    id: contentId('CANONICAL_V2_CLOSING_PRODUCT_FEATURE_CLAIM/V1', {
      claim_revision_id: entry.claim.claim_revision_id,
      attribute,
      ordinal,
    }),
    deal_id: dealId,
    excerpt_id: excerptId,
    attribute,
    canonical: value,
    verbatim: claimQuote(entry.claim),
    evidence_quote: claimQuote(entry.claim),
    provenance: {
      code: conceptKey,
      feature_value: value,
      source: SOURCE,
      source_claim_definition_key: entry.resolved_claim_definition_key,
      source_claim_revision_id: entry.claim.claim_revision_id,
    },
  }));
}

function uniqueFeatureClaims(claims) {
  const byObservation = new Map();
  for (const claim of claims) {
    const key = canonicalJson({
      excerpt_id: claim.excerpt_id,
      attribute: claim.attribute,
      canonical: claim.canonical,
    });
    if (!byObservation.has(key)) byObservation.set(key, claim);
  }
  return [...byObservation.values()];
}

function projectClosingConditionProductSurfaces({ resolution, deal_id: dealId } = {}) {
  if (!resolution || !Array.isArray(resolution.resolved)) {
    throw new TypeError('resolution.resolved must be an array');
  }
  if (typeof dealId !== 'string' || !dealId) throw new TypeError('deal_id must be a non-empty string');
  const groups = new Map();
  const claims = [];
  for (const entry of resolution.resolved) {
    if (!SUPPORTED_DEFINITIONS.has(entry?.resolved_claim_definition_key)) continue;
    const conceptKey = entry?.concept_key;
    const provisionId = entry?.provision_instance?.provision_instance_id;
    const claim = entry?.claim;
    if (!TITLES[conceptKey] || !provisionId || !claim?.claim_revision_id) continue;
    const excerptId = `native:${provisionId}`;
    const features = projectedFeatures(entry);
    if (!groups.has(provisionId)) groups.set(provisionId, {
      provisionId, conceptKey, excerptId,
      sectionRef: entry.section_reference,
      quotes: [], features: {}, claimRevisionIds: [],
    });
    const group = groups.get(provisionId);
    if (group.conceptKey !== conceptKey) throw new Error('one provision cannot project to two condition concepts');
    if (claimQuote(claim)) group.quotes.push(claimQuote(claim));
    group.claimRevisionIds.push(claim.claim_revision_id);
    for (const [key, value] of Object.entries(features)) addFeature(group.features, key, value);
    claims.push(...featureClaims({ entry, dealId, excerptId, conceptKey, features }));
  }
  const cards = [...groups.values()].map((group) => {
    const primaryQuote = [...new Set(group.quotes)].join('\n');
    return {
      id: group.provisionId,
      provision_instance_id: group.provisionId,
      deal_id: dealId,
      excerpt_id: group.excerptId,
      type: 'COND',
      provision_type: 'CLOSING_CONDITION',
      provision_subtype: group.conceptKey,
      section_ref: group.sectionRef,
      short_title: TITLES[group.conceptKey],
      primary_quote: primaryQuote,
      region_full_text: primaryQuote,
      full_text: primaryQuote,
      features: group.features,
      ai_metadata: { features: group.features },
      canonical_v2_lineage: {
        source: SOURCE,
        claim_revision_ids: [...new Set(group.claimRevisionIds)].sort(),
      },
    };
  });
  const body = {
    deal_id: dealId,
    source: SOURCE,
    cards: cards.sort((a, b) => a.provision_subtype.localeCompare(b.provision_subtype)),
    claims: uniqueFeatureClaims(claims).sort((a, b) => a.id.localeCompare(b.id)),
    open_items: [
      {
        item: 'DISSENT_THRESHOLD',
        state: 'RETIRED',
        reason: 'APPROVED_M3_RETIRED_OPEN_WORLD',
        reintroduction_requirement: 'STABLE_GROUNDED_SHAPE_AND_SEPARATE_APPROVAL',
      },
    ],
  };
  return freeze({
    schema_version: PROJECTION_SCHEMA,
    projection_id: contentId(PROJECTION_SCHEMA, body),
    ...clone(body),
  });
}

module.exports = {
  PROJECTION_SCHEMA,
  SOURCE,
  SUPPORTED_DEFINITIONS,
  projectClosingConditionProductSurfaces,
};
