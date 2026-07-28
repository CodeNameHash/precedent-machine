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
  buildIsolationObservationSource,
  PREVIEW_BRANCH,
} = require('../lib/programme-gates/isolation-collector');
const {
  buildIsolationReadiness,
  createIsolationReadinessAuthority,
} = require('../lib/programme-gates/isolation-readiness');
const {
  buildIsolationSigningRequest,
  createIsolationSigningAuthority,
  preflightIsolationSignature,
} = require('../lib/programme-gates/isolation-signing');
const {
  buildBenApproval,
  buildReviewSetInput,
} = require('../lib/programme-gates/review-artifact');
const {
  buildReviewApprovalReadiness,
  createReviewApprovalReadinessAuthority,
} = require('../lib/programme-gates/review-readiness');
const {
  buildReviewApprovalSigningRequest,
  createReviewApprovalSigningAuthority,
  preflightReviewApprovalSignature,
} = require('../lib/programme-gates/review-signing');
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
const {
  TEST_EXECUTABLE_SET_DOMAIN,
  expectedTestExecutableDigest,
  testExecutableFiles,
} = require('../lib/programme-gates/test-executable-registry');
const {
  buildG0StatusReadiness,
  createG0StatusReadinessAuthority,
} = require('../lib/programme-gates/g0-status-readiness');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_PATH = path.resolve(
  ROOT,
  'docs/certification/evidence/G0-SECURITY-DISPOSITIONS-2026-07-28.json',
);
const GATE_TEST_FILES = testExecutableFiles('GATE-01');
const DEPLOY_CUTOVER_TEST_FILES = testExecutableFiles('DEPLOY-CUTOVER-01');
const PREVIEW_AUTH_TEST_FILES = testExecutableFiles('PREVIEW-AUTH-01');
const REVIEW_CONTEXT_TEST_FILES = testExecutableFiles('REVIEW-CONTEXT-01');
const VALIDATOR_KEY_ID = 'PROGRAMME_GATE_VALIDATOR_2026_07';
const BEN_APPROVER_KEY_ID = 'PROGRAMME_GATE_BEN_APPROVER_2026_07';
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
  delete environment.PROGRAMME_GATE_BEN_APPROVER_ED25519_PRIVATE_KEY_PEM;
  delete environment.PROGRAMME_GATE_STAGING_SUPABASE_SECRET_KEY;
  delete environment.VERCEL_TOKEN;
  return environment;
}

function previewAccessMatrix() {
  const value = process.env.PROGRAMME_GATE_PREVIEW_ACCESS_MATRIX_JSON;
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('protected preview access matrix evidence is unavailable');
  }
  const parsed = JSON.parse(value);
  if (!Array.isArray(parsed)) {
    throw new Error('protected preview access matrix evidence is not an array');
  }
  return parsed;
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

