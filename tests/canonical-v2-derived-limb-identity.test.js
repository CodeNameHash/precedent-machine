'use strict';

/**
 * tests/canonical-v2-derived-limb-identity.test.js
 *
 * Stub coverage for DERIVED_LIMB/V1: identity is only
 * {canonical_text_id, marker_start_byte}. Path / end / parent must not
 * affect the minted id. Module is not wired to production minting.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  DERIVED_LIMB_SCHEMA,
  mintDerivedLimbId,
} = require('../lib/canonical-v2/derived-limb-identity');
const { contentId } = require('../lib/canonical-v2/canonical-bytes');

const TEXT_ID = 'a'.repeat(64);
const OTHER_TEXT_ID = 'b'.repeat(64);

describe('DERIVED_LIMB/V1 identity stub', () => {
  it('exports the schema constant', () => {
    assert.equal(DERIVED_LIMB_SCHEMA, 'DERIVED_LIMB/V1');
  });

  it('mints from {canonical_text_id, marker_start_byte} only', () => {
    const id = mintDerivedLimbId({
      canonical_text_id: TEXT_ID,
      marker_start_byte: 1204,
    });
    const expected = contentId(DERIVED_LIMB_SCHEMA, {
      schema_version: DERIVED_LIMB_SCHEMA,
      canonical_text_id: TEXT_ID,
      marker_start_byte: 1204,
    });
    assert.equal(id, expected);
    assert.match(id, /^[0-9a-f]{64}$/);
  });

  it('ignores path, end_byte, and parent when minting (same id)', () => {
    const base = mintDerivedLimbId({
      canonical_text_id: TEXT_ID,
      marker_start_byte: 50,
    });
    // Callers must not pass extras into identity; if they somehow do, the
    // mint function only reads the two identity fields.
    const withExtras = mintDerivedLimbId({
      canonical_text_id: TEXT_ID,
      marker_start_byte: 50,
      path: 'a.ii.B',
      end_byte: 9999,
      parent_derived_limb_id: 'c'.repeat(64),
      depth: 3,
      ordinal: 7,
      segmenter_version: 'SEGMENT_SUBCLAUSES/V1+MAX_DEPTH_5+XYZ',
      corroboration_tier: 'CORROBORATED',
    });
    assert.equal(withExtras, base);
  });

  it('changes id when marker_start_byte changes', () => {
    const a = mintDerivedLimbId({
      canonical_text_id: TEXT_ID,
      marker_start_byte: 10,
    });
    const b = mintDerivedLimbId({
      canonical_text_id: TEXT_ID,
      marker_start_byte: 11,
    });
    assert.notEqual(a, b);
  });

  it('changes id when canonical_text_id changes', () => {
    const a = mintDerivedLimbId({
      canonical_text_id: TEXT_ID,
      marker_start_byte: 10,
    });
    const b = mintDerivedLimbId({
      canonical_text_id: OTHER_TEXT_ID,
      marker_start_byte: 10,
    });
    assert.notEqual(a, b);
  });

  it('rejects a non-digest canonical_text_id', () => {
    assert.throws(
      () => mintDerivedLimbId({
        canonical_text_id: 'not-a-digest',
        marker_start_byte: 0,
      }),
      /canonical_text_id must be a full SHA-256 hex digest/,
    );
  });

  it('rejects a negative marker_start_byte', () => {
    assert.throws(
      () => mintDerivedLimbId({
        canonical_text_id: TEXT_ID,
        marker_start_byte: -1,
      }),
      /marker_start_byte must be a non-negative safe integer/,
    );
  });
});
