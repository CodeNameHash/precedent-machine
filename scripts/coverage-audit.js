#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────
   scripts/coverage-audit.js — LLM post-check on the coverage metric.

   The coverage gate excludes head matter (cover/TOC) and trailing ancillary
   regions (signature stacks, charter exhibit forms, attached separate
   agreements) from its denominator. Those exclusions are heuristic — and the
   failure mode is quiet: a definitions appendix or offer-conditions annex
   wrongly classified as boilerplate would vanish from the metric without
   anyone noticing (definitions DO live in annexes: Catalent Exhibit A).

   This script audits both sides with an LLM reader:
     1. Every EXCLUDED region — flag any that contains substantive deal
        content the corpus should capture (definitions, offer conditions,
        operative provisions).
     2. Every large REMAINING gap — classify as genuinely missed substantive
        content vs residual boilerplate, producing the re-extraction
        worklist.

   Usage:
     node scripts/coverage-audit.js --deal "Cox" [--backend claude]
     node scripts/coverage-audit.js --all
   Exit 1 if any excluded region is flagged substantive.
   Report: reports/coverage-audit-<ts>.json
   ───────────────────────────────────────────────────────────────────────── */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { createClaudeCliClient, createCodexCliClient } = require('../lib/llm-cli-client');
const { computeCoverage, normalizeForMatch } = require('../lib/verification');
const { loadDotEnvLocal, findDotEnvLocal } = require('./ingest-local.js');

const MIN_GAP_AUDIT_CHARS = 1500;

// Head + middle + tail sample so a definitions appendix starting mid-region
// can't hide behind a boilerplate opening.
function sampleRegion(text) {
  if (text.length <= 7000) return text;
  const mid = Math.floor(text.length / 2);
  return `${text.slice(0, 3000)}\n[... ${text.length - 7000} chars omitted ...]\n${text.slice(mid, mid + 2500)}\n[...]\n${text.slice(-1500)}`;
}

function classifyPrompt(kind, label, sample) {
  return `You are auditing an M&A contract-analysis pipeline's coverage metric. Below is a region of an SEC merger-agreement filing that the pipeline ${kind === 'excluded' ? `EXCLUDED from its extraction-coverage denominator (heuristic label: "${label}")` : 'did NOT capture in any extracted provision'}.

Classify the region. Return ONLY a JSON object:
{
  "classification": "COVER_TOC" | "SIGNATURES" | "CHARTER_EXHIBIT_FORM" | "SEPARATE_ANCILLARY_AGREEMENT" | "SUBSTANTIVE_DEAL_CONTENT",
  "substantive_kinds": ["definitions" | "offer_conditions" | "covenants" | "conditions" | "termination" | "consideration" | "other_operative"],
  "rationale": "one sentence"
}

Rules:
- SUBSTANTIVE_DEAL_CONTENT means text carrying OPERATIVE language the merger agreement's analysis must capture: defined terms WITH their definitions (a "Certain Definitions" annex/appendix counts!), tender-offer conditions annexes, or operative merger-agreement provisions (covenants, conditions, termination, consideration mechanics).
- A table of contents or index that merely LISTS section titles/defined-term names (with page or section numbers, no operative text) is COVER_TOC — even though the titles it lists sound substantive. The listed sections live in the body and are captured there.
- A voting agreement, tax receivable agreement, limited guarantee, or CVR agreement attached as a SEPARATE executed contract is SEPARATE_ANCILLARY_AGREEMENT — not substantive for this metric — UNLESS the sampled text shows the merger agreement's own defined terms or conditions embedded in it.
- A form of charter/bylaws/certificate attached as an exhibit is CHARTER_EXHIBIT_FORM.
- If genuinely mixed, choose SUBSTANTIVE_DEAL_CONTENT and say what's substantive.

Region sample:
"""
${sample}
"""

Return ONLY the JSON object.`;
}

async function classify(client, kind, label, sample) {
  const resp = await client.messages.create({
    model: 'audit',
    max_tokens: 300,
    messages: [{ role: 'user', content: classifyPrompt(kind, label, sample) }],
  });
  const raw = (resp.content && resp.content[0] && resp.content[0].text) || '{}';
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return { classification: 'UNPARSEABLE', rationale: raw.slice(0, 200) };
  try { return JSON.parse(m[0]); } catch { return { classification: 'UNPARSEABLE', rationale: raw.slice(0, 200) }; }
}

async function fetchAllProvisions(sb, dealId) {
  const out = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await sb.from('provisions').select('*').eq('deal_id', dealId).range(offset, offset + 999);
    if (error) throw new Error(error.message);
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
    offset += 1000;
  }
  return out;
}

