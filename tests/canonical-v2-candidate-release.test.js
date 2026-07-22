const test = require('node:test');
const assert = require('node:assert/strict');

const { buildLandosCandidateReleaseFixture } = require('../__fixtures__/canonical-v2/landos-candidate-release');
const {
  buildFixtureCandidateRelease,
  buildInitialActiveReleasePointer,
  planActiveReleasePointerSwap,
  validateActiveReleasePointer,
  validateCandidateReleaseBundle,
  validateCandidateReleaseManifest,
} = require('../lib/canonical-v2/candidate-release');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('twelve comparable results and one reviewed source-specific proposition freeze into one deterministic release', () => {
  const first = buildLandosCandidateReleaseFixture();
  const second = buildLandosCandidateReleaseFixture();

  assert.deepEqual(first.release, second.release);
  assert.equal(validateCandidateReleaseManifest(first.release.manifest), true);
  assert.equal(validateCandidateReleaseBundle(first.release), true);
  assert.deepEqual(first.release.manifest.counts, {
    deals: 1,
    deal_directory_records: 1,
    metric_slots: 12,
    observations: 12,
    exclusions: 0,
    shared_rows: 13,
    source_specific_rows: 1,
    source_specific_serving_records: 1,
    exact_detail_packages: 13,
    query_records: 12,
    unresolved: 0,
    failed: 0,
    duplicates: 0,
  });
  assert.deepEqual(first.release.manifest.deal_keys, ['deal:landos-abbvie']);
  assert.equal(first.release.deal_directory_records[0].application_deal_id, 'c34415ed-44f7-432f-8d7c-6464b0310239');
  assert.equal(first.release.market_observations.length, 12);
  assert.equal(first.release.shared_rows.length, 13);
  assert.equal(first.release.reviewed_source_specific_rows.length, 1);
  assert.equal(first.release.source_specific_serving_records.length, 1);
  assert.equal(first.release.exact_detail_packages.length, 13);
  assert.equal(first.release.query_records.length, 12);
  assert.equal(first.release.query_records.some((row) => (
    row.row_serving_key === first.release.reviewed_source_specific_rows[0].row_serving_key
  )), false);
  assert.equal(new Set(Object.values(first.release.manifest.roots)).size, 8);
});

test('candidate release carries raw and normalised money with exact legal query dimensions', () => {
  const { release } = buildLandosCandidateReleaseFixture();
  const byMetric = new Map(release.query_records.map((record) => [record.metric_key, record]));
  const fee = byMetric.get('SELLER_TERMINATION_FEE_PERCENT_OF_DEAL_VALUE');
  const material = byMetric.get('MATERIAL_CONTRACT_CASH_FLOW_THRESHOLD_PERCENT_OF_DEAL_VALUE');
  const ioc = byMetric.get('IOC_CAPEX_THRESHOLD_PERCENT_OF_DEAL_VALUE');

  assert.equal(fee.canonical_numeric_value, '5.09090909');
  assert.equal(fee.canonical_payload.canonical_result.components[0].raw_value, '$7,000,000');
  assert.equal(fee.fee_side, 'SELLER');
  assert.equal(fee.payer_capacity, 'TARGET');
  assert.equal(fee.payee_capacity, 'BUYER');
  assert.equal(fee.trigger_codes.length, 3);
  assert.equal(material.canonical_numeric_value, '0.07272727');
  assert.equal(material.criterion_code, 'PAYMENTS_BY_OR_TO_COMPANY_PER_FISCAL_YEAR');
  assert.equal(material.measurement_period_code, 'FISCAL_2023_OR_ANY_SINGLE_FISCAL_YEAR_THEREAFTER');
  assert.equal(ioc.canonical_numeric_value, '0.07272727');
  assert.equal(ioc.canonical_payload.canonical_result.components[0].raw_value, '$100,000');
  assert.equal(byMetric.get('REPRESENTATION_ACCURACY_STANDARD').canonical_numeric_value, null);
  assert.equal(byMetric.get('NO_SHOP_NOTICE_PERIOD_DAYS').canonical_numeric_value, '1');
});

