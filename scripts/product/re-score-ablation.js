#!/usr/bin/env node
'use strict';

// Plan findings (199g) and (199h), work packages E14 and E15: re-scores a
// finished ablation job's rows with the comparison matcher as it now
// stands (lib/product/generation-comparison.js matchFacts: a stored fact
// scored on its OWN bytes outside the section's chapeau span when any
// remain, every stored fact its best live cover, a shared counterpart
// BUNDLED) beside the rule the job recorded (the same, chapeau bytes
// counted), and prints the rows that change. Reads only; no model call,
// no database, nothing written to the job dir.
//
//   node scripts/product/re-score-ablation.js <job dir> [<job dir> ...] [--json <file>] [--dump <section>:<summary words>]
//
// A job dir holds ablation-rows.json (the stored run's tables, dumped by
// the launcher), analysis/stored.analysis.json, analysis/<variant>.analysis.json
// and ablation.json (the recorded rows). The baseline is built as the live
// comparison built it (plan finding (199h)): the stored side from the
// snapshot through cost-ablation's storedFactsForNode, the live side from
// the variant's analysis file with the compiled OWN component bytes and no
// span fallback, through compareFacts with no chapeau ranges; it must
// equal the recorded row, and the output says when it does not. The
// earlier re-score derived both sides from the analysis files alone, and
// the output names the facts that derivation treated differently
// (`drift`). --dump prints, as JSON, the component rows of the stored
// facts of that section whose summary contains the words, and of every
// live fact that overlaps them, the fixture for a pin.

const fs = require('node:fs');
const path = require('node:path');
const { chapeauRangesOf, factRanges, mergeRanges, overlapBytes, totalBytes } = require('../../lib/product/generation-comparison');
const { compareFacts, storedFactsForNode } = require('../../lib/product/cost-ablation');

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function readAnalysis(file) { const parsed = readJson(file); return parsed && parsed.analysis ? parsed.analysis : parsed; }
function readIfPresent(file, reader = readJson) { try { return reader(file); } catch { return null; } }

function summaryOf(fact) {
  return (fact.headline && fact.headline.summary) || fact.statement || (fact.headline && fact.headline.label) || fact.proposal_id || fact.client_ref || '?';
}

// The live facts of a node as the live comparison took them: VALID, the
// OWN component bytes, no span fallback.
function liveFactsOf(analysis, nodeId) {
  return (analysis.proposals || []).filter((fact) => fact.structure_node_id === nodeId && fact.validation_status === 'VALID');
}

// The stored facts of a node from the analysis file alone, as the live
// comparison would read them (used when the snapshot is absent).
function storedFactsFromAnalysis(analysis, nodeId) {
  const storedFacts = (analysis.proposals || []).filter((fact) => fact.structure_node_id === nodeId && (fact.validation_status || 'VALID') === 'VALID')
    .map((fact) => ({ proposal_id: fact.proposal_id, family_key: fact.family_key, subtype_key: fact.subtype_key, summary: summaryOf(fact), ranges: factRanges(fact, new Map()) }));
  return { storedFacts, chapeauRanges: chapeauRangesOf(analysis.spans || [], nodeId), storedValid: storedFacts };
}

// What the earlier re-score did differently from the live comparison, per
// fact: the span-id fallback (a fact without OWN byte components took its
// cited spans whole) on either side, and the stored tree read from the
// analysis file (children one level down only) against the snapshot's rows.
function driftOf({ storedAnalysis, liveAnalysis, nodeId, storedFacts }) {
  const storedSpans = new Map((storedAnalysis.spans || []).map((span) => [span.span_id, span]));
  const liveSpans = new Map((liveAnalysis.spans || []).map((span) => [span.span_id, span]));
  const drift = { stored_fallback: [], stored_bytes_differ: [], live_fallback: [], live_held_counted: [] };
  const byId = new Map(storedFacts.map((fact) => [fact.proposal_id, fact]));
  for (const fact of (storedAnalysis.proposals || []).filter((item) => item.structure_node_id === nodeId)) {
    const strict = factRanges(fact, new Map());
    const loose = factRanges(fact, storedSpans);
    if (strict.length === 0 && loose.length > 0) drift.stored_fallback.push({ proposal_id: fact.proposal_id, summary: summaryOf(fact), span_bytes: totalBytes(loose) });
    const snapshot = byId.get(fact.proposal_id);
    if (snapshot && strict.length > 0 && totalBytes(mergeRanges(snapshot.ranges)) !== totalBytes(strict)) drift.stored_bytes_differ.push({ proposal_id: fact.proposal_id, summary: summaryOf(fact), snapshot_bytes: totalBytes(mergeRanges(snapshot.ranges)), analysis_bytes: totalBytes(strict) });
  }
  for (const fact of (liveAnalysis.proposals || []).filter((item) => item.structure_node_id === nodeId)) {
    const strict = factRanges(fact, new Map());
    const loose = factRanges(fact, liveSpans);
    if (fact.validation_status === 'VALID' && strict.length === 0 && loose.length > 0) drift.live_fallback.push({ proposal_id: fact.proposal_id || fact.client_ref, summary: summaryOf(fact), span_bytes: totalBytes(loose) });
    if (fact.validation_status !== 'VALID' && (fact.validation_status || 'VALID') === 'VALID') drift.live_held_counted.push({ proposal_id: fact.proposal_id || fact.client_ref, summary: summaryOf(fact) });
  }
  return drift;
}

