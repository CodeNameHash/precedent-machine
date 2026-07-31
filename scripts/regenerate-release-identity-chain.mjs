#!/usr/bin/env node
// Mechanical regeneration tool for the frozen release-identity fixture chain
// (F21 -> F26 / F28). See scripts/release-identity-chain.manifest.json for the
// data-only description of each link.
//
// Usage:
//   node scripts/regenerate-release-identity-chain.mjs [--check|--write]
//
// --check (default): recompute every "recompute" link from current upstream
//   bytes, compare against the pinned fixture, print a report. Never writes
//   files. Exits 0 iff there is zero drift and zero blocked link.
// --write: same recompute, but rewrites the pinned fixture files that have
//   drifted to the freshly recomputed value, and prints a semantic diff
//   report of what changed and why. Idempotent: a clean second --write run
//   reports no changes. "report-only" links are always skipped with a
//   printed notice -- this tool never guesses their content.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const { canonicalJson, contentId } = require(
  path.join(ROOT, 'lib/canonical-v2/canonical-bytes.js'),
);

function abs(relPath) {
  return path.join(ROOT, relPath);
}

function readJsonFile(relPath) {
  return JSON.parse(fs.readFileSync(abs(relPath), 'utf8'));
}

function readManifest() {
  const manifest = JSON.parse(
    fs.readFileSync(
      abs('scripts/release-identity-chain.manifest.json'),
      'utf8',
    ),
  );
  return manifest.links;
}

function canonicalJsonSafe(value) {
  try {
    return canonicalJson(value);
  } catch {
    return JSON.stringify(value);
  }
}

// Best-effort: has this tracked file changed in the working tree relative to
// HEAD? Returns true/false, or null if that can't be determined (untracked
// file, no git, etc.) -- used only as an informational hint in the report,
// never as the basis for MATCH/DRIFT itself.
function gitWorkingTreeChanged(relPath) {
  try {
    execFileSync('git', ['diff', '--quiet', '--', relPath], {
      cwd: ROOT,
      stdio: 'ignore',
    });
    return false;
  } catch (err) {
    if (err.status === 1) return true;
    return null;
  }
}

// Recursive structural diff between two JSON-ish values. Returns a flat list
// of { path, old, new } for every leaf that differs.
function diffValues(oldValue, newValue, pathPrefix) {
  const label = pathPrefix || '(root)';
  const oldIsObj = oldValue !== null && typeof oldValue === 'object';
  const newIsObj = newValue !== null && typeof newValue === 'object';
  if (!oldIsObj || !newIsObj) {
    if (canonicalJsonSafe(oldValue) !== canonicalJsonSafe(newValue)) {
      return [{ path: label, old: oldValue, new: newValue }];
    }
    return [];
  }
  if (Array.isArray(oldValue) !== Array.isArray(newValue)) {
    return [{ path: label, old: oldValue, new: newValue }];
  }
  if (Array.isArray(oldValue)) {
    if (canonicalJsonSafe(oldValue) === canonicalJsonSafe(newValue)) return [];
    const len = Math.max(oldValue.length, newValue.length);
    const diffs = [];
    for (let i = 0; i < len; i += 1) {
      diffs.push(
        ...diffValues(oldValue[i], newValue[i], `${pathPrefix}[${i}]`),
      );
    }
    return diffs;
  }
  if (canonicalJsonSafe(oldValue) === canonicalJsonSafe(newValue)) return [];
  const keys = [...new Set([...Object.keys(oldValue), ...Object.keys(newValue)])].sort();
  const diffs = [];
  keys.forEach((key) => {
    diffs.push(
      ...diffValues(
        oldValue[key],
        newValue[key],
        pathPrefix ? `${pathPrefix}.${key}` : key,
      ),
    );
  });
  return diffs;
}

