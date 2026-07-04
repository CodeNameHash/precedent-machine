#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────
   scripts/ingest-local.js — full new-deal ingest on a subscription CLI
   backend (zero API tokens): fetch EDGAR EX-2.1 → strip → deal metadata →
   create deal → parse → classify → extract → validate → store.

   Mirrors the pages/api/ingest/from-url.js pipeline but runs locally through
   `claude -p` / `codex exec` (lib/llm-cli-client.js) instead of the metered
   Anthropic API, and with no 300s serverless budget. Reuses the exact same
   CJS parser-v2 libs the API route uses, so extraction output is identical.

   Usage:
     node scripts/ingest-local.js --url <EX-2.1 url> [--backend claude|codex] [--model sonnet]
     node scripts/ingest-local.js --manifest <path.json> [--backend claude]   # batch

   Credentials from env / .env.local only.
   ───────────────────────────────────────────────────────────────────────── */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { createClient } = require('@supabase/supabase-js');
const { createClaudeCliClient, createCodexCliClient } = require('../lib/llm-cli-client');
const { parseStructure, cleanText, displayCleanText } = require('../lib/parser-v2/structural');
const { classifySections } = require('../lib/parser-v2/classify');
const { extractProvisions } = require('../lib/parser-v2/extract');
const { validateProvisions } = require('../lib/parser-v2/validate');
const { storeProvisions } = require('../lib/parser-v2/store');
const { toCompactSections, classifyBreakdown } = require('../lib/parser-v2/snapshot');
const { extractAdvisors } = require('../lib/parser-v2/advisors');
const { MERGER_FORMS } = require('../lib/taxonomy');
const { fromCp } = require('../lib/html-entities');

function loadDotEnvLocal() {
  const p = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
}

const SEC_UA = process.env.SEC_USER_AGENT || 'Corpus bengoodchild@gmail.com';

// ── helpers copied verbatim from pages/api/ingest/from-url.js ──────────────
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      headers: {
        'User-Agent': SEC_UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'identity',
      },
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const next = new URL(res.headers.location, url).toString();
        return fetchUrl(next).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
      }
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(45000, () => { req.destroy(); reject(new Error('Fetch timeout')); });
  });
}

function stripHtml(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/td>/gi, '\t')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/&rsquo;/gi, "'").replace(/&lsquo;/gi, "'")
    .replace(/&ldquo;/gi, '"').replace(/&rdquo;/gi, '"').replace(/&mdash;/gi, '—').replace(/&ndash;/gi, '–')
    // Decode remaining numeric entities to their actual characters. SEC filings
    // encode the curly quotes that DELIMIT every defined term as &#8220;/&#8221;
    // (and singles as &#8216;/&#8217;); deleting them made inline/parenthetical
    // definitions unfindable. Decode hex and decimal forms instead of dropping.
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => fromCp(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => fromCp(parseInt(n, 10)))
    .replace(/\t+/g, ' ').replace(/ +/g, ' ').replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function extractDealMetadata(client, text) {
  const preamble = text.substring(0, 10000);
  const mergerFormCodes = Object.keys(MERGER_FORMS);
  const prompt = `You are extracting structured metadata from the preamble of a merger or acquisition agreement.

Return ONLY a JSON object with these fields. Use null for any field you cannot determine confidently.

{
  "acquirer": "string — the buyer / parent entity legal name",
  "target": "string — the target / company legal name",
  "signing_date": "YYYY-MM-DD — the agreement signing/execution date",
  "value_usd": number or null,
  "sector": "string — single short label like 'Biopharma', 'Technology', 'Financial Services'",
  "merger_form": "one of: ${mergerFormCodes.join(', ')} — pick the best match",
  "parent_entity": "string or null — the ULTIMATE PARENT on whose behalf the acquisition is made. NEVER the merger sub and NEVER an intermediate holding shell: if the signatory is a merger sub formed by a public parent for this transaction (e.g. 'Bespin Subsidiary, LLC' formed by 'AbbVie Inc.'), parent_entity is the parent ('AbbVie Inc.'), not the sub. If the filed acquirer already IS the ultimate parent (no separate parent named), repeat the acquirer's name here.",
  "target_entity": "string or null — the target's clean legal entity name (usually same as target)",
  "acquirer_display": "string or null — short colloquial/market name for the acquirer's ultimate parent with no Inc./Corp./LLC/L.P./plc suffix, e.g. 'AbbVie', 'Pfizer', 'Red Hat'",
  "target_display": "string or null — short colloquial/market name for the target with no Inc./Corp./LLC/L.P./plc suffix, e.g. 'Metsera'"
}

Agreement text (preamble):
"""
${preamble}
"""

Return ONLY the JSON object, no prose, no markdown fence.`;
  const resp = await client.messages.create({ model: 'meta', max_tokens: 600, messages: [{ role: 'user', content: prompt }] });
  const raw = (resp.content && resp.content[0] && resp.content[0].text) || '{}';
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Metadata extraction did not return JSON');
  const parsed = JSON.parse(jsonMatch[0]);
  return {
    acquirer: parsed.acquirer || null,
    target: parsed.target || null,
    signing_date: parsed.signing_date || null,
    value_usd: typeof parsed.value_usd === 'number' ? parsed.value_usd : null,
    sector: parsed.sector || null,
    merger_form: parsed.merger_form || null,
    parent_entity: parsed.parent_entity || null,
    target_entity: parsed.target_entity || null,
    acquirer_display: parsed.acquirer_display || null,
    target_display: parsed.target_display || null,
  };
}

