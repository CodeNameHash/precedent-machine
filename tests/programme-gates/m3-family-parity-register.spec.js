'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  CURRENT_M3_FAMILY_PARITY_REGISTER,
  CURRENT_M3_FAMILY_PARITY_STATUS,
  REGISTER_SEMANTICS,
  SOURCE_KINDS,
  buildM3FamilyParityStatus,
  consumerExecutesAdapter,
  isNativeSemanticCompletion,
  legacyProductVisibility,
  listM3ProductParityBlockers,
  liveProductVisibility,
  validateM3FamilyParityRegister,
} = require('../../lib/canonical-v2/native-producer/m3-family-parity-register');

function family(id) {
  return CURRENT_M3_FAMILY_PARITY_REGISTER.families.find((entry) => entry.family_id === id);
}

function surface(id) {
  return [
    ...CURRENT_M3_FAMILY_PARITY_REGISTER.families.flatMap((entry) => entry.product_surfaces),
    ...CURRENT_M3_FAMILY_PARITY_REGISTER.supplemental_owners.flatMap((entry) => entry.product_surfaces),
  ].find((entry) => entry.surface_id === id);
}

test('V3 register validates every evidence path and expands the source-kind universe for compare fields', () => {
  validateM3FamilyParityRegister(CURRENT_M3_FAMILY_PARITY_REGISTER);
  assert.equal(CURRENT_M3_FAMILY_PARITY_REGISTER.schema, 'CANONICAL_V2_M3_FAMILY_PARITY_REGISTER/V3');
  assert.deepEqual(CURRENT_M3_FAMILY_PARITY_REGISTER.semantics, REGISTER_SEMANTICS);
  assert.ok(SOURCE_KINDS.includes('COMPARE_FIELD'));
  assert.ok(surface('material-contracts-compare-field'));
  assert.ok(surface('no-other-reps-compare-field'));
  assert.ok(surface('general-covenants-compare-field'));
});

test('V3 separates approved scope from current visibility and never treats evidence-only material as semantic completion', () => {
  const evidenceOnly = surface('consideration-election-summary');
  assert.equal(evidenceOnly.disposition, 'EVIDENCE_ONLY');
  assert.equal(liveProductVisibility(evidenceOnly), 'EVIDENCE_VISIBLE');
  assert.equal(isNativeSemanticCompletion(evidenceOnly), false);

  const retired = surface('tax-query-registry');
  assert.equal(retired.disposition, 'APPROVED_RETIRED');
  assert.equal(liveProductVisibility(retired), 'RETIRED_NOT_RENDERED');
  assert.equal(isNativeSemanticCompletion(retired), true);
});

test('test-only and self-referential native proof are blocked from clearing product parity', () => {
  const testOnly = surface('appraisal-governed-review');
  assert.equal(liveProductVisibility(testOnly), 'NATIVE_UNVERIFIED');
  assert.equal(isNativeSemanticCompletion(testOnly), false);

  const blockers = listM3ProductParityBlockers(CURRENT_M3_FAMILY_PARITY_REGISTER);
  assert.ok(blockers.some((entry) => entry.surface_id === 'appraisal-governed-review'));
  assert.ok(!blockers.some((entry) => entry.surface_id === 'consideration-election-summary'));
  assert.equal(CURRENT_M3_FAMILY_PARITY_STATUS.state, 'BLOCKED');
});

// Ruling 2 (Ben, 2026-08-05). Proof must resolve the complete specifier to the exact
// repository path and to the exported symbol actually executed.
test('ruling 2: consumer proof resolves the exact path and executed export, never a basename', () => {
  const covenants = 'components/review/table-configs/general-covenants.config.js';
  const realAdapter = 'lib/canonical-v2/p0-product-surface-routing.js';

  // Real pair: the config imports the adapter and destructures two of its exports.
  assert.equal(consumerExecutesAdapter(covenants, realAdapter), true);

  // Same basename, different directory, and no such file. Basename matching would have
  // accepted this; exact specifier resolution must not.
  assert.equal(consumerExecutesAdapter(covenants, 'lib/p0-product-surface-routing.js'), false);

  // A module the consumer never imports.
  assert.equal(
    consumerExecutesAdapter(covenants, 'lib/canonical-v2/no-other-reps-fraud-product-projection.js'),
    false,
  );

  // Test-only and docs paths can never be serving consumers.
  assert.equal(consumerExecutesAdapter('tests/canonical-v2-guaranty.test.js', realAdapter), false);

  // Other genuinely served pairs still resolve, so the stricter rule did not over-fence.
  assert.equal(consumerExecutesAdapter(
    'components/review/table-configs/sec-meeting.config.js',
    'lib/canonical-v2/proxy-meeting-product-coverage.js',
  ), true);
  assert.equal(consumerExecutesAdapter(
    'components/review/table-configs/termination-fees.config.js',
    'lib/termf.js',
  ), true);
});

