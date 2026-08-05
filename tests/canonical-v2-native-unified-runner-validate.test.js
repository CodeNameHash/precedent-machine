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
  validatePromptBudgetSplitPreflightFence,
  validateUnifiedRunManifest,
  validateUnifiedRunManifestDiagnostic,
} = require('../lib/canonical-v2/native-producer/unified-runner-validate');
const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const {
  buildPromptBudgetSplitPreflight,
} = require('../lib/canonical-v2/native-producer/prompt-budget-split-preflight');
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

function splitNode({ canonicalText, sectionId, reference, parentSectionId = null, start = 0, end = Buffer.byteLength(canonicalText, 'utf8') }) {
  return Object.freeze({
    section_id: sha256Hex(sectionId),
    reference,
    parent_section_id: parentSectionId,
    kind: parentSectionId ? 'SUBSECTION' : 'SECTION',
    depth: parentSectionId ? 2 : 1,
    heading: 'Material Adverse Effect',
    article_context: 'DEFINITIONS',
    start,
    end,
    text_sha256: sha256Hex(Buffer.from(canonicalText).subarray(start, end)),
  });
}

function extractManifest({ workItemId = 'extract-mae', sourceId = 'source-one', familyId = 'MAE_DEFINITION', node }) {
  return {
    schema_version: MANIFEST_SCHEMA,
    sources: [{
      source_id: sourceId,
      disposition: 'BLOCKED_SOURCE_PIN',
      source_locator: 'content-addressed split-preflight fixture',
      blocking_code: 'SOURCE_NOT_ISSUED',
    }],
    work_items: [{
      work_item_id: workItemId,
      source_id: sourceId,
      family_id: familyId,
      disposition: 'EXTRACT',
      section_pin: {
        section_reference: node.reference,
        section_id: node.section_id,
        section_kind: node.kind,
        section_text_sha256: node.text_sha256,
      },
    }],
  };
}

function underCeilingPreflight({ workItemId = 'extract-mae', sourceId = 'source-one' } = {}) {
  const canonicalText = 'Material Adverse Effect means any event materially adverse to the Company.';
  const documentHash = sha256Hex(canonicalText);
  const node = splitNode({ canonicalText, sectionId: 'mae-section', reference: '1.1' });
  const tree = Object.freeze({
    document_hash: documentHash,
    source_byte_length: Buffer.byteLength(canonicalText, 'utf8'),
    source_sha256: sha256Hex(canonicalText),
    nodes: Object.freeze([node]),
  });
  const preflight = buildPromptBudgetSplitPreflight({
    tree,
    canonical_text: canonicalText,
    document_hash: documentHash,
    source_id: sourceId,
    origin_work_item_id: workItemId,
    family_id: 'MAE_DEFINITION',
    nodes: [node],
    prompt_budget_policy: { prompt_byte_ceiling: 65536 },
  });
  assert.equal(preflight.status, 'PASS');
  return { node, preflight };
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

test('prompt-budget preflights bind every EXTRACT origin, source, family and exact parent section', () => {
  const { node, preflight } = underCeilingPreflight();
  const manifest = extractManifest({ node });
  assert.deepEqual(validatePromptBudgetSplitPreflightFence({
    manifest,
    prompt_budget_split_preflights: [preflight],
  }), {
    status: 'PASS',
    extract_work_item_ids: ['extract-mae'],
    preflight_ids: [preflight.preflight_id],
  });

  assert.throws(() => validatePromptBudgetSplitPreflightFence({
    manifest,
    prompt_budget_split_preflights: [],
  }), (error) => error.code === 'PROMPT_BUDGET_SPLIT_PREFLIGHT_COVERAGE_MISMATCH');

  assert.throws(() => validatePromptBudgetSplitPreflightFence({
    manifest,
    prompt_budget_split_preflights: [preflight, preflight],
  }), (error) => error.code === 'DUPLICATE_PROMPT_BUDGET_SPLIT_PREFLIGHT');

  const otherSource = underCeilingPreflight({ sourceId: 'source-two' }).preflight;
  assert.throws(() => validatePromptBudgetSplitPreflightFence({
    manifest,
    prompt_budget_split_preflights: [otherSource],
  }), (error) => error.code === 'PROMPT_BUDGET_SPLIT_PREFLIGHT_BINDING_MISMATCH');

  assert.throws(() => validatePromptBudgetSplitPreflightFence({
    manifest: extractManifest({ node, familyId: 'KEY_DEFINED_TERMS' }),
    prompt_budget_split_preflights: [preflight],
  }), (error) => error.code === 'PROMPT_BUDGET_SPLIT_PREFLIGHT_BINDING_MISMATCH');

  assert.throws(() => validatePromptBudgetSplitPreflightFence({
    manifest,
    prompt_budget_split_preflights: [{ ...preflight, prompt_byte_ceiling: 1 }],
  }), (error) => error.code === 'INVALID_PROMPT_BUDGET_SPLIT_PREFLIGHT'
    && error.details.cause_code === 'SPLIT_PREFLIGHT_IDENTITY_INVALID');
});

test('split children cannot authorise execution of their oversized parent work item', () => {
  const firstClause = 'Material Adverse Effect means any adverse event. ';
  const filler = 'x'.repeat(70000);
  const secondClause = 'Material Adverse Effect excludes industry-wide changes.';
  const canonicalText = `${firstClause}${filler}${secondClause}`;
  const secondStart = Buffer.byteLength(`${firstClause}${filler}`, 'utf8');
  const parent = splitNode({ canonicalText, sectionId: 'mae-parent', reference: '1.1' });
  const first = splitNode({
    canonicalText,
    sectionId: 'mae-child-a',
    reference: '1.1(a)',
    parentSectionId: parent.section_id,
    end: Buffer.byteLength(firstClause, 'utf8'),
  });
  const second = splitNode({
    canonicalText,
    sectionId: 'mae-child-b',
    reference: '1.1(b)',
    parentSectionId: parent.section_id,
    start: secondStart,
  });
  const documentHash = sha256Hex(canonicalText);
  const tree = Object.freeze({
    document_hash: documentHash,
    source_byte_length: Buffer.byteLength(canonicalText, 'utf8'),
    source_sha256: sha256Hex(canonicalText),
    nodes: Object.freeze([parent, first, second]),
  });
  const preflight = buildPromptBudgetSplitPreflight({
    tree,
    canonical_text: canonicalText,
    document_hash: documentHash,
    source_id: 'source-one',
    origin_work_item_id: 'extract-mae-parent',
    family_id: 'MAE_DEFINITION',
    nodes: [parent],
    prompt_budget_policy: { prompt_byte_ceiling: 65536 },
  });
  assert.equal(preflight.status, 'PASS');
  assert.ok(preflight.work_items.length > 0);
  assert.ok(preflight.work_items.every((item) => item.section_id !== parent.section_id));
  assert.throws(() => validatePromptBudgetSplitPreflightFence({
    manifest: extractManifest({ workItemId: 'extract-mae-parent', node: parent }),
    prompt_budget_split_preflights: [preflight],
  }), (error) => error.code === 'PROMPT_BUDGET_PARENT_WORK_ITEM_NOT_EXECUTABLE');
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
