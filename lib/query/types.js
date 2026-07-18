const { FEATURES } = require('../rubric');
const { familyType, provisionCode } = require('../expected-sets');
const { boolValue, codedValue, enumValue, numericValue, setItems } = require('../feature-compare');
const { aliasesForKey, featureEntry, resolveFeatureValue, resolveKey } = require('./resolve');
const { derivedFieldDef, computeDerivedField } = require('./derived-fields');

const QUERY_KINDS = [
  'DEAL_COMPARE',
  'PROVISION_CROSS_CUT',
  'MARKET_RANGE',
  'FILTER_THEN_LIST',
  'DEAL_TO_MARKET',
];

const KIND_SLUGS = {
  DEAL_COMPARE: 'deal-compare',
  PROVISION_CROSS_CUT: 'provision-cross-cut',
  MARKET_RANGE: 'market-range',
  FILTER_THEN_LIST: 'filter-then-list',
  DEAL_TO_MARKET: 'deal-to-market',
};

const SLUG_TO_KIND = Object.fromEntries(Object.entries(KIND_SLUGS).map(([kind, slug]) => [slug, kind]));

const PROVISION_CARD_TYPES = [
  'CONSIDERATION',
  'REPRESENTATION',
  'MATERIAL_CONTRACT',
  'CLOSING_CONDITION',
  'COVENANT_INTERIM_OPERATING',
  'COVENANT_NO_SOLICITATION',
  'COVENANT_OTHER',
  'TERMINATION_RIGHT',
  'TERMINATION_FEE',
  'DEFINITION',
  'ANTITRUST_REGULATORY',
  'SEC_FILING_MEETING',
  'EMPLOYEE_BENEFITS',
  'STRUCTURE_MECHANICS',
  'MAE',
  'NO_OTHER_REPS',
  'MISC_BOILERPLATE',
];

const WP_TO_FAMILY = {
  CONSIDERATION: ['CONSID'],
  REPRESENTATION: ['REP-T', 'REP-B'],
  MATERIAL_CONTRACT: ['REP-T'],
  CLOSING_CONDITION: ['COND-M', 'COND-B', 'COND-S', 'COND'],
  COVENANT_INTERIM_OPERATING: ['IOC'],
  COVENANT_NO_SOLICITATION: ['NOSOL'],
  COVENANT_OTHER: ['COV'],
  TERMINATION_RIGHT: ['TERMR', 'TERMR-M', 'TERMR-B', 'TERMR-T'],
  TERMINATION_FEE: ['TERMF'],
  DEFINITION: ['DEF'],
  ANTITRUST_REGULATORY: ['ANTI'],
  SEC_FILING_MEETING: ['SEC'],
  EMPLOYEE_BENEFITS: ['CONSID'],
  STRUCTURE_MECHANICS: ['STRUCT'],
  MAE: ['REP-T'],
  NO_OTHER_REPS: ['MISC', 'REP-T', 'REP-B'],
  MISC_BOILERPLATE: ['MISC', 'OTHER'],
};

const FAMILY_TO_WP = {};
for (const [wpType, families] of Object.entries(WP_TO_FAMILY)) {
  for (const family of families) if (!FAMILY_TO_WP[family]) FAMILY_TO_WP[family] = wpType;
}

const FIELD_ALIASES = {
  fee_amount_percent: 'terminationFeePercentEquityValue',
  matching_rights_days: 'initialMatchPeriodDays',
  go_shop: 'goShopPresent',
  no_shop_type: 'boardChangeStandard',
  fiduciary_out: 'boardChangeForSuperiorProposal',
  consideration_type: 'considerationType',
  total_deal_value: 'total_deal_value',
  deal_name: 'deal_name',
  signing_date: 'signing_date',
  outside_date_extension_months: 'extensionMaxExercises',
};

// Query-layer type override for specific field ALIASES whose registry row
// annotates a `type` that fits the canonical key's PRIMARY alias but not
// this one. hsrFilingDeadlineBusinessDays is merged into the same registry
// entry as hsrFilingDeadline (type 'date', ISO-date-ish object shape) even
// though its own populated raw value is a plain business-day count. Without
// this, fieldKind() classifies the whole entry as 'date' — MARKET_RANGE then
// treats it as categorical (frequencyStats) and, for provisions whose
// deadline object has prose but no day count, would otherwise render that
// prose text as if it were a duration data point. Scoped to the exact alias
// string a query requests, never touches the registry file itself, and
// changes nothing about how hsrFilingDeadline (the OTHER alias of the same
// entry) resolves.
const FIELD_TYPE_OVERRIDES = {
  hsrFilingDeadlineBusinessDays: 'duration',
};

function slugToKind(slug) {
  const raw = String(slug || '').trim();
  return SLUG_TO_KIND[raw] || raw.toUpperCase();
}

function kindToSlug(kind) {
  return KIND_SLUGS[kind] || String(kind || '').toLowerCase().replace(/_/g, '-');
}

