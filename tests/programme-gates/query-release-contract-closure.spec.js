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
const gates = fs.readFileSync(
  path.join(ROOT, 'docs/codex-program/programme-gates.yaml'),
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

test('capacity scale fixture jointly realises and measures all eight dimensions', () => {
  const capacityContract = contracts.match(
    /`CapacityManifest` additionally owns(?<body>[\s\S]*?)(?=\n`SupportedQueryShapeRegistry`)/,
  );
  assert.ok(capacityContract, 'CapacityManifest scale contract is missing');
  const body = capacityContract.groups.body.replace(/\s+/g, ' ');
  for (const required of [
    'deal, observation, metric-slot, aggregate, serving-row, cohort-member, indexed-row and indexed-byte',
    'Its first seven fields are therefore exactly ten times',
    '`MaximumScaleFixtureRecipe`',
    '`FixtureExpansionArchetype`',
    'all seven target values true in one namespace at the same time',
    'complete row-lineage root',
    'joint-distribution cell root',
    'sums `pg_relation_size` for each distinct selected index',
    'measured eight-field output tuple',
    'No solution means the CapacityManifest is unrealizable',
  ]) {
    assert.ok(body.includes(required), `capacity derivation is missing ${required}`);
  }

  const capacityAdversary = adversarial.match(
    /- `CAPACITY-LOAD-01`:(?<body>[\s\S]*?)(?=\n- `[A-Z0-9-]+-\d{2}`:|\s*$)/,
  );
  const adversarialBody = capacityAdversary.groups.body.replace(/\s+/g, ' ');
  for (const required of [
    'first seven dimensions must each equal ten times',
    'measure its exact indexed bytes',
    'Multiplying the N indexed-byte value by ten',
    'one physically loaded fixture',
    'expansion-archetype constraint',
    'source and parent fixture lineage',
    'Two independent enumerators',
    '`pg_relation_size`',
  ]) {
    assert.ok(
      adversarialBody.includes(required),
      `capacity adversary is missing ${required}`,
    );
  }
});

test('client-only transitions are disjoint from database and API execution classes', () => {
  const body = contracts.replace(/\s+/g, ' ');
  for (const required of [
    '`QueryExecutionKind` is `DATABASE_API`',
    '`QueryExecutionKind` is `CLIENT_ONLY_NO_SQL_NO_API`',
    '`SupportedClientTransitionRegistry`',
    '`GovernedQueryActionCoverageRoot`',
    'no admission, network request, API invocation, cache lookup or database checkout',
    'can never produce or satisfy a release execution class',
    '`ClientTransitionPerformanceRegistry`',
    'no request-byte boundary and no API sample set',
  ]) {
    assert.ok(body.includes(required), `client transition closure is missing ${required}`);
  }

  const capacity = adversarial.match(
    /- `CAPACITY-LOAD-01`:(?<body>[\s\S]*?)(?=\n- `[A-Z0-9-]+-\d{2}`:|\s*$)/,
  );
  assert.ok(capacity, 'CAPACITY-LOAD-01 is missing');
  const adversarialBody = capacity.groups.body.replace(/\s+/g, ' ');
  for (const required of [
    '`DATABASE_API` or `CLIENT_ONLY_NO_SQL_NO_API`',
    'Carried-response navigation belongs only to SupportedClientTransitionRegistry',
    'zero admission, network, API, cache and database counters',
    'A client transition has no API sample set, scale or witness',
  ]) {
    assert.ok(
      adversarialBody.includes(required),
      `client transition adversary is missing ${required}`,
    );
  }
});

test('pre-import soak uses a closed staging load authority and the exact serving path', () => {
  const loadAuthority = contracts.match(
    /Database load certification has its own pre-import authority\.(?<body>[\s\S]*?)(?=\nThe soak manifest selects)/,
  );
  assert.ok(loadAuthority, 'load-certification authority contract is missing');
  const body = loadAuthority.groups.body.replace(/\s+/g, ' ');
  for (const required of [
    '`LoadCertificationReleaseState`',
    '`N_CAPACITY`, `TEN_N_CAPACITY` and `MAXIMUM_SCALE`',
    '`LoadCertificationNamespaceSeal`',
    '`LoadFixtureBuildPolicy`',
    '`OPEN_LOAD_NAMESPACE`, `WRITE_LOAD_FIXTURE_BATCH`, `FINALISE_LOAD_NAMESPACE`',
    '`OPEN_LOAD_BLOCKED`, `ISSUE_LOAD_READY` and `REVOKE_LOAD_AND_DRAIN`',
    '`LoadCertificationFenceVersion(state=BLOCKED)`',
    '`LOAD_CERTIFICATION_READY`',
    '`ServingExecutionAuthority` union',
    '`PRODUCTION_READY_CANONICAL | LOAD_CERTIFICATION_READY`',
    '`LoadRouteEquivalenceAttestation`',
    'byte-identical to the corresponding production branch',
    'all three control heads terminal, BLOCKED and drained',
  ]) {
    assert.ok(body.includes(required), `load authority is missing ${required}`);
  }

  const capacity = adversarial.match(
    /- `CAPACITY-LOAD-01`:(?<body>[\s\S]*?)(?=\n- `[A-Z0-9-]+-\d{2}`:|\s*$)/,
  );
  assert.ok(capacity, 'CAPACITY-LOAD-01 is missing');
  const adversarialBody = capacity.groups.body.replace(/\s+/g, ' ');
  for (const required of [
    'before ProductionImportAttestation exists',
    'internal LoadCertificationRouteDefinition',
    'except for the one closed authority predicate',
    'A load fence cannot satisfy import, readiness, promotion, cutover, ordinary serving or completion',
    'all three fences are BLOCKED',
  ]) {
    assert.ok(
      adversarialBody.includes(required),
      `load-authority adversary is missing ${required}`,
    );
  }
});

test('execution class lookup is input-keyed and resolves literals before checkout', () => {
  const resolver = contracts.match(
    /The two independent release classifiers also compile one immutable(?<body>[\s\S]*?)(?=\n`DeploymentManifest` binds)/,
  );
  assert.ok(resolver, 'execution-class resolver contract is missing');
  const body = resolver.groups.body.replace(/\s+/g, ' ');
  for (const required of [
    '`QueryExecutionClassResolverProjection`',
    '`ExecutionClassResolverLookupKey',
    'release_or_load_release_selector, complete ExecutionShapeKey, classifier_program_version',
    'contains no quotient-member, selectivity, correlation, cardinality, release-execution-class or physical-plan output',
    '`LiteralClassifierProgram`',
    'Every terminal directly names one `ResolvedExecutionClass`',
    'never an input to lookup',
    'before an admission lease or database checkout',
    'exactly one ExecutionClassResolverLookupKey lookup',
    'returns `UNSUPPORTED_QUERY_SHAPE` with zero database checkout',
    'expected fingerprint cannot prove it',
  ]) {
    assert.ok(body.includes(required), `execution-class resolver is missing ${required}`);
  }

  const lookupFormula = body.match(
    /ExecutionClassResolverLookupKey = H\((?<formula>.*?)\)`\. It contains no/,
  );
  assert.ok(lookupFormula, 'input-side resolver lookup formula is missing');
  for (const forbidden of [
    'quotient',
    'selectivity',
    'correlation',
    'cardinality',
    'physical-plan',
  ]) {
    assert.ok(
      !lookupFormula.groups.formula.includes(forbidden),
      `resolver lookup formula circularly includes ${forbidden}`,
    );
  }

  const capacity = adversarial.match(
    /- `CAPACITY-LOAD-01`:(?<body>[\s\S]*?)(?=\n- `[A-Z0-9-]+-\d{2}`:|\s*$)/,
  );
  const adversarialBody = capacity.groups.body.replace(/\s+/g, ' ');
  for (const required of [
    'lookup key must not contain a quotient member',
    'same input-side lookup and reach their different exact terminal classes',
    'zero database checkout',
    'expected plan fingerprint cannot satisfy the independent',
  ]) {
    assert.ok(
      adversarialBody.includes(required),
      `execution-class adversary is missing ${required}`,
    );
  }
});

test('deployment parity binds production statistics and actual live plans', () => {
  const body = contracts.replace(/\s+/g, ' ');
  for (const required of [
    'the certified release-statistics root',
    'the actual production PostgreSQL planner',
    'observed production physical-plan-fingerprint root',
    'exact equality of the certified and production statistics roots',
    'PostCutoverSmokeAttestation repeats the live-plan probe',
    'ActivationDeploymentParityRecheck/V1',
    'expires_at` is no later than ten minutes after `issued_at',
    'actual production PostgreSQL planner reruns the complete class-and-worst-case-witness live-plan probe',
  ]) {
    assert.ok(body.includes(required), `deployment parity is missing ${required}`);
  }
  for (const required of [
    'production_release_statistics_root_equal',
    'live_physical_plan_fingerprint_root_equal',
    'live_query_plan_smoke_equal',
    'activation_parity_recheck_fresh_and_current',
    'DEPLOYMENT-PARITY-FRESHNESS-01',
    'required_adversarial_tests: [POST-ACTIVATION-CONTROLLER-01, DEPLOY-CUTOVER-01]',
  ]) {
    assert.ok(gates.includes(required), `programme gate is missing ${required}`);
  }
});

test('later-cutover readiness and attested-import abandonment have closed authorities', () => {
  const body = contracts.replace(/\s+/g, ' ');
  for (const required of [
    '`ISSUE_ONGOING_RELEASE_READINESS` is its sole producer',
    '`PM/ONGOING_RELEASE_READINESS/V2`',
    '`DEPLOYMENT_READINESS_ISSUER` role',
    '`OngoingReleaseReadinessSlot/V1` is part of `GlobalMutableAuthorityRegistry`',
    '`EMPTY`, `ISSUED`, `CONSUMED` and `REVOKED`',
    '`ATTESTED_DEPLOYMENT_PARITY_FAILURE`',
    'CAS the import head from `ATTESTED` to terminal `ABANDONED`',
  ]) {
    assert.ok(body.includes(required), `release authority closure is missing ${required}`);
  }
  for (const required of [
    '`ONGOING-READINESS-AUTHORITY-01`',
    '`POST-ATTESTATION-ABANDONMENT-01`',
  ]) {
    assert.ok(adversarial.includes(required), `release adversary is missing ${required}`);
  }
});

test('certified release import grammar contains exactly eight actions', () => {
  const importContract = contracts.match(
    /For `CERTIFIED_RELEASE_IMPORT_BATCH`, OperationActionRegistry contains(?<body>[\s\S]*?)(?=\n- `ProductionImportFailureEvidence`)/,
  );
  assert.ok(importContract, 'certified release import grammar is missing');
  const body = importContract.groups.body;
  const declaration = body.match(/exactly eight top-level actions: (?<actions>[\s\S]*?)\./);
  assert.ok(declaration, 'certified release import eight-action declaration is missing');
  const actions = [...declaration.groups.actions.matchAll(/`([A-Z_]+)`/g)]
    .map((match) => match[1]);
  assert.deepEqual(actions, [
    'OPEN_IMPORT',
    'VERIFY_PRODUCTION_BLOB_AVAILABILITY',
    'IMPORT_MEMBER_BATCH',
    'BUILD_IMPORT_PARITY_BATCH',
    'SEAL_IMPORT',
    'BUILD_IMPORT_SEMANTIC_PARITY_BATCH',
    'ATTEST_IMPORT',
    'ABANDON_IMPORT',
  ]);
  assert.match(body, /exact eight-action\s+top-level set/);
  assert.match(body, /A ninth action/);
  assert.doesNotMatch(body, /seven-action\s+top-level set/);
  assert.doesNotMatch(body, /An eighth action/);
});
