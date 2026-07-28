#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const YAML = require('yaml');
const { domainDigest } = require('../lib/programme-gates/bytes');
const {
  collectContainmentEvidence,
} = require('../lib/programme-gates/containment-collector');
const {
  CONTAINMENT_RUNTIME,
  validateDeploymentBinding,
} = require('../lib/programme-gates/containment-runtime');
const {
  buildContainmentEvidenceSigningRequest,
  createContainmentSigningRequestAuthority,
} = require('../lib/programme-gates/containment-signing-request');
const {
  createContainmentSignedPreflightAuthority,
  preflightContainmentEvidenceSignature,
} = require('../lib/programme-gates/containment-signed-preflight');
const {
  buildContainmentStatusReadiness,
  createContainmentStatusReadinessAuthority,
} = require('../lib/programme-gates/containment-status-readiness');
const {
  createGoverningRegistryAuthority,
} = require('../lib/programme-gates/governing-registry');
const {
  REGISTRY_DIGESTS,
  TRUSTED_PUBLIC_KEY_REGISTRY,
} = require('../lib/programme-gates/registry');
const {
  buildSecurityDispositionReadiness,
  createSecurityDispositionReadinessAuthority,
} = require('../lib/programme-gates/security-disposition-readiness');
const {
  buildSecurityDispositionSigningRequest,
  createSecurityDispositionSigningAuthority,
  preflightSecurityDispositionSignature,
} = require('../lib/programme-gates/security-disposition-signing');
const {
  programmeGateValidatorExecutableDigest,
} = require('../lib/programme-gates/validator-executable');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_PATH = path.resolve(
  ROOT,
  'docs/certification/evidence/G0-SECURITY-DISPOSITIONS-2026-07-28.json',
);
const GATE_TEST_FILES = Object.freeze([
  'tests/programme-gates-schema-registry.test.js',
  'tests/programme-gates/g0-signer-workflow.spec.js',
  'tests/programme-gates/predicates.spec.js',
  'tests/programme-gates/security-disposition-signing.spec.js',
  'tests/programme-gates/security-dispositions.spec.js',
  'tests/programme-gates/validator-executable.spec.js',
  'tests/programme-gates/validator.spec.js',
]);
const VALIDATOR_KEY_ID = 'PROGRAMME_GATE_VALIDATOR_2026_07';
const PRODUCTION_ORIGIN = 'https://deal-corpus.vercel.app';
const PRODUCTION_ALIAS = 'deal-corpus.vercel.app';
const VERCEL_API_ORIGIN = 'https://api.vercel.com';
const VERCEL_TEAM_ID = 'team_Zu8dnrxhP3FY0BcfOZtQ4z71';
const VERCEL_PROJECT_ID = 'prj_pseZ68ISXsxADzNcffHTO2NuGM8b';

function requireCommit(value, label) {
  if (typeof value !== 'string' || !/^[a-f0-9]{40}$/.test(value)) {
    throw new TypeError(`${label} must be a Git commit ID`);
  }
  return value;
}

