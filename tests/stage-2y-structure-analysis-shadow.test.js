'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { canonicalJson, contentId, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');

const ROOT = path.resolve(__dirname, '..');
const MIGRATION_ROOT = path.join(ROOT, 'evidence/canonical-v2/stage-2y-structure-migration');
const CONTROL_ROOT = path.join(MIGRATION_ROOT, 'control');
const POLICY_PATH = path.join(CONTROL_ROOT, 'analysis-policy.json');
const AUTHORITY_PATH = path.join(CONTROL_ROOT, 'm4-authority.json');
const REVIEW_PATH = path.join(
  MIGRATION_ROOT,
  'reviews/stage-2y-structure-m4-full-contract-sol-freeze.json',
);
const COHORT_PATH = path.join(CONTROL_ROOT, 'cohort-agreements.json');
const HEX_256 = /^[0-9a-f]{64}$/;
const COORDINATE_SYSTEM = 'UTF8_CANONICAL_TEXT_HALF_OPEN';
const POLICY_SHA256 = '2ac70b72546cb8acb8bb2e031368c7128e2ccad659c1cf1ec1fc6042b53c7927';
const POLICY_DIGEST = 'c4e0f233d7e247ebe348b811fa774d07a7618b8501859039b73cb4c931d014cd';
const AUTHORITY_SHA256 = 'adeb24bf047a5fb462a71b6b5a0994d3ca88bdfab48d66ce6f7a8d8a51b4bc0f';
const AUTHORITY_DIGEST = 'b97a2e78617813d4806fb755c841dabbb7b88c62a13fb37a43eb148057088f60';
const REVIEW_SHA256 = '40f4291e953c9d0abb2ee537a1169ba4e45769c0277c310b4cfe2f55e7f7b262';
const REVIEW_ID = '193a2cb061e0d382b4f1c9de633eeb279a89d36e1f95fee417ee4f0067b96b65';
const METSERA_AGREEMENT_ID = 'f783c4cdcaca4626c695d1c2c67924ccd8867eb066e16f17407ca64497ba778c';
const METSERA_FRAGMENT_REVISION_ID =
  '7490a23a2cc41cb78ce7260d45ae80a7795b2453bd2fe45672243a61107eddb9';

