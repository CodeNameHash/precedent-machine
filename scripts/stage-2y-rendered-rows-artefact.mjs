#!/usr/bin/env node
// Stage 2Y-N — the rendered-rows artefact.
//
// Ben, 2026-08-09: "I want to see what it is proposing to render — not just
// that it has coded it one way or the other. Otherwise we're saying it
// categorized correctly but like, what is the output?"
//
// This walks the latest run per (deal, family), renders every resolved claim
// through the REAL Review V2 config path via `previewClaimSection`, and writes
// a self-contained HTML page showing, for each claim: the excerpt, its
// governing context, and the row a lawyer would see.
//
// It renders nothing it cannot render. Families with no claim-to-review-card
// projection are reported as such rather than omitted — see the comment in
// `lib/review-parity/rendered-row-preview-contract.js`.
//
// Report-only. Touches no disposition, changes no resolution, makes no model
// call.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EVIDENCE = path.join(ROOT, 'evidence/canonical-v2');
const OUT_HTML = path.join(EVIDENCE, 'stage-2y-n-rendered-rows.html');
const OUT_JSON = path.join(EVIDENCE, 'stage-2y-n-rendered-rows.json');
const PER_FAMILY = Number(process.env.PER_FAMILY || 8);

const preview = await import(path.join(ROOT, 'lib/review-parity/rendered-row-preview.js'))
  .then((m) => m.default || m);

function latestRunsPerDealFamily() {
  const best = new Map();
  for (const dir of fs.readdirSync(EVIDENCE)) {
    if (!/-2xk(-r\d)?-final$/.test(dir)) continue;
    const manifestPath = path.join(EVIDENCE, dir, 'run-manifest.json');
    const resolutionPath = path.join(EVIDENCE, dir, 'resolution.json');
    if (!fs.existsSync(manifestPath) || !fs.existsSync(resolutionPath)) continue;
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const resolution = JSON.parse(fs.readFileSync(resolutionPath, 'utf8'));
    const count = (resolution.resolved || []).length;
    if (!count) continue;
    const key = `${manifest.section_family}|${manifest.deal}`;
    if (!best.has(key) || best.get(key).count < count) {
      best.set(key, { dir, manifest, resolution, count });
    }
  }
  return [...best.values()];
}

function claimExcerpt(entry) {
  const evidence = entry?.claim?.evidence || entry?.evidence || [];
  const operative = Array.isArray(evidence)
    ? evidence.find((e) => e?.evidence_role === 'OPERATIVE_TEXT') || evidence[0]
    : null;
  return operative?.excerpt || entry?.claim?.raw_value || '';
}

const runs = latestRunsPerDealFamily();
const records = [];
const renderedSignatures = new Map();
const tally = new Map();

