'use strict';

const crypto = require('node:crypto');

function fingerprint(input) {
  return crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');
}

function failure(code, detail) {
  return { state: 'BLOCKED', blocker: { code, detail } };
}

function pass() { return { state: 'READY', blocker: null }; }

function exactPaths(actual, allowed) {
  return Array.isArray(actual) && Array.isArray(allowed)
    && actual.length === allowed.length
    && actual.every((value, index) => value === allowed[index]);
}

function deriveSignerCoverage(signerSource, requiredPaths) {
  if (typeof signerSource !== 'string' || !Array.isArray(requiredPaths)) {
    throw new TypeError('signer source and required paths are required');
  }
  const reviewBasis = signerSource.match(
    /const REVIEW_BASIS_COMMIT = '([a-f0-9]{40})';/,
  )?.[1];
  const allowedBlock = signerSource.match(
    /const OWNER_AUTHORITY_ALLOWED_PATHS = Object\.freeze\(\[([\s\S]*?)\n\]\);/,
  )?.[1];
  if (!reviewBasis || allowedBlock === undefined) {
    throw new Error('signer source does not expose the closed owner-authority policy');
  }
  const inventory = [...allowedBlock.matchAll(/^\s*'([^']+)',\s*$/gm)]
    .map((match) => match[1]);
  const sortedRequired = [...requiredPaths].sort();
  const inventorySet = new Set(inventory);
  return Object.freeze({
    review_basis_commit: reviewBasis,
    inventory_paths: Object.freeze(
      sortedRequired.filter((file) => inventorySet.has(file)),
    ),
    required_paths: Object.freeze(sortedRequired),
  });
}

function runPilotIntegrationPreflight(input, cache = new Map()) {
  const stages = [];
  const check = (number, name, result) => stages.push({ stage: number, name, ...result });
  check(1, 'main ancestry', input.main && input.main.head === input.main.expected_commit
    && input.main.is_expected_ancestor === true ? pass() : failure('STALE_MAIN', 'main is not the signed commit or ancestry basis'));
  check(2, 'worktrees', Array.isArray(input.worktrees) && input.worktrees.every((worktree) => worktree.clean === true)
    ? pass() : failure('DIRTY_WORKTREE', 'one or more worktrees are dirty'));
  check(3, 'allowed paths', exactPaths(input.changed_paths, input.allowed_paths)
    ? pass() : failure('PATH_VIOLATION', 'changed paths do not exactly match the allowlist'));
  check(4, 'manifest and contracts', input.manifest && input.manifest.registered === true
    && input.contracts && input.contracts.actual_count === input.contracts.expected_count
    ? pass() : failure('STALE_MANIFEST_OR_COUNT', 'manifest registration or contract count is stale'));
  const compileInput = { manifest: input.manifest, contracts: input.contracts, compiler: input.compiler };
  const key = fingerprint(compileInput);
  const cacheHit = cache.has(key);
  let compile = cache.get(key);
  if (!cacheHit) {
    compile = input.compiler && input.compiler.development_compiles === 2 && input.compiler.success === true;
    cache.set(key, compile);
  }
  check(5, 'development compiles', compile ? { ...pass(), cache_hit: cacheHit } : failure('BUNDLE_COMPILE_FAILURE', 'two development compiles did not succeed'));
  check(6, 'signer coverage', input.signer && exactPaths(input.signer.inventory_paths, input.signer.required_paths)
    ? pass() : failure('SIGNER_PATH_OMISSION', 'signer inventory does not cover every required path'));
  check(7, 'git author', input.author && input.author.email === 'bengoodchild@gmail.com'
    || input.author && Array.isArray(input.author.verified_aliases) && input.author.verified_aliases.includes(input.author.email)
    ? pass() : failure('BAD_AUTHOR_EMAIL', 'git author email is not the required address or a supplied verified alias'));
  check(8, 'deployment metadata', input.deployment && input.deployment.present === true
    && input.deployment.code_commit === input.main.expected_commit
    && input.deployment.specification_root === input.deployment.expected_specification_root
    ? pass() : failure('DEPLOYMENT_METADATA_MISMATCH', 'deployment metadata is missing or not bound to the exact commit and specification root'));
  check(9, 'predecessor and receipts', input.publication && input.publication.commit === input.publication.expected_predecessor_commit
    && input.publication.generation === input.publication.expected_generation
    && Array.isArray(input.test_receipts) && Array.isArray(input.required_test_receipts)
    && input.required_test_receipts.every((receipt) => input.test_receipts.includes(receipt))
    ? pass() : failure('STALE_PREDECESSOR_OR_MISSING_RECEIPT', 'publication predecessor is stale or a required test receipt is absent'));
  return Object.freeze({
    preflight_type: 'PilotIntegrationPreflight/V1',
    state: stages.every((stage) => stage.state === 'READY') ? 'READY_FOR_INTEGRATION' : 'BLOCKED',
    stages: Object.freeze(stages.map(Object.freeze)),
    input_fingerprint: key,
    final_freeze_compiles_required: 2,
    mutations: Object.freeze([]),
  });
}

module.exports = {
  fingerprint,
  deriveSignerCoverage,
  runPilotIntegrationPreflight,
};