const SUPPLEMENTAL_EVIDENCE = Object.freeze([
  Object.freeze({
    run_identifier: 'concho-termination-fee-20260809-2xk-final',
    section_reference: '8.3',
    section_start: 277922,
    section_end: 288557,
    claim_revision_id: '39a979713ce9557d847e88f9467c0c7c90a99c84f29ccd103d748a7d2f47d01f',
    claim_occurrence_id: '5b6d48f4a3977d0f6afa262dcba5f02b27a7c2f6f6447be1933d537cb559c5a5',
    claim_evidence_id: 'f5c9d0b14aa628853345d794e90a3b2da41a68bfe189a71f2c3aa1070434e7a0',
    local_span: [8752, 8792],
    absolute_span: [286674, 286714],
    text_sha256: '199b9a43c81bc18507ae6cde1c26c271e22a123caafb3ade8626e61d26108c2a',
    text: 'shall be the sole and exclusive remedies',
  }),
  Object.freeze({
    run_identifier: 'metsera-termination-fee-20260809-2xk-final',
    section_reference: '8.02',
    section_start: 230820,
    section_end: 235430,
    claim_revision_id: '91266891bd60147ab952f2c0fcc95b3cec0302a92e7c4f8552bc370958794e1a',
    claim_occurrence_id: '11ae8dc1d7173e247f98df96ea90180a462b505ae1f69f37810d9c4ce6791825',
    claim_evidence_id: '4f48d480ac6a6db86004386f7fce7181f9832be233946d8bab6bd3d96a4a5ac9',
    local_span: [3596, 3642],
    absolute_span: [234416, 234462],
    text_sha256: '3ad5b7df844cc54d59e5c3454ebab17d15cfc8c51f8f2db7ef7b2e06a126087a',
    text: 'shall constitute the sole and exclusive remedy',
  }),
  Object.freeze({
    run_identifier: 'metsera-termination-fee-20260809-2xk-final',
    section_reference: '8.02',
    section_start: 230820,
    section_end: 235430,
    claim_revision_id: 'c25a1a5e57010ce48aa1cf4842dd5e16dde1ff12d2300c9e5f36426515277bfb',
    claim_occurrence_id: '1508c240c63b5cfe8d47286ab816f0d21446b0e628be02c16861cd2acef1e3ba',
    claim_evidence_id: '7342134f7308c4e41cbfed4062ed9c7b1b84f55028878c73a876b38851d4668b',
    local_span: [3393, 3398],
    absolute_span: [234213, 234218],
    text_sha256: 'f02b95ed0b00ce45335979782615d60879b99e788fa3b7b8fca1599589b88846',
    text: 'fraud',
  }),
  Object.freeze({
    run_identifier: 'metsera-termination-fee-20260809-2xk-final',
    section_reference: '8.02',
    section_start: 230820,
    section_end: 235430,
    claim_revision_id: 'ef2a54f704baf9b545d473d83778651c7fd0880919568596c88df4ca197b07ea',
    claim_occurrence_id: 'd92ebbb2c80eb3383d14625038eabf773e9f66da2aba430a6d7f124f6b8204e8',
    claim_evidence_id: '06f00bad298fa6e70170e4b8f4c94ac5c1f4f256d28ac5a4f284bab7f40d4538',
    local_span: [3406, 3448],
    absolute_span: [234226, 234268],
    text_sha256: '2a564a17d0e5da4aa2cf3840e7a5c5445086e42c1b84d74bf20db013a8e14b84',
    text: 'willful and material breach by the Company',
  }),
  Object.freeze({
    run_identifier: 'redhat-termination-fee-20260809-2xk-final',
    section_reference: '5.06',
    section_start: 192483,
    section_end: 197134,
    claim_revision_id: '435944b3668d19bdbdf47fa0d4d5e8f3935a358f190324805ee039e3417a5109',
    claim_occurrence_id: '75e23076f31965a1aa16184bb30d23617e19fc467bdc1fcc4fb8da5e48e4bba4',
    claim_evidence_id: 'ec9ba76476857f2dbb9ad8976a5f7f673b34ed1ebc295df513039b18b1beed1d',
    local_span: [2873, 3064],
    absolute_span: [195356, 195547],
    text_sha256: '0368ead84f55b879982cbc49582cbd13282c834e298b9fa6ac43dcfd07b63008',
    text: 'shall be the sole and exclusive monetary remedy available to the Parent, Sub and their respective affiliates with respect to this Agreement and the transactions contemplated by this Agreement',
  }),
  Object.freeze({
    run_identifier: 'redhat-termination-fee-20260809-2xk-final',
    section_reference: '5.06',
    section_start: 192483,
    section_end: 197134,
    claim_revision_id: 'd1289b03fd05dd9ceb51958a5b7de251b54ed160f828c73d8b68b3b90ca02390',
    claim_occurrence_id: 'afedb2655bdf2d48e51d8528c01d8f9e4735d103f4c69052e51ac62d292d2f2f',
    claim_evidence_id: '73911223f4e86c386985db902c484b5fe1dd173ab6c4c2c0f1024f0f8dd75d18',
    local_span: [3619, 3686],
    absolute_span: [196102, 196169],
    text_sha256: '31281844411aca97b7578d75e950179712e3c181a8797079a5e9826f5cb6e811',
    text: 'any pre-termination Willful Breach of this Agreement by the Company',
  }),
  Object.freeze({
    run_identifier: 'skechers-termination-fee-20260809-2xk-final',
    section_reference: '8.3',
    section_start: 341013,
    section_end: 350352,
    claim_revision_id: 'edc8a7555ff8e4032c035cdb3e8f609cc9c840823fe0082ab9e59f2e397074bb',
    claim_occurrence_id: '863e4e182f047c319ca6dc85d74ac250571ed1ab5cb28a4970fe1efe0b288081',
    claim_evidence_id: '1c9e5d4b0f4fc4964cfb1bd61ea5c5c5d4c1066182e951351386a2d5d9df06fd',
    local_span: [5605, 5660],
    absolute_span: [346618, 346673],
    text_sha256: 'dc0f61b1d7ad7daceda9c9f6bbd684c04db820ac703bc7d6c9bead8d1c7c2ce4',
    text: 'shall be the sole and exclusive monetary damages remedy',
  }),
  Object.freeze({
    run_identifier: 'topbuild-termination-fee-20260809-2xk-r1-final',
    section_reference: '6.5',
    section_start: 369416,
    section_end: 381113,
    claim_revision_id: '29262a05b21e5838ef525ed64033230ba1d90e32b189e1a0aff7c3f82996bea6',
    claim_occurrence_id: '99614b15f90fb4f3828c5f7f059d114d517deb8f345fc7334714451a14ae79ad',
    claim_evidence_id: '3e2bcfcffdb4daaab2c20d3b6b970f769aaf49e7bbe7a800b73f96627f0ef03a',
    local_span: [11223, 11320],
    absolute_span: [380639, 380736],
    text_sha256: 'b2f62c51d3d82519032ac11ac244a0b2e05bf26a843c25386dedbbad6615c4c4',
    text: 'shall be the sole and exclusive remedy of the non-terminating party and its respective Affiliates',
  }),
  Object.freeze({
    run_identifier: 'topbuild-termination-fee-20260809-2xk-r1-final',
    section_reference: '6.5',
    section_start: 369416,
    section_end: 381113,
    claim_revision_id: 'b12de5398596d1782ab7c350185daec0a538d1c4230d97b0b276c5feb0d9ddb2',
    claim_occurrence_id: 'd94aee47dde036cdb1d8f83358ea6f7b7697d20a8c4e38ed424c9d3e36f9bfb4',
    claim_evidence_id: '68128a7b16fd0fae381d350607788eeb1a18a211226ee7f250d362365cf25568',
    local_span: [11617, 11622],
    absolute_span: [381033, 381038],
    text_sha256: 'f02b95ed0b00ce45335979782615d60879b99e788fa3b7b8fca1599589b88846',
    text: 'fraud',
  }),
  Object.freeze({
    run_identifier: 'topbuild-termination-fee-20260809-2xk-r1-final',
    section_reference: '6.5',
    section_start: 369416,
    section_end: 381113,
    claim_revision_id: 'ff07c4253445e6dbce702a37965cde10e5351e05c1cd9e27a6e4ed9834173e1a',
    claim_occurrence_id: 'd4d2da0ba6cdc4c318975a6624b34a2cd79e9e4da5a59450b502d66e2aef946a',
    claim_evidence_id: 'f9f474b74aec55abb4d8c1832e2a2f6120968acf6c148774c1596eb119c29fce',
    local_span: [11630, 11675],
    absolute_span: [381046, 381091],
    text_sha256: '954cd60df6448a91845b1c99a1bbfd50205edf2e4413b988befed7364f486929',
    text: 'willful and material breach of this Agreement',
  }),
]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function absolute(relativePath) {
  return path.join(ROOT, relativePath);
}

function assertBinding(binding, label) {
  const bytes = fs.readFileSync(absolute(binding.path));
  assert.equal(bytes.length, binding.byte_length, `${label} byte length`);
  assert.equal(sha256Hex(bytes), binding.sha256, `${label} sha256`);
  return JSON.parse(bytes.toString('utf8'));
}

function without(value, key) {
  const copy = structuredClone(value);
  delete copy[key];
  return copy;
}

function assertExactKeys(value, expected, label) {
  assert.deepEqual(Object.keys(value).sort(), [...expected].sort(), label);
}

function assertContentIdentity(record, idField) {
  assert.match(record[idField], HEX_256);
  assert.equal(record[idField], contentId(record.schema_version, without(record, idField)));
}

function sourceBytes(index, span) {
  return Buffer.from(index.source_binding.canonical_text, 'utf8')
    .subarray(span.start_byte, span.end_byte);
}

function assertSourceSpan(index, span, label) {
  assert.equal(span.coordinate_system, COORDINATE_SYSTEM, `${label} coordinate system`);
  assert.ok(Number.isInteger(span.start_byte) && span.start_byte >= 0, `${label} start`);
  assert.ok(Number.isInteger(span.end_byte) && span.end_byte > span.start_byte, `${label} end`);
  assert.equal(sha256Hex(sourceBytes(index, span)), span.text_sha256, `${label} bytes`);
}

function findClaim(writeSet, claimOccurrenceId) {
  return (writeSet?.claims || []).find((claim) => claim.claim_occurrence_id === claimOccurrenceId);
}

function analysisTaskId(task) {
  return contentId('AGREEMENT_ANALYSIS_TASK/V1', {
    requested_scope: task.requested_scope,
    analysis_policy_binding: task.analysis_policy_binding,
    context_compilation_binding: task.context_compilation_binding,
    legacy_resolution_bindings: task.legacy_resolution_runs.map((run) => ({
      run_identifier: run.run_identifier,
      family: run.family,
      resolution_binding: run.resolution_binding,
      adapter_result_binding: run.adapter_result_binding,
      validation_binding: run.validation_binding,
    })),
    execution: task.execution,
  });
}

function buildAnalysisTask(input, policy, policyBinding) {
  const contextCompilation = assertBinding(
    input.context_compilation_binding,
    `${input.deal} context compilation`,
  );
  const legacyResolutionRuns = policy.input_contract.legacy_run_bindings
    .filter((binding) => binding.agreement_id === input.agreement_id)
    .map((binding) => ({
      run_identifier: binding.run_identifier,
      family: binding.family,
      resolution_binding: binding.resolution_binding,
      resolution: assertBinding(binding.resolution_binding, `${binding.run_identifier} resolution`),
      adapter_result_binding: binding.adapter_result_binding,
      adapter_result: assertBinding(
        binding.adapter_result_binding,
        `${binding.run_identifier} adapter result`,
      ),
      validation_binding: binding.validation_binding,
      validation: assertBinding(binding.validation_binding, `${binding.run_identifier} validation`),
    }));
  const body = {
    schema_version: 'AGREEMENT_ANALYSIS_TASK/V1',
    requested_scope: {
      scope_kind: 'AGREEMENT',
      agreement_id: input.agreement_id,
      root_node_occurrence_id: input.root_node_occurrence_id,
    },
    analysis_policy_binding: policyBinding,
    analysis_policy: policy,
    context_compilation_binding: input.context_compilation_binding,
    context_compilation: contextCompilation,
    legacy_resolution_runs: legacyResolutionRuns,
    execution: {
      mode: 'SHADOW_REPLAY',
      repository_mode: 'ROUND_TRIP_VERIFY',
      inference_adapter: 'NONE',
      model_calls_authorised: 0,
      phase_b_calls_authorised: 0,
    },
  };
  return {
    schema_version: body.schema_version,
    analysis_task_id: analysisTaskId(body),
    requested_scope: body.requested_scope,
    analysis_policy_binding: body.analysis_policy_binding,
    analysis_policy: body.analysis_policy,
    context_compilation_binding: body.context_compilation_binding,
    context_compilation: body.context_compilation,
    legacy_resolution_runs: body.legacy_resolution_runs,
    execution: body.execution,
  };
}

const analysisPolicy = readJson(POLICY_PATH);
const m4Authority = readJson(AUTHORITY_PATH);
const fullContractReview = readJson(REVIEW_PATH);
const cohort = readJson(COHORT_PATH);
const CURRENT_STATE_HASHES = Object.fromEntries(
  Object.values(m4Authority.current_state_bindings)
    .map((binding) => [binding.path, sha256Hex(fs.readFileSync(absolute(binding.path)))]),
);
const inputByAgreementId = new Map(
  analysisPolicy.input_contract.agreement_inputs.map((input) => [input.agreement_id, input]),
);
let compiledFixture;

function agreementAnalysisModule() {
  return require('../lib/canonical-v2/agreement-analysis');
}

function compileAllAnalyses() {
  if (compiledFixture) return compiledFixture;
  const module = agreementAnalysisModule();
  const analyses = [];
  const tasks = [];
  const deterministicBytes = new Map();
  for (const input of analysisPolicy.input_contract.agreement_inputs) {
    const agreementIndex = assertBinding(input.agreement_index_binding, `${input.deal} index`);
    const task = buildAnalysisTask(input, analysisPolicy, m4Authority.bindings.analysis_policy);
    const indexBytesBefore = canonicalJson(agreementIndex);
    const taskBytesBefore = canonicalJson(task);
    const first = module.analyseAgreement(agreementIndex, task);
    const second = module.analyseAgreement(agreementIndex, task);
    const firstBytes = canonicalJson(first);
    assert.equal(canonicalJson(second), firstBytes, `${input.deal} byte determinism`);
    assert.equal(canonicalJson(agreementIndex), indexBytesBefore, `${input.deal} index immutable`);
    assert.equal(canonicalJson(task), taskBytesBefore, `${input.deal} task immutable`);
    analyses.push(first);
    tasks.push(task);
    deterministicBytes.set(input.agreement_id, firstBytes);
  }
  compiledFixture = Object.freeze({
    analyses: Object.freeze(analyses),
    byAgreementId: new Map(analyses.map((analysis) => [analysis.agreement_id, analysis])),
    taskByAgreementId: new Map(tasks.map((task) => [task.requested_scope.agreement_id, task])),
    deterministicBytes,
  });
  return compiledFixture;
}

test('M4 controls close the exact predecessor, policy, review and current-state trust roots', () => {
  assert.equal(sha256Hex(fs.readFileSync(POLICY_PATH)), POLICY_SHA256);
  assert.equal(sha256Hex(fs.readFileSync(AUTHORITY_PATH)), AUTHORITY_SHA256);
  assert.equal(sha256Hex(fs.readFileSync(REVIEW_PATH)), REVIEW_SHA256);
  assert.equal(analysisPolicy.schema_version, 'STAGE_2Y_ANALYSIS_POLICY/V1');
  assert.equal(analysisPolicy.policy_version, 1);
  assert.equal(analysisPolicy.policy_digest, POLICY_DIGEST);
  assert.equal(
    sha256Hex(Buffer.from(canonicalJson(without(analysisPolicy, 'policy_digest')), 'utf8')),
    POLICY_DIGEST,
  );
  assert.equal(m4Authority.schema_version, 'STAGE_2Y_M4_AUTHORITY/V1');
  assert.equal(m4Authority.authority_state,
    'ACTIVE_FOR_SEVEN_AGREEMENT_SHADOW_AND_FINAL_M4_RECEIPT');
  assert.equal(m4Authority.authority_digest, AUTHORITY_DIGEST);
  assert.equal(
    sha256Hex(Buffer.from(canonicalJson(without(m4Authority, 'authority_digest')), 'utf8')),
    AUTHORITY_DIGEST,
  );
  assert.equal(fullContractReview.review_id, REVIEW_ID);
  assert.equal(fullContractReview.lifecycle_state, 'SEALED');
  assert.equal(fullContractReview.status, 'APPROVED');
  assert.equal(fullContractReview.verdict, 'PASS');
  assert.equal(analysisPolicy.full_contract_review_binding.sha256, REVIEW_SHA256);
  assert.equal(m4Authority.bindings.analysis_policy.sha256, POLICY_SHA256);
  assert.equal(m4Authority.bindings.analysis_policy.policy_digest, POLICY_DIGEST);
  assert.equal(m4Authority.bindings.m2_receipt.status, 'PASS');
  assert.equal(m4Authority.bindings.m3_receipt.status, 'PASS');
  assert.equal(m4Authority.bindings.m2_receipt.lifecycle_state, 'SEALED');
  assert.equal(m4Authority.bindings.m3_receipt.lifecycle_state, 'SEALED');
  assert.equal(analysisPolicy.hidden_defaults, false);
  assert.equal(analysisPolicy.effect, 'ADDITIVE_SHADOW_JSON_ONLY');
  assert.equal(analysisPolicy.input_contract.exact_agreement_count, 7);
  assert.equal(analysisPolicy.input_contract.legacy_run_bindings.length, 130);
  assert.deepEqual(
    analysisPolicy.input_contract.agreement_order,
    cohort.agreements.map((agreement) => agreement.agreement_id),
  );
  for (const predecessor of ['m2', 'm3']) {
    const binding = analysisPolicy.input_contract.predecessor_receipts[predecessor];
    const receipt = assertBinding(binding, `${predecessor} receipt`);
    assert.equal(receipt.stage, predecessor.toUpperCase());
    assert.equal(receipt.lifecycle_state, 'SEALED');
    assert.equal(receipt.status, 'PASS');
    assert.equal(receipt.output_set_digest, binding.output_set_digest);
  }
  for (const binding of Object.values(m4Authority.current_state_bindings)) {
    assert.equal(sha256Hex(fs.readFileSync(absolute(binding.path))), binding.sha256);
  }
});

test('the public analysis seam is exactly two arguments and one export', () => {
  const module = agreementAnalysisModule();
  assert.deepEqual(Object.keys(module), ['analyseAgreement']);
  assert.equal(module.analyseAgreement.length, 2);
  assert.equal(analysisPolicy.interface_contract.signature,
    'analyseAgreement(agreementIndex, analysisTask) -> AgreementAnalysis');
  assert.deepEqual(analysisPolicy.interface_contract.exports, ['analyseAgreement']);
  assert.equal(analysisPolicy.interface_contract.third_argument, false);
  assert.equal(analysisPolicy.interface_contract.additional_exports, false);
  assert.equal(analysisPolicy.interface_contract.pure, true);
  assert.equal(analysisPolicy.interface_contract.deterministic, true);
});

test('seven agreement analyses satisfy the closed schema, ordering and repository contract', () => {
  const { analyses, taskByAgreementId } = compileAllAnalyses();
  const members = analysisPolicy.output_contract.member_contract;
  assert.equal(analyses.length, 7);
  assert.deepEqual(analyses.map((analysis) => analysis.agreement_id),
    analysisPolicy.input_contract.agreement_order);
  for (const analysis of analyses) {
    const input = inputByAgreementId.get(analysis.agreement_id);
    const task = taskByAgreementId.get(analysis.agreement_id);
    assert.ok(input);
    assertExactKeys(task, analysisPolicy.analysis_task_contract.members,
      `${input.deal} task keys`);
    assertExactKeys(task.requested_scope,
      analysisPolicy.analysis_task_contract.requested_scope_members,
      `${input.deal} requested scope keys`);
    assertExactKeys(task.analysis_policy_binding,
      analysisPolicy.analysis_task_contract.analysis_policy_binding_members,
      `${input.deal} policy binding keys`);
    assertExactKeys(task.context_compilation_binding,
      analysisPolicy.analysis_task_contract.context_compilation_binding_members,
      `${input.deal} context binding keys`);
    assert.equal(task.analysis_task_id, analysisTaskId(task));
    assert.deepEqual(task.execution, analysisPolicy.analysis_task_contract.execution);
    for (const run of task.legacy_resolution_runs) {
      assertExactKeys(run, analysisPolicy.analysis_task_contract.legacy_run_members,
        `${run.run_identifier} task run keys`);
      for (const bindingName of [
        'resolution_binding',
        'adapter_result_binding',
        'validation_binding',
      ]) {
        assertExactKeys(run[bindingName],
          analysisPolicy.analysis_task_contract.legacy_file_binding_members,
          `${run.run_identifier} ${bindingName} keys`);
      }
    }
    assertExactKeys(analysis, members['AGREEMENT_ANALYSIS/V1'], `${input.deal} analysis keys`);
    assert.equal(analysis.schema_version, 'AGREEMENT_ANALYSIS/V1');
    assert.equal(analysis.coordinate_system, COORDINATE_SYSTEM);
    assertContentIdentity(analysis, 'agreement_analysis_id');
    assert.equal(analysis.agreement_index_binding.agreement_index_id, input.agreement_index_id);
    assert.equal(analysis.context_compilation_binding.context_compilation_id,
      input.context_compilation_id);
    assert.deepEqual(analysis.analysis_task_binding, {
      schema_version: 'AGREEMENT_ANALYSIS_TASK/V1',
      analysis_task_id: task.analysis_task_id,
    });
    assert.deepEqual(analysis.analysis_policy_binding, task.analysis_policy_binding);
    assert.deepEqual(analysis.requested_scope, {
      scope_kind: 'AGREEMENT',
      agreement_id: input.agreement_id,
      root_node_occurrence_id: input.root_node_occurrence_id,
    });
    assert.deepEqual(
      analysis.legacy_resolution_bindings.map((binding) => binding.run_identifier),
      input.run_identifiers,
    );
    assert.deepEqual(analysis.legacy_resolution_bindings,
      task.legacy_resolution_runs.map((run) => ({
        run_identifier: run.run_identifier,
        family: run.family,
        resolution_binding: run.resolution_binding,
        adapter_result_binding: run.adapter_result_binding,
        validation_binding: run.validation_binding,
      })));
    assert.equal(analysis.claims.length, input.expected_counts.analysis_claims);
    assert.equal(analysis.evidence_edges.length, input.expected_counts.analysis_evidence);
    for (const claim of analysis.claims) {
      assertExactKeys(claim, members['AGREEMENT_ANALYSIS_CLAIM/V1'], 'claim keys');
      assert.equal(claim.schema_version, 'AGREEMENT_ANALYSIS_CLAIM/V1');
      assert.match(claim.analysis_claim_id, HEX_256);
      assert.equal(claim.agreement_id, analysis.agreement_id);
      assertExactKeys(claim.stage_claim_revision_ids,
        analysisPolicy.identity_contract.stage_claim_revision_ids_members,
        'stage claim identity keys');
    }
    for (const edge of analysis.evidence_edges) {
      assertExactKeys(edge, members['AGREEMENT_ANALYSIS_EVIDENCE_EDGE/V1'], 'evidence keys');
      assert.equal(edge.schema_version, 'AGREEMENT_ANALYSIS_EVIDENCE_EDGE/V1');
      assert.equal(edge.analysis_evidence_edge_id,
        contentId('AGREEMENT_ANALYSIS_EVIDENCE_EDGE/V1', {
          analysis_claim_id: edge.analysis_claim_id,
          stage_evidence_ids: edge.stage_evidence_ids,
          evidence_role: edge.evidence_role,
          ordinal: edge.ordinal,
          source_node_occurrence_id: edge.source_node_occurrence_id,
          source_span: edge.source_span,
        }));
      assert.equal(edge.source_bytes_match, true);
      assertExactKeys(edge.stage_evidence_ids,
        analysisPolicy.evidence_rebasing_contract.stage_evidence_ids_members,
        'stage evidence identity keys');
    }
    for (const role of analysis.roles) {
      assertExactKeys(role, members['AGREEMENT_ANALYSIS_ROLE/V1'], 'role keys');
      assert.equal(role.schema_version, 'AGREEMENT_ANALYSIS_ROLE/V1');
      assert.match(role.role_id, HEX_256);
    }
    for (const provenance of analysis.role_provenance) {
      assertExactKeys(
        provenance,
        members['AGREEMENT_ANALYSIS_ROLE_PROVENANCE/V1'],
        'provenance keys',
      );
      assertContentIdentity(provenance, 'role_provenance_id');
    }
    for (const dependency of analysis.dependency_edges) {
      assertExactKeys(
        dependency,
        members['AGREEMENT_ANALYSIS_DEPENDENCY_EDGE/V1'],
        'dependency keys',
      );
      assertContentIdentity(dependency, 'dependency_edge_id');
    }
    for (const validation of analysis.proposition_validation_results) {
      assertExactKeys(
        validation,
        members['PROPOSITION_VALIDATION_RESULT/V1'],
        'validation keys',
      );
      assertContentIdentity(validation, 'validation_result_id');
    }
    assertExactKeys(
      analysis.repository_round_trip_proof,
      members['SHADOW_AGREEMENT_REPOSITORY_ROUND_TRIP_PROOF/V1'],
      'repository proof keys',
    );
    assertContentIdentity(
      analysis.repository_round_trip_proof,
      'repository_round_trip_proof_id',
    );
    assert.equal(analysis.repository_round_trip_proof.status, 'PASS');
    assert.equal(analysis.repository_round_trip_proof.field_loss_count, 0);
    assert.equal(
      analysis.repository_round_trip_proof.pre_round_trip_digest,
      analysis.repository_round_trip_proof.post_round_trip_digest,
    );
    assert.deepEqual(analysis.repository_round_trip_proof.record_counts, {
      claims: analysis.claims.length,
      roles: analysis.roles.length,
      role_provenance: analysis.role_provenance.length,
      evidence_edges: analysis.evidence_edges.length,
      dependency_edges: analysis.dependency_edges.length,
      proposition_validation_results: analysis.proposition_validation_results.length,
    });
    assert.deepEqual(analysis.diagnostics,
      analysisPolicy.output_contract.container_construction.diagnostics);
    assert.equal(analysis.claims.every((claim) =>
      canonicalJson(claim.diagnostic_codes)
        === canonicalJson(analysisPolicy.output_contract.container_construction
          .claim_diagnostic_codes)), true);
    const preservedIds = new Set(analysis.claims
      .filter((claim) => claim.identity_state === 'PRESERVED')
      .map((claim) => claim.analysis_claim_id));
    const expectedCounts = {
      legacy_resolution_run_count: analysis.legacy_resolution_bindings.length,
      legacy_claim_count: preservedIds.size,
      adapter_present_claim_count: analysis.claims.filter((claim) =>
        claim.identity_state === 'PRESERVED'
          && claim.stage_claim_revision_ids.write_set_claim_revision_id !== null).length,
      supplemental_claim_count: analysis.claims.filter((claim) =>
        claim.identity_state === 'PRESERVED'
          && claim.stage_claim_revision_ids.stage_identity_disposition
            === 'SUPPLEMENTAL_RESOLUTION_ONLY').length,
      analysis_claim_count: analysis.claims.length,
      pending_claim_count: analysis.claims.filter((claim) =>
        claim.proposition_validation_state === 'SCHEMA_APPROVAL_PENDING').length,
      complete_claim_count: analysis.claims.filter((claim) =>
        claim.proposition_validation_state === 'COMPLETE').length,
      legacy_evidence_count: analysis.evidence_edges.filter((edge) =>
        preservedIds.has(edge.analysis_claim_id)).length,
      analysis_evidence_count: analysis.evidence_edges.length,
      role_count: analysis.roles.length,
      role_provenance_count: analysis.role_provenance.length,
      dependency_edge_count: analysis.dependency_edges.length,
      baseline_validation_count: analysis.proposition_validation_results.filter((result) =>
        result.scenario === 'BASELINE').length,
      role_deletion_validation_count: analysis.proposition_validation_results.filter((result) =>
        result.scenario === 'ROLE_DELETION').length,
      alias_count: analysis.claim_aliases.length,
      equivalence_count: analysis.claim_equivalences.length,
      diagnostic_count: analysis.diagnostics.length,
    };
    assertExactKeys(analysis.counts,
      analysisPolicy.output_contract.container_construction.counts_members,
      `${input.deal} count keys`);
    assert.deepEqual(analysis.counts, expectedCounts);
    assert.equal(Object.isFrozen(analysis), true);
    for (const arrayName of analysisPolicy.repository_contract.round_trip_arrays) {
      assert.equal(Object.isFrozen(analysis[arrayName]), true, `${input.deal} ${arrayName} frozen`);
      assert.equal(analysis[arrayName].every(Object.isFrozen), true,
        `${input.deal} ${arrayName} records frozen`);
    }
    assert.deepEqual(analysis.claim_aliases, []);
    assert.deepEqual(analysis.claim_equivalences, []);
  }
  const aggregateCounts = analyses.reduce((total, analysis) => {
    for (const [key, value] of Object.entries(analysis.counts)) {
      total[key] = (total[key] || 0) + value;
    }
    return total;
  }, {});
  assert.deepEqual({
    agreement_count: analyses.length,
    legacy_run_count: aggregateCounts.legacy_resolution_run_count,
    legacy_claim_count: aggregateCounts.legacy_claim_count,
    analysis_claim_count: aggregateCounts.analysis_claim_count,
    pending_claim_count: aggregateCounts.pending_claim_count,
    complete_claim_count: aggregateCounts.complete_claim_count,
    legacy_evidence_count: aggregateCounts.legacy_evidence_count,
    analysis_evidence_count: aggregateCounts.analysis_evidence_count,
    role_count: aggregateCounts.role_count,
    role_provenance_count: aggregateCounts.role_provenance_count,
    baseline_validation_count: aggregateCounts.baseline_validation_count,
    role_deletion_validation_count: aggregateCounts.role_deletion_validation_count,
    alias_count: aggregateCounts.alias_count,
    equivalence_count: aggregateCounts.equivalence_count,
  }, Object.fromEntries(Object.entries(analysisPolicy.expected_metrics)
    .filter(([key]) => [
      'agreement_count',
      'legacy_run_count',
      'legacy_claim_count',
      'analysis_claim_count',
      'pending_claim_count',
      'complete_claim_count',
      'legacy_evidence_count',
      'analysis_evidence_count',
      'role_count',
      'role_provenance_count',
      'baseline_validation_count',
      'role_deletion_validation_count',
      'alias_count',
      'equivalence_count',
    ].includes(key))));
});

test('all 1,526 legacy identities and 1,602 evidence slices preserve the frozen bytes', () => {
  const { byAgreementId } = compileAllAnalyses();
  const supplementalByOccurrence = new Map(
    SUPPLEMENTAL_EVIDENCE.map((record) => [record.claim_occurrence_id, record]),
  );
  const observedSupplemental = new Set();
  const observedResolutionIds = new Set();
  const openWorldByFamily = Object.fromEntries(
    Object.keys(analysisPolicy.diff_contract.open_world.by_family).map((family) => [family, 0]),
  );
  let runCount = 0;
  let claimCount = 0;
  let evidenceCount = 0;
  let adapterPresentCount = 0;

  for (const input of analysisPolicy.input_contract.agreement_inputs) {
    const analysis = byAgreementId.get(input.agreement_id);
    const index = assertBinding(input.agreement_index_binding, `${input.deal} identity index`);
    const legacyByRevision = new Map(
      analysis.claims
        .filter((claim) => claim.identity_state === 'PRESERVED')
        .map((claim) => [claim.stage_claim_revision_ids.resolution_claim_revision_id, claim]),
    );
    assert.equal(legacyByRevision.size, input.expected_counts.legacy_claims);

    for (const runBinding of analysisPolicy.input_contract.legacy_run_bindings
      .filter((binding) => binding.agreement_id === input.agreement_id)) {
      runCount += 1;
      const resolution = assertBinding(runBinding.resolution_binding,
        `${runBinding.run_identifier} identity resolution`);
      const adapterResult = assertBinding(runBinding.adapter_result_binding,
        `${runBinding.run_identifier} identity adapter`);
      const validation = assertBinding(runBinding.validation_binding,
        `${runBinding.run_identifier} identity validation`);
      openWorldByFamily[runBinding.family] += (resolution.open_world || []).length;

      for (const entry of resolution.resolved || []) {
        const current = entry.claim;
        claimCount += 1;
        assert.equal(observedResolutionIds.has(current.claim_revision_id), false,
          `duplicate resolution revision ${current.claim_revision_id}`);
        observedResolutionIds.add(current.claim_revision_id);
        const claim = legacyByRevision.get(current.claim_revision_id);
        assert.ok(claim, `analysis claim for ${current.claim_revision_id}`);
        assert.equal(claim.analysis_claim_id, contentId('AGREEMENT_ANALYSIS_CLAIM/V1', {
          agreement_id: input.agreement_id,
          identity_state: 'PRESERVED',
          resolution_claim_revision_id: current.claim_revision_id,
        }));
        assert.equal(claim.claim_occurrence_id, current.claim_occurrence_id);
        assert.equal(claim.deal, input.deal);
        assert.equal(claim.family, runBinding.family);
        assert.equal(claim.source_run_identifier, runBinding.run_identifier);
        assert.equal(claim.section_reference, entry.section_reference);
        assert.equal(claim.claim_definition_key, current.claim_definition_key);
        assert.equal(claim.claim_definition_version, current.claim_definition_version);
        assert.equal(claim.complete_proposition_claim_revision_id, null);
        assert.equal(claim.identity_state, 'PRESERVED');
        assert.equal(claim.legacy_resolution_state, current.state);
        assert.equal(claim.proposition_validation_state, 'SCHEMA_APPROVAL_PENDING');
        assert.equal(claim.required_role_schema_id, null);
        assert.equal(claim.projection_eligibility, 'BLOCKED');
        assert.equal(claim.projection_block_reason, 'SCHEMA_APPROVAL_PENDING');
        assert.deepEqual(claim.legacy_claim_revision, current);
        const expectedLegacyParty = entry.party ?? entry.provision_instance.party ?? null;
        assert.deepEqual(claim.legacy_party, expectedLegacyParty);
        assert.equal(claim.legacy_capacity, expectedLegacyParty?.capacity ?? null);
        assert.equal(claim.complete_proposition, null);
        assert.equal(claim.stage_claim_revision_ids.proposal_claim_revision_id, null);
        assert.equal(claim.stage_claim_revision_ids.proposal_identity_state,
          'UNAVAILABLE_NO_SEALED_LINKAGE');
        assert.equal(claim.stage_claim_revision_ids.resolution_claim_revision_id,
          current.claim_revision_id);

        const adapterClaim = findClaim(adapterResult.write_set, current.claim_occurrence_id);
        const validationClaim = findClaim(validation.publishableWriteSet, current.claim_occurrence_id);
        const supplemental = supplementalByOccurrence.get(current.claim_occurrence_id);
        if (adapterClaim) {
          adapterPresentCount += 1;
          assert.ok(validationClaim);
          assert.equal(adapterClaim.claim_revision_id, validationClaim.claim_revision_id);
          assert.notEqual(current.claim_revision_id, adapterClaim.claim_revision_id);
          assert.equal(claim.stage_claim_revision_ids.write_set_claim_revision_id,
            adapterClaim.claim_revision_id);
          assert.equal(claim.stage_claim_revision_ids.validation_claim_revision_id,
            validationClaim.claim_revision_id);
          assert.equal(claim.stage_claim_revision_ids.stage_identity_disposition,
            'EVIDENCE_COORDINATE_REBASE_ONLY');
          assert.equal(claim.stage_claim_revision_ids.proposal_identity_reason,
            analysisPolicy.identity_contract.ordinary_proposal_reason);
          assert.deepEqual(claim.stage_claim_revision_ids.rebasing_provenance,
            analysisPolicy.evidence_rebasing_contract.adapter_present_rebasing_provenance);
        } else {
          assert.ok(supplemental, `sealed supplemental ${current.claim_occurrence_id}`);
          observedSupplemental.add(current.claim_occurrence_id);
          assert.equal(validationClaim, undefined);
          assert.equal(claim.stage_claim_revision_ids.write_set_claim_revision_id, null);
          assert.equal(claim.stage_claim_revision_ids.validation_claim_revision_id, null);
          assert.equal(claim.stage_claim_revision_ids.stage_identity_disposition,
            'SUPPLEMENTAL_RESOLUTION_ONLY');
          assert.equal(claim.stage_claim_revision_ids.proposal_identity_reason,
            analysisPolicy.identity_contract.supplemental_proposal_reason);
          assert.deepEqual(claim.stage_claim_revision_ids.rebasing_provenance,
            analysisPolicy.evidence_rebasing_contract.supplemental_rebasing_provenance);
        }

        const outputEdges = claim.evidence_edge_ids.map((id) =>
          analysis.evidence_edges.find((edge) => edge.analysis_evidence_edge_id === id));
        assert.equal(outputEdges.every(Boolean), true);
        assert.equal(outputEdges.length, current.evidence.length);
        for (const [ordinal, resolutionEvidence] of current.evidence.entries()) {
          evidenceCount += 1;
          const edge = outputEdges[ordinal];
          const expectedStart = entry.provision_instance.absolute_start
            + resolutionEvidence.absolute_start;
          const expectedEnd = entry.provision_instance.absolute_start
            + resolutionEvidence.absolute_end;
          assert.equal(edge.analysis_claim_id, claim.analysis_claim_id);
          assert.equal(edge.evidence_role, resolutionEvidence.evidence_role);
          assert.equal(edge.ordinal, resolutionEvidence.ordinal);
          assert.deepEqual([edge.source_span.start_byte, edge.source_span.end_byte],
            [expectedStart, expectedEnd]);
          assertSourceSpan(index, edge.source_span, current.claim_revision_id);
          assert.equal(edge.source_bytes_match, true);
          assert.equal(edge.stage_evidence_ids.proposal_claim_evidence_id, null);
          assert.equal(edge.stage_evidence_ids.resolution_claim_evidence_id,
            resolutionEvidence.claim_evidence_id);

          if (adapterClaim) {
            const adapterEvidence = adapterClaim.evidence.find((candidate) =>
              candidate.ordinal === resolutionEvidence.ordinal
                && candidate.evidence_role === resolutionEvidence.evidence_role);
            const validatedEvidence = validationClaim.evidence.find((candidate) =>
              candidate.ordinal === resolutionEvidence.ordinal
                && candidate.evidence_role === resolutionEvidence.evidence_role);
            assert.ok(adapterEvidence);
            assert.ok(validatedEvidence);
            assert.deepEqual([adapterEvidence.absolute_start, adapterEvidence.absolute_end],
              [expectedStart, expectedEnd]);
            assert.deepEqual(validatedEvidence, adapterEvidence);
            assert.equal(edge.stage_evidence_ids.write_set_claim_evidence_id,
              adapterEvidence.claim_evidence_id);
            assert.equal(edge.stage_evidence_ids.validation_claim_evidence_id,
              validatedEvidence.claim_evidence_id);
            const excerpt = adapterResult.write_set.excerpts.find((candidate) =>
              candidate.excerpt_id === adapterEvidence.excerpt_id);
            assert.ok(excerpt);
            assert.deepEqual([excerpt.absolute_start, excerpt.absolute_end],
              [expectedStart, expectedEnd]);
            assert.equal(excerpt.exact_bytes_digest, edge.source_span.text_sha256);
            assert.equal(excerpt.exact_text, sourceBytes(index, edge.source_span).toString('utf8'));
          } else {
            assert.equal(edge.stage_evidence_ids.write_set_claim_evidence_id, null);
            assert.equal(edge.stage_evidence_ids.validation_claim_evidence_id, null);
            assert.equal(entry.section_reference, supplemental.section_reference);
            assert.equal(entry.provision_instance.absolute_start, supplemental.section_start);
            assert.equal(entry.provision_instance.absolute_end, supplemental.section_end);
            assert.equal(resolutionEvidence.claim_evidence_id,
              supplemental.claim_evidence_id);
            assert.deepEqual(
              [resolutionEvidence.absolute_start, resolutionEvidence.absolute_end],
              supplemental.local_span,
            );
            assert.deepEqual([expectedStart, expectedEnd], supplemental.absolute_span);
            assert.equal(edge.source_span.text_sha256, supplemental.text_sha256);
            assert.equal(sourceBytes(index, edge.source_span).toString('utf8'), supplemental.text);
            assert.equal(current.raw_value, supplemental.text);
            assert.equal(
              (adapterResult.write_set.excerpts || []).some((excerpt) =>
                excerpt.excerpt_id === resolutionEvidence.excerpt_id),
              false,
            );
          }

          const node = index.nodes.find((candidate) =>
            candidate.node_occurrence_id === edge.source_node_occurrence_id);
          assert.ok(node, `evidence source node ${edge.source_node_occurrence_id}`);
          assert.ok(node.extent_span.start_byte <= edge.source_span.start_byte);
          assert.ok(node.extent_span.end_byte >= edge.source_span.end_byte);
        }
      }
    }
  }

  assert.equal(runCount, 130);
  assert.equal(claimCount, 1526);
  assert.equal(observedResolutionIds.size, 1526);
  assert.equal(adapterPresentCount, 1516);
  assert.equal(evidenceCount, 1602);
  assert.deepEqual([...observedSupplemental].sort(),
    SUPPLEMENTAL_EVIDENCE.map((record) => record.claim_occurrence_id).sort());
  assert.deepEqual(openWorldByFamily, analysisPolicy.diff_contract.open_world.by_family);
  assert.equal(Object.values(openWorldByFamily).reduce((sum, count) => sum + count, 0), 1701);
  assert.equal(analysisPolicy.diff_contract.open_world.positive_family_delta_count, 0);
});

test('Metsera 7.04 emits two complete branch propositions with all seven proven roles', () => {
  const analysis = compileAllAnalyses().byAgreementId.get(METSERA_AGREEMENT_ID);
  const input = inputByAgreementId.get(METSERA_AGREEMENT_ID);
  const index = assertBinding(input.agreement_index_binding, 'Metsera role index');
  const fixture = analysisPolicy.metsera_7_04_fixture;
  const requiredRoleSchema = analysisPolicy.required_role_schemas.find((schema) =>
    schema.required_role_schema_id === fixture.required_role_schema_id);
  assert.ok(requiredRoleSchema);
  const goldenClaims = analysis.claims.filter((claim) =>
    claim.identity_state === 'NEW_GOLDEN_PROPOSITION');
  assert.equal(goldenClaims.length, 2);
  assert.equal(analysis.roles.length, 14);
  assert.equal(analysis.role_provenance.length, 14);
  assert.equal(analysis.proposition_validation_results.length, 16);
  assert.deepEqual(analysis.claim_aliases, []);
  assert.deepEqual(analysis.claim_equivalences, []);

  for (const branch of fixture.branches) {
    const claim = goldenClaims.find((candidate) =>
      candidate.source_node_occurrence_ids.includes(branch.sentence_node_occurrence_id));
    assert.ok(claim, `golden branch ${branch.branch_key}`);
    assert.equal(claim.family, 'CLOSING_CONDITIONS');
    assert.equal(claim.section_reference, '7.04');
    assert.equal(claim.claim_definition_key, 'METSERA_7_04_FRUSTRATION_BRANCH');
    assert.equal(claim.claim_definition_version, 1);
    assert.equal(claim.identity_state, 'NEW_GOLDEN_PROPOSITION');
    assert.equal(claim.legacy_resolution_state, 'NO_LEGACY_COUNTERPART');
    assert.equal(claim.proposition_validation_state, 'COMPLETE');
    assert.equal(claim.required_role_schema_id, fixture.required_role_schema_id);
    assert.equal(claim.projection_eligibility, 'ELIGIBLE');
    assert.equal(claim.projection_block_reason, null);
    assert.deepEqual(claim.stage_claim_revision_ids, {
      ...analysisPolicy.identity_contract.new_golden_stage_values,
      rebasing_provenance:
        analysisPolicy.evidence_rebasing_contract.new_golden_rebasing_provenance,
    });
    assert.equal(claim.stage_claim_revision_ids.proposal_claim_revision_id, null);
    assert.equal(claim.stage_claim_revision_ids.resolution_claim_revision_id, null);
    assert.equal(claim.stage_claim_revision_ids.write_set_claim_revision_id, null);
    assert.equal(claim.stage_claim_revision_ids.validation_claim_revision_id, null);
    assert.equal(claim.stage_claim_revision_ids.stage_identity_disposition,
      'NO_LEGACY_COUNTERPART');
    assert.deepEqual(claim.source_node_occurrence_ids, branch.derived_from.source_node_occurrence_ids);
    const expectedOccurrenceId = contentId('COMPLETE_PROPOSITION_CLAIM_OCCURRENCE/V1', {
      agreement_id: METSERA_AGREEMENT_ID,
      claim_definition_key: fixture.claim_definition_key,
      section_node_occurrence_id: fixture.section_node_occurrence_id,
      sentence_node_occurrence_id: branch.sentence_node_occurrence_id,
      branch_ordinal: branch.branch_ordinal,
    });
    const orderedRoleSemanticPayloads = branch.roles.map((role) => ({
      role_key: role.role_key,
      role_type: role.role_type,
      normalised_value: role.normalised_value,
    }));
    const expectedRevisionId = contentId('COMPLETE_PROPOSITION_CLAIM_REVISION/V1', {
      claim_occurrence_id: expectedOccurrenceId,
      claim_definition_key: fixture.claim_definition_key,
      claim_definition_version: fixture.claim_definition_version,
      branch_ordinal: branch.branch_ordinal,
      ordered_role_semantic_payloads: orderedRoleSemanticPayloads,
    });
    assert.equal(claim.claim_occurrence_id, expectedOccurrenceId);
    assert.equal(claim.complete_proposition_claim_revision_id, expectedRevisionId);
    assert.equal(claim.analysis_claim_id, contentId('AGREEMENT_ANALYSIS_CLAIM/V1', {
      agreement_id: METSERA_AGREEMENT_ID,
      identity_state: 'NEW_GOLDEN_PROPOSITION',
      claim_occurrence_id: expectedOccurrenceId,
      complete_proposition_claim_revision_id: expectedRevisionId,
    }));
    assert.deepEqual(claim.complete_proposition, {
      branch_key: branch.branch_key,
      branch_ordinal: branch.branch_ordinal,
      ordered_role_semantic_payloads: orderedRoleSemanticPayloads,
    });

    const evidenceEdges = claim.evidence_edge_ids.map((id) =>
      analysis.evidence_edges.find((edge) => edge.analysis_evidence_edge_id === id));
    assert.equal(evidenceEdges.length, 1);
    assert.deepEqual(evidenceEdges[0].source_span, branch.sentence_span);
    assertSourceSpan(index, evidenceEdges[0].source_span, `${branch.branch_key} evidence`);
    assert.deepEqual(evidenceEdges[0].stage_evidence_ids, {
      proposal_claim_evidence_id: null,
      resolution_claim_evidence_id: null,
      write_set_claim_evidence_id: null,
      validation_claim_evidence_id: null,
    });
    assert.deepEqual(evidenceEdges[0].span_provenance, {
      mode: 'NO_LEGACY_COUNTERPART',
    });

    const roles = claim.role_ids.map((id) => analysis.roles.find((role) => role.role_id === id));
    assert.deepEqual(roles.map((role) => [role.ordinal, role.role_key, role.role_type]),
      branch.roles.map((role) => [role.ordinal, role.role_key, role.role_type]));
    for (const [ordinal, expectedRole] of branch.roles.entries()) {
      const role = roles[ordinal];
      assert.equal(role.analysis_claim_id, claim.analysis_claim_id);
      assert.equal(role.required_role_schema_id, fixture.required_role_schema_id);
      assert.equal(role.cardinality_state,
        requiredRoleSchema.required_roles[ordinal].cardinality);
      assert.equal(role.validation_state, 'SATISFIED');
      assert.deepEqual(role.normalised_value, expectedRole.normalised_value);
      assert.equal(role.role_id, contentId('AGREEMENT_ANALYSIS_ROLE/V1', {
        analysis_claim_id: claim.analysis_claim_id,
        required_role_schema_id: fixture.required_role_schema_id,
        role_key: expectedRole.role_key,
        role_type: expectedRole.role_type,
        ordinal: expectedRole.ordinal,
        normalised_value: expectedRole.normalised_value,
        source_spans: expectedRole.source_spans,
      }));
      assert.equal(role.provenance_ids.length, 1);
      const provenance = analysis.role_provenance.find((candidate) =>
        candidate.role_provenance_id === role.provenance_ids[0]);
      assert.ok(provenance);
      assert.equal(provenance.role_id, role.role_id);
      assert.equal(provenance.provenance_kind, expectedRole.provenance_kind);
      assert.equal(provenance.source_node_occurrence_id,
        expectedRole.source_node_occurrence_id);
      assert.deepEqual(provenance.source_spans, expectedRole.source_spans);
      assert.deepEqual(provenance.context_fact_ids, expectedRole.required_context_fact_ids);
      assert.deepEqual(provenance.scope_edge_ids, expectedRole.required_scope_edge_ids);
      assert.deepEqual(provenance.reference_edge_ids,
        expectedRole.required_reference_edge_ids);
      assert.deepEqual(provenance.definition_edge_ids, []);
      assert.deepEqual(provenance.semantic_relationship_ids, []);
      assert.equal(provenance.derivation_rule_id, fixture.fixture_id);
      assert.equal(provenance.derivation_rule_version, 1);
      const expectedDependencies = [
        ...expectedRole.required_context_fact_ids.map((id) => ['CONTEXT_FACT', id]),
        ...expectedRole.required_scope_edge_ids.map((id) => ['SCOPE_EDGE', id]),
        ...expectedRole.required_reference_edge_ids.map((id) => ['REFERENCE_EDGE', id]),
      ].sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right)));
      const roleDependencies = role.dependency_edge_ids.map((id) =>
        analysis.dependency_edges.find((dependency) => dependency.dependency_edge_id === id));
      assert.equal(roleDependencies.every(Boolean), true);
      assert.deepEqual(roleDependencies.map((dependency) =>
        [dependency.dependency_kind, dependency.target_id])
        .sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right))),
      expectedDependencies);
      assert.equal(roleDependencies.every((dependency) =>
        dependency.analysis_claim_id === claim.analysis_claim_id
          && dependency.role_id === role.role_id
          && dependency.dependency_use === 'REQUIRED_ROLE'
          && dependency.blocking === true), true);
      for (const [spanOrdinal, span] of provenance.source_spans.entries()) {
        assertSourceSpan(index, span, `${branch.branch_key}:${role.role_key}:${spanOrdinal}`);
      }
    }

    const baseline = analysis.proposition_validation_results.find((result) =>
      result.analysis_claim_id === claim.analysis_claim_id && result.scenario === 'BASELINE');
    assert.ok(baseline);
    assert.equal(baseline.removed_role_key, null);
    assert.equal(baseline.proposition_validation_state, 'COMPLETE');
    assert.deepEqual(baseline.missing_role_keys, []);
    assert.deepEqual(baseline.unresolved_role_keys, []);
    assert.equal(baseline.renderable, true);
    assert.equal(baseline.projection_eligible, true);
    assert.deepEqual(
      baseline.required_role_states.map((state) => [state.role_key, state.validation_state]),
      branch.roles.map((role) => [role.role_key, 'SATISFIED']),
    );

    const deletions = analysis.proposition_validation_results.filter((result) =>
      result.analysis_claim_id === claim.analysis_claim_id && result.scenario === 'ROLE_DELETION');
    assert.equal(deletions.length, 7);
    assert.deepEqual(deletions.map((result) => result.removed_role_key),
      branch.roles.map((role) => role.role_key));
    for (const [ordinal, deletion] of deletions.entries()) {
      const removed = branch.roles[ordinal].role_key;
      assert.equal(deletion.required_role_schema_id, fixture.required_role_schema_id);
      assert.equal(deletion.proposition_validation_state, 'MISSING_REQUIRED_ROLE');
      assert.deepEqual(deletion.missing_role_keys, [removed]);
      assert.deepEqual(deletion.unresolved_role_keys, []);
      assert.equal(deletion.renderable, false);
      assert.equal(deletion.projection_eligible, false);
      assert.equal(
        deletion.required_role_states.find((state) => state.role_key === removed)
          .validation_state,
        'MISSING',
      );
    }

    const branchDependencies = claim.dependency_edge_ids.map((id) =>
      analysis.dependency_edges.find((dependency) => dependency.dependency_edge_id === id));
    assert.equal(branchDependencies.every(Boolean), true);
    assert.deepEqual(branchDependencies
      .filter((dependency) => dependency.dependency_use === 'DERIVED_FROM'
        && dependency.dependency_kind === 'SOURCE_NODE')
      .map((dependency) => dependency.target_id),
    branch.derived_from.source_node_occurrence_ids);
    assert.deepEqual(branchDependencies
      .filter((dependency) => dependency.dependency_use === 'DERIVED_FROM'
        && dependency.dependency_kind === 'LEGACY_CLAIM_REVISION')
      .map((dependency) => dependency.target_id),
    branch.derived_from.legacy_claim_revision_ids);
    assert.deepEqual(branchDependencies
      .filter((dependency) => dependency.dependency_use === 'RELATED_NON_BLOCKING'
        && dependency.dependency_kind === 'DEFINITION_EDGE'
        && branch.related_non_blocking_definition_edge_ids.includes(dependency.target_id))
      .map((dependency) => dependency.target_id),
    branch.related_non_blocking_definition_edge_ids);
  }

  const fragment = analysis.claims.find((claim) =>
    claim.stage_claim_revision_ids.resolution_claim_revision_id === METSERA_FRAGMENT_REVISION_ID);
  assert.ok(fragment);
  assert.equal(fragment.proposition_validation_state, 'SCHEMA_APPROVAL_PENDING');
  assert.equal(fragment.projection_eligibility, 'BLOCKED');
  assert.equal(fragment.required_role_schema_id, null);
  assert.equal(analysis.claim_aliases.length, 0);
  assert.equal(analysis.claim_equivalences.length, 0);
  const companyBranch = goldenClaims.find((claim) =>
    claim.source_node_occurrence_ids.includes(fixture.branches[1].sentence_node_occurrence_id));
  const derivedFragment = companyBranch.dependency_edge_ids
    .map((id) => analysis.dependency_edges.find((edge) => edge.dependency_edge_id === id))
    .find((edge) => edge.dependency_kind === 'LEGACY_CLAIM_REVISION'
      && edge.dependency_use === 'DERIVED_FROM');
  assert.ok(derivedFragment);
  assert.equal(derivedFragment.target_id, METSERA_FRAGMENT_REVISION_ID);
  assert.equal(derivedFragment.target_state, fragment.legacy_resolution_state);
});

