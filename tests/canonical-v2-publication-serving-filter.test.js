'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const {
  PUBLICATION_DISPOSITION_V2_SCHEMA,
  buildPublicationDispositionV2,
  buildPublicationFamilySwitch,
  buildPublicationReleaseReceipt,
  buildPublicationRollbackReceipt,
  validatePublicationFamilySwitch,
  validatePublicationReleaseReceipt,
  validatePublicationRollbackReceipt,
} = require('../lib/canonical-v2/publication-disposition');
const {
  filterResolvedEntriesForPublication,
  publicationDispositionAllows,
} = require('../lib/canonical-v2/publication-serving-filter');
const { projectTerminationFeeProductSurfaces } = require('../lib/canonical-v2/termination-product-projection');

const TIME = '2026-08-09T12:00:00.000Z';
const LATER_TIME = '2026-09-01T12:00:00.000Z';

function eligibleSidecar({ claimRevisionId = 'a'.repeat(64), family = 'TERMINATION_FEE' } = {}) {
  const body = {
    schema_version: PUBLICATION_DISPOSITION_V2_SCHEMA,
    claim_revision_id: claimRevisionId,
    run_receipt_id: 'b'.repeat(64),
    resolution_receipt_id: 'c'.repeat(64),
    review_queue_artifact_id: null,
    publication_input_digest: 'd'.repeat(64),
    canonical_validation_state: 'VALIDATED',
    family,
    claim_kind: 'AMOUNT',
    mechanism: 'EXACT_BOUND_DIGESTS',
    selected_rung: 2,
    risk_signals: { structural_uncertainty: false, definition_ambiguity: false, model_fallback: false, party_attribution_risk: false },
    evaluated_at: TIME,
    authority_id: 'e'.repeat(64),
    disposition: 'ELIGIBLE',
    reason_codes: ['CALIBRATION_AUTHORITY_MATCHED'],
    prior_eligible_decision_id: null,
    prior_eligible_decision: null,
  };
  return { ...body, decision_id: contentId(PUBLICATION_DISPOSITION_V2_SCHEMA, body) };
}

function entry(sidecar, claimRevisionId = 'a'.repeat(64)) {
  return { claim: { claim_revision_id: claimRevisionId }, publication_disposition: sidecar };
}

function withRecomputedSidecar(sidecar, changes) {
  const { decision_id: _ignored, ...body } = { ...sidecar, ...changes };
  return { ...body, decision_id: contentId(PUBLICATION_DISPOSITION_V2_SCHEMA, body) };
}

test('no publication filter returns the exact original resolved array', () => {
  const original = [entry(eligibleSidecar())];
  assert.strictEqual(filterResolvedEntriesForPublication(original, undefined), original);
  assert.strictEqual(filterResolvedEntriesForPublication(original, null), original);
});

test('CANDIDATE_ELIGIBLE accepts only the exact validated current sidecar for its claim', () => {
  const eligible = entry(eligibleSidecar());
  assert.equal(publicationDispositionAllows(eligible, 'CANDIDATE_ELIGIBLE', undefined, TIME), true);
  assert.deepEqual(filterResolvedEntriesForPublication([eligible], 'CANDIDATE_ELIGIBLE', undefined, TIME), [eligible]);

  const withheld = entry(buildPublicationDispositionV2({
    claim_revision_id: 'a'.repeat(64), run_receipt_id: 'b'.repeat(64), resolution_receipt_id: 'c'.repeat(64), evaluated_at: TIME,
  }));
  const forged = entry({ ...eligible.publication_disposition, decision_id: 'f'.repeat(64) });
  const unknown = entry(withRecomputedSidecar(eligible.publication_disposition, { disposition: 'UNKNOWN' }));
  const stale = entry(withRecomputedSidecar(eligible.publication_disposition, { evaluated_at: LATER_TIME }));
  const mismatched = entry(eligible.publication_disposition, 'd'.repeat(64));
  for (const hostile of [withheld, forged, unknown, stale, mismatched, entry(null)]) {
    assert.equal(publicationDispositionAllows(hostile, 'CANDIDATE_ELIGIBLE', undefined, TIME), false);
    assert.deepEqual(filterResolvedEntriesForPublication([hostile], 'CANDIDATE_ELIGIBLE', undefined, TIME), []);
  }
});

