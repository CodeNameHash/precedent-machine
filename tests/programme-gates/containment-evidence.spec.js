const assert = require('node:assert/strict');
const test = require('node:test');

const {
  collectContainmentEvidence,
  sourceContainmentInventory,
} = require('../../lib/programme-gates/containment-collector');
const {
  createContainmentContractBundle,
} = require('../../lib/programme-gates/containment-contracts');
const {
  containmentMembers,
  enumerateContainmentExpectedMembers,
  memberSchemaSetForContract,
} = require('../../lib/programme-gates/containment-enumerator');
const { enumerateClosedMembers } = require('../../lib/programme-gates/enumerate');
const {
  evaluateAcceptanceClaims,
} = require('../../lib/programme-gates/predicates');
const {
  validateDeploymentBinding,
} = require('../../lib/programme-gates/containment-runtime');
const {
  ACCEPTANCE_DEFINITION_DESCRIPTORS,
} = require('../../lib/programme-gates/registry');
const {
  validateSchema,
} = require('../../lib/programme-gates/schema-registry');

const ROOT = 'a'.repeat(64);
const COMMIT = 'b'.repeat(40);
const DEPLOYMENT_ID = 'dpl_test_containment';
const OBSERVED_AT = '2026-07-28T01:00:00.000Z';
const TEST_STARTED_AT = '2026-07-28T00:00:00.000Z';
const TEST_COMPLETED_AT = '2026-07-28T00:30:00.000Z';
const GATES = Object.freeze([
  Object.freeze({
    id: 'G0_MARKET_STATS_CONTAINED',
    evidence_contract: 'route-disabled-code-test-live-response/v1',
  }),
  Object.freeze({
    id: 'G0_BROAD_CORPUS_ROUTES_CONTAINED',
    evidence_contract: 'broad-route-inventory-and-containment/v1',
  }),
]);

function fakeResponse(route, method, overrides = {}) {
  const market = route === '/api/market-stats';
  return {
    status: overrides.status ?? 503,
    headers: {
      get(name) {
        if (name.toLowerCase() === 'cache-control') {
          return overrides.cache_control ?? 'private, no-store';
        }
        if (name.toLowerCase() === 'retry-after') {
          return overrides.retry_after ?? null;
        }
        return null;
      },
    },
    async json() {
      return {
        error: {
          code: overrides.error_code
            ?? (market ? 'MARKET_STATS_DISABLED' : 'ROUTE_CONTAINED'),
        },
      };
    },
    method,
  };
}

function fakeRuntime(options = {}) {
  const inventory = sourceContainmentInventory();
  const manifest = Object.fromEntries(
    [...new Set(inventory.map((entry) => entry.route_id))]
      .map((route, index) => [route, `pages/api/contained-${index}.js`]),
  );
  manifest['/api/market-stats'] = 'pages/api/market-stats.js';
  const fetchCalls = [];
  const commandCalls = [];
  return {
    fetchCalls,
    commandCalls,
    readFile(file) {
      if (file.endsWith('.next/server/pages-manifest.json')) {
        return Buffer.from(JSON.stringify(manifest));
      }
      if (file.includes('.next/server/pages/api/')) {
        if (options.missingBuiltRoute
          && file.endsWith(manifest[options.missingBuiltRoute])) {
          return Buffer.from('uncontained');
        }
        return Buffer.from('ROUTE_CONTAINED broad-corpus-containment');
      }
      if (file.includes('/pages/api/query/')
        || file.endsWith('/pages/api/saved-queries.js')
        || file.endsWith('/pages/api/canonical-v2/query.js')) {
        return Buffer.from('queryContainedHandler');
      }
      if (file.includes('/pages/api/')) {
        return Buffer.from('sendBroadCorpusRouteContained createBroadCorpusContainedHandler');
      }
      return Buffer.from(`fixture bytes for ${file}`);
    },
    fileExists(file) {
      return !file.endsWith('.nft.json');
    },
    resolve(...parts) {
      return parts.join('/');
    },
    now() {
      return new Date(OBSERVED_AT);
    },
    async fetch(url, init) {
      const parsed = new URL(url);
      fetchCalls.push({ route: parsed.pathname, method: init.method });
      return fakeResponse(parsed.pathname, init.method, options.runtimeResponse);
    },
    async runCommand(command, args) {
      commandCalls.push({ command, args });
      return {
        started_at: TEST_STARTED_AT,
        completed_at: TEST_COMPLETED_AT,
        exit_code: options.testExitCode ?? 0,
        stdout: 'tests passed',
        stderr: '',
      };
    },
  };
}

