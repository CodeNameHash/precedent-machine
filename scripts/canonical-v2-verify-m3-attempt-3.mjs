#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function usage() {
  throw new Error(
    'Usage: node scripts/canonical-v2-verify-m3-attempt-3.mjs '
      + '--review-packet-adapter <path> --review-findings <path> [--review-findings <path>] '
      + '--plan <path> --revised-vector <path> --live-manifest <path> --controls <path> '
      + '--ledger <path> --artifact-root <path>',
  );
}

function parseArgs(argv) {
  const args = { reviewFindingPaths: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--review-packet-adapter') args.reviewPacketAdapterPath = argv[++index] || null;
    else if (value === '--review-findings') args.reviewFindingPaths.push(argv[++index] || null);
    else if (value === '--plan') args.planPath = argv[++index] || null;
    else if (value === '--revised-vector') args.revisedVectorPath = argv[++index] || null;
    else if (value === '--live-manifest') args.liveManifestPath = argv[++index] || null;
    else if (value === '--controls') args.controlsPath = argv[++index] || null;
    else if (value === '--ledger') args.ledgerPath = argv[++index] || null;
    else if (value === '--artifact-root') args.artifactRoot = argv[++index] || null;
    else usage();
  }
  if (!args.reviewPacketAdapterPath || args.reviewFindingPaths.length === 0 || args.reviewFindingPaths.some((value) => !value)
    || !args.planPath || !args.revisedVectorPath || !args.liveManifestPath || !args.controlsPath
    || !args.ledgerPath || !args.artifactRoot) usage();
  return args;
}

function readJson(value) {
  return JSON.parse(readFileSync(resolve(process.cwd(), value), 'utf8'));
}

try {
  const args = parseArgs(process.argv.slice(2));
  const { verifyAttempt3Package } = require('../lib/canonical-v2/native-producer/m3-attempt-3-package-verifier');
  const findings = args.reviewFindingPaths.flatMap((value) => {
    const parsed = readJson(value);
    if (!Array.isArray(parsed.findings)) throw new Error('--review-findings files must contain findings arrays');
    return parsed.findings;
  });
  const result = verifyAttempt3Package({
    review_packet_adapter: readJson(args.reviewPacketAdapterPath),
    review_findings: findings,
    plan: readJson(args.planPath),
    revised_vector: readJson(args.revisedVectorPath),
    live_manifest: readJson(args.liveManifestPath),
    controls: readJson(args.controlsPath),
    ledger: readJson(args.ledgerPath),
    artifact_root: resolve(process.cwd(), args.artifactRoot),
    root_dir: process.cwd(),
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'attempt-3 verification failed'}\n`);
  process.exitCode = 1;
}