test('all non-golden claims remain approval-pending, blocked and non-renderable', () => {
  const { analyses } = compileAllAnalyses();
  const claims = analyses.flatMap((analysis) => analysis.claims);
  const legacy = claims.filter((claim) => claim.identity_state === 'PRESERVED');
  const golden = claims.filter((claim) => claim.identity_state === 'NEW_GOLDEN_PROPOSITION');
  assert.equal(claims.length, 1528);
  assert.equal(legacy.length, 1526);
  assert.equal(golden.length, 2);
  assert.equal(legacy.every((claim) =>
    claim.proposition_validation_state === 'SCHEMA_APPROVAL_PENDING'
      && claim.required_role_schema_id === null
      && claim.projection_eligibility === 'BLOCKED'
      && claim.projection_block_reason === 'SCHEMA_APPROVAL_PENDING'), true);
  assert.equal(golden.every((claim) =>
    claim.agreement_id === METSERA_AGREEMENT_ID
      && claim.proposition_validation_state === 'COMPLETE'
      && claim.projection_eligibility === 'ELIGIBLE'), true);
  const baselineResults = analyses.flatMap((analysis) =>
    analysis.proposition_validation_results.filter((result) => result.scenario === 'BASELINE'));
  assert.equal(baselineResults.length, 2);
  assert.equal(baselineResults.every((result) => result.renderable === true), true);
  assert.equal(analyses.flatMap((analysis) => analysis.proposition_validation_results)
    .filter((result) => result.renderable).length, 2);
  assert.equal(analyses.flatMap((analysis) => analysis.proposition_validation_results)
    .filter((result) => result.projection_eligible).length, 2);
});

