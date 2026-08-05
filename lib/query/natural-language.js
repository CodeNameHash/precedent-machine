const { getDisplayAdvisors } = require('../canonical-advisors');
const { DERIVED_FIELDS } = require('./derived-fields');
const { validate } = require('./engine');
const { fieldsForProvisionType, valueOptionsForField } = require('./field-meta');
const { taxonomyForFeatureKey } = require('../taxonomy');
const {
  PROVISION_CARD_TYPES,
  QUERY_KINDS,
  dealName,
  dealRow,
  fieldDef,
  resolveBuyerDisplay,
  resolveTargetDisplay,
} = require('./types');

const MAX_QUERY_LENGTH = 600;
const DEFAULT_RESULT_COLUMNS = ['deal_name', 'signing_date', 'consideration_type', 'total_deal_value'];
// DEAL_COMPARE and DEAL_TO_MARKET were retired as query kinds (deal-vs-deal
// and deal-vs-market comparison now live on the review page's own compare
// mode and market columns — see pages/review/[id].js). inferKind() below
// still has to recognise this phrasing so it can decline clearly instead of
// silently mis-routing to PROVISION_CROSS_CUT/MARKET_RANGE or dispatching a
// kind the engine no longer accepts; these sentinels are internal-only and
// never appear in QUERY_KINDS, a payload, or a compiled result.
const RETIRED_KIND_DEAL_COMPARE = 'RETIRED_DEAL_COMPARE';
const RETIRED_KIND_DEAL_TO_MARKET = 'RETIRED_DEAL_TO_MARKET';
const FILTER_OPERATORS = new Set([
  'eq', 'neq', 'in', 'not_in', 'contains', 'not_contains',
  'lt', 'lte', 'gt', 'gte', 'before', 'after', 'between',
]);
const NUMERIC_TYPES = new Set(['usd', 'currency', 'percentage', 'percent', 'duration', 'number', 'decimal', 'int']);
const NUMERIC_OPERATORS = new Set(['eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'between']);
const BOOLEAN_OPERATORS = new Set(['eq', 'neq']);
const CODED_OPERATORS = new Set(['eq', 'neq', 'in', 'not_in']);
const TEXT_OPERATORS = new Set(['eq', 'neq', 'in', 'not_in', 'contains', 'not_contains']);
const DATE_OPERATORS = new Set(['eq', 'neq', 'before', 'after', 'between']);

const CODED_VALUE_ALIASES = {
  considerationType: {
    cash: 'all-cash',
    stock: 'all-stock',
    mixed: 'mixed-cash-and-stock',
    'cash and stock': 'mixed-cash-and-stock',
    'cash plus cvr': 'cash-with-cvr',
    'cash with cvr': 'cash-with-cvr',
    cvr: 'cash-with-cvr',
  },
  dealStructure: {
    'one step': 'ONE_STEP_MERGER',
    'one step merger': 'ONE_STEP_MERGER',
    'tender offer': 'TWO_STEP_TENDER_OFFER',
    'two step': 'TWO_STEP_TENDER_OFFER',
    'two step merger': 'TWO_STEP_TENDER_OFFER',
    'two step tender offer': 'TWO_STEP_TENDER_OFFER',
    'scheme of arrangement': 'SCHEME',
    'asset purchase': 'ASSET',
    'stock purchase': 'STOCK',
  },
};

const PROVISION_PHRASES = [
  ['no solicitation', 'COVENANT_NO_SOLICITATION'],
  ['no-solicitation', 'COVENANT_NO_SOLICITATION'],
  ['no shop', 'COVENANT_NO_SOLICITATION'],
  ['no-shop', 'COVENANT_NO_SOLICITATION'],
  ['go shop', 'COVENANT_NO_SOLICITATION'],
  ['go-shop', 'COVENANT_NO_SOLICITATION'],
  ['matching rights', 'COVENANT_NO_SOLICITATION'],
  ['matching-rights', 'COVENANT_NO_SOLICITATION'],
  ['termination fee', 'TERMINATION_FEE'],
  ['break fee', 'TERMINATION_FEE'],
  ['termination right', 'TERMINATION_RIGHT'],
  ['outside date', 'TERMINATION_RIGHT'],
  ['interim operating', 'COVENANT_INTERIM_OPERATING'],
  ['ordinary course covenant', 'COVENANT_INTERIM_OPERATING'],
  ['material contract', 'MATERIAL_CONTRACT'],
  ['closing condition', 'CLOSING_CONDITION'],
  ['antitrust', 'ANTITRUST_REGULATORY'],
  ['regulatory efforts', 'ANTITRUST_REGULATORY'],
  ['employee benefit', 'EMPLOYEE_BENEFITS'],
  ['deal structure', 'STRUCTURE_MECHANICS'],
  ['merger structure', 'STRUCTURE_MECHANICS'],
  ['merger form', 'STRUCTURE_MECHANICS'],
  ['material adverse effect', 'MAE'],
  ['material adverse change', 'MAE'],
  ['no other reps', 'NO_OTHER_REPS'],
  ['no-other-reps', 'NO_OTHER_REPS'],
  ['representation', 'REPRESENTATION'],
  ['representations', 'REPRESENTATION'],
  ['consideration', 'CONSIDERATION'],
  ['definition', 'DEFINITION'],
  ['boilerplate', 'MISC_BOILERPLATE'],
  ['mae', 'MAE'],
];

const FIELD_PHRASES = [
  {
    provisionType: 'CONSIDERATION', field: 'considerationType', label: 'Consideration form',
    phrases: ['consideration form', 'form of consideration', 'consideration type'],
  },
  {
    provisionType: 'CONSIDERATION', field: 'perShareAmount', label: 'Per-share consideration',
    phrases: ['per share consideration', 'per-share consideration', 'per share amount', 'per-share amount', 'offer price per share'],
  },
  {
    provisionType: 'CONSIDERATION', field: 'exchangeRatioText', label: 'Exchange-ratio formula',
    phrases: ['exchange ratio formula', 'exchange-ratio formula'],
  },
  {
    provisionType: 'CONSIDERATION', field: 'exchangeRatio', label: 'Exchange ratio',
    phrases: ['exchange ratio', 'exchange-ratio'],
  },
  {
    provisionType: 'CONSIDERATION', field: 'prorationMechanics', label: 'Proration mechanics',
    phrases: ['proration mechanics', 'proration mechanism'],
  },
  {
    provisionType: 'CONSIDERATION', field: 'walkAwayRight', label: 'Walk-away right',
    phrases: ['walk away right', 'walk-away right', 'collar walk away'],
  },
  {
    provisionType: 'CONSIDERATION', field: 'appraisalRightsAvailable', label: 'Appraisal rights',
    phrases: ['appraisal rights', 'appraisal right'],
  },
  {
    provisionType: 'TERMINATION_FEE', field: 'feePctOfDealValue', label: 'Company termination fee (% of deal value)',
    phrases: [
      'company termination fee percentage', 'termination fee percentage', 'break fee percentage',
      'termination fee percent of deal value', 'termination fee as a percentage of deal value',
      'termination fees as a percentage of deal value', 'termination fees percentage of deal value',
      'company termination fees', 'target termination fees',
    ],
  },
  {
    provisionType: 'TERMINATION_FEE', field: 'companyTerminationFee', label: 'Company termination fee',
    phrases: ['company termination fee', 'target termination fee', 'company break fee', 'target break fee'],
  },
  {
    provisionType: 'TERMINATION_FEE', field: 'reverseFeePctOfDealValue', label: 'Reverse termination fee (% of deal value)',
    phrases: ['reverse termination fee percentage', 'reverse break fee percentage', 'reverse fee percentage'],
  },
  {
    provisionType: 'TERMINATION_FEE', field: 'reverseFeeAmount', label: 'Reverse termination fee',
    phrases: ['reverse termination fee amount', 'reverse termination fee', 'reverse break fee', 'reverse fee amount'],
  },
  {
    provisionType: 'TERMINATION_FEE', field: 'tailFeeWindowMonths', label: 'Tail period',
    phrases: ['tail fee window', 'tail period', 'tail fee period'],
  },
  {
    provisionType: 'COVENANT_NO_SOLICITATION', field: 'goShopPeriodDays', label: 'Go-shop period',
    phrases: ['go shop period', 'go-shop period', 'go shop length', 'go-shop length'],
  },
  {
    provisionType: 'COVENANT_NO_SOLICITATION', field: 'goShopPresent', label: 'Go-shop',
    phrases: ['go shop', 'go-shop'],
  },
  {
    provisionType: 'COVENANT_NO_SOLICITATION', field: 'initialMatchPeriodDays', label: 'Initial matching-rights period',
    phrases: ['initial matching rights period', 'initial matching-rights period', 'initial match period', 'initial matching period', 'initial match'],
  },
  {
    provisionType: 'COVENANT_NO_SOLICITATION', field: 'subsequentMatchingPeriod', label: 'Subsequent matching-rights period',
    phrases: ['subsequent matching rights period', 'subsequent matching-rights period', 'subsequent match period', 'subsequent matching period', 'subsequent match'],
  },
  {
    provisionType: 'COVENANT_NO_SOLICITATION', field: 'forceTheVote', label: 'Force the vote',
    phrases: ['force the vote', 'force-the-vote'],
  },
  {
    provisionType: 'COVENANT_NO_SOLICITATION', field: 'boardChangeForSuperiorProposal', label: 'Fiduciary out for a superior proposal',
    phrases: ['fiduciary out for superior proposal', 'superior proposal fiduciary out', 'fiduciary out'],
  },
  {
    provisionType: 'COVENANT_NO_SOLICITATION', field: 'boardChangeStandard', label: 'Board-change standard',
    phrases: ['board change standard', 'change of recommendation standard', 'recommendation change standard'],
  },
  {
    provisionType: 'COVENANT_NO_SOLICITATION', field: 'companyTerminationForSuperior', label: 'Company termination right for a superior proposal',
    phrases: ['terminate for a superior proposal', 'termination right for superior proposal'],
  },
  {
    provisionType: 'TERMINATION_RIGHT', field: 'extensionMaxExercises', label: 'Maximum outside-date extensions',
    phrases: ['maximum outside date extensions', 'outside date extension count', 'outside date extensions'],
  },
  {
    provisionType: 'TERMINATION_RIGHT', field: 'finalAndNonappealableRequired', label: 'Final-and-non-appealable order requirement',
    phrases: ['final and non appealable', 'final-and-non-appealable'],
  },
  {
    provisionType: 'STRUCTURE_MECHANICS', field: 'dealStructure', label: 'Deal structure',
    phrases: ['tender offer', 'tender offers', 'two step merger', 'two-step merger', 'two step', 'two-step', 'one step merger', 'one-step merger', 'one step', 'one-step', 'deal structure'],
  },
  {
    provisionType: 'STRUCTURE_MECHANICS', field: 'mergerForm', label: 'Merger legal form',
    phrases: ['reverse triangular merger', 'forward triangular merger', 'merger legal form', 'merger form'],
  },
  {
    provisionType: 'MATERIAL_CONTRACT', field: 'materialityScrape', label: 'Materiality scrape',
    phrases: ['materiality scrape'],
  },
  {
    provisionType: 'ANTITRUST_REGULATORY', field: 'hellOrHighWater', label: 'Hell-or-high-water covenant',
    phrases: ['hell or high water', 'hell-or-high-water'],
  },
  {
    provisionType: 'ANTITRUST_REGULATORY', field: 'effortsStandard', label: 'Regulatory efforts standard',
    phrases: ['regulatory efforts standard', 'antitrust efforts standard'],
  },
  {
    provisionType: 'CLOSING_CONDITION', field: 'tenderOfferMinimumCondition', label: 'Tender-offer minimum condition',
    phrases: ['tender offer minimum condition', 'minimum tender condition'],
  },
  {
    provisionType: 'COVENANT_INTERIM_OPERATING', field: 'ordinaryCourseCarveout', label: 'Ordinary-course carve-out',
    phrases: ['ordinary course carveout', 'ordinary course carve out', 'ordinary-course carve-out'],
  },
];

const PREFERRED_FIELDS = {
  CONSIDERATION: ['considerationType', 'perShareAmount', 'exchangeRatio', 'prorationMechanics'],
  TERMINATION_FEE: ['feePctOfDealValue', 'reverseFeePctOfDealValue', 'companyTerminationFee', 'tailFeeWindowMonths'],
  COVENANT_NO_SOLICITATION: ['goShopPresent', 'goShopPeriodDays', 'initialMatchPeriodDays', 'subsequentMatchingPeriod'],
  TERMINATION_RIGHT: ['extensionMaxExercises', 'finalAndNonappealableRequired', 'partyWhoCanTerminate'],
  STRUCTURE_MECHANICS: ['dealStructure', 'mergerForm'],
  MATERIAL_CONTRACT: ['materialityScrape', 'materialContractsDollarThresholds'],
  ANTITRUST_REGULATORY: ['effortsStandard', 'hellOrHighWater', 'burdenCap'],
};

class IntentValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'IntentValidationError';
  }
}

