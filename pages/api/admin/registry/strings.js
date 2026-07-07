import crypto from 'crypto';
import fs from 'fs';

const NORMALIZED_FILE = 'docs/schema-shape/normalized-v1.json';
const DEFAULT_VALUE_LIMIT = 200;
const DEFAULT_SAMPLE_LIMIT = 4;
const SECTION_LABELS = {
  ALL: 'All sections',
  DEF: 'Definitions',
  STRUCT: 'Structure',
  CONSID: 'Consideration',
  'REP-T': 'Target reps',
  'REP-B': 'Buyer reps',
  COV: 'Covenants',
  SEC: 'Shareholder / SEC',
  IOC: 'Interim covenants',
  NOSOL: 'No-shop',
  ANTI: 'Regulatory / antitrust',
  COND: 'Conditions',
  TERMR: 'Termination rights',
  TERMF: 'Termination fees',
  MISC: 'Miscellaneous',
  OTHER: 'Other',
};
const IMPORTANT_EMPTY_FIELDS_BY_SECTION = {
  CONSID: new Set([
    'deal.consideration.perShareCashComponent',
    'deal.consideration.perShareStockComponent',
    'offerConsideration',
    'offerPrice',
    'perShareAmount',
  ]),
  ANTI: new Set([
    'burdenCap',
    'buyerEffortsCap',
    'controllingParty',
    'targetEffortsCap',
    'timingAgreement',
  ]),
  STRUCT: new Set([
    'acceptanceAndPaymentMechanics',
    'backendMergerMechanic',
    'closingConditionsPrecedent',
    'closingTiming',
    'dealStructure',
    'nominalTargetParty',
    'offerCommencementDeadline',
    'offerConditionsReference',
    'offerConsideration',
    'offerExpirationAndExtension',
    'offerPrice',
    'schedule14D9Filing',
    'scheduleTOFiling',
    'section251h',
    'shortFormMergerMechanic',
    'stockholderListCovenant',
    'survivingEntity',
  ]),
  SEC: new Set([
    'adjournmentRights',
    'forceTheVote',
    'forceTheVoteDetails',
    'mailingDeadline',
    'meetingControlNotes',
    'meetingDeadline',
    'offerCommencementDeadline',
    'proxyFilingDeadline',
    'schedule14D9Filing',
    'scheduleTOFiling',
    'stockholderApprovalRequired',
    'tenderOfferDisclosurePermitted',
    'tenderOfferDisclosureScope',
  ]),
};
const SECTION_FIELD_OVERRIDES = {
  SEC: new Set([
    'adjournmentRights',
    'approvalDefinition',
    'forceTheVote',
    'forceTheVoteDetails',
    'mailingDeadline',
    'meetingControlNotes',
    'meetingDeadline',
    'offerCommencementDeadline',
    'proxyFilingDeadline',
    'schedule14D9Filing',
    'scheduleTOFiling',
    'shareholderApprovalMethodCompany',
    'shareholderApprovalMethodParent',
    'stockholderApprovalRequired',
    'tenderOfferDisclosurePermitted',
    'tenderOfferDisclosureScope',
    'voteThreshold',
  ]),
};
const HIDDEN_REVIEW_FIELDS = new Set([
  'carveOuts',
  'carveOutsList',
  'deal.antitrust.burdensomeConditionDefined',
  'deal.antitrust.burdensomeConditionPresent',
  'deal.antitrust.burdensomeConditionScope',
  'deal.antitrust.capStandard',
  'deal.antitrust.clearSkiesCompany',
  'deal.antitrust.clearSkiesParent',
  'deal.antitrust.controlLeadParty',
  'deal.antitrust.effortsStandard',
  'deal.antitrust.exHsrFilingDeadline',
  'deal.antitrust.hsrFilingDeadline',
  'deal.antitrust.litigationObligation',
  'deal.antitrust.pullAndRefile',
  'deal.antitrust.timingAgreement',
  'deal.mae.carveouts',
  'deal.termination.outsideDate',
  'deal.termination.outsideDateExtensions',
  'canonicalCode',
  'partOfRep',
  'proposedCode',
  'proposedLabel',
  'reapplied_corrections',
  'sourceSectionType',
  'startChar',
]);

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function clampInt(value, fallback, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.min(parsed, max);
}

