#!/usr/bin/env node

import { resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function usage() {
  throw new Error(
    'Usage: node scripts/canonical-v2-m3-final-sol-adversarial-audit.mjs '
      + '--final-review-packet <path> --final-legal-findings <path> [--final-legal-findings <path>] '
      + '--original-seven-fail-findings <path> --cross-family-risk-audit <path> '
      + '--production-plan <path> --commit-range <base..head> --code-path <path> '
      + '[--code-path <path>] --output <path>',
  );
}

function parseArgs(argv) {
  const args = { finalLegalFindingPaths: [], codePaths: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--final-review-packet') args.finalReviewPacketPath = argv[++index] || null;
    else if (value === '--final-legal-findings') args.finalLegalFindingPaths.push(argv[++index] || null);
    else if (value === '--original-seven-fail-findings') args.originalSevenFailFindingsPath = argv[++index] || null;
    else if (value === '--cross-family-risk-audit') args.crossFamilyRiskAuditPath = argv[++index] || null;
    else if (value === '--production-plan') args.productionPlanPath = argv[++index] || null;
    else if (value === '--commit-range') args.commitRange = argv[++index] || null;
    else if (value === '--code-path') args.codePaths.push(argv[++index] || null);
    else if (value === '--output') args.outputPath = argv[++index] || null;
    else usage();
  }
  if (!args.finalReviewPacketPath || ![1, 2].includes(args.finalLegalFindingPaths.length) || args.finalLegalFindingPaths.some((value) => !value)
    || !args.originalSevenFailFindingsPath || !args.crossFamilyRiskAuditPath || !args.productionPlanPath
    || !args.commitRange || args.codePaths.length === 0 || args.codePaths.some((value) => !value) || !args.outputPath) usage();
  return args;
}

try {
  const args = parseArgs(process.argv.slice(2));
  const {
    buildSealedM3FinalSolAuditInput,
    runSealedM3FinalSolAdversarialAudit,
  } = require('../lib/canonical-v2/m3-final-sol-adversarial-audit');
  const input = buildSealedM3FinalSolAuditInput({
    repo_root: process.cwd(),
    commit_range: args.commitRange,
    code_paths: args.codePaths,
    final_review_packet_path: resolve(process.cwd(), args.finalReviewPacketPath),
    final_legal_finding_paths: args.finalLegalFindingPaths.map((pathname) => resolve(process.cwd(), pathname)),
    original_seven_fail_findings_path: resolve(process.cwd(), args.originalSevenFailFindingsPath),
    cross_family_risk_audit_path: resolve(process.cwd(), args.crossFamilyRiskAuditPath),
    production_plan_path: resolve(process.cwd(), args.productionPlanPath),
  });
  const output = await runSealedM3FinalSolAdversarialAudit({
    input,
    output_path: resolve(process.cwd(), args.outputPath),
  });
  process.stdout.write(`${JSON.stringify({ audit_output_id: output.audit_output_id, audit_input_id: output.audit_input_id })}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'final SOL adversarial audit failed'}\n`);
  process.exitCode = 1;
}
