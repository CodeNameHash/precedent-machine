'use strict';

const { canonicalJson, contentId } = require('./canonical-bytes');

const PROJECTION_SCHEMA = 'CANONICAL_V2_ANTITRUST_PRODUCT_PROJECTION/V1';
const NON_HSR_FILING_DEADLINE_SCHEMA = 'CANONICAL_V2_NON_HSR_FILING_DEADLINE/V1';
const SOURCE = 'CANONICAL_V2_NATIVE_CLAIM';

const TITLES = Object.freeze({
  'ANTI-EFFORTS': 'Regulatory Efforts',
  'ANTI-BURDEN': 'Regulatory Burden',
  'ANTI-LITIGATION': 'Regulatory Litigation',
  'ANTI-AGREEMENTS': 'Timing Agreements',
  'ANTI-FILING': 'Regulatory Filings',
  'ANTI-STRATEGY': 'Regulatory Strategy',
  'ANTI-CONSULT': 'Regulatory Consultation',
  'ANTI-NOACTION': 'No Inconsistent Action',
});

const SUPPORTED_DEFINITIONS = new Set([
  'REGULATORY_EFFORTS_STANDARD',
  'REGULATORY_BURDEN_COMMITMENT',
  'REGULATORY_DIVESTITURE_CAP_AMOUNT',
  'REGULATORY_LITIGATION_OBLIGATION',
  'REGULATORY_TIMING_AGREEMENT_RESTRICTION',
  'REGULATORY_WITHDRAWAL_REFILING_RESTRICTION',
  'HSR_FILING_DEADLINE_DAYS',
  'REGULATORY_FILING_OBLIGATION',
  'REGULATORY_FILING_DEADLINE_DAYS',
  'REGULATORY_STRATEGY_CONTROL',
  'REGULATORY_CONSULTATION_RIGHT',
  'REGULATORY_NON_IMPEDIMENT_COVENANT',
]);

const EFFORTS_VALUES = Object.freeze({
  BEST_EFFORTS: 'best-efforts',
  COMMERCIALLY_REASONABLE_EFFORTS: 'commercially-reasonable-efforts',
  FLAT_OBLIGATION: 'flat',
  REASONABLE_BEST_EFFORTS: 'reasonable-best-efforts',
  REASONABLE_EFFORTS: 'reasonable-efforts',
});

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
  const value = claim.canonical_value;
  const features = {};

  if (definition === 'REGULATORY_EFFORTS_STANDARD') {
    addFeature(features, 'antitrustEffortsStandard', EFFORTS_VALUES[value] || value);
  } else if (definition === 'REGULATORY_BURDEN_COMMITMENT') {
    addFeature(features, 'burdenCommitment', value);
    addFeature(features, 'divestitureCapDescription', quote);
    addFeature(features, 'burdenBaseline', attrs.burden_baseline);
  } else if (definition === 'REGULATORY_DIVESTITURE_CAP_AMOUNT') {
    addFeature(features, 'divestitureCap', Number(value));
    addFeature(features, 'divestitureCapDescription', quote);
  } else if (definition === 'REGULATORY_LITIGATION_OBLIGATION') {
    addFeature(features, 'litigationObligation', value);
  } else if (definition === 'REGULATORY_TIMING_AGREEMENT_RESTRICTION') {
    addFeature(features, 'timingAgreement', value);
  } else if (definition === 'REGULATORY_WITHDRAWAL_REFILING_RESTRICTION') {
    addFeature(features, 'pullRefile', value);
  } else if (definition === 'HSR_FILING_DEADLINE_DAYS') {
    addFeature(features, 'hsrFilingDeadlineBusinessDays', Number(value));
  } else if (definition === 'REGULATORY_FILING_OBLIGATION') {
    addFeature(features, 'regulatoryFilingRegimes', attrs.filing_regime_ref);
    if (attrs.filing_regime_ref === 'HSR Act') addFeature(features, 'hsrFilingRequired', true);
    else addFeature(features, 'foreignFilingsRequired', 'PRESENT');
  } else if (definition === 'REGULATORY_FILING_DEADLINE_DAYS') {
    addFeature(features, 'regulatoryFilingRegimes', attrs.filing_regime_ref);
  } else if (definition === 'REGULATORY_STRATEGY_CONTROL') {
    addFeature(features, 'regulatoryStrategyControlTagged', value);
  } else if (definition === 'REGULATORY_CONSULTATION_RIGHT') {
    addFeature(features, 'consultationTier', value);
  } else if (definition === 'REGULATORY_NON_IMPEDIMENT_COVENANT') {
    if (attrs.obligor_party_scope === 'MUTUAL') {
      addFeature(features, 'clearSkiesParent', true);
      addFeature(features, 'clearSkiesCompany', true);
    } else if (/\bParent\b/i.test(attrs.obligor_party_ref || '')) {
      addFeature(features, 'clearSkiesParent', true);
    } else if (/\bCompany\b/i.test(attrs.obligor_party_ref || '')) {
      addFeature(features, 'clearSkiesCompany', true);
    }
  }
  addFeature(features, 'mainConcept', quote);
  return features;
}

