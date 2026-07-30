#!/usr/bin/env node

import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { canonicalJson } = require('../lib/canonical-v2/canonical-bytes');
const {
  createP1ContractFreezeReviewRequest,
  validateP1ContractFreezeReviewResults,
} = require('../lib/programme-gates/contract-freeze-review-tasks');
const REPOSITORY_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const GIT_RUNTIME = Object.freeze({ repositoryRoot: REPOSITORY_ROOT });

function fail(message) {
  throw new Error(message);
}

function parseArguments(argv) {
  const options = { input: null, request: null, results: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!['--input', '--request', '--results'].includes(argument)) {
      fail(`Unknown argument: ${argument}`);
    }
    const key = argument.slice(2);
    if (options[key] !== null) fail(`${argument} may be supplied only once`);
    index += 1;
    if (!argv[index]) fail(`${argument} requires a file path`);
    options[key] = argv[index];
  }
  const createMode =
    options.input !== null
    && options.request === null
    && options.results === null;
  const validateMode =
    options.input === null
    && options.request !== null
    && options.results !== null;
  if (!createMode && !validateMode) {
    fail('Use --input to create tasks, or --request with --results to validate results');
  }
  return options;
}

function readJsonFile(filePath, label) {
  const resolved = path.resolve(filePath);
  let stat;
  try {
    stat = fs.lstatSync(resolved);
  } catch {
    fail(`${label} does not exist`);
  }
  if (!stat.isFile() || stat.isSymbolicLink()) {
    fail(`${label} must be a regular non-symbolic-link file`);
  }
  let value;
  try {
    value = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  } catch {
    fail(`${label} must contain valid JSON`);
  }
  return value;
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const output = options.input !== null
    ? createP1ContractFreezeReviewRequest(
      readJsonFile(options.input, '--input'),
      { gitRuntime: GIT_RUNTIME },
    )
    : validateP1ContractFreezeReviewResults({
      request: readJsonFile(options.request, '--request'),
      results: readJsonFile(options.results, '--results'),
      gitRuntime: GIT_RUNTIME,
    });
  process.stdout.write(`${canonicalJson(output)}\n`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.code ? `${error.code}: ` : ''}${error.message}\n`);
  process.exitCode = 1;
}