// Ruling 1 (Ben, 2026-08-05). Every named adapter needs its own proof; only an express
// ALTERNATIVES marking accepts one.
test('ruling 1: a surface naming several adapters needs proof for each one', () => {
  const base = {
    surface_id: 'ruling-1-probe',
    source_kind: 'RENDERED_ROW',
    source_path: 'components/review/table-configs/general-covenants.config.js',
    source_locator: 'generalCovenantsConfig',
    state: 'PASS',
    disposition: 'NATIVE_COMPLETE',
    wave: 'FOLLOW_ON',
    evidence_paths: [
      'components/review/table-configs/general-covenants.config.js',
      'lib/canonical-v2/p0-product-surface-routing.js',
      'lib/canonical-v2/no-other-reps-fraud-product-projection.js',
    ],
  };

  // One adapter is genuinely consumed, the other is not. Default is fail closed.
  assert.equal(liveProductVisibility(base), 'NATIVE_UNVERIFIED');
  assert.equal(isNativeSemanticCompletion(base), false);

  // The express marking accepts the single proven adapter, and the proven consumer is
  // reachable from a served review route, so it reads as visible.
  const alternatives = { ...base, adapter_set: 'ALTERNATIVES' };
  assert.equal(liveProductVisibility(alternatives), 'NATIVE_VISIBLE');
  assert.equal(isNativeSemanticCompletion(alternatives), true);

  // Dropping the unproven adapter leaves a single required adapter, which is proven.
  const single = { ...base, evidence_paths: base.evidence_paths.slice(0, 2) };
  assert.equal(liveProductVisibility(single), 'NATIVE_VISIBLE');

  // Only the express value is accepted by the register contract.
  const forged = structuredClone(CURRENT_M3_FAMILY_PARITY_REGISTER);
  forged.families[0].product_surfaces[0].adapter_set = 'ANY_ONE';
  assert.throws(() => validateM3FamilyParityRegister(forged), (error) => (
    error.code === 'INVALID_PARITY_REGISTER'
  ));
});

// An adversarial audit found that naming any proven adapter/consumer pair in
// evidence_paths used to clear any surface, because the required set was replaced rather
// than bound to the surface. 59 of 104 blockers were clearable by a register-only edit.
test('a proven adapter and consumer pair from elsewhere cannot clear an unrelated surface', () => {
  const everySurface = [
    ...CURRENT_M3_FAMILY_PARITY_REGISTER.families.flatMap((entry) => entry.product_surfaces),
    ...CURRENT_M3_FAMILY_PARITY_REGISTER.supplemental_owners.flatMap((entry) => entry.product_surfaces),
  ];
  // lib/canonical-v2/feature-flags.js is genuinely executed by pages/index.js, so this is
  // a real proven pair. It is unrelated to any of these surfaces and must prove nothing.
  const skeletonKey = ['lib/canonical-v2/feature-flags.js', 'pages/index.js'];

  let attacked = 0;
  for (const surface of everySurface) {
    const before = liveProductVisibility(surface);
    if (before !== 'NATIVE_UNVERIFIED' && before !== 'NOT_VISIBLE') continue;
    attacked += 1;
    for (const evidencePaths of [[...surface.evidence_paths, ...skeletonKey], [...skeletonKey]]) {
      const forged = { ...structuredClone(surface), evidence_paths: evidencePaths };
      assert.equal(
        isNativeSemanticCompletion(forged),
        false,
        `${surface.surface_id} was cleared by an unrelated proven pair`,
      );
    }
  }
  // >= 99, not >= 100: termination-fee-query-fields left the NATIVE_UNVERIFIED/NOT_VISIBLE
  // pool on 2026-08-05 (docs/codex-program/notes/compare-locator-fix.md), a real, attributed
  // movement, not a loosening of this loose lower bound.
  assert.ok(attacked >= 99, `expected the whole blocker inventory to be attacked, got ${attacked}`);
});

