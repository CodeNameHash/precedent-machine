#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { canonicalJson } = require('../lib/canonical-v2/canonical-bytes');
const {
  buildRepresentationTopicReviewPacket,
  buildEmptyRepresentationTopicDecisionLedger,
  ordinaryRepresentationTopicReviewGate,
} = require('../lib/canonical-v2/representation-topic-review-ledger');
const { buildRepresentationTopicReplay } = await import('./stage-2y-h-representation-topic-replay.mjs');

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');
const REVIEW_OUTPUT = 'evidence/canonical-v2/stage-2y-h-representation-topic-review.html';
const LEDGER_OUTPUT = 'evidence/canonical-v2/stage-2y-h-representation-topic-decision-ledger.json';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function options(values) {
  return ['<option value="">All</option>', ...[...new Set(values)].sort().map((value) => (
    `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`
  ))].join('');
}

function rowHtml(card) {
  const proposed = card.proposed_topic || '—';
  const reason = card.unclassified_reason || '—';
  const templates = card.state === 'CLASSIFIED'
    ? [
      { decision_key: card.decision_key, verdict: 'ACCEPT_PROPOSED_TOPIC', decided_topic: card.proposed_topic, reviewer_id: '<reviewer>', reviewed_at: '<UTC timestamp>' },
      { decision_key: card.decision_key, verdict: 'REJECT_PROPOSED_TOPIC', decided_topic: null, reviewer_id: '<reviewer>', reviewed_at: '<UTC timestamp>' },
      { decision_key: card.decision_key, verdict: 'ASSIGN_TOPIC', decided_topic: '<approved topic code, different from proposed>', reviewer_id: '<reviewer>', reviewed_at: '<UTC timestamp>' },
    ]
    : [
      { decision_key: card.decision_key, verdict: 'CONFIRM_UNCLASSIFIED', decided_topic: null, reviewer_id: '<reviewer>', reviewed_at: '<UTC timestamp>' },
      { decision_key: card.decision_key, verdict: 'ASSIGN_TOPIC', decided_topic: '<approved topic code>', reviewer_id: '<reviewer>', reviewed_at: '<UTC timestamp>' },
    ];
  return `<article class="card" data-family="${escapeHtml(card.family)}" data-topic="${escapeHtml(card.proposed_topic || '')}" data-state="${escapeHtml(card.state)}">
  <h2>Card ${card.card_number}</h2>
  <dl><dt>Deal</dt><dd>${escapeHtml(card.deal)}</dd><dt>Section</dt><dd>${escapeHtml(card.section_reference)}</dd><dt>Family</dt><dd>${escapeHtml(card.family)}</dd><dt>Subject</dt><dd>${escapeHtml(card.subject || '—')}</dd><dt>State</dt><dd>${escapeHtml(card.state)}</dd><dt>Proposed topic</dt><dd>${escapeHtml(proposed)}</dd><dt>Unclassified reason</dt><dd>${escapeHtml(reason)}</dd><dt>Decision key</dt><dd><code>${escapeHtml(card.decision_key)}</code></dd><dt>Claim occurrence</dt><dd><code>${escapeHtml(card.identity.claim_occurrence_id || '—')}</code></dd><dt>Closure</dt><dd><code>${escapeHtml(card.identity.closure_id)}</code></dd></dl>
  <h3>Exact source excerpt</h3><pre>${escapeHtml(card.raw_value)}</pre>
  <div class="table-wrap"><table><thead><tr><th>Evidence role</th><th>Excerpt ID</th><th>UTF-8 byte start</th><th>UTF-8 byte end</th><th>Excerpt digest</th><th>Registry digest</th><th>Topic rule</th></tr></thead><tbody><tr><td>${escapeHtml(card.evidence.evidence_role || '—')}</td><td><code>${escapeHtml(card.evidence.excerpt_id || '—')}</code></td><td>${card.evidence.absolute_start}</td><td>${card.evidence.absolute_end}</td><td><code>${escapeHtml(card.evidence.utf8_digest)}</code></td><td><code>${escapeHtml(card.registry_digest)}</code></td><td>${escapeHtml(card.topic_match_rule_id || '—')}</td></tr></tbody></table></div>
  <details><summary>Permitted decision template</summary><pre>${escapeHtml(canonicalJson(templates))}</pre></details>
</article>`;
}

