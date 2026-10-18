#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────
   scripts/product/unresolved-fact-types.js — finding (66)'s open item.

   Reads a run's draft-level REQUIRED_FACT_TYPE_UNRESOLVED issues back to
   the sections that left each fact type UNRESOLVED and the cause recorded
   in the stored rows (a section never extracted, a held proposal, the
   model's coverage answer against its own facts), says whether another
   section carries the fact type VALID, and gives each fact type a verdict
   (bookkeeping or a gap). With --compare, sets a second run's list beside
   it. Writes a Markdown note.

   Usage:
     node scripts/product/unresolved-fact-types.js \
       (--run <run-id> | --snapshot <file>) [--compare <run-id> | --compare-snapshot <file>] --out <note.md> [--json <file>]

   --run reads the database (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY):
   the run row, every proposal's identity (no payload), every FACT_TYPE
   assertion that is UNRESOLVED, every issue, the closures' section
   references, the routings and the extraction calls of the unresolved
   sections. --snapshot reads a PRODUCT_RUN_SNAPSHOT/V1 file of the same rows.
   ───────────────────────────────────────────────────────────────────────── */

'use strict';

const fs = require('fs');
const { analyseUnresolvedFactTypes, compareDraftIssues } = require('../../lib/product/unresolved-fact-types');
const { loadTableRows, resolveRunRows, runLabel, sectionReferencesByNode } = require('../../lib/product/run-rows');

const TABLES = {
  product_analysis_runs: {},
  product_proposals: { columns: 'run_id,proposal_id,structure_node_id,family_key,subtype_key,fact_type,validation_status' },
  product_coverage_assertions: { filter: { subject_kind: 'FACT_TYPE', state: 'UNRESOLVED' } },
  product_issues: {},
  product_source_closures: { columns: 'run_id,structure_node_id,section_reference' },
  product_section_routings: {},
};

function parseArguments(argv) {
  const options = { runIds: [], snapshotFiles: [], compareRunIds: [], compareSnapshotFiles: [], out: null, json: null };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const next = argv[index + 1];
    if (argument === '--run') { options.runIds.push(next); index += 1; continue; }
    if (argument === '--snapshot') { options.snapshotFiles.push(next); index += 1; continue; }
    if (argument === '--compare') { options.compareRunIds.push(next); index += 1; continue; }
    if (argument === '--compare-snapshot') { options.compareSnapshotFiles.push(next); index += 1; continue; }
    if (argument === '--out') { options.out = next; index += 1; continue; }
    if (argument === '--json') { options.json = next; index += 1; continue; }
    throw new TypeError(`unknown argument: ${argument}`);
  }
  if (!options.out) throw new TypeError('usage: unresolved-fact-types.js (--run <id> | --snapshot <file>) [--compare <id> | --compare-snapshot <file>] --out <note.md> [--json <file>]');
  if (options.runIds.length + options.snapshotFiles.length !== 1) throw new TypeError('exactly one --run or --snapshot');
  if (options.compareRunIds.length + options.compareSnapshotFiles.length > 1) throw new TypeError('at most one --compare or --compare-snapshot');
  return options;
}

// The extraction calls of the sections that left a fact type UNRESOLVED,
// read after the assertions (a run's calls are large; only these are needed).
async function attachExtractionCalls(run, client) {
  const nodes = [...new Set((run.tables.product_coverage_assertions || []).map((row) => row.structure_node_id).filter(Boolean))];
  if (!nodes.length || !client) return run;
  run.tables.product_model_calls = await loadTableRows(client, 'product_model_calls', run.run_id, {
    filter: { call_kind: 'EXTRACTION', structure_node_id: nodes },
    columns: 'run_id,model_call_id,structure_node_id,call_kind,prompt_version,response',
  });
  return run;
}

