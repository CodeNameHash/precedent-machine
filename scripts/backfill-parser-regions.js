#!/usr/bin/env node
/*
  Backfill parser_regions and region IDs into deals.metadata.classified_sections.

  Dry-run by default.
  Usage:
    node scripts/backfill-parser-regions.js --deal Metsera
    node scripts/backfill-parser-regions.js --deal Metsera --apply
    node scripts/backfill-parser-regions.js --all --apply
*/

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { cleanText, parseStructure } = require('../lib/parser-v2/structural');
const { attachRegionIdsToSections, persistParserRegions } = require('../lib/parser-v2/region-store');
const { classifyBreakdown } = require('../lib/parser-v2/snapshot');

function loadDotEnvLocal() {
  const p = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split(/\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
}

function parseArgs(argv) {
  const args = { deal: null, all: false, apply: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--deal') args.deal = argv[++i];
    else if (a === '--all') args.all = true;
    else if (a === '--apply') args.apply = true;
    else {
      console.error(`Unknown arg: ${a}`);
      process.exit(1);
    }
  }
  if (!args.deal && !args.all) {
    console.error('Usage: node scripts/backfill-parser-regions.js (--deal <substring> | --all) [--apply]');
    process.exit(1);
  }
  return args;
}

async function fetchDeals(sb, args) {
  const { data, error } = await sb.from('deals').select('id,acquirer,target,metadata');
  if (error) throw new Error(error.message);
  return (data || []).filter((deal) => {
    if (args.all) return true;
    return `${deal.acquirer || ''} ${deal.target || ''}`.toLowerCase().includes(args.deal.toLowerCase());
  });
}

function matchSnapshotToParsed(snapshot, parsedSections) {
  const byNumberAndStart = new Map();
  const byUniqueNumber = new Map();
  const numberCounts = new Map();
  for (const section of parsedSections || []) {
    const key = `${section.number || section.sectionNumber || ''}::${section.startChar || 0}`;
    const number = section.number || section.sectionNumber || '';
    byNumberAndStart.set(key, section);
    numberCounts.set(number, (numberCounts.get(number) || 0) + 1);
    byUniqueNumber.set(number, section);
  }
  return (snapshot || []).map((row) => {
    const number = row.sectionNumber || '';
    const key = `${number}::${row.startChar || 0}`;
    const parsed = byNumberAndStart.get(key) || (numberCounts.get(number) === 1 ? byUniqueNumber.get(number) : null);
    if (!parsed) return row;
    return {
      ...row,
      startChar: typeof parsed.startChar === 'number' ? parsed.startChar : row.startChar,
      endChar: parsed.endChar || row.endChar || null,
      regionType: parsed.regionType || row.regionType || null,
    };
  });
}

async function backfillDeal(sb, deal, apply) {
  const metadata = deal.metadata || {};
  const snapshot = Array.isArray(metadata.classified_sections) ? metadata.classified_sections : [];
  const fullText = metadata.full_text || '';
  if (!fullText || snapshot.length === 0) {
    return { skipped: true, reason: 'missing full_text or classified_sections' };
  }
  const cleaned = cleanText(fullText);
  const parsed = parseStructure(cleaned);
  const snapshotWithParsedEnds = matchSnapshotToParsed(snapshot, parsed.sections);
  const beforeRegionIds = snapshot.filter((s) => s.regionId || s.region_id).length;

  if (!apply) {
    return {
      skipped: false,
      dryRun: true,
      sections: snapshot.length,
      parsedRegions: parsed.regions.length,
      beforeRegionIds,
    };
  }

  const persisted = await persistParserRegions(sb, deal.id, cleaned, parsed.regions, snapshotWithParsedEnds);
  const nextSections = attachRegionIdsToSections(snapshotWithParsedEnds, persisted.rows);
  const afterRegionIds = nextSections.filter((s) => s.regionId || s.region_id).length;
  const nextMetadata = {
    ...metadata,
    classified_sections: nextSections,
    classify_breakdown: metadata.classify_breakdown || classifyBreakdown(nextSections),
    parser_regions_backfilled_at: new Date().toISOString(),
  };
  const { error } = await sb.from('deals').update({ metadata: nextMetadata }).eq('id', deal.id);
  if (error) throw new Error(error.message);
  return {
    skipped: false,
    sections: snapshot.length,
    parsedRegions: parsed.regions.length,
    beforeRegionIds,
    afterRegionIds,
  };
}

async function main() {
  loadDotEnvLocal();
  const args = parseArgs(process.argv);
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase creds required');
  const sb = createClient(url, key);
  const deals = await fetchDeals(sb, args);
  console.log(`Backfill parser regions — ${deals.length} deal(s), ${args.apply ? 'APPLY' : 'dry-run'}`);
  for (const deal of deals) {
    const result = await backfillDeal(sb, deal, args.apply);
    console.log(`${deal.acquirer || '?'} / ${deal.target || '?'} (${deal.id}): ${JSON.stringify(result)}`);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = { backfillDeal, matchSnapshotToParsed, parseArgs };
