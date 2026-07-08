#!/usr/bin/env node
/*
  WP-M2-00 corpus card backfill.

  Dry-run by default. With --apply, persists parser regions as needed and
  replaces each deal's provision_cards rows using lib/parser-v2/store-cards.js.
*/

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { buildProvisionCardRows } = require('../../lib/parser-v2/store-cards');
const { cleanText, parseStructure } = require('../../lib/parser-v2/structural');
const { persistParserRegions, rowsForParserRegions, normalizeText: normalizeRegionText } = require('../../lib/parser-v2/region-store');
const { spanHash } = require('../../lib/schema/provision-card');
const { normalizeForMatch } = require('../../lib/verification');

const DEFAULT_REPORT = 'docs/reprocess/round-m2-00-backfill.md';
const DEFAULT_MIN_CARDS = 40;
const UPSERT_BATCH_SIZE = 50;
const UPSERT_RETRIES = 3;

function loadDotEnvFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return false;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !(match[1] in process.env)) process.env[match[1]] = match[2].replace(/^"|"$/g, '');
  }
  return true;
}

function loadDotEnvLocal(envFile) {
  if (envFile) return loadDotEnvFile(path.resolve(envFile));
  return loadDotEnvFile(path.join(process.cwd(), '.env.local'));
}

function parseArgs(argv) {
  const args = {
    all: false,
    apply: false,
    deal: null,
    envFile: null,
    minCards: DEFAULT_MIN_CARDS,
    out: DEFAULT_REPORT,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--all') args.all = true;
    else if (arg === '--apply') args.apply = true;
    else if (arg === '--deal') args.deal = argv[++i];
    else if (arg === '--env-file') args.envFile = argv[++i];
    else if (arg === '--min-cards') args.minCards = Number(argv[++i]);
    else if (arg === '--out') args.out = argv[++i];
    else throw new Error(`Unknown arg: ${arg}`);
  }
  if (!args.all && !args.deal) throw new Error('Usage: node scripts/backfill/extract-to-cards.js (--all | --deal <substring-or-id>) [--apply] [--env-file <path>] [--out <path>]');
  if (!Number.isInteger(args.minCards) || args.minCards < 1) throw new Error('--min-cards must be a positive integer');
  return args;
}