test('REQUIRE_PUBLISHED always excludes until a validated receipt-consuming adapter exists', () => {
  const eligible = entry(eligibleSidecar());
  for (const releaseReceiptId of [undefined, 'not-a-digest', 'e'.repeat(64)]) {
    assert.equal(publicationDispositionAllows(eligible, 'REQUIRE_PUBLISHED', releaseReceiptId, TIME), false);
    assert.deepEqual(filterResolvedEntriesForPublication([eligible], 'REQUIRE_PUBLISHED', releaseReceiptId, TIME), []);
  }
});

test('projection execution preserves legacy output without a filter and excludes a filtered forged sidecar', () => {
  const resolution = JSON.parse(fs.readFileSync(
    path.join(__dirname, '..', 'evidence/canonical-v2/modiv-termination-fee-20260807-replay/resolution.json'), 'utf8',
  ));
  const baseline = projectTerminationFeeProductSurfaces({ resolution, deal_id: 'modiv-gnl' });
  const decorated = {
    ...resolution,
    resolved: resolution.resolved.map((candidate, index) => (index === 0 ? {
      ...candidate,
      publication_disposition: { ...eligibleSidecar(), claim_revision_id: candidate.claim.claim_revision_id },
    } : candidate)),
  };
  const legacy = projectTerminationFeeProductSurfaces({ resolution: decorated, deal_id: 'modiv-gnl' });
  const filtered = projectTerminationFeeProductSurfaces({
    resolution: decorated, deal_id: 'modiv-gnl', publication_filter: 'REQUIRE_PUBLISHED',
    release_receipt_id: 'e'.repeat(64), publication_evaluation_time: TIME,
  });
  assert.deepEqual(legacy, baseline);
  assert.deepEqual(filtered.cards, []);
});

