'use strict';

// PLAN.md Step 2C. Hermetic tests for the wiring this step adds to
// lib/canonical-v2/termination-fee-serving-source.js: a database-backed
// registry entry for Modiv, and the dual sync/async return shape that lets
// it coexist with the pre-existing synchronous QXO/TopBuild fixture entry
// without changing that entry's behaviour or any of its callers.
//
// No live Postgres connection here -- that proof (real container, real
// written rows, the actual attachCanonicalTerminationFeeServing() call site
// cards.js reaches) is
// scripts/canonical-v2-modiv-termination-fee-serving-proof.js, run manually
// against the local container the same way
// scripts/canonical-v2-local-staging-read-proof.js proves the read half.
// This file proves the mechanism -- dual return shape, registry wiring,
// fail-loud on missing configuration, production denial for this exact deal
// id -- without a database.

const test = require('node:test');
const assert = require('node:assert/strict');

const serving = require('../lib/canonical-v2/termination-fee-serving-source');

const {
  MODIV_DEAL_ID,
  CANONICAL_V2_LOCAL_STAGING_DB_URL_ENV_KEY,
  CANONICAL_V2_TERMINATION_FEE_SERVING_ENV_KEY,
  CANONICAL_V2_TERMINATION_FEE_SERVING_ENABLED_VALUE,
  TERMINATION_FEE_SOURCE_STATE,
} = serving;

const servingKey = CANONICAL_V2_TERMINATION_FEE_SERVING_ENV_KEY;
const servingOn = CANONICAL_V2_TERMINATION_FEE_SERVING_ENABLED_VALUE;

// ---------------------------------------------------------------------------
// 1. Registry wiring: the real registry (no override) knows Modiv, and its
//    builder is the database-backed one this step adds.
// ---------------------------------------------------------------------------

test('MODIV_DEAL_ID is the real production deal id (verified against the deal directory), not a placeholder', () => {
  // lib/generated/home-deal-directory-v1.json and lib/four-deal-local-demo.js
  // both register this exact id for Modiv -- see this test's own literal.
  assert.equal(MODIV_DEAL_ID, 'dfaa71fa-9723-4794-825d-bd5024aa0b5d');
});

test('the real registry (default sources, no override) resolves Modiv to the database builder, not NOT_REGISTERED', async () => {
  // No env DB url set: this must FAIL loud (see test group 3), never
  // silently report NOT_REGISTERED as though Modiv had no canonical data --
  // that would be indistinguishable from "nobody has built this deal yet",
  // which is false.
  const described = await Promise.resolve(serving.describeCanonicalTerminationFeeSource(MODIV_DEAL_ID, { env: {} }));
  assert.equal(described.outcome.state, TERMINATION_FEE_SOURCE_STATE.FAILED);
  assert.notEqual(described.outcome.state, TERMINATION_FEE_SOURCE_STATE.NOT_REGISTERED);
});

// ---------------------------------------------------------------------------
// 2. The dual return shape: an async (thenable) builder is awaited and
//    produces the exact same { cards, outcome } shape a sync builder does;
//    a sync builder (every pre-2026-08-07 entry) is completely unaffected.
// ---------------------------------------------------------------------------

const FAKE_ASYNC_DEAL_ID = 'fake-async-deal-0000-0000-000000000000';
const FAKE_SYNC_DEAL_ID = 'fake-sync-deal-0000-0000-0000-00000000000';

function asyncSources(cards) {
  return { [FAKE_ASYNC_DEAL_ID]: async () => cards };
}

function syncSources(cards) {
  return { [FAKE_SYNC_DEAL_ID]: () => cards };
}

test('describeCanonicalTerminationFeeSource returns a Promise for an async (thenable) builder', () => {
  const result = serving.describeCanonicalTerminationFeeSource(FAKE_ASYNC_DEAL_ID, { sources: asyncSources([{ id: 'a' }]) });
  assert.equal(typeof result.then, 'function', 'an async builder must make this function return a Promise');
});

