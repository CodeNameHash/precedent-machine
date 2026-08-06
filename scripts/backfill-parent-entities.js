#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────
   scripts/backfill-parent-entities.js — one-off backfill of parent-entity /
   display-name metadata on EXISTING deals.

   Ingest (scripts/ingest-local.js; the URL-ingest path's logic now lives in
   lib/broad-corpus/contained-routes/from-url.js -- pages/api/ingest/from-url.js
   itself is a contained 503 stub today, ingestion-by-URL is off in
   production, see docs/API-ROUTE-CLASSIFICATION.md) now asks the extractor
   for parent_entity / target_entity / acquirer_display / target_display
   alongside acquirer/target at ingest time. Deals ingested before that
   change don't have them — this script backfills those deals from their
   already-stored metadata.full_text, using the same subscription CLI client
   (zero API tokens) the local ingest runner uses.

   Usage:
     node scripts/backfill-parent-entities.js                 # dry run, all deals
     node scripts/backfill-parent-entities.js --deal Landos    # dry run, one deal
     node scripts/backfill-parent-entities.js --apply          # write for real
     node scripts/backfill-parent-entities.js --deal Landos --apply

   Flags:
     --dry-run     print before/after only, no writes (default: on)
     --apply       write UPDATEs to deals.metadata (turns dry-run off)
     --deal <sub>  only process deals whose acquirer/target contains <sub>
                   (case-insensitive substring match)

   Credentials from env / .env.local only.
   ───────────────────────────────────────────────────────────────────────── */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { createClaudeCliClient } = require('../lib/llm-cli-client');

function loadDotEnvLocal() {
  const p = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
}

function parseArgs(argv) {
  const args = { deal: null, apply: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--deal') args.deal = argv[++i];
    else if (a === '--apply') args.apply = true;
    else if (a === '--dry-run') args.apply = false;
    else { console.error(`Unknown arg: ${a}`); process.exit(1); }
  }
  return args;
}

// Same field-by-field prompt the ingest pipeline uses at extraction time —
// self-contained here since this script is called on already-stored deals,
// not a fresh preamble fetch.
function buildPrompt(acquirer, target, excerpt) {
  return `You are identifying the true parties to an M&A transaction from the text of a merger agreement.

The deal as filed shows:
  acquirer (as filed, may be a merger sub or shell): ${acquirer || 'unknown'}
  target (as filed): ${target || 'unknown'}

Return ONLY a JSON object with these fields. Use null for any field you cannot determine confidently.

{
  "parent_entity": "string or null — the ULTIMATE PARENT on whose behalf the acquisition is made. NEVER the merger sub and NEVER an intermediate holding shell: if the filed acquirer is a merger sub formed by a public parent for this transaction (e.g. 'Bespin Subsidiary, LLC' formed by 'AbbVie Inc.'), parent_entity is the parent ('AbbVie Inc.'), not the sub. If the filed acquirer already IS the ultimate parent (no separate parent named), repeat the filed acquirer's name here.",
  "target_entity": "string or null — the target's clean legal entity name (usually same as the filed target)",
  "acquirer_display": "string or null — short colloquial/market name for the acquirer's ultimate parent with no Inc./Corp./LLC/L.P./plc suffix, e.g. 'AbbVie', 'Pfizer', 'Red Hat'",
  "target_display": "string or null — short colloquial/market name for the target with no Inc./Corp./LLC/L.P./plc suffix, e.g. 'Metsera'"
}

Agreement text (excerpt):
"""
${excerpt}
"""

Return ONLY the JSON object, no prose, no markdown fence.`;
}

async function identifyParties(client, acquirer, target, excerpt) {
  const prompt = buildPrompt(acquirer, target, excerpt);
  const resp = await client.messages.create({ model: 'meta', max_tokens: 400, messages: [{ role: 'user', content: prompt }] });
  const raw = (resp.content && resp.content[0] && resp.content[0].text) || '{}';
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Backfill extraction did not return JSON');
  const parsed = JSON.parse(jsonMatch[0]);
  return {
    parent_entity: parsed.parent_entity || null,
    target_entity: parsed.target_entity || null,
    acquirer_display: parsed.acquirer_display || null,
    target_display: parsed.target_display || null,
  };
}

function fmt(v) {
  return v === null || v === undefined || v === '' ? '(none)' : v;
}

(async () => {
  loadDotEnvLocal();
  const args = parseArgs(process.argv);
  const dbUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!dbUrl || !key) { console.error('Supabase creds required (env / .env.local).'); process.exit(1); }
  const sb = createClient(dbUrl, key);
  const client = createClaudeCliClient({ model: 'sonnet' });

  console.log(`Mode: ${args.apply ? 'APPLY (writing)' : 'DRY RUN (no writes — pass --apply to write)'}`);
  if (args.deal) console.log(`Filter: deals matching "${args.deal}"`);
  console.log(`Backend: ${client.backend}\n`);

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

    const meta = deal.metadata && typeof deal.metadata === 'object' ? deal.metadata : {};
    const fullText = meta.full_text || '';
    if (!fullText) {
      console.log(`— ${label}: SKIP (no metadata.full_text stored)`);
      skipped += 1;
      continue;
    }

    processed += 1;
    console.log(`→ ${label}`);
    console.log(`  before: parent_entity=${fmt(meta.parent_entity)} target_entity=${fmt(meta.target_entity)} acquirer_display=${fmt(meta.acquirer_display)} target_display=${fmt(meta.target_display)}`);

    let result;
    try {
      const excerpt = fullText.slice(0, 8000);
      result = await identifyParties(client, deal.acquirer, deal.target, excerpt);
    } catch (err) {
      console.log(`  FAILED: ${err.message}`);
      failed += 1;
      continue;
    }

    console.log(`  after:  parent_entity=${fmt(result.parent_entity)} target_entity=${fmt(result.target_entity)} acquirer_display=${fmt(result.acquirer_display)} target_display=${fmt(result.target_display)}`);

    if (!args.apply) {
      console.log('  (dry run — not written)');
      continue;
    }

    const mergedMeta = {
      ...meta,
      parent_entity: result.parent_entity,
      target_entity: result.target_entity,
      acquirer_display: result.acquirer_display,
      target_display: result.target_display,
    };
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
  if (failed > 0) process.exitCode = 1;
})().catch((e) => { console.error(e.message); process.exit(1); });
