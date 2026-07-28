const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');

const {
  collectContainmentEvidence,
  sourceContainmentInventory,
} = require('../../lib/programme-gates/containment-collector');
const {
  createContainmentContractBundle,
} = require('../../lib/programme-gates/containment-contracts');
const {
  buildContainmentEvidenceSigningRequest,
  createContainmentSigningRequestAuthority,
} = require('../../lib/programme-gates/containment-signing-request');
const {
  createContainmentSignedPreflightAuthority,
  preflightContainmentEvidenceSignature,
} = require('../../lib/programme-gates/containment-signed-preflight');
const {
  buildContainmentStatusReadiness,
  createContainmentStatusReadinessAuthority,
} = require('../../lib/programme-gates/containment-status-readiness');
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
  REGISTRY_DIGESTS,
} = require('../../lib/programme-gates/registry');
const {
  validateSchema,
} = require('../../lib/programme-gates/schema-registry');
const {
  EVIDENCE_SIGNATURE_DOMAIN,
  EVIDENCE_SIGNATURE_ROLE,
} = require('../../lib/programme-gates/validator');
const {
  verifySignature,
} = require('../../lib/programme-gates/signatures');
const {
  attachProgrammeGateStatusSignature,
} = require('../../lib/programme-gates/status');

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
    required_evidence_object_type: 'MarketStatsContainmentAttestation',
    acceptance_claims: Object.freeze([
      'feature_gate_off',
      'live_route_zero_corpus_reads',
      'containment_test_pass',
    ]),
    required_adversarial_tests: Object.freeze(['P0-ROUTE-01']),
  }),
  Object.freeze({
    id: 'G0_BROAD_CORPUS_ROUTES_CONTAINED',
    evidence_contract: 'broad-route-inventory-and-containment/v1',
    required_evidence_object_type: 'BroadRouteContainmentAttestation',
    acceptance_claims: Object.freeze([
      'source_built_and_runtime_route_inventories_equal',
      'every_broad_route_contained',
      'zero_broad_node_fallback',
    ]),
    required_adversarial_tests: Object.freeze(['P0-ROUTE-01']),
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

test('a trusted public-key binding produces an exact unsigned signing frame without key use', async () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const keyRegistry = {
    schema_version: 'TrustedProgrammeGatePublicKeys/V1',
    registry_state: 'ACTIVE',
    keys: [{
      key_id: 'TEST_CONTAINMENT_VALIDATOR',
      algorithm: 'Ed25519',
      public_key_pem: publicKey.export({ format: 'pem', type: 'spki' }).toString('utf8'),
      permitted_roles: [EVIDENCE_SIGNATURE_ROLE],
      permitted_domains: [EVIDENCE_SIGNATURE_DOMAIN],
      valid_from: '2026-07-27T00:00:00.000Z',
      valid_until: '2026-07-29T00:00:00.000Z',
      revoked_at: null,
    }],
  };
  const authority = createContainmentSigningRequestAuthority({
    keyRegistry,
    validatorConfigurationDigest: REGISTRY_DIGESTS.validator_configuration,
    validatorExecutableDigest: 'e'.repeat(64),
    validatorKeyId: 'TEST_CONTAINMENT_VALIDATOR',
    verificationTime: OBSERVED_AT,
  });
  const bundle = await readyBundle();
  for (const candidate of bundle.candidates) {
    const gate = GATES.find((entry) => entry.id === candidate.gate_id);
    const request = buildContainmentEvidenceSigningRequest({
      authority,
      bundle,
      candidate,
      gate,
    });
    assert.equal(request.readiness_state, 'READY_FOR_EXTERNAL_SIGNATURE');
    assert.equal(request.formal_gate_state, 'OPEN');
    assert.equal(request.private_key_used, false);
    assert.equal(request.signature, null);
    assert.equal(request.unsigned_envelope.signature, undefined);
    assert.equal(request.unsigned_envelope.terminal_state, 'PASS');
    assert.equal(request.unsigned_envelope.code_commit, COMMIT);
    assert.equal(request.unsigned_envelope.environment, 'PRODUCTION');
    assert.equal(Object.isFrozen(request), true);

    const signature = crypto.sign(
      null,
      Buffer.from(request.signing_frame_base64, 'base64'),
      privateKey,
    ).toString('base64');
    assert.equal(verifySignature({
      keyRegistry,
      keyId: request.unsigned_envelope.validator_key_id,
      role: request.signing_role,
      domain: request.signing_domain,
      payload: request.unsigned_envelope,
      signature,
      at: OBSERVED_AT,
    }), true);
  }
});

test('signing-request construction refuses untrusted keys, drift and non-ready candidates', async () => {
  const { publicKey } = crypto.generateKeyPairSync('ed25519');
  const key = {
    key_id: 'TEST_CONTAINMENT_VALIDATOR',
    algorithm: 'Ed25519',
    public_key_pem: publicKey.export({ format: 'pem', type: 'spki' }).toString('utf8'),
    permitted_roles: [EVIDENCE_SIGNATURE_ROLE],
    permitted_domains: [EVIDENCE_SIGNATURE_DOMAIN],
    valid_from: '2026-07-27T00:00:00.000Z',
    valid_until: '2026-07-29T00:00:00.000Z',
    revoked_at: null,
  };
  assert.throws(
    () => createContainmentSigningRequestAuthority({
      keyRegistry: {
        schema_version: 'TrustedProgrammeGatePublicKeys/V1',
        registry_state: 'EMPTY_NOT_ACTIVATED',
        keys: [],
      },
      validatorConfigurationDigest: REGISTRY_DIGESTS.validator_configuration,
      validatorExecutableDigest: 'e'.repeat(64),
      validatorKeyId: key.key_id,
      verificationTime: OBSERVED_AT,
    }),
    /not active/,
  );
  assert.throws(
    () => createContainmentSigningRequestAuthority({
      keyRegistry: {
        schema_version: 'TrustedProgrammeGatePublicKeys/V1',
        registry_state: 'ACTIVE',
        keys: [key],
      },
      validatorConfigurationDigest: 'f'.repeat(64),
      validatorExecutableDigest: 'e'.repeat(64),
      validatorKeyId: key.key_id,
      verificationTime: OBSERVED_AT,
    }),
    /not the registered configuration/,
  );

  const authority = createContainmentSigningRequestAuthority({
    keyRegistry: {
      schema_version: 'TrustedProgrammeGatePublicKeys/V1',
      registry_state: 'ACTIVE',
      keys: [key],
    },
    validatorConfigurationDigest: REGISTRY_DIGESTS.validator_configuration,
    validatorExecutableDigest: 'e'.repeat(64),
    validatorKeyId: key.key_id,
    verificationTime: OBSERVED_AT,
  });
  const bundle = await readyBundle();
  const candidate = bundle.candidates[0];
  assert.throws(
    () => buildContainmentEvidenceSigningRequest({
      authority,
      bundle,
      candidate: { ...candidate, formal_gate_state: 'PASS' },
      gate: GATES[0],
    }),
    /only unsigned OPEN readiness/,
  );
  assert.throws(
    () => buildContainmentEvidenceSigningRequest({
      authority,
      bundle,
      candidate: {
        ...candidate,
        members: candidate.members.slice(1),
      },
      gate: GATES[0],
    }),
    /missing required member_id/,
  );
  assert.throws(
    () => buildContainmentEvidenceSigningRequest({
      authority,
      bundle,
      candidate: {
        ...candidate,
        exact_acceptance_claims: candidate.exact_acceptance_claims.map((claim, index) => (
          index === 0 ? { ...claim, typed_value: false } : claim
        )),
      },
      gate: GATES[0],
    }),
    /claims are not exact passing measurements/,
  );
  assert.throws(
    () => buildContainmentEvidenceSigningRequest({
      authority,
      bundle,
      candidate: {
        ...candidate,
        evidence_object: {
          ...candidate.evidence_object,
          route_feature_enabled: true,
        },
      },
      gate: GATES[0],
    }),
    /validation failed/,
  );
});

test('an external signature passes full evidence preflight without publishing gate status', async () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const validatorExecutableDigest = 'e'.repeat(64);
  const keyRegistry = {
    schema_version: 'TrustedProgrammeGatePublicKeys/V1',
    registry_state: 'ACTIVE',
    keys: [{
      key_id: 'TEST_CONTAINMENT_VALIDATOR',
      algorithm: 'Ed25519',
      public_key_pem: publicKey.export({ format: 'pem', type: 'spki' }).toString('utf8'),
      permitted_roles: [EVIDENCE_SIGNATURE_ROLE],
      permitted_domains: [EVIDENCE_SIGNATURE_DOMAIN],
      valid_from: '2026-07-27T00:00:00.000Z',
      valid_until: '2026-07-29T00:00:00.000Z',
      revoked_at: null,
    }],
  };
  const signingAuthority = createContainmentSigningRequestAuthority({
    keyRegistry,
    validatorConfigurationDigest: REGISTRY_DIGESTS.validator_configuration,
    validatorExecutableDigest,
    validatorKeyId: 'TEST_CONTAINMENT_VALIDATOR',
    verificationTime: OBSERVED_AT,
  });
  const preflightAuthority = createContainmentSignedPreflightAuthority({
    keyRegistry,
    validatorExecutableDigests: [validatorExecutableDigest],
    verificationTime: OBSERVED_AT,
  });
  const bundle = await readyBundle();

  for (const candidate of bundle.candidates) {
    const gate = GATES.find((entry) => entry.id === candidate.gate_id);
    const signingRequest = buildContainmentEvidenceSigningRequest({
      authority: signingAuthority,
      bundle,
      candidate,
      gate,
    });
    const signature = crypto.sign(
      null,
      Buffer.from(signingRequest.signing_frame_base64, 'base64'),
      privateKey,
    ).toString('base64');
    const result = preflightContainmentEvidenceSignature({
      authority: preflightAuthority,
      bundle,
      candidate,
      gate,
      signingRequest,
      signature,
    });

    assert.equal(result.evidence_validation.valid, true);
    assert.equal(result.evidence_validation_state, 'PASS');
    assert.equal(result.formal_gate_state, 'OPEN');
    assert.equal(result.private_key_used, false);
    assert.equal(result.status_publication_attempted, false);
    assert.equal(result.signed_envelope.signature, signature);
    assert.equal(Object.isFrozen(result), true);
  }
});

