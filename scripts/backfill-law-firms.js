#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────
   scripts/backfill-law-firms.js — corpus backfill for
   metadata.law_firms = { target: [...], acquirer: [...] } (deals-index
   round, Ben 2026-07-19, item 1), following the scripts/backfill-deal-
   display.js pattern: dry-run by default, per-deal plan printed before any
   write, --apply to write, metadata-only MERGE (never a whole-metadata
   overwrite).

   Two sub-jobs, selected with --only:

     law-firms (default) — for every deal missing metadata.law_firms (or
       ALL deals if --force is passed), run ONLY the law-firm extraction
       against the deal's own stored full text (metadata.full_text, the
       raw agreement text ingest already keeps): first the SAME
       deterministic extraction lib/ingest/deal-metadata-prompt.js now runs
       at ingest time (extractLawFirms — Notices-section excerpt ->
       lib/parser-v2/notice-advisors.js's buildAdvisorsV2), then, if that
       finds nothing, one LLM fallback call via the subscription CLI
       (--backend claude, the default; --backend codex also supported) —
       SERIAL, one deal at a time, never fanned out, per Ben's DB-access
       rule.

     advisors — for the (as of 2026-07-18) ~8 deals with
       advisors_found=no (metadata.advisors_v2 missing), reruns the SAME
       notice-advisors extraction scripts/backfill-advisors.js uses, but
       sourced from the raw agreement text via the Notices excerpt (not
       requiring an already-classified MISC-NOTICES provision) — a broader
       net than scripts/backfill-advisors.js's provision-only source, which
       is presumably why these ~8 deals didn't get picked up by that
       script. Only touches metadata.advisors_v2 for deals that don't
       already have it — never overwrites an existing advisors_v2.

   Usage:
     node scripts/backfill-law-firms.js                    # dry run, law firms, all gaps
     node scripts/backfill-law-firms.js --deal Catalent     # dry run, one deal
     node scripts/backfill-law-firms.js --only advisors     # dry run, advisors-gap deals only
     node scripts/backfill-law-firms.js --apply             # write for real
     node scripts/backfill-law-firms.js --no-llm            # deterministic only, no CLI fallback
     node scripts/backfill-law-firms.js --force             # re-run law-firms even where already set

   Flags:
     --dry-run       print before/after only, no writes (default: on)
     --apply         write UPDATEs to deals.metadata (merge, not replace)
     --deal <sub>    only process deals whose acquirer/target contains <sub>
     --only <job>    law-firms | advisors | all (default: law-firms)
     --no-llm        skip the LLM CLI fallback for irregular notice text
     --backend <b>   claude (default, `claude -p`) | codex (`codex exec`)
     --force         (law-firms job only) re-extract even when
                      metadata.law_firms already has entries

   Credentials from env / .env.local only. Re-runnable: reads current DB
   state each run. If DB writes are blocked by the environment's permission
   layer, this script's caller is expected to fall back to --dry-run only
   and persist the proposed values to a JSON file instead of retrying the
   write.
   ───────────────────────────────────────────────────────────────────────── */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { extractLawFirms, buildNoticesExcerpt } = require('../lib/ingest/deal-metadata-prompt');
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
  const args = { deal: null, apply: false, llm: true, only: 'law-firms', backend: 'claude', force: false, model: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--deal') args.deal = argv[++i];
    else if (a === '--apply') args.apply = true;
    else if (a === '--dry-run') args.apply = false;
    else if (a === '--no-llm') args.llm = false;
    else if (a === '--only') args.only = argv[++i];
    else if (a === '--backend') args.backend = argv[++i];
    else if (a === '--model') args.model = argv[++i];
    else if (a === '--force') args.force = true;
    else { console.error(`Unknown arg: ${a}`); process.exit(1); }
  }
  if (!['law-firms', 'advisors', 'all'].includes(args.only)) {
    console.error(`--only must be law-firms | advisors | all (got "${args.only}")`);
    process.exit(1);
  }
  return args;
}

function hasLawFirms(meta) {
  const lf = meta && meta.law_firms;
  return !!(lf && ((Array.isArray(lf.target) && lf.target.length) || (Array.isArray(lf.acquirer) && lf.acquirer.length)));
}

function hasAdvisorsV2(meta) {
  const v2 = meta && meta.advisors_v2;
  return !!(v2 && ((Array.isArray(v2.buyer_firms) && v2.buyer_firms.length) || (Array.isArray(v2.seller_firms) && v2.seller_firms.length)));
}