test('every output link is same-agreement, non-dangling and source-ordered', () => {
  const { analyses } = compileAllAnalyses();
  for (const analysis of analyses) {
    const input = inputByAgreementId.get(analysis.agreement_id);
    const index = assertBinding(input.agreement_index_binding, `${input.deal} link index`);
    const context = assertBinding(input.context_compilation_binding, `${input.deal} link context`);
    const claimIds = new Set(analysis.claims.map((record) => record.analysis_claim_id));
    const evidenceIds = new Set(analysis.evidence_edges
      .map((record) => record.analysis_evidence_edge_id));
    const roleIds = new Set(analysis.roles.map((record) => record.role_id));
    const provenanceIds = new Set(analysis.role_provenance
      .map((record) => record.role_provenance_id));
    const dependencyIds = new Set(analysis.dependency_edges
      .map((record) => record.dependency_edge_id));
    const nodeIds = new Set(index.nodes.map((node) => node.node_occurrence_id));
    const contextTargets = {
      CONTEXT_FACT: new Set(context.context_facts.map((record) => record.context_fact_id)),
      SCOPE_EDGE: new Set(context.scope_edges.map((record) => record.scope_edge_id)),
      REFERENCE_EDGE: new Set(context.reference_edges.map((record) => record.reference_edge_id)),
      DEFINITION_EDGE: new Set(context.definition_edges.map((record) => record.definition_edge_id)),
      SEMANTIC_RELATIONSHIP: new Set(context.semantic_relationships
        .map((record) => record.semantic_relationship_id)),
      SOURCE_NODE: nodeIds,
      LEGACY_CLAIM_REVISION: new Set(analysis.claims
        .map((claim) => claim.stage_claim_revision_ids.resolution_claim_revision_id)
        .filter(Boolean)),
    };
    const claimOrder = new Map(analysis.claims.map((claim, ordinal) =>
      [claim.analysis_claim_id, ordinal]));
    const familyOrder = new Map(Object.keys(analysisPolicy.diff_contract.open_world.by_family)
      .map((family, ordinal) => [family, ordinal]));
    const evidenceById = new Map(analysis.evidence_edges.map((edge) =>
      [edge.analysis_evidence_edge_id, edge]));
    const claimMinimum = (claim) => {
      const spans = claim.evidence_edge_ids.map((id) => evidenceById.get(id).source_span);
      return {
        start: Math.min(...spans.map((span) => span.start_byte)),
        end: Math.min(...spans.map((span) => span.end_byte)),
      };
    };
    assert.deepEqual(analysis.claims.map((claim) => claim.analysis_claim_id),
      [...analysis.claims].sort((left, right) => {
        const leftMin = claimMinimum(left);
        const rightMin = claimMinimum(right);
        return leftMin.start - rightMin.start
          || leftMin.end - rightMin.end
          || familyOrder.get(left.family) - familyOrder.get(right.family)
          || left.claim_definition_key.localeCompare(right.claim_definition_key)
          || left.claim_definition_version - right.claim_definition_version
          || left.analysis_claim_id.localeCompare(right.analysis_claim_id);
      }).map((claim) => claim.analysis_claim_id));
    assert.deepEqual(analysis.evidence_edges.map((edge) => edge.analysis_evidence_edge_id),
      [...analysis.evidence_edges].sort((left, right) =>
        claimOrder.get(left.analysis_claim_id) - claimOrder.get(right.analysis_claim_id)
          || left.ordinal - right.ordinal
          || left.analysis_evidence_edge_id.localeCompare(right.analysis_evidence_edge_id))
        .map((edge) => edge.analysis_evidence_edge_id));
    assert.deepEqual(analysis.roles.map((role) => role.role_id),
      [...analysis.roles].sort((left, right) =>
        claimOrder.get(left.analysis_claim_id) - claimOrder.get(right.analysis_claim_id)
          || left.ordinal - right.ordinal
          || left.role_id.localeCompare(right.role_id)).map((role) => role.role_id));
    const roleOrder = new Map(analysis.roles.map((role, ordinal) => [role.role_id, ordinal]));
    assert.deepEqual(analysis.role_provenance.map((record) => record.role_provenance_id),
      [...analysis.role_provenance].sort((left, right) =>
        roleOrder.get(left.role_id) - roleOrder.get(right.role_id)
          || left.role_provenance_id.localeCompare(right.role_provenance_id))
        .map((record) => record.role_provenance_id));
    const dependencyKindOrder = new Map(analysisPolicy.state_vocabularies.dependency_kind
      .map((kind, ordinal) => [kind, ordinal]));
    assert.deepEqual(analysis.dependency_edges.map((edge) => edge.dependency_edge_id),
      [...analysis.dependency_edges].sort((left, right) => {
        const leftRole = left.role_id === null
          ? Number.MAX_SAFE_INTEGER : roleOrder.get(left.role_id);
        const rightRole = right.role_id === null
          ? Number.MAX_SAFE_INTEGER : roleOrder.get(right.role_id);
        return claimOrder.get(left.analysis_claim_id) - claimOrder.get(right.analysis_claim_id)
          || leftRole - rightRole
          || dependencyKindOrder.get(left.dependency_kind)
            - dependencyKindOrder.get(right.dependency_kind)
          || (left.source_spans[0]?.start_byte ?? Number.MAX_SAFE_INTEGER)
            - (right.source_spans[0]?.start_byte ?? Number.MAX_SAFE_INTEGER)
          || left.target_id.localeCompare(right.target_id)
          || left.dependency_edge_id.localeCompare(right.dependency_edge_id);
      }).map((edge) => edge.dependency_edge_id));
    const roleOrdinal = new Map(analysis.roles.map((role) => [role.role_key, role.ordinal]));
    assert.deepEqual(analysis.proposition_validation_results.map((result) =>
      result.validation_result_id), [...analysis.proposition_validation_results]
      .sort((left, right) =>
        claimOrder.get(left.analysis_claim_id) - claimOrder.get(right.analysis_claim_id)
          || (left.scenario === 'BASELINE' ? 0 : 1)
            - (right.scenario === 'BASELINE' ? 0 : 1)
          || (roleOrdinal.get(left.removed_role_key) ?? -1)
            - (roleOrdinal.get(right.removed_role_key) ?? -1)
          || left.validation_result_id.localeCompare(right.validation_result_id))
      .map((result) => result.validation_result_id));
    assert.equal(claimIds.size, analysis.claims.length);
    assert.equal(evidenceIds.size, analysis.evidence_edges.length);
    assert.equal(roleIds.size, analysis.roles.length);
    assert.equal(provenanceIds.size, analysis.role_provenance.length);
    assert.equal(dependencyIds.size, analysis.dependency_edges.length);
    for (const claim of analysis.claims) {
      assert.equal(claim.agreement_id, analysis.agreement_id);
      assert.equal(claim.source_node_occurrence_ids.every((id) => nodeIds.has(id)), true);
      assert.equal(claim.evidence_edge_ids.every((id) => evidenceIds.has(id)), true);
      assert.equal(claim.role_ids.every((id) => roleIds.has(id)), true);
      assert.equal(claim.dependency_edge_ids.every((id) => dependencyIds.has(id)), true);
    }
    for (const edge of analysis.evidence_edges) {
      assert.equal(claimIds.has(edge.analysis_claim_id), true);
      assert.equal(nodeIds.has(edge.source_node_occurrence_id), true);
    }
    for (const role of analysis.roles) {
      assert.equal(claimIds.has(role.analysis_claim_id), true);
      assert.equal(role.provenance_ids.every((id) => provenanceIds.has(id)), true);
      assert.equal(role.dependency_edge_ids.every((id) => dependencyIds.has(id)), true);
    }
    for (const provenance of analysis.role_provenance) {
      assert.equal(roleIds.has(provenance.role_id), true);
      assert.equal(nodeIds.has(provenance.source_node_occurrence_id), true);
      assert.equal(provenance.context_fact_ids.every((id) => contextTargets.CONTEXT_FACT.has(id)),
        true);
      assert.equal(provenance.scope_edge_ids.every((id) => contextTargets.SCOPE_EDGE.has(id)), true);
      assert.equal(provenance.reference_edge_ids.every((id) =>
        contextTargets.REFERENCE_EDGE.has(id)), true);
      assert.equal(provenance.definition_edge_ids.every((id) =>
        contextTargets.DEFINITION_EDGE.has(id)), true);
      assert.equal(provenance.semantic_relationship_ids.every((id) =>
        contextTargets.SEMANTIC_RELATIONSHIP.has(id)), true);
    }
    for (const dependency of analysis.dependency_edges) {
      assert.equal(claimIds.has(dependency.analysis_claim_id), true);
      assert.equal(dependency.role_id === null || roleIds.has(dependency.role_id), true);
      assert.equal(contextTargets[dependency.dependency_kind].has(dependency.target_id), true,
        `${input.deal} ${dependency.dependency_kind}:${dependency.target_id}`);
      assert.equal(dependency.source_node_occurrence_ids.every((id) => nodeIds.has(id)), true);
      dependency.source_spans.forEach((span, ordinal) =>
        assertSourceSpan(index, span,
          `${input.deal}:${dependency.dependency_edge_id}:${ordinal}`));
    }
    for (const claim of analysis.claims) {
      const spans = claim.evidence_edge_ids.map((id) =>
        analysis.evidence_edges.find((edge) => edge.analysis_evidence_edge_id === id).source_span);
      assert.deepEqual(spans, [...spans].sort((left, right) =>
        left.start_byte - right.start_byte || left.end_byte - right.end_byte));
    }
  }
});