test('a page behind the design route guard is not a served entry point', () => {
  // pages/design/* answers notFound in production, so it must not lend serving proof.
  const guarded = {
    surface_id: 'design-entry-probe',
    source_kind: 'RENDERED_ROW',
    source_path: 'pages/design/canonical-v2.js',
    source_locator: 'contentId',
    state: 'PASS',
    disposition: 'NATIVE_COMPLETE',
    wave: 'FOLLOW_ON',
    evidence_paths: ['pages/design/canonical-v2.js', 'lib/canonical-v2/query-result.js'],
  };
  assert.equal(liveProductVisibility(guarded), 'NATIVE_INTEGRATED_NOT_SERVED');
  assert.equal(isNativeSemanticCompletion(guarded), false);
});

test('an import into a contained route proves integration, not serving', () => {
  // pages/api/query/* answer the 503 ROUTE_CONTAINED handler, so lib/query/ derivations
  // reach no user even though lib/query/natural-language.js really does require them.
  const queryDerived = surface('termination-fee-query-derived-values');
  assert.equal(queryDerived.state, 'PASS');
  assert.equal(queryDerived.disposition, 'APPROVED_DERIVED');
  assert.equal(liveProductVisibility(queryDerived), 'DERIVED_INTEGRATED_NOT_SERVED');
  assert.equal(isNativeSemanticCompletion(queryDerived), false);
  assert.ok(listM3ProductParityBlockers(CURRENT_M3_FAMILY_PARITY_REGISTER)
    .some((entry) => entry.surface_id === 'termination-fee-query-derived-values'));

  // The same disposition still reads as visible when a served route reaches the consumer.
  for (const servedId of ['proxy-render-derived-deadlines', 'termination-fee-render-derived-values']) {
    assert.equal(liveProductVisibility(surface(servedId)), 'DERIVED_VISIBLE');
    assert.equal(isNativeSemanticCompletion(surface(servedId)), true);
  }

  // A NATIVE_COMPLETE claim proved only by an unserved consumer is downgraded the same way.
  const forged = structuredClone(queryDerived);
  forged.disposition = 'NATIVE_COMPLETE';
  assert.equal(liveProductVisibility(forged), 'NATIVE_INTEGRATED_NOT_SERVED');
  assert.equal(isNativeSemanticCompletion(forged), false);
});

test('a test-only product projection cannot prove that a live legacy surface serves native V2 output', () => {
  const representationRows = surface('target-representations-rendered-rows');
  assert.equal(representationRows.state, 'OPEN');
  assert.equal(representationRows.disposition, 'FOLLOW_ON_REQUIRED');
  assert.equal(liveProductVisibility(representationRows), 'NOT_VISIBLE');
  assert.equal(
    legacyProductVisibility(representationRows, CURRENT_M3_FAMILY_PARITY_REGISTER),
    'LIVE_LEGACY_CARD_FEATURES',
  );

  const forged = structuredClone(representationRows);
  forged.state = 'PASS';
  forged.disposition = 'NATIVE_COMPLETE';
  assert.equal(liveProductVisibility(forged), 'NATIVE_UNVERIFIED');
  assert.equal(isNativeSemanticCompletion(forged), false);
});

test('all downgraded surfaces retain explicit live-legacy support without claiming native V2 completion', () => {
  for (const surfaceId of [
    'target-representations-rendered-rows',
    'parent-representations-rendered-rows',
    'representations-market-fields',
    'representations-query-fields',
    'representations-compare-side-table',
    'assigned-material-contracts',
    'material-contracts-query-compare',
    'material-contracts-market-fields',
    'assigned-no-other-reps-fraud',
    'assigned-general-covenants',
    'general-covenants-query-compare',
    'general-covenants-market-fields',
  ]) {
    const entry = surface(surfaceId);
    assert.equal(entry.state, 'OPEN', surfaceId);
    assert.equal(entry.disposition, 'FOLLOW_ON_REQUIRED', surfaceId);
    assert.notEqual(
      legacyProductVisibility(entry, CURRENT_M3_FAMILY_PARITY_REGISTER),
      'NO_LEGACY_SUPPORT',
      surfaceId,
    );
  }
});

