const { contentId } = require('./canonical-bytes');
const { compileFixtureContract } = require('./contract-bundle');
const { METRIC_DEFINITIONS } = require('./serving-projection');

const SHA256_RE = /^[a-f0-9]{64}$/;
const MAX_GROUPS = 50;
const MAX_CACHE_TTL_SECONDS = 3600;
const DEFAULT_TIMEOUT_MS = 2500;
const FIXTURE_CONTRACT_FINGERPRINT = compileFixtureContract().fingerprint;
const FILTER_KEYS = Object.freeze([
  'sector',
  'buyer',
  'merger_form',
  'adviser_either',
  'lawyer_either',
  'year_from',
  'year_to',
  'min_value_usd',
  'max_value_usd',
]);

class MarketCohortQueryError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'MarketCohortQueryError';
    this.code = code;
    this.details = details;
  }
}

function requireDigest(value, label) {
  if (!SHA256_RE.test(value || '')) throw new MarketCohortQueryError('INVALID_REQUEST', `${label} must be a full SHA-256 content ID.`);
  return value;
}

function requireText(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new MarketCohortQueryError('INVALID_REQUEST', `${label} must be a non-empty string.`);
  }
  return value.trim();
}

function optionalText(value, label) {
  return value == null || value === '' ? null : requireText(value, label);
}

function optionalYear(value, label) {
  if (value == null || value === '') return null;
  if (!Number.isInteger(value) || value < 1900 || value > 2200) {
    throw new MarketCohortQueryError('INVALID_REQUEST', `${label} must be a four-digit year.`);
  }
  return value;
}

function optionalDecimal(value, label) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)(\.\d+)?$/.test(value)) {
    throw new MarketCohortQueryError('INVALID_REQUEST', `${label} must be a non-negative canonical decimal string.`);
  }
  return value;
}

function compareCanonicalDecimals(left, right) {
  const [leftInteger, leftFraction = ''] = left.split('.');
  const [rightInteger, rightFraction = ''] = right.split('.');
  const scale = Math.max(leftFraction.length, rightFraction.length);
  const leftScaled = BigInt(`${leftInteger}${leftFraction.padEnd(scale, '0')}`);
  const rightScaled = BigInt(`${rightInteger}${rightFraction.padEnd(scale, '0')}`);
  return leftScaled < rightScaled ? -1 : leftScaled > rightScaled ? 1 : 0;
}

function normaliseFilters(filters = {}) {
  if (!filters || typeof filters !== 'object' || Array.isArray(filters)) {
    throw new MarketCohortQueryError('INVALID_REQUEST', 'filters must be an object.');
  }
  const unknown = Object.keys(filters).filter((key) => !FILTER_KEYS.includes(key));
  if (unknown.length) {
    throw new MarketCohortQueryError('INVALID_REQUEST', `Unsupported filters: ${unknown.sort().join(', ')}.`);
  }
  const result = {
    sector: optionalText(filters.sector, 'filters.sector'),
    buyer: optionalText(filters.buyer, 'filters.buyer'),
    merger_form: optionalText(filters.merger_form, 'filters.merger_form'),
    adviser_either: optionalText(filters.adviser_either, 'filters.adviser_either'),
    lawyer_either: optionalText(filters.lawyer_either, 'filters.lawyer_either'),
    year_from: optionalYear(filters.year_from, 'filters.year_from'),
    year_to: optionalYear(filters.year_to, 'filters.year_to'),
    min_value_usd: optionalDecimal(filters.min_value_usd, 'filters.min_value_usd'),
    max_value_usd: optionalDecimal(filters.max_value_usd, 'filters.max_value_usd'),
  };
  if (result.year_from !== null && result.year_to !== null && result.year_from > result.year_to) {
    throw new MarketCohortQueryError('INVALID_REQUEST', 'filters.year_from cannot exceed filters.year_to.');
  }
  if (result.min_value_usd !== null && result.max_value_usd !== null
    && compareCanonicalDecimals(result.min_value_usd, result.max_value_usd) > 0) {
    throw new MarketCohortQueryError('INVALID_REQUEST', 'filters.min_value_usd cannot exceed filters.max_value_usd.');
  }
  return result;
}

