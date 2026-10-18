#!/usr/bin/env node
'use strict';

// Work package 3 (plan finding (46)) and work package 10 (finding (67)):
// what a generation costs on the Anthropic API at the published rates
// (lib/product/product-model-config.js ANTHROPIC_API_PRICES, with its
// source and date), from a run's recorded calls or from the numbers. Ben,
// 2026-10-17: "you now have $200 of API tokens you can use if you want to
// preseve subscription capcaity".
//
//   node scripts/product/estimate-run-cost.js <input-tokens> <output-tokens> [--model claude-opus-5]
//       [--cache-write-tokens N] [--cache-read-tokens N] [--cache-ttl 1h|5m]
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/product/estimate-run-cost.js --run <run-id> [--model ...]
//
// <input-tokens> is the whole prompt, as the stored calls count it; the
// cache split says how much of it was written to the cache (priced at the
// lifetime, 1 hour unless --cache-ttl says 5m) and how much was read from
// it; the rest is fresh input. With --run the split is read from the stored
// calls' responses (usage.cache_read_input_tokens and the
// usage.cache_creation breakdown by lifetime), per call kind, so the
// estimate for the next deal rests on a run's own cache behaviour. A run on
// a CLI provider has no cache fields and prices as uncached. The uncached
// total is printed beside the estimate.

const { ANTHROPIC_API_CACHE_TTL, ANTHROPIC_API_CACHE_TTLS, ANTHROPIC_API_PRICES } = require('../../lib/product/product-model-config');

function nonNegativeInteger(name, value) {
  if (!Number.isInteger(value) || value < 0) throw new TypeError(`${name} must be a non-negative integer`);
  return value;
}

function estimateRunCost({
  inputTokens, outputTokens, modelId = 'claude-opus-5',
  cacheWriteTokens = 0, cacheReadTokens = 0, cacheTtl = ANTHROPIC_API_CACHE_TTL, cacheWrites = null,
}) {
  const rates = ANTHROPIC_API_PRICES.usd_per_million[modelId];
  if (!rates) throw new Error(`no published rates for ${modelId}`);
  if (!ANTHROPIC_API_CACHE_TTLS.includes(cacheTtl)) throw new TypeError(`cacheTtl must be one of ${ANTHROPIC_API_CACHE_TTLS.join(', ')}`);
  nonNegativeInteger('inputTokens', inputTokens);
  nonNegativeInteger('outputTokens', outputTokens);
  nonNegativeInteger('cacheReadTokens', cacheReadTokens);
  // Writes by lifetime: an explicit breakdown (from a run's calls), else
  // one number at the chosen lifetime.
  const writes = cacheWrites
    ? { '5m': nonNegativeInteger('cacheWrites.5m', cacheWrites['5m'] ?? 0), '1h': nonNegativeInteger('cacheWrites.1h', cacheWrites['1h'] ?? 0) }
    : { '5m': cacheTtl === '5m' ? nonNegativeInteger('cacheWriteTokens', cacheWriteTokens) : 0, '1h': cacheTtl === '1h' ? nonNegativeInteger('cacheWriteTokens', cacheWriteTokens) : 0 };
  const fresh = inputTokens - writes['5m'] - writes['1h'] - cacheReadTokens;
  if (fresh < 0) throw new TypeError('the cache split exceeds the input tokens');
  const input_usd = (fresh * rates.input + writes['5m'] * rates.cache_write_5m + writes['1h'] * rates.cache_write_1h + cacheReadTokens * rates.cache_read) / 1e6;
  const output_usd = (outputTokens * rates.output) / 1e6;
  const uncached_total_usd = (inputTokens * rates.input + outputTokens * rates.output) / 1e6;
  return {
    model_id: modelId,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    fresh_input_tokens: fresh,
    cache_write_tokens: writes,
    cache_read_tokens: cacheReadTokens,
    input_usd: Number(input_usd.toFixed(2)),
    output_usd: Number(output_usd.toFixed(2)),
    total_usd: Number((input_usd + output_usd).toFixed(2)),
    uncached_total_usd: Number(uncached_total_usd.toFixed(2)),
    rates_usd_per_million: rates,
    price_source: ANTHROPIC_API_PRICES.source,
    price_date: ANTHROPIC_API_PRICES.retrieved,
  };
}

function integerArgument(name, text) {
  const value = Number(String(text ?? '').replace(/[,_]/g, ''));
  return nonNegativeInteger(name, value);
}