test('signed evidence preflight refuses invalid signatures, drift and injected authority', async () => {
  const { publicKey } = crypto.generateKeyPairSync('ed25519');
  const validatorExecutableDigest = 'e'.repeat(64);
  const keyRegistry = {
    schema_version: 'TrustedProgrammeGatePublicKeys/V1',
    registry_state: 'ACTIVE',
    keys: [{
      key_id: 'TEST_CONTAINMENT_VALIDATOR',
      algorithm: 'Ed25519',
      public_key_pem: publicKey.export({ format: 'pem', type: 'spki' }).toString('utf8'),
      permitted_roles: [EVIDENCE_SIGNATURE_ROLE],
      permitted_domains: [EVIDENCE_SIGNATURE_DOMAIN],
      valid_from: '2026-07-27T00:00:00.000Z',
      valid_until: '2026-07-29T00:00:00.000Z',
      revoked_at: null,
    }],
  };
  const signingAuthority = createContainmentSigningRequestAuthority({
    keyRegistry,
    validatorConfigurationDigest: REGISTRY_DIGESTS.validator_configuration,
    validatorExecutableDigest,
    validatorKeyId: 'TEST_CONTAINMENT_VALIDATOR',
    verificationTime: OBSERVED_AT,
  });
  const authority = createContainmentSignedPreflightAuthority({
    keyRegistry,
    validatorExecutableDigests: [validatorExecutableDigest],
    verificationTime: OBSERVED_AT,
  });
  const bundle = await readyBundle();
  const candidate = bundle.candidates[0];
  const gate = GATES[0];
  const signingRequest = buildContainmentEvidenceSigningRequest({
    authority: signingAuthority,
    bundle,
    candidate,
    gate,
  });
  const invalidSignature = Buffer.alloc(64, 9).toString('base64');

  const invalid = preflightContainmentEvidenceSignature({
    authority,
    bundle,
    candidate,
    gate,
    signingRequest,
    signature: invalidSignature,
  });
  assert.equal(invalid.evidence_validation_state, 'OPEN');
  assert.equal(invalid.evidence_validation.reason_code, 'SIGNATURE_NOT_TRUSTED');
  assert.equal(invalid.signed_envelope, null);

  const drifted = preflightContainmentEvidenceSignature({
    authority,
    bundle,
    candidate,
    gate,
    signingRequest: {
      ...signingRequest,
      signing_frame_sha256: 'f'.repeat(64),
    },
    signature: invalidSignature,
  });
  assert.equal(drifted.evidence_validation.reason_code, 'SIGNING_REQUEST_MISMATCH');
  assert.equal(drifted.formal_gate_state, 'OPEN');

  assert.throws(
    () => preflightContainmentEvidenceSignature({
      authority: {
        keyRegistry,
        validatorExecutableDigests: [validatorExecutableDigest],
        verificationTime: OBSERVED_AT,
      },
      bundle,
      candidate,
      gate,
      signingRequest,
      signature: invalidSignature,
    }),
    /closed containment signed-evidence preflight authority/,
  );
  assert.throws(
    () => createContainmentSignedPreflightAuthority({
      keyRegistry,
      validatorExecutableDigests: [validatorExecutableDigest],
      verificationTime: OBSERVED_AT,
      privateKey: 'forbidden',
    }),
    /closed input/,
  );
});

