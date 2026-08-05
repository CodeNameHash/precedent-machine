const { parseNumeric } = require('../normalize-numeric');
const { normalizeDurationClaim } = require('../queries/corpus-duration');
const { parseMonthsDuration, toRelativeMonthsForField } = require('../query/relative-periods');
const { affirmativeObligationIdentity, parseNestedObject } = require('../market-metrics/ioc-obligation-identity');
const { cardMatchesFamily } = require('./families');
const { normaliseLegalMarketValue } = require('./legal-normalizers');
const { bringDownTreatmentCodes, recoverBringDownFromCard } = require('../bring-down-tiers');

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
    unwrapped.standard,
    unwrapped.standard_code,
    unwrapped.benefit_types,
    unwrapped.benefitTypes,
    ...bringDownTreatmentCodes(unwrapped),
  ].filter(isNonEmpty).flatMap(candidateItemCodes);
}

function materialContractItemCadence(item, claim = null) {
  const itemText = textForSemanticValue(item);
  const text = itemText || [claim?.verbatim, claim?.evidence_quote].filter(Boolean).join(' ');
  if (/\b(?:per\s+annum|per\s+year|annual(?:ly)?)\b/i.test(text)) return 'annual';
  if (/\bin\s+(?:19|20)\d{2}\b/i.test(text)) return 'specified_year';
  if (/\b(?:per\s+month|monthly)\b/i.test(text)) return 'per_month';
  if (/\b(?:per\s+day|daily)\b/i.test(text)) return 'per_day';
  if (/\b(?:per|each)\s+(?:event|occurrence)\b/i.test(text)) return 'per_event';
  return 'aggregate';
}

function identityForItem(item, identityKind) {
  if (identityKind === 'affirmative_ioc_obligation') return affirmativeObligationIdentity(item);
  if (identityKind === 'adjournment_party') {
    const value = unwrapValue(item);
    const structuredParty = value && typeof value === 'object' && !Array.isArray(value)
      ? value.party
      : null;
    const prose = typeof value === 'string' ? value : textForSemanticValue(value);
    const inferredParty = structuredParty
      || (/\bCompany\b[^.;]{0,160}\badjourn|\badjourn[^.;]{0,160}\bCompany\b/i.test(prose) ? 'COMPANY' : null)
      || (/\bParent\b[^.;]{0,160}\badjourn|\badjourn[^.;]{0,160}\bParent\b/i.test(prose) ? 'PARENT' : null)
      || (/\bmutual(?:ly)?\b[^.;]{0,160}\badjourn|\badjourn[^.;]{0,160}\bmutual(?:ly)?\b/i.test(prose) ? 'MUTUAL' : null)
      || 'UNSPECIFIED';
    const party = String(inferredParty).trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_');
    return `ADJOURNMENT_PARTY:${party || 'UNSPECIFIED'}`;
  }
  return null;
}

function itemMatchesSpec(item, spec, claim = null) {
  const expectedCodes = new Set([spec?.itemCode, ...(spec?.itemCodes || [])].map(token).filter(Boolean));
  const expectedIdentity = String(spec?.itemIdentity || '').trim();
  if (!expectedCodes.size && !expectedIdentity) return false;
  const codeMatches = !expectedCodes.size || [claim?.canonical, ...candidateItemCodes(item)]
    .some((value) => expectedCodes.has(token(value)));
  const identityMatches = !expectedIdentity
    || identityForItem(item, spec.identityKind) === expectedIdentity;
  const cadenceMatches = !spec?.itemCadence
    || token(materialContractItemCadence(item, claim)) === token(spec.itemCadence);
  return codeMatches && identityMatches && cadenceMatches;
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
        const parsedItem = valueSpec.identityKind === 'affirmative_ioc_obligation' ? parseNestedObject(item) : item;
        if (valueSpec.normalizer === 'adjournment_duration') return [parsedItem];
        const paths = [...new Set([valueSpec.path, ...(valueSpec.paths || [])].filter(Boolean))];
        const value = paths.map((path) => deepGet(parsedItem, path)).find((candidate) => candidate !== undefined);
        if (value === undefined && valueSpec.normalizer === 'material_contract_threshold_type') return [item];
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
  if (valueSpec.normalizer) return [value];
  return Array.isArray(value) ? value : [value];
}

function normaliseIdentity(value) {
  return String(value || '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/\b(?:company|parent|target|buyer|seller)\b/g, '')
    .replace(/\b(?:representations?|warranties|representation|warranty)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const EQUITY_INSTRUMENT_ALIASES = Object.freeze({
  STOCK_OPTIONS: ['stock options', 'stock option', 'options', 'option'],
  RSU: ['restricted stock units', 'restricted stock unit', 'rsus', 'rsu'],
  RESTRICTED_STOCK_UNITS: ['restricted stock units', 'restricted stock unit', 'rsus', 'rsu'],
  RESTRICTED_STOCK: ['restricted stock awards', 'restricted stock award', 'restricted stock', 'rsas', 'rsa'],
  PSU: ['performance stock units', 'performance stock unit', 'performance stock awards', 'performance stock award', 'psus', 'psu', 'psas', 'psa'],
  PERFORMANCE_STOCK_UNITS: ['performance stock units', 'performance stock unit', 'psus', 'psu'],
  PERFORMANCE_STOCK_AWARDS: ['performance stock awards', 'performance stock award', 'psas', 'psa'],
  ESPP: ['employee stock purchase plan', 'espp'],
  SAR: ['stock appreciation rights', 'stock appreciation right', 'sars', 'sar'],
  PHANTOM_STOCK: ['phantom stock'],
  DSU: ['deferred stock units', 'deferred stock unit', 'dsus', 'dsu'],
  DIRECTOR_EQUITY: ['director equity awards', 'director equity award', 'director equity'],
  OTHER_EQUITY: ['other equity awards', 'other equity award', 'other equity'],
});

function instrumentAliases(instrumentCode) {
  const code = String(instrumentCode || '').trim().toUpperCase();
  return [normaliseIdentity(code), ...(EQUITY_INSTRUMENT_ALIASES[code] || []).map(normaliseIdentity)].filter(Boolean);
}

function textForSemanticValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'object') return String(value);
  if (Array.isArray(value)) return value.map(textForSemanticValue).join(' ');
  return [value.code, value.label, value.text, value.value, value.instrument, value.instrumentCode, value.instrument_code]
    .filter(isNonEmpty)
    .map(String)
    .join(' ');
}

function instrumentMatch(value, aliases) {
  const normalized = normaliseIdentity(textForSemanticValue(value));
  return aliases.some((alias) => alias && (normalized === alias || normalized.includes(alias)));
}

function equityEntriesForInstrument(raw, instrumentCode) {
  const value = unwrapValue(raw);
  const aliases = instrumentAliases(instrumentCode);
  if (Array.isArray(value)) return value.filter((item) => instrumentMatch(item, aliases));
  if (!value || typeof value !== 'object') return instrumentMatch(value, aliases) ? [value] : [];
  const tagged = ['code', 'label', 'text', 'value'].some((key) => isNonEmpty(value[key]));
  if (tagged) return instrumentMatch(value, aliases) ? [value] : [];
  const matches = [];
  for (const [key, item] of Object.entries(value)) {
    if (instrumentMatch(key, aliases) || instrumentMatch(item?.instrumentCode || item?.instrument_code || item?.instrument, aliases)) {
      matches.push(item);
    }
  }
  return matches;
}

function claimCarriesInstrument(claim, claims, instrumentCode) {
  if (equityEntriesForInstrument(featurePayload(claim), instrumentCode).length > 0) return true;
  const siblings = (claims || []).filter((candidate) => candidate.excerpt_id === claim.excerpt_id);
  return siblings.some((candidate) => {
    if (candidate.attribute === 'instrumentType') {
      return equityEntriesForInstrument(featurePayload(candidate), instrumentCode).length > 0;
    }
    if (candidate.attribute !== 'outstandingInstruments') return false;
    const raw = unwrapValue(featurePayload(candidate));
    const instruments = Array.isArray(raw) ? raw : [raw];
    return instruments.length === 1 && equityEntriesForInstrument(raw, instrumentCode).length > 0;
  });
}

function equityConsiderationCode(value) {
  const text = textForSemanticValue(value).toUpperCase();
  if (!text) return null;
  if (/CANCEL(?:LED)?[^.]{0,50}(?:NO|WITHOUT)\s+CONSIDERATION/.test(text)) return 'NO_CONSIDERATION';
  if (/ASSUM|ROLLOVER|PARENT\s+(?:STOCK|SHARE)|CONTINU(?:E|ING)/.test(text)) return 'ASSUMED_OR_ROLLED_OVER';
  if (/CASH|SPREAD|CANCEL(?:LED)?\s+FOR\s+CONSIDERATION|MERGER\s+CONSIDERATION/.test(text)) return 'CASHED_OUT';
  const scalar = scalarValue(value);
  const structuredCode = value && typeof value === 'object'
    ? (value.code || value.itemCode || value.item_code || value.category || value.bucket)
    : null;
  const fallback = structuredCode || (/^[A-Z0-9]+(?:[_-][A-Z0-9]+)+$/.test(String(scalar || '')) ? scalar : null);
  return /CASH|SPREAD|CONSIDERATION|CANCEL|ASSUM|ROLLOVER|PARENT_(?:STOCK|SHARE)|REPLACEMENT_AWARD/.test(String(fallback || '').toUpperCase())
    ? fallback
    : null;
}

function equityVestingCode(value) {
  const text = textForSemanticValue(value).toUpperCase();
  if (!text) return null;
  if (/NO[_\s-]*ACCELERATION|CONTINU(?:ED|ES|ING)[^.]*(?:VEST|SCHEDULE)|DOUBLE[_\s-]*TRIGGER/.test(text)) return 'CONTINUES_VESTING';
  if (/PRO[_\s-]*RATA/.test(text)) return 'PRO_RATA_ACCELERATION';
  if (/FULL(?:Y)?[_\s-]*(?:VEST|ACCEL)|ACCELERAT(?:ED|ION)/.test(text)) return 'FULL_ACCELERATION';
  if (/ASSUM|ROLLOVER/.test(text)) return 'ASSUMED_OR_ROLLED_OVER';
  if (/CANCEL(?:LED)?[^.]{0,50}(?:NO|WITHOUT)\s+CONSIDERATION/.test(text)) return 'NO_VESTING_VALUE';
  const scalar = scalarValue(value);
  const structuredCode = value && typeof value === 'object'
    ? (value.code || value.itemCode || value.item_code || value.category || value.bucket)
    : null;
  const fallback = structuredCode || (/^[A-Z0-9]+(?:[_-][A-Z0-9]+)+$/.test(String(scalar || '')) ? scalar : null);
  return /VEST|ACCEL|ROLLOVER|ASSUM|TIME_BASED|PERFORMANCE|DOUBLE_TRIGGER/.test(String(fallback || '').toUpperCase())
    ? fallback
    : null;
}

function bringDownCoverageText(value) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map(bringDownCoverageText).join(' ');
  if (typeof value !== 'object') return String(value);
  return Object.values(value).map(bringDownCoverageText).join(' ');
}

