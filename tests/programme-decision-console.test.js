const assert = require('node:assert/strict');
const test = require('node:test');

const {
  DECISION_GROUPS,
  DECISIONS,
  M3_STAGES,
  RECORDED_RULINGS,
  decisionById,
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

test('the original 15 programme rulings and the IOC parent-party ruling are fixed', () => {
  assert.equal(Object.keys(RECORDED_RULINGS).length, 16);
  assert.deepEqual(
    DECISIONS.filter((decision) => !RECORDED_RULINGS[decision.id]).map((decision) => decision.id),
    [],
  );
  for (const [decisionId, optionId] of Object.entries(RECORDED_RULINGS)) {
    assert.ok(decisionById(decisionId).options.some((option) => option.id === optionId));
  }
});

test('M3 route ends at certification and keeps production import outside M3', () => {
  assert.deepEqual(M3_STAGES.map((stage) => stage.number), ['01', '02', '03', '04', '05', '06', '07']);
  assert.match(M3_STAGES.at(-1).exit, /M3_FULL_CORPUS_CERTIFICATION/);
  assert.match(M3_STAGES.at(-1).exit, /Production import remains an M4 step/);
});