function recordedSection(ablation, variant, reference) {
  if (!Array.isArray(ablation)) return null;
  const entry = ablation.find((item) => item && item.variant === variant);
  return entry && Array.isArray(entry.sections) ? entry.sections.find((row) => row.section_reference === reference) || null : null;
}

// The recorded row is reproduced when its stored, matched, partial and
// unmatched agree; `new` is compared apart (plan finding (199h), (c)):
// the matcher since (199g) resolves a tie on equal shares by the live
// fact's own covered bytes where the job's code took the first live fact
// in order, so a stored fact covered whole by two live facts may take the
// other one, the statuses unchanged and the count of live facts no stored
// fact took moved by one.
const sameCounts = (left, right) => Boolean(left && right) && ['stored', 'matched', 'partial', 'unmatched'].every((key) => Number(left[key]) === Number(right[key]));
const newDiffers = (left, right) => Boolean(left && right) && Number(left.new) !== Number(right.new);

function rescoreJobDir(dir) {
  const analysisDir = path.join(dir, 'analysis');
  const storedAnalysis = readAnalysis(path.join(analysisDir, 'stored.analysis.json'));
  const snapshot = readIfPresent(path.join(dir, 'ablation-rows.json'));
  const tables = snapshot && snapshot.tables ? snapshot.tables : null;
  const ablation = readIfPresent(path.join(dir, 'ablation.json'));
  const variantFiles = fs.readdirSync(analysisDir).filter((name) => name.endsWith('.analysis.json') && name !== 'stored.analysis.json').sort();
  const variants = [];
  for (const file of variantFiles) {
    const variant = file.replace(/\.analysis\.json$/, '');
    const analysis = readAnalysis(path.join(analysisDir, file));
    const sections = [];
    for (const section of analysis.sections || []) {
      const nodeId = section.structure_node_id;
      const storedSide = tables ? storedFactsForNode(tables, nodeId) : storedFactsFromAnalysis(storedAnalysis, nodeId);
      const variantFacts = liveFactsOf(analysis, nodeId);
      const before = compareFacts({ storedFacts: storedSide.storedFacts, variantFacts });
      const after = compareFacts({ storedFacts: storedSide.storedFacts, variantFacts, chapeauRanges: storedSide.chapeauRanges });
      const liveById = new Map(variantFacts.map((fact) => [fact.proposal_id || fact.client_ref, fact]));
      const label = (id) => (id && liveById.has(id) ? summaryOf(liveById.get(id)) : null);
      const changes = before.rows.map((row, index) => ({ row, next: after.rows[index] }))
        .filter(({ row, next }) => row.status !== next.status || row.counterpart !== next.counterpart || Boolean(row.bundled) !== Boolean(next.bundled))
        .map(({ row, next }) => ({ proposal_id: row.proposal_id, summary: row.summary, old_status: row.status, old_bundled: Boolean(row.bundled), old_share: row.share, old_counterpart: label(row.counterpart), new_status: next.status, new_bundled: Boolean(next.bundled), new_share: next.share, new_counterpart: label(next.counterpart), scored_bytes: next.scored_bytes }));
      const recorded = recordedSection(ablation, variant, section.section_reference);
      const recordedCounts = recorded && recorded.comparison ? recorded.comparison.counts : null;
      const recordedRows = recorded && recorded.comparison && Array.isArray(recorded.comparison.rows) ? recorded.comparison.rows : null;
      const rowDrift = recordedRows ? before.rows.filter((row) => { const was = recordedRows.find((item) => item.proposal_id === row.proposal_id); return was && (was.status !== row.status || (was.counterpart || null) !== (row.counterpart || null)); }).map((row) => ({ proposal_id: row.proposal_id, summary: row.summary, recorded: recordedRows.find((item) => item.proposal_id === row.proposal_id).status, baseline: row.status })) : [];
      sections.push({
        section_reference: section.section_reference, node_id: nodeId, stored_source: tables ? 'ablation-rows.json' : 'stored.analysis.json', chapeau_bytes: totalBytes(storedSide.chapeauRanges),
        recorded: recordedCounts, baseline: before.counts, baseline_reproduces_recorded: recordedCounts ? sameCounts(before.counts, recordedCounts) : null, baseline_new_differs: recordedCounts ? newDiffers(before.counts, recordedCounts) : null, baseline_row_drift: rowDrift,
        new: after.counts, changes, bundled_rows: after.rows.filter((row) => row.bundled).map((row) => ({ proposal_id: row.proposal_id, summary: row.summary, counterpart: label(row.counterpart) })),
        drift: driftOf({ storedAnalysis, liveAnalysis: analysis, nodeId, storedFacts: storedSide.storedFacts }),
      });
    }
    variants.push({ variant, sections });
  }
  return { job: path.basename(dir), snapshot: Boolean(tables), variants };
}

