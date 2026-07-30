#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { canonicalJson, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { domainDigest, signatureBytes } = require('../lib/programme-gates/bytes');
const {
  AUTHENTICATED_RESULT_DOMAIN,
  AUTHENTICATED_RESULT_ID_DOMAIN,
  REGISTRATION_DOMAIN,
  REGISTRATION_ID_DOMAIN,
  RESULT_PAYLOAD_DOMAIN,
} = require('../lib/programme-gates/contract-freeze-review-registration');
const {
  P1_CONTRACT_FREEZE_REVIEW_GATE_ID,
  P1_CONTRACT_FREEZE_REVIEW_LANES,
  createP1ContractFreezeReviewExecutionPlan,
  finaliseP1ContractFreezeReviewExecution,
  validateP1ContractFreezeReviewResults,
} = require('../lib/programme-gates/contract-freeze-review-tasks');
const { TRUSTED_PUBLIC_KEY_REGISTRY } = require('../lib/programme-gates/registry');

const ROOT = path.resolve(import.meta.dirname, '..');
const CODEX_PATH = '/opt/homebrew/bin/codex';
const CONTROLLER_KEY_ID = 'PROGRAMME_GATE_REVIEW_CONTROLLER_2026_07';
const FINDING_OUTPUT_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['disposition', 'findings'],
  properties: {
    disposition: { enum: ['PASS', 'BLOCKING', 'NON-BLOCKING'] },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['disposition', 'file', 'rule', 'required_correction'],
        properties: {
          disposition: { enum: ['BLOCKING', 'NON-BLOCKING'] },
          file: { type: 'string', minLength: 1 },
          rule: { type: 'string', minLength: 1 },
          required_correction: { type: 'string', minLength: 1 },
        },
      },
    },
  },
});

function fail(message) { throw new Error(message); }

function exactCommit(value) {
  if (!/^[a-f0-9]{40}$/.test(value || '')) fail('expected commit is invalid');
  return value;
}

function command(commandName, args, options = {}) {
  const result = spawnSync(commandName, args, {
    cwd: options.cwd || ROOT,
    env: options.env || process.env,
    input: options.input,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  if (result.status !== 0) fail(`${commandName} failed with exit code ${result.status}`);
  return { stdout: result.stdout || '', stderr: result.stderr || '' };
}

function commandAsync(commandName, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(commandName, args, {
      cwd: options.cwd || ROOT,
      env: options.env || process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const stdout = [];
    const stderr = [];
    let byteCount = 0;
    const collect = (target) => (chunk) => {
      byteCount += chunk.length;
      if (byteCount > 64 * 1024 * 1024) {
        child.kill('SIGKILL');
        reject(new Error(`${commandName} exceeded the closed output bound`));
      } else target.push(chunk);
    };
    child.stdout.on('data', collect(stdout));
    child.stderr.on('data', collect(stderr));
    child.on('error', reject);
    child.on('close', (status) => {
      if (status !== 0) reject(new Error(`${commandName} failed with exit code ${status}`));
      else resolve({ stdout: Buffer.concat(stdout).toString('utf8'), stderr: Buffer.concat(stderr).toString('utf8') });
    });
    child.stdin.end(options.input);
  });
}

function parseReviewStream(stdout) {
  const events = stdout.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
  const thread = events.find((event) => event.type === 'thread.started');
  const messages = events.filter((event) => event.type === 'item.completed' && event.item?.type === 'agent_message');
  if (!thread?.thread_id || messages.length === 0) fail('Codex review stream lacks a fresh session and final result');
  const output = JSON.parse(messages.at(-1).item.text);
  if (!output || typeof output !== 'object' || Array.isArray(output)) fail('P1 review output is not an object');
  const required = ['disposition', 'findings'];
  if (Object.keys(output).length !== required.length || required.some((key) => !Object.hasOwn(output, key))) {
    fail('P1 review output does not use the closed finding schema');
  }
  return { sessionId: thread.thread_id, output };
}

function protectedKey() {
  const pem = process.env.PROGRAMME_GATE_REVIEW_CONTROLLER_ED25519_PRIVATE_KEY_PEM;
  if (typeof pem !== 'string' || pem.length === 0) fail('controller key is unavailable');
  const privateKey = crypto.createPrivateKey(pem);
  const trusted = TRUSTED_PUBLIC_KEY_REGISTRY.keys.find((key) => key.key_id === CONTROLLER_KEY_ID);
  const actual = crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'der' });
  const expected = crypto.createPublicKey(trusted.public_key_pem).export({ type: 'spki', format: 'der' });
  if (!crypto.timingSafeEqual(crypto.createHash('sha256').update(actual).digest(), crypto.createHash('sha256').update(expected).digest())) {
    fail('controller key does not match the trusted registry');
  }
  return privateKey;
}

