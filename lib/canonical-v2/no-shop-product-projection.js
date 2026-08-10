'use strict';

const { canonicalJson, contentId } = require('./canonical-bytes');
const { compileFixtureContractV21 } = require('./contract-bundle');
const { filterResolvedEntriesForPublication } = require('./publication-serving-filter');

const PROJECTION_SCHEMA = 'CANONICAL_V2_NO_SHOP_PRODUCT_PROJECTION/V1';
const NATIVE_SOURCE = 'CANONICAL_V2_NATIVE_CLAIM';
const GOVERNED_PROVISION_SCHEMAS = new Set(['PROVISION_INSTANCE/V1']);

const CLAIM_TO_CONCEPTS = Object.freeze({
  NO_SHOP_PROHIBITED_ACTION: Object.freeze(['NOSOL-PROHIBIT']),
  NO_SHOP_EXCEPTION_PREREQUISITE: Object.freeze(['NOSOL-EXCEPT']),
  NO_SHOP_NOTICE_PERIOD_DAYS: Object.freeze(['NOSOL-NOTICE']),
  NO_SHOP_INITIAL_MATCH_PERIOD_DAYS: Object.freeze(['NOSOL-MATCH']),
  NO_SHOP_SUBSEQUENT_MATCH_PERIOD_DAYS: Object.freeze(['NOSOL-REMATCH']),
  NO_SHOP_CEASE_ACTION: Object.freeze(['NOSOL-CEASE']),
  NO_SHOP_REPRESENTATIVE_CONTROL_STANDARD: Object.freeze(['NOSOL-CEASE']),
  NO_SHOP_REPRESENTATIVE_BREACH_ATTRIBUTION: Object.freeze(['NOSOL-CEASE']),
  NO_SHOP_STANDSTILL_ACTION: Object.freeze(['NOSOL-ENFORCE', 'NOSOL-WAIVER']),
  NO_SHOP_FIDUCIARY_ENGAGEMENT_STANDARD: Object.freeze(['NOSOL-EXCEPT']),
  NO_SHOP_RECOMMENDATION_CHANGE_FIDUCIARY_STANDARD: Object.freeze(['NOSOL-RECOMMEND']),
  NO_SHOP_RECOMMENDATION_CHANGE_ACTION: Object.freeze(['NOSOL-RECOMMEND']),
  NO_SHOP_RECOMMENDATION_CHANGE_TRIGGER: Object.freeze(['NOSOL-RECOMMEND']),
  NO_SHOP_RECOMMENDATION_SAFE_DISCLOSURE: Object.freeze(['NOSOL-RECOMMEND']),
});

const TITLES = Object.freeze({
  'NOSOL-PROHIBIT': 'No-shop prohibition',
  'NOSOL-EXCEPT': 'No-shop exceptions',
  'NOSOL-NOTICE': 'No-shop notice',
  'NOSOL-MATCH': 'Initial matching period',
  'NOSOL-REMATCH': 'Subsequent matching period',
  'NOSOL-CEASE': 'Cease discussions',
  'NOSOL-ENFORCE': 'Standstill enforcement',
  'NOSOL-WAIVER': 'Standstill waiver',
  'NOSOL-RECOMMEND': 'Change of Recommendation',
});

const CONTRACT_DEFINITIONS = new Map(
  compileFixtureContractV21().claim_definitions
    .filter((definition) => Object.hasOwn(CLAIM_TO_CONCEPTS, definition.claim_definition_key))
    .map((definition) => [definition.claim_definition_key, definition]),
);

class NoShopProductProjectionError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'NoShopProductProjectionError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new NoShopProductProjectionError(code, message, details);
}