test('analysis fails closed on stale, duplicate, missing and cross-agreement task inputs', () => {
  const { analyseAgreement } = agreementAnalysisModule();
  const conchoInput = analysisPolicy.input_contract.agreement_inputs[0];
  const metseraInput = inputByAgreementId.get(METSERA_AGREEMENT_ID);
  const conchoIndex = assertBinding(conchoInput.agreement_index_binding, 'fail-closed Concho index');
  const metseraIndex = assertBinding(metseraInput.agreement_index_binding,
    'fail-closed Metsera index');
  const task = buildAnalysisTask(
    conchoInput,
    analysisPolicy,
    m4Authority.bindings.analysis_policy,
  );
  const metseraTask = buildAnalysisTask(
    metseraInput,
    analysisPolicy,
    m4Authority.bindings.analysis_policy,
  );

  const withTaskId = (candidate) => {
    const unsigned = without(candidate, 'analysis_task_id');
    return {
      schema_version: unsigned.schema_version,
      analysis_task_id: analysisTaskId(unsigned),
      requested_scope: unsigned.requested_scope,
      analysis_policy_binding: unsigned.analysis_policy_binding,
      analysis_policy: unsigned.analysis_policy,
      context_compilation_binding: unsigned.context_compilation_binding,
      context_compilation: unsigned.context_compilation,
      legacy_resolution_runs: unsigned.legacy_resolution_runs,
      execution: unsigned.execution,
    };
  };
  const expectClosed = (operation) => assert.throws(operation, (error) => {
    assert.equal(typeof error?.code, 'string');
    assert.ok(error.code.length > 0);
    return true;
  });

  expectClosed(() => analyseAgreement(metseraIndex, task));
  expectClosed(() => analyseAgreement(conchoIndex, withTaskId({
    ...task,
    requested_scope: { ...task.requested_scope, agreement_id: METSERA_AGREEMENT_ID },
  })));
  expectClosed(() => analyseAgreement(conchoIndex, withTaskId({
    ...task,
    analysis_policy_binding: { ...task.analysis_policy_binding, policy_digest: '0'.repeat(64) },
  })));
  expectClosed(() => analyseAgreement(conchoIndex, withTaskId({
    ...task,
    legacy_resolution_runs: [...task.legacy_resolution_runs, task.legacy_resolution_runs[0]],
  })));
  expectClosed(() => analyseAgreement(conchoIndex, withTaskId({
    ...task,
    legacy_resolution_runs: task.legacy_resolution_runs.slice(1),
  })));
  expectClosed(() => analyseAgreement(conchoIndex, {
    ...task,
    analysis_task_id: '0'.repeat(64),
  }));
  const requiredContextFactId = analysisPolicy.metsera_7_04_fixture.branches[0].roles
    .flatMap((role) => role.required_context_fact_ids)[0];
  expectClosed(() => analyseAgreement(metseraIndex, {
    ...metseraTask,
    context_compilation: {
      ...metseraTask.context_compilation,
      context_facts: metseraTask.context_compilation.context_facts.filter((fact) =>
        fact.context_fact_id !== requiredContextFactId),
    },
  }));
  const firstRun = task.legacy_resolution_runs[0];
  expectClosed(() => analyseAgreement(conchoIndex, {
    ...task,
    legacy_resolution_runs: [{
      ...firstRun,
      resolution: {
        ...firstRun.resolution,
        resolved: firstRun.resolution.resolved.slice(1),
      },
    }, ...task.legacy_resolution_runs.slice(1)],
  }));
  expectClosed(() => analyseAgreement(conchoIndex, task, analysisPolicy));
});