function parseArguments(argv) {
  const options = { modelId: 'claude-opus-5', cacheWriteTokens: 0, cacheReadTokens: 0, cacheTtl: ANTHROPIC_API_CACHE_TTL };
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--run') { options.runId = argv[index + 1]; index += 1; continue; }
    if (argument === '--model') { options.modelId = argv[index + 1]; index += 1; continue; }
    if (argument === '--cache-write-tokens') { options.cacheWriteTokens = integerArgument('--cache-write-tokens', argv[index + 1]); index += 1; continue; }
    if (argument === '--cache-read-tokens') { options.cacheReadTokens = integerArgument('--cache-read-tokens', argv[index + 1]); index += 1; continue; }
    if (argument === '--cache-ttl') { options.cacheTtl = argv[index + 1]; index += 1; continue; }
    positional.push(argument);
  }
  if (!options.runId) {
    if (positional.length !== 2) throw new TypeError('usage: estimate-run-cost.js <input-tokens> <output-tokens> [--cache-write-tokens N --cache-read-tokens N --cache-ttl 1h|5m] | --run <run-id>');
    options.inputTokens = integerArgument('input-tokens', positional[0]);
    options.outputTokens = integerArgument('output-tokens', positional[1]);
  }
  return options;
}

// The token split of a run's stored calls, in total and per call kind: the
// whole prompt (input_tokens), the output, and from each response's usage
// the cache reads and the writes by lifetime (the breakdown when the API
// returned one, else cache_creation_input_tokens at the lifetime the
// provider asks for).
function usageSplit(rows, cacheTtl = ANTHROPIC_API_CACHE_TTL) {
  const empty = () => ({ calls: 0, input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_writes: { '5m': 0, '1h': 0 } });
  const total = empty();
  const byKind = {};
  const integer = (object, key) => (Number.isInteger(object?.[key]) && object[key] >= 0 ? object[key] : 0);
  for (const row of rows) {
    const usage = row.usage && typeof row.usage === 'object' ? row.usage : {};
    const breakdown = usage.cache_creation && typeof usage.cache_creation === 'object' ? usage.cache_creation : null;
    const writes = breakdown
      ? { '5m': integer(breakdown, 'ephemeral_5m_input_tokens'), '1h': integer(breakdown, 'ephemeral_1h_input_tokens') }
      : { '5m': cacheTtl === '5m' ? integer(usage, 'cache_creation_input_tokens') : 0, '1h': cacheTtl === '1h' ? integer(usage, 'cache_creation_input_tokens') : 0 };
    const kind = byKind[row.call_kind] || (byKind[row.call_kind] = empty());
    for (const bucket of [total, kind]) {
      bucket.calls += 1;
      bucket.input_tokens += Number(row.input_tokens) || 0;
      bucket.output_tokens += Number(row.output_tokens) || 0;
      bucket.cache_read_tokens += integer(usage, 'cache_read_input_tokens');
      bucket.cache_writes['5m'] += writes['5m'];
      bucket.cache_writes['1h'] += writes['1h'];
    }
  }
  return { total, by_call_kind: byKind };
}

async function recordedCalls(runId) {
  if (!/^[0-9a-f-]{36}$/i.test(runId || '')) throw new TypeError('--run must be a run id');
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for --run');
  const { createClient } = require('@supabase/supabase-js');
  const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const rows = [];
  const pageSize = 500;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client.from('product_model_calls')
      .select('call_kind,input_tokens,output_tokens,usage:response->usage')
      .eq('run_id', runId).order('model_call_id').range(from, from + pageSize - 1);
    if (error) throw new Error(`product_model_calls: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

function estimateFromSplit(split, modelId) {
  const estimateOf = (bucket) => estimateRunCost({
    inputTokens: bucket.input_tokens, outputTokens: bucket.output_tokens, modelId,
    cacheReadTokens: bucket.cache_read_tokens, cacheWrites: bucket.cache_writes,
  });
  return {
    ...estimateOf(split.total),
    calls: split.total.calls,
    by_call_kind: Object.fromEntries(Object.entries(split.by_call_kind).map(([kind, bucket]) => {
      const { rates_usd_per_million: _rates, price_source: _source, price_date: _date, ...estimate } = estimateOf(bucket);
      return [kind, { calls: bucket.calls, ...estimate }];
    })),
  };
}

async function main(argv) {
  const options = parseArguments(argv);
  const estimate = options.runId
    ? estimateFromSplit(usageSplit(await recordedCalls(options.runId), options.cacheTtl), options.modelId)
    : estimateRunCost(options);
  console.log(JSON.stringify(estimate, null, 2));
  return estimate;
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => { console.error(error.message || error); process.exit(1); });
}

module.exports = { estimateFromSplit, estimateRunCost, parseArguments, usageSplit };
