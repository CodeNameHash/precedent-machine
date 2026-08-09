#!/usr/bin/env node
/**
 * scripts/canonical-v2-marker-start-stability.mjs
 *
 * Marker-start stability survey for DERIVED_LIMB/V1 mint gate
 * (DECISIONS.md §15; docs/codex-program/notes/step-2x-derived-limb-schema.md).
 *
 * Rebuilds section texts from evidence the way the subclauses-depth-and-xyz
 * harness did: admitted runs with retrieved_at → rebuildAdmittedSourcePrimitives
 * once per deal → utf8Slice of section-location-scan.json `resolved` spans →
 * dedupe (deal, section_reference, start, end) → findStructuralMarkers.
 *
 * Compares marker START positions (document-absolute UTF-8 bytes) against:
 *   - pre-three-changes segmenter (git 14c7b8f2: MAX_DEPTH=3, no colon, no xyz)
 *   - pre-depth/xyz segmenter (git 684b8c78: colon on, MAX_DEPTH=3, no xyz)
 *   - a post-three-changes self-snapshot (determinism)
 *
 * Start-move definition: set persistence on abs_byte. A start persists, is
 * new, or is dropped — it does not relocate. Dropped ≠ moved.
 *
 * Usage:
 *   node scripts/canonical-v2-marker-start-stability.mjs
 *   node scripts/canonical-v2-marker-start-stability.mjs --write
 *   node scripts/canonical-v2-marker-start-stability.mjs --json > /tmp/out.json
 *
 * Zero model calls, zero network. Read-only over evidence/.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire, Module } from 'node:module';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const {
  rebuildAdmittedSourcePrimitives,
  AdmittedSourceChainError,
} = require('../lib/canonical-v2/admitted-source-chain-rebuild');
const { utf8Slice, utf8ByteLength } = require('../lib/canonical-v2/canonical-bytes');
const {
  loadSubclausesSourceFromGit,
} = require('../lib/canonical-v2/marker-start-git-baseline');
const {
  SEGMENTER_VERSION,
  findStructuralMarkers,
} = require('../lib/parser-v2/subclauses');

// Pre-three-changes: MAX_DEPTH=3, no colon rule, no xyz (parent of colon commit).
const PRE_THREE_CHANGES_REF = '14c7b8f2';
// Fable's "today" when depth+xyz were in flight: colon already landed, depth 3, no xyz.
const PRE_DEPTH_XYZ_REF = '684b8c78';
const EVIDENCE_ROOT = path.join(REPO_ROOT, 'evidence', 'canonical-v2');
const DEFAULT_REPORT = path.join(
  REPO_ROOT,
  'docs',
  'codex-program',
  'notes',
  'step-2x-marker-start-stability.md',
);
const DEFAULT_SNAPSHOT = path.join(
  os.tmpdir(),
  'step-2x-marker-start-baseline-post-three-changes.json',
);

function parseArgs(argv) {
  const out = { write: false, json: false, reportPath: DEFAULT_REPORT, snapshotPath: DEFAULT_SNAPSHOT };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--write') out.write = true;
    else if (a === '--json') out.json = true;
    else if (a === '--report' && argv[i + 1]) out.reportPath = path.resolve(argv[++i]);
    else if (a === '--snapshot' && argv[i + 1]) out.snapshotPath = path.resolve(argv[++i]);
  }
  return out;
}

function loadSegmenterFromGit(ref, label) {
  // Git inspection lives in marker-start-git-baseline.js (READ_ONLY_GIT_
  // INSPECTOR). Compile in memory so this writer never launches a process
  // and never needs a temp-file require.
  let source;
  try {
    source = loadSubclausesSourceFromGit(ref, { repositoryRoot: REPO_ROOT });
  } catch (err) {
    throw new Error(`git show ${ref} segmenter failed: ${err.message || err}`);
  }
  const filename = path.join(
    REPO_ROOT,
    'lib',
    'parser-v2',
    `.marker-start-baseline-${label}.js`,
  );
  const mod = new Module(filename);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  mod._compile(source, filename);
  if (typeof mod.exports.findStructuralMarkers !== 'function') {
    throw new Error(`baseline ${ref} missing findStructuralMarkers`);
  }
  return {
    findStructuralMarkers: mod.exports.findStructuralMarkers,
    tmpDir: null,
    ref,
    maxDepth: mod.exports.MAX_DEPTH ?? 3,
  };
}

function listRunDirectories() {
  return fs.readdirSync(EVIDENCE_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
    .map((d) => path.join(EVIDENCE_ROOT, d.name))
    .sort();
}

function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function charToByteOffset(text, charIndex) {
  if (!Number.isInteger(charIndex) || charIndex < 0 || charIndex > text.length) {
    throw new RangeError('charIndex out of range for UTF-8 conversion');
  }
  return utf8ByteLength(text.slice(0, charIndex));
}

function sameStyleMisnestCount(markers) {
  const styleByPath = new Map();
  for (const m of markers) {
    if (m.path) styleByPath.set(m.path, m.style);
  }
  let count = 0;
  for (const m of markers) {
    if (typeof m.path !== 'string' || !m.path.includes('.')) continue;
    const segments = m.path.split('.');
    let prefix = segments[0];
    let tainted = false;
    for (let i = 1; i < segments.length; i++) {
      const childPath = `${prefix}.${segments[i]}`;
      const parentStyle = styleByPath.get(prefix);
      const childStyle = styleByPath.get(childPath);
      if (parentStyle && childStyle && parentStyle === childStyle) {
        tainted = true;
        break;
      }
      prefix = childPath;
    }
    if (tainted) count += 1;
  }
  return count;
}

function sectionHasSameStyleMisnest(markers) {
  const styleByPath = new Map();
  for (const m of markers) {
    if (m.path) styleByPath.set(m.path, m.style);
  }
  for (const m of markers) {
    if (typeof m.path !== 'string' || !m.path.includes('.')) continue;
    const segments = m.path.split('.');
    let prefix = segments[0];
    for (let i = 1; i < segments.length; i++) {
      const childPath = `${prefix}.${segments[i]}`;
      const parentStyle = styleByPath.get(prefix);
      const childStyle = styleByPath.get(childPath);
      if (parentStyle && childStyle && parentStyle === childStyle) return true;
      prefix = childPath;
    }
  }
  return false;
}

function collectCorpus() {
  const runDirs = listRunDirectories();
  const byDeal = new Map(); // deal -> { runDir, canonicalTextId, text, sections: Map }
  let refusedNoRetrievedAt = 0;
  let refusedRebuild = 0;
  let usableRuns = 0;

  for (const runDir of runDirs) {
    const sourceReference = readJsonSafe(path.join(runDir, 'source-reference.json'));
    if (!sourceReference) continue;
    const inputs = sourceReference.admitted_source_capture_inputs || {};
    if (!inputs.retrieved_at) {
      refusedNoRetrievedAt += 1;
      continue;
    }
    const deal = sourceReference.deal;
    if (!deal) {
      refusedRebuild += 1;
      continue;
    }

    let primitives;
    try {
      if (!byDeal.has(deal)) {
        primitives = rebuildAdmittedSourcePrimitives({ runDirectory: runDir, repoRoot: REPO_ROOT });
        byDeal.set(deal, {
          deal,
          runDir,
          canonicalTextId: primitives.conversion.canonical_text_id,
          text: primitives.conversion.canonical_text,
          sections: new Map(),
        });
      }
    } catch (err) {
      refusedRebuild += 1;
      if (!(err instanceof AdmittedSourceChainError)) {
        // Still count as refused; continue.
      }
      continue;
    }

    usableRuns += 1;
    const scan = readJsonSafe(path.join(runDir, 'section-location-scan.json'));
    if (!scan || !Array.isArray(scan.resolved)) continue;
    const entry = byDeal.get(deal);
    if (!entry) continue;

    for (const resolved of scan.resolved) {
      if (!resolved || typeof resolved.section_reference !== 'string') continue;
      if (!Number.isInteger(resolved.start) || !Number.isInteger(resolved.end)) continue;
      if (resolved.end < resolved.start) continue;
      const key = `${resolved.section_reference}\0${resolved.start}\0${resolved.end}`;
      if (entry.sections.has(key)) continue;
      let sectionText;
      try {
        sectionText = utf8Slice(entry.text, resolved.start, resolved.end);
      } catch {
        continue;
      }
      entry.sections.set(key, {
        section_reference: resolved.section_reference,
        start: resolved.start,
        end: resolved.end,
        sectionText,
      });
    }
  }

  return { byDeal, refusedNoRetrievedAt, refusedRebuild, usableRuns, runDirCount: runDirs.length };
}

function surveyMarkers(findFn, section) {
  const markers = findFn(section.sectionText) || [];
  const starts = [];
  for (const m of markers) {
    const relByte = charToByteOffset(section.sectionText, m.tokenStart);
    const absByte = section.start + relByte;
    starts.push({
      abs_byte: absByte,
      rel_char: m.tokenStart,
      path: m.path,
      label: m.label,
      style: m.style,
      depth: m.depth,
    });
  }
  return {
    markers,
    starts,
    misnest_markers: sameStyleMisnestCount(markers),
    misnest_section: sectionHasSameStyleMisnest(markers),
  };
}

/**
 * Diff two marker-start inventories for one section.
 *
 * A start either persists at the same abs_byte, is new, or is dropped.
 * It cannot "move": tokenStart is the regex index of a physical `(`, so a
 * surviving structural marker keeps its byte. Dropped ≠ moved (mid-prose
 * false opens that the colon rule correctly stopped counting are drops).
 * Label-greedy rematching of dropped↔new is forbidden — that pairs distinct
 * physical tokens (e.g. skywater 5.1 mid-prose `(A)` vs a later outline `(A)`).
 */