test('release and rollback contracts reject hostile states, forged identities and swapped bindings', () => {
  const eligible = eligibleSidecar();
  const otherEligible = eligibleSidecar({ claimRevisionId: 'd'.repeat(64) });
  const withheld = buildPublicationDispositionV2({
    claim_revision_id: 'a'.repeat(64), run_receipt_id: 'b'.repeat(64), resolution_receipt_id: 'c'.repeat(64), evaluated_at: TIME,
  });
  const enabled = buildPublicationFamilySwitch({
    family: 'TERMINATION_FEE', enabled: true, effective_at: TIME, reason_code: 'TEST_ONLY',
  });
  const disabled = buildPublicationFamilySwitch({
    family: 'TERMINATION_FEE', enabled: false, effective_at: LATER_TIME, reason_code: 'TEST_ONLY_ROLLBACK',
  });
  const wrongFamily = buildPublicationFamilySwitch({
    family: 'NO_SHOP', enabled: true, effective_at: TIME, reason_code: 'TEST_ONLY',
  });
  assert.throws(() => buildPublicationReleaseReceipt({ eligible_decision: withheld, family_switch: enabled, released_at: TIME }));
  assert.throws(() => buildPublicationReleaseReceipt({ eligible_decision: eligible, family_switch: disabled, released_at: TIME }));
  assert.throws(() => buildPublicationReleaseReceipt({ eligible_decision: eligible, family_switch: wrongFamily, released_at: TIME }));
  const release = buildPublicationReleaseReceipt({ eligible_decision: eligible, family_switch: enabled, released_at: TIME });
  assert.doesNotThrow(() => validatePublicationFamilySwitch(enabled));
  assert.doesNotThrow(() => validatePublicationReleaseReceipt(release, { eligible_decision: eligible, family_switch: enabled }));
  assert.throws(() => validatePublicationFamilySwitch({ ...enabled, family_switch_id: 'f'.repeat(64) }));
  assert.throws(() => validatePublicationReleaseReceipt({ ...release, release_receipt_id: 'f'.repeat(64) }, { eligible_decision: eligible, family_switch: enabled }));
  assert.throws(() => validatePublicationReleaseReceipt(release, { eligible_decision: otherEligible, family_switch: enabled }));
  assert.throws(() => validatePublicationReleaseReceipt(release, { eligible_decision: eligible, family_switch: wrongFamily }));
  assert.throws(() => buildPublicationRollbackReceipt({ release_receipt: release, disabled_family_switch: enabled, rolled_back_at: LATER_TIME, reason_code: 'TEST_ONLY' }));
  assert.throws(() => buildPublicationRollbackReceipt({ release_receipt: release, disabled_family_switch: wrongFamily, rolled_back_at: LATER_TIME, reason_code: 'TEST_ONLY' }));
  assert.throws(() => buildPublicationRollbackReceipt({ release_receipt: { ...release, release_receipt_id: 'f'.repeat(64) }, disabled_family_switch: disabled, rolled_back_at: LATER_TIME, reason_code: 'TEST_ONLY' }));
  const rollback = buildPublicationRollbackReceipt({ release_receipt: release, disabled_family_switch: disabled, rolled_back_at: LATER_TIME, reason_code: 'TEST_ONLY' });
  assert.doesNotThrow(() => validatePublicationRollbackReceipt(rollback, { release_receipt: release, disabled_family_switch: disabled }));
  assert.throws(() => validatePublicationRollbackReceipt({ ...rollback, rollback_receipt_id: 'f'.repeat(64) }, { release_receipt: release, disabled_family_switch: disabled }));
});