function claimContext(candidate, overrides = {}) {
  return {
    specificationRoot: ROOT,
    codeCommit: COMMIT,
    environment: 'PRODUCTION',
    expectedSpecificationRoot: ROOT,
    expectedCodeCommit: COMMIT,
    expectedEnvironment: 'PRODUCTION',
    observed_at: candidate.evidence_object.observed_at,
    clock: { now: () => OBSERVED_AT },
    ...overrides,
  };
}

async function readyBundle(runtime = fakeRuntime()) {
  return collectContainmentEvidence({
    runtime,
    root: '/repo',
    origin: 'https://deal-corpus.example.test',
    environment: 'PRODUCTION',
    codeCommit: COMMIT,
    deploymentId: DEPLOYMENT_ID,
    specificationRoot: ROOT,
    gates: GATES,
  });
}

test('the containment contract bundle activates only two closed definitions', () => {
  const bundle = createContainmentContractBundle({ specificationRoot: ROOT });
  assert.equal(bundle.definitions.length, 2);
  assert.deepEqual(
    bundle.definitions.map((definition) => definition.evidence_contract),
    [
      'route-disabled-code-test-live-response/v1',
      'broad-route-inventory-and-containment/v1',
    ],
  );
  for (const definition of bundle.definitions) {
    assert.equal(
      validateSchema('ProgrammeGateAcceptanceDefinition/V1', definition),
      true,
    );
  }
  assert.deepEqual(
    ACCEPTANCE_DEFINITION_DESCRIPTORS
      .filter((descriptor) => descriptor.activation_state === 'ACTIVE')
      .map((descriptor) => descriptor.gate_id),
    ['G0_MARKET_STATS_CONTAINED', 'G0_BROAD_CORPUS_ROUTES_CONTAINED'],
  );
  assert.ok(ACCEPTANCE_DEFINITION_DESCRIPTORS.slice(2).every(
    (descriptor) => descriptor.activation_state === 'BLOCKED_PENDING_EXECUTABLE_BINDINGS',
  ));
});

test('closed enumeration binds every observation and execution exactly once', async () => {
  const bundle = await readyBundle();
  for (const candidate of bundle.candidates) {
    const definition = bundle.acceptance_definitions.find(
      (entry) => entry.evidence_contract === candidate.evidence_contract,
    );
    const expectedMembers = enumerateContainmentExpectedMembers({
      definition,
      evidenceObject: candidate.evidence_object,
    });
    const members = containmentMembers({
      definition,
      evidenceObject: candidate.evidence_object,
    });
    assert.deepEqual(
      enumerateClosedMembers({ expectedMembers, members }),
      enumerateClosedMembers({
        expectedMembers,
        members: [...members].reverse(),
      }),
    );
    assert.deepEqual(
      candidate.member_schema_set,
      memberSchemaSetForContract(candidate.evidence_contract),
    );
    assert.throws(
      () => enumerateClosedMembers({
        expectedMembers,
        members: members.slice(1),
      }),
      /missing required member_id/,
    );
  }
});

test('the collector emits unsigned readiness and never formal PASS', async () => {
  const runtime = fakeRuntime();
  const bundle = await readyBundle(runtime);
  assert.equal(bundle.readiness_state, 'READY_FOR_SIGNATURE');
  assert.equal(bundle.formal_gate_state, 'OPEN');
  assert.equal(bundle.runtime_deployment_id, DEPLOYMENT_ID);
  assert.equal(bundle.private_key_used, false);
  assert.equal(bundle.status_publication_attempted, false);
  assert.equal(bundle.candidates.length, 2);
  assert.equal(runtime.commandCalls.length, 1);
  assert.equal(
    runtime.fetchCalls.length,
    sourceContainmentInventory().length + 1,
  );
  for (const candidate of bundle.candidates) {
    assert.equal(candidate.signature, null);
    assert.equal(candidate.formal_gate_state, 'OPEN');
    assert.equal(candidate.readiness_state, 'READY_FOR_SIGNATURE');
    assert.ok(candidate.exact_acceptance_claims.every(
      (claim) => claim.typed_value === true,
    ));
  }
  const broad = bundle.candidates.find(
    (candidate) => candidate.gate_id === 'G0_BROAD_CORPUS_ROUTES_CONTAINED',
  ).evidence_object;
  assert.deepEqual(broad.source_route_ids, broad.built_route_ids);
  assert.deepEqual(broad.source_route_ids, broad.runtime_route_ids);
});