function requireDeploymentId(value) {
  if (typeof value !== 'string' || !/^dpl_[A-Za-z0-9]+$/.test(value)) {
    throw new TypeError('expected deployment ID is invalid');
  }
  return value;
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function childEnvironment(overrides = {}) {
  const environment = { ...process.env, ...overrides };
  delete environment.PROGRAMME_GATE_VALIDATOR_ED25519_PRIVATE_KEY_PEM;
  delete environment.VERCEL_TOKEN;
  return environment;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    env: options.env || childEnvironment(),
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  return result;
}

function successful(command, args, options = {}) {
  const result = run(command, args, options);
  if (result.status !== 0) {
    throw new Error(`${command} execution failed`);
  }
  return result.stdout.trim();
}

function specificationRoot() {
  const output = successful(process.execPath, [
    'scripts/verify-codex-program-spec.mjs',
  ]);
  const match = output.match(
    /CODEX programme specification PASS ([a-f0-9]{64})/,
  );
  if (!match) {
    throw new Error('the governing programme specification did not verify');
  }
  return match[1];
}

function gateTestResult(codeCommit, environment) {
  const args = ['--test', ...GATE_TEST_FILES];
  const startedAt = new Date().toISOString();
  const result = run(process.execPath, args, {
    env: childEnvironment({
      NODE_ENV: 'test',
    }),
  });
  const completedAt = new Date().toISOString();
  const executableMembers = GATE_TEST_FILES.map((file) => {
    const bytes = fs.readFileSync(path.resolve(ROOT, file));
    return {
      path: file,
      byte_length: bytes.length,
      sha256: sha256(bytes),
    };
  });
  const record = Object.freeze({
    schema_version: 'ProgrammeGateTestExecutionRecord/V1',
    test_id: 'GATE-01',
    code_commit: codeCommit,
    environment,
    command_digest: domainDigest(
      'PROGRAMME_GATE_TEST_COMMAND/V1',
      { executable: process.execPath, args },
    ),
    executable_digest: domainDigest(
      'PROGRAMME_GATE_TEST_EXECUTABLE_SET/V1',
      executableMembers,
    ),
    started_at: startedAt,
    completed_at: completedAt,
    exit_code: result.status,
    output_digest: domainDigest(
      'PROGRAMME_GATE_TEST_OUTPUT/V1',
      { stdout: result.stdout, stderr: result.stderr },
    ),
  });
  if (record.exit_code !== 0) throw new Error('GATE-01 did not pass');
  return record;
}

function vercelToken() {
  const token = process.env.VERCEL_TOKEN;
  if (typeof token !== 'string' || token.length < 20) {
    throw new Error('protected Vercel metadata token is unavailable');
  }
  return token;
}

async function vercelDeployment(identifier, token) {
  const url = new URL(
    `/v13/deployments/${encodeURIComponent(identifier)}`,
    VERCEL_API_ORIGIN,
  );
  url.searchParams.set('teamId', VERCEL_TEAM_ID);
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error('protected Vercel deployment lookup failed');
  }
  return response.json();
}

async function deploymentBinding({
  codeCommit,
  deploymentId,
  environment,
  specificationDigest,
}) {
  const token = vercelToken();
  const [originDeployment, deployment] = await Promise.all([
    vercelDeployment(PRODUCTION_ALIAS, token),
    vercelDeployment(deploymentId, token),
  ]);
  if (originDeployment.projectId !== VERCEL_PROJECT_ID
    || deployment.projectId !== VERCEL_PROJECT_ID) {
    throw new Error('the deployment does not belong to the frozen Vercel project');
  }
  validateDeploymentBinding({
    deployment,
    originDeployment,
    deploymentId,
    environment,
    codeCommit,
    specificationRoot: specificationDigest,
  });
  return deployment;
}

function buildProductionOutput() {
  successful('npm', ['run', 'build'], {
    env: childEnvironment({
      NODE_ENV: 'production',
    }),
  });
}

function containmentRuntime() {
  return Object.freeze({
    ...CONTAINMENT_RUNTIME,
    runCommand(command, args, options = {}) {
      return CONTAINMENT_RUNTIME.runCommand(command, args, {
        ...options,
        env: childEnvironment(options.env),
      });
    },
  });
}

function governingGates() {
  return createGoverningRegistryAuthority({
    readFileSync(file) {
      return fs.readFileSync(file);
    },
    parseYaml(source) {
      return YAML.parse(source);
    },
    domainDigest,
  }).gates;
}

