const { parseNumeric } = require('../normalize-numeric');
const { normalizeDurationClaim } = require('../queries/corpus-duration');
const { affirmativeObligationIdentity, parseNestedObject } = require('../market-metrics/ioc-obligation-identity');
const { cardMatchesFamily } = require('./families');

function finiteNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^-?[\d,]+(?:\.\d+)?$/.test(trimmed)) {
    const parsed = Number(trimmed.replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normaliseUnit(unit) {
  if (unit === null || unit === undefined || unit === '') return null;
  const value = String(unit).trim().toLowerCase().replace(/[\s-]+/g, '_');
  const aliases = {
    '$': 'usd',
    dollar: 'usd',
    dollars: 'usd',
    usd: 'usd',
    percentage: 'percent',
    percentages: 'percent',
    '%': 'percent',
    day: 'calendar_days',
    days: 'calendar_days',
    calendar_day: 'calendar_days',
    calendar_days: 'calendar_days',
    business_day: 'business_days',
    business_days: 'business_days',
    hour: 'elapsed_hours',
    hours: 'elapsed_hours',
    elapsed_hour: 'elapsed_hours',
    elapsed_hours: 'elapsed_hours',
    month: 'months',
    months: 'months',
    year: 'years',
    years: 'years',
  };
  return aliases[value] || value;
}

function isNonEmpty(value) {
  if (value === null || value === undefined || value === '') return false;
  if (Array.isArray(value)) return value.some(isNonEmpty);
  if (typeof value === 'object') return Object.values(value).some(isNonEmpty);
  return true;
}

function parseJson(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function featurePayload(claim) {
  const provenanceValue = claim && claim.provenance && claim.provenance.feature_value;
  const parsedVerbatim = parseJson(claim && claim.verbatim);
  return provenanceValue ?? parsedVerbatim ?? claim?.canonical ?? claim?.verbatim ?? null;
}

function unwrapValue(value) {
  if (value && typeof value === 'object' && !Array.isArray(value) && 'value' in value) {
    return value.value;
  }
  return value;
}

function deepGet(value, path) {
  if (!path) return value;
  const parts = String(path).split('.').filter(Boolean);
  let cursor = value;
  for (const part of parts) {
    if (cursor === null || cursor === undefined || typeof cursor !== 'object') return undefined;
    cursor = cursor[part];
  }
  return cursor;
}

function readClaimPath(claim, path) {
  const payload = featurePayload(claim);
  const unwrapped = unwrapValue(payload);
  const candidates = [unwrapped, payload, claim];
  for (const candidate of candidates) {
    const value = deepGet(candidate, path);
    if (value !== undefined) return value;
  }
  return undefined;
}

function token(value) {
  if (value === null || value === undefined) return null;
  return String(value).trim().toUpperCase();
}

function candidateItemCodes(value) {
  if (value === null || value === undefined) return [];
  if (typeof value !== 'object') return [value];
  const unwrapped = unwrapValue(value);
  if (Array.isArray(unwrapped)) return unwrapped.flatMap(candidateItemCodes);
  if (!unwrapped || typeof unwrapped !== 'object') return [unwrapped];
  return [
    unwrapped.code,
    unwrapped.itemCode,
    unwrapped.item_code,
    unwrapped.item,
    unwrapped.category,
    unwrapped.bucket,
    unwrapped.instrumentCode,
    unwrapped.instrument_code,
  ].filter(isNonEmpty);
}

function identityForItem(item, identityKind) {
  if (identityKind === 'affirmative_ioc_obligation') return affirmativeObligationIdentity(item);
  return null;
}

function itemMatchesSpec(item, spec, claim = null) {
  const expectedCode = token(spec?.itemCode);
  const expectedIdentity = String(spec?.itemIdentity || '').trim();
  if (!expectedCode && !expectedIdentity) return false;
  const codeMatches = !expectedCode || [claim?.canonical, ...candidateItemCodes(item)]
    .some((value) => token(value) === expectedCode);
  const identityMatches = !expectedIdentity
    || identityForItem(item, spec.identityKind) === expectedIdentity;
  return codeMatches && identityMatches;
}

function claimMatchesItem(claim, itemSpec) {
  const spec = typeof itemSpec === 'string' ? { itemCode: itemSpec } : itemSpec;
  const payload = unwrapValue(featurePayload(claim));
  const items = Array.isArray(payload) ? payload : [payload];
  return items.some((item) => itemMatchesSpec(item, spec, claim));
}

function claimHasValue(claim) {
  return isNonEmpty(claim.canonical) || isNonEmpty(claim.verbatim) || isNonEmpty(featurePayload(claim));
}

function metricRawValues(claim, valueSpec) {
  const payload = featurePayload(claim);
  const unwrapped = unwrapValue(payload);
  if (valueSpec.strategy === 'list_items_field') {
    const items = Array.isArray(unwrapped) ? unwrapped : [unwrapped];
    return items.flatMap((item) => {
      const value = deepGet(item, valueSpec.path);
      if (value === undefined) return [];
      return Array.isArray(value) ? value : [value];
    });
  }
  if (valueSpec.strategy === 'list_item_field') {
    const items = Array.isArray(unwrapped) ? unwrapped : [unwrapped];
    return items
      .filter((item) => itemMatchesSpec(item, valueSpec, claim))
      .flatMap((item) => {
        const value = deepGet(valueSpec.identityKind === 'affirmative_ioc_obligation' ? parseNestedObject(item) : item, valueSpec.path);
        if (value === undefined && valueSpec.path === 'threshold') {
          const itemText = [
            item?.quote,
            item?.evidence,
            ...(Array.isArray(item?.quotes) ? item.quotes : []),
            typeof item?.text === 'string' && !/^[A-Z0-9_ -]+$/.test(item.text) ? item.text : null,
          ].filter(Boolean).join(' ');
          const matches = [...itemText.matchAll(/\$\s*([\d,]+(?:\.\d+)?)\s*(million|billion|m|bn|b)?\b/gi)];
          const amounts = matches.map((match) => {
            const base = Number(match[1].replace(/,/g, ''));
            const suffix = String(match[2] || '').toLowerCase();
            const multiplier = suffix === 'million' || suffix === 'm' ? 1e6 : suffix === 'billion' || suffix === 'bn' || suffix === 'b' ? 1e9 : 1;
            return base * multiplier;
          }).filter(Number.isFinite);
          const unique = [...new Set(amounts)];
          if (unique.length !== 1) return [];
          const cadence = /\b(?:per\s+annum|per\s+year|annual(?:ly)?)\b/i.test(itemText) ? 'annual'
            : /\bin\s+(?:19|20)\d{2}\b/i.test(itemText) ? 'specified_year'
            : /\b(?:per\s+month|monthly)\b/i.test(itemText) ? 'per_month'
            : /\b(?:per\s+day|daily)\b/i.test(itemText) ? 'per_day'
            : /\b(?:per|each)\s+(?:event|occurrence)\b/i.test(itemText) ? 'per_event'
            : /\baggregate\b/i.test(itemText) ? 'aggregate'
            : null;
          return [{ amount: unique[0], ...(cadence ? { cadence } : {}) }];
        }
        if (value === undefined) return [];
        return Array.isArray(value) ? value : [value];
      });
  }
  let value;
  if (valueSpec.path) value = readClaimPath(claim, valueSpec.path);
  else if (claim.canonical !== null && claim.canonical !== undefined && claim.canonical !== '') value = claim.canonical;
  else value = unwrapped;
  return Array.isArray(value) ? value : [value];
}

function durationUnitFromEvidence(claim, expectedValue) {
  const texts = [
    claim && claim.evidence_quote,
    claim && claim.provenance && claim.provenance.evidence_quote,
    claim && claim.verbatim,
  ].filter((value) => typeof value === 'string' && value.trim());
  const units = new Set();
  const escaped = String(expectedValue).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    [new RegExp(`\\b${escaped}\\s*(?:elapsed\\s+)?hours?\\b`, 'i'), 'elapsed_hours'],
    [new RegExp(`\\b${escaped}\\s*business\\s+days?\\b`, 'i'), 'business_days'],
    [new RegExp(`\\b${escaped}\\s*calendar\\s+days?\\b`, 'i'), 'calendar_days'],
    [new RegExp(`\\b${escaped}\\s*days?\\b`, 'i'), 'calendar_days'],
    [new RegExp(`\\b${escaped}\\s*months?\\b`, 'i'), 'months'],
    [new RegExp(`\\b${escaped}\\s*years?\\b`, 'i'), 'years'],
  ];
  for (const text of texts) {
    for (const [pattern, unit] of patterns) {
      if (pattern.test(text)) units.add(unit);
    }
  }
  return units.size === 1 ? [...units][0] : null;
}

function declaredScalarUnit(kind, semantics) {
  if (kind !== 'numeric' && kind !== 'money') return null;
  return normaliseUnit(semantics?.unit);
}

function numericValue(raw, claim, kind, linkedEvidence = null, semantics = null) {
  if (kind === 'duration') return normalizeDurationClaim(claim, linkedEvidence);
  const canonicalNumeric = claim && claim.canonical_numeric;
  if (
    canonicalNumeric
    && typeof canonicalNumeric === 'object'
    && Number.isFinite(Number(canonicalNumeric.value))
    && canonicalNumeric.unit
  ) {
    return { value: Number(canonicalNumeric.value), unit: canonicalNumeric.unit };
  }
  const direct = finiteNumber(raw);
  if (direct !== null) {
    return {
      value: direct,
      unit: declaredScalarUnit(kind, semantics),
    };
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const key of ['amount', 'threshold', 'number', 'days', 'hours']) {
      const nested = finiteNumber(raw[key]);
      if (nested !== null) {
        return {
          value: nested,
          unit: raw.unit || (key === 'days' ? 'days' : key === 'hours' ? 'elapsed_hours' : declaredScalarUnit(kind, semantics)),
        };
      }
    }
  }
  const text = typeof raw === 'string' ? raw : typeof claim.verbatim === 'string' ? claim.verbatim : null;
  if (!text) return null;
  if (kind === 'duration') {
    const hours = text.match(/^\s*(-?\d+(?:\.\d+)?)\s*hours?\s*$/i);
    if (hours) return { value: Number(hours[1]), unit: 'elapsed_hours' };
    const calendarDays = text.match(/^\s*(-?\d+(?:\.\d+)?)\s*calendar\s+days?\s*$/i);
    if (calendarDays) return { value: Number(calendarDays[1]), unit: 'calendar_days' };
  }
  const parsed = parseNumeric(text);
  return parsed ? { value: parsed.value, unit: parsed.unit } : null;
}

function scalarValue(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw !== 'object') return raw;
  const value = unwrapValue(raw);
  if (value !== raw) return scalarValue(value);
  for (const key of ['code', 'itemCode', 'item_code', 'category', 'bucket', 'label', 'text']) {
    if (isNonEmpty(raw[key])) return raw[key];
  }
  return null;
}

