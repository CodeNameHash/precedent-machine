'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { canonicalJson } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContractV42 } = require('../lib/canonical-v2/contract-bundle');
const { resolveCandidates } = require('../lib/canonical-v2/native-producer/candidate-resolution');
const { parseFilingDeadlineDaysAtNumeralRung } = require('../lib/canonical-v2/native-producer/antitrust-regulatory-parse');

const root = path.resolve(__dirname, '..');

function finalRun(name) {
  const runRoot = path.join(root, 'evidence', 'canonical-v2', name);
  return {
    run_receipt: JSON.parse(fs.readFileSync(path.join(runRoot, 'run-receipt.json'), 'utf8')),
    admitted_source_context: JSON.parse(fs.readFileSync(path.join(runRoot, 'adapter-result.json'), 'utf8')).admitted_source_contexts[0],
  };
}

function resolveFinalRun(name, numeralRung, runReceipt = null) {
  const input = finalRun(name);
  return resolveCandidates({
    ...input,
    ...(runReceipt ? { run_receipt: runReceipt } : {}),
    contract_vocabulary: compileFixtureContractV42(),
    ...(numeralRung === undefined ? {} : { numeral_rung: numeralRung }),
  });
}

function candidate(receipt, assertionKind) {
  const entry = receipt.compiled_candidates.find((item) => item?.candidate?.claim?.attributes?.assertion_kind === assertionKind);
  assert.ok(entry, `missing ${assertionKind} candidate`);
  return entry.candidate.claim;
}

function reviewFor(result, sourceClaim) {
  return result.review_queue.find((item) => item.original_claim_occurrence_id === sourceClaim.claim_occurrence_id)
    || result.review_queue.find((item) => item.raw_value === sourceClaim.raw_value);
}