function normalizeFieldPath(fieldPath) {
  const key = String(fieldPath || '').trim();
  return resolveKey(FIELD_ALIASES[key] || key);
}

function wpTypeToFamilies(provisionType) {
  return WP_TO_FAMILY[provisionType] || [];
}

function provisionWpType(provision) {
  const fam = familyType(provision && provision.type);
  return FAMILY_TO_WP[fam] || FAMILY_TO_WP[provision && provision.type] || null;
}

function dealName(deal) {
  const meta = deal && deal.metadata && typeof deal.metadata === 'object' ? deal.metadata : {};
  const facts = meta.deal_facts && typeof meta.deal_facts === 'object' ? meta.deal_facts : {};
  const parties = facts.parties && typeof facts.parties === 'object' ? facts.parties : {};
  const buyer = parties.parent_entity || meta.ultimateParent || meta.ultimate_parent || meta.acquirer_display || deal.acquirer || 'Buyer';
  const seller = parties.target_display || parties.target_entity || meta.target_display || meta.target_entity || deal.target || 'Target';
  return `${buyer} / ${seller}`;
}

function dealRow(deal) {
  const meta = deal && deal.metadata && typeof deal.metadata === 'object' ? deal.metadata : {};
  const facts = meta.deal_facts && typeof meta.deal_facts === 'object' ? meta.deal_facts : {};
  const consideration = facts.consideration && typeof facts.consideration === 'object' ? facts.consideration : {};
  return {
    deal_id: deal.id,
    deal_name: dealName(deal),
    signing_date: deal.announce_date || null,
    total_deal_value: deal.value_usd == null ? null : Number(deal.value_usd),
    consideration_type: consideration.summary || meta.headlineConsiderationType || meta.considerationType || null,
    sector: deal.sector || null,
  };
}

function featureDefsForWpType(provisionType) {
  const byKey = new Map();
  for (const family of wpTypeToFamilies(provisionType)) {
    for (const def of FEATURES[family] || []) {
      if (def && def.key && !byKey.has(def.key)) byKey.set(def.key, def);
    }
  }
  return [...byKey.values()];
}

function fieldDef(provisionType, fieldPath) {
  const derived = derivedFieldDef(provisionType, fieldPath);
  if (derived) return derived;
  const requested = FIELD_ALIASES[String(fieldPath || '').trim()] || fieldPath;
  const key = resolveKey(requested);
  const registryEntry = featureEntry(requested);
  const rubricDef = featureDefsForWpType(provisionType).find((f) => f.key === key || aliasesForKey(key).includes(f.key));
  const overrideType = FIELD_TYPE_OVERRIDES[String(fieldPath || '').trim()];
  return {
    ...(rubricDef || {}),
    key,
    label: registryEntry.displayName || rubricDef?.label || key.replace(/_/g, ' '),
    type: overrideType || registryEntry.type || rubricDef?.type || 'string',
  };
}

function firstQuote(raw, provision) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    if (Array.isArray(raw.quotes) && raw.quotes[0]) return String(raw.quotes[0]);
    if (typeof raw.text === 'string' && raw.text.trim()) return raw.text.trim();
  }
  return provision && typeof provision.full_text === 'string' ? provision.full_text : null;
}

// registry `type: 'object'` covers two genuinely different rubric.js shapes:
// a tagged item resolved against a taxonomy ({code, label, text} — e.g.
// materialityQualifier), which codedValue() already handles correctly, and a
// structured amount/deadline object ({amount, percentage_of_equity,
// triggers[], payment_deadline} — e.g. companyTerminationFee,
// reverseTerminationFee, expenseReimbursement, interestOnLatePayment), which
// has no .code at all and always fell through codedValue() to null. Try the
// amount shape first (bails out immediately if the raw value is actually
// tagged) so PROVISION_CROSS_CUT/MARKET_RANGE stop silently nulling out
// every fee-object field.
function amountObjectValue(raw, { includeText = false } = {}) {
  const inner = raw && typeof raw === 'object' && !Array.isArray(raw) && 'value' in raw && !('code' in raw) ? raw.value : raw;
  if (inner == null || typeof inner !== 'object' || Array.isArray(inner) || typeof inner.code === 'string') return null;
  if (inner.amount != null && inner.amount !== '') return String(inner.amount);
  if (inner.value != null && inner.value !== '') return String(inner.value);
  if (inner.rate != null && inner.rate !== '') return String(inner.rate);
  if (inner.days != null && inner.days !== '') return String(inner.days);
  // Plain 'text'/'string'-typed features (e.g. prorationMechanics) have no
  // registry-specific branch above and land here too — their citable raw
  // shape is {text, quotes[]} with no top-level scalar 'value' at all (same
  // shape firstQuote() above already reads .text from). Gated behind
  // includeText: the numeric branch below also calls this helper, and a
  // prose sentence is never a legitimate numeric fallback (numericValue()
  // would grab the first stray digit out of a section-reference citation,
  // e.g. "6" out of "Section 6.10(b)") — only the non-numeric callers want
  // this last resort.
  if (includeText && typeof inner.text === 'string' && inner.text.trim()) return inner.text.trim();
  return null;
}

