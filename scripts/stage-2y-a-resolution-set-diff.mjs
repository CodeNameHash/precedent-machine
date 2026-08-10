#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildResolutionSetDiff } from './stage-2y-resolution-set-diff.mjs';

const require = createRequire(import.meta.url);
const { canonicalJson, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'evidence/canonical-v2/stage-2y-a-resolution-set-diff.json');
const digest = (value) => `sha256:${sha256Hex(Buffer.from(canonicalJson(value), 'utf8'))}`;

if (process.argv.length !== 3 || process.argv[2] !== '--write') throw new Error('USAGE: --write');
const comparison = await buildResolutionSetDiff({ phase: 'fixed' });
if (comparison.summary.replay_error_count !== 0) throw new Error(`REPLAY_ERRORS:${comparison.summary.replay_error_count}`);
if (comparison.summary.moved_previously_resolved_claim_count !== 0) {
  throw new Error(`PREVIOUSLY_RESOLVED_CLAIMS_MOVED:${comparison.summary.moved_previously_resolved_claim_count}`);
}
if (comparison.summary.open_world_rise_family_count !== 0) {
  throw new Error(`OPEN_WORLD_RISE:${comparison.summary.open_world_rise_family_count}`);
}
const {
  comparison_digest: _oldDigest,
  generation_command: _oldCommand,
  phase: _oldPhase,
  schema_version: _oldSchema,
  ...rest
} = comparison;
const body = {
  schema_version: 'STAGE_2Y_A_RESOLUTION_SET_DIFF/V1',
  generation_command: 'node scripts/stage-2y-a-resolution-set-diff.mjs --write',
  phase: 'PHASE_A_MATERIAL_CONTRACTS',
  ...rest,
};
const output = `${JSON.stringify({ ...body, comparison_digest: digest(body) }, null, 2)}\n`;
writeFileSync(OUT, output);
if (readFileSync(OUT, 'utf8') !== output) throw new Error('STALE_OUTPUT');
process.stdout.write(`${OUT}\n`);