test('corrected production locators still cannot clear parity without a real product consumer', () => {
  const financing = surface('financing-rendered-rows');
  const guaranty = surface('guaranty-market-classifier');
  assert.equal(financing.source_locator, 'financingCooperationPresent');
  assert.equal(guaranty.source_locator, 'thirdPartyBeneficiaryTypes');
  // Locators resolve, but no non-test product file imports the exact V2 projector
  // cited as evidence -- a correct locator is not native serving proof.
  assert.equal(liveProductVisibility(financing), 'NATIVE_UNVERIFIED');
  assert.equal(liveProductVisibility(guaranty), 'NATIVE_UNVERIFIED');
  assert.equal(isNativeSemanticCompletion(financing), false);
  assert.equal(isNativeSemanticCompletion(guaranty), false);

  const invalid = structuredClone(financing);
  invalid.source_locator = 'definitelyAbsent';
  assert.equal(liveProductVisibility(invalid), 'LOCATOR_UNVERIFIED');
  assert.equal(isNativeSemanticCompletion(invalid), false);
});

test('approved no-shop concepts are promoted from review hold to owner-approved family surfaces', () => {
  // Owner ruling, 2026-08-05: NOSOL-CEASE, NOSOL-RECOMMEND, NOSOL-ENFORCE
  // and NOSOL-WAIVER are all approved. This register records approval the
  // same way it records every other product surface's approved scope: a
  // real disposition (semantics.disposition_field is literally
  // APPROVED_SCOPE_DISPOSITION) inside a family's product_surfaces, not a
  // bare surface_id parked in unassigned_product_surfaces with no
  // disposition field at all. So approval means promotion out of
  // unassigned_product_surfaces (and out of review_hold_ids) and into the
  // NO_SHOP family's product_surfaces, not a relabelled reason string.
  const unassigned = CURRENT_M3_FAMILY_PARITY_REGISTER.unassigned_product_surfaces;
  for (const surfaceId of [
    'nosol-cease-retained', 'nosol-enforce-retained', 'nosol-recommend-retained', 'nosol-waiver-retained',
  ]) {
    assert.ok(!unassigned.some((entry) => entry.surface_id === surfaceId), `${surfaceId} must no longer be unassigned`);
    assert.ok(!CURRENT_M3_FAMILY_PARITY_STATUS.review_hold_ids.includes(surfaceId), surfaceId);
    const promoted = surface(surfaceId);
    assert.ok(promoted, `${surfaceId} must be a registered product surface`);
    assert.equal(promoted.disposition, 'EVIDENCE_ONLY');
    assert.equal(promoted.state, 'PASS');
    assert.equal(promoted.wave, 'FOLLOW_ON');
  }
  assert.equal(surface('nosol-cease-retained').source_locator, 'ROWS');
  assert.equal(surface('nosol-enforce-retained').source_locator, 'ROWS');
  assert.equal(surface('nosol-waiver-retained').source_locator, 'nosolSectionConfig');
  assert.equal(surface('nosol-recommend-retained').source_locator, 'nosolFiduciaryConfig');
});

test('decision records are evidence, not product-serving source paths', () => {
  for (const surfaceId of [
    'proxy-record-date-broker-search-presence',
    'proxy-parent-merger-sub-approval-split',
    'proxy-adjournment-grounded-reasons',
  ]) {
    const entry = surface(surfaceId);
    assert.equal(entry.source_path, 'components/review/table-configs/votes-approvals-meeting.config.js');
    assert.equal(entry.disposition, 'EVIDENCE_ONLY');
  }
});

test('the complete supplemental-owner inventory is registered and its unbuilt surfaces remain visible blockers', () => {
  const owner = (id) => CURRENT_M3_FAMILY_PARITY_REGISTER.supplemental_owners
    .find((entry) => entry.owner_id === id);
  assert.equal(owner('MATERIAL_CONTRACTS').product_surfaces.length, 8);
  assert.equal(owner('NO_OTHER_REPS_FRAUD').product_surfaces.length, 7);
  assert.equal(owner('GENERAL_COVENANT_ROUTER').product_surfaces.length, 7);
  for (const surfaceId of [
    'material-contracts-serving-registry',
    'no-other-reps-abry-derived',
    'general-covenants-semantic-market',
  ]) {
    assert.equal(surface(surfaceId).state, 'OPEN');
    assert.equal(surface(surfaceId).disposition, 'FOLLOW_ON_REQUIRED');
  }
});

