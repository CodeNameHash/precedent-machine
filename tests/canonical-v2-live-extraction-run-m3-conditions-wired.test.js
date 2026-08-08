'use strict';

/**
 * tests/canonical-v2-live-extraction-run-m3-conditions-wired.test.js
 *
 * Regression guard for docs/core/PLAN.md's blocking Stage 2 prerequisite
 * ("Wire Ben's two M3 auto-pass conditions before rung 1"). Before that
 * prerequisite was done, `scripts/canonical-v2-live-extraction-run.mjs`
 * supplied neither `v1v2_comparison` nor `lexical_disagreement` to its
 * `resolveCandidates(...)` call -- both grepped to zero occurrences in that
 * file, so every gate in Stage 2 reported green without evaluating either
 * condition. This test makes exactly that regression fail loudly: it never
 * again silently drops back to a resolve call that supplies neither.
 *
 * DELIBERATELY A SOURCE-TEXT ASSERTION, not a full resolveCandidates() run:
 * the prerequisite's own audit method was "both grep to zero occurrences in
 * that file" -- this test is the same check, pinned so it cannot regress
 * unnoticed. It targets specifically the resolveCandidates(...) call whose
 * result is stored in `resolution` and threaded into `resolution.json` /
 * `buildNativeWriteSet` -- the one the write path and evidence actually
 * consume -- not the earlier `plainResolution` pass the wiring is built
 * FROM (that pass deliberately supplies neither condition; it is the
 * pre-wiring input, not the evidence-producing call).
 *
 * Zero I/O beyond reading this one committed script file. No model calls,
 * no DB, no subprocess.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT_PATH = path.join(ROOT, 'scripts', 'canonical-v2-live-extraction-run.mjs');

function readScriptSource() {
  return fs.readFileSync(SCRIPT_PATH, 'utf8');
}

// Extracts the exact `const resolution = resolveCandidates({ ... });` call
// text -- the flat object literal this call site is written as (no nested
// braces), so a plain "up to the next `});`" slice is exact, not a
// brace-balancing approximation.
function extractFinalResolveCandidatesCall(source) {
  const marker = 'const resolution = resolveCandidates({';
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, 'expected to find "const resolution = resolveCandidates({" in the runner script');
  const end = source.indexOf('});', start);
  assert.notEqual(end, -1, 'expected a closing "});" for the resolveCandidates(...) call');
  return source.slice(start, end + '});'.length);
}

test('the runner script imports both M3 condition builders', () => {
  const source = readScriptSource();
  assert.match(
    source,
    /require\(['"]\.\.\/lib\/canonical-v2\/native-producer\/lexical-disagreement-net['"]\)/,
    'expected an import of lexical-disagreement-net.js',
  );
  assert.match(
    source,
    /require\(['"]\.\.\/lib\/canonical-v2\/native-producer\/v1v2-comparator['"]\)/,
    'expected an import of v1v2-comparator.js',
  );
});

test('the runner\'s evidence-producing resolveCandidates(...) call supplies both v1v2_comparison and lexical_disagreement', () => {
  const source = readScriptSource();
  const call = extractFinalResolveCandidatesCall(source);
  assert.match(call, /\bv1v2_comparison\s*:/, 'v1v2_comparison must be supplied at the resolveCandidates(...) call');
  assert.match(call, /\blexical_disagreement\s*:/, 'lexical_disagreement must be supplied at the resolveCandidates(...) call');
});

test('regression pin: the pre-prerequisite state (neither condition supplied) must not recur', () => {
  const source = readScriptSource();
  const call = extractFinalResolveCandidatesCall(source);
  // The exact failure this prerequisite exists to prevent: a call that
  // resolves candidates without EITHER condition, immediately followed by
  // the write/serve path, indistinguishable in its own evidence directory
  // from a rung that ran both conditions.
  const suppliesNeither = !/v1v2_comparison\s*:/.test(call) && !/lexical_disagreement\s*:/.test(call);
  assert.equal(suppliesNeither, false, 'the evidence-producing resolve call must never silently regress to supplying neither M3 condition');
});

test('run-manifest.json records whether each M3 condition was evaluated (structural pin)', () => {
  const source = readScriptSource();
  assert.match(
    source,
    /m3_auto_pass_conditions/,
    'run-manifest.json must record the M3 auto-pass condition outcomes, not leave them implicit in resolution.json alone',
  );
});
