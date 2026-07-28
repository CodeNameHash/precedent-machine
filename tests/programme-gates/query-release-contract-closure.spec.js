const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '../..');
const contracts = fs.readFileSync(
  path.join(ROOT, 'docs/codex-program/canonical-contracts.md'),
  'utf8',
);
const adversarial = fs.readFileSync(
  path.join(ROOT, 'docs/codex-program/adversarial-tests.md'),
  'utf8',
);

test('candidate release closed action grammar includes held-promotion abandonment', () => {
  const closedActions = contracts.match(
    /`canonical_write\(operation=CANDIDATE_RELEASE_FREEZE\)` has only([\s\S]*?)actions\./,
  );
  assert.ok(closedActions, 'candidate release closed action grammar is missing');
  assert.match(closedActions[1], /`ABANDON_GENERATION`/);
  assert.match(closedActions[1], /`ABANDON_HELD_PROMOTION`/);
  assert.match(
    contracts,
    /`ABANDON_GENERATION` applies only before a CandidatePromotionFence is held/,
  );
  assert.match(
    contracts,
    /`ABANDON_HELD_PROMOTION` applies only to the exact\s+pre-activation `HELD\(CURRENT_CANDIDATE\)` fence/,
  );
});

test('query certification binds complete composite shapes and release worst cases', () => {
  for (const required of [
    '`CompositeQueryShapeTemplate`',
    '`ExecutionShapeKey`',
    '`CompositeShapeEquivalenceProof`',
    '`ReleaseQueryExecutionClassRegistry`',
    '`ParameterDomainQuotient`',
    '`WorstCaseWitnessDominanceProof`',
    'without materialising the',
    'Cartesian product of literal tuples',
    'component-wise greater than or equal',
    'incomparable members require separate witnesses',
    'zero database checkout',
  ]) {
    assert.ok(contracts.includes(required), `query closure is missing ${required}`);
  }
});

test('capacity adversary rejects singular-tuple collapse and benign witnesses', () => {
  const capacity = adversarial.match(
    /- `CAPACITY-LOAD-01`:(?<body>[\s\S]*?)(?=\n- `[A-Z0-9-]+-\d{2}`:|\s*$)/,
  );
  assert.ok(capacity, 'CAPACITY-LOAD-01 is missing');
  const body = capacity.groups.body.replace(/\s+/g, ' ');
  for (const required of [
    'same first predicate',
    'different second predicate',
    'complete CompositeShapeEquivalenceProof',
    'Pareto-maximal witness set',
    'benign selective or unselective fixture',
    'refused before database',
  ]) {
    assert.ok(
      body.includes(required),
      `CAPACITY-LOAD-01 is missing ${required}`,
    );
  }
});
