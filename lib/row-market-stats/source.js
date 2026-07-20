const { MarketStatsError } = require('./errors');
const { provisionTypesForFamily } = require('./families');

const QUERY_ROW_LIMIT = 20000;
const FILTER_CHUNK_SIZE = 40;
const QUERY_PAGE_SIZE = 1000;
const PROVISION_CARD_COLUMNS = 'id, deal_id, excerpt_id, provision_type, provision_subtype, short_title, defined_term, primary_quote';
const MAX_DB_QUERY_CONCURRENCY = 2;

function chunks(values, size = FILTER_CHUNK_SIZE) {
  const result = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function comparableSpecs(specs) {
  return specs.filter((spec) => spec.comparison.status === 'comparable');
}

function collectSourceRequirements(specs) {
  const featureKeys = new Set();
  const provisionFamilies = new Set();
  const provisionCodes = new Set();

  for (const spec of comparableSpecs(specs)) {
    if (spec.cohort.scope === 'provision_family' || spec.cohort.eligibility === 'family_present') {
      provisionFamilies.add(String(spec.cohort.provisionFamily).toUpperCase());
    }
    if (spec.cohort.scope === 'provision_codes' || spec.cohort.eligibility === 'code_present') {
      for (const code of spec.cohort.provisionCodes || []) provisionCodes.add(String(code).toUpperCase());
    }
    for (const key of spec.cohort.instrumentFeatureKeys || []) featureKeys.add(key);
    const presence = spec.observation.presence;
    for (const code of presence.provisionCodes || []) provisionCodes.add(String(code).toUpperCase());
    for (const code of spec.observation.scope?.provisionCodes || []) provisionCodes.add(String(code).toUpperCase());
    for (const key of presence.featureKeys || []) featureKeys.add(key);
    const value = spec.observation.value;
    for (const key of (value && value.featureKeys) || []) featureKeys.add(key);
    if (presence.strategy === 'definition_term') {
      provisionFamilies.add('DEFINITION');
      featureKeys.add('canonicalTerm');
    }
  }

  // Some extraction runs bundled a complete accuracy-of-representations
  // limb into an adjacent closing-condition card. Load the condition family
  // whenever a REP bring-down metric is requested so the deterministic
  // observation normalizer can recover that limb from its source quote.
  if (['COND-B-REP', 'COND-S-REP'].some((code) => provisionCodes.has(code))) {
    provisionFamilies.add('COND');
  }

  return {
    featureKeys: [...featureKeys].sort(),
    provisionFamilies: [...provisionFamilies].sort(),
    provisionCodes: [...provisionCodes].sort(),
  };
}

function sourceError(operation) {
  return new MarketStatsError(
    'DATA_SOURCE_ERROR',
    'The market corpus could not be read.',
    { operation },
  );
}

function assertQueryResult(result, operation, requested) {
  if (!result || result.error) throw sourceError(operation);
  return Array.isArray(result.data) ? result.data : [];
}

async function loadPagedRows(readPage, operation, requested) {
  const rows = [];
  while (rows.length < QUERY_ROW_LIMIT) {
    const from = rows.length;
    const to = Math.min(from + QUERY_PAGE_SIZE - 1, QUERY_ROW_LIMIT - 1);
    const page = assertQueryResult(await readPage(from, to), operation, requested);
    rows.push(...page);
    if (page.length < QUERY_PAGE_SIZE) return rows;
  }
  throw new MarketStatsError(
    'SOURCE_TRUNCATED',
    'The market corpus query reached its safety limit.',
    { operation, requested },
  );
}

async function runTaskPool(tasks, concurrency = MAX_DB_QUERY_CONCURRENCY) {
  const queue = Array.isArray(tasks) ? tasks : [];
  if (!queue.length) return [];
  const requested = Number.isInteger(concurrency) && concurrency > 0
    ? concurrency
    : MAX_DB_QUERY_CONCURRENCY;
  const limit = Math.min(requested, MAX_DB_QUERY_CONCURRENCY, queue.length);
  const results = new Array(queue.length);
  let nextIndex = 0;
  let firstError = null;

  async function worker() {
    while (!firstError && nextIndex < queue.length) {
      const index = nextIndex;
      nextIndex += 1;
      try {
        results[index] = await queue[index]();
      } catch (error) {
        if (!firstError) firstError = error;
      }
    }
  }

  await Promise.all(Array.from({ length: limit }, () => worker()));
  if (firstError) throw firstError;
  return results;
}

function dedupe(rows, keyForRow) {
  const seen = new Set();
  const result = [];
  for (const row of rows) {
    const key = keyForRow(row);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(row);
  }
  return result;
}

async function loadMarketDataset(supabase, specs, {
  taskPool = runTaskPool,
  queryConcurrency = MAX_DB_QUERY_CONCURRENCY,
} = {}) {
  if (!supabase) {
    throw new MarketStatsError('DATA_SOURCE_NOT_CONFIGURED', 'The market corpus is not configured.');
  }
  const requirements = collectSourceRequirements(specs);
  const familyTypes = [...new Set(requirements.provisionFamilies.flatMap(provisionTypesForFamily))].sort();
  const familyChunks = chunks(familyTypes);
  const codeChunks = chunks(requirements.provisionCodes);
  const featureChunks = chunks(requirements.featureKeys);

  try {
    const dealTasks = [() => loadPagedRows(
      (from, to) => supabase
        .from('deals')
        .select('id, acquirer, target, sector, value_usd, announce_date, metadata')
        .order('id')
        .range(from, to),
      'deals',
      ['corpus'],
    )];
    const cardTasks = [
      ...familyChunks.map((values) => () => loadPagedRows(
        (from, to) => supabase
          .from('provision_cards')
          .select(PROVISION_CARD_COLUMNS)
          .in('provision_type', values)
          .order('deal_id')
          .order('excerpt_id')
          .range(from, to),
        'provision_cards',
        values,
      )),
      ...codeChunks.map((values) => () => loadPagedRows(
        (from, to) => supabase
          .from('provision_cards')
          .select(PROVISION_CARD_COLUMNS)
          .in('provision_subtype', values)
          .order('deal_id')
          .order('excerpt_id')
          .range(from, to),
        'provision_cards',
        values,
      )),
    ];
    const claimTasks = featureChunks.map((values) => () => loadPagedRows(
      (from, to) => supabase
        .from('claims')
        .select('id, deal_id, excerpt_id, attribute, canonical, verbatim, evidence_quote, provenance')
        .in('attribute', values)
        .order('id')
        .range(from, to),
      'claims',
      values,
    ));

    const initialResults = await taskPool(
      [...dealTasks, ...cardTasks, ...claimTasks],
      queryConcurrency,
    );
    const dealResult = initialResults[0];
    const cardResults = initialResults.slice(dealTasks.length, dealTasks.length + cardTasks.length);
    const claimResults = initialResults.slice(dealTasks.length + cardTasks.length);

    const deals = dealResult;
    const cards = [];
    cardResults.forEach((rows) => cards.push(...rows));
    const claims = [];
    claimResults.forEach((rows) => claims.push(...rows));
    const loadedCardKeys = new Set(cards.map((card) => `${card.deal_id}|${card.excerpt_id}`));
    const missingClaimExcerptIds = [...new Set(claims
      .filter((claim) => claim.excerpt_id && !loadedCardKeys.has(`${claim.deal_id}|${claim.excerpt_id}`))
      .map((claim) => claim.excerpt_id))];
    if (missingClaimExcerptIds.length) {
      const missingCardResults = await taskPool(chunks(missingClaimExcerptIds).map((values) => () => loadPagedRows(
        (from, to) => supabase
          .from('provision_cards')
          .select(PROVISION_CARD_COLUMNS)
          .in('excerpt_id', values)
          .order('deal_id')
          .order('excerpt_id')
          .range(from, to),
        'provision_cards_by_claim',
        values,
      )), queryConcurrency);
      missingCardResults.forEach((rows) => cards.push(...rows));
    }

    return {
      deals,
      cards: dedupe(cards, (card) => `${card.deal_id}|${card.excerpt_id}|${card.provision_type}|${card.provision_subtype || ''}`),
      claims: dedupe(claims, (claim) => claim.id || `${claim.deal_id}|${claim.excerpt_id}|${claim.attribute}|${claim.canonical || ''}|${claim.verbatim || ''}`),
      source: {
        featureKeys: requirements.featureKeys,
        provisionFamilies: requirements.provisionFamilies,
        provisionCodes: requirements.provisionCodes,
      },
    };
  } catch (error) {
    if (error instanceof MarketStatsError) throw error;
    throw sourceError('market_dataset');
  }
}

module.exports = {
  MAX_DB_QUERY_CONCURRENCY,
  FILTER_CHUNK_SIZE,
  QUERY_PAGE_SIZE,
  QUERY_ROW_LIMIT,
  chunks,
  collectSourceRequirements,
  loadPagedRows,
  loadMarketDataset,
  runTaskPool,
};
