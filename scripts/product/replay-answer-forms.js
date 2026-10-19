#!/usr/bin/env node
'use strict';
// Work package 21 (plan finding (200)): replays a run's stored extraction
// answers through compileExtraction as the model wrote them (V9: quotes,
// 64-hex span ids, evidence_quotes, roles) and again rewritten to the
// shorter forms the validator now accepts (span aliases; words by byte
// offsets, by anchors of a fixed word count, or by the shortest anchors
// that name the quote and nothing else; no evidence_quotes; no roles), and
// counts the proposals whose status, words, bytes, headline and readout
// are identical. Nothing is submitted, woken or written to a branch.
//
// Inputs, in --dir (default: the folder this script is run from), read
// from the preview branch's tables by SQL (the queries the ledger note
// documents; implementer A read them through the Supabase MCP):
//   ncs-canonical.txt   product_source_documents.payload->>'canonical_text'
//   calls-index.json    [{model_call_id, structure_node_id, section_reference, answer_chars, failure}] for the run's EXTRACTION calls
//   answers.json        {model_call_id: the answer text (the response's longest text block)}
//   closures.json       [{c: product_source_closures.payload, r: product_section_routings.families}]
//   spans-meta.json     [{i: span_id, d: source_document_id, n: structure_node_id, k: kind, s: start_byte, e: end_byte, h: text_sha256}] (kind <> SUPPORTING_EVIDENCE)
//   structure.json      product_agreement_structures.payload of the run
// Usage: node scripts/product/replay-answer-forms.js --dir <folder> [--modes offsets,anchors3,anchors4,anchorsU] [--aliases table|letters]
const fs = require('fs');
const path = require('path');
const argv = process.argv.slice(2);
const argValue = (name, fallback) => { const at = argv.indexOf(name); return at >= 0 && argv[at + 1] ? argv[at + 1] : fallback; };
const repo = path.resolve(__dirname, '..', '..');
const dir = path.resolve(argValue('--dir', process.cwd()));
const { compileExtraction } = require(path.join(repo, 'lib/product/agreement-draft'));
const { spanAliases } = require(path.join(repo, 'lib/product/agreement-draft'));
const legalSchema = require(path.join(repo, 'contracts/product/legal-schema.v2.json'));
const tableShapes = require(path.join(repo, 'contracts/product/table-shapes.v3.json'));
const canonical = fs.readFileSync(path.join(dir, 'ncs-canonical.txt'), 'utf8');
const bytes = Buffer.from(canonical, 'utf8');
const calls = JSON.parse(fs.readFileSync(path.join(dir, 'calls-index.json'), 'utf8'));
const closures = JSON.parse(fs.readFileSync(path.join(dir, 'closures.json'), 'utf8'));
const spansMeta = JSON.parse(fs.readFileSync(path.join(dir, 'spans-meta.json'), 'utf8'));
const structure = JSON.parse(fs.readFileSync(path.join(dir, 'structure.json'), 'utf8'));
const answers = JSON.parse(fs.readFileSync(path.join(dir, 'answers.json'), 'utf8'));
const sourceDocument = { source_document_id: spansMeta[0].d, canonical_text: canonical };
const spanById = new Map(spansMeta.map((s) => [s.i, { span_id: s.i, source_document_id: s.d, structure_node_id: s.n, kind: s.k, start_byte: s.s, end_byte: s.e, text_sha256: s.h, exact_text: bytes.subarray(s.s, s.e).toString('utf8') }]));
const nodesById = new Map(structure.nodes.map((n) => [n.node_id, n]));
const closureByNode = new Map(closures.map((row) => [row.c.structure_node_id, row]));
function ownedNodeIds(nodeId) {
  const owned = new Set();
  for (const node of structure.nodes) {
    let cursor = node; const seen = new Set();
    while (cursor && !seen.has(cursor.node_id)) { if (cursor.node_id === nodeId) { owned.add(node.node_id); break; } seen.add(cursor.node_id); cursor = cursor.parent_id ? nodesById.get(cursor.parent_id) : null; }
  }
  return owned;
}
function buildClosure(row) {
  const c = row.c;
  const ids = [c.full_section_span_id, ...c.chapeau_span_ids, ...c.operative_span_ids, ...c.definition_span_ids, ...c.cross_reference_span_ids];
  const spans = [...new Set(ids)].map((id) => spanById.get(id)).filter(Boolean);
  for (const span of spanById.values()) if (span.kind === 'RESIDUAL_PARAGRAPH' && span.structure_node_id === c.structure_node_id && !spans.includes(span)) spans.push(span);
  return { ...c, spans };
}
const words = (text) => text.split(/\s+/).filter(Boolean);
const ALIAS_FORM = argValue('--aliases', 'table');
function rewrite(response, closure, baseline, mode) {
  const letters = spanAliases(closure).bySpan;
  // The manager's form: a per-call table of small integers to span ids,
  // supplied with the response; or E's deterministic letters.
  const table = new Map();
  const alias = (id) => {
    if (ALIAS_FORM === 'letters') return letters.get(id) || id;
    if (!closure.spans.some((span) => span.span_id === id)) return id;
    if (!table.has(id)) table.set(id, String(table.size + 1));
    return table.get(id);
  };
  const byIndex = baseline?.proposals || [];
  const out = JSON.parse(JSON.stringify(response));
  (out.proposals || []).forEach((proposal, index) => {
    delete proposal.roles;
    delete proposal.evidence_quotes;
    const compiled = byIndex[index];
    const walk = (raw, done, pathHere) => (raw || []).forEach((item, index) => {
      if (!item || typeof item !== 'object') return;
      item.source_span_id = alias(item.source_span_id);
      const compiledItem = done ? done[index] : null;
      if (typeof item.quote === 'string' && item.quote) {
        if (mode === 'offsets' && compiledItem && Number.isInteger(compiledItem.start_byte) && compiledItem.text === item.quote) {
          item.start_byte = compiledItem.start_byte; item.end_byte = compiledItem.end_byte; delete item.quote;
        } else if (mode.startsWith('anchors')) {
          const w = words(item.quote);
          const span = closure.spans.find((s) => s.span_id === (compiledItem?.source_span_id || '')) || closure.spans.find((s) => letters.get(s.span_id) === item.source_span_id || table.get(s.span_id) === item.source_span_id || s.span_id === item.source_span_id);
          const text = span ? span.exact_text : canonical;
          // The validator's rule: the shortest run opening on the first anchor and closing on the second, one such run.
          const runs = (first, last) => { const out = []; let at = text.indexOf(first); while (at >= 0) { const end = text.indexOf(last, at); if (end >= 0) out.push(text.slice(at, end + last.length)); at = text.indexOf(first, at + 1); } return out; };
          let n = mode === 'anchorsU' ? 3 : Number(mode.replace('anchors', '')) || 3;
          if (w.length > 2 * n) {
            let first = w.slice(0, n).join(' '); let last = w.slice(-n).join(' ');
            let ok = mode !== 'anchorsU';
            if (mode === 'anchorsU') {
              while (n <= 8 && w.length > 2 * n) { const found = runs(first, last); if (found.length === 1 && found[0] === item.quote) { ok = true; break; } n += 1; first = w.slice(0, n).join(' '); last = w.slice(-n).join(' '); }
            }
            if (ok) { item.quote_start = first; item.quote_end = last; delete item.quote; delete item.occurrence; totals.anchored = (totals.anchored || 0) + 1; } else totals.notAnchored = (totals.notAnchored || 0) + 1;
          }
        }
      }
      walk(item.children, compiledItem?.children, [...pathHere, index]);
    });
    walk(proposal.components, compiled?.components, []);
  });
  for (const link of out.links || []) if (Array.isArray(link.source_span_ids)) link.source_span_ids = link.source_span_ids.map(alias);
  if (ALIAS_FORM !== 'letters') out.span_aliases = Object.fromEntries([...table.entries()].map(([id, number]) => [number, id]));
  return out;
}
const parts = (p) => ({ s: p.validation_status, st: p.statement, h: [p.headline?.label, p.headline?.summary], c: (function strip(list) { return (list || []).map((c) => [c.kind, c.origin, c.text, c.start_byte, c.end_byte, c.value ?? null, strip(c.children)]); }(p.components)), r: p.conclusions ? [p.conclusions.table_key, p.conclusions.row_label, p.conclusions.row_detail ?? null, (p.conclusions.cells || []).map((cell) => [cell.column_id, cell.code ?? null, cell.text ?? null, cell.value ?? null])] : null });
const shape = (p) => JSON.stringify(parts(p));
const whyDiffer = (p, q) => { if (!q) return 'missing'; const a = parts(p), b = parts(q); return Object.keys(a).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k])).join('+'); };
function compile(row, call, response, routed) {
  const closure = buildClosure(row);
  const node = nodesById.get(row.c.structure_node_id) || { node_id: row.c.structure_node_id, reference: row.c.section_reference, kind: 'SECTION' };
  return compileExtraction({ sourceDocument, legalSchema, node, closure, call: { model_call_id: call.model_call_id }, response, routedFamilies: routed, ownedNodeIds: ownedNodeIds(node.node_id), tableShapes, agreementStructure: structure });
}
const MODES = argValue('--modes', process.env.MODES || 'offsets,anchors3,anchors4,anchorsU').split(',');
const totals = { calls: 0, skipped: 0, proposals: 0, same: Object.fromEntries(MODES.map((m) => [m, 0])), differ: Object.fromEntries(MODES.map((m) => [m, []])), failed: Object.fromEntries(MODES.map((m) => [m, 0])), bytes: { v9: 0, ...Object.fromEntries(MODES.map((m) => [m, 0])) }, statuses: {} };
for (const call of calls) {
  const answer = answers[call.model_call_id];
  const row = closureByNode.get(call.structure_node_id);
  if (!answer || !row) { totals.skipped += 1; continue; }
  let response; try { response = JSON.parse(answer); } catch { totals.skipped += 1; continue; }
  const families = [...new Set([...(row.r || []), ...(response.proposals || []).map((p) => p.family_key)])];
  let baseline;
  try { baseline = compile(row, call, response, families); } catch (error) { totals.skipped += 1; console.error('baseline failed', call.section_reference, error.message); continue; }
  totals.calls += 1; totals.proposals += baseline.proposals.length;
  for (const p of baseline.proposals) totals.statuses[p.validation_status] = (totals.statuses[p.validation_status] || 0) + 1;
  totals.bytes.v9 += Buffer.byteLength(JSON.stringify(response));
  for (const mode of MODES) {
    const v10 = rewrite(response, buildClosure(row), baseline, mode);
    totals.bytes[mode] += Buffer.byteLength(JSON.stringify(v10));
    let result;
    try { result = compile(row, call, v10, families); } catch (error) { totals.failed[mode] += 1; console.error(mode, 'compile failed', call.section_reference, error.message); continue; }
    // Compiled proposals carry no client_ref; both compiles keep the answer's order.
    if (result.proposals.length !== baseline.proposals.length) totals.countMismatch = (totals.countMismatch || 0) + 1;
    for (const [index, p] of baseline.proposals.entries()) {
      const q = result.proposals[index];
      if (q && shape(q) === shape(p)) totals.same[mode] += 1;
      else totals.differ[mode].push({ section: call.section_reference, ref: index, before: p.validation_status, after: q?.validation_status || 'missing', why: whyDiffer(p, q), issues: result.issues.filter((i) => (i.message || '').includes(`"client_ref":"${p.client_ref}"`) || (q && i.proposal_id === q.proposal_id)).map((i) => i.code + (i.code === 'INVALID_FACT_COMPONENTS' ? ':' + ((JSON.parse(i.message).problems || [])[0] || '').replace(/^[0-9.]+: /, '').slice(0, 60) : '')).slice(0, 4), before_c: q && whyDiffer(p, q).includes('c') ? parts(p).c.slice(0, 2) : undefined, after_c: q && whyDiffer(p, q).includes('c') ? parts(q).c.slice(0, 2) : undefined });
    }
  }
}
console.log(JSON.stringify({ ...totals, differ: Object.fromEntries(MODES.map((m) => [m, totals.differ[m].length])) }, null, 1));
fs.writeFileSync(path.join(dir, 'replay-differences.json'), JSON.stringify(totals.differ, null, 1));
