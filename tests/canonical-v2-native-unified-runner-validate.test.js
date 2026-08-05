const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  ABSENCE_PROOF_SCHEMA,
  MANIFEST_SCHEMA,
  NativeUnifiedRunValidationError,
  buildExecutionPlanSummary,
  validateUnifiedRunManifest,
  validateUnifiedRunManifestDiagnostic,
} = require('../lib/canonical-v2/native-producer/unified-runner-validate');
const { createDiagnosticFixture } = require('./helpers/native-unified-runner-diagnostic-fixture');

const ROOT = path.resolve(__dirname, '..');
const fixture = createDiagnosticFixture(ROOT);

function diagnosticErrorCode(callback) {
  try { callback(); } catch (error) { return error.code; }
  return null;
}

function blockedManifest() {
  return {
    schema_version: MANIFEST_SCHEMA,
    sources: [{
      source_id: 'caller-declared-source', disposition: 'BLOCKED_SOURCE_PIN',
      source_locator: 'caller-declared source locator', blocking_code: 'SOURCE_NOT_ISSUED',
    }],
    work_items: [{
      work_item_id: 'caller-declared-item', source_id: 'caller-declared-source',
      family_id: 'CAPITALISATION', disposition: 'BLOCKED_SOURCE_PIN', blocking_code: 'SOURCE_NOT_ISSUED',
    }],
  };
}

test('a caller manifest can produce only an authority-NONE diagnostic', () => {
  const result = validateUnifiedRunManifestDiagnostic({ manifest: blockedManifest(), root_dir: ROOT });
  assert.equal(result.receipt.authority, 'NONE');
  assert.equal(result.diagnostic_manifest.authority, 'NONE');
  assert.equal(result.diagnostic_manifest.status, 'BLOCKED_PROPOSAL_ONLY_NOT_EXECUTION_AUTHORITY');
  assert.equal(Object.hasOwn(result, 'semantic_manifest'), false);
  assert.equal(Object.hasOwn(result, 'execution_plan'), false);
});

test('a caller manifest cannot receive executable validation', () => {
  assert.throws(
    () => validateUnifiedRunManifest({ manifest: blockedManifest(), root_dir: ROOT }),
    (error) => error instanceof NativeUnifiedRunValidationError
      && error.code === 'TRUSTED_UNIFIED_RUN_VERIFIER_UNAVAILABLE',
  );
});

test('diagnostic identity is stable across declaration order', () => {
  const first = validateUnifiedRunManifestDiagnostic({
    manifest: fixture.manifest({ workItems: [
      fixture.extract('b-consideration', 'CONSIDERATION'),
      fixture.extract('a-capitalisation', 'CAPITALISATION'),
    ] }),
    root_dir: ROOT,
  });
  const second = validateUnifiedRunManifestDiagnostic({
    manifest: fixture.manifest({ workItems: [
      fixture.extract('a-capitalisation', 'CAPITALISATION'),
      fixture.extract('b-consideration', 'CONSIDERATION'),
    ] }),
    root_dir: ROOT,
  });
  assert.equal(first.diagnostic_manifest.diagnostic_manifest_id, second.diagnostic_manifest.diagnostic_manifest_id);
  assert.equal(first.receipt.diagnostic_receipt_id, second.receipt.diagnostic_receipt_id);
});

test('execution-plan summary is a pure zero-retry calculation', () => {
  const plan = buildExecutionPlanSummary([
    { source_id: 'topbuild-original', family_id: 'CAPITALISATION', disposition: 'EXTRACT', section_id: 'one' },
    { source_id: 'topbuild-original', family_id: 'CONSIDERATION', disposition: 'EXTRACT', section_id: 'one' },
    { source_id: 'topbuild-original', family_id: 'FINANCING_COVENANTS', disposition: 'NOT_PRESENT', section_id: null },
    { source_id: 'metsera-original', family_id: 'CONSIDERATION', disposition: 'BLOCKED_SOURCE_PIN', section_id: null },
  ]);
  assert.deepEqual(plan, {
    schema_version: 'NATIVE_UNIFIED_RUN_EXECUTION_PLAN/V1',
    extract_work_item_count: 2,
    not_present_work_item_count: 1,
    blocked_source_pin_work_item_count: 1,
    distinct_source_count: 2,
    distinct_family_count: 3,
    distinct_extract_section_count: 1,
    zero_retry_provider_call_count: 2,
    execution_plan_id: plan.execution_plan_id,
  });
});

