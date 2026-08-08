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
  // The pin moved on 2026-08-08 and the reason matters. It used to require
  // the spread form `...(config.timeoutMs ? { timeoutMs } : {})`, whose
  // absent-flag branch fell through to runClaudeCli's own hardcoded
  // 600,000ms. That default became wrong the moment the output ceiling rose
  // to 128,000: a call permitted to emit 128,000 tokens can legitimately run
  // ~17.5 minutes at the measured 8.23ms/token, so a 10-minute timeout stops
  // guarding against a hung call and starts guaranteeing failure on the
  // largest honest ones. Skechers KEY_DEFINED_TERMS died at exactly
  // 600,000ms, then completed once the timeout followed the ceiling.
  //
  // What this still pins is the thing the original defect broke: the flag's
  // value reaches runClaudeCli. What it now ALSO pins is that the no-flag
  // branch is derived rather than hardcoded.
  assert.match(
    callSite,
    /runClaudeCli\(prompt,\s*\{[\s\S]*?timeoutMs:\s*config\.timeoutMs\s*\|\|\s*derivedCallTimeoutMs\(effectiveMaxOutputTokens\(\)\)/,
    'runClaudeCli must receive config.timeoutMs when the flag is given, and a timeout DERIVED from the '
      + 'output ceiling when it is not -- never runClaudeCli\'s own hardcoded default, which cannot know '
      + 'what ceiling the call was permitted',
  );
});

test('the derived call timeout scales with the output ceiling and clears it', () => {
  const source = fs.readFileSync(RUNNER, 'utf8');
  // The two numbers must move together. Read the constants from the source
  // rather than restating them here, so this test cannot drift from them.
  const ms = Number(/const MS_PER_OUTPUT_TOKEN = ([\d.]+);/.exec(source)[1]);
  const fixed = Number(/const CALL_FIXED_OVERHEAD_MS = (\d+);/.exec(source)[1]);
  const safety = Number(/const CALL_TIMEOUT_SAFETY = ([\d.]+);/.exec(source)[1]);
  const ceiling = Number(/const CLI_MAX_OUTPUT_TOKENS = (\d+);/.exec(source)[1]);
  const derived = Math.ceil((fixed + (ms * ceiling)) * safety);

  // The point of the whole change: the timeout must exceed the longest call
  // the ceiling permits, or the ceiling is unusable at its own limit.
  const longestPermittedCall = fixed + (ms * ceiling);
  assert.ok(
    derived > longestPermittedCall,
    `derived timeout ${derived}ms must exceed the ${longestPermittedCall}ms a ${ceiling}-token call can `
      + 'legitimately take, otherwise the largest honest calls time out by construction',
  );
  // And it must beat the old fixed default, which is what failed.
  assert.ok(derived > 600000, `derived timeout ${derived}ms must exceed the old hardcoded 600000ms default`);
});