test('indirect table configurations and the two permanently-bounded no-shop claims remain explicit review holds', () => {
  const unassigned = CURRENT_M3_FAMILY_PARITY_REGISTER.unassigned_product_surfaces;
  for (const surfaceId of [
    'indirect-advisers-fees-expenses-config',
    'indirect-approvals-votes-config',
    'indirect-conditions-m-config',
    'nosol-superior-native-claim',
    'nosol-intervening-native-claim',
  ]) {
    assert.ok(unassigned.some((entry) => entry.surface_id === surfaceId), surfaceId);
  }
  // The four owner-approved concepts are gone from this list entirely --
  // see "approved no-shop concepts are promoted..." above. Only the two
  // NOSOL-SUPERIOR / NOSOL-INTERVENING claims, which the owner did not rule
  // on, stay parked as permanently-bounded evidence.
  for (const surfaceId of [
    'nosol-cease-retained', 'nosol-enforce-retained', 'nosol-recommend-retained', 'nosol-waiver-retained',
  ]) {
    assert.ok(!unassigned.some((entry) => entry.surface_id === surfaceId), surfaceId);
  }
  assert.ok(unassigned
    .filter((entry) => entry.surface_id.endsWith('-native-claim'))
    .every((entry) => entry.reason === 'UNSUPPORTED_NATIVE_CLAIM_DOWNGRADED_TO_BOUNDED_EVIDENCE'));
});

test('V3 status cannot be forged to complete while any visibility blocker remains', () => {
  const forged = structuredClone(CURRENT_M3_FAMILY_PARITY_REGISTER);
  forged.unassigned_product_surfaces = [];
  const status = buildM3FamilyParityStatus(forged);
  assert.equal(status.state, 'BLOCKED');
  assert.ok(status.family_states.some((entry) => entry.completion_state === 'FOLLOW_ON_OPEN'));
  assert.ok(family('NO_SHOP'));
});

test('hostile: Antitrust NATIVE_COMPLETE claims citing only the legacy card config are rejected', () => {
  for (const surfaceId of [
    'antitrust-rendered-rows',
    'antitrust-market-fields',
    'antitrust-render-derived-withdrawal',
    'antitrust-v1-terminal-dispositions',
  ]) {
    const entry = surface(surfaceId);
    assert.equal(entry.state, 'PASS', surfaceId);
    assert.equal(entry.disposition, 'NATIVE_COMPLETE', surfaceId);
    assert.equal(liveProductVisibility(entry), 'NATIVE_UNVERIFIED', surfaceId);
    assert.equal(isNativeSemanticCompletion(entry), false, surfaceId);
  }
});

test('hostile: MAE definition NATIVE_COMPLETE claims citing only the legacy card config are rejected', () => {
  for (const surfaceId of ['mae-rendered-rows', 'mae-market-fields', 'mae-display-maps']) {
    const entry = surface(surfaceId);
    assert.equal(entry.state, 'PASS', surfaceId);
    assert.equal(entry.disposition, 'NATIVE_COMPLETE', surfaceId);
    assert.equal(liveProductVisibility(entry), 'NATIVE_UNVERIFIED', surfaceId);
    assert.equal(isNativeSemanticCompletion(entry), false, surfaceId);
  }
});

test('hostile: Termination Fee and Termination Rights NATIVE_COMPLETE claims omit a real consumer of any V2 projector', () => {
  for (const surfaceId of [
    'termination-fee-rendered-rows',
    'tail-fee-rendered-rows',
    'termination-fee-market-fields',
    'termination-rights-rendered-rows',
    'termination-rights-market-fields',
    // termination-rights-query-fields stays in this hostile list deliberately: its evidence
    // is the same empty-consumer shape termination-fee-query-fields used to have, AND
    // termination-rights.config.js has no canonical-serving switch anywhere (grep for
    // CANONICAL_V2_*_CARDS_FIELD/isCanonical*ServingEnabled across components/review/
    // table-configs/ and lib/canonical-v2/ finds only termination-fees.config.js and
    // termination-fee-serving-source.js). Repointing this locator the same way would
    // mechanically clear it (see docs/codex-program/notes/compare-locator-fix.md) but would
    // be a hollow pass: no V2 termination-rights data reaches any user through any path
    // today, so it must not read as visible. See "termination-fee-query-fields" below for
    // the sibling surface where the same repoint IS honest.
    'termination-rights-query-fields',
  ]) {
    const entry = surface(surfaceId);
    assert.equal(entry.state, 'PASS', surfaceId);
    assert.equal(entry.disposition, 'NATIVE_COMPLETE', surfaceId);
    assert.equal(liveProductVisibility(entry), 'NATIVE_UNVERIFIED', surfaceId);
    assert.equal(isNativeSemanticCompletion(entry), false, surfaceId);
  }
});