function normaliseText(value) {
  return String(value || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function normaliseQuestion(value) {
  const question = String(value == null ? '' : value).trim();
  if (!question) throw new IntentValidationError('Ask a question first.');
  if (question.length > MAX_QUERY_LENGTH) {
    throw new IntentValidationError(`Keep the question under ${MAX_QUERY_LENGTH} characters.`);
  }
  return question;
}

function titleForProvisionType(type) {
  return String(type || '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

let fieldCatalogCache = null;

function buildFieldCatalog() {
  if (fieldCatalogCache) return fieldCatalogCache;
  const byType = {};
  for (const provisionType of PROVISION_CARD_TYPES) {
    byType[provisionType] = fieldsForProvisionType(provisionType).map((field) => ({ ...field }));
  }
  for (const [key, derived] of Object.entries(DERIVED_FIELDS)) {
    if (!byType[derived.provisionType]) continue;
    if (byType[derived.provisionType].some((field) => field.key === key)) continue;
    byType[derived.provisionType].push({
      key,
      label: derived.label,
      type: derived.type,
      unit: derived.type === 'percentage' ? '%' : null,
      coded: false,
      boolean: false,
      numeric: NUMERIC_TYPES.has(derived.type),
      derived: true,
    });
  }
  for (const fields of Object.values(byType)) fields.sort((a, b) => a.label.localeCompare(b.label));
  fieldCatalogCache = byType;
  return byType;
}

function fieldInCatalog(catalog, provisionType, requestedField) {
  const fields = catalog[provisionType] || [];
  const requested = String(requestedField || '').trim();
  if (!requested) return null;
  let match = fields.find((field) => field.key === requested);
  if (match) return match;
  match = fields.find((field) => normaliseText(field.key) === normaliseText(requested));
  if (match) return match;
  try {
    const resolved = fieldDef(provisionType, requested);
    return fields.find((field) => field.key === resolved.key) || null;
  } catch {
    return null;
  }
}

function unique(values) {
  return [...new Set((values || []).filter((value) => value !== null && value !== undefined && value !== ''))];
}

function asArray(value) {
  if (value === null || value === undefined || value === '') return [];
  return Array.isArray(value) ? value : [value];
}

function dealAliases(deal) {
  const metadata = deal && deal.metadata && typeof deal.metadata === 'object' ? deal.metadata : {};
  return unique([
    deal && deal.id,
    dealName(deal),
    resolveBuyerDisplay(deal),
    resolveTargetDisplay(deal),
    deal && deal.acquirer,
    deal && deal.target,
    metadata.acquirer_display,
    metadata.target_display,
    metadata.target_entity,
  ]).filter((alias) => normaliseText(alias).length >= 3);
}

function matchDeals(question, deals) {
  const text = ` ${normaliseText(question)} `;
  const matches = [];
  for (const deal of deals || []) {
    const aliases = dealAliases(deal).sort((a, b) => normaliseText(b).length - normaliseText(a).length);
    const matchedAlias = aliases.find((alias) => text.includes(` ${normaliseText(alias)} `));
    if (matchedAlias) matches.push({ deal, alias: matchedAlias });
  }
  return matches;
}

function buildDealFacetCatalog(deals) {
  const out = {
    consideration_type: new Set(),
    buyer: new Set(),
    law_firm: new Set(),
    lawyer: new Set(),
    merger_form: new Set(),
    sector: new Set(),
    signing_year: new Set(),
  };
  for (const deal of deals || []) {
    const row = dealRow(deal);
    if (row.consideration_type) out.consideration_type.add(row.consideration_type);
    const buyer = resolveBuyerDisplay(deal);
    if (buyer) out.buyer.add(buyer);
    if (deal.sector) out.sector.add(deal.sector);
    const year = deal.announce_date ? Number(String(deal.announce_date).slice(0, 4)) : null;
    if (year) out.signing_year.add(year);
    const advisors = getDisplayAdvisors(deal.metadata);
    for (const firm of [...(advisors.buyerFirms || []), ...(advisors.sellerFirms || [])]) out.law_firm.add(firm);
    for (const lawyer of [...(advisors.buyerLawyers || []), ...(advisors.sellerLawyers || [])]) out.lawyer.add(lawyer);
    const mergerForm = deal.merger_form || (deal.metadata && deal.metadata.merger_form);
    if (mergerForm) out.merger_form.add(mergerForm);
  }
  return Object.fromEntries(Object.entries(out).map(([key, values]) => [key, [...values]]));
}

function observedFacetValue(knownValues, requested) {
  const wanted = normaliseText(requested);
  return knownValues.find((value) => normaliseText(value) === wanted);
}

function compileDealFilter(input, deals) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const catalog = buildDealFacetCatalog(deals);
  const out = {};
  for (const key of Object.keys(source)) {
    if (key === 'search') {
      const search = String(Array.isArray(source[key]) ? source[key][0] : source[key]).trim().slice(0, 120);
      if (search) out.search = search;
      continue;
    }
    if (!Object.hasOwn(catalog, key)) throw new IntentValidationError(`Unsupported deal filter: ${key}`);
    const values = asArray(source[key]);
    const resolved = [];
    for (const value of values) {
      const candidate = key === 'signing_year' ? Number(value) : observedFacetValue(catalog[key], value);
      if (candidate === undefined || candidate === null || candidate === '' || (key === 'signing_year' && !catalog[key].includes(candidate))) {
        throw new IntentValidationError(`Unknown ${key} filter value: ${value}`);
      }
      resolved.push(candidate);
    }
    if (resolved.length) out[key] = unique(resolved);
  }
  return out;
}

function dealMatchesFilter(deal, filter) {
  const row = dealRow(deal);
  if (filter.search) {
    const search = String(Array.isArray(filter.search) ? filter.search[0] : filter.search).trim().toLowerCase();
    const haystack = [dealName(deal), resolveBuyerDisplay(deal), resolveTargetDisplay(deal), deal.sector].filter(Boolean).join(' ').toLowerCase();
    if (search && !haystack.includes(search)) return false;
  }
  if (filter.sector && !filter.sector.includes(deal.sector)) return false;
  if (filter.signing_year) {
    const year = deal.announce_date ? Number(String(deal.announce_date).slice(0, 4)) : null;
    if (!filter.signing_year.includes(year)) return false;
  }
  if (filter.consideration_type && !filter.consideration_type.includes(row.consideration_type)) return false;
  if (filter.buyer && !filter.buyer.includes(resolveBuyerDisplay(deal))) return false;
  if (filter.law_firm) {
    const advisors = getDisplayAdvisors(deal.metadata);
    const firms = [...(advisors.buyerFirms || []), ...(advisors.sellerFirms || [])];
    if (!filter.law_firm.some((firm) => firms.includes(firm))) return false;
  }
  if (filter.lawyer) {
    const advisors = getDisplayAdvisors(deal.metadata);
    const lawyers = [...(advisors.buyerLawyers || []), ...(advisors.sellerLawyers || [])];
    if (!filter.lawyer.some((lawyer) => lawyers.includes(lawyer))) return false;
  }
  if (filter.merger_form) {
    const mergerForm = deal.merger_form || (deal.metadata && deal.metadata.merger_form) || null;
    if (!filter.merger_form.includes(mergerForm)) return false;
  }
  return true;
}

function inferDealFilter(question, deals) {
  const text = ` ${normaliseText(question)} `;
  const catalog = buildDealFacetCatalog(deals);
  const input = {};
  for (const sector of catalog.sector) {
    if (text.includes(` ${normaliseText(sector)} `)) input.sector = [sector];
  }
  const years = unique((String(question).match(/\b20\d{2}\b/g) || []).map(Number));
  const knownYears = years.filter((year) => catalog.signing_year.includes(year));
  if (knownYears.length) input.signing_year = knownYears;
  for (const type of catalog.consideration_type) {
    const typeText = normaliseText(type);
    if (text.includes(` ${typeText} deals `) || text.includes(` ${typeText} transactions `)) {
      input.consideration_type = [type];
    }
  }
  for (const firm of catalog.law_firm) {
    const firmText = normaliseText(firm);
    if ((text.includes(' advised by ') || text.includes(' counselled by ')) && text.includes(` ${firmText} `)) {
      input.law_firm = [firm];
    }
  }
  return compileDealFilter(input, deals);
}

function phraseMatches(question, phrase) {
  const text = ` ${normaliseText(question)} `;
  const wanted = normaliseText(phrase);
  return wanted && text.includes(` ${wanted} `);
}

function inferProvisionTypes(question, fieldMatches = []) {
  const types = fieldMatches.map((match) => match.provisionType);
  for (const [phrase, type] of PROVISION_PHRASES) {
    if (phraseMatches(question, phrase)) types.push(type);
  }
  return unique(types);
}

function fieldPhraseMatches(question) {
  const text = normaliseText(question);
  const candidates = [];
  for (const spec of FIELD_PHRASES) {
    for (const phrase of spec.phrases) {
      const wanted = normaliseText(phrase);
      const start = text.indexOf(wanted);
      if (start < 0) continue;
      candidates.push({ ...spec, start, end: start + wanted.length, phraseLength: wanted.length });
    }
  }
  candidates.sort((a, b) => b.phraseLength - a.phraseLength || a.start - b.start);
  const accepted = [];
  const seen = new Set();
  for (const candidate of candidates) {
    const id = `${candidate.provisionType}:${candidate.field}`;
    if (seen.has(id)) continue;
    const overlaps = accepted.some((match) => candidate.start < match.end && candidate.end > match.start);
    if (overlaps) continue;
    accepted.push(candidate);
    seen.add(id);
  }
  return accepted.sort((a, b) => a.start - b.start);
}

function relativeTerminationFeeMatch(question, catalog) {
  const text = normaliseText(question);
  if (!/\b(?:termination|break) fees?\b/.test(text)) return null;
  const explicitlyAmount = /\b(?:amount|dollars?|usd)\b|\$/.test(String(question));
  const relativeContext = /\b(?:market|range|median|average|distribution|typical|percent(?:age)?|deal value|over|under|at least|at most|more than|less than)\b|%/.test(text);
  if (explicitlyAmount && !/\bpercent(?:age)?\b|%|deal value/.test(text)) return null;
  if (!relativeContext) return null;
  const reverse = /\b(?:reverse|buyer)\b/.test(text);
  const field = reverse ? 'reverseFeePctOfDealValue' : 'feePctOfDealValue';
  if (!fieldInCatalog(catalog, 'TERMINATION_FEE', field)) return null;
  const phrase = text.match(/(?:reverse |buyer |company |target )?(?:termination|break) fees?/);
  const start = phrase ? phrase.index : 0;
  return {
    provisionType: 'TERMINATION_FEE',
    field,
    label: reverse ? 'Reverse termination fee (% of deal value)' : 'Company termination fee (% of deal value)',
    start,
    end: start + (phrase ? phrase[0].length : text.length),
    phraseLength: phrase ? phrase[0].length : text.length,
  };
}

const FIELD_STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'what', 'which', 'show', 'compare',
  'market', 'range', 'across', 'deals', 'deal', 'provision', 'present', 'text', 'summary',
]);

function genericFieldMatch(question, catalog, provisionTypes) {
  const questionText = normaliseText(question);
  const questionTokens = new Set(questionText.split(' ').filter((token) => token.length > 2 && !FIELD_STOP_WORDS.has(token)));
  const scored = [];
  const types = provisionTypes.length ? provisionTypes : PROVISION_CARD_TYPES;
  for (const provisionType of types) {
    for (const field of catalog[provisionType] || []) {
      if (field.key === 'mainConcept') continue;
      const label = normaliseText(field.label);
      const key = normaliseText(field.key);
      if (questionText.includes(key) || questionText.includes(label)) {
        scored.push({ provisionType, field: field.key, label: field.label, score: 10 + label.length / 1000 });
        continue;
      }
      const labelTokens = unique(label.split(' ').filter((token) => token.length > 2 && !FIELD_STOP_WORDS.has(token)));
      const hits = labelTokens.filter((token) => questionTokens.has(token)).length;
      if (hits < 2 || hits / Math.max(labelTokens.length, 1) < 0.55) continue;
      scored.push({ provisionType, field: field.key, label: field.label, score: hits / labelTokens.length });
    }
  }
  scored.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
  if (!scored.length) return [];
  const best = scored[0].score;
  return scored.filter((match) => match.score === best).slice(0, 4);
}

function findFieldMatches(question, catalog = buildFieldCatalog()) {
  const relativeFee = relativeTerminationFeeMatch(question, catalog);
  if (relativeFee) return [relativeFee];
  const explicit = fieldPhraseMatches(question).filter((match) => fieldInCatalog(catalog, match.provisionType, match.field));
  if (explicit.length) return explicit;
  const provisionTypes = inferProvisionTypes(question);
  return genericFieldMatch(question, catalog, provisionTypes);
}

function fieldLabel(catalog, provisionType, fieldKey) {
  const phrase = FIELD_PHRASES.find((entry) => entry.provisionType === provisionType && entry.field === fieldKey);
  if (phrase) return phrase.label;
  const field = fieldInCatalog(catalog, provisionType, fieldKey);
  return field ? field.label : fieldKey;
}

function rowSuggestions(provisionType, catalog = buildFieldCatalog(), mode = 'market') {
  const preferred = PREFERRED_FIELDS[provisionType] || (catalog[provisionType] || []).map((field) => field.key);
  return preferred
    .map((key) => fieldInCatalog(catalog, provisionType, key))
    .filter(Boolean)
    .slice(0, 4)
    .map((field) => {
      const label = fieldLabel(catalog, provisionType, field.key);
      const question = mode === 'cross_cut'
        ? `Show ${label.toLowerCase()} across all deals`
        : `What is the market range for ${label.toLowerCase()}?`;
      return { label, question };
    });
}

function clarificationResponse(clarification, suggestions = []) {
  return {
    status: 'needs_clarification',
    clarification: String(clarification || 'Please be more specific.'),
    suggestions: (suggestions || []).slice(0, 6).map((suggestion) => ({
      label: String(suggestion.label || '').slice(0, 100),
      question: String(suggestion.question || '').slice(0, MAX_QUERY_LENGTH),
    })).filter((suggestion) => suggestion.label && suggestion.question),
  };
}

function requiresRowChoice(question, catalog = buildFieldCatalog()) {
  const fields = findFieldMatches(question, catalog);
  if (fields.length) return false;
  const types = inferProvisionTypes(question, fields);
  if (!types.length) return false;
  const text = normaliseText(question);
  const marketLike = /\b(market|range|across|cross cut|compare|comparison|typical|median|average|distribution)\b/.test(text);
  return marketLike || text.split(' ').length <= 4;
}

function knownDealIds(deals) {
  return new Set((deals || []).map((deal) => String(deal.id)));
}

function resolveDealIds(ids, deals) {
  const known = knownDealIds(deals);
  return unique(asArray(ids).map(String)).map((id) => {
    if (!known.has(id)) throw new IntentValidationError(`Unknown deal_id: ${id}`);
    return id;
  });
}

function resolveProvisionTypes(types) {
  return unique(asArray(types)).map((type) => {
    if (!PROVISION_CARD_TYPES.includes(type)) throw new IntentValidationError(`Unknown provision_type: ${type}`);
    return type;
  });
}

function resolveField(catalog, provisionType, requested) {
  if (!PROVISION_CARD_TYPES.includes(provisionType)) throw new IntentValidationError(`Unknown provision_type: ${provisionType}`);
  const field = fieldInCatalog(catalog, provisionType, requested);
  if (!field) throw new IntentValidationError(`Unknown field for ${provisionType}: ${requested}`);
  return field;
}

function codedValueOptions(provisionType, field, provisions) {
  const options = [];
  const seen = new Set();
  const add = (code, label = code) => {
    const canonical = String(code == null ? '' : code).trim();
    if (!canonical || seen.has(canonical)) return;
    seen.add(canonical);
    options.push({ code: canonical, label: String(label == null ? canonical : label).trim() || canonical });
  };

  let definition;
  try {
    definition = fieldDef(provisionType, field.key);
  } catch {
    definition = null;
  }
  for (const code of definition?.options || []) add(code);

  const taxonomy = taxonomyForFeatureKey(field.key);
  for (const [code, label] of Object.entries(taxonomy || {})) {
    add(code, String(label).split(' — ')[0]);
  }

  try {
    const observed = valueOptionsForField(provisionType, field.key, provisions || []);
    for (const option of observed.options || []) add(option.code, option.label);
  } catch {}
  return options;
}

function canonicalCodedValue(provisionType, field, rawValue, provisions) {
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    throw new IntentValidationError(`${field.label} requires a value`);
  }
  const requested = String(rawValue).trim();
  const wanted = normaliseText(requested);
  const alias = CODED_VALUE_ALIASES[field.key]?.[wanted];
  if (alias) return alias;

  const options = codedValueOptions(provisionType, field, provisions);
  const exact = options.filter(({ code }) => code.toLowerCase() === requested.toLowerCase());
  if (exact.length === 1) return exact[0].code;

  const matches = options.filter(({ code, label }) => normaliseText(code) === wanted || normaliseText(label) === wanted);
  const codes = unique(matches.map(({ code }) => code));
  if (codes.length === 1) return codes[0];
  if (codes.length > 1) throw new IntentValidationError(`Ambiguous ${field.label} value: ${requested}`);
  throw new IntentValidationError(`Unknown ${field.label} value: ${requested}`);
}

