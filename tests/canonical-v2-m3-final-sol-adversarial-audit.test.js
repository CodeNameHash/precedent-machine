'use strict';

const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, writeFileSync, existsSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const test = require('node:test');

const {
  AUDIT_TOPICS,
  M3FinalSolAdversarialAuditError,
  PROMPT_BYTE_CEILING,
  SOL_HIGH_PROFILE,
  auditPrompt,
  buildSealedM3FinalSolAuditInput,
  runSealedM3FinalSolAdversarialAudit,
  validateSealedM3FinalSolAuditInput,
  validateSealedM3FinalSolAuditOutput,
} = require('../lib/canonical-v2/m3-final-sol-adversarial-audit');

function writeJson(root, name, value) {
  const pathname = join(root, name);
  writeFileSync(pathname, JSON.stringify(value));
  return pathname;
}

function finalWorkItem(index) {
  const workItemId = `work-${index + 1}`;
  return {
    work_item_id: workItemId,
    source_kind: 'PASSED_ITERATION_2',
    model_call_count: 2,
    legal_disposition: 'NOT_DETERMINED',
    independent_review_state: 'PENDING_INDEPENDENT_REVIEW',
    iteration_2_work_result: {
      work_item_id: workItemId,
      work_result_id: `result-${index + 1}`,
      source_id: `source-${index + 1}`,
      resolution: {
        resolved: index <= 1 ? [{
          resolved_claim_definition_key: 'NO_SHOP_DURATION',
          concept_key: 'NO_SHOP',
          party: 'Target',
          ...(index === 0 ? { source_citation: 'Section 4.3' } : { section_reference: '4.3' }),
          triage: { reasons: ['SOURCE_BOUND'] },
          claim: {
            claim_revision_id: 'claim-1',
            canonical_value: '45 days',
            raw_value: '45 days',
            attributes: { duration_days: 45 },
          },
        }] : [],
        review_queue: [],
        open_world: [],
        resolution_receipt: { counts: { resolved: index <= 1 ? 1 : 0, review_queue: 0, open_world: 0 } },
      },
    },
  };
}

function fixture(root) {
  const review = writeJson(root, 'final-review.json', {
    work_items: Array.from({ length: 12 }, (_, index) => finalWorkItem(index)),
  });
  const legalA = writeJson(root, 'legal-a.json', { findings: Array.from({ length: 6 }, (_, index) => ({ work_item_id: `work-${index + 1}`, status: 'FAIL', finding: index })) });
  const legalB = writeJson(root, 'legal-b.json', { findings: Array.from({ length: 6 }, (_, index) => ({ work_item_id: `work-${index + 7}`, status: 'PASS', finding: index + 6 })) });
  const sevenFails = writeJson(root, 'seven-fails.json', { findings: Array.from({ length: 7 }, (_, index) => ({ status: 'FAIL', finding: index })) });
  const risk = writeJson(root, 'risk.json', { family_control_audit: [{ family: 'NO_SHOP' }] });
  const plan = writeJson(root, 'plan.json', { proposed_execution: [{ control: 'SOURCE_BOUND' }] });
  return { review, legalA, legalB, sevenFails, risk, plan };
}

function build(root, gitDiff = null, finalFindingPaths = null) {
  const files = fixture(root);
  return buildSealedM3FinalSolAuditInput({
    repo_root: root,
    commit_range: 'base..head',
    code_paths: ['lib/candidate-resolution.js'],
    final_review_packet_path: files.review,
    final_legal_finding_paths: finalFindingPaths || [files.legalA, files.legalB],
    original_seven_fail_findings_path: files.sevenFails,
    cross_family_risk_audit_path: files.risk,
    production_plan_path: files.plan,
    git_diff: gitDiff || ((range, paths) => `diff --git a/${paths[0]} b/${paths[0]}\nindex a..b 100644\n--- a/${paths[0]}\n+++ b/${paths[0]}\n@@\n+source-bound repair\n${range}`),
  });
}

function validProviderOutput() {
  return {
    schema_version: 'M3_FINAL_SOL_ADVERSARIAL_RESPONSE/V1',
    verdict: 'AMEND',
    findings: [{
      finding_id: 'citation-1',
      topic: 'citation_integrity',
      severity: 'HIGH',
      finding: 'Child citation support needs a further source replay.',
      evidence_refs: ['final-review-packet:topbuild-no-shop-company-4-3'],
    }],
    coverage: Object.fromEntries(AUDIT_TOPICS.map((topic) => [topic, {
      status: 'COVERED', summary: `${topic} assessed against the sealed record.`,
    }])),
  };
}

