#!/usr/bin/env node

const fs = require('fs');

function norm(key) {
  return String(key || '').toLowerCase().replace(/[._-]/g, '').replace(/s$/, '');
}

function rowsFromRegistry(data) {
  if (Array.isArray(data)) return data;
  return data.fields || data.rows || [];
}

function clone(row) {
  return JSON.parse(JSON.stringify(row));
}

function mergeGroup(group) {
  if (group.length === 1) {
    const row = clone(group[0]);
    if (!Array.isArray(row.merged_from)) row.merged_from = [];
    return { row, merged: 0, flagged: false };
  }

  const schemaRows = group.filter((row) => row.origin === 'schema-features');
  const rubricRows = group.filter((row) => row.origin === 'rubric-features');
  if (schemaRows.length && rubricRows.length) {
    const canonical = clone(schemaRows[0]);
    canonical.merged_from = Array.isArray(canonical.merged_from) ? canonical.merged_from : [];
    canonical.also_matches_provision_codes = Array.isArray(canonical.also_matches_provision_codes)
      ? canonical.also_matches_provision_codes
      : [];
    for (const row of group) {
      if (row === schemaRows[0]) continue;
      canonical.merged_from.push({
        origin: row.origin || row.source || 'unknown',
        key: row.key,
        merge_rule: 'cross-origin',
      });
      if (row.applies_to && !canonical.also_matches_provision_codes.includes(row.applies_to)) {
        canonical.also_matches_provision_codes.push(row.applies_to);
      }
    }
    canonical.provenance = {
      source_of_truth: 'schema-features',
      absorbed_from: canonical.merged_from,
    };
    return { row: canonical, merged: group.length - 1, flagged: false };
  }

  return group.map((row) => {
    const copy = clone(row);
    if (!Array.isArray(copy.merged_from)) copy.merged_from = [];
    copy.review_flag = 'REQUIRES_REVIEWER_DECISION';
    return { row: copy, merged: 0, flagged: true };
  });
}

function dedupeRegistry(inputData) {
  const rows = rowsFromRegistry(inputData);
  const groups = new Map();
  for (const row of rows) {
    const key = norm(row.key);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  const fields = [];
  const reportGroups = [];
  let mechanicalMerges = 0;
  let flaggedNearDuplicates = 0;
  for (const group of groups.values()) {
    const merged = mergeGroup(group);
    const entries = Array.isArray(merged) ? merged : [merged];
    for (const entry of entries) {
      fields.push(entry.row);
      mechanicalMerges += entry.merged;
      if (entry.flagged) flaggedNearDuplicates += 1;
    }
    if (group.length > 1) {
      reportGroups.push({
        norm_key: norm(group[0].key),
        keys: group.map((row) => row.key),
        flagged: entries.some((entry) => entry.flagged),
      });
    }
  }

  return {
    registry: {
      version: 'generated-v1.deduped',
      generated_from: inputData.generated_from || [],
      input_field_count: rows.length,
      field_count: fields.length,
      fields,
    },
    report: {
      input_rows: rows.length,
      output_rows: fields.length,
      mechanical_merges: mechanicalMerges,
      flagged_near_duplicates: flaggedNearDuplicates,
      groups_untouched: [...groups.values()].filter((group) => group.length === 1).length,
      groups: reportGroups,
    },
  };
}

function reportMarkdown(report) {
  const lines = [
    '# Market Registry Merge Report',
    '',
    `input rows: ${report.input_rows}`,
    `output rows: ${report.output_rows}`,
    `mechanical merges: ${report.mechanical_merges}`,
    `flagged near-duplicates: ${report.flagged_near_duplicates}`,
    `groups untouched: ${report.groups_untouched}`,
    '',
    '## REQUIRES_REVIEWER_DECISION',
    '',
  ];
  const flagged = report.groups.filter((group) => group.flagged);
  if (!flagged.length) lines.push('- NONE');
  for (const group of flagged) {
    lines.push(`- ${group.norm_key}: ${group.keys.join(', ')}`);
  }
  lines.push('', '## Mechanical Merge Groups', '');
  for (const group of report.groups.filter((item) => !item.flagged)) {
    lines.push(`- ${group.norm_key}: ${group.keys.join(', ')}`);
  }
  return `${lines.join('\n')}\n`;
}

function main() {
  const input = process.argv[2] || 'docs/market-registry/generated-v1.json';
  const output = process.argv[3] || 'docs/market-registry/generated-v1.deduped.json';
  const reportFile = process.argv[4] || 'docs/market-registry/merge-report.md';
  const data = JSON.parse(fs.readFileSync(input, 'utf8'));
  const { registry, report } = dedupeRegistry(data);
  fs.writeFileSync(output, `${JSON.stringify(registry, null, 2)}\n`);
  fs.writeFileSync(reportFile, reportMarkdown(report));
  process.stdout.write(`DEDUPE: PASS ${report.input_rows} -> ${report.output_rows}\n`);
}

if (require.main === module) {
  main();
}

module.exports = { dedupeRegistry, mergeGroup, norm, reportMarkdown, rowsFromRegistry };
