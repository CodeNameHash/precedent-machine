'use strict';

const { canonicalJson, contentId } = require('./canonical-bytes');

const PROJECTION_SCHEMA = 'CANONICAL_V2_REMEDIES_MISC_PRODUCT_PROJECTION/V1';
const NATIVE_SOURCE = 'CANONICAL_V2_NATIVE_CLAIM';
const EVIDENCE_SOURCE = 'CANONICAL_V2_OPEN_WORLD_EVIDENCE';

const REMEDIES_DEFINITIONS = new Set([
  'SPECIFIC_PERFORMANCE_AVAILABLE',
  'SPECIFIC_PERFORMANCE_FINANCING_CONDITION',
  'SP_BOND_SECURITY_WAIVER',
  'NON_RECOURSE_PROVISION',
  'JURY_TRIAL_WAIVER',
]);
const MISC_DEFINITIONS = new Set([
  'GOVERNING_LAW_STATE',
  'FORUM_SELECTION_PROVISION',
  'FORUM_EXCLUSIVE',
  'ASSIGNMENT_CONSENT_RESTRICTION',
  'AMENDMENT_WRITTEN_INSTRUMENT',
  'NOTICES_PROVISION',
  'ENTIRE_AGREEMENT_INTEGRATION',
  'NO_THIRD_PARTY_BENEFICIARIES',
  'SEVERABILITY_PROVISION',
  'COUNTERPARTS_EXECUTION',
]);

function clone(value) {
  return JSON.parse(canonicalJson(value));
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function addFeature(features, key, value) {
  if (value === null || value === undefined || value === '') return;
  if (features[key] === undefined) features[key] = value;
  else if (canonicalJson(features[key]) !== canonicalJson(value)) {
    features[key] = [...new Set([].concat(features[key], value))];
  }
}

function stateLabel(value) {
  return String(value || '').toLowerCase().replace(/(^|_)([a-z])/g, (_match, prefix, letter) => `${prefix ? ' ' : ''}${letter.toUpperCase()}`);
}

function remediesFeatures(entry) {
  const definition = entry.resolved_claim_definition_key;
  const attrs = entry.claim.attributes || {};
  const features = {};
  if (definition === 'SPECIFIC_PERFORMANCE_AVAILABLE') {
    addFeature(features, 'specificPerformance', true);
    if (attrs.sp_holder_scope === 'MUTUAL') addFeature(features, 'specificPerformanceMutual', true);
  } else if (definition === 'SPECIFIC_PERFORMANCE_FINANCING_CONDITION') {
    addFeature(features, 'specificPerformanceLimitations', entry.claim.raw_value);
  } else if (definition === 'SP_BOND_SECURITY_WAIVER') {
    addFeature(features, 'bondSecurityRequiredForSP', false);
    addFeature(features, 'specificPerformanceLimitations', entry.claim.raw_value);
  } else if (definition === 'NON_RECOURSE_PROVISION') {
    addFeature(features, 'mainConcept', entry.claim.raw_value);
  } else if (definition === 'JURY_TRIAL_WAIVER') {
    addFeature(features, 'juryWaiver', true);
  }
  addFeature(features, 'mainConcept', entry.claim.raw_value);
  return features;
}

function miscFeatures(entry) {
  const definition = entry.resolved_claim_definition_key;
  const attrs = entry.claim.attributes || {};
  const features = {};
  if (definition === 'GOVERNING_LAW_STATE') {
    addFeature(features, 'governingLaw', {
      code: entry.claim.canonical_value,
      label: stateLabel(entry.claim.canonical_value),
      text: entry.claim.raw_value,
    });
  } else if (definition === 'FORUM_SELECTION_PROVISION') {
    addFeature(features, 'forumCourts', [attrs.primary_forum_ref || entry.claim.raw_value]);
  } else if (definition === 'FORUM_EXCLUSIVE') {
    addFeature(features, 'jurisdictionExclusive', true);
  } else if (definition === 'ASSIGNMENT_CONSENT_RESTRICTION') {
    addFeature(features, 'assignmentRestrictions', entry.claim.raw_value);
    addFeature(features, 'companyConsentForAssignment', true);
  } else if (definition === 'AMENDMENT_WRITTEN_INSTRUMENT') {
    addFeature(features, 'amendmentsRequirement', entry.claim.raw_value);
  } else if (definition === 'NOTICES_PROVISION') {
    addFeature(features, 'mainConcept', entry.claim.raw_value);
  } else if (definition === 'ENTIRE_AGREEMENT_INTEGRATION') {
    addFeature(features, 'mainConcept', entry.claim.raw_value);
  } else if (definition === 'NO_THIRD_PARTY_BENEFICIARIES') {
    addFeature(features, 'mainConcept', entry.claim.raw_value);
  } else if (definition === 'SEVERABILITY_PROVISION') {
    addFeature(features, 'severability', entry.claim.raw_value);
  } else if (definition === 'COUNTERPARTS_EXECUTION') {
    addFeature(features, 'counterparts', entry.claim.raw_value);
  }
  addFeature(features, 'mainConcept', entry.claim.raw_value);
  return features;
}

function mergeFeatures(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (['specificPerformanceLimitations', 'mainConcept'].includes(key)
      && typeof target[key] === 'string'
      && typeof value === 'string') {
      target[key] = [...new Set([target[key], value])].join('\n');
    } else addFeature(target, key, value);
  }
}

