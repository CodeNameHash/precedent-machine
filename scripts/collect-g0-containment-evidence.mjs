#!/usr/bin/env node

import process from 'node:process';
import { createRequire } from 'node:module';

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
  createGoverningRegistryAuthority,
} = require('../lib/programme-gates/governing-registry');

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

async function successful(command, args, cwd, options = {}) {
  const result = await CONTAINMENT_RUNTIME.runCommand(command, args, {
    cwd,
    env: options.env,
  });
  if (result.exit_code !== 0) {
    fail(`${command} ${args.join(' ')} failed`);
  }
  return result.stdout.trim();
}

const root = process.cwd();
const origin = argument('--origin');
const environment = argument('--environment');
const deploymentId = argument('--deployment-id');
if (!origin || !/^https?:\/\//.test(origin)) {
  fail('--origin must be an HTTP or HTTPS origin');
}
if (!['STAGING', 'PRODUCTION'].includes(environment)) {
  fail('--environment must be STAGING or PRODUCTION');
}
if (!deploymentId) fail('--deployment-id is required');

const dirty = await successful('git', ['status', '--porcelain'], root);
if (dirty) fail('containment evidence requires a clean committed worktree');
const codeCommit = await successful('git', ['rev-parse', 'HEAD'], root);
const specificationOutput = await successful(
  process.execPath,
  ['scripts/verify-codex-program-spec.mjs'],
  root,
  {
    env: {
      NODE_ENV: 'test',
      PATH: process.env.PATH || '/usr/bin:/bin',
    },
  },
);
const specificationMatch = specificationOutput.match(
  /CODEX programme specification PASS ([a-f0-9]{64})/,
);
if (!specificationMatch) fail('could not resolve the exact specification root');
const originDeployment = JSON.parse(await successful(
  'vercel',
  ['inspect', origin, '--json'],
  root,
));
const deployment = JSON.parse(await successful(
  'vercel',
  ['api', `/v13/deployments/${deploymentId}`, '--raw'],
  root,
));
try {
  validateDeploymentBinding({
    deployment,
    originDeployment,
    deploymentId,
    environment,
    codeCommit,
    specificationRoot: specificationMatch[1],
  });
} catch (error) {
  fail(error.message);
}
if (!process.argv.includes('--skip-build')) {
  await successful('npm', ['run', 'build'], root, {
    env: {
      NODE_ENV: 'production',
      PATH: process.env.PATH || '/usr/bin:/bin',
    },
  });
}

const governingRegistryAuthority = createGoverningRegistryAuthority({
  readFileSync(file) {
    return CONTAINMENT_RUNTIME.readFile(file);
  },
  parseYaml(source) {
    return YAML.parse(source);
  },
  domainDigest,
});

const bundle = await collectContainmentEvidence({
  runtime: CONTAINMENT_RUNTIME,
  root,
  origin: origin.replace(/\/+$/, ''),
  environment,
  codeCommit,
  deploymentId,
  specificationRoot: specificationMatch[1],
  gates: governingRegistryAuthority.gates,
});

process.stdout.write(`${JSON.stringify(bundle, null, 2)}\n`);
