'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const {
  PHASE1_BASE_COMMIT,
  PURE_PROPOSAL_SOURCES,
  LOCAL_ARTIFACT_WRITERS,
  READ_ONLY_GIT_INSPECTORS,
  PRODUCTION_PATH_PURE_ANALYSIS_SOURCES,
  LIVE_EXTRACTION_RUN_SOURCES,
  REQUIRED_AUTHORITY_BOUNDARY_CONTRACT_SOURCES,
  EXPLICIT_NEW_SOURCE_CLASSES,
  classifyChangedProductionSources,
} = require('../lib/canonical-v2/phase1-authority-boundary-inventory');
const {
  captureDiscoveryRecords,
} = require('../lib/canonical-v2/corpus-source-discovery-capture');

const ROOT = path.resolve(__dirname, '..');
const PRODUCTION_ROOTS = Object.freeze(['lib', 'scripts', 'pages', 'components']);
const SOURCE_EXTENSION = /\.(?:[cm]?js|jsx|mjs|ts|tsx)$/;
const CAPABILITY_PATTERNS = Object.freeze({
  database: Object.freeze([
    /\b(?:createClient|getServiceSupabase)\s*\(/g,
    /\b(?:db|supabase|database)\s*\.\s*(?:from|rpc|insert|upsert|update|delete)\s*\(/g,
    /\b(?:INSERT\s+INTO|DELETE\s+FROM)\b/gi,
  ]),
  network: Object.freeze([
    /\bfetch\s*\(/g,
    /['"]node:https?['"]/g,
    /\bhttps?\s*\.\s*(?:request|get)\s*\(/g,
  ]),
  provider: Object.freeze([
    /@anthropic-ai\/sdk/g,
    /\bcreate(?:CodexCli|Anthropic)Provider\s*\(/g,
    /\bexecuteUnifiedRun\s*\(/g,
  ]),
  signing: Object.freeze([
    /\bcrypto\s*\.\s*sign\s*\(/g,
    /\bcreate(?:PrivateKey|Sign)\s*\(/g,
  ]),
  deployment_or_activation: Object.freeze([
    /\bvercel\s+deploy\b/gi,
    /\bactivate_candidate_release\s*\(/g,
  ]),
  external_process: Object.freeze([
    /['"]node:child_process['"]/g,
    /\b(?:execFileSync|execSync|spawnSync|spawn)\s*\(/g,
  ]),
  filesystem_write: Object.freeze([
    /\b(?:writeFileSync|writeFile|appendFileSync|appendFile|mkdirSync|mkdir|renameSync|rename|unlinkSync|unlink|rmSync|rm)\s*\(/g,
    /\bfs(?:Promises)?\s*\.\s*(?:writeFile|appendFile|mkdir|rename|unlink|rm)\s*\(/g,
  ]),
});
const PURE_FORBIDDEN_CAPABILITIES = Object.freeze(Object.keys(CAPABILITY_PATTERNS));
const LOCAL_WRITER_FORBIDDEN_CAPABILITIES = Object.freeze(PURE_FORBIDDEN_CAPABILITIES.filter((name) => name !== 'filesystem_write'));
const GIT_INSPECTOR_FORBIDDEN_CAPABILITIES = Object.freeze(LOCAL_WRITER_FORBIDDEN_CAPABILITIES.filter((name) => name !== 'external_process').concat('filesystem_write'));
// A live extraction run is allowed exactly the three capabilities that make
// it what it is -- provider (the real model call), external_process (the
// `claude` CLI it spawns) and filesystem_write (its receipts/evidence) --
// and nothing that would give it database, network, signing, or deployment
// authority.
const LIVE_EXTRACTION_RUN_FORBIDDEN_CAPABILITIES = Object.freeze(PURE_FORBIDDEN_CAPABILITIES.filter((name) => !['provider', 'external_process', 'filesystem_write'].includes(name)));
const ALLOWED_GIT_COMMANDS = Object.freeze(new Set(['rev-parse', 'show', 'status']));
// The capability scan reads one file's own text, so it cannot see a capability
// reached through an import. A production-path pure analysis source therefore
// has to be a leaf: no dependencies at all, nothing to reach through.
const MODULE_DEPENDENCY_PATTERNS = Object.freeze([
  /\brequire\s*\(/g,
  /^\s*import\b/gm,
]);

function git(args, options = {}) {
  return childProcess.execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', options.ignoreErrors ? 'ignore' : 'pipe'],
  }).trim();
}

function lines(value) {
  return value.split('\n').map((entry) => entry.trim()).filter(Boolean);
}

function mechanicallyDerivedChangedProductionSources() {
  const tracked = lines(git(['diff', '--name-only', '--diff-filter=ACMR', PHASE1_BASE_COMMIT, '--', ...PRODUCTION_ROOTS]));
  const untracked = lines(git(['ls-files', '--others', '--exclude-standard', '--', ...PRODUCTION_ROOTS]));
  return [...new Set([...tracked, ...untracked])].filter((entry) => SOURCE_EXTENSION.test(entry)).sort();
}

function existedAtBase(relativePath) {
  const result = childProcess.spawnSync('git', ['cat-file', '-e', `${PHASE1_BASE_COMMIT}:${relativePath}`], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'ignore',
  });
  return result.status === 0;
}

function sourceAtBase(relativePath) {
  return git(['show', `${PHASE1_BASE_COMMIT}:${relativePath}`], { ignoreErrors: true });
}

function capabilityCounts(source) {
  return Object.fromEntries(Object.entries(CAPABILITY_PATTERNS).map(([name, patterns]) => [
    name,
    patterns.reduce((count, pattern) => count + (source.match(pattern) || []).length, 0),
  ]));
}

function assertNoCapabilities(source, forbiddenCapabilities, label) {
  const counts = capabilityCounts(source);
  const present = forbiddenCapabilities.filter((name) => counts[name] > 0);
  assert.deepEqual(present, [], `${label} has forbidden capabilities: ${present.join(', ')}`);
}

function assertNoModuleDependencies(source, label) {
  const found = MODULE_DEPENDENCY_PATTERNS.reduce((count, pattern) => count + (source.match(pattern) || []).length, 0);
  assert.equal(found, 0, `${label} must declare no module dependencies: purity resting on an import is purity the capability scan never checked`);
}

function assertNoCapabilityGrowth(baseSource, currentSource, label) {
  const before = capabilityCounts(baseSource);
  const after = capabilityCounts(currentSource);
  const growth = Object.keys(after).filter((name) => after[name] > before[name]);
  assert.deepEqual(growth, [], `${label} adds capabilities: ${growth.join(', ')}`);
}

function extractedGitCommands(source) {
  const commands = [];
  const patterns = [
    /\bgit\([^,\n]+,\s*\[\s*['"]([^'"]+)['"]/g,
    /\bexecFileSync\(\s*['"]git['"]\s*,\s*\[\s*['"]([^'"]+)['"]/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) commands.push(match[1]);
  }
  return commands;
}

function assertReadOnlyGitInspector(source, label) {
  assertNoCapabilities(source, GIT_INSPECTOR_FORBIDDEN_CAPABILITIES, label);
  const processLaunches = source.match(/\bexecFileSync\s*\(/g) || [];
  const gitLaunches = source.match(/\bexecFileSync\(\s*['"]git['"]/g) || [];
  assert.equal(processLaunches.length, gitLaunches.length, `${label} may launch only the Git executable`);
  assert.ok(processLaunches.length > 0, `${label} must contain an explicit Git inspection`);
  const commands = extractedGitCommands(source);
  assert.ok(commands.length > 0, `${label} must declare Git commands as literal array heads`);
  assert.deepEqual(commands.filter((command) => !ALLOWED_GIT_COMMANDS.has(command)), [], `${label} contains a non-read-only Git command`);
}

test('every production source changed from the fixed Phase 1 base is classified exactly once', () => {
  assert.equal(git(['rev-parse', PHASE1_BASE_COMMIT]), PHASE1_BASE_COMMIT);
  const changedSources = mechanicallyDerivedChangedProductionSources();
  const inventory = classifyChangedProductionSources({ changedSources, existedAtBase });
  assert.equal(inventory.length, changedSources.length);
  assert.deepEqual(inventory.map((entry) => entry.path), changedSources);
  assert.ok(inventory.some((entry) => entry.classification === 'MODIFIED_PREEXISTING'));
  assert.deepEqual(new Set(inventory.map((entry) => entry.classification)), new Set([
    'PURE_PROPOSAL',
    'LOCAL_ARTIFACT_WRITER',
    'READ_ONLY_GIT_INSPECTOR',
    'PRODUCTION_PATH_PURE_ANALYSIS',
    'LIVE_EXTRACTION_RUN',
    'MODIFIED_PREEXISTING',
  ]));
});

test('pure proposals and local artefact writers have their exact capability boundaries', () => {
  assert.ok(PURE_PROPOSAL_SOURCES.includes('lib/canonical-v2/antitrust-v1-surface-disposition.js'));
  assert.ok(PURE_PROPOSAL_SOURCES.includes('lib/canonical-v2/bd837f1d-financing-source-open-world-pin.js'));
  for (const source of [
    'lib/canonical-v2/derived-comparison.js',
    'lib/canonical-v2/native-producer/ioc-mechanic-resolution.js',
    'lib/canonical-v2/native-producer/prompt-budget-split-preflight.js',
    'lib/canonical-v2/native-producer/sole-remedy-resolution.js',
    'lib/canonical-v2/policy-successor-m1-adoption-binding.js',
    'scripts/reprocess/v1-apply-guard.js',
    'lib/canonical-v2/legacy-card-bridge.js',
  ]) assert.ok(PURE_PROPOSAL_SOURCES.includes(source), source);
  for (const source of [
    'scripts/reprocess/v1-apply-backup.js',
    'scripts/reprocess/v1-apply-receipt.js',
    'scripts/reprocess/v1-apply-sequence.js',
  ]) assert.ok(LOCAL_ARTIFACT_WRITERS.includes(source), source);
  for (const source of Object.values(REQUIRED_AUTHORITY_BOUNDARY_CONTRACT_SOURCES)) {
    assert.ok(PURE_PROPOSAL_SOURCES.includes(source), source);
  }
  assert.equal(
    REQUIRED_AUTHORITY_BOUNDARY_CONTRACT_SOURCES.DARK_INTEGRATION_CURRENT_ENVIRONMENT_VERIFICATION,
    'lib/canonical-v2/dark-integration-preflight.js',
  );
  assert.equal(
    REQUIRED_AUTHORITY_BOUNDARY_CONTRACT_SOURCES.SUCCESSOR_M1_TRUSTED_CONTROLLER_VERIFICATION,
    'lib/canonical-v2/native-producer/durable-12-item-pilot-readiness.js',
  );
  assert.equal(
    REQUIRED_AUTHORITY_BOUNDARY_CONTRACT_SOURCES.GOVERNED_IDENTITY_LITERAL_KEY_REGISTRY_PATCH,
    'lib/canonical-v2/deal-identity-trusted-key-registry-proposal.js',
  );
  assert.ok(PURE_PROPOSAL_SOURCES.includes(REQUIRED_AUTHORITY_BOUNDARY_CONTRACT_SOURCES.SOURCE_INTAKE_TRUSTED_AUTHORITY_VERIFIER));
  for (const relativePath of PURE_PROPOSAL_SOURCES) {
    assertNoCapabilities(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'), PURE_FORBIDDEN_CAPABILITIES, relativePath);
  }
  for (const relativePath of LOCAL_ARTIFACT_WRITERS) {
    assertNoCapabilities(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'), LOCAL_WRITER_FORBIDDEN_CAPABILITIES, relativePath);
  }
});

test('production-path pure analysis sources are capability-free leaf modules', () => {
  assert.ok(PRODUCTION_PATH_PURE_ANALYSIS_SOURCES.includes('lib/agreement-revision-classifier.js'));
  for (const relativePath of PRODUCTION_PATH_PURE_ANALYSIS_SOURCES) {
    const source = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
    // The same full scan PURE_PROPOSAL gets, plus the leaf requirement. This
    // class is where live product logic goes, so it is the strictest of the
    // four, never a softer landing than the class it sits beside.
    assertNoCapabilities(source, PURE_FORBIDDEN_CAPABILITIES, relativePath);
    assertNoModuleDependencies(source, relativePath);
  }
});

test('live extraction run sources have their exact capability boundary', () => {
  assert.ok(LIVE_EXTRACTION_RUN_SOURCES.includes('scripts/canonical-v2-modiv-termination-fee-scope-correction-run.mjs'));
  for (const relativePath of LIVE_EXTRACTION_RUN_SOURCES) {
    const source = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
    assertNoCapabilities(source, LIVE_EXTRACTION_RUN_FORBIDDEN_CAPABILITIES, relativePath);
    const counts = capabilityCounts(source);
    assert.ok(counts.provider > 0, `${relativePath} must exercise a real provider call -- that is what distinguishes this class`);
    assert.ok(counts.external_process > 0, `${relativePath} must spawn its model CLI as an external process`);
    assert.ok(counts.filesystem_write > 0, `${relativePath} must write its run evidence to local files`);
  }
});

test('read-only Git inspectors launch only whitelisted inspection commands', () => {
  for (const relativePath of READ_ONLY_GIT_INSPECTORS) {
    assertReadOnlyGitInspector(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'), relativePath);
  }
});

test('modified pre-existing production sources do not add authority capabilities', () => {
  const inventory = classifyChangedProductionSources({
    changedSources: mechanicallyDerivedChangedProductionSources(),
    existedAtBase,
  });
  for (const entry of inventory.filter((item) => item.classification === 'MODIFIED_PREEXISTING')) {
    assertNoCapabilityGrowth(
      sourceAtBase(entry.path),
      fs.readFileSync(path.join(ROOT, entry.path), 'utf8'),
      entry.path,
    );
  }
});

test('the blocked capture compatibility surface cannot call any supplied boundary', async () => {
  let calls = 0;
  const hostileBoundary = new Proxy({}, { get() { calls += 1; throw new Error('boundary used'); } });
  await assert.rejects(
    captureDiscoveryRecords({
      records: hostileBoundary,
      artifactRoot: '/definitely/not/used',
      fetchImpl: hostileBoundary,
      fsImpl: hostileBoundary,
      db: hostileBoundary,
    }),
    /CONTROLLED_CAPTURE_EXECUTOR_UNAVAILABLE/,
  );
  assert.equal(calls, 0);
});

test('hostile inventory and capability changes fail closed', () => {
  const current = ['lib/new-pure.js'];
  const neverAtBase = () => false;
  assert.throws(
    () => classifyChangedProductionSources({ changedSources: [...current, 'lib/unclassified.js'], existedAtBase: neverAtBase, explicitClasses: { PURE_PROPOSAL: current } }),
    /UNCLASSIFIED_CHANGED_SOURCE: lib\/unclassified\.js/,
  );
  assert.throws(
    () => classifyChangedProductionSources({ changedSources: current, existedAtBase: neverAtBase, explicitClasses: { PURE_PROPOSAL: current, LOCAL_ARTIFACT_WRITER: current } }),
    /MULTIPLY_CLASSIFIED_CHANGED_SOURCE: lib\/new-pure\.js/,
  );
  assert.throws(
    () => classifyChangedProductionSources({ changedSources: current, existedAtBase: neverAtBase, explicitClasses: { PURE_PROPOSAL: [...current, 'lib/not-changed.js'] } }),
    /CLASSIFIED_SOURCE_NOT_CHANGED: lib\/not-changed\.js/,
  );
  assert.throws(
    () => classifyChangedProductionSources({ changedSources: current, existedAtBase: () => true, explicitClasses: { PURE_PROPOSAL: current } }),
    /PREEXISTING_SOURCE_EXPLICITLY_CLASSIFIED: lib\/new-pure\.js/,
  );
  assert.throws(() => assertNoCapabilities('fetch("https://example.invalid")', PURE_FORBIDDEN_CAPABILITIES, 'hostile pure'), /network/);
  assert.throws(() => assertNoCapabilities('createClient(url, key)', LOCAL_WRITER_FORBIDDEN_CAPABILITIES, 'hostile writer'), /database/);
  assert.throws(() => assertReadOnlyGitInspector("execFileSync('git', ['push'])", 'hostile inspector'), /non-read-only Git command/);
  assert.throws(() => assertNoCapabilityGrowth('', 'fetch(url)', 'hostile legacy'), /network/);
  assert.throws(() => assertNoModuleDependencies("const fs = require('node:fs');", 'hostile analysis'), /no module dependencies/);
  assert.throws(() => assertNoModuleDependencies("import fs from 'node:fs';", 'hostile analysis'), /no module dependencies/);
  assert.equal(Object.keys(EXPLICIT_NEW_SOURCE_CLASSES).length, 5);
});
