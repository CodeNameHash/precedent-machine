#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { domainDigest } = require('../lib/programme-gates/bytes');
const { COLD_REVIEW_TASKS, OUTPUT_SCHEMA } = require('../lib/programme-gates/cold-review-tasks');
const {
  CONTROLLER_RECORD_DOMAIN,
  CONTROLLER_RECORD_ROLE,
  buildTrustedReviewPlan,
  buildUnsignedTrustedReviewControllerRecord,
} = require('../lib/programme-gates/review-controller');
const { TRUSTED_PUBLIC_KEY_REGISTRY } = require('../lib/programme-gates/registry');

const ROOT = path.resolve(import.meta.dirname, '..');
const SPEC_PATHS = Object.freeze([
  'docs/codex-program/specification-manifest.json',
  'docs/CODEX-PROGRAM.md',
  'docs/codex-program/programme-gates.yaml',
  'docs/codex-program/bootstrap-acceptance-source.json',
  'docs/codex-program/canonical-contracts.md',
  'docs/codex-program/adversarial-tests.md',
]);
const CONTROLLER_KEY_ID = 'PROGRAMME_GATE_REVIEW_CONTROLLER_2026_07';
const CODEX_PATH = '/opt/homebrew/bin/codex';

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function exactCommit(value) {
  if (!/^[a-f0-9]{40}$/.test(value || '')) throw new Error('expected commit is invalid');
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
  if (result.status !== 0) {
    throw new Error(`${commandName} failed with exit code ${result.status}`);
  }
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
        return;
      }
      target.push(chunk);
    };
    child.stdout.on('data', collect(stdout));
    child.stderr.on('data', collect(stderr));
    child.on('error', reject);
    child.on('close', (status) => {
      if (status !== 0) {
        reject(new Error(`${commandName} failed with exit code ${status}`));
        return;
      }
      resolve({
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
      });
    });
    child.stdin.end(options.input);
  });
}

function specificationRoot() {
  const output = command(process.execPath, ['scripts/verify-codex-program-spec.mjs']).stdout;
  const match = output.match(/PASS ([a-f0-9]{64})\s*$/);
  if (!match) throw new Error('frozen specification root did not verify');
  return match[1];
}

function sourceDigest(directory) {
  return domainDigest('PROGRAMME_GATE_COLD_REVIEW_SOURCE_SET/V1', SPEC_PATHS.map((file) => ({
    path: file,
    sha256: sha256(fs.readFileSync(path.join(directory, file))),
  })));
}

function parseReviewStream(stdout) {
  const events = stdout.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
  const thread = events.find((event) => event.type === 'thread.started');
  const messages = events.filter((event) => (
    event.type === 'item.completed' && event.item?.type === 'agent_message'
  ));
  if (!thread?.thread_id || messages.length === 0) {
    throw new Error('Codex review stream lacks one immutable session and final message');
  }
  const finalMessage = messages.at(-1);
  return {
    sessionId: thread.thread_id,
    output: JSON.parse(finalMessage.item.text),
  };
}

function protectedKey() {
  const pem = process.env.PROGRAMME_GATE_REVIEW_CONTROLLER_ED25519_PRIVATE_KEY_PEM;
  if (typeof pem !== 'string' || pem.length === 0) throw new Error('controller key is unavailable');
  const privateKey = crypto.createPrivateKey(pem);
  const trusted = TRUSTED_PUBLIC_KEY_REGISTRY.keys.find((key) => key.key_id === CONTROLLER_KEY_ID);
  const actual = crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'der' });
  const expected = crypto.createPublicKey(trusted.public_key_pem).export({ type: 'spki', format: 'der' });
  if (!crypto.timingSafeEqual(crypto.createHash('sha256').update(actual).digest(),
    crypto.createHash('sha256').update(expected).digest())) {
    throw new Error('controller key does not match the trusted registry');
  }
  return privateKey;
}

function copySpecification(target) {
  for (const relative of SPEC_PATHS) {
    const destination = path.join(target, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(ROOT, relative), destination);
    fs.chmodSync(destination, 0o444);
  }
}