// ── the parser pipeline (mirrors runParserPipeline in from-url.js) ─────────
async function runParserPipeline(client, fullText, dealId, title, sb, dealMeta = {}) {
  const cleaned = cleanText(fullText);
  const { sections, articles } = parseStructure(cleaned);
  if (sections.length === 0) throw new Error('Parser found no sections in the agreement text');
  const classifiedSections = await classifySections(sections, articles, client);
  const sectionsForExtract = classifiedSections.map((s) => ({ ...s, provision_type: s.provisionType }));
  const provisions = await extractProvisions(sectionsForExtract, client, cleaned, dealMeta);
  const validation = validateProvisions(provisions, cleaned, sectionsForExtract);
  const finalProvisions = validation.provisions;
  const displayText = displayCleanText(fullText);
  let advisors = [];
  try { advisors = extractAdvisors(displayText) || []; } catch { /* best effort */ }
  // Persist the classified-sections snapshot so scripts/reprocess.js (and the
  // per-type extract API) can re-extract single types later without
  // re-parsing/re-classifying the whole agreement.
  const compactSections = toCompactSections(sectionsForExtract);
  const storeResult = await storeProvisions(dealId, finalProvisions, displayText, title, sb, {
    advisors,
    classified_sections: compactSections,
    classify_breakdown: classifyBreakdown(compactSections),
  });
  return { insertedCount: (storeResult && storeResult.insertedCount) || 0, advisors };
}

