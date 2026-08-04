'use strict';

const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, writeFileSync, existsSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const test = require('node:test');

const { contentId } = require('../lib/canonical-v2/canonical-bytes');

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
    source_kind: 'PASSED_ITERATION_2_CURRENT_RESOLVER_REPLAY',
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
          source_citation: 'Section 4.3',
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
        resolution_receipt: { counts: { resolved: index === 0 ? 1 : 0, review_queue: 0, open_world: 0 } },
      },
    },
    repaired_replay: {
      work_item_id: workItemId,
      repaired_replay_id: `current-replay-${index + 1}`,
      resolution: {
        resolved: index <= 1 ? [{
          resolved_claim_definition_key: 'NO_SHOP_DURATION',
          concept_key: 'NO_SHOP',
          party: 'Target',
          ...(index === 0 ? { source_citation: 'Section 4.3(a)' } : { section_reference: '4.3' }),
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
        conditional_termination_fee_values: index === 0 ? [{ conditional_termination_fee_value_id: 'fee-formula-1' }] : [],
        structured_per_share_cash_values: index === 0 ? [{ structured_per_share_cash_value_id: 'cash-formula-1' }] : [],
        resolution_receipt: { counts: { resolved: index <= 1 ? 1 : 0, review_queue: 0, open_world: 0 } },
      },
    },
  };
}

function v4ProductionPlan({
  finalReviewPacketId,
  strictIndependentReviewInputId,
  proposedExecution = [{ control: 'SOURCE_BOUND' }],
} = {}) {
  const body = {
    schema_version: 'CANONICAL_V2_M3_PRODUCTION_EXTRACTION_PLAN/V4',
    status: 'PROPOSED_NOT_AUTHORISED',
    prepared_at: '2026-08-03',
    seal: {
      method: 'canonical content identifier over this artifact body excluding content_hash',
      sealed_at: '2026-08-03',
      write_scope: 'pilot artifact root only',
      rendered_markdown_path: 'production-extraction-plan-v4.md',
      rendered_markdown_sha256: 'markdown-digest',
    },
    scope: {
      objective: 'Build and certify a full-corpus Canonical V2 release.',
      non_actions: ['No model calls were made for this plan.'],
    },
    bound_pilot_evidence: {
      packet: {
        contract: 'M3_12_CALL_FINAL_PILOT_REVIEW_PACKET/V1',
        final_review_packet_id: finalReviewPacketId,
        legal_disposition: 'NOT_DETERMINED',
        independent_review_state: 'PENDING_INDEPENDENT_LEGAL_REVIEW',
        certification_status: 'NOT_CERTIFIED',
      },
      strict_review_input: {
        contract: 'M3_12_CALL_FINAL_PILOT_STRICT_INDEPENDENT_REVIEW_INPUT/V3',
        strict_independent_review_input_id: strictIndependentReviewInputId,
      },
      final_findings: {
        contract: 'M3_12_CALL_FINAL_PILOT_RE_REVIEW_FINDINGS/V2',
        id: 'sealed-final-findings-id',
        binding_state: 'SEALED_FINAL_FINDINGS_BOUND',
      },
      quality_facts: {
        resolved_claim_count: 152,
        unresolved_review_count: 13,
        open_world_count: 136,
        missing_resolved_citation_count: 0,
        missing_party_evidence_count: 0,
        conditional_fee_formula_count: 6,
        structured_cash_formula_count: 1,
        formula_review_row_count: 7,
      },
    },
    pilot_controls: [{ control: 'SOURCE_SCOPE_IS_NOT_CITATION' }],
    preview_lanes: { agreement_lane: ['Modiv', 'Skechers', 'TopBuild'] },
    proposed_execution: proposedExecution,
    release_gates: ['Every included source is admitted and verified.'],
    future_authority_decisions: [],
  };
  return {
    ...body,
    content_hash: contentId(body.schema_version, body),
  };
}