function normaliseParty(party) {
  if (!party || typeof party !== 'object' || Array.isArray(party)) {
    throw new MarketCohortQueryError('INVALID_REQUEST', 'party must be an object.');
  }
  if (Object.keys(party).sort().join(',') !== 'capacity,role,value') {
    throw new MarketCohortQueryError('INVALID_REQUEST', 'party must contain exactly role, value and capacity.');
  }
  return {
    role: requireText(party.role, 'party.role'),
    value: requireText(party.value, 'party.value'),
    capacity: requireText(party.capacity, 'party.capacity'),
  };
}

function compileMarketCohortRequest(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    throw new MarketCohortQueryError('INVALID_REQUEST', 'request must be an object.');
  }
  const allowedRequestKeys = new Set([
    'serving_namespace_id',
    'corpus_release_id',
    'contract_fingerprint',
    'metric_key',
    'metric_version',
    'concept_key',
    'party',
    'subject_deal_key',
    'filters',
  ]);
  const unknownRequestKeys = Object.keys(request).filter((key) => !allowedRequestKeys.has(key));
  if (unknownRequestKeys.length) {
    throw new MarketCohortQueryError('INVALID_REQUEST', `Unsupported request fields: ${unknownRequestKeys.sort().join(', ')}.`);
  }
  const metric = METRIC_DEFINITIONS[request.metric_key];
  if (!metric || request.metric_version !== metric.metric_version || request.concept_key !== metric.concept_key) {
    throw new MarketCohortQueryError('INVALID_REQUEST', 'metric, version and concept must match the frozen serving contract.');
  }
  if (request.contract_fingerprint !== FIXTURE_CONTRACT_FINGERPRINT) {
    throw new MarketCohortQueryError('INVALID_REQUEST', 'contract_fingerprint does not match the frozen serving contract.');
  }
  const compiled = {
    schema_version: 'MARKET_COHORT_REQUEST/V1',
    serving_namespace_id: requireDigest(request.serving_namespace_id, 'serving_namespace_id'),
    corpus_release_id: requireDigest(request.corpus_release_id, 'corpus_release_id'),
    contract_fingerprint: requireDigest(request.contract_fingerprint, 'contract_fingerprint'),
    metric_key: metric.metric_key,
    metric_version: metric.metric_version,
    concept_key: metric.concept_key,
    party: normaliseParty(request.party),
    subject_deal_key: optionalText(request.subject_deal_key, 'subject_deal_key'),
    basis_key: metric.canonical_unit,
    filters: normaliseFilters(request.filters),
  };
  const { serving_namespace_id: _physicalNamespace, ...logicalCohort } = compiled;
  const cohortDigest = contentId('MARKET_COHORT/V1', logicalCohort);
  const cacheKey = contentId('MARKET_COHORT_CACHE/V1', {
    serving_namespace_id: compiled.serving_namespace_id,
    corpus_release_id: compiled.corpus_release_id,
    cohort_digest: cohortDigest,
  });
  return Object.freeze({ ...compiled, cohort_digest: cohortDigest, cache_key: cacheKey });
}

function nonNegativeInteger(value, path) {
  if (!Number.isInteger(value) || value < 0) {
    throw new MarketCohortQueryError('INVALID_RESPONSE', `${path} must be a non-negative integer.`);
  }
  return value;
}

function requireExactResponseKeys(value, keys, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new MarketCohortQueryError('INVALID_RESPONSE', `${path} must be an object.`);
  }
  const actual = Object.keys(value).sort().join(',');
  const expected = [...keys].sort().join(',');
  if (actual !== expected) {
    throw new MarketCohortQueryError('INVALID_RESPONSE', `${path} fields do not match the frozen response contract.`);
  }
}

