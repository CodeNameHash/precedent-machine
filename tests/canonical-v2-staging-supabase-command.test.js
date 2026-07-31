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
  delete process.env.CANONICAL_V2_STAGING_SUPABASE_SHIM;
  assert.deepStrictEqual(governedSupabaseCommand(), {
    command: 'supabase',
    prefixArgs: [],
  });
});

test('an empty override keeps the real CLI', async () => {
  const governedSupabaseCommand = await loadHelper();
  process.env.CANONICAL_V2_STAGING_SUPABASE_SHIM = '';
  try {
    assert.deepStrictEqual(governedSupabaseCommand(), {
      command: 'supabase',
      prefixArgs: [],
    });
  } finally {
    delete process.env.CANONICAL_V2_STAGING_SUPABASE_SHIM;
  }
});

test('a non-JavaScript or missing override fails closed', async () => {
  const governedSupabaseCommand = await loadHelper();
  const directory = mkdtempSync(join(tmpdir(), 'supabase-command-test-'));
  try {
    const binaryPath = join(directory, 'impostor.bin');
    writeFileSync(binaryPath, '#!/bin/sh\n', { mode: 0o600 });
    for (const candidate of [binaryPath, join(directory, 'absent.cjs')]) {
      process.env.CANONICAL_V2_STAGING_SUPABASE_SHIM = candidate;
      assert.throws(
        () => governedSupabaseCommand(),
        /must point at an existing JavaScript shim file/,
      );
    }
  } finally {
    delete process.env.CANONICAL_V2_STAGING_SUPABASE_SHIM;
    rmSync(directory, { recursive: true, force: true });
  }
});

test('a valid JavaScript override runs through the node executable', async () => {
  const governedSupabaseCommand = await loadHelper();
  const directory = mkdtempSync(join(tmpdir(), 'supabase-command-test-'));
  try {
    const shimPath = join(directory, 'transport.cjs');
    writeFileSync(shimPath, 'process.exit(0);\n', { mode: 0o600 });
    process.env.CANONICAL_V2_STAGING_SUPABASE_SHIM = shimPath;
    assert.deepStrictEqual(governedSupabaseCommand(), {
      command: process.execPath,
      prefixArgs: [shimPath],
    });
  } finally {
    delete process.env.CANONICAL_V2_STAGING_SUPABASE_SHIM;
    rmSync(directory, { recursive: true, force: true });
  }
});
