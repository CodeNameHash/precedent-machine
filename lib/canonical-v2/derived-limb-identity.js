/**
 * lib/canonical-v2/derived-limb-identity.js
 *
 * DERIVED_LIMB/V1 identity helper — design stub only.
 *
 * Identity payload is exactly `{ canonical_text_id, marker_start_byte }`
 * (plus schema_version for the contentId convention). Path, parentage,
 * end_byte, depth, ordinal, segmenter_version, and corroboration_tier are
 * NOT identity and must not appear in the mint payload.
 *
 * DO NOT wire this into the producer, writer, or any live mint path.
 * Minting is gated on marker-start stability (DECISIONS.md §15;
 * docs/codex-program/notes/step-2x-derived-limb-schema.md). Annotation-only
 * until that gate opens.
 */

'use strict';

const { contentId } = require('./canonical-bytes');

const DERIVED_LIMB_SCHEMA = 'DERIVED_LIMB/V1';

const SHA256_RE = /^[0-9a-f]{64}$/;

/**
 * Mint a derived-limb content id from the identity payload only.
 *
 * @param {{ canonical_text_id: string, marker_start_byte: number }} args
 * @returns {string} SHA-256 hex content id
 */
function mintDerivedLimbId({ canonical_text_id, marker_start_byte } = {}) {
  if (!SHA256_RE.test(canonical_text_id || '')) {
    throw new TypeError('canonical_text_id must be a full SHA-256 hex digest');
  }
  if (!Number.isSafeInteger(marker_start_byte) || marker_start_byte < 0) {
    throw new TypeError('marker_start_byte must be a non-negative safe integer');
  }

  const payload = {
    schema_version: DERIVED_LIMB_SCHEMA,
    canonical_text_id,
    marker_start_byte,
  };
  return contentId(DERIVED_LIMB_SCHEMA, payload);
}

module.exports = {
  DERIVED_LIMB_SCHEMA,
  mintDerivedLimbId,
};
