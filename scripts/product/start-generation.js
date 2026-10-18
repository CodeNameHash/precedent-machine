#!/usr/bin/env node
'use strict';

// Starts a generation of a submission on a deployment without a browser
// session, through the internal bearer token (lib/product/request-auth.js;
// Ben, 2026-09-14: "Server side route is fine."). Same two calls the intake
// page makes: POST /api/product/intake, then POST /api/product/analysis/<run>/run
// which wakes the hosted sandbox worker.
//
//   PRODUCT_INTERNAL_TOKEN=... node scripts/product/start-generation.js <base-url> <sec-url> <generation> [--provider ANTHROPIC_API]
//   PRODUCT_INTERNAL_TOKEN=... node scripts/product/start-generation.js <base-url> --status <run-id>

const token = process.env.PRODUCT_INTERNAL_TOKEN;
const argv = process.argv.slice(2);
// Work package 3 (plan finding (46)): one run on a named hosted provider
// while the environment default stays (the intake's optional `provider`).
const providerIndex = argv.indexOf('--provider');
const provider = providerIndex === -1 ? undefined : argv[providerIndex + 1];
if (providerIndex !== -1) argv.splice(providerIndex, 2);
const [baseUrl, second, third] = argv;

function usage(message) {
  console.error(message);
  console.error('usage: start-generation.js <base-url> <sec-url> <generation> [--provider <hosted provider id>] | <base-url> --status <run-id>');
  process.exit(64);
}

if (!token) usage('PRODUCT_INTERNAL_TOKEN is not set');
if (!baseUrl || !/^https?:\/\//.test(baseUrl)) usage('base-url must be an http(s) URL');
if (providerIndex !== -1 && !/^[A-Z][A-Z0-9_]+$/.test(provider || '')) usage('--provider needs a hosted provider id such as ANTHROPIC_API');

async function call(method, path, body) {
  const response = await fetch(new URL(path, baseUrl), {
    method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let value;
  try { value = JSON.parse(text); } catch { value = { raw: text }; }
  // The pool of worker sandboxes is held by other live runs (plan finding
  // (140)): the run is saved; this wake is repeated when one is free.
  if (response.status === 503 && value?.error === 'PRODUCT_SANDBOX_POOL_BUSY') {
    const holders = (value.sandboxes || []).map((entry) => `${entry.sandbox_name}: ${entry.run_id ? `run ${entry.run_id} ${entry.run_status || ''}`.trim() : 'free'}`).join('; ');
    throw new Error(`${method} ${path} -> 503 PRODUCT_SANDBOX_POOL_BUSY (${holders}); wake the run again when a sandbox is free: POST ${path} {}`);
  }
  if (!response.ok) throw new Error(`${method} ${path} -> ${response.status}: ${JSON.stringify(value)}`);
  return value;
}

(async () => {
  if (second === '--status') {
    if (!third) usage('run-id required');
    console.log(JSON.stringify(await call('GET', `/api/product/analysis/${third}`), null, 2));
    return;
  }
  const secUrl = second;
  const generation = Number.parseInt(third, 10);
  if (!secUrl || !/^https?:\/\//.test(secUrl)) usage('sec-url must be an http(s) URL');
  if (!Number.isInteger(generation) || generation < 0) usage('generation must be a non-negative integer');
  const submitted = await call('POST', '/api/product/intake', {
    url: secUrl, idempotencyKey: require('node:crypto').randomUUID(), explicitGeneration: generation, maxAttempts: 3,
    ...(provider ? { provider } : {}),
  });
  console.log(`submitted run ${submitted.run_id} (generation ${submitted.generation}, ${submitted.status})`);
  const advanced = await call('POST', `/api/product/analysis/${submitted.run_id}/run`, {});
  console.log(`woke worker: execution ${advanced.execution_mode || 'LOCAL'}${advanced.wake_command_id ? `, command ${advanced.wake_command_id}` : ''}${advanced.sandbox?.sandbox_name ? `, sandbox ${advanced.sandbox.sandbox_name} (${advanced.sandbox.state})` : ''}`);
  console.log(`status:   ${baseUrl.replace(/\/$/, '')}/review?productRun=${submitted.run_id}`);
  console.log(`tables:   ${baseUrl.replace(/\/$/, '')}/review/product/${submitted.run_id}/provisions`);
})().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
