#!/usr/bin/env node

import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { TRUSTED_PUBLIC_KEY_REGISTRY } = require('../lib/programme-gates/registry');

const EXPECTED_KEYS = Object.freeze({
  PROGRAMME_GATE_REVIEW_CONTROLLER_ED25519_PRIVATE_KEY_PEM:
    'PROGRAMME_GATE_REVIEW_CONTROLLER_2026_07',
  PROGRAMME_GATE_VALIDATOR_ED25519_PRIVATE_KEY_PEM:
    'PROGRAMME_GATE_VALIDATOR_2026_07',
});

function run(command, args, environment = process.env) {
  return execFileSync(command, args, {
    encoding: 'utf8',
    env: environment,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function requireCommit(value, label) {
  if (!/^[a-f0-9]{40}$/.test(value || '')) throw new Error(`${label} is not an exact commit`);
  return value;
}

function publicDigest(key) {
  return crypto.createHash('sha256').update(crypto.createPublicKey(key).export({
    type: 'spki',
    format: 'der',
  })).digest();
}

function verifyProtectedKey(environmentName, keyId) {
  const pem = process.env[environmentName];
  if (typeof pem !== 'string' || pem.length === 0) {
    throw new Error(`${environmentName} is unavailable`);
  }
  const privateKey = crypto.createPrivateKey(pem);
  if (privateKey.asymmetricKeyType !== 'ed25519') {
    throw new Error(`${environmentName} is not Ed25519`);
  }
  const trusted = TRUSTED_PUBLIC_KEY_REGISTRY.keys.find((entry) => entry.key_id === keyId);
  if (!trusted || !crypto.timingSafeEqual(
    publicDigest(privateKey),
    publicDigest(trusted.public_key_pem),
  )) throw new Error(`${environmentName} does not match the trusted public key`);
}

const expectedCommit = requireCommit(process.env.EXPECTED_PROGRAMME_COMMIT, 'expected commit');
const head = requireCommit(run('git', ['rev-parse', 'HEAD']), 'checked-out commit');
if (head !== expectedCommit || run('git', ['status', '--porcelain']) !== '') {
  throw new Error('local review runner is not on the exact clean requested commit');
}
if (process.platform !== 'darwin' || process.arch !== 'arm64') {
  throw new Error('local review runner is not the approved macOS arm64 host');
}
for (const [environmentName, keyId] of Object.entries(EXPECTED_KEYS)) {
  verifyProtectedKey(environmentName, keyId);
}

const childEnvironment = { ...process.env };
for (const name of [
  ...Object.keys(EXPECTED_KEYS),
  'PROGRAMME_GATE_BEN_APPROVER_ED25519_PRIVATE_KEY_PEM',
  'PROGRAMME_STATUS_PUBLISHER_ED25519_PRIVATE_KEY_PEM',
  'OPENAI_API_KEY',
  'CODEX_API_KEY',
  'CODEX_ACCESS_TOKEN',
]) delete childEnvironment[name];

const version = run('codex', ['--version'], childEnvironment);
const auth = run('codex', ['login', 'status'], childEnvironment);
if (!/^codex-cli 0\.\d+\.\d+$/.test(version) || auth !== 'Logged in using ChatGPT') {
  throw new Error('local Codex CLI is not authenticated through ChatGPT');
}

process.stdout.write(JSON.stringify({
  schema_version: 'LocalReviewControllerPreflight/V1',
  code_commit: head,
  platform: process.platform,
  architecture: process.arch,
  codex_version: version,
  authentication: 'CHATGPT',
  protected_key_count: Object.keys(EXPECTED_KEYS).length,
  api_key_present_in_child_environment: false,
}) + '\n');
