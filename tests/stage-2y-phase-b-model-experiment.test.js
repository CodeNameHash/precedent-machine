const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');

async function load() {
  return import(path.join(ROOT, 'scripts/stage-2y-phase-b-model-experiment.mjs'));
}

test('builds the fixed Phase B cohorts with full recorded source for every blocked row', async () => {
  const { buildManifest } = await load();
  const first = buildManifest();
  const second = buildManifest();
  assert.equal(first.manifest_id, second.manifest_id);
  assert.deepEqual(first.selection.counts, {
    human_blind_floor: 96,
    human_anchor_decided: 54,
    deterministic_blocked: 150,
  });
  const blocked = first.rows.filter((row) => row.cohort === 'DETERMINISTIC_BLOCKED');
  assert.equal(blocked.length, 150);
  assert.ok(blocked.every((row) => row.source_text_status === 'FULL_RECORDED_SECTION'));
  assert.ok(new Set(blocked.map((row) => row.family)).size >= 20);
  assert.equal(first.authority.publication_authorisation, 'NONE');
  assert.equal(first.providers.baseline.requested_model_id, 'gpt-5.6-terra;reasoning=medium;profile=TERRA_MEDIUM');
  assert.deepEqual(first.providers.lead_tier_probe, {
    provider_id: 'OPENAI_CODEX_CLI_SUBSCRIPTION', model: 'gpt-5.6-sol', reasoning_effort: 'medium',
  });
  const conchoClosing = first.inputs.latest_run_sets.find((row) => row.deal === 'concho' && row.family === 'CLOSING_CONDITIONS');
  assert.equal(conchoClosing.run_names.length, 4);
  assert.ok(conchoClosing.run_names.every((name) => name.startsWith('evidence/canonical-v2/stage-2y-l-live-runs/')));
  assert.ok(conchoClosing.run_names.every((name) => !name.includes('2xk-final')));
});

test('rung-4 blocked prompt requires three explicit dispositions and no inferred party', async () => {
  const { buildManifest, terraPrompt } = await load();
  const row = buildManifest().rows.find((entry) => entry.cohort === 'DETERMINISTIC_BLOCKED');
  const prompt = terraPrompt(row);
  assert.match(prompt, /RESOLVED\|OPEN_WORLD\|REVIEW/);
  assert.match(prompt, /Never infer a party/);
  assert.match(prompt, /positively contradict/);
});

test('blocked output validation rejects ungoverned placements and fabricated quotes', async () => {
  const { buildManifest, validateTerraOutput } = await load();
  const row = buildManifest().rows.find((entry) => entry.cohort === 'DETERMINISTIC_BLOCKED');
  const output = {
    row_id: row.row_id,
    disposition: 'RESOLVED',
    claim_definition_key: 'NOT_GOVERNED',
    canonical_value: true,
    party: null,
    supporting_quotes: ['not in the agreement'],
    rationale: 'test',
  };
  assert.deepEqual(validateTerraOutput(row, output).sort(), ['RESOLVED_PLACEMENT_INVALID', 'SUPPORTING_QUOTE_INVALID']);
});

test('recovered placement must satisfy the governed contract value type', async () => {
  const { buildManifest, validateTerraOutput } = await load();
  const row = buildManifest().rows.find((entry) => entry.cohort === 'DETERMINISTIC_BLOCKED'
    && entry.governed_placements.some((placement) => placement.contract_definition?.canonical_value_type === 'NON_NEGATIVE_DECIMAL_STRING'));
  const placement = row.governed_placements.find((entry) => entry.contract_definition?.canonical_value_type === 'NON_NEGATIVE_DECIMAL_STRING');
  const output = {
    row_id: row.row_id, disposition: 'RESOLVED', claim_definition_key: placement.claim_definition_key,
    canonical_value: '-1', party: null, supporting_quotes: [row.source_text.slice(0, 8)], rationale: 'test',
  };
  assert.ok(validateTerraOutput(row, output).includes('CANONICAL_VALUE_TYPE_INVALID'));
});