const PROJECTIONS = [
  ['antitrust-product-projection.js', 'projectAntitrustProductSurfaces', (fn) => fn({ resolution: { resolved: [{}] }, deal_id: 'deal', publication_filter: 'REQUIRE_PUBLISHED', release_receipt_id: 'e'.repeat(64), publication_evaluation_time: TIME })],
  ['closing-conditions-product-projection.js', 'projectClosingConditionProductSurfaces', (fn) => fn({ resolution: { resolved: [{}] }, deal_id: 'deal', publication_filter: 'REQUIRE_PUBLISHED', release_receipt_id: 'e'.repeat(64), publication_evaluation_time: TIME })],
  ['consideration-wave-a-product-projection.js', 'projectConsiderationWaveAClaims', (fn) => fn({ resolved_entries: [{}], publication_filter: 'REQUIRE_PUBLISHED', release_receipt_id: 'e'.repeat(64), publication_evaluation_time: TIME })],
  ['employee-dno-product-projection.js', 'projectEmployeeDnoProductSurfaces', (fn) => fn({ resolution: { resolved: [{}], open_world: [] }, deal_id: 'deal', publication_filter: 'REQUIRE_PUBLISHED', release_receipt_id: 'e'.repeat(64), publication_evaluation_time: TIME })],
  ['financing-guaranty-product-projection.js', 'projectFinancingGuarantyClaims', (fn) => fn({ resolved_entries: [{}], publication_filter: 'REQUIRE_PUBLISHED', release_receipt_id: 'e'.repeat(64), publication_evaluation_time: TIME })],
  ['general-covenants-product-projection.js', 'projectGeneralCovenantsProductSurfaces', (fn) => fn({ resolution: { resolved: [{}], open_world: [] }, deal_id: 'deal', publication_filter: 'REQUIRE_PUBLISHED', release_receipt_id: 'e'.repeat(64), publication_evaluation_time: TIME })],
  ['ioc-wave-a-product-projection.js', 'projectIocWaveAClaims', (fn) => fn({ resolved_entries: [{}], ioc_restriction_components: [], publication_filter: 'REQUIRE_PUBLISHED', release_receipt_id: 'e'.repeat(64), publication_evaluation_time: TIME })],
  ['key-terms-mae-product-projection.js', 'projectKeyTermsMaeClaims', (fn) => fn({ resolved_entries: [{}], publication_filter: 'REQUIRE_PUBLISHED', release_receipt_id: 'e'.repeat(64), publication_evaluation_time: TIME })],
  ['material-contracts-product-projection.js', 'projectMaterialContractsProductSurfaces', (fn) => fn({ resolution: { resolved: [{}], open_world: [] }, deal_id: 'deal', publication_filter: 'REQUIRE_PUBLISHED', release_receipt_id: 'e'.repeat(64), publication_evaluation_time: TIME })],
  ['no-other-reps-fraud-product-projection.js', 'projectNoOtherRepsFraudProduct', (fn) => fn({ resolved: [{}], publication_filter: 'REQUIRE_PUBLISHED', release_receipt_id: 'e'.repeat(64), publication_evaluation_time: TIME })],
  ['proxy-meeting-product-projection.js', 'projectProxyMeetingProductSurfaces', (fn) => fn({ resolution: { resolved: [{}], open_world: [] }, deal_id: 'deal', publication_filter: 'REQUIRE_PUBLISHED', release_receipt_id: 'e'.repeat(64), publication_evaluation_time: TIME })],
  ['remedies-misc-product-projection.js', 'projectRemediesMiscProductSurfaces', (fn) => fn({ resolution: { resolved: [{}], open_world: [] }, deal_id: 'deal', publication_filter: 'REQUIRE_PUBLISHED', release_receipt_id: 'e'.repeat(64), publication_evaluation_time: TIME })],
  ['representations-product-projection.js', 'projectRepresentationClaims', (fn) => fn({ resolved_entries: [{}], open_world_entries: [], publication_filter: 'REQUIRE_PUBLISHED', release_receipt_id: 'e'.repeat(64), publication_evaluation_time: TIME })],
  ['tax-dividends-appraisal-product-projection.js', 'projectTaxDividendsAppraisalClaims', (fn) => fn({ resolved_entries: [{}], publication_filter: 'REQUIRE_PUBLISHED', release_receipt_id: 'e'.repeat(64), publication_evaluation_time: TIME })],
  ['termination-product-projection.js', 'projectTerminationFeeProductSurfaces', (fn) => fn({ resolution: { resolved: [{}], open_world: [] }, deal_id: 'deal', publication_filter: 'REQUIRE_PUBLISHED', release_receipt_id: 'e'.repeat(64), publication_evaluation_time: TIME })],
];

test('every product projection actually calls the shared publication filter', () => {
  const filterPath = require.resolve('../lib/canonical-v2/publication-serving-filter');
  const originalFilter = require.cache[filterPath].exports;
  for (const [file, exportName, invoke] of PROJECTIONS) {
    let calls = 0;
    require.cache[filterPath].exports = {
      ...originalFilter,
      filterResolvedEntriesForPublication(...args) {
        calls += 1;
        return originalFilter.filterResolvedEntriesForPublication(...args);
      },
      publicationDispositionAllows(...args) {
        calls += 1;
        return originalFilter.publicationDispositionAllows(...args);
      },
    };
    const modulePath = path.join(__dirname, '..', 'lib/canonical-v2', file);
    delete require.cache[require.resolve(modulePath)];
    const projection = require(modulePath)[exportName];
    assert.equal(typeof projection, 'function', file);
    try { invoke(projection); } catch (_) { /* filtered empty input can be invalid for a record-only projection. */ }
    assert.ok(calls > 0, `${file} did not call the shared filter`);
    delete require.cache[require.resolve(modulePath)];
  }
  require.cache[filterPath].exports = originalFilter;
});
