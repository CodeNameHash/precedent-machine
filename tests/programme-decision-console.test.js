const assert = require('node:assert/strict');
const test = require('node:test');

const {
  DECISION_GROUPS,
  DECISIONS,
  M3_STAGES,
  RECORDED_RULINGS,
  decisionById,
  mergeRecordedRulings,
  recommendedChoice,
} = require('../lib/programme-decision-console');

test('decision console has one complete, unique recommendation per decision', () => {
  assert.ok(DECISIONS.length >= 15);
  assert.equal(new Set(DECISIONS.map((decision) => decision.id)).size, DECISIONS.length);

  for (const decision of DECISIONS) {
    assert.ok(DECISION_GROUPS.some((group) => group.id === decision.group));
    assert.ok(decision.question);
    assert.ok(decision.evidence);
    assert.ok(decision.current);
    assert.ok(decision.recommendation);
    assert.ok(decision.consequence);
    assert.ok(decision.source);
    assert.equal(decision.options.filter((option) => option.recommended).length, 1);
    assert.ok(decision.options.some((option) => option.id === recommendedChoice(decision)));
    assert.equal(decisionById(decision.id), decision);
  }
});

test('recorded rulings stay fixed and follow-on rulings are added without duplicates', () => {
  assert.equal(Object.keys(RECORDED_RULINGS).length, 20);
  assert.deepEqual(
    DECISIONS.filter((decision) => !RECORDED_RULINGS[decision.id]).map((decision) => decision.id),
    [
      'antitrust-core-taxonomy',
      'proxy-record-date-broker-search',
      'proxy-parent-adoption',
      'proxy-adjournment-reasons',
      'appraisal-dispatch-ownership',
      'consideration-mechanics-promotion',
      'employee-dno-follow-on',
      'financing-follow-on',
      'ioc-long-tail-promotion',
      'defined-term-relationship-model',
      'merger-mechanics-follow-on',
      'remedies-boilerplate-follow-on',
      'tax-dividend-appraisal-details',
      'termination-wave-b-promotion',
    ],
  );
  for (const [decisionId, optionId] of Object.entries(RECORDED_RULINGS)) {
    assert.ok(decisionById(decisionId).options.some((option) => option.id === optionId));
  }
});

test('follow-on rulings carry corpus counts, clause examples and a promotion horizon', () => {
  const followOn = DECISIONS.filter((decision) => decision.origin === 'follow-on');
  assert.equal(followOn.length, 13);
  assert.deepEqual(
    followOn.filter((decision) => decision.horizon === 'now').map((decision) => decision.id),
    [
      'proxy-record-date-broker-search',
      'proxy-parent-adoption',
      'proxy-adjournment-reasons',
      'appraisal-dispatch-ownership',
    ],
  );
  assert.equal(followOn.filter((decision) => decision.horizon === 'later').length, 9);
  for (const decision of followOn) {
    assert.match(decision.corpus, /\d/);
    assert.ok(Array.isArray(decision.examples));
    assert.ok(decision.examples.length > 0);
    assert.ok(decision.examples.every((example) => typeof example === 'string' && example.length > 20));
  }
});

test('prior rulings are represented once and remain recorded', () => {
  for (const id of ['topbuild-mae', 'tax-opinion', 'rank-88', 'guaranty-codes']) {
    assert.equal(DECISIONS.filter((decision) => decision.id === id).length, 1);
    assert.ok(RECORDED_RULINGS[id]);
  }
});

test('saved open answers survive while recorded rulings remain authoritative', () => {
  const choices = mergeRecordedRulings({
    'antitrust-core-taxonomy': 'adopt-core',
    'db-apply': 'hold',
  });
  assert.equal(choices['antitrust-core-taxonomy'], 'adopt-core');
  assert.equal(choices['db-apply'], 'fixture-go');
});

test('M3 route ends at certification and keeps production import outside M3', () => {
  assert.deepEqual(M3_STAGES.map((stage) => stage.number), ['01', '02', '03', '04', '05', '06', '07']);
  assert.match(M3_STAGES.at(-1).exit, /M3_FULL_CORPUS_CERTIFICATION/);
  assert.match(M3_STAGES.at(-1).exit, /Production import remains an M4 step/);
});
