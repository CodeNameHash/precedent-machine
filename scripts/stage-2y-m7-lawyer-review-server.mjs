#!/usr/bin/env node

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { canonicalJson, contentId, sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'evidence/canonical-v2/stage-2y-structure-migration';
const CORRECTION_MODE = process.argv.length === 3 && process.argv[2] === '--row-correction';
if ((!CORRECTION_MODE && process.argv.length !== 2)
  || (CORRECTION_MODE && (process.argv.length !== 3 || process.argv[2] !== '--row-correction'))) {
  throw new Error('use no arguments for the withdrawn packet or --row-correction for the replacement packet');
}
const REVIEW_ROOT = `${BASE}/shadow/m7${CORRECTION_MODE ? '-row-correction' : ''}`;
const PACKET_PATH = `${REVIEW_ROOT}/lawyer-review-packet.json`;
const LEDGER_PATH = `${REVIEW_ROOT}/lawyer-decision-ledger.json`;
const PORT = Number(process.env.M7_REVIEW_PORT || 4315);

function absolute(relativePath) {
  return path.join(ROOT, relativePath);
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(absolute(relativePath), 'utf8'));
}

function fileBinding(relativePath) {
  const bytes = fs.readFileSync(absolute(relativePath));
  return { path: relativePath, byte_length: bytes.length, sha256: sha256Hex(bytes) };
}

function sendJson(response, status, value) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(`${JSON.stringify(value)}\n`);
}

function packetAndLedger() {
  const packet = readJson(PACKET_PATH);
  const ledger = readJson(LEDGER_PATH);
  if (packet.lawyer_review_packet_id !== ledger.lawyer_review_packet_binding.path
    && fileBinding(PACKET_PATH).sha256 !== ledger.lawyer_review_packet_binding.sha256) {
    throw new Error('review packet binding mismatch');
  }
  return { packet, ledger };
}

function updatedLedger(packet, current, submitted) {
  const item = packet.items.find((entry) => entry.review_item_id === submitted.review_item_id);
  if (!item) throw new Error('unknown review item');
  if (!['CORRECT', 'INCORRECT', 'CANNOT_JUDGE'].includes(submitted.decision)) throw new Error('invalid decision');
  const note = typeof submitted.note === 'string' ? submitted.note.trim().slice(0, 4000) : '';
  const decision = {
    schema_version: 'STAGE_2Y_LAWYER_DECISION/V1',
    review_item_id: item.review_item_id,
    sample_ordinal: item.sample_ordinal,
    decision: submitted.decision,
    note: note || null,
    reviewer: 'BEN_GOODCHILD',
  };
  decision.lawyer_decision_id = contentId(decision.schema_version, {
    review_item_id: decision.review_item_id,
    sample_ordinal: decision.sample_ordinal,
    decision: decision.decision,
    note: decision.note,
    reviewer: decision.reviewer,
  });
  const decisions = [...current.decisions.filter((entry) => entry.review_item_id !== decision.review_item_id), decision]
    .sort((left, right) => left.sample_ordinal - right.sample_ordinal);
  const counts = {
    total: packet.sample_size,
    answered: decisions.length,
    correct: decisions.filter((entry) => entry.decision === 'CORRECT').length,
    incorrect: decisions.filter((entry) => entry.decision === 'INCORRECT').length,
    cannot_judge: decisions.filter((entry) => entry.decision === 'CANNOT_JUDGE').length,
    remaining: packet.sample_size - decisions.length,
  };
  const gateState = counts.incorrect || counts.cannot_judge
    ? 'FAILED_RETURN_AFFECTED_ITEM_TYPES_FOR_REPAIR'
    : counts.remaining === 0 ? 'PASS_PENDING_TECHNICAL_SEAL' : 'PENDING_HUMAN_REVIEW';
  const payload = {
    stage: 'M7',
    ledger_state: counts.remaining === 0 ? 'COMPLETE' : 'IN_PROGRESS',
    combined_ten_corpus_digest: current.combined_ten_corpus_digest,
    lawyer_sample_policy_binding: current.lawyer_sample_policy_binding,
    lawyer_review_packet_binding: current.lawyer_review_packet_binding,
    reviewer: current.reviewer,
    decisions,
    counts,
    gate_state: gateState,
  };
  return {
    schema_version: 'STAGE_2Y_LAWYER_DECISION_LEDGER/V1',
    lawyer_decision_ledger_id: contentId('STAGE_2Y_LAWYER_DECISION_LEDGER/V1', payload),
    ...payload,
  };
}

