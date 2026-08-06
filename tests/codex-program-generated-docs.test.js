'use strict';

// Fails the suite when the three documents this exercise produced,
// docs/core/CODEBASE-GUIDE.md, docs/core/GRAVEYARD.md,
// and their generated data source,
// docs/codex-program/generated/system-inventory.json, name a file, script,
// symbol or module that no longer resolves. Modelled on the two mechanisms
// docs/codex-program/notes/doc-reality-audit.md names as already working
// this way in this repository: tests/canonical-v2-phase1-authority-
// boundary.test.js (fails the suite when a changed production source is
// unclassified) and tests/canonical-v2-parity-serving-path.test.js /
// lib/canonical-v2/native-producer/m3-family-parity-register.js
// (re-derives a status from primary sources on every run rather than
// trusting a stored claim).
//
// THE DISTINGUISHABLE FORM, AND WHY. doc-reality-audit.md's own proposed
// version of this check (its 2.2(b)) skips a path-looking match if it sits
// inside a fenced `git show <sha>:...` command or within one sentence of
// words like "no longer exists" or "deleted". That is a workable rule but
// a soft one: it depends on recognising prose phrasing, which is exactly
// the kind of judgement call this whole exercise exists to take out of the
// loop. This test uses a stricter, purely syntactic rule instead, chosen
// specifically because both documents are freshly authored and every
// sentence in them can be written to satisfy it, rather than retrofitted
// onto existing prose no one controls:
//
//   - A single-backtick inline code span that looks like a repository path
//     (contains at least one '/' and ends in a recognised extension) is a
//     LIVE reference and MUST resolve, no exceptions.
//   - Content inside a triple-backtick fenced block is NEVER checked. Both
//     documents use fenced blocks specifically to quote git output, source
//     excerpts and commit messages, several of which legitimately name a
//     file that has since been deleted (see GRAVEYARD.md's entry on
//     pages/compare.js); quoting history is not a live claim about the
//     present.
//   - A path-like span may contain exactly one '*' as a single glob
//     segment (for example lib/canonical-v2/*-serving-source.js); it
//     passes if at least one file matches.
//   - A trailing ':123' or ':123-456' line reference is stripped before
//     resolution is checked; this test does not pin line numbers (they
//     drift on ordinary, unrelated edits far more often than the claim
//     they support goes stale, and doc-reality-audit.md's own F21 finding
//     is a caution against pinning more than a document can actually keep
//     current) or symbol resolution.
//
// This means: to name a file that no longer exists as a live fact, write
// it outside backticks, or inside a fenced block. Both documents follow
// that rule throughout; this test is what makes the rule self-enforcing
// rather than a style note someone can forget.
//
// SYMBOL CHECKING. Where prose names a file and then, in the same breath,
// names one of its exports ("`lib/canonical-v2/canonical-writer.js`'s
// `WRITE_ORDER`", or the equivalent for a JSON file's top-level key), that
// pairing is extracted and the named symbol is checked for real: a
// word-boundary text search in the file for a JS/JSX/MJS target, an own-key
// check for a JSON target. This is deliberately narrower than checking
// every bare identifier in backticks in either document; most of those are
// quoted string VALUES (a claim state like 'PRESENT', an error code, an
// environment variable's required value), not references to a symbol
// defined somewhere, and there is no reliable syntactic way to tell the two
// apart. Checking the file-then-symbol pairing this codebase's own prose
// style already produces catches the cases that matter (a renamed or
// deleted export) without guessing at the rest.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const REPO_ROOT = path.resolve(__dirname, '..');

const GOVERNED_DOCS = Object.freeze([
  'docs/core/CODEBASE-GUIDE.md',
  'docs/core/GRAVEYARD.md',
]);

const GENERATED_INVENTORY_PATH = 'docs/codex-program/generated/system-inventory.json';

const PATH_SPAN_RE = /(?:[A-Za-z0-9_.[\]-]+\/)+[A-Za-z0-9_.[\]*-]+\.[A-Za-z0-9]+/;
const CODE_EXTENSIONS = new Set(['js', 'jsx', 'mjs', 'json', 'md', 'sql', 'yaml', 'yml', 'txt']);

function stripFencedBlocks(markdown) {
  return markdown.replace(/```[\s\S]*?```/g, '');
}