function coerceFilterValue(field, op, value, { provisionType, provisions = [] } = {}) {
  if (!FILTER_OPERATORS.has(op)) throw new IntentValidationError(`Unsupported filter operator: ${op}`);
  const allowed = field.boolean ? BOOLEAN_OPERATORS
    : field.numeric ? NUMERIC_OPERATORS
    : field.type === 'date' ? DATE_OPERATORS
    : field.coded ? CODED_OPERATORS
    : TEXT_OPERATORS;
  if (!allowed.has(op)) throw new IntentValidationError(`${op} is not valid for ${field.label}`);
  if (field.boolean) {
    if (typeof value === 'boolean') return value;
    if (String(value).toLowerCase() === 'true') return true;
    if (String(value).toLowerCase() === 'false') return false;
    throw new IntentValidationError(`${field.label} requires a true or false value`);
  }
  if (field.numeric) {
    if (op === 'between') {
      const values = asArray(value).map(Number);
      if (values.length !== 2 || values.some((number) => !Number.isFinite(number))) {
        throw new IntentValidationError(`${field.label} requires two numbers for between`);
      }
      return values;
    }
    const number = Number(value);
    if (!Number.isFinite(number)) throw new IntentValidationError(`${field.label} requires a number`);
    return number;
  }
  if (field.coded) {
    if (!provisionType) throw new IntentValidationError(`Provision type is required for ${field.label}`);
    if (op === 'in' || op === 'not_in') {
      const values = asArray(value).map((item) => canonicalCodedValue(provisionType, field, item, provisions));
      if (!values.length) throw new IntentValidationError(`${field.label} requires at least one value`);
      return unique(values);
    }
    if (Array.isArray(value) && value.length !== 1) {
      throw new IntentValidationError(`${field.label} requires one value for ${op}`);
    }
    return canonicalCodedValue(provisionType, field, Array.isArray(value) ? value[0] : value, provisions);
  }
  if (Array.isArray(value)) {
    const values = value.map((item) => String(item).trim()).filter(Boolean);
    if (!values.length) throw new IntentValidationError(`${field.label} requires a value`);
    return values;
  }
  const text = String(value == null ? '' : value).trim();
  if (!text) throw new IntentValidationError(`${field.label} requires a value`);
  return text;
}

