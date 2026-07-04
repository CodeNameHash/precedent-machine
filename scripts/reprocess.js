#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────
   scripts/reprocess.js — partial re-processing: refresh one slice of the
   pipeline without a full ~30-minute re-ingest per deal.
   ───────────────────────────────────────────────────────────────────────────
   Three jobs, all from STORED text (no refetch, no re-parse when a
   classified-sections snapshot exists on deals.metadata):

     1. Re-extract one or more TYPES for one deal or the whole corpus
        (prompt tweak → minutes, not a full run). Uses the same
        runExtractTypePhase as extract-local/extract-type: per-type
        delete+reinsert, run record, human corrections re-applied.
     2. Re-classify only (--classify-only): deterministic rules re-run on
        every section; the AI is consulted ONLY for sections whose text has
        no entry in the prior snapshot (cache in lib/parser-v2/snapshot.js).
        Prints a per-section type-change diff BEFORE committing.
     3. Corpus-wide type refresh (--all --types TERMF --apply) with a
        per-deal stored-provision diff + QA count delta.

   Deals ingested before snapshots existed fall back to re-parsing the
   STORED full_text (structural parse is local + free; classify uses the
   cache/AI as above) — still no network fetch.

   DRY-RUN IS THE DEFAULT: prints the plan + section counts, makes zero
   writes and zero LLM calls. --apply does the work.

   Usage:
     node scripts/reprocess.js --deal Metsera --types TERMF              # plan
     node scripts/reprocess.js --deal Metsera --types TERMF,ANTI --apply
     node scripts/reprocess.js --all --types TERMF --apply               # corpus refresh
     node scripts/reprocess.js --deal Metsera --classify-only            # diff, no writes
     node scripts/reprocess.js --deal Metsera --classify-only --apply
     [--backend claude|codex] [--model sonnet|opus|…]

   LLM calls go through the injectable CLI client (lib/llm-cli-client.js) —
   Claude Max / ChatGPT subscription, zero API tokens. Credentials from
   env / .env.local, same as ingest-local.
   ───────────────────────────────────────────────────────────────────────── */

const fs = require('fs');
const path = require('path');
const { PROVISION_TYPES } = require('../lib/rubric');
const {
  toCompactSections,
  buildPriorLookup,
  classifyBreakdown,
  diffClassifications,
} = require('../lib/parser-v2/snapshot');

/* ── pure helpers (exported for tests — no DB, no LLM) ───────────────────── */

const VALID_TYPE_KEYS = new Set(PROVISION_TYPES.map((t) => t.key));

/**
 * Parse a --types value ("TERMF,ANTI" or repeated flags accumulated into an
 * array) into validated, deduped, uppercased type keys. Throws on unknowns.
 */
function parseTypesArg(value) {
  const raw = Array.isArray(value) ? value : [value];
  const types = [];
  for (const chunk of raw) {
    for (const piece of String(chunk || '').split(',')) {
      const t = piece.trim().toUpperCase();
      if (!t) continue;
      if (!VALID_TYPE_KEYS.has(t)) {
        throw new Error(
          `Unknown type "${t}". Valid: ${[...VALID_TYPE_KEYS].join(', ')}`,
        );
      }
      if (!types.includes(t)) types.push(t);
    }
  }
  return types;
}

// Same group expansion the store/extract layers use (kept in sync via tests).
function expandGroup(type) {
  const { expandTypeGroup } = require('../lib/parser-v2/extract');
  return expandTypeGroup(type);
}

/**
 * Per requested type, how many snapshot sections fall in its type group.
 * Returns { TYPE: count }.
 */
function snapshotSectionCounts(compactSections, types) {
  const counts = {};
  for (const t of types) {
    const group = new Set(expandGroup(t));
    counts[t] = (compactSections || []).filter((s) => s && group.has(s.type)).length;
  }
  return counts;
}

/**
 * Deterministic-only classification estimate for deals WITHOUT a snapshot:
 * runs article mapping + tryDeterministic (no AI, no writes) so the dry-run
 * plan can show approximate per-type section counts for free.
 * Returns { byType, unresolved, total }.
 */
function deterministicEstimate(sections, articles) {
  const {
    tryDeterministic,
    classifyArticle,
    normalizeArticleNumber,
  } = require('../lib/parser-v2/classify');

  const articleTypes = {};
  for (const art of articles || []) {
    const key = normalizeArticleNumber(art.number || art.articleNumber);
    const artType = classifyArticle(art.title || art.articleTitle || art.heading || '');
    if (key && artType) articleTypes[key] = artType;
  }

  const byType = {};
  let unresolved = 0;
  for (const s of sections || []) {
    const sectionNum = s.number || s.sectionNumber || '';
    let articleType = null;
    if (s.isAnnex || /^Annex-/i.test(sectionNum)) {
      articleType = classifyArticle(s.articleTitle || '');
    } else {
      articleType = articleTypes[sectionNum.split('.')[0]] || null;
    }
    const result = tryDeterministic(s, articleType);
    if (result && result.type) byType[result.type] = (byType[result.type] || 0) + 1;
    else unresolved += 1;
  }
  return { byType, unresolved, total: (sections || []).length };
}

