#!/usr/bin/env node
/*
  WP-CLAIMS-LAYER-01 Phase 2 backfill: normalized-v1.json triples -> public.claims.

  Dry-run by default (computes + reports; writes NOTHING to the database).
  --apply is a real code path for the eventual live backfill but is
  intentionally not exercised by the Phase 0-2 investigation task that wrote
  this script — do not pass --apply until Phase 1's migration
  (supabase/schema-05-claims.sql) has actually been applied and reviewed.

  Faithful-materialisation rules (PLAN-CLAIMS-LAYER.md):
    1. Verbatim is copied byte-for-byte from the triple's raw_value. No
       normalisation at backfill time.
    2. Canonical is nullable and never fabricated. null in -> null out.
    3. Only triples whose field_key is a known Attribute (normalized-v1.json
       `entries`, the broader/live registry — see NOTE below) are
       materialised. Unknown attributes are routed to a report, not coerced.
    4. Provenance (extractor_id, extracted_at, ai_metadata.code,
       recoded_from/recoded_at, evidence_quote, feature_value) is carried
       into a provenance JSONB, never merged into canonical.
    5. Idempotent: upsert keyed on the triple id. A small number of triple
       ids collide across genuinely distinct claims in the source snapshot
       (see DEDUPE handling below) -- those get a disambiguating suffix
       instead of silently overwriting one another.

  NOTE on registry source: PLAN-CLAIMS-LAYER.md and lib/schema/features.js
  are cited together as "the 695-entry registry", but they are NOT the same
  set today -- lib/schema/features.js only has 524 keys; normalized-v1.json
  `entries` has 695 and is a strict superset (every features.js key is in
  entries; 171 keys are not yet regenerated into features.js). This script
  gates against `entries` (the larger, current set) because that is what
  produces 0 registry-unknown triples; gating against features.js alone
  would incorrectly flag ~0.67% of triples (mostly antitrustEffortsStandard,
  terminationFees, absence* keys) as unknown when they are in fact governed
  attributes pending a `generate-registry.js` regen. Report surfaces counts
  against BOTH sources so the caller can see the gap.

  Identity anchoring: see supabase/schema-05-claims.sql header. The
  region_id chain the plan names as primary
  (provisions.region_id -> provision_cards.region_id) resolves ~1.3% of
  triples in production because provisions.region_id is NULL on 98.7% of
  rows. This script uses the validated fallback instead: match
  provisions.full_text (trimmed) against provision_cards.region_full_text
  (trimmed), scoped to the same deal_id. That resolves 98.74% of triples
  with zero ambiguity across all 40 deals (Phase 1 investigation, 2026-07-08).
*/

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_NORMALIZED_PATH = path.join(REPO_ROOT, 'docs/schema-shape/normalized-v1.json');
const DEFAULT_REPORT = 'docs/reprocess/claims-backfill-dry-run.md';
const DEFAULT_JSON_REPORT = 'docs/reprocess/claims-backfill-dry-run.json';
const UPSERT_BATCH_SIZE = 500;

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
  return loadDotEnvFile(path.join(REPO_ROOT, '.env.local'));
}

function parseArgs(argv) {
  const args = {
    apply: false,
    dealFilter: null,
    envFile: null,
    normalizedPath: DEFAULT_NORMALIZED_PATH,
    out: DEFAULT_REPORT,
    jsonOut: DEFAULT_JSON_REPORT,
    spotCheckDeal: 'dc042001-b987-404f-bd02-41e1939fb914', // Chevron / Anadarko
    limit: null,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--apply') args.apply = true;
    else if (arg === '--dry-run') args.apply = false;
    else if (arg === '--deal') args.dealFilter = argv[++i];
    else if (arg === '--env-file') args.envFile = argv[++i];
    else if (arg === '--normalized-path') args.normalizedPath = path.resolve(argv[++i]);
    else if (arg === '--out') args.out = argv[++i];
    else if (arg === '--json-out') args.jsonOut = argv[++i];
    else if (arg === '--spot-check-deal') args.spotCheckDeal = argv[++i];
    else if (arg === '--limit') args.limit = Number(argv[++i]);
    else throw new Error(`Unknown arg: ${arg}`);
  }
  return args;
}

function norm(value) {
  return String(value == null ? '' : value).trim();
}