function predicateScopes(question, matches) {
  if (matches.length <= 1) return [question];
  const text = normaliseText(question);
  if (matches.some((match) => !Number.isInteger(match.start) || !Number.isInteger(match.end))) return null;
  for (let index = 1; index < matches.length; index += 1) {
    if (/\bor\b/.test(text.slice(matches[index - 1].end, matches[index].start))) return null;
  }
  const separators = /\b(?:and|but|while|whereas)\b|[,;]/g;
  return matches.map((match, index) => {
    let start = 0;
    let end = text.length;
    if (index > 0) {
      const previous = matches[index - 1];
      const gap = text.slice(previous.end, match.start);
      const found = [...gap.matchAll(separators)];
      if (found.length) {
        const separator = found[found.length - 1];
        start = previous.end + separator.index + separator[0].length;
      }
    }
    if (index < matches.length - 1) {
      const next = matches[index + 1];
      const gap = text.slice(match.end, next.start);
      const found = [...gap.matchAll(separators)];
      if (found.length) end = match.end + found[found.length - 1].index;
    }
    return text.slice(start, end).trim();
  });
}

function inferFilterFromQuestion(question, match, catalog) {
  const field = resolveField(catalog, match.provisionType, match.field);
  const text = normaliseText(question);
  if (field.boolean) {
    const negative = /\b(without|does not have|do not have|no)\b/.test(text);
    return { provision_type: match.provisionType, field: field.key, op: 'eq', value: !negative };
  }
  if (field.numeric) {
    const between = text.match(/\bbetween\s+(-?\d+(?:\.\d+)?)\s+(?:and|to)\s+(-?\d+(?:\.\d+)?)/);
    if (between) return { provision_type: match.provisionType, field: field.key, op: 'between', value: [Number(between[1]), Number(between[2])] };
    const numberMatch = text.match(/-?\d+(?:\.\d+)?/);
    if (!numberMatch) return null;
    const value = Number(numberMatch[0]);
    let op = 'eq';
    if (/\b(at least|minimum|no less than)\b/.test(text)) op = 'gte';
    else if (/\b(at most|maximum|no more than)\b/.test(text)) op = 'lte';
    else if (/\b(more than|greater than|over)\b/.test(text)) op = 'gt';
    else if (/\b(less than|fewer than|under)\b/.test(text)) op = 'lt';
    return { provision_type: match.provisionType, field: field.key, op, value };
  }
  if (field.key === 'considerationType') {
    const code = ['CASH', 'STOCK', 'MIXED'].find((value) => phraseMatches(question, value));
    if (code) return { provision_type: match.provisionType, field: field.key, op: 'eq', value: code };
  }
  if (field.key === 'dealStructure') {
    if (/\b(tender offers?|two step)\b/.test(text)) return { provision_type: match.provisionType, field: field.key, op: 'eq', value: 'TWO_STEP_TENDER_OFFER' };
    if (/\bone step(?: merger)?s?\b/.test(text)) return { provision_type: match.provisionType, field: field.key, op: 'eq', value: 'ONE_STEP_MERGER' };
  }
  const quoted = String(question).match(/["“]([^"”]+)["”]/);
  if (quoted) return { provision_type: match.provisionType, field: field.key, op: 'contains', value: quoted[1] };
  return null;
}

function summaryFor(kind, payload, catalog) {
  if (kind === 'MARKET_RANGE') return `Market range · ${fieldLabel(catalog, payload.provision_type, payload.field_path)}`;
  if (kind === 'PROVISION_CROSS_CUT') {
    const labels = payload.columns.map((field) => fieldLabel(catalog, payload.provision_type, field)).join(', ');
    return `${titleForProvisionType(payload.provision_type)} cross-cut · ${labels}`;
  }
  const labels = payload.filters.map((filter) => fieldLabel(catalog, filter.provision_type, filter.field)).join(', ');
  return labels ? `Filtered deals · ${labels}` : 'Filtered deals';
}

function validateReadyPayload(kind, payload, { deals = [], provisions = [], catalog = buildFieldCatalog() } = {}) {
  if (!QUERY_KINDS.includes(kind)) throw new IntentValidationError(`Unknown query kind: ${kind}`);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new IntentValidationError('Query payload is missing');
  if (kind === 'MARKET_RANGE') {
    resolveField(catalog, payload.provision_type, payload.field_path);
    if (!['HISTOGRAM', 'BOX', 'BAR'].includes(payload.chart_kind)) throw new IntentValidationError('MARKET_RANGE chart_kind is invalid');
    if (!payload.deal_filter || typeof payload.deal_filter !== 'object') throw new IntentValidationError('MARKET_RANGE deal_filter is missing');
  } else if (kind === 'PROVISION_CROSS_CUT') {
    resolveDealIds(payload.deal_ids, deals);
    if (!payload.columns || !payload.columns.length) throw new IntentValidationError('PROVISION_CROSS_CUT requires at least one comparable term');
    for (const field of payload.columns) resolveField(catalog, payload.provision_type, field);
    if (!payload.sort_by) throw new IntentValidationError('PROVISION_CROSS_CUT sort_by is missing');
  } else if (kind === 'FILTER_THEN_LIST') {
    const filters = Array.isArray(payload.filters) ? payload.filters : [];
    const hasDealFilter = payload.deal_filter && typeof payload.deal_filter === 'object' && Object.keys(payload.deal_filter).length > 0;
    if (!filters.length && !hasDealFilter) throw new IntentValidationError('FILTER_THEN_LIST requires a provision or deal filter');
    for (const filter of filters) {
      const field = resolveField(catalog, filter.provision_type, filter.field);
      coerceFilterValue(field, filter.op, filter.value, { provisionType: filter.provision_type, provisions });
    }
    if (!payload.sort_by || !Array.isArray(payload.columns)) throw new IntentValidationError('FILTER_THEN_LIST output settings are missing');
  }
  validate(kind, payload, { deals });
  return true;
}

function compileIntent(intent, { deals = [], provisions = [], catalog = buildFieldCatalog() } = {}) {
  if (!intent || typeof intent !== 'object' || Array.isArray(intent)) throw new IntentValidationError('Interpretation must be an object');
  if (intent.status === 'needs_clarification' || intent.kind === 'CLARIFY') {
    return clarificationResponse(intent.clarification, intent.suggestions);
  }
  const kind = String(intent.kind || '').toUpperCase();
  if (!QUERY_KINDS.includes(kind)) throw new IntentValidationError(`Unknown query kind: ${kind || '(missing)'}`);
  const dealFilter = compileDealFilter(intent.deal_filter, deals);
  let payload;

  if (kind === 'MARKET_RANGE') {
    const provisionType = resolveProvisionTypes([intent.provision_type])[0];
    const requestedFields = asArray(intent.field_paths || intent.field_keys || intent.field_path);
    if (requestedFields.length !== 1) {
      return clarificationResponse(
        requestedFields.length ? 'A market check compares one metric at a time. Which metric should I use?' : `Which ${titleForProvisionType(provisionType)} metric do you want to compare?`,
        rowSuggestions(provisionType, catalog),
      );
    }
    const field = resolveField(catalog, provisionType, requestedFields[0]);
    payload = {
      provision_type: provisionType,
      field_path: field.key,
      deal_filter: dealFilter,
      chart_kind: field.numeric ? 'HISTOGRAM' : 'BAR',
    };
  } else if (kind === 'PROVISION_CROSS_CUT') {
    const provisionType = resolveProvisionTypes([intent.provision_type])[0];
    const columns = unique(asArray(intent.field_paths || intent.field_keys || intent.columns).map((field) => resolveField(catalog, provisionType, field).key));
    if (!columns.length) {
      return clarificationResponse(`Which ${titleForProvisionType(provisionType)} term do you want in the cross-cut?`, rowSuggestions(provisionType, catalog, 'cross_cut'));
    }
    let dealIds = resolveDealIds(intent.deal_ids, deals);
    if (!dealIds.length) dealIds = deals.filter((deal) => dealMatchesFilter(deal, dealFilter)).map((deal) => String(deal.id));
    if (!dealIds.length) return clarificationResponse('Which deals should the cross-cut include?');
    payload = {
      provision_type: provisionType,
      provision_subtype: null,
      deal_ids: dealIds,
      columns,
      sort_by: 'deal_signing_date_desc',
    };
  } else if (kind === 'FILTER_THEN_LIST') {
    const sourceFilters = Array.isArray(intent.filters) ? intent.filters : [];
    const filters = [];
    for (const source of sourceFilters) {
      const provisionType = resolveProvisionTypes([source.provision_type])[0];
      const field = resolveField(catalog, provisionType, source.field || source.field_path || source.field_key);
      const op = String(source.op || source.operator || 'eq');
      filters.push({
        provision_type: provisionType,
        field: field.key,
        op,
        value: coerceFilterValue(field, op, source.value, { provisionType, provisions }),
      });
    }
    if (!filters.length && intent.provision_type && asArray(intent.field_paths || intent.field_keys).length === 1) {
      const provisionType = resolveProvisionTypes([intent.provision_type])[0];
      const field = resolveField(catalog, provisionType, asArray(intent.field_paths || intent.field_keys)[0]);
      if (field.boolean) filters.push({ provision_type: provisionType, field: field.key, op: 'eq', value: true });
    }
    if (!filters.length && !Object.keys(dealFilter).length) return clarificationResponse('What condition should the deals match?');
    payload = {
      filters,
      deal_filter: dealFilter,
      sort_by: 'deal_signing_date_desc',
      columns: DEFAULT_RESULT_COLUMNS,
    };
  } else {
    // Unreachable: kind is constrained to QUERY_KINDS above, and every
    // surviving kind has an explicit branch. Fail closed rather than fall
    // through silently if that ever stops being true.
    throw new IntentValidationError(`Unhandled query kind: ${kind}`);
  }

  validateReadyPayload(kind, payload, { deals, provisions, catalog });
  return { status: 'ready', kind, payload, summary: summaryFor(kind, payload, catalog) };
}

function inferKind(question, fieldMatches, matchedDeals) {
  const text = normaliseText(question);
  if (/\b(vs|versus|against) (the )?market\b/.test(text) || /\bcompare\b.*\b(to|with) (the )?market\b/.test(text) || (/\bhow does\b/.test(text) && /\bmarket\b/.test(text))) {
    return RETIRED_KIND_DEAL_TO_MARKET;
  }
  if (matchedDeals.length >= 2 && /\b(compare|difference|differences|versus|vs|side by side)\b/.test(text)) return RETIRED_KIND_DEAL_COMPARE;
  if (/\b(cross cut|crosscut|table|side by side)\b/.test(text) || /\b(show|list)\b.*\b(for each|across all)\b.*\bdeal/.test(text)) {
    return 'PROVISION_CROSS_CUT';
  }
  if (/\b(which|find|list)\b.*\bdeals?\b/.test(text) || /\bdeals?\b.*\b(with|without|where|that have|having|at least|at most|more than|less than)\b/.test(text)) {
    return 'FILTER_THEN_LIST';
  }
  if (/\b(market|range|median|average|distribution|frequency|how common|typical|across deals)\b/.test(text)) return 'MARKET_RANGE';
  if (matchedDeals.length >= 2) return RETIRED_KIND_DEAL_COMPARE;
  if (fieldMatches.length) return 'MARKET_RANGE';
  return null;
}

function interpretDeterministically(questionInput, { deals = [], provisions = [], catalog = buildFieldCatalog() } = {}) {
  let question;
  try {
    question = normaliseQuestion(questionInput);
  } catch (error) {
    return clarificationResponse(error.message);
  }
  const fieldMatches = findFieldMatches(question, catalog);
  const provisionTypes = inferProvisionTypes(question, fieldMatches);
  const matchedDeals = matchDeals(question, deals);
  const broadDealKind = inferKind(question, [], matchedDeals);
  if (requiresRowChoice(question, catalog) && ![RETIRED_KIND_DEAL_COMPARE, RETIRED_KIND_DEAL_TO_MARKET].includes(broadDealKind)) {
    const provisionType = provisionTypes[0];
    const matchingRights = /\bmatching rights periods?\b/.test(normaliseText(question));
    const suggestions = matchingRights
      ? ['initialMatchPeriodDays', 'subsequentMatchingPeriod']
        .map((key) => fieldInCatalog(catalog, 'COVENANT_NO_SOLICITATION', key))
        .filter(Boolean)
        .map((field) => {
          const label = fieldLabel(catalog, 'COVENANT_NO_SOLICITATION', field.key);
          return { label, question: `What is the market range for ${label.toLowerCase()}?` };
        })
      : rowSuggestions(provisionType, catalog);
    return clarificationResponse(
      matchingRights
        ? 'Do you mean the initial or subsequent matching-rights period?'
        : `“${titleForProvisionType(provisionType)}” covers several distinct comparable terms. Which term do you want to compare?`,
      suggestions,
    );
  }
  const kind = inferKind(question, fieldMatches, matchedDeals);
  if (kind === RETIRED_KIND_DEAL_COMPARE) {
    return clarificationResponse('Comparing named deals side by side has moved to the review page — open a deal and use its Compare view to line it up against others.');
  }
  if (kind === RETIRED_KIND_DEAL_TO_MARKET) {
    return clarificationResponse('Comparing a deal against market norms now lives on that deal’s review page — open it to see market context inline.');
  }
  if (!kind) {
    return clarificationResponse('What do you want to compare or filter?', [
      { label: 'Matching-rights period', question: 'What is the market range for the initial matching-rights period?' },
      { label: 'Deals with a go-shop', question: 'Which deals have a go-shop?' },
      { label: 'Company termination fee', question: 'What is the market range for the company termination fee?' },
    ]);
  }
  const dealFilter = inferDealFilter(question, deals);
  const base = {
    status: 'ready',
    kind,
    deal_filter: dealFilter,
    deal_ids: matchedDeals.map((match) => String(match.deal.id)),
    provision_type: fieldMatches[0] ? fieldMatches[0].provisionType : provisionTypes[0],
    field_paths: fieldMatches.map((match) => match.field),
  };
  if (kind === 'FILTER_THEN_LIST') {
    const scopes = predicateScopes(question, fieldMatches);
    if (!scopes) return clarificationResponse('Should the term conditions all be required, or are any of them alternatives?');
    const inferred = fieldMatches.map((match, index) => inferFilterFromQuestion(scopes[index], match, catalog));
    if (inferred.some((filter) => !filter)) return clarificationResponse('Give a separate condition for each term you want to filter.');
    base.filters = inferred;
  }
  try {
    return compileIntent(base, { deals, provisions, catalog });
  } catch (error) {
    if (error instanceof IntentValidationError) return clarificationResponse(error.message);
    throw error;
  }
}

function buildInterpreterPrompt(catalog = buildFieldCatalog(), deals = []) {
  const fieldLines = [];
  for (const provisionType of PROVISION_CARD_TYPES) {
    for (const field of catalog[provisionType] || []) {
      fieldLines.push(`${provisionType} | ${field.key} | ${field.label} | ${field.type}`);
    }
  }
  const dealLines = deals.map((deal) => `${deal.id} | ${dealName(deal)}`);
  const facets = buildDealFacetCatalog(deals);
  return [
    'Interpret one natural-language question into the supported precedent-query intent.',
    'Call submit_query_intent exactly once. Select only identifiers in the catalogues below.',
    'A provision family is not a comparable metric. If the question names only a broad family such as Consideration, return needs_clarification with concrete metric questions.',
    'MARKET_RANGE accepts exactly one field. PROVISION_CROSS_CUT accepts one provision type and one or more fields. Never invent a field or deal ID.',
    '',
    'FIELDS',
    ...fieldLines,
    '',
    'DEALS',
    ...(dealLines.length ? dealLines : ['No deals are currently available.']),
    '',
    'DEAL FILTER VALUES',
    ...Object.entries(facets).map(([key, values]) => `${key} | ${values.join(' ; ')}`),
  ].join('\n');
}

function buildIntentTool(catalog = buildFieldCatalog(), deals = []) {
  const fieldKeys = unique(Object.values(catalog).flat().map((field) => field.key));
  const dealIds = unique(deals.map((deal) => String(deal.id)));
  const fieldItems = { type: 'string', enum: fieldKeys };
  const dealItems = dealIds.length ? { type: 'string', enum: dealIds } : { type: 'string' };
  const primitiveValue = {
    anyOf: [
      { type: 'string' },
      { type: 'number' },
      { type: 'boolean' },
      { type: 'array', items: { anyOf: [{ type: 'string' }, { type: 'number' }] }, maxItems: 10 },
    ],
  };
  const suggestion = {
    type: 'object',
    additionalProperties: false,
    required: ['label', 'question'],
    properties: { label: { type: 'string' }, question: { type: 'string' } },
  };
  return {
    name: 'submit_query_intent',
    description: 'Return a constrained query intent or ask the user to choose a more specific comparable term or deal.',
    strict: true,
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['status'],
      properties: {
        status: { type: 'string', enum: ['ready', 'needs_clarification'] },
        kind: { type: 'string', enum: QUERY_KINDS },
        provision_type: { type: 'string', enum: PROVISION_CARD_TYPES },
        field_paths: { type: 'array', items: fieldItems, maxItems: 12 },
        deal_ids: { type: 'array', items: dealItems, maxItems: 40 },
        provision_types: { type: 'array', items: { type: 'string', enum: PROVISION_CARD_TYPES }, maxItems: PROVISION_CARD_TYPES.length },
        filters: {
          type: 'array',
          maxItems: 8,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['provision_type', 'field', 'op', 'value'],
            properties: {
              provision_type: { type: 'string', enum: PROVISION_CARD_TYPES },
              field: fieldItems,
              op: { type: 'string', enum: [...FILTER_OPERATORS] },
              value: primitiveValue,
            },
          },
        },
        deal_filter: {
          type: 'object',
          additionalProperties: false,
          properties: {
            consideration_type: { type: 'array', items: { type: 'string' } },
            buyer: { type: 'array', items: { type: 'string' } },
            law_firm: { type: 'array', items: { type: 'string' } },
            lawyer: { type: 'array', items: { type: 'string' } },
            merger_form: { type: 'array', items: { type: 'string' } },
            sector: { type: 'array', items: { type: 'string' } },
            signing_year: { type: 'array', items: { type: 'number' } },
            search: { type: 'string' },
          },
        },
        clarification: { type: 'string' },
        suggestions: { type: 'array', items: suggestion, maxItems: 6 },
      },
    },
  };
}

module.exports = {
  MAX_QUERY_LENGTH,
  DEFAULT_RESULT_COLUMNS,
  IntentValidationError,
  buildFieldCatalog,
  buildDealFacetCatalog,
  buildInterpreterPrompt,
  buildIntentTool,
  compileIntent,
  findFieldMatches,
  interpretDeterministically,
  normaliseQuestion,
  requiresRowChoice,
  rowSuggestions,
  validateReadyPayload,
};