/** Per requested type, counts out of a { TYPE: n } breakdown (group-aware). */
function countsForTypes(byType, types) {
  const counts = {};
  for (const t of types) {
    const group = new Set(expandGroup(t));
    counts[t] = Object.entries(byType || {})
      .filter(([k]) => group.has(k))
      .reduce((sum, [, n]) => sum + n, 0);
  }
  return counts;
}

/** Render a diffClassifications() result as terse terminal lines. */
function formatClassifyDiff(diff) {
  const lines = [];
  for (const c of diff.changed) {
    const code = c.fromCode !== c.toCode ? ` [code ${c.fromCode || '—'} → ${c.toCode || '—'}]` : '';
    lines.push(`~ §${c.sectionNumber || '?'} ${c.title || ''}: ${c.from} → ${c.to}${code}`);
  }
  for (const a of diff.added) lines.push(`+ §${a.sectionNumber || '?'} ${a.title || ''} → ${a.type}`);
  for (const r of diff.removed) lines.push(`- §${r.sectionNumber || '?'} ${r.title || ''} (was ${r.type})`);
  lines.push(`= ${diff.unchanged} unchanged`);
  return lines.join('\n');
}

/** Tally classifiedBy across a classified-sections array. */
function classifiedByTally(classified) {
  const tally = {};
  for (const s of classified || []) {
    const k = (s && (s.classifiedBy || s.classified_by)) || 'unknown';
    tally[k] = (tally[k] || 0) + 1;
  }
  return tally;
}

module.exports = {
  parseTypesArg,
  snapshotSectionCounts,
  deterministicEstimate,
  countsForTypes,
  formatClassifyDiff,
  classifiedByTally,
};

/* ── CLI / DB / LLM plumbing ─────────────────────────────────────────────── */

function loadDotEnvLocal() {
  const p = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
}

function usage() {
  console.error(
    'Usage: node scripts/reprocess.js (--deal <substring> | --all) ' +
    '(--types TERMF[,ANTI…] | --classify-only) [--apply | --dry-run] ' +
    '[--backend claude|codex] [--model …]',
  );
  process.exit(1);
}

function parseArgs(argv) {
  const args = {
    deal: null, all: false, typesRaw: [], classifyOnly: false,
    apply: false, dryRun: false, backend: 'claude', model: null,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--deal') args.deal = argv[++i];
    else if (a === '--all') args.all = true;
    else if (a === '--types' || a === '--type') args.typesRaw.push(argv[++i]);
    else if (a === '--classify-only') args.classifyOnly = true;
    else if (a === '--apply') args.apply = true;
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--backend') args.backend = argv[++i];
    else if (a === '--model') args.model = argv[++i];
    else { console.error(`Unknown arg: ${a}`); usage(); }
  }
  if (!args.deal && !args.all) usage();
  if (args.apply && args.dryRun) { console.error('--apply and --dry-run are mutually exclusive.'); process.exit(1); }
  if (!args.classifyOnly && args.typesRaw.length === 0) usage();
  try {
    args.types = args.classifyOnly ? [] : parseTypesArg(args.typesRaw);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  return args;
}

function makeLazyClient(args) {
  // LLM client constructed on FIRST use — pure dry-run planning and fully
  // cache-covered re-classifies never spawn a CLI process.
  let real = null;
  const get = () => {
    if (!real) {
      const { createClaudeCliClient, createCodexCliClient } = require('../lib/llm-cli-client');
      real = args.backend === 'codex'
        ? createCodexCliClient({ model: args.model || undefined })
        : createClaudeCliClient({ model: args.model || 'sonnet' });
      console.log(`  (LLM backend: ${real.backend}${args.model ? ` (${args.model})` : ''})`);
    }
    return real;
  };
  return {
    get backend() { return real ? real.backend : args.backend; },
    get model() { return real ? real.model : args.model; },
    messages: { create: (...a) => get().messages.create(...a) },
  };
}

async function fetchDeals(sb, args) {
  const { data, error } = await sb.from('deals').select('id, acquirer, target, metadata');
  if (error) throw new Error(`Deal fetch failed: ${error.message}`);
  const deals = (data || []).filter((d) => {
    if (args.all) return true;
    return `${d.acquirer || ''} ${d.target || ''}`.toLowerCase().includes(args.deal.toLowerCase());
  });
  if (deals.length === 0) {
    throw new Error(args.all ? 'No deals in the corpus.' : `No deal matches "${args.deal}".`);
  }
  return deals;
}

async function fetchTypeGroupProvisions(sb, dealId, type) {
  const { expandTypeGroup } = require('../lib/parser-v2/extract');
  const { data, error } = await sb
    .from('provisions')
    .select('type, category, full_text, ai_metadata')
    .eq('deal_id', dealId)
    .in('type', expandTypeGroup(type));
  if (error) throw new Error(`Provision fetch failed: ${error.message}`);
  return data || [];
}

async function fetchAllTypes(sb, dealId) {
  const out = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await sb
      .from('provisions').select('type').eq('deal_id', dealId)
      .range(offset, offset + 999);
    if (error) throw new Error(`Provision type fetch failed: ${error.message}`);
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
    offset += 1000;
  }
  return out;
}

