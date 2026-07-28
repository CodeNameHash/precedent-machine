#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { domainDigest } = require('../lib/programme-gates/bytes');
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
  'tests/programme-gates/predicates.spec.js',
  'tests/programme-gates/security-disposition-signing.spec.js',
  'tests/programme-gates/security-dispositions.spec.js',
  'tests/programme-gates/validator-executable.spec.js',
  'tests/programme-gates/validator.spec.js',
]);
const VALIDATOR_KEY_ID = 'PROGRAMME_GATE_VALIDATOR_2026_07';

function requireCommit(value, label) {
  if (typeof value !== 'string' || !/^[a-f0-9]{40}$/.test(value)) {
    throw new TypeError(`${label} must be a Git commit ID`);
  }
  return value;
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function safeChildEnvironment() {
  const environment = { ...process.env };
  delete environment.PROGRAMME_GATE_VALIDATOR_ED25519_PRIVATE_KEY_PEM;
  return environment;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    env: options.env || safeChildEnvironment(),
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  return result;
}

function specificationRoot() {
  const result = run(process.execPath, ['scripts/verify-codex-program-spec.mjs']);
  const match = result.stdout.match(
    /CODEX programme specification PASS ([a-f0-9]{64})/,
  );
  if (result.status !== 0 || !match) {
    throw new Error('the governing programme specification did not verify');
  }
  return match[1];
}

function gateTestResult(codeCommit, environment) {
  const args = ['--test', ...GATE_TEST_FILES];
  const startedAt = new Date().toISOString();
  const result = run(process.execPath, args, {
    env: {
      ...safeChildEnvironment(),
      NODE_ENV: 'test',
    },
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

function main() {
  const codeCommit = requireCommit(process.env.GITHUB_SHA, 'GITHUB_SHA');
  const expectedCommit = requireCommit(
    process.env.EXPECTED_PROGRAMME_COMMIT,
    'expected programme commit',
  );
  if (codeCommit !== expectedCommit) {
    throw new Error('workflow commit does not equal the requested main commit');
  }
  const environment = 'PRODUCTION';
  const gateTest = gateTestResult(codeCommit, environment);
  const observedAt = new Date().toISOString();
  const verificationTime = observedAt;
  const source = JSON.parse(fs.readFileSync(SOURCE_PATH, 'utf8'));
  const specificationDigest = specificationRoot();
  const validatorExecutableDigest = programmeGateValidatorExecutableDigest({
    root: ROOT,
  });
  const readiness = buildSecurityDispositionReadiness({
    authority: createSecurityDispositionReadinessAuthority({
      specificationRoot: specificationDigest,
      codeCommit,
      environment,
      observedAt,
      verificationTime,
    }),
    source,
    testResult: gateTest,
  });
  const signingAuthority = createSecurityDispositionSigningAuthority({
    keyRegistry: TRUSTED_PUBLIC_KEY_REGISTRY,
    validatorConfigurationDigest: REGISTRY_DIGESTS.validator_configuration,
    validatorExecutableDigest,
    validatorKeyId: VALIDATOR_KEY_ID,
    verificationTime,
  });
  const privateKey = privateValidatorKey();
  const evidence = readiness.candidates.map((candidate) => {
    const signingRequest = buildSecurityDispositionSigningRequest({
      authority: signingAuthority,
      bundle: readiness,
      candidate,
    });
    const signature = crypto.sign(
      null,
      Buffer.from(signingRequest.signing_frame_base64, 'base64'),
      privateKey,
    ).toString('base64');
    const preflight = preflightSecurityDispositionSignature({
      authority: signingAuthority,
      bundle: readiness,
      candidate,
      signingRequest,
      signature,
    });
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
  });
  const output = {
    schema_version: 'ProgrammeGateSecurityDispositionSignedEvidenceBundle/V1',
    specification_root: specificationDigest,
    code_commit: codeCommit,
    environment,
    observed_at: observedAt,
    attestation_source_digest: readiness.attestation_source_digest,
    validator_executable_digest: validatorExecutableDigest,
    validator_configuration_digest: REGISTRY_DIGESTS.validator_configuration,
    validator_key_id: VALIDATOR_KEY_ID,
    evidence,
  };
  process.stdout.write(`${JSON.stringify(output)}\n`);
}

main();
