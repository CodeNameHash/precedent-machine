'use strict';

/**
 * tests/canonical-v2-general-extraction-runner.test.js
 *
 * Tests for the generalised
 * scripts/canonical-v2-modiv-termination-fee-scope-correction-run.mjs: any
 * registered section family, against any deal pinned in its own `DEAL_PINS`
 * table. NEVER invokes the script without `--dry-run` (or, for the pure
 * function tests, never reaches Step 3 / `createAnthropicProvider` at all)
 * -- this file makes zero model calls and spawns zero `claude` CLI
 * processes, by construction, so it is safe to run in CI and by any agent
 * forbidden from live model calls.
 *
 * Covers:
 *   1. The plain, only-`--out-dir`-given invocation resolves to exactly the
 *      same Modiv/TERMINATION_FEE defaults the script has always used
 *      (regression for "unchanged in shape and defaults"), and a real
 *      `--dry-run` of it reproduces the same section byte-offsets already
 *      pinned by tests/canonical-v2-modiv-termination-fee-scope-correction-
 *      replay.test.js's own EXPECTED_SECTION_BOUNDS.
 *   2. A different family (MAE_DEFINITION) on a different, real, committed
 *      deal (TopBuild) reaches the point of dispatch -- proved by a real
 *      `--dry-run` subprocess run, with zero model calls.
 *   3. An unpinned deal, an unregistered family, and a mismatched digest
 *      each fail loudly and separately, with distinguishable messages.
 *   4. TopBuild's pin in DEAL_PINS is corroborated against the committed
 *      tests/fixtures/canonical-v2/mae-definition-family/topbuild-intake-
 *      pin.json, not invented.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const SCRIPT_PATH = path.join(ROOT, 'scripts', 'canonical-v2-modiv-termination-fee-scope-correction-run.mjs');
const MODIV_RAW_HTML = path.join(ROOT, 'tests', 'fixtures', 'canonical-v2', 'mae-definition-family', 'modiv-raw-fetched.htm');
const TOPBUILD_RAW_HTML = path.join(ROOT, 'tests', 'fixtures', 'canonical-v2', 'mae-definition-family', 'topbuild-raw-fetched.htm');
const TOPBUILD_INTAKE_PIN = path.join(ROOT, 'tests', 'fixtures', 'canonical-v2', 'mae-definition-family', 'topbuild-intake-pin.json');

// Independently pinned in tests/canonical-v2-modiv-termination-fee-scope-
// correction-replay.test.js against the sectionizer's own resolution -- not
// re-derived here, cross-referenced so a regression in either file is
// visible in both.
const EXPECTED_MODIV_SECTION_BOUNDS = {
  '7.1': { start: 321761, end: 331500, heading: /Termination/i },
  '7.3': { start: 333615, end: 340109, heading: /Fees/i },
  '8.12': { start: 360030, end: 414712, heading: /Definitions/i },
};

let mod;
test.before(async () => {
  mod = await import(`file://${SCRIPT_PATH}`);
});

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'general-extraction-runner-'));
}

function runCliDryRun(extraArgs, options = {}) {
  const outDir = options.outDir || makeTempDir();
  const args = [SCRIPT_PATH, '--out-dir', outDir, '--dry-run', ...extraArgs];
  const stdout = execFileSync('node', args, { cwd: ROOT, encoding: 'utf8' });
  return { report: JSON.parse(stdout), outDir };
}

function expectCliFailure(extraArgs) {
  const outDir = makeTempDir();
  let caught = null;
  try {
    execFileSync('node', [SCRIPT_PATH, '--out-dir', outDir, '--dry-run', ...extraArgs], {
      cwd: ROOT, encoding: 'utf8', stdio: 'pipe',
    });
  } catch (error) {
    caught = error;
  }
  assert.ok(caught, `expected CLI failure for args ${JSON.stringify(extraArgs)}`);
  assert.equal(caught.status, 1);
  return caught.stderr.toString();
}

// ─────────────────────────────────────────────────────────────────────────
// 0. Grounding: the engine underneath really is family-generic, and the
// registry really does carry 25 families including the ones this file
// exercises. If this fails, everything below is testing a premise that
// does not hold.
// ─────────────────────────────────────────────────────────────────────────

test('grounding: the producer prompt registry carries 25 families including TERMINATION_FEE and MAE_DEFINITION', () => {
  const { listRegisteredSectionFamilies } = require('../lib/canonical-v2/native-producer/producer-prompt-registry');
  const families = listRegisteredSectionFamilies();
  assert.equal(families.length, 25);
  assert.ok(families.includes('TERMINATION_FEE'));
  assert.ok(families.includes('MAE_DEFINITION'));
  assert.ok(families.includes('MATERIAL_CONTRACTS'));
  assert.ok(families.includes('NO_SHOP'));
  assert.ok(families.includes('CLOSING_CONDITIONS'));
});

// ─────────────────────────────────────────────────────────────────────────
// 1. parseArgs -- pure, zero I/O.
// ─────────────────────────────────────────────────────────────────────────

test('parseArgs: bare --out-dir resolves to the Modiv/TERMINATION_FEE legacy defaults', () => {
  const args = mod.parseArgs(['--out-dir', '/tmp/whatever']);
  assert.equal(args.deal, mod.DEFAULT_DEAL);
  assert.equal(args.deal, 'modiv');
  assert.equal(args.family, mod.DEFAULT_FAMILY);
  assert.equal(args.family, 'TERMINATION_FEE');
  assert.equal(args.model, 'sonnet');
  // Default flipped to true on 2026-08-06 by the owner's decision, taken with
  // the cost in front of him: following citations takes this filing from three
  // model calls to fourteen, and without it a fee trigger stated as a bare
  // cross-reference cannot be named at all.
  assert.equal(args.followCitations, true);
  assert.equal(mod.parseArgs(['--out-dir', '/tmp/whatever', '--no-follow-citations']).followCitations, false);
  assert.equal(args.dryRun, false);
  assert.equal(args.sectionRefs, null);
  assert.equal(args.rawHtml, null);
  assert.equal(args.agreementDateGiven, false);
});

test('parseArgs: --out-dir is required unless --dry-run', () => {
  assert.throws(() => mod.parseArgs([]), /--out-dir is required/);
  assert.doesNotThrow(() => mod.parseArgs(['--dry-run']));
});

test('parseArgs: rejects an unrecognised flag', () => {
  assert.throws(() => mod.parseArgs(['--nonsense']), /unrecognised argument: --nonsense/);
});

test('parseArgs: --section-refs must name at least one reference', () => {
  assert.throws(() => mod.parseArgs(['--out-dir', 'x', '--section-refs', ' , ,']), /must name at least one section reference/);
});

test('parseArgs: --deal, --family, --section-refs, --agreement-date, --follow-citations all parse', () => {
  const args = mod.parseArgs([
    '--out-dir', 'x',
    '--deal', 'topbuild',
    '--family', 'MAE_DEFINITION',
    '--section-refs', '3.1(d)(iii), 3.2(d)',
    '--agreement-date', '2026-01-01',
    '--follow-citations',
  ]);
  assert.equal(args.deal, 'topbuild');
  assert.equal(args.family, 'MAE_DEFINITION');
  assert.deepEqual(args.sectionRefs, ['3.1(d)(iii)', '3.2(d)']);
  assert.equal(args.agreementDate, '2026-01-01');
  assert.equal(args.agreementDateGiven, true);
  assert.equal(args.followCitations, true);
});

// ─────────────────────────────────────────────────────────────────────────
// 2. resolveRunConfig -- pure, zero I/O. This is the acceptance-criterion-1
// regression pin: bare --out-dir must resolve to exactly the same
// configuration the script has always used for Modiv/TERMINATION_FEE.
// ─────────────────────────────────────────────────────────────────────────

test('resolveRunConfig: bare --out-dir resolves to the unchanged Modiv TERMINATION_FEE defaults', () => {
  const config = mod.resolveRunConfig(mod.parseArgs(['--out-dir', '/tmp/whatever']));
  assert.equal(config.deal, 'modiv');
  assert.equal(config.family, 'TERMINATION_FEE');
  assert.deepEqual(config.sectionRefs, ['7.1', '7.3', '8.12']);
  assert.equal(config.rawHtmlPath, 'tests/fixtures/canonical-v2/mae-definition-family/modiv-raw-fetched.htm');
  assert.equal(config.agreementDate, '2026-05-03');
  assert.equal(config.model, 'sonnet');
  assert.equal(config.followCitations, true);
  assert.equal(config.dealPin.raw_bytes_sha256, '659bcfaa017718ac735811861565fa2cd4e212657ba68e06ff1eab53e3729968');
  assert.equal(config.dealPin.canonical_text_sha256, '0ce6bc29354f702c637693b9d6b8eeb989ce58ee72ef5337a90feb851460339e');
});

test('resolveRunConfig: UNREGISTERED_FAMILY fails loudly and distinctly', () => {
  assert.throws(
    () => mod.resolveRunConfig(mod.parseArgs(['--out-dir', 'x', '--family', 'NOT_A_REAL_FAMILY'])),
    /UNREGISTERED_FAMILY: "NOT_A_REAL_FAMILY"/,
  );
});

test('resolveRunConfig: UNPINNED_DEAL fails loudly and distinctly', () => {
  assert.throws(
    () => mod.resolveRunConfig(mod.parseArgs(['--out-dir', 'x', '--deal', 'nonexistent-deal'])),
    /UNPINNED_DEAL: no committed pin for deal "nonexistent-deal"/,
  );
});

test('resolveRunConfig: a (deal, family) pair with no pinned default section refs requires --section-refs explicitly', () => {
  assert.throws(
    () => mod.resolveRunConfig(mod.parseArgs(['--out-dir', 'x', '--deal', 'topbuild', '--family', 'MAE_DEFINITION'])),
    /--section-refs is required for deal "topbuild" \+ family "MAE_DEFINITION"/,
  );
  // Once named explicitly, resolution succeeds.
  const config = mod.resolveRunConfig(mod.parseArgs([
    '--out-dir', 'x', '--deal', 'topbuild', '--family', 'MAE_DEFINITION', '--section-refs', '3.1(d)(iii)',
  ]));
  assert.deepEqual(config.sectionRefs, ['3.1(d)(iii)']);
  assert.equal(config.rawHtmlPath, 'tests/fixtures/canonical-v2/mae-definition-family/topbuild-raw-fetched.htm');
  assert.equal(config.agreementDate, null, 'topbuild has no pinned agreement_date and none was given');
});

test('resolveRunConfig: an explicit --agreement-date overrides the deal pin default', () => {
  const config = mod.resolveRunConfig(mod.parseArgs(['--out-dir', 'x', '--agreement-date', '1999-01-01']));
  assert.equal(config.agreementDate, '1999-01-01');
});

// ─────────────────────────────────────────────────────────────────────────
// 3. resolvePromptVersionInfo -- resolves the registry's OWN builder
// function per family, zero model calls (building a prompt string is not a
// model call). Proves the prompt-version reporting is no longer hard-wired
// to termination-fee-producer-prompt.js.
// ─────────────────────────────────────────────────────────────────────────

test('resolvePromptVersionInfo: TERMINATION_FEE and MAE_DEFINITION report distinct, real prompt ids/versions', () => {
  const termFee = mod.resolvePromptVersionInfo('TERMINATION_FEE');
  assert.equal(termFee.prompt_id, 'native-producer-termination-fee/v1');
  assert.equal(typeof termFee.prompt_version, 'number');

  const mae = mod.resolvePromptVersionInfo('MAE_DEFINITION');
  assert.equal(mae.prompt_id, 'mae-definition-producer/v2');
  assert.equal(typeof mae.prompt_version, 'number');

  assert.notEqual(termFee.prompt_id, mae.prompt_id);
});

test('resolvePromptVersionInfo: fails loudly for an unregistered family', () => {
  assert.throws(() => mod.resolvePromptVersionInfo('NOT_A_REAL_FAMILY'), /UNREGISTERED_FAMILY: "NOT_A_REAL_FAMILY"/);
});

test('resolvePromptVersionInfo: every registered family resolves a prompt_id/prompt_version with zero model calls', () => {
  const { listRegisteredSectionFamilies } = require('../lib/canonical-v2/native-producer/producer-prompt-registry');
  for (const family of listRegisteredSectionFamilies()) {
    const info = mod.resolvePromptVersionInfo(family);
    assert.equal(typeof info.prompt_id, 'string', family);
    assert.ok(info.prompt_id.length > 0, family);
    assert.notEqual(info.prompt_version, undefined, family);
  }
});

// ─────────────────────────────────────────────────────────────────────────
// 4. loadAndVerifySource -- real filesystem reads of the real committed
// fixtures, real hashing. Proves the raw-bytes/canonical-text digest check
// still refuses to run on a mismatch, now keyed per deal.
// ─────────────────────────────────────────────────────────────────────────

test('loadAndVerifySource: Modiv pin verifies clean against its own committed fixture', () => {
  const config = mod.resolveRunConfig(mod.parseArgs(['--out-dir', 'x']));
  const verified = mod.loadAndVerifySource({ dealPin: config.dealPin, deal: 'modiv', rawHtmlPath: config.rawHtmlPath });
  assert.equal(verified.rawBytesSha256, config.dealPin.raw_bytes_sha256);
  assert.equal(verified.conversion.canonical_text_sha256, config.dealPin.canonical_text_sha256);
  assert.equal(verified.verification.verification_status, 'PASS');
});

test('loadAndVerifySource: TopBuild pin verifies clean against its own committed fixture', () => {
  const config = mod.resolveRunConfig(mod.parseArgs([
    '--out-dir', 'x', '--deal', 'topbuild', '--family', 'MAE_DEFINITION', '--section-refs', '3.1(d)(iii)',
  ]));
  const verified = mod.loadAndVerifySource({ dealPin: config.dealPin, deal: 'topbuild', rawHtmlPath: config.rawHtmlPath });
  assert.equal(verified.rawBytesSha256, config.dealPin.raw_bytes_sha256);
  assert.equal(verified.conversion.canonical_text_sha256, config.dealPin.canonical_text_sha256);
  assert.equal(verified.verification.verification_status, 'PASS');
});

test('loadAndVerifySource: RAW_BYTES_HASH_MISMATCH fails loudly and distinctly when the file does not match the pin', () => {
  const config = mod.resolveRunConfig(mod.parseArgs(['--out-dir', 'x'])); // deal=modiv
  assert.throws(
    () => mod.loadAndVerifySource({
      dealPin: config.dealPin, deal: 'modiv', rawHtmlPath: TOPBUILD_RAW_HTML,
    }),
    /RAW_BYTES_HASH_MISMATCH: raw HTML at .* does not match the pin for deal "modiv"/,
  );
});

test('loadAndVerifySource: SOURCE_FILE_NOT_FOUND fails loudly and distinctly for a missing file', () => {
  const config = mod.resolveRunConfig(mod.parseArgs(['--out-dir', 'x']));
  assert.throws(
    () => mod.loadAndVerifySource({
      dealPin: config.dealPin, deal: 'modiv', rawHtmlPath: path.join(ROOT, 'tests', 'fixtures', 'definitely-does-not-exist.htm'),
    }),
    /SOURCE_FILE_NOT_FOUND/,
  );
});

// ─────────────────────────────────────────────────────────────────────────
// 5. TopBuild's pin is corroborated, not invented: cross-checked here
// directly against the committed intake-pin fixture (docs/codex-program
// instructions: "Do not invent a pin you cannot corroborate from something
// already committed").
// ─────────────────────────────────────────────────────────────────────────

test('DEAL_PINS.topbuild is corroborated against the committed topbuild-intake-pin.json fixture', () => {
  const committedPin = JSON.parse(fs.readFileSync(TOPBUILD_INTAKE_PIN, 'utf8'));
  assert.equal(mod.DEAL_PINS.topbuild.raw_bytes_sha256, committedPin.raw_bytes_sha256);
  assert.equal(mod.DEAL_PINS.topbuild.canonical_text_sha256, committedPin.canonical_text_sha256);
  assert.equal(committedPin.verification_status, 'PASS');
  // And independently re-derived from the real committed bytes (not just
  // copied from the intake pin file), the same way the Modiv pin is.
  const config = mod.resolveRunConfig(mod.parseArgs([
    '--out-dir', 'x', '--deal', 'topbuild', '--family', 'MAE_DEFINITION', '--section-refs', '3.1(d)(iii)',
  ]));
  const verified = mod.loadAndVerifySource({ dealPin: config.dealPin, deal: 'topbuild', rawHtmlPath: config.rawHtmlPath });
  assert.equal(verified.rawBytesSha256, committedPin.raw_bytes_sha256);
  assert.equal(verified.conversion.canonical_text_sha256, committedPin.canonical_text_sha256);
});

// ─────────────────────────────────────────────────────────────────────────
// 6. sectionizeAndResolve -- real sectionizer runs against real committed
// fixtures. Proves section resolution/assertion generalises: strict
// kind+heading assertions still fire for Modiv's pinned refs, and a
// different deal's differently-shaped reference (a SUBSECTION, not a
// SECTION) resolves cleanly when no expectation is pinned for it.
// ─────────────────────────────────────────────────────────────────────────

test('sectionizeAndResolve: Modiv 7.1/7.3/8.12 resolve to the exact bounds already pinned by the replay test', () => {
  const config = mod.resolveRunConfig(mod.parseArgs(['--out-dir', 'x']));
  const verified = mod.loadAndVerifySource({ dealPin: config.dealPin, deal: 'modiv', rawHtmlPath: config.rawHtmlPath });
  const { admittedSourceContext } = mod.buildAdmittedContext({
    deal: 'modiv', family: 'TERMINATION_FEE', dealPin: config.dealPin, verified,
  });
  const { resolutions } = mod.sectionizeAndResolve({
    sourceText: verified.conversion.canonical_text,
    documentHash: admittedSourceContext.document_hash,
    sectionRefs: config.sectionRefs,
    sectionExpectations: config.dealPin.section_expectations,
  });
  assert.equal(resolutions.length, 3);
  for (const r of resolutions) {
    const expected = EXPECTED_MODIV_SECTION_BOUNDS[r.section_reference];
    assert.ok(expected, r.section_reference);
    assert.equal(r.kind, 'SECTION');
    assert.equal(r.start, expected.start, `${r.section_reference} start`);
    assert.equal(r.end, expected.end, `${r.section_reference} end`);
    assert.match(r.heading, expected.heading, `${r.section_reference} heading`);
  }
});

test('sectionizeAndResolve: an unresolvable reference fails loudly with SECTION_REFERENCE_UNRESOLVED', () => {
  const config = mod.resolveRunConfig(mod.parseArgs(['--out-dir', 'x']));
  const verified = mod.loadAndVerifySource({ dealPin: config.dealPin, deal: 'modiv', rawHtmlPath: config.rawHtmlPath });
  const { admittedSourceContext } = mod.buildAdmittedContext({
    deal: 'modiv', family: 'TERMINATION_FEE', dealPin: config.dealPin, verified,
  });
  assert.throws(
    () => mod.sectionizeAndResolve({
      sourceText: verified.conversion.canonical_text,
      documentHash: admittedSourceContext.document_hash,
      sectionRefs: ['999.999'],
      sectionExpectations: {},
    }),
    /SECTION_REFERENCE_UNRESOLVED/,
  );
});

test('sectionizeAndResolve: a wrong pinned heading/kind expectation fails loudly and distinctly', () => {
  const config = mod.resolveRunConfig(mod.parseArgs(['--out-dir', 'x']));
  const verified = mod.loadAndVerifySource({ dealPin: config.dealPin, deal: 'modiv', rawHtmlPath: config.rawHtmlPath });
  const { admittedSourceContext } = mod.buildAdmittedContext({
    deal: 'modiv', family: 'TERMINATION_FEE', dealPin: config.dealPin, verified,
  });
  assert.throws(
    () => mod.sectionizeAndResolve({
      sourceText: verified.conversion.canonical_text,
      documentHash: admittedSourceContext.document_hash,
      sectionRefs: ['7.1'],
      sectionExpectations: { '7.1': { heading: /Definitely Not The Real Heading/ } },
    }),
    /SECTION_HEADING_MISMATCH/,
  );
  assert.throws(
    () => mod.sectionizeAndResolve({
      sourceText: verified.conversion.canonical_text,
      documentHash: admittedSourceContext.document_hash,
      sectionRefs: ['7.1'],
      sectionExpectations: { '7.1': { kind: 'SUBSECTION' } },
    }),
    /SECTION_KIND_MISMATCH/,
  );
});

test('sectionizeAndResolve: TopBuild\'s real MAE-definition reference resolves as a SUBSECTION with no pinned expectation', () => {
  const config = mod.resolveRunConfig(mod.parseArgs([
    '--out-dir', 'x', '--deal', 'topbuild', '--family', 'MAE_DEFINITION', '--section-refs', '3.1(d)(iii)',
  ]));
  const verified = mod.loadAndVerifySource({ dealPin: config.dealPin, deal: 'topbuild', rawHtmlPath: config.rawHtmlPath });
  const { admittedSourceContext } = mod.buildAdmittedContext({
    deal: 'topbuild', family: 'MAE_DEFINITION', dealPin: config.dealPin, verified,
  });
  const { resolutions } = mod.sectionizeAndResolve({
    sourceText: verified.conversion.canonical_text,
    documentHash: admittedSourceContext.document_hash,
    sectionRefs: config.sectionRefs,
    sectionExpectations: config.dealPin.section_expectations,
  });
  assert.equal(resolutions.length, 1);
  // Genuinely a SUBSECTION, not a SECTION -- proves the generic path does
  // not force Modiv's stricter "must be a whole SECTION" assumption onto a
  // deal/family combination that was never pinned that way.
  assert.equal(resolutions[0].kind, 'SUBSECTION');
  assert.equal(resolutions[0].start, 67578);
  assert.equal(resolutions[0].end, 67748);
});

// ─────────────────────────────────────────────────────────────────────────
// 7. Full CLI, real subprocess, --dry-run always -- proves the whole
// pipeline end to end (arg parsing, pin verification, sectionization,
// prompt-version resolution) with ZERO model calls, by construction: dry
// run returns before Step 3, which is the only place this script ever
// spawns `claude` or constructs a live provider.
// ─────────────────────────────────────────────────────────────────────────

test('CLI dry run: bare defaults (only --out-dir + --dry-run) reproduce the pinned Modiv section bounds, no model call', () => {
  const { report, outDir } = runCliDryRun([]);
  assert.equal(report.schema_version, 'GENERAL_EXTRACTION_RUN_DRY_RUN_REPORT/V1');
  assert.equal(report.deal, 'modiv');
  assert.equal(report.family, 'TERMINATION_FEE');
  assert.deepEqual(report.section_references, ['7.1', '7.3', '8.12']);
  assert.equal(report.would_call_model, false);
  assert.equal(report.projected_model_call_count, 3);
  assert.equal(report.source.raw_bytes_sha256, '659bcfaa017718ac735811861565fa2cd4e212657ba68e06ff1eab53e3729968');
  assert.equal(report.source.canonical_text_sha256, '0ce6bc29354f702c637693b9d6b8eeb989ce58ee72ef5337a90feb851460339e');
  assert.equal(report.source.verification_status, 'PASS');
  assert.equal(report.prompt.prompt_id, 'native-producer-termination-fee/v1');

  for (const r of report.sections_resolved) {
    const expected = EXPECTED_MODIV_SECTION_BOUNDS[r.section_reference];
    assert.equal(r.start, expected.start, r.section_reference);
    assert.equal(r.end, expected.end, r.section_reference);
    assert.equal(r.kind, 'SECTION', r.section_reference);
  }

  // No model call: no recorded-response fixture, no call-telemetry.json, no
  // run-receipt.json -- those are only ever written from Step 3 onward.
  const written = fs.readdirSync(outDir);
  assert.ok(written.includes('dry-run-report.json'));
  assert.ok(written.includes('source-reference.json'));
  assert.ok(written.includes('section-location-scan.json'));
  assert.ok(!written.some((f) => f.startsWith('native-producer-recorded-response-')));
  assert.ok(!written.includes('call-telemetry.json'));
  assert.ok(!written.includes('run-receipt.json'));

  // section-location-scan.json also carries Modiv's debug listing, unchanged
  // in spirit from the original script's all_7x_and_8_12_nodes field.
  const scan = JSON.parse(fs.readFileSync(path.join(outDir, 'section-location-scan.json'), 'utf8'));
  assert.ok(Array.isArray(scan.debug_related_nodes));
  assert.ok(scan.debug_related_nodes.length > 0);
});

test('CLI dry run: --follow-citations still parses and is reported, with zero model calls made', () => {
  const { report } = runCliDryRun(['--follow-citations']);
  assert.equal(report.follow_citations, true);
  assert.equal(report.would_call_model, false);
});

test('CLI dry run: a different family (MAE_DEFINITION) on a different deal (TopBuild) reaches the point of dispatch', () => {
  const { report, outDir } = runCliDryRun([
    '--deal', 'topbuild', '--family', 'MAE_DEFINITION', '--section-refs', '3.1(d)(iii)',
  ]);
  assert.equal(report.deal, 'topbuild');
  assert.equal(report.family, 'MAE_DEFINITION');
  assert.deepEqual(report.section_references, ['3.1(d)(iii)']);
  assert.equal(report.would_call_model, false);
  assert.equal(report.projected_model_call_count, 1);
  assert.equal(report.prompt.prompt_id, 'mae-definition-producer/v2');
  assert.equal(report.sections_resolved.length, 1);
  assert.equal(report.sections_resolved[0].kind, 'SUBSECTION');
  assert.equal(report.sections_resolved[0].start, 67578);
  assert.equal(report.sections_resolved[0].end, 67748);

  const written = fs.readdirSync(outDir);
  assert.ok(!written.some((f) => f.startsWith('native-producer-recorded-response-')));
});

test('CLI dry run: an unpinned deal fails loudly with UNPINNED_DEAL', () => {
  const stderr = expectCliFailure(['--deal', 'nonexistent-deal']);
  assert.match(stderr, /UNPINNED_DEAL: no committed pin for deal "nonexistent-deal"/);
});

test('CLI dry run: an unregistered family fails loudly with UNREGISTERED_FAMILY', () => {
  const stderr = expectCliFailure(['--family', 'NOT_A_REAL_FAMILY']);
  assert.match(stderr, /UNREGISTERED_FAMILY: "NOT_A_REAL_FAMILY"/);
});

test('CLI dry run: a mismatched digest fails loudly with RAW_BYTES_HASH_MISMATCH -- distinct from the other two failures', () => {
  const stderr = expectCliFailure(['--raw-html', TOPBUILD_RAW_HTML]); // deal defaults to modiv, file is TopBuild's
  assert.match(stderr, /RAW_BYTES_HASH_MISMATCH/);
  assert.doesNotMatch(stderr, /UNPINNED_DEAL/);
  assert.doesNotMatch(stderr, /UNREGISTERED_FAMILY/);
});

test('CLI dry run: an explicit --raw-html that matches its deal\'s pin still succeeds', () => {
  const { report } = runCliDryRun(['--raw-html', MODIV_RAW_HTML]);
  assert.equal(report.deal, 'modiv');
  assert.equal(report.source.raw_bytes_sha256, '659bcfaa017718ac735811861565fa2cd4e212657ba68e06ff1eab53e3729968');
});

test('CLI dry run: a (deal, family) pair with no pinned section refs and none given fails before touching the source file', () => {
  const outDir = makeTempDir();
  let caught = null;
  try {
    execFileSync('node', [SCRIPT_PATH, '--out-dir', outDir, '--dry-run', '--deal', 'topbuild', '--family', 'MAE_DEFINITION'], {
      cwd: ROOT, encoding: 'utf8', stdio: 'pipe',
    });
  } catch (error) {
    caught = error;
  }
  assert.ok(caught);
  assert.equal(caught.status, 1);
  assert.match(caught.stderr.toString(), /--section-refs is required for deal "topbuild" \+ family "MAE_DEFINITION"/);
  // Refused before any output was written at all.
  assert.deepEqual(fs.readdirSync(outDir), []);
});
