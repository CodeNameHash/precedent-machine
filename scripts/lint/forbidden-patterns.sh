#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"

node - "$ROOT" <<'NODE'
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = process.argv[2] || '.';

const globalPatterns = [
  'ITM only',
  'Consideration:\\s*Cash',
  'MAE\\s*\\(partial\\)',
  'Question\\s*:.*\\|.*Answer\\s*:',
  'applies to Parent and Company',
  'maeAppliesToBoth',
  'Must defend \\(incl\\. appeals/final judgment\\)',
  'QUALIFICATION.*litigation',
  'burdensome.*closing.condition',
  'Substantial Detriment.*closing',
  'Exchange Ratio Type.*Floating.*Exchange Ratio Type.*Fixed',
  'TOOLTIP_MAX\\s*=\\s*600',
  'FullDocumentView\\s+provisions=\\{provisions\\}(?!.*focusProvisionId)',
  'term-cell.*Company pre-closing.*base salary',
  'antitrust-substantive-table.*<button.*onClick',
  "field_path\\s*:\\s*['\"][a-z_]+['\"]",
  "provision_type\\s*:\\s*['\"][A-Z_]+['\"]\\s*,\\s*field_path",
  '\\\\.only\\(',
  '\\\\.skip\\(',
  '\\\\bxit\\(',
  'any\\s*<any>',
  ':\\s*string\\s*=',
  'Mergers,\\s*Acquisitions,\\s*Dispositions',
  'class="definition-term"(?!.*wrapped)',
];

// See the exemption comment at the application site: verbatim recorded SEC
// filing text inside pinned fixtures must not trip prose-shaped
// bug-fingerprints aimed at code/label regressions. Narrow by construction:
// an EXPLICIT allowlist of directories independently verified to hold real
// merger-agreement prose, never a directory admitted by name pattern. Two
// verified categories, both the same underlying justification (this is
// recorded source text, not application code):
//   - a genuine recorded model-output capture: a dated, subscription-CLI
//     live-run handoff with a real raw_response_text /
//     native-producer-recorded-response body and model id (f28-live-run,
//     f28-second-live-run, f28-third-live-run, modiv-first-live-run,
//     skechers-first-live-run);
//   - a committed production-text fixture: cards pulled verbatim from the
//     production provision_cards table (or hand-transcribed from a real
//     filing), no model call involved -- the *-fixtures directories below,
//     and v1v2-comparator (recorded production provision_cards text:
//     section titles and primary_quotes are verbatim merger-agreement
//     prose).
//
// Register hygiene audit, 2026-08-05: ten of fifteen directories then named
// tests/fixtures/canonical-v2/*-live-run/ earned this exemption by NAME
// alone (matching the substring "live-run") without containing a live run
// at all -- nine held curated "committed fixtures" (hand-typed or
// DB-replayed corpus-cards.json, no captured model response ever recorded),
// and closing-conditions-live-run's own README said outright that it
// "support[s] only synthetic resolver and lexicon tests until a dated
// live-run recording exists". All ten were renamed to *-fixtures/: still
// listed below (they hold real prose, verified per file above), but no
// longer able to claim they are a live run they are not. A directory earns
// this exemption only by being added here deliberately after the same
// verification, never by its name.
const RECORDED_LIVE_RUN_DIR = /^tests\/fixtures\/canonical-v2\/(f28-live-run|f28-second-live-run|f28-third-live-run|modiv-first-live-run|skechers-first-live-run|antitrust-regulatory-fixtures|appraisal-fixtures|closing-conditions-fixtures|dividends-fixtures|dno-fixtures|employee-matters-fixtures|financing-covenants-fixtures|guaranty-fixtures|m3-v31-fixtures|tax-matters-fixtures|v1v2-comparator)\//;
// Two filenames under a live-run directory always embed admitted agreement
// text: the adapter result, and the raw recorded model response, which quotes
// the agreement back verbatim. Both therefore trip PROSE-class fingerprints
// on real contract language, on spans thousands of characters long bridging
// entirely unrelated words. Named individually rather than exempting the
// directory, so resolution.json, validation.json, the receipts and everything
// else in the same directory stay fully checked, and CODE-class fingerprints
// still apply to these two in full.
// `recording.json` joins the list as the FIFTH instance of the identical
// exemption, and it belongs by construction rather than by coincidence: a
// --record recording stores `request_messages`, and the request messages ARE
// the agreement section handed to the model. It embeds admitted source text
// for the same reason the other two do. It went unnoticed until a
// REPRESENTATIONS recording, whose section is the one place a merger agreement
// says "Qualification" and "litigation" in the same breath.
const LIVE_RUN_SOURCE_TEXT_FILE = /^evidence\/canonical-v2\/[^/]+\/(adapter-result|recording|native-producer-recorded-response-[^/]+)\.json$/;
const DETERMINISTIC_DERIVED_PROSE_EVIDENCE_FILE = /^evidence\/canonical-v2\/(stage-2y-f-lexical-classification|stage-2y-h-representation-topic-replay)\.json$/;
const PROSE_CLASS_FINGERPRINTS = [
  'QUALIFICATION.*litigation',
  'Must defend \\(incl\\. appeals/final judgment\\)',
  'burdensome.*closing.condition',
  'Substantial Detriment.*closing',
  'applies to Parent and Company',
  'Mergers,\\s*Acquisitions,\\s*Dispositions',
];