test('human packet fixes exactly 50 recovered rows and an empty ledger cannot pass 95%', async () => {
  const { buildManifest, buildHumanPacket, emptyHumanLedger, sealHumanLedger, humanLedgerMetrics, buildHiddenComparison } = await load();
  const manifest = buildManifest(); const blocked = manifest.rows.filter((row) => row.cohort === 'DETERMINISTIC_BLOCKED').slice(0, 60);
  const calls = blocked.map((row) => ({ row_id: row.row_id, cohort: row.cohort, state: 'COMPLETE', call_id: `call-${row.row_id}`, response_digest: row.row_id, output: { disposition: 'RESOLVED' } }));
  const cross = { calls: calls.map((call) => ({ row_id: call.row_id, state: 'COMPLETE', provider_request_id: `cross-${call.row_id}`, output: { classification: 'CORRECT' } })) };
  const packet = buildHumanPacket(manifest, { calls }, cross); const ledger = emptyHumanLedger(packet); const metrics = humanLedgerMetrics(packet, ledger);
  assert.equal(packet.cards.length, 50);
  assert.equal(packet.selection_algorithm, 'FIRST_50_RECOVERED_BY_SHA256_ROW_ID/V1');
  assert.equal(packet.blinding, 'CROSS_VENDOR_VERDICTS_WITHHELD');
  assert.ok(packet.cards.every((card) => !Object.hasOwn(card, 'cross_vendor_score') && !Object.hasOwn(card, 'cross_vendor_call_id')));
  assert.equal(metrics.decisions, 0);
  assert.equal(metrics.complete, false);
  assert.equal(metrics.agreement, null);
  const decisions = packet.cards.map((card, index) => ({ row_id: card.row.row_id, verdict: index === 49 ? 'ERROR' : 'CORRECT', rationale: 'Human decision.', reviewed_by: 'Ben', reviewed_on: '2026-08-10' }));
  const completeLedger = sealHumanLedger(packet, decisions); const complete = humanLedgerMetrics(packet, completeLedger);
  assert.equal(complete.complete, true);
  assert.equal(complete.agreement, 49 / 50);
  const comparison = buildHiddenComparison(packet, completeLedger, cross);
  assert.equal(comparison.metrics.recovered_human_agreement, 49 / 50);
  assert.equal(comparison.metrics.cross_vendor_human_agreement, 49 / 50);
  assert.equal(comparison.rows.length, 50);
  assert.equal(humanLedgerMetrics(packet, { ...completeLedger, status: 'PENDING_HUMAN_ADJUDICATION' }).valid, false);
  assert.equal(humanLedgerMetrics(packet, { ...completeLedger, ledger_id: 'changed' }).valid, false);
});

test('human packet refuses incomplete cross-vendor coverage', async () => {
  const { buildManifest, buildHumanPacket } = await load(); const manifest = buildManifest();
  const blocked = manifest.rows.filter((row) => row.cohort === 'DETERMINISTIC_BLOCKED').slice(0, 50);
  const calls = blocked.map((row) => ({ row_id: row.row_id, cohort: row.cohort, state: 'COMPLETE', output: { disposition: 'RESOLVED' } }));
  assert.throws(() => buildHumanPacket(manifest, { calls }, { calls: [] }), /EXACT_CROSS_VENDOR_COVERAGE/);
});

test('confidence evidence uses a one-sided Wilson lower bound', async () => {
  const { wilsonLowerBound } = await load();
  assert.equal(wilsonLowerBound(0, 0), null);
  assert.ok(wilsonLowerBound(50, 50) > 0.94 && wilsonLowerBound(50, 50) < 0.95);
  assert.ok(wilsonLowerBound(48, 50) < 0.90);
});

test('Terra and cross-vendor artefacts fail closed when bound evidence is changed', async () => {
  const { buildManifest, baseCallArtifact, validateTerraArtifact, baseCrossVendorArtifact, validateCrossVendorArtifact } = await load();
  const manifest = buildManifest(); const terra = baseCallArtifact(manifest);
  assert.equal(validateTerraArtifact(manifest, terra), true);
  assert.throws(() => validateTerraArtifact(manifest, { ...terra, manifest_id: 'changed' }), /TERRA_ARTIFACT_INVALID/);
  const cross = baseCrossVendorArtifact(manifest, 'terra-digest', 0);
  assert.equal(validateCrossVendorArtifact(manifest, terra, cross, 'terra-digest'), true);
  assert.throws(() => validateCrossVendorArtifact(manifest, terra, { ...cross, terra_calls_digest: 'changed' }, 'terra-digest'), /CROSS_VENDOR_ARTIFACT_INVALID/);
});

test('packet-write preflight rejects manifest and cross artefact tampering', async () => {
  const { buildManifest, baseCallArtifact, baseCrossVendorArtifact, validatePacketWriteInputs } = await load();
  const manifest = buildManifest(); const terra = baseCallArtifact(manifest); const cross = baseCrossVendorArtifact(manifest, 'terra-digest', 0);
  assert.equal(validatePacketWriteInputs(manifest, terra, cross, { terraPresent: true, crossPresent: true, terraCallsDigest: 'terra-digest' }), true);
  assert.throws(() => validatePacketWriteInputs({ ...manifest, purpose: 'changed' }, terra, cross, { terraPresent: true, crossPresent: true, terraCallsDigest: 'terra-digest' }), /PHASE_B_MANIFEST_DRIFT/);
  assert.throws(() => validatePacketWriteInputs(manifest, terra, { ...cross, expected_call_count: 1 }, { terraPresent: true, crossPresent: true, terraCallsDigest: 'terra-digest' }), /CROSS_VENDOR_ARTIFACT_INVALID/);
});