function writeLedger(ledger) {
  fs.writeFileSync(absolute(LEDGER_PATH), Buffer.from(`${canonicalJson(ledger)}\n`, 'utf8'));
}

function bodyFrom(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let bytes = 0;
    request.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > 10000) {
        reject(new Error('request too large'));
        request.destroy();
      } else chunks.push(chunk);
    });
    request.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (error) { reject(error); }
    });
    request.on('error', reject);
  });
}

const HTML = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>M7 legal review</title>
  <style>
    :root { color-scheme: light; --ink:#191816; --muted:#66615a; --line:#ddd8cf; --paper:#fffdfa; --wash:#f4f1eb; --accent:#254f42; --bad:#9b2c20; --warn:#8a5a00; }
    * { box-sizing: border-box; }
    body { margin:0; background:var(--wash); color:var(--ink); font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    button,textarea { font:inherit; }
    header { position:sticky; top:0; z-index:4; background:rgba(244,241,235,.96); border-bottom:1px solid var(--line); backdrop-filter:blur(8px); }
    .bar { max-width:1100px; margin:auto; padding:16px 24px; display:flex; align-items:center; gap:20px; }
    .brand { font-weight:750; letter-spacing:-.02em; white-space:nowrap; }
    .progress { height:8px; flex:1; overflow:hidden; border-radius:99px; background:#ded9d0; }
    .progress > div { height:100%; background:var(--accent); transition:width .2s; }
    .count { color:var(--muted); font-size:14px; white-space:nowrap; }
    main { max-width:1100px; margin:34px auto 80px; padding:0 24px; }
    .intro { margin-bottom:22px; }
    h1 { margin:0 0 6px; font-size:29px; line-height:1.2; letter-spacing:-.035em; }
    .intro p { margin:0; max-width:760px; color:var(--muted); }
    .card { background:var(--paper); border:1px solid var(--line); border-radius:14px; box-shadow:0 8px 30px rgba(40,34,24,.055); overflow:hidden; }
    .meta { display:flex; flex-wrap:wrap; gap:8px; align-items:center; padding:18px 22px; border-bottom:1px solid var(--line); }
    .pill { border-radius:99px; background:#e9e5dd; padding:4px 9px; color:#4c4842; font-size:12px; font-weight:700; }
    .section { padding:24px 26px; border-bottom:1px solid var(--line); }
    .section:last-child { border:0; }
    .eyebrow { margin:0 0 10px; color:var(--muted); font-size:12px; font-weight:800; letter-spacing:.09em; text-transform:uppercase; }
    .source { white-space:pre-wrap; font-family:Georgia,serif; font-size:17px; line-height:1.7; color:#2c2925; max-height:360px; overflow:auto; border-left:3px solid #aaa398; padding-left:18px; }
    .proposal { border-radius:9px; background:#eef2ef; padding:17px 19px; white-space:pre-wrap; }
    .proposal.none { background:#f5eee0; }
    .question { margin:0 0 10px; font-size:20px; line-height:1.35; }
    .help { color:var(--muted); font-size:14px; margin:0 0 16px; }
    textarea { width:100%; min-height:82px; resize:vertical; border:1px solid var(--line); border-radius:8px; background:white; padding:12px; }
    .actions { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-top:14px; }
    .decision { cursor:pointer; border:1px solid var(--line); border-radius:9px; padding:12px 10px; background:white; font-weight:750; }
    .decision.correct:hover,.decision.correct.selected { background:#e5f1ec; border-color:#7ba694; color:#174d3b; }
    .decision.incorrect:hover,.decision.incorrect.selected { background:#f8e6e3; border-color:#c8847b; color:var(--bad); }
    .decision.cannot:hover,.decision.cannot.selected { background:#f8efdc; border-color:#c8a66a; color:var(--warn); }
    .nav { display:flex; justify-content:space-between; gap:12px; margin-top:18px; }
    .nav button { cursor:pointer; border:1px solid var(--line); border-radius:8px; background:var(--paper); padding:10px 15px; }
    .nav button:disabled { opacity:.4; cursor:default; }
    details { margin-top:15px; color:var(--muted); font-size:13px; }
    pre { white-space:pre-wrap; overflow-wrap:anywhere; }
    .saved { min-height:24px; margin-top:10px; color:var(--accent); font-weight:700; }
    .done { padding:44px; text-align:center; }
    @media (max-width:700px) { .actions { grid-template-columns:1fr; } .bar { padding:12px 16px; } main { padding:0 14px; margin-top:20px; } .section { padding:20px; } }
  </style>
</head>
<body>
  <header><div class="bar"><div class="brand">M7 legal review</div><div class="progress"><div id="progress"></div></div><div class="count" id="count"></div></div></header>
  <main><div class="intro"><h1>Does the proposed result preserve the law?</h1><p>The comparison entry is the set of facts Corpus would line up across agreements. It is not an interpretation or a replacement for the clause. Read the source first. Then check the comparison point, parties, key facts, timing and qualifications. Style comments do not fail a legally correct result.</p></div><div id="app"></div></main>
  <script>
    const familyNames = {
      EMPLOYEE_MATTERS:'Employee matters', TERMINATION:'Termination rights', GENERAL_COVENANTS:'General covenants', CLOSING_CONDITIONS:'Closing conditions', MAE_DEFINITION:'Material adverse effect', KEY_DEFINED_TERMS:'Defined terms', REPRESENTATIONS:'Representations', INTERIM_OPERATING:'Interim operating covenants', NO_SHOP:'Deal protection', DNO_INDEMNIFICATION:'Director and officer protection', NO_OTHER_REPS_FRAUD:'Non-reliance and fraud', ANTITRUST_REGULATORY:'Regulatory approvals', APPRAISAL_DISSENTERS_RIGHTS:'Appraisal rights', CAPITALISATION:'Capitalisation', CONSIDERATION:'Merger consideration', DIVIDENDS:'Dividends', FINANCING_COVENANTS:'Financing covenants', GUARANTY_FINANCING_PARTY:'Guarantees and financing parties', MATERIAL_CONTRACTS:'Material contracts', MERGER_STRUCTURE_CLOSING:'Merger structure and closing', MISC_BOILERPLATE:'General contract terms', PROXY_MEETING:'Proxy and shareholder meeting', SPECIFIC_PERFORMANCE_REMEDIES:'Specific performance', TAX_MATTERS:'Tax matters', TERMINATION_FEE:'Termination fees'
    };
    const deals = {'abbvie-landos':'AbbVie / Landos','lilly-verve':'Lilly / Verve','rocket-redfin':'Rocket / Redfin'};
    let state, current = 0;
    const esc = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    const decisionFor = id => state.ledger.decisions.find(d => d.review_item_id === id);
    function explanation(item) {
      if (item.item_kind === 'REVIEW_ONLY_NO_NORMAL_ROW') return 'Corpus proposes not to show this as a normal comparison item because a required legal fact is missing or unclear.';
      if (item.item_kind === 'PARSER_AMBIGUITY') return 'Corpus found that the numbering could be read in more than one way. It flags the issue and blocks only a comparison that depends on that reading.';
      return item.expanded_row || item.compact_row;
    }
    function render() {
      const items = state.packet.items, item = items[current], saved = decisionFor(item.review_item_id);
      const answered = state.ledger.counts.answered;
      document.getElementById('progress').style.width = (answered / items.length * 100) + '%';
      document.getElementById('count').textContent = answered + ' of ' + items.length + ' answered';
      const meta = [familyNames[item.family_key] || null, deals[item.candidate_key] || null, item.section_reference ? 'Section ' + item.section_reference : null, item.item_kind === 'SOURCE_TO_ROW' ? 'Proposed row' : item.item_kind === 'REVIEW_ONLY_NO_NORMAL_ROW' ? 'Held back' : 'Source ambiguity'].filter(Boolean);
      document.getElementById('app').innerHTML = '<div class="card">' +
        '<div class="meta"><strong>Item ' + item.sample_ordinal + ' of ' + items.length + '</strong>' + meta.map(x => '<span class="pill">' + esc(x) + '</span>').join('') + '</div>' +
        '<div class="section"><p class="eyebrow">Source clause</p><div class="source">' + esc(item.source_excerpt) + '</div></div>' +
        '<div class="section"><p class="eyebrow">Comparison entry Corpus would store</p><div class="proposal ' + (item.item_kind === 'SOURCE_TO_ROW' ? '' : 'none') + '">' + esc(explanation(item)) + '</div>' + (item.compact_row && item.compact_row !== item.expanded_row ? '<details><summary>Show the short label</summary><pre>' + esc(item.compact_row) + '</pre></details>' : '') + '</div>' +
        '<div class="section"><h2 class="question">' + esc(item.plain_english_question) + '</h2><p class="help">Choose “Legally wrong” if an important fact, party, condition, exception, timing rule or legal effect is missing or wrong. Use the note to identify it.</p>' +
        '<textarea id="note" placeholder="Optional note. If wrong or unclear, state the missing or incorrect legal fact.">' + esc(saved?.note || '') + '</textarea>' +
        '<div class="actions"><button class="decision correct ' + (saved?.decision === 'CORRECT' ? 'selected' : '') + '" data-choice="CORRECT">Legally correct</button><button class="decision incorrect ' + (saved?.decision === 'INCORRECT' ? 'selected' : '') + '" data-choice="INCORRECT">Legally wrong</button><button class="decision cannot ' + (saved?.decision === 'CANNOT_JUDGE' ? 'selected' : '') + '" data-choice="CANNOT_JUDGE">Can’t judge from this card</button></div><div class="saved" id="saved">' + (saved ? 'Answer saved' : '') + '</div>' +
        '<details><summary>Show technical lineage</summary><pre>' + esc(JSON.stringify(item.lineage, null, 2)) + '</pre></details></div></div>' +
        '<div class="nav"><button id="prev" ' + (current === 0 ? 'disabled' : '') + '>Previous</button><button id="next">' + (current === items.length - 1 ? 'First unanswered' : 'Next') + '</button></div>';
      document.querySelectorAll('[data-choice]').forEach(button => button.onclick = () => save(item, button.dataset.choice));
      document.getElementById('prev').onclick = () => { if (current) { current--; render(); scrollTo(0,0); } };
      document.getElementById('next').onclick = () => {
        if (current < items.length - 1) current++;
        else { const index = items.findIndex(entry => !decisionFor(entry.review_item_id)); current = index < 0 ? 0 : index; }
        render(); scrollTo(0,0);
      };
    }
    async function save(item, decision) {
      const note = document.getElementById('note').value;
      const response = await fetch('/api/decision', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({review_item_id:item.review_item_id,decision,note})});
      if (!response.ok) { document.getElementById('saved').textContent = 'Could not save. Try again.'; return; }
      state.ledger = (await response.json()).ledger;
      render();
      setTimeout(() => { if (current < state.packet.items.length - 1) { current++; render(); scrollTo(0,0); } }, 280);
    }
    fetch('/api/state').then(r => r.json()).then(value => { state = value; const first = state.packet.items.findIndex(item => !decisionFor(item.review_item_id)); current = first < 0 ? 0 : first; render(); });
  </script>
</body>
</html>`;

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || '127.0.0.1'}`);
    if (request.method === 'GET' && url.pathname === '/') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      response.end(HTML);
      return;
    }
    if (request.method === 'GET' && url.pathname === '/api/state') {
      sendJson(response, 200, packetAndLedger());
      return;
    }
    if (request.method === 'POST' && url.pathname === '/api/decision') {
      const submitted = await bodyFrom(request);
      const { packet, ledger } = packetAndLedger();
      const updated = updatedLedger(packet, ledger, submitted);
      writeLedger(updated);
      sendJson(response, 200, { ok: true, ledger: updated });
      return;
    }
    sendJson(response, 404, { error: 'not found' });
  } catch (error) {
    sendJson(response, 400, { error: error.message });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  process.stdout.write(`M7 legal review: http://127.0.0.1:${PORT}/\n`);
});
