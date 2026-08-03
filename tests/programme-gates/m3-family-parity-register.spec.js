'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  CURRENT_M3_FAMILY_PARITY_REGISTER,
  CURRENT_M3_FAMILY_PARITY_STATUS,
  M3FamilyParityRegisterError,
  SOURCE_KINDS,
  STATUS_SCHEMA,
  buildM3FamilyParityStatus,
  listM3ProductParityBlockers,
  validateM3FamilyParityRegister,
  validateM3FamilyParityStatus,
} = require('../../lib/canonical-v2/native-producer/m3-family-parity-register');
const { contentId } = require('../../lib/canonical-v2/canonical-bytes');

const ROOT = path.resolve(__dirname, '../..');
const EXPECTED_FAMILIES = Object.freeze([
  'ANTITRUST_REGULATORY_EFFORTS',
  'APPRAISAL_DISSENTERS_RIGHTS',
  'CLOSING_CONDITIONS',
  'CONSIDERATION',
  'DIVIDENDS',
  'DNO_INDEMNIFICATION',
  'EMPLOYEE_MATTERS',
  'FINANCING_COVENANTS',
  'GUARANTY_FINANCING_PARTY',
  'INTERIM_OPERATING_COVENANTS',
  'KEY_DEFINED_TERMS',
  'MAE_DEFINITION',
  'MERGER_STRUCTURE_CLOSING',
  'MISC_BOILERPLATE',
  'NO_SHOP',
  'PROXY_MEETING_COVENANTS',
  'SPECIFIC_PERFORMANCE_REMEDIES',
  'TAX_MATTERS',
  'TERMINATION_FEE',
  'TERMINATION_RIGHTS',
]);

function allSurfaces(register) {
  return [
    ...register.families.flatMap((family) => family.product_surfaces),
    ...register.supplemental_owners.flatMap((owner) => owner.product_surfaces),
    ...register.unassigned_product_surfaces,
  ];
}

function completedRegister() {
  const register = structuredClone(CURRENT_M3_FAMILY_PARITY_REGISTER);
  register.unassigned_product_surfaces = [];
  for (const family of register.families) {
    for (const check of Object.values(family.wave_a.checks)) {
      check.state = 'PASS';
      check.evidence_paths = [family.design_path];
    }
    for (const surface of family.product_surfaces) {
      surface.state = 'PASS';
      surface.disposition = 'NATIVE_COMPLETE';
      surface.evidence_paths = [surface.source_path];
    }
  }
  for (const owner of register.supplemental_owners) {
    owner.first_slice.state = 'PASS';
    if (!owner.first_slice.evidence_paths.length) owner.first_slice.evidence_paths = [owner.ownership_path];
    for (const surface of owner.product_surfaces) {
      surface.state = 'PASS';
      surface.disposition = 'NATIVE_COMPLETE';
      surface.evidence_paths = [surface.source_path];
    }
  }
  return register;
}

test('M3 parity register covers the exact 20 Wave A family designs and every product source kind', () => {
  validateM3FamilyParityRegister(CURRENT_M3_FAMILY_PARITY_REGISTER);
  assert.deepEqual(
    CURRENT_M3_FAMILY_PARITY_REGISTER.families.map((family) => family.family_id),
    EXPECTED_FAMILIES,
  );
  assert.deepEqual(
    [...new Set(allSurfaces(CURRENT_M3_FAMILY_PARITY_REGISTER)
      .map((surface) => surface.source_kind))].sort(),
    [...SOURCE_KINDS],
  );
  for (const family of CURRENT_M3_FAMILY_PARITY_REGISTER.families) {
    assert.equal(family.wave_a.scope, 'FIRST_NATIVE_SLICE');
    assert.ok(fs.existsSync(path.join(ROOT, family.design_path)), family.design_path);
  }
  assert.equal(CURRENT_M3_FAMILY_PARITY_REGISTER.supplemental_owners.length, 3);
});

test('every registered product surface points to an existing source and an exact locator', () => {
  for (const surface of allSurfaces(CURRENT_M3_FAMILY_PARITY_REGISTER)) {
    const sourcePath = path.join(ROOT, surface.source_path);
    assert.ok(fs.existsSync(sourcePath), `${surface.surface_id}: ${surface.source_path}`);
    assert.ok(
      fs.readFileSync(sourcePath, 'utf8').includes(surface.source_locator),
      `${surface.surface_id}: locator ${surface.source_locator} is absent from ${surface.source_path}`,
    );
  }
});

