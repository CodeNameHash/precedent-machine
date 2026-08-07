'use strict';

/**
 * tests/canonical-v2-live-extraction-run-call-timeout-wired.test.js
 *
 * Regression guard for Step 2D1 defect 1: `--call-timeout-ms` parsed into
 * `out.timeoutMs` at parseArgs() but never carried into the frozen config
 * `resolveRunConfig()` returns, so `config.timeoutMs` read at the
 * `runClaudeCli` call site was always `undefined` and every run silently
 * fell back to the hardcoded 600,000ms default -- regardless of the flag.
 * Proven live: `--call-timeout-ms 1200000` failed at 606,899ms.
 *
 * Two halves, because `runClaudeCli` itself (and the `makeMeasuredCliClient`
 * closure that calls it) are not exported -- they spawn a real `claude`
 * subprocess and exporting them purely for a mock-spawn test would widen
 * the script's surface for no product reason, the same tradeoff the
 * modiv-family-pins test already made about this same file:
 *
 *   1. A REAL functional test (dynamic `import()`, no mocking): parseArgs()
 *      -> resolveRunConfig() actually carries a --call-timeout-ms value
 *      through to `config.timeoutMs` on the frozen object.
 *   2. A source-text pin: the exact call site inside `makeMeasuredCliClient`
 *      passes `config.timeoutMs` into `runClaudeCli(...)`'s `timeoutMs`
 *      option. Combined with (1), this proves the parsed flag value is the
 *      same value `runClaudeCli` receives -- the flag reaches the client.
 *
 * main() is never invoked: `isMainModule` guards on `process.argv[1] ===`
 * the script's own path, which is false when the test runner imports it.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const RUNNER = path.join(__dirname, '..', 'scripts', 'canonical-v2-live-extraction-run.mjs');
const RUNNER_URL = `file://${RUNNER}`;

test('resolveRunConfig carries --call-timeout-ms through to config.timeoutMs', async () => {
  const mod = await import(RUNNER_URL);
  const args = mod.parseArgs([
    '--deal', 'modiv',
    '--family', 'TERMINATION_FEE',
    '--call-timeout-ms', '1200000',
    '--out-dir', '/tmp/does-not-need-to-exist-for-this-test',
  ]);
  assert.equal(args.timeoutMs, 1200000, 'parseArgs must still set out.timeoutMs from --call-timeout-ms');

  const config = mod.resolveRunConfig(args);
  assert.equal(
    config.timeoutMs,
    1200000,
    'resolveRunConfig must carry timeoutMs into the frozen config it returns -- this is the exact field '
      + 'that was silently dropped: parseArgs set it, resolveRunConfig discarded it, and every run fell '
      + 'back to the hardcoded 600,000ms default regardless of the flag',
  );
});

test('resolveRunConfig defaults config.timeoutMs to null when --call-timeout-ms is not given', async () => {
  const mod = await import(RUNNER_URL);
  const args = mod.parseArgs([
    '--deal', 'modiv',
    '--family', 'TERMINATION_FEE',
    '--out-dir', '/tmp/does-not-need-to-exist-for-this-test',
  ]);
  const config = mod.resolveRunConfig(args);
  assert.equal(config.timeoutMs, null, 'without the flag, config.timeoutMs must stay null (not undefined-by-omission)');
});

test('the frozen config object literal in resolveRunConfig assigns timeoutMs (source pin)', () => {
  const source = fs.readFileSync(RUNNER, 'utf8');
  const marker = 'return Object.freeze({';
  const start = source.indexOf(marker, source.indexOf('function resolveRunConfig'));
  assert.notEqual(start, -1, 'expected to find the frozen config return in resolveRunConfig');
  const end = source.indexOf('});', start);
  const literal = source.slice(start, end + '});'.length);
  assert.match(
    literal,
    /timeoutMs:\s*args\.timeoutMs\s*,/,
    'the frozen config literal must assign timeoutMs from args.timeoutMs -- this is the exact line that '
      + 'was missing before the fix',
  );
});

test('makeMeasuredCliClient passes config.timeoutMs into the runClaudeCli(...) call site (source pin)', () => {
  const source = fs.readFileSync(RUNNER, 'utf8');
  const clientStart = source.indexOf('function makeMeasuredCliClient');
  assert.notEqual(clientStart, -1, 'expected to find makeMeasuredCliClient');
  const callSite = source.slice(clientStart, source.indexOf('runClaudeCli(', clientStart) + 400);
  assert.match(
    callSite,
    /runClaudeCli\(prompt,\s*\{\s*model,\s*\.\.\.\(config\.timeoutMs \? \{ timeoutMs: config\.timeoutMs \} : \{\}\)\s*\}\)/,
    'runClaudeCli must be called with config.timeoutMs threaded through -- combined with the previous test '
      + 'proving config.timeoutMs now carries the parsed --call-timeout-ms value, this proves the flag '
      + 'reaches the client that owns the actual subprocess timeout',
  );
});