function bringDownStandardsForRep(raw, valueSpec) {
  const value = unwrapValue(raw);
  const tiers = Array.isArray(value) ? value : (value && typeof value === 'object' ? [value] : []);
  if (!tiers.length) return [];
  const identities = [valueSpec.repLabel, valueSpec.repCode, valueSpec.repSection]
    .map(normaliseIdentity)
    .filter(Boolean);
  const coverageFor = (tier) => bringDownCoverageText(tier?.reps_covered ?? tier?.repsCovered);
  const isGeneral = (covered) => !covered.trim()
    || /\ball\s+(?:company\s+|parent\s+|buyer\s+|seller\s+)?representations\b|\ball\s+other\b|\bremaining\s+representations\b/i.test(covered);
  const identityMatches = (covered) => {
    const normalized = normaliseIdentity(covered);
    return Boolean(normalized) && identities.some((identity) => normalized.includes(identity) || identity.includes(normalized));
  };
  const excludedByGeneral = (covered) => {
    const exclusion = covered.match(/\b(?:other\s+than|except(?:ing)?(?:\s+for)?)\b([\s\S]*)/i)?.[1] || '';
    return Boolean(exclusion) && identityMatches(exclusion);
  };
  const explicit = tiers.filter((tier) => {
    const covered = coverageFor(tier);
    return !isGeneral(covered) && identityMatches(covered);
  });
  const applicable = explicit.length ? explicit : tiers.filter((tier) => {
    const covered = coverageFor(tier);
    return isGeneral(covered) && !excludedByGeneral(covered);
  });
  const standards = applicable
    .flatMap((tier) => {
      const treatments = bringDownTreatmentCodes(tier);
      return treatments.length
        ? treatments
        : [tier.standard || tier.standard_code || tier.code || tier.standard_label || tier.label || null];
    })
    .map(scalarValue)
    .filter(isNonEmpty);
  return [...new Map(standards.map((standard) => [token(standard), standard])).values()];
}

const DEADLINE_TRIGGER_ALIASES = Object.freeze({
  AGREEMENT_DATE: 'AGREEMENT_DATE',
  DATE_OF_AGREEMENT: 'AGREEMENT_DATE',
  DATE_OF_THIS_AGREEMENT: 'AGREEMENT_DATE',
  DATE_HEREOF: 'AGREEMENT_DATE',
  SIGNING: 'SIGNING',
  EXECUTION: 'SIGNING',
  EXECUTION_AND_DELIVERY: 'SIGNING',
  SEC_CLEARANCE: 'SEC_CLEARANCE',
  CLEARANCE: 'CLEARANCE',
  NO_SEC_COMMENT_PERIOD_END: 'NO_SEC_COMMENT_PERIOD_END',
  NO_COMMENT_PERIOD_END: 'NO_SEC_COMMENT_PERIOD_END',
  END_OF_NO_COMMENT_PERIOD: 'NO_SEC_COMMENT_PERIOD_END',
  EFFECTIVENESS: 'EFFECTIVENESS',
  FORM_S_4_EFFECTIVENESS: 'EFFECTIVENESS',
  S_4_EFFECTIVENESS: 'EFFECTIVENESS',
  FILING: 'FILING',
  INITIAL_FILING: 'FILING',
  MAILING: 'MAILING',
  INITIAL_MAILING: 'MAILING',
});

function canonicalDeadlineTrigger(raw) {
  if (!isNonEmpty(raw)) return null;
  const text = String(raw).trim();
  const code = text.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (DEADLINE_TRIGGER_ALIASES[code]) return DEADLINE_TRIGGER_ALIASES[code];
  const patterns = [
    [/no\s+(?:further\s+)?comments?|sec\s+clearance|cleared\s+by\s+the\s+sec/i, 'SEC_CLEARANCE'],
    [/(?:end|expir(?:y|ation))[^.]{0,80}no.?comment\s+period|no.?comment\s+period/i, 'NO_SEC_COMMENT_PERIOD_END'],
    [/initial\s+mailing|following\s+(?:the\s+)?mailing|after\s+(?:the\s+)?mailing|date\s+(?:of|on\s+which)\s+(?:the\s+)?mailing/i, 'MAILING'],
    [/date\s+of\s+this\s+agreement|date\s+hereof/i, 'AGREEMENT_DATE'],
    [/\bsigning\b|execution\s+and\s+delivery/i, 'SIGNING'],
    [/(?:declared|becomes?)\s+effective|effective(?:ness)?\b/i, 'EFFECTIVENESS'],
    [/after\s+(?:the\s+)?filing|following\s+(?:the\s+)?filing|filing\s+(?:of|the)\b/i, 'FILING'],
  ];
  return patterns.find(([pattern]) => pattern.test(text))?.[1] || (code || null);
}

function deadlineTrigger(raw, claim) {
  const value = unwrapValue(raw);
  const explicit = value && typeof value === 'object' && !Array.isArray(value)
    ? canonicalDeadlineTrigger(value.trigger)
    : null;
  if (explicit) return explicit;
  const text = [textForSemanticValue(value), claim?.verbatim, claim?.evidence_quote].filter(Boolean).join(' ');
  const patterns = [
    [/no\s+(?:further\s+)?comments?|sec\s+clearance|cleared\s+by\s+the\s+sec/i, 'SEC_CLEARANCE'],
    [/(?:end|expir(?:y|ation))[^.]{0,80}no.?comment\s+period|no.?comment\s+period/i, 'NO_SEC_COMMENT_PERIOD_END'],
    [/initial\s+mailing|following\s+(?:the\s+)?mailing|after\s+(?:the\s+)?mailing|date\s+(?:of|on\s+which)\s+(?:the\s+)?mailing/i, 'MAILING'],
    [/date\s+of\s+this\s+agreement|date\s+hereof/i, 'AGREEMENT_DATE'],
    [/\bsigning\b|execution\s+and\s+delivery/i, 'SIGNING'],
    [/(?:declared|becomes?)\s+effective|effective(?:ness)?\b/i, 'EFFECTIVENESS'],
    [/after\s+(?:the\s+)?filing|following\s+(?:the\s+)?filing|filing\s+(?:of|the)\b/i, 'FILING'],
  ];
  return patterns.find(([pattern]) => pattern.test(text))?.[1] || null;
}

const MONTH_INDEX = Object.freeze({
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
});

function utcDate(year, monthIndex, day) {
  const date = new Date(Date.UTC(Number(year), Number(monthIndex), Number(day)));
  if (Number.isNaN(date.getTime())) return null;
  if (date.getUTCFullYear() !== Number(year)
    || date.getUTCMonth() !== Number(monthIndex)
    || date.getUTCDate() !== Number(day)) return null;
  return date;
}

function parseForwardDate(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const isoMatches = [...text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)];
  const longMatches = [...text.matchAll(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s*(\d{4})\b/gi)];
  if (isoMatches.length + longMatches.length !== 1) return null;
  if (isoMatches.length) {
    const match = isoMatches[0];
    return utcDate(match[1], Number(match[2]) - 1, match[3]);
  }
  const match = longMatches[0];
  return utcDate(match[3], MONTH_INDEX[match[1].toLowerCase()], match[2]);
}

function employeeBenefitPeriod(raw, claim) {
  const value = unwrapValue(raw);
  const direct = finiteNumber(value && typeof value === 'object' ? value.value : value);
  if (direct !== null && direct >= 0) {
    return { value: direct, unit: 'months', calendarBasis: 'elapsed', trigger: 'closing' };
  }
  const text = [textForSemanticValue(value), claim?.verbatim, claim?.evidence_quote].filter(Boolean).join(' ');
  const duration = text.match(/\b(\d+(?:\.\d+)?)\s*\)?\s*[- ]?\s*(years?|months?)\b/i);
  if (!duration) return null;
  const months = Number(duration[1]) * (/^year/i.test(duration[2]) ? 12 : 1);
  return Number.isFinite(months)
    ? { value: months, unit: 'months', calendarBasis: 'elapsed', trigger: 'closing' }
    : null;
}

function classifiedValues(text, rules, fallback = null) {
  const source = String(text || '');
  if (!source.trim()) return [];
  const values = rules.filter(([pattern]) => pattern.test(source)).map(([, value]) => value);
  return [...new Set(values.length ? values : (fallback ? [fallback] : []))];
}

function classificationText(raw, claim = null, linkedEvidence = null) {
  return [
    textForSemanticValue(unwrapValue(raw)),
    claim?.verbatim,
    claim?.evidence_quote,
    linkedEvidence,
  ]
    .filter(isNonEmpty)
    .map(String)
    .join(' ')
    .replace(/[_-]+/g, ' ');
}