function dumpFacts(dir, reference, words) {
  const analysisDir = path.join(dir, 'analysis');
  const stored = readAnalysis(path.join(analysisDir, 'stored.analysis.json'));
  const out = { job: path.basename(dir), section_reference: reference, words, chapeau_spans: [], stored: [], variants: {} };
  const node = (stored.sections || []).find((section) => section.section_reference === reference);
  if (!node) return out;
  const nodeId = node.structure_node_id;
  out.chapeau_spans = (stored.spans || []).filter((span) => span.kind === 'CHAPEAU' && span.structure_node_id === nodeId).map((span) => ({ span_id: span.span_id, start_byte: span.start_byte, end_byte: span.end_byte }));
  const rowsOf = (components) => [...(components || [])].flatMap((component) => [{ kind: component.kind, origin: component.origin || null, start_byte: component.start_byte, end_byte: component.end_byte, text: String(component.text || '').slice(0, 100) }, ...rowsOf(component.children)]);
  const wanted = (stored.proposals || []).filter((fact) => fact.structure_node_id === nodeId && String(summaryOf(fact)).toLowerCase().includes(String(words).toLowerCase()))
    .map((fact) => ({ fact, ranges: factRanges(fact, new Map()) }));
  for (const { fact, ranges } of wanted) out.stored.push({ proposal_id: fact.proposal_id, summary: summaryOf(fact), validation_status: fact.validation_status || null, family_key: fact.family_key, subtype_key: fact.subtype_key, ranges, components: rowsOf(fact.components) });
  for (const file of fs.readdirSync(analysisDir).filter((name) => name.endsWith('.analysis.json') && name !== 'stored.analysis.json').sort()) {
    const analysis = readAnalysis(path.join(analysisDir, file));
    out.variants[file.replace(/\.analysis\.json$/, '')] = (analysis.proposals || []).filter((fact) => fact.structure_node_id === nodeId)
      .map((fact) => ({ fact, ranges: factRanges(fact, new Map()) }))
      .filter(({ ranges }) => wanted.some((item) => overlapBytes(item.ranges, ranges) > 0))
      .map(({ fact, ranges }) => ({ proposal_id: fact.proposal_id || fact.client_ref, summary: summaryOf(fact), validation_status: fact.validation_status || null, family_key: fact.family_key, subtype_key: fact.subtype_key, ranges, components: rowsOf(fact.components) }));
  }
  return out;
}

const fmt = (counts) => (counts ? `${counts.matched} / ${counts.partial} / ${counts.unmatched} of ${counts.stored}${counts.bundled ? ` (${counts.bundled} bundled)` : ''}, new ${counts.new}` : 'none recorded');
const driftCount = (drift) => Object.values(drift).reduce((sum, list) => sum + list.length, 0);