function exactCleanCommit(commit) {
  if (command('git', ['rev-parse', 'HEAD']).stdout.trim() !== commit
    || command('git', ['status', '--porcelain', '--untracked-files=all']).stdout !== '') {
    fail('review controller is not on the exact clean commit');
  }
}

async function sourceClosure(commit, nonce) {
  const generator = await import(new URL('./generate-canonical-contract-current-review.mjs', import.meta.url));
  return JSON.parse(generator.generateReviewSourceClosure({
    repositoryRoot: ROOT,
    codeCommit: commit,
    approvalEpochNonce: nonce,
  }).toString('utf8'));
}

function sourceDigest(bytes) { return sha256Hex(bytes); }

function sign(privateKey, domain, payload) {
  return crypto.sign(null, signatureBytes({ domain, role: 'REVIEW_CONTROLLER', payload }), privateKey).toString('base64');
}

function signedCarriers(request, results, privateKey) {
  if (
    request?.gate_id !== P1_CONTRACT_FREEZE_REVIEW_GATE_ID
    || !Array.isArray(results)
    || results.length !== P1_CONTRACT_FREEZE_REVIEW_LANES.length
    || results.some((result) => (
      result?.gate_id !== P1_CONTRACT_FREEZE_REVIEW_GATE_ID
    ))
  ) {
    fail('signed P1 review carriers require the exact governed P1 gate ID');
  }
  const unsignedCarriers = results.map((result, index) => {
    const task = request.tasks[index];
    const result_payload_digest = domainDigest(RESULT_PAYLOAD_DOMAIN, result);
    return {
      schema_version: 'P1ContractFreezeAuthenticatedResult/V1',
      registration_id: '0'.repeat(64),
      lane_id: task.lane_id,
      task_id: task.task_id,
      result_payload_digest,
      authenticated_result_digest: domainDigest(AUTHENTICATED_RESULT_ID_DOMAIN, {
        lane_id: task.lane_id,
        task_id: task.task_id,
        result_payload_digest,
      }),
      controller_key_id: CONTROLLER_KEY_ID,
      signature_algorithm: 'Ed25519',
      controller_signature: '',
    };
  });
  const registration = {
    schema_version: 'P1ContractFreezeReviewRegistration/V1',
    registration_id: '',
    gate_id: P1_CONTRACT_FREEZE_REVIEW_GATE_ID,
    exact_review_package_fingerprint: request.request_input.exact_review_package_fingerprint,
    exact_review_package_payload_digest: request.tasks[0].exact_review_input.exact_review_package_payload_digest,
    code_commit: request.request_input.code_commit,
    frozen_contract_pair_digest: request.request_input.frozen_contract_pair_digest,
    contract_freeze_attestation_id: request.request_input.source_closure_identity.contract_freeze_attestation_id,
    ordered_task_ids: request.tasks.map((task) => task.task_id),
    lanes: request.tasks.map((task, index) => ({
      lane_id: task.lane_id,
      task_id: task.task_id,
      reviewer_role: task.reviewer_binding.reviewer_role,
      reviewer_principal_id: task.reviewer_binding.reviewer_principal_id,
      reviewer_identity: task.reviewer_binding.reviewer_identity,
      reviewer_model_identifier: task.reviewer_binding.reviewer_model_identifier,
      reasoning_level: task.reviewer_binding.reasoning_level,
      reviewer_source_control_identity_set: task.reviewer_binding.reviewer_source_control_identity_set,
      immutable_session_id: task.reviewer_binding.independence_binding.immutable_session_id,
      reviewer_eligibility_digest: task.reviewer_binding.reviewer_eligibility_digest,
      source_control_authorship_event_set_root: task.reviewer_binding.independence_binding.source_control_authorship_event_set_root,
      review_disposition_id: task.reviewer_binding.review_disposition_id,
      expected_authenticated_result_digest: unsignedCarriers[index].authenticated_result_digest,
    })),
    controller_key_id: CONTROLLER_KEY_ID,
    signature_algorithm: 'Ed25519',
    controller_signature: '',
  };
  const { registration_id: ignoredId, controller_signature: ignoredSignature, ...registrationIdentity } = registration;
  void ignoredId;
  void ignoredSignature;
  registration.registration_id = domainDigest(REGISTRATION_ID_DOMAIN, registrationIdentity);
  registration.controller_signature = sign(privateKey, REGISTRATION_DOMAIN, {
    ...registrationIdentity,
    registration_id: registration.registration_id,
  });
  const authenticated_results = unsignedCarriers.map((carrier) => {
    const unsigned = { ...carrier, registration_id: registration.registration_id };
    return { ...unsigned, controller_signature: sign(privateKey, AUTHENTICATED_RESULT_DOMAIN, unsigned) };
  });
  return { registration, authenticated_results };
}