function validateMarketCohortResult(result, request) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new MarketCohortQueryError('INVALID_RESPONSE', 'market cohort response must be an object.');
  }
  for (const forbidden of ['rows', 'claims', 'cards', 'observations']) {
    if (Object.hasOwn(result, forbidden)) {
      throw new MarketCohortQueryError('INVALID_RESPONSE', `market cohort response may not contain broad ${forbidden}.`);
    }
  }
  requireExactResponseKeys(result, [
    'schema_version',
    'serving_namespace_id',
    'corpus_release_id',
    'contract_fingerprint',
    'cohort_digest',
    'metric_key',
    'metric_version',
    'concept_key',
    'subject_deal_key',
    'counts',
    'distribution',
    'exclusions',
  ], 'market cohort response');
  if (result.schema_version !== 'MARKET_COHORT_RESULT/V1'
    || result.serving_namespace_id !== request.serving_namespace_id
    || result.corpus_release_id !== request.corpus_release_id
    || result.contract_fingerprint !== request.contract_fingerprint
    || result.cohort_digest !== request.cohort_digest
    || result.metric_key !== request.metric_key
    || result.metric_version !== request.metric_version
    || result.concept_key !== request.concept_key
    || result.subject_deal_key !== request.subject_deal_key) {
    throw new MarketCohortQueryError('INVALID_RESPONSE', 'market cohort response does not match the compiled request.');
  }
  const counts = result.counts || {};
  const countKeys = [
    'eligible_deals',
    'applicable_deals',
    'examined_deals',
    'present_deals',
    'comparable_deals',
    'distribution_deals',
    'excluded_deals',
    'observation_slots',
    'excluded_slots',
  ];
  requireExactResponseKeys(counts, countKeys, 'counts');
  for (const key of countKeys) nonNegativeInteger(counts[key], `counts.${key}`);
  if (counts.eligible_deals < counts.applicable_deals
    || counts.applicable_deals < counts.examined_deals
    || counts.examined_deals < counts.present_deals
    || counts.present_deals < counts.comparable_deals
    || counts.comparable_deals < counts.distribution_deals
    || counts.eligible_deals < counts.excluded_deals
    || counts.observation_slots < counts.comparable_deals
    || counts.excluded_slots < counts.excluded_deals) {
    throw new MarketCohortQueryError('INVALID_RESPONSE', 'counts violate the governed denominator ordering.');
  }
  if (!Array.isArray(result.distribution) || result.distribution.length > MAX_GROUPS) {
    throw new MarketCohortQueryError('INVALID_RESPONSE', `distribution may contain at most ${MAX_GROUPS} groups.`);
  }
  if (!Array.isArray(result.exclusions) || result.exclusions.length > MAX_GROUPS) {
    throw new MarketCohortQueryError('INVALID_RESPONSE', `exclusions may contain at most ${MAX_GROUPS} groups.`);
  }
  for (const [index, row] of result.distribution.entries()) {
    requireExactResponseKeys(row, ['canonical_value', 'subject_count', 'deal_count'], `distribution[${index}]`);
    if (row.canonical_value == null) throw new MarketCohortQueryError('INVALID_RESPONSE', `distribution[${index}] requires canonical_value.`);
    nonNegativeInteger(row.subject_count, `distribution[${index}].subject_count`);
    nonNegativeInteger(row.deal_count, `distribution[${index}].deal_count`);
    if (row.deal_count > counts.distribution_deals || row.subject_count < row.deal_count
      || row.subject_count > counts.observation_slots) {
      throw new MarketCohortQueryError('INVALID_RESPONSE', `distribution[${index}] exceeds its governed denominator.`);
    }
  }
  for (const [index, row] of result.exclusions.entries()) {
    requireExactResponseKeys(row, ['reason_code', 'slot_count', 'deal_count'], `exclusions[${index}]`);
    requireText(row.reason_code, `exclusions[${index}].reason_code`);
    nonNegativeInteger(row.slot_count, `exclusions[${index}].slot_count`);
    nonNegativeInteger(row.deal_count, `exclusions[${index}].deal_count`);
    if (row.deal_count > counts.excluded_deals || row.slot_count < row.deal_count
      || row.slot_count > counts.excluded_slots) {
      throw new MarketCohortQueryError('INVALID_RESPONSE', `exclusions[${index}] exceeds its governed denominator.`);
    }
  }
  return result;
}