function fixture(root) {
  const reviewBody = {
    schema_version: 'M3_12_CALL_FINAL_PILOT_REVIEW_PACKET/V1',
    work_items: Array.from({ length: 12 }, (_, index) => finalWorkItem(index)),
  };
  const finalReviewPacketId = contentId(reviewBody.schema_version, reviewBody);
  const review = writeJson(root, 'final-review.json', {
    ...reviewBody,
    final_review_packet_id: finalReviewPacketId,
  });
  const strictBody = {
    schema_version: 'M3_12_CALL_FINAL_PILOT_STRICT_INDEPENDENT_REVIEW_INPUT/V3',
    final_review_packet_id: finalReviewPacketId,
    review_items: reviewBody.work_items.map((item) => ({ work_item_id: item.work_item_id })),
  };
  const strictIndependentReviewInputId = contentId(strictBody.schema_version, strictBody);
  const strict = writeJson(root, 'strict-review.json', {
    ...strictBody,
    strict_independent_review_input_id: strictIndependentReviewInputId,
  });
  const findingsArtifact = (findings) => {
    const body = {
      schema_version: 'M3_12_CALL_FINAL_PILOT_RE_REVIEW_FINDINGS/V2',
      final_review_packet_id: finalReviewPacketId,
      strict_independent_review_input_id: strictIndependentReviewInputId,
      findings,
    };
    return {
      ...body,
      independent_legal_review_findings_id: contentId(body.schema_version, body),
    };
  };
  const legalA = writeJson(root, 'legal-a.json', findingsArtifact(Array.from({ length: 6 }, (_, index) => ({ work_item_id: `work-${index + 1}`, status: 'FAIL', finding: index }))));
  const legalB = writeJson(root, 'legal-b.json', findingsArtifact(Array.from({ length: 6 }, (_, index) => ({ work_item_id: `work-${index + 7}`, status: 'PASS', finding: index + 6 }))));
  const sevenFails = writeJson(root, 'seven-fails.json', { findings: Array.from({ length: 7 }, (_, index) => ({ status: 'FAIL', finding: index })) });
  const risk = writeJson(root, 'risk.json', { family_control_audit: [{ family: 'NO_SHOP' }] });
  const plan = writeJson(root, 'plan.json', v4ProductionPlan({
    finalReviewPacketId,
    strictIndependentReviewInputId,
  }));
  return {
    review,
    strict,
    legalA,
    legalB,
    sevenFails,
    risk,
    plan,
    finalReviewPacketId,
    strictIndependentReviewInputId,
  };
}