test('report path validates packet inputs before any packet or ledger write', () => {
  const source = fs.readFileSync(path.join(ROOT, 'scripts/stage-2y-phase-b-model-experiment.mjs'), 'utf8');
  const body = source.slice(source.indexOf('function report()'), source.indexOf('function parseArgs'));
  assert.ok(body.indexOf('validatePacketWriteInputs(') < body.indexOf('if (blockedComplete'));
});

test('main report rejects a tampered Sol manifest before lead-gate calculation', async () => {
  const { validateSolForReport } = await load(); const { initial } = await import(path.join(ROOT, 'scripts/stage-2y-phase-b-sol-probe.mjs'));
  const sol = initial(); assert.equal(validateSolForReport(sol), true);
  assert.throws(() => validateSolForReport({ ...sol, cohort: { ...sol.cohort, exact_composition: { CLOSING_CONDITIONS: 46 } } }), /SOL_PROBE_ARTIFACT_INVALID/);
  assert.throws(() => validateSolForReport({ ...sol, provider: { ...sol.provider, model: 'fabricated' } }), /SOL_PROBE_ARTIFACT_INVALID/);
});

test('Terra receipt requires the exact explicit model and reasoning invocation identity', async () => {
  const { terraInvocationIdentityValid } = await load();
  assert.equal(terraInvocationIdentityValid({ identity_basis: 'EXPLICIT_CODEX_EXEC_ARGUMENTS', model: 'gpt-5.6-terra', reasoning_effort: 'medium', model_argument: ['-m', 'gpt-5.6-terra'], reasoning_argument: ['-c', 'model_reasoning_effort="medium"'] }), true);
  assert.equal(terraInvocationIdentityValid({ identity_basis: 'EXPLICIT_CODEX_EXEC_ARGUMENTS', model: 'gpt-5.6-sol', reasoning_effort: 'medium', model_argument: ['-m', 'gpt-5.6-sol'], reasoning_argument: ['-c', 'model_reasoning_effort="medium"'] }), false);
});

test('Terra call receipts reject row or response tampering', async () => {
  const { buildManifest, baseCallArtifact, validateTerraArtifact } = await load();
  const manifest = buildManifest(); const terra = baseCallArtifact(manifest); const row = manifest.rows[0];
  terra.calls.push({ row_id: row.row_id, call_id: 'not-the-record-hash', input_digest: row.evidence_digest, prompt_digest: 'changed', state: 'CALL_FAILED', response_text: null, response_digest: null, provider_request_id: null, errors: ['test'] });
  assert.throws(() => validateTerraArtifact(manifest, terra), /TERRA_CALL_BINDING_INVALID/);
});

test('preflight report carries the full 150-row before denominator', async () => {
  const { buildReport } = await load();
  const report = buildReport();
  assert.deepEqual(report.blocked_four_state.before, { attempted: 150, resolved: 0, open_world: 51, review: 99 });
  assert.equal(report.per_item.length, 150);
  assert.equal(report.per_family.length, 24);
  assert.equal(report.measurement_scope.lawyer_visible_recovery_claimed, false);
  assert.equal(Object.hasOwn(report.gates, 'preadjudicated_non_party_agreement_at_least_95_percent'), false);
  assert.deepEqual(report.lead_tier_probe.composition, { CLOSING_CONDITIONS: 26, FINANCING_COVENANTS: 8, PROXY_MEETING: 12 });
  assert.equal(report.calibration.party_attribution_descriptive_only.n, 7);
});

test('pre-adjudicated agreement is calibration only, not a 95% pass gate', () => {
  const source = fs.readFileSync(path.join(ROOT, 'scripts/stage-2y-phase-b-model-experiment.mjs'), 'utf8');
  const statusLine = source.split('\n').find((line) => line.includes("const status = terra.stopped"));
  assert.doesNotMatch(statusLine, /preadjudicated_non_party_agreement_at_least_95_percent/);
});

test('experiment stays outside the review-parity library', () => {
  const source = fs.readFileSync(path.join(ROOT, 'scripts/stage-2y-phase-b-model-experiment.mjs'), 'utf8');
  assert.doesNotMatch(source, /lib\/review-parity/);
});