function cadenceFromEvidence(raw, claim, spec) {
  const payload = featurePayload(claim);
  const texts = [
    typeof raw === 'string' ? raw : null,
    typeof payload?.text === 'string' ? payload.text : null,
    typeof claim?.verbatim === 'string' ? claim.verbatim : null,
    typeof claim?.evidence_quote === 'string' ? claim.evidence_quote : null,
  ].filter(Boolean);
  const joined = texts.join(' ');
  if (/\b(?:per\s+annum|per\s+year|annual(?:ly)?)\b/i.test(joined)) return 'annual';
  if (/\bin\s+(?:19|20)\d{2}\b/i.test(joined)) return 'specified_year';
  if (/\b(?:per\s+month|monthly)\b/i.test(joined)) return 'per_month';
  if (/\b(?:per\s+day|daily)\b/i.test(joined)) return 'per_day';
  if (/\b(?:per|each)\s+(?:event|occurrence)\b/i.test(joined)) return 'per_event';
  if (/\baggregate\b/i.test(joined)) return 'aggregate';
  if (String(spec?.metricKey || '').startsWith('material-contracts.bucket.')) return 'aggregate';
  return null;
}

function valueDimensions(raw, parsed, spec, claim) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const semantics = spec.semantics || {};
  return {
    unit: normaliseUnit(source.unit ?? parsed?.unit),
    calendarBasis: source.calendarBasis ?? source.calendar_basis ?? source.clock
      ?? (normaliseUnit(source.unit ?? parsed?.unit) === 'business_days' ? 'business' : null)
      ?? (normaliseUnit(source.unit ?? parsed?.unit) === 'calendar_days' ? 'calendar' : null)
      ?? (normaliseUnit(source.unit ?? parsed?.unit) === 'elapsed_hours' ? 'elapsed' : null),
    trigger: source.trigger ?? semantics.trigger ?? null,
    cadence: source.cadence ?? cadenceFromEvidence(raw, claim, spec),
  };
}

