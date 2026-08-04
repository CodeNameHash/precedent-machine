'use strict';

const { execFileSync } = require('node:child_process');
const { readFileSync, writeFileSync } = require('node:fs');
const { relative, resolve, sep } = require('node:path');

const { canonicalJson, contentId, sha256Hex } = require('./canonical-bytes');
const { createCodexCliClient } = require('../llm-cli-client');

const M3_FINAL_SOL_AUDIT_INPUT_SCHEMA = 'M3_FINAL_SOL_ADVERSARIAL_AUDIT_INPUT/V1';
const M3_FINAL_SOL_AUDIT_OUTPUT_SCHEMA = 'M3_FINAL_SOL_ADVERSARIAL_AUDIT_OUTPUT/V1';
const AUDIT_TOPICS = Object.freeze([
  'false_positives',
  'false_negatives',
  'taxonomy_leakage',
  'citation_integrity',
  'resolver_overreach',
  'cross_family_lessons',
  'production_extraction_controls',
  'demo_truthfulness',
]);
const SOL_HIGH_PROFILE = Object.freeze({
  profile_id: 'SOL_HIGH',
  backend: 'CODEX_CLI_SUBSCRIPTION',
  model: 'gpt-5.6',
  reasoning_effort: 'high',
  call_count: 1,
});

class M3FinalSolAdversarialAuditError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'M3FinalSolAdversarialAuditError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new M3FinalSolAdversarialAuditError(code, message);
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}

function same(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('INVALID_INPUT', `${label} must be an object.`);
  return value;
}

function requireString(value, label) {
  if (typeof value !== 'string' || !value.trim() || value.trim() !== value) fail('INVALID_INPUT', `${label} must be a non-empty trimmed string.`);
  return value;
}

function requireExactKeys(value, expected, label, code = 'INVALID_PROVIDER_OUTPUT') {
  requireObject(value, label);
  if (!same(Object.keys(value).sort(), [...expected].sort())) {
    fail(code, `${label} does not match the closed contract.`);
  }
}

function readJsonArtifact(pathname, label, readFile = readFileSync) {
  let raw;
  try {
    raw = readFile(pathname, 'utf8');
  } catch (error) {
    fail('INPUT_ARTIFACT_UNAVAILABLE', `${label} is unavailable: ${pathname}`);
  }
  let value;
  try {
    value = JSON.parse(raw);
  } catch (error) {
    fail('INPUT_ARTIFACT_MALFORMED', `${label} is not valid JSON.`);
  }
  return Object.freeze({
    path: pathname,
    sha256: sha256Hex(Buffer.from(raw, 'utf8')),
    content: value,
  });
}

function requireFindings(artifact, expectedCount, label, requiredStatus = null) {
  if (!Array.isArray(artifact.content.findings) || artifact.content.findings.length !== expectedCount) {
    fail('INPUT_COVERAGE_MISSING', `${label} must contain exactly ${expectedCount} findings.`);
  }
  if (requiredStatus && artifact.content.findings.some((finding) => finding?.status !== requiredStatus)) {
    fail('INPUT_COVERAGE_MISSING', `${label} must contain only ${requiredStatus} findings.`);
  }
}

function requireFinalReviewPacket(artifact) {
  if (!Array.isArray(artifact.content.work_items) || artifact.content.work_items.length !== 12) {
    fail('INPUT_COVERAGE_MISSING', 'The final review packet must contain exactly 12 work items.');
  }
  if (new Set(artifact.content.work_items.map((item) => item?.work_item_id)).size !== 12) {
    fail('INPUT_COVERAGE_MISSING', 'The final review packet work items must be unique.');
  }
}

function normaliseCodePaths(repoRoot, codePaths) {
  if (!Array.isArray(codePaths) || codePaths.length === 0) {
    fail('CODE_DIFF_MISSING', 'At least one relevant code path is required.');
  }
  const result = codePaths.map((pathname) => {
    requireString(pathname, 'code path');
    const absolute = resolve(repoRoot, pathname);
    const local = relative(repoRoot, absolute);
    if (!local || local === '..' || local.startsWith(`..${sep}`)) {
      fail('CODE_DIFF_MISSING', 'Each relevant code path must stay inside the repository.');
    }
    return local;
  }).sort();
  if (new Set(result).size !== result.length) fail('CODE_DIFF_MISSING', 'Relevant code paths must be unique.');
  return result;
}

