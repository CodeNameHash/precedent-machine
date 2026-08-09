#!/usr/bin/env node

import {
  existsSync, readdirSync, readFileSync, writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(SCRIPT_DIR, '..');
const DEFAULT_OUTPUT = 'evidence/canonical-v2/corpus-review-20260809.html';

class CorpusReviewArtifactError extends Error {
  constructor(code, outputPath) {
    super(`${code}:${outputPath}`);
    this.name = 'CorpusReviewArtifactError';
    this.code = code;
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function html(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function isFinalCorpusRun(name) {
  return name.includes('20260809-2xk') && name.endsWith('-final');
}

function sourceClaims(receipt) {
  return (receipt.compiled_candidates || [])
    .map((entry) => entry?.candidate?.claim)
    .filter(Boolean);
}

function findSourceClaim(item, claims) {
  if (typeof item.original_claim_occurrence_id === 'string') {
    const direct = claims.find((claim) => claim.claim_occurrence_id === item.original_claim_occurrence_id);
    if (direct) return direct;
  }
  const closureMatches = claims.filter((claim) => claim.closure_id === item.closure_id);
  if (closureMatches.length === 1) return closureMatches[0];
  const phrase = item.raw_value || item.normalised_phrase;
  const phraseMatches = claims.filter((claim) => claim.claim_definition_key === item.generic_claim_key
    && claim.raw_value === phrase);
  return phraseMatches.length === 1 ? phraseMatches[0] : null;
}

function resolvedClaim(item, resolution) {
  if (typeof item.claim_revision_id !== 'string') return null;
  return (resolution.resolved || []).find((row) => row.claim?.claim_revision_id === item.claim_revision_id) || null;
}

function excerptIdFor(item, resolution, claims) {
  const resolved = resolvedClaim(item, resolution);
  const claim = resolved?.claim || findSourceClaim(item, claims);
  return claim?.evidence?.[0]?.excerpt_id || null;
}

function openWorldExcerptId(item) {
  return item?.evidence?.[0]?.excerpt_id || null;
}

function buildCorpusReviewModel({ repoRoot = DEFAULT_ROOT, runNames = null } = {}) {
  const evidenceRoot = resolve(repoRoot, 'evidence/canonical-v2');
  const names = (runNames || readdirSync(evidenceRoot).filter(isFinalCorpusRun)).sort();
  const runs = [];
  for (const name of names) {
    const runDir = resolve(evidenceRoot, name);
    const required = ['run-manifest.json', 'run-receipt.json', 'resolution.json'];
    if (!required.every((file) => existsSync(resolve(runDir, file)))) continue;
    const manifest = readJson(resolve(runDir, 'run-manifest.json'));
    const receipt = readJson(resolve(runDir, 'run-receipt.json'));
    const resolution = readJson(resolve(runDir, 'resolution.json'));
    const claims = sourceClaims(receipt);
    const attempted = resolution.review_queue || [];
    runs.push(Object.freeze({
      name,
      deal: manifest.deal,
      family: manifest.section_family,
      attempted: attempted.length,
      resolved: (resolution.resolved || []).length,
      open_world: (resolution.open_world || []).length,
      holdbacks: attempted.filter((item) => item.has_resolution === false)
        .flatMap((item) => item.reasons || []),
      claims: [
        ...attempted.map((item, index) => Object.freeze({
          run: name,
          deal: manifest.deal,
          family: manifest.section_family,
          section: item.section_reference || '',
          excerpt_id: excerptIdFor(item, resolution, claims),
          raw_value: item.raw_value || item.normalised_phrase || String(item.canonical_value ?? ''),
          claim_kind: item.resolved_claim_definition_key || item.generic_claim_key || 'UNKNOWN_CLAIM',
          state: item.has_resolution === true ? 'RESOLVED' : 'HELD',
          reasons: Object.freeze([...(item.reasons || [])]),
          source_index: `review_queue:${index}`,
        })),
        ...(resolution.open_world || []).map((item, index) => Object.freeze({
          run: name,
          deal: manifest.deal,
          family: manifest.section_family,
          section: item.section_reference || '',
          excerpt_id: openWorldExcerptId(item),
          raw_value: item.raw_value || String(item.canonical_value ?? ''),
          claim_kind: item.claim_definition_key || 'UNKNOWN_OPEN_WORLD_CLAIM',
          state: 'OPEN_WORLD',
          reasons: Object.freeze(item.reason ? [item.reason] : []),
          source_index: `open_world:${index}`,
        })),
      ],
    }));
  }

  const familyMap = new Map();
  for (const run of runs) {
    if (!familyMap.has(run.family)) {
      familyMap.set(run.family, {
        family: run.family, attempted: 0, resolved: 0, open_world: 0, holdbacks: new Map(),
      });
    }
    const family = familyMap.get(run.family);
    family.attempted += run.attempted;
    family.resolved += run.resolved;
    family.open_world += run.open_world;
    for (const reason of run.holdbacks) family.holdbacks.set(reason, (family.holdbacks.get(reason) || 0) + 1);
  }
  const families = [...familyMap.values()].map((family) => Object.freeze({
    ...family,
    rate: family.attempted === 0 ? null : family.resolved / family.attempted,
    holdbacks: Object.freeze([...family.holdbacks.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((left, right) => right.count - left.count || left.reason.localeCompare(right.reason))),
  })).sort((left, right) => (left.rate ?? Infinity) - (right.rate ?? Infinity)
    || left.family.localeCompare(right.family));

  const deals = [...new Set(runs.map((run) => run.deal))].sort();
  const matrix = new Map();
  for (const run of runs) {
    const key = `${run.deal}\0${run.family}`;
    matrix.set(key, (matrix.get(key) || 0) + run.attempted);
  }

  const groups = new Map();
  for (const run of runs) {
    for (const claim of run.claims) {
      const excerpt = claim.excerpt_id || `NO_EXCERPT_ID:${claim.run}:${claim.source_index}`;
      const key = `${claim.family}\0${claim.deal}\0${claim.run}\0${excerpt}`;
      if (!groups.has(key)) groups.set(key, { family: claim.family, deal: claim.deal, run: claim.run, excerpt_id: excerpt, claims: [] });
      groups.get(key).claims.push(claim);
    }
  }
  const familyOrder = new Map(families.map((family, index) => [family.family, index]));
  const excerptGroups = [...groups.values()].sort((left, right) => familyOrder.get(left.family) - familyOrder.get(right.family)
    || left.deal.localeCompare(right.deal) || left.run.localeCompare(right.run)
    || left.excerpt_id.localeCompare(right.excerpt_id));

  return Object.freeze({ runs: Object.freeze(runs), families: Object.freeze(families), deals: Object.freeze(deals), matrix, excerptGroups: Object.freeze(excerptGroups) });
}

function percentage(rate) {
  return rate == null ? 'n/a' : `${(rate * 100).toFixed(1)}%`;
}

function renderCorpusReview(model) {
  const familyHeaders = model.families.map((family) => `<th>${html(family.family)}</th>`).join('');
  const matrixRows = model.deals.map((deal) => `<tr><th>${html(deal)}</th>${model.families.map((family) => {
    const key = `${deal}\0${family.family}`;
    return model.matrix.has(key) ? `<td>${model.matrix.get(key)}</td>` : '<td class="empty"></td>';
  }).join('')}</tr>`).join('\n');
  const familyRows = model.families.map((family) => `<tr><th>${html(family.family)}</th><td>${family.attempted}</td><td>${family.resolved}</td><td>${percentage(family.rate)}</td><td>${family.open_world}</td></tr>`).join('\n');
  const holdbackRows = model.families.map((family) => `<tr><th>${html(family.family)}</th><td>${family.holdbacks.length ? family.holdbacks.map((item) => `<span class="reason">${html(item.reason)} <b>${item.count}</b></span>`).join('') : '<span class="muted">None</span>'}</td></tr>`).join('\n');
  const familyOptions = model.families.map((family) => `<option value="${html(family.family)}">${html(family.family)}</option>`).join('');
  let number = 0;
  const cards = model.excerptGroups.map((group) => {
    number += 1;
    const claims = group.claims.map((claim) => `<li data-state="${html(claim.state)}"><span class="state ${claim.state.toLowerCase()}">${claim.state}</span> <b>${html(claim.claim_kind)}</b>${claim.section ? ` <span class="muted">§ ${html(claim.section)}</span>` : ''}${claim.reasons.length ? `<div class="reasons">${claim.reasons.map(html).join(', ')}</div>` : ''}<div class="claim-text">${html(claim.raw_value)}</div></li>`).join('');
    return `<article class="card" data-family="${html(group.family)}"><header><span class="number">#${number}</span><div><h3>${html(group.family)} · ${html(group.deal)}</h3><div class="meta">${html(group.run)} · excerpt ${html(group.excerpt_id)}</div></div></header><ol>${claims}</ol></article>`;
  }).join('\n');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:"><title>Canonical V2 corpus review</title><style>
:root{color-scheme:light;--ink:#17202a;--muted:#65717e;--line:#d8dee5;--paper:#fff;--wash:#f4f6f8;--held:#8a3b12;--resolved:#17633a;--open:#5b3a91}*{box-sizing:border-box}[hidden]{display:none!important}html,body{margin:0;max-width:100%;overflow-x:hidden}body{font-family:Arial,sans-serif;background:var(--wash);color:var(--ink);line-height:1.42}main{width:min(1500px,100%);margin:auto;padding:32px 20px 72px}h1{font-size:32px;margin:0 0 6px}h2{margin:40px 0 12px;font-size:22px}h3{margin:0;font-size:16px}.lede,.muted,.meta{color:var(--muted)}.table-scroll{width:100%;max-width:100%;overflow-x:auto;background:var(--paper);border:1px solid var(--line);border-radius:8px}table{border-collapse:collapse;min-width:760px;width:100%}th,td{text-align:left;padding:9px 11px;border-bottom:1px solid var(--line);white-space:nowrap}thead th{position:sticky;top:0;background:#e9edf1;z-index:1}td.empty{background:repeating-linear-gradient(135deg,#fff,#fff 5px,#f1f3f5 5px,#f1f3f5 10px)}.reason{display:inline-block;margin:2px 8px 2px 0;padding:3px 7px;background:#eef1f4;border-radius:4px}.filters{display:flex;flex-wrap:wrap;gap:12px;align-items:end;margin:0 0 14px;padding:14px;background:var(--paper);border:1px solid var(--line);border-radius:8px}.filters label{display:grid;gap:4px;font-size:12px;font-weight:700}.filters select{min-width:220px;padding:8px 10px;border:1px solid #aeb7c0;border-radius:5px;background:white;color:var(--ink);font:inherit}.filter-count{margin-left:auto;color:var(--muted);font-size:14px}.cards{display:grid;gap:12px}.card{background:var(--paper);border:1px solid var(--line);border-radius:8px;padding:16px;min-width:0}.card header{display:flex;gap:12px;align-items:flex-start}.number{font-weight:700;background:#17202a;color:white;border-radius:4px;padding:3px 7px}.card ol{margin:14px 0 0;padding-left:28px}.card li{padding:9px 0;border-top:1px solid #edf0f2}.state{font-size:12px;font-weight:700;padding:2px 5px;border-radius:3px}.state.resolved{color:var(--resolved);background:#e7f4ec}.state.held{color:var(--held);background:#fbeee7}.state.open_world{color:var(--open);background:#f1eafa}.claim-text{margin-top:4px;overflow-wrap:anywhere}.reasons{font-size:12px;color:var(--held)}
</style></head><body><main><h1>Canonical V2 corpus review</h1><p class="lede">Final 2X-K extraction evidence. Rates use resolved ÷ review_queue. Empty matrix cells mean no final run for that deal and family.</p>
<h2>Family resolution, worst rate first</h2><div class="table-scroll"><table><thead><tr><th>Family</th><th>Attempted</th><th>Resolved</th><th>Rate</th><th>Open-world</th></tr></thead><tbody>${familyRows}</tbody></table></div>
<h2>Deal × family attempted claim counts</h2><div class="table-scroll"><table><thead><tr><th>Deal</th>${familyHeaders}</tr></thead><tbody>${matrixRows}</tbody></table></div>
<h2>Hold-back reasons by family</h2><div class="table-scroll"><table><thead><tr><th>Family</th><th>Reason counts</th></tr></thead><tbody>${holdbackRows}</tbody></table></div>
<h2>Claims grouped by excerpt</h2><div class="filters" aria-label="Claim filters"><label>Family<select id="family-filter"><option value="ALL">All families</option>${familyOptions}</select></label><label>Status<select id="status-filter"><option value="ALL">All claims</option><option value="HELD">Unresolved only</option><option value="OPEN_WORLD">Open-world only</option></select></label><output id="filter-count" class="filter-count" aria-live="polite"></output></div><div class="cards">${cards}</div></main><script>
const familyFilter=document.querySelector('#family-filter');const statusFilter=document.querySelector('#status-filter');const count=document.querySelector('#filter-count');const cards=[...document.querySelectorAll('.card')];function applyFilters(){let visibleCards=0;let visibleClaims=0;for(const card of cards){const familyMatches=familyFilter.value==='ALL'||card.dataset.family===familyFilter.value;let cardClaims=0;for(const claim of card.querySelectorAll('li[data-state]')){const statusMatches=statusFilter.value==='ALL'||claim.dataset.state===statusFilter.value;claim.hidden=!(familyMatches&&statusMatches);if(!claim.hidden)cardClaims+=1}card.hidden=cardClaims===0;if(!card.hidden){visibleCards+=1;visibleClaims+=cardClaims}}count.textContent=visibleClaims.toLocaleString()+' claims in '+visibleCards.toLocaleString()+' excerpts'}familyFilter.addEventListener('change',applyFilters);statusFilter.addEventListener('change',applyFilters);applyFilters();
</script></body></html>`;
}

function expectedCorpusReview({ repoRoot = DEFAULT_ROOT, runNames = null } = {}) {
  const model = buildCorpusReviewModel({ repoRoot, runNames });
  return Object.freeze({ model, html: renderCorpusReview(model) });
}

function checkCorpusReviewArtifact({ repoRoot = DEFAULT_ROOT, outputPath = DEFAULT_OUTPUT, runNames = null } = {}) {
  const output = resolve(repoRoot, outputPath);
  const expected = expectedCorpusReview({ repoRoot, runNames });
  if (!existsSync(output) || readFileSync(output, 'utf8') !== expected.html) {
    throw new CorpusReviewArtifactError('STALE_CORPUS_REVIEW_ARTIFACT', output);
  }
  return Object.freeze({ outputPath: output, runs: expected.model.runs.length, cards: expected.model.excerptGroups.length });
}

function parseArgs(argv) {
  if (argv.length === 0) return { mode: 'write', outputPath: DEFAULT_OUTPUT };
  if (argv.length === 1 && !argv[0].startsWith('--')) return { mode: 'write', outputPath: argv[0] };
  if ((argv[0] === '--write' || argv[0] === '--check') && argv.length <= 2) {
    return { mode: argv[0].slice(2), outputPath: argv[1] || DEFAULT_OUTPUT };
  }
  throw new Error('usage: canonical-v2-corpus-review-artifact.mjs [--write|--check] [output-path]');
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.mode === 'check') {
    const result = checkCorpusReviewArtifact({ outputPath: args.outputPath });
    process.stdout.write(`CHECKED ${result.outputPath}\n${result.runs} runs, ${result.cards} cards\n`);
    return result;
  }
  const output = resolve(DEFAULT_ROOT, args.outputPath);
  const expected = expectedCorpusReview();
  writeFileSync(output, expected.html);
  process.stdout.write(`${output}\n${expected.model.runs.length} runs, ${expected.model.excerptGroups.length} cards\n`);
  return Object.freeze({ outputPath: output, runs: expected.model.runs.length, cards: expected.model.excerptGroups.length });
}

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) main();

export {
  buildCorpusReviewModel,
  checkCorpusReviewArtifact,
  CorpusReviewArtifactError,
  expectedCorpusReview,
  isFinalCorpusRun,
  renderCorpusReview,
};