/**
 * Parse + classify a deal's STORED full_text (no fetch), cache-assisted.
 * Returns { classified, compact, sections, articles }.
 */
async function classifyFromStoredText(deal, client, prior) {
  const { cleanText, parseStructure } = require('../lib/parser-v2/structural');
  const { classifySections } = require('../lib/parser-v2/classify');
  const fullText = deal.metadata && deal.metadata.full_text;
  if (!fullText) throw new Error('No stored full_text — full re-ingest required (scripts/ingest-local.js)');
  const cleaned = cleanText(fullText);
  const { sections, articles } = parseStructure(cleaned);
  if (sections.length === 0) throw new Error('Parser found no sections in stored full_text');
  const classified = await classifySections(sections, articles, client, { prior });
  return { classified, compact: toCompactSections(classified), sections, articles };
}

async function persistSnapshot(sb, deal, compact, { resetExtractStatus = false } = {}) {
  const meta = deal.metadata || {};
  const nextMetadata = {
    ...meta,
    classified_sections: compact,
    classify_run_at: new Date().toISOString(),
    classify_breakdown: classifyBreakdown(compact),
    ...(resetExtractStatus ? { extract_status: {} } : {}),
  };
  const { error } = await sb.from('deals').update({ metadata: nextMetadata }).eq('id', deal.id);
  if (error) throw new Error(`Failed to persist classified sections: ${error.message}`);
  deal.metadata = nextMetadata;
}

/* ── per-deal drivers ────────────────────────────────────────────────────── */

async function reclassifyDeal(sb, deal, client, apply) {
  const meta = deal.metadata || {};
  const before = Array.isArray(meta.classified_sections) ? meta.classified_sections : [];
  const prior = buildPriorLookup(before);
  if (before.length === 0) {
    console.log('  no prior snapshot — every non-deterministic section will need the AI');
  }

  const { compact } = await classifyFromStoredText(deal, client, prior);
  const tally = classifiedByTally(compact);
  console.log(`  classified ${compact.length} sections (${Object.entries(tally).map(([k, n]) => `${k}: ${n}`).join(', ')})`);

  if (before.length > 0) {
    const diff = diffClassifications(before, compact);
    console.log('  ── classification diff (stored → new) ──');
    console.log(formatClassifyDiff(diff).split('\n').map((l) => '  ' + l).join('\n'));
  } else {
    const byType = classifyBreakdown(compact);
    console.log('  no baseline to diff; new breakdown: ' +
      Object.entries(byType).sort((x, y) => y[1] - x[1]).map(([t, n]) => `${t}:${n}`).join(' '));
  }

  if (!apply) {
    console.log('  dry-run: no writes. Re-run with --apply to commit.');
    return true;
  }
  // New classification invalidates per-type extract status (same semantics
  // as POST /api/ingest/classify).
  await persistSnapshot(sb, deal, compact, { resetExtractStatus: true });
  console.log('  committed: classified_sections updated, extract_status reset.');
  return true;
}

async function planExtractDeal(deal, types) {
  const meta = deal.metadata || {};
  const snapshot = Array.isArray(meta.classified_sections) && meta.classified_sections.length > 0
    ? meta.classified_sections : null;

  if (snapshot) {
    const counts = snapshotSectionCounts(snapshot, types);
    console.log(`  snapshot: ${snapshot.length} sections (classified ${meta.classify_run_at || 'unknown'})`);
    for (const t of types) {
      console.log(`  plan: re-extract ${t} from ${counts[t]} cached section(s) — no parse, no classify`);
    }
    return true;
  }

  if (!meta.full_text) {
    console.log('  SKIP: no snapshot and no stored full_text — full re-ingest required');
    return false;
  }

  const { cleanText, parseStructure } = require('../lib/parser-v2/structural');
  const { sections, articles } = parseStructure(cleanText(meta.full_text));
  const est = deterministicEstimate(sections, articles);
  const counts = countsForTypes(est.byType, types);
  console.log(`  no snapshot — will re-parse stored full_text (${sections.length} sections; ` +
    `deterministic estimate, ${est.unresolved} unresolved section(s) would go to cache/AI at apply time)`);
  for (const t of types) {
    console.log(`  plan: classify once (persisting snapshot), then re-extract ${t} (~${counts[t]}+ section(s))`);
  }
  return true;
}