test('builds and validates a sealed input with the final 12, final 12 legal findings, original seven failures, plan, risk audit and consolidation diff', () => {
  const root = mkdtempSync(join(tmpdir(), 'm3-sol-audit-'));
  const input = build(root);
  assert.equal(input.audit_model_profile.profile_id, 'SOL_HIGH');
  assert.equal(SOL_HIGH_PROFILE.model, 'gpt-5.6-sol');
  assert.equal(SOL_HIGH_PROFILE.reasoning_effort, 'high');
  assert.equal(input.audit_model_profile.call_count, 1);
  assert.equal(input.audit_projection.final_review_packet.length, 12);
  assert.equal(input.audit_projection.final_independent_legal_findings.length, 12);
  assert.equal(input.audit_projection.original_seven_fail_findings.length, 7);
  assert.equal(input.audit_projection.final_review_packet[0].resolved_claims[0].exact_source_quote, '45 days');
  assert.equal(input.audit_projection.final_review_packet[0].resolved_claims[0].exact_source_citation, 'Section 4.3');
  assert.equal(input.audit_projection.final_review_packet[1].resolved_claims[0].exact_source_citation,
    'Published citation pending; governed scope 4.3');
  assert.equal(input.audit_projection.final_review_packet[0].source_kind, 'PASSED_ITERATION_2');
  assert.equal(input.audit_artifact_seals.final_review_packet.content, undefined);
  assert.match(input.consolidation_code_diff.text, /source-bound repair/);
  assert.equal(Object.isFrozen(input), true);
  assert.equal(validateSealedM3FinalSolAuditInput(input), true);
  const prompt = auditPrompt(input);
  assert.match(prompt, /demo_truthfulness/);
  assert.ok(Buffer.byteLength(prompt, 'utf8') <= PROMPT_BYTE_CEILING);
});

test('accepts one sealed twelve-item final legal findings file', () => {
  const root = mkdtempSync(join(tmpdir(), 'm3-sol-audit-'));
  const files = fixture(root);
  const finalFindings = writeJson(root, 'legal-all.json', {
    findings: [
      ...JSON.parse(readFileSync(files.legalA, 'utf8')).findings,
      ...JSON.parse(readFileSync(files.legalB, 'utf8')).findings,
    ],
  });
  const input = build(root, null, [finalFindings]);
  assert.equal(input.audit_artifact_seals.final_independent_legal_findings.length, 1);
  assert.equal(input.audit_projection.final_independent_legal_findings.length, 12);
});

test('preserves the exact seven-FAIL rows and projects the current risk and production controls', () => {
  const root = mkdtempSync(join(tmpdir(), 'm3-sol-audit-'));
  const files = fixture(root);
  const sevenFails = [
    {
      work_item_id: 'topbuild-no-shop-company-4-3',
      status: 'FAIL',
      source: { source_id: 'topbuild-full', section_reference: '4.3' },
      reasons: ['The Company chapeau and child clauses are both required.'],
      false_positive_check: 'Open-world items remain open-world.',
      omission_check: 'Controlled actions remain unresolved.',
    },
    {
      work_item_id: 'topbuild-remedies-specific-performance-7-6',
      status: 'FAIL',
      source: { source_id: 'topbuild-full', section_reference: '7.6' },
      reasons: ['The equitable-relief premise lacks its required citation.'],
      false_positive_check: 'A litigation-extension clause is not a remedy grant.',
      omission_check: 'The supported grant is not fully traceable.',
    },
    ...Array.from({ length: 5 }, (_, index) => ({
      work_item_id: `original-fail-${index + 1}`,
      status: 'FAIL',
      source: { source_id: `source-${index + 1}`, section_reference: `${index + 1}.0` },
      reasons: [`reason-${index + 1}`],
      false_positive_check: `false-positive-${index + 1}`,
      omission_check: `omission-${index + 1}`,
    })),
  ];
  const riskControls = [{ family_id: 'NO_SHOP', control: 'CHAPEAU_REQUIRED' }];
  const executionControls = [{ stage: 5, status: 'CURRENT' }];
  const originalSevenFails = writeJson(root, 'seven-fails-exact.json', {
    schema_version: 'M3_FINAL_SOL_AUDIT_SEVEN_FAIL_SUBSET/V1',
    findings: sevenFails,
  });
  const risk = writeJson(root, 'risk-current.json', { family_control_audit: riskControls });
  const plan = writeJson(root, 'plan-current.json', { proposed_execution: executionControls });
  const input = buildSealedM3FinalSolAuditInput({
    repo_root: root,
    commit_range: 'base..head',
    code_paths: ['lib/candidate-resolution.js'],
    final_review_packet_path: files.review,
    final_legal_finding_paths: [files.legalA, files.legalB],
    original_seven_fail_findings_path: originalSevenFails,
    cross_family_risk_audit_path: risk,
    production_plan_path: plan,
    git_diff: (range, paths) => `diff --git a/${paths[0]} b/${paths[0]}\n@@\n+source-bound repair\n${range}`,
  });
  assert.deepEqual(input.audit_projection.original_seven_fail_findings, sevenFails);
  assert.deepEqual(input.audit_projection.cross_family_risk_audit.family_control_audit, riskControls);
  assert.deepEqual(input.audit_projection.production_extraction_plan.proposed_execution, executionControls);
});