function requireCommitRange(value) {
  requireString(value, 'commit range');
  if (!value.includes('..') || /\s/.test(value)) fail('INVALID_COMMIT_RANGE', 'Commit range must be a non-empty git range.');
  return value;
}

function currentCodeDiff({ repoRoot, commitRange, codePaths, gitDiff }) {
  const runGitDiff = gitDiff || ((range, paths) => execFileSync(
    'git', ['diff', '--no-ext-diff', '--unified=80', range, '--', ...paths],
    { cwd: repoRoot, encoding: 'utf8' },
  ));
  let text;
  try {
    text = runGitDiff(commitRange, codePaths);
  } catch (error) {
    fail('CODE_DIFF_UNAVAILABLE', 'The requested consolidation diff could not be generated.');
  }
  if (typeof text !== 'string' || !text.trim()) fail('CODE_DIFF_MISSING', 'The requested relevant code diff is empty.');
  return Object.freeze({
    commit_range: commitRange,
    code_paths: codePaths,
    sha256: sha256Hex(Buffer.from(text, 'utf8')),
    text,
  });
}

function buildSealedM3FinalSolAuditInput(options = {}) {
  const repoRoot = resolve(options.repo_root || process.cwd());
  const commitRange = requireCommitRange(options.commit_range);
  const codePaths = normaliseCodePaths(repoRoot, options.code_paths);
  const finalReviewPacket = readJsonArtifact(options.final_review_packet_path, 'final review packet', options.read_file);
  const finalFindingArtifacts = (options.final_legal_finding_paths || []).map((pathname, index) => (
    readJsonArtifact(pathname, `final independent legal findings ${index + 1}`, options.read_file)
  ));
  if (finalFindingArtifacts.length !== 2) fail('INPUT_COVERAGE_MISSING', 'Exactly two final independent legal finding files are required.');
  const originalSevenFails = readJsonArtifact(options.original_seven_fail_findings_path, 'original seven-fail findings', options.read_file);
  const crossFamilyRiskAudit = readJsonArtifact(options.cross_family_risk_audit_path, 'cross-family risk audit', options.read_file);
  const productionPlan = readJsonArtifact(options.production_plan_path, 'production extraction plan', options.read_file);

  requireFinalReviewPacket(finalReviewPacket);
  finalFindingArtifacts.forEach((artifact, index) => requireFindings(artifact, 6, `final independent legal findings ${index + 1}`));
  requireFindings(originalSevenFails, 7, 'original seven-fail findings', 'FAIL');
  if (!Array.isArray(crossFamilyRiskAudit.content.family_control_audit)) fail('INPUT_COVERAGE_MISSING', 'Cross-family risk audit must contain family controls.');
  if (!Array.isArray(productionPlan.content.proposed_execution)) fail('INPUT_COVERAGE_MISSING', 'Production extraction plan must contain execution controls.');

  const codeDiff = currentCodeDiff({ repoRoot, commitRange, codePaths, gitDiff: options.git_diff });
  const body = {
    schema_version: M3_FINAL_SOL_AUDIT_INPUT_SCHEMA,
    audit_model_profile: SOL_HIGH_PROFILE,
    final_review_packet: finalReviewPacket,
    final_independent_legal_findings: finalFindingArtifacts,
    original_seven_fail_findings: originalSevenFails,
    cross_family_risk_audit: crossFamilyRiskAudit,
    production_extraction_plan: productionPlan,
    consolidation_code_diff: codeDiff,
    required_topics: AUDIT_TOPICS,
  };
  const sealed = freeze({
    ...body,
    audit_input_id: contentId(M3_FINAL_SOL_AUDIT_INPUT_SCHEMA, body),
  });
  validateSealedM3FinalSolAuditInput(sealed);
  return sealed;
}

