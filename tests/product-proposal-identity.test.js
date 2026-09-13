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
  const asRead = { ...stored, coverage_only: false };
  assert.notEqual(contentId('PRODUCT_PROPOSAL/V1', identityBody(asRead, [])), stored.proposal_id);
  assert.equal(contentId('PRODUCT_PROPOSAL/V1', identityBody(asRead, PROPOSAL_READ_ANNOTATIONS)), stored.proposal_id);
  assert.deepEqual([...PROPOSAL_READ_ANNOTATIONS], ['coverage_only']);
});

// The store rebuilds `components` from product_fact_components rows when a
// proposal is read back. A PERIOD (or DATE/THRESHOLD) component may carry
// value null (contract R6); the rebuild must keep that key, or the proposal
// no longer hashes to its own id. NCS generation 4 failed with
// DRAFT_NESTED_IDENTITY on exactly this proposal after the first fix.
const { withFactComponents, withFactConclusions } = require('../lib/product/phase-2-store');
const storedNullValue = require('./fixtures/product/ncs-v8-proposal-null-value.v1.json');
const nullValueRows = require('./fixtures/product/ncs-v8-proposal-null-value-rows.v1.json');

test('a proposal rebuilt from component rows hashes to its own id when a value kind carries null', () => {
  const { components, headline, ...payload } = storedNullValue;
  const [asRead] = withFactConclusions(
    withFactComponents(
      [payload],
      new Map([[payload.proposal_id, nullValueRows.components]]),
      new Map([[payload.proposal_id, nullValueRows.headline]]),
    ),
    new Map(),
  );
  assert.deepEqual(asRead.components, components);
  assert.deepEqual(asRead.headline, headline);
  assert.equal(contentId('PRODUCT_PROPOSAL/V1', identityBody(asRead, PROPOSAL_READ_ANNOTATIONS)), storedNullValue.proposal_id);
});

// A V9 proposal's conclusions are compiled into it before its id is computed
// (Metsera generation 1, 2026-09-13, proposal f5d41547…). The read path must
// return the payload's conclusions untouched, and finalisation must hash them.
const storedV9 = require('./fixtures/product/metsera-v9-proposal-conclusions.v1.json');
const v9Rows = require('./fixtures/product/metsera-v9-proposal-conclusions-rows.v1.json');

test('a V9 proposal with conclusions hashes to its own id through the read path', () => {
  const { components, headline, ...payload } = storedV9;
  const stripped = { ...payload, components, headline }; // the stored payload keeps every key
  const [asRead] = withFactConclusions(
    withFactComponents(
      [stripped],
      new Map([[payload.proposal_id, v9Rows.components]]),
      new Map([[payload.proposal_id, v9Rows.headline]]),
    ),
    new Map([[payload.proposal_id, v9Rows.conclusions]]),
  );
  assert.deepEqual(asRead.conclusions, storedV9.conclusions);
  assert.equal(contentId('PRODUCT_PROPOSAL/V1', identityBody(asRead, PROPOSAL_READ_ANNOTATIONS)), storedV9.proposal_id);
  const withoutRow = withFactConclusions([stripped], new Map());
  assert.deepEqual(withoutRow[0].conclusions, storedV9.conclusions);
});