test('one database read, a fallback or an inventory mismatch fails claims', async () => {
  const bundle = await readyBundle();
  const broadCandidate = bundle.candidates.find(
    (candidate) => candidate.gate_id === 'G0_BROAD_CORPUS_ROUTES_CONTAINED',
  );
  for (const evidence of [
    {
      ...broadCandidate.evidence_object,
      routes: broadCandidate.evidence_object.routes.map((route, index) => (
        index === 0 ? { ...route, database_calls: 1 } : route
      )),
    },
    {
      ...broadCandidate.evidence_object,
      routes: broadCandidate.evidence_object.routes.map((route, index) => (
        index === 0 ? { ...route, legacy_fallback_used: true } : route
      )),
    },
    {
      ...broadCandidate.evidence_object,
      built_route_ids: broadCandidate.evidence_object.built_route_ids.slice(1),
    },
  ]) {
    const claims = evaluateAcceptanceClaims({
      gate_id: broadCandidate.gate_id,
      evidence,
      context: claimContext(broadCandidate),
    });
    assert.ok(claims.some((claim) => claim.typed_value === false));
  }
});

test('stale commit, stale time and hand-written PASS fail closed', async () => {
  const bundle = await readyBundle();
  const marketCandidate = bundle.candidates.find(
    (candidate) => candidate.gate_id === 'G0_MARKET_STATS_CONTAINED',
  );
  const staleCommitClaims = evaluateAcceptanceClaims({
    gate_id: marketCandidate.gate_id,
    evidence: marketCandidate.evidence_object,
    context: claimContext(marketCandidate, {
      codeCommit: 'c'.repeat(40),
    }),
  });
  assert.ok(staleCommitClaims.every((claim) => claim.typed_value === false));

  const staleTimeClaims = evaluateAcceptanceClaims({
    gate_id: marketCandidate.gate_id,
    evidence: marketCandidate.evidence_object,
    context: claimContext(marketCandidate, {
      clock: { now: () => '2026-07-29T01:00:00.001Z' },
    }),
  });
  assert.ok(staleTimeClaims.every((claim) => claim.typed_value === false));

  assert.throws(
    () => validateSchema('ProgrammeGateTestExecutionRecord/V1', {
      test_id: 'P0-ROUTE-01',
      state: 'PASS',
    }),
    /validation failed/,
  );
});

test('build drift, a live fallback or a failed test prevents readiness', async () => {
  const firstRoute = sourceContainmentInventory()[0].route_id;
  await assert.rejects(
    () => readyBundle(fakeRuntime({ missingBuiltRoute: firstRoute })),
    /acceptance claims are not ready/,
  );
  await assert.rejects(
    () => readyBundle(fakeRuntime({
      runtimeResponse: {
        status: 200,
        error_code: 'LEGACY_FALLBACK',
        cache_control: 'public, max-age=60',
      },
    })),
    /acceptance claims are not ready/,
  );
  await assert.rejects(
    () => readyBundle(fakeRuntime({ testExitCode: 1 })),
    /P0-ROUTE-01 failed/,
  );
});

test('deployment proof requires exact READY runtime, commit and specification metadata', () => {
  const deployment = {
    id: DEPLOYMENT_ID,
    readyState: 'READY',
    target: 'production',
    meta: {
      programmeCodeCommit: COMMIT,
      programmeSpecificationRoot: ROOT,
    },
  };
  const input = {
    deployment,
    originDeployment: deployment,
    deploymentId: DEPLOYMENT_ID,
    environment: 'PRODUCTION',
    codeCommit: COMMIT,
    specificationRoot: ROOT,
  };
  assert.equal(validateDeploymentBinding(input), true);
  for (const alteredDeployment of [
    { ...deployment, id: 'dpl_other' },
    { ...deployment, readyState: 'ERROR' },
    { ...deployment, target: null },
    {
      ...deployment,
      meta: { ...deployment.meta, programmeCodeCommit: 'c'.repeat(40) },
    },
    {
      ...deployment,
      meta: { ...deployment.meta, programmeSpecificationRoot: 'd'.repeat(64) },
    },
    { ...deployment, meta: null },
  ]) {
    assert.throws(
      () => validateDeploymentBinding({ ...input, deployment: alteredDeployment }),
    );
  }
  assert.throws(
    () => validateDeploymentBinding({
      ...input,
      originDeployment: { ...deployment, id: 'dpl_other' },
    }),
  );
});