// ── LLM fallback (subscription CLI, --backend claude by default) — used
// only when the deterministic Notices-excerpt parse finds nothing on either
// side. Same prompt shape as scripts/backfill-advisors.js's llmExtract, but
// scoped to firm names only (law_firms doesn't carry per-lawyer detail).
function buildLawFirmLlmPrompt(deal, noticeText) {
  return `You are reading the NOTICES section of an M&A merger agreement. Each party's notice block names the party, its address, and "with a copy to" its OUTSIDE law firm.

The deal:
  acquirer/buyer side: ${deal.acquirer || 'unknown'}
  target/seller side: ${deal.target || 'unknown'}

Extract the outside law firm name(s) for each side. Use [] when absent. Copy names VERBATIM from the text (do not normalize). Ignore in-house contacts — only outside law firms.

Return ONLY a JSON object:
{
  "acquirer_firms": ["outside law firm(s) for the buyer/parent side, as written"],
  "target_firms": ["outside law firm(s) for the target/company side, as written"]
}

Notices text:
"""
${noticeText.slice(0, 12000)}
"""

Return ONLY the JSON object, no prose, no markdown fence.`;
}

async function llmLawFirms(client, deal, noticeText) {
  const resp = await client.messages.create({
    model: 'meta',
    max_tokens: 400,
    messages: [{ role: 'user', content: buildLawFirmLlmPrompt(deal, noticeText) }],
  });
  const rawText = (resp.content && resp.content[0] && resp.content[0].text) || '{}';
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('LLM fallback did not return JSON');
  const parsed = JSON.parse(jsonMatch[0]);
  const arr = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()) : []);
  return { acquirer: arr(parsed.acquirer_firms), target: arr(parsed.target_firms) };
}

function fmtFirms(firms) {
  return firms && firms.length ? firms.join(' + ') : '(none)';
}