function privateValidatorKey() {
  const pem = process.env.PROGRAMME_GATE_VALIDATOR_ED25519_PRIVATE_KEY_PEM;
  if (typeof pem !== 'string' || pem.length === 0) {
    throw new Error('protected validator signing key is unavailable');
  }
  const privateKey = crypto.createPrivateKey(pem);
  if (privateKey.asymmetricKeyType !== 'ed25519') {
    throw new Error('protected validator signing key is not Ed25519');
  }
  const trusted = TRUSTED_PUBLIC_KEY_REGISTRY.keys.find(
    (entry) => entry.key_id === VALIDATOR_KEY_ID,
  );
  if (!trusted) throw new Error('trusted validator public key is unavailable');
  const derivedPublic = crypto.createPublicKey(privateKey).export({
    type: 'spki',
    format: 'pem',
  });
  const trustedPublic = crypto.createPublicKey(trusted.public_key_pem).export({
    type: 'spki',
    format: 'pem',
  });
  if (!crypto.timingSafeEqual(
    crypto.createHash('sha256').update(derivedPublic).digest(),
    crypto.createHash('sha256').update(trustedPublic).digest(),
  )) {
    throw new Error('protected signing key does not match the trusted public key');
  }
  return privateKey;
}

function signatureFor(request, privateKey) {
  return crypto.sign(
    null,
    Buffer.from(request.signing_frame_base64, 'base64'),
    privateKey,
  ).toString('base64');
}

function evidenceResult(candidate, preflight) {
  if (preflight.evidence_validation.valid !== true
    || preflight.evidence_validation.state !== 'PASS'
    || !preflight.signed_envelope) {
    throw new Error(`${candidate.gate_id} signed evidence failed preflight`);
  }
  return {
    gate_id: candidate.gate_id,
    evidence_validation: preflight.evidence_validation,
    signed_envelope: preflight.signed_envelope,
    validation_input: {
      evidenceSubject: candidate.evidence_subject,
      evidenceObject: candidate.evidence_object,
      members: candidate.members,
      memberSchemaSet: candidate.member_schema_set,
      testResults: candidate.test_results,
    },
  };
}

