const { FEATURES } = require('../rubric');
const { familyType, provisionCode } = require('../expected-sets');
const { boolValue, codedValue, enumValue, numericValue, setItems } = require('../feature-compare');
const { aliasesForKey, featureEntry, resolveFeatureValue, resolveKey } = require('./resolve');

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

// Shell-vehicle guard shared with lib/ingest/deal-metadata-prompt.js's
// buyer_profile classification and the ingest-qa buyer_display gate: a
// candidate name that reads as a transaction-only vehicle (Parent/Holdco/
// Midco/Bidco/Topco/Merger Sub/Acquisition Co/Buyer) rather than an
// operating company or a market-recognizable sponsor name.
const SHELL_NAME_REGEX = /\b(parent|holdco|holdings|midco|bidco|topco|opco|merger\s+sub|acquisition(\s+co)?|buyer)\b/i;

// resolveBuyerDisplay(deal) — precedence for the buyer's DISPLAY name (not
// the legal-entity record). deal_facts.parties.* is the legal-entity record
// and must not drive display naming: `dealName()` (below) still reads the
// legacy precedence until Package A (render) wires this in; this export
// exists so the ingest-qa `buyer_display` gate and the backfill script can
// share one definition of "did we resolve a real buyer name" with the
// render fix, so the two can never drift.
function resolveBuyerDisplay(deal) {
  const meta = deal && deal.metadata && typeof deal.metadata === 'object' ? deal.metadata : {};
  const candidates = [
    meta.acquirer_display,
    meta.ultimateParent,
    meta.ultimate_parent,
    meta.parent_entity,
    deal && deal.acquirer,
  ];
  const nonShell = candidates.find((c) => c && !SHELL_NAME_REGEX.test(String(c)));
  if (nonShell) return nonShell;
  // No non-shell candidate exists anywhere in the precedence chain — fall
  // back to the first non-null candidate (a shell name) rather than null,
  // so a corpus row without a display fix always renders something readable.
  return candidates.find((c) => !!c) || null;
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
  const requested = FIELD_ALIASES[String(fieldPath || '').trim()] || fieldPath;
  const key = resolveKey(requested);
  const registryEntry = featureEntry(requested);
  const rubricDef = featureDefsForWpType(provisionType).find((f) => f.key === key || aliasesForKey(key).includes(f.key));
  return {
    ...(rubricDef || {}),
    key,
    label: registryEntry.displayName || rubricDef?.label || key.replace(/_/g, ' '),
    type: registryEntry.type || rubricDef?.type || 'string',
  };
}

function firstQuote(raw, provision) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    if (Array.isArray(raw.quotes) && raw.quotes[0]) return String(raw.quotes[0]);
    if (typeof raw.text === 'string' && raw.text.trim()) return raw.text.trim();
  }
  return provision && typeof provision.full_text === 'string' ? provision.full_text : null;
}

function valueFromRaw(raw, def) {
  const type = def && def.type;
  if (type === 'boolean') return boolValue(raw);
  if (type === 'enum') return enumValue(raw);
  if (type === 'object' || type === 'tagged') return codedValue(raw);
  if (type === 'list' || type === 'list-tagged') {
    const items = setItems(raw);
    return items.length ? items.map((x) => x.label || x.code || x.key).join(', ') : null;
  }
  if (['currency', 'percentage', 'duration', 'number', 'decimal', 'int', 'usd', 'percent'].includes(type)) return numericValue(raw);
  if (raw && typeof raw === 'object' && 'value' in raw) return raw.value;
  return raw == null || raw === '' ? null : raw;
}

function provisionFieldValue(provision, provisionType, fieldPath) {
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
  SHELL_NAME_REGEX,
  resolveBuyerDisplay,
  dealName,
  dealRow,
  featureDefsForWpType,
  fieldDef,
  provisionFieldValue,
  primaryQuote,
};