async function main(argv = process.argv) {
  loadDotEnvLocal();
  const args = parseArgs(argv);
  const dbUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!dbUrl || !key) {
    console.error('Supabase creds required (env / .env.local) — cannot connect. Nothing was read or written.');
    process.exit(1);
  }
  const sb = createClient(dbUrl, key);

  let llmClient = null;
  const getLlmClient = () => {
    if (!llmClient) {
      const { createClaudeCliClient, createCodexCliClient } = require('../lib/llm-cli-client');
      llmClient = args.backend === 'codex'
        ? createCodexCliClient({ model: args.model || undefined })
        : createClaudeCliClient({ model: args.model || 'sonnet' });
    }
    return llmClient;
  };

  console.log(`Mode: ${args.apply ? 'APPLY (writing)' : 'DRY RUN (no writes — pass --apply to write)'}`);
  console.log(`Job: ${args.only}`);
  if (args.deal) console.log(`Filter: deals matching "${args.deal}"`);
  console.log(`LLM fallback: ${args.llm ? `on (${args.backend}, deterministic first)` : 'off'}\n`);

  // Only the columns this script needs — metadata->>full_text is the raw
  // agreement text ingest stores (the same field lib/home-data.js's
  // DEAL_SELECT deliberately excludes from the index payload for size).
  const { data: deals, error } = await sb
    .from('deals')
    .select('id, acquirer, target, metadata, full_text:metadata->>full_text')
    .order('created_at', { ascending: true });
  if (error) { console.error(`Deal fetch failed: ${error.message}`); process.exit(1); }

  const results = [];
  let processed = 0;
  let willWrite = 0;
  let skipped = 0;
  let failed = 0;

  for (const deal of deals || []) {
    const label = `${deal.acquirer || '?'} / ${deal.target || '?'}`;
    if (args.deal && !label.toLowerCase().includes(args.deal.toLowerCase())) continue;

    const meta = deal.metadata && typeof deal.metadata === 'object' ? deal.metadata : {};
    const fullText = deal.full_text || '';

    const doLawFirms = args.only === 'law-firms' || args.only === 'all';
    const doAdvisors = args.only === 'advisors' || args.only === 'all';

    // ── law-firms job ──────────────────────────────────────────────────
    if (doLawFirms) {
      if (hasLawFirms(meta) && !args.force) {
        console.log(`— ${label}: SKIP law-firms (already set — pass --force to re-extract)`);
        skipped += 1;
      } else if (!fullText) {
        console.log(`— ${label}: SKIP law-firms (no metadata.full_text stored)`);
        skipped += 1;
      } else {
        processed += 1;
        console.log(`→ ${label} (law-firms)`);
        let proposed = extractLawFirms(fullText, { acquirer: deal.acquirer, target: deal.target, ...meta });
        let source = 'deterministic';
        const gotNothing = (proposed.acquirer || []).length === 0 && (proposed.target || []).length === 0;
        if (gotNothing && args.llm) {
          const excerpt = buildNoticesExcerpt(fullText);
          if (excerpt) {
            console.log('  deterministic parse found no firms — trying LLM fallback…');
            try {
              proposed = await llmLawFirms(getLlmClient(), deal, excerpt);
              source = `llm (${args.backend})`;
            } catch (err) {
              console.log(`  LLM fallback FAILED: ${err.message}`);
            }
          }
        }
        const found = (proposed.acquirer || []).length > 0 || (proposed.target || []).length > 0;
        console.log(`  before: ${JSON.stringify(meta.law_firms || null)}`);
        console.log(`  proposed (${source}): acquirer=${fmtFirms(proposed.acquirer)}  target=${fmtFirms(proposed.target)}`);
        results.push({ dealId: deal.id, label, job: 'law-firms', source, before: meta.law_firms || null, proposed, found });

        if (!found) {
          console.log('  no firms extracted — leaving metadata.law_firms untouched.');
          failed += 1;
        } else if (!args.apply) {
          console.log('  (dry run — not written)');
          willWrite += 1;
        } else {
          const mergedMeta = { ...meta, law_firms: proposed };
          const { error: updErr } = await sb.from('deals').update({ metadata: mergedMeta }).eq('id', deal.id);
          if (updErr) { console.log(`  UPDATE FAILED: ${updErr.message}`); failed += 1; }
          else { console.log('  written.'); willWrite += 1; meta.law_firms = proposed; }
        }
      }
    }

    // ── advisors job (item 2: the ~8 advisors_found=no deals) ──────────
    if (doAdvisors) {
      if (hasAdvisorsV2(meta)) {
        console.log(`— ${label}: SKIP advisors (metadata.advisors_v2 already set)`);
      } else if (!fullText) {
        console.log(`— ${label}: SKIP advisors (no metadata.full_text stored)`);
      } else {
        processed += 1;
        console.log(`→ ${label} (advisors)`);
        const excerpt = buildNoticesExcerpt(fullText);
        let v2 = null;
        if (excerpt) {
          try {
            v2 = buildAdvisorsV2([{ id: null, full_text: excerpt }], deal);
          } catch (err) {
            console.log(`  deterministic parse FAILED: ${err.message}`);
          }
        }
        const gotNothing = !v2 || ((v2.buyer_firms || []).length === 0 && (v2.seller_firms || []).length === 0);
        if (gotNothing && args.llm && excerpt) {
          console.log('  deterministic parse found no firms — trying LLM fallback…');
          try {
            const client = getLlmClient();
            const rawText = (await client.messages.create({
              model: 'meta',
              max_tokens: 600,
              messages: [{ role: 'user', content: buildLawFirmLlmPrompt(deal, excerpt) }],
            }).catch(() => null))?.content?.[0]?.text;
            if (rawText) {
              const jsonMatch = rawText.match(/\{[\s\S]*\}/);
              const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
              v2 = {
                buyer_firm: (parsed.acquirer_firms || [])[0] || null,
                buyer_lawyers: [],
                seller_firm: (parsed.target_firms || [])[0] || null,
                seller_lawyers: [],
                buyer_firms: parsed.acquirer_firms || [],
                seller_firms: parsed.target_firms || [],
                raw: { source_provision_id: null, method: 'llm-fulltext-fallback', blocks: [] },
              };
            }
          } catch (err) {
            console.log(`  LLM fallback FAILED: ${err.message}`);
          }
        }
        const found = v2 && ((v2.buyer_firms || []).length > 0 || (v2.seller_firms || []).length > 0);
        results.push({ dealId: deal.id, label, job: 'advisors', before: meta.advisors_v2 || null, proposed: v2, found: !!found });
        if (!found) {
          console.log('  no advisors extracted from full-text Notices excerpt — leaving metadata.advisors_v2 untouched.');
          failed += 1;
        } else {
          const disp = getDisplayAdvisors({ advisors_v2: v2 });
          console.log(`  canon  buyer:  ${fmtFirms(disp.buyerFirms)}`);
          console.log(`  canon  seller: ${fmtFirms(disp.sellerFirms)}`);
          if (!args.apply) {
            console.log('  (dry run — not written)');
            willWrite += 1;
          } else {
            const mergedMeta = { ...meta, advisors_v2: v2 };
            const { error: updErr } = await sb.from('deals').update({ metadata: mergedMeta }).eq('id', deal.id);
            if (updErr) { console.log(`  UPDATE FAILED: ${updErr.message}`); failed += 1; }
            else { console.log('  written.'); willWrite += 1; meta.advisors_v2 = v2; }
          }
        }
      }
    }
  }

  console.log(`\n${processed} candidate deal-job(s) processed, ${willWrite} ${args.apply ? 'written' : 'would write'}, ${skipped} already-set/skipped, ${failed} found-nothing.`);

  // Always dump the full proposed-values table as JSON for inspection /
  // fallback persistence (Ben's rule: if DB writes are blocked, save
  // proposed values to a JSON file and report rather than fighting the
  // block).
  const outPath = path.join(__dirname, '..', `.backfill-law-firms-${args.apply ? 'applied' : 'dry-run'}-${Date.now()}.json`);
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`Proposed/applied values written to ${outPath}`);
  return { results, processed, willWrite, skipped, failed };
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  parseArgs,
  hasLawFirms,
  hasAdvisorsV2,
  buildLawFirmLlmPrompt,
  llmLawFirms,
  fmtFirms,
  main,
};
