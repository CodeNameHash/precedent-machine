#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { validateUnifiedRunManifest } = require('../lib/canonical-v2/native-producer/unified-runner-validate');

function usage() {
  throw new Error('Usage: node scripts/canonical-v2-native-unified-runner.mjs --mode=validate --manifest <path>');
}

function parseArgs(argv) {
  let mode = null;
  let manifestPath = null;
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value.startsWith('--mode=')) mode = value.slice('--mode='.length);
    else if (value === '--manifest') manifestPath = argv[++index] || null;
    else usage();
  }
  if (mode !== 'validate' || !manifestPath) usage();
  return { mode, manifestPath };
}

try {
  const { manifestPath } = parseArgs(process.argv.slice(2));
  const resolvedManifest = resolve(process.cwd(), manifestPath);
  const manifest = JSON.parse(readFileSync(resolvedManifest, 'utf8'));
  const result = validateUnifiedRunManifest({ manifest, root_dir: process.cwd() });
  process.stdout.write(`${JSON.stringify(result)}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'unified validation failed'}\n`);
  process.exitCode = 1;
}