async function loadRun({ runIds, snapshotFiles, client, createClient }) {
  const needsClient = runIds.length > 0;
  const db = needsClient ? (client || createClient()) : null;
  const [run] = await resolveRunRows({ runIds, snapshotFiles, tables: TABLES, client: db, createClient });
  return runIds.length ? attachExtractionCalls(run, db) : run;
}

function cell(value) {
  return String(value == null ? '' : value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function describeSection(section) {
  const detail = section.detail || {};
  if (section.cause === 'SECTION_NOT_EXTRACTED') return `${section.section_reference}: not extracted (closure incomplete: unresolved ${detail.unresolved_references?.join(', ') || 'none'})`;
  if (section.cause === 'HELD_PROPOSAL') return `${section.section_reference}: ${detail.held} held (${(detail.hold_codes || []).join(', ') || 'no issue code'})${detail.valid ? `, ${detail.valid} valid` : ''}`;
  if (detail.model_answers) return `${section.section_reference}: model answered ${detail.model_answers.join('/') || 'nothing'}${detail.valid ? `, ${detail.valid} valid` : ', no valid fact'}`;
  return `${section.section_reference}: ${section.cause}`;
}

function renderNote({ analysis, run, compare, compareRun, generatedAt }) {
  const lines = [];
  const s = analysis.summary;
  lines.push('# UNRESOLVED required fact types read back to their sections and causes', '');
  lines.push(`Generated ${generatedAt} by \`scripts/product/unresolved-fact-types.js\` for ${runLabel(run)}${compareRun ? `, compared with ${runLabel(compareRun)}` : ''}.`, '');
  lines.push('## Summary', '');
  lines.push('| Measure | Count |', '| --- | --- |');
  lines.push(`| Draft-level REQUIRED_FACT_TYPE_UNRESOLVED issues | ${s.draft_issues} |`);
  lines.push(`| Fact types with an UNRESOLVED section assertion | ${s.fact_types_unresolved} |`);
  lines.push(`| Of which carried VALID in another section of the run | ${s.carried_elsewhere} |`);
  lines.push(`| Of which VALID nowhere in the run | ${s.nowhere} |`);
  for (const [cause, count] of Object.entries(s.by_cause).sort()) lines.push(`| Section assertions with cause ${cause} | ${count} |`);
  for (const [verdict, count] of Object.entries(s.by_verdict).sort()) lines.push(`| Fact types with verdict ${verdict} | ${count} |`);
  lines.push('');
  if (analysis.draft_issues_without_assertion.length) {
    lines.push(`Draft issues with no UNRESOLVED section assertion among the rows read (a family routed somewhere with no FACT_TYPE assertion written): ${analysis.draft_issues_without_assertion.map((entry) => `${entry.family_key}/${entry.fact_type}`).join(', ')}.`, '');
  }
  if (analysis.sections_not_extracted.length) {
    lines.push('## Sections never extracted', '');
    lines.push('A SOURCE_CLOSURE_INCOMPLETE issue on the section: the runner wrote UNRESOLVED for every required fact type of every routed family and never asked the model for the section\'s facts (lib/product/agreement-draft.js, the closureIncomplete branch). Whatever other sections carry, this section\'s own content is absent from the draft.', '');
    for (const section of analysis.sections_not_extracted) {
      lines.push(`### ${section.section_reference}`, '');
      lines.push(`- Routed families (${section.families.length}): ${section.families.join(', ')}`);
      if (section.routing_rationale) lines.push(`- Router's rationale: ${section.routing_rationale}`);
      lines.push(`- Unresolved section references: ${section.unresolved_references.join(', ') || 'none'}`);
      lines.push(`- Cross-scope references the closure resolved into the main agreement: ${section.cross_scope_references.join('; ') || 'none'}`);
      if (section.unusual_provisions.length) lines.push(`- Residual pass's unusual provisions in the section (${section.unusual_provisions.length}): ${section.unusual_provisions.map((text) => `"${text}"`).join('; ')}`);
      lines.push('');
    }
  }
  lines.push('## Per family and fact type', '');
  lines.push('| Family | Fact type | Draft issue | Unresolved sections and cause | VALID elsewhere | Verdict |', '| --- | --- | --- | --- | --- | --- |');
  for (const entry of analysis.fact_types) {
    const elsewhere = entry.valid_elsewhere.length
      ? `${entry.valid_elsewhere.reduce((sum, item) => sum + item.count, 0)} in ${entry.valid_elsewhere.map((item) => item.section_reference).join(', ')}`
      : entry.valid_in_unresolved_sections ? `${entry.valid_in_unresolved_sections} in the unresolved section` : 'none';
    lines.push(`| ${entry.family_key} | ${entry.fact_type} | ${entry.in_draft_issue ? 'yes' : 'no'} | ${cell(entry.sections.map(describeSection).join('; '))} | ${cell(elsewhere)} | ${entry.verdict} |`);
  }
  lines.push('');
  if (compare) {
    lines.push('## Compared with the other run\'s draft issues', '');
    lines.push(`Both: ${compare.both.length}; only this run: ${compare.only_a.length}${compare.only_a.length ? ` (${compare.only_a.map((entry) => `${entry.family_key}/${entry.fact_type}`).join(', ')})` : ''}; only the other: ${compare.only_b.length}${compare.only_b.length ? ` (${compare.only_b.map((entry) => `${entry.family_key}/${entry.fact_type}`).join(', ')})` : ''}.`, '');
  }
  lines.push('## Verdicts', '');
  lines.push('- BOOKKEEPING_HELD: every unresolved section holds a proposal of the fact type; the lawyer\'s decision on the held fact resolves the state. The draft issue restates per fact type what the held fact\'s own issue already says.');
  lines.push('- BOOKKEEPING_MODEL_ANSWER: the model\'s coverage answer disagrees with its own facts (NOT_FOUND beside a fact it returned); the facts stand and the answer is the bookkeeping.');
  lines.push('- SECTION_GAP: a routed section was never extracted. Not bookkeeping: its content is missing from the draft, whether or not other sections carry the same fact types.');
  lines.push('- EXTRACTION_GAP: the model said FOUND and returned nothing, or answered UNRESOLVED, and no valid fact of the type exists anywhere in the run.');
  lines.push('- MIXED: several causes across sections; read the sections column.', '');
  return lines.join('\n');
}

async function main(argv, dependencies = {}) {
  const options = parseArguments(argv);
  const run = await loadRun({ runIds: options.runIds, snapshotFiles: options.snapshotFiles, client: dependencies.client, createClient: dependencies.createClient });
  const analysis = analyseUnresolvedFactTypes(run, { sectionReferences: sectionReferencesByNode(run) });
  let compare = null;
  let compareRun = null;
  if (options.compareRunIds.length || options.compareSnapshotFiles.length) {
    compareRun = await loadRun({ runIds: options.compareRunIds, snapshotFiles: options.compareSnapshotFiles, client: dependencies.client, createClient: dependencies.createClient });
    compare = compareDraftIssues(analysis, analyseUnresolvedFactTypes(compareRun, { sectionReferences: sectionReferencesByNode(compareRun) }));
  }
  const generatedAt = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
  fs.writeFileSync(options.out, `${renderNote({ analysis, run, compare, compareRun, generatedAt })}\n`);
  if (options.json) fs.writeFileSync(options.json, `${JSON.stringify({ analysis, compare }, null, 2)}\n`);
  process.stdout.write(`${analysis.summary.draft_issues} draft issues, ${analysis.summary.fact_types_unresolved} fact types unresolved (${JSON.stringify(analysis.summary.by_verdict)}) -> ${options.out}\n`);
  return { analysis, compare };
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => { process.stderr.write(`${error.message || error}\n`); process.exit(1); });
}

module.exports = { TABLES, attachExtractionCalls, main, parseArguments, renderNote };
