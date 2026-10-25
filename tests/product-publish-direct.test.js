'use strict';

// Work package 52 (plan finding (285)): the direct-connection publish. The
// database call itself needs a database; the part asserted here is the RPC
// argument contract — the action id the function recomputes, the event type
// and the command — because a wrong one is rejected inside Postgres with
// "invalid review action identity".
const assert = require('node:assert/strict');
const test = require('node:test');
const crypto = require('node:crypto');
const { actionIdFor, publishArgs } = require('../scripts/product/publish-direct');

test('the publish arguments carry the action identity the database recomputes', () => {
  const args = publishArgs({
    runId: '11111111-1111-4111-8111-111111111111', actor: 'ben', idempotencyKey: 'publish-direct-13',
    expectedVersion: 13, state: { schema_version: 'PRODUCT_REVIEW_STATE/V1', status: 'PUBLISHED' },
  });
  assert.equal(args.p_event_type, 'PUBLISH');
  assert.equal(args.p_expected_version, 13);
  assert.deepEqual(args.p_command, { type: 'PUBLISH' });
  assert.equal(args.p_action_id, crypto.createHash('sha256').update(`11111111-1111-4111-8111-111111111111\u001fben\u001fpublish-direct-13`, 'utf8').digest('hex'));
  assert.equal(actionIdFor('11111111-1111-4111-8111-111111111111', 'ben', 'publish-direct-13'), args.p_action_id);
  // A different actor or key is a different action.
  assert.notEqual(actionIdFor('11111111-1111-4111-8111-111111111111', 'someone', 'publish-direct-13'), args.p_action_id);
  assert.notEqual(actionIdFor('11111111-1111-4111-8111-111111111111', 'ben', 'publish-direct-14'), args.p_action_id);
});