test('duplicate, mismatched, unresolved or source-less members block the whole candidate release', () => {
  const fixture = buildLandosCandidateReleaseFixture();
  const args = {
    contract_bundle: fixture.contract,
    serving_namespace_id: fixture.servingNamespaceId,
    corpus_release_id: fixture.corpusReleaseId,
  };
  assert.throws(
    () => buildFixtureCandidateRelease({ ...args, members: [...fixture.members, fixture.members[0]] }),
    /duplicate market metric slot/,
  );
  const sourceSpecificMember = {
    shared_row: fixture.sourceSpecific.row,
    exact_detail: {
      package: fixture.sourceSpecific.exactDetail,
      source: fixture.sourceSpecific.source,
      source_admission: fixture.sourceSpecific.sourceAdmission,
      excerpts: Object.values(fixture.sourceSpecific.excerpts),
    },
  };
  assert.throws(
    () => buildFixtureCandidateRelease({
      ...args,
      members: fixture.members,
      source_specific_members: [sourceSpecificMember, sourceSpecificMember],
    }),
    /duplicate shared or source-specific row/,
  );

  const sourceLess = clone(fixture.members);
  sourceLess[0].exact_detail = null;
  assert.throws(
    () => buildFixtureCandidateRelease({ ...args, members: sourceLess }),
    /requires one shared row and one exact-detail package/,
  );

  const unresolved = clone(fixture.members);
  unresolved[0].shared_row = { row_kind: 'UNRECOGNISED_PROVISION_CANDIDATE' };
  assert.throws(
    () => buildFixtureCandidateRelease({ ...args, members: unresolved }),
    /SharedServingRow|shared serving row|fields do not match/i,
  );

  const mismatched = clone(fixture.members);
  mismatched[0].shared_row = clone(fixture.members[1].shared_row);
  assert.throws(
    () => buildFixtureCandidateRelease({ ...args, members: mismatched }),
    /does not close over its market observation/,
  );
});

test('full release validation rejects payload drift behind an otherwise valid manifest', () => {
  const { release } = buildLandosCandidateReleaseFixture();
  const queryDrift = clone(release);
  queryDrift.query_records[0].buyer = 'Different buyer';
  assert.throws(() => validateCandidateReleaseBundle(queryDrift), /query projection/);

  const sourceSpecificDrift = clone(release);
  sourceSpecificDrift.source_specific_serving_records[0].aggregate_authority = 'MARKET_AUTHORITY';
  assert.throws(() => validateCandidateReleaseBundle(sourceSpecificDrift), /aggregate_authority|projection/);

  const missingDetail = clone(release);
  missingDetail.exact_detail_packages.pop();
  assert.throws(() => validateCandidateReleaseBundle(missingDetail), /count does not match/);
});

test('active release movement is an immutable compare-and-swap plan over one certified manifest', () => {
  const { release } = buildLandosCandidateReleaseFixture();
  const current = buildInitialActiveReleasePointer();
  const currentBytes = JSON.stringify(current);
  const swap = planActiveReleasePointerSwap({
    current_pointer: current,
    expected_current_pointer_id: current.pointer_id,
    candidate_manifest: release.manifest,
  });

  assert.equal(JSON.stringify(current), currentBytes);
  assert.equal(validateActiveReleasePointer(current), true);
  assert.equal(validateActiveReleasePointer(swap.next_pointer), true);
  assert.equal(swap.next_pointer.generation, 1);
  assert.equal(swap.next_pointer.previous_pointer_id, current.pointer_id);
  assert.equal(swap.next_pointer.corpus_release_id, release.manifest.corpus_release_id);
  assert.equal(swap.next_pointer.serving_namespace_id, release.manifest.serving_namespace_id);
  assert.equal(swap.next_pointer.candidate_release_manifest_id, release.manifest.candidate_release_manifest_id);
  assert.throws(
    () => planActiveReleasePointerSwap({
      current_pointer: current,
      expected_current_pointer_id: '0'.repeat(64),
      candidate_manifest: release.manifest,
    }),
    /changed before the atomic swap/,
  );

  const tampered = clone(release.manifest);
  tampered.counts.failed = 1;
  assert.throws(
    () => planActiveReleasePointerSwap({
      current_pointer: current,
      expected_current_pointer_id: current.pointer_id,
      candidate_manifest: tampered,
    }),
    /not a complete certified release/,
  );
});
