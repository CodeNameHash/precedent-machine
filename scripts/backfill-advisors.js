#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────
   scripts/backfill-advisors.js — backfill deals.metadata.advisors_v2 from
   each deal's NOTICES provision (type MISC, code MISC-NOTICES).

   Extraction is DETERMINISTIC (lib/parser-v2/notice-advisors.js): party
   blocks are split at "if to <party> ... :", attributed to buyer/seller by
   matching against the deal's party names, and outside counsel is captured
   from the "with a copy to: <Firm> ... Attention: <lawyers>" sub-blocks.
   If the deterministic parse finds NO firm on either side (irregular notice
   text), an LLM fallback via the subscription CLI client is used (disable
   with --no-llm).

   Stored shape (RAW verbatim capture — canonicalization happens at READ
   time in lib/canonical-advisors.js, so improving the canon map needs no
   re-backfill):

     metadata.advisors_v2 = {
       buyer_firm, buyer_lawyers: [..], seller_firm, seller_lawyers: [..],
       buyer_firms: [..], seller_firms: [..],   // all firms per side
       raw: { source_provision_id, blocks: [...] } // verbatim capture
     }

   Usage:
     node scripts/backfill-advisors.js                # dry run, all deals
     node scripts/backfill-advisors.js --deal Landos  # dry run, one deal
     node scripts/backfill-advisors.js --apply        # write for real
     node scripts/backfill-advisors.js --no-llm       # deterministic only

   Flags:
     --dry-run     print before/after only, no writes (default: on)
     --apply       write UPDATEs to deals.metadata (turns dry-run off)
     --deal <sub>  only process deals whose acquirer/target contains <sub>
     --no-llm      skip the LLM fallback for irregular notice text

   Re-runnable: reads current DB state each run; only touches the
   metadata.advisors_v2 key (merge, not replace). Credentials from env /
   .env.local only.
   ───────────────────────────────────────────────────────────────────────── */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { buildAdvisorsV2 } = require('../lib/parser-v2/notice-advisors');
const { getDisplayAdvisors } = require('../lib/canonical-advisors');

function loadDotEnvLocal() {
  const p = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
}

function parseArgs(argv) {
  const args = { deal: null, apply: false, llm: true };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--deal') args.deal = argv[++i];
    else if (a === '--apply') args.apply = true;
    else if (a === '--dry-run') args.apply = false;
    else if (a === '--no-llm') args.llm = false;
    else { console.error(`Unknown arg: ${a}`); process.exit(1); }
  }
  return args;
}

// ── LLM fallback (only for notice text the deterministic parser can't read) ──
function buildLlmPrompt(deal, noticeText) {
  return `You are reading the NOTICES section of an M&A merger agreement. Each party's notice block names the party, its address, and "with a copy to" its OUTSIDE law firm (with "Attention:" lawyer names).

The deal:
  acquirer/buyer side: ${deal.acquirer || 'unknown'}
  target/seller side: ${deal.target || 'unknown'}

Extract the outside law firm and lawyer names for each side. Use null / [] when absent. Copy names VERBATIM from the text (do not normalize). Ignore in-house contacts (General Counsel, officers) — only outside law firms.

Return ONLY a JSON object:
{
  "buyer_firm": "string or null — the buyer/parent side's outside law firm as written",
  "buyer_lawyers": ["lawyer names under the buyer side firm's Attention line"],
  "seller_firm": "string or null — the target/company side's outside law firm as written",
  "seller_lawyers": ["lawyer names under the seller side firm's Attention line"]
}

Notices text:
"""
${noticeText.slice(0, 12000)}
"""

Return ONLY the JSON object, no prose, no markdown fence.`;
}

async function llmExtract(client, deal, noticeText, provisionId) {
  const resp = await client.messages.create({
    model: 'meta',
    max_tokens: 600,
    messages: [{ role: 'user', content: buildLlmPrompt(deal, noticeText) }],
  });
  const rawText = (resp.content && resp.content[0] && resp.content[0].text) || '{}';
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('LLM fallback did not return JSON');
  const parsed = JSON.parse(jsonMatch[0]);
  const arr = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()) : []);
  return {
    buyer_firm: parsed.buyer_firm || null,
    buyer_lawyers: arr(parsed.buyer_lawyers),
    seller_firm: parsed.seller_firm || null,
    seller_lawyers: arr(parsed.seller_lawyers),
    buyer_firms: parsed.buyer_firm ? [parsed.buyer_firm] : [],
    seller_firms: parsed.seller_firm ? [parsed.seller_firm] : [],
    raw: { source_provision_id: provisionId, method: 'llm', blocks: [] },
  };
}

function fmtSide(firms, lawyers) {
  const f = firms && firms.length ? firms.join(' + ') : '(none)';
  const l = lawyers && lawyers.length ? lawyers.join(', ') : '(none)';
  return `${f} — ${l}`;
}

