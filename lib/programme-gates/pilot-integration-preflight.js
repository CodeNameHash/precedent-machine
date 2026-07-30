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

const COMMIT = /^[a-f0-9]{40}$/;
const DIGEST = /^[a-f0-9]{64}$/;
function exactObject(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
}

function candidateEvidence(evidence, candidate, specificationRoot) {
  if (!COMMIT.test(candidate || '') || !DIGEST.test(specificationRoot || '')
    || !exactObject(evidence, ['manifest', 'development_compiles', 'deployment', 'test_receipts'])) return false;
  const bound = (value, schema, keys) => exactObject(value, keys)
    && value.schema_version === schema
    && value.candidate_commit === candidate
    && value.specification_root === specificationRoot;
  const manifest = evidence.manifest;
  const compiles = evidence.development_compiles;
  const deployment = evidence.deployment;
  const receipts = evidence.test_receipts;
  return bound(manifest, 'PilotIntegrationManifestReceipt/V1', ['schema_version', 'candidate_commit', 'specification_root', 'registered', 'actual_count', 'expected_count'])
    && manifest.registered === true && Number.isInteger(manifest.actual_count)
    && manifest.actual_count === manifest.expected_count
    && bound(compiles, 'PilotIntegrationCompileReceipt/V1', ['schema_version', 'candidate_commit', 'specification_root', 'compile_count', 'success'])
    && compiles.compile_count === 2 && compiles.success === true
    && bound(deployment, 'PilotIntegrationDeploymentReceipt/V1', ['schema_version', 'candidate_commit', 'specification_root', 'present'])
    && deployment.present === true
    && bound(receipts, 'PilotIntegrationTestReceipt/V1', ['schema_version', 'candidate_commit', 'specification_root', 'required_receipts', 'receipts'])
    && Array.isArray(receipts.required_receipts) && receipts.required_receipts.length > 0
    && Array.isArray(receipts.receipts)
    && receipts.required_receipts.every((receipt) => receipts.receipts.includes(receipt));
}

function deriveSignerCoverage(signerSource, requiredPaths) {
  if (typeof signerSource !== 'string' || !Array.isArray(requiredPaths)) {
    throw new TypeError('signer source and required paths are required');
  }
  const reviewBasis = signerSource.match(
    /const REVIEW_BASIS_COMMIT = '([a-f0-9]{40})';/,
  )?.[1];
  const allowedDeclaration = signerSource.match(
    /const OWNER_AUTHORITY_ALLOWED_PATHS = Object\.freeze\(\[([\s\S]*?)\n\]\);/,
  );
  if (!reviewBasis || !allowedDeclaration) {
    throw new Error('signer source does not expose the closed owner-authority policy');
  }
  const allowedBlock = allowedDeclaration[1];
  const inventory = [...allowedBlock.matchAll(/^\s*'([^']+)',\s*$/gm)]
    .map((match) => match[1]);
  const sortedRequired = [...requiredPaths].sort();
  const inventorySet = new Set(inventory);
  return Object.freeze({
    review_basis_commit: reviewBasis,
    allowed_paths: Object.freeze([...inventory]),
    non_allowlist_source_digest: crypto.createHash('sha256')
      .update(signerSource.replace(
        allowedDeclaration[0],
        'const OWNER_AUTHORITY_ALLOWED_PATHS = Object.freeze([<CLOSED_ALLOWLIST>]);',
      ))
      .digest('hex'),
    inventory_paths: Object.freeze(
      sortedRequired.filter((file) => inventorySet.has(file)),
    ),
    required_paths: Object.freeze(sortedRequired),
  });
}

function validateSignerPolicyEvolution(
  trustedSignerSource,
  candidateSignerSource,
  requiredPaths,
) {
  const trusted = deriveSignerCoverage(trustedSignerSource, requiredPaths);
  const candidate = deriveSignerCoverage(candidateSignerSource, requiredPaths);
  if (
    candidate.review_basis_commit !== trusted.review_basis_commit
    || candidate.non_allowlist_source_digest !== trusted.non_allowlist_source_digest
  ) {
    throw new Error('candidate signer changed protected policy outside its closed allowlist');
  }
  const trustedPaths = new Set(trusted.allowed_paths);
  const requiredPathSet = new Set(candidate.required_paths);
  const removed = trusted.allowed_paths.filter(
    (file) => !candidate.allowed_paths.includes(file),
  );
  const unrelatedAdditions = candidate.allowed_paths.filter(
    (file) => !trustedPaths.has(file) && !requiredPathSet.has(file),
  );
  if (removed.length > 0 || unrelatedAdditions.length > 0) {
    throw new Error('candidate signer allowlist change is not the exact monotonic integration delta');
  }
  return candidate;
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
  const evidenceReady = candidateEvidence(
    input.evidence,
    input.candidate?.head,
    input.specification_root,
  );
  check(4, 'manifest and contracts', evidenceReady
    && input.evidence.manifest.registered === true
    && input.evidence.manifest.actual_count === input.evidence.manifest.expected_count
    ? pass() : failure('STALE_MANIFEST_OR_COUNT', 'manifest registration or contract count is stale'));
  const compileInput = { evidence: input.evidence, candidate: input.candidate, specification_root: input.specification_root };
  const key = fingerprint(compileInput);
  const cacheHit = cache.has(key);
  let compile = cache.get(key);
  if (!cacheHit) {
    compile = evidenceReady && input.evidence.development_compiles.compile_count === 2
      && input.evidence.development_compiles.success === true;
    cache.set(key, compile);
  }
  check(5, 'development compiles', compile ? { ...pass(), cache_hit: cacheHit } : failure('FORMAL_FREEZE_PACKAGE_REQUIRED', 'no independently revalidated two-compile freeze package is available'));
  check(6, 'signer coverage', input.signer && exactPaths(input.signer.inventory_paths, input.signer.required_paths)
    ? pass() : failure('SIGNER_PATH_OMISSION', 'signer inventory does not cover every required path'));
  check(7, 'git author', input.author && input.author.email === 'bengoodchild@gmail.com'
    || input.author && Array.isArray(input.author.verified_aliases) && input.author.verified_aliases.includes(input.author.email)
    ? pass() : failure('BAD_AUTHOR_EMAIL', 'git author email is not the required address or a supplied verified alias'));
  check(8, 'deployment metadata', evidenceReady
    && input.evidence.deployment.present === true
    ? pass() : failure('DEPLOYMENT_METADATA_REQUIRED', 'no independently inspected deployment binding is available'));
  check(9, 'predecessor and receipts', input.publication && COMMIT.test(input.publication.commit || '')
    && Number.isInteger(input.publication.generation)
    && evidenceReady
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
  validateSignerPolicyEvolution,
  runPilotIntegrationPreflight,
};