test('Stage 2Y-E records a public 19-card resolver matrix, including blockers', () => {
  const script = path.join(root, 'scripts', 'stage-2y-e-numeral-ladder-replay.mjs');
  const run = spawnSync(process.execPath, [script, '--check'], { cwd: root, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /CHECKED/);
  const evidence = JSON.parse(fs.readFileSync(path.join(root, 'evidence/canonical-v2/stage-2y-e-numeral-ladder-replay.json'), 'utf8'));
  assert.equal(evidence.affected_recording_count, 19);
  assert.deepEqual(evidence.rungs.map((rung) => rung.counts), [
    { RESOLVED: 8, REVIEW: 11, OPEN_WORLD: 0, NOT_LOCATED_IN_OUTPUT: 0 },
    { RESOLVED: 8, REVIEW: 11, OPEN_WORLD: 0, NOT_LOCATED_IN_OUTPUT: 0 },
    { RESOLVED: 9, REVIEW: 10, OPEN_WORLD: 0, NOT_LOCATED_IN_OUTPUT: 0 },
    { RESOLVED: 9, REVIEW: 10, OPEN_WORLD: 0, NOT_LOCATED_IN_OUTPUT: 0 },
  ]);
  for (const [index, rung] of evidence.rungs.entries()) {
    assert.equal(rung.numeral_rung, index);
    assert.equal(rung.results.length, 19);
    assert.ok(rung.results.every((row) => row.resolver_result && row.parser_result));
  }
  const modivIndemnification = evidence.rungs[3].results.find((row) => row.run_name.startsWith('modiv-dno') && row.assertion_kind === 'INDEM_SURVIVAL_PERIOD');
  assert.deepEqual(modivIndemnification.resolver_result, { outcome: 'REVIEW', reasons: ['DNO_KIND_UNCORROBORATED'] });
});

test('numeral rung 0 is byte-identical to the omitted public resolver argument', () => {
  const names = [
    'concho-antitrust-regulatory-20260809-2xk-final',
    'metsera-employee-matters-20260809-2xk-final',
    'modiv-dno-indemnification-20260809-2xk-final',
    'skywater-employee-matters-20260809-2xk-final',
    'topbuild-dno-indemnification-20260809-2xk-r4-final',
  ];
  for (const name of names) assert.equal(canonicalJson(resolveFinalRun(name)), canonicalJson(resolveFinalRun(name, 0)), name);
});

test('the D&O target-years path recovers Modiv at rung 2, while TopBuild remains held', () => {
  const name = 'modiv-dno-indemnification-20260809-2xk-final';
  const source = finalRun(name).run_receipt;
  const tail = candidate(source, 'TAIL_PERIOD');
  assert.deepEqual(reviewFor(resolveFinalRun(name, 0), tail).reasons, ['YEAR_COUNT_UNRESOLVED']);
  assert.deepEqual(reviewFor(resolveFinalRun(name, 1), tail).reasons, ['YEAR_COUNT_UNRESOLVED']);
  for (const numeralRung of [2, 3]) {
    const resolved = resolveFinalRun(name, numeralRung).resolved.find((item) => item.claim.raw_value === tail.raw_value && item.claim.claim_definition_key === 'TAIL_POLICY_PERIOD_YEARS');
    assert.equal(resolved.claim.canonical_value, '6');
  }

  const topBuild = 'topbuild-dno-indemnification-20260809-2xk-r4-final';
  const topBuildTail = candidate(finalRun(topBuild).run_receipt, 'TAIL_PERIOD');
  for (const numeralRung of [0, 1, 2, 3]) assert.deepEqual(reviewFor(resolveFinalRun(topBuild, numeralRung), topBuildTail).reasons, ['YEAR_COUNT_UNRESOLVED']);
});

test('existing Employee spelled-year conversion remains 12 months at every numeral rung', () => {
  for (const name of ['skywater-employee-matters-20260809-2xk-final', 'metsera-employee-matters-20260809-2xk-final']) {
    const source = finalRun(name).run_receipt;
    const period = candidate(source, 'CONTINUATION_PERIOD');
    for (const numeralRung of [0, 1, 2, 3]) {
      const resolved = resolveFinalRun(name, numeralRung).resolved.find((item) => item.claim.raw_value === period.raw_value && item.claim.claim_definition_key === 'BENEFITS_CONTINUATION_PERIOD_MONTHS');
      assert.equal(resolved.claim.canonical_value, '12', `${name} rung ${numeralRung}`);
    }
  }
});

test('the public path fails closed for mismatches, multiple values, wrong units, and upstream blockers', () => {
  assert.equal(parseFilingDeadlineDaysAtNumeralRung('within four (3) Business Days', 3).reason, 'SPELLED_DIGIT_MISMATCH');
  assert.equal(parseFilingDeadlineDaysAtNumeralRung('within four Business Days and five Business Days', 3).reason, 'MULTIPLE_DAY_COUNTS');

  const modiv = finalRun('modiv-dno-indemnification-20260809-2xk-final');
  const tail = candidate(modiv.run_receipt, 'TAIL_PERIOD');
  const wrongUnitReceipt = structuredClone(modiv.run_receipt);
  candidate(wrongUnitReceipt, 'TAIL_PERIOD').raw_value = tail.raw_value.replace('six years', 'six months');
  assert.deepEqual(reviewFor(resolveFinalRun('modiv-dno-indemnification-20260809-2xk-final', 3, wrongUnitReceipt), candidate(wrongUnitReceipt, 'TAIL_PERIOD')).reasons, ['YEAR_COUNT_UNRESOLVED']);

  const multipleReceipt = structuredClone(modiv.run_receipt);
  candidate(multipleReceipt, 'TAIL_PERIOD').raw_value = tail.raw_value.replace('six years', 'six years and seven years');
  assert.deepEqual(reviewFor(resolveFinalRun('modiv-dno-indemnification-20260809-2xk-final', 3, multipleReceipt), candidate(multipleReceipt, 'TAIL_PERIOD')).reasons, ['YEAR_COUNT_UNRESOLVED']);

  const indemnification = candidate(modiv.run_receipt, 'INDEM_SURVIVAL_PERIOD');
  assert.deepEqual(reviewFor(resolveFinalRun('modiv-dno-indemnification-20260809-2xk-final', 3), indemnification).reasons, ['DNO_KIND_UNCORROBORATED']);
});

test('public resolver validates only numeral rungs 0 through 3', () => {
  const input = finalRun('modiv-dno-indemnification-20260809-2xk-final');
  for (const numeralRung of [-1, 4, 1.5, '2']) {
    assert.throws(() => resolveCandidates({ ...input, contract_vocabulary: compileFixtureContractV42(), numeral_rung: numeralRung }), /numeral rung must be an integer from 0 through 3/);
  }
});