function build(root, gitDiff = null, finalFindingPaths = null) {
  const files = fixture(root);
  return buildSealedM3FinalSolAuditInput({
    repo_root: root,
    commit_range: 'base..head',
    code_paths: ['lib/candidate-resolution.js'],
    final_review_packet_path: files.review,
    strict_review_input_path: files.strict,
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
  assert.match(
    input.audit_projection.strict_independent_review_input.strict_independent_review_input_id,
    /^[a-f0-9]{64}$/,
  );
  assert.equal(input.audit_projection.strict_independent_review_input.work_item_ids.length, 12);
  assert.equal(input.audit_projection.final_independent_legal_findings.length, 12);
  assert.equal(input.audit_projection.original_seven_fail_findings.length, 7);
  assert.equal(input.audit_projection.final_review_packet[0].resolved_claims[0].exact_source_quote, '45 days');
  assert.equal(input.audit_projection.final_review_packet[0].resolved_claims[0].exact_source_citation, 'Section 4.3(a)');
  assert.equal(input.audit_projection.final_review_packet[1].resolved_claims[0].exact_source_citation,
    'Published citation pending; governed scope 4.3');
  assert.equal(input.audit_projection.final_review_packet[0].source_kind, 'PASSED_ITERATION_2_CURRENT_RESOLVER_REPLAY');
  assert.equal(input.audit_projection.final_review_packet[0].conditional_termination_fee_values[0].conditional_termination_fee_value_id, 'fee-formula-1');
  assert.equal(input.audit_projection.final_review_packet[0].structured_per_share_cash_values[0].structured_per_share_cash_value_id, 'cash-formula-1');
  assert.equal(input.audit_artifact_seals.final_review_packet.content, undefined);
  assert.equal(input.audit_artifact_seals.strict_independent_review_input.content, undefined);
  assert.match(input.consolidation_code_diff.text, /source-bound repair/);
  assert.equal(Object.isFrozen(input), true);
  assert.equal(validateSealedM3FinalSolAuditInput(input), true);
  const prompt = auditPrompt(input);
  assert.match(prompt, /demo_truthfulness/);
  assert.ok(prompt.includes(`Allowed topic slugs (exactly): ${AUDIT_TOPICS.join(', ')}`));
  assert.ok(prompt.includes('Allowed severities (exactly): CRITICAL, HIGH, MEDIUM, LOW'));
  assert.ok(prompt.includes('Every finding_id must be a unique, non-empty, trimmed string.'));
  assert.ok(prompt.includes('Every finding must have at least one non-empty, trimmed evidence_refs string.'));
  assert.ok(Buffer.byteLength(prompt, 'utf8') <= PROMPT_BYTE_CEILING);
});

test('projects the sealed V4 production plan without fabricating a current_facts field', () => {
  const root = mkdtempSync(join(tmpdir(), 'm3-sol-audit-'));
  const input = build(root);
  const projection = input.audit_projection.production_extraction_plan;
  assert.equal(projection.schema_version, 'CANONICAL_V2_M3_PRODUCTION_EXTRACTION_PLAN/V4');
  assert.equal(projection.status, 'PROPOSED_NOT_AUTHORISED');
  assert.equal(projection.bound_pilot_evidence.packet.final_review_packet_id,
    input.audit_projection.final_review_packet_id);
  assert.equal(projection.bound_pilot_evidence.strict_review_input.strict_independent_review_input_id,
    input.audit_projection.strict_independent_review_input.strict_independent_review_input_id);
  assert.equal(projection.bound_pilot_evidence.final_findings.id, 'sealed-final-findings-id');
  assert.equal(projection.bound_pilot_evidence.quality_facts.resolved_claim_count, 152);
  assert.deepEqual(projection.proposed_execution, [{ control: 'SOURCE_BOUND' }]);
  assert.deepEqual(projection.release_gates, ['Every included source is admitted and verified.']);
  assert.equal(Object.hasOwn(projection, 'current_facts'), false);
});

test('fails closed on a production plan outside the sealed V4 shape', () => {
  const root = mkdtempSync(join(tmpdir(), 'm3-sol-audit-'));
  const files = fixture(root);
  const unsupportedPlan = writeJson(root, 'production-plan-v3.json', {
    schema_version: 'CANONICAL_V2_M3_PRODUCTION_EXTRACTION_PLAN/V3',
    status: 'PROPOSED_NOT_AUTHORISED',
    current_facts: { stale: true },
    proposed_execution: [{ control: 'SOURCE_BOUND' }],
    release_gates: [],
  });
  assert.throws(
    () => buildSealedM3FinalSolAuditInput({
      repo_root: root,
      commit_range: 'base..head',
      code_paths: ['lib/candidate-resolution.js'],
      final_review_packet_path: files.review,
      strict_review_input_path: files.strict,
      final_legal_finding_paths: [files.legalA, files.legalB],
      original_seven_fail_findings_path: files.sevenFails,
      cross_family_risk_audit_path: files.risk,
      production_plan_path: unsupportedPlan,
      git_diff: () => 'diff --git a/lib/candidate-resolution.js b/lib/candidate-resolution.js\n@@\n+repair',
    }),
    (error) => error instanceof M3FinalSolAdversarialAuditError
      && error.code === 'PRODUCTION_PLAN_SHAPE_UNSUPPORTED',
  );
});

test('accepts one sealed twelve-item final legal findings file', () => {
  const root = mkdtempSync(join(tmpdir(), 'm3-sol-audit-'));
  const files = fixture(root);
  const findings = [
    ...JSON.parse(readFileSync(files.legalA, 'utf8')).findings,
    ...JSON.parse(readFileSync(files.legalB, 'utf8')).findings,
  ];
  const body = {
    schema_version: 'M3_12_CALL_FINAL_PILOT_RE_REVIEW_FINDINGS/V2',
    final_review_packet_id: files.finalReviewPacketId,
    strict_independent_review_input_id: files.strictIndependentReviewInputId,
    findings: [
      ...findings,
    ],
  };
  const finalFindings = writeJson(root, 'legal-all.json', {
    ...body,
    independent_legal_review_findings_id: contentId(body.schema_version, body),
  });
  const input = build(root, null, [finalFindings]);
  assert.equal(input.audit_artifact_seals.final_independent_legal_findings.length, 1);
  assert.equal(input.audit_projection.final_independent_legal_findings.length, 12);
});

test('rejects sealed final findings that cover the same work items but bind a stale strict input', () => {
  const root = mkdtempSync(join(tmpdir(), 'm3-sol-audit-'));
  const files = fixture(root);
  const findings = [
    ...JSON.parse(readFileSync(files.legalA, 'utf8')).findings,
    ...JSON.parse(readFileSync(files.legalB, 'utf8')).findings,
  ];
  const staleBody = {
    schema_version: 'M3_12_CALL_FINAL_PILOT_RE_REVIEW_FINDINGS/V2',
    final_review_packet_id: files.finalReviewPacketId,
    strict_independent_review_input_id: 'stale-v5-strict-input-id',
    findings,
  };
  const staleFindings = writeJson(root, 'stale-v5-findings.json', {
    ...staleBody,
    independent_legal_review_findings_id: contentId(staleBody.schema_version, staleBody),
  });

  assert.throws(
    () => build(root, null, [staleFindings]),
    (error) => error instanceof M3FinalSolAdversarialAuditError
      && error.code === 'FINAL_FINDINGS_BINDING_MISMATCH',
  );
});

test('rejects sealed final findings that bind the strict input but a stale final packet', () => {
  const root = mkdtempSync(join(tmpdir(), 'm3-sol-audit-'));
  const files = fixture(root);
  const findings = [
    ...JSON.parse(readFileSync(files.legalA, 'utf8')).findings,
    ...JSON.parse(readFileSync(files.legalB, 'utf8')).findings,
  ];
  const staleBody = {
    schema_version: 'M3_12_CALL_FINAL_PILOT_RE_REVIEW_FINDINGS/V2',
    final_review_packet_id: 'stale-v5-packet-id',
    strict_independent_review_input_id: files.strictIndependentReviewInputId,
    findings,
  };
  const staleFindings = writeJson(root, 'stale-v5-packet-findings.json', {
    ...staleBody,
    independent_legal_review_findings_id: contentId(staleBody.schema_version, staleBody),
  });

  assert.throws(
    () => build(root, null, [staleFindings]),
    (error) => error instanceof M3FinalSolAdversarialAuditError
      && error.code === 'FINAL_FINDINGS_BINDING_MISMATCH',
  );
});

test('sealed input validation rejects a forged strict-input packet binding even after resealing', () => {
  const root = mkdtempSync(join(tmpdir(), 'm3-sol-audit-'));
  const input = build(root);
  const forged = structuredClone(input);
  forged.audit_projection.strict_independent_review_input.final_review_packet_id = 'stale-v5-packet-id';
  const body = { ...forged };
  delete body.audit_input_id;
  forged.audit_input_id = contentId(forged.schema_version, body);

  assert.throws(
    () => validateSealedM3FinalSolAuditInput(forged),
    (error) => error instanceof M3FinalSolAdversarialAuditError
      && error.code === 'AUDIT_REVIEW_BINDING_MISMATCH',
  );
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
  const plan = writeJson(root, 'plan-current.json', v4ProductionPlan({
    finalReviewPacketId: files.finalReviewPacketId,
    strictIndependentReviewInputId: files.strictIndependentReviewInputId,
    proposedExecution: executionControls,
  }));
  const input = buildSealedM3FinalSolAuditInput({
    repo_root: root,
    commit_range: 'base..head',
    code_paths: ['lib/candidate-resolution.js'],
    final_review_packet_path: files.review,
    strict_review_input_path: files.strict,
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
  const invalidPath = join(root, 'must-not-exist.invalid.json');
  const malformed = validProviderOutput();
  delete malformed.coverage.demo_truthfulness;
  const rawProviderOutput = JSON.stringify(malformed);
  await assert.rejects(
    runSealedM3FinalSolAdversarialAudit({
      input,
      output_path: outputPath,
      client_factory: () => ({ messages: { create: async () => ({ content: [{ text: rawProviderOutput }] }) } }),
    }),
    (error) => error instanceof M3FinalSolAdversarialAuditError && error.code === 'INVALID_PROVIDER_OUTPUT',
  );
  assert.equal(existsSync(outputPath), false);
  assert.equal(existsSync(invalidPath), true);
  const failureEvidence = JSON.parse(readFileSync(invalidPath, 'utf8'));
  assert.equal(failureEvidence.schema_version, 'M3_FINAL_SOL_ADVERSARIAL_AUDIT_FAILURE_EVIDENCE/V1');
  assert.equal(failureEvidence.failure_state, 'INVALID_PROVIDER_OUTPUT_NOT_A_VALID_AUDIT');
  assert.equal(failureEvidence.audit_input_id, input.audit_input_id);
  assert.deepEqual(failureEvidence.audit_model_profile, SOL_HIGH_PROFILE);
  assert.equal(failureEvidence.raw_provider_output, rawProviderOutput);
  assert.match(failureEvidence.raw_provider_output_sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(failureEvidence.validation_error, {
    code: 'INVALID_PROVIDER_OUTPUT',
    message: 'provider output coverage does not match the closed contract.',
  });
  const { failure_evidence_id: failureEvidenceId, ...failureEvidenceBody } = failureEvidence;
  assert.equal(
    failureEvidenceId,
    contentId('M3_FINAL_SOL_ADVERSARIAL_AUDIT_FAILURE_EVIDENCE/V1', failureEvidenceBody),
  );
});

test('preserves raw failure evidence when parsed findings use an unsupported topic slug', async () => {
  const root = mkdtempSync(join(tmpdir(), 'm3-sol-audit-'));
  const input = build(root);
  const outputPath = join(root, 'final-audit.json');
  const invalidPath = join(root, 'final-audit.invalid.json');
  const malformed = validProviderOutput();
  malformed.findings[0].topic = 'citation-integrity';
  const rawProviderOutput = JSON.stringify(malformed);

  await assert.rejects(
    runSealedM3FinalSolAdversarialAudit({
      input,
      output_path: outputPath,
      client_factory: () => ({ messages: { create: async () => ({ content: [{ text: rawProviderOutput }] }) } }),
    }),
    (error) => error instanceof M3FinalSolAdversarialAuditError
      && error.code === 'INVALID_PROVIDER_OUTPUT'
      && error.message === 'Provider findings are malformed or unsupported.',
  );

  assert.equal(existsSync(outputPath), false);
  const failureEvidence = JSON.parse(readFileSync(invalidPath, 'utf8'));
  assert.equal(failureEvidence.failure_state, 'INVALID_PROVIDER_OUTPUT_NOT_A_VALID_AUDIT');
  assert.equal(failureEvidence.raw_provider_output, rawProviderOutput);
  assert.deepEqual(failureEvidence.validation_error, {
    code: 'INVALID_PROVIDER_OUTPUT',
    message: 'Provider findings are malformed or unsupported.',
  });
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
      strict_review_input_path: files.strict,
      final_legal_finding_paths: [files.legalA, files.legalB],
      original_seven_fail_findings_path: join(root, 'seven-short.json'),
      cross_family_risk_audit_path: files.risk,
      production_plan_path: files.plan,
      git_diff: () => 'diff --git a/a b/a',
    }),
    (error) => error instanceof M3FinalSolAdversarialAuditError && error.code === 'INPUT_COVERAGE_MISSING',
  );
});
