'use strict';

// Metsera generation 5 (2026-09-14): 5.01 lost its lease on one failed
// renewal. A renewal the store refuses as stale loses the section at once;
// any other failure is retried while the lease still has time.

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');

const { withSectionLeaseHeartbeat, isStaleLeaseError } = require('../lib/product/analysis-runner');

const options = () => ({
  runId: crypto.randomUUID(), claim: { node_id: 'n'.repeat(64), attempt_token: crypto.randomUUID() },
  workerId: 'worker', leaseSeconds: 0.3,
});

test('a transient renewal failure is retried and the section commits', async () => {
  let renewals = 0;
  const result = await withSectionLeaseHeartbeat({
    ...options(),
    store: { renewSectionLease: async () => {
      renewals += 1;
      if (renewals <= 2) throw new Error('fetch failed');
    } },
    action: () => new Promise((resolve) => setTimeout(() => resolve('built'), 450)),
    commit: async (value) => value,
  });
  assert.equal(result, 'built');
  assert.ok(renewals >= 4, `renewals kept going after the failures (${renewals})`);
});

test('renewal failures that outlast the lease lose the section', async () => {
  await assert.rejects(() => withSectionLeaseHeartbeat({
    ...options(),
    store: { renewSectionLease: async () => { throw new Error('fetch failed'); } },
    action: () => new Promise((resolve) => setTimeout(() => resolve('late'), 700)),
    commit: () => assert.fail('a lost lease must fence commit'),
  }), /SECTION_LEASE_LOST/);
});

test('a stale renewal loses the section at once', async () => {
  const started = Date.now();
  await assert.rejects(() => withSectionLeaseHeartbeat({
    ...options(),
    store: { renewSectionLease: async () => { const error = new Error('stale section attempt'); error.code = '40001'; throw error; } },
    action: () => new Promise((resolve) => setTimeout(() => resolve('late'), 700)),
    commit: () => assert.fail('a lost lease must fence commit'),
  }), /SECTION_LEASE_LOST/);
  assert.ok(Date.now() - started >= 600, 'the action still ran to its end');
  assert.equal(isStaleLeaseError(new Error('stale section attempt')), true);
  assert.equal(isStaleLeaseError(Object.assign(new Error('x'), { code: '40001' })), true);
  assert.equal(isStaleLeaseError(new Error('fetch failed')), false);
});