function renderHtml({ reviewPacket, decisionLedger, gate }) {
  const cards = reviewPacket.cards;
  const classified = cards.filter((card) => card.state === 'CLASSIFIED').length;
  const unclassified = cards.length - classified;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Representation Topic Review</title><style>
*{box-sizing:border-box}body{margin:0;background:#f7f7f5;color:#151515;font:14px/1.45 system-ui,sans-serif}main{max-width:1200px;margin:auto;padding:24px}.meta,.filters,.card{background:#fff;border:1px solid #d8d8d4;border-radius:8px;padding:16px;margin:0 0 14px}.filters{display:flex;gap:12px;flex-wrap:wrap;align-items:end}.filters label{display:grid;gap:4px;font-weight:650}.filters select{padding:7px;background:white;border:1px solid #999;border-radius:4px}.card h2{margin:0 0 10px;font-size:17px}.card h3{font-size:14px;margin:14px 0 6px}dl{display:grid;grid-template-columns:150px 1fr;gap:4px 12px;margin:0}dt{font-weight:650}dd{margin:0;overflow-wrap:anywhere}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f4f4f1;padding:12px;border-radius:4px;margin:0}.table-wrap{overflow-x:auto;max-width:100%;margin-top:12px}table{border-collapse:collapse;min-width:900px;width:100%}th,td{padding:7px;border:1px solid #ddd;text-align:left;vertical-align:top}th{background:#f0f0ed}code{overflow-wrap:anywhere}.hidden{display:none}.count{font-weight:650}</style></head><body><main>
<h1>Representation topic review</h1><section class="meta"><p><span class="count">${cards.length}</span> cards: ${classified} classified, ${unclassified} unclassified. Ordinary review gate: <strong>${escapeHtml(gate.reason)}</strong>.</p><p>Review packet: <code>${escapeHtml(reviewPacket.review_packet_id)}</code><br>Input digest: <code>${escapeHtml(reviewPacket.review_input_digest)}</code><br>Empty decision ledger: <code>${escapeHtml(decisionLedger.decision_ledger_id)}</code></p></section>
<section class="filters"><label>Family<select id="family">${options(cards.map((card) => card.family))}</select></label><label>Proposed topic<select id="topic">${options(cards.map((card) => card.proposed_topic).filter(Boolean))}</select></label><label>State<select id="state">${options(cards.map((card) => card.state))}</select></label><span id="visible" class="count"></span></section>
<section id="cards">${cards.map(rowHtml).join('\n')}</section>
</main><script>const controls=['family','topic','state'].map(id=>document.getElementById(id));const cards=[...document.querySelectorAll('.card')];const visible=document.getElementById('visible');function filter(){let n=0;for(const card of cards){const ok=controls.every(c=>!c.value||card.dataset[c.id]===c.value);card.classList.toggle('hidden',!ok);if(ok)n++}visible.textContent=n+' visible'}for(const control of controls)control.addEventListener('change',filter);filter();</script></body></html>`;
}

function buildReviewArtefacts({ repoRoot = ROOT } = {}) {
  const replay = buildRepresentationTopicReplay({ repoRoot });
  const reviewPacket = buildRepresentationTopicReviewPacket({ representation_rows: replay.representation_rows });
  const decisionLedger = buildEmptyRepresentationTopicDecisionLedger({ review_packet: reviewPacket });
  const gate = ordinaryRepresentationTopicReviewGate({ ledger: decisionLedger, review_packet: reviewPacket });
  return Object.freeze({ replay, reviewPacket, decisionLedger, gate, html: renderHtml({ reviewPacket, decisionLedger, gate }) });
}

function expectedOutputs() {
  const artefacts = buildReviewArtefacts();
  return {
    [resolve(ROOT, REVIEW_OUTPUT)]: artefacts.html,
    [resolve(ROOT, LEDGER_OUTPUT)]: `${canonicalJson(artefacts.decisionLedger)}\n`,
  };
}

function main() {
  const mode = process.argv[2];
  if (!['--write', '--check'].includes(mode) || process.argv.length !== 3) throw new Error('usage: --write | --check');
  const outputs = expectedOutputs();
  if (mode === '--write') for (const [file, contents] of Object.entries(outputs)) writeFileSync(file, contents);
  for (const [file, contents] of Object.entries(outputs)) {
    if (!existsSync(file) || readFileSync(file, 'utf8') !== contents) throw new Error(`STALE_OUTPUT:${file}`);
  }
  const { reviewPacket, gate } = buildReviewArtefacts();
  process.stdout.write(`representation review cards: ${reviewPacket.cards.length}; ordinary review gate: ${gate.reason}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

export { REVIEW_OUTPUT, LEDGER_OUTPUT, buildReviewArtefacts, renderHtml };