function clone(value) {
  return JSON.parse(canonicalJson(value));
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function claimDefinitionKey(entry) {
  return entry?.resolved_claim_definition_key || entry?.claim?.claim_definition_key || null;
}

function canonicalValueAllowed(definition, value) {
  if (Array.isArray(definition.allowed_canonical_values)) {
    return definition.allowed_canonical_values.includes(value);
  }
  return definition.canonical_value_type === 'NON_NEGATIVE_DECIMAL_STRING'
    && typeof value === 'string'
    && /^(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(value);
}

function resolvedParty(entry) {
  const entryParty = entry.party || null;
  const provisionParty = entry.provision_instance?.party || null;
  if (entryParty && provisionParty && canonicalJson(entryParty) !== canonicalJson(provisionParty)) {
    fail('PARTY_BINDING_MISMATCH', 'The resolved party conflicts with the provision party.');
  }
  const party = entryParty || provisionParty;
  if (!party || party.role !== 'COVENANT_OBLIGOR' || !nonEmpty(party.value)
    || !['TARGET', 'BUYER'].includes(party.capacity)) {
    fail('INVALID_COVENANT_OBLIGOR', 'A governed No-Shop claim needs a resolved covenant obligor.');
  }
  return party;
}

function validateEntry(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    fail('INVALID_RESOLVED_ENTRY', 'Each resolved entry must be an object.');
  }
  const key = claimDefinitionKey(entry);
  const definition = CONTRACT_DEFINITIONS.get(key);
  if (!definition) {
    if (/^NO_SHOP_/u.test(String(key || ''))) {
      fail('UNGOVERNED_NO_SHOP_CLAIM', 'The projection has no approved mapping for this No-Shop claim.', {
        claim_definition_key: key,
      });
    }
    return null;
  }
  const claim = entry.claim;
  if (!claim || claim.claim_definition_key !== key || claim.state !== 'PRESENT'
    || !nonEmpty(claim.claim_revision_id) || !nonEmpty(claim.raw_value)
    || !Array.isArray(claim.evidence) || claim.evidence.length === 0
    || !canonicalValueAllowed(definition, claim.canonical_value)) {
    fail('INVALID_GOVERNED_CLAIM', 'The No-Shop claim does not match its governed definition.', {
      claim_definition_key: key,
    });
  }
  if (!CLAIM_TO_CONCEPTS[key].includes(entry.concept_key)) {
    fail('CONCEPT_OWNERSHIP_MISMATCH', 'The No-Shop claim is attached to the wrong governed concept.', {
      claim_definition_key: key,
      concept_key: entry.concept_key,
    });
  }
  const provision = entry.provision_instance;
  if (!provision || !GOVERNED_PROVISION_SCHEMAS.has(provision.schema_version)
    || !nonEmpty(provision.provision_instance_id)
    || claim.subject_occurrence_id !== provision.provision_instance_id) {
    fail('INVALID_PROVISION_BINDING', 'The No-Shop claim must bind to its governed provision instance.');
  }
  if (/_PERIOD_DAYS$/u.test(key)
    && !['BUSINESS_DAYS', 'CALENDAR_DAYS', 'UNSPECIFIED_DAYS'].includes(claim.attributes?.day_kind)) {
    fail('INVALID_PERIOD_BASIS', 'A governed No-Shop period needs its day basis.');
  }
  return { key, claim, provision, party: resolvedParty(entry) };
}

function taggedValue(claim, attributes = {}) {
  return {
    code: clone(claim.canonical_value),
    text: claim.raw_value,
    quotes: [claim.raw_value],
    ...attributes,
  };
}

function projectedFeatures(key, claim) {
  const value = claim.canonical_value;
  const features = {};
  if (key === 'NO_SHOP_PROHIBITED_ACTION' || key === 'NO_SHOP_CEASE_ACTION') {
    features.ceaseDiscussionsProhibitedList = [taggedValue(claim)];
  } else if (key === 'NO_SHOP_EXCEPTION_PREREQUISITE') {
    features.ceaseDiscussionsExceptions = [taggedValue(claim, {
      permitted_action_context: claim.attributes?.permitted_action_context || null,
    })];
  } else if (key === 'NO_SHOP_NOTICE_PERIOD_DAYS') {
    features.noticePeriod = Number(value);
  } else if (key === 'NO_SHOP_INITIAL_MATCH_PERIOD_DAYS') {
    features.initialMatchPeriodDays = Number(value);
    features.matchingPeriod = Number(value);
  } else if (key === 'NO_SHOP_SUBSEQUENT_MATCH_PERIOD_DAYS') {
    features.subsequentMatchPeriodDays = Number(value);
  } else if (key === 'NO_SHOP_REPRESENTATIVE_CONTROL_STANDARD') {
    features.representativesStandard = value;
    features.ceaseDiscussionsAffiliateStandard = claim.raw_value;
  } else if (key === 'NO_SHOP_REPRESENTATIVE_BREACH_ATTRIBUTION') {
    features.representativeBreachIsCompanyBreach = true;
    features.ceaseDiscussionsLiability = claim.raw_value;
  } else if (key === 'NO_SHOP_STANDSTILL_ACTION') {
    features.ceaseDiscussionsProhibitedList = [taggedValue(claim)];
    if (value === 'ENFORCE' || value === 'NO_WAIVER_RELEASE_OR_MODIFICATION') {
      features.dontAskDontWaive = true;
    } else {
      features.standstillWaiverPermitted = true;
      features.standstillWaiverConditions = claim.raw_value;
    }
  } else if (key === 'NO_SHOP_FIDUCIARY_ENGAGEMENT_STANDARD') {
    features.fiduciaryOutStandard = value;
    features.fiduciaryEngageStandard = claim.raw_value;
  } else if (key === 'NO_SHOP_RECOMMENDATION_CHANGE_FIDUCIARY_STANDARD') {
    features.boardChangeStandard = value;
    features.changeRecStandard = claim.raw_value;
  } else if (key === 'NO_SHOP_RECOMMENDATION_CHANGE_ACTION') {
    features.changeOfRecommendationItems = [taggedValue(claim)];
  } else if (key === 'NO_SHOP_RECOMMENDATION_CHANGE_TRIGGER') {
    features[value === 'SUPERIOR_PROPOSAL' ? 'boardChangeForSuperiorProposal' : 'interveningEventProvision'] = claim.raw_value;
  } else if (key === 'NO_SHOP_RECOMMENDATION_SAFE_DISCLOSURE') {
    features.notChangeOfRecommendationItems = [taggedValue(claim)];
  }
  features.mainConcept = claim.raw_value;
  return features;
}

const LIST_FEATURES = new Set([
  'ceaseDiscussionsProhibitedList',
  'ceaseDiscussionsExceptions',
  'changeOfRecommendationItems',
  'notChangeOfRecommendationItems',
]);
const SINGLE_VALUE_FEATURES = new Set([
  'noticePeriod',
  'initialMatchPeriodDays',
  'matchingPeriod',
  'subsequentMatchPeriodDays',
  'representativeBreachIsCompanyBreach',
  'dontAskDontWaive',
  'standstillWaiverPermitted',
]);

function mergeFeatures(target, source, provisionId) {
  for (const [key, value] of Object.entries(source)) {
    if (key === 'mainConcept') continue;
    if (LIST_FEATURES.has(key)) {
      const existing = target[key] || [];
      const seen = new Set(existing.map(canonicalJson));
      const additions = [];
      for (const item of value) {
        const identity = canonicalJson(item);
        if (seen.has(identity)) continue;
        seen.add(identity);
        additions.push(item);
      }
      target[key] = [...existing, ...additions];
    } else if (target[key] === undefined) {
      target[key] = value;
    } else if (canonicalJson(target[key]) !== canonicalJson(value)) {
      if (SINGLE_VALUE_FEATURES.has(key)) {
        fail('CONFLICTING_SCALAR_FEATURE', 'One No-Shop provision has conflicting governed scalar values.', {
          provision_instance_id: provisionId,
          feature_key: key,
        });
      }
      const values = Array.isArray(target[key]) ? target[key] : [target[key]];
      if (!values.some((item) => canonicalJson(item) === canonicalJson(value))) values.push(value);
      target[key] = values;
    }
  }
}

function featureClaims({ entry, dealId, excerptId, features }) {
  return Object.entries(features).filter(([attribute]) => attribute !== 'mainConcept').map(([attribute, value], ordinal) => ({
    id: contentId('CANONICAL_V2_NO_SHOP_PRODUCT_FEATURE_CLAIM/V1', {
      claim_revision_id: entry.claim.claim_revision_id,
      attribute,
      ordinal,
    }),
    deal_id: dealId,
    excerpt_id: excerptId,
    attribute,
    canonical: clone(value),
    verbatim: entry.claim.raw_value,
    evidence_quote: entry.claim.raw_value,
    provenance: {
      code: entry.concept_key,
      source: NATIVE_SOURCE,
      source_claim_definition_key: entry.claim.claim_definition_key,
      source_claim_revision_id: entry.claim.claim_revision_id,
      source_canonical_value: clone(entry.claim.canonical_value),
      source_claim_attributes: clone(entry.claim.attributes || {}),
      source_evidence: clone(entry.claim.evidence),
    },
  }));
}

function projectNoShopProductSurfaces({ resolution, deal_id: dealId, publication_filter: publicationFilter, release_receipt_id: releaseReceiptId, publication_evaluation_time: publicationEvaluationTime } = {}) {
  if (!resolution || !Array.isArray(resolution.resolved)) {
    throw new TypeError('resolution.resolved must be an array');
  }
  if (!nonEmpty(dealId)) throw new TypeError('deal_id must be a non-empty string');
  const groups = new Map();
  const claims = [];
  for (const entry of filterResolvedEntriesForPublication(resolution.resolved, publicationFilter, releaseReceiptId, publicationEvaluationTime)) {
    const validated = validateEntry(entry);
    if (!validated) continue;
    const { claim, provision, party } = validated;
    const provisionId = provision.provision_instance_id;
    const excerptId = `native:${provisionId}`;
    if (!groups.has(provisionId)) groups.set(provisionId, {
      provisionId,
      excerptId,
      conceptKey: entry.concept_key,
      party,
      sectionRef: entry.section_reference,
      features: {},
      quotes: [],
      claimRevisionIds: [],
    });
    const group = groups.get(provisionId);
    if (group.conceptKey !== entry.concept_key || canonicalJson(group.party) !== canonicalJson(party)) {
      fail('PROVISION_GROUP_CONFLICT', 'One No-Shop provision cannot have conflicting concept or party ownership.');
    }
    const features = projectedFeatures(validated.key, claim);
    mergeFeatures(group.features, features, provisionId);
    group.quotes.push(claim.raw_value);
    group.claimRevisionIds.push(claim.claim_revision_id);
    claims.push(...featureClaims({ entry, dealId, excerptId, features }));
  }
  const cards = [...groups.values()].map((group) => {
    const quote = [...new Set(group.quotes)].join('\n');
    const features = { ...group.features, mainConcept: quote };
    return {
      id: group.provisionId,
      provision_instance_id: group.provisionId,
      deal_id: dealId,
      excerpt_id: group.excerptId,
      type: 'NOSOL',
      provision_type: 'COVENANT_NO_SOLICITATION',
      provision_subtype: group.conceptKey,
      party: group.party,
      section_ref: group.sectionRef,
      short_title: TITLES[group.conceptKey],
      primary_quote: quote,
      region_full_text: quote,
      full_text: quote,
      features,
      ai_metadata: { features },
      canonical_v2_lineage: {
        source: NATIVE_SOURCE,
        claim_revision_ids: [...new Set(group.claimRevisionIds)].sort(),
      },
    };
  }).sort((left, right) => left.id.localeCompare(right.id));
  const body = {
    deal_id: dealId,
    source: NATIVE_SOURCE,
    cards,
    claims: claims.sort((left, right) => left.id.localeCompare(right.id)),
  };
  return freeze({
    schema_version: PROJECTION_SCHEMA,
    projection_id: contentId(PROJECTION_SCHEMA, body),
    ...clone(body),
  });
}

module.exports = {
  CLAIM_TO_CONCEPTS,
  NATIVE_SOURCE,
  NoShopProductProjectionError,
  PROJECTION_SCHEMA,
  projectNoShopProductSurfaces,
};
