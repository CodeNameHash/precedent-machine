const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parseArgs,
  hasLawFirms,
  hasAdvisorsV2,
  buildLawFirmLlmPrompt,
  fmtFirms,
} = require('../scripts/backfill-law-firms');

test('parseArgs: defaults to dry-run, job=law-firms, backend=claude, llm on', () => {
  const args = parseArgs(['node', 'scripts/backfill-law-firms.js']);
  assert.equal(args.apply, false);
  assert.equal(args.only, 'law-firms');
  assert.equal(args.backend, 'claude');
  assert.equal(args.llm, true);
  assert.equal(args.force, false);
});

test('parseArgs: --apply, --only advisors, --no-llm, --backend codex, --deal, --force', () => {
  const args = parseArgs(['node', 'x', '--apply', '--only', 'advisors', '--no-llm', '--backend', 'codex', '--deal', 'Catalent', '--force']);
  assert.equal(args.apply, true);
  assert.equal(args.only, 'advisors');
  assert.equal(args.llm, false);
  assert.equal(args.backend, 'codex');
  assert.equal(args.deal, 'Catalent');
  assert.equal(args.force, true);
});

test('parseArgs: rejects an unknown --only value', () => {
  const originalExit = process.exit;
  const originalError = console.error;
  let exitCode = null;
  process.exit = (code) => { exitCode = code; throw new Error('exit'); };
  console.error = () => {};
  try {
    assert.throws(() => parseArgs(['node', 'x', '--only', 'bogus']));
    assert.equal(exitCode, 1);
  } finally {
    process.exit = originalExit;
    console.error = originalError;
  }
});

test('hasLawFirms: true only when at least one side has a non-empty firm list', () => {
  assert.equal(hasLawFirms({ law_firms: { target: ['Cooley LLP'], acquirer: [] } }), true);
  assert.equal(hasLawFirms({ law_firms: { target: [], acquirer: [] } }), false);
  assert.equal(hasLawFirms({}), false);
  assert.equal(hasLawFirms(null), false);
});

test('hasAdvisorsV2: true only when buyer_firms or seller_firms is non-empty', () => {
  assert.equal(hasAdvisorsV2({ advisors_v2: { buyer_firms: ['Wachtell'], seller_firms: [] } }), true);
  assert.equal(hasAdvisorsV2({ advisors_v2: { buyer_firms: [], seller_firms: [] } }), false);
  assert.equal(hasAdvisorsV2({}), false);
});

test('buildLawFirmLlmPrompt embeds the deal names and notice text, and asks for the {acquirer_firms, target_firms} shape', () => {
  const prompt = buildLawFirmLlmPrompt({ acquirer: 'BuyerCo Inc.', target: 'TargetCo Inc.' }, 'if to Parent, to: BuyerCo Inc. with a copy to Paul, Weiss LLP');
  assert.match(prompt, /BuyerCo Inc\./);
  assert.match(prompt, /TargetCo Inc\./);
  assert.match(prompt, /"acquirer_firms"/);
  assert.match(prompt, /"target_firms"/);
  assert.match(prompt, /Paul, Weiss LLP/);
});

test('fmtFirms: joins with " + " or renders "(none)"', () => {
  assert.equal(fmtFirms(['Cooley LLP', 'Latham & Watkins LLP']), 'Cooley LLP + Latham & Watkins LLP');
  assert.equal(fmtFirms([]), '(none)');
  assert.equal(fmtFirms(null), '(none)');
});