function rawClassificationText(raw, claim = null) {
  return [textForSemanticValue(unwrapValue(raw)), claim?.verbatim]
    .filter(isNonEmpty)
    .map(String)
    .join(' ')
    .replace(/[_-]+/g, ' ');
}

function thirdPartyBeneficiaryTypes(raw, claim, linkedEvidence) {
  return classifiedValues(classificationText(raw, claim, linkedEvidence), [
    [/\b(?:company|target)?\s*(?:stock|share|security)holders?\b|\bholders?\s+of\s+(?:company\s+)?(?:common\s+stock|shares?|ordinary\s+shares?|opco\s+(?:units?|interests?))\b/i, 'TARGET_SECURITYHOLDERS'],
    [/\b(?:equity(?:\s+based)?|stock)[ -]?(?:award|option)s?\b|\bcompany\s+(?:options?|RSUs?|PSUs?|RSAs?|SARs?)\b|\b(?:rsu|psu|rsa|sar)s?\b|\brestricted\s+stock\b|\bperformance\s+(?:stock\s+)?units?\b/i, 'EQUITY_AWARD_HOLDERS'],
    [/\bindemnif(?:ied|ication|y)\b|\bindemnitees?\b|\bdirectors?\s*(?:&|and)\s*officers?\b|\bD\s*(?:&|and)\s*O\b/i, 'INDEMNIFIED_PERSONS'],
    [/\b(?:debt\s+)?financing\s+sources?\b|\blenders?\b|\bfinancing\s+parties\b/i, 'FINANCING_SOURCES'],
    [/\b(?:parent|company|buyer|target)\s+related\s+part(?:y|ies)\b/i, 'DEAL_RELATED_PARTIES'],
    [/\bnon\s+party\s+affiliates?\b|\bnon\s+recourse\s+part(?:y|ies)\b/i, 'NON_PARTY_AFFILIATES'],
    [/\bguarantors?\b|\bguarantor\s+part(?:y|ies)\b/i, 'GUARANTORS'],
    [/\b(?:continuing\s+)?employees?\b|\bservice\s+providers?\b|\bplan\s+participants?\b/i, 'EMPLOYEES_OR_SERVICE_PROVIDERS'],
    [/\bspecial\s+committee\b/i, 'SPECIAL_COMMITTEE'],
    [/\bCVR\b|\bcontingent\s+value\s+rights?\b|\brights?\s+agent\b|\blicen[cs]e\s+representative\b/i, 'CVR_RIGHTS_PARTIES'],
    [/\b(?:stockholder|shareholder|seller|holders?)\s+representative\b/i, 'HOLDER_REPRESENTATIVE'],
  ], 'OTHER_NAMED_BENEFICIARY');
}

function thirdPartyEnforceableRights(raw, claim, linkedEvidence) {
  return classifiedValues(classificationText(raw, claim, linkedEvidence), [
    [/\breceive\b[^.]{0,180}\b(?:merger|per\s+share|transaction|offer)\s+consideration\b|\bright\b[^.]{0,160}\bmerger\s+consideration\b|\bholders?\s+of\s+(?:company\s+)?(?:common\s+stock|shares?|ordinary\s+shares?)\b|\bcompany\s+(?:stock|share|security)holders?\b|\bper\s+share\s+(?:amount|price)\b/i, 'MERGER_CONSIDERATION_RIGHTS'],
    [/\b(?:equity(?:\s+based)?|stock)[ -]?(?:awards?|options?)\b|\bcompany\s+(?:options?|RSUs?|PSUs?|RSAs?|SARs?)\b|\b(?:RSU|PSU|RSA|SAR)s?\b[^.]{0,180}\b(?:receive|payment|amount|consideration)\b/i, 'EQUITY_AWARD_PAYMENT_RIGHTS'],
    [/\bCVR\b|\bcontingent\s+value\s+rights?\b|\brights?\s+agent\b|\blicen[cs]e\s+representative\b/i, 'CVR_PAYMENT_OR_AGREEMENT_RIGHTS'],
    [/\bindemnif(?:ied|ication|y)\b|\bindemnitees?\b|\bdirectors?\s*(?:&|and)\s*officers?\s+insurance\b|\bD\s*(?:&|and)\s*O\b/i, 'INDEMNIFICATION_AND_INSURANCE_RIGHTS'],
    [/\b(?:debt\s+)?financing\s+sources?\b|\bfinancing\s+parties\b|\blenders?\b/i, 'FINANCING_SOURCE_PROTECTIONS'],
    [/\bnon\s+recourse\b|\bnon\s+party\s+affiliates?\b|\bno\s+recourse\b|\brelease\b/i, 'LIMITED_RECOURSE_OR_RELEASE_PROTECTIONS'],
    [/\btermination\s+fee\b|\bdamages\b|\bloss\s+of\s+(?:the\s+)?economic\s+benefit\b|\blost\s+premium\b/i, 'DAMAGES_OR_TERMINATION_PAYMENT_RIGHTS'],
    [/\bguarantors?\b|\bguarantees?\b/i, 'GUARANTEE_PROTECTIONS'],
    [/\b(?:parent|company|buyer|target)\s+(?:related\s+part(?:y|ies)|protected\s+persons?)\b/i, 'DEAL_RELATED_PARTY_PROTECTIONS'],
    [/\b(?:continuing\s+)?employees?\b|\bservice\s+providers?\b|\bemployee\s+benefits?\b/i, 'EMPLOYEE_OR_SERVICE_PROVIDER_RIGHTS'],
    [/\bspecial\s+committee\b/i, 'SPECIAL_COMMITTEE_RIGHTS'],
  ], 'OTHER_EXPRESS_ENFORCEABLE_RIGHT');
}

function expenseSubjectContext(text, pattern) {
  const source = String(text || '');
  const matcher = new RegExp(pattern.source, pattern.flags.includes('i') ? 'ig' : 'g');
  const contexts = [];
  for (const match of source.matchAll(matcher)) {
    contexts.push(source.slice(Math.max(0, match.index - 450), Math.min(source.length, match.index + match[0].length + 450)));
  }
  return contexts.join(' ');
}

function expensePayer(context) {
  if (!context) return 'specific';
  if (/\bone[ -]half\b|\bshare(?:d)?\s+equally\b|\bequally\s+(?:share|bear|borne|paid)\b|\b(?:parent|buyer)[^.]{0,80}(?:company|target)[^.]{0,80}\beach\s+(?:bear|pay)\b/i.test(context)) return 'shared';
  const buyer = /\b(?:parent|buyer|purchaser|merger\s+sub(?:sidiar(?:y|ies))?|surviving\s+corporation)\b\s+(?:shall|will|must|is|are)\s+(?:solely\s+)?(?:bear|pay|be\s+responsible)|\b(?:borne|paid)\s+by\s+(?:parent|buyer|purchaser|merger\s+sub(?:sidiar(?:y|ies))?|surviving\s+corporation)\b/i.test(context);
  const target = /\b(?:company|target)\b\s+(?:shall|will|must|is|are)\s+(?:solely\s+)?(?:bear|pay|be\s+responsible)|\b(?:borne|paid)\s+by\s+(?:the\s+)?(?:company|target)\b/i.test(context);
  if (buyer && target) return 'shared';
  if (buyer) return 'buyer';
  if (target) return 'target';
  if (/\bparty\s+(?:responsible|upon\s+which|on\s+whom)\b|\bimposed\s+by\s+(?:applicable\s+)?law\b/i.test(context)) return 'by_law';
  return 'specific';
}

function feeExpenseAllocation(raw, claim, linkedEvidence) {
  const text = classificationText(raw, claim, linkedEvidence);
  if (!text.trim()) return [];
  const values = [];
  const add = (value) => { if (!values.includes(value)) values.push(value); };
  if (/\b(?:each|the)\s+part(?:y|ies)\b[^.]{0,180}\b(?:bear|pay)\b[^.]{0,80}\b(?:its|their)\s+own\b|\b(?:paid|borne)\s+by\s+the\s+party\s+(?:incurring|required\s+to\s+incur)\b|\bexpenses?\b[^.]{0,100}\bborne\b[^.]{0,60}\bparty\b[^.]{0,60}\bincurred\b/i.test(text)) {
    add('EACH_PARTY_BEARS_OWN_EXPENSES');
  }
  const subjects = [
    [/\b(?:transfer|stamp|documentary|sales|use|registration|recordation|value\s+added)\b[^.]{0,120}\b(?:taxes?|fees?)\b/i, 'TRANSFER_TAXES'],
    [/\b(?:HSR|antitrust|competition|foreign\s+investment|FDI)\b[^.]{0,100}\b(?:filing\s+)?fees?\b|\bfiling\s+fees?\b[^.]{0,100}\b(?:HSR|antitrust|competition|foreign\s+investment|FDI)\b/i, 'REGULATORY_FILING_FEES'],
    [/\b(?:proxy\s+statement|form\s+S\s*4|registration\s+statement)\b|\bprinting\s*,?\s+mailing\s+and\s+filing\b/i, 'PROXY_AND_REGISTRATION_COSTS'],
    [/\bfinancing\b[^.]{0,100}\b(?:fees?|costs?|expenses?)\b|\b(?:fees?|costs?|expenses?)\b[^.]{0,100}\bfinancing\b/i, 'FINANCING_EXPENSES'],
    [/\bpaying\s+agent\b[^.]{0,100}\b(?:fees?|charges?|costs?|expenses?)\b|\b(?:fees?|charges?|costs?|expenses?)\b[^.]{0,100}\bpaying\s+agent\b/i, 'PAYING_AGENT_FEES'],
  ];
  for (const [pattern, subject] of subjects) {
    const context = expenseSubjectContext(text, pattern);
    if (!context) continue;
    const payer = expensePayer(context);
    if (payer === 'buyer') add(`BUYER_BEARS_${subject}`);
    else if (payer === 'target') add(`TARGET_BEARS_${subject}`);
    else if (payer === 'shared') add(`SHARED_${subject}`);
    else if (payer === 'by_law') add(`${subject}_ALLOCATED_BY_LAW`);
    else add(`${subject}_SEPARATELY_ALLOCATED`);
  }
  if (/\bexpense\s+reimbursement\b|\breimburse\b[^.]{0,100}\bexpenses?\b|\bindemnif(?:y|ication)\b[^.]{0,100}\bexpenses?\b/i.test(text)) {
    add('EXPENSE_REIMBURSEMENT_OR_INDEMNITY_EXCEPTION');
  }
  return values.length ? values : ['OTHER_SPECIFIC_EXPENSE_ALLOCATION'];
}

