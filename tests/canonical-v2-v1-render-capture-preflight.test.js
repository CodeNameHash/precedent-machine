'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { STATUS, AUTHORITY, buildV1RenderCaptureExecutionPreflight } = require('../lib/canonical-v2/v1-render-capture-preflight');

const ROOT = path.resolve(__dirname, '..');
function durableRoot() { return fs.mkdtempSync(path.join(ROOT, '.v1-render-preflight-')); }

test('emits only a not-started, unauthorised read-only capture plan', () => {
  const root = durableRoot();
  try {
    const plan = buildV1RenderCaptureExecutionPreflight({ repository_root: ROOT, durable_output_root: root, reviewer_mode: true });
    assert.equal(plan.status, STATUS);
    assert.equal(plan.execution_authority, AUTHORITY);
    assert.equal(plan.connection_state, 'NO_CONNECTION_OPENED');
    assert.equal(plan.roster.length, 40);
    assert.deepEqual(plan.network_method_allowlist, ['GET']);
    assert.deepEqual(plan.sql_verb_allowlist, ['SELECT']);
    assert.equal(plan.separate_read_only_authority_required, true);
    assert.equal(plan.endpoint_inventory.some((row) => row.tables.includes('claims')), true);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('fails closed without reviewer mode or a durable output root', () => {
  assert.throws(() => buildV1RenderCaptureExecutionPreflight({ repository_root: ROOT, reviewer_mode: false }), (error) => error.code === 'REVIEWER_MODE_REQUIRED');
  assert.throws(() => buildV1RenderCaptureExecutionPreflight({ repository_root: ROOT, durable_output_root: '/missing/v1-render-preflight', reviewer_mode: true }));
});

test('preflight and dry-run script cannot contain a network client, query, mutation or provider launch', () => {
  for (const relativePath of ['lib/canonical-v2/v1-render-capture-preflight.js', 'scripts/plan-v1-render-capture.js']) {
    const source = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
    for (const forbidden of ['fetch(', 'createClient', 'getServiceSupabase', '.from(', 'INSERT ', 'UPDATE ', 'DELETE ', 'executeUnifiedRun', 'produceCandidate']) assert.equal(source.includes(forbidden), false, `${relativePath}: ${forbidden}`);
  }
});
