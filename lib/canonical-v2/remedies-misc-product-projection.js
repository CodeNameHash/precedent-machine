'use strict';

const { canonicalJson, contentId } = require('./canonical-bytes');
const { filterResolvedEntriesForPublication } = require('./publication-serving-filter');
const {
  SPECIFIC_PERFORMANCE_ASSERTION_KINDS,
  MISC_ASSERTION_KINDS,
} = require('./native-producer/anthropic-provider');

const PROJECTION_SCHEMA = 'CANONICAL_V2_REMEDIES_MISC_PRODUCT_PROJECTION/V1';
const NATIVE_SOURCE = 'CANONICAL_V2_NATIVE_CLAIM';
const EVIDENCE_SOURCE = 'CANONICAL_V2_OPEN_WORLD_EVIDENCE';

// PLAN.md Step 2D1 defect 3 (2026-08-07): candidate-resolution.js's
// MISC_BOILERPLATE_CLAIM_KEY/SPECIFIC_PERFORMANCE_REMEDY_CLAIM_KEY branches
// (see its own comment at the `handlePresenceCarrier` call sites) emit
// exactly two generic presence claims -- SPECIFIC_PERFORMANCE_REMEDY_PRESENT
// at concept REMEDY-SPECIFIC-PERFORMANCE, and MISC_BOILERPLATE_MECHANIC_
// PRESENT at concept MISC-BOILERPLATE, sub-typed only by a claim.attributes.
// assertion_kind drawn from SPECIFIC_PERFORMANCE_ASSERTION_KINDS/
// MISC_ASSERTION_KINDS below. Both keys write correctly (confirmed on the
// committed modiv-specific-performance-20260807-replay and modiv-misc-
// boilerplate-20260807-replay runs) and used to drop silently to zero cards
// here, because this module's REMEDIES_DEFINITIONS/MISC_DEFINITIONS sets
// named an older, finer-grained vocabulary (GOVERNING_LAW_STATE,
// FORUM_SELECTION_PROVISION, ...) the resolver never emits, and MISC's
// concept check required an 'ADMIN-' prefix no live concept carries. Fixed
// by recognising the two real keys directly and deriving features from
// assertion_kind rather than from a definition-key switch that no claim
// ever hits. The old ten MISC_DEFINITIONS entries and their ADMIN-* concepts
// stay registered: tests/canonical-v2-remedies-misc-product-parity.test.js
// still hand-builds them, and nothing in the resolver's own comment says
// they are wrong, only that nothing emits them today.
const REMEDIES_DEFINITIONS = new Set([
  'SPECIFIC_PERFORMANCE_AVAILABLE',
  'SPECIFIC_PERFORMANCE_FINANCING_CONDITION',
  'SP_BOND_SECURITY_WAIVER',
  'NON_RECOURSE_PROVISION',
  'JURY_TRIAL_WAIVER',
  'SOLE_REMEDY_LEGAL_EFFECT_PRESENT',
  'SOLE_REMEDY_CARVEOUT_KIND',
  'SPECIFIC_PERFORMANCE_REMEDY_PRESENT',
]);
const REMEDIES_CONCEPTS = new Set([
  'REM-SP',
  'REM-NONRECOURSE',
  'REM-JURY',
  'REMEDY-SPECIFIC-PERFORMANCE',
  'REM-SOLE',
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
  'MISC_BOILERPLATE_MECHANIC_PRESENT',
]);
// The one concept key the live MISC_BOILERPLATE_MECHANIC_PRESENT claim
// resolves under (candidate-resolution.js's handlePresenceCarrier call).
// Kept alongside the legacy 'ADMIN-' prefix rather than replacing it, since
// the parity test's ten legacy definitions still resolve under ADMIN-*.
const MISC_CONCEPT_KEY = 'MISC-BOILERPLATE';
// Concept-key prefixes MATERIALITY_TABLE (candidate-resolution.js) assigns
// to this module's two families (REMEDIES at rank 25; NOTICES_ADMINISTRATIVE
// at rank 90, which also owns MISC_CONCEPT_KEY above). Used only by the
// zero-match guard below to tell "this deal genuinely has none of this
// family's provisions" apart from "a claim resolved under a concept this
// module owns and neither membership set recognised it" -- the second is
// exactly how defect 3 hid, and must fail loudly instead of returning an
// empty card list.
const GOVERNED_FAMILY_CONCEPT_PREFIXES = Object.freeze({
  SPECIFIC_PERFORMANCE_REMEDIES: Object.freeze(['REM-', 'REMEDY-']),
  MISC_BOILERPLATE: Object.freeze(['ADMIN-', 'NOTICE-']),
});

class RemediesMiscProjectionError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'RemediesMiscProjectionError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details = {}) {
  throw new RemediesMiscProjectionError(code, message, details);
}