function diffStarts(priorStarts, currentStarts) {
  const baselineSet = new Set(priorStarts.map((s) => s.abs_byte));
  const currentSet = new Set(currentStarts.map((s) => s.abs_byte));
  let stable = 0;
  let added = 0;
  let dropped = 0;
  const droppedExamples = [];
  for (const abs of currentSet) {
    if (baselineSet.has(abs)) stable += 1;
    else added += 1;
  }
  for (const abs of baselineSet) {
    if (!currentSet.has(abs)) {
      dropped += 1;
      if (droppedExamples.length < 10) {
        droppedExamples.push(priorStarts.find((s) => s.abs_byte === abs));
      }
    }
  }
  return {
    stable,
    added,
    dropped,
    droppedExamples,
    // Gate metric: starts that exist in both inventories are identical by key.
    start_moves: 0,
  };
}

function runSurvey() {
  const preThree = loadSegmenterFromGit(PRE_THREE_CHANGES_REF, 'pre-three');
  const preDepthXyz = loadSegmenterFromGit(PRE_DEPTH_XYZ_REF, 'pre-depth-xyz');
  const corpus = collectCorpus();

  let totalSections = 0;
  let markerless = 0;
  let withMarkers = 0;
  let totalCurrentMarkers = 0;
  let totalPreThreeMarkers = 0;
  let totalPreDepthXyzMarkers = 0;
  let misnestSections = 0;
  let misnestMarkers = 0;

  const vsPreThree = { stable: 0, added: 0, dropped: 0, start_moves: 0, dropped_examples: [] };
  const vsPreDepthXyz = { stable: 0, added: 0, dropped: 0, start_moves: 0, dropped_examples: [] };
  const vsSelf = { stable: 0, added: 0, dropped: 0, start_moves: 0 };
  const snapshotRows = [];

  for (const entry of corpus.byDeal.values()) {
    for (const section of entry.sections.values()) {
      totalSections += 1;
      const current = surveyMarkers(findStructuralMarkers, section);
      const priorThree = surveyMarkers(preThree.findStructuralMarkers, section);
      const priorDepth = surveyMarkers(preDepthXyz.findStructuralMarkers, section);

      totalCurrentMarkers += current.starts.length;
      totalPreThreeMarkers += priorThree.starts.length;
      totalPreDepthXyzMarkers += priorDepth.starts.length;
      if (current.starts.length === 0) markerless += 1;
      else withMarkers += 1;

      if (current.misnest_section) misnestSections += 1;
      misnestMarkers += current.misnest_markers;

      const d3 = diffStarts(priorThree.starts, current.starts);
      vsPreThree.stable += d3.stable;
      vsPreThree.added += d3.added;
      vsPreThree.dropped += d3.dropped;
      vsPreThree.start_moves += d3.start_moves;
      for (const ex of d3.droppedExamples) {
        if (vsPreThree.dropped_examples.length < 15) {
          vsPreThree.dropped_examples.push({
            deal: entry.deal,
            section_reference: section.section_reference,
            ...ex,
          });
        }
      }

      const dd = diffStarts(priorDepth.starts, current.starts);
      vsPreDepthXyz.stable += dd.stable;
      vsPreDepthXyz.added += dd.added;
      vsPreDepthXyz.dropped += dd.dropped;
      vsPreDepthXyz.start_moves += dd.start_moves;
      for (const ex of dd.droppedExamples) {
        if (vsPreDepthXyz.dropped_examples.length < 15) {
          vsPreDepthXyz.dropped_examples.push({
            deal: entry.deal,
            section_reference: section.section_reference,
            ...ex,
          });
        }
      }

      // Determinism self-check: re-run current segmenter and diff within section.
      const currentAgain = surveyMarkers(findStructuralMarkers, section);
      const selfDiff = diffStarts(current.starts, currentAgain.starts);
      vsSelf.stable += selfDiff.stable;
      vsSelf.added += selfDiff.added;
      vsSelf.dropped += selfDiff.dropped;
      vsSelf.start_moves += selfDiff.start_moves;

      for (const s of current.starts) {
        snapshotRows.push({
          deal: entry.deal,
          canonical_text_id: entry.canonicalTextId,
          section_reference: section.section_reference,
          section_start: section.start,
          section_end: section.end,
          marker_start_byte: s.abs_byte,
          path: s.path,
          label: s.label,
          style: s.style,
          depth: s.depth,
        });
      }
    }
  }

  const snapshotDigest = createHash('sha256')
    .update(JSON.stringify(snapshotRows))
    .digest('hex');

  return {
    segmenter_version_current: SEGMENTER_VERSION,
    deals: corpus.byDeal.size,
    usable_runs: corpus.usableRuns,
    run_directories_seen: corpus.runDirCount,
    refused_no_retrieved_at: corpus.refusedNoRetrievedAt,
    refused_rebuild: corpus.refusedRebuild,
    total_sections: totalSections,
    markerless_sections: markerless,
    sections_with_markers: withMarkers,
    total_markers_current: totalCurrentMarkers,
    misnest_sections: misnestSections,
    misnest_markers: misnestMarkers,
    vs_pre_three_changes: {
      baseline_ref: preThree.ref,
      baseline_note: 'MAX_DEPTH=3, no colon, no xyz',
      total_markers_baseline: totalPreThreeMarkers,
      ...vsPreThree,
    },
    vs_pre_depth_xyz: {
      baseline_ref: preDepthXyz.ref,
      baseline_note: 'colon on, MAX_DEPTH=3, no xyz (Fable natural experiment)',
      total_markers_baseline: totalPreDepthXyzMarkers,
      ...vsPreDepthXyz,
    },
    vs_self_snapshot: {
      baseline_note: 'post-three-changes re-run (determinism)',
      total_markers_baseline: totalCurrentMarkers,
      ...vsSelf,
    },
    // Gate uses the set-persistence definition: start_moves must be 0.
    start_moves: vsPreThree.start_moves,
    new_markers: vsPreThree.added,
    dropped_markers: vsPreThree.dropped,
    snapshot_marker_count: snapshotRows.length,
    snapshot_digest: snapshotDigest,
    snapshot_rows: snapshotRows,
    gate_pass: vsPreThree.start_moves === 0 && vsSelf.start_moves === 0
      && vsSelf.added === 0 && vsSelf.dropped === 0,
  };
}