async function auditDeal(sb, client, deal) {
  const src = (deal.metadata && deal.metadata.full_text) || '';
  if (!src) return { deal: deal.target, skipped: 'no full_text' };
  const provisions = await fetchAllProvisions(sb, deal.id);
  const cov = computeCoverage(provisions, src);
  const normSource = normalizeForMatch(src);

  const findings = { deal: `${deal.acquirer} / ${deal.target}`, deal_id: deal.id, pct: cov.pct, rawPct: cov.rawPct, excluded: [], gaps: [] };

  for (const region of cov.excludedRegions || []) {
    const text = normSource.slice(region.start, region.start + region.length);
    const verdict = await classify(client, 'excluded', region.label, sampleRegion(text));
    findings.excluded.push({ ...region, verdict });
    const flag = verdict.classification === 'SUBSTANTIVE_DEAL_CONTENT' ? '  ⚠ FLAG' : '';
    console.log(`  excluded [${region.label}] ${region.length} chars -> ${verdict.classification}${flag}`);
  }

  for (const gap of (cov.gaps || []).filter((g) => g.length >= MIN_GAP_AUDIT_CHARS)) {
    const text = normSource.slice(gap.start, gap.start + gap.length);
    const verdict = await classify(client, 'gap', null, sampleRegion(text));
    findings.gaps.push({ start: gap.start, length: gap.length, preview: gap.preview.slice(0, 120), verdict });
    const flag = verdict.classification === 'SUBSTANTIVE_DEAL_CONTENT' ? '  ⚠ MISSED CONTENT' : '';
    console.log(`  gap ${gap.length} chars @${gap.start} -> ${verdict.classification}${flag}`);
  }

  return findings;
}

function parseArgs(argv) {
  const args = { deal: null, all: false, backend: 'claude' };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--deal') args.deal = argv[++i];
    else if (a === '--all') args.all = true;
    else if (a === '--backend') args.backend = argv[++i];
    else { console.error(`Unknown arg: ${a}`); process.exit(1); }
  }
  if (!args.deal && !args.all) { console.error('Provide --deal <name> or --all'); process.exit(1); }
  return args;
}

async function main() {
  loadDotEnvLocal(findDotEnvLocal());
  const args = parseArgs(process.argv);
  const sb = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const client = args.backend === 'codex' ? createCodexCliClient({}) : createClaudeCliClient({ model: 'sonnet' });

  let { data: deals, error } = await sb.from('deals').select('id, acquirer, target, metadata');
  if (error) throw new Error(error.message);
  deals = (deals || []).filter((d) => !(d.metadata && d.metadata.ingest_status === 'staging'));
  if (args.deal) deals = deals.filter((d) => (d.target || '').toLowerCase().includes(args.deal.toLowerCase()));
  if (!deals.length) { console.error('No matching deals'); process.exit(1); }

  const all = [];
  for (const deal of deals) {
    console.log(`\n═══ ${deal.acquirer} / ${deal.target} ═══`);
    try {
      all.push(await auditDeal(sb, client, deal));
    } catch (err) {
      console.log(`  AUDIT ERROR: ${err.message}`);
      all.push({ deal: deal.target, error: err.message });
    }
  }

  const flaggedExclusions = all.flatMap((d) => (d.excluded || []).filter((r) => r.verdict && r.verdict.classification === 'SUBSTANTIVE_DEAL_CONTENT').map((r) => ({ deal: d.deal, ...r })));
  const missedContent = all.flatMap((d) => (d.gaps || []).filter((g) => g.verdict && g.verdict.classification === 'SUBSTANTIVE_DEAL_CONTENT').map((g) => ({ deal: d.deal, ...g })));

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(__dirname, '..', 'reports', `coverage-audit-${ts}.json`);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify({ flaggedExclusions, missedContent, deals: all }, null, 2));

  console.log(`\n── summary ──`);
  console.log(`  deals audited: ${all.length}`);
  console.log(`  excluded regions flagged SUBSTANTIVE (metric bug): ${flaggedExclusions.length}`);
  for (const f of flaggedExclusions) console.log(`    ⚠ ${f.deal}: [${f.label}] ${f.length} chars — ${f.verdict.rationale}`);
  console.log(`  gaps confirmed as missed substantive content (re-extraction worklist): ${missedContent.length}`);
  for (const g of missedContent) console.log(`    ✗ ${g.deal}: ${g.length} chars @${g.start} — ${(g.verdict.substantive_kinds || []).join(',')} — ${g.verdict.rationale}`);
  console.log(`Report: ${reportPath}`);
  if (flaggedExclusions.length) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}

module.exports = { sampleRegion, classifyPrompt };