function rpcParams(request) {
  const filters = request.filters;
  return {
    p_environment: 'staging',
    p_serving_namespace_id: request.serving_namespace_id,
    p_corpus_release_id: request.corpus_release_id,
    p_contract_fingerprint: request.contract_fingerprint,
    p_cohort_digest: request.cohort_digest,
    p_metric_key: request.metric_key,
    p_metric_version: request.metric_version,
    p_concept_key: request.concept_key,
    p_party_role: request.party.role,
    p_party_value: request.party.value,
    p_party_capacity: request.party.capacity,
    p_basis_key: request.basis_key,
    p_subject_deal_key: request.subject_deal_key,
    p_sector: filters.sector,
    p_buyer: filters.buyer,
    p_merger_form: filters.merger_form,
    p_adviser_either: filters.adviser_either,
    p_lawyer_either: filters.lawyer_either,
    p_year_from: filters.year_from,
    p_year_to: filters.year_to,
    p_min_value_usd: filters.min_value_usd,
    p_max_value_usd: filters.max_value_usd,
  };
}

async function withDeadline(promise, timeoutMs) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new MarketCohortQueryError('DEADLINE_EXCEEDED', 'Market cohort query exceeded its deadline.')), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function queryMarketCohort({ client, cache = null, request, timeoutMs = DEFAULT_TIMEOUT_MS, cacheTtlSeconds = MAX_CACHE_TTL_SECONDS }) {
  if (!client || typeof client.rpc !== 'function') {
    throw new MarketCohortQueryError('DATA_SOURCE_NOT_CONFIGURED', 'A market cohort RPC client is required.');
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10_000) {
    throw new MarketCohortQueryError('INVALID_REQUEST', 'timeoutMs must be between 1 and 10000.');
  }
  if (!Number.isInteger(cacheTtlSeconds) || cacheTtlSeconds < 1 || cacheTtlSeconds > MAX_CACHE_TTL_SECONDS) {
    throw new MarketCohortQueryError('INVALID_REQUEST', `cacheTtlSeconds must be between 1 and ${MAX_CACHE_TTL_SECONDS}.`);
  }
  const compiled = compileMarketCohortRequest(request);
  if (cache && typeof cache.get === 'function') {
    const cached = await cache.get(compiled.cache_key);
    if (cached != null) return { result: validateMarketCohortResult(cached, compiled), cache: 'HIT', request: compiled };
  }

  let response;
  try {
    response = await withDeadline(
      Promise.resolve(client.rpc('canonical_v2_market_cohort', rpcParams(compiled))),
      timeoutMs,
    );
  } catch (error) {
    if (error instanceof MarketCohortQueryError) throw error;
    throw new MarketCohortQueryError('DATA_SOURCE_ERROR', 'The market cohort could not be read.');
  }
  if (!response || response.error) {
    throw new MarketCohortQueryError('DATA_SOURCE_ERROR', 'The market cohort could not be read.');
  }
  const result = validateMarketCohortResult(response.data, compiled);
  if (cache && typeof cache.set === 'function') {
    await cache.set(compiled.cache_key, result, cacheTtlSeconds);
  }
  return { result, cache: 'MISS', request: compiled };
}

module.exports = {
  DEFAULT_TIMEOUT_MS,
  FILTER_KEYS,
  FIXTURE_CONTRACT_FINGERPRINT,
  MAX_CACHE_TTL_SECONDS,
  MAX_GROUPS,
  MarketCohortQueryError,
  compileMarketCohortRequest,
  queryMarketCohort,
  validateMarketCohortResult,
};
