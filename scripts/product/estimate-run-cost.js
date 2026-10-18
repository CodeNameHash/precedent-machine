#!/usr/bin/env node
'use strict';

// Work package 3 (plan finding (46)): what a generation costs on the
// Anthropic API at the published rates (lib/product/product-model-config.js
// ANTHROPIC_API_PRICES, with its source and date), from a run's recorded
// input and output tokens or from the two numbers. Ben, 2026-10-17: "you
// now have $200 of API tokens you can use if you want to preseve
// subscription capcaity".
//
//   node scripts/product/estimate-run-cost.js <input-tokens> <output-tokens> [--model claude-opus-5] [--cache-read-share 0]
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/product/estimate-run-cost.js --run <run-id> [--model ...]
//
// --cache-read-share is the fraction of input tokens read from the prompt
// cache (0 when the request sets no cache breakpoint, as today).

const { ANTHROPIC_API_PRICES } = require('../../lib/product/product-model-config');

function estimateRunCost({ inputTokens, outputTokens, modelId = 'claude-opus-5', cacheReadShare = 0 }) {
  const rates = ANTHROPIC_API_PRICES.usd_per_million[modelId];
  if (!rates) throw new Error(`no published rates for ${modelId}`);
  for (const [name, value] of [['inputTokens', inputTokens], ['outputTokens', outputTokens]]) {
    if (!Number.isInteger(value) || value < 0) throw new TypeError(`${name} must be a non-negative integer`);
  }
  if (!(cacheReadShare >= 0 && cacheReadShare <= 1)) throw new TypeError('cacheReadShare must be between 0 and 1');
  const cached = Math.round(inputTokens * cacheReadShare);
  const fresh = inputTokens - cached;
  const input_usd = (fresh * rates.input + cached * rates.cache_read) / 1e6;
  const output_usd = (outputTokens * rates.output) / 1e6;
  return {
    model_id: modelId,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cache_read_share: cacheReadShare,
    input_usd: Number(input_usd.toFixed(2)),
    output_usd: Number(output_usd.toFixed(2)),
    total_usd: Number((input_usd + output_usd).toFixed(2)),
    rates_usd_per_million: rates,
    price_source: ANTHROPIC_API_PRICES.source,
    price_date: ANTHROPIC_API_PRICES.retrieved,
  };
}

function parseArguments(argv) {
  const options = { modelId: 'claude-opus-5', cacheReadShare: 0 };
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--run') { options.runId = argv[index + 1]; index += 1; continue; }
    if (argument === '--model') { options.modelId = argv[index + 1]; index += 1; continue; }
    if (argument === '--cache-read-share') { options.cacheReadShare = Number(argv[index + 1]); index += 1; continue; }
    positional.push(argument);
  }
  if (!options.runId) {
    if (positional.length !== 2) throw new TypeError('usage: estimate-run-cost.js <input-tokens> <output-tokens> | --run <run-id>');
    options.inputTokens = Number(positional[0].replace(/[,_]/g, ''));
    options.outputTokens = Number(positional[1].replace(/[,_]/g, ''));
  }
  return options;
}

async function recordedTokens(runId) {
  if (!/^[0-9a-f-]{36}$/i.test(runId || '')) throw new TypeError('--run must be a run id');
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for --run');
  const { createClient } = require('@supabase/supabase-js');
  const { ProductPhase1Store } = require('../../lib/product/phase-1-store');
  const store = new ProductPhase1Store({ client: createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }) });
  const progress = await store.getProgress(runId);
  return { inputTokens: progress.input_tokens, outputTokens: progress.output_tokens };
}

async function main(argv) {
  const options = parseArguments(argv);
  const tokens = options.runId ? await recordedTokens(options.runId) : { inputTokens: options.inputTokens, outputTokens: options.outputTokens };
  const estimate = estimateRunCost({ ...tokens, modelId: options.modelId, cacheReadShare: options.cacheReadShare });
  console.log(JSON.stringify(estimate, null, 2));
  return estimate;
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => { console.error(error.message || error); process.exit(1); });
}

module.exports = { estimateRunCost, parseArguments };