test('uses deterministic relevant hunks with hashes when a scoped diff exceeds the declared full-diff ceiling', () => {
  const root = mkdtempSync(join(tmpdir(), 'm3-sol-audit-'));
  const input = build(root, (range, paths) => (
    `diff --git a/${paths[0]} b/${paths[0]}\nindex a..b 100644\n--- a/${paths[0]}\n+++ b/${paths[0]}\n@@\n+${'source-bound repair\n'.repeat(20000)}${range}`
  ));
  assert.equal(input.consolidation_code_diff.representation, 'DETERMINISTIC_RELEVANT_HUNKS');
  assert.equal(input.consolidation_code_diff.relevant_hunks.length, 1);
  assert.equal(input.consolidation_code_diff.relevant_hunks[0].path, 'lib/candidate-resolution.js');
  assert.match(input.consolidation_code_diff.relevant_hunks[0].full_file_diff_sha256, /^[a-f0-9]{64}$/);
  assert.ok(Buffer.byteLength(auditPrompt(input), 'utf8') <= PROMPT_BYTE_CEILING);
});

test('fails closed when a required code path is absent from a compacted scoped diff', () => {
  const root = mkdtempSync(join(tmpdir(), 'm3-sol-audit-'));
  assert.throws(
    () => build(root, () => `diff --git a/lib/other.js b/lib/other.js\n@@\n+${'x\n'.repeat(200000)}`),
    (error) => error instanceof M3FinalSolAdversarialAuditError && error.code === 'CODE_DIFF_UNREPRESENTED',
  );
});

test('makes exactly one SOL_HIGH subscription-client call and seals the raw provider output at the explicit path', async () => {
  const root = mkdtempSync(join(tmpdir(), 'm3-sol-audit-'));
  const input = build(root);
  const outputPath = join(root, 'sealed-output.json');
  let calls = 0;
  let options = null;
  const output = await runSealedM3FinalSolAdversarialAudit({
    input,
    output_path: outputPath,
    client_factory: (received) => {
      options = received;
      return { messages: { create: async () => {
        calls += 1;
        return { content: [{ text: JSON.stringify(validProviderOutput()) }] };
      } } };
    },
  });
  assert.equal(calls, 1);
  assert.deepEqual(options, {
    model: 'gpt-5.6-sol',
    reasoningEffort: 'high',
    maxAttempts: 1,
    ephemeral: true,
    isolated: true,
  });
  assert.equal(output.audit_input_id, input.audit_input_id);
  assert.equal(output.raw_provider_output, JSON.stringify(validProviderOutput()));
  assert.equal(validateSealedM3FinalSolAuditOutput(output, input), true);
  assert.equal(JSON.parse(readFileSync(outputPath, 'utf8')).audit_output_id, output.audit_output_id);
});

test('fails closed on missing required provider coverage and does not write an output', async () => {
  const root = mkdtempSync(join(tmpdir(), 'm3-sol-audit-'));
  const input = build(root);
  const outputPath = join(root, 'must-not-exist.json');
  const malformed = validProviderOutput();
  delete malformed.coverage.demo_truthfulness;
  await assert.rejects(
    runSealedM3FinalSolAdversarialAudit({
      input,
      output_path: outputPath,
      client_factory: () => ({ messages: { create: async () => ({ content: [{ text: JSON.stringify(malformed) }] }) } }),
    }),
    (error) => error instanceof M3FinalSolAdversarialAuditError && error.code === 'INVALID_PROVIDER_OUTPUT',
  );
  assert.equal(existsSync(outputPath), false);
});

test('fails closed when the original seven-fail input loses a failure', () => {
  const root = mkdtempSync(join(tmpdir(), 'm3-sol-audit-'));
  const files = fixture(root);
  writeJson(root, 'seven-short.json', { findings: Array.from({ length: 6 }, () => ({ status: 'FAIL' })) });
  assert.throws(
    () => buildSealedM3FinalSolAuditInput({
      repo_root: root,
      commit_range: 'base..head',
      code_paths: ['lib/candidate-resolution.js'],
      final_review_packet_path: files.review,
      final_legal_finding_paths: [files.legalA, files.legalB],
      original_seven_fail_findings_path: join(root, 'seven-short.json'),
      cross_family_risk_audit_path: files.risk,
      production_plan_path: files.plan,
      git_diff: () => 'diff --git a/a b/a',
    }),
    (error) => error instanceof M3FinalSolAdversarialAuditError && error.code === 'INPUT_COVERAGE_MISSING',
  );
});
