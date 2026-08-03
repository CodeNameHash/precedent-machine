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
  'REPRESENTATIONS',
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

test('M3 parity register covers every Wave A family design and every product source kind', () => {
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
  assert.equal(CURRENT_M3_FAMILY_PARITY_STATUS.family_states.length, 21);
  assert.equal(
    CURRENT_M3_FAMILY_PARITY_STATUS.family_states.find(
      (family) => family.family_id === 'NO_SHOP',
    ).completion_state,
    'FAMILY_COMPLETE',
  );
  assert.equal(
    CURRENT_M3_FAMILY_PARITY_STATUS.family_states.find(
      (family) => family.family_id === 'MAE_DEFINITION',
    ).completion_state,
    'FAMILY_COMPLETE',
  );
  assert.equal(
    CURRENT_M3_FAMILY_PARITY_STATUS.family_states.find(
      (family) => family.family_id === 'PROXY_MEETING_COVENANTS',
    ).completion_state,
    'FAMILY_COMPLETE',
  );
  assert.equal(
    CURRENT_M3_FAMILY_PARITY_STATUS.family_states.find(
      (family) => family.family_id === 'ANTITRUST_REGULATORY_EFFORTS',
    ).completion_state,
    'FAMILY_COMPLETE',
  );
  const consideration = CURRENT_M3_FAMILY_PARITY_STATUS.family_states.find(
    (family) => family.family_id === 'CONSIDERATION',
  );
  assert.equal(consideration.completion_state, 'FAMILY_COMPLETE');
  assert.ok(CURRENT_M3_FAMILY_PARITY_STATUS.family_states
    .filter((family) => ![
      'ANTITRUST_REGULATORY_EFFORTS', 'NO_SHOP', 'MAE_DEFINITION',
      'CLOSING_CONDITIONS',
      'PROXY_MEETING_COVENANTS', 'MERGER_STRUCTURE_CLOSING', 'MISC_BOILERPLATE',
      'REPRESENTATIONS', 'SPECIFIC_PERFORMANCE_REMEDIES', 'TERMINATION_FEE', 'TERMINATION_RIGHTS',
      'EMPLOYEE_MATTERS', 'DNO_INDEMNIFICATION',
      'FINANCING_COVENANTS', 'GUARANTY_FINANCING_PARTY',
      'TAX_MATTERS', 'DIVIDENDS', 'APPRAISAL_DISSENTERS_RIGHTS',
      'CONSIDERATION', 'INTERIM_OPERATING_COVENANTS',
    ].includes(family.family_id))
    .every((family) => family.completion_state === 'WAVE_A_OPEN'));
  for (const familyId of [
    'TERMINATION_FEE',
    'TERMINATION_RIGHTS',
  ]) {
    assert.equal(
      CURRENT_M3_FAMILY_PARITY_STATUS.family_states.find(
        (family) => family.family_id === familyId,
      ).completion_state,
      'FOLLOW_ON_OPEN',
    );
  }
  assert.equal(CURRENT_M3_FAMILY_PARITY_STATUS.unassigned_product_surface_ids.length, 0);
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

test('recorded Proxy and Meeting rulings are implemented on the exact adopted follow-on surfaces', () => {
  const family = CURRENT_M3_FAMILY_PARITY_REGISTER.families.find(
    (entry) => entry.family_id === 'PROXY_MEETING_COVENANTS',
  );
  assert.deepEqual(
    family.product_surfaces
      .filter((surface) => surface.surface_id.startsWith('proxy-') && surface.source_kind === 'SIDE_TABLE')
      .map((surface) => surface.surface_id),
    [
      'proxy-record-date-broker-search-presence',
      'proxy-parent-merger-sub-approval-split',
      'proxy-adjournment-grounded-reasons',
    ],
  );
  assert.ok(family.product_surfaces
    .filter((surface) => surface.source_kind === 'SIDE_TABLE')
    .every((surface) => surface.state === 'PASS' && surface.disposition === 'NATIVE_COMPLETE'));
});

test('parity blocker inventory is exact and never treats open-world evidence as semantic completion', () => {
  const blockers = listM3ProductParityBlockers(CURRENT_M3_FAMILY_PARITY_REGISTER);
  assert.ok(blockers.length > 0);
  assert.ok(blockers.every((blocker) => blocker.semantic_completion === false));
  assert.equal(blockers.some((blocker) => blocker.disposition === 'UNASSIGNED'), false);
  assert.ok(blockers.some((blocker) => blocker.disposition === 'FOLLOW_ON_REQUIRED'));
  assert.deepEqual(
    blockers.map((blocker) => blocker.surface_id),
    [...blockers.map((blocker) => blocker.surface_id)].sort(),
  );
  assert.deepEqual(listM3ProductParityBlockers(completedRegister()), []);
});

test('Consideration Wave A is native and its remaining mechanics are exact evidence-only products', () => {
  const family = CURRENT_M3_FAMILY_PARITY_REGISTER.families.find(
    (entry) => entry.family_id === 'CONSIDERATION',
  );
  assert.equal(family.wave_a.checks.fixture_proof.state, 'PASS');
  assert.ok(family.wave_a.checks.fixture_proof.evidence_paths.includes('tests/canonical-v2-consideration-ioc-product-parity.test.js'));
  assert.ok(Object.values(family.wave_a.checks).every((check) => check.state === 'PASS'));
  for (const surfaceId of [
    'consideration-rendered-rows',
    'consideration-market-fields',
    'consideration-query-fields',
  ]) {
    const surface = family.product_surfaces.find((entry) => entry.surface_id === surfaceId);
    assert.equal(surface.state, 'PASS');
    assert.equal(surface.disposition, 'NATIVE_COMPLETE');
    assert.ok(surface.evidence_paths.includes('lib/canonical-v2/consideration-wave-a-product-projection.js'));
  }
  for (const surfaceId of [
    'equity-awards-rendered-rows', 'consideration-side-tables',
    'consideration-election-summary', 'consideration-election-deadline',
    'consideration-wave-b-market-fields', 'consideration-equity-market-fields',
    'consideration-wave-b-query-fields',
  ]) {
    const surface = family.product_surfaces.find((entry) => entry.surface_id === surfaceId);
    assert.equal(surface.state, 'PASS');
    assert.equal(surface.disposition, 'EVIDENCE_ONLY');
    assert.ok(surface.evidence_paths.includes('lib/canonical-v2/consideration-ioc-evidence-product-projection.js'));
  }
});

test('IOC governed presence claims pass while long-tail mechanics remain exact evidence-only', () => {
  const family = CURRENT_M3_FAMILY_PARITY_REGISTER.families.find(
    (entry) => entry.family_id === 'INTERIM_OPERATING_COVENANTS',
  );
  assert.equal(family.wave_a.checks.fixture_proof.state, 'PASS');
  assert.ok(family.wave_a.checks.fixture_proof.evidence_paths.includes('tests/canonical-v2-consideration-ioc-product-parity.test.js'));
  assert.ok(Object.values(family.wave_a.checks).every((check) => check.state === 'PASS'));
  for (const surfaceId of ['ioc-rendered-rows', 'ioc-market-fields', 'ioc-query-fields']) {
    const surface = family.product_surfaces.find((entry) => entry.surface_id === surfaceId);
    assert.equal(surface.state, 'PASS');
    assert.equal(surface.disposition, 'NATIVE_COMPLETE');
    assert.ok(surface.evidence_paths.includes('lib/canonical-v2/ioc-wave-a-product-projection.js'));
  }
  for (const surfaceId of [
    'ioc-remaining-rendered-mechanics',
    'ioc-remaining-compare-mechanics',
    'ioc-remaining-query-mechanics',
  ]) {
    const surface = family.product_surfaces.find((entry) => entry.surface_id === surfaceId);
    assert.equal(surface.state, 'PASS');
    assert.equal(surface.disposition, 'EVIDENCE_ONLY');
    assert.ok(surface.evidence_paths.includes('lib/canonical-v2/consideration-ioc-evidence-product-projection.js'));
  }
});

test('approved Key Defined Terms are native while the remaining definition universe stays open', () => {
  const keyTerms = CURRENT_M3_FAMILY_PARITY_REGISTER.families.find(
    (family) => family.family_id === 'KEY_DEFINED_TERMS',
  );
  const mae = CURRENT_M3_FAMILY_PARITY_REGISTER.families.find(
    (family) => family.family_id === 'MAE_DEFINITION',
  );
  assert.ok(keyTerms.product_surfaces.every(
    (surface) => surface.state === 'PASS' && surface.disposition === 'NATIVE_COMPLETE',
  ));
  assert.ok(mae.product_surfaces.every(
    (surface) => surface.state === 'PASS' && surface.disposition === 'NATIVE_COMPLETE',
  ));
  assert.equal(keyTerms.wave_a.checks.resolver.state, 'PASS');
  assert.equal(keyTerms.wave_a.checks.lexical_net.state, 'OPEN');
  assert.ok(keyTerms.wave_a.checks.resolver.evidence_paths.includes(
    'lib/canonical-v2/native-producer/candidate-resolution.js',
  ));
  assert.ok(Object.values(mae.wave_a.checks).every((check) => check.state === 'PASS'));
});

test('the defined-term disposition audit covers every recurring production population', () => {
  const audit = fs.readFileSync(
    path.join(ROOT, 'docs/codex-program/m3-defined-term-disposition-audit-2026-08-03.md'),
    'utf8',
  );
  for (const subtype of [
    'DEF-GENERAL', 'DEF-EQUITYAWARD', 'DEF-LAW', 'DEF-GOVAUTH', 'DEF-CONTRACT',
    'DEF-BENEFITPLAN', 'DEF-INDEBTEDNESS', 'DEF-MERGERCONSID', 'DEF-INTERP',
    'DEF-AFFILIATE', 'DEF-SUBSIDIARY', 'DEF-MAE', 'DEF-PERSON', 'DEF-TAX',
    'DEF-DISCLOSURELETTER', 'DEF-COMPANYEMPLOYEE', 'DEF-ACQPROPOSAL', 'DEF-PERMIT',
    'DEF-COMPANY', 'DEF-REQUIREDAPPROVAL', 'DEF-REPRESENTATIVE', 'DEF-BUSINESSDAY',
    'DEF-TAXRETURN', 'DEF-SUPERIOR', 'DEF-KNOWLEDGE', 'DEF-PERMITLIEN', 'DEF-LIEN',
    'DEF-MATCONTRACT', 'DEF-WILLFUL', 'DEF-INTERVENING', 'NOSOL-SUPERIOR',
    'NOSOL-ACQPROPOSAL', 'DEF-MADE-AVAILABLE', 'DEF-DISSENTING', 'NOSOL-INTERVENING',
    'REP-T-TAX', 'DEF-ORDINARY',
  ]) {
    assert.match(audit, new RegExp(`\\b${subtype.replaceAll('-', '\\-')}\\b`));
  }
  assert.match(audit, /5,731 cards/);
  assert.match(audit, /Concept scope is not approved/);
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
  const openAsPass = completedRegister();
  const openSurface = openAsPass.families[0].product_surfaces[0];
  openSurface.state = 'OPEN';
  openSurface.disposition = 'FOLLOW_ON_REQUIRED';
  openSurface.evidence_paths = [];
  openSurface.state = 'PASS';
  openSurface.evidence_paths = [openSurface.source_path];
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

test('Antitrust is complete once the real litigation quote coverage map is committed', () => {
  const family = CURRENT_M3_FAMILY_PARITY_REGISTER.families
    .find((entry) => entry.family_id === 'ANTITRUST_REGULATORY_EFFORTS');
  assert.equal(family.wave_a.checks.fixture_proof.state, 'PASS');
  assert.ok(family.wave_a.checks.fixture_proof.evidence_paths.includes('tests/fixtures/canonical-v2/antitrust-regulatory-live-run/coverage-map.json'));
  assert.ok(family.product_surfaces.every((surface) => surface.state === 'PASS'));
  assert.equal(
    CURRENT_M3_FAMILY_PARITY_STATUS.family_states
      .find((entry) => entry.family_id === family.family_id).completion_state,
    'FAMILY_COMPLETE',
  );
});

test('Financing Covenants and Guaranty are fully governed while their follow-on surfaces remain separately recorded', () => {
  for (const familyId of ['FINANCING_COVENANTS', 'GUARANTY_FINANCING_PARTY']) {
    const family = CURRENT_M3_FAMILY_PARITY_REGISTER.families
      .find((entry) => entry.family_id === familyId);
    assert.ok(family, familyId);
    assert.ok(family.product_surfaces.every((surface) => (
      surface.state === 'PASS' && surface.disposition === 'NATIVE_COMPLETE'
    )));
    assert.equal(family.wave_a.checks.producer.state, 'PASS');
    assert.equal(family.wave_a.checks.fixture_proof.state, 'PASS');
    assert.equal(family.wave_a.checks.lexical_net.state, 'PASS');
    assert.equal(family.wave_a.checks.registry.state, 'PASS');
    assert.equal(family.wave_a.checks.resolver.state, 'PASS');
    assert.equal(
      CURRENT_M3_FAMILY_PARITY_STATUS.family_states
        .find((entry) => entry.family_id === familyId).completion_state,
      'FAMILY_COMPLETE',
    );
  }
});

test('Tax Matters, Dividends and Appraisal product parity closes with adjacent-owner surfaces retired', () => {
  const expectedRetired = {
    APPRAISAL_DISSENTERS_RIGHTS: [
      'appraisal-condition-row', 'appraisal-consideration-row', 'appraisal-query-intent',
    ],
    DIVIDENDS: ['dividends-generic-ioc-row', 'dividends-query-registry'],
    TAX_MATTERS: ['tax-generic-covenant-row', 'tax-query-registry', 'tax-withholding-market-field'],
  };
  for (const [familyId, retiredIds] of Object.entries(expectedRetired)) {
    const family = CURRENT_M3_FAMILY_PARITY_REGISTER.families
      .find((entry) => entry.family_id === familyId);
    assert.ok(family, familyId);
    assert.ok(family.product_surfaces.every((surface) => surface.state === 'PASS'));
    assert.deepEqual(
      family.product_surfaces
        .filter((surface) => surface.disposition === 'APPROVED_RETIRED')
        .map((surface) => surface.surface_id)
        .sort(),
      retiredIds,
    );
    assert.ok(family.product_surfaces.some((surface) => surface.disposition === 'NATIVE_COMPLETE'));
    assert.equal(
      CURRENT_M3_FAMILY_PARITY_STATUS.family_states
        .find((entry) => entry.family_id === familyId).completion_state,
      'FAMILY_COMPLETE',
    );
  }
});

test('Merger Structure and Closing Mechanics product parity is native-complete with transaction steps distinct', () => {
  const family = CURRENT_M3_FAMILY_PARITY_REGISTER.families
    .find((entry) => entry.family_id === 'MERGER_STRUCTURE_CLOSING');
  assert.ok(family);
  assert.ok(family.product_surfaces.every((surface) => (
    surface.state === 'PASS' && surface.disposition === 'NATIVE_COMPLETE'
  )));
  const transactionSteps = family.product_surfaces
    .find((surface) => surface.surface_id === 'structure-transaction-steps');
  assert.equal(transactionSteps.source_kind, 'SIDE_TABLE');
  assert.equal(transactionSteps.source_path, 'pages/api/provisions.js');
  assert.equal(family.wave_a.checks.producer.state, 'PASS');
  assert.equal(family.wave_a.checks.registry.state, 'PASS');
  assert.equal(family.wave_a.checks.fixture_proof.state, 'PASS');
  assert.equal(family.wave_a.checks.lexical_net.state, 'PASS');
  assert.equal(family.wave_a.checks.resolver.state, 'PASS');
  assert.equal(
    CURRENT_M3_FAMILY_PARITY_STATUS.family_states
      .find((entry) => entry.family_id === family.family_id).completion_state,
    'FAMILY_COMPLETE',
  );
});
