#!/usr/bin/env node

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { isFinalCorpusRun } from './canonical-v2-corpus-review-artifact.mjs';

const require = createRequire(import.meta.url);
const { canonicalJson } = require('../lib/canonical-v2/canonical-bytes');
const {
  buildHumanAnchorMachinePacket,
  buildHumanAnchorReviewPacket,
  buildHumanAnchorKey,
  buildEmptyHumanAnchorDecisionLedger,
  humanAnchorReviewGate,
} = require('../lib/canonical-v2/human-anchor-review');

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');
const OUTPUT_DIR = 'evidence/blind-review/2026-08-09';
const MACHINE_OUTPUT = `${OUTPUT_DIR}/stage-2y-0-human-anchor-machine-packet.json`;
const REVIEW_OUTPUT = `${OUTPUT_DIR}/stage-2y-0-human-anchor-review.html`;
const KEY_OUTPUT = `${OUTPUT_DIR}/stage-2y-0-human-anchor-key.json`;
const LEDGER_OUTPUT = `${OUTPUT_DIR}/stage-2y-0-human-anchor-decision-ledger.json`;

function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')); }
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}
function sourceRuns({ repoRoot = ROOT } = {}) {
  const evidenceRoot = resolve(repoRoot, 'evidence/canonical-v2');
  return readdirSync(evidenceRoot).filter(isFinalCorpusRun).sort().map((run) => {
    const dir = resolve(evidenceRoot, run);
    return Object.freeze({
      run,
      manifest: readJson(resolve(dir, 'run-manifest.json')),
      receipt: readJson(resolve(dir, 'run-receipt.json')),
      adapter: readJson(resolve(dir, 'adapter-result.json')),
      resolution: readJson(resolve(dir, 'resolution.json')),
    });
  });
}
function options(values) {
  return ['<option value="ALL">All</option>', ...[...new Set(values)].sort().map((value) => (
    `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`
  ))].join('');
}
function renderReviewerHtml({ reviewPacket, ledger, gate }) {
  const cards = reviewPacket.cards.map((card) => `<article class="card" data-family="${escapeHtml(card.family)}" data-error-class="${escapeHtml(card.error_class)}">
<h2>Card ${card.card_number}</h2><dl><dt>Deal</dt><dd>${escapeHtml(card.deal)}</dd><dt>Family</dt><dd>${escapeHtml(card.family)}</dd><dt>Section</dt><dd>${escapeHtml(card.section_reference)}</dd><dt>Claim kind</dt><dd>${escapeHtml(card.claim_definition_key)}</dd><dt>Review class</dt><dd>${escapeHtml(card.error_class)}</dd><dt>Decision key</dt><dd><code>${escapeHtml(card.decision_key)}</code></dd></dl>
<h3>Exact source excerpt</h3><pre>${escapeHtml(card.evidence.excerpt)}</pre>
<div class="table-scroll"><table><thead><tr><th>Evidence role</th><th>Excerpt ID</th><th>UTF-8 byte start</th><th>UTF-8 byte end</th><th>Excerpt digest</th></tr></thead><tbody><tr><td>${escapeHtml(card.evidence.evidence_role || '—')}</td><td><code>${escapeHtml(card.evidence.excerpt_id)}</code></td><td>${card.evidence.absolute_start}</td><td>${card.evidence.absolute_end}</td><td><code>${escapeHtml(card.evidence.excerpt_digest)}</code></td></tr></tbody></table></div>
<h3>Proposed analysis</h3><dl><dt>Field</dt><dd>${escapeHtml(card.proposed_analysis.field)}</dd><dt>Proposed value</dt><dd>${escapeHtml(card.proposed_analysis.proposed_value)}</dd></dl>
<details><summary>Decision template</summary><pre>${escapeHtml(canonicalJson({ decision_key: card.decision_key, reviewer_id: '<reviewer>', reviewed_at: '<UTC timestamp>', verdict: 'CORRECT | ERROR' }))}</pre></details>
</article>`).join('\n');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'"><title>Human anchor review</title><style>
*{box-sizing:border-box}html,body{margin:0;max-width:100%;overflow-x:hidden}body{background:#f5f6f7;color:#17202a;font:14px/1.45 Arial,sans-serif}main{max-width:1260px;margin:auto;padding:24px}.meta,.filters,.card{background:#fff;border:1px solid #d7dce1;border-radius:8px;padding:16px;margin:0 0 14px}.filters{display:flex;flex-wrap:wrap;gap:12px;align-items:end}.filters label{display:grid;gap:4px;font-weight:700}.filters select{min-width:220px;padding:8px;background:#fff;border:1px solid #9aa6b2;border-radius:4px}.count{font-weight:700;margin-left:auto}.card h2{margin:0 0 10px;font-size:17px}.card h3{font-size:14px;margin:14px 0 6px}dl{display:grid;grid-template-columns:150px 1fr;gap:4px 12px;margin:0}dt{font-weight:700}dd{margin:0;overflow-wrap:anywhere}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f1f3f5;padding:12px;border-radius:4px;margin:0}.table-scroll{overflow-x:auto;max-width:100%;margin-top:12px}table{border-collapse:collapse;min-width:900px;width:100%}th,td{padding:7px;border:1px solid #d7dce1;text-align:left;vertical-align:top}th{background:#edf0f2}code{overflow-wrap:anywhere}.hidden{display:none!important}
</style></head><body><main><h1>Human anchor review</h1><section class="meta"><p>${reviewPacket.cards.length} numbered cards. Mark each proposed analysis as correct or error against the exact source excerpt.</p><p>Review packet: <code>${escapeHtml(reviewPacket.review_packet_id)}</code><br>Decision ledger: <code>${escapeHtml(ledger.decision_ledger_id)}</code><br>Gate: <strong>${escapeHtml(gate.reason)}</strong></p></section><section class="filters"><label>Family<select id="family-filter">${options(reviewPacket.cards.map((card) => card.family))}</select></label><label>Review class<select id="class-filter">${options(reviewPacket.cards.map((card) => card.error_class))}</select></label><output id="filter-count" class="count" aria-live="polite"></output></section><section id="cards">${cards}</section></main><script>
const family=document.querySelector('#family-filter');const errorClass=document.querySelector('#class-filter');const count=document.querySelector('#filter-count');const cards=[...document.querySelectorAll('.card')];function apply(){let n=0;for(const card of cards){const show=(family.value==='ALL'||card.dataset.family===family.value)&&(errorClass.value==='ALL'||card.dataset.errorClass===errorClass.value);card.classList.toggle('hidden',!show);if(show)n++}count.textContent=n+' visible cards'}family.addEventListener('change',apply);errorClass.addEventListener('change',apply);apply();
</script></body></html>`;
}
function buildHumanAnchorArtefacts({ repoRoot = ROOT } = {}) {
  const machinePacket = buildHumanAnchorMachinePacket({ runs: sourceRuns({ repoRoot }) });
  const reviewPacket = buildHumanAnchorReviewPacket({ machine_packet: machinePacket });
  const key = buildHumanAnchorKey({ machine_packet: machinePacket, review_packet: reviewPacket });
  const ledger = buildEmptyHumanAnchorDecisionLedger({ review_packet: reviewPacket });
  const gate = humanAnchorReviewGate({ ledger, review_packet: reviewPacket });
  return Object.freeze({ machinePacket, reviewPacket, key, ledger, gate, html: renderReviewerHtml({ reviewPacket, ledger, gate }) });
}
function expectedOutputs({ repoRoot = ROOT } = {}) {
  const artefacts = buildHumanAnchorArtefacts({ repoRoot });
  return Object.freeze({
    [resolve(repoRoot, MACHINE_OUTPUT)]: `${canonicalJson(artefacts.machinePacket)}\n`,
    [resolve(repoRoot, REVIEW_OUTPUT)]: artefacts.html,
    [resolve(repoRoot, KEY_OUTPUT)]: `${canonicalJson(artefacts.key)}\n`,
    [resolve(repoRoot, LEDGER_OUTPUT)]: `${canonicalJson(artefacts.ledger)}\n`,
  });
}
function main() {
  const mode = process.argv[2];
  if (!['--write', '--check'].includes(mode) || process.argv.length !== 3) throw new Error('usage: --write | --check');
  const outputs = expectedOutputs();
  if (mode === '--write') {
    mkdirSync(resolve(ROOT, OUTPUT_DIR), { recursive: true });
    for (const [file, contents] of Object.entries(outputs)) writeFileSync(file, contents);
  }
  for (const [file, contents] of Object.entries(outputs)) {
    if (!existsSync(file) || readFileSync(file, 'utf8') !== contents) throw new Error(`STALE_OUTPUT:${file}`);
  }
  const { machinePacket, gate } = buildHumanAnchorArtefacts();
  process.stdout.write(`human anchor cards: ${machinePacket.cards.length}; gate: ${gate.reason}\n`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

export { OUTPUT_DIR, MACHINE_OUTPUT, REVIEW_OUTPUT, KEY_OUTPUT, LEDGER_OUTPUT, sourceRuns, renderReviewerHtml, buildHumanAnchorArtefacts, expectedOutputs };
