'use strict';

// A proposal's content identity is computed when it is compiled. The Review
// read path later attaches coverage_only (and, from FACT_CONCLUSIONS/V1,
// conclusions) to the proposal; draft finalisation must ignore those keys
// when it re-checks identity. NCS generation 4 (2026-09-13) failed with
// DRAFT_NESTED_IDENTITY on exactly this proposal before the fix.

const assert = require('node:assert/strict');
const test = require('node:test');
const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const { PROPOSAL_READ_ANNOTATIONS } = require('../lib/product/agreement-draft');
const stored = require('./fixtures/product/ncs-v8-proposal-identity.v1.json');

function identityBody(proposal, omit) {
  const body = { ...proposal };
  delete body.proposal_id;
  for (const key of omit) delete body[key];
  return body;
}

test('a stored V2 proposal hashes to its own id, layers included', () => {
  assert.equal(contentId('PRODUCT_PROPOSAL/V1', identityBody(stored, [])), stored.proposal_id);
});

test('read-side annotations are ignored by the identity check', () => {
  const asRead = { ...stored, coverage_only: false, conclusions: { table_key: 't', row_label: 'r', cells: [] } };
  assert.notEqual(contentId('PRODUCT_PROPOSAL/V1', identityBody(asRead, [])), stored.proposal_id);
  assert.equal(contentId('PRODUCT_PROPOSAL/V1', identityBody(asRead, PROPOSAL_READ_ANNOTATIONS)), stored.proposal_id);
  assert.deepEqual([...PROPOSAL_READ_ANNOTATIONS], ['coverage_only', 'conclusions']);
});