test('analysis rejects every mutated raw object whose sealed binding is unchanged', () => {
  const { analyseAgreement } = agreementAnalysisModule();
  const input = analysisPolicy.input_contract.agreement_inputs[0];
  const index = assertBinding(input.agreement_index_binding, 'raw-bound Concho index');
  const task = buildAnalysisTask(input, analysisPolicy, m4Authority.bindings.analysis_policy);
  const expectRawMismatch = (operation) => assert.throws(operation, (error) => {
    assert.equal(error?.code, 'AGREEMENT_ANALYSIS_RAW_BOUND_OBJECT_MISMATCH');
    return true;
  });

  expectRawMismatch(() => analyseAgreement({
    ...index,
    counts: { ...index.counts, raw_binding_probe: true },
  }, task));
  expectRawMismatch(() => analyseAgreement(index, {
    ...task,
    context_compilation: {
      ...task.context_compilation,
      diagnostics: [...task.context_compilation.diagnostics, { raw_binding_probe: true }],
    },
  }));

  for (const member of ['resolution', 'adapter_result', 'validation']) {
    const firstRun = task.legacy_resolution_runs[0];
    expectRawMismatch(() => analyseAgreement(index, {
      ...task,
      legacy_resolution_runs: [{
        ...firstRun,
        [member]: { ...firstRun[member], raw_binding_probe: true },
      }, ...task.legacy_resolution_runs.slice(1)],
    }));
  }
});

test('analysis is inert and leaves every frozen current-state byte unchanged', () => {
  compileAllAnalyses();
  assert.deepEqual(
    Object.fromEntries(Object.keys(CURRENT_STATE_HASHES).map((relativePath) => [
      relativePath,
      sha256Hex(fs.readFileSync(absolute(relativePath))),
    ])),
    CURRENT_STATE_HASHES,
  );
  assert.deepEqual(m4Authority.zero_effect_expectations, {
    current_claims_unchanged: true,
    current_rows_unchanged: true,
    current_open_world_unchanged: true,
    current_extractors_unchanged: true,
    current_selectors_unchanged: true,
    pins_unchanged: true,
    baselines_unchanged: true,
    database_unchanged: true,
    product_data_unchanged: true,
    serving_unchanged: true,
    publication_unchanged: true,
    model_calls: 0,
    phase_b_route_calls: 0,
    network_calls: 0,
  });
  assert.equal(m4Authority.effect, 'ADDITIVE_SHADOW_MEMORY_AND_SEALED_JSON_ONLY');
  assert.equal(m4Authority.permitted_output.kind,
    'SEALED_ADDITIVE_SHADOW_AGREEMENT_ANALYSES_DIFF_AND_M4_RECEIPTS_ONLY');
});
