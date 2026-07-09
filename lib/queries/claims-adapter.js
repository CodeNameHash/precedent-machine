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
  isValidTaxonomyCode,
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

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

// True when `verbatim` looks like a JSON-encoded object (as opposed to a
// bare taxonomy code, a number, or free-text prose). Claims backfills for
// several attributes wrap the extract.js payload in an envelope
// `{"value":{...},"quotes":[]}` and store THAT as verbatim (canonical left
// null); other attributes store a flat JSON object directly (no envelope).
// Both shapes need to go through buildObjectItemValue's JSON parsing rather
// than being naively stringified, or the read view shows raw JSON.
function looksLikeJsonObjectVerbatim(verbatim) {
  if (typeof verbatim !== 'string') return false;
  const trimmed = verbatim.trim();
  return trimmed.startsWith('{') && trimmed.endsWith('}');
}

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
  const verbatim = claim.verbatim ? String(claim.verbatim).trim() : null;
  // Claims backfills sometimes store the raw enum code itself as `verbatim`
  // (no distinguishing prose captured, `canonical` left null). If verbatim
  // already IS a valid code in this attribute's taxonomy dictionary, use it
  // directly -- the synonym-regex matching below expects natural-language
  // phrasing (e.g. "reverse triangular merger") and won't match an
  // underscore-joined enum string like "REVERSE_TRIANGULAR_MERGER".
  const dict = taxonomyForFeatureKey(attribute);
  if (dict && verbatim && isValidTaxonomyCode(verbatim, dict)) return verbatim;
  const meta = META_BY_ATTRIBUTE[attribute];
  if (meta && verbatim) return normalizeToCode(verbatim, meta);
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
// list attributes whose listItemType is 'tag', for scalar 'enum' attributes,
// and for scalar 'object' attributes that are ALSO taxonomy-coded (extract.js
// emits these as { code, label, text } too; see e.g. consentStandard,
// litigationObligation, consultationTier — all have a dictionary registered
// in taxonomyForFeatureKey). Scalar 'object' attributes with no taxonomy
// dictionary (e.g. interestOnLatePayment "object { rate, base }", collar,
// mailingDeadline) are NOT tag-driven — they are multi-field structured
// objects whose verbatim is JSON-encoded, so they go through the
// object-parsing path (buildObjectItemValue) instead of being stringified
// into a fake { code, label, text } shape. Returns null when the registry
// doesn't know the key so callers can fall back to a heuristic.
function isTaggedRegistryEntry(registryEntry, attribute) {
  if (!registryEntry) return null;
  if (registryEntry.valueType === 'list') return registryEntry.listItemType === 'tag';
  if (registryEntry.valueType === 'enum') return true;
  if (registryEntry.valueType === 'object') return Boolean(taxonomyForFeatureKey(attribute));
  return false;
}

function isTaggedAttribute(attribute, registryEntry, claim) {
  const declared = isTaggedRegistryEntry(registryEntry, attribute);
  if (declared !== null) return declared;
  return Boolean(claim.canonical) || Boolean(taxonomyForFeatureKey(attribute));
}