async function main() {
  const codeCommit = requireCommit(process.env.GITHUB_SHA, 'GITHUB_SHA');
  const expectedCommit = requireCommit(
    process.env.EXPECTED_PROGRAMME_COMMIT,
    'expected programme commit',
  );
  if (codeCommit !== expectedCommit
    || successful('git', ['rev-parse', 'HEAD']) !== expectedCommit
    || successful('git', ['status', '--porcelain']) !== '') {
    throw new Error('signer does not have the exact clean requested main commit');
  }
  const deploymentId = requireDeploymentId(
    process.env.EXPECTED_VERCEL_DEPLOYMENT_ID,
  );
  const environment = 'PRODUCTION';
  const specificationDigest = specificationRoot();
  await deploymentBinding({
    codeCommit,
    deploymentId,
    environment,
    specificationDigest,
  });
  buildProductionOutput();

  const containmentBundle = await collectContainmentEvidence({
    runtime: containmentRuntime(),
    root: ROOT,
    origin: PRODUCTION_ORIGIN,
    environment,
    codeCommit,
    deploymentId,
    specificationRoot: specificationDigest,
    gates: governingGates(),
  });
  const gateTest = gateTestResult(codeCommit, environment);
  const securityObservedAt = new Date().toISOString();
  const verificationTime = securityObservedAt;
  const securitySource = JSON.parse(fs.readFileSync(SOURCE_PATH, 'utf8'));
  const securityBundle = buildSecurityDispositionReadiness({
    authority: createSecurityDispositionReadinessAuthority({
      specificationRoot: specificationDigest,
      codeCommit,
      environment,
      observedAt: securityObservedAt,
      verificationTime,
    }),
    source: securitySource,
    testResult: gateTest,
  });
  const validatorExecutableDigest = programmeGateValidatorExecutableDigest({
    root: ROOT,
  });
  const privateKey = privateValidatorKey();

  const securityAuthority = createSecurityDispositionSigningAuthority({
    keyRegistry: TRUSTED_PUBLIC_KEY_REGISTRY,
    validatorConfigurationDigest: REGISTRY_DIGESTS.validator_configuration,
    validatorExecutableDigest,
    validatorKeyId: VALIDATOR_KEY_ID,
    verificationTime,
  });
  const securityEvidence = securityBundle.candidates.map((candidate) => {
    const signingRequest = buildSecurityDispositionSigningRequest({
      authority: securityAuthority,
      bundle: securityBundle,
      candidate,
    });
    const preflight = preflightSecurityDispositionSignature({
      authority: securityAuthority,
      bundle: securityBundle,
      candidate,
      signingRequest,
      signature: signatureFor(signingRequest, privateKey),
    });
    return evidenceResult(candidate, preflight);
  });

  const containmentSigningAuthority = createContainmentSigningRequestAuthority({
    keyRegistry: TRUSTED_PUBLIC_KEY_REGISTRY,
    validatorConfigurationDigest: REGISTRY_DIGESTS.validator_configuration,
    validatorExecutableDigest,
    validatorKeyId: VALIDATOR_KEY_ID,
    verificationTime,
  });
  const containmentPreflightAuthority = createContainmentSignedPreflightAuthority({
    keyRegistry: TRUSTED_PUBLIC_KEY_REGISTRY,
    validatorExecutableDigests: [validatorExecutableDigest],
    verificationTime,
  });
  const gateById = new Map(governingGates().map((gate) => [gate.id, gate]));
  const containmentPreflights = containmentBundle.candidates.map((candidate) => {
    const gate = gateById.get(candidate.gate_id);
    if (!gate) throw new Error(`governing gate ${candidate.gate_id} is unavailable`);
    const signingRequest = buildContainmentEvidenceSigningRequest({
      authority: containmentSigningAuthority,
      bundle: containmentBundle,
      candidate,
      gate,
    });
    return preflightContainmentEvidenceSignature({
      authority: containmentPreflightAuthority,
      bundle: containmentBundle,
      candidate,
      gate,
      signingRequest,
      signature: signatureFor(signingRequest, privateKey),
    });
  });
  const containmentEvidence = containmentBundle.candidates.map(
    (candidate, index) => evidenceResult(candidate, containmentPreflights[index]),
  );
  const containmentStatusReadiness = buildContainmentStatusReadiness({
    authority: createContainmentStatusReadinessAuthority({
      codeCommit,
      environment,
      keyRegistry: TRUSTED_PUBLIC_KEY_REGISTRY,
      specificationRoot: specificationDigest,
      validatorExecutableDigest,
      validatorKeyId: VALIDATOR_KEY_ID,
      verificationTime,
    }),
    bundle: containmentBundle,
    signedPreflights: containmentPreflights,
  });
  if (containmentStatusReadiness.readiness_state
      !== 'READY_FOR_REMAINING_G0_EVIDENCE'
    || containmentStatusReadiness.formal_status_state !== 'OPEN'
    || containmentStatusReadiness.status_publication_attempted !== false) {
    throw new Error('containment evidence did not produce exact unsigned status readiness');
  }

  const output = {
    schema_version: 'ProgrammeGateG0SignedEvidenceBundle/V1',
    specification_root: specificationDigest,
    code_commit: codeCommit,
    runtime_deployment_id: deploymentId,
    environment,
    containment_observed_at: containmentBundle.observed_at,
    security_observed_at: securityObservedAt,
    validator_executable_digest: validatorExecutableDigest,
    validator_configuration_digest: REGISTRY_DIGESTS.validator_configuration,
    validator_key_id: VALIDATOR_KEY_ID,
    security_attestation_source_digest: securityBundle.attestation_source_digest,
    containment_status_readiness: {
      readiness_state: containmentStatusReadiness.readiness_state,
      passing_gate_ids: containmentStatusReadiness.passing_gate_ids,
      formal_status_state: containmentStatusReadiness.formal_status_state,
      status_publication_attempted:
        containmentStatusReadiness.status_publication_attempted,
    },
    evidence: [...containmentEvidence, ...securityEvidence],
  };
  process.stdout.write(`${JSON.stringify(output)}\n`);
}

await main();
