#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────
   scripts/product/harvest-rep-limbs.js — Q5, canonical limb names.

   Harvests the row_detail values the extractor gave the representations
   tables across one or more runs, clusters them per representation row,
   and writes one Markdown note proposing a canonical list per
   representation for Ben's decision, with the counts and examples behind
   each proposal. Ben decides the names; this only proposes. Nothing in
   contracts/product/table-shapes.v3.json changes until he does.

   Usage:
     node scripts/product/harvest-rep-limbs.js \
       (--run <run-id> | --snapshot <file>)... --out <note.md> [--json <file>] [--threshold 0.6]

   --run reads the run from the database (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
   --snapshot reads a PRODUCT_RUN_SNAPSHOT/V1 file (lib/product/run-rows.js).
   Rerun with more runs (Olaplex, Apogee) as they finish under V2.
   ───────────────────────────────────────────────────────────────────────── */

'use strict';

const fs = require('fs');
const path = require('path');
const { DEFAULT_THRESHOLD, proposeCanonicalLimbs } = require('../../lib/product/rep-limb-harvest');
const { resolveRunRows, runLabel, sectionReferencesByNode } = require('../../lib/product/run-rows');

const TABLES = {
  product_analysis_runs: {},
  product_proposals: { filter: { family_key: 'REPRESENTATIONS' }, columns: 'run_id,proposal_id,structure_node_id,family_key,subtype_key,fact_type,validation_status,payload' },
  product_source_closures: { columns: 'run_id,structure_node_id,section_reference' },
};

function parseArguments(argv) {
  const options = { runIds: [], snapshotFiles: [], out: null, json: null, threshold: DEFAULT_THRESHOLD };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--run') { options.runIds.push(argv[index + 1]); index += 1; continue; }
    if (argument === '--snapshot') { options.snapshotFiles.push(argv[index + 1]); index += 1; continue; }
    if (argument === '--out') { options.out = argv[index + 1]; index += 1; continue; }
    if (argument === '--json') { options.json = argv[index + 1]; index += 1; continue; }
    if (argument === '--threshold') { options.threshold = Number(argv[index + 1]); index += 1; continue; }
    throw new TypeError(`unknown argument: ${argument}`);
  }
  if (!options.out) throw new TypeError('usage: harvest-rep-limbs.js (--run <id> | --snapshot <file>)... --out <note.md> [--json <file>] [--threshold 0.6]');
  if (!(options.threshold > 0 && options.threshold <= 1)) throw new TypeError('--threshold must be between 0 and 1');
  return options;
}

