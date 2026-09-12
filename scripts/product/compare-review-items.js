#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────
   scripts/product/compare-review-items.js — Phase 5B.6 comparison report.

   Maps a lawyer's V1 review items onto V2 layered facts from a rerun of the
   same agreement, so the lead can check whether each V1 finding is
   addressed. Writes a Markdown report; does not touch a network or database.

   Usage:
     node scripts/product/compare-review-items.js --v1 <file> --v2 <file> --out <file>

   --v1 file shape: { "items": [ ... V1 review items ... ], "spans": { span_id: { start_byte, end_byte, exact_text } } }
   --v2 file shape: [ ... V2 facts (FACT_COMPONENTS/V2) ... ]

   Exit code is always 0; the report file is the product.
   ───────────────────────────────────────────────────────────────────────── */

'use strict';

const fs = require('fs');
const { compareReviewItems, summariseComparison } = require('../../lib/product/review-comparison');

function parseArgs(argv) {
  const args = { v1: null, v2: null, out: null };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--v1') args.v1 = argv[i += 1];
    else if (argv[i] === '--v2') args.v2 = argv[i += 1];
    else if (argv[i] === '--out') args.out = argv[i += 1];
  }
  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadV1(filePath) {
  const parsed = readJson(filePath);
  return { v1Items: parsed.items || [], v1Spans: parsed.spans || {} };
}

function loadV2(filePath) {
  const parsed = readJson(filePath);
  return Array.isArray(parsed) ? parsed : (parsed.facts || []);
}

function pct(share) {
  return `${Math.round(share * 1000) / 10}%`;
}

function renderReport({ v1, v2, error }) {
  const lines = [];
  lines.push('# V1-to-V2 review comparison', '');
  if (error) {
    lines.push(`Could not build the comparison: ${error}`, '');
    return lines.join('\n');
  }

  const results = compareReviewItems({ v1Items: v1.v1Items, v1Spans: v1.v1Spans, v2Facts: v2 });
  const summary = summariseComparison(results);

  lines.push('## Summary', '');
  lines.push('| Status | Count |', '| --- | --- |');
  lines.push(`| MATCHED | ${summary.byStatus.MATCHED} |`);
  lines.push(`| PARTIAL | ${summary.byStatus.PARTIAL} |`);
  lines.push(`| UNMATCHED | ${summary.byStatus.UNMATCHED} |`);
  lines.push('');
  lines.push('| Section | MATCHED | PARTIAL | UNMATCHED |', '| --- | --- | --- | --- |');
  for (const section of Object.keys(summary.bySection).sort()) {
    const counts = summary.bySection[section];
    lines.push(`| ${section} | ${counts.MATCHED} | ${counts.PARTIAL} | ${counts.UNMATCHED} |`);
  }
  lines.push('');

  lines.push('## Items', '');
  for (const result of results) {
    lines.push(`### ${result.section_reference} — ${result.v1_item_id} (${result.status})`, '');
    lines.push(`- Decision: ${result.decision}`);
    lines.push(`- Comment: ${result.comment ? `"${result.comment}"` : '(none)'}`);
    lines.push(`- V1 statement: ${result.v1_statement}`);
    if (result.matches.length) {
      lines.push('- Matches:');
      for (const match of result.matches) {
        lines.push(`  - ${match.headline_text} — overlap ${pct(match.overlap_share)} (${match.overlap_bytes} bytes, fact ${match.fact_id})`);
      }
    } else {
      lines.push('- Matches: (none)');
    }
    lines.push('');
  }

  return lines.join('\n');
}

function main() {
  const args = parseArgs(process.argv);
  let report;
  if (!args.v1 || !args.v2 || !args.out) {
    report = renderReport({ error: 'usage: --v1 <file> --v2 <file> --out <file>' });
  } else {
    try {
      const v1 = loadV1(args.v1);
      const v2 = loadV2(args.v2);
      report = renderReport({ v1, v2 });
    } catch (e) {
      report = renderReport({ error: e.message });
    }
  }
  if (args.out) fs.writeFileSync(args.out, `${report}\n`);
  else process.stdout.write(`${report}\n`);
  process.exit(0);
}

main();