function validateSealedM3FinalSolAuditInput(value) {
  requireExactKeys(value, [
    'schema_version', 'audit_model_profile', 'final_review_packet',
    'final_independent_legal_findings', 'original_seven_fail_findings',
    'cross_family_risk_audit', 'production_extraction_plan',
    'consolidation_code_diff', 'required_topics', 'audit_input_id',
  ], 'sealed audit input', 'INVALID_SEALED_INPUT');
  if (value.schema_version !== M3_FINAL_SOL_AUDIT_INPUT_SCHEMA || !same(value.audit_model_profile, SOL_HIGH_PROFILE)
    || !same(value.required_topics, AUDIT_TOPICS)) fail('INVALID_SEALED_INPUT', 'The sealed audit input contract has changed.');
  const { audit_input_id: auditInputId, ...body } = value;
  if (auditInputId !== contentId(M3_FINAL_SOL_AUDIT_INPUT_SCHEMA, body)) fail('INVALID_SEALED_INPUT', 'The sealed audit input identity does not match its contents.');
  return true;
}

function auditPrompt(input) {
  return [
    'You are the final adversarial legal and product audit. Use only the sealed input below.',
    'Return JSON only. Do not call tools. Do not change or omit any evidence.',
    'Assess each required topic independently: false positives, false negatives, taxonomy leakage, citation integrity, resolver overreach, cross-family lessons, production extraction controls, and demo truthfulness.',
    'Use this exact JSON schema:',
    '{"schema_version":"M3_FINAL_SOL_ADVERSARIAL_RESPONSE/V1","verdict":"PASS|AMEND|FAIL","findings":[{"finding_id":"string","topic":"one required topic","severity":"CRITICAL|HIGH|MEDIUM|LOW","finding":"string","evidence_refs":["input reference"]}],"coverage":{"false_positives":{"status":"COVERED","summary":"string"},"false_negatives":{"status":"COVERED","summary":"string"},"taxonomy_leakage":{"status":"COVERED","summary":"string"},"citation_integrity":{"status":"COVERED","summary":"string"},"resolver_overreach":{"status":"COVERED","summary":"string"},"cross_family_lessons":{"status":"COVERED","summary":"string"},"production_extraction_controls":{"status":"COVERED","summary":"string"},"demo_truthfulness":{"status":"COVERED","summary":"string"}}}',
    'Every required coverage key must be present, have status COVERED, and have a non-empty summary. Reject unsupported claims as findings rather than repairing them.',
    `SEALED_INPUT=${canonicalJson(input)}`,
  ].join('\n\n');
}

