#!/usr/bin/env node
'use strict';

// Plan finding (199g), work package E14: re-scores a finished ablation
// job's rows from its analysis files with the comparison matcher's rule as
// it now stands (lib/product/generation-comparison.js matchFacts: a stored
// fact scored on its bytes outside the section's chapeau span, each live
// fact the counterpart of one stored fact at most) beside the old rule
// (every stored fact its best-overlapping live fact, chapeau bytes
// counted), and prints the rows that change. Reads only; no model call,
// no database, nothing written to the job dir.
//
//   node scripts/product/re-score-ablation.js <job dir> [<job dir> ...] [--json <file>] [--dump <section>:<summary words>]
//
// A job dir holds analysis/stored.analysis.json, analysis/<variant>.analysis.json
// (written by scripts/product/cost-ablation.js --analysis-dir) and
// ablation.json (its recorded rows, printed beside the re-score as a
// check). --dump prints, as JSON, the component rows of the stored facts
// of that section whose summary contains the words, and of every live fact
// that overlaps them, the fixture for a pin.

const fs = require('node:fs');
const path = require('node:path');
const { chapeauRangesOf, factRanges, matchFacts, statusForShare, totalBytes } = require('../../lib/product/generation-comparison');

function readAnalysis(file) {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  return parsed && parsed.analysis ? parsed.analysis : parsed;
}

function summaryOf(fact) {
  return (fact.headline && fact.headline.summary) || fact.statement || (fact.headline && fact.headline.label) || fact.proposal_id || fact.client_ref || '?';
}

function countsOf(rows, newFacts) {
  return { stored: rows.length, matched: rows.filter((row) => row.status === 'MATCHED').length, partial: rows.filter((row) => row.status === 'PARTIAL').length, unmatched: rows.filter((row) => row.status === 'UNMATCHED').length, new: newFacts };
}

// One variant of one section under one rule.
function scoreSection({ storedFacts, variantFacts, chapeauRanges, exclusive }) {
  const matching = matchFacts({
    stored: storedFacts.map((fact) => ({ id: fact.id, ranges: fact.ranges })),
    candidates: variantFacts.map((fact) => ({ id: fact.id, ranges: fact.ranges })),
    chapeauRanges: exclusive ? chapeauRanges : [],
    exclusive,
  });
  const byId = new Map(variantFacts.map((fact) => [fact.id, fact]));
  const used = new Set();
  const rows = storedFacts.map((fact) => {
    const best = matching.assigned.get(fact.id) || null;
    const status = best ? statusForShare(best.share) : 'UNMATCHED';
    if (best && status !== 'UNMATCHED') used.add(best.id);
    return { proposal_id: fact.id, summary: fact.summary, status, share: best ? Number(best.share.toFixed(2)) : 0, scored_bytes: matching.scored_bytes.get(fact.id) ?? 0, counterpart: best ? best.id : null, counterpart_summary: best ? byId.get(best.id).summary : null };
  });
  const newFacts = variantFacts.filter((fact) => !used.has(fact.id)).length;
  return { rows, counts: countsOf(rows, newFacts) };
}

function factsOf(analysis, nodeId) {
  const spansById = new Map((analysis.spans || []).map((span) => [span.span_id, span]));
  return (analysis.proposals || [])
    .filter((fact) => fact.structure_node_id === nodeId && (fact.validation_status || 'VALID') === 'VALID')
    .map((fact) => ({ id: fact.proposal_id || fact.client_ref, summary: summaryOf(fact), ranges: factRanges(fact, spansById), fact }))
    .filter((fact) => fact.ranges.length > 0);
}

function recordedCounts(ablation, variant, reference) {
  if (!Array.isArray(ablation)) return null;
  const entry = ablation.find((item) => item && item.variant === variant);
  const section = entry && Array.isArray(entry.sections) ? entry.sections.find((row) => row.section_reference === reference) : null;
  return section && section.comparison ? section.comparison.counts : null;
}

