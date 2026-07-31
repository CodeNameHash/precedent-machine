'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { writeFileSync, mkdtempSync, rmSync } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');

async function loadHelper() {
  const mod = await import('../scripts/lib/canonical-v2-staging-runtime.mjs');
  return mod.governedSupabaseCommand;
}

test('default command is the real supabase CLI with no prefix', async () => {
  const governedSupabaseCommand = await loadHelper();
  assert.deepStrictEqual(governedSupabaseCommand(), {
    command: 'supabase',
    prefixArgs: [],
  });
  assert.deepStrictEqual(governedSupabaseCommand(null), {
    command: 'supabase',
    prefixArgs: [],
  });
  assert.deepStrictEqual(governedSupabaseCommand(''), {
    command: 'supabase',
    prefixArgs: [],
  });
});

test('a non-JavaScript or missing shim fails closed', async () => {
  const governedSupabaseCommand = await loadHelper();
  const directory = mkdtempSync(join(tmpdir(), 'supabase-command-test-'));
  try {
    const binaryPath = join(directory, 'impostor.bin');
    writeFileSync(binaryPath, '#!/bin/sh\n', { mode: 0o600 });
    for (const candidate of [binaryPath, join(directory, 'absent.cjs'), 42]) {
      assert.throws(
        () => governedSupabaseCommand(candidate),
        /must be an existing JavaScript file/,
      );
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('a valid JavaScript shim runs through the node executable', async () => {
  const governedSupabaseCommand = await loadHelper();
  const directory = mkdtempSync(join(tmpdir(), 'supabase-command-test-'));
  try {
    const shimPath = join(directory, 'transport.cjs');
    writeFileSync(shimPath, 'process.exit(0);\n', { mode: 0o600 });
    assert.deepStrictEqual(governedSupabaseCommand(shimPath), {
      command: process.execPath,
      prefixArgs: [shimPath],
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('a staging db url must target the isolated staging project', async () => {
  const mod = await import('../scripts/lib/canonical-v2-staging-runtime.mjs');
  const { governedStagingDbUrl } = mod;
  assert.strictEqual(governedStagingDbUrl(), null);
  assert.strictEqual(governedStagingDbUrl(null), null);
  assert.strictEqual(governedStagingDbUrl(''), null);
  const staging = 'postgresql://postgres:secret@db.sjumbznveyyiizhwvixj.supabase.co:5432/postgres';
  assert.strictEqual(governedStagingDbUrl(staging), staging);
  for (const bad of [
    'postgresql://postgres:secret@db.otherprojectref.supabase.co:5432/postgres',
    'https://sjumbznveyyiizhwvixj.supabase.co',
    42,
  ]) {
    assert.throws(
      () => governedStagingDbUrl(bad),
      /isolated staging project/,
    );
  }
});

test('the staging runtime source reads no environment variables', async () => {
  const { readFileSync } = require('node:fs');
  const source = readFileSync(
    join(__dirname, '..', 'scripts', 'lib', 'canonical-v2-staging-runtime.mjs'),
    'utf8',
  );
  assert.doesNotMatch(source, /process\.env/);
});