test('duplicate work items, raw drift and section drift fail during diagnostic validation', () => {
  const repeated = fixture.extract('same', 'CAPITALISATION');
  assert.equal(diagnosticErrorCode(() => validateUnifiedRunManifestDiagnostic({
    manifest: fixture.manifest({ workItems: [repeated, repeated] }), root_dir: ROOT,
  })), 'DUPLICATE_WORK_ITEM');
  assert.equal(diagnosticErrorCode(() => validateUnifiedRunManifestDiagnostic({
    manifest: fixture.manifest({ sources: [fixture.localSource({ raw_sha256: '0'.repeat(64) })] }), root_dir: ROOT,
  })), 'RAW_PIN_MISMATCH');
  const drifted = fixture.extract('drifted-section', 'CAPITALISATION');
  drifted.section_pin = { ...drifted.section_pin, section_id: '1'.repeat(64) };
  assert.equal(diagnosticErrorCode(() => validateUnifiedRunManifestDiagnostic({
    manifest: fixture.manifest({ workItems: [drifted] }), root_dir: ROOT,
  })), 'SECTION_PIN_MISMATCH');
});

test('NOT_PRESENT requires zero-match proof and a blocked source cannot produce absence', () => {
  const absent = {
    work_item_id: 'absent-financing', source_id: 'topbuild-original', family_id: 'FINANCING_COVENANTS', disposition: 'NOT_PRESENT',
    absence_proof: {
      schema_version: ABSENCE_PROOF_SCHEMA, scanned_nodes: [fixture.pin('2.1')],
      heading_terms: ['unfindable-heading-token'], lexical_terms: ['unfindable-lexical-token'],
      heading_match_count: 0, lexical_match_count: 0,
    },
  };
  assert.equal(validateUnifiedRunManifestDiagnostic({
    manifest: fixture.manifest({ workItems: [absent] }), root_dir: ROOT,
  }).diagnostic_manifest.work_item_diagnostics[0].diagnostic_state, 'NO_PRESENCE_CONCLUSION_PENDING_TRUSTED_ABSENCE_EVIDENCE');
  absent.absence_proof.lexical_terms = [];
  assert.equal(diagnosticErrorCode(() => validateUnifiedRunManifestDiagnostic({
    manifest: fixture.manifest({ workItems: [absent] }), root_dir: ROOT,
  })), 'INVALID_ABSENCE_PROOF');
  absent.absence_proof.lexical_terms = ['unfindable-lexical-token'];
  const blocked = {
    source_id: 'metsera-original', disposition: 'BLOCKED_SOURCE_PIN',
    source_locator: 'SEC Exhibit 2.1, bytes not pinned', blocking_code: 'EXHIBIT_BYTES_NOT_PINNED',
  };
  assert.equal(diagnosticErrorCode(() => validateUnifiedRunManifestDiagnostic({
    manifest: fixture.manifest({ sources: [blocked], workItems: [{ ...absent, source_id: blocked.source_id }]}), root_dir: ROOT,
  })), 'BLOCKED_SOURCE_PIN');
});

test('the validate CLI emits the diagnostic form only', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'native-unified-runner-'));
  try {
    const manifestPath = path.join(directory, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(blockedManifest()));
    const output = execFileSync(process.execPath, [
      'scripts/canonical-v2-native-unified-runner.mjs', '--mode=validate', '--manifest', manifestPath,
    ], { cwd: ROOT, encoding: 'utf8' });
    const result = JSON.parse(output);
    assert.equal(result.receipt.authority, 'NONE');
    assert.equal(result.diagnostic_manifest.authority, 'NONE');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('diagnostic manifests cannot start either execute mode, write checkpoints or load provider code', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'native-unified-runner-fence-'));
  try {
    const manifestPath = path.join(directory, 'manifest.json');
    const artifactRoot = path.join(directory, 'artifact-root');
    fs.mkdirSync(artifactRoot);
    fs.writeFileSync(manifestPath, JSON.stringify(blockedManifest()));
    const attempts = [
      [
        '--mode=execute', '--manifest', manifestPath, '--controls', 'never-read-controls.json',
        '--artifact-root', artifactRoot, '--out', 'execution.json', '--checkpoint-dir', 'checkpoints',
      ],
      [
        '--mode=execute-iteration-2', '--manifest', manifestPath, '--controls', 'never-read-controls.json',
        '--artifact-root', artifactRoot, '--out', 'iteration-2/execution-result.json',
        '--checkpoint-dir', 'iteration-2/checkpoints', '--iteration-2-plan', 'never-read-plan.json',
      ],
    ];
    for (const args of attempts) {
      assert.throws(() => execFileSync(process.execPath, [
        'scripts/canonical-v2-native-unified-runner.mjs', ...args,
      ], { cwd: ROOT, encoding: 'utf8' }), /Caller manifests cannot produce an executable unified-run validation result/);
      assert.deepEqual(fs.readdirSync(artifactRoot), []);
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('the real validation module imports neither provider nor network transport', () => {
  const source = fs.readFileSync(path.resolve(ROOT, 'lib/canonical-v2/native-producer/unified-runner-validate.js'), 'utf8');
  assert.doesNotMatch(source, /anthropic-provider|provider-interface|node:https|node:http|\bfetch\s*\(/);
});
