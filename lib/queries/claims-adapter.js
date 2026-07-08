// Rebuilds provision_cards[].features from the flat `claims` table so the
// existing table-configs (components/review/table-configs/*.config.js) light
// up unchanged. See card-utils.js's cardFeatures()/firstFeature()/valueText()
// and the per-config readableValue()/readableFeatureValue() implementations
// for the shapes this module targets.
//
// Convention mirrored from lib/parser-v2/extract.js: taxonomy-coded feature
// values are TAGGED objects `{ code, label, text, quotes }` (code drawn from
// a taxonomy dictionary, label the human-readable form, text the verbatim
// source phrase, quotes an array of supporting evidence spans). Plain
// string/number/boolean features are left as raw primitives, matching how
// the pre-claims extraction pipeline populated card.features. List-valued
// attributes (lib/schema/features.js valueType 'list') always render as an
// ARRAY, even when only one claim row exists, to satisfy list-family configs
// (e.g. MAE carve-outs, material-contracts buckets) that always .map() the
// feature value.
const { FEATURES } = require('../schema/features');
const taxonomy = require('../taxonomy');

const {
  taxonomyForFeatureKey,
  labelForCode,
  normalizeToCode,
  MAE_CARVEOUT_META,
  MATERIAL_CONTRACT_BUCKET_META,
  MERGER_FORMS_META,
  REMEDY_TYPE_META,
  KNOWLEDGE_STANDARD_META,
  KNOWLEDGE_PERSON_META,
  ABSENCE_OF_CHANGES_TYPE_META,
  IOC_AFFIRMATIVE_STANDARD_META,
  IOC_AFFIRMATIVE_SCOPE_META,
  IOC_CATEGORY_META,
  SEC_FILING_EXCLUSION_META,
} = taxonomy;

// Attributes whose canonical code can be re-derived from verbatim text via
// synonym matching when the claims backfill left `canonical` null (common
// per the claims-table contract). Mirrors the feature-key -> dictionary
// pairing in lib/taxonomy.js#taxonomyForFeatureKey, limited to the keys that
// have a `_META` (synonym-bearing) counterpart exported.
const META_BY_ATTRIBUTE = {
  mergerForm: MERGER_FORMS_META,
  carveouts: MAE_CARVEOUT_META,
  disproportionateImpactCarveouts: MAE_CARVEOUT_META,
  nonDisproportionateImpactCarveouts: MAE_CARVEOUT_META,
  dollarThresholdsByCategory: IOC_CATEGORY_META,
  materialContractsBuckets: MATERIAL_CONTRACT_BUCKET_META,
  parentRemedyObligation: REMEDY_TYPE_META,
  knowledgeStandard: KNOWLEDGE_STANDARD_META,
  knowledgePersons: KNOWLEDGE_PERSON_META,
  absenceOfChangesType: ABSENCE_OF_CHANGES_TYPE_META,
  iocAffirmativeStandard: IOC_AFFIRMATIVE_STANDARD_META,
  iocAffirmativeScope: IOC_AFFIRMATIVE_SCOPE_META,
  appliesTo: IOC_AFFIRMATIVE_SCOPE_META,
  secFilingsExceptionExclusions: SEC_FILING_EXCLUSION_META,
  secFilingsExcludedSections: SEC_FILING_EXCLUSION_META,
};

function groupClaimsByExcerpt(claims) {
  const map = new Map();
  for (const claim of Array.isArray(claims) ? claims : []) {
    if (!claim || !claim.excerpt_id) continue;
    if (!map.has(claim.excerpt_id)) map.set(claim.excerpt_id, []);
    map.get(claim.excerpt_id).push(claim);
  }
  return map;
}

function claimOrder(a, b) {
  const ta = a.created_at ? Date.parse(a.created_at) : NaN;
  const tb = b.created_at ? Date.parse(b.created_at) : NaN;
  if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return ta - tb;
  return String(a.id || '').localeCompare(String(b.id || ''));
}

function humanizeCode(code) {
  return String(code)
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (ch) => ch.toUpperCase())
    .trim();
}

function deriveCode(attribute, claim) {
  if (claim.canonical) return String(claim.canonical);
  const meta = META_BY_ATTRIBUTE[attribute];
  if (meta && claim.verbatim) return normalizeToCode(String(claim.verbatim), meta);
  return null;
}

function resolveLabel(attribute, code, fallbackText) {
  const dict = taxonomyForFeatureKey(attribute);
  const resolved = code && dict ? labelForCode(String(code), dict) : null;
  if (resolved) return resolved;
  if (code) return humanizeCode(code);
  return fallbackText || null;
}

