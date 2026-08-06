'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { contentId, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const {
  EXACT_EVIDENCE,
  SCHEMA_VERSION,
  SECTION_REFERENCE,
  SOURCE_CARD_ID,
  SOURCE_DOCUMENT_SHA256,
  SOURCE_DOCUMENT_URL,
  buildBd837f1dFinancingSourceOpenWorldPin,
} = require('../lib/canonical-v2/bd837f1d-financing-source-open-world-pin');

test('bd837f1d retains the exact financing-source evidence as an open-world candidate', () => {
  const pin = buildBd837f1dFinancingSourceOpenWorldPin();

  assert.equal(pin.source_card_id, SOURCE_CARD_ID);
  assert.equal(pin.source_document_url, SOURCE_DOCUMENT_URL);
  assert.equal(pin.source_document_sha256, SOURCE_DOCUMENT_SHA256);
  assert.equal(pin.section_reference, SECTION_REFERENCE);
  assert.equal(pin.exact_evidence, EXACT_EVIDENCE);
  assert.equal(pin.exact_evidence_sha256, sha256Hex(EXACT_EVIDENCE));
  assert.equal(pin.disposition, 'OPEN_WORLD_EXACT_EVIDENCE');
  assert.equal(pin.reason, 'FINANCING_SOURCE_PROTECTION_NOT_YET_GOVERNED');
  const { open_world_candidate_id: candidateId, ...body } = pin;
  assert.equal(candidateId, contentId(SCHEMA_VERSION, body));
});

test('bd837f1d cannot be silently promoted to a governed financing or remedies claim', () => {
  const pin = buildBd837f1dFinancingSourceOpenWorldPin();

  assert.equal(pin.governed_concept_key, null);
  assert.equal(pin.governed_claim_definition_key, null);
  assert.ok(!Object.hasOwn(pin, 'canonical_value'));
  assert.ok(!Object.hasOwn(pin, 'review_rank'));
});