// 2026-08-05 (docs/codex-program/notes/compare-locator-fix.md): CompareSectionColumn, the
// locator termination-fee-query-fields used to name, is dead code -- superseded by
// UnifiedCompareSection in the r14 unified-compare-table redesign and never called again
// (its own file's default export, never imported or invoked anywhere else in the
// repository). No locator value could ever have proven this surface while it named a
// symbol nothing reachable evaluates. Repointed to UnifiedCompareSection -- the component
// pages/review/[id].js actually imports and renders for every section, compare mode
// included -- and pages/review/[id].js named as the real, served consumer, the same
// naming-gap fix already accepted for this family's sibling termination-fee-rendered-rows/
// tail-fee-rendered-rows surfaces above. This proves compare mode's rendering machinery
// reaches a live page, reusing the exact config.selectRows()/renderCell() dispatch the
// primary (non-compare) review page already uses for every deal in the comparison,
// including termination fee's own genuine, if server-flag-gated, canonical switch
// (isCanonicalTerminationFeeServingEnabled, termination-fees.config.js). It does NOT prove
// that a canonical V2 value is what a user sees on any given render: that still depends on
// attachCanonicalTerminationFeeServing (lib/canonical-v2/termination-fee-serving-source.js),
// reached only through the separate pages/api/review/[id]/cards.js module graph and joined
// to this one solely by an HTTP wire payload, a boundary no static import walk can cross.
// Same caveat Part 5's rendered-rows/market-fields fix already carries; not a new gap.
test('termination-fee-query-fields: a repointed locator plus a named real consumer clears native serving proof', () => {
  const entry = surface('termination-fee-query-fields');
  assert.equal(entry.source_locator, 'UnifiedCompareSection');
  assert.ok(entry.evidence_paths.includes('pages/review/[id].js'));
  assert.equal(liveProductVisibility(entry), 'NATIVE_VISIBLE');
  assert.equal(isNativeSemanticCompletion(entry), true);
});

test('hostile: a legacy transaction_steps side table with a matching string code is not native serving proof', () => {
  const forged = {
    surface_id: 'hostile-legacy-transaction-steps',
    source_kind: 'SIDE_TABLE',
    source_path: 'pages/api/provisions.js',
    source_locator: 'transaction_steps',
    wave: 'FOLLOW_ON',
    state: 'PASS',
    disposition: 'NATIVE_COMPLETE',
    evidence_paths: ['pages/api/provisions.js', 'tests/canonical-v2-merger-structure-product-projection.test.js'],
  };
  assert.equal(liveProductVisibility(forged), 'NATIVE_UNVERIFIED');
  assert.equal(isNativeSemanticCompletion(forged), false);
});

test('hostile: internal canonical-v2 self-citations and governance documents cannot substitute for a real product consumer', () => {
  // lib/canonical-v2/decision-reconciliation-proposal.js really does import
  // antitrust-product-projection.js, and the parity register JSON really does
  // describe the surface -- neither is a product-serving file, so citing them
  // as evidence must not manufacture proof.
  const forged = {
    ...structuredClone(surface('antitrust-rendered-rows')),
    evidence_paths: [
      'lib/canonical-v2/antitrust-product-projection.js',
      'lib/canonical-v2/decision-reconciliation-proposal.js',
      'docs/codex-program/m3-family-parity-register.json',
    ],
  };
  assert.equal(liveProductVisibility(forged), 'NATIVE_UNVERIFIED');
  assert.equal(isNativeSemanticCompletion(forged), false);
});

test('a real product consumer that imports and executes its exact adapter clears native serving proof', () => {
  // True real-consumer fixture: components/review/table-configs/termination-fees.config.js
  // is live product code and genuinely imports lib/termf.js, so this DERIVED_VALUE surface
  // has real proof -- the fail-closed check must not reject legitimate consumption.
  const fixture = surface('termination-fee-render-derived-values');
  assert.equal(fixture.disposition, 'APPROVED_DERIVED');
  assert.ok(fixture.evidence_paths.includes('components/review/table-configs/termination-fees.config.js'));
  assert.equal(liveProductVisibility(fixture), 'DERIVED_VISIBLE');
  assert.equal(isNativeSemanticCompletion(fixture), true);
});