test('...and that Promise resolves to the same { cards, outcome } shape a sync builder returns directly', async () => {
  const resolved = await serving.describeCanonicalTerminationFeeSource(FAKE_ASYNC_DEAL_ID, { sources: asyncSources([{ id: 'a' }, { id: 'b' }]) });
  assert.deepEqual(resolved.cards, [{ id: 'a' }, { id: 'b' }]);
  assert.equal(resolved.outcome.state, TERMINATION_FEE_SOURCE_STATE.ATTACHED);
  assert.equal(resolved.outcome.card_count, 2);
});

test('a synchronous builder (every pre-Step-2C entry, including the real QXO one) is returned WITHOUT wrapping in a Promise', () => {
  const result = serving.describeCanonicalTerminationFeeSource(FAKE_SYNC_DEAL_ID, { sources: syncSources([{ id: 'x' }]) });
  assert.equal(typeof result.then, 'undefined', 'a sync builder must not suddenly return a Promise -- every existing caller does not await this');
  assert.deepEqual(result.cards, [{ id: 'x' }]);
});

test('a rejected async builder resolves to FAILED, the same shape a throwing sync builder produces', async () => {
  const rejecting = { [FAKE_ASYNC_DEAL_ID]: async () => { throw new Error('boom'); } };
  const resolved = await serving.describeCanonicalTerminationFeeSource(FAKE_ASYNC_DEAL_ID, { sources: rejecting });
  assert.equal(resolved.outcome.state, TERMINATION_FEE_SOURCE_STATE.FAILED);
  assert.equal(resolved.outcome.failure.error_message, 'boom');
  assert.deepEqual(resolved.cards, []);
});

test('attachCanonicalTerminationFeeServing awaits an async source and stamps the real payload shape', async () => {
  const reviewDeal = { dealId: FAKE_ASYNC_DEAL_ID, cards: [] };
  const result = serving.attachCanonicalTerminationFeeServing(reviewDeal, {
    env: { [servingKey]: servingOn },
    sources: asyncSources([{ id: 'a' }]),
  });
  assert.equal(typeof result.then, 'function', 'an async source must make attachCanonicalTerminationFeeServing return a Promise too');
  const served = await result;
  assert.equal(served[serving.CANONICAL_V2_TERMINATION_FEE_SERVING_FIELD], true);
  assert.deepEqual(served[serving.CANONICAL_V2_TERMINATION_FEE_CARDS_FIELD], [{ id: 'a' }]);
});

test('attachCanonicalTerminationFeeServing stays fully synchronous for the real QXO deal id (regression guard)', () => {
  const reviewDeal = { dealId: serving.QXO_TOPBUILD_DEAL_ID, cards: [] };
  const result = serving.attachCanonicalTerminationFeeServing(reviewDeal, { env: { [servingKey]: servingOn } });
  assert.equal(typeof result.then, 'undefined', 'the real QXO builder is synchronous; this step must not force it through a Promise');
  assert.ok(Array.isArray(result[serving.CANONICAL_V2_TERMINATION_FEE_CARDS_FIELD]));
  assert.ok(result[serving.CANONICAL_V2_TERMINATION_FEE_CARDS_FIELD].length > 0);
});

// ---------------------------------------------------------------------------
// 3. buildModivTerminationFeeCardsFromDatabase fails loud, never silently,
//    when its configuration is missing -- same discipline as every other
//    FAILED-state source in this module.
// ---------------------------------------------------------------------------

test('buildModivTerminationFeeCardsFromDatabase throws a clear, actionable error when LOCAL_CANONICAL_V2_DB_URL is unset', async () => {
  await assert.rejects(
    () => serving.buildModivTerminationFeeCardsFromDatabase(MODIV_DEAL_ID, { env: {} }),
    (error) => error instanceof Error && error.message.includes(CANONICAL_V2_LOCAL_STAGING_DB_URL_ENV_KEY),
  );
});

test('...and describeCanonicalTerminationFeeSource surfaces that as FAILED, not NOT_REGISTERED or a silent empty array', async () => {
  const described = await Promise.resolve(serving.describeCanonicalTerminationFeeSource(MODIV_DEAL_ID, { env: {} }));
  assert.equal(described.outcome.state, TERMINATION_FEE_SOURCE_STATE.FAILED);
  assert.equal(described.outcome.failure.error_message.includes(CANONICAL_V2_LOCAL_STAGING_DB_URL_ENV_KEY), true);
  assert.deepEqual(described.cards, []);
});