function renderRescore(results) {
  const lines = ['| job | variant | section | recorded | baseline (same rule, rebuilt) | new rule | rows that change |', '| --- | --- | --- | --- | --- | --- | --- |'];
  const notes = [];
  for (const result of results) {
    for (const variant of result.variants) {
      for (const section of variant.sections) {
        const changes = section.changes.map((change) => `${change.summary}: ${change.old_status}${change.old_bundled ? ' bundled' : ''} ${change.old_share}${change.old_counterpart ? ` (${change.old_counterpart})` : ''} -> ${change.new_status}${change.new_bundled ? ' bundled' : ''} ${change.new_share}${change.new_counterpart ? ` (${change.new_counterpart})` : ''}`).join('; ');
        const reproduces = section.baseline_reproduces_recorded === null ? '' : section.baseline_reproduces_recorded ? '' : ' NOT REPRODUCED';
        lines.push(`| ${result.job} | ${variant.variant} | ${section.section_reference} | ${fmt(section.recorded)} | ${fmt(section.baseline)}${reproduces} | ${fmt(section.new)} | ${changes || 'none'} |`);
        if (section.baseline_new_differs) notes.push(`${result.job} ${variant.variant} ${section.section_reference}: new differs (recorded ${section.recorded.new}, rebuilt ${section.baseline.new}), the statuses the same: a tie on equal shares resolved by the live fact's own covered bytes ((199g)) where the job took the first live fact in order, so the counterparts spread over other live facts`);
        if (section.baseline_reproduces_recorded === false) notes.push(`${result.job} ${variant.variant} ${section.section_reference}: the rebuilt baseline differs from the recorded row (stored side from ${section.stored_source}); rows: ${section.baseline_row_drift.map((row) => `${row.summary}: recorded ${row.recorded}, baseline ${row.baseline}`).join('; ') || 'counts only'}`);
        if (driftCount(section.drift) > 0) {
          const parts = [];
          if (section.drift.stored_fallback.length) parts.push(`${section.drift.stored_fallback.length} stored fact(s) without OWN byte components that the analysis-file derivation gave their cited spans whole (${section.drift.stored_fallback.map((item) => item.summary).join('; ')})`);
          if (section.drift.live_fallback.length) parts.push(`${section.drift.live_fallback.length} live fact(s) without OWN byte components that the analysis-file derivation gave their cited spans whole (${section.drift.live_fallback.map((item) => item.summary).join('; ')})`);
          if (section.drift.stored_bytes_differ.length) parts.push(`${section.drift.stored_bytes_differ.length} stored fact(s) whose analysis-file tree carried other bytes than the snapshot rows (${section.drift.stored_bytes_differ.map((item) => `${item.summary}: ${item.analysis_bytes} against ${item.snapshot_bytes}`).join('; ')})`);
          if (section.drift.live_held_counted.length) parts.push(`${section.drift.live_held_counted.length} live fact(s) without a validation status counted VALID`);
          notes.push(`${result.job} ${variant.variant} ${section.section_reference}: why the earlier re-score's column differed: ${parts.join('; ')}`);
        }
      }
    }
  }
  return [...lines, ...(notes.length ? ['', ...notes.map((note) => `- ${note}`)] : [])].join('\n');
}

function parseArguments(argv) {
  const options = { dirs: [], json: null, dump: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--json') { options.json = argv[index + 1]; index += 1; continue; }
    if (argument === '--dump') { options.dump = argv[index + 1]; index += 1; continue; }
    options.dirs.push(argument);
  }
  return options;
}

function main(argv) {
  const options = parseArguments(argv);
  if (options.dirs.length === 0) {
    console.error('usage: re-score-ablation.js <job dir> [<job dir> ...] [--json <file>] [--dump <section>:<summary words>]');
    process.exit(64);
  }
  if (options.dump) {
    const [reference, ...rest] = options.dump.split(':');
    const dumps = options.dirs.map((dir) => dumpFacts(dir, reference, rest.join(':')));
    console.log(JSON.stringify(dumps, null, 2));
    return dumps;
  }
  const results = options.dirs.map((dir) => rescoreJobDir(dir));
  console.log(renderRescore(results));
  if (options.json) { fs.writeFileSync(options.json, `${JSON.stringify(results, null, 2)}\n`); console.log(`wrote ${options.json}`); }
  return results;
}

if (require.main === module) main(process.argv.slice(2));

module.exports = { driftOf, dumpFacts, renderRescore, rescoreJobDir };
