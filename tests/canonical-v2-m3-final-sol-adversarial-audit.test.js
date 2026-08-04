'use strict';

const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, writeFileSync, existsSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const test = require('node:test');

const {
  AUDIT_TOPICS,
  M3FinalSolAdversarialAuditError,
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

function fixture(root) {
  const review = writeJson(root, 'final-review.json', {
    work_items: Array.from({ length: 12 }, (_, index) => ({ work_item_id: `work-${index + 1}` })),
  });
  const legalA = writeJson(root, 'legal-a.json', { findings: Array.from({ length: 6 }, (_, index) => ({ finding: index })) });
  const legalB = writeJson(root, 'legal-b.json', { findings: Array.from({ length: 6 }, (_, index) => ({ finding: index + 6 })) });
  const sevenFails = writeJson(root, 'seven-fails.json', { findings: Array.from({ length: 7 }, (_, index) => ({ status: 'FAIL', finding: index })) });
  const risk = writeJson(root, 'risk.json', { family_control_audit: [{ family: 'NO_SHOP' }] });
  const plan = writeJson(root, 'plan.json', { proposed_execution: [{ control: 'SOURCE_BOUND' }] });
  return { review, legalA, legalB, sevenFails, risk, plan };
}

function build(root) {
  const files = fixture(root);
  return buildSealedM3FinalSolAuditInput({
    repo_root: root,
    commit_range: 'base..head',
    code_paths: ['lib/candidate-resolution.js'],
    final_review_packet_path: files.review,
    final_legal_finding_paths: [files.legalA, files.legalB],
    original_seven_fail_findings_path: files.sevenFails,
    cross_family_risk_audit_path: files.risk,
    production_plan_path: files.plan,
    git_diff: (range, paths) => `diff --git a/${paths[0]} b/${paths[0]}\nindex a..b 100644\n--- a/${paths[0]}\n+++ b/${paths[0]}\n@@\n+source-bound repair\n${range}`,
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
  assert.equal(input.audit_model_profile.call_count, 1);
  assert.equal(input.final_review_packet.content.work_items.length, 12);
  assert.equal(input.final_independent_legal_findings.flatMap((entry) => entry.content.findings).length, 12);
  assert.equal(input.original_seven_fail_findings.content.findings.length, 7);
  assert.match(input.consolidation_code_diff.text, /source-bound repair/);
  assert.equal(Object.isFrozen(input), true);
  assert.equal(validateSealedM3FinalSolAuditInput(input), true);
  assert.match(auditPrompt(input), /demo_truthfulness/);
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
    model: SOL_HIGH_PROFILE.model,
    reasoningEffort: SOL_HIGH_PROFILE.reasoning_effort,
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