async function runLane({ lane, runRoot, exactSpecificationRoot, privateKey, commit }) {
  const laneRoot = fs.mkdtempSync(path.join(runRoot, `${lane.lane_id.toLowerCase()}-`));
  const specificationDirectory = path.join(laneRoot, 'specification');
  const home = path.join(laneRoot, 'home');
  const codexHome = path.join(laneRoot, 'codex-home');
  const temporary = path.join(laneRoot, 'tmp');
  for (const directory of [specificationDirectory, home, codexHome, temporary]) {
    fs.mkdirSync(directory, { recursive: true });
  }
  copySpecification(specificationDirectory);
  const authFile = process.env.LOCAL_CODEX_AUTH_FILE
    || path.join(os.homedir(), '.codex', 'auth.json');
  if (!path.isAbsolute(authFile) || !fs.statSync(authFile).isFile()) {
    throw new Error('local Codex ChatGPT authentication is unavailable');
  }
  fs.copyFileSync(authFile, path.join(codexHome, 'auth.json'));
  fs.chmodSync(path.join(codexHome, 'auth.json'), 0o600);
  const promptPath = path.join(laneRoot, 'prompt.txt');
  const schemaPath = path.join(laneRoot, 'output-schema.json');
  fs.writeFileSync(promptPath, lane.prompt, { mode: 0o444 });
  fs.writeFileSync(schemaPath, JSON.stringify(OUTPUT_SCHEMA), { mode: 0o444 });
  const runtimeContext = {
    context_version: 'TrustedReviewRuntimeContext/V1',
    review_runtime_binary_path: CODEX_PATH,
    review_runtime_version: command(CODEX_PATH, ['--version']).stdout.trim().replace('codex-cli ', 'codex-cli/'),
    review_runtime_binary_digest: sha256(fs.readFileSync(fs.realpathSync(CODEX_PATH))),
    working_directory: specificationDirectory,
    operating_system: process.platform,
    architecture: process.arch,
    home_path: home,
    codex_home_path: codexHome,
    tmpdir_path: temporary,
    path_value: '/opt/homebrew/bin:/usr/bin:/bin',
    lang: 'en_US.UTF-8',
    lc_all: 'en_US.UTF-8',
    term: 'dumb',
  };
  const manifestBytes = fs.readFileSync(path.join(ROOT, SPEC_PATHS[0]));
  const plan = buildTrustedReviewPlan({
    controller_version: 'LOCAL_REVIEW_CONTROLLER/V1',
    controller_run_id: `g0-${commit}`,
    immutable_task_id: `${commit}/${lane.lane_id}`,
    nonce: crypto.randomUUID(),
    controller_key_id: CONTROLLER_KEY_ID,
    task_manifest: {
      manifest_version: 'TrustedReviewTaskManifest/V1',
      lane_id: lane.lane_id,
      exact_specification_root: exactSpecificationRoot,
      frozen_specification: {
        manifest_id: 'codex-program-specification-manifest/v1',
        manifest_digest: sha256(manifestBytes),
        file_count: SPEC_PATHS.length,
        immutable: true,
      },
      registered_prompt: {
        prompt_id: lane.registered_prompt_id,
        path: promptPath,
        payload_digest: sha256(Buffer.from(lane.prompt)),
        byte_length: Buffer.byteLength(lane.prompt),
        immutable: true,
        contains_prior_review_conclusions: false,
      },
      output_schema: {
        schema_id: 'ColdReviewOutput/V1',
        path: schemaPath,
        payload_digest: sha256(Buffer.from(JSON.stringify(OUTPUT_SCHEMA))),
        byte_length: Buffer.byteLength(JSON.stringify(OUTPUT_SCHEMA)),
        immutable: true,
      },
    },
    runtime_context: runtimeContext,
  });
  const before = sourceDigest(specificationDirectory);
  const startedAt = new Date().toISOString();
  const result = await commandAsync(plan.invocation.executable, plan.invocation.arguments, {
    cwd: plan.invocation.working_directory,
    input: lane.prompt,
    env: {},
  });
  const endedAt = new Date().toISOString();
  const parsed = parseReviewStream(result.stdout);
  if (sourceDigest(specificationDirectory) !== before) throw new Error('review changed frozen inputs');
  const unsigned = buildUnsignedTrustedReviewControllerRecord({
    plan,
    observation: {
      immutable_session_id: parsed.sessionId,
      immutable_review_id: sha256(Buffer.from(`${lane.lane_id}\0${result.stdout}`)),
      review_start_time: startedAt,
      review_end_time: endedAt,
      input_context_digest_before_review: plan.exact_input_context_digest,
      input_context_digest_after_review: plan.exact_input_context_digest,
      review_output: parsed.output,
      reviewer_source_control_identity_set: [`${plan.controller_run_id}/${parsed.sessionId}`],
      reviewer_edit_set: [],
      parent_session_state: 'GENESIS',
      no_earlier_review_conclusions_were_inputs: true,
      fresh_cli_session_observed: true,
      read_only_execution_observed: true,
      controller_direct_execution_observed: true,
    },
  });
  return {
    lane_id: lane.lane_id,
    controller_record: {
      ...unsigned.unsigned_record_payload,
      controller_signature: crypto.sign(
        null,
        Buffer.from(unsigned.signing_frame.bytes_base64, 'base64'),
        privateKey,
      ).toString('base64'),
    },
    review_output: parsed.output,
  };
}

const commit = exactCommit(process.env.EXPECTED_PROGRAMME_COMMIT);
if (command('git', ['rev-parse', 'HEAD']).stdout.trim() !== commit
  || command('git', ['status', '--porcelain']).stdout !== '') {
  throw new Error('review controller is not on the exact clean commit');
}
const outputPath = process.env.PROGRAMME_REVIEW_OUTPUT;
if (!path.isAbsolute(outputPath || '') || !outputPath.startsWith(`${process.env.RUNNER_TEMP}/`)) {
  throw new Error('review output must be outside the checkout in RUNNER_TEMP');
}
const runRoot = fs.mkdtempSync(path.join(process.env.RUNNER_TEMP, 'g0-cold-review-'));
try {
  const root = specificationRoot();
  const privateKey = protectedKey();
  const reviews = await Promise.all(COLD_REVIEW_TASKS.map((lane) => runLane({
    lane,
    runRoot,
    exactSpecificationRoot: root,
    privateKey,
    commit,
  })));
  fs.writeFileSync(outputPath, JSON.stringify({
    schema_version: 'ProgrammeGateColdReviewControllerBundle/V1',
    code_commit: commit,
    specification_root: root,
    reviews,
  }), { mode: 0o600 });
} finally {
  fs.rmSync(runRoot, { recursive: true, force: true });
}