async function runLane({ lane, taskTemplate, packageBytes, runRoot }) {
  const laneRoot = fs.mkdtempSync(path.join(runRoot, `${lane.lane_id.toLowerCase()}-`));
  const working = path.join(laneRoot, 'review');
  const home = path.join(laneRoot, 'home');
  const codexHome = path.join(laneRoot, 'codex-home');
  const temporary = path.join(laneRoot, 'tmp');
  for (const directory of [working, home, codexHome, temporary]) fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(working, 'exact-review-package.json'), packageBytes, { mode: 0o444 });
  fs.writeFileSync(path.join(working, 'output-schema.json'), JSON.stringify(FINDING_OUTPUT_SCHEMA), { mode: 0o444 });
  const authFile = process.env.LOCAL_CODEX_AUTH_FILE || path.join(os.homedir(), '.codex', 'auth.json');
  if (!path.isAbsolute(authFile) || !fs.statSync(authFile).isFile()) fail('local Codex ChatGPT authentication is unavailable');
  fs.copyFileSync(authFile, path.join(codexHome, 'auth.json'));
  fs.chmodSync(path.join(codexHome, 'auth.json'), 0o600);
  const before = sourceDigest(packageBytes);
  const started_at = new Date().toISOString();
  const result = await commandAsync('/usr/bin/env', [
    '-i',
    `HOME=${home}`,
    `CODEX_HOME=${codexHome}`,
    `TMPDIR=${temporary}`,
    'PATH=/opt/homebrew/bin:/usr/bin:/bin',
    'LANG=en_US.UTF-8',
    'LC_ALL=en_US.UTF-8',
    'TERM=dumb',
    CODEX_PATH,
    '-s', 'read-only', '-a', 'never', '--strict-config', 'exec', '--ephemeral',
    '--ignore-user-config', '--ignore-rules', '--skip-git-repo-check',
    '-m', 'gpt-5.6-sol', '-c', 'model_reasoning_effort="high"',
    '--disable', 'multi_agent', '--disable', 'multi_agent_v2', '--json',
    '--output-schema', path.join(working, 'output-schema.json'), '-',
  ], { cwd: working, input: taskTemplate.prompt, env: {} });
  const ended_at = new Date().toISOString();
  if (sourceDigest(fs.readFileSync(path.join(working, 'exact-review-package.json'))) !== before) {
    fail('review changed exact package bytes');
  }
  return { ...parseReviewStream(result.stdout), started_at, ended_at, review_stdout_digest: sha256Hex(Buffer.from(result.stdout, 'utf8')) };
}