for (const run of runs) {
  const family = run.manifest.section_family;
  if (!tally.has(family)) tally.set(family, { family, renderable: 0, attempted: 0, errors: {} });
  const stat = tally.get(family);
  let takenForThisRun = 0;
  for (const entry of run.resolution.resolved) {
    stat.attempted += 1;
    let rendered = null;
    try {
      rendered = preview.previewClaimSection({ run: { manifest: run.manifest, resolution: run.resolution }, resolved_entry: entry });
      stat.renderable += 1;
    } catch (error) {
      const code = error.code || 'UNKNOWN';
      stat.errors[code] = (stat.errors[code] || 0) + 1;
      continue;
    }
    if (takenForThisRun >= PER_FAMILY) continue;
    // Pick the row the claim actually FILLS, not the section's catalogue.
    //
    // Catalogue configs (material contracts, employee benefits, termination
    // rights) emit their whole fixed row set whatever the claim is. The first
    // version of this artefact showed the first three of them, so 297 of 310
    // cards displayed rows belonging to other provisions entirely — which read
    // as cross-contamination in the product and was not. It was this bug.
    //
    // The reviewDeal here is already sliced to the claim's own provision, so a
    // row the claim does not fill renders empty or renders the absence copy.
    // Keep rows with real content; fall back to the key match; and if neither
    // finds anything, say so on the card rather than showing a catalogue.
    const ABSENT = /not found \(may not be present|not yet extracted|not specified|none specified/i;
    const populated = rendered.rows.filter((row) => row.cells.some((cell) => {
      const text = (cell.text || '').trim();
      return text && !ABSENT.test(text);
    }));
    const keyMatched = rendered.rows.filter((row) => row.matches_claim_key);
    const chosen = populated.length ? populated : keyMatched;
    const record = {
      deal: run.manifest.deal,
      family,
      run: run.dir,
      section: entry?.claim?.section_reference || rendered.section.id,
      claim_definition_key: rendered.resolved_claim_definition_key,
      excerpt: claimExcerpt(entry),
      section_title: rendered.section.title,
      row_count: rendered.row_count,
      row_selection: populated.length ? 'POPULATED' : (keyMatched.length ? 'KEY_MATCH' : 'NONE_IDENTIFIED'),
      rows: chosen.slice(0, 3).map((row) => ({
        id: row.id,
        label: row.label,
        matched: row.matches_claim_key,
        cells: row.cells.filter((cell) => cell.text && cell.text.trim()).slice(0, 6),
      })),
    };
    // Collapse claims whose RENDERED OUTPUT is identical. Ben reviewed 65 cards
    // and wrote "dupe of 29", "dupe of 33", "dupe of 44" a dozen times: three
    // different Material Contracts claims -- acquisition/disposition,
    // indebtedness, leases -- render byte-identical rows, because the catalogue
    // table is not driven by the individual claim. Showing them as separate
    // cards wastes a reviewer's time on the same output and buries the finding.
    // One card, with the count and every claim it covers named.
    const signature = JSON.stringify({ rows: record.rows, sel: record.row_selection });
    const seen = renderedSignatures.get(`${family}|${run.manifest.deal}|${signature}`);
    if (seen) {
      seen.duplicate_count += 1;
      seen.also_covers.push({ section: record.section, claim_definition_key: record.claim_definition_key, excerpt: record.excerpt });
      continue;
    }
    takenForThisRun += 1;
    record.duplicate_count = 1;
    record.also_covers = [];
    renderedSignatures.set(`${family}|${run.manifest.deal}|${signature}`, record);
    records.push(record);
  }
}

const families = [...tally.values()].sort((a, b) => b.attempted - a.attempted);
const totals = families.reduce((acc, f) => ({ renderable: acc.renderable + f.renderable, attempted: acc.attempted + f.attempted }), { renderable: 0, attempted: 0 });

const summary = {
  schema_version: 'STAGE_2Y_N_RENDERED_ROWS/V1',
  authority: 'REPORT_ONLY',
  publication_authorisation: 'NONE',
  generated_from: 'latest run per (deal, family) matching -2xk[-rN]-final',
  run_count: runs.length,
  routed_families: Object.keys(preview.FAMILY_ROUTES),
  unrouted_note: 'INTERIM_OPERATING and MAE_DEFINITION have no claim-to-review-card projection. Their projections return no cards array, so no route can render them. See lib/review-parity/rendered-row-preview-contract.js.',
  totals,
  by_family: families,
  sampled_records: records.length,
};

fs.writeFileSync(OUT_JSON, `${JSON.stringify({ ...summary, records }, null, 1)}\n`);

const esc = (value) => String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = (a, b) => (b ? `${((100 * a) / b).toFixed(1)}%` : 'n/a');

const familyRows = families.map((f) => `<tr><th>${esc(f.family)}</th><td class="n">${f.renderable}</td><td class="n">${f.attempted}</td><td class="n">${pct(f.renderable, f.attempted)}</td><td>${esc(Object.entries(f.errors).map(([k, v]) => `${k} ${v}`).join(', ') || '—')}</td></tr>`).join('\n');

const cards = records.map((r, i) => `
<article class="card" data-key="${esc(r.deal)}|${esc(r.family)}|${esc(r.section)}|${i}">
  <header><span class="num">${i + 1}</span><div><h3>${esc(r.deal)} · ${esc(r.family)} · §${esc(r.section)}</h3>
  <p class="meta">${esc(r.claim_definition_key || 'no claim key')} · section renders ${r.row_count} row${r.row_count === 1 ? '' : 's'}${r.duplicate_count > 1 ? ` · <strong class="dupe">${r.duplicate_count} claims render this identical output</strong>` : ''}</p></div></header>
  <div class="lbl">What was extracted</div>
  <blockquote>${esc(r.excerpt)}</blockquote>
  ${r.also_covers.length ? `<details class="also"><summary>${r.also_covers.length} other claim${r.also_covers.length === 1 ? '' : 's'} produce exactly this — click to read them</summary>${r.also_covers.map((o) => `<blockquote>${esc(o.excerpt)}</blockquote>`).join('')}</details>` : ''}
  <div class="lbl">What a lawyer sees</div>
  ${r.row_selection === 'NONE_IDENTIFIED' ? '<p class="empty">No row in this section carries content for this claim. That is the finding — the claim resolved and fills nothing a reader would see.</p>' : ''}
  ${r.rows.map((row) => `<div class="row${row.matched ? ' matched' : ''}">
    <div class="rl">${esc(row.label || row.id)}${row.matched ? ' <span class="tag">matches claim</span>' : ''}</div>
    ${row.cells.length ? `<table class="cells">${row.cells.map((c) => `<tr><th>${esc(c.header || c.id)}</th><td>${esc(c.text)}</td></tr>`).join('')}</table>` : '<p class="empty">every cell empty</p>'}
  </div>`).join('\n')}
  <div class="verdict">
    <button type="button" class="v" data-v="RIGHT">Right</button>
    <button type="button" class="v" data-v="WRONG">Wrong</button>
    <button type="button" class="v" data-v="THIN">Right but thin</button>
    <button type="button" class="v" data-v="UNSURE">Can't tell</button>
  </div>
  <textarea class="note" rows="2" placeholder="What is wrong with it, or what is missing? Free text — as long as you like."></textarea>
</article>`).join('\n');

fs.writeFileSync(OUT_HTML, `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Stage 2Y-N — what the system proposes to render</title>
<style>
:root{--ink:#14181d;--muted:#5a6472;--line:#d3d9e0;--paper:#fff;--wash:#eef0f3;--accent:#31456b;--good:#2c6144;--bad:#98302f}
*{box-sizing:border-box}body{margin:0;background:var(--wash);color:var(--ink);font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
main{width:min(1080px,100%);margin:auto;padding:32px 20px 80px}
h1{font:600 30px/1.2 Charter,Georgia,serif;margin:0 0 8px}h2{font:600 21px/1.3 Charter,Georgia,serif;margin:40px 0 12px}
h3{font:600 16px/1.3 Charter,Georgia,serif;margin:0}
.lede{color:var(--muted);max-width:66ch}
.table-scroll{overflow-x:auto;background:var(--paper);border:1px solid var(--line);border-radius:8px}
table{border-collapse:collapse;width:100%;min-width:560px}th,td{text-align:left;padding:9px 12px;border-bottom:1px solid #e4e9ee;font-size:14px}
thead th{background:#e9edf1;font:600 12px/1.3 sans-serif;letter-spacing:.04em;text-transform:uppercase;color:var(--muted)}
td.n{font-variant-numeric:tabular-nums;font-family:ui-monospace,Menlo,monospace}
.card{background:var(--paper);border:1px solid var(--line);border-radius:9px;padding:18px;margin:14px 0}
.card header{display:flex;gap:12px;align-items:flex-start;margin-bottom:12px}
.num{font:700 11px/1 ui-monospace,monospace;background:var(--ink);color:#fff;border-radius:4px;padding:5px 7px}
.meta{color:var(--muted);font-size:13px;margin:3px 0 0}
.lbl{font:600 11px/1.4 sans-serif;letter-spacing:.09em;text-transform:uppercase;color:var(--muted);margin:14px 0 6px}
blockquote{margin:0;padding:12px 14px;background:#f7f8fa;border-left:3px solid var(--accent);border-radius:5px;font:16px/1.5 Charter,Georgia,serif}
.row{border:1px solid var(--line);border-radius:6px;padding:11px 13px;margin:8px 0}
.row.matched{border-color:var(--good);background:#f2f8f4}
.rl{font-weight:600;margin-bottom:7px}
.tag{font:700 10px/1 sans-serif;letter-spacing:.06em;text-transform:uppercase;color:var(--good);border:1px solid var(--good);border-radius:3px;padding:3px 5px;vertical-align:2px}
.cells{min-width:0}.cells th{width:34%;color:var(--muted);font-weight:600;font-size:13px;vertical-align:top}
.empty{color:var(--bad);font-size:13.5px;margin:0}
.note{background:#fff;border:1px solid var(--line);border-left:3px solid var(--bad);border-radius:6px;padding:14px 16px;margin:16px 0;font-size:14.5px}
.dupe{color:var(--bad)}
details.also{margin:8px 0 0;font-size:14px}
details.also summary{cursor:pointer;color:var(--bad);font-weight:600;padding:6px 0}
details.also blockquote{font-size:14.5px;margin-top:7px}
.verdict{display:flex;gap:7px;flex-wrap:wrap;margin:14px 0 8px}
.verdict button{font:600 13px/1 sans-serif;padding:9px 13px;border-radius:6px;border:1px solid var(--line);background:#fff;color:var(--ink);cursor:pointer}
.verdict button:hover{border-color:var(--accent)}
.verdict button.on[data-v=RIGHT]{background:#e6f1ea;border-color:var(--good);color:var(--good)}
.verdict button.on[data-v=WRONG]{background:#fae9e8;border-color:var(--bad);color:var(--bad)}
.verdict button.on[data-v=THIN]{background:#faf0dc;border-color:#8a5a0b;color:#8a5a0b}
.verdict button.on[data-v=UNSURE]{background:#eef0f3;border-color:var(--muted);color:var(--muted)}
textarea.note{width:100%;font:14px/1.5 sans-serif;padding:10px 12px;border:1px solid var(--line);border-left:1px solid var(--line);border-radius:6px;resize:vertical;color:var(--ink);background:#fcfdfe}
textarea.note:focus{outline:2px solid var(--accent);outline-offset:1px}
#bar{position:sticky;top:0;z-index:9;background:rgba(238,240,243,.94);backdrop-filter:blur(8px);border-bottom:1px solid var(--line);padding:11px 0;margin:0 0 8px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
#bar b{font-variant-numeric:tabular-nums}
#bar button{font:600 13px/1 sans-serif;padding:9px 14px;border-radius:6px;border:1px solid var(--accent);background:var(--accent);color:#fff;cursor:pointer}
#bar button.ghost{background:#fff;color:var(--ink);border-color:var(--line)}
#out{width:100%;min-height:220px;font:12.5px/1.5 ui-monospace,Menlo,monospace;padding:14px;border:1px solid var(--line);border-radius:8px;white-space:pre;overflow:auto;background:#fff;color:var(--ink)}
</style></head><body><main>
<h1>What the system proposes to render</h1>
<p class="lede">Every resolved claim below is run through the <strong>real</strong> Review V2 config path — the same
<code>selectRows</code> and cell renderers the review page uses — and shown as the row a lawyer would see.
Report-only: no disposition changed, no model called.</p>

<h2>How much of what resolves actually renders</h2>
<div class="table-scroll"><table>
<thead><tr><th>Family</th><th>Renders</th><th>Resolved</th><th>Rate</th><th>Failures</th></tr></thead>
<tbody>${familyRows}
<tr><th>Total</th><td class="n">${totals.renderable}</td><td class="n">${totals.attempted}</td><td class="n">${pct(totals.renderable, totals.attempted)}</td><td></td></tr>
</tbody></table></div>

<div class="note"><strong>Two families are missing from that table, and their absence is the finding.</strong>
INTERIM_OPERATING and MAE_DEFINITION have <em>no claim-to-review-card projection at all</em> — their projection
functions return no <code>cards</code> array, so no routing fixes it. That is 221 resolved claims across two of the
largest families with no path from a resolved claim to a rendered row. Building that adapter is real work and it is
not scheduled.</div>

<h2>${records.length} claims, end to end</h2>
<div id="bar">
  <span>Reviewed <b id="cnt">0</b> of ${records.length}</span>
  <span style="color:var(--muted);font-size:13.5px">Saves as you type. Keys: nothing to learn — just click and write.</span>
  <button type="button" id="build">Build export</button>
  <button type="button" class="ghost" id="copy">Select all &amp; copy</button>
</div>
${cards}
<h2>Export</h2>
<p class="lede">Click <strong>Build export</strong>, then <strong>Select all &amp; copy</strong>. If the copy is
refused the text stays selected — press ⌘C.</p>
<textarea id="out" readonly spellcheck="false">Nothing built yet.</textarea>
<script>
const KEY='pm-2yn-feedback-v1';
let state={};
try{state=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){}};
const cards=[...document.querySelectorAll('article.card')];
function paint(){
  document.getElementById('cnt').textContent=Object.values(state).filter(v=>v&&(v.verdict||v.note)).length;
}
for(const card of cards){
  const k=card.dataset.key;
  state[k]=state[k]||{};
  const ta=card.querySelector('textarea.note');
  ta.value=state[k].note||'';
  ta.addEventListener('input',()=>{state[k].note=ta.value;save();paint()});
  for(const b of card.querySelectorAll('.verdict button')){
    if(state[k].verdict===b.dataset.v)b.classList.add('on');
    b.addEventListener('click',()=>{
      const v=b.dataset.v;
      state[k].verdict=state[k].verdict===v?null:v;
      for(const o of card.querySelectorAll('.verdict button'))o.classList.toggle('on',o.dataset.v===state[k].verdict);
      save();paint();
    });
  }
}
const out=document.getElementById('out');
function build(){
  const rows=[];
  for(const card of cards){
    const k=card.dataset.key; const v=state[k]||{};
    if(!v.verdict&&!v.note)continue;
    const [deal,family,section]=k.split('|');
    rows.push({deal,family,section,card_index:Number(k.split('|')[3]),verdict:v.verdict||null,note:v.note||null});
  }
  out.value=JSON.stringify({schema:'PM_STAGE_2Y_N_ROW_FEEDBACK/V1',produced_at:new Date().toISOString(),reviewed:rows.length,of:cards.length,rows},null,1);
}
document.getElementById('build').addEventListener('click',build);
out.addEventListener('focus',e=>e.target.select());
out.addEventListener('click',e=>e.target.select());
document.getElementById('copy').addEventListener('click',async()=>{
  if(out.value==='Nothing built yet.')build();
  out.removeAttribute('readonly');out.focus();out.setSelectionRange(0,out.value.length);out.select();out.setAttribute('readonly','');
  try{await navigator.clipboard.writeText(out.value);return}catch(e){}
  try{document.execCommand('copy')}catch(e){}
});
paint();
</script>
</main></body></html>
`);

process.stdout.write(`${JSON.stringify({ runs: runs.length, ...totals, sampled: records.length }, null, 1)}\n`);
process.stdout.write(`wrote ${path.relative(ROOT, OUT_HTML)}\n`);
process.stdout.write(`wrote ${path.relative(ROOT, OUT_JSON)}\n`);