function isIdentityField(fieldPath) {
  return /(_id|_digest|digest)$/i.test(fieldPath.split(/[.[]/).pop() || '');
}

// For links that declare a sourceEvidenceExport (a literal SOURCE_EVIDENCE_SPECS
// -style array of { source_path, source_snapshot_digest, ... } pinned inside
// the lib module), independently recompute each entry's digest straight from
// current bytes on disk. This tells us precisely which upstream file(s) the
// lib module's own pinned expectation no longer matches -- the thing that
// makes the full build() throw instead of returning a new value.
function checkSourceEvidence(link, mod) {
  if (!link.sourceEvidenceExport) return null;
  const specs = mod[link.sourceEvidenceExport];
  if (!Array.isArray(specs)) return null;
  return specs.map((spec) => {
    let currentBytes;
    let error = null;
    try {
      currentBytes = fs.readFileSync(abs(spec.source_path), 'utf8');
    } catch (err) {
      error = err.message;
    }
    const current = error
      ? null
      : contentId(link.sourceEvidenceDomain, {
        source_path: spec.source_path,
        source_bytes: currentBytes,
      });
    return {
      source_path: spec.source_path,
      pinned: spec.source_snapshot_digest,
      current,
      matches: !error && current === spec.source_snapshot_digest,
      error,
    };
  });
}

function recompute(link) {
  const mod = require(abs(link.module));
  const sourceEvidence = checkSourceEvidence(link, mod);
  let value = null;
  let blockedReason = null;
  try {
    let inputs;
    if (link.inputsExport) {
      const inputFixture = readJsonFile(link.inputsFixture);
      inputs = mod[link.inputsExport](inputFixture);
    }
    value = inputs === undefined
      ? mod[link.buildExport]()
      : mod[link.buildExport](inputs);
  } catch (err) {
    blockedReason = err.message;
  }
  return { value, blockedReason, sourceEvidence };
}

function evaluateLink(link) {
  if (link.mode === 'report-only') {
    return { link, status: 'REPORT_ONLY' };
  }
  if (!link.fixture) {
    return { link, status: 'REPORT_ONLY' };
  }
  const { value, blockedReason, sourceEvidence } = recompute(link);
  const movedSources = (sourceEvidence || []).filter((s) => !s.matches);
  if (blockedReason) {
    return {
      link,
      status: 'BLOCKED',
      blockedReason,
      movedSources,
    };
  }
  let current = null;
  try {
    current = readJsonFile(link.fixture);
  } catch (err) {
    return {
      link,
      status: 'BLOCKED',
      blockedReason: `could not read pinned fixture: ${err.message}`,
      movedSources,
      value,
    };
  }
  const matches = canonicalJsonSafe(current) === canonicalJsonSafe(value);
  const diffs = matches ? [] : diffValues(current, value, '');
  return {
    link,
    status: matches ? 'MATCH' : 'DRIFT',
    current,
    value,
    diffs,
    movedSources,
  };
}

function printLinkHeader(result) {
  const label = `${result.link.id} (${result.link.label || result.link.fixture || 'no fixture'})`;
  return `[${result.status}] ${label}`;
}

function printReportOnly(result) {
  const lines = [printLinkHeader(result)];
  if (result.link.fixture) lines.push(`  fixture: ${result.link.fixture}`);
  lines.push(`  note: ${result.link.note}`);
  return lines.join('\n');
}

function printUpstream(link) {
  return (link.upstream || []).map((p) => {
    const changed = gitWorkingTreeChanged(p);
    const marker = changed === true ? 'MODIFIED vs HEAD' : changed === false ? 'clean vs HEAD' : 'untracked/unknown';
    return `    - ${p} (${marker})`;
  }).join('\n');
}

function printMatch(result) {
  return `${printLinkHeader(result)}\n  fixture: ${result.link.fixture}`;
}

function printBlocked(result) {
  const lines = [printLinkHeader(result)];
  lines.push(`  fixture: ${result.link.fixture}`);
  lines.push(`  reason: ${result.blockedReason}`);
  if (result.movedSources.length) {
    lines.push('  upstream input(s) that moved relative to the lib module\'s own pinned expectation:');
    result.movedSources.forEach((s) => {
      lines.push(`    - ${s.source_path}`);
      lines.push(`        pinned:  ${s.pinned}`);
      lines.push(`        current: ${s.error ? `<error: ${s.error}>` : s.current}`);
    });
    lines.push('  Fix: update the pinned literal(s) in the lib module to match current bytes, then re-run this tool.');
  }
  lines.push('  upstream files declared for this link:');
  lines.push(printUpstream(result.link));
  return lines.join('\n');
}

function printDrift(result, { writing }) {
  const lines = [printLinkHeader(result)];
  lines.push(`  fixture: ${result.link.fixture}`);
  if (result.movedSources.length) {
    lines.push('  upstream input(s) that moved:');
    result.movedSources.forEach((s) => {
      lines.push(`    - ${s.source_path} (pinned ${s.pinned} -> current ${s.current})`);
    });
  }
  const identityDiffs = result.diffs.filter((d) => isIdentityField(d.path));
  const otherCount = result.diffs.length - identityDiffs.length;
  lines.push(`  ${result.diffs.length} field(s) differ (${identityDiffs.length} identity/digest field(s), ${otherCount} other field(s)):`);
  identityDiffs.forEach((d) => {
    lines.push(`    - ${d.path}`);
    lines.push(`        old: ${JSON.stringify(d.old)}`);
    lines.push(`        new: ${JSON.stringify(d.new)}`);
  });
  if (otherCount > 0) {
    lines.push(`    ... plus ${otherCount} non-identity field(s) (rerun with the field path filtered in if you need the full list)`);
  }
  lines.push('  upstream files declared for this link:');
  lines.push(printUpstream(result.link));
  lines.push(writing ? '  action: REWROTE fixture to the recomputed value' : '  action: (--check only) would rewrite this fixture under --write');
  return lines.join('\n');
}

function writeFixture(link, value) {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  fs.writeFileSync(abs(link.fixture), text, 'utf8');
}

function main() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const check = args.includes('--check') || !write;
  if (write && args.includes('--check')) {
    console.error('Pass either --check or --write, not both.');
    process.exit(2);
  }

  const links = readManifest();
  const results = links.map(evaluateLink);

  console.log(`Release-identity chain ${write ? 'regeneration (--write)' : 'check (--check)'}`);
  console.log(`Manifest: scripts/release-identity-chain.manifest.json (${links.length} link(s))\n`);

  let driftCount = 0;
  let blockedCount = 0;

  results.forEach((result) => {
    if (result.status === 'REPORT_ONLY') {
      console.log(printReportOnly(result));
    } else if (result.status === 'MATCH') {
      console.log(printMatch(result));
    } else if (result.status === 'BLOCKED') {
      blockedCount += 1;
      console.log(printBlocked(result));
    } else if (result.status === 'DRIFT') {
      driftCount += 1;
      if (write) {
        writeFixture(result.link, result.value);
      }
      console.log(printDrift(result, { writing: write }));
    }
    console.log('');
  });

  const recomputeLinks = results.filter((r) => r.status !== 'REPORT_ONLY');
  console.log('---');
  console.log(
    `${recomputeLinks.length} recompute link(s) checked: `
    + `${recomputeLinks.filter((r) => r.status === 'MATCH' || (write && r.status === 'DRIFT')).length} clean, `
    + `${write ? 0 : driftCount} drifted, `
    + `${blockedCount} blocked.`,
  );
  console.log(
    `${results.length - recomputeLinks.length} link(s) are report-only and were not mechanically checked.`,
  );

  if (write) {
    process.exit(blockedCount > 0 ? 1 : 0);
  }
  process.exit(driftCount > 0 || blockedCount > 0 ? 1 : 0);
}

main();