function extractClaimValues(claim, spec, linkedEvidence = null) {
  const kind = spec.comparison.kind;
  const valueSpec = spec.observation.value;
  const result = [];
  for (const raw of metricRawValues(claim, valueSpec)) {
    if (!isNonEmpty(raw)) continue;
    if (kind === 'numeric' || kind === 'money' || kind === 'duration') {
      const parsed = numericValue(raw, claim, kind, linkedEvidence, spec.semantics);
      if (!parsed || !Number.isFinite(parsed.value)) continue;
      result.push({ value: parsed.value, ...valueDimensions(raw, parsed, spec, claim) });
      continue;
    }
    const scalar = scalarValue(raw);
    if (scalar !== null) result.push({ value: scalar, ...valueDimensions(raw, null, spec, claim) });
  }
  return result;
}

function dealPassesFilters(deal, filters) {
  if (filters.sector && String(deal.sector || '') !== filters.sector) return false;
  if (filters.buyer && String(deal.acquirer || '') !== filters.buyer) return false;
  if (filters.form && String(deal.metadata?.merger_form || '') !== filters.form) return false;
  const year = deal.announce_date ? Number(String(deal.announce_date).slice(0, 4)) : null;
  if (filters.yearFrom !== null && filters.yearFrom !== undefined && (!year || year < filters.yearFrom)) return false;
  if (filters.yearTo !== null && filters.yearTo !== undefined && (!year || year > filters.yearTo)) return false;
  const value = finiteNumber(deal.value_usd);
  if (filters.minValueUsd !== null && filters.minValueUsd !== undefined && (value === null || value < filters.minValueUsd)) return false;
  if (filters.maxValueUsd !== null && filters.maxValueUsd !== undefined && (value === null || value > filters.maxValueUsd)) return false;
  return true;
}

