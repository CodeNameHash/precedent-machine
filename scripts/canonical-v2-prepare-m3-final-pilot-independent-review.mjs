#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function usage() { throw new Error('Usage: node scripts/canonical-v2-prepare-m3-final-pilot-independent-review.mjs --artifact-root <path> [--packet <relative-path>] [--out <relative-path>] [--exact-source-bytes]'); }
function parseArgs(argv) {
  const args = {
    packet: 'final-review/sealed-final-pilot-review-packet.json',
    out: 'final-review/sealed-strict-independent-legal-review-input.json',
    includeExactSourceBytes: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--artifact-root') args.artifactRoot = argv[++index] || null;
    else if (argv[index] === '--packet') args.packet = argv[++index] || null;
    else if (argv[index] === '--out') args.out = argv[++index] || null;
    else if (argv[index] === '--exact-source-bytes') args.includeExactSourceBytes = true;
    else usage();
  }
  if (!args.artifactRoot || !args.packet || !args.out) usage();
  return args;
}

try {
  const args = parseArgs(process.argv.slice(2));
  const artifactRoot = resolve(process.cwd(), args.artifactRoot);
  const target = resolve(artifactRoot, args.out);
  const relation = relative(artifactRoot, target);
  if (!relation || relation === '..' || relation.startsWith('../')) throw new Error('--out must be a file below --artifact-root.');
  if (existsSync(target)) throw new Error('The strict independent review input path already exists and cannot be overwritten.');
  const packetPath = resolve(artifactRoot, args.packet);
  const packetRelation = relative(artifactRoot, packetPath);
  if (!packetRelation || packetRelation === '..' || packetRelation.startsWith('../')) throw new Error('--packet must be a file below --artifact-root.');
  const packet = JSON.parse(readFileSync(packetPath, 'utf8'));
  const { buildFinalPilotStrictIndependentReviewInput } = require('../lib/canonical-v2/native-producer/m3-final-pilot-independent-review');
  let exactSourceBytesByDocumentHash = {};
  if (args.includeExactSourceBytes) {
    const { loadSourceForDiagnostic } = require('../lib/canonical-v2/native-producer/unified-runner-validate');
    const manifest = require('../tests/fixtures/canonical-v2/m3-12-call-pilot-manifest.json');
    exactSourceBytesByDocumentHash = Object.fromEntries(manifest.sources.map((source) => {
      const diagnostic = loadSourceForDiagnostic({ source, root_dir: process.cwd() });
      return [diagnostic.context.document_hash, diagnostic.context.canonical_text.text];
    }));
  }
  const result = buildFinalPilotStrictIndependentReviewInput({
    final_review_packet: packet,
    exact_source_bytes_by_document_hash: exactSourceBytesByDocumentHash,
  });
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(result)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify({ strict_independent_review_input_id: result.strict_independent_review_input_id, output_path: target, review_item_count: result.review_items.length, automatic_legal_passes: result.automatic_legal_passes })}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'strict independent review preparation failed'}\n`);
  process.exitCode = 1;
}