function valueFromRaw(raw, def) {
  const type = def && def.type;
  if (type === 'boolean') return boolValue(raw);
  if (type === 'enum') return enumValue(raw);
  if (type === 'tagged') return codedValue(raw);
  if (type === 'object') {
    const amount = amountObjectValue(raw, { includeText: true });
    return amount != null ? amount : codedValue(raw);
  }
  if (type === 'list' || type === 'list-tagged') {
    const items = setItems(raw);
    return items.length ? items.map((x) => x.label || x.code || x.key).join(', ') : null;
  }
  if (['currency', 'percentage', 'duration', 'number', 'decimal', 'int', 'usd', 'percent'].includes(type)) {
    const numeric = numericValue(raw);
    if (numeric != null) return numeric;
    // Same registry/raw-shape mismatch as the 'object' branch above, just
    // surfacing on a numeric-typed registry row instead: the canonical key
    // ("reverseFeeAmount") is annotated usd/currency (a bare number) but the
    // raw feature actually stored under one of its aliases is the rich
    // amount object. Fall back to the amount-shape extractor before giving
    // up, then re-parse that string numerically.
    const amount = amountObjectValue(raw);
    if (amount != null) return numericValue(amount);
    // A second, distinct registry mismatch: some canonical keys (e.g.
    // "financingCooperation") merge a legacy percent-typed field with a
    // present-day boolean one ("financingCooperationPresent") as aliases of
    // each other; the registry row keeps the legacy numeric `type`, but the
    // live raw value under either alias is genuinely a citable boolean
    // ({value:true/false}). Don't silently drop a real true/false answer
    // just because the registry's numeric type annotation doesn't match —
    // surface it as-extracted rather than invent a number.
    const bool = boolValue(raw);
    return bool != null ? bool : null;
  }
  // citable {value: <primitive>, quotes:[...]} unwraps cleanly — but a
  // citable can ALSO wrap a non-primitive ({value: {days, text, unit}, ...},
  // e.g. the hsrFilingDeadline deadline-object case below): returning
  // raw.value unconditionally then leaks that inner object as "the value".
  // Only take this shortcut when the unwrapped value is actually a
  // primitive; otherwise fall through to the same amount/days extraction as
  // the generic object case.
  if (raw && typeof raw === 'object' && 'value' in raw && raw.value !== null && typeof raw.value !== 'object') return raw.value;
  // Registry-type dispatch above is exhaustive for every type we know how to
  // render (boolean/enum/tagged/object/list/numeric). Any other declared
  // type (e.g. a merged-alias row still stamped 'date' whose populated raw
  // shape is actually a deadline object like {days, text, unit} with no
  // 'value' key — same class of registry/raw-shape mismatch documented on
  // amountObjectValue above) should try the same amount/days extraction
  // before giving up. A bare object is never a legitimate query cell value —
  // returning it here serializes to "[object Object]" in tables/CSV, which
  // is worse than an honest null.
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const fallbackAmount = amountObjectValue(raw, { includeText: true });
    return fallbackAmount != null ? fallbackAmount : null;
  }
  return raw == null || raw === '' ? null : raw;
}

function provisionFieldValue(provision, provisionType, fieldPath, deal) {
  const derived = derivedFieldDef(provisionType, fieldPath);
  if (derived) {
    const computed = computeDerivedField(provisionType, fieldPath, provision, deal) || { value: null, quote: null };
    return { value: computed.value, quote: computed.quote, def: derived, key: derived.key, matchedKey: null };
  }
  const def = fieldDef(provisionType, fieldPath);
  if (!def) return { value: null, quote: null, def: null, key: normalizeFieldPath(fieldPath) };
  const requested = FIELD_ALIASES[String(fieldPath || '').trim()] || fieldPath;
  const { key, raw, matchedKey } = resolveFeatureValue(requested, provision);
  return { value: valueFromRaw(raw, def), quote: firstQuote(raw, provision), def, key, matchedKey };
}

function provisionMatchesWpType(provision, provisionType) {
  const families = wpTypeToFamilies(provisionType);
  if (!families.length) return false;
  const fam = familyType(provision && provision.type);
  return families.includes(fam) || families.includes(provision && provision.type);
}

function provisionSubtype(provision) {
  const code = provisionCode(provision);
  return code || (provision && provision.category) || null;
}

function primaryQuote(provision) {
  return {
    text: (provision && provision.full_text) || '',
    section_ref: (provision && (provision.section_ref || provision.section)) || null,
  };
}

module.exports = {
  QUERY_KINDS,
  KIND_SLUGS,
  PROVISION_CARD_TYPES,
  FIELD_ALIASES,
  slugToKind,
  kindToSlug,
  normalizeFieldPath,
  wpTypeToFamilies,
  provisionWpType,
  provisionMatchesWpType,
  provisionSubtype,
  dealName,
  dealRow,
  featureDefsForWpType,
  fieldDef,
  provisionFieldValue,
  primaryQuote,
};
