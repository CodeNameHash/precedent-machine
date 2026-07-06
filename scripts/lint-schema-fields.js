#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_SQL = path.join(__dirname, '..', 'supabase', 'schema-03-card-model.sql');

const WP_TABLES = [
  'provision_cards',
  'provision_field_groups',
  'provision_analytical_flags',
  'provision_cross_references',
  'provision_bring_downs',
  'representation_mae_subclauses',
  'material_contract_categories',
  'closing_condition_bring_down_tiers',
  'closing_condition_cited_provisions',
  'ioc_positive_obligations',
  'ioc_negative_obligations',
  'termination_fee_triggers',
  'definition_components',
];

const DIRECT_SOURCE_CHILD_TABLES = [
  'provision_analytical_flags',
  'provision_cross_references',
  'provision_bring_downs',
  'representation_mae_subclauses',
  'material_contract_categories',
  'closing_condition_bring_down_tiers',
  'ioc_positive_obligations',
  'ioc_negative_obligations',
  'termination_fee_triggers',
  'definition_components',
];

function tableBody(sql, table) {
  const re = new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}\\s*\\(([\\s\\S]*?)\\n\\);`, 'i');
  const match = sql.match(re);
  return match ? match[1] : null;
}

function columnNames(body) {
  const names = new Set();
  const lines = String(body || '').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || /^(CONSTRAINT|PRIMARY|UNIQUE|FOREIGN|CHECK|REFERENCES)\b/i.test(trimmed)) continue;
    const match = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s+/);
    if (match) names.add(match[1]);
  }
  return names;
}

function hasColumn(names, name) {
  return names.has(name);
}

function lintSql(sql) {
  const issues = [];
  for (const table of WP_TABLES) {
    const body = tableBody(sql, table);
    if (!body) {
      issues.push(`${table}: missing table`);
      continue;
    }
    if (/\bjsonb\b/i.test(body)) issues.push(`${table}: jsonb is forbidden for WP-SCHEMA-03 rendered fields`);

    const names = columnNames(body);
    const quoteColumns = [...names].filter((name) => name.endsWith('_quote') || name === 'verbatim_quote');
    for (const quoteColumn of quoteColumns) {
      if (quoteColumn === 'primary_quote') {
        if (!hasColumn(names, 'primary_quote_start') || !hasColumn(names, 'primary_quote_end')) {
          issues.push(`${table}.${quoteColumn}: missing primary_quote_start/primary_quote_end`);
        }
        continue;
      }
      if (!hasColumn(names, 'source_span_start') || !hasColumn(names, 'source_span_end')) {
        issues.push(`${table}.${quoteColumn}: missing source_span_start/source_span_end`);
      }
    }

    if (DIRECT_SOURCE_CHILD_TABLES.includes(table)) {
      if (!hasColumn(names, 'source_span_start') || !hasColumn(names, 'source_span_end')) {
        issues.push(`${table}: source child row missing source_span_start/source_span_end`);
      }
    }
  }
  return issues;
}

function main() {
  const target = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_SQL;
  const sql = fs.readFileSync(target, 'utf8');
  const issues = lintSql(sql);
  if (issues.length > 0) {
    console.error(`schema field lint failed for ${target}`);
    for (const issue of issues) console.error(`- ${issue}`);
    process.exit(1);
  }
  console.log(`schema field lint passed for ${target}`);
}

if (require.main === module) main();

module.exports = {
  WP_TABLES,
  DIRECT_SOURCE_CHILD_TABLES,
  tableBody,
  columnNames,
  lintSql,
};