async function fetchAll(sb, table, columns, filterFn) {
  const pageSize = 1000;
  let from = 0;
  let all = [];
  for (;;) {
    let q = sb.from(table).select(columns).range(from, from + pageSize - 1);
    if (filterFn) q = filterFn(q);
    const { data, error } = await q;
    if (error) throw new Error(`Failed to read ${table}: ${error.message}`);
    all = all.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

function buildCardIndex(cards) {
  const byDealAndText = new Map();
  const byExcerptId = new Map();
  for (const card of cards) {
    byExcerptId.set(card.excerpt_id, card);
    if (!byDealAndText.has(card.deal_id)) byDealAndText.set(card.deal_id, new Map());
    const key = norm(card.region_full_text);
    const dealMap = byDealAndText.get(card.deal_id);
    if (!dealMap.has(key)) dealMap.set(key, []);
    dealMap.get(key).push(card);
  }
  return { byDealAndText, byExcerptId };
}

function resolveAnchor(triple, provisionsById, cardIndex) {
  const prov = provisionsById.get(triple.source_provision_id);
  if (!prov) return { status: 'no_provision_row' };
  const fullText = norm(prov.full_text);
  if (!fullText) return { status: 'provision_full_text_empty', provision: prov };
  const dealCards = cardIndex.byDealAndText.get(prov.deal_id);
  const matches = dealCards ? dealCards.get(fullText) : null;
  if (!matches || matches.length === 0) return { status: 'no_card_text_match', provision: prov };
  if (matches.length > 1) return { status: 'ambiguous_card_text_match', provision: prov, matches };
  return { status: 'resolved', provision: prov, card: matches[0] };
}

function buildProvenance(triple, anchorStatus) {
  const meta = triple.ai_metadata || {};
  return {
    extractor_id: triple.extractor_id || null,
    extracted_at: triple.extracted_at || null,
    code: meta.code || null,
    feature_key: meta.feature_key || null,
    feature_value: meta.feature_value === undefined ? null : meta.feature_value,
    recoded_from: meta.recoded_from || null,
    recoded_at: meta.recoded_at || null,
    // NOTE: evidence_quote is promoted to a first-class claims column (the
    // render consumes it on every claim). It is intentionally NOT duplicated
    // here to avoid two sources of truth for the same span.
    anchor_method: anchorStatus,
    triple_source: 'docs/schema-shape/normalized-v1.json',
  };
}

function dedupeAndDisambiguateIds(claimRows) {
  // Some triple ids collide across genuinely distinct claims in the source
  // snapshot (same id, different content). Exact duplicates (identical
  // deal_id/attribute/verbatim) collapse to one row (that's correct
  // idempotent behaviour). Non-identical collisions get a disambiguating
  // suffix so no distinct claim is silently dropped by the upsert key.
  const byId = new Map();
  for (const row of claimRows) {
    if (!byId.has(row.id)) byId.set(row.id, []);
    byId.get(row.id).push(row);
  }
  const finalRows = [];
  let exactDupesCollapsed = 0;
  let disambiguated = 0;
  for (const [id, group] of byId) {
    if (group.length === 1) {
      finalRows.push(group[0]);
      continue;
    }
    const seenSignatures = new Map();
    for (const row of group) {
      const sig = `${row.deal_id}::${row.attribute}::${JSON.stringify(row.verbatim)}::${row.canonical}::${JSON.stringify(row.evidence_quote)}`;
      if (seenSignatures.has(sig)) {
        exactDupesCollapsed += 1;
        continue;
      }
      seenSignatures.set(sig, true);
      finalRows.push(row);
    }
    if (seenSignatures.size > 1) {
      disambiguated += seenSignatures.size - 1;
      let n = 0;
      for (const row of finalRows.filter((r) => r.id === id)) {
        if (n > 0) row.id = `${id}#${n}`;
        n += 1;
      }
    }
  }
  return { finalRows, exactDupesCollapsed, disambiguated };
}

function topN(map, n) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

async function upsertClaims(sb, rows) {
  for (let i = 0; i < rows.length; i += UPSERT_BATCH_SIZE) {
    const batch = rows.slice(i, i + UPSERT_BATCH_SIZE);
    const { error } = await sb.from('claims').upsert(batch, { onConflict: 'id' });
    if (error) throw new Error(`Failed to upsert claims batch starting at ${i}: ${error.message}`);
  }
}

async function run(argv = process.argv) {
  const args = parseArgs(argv);
  loadDotEnvLocal(args.envFile);
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase creds required (.env.local or --env-file)');
  const sb = createClient(url, key, { auth: { persistSession: false } });

  console.log(`[claims-backfill] mode: ${args.apply ? 'APPLY (writes to DB)' : 'DRY-RUN (no writes)'}`);
  console.log('[claims-backfill] loading normalized-v1.json...');
  const doc = JSON.parse(fs.readFileSync(args.normalizedPath, 'utf8'));
  let triples = doc.triples;
  if (args.dealFilter) triples = triples.filter((t) => t.deal_id === args.dealFilter);
  if (args.limit) triples = triples.slice(0, args.limit);
  const entryKeys = new Set(doc.entries.map((e) => e.key));

  let featureKeys = new Set();
  try {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const { FEATURES } = require(path.join(REPO_ROOT, 'lib/schema/features.js'));
    featureKeys = new Set(Object.keys(FEATURES));
  } catch (e) {
    console.warn('[claims-backfill] could not load lib/schema/features.js:', e.message);
  }

  console.log(`[claims-backfill] ${triples.length} triples, ${entryKeys.size} registry entries, generated_at=${doc.generated_at}`);

  console.log('[claims-backfill] fetching provisions + provision_cards from DB...');
  const provisions = await fetchAll(sb, 'provisions', 'id, deal_id, full_text');
  const cards = await fetchAll(sb, 'provision_cards', 'deal_id, excerpt_id, provision_instance_id, region_id, region_full_text');
  console.log(`[claims-backfill] ${provisions.length} provisions rows, ${cards.length} provision_cards rows`);

  const provisionsById = new Map(provisions.map((p) => [p.id, p]));
  const cardIndex = buildCardIndex(cards);

  const claimRows = [];
  const orphanReport = { no_provision_row: [], provision_full_text_empty: [], no_card_text_match: [], ambiguous_card_text_match: [] };
  const unknownAttrCountsEntries = new Map();
  const unknownAttrCountsFeaturesJs = new Map();
  let registryUnknownVsEntries = 0;
  let registryUnknownVsFeaturesJs = 0;
  let resolvedCanonical = 0;
  let nullCanonical = 0;
  const perDealCounts = new Map();
  const perDealAnchored = new Map();

  for (const triple of triples) {
    perDealCounts.set(triple.deal_id, (perDealCounts.get(triple.deal_id) || 0) + 1);

    if (!entryKeys.has(triple.field_key)) {
      registryUnknownVsEntries += 1;
      unknownAttrCountsEntries.set(triple.field_key, (unknownAttrCountsEntries.get(triple.field_key) || 0) + 1);
      // Registry-gated: do not materialise. Route to report only.
      continue;
    }
    if (!featureKeys.has(triple.field_key)) {
      registryUnknownVsFeaturesJs += 1;
      unknownAttrCountsFeaturesJs.set(triple.field_key, (unknownAttrCountsFeaturesJs.get(triple.field_key) || 0) + 1);
      // Not gated on this (stale) source -- informational only.
    }

    const anchor = resolveAnchor(triple, provisionsById, cardIndex);
    if (anchor.status !== 'resolved') {
      orphanReport[anchor.status].push({
        tripleId: triple.id,
        dealId: triple.deal_id,
        fieldKey: triple.field_key,
        sourceProvisionId: triple.source_provision_id,
      });
      continue;
    }

    perDealAnchored.set(triple.deal_id, (perDealAnchored.get(triple.deal_id) || 0) + 1);
    if (triple.canonicalKey) resolvedCanonical += 1;
    else nullCanonical += 1;

    claimRows.push({
      id: triple.id,
      deal_id: triple.deal_id,
      excerpt_id: anchor.card.excerpt_id,
      provision_instance_id: anchor.card.provision_instance_id,
      region_id: anchor.card.region_id,
      attribute: triple.field_key,
      verbatim: triple.raw_value === undefined ? null : (typeof triple.raw_value === 'string' ? triple.raw_value : JSON.stringify(triple.raw_value)),
      evidence_quote: triple.evidence_quote || null,
      canonical: triple.canonicalKey || null,
      provenance: buildProvenance(triple, 'full_text_match'),
      source_provision_id: triple.source_provision_id,
    });
  }

  const { finalRows, exactDupesCollapsed, disambiguated } = dedupeAndDisambiguateIds(claimRows);

  console.log('\n--- DRY-RUN SUMMARY ---');
  console.log('input triples considered:', triples.length);
  console.log('registry-unknown vs entries(695) [DROPPED, not materialised]:', registryUnknownVsEntries);
  console.log('registry-unknown vs features.js(524) [informational only]:', registryUnknownVsFeaturesJs);
  console.log('anchored to a card (would be written):', claimRows.length);
  console.log('  after id-collision dedupe/disambiguation:', finalRows.length, `(collapsed ${exactDupesCollapsed} exact dupes, disambiguated ${disambiguated} distinct-but-colliding ids)`);
  console.log('  canonical resolved (non-null):', resolvedCanonical, `(${(100 * resolvedCanonical / claimRows.length).toFixed(2)}%)`);
  console.log('  canonical null:', nullCanonical, `(${(100 * nullCanonical / claimRows.length).toFixed(2)}%)`);
  console.log('orphaned (not anchored, would NOT be written):');
  for (const [k, v] of Object.entries(orphanReport)) console.log(`  ${k}:`, v.length);
  console.log('top 20 registry-unknown attributes (vs entries):', topN(unknownAttrCountsEntries, 20));

  console.log('\n--- Per-deal row counts (triples considered vs anchored) ---');
  const dealIds = [...perDealCounts.keys()].sort();
  for (const dealId of dealIds) {
    console.log(`  ${dealId}: ${perDealAnchored.get(dealId) || 0} / ${perDealCounts.get(dealId)}`);
  }

  // Spot-check
  let spotCheck = null;
  if (args.spotCheckDeal) {
    const wanted = new Set(['noticePeriod', 'matchingPeriod', 'interveningEventScope', 'fiduciaryOutStandard']);
    const dealClaims = finalRows.filter((r) => r.deal_id === args.spotCheckDeal);
    const nosolIntervening = dealClaims.filter((r) => wanted.has(r.attribute) || /nosol|interven/i.test(r.attribute));
    spotCheck = {
      dealId: args.spotCheckDeal,
      totalClaimsForDeal: dealClaims.length,
      requiredAttributesPresent: [...wanted].reduce((acc, k) => {
        acc[k] = dealClaims.some((r) => r.attribute === k);
        return acc;
      }, {}),
      rows: nosolIntervening.map((r) => ({ attribute: r.attribute, verbatim: r.verbatim, canonical: r.canonical })),
    };
    console.log('\n--- Spot-check: deal', args.spotCheckDeal, '---');
    console.log('total claims that would be written for this deal:', spotCheck.totalClaimsForDeal);
    console.log('required attributes present?', JSON.stringify(spotCheck.requiredAttributesPresent, null, 2));
    console.log(`NoSol/intervening-event claims (${nosolIntervening.length}):`);
    for (const r of spotCheck.rows) console.log(`  ${r.attribute} = ${JSON.stringify(r.verbatim)} (canonical: ${r.canonical})`);
  }

  const reportOut = {
    generatedAt: new Date().toISOString(),
    mode: args.apply ? 'apply' : 'dry-run',
    normalizedGeneratedAt: doc.generated_at,
    tripleCount: triples.length,
    registryUnknownVsEntries,
    registryUnknownVsFeaturesJs,
    topUnknownAttributesVsEntries: topN(unknownAttrCountsEntries, 20),
    topUnknownAttributesVsFeaturesJs: topN(unknownAttrCountsFeaturesJs, 20),
    anchoredCount: claimRows.length,
    finalRowCount: finalRows.length,
    exactDupesCollapsed,
    disambiguated,
    resolvedCanonical,
    nullCanonical,
    orphanCounts: Object.fromEntries(Object.entries(orphanReport).map(([k, v]) => [k, v.length])),
    orphanSamples: Object.fromEntries(Object.entries(orphanReport).map(([k, v]) => [k, v.slice(0, 10)])),
    perDeal: dealIds.map((id) => ({ dealId: id, considered: perDealCounts.get(id), anchored: perDealAnchored.get(id) || 0 })),
    spotCheck,
  };
  const jsonOutPath = path.resolve(args.jsonOut);
  fs.mkdirSync(path.dirname(jsonOutPath), { recursive: true });
  fs.writeFileSync(jsonOutPath, JSON.stringify(reportOut, null, 2));
  console.log('\nWrote', jsonOutPath);

  const mdLines = [
    '# Claims backfill dry-run',
    '',
    `Generated: ${reportOut.generatedAt}`,
    `Mode: ${reportOut.mode}`,
    `normalized-v1.json generated_at: ${reportOut.normalizedGeneratedAt}`,
    `Triples considered: ${reportOut.tripleCount}`,
    `Would write: ${reportOut.finalRowCount} claim rows`,
    `Canonical resolved: ${reportOut.resolvedCanonical} / null: ${reportOut.nullCanonical}`,
    `Registry-unknown (dropped): ${reportOut.registryUnknownVsEntries}`,
    `Orphaned (no card anchor): ${Object.values(reportOut.orphanCounts).reduce((a, b) => a + b, 0)}`,
    '',
  ];
  const mdOutPath = path.resolve(args.out);
  fs.mkdirSync(path.dirname(mdOutPath), { recursive: true });
  fs.writeFileSync(mdOutPath, mdLines.join('\n'));
  console.log('Wrote', mdOutPath);

  if (args.apply) {
    console.log('\n[claims-backfill] --apply requested: writing', finalRows.length, 'rows to public.claims...');
    await upsertClaims(sb, finalRows);
    console.log('[claims-backfill] write complete.');
  } else {
    console.log('\n[claims-backfill] DRY-RUN: no rows written to the database.');
  }

  return reportOut;
}

if (require.main === module) {
  run().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { run, resolveAnchor, buildCardIndex, dedupeAndDisambiguateIds };