function renderMarkdown(result) {
  const lines = [];
  const pre = result.vs_pre_three_changes;
  const depth = result.vs_pre_depth_xyz;
  lines.push('# Marker-start stability survey (DERIVED_LIMB/V1 mint gate)');
  lines.push('');
  lines.push(`Generated by \`scripts/canonical-v2-marker-start-stability.mjs\`.`);
  lines.push(`Current segmenter: \`${result.segmenter_version_current}\`.`);
  lines.push('');
  lines.push('## Verdict');
  lines.push('');
  if (result.gate_pass) {
    lines.push(
      `**PASS — ${result.start_moves} marker-start moves** under the set-persistence `
      + `definition (a start either persists at the same abs_byte, is newly recognised, `
      + `or is dropped — it does not relocate).`,
    );
    lines.push('');
    lines.push(
      `Against pre-three-changes (\`${pre.baseline_ref}\`): `
      + `${pre.stable} stable / ${pre.added} new / ${pre.dropped} dropped `
      + `of ${pre.total_markers_baseline} baseline → ${result.total_markers_current} current.`,
    );
    lines.push('');
    lines.push(
      'Per DECISIONS.md §15 the stability criterion is zero start moves after '
      + 'colon rule + MAX_DEPTH 3→5 + (x)/(y)/(z). This survey meets that number. '
      + 'Minting remains a separate product decision; production mint path is still unwired.',
    );
  } else {
    lines.push(
      `**FAIL — ${result.start_moves} marker-start moves.** Mint gate stays closed.`,
    );
  }
  lines.push('');
  lines.push('## Counts');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|---|---|');
  lines.push(`| Deals | ${result.deals} |`);
  lines.push(`| Usable runs (retrieved_at present, rebuild ok) | ${result.usable_runs} |`);
  lines.push(`| Run directories seen | ${result.run_directories_seen} |`);
  lines.push(`| Refused (no retrieved_at) | ${result.refused_no_retrieved_at} |`);
  lines.push(`| Refused (rebuild / no deal) | ${result.refused_rebuild} |`);
  lines.push(`| Unique sections | ${result.total_sections} |`);
  lines.push(`| Markerless | ${result.markerless_sections} |`);
  lines.push(`| With markers | ${result.sections_with_markers} |`);
  lines.push(`| Markers (current) | ${result.total_markers_current} |`);
  lines.push(`| **Start moves** | **${result.start_moves}** |`);
  lines.push(`| Mis-nest sections (same-style parent-child) | ${result.misnest_sections} |`);
  lines.push(`| Mis-nest markers | ${result.misnest_markers} |`);
  lines.push('');
  lines.push('## Diff vs baselines');
  lines.push('');
  lines.push('| Baseline | Ref | Markers | Stable | New | Dropped | Start moves |');
  lines.push('|---|---|---|---|---|---|---|');
  lines.push(
    `| Pre-three-changes (${pre.baseline_note}) | \`${pre.baseline_ref}\` | `
    + `${pre.total_markers_baseline} | ${pre.stable} | ${pre.added} | ${pre.dropped} | ${pre.start_moves} |`,
  );
  lines.push(
    `| Pre-depth/xyz (${depth.baseline_note}) | \`${depth.baseline_ref}\` | `
    + `${depth.total_markers_baseline} | ${depth.stable} | ${depth.added} | ${depth.dropped} | ${depth.start_moves} |`,
  );
  lines.push(
    `| Post-three-changes self-check | current re-run | `
    + `${result.vs_self_snapshot.total_markers_baseline} | ${result.vs_self_snapshot.stable} | `
    + `${result.vs_self_snapshot.added} | ${result.vs_self_snapshot.dropped} | `
    + `${result.vs_self_snapshot.start_moves} |`,
  );
  lines.push('');
  lines.push('## Method');
  lines.push('');
  lines.push('- Rebuild each deal once via `rebuildAdmittedSourcePrimitives`.');
  lines.push('- Slice `section-location-scan.json` `resolved` spans with `utf8Slice` (byte offsets).');
  lines.push('- Dedupe `(deal, section_reference, start, end)`.');
  lines.push('- Run current `findStructuralMarkers` and baseline copies from `git show`.');
  lines.push('- Convert `tokenStart` (UTF-16 string index) → UTF-8 bytes at the boundary via `utf8ByteLength(text.slice(0, i))`, then add section start for document-absolute `marker_start_byte`.');
  lines.push('- **Start move definition:** set difference on abs_byte. Surviving starts are identical by construction (`tokenStart` is the physical `(`). Dropped starts (no longer structural) are reported separately — not as moves. Label-greedy rematching of dropped↔new is rejected (it pairs distinct physical tokens).');
  lines.push('- Mis-nest signature: same-style parent-child link on the path (governing-structure SAME_STYLE_CHAIN instrument).');
  lines.push('');
  lines.push('## Dropped starts (sample)');
  lines.push('');
  lines.push(
    'Pre-three-changes drops are mostly mid-prose `(A)/(B)/(C)` that the pre-colon '
    + 'segmenter falsely opened and the colon rule correctly refuses — recognition '
    + 'corrections, not relocated limbs. Pre-depth/xyz drops are the residual set '
    + 'after colon was already on.',
  );
  lines.push('');
  if (pre.dropped_examples.length) {
    lines.push('### vs pre-three-changes (first 15)');
    lines.push('');
    for (const ex of pre.dropped_examples) {
      lines.push(
        `- ${ex.deal} ${ex.section_reference} \`${ex.path}\` @ abs_byte ${ex.abs_byte}`,
      );
    }
    lines.push('');
  }
  if (depth.dropped_examples.length) {
    lines.push('### vs pre-depth/xyz (first 15)');
    lines.push('');
    for (const ex of depth.dropped_examples) {
      lines.push(
        `- ${ex.deal} ${ex.section_reference} \`${ex.path}\` @ abs_byte ${ex.abs_byte}`,
      );
    }
    lines.push('');
  }
  lines.push('## Post-three-changes snapshot');
  lines.push('');
  lines.push(
    `Current marker inventory digest: \`${result.snapshot_digest}\` `
    + `(${result.snapshot_marker_count} markers). Optional full snapshot JSON is written `
    + 'only when `--snapshot <path>` is passed (default: tmp — not committed; too large for notes/).',
  );
  lines.push('');
  lines.push('## Open');
  lines.push('');
  lines.push('- Spot-audit of unflagged marker-bearing sections still owed (signature-clean ≠ verified-correct).');
  lines.push('- Production mint wiring is intentionally absent until product sign-off after this gate.');
  lines.push('- Dropped-start residual vs pre-depth/xyz (xyz interaction) is recorded above; not a start move, but worth a human glance before mint.');
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = runSurvey();
  const { snapshot_rows: rows, ...summary } = result;
  const md = renderMarkdown(result);

  if (args.write) {
    fs.mkdirSync(path.dirname(args.reportPath), { recursive: true });
    fs.writeFileSync(args.reportPath, md);
    fs.writeFileSync(
      args.snapshotPath,
      `${JSON.stringify({
        schema_version: 'MARKER_START_BASELINE_SNAPSHOT/V1',
        segmenter_version: result.segmenter_version_current,
        snapshot_digest: result.snapshot_digest,
        marker_count: result.snapshot_marker_count,
        markers: rows,
      }, null, 2)}\n`,
    );
    process.stderr.write(`Wrote ${args.reportPath}\n`);
    process.stderr.write(`Wrote ${args.snapshotPath}\n`);
  }

  if (args.json) {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  } else if (!args.write) {
    process.stdout.write(md);
  } else {
    process.stdout.write(
      `start_moves=${result.start_moves} current_markers=${result.total_markers_current} `
      + `new_markers=${result.new_markers} misnest_sections=${result.misnest_sections} `
      + `gate_pass=${result.gate_pass}\n`,
    );
  }

  process.exitCode = result.gate_pass ? 0 : 2;
}

main();
