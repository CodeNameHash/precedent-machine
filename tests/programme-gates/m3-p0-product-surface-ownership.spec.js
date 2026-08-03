'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  CURRENT_P0_PRODUCT_SURFACE_OWNERSHIP,
  GENERAL_COVENANT_DEDICATED_OWNERS,
  GENERAL_COVENANT_FOLLOW_ON_OWNERS,
  P0ProductSurfaceOwnershipError,
  routeGeneralCovenantCode,
  validateP0ProductSurfaceOwnership,
} = require('../../lib/canonical-v2/native-producer/p0-product-surface-ownership');
const {
  CURRENT_M3_FAMILY_PARITY_REGISTER,
} = require('../../lib/canonical-v2/native-producer/m3-family-parity-register');

const ROOT = path.resolve(__dirname, '../..');

test('the three P0 surfaces have explicit owners, source inventories, counts and examples', () => {
  validateP0ProductSurfaceOwnership(CURRENT_P0_PRODUCT_SURFACE_OWNERSHIP);
  assert.deepEqual(
    CURRENT_P0_PRODUCT_SURFACE_OWNERSHIP.owners.map((owner) => owner.owner_id),
    ['MATERIAL_CONTRACTS', 'NO_OTHER_REPS_FRAUD', 'GENERAL_COVENANT_ROUTER'],
  );
  for (const owner of CURRENT_P0_PRODUCT_SURFACE_OWNERSHIP.owners) {
    assert.equal(owner.first_slice.state, 'IMPLEMENTED');
    assert.ok(owner.corpus.card_count > 0);
    assert.ok(owner.corpus.deal_count > 0);
    assert.ok(owner.corpus.examples.length >= 2);
    for (const source of owner.source_inventory) {
      const sourcePath = path.join(ROOT, source.source_path);
      assert.ok(fs.existsSync(sourcePath), source.source_path);
      assert.ok(fs.readFileSync(sourcePath, 'utf8').includes(source.source_locator), source.source_locator);
    }
    for (const evidencePath of owner.first_slice.evidence_paths) {
      assert.ok(fs.existsSync(path.join(ROOT, evidencePath)), evidencePath);
    }
  }
});

test('the M3 register records every P0 and representations surface under an explicit owner', () => {
  assert.deepEqual(
    CURRENT_M3_FAMILY_PARITY_REGISTER.supplemental_owners.map((owner) => owner.owner_id),
    ['MATERIAL_CONTRACTS', 'NO_OTHER_REPS_FRAUD', 'GENERAL_COVENANT_ROUTER'],
  );
  assert.deepEqual(
    CURRENT_M3_FAMILY_PARITY_REGISTER.unassigned_product_surfaces.map((surface) => surface.surface_id),
    [],
  );
});

test('every exact COV taxonomy code routes to a dedicated family or a named narrow follow-on owner', () => {
  const rubric = fs.readFileSync(path.join(ROOT, 'lib/rubric.js'), 'utf8');
  const rubricCodes = [...new Set(
    [...rubric.matchAll(/^  '(COV-[A-Z0-9-]+)':/gm)].map((match) => match[1]),
  )].sort();
  const governedCodes = [
    ...Object.keys(GENERAL_COVENANT_DEDICATED_OWNERS),
    ...Object.keys(GENERAL_COVENANT_FOLLOW_ON_OWNERS),
  ].sort();
  assert.deepEqual(governedCodes, rubricCodes);
  for (const code of rubricCodes) {
    const route = routeGeneralCovenantCode(code);
    assert.notEqual(route.owner_id, 'GENERAL_COVENANTS');
    assert.notEqual(route.route_state, 'REVIEW_REQUIRED');
  }
  assert.deepEqual(routeGeneralCovenantCode(null), {
    code: null,
    owner_id: 'UNTYPED_GENERAL_COVENANT_REVIEW',
    route_state: 'REVIEW_REQUIRED',
  });
  assert.equal(routeGeneralCovenantCode('COV-NEW').route_state, 'REVIEW_REQUIRED');
});

test('an incomplete source inventory cannot be relabelled as governed ownership', () => {
  const forged = structuredClone(CURRENT_P0_PRODUCT_SURFACE_OWNERSHIP);
  forged.owners[0].source_inventory = forged.owners[0].source_inventory.filter(
    (source) => source.source_kind !== 'MARKET_FIELD',
  );
  assert.throws(
    () => validateP0ProductSurfaceOwnership(forged),
    (error) => error instanceof P0ProductSurfaceOwnershipError
      && error.code === 'INCOMPLETE_P0_SOURCE_INVENTORY',
  );
});
