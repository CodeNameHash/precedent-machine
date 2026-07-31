#!/usr/bin/env node
// Launches a canonical v2 staging runner with the transport credentials
// loaded from a local, uncommitted config file, so the invoking command
// needs no environment-variable prefix. The config file must contain
// {"supabase_access_token": "sbp_...", "supabase_shim_path": "/abs/path.cjs"}
// and must never be committed. The launcher only starts runners matching
// scripts/canonical-v2-staging-*.mjs in this repository.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const argv = process.argv.slice(2);
const separator = argv.indexOf('--');
const head = separator === -1 ? argv : argv.slice(0, separator);
const runnerArgs = separator === -1 ? [] : argv.slice(separator + 1);

function argValue(flag) {
  const index = head.indexOf(flag);
  if (index === -1 || index + 1 >= head.length) return null;
  return head[index + 1];
}

const configPath = argValue('--config');
const runnerName = argValue('--runner');
if (!configPath || !runnerName) {
  process.stderr.write(
    'Usage: node scripts/canonical-v2-staging-pilot-launcher.mjs '
    + '--config <config.json> --runner <canonical-v2-staging-*.mjs> -- <runner args>\n',
  );
  process.exit(2);
}
const runnerBase = basename(runnerName);
if (!/^canonical-v2-staging-[a-z0-9-]+\.mjs$/.test(runnerBase)) {
  process.stderr.write('Launcher only starts canonical-v2-staging-*.mjs runners.\n');
  process.exit(2);
}
const runnerPath = join(ROOT, 'scripts', runnerBase);
if (!existsSync(runnerPath)) {
  process.stderr.write(`Runner not found: ${runnerPath}\n`);
  process.exit(2);
}
let config;
try {
  config = JSON.parse(readFileSync(configPath, 'utf8'));
} catch {
  process.stderr.write(`Unreadable launcher config: ${configPath}\n`);
  process.exit(2);
}
const token = config.supabase_access_token;
const shim = config.supabase_shim_path;
if (typeof token !== 'string' || !token.startsWith('sbp_')
  || typeof shim !== 'string' || !existsSync(shim)) {
  process.stderr.write('Launcher config must supply supabase_access_token (sbp_...) and an existing supabase_shim_path.\n');
  process.exit(2);
}
const result = spawnSync(process.execPath, [runnerPath, ...runnerArgs], {
  cwd: ROOT,
  stdio: 'inherit',
  env: {
    ...process.env,
    SUPABASE_ACCESS_TOKEN: token,
    CANONICAL_V2_STAGING_SUPABASE_SHIM: shim,
  },
});
process.exit(result.status === null ? 1 : result.status);