function featureClaims({ entry, dealId, excerptId, features }) {
  return Object.entries(features).map(([attribute, value], ordinal) => ({
    id: contentId('CANONICAL_V2_REMEDIES_MISC_PRODUCT_FEATURE_CLAIM/V1', {
      claim_revision_id: entry.claim.claim_revision_id,
      attribute,
      ordinal,
    }),
    deal_id: dealId,
    excerpt_id: excerptId,
    attribute,
    canonical: value,
    verbatim: entry.claim.raw_value,
    evidence_quote: entry.claim.raw_value,
    provenance: {
      code: entry.concept_key,
      feature_value: value,
      source: NATIVE_SOURCE,
      source_claim_definition_key: entry.resolved_claim_definition_key,
      source_claim_revision_id: entry.claim.claim_revision_id,
    },
  }));
}

function evidenceFamily(item) {
  const detail = String(item?.attributes?.why_unmapped || '');
  return /^(SOLE_REMEDY_EVIDENCE|FEE_ELECTION_EVIDENCE|DAMAGES_WAIVER|LITIGATION_EXTENSION|EXPEDITED_PROCEEDING):/.test(detail)
    ? 'SPECIFIC_PERFORMANCE_REMEDIES'
    : 'MISC_BOILERPLATE';
}

function projectRemediesMiscProductSurfaces({ resolution, deal_id: dealId } = {}) {
  if (!resolution || !Array.isArray(resolution.resolved) || !Array.isArray(resolution.open_world)) {
    throw new TypeError('resolution must contain resolved and open_world arrays');
  }
  if (typeof dealId !== 'string' || !dealId) throw new TypeError('deal_id must be a non-empty string');
  const groups = new Map();
  const claims = [];
  for (const entry of resolution.resolved) {
    const isRemedies = REMEDIES_DEFINITIONS.has(entry?.resolved_claim_definition_key)
      && ['REM-SP', 'REM-NONRECOURSE', 'REM-JURY'].includes(entry.concept_key);
    const isMisc = MISC_DEFINITIONS.has(entry?.resolved_claim_definition_key)
      && String(entry.concept_key || '').startsWith('ADMIN-');
    if (!isRemedies && !isMisc) continue;
    const provisionId = entry.provision_instance?.provision_instance_id;
    if (!provisionId || !entry.claim?.claim_revision_id) continue;
    const conceptKey = entry.concept_key;
    const groupKey = `${provisionId}:${conceptKey}`;
    const excerptId = `native:${provisionId}`;
    if (!groups.has(groupKey)) groups.set(groupKey, {
      provisionId: groupKey,
      sourceProvisionId: provisionId,
      excerptId,
      conceptKey,
      sectionRef: entry.section_reference,
      features: {},
      quotes: [],
      claimRevisionIds: [],
    });
    const group = groups.get(groupKey);
    const features = isRemedies ? remediesFeatures(entry) : miscFeatures(entry);
    mergeFeatures(group.features, features);
    group.quotes.push(entry.claim.raw_value);
    group.claimRevisionIds.push(entry.claim.claim_revision_id);
    claims.push(...featureClaims({ entry, dealId, excerptId, features }));
  }

  const cards = [...groups.values()].map((group) => {
    const quote = [...new Set(group.quotes)].join('\n');
    return {
      id: group.provisionId,
      provision_instance_id: group.sourceProvisionId,
      deal_id: dealId,
      excerpt_id: group.excerptId,
      type: 'MISC',
      provision_type: 'MISC_BOILERPLATE',
      provision_subtype: group.conceptKey,
      section_ref: group.sectionRef,
      short_title: group.conceptKey,
      primary_quote: quote,
      region_full_text: quote,
      full_text: quote,
      features: group.features,
      ai_metadata: { features: group.features, code: group.conceptKey },
      canonical_v2_lineage: {
        source: NATIVE_SOURCE,
        claim_revision_ids: [...new Set(group.claimRevisionIds)].sort(),
      },
    };
  });

  const openItems = resolution.open_world.filter((item) => (
    item?.claim_definition_key === 'OPEN_WORLD_PROPOSITION'
    && /^(SOLE_REMEDY_EVIDENCE|FEE_ELECTION_EVIDENCE|DAMAGES_WAIVER|LITIGATION_EXTENSION|EXPEDITED_PROCEEDING|GOVERNING_LAW|FORUM_FALLBACK|WAIVER_OR_SURVIVAL|CONSTRUCTION_OR_EXPENSES|TPB_EXCEPTION|ASSIGNMENT_DETAIL|NOTICE):/.test(String(item?.attributes?.why_unmapped || ''))
  ));
  const evidenceCards = openItems
    .filter((item) => !/^(SOLE_REMEDY_EVIDENCE|FEE_ELECTION_EVIDENCE):/.test(String(item?.attributes?.why_unmapped || '')))
    .map((item, ordinal) => {
    const family = evidenceFamily(item);
    return {
      id: contentId('CANONICAL_V2_REMEDIES_MISC_EVIDENCE_CARD/V1', { deal_id: dealId, closure_id: item.closure_id, ordinal }),
      deal_id: dealId,
      excerpt_id: `open-world:${item.closure_id}`,
      type: 'MISC',
      provision_type: 'MISC_BOILERPLATE',
      provision_subtype: family === 'SPECIFIC_PERFORMANCE_REMEDIES' ? 'REM-EVIDENCE' : 'ADMIN-EVIDENCE',
      section_ref: item.section_reference,
      short_title: family === 'SPECIFIC_PERFORMANCE_REMEDIES' ? 'Deferred remedies evidence' : 'Deferred boilerplate evidence',
      primary_quote: item.raw_value,
      region_full_text: item.raw_value,
      full_text: item.raw_value,
      features: {},
      ai_metadata: { features: {} },
      canonical_v2_lineage: { source: EVIDENCE_SOURCE, reason: item.reason, claim_revision_ids: [] },
    };
    });
  const body = {
    deal_id: dealId,
    source: NATIVE_SOURCE,
    cards: [...cards, ...evidenceCards].sort((a, b) => a.id.localeCompare(b.id)),
    claims: claims.sort((a, b) => a.id.localeCompare(b.id)),
    open_items: clone(openItems),
  };
  return freeze({
    schema_version: PROJECTION_SCHEMA,
    projection_id: contentId(PROJECTION_SCHEMA, body),
    ...clone(body),
  });
}

module.exports = {
  EVIDENCE_SOURCE,
  MISC_DEFINITIONS,
  NATIVE_SOURCE,
  PROJECTION_SCHEMA,
  REMEDIES_DEFINITIONS,
  projectRemediesMiscProductSurfaces,
};