test('two validated containment envelopes produce only two PASS rows in unsigned status', async () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const validatorExecutableDigest = 'e'.repeat(64);
  const keyRegistry = {
    schema_version: 'TrustedProgrammeGatePublicKeys/V1',
    registry_state: 'ACTIVE',
    keys: [{
      key_id: 'TEST_CONTAINMENT_VALIDATOR',
      algorithm: 'Ed25519',
      public_key_pem: publicKey.export({ format: 'pem', type: 'spki' }).toString('utf8'),
      permitted_roles: [EVIDENCE_SIGNATURE_ROLE],
      permitted_domains: [EVIDENCE_SIGNATURE_DOMAIN],
      valid_from: '2026-07-27T00:00:00.000Z',
      valid_until: '2026-07-29T00:00:00.000Z',
      revoked_at: null,
    }],
  };
  const signingAuthority = createContainmentSigningRequestAuthority({
    keyRegistry,
    validatorConfigurationDigest: REGISTRY_DIGESTS.validator_configuration,
    validatorExecutableDigest,
    validatorKeyId: 'TEST_CONTAINMENT_VALIDATOR',
    verificationTime: OBSERVED_AT,
  });
  const preflightAuthority = createContainmentSignedPreflightAuthority({
    keyRegistry,
    validatorExecutableDigests: [validatorExecutableDigest],
    verificationTime: OBSERVED_AT,
  });
  const statusAuthority = createContainmentStatusReadinessAuthority({
    codeCommit: COMMIT,
    environment: 'PRODUCTION',
    keyRegistry,
    specificationRoot: ROOT,
    validatorExecutableDigest,
    validatorKeyId: 'TEST_CONTAINMENT_VALIDATOR',
    verificationTime: OBSERVED_AT,
  });
  const bundle = await readyBundle();
  const signedPreflights = bundle.candidates.map((candidate) => {
    const gate = GATES.find((entry) => entry.id === candidate.gate_id);
    const signingRequest = buildContainmentEvidenceSigningRequest({
      authority: signingAuthority,
      bundle,
      candidate,
      gate,
    });
    return preflightContainmentEvidenceSignature({
      authority: preflightAuthority,
      bundle,
      candidate,
      gate,
      signingRequest,
      signature: crypto.sign(
        null,
        Buffer.from(signingRequest.signing_frame_base64, 'base64'),
        privateKey,
      ).toString('base64'),
    });
  });
  const readiness = buildContainmentStatusReadiness({
    authority: statusAuthority,
    bundle,
    signedPreflights,
  });

  assert.equal(readiness.readiness_state, 'READY_FOR_REMAINING_G0_EVIDENCE');
  assert.deepEqual(readiness.passing_gate_ids, [
    'G0_MARKET_STATS_CONTAINED',
    'G0_BROAD_CORPUS_ROUTES_CONTAINED',
  ]);
  assert.equal(readiness.unsigned_status.ordered_gate_projection.length, 35);
  assert.deepEqual(
    readiness.unsigned_status.ordered_gate_projection.map((row) => row.state),
    ['PASS', 'PASS', ...Array(33).fill('OPEN')],
  );
  assert.equal(readiness.unsigned_status.ordered_work_class_projection.length, 13);
  assert.deepEqual(
    readiness.unsigned_status.ordered_work_class_projection
      .filter((row) => row.state === 'PASS')
      .map((row) => row.work_class),
    ['specification_review', 'gate_status_bootstrap', 'emergency_containment'],
  );
  assert.equal(
    readiness.unsigned_status.ordered_work_class_projection
      .find((row) => row.work_class === 'canonical_work_start').state,
    'OPEN',
  );
  assert.equal(readiness.status_signature, null);
  assert.equal(Object.hasOwn(readiness.unsigned_status, 'signature'), false);
  assert.equal(readiness.formal_status_state, 'OPEN');
  assert.equal(readiness.bootstrap_nonce_consumed, false);
  assert.equal(readiness.status_publication_attempted, false);
  assert.equal(Object.isFrozen(readiness), true);
  assert.throws(
    () => attachProgrammeGateStatusSignature({
      authority: statusAuthority.statusAuthority,
      unsignedStatus: readiness.unsigned_status,
      signature: 'AA==',
    }),
    /status signature was not verified/,
  );
});

