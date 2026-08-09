const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const {
  MODE, TARGET_REASON, assessRepresentationQualifierDispatch,
} = require('../lib/canonical-v2/native-producer/representation-qualifier-dispatch-measurement');

function row({ kind, quote, side = 'TARGET' }) {
  return {
    reason: TARGET_REASON,
    raw_value: quote,
    attributes: { qualifier_kind: kind, representation_side: side },
  };
}

test('only an existing governed MAE match may reclassify to the accuracy claim, and it stays withheld', () => {
  const assessment = assessRepresentationQualifierDispatch({
    row: row({ kind: 'THRESHOLD', quote: 'except as would not reasonably be expected to have, individually or in the aggregate, a Company Material Adverse Effect' }),
  });
  assert.equal(assessment.dispatch, 'ACCURACY_MAE_TOLERANCE_RECLASSIFICATION');
  assert.equal(assessment.residual_code, 'MODEL_KIND_CONFLICTS_WITH_MAE_TOLERANCE');
  assert.equal(assessment.proposed_claims[0].canonical_value, 'MAT_MAE_QUALIFIED');
  assert.equal(assessment.publication_disposition, 'WITHHELD');
  assert.equal(assessment.writes_performed, false);
  assert.equal(assessment.taxonomy_activated, false);
});

test('unrecognised compound and affirmative MAE forms stay held rather than using a parallel fitted grammar', () => {
  const compound = assessRepresentationQualifierDispatch({
    row: row({ kind: 'THRESHOLD', quote: 'except as has not had or would not reasonably be expected to have, individually or in the aggregate, a Company Material Adverse Effect' }),
  });
  assert.equal(compound.dispatch, 'THRESHOLD_HELD');
  const assessment = assessRepresentationQualifierDispatch({
    row: row({ kind: 'THRESHOLD', quote: 'except as would reasonably be expected to have a Company Material Adverse Effect' }),
  });
  assert.notEqual(assessment.dispatch, 'ACCURACY_MAE_TOLERANCE_RECLASSIFICATION');
  assert.ok(assessment.proposed_claims.every((claim) => claim.canonical_value !== 'MAT_MAE_QUALIFIED'));
});

test('threshold dispatch proposes only the current controlled threshold matcher and does not force nouns or carve-outs into it', () => {
  const materiality = assessRepresentationQualifierDispatch({ row: row({ kind: 'THRESHOLD', quote: 'material to the Company' }) });
  assert.equal(materiality.dispatch, 'THRESHOLD_MATERIALITY');
  assert.equal(materiality.proposed_claims[0].claim_definition_key, 'GENERAL_MATERIALITY_QUALIFIER');
  const noun = assessRepresentationQualifierDispatch({ row: row({ kind: 'THRESHOLD', quote: 'Material Contract' }) });
  assert.equal(noun.dispatch, 'THRESHOLD_HELD');
  const carveout = assessRepresentationQualifierDispatch({ row: row({ kind: 'THRESHOLD', quote: 'except as set forth in Section 3.2 of the Disclosure Letter' }) });
  assert.equal(carveout.dispatch, 'THRESHOLD_HELD');
  assert.equal(carveout.residual_code, 'THRESHOLD_FORM_NOT_GOVERNED');
});

test('temporal dispatch separates a measurement date from a retrospective lookback and unknown temporal form', () => {
  const measurement = assessRepresentationQualifierDispatch({
    row: row({ kind: 'TEMPORAL', quote: 'as of April 17, 2026', side: 'BUYER' }), agreement_date: '2026-04-18',
  });
  assert.equal(measurement.dispatch, 'TEMPORAL_MEASUREMENT_DATE');
  assert.equal(measurement.proposed_claims[0].canonical_value, '2026-04-17');
  assert.equal(measurement.proposed_claims[0].concept_key, 'REP-B-QUALIFIER');
  const lookback = assessRepresentationQualifierDispatch({ row: row({ kind: 'TEMPORAL', quote: 'Since December 31, 2018' }) });
  assert.equal(lookback.dispatch, 'TEMPORAL_RETROSPECTIVE_LOOKBACK');
  assert.equal(lookback.proposed_claims[0].claim_definition_key, 'RETROSPECTIVE_LOOKBACK');
  const unknown = assessRepresentationQualifierDispatch({ row: row({ kind: 'TEMPORAL', quote: 'with notice or lapse of time' }) });
  assert.equal(unknown.dispatch, 'TEMPORAL_HELD');
  assert.equal(unknown.residual_code, 'TEMPORAL_FORM_NOT_GOVERNED');
});

test('invalid rows fail closed', () => {
  assert.throws(() => assessRepresentationQualifierDispatch({ row: row({ kind: 'ACCURACY', quote: 'in all material respects' }) }), /unsupported qualifier kind/);
  assert.throws(() => assessRepresentationQualifierDispatch({ row: { ...row({ kind: 'THRESHOLD', quote: 'material' }), reason: 'OTHER' } }), /row reason/);
  assert.throws(() => assessRepresentationQualifierDispatch({ row: row({ kind: 'TEMPORAL', quote: 'as of April 17, 2026', side: 'OTHER' }) }), /representation_side/);
});

test('the 463-row evidence census is deterministic, reconciles the 22-row TopBuild delta, and is inert', () => {
  const root = path.resolve(__dirname, '..');
  execFileSync(process.execPath, ['scripts/stage-2y-i-qualifier-dispatch-measurement.mjs', '--check'], { cwd: root, env: { ...process.env, CI: 'true' }, encoding: 'utf8' });
  const report = require('../evidence/canonical-v2/stage-2y-i-qualifier-dispatch-measurement.json');
  assert.equal(report.mode, MODE);
  assert.deepEqual(report.census.by_qualifier_kind, { TEMPORAL: 157, THRESHOLD: 306 });
  assert.equal(report.census.measured_rows, 463);
  assert.equal(report.census.register_reconciliation.register_rows, 485);
  assert.equal(report.census.register_reconciliation.excluded_rows, 22);
  assert.equal(report.census.register_reconciliation.excluded_run, 'topbuild-representations-20260809-2xk-r3-final');
  assert.equal(report.accounting.accounted_rows, 463);
  // The former broad word matcher left 169 residual-coded rows. Reusing the
  // controlled threshold matcher correctly holds a further 190 false fits.
  assert.equal(report.accounting.residual_coded_rows, 359);
  assert.equal(report.publication.model_calls, 0);
  assert.equal(report.publication.writes_performed, false);
  assert.equal(report.publication.serving_activated, false);
  assert.equal(report.publication.taxonomy_activated, false);
  assert.ok(report.rows.every((item) => item.assessment.publication_disposition === 'WITHHELD'));
});