function stableId(fieldKey, rawValue) {
  return crypto.createHash('sha256').update(`${fieldKey}|${rawValue}`).digest('hex').slice(0, 16);
}

function normaliseText(value) {
  if (value == null) return '';
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function fieldMatches(field, query) {
  if (!query) return true;
  const needle = query.toLowerCase();
  const haystack = [
    field.key,
    field.displayName,
    ...(field.aliases || []),
  ].join(' ').toLowerCase();
  return haystack.includes(needle);
}

function valueMatches(value, query) {
  if (!query) return true;
  const needle = query.toLowerCase();
  return normaliseText(value.raw_value).toLowerCase().includes(needle)
    || (value.samples || []).some((sample) => normaliseText(sample.evidence_quote).toLowerCase().includes(needle));
}

function splitCodes(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function sectionForCode(code) {
  if (!code) return 'OTHER';
  if (code.startsWith('REP-T')) return 'REP-T';
  if (code.startsWith('REP-B')) return 'REP-B';
  if (code.startsWith('COND')) return 'COND';
  if (code.startsWith('TERMR')) return 'TERMR';
  if (code.startsWith('TERMF')) return 'TERMF';
  if (code.startsWith('IOC')) return 'IOC';
  if (code.startsWith('NOSOL')) return 'NOSOL';
  if (code.startsWith('ANTI')) return 'ANTI';
  if (code.startsWith('COV')) return 'COV';
  if (code.startsWith('DEF')) return 'DEF';
  if (code.startsWith('STRUCT')) return 'STRUCT';
  if (code.startsWith('CONSID')) return 'CONSID';
  if (code.startsWith('MISC')) return 'MISC';
  return SECTION_LABELS[code] ? code : 'OTHER';
}

function sectionsForEntry(entry) {
  const provenance = entry.provenance || {};
  const codes = [
    ...splitCodes(provenance.appliesTo),
    ...(provenance.provisionCodes || []).flatMap(splitCodes),
  ];
  const sections = [...new Set(codes.map(sectionForCode))];
  for (const [section, keys] of Object.entries(SECTION_FIELD_OVERRIDES)) {
    if (keys.has(entry.key)) sections.push(section);
  }
  const uniqueSections = [...new Set(sections)];
  return uniqueSections.length ? uniqueSections : ['OTHER'];
}

function sectionScopedFields(fields, key) {
  if (key === 'ALL') return fields.filter((field) => field.value_count > 0);
  return fields.filter((field) => (
    (field.value_count > 0 || IMPORTANT_EMPTY_FIELDS_BY_SECTION[key]?.has(field.key))
    && (field.sections || []).includes(key)
    && (field.sections || []).length <= 4
  ));
}

function entryValueCount(entry, triplesByField) {
  const triples = triplesByField.get(entry.key) || [];
  return new Set(triples.map((triple) => normaliseText(triple.raw_value)).filter(Boolean)).size;
}

function groupValues(triples, { sampleLimit }) {
  const groups = new Map();
  for (const triple of triples) {
    const rawValue = normaliseText(triple.raw_value);
    if (!rawValue) continue;
    const group = groups.get(rawValue) || {
      id: stableId(triple.field_key, rawValue),
      raw_value: rawValue,
      count: 0,
      deal_count: 0,
      deal_ids: new Set(),
      samples: [],
    };
    group.count += 1;
    group.deal_ids.add(triple.deal_id);
    if (group.samples.length < sampleLimit) {
      group.samples.push({
        deal_id: triple.deal_id,
        source_provision_id: triple.source_provision_id,
        evidence_quote: triple.evidence_quote,
        canonicalKey: triple.canonicalKey || null,
      });
    }
    groups.set(rawValue, group);
  }
  return [...groups.values()].map((group) => {
    const dealIds = [...group.deal_ids].sort();
    return {
      ...group,
      deal_count: dealIds.length,
      deal_ids: dealIds,
    };
  }).sort((a, b) => b.count - a.count || a.raw_value.localeCompare(b.raw_value));
}

export function buildStringRegistry(query = {}) {
  const normalized = readJson(NORMALIZED_FILE, { entries: [], triples: [] });
  const valueLimit = clampInt(query.limit, DEFAULT_VALUE_LIMIT, 1000);
  const sampleLimit = clampInt(query.sample_limit, DEFAULT_SAMPLE_LIMIT, 10);
  const q = String(query.q || '').trim();
  const selectedFieldKey = String(query.field_key || '').trim();
  const reviewFields = (normalized.entries || [])
    .filter((entry) => !HIDDEN_REVIEW_FIELDS.has(entry.key))
    .sort((a, b) => a.key.localeCompare(b.key));
  const triplesByField = new Map();
  for (const triple of normalized.triples || []) {
    const bucket = triplesByField.get(triple.field_key) || [];
    bucket.push(triple);
    triplesByField.set(triple.field_key, bucket);
  }
  const fields = reviewFields.map((field) => {
    const triples = triplesByField.get(field.key) || [];
    const dealIds = new Set(triples.map((triple) => triple.deal_id));
    const values = new Set(triples.map((triple) => normaliseText(triple.raw_value)).filter(Boolean));
    return {
      key: field.key,
      displayName: field.displayName || field.key,
      type: field.type || 'unknown',
      aliases: field.aliases || [],
      sections: sectionsForEntry(field),
      provisionCodes: field.provenance?.provisionCodes || [],
      appliesTo: field.provenance?.appliesTo || null,
      sourceOfTruth: field.sourceOfTruth || null,
      usedIn: field.usedIn || [],
      count: triples.length,
      deal_count: dealIds.size,
      value_count: values.size,
    };
  }).filter((field) => fieldMatches(field, q));
  const sectionGroups = Object.entries(SECTION_LABELS).map(([key, label]) => {
    const groupedFields = sectionScopedFields(fields, key);
    const dealIds = new Set();
    for (const field of groupedFields) {
      const triples = triplesByField.get(field.key) || [];
      for (const triple of triples) dealIds.add(triple.deal_id);
    }
    return {
      key,
      label,
      field_count: groupedFields.length,
      value_count: groupedFields.reduce((sum, field) => sum + field.value_count, 0),
      deal_count: dealIds.size,
      fields: groupedFields.map((field) => ({
        key: field.key,
        displayName: field.displayName,
        type: field.type,
        value_count: field.value_count,
        count: field.count,
      })),
    };
  }).filter((group) => group.key === 'ALL' || group.field_count > 0);
  const selectedField = fields.find((field) => field.key === selectedFieldKey)
    || [...fields].sort((a, b) => b.value_count - a.value_count || b.count - a.count || a.key.localeCompare(b.key))[0]
    || null;
  const selectedTriples = selectedField ? (triplesByField.get(selectedField.key) || []) : [];
  const allValues = groupValues(selectedTriples, { sampleLimit }).filter((value) => valueMatches(value, q));
  return {
    schema_version: normalized.schema_version,
    generated_at: normalized.generated_at,
    field_total: reviewFields.length,
    fields,
    section_groups: sectionGroups,
    selected_field: selectedField,
    values: allValues.slice(0, valueLimit),
    value_total: allValues.length,
    limit: valueLimit,
  };
}

export default function handler(req, res) {
  res.status(200).json(buildStringRegistry(req.query || {}));
}
