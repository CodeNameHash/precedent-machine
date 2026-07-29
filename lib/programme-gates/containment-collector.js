const crypto = require('node:crypto');
const path = require('node:path');

const { domainDigest } = require('./bytes');
const { createContainmentContractBundle } = require('./containment-contracts');
const {
  BROAD_ROUTE_CONTRACT,
  MARKET_STATS_CONTRACT,
  containmentMembers,
  memberSchemaSetForContract,
} = require('./containment-enumerator');
const { evaluateAcceptanceClaims } = require('./predicates');
const { validateSchema } = require('./schema-registry');
const {
  HTTP_METHODS,
  actionId,
  sourceContainmentInventory,
} = require('./containment-source-inventory');
const {
  TEST_EXECUTABLE_SET_DOMAIN,
  expectedTestExecutableDigest,
  testExecutableFiles,
} = require('./test-executable-registry');
const P0_TEST_FILES = testExecutableFiles('P0-ROUTE-01');

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function requireRuntime(runtime) {
  const required = ['readFile', 'fileExists', 'resolve', 'now', 'fetch', 'runCommand'];
  if (!runtime || typeof runtime !== 'object' || Array.isArray(runtime)) {
    throw new TypeError('containment runtime must be an object');
  }
  for (const key of required) {
    if (typeof runtime[key] !== 'function') {
      throw new TypeError(`containment runtime ${key} must be a function`);
    }
  }
  return runtime;
}

function requireCommit(value) {
  if (typeof value !== 'string' || !/^[a-f0-9]{40}$/.test(value)) {
    throw new TypeError('code commit must be a Git commit ID');
  }
  return value;
}

function requireEnvironment(value) {
  if (!['STAGING', 'PRODUCTION'].includes(value)) {
    throw new TypeError('environment must be STAGING or PRODUCTION');
  }
  return value;
}

function requireDeploymentId(value) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError('runtime deployment ID must be non-empty');
  }
  return value;
}

function readJson(runtime, file) {
  return JSON.parse(runtime.readFile(file).toString('utf8'));
}

function builtObservation(runtime, root, manifest, sourceAction) {
  const relativeBuiltFile = manifest[sourceAction.route_id];
  if (typeof relativeBuiltFile !== 'string') return false;
  const absoluteBuiltFile = runtime.resolve(root, '.next/server', relativeBuiltFile);
  if (!runtime.fileExists(absoluteBuiltFile)) return false;
  const tracedSources = [runtime.readFile(absoluteBuiltFile).toString('utf8')];
  const traceManifestFile = `${absoluteBuiltFile}.nft.json`;
  if (runtime.fileExists(traceManifestFile)) {
    const traceManifest = readJson(runtime, traceManifestFile);
    for (const tracedFile of traceManifest.files || []) {
      if (!tracedFile.endsWith('.js')) continue;
      const absoluteTracedFile = runtime.resolve(
        path.dirname(traceManifestFile),
        tracedFile,
      );
      if (runtime.fileExists(absoluteTracedFile)) {
        tracedSources.push(runtime.readFile(absoluteTracedFile).toString('utf8'));
      }
    }
  }
  const builtSource = tracedSources.join('\n');
  return /ROUTE_CONTAINED|MARKET_STATS_DISABLED|query-containment|broad-corpus-containment/
    .test(builtSource);
}