async function runProtectedP1Reviews({ commit, nonce, outputPath }) {
  exactCleanCommit(commit);
  if (!path.isAbsolute(outputPath || '') || !outputPath.startsWith(`${process.env.RUNNER_TEMP}/`)) {
    fail('review output must be outside the checkout in RUNNER_TEMP');
  }
  const closure = await sourceClosure(commit, nonce);
  const packageBytes = Buffer.from(canonicalJson(closure.exact_review_package), 'utf8');
  const executionPlan = createP1ContractFreezeReviewExecutionPlan({
    schema_version: 'P1ContractFreezeReviewExecutionPlanInput/V1',
    exact_review_package_fingerprint: closure.exact_review_package_fingerprint,
    exact_review_package_bytes_base64: packageBytes.toString('base64'),
    code_commit: commit,
    frozen_contract_pair_digest: closure.exact_review_package.frozen_contract_pair_digest,
    source_closure_identity: closure.exact_review_package.contract_freeze_attestation_identity,
  });
  const runRoot = fs.mkdtempSync(path.join(process.env.RUNNER_TEMP, 'p1-contract-freeze-review-'));
  try {
    const observed = await Promise.all(P1_CONTRACT_FREEZE_REVIEW_LANES.map((lane, index) => runLane({
      lane,
      taskTemplate: executionPlan.task_templates[index],
      packageBytes,
      runRoot,
    })));
    const sessions = observed.map((lane) => lane.sessionId);
    if (new Set(sessions).size !== P1_CONTRACT_FREEZE_REVIEW_LANES.length) fail('P1 reviews did not use three distinct fresh sessions');
    const finalised = finaliseP1ContractFreezeReviewExecution({
      executionPlan,
      observedReviews: observed.map((review, index) => ({
        lane_id: P1_CONTRACT_FREEZE_REVIEW_LANES[index].lane_id,
        immutable_session_id: review.sessionId,
        reviewer_model_identifier: 'gpt-5.6-sol',
        reasoning_level: 'high',
        finding_output: review.output,
      })),
      gitRuntime: { repositoryRoot: ROOT },
    });
    const { request, results } = finalised;
    const carriers = signedCarriers(request, results, protectedKey());
    const validation = validateP1ContractFreezeReviewResults({
      request,
      results,
      registration: carriers.registration,
      authenticatedResults: carriers.authenticated_results,
      reviewAuthority: { keyRegistry: TRUSTED_PUBLIC_KEY_REGISTRY, verificationTime: new Date().toISOString() },
      gitRuntime: { repositoryRoot: ROOT },
    });
    fs.writeFileSync(outputPath, canonicalJson({
      schema_version: 'P1ProtectedContractFreezeReviewControllerBundle/V1',
      code_commit: commit,
      exact_review_package_fingerprint: closure.exact_review_package_fingerprint,
      exact_review_package_payload_digest: sha256Hex(packageBytes),
      execution_plan: finalised.execution_plan,
      request,
      results,
      registration: carriers.registration,
      authenticated_results: carriers.authenticated_results,
      validation,
      controller_disposition: 'EVIDENCE_CREATED_NO_GATE_AUTHORITY',
    }), { mode: 0o600 });
  } finally {
    fs.rmSync(runRoot, { recursive: true, force: true });
  }
}

if (process.argv[1] && fs.realpathSync(path.resolve(process.argv[1])) === fs.realpathSync(new URL(import.meta.url).pathname)) {
  try {
    await runProtectedP1Reviews({
      commit: exactCommit(process.env.EXPECTED_PROGRAMME_COMMIT),
      nonce: process.env.P1_REVIEW_EPOCH_NONCE,
      outputPath: process.env.PROGRAMME_REVIEW_OUTPUT,
    });
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}

export { FINDING_OUTPUT_SCHEMA, runProtectedP1Reviews, signedCarriers };