test('every review-v2 table configuration is assigned or recorded as an unassigned blocker', () => {
  const source = fs.readFileSync(path.join(ROOT, 'components/review-v2/sectionList.js'), 'utf8');
  const importedConfigPaths = [...source.matchAll(/from '\.\.\/review\/table-configs\/([^']+)'/g)]
    .map((match) => `components/review/table-configs/${match[1]}.js`)
    .filter((sourcePath) => sourcePath.endsWith('.config.js'));
  const registeredPaths = new Set(allSurfaces(CURRENT_M3_FAMILY_PARITY_REGISTER)
    .filter((surface) => surface.source_kind === 'RENDERED_ROW')
    .map((surface) => surface.source_path));
  assert.deepEqual(
    [...new Set(importedConfigPaths.filter((sourcePath) => !registeredPaths.has(sourcePath)))],
    [],
  );
});

test('Wave A completion cannot hide open follow-on or unassigned product work', () => {
  assert.ok(Object.isFrozen(CURRENT_M3_FAMILY_PARITY_REGISTER.families[0].wave_a.checks));
  assert.equal(CURRENT_M3_FAMILY_PARITY_STATUS.state, 'BLOCKED');
  assert.equal(CURRENT_M3_FAMILY_PARITY_STATUS.family_states.length, 20);
  assert.ok(CURRENT_M3_FAMILY_PARITY_STATUS.family_states.every(
    (family) => family.completion_state === 'WAVE_A_OPEN',
  ));
  assert.equal(CURRENT_M3_FAMILY_PARITY_STATUS.unassigned_product_surface_ids.length, 2);
  assert.deepEqual(
    CURRENT_M3_FAMILY_PARITY_REGISTER.supplemental_owners.map((owner) => owner.first_slice.state),
    ['PASS', 'PASS', 'PASS'],
  );

  const waveAOnly = completedRegister();
  waveAOnly.families[0].product_surfaces[0].state = 'OPEN';
  waveAOnly.families[0].product_surfaces[0].disposition = 'FOLLOW_ON_REQUIRED';
  waveAOnly.families[0].product_surfaces[0].evidence_paths = [];
  const waveAOnlyStatus = buildM3FamilyParityStatus(waveAOnly);
  assert.equal(waveAOnlyStatus.state, 'BLOCKED');
  assert.equal(waveAOnlyStatus.family_states[0].completion_state, 'FOLLOW_ON_OPEN');

  const complete = buildM3FamilyParityStatus(completedRegister());
  assert.equal(complete.state, 'FAMILY_COMPLETE');
  assert.ok(complete.family_states.every((family) => family.completion_state === 'FAMILY_COMPLETE'));
});

test('parity blocker inventory is exact and never treats open-world evidence as semantic completion', () => {
  const blockers = listM3ProductParityBlockers(CURRENT_M3_FAMILY_PARITY_REGISTER);
  assert.ok(blockers.length > 0);
  assert.ok(blockers.every((blocker) => blocker.semantic_completion === false));
  assert.ok(blockers.some((blocker) => blocker.disposition === 'UNASSIGNED'));
  assert.ok(blockers.some((blocker) => blocker.disposition === 'FOLLOW_ON_REQUIRED'));
  assert.deepEqual(
    blockers.map((blocker) => blocker.surface_id),
    [...blockers.map((blocker) => blocker.surface_id)].sort(),
  );
  assert.deepEqual(listM3ProductParityBlockers(completedRegister()), []);
});

test('a rehashed complete label cannot contradict open family state', () => {
  const forged = structuredClone(CURRENT_M3_FAMILY_PARITY_STATUS);
  forged.state = 'FAMILY_COMPLETE';
  const { m3_family_parity_status_id: _oldId, ...body } = forged;
  forged.m3_family_parity_status_id = contentId(STATUS_SCHEMA, body);
  assert.throws(
    () => validateM3FamilyParityStatus(forged),
    (error) => error instanceof M3FamilyParityRegisterError
      && error.code === 'INVALID_PARITY_STATUS',
  );
});

test('an open follow-on cannot be relabelled PASS and PASS requires evidence', () => {
  const openAsPass = structuredClone(CURRENT_M3_FAMILY_PARITY_REGISTER);
  openAsPass.families[0].product_surfaces[0].state = 'PASS';
  openAsPass.families[0].product_surfaces[0].evidence_paths = [
    openAsPass.families[0].product_surfaces[0].source_path,
  ];
  assert.throws(
    () => validateM3FamilyParityRegister(openAsPass),
    (error) => error instanceof M3FamilyParityRegisterError
      && error.code === 'OPEN_FOLLOW_ON_CANNOT_PASS',
  );

  const noEvidence = completedRegister();
  noEvidence.families[0].product_surfaces[0].evidence_paths = [];
  assert.throws(
    () => validateM3FamilyParityRegister(noEvidence),
    (error) => error instanceof M3FamilyParityRegisterError
      && error.code === 'UNSUPPORTED_PARITY_PASS',
  );
});

test('the M3 register has no production-import or cutover authority', () => {
  const source = JSON.stringify(CURRENT_M3_FAMILY_PARITY_REGISTER);
  assert.doesNotMatch(source, /PRODUCTION_IMPORT|PRODUCTION_CUTOVER|M4_PRE_CUTOVER/);
});