function testResult(testId, testFiles, codeCommit, environment) {
  const args = ['--test', ...testFiles];
  const startedAt = new Date().toISOString();
  const result = run(process.execPath, args, {
    env: childEnvironment({
      NODE_ENV: 'test',
    }),
  });
  const completedAt = new Date().toISOString();
  const executableMembers = testFiles.map((file) => {
    const bytes = fs.readFileSync(path.resolve(ROOT, file));
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
  if (executableDigest !== expectedTestExecutableDigest(testId)) {
    throw new Error(`${testId} executable set does not match the frozen registry`);
  }
  const record = Object.freeze({
    schema_version: 'ProgrammeGateTestExecutionRecord/V1',
    test_id: testId,
    code_commit: codeCommit,
    environment,
    command_digest: domainDigest(
      'PROGRAMME_GATE_TEST_COMMAND/V1',
      { executable: process.execPath, args },
    ),
    executable_digest: executableDigest,
    started_at: startedAt,
    completed_at: completedAt,
    exit_code: result.status,
    output_digest: domainDigest(
      'PROGRAMME_GATE_TEST_OUTPUT/V1',
      { stdout: result.stdout, stderr: result.stderr },
    ),
  });
  if (record.exit_code !== 0) throw new Error(`${testId} did not pass`);
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

async function vercelApi(pathname, token, search = {}) {
  const url = new URL(pathname, VERCEL_API_ORIGIN);
  url.searchParams.set('teamId', VERCEL_TEAM_ID);
  for (const [key, value] of Object.entries(search)) {
    if (value !== null && value !== undefined) url.searchParams.set(key, value);
  }
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('protected Vercel API lookup failed');
  return response.json();
}

async function vercelEnvironmentRecords(token, target, gitBranch = null) {
  const payload = await vercelApi(
    `/v10/projects/${VERCEL_PROJECT_ID}/env`,
    token,
    { target, decrypt: 'true', gitBranch },
  );
  if (!Array.isArray(payload.envs)) {
    throw new Error('protected Vercel environment lookup returned no records');
  }
  return payload.envs;
}

async function vercelProductionEnvironment(token) {
  const payload = await vercelApi(
    `/v3/env/pull/${VERCEL_PROJECT_ID}/production`,
    token,
  );
  const environment = payload && payload.env;
  if (!environment || typeof environment !== 'object' || Array.isArray(environment)) {
    throw new Error('protected Vercel production environment lookup failed');
  }
  return environment;
}

function stagingSupabaseSecretKey() {
  const value = process.env.PROGRAMME_GATE_STAGING_SUPABASE_SECRET_KEY;
  if (typeof value !== 'string' || !/^sb_secret_[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error('protected staging Supabase secret key is unavailable');
  }
  return value;
}

async function fetchObservation(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    redirect: 'manual',
    signal: AbortSignal.timeout(15000),
  });
  return {
    status: response.status,
    location: response.headers.get('location'),
  };
}

function automationBypassSecret(project) {
  const matches = Object.entries(project.protectionBypass || {})
    .filter(([, value]) => value && value.scope === 'automation-bypass');
  if (matches.length !== 1) {
    throw new Error('one protected automation bypass credential is required');
  }
  return matches[0][0];
}

async function collectLiveIsolationSource({ codeCommit, previewDeploymentId }) {
  const token = vercelToken();
  const productionDeploymentBefore = await vercelDeployment(PRODUCTION_ALIAS, token);
  const [
    previewDeployment,
    productionEnvironment,
    previewEnvironmentRecords,
    project,
  ] = await Promise.all([
    vercelDeployment(previewDeploymentId, token),
    vercelProductionEnvironment(token),
    vercelEnvironmentRecords(token, 'preview', PREVIEW_BRANCH),
    vercelApi(`/v9/projects/${VERCEL_PROJECT_ID}`, token),
  ]);
  const stagingServiceKey = stagingSupabaseSecretKey();
  const productionUrl = productionEnvironment.NEXT_PUBLIC_SUPABASE_URL;
  const previewUrl = `https://${previewDeployment.url}/api/canonical-v2/review-context?dealId=7dc3a05f-b170-4d59-a255-b7103cca16e1`;
  const [
    productionDmlResponse,
    unauthenticatedResponse,
    authorisedResponse,
  ] = await Promise.all([
    fetchObservation(`${productionUrl}/rest/v1/deals?id=is.null`, {
      method: 'DELETE',
      headers: {
        apikey: stagingServiceKey,
        authorization: `Bearer ${stagingServiceKey}`,
        prefer: 'return=minimal',
      },
    }),
    fetchObservation(previewUrl),
    fetchObservation(previewUrl, {
      headers: {
        'x-vercel-protection-bypass': automationBypassSecret(project),
      },
    }),
  ]);
  const productionDeploymentAfter = await vercelDeployment(PRODUCTION_ALIAS, token);
  return buildIsolationObservationSource({
    observedAt: new Date().toISOString(),
    codeCommit,
    projectId: VERCEL_PROJECT_ID,
    previewDeploymentId,
    productionEnvironment,
    previewEnvironmentRecords,
    stagingServiceKey,
    productionDmlResponse,
    previewDeployment,
    productionDeploymentBefore,
    productionDeploymentAfter,
    unauthenticatedResponse,
    authorisedResponse,
    previewRuntimeResponse: authorisedResponse,
    previewRouteActions: previewAccessMatrix(),
  });
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

function protectedPrivateKey(environmentName, keyId) {
  const pem = process.env[environmentName];
  if (typeof pem !== 'string' || pem.length === 0) {
    throw new Error(`protected ${keyId} signing key is unavailable`);
  }
  const privateKey = crypto.createPrivateKey(pem);
  if (privateKey.asymmetricKeyType !== 'ed25519') {
    throw new Error(`protected ${keyId} signing key is not Ed25519`);
  }
  const trusted = TRUSTED_PUBLIC_KEY_REGISTRY.keys.find(
    (entry) => entry.key_id === keyId,
  );
  if (!trusted) throw new Error(`trusted ${keyId} public key is unavailable`);
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
    throw new Error(`protected ${keyId} key does not match the trusted public key`);
  }
  return privateKey;
}

function privateValidatorKey() {
  return protectedPrivateKey(
    'PROGRAMME_GATE_VALIDATOR_ED25519_PRIVATE_KEY_PEM',
    VALIDATOR_KEY_ID,
  );
}

function privateBenApproverKey() {
  return protectedPrivateKey(
    'PROGRAMME_GATE_BEN_APPROVER_ED25519_PRIVATE_KEY_PEM',
    BEN_APPROVER_KEY_ID,
  );
}

function signatureFor(request, privateKey) {
  return crypto.sign(
    null,
    Buffer.from(request.signing_frame_base64, 'base64'),
    privateKey,
  ).toString('base64');
}

function signatureForBytes(bytes, privateKey) {
  return crypto.sign(null, bytes, privateKey).toString('base64');
}

function reviewArtifact() {
  const reviewPath = process.env.PROGRAMME_GATE_COLD_REVIEW_BUNDLE;
  if (typeof reviewPath !== 'string' || !path.isAbsolute(reviewPath)) {
    throw new Error('cold-review bundle path is unavailable');
  }
  return JSON.parse(fs.readFileSync(reviewPath, 'utf8'));
}

function sourceControlAuthorshipEvents() {
  const output = successful('git', [
    'log',
    '--all',
    '-z',
    '--format=%H%x00%an%x00%ae%x00%aN%x00%aE',
  ]);
  const fields = output.split('\0');
  const events = [];
  for (let index = 0; index + 4 < fields.length; index += 5) {
    events.push({
      commit_id: fields[index].trim(),
      identity_set: [...new Set(fields.slice(index + 1, index + 5)
        .map((value) => value.trim())
        .filter(Boolean))].sort(),
    });
  }
  return events;
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
  const previewDeploymentId = requireDeploymentId(
    process.env.EXPECTED_VERCEL_PREVIEW_DEPLOYMENT_ID,
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
  const gateTest = testResult('GATE-01', GATE_TEST_FILES, codeCommit, environment);
  const deployCutoverTest = testResult(
    'DEPLOY-CUTOVER-01',
    DEPLOY_CUTOVER_TEST_FILES,
    codeCommit,
    environment,
  );
  const reviewContextTest = testResult(
    'REVIEW-CONTEXT-01',
    REVIEW_CONTEXT_TEST_FILES,
    codeCommit,
    environment,
  );
  const previewAuthTest = testResult(
    'PREVIEW-AUTH-01',
    PREVIEW_AUTH_TEST_FILES,
    codeCommit,
    environment,
  );
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
  const isolationSource = await collectLiveIsolationSource({
    codeCommit,
    previewDeploymentId,
  });
  const isolationVerificationTime = new Date().toISOString();
  const isolationBundle = buildIsolationReadiness({
    authority: createIsolationReadinessAuthority({
      specificationRoot: specificationDigest,
      codeCommit,
      environment,
      observedAt: isolationSource.observed_at,
      verificationTime: isolationVerificationTime,
    }),
    source: isolationSource,
    gateTestResult: gateTest,
    deployCutoverTestResult: deployCutoverTest,
    previewAuthTestResult: previewAuthTest,
  });
  const validatorExecutableDigest = programmeGateValidatorExecutableDigest({
    root: ROOT,
  });
  const privateKey = privateValidatorKey();
  const benPrivateKey = privateBenApproverKey();

  const reviewVerificationTime = new Date().toISOString();
  const reviewSet = buildReviewSetInput({
    at: reviewVerificationTime,
    bundle: reviewArtifact(),
    expectedCodeCommit: codeCommit,
    expectedSpecificationRoot: specificationDigest,
    keyRegistry: TRUSTED_PUBLIC_KEY_REGISTRY,
    signIndependence: (bytes) => signatureForBytes(bytes, privateKey),
    sourceControlAuthorshipEvents: sourceControlAuthorshipEvents(),
    validatorConfigurationDigest: REGISTRY_DIGESTS.validator_configuration,
    validatorExecutableDigest,
    validatorKeyId: VALIDATOR_KEY_ID,
  });
  const approvalTime = new Date().toISOString();
  const benApproval = buildBenApproval({
    approvedAt: approvalTime,
    approvedRoot: specificationDigest,
    approverKeyId: BEN_APPROVER_KEY_ID,
    keyRegistry: TRUSTED_PUBLIC_KEY_REGISTRY,
    nonce: crypto.randomUUID(),
    passingReviewSetEvidenceId: reviewSet.verification.evidence_id,
    signApproval: (bytes) => signatureForBytes(bytes, benPrivateKey),
    verificationTime: approvalTime,
  });
  const reviewObservedAt = new Date().toISOString();
  const reviewBundle = buildReviewApprovalReadiness({
    authority: createReviewApprovalReadinessAuthority({
      specificationRoot: specificationDigest,
      codeCommit,
      environment,
      observedAt: reviewObservedAt,
      verificationTime: reviewObservedAt,
    }),
    reviewSet: {
      members: reviewSet.members,
      authority: reviewSet.authority,
    },
    benApproval: {
      record: benApproval.record,
      authority: benApproval.authority,
    },
    gateTestResult: gateTest,
    reviewContextTestResult: reviewContextTest,
  });
  const reviewSigningAuthority = createReviewApprovalSigningAuthority({
    keyRegistry: TRUSTED_PUBLIC_KEY_REGISTRY,
    validatorConfigurationDigest: REGISTRY_DIGESTS.validator_configuration,
    validatorExecutableDigest,
    validatorKeyId: VALIDATOR_KEY_ID,
    verificationTime: reviewObservedAt,
    reviewSetAuthority: reviewSet.authority,
    benApprovalAuthority: benApproval.authority,
  });
  const reviewPreflights = reviewBundle.candidates.map((candidate) => {
    const signingRequest = buildReviewApprovalSigningRequest({
      authority: reviewSigningAuthority,
      bundle: reviewBundle,
      candidate,
    });
    return preflightReviewApprovalSignature({
      authority: reviewSigningAuthority,
      bundle: reviewBundle,
      candidate,
      signingRequest,
      signature: signatureFor(signingRequest, privateKey),
    });
  });
  const reviewEvidence = reviewBundle.candidates.map(
    (candidate, index) => evidenceResult(candidate, reviewPreflights[index]),
  );

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
  const isolationAuthority = createIsolationSigningAuthority({
    keyRegistry: TRUSTED_PUBLIC_KEY_REGISTRY,
    validatorConfigurationDigest: REGISTRY_DIGESTS.validator_configuration,
    validatorExecutableDigest,
    validatorKeyId: VALIDATOR_KEY_ID,
    verificationTime: isolationVerificationTime,
  });
  const isolationEvidence = isolationBundle.candidates.map((candidate) => {
    const signingRequest = buildIsolationSigningRequest({
      authority: isolationAuthority,
      bundle: isolationBundle,
      candidate,
    });
    const preflight = preflightIsolationSignature({
      authority: isolationAuthority,
      bundle: isolationBundle,
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
  const g0StatusReadiness = buildG0StatusReadiness({
    authority: createG0StatusReadinessAuthority({
      specificationRoot: specificationDigest,
      codeCommit,
      environment,
      keyRegistry: TRUSTED_PUBLIC_KEY_REGISTRY,
      validatorExecutableDigest,
      validatorKeyId: VALIDATOR_KEY_ID,
      verificationTime: reviewObservedAt,
      reviewSigningAuthority,
    }),
    containment: {
      bundle: containmentBundle,
      signedPreflights: containmentPreflights,
    },
    security: {
      bundle: securityBundle,
      signedPreflights: securityEvidence.map((entry) => ({
        preflight_type: 'ProgrammeGateSecurityDispositionSignedPreflight/V1',
        gate_id: entry.gate_id,
        evidence_validation: entry.evidence_validation,
        signed_envelope: entry.signed_envelope,
      })),
    },
    isolation: {
      bundle: isolationBundle,
      signedPreflights: isolationEvidence.map((entry) => ({
        preflight_type: 'ProgrammeGateIsolationSignedPreflight/V1',
        gate_id: entry.gate_id,
        evidence_validation: entry.evidence_validation,
        signed_envelope: entry.signed_envelope,
      })),
    },
    review: {
      bundle: reviewBundle,
      signedPreflights: reviewPreflights,
    },
  });
  if (g0StatusReadiness.readiness_state !== 'READY_FOR_STATUS_SIGNATURE'
    || g0StatusReadiness.formal_status_state !== 'OPEN'
    || g0StatusReadiness.bootstrap_nonce_consumed !== false
    || g0StatusReadiness.status_publication_attempted !== false) {
    throw new Error('ten-gate evidence did not produce exact unsigned G0 status readiness');
  }

  const output = {
    schema_version: 'ProgrammeGateG0SignedEvidenceBundle/V2',
    specification_root: specificationDigest,
    code_commit: codeCommit,
    runtime_deployment_id: deploymentId,
    environment,
    containment_observed_at: containmentBundle.observed_at,
    security_observed_at: securityObservedAt,
    isolation_observed_at: isolationSource.observed_at,
    review_observed_at: reviewObservedAt,
    validator_executable_digest: validatorExecutableDigest,
    validator_configuration_digest: REGISTRY_DIGESTS.validator_configuration,
    validator_key_id: VALIDATOR_KEY_ID,
    security_attestation_source_digest: securityBundle.attestation_source_digest,
    isolation_source_digest: isolationBundle.isolation_source_digest,
    containment_status_readiness: {
      readiness_state: containmentStatusReadiness.readiness_state,
      passing_gate_ids: containmentStatusReadiness.passing_gate_ids,
      formal_status_state: containmentStatusReadiness.formal_status_state,
      status_publication_attempted:
        containmentStatusReadiness.status_publication_attempted,
    },
    g0_status_readiness: g0StatusReadiness,
    evidence: [
      ...containmentEvidence,
      ...securityEvidence,
      ...isolationEvidence,
      ...reviewEvidence,
    ],
  };
  process.stdout.write(`${JSON.stringify(output)}\n`);
}

await main();
