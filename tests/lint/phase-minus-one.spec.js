const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const { execFileSync, spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const path = require('node:path');
const YAML = require('yaml');

const { dedupeRegistry } = require('../../scripts/registry/dedupe');
const {
  SAFE_EXACT_PATHS,
  classifyChangedFiles,
} = require('../../scripts/ci/baseline-manifest-impact');
const {
  HEAVY_FILES,
  HEAVY_FILE_PARTITIONS,
  REGISTRATION_TEST,
  SEALED_WORK3_BYTE_LENGTH,
  SEALED_WORK3_RECEIPT,
  SEALED_WORK3_SHA256,
  SEALED_WORK3_TEST,
  TOTAL_SHARDS,
  WORK3_PARTS,
  WORK3_PART_TITLE_NUMBERS,
  WORK3_TITLES,
  assertSuccessfulLane,
  assignOrdinaryFiles,
  assignedOrdinaryShard,
  buildLaneArguments,
  buildShardPlan,
  buildWork3Pattern,
  discoverTestFiles,
  nativeShardForIndex,
  parseArguments,
  parseShard,
  parseTopLevelTitles,
  validateWork3Tap,
  verifySealedWork3,
} = require('../../scripts/ci/run-unit-test-shard');

const INVARIANT_COMMANDS = [
  ['node', ['scripts/audit/ioc-scope-mismatch.js'], /^INVARIANT-2: PASS/m],
  ['node', ['scripts/lint/closing-condition-scope.js'], /^INVARIANT-3: PASS/m],
  ['bash', ['scripts/lint/forbidden-patterns.sh'], /^INVARIANT-4: PASS/m],
  ['node', ['scripts/lint/market-registry-completeness.js'], /^INVARIANT-5: PASS/m],
  ['node', ['scripts/lint/component-reuse.js'], /^INVARIANT-6: PASS/m],
  ['node', ['scripts/lint/party-scope-audit.js'], /^INVARIANT-7: PASS/m],
  ['node', ['scripts/registry/detect-duplicates.js'], /^INVARIANT-8: PASS/m],
  ['node', ['scripts/registry/orphan-detector.js'], /^INVARIANT-9: PASS/m],
  ['node', ['scripts/registry/coverage-detector.js'], /^INVARIANT-10: PASS/m],
  ['node', ['scripts/registry/provenance-log.js'], /^INVARIANT-11: PASS/m],
];

const SCRIPT_FILES = [
  'scripts/audit/ioc-scope-mismatch.js',
  'scripts/lint/closing-condition-scope.js',
  'scripts/lint/forbidden-patterns.sh',
  'scripts/lint/market-registry-completeness.js',
  'scripts/lint/component-reuse.js',
  'scripts/lint/party-scope-audit.js',
  'scripts/registry/dedupe.js',
  'scripts/registry/detect-duplicates.js',
  'scripts/registry/orphan-detector.js',
  'scripts/registry/coverage-detector.js',
  'scripts/registry/provenance-log.js',
  'scripts/ci/detect-phase.js',
  'scripts/ci/check-allowlist.js',
  'scripts/ci/baseline-checkpoint.js',
  'scripts/ci/baseline-manifest-impact.js',
  'scripts/ci/expensive-check-checkpoint.mjs',
  'scripts/ci/run-unit-test-shard.js',
  'scripts/ci/run-all-invariants.sh',
];

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function appendixFBlocks() {
  const src = fs.readFileSync('archive/pm-master-straitjacket.codex.md', 'utf8');
  const appendix = src.slice(src.indexOf('# APPENDIX F'), src.indexOf('# APPENDIX G'));
  return [...appendix.matchAll(/```json\n([\s\S]*?)\n```/g)].map((match) => JSON.parse(match[1]));
}

test('PH-1-A every invariant and CI script exists and is executable', () => {
  for (const file of SCRIPT_FILES) {
    assert.equal(fs.existsSync(file), true, file);
    assert.notEqual(fs.statSync(file).mode & 0o111, 0, file);
  }
});

test('PH-1-B every invariant script exits cleanly with PASS stdout', () => {
  for (const [cmd, args, pattern] of INVARIANT_COMMANDS) {
    const result = spawnSync(cmd, args, { cwd: process.cwd(), encoding: 'utf8' });
    assert.equal(result.status, 0, `${cmd} ${args.join(' ')}\n${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, pattern);
  }
});

test('PH-1-C phase allowlist files match Appendix F', () => {
  const blocks = appendixFBlocks().filter((block) => block.phase !== '-1');
  for (const block of blocks) {
    const actual = JSON.parse(fs.readFileSync(`.github/phase-allowlists/phase-${block.phase}.json`, 'utf8'));
    assert.deepEqual(actual, block);
  }
});

test('PH-1-D ACK reference pins straitjacket SHA256', () => {
  const reference = fs.readFileSync('docs/acks/ACK-MASTER-V1.reference.md', 'utf8');
  assert.match(reference, new RegExp(`PM_MASTER_STRAITJACKET_SHA256: ${sha256('archive/pm-master-straitjacket.codex.md')}`));
  assert.match(reference, /I acknowledge master straitjacket WP-MASTER-V1/);
  const worklog = fs.readFileSync('archive/WORKLOG-P-1.md', 'utf8');
  assert.match(worklog, new RegExp(`PM_MASTER_STRAITJACKET_SHA256: ${sha256('archive/pm-master-straitjacket.codex.md')}`));
});

test('PH-1-E CI workflow names every invariant script', () => {
  const ci = fs.readFileSync('.github/workflows/ci.yml', 'utf8');
  for (const [, args] of INVARIANT_COMMANDS) {
    assert.match(ci, new RegExp(args[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('PH-1-F baseline gate skips only the reviewed preview and non-input paths', () => {
  const previewPaths = [
    'components/review-v2/SevenFamilyV1Surface.jsx',
    'lib/canonical-v2/phase1-authority-boundary-inventory.js',
    'lib/canonical-v2/seven-family-grouping-preview-source.js',
    'lib/canonical-v2/seven-family-v1-preview-deal.js',
    'lib/canonical-v2/seven-family-v2-review-evidence.js',
    'pages/design/canonical-v2-seven-family.js',
    'tests/canonical-v2-phase1-authority-boundary.test.js',
    'tests/canonical-v2-seven-family-grouping-preview.test.js',
  ];
  assert.deepEqual(classifyChangedFiles(previewPaths), {
    run: false,
    changedFiles: [...previewPaths].sort(),
    impactingFiles: [],
    reason: 'KNOWN_NON_INPUT_ONLY',
  });
  assert.equal(classifyChangedFiles(['docs/codex-program/notes/example.md']).run, false);
  assert.equal(classifyChangedFiles(['tests/unit/example.test.js']).run, false);
  assert.equal(classifyChangedFiles(['.github/workflows/ci.yml']).run, false);
  assert.equal(classifyChangedFiles(['scripts/ci/check-allowlist.js']).run, false);
  assert.equal(classifyChangedFiles(['scripts/ci/baseline-manifest-impact.js']).run, false);

  const inputs = [
    'evidence/canonical-v2/example/adapter-result.json',
    '.github/phase-allowlists/phase-0-B.json',
    'lib/canonical-v2/validate-write-set.js',
    'scripts/canonical-v2-baseline-manifest.mjs',
    'scripts/check-allowlist-runtime.js',
    'tests/fixtures/canonical-v2/example.json',
    'package-lock.json',
    'unknown/input.json',
  ];
  for (const input of inputs) assert.equal(classifyChangedFiles([input]).run, true, input);
  for (const whitespacePaddedPath of [
    ' scripts/ci/runtime-input.js',
    'scripts/ci/runtime-input.js ',
    ' .github/workflows/ci.yml',
    '.github/workflows/ci.yml ',
  ]) {
    assert.equal(classifyChangedFiles([whitespacePaddedPath]).run, true, whitespacePaddedPath);
  }
  assert.deepEqual(classifyChangedFiles([]), {
    run: true,
    changedFiles: [],
    impactingFiles: [],
    reason: 'NO_DIFF_AVAILABLE',
  });

  require('../../lib/canonical-v2/evidence-to-write-set-bridge');
  require('../../lib/canonical-v2/canonical-writer');
  require('../../lib/canonical-v2/contract-bundle');
  for (const file of SAFE_EXACT_PATHS) {
    if (!file.startsWith('lib/')) continue;
    assert.equal(require.cache[path.resolve(file)], undefined, `${file} entered the baseline import graph`);
  }
});

test('PH-1-G CI reuses only an exact validated baseline checkpoint', () => {
  const ci = fs.readFileSync('.github/workflows/ci.yml', 'utf8');
  const workflow = YAML.parse(ci);
  assert.equal(workflow.jobs['baseline-checkpoint-plan'], undefined);
  assert.equal(workflow.jobs['baseline-manifest'], undefined);

  const invariants = workflow.jobs.invariants;
  assert.equal(invariants.needs, 'test-and-build');
  assert.equal(
    invariants.concurrency.group,
    '${{ github.workflow }}-invariants-${{ github.event.pull_request.number || github.ref }}',
  );
  assert.equal(invariants.concurrency['cancel-in-progress'], false);

  const digestIndex = invariants.steps.findIndex((step) => step.id === 'baseline-digest');
  const restoreIndex = invariants.steps.findIndex((step) => step.id === 'restore-baseline-checkpoint');
  const planIndex = invariants.steps.findIndex((step) => step.id === 'baseline-checkpoint');
  const gateIndex = invariants.steps.findIndex((step) => step.id === 'baseline-gate');
  const markerIndex = invariants.steps.findIndex((step) => step.id === 'write-baseline-checkpoint');
  const saveIndex = invariants.steps.findIndex((step) => step.id === 'save-baseline-checkpoint');
  const invariant4Index = invariants.steps.findIndex((step) => step.name?.startsWith('Invariant 4'));
  const invariant5Index = invariants.steps.findIndex((step) => step.name?.startsWith('Invariant 5'));
  assert.ok(
    invariant4Index < digestIndex
      && digestIndex < restoreIndex
      && restoreIndex < planIndex
      && planIndex < gateIndex
      && gateIndex < markerIndex
      && markerIndex < saveIndex
      && saveIndex < invariant5Index,
  );

  const digest = invariants.steps[digestIndex];
  assert.equal(digest['continue-on-error'], true);
  assert.match(digest.run, /baseline-checkpoint\.js digest HEAD/);
  assert.match(digest.run, /\^\[0-9a-f\]\{64\}\$/);

  const restore = invariants.steps[restoreIndex];
  assert.equal(restore.uses, 'actions/cache/restore@v4');
  assert.equal(restore['continue-on-error'], true);
  assert.equal(restore.if, "steps.baseline-digest.outcome == 'success'");
  assert.equal(
    restore.with.key,
    'baseline-manifest-checkpoint-v1-${{ steps.baseline-digest.outputs.digest }}',
  );
  assert.equal(restore.with['restore-keys'], undefined);

  const plan = invariants.steps[planIndex];
  assert.equal(plan['continue-on-error'], true);
  assert.equal(
    plan.env.TRUSTED_BOOTSTRAP_DIGEST,
    'fc92a405933b1c6afa711bf0fa699c602a1e10c230608ebd2e0a424451173766',
  );
  assert.match(ci, /run 33644008260, job 100320715255, at head commit 94d30da4/);
  assert.doesNotMatch(plan.run, /gh api|git fetch/);
  assert.match(plan.run, /baseline-checkpoint\.js verify/);
  assert.match(plan.run, /CACHE_HIT.*false/);

  const gate = invariants.steps[gateIndex];
  assert.equal(gate.if, "steps.baseline-checkpoint.outputs.run_gate != 'false'");
  assert.equal(gate.run, 'npm run gate:baseline');
  const marker = invariants.steps[markerIndex];
  assert.equal(marker['continue-on-error'], undefined);
  assert.match(marker.if, /steps\.baseline-gate\.outcome == 'success'/);
  assert.match(marker.if, /steps\.baseline-checkpoint\.outputs\.seed_marker == 'true'/);
  assert.match(marker.run, /baseline-checkpoint\.js write/);
  const save = invariants.steps[saveIndex];
  assert.equal(save.uses, 'actions/cache/save@v4');
  assert.equal(save['continue-on-error'], true);
  assert.equal(save.with.key, restore.with.key);
  assert.equal(save.with.path, restore.with.path);

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'baseline-checkpoint-plan-'));
  const markerFile = path.join(directory, 'marker.txt');
  const trustedDigest = plan.env.TRUSTED_BOOTSTRAP_DIGEST;
  const checkpoint = require('../../scripts/ci/baseline-checkpoint');
  const runPlan = (name, env = {}) => {
    const output = path.join(directory, `${name}.out`);
    const result = spawnSync('bash', ['-c', plan.run], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        ...process.env,
        CACHE_HIT: '',
        DIGEST_OUTCOME: 'success',
        EXPECTED_DIGEST: trustedDigest,
        GITHUB_OUTPUT: output,
        MARKER_FILE: markerFile,
        RESTORE_OUTCOME: 'success',
        TRUSTED_BOOTSTRAP_DIGEST: trustedDigest,
        ...env,
      },
    });
    assert.equal(result.status, 0, `${name}: ${result.stdout}\n${result.stderr}`);
    return Object.fromEntries(
      fs.readFileSync(output, 'utf8').trim().split('\n').map((line) => line.split('=')),
    );
  };
  try {
    checkpoint.writeMarker(markerFile, trustedDigest);
    assert.deepEqual(runPlan('exact', { CACHE_HIT: 'true' }), {
      run_gate: 'false',
      seed_marker: 'false',
      reason: 'exact-checkpoint',
    });
    for (const cacheHit of ['', 'false']) {
      assert.deepEqual(runPlan(`bootstrap-${cacheHit || 'empty'}`, { CACHE_HIT: cacheHit }), {
        run_gate: 'false',
        seed_marker: 'true',
        reason: 'trusted-bootstrap',
      });
    }
    for (const [name, env, reason] of [
      ['changed-input', { EXPECTED_DIGEST: 'b'.repeat(64) }, 'cache-miss'],
      ['restore-error', { RESTORE_OUTCOME: 'failure' }, 'cache-restore-error'],
      ['digest-error', { DIGEST_OUTCOME: 'failure' }, 'digest-unavailable'],
      ['malformed-cache-output', { CACHE_HIT: 'unknown' }, 'non-exact-cache-result'],
    ]) {
      assert.deepEqual(runPlan(name, env), {
        run_gate: 'true',
        seed_marker: 'false',
        reason,
      });
    }
    fs.writeFileSync(markerFile, `FAIL\n${trustedDigest}\n`);
    assert.deepEqual(runPlan('malformed-marker', { CACHE_HIT: 'true' }), {
      run_gate: 'true',
      seed_marker: 'false',
      reason: 'marker-missing-or-malformed',
    });
    fs.rmSync(markerFile);
    assert.deepEqual(runPlan('missing-marker', { CACHE_HIT: 'true' }), {
      run_gate: 'true',
      seed_marker: 'false',
      reason: 'marker-missing-or-malformed',
    });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
test('PH-1-H moves and copies across safe boundaries still run the gate', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'baseline-impact-rename-'));
  const runGit = (args) => execFileSync('git', args, {
    cwd: directory,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
  try {
    runGit(['init', '-q']);
    const baseFiles = {
      '.github/workflows/ci.yml': 'name: CI\n',
      'lib/canonical-v2/input.js': 'module.exports = true;\n',
      'lib/canonical-v2/seven-family-v2-review-evidence.js': 'module.exports = {};\n',
      'scripts/ci/check-allowlist.js': '#!/usr/bin/env node\n',
    };
    for (const [file, contents] of Object.entries(baseFiles)) {
      fs.mkdirSync(path.join(directory, path.dirname(file)), { recursive: true });
      fs.writeFileSync(path.join(directory, file), contents);
    }
    runGit(['add', '--', ...Object.keys(baseFiles)]);
    runGit(['-c', 'user.name=CI Test', '-c', 'user.email=ci@example.invalid', 'commit', '-qm', 'input']);
    const base = runGit(['rev-parse', 'HEAD']);

    fs.mkdirSync(path.join(directory, 'docs'), { recursive: true });
    fs.renameSync(
      path.join(directory, 'lib/canonical-v2/input.js'),
      path.join(directory, 'docs/moved.md'),
    );
    fs.renameSync(
      path.join(directory, '.github/workflows/ci.yml'),
      path.join(directory, 'lib/ci-workflow.yml'),
    );
    fs.copyFileSync(
      path.join(directory, 'scripts/ci/check-allowlist.js'),
      path.join(directory, 'scripts/check-allowlist-runtime.js'),
    );
    fs.copyFileSync(
      path.join(directory, 'lib/canonical-v2/seven-family-v2-review-evidence.js'),
      path.join(directory, 'lib/canonical-v2/seven-family-v2-runtime-evidence.js'),
    );
    const whitespacePaddedPath = ' scripts/ci/runtime-input.js';
    fs.mkdirSync(path.join(directory, path.dirname(whitespacePaddedPath)), { recursive: true });
    fs.writeFileSync(path.join(directory, whitespacePaddedPath), 'module.exports = true;\n');
    runGit([
      'add', '--',
      '.github/workflows/ci.yml',
      'docs/moved.md',
      'lib/canonical-v2/input.js',
      'lib/canonical-v2/seven-family-v2-runtime-evidence.js',
      'lib/ci-workflow.yml',
      'scripts/check-allowlist-runtime.js',
      whitespacePaddedPath,
    ]);
    runGit(['-c', 'user.name=CI Test', '-c', 'user.email=ci@example.invalid', 'commit', '-qm', 'move']);
    const head = runGit(['rev-parse', 'HEAD']);

    const result = spawnSync(process.execPath, [path.resolve('scripts/ci/baseline-manifest-impact.js')], {
      cwd: directory,
      encoding: 'utf8',
      env: {
        ...process.env,
        BASE_SHA: base,
        CHANGED_FILES: '',
        GITHUB_OUTPUT: '',
        HEAD_SHA: head,
      },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /run=true POSSIBLE_INPUT_CHANGE/);
    for (const impactingFile of [
      'lib/canonical-v2/input.js',
      'lib/canonical-v2/seven-family-v2-runtime-evidence.js',
      'lib/ci-workflow.yml',
      'scripts/check-allowlist-runtime.js',
      whitespacePaddedPath,
    ]) {
      assert.match(result.stdout, new RegExp(impactingFile.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('PH-1-I codex push planning suppresses only a byte-identical mergeable PR', () => {
  const workflow = YAML.parse(fs.readFileSync('.github/workflows/ci.yml', 'utf8'));
  assert.deepEqual(workflow.on.push.branches, ['main', 'codex/**']);
  assert.equal(workflow.on.pull_request, null);

  const planner = workflow.jobs['plan-heavy-ci'];
  assert.deepEqual(planner.permissions, { contents: 'read', 'pull-requests': 'read' });
  assert.equal(planner.outputs.run_heavy, '${{ steps.plan.outputs.run_heavy }}');
  const query = planner.steps.find((step) => step.id === 'open-pr');
  assert.equal(query.if, "github.event_name == 'push' && startsWith(github.ref, 'refs/heads/codex/')");
  assert.equal(query['continue-on-error'], true);
  assert.match(query.run, /gh api/);
  assert.match(query.run, /commits\/\$\{GITHUB_SHA\}\/pulls\?per_page=100/);
  assert.equal(query.env.EXPECTED_HEAD_REF, '${{ github.ref_name }}');
  assert.equal(query.env.EXPECTED_HEAD_REPOSITORY, '${{ github.repository }}');
  assert.equal(query.env.MERGEABLE_RETRY_ATTEMPTS, '10');
  assert.equal(query.env.MERGEABLE_RETRY_INTERVAL_SECONDS, '3');
  assert.match(query.run, /\.state == "open" and \.head\.sha == \$sha and \.head\.repo\.full_name == \$repo and \.head\.ref == \$ref/);
  assert.match(query.run, /type == "array" and all/);
  assert.match(query.run, /\.head\.repo\.full_name \| type/);
  assert.match(query.run, /pulls\/\$\{pr_number\}/);
  assert.match(query.run, /has\("mergeable"\) and \.mergeable == true/);
  assert.match(query.run, /\.mergeable == null/);
  assert.match(query.run, /sleep "\$\{MERGEABLE_RETRY_INTERVAL_SECONDS\}"/);
  assert.match(query.run, /has\("merge_commit_sha"\)/);
  assert.match(query.run, /git\/commits\/\$\{GITHUB_SHA\}/);
  assert.match(query.run, /git\/commits\/\$\{merge_commit_sha\}/);
  assert.equal((query.run.match(/--arg expected/g) || []).length, 2);
  assert.equal((query.run.match(/\.sha == \$expected/g) || []).length, 2);
  assert.match(query.run, /"\$\{merge_tree_sha\}" = "\$\{head_tree_sha\}"/);

  const plan = planner.steps.find((step) => step.id === 'plan');
  assert.equal(plan.if, 'always()');
  assert.ok(plan.run.indexOf('run_heavy=true') < plan.run.indexOf('run_heavy=false'));
  assert.match(plan.run, /QUERY_OUTCOME.*success/);
  assert.match(plan.run, /PR_OWNER_READY.*true/);
  assert.match(plan.run, /PR_OWNER_READY.*false/);

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'heavy-ci-plan-'));
  try {
    const runPlan = (name, env) => {
      const output = path.join(directory, `${name}.out`);
      const result = spawnSync('bash', ['-c', plan.run], {
        encoding: 'utf8',
        env: { ...process.env, GITHUB_OUTPUT: output, ...env },
      });
      assert.equal(result.status, 0, `${name}: ${result.stdout}\n${result.stderr}`);
      return Object.fromEntries(
        fs.readFileSync(output, 'utf8').trim().split('\n').map((line) => line.split('=')),
      );
    };
    assert.equal(runPlan('exact', {
      IS_CODEX_PUSH: 'true', PR_OWNER_READY: 'true', QUERY_OUTCOME: 'success',
    }).run_heavy, 'false');
    for (const [name, env] of [
      ['no-match', { IS_CODEX_PUSH: 'true', PR_OWNER_READY: 'false', QUERY_OUTCOME: 'success' }],
      ['query-error', { IS_CODEX_PUSH: 'true', PR_OWNER_READY: 'true', QUERY_OUTCOME: 'failure' }],
      ['missing-output', { IS_CODEX_PUSH: 'true', PR_OWNER_READY: '', QUERY_OUTCOME: 'success' }],
      ['pull-request', { IS_CODEX_PUSH: 'false', PR_OWNER_READY: '', QUERY_OUTCOME: 'skipped' }],
    ]) {
      assert.equal(runPlan(name, env).run_heavy, 'true', name);
    }

    const mockBin = path.join(directory, 'bin');
    fs.mkdirSync(mockBin);
    const mockGh = path.join(mockBin, 'gh');
    fs.writeFileSync(mockGh, `#!/usr/bin/env bash
set -euo pipefail
endpoint="\${!#}"
if [[ "\${endpoint}" == *"/git/commits/\${GITHUB_SHA}" ]]; then
  [ "\${MOCK_HEAD_COMMIT}" != "__FAIL__" ] || exit 1
  printf '%s\n' "\${MOCK_HEAD_COMMIT}"
elif [[ "\${endpoint}" == *"/git/commits/"* ]]; then
  [ "\${MOCK_MERGE_COMMIT}" != "__FAIL__" ] || exit 1
  printf '%s\n' "\${MOCK_MERGE_COMMIT}"
elif [[ "\${endpoint}" == *"/commits/"* ]]; then
  printf '%s\n' "\${MOCK_ASSOCIATED}"
elif [[ "\${endpoint}" == *"/pulls/"* ]]; then
  [ "\${MOCK_DETAIL}" != "__FAIL__" ] || exit 1
  detail_count=0
  if [ -f "\${MOCK_DETAIL_COUNT_FILE}" ]; then
    read -r detail_count < "\${MOCK_DETAIL_COUNT_FILE}"
  fi
  detail_count=$((detail_count + 1))
  printf '%s\n' "\${detail_count}" > "\${MOCK_DETAIL_COUNT_FILE}"
  if [ "\${detail_count}" -le "\${MOCK_PENDING_RESPONSES}" ]; then
    printf '%s\n' "\${MOCK_PENDING_DETAIL}"
  else
    printf '%s\n' "\${MOCK_DETAIL}"
  fi
else
  exit 2
fi
`);
    fs.chmodSync(mockGh, 0o755);
    const repo = 'CodeNameHash/precedent-machine';
    const ref = 'codex/test';
    const sha = 'a'.repeat(40);
    const exactPr = {
      head: { ref, repo: { full_name: repo }, sha },
      number: 484,
      state: 'open',
    };
    const executeQuery = (name, detail, trees = {}, overrides = {}) => {
      const output = path.join(directory, `query-${name}.out`);
      const detailCountFile = path.join(directory, `query-${name}.detail-count`);
      const requestedHeadSha = overrides.sha || sha;
      const headCommit = {
        sha: requestedHeadSha,
        ...(trees.head || { tree: { sha: 'c'.repeat(40) } }),
      };
      const mergeCommit = {
        sha: detail.merge_commit_sha,
        ...(trees.merge || { tree: { sha: 'c'.repeat(40) } }),
      };
      const result = spawnSync('bash', ['-c', query.run], {
        encoding: 'utf8',
        env: {
          ...process.env,
          EXPECTED_HEAD_REF: ref,
          EXPECTED_HEAD_REPOSITORY: repo,
          GITHUB_OUTPUT: output,
          GITHUB_REPOSITORY: repo,
          GITHUB_SHA: requestedHeadSha,
          MERGEABLE_RETRY_ATTEMPTS: overrides.retryAttempts || query.env.MERGEABLE_RETRY_ATTEMPTS,
          MERGEABLE_RETRY_INTERVAL_SECONDS: overrides.retryInterval ?? '0',
          MOCK_ASSOCIATED: JSON.stringify(overrides.associated || [exactPr]),
          MOCK_DETAIL: JSON.stringify(detail),
          MOCK_DETAIL_COUNT_FILE: detailCountFile,
          MOCK_HEAD_COMMIT: JSON.stringify(headCommit),
          MOCK_MERGE_COMMIT: JSON.stringify(mergeCommit),
          MOCK_PENDING_DETAIL: JSON.stringify({ ...detail, mergeable: null }),
          MOCK_PENDING_RESPONSES: String(overrides.pendingResponses || 0),
          PATH: `${mockBin}:${process.env.PATH}`,
        },
      });
      return { detailCountFile, output, result };
    };
    const runQuery = (name, detail, trees, overrides) => {
      const { output, result } = executeQuery(name, detail, trees, overrides);
      assert.equal(result.status, 0, `${name}: ${result.stdout}\n${result.stderr}`);
      return Object.fromEntries(
        fs.readFileSync(output, 'utf8').trim().split('\n').map((line) => line.split('=')),
      ).pr_owner_ready;
    };
    const detail = { ...exactPr, merge_commit_sha: 'b'.repeat(40), mergeable: true };
    assert.equal(runQuery('ready', detail), 'true');
    assert.equal(runQuery('pending-then-ready', detail, undefined, {
      pendingResponses: 2,
    }), 'true');
    assert.equal(fs.readFileSync(
      path.join(directory, 'query-pending-then-ready.detail-count'),
      'utf8',
    ).trim(), '3');
    assert.equal(runQuery('conflicted', { ...detail, mergeable: false }), 'false');
    assert.equal(runQuery('persistent-pending', { ...detail, mergeable: null }), 'false');
    assert.equal(fs.readFileSync(
      path.join(directory, 'query-persistent-pending.detail-count'),
      'utf8',
    ).trim(), '10');
    assert.equal(runQuery('pending-wrong-head', {
      ...detail,
      head: { ...detail.head, sha: 'd'.repeat(40) },
      mergeable: null,
    }), 'false');
    assert.equal(fs.readFileSync(
      path.join(directory, 'query-pending-wrong-head.detail-count'),
      'utf8',
    ).trim(), '1');
    assert.equal(runQuery('pending-malformed-head', {
      ...detail,
      head: { ...detail.head, repo: null },
      mergeable: null,
    }), 'false');
    assert.equal(fs.readFileSync(
      path.join(directory, 'query-pending-malformed-head.detail-count'),
      'utf8',
    ).trim(), '1');
    const missingMergeable = { ...detail };
    delete missingMergeable.mergeable;
    assert.equal(runQuery('missing-mergeable', missingMergeable), 'false');
    assert.equal(runQuery('missing-merge-sha', { ...detail, merge_commit_sha: '' }), 'false');
    assert.equal(runQuery('uppercase-merge-sha', {
      ...detail,
      merge_commit_sha: 'B'.repeat(40),
    }), 'false');
    assert.equal(runQuery('tree-mismatch', detail, {
      head: { tree: { sha: 'c'.repeat(40) } },
      merge: { tree: { sha: 'd'.repeat(40) } },
    }), 'false');
    for (const [name, trees] of [
      ['missing-head-tree', { head: {}, merge: { tree: { sha: 'c'.repeat(40) } } }],
      ['missing-merge-tree', { head: { tree: { sha: 'c'.repeat(40) } }, merge: {} }],
    ]) {
      const { result } = executeQuery(name, detail, trees);
      assert.notEqual(result.status, 0, name);
      assert.equal(runPlan(name, {
        IS_CODEX_PUSH: 'true', PR_OWNER_READY: '', QUERY_OUTCOME: 'failure',
      }).run_heavy, 'true');
    }

    const uppercaseHeadSha = 'A'.repeat(40);
    const uppercaseHeadPr = {
      ...exactPr,
      head: { ...exactPr.head, sha: uppercaseHeadSha },
    };
    for (const [name, candidate, trees, overrides] of [
      [
        'uppercase-head-sha',
        { ...uppercaseHeadPr, merge_commit_sha: 'b'.repeat(40), mergeable: true },
        {},
        { sha: uppercaseHeadSha, associated: [uppercaseHeadPr] },
      ],
      [
        'uppercase-head-tree',
        detail,
        {
          head: { tree: { sha: 'C'.repeat(40) } },
          merge: { tree: { sha: 'c'.repeat(40) } },
        },
      ],
      [
        'uppercase-merge-tree',
        detail,
        {
          head: { tree: { sha: 'c'.repeat(40) } },
          merge: { tree: { sha: 'C'.repeat(40) } },
        },
      ],
      [
        'malformed-equal-trees',
        detail,
        {
          head: { tree: { sha: 'not-a-github-sha' } },
          merge: { tree: { sha: 'not-a-github-sha' } },
        },
      ],
      [
        'wrong-head-response-sha',
        detail,
        {
          head: { sha: 'd'.repeat(40), tree: { sha: 'c'.repeat(40) } },
          merge: { tree: { sha: 'c'.repeat(40) } },
        },
      ],
      [
        'wrong-merge-response-sha',
        detail,
        {
          head: { tree: { sha: 'c'.repeat(40) } },
          merge: { sha: 'd'.repeat(40), tree: { sha: 'c'.repeat(40) } },
        },
      ],
    ]) {
      const { result } = executeQuery(name, candidate, trees, overrides);
      assert.notEqual(result.status, 0, name);
      assert.equal(runPlan(name, {
        IS_CODEX_PUSH: 'true', PR_OWNER_READY: '', QUERY_OUTCOME: 'failure',
      }).run_heavy, 'true');
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }

  const heavy = workflow.jobs['test-and-build'];
  assert.deepEqual(heavy.needs, ['plan-heavy-ci', 'unit-tests', 'evidence-gates', 'production-build']);
  assert.equal(heavy.if, "${{ always() && needs.plan-heavy-ci.outputs.run_heavy != 'false' }}");
  for (const job of ['unit-tests', 'evidence-gates', 'production-build']) {
    assert.equal(workflow.jobs[job].needs, 'plan-heavy-ci', job);
    assert.equal(
      workflow.jobs[job].if,
      "${{ always() && needs.plan-heavy-ci.outputs.run_heavy != 'false' }}",
      job,
    );
  }
  assert.equal(workflow.jobs.invariants.needs, 'test-and-build');
  assert.equal(workflow.jobs.invariants.concurrency['cancel-in-progress'], false);
  for (const job of ['schema-parity', 'demo-set', 'demo-dryrun', 'phase-allowlist']) {
    assert.equal(workflow.jobs[job].if, "github.event_name == 'pull_request'", job);
  }
  assert.equal(workflow.jobs['demo-dryrun'].concurrency['cancel-in-progress'], false);
  assert.equal(
    workflow.concurrency.group,
    '${{ github.workflow }}-${{ github.event_name }}-${{ github.event.pull_request.number || github.run_id }}',
  );
  assert.equal(
    workflow.concurrency['cancel-in-progress'],
    "${{ github.event_name == 'pull_request' }}",
  );
});

test('PH-1-K CI shards every test exactly once and aggregates fail closed', () => {
  const workflow = YAML.parse(fs.readFileSync('.github/workflows/ci.yml', 'utf8'));
  const unit = workflow.jobs['unit-tests'];
  const build = workflow.jobs['production-build'];
  const aggregate = workflow.jobs['test-and-build'];

  assert.equal(unit.strategy['fail-fast'], true);
  assert.deepEqual(Object.keys(unit.strategy.matrix), ['shard']);
  assert.deepEqual(unit.strategy.matrix.shard, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(unit['timeout-minutes'], 35);
  assert.equal(build['timeout-minutes'], undefined);
  assert.equal(unit['continue-on-error'], undefined);
  assert.equal(build['continue-on-error'], undefined);
  assert.equal(unit.needs, 'plan-heavy-ci');
  assert.equal(build.needs, 'plan-heavy-ci');

  const unitStep = unit.steps.find((step) => /^Unit tests/.test(step.name));
  assert.equal(unitStep.env.SHARD, '${{ matrix.shard }}');
  assert.equal(
    (unitStep.run.match(/scripts\/ci\/run-unit-test-shard\.js/g) || []).length,
    1,
  );
  assert.match(
    unitStep.run,
    /node scripts\/ci\/run-unit-test-shard\.js --shard="\$\{SHARD\}\/8"/,
  );
  assert.doesNotMatch(unitStep.run, /--test-shard|tests\/\*\*|--test-name-pattern|--test-skip-pattern/);
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert.equal(
    packageJson.scripts.test,
    'node --max-old-space-size=8192 --test "tests/**/*.test.js" "tests/**/*.spec.js"',
  );

  assert.deepEqual(
    aggregate.needs,
    ['plan-heavy-ci', 'unit-tests', 'evidence-gates', 'production-build'],
  );
  assert.equal(
    aggregate.if,
    "${{ always() && needs.plan-heavy-ci.outputs.run_heavy != 'false' }}",
  );
  assert.equal(aggregate.name, 'test-and-build');
  const aggregateStep = aggregate.steps.find((step) => (
    step.name === 'Require every unit-test shard and the production build'
  ));
  assert.equal(aggregateStep.env.PLAN_RESULT, '${{ needs.plan-heavy-ci.result }}');
  assert.equal(aggregateStep.env.UNIT_TESTS_RESULT, '${{ needs.unit-tests.result }}');
  assert.equal(aggregateStep.env.EVIDENCE_GATES_RESULT, '${{ needs.evidence-gates.result }}');
  assert.equal(
    aggregateStep.env.PRODUCTION_BUILD_RESULT,
    '${{ needs.production-build.result }}',
  );

  const gates = workflow.jobs['evidence-gates'];
  assert.equal(gates.needs, 'plan-heavy-ci');
  assert.equal(gates['timeout-minutes'], 35);
  assert.equal(gates.strategy['fail-fast'], true);
  assert.deepEqual(
    gates.strategy.matrix.include.map((entry) => entry.gate),
    ['near-miss', 'replay-baseline'],
  );
  const packageScripts = JSON.parse(fs.readFileSync('package.json', 'utf8')).scripts;
  for (const entry of gates.strategy.matrix.include) {
    assert.match(packageScripts[`gate:${entry.gate}`], /--check/);
    assert.match(packageScripts[`gate:${entry.gate}`], new RegExp(entry.entry.replace(/[.]/g, '\\.')));
  }
  const gateStep = gates.steps.find((step) => step.id === 'evidence-gate');
  assert.equal(gateStep.run, 'npm run gate:${{ matrix.gate }}');
  assert.equal(gateStep.if, "steps.gate-plan.outputs.run_gate != 'false'");

  const runAggregate = (planResult, unitResult, buildResult, gatesResult = 'success') => spawnSync(
    'bash',
    ['-c', aggregateStep.run],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        PLAN_RESULT: planResult,
        UNIT_TESTS_RESULT: unitResult,
        EVIDENCE_GATES_RESULT: gatesResult,
        PRODUCTION_BUILD_RESULT: buildResult,
      },
    },
  );
  assert.equal(runAggregate('success', 'success', 'success').status, 0);
  for (const result of ['failure', 'skipped', 'cancelled', '']) {
    assert.notEqual(
      runAggregate(result, 'success', 'success').status,
      0,
      `plan ${result || 'missing'}`,
    );
    assert.notEqual(
      runAggregate('success', result, 'success').status,
      0,
      `unit ${result || 'missing'}`,
    );
    assert.notEqual(
      runAggregate('success', 'success', result).status,
      0,
      `build ${result || 'missing'}`,
    );
    assert.notEqual(
      runAggregate('success', 'success', 'success', result).status,
      0,
      `gates ${result || 'missing'}`,
    );
  }

  assert.equal(
    workflow.concurrency.group,
    '${{ github.workflow }}-${{ github.event_name }}-${{ github.event.pull_request.number || github.run_id }}',
  );
  assert.equal(
    workflow.concurrency['cancel-in-progress'],
    "${{ github.event_name == 'pull_request' }}",
  );
});

test('PH-1-K1 Work3 CI parts bind the sealed test and all 36 exact titles', () => {
  assert.equal(SEALED_WORK3_BYTE_LENGTH, 886974);
  assert.equal(
    SEALED_WORK3_SHA256,
    'eef969ddc83e776c4f4a728ef019080859abb96e12a00b27942fd6effa3d3548',
  );
  assert.equal(
    SEALED_WORK3_RECEIPT,
    'evidence/canonical-v2/stage-2y-structure-migration/receipts/stage-2y-structure-m7-v2-repair-work3-profile.json',
  );
  const seal = verifySealedWork3();
  assert.equal(seal.byteLength, SEALED_WORK3_BYTE_LENGTH);
  assert.equal(seal.sha256, SEALED_WORK3_SHA256);
  assert.equal(seal.receiptBinding.path, SEALED_WORK3_TEST);
  assert.equal(seal.receiptBinding.byte_length, SEALED_WORK3_BYTE_LENGTH);
  assert.equal(seal.receiptBinding.sha256, SEALED_WORK3_SHA256);

  const source = fs.readFileSync(SEALED_WORK3_TEST, 'utf8');
  const sourceTitles = [...source.matchAll(/^test\(\s*(['"])(.*?)\1/gm)]
    .map((match) => match[2]);
  assert.equal(sourceTitles.length, 36);
  assert.deepEqual(WORK3_TITLES, sourceTitles);
  assert.deepEqual(WORK3_PART_TITLE_NUMBERS, [
    [8, 35],
    [12, 16, 23],
    [1, 2, 5, 6, 17, 21, 36],
    [4, 14, 20, 27],
    [3, 11, 15, 24],
    [22, 25, 26, 31, 33],
    [7, 9, 18, 29, 30, 34],
    [10, 13, 19, 28, 32],
  ]);
  const partitionTitles = WORK3_PARTS.flat();
  assert.equal(partitionTitles.length, 36);
  assert.equal(new Set(partitionTitles).size, 36);
  assert.deepEqual([...partitionTitles].sort(), [...sourceTitles].sort());

  for (let shard = 1; shard <= TOTAL_SHARDS; shard += 1) {
    assert.equal(parseShard(`${shard}/${TOTAL_SHARDS}`), shard);
    assert.equal(parseArguments([`--shard=${shard}/${TOTAL_SHARDS}`]), shard);
    const ownPattern = new RegExp(buildWork3Pattern(WORK3_PARTS[shard - 1]));
    for (let part = 1; part <= TOTAL_SHARDS; part += 1) {
      for (const title of WORK3_PARTS[part - 1]) {
        assert.equal(ownPattern.test(title), part === shard, `${shard}/${TOTAL_SHARDS}: ${title}`);
      }
    }
  }
  for (const invalid of ['0/8', '9/8', '1/7', '01/8', '1/8 ', '']) {
    assert.throws(() => parseShard(invalid), /1\/8 through 8\/8/);
  }
  assert.throws(() => parseArguments([]), /usage/);
  assert.throws(() => parseArguments(['--shard=1/8', '--extra']), /usage/);
});

test('PH-1-K2 CI assigns every ordinary test once with one sealed exception', () => {
  const files = discoverTestFiles();
  const assigned = [];
  for (let shard = 1; shard <= TOTAL_SHARDS; shard += 1) {
    const plan = buildShardPlan(shard);
    assert.deepEqual(plan.ordinaryFiles, assignOrdinaryFiles(files, shard));
    assert.deepEqual(plan.work3Titles, WORK3_PARTS[shard - 1]);
    const args = buildLaneArguments(plan);
    assert.deepEqual(args.ordinary.slice(3), plan.ordinaryFiles);
    assert.equal(args.ordinary.includes(SEALED_WORK3_TEST), false);
    assert.equal(args.ordinary.some((argument) => argument.startsWith('--test-shard')), false);
    assert.equal(args.work3.at(-1), SEALED_WORK3_TEST);
    assert.equal(args.work3.filter((argument) => argument === SEALED_WORK3_TEST).length, 1);
    assert.equal(
      args.work3.filter((argument) => argument.startsWith('--test-name-pattern=')).length,
      1,
    );
    assigned.push(...plan.ordinaryFiles);
  }

  const expectedOrdinary = files.filter((file) => file !== SEALED_WORK3_TEST && !HEAVY_FILES.has(file));
  assert.deepEqual([...assigned].sort(), [...expectedOrdinary].sort());
  assert.equal(assigned.length, new Set(assigned).size);
  assert.deepEqual(
    files.filter((file) => !assigned.includes(file)).sort(),
    [SEALED_WORK3_TEST, ...HEAVY_FILES].sort(),
  );

  // Every heavy file's top-level titles run exactly once across its shards,
  // and no other shard carries that file.
  assert.ok(HEAVY_FILES.has(REGISTRATION_TEST));
  const registrationIndex = files.indexOf(REGISTRATION_TEST);
  assert.notEqual(registrationIndex, -1);
  assert.equal(assignedOrdinaryShard(REGISTRATION_TEST, registrationIndex), null);
  for (const entry of HEAVY_FILE_PARTITIONS) {
    const titles = parseTopLevelTitles(fs.readFileSync(entry.file, 'utf8'), entry.file);
    const assignedTitles = [];
    for (let shard = 1; shard <= TOTAL_SHARDS; shard += 1) {
      const plan = buildShardPlan(shard);
      if (entry.shards.includes(shard)) {
        assert.equal(plan.heavyFile, entry.file);
        assert.ok(plan.heavyTitles.length > 0, `${entry.file} shard ${shard}`);
        const ownPattern = new RegExp(plan.heavyPattern);
        for (const title of titles) {
          assert.equal(ownPattern.test(title), plan.heavyTitles.includes(title), `${entry.file} ${shard}: ${title}`);
        }
        assignedTitles.push(...plan.heavyTitles);
      } else {
        assert.notEqual(plan.heavyFile, entry.file);
      }
    }
    assert.deepEqual([...assignedTitles].sort(), [...titles].sort(), entry.file);
    assert.equal(assignedTitles.length, new Set(assignedTitles).size, entry.file);
  }
  for (const [index, file] of files.entries()) {
    if (file === SEALED_WORK3_TEST || HEAVY_FILES.has(file)) continue;
    assert.equal(assignedOrdinaryShard(file, index), nativeShardForIndex(index), file);
  }
});

test('PH-1-K3 CI child failures and Work3 zero matches fail closed', () => {
  const titles = WORK3_PARTS[0];
  const validTap = titles.map((title, index) => (
    `# Subtest: ${title}\nok ${index + 1} - ${title}\n`
  )).join('');
  assert.equal(validateWork3Tap(validTap, titles), true);
  assert.throws(
    () => validateWork3Tap('TAP version 13\n1..0\n', titles),
    /matched zero tests/,
  );
  assert.throws(
    () => validateWork3Tap('# Subtest: tests/work3.test.js\nok 1 - tests/work3.test.js\n', titles),
    /matched zero tests/,
  );
  assert.throws(
    () => validateWork3Tap(validTap.replace(`ok 1 - ${titles[0]}`, `not ok 1 - ${titles[0]}`), titles),
    /exact selected titles/,
  );
  assert.throws(
    () => validateWork3Tap(`${validTap}# Subtest: ${titles[0]}\nok 3 - ${titles[0]}\n`, titles),
    /exact selected titles/,
  );
  assert.throws(
    () => validateWork3Tap(validTap.replace(`ok 1 - ${titles[0]}`, `ok 1 - ${titles[0]} # SKIP`), titles),
    /exact selected titles/,
  );

  assert.doesNotThrow(() => assertSuccessfulLane({
    code: 0, error: null, label: 'ordinary', signal: null,
  }));
  assert.throws(
    () => assertSuccessfulLane({ code: 1, error: null, label: 'ordinary', signal: null }),
    /exited 1/,
  );
  assert.throws(
    () => assertSuccessfulLane({ code: null, error: null, label: 'Work3', signal: 'SIGTERM' }),
    /signal SIGTERM/,
  );
  assert.throws(
    () => assertSuccessfulLane({ code: null, error: new Error('spawn'), label: 'Work3', signal: null }),
    /could not start/,
  );
});

test('PH-1-J phase allowlist passes changed files through a bounded file', () => {
  const workflow = YAML.parse(fs.readFileSync('.github/workflows/ci.yml', 'utf8'));
  const phase = workflow.jobs['phase-allowlist'];
  const collect = phase.steps.find((step) => step.name === 'Collect changed files');
  assert.match(collect.run, /changed_files_file="\$\{RUNNER_TEMP\}\/phase-allowlist-changed-files\.txt"/);
  assert.match(collect.run, /git diff --no-renames --name-only/);
  assert.doesNotMatch(collect.run, /gh api/);
  assert.match(collect.run, /CHANGED_FILES_FILE=\$\{changed_files_file\}/);
  assert.doesNotMatch(collect.run, /CHANGED_FILES<</);
  assert.match(collect.run, /changed_files_bytes=.*wc -c/);
  assert.match(collect.run, /changed_files_bytes.*-gt 8388608/);
  assert.ok(
    collect.run.indexOf('changed_files_bytes=') < collect.run.indexOf('CHANGED_FILES_FILE='),
    'the byte bound must run before the file path is exported',
  );

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'phase-allowlist-collect-'));
  const runGit = (args) => execFileSync('git', args, {
    cwd: directory,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
  try {
    runGit(['init', '-q']);
    fs.mkdirSync(path.join(directory, 'blocked'), { recursive: true });
    fs.writeFileSync(path.join(directory, 'blocked/old.js'), 'old\n');
    runGit(['add', '--', 'blocked/old.js']);
    runGit(['-c', 'user.name=CI Test', '-c', 'user.email=ci@example.invalid', 'commit', '-qm', 'base']);
    const base = runGit(['rev-parse', 'HEAD']);

    fs.mkdirSync(path.join(directory, 'allowed'), { recursive: true });
    fs.renameSync(path.join(directory, 'blocked/old.js'), path.join(directory, 'allowed/new.js'));
    fs.mkdirSync(path.join(directory, 'bulk'), { recursive: true });
    for (let index = 0; index < 3_000; index += 1) {
      fs.writeFileSync(path.join(directory, `bulk/file-${String(index).padStart(4, '0')}.js`), 'x\n');
    }
    runGit(['add', '--', 'blocked/old.js', 'allowed/new.js', 'bulk']);
    runGit(['-c', 'user.name=CI Test', '-c', 'user.email=ci@example.invalid', 'commit', '-qm', 'head']);
    const head = runGit(['rev-parse', 'HEAD']);
    const githubEnv = path.join(directory, 'github.env');
    const result = spawnSync('bash', ['-c', collect.run], {
      cwd: directory,
      encoding: 'utf8',
      env: {
        ...process.env,
        BASE_SHA: base,
        GITHUB_ENV: githubEnv,
        HEAD_SHA: head,
        RUNNER_TEMP: directory,
      },
    });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const changedFilesFile = fs.readFileSync(githubEnv, 'utf8').trim().split('=')[1];
    const changed = fs.readFileSync(changedFilesFile, 'utf8').trim().split('\n');
    assert.equal(changed.length, 3_002);
    assert.ok(changed.includes('blocked/old.js'));
    assert.ok(changed.includes('allowed/new.js'));

    const missingHistory = spawnSync('bash', ['-c', collect.run], {
      cwd: directory,
      encoding: 'utf8',
      env: {
        ...process.env,
        BASE_SHA: '0'.repeat(40),
        GITHUB_ENV: path.join(directory, 'missing-history.env'),
        HEAD_SHA: head,
        RUNNER_TEMP: directory,
      },
    });
    assert.equal(missingHistory.status, 1);
    assert.match(missingHistory.stdout, /Full local base\/head history is unavailable/);

    const oversizedDiff = path.join(directory, 'oversized-diff.txt');
    fs.writeFileSync(oversizedDiff, Buffer.alloc((8 * 1024 * 1024) + 1, 0x78));
    const mockBin = path.join(directory, 'mock-bin');
    fs.mkdirSync(mockBin);
    const mockGit = path.join(mockBin, 'git');
    fs.writeFileSync(mockGit, `#!/usr/bin/env bash
set -euo pipefail
case "$1" in
  cat-file) exit 0 ;;
  merge-base) printf '%s\n' "${'1'.repeat(40)}" ;;
  diff) command cat "\${MOCK_DIFF_FILE}" ;;
  *) exit 2 ;;
esac
`);
    fs.chmodSync(mockGit, 0o755);
    const oversizedEnv = path.join(directory, 'oversized.env');
    const oversized = spawnSync('bash', ['-c', collect.run], {
      cwd: directory,
      encoding: 'utf8',
      env: {
        ...process.env,
        BASE_SHA: base,
        GITHUB_ENV: oversizedEnv,
        HEAD_SHA: head,
        MOCK_DIFF_FILE: oversizedDiff,
        PATH: `${mockBin}:${process.env.PATH}`,
        RUNNER_TEMP: directory,
      },
    });
    assert.equal(oversized.status, 1);
    assert.match(oversized.stdout, /Changed-file set exceeds 8388608 bytes/);
    assert.equal(fs.existsSync(oversizedEnv), false);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }

  const check = phase.steps.find((step) => step.name === 'Diff-vs-allowlist');
  assert.match(check.run, /"\$\{CHANGED_FILES_FILE\}"/);
  assert.doesNotMatch(check.run, /\$CHANGED_FILES\b/);

  const script = fs.readFileSync('scripts/ci/check-allowlist.js', 'utf8');
  assert.match(script, /env\.CHANGED_FILES_FILE/);
  assert.match(script, /MAX_CHANGED_FILES_BYTES/);
});

test('dedupe skeleton merges cross-origin rows and flags true duplicates', () => {
  const result = dedupeRegistry({
    generated_from: [],
    fields: [
      { key: 'mainConcept', origin: 'schema-features', applies_to: 'CONSID' },
      { key: 'mainConcept', origin: 'rubric-features', applies_to: 'ANTI' },
      { key: 'carveouts', origin: 'appendix-a-priority' },
      { key: 'carveOuts', origin: 'appendix-a-priority' },
    ],
  });
  const mainConcept = result.registry.fields.find((row) => row.key === 'mainConcept');
  assert.equal(mainConcept.merged_from.length, 1);
  assert.deepEqual(mainConcept.also_matches_provision_codes, ['ANTI']);
  assert.equal(result.registry.fields.filter((row) => row.review_flag === 'REQUIRES_REVIEWER_DECISION').length, 2);
});