function assignmentRestrictions(raw, claim) {
  const text = rawClassificationText(raw, claim);
  return classifiedValues(text, [
    [/\bno\s+party\b|\bneither\s+(?:party|this\s+agreement)\b|\bnone\s+of\s+the\s+parties\b|\bconsent\s+of\s+the\s+other\s+part(?:y|ies)\b/i, 'MUTUAL_ASSIGNMENT_RESTRICTION'],
    [/\b(?:company|target)\b[^.]{0,100}\b(?:may\s+not|shall\s+not|cannot)\b[^.]{0,80}\bassign\b/i, 'TARGET_ASSIGNMENT_RESTRICTION'],
    [/\b(?:parent|buyer|purchaser|merger\s+sub)\b[^.]{0,100}\b(?:may\s+not|shall\s+not|cannot)\b[^.]{0,80}\bassign\b/i, 'BUYER_ASSIGNMENT_RESTRICTION'],
    [/\bprior\s+written\s+consent\b/i, 'PRIOR_WRITTEN_CONSENT_REQUIRED'],
    [/\bright(?:s)?\b[^.]{0,80}\b(?:interest(?:s)?\b[^.]{0,40})?\bobligations?\b|\bobligations?\b[^.]{0,80}\brights?\b/i, 'RIGHTS_AND_OBLIGATIONS_RESTRICTED'],
    [/\bdelegat(?:e|ion|ed)\b|\botherwise\s+transfer\b/i, 'DELEGATION_OR_TRANSFER_RESTRICTED'],
    [/\boperation\s+of\s+law\b/i, 'OPERATION_OF_LAW_ASSIGNMENT_RESTRICTED'],
    [/\b(?:void|invalid|of\s+no\s+effect)\b[^.]{0,100}\bassign|\bassign(?:ment|ed)\b[^.]{0,100}\b(?:void|invalid|of\s+no\s+effect)\b/i, 'NONCOMPLIANT_ASSIGNMENT_VOID'],
  ], 'GENERAL_ASSIGNMENT_RESTRICTION');
}

function assignmentExceptions(raw, claim) {
  const text = rawClassificationText(raw, claim);
  return classifiedValues(text, [
    [/\b(?:debt\s+)?financing\s+sources?\b|\blenders?\b|\bcollateral(?:ly)?\s+assign\b|\bpledge\b[^.]{0,120}\b(?:financing|security|lender)\b/i, 'FINANCING_SOURCE_OR_COLLATERAL_ASSIGNMENT'],
    [/\b(?:parent|buyer|purchaser|merger\s+sub(?:sidiar(?:y|ies))?)\b[^.]{0,180}\b(?:affiliate|subsidiar(?:y|ies))\b|\b(?:affiliate|subsidiar(?:y|ies))\b[^.]{0,180}\b(?:parent|buyer|purchaser|merger\s+sub)\b/i, 'BUYER_AFFILIATE_OR_SUBSIDIARY_ASSIGNMENT'],
    [/\b(?:company|target)\b[^.]{0,180}\b(?:affiliate|subsidiar(?:y|ies))\b|\b(?:affiliate|subsidiar(?:y|ies))\b[^.]{0,180}\b(?:company|target)\b/i, 'TARGET_AFFILIATE_OR_SUBSIDIARY_ASSIGNMENT'],
    [/\b(?:designat|substitut|in\s+lieu\s+of)\w*\b[^.]{0,180}\bmerger\s+sub\b|\bmerger\s+sub\b[^.]{0,180}\b(?:designat|substitut|in\s+lieu\s+of)\w*\b/i, 'MERGER_SUB_REPLACEMENT'],
    [/\bmerger\s+or\s+consolidation\b|\bdisposition\s+of\s+all\s+or\s+substantially\s+all\b|\bpost\s+closing\s+successor\b/i, 'POST_CLOSING_SUCCESSOR_TRANSACTION'],
    [/\brights?\b[^.]{0,100}\b(?:but\s+not|not\s+delegate)\b[^.]{0,60}\bobligations?\b/i, 'RIGHTS_ONLY_ASSIGNMENT'],
    [/\bpursuant\s+to\s+the\s+mergers?\b|\bby\s+operation\s+of\s+(?:the\s+)?merger\b/i, 'MERGER_OPERATION_ASSIGNMENT'],
  ], 'OTHER_EXPRESS_ASSIGNMENT_EXCEPTION');
}

function materialContractThresholdType(raw, claim) {
  const value = unwrapValue(raw);
  const text = [textForSemanticValue(value), claim?.verbatim, claim?.evidence_quote]
    .filter(Boolean)
    .join(' ');
  if (/\btop\s+\d+\b/i.test(text)) return 'TOP_N_THRESHOLD';
  if (/\b\d{1,3}(?:\.\d+)?\s*%/.test(text)) return 'PERCENTAGE_THRESHOLD';
  const hasDollar = /\$\s*[\d,.]+|\b(?:usd|dollars?)\b/i.test(text)
    || (finiteNumber(value) !== null && finiteNumber(value) > 0);
  if (!hasDollar) return 'NO_NUMERIC_THRESHOLD';
  if (/\b(?:per\s+annum|per\s+year|annual(?:ly)?)\b/i.test(text)) return 'DOLLAR_THRESHOLD_ANNUAL';
  if (/\bin\s+(?:19|20)\d{2}\b/i.test(text)) return 'DOLLAR_THRESHOLD_SPECIFIED_YEAR';
  if (/\b(?:per|each)\s+(?:event|occurrence)\b/i.test(text)) return 'DOLLAR_THRESHOLD_PER_EVENT';
  return 'DOLLAR_THRESHOLD_AGGREGATE';
}

function adjournmentDuration(raw, valueSpec, claim) {
  const item = unwrapValue(raw);
  if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
  const path = String(valueSpec.path || '');
  let amount = finiteNumber(deepGet(item, path));
  if (amount === null && path === 'maxDaysTotal') {
    const count = finiteNumber(item.maxAdjournments);
    const perAdjournment = finiteNumber(item.maxDaysPerAdjournment);
    if (count !== null && count > 0 && perAdjournment !== null && perAdjournment > 0) {
      amount = count * perAdjournment;
    }
  }
  if (amount === null) return [];
  const text = [textForSemanticValue(item), claim?.verbatim, claim?.evidence_quote].filter(Boolean).join(' ');
  const unit = normaliseUnit(
    item[`${path}Unit`]
      || item.unit
      || (/business\s+days?/i.test(text) ? 'business_days' : null)
      || (/calendar\s+days?/i.test(text) ? 'calendar_days' : null)
      || valueSpec.unit
      || 'calendar_days',
  );
  return [{
    value: amount,
    unit,
    calendarBasis: unit === 'business_days' ? 'business' : unit === 'calendar_days' ? 'calendar' : 'elapsed',
    trigger: valueSpec.trigger || 'meeting_adjournment',
    cadence: 'one_time',
  }];
}

