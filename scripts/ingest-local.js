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

   Checkpointing: each LLM-heavy stage (classify, extraction strategies,
   inline defs) writes its raw output to .ingest-checkpoints/<dealId>/ as it
   completes. If a run fails AFTER extraction (post-processing, invariants,
   store), rerun the same command with --resume to reload the completed
   stages instead of re-paying the LLM cost. Checkpoints are keyed to a hash
   of the agreement text and cleared automatically on success; reuse is
   opt-in because a checkpoint can't know whether the CODE changed under it.

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
const { createExtractionCheckpoint, inputHashFor } = require('../lib/parser-v2/extraction-checkpoint');
const { attachRegionIdsToSections, persistParserRegions } = require('../lib/parser-v2/region-store');
const { extractAdvisors } = require('../lib/parser-v2/advisors');
const { fromCp } = require('../lib/html-entities');
const { buildPartiesFact, buildValueUsdFact, mergeDealFacts } = require('../lib/deal-facts');
const { extractDealMetadata: sharedExtractDealMetadata } = require('../lib/ingest/deal-metadata-prompt');

function findDotEnvLocal(start = path.join(__dirname, '..')) {
  let dir = start;
  for (;;) {
    const candidate = path.join(dir, '.env.local');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function loadDotEnvLocal(envPath = findDotEnvLocal()) {
  if (!envPath || !fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
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
    // Invisible directional/zero-width marks appear as NAMED entities in some
    // EDGAR exhibits (Summit Materials salts 99 "&lrm;" through its headings
    // and cross-references). Left undecoded they poison section parsing,
    // coverage, and quote verification — drop the invisible ones, space the
    // space-like ones.
    .replace(/&(?:lrm|rlm|zwnj|zwj|ZeroWidthSpace|NegativeThinSpace);/g, '')
    .replace(/&(?:ensp|emsp|thinsp|hairsp|numsp|puncsp);/g, ' ')
    .replace(/&sect;/gi, '§')
    // Decode remaining numeric entities to their actual characters. SEC filings
    // encode the curly quotes that DELIMIT every defined term as &#8220;/&#8221;
    // (and singles as &#8216;/&#8217;); deleting them made inline/parenthetical
    // definitions unfindable. Decode hex and decimal forms instead of dropping.
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => fromCp(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => fromCp(parseInt(n, 10)))
    // The numeric decode above can EMIT invisible marks (&#8206; -> U+200E);
    // strip the raw characters too so neither form survives.
    .replace(/[\u200B-\u200F\u2060\uFEFF]/g, '')
    .replace(/\t+/g, ' ').replace(/ +/g, ' ').replace(/\n{3,}/g, '\n\n')
    .trim();
}

function metadataWithDealFacts(base, meta, sourceUrl, valueOverride = null) {
  const value = valueOverride !== null && valueOverride !== undefined ? valueOverride : meta && meta.value_usd;
  return mergeDealFacts(base || {}, {
    value_usd: buildValueUsdFact(value, {
      source_url: sourceUrl || null,
      source_label: 'Agreement preamble',
      method: valueOverride ? 'candidate_metadata' : 'ingest_metadata',
    }),
    parties: buildPartiesFact(meta || {}, {
      source_url: sourceUrl || null,
      source_label: 'Agreement preamble',
      method: 'ingest_metadata',
    }),
  });
}

// Best-effort sibling-exhibit fetch for the value-derivation ladder's tier
// (b): look in the same EDGAR filing index as the agreement exhibit for an
// EX-99.1-style press-release exhibit, extract the stated transaction value
// with a quote. Returns null (never throws) on any failure — deriveValue()
// falls through to 'no_stated_value' when this comes back empty.
async function fetchPressReleaseForDeal(client, sourceUrl) {
  if (!sourceUrl) return null;
  try {
    const idxUrl = sourceUrl.replace(/\/[^/]*$/, '/');
    const idxHtml = await fetchUrl(idxUrl);
    const hrefs = [...idxHtml.matchAll(/href="([^"]+)"/gi)].map((m) => m[1]);
    const exhibitHref = hrefs.find((h) => /ex-?99/i.test(h));
    if (!exhibitHref) return null;
    const exhibitUrl = new URL(exhibitHref, idxUrl).toString();
    const html = await fetchUrl(exhibitUrl);
    const text = stripHtml(html).slice(0, 6000);
    if (text.length < 200) return null;
    const prompt = `Extract the stated aggregate transaction value (in USD) from this press release, if any is stated. Return ONLY JSON: {"value_usd": number or null, "quote": "string or null — the exact sentence stating the value"}.\n\nPress release text:\n"""\n${text}\n"""\n\nReturn ONLY the JSON object, no prose, no markdown fence.`;
    const resp = await client.messages.create({ model: 'meta', max_tokens: 300, messages: [{ role: 'user', content: prompt }] });
    const raw = (resp.content && resp.content[0] && resp.content[0].text) || '{}';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    if (typeof parsed.value_usd === 'number' && parsed.value_usd > 0) {
      return { value_usd: parsed.value_usd, source_url: exhibitUrl, quote: parsed.quote || null };
    }
    return null;
  } catch {
    return null;
  }
}

async function extractDealMetadata(client, text, opts = {}) {
  return sharedExtractDealMetadata(client, text, {
    sourceUrl: opts.sourceUrl || null,
    fetchPressRelease: opts.skipPressReleaseFetch ? undefined : (meta) => fetchPressReleaseForDeal(client, opts.sourceUrl),
  });
}

// ── the parser pipeline (mirrors runParserPipeline in from-url.js) ─────────
async function runParserPipeline(client, fullText, dealId, title, sb, dealMeta = {}, pipelineOpts = {}) {
  const cleaned = cleanText(fullText);
  const { sections, articles, regions } = parseStructure(cleaned);
  if (sections.length === 0) throw new Error('Parser found no sections in the agreement text');

  // Stage checkpointing: the LLM-heavy stages (classify + the extraction
  // strategies) persist their raw output as they complete, so a failure in
  // deterministic post-processing or store doesn't force a full re-extract.
  // Reuse is opt-in via --resume; the checkpoint is cleared after a
  // successful store so stale stages can't leak into a later rerun.
  const checkpoint = pipelineOpts.checkpointDir
    ? createExtractionCheckpoint({
      dir: pipelineOpts.checkpointDir,
      key: dealId,
      inputHash: inputHashFor(cleaned),
      resume: Boolean(pipelineOpts.resume),
    })
    : null;

  let classifiedSections = checkpoint ? checkpoint.load('classify') : null;
  if (!classifiedSections) {
    classifiedSections = await classifySections(sections, articles, client);
    if (checkpoint) checkpoint.save('classify', classifiedSections);
  }
  const persistedRegions = await persistParserRegions(sb, dealId, cleaned, regions, sections);
  const sectionsForExtract = attachRegionIdsToSections(
    classifiedSections.map((s) => ({ ...s, provision_type: s.provisionType })),
    persistedRegions.rows,
  );
  const provisions = await extractProvisions(sectionsForExtract, client, cleaned, dealMeta, { checkpoint });
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
  if (checkpoint) checkpoint.clear();
  return { insertedCount: (storeResult && storeResult.insertedCount) || 0, advisors };
}

async function ingestOne(sb, client, url, existingDealId = null, pipelineOpts = {}) {
  const t0 = Date.now();
  const html = await fetchUrl(url);
  const fullText = stripHtml(html);
  if (fullText.length < 5000) throw new Error(`Fetched text too short (${fullText.length} chars) — wrong URL?`);
  const meta = await extractDealMetadata(client, fullText, { sourceUrl: url });
  if (!meta.acquirer || !meta.target) throw new Error('Could not identify acquirer/target from the preamble');

  // In-place re-ingest: reuse the existing deal row (URLs stay valid; manual
  // deal-level edits and metadata keys survive via the merge below +
  // storeProvisions' own metadata merge). storeProvisions deletes and
  // reinserts the deal's provisions.
  if (existingDealId) {
    const { data: existing, error: exErr } = await sb.from('deals').select('id, acquirer, target, metadata').eq('id', existingDealId).single();
    if (exErr || !existing) throw new Error(`--deal-id ${existingDealId} not found: ${exErr && exErr.message}`);
    const mergedMeta = metadataWithDealFacts({
      ...(existing.metadata || {}),
      source_url: url,
      merger_form: meta.merger_form,
      parent_entity: meta.parent_entity,
      target_entity: meta.target_entity,
      acquirer_display: meta.acquirer_display,
      target_display: meta.target_display,
      ...(meta.ultimateParent ? { ultimateParent: meta.ultimateParent } : {}),
      buyer_is_shell: meta.buyer_is_shell,
      buyer_profile: meta.buyer_profile,
      value_provenance: meta.value_provenance,
    }, meta, url);
    const updateRow = {
      metadata: mergedMeta,
      ...(meta.value_usd ? { value_usd: meta.value_usd } : {}),
    };
    await sb.from('deals').update(updateRow).eq('id', existingDealId);
    const title = `${existing.acquirer} / ${existing.target}`;
    const parseResult = await runParserPipeline(client, fullText, existingDealId, title, sb, { signingDate: meta.signing_date }, pipelineOpts);
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
    metadata: metadataWithDealFacts({
      source_url: url,
      full_text: fullText,
      merger_form: meta.merger_form,
      ingested_at: new Date().toISOString(),
      parent_entity: meta.parent_entity,
      target_entity: meta.target_entity,
      acquirer_display: meta.acquirer_display,
      target_display: meta.target_display,
      ...(meta.ultimateParent ? { ultimateParent: meta.ultimateParent } : {}),
      buyer_is_shell: meta.buyer_is_shell,
      buyer_profile: meta.buyer_profile,
      value_provenance: meta.value_provenance,
    }, meta, url),
  }).select().single();
  if (insErr) throw new Error(`Deal insert failed: ${insErr.message}`);

  const title = `${meta.acquirer} / ${meta.target}`;
  const parseResult = await runParserPipeline(client, fullText, newDeal.id, title, sb, { signingDate: meta.signing_date }, pipelineOpts);
  return { deal_id: newDeal.id, title, sector: meta.sector, inserted: parseResult.insertedCount, timing_ms: Date.now() - t0 };
}

function normalizeDealPartyName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\b(incorporated|inc|corp|corporation|llc|l\.l\.c|ltd|limited|plc|company|co)\b\.?/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function datesCompatible(a, b) {
  const left = String(a || '').slice(0, 10);
  const right = String(b || '').slice(0, 10);
  if (!left || !right) return true;
  return left === right;
}

async function findExistingCleanDealByParties(sb, meta) {
  const acquirerKey = normalizeDealPartyName(meta && meta.acquirer);
  const targetKey = normalizeDealPartyName(meta && meta.target);
  if (!acquirerKey || !targetKey) return null;

  let query = await sb
    .from('deals')
    .select('id,acquirer,target,announce_date,metadata')
    .eq('metadata->>ingest_status', 'clean')
    .limit(1000);
  if (query.error) {
    query = await sb
      .from('deals')
      .select('id,acquirer,target,announce_date,metadata')
      .limit(1000);
  }
  if (query.error) throw new Error(`Existing deal party check failed: ${query.error.message}`);

  const signingDate = meta && meta.signing_date;
  return (query.data || []).find((deal) => {
    const dealMeta = deal && deal.metadata && typeof deal.metadata === 'object' ? deal.metadata : {};
    if (dealMeta.ingest_status && dealMeta.ingest_status !== 'clean') return false;
    if (normalizeDealPartyName(deal.acquirer) !== acquirerKey) return false;
    if (normalizeDealPartyName(deal.target) !== targetKey) return false;
    return datesCompatible(signingDate, deal.announce_date);
  }) || null;
}

async function prepareDealForIngest(sb, client, url, options = {}) {
  const t0 = Date.now();
  const html = await fetchUrl(url);
  const fullText = stripHtml(html);
  if (fullText.length < 5000) throw new Error(`Fetched text too short (${fullText.length} chars) — wrong URL?`);
  const meta = await extractDealMetadata(client, fullText, { sourceUrl: url });
  if (!meta.acquirer || !meta.target) throw new Error('Could not identify acquirer/target from the preamble');

  const existingByParties = await findExistingCleanDealByParties(sb, meta);
  if (existingByParties) {
    return {
      skipped: true,
      reason: 'party-pair-already-in-corpus',
      deal_id: existingByParties.id,
      title: `${existingByParties.acquirer || meta.acquirer} / ${existingByParties.target || meta.target}`,
      sector: meta.sector,
      timing_ms: Date.now() - t0,
    };
  }

  const cleaned = cleanText(fullText);
  const { sections, articles, regions } = parseStructure(cleaned);
  if (sections.length === 0) throw new Error('Parser found no sections in the agreement text');
  const classifiedSections = await classifySections(sections, articles, client);
  let sectionsForExtract = classifiedSections.map((s) => ({ ...s, provision_type: s.provisionType }));
  let compactSections = toCompactSections(sectionsForExtract);
  const displayText = displayCleanText(fullText);
  let advisors = [];
  try { advisors = extractAdvisors(displayText) || []; } catch { /* best effort */ }

  const title = `${meta.acquirer} / ${meta.target}`;
  const candidateValue = options.seed_ingest && options.seed_ingest.candidate_deal_value_usd;
  const usedCandidateValue = !meta.value_usd && !!candidateValue;
  const valueUsd = meta.value_usd || candidateValue || null;
  const valueProvenance = usedCandidateValue
    ? { kind: 'seed_ingest_candidate', set_at: new Date().toISOString(), set_by: 'ingest_metadata', note: 'value_usd not stated in agreement; taken from seed_ingest candidate metadata' }
    : meta.value_provenance;
  const { data: newDeal, error: insErr } = await sb.from('deals').insert({
    acquirer: meta.acquirer,
    target: meta.target,
    value_usd: valueUsd,
    announce_date: meta.signing_date,
    sector: meta.sector,
    metadata: metadataWithDealFacts({
      source_url: url,
      full_text: displayText,
      merger_form: meta.merger_form,
      staged_at: new Date().toISOString(),
      ingest_status: 'staging',
      pipeline: 'parser-v2',
      agreement_title: title,
      char_count: displayText.length,
      parent_entity: meta.parent_entity,
      target_entity: meta.target_entity,
      acquirer_display: meta.acquirer_display,
      target_display: meta.target_display,
      ...(meta.ultimateParent ? { ultimateParent: meta.ultimateParent } : {}),
      buyer_is_shell: meta.buyer_is_shell,
      buyer_profile: meta.buyer_profile,
      value_provenance: valueProvenance,
      classified_sections: compactSections,
      classify_run_at: new Date().toISOString(),
      classify_breakdown: classifyBreakdown(compactSections),
      ...(advisors.length > 0 ? { advisors } : {}),
      ...(options.seed_ingest ? { seed_ingest: options.seed_ingest } : {}),
    }, meta, url, valueUsd),
  }).select().single();
  if (insErr) throw new Error(`Deal insert failed: ${insErr.message}`);

  const persistedRegions = await persistParserRegions(sb, newDeal.id, cleaned, regions, sections);
  sectionsForExtract = attachRegionIdsToSections(sectionsForExtract, persistedRegions.rows);
  compactSections = toCompactSections(sectionsForExtract);
  const { error: snapshotErr } = await sb.from('deals').update({
    metadata: {
      ...(newDeal.metadata || {}),
      classified_sections: compactSections,
      classify_breakdown: classifyBreakdown(compactSections),
    },
  }).eq('id', newDeal.id);
  if (snapshotErr) throw new Error(`Deal region snapshot update failed: ${snapshotErr.message}`);

  return {
    deal_id: newDeal.id,
    title,
    sector: meta.sector,
    section_count: compactSections.length,
    advisors,
    timing_ms: Date.now() - t0,
  };
}

function parseArgs(argv) {
  const args = {
    url: null,
    manifest: null,
    backend: 'claude',
    model: 'sonnet',
    dealId: null,
    resume: false,
    checkpointDir: path.join(__dirname, '..', '.ingest-checkpoints'),
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--url') args.url = argv[++i];
    else if (a === '--manifest') args.manifest = argv[++i];
    else if (a === '--backend') args.backend = argv[++i];
    else if (a === '--model') args.model = argv[++i];
    else if (a === '--deal-id') args.dealId = argv[++i];
    else if (a === '--resume') args.resume = true;
    else if (a === '--checkpoint-dir') args.checkpointDir = argv[++i];
    else { console.error(`Unknown arg: ${a}`); process.exit(1); }
  }
  if (!args.url && !args.manifest) { console.error('Provide --url <ex21-url> or --manifest <path.json>'); process.exit(1); }
  if (args.dealId && !args.url) { console.error('--deal-id requires --url'); process.exit(1); }
  return args;
}

async function main() {
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

  const manifestRows = args.manifest ? JSON.parse(fs.readFileSync(args.manifest, 'utf-8')) : null;
  const urls = manifestRows
    ? (Array.isArray(manifestRows) ? manifestRows : manifestRows.candidates || [])
      .map((d) => d.agreement_exhibit_url || d.url || d)
      .filter(Boolean)
    : [args.url];

  for (const url of urls) {
    process.stdout.write(`→ ingesting ${url.slice(-60)} … `);
    try {
      const r = await ingestOne(sb, client, url, args.dealId || null, { checkpointDir: args.checkpointDir, resume: args.resume });
      console.log(`done in ${Math.round(r.timing_ms / 1000)}s: ${r.title} [${r.sector}] +${r.inserted} provisions (deal ${r.deal_id})`);
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
      process.exitCode = 1;
    }
  }
}

module.exports = {
  SEC_UA,
  extractDealMetadata,
  fetchUrl,
  findExistingCleanDealByParties,
  findDotEnvLocal,
  ingestOne,
  loadDotEnvLocal,
  main,
  normalizeDealPartyName,
  parseArgs,
  prepareDealForIngest,
  runParserPipeline,
  stripHtml,
};

if (require.main === module) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
