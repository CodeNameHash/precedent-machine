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

const scopedPatterns = [
  'TSA|transition services agreement',
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
      if (['node_modules', '.next', 'docs', '.git', '.claude', '.vercel'].includes(entry.name)) continue;
      walk(full, files);
    } else if (
      rel !== 'scripts/lint/forbidden-patterns.sh' &&
      rel !== 'pm-master-straitjacket.codex.md'
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
  'lib/taxonomy.js': ['Must defend \\(incl\\. appeals/final judgment\\)'],
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
};

const failures = [];
for (const rel of changedFiles()) {
  if (
    !rel ||
    rel.startsWith('node_modules/') ||
    rel.startsWith('.next/') ||
    rel.startsWith('docs/') ||
    rel.startsWith('.git/') ||
    rel.startsWith('.claude/') ||
    rel.startsWith('.vercel/') ||
    rel.startsWith('reports/backups/') || // raw DB dumps: agreement text legitimately hits bug-fingerprints
    rel.startsWith('scripts/lint/') ||
    rel === 'pm-master-straitjacket.codex.md'
  ) {
    continue;
  }
  const full = path.join(root, rel);
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) continue;
  const src = fs.readFileSync(full, 'utf8');
  for (const pattern of globalPatterns) {
    if ((FILE_PATTERN_EXEMPTIONS[rel] || []).includes(pattern)) continue;
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

if (failures.length) {
  process.stdout.write(`INVARIANT-4: FAIL ${failures[0]}\n`);
  process.exit(1);
}

process.stdout.write('INVARIANT-4: PASS\n');
NODE
