const assert = require('node:assert/strict');
const test = require('node:test');

const {
  COLD_REVIEW_TASKS,
  OUTPUT_SCHEMA,
} = require('../../lib/programme-gates/cold-review-tasks');
const { REVIEW_LANES } = require('../../lib/programme-gates/registry');

test('five registered cold prompts are lane-specific and contain no prior conclusions', () => {
  assert.deepEqual(
    COLD_REVIEW_TASKS.map((task) => [task.lane_id, task.registered_prompt_id]),
    REVIEW_LANES.map((lane) => [lane.lane_id, lane.registered_prompt_id]),
  );
  assert.equal(new Set(COLD_REVIEW_TASKS.map((task) => task.prompt)).size, 5);
  for (const task of COLD_REVIEW_TASKS) {
    assert.match(task.prompt, /G0 start-safety/);
    assert.match(task.prompt, /P1 contract freeze/);
    assert.match(task.prompt, /remain OPEN/);
    assert.match(task.prompt, /outside this G0 disposition/);
    assert.match(task.prompt, /bypass a later OPEN gate/);
    assert.match(task.prompt, /Do not modify files/);
    assert.match(task.prompt, /Do not use prior review findings or conclusions/);
    assert.doesNotMatch(task.prompt, /earlier review (passed|failed)|reviewer found/i);
  }
});

test('cold review output is closed and terminal', () => {
  assert.equal(OUTPUT_SCHEMA.additionalProperties, false);
  assert.deepEqual(OUTPUT_SCHEMA.required, ['disposition', 'findings']);
  assert.deepEqual(OUTPUT_SCHEMA.properties.disposition.enum, ['PASS', 'FAIL']);
  assert.equal(OUTPUT_SCHEMA.properties.findings.items.additionalProperties, false);
  assert.deepEqual(
    OUTPUT_SCHEMA.properties.findings.items.required,
    ['severity', 'code', 'message', 'evidence'],
  );
});
