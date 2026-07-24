#!/usr/bin/env node

import { readFileSync, realpathSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const EXPECTED_STAGING_PROJECT_REF = 'sjumbznveyyiizhwvixj';
const EXPECTED_STAGING_PROJECT_NAME = 'deal-corpus-canonical-v2-staging';
const ALLOWED_ROOTS = Object.freeze([
  join(ROOT, 'sql', 'qxo-reverse-f4'),
  join(ROOT, 'supabase'),
]);
const MAX_SQL_FILE_BYTES = 1536 * 1024;
const MAX_SQL_PACKET_BYTES = 6 * 1024 * 1024;

function fail(message) {
  process.stderr.write(`${message instanceof Error ? message.message : message}\n`);
  process.exit(1);
}

function linkedProjectRef(workdir) {
  const refPath = join(workdir, 'supabase', '.temp', 'project-ref');
  const ref = readFileSync(refPath, 'utf8').trim();
  const metadata = JSON.parse(readFileSync(
    join(workdir, 'supabase', '.temp', 'linked-project.json'),
    'utf8',
  ));
  if (
    ref !== EXPECTED_STAGING_PROJECT_REF
    || metadata.ref !== EXPECTED_STAGING_PROJECT_REF
    || metadata.name !== EXPECTED_STAGING_PROJECT_NAME
  ) {
    throw new TypeError(
      `Refusing SQL execution: linked project is not ${EXPECTED_STAGING_PROJECT_NAME} (${EXPECTED_STAGING_PROJECT_REF}).`,
    );
  }
  return ref;
}

function allowedSqlPath(inputPath) {
  const path = realpathSync(resolve(inputPath));
  if (extname(path) !== '.sql' || !statSync(path).isFile()) {
    throw new TypeError(`SQL executor accepts regular .sql files only: ${inputPath}`);
  }
  const allowed = ALLOWED_ROOTS.some((root) => {
    const child = relative(realpathSync(root), path);
    return child !== '' && child !== '..' && !child.startsWith(`..${sep}`) && !child.startsWith(sep);
  });
  if (!allowed) {
    throw new TypeError(`SQL file is outside the governed staging packet roots: ${inputPath}`);
  }
  if (statSync(path).size > MAX_SQL_FILE_BYTES) {
    throw new TypeError(`SQL file exceeds the bounded staging transport limit: ${inputPath}`);
  }
  return path;
}

function main() {
  const [workdirInput, ...fileInputs] = process.argv.slice(2);
  if (!workdirInput || fileInputs.length < 1) {
    throw new TypeError(
      'Usage: node scripts/canonical-v2-staging-sql-executor.mjs <staging-workdir> <sql-file> [...sql-file]',
    );
  }
  const workdir = realpathSync(resolve(workdirInput));
  linkedProjectRef(workdir);
  const files = fileInputs.map(allowedSqlPath);
  const packetBytes = files.reduce((total, path) => total + statSync(path).size, 0);
  if (packetBytes > MAX_SQL_PACKET_BYTES) {
    throw new TypeError('SQL files exceed the bounded staging packet limit.');
  }
  for (const path of files) {
    linkedProjectRef(workdir);
    const result = spawnSync(
      'supabase',
      ['--workdir', workdir, 'db', 'query', '--linked', '--file', path],
      { stdio: 'inherit', shell: false },
    );
    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(`Staging SQL execution stopped after ${path} exited ${result.status}.`);
    }
  }
}

try {
  main();
} catch (error) {
  fail(error);
}
