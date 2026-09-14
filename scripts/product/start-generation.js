#!/usr/bin/env node
'use strict';

// Starts a generation of a submission on a deployment without a browser
// session, through the internal bearer token (lib/product/request-auth.js;
// Ben, 2026-09-14: "Server side route is fine."). Same two calls the intake
// page makes: POST /api/product/intake, then POST /api/product/analysis/<run>/run
// which wakes the hosted sandbox worker.
//
//   PRODUCT_INTERNAL_TOKEN=... node scripts/product/start-generation.js <base-url> <sec-url> <generation>
//   PRODUCT_INTERNAL_TOKEN=... node scripts/product/start-generation.js <base-url> --status <run-id>

const token = process.env.PRODUCT_INTERNAL_TOKEN;
const [baseUrl, second, third] = process.argv.slice(2);

function usage(message) {
  console.error(message);
  console.error('usage: start-generation.js <base-url> <sec-url> <generation> | <base-url> --status <run-id>');
  process.exit(64);
}

if (!token) usage('PRODUCT_INTERNAL_TOKEN is not set');
if (!baseUrl || !/^https?:\/\//.test(baseUrl)) usage('base-url must be an http(s) URL');

async function call(method, path, body) {
  const response = await fetch(new URL(path, baseUrl), {
    method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let value;
  try { value = JSON.parse(text); } catch { value = { raw: text }; }
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
  });
  console.log(`submitted run ${submitted.run_id} (generation ${submitted.generation}, ${submitted.status})`);
  const advanced = await call('POST', `/api/product/analysis/${submitted.run_id}/run`, {});
  console.log(`woke worker: execution ${advanced.execution_mode || 'LOCAL'}${advanced.wake_command_id ? `, command ${advanced.wake_command_id}` : ''}`);
  console.log(`status:   ${baseUrl.replace(/\/$/, '')}/review?productRun=${submitted.run_id}`);
  console.log(`tables:   ${baseUrl.replace(/\/$/, '')}/review/product/${submitted.run_id}/provisions`);
})().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