function cell(value) {
  return String(value == null ? '' : value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function shortRun(runId) {
  return runId.slice(0, 8);
}

function renderNote({ proposal, runs, generatedAt }) {
  const lines = [];
  const labels = new Map(runs.map((run) => [run.run_id, runLabel(run)]));
  lines.push('# Q5: canonical limb names per representation, proposed from the extractor\'s row_detail values', '');
  lines.push(`Generated ${generatedAt} by \`scripts/product/harvest-rep-limbs.js\` (cluster threshold ${proposal.threshold}). Ben decides the names; this note only proposes (plan Q5; decision 31: "are these items in Term canonical and being used across all deals? They need to be so they can be compared").`, '');
  lines.push('## Runs read', '');
  for (const run of runs) lines.push(`- ${shortRun(run.run_id)}: ${labels.get(run.run_id)}`);
  lines.push('');
  lines.push('## What the harvest shows', '');
  const t = proposal.totals;
  lines.push('| Measure | Count |', '| --- | --- |');
  lines.push(`| Representation readouts (facts on the two representations tables) | ${t.readouts} |`);
  lines.push(`| Readouts with a row_detail (a limb name) | ${t.with_detail} |`);
  lines.push(`| Representation rows with readouts | ${t.rows} |`);
  lines.push(`| Distinct limb names | ${t.distinct_names} |`);
  lines.push(`| Distinct names used in more than one run | ${t.names_in_several_runs} |`);
  lines.push(`| Distinct names already in detail_labels_by_row | ${t.names_already_canonical} |`);
  lines.push(`| Clusters (proposed canonical limbs) | ${t.clusters} |`);
  lines.push(`| Clusters that fold several names | ${t.clusters_of_several_names} |`);
  lines.push('');
  lines.push('## Per representation', '');
  lines.push('Each table lists the proposed canonical limb, how many facts it would cover, which runs produced it, the names it folds (count each) and one example per name (section, fact summary). "existing" marks a name already in detail_labels_by_row; a row with no existing list has every name proposed afresh. A fact about the representation as a whole carries no limb and is counted under "whole-row facts".', '');
  for (const row of proposal.rows) {
    lines.push(`### ${row.row_label}${row.table_key.startsWith('parent-') ? ' (Parent representations)' : ''}`, '');
    lines.push(`Facts ${row.facts} (with a limb ${row.facts_with_detail}, whole-row ${row.whole_row_facts.length}); distinct names ${row.distinct_names}; names used in more than one run ${row.names_in_several_runs}; already canonical ${row.names_already_canonical}; runs ${row.runs.map(shortRun).join(', ')}${row.fixed_row ? '' : '; row label is not in fixed_row_labels (an open row the extractor added)'}.`, '');
    if (row.existing_labels.length) {
      lines.push(`Existing canonical list (${row.existing_labels.length}): ${row.existing_labels.map((label) => `"${label}"`).join('; ')}`, '');
    }
    if (row.clusters.length) {
      lines.push('| Proposed canonical limb | From | Facts | Runs | Names folded (count) | Example |', '| --- | --- | --- | --- | --- | --- |');
      for (const cluster of row.clusters) {
        const names = cluster.members.map((member) => `${member.existing ? '[existing] ' : ''}${member.name} (${member.count})`).join('<br>');
        const examples = cluster.members.map((member) => {
          const readout = member.readouts[0];
          return `${shortRun(readout.run_id)} §${readout.section_reference || '?'}: ${readout.summary || '(no summary)'}`;
        }).join('<br>');
        lines.push(`| ${cell(cluster.proposed_name)} | ${cluster.proposed_from === 'EXISTING_CANONICAL' ? 'existing' : cluster.proposed_from === 'MOST_USED_MEMBER' ? 'most used' : 'single'} | ${cluster.count} | ${cluster.runs.map(shortRun).join(', ')} | ${cell(names)} | ${cell(examples)} |`);
      }
      lines.push('');
    }
    if (row.whole_row_facts.length) {
      lines.push(`Whole-row facts (no limb): ${row.whole_row_facts.map((readout) => `${shortRun(readout.run_id)} §${readout.section_reference || '?'} "${readout.summary || '(no summary)'}"`).join('; ')}`, '');
    }
  }
  return lines.join('\n');
}

async function main(argv) {
  const options = parseArguments(argv);
  const runs = await resolveRunRows({ runIds: options.runIds, snapshotFiles: options.snapshotFiles, tables: TABLES });
  const tableShapes = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'contracts', 'product', 'table-shapes.v3.json'), 'utf8'));
  const sectionReferencesByRun = new Map(runs.map((run) => [run.run_id, sectionReferencesByNode(run)]));
  const proposal = proposeCanonicalLimbs({ runs, tableShapes, sectionReferencesByRun, threshold: options.threshold });
  const generatedAt = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
  fs.writeFileSync(options.out, `${renderNote({ proposal, runs, generatedAt })}\n`);
  if (options.json) {
    const slim = {
      ...proposal,
      runs: runs.map((run) => ({ run_id: run.run_id, label: runLabel(run) })),
      rows: proposal.rows.map((row) => ({
        ...row,
        whole_row_facts: row.whole_row_facts.map(({ run_id, proposal_id, section_reference, summary }) => ({ run_id, proposal_id, section_reference, summary })),
        clusters: row.clusters.map((cluster) => ({
          ...cluster,
          members: cluster.members.map((member) => ({ ...member, readouts: member.readouts.map(({ run_id, proposal_id, section_reference, summary }) => ({ run_id, proposal_id, section_reference, summary })) })),
        })),
      })),
    };
    fs.writeFileSync(options.json, `${JSON.stringify(slim, null, 2)}\n`);
  }
  process.stdout.write(`${proposal.totals.readouts} readouts, ${proposal.totals.distinct_names} distinct limb names, ${proposal.totals.clusters} proposed limbs across ${proposal.totals.rows} rows -> ${options.out}\n`);
  return proposal;
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => { process.stderr.write(`${error.message || error}\n`); process.exit(1); });
}

module.exports = { TABLES, main, parseArguments, renderNote };