test('status readiness independently rejects a forged passing preflight', async () => {
  const { publicKey } = crypto.generateKeyPairSync('ed25519');
  const validatorExecutableDigest = 'e'.repeat(64);
  const keyRegistry = {
    schema_version: 'TrustedProgrammeGatePublicKeys/V1',
    registry_state: 'ACTIVE',
    keys: [{
      key_id: 'TEST_CONTAINMENT_VALIDATOR',
      algorithm: 'Ed25519',
      public_key_pem: publicKey.export({ format: 'pem', type: 'spki' }).toString('utf8'),
      permitted_roles: [EVIDENCE_SIGNATURE_ROLE],
      permitted_domains: [EVIDENCE_SIGNATURE_DOMAIN],
      valid_from: '2026-07-27T00:00:00.000Z',
      valid_until: '2026-07-29T00:00:00.000Z',
      revoked_at: null,
    }],
  };
  const signingAuthority = createContainmentSigningRequestAuthority({
    keyRegistry,
    validatorConfigurationDigest: REGISTRY_DIGESTS.validator_configuration,
    validatorExecutableDigest,
    validatorKeyId: 'TEST_CONTAINMENT_VALIDATOR',
    verificationTime: OBSERVED_AT,
  });
  const statusAuthority = createContainmentStatusReadinessAuthority({
    codeCommit: COMMIT,
    environment: 'PRODUCTION',
    keyRegistry,
    specificationRoot: ROOT,
    validatorExecutableDigest,
    validatorKeyId: 'TEST_CONTAINMENT_VALIDATOR',
    verificationTime: OBSERVED_AT,
  });
  const bundle = await readyBundle();
  const signedPreflights = bundle.candidates.map((candidate) => {
    const gate = GATES.find((entry) => entry.id === candidate.gate_id);
    const request = buildContainmentEvidenceSigningRequest({
      authority: signingAuthority,
      bundle,
      candidate,
      gate,
    });
    return {
      preflight_type: 'ProgrammeGateContainmentSignedEvidencePreflight/V1',
      gate_id: candidate.gate_id,
      evidence_validation: { valid: true, state: 'PASS' },
      signed_envelope: {
        ...request.unsigned_envelope,
        signature: Buffer.alloc(64, 9).toString('base64'),
      },
      evidence_validation_state: 'PASS',
      formal_gate_state: 'OPEN',
      private_key_used: false,
      status_publication_attempted: false,
    };
  });
  const readiness = buildContainmentStatusReadiness({
    authority: statusAuthority,
    bundle,
    signedPreflights,
  });

  assert.equal(readiness.readiness_state, 'OPEN');
  assert.deepEqual(readiness.passing_gate_ids, []);
  assert.ok(readiness.unsigned_status.ordered_gate_projection.every(
    (row) => row.state === 'OPEN',
  ));
  assert.equal(readiness.status_signature, null);
  assert.equal(readiness.bootstrap_nonce_consumed, false);
});