function metaObject(value) {
  if (!value) return {};
  if (typeof value === 'string') {
    try { return JSON.parse(value) || {}; } catch { return {}; }
  }
  return typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function featureBag(row) {
  const meta = metaObject(row.ai_metadata);
  return metaObject(meta.features);
}

function rowCode(row) {
  const meta = metaObject(row.ai_metadata);
  return meta.code || row.code || null;
}

function displayDeal(deal) {
  return `${deal.acquirer || '?'} / ${deal.target || '?'}`;
}

async function fetchDeals(sb, args) {
  const { data, error } = await sb
    .from('deals')
    .select('id,acquirer,target,metadata')
    .order('target', { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []).filter((deal) => {
    if (args.all) return true;
    const needle = String(args.deal || '').toLowerCase();
    return deal.id === args.deal || displayDeal(deal).toLowerCase().includes(needle);
  });
}

async function fetchProvisionRows(sb, dealId) {
  const { data, error } = await sb
    .from('provisions')
    .select('*')
    .eq('deal_id', dealId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return data || [];
}

async function existingCardCount(sb, dealId) {
  const { count, error } = await sb
    .from('provision_cards')
    .select('id', { count: 'exact', head: true })
    .eq('deal_id', dealId);
  if (error) throw new Error(error.message);
  return count || 0;
}

async function replaceProvisionCardRows(sb, dealId, rows, batchSize = UPSERT_BATCH_SIZE) {
  const { error: deleteError } = await sb.from('provision_cards').delete().eq('deal_id', dealId);
  if (deleteError) throw new Error(`Failed to delete existing provision_cards: ${deleteError.message}`);
  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = rows.slice(index, index + batchSize);
    let lastError = null;
    for (let attempt = 1; attempt <= UPSERT_RETRIES; attempt += 1) {
      try {
        const { error } = await sb
          .from('provision_cards')
          .upsert(batch, { onConflict: 'provision_instance_id' });
        if (!error) {
          lastError = null;
          break;
        }
        lastError = error;
      } catch (error) {
        lastError = error;
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
    if (lastError) throw new Error(`Failed to upsert provision_cards batch ${index / batchSize + 1}: ${lastError.message || String(lastError)}`);
  }
  return rows.length;
}

function dedupeProvisionCardRows(rows) {
  const seenProvisionIds = new Set();
  const seenRegionHashes = new Set();
  const seenSectionTypes = new Set();
  const deduped = [];
  let removed = 0;
  for (const row of rows || []) {
    const sectionTypeKey = `${row.deal_id}:${row.section_ref}:${row.provision_type}`;
    if (
      seenProvisionIds.has(row.provision_instance_id) ||
      seenRegionHashes.has(`${row.deal_id}:${row.region_hash}`) ||
      seenSectionTypes.has(sectionTypeKey)
    ) {
      removed += 1;
      continue;
    }
    seenProvisionIds.add(row.provision_instance_id);
    seenRegionHashes.add(`${row.deal_id}:${row.region_hash}`);
    seenSectionTypes.add(sectionTypeKey);
    deduped.push(row);
  }
  return { rows: deduped, removed };
}

function sectionPathForRow(row, region) {
  const features = featureBag(row);
  const sectionRef = features.sectionNumber || features.sectionRef || region?.section_ref || row.type || 'Unspecified';
  const title = row.category || rowCode(row) || region?.title || row.type || 'Untitled';
  const textHash = spanHash(row.full_text || title);
  return `${sectionRef} | ${title} | ${textHash}`;
}

function buildRegionIndex(regionRows) {
  return (regionRows || [])
    .filter((row) => row && row.id && row.raw_text)
    .map((row) => ({
      row,
      normalized: normalizeForMatch(row.raw_text),
      compact: normalizeRegionText(row.raw_text),
    }));
}

function findRegionForProvision(row, regionIndex) {
  const explicitId = row.region_id || featureBag(row).regionId || featureBag(row).region_id;
  if (explicitId) {
    const existing = regionIndex.find((item) => item.row.id === explicitId);
    if (existing) return existing.row;
  }
  const normText = normalizeForMatch(row.full_text || '');
  if (normText.length < 12) return null;
  const needles = [
    normText.slice(0, Math.min(160, normText.length)),
    normText.slice(0, Math.min(80, normText.length)),
    normText.slice(0, Math.min(40, normText.length)),
  ].filter((needle) => needle.length >= 12);
  for (const needle of needles) {
    const match = regionIndex.find((item) => item.normalized.includes(needle));
    if (match) return match.row;
  }
  const compact = normalizeRegionText(row.full_text || '');
  if (compact.length >= 12) {
    const match = regionIndex.find((item) => item.compact.includes(compact.slice(0, Math.min(80, compact.length))));
    if (match) return match.row;
  }
  return null;
}

async function ensureParserRegions(sb, deal, apply) {
  const rawText = metaObject(deal.metadata).full_text || '';
  if (!rawText) throw new Error('deal metadata.full_text is missing');
  const cleaned = cleanText(rawText);
  const parsed = parseStructure(cleaned);
  const plannedRows = rowsForParserRegions(deal.id, cleaned, parsed.regions, parsed.sections);
  if (plannedRows.length === 0) throw new Error('parser produced no regions');

  const { data: existingRows, error: existingError } = await sb
    .from('parser_regions')
    .select('id,region_key')
    .eq('deal_id', deal.id);
  if (existingError) throw new Error(existingError.message);

  let persistedRows = existingRows || [];
  const existingKeys = new Set(persistedRows.map((row) => row.region_key));
  const missingRows = plannedRows.filter((row) => !existingKeys.has(row.region_key));
  if (apply && missingRows.length > 0) {
    const { data, error } = await sb
      .from('parser_regions')
      .upsert(missingRows, { onConflict: 'deal_id,region_key' })
      .select('id,region_key');
    if (error) {
      const missing = /parser_regions|schema cache|does not exist|Could not find/i.test(error.message || '');
      if (missing) {
        const persisted = await persistParserRegions(sb, deal.id, cleaned, parsed.regions, parsed.sections);
        persistedRows = persisted.rows || [];
      } else {
        throw new Error(`Failed to persist parser regions: ${error.message}`);
      }
    } else {
      persistedRows = [...persistedRows, ...(data || [])];
    }
  }

  const idByKey = new Map((persistedRows || []).map((row) => [row.region_key, row.id]));
  const rows = plannedRows.map((row, index) => ({
    ...row,
    id: idByKey.get(row.region_key) || row.id || `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  }));
  return rows;
}

function legacyProvisionForCard(row, deal, region) {
  const features = featureBag(row);
  const code = rowCode(row);
  const text = String(row.full_text || '').trim();
  const cardRegionHash = spanHash(`${region.text_hash || region.raw_text || ''}:${text}`);
  return {
    id: row.id,
    type: row.type,
    code,
    category: row.category,
    section_path: sectionPathForRow(row, region),
    region_id: region.id,
    region_full_text: text,
    region_hash: cardRegionHash,
    text,
    full_text: text,
    primary_quote: text,
    features,
    ai_metadata: row.ai_metadata,
    source_doc_id: deal.id,
    extracted_by: 'CODEX',
    extraction_version: 'm2-00-corpus-backfill-v1',
  };
}

function buildExtractorOutput(deal, provisionRows, parserRegionRows) {
  const regionIndex = buildRegionIndex(parserRegionRows);
  const provisions = [];
  const skipped = [];
  for (const row of provisionRows || []) {
    if (!row.full_text || !String(row.full_text).trim()) {
      skipped.push({ id: row.id, reason: 'missing full_text' });
      continue;
    }
    const region = findRegionForProvision(row, regionIndex);
    if (!region) {
      skipped.push({ id: row.id, reason: 'no matching parser region' });
      continue;
    }
    provisions.push(legacyProvisionForCard(row, deal, region));
  }
  return { provisions, skipped };
}

async function backfillDeal(sb, deal, options = {}) {
  const started = Date.now();
  const provisionRows = await fetchProvisionRows(sb, deal.id);
  const beforeCards = await existingCardCount(sb, deal.id);
  const parserRegionRows = await ensureParserRegions(sb, deal, options.apply);
  const extractorOutput = buildExtractorOutput(deal, provisionRows, parserRegionRows);
  const runOptions = {
    sourceDocId: deal.id,
    model: 'legacy-provisions',
    promptHash: 'legacy-provisions',
    runId: options.runId || `m2-00-corpus-backfill-${new Date().toISOString()}`,
    extractedAt: options.extractedAt || new Date().toISOString(),
    replaceDeal: true,
  };
  const rawBuiltRows = buildProvisionCardRows(deal.id, extractorOutput, runOptions);
  const deduped = dedupeProvisionCardRows(rawBuiltRows);
  const builtRows = deduped.rows;
  let written = false;
  if (options.apply) {
    await replaceProvisionCardRows(sb, deal.id, builtRows);
    written = true;
  }
  const afterCards = options.apply ? await existingCardCount(sb, deal.id) : builtRows.length;
  return {
    deal_id: deal.id,
    deal: displayDeal(deal),
    provisions: provisionRows.length,
    matched_provisions: extractorOutput.provisions.length,
    skipped_provisions: extractorOutput.skipped.length,
    parser_regions: parserRegionRows.length,
    before_cards: beforeCards,
    cards: afterCards,
    dry_run_cards: builtRows.length,
    duplicate_cards_removed: deduped.removed,
    written,
    ok: afterCards >= (options.minCards || DEFAULT_MIN_CARDS),
    ms: Date.now() - started,
    skipped_sample: extractorOutput.skipped.slice(0, 5),
  };
}

function markdownReport(results, options = {}) {
  const mode = options.apply ? 'APPLY' : 'DRY-RUN';
  const generatedAt = options.generatedAt || new Date().toISOString();
  const minCards = options.minCards || DEFAULT_MIN_CARDS;
  const failing = results.filter((row) => !row.ok);
  const lines = [
    '# WP-M2-00 corpus card backfill',
    '',
    `Generated: ${generatedAt}`,
    `Mode: ${mode}`,
    `Minimum cards per deal: ${minCards}`,
    `Deals: ${results.length}`,
    `Status: ${failing.length === 0 ? 'PASS' : 'FAIL'}`,
    '',
    '| Deal | Provisions | Matched | Skipped | Duplicates removed | Parser regions | Before cards | Cards | ms | Status |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---|',
  ];
  for (const row of results) {
    lines.push(`| ${row.deal.replace(/\|/g, '/')} | ${row.provisions} | ${row.matched_provisions} | ${row.skipped_provisions} | ${row.duplicate_cards_removed || 0} | ${row.parser_regions} | ${row.before_cards} | ${row.cards} | ${row.ms} | ${row.ok ? 'PASS' : 'FAIL'} |`);
  }
  const skipped = results.filter((row) => row.skipped_sample && row.skipped_sample.length);
  if (skipped.length) {
    lines.push('', '## Skipped Provision Samples', '');
    for (const row of skipped) {
      lines.push(`- ${row.deal}: ${row.skipped_sample.map((item) => `${item.id} (${item.reason})`).join(', ')}`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

async function run(argv = process.argv) {
  const args = parseArgs(argv);
  loadDotEnvLocal(args.envFile);
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase creds required');
  const sb = createClient(url, key);
  const deals = await fetchDeals(sb, args);
  if (deals.length === 0) throw new Error('No deals matched');
  const generatedAt = new Date().toISOString();
  const runId = `m2-00-corpus-backfill-${generatedAt}`;
  const results = [];
  for (const deal of deals) {
    console.log(`START ${displayDeal(deal)}`);
    const result = await backfillDeal(sb, deal, {
      apply: args.apply,
      minCards: args.minCards,
      runId,
      extractedAt: generatedAt,
    });
    results.push(result);
    console.log(`${result.ok ? 'PASS' : 'FAIL'} ${result.deal}: ${result.cards} cards (${result.ms}ms)`);
  }
  const report = markdownReport(results, { apply: args.apply, generatedAt, minCards: args.minCards });
  const out = path.resolve(args.out);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, report);
  const failures = results.filter((row) => !row.ok);
  if (failures.length) throw new Error(`${failures.length} deal(s) below ${args.minCards} cards`);
  return results;
}

if (require.main === module) {
  run().catch((error) => {
    console.error(error.message || String(error));
    process.exit(1);
  });
}

module.exports = {
  buildExtractorOutput,
  buildRegionIndex,
  dedupeProvisionCardRows,
  findRegionForProvision,
  legacyProvisionForCard,
  markdownReport,
  parseArgs,
  replaceProvisionCardRows,
  run,
  sectionPathForRow,
};