function validateProviderOutput(value) {
  requireExactKeys(value, ['schema_version', 'verdict', 'findings', 'coverage'], 'provider output');
  if (value.schema_version !== 'M3_FINAL_SOL_ADVERSARIAL_RESPONSE/V1'
    || !['PASS', 'AMEND', 'FAIL'].includes(value.verdict)
    || !Array.isArray(value.findings)) fail('INVALID_PROVIDER_OUTPUT', 'Provider output has an invalid verdict or findings array.');
  requireExactKeys(value.coverage, AUDIT_TOPICS, 'provider output coverage');
  for (const topic of AUDIT_TOPICS) {
    const coverage = value.coverage[topic];
    requireExactKeys(coverage, ['status', 'summary'], `coverage.${topic}`);
    if (coverage.status !== 'COVERED' || typeof coverage.summary !== 'string' || !coverage.summary.trim()) {
      fail('PROVIDER_COVERAGE_MISSING', `Provider output does not cover ${topic}.`);
    }
  }
  const ids = new Set();
  for (const finding of value.findings) {
    requireExactKeys(finding, ['finding_id', 'topic', 'severity', 'finding', 'evidence_refs'], 'provider finding');
    requireString(finding.finding_id, 'provider finding id');
    requireString(finding.finding, 'provider finding');
    if (ids.has(finding.finding_id) || !AUDIT_TOPICS.includes(finding.topic)
      || !['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(finding.severity)
      || !Array.isArray(finding.evidence_refs) || finding.evidence_refs.length === 0
      || finding.evidence_refs.some((reference) => typeof reference !== 'string' || !reference.trim())) {
      fail('INVALID_PROVIDER_OUTPUT', 'Provider findings are malformed or unsupported.');
    }
    ids.add(finding.finding_id);
  }
  return true;
}

function sealedOutput({ input, rawProviderOutput, parsedOutput }) {
  validateSealedM3FinalSolAuditInput(input);
  validateProviderOutput(parsedOutput);
  if (typeof rawProviderOutput !== 'string' || !rawProviderOutput.trim()) fail('INVALID_PROVIDER_OUTPUT', 'Provider output is empty.');
  const body = {
    schema_version: M3_FINAL_SOL_AUDIT_OUTPUT_SCHEMA,
    audit_input_id: input.audit_input_id,
    audit_model_profile: SOL_HIGH_PROFILE,
    raw_provider_output: rawProviderOutput,
    raw_provider_output_sha256: sha256Hex(Buffer.from(rawProviderOutput, 'utf8')),
    parsed_findings: parsedOutput,
  };
  const output = freeze({
    ...body,
    audit_output_id: contentId(M3_FINAL_SOL_AUDIT_OUTPUT_SCHEMA, body),
  });
  validateSealedM3FinalSolAuditOutput(output, input);
  return output;
}

function validateSealedM3FinalSolAuditOutput(value, input) {
  requireExactKeys(value, [
    'schema_version', 'audit_input_id', 'audit_model_profile', 'raw_provider_output',
    'raw_provider_output_sha256', 'parsed_findings', 'audit_output_id',
  ], 'sealed audit output', 'INVALID_SEALED_OUTPUT');
  if (value.schema_version !== M3_FINAL_SOL_AUDIT_OUTPUT_SCHEMA || !same(value.audit_model_profile, SOL_HIGH_PROFILE)) {
    fail('INVALID_SEALED_OUTPUT', 'The sealed audit output contract has changed.');
  }
  if (input && value.audit_input_id !== input.audit_input_id) fail('INVALID_SEALED_OUTPUT', 'The audit output is not bound to the sealed input.');
  if (value.raw_provider_output_sha256 !== sha256Hex(Buffer.from(value.raw_provider_output, 'utf8'))) {
    fail('INVALID_SEALED_OUTPUT', 'The raw provider output digest does not match.');
  }
  validateProviderOutput(value.parsed_findings);
  const { audit_output_id: auditOutputId, ...body } = value;
  if (auditOutputId !== contentId(M3_FINAL_SOL_AUDIT_OUTPUT_SCHEMA, body)) fail('INVALID_SEALED_OUTPUT', 'The sealed audit output identity does not match its contents.');
  return true;
}

function responseText(response) {
  const text = response?.content?.map((part) => part?.text || '').join('\n').trim();
  if (!text) fail('PROVIDER_OUTPUT_MISSING', 'The Codex CLI returned no output.');
  return text;
}

async function runSealedM3FinalSolAdversarialAudit({ input, output_path: outputPath, client_factory: clientFactory = createCodexCliClient }) {
  validateSealedM3FinalSolAuditInput(input);
  requireString(outputPath, 'output path');
  let calls = 0;
  const client = clientFactory({
    model: SOL_HIGH_PROFILE.model,
    reasoningEffort: SOL_HIGH_PROFILE.reasoning_effort,
    maxAttempts: 1,
    ephemeral: true,
    isolated: true,
  });
  if (!client?.messages?.create) fail('INVALID_PROVIDER_CLIENT', 'Codex CLI client is unavailable.');
  const response = await client.messages.create({
    model: SOL_HIGH_PROFILE.model,
    max_tokens: 12000,
    messages: [{ role: 'user', content: auditPrompt(input) }],
  }).then((value) => {
    calls += 1;
    return value;
  });
  if (calls !== SOL_HIGH_PROFILE.call_count) fail('MODEL_CALL_COUNT_MISMATCH', 'The final audit must make exactly one SOL_HIGH Codex CLI call.');
  const rawProviderOutput = responseText(response);
  let parsedOutput;
  try {
    parsedOutput = JSON.parse(rawProviderOutput);
  } catch (error) {
    fail('INVALID_PROVIDER_OUTPUT', 'The Codex CLI output is not valid JSON.');
  }
  const output = sealedOutput({ input, rawProviderOutput, parsedOutput });
  writeFileSync(outputPath, `${canonicalJson(output)}\n`, { encoding: 'utf8', flag: 'wx' });
  return output;
}

module.exports = {
  AUDIT_TOPICS,
  M3_FINAL_SOL_AUDIT_INPUT_SCHEMA,
  M3_FINAL_SOL_AUDIT_OUTPUT_SCHEMA,
  M3FinalSolAdversarialAuditError,
  SOL_HIGH_PROFILE,
  auditPrompt,
  buildSealedM3FinalSolAuditInput,
  runSealedM3FinalSolAdversarialAudit,
  validateSealedM3FinalSolAuditInput,
  validateSealedM3FinalSolAuditOutput,
  validateProviderOutput,
};
