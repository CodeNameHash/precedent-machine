const assert = require('node:assert/strict');
const test = require('node:test');

const {
  CURRENT_PM_BASELINE_FIELD_KEYS,
  validateProductFieldCatalogueManifest,
} = require('../lib/canonical-v2/product-field-catalogue');
const {
  buildPilotProductFieldCatalogueManifest,
} = require('../lib/canonical-v2/pilot-product-field-catalogue');
const { contentId } = require('../lib/canonical-v2/canonical-bytes');

function id(label) {
  return contentId('PILOT_PRODUCT_FIELD_CATALOGUE_TEST/V1', { label });
}

test('builds one checked pilot catalogue with all shared and Process fields', () => {
  const manifest = buildPilotProductFieldCatalogueManifest({
    approved_pm_data_version_id: id('pm-data'),
    candidate_release_manifest_id: id('candidate'),
    candidate_release_manifest_payload_digest: id('candidate-payload'),
  });
  assert.deepEqual(
    validateProductFieldCatalogueManifest(manifest),
    manifest,
  );
  const keys = new Set(
    manifest.field_definitions.map((field) => field.field_key),
  );
  CURRENT_PM_BASELINE_FIELD_KEYS.forEach((key) => {
    assert.equal(keys.has(key), true, key);
  });
  assert.equal(keys.has('process_outcome'), true);
  assert.equal(keys.has('process_phase'), true);
  assert.equal(keys.has('bidder_track'), true);
  assert.equal(manifest.source_exclusions.length, 0);
  assert.equal(manifest.release_exclusions.length, 0);
});

test('fails closed on incomplete or non-digest release input', () => {
  assert.throws(
    () => buildPilotProductFieldCatalogueManifest({}),
    /release binding fields are invalid/,
  );
});