async function ingestOne(sb, client, url, existingDealId = null) {
  const t0 = Date.now();
  const html = await fetchUrl(url);
  const fullText = stripHtml(html);
  if (fullText.length < 5000) throw new Error(`Fetched text too short (${fullText.length} chars) — wrong URL?`);
  const meta = await extractDealMetadata(client, fullText);
  if (!meta.acquirer || !meta.target) throw new Error('Could not identify acquirer/target from the preamble');

  // In-place re-ingest: reuse the existing deal row (URLs stay valid; manual
  // deal-level edits and metadata keys survive via the merge below +
  // storeProvisions' own metadata merge). storeProvisions deletes and
  // reinserts the deal's provisions.
  if (existingDealId) {
    const { data: existing, error: exErr } = await sb.from('deals').select('id, acquirer, target, metadata').eq('id', existingDealId).single();
    if (exErr || !existing) throw new Error(`--deal-id ${existingDealId} not found: ${exErr && exErr.message}`);
    const mergedMeta = {
      ...(existing.metadata || {}),
      source_url: url,
      merger_form: meta.merger_form,
      parent_entity: meta.parent_entity,
      target_entity: meta.target_entity,
      acquirer_display: meta.acquirer_display,
      target_display: meta.target_display,
    };
    await sb.from('deals').update({ metadata: mergedMeta }).eq('id', existingDealId);
    const title = `${existing.acquirer} / ${existing.target}`;
    const parseResult = await runParserPipeline(client, fullText, existingDealId, title, sb, { signingDate: meta.signing_date });
    // Stamp reingested_at only AFTER storeProvisions succeeded. Stamping it
    // up front (old behaviour) made an aborted re-ingest indistinguishable
    // from a successful one: the deal carried a fresh reingested_at while the
    // provisions table still held the previous run's rows (Kraft, 2026-07-03
    // — stale pre-#59 collapse rows read as a fresh parse failure). Re-read
    // metadata first because storeProvisions rewrites it during the run.
    const { data: post } = await sb.from('deals').select('metadata').eq('id', existingDealId).single();
    await sb.from('deals').update({ metadata: { ...((post && post.metadata) || {}), reingested_at: new Date().toISOString() } }).eq('id', existingDealId);
    return { deal_id: existingDealId, title, sector: meta.sector, inserted: parseResult.insertedCount, timing_ms: Date.now() - t0, inPlace: true };
  }

  const { data: newDeal, error: insErr } = await sb.from('deals').insert({
    acquirer: meta.acquirer,
    target: meta.target,
    value_usd: meta.value_usd,
    announce_date: meta.signing_date,
    sector: meta.sector,
    metadata: {
      source_url: url,
      full_text: fullText,
      merger_form: meta.merger_form,
      ingested_at: new Date().toISOString(),
      parent_entity: meta.parent_entity,
      target_entity: meta.target_entity,
      acquirer_display: meta.acquirer_display,
      target_display: meta.target_display,
    },
  }).select().single();
  if (insErr) throw new Error(`Deal insert failed: ${insErr.message}`);

  const title = `${meta.acquirer} / ${meta.target}`;
  const parseResult = await runParserPipeline(client, fullText, newDeal.id, title, sb, { signingDate: meta.signing_date });
  return { deal_id: newDeal.id, title, sector: meta.sector, inserted: parseResult.insertedCount, timing_ms: Date.now() - t0 };
}

function parseArgs(argv) {
  const args = { url: null, manifest: null, backend: 'claude', model: 'sonnet', dealId: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--url') args.url = argv[++i];
    else if (a === '--manifest') args.manifest = argv[++i];
    else if (a === '--backend') args.backend = argv[++i];
    else if (a === '--model') args.model = argv[++i];
    else if (a === '--deal-id') args.dealId = argv[++i];
    else { console.error(`Unknown arg: ${a}`); process.exit(1); }
  }
  if (!args.url && !args.manifest) { console.error('Provide --url <ex21-url> or --manifest <path.json>'); process.exit(1); }
  if (args.dealId && !args.url) { console.error('--deal-id requires --url'); process.exit(1); }
  return args;
}

(async () => {
  loadDotEnvLocal();
  const args = parseArgs(process.argv);
  const dbUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!dbUrl || !key) { console.error('Supabase creds required (env / .env.local).'); process.exit(1); }
  const sb = createClient(dbUrl, key);
  const client = args.backend === 'codex'
    ? createCodexCliClient({ model: args.model !== 'sonnet' ? args.model : undefined })
    : createClaudeCliClient({ model: args.model });
  console.log(`Backend: ${client.backend}${args.model ? ` (${args.model})` : ''}`);

  const urls = args.manifest
    ? JSON.parse(fs.readFileSync(args.manifest, 'utf-8')).map((d) => d.url || d).filter(Boolean)
    : [args.url];

  for (const url of urls) {
    process.stdout.write(`→ ingesting ${url.slice(-60)} … `);
    try {
      const r = await ingestOne(sb, client, url, args.dealId || null);
      console.log(`done in ${Math.round(r.timing_ms / 1000)}s: ${r.title} [${r.sector}] +${r.inserted} provisions (deal ${r.deal_id})`);
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
      process.exitCode = 1;
    }
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