// True for a registered attribute whose value is a structured object with no
// taxonomy backing — either a LIST of such objects (listItemType 'object'),
// or a SCALAR 'object'-typed attribute that isn't tag-driven per
// isTaggedRegistryEntry above. Both shapes are best-effort JSON-parsed from
// `verbatim` by buildObjectItemValue.
function isStructuredObjectAttribute(registryEntry, attribute) {
  if (!registryEntry) return false;
  if (registryEntry.valueType === 'list') return registryEntry.listItemType === 'object';
  if (registryEntry.valueType === 'object') return !isTaggedRegistryEntry(registryEntry, attribute);
  return false;
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

// Handles both LIST items with listItemType 'object' (e.g.
// materialContractsDollarThresholds: { bucket, threshold, text }) and SCALAR
// attributes with valueType 'object' that aren't taxonomy-coded (e.g.
// interestOnLatePayment: { rate, base }, collar, mailingDeadline). Claims
// rows are flat, so a JSON-encoded verbatim is the only way a backfill can
// carry a multi-field value; best-effort parse it, else degrade to a shape
// carrying the raw text so the row still renders instead of vanishing or
// showing a raw JSON blob.
function buildObjectItemValue(claim) {
  let parsed = null;
  if (typeof claim.verbatim === 'string') {
    try {
      const candidate = JSON.parse(claim.verbatim);
      if (isPlainObject(candidate)) parsed = candidate;
    } catch {
      parsed = null;
    }
  } else if (isPlainObject(claim.verbatim)) {
    parsed = claim.verbatim;
  }
  const quotes = claim.evidence_quote ? [claim.evidence_quote] : [];
  if (parsed) {
    // extract.js's tagged-attribute backfill wraps the real payload in an
    // envelope `{ value: {...}, quotes: [...] }` (e.g. materialityQualifier,
    // hsrFilingDeadlineBusinessDays, regulatoryStrategyControlTagged).
    // Unwrap it so the payload's own fields (code/label/text/scope/days/
    // unit/...) sit directly on the returned object -- the shape
    // valueText()'s tagged-shape and generic field-listing branches both
    // expect -- instead of nesting under a `.value` key that would
    // otherwise stringify into a raw JSON dump.
    const envelopeFields = isPlainObject(parsed.value) ? parsed.value : null;
    const fields = envelopeFields || parsed;
    const envelopeQuotes = envelopeFields && Array.isArray(parsed.quotes) ? parsed.quotes : null;
    const result = { text: claim.verbatim, quotes: envelopeQuotes || quotes, ...fields };
    // A canonical code on the claim row is more authoritative than any code
    // carried inside the verbatim envelope (backfill may have tagged the
    // claim after extraction); let it win when present.
    if (claim.canonical) result.code = String(claim.canonical);
    return result;
  }
  return {
    code: claim.canonical || null,
    text: claim.verbatim ? String(claim.verbatim) : null,
    quotes,
  };
}

function buildItemValue(attribute, claim, registryEntry) {
  if (!claim) return undefined;
  if (isStructuredObjectAttribute(registryEntry, attribute)) {
    return buildObjectItemValue(claim);
  }
  if (isTaggedAttribute(attribute, registryEntry, claim)) {
    // Tagged (taxonomy-coded) attributes are normally a { code, label, text
    // } scalar whose verbatim is either the code itself or free prose. Some
    // claims backfills instead carry the extract.js tagged ENVELOPE
    // `{"value":{code,label,text,...},"quotes":[]}` as verbatim (canonical
    // sometimes populated, sometimes not) -- buildTaggedValue's code/text
    // derivation can't unwrap that JSON string, so it leaks as the raw
    // blob. Route those rows through the object-parsing path instead: it
    // already knows how to flatten a `.value` envelope, and valueText()'s
    // tagged-shape branch (value.label || value.code) still renders the
    // unwrapped result as a friendly label, not JSON.
    if (looksLikeJsonObjectVerbatim(claim.verbatim)) {
      return buildObjectItemValue(claim);
    }
    return buildTaggedValue(attribute, claim);
  }
  // Non-tagged, non-structured attributes are usually a plain scalar
  // (buildRawValue). A few (hsrFilingDeadlineBusinessDays,
  // otherRegulatoryFilingDeadlines, positiveObligations, ...) are declared
  // 'number'/'list-of-string' in the registry but the backfill actually
  // stores a JSON object (enveloped or flat) as verbatim -- coercing that
  // to a number/string just stringifies the raw JSON. Parse it as a
  // structured object instead of dumping the blob.
  if (looksLikeJsonObjectVerbatim(claim.verbatim)) {
    return buildObjectItemValue(claim);
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
  isStructuredObjectAttribute,
  isTaggedAttribute,
  isTaggedRegistryEntry,
  resolveLabel,
};