function indexDataset(dataset) {
  const cardsByDeal = new Map();
  const cardByExcerpt = new Map();
  for (const card of dataset.cards || []) {
    if (!cardsByDeal.has(card.deal_id)) cardsByDeal.set(card.deal_id, []);
    cardsByDeal.get(card.deal_id).push(card);
    if (card.excerpt_id) cardByExcerpt.set(`${card.deal_id}|${card.excerpt_id}`, card);
  }
  const claimsByDeal = new Map();
  for (const claim of dataset.claims || []) {
    if (!claimsByDeal.has(claim.deal_id)) claimsByDeal.set(claim.deal_id, []);
    claimsByDeal.get(claim.deal_id).push(claim);
  }
  return { ...dataset, cardsByDeal, cardByExcerpt, claimsByDeal };
}

function cardMatchesScope(card, cohort) {
  if (cohort.scope === 'all_deals') return true;
  if (cohort.scope === 'provision_family') {
    return cardMatchesFamily(card, cohort.provisionFamily);
  }
  const codes = new Set((cohort.provisionCodes || []).map(token));
  return codes.has(token(card.provision_subtype));
}

function claimMatchesScope(claim, spec, index) {
  const cohort = spec.cohort;
  let cohortMatch = false;
  if (cohort.scope === 'all_deals') cohortMatch = true;
  const card = index.cardByExcerpt.get(`${claim.deal_id}|${claim.excerpt_id}`);
  if (cohort.scope === 'provision_family') {
    cohortMatch = Boolean(card) && cardMatchesFamily(card, cohort.provisionFamily);
  }
  if (cohort.scope === 'provision_codes') {
    const codes = new Set((cohort.provisionCodes || []).map(token));
    const claimCode = claim.provenance && claim.provenance.code;
    cohortMatch = codes.has(token(claimCode)) || (Boolean(card) && codes.has(token(card.provision_subtype)));
  }
  if (!cohortMatch) return false;
  const observationCodes = new Set((spec.observation.scope?.provisionCodes || []).map(token));
  if (!observationCodes.size) return true;
  const claimCode = claim.provenance && claim.provenance.code;
  return observationCodes.has(token(claimCode))
    || (Boolean(card) && observationCodes.has(token(card.provision_subtype)));
}