(async () => {
  loadDotEnvLocal();
  const args = parseArgs(process.argv);
  const dbUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!dbUrl || !key) { console.error('Supabase creds required (env / .env.local).'); process.exit(1); }
  const sb = createClient(dbUrl, key);

  // Lazily created: only spawn the CLI client if a deal actually needs it.
  let llmClient = null;
  const getLlmClient = () => {
    if (!llmClient) {
      const { createClaudeCliClient } = require('../lib/llm-cli-client');
      llmClient = createClaudeCliClient({ model: 'sonnet' });
    }
    return llmClient;
  };

  console.log(`Mode: ${args.apply ? 'APPLY (writing)' : 'DRY RUN (no writes — pass --apply to write)'}`);
  if (args.deal) console.log(`Filter: deals matching "${args.deal}"`);
  console.log(`LLM fallback: ${args.llm ? 'on (deterministic first)' : 'off'}\n`);

  const { data: deals, error } = await sb
    .from('deals')
    .select('id, acquirer, target, metadata')
    .order('created_at', { ascending: true });
  if (error) { console.error(`Deal fetch failed: ${error.message}`); process.exit(1); }

  let processed = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const deal of deals || []) {
    const label = `${deal.acquirer || '?'} / ${deal.target || '?'}`;
    if (args.deal && !label.toLowerCase().includes(args.deal.toLowerCase())) continue;

    // Fetch this deal's notices provisions (type MISC, code MISC-NOTICES;
    // category fallback for rows ingested before canonical codes existed).
    const { data: provs, error: pErr } = await sb
      .from('provisions')
      .select('id, category, full_text, ai_metadata')
      .eq('deal_id', deal.id)
      .eq('type', 'MISC');
    if (pErr) {
      console.log(`— ${label}: FETCH FAILED (${pErr.message})`);
      failed += 1;
      continue;
    }
    const notices = (provs || []).filter((p) =>
      (p.ai_metadata && p.ai_metadata.code === 'MISC-NOTICES') || /^notices$/i.test(p.category || '')
    );
    if (notices.length === 0) {
      console.log(`— ${label}: SKIP (no MISC-NOTICES provision — deal may still be ingesting)`);
      skipped += 1;
      continue;
    }

    processed += 1;
    console.log(`→ ${label}`);

    let v2 = null;
    try {
      v2 = buildAdvisorsV2(notices, deal);
    } catch (err) {
      console.log(`  deterministic parse FAILED: ${err.message}`);
    }

    const gotNothing = !v2 || ((v2.buyer_firms || []).length === 0 && (v2.seller_firms || []).length === 0);
    if (gotNothing && args.llm) {
      const withBlocks = notices.find((p) => /if\s+to/i.test(p.full_text || '') && /cop(?:y|ies)/i.test(p.full_text || ''));
      if (withBlocks) {
        console.log('  deterministic parse found no firms — trying LLM fallback…');
        try {
          v2 = await llmExtract(getLlmClient(), deal, withBlocks.full_text, withBlocks.id);
        } catch (err) {
          console.log(`  LLM fallback FAILED: ${err.message}`);
        }
      }
    }
    if (!v2 || ((v2.buyer_firms || []).length === 0 && (v2.seller_firms || []).length === 0)) {
      console.log('  no advisors extracted — leaving metadata untouched.');
      failed += 1;
      continue;
    }

    const disp = getDisplayAdvisors({ advisors_v2: v2 });
    const meta = deal.metadata && typeof deal.metadata === 'object' ? deal.metadata : {};
    const before = meta.advisors_v2;
    console.log(`  before: ${before ? JSON.stringify({ buyer_firm: before.buyer_firm, seller_firm: before.seller_firm }) : '(none)'}`);
    console.log(`  raw    buyer:  ${fmtSide(v2.buyer_firms, v2.buyer_lawyers)}`);
    console.log(`  raw    seller: ${fmtSide(v2.seller_firms, v2.seller_lawyers)}`);
    console.log(`  canon  buyer:  ${fmtSide(disp.buyerFirms, disp.buyerLawyers)}`);
    console.log(`  canon  seller: ${fmtSide(disp.sellerFirms, disp.sellerLawyers)}`);

    if (!args.apply) {
      console.log('  (dry run — not written)');
      continue;
    }

    const mergedMeta = { ...meta, advisors_v2: v2 };
    const { error: updErr } = await sb.from('deals').update({ metadata: mergedMeta }).eq('id', deal.id);
    if (updErr) {
      console.log(`  UPDATE FAILED: ${updErr.message}`);
      failed += 1;
      continue;
    }
    console.log('  written.');
    updated += 1;
  }

  console.log(`\nDone. processed=${processed} updated=${updated} skipped=${skipped} failed=${failed}`);
})().catch((e) => { console.error(e.message); process.exit(1); });
