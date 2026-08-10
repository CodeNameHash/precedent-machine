const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { canonicalJson, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const EXACT_BLOCKED_ROW_IDS = require('./fixtures/canonical-v2/stage-2y-phase-b-v2-row-ids.json');

const ROOT = path.resolve(__dirname, '..');
const V1_MANIFEST_ID = 'd8b971b70635b9efcd3a434de0859320dfd83d0e97540a2dc103dae2ae4e923c';
const V1_MANIFEST_DIGEST = '1a4d4948761ea8353a1211dfa4bb8b1cd02c3aac5f5f8c1b284fa3751f56d504';
const BASELINE_RECEIPT = {
  identity_basis: 'EXPLICIT_CLI_ARGUMENTS', command: 'codex', model: 'gpt-5.6-terra',
  reasoning_effort: 'medium',
  invocation_arguments: [
    'exec', '--json', '-s', 'read-only', '--color', 'never', '-m', 'gpt-5.6-terra',
    '-c', 'model_reasoning_effort="medium"', '--ephemeral', '--skip-git-repo-check', '-',
  ],
};
const CROSS_RECEIPT = {
  identity_basis: 'EXPLICIT_CLI_ARGUMENTS', command: 'claude', model: 'claude-opus-4-1',
  reasoning_effort: null,
  invocation_arguments: [
    '-p', '--output-format', 'json', '--model', 'claude-opus-4-1', '--append-system-prompt',
    'Output only the requested JSON object. Do not use tools. Use only the evidence in this prompt.',
  ],
};

async function load() {
  return import(path.join(ROOT, 'scripts/stage-2y-phase-b-v2-model-experiment.mjs'));
}

async function loadSol() {
  return import(path.join(ROOT, 'scripts/stage-2y-phase-b-sol-probe.mjs'));
}

function hash(value) {
  return sha256Hex(Buffer.from(typeof value === 'string' ? value : canonicalJson(value), 'utf8'));
}

function blockedRow(index, rowId = EXACT_BLOCKED_ROW_IDS[index]) {
  return {
    row_id: rowId,
    cohort: 'DETERMINISTIC_BLOCKED',
    current_state: index % 2 ? 'REVIEW' : 'OPEN_WORLD',
    deal: `deal-${index % 4}`,
    family: `FAMILY_${index % 6}`,
    section_reference: `${index + 1}.1`,
    reason: 'TEST_BLOCK',
    source_text: `Buyer Parties shall act for row ${index}.`,
    source_text_status: 'FULL_RECORDED_SECTION',
    row_evidence: `Buyer Parties shall act for row ${index}.`,
    governed_placements: [{
      claim_definition_key: 'TEST_PLACEMENT',
      contract_definition: {
        claim_definition_key: 'TEST_PLACEMENT',
        canonical_value_required_when_present: true,
        allowed_canonical_values: [true],
      },
      examples: [],
    }],
  };
}

function v1Manifest() {
  return {
    schema_version: 'STAGE_2Y_PHASE_B_MANIFEST/V1',
    manifest_id: V1_MANIFEST_ID,
    rows: [
      ...EXACT_BLOCKED_ROW_IDS.map((rowId, index) => blockedRow(index, rowId)),
      { row_id: 'blind-1', cohort: 'HUMAN_BLIND_FLOOR' },
      { row_id: 'anchor-1', cohort: 'HUMAN_ANCHOR_DECIDED' },
    ],
  };
}

function resolvedOutput(row, party = null) {
  return {
    row_id: row.row_id,
    disposition: 'RESOLVED',
    claim_definition_key: 'TEST_PLACEMENT',
    canonical_value: true,
    party,
    supporting_quotes: [row.source_text],
    rationale: 'The source supports the placement.',
  };
}

function baselineAttempt({ row, binding, attemptIndex = 1, state = 'COMPLETE', output = resolvedOutput(row) }) {
  const responseText = state === 'CALL_FAILED' ? null : JSON.stringify(output);
  const body = {
    row_id: row.row_id,
    attempt_index: attemptIndex,
    request_binding_id: binding.request_binding_id,
    row_digest: binding.row_digest,
    prompt_id: binding.prompt_id,
    prompt_version: binding.prompt_version,
    prompt_digest: binding.prompt_digest,
    provider_identity_id: binding.provider_identity_id,
    provider_invocation_identity: state === 'COMPLETE' ? BASELINE_RECEIPT : null,
    response_digest: responseText === null ? null : hash(responseText),
    response_text: responseText,
    output: state === 'CALL_FAILED' ? null : output,
    state,
    errors: state === 'COMPLETE' ? [] : ['test failure'],
    provider_request_id: state === 'COMPLETE' ? `baseline-request-${row.row_id}-${attemptIndex}` : null,
    usage: null,
    started_at: '2026-08-10T00:00:00.000Z',
    completed_at: '2026-08-10T00:00:01.000Z',
  };
  return { ...body, call_id: hash(body) };
}

function crossAttempt({ row, binding, output }) {
  const responseText = JSON.stringify(output);
  const body = {
    row_id: row.row_id,
    attempt_index: 1,
    request_binding_id: binding.request_binding_id,
    row_digest: binding.row_digest,
    prompt_id: binding.prompt_id,
    prompt_version: binding.prompt_version,
    prompt_digest: binding.prompt_digest,
    provider_identity_id: binding.provider_identity_id,
    provider_invocation_identity: CROSS_RECEIPT,
    response_digest: hash(responseText),
    response_text: responseText,
    output,
    state: 'COMPLETE',
    errors: [],
    provider_request_id: `cross-request-${row.row_id}`,
    usage: null,
    started_at: '2026-08-10T00:00:02.000Z',
    completed_at: '2026-08-10T00:00:03.000Z',
  };
  return { ...body, call_id: hash(body) };
}

test('V2 selects exactly the 150 V1 deterministic-blocked row IDs and binds each request', async () => {
  const {
    BASELINE_PROMPT_VERSION, BASELINE_PROVIDER, buildManifest, validateManifest,
  } = await load();
  const source = v1Manifest();
  const manifest = buildManifest({ sourceManifest: source, sourceManifestDigest: V1_MANIFEST_DIGEST });
  const expectedIds = source.rows.filter((row) => row.cohort === 'DETERMINISTIC_BLOCKED').map((row) => row.row_id);
  assert.deepEqual(manifest.rows.map((row) => row.row_id), expectedIds);
  assert.equal(manifest.rows.length, 150);
  assert.ok(manifest.rows.every((row) => row.cohort === 'DETERMINISTIC_BLOCKED'));
  assert.deepEqual(manifest.selection.excluded_v1_cohorts, ['HUMAN_BLIND_FLOOR', 'HUMAN_ANCHOR_DECIDED']);
  assert.equal(manifest.row_bindings.length, 150);
  assert.ok(manifest.row_bindings.every((binding) => (
    binding.prompt_version === BASELINE_PROMPT_VERSION
      && binding.provider_identity_id === BASELINE_PROVIDER.provider_identity_id
      && binding.row_digest
      && binding.prompt_digest
      && binding.request_binding_id
  )));
  assert.equal(manifest.authority.publication_authorisation, 'NONE');
  assert.equal(manifest.source.manifest_id, V1_MANIFEST_ID);
  assert.equal(manifest.source.manifest_digest, V1_MANIFEST_DIGEST);
  assert.equal(manifest.source.blocked_row_order_root, '0d8cec7d8c29ae201b0ac9cdbac260c6d718e3f650fd9c2a60795aa509c86fd9');
  assert.equal(manifest.source.blocked_row_set_root, '55ea6a7f5df6a7630d9264e42c8fce9924253dcc8be691e2a662b1fd2c9b6d20');
  assert.equal(validateManifest(manifest, { sourceManifest: source, sourceManifestDigest: V1_MANIFEST_DIGEST }), true);
  const differentRows = v1Manifest();
  differentRows.rows[0] = blockedRow(0, '0'.repeat(64));
  assert.throws(() => buildManifest({
    sourceManifest: differentRows, sourceManifestDigest: V1_MANIFEST_DIGEST,
  }), /ROW_AUTHORITY_INVALID/);
  assert.throws(() => buildManifest({
    sourceManifest: source, sourceManifestDigest: 'wrong-digest',
  }), /V1_MANIFEST_INVALID/);
});

test('V2 prompt states the exact party union and validator fails closed on every other shape', async () => {
  const { baselinePrompt, validPartyShape, validateBaselineOutput } = await load();
  const row = blockedRow(0);
  const prompt = baselinePrompt(row);
  assert.match(prompt, /exactly null OR exactly an object with one key in the shape \{"value":"explicit party text"\}/);
  assert.match(prompt, /Never return a bare string for party/);
  assert.equal(validPartyShape(null), true);
  assert.equal(validPartyShape({ value: 'Buyer Parties' }), true);
  assert.equal(validPartyShape('Buyer Parties'), false);
  assert.equal(validPartyShape({ value: 'Buyer Parties', role: 'buyer' }), false);
  assert.equal(validPartyShape({}), false);
  assert.deepEqual(validateBaselineOutput(row, resolvedOutput(row, null)), []);
  assert.deepEqual(validateBaselineOutput(row, resolvedOutput(row, { value: 'Buyer Parties' })), []);
  assert.ok(validateBaselineOutput(row, resolvedOutput(row, 'Buyer Parties')).includes('PARTY_SHAPE_INVALID'));
  assert.ok(validateBaselineOutput(row, resolvedOutput(row, { value: 'Buyer Parties', role: 'buyer' })).includes('PARTY_SHAPE_INVALID'));
  assert.ok(validateBaselineOutput(row, resolvedOutput(row, { value: 'Parent' })).includes('PARTY_NOT_EXPLICIT_IN_SOURCE'));
});

test('manifest rejects row, prompt, and provider identity tampering', async () => {
  const { BASELINE_PROMPT_ID, BASELINE_PROVIDER, baselineBinding, buildManifest, validateManifest } = await load();
  const source = v1Manifest();
  const manifest = buildManifest({ sourceManifest: source, sourceManifestDigest: V1_MANIFEST_DIGEST });
  const original = manifest.row_bindings[0];
  const changedRow = baselineBinding({ ...manifest.rows[0], source_text: 'changed source' });
  assert.notEqual(changedRow.row_digest, original.row_digest);
  assert.notEqual(changedRow.prompt_digest, original.prompt_digest);
  assert.notEqual(changedRow.request_binding_id, original.request_binding_id);
  assert.equal(original.provider_identity_id, BASELINE_PROVIDER.provider_identity_id);
  assert.equal(original.prompt_id, BASELINE_PROMPT_ID);
  const changed = structuredClone(manifest);
  changed.row_bindings[0].prompt_version = 'STAGE_2Y_PHASE_B_BLOCKED_RECOVERY_PROMPT/V1';
  assert.throws(() => validateManifest(changed), /ROW_BINDING_INVALID/);
  const changedProvider = structuredClone(manifest);
  changedProvider.provider_identities.baseline.model = 'different-model';
  const { manifest_id: ignored, ...changedProviderBody } = changedProvider;
  changedProvider.manifest_id = hash(changedProviderBody);
  assert.throws(() => validateManifest(changedProvider), /MANIFEST_INVALID/);
  const changedPrompt = structuredClone(manifest);
  changedPrompt.prompt_contracts.baseline.prompt_id = 'DIFFERENT_PROMPT';
  const { manifest_id: ignoredPrompt, ...changedPromptBody } = changedPrompt;
  changedPrompt.manifest_id = hash(changedPromptBody);
  assert.throws(() => validateManifest(changedPrompt), /MANIFEST_INVALID/);
});

test('baseline resume history retains a failed receipt and accepts a bound retry', async () => {
  const { baselineBinding, baseBaselineArtifact, buildManifest, validateBaselineArtifact } = await load();
  const manifest = buildManifest({ sourceManifest: v1Manifest(), sourceManifestDigest: V1_MANIFEST_DIGEST });
  const artifact = baseBaselineArtifact(manifest);
  const row = manifest.rows[0];
  const binding = baselineBinding(row);
  const failed = baselineAttempt({ row, binding, state: 'CALL_FAILED' });
  artifact.attempts.push(failed);
  artifact.stopped = {
    code: failed.state, row_id: row.row_id, call_id: failed.call_id, stopped_at: failed.completed_at,
  };
  assert.equal(validateBaselineArtifact(manifest, artifact), true);
  artifact.stopped = null;
  artifact.attempts.push(baselineAttempt({ row, binding, attemptIndex: 2 }));
  assert.equal(validateBaselineArtifact(manifest, artifact), true);
  assert.equal(artifact.attempts.length, 2);
  const identityTampered = structuredClone(artifact);
  identityTampered.attempts[1].provider_invocation_identity.model = 'different-model';
  const { call_id: ignored, ...attemptBody } = identityTampered.attempts[1];
  identityTampered.attempts[1].call_id = hash(attemptBody);
  assert.throws(() => validateBaselineArtifact(manifest, identityTampered), /COMPLETE_OUTPUT_INVALID/);
});

test('V2 baseline and cross-vendor validators reject V1 protocol artefacts', async () => {
  const {
    baselineBinding, baseBaselineArtifact, baseCrossVendorArtifact, buildManifest,
    crossVendorBinding, validateBaselineArtifact, validateCrossVendorArtifact,
  } = await load();
  const manifest = buildManifest({ sourceManifest: v1Manifest(), sourceManifestDigest: V1_MANIFEST_DIGEST });
  const baseline = baseBaselineArtifact(manifest);
  for (const row of manifest.rows) {
    baseline.attempts.push(baselineAttempt({ row, binding: baselineBinding(row) }));
  }
  assert.equal(validateBaselineArtifact(manifest, baseline), true);
  assert.throws(() => validateBaselineArtifact(manifest, {
    ...baseline, schema_version: 'STAGE_2Y_PHASE_B_TERRA_CALLS/V1',
  }), /BASELINE_ARTIFACT_INVALID/);

  const baselineDigest = 'v2-baseline-file-digest';
  const cross = baseCrossVendorArtifact(manifest, baselineDigest, 150);
  for (const row of manifest.rows) {
    const baselineCall = baseline.attempts.find((attempt) => attempt.row_id === row.row_id);
    const output = {
      row_id: row.row_id,
      classification: 'CORRECT',
      error_class: null,
      rationale: 'The proposal is supported.',
    };
    cross.attempts.push(crossAttempt({ row, binding: crossVendorBinding(row, baselineCall), output }));
  }
  assert.equal(validateCrossVendorArtifact(manifest, baseline, cross, baselineDigest), true);
  assert.throws(() => validateCrossVendorArtifact(manifest, baseline, {
    ...cross, schema_version: 'STAGE_2Y_PHASE_B_CROSS_VENDOR_CALLS/V1',
  }, baselineDigest), /CROSS_VENDOR_ARTIFACT_INVALID/);
});

test('V2 report keeps the Phase B recovery gates, thresholds, and no-publication boundary', async () => {
  const {
    baselineBinding, baseBaselineArtifact, buildManifest, buildReport,
  } = await load();
  const manifest = buildManifest({ sourceManifest: v1Manifest(), sourceManifestDigest: V1_MANIFEST_DIGEST });
  const { initial: initialSolProbe } = await loadSol();
  const solProbe = initialSolProbe();
  const baseline = baseBaselineArtifact(manifest);
  for (const [index, row] of manifest.rows.entries()) {
    const output = index < 90 ? resolvedOutput(row) : {
      ...resolvedOutput(row), disposition: 'REVIEW', claim_definition_key: null,
      canonical_value: null, party: null, supporting_quotes: [],
    };
    baseline.attempts.push(baselineAttempt({ row, binding: baselineBinding(row), output }));
  }
  const report = buildReport({
    manifest,
    baseline,
    solProbe,
    solProbeArtifactDigest: 'a'.repeat(64),
    generatedAt: '2026-08-10T00:00:00.000Z',
  });
  assert.equal(report.counts.blocked_selected, 150);
  assert.equal(report.counts.blocked_model_proposed_placements, 90);
  assert.equal(report.recovery.denominator, 150);
  assert.equal(report.recovery.rate, 0.6);
  assert.equal(report.gates.blocked_sample_complete, true);
  assert.equal(report.gates.recovery_at_least_60_percent, true);
  assert.deepEqual(Object.keys(report.gates).sort(), [
    'blocked_sample_complete',
    'cross_vendor_to_human_agreement_at_least_95_percent',
    'every_recovered_cross_vendor_scored',
    'lead_tier_probe_complete_without_stop',
    'party_attribution',
    'publication_authorised',
    'recovered_human_adjudications_at_least_50',
    'recovered_human_correctness_at_least_95_percent',
    'recovery_at_least_60_percent',
    'terra_explicit_invocation_identity_receipts_complete',
  ]);
  assert.equal(report.gates.recovered_human_adjudications_at_least_50, false);
  assert.equal(report.gates.recovered_human_correctness_at_least_95_percent, null);
  assert.equal(report.gates.cross_vendor_to_human_agreement_at_least_95_percent, null);
  assert.equal(report.gates.lead_tier_probe_complete_without_stop, false);
  assert.equal(report.gates.publication_authorised, false);
  assert.deepEqual(report.gate_thresholds, {
    recovery_rate_minimum: 0.6,
    recovered_human_adjudications_required: 50,
    recovered_human_correctness_minimum: 0.95,
    cross_vendor_human_agreement_minimum: 0.95,
    lead_tier_probe_calls_required: 46,
  });
  assert.equal(report.confidence_method.method_id, 'WILSON_SCORE_ONE_SIDED_LOWER_BOUND/V1');
  assert.ok(report.recovery.lower_confidence_bound > 0 && report.recovery.lower_confidence_bound < 0.6);
  assert.equal(report.counts.sol_probe_selected, 46);
  assert.equal(report.counts.sol_probe_attempted, 0);
  assert.equal(report.counts.sol_probe_complete, 0);
  assert.equal(report.lead_tier_probe.artifact_path, 'evidence/canonical-v2/stage-2y-phase-b/sol-probe.json');
  assert.equal(report.lead_tier_probe.artifact_digest, 'a'.repeat(64));
  assert.equal(report.lead_tier_probe.validation_status, 'READY_OR_PARTIAL');
  assert.equal(report.lead_tier_probe.provider.requested_model_id, 'gpt-5.6-sol;reasoning=medium;profile=SOL_MEDIUM');
  assert.deepEqual(report.lead_tier_probe.composition, {
    CLOSING_CONDITIONS: 26, FINANCING_COVENANTS: 8, PROXY_MEETING: 12,
  });
  assert.equal(report.publication_authorisation, 'NONE');
});

test('V2 report strictly validates the Sol artefact and rejects missing or fabricated evidence', async () => {
  const { buildManifest, buildReport, validateSolForReport } = await load();
  const { initial: initialSolProbe } = await loadSol();
  const manifest = buildManifest({ sourceManifest: v1Manifest(), sourceManifestDigest: V1_MANIFEST_DIGEST });
  const solProbe = initialSolProbe();
  assert.deepEqual(validateSolForReport(solProbe, 'a'.repeat(64)), {
    ok: true, errors: [], status: 'READY_OR_PARTIAL',
  });
  assert.throws(() => buildReport({ manifest }), /SOL_PROBE_DIGEST_INVALID/);
  assert.throws(() => validateSolForReport(solProbe, 'not-a-digest'), /SOL_PROBE_DIGEST_INVALID/);
  assert.throws(() => validateSolForReport({
    ...solProbe, provider: { ...solProbe.provider, model: 'gpt-5.6-terra' },
  }, 'a'.repeat(64)), /SOL_PROBE_ARTIFACT_INVALID:.*AUTHORITY_OR_PROVIDER_INVALID/);
  const fabricatedComplete = {
    ...solProbe,
    calls: solProbe.call_manifest.map((spec) => ({
      call_id: spec.call_id, spec, state: 'COMPLETE', output: {}, errors: [], receipt_id: 'fabricated',
    })),
  };
  assert.throws(() => validateSolForReport(fabricatedComplete, 'a'.repeat(64)), /SOL_PROBE_ARTIFACT_INVALID/);
});

test('V2 commands and output paths do not write into the V1 evidence directory', async () => {
  const { buildManifest, parseArgs } = await load();
  const manifest = buildManifest({ sourceManifest: v1Manifest(), sourceManifestDigest: V1_MANIFEST_DIGEST });
  assert.equal(manifest.source.path, 'evidence/canonical-v2/stage-2y-phase-b/manifest.json');
  assert.match(manifest.commands.prepare, /stage-2y-phase-b-v2-model-experiment/);
  assert.match(manifest.commands.baseline, /--run-baseline --resume/);
  assert.match(manifest.commands.cross_vendor, /--run-cross-vendor --resume/);
  assert.deepEqual(parseArgs(['--run-baseline', '--resume']), { mode: '--run-baseline', resume: true });
  assert.throws(() => parseArgs(['--prepare', '--resume']), /USAGE/);
  const source = fs.readFileSync(path.join(ROOT, 'scripts/stage-2y-phase-b-v2-model-experiment.mjs'), 'utf8');
  assert.doesNotMatch(source, /writeAtomic\(V1_/);
  assert.doesNotMatch(source, /writeFileSync\(resolve\(ROOT, V1_/);
});