function isApplicable(spec, scopedCards, allCards) {
  if (spec.cohort.eligibility === 'all_deals') return true;
  if (spec.cohort.eligibility === 'family_present') {
    return allCards.some((card) => cardMatchesFamily(card, spec.cohort.provisionFamily));
  }
  if (spec.cohort.eligibility === 'code_present') {
    const codes = new Set((spec.cohort.provisionCodes || []).map(token));
    return allCards.some((card) => codes.has(token(card.provision_subtype)));
  }
  return scopedCards.length > 0;
}

function definitionPresent(cards, term) {
  const canonicalTerm = (value) => String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
    .replace(/\s+/g, ' ');
  const expected = canonicalTerm(term);
  if (!expected) return false;
  return cards.some((card) => token(card.provision_type) === 'DEFINITION'
    && (canonicalTerm(card.defined_term) === expected || canonicalTerm(card.short_title) === expected));
}

function presenceForDeal(spec, scopedCards, scopedClaims, allCards) {
  const presence = spec.observation.presence;
  if (presence.strategy === 'card_exists') {
    const codes = new Set((presence.provisionCodes || []).map(token));
    if (codes.size) return allCards.some((card) => codes.has(token(card.provision_subtype)));
    return scopedCards.length > 0;
  }
  if (presence.strategy === 'definition_term') return definitionPresent(allCards, presence.term);
  const features = new Set(presence.featureKeys || []);
  const claims = scopedClaims.filter((claim) => features.has(claim.attribute));
  if (presence.strategy === 'feature_non_empty') return claims.some(claimHasValue);
  if (presence.strategy === 'list_item') return claims.some((claim) => claimMatchesItem(claim, presence));
  return false;
}

function valuesForDeal(spec, scopedClaims, index) {
  if (spec.comparison.kind === 'presence') return [];
  const valueSpec = spec.observation.value;
  const features = new Set(valueSpec.featureKeys || []);
  return scopedClaims
    .filter((claim) => features.has(claim.attribute))
    .flatMap((claim) => {
      const card = index.cardByExcerpt.get(`${claim.deal_id}|${claim.excerpt_id}`);
      return extractClaimValues(claim, spec, card?.primary_quote || null);
    });
}

function metricDeals(index, filters, subjectDealId, allowedDealIds) {
  const nonStaging = (index.deals || []).filter((deal) => deal.metadata?.ingest_status !== 'staging');
  const baseline = nonStaging.filter((deal) => dealPassesFilters(deal, filters));
  const subject = subjectDealId ? nonStaging.find((deal) => deal.id === subjectDealId) || null : null;
  const byId = new Map(baseline.map((deal) => [deal.id, deal]));
  if (subject) byId.set(subject.id, subject);
  return [...byId.values()].filter((deal) => !allowedDealIds || allowedDealIds.has(deal.id));
}

function buildMetricEntries(spec, datasetIndex, options = {}) {
  const deals = metricDeals(datasetIndex, options.filters || {}, options.subjectDealId, options.allowedDealIds);
  return deals.map((deal) => {
    const allCards = datasetIndex.cardsByDeal.get(deal.id) || [];
    const scopedCards = allCards.filter((card) => cardMatchesScope(card, spec.cohort));
    if (!isApplicable(spec, scopedCards, allCards)) {
      return { deal, dealId: deal.id, status: 'not_applicable', values: [] };
    }
    const scopedClaims = (datasetIndex.claimsByDeal.get(deal.id) || [])
      .filter((claim) => claimMatchesScope(claim, spec, datasetIndex));
    const present = presenceForDeal(spec, scopedCards, scopedClaims, allCards);
    if (!present) {
      return {
        deal,
        dealId: deal.id,
        status: spec.observation.presence.missingState,
        values: [],
      };
    }
    return {
      deal,
      dealId: deal.id,
      status: 'present',
      values: valuesForDeal(spec, scopedClaims, datasetIndex),
    };
  });
}

module.exports = {
  buildMetricEntries,
  cardMatchesScope,
  claimMatchesItem,
  claimMatchesScope,
  dealPassesFilters,
  deepGet,
  extractClaimValues,
  featurePayload,
  finiteNumber,
  indexDataset,
  normaliseUnit,
  readClaimPath,
  durationUnitFromEvidence,
};