function rescoreJobDir(dir) {
  const analysisDir = path.join(dir, 'analysis');
  const stored = readAnalysis(path.join(analysisDir, 'stored.analysis.json'));
  let ablation = null;
  try { ablation = JSON.parse(fs.readFileSync(path.join(dir, 'ablation.json'), 'utf8')); } catch { ablation = null; }
  const variantFiles = fs.readdirSync(analysisDir).filter((name) => name.endsWith('.analysis.json') && name !== 'stored.analysis.json').sort();
  const variants = [];
  for (const file of variantFiles) {
    const variant = file.replace(/\.analysis\.json$/, '');
    const analysis = readAnalysis(path.join(analysisDir, file));
    const sections = [];
    for (const section of analysis.sections || []) {
      const nodeId = section.structure_node_id;
      const storedFacts = factsOf(stored, nodeId);
      const variantFacts = factsOf(analysis, nodeId);
      const chapeauRanges = chapeauRangesOf([...(stored.spans || []), ...(analysis.spans || [])], nodeId);
      const before = scoreSection({ storedFacts, variantFacts, chapeauRanges, exclusive: false });
      const after = scoreSection({ storedFacts, variantFacts, chapeauRanges, exclusive: true });
      const changes = before.rows.map((row, index) => ({ row, next: after.rows[index] }))
        .filter(({ row, next }) => row.status !== next.status || row.counterpart !== next.counterpart)
        .map(({ row, next }) => ({ proposal_id: row.proposal_id, summary: row.summary, old_status: row.status, old_share: row.share, old_counterpart: row.counterpart_summary, new_status: next.status, new_share: next.share, new_counterpart: next.counterpart_summary, scored_bytes: next.scored_bytes }));
      sections.push({ section_reference: section.section_reference, node_id: nodeId, chapeau_bytes: totalBytes(chapeauRanges), recorded: recordedCounts(ablation, variant, section.section_reference), old: before.counts, new: after.counts, changes });
    }
    variants.push({ variant, sections });
  }
  return { job: path.basename(dir), variants };
}

function dumpFacts(dir, reference, words) {
  const analysisDir = path.join(dir, 'analysis');
  const stored = readAnalysis(path.join(analysisDir, 'stored.analysis.json'));
  const out = { job: path.basename(dir), section_reference: reference, words, stored: [], variants: {} };
  const node = (stored.sections || []).find((section) => section.section_reference === reference);
  if (!node) return out;
  const nodeId = node.structure_node_id;
  const chapeau = (stored.spans || []).filter((span) => span.kind === 'CHAPEAU' && span.structure_node_id === nodeId).map((span) => ({ span_id: span.span_id, start_byte: span.start_byte, end_byte: span.end_byte }));
  out.chapeau_spans = chapeau;
  const rowsOf = (fact) => [...(fact.components || [])].map((component) => ({ kind: component.kind, origin: component.origin || null, start_byte: component.start_byte, end_byte: component.end_byte, text: String(component.text || '').slice(0, 100) }));
  const wanted = factsOf(stored, nodeId).filter((fact) => String(fact.summary).toLowerCase().includes(String(words).toLowerCase()));
  for (const fact of wanted) out.stored.push({ proposal_id: fact.id, summary: fact.summary, family_key: fact.fact.family_key, subtype_key: fact.fact.subtype_key, ranges: fact.ranges, components: rowsOf(fact.fact) });
  for (const file of fs.readdirSync(analysisDir).filter((name) => name.endsWith('.analysis.json') && name !== 'stored.analysis.json').sort()) {
    const analysis = readAnalysis(path.join(analysisDir, file));
    const live = factsOf(analysis, nodeId);
    out.variants[file.replace(/\.analysis\.json$/, '')] = live
      .filter((candidate) => wanted.some((fact) => matchFacts({ stored: [{ id: fact.id, ranges: fact.ranges }], candidates: [{ id: candidate.id, ranges: candidate.ranges }], exclusive: false }).assigned.has(fact.id)))
      .map((candidate) => ({ proposal_id: candidate.id, summary: candidate.summary, family_key: candidate.fact.family_key, subtype_key: candidate.fact.subtype_key, ranges: candidate.ranges, components: rowsOf(candidate.fact) }));
  }
  return out;
}

const fmt = (counts) => (counts ? `${counts.matched} / ${counts.partial} / ${counts.unmatched} of ${counts.stored}, new ${counts.new}` : 'none recorded');

function renderRescore(results) {
  const lines = ['| job | variant | section | recorded | old rule | new rule | rows that change |', '| --- | --- | --- | --- | --- | --- | --- |'];
  for (const result of results) {
    for (const variant of result.variants) {
      for (const section of variant.sections) {
        const changes = section.changes.map((change) => `${change.summary}: ${change.old_status} ${change.old_share}${change.old_counterpart ? ` (${change.old_counterpart})` : ''} -> ${change.new_status} ${change.new_share}${change.new_counterpart ? ` (${change.new_counterpart})` : ''}`).join('; ');
        lines.push(`| ${result.job} | ${variant.variant} | ${section.section_reference} | ${fmt(section.recorded)} | ${fmt(section.old)} | ${fmt(section.new)} | ${changes || 'none'} |`);
      }
    }
  }
  return lines.join('\n');
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

module.exports = { dumpFacts, renderRescore, rescoreJobDir, scoreSection };