function extractBacktickSpans(markdown) {
  const spans = [];
  const re = /`([^`\n]+)`/g;
  let m = re.exec(markdown);
  while (m) {
    spans.push(m[1]);
    m = re.exec(markdown);
  }
  return spans;
}

/**
 * Resolves a path-like backtick span against the repository root. Returns
 * `{ ok, resolvedPath }` for a plain path, or `{ ok, matches }` for a glob.
 * Strips a trailing ':123', ':123-456' or '#Symbol' suffix first, per this
 * file's header note on why line numbers and bare symbol suffixes are out
 * of scope for this specific check.
 */
function resolvePathSpan(rawToken) {
  const token = rawToken.split(/[:#]/)[0];
  const ext = token.slice(token.lastIndexOf('.') + 1).toLowerCase();
  if (!CODE_EXTENSIONS.has(ext)) return null; // not a path this test understands; ignore
  if (token.includes('*')) {
    const dir = path.dirname(token);
    const suffix = path.basename(token);
    const suffixRe = new RegExp(`^${suffix.split('*').map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`);
    const absDir = path.join(REPO_ROOT, dir);
    if (!fs.existsSync(absDir) || !fs.statSync(absDir).isDirectory()) {
      return { ok: false, token, reason: `glob directory ${dir} does not exist` };
    }
    const matches = fs.readdirSync(absDir).filter((name) => suffixRe.test(name));
    return { ok: matches.length > 0, token, reason: matches.length > 0 ? null : `no file in ${dir} matches ${suffix}` };
  }
  const absPath = path.join(REPO_ROOT, token);
  return { ok: fs.existsSync(absPath), token, reason: fs.existsSync(absPath) ? null : 'does not exist' };
}

function pathLikeSpansToCheck(markdown) {
  const withoutFences = stripFencedBlocks(markdown);
  const spans = new Set(extractBacktickSpans(withoutFences));
  const results = [];
  for (const span of spans) {
    const match = PATH_SPAN_RE.exec(span);
    if (!match) continue;
    results.push({ span, token: match[0] });
  }
  return results;
}

function symbolPairsToCheck(markdown) {
  const withoutFences = stripFencedBlocks(markdown);
  const pairRe = /`([\w./[\]-]+\.\w+)`(?:'s)?\s+`([A-Za-z_$][\w$]*)`/g;
  const pairs = [];
  let m = pairRe.exec(withoutFences);
  while (m) {
    pairs.push({ file: m[1].split(/[:#]/)[0], symbol: m[2] });
    m = pairRe.exec(withoutFences);
  }
  return pairs;
}

function symbolResolvesInFile(relFilePath, symbol) {
  const absPath = path.join(REPO_ROOT, relFilePath);
  if (!fs.existsSync(absPath)) return false;
  if (relFilePath.endsWith('.json')) {
    const parsed = JSON.parse(fs.readFileSync(absPath, 'utf8'));
    return Object.prototype.hasOwnProperty.call(parsed, symbol);
  }
  const content = fs.readFileSync(absPath, 'utf8');
  return new RegExp(`\\b${symbol.replace(/[$]/g, '\\$')}\\b`).test(content);
}

for (const relDocPath of GOVERNED_DOCS) {
  test(`${relDocPath}: every live path reference resolves`, () => {
    const absDocPath = path.join(REPO_ROOT, relDocPath);
    const markdown = fs.readFileSync(absDocPath, 'utf8');
    const spans = pathLikeSpansToCheck(markdown);
    assert.ok(spans.length > 0, `expected at least one path-like reference in ${relDocPath}`);
    const failures = spans
      .map(({ span, token }) => ({ span, token, result: resolvePathSpan(token) }))
      .filter(({ result }) => result && !result.ok);
    assert.deepEqual(
      failures.map((f) => `${f.token} (from span "${f.span}"): ${f.result.reason}`),
      [],
      `${relDocPath} names a file, script or module that does not resolve. If this is a `
      + 'historical reference (something deleted, renamed, or superseded), quote it inside '
      + 'a fenced code block or write it outside backticks instead of as a live inline '
      + 'code span; see this test file\'s own header.',
    );
  });

  test(`${relDocPath}: every paired file-and-symbol reference resolves`, () => {
    const absDocPath = path.join(REPO_ROOT, relDocPath);
    const markdown = fs.readFileSync(absDocPath, 'utf8');
    const pairs = symbolPairsToCheck(markdown);
    const failures = pairs.filter(({ file, symbol }) => !symbolResolvesInFile(file, symbol));
    assert.deepEqual(
      failures,
      [],
      `${relDocPath} names a symbol that no longer exists in the file named alongside it.`,
    );
  });
}

test('docs/codex-program/generated/system-inventory.json matches a fresh regeneration', () => {
  // eslint-disable-next-line global-require, import/no-dynamic-require
  const generator = require(path.join(REPO_ROOT, 'scripts/generate-codebase-inventory.js'));
  assert.doesNotThrow(() => generator.generate({ check: true }));
});

test('docs/codex-program/generated/system-inventory.json: every path-like value it stores resolves', () => {
  // Defence in depth beyond the regeneration check above: this walks the
  // committed JSON directly, so it also catches a hand-edit that bypassed
  // the generator, not only a generator that drifted from its own output.
  // Every string field in this generated file is either a concrete path,
  // a real glob this script itself derived, or narrative prose describing
  // one of those (see e.g. the "method" and "layer_locations" fields) --
  // unlike the two hand-written documents above, there is no legitimate
  // reason for this file to name a path that does not exist anywhere in
  // it, so every string value is checked, with no per-field exemption.
  const absPath = path.join(REPO_ROOT, GENERATED_INVENTORY_PATH);
  const inventory = JSON.parse(fs.readFileSync(absPath, 'utf8'));
  const failures = [];

  function walk(value, keyPath) {
    if (typeof value === 'string') {
      const match = PATH_SPAN_RE.exec(value);
      if (!match) return;
      const result = resolvePathSpan(match[0]);
      if (result && !result.ok) failures.push(`${keyPath.join('.')} = ${JSON.stringify(value)}: ${result.reason}`);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, [...keyPath, String(index)]));
      return;
    }
    if (value && typeof value === 'object') {
      for (const [key, item] of Object.entries(value)) walk(item, [...keyPath, key]);
    }
  }

  walk(inventory, []);
  assert.deepEqual(failures, []);
});