// A concept this module owns by prefix (or by MISC_CONCEPT_KEY), for an
// entry neither isRemedies nor isMisc accepted -- membership-set drift, not
// a genuine zero. See the guard at the top of the resolved-entries loop.
function ownedFamilyFor(conceptKey) {
  const key = String(conceptKey || '');
  if (key === MISC_CONCEPT_KEY) return 'MISC_BOILERPLATE';
  for (const [family, prefixes] of Object.entries(GOVERNED_FAMILY_CONCEPT_PREFIXES)) {
    if (prefixes.some((prefix) => key.startsWith(prefix))) return family;
  }
  return null;
}

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
  } else if (definition === 'SOLE_REMEDY_LEGAL_EFFECT_PRESENT') {
    addFeature(features, 'soleRemedy', true);
    addFeature(features, 'soleRemedyFeeContext', entry.linked_fee_context || null);
  } else if (definition === 'SOLE_REMEDY_CARVEOUT_KIND') {
    addFeature(features, 'soleRemedyCarveOuts', [entry.claim.canonical_value]);
  } else if (definition === 'SPECIFIC_PERFORMANCE_REMEDY_PRESENT') {
    // Generic presence carrier (see the module header comment): the only
    // sub-typing available is attrs.assertion_kind, and
    // SPECIFIC_PERFORMANCE_ASSERTION_KINDS names exactly one kind. A kind
    // outside that enum means the resolver's vocabulary moved and this
    // module did not -- fail loudly rather than mislabel it.
    if (!SPECIFIC_PERFORMANCE_ASSERTION_KINDS.includes(attrs.assertion_kind)) {
      fail(
        'REMEDIES_ASSERTION_KIND_UNMAPPED',
        `SPECIFIC_PERFORMANCE_REMEDY_PRESENT resolved with assertion_kind ${JSON.stringify(attrs.assertion_kind)}, `
        + "which lib/canonical-v2/native-producer/anthropic-provider.js's SPECIFIC_PERFORMANCE_ASSERTION_KINDS does not name.",
        { assertion_kind: attrs.assertion_kind },
      );
    }
    addFeature(features, 'specificPerformance', true);
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
  } else if (definition === 'MISC_BOILERPLATE_MECHANIC_PRESENT') {
    // Generic presence carrier: claim.attributes carries only
    // assertion_kind (candidate-resolution.js's handlePresenceCarrier),
    // never a parsed governing-law code, forum reference or similar
    // structured value, so mainConcept (the raw quote, added unconditionally
    // below) is the only honest feature -- inventing structure the claim
    // does not carry would be a fact the extraction never proved. An
    // assertion_kind outside MISC_ASSERTION_KINDS means the resolver's
    // vocabulary moved and this module did not.
    if (!MISC_ASSERTION_KINDS.includes(attrs.assertion_kind)) {
      fail(
        'MISC_ASSERTION_KIND_UNMAPPED',
        `MISC_BOILERPLATE_MECHANIC_PRESENT resolved with assertion_kind ${JSON.stringify(attrs.assertion_kind)}, `
        + "which lib/canonical-v2/native-producer/anthropic-provider.js's MISC_ASSERTION_KINDS does not name.",
        { assertion_kind: attrs.assertion_kind },
      );
    }
    addFeature(features, 'assertionKind', attrs.assertion_kind);
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

function projectRemediesMiscProductSurfaces({ resolution, deal_id: dealId, publication_filter: publicationFilter, release_receipt_id: releaseReceiptId, publication_evaluation_time: publicationEvaluationTime } = {}) {
  if (!resolution || !Array.isArray(resolution.resolved) || !Array.isArray(resolution.open_world)) {
    throw new TypeError('resolution must contain resolved and open_world arrays');
  }
  if (typeof dealId !== 'string' || !dealId) throw new TypeError('deal_id must be a non-empty string');
  const groups = new Map();
  const claims = [];
  for (const entry of filterResolvedEntriesForPublication(resolution.resolved, publicationFilter, releaseReceiptId, publicationEvaluationTime)) {
    const isRemedies = REMEDIES_DEFINITIONS.has(entry?.resolved_claim_definition_key)
      && REMEDIES_CONCEPTS.has(entry.concept_key);
    const isMisc = MISC_DEFINITIONS.has(entry?.resolved_claim_definition_key)
      && (entry.concept_key === MISC_CONCEPT_KEY || String(entry.concept_key || '').startsWith('ADMIN-'));
    if (!isRemedies && !isMisc) {
      // PLAN.md Step 2D1 defect 3: this is exactly the shape the bug had --
      // a claim resolves under a concept this module owns
      // (GOVERNED_FAMILY_CONCEPT_PREFIXES / MISC_CONCEPT_KEY) and neither
      // membership set recognised its claim-definition key. That is
      // membership-set drift, not a deal genuinely lacking the provision,
      // and must fail loudly rather than silently produce zero cards.
      const ownedFamily = ownedFamilyFor(entry?.concept_key);
      if (ownedFamily) {
        fail(
          'UNMAPPED_FAMILY_CLAIM_DEFINITION',
          `${entry?.resolved_claim_definition_key} resolves under concept ${entry?.concept_key}, which this module `
          + `owns as ${ownedFamily}, but the claim-definition key is not in REMEDIES_DEFINITIONS or MISC_DEFINITIONS. `
          + 'Add it to lib/canonical-v2/remedies-misc-product-projection.js.',
          { concept_key: entry?.concept_key, resolved_claim_definition_key: entry?.resolved_claim_definition_key },
        );
      }
      continue;
    }
    const provisionId = entry.provision_instance?.provision_instance_id;
    if (!provisionId || !entry.claim?.claim_revision_id) continue;
    const conceptKey = entry.concept_key;
    const groupKey = entry.resolved_claim_definition_key === 'MISC_BOILERPLATE_MECHANIC_PRESENT'
      ? `${provisionId}:${conceptKey}:${entry.claim.claim_revision_id}`
      : `${provisionId}:${conceptKey}`;
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
  MISC_CONCEPT_KEY,
  MISC_DEFINITIONS,
  NATIVE_SOURCE,
  PROJECTION_SCHEMA,
  RemediesMiscProjectionError,
  REMEDIES_DEFINITIONS,
  REMEDIES_CONCEPTS,
  projectRemediesMiscProductSurfaces,
};
