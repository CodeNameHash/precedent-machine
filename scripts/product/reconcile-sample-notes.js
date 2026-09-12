#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────
   scripts/product/reconcile-sample-notes.js — Phase 5 sample reconciliation.

   Reconciles a lawyer's independent sample notes on an agreement against
   the V2 layered facts of that agreement's run (Phase 5 exit item:
   "Reconcile Ben's existing independent, detailed provision samples
   against the corresponding V2 agreement results"), and writes a Markdown
   report for the lawyer to mark up with severity and acceptance.

   Usage:
     node scripts/product/reconcile-sample-notes.js \
       --notes <file> --v2 <file> --out <file.md>

   --notes file shape: either
     { "note_batches": [ { "items": [ ... ] } ] }   (Olaplex shape), or
     { "notes": [ { "section": ..., "user_text": ... } ] }   (Apogee shape)
   --v2 file shape: the v2-facts.json array written by
     scripts/product/export-review-comparison-inputs.js.

   Exit code is always 0; the report file is the product.
   ───────────────────────────────────────────────────────────────────────── */

'use strict';

const fs = require('fs');
const { normaliseNoteFile, reconcileSampleNotes } = require('../../lib/product/sample-reconciliation');

function parseArgs(argv) {
  const args = { notes: null, v2: null, out: null };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--notes') args.notes = argv[i += 1];
    else if (argv[i] === '--v2') args.v2 = argv[i += 1];
    else if (argv[i] === '--out') args.out = argv[i += 1];
  }
  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadFacts(filePath) {
  const parsed = readJson(filePath);
  return Array.isArray(parsed) ? parsed : (parsed.v2Facts || parsed.facts || []);
}

function pct(share) {
  if (share === null || share === undefined) return '—';
  return `${Math.round(share * 1000) / 10}%`;
}

function escapeCell(value) {
  return String(value == null ? '' : value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function renderReport({ items, facts, error }) {
  const lines = [];
  lines.push('# Sample reconciliation', '');
  if (error) {
    lines.push(`Could not build the reconciliation: ${error}`, '');
    return lines.join('\n');
  }

  const { results, unmentionedFacts, summary } = reconcileSampleNotes({ items, facts });

  lines.push('## Summary', '');
  lines.push('| Status | Count |', '| --- | --- |');
  lines.push(`| MATCHED | ${summary.MATCHED} |`);
  lines.push(`| PARTIAL | ${summary.PARTIAL} |`);
  lines.push(`| MISSING | ${summary.MISSING} |`);
  lines.push(`| GAP | ${summary.GAP} |`);
  lines.push('');
  lines.push('Success rate unavailable until the lawyer marks severity.', '');

  lines.push('## Note items', '');
  lines.push('| Item | Section | Note | Status | Best fact | Overlap | Severity | Accepted |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const result of results) {
    const bestFact = result.best_fact ? result.best_fact.headline : '(none)';
    const cells = [
      escapeCell(result.item_id), escapeCell(result.section_reference), escapeCell(result.text),
      result.status, escapeCell(bestFact), pct(result.overlap_share), '', '',
    ];
    lines.push(`| ${cells.join(' | ')} |`);
  }
  lines.push('');

  lines.push('## Facts the notes do not mention', '');
  lines.push('Not errors -- these facts sit in a section a note referenced, but no note item matched them.', '');
  if (unmentionedFacts.length) {
    lines.push('| Fact | Section | Headline |', '| --- | --- | --- |');
    for (const fact of unmentionedFacts) {
      lines.push(`| ${escapeCell(fact.fact_id)} | ${escapeCell(fact.section_reference)} | ${escapeCell(fact.headline)} |`);
    }
  } else {
    lines.push('(none)');
  }
  lines.push('');

  return lines.join('\n');
}

function main() {
  const args = parseArgs(process.argv);
  let report;
  if (!args.notes || !args.v2 || !args.out) {
    report = renderReport({ error: 'usage: --notes <file> --v2 <file> --out <file.md>' });
  } else {
    try {
      const items = normaliseNoteFile(readJson(args.notes));
      const facts = loadFacts(args.v2);
      report = renderReport({ items, facts });
    } catch (e) {
      report = renderReport({ error: e.message });
    }
  }
  if (args.out) fs.writeFileSync(args.out, `${report}\n`);
  else process.stdout.write(`${report}\n`);
  process.exit(0);
}

main();