function conditionTerm(raw, family) {
  const text = textForSemanticValue(unwrapValue(raw));
  if (!text.trim()) return null;
  const upperFamily = String(family || '').toUpperCase();
  if (upperFamily === 'COV') {
    if (/hybrid|different\s+standards?|as\s+applicable/i.test(text)) return 'HYBRID_STANDARD';
    if (/in\s+all\s+material\s+respects/i.test(text) || /ALL_IN_MATERIAL_RESPECTS|EACH_IN_MATERIAL_RESPECTS/i.test(text)) return 'IN_ALL_MATERIAL_RESPECTS';
    if (/in\s+all\s+respects/i.test(text)) return 'IN_ALL_RESPECTS';
    return String(text).trim();
  }
  if (upperFamily === 'STOCKHOLDER_STANDARD') {
    if (/majority[^.]{0,100}\boutstanding\b|affirmative\s+vote[^.]{0,120}\bmajority\b[^.]{0,80}\boutstanding\b/i.test(text)) return 'MAJORITY_OF_OUTSTANDING_SHARES';
    if (/majority[^.]{0,100}\bvotes?\s+cast\b/i.test(text)) return 'MAJORITY_OF_VOTES_CAST';
    if (/two[-\s]?thirds?|66\s*(?:2\/3)?\s*%/i.test(text)) return 'TWO_THIRDS_APPROVAL';
    if (/unanimous|all\s+(?:holders|shares)/i.test(text)) return 'UNANIMOUS_APPROVAL';
    return 'OTHER_APPROVAL_STANDARD';
  }
  if (upperFamily === 'STOCKHOLDER_SCOPE') {
    const company = /company\s+stockholder\s+approval/i.test(text);
    const parent = /parent\s+stockholder\s+approval/i.test(text);
    if (company && parent) return 'COMPANY_AND_PARENT_APPROVALS';
    if (company) return 'COMPANY_APPROVAL_ONLY';
    if (parent) return 'PARENT_APPROVAL_ONLY';
    return 'STOCKHOLDER_APPROVAL_REQUIRED';
  }
  if (upperFamily === 'LEGAL') {
    if (/temporary,?\s+preliminary\s+or\s+permanent/i.test(text)) return 'TEMPORARY_PRELIMINARY_OR_PERMANENT_RESTRAINT';
    if (/final\s+and\s+non[-\s]?appealable/i.test(text)) return 'FINAL_NONAPPEALABLE_RESTRAINT';
    if (/law[^.]{0,100}(?:order|injunction)|(?:order|injunction)[^.]{0,100}law/i.test(text)) return 'LAW_OR_ORDER_RESTRAINT';
    if (/restrain|enjoin|prohibit/i.test(text)) return 'ENJOINING_ORDER_RESTRAINT';
    return 'OTHER_LEGAL_RESTRAINT';
  }
  if (upperFamily === 'CERT') {
    const reps = /rep(?:resentation)?\s+bring[-\s]?down|representations?\s+(?:and\s+warranties\s+)?(?:are|were|shall)/i.test(text);
    const covenants = /covenant|obligations?[^.]{0,80}(?:performed|complied)/i.test(text);
    const mae = /\bMAE\b|material\s+adverse\s+effect/i.test(text);
    if (reps && covenants && mae) return 'REPS_COVENANTS_AND_MAE';
    if (reps && covenants) return 'REPS_AND_COVENANTS';
    if (reps && mae) return 'REPS_AND_MAE';
    if (covenants && mae) return 'COVENANTS_AND_MAE';
    if (reps) return 'REPS_ONLY';
    if (covenants) return 'COVENANTS_ONLY';
    if (mae) return 'MAE_ONLY';
    return 'CERTIFICATE_REQUIRED';
  }
  if (upperFamily === 'S4') {
    const effective = /(?:form\s+)?S-?4[^.]{0,100}(?:effective|declared\s+effective)|declared\s+effective[^.]{0,100}(?:form\s+)?S-?4/i.test(text);
    const stopOrder = /stop\s+order/i.test(text);
    if (effective && stopOrder) return 'EFFECTIVE_AND_NO_STOP_ORDER';
    if (effective) return 'S4_EFFECTIVE';
    if (stopOrder) return 'NO_STOP_ORDER';
    return 'OTHER_S4_CONDITION';
  }
  if (upperFamily === 'LISTING') {
    const listing = /approv(?:ed|al)[^.]{0,100}(?:listing|exchange)|(?:listing|exchange)[^.]{0,100}approv/i.test(text);
    const notice = /official\s+notice\s+of\s+issuance/i.test(text);
    if (listing && notice) return 'LISTING_APPROVAL_SUBJECT_TO_ISSUANCE_NOTICE';
    if (listing) return 'LISTING_APPROVAL';
    if (notice) return 'ISSUANCE_NOTICE_ACCEPTED';
    return 'OTHER_LISTING_CONDITION';
  }
  if (upperFamily === 'FUNDS') {
    if (/no\s+financing\s+condition/i.test(text)) return 'NO_FINANCING_CONDITION';
    if (/sufficient\s+funds|funds\s+available|cash\s+on\s+hand/i.test(text)) return 'SUFFICIENT_FUNDS_CONDITION';
    return 'OTHER_FUNDS_CONDITION';
  }
  return String(text).trim();
}

function abryScope(raw) {
  return classifiedValues(textForSemanticValue(raw), [
    [/data\s*rooms?/i, 'DATA_ROOM'],
    [/management\s+presentations?/i, 'MANAGEMENT_PRESENTATIONS'],
    [/projections?|forecasts?/i, 'PROJECTIONS_OR_FORECASTS'],
    [/disclosure\s+(?:letter|schedules?)/i, 'DISCLOSURE_MATERIALS'],
    [/\bcertificates?\b/i, 'CLOSING_CERTIFICATES'],
    [/ancillary\s+agreements?|confidentiality\s+agreement/i, 'ANCILLARY_AGREEMENTS'],
    [/oral|written|express|implied|extra[-\s]?contractual|outside\s+(?:this|the)\s+agreement/i, 'OTHER_EXTRA_CONTRACTUAL_STATEMENTS'],
  ], 'GENERAL_NON_RELIANCE');
}

function claimMatchesAbryParty(claim, peerClaims, partyValues) {
  if (!Array.isArray(partyValues) || !partyValues.length) return true;
  const expected = new Set(partyValues.map(token));
  const sameExcerpt = (peerClaims || []).filter((candidate) => candidate.excerpt_id === claim.excerpt_id);
  return sameExcerpt
    .filter((candidate) => candidate.attribute === 'noOtherRepsParty')
    .some((candidate) => expected.has(token(scalarValue(featurePayload(candidate)))));
}

function fraudCarveoutScope(raw) {
  return classifiedValues(textForSemanticValue(raw), [
    [/actual\s+fraud/i, 'ACTUAL_FRAUD'],
    [/common\s+law\s+fraud/i, 'COMMON_LAW_FRAUD'],
    [/intentional\s+fraud|knowing(?:ly)?\s+fraud/i, 'INTENTIONAL_OR_KNOWING_FRAUD'],
    [/fraud\s+(?:committed|made)\s+by|fraud\s+of\s+(?:a|the|such)\s+(?:person|party|officer|director)/i, 'SPECIFIED_PERSON_FRAUD'],
    [/exclusive\s+remed|sole\s+remed|nothing\s+(?:herein|in\s+this\s+agreement).*fraud/i, 'REMEDIES_CARVEOUT'],
  ], 'GENERAL_FRAUD_CARVEOUT');
}

function acquisitionTransactionTypes(raw) {
  return classifiedValues(textForSemanticValue(raw), [
    [/(?:acqui(?:re|sition)|purchase|sale|license|lease|disposition)[^.]{0,80}(?:assets?|business(?:es)?|properties)|(?:assets?|business(?:es)?|properties)[^.]{0,80}(?:acqui(?:re|sition)|purchase|sale|license|lease|disposition)/i, 'ASSET_OR_BUSINESS_TRANSACTION'],
    [/capital\s+stock|voting[-\s]+power|equity\s+securit/i, 'EQUITY_OR_VOTING_POWER_ACQUISITION'],
    [/merger|consolidation|business\s+combination/i, 'MERGER_OR_BUSINESS_COMBINATION'],
    [/tender\s+offer|exchange\s+offer/i, 'TENDER_OR_EXCHANGE_OFFER'],
    [/recapitalization|recapitalisation|liquidation|dissolution|share\s+exchange/i, 'RECAPITALISATION_OR_LIQUIDATION'],
  ]);
}

function transactionsExclusion(raw) {
  const text = textForSemanticValue(raw);
  if (!text.trim()) return [];
  return [/other\s+than[^.]{0,100}\btransactions\b/i, /does\s+not\s+include[^.]{0,100}\btransactions\b/i, /excluding[^.]{0,100}\btransactions\b/i]
    .some((pattern) => pattern.test(text))
    ? ['TRANSACTIONS_EXPRESSLY_EXCLUDED']
    : ['NO_EXPRESS_TRANSACTIONS_EXCLUSION'];
}

function financingScope(raw) {
  return classifiedValues(textForSemanticValue(raw), [
    [/debt\s+(?:and\/?or\s+)?(?:equity\s+)?financing|debt\s+financing/i, 'DEBT_FINANCING'],
    [/equity\s+financing/i, 'EQUITY_FINANCING'],
    [/payoff\s+letters?|lien\s+release/i, 'PAYOFFS_AND_LIEN_RELEASES'],
    [/debt\s+offers?|tender\s+offers?|exchange\s+offers?/i, 'DEBT_OFFERS'],
    [/consent\s+solicitation/i, 'CONSENT_SOLICITATIONS'],
    [/rating\s+agenc/i, 'RATING_AGENCY_COOPERATION'],
    [/marketing\s+materials?|road\s*show/i, 'MARKETING_ASSISTANCE'],
  ], 'CUSTOMARY_FINANCING_COOPERATION');
}

