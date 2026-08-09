'use strict';

const { MATERIAL_CONTRACT_BUCKET_CODES } = require('../taxonomy');
const { canonicalJson, contentId } = require('./canonical-bytes');
const {
  MATERIAL_CONTRACT_BUCKET_PRESENT_CLAIM_DEFINITION_V1,
} = require('./contract-bundle');

const PROJECTION_SCHEMA = 'CANONICAL_V2_MATERIAL_CONTRACTS_PRODUCT_PROJECTION/V1';
const NATIVE_SOURCE = 'CANONICAL_V2_NATIVE_CLAIM';
const EVIDENCE_SOURCE = 'CANONICAL_V2_OPEN_WORLD_EVIDENCE';
const GOVERNED_BUCKETS = new Set(
  MATERIAL_CONTRACT_BUCKET_PRESENT_CLAIM_DEFINITION_V1.allowed_canonical_values,
);

function clone(value) {
  return JSON.parse(canonicalJson(value));
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function projectMaterialContractsProductSurfaces({ resolution, deal_id: dealId } = {}) {
  if (!resolution || !Array.isArray(resolution.resolved) || !Array.isArray(resolution.open_world)) {
    throw new TypeError('resolution must contain resolved and open_world arrays');
  }
  if (typeof dealId !== 'string' || !dealId) throw new TypeError('deal_id must be a non-empty string');
  const groups = new Map();
  const nonGovernedResolved = [];
  for (const entry of resolution.resolved) {
    if (entry?.concept_key !== 'REP-T-CONTRACTS') continue;
    if (!['MATERIAL_CONTRACT_BUCKET_PRESENT', 'MATERIAL_CONTRACT_THRESHOLD_STRUCTURE']
      .includes(entry.resolved_claim_definition_key)) continue;
    const provisionId = entry.provision_instance?.provision_instance_id;
    const claim = entry.claim;
    const bucketCode = claim?.attributes?.bucket_code;
    if (!provisionId || !claim?.claim_revision_id || !MATERIAL_CONTRACT_BUCKET_CODES[bucketCode]) continue;
    if (!GOVERNED_BUCKETS.has(bucketCode)) {
      nonGovernedResolved.push(entry);
      continue;
    }
    if (!groups.has(provisionId)) groups.set(provisionId, {
      provisionId,
      sectionRef: entry.section_reference,
      buckets: new Map(),
      claimRevisionIds: [],
      quotes: [],
    });
    const group = groups.get(provisionId);
    if (!group.buckets.has(bucketCode)) group.buckets.set(bucketCode, {
      code: bucketCode,
      label: MATERIAL_CONTRACT_BUCKET_CODES[bucketCode],
      text: claim.raw_value,
      quotes: [claim.raw_value],
      threshold: null,
      threshold_kind: null,
      cadence_kind: null,
    });
    const bucket = group.buckets.get(bucketCode);
    if (entry.resolved_claim_definition_key === 'MATERIAL_CONTRACT_THRESHOLD_STRUCTURE') {
      bucket.threshold = claim.attributes.threshold_value;
      bucket.threshold_kind = claim.canonical_value;
      bucket.cadence_kind = claim.attributes.cadence_kind;
    }
    group.claimRevisionIds.push(claim.claim_revision_id);
    group.quotes.push(claim.raw_value);
  }

  const cards = [...groups.values()].map((group) => {
    const materialContractsBuckets = [...group.buckets.values()].sort((a, b) => a.code.localeCompare(b.code));
    const quote = [...new Set(group.quotes)].join('\n');
    const features = { materialContractsBuckets };
    return {
      id: group.provisionId,
      provision_instance_id: group.provisionId,
      deal_id: dealId,
      excerpt_id: `native:${group.provisionId}`,
      type: 'REP-T',
      provision_type: 'REPRESENTATION',
      provision_subtype: 'REP-T-MATERIAL-CONTRACTS',
      section_ref: group.sectionRef,
      short_title: 'Material Contracts',
      primary_quote: quote,
      region_full_text: quote,
      full_text: quote,
      features,
      ai_metadata: { features, code: 'REP-T-MATERIAL-CONTRACTS' },
      canonical_v2_lineage: {
        source: NATIVE_SOURCE,
        claim_revision_ids: [...new Set(group.claimRevisionIds)].sort(),
      },
    };
  });

  const claims = cards.map((card) => ({
    id: contentId('CANONICAL_V2_MATERIAL_CONTRACTS_PRODUCT_FEATURE_CLAIM/V1', {
      provision_instance_id: card.provision_instance_id,
      materialContractsBuckets: card.features.materialContractsBuckets,
    }),
    deal_id: dealId,
    excerpt_id: card.excerpt_id,
    attribute: 'materialContractsBuckets',
    canonical: card.features.materialContractsBuckets,
    verbatim: card.primary_quote,
    evidence_quote: card.primary_quote,
    provenance: {
      code: 'REP-T-CONTRACTS',
      source: NATIVE_SOURCE,
      source_claim_revision_ids: card.canonical_v2_lineage.claim_revision_ids,
    },
  }));

  const openItems = resolution.open_world.filter((item) => (
    /^MATERIAL_CONTRACT_/.test(String(item?.reason || ''))
    || item?.extraction_provenance?.prompt_id === 'native-producer-material-contracts/v1'
    || /REP-T-CONTRACTS/.test(String(item?.attributes?.nearest_concept || item?.attributes?.why_unmapped || ''))
  ));
  for (const entry of nonGovernedResolved) {
    const claim = entry.claim || {};
    const retainedAsOpen = openItems.some((item) => (
      item?.closure_id === claim.closure_id
      && item?.raw_value === claim.raw_value
      && item?.section_reference === entry.section_reference
    ));
    if (!retainedAsOpen) {
      throw new TypeError('non-governed Material Contracts buckets must be retained as exact open-world evidence');
    }
  }
  for (const [index, item] of openItems.entries()) {
    if (typeof item?.closure_id !== 'string' || !item.closure_id.trim()
      || typeof item?.section_reference !== 'string' || !item.section_reference.trim()
      || typeof item?.raw_value !== 'string' || !item.raw_value.trim()
      || typeof item?.reason !== 'string' || !item.reason.trim()) {
      throw new TypeError(`open_world[${index}] must contain closure_id, section_reference, raw_value and reason`);
    }
  }
  const evidenceCards = openItems.map((item, ordinal) => ({
    id: contentId('CANONICAL_V2_MATERIAL_CONTRACTS_EVIDENCE_CARD/V1', {
      deal_id: dealId,
      closure_id: item.closure_id,
      ordinal,
    }),
    deal_id: dealId,
    excerpt_id: `open-world:${item.closure_id}`,
    type: 'REP-T',
    provision_type: 'REPRESENTATION',
    provision_subtype: 'REP-T-CONTRACTS-EVIDENCE',
    section_ref: item.section_reference,
    short_title: 'Deferred material-contract evidence',
    primary_quote: item.raw_value,
    region_full_text: item.raw_value,
    full_text: item.raw_value,
    features: {},
    ai_metadata: { features: {} },
    canonical_v2_lineage: { source: EVIDENCE_SOURCE, reason: item.reason, claim_revision_ids: [] },
  }));
  const body = {
    deal_id: dealId,
    source: NATIVE_SOURCE,
    cards: [...cards, ...evidenceCards].sort((a, b) => a.id.localeCompare(b.id)),
    claims,
    // Strip Step 2X-A structure_context at the bridge-facing boundary
    // (legacy-card-bridge keeps a closed open-item field set; annotation
    // stays on resolution.open_world for replay / native consumers).
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
  projectMaterialContractsProductSurfaces,
};
