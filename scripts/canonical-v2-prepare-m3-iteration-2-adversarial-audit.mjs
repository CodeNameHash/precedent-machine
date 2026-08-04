#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  buildIteration2AdversarialAuditInput,
  validateIteration2AdversarialAuditInput,
} = require('../lib/canonical-v2/native-producer/m3-iteration-2-adversarial-audit');

function usage() {
  throw new Error(
    'Usage: node scripts/canonical-v2-prepare-m3-iteration-2-adversarial-audit.mjs '
      + '--artifact-root <path> --pilot-baseline <commit> [--consolidation-head <commit>] [--out <relative-path>]',
  );
}

function parseArgs(argv) {
  const args = { consolidationHead: 'HEAD', out: 'iteration-2-review/sealed-adversarial-audit-input.json' };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--artifact-root') args.artifactRoot = argv[++index] || null;
    else if (value === '--pilot-baseline') args.pilotBaseline = argv[++index] || null;
    else if (value === '--consolidation-head') args.consolidationHead = argv[++index] || null;
    else if (value === '--out') args.out = argv[++index] || null;
    else usage();
  }
  if (!args.artifactRoot || !args.pilotBaseline || !args.consolidationHead || !args.out) usage();
  return args;
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function git(rootDir, args) {
  return execFileSync('git', ['-C', rootDir, ...args], { encoding: 'utf8' }).trim();
}

function resolveCommit(rootDir, value) {
  return git(rootDir, ['rev-parse', '--verify', `${value}^{commit}`]);
}

function loadConsolidationCommits(rootDir, baseline, head) {
  const ids = git(rootDir, ['rev-list', '--reverse', `${baseline}..${head}`]).split('\n').filter(Boolean);
  if (ids.length === 0) throw new Error('The consolidation range contains no commits.');
  return ids.map((commitId) => ({
    commit_id: commitId,
    subject: git(rootDir, ['show', '-s', '--format=%s', commitId]),
    changed_paths: git(rootDir, ['diff-tree', '--no-commit-id', '--name-only', '-r', commitId]).split('\n').filter(Boolean).sort(),
  }));
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function extractDecisionExcerpt(markdown) {
  const match = /^## (?:Decision|Deliverable)\b.*$/m.exec(markdown);
  if (!match) {
    const firstLine = markdown.indexOf('\n');
    const followOnDecision = markdown.slice(firstLine === -1 ? 0 : firstLine + 1).trim();
    if (!followOnDecision) throw new Error('A family-design document is empty.');
    return followOnDecision;
  }
  const start = match.index + match[0].length;
  const nextSection = markdown.indexOf('\n## ', start);
  const decisionText = markdown.slice(start, nextSection === -1 ? markdown.length : nextSection).trim();
  if (!decisionText) throw new Error('A family-design document has an empty Decision or Deliverable section.');
  const excerpt = decisionText.split(/\n\s*\n/).filter(Boolean).slice(0, 2).join('\n\n');
  const maxLength = 4000;
  if (excerpt.length <= maxLength) return excerpt;
  const boundary = Math.max(excerpt.lastIndexOf('\n', maxLength), excerpt.lastIndexOf(' ', maxLength));
  return `${excerpt.slice(0, boundary > 0 ? boundary : maxLength)}\n[Decision excerpt continues in the SHA-256-bound source document.]`;
}

function loadFamilyDesignDecisions(rootDir) {
  const directory = resolve(rootDir, 'docs/superpowers/specs');
  return readdirSync(directory)
    .filter((entry) => /family.*design\.md$/.test(entry))
    .sort()
    .map((entry) => {
      const absolutePath = resolve(directory, entry);
      const markdown = readFileSync(absolutePath, 'utf8');
      return {
        document_path: relative(rootDir, absolutePath),
        document_content_sha256: sha256(markdown),
        decision_excerpt: extractDecisionExcerpt(markdown),
      };
    });
}

function auditLiveExecution(execution) {
  return {
    schema_version: execution.schema_version,
    validation_receipt_id: execution.validation_receipt_id,
    semantic_manifest_id: execution.semantic_manifest_id,
    execution_plan_id: execution.execution_plan_id,
    contract_fingerprint: execution.contract_fingerprint,
    succeeded_count: execution.succeeded_count,
    failed_count: execution.failed_count,
    execution_result_id: execution.execution_result_id,
    work_results: execution.work_results.map((result) => ({
      schema_version: result.schema_version,
      work_item_id: result.work_item_id,
      source_id: result.source_id,
      family_id: result.family_id,
      profile_id: result.profile_id,
      status: result.status,
      failure_code: result.failure_code,
      failure_stage: result.failure_stage,
      run_receipt: result.run_receipt,
      resolution: result.resolution,
      work_result_id: result.work_result_id,
    })),
  };
}

function outputPath(artifactRoot, out) {
  const target = resolve(artifactRoot, out);
  if (!relative(artifactRoot, target) || relative(artifactRoot, target).startsWith('..')) {
    throw new Error('--out must be a file below --artifact-root.');
  }
  return target;
}

try {
  const args = parseArgs(process.argv.slice(2));
  const rootDir = process.cwd();
  const artifactRoot = resolve(rootDir, args.artifactRoot);
  if (!existsSync(artifactRoot)) throw new Error('--artifact-root must exist.');
  const pilotBaseline = resolveCommit(rootDir, args.pilotBaseline);
  const consolidationHead = resolveCommit(rootDir, args.consolidationHead);
  const liveExecutionPath = resolve(artifactRoot, 'iteration-2/execution-result.json');
  const liveExecutionSource = readFileSync(liveExecutionPath);
  const input = buildIteration2AdversarialAuditInput({
    pilot_baseline_commit: pilotBaseline,
    consolidation_commits: loadConsolidationCommits(rootDir, pilotBaseline, consolidationHead),
    first_pass_review_reports: [
      readJson(resolve(artifactRoot, 'final-output/independent-first-six-review-findings.json')),
      readJson(resolve(artifactRoot, 'final-output/independent-last-six-review-findings.json')),
    ],
    attempt_3: {
      plan: readJson(resolve(artifactRoot, 'iteration-2-preparation/attempt-3/sealed-rerun-plan.json')),
      quality_gate: readJson(resolve(artifactRoot, 'final-output/recomputed-full-gate.json')),
      acceptance_checklist_v2: readJson(resolve(artifactRoot, 'final-output/model-rerun-acceptance-checklist-v2.json')),
      revised_decision_vector_v3: readJson(resolve(artifactRoot, 'iteration-2-preparation/sealed-revised-decision-vector-v3.json')),
    },
    live_execution: auditLiveExecution(JSON.parse(liveExecutionSource.toString('utf8'))),
    live_execution_artifact: {
      artifact_path: 'iteration-2/execution-result.json',
      content_sha256: sha256(liveExecutionSource),
    },
    family_design_decisions: loadFamilyDesignDecisions(rootDir),
  });
  validateIteration2AdversarialAuditInput(input);
  const target = outputPath(artifactRoot, args.out);
  if (existsSync(target)) throw new Error('The adversarial-audit input path already exists and cannot be overwritten.');
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(input)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify({ adversarial_audit_input_id: input.adversarial_audit_input_id, output_path: target })}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'adversarial-audit preparation failed'}\n`);
  process.exitCode = 1;
}