async function extractDeal(sb, deal, types, client) {
  const { runExtractTypePhase, markExtractFailed } = require('../lib/parser-v2/run-extract');
  const { diffSnapshots, formatDiff, snapshotStoredProvision } = require('../lib/run-history');
  const { computeCounts } = require('./ingest-qa');

  const meta = deal.metadata || {};
  let snapshot = Array.isArray(meta.classified_sections) && meta.classified_sections.length > 0
    ? meta.classified_sections : null;

  // Fallback for pre-snapshot deals: one classify pass from STORED text,
  // persisted so every future reprocess skips it.
  if (!snapshot) {
    console.log('  no snapshot — classifying from stored full_text (one-time; will be cached)…');
    const { compact } = await classifyFromStoredText(deal, client, null);
    await persistSnapshot(sb, deal, compact);
    snapshot = compact;
    console.log(`  snapshot persisted: ${compact.length} sections`);
  }

  const countsBefore = computeCounts(await fetchAllTypes(sb, deal.id));
  let ok = true;

  for (const type of types) {
    const t0 = Date.now();
    process.stdout.write(`  → ${type} … `);
    try {
      const before = await fetchTypeGroupProvisions(sb, deal.id, type);
      const r = await runExtractTypePhase({ dealId: deal.id, type, sb, client });
      const after = await fetchTypeGroupProvisions(sb, deal.id, type);
      console.log(
        `done in ${Math.round(r.timing_ms / 1000)}s: +${r.provisions_inserted} / -${r.provisions_deleted}` +
        `, corrections re-applied: ${r.corrections_reapplied}` +
        (r.corrections_unmatched ? ` (${r.corrections_unmatched} unmatched)` : '') +
        (r.errors && r.errors.length ? ` [${r.errors.length} error(s)]` : ''),
      );
      const diff = diffSnapshots(before.map(snapshotStoredProvision), after.map(snapshotStoredProvision));
      console.log(formatDiff(diff).split('\n').map((l) => '    ' + l).join('\n'));
    } catch (err) {
      console.log(`FAILED after ${Math.round((Date.now() - t0) / 1000)}s: ${err.message}`);
      await markExtractFailed(sb, deal.id, type, err.message);
      ok = false;
    }
  }

  // QA delta — reuses scripts/ingest-qa.js counting so the numbers line up
  // with the post-ingest gate.
  const countsAfter = computeCounts(await fetchAllTypes(sb, deal.id));
  const deltas = Object.keys(countsAfter)
    .filter((k) => countsAfter[k] !== countsBefore[k])
    .map((k) => `${k} ${countsBefore[k]} → ${countsAfter[k]}`);
  console.log(`  QA counts: ${deltas.length ? deltas.join(', ') : 'unchanged'}`);
  return ok;
}

/* ── main ────────────────────────────────────────────────────────────────── */

async function main() {
  loadDotEnvLocal();
  const args = parseArgs(process.argv);
  const apply = args.apply;

  const { createClient } = require('@supabase/supabase-js');
  const dbUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!dbUrl || !key) { console.error('Supabase creds required (env / .env.local).'); process.exit(1); }
  const sb = createClient(dbUrl, key);

  const deals = await fetchDeals(sb, args);
  const mode = args.classifyOnly ? 'classify-only' : `types: ${args.types.join(', ')}`;
  console.log(`Reprocess (${mode}) — ${deals.length} deal(s), ${apply ? 'APPLY' : 'dry-run'}`);

  const client = makeLazyClient(args);
  let allOk = true;

  for (const deal of deals) {
    console.log(`\n═══ ${deal.acquirer || '?'} / ${deal.target || '?'} (${deal.id}) ═══`);
    try {
      let ok;
      if (args.classifyOnly) {
        ok = await reclassifyDeal(sb, deal, client, apply);
      } else if (!apply) {
        ok = await planExtractDeal(deal, args.types);
      } else {
        ok = await extractDeal(sb, deal, args.types, client);
      }
      if (!ok) allOk = false;
    } catch (err) {
      console.log(`  ERROR: ${err.message}`);
      allOk = false;
    }
  }

  if (!apply && !args.classifyOnly) {
    console.log('\nDry-run complete: no writes, no LLM calls. Re-run with --apply to execute.');
  }
  if (!allOk) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
