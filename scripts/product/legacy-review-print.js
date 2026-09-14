#!/usr/bin/env node
'use strict';

// Replays the old app's review page (components/review-v2/sectionList.js and
// the components/review/table-configs/*.config.js it renders) over one
// deal's stored cards, off the network, and writes the result as data: one
// row per print row, one cell per column, as text. This is the "print" a
// section's table shape is harvested from (Ben, 2026-09-14: "Use
// bain/envestnet but then look at all of the output yourself").
//
//   node scripts/product/legacy-review-print.js <dir> [out.json]
//
// <dir> holds provision_cards.json, claims.json, deal.json (announce_date,
// value_usd) and optionally transaction_steps.json, dumped from the deals,
// provision_cards, claims and transaction_steps tables for the deal.

const fs = require('node:fs');
const path = require('node:path');
const { transformSync } = require('next/dist/build/swc');

// The review configs are ES modules with JSX-free React.createElement calls;
// transpile them on require, the way the render tests do for .jsx.
const originalJs = require.extensions['.js'];
function compileEsm(module, filename) {
  const source = fs.readFileSync(filename, 'utf8');
  if (!/^(import|export)\s/m.test(source) || filename.includes('node_modules')) return originalJs(module, filename);
  const transformed = transformSync(source, {
    filename,
    jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } },
    module: { type: 'commonjs' },
  });
  module._compile(transformed.code, filename);
}
require.extensions['.js'] = compileEsm;
require.extensions['.jsx'] = compileEsm;

const React = require('react');
const { shapeReviewDealRows } = require('../../lib/queries/review-deal');
const { buildReviewV2Sections } = require('../../components/review-v2/sectionList.js');

function textOf(node, depth = 0) {
  if (node === null || node === undefined || node === false) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map((item) => textOf(item, depth + 1)).filter(Boolean).join(' | ');
  if (React.isValidElement(node)) {
    const props = node.props || {};
    const own = [props.label, props.value, props.text].filter((value) => typeof value === 'string' && value.trim());
    const kids = textOf(props.children, depth + 1);
    const parts = [...own, kids].filter(Boolean);
    if (props.evidence && typeof props.evidence === 'string' && parts.length === 0) return props.evidence;
    return parts.join(' ');
  }
  if (typeof node === 'object') {
    if (typeof node.label === 'string') return node.label;
    if (typeof node.text === 'string') return node.text;
    return JSON.stringify(node).slice(0, 200);
  }
  return String(node);
}

// A readable projection of a row object: scalars, and the label / value of
// any nested signal, act, item or child row, never the card blobs.
function rawRow(row, depth = 0) {
  if (!row || typeof row !== 'object' || depth > 3) return row;
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    if (/^(source|sourceCard|sourceCards|card|cards|evidence|provision|raw)$/.test(key)) continue;
    if (value === null || value === undefined) continue;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') out[key] = typeof value === 'string' ? value.slice(0, 240) : value;
    else if (Array.isArray(value)) out[key] = value.slice(0, 40).map((item) => (typeof item === 'object' ? rawRow(item, depth + 1) : item));
    else if (React.isValidElement(value)) out[key] = textOf(value);
    else if (typeof value === 'object') out[key] = rawRow(value, depth + 1);
  }
  return out;
}

const primitive = (name) => (props) => React.createElement('x-' + name.toLowerCase(), props, props.children);
const primitives = new Proxy({}, { get: (_, name) => primitive(String(name)) });

function main() {
  const dir = process.argv[2];
  const outPath = process.argv[3] || path.join(dir, 'legacy-print.json');
  const cards = JSON.parse(fs.readFileSync(path.join(dir, 'provision_cards.json'), 'utf8'));
  const claims = JSON.parse(fs.readFileSync(path.join(dir, 'claims.json'), 'utf8'));
  const deal = JSON.parse(fs.readFileSync(path.join(dir, 'deal.json'), 'utf8'));
  const stepsPath = path.join(dir, 'transaction_steps.json');
  const transactionSteps = fs.existsSync(stepsPath) ? JSON.parse(fs.readFileSync(stepsPath, 'utf8')) : [];
  const dealId = cards[0]?.deal_id;
  const shaped = shapeReviewDealRows(dealId, cards, { claims });
  const reviewDeal = { ...shaped, transactionSteps, value_usd: deal.value_usd ?? null };
  const sections = buildReviewV2Sections(reviewDeal, { announce_date: deal.announce_date });
  const out = [];
  const ctx = { primitives, reviewDeal, deal, mode: 'user' };
  for (const section of sections) {
    const { config } = section;
    let rows = [];
    try { rows = config.selectRows(reviewDeal) || []; } catch (error) { rows = []; }
    const columns = (typeof config.columnsFor === 'function' && config.columnsFor(rows)) || config.columns || [];
    const headerNote = typeof config.deriveHeaderNote === 'function' ? config.deriveHeaderNote(rows) : null;
    out.push({
      id: config.id,
      title: config.title,
      header_note: headerNote || null,
      columns: columns.map((column) => ({ id: column.id, header: column.header })),
      body: typeof config.renderBody === 'function' ? (() => { try { return textOf(config.renderBody(rows, ctx)); } catch (error) { return `!! ${error.message}`; } })() : null,
      rows: rows.map((row) => ({
        group: row.group || row.groupHeader || row.section || null,
        label: typeof row.label === 'string' ? row.label : textOf(row.label),
        raw: rawRow(row),
        cells: Object.fromEntries(columns.map((column) => {
          let value = '';
          try { value = textOf(typeof column.renderCell === 'function' ? column.renderCell(row, ctx) : row[column.id]); } catch (error) { value = `!! ${error.message}`; }
          return [column.id, value];
        })),
        section_refs: [...new Set([row.sourceCard, row.source, ...(row.sourceCards || [])].filter(Boolean).map((card) => card.section_ref).filter(Boolean))],
      })),
    });
  }
  fs.writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`);
  const md = [];
  for (const section of out) {
    md.push(`## ${section.title} (${section.id})${section.header_note ? `\n_${section.header_note}_` : ''}\n`);
    if (section.body) md.push(`Body: ${section.body.replace(/\s+/g, ' ').slice(0, 4000)}\n`);
    md.push(`| ${section.columns.map((column) => column.header || column.id).join(' | ')} |`);
    md.push(`| ${section.columns.map(() => '---').join(' | ')} |`);
    for (const row of section.rows) {
      md.push(`| ${section.columns.map((column) => String(row.cells[column.id] ?? '').replace(/\|/g, '/').replace(/\s+/g, ' ').slice(0, 220)).join(' | ')} |`);
    }
    md.push('');
  }
  fs.writeFileSync(outPath.replace(/\.json$/, '.md'), md.join('\n'));
  console.log(`${out.length} sections, ${out.reduce((sum, section) => sum + section.rows.length, 0)} rows -> ${outPath}`);
}

main();
