'use strict';

const { CODES } = require('../rubric');
const { canonicalJson, contentId } = require('./canonical-bytes');
const { filterResolvedEntriesForPublication } = require('./publication-serving-filter');
const { GENERAL_COVENANT_FOLLOW_ON_OWNERS } = require('./p0-product-surface-routing');

const PROJECTION_SCHEMA = 'CANONICAL_V2_GENERAL_COVENANTS_PRODUCT_PROJECTION/V1';
const NATIVE_SOURCE = 'CANONICAL_V2_NATIVE_CLAIM';
const EVIDENCE_SOURCE = 'CANONICAL_V2_OPEN_WORLD_EVIDENCE';

function clone(value) {
  return JSON.parse(canonicalJson(value));
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function projectGeneralCovenantsProductSurfaces({ resolution, deal_id: dealId, publication_filter: publicationFilter, release_receipt_id: releaseReceiptId, publication_evaluation_time: publicationEvaluationTime } = {}) {
  if (!resolution || !Array.isArray(resolution.resolved) || !Array.isArray(resolution.open_world)) {
    throw new TypeError('resolution must contain resolved and open_world arrays');
  }
  if (typeof dealId !== 'string' || !dealId) throw new TypeError('deal_id must be a non-empty string');
  const groups = new Map();
  for (const entry of filterResolvedEntriesForPublication(resolution.resolved, publicationFilter, releaseReceiptId, publicationEvaluationTime)) {
    const code = entry?.concept_key;
    const claim = entry?.claim;
    const provisionId = entry?.provision_instance?.provision_instance_id;
    if (entry?.resolved_claim_definition_key !== 'GENERAL_COVENANT_PRESENT'
      || !GENERAL_COVENANT_FOLLOW_ON_OWNERS[code]
      || claim?.canonical_value !== code
      || !claim?.claim_revision_id
      || !provisionId) continue;
    if (!groups.has(provisionId)) groups.set(provisionId, {
      provisionId,
      code,
      sectionRef: entry.section_reference,
      quotes: [],
      claimRevisionIds: [],
    });
    groups.get(provisionId).quotes.push(claim.raw_value);
    groups.get(provisionId).claimRevisionIds.push(claim.claim_revision_id);
  }
  const cards = [...groups.values()].map((group) => {
    const quote = [...new Set(group.quotes)].join('\n');
    const claimRevisionIds = [...new Set(group.claimRevisionIds)].sort();
    const features = { mainConcept: quote };
    return {
      id: group.provisionId,
      provision_instance_id: group.provisionId,
      deal_id: dealId,
      excerpt_id: `native:${group.provisionId}`,
      type: 'COV',
      provision_type: 'COVENANT_OTHER',
      provision_subtype: group.code,
      section_ref: group.sectionRef,
      short_title: CODES[group.code].label,
      primary_quote: quote,
      region_full_text: quote,
      full_text: quote,
      features,
      ai_metadata: { features, code: group.code },
      canonical_v2_lineage: {
        source: NATIVE_SOURCE,
        owner_id: GENERAL_COVENANT_FOLLOW_ON_OWNERS[group.code],
        claim_revision_ids: claimRevisionIds,
      },
    };
  });
  const claims = cards.map((card) => ({
      id: contentId('CANONICAL_V2_GENERAL_COVENANT_PRODUCT_FEATURE_CLAIM/V1', {
        provision_instance_id: card.provision_instance_id,
        code: card.provision_subtype,
        mainConcept: card.features.mainConcept,
      }),
      deal_id: dealId,
      excerpt_id: card.excerpt_id,
      attribute: 'mainConcept',
      canonical: card.features.mainConcept,
      verbatim: card.features.mainConcept,
      evidence_quote: card.features.mainConcept,
      provenance: {
        code: card.provision_subtype,
        source: NATIVE_SOURCE,
        source_claim_revision_ids: card.canonical_v2_lineage.claim_revision_ids,
      },
    }));

  const openItems = resolution.open_world.filter((item) => (
    /^GENERAL_COVENANT_/.test(String(item?.reason || ''))
    || item?.extraction_provenance?.prompt_id === 'native-producer-general-covenants/v1'
    || item?.attributes?.nearest_concept === 'GENERAL_COVENANT_ROUTER'
  ));
  const evidenceCards = openItems.map((item, ordinal) => ({
    id: contentId('CANONICAL_V2_GENERAL_COVENANT_EVIDENCE_CARD/V1', {
      deal_id: dealId,
      closure_id: item.closure_id,
      ordinal,
    }),
    deal_id: dealId,
    excerpt_id: `open-world:${item.closure_id}`,
    type: 'COV',
    provision_type: 'COVENANT_OTHER',
    provision_subtype: 'COV-UNTYPED-EVIDENCE',
    section_ref: item.section_reference,
    short_title: 'Deferred general-covenant evidence',
    primary_quote: item.raw_value,
    region_full_text: item.raw_value,
    full_text: item.raw_value,
    features: {},
    ai_metadata: { features: {} },
    canonical_v2_lineage: {
      source: EVIDENCE_SOURCE,
      reason: item.reason,
      claim_revision_ids: [],
    },
  }));
  const body = {
    deal_id: dealId,
    source: NATIVE_SOURCE,
    cards: [...cards, ...evidenceCards].sort((a, b) => a.id.localeCompare(b.id)),
    claims,
    // Strip Step 2X-A structure_context at the bridge-facing boundary
    // (dark bridges keep a closed open-item field set; annotation stays on
    // resolution.open_world for replay / native consumers).
    open_items: clone(openItems.map((item) => {
      if (!item || typeof item !== 'object' || !Object.hasOwn(item, 'structure_context')) return item;
      const { structure_context: _sc, ...rest } = item;
      return rest;
    })),
  };
  return freeze({
    schema_version: PROJECTION_SCHEMA,
    projection_id: contentId(PROJECTION_SCHEMA, body),
    ...clone(body),
  });
}

module.exports = {
  EVIDENCE_SOURCE,
  NATIVE_SOURCE,
  PROJECTION_SCHEMA,
  projectGeneralCovenantsProductSurfaces,
};