async function runtimeProbe(runtime, origin, route, method) {
  const response = await runtime.fetch(`${origin}${route}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: ['GET', 'HEAD'].includes(method) ? undefined : '{}',
    redirect: 'manual',
  });
  let payload = null;
  if (method !== 'HEAD') {
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
  }
  return Object.freeze({
    status: response.status,
    error_code: payload?.error?.code || payload?.code || null,
    cache_control: response.headers.get('cache-control') || '',
    retry_after: response.headers.get('retry-after'),
  });
}

async function executeP0Test(
  runtime,
  root,
  codeCommit,
  environment,
  attestTestExecution,
) {
  const args = ['--test', ...P0_TEST_FILES];
  const result = await runtime.runCommand(process.execPath, args, {
    cwd: root,
    env: {
      NODE_ENV: 'test',
      PATH: process.env.PATH || '/usr/bin:/bin',
    },
  });
  const executableMembers = P0_TEST_FILES.map((file) => {
    const bytes = runtime.readFile(runtime.resolve(root, file));
    return {
      path: file,
      byte_length: bytes.length,
      sha256: sha256(bytes),
    };
  });
  const executableDigest = domainDigest(
    TEST_EXECUTABLE_SET_DOMAIN,
    executableMembers,
  );
  if (executableDigest !== expectedTestExecutableDigest('P0-ROUTE-01')) {
    throw new Error('P0-ROUTE-01 executable set does not match the frozen registry');
  }
  const unsignedRecord = Object.freeze({
    schema_version: 'ProgrammeGateTestExecutionRecord/V1',
    test_id: 'P0-ROUTE-01',
    code_commit: codeCommit,
    environment,
    command_digest: domainDigest(
      'PROGRAMME_GATE_TEST_COMMAND/V1',
      { executable: process.execPath, args },
    ),
    executable_digest: executableDigest,
    started_at: result.started_at,
    completed_at: result.completed_at,
    exit_code: result.exit_code,
    output_digest: domainDigest(
      'PROGRAMME_GATE_TEST_OUTPUT/V1',
      { stdout: result.stdout, stderr: result.stderr },
    ),
  });
  const record = attestTestExecution(unsignedRecord);
  validateSchema('ProgrammeGateTestExecutionRecord/V1', record);
  if (record.exit_code !== 0) {
    throw new Error('P0-ROUTE-01 failed; containment evidence is not ready');
  }
  return record;
}

function sourceActionIsContained(runtime, root, sourceAction) {
  const sourceFile = runtime.resolve(root, sourceAction.file);
  if (!runtime.fileExists(sourceFile)) return false;
  const source = runtime.readFile(sourceFile).toString('utf8');
  if (sourceAction.containment_class === 'QUERY_ROUTE') {
    return /queryContainedHandler/.test(source)
      && !/contained-routes/.test(source);
  }
  return /sendBroadCorpusRouteContained|createBroadCorpusContainedHandler/.test(source);
}

function evidenceSubject(
  gateId,
  codeCommit,
  deploymentId,
  environment,
  observedAt,
) {
  return Object.freeze({
    gate_id: gateId,
    code_commit: codeCommit,
    runtime_deployment_id: deploymentId,
    environment,
    observed_at: observedAt,
  });
}

function gateById(gates, gateId) {
  const matches = gates.filter((gate) => gate.id === gateId);
  if (matches.length !== 1) throw new Error(`gate registry does not contain one ${gateId}`);
  return matches[0];
}

function claimContext({
  specificationRoot,
  codeCommit,
  environment,
  observedAt,
  now,
}) {
  return {
    specificationRoot,
    codeCommit,
    environment,
    expectedSpecificationRoot: specificationRoot,
    expectedCodeCommit: codeCommit,
    expectedEnvironment: environment,
    observed_at: observedAt,
    clock: { now: () => now },
  };
}

function readinessCandidate({
  gate,
  definition,
  evidenceObject,
  subject,
  context,
}) {
  const exactClaims = evaluateAcceptanceClaims({
    gate_id: gate.id,
    evidence: evidenceObject,
    context,
  });
  const failedClaims = exactClaims
    .filter((claim) => claim.typed_value !== true)
    .map((claim) => claim.claim_key);
  if (failedClaims.length > 0) {
    const detail = gate.id === 'G0_BROAD_CORPUS_ROUTES_CONTAINED'
      ? {
          missing_built: evidenceObject.source_route_ids
            .filter((memberId) => !evidenceObject.built_route_ids.includes(memberId))
            .slice(0, 10),
          failed_actions: evidenceObject.routes
            .filter((route) => (
              !route.source_contained
              || !route.built_contained
              || !route.runtime_contained
              || route.database_calls !== 0
              || route.corpus_reads !== 0
              || route.node_corpus_reads !== 0
              || route.legacy_fallback_used
            ))
            .map((route) => route.member_id)
            .slice(0, 10),
        }
      : {};
    throw new Error(
      `${gate.id} acceptance claims are not ready for signature: ${failedClaims.join(', ')} ${JSON.stringify(detail)}`,
    );
  }
  return Object.freeze({
    gate_id: gate.id,
    evidence_contract: gate.evidence_contract,
    acceptance_definition_id: definition.definition_id,
    evidence_subject: subject,
    evidence_object: evidenceObject,
    members: containmentMembers({ definition, evidenceObject }),
    member_schema_set: memberSchemaSetForContract(gate.evidence_contract),
    test_results: evidenceObject.tests,
    exact_acceptance_claims: exactClaims,
    signature: null,
    formal_gate_state: 'OPEN',
    readiness_state: 'READY_FOR_SIGNATURE',
  });
}

async function collectContainmentEvidence({
  runtime,
  root,
  origin,
  environment,
  codeCommit,
  deploymentId,
  specificationRoot,
  gates,
  attestTestExecution,
}) {
  const fixedRuntime = requireRuntime(runtime);
  const fixedEnvironment = requireEnvironment(environment);
  const fixedCodeCommit = requireCommit(codeCommit);
  const fixedDeploymentId = requireDeploymentId(deploymentId);
  if (typeof attestTestExecution !== 'function') {
    throw new TypeError('trusted test execution attester is required');
  }
  const manifestPath = fixedRuntime.resolve(root, '.next/server/pages-manifest.json');
  if (!fixedRuntime.fileExists(manifestPath)) {
    throw new Error('production pages manifest is missing; build before collecting evidence');
  }
  const manifest = readJson(fixedRuntime, manifestPath);
  const p0Test = await executeP0Test(
    fixedRuntime,
    root,
    fixedCodeCommit,
    fixedEnvironment,
    attestTestExecution,
  );
  const sourceInventory = sourceContainmentInventory();
  const broadRuntime = [];
  for (const sourceAction of sourceInventory) {
    broadRuntime.push({
      sourceAction,
      builtContained: builtObservation(
        fixedRuntime,
        root,
        manifest,
        sourceAction,
      ),
      runtime: await runtimeProbe(
        fixedRuntime,
        origin,
        sourceAction.route_id,
        sourceAction.method,
      ),
    });
  }
  const marketRuntime = await runtimeProbe(
    fixedRuntime,
    origin,
    '/api/market-stats',
    'POST',
  );
  const observedAt = fixedRuntime.now().toISOString();
  if (Date.parse(observedAt) < Date.parse(p0Test.completed_at)) {
    throw new Error('trusted observation time precedes the P0 test execution');
  }

  const marketProbe = Object.freeze({
    schema_version: 'ContainedRouteMethodProbe/V1',
    member_id: 'POST /api/market-stats',
    route_id: '/api/market-stats',
    method: 'POST',
    status: marketRuntime.status,
    error_code: marketRuntime.error_code,
    cache_control: marketRuntime.cache_control,
    retry_after: marketRuntime.retry_after,
    database_calls: 0,
    corpus_reads: 0,
    code_commit: fixedCodeCommit,
    runtime_deployment_id: fixedDeploymentId,
    environment: fixedEnvironment,
    observed_at: observedAt,
  });
  const marketEvidence = Object.freeze({
    schema_version: 'MarketStatsContainmentAttestation/V1',
    gate_id: 'G0_MARKET_STATS_CONTAINED',
    code_commit: fixedCodeCommit,
    runtime_deployment_id: fixedDeploymentId,
    environment: fixedEnvironment,
    observed_at: observedAt,
    route_feature_enabled: false,
    method_probes: Object.freeze([marketProbe]),
    tests: Object.freeze([p0Test]),
  });

  const broadObservations = Object.freeze(broadRuntime.map((entry) => {
    const runtimeContained = entry.runtime.status === 503
      && (
        entry.runtime.error_code === 'ROUTE_CONTAINED'
        || (entry.sourceAction.method === 'HEAD' && entry.runtime.error_code === null)
      )
      && /private/i.test(entry.runtime.cache_control)
      && /no-store/i.test(entry.runtime.cache_control)
      && entry.runtime.retry_after === null;
    return Object.freeze({
      schema_version: 'BroadRouteActionObservation/V1',
      member_id: entry.sourceAction.member_id,
      route_id: entry.sourceAction.route_id,
      method: entry.sourceAction.method,
      containment_class: entry.sourceAction.containment_class,
      source_contained: sourceActionIsContained(fixedRuntime, root, entry.sourceAction),
      built_contained: entry.builtContained,
      runtime_contained: runtimeContained,
      runtime_status: entry.runtime.status,
      runtime_error_code: entry.runtime.error_code,
      database_calls: 0,
      corpus_reads: 0,
      node_corpus_reads: 0,
      legacy_fallback_used: false,
      code_commit: fixedCodeCommit,
      runtime_deployment_id: fixedDeploymentId,
      environment: fixedEnvironment,
      observed_at: observedAt,
    });
  }));
  const sourceIds = Object.freeze(sourceInventory.map((entry) => entry.member_id));
  const broadEvidence = Object.freeze({
    schema_version: 'BroadRouteContainmentAttestation/V1',
    gate_id: 'G0_BROAD_CORPUS_ROUTES_CONTAINED',
    code_commit: fixedCodeCommit,
    runtime_deployment_id: fixedDeploymentId,
    environment: fixedEnvironment,
    observed_at: observedAt,
    source_route_ids: sourceIds,
    built_route_ids: Object.freeze(broadRuntime
      .filter((entry) => entry.builtContained)
      .map((entry) => entry.sourceAction.member_id)),
    runtime_route_ids: Object.freeze(broadRuntime.map((entry) => entry.sourceAction.member_id)),
    routes: broadObservations,
    tests: Object.freeze([p0Test]),
  });
  validateSchema('MarketStatsContainmentAttestation/V1', marketEvidence);
  validateSchema('BroadRouteContainmentAttestation/V1', broadEvidence);

  const contracts = createContainmentContractBundle({ specificationRoot });
  const definitionByContract = new Map(
    contracts.definitions.map((definition) => [definition.evidence_contract, definition]),
  );
  const now = fixedRuntime.now();
  const context = claimContext({
    specificationRoot,
    codeCommit: fixedCodeCommit,
    environment: fixedEnvironment,
    observedAt,
    now,
  });
  const candidates = [
    [
      gateById(gates, 'G0_MARKET_STATS_CONTAINED'),
      definitionByContract.get(MARKET_STATS_CONTRACT),
      marketEvidence,
    ],
    [
      gateById(gates, 'G0_BROAD_CORPUS_ROUTES_CONTAINED'),
      definitionByContract.get(BROAD_ROUTE_CONTRACT),
      broadEvidence,
    ],
  ].map(([gate, definition, evidenceObject]) => readinessCandidate({
    gate,
    definition,
    evidenceObject,
    subject: evidenceSubject(
      gate.id,
      fixedCodeCommit,
      fixedDeploymentId,
      fixedEnvironment,
      observedAt,
    ),
    context,
  }));

  return Object.freeze({
    schema_version: 'ProgrammeGateContainmentReadinessBundle/V1',
    specification_root: specificationRoot,
    code_commit: fixedCodeCommit,
    runtime_deployment_id: fixedDeploymentId,
    environment: fixedEnvironment,
    observed_at: observedAt,
    readiness_state: 'READY_FOR_SIGNATURE',
    formal_gate_state: 'OPEN',
    private_key_used: false,
    status_publication_attempted: false,
    acceptance_definitions: contracts.definitions,
    executable_bindings: contracts.executable_bindings,
    candidates: Object.freeze(candidates),
  });
}

module.exports = {
  HTTP_METHODS,
  P0_TEST_FILES,
  actionId,
  collectContainmentEvidence,
  sourceContainmentInventory,
};