const scopedPatterns = [
  '\\bTSA\\b|transition services agreement',
  'TODO\\s*[:—-].*market',
  'FIXME.*market',
  'console\\.log',
];

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(root, full).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      if (['node_modules', '.next', 'docs', 'archive', '.git', '.claude', '.vercel'].includes(entry.name)) continue;
      walk(full, files);
    } else if (
      rel !== 'scripts/lint/forbidden-patterns.sh' &&
      rel !== 'archive/pm-master-straitjacket.codex.md'
    ) {
      files.push({ full, rel });
    }
  }
  return files;
}

function normalize(file) {
  return String(file || '').replace(/\\/g, '/').replace(/^\.\//, '').trim();
}

function changedFiles() {
  if (process.env.CHANGED_FILES) {
    return process.env.CHANGED_FILES.split(/\r?\n/).map(normalize).filter(Boolean);
  }
  function diffNames(ref) {
    return execFileSync('git', ['diff', '--name-only', ref], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .split(/\r?\n/)
      .map(normalize)
      .filter(Boolean);
  }
  const refs = ['origin/main...HEAD', 'main...HEAD'];
  for (const ref of refs) {
    try {
      return diffNames(ref);
    } catch (_) {
      // Try the next base ref.
    }
  }
  if (process.env.GITHUB_ACTIONS && process.env.GITHUB_BASE_REF && process.env.GITHUB_HEAD_REF) {
    const base = process.env.GITHUB_BASE_REF;
    const head = process.env.GITHUB_HEAD_REF;
    try {
      execFileSync('git', [
        'fetch',
        '--no-tags',
        '--depth=200',
        'origin',
        `+refs/heads/${base}:refs/remotes/origin/${base}`,
        `+refs/heads/${head}:refs/remotes/origin/${head}`,
      ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      return diffNames(`origin/${base}..origin/${head}`);
    } catch (_) {
      // Try the single-parent checkout fallback below.
    }
  }
  try {
    return diffNames('HEAD^1..HEAD');
  } catch (_) {
    // Fall back to a full scan below.
  }
  return walk(root).map((file) => file.rel);
}

function scopedFile(rel) {
  // Scoped patterns (console.log, TSA / market TODO-FIXME) target RUNTIME domain
  // code, not build tooling. Build scripts under scripts/ legitimately use
  // console.log for progress output (e.g. generate-registry.js prints what it
  // generated), and the bare `registry` alternative below matches their names.
  // Exclude scripts/ so editing a build script doesn't trip the ban against its
  // own pre-existing, legitimate output.
  if (rel.startsWith('scripts/')) return false;
  return /OtherCovenants|other-covenants|market-registry|registry|newhome/.test(rel);
}

// Some globalPatterns are bug-fingerprints from a PAST regression in some
// OTHER file (a duplicated/mis-copied label), not from the taxonomy
// dictionary that legitimately defines that label. lib/taxonomy.js is the
// canonical source of `LITIGATION_OBLIGATION.MANDATORY_DEFEND`'s label text
// ("Must defend (incl. appeals/final judgment)") -- any edit to the file
// (even unrelated to this dictionary) puts the whole file in the diff and
// trips the pattern against its own, correct, single definition. Exempt
// only that pattern for that file; every other check still applies.
const FILE_PATTERN_EXEMPTIONS = {
  // TOOLTIP_MAX=600 is the bug-fingerprint for tooltip truncation on the
  // NEW (Mergertrace) review surface — item 8 of UI-FEEDBACK-R3 killed
  // tooltips there entirely. The constant legitimately survives in
  // lib/citable.js solely for the legacy /review-v1 fallback page (its only
  // remaining importer). Exempt the definition site; any NEW usage in v2
  // components still trips the invariant.
  'lib/citable.js': ['TOOLTIP_MAX\\s*=\\s*600'],
  // The WP-3 alias-fixture test PROVES alias→canonical resolution: it must
  // reference a raw snake_case feature key (go_shop) verbatim to assert that
  // _prov surfaces both matched_key (raw) and canonical_key. The raw-key
  // fingerprint is aimed at production query code, which stays covered.
  'tests/query/normalizer-badges.test.js': [
    'field_path\\s*:\\s*[\'"][a-z_]+[\'"]',
    'provision_type\\s*:\\s*[\'"][A-Z_]+[\'"]\\s*,\\s*field_path',
  ],
  // Same class: result-title.test.js's MARKET_RANGE fixture must carry a
  // literal payload field_path to assert the human title derives from it.
  // Production query code stays covered by the invariant.
  'tests/query/result-title.test.js': [
    'field_path\\s*:\\s*[\'"][a-z_]+[\'"]',
  ],
  // Same class: wp-query.test.js fixtures deliberately carry raw snake_case
  // feature keys / payload field_paths because they test the alias-resolution
  // and deal_filter payload contracts end to end. Production query code stays
  // covered by the invariant.
  'tests/query/wp-query.test.js': [
    'field_path\\s*:\\s*[\'"][a-z_]+[\'"]',
    'provision_type\\s*:\\s*[\'"][A-Z_]+[\'"]\\s*,\\s*field_path',
  ],
  // Same class: the market-range percent-of-deal fixture must carry a
  // literal payload field_path to exercise the executor end to end.
  'tests/query/market-range-percent-of-deal.test.js': [
    'field_path\\s*:\\s*[\'"][a-z_]+[\'"]',
    'provision_type\\s*:\\s*[\'"][A-Z_]+[\'"]\\s*,\\s*field_path',
  ],
  // Same class: the relative-periods MARKET_RANGE fixture carries a literal
  // payload field_path to exercise the executor end to end.
  'tests/query/relative-periods.test.js': [
    'field_path\\s*:\\s*[\'"][a-z_]+[\'"]',
    'provision_type\\s*:\\s*[\'"][A-Z_]+[\'"]\\s*,\\s*field_path',
  ],
  // Same class: the 2026-08-05 parseUsdAmount regression suite (and its
  // later-that-day consolidation onto lib/parse-money.js) drives
  // executeMarketRange() with real registry field_paths -- feePctOfDealValue
  // and reverseFeePctOfDealValue (the derived percentage fields) and
  // companyTerminationFee (the raw "usd"-typed field) -- all routing through
  // the same ambiguity-rejecting parse path, to prove the row-inclusion guard
  // behaves correctly for each. Literal payloads are the executor's real
  // request shape; production query code stays covered.
  'tests/derived-fields.test.js': [
    'field_path\\s*:\\s*[\'"][a-z_]+[\'"]',
    'provision_type\\s*:\\s*[\'"][A-Z_]+[\'"]\\s*,\\s*field_path',
  ],
  // Same class as the tests/query/* fixture exemptions above: the canonical-v2
  // Query UI slice tests must carry the EXACT legacy ad hoc payload
  // ({provision_type: 'TERMINATION_FEE', field_path: 'feePctOfDealValue'})
  // verbatim, because they prove that precise request — and only it — routes
  // to the canonical endpoint (party specificity, legacy fallback, mapper
  // pinning against the frozen compiler). The raw-payload fingerprint is
  // aimed at production query code, which stays covered. (The pattern is
  // applied case-insensitively, so camelCase field_path fixtures trip it.)
  'tests/canonical-v2-legacy-query-mapper.test.js': [
    'field_path\\s*:\\s*[\'"][a-z_]+[\'"]',
    'provision_type\\s*:\\s*[\'"][A-Z_]+[\'"]\\s*,\\s*field_path',
  ],
  'tests/canonical-v2-query-ui-routing.test.js': [
    'field_path\\s*:\\s*[\'"][a-z_]+[\'"]',
    'provision_type\\s*:\\s*[\'"][A-Z_]+[\'"]\\s*,\\s*field_path',
  ],
  'tests/canonical-v2-query-refinements.test.js': [
    'field_path\\s*:\\s*[\'"][a-z_]+[\'"]',
    'provision_type\\s*:\\s*[\'"][A-Z_]+[\'"]\\s*,\\s*field_path',
  ],
  // Same class, with an extra wrinkle worth stating so nobody re-litigates it.
  // The fingerprint targets the LEGACY AD HOC PAYLOAD `{provision_type: 'X',
  // field_path: 'y'}` in production query code. What trips here is the
  // natural-language MODEL INTENT contract's own `field_paths` (PLURAL) --
  // `field_path` is a prefix of it, and `\s*,\s*` spans the newline between the
  // two object keys, so a line-based grep does not show the match. The literal
  // is an INPUT to compileIntent inside assert.throws: the test proves an
  // unknown deal_id is rejected, i.e. it exercises the compiler rather than
  // bypassing it. It appeared only because retiring DEAL_TO_MARKET (61d7280c)
  // forced that test onto PROVISION_CROSS_CUT, which needs a provision_type and
  // field_paths to reach the deal_id check at all. Exempt only this pattern for
  // this file; the singular-field_path fingerprint and every other check still
  // apply here, and production query code stays fully covered.
  'tests/query-natural-language.test.js': [
    'provision_type\\s*:\\s*[\'"][A-Z_]+[\'"]\\s*,\\s*field_path',
  ],
  'lib/taxonomy.js': ['Must defend \\(incl\\. appeals/final judgment\\)'],
  // Same false-positive class: Sidebar.js renders "(applies to Parent and
  // Company)" GATED on group.maeAppliesToBoth (data-driven, correct since
  // 0e20f4c) — the fingerprint targets the past regression of stamping that
  // phrase unconditionally elsewhere. An unrelated edit (the r13 ellipsis
  // sweep) put the file in the diff and tripped it against its own
  // pre-existing, legitimate conditional.
  'components/review/Sidebar.js': ['applies to Parent and Company', 'maeAppliesToBoth'],
  // Same situation as taxonomy.js: this canonical-dictionary PIN test
  // legitimately asserts `LITIGATION_OBLIGATION.MANDATORY_DEFEND`'s exact label
  // to catch accidental label drift. Editing an UNRELATED pin in the same file
  // (e.g. the ANTI_HOHW display-label update) puts the file in the diff and
  // trips this bug-fingerprint against its own correct assertion. Exempt only
  // this one pattern for this one file; every other check still applies.
  'tests/anti-regulatory-efforts.test.js': ['Must defend \\(incl\\. appeals/final judgment\\)'],
  // Same false-positive class: extract.js legitimately describes the
  // "Burdensome Condition" closing-condition feature in its extraction PROMPT
  // guidance (burdensomeConditionPresent). Editing extract.js for any reason
  // (e.g. adding a new codebook) puts the file in the diff and trips this
  // bug-fingerprint against its own correct prompt text. Exempt only this
  // pattern for this file.
  // extract.js embeds every codebook LABEL into the extraction prompt, so it
  // legitimately contains taxonomy label strings (the IOC-MERGE label
  // "Mergers, Acquisitions, Dispositions", the burdensome-condition prompt).
  // Both are bug-fingerprints meant for OTHER files; exempt only these two
  // patterns for this one file.
  'lib/parser-v2/extract.js': ['burdensome.*closing.condition', 'Mergers,\\s*Acquisitions,\\s*Dispositions'],
  // Same false-positive class again: this test asserts IOC-MERGE's real
  // taxonomy fallback label ("Mergers, Acquisitions, Dispositions", the
  // exact string extract.js's own exemption above documents as the
  // legitimate source) resolves correctly across three sibling section
  // fragments that share it. Genuine taxonomy fixture, not the past
  // duplicated-label regression this pattern fingerprints.
  'tests/audit-fix-batch-ui.test.js': ['Mergers,\\s*Acquisitions,\\s*Dispositions'],
  // Same class once more: the IOC party-attribution audit fixtures (Zymeworks
  // mutual band, ENDRA neutral band) pin rows whose short_title is IOC-MERGE's
  // real taxonomy fallback label. Genuine fixture, not the duplicated-label
  // regression this pattern fingerprints.
  'tests/provision-table-configs.test.js': ['Mergers,\\s*Acquisitions,\\s*Dispositions'],
  // Same class as the tests/query/* fixture exemptions above: this file's
  // executeMarketRange() calls (parity with market-range-percent-of-deal.test.js
  // and relative-periods.test.js) must carry the EXACT literal payload
  // ({provision_type: 'TERMINATION_FEE', field_path: 'feePctOfDealValue'} /
  // 'reverseFeePctOfDealValue') to exercise the query executor end to end
  // against the real Modiv-shaped ambiguous-amount fixtures. The raw-payload
  // fingerprint is aimed at production query code constructing this shape ad
  // hoc, which stays covered.
  'tests/derived-fields.test.js': [
    'field_path\\s*:\\s*[\'"][a-z_]+[\'"]',
    'provision_type\\s*:\\s*[\'"][A-Z_]+[\'"]\\s*,\\s*field_path',
  ],
  // Same class once more, and the same real Metsera deal
  // (885edae5-49e8-464a-9f33-edd229119d7c) as tests/provision-table-
  // configs.test.js's exemption above: this file's own header states "Fixtures
  // are real-shaped: field values below are taken directly from the Metsera
  // deal... as stored in ai_metadata.features, not invented shapes" --
  // aocCitedCovenantNames pins IOC-MERGE's real taxonomy fallback label.
  // Genuine fixture, not the duplicated-label regression this pattern
  // fingerprints.
  'tests/fb3-section-tables.test.js': ['Mergers,\\s*Acquisitions,\\s*Dispositions'],
  // Merge note, 2026-08-06: main carried a per-file entry here for
  // evidence/canonical-v2/modiv-termination-fee-scope-correction-20260805/
  // adapter-result.json against 'QUALIFICATION.*litigation'. It is deliberately
  // NOT reinstated. The LIVE_RUN_ADAPTER_RESULT rule at the application site
  // now covers every live-run adapter result for the PROSE-class fingerprints,
  // which is the same exemption for the same reason, arrived at after the
  // fourth identical per-file entry in two days. Its verification reasoning,
  // that the file reuses already-committed hash-pinned source and embeds real
  // merger prose rather than a code regression, still stands and is recorded
  // at that rule.
};

const failures = [];
for (const rel of changedFiles()) {
  if (
    !rel ||
    rel.startsWith('node_modules/') ||
    rel.startsWith('.next/') ||
    rel.startsWith('docs/') ||
    rel.startsWith('archive/') || // relocated, superseded documents: historical prose, not live code
    rel.startsWith('.git/') ||
    rel.startsWith('.claude/') ||
    rel.startsWith('.vercel/') ||
    rel.startsWith('public/generated/') || // Data labels can legitimately match code-regression fingerprints.
    rel.startsWith('reports/backups/') || // raw DB dumps: agreement text legitimately hits bug-fingerprints
    rel.startsWith('scripts/lint/') ||
    rel === 'archive/pm-master-straitjacket.codex.md'
  ) {
    continue;
  }
  const full = path.join(root, rel);
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) continue;
  const src = fs.readFileSync(full, 'utf8');
  for (const pattern of globalPatterns) {
    if ((FILE_PATTERN_EXEMPTIONS[rel] || []).includes(pattern)) continue;
    // Recorded live-run artifacts (tests/fixtures/canonical-v2/*-live-run/)
    // embed VERBATIM admitted SEC filing text — real merger-agreement prose
    // legitimately contains "Qualification … litigation", "burdensome …
    // closing condition" etc. on one line. The PROSE-class bug-fingerprints
    // below target past CODE/label regressions, not source documents, so a
    // faithful recording must not trip them. Code-class fingerprints
    // (console.log, .only(, field_path payloads, …) still apply to these
    // files in full.
    if (RECORDED_LIVE_RUN_DIR.test(rel) && PROSE_CLASS_FINGERPRINTS.includes(pattern)) continue;
    // Same reasoning as the line above, extended to live-run adapter results
    // after the fourth identical exemption in two days.
    //
    // Every run of the extraction pipeline writes an adapter-result.json that
    // embeds the admitted agreement verbatim, on a single JSON line. Real
    // merger-agreement prose therefore trips the PROSE-class fingerprints
    // every time, because a wildcard bridges thousands of characters between
    // unrelated words. Four separate runs have now needed the identical
    // per-file entry for the identical pattern.
    //
    // At the second instance the per-file form was kept deliberately, on the
    // argument that adding a line by hand is the moment of inspection that
    // makes the check worth having. That argument does not survive the fourth:
    // the outcome is now predictable rather than a thing worth looking at each
    // time, and a queue of identical exemptions is how a check stops being
    // read at all.
    //
    // Deliberately narrower than "all of evidence/": it names the one filename
    // whose contents are always admitted source text. Every other file in the
    // same directories, including resolution.json and the recorded responses,
    // is still checked in full, and the CODE-class fingerprints still apply
    // here in full too.
    if (LIVE_RUN_SOURCE_TEXT_FILE.test(rel) && PROSE_CLASS_FINGERPRINTS.includes(pattern)) continue;
    // These two Stage 2Y ledgers are deterministic copies of recorded
    // candidate prose. Their canonical JSON has no line breaks, so a prose
    // fingerprint can bridge unrelated source quotes across the artifact.
    // Keep every code fingerprint, and every other evidence file, in scope.
    if (DETERMINISTIC_DERIVED_PROSE_EVIDENCE_FILE.test(rel) && PROSE_CLASS_FINGERPRINTS.includes(pattern)) continue;
    if (new RegExp(pattern, 'im').test(src)) {
      failures.push(`${rel} :: ${pattern}`);
    }
  }
  if (scopedFile(rel)) {
    for (const pattern of scopedPatterns) {
      if (new RegExp(pattern, 'im').test(src)) {
        failures.push(`${rel} :: ${pattern}`);
      }
    }
  }
}

try {
  execFileSync('node', [path.join(root, 'scripts/lint/resolution-registry-duplicates.js'), root], { stdio: 'pipe' });
} catch (error) {
  process.stdout.write(`INVARIANT-4: FAIL ${String(error.stderr || error.message).trim()}\n`);
  process.exit(1);
}

if (failures.length) {
  process.stdout.write(`INVARIANT-4: FAIL ${failures[0]}\n`);
  process.exit(1);
}

process.stdout.write('INVARIANT-4: PASS\n');
NODE