const COVENANT_TREATMENT_RULES = Object.freeze({
  takeover: [
    [/avoid|minimi[sz]e|inapplicable/i, 'AVOID_OR_MINIMISE_APPLICATION'],
    [/approve|board|governing\s+bod/i, 'BOARD_ACTION'],
  ],
  litigation: [
    [/notify|notice/i, 'NOTICE'],
    [/keep.*informed|inform.*parent/i, 'KEEP_INFORMED'],
    [/participat/i, 'PARTICIPATION_RIGHT'],
    [/consult/i, 'CONSULTATION_RIGHT'],
    [/consent.*settle|settle.*consent/i, 'SETTLEMENT_CONSENT'],
    [/not\s+unreasonably\s+(?:withheld|conditioned|delayed)/i, 'REASONABLENESS_QUALIFIER'],
  ],
  section16: [
    [/16b-?3/i, 'RULE_16B_3_EXEMPTION'],
    [/insider|officer|director/i, 'INSIDER_TRANSACTIONS'],
  ],
  further: [
    [/vest|perfect|confirm.*(?:asset|right)|asset.*(?:vest|perfect|confirm)/i, 'ASSET_VESTING_AND_PERFECTION'],
    [/regulatory|antitrust|governmental|clearance|consent|approval/i, 'REGULATORY_COOPERATION'],
    [/divest|dispose|hold\s+separate|terminate.*relationship|restructur/i, 'REMEDIES_LIMITATION'],
    [/acquir|acquisition/i, 'INTERIM_ACQUISITION_RESTRICTION'],
  ],
  notification: [
    [/third[-\s]?party|consent\s+claim/i, 'THIRD_PARTY_CLAIMS'],
    [/government|regulator/i, 'GOVERNMENT_COMMUNICATIONS'],
    [/proceeding|litigation|action/i, 'PROCEEDINGS'],
    [/condition|terminat/i, 'CONDITION_OR_TERMINATION_CARVEOUT'],
  ],
  tax: [
    [/intended\s+tax|tax\s+treatment|reorgani[sz]ation/i, 'INTENDED_TAX_TREATMENT'],
    [/tax\s+opinion/i, 'TAX_OPINION_COOPERATION'],
    [/file|filing|return/i, 'CONSISTENT_TAX_REPORTING'],
    [/avoid.*inconsistent|not.*inconsistent/i, 'NO_INCONSISTENT_ACTIONS'],
  ],
  delisting: [
    [/delist/i, 'EXCHANGE_DELISTING'],
    [/deregister|deregistration/i, 'SEC_DEREGISTRATION'],
  ],
  listing: [
    [/list|listing/i, 'EXCHANGE_LISTING'],
    [/parent.*share|share.*parent/i, 'PARENT_SHARE_LISTING'],
  ],
  controlOperations: [
    [/designat(?:e|ion)[^.]{0,120}lead\s+individual|regular\s+(?:operational\s+)?updates?|confer[^.]{0,120}(?:intervals?|matters?)/i, 'OPERATIONAL_UPDATES'],
    [/agreed\s+intervals?|intervals?[^.]{0,120}agree|matters?[^.]{0,120}agree/i, 'AGREED_CADENCE_AND_SCOPE'],
    [/subject\s+to\s+(?:compliance\s+with\s+)?applicable\s+law/i, 'SUBJECT_TO_APPLICABLE_LAW'],
    [/complete\s+control|control\s+or\s+direct[^.]{0,100}operations?|retains?[^.]{0,100}(?:operational\s+)?control/i, 'PARTY_RETAINS_PRE_CLOSING_CONTROL'],
    [/shall\s+not\s+affect[^.]{0,120}condition|not[^.]{0,120}give\s+rise[^.]{0,80}(?:right\s+to\s+)?terminate/i, 'NO_CLOSING_OR_TERMINATION_CONSEQUENCE'],
    [/willful\s+and\s+material\s+breach|wilful\s+and\s+material\s+breach/i, 'WILFUL_AND_MATERIAL_BREACH_EXCEPTION'],
  ],
  boardAppointment: [
    [/(?:one|1)\s*\(?1?\)?[^.]{0,120}(?:company\s+)?(?:director|board\s+member)|one\s+current\s+company\s+board\s+member/i, 'ONE_COMPANY_DIRECTOR'],
    [/mutually\s+agreed|mutual\s+agreement/i, 'MUTUAL_AGREEMENT'],
    [/effective\s+time|at\s+(?:the\s+)?closing/i, 'APPOINTMENT_AT_CLOSING'],
    [/reasonable\s+best\s+efforts?[^.]{0,160}elect|first\s+(?:eligible\s+)?annual\s+meeting/i, 'ELECTION_AT_FIRST_ANNUAL_MEETING'],
  ],
});

function covenantTreatments(raw, valueSpec, claim, linkedEvidence) {
  const rules = COVENANT_TREATMENT_RULES[valueSpec.profile] || [];
  const text = [textForSemanticValue(raw), claim?.verbatim, claim?.evidence_quote, linkedEvidence]
    .filter(Boolean)
    .join(' ');
  return classifiedValues(text, rules);
}

function insuranceCapMultiplier(raw) {
  const value = unwrapValue(raw);
  const direct = finiteNumber(value && typeof value === 'object' ? value.value : value);
  if (direct !== null && direct >= 0) {
    return { value: direct > 20 ? direct / 100 : direct, unit: 'multiplier' };
  }
  const text = textForSemanticValue(value);
  const percent = text.match(/\b(\d+(?:\.\d+)?)\s*%/);
  if (percent) return { value: Number(percent[1]) / 100, unit: 'multiplier' };
  const multiple = text.match(/\b(\d+(?:\.\d+)?)\s*(?:x|times?)\b/i);
  return multiple ? { value: Number(multiple[1]), unit: 'multiplier' } : null;
}

function dollarAmount(text) {
  const match = String(text || '').match(/\$\s*([\d,]+(?:\.\d+)?)\s*(million|billion|m|bn|b)?\b/i);
  if (!match) return null;
  const base = Number(match[1].replace(/,/g, ''));
  const suffix = String(match[2] || '').toLowerCase();
  const multiplier = suffix === 'million' || suffix === 'm' ? 1e6
    : suffix === 'billion' || suffix === 'bn' || suffix === 'b' ? 1e9 : 1;
  return Number.isFinite(base) ? base * multiplier : null;
}