// Registry says whether an attribute is taxonomy-coded ("tagged") — true for
// list attributes whose listItemType is 'tag', and for scalar 'enum'/'object'
// attributes (extract.js emits these as { code, label, text } too; see e.g.
// consentStandard, litigationObligation, consultationTier). Returns null when
// the registry doesn't know the key so callers can fall back to a heuristic.
function isTaggedRegistryEntry(registryEntry) {
  if (!registryEntry) return null;
  if (registryEntry.valueType === 'list') return registryEntry.listItemType === 'tag';
  return registryEntry.valueType === 'enum' || registryEntry.valueType === 'object';
}

function isTaggedAttribute(attribute, registryEntry, claim) {
  const declared = isTaggedRegistryEntry(registryEntry);
  if (declared !== null) return declared;
  return Boolean(claim.canonical) || Boolean(taxonomyForFeatureKey(attribute));
}

function buildTaggedValue(attribute, claim) {
  const code = deriveCode(attribute, claim);
  const text = claim.verbatim ? String(claim.verbatim) : null;
  const label = resolveLabel(attribute, code, text);
  const quotes = claim.evidence_quote ? [claim.evidence_quote] : [];
  return { code: code || null, label, text, quotes };
}

function coerceScalar(valueType, raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  if (valueType === 'boolean') {
    if (typeof raw === 'boolean') return raw;
    const normalized = String(raw).trim().toLowerCase();
    if (['true', 'yes', 'y', '1'].includes(normalized)) return true;
    if (['false', 'no', 'n', '0'].includes(normalized)) return false;
    return Boolean(raw);
  }
  if (valueType === 'number') {
    const num = Number(raw);
    return Number.isFinite(num) ? num : String(raw);
  }
  return String(raw);
}

function buildRawValue(registryEntry, claim) {
  const raw = claim.canonical ?? claim.verbatim;
  const valueType = registryEntry
    ? (registryEntry.valueType === 'list' ? registryEntry.listItemType : registryEntry.valueType)
    : 'string';
  return coerceScalar(valueType, raw);
}

// Only one registered attribute currently declares an objectShape
// (materialContractsDollarThresholds: { bucket, threshold, text }). Claims
// rows are flat, so a JSON-encoded verbatim is the only way a backfill can
// carry a multi-field item; best-effort parse it, else degrade to a tagged
// shape carrying the raw text so the row still renders instead of vanishing.
function buildObjectItemValue(claim) {
  let parsed = null;
  if (typeof claim.verbatim === 'string') {
    try {
      const candidate = JSON.parse(claim.verbatim);
      if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) parsed = candidate;
    } catch {
      parsed = null;
    }
  } else if (claim.verbatim && typeof claim.verbatim === 'object') {
    parsed = claim.verbatim;
  }
  const quotes = claim.evidence_quote ? [claim.evidence_quote] : [];
  if (parsed) {
    return { text: claim.verbatim, quotes, ...parsed };
  }
  return {
    code: claim.canonical || null,
    text: claim.verbatim ? String(claim.verbatim) : null,
    quotes,
  };
}

function buildItemValue(attribute, claim, registryEntry) {
  if (!claim) return undefined;
  if (registryEntry && registryEntry.valueType === 'list' && registryEntry.listItemType === 'object') {
    return buildObjectItemValue(claim);
  }
  if (isTaggedAttribute(attribute, registryEntry, claim)) {
    return buildTaggedValue(attribute, claim);
  }
  return buildRawValue(registryEntry, claim);
}

function buildAttributeValue(attribute, claims) {
  const registryEntry = FEATURES[attribute] || null;
  const ordered = [...claims].sort(claimOrder);
  const isList = registryEntry ? registryEntry.valueType === 'list' : ordered.length > 1;
  if (isList) {
    return ordered
      .map((claim) => buildItemValue(attribute, claim, registryEntry))
      .filter((value) => value !== undefined);
  }
  return buildItemValue(attribute, ordered[0], registryEntry);
}

// Given the claims belonging to a single card (already filtered by
// excerpt_id), group by attribute and rebuild each attribute's value per its
// declared valueType. Absent attributes are simply omitted — never emitted
// as null/empty so "attribute absent" reliably means "row doesn't render".
function buildFeaturesForCard(claims) {
  const features = {};
  const grouped = new Map();
  for (const claim of Array.isArray(claims) ? claims : []) {
    if (!claim || !claim.attribute) continue;
    if (!grouped.has(claim.attribute)) grouped.set(claim.attribute, []);
    grouped.get(claim.attribute).push(claim);
  }
  for (const [attribute, claimList] of grouped) {
    const value = buildAttributeValue(attribute, claimList);
    if (value === undefined || value === null) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    features[attribute] = value;
  }
  return features;
}

module.exports = {
  buildAttributeValue,
  buildFeaturesForCard,
  buildItemValue,
  buildObjectItemValue,
  buildTaggedValue,
  claimOrder,
  deriveCode,
  groupClaimsByExcerpt,
  humanizeCode,
  resolveLabel,
};