// ---------------------------------------------------------------------------
// 4. Production denial, specifically for the real Modiv deal id and the
//    real (unmocked) registry -- proving the guard fires for THIS entry,
//    not only for the pre-existing QXO one the switch test already covers.
// ---------------------------------------------------------------------------

test('production denial: the real Modiv registry entry never runs at all in a production-shaped runtime', () => {
  const reviewDeal = { dealId: MODIV_DEAL_ID, cards: [] };
  const productionEnv = {
    [servingKey]: servingOn,
    // A DB url that would throw if the builder were ever invoked -- proves
    // the gate short-circuits BEFORE describeCanonicalTerminationFeeSource
    // (and therefore before the builder, and therefore before any
    // connection attempt) runs at all, not merely that the eventual answer
    // happens to look the same. NODE_ENV=production alone denies this
    // already (isPermittedCanonicalV2Runtime); VERCEL_ENV=production is the
    // second, independent path to the same denial.
    [CANONICAL_V2_LOCAL_STAGING_DB_URL_ENV_KEY]: 'postgres://nobody:nobody@127.0.0.1:1/nope',
    NODE_ENV: 'production',
  };
  const result = serving.attachCanonicalTerminationFeeServing(reviewDeal, { env: productionEnv });
  // Synchronous, not a Promise: the gate returns before describe() is ever
  // called, so there is nothing to await -- if this ever starts returning a
  // Promise, the gate stopped short-circuiting.
  assert.equal(typeof result.then, 'undefined');
  assert.equal(result, reviewDeal, 'must be the exact same object reference: nothing added, nothing built');
  assert.equal(result[serving.CANONICAL_V2_TERMINATION_FEE_SERVING_FIELD], undefined);
});

test('production denial via VERCEL_ENV, same deal id, same poisoned DB url', () => {
  const reviewDeal = { dealId: MODIV_DEAL_ID, cards: [] };
  const productionEnv = {
    [servingKey]: servingOn,
    [CANONICAL_V2_LOCAL_STAGING_DB_URL_ENV_KEY]: 'postgres://nobody:nobody@127.0.0.1:1/nope',
    VERCEL: '1',
    VERCEL_ENV: 'production',
  };
  const result = serving.attachCanonicalTerminationFeeServing(reviewDeal, { env: productionEnv });
  assert.equal(result, reviewDeal);
});

// The guard-fires proof CLAUDE.md and this step's own brief require: the
// SAME poisoned DB url, in a PERMITTED runtime, must actually attempt a
// connection and surface FAILED -- proving Step 4's denial above is caused
// by the runtime gate, not by circumstance (e.g. a URL that just happens
// never to be read). Live-network behaviour (ECONNREFUSED), so this test is
// allowed to take a moment; it does not require the schema or any written
// data, only that something is listening (or refuses) at the address.
test('the SAME poisoned DB url DOES get used in a permitted (non-production) runtime -- proving the production test above is a real guard, not a coincidence', async () => {
  const reviewDeal = { dealId: MODIV_DEAL_ID, cards: [] };
  const permittedEnv = {
    [servingKey]: servingOn,
    [CANONICAL_V2_LOCAL_STAGING_DB_URL_ENV_KEY]: 'postgres://nobody:nobody@127.0.0.1:1/nope',
    NODE_ENV: 'test',
  };
  const result = await serving.attachCanonicalTerminationFeeServing(reviewDeal, { env: permittedEnv });
  const outcome = result[serving.CANONICAL_V2_TERMINATION_FEE_SOURCE_STATUS_FIELD];
  assert.equal(outcome.state, TERMINATION_FEE_SOURCE_STATE.FAILED, 'a permitted runtime must actually try the connection and fail, not silently do nothing');
  assert.equal(outcome.failure.error_code, 'ECONNREFUSED');
});