function iocDollarThreshold(raw, claim) {
  const value = unwrapValue(raw);
  const structured = [];
  function visit(candidate) {
    if (!candidate || typeof candidate !== 'object') return;
    if (Array.isArray(candidate)) {
      candidate.forEach(visit);
      return;
    }
    for (const [key, item] of Object.entries(candidate)) {
      const amount = finiteNumber(item);
      if (amount !== null && amount > 0 && /^thresholdAggregate$/i.test(key)) {
        structured.push({ value: amount, unit: 'usd', cadence: 'aggregate' });
      } else if (amount !== null && amount > 0 && /^thresholdIndividual$/i.test(key)) {
        structured.push({ value: amount, unit: 'usd', cadence: 'per_event' });
      }
      visit(item);
    }
  }
  visit(value);
  if (structured.length) {
    const seen = new Set();
    const unique = structured.filter((entry) => {
      const key = `${entry.cadence}|${entry.value}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const aggregate = unique.filter((entry) => entry.cadence === 'aggregate');
    return aggregate.length ? aggregate : unique;
  }

  const direct = claim?.attribute === 'dollarThreshold' ? finiteNumber(value) : null;
  if (direct !== null && direct > 0) return [{ value: direct, unit: 'usd', cadence: 'aggregate' }];
  const text = [textForSemanticValue(value), claim?.canonical, claim?.verbatim, claim?.evidence_quote]
    .filter(Boolean)
    .join(' ');
  const amount = dollarAmount(text);
  if (amount === null) return [];
  const cadence = /\bindividu(?:al|ally)\b/i.test(text) && !/\baggregate\b/i.test(text) ? 'per_event'
    : /\b(?:per\s+annum|per\s+year|annual(?:ly)?)\b/i.test(text) ? 'annual'
    : 'aggregate';
  return [{ value: amount, unit: 'usd', cadence }];
}

function hasIocMoneySignal(claim) {
  if (iocDollarThreshold(featurePayload(claim), claim).length) return true;
  if (claim?.attribute === 'dollarThreshold' && claimHasValue(claim)) return true;
  const text = [claim?.canonical, claim?.verbatim, claim?.evidence_quote, JSON.stringify(featurePayload(claim) ?? '')]
    .filter(Boolean)
    .join(' ');
  return /MONETARY_THRESHOLD|threshold(?:Aggregate|Individual)|\$\s*[\d,.]+/i.test(text);
}

function periodMonths(raw, valueSpec, claim) {
  const value = unwrapValue(raw);
  const direct = finiteNumber(value);
  const months = direct !== null && /Months$/i.test(String(claim?.attribute || ''))
    ? direct
    : parseMonthsDuration([textForSemanticValue(value), claim?.verbatim, claim?.evidence_quote].filter(Boolean).join(' '));
  return Number.isFinite(months) && months > 0
    ? [{ value: months, unit: 'months', calendarBasis: 'elapsed', trigger: valueSpec.trigger || null }]
    : [];
}

function parentApprovalMechanism(raw, claim, linkedEvidence) {
  const text = [textForSemanticValue(raw), claim?.verbatim, claim?.evidence_quote, linkedEvidence].filter(Boolean).join(' ');
  if (!text.trim()) return [];
  if (/sole\s+(?:stockholder|shareholder|member)[^.]{0,160}written\s+consent|written\s+consent[^.]{0,160}sole\s+(?:stockholder|shareholder|member)/i.test(text)) {
    return ['SOLE_HOLDER_WRITTEN_CONSENT'];
  }
  if (/all\s+(?:of\s+the\s+)?(?:record\s+)?holders?[^.]{0,160}written\s+consent|written\s+consent[^.]{0,160}all\s+(?:of\s+the\s+)?(?:record\s+)?holders?/i.test(text)) {
    return ['ALL_RECORD_HOLDERS_WRITTEN_CONSENT'];
  }
  if (/\bSOLE_(?:STOCKHOLDER|SHAREHOLDER|MEMBER)_ADOPTION\b/i.test(text)) return ['SOLE_HOLDER_ADOPTION'];
  if (/\bWRITTEN_CONSENT\b|written\s+consent/i.test(text)) return ['WRITTEN_CONSENT'];
  if (/\bBOARD_ONLY\b/i.test(text)) return ['BOARD_ONLY_APPROVAL'];
  if (/board[^.]{0,120}(?:approve|adopt)|(?:approve|adopt)[^.]{0,120}board/i.test(text) && !/stockholder|shareholder|member|written\s+consent/i.test(text)) {
    return ['BOARD_ONLY_APPROVAL'];
  }
  return ['OTHER_CAPTURED_APPROVAL_MECHANISM'];
}

function adjournmentConsentOverride(raw, claim, linkedEvidence) {
  const text = [textForSemanticValue(raw), claim?.verbatim, claim?.evidence_quote, linkedEvidence]
    .filter(Boolean)
    .join(' ');
  if (!text.trim()) return [];
  if (/without\s+(?:the\s+)?(?:prior\s+)?(?:written\s+)?consent\s+of\s+(?:the\s+)?Parent|without\s+(?:the\s+)?Parent['’]s\s+(?:prior\s+)?(?:written\s+)?consent/i.test(text)) {
    return ['PARENT_CONSENT_REQUIRED'];
  }
  if (/without\s+(?:the\s+)?(?:prior\s+)?(?:written\s+)?consent\s+of\s+(?:the\s+)?Company|without\s+(?:the\s+)?Company['’]s\s+(?:prior\s+)?(?:written\s+)?consent/i.test(text)) {
    return ['COMPANY_CONSENT_REQUIRED'];
  }
  return [];
}

function normalisedSemanticValues(raw, claim, valueSpec, spec, linkedEvidence, deal, peerClaims) {
  if (!valueSpec.normalizer) return [raw];
  if (valueSpec.normalizer === 'adjournment_duration') return adjournmentDuration(raw, valueSpec, claim);
  if (valueSpec.normalizer === 'adjournment_consent_override') return adjournmentConsentOverride(raw, claim, linkedEvidence);
  if (valueSpec.normalizer === 'ioc_dollar_threshold') return iocDollarThreshold(raw, claim);
  if (valueSpec.normalizer === 'period_months') return periodMonths(raw, valueSpec, claim);
  const legalValues = normaliseLegalMarketValue(valueSpec.normalizer, raw, claim, linkedEvidence, peerClaims);
  if (legalValues) return legalValues;
  if (valueSpec.normalizer === 'material_contract_threshold_type') {
    return [materialContractThresholdType(raw, claim)].filter(Boolean);
  }
  if (valueSpec.normalizer === 'condition_term') {
    return [conditionTerm(raw, valueSpec.conditionFamily)].filter(Boolean);
  }
  if (valueSpec.normalizer === 'employee_benefit_period') {
    const period = employeeBenefitPeriod(raw, claim);
    return period ? [period] : [];
  }
  if (valueSpec.normalizer === 'abry_scope') {
    return claimMatchesAbryParty(claim, peerClaims, valueSpec.partyValues) ? abryScope(raw) : [];
  }
  if (valueSpec.normalizer === 'acquisition_transaction_types') return acquisitionTransactionTypes(raw);
  if (valueSpec.normalizer === 'transactions_exclusion') return transactionsExclusion(raw);
  if (valueSpec.normalizer === 'fraud_carveout_scope') return fraudCarveoutScope(raw);
  if (valueSpec.normalizer === 'financing_scope') return financingScope(raw);
  if (valueSpec.normalizer === 'third_party_beneficiary_types') return thirdPartyBeneficiaryTypes(raw, claim, linkedEvidence);
  if (valueSpec.normalizer === 'third_party_enforceable_rights') return thirdPartyEnforceableRights(raw, claim, linkedEvidence);
  if (valueSpec.normalizer === 'fee_expense_allocation') return feeExpenseAllocation(raw, claim, linkedEvidence);
  if (valueSpec.normalizer === 'assignment_restrictions') return assignmentRestrictions(raw, claim);
  if (valueSpec.normalizer === 'assignment_exceptions') return assignmentExceptions(raw, claim);
  if (valueSpec.normalizer === 'covenant_treatments') return covenantTreatments(raw, valueSpec, claim, linkedEvidence);
  if (valueSpec.normalizer === 'insurance_cap_multiplier') {
    const multiplier = insuranceCapMultiplier(raw);
    return multiplier ? [multiplier] : [];
  }
  if (valueSpec.normalizer === 'parent_approval_mechanism') return parentApprovalMechanism(raw, claim, linkedEvidence);
  if (valueSpec.normalizer === 'relative_period_months') {
    const candidates = [raw, claim?.canonical, claim?.provenance?.feature_value, claim?.verbatim]
      .map(unwrapValue)
      .filter((value) => value !== null && value !== undefined && typeof value !== 'object');
    for (const candidate of candidates) {
      const months = toRelativeMonthsForField(claim?.attribute, candidate, deal || {});
      if (months !== null) return [{ value: months, unit: 'months', calendarBasis: 'elapsed', trigger: 'signing_date' }];
    }
    return [];
  }
  if (valueSpec.normalizer === 'forward_period_months') {
    const direct = finiteNumber(unwrapValue(raw));
    if (direct !== null && direct >= 0 && ['outsideDateMonthsPostSigning', 'outsideDateMonths'].includes(claim?.attribute)) {
      return [{ value: direct, unit: 'months', calendarBasis: 'elapsed', trigger: 'signing_date' }];
    }
    const signingRaw = deal?.signing_date || deal?.metadata?.signing_date || deal?.metadata?.signingDate || deal?.announce_date;
    const signingDate = parseForwardDate(String(signingRaw || '').slice(0, 10));
    if (!signingDate) return [];
    const candidates = [raw, claim?.canonical, claim?.provenance?.feature_value, claim?.verbatim]
      .map(unwrapValue)
      .filter((value) => value !== null && value !== undefined && typeof value !== 'object');
    for (const candidate of candidates) {
      const outsideDate = parseForwardDate(candidate);
      if (!outsideDate) continue;
      const days = (outsideDate.getTime() - signingDate.getTime()) / (24 * 60 * 60 * 1000);
      if (days < 0) continue;
      return [{ value: Math.round(days / 30.4375), unit: 'months', calendarBasis: 'elapsed', trigger: 'signing_date' }];
    }
    return [];
  }
  if (valueSpec.normalizer === 'deadline_duration') {
    const value = unwrapValue(raw);
    let parsed = null;
    const direct = finiteNumber(value);
    if (direct !== null && valueSpec.unit) parsed = { value: direct, unit: normaliseUnit(valueSpec.unit) };
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const amount = finiteNumber(value.days ?? value.hours ?? value.value);
      const unit = value.hours !== undefined ? 'elapsed_hours' : normaliseUnit(value.unit || (value.days !== undefined ? 'days' : null));
      if (amount !== null && unit) parsed = { value: amount, unit };
    }
    if (!parsed) parsed = normalizeDurationClaim(claim, linkedEvidence);
    if (!parsed) return [];
    const unit = normaliseUnit(parsed.unit);
    const observedTrigger = deadlineTrigger(value, claim);
    return [{
      value: parsed.value,
      unit,
      calendarBasis: unit === 'business_days' ? 'business' : unit === 'calendar_days' ? 'calendar' : unit === 'elapsed_hours' ? 'elapsed' : 'elapsed',
      trigger: observedTrigger || valueSpec.trigger || spec?.semantics?.trigger || null,
      cadence: valueSpec.cadence || 'one_time',
    }];
  }
  if (valueSpec.normalizer === 'deadline_trigger') {
    const trigger = deadlineTrigger(raw, claim);
    return trigger ? [trigger] : [];
  }
  if (valueSpec.normalizer === 'bring_down_for_rep') {
    const peerTiers = (peerClaims || [])
      .filter((candidate) => candidate.attribute === 'bringDownTiers')
      .flatMap((candidate) => {
        const payload = unwrapValue(featurePayload(candidate));
        return Array.isArray(payload) ? payload : [payload];
      })
      .filter(isNonEmpty);
    return bringDownStandardsForRep(peerTiers.length ? peerTiers : raw, valueSpec);
  }
  if (valueSpec.normalizer === 'equity_consideration' || valueSpec.normalizer === 'equity_vesting') {
    const classifier = valueSpec.normalizer === 'equity_consideration' ? equityConsiderationCode : equityVestingCode;
    const entries = equityEntriesForInstrument(raw, valueSpec.instrumentCode);
    if (!entries.length && claimCarriesInstrument(claim, peerClaims, valueSpec.instrumentCode)) entries.push(raw);
    return entries.map(classifier).filter(isNonEmpty);
  }
  return [];
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

function declaredProseNumber(text, unit) {
  if (unit !== 'multiplier' || typeof text !== 'string') return null;
  if (!/\b(?:shares?|units?|ratio|multiplier)\b|\d\s*[x×]\b/i.test(text)) return null;
  const withoutCitations = text.replace(/\b(?:Sections?|Articles?|§)\s*\d+(?:\.\d+)*(?:\([a-z0-9]+\))*/gi, ' ');
  const matches = withoutCitations.match(/[-+]?\d[\d,]*(?:\.\d+)?/g) || [];
  if (matches.length !== 1) return null;
  const parsed = Number(matches[0].replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function numericValue(raw, claim, kind, linkedEvidence = null, semantics = null) {
  if (kind === 'duration') return normalizeDurationClaim(claim, linkedEvidence);
  const direct = finiteNumber(raw);
  if (direct !== null) {
    return {
      value: direct,
      unit: declaredScalarUnit(kind, semantics),
    };
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const key of ['value', 'amount', 'threshold', 'number', 'days', 'hours']) {
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
  const declaredUnit = declaredScalarUnit(kind, semantics);
  const declaredValue = declaredProseNumber(text, declaredUnit);
  if (declaredValue !== null) return { value: declaredValue, unit: declaredUnit };
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

function extractClaimValues(claim, spec, linkedEvidence = null, deal = null, peerClaims = null) {
  const kind = spec.comparison.kind;
  const valueSpec = spec.observation.value;
  const result = [];
  for (const sourceRaw of metricRawValues(claim, valueSpec)) {
    for (const raw of normalisedSemanticValues(sourceRaw, claim, valueSpec, spec, linkedEvidence, deal, peerClaims)) {
      if (!isNonEmpty(raw)) continue;
      if (kind === 'numeric' || kind === 'money' || kind === 'duration') {
        const parsed = valueSpec.normalizer
          ? numericValue(raw, claim, kind === 'duration' ? 'numeric' : kind, linkedEvidence, spec.semantics)
          : numericValue(raw, claim, kind, linkedEvidence, spec.semantics);
        if (!parsed || !Number.isFinite(parsed.value)) continue;
        result.push({ value: parsed.value, ...valueDimensions(raw, parsed, spec, claim) });
        continue;
      }
      const scalar = scalarValue(raw);
      if (scalar !== null) result.push({ value: scalar, ...valueDimensions(raw, null, spec, claim) });
    }
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
  const recoveredClaims = [...(dataset.claims || [])];
  const existingBringDown = new Set(recoveredClaims
    .filter((claim) => claim.attribute === 'bringDownTiers')
    .map((claim) => `${claim.deal_id}|${claim.excerpt_id}|${token(claim?.provenance?.code) || ''}`));
  for (const card of dataset.cards || []) {
    if (token(card?.provision_type) !== 'CLOSING_CONDITION') continue;
    const recovered = recoverBringDownFromCard(card);
    if (!recovered.provisionCode || !recovered.tiers.length || !card.excerpt_id) continue;
    const key = `${card.deal_id}|${card.excerpt_id}|${recovered.provisionCode}`;
    if (existingBringDown.has(key)) continue;
    recoveredClaims.push({
      id: `recovered-bring-down:${card.deal_id}:${card.excerpt_id}:${recovered.provisionCode}`,
      deal_id: card.deal_id,
      excerpt_id: card.excerpt_id,
      attribute: 'bringDownTiers',
      canonical: null,
      verbatim: JSON.stringify(recovered.tiers),
      evidence_quote: recovered.sourceText,
      provenance: {
        code: recovered.provisionCode,
        feature_value: recovered.tiers,
        recovery: 'bundled_closing_condition_text',
      },
    });
    existingBringDown.add(key);
  }
  const cardsByDeal = new Map();
  const cardByExcerpt = new Map();
  for (const card of dataset.cards || []) {
    if (!cardsByDeal.has(card.deal_id)) cardsByDeal.set(card.deal_id, []);
    cardsByDeal.get(card.deal_id).push(card);
    if (card.excerpt_id) cardByExcerpt.set(`${card.deal_id}|${card.excerpt_id}`, card);
  }
  const claimsByDeal = new Map();
  for (const claim of recoveredClaims) {
    if (!claimsByDeal.has(claim.deal_id)) claimsByDeal.set(claim.deal_id, []);
    claimsByDeal.get(claim.deal_id).push(claim);
  }
  return { ...dataset, claims: recoveredClaims, cardsByDeal, cardByExcerpt, claimsByDeal };
}

function cardMatchesProvisionCodes(card, codes) {
  if (codes.has(token(card?.provision_subtype))) return true;
  if (token(card?.provision_type) !== 'CLOSING_CONDITION') return false;
  const recoveredCode = recoverBringDownFromCard(card).provisionCode;
  return Boolean(recoveredCode) && codes.has(token(recoveredCode));
}

function cardMatchesScope(card, cohort) {
  if (cohort.scope === 'all_deals') return true;
  if (cohort.scope === 'provision_family') {
    return cardMatchesFamily(card, cohort.provisionFamily);
  }
  const codes = new Set((cohort.provisionCodes || []).map(token));
  return cardMatchesProvisionCodes(card, codes);
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
    cohortMatch = codes.has(token(claimCode)) || (Boolean(card) && cardMatchesProvisionCodes(card, codes));
  }
  if (!cohortMatch) return false;
  const observationCodes = new Set((spec.observation.scope?.provisionCodes || []).map(token));
  if (observationCodes.size) {
    const claimCode = claim.provenance && claim.provenance.code;
    const codeMatch = observationCodes.has(token(claimCode))
      || (Boolean(card) && cardMatchesProvisionCodes(card, observationCodes));
    if (!codeMatch) return false;
  }
  const definedTermIncludes = String(spec.observation.scope?.definedTermIncludes || '').trim().toLowerCase();
  if (definedTermIncludes
    && (!card || !`${card.defined_term || ''} ${card.short_title || ''}`.toLowerCase().includes(definedTermIncludes))) return false;
  const shortTitleIncludes = String(spec.observation.scope?.shortTitleIncludes || '').trim().toLowerCase();
  if (shortTitleIncludes && (!card || !String(card.short_title || '').toLowerCase().includes(shortTitleIncludes))) return false;
  return true;
}

function isApplicable(spec, scopedCards, allCards, scopedClaims) {
  if (spec.cohort.eligibility === 'all_deals') return true;
  if (spec.cohort.eligibility === 'family_present') {
    return allCards.some((card) => cardMatchesFamily(card, spec.cohort.provisionFamily));
  }
  if (spec.cohort.eligibility === 'code_present') {
    const codes = new Set((spec.cohort.provisionCodes || []).map(token));
    return allCards.some((card) => cardMatchesProvisionCodes(card, codes)) || scopedClaims.length > 0;
  }
  if (spec.cohort.eligibility === 'instrument_present') {
    const featureKeys = new Set(spec.cohort.instrumentFeatureKeys || []);
    return scopedClaims
      .filter((claim) => featureKeys.has(claim.attribute))
      .some((claim) => claimCarriesInstrument(claim, scopedClaims, spec.cohort.instrumentCode));
  }
  return scopedCards.length > 0;
}

function definitionCards(cards, term, claims = []) {
  const canonicalTerm = (value) => String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
    .replace(/\s+/g, ' ');
  const expected = canonicalTerm(term);
  if (!expected) return [];
  const matchingClaimExcerpts = new Set(claims
    .filter((claim) => claim?.attribute === 'canonicalTerm'
      && canonicalTerm(scalarValue(featurePayload(claim))) === expected)
    .map((claim) => `${claim.deal_id}|${claim.excerpt_id}`));
  return cards.filter((card) => token(card.provision_type) === 'DEFINITION'
    && (
      canonicalTerm(card.defined_term) === expected
      || canonicalTerm(card.short_title) === expected
      || matchingClaimExcerpts.has(`${card.deal_id}|${card.excerpt_id}`)
    ));
}

function cardIdForClaim(index, claim) {
  if (!claim) return null;
  const cardId = index.cardByExcerpt.get(`${claim.deal_id}|${claim.excerpt_id}`)?.id;
  return cardId === null || cardId === undefined || cardId === '' ? null : String(cardId);
}

function presenceEvidenceForDeal(spec, scopedCards, scopedClaims, allCards, index) {
  const presence = spec.observation.presence;
  if (presence.strategy === 'card_exists') {
    const codes = new Set((presence.provisionCodes || []).map(token));
    const definedTermIncludes = String(presence.definedTermIncludes || '').trim().toLowerCase();
    const shortTitleIncludes = String(presence.shortTitleIncludes || '').trim().toLowerCase();
    const matchingCards = (codes.size || definedTermIncludes || shortTitleIncludes) ? allCards.filter((card) => (
      (!codes.size || cardMatchesProvisionCodes(card, codes))
      && (!definedTermIncludes || `${card.defined_term || ''} ${card.short_title || ''}`.toLowerCase().includes(definedTermIncludes))
      && (!shortTitleIncludes || String(card.short_title || '').toLowerCase().includes(shortTitleIncludes))
    )) : scopedCards;
    return { present: matchingCards.length > 0, cardId: matchingCards.find((card) => card?.id)?.id || null };
  }
  if (presence.strategy === 'definition_term') {
    const matchingCards = definitionCards(allCards, presence.term, scopedClaims);
    return { present: matchingCards.length > 0, cardId: matchingCards.find((card) => card?.id)?.id || null };
  }
  const features = new Set(presence.featureKeys || []);
  const claims = scopedClaims.filter((claim) => features.has(claim.attribute));
  const evidence = (matchingClaims) => ({
    present: matchingClaims.length > 0,
    cardId: cardIdForClaim(index, matchingClaims[0] || claims[0]),
  });
  if (presence.strategy === 'feature_non_empty') {
    const absentValues = new Set((presence.absentValues || []).map(token).filter(Boolean));
    return evidence(claims.filter((claim) => {
      if (!claimHasValue(claim)) return false;
      if (!absentValues.size) return true;
      const candidates = [claim.canonical, scalarValue(featurePayload(claim))].map(token).filter(Boolean);
      return !candidates.some((value) => absentValues.has(value));
    }));
  }
  if (presence.strategy === 'feature_matches') {
    const expected = new Set((presence.values || []).map(token).filter(Boolean));
    return evidence(claims.filter((claim) => {
      const payload = unwrapValue(featurePayload(claim));
      const candidates = Array.isArray(payload) ? payload : [payload];
      return candidates.some((value) => expected.has(token(scalarValue(value))));
    }));
  }
  if (presence.strategy === 'list_item') return evidence(claims.filter((claim) => claimMatchesItem(claim, presence)));
  if (presence.strategy === 'instrument_item') {
    return evidence(claims.filter((claim) => claimCarriesInstrument(claim, scopedClaims, presence.instrumentCode)));
  }
  if (presence.strategy === 'optional_money') {
    const matchingClaims = claims.filter(hasIocMoneySignal);
    if (matchingClaims.length) return evidence(matchingClaims);
    const textOnlyCard = scopedCards.find((card) => /\$\s*[\d,.]+|\b\d+(?:\.\d+)?\s*(?:million|billion)\s+dollars?\b/i.test(String(card?.primary_quote || '')));
    return { present: Boolean(textOnlyCard), cardId: textOnlyCard?.id || null };
  }
  return { present: false, cardId: null };
}

function valuesForDeal(spec, scopedClaims, index, deal) {
  if (spec.comparison.kind === 'presence') return [];
  const valueSpec = spec.observation.value;
  const features = new Set(valueSpec.featureKeys || []);
  return scopedClaims
    .filter((claim) => features.has(claim.attribute))
    .flatMap((claim) => {
      const card = index.cardByExcerpt.get(`${claim.deal_id}|${claim.excerpt_id}`);
      return extractClaimValues(claim, spec, card?.primary_quote || null, deal, scopedClaims)
        .map((value) => (card?.id ? { ...value, cardId: String(card.id) } : value));
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
    const scopedClaims = (datasetIndex.claimsByDeal.get(deal.id) || [])
      .filter((claim) => claimMatchesScope(claim, spec, datasetIndex));
    if (!isApplicable(spec, scopedCards, allCards, scopedClaims)) {
      return { deal, dealId: deal.id, status: 'not_applicable', values: [] };
    }
    const evidence = presenceEvidenceForDeal(spec, scopedCards, scopedClaims, allCards, datasetIndex);
    if (!evidence.present) {
      return {
        deal,
        dealId: deal.id,
        status: spec.observation.presence.missingState,
        values: [],
        ...(evidence.cardId ? { cardId: String(evidence.cardId) } : {}),
      };
    }
    return {
      deal,
      dealId: deal.id,
      status: 'present',
      values: valuesForDeal(spec, scopedClaims, datasetIndex, deal),
      ...(evidence.cardId ? { cardId: String(evidence.cardId) } : {}),
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