function quotedAttribute(attributes, key, quote) {
  const value = attributes[key];
  return typeof value === 'string' && value.length > 0 && quote.includes(value) ? value : null;
}

function nonHsrFilingDeadline(entry, dealId) {
  if (entry?.resolved_claim_definition_key !== 'REGULATORY_FILING_DEADLINE_DAYS') return null;
  const claim = entry.claim;
  const attrs = claim?.attributes || {};
  const quote = claimQuote(claim);
  const regime = quotedAttribute(attrs, 'filing_regime_ref', quote);
  if (!regime || regime === 'HSR Act' || !['BUSINESS', 'CALENDAR'].includes(attrs.day_kind)
    || typeof claim.canonical_value !== 'string' || !/^(?:0|[1-9]\d*)$/.test(claim.canonical_value)) return null;
  const body = {
    schema_version: NON_HSR_FILING_DEADLINE_SCHEMA,
    authority_state: 'VALIDATED_NOT_SERVED',
    deal_id: dealId,
    filing_regime_ref: regime,
    value: claim.canonical_value,
    unit: 'DAYS',
    day_kind: attrs.day_kind,
    exact_evidence: quote,
    source_claim_revision_id: claim.claim_revision_id,
    ...(quotedAttribute(attrs, 'timing_relation', quote)
      ? { timing_relation: quotedAttribute(attrs, 'timing_relation', quote) } : {}),
    ...(quotedAttribute(attrs, 'timing_trigger', quote)
      ? { timing_trigger: quotedAttribute(attrs, 'timing_trigger', quote) } : {}),
  };
  return Object.freeze({
    ...body,
    non_hsr_filing_deadline_id: contentId(NON_HSR_FILING_DEADLINE_SCHEMA, body),
  });
}

function featureClaims({ entry, dealId, excerptId, conceptKey, features }) {
  return Object.entries(features).map(([attribute, value], ordinal) => ({
    id: contentId('CANONICAL_V2_ANTITRUST_PRODUCT_FEATURE_CLAIM/V1', {
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

function projectAntitrustProductSurfaces({ resolution, deal_id: dealId } = {}) {
  if (!resolution || !Array.isArray(resolution.resolved)) {
    throw new TypeError('resolution.resolved must be an array');
  }
  if (typeof dealId !== 'string' || !dealId) throw new TypeError('deal_id must be a non-empty string');
  const groups = new Map();
  const claims = [];
  const nonHsrFilingDeadlines = [];
  for (const entry of resolution.resolved) {
    if (!SUPPORTED_DEFINITIONS.has(entry?.resolved_claim_definition_key)) continue;
    const conceptKey = entry?.concept_key;
    const provisionId = entry?.provision_instance?.provision_instance_id;
    const claim = entry?.claim;
    if (!TITLES[conceptKey] || !provisionId || !claim?.claim_revision_id) continue;
    const excerptId = `native:${provisionId}`;
    const features = projectedFeatures(entry);
    const nonHsrDeadline = nonHsrFilingDeadline(entry, dealId);
    if (nonHsrDeadline) nonHsrFilingDeadlines.push(nonHsrDeadline);
    if (!groups.has(provisionId)) groups.set(provisionId, {
      provisionId,
      conceptKey,
      excerptId,
      sectionRef: entry.section_reference,
      quotes: [],
      features: {},
      claimRevisionIds: [],
    });
    const group = groups.get(provisionId);
    if (group.conceptKey !== conceptKey) throw new Error('one provision cannot project to two antitrust concepts');
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
      type: 'ANTI',
      provision_type: 'ANTITRUST_REGULATORY',
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
    non_hsr_filing_deadlines: nonHsrFilingDeadlines.sort((left, right) => (
      left.non_hsr_filing_deadline_id.localeCompare(right.non_hsr_filing_deadline_id)
    )),
    open_items: [],
  };
  return freeze({
    schema_version: PROJECTION_SCHEMA,
    projection_id: contentId(PROJECTION_SCHEMA, body),
    ...clone(body),
  });
}

module.exports = {
  PROJECTION_SCHEMA,
  NON_HSR_FILING_DEADLINE_SCHEMA,
  SOURCE,
  SUPPORTED_DEFINITIONS,
  projectAntitrustProductSurfaces,
};
