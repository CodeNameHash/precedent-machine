'use strict';

const { canonicalJson, contentId } = require('./canonical-bytes');
const { filterResolvedEntriesForPublication } = require('./publication-serving-filter');
const { isHsrRegimeRef } = require('./native-producer/antitrust-regulatory-parse');

const PROJECTION_SCHEMA = 'CANONICAL_V2_ANTITRUST_PRODUCT_PROJECTION/V1';
const NON_HSR_FILING_DEADLINE_SCHEMA = 'CANONICAL_V2_NON_HSR_FILING_DEADLINE/V1';
const SOURCE = 'CANONICAL_V2_NATIVE_CLAIM';
const EVIDENCE_SOURCE = 'CANONICAL_V2_OPEN_WORLD_EVIDENCE';

const TITLES = Object.freeze({
  'ANTI-EFFORTS': 'Regulatory Efforts',
  'ANTI-BURDEN': 'Regulatory Burden',
  'ANTI-LITIGATION': 'Regulatory Litigation',
  'ANTI-AGREEMENTS': 'Regulatory Agreements',
  'ANTI-FILING': 'Regulatory Filings',
  'ANTI-STRATEGY': 'Regulatory Strategy',
  'ANTI-CONSULT': 'Regulatory Consultation',
  'ANTI-NOACTION': 'No Inconsistent Action',
  'ANTI-COOPERATE': 'Regulatory Cooperation',
  'ANTI-INFO': 'Regulatory Information Sharing',
  'ANTI-NOTIFY': 'Regulatory Notification',
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
  'REGULATORY_COOPERATION_OBLIGATION',
  'REGULATORY_INFORMATION_SHARING_OBLIGATION',
  'REGULATORY_NOTIFICATION_OBLIGATION',
  'REGULATORY_FILING_TIMING_STANDARD',
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

function resolvedParty(entry) {
  const entryParty = entry?.party || null;
  const provisionParty = entry?.provision_instance?.party || null;
  if (entryParty && provisionParty && canonicalJson(entryParty) !== canonicalJson(provisionParty)) {
    throw new TypeError('resolved Antitrust party conflicts with its provision party');
  }
  const party = entryParty || provisionParty;
  if (!party
    || typeof party.role !== 'string' || !party.role.trim()
    || typeof party.value !== 'string' || !party.value.trim()
    || typeof party.capacity !== 'string' || !party.capacity.trim()) {
    throw new TypeError('resolved Antitrust party is ambiguous');
  }
  return party;
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

function filingFact({ definition, value, attrs, quote }) {
  const regime = attrs.filing_regime_ref;
  if (typeof regime !== 'string' || !regime || !quote.includes(regime)) return null;
  // HSR keeps its dedicated governed fields. This linked collection is the
  // non-HSR filing surface, including foreign merger-control and sectoral
  // regimes that historically appeared under ANTI-FOREIGN.
  if (isHsrRegimeRef(regime)) return null;
  if (definition === 'REGULATORY_FILING_OBLIGATION') {
    return { factKind: 'OBLIGATION', filingRegime: regime, required: true, exactEvidence: quote };
  }
  if (definition === 'REGULATORY_FILING_DEADLINE_DAYS') {
    return {
      factKind: 'DEADLINE_DAYS', filingRegime: regime, value: String(value), unit: 'DAYS',
      dayKind: attrs.day_kind, timingRelation: attrs.timing_relation || null,
      timingTrigger: attrs.timing_trigger || null, exactEvidence: quote,
    };
  }
  if (definition === 'REGULATORY_FILING_TIMING_STANDARD') {
    return {
      factKind: value === 'FIXED_DATE' ? 'FIXED_DATE' : 'TIMING_STANDARD',
      filingRegime: regime, timingStandard: value,
      fixedDate: attrs.fixed_date_ref || null, timingRelation: attrs.timing_relation || null,
      timingTrigger: attrs.timing_trigger || null, exactEvidence: quote,
    };
  }
  return null;
}

function projectedFeatures(entry) {
  const definition = entry.resolved_claim_definition_key;
  const claim = entry.claim;
  const attrs = claim.attributes || {};
  const quote = claimQuote(claim);
  const value = claim.canonical_value;
  const features = {};
  const linkedFilingFact = filingFact({ definition, value, attrs, quote });
  if (linkedFilingFact) addFeature(features, 'regulatoryFilingFacts', [linkedFilingFact]);

  if (definition === 'REGULATORY_EFFORTS_STANDARD') {
    addFeature(features, 'antitrustEffortsStandard', EFFORTS_VALUES[value] || value);
  } else if (definition === 'REGULATORY_BURDEN_COMMITMENT') {
    addFeature(features, 'burdenCommitment', value);
    addFeature(features, 'divestitureCapDescription', quote);
    addFeature(features, 'burdenBaseline', attrs.burden_baseline);
    addFeature(features, 'burdenBaselineRef', attrs.burden_baseline_ref);
  } else if (definition === 'REGULATORY_DIVESTITURE_CAP_AMOUNT') {
    addFeature(features, 'divestitureCapAmount', value);
    addFeature(features, 'divestitureCapCurrency', attrs.currency);
    const numericValue = Number(value);
    if (attrs.currency === 'USD' && Number.isFinite(numericValue) && Math.abs(numericValue) <= Number.MAX_SAFE_INTEGER) {
      addFeature(features, 'divestitureCap', numericValue);
    }
    addFeature(features, 'divestitureCapDescription', quote);
  } else if (definition === 'REGULATORY_LITIGATION_OBLIGATION') {
    addFeature(features, 'litigationObligation', value);
  } else if (definition === 'REGULATORY_TIMING_AGREEMENT_RESTRICTION') {
    addFeature(features, 'timingAgreement', value);
  } else if (definition === 'REGULATORY_WITHDRAWAL_REFILING_RESTRICTION') {
    addFeature(features, 'pullRefile', value);
    addFeature(features, 'pullRefileProviso', attrs.withdrawal_exception_ref);
    addFeature(features, 'pullRefileProvisoDays', attrs.withdrawal_refile_period_days);
    addFeature(features, 'pullRefileProvisoDayKind', attrs.withdrawal_refile_day_kind);
  } else if (definition === 'HSR_FILING_DEADLINE_DAYS') {
    addFeature(features, 'hsrFilingDeadlineDays', Number(value));
    addFeature(features, 'hsrFilingDeadlineDayKind', attrs.day_kind);
    addFeature(features, 'hsrFilingDeadlineTimingRelation', attrs.timing_relation);
    addFeature(features, 'hsrFilingDeadlineTimingTrigger', attrs.timing_trigger);
    if (attrs.day_kind === 'BUSINESS') addFeature(features, 'hsrFilingDeadlineBusinessDays', Number(value));
  } else if (definition === 'REGULATORY_FILING_OBLIGATION') {
    addFeature(features, 'regulatoryFilingRegimes', attrs.filing_regime_ref);
    if (isHsrRegimeRef(attrs.filing_regime_ref)) addFeature(features, 'hsrFilingRequired', true);
    else addFeature(features, 'foreignFilingsRequired', 'PRESENT');
  } else if (definition === 'REGULATORY_FILING_DEADLINE_DAYS') {
    addFeature(features, 'regulatoryFilingRegimes', attrs.filing_regime_ref);
  } else if (definition === 'REGULATORY_FILING_TIMING_STANDARD') {
    addFeature(features, 'regulatoryFilingRegimes', attrs.filing_regime_ref);
    addFeature(features, 'regulatoryFilingTimingStandard', value);
    addFeature(features, 'regulatoryFilingFixedDate', attrs.fixed_date_ref);
  } else if (definition === 'REGULATORY_STRATEGY_CONTROL') {
    addFeature(features, 'regulatoryStrategyControlTagged', value);
    addFeature(features, 'regulatoryStrategyControlHolder', attrs.control_holder_party);
    addFeature(features, 'regulatoryStrategyScope', attrs.strategy_scope_ref);
  } else if (definition === 'REGULATORY_CONSULTATION_RIGHT') {
    addFeature(features, 'consultationTier', value);
    addFeature(features, 'consultationRightHolder', attrs.right_holder_party);
  } else if (definition === 'REGULATORY_COOPERATION_OBLIGATION') {
    addFeature(features, 'regulatoryCooperationRequired', value);
    addFeature(features, 'regulatoryCooperationScope', attrs.cooperation_scope_ref);
  } else if (definition === 'REGULATORY_INFORMATION_SHARING_OBLIGATION') {
    addFeature(features, 'regulatoryInformationSharingRequired', value);
    addFeature(features, 'regulatoryInformationScope', attrs.information_scope_ref);
    const protections = Array.isArray(attrs.information_protection_kinds)
      ? attrs.information_protection_kinds
      : (attrs.information_protection_kind ? [attrs.information_protection_kind] : []);
    addFeature(features, 'regulatoryInformationProtections', protections);
    if (protections.length === 1) addFeature(features, 'regulatoryInformationProtection', protections[0]);
  } else if (definition === 'REGULATORY_NOTIFICATION_OBLIGATION') {
    addFeature(features, 'regulatoryNotificationRequired', value);
    addFeature(features, 'regulatoryNotificationEvent', attrs.notification_event_ref);
    addFeature(features, 'regulatoryNotificationTiming', attrs.notification_timing_ref);
  } else if (definition === 'REGULATORY_NON_IMPEDIMENT_COVENANT') {
    addFeature(features, 'regulatoryNonImpedimentRequired', value);
    addFeature(features, 'regulatoryProhibitedAction', attrs.prohibited_action_ref);
    addFeature(features, 'regulatoryImpairmentEffect', attrs.impairment_effect_ref);
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
  if (!regime || isHsrRegimeRef(regime) || !['BUSINESS', 'CALENDAR'].includes(attrs.day_kind)
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

function projectAntitrustProductSurfaces({ resolution, deal_id: dealId, publication_filter: publicationFilter, release_receipt_id: releaseReceiptId, publication_evaluation_time: publicationEvaluationTime } = {}) {
  if (!resolution || !Array.isArray(resolution.resolved)) {
    throw new TypeError('resolution.resolved must be an array');
  }
  if (typeof dealId !== 'string' || !dealId) throw new TypeError('deal_id must be a non-empty string');
  const groups = new Map();
  const claims = [];
  const nonHsrFilingDeadlines = [];
  for (const entry of filterResolvedEntriesForPublication(resolution.resolved, publicationFilter, releaseReceiptId, publicationEvaluationTime)) {
    if (!SUPPORTED_DEFINITIONS.has(entry?.resolved_claim_definition_key)) continue;
    const conceptKey = entry?.concept_key;
    const provisionId = entry?.provision_instance?.provision_instance_id;
    const claim = entry?.claim;
    if (!TITLES[conceptKey] || !provisionId || !claim?.claim_revision_id) continue;
    const party = resolvedParty(entry);
    const excerptId = `native:${provisionId}`;
    const features = projectedFeatures(entry);
    const nonHsrDeadline = nonHsrFilingDeadline(entry, dealId);
    if (nonHsrDeadline) nonHsrFilingDeadlines.push(nonHsrDeadline);
    if (!groups.has(provisionId)) groups.set(provisionId, {
      provisionId,
      conceptKey,
      excerptId,
      party,
      sectionRef: entry.section_reference,
      quotes: [],
      features: {},
      claimRevisionIds: [],
      featureClaimRevisionIds: {},
    });
    const group = groups.get(provisionId);
    if (group.conceptKey !== conceptKey) throw new Error('one provision cannot project to two antitrust concepts');
    if (canonicalJson(group.party) !== canonicalJson(party)) {
      throw new TypeError('resolved Antitrust claims for one provision have conflicting parties');
    }
    if (claimQuote(claim)) group.quotes.push(claimQuote(claim));
    group.claimRevisionIds.push(claim.claim_revision_id);
    for (const [key, value] of Object.entries(features)) {
      addFeature(group.features, key, value);
      if (!Array.isArray(group.featureClaimRevisionIds[key])) {
        group.featureClaimRevisionIds[key] = [];
      }
      if (!group.featureClaimRevisionIds[key].includes(claim.claim_revision_id)) {
        group.featureClaimRevisionIds[key].push(claim.claim_revision_id);
      }
    }
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
      party: group.party,
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
        feature_claim_revision_ids: Object.fromEntries(
          Object.entries(group.featureClaimRevisionIds)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([featureKey, claimRevisionIds]) => [featureKey, [...claimRevisionIds].sort()]),
        ),
      },
    };
  });
  const openWorldItems = (Array.isArray(resolution.open_world) ? resolution.open_world : []).filter((item) => (
    item?.extraction_provenance?.prompt_id === 'native-producer-antitrust-regulatory/v1'
    || item?.claim_definition_key === 'NATIVE_REGULATORY_EFFORTS_CANDIDATE'
  ));
  const unresolvedReviewItems = (Array.isArray(resolution.review_queue) ? resolution.review_queue : [])
    .filter((item) => item?.has_resolution === false
      && /^(?:ANTI-|ANTITRUST)/.test(item.concept_family || item.concept_key || ''))
    .map((item) => ({
      ...item,
      reason: Array.isArray(item.reasons) ? item.reasons.join(' | ') : item.reason,
      evidence_bucket: 'REVIEW_QUEUE',
    }));
  const openItems = [...openWorldItems, ...unresolvedReviewItems];
  const evidenceCards = openItems.map((item, ordinal) => ({
    id: contentId('CANONICAL_V2_ANTITRUST_OPEN_WORLD_EVIDENCE_CARD/V1', { deal_id: dealId, closure_id: item.closure_id, ordinal }),
    deal_id: dealId,
    excerpt_id: `open-world:${item.closure_id}`,
    type: 'ANTI',
    provision_type: 'ANTITRUST_REGULATORY',
    provision_subtype: 'ANTI-UNTYPED-EVIDENCE',
    section_ref: item.section_reference,
    short_title: 'Deferred antitrust evidence',
    primary_quote: item.raw_value,
    region_full_text: item.raw_value,
    full_text: item.raw_value,
    features: {
      antitrustUnresolvedEvidence: true,
      antitrustReviewReason: item.reason || 'Unresolved antitrust evidence',
    },
    ai_metadata: { features: {
      antitrustUnresolvedEvidence: true,
      antitrustReviewReason: item.reason || 'Unresolved antitrust evidence',
    } },
    canonical_v2_lineage: { source: EVIDENCE_SOURCE, reason: item.reason, claim_revision_ids: [] },
  }));
  const body = {
    deal_id: dealId,
    source: SOURCE,
    cards: [...cards, ...evidenceCards].sort((a, b) => a.provision_subtype.localeCompare(b.provision_subtype)),
    claims: uniqueFeatureClaims(claims).sort((a, b) => a.id.localeCompare(b.id)),
    non_hsr_filing_deadlines: nonHsrFilingDeadlines.sort((left, right) => (
      left.non_hsr_filing_deadline_id.localeCompare(right.non_hsr_filing_deadline_id)
    )),
    open_items: clone(openItems),
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
  EVIDENCE_SOURCE,
  SOURCE,
  SUPPORTED_DEFINITIONS,
  projectAntitrustProductSurfaces,
};
