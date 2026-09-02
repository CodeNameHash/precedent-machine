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
  'scripts/ci/baseline-manifest-impact.js',
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

test('PH-1-G CI runs the baseline gate only when the detector reports impact', () => {
  const ci = fs.readFileSync('.github/workflows/ci.yml', 'utf8');
  assert.match(ci, /id: baseline-impact/);
  assert.match(ci, /run: node scripts\/ci\/baseline-manifest-impact\.js/);
  assert.match(ci, /if: steps\.baseline-impact\.outputs\.run == 'true'/);
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
  assert.equal(heavy.needs, 'plan-heavy-ci');
  assert.equal(heavy.if, "${{ always() && needs.plan-heavy-ci.outputs.run_heavy != 'false' }}");
  assert.equal(workflow.jobs.invariants.needs, 'test-and-build');
  for (const job of ['schema-parity', 'demo-set', 'demo-dryrun', 'phase-allowlist']) {
    assert.equal(workflow.jobs[job].if, "github.event_name == 'pull_request'", job);
  }
  assert.equal(workflow.jobs['demo-dryrun'].concurrency['cancel-in-progress'], false);
  assert.equal(workflow.concurrency, undefined);
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
