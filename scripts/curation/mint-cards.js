#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────
   scripts/curation/mint-cards.js — Ben-gated card minting for card-less
   coded provisions.

   After TASK 3, some provisions carry coded (taxonomy-tagged) features but
   have NO provision_cards row — they render nowhere in the review UI and
   their codes never reach claims. This tool mints a card for each such
   provision it can safely account for. It pulls forward PLAN-M3 Phase-4 for
   existing deals.

   Target selection is deterministic and never guesses: it imports the SAME
   match ladder rematerialize-claims.js uses (buildDealPlan) so "has no
   card" is defined identically here and there.

     candidates = plan.unmatchedProvisions that:
       (a) carry coded features (provisionHasCodedFeatures, imported)
       (b) are NOT type SECTION-LEFTOVER (coverage filler, not a provision)
       (c) are not part of any ambiguity group from the match ladder
           (SKIPPED-AMBIGUOUS — minting there could pair wrongly)
       (d) do not collide with an EXISTING card's short_title in the same
           deal (SKIPPED-TITLE-TAKEN — the exact duplicate-title pathology
           prune-cards.js was built to clean up)
       (e) do not collide on region_hash: provision_cards has
           UNIQUE(deal_id, region_hash), so a candidate whose
           spanHash(full_text) matches an existing card's region_hash — or
           matches ANOTHER candidate's (two card-less provisions with
           identical full_text) — is skipped (SKIPPED-REGION-HASH-TAKEN;
           identical-text pairs skip BOTH sides).

   REGION CREATION (the ingest-parity path): provision_cards.region_id is
   NOT NULL (FK to parser_regions) and the schema is NOT relaxed for minted
   rows. Instead, mint-cards creates the parser_regions row itself, the way
   ingest does:
     - region_key = `mint:<provision_id>` — satisfies
       UNIQUE(deal_id, region_key) deterministically and makes reruns
       detectable: if that key already exists, the run REUSES the existing
       region's id instead of inserting a duplicate.
     - region_type = 'body.section.provision' (the dominant existing
       vocabulary value, verified live).
     - start_char = 0, end_char = full_text.length — span-valid, but true
       document offsets are unknown for minted rows; recorded honestly in
       metadata.offsets = 'synthetic'.
     - title = provision.category, raw_text = provision.full_text,
       text_hash = spanHash(full_text), section_ref = null,
       metadata = { source: 'mint-cards', provision_id, offsets }.
   The card row then carries region_id = that region's id (resolved at
   write time via .insert(...).select('id').single()) and region_hash = the
   same text_hash.

   Every minted card is then re-verified: buildDealPlan is re-run with the
   (would-be) minted cards included, and each minted card must match its OWN
   source provision at rung 1 or 2, with no new ambiguity introduced. Any
   failure refuses ALL minting for that deal (POST-CHECK-FAILED), not just
   the offending card — all-or-nothing PER DEAL (not per-run, unlike
   prune-cards.js's whole-run gate; see the interpretation note at the top
   of the test file).

   Every destructive step is gated exactly like prune-cards.js:
     - dry-run by default (writes nothing)
     - --apply requires --backup <path> (checkBackupGate imported from
       prune-cards.js; the dump itself is local because it must also cover
       parser_regions, which prune's dump does not touch)
     - the only writes this tool ever performs are INSERTs into
       parser_regions and provision_cards, in that order per deal (all
       region inserts, then all card inserts); any insert error aborts the
       remainder of that deal and is reported, without touching other deals.

   DRY-RUN IS THE DEFAULT: prints a per-deal table of every card it WOULD
   mint (or skip, or refuse), writes nothing.

   Usage:
     node scripts/curation/mint-cards.js --deal <uuid>[,<uuid>...]
     node scripts/curation/mint-cards.js --all
     node scripts/curation/mint-cards.js --deal <uuid> --apply --backup reports/mint-backup.json
     [--json]
   ───────────────────────────────────────────────────────────────────────── */

const fs = require('fs');
const path = require('path');

const { FEATURES } = require('../../lib/schema/features');
const { atomicValues } = require('../../lib/parser-v2/store-claims');
const { provisionType, partyScope } = require('../../lib/parser-v2/store-cards');
const {
  provisionInstanceId,
  excerptId,
  spanHash,
} = require('../../lib/schema/provision-card');
const {
  buildDealPlan: buildMatchPlan,
  provisionHasCodedFeatures,
} = require('../reprocess/rematerialize-claims');
const { checkBackupGate } = require('./prune-cards');
const { persistReport, resolveReportDbFlag } = require('../../lib/reports/persist-report');

/* ── pure helpers (exported for tests — no DB, no network) ───────────────── */

// Same registry-gated "is this feature coded" test provisionHasCodedFeatures
// uses, but returning the KEYS (for the per-candidate report line) instead
// of a boolean. Deliberately built from the same primitives
// (FEATURES + atomicValues), not a re-derivation of the predicate itself —
// provisionHasCodedFeatures is still imported and used for target selection.
function codedFeatureKeys(provision) {
  const features = provision && provision.ai_metadata && provision.ai_metadata.features;
  if (!features || typeof features !== 'object') return [];
  const keys = [];
  for (const [key, value] of Object.entries(features)) {
    const registryEntry = FEATURES[key];
    if (!registryEntry) continue;
    if (registryEntry.listItemTagFamily) { keys.push(key); continue; }
    if (atomicValues(value, registryEntry).some((atom) => atom.canonical != null)) keys.push(key);
  }
  return keys;
}

function mintRegionKey(provisionId) {
  return `mint:${provisionId}`;
}

// Builds the parser_regions row a minted card anchors to, mirroring the
// ingest-created shape (supabase/parser-regions-consideration-schema.sql).
// True document offsets are unknown for minted rows — the 0..length span is
// span-valid but synthetic, and metadata records that honestly.
function buildMintedRegionRow(dealId, provision) {
  const fullText = String(provision.full_text || '').trim();
  if (!fullText) throw new Error(`Cannot mint a region for provision ${provision.id}: empty full_text`);
  return {
    deal_id: dealId,
    region_key: mintRegionKey(provision.id),
    region_type: 'body.section.provision',
    start_char: 0,
    end_char: fullText.length,
    section_ref: null,
    title: provision.category || null,
    raw_text: fullText,
    text_hash: spanHash(fullText),
    metadata: { source: 'mint-cards', provision_id: provision.id, offsets: 'synthetic' },
  };
}

// Builds one provision_cards row for a card-less coded provision, mirroring
// the ingest path (lib/parser-v2/store-cards.js initialCardRow) as closely
// as the schema allows.
//
// One literal spec value could not be honored as written, because the REAL
// schema (supabase/schema-03-card-model.sql) forbids it — see the test
// file's interpretation notes:
//   - extracted_by: CHECK (extracted_by IN ('CODEX','CLAUDE','BOTH')) — the
//     literal 'mint-cards' value would violate this CHECK. Tool identity is
//     preserved in provenance.extractor_name / review_notes instead; the
//     enum column itself uses 'CODEX'.
//
// region_id starts null in the PLANNED row and is filled in at write time
// from the parser_regions insert (or the reused region id on a rerun) —
// executeWrites never inserts a card whose region_id is still null.
// region_hash = spanHash(full_text), identical to the region row's
// text_hash by construction.
//
// excerpt_id / provision_instance_id / section_ref: the `provisions` table
// carries no section/heading column (see supabase/schema.sql — provisions
// has only type/category/full_text/ai_metadata, no section_ref), so the
// real store-cards.js sectionPath() derivation isn't reachable here. Per
// spec's explicit fallback: sha256(full_text).slice(0,12) (spanHash) is used
// for BOTH hash slots of the `<section> | <short_title> | <hash>` section_ref
// convention, with excerpt index 0. This is deterministic (same
// dealId/text/short_title always produce the same id) and reuses the exact
// hashing/id-assembly helpers store-cards.js itself uses
// (lib/schema/provision-card.js), not a reimplementation.
function buildMintedCardRow(dealId, provision, options = {}) {
  const fullText = String(provision.full_text || '').trim();
  if (!fullText) throw new Error(`Cannot mint a card for provision ${provision.id}: empty full_text`);
  const shortTitle = String(provision.category || '').trim();
  if (!shortTitle) throw new Error(`Cannot mint a card for provision ${provision.id}: empty category`);

  const type = provisionType(provision);
  const hash = spanHash(fullText);
  const sectionRef = `${hash} | ${shortTitle} | ${hash}`;
  const provisionInstId = provisionInstanceId({ dealId, sectionPath: sectionRef, text: fullText });
  const excerptIdValue = excerptId(provisionInstId, 0);

  const extractionVersion = (provision.ai_metadata && provision.ai_metadata.extraction_version) || 'mint-cards-v1';
  const extractedAt = provision.extracted_at
    || provision.created_at
    || (provision.ai_metadata && provision.ai_metadata.extracted_at)
    || new Date().toISOString();

  return {
    deal_id: dealId,
    provision_type: type,
    provision_subtype: null,
    section_ref: sectionRef,
    short_title: shortTitle,
    party_scope: partyScope(provision, type),
    region_id: null, // filled at write time from the parser_regions insert
    region_full_text: fullText,
    region_hash: hash,
    primary_quote_start: 0,
    primary_quote_end: fullText.length,
    primary_quote: fullText,
    extracted_by: 'CODEX',
    extraction_version: extractionVersion,
    needs_review: true,
    review_notes: `minted by scripts/curation/mint-cards.js from provision ${provision.id}`,
    provision_instance_id: provisionInstId,
    excerpt_id: excerptIdValue,
    kind: 'standard',
    defined_term: null,
    defined_value: null,
    references: [],
    provenance: {
      source_doc_id: dealId,
      source_doc_page: 0,
      source_doc_offset_start: 0,
      source_doc_offset_end: fullText.length,
      extractor_name: 'mint-cards',
      extractor_version: extractionVersion,
      model: 'unknown',
      prompt_hash: 'unknown',
      run_id: options.runId || 'mint-cards',
      extracted_at: extractedAt,
    },
  };
}

// Target selection for one deal: runs the match ladder, then applies the
// skip gates. Region-hash collisions are handled by the caller
// (buildDealMintPlan) because they need the whole candidate set.
function selectMintCandidates(dealId, cards, provisions) {
  const matchPlan = buildMatchPlan(dealId, cards, provisions);
  const ambiguousProvisionIds = new Set(matchPlan.ambiguities.flatMap((a) => a.provisionIds));
  const existingTitles = new Set((cards || []).map((c) => c.short_title));

  const eligible = matchPlan.unmatchedProvisions.filter(
    (p) => p.type !== 'SECTION-LEFTOVER' && provisionHasCodedFeatures(p),
  );

  const skipped = [];
  const candidates = [];
  for (const p of eligible) {
    if (ambiguousProvisionIds.has(p.id)) {
      skipped.push({ provision: p, status: 'SKIPPED-AMBIGUOUS' });
      continue;
    }
    if (existingTitles.has(p.category)) {
      skipped.push({ provision: p, status: 'SKIPPED-TITLE-TAKEN' });
      continue;
    }
    candidates.push(p);
  }

  return { matchPlan, skipped, candidates };
}

// Region-hash collision guards (pre-flight, skip + report, never write):
//   (a) an existing card in the deal already carries the candidate's
//       region_hash — UNIQUE(deal_id, region_hash) would trip on insert;
//   (b) two candidates in the same deal share identical full_text (same
//       spanHash) — inserting both would trip the same constraint against
//       each other; BOTH are skipped.
function applyRegionHashGuards(candidates, cards) {
  const existingHashes = new Set(
    (cards || []).map((c) => c && c.region_hash).filter(Boolean),
  );
  const hashCounts = new Map();
  for (const p of candidates) {
    const h = spanHash(String(p.full_text || '').trim());
    hashCounts.set(h, (hashCounts.get(h) || 0) + 1);
  }
  const kept = [];
  const skipped = [];
  for (const p of candidates) {
    const h = spanHash(String(p.full_text || '').trim());
    if (existingHashes.has(h) || hashCounts.get(h) > 1) {
      skipped.push({ provision: p, status: 'SKIPPED-REGION-HASH-TAKEN' });
    } else {
      kept.push(p);
    }
  }
  return { kept, skipped };
}

// Post-mint invariant: re-runs the match ladder WITH the (would-be) minted
// cards included, and asserts every minted card matches its own source
// provision at rung 1 or 2, and that no ambiguity group appears that wasn't
// already present before minting. `mintedPairs` is [{ provision, row }, ...].
function runPostMintCheck(dealId, existingCards, provisions, mintedPairs, originalMatchPlan) {
  const mintedRows = mintedPairs.map((pair) => pair.row);
  const combinedCards = (existingCards || []).concat(mintedRows);
  const postPlan = buildMatchPlan(dealId, combinedCards, provisions);

  for (const { provision, row } of mintedPairs) {
    const match = postPlan.matches.find((m) => m.card === row);
    if (!match) {
      return { ok: false, reason: `provision ${provision.id}: minted card did not match any provision post-mint`, postPlan };
    }
    if (match.provision.id !== provision.id) {
      return {
        ok: false,
        reason: `provision ${provision.id}: minted card matched a DIFFERENT provision (${match.provision.id}) post-mint`,
        postPlan,
      };
    }
    if (match.rung > 2) {
      return {
        ok: false,
        reason: `provision ${provision.id}: minted card only matched at rung ${match.rung} (need rung 1 or 2)`,
        postPlan,
      };
    }
  }

  const originalKeys = new Set(
    (originalMatchPlan.ambiguities || []).map((a) => `${a.type}|${a.rung}|${JSON.stringify(a.key)}`),
  );
  const newAmbiguities = (postPlan.ambiguities || []).filter(
    (a) => !originalKeys.has(`${a.type}|${a.rung}|${JSON.stringify(a.key)}`),
  );
  if (newAmbiguities.length > 0) {
    return {
      ok: false,
      reason: `minting introduces ${newAmbiguities.length} new ambiguity group(s)`,
      postPlan,
    };
  }

  return { ok: true, postPlan };
}

// Plans every candidate mint for one deal: selection -> region-hash guards
// -> construction (region row + card row, with rerun-reuse detection against
// existing parser_regions rows) -> post-mint invariant -> write plan.
// All-or-nothing PER DEAL: a post-check failure zeroes out every candidate
// write for this deal (skips are unaffected — they were never going to
// write). `regions` is the deal's existing parser_regions rows
// (id + region_key at minimum), used only for rerun-reuse detection.
function buildDealMintPlan(dealId, cards, provisions, regions, options = {}) {
  const { matchPlan, skipped, candidates } = selectMintCandidates(dealId, cards, provisions);
  const guard = applyRegionHashGuards(candidates, cards);
  const allSkipped = skipped.concat(guard.skipped);

  const entryBase = (provision) => ({
    dealId,
    provisionId: provision.id,
    category: provision.category,
    textLength: String(provision.full_text || '').length,
    codedFeatureKeys: codedFeatureKeys(provision),
  });

  const entries = allSkipped.map(({ provision, status }) => ({
    ...entryBase(provision),
    status,
    write: null,
  }));

  if (guard.kept.length === 0) {
    return { dealId, entries, ok: true, matchPlan };
  }

  const regionIdByKey = new Map(
    (regions || []).filter((r) => r && r.region_key).map((r) => [r.region_key, r.id]),
  );

  const mintedPairs = guard.kept.map((provision) => ({
    provision,
    row: buildMintedCardRow(dealId, provision, options),
    regionRow: buildMintedRegionRow(dealId, provision),
    // Rerun-reuse: a parser_regions row with this deterministic key already
    // exists (a previous mint run created it) — reuse its id instead of
    // inserting a duplicate, which UNIQUE(deal_id, region_key) would refuse.
    reuseRegionId: regionIdByKey.get(mintRegionKey(provision.id)) || null,
  }));

  const postCheck = runPostMintCheck(dealId, cards, provisions, mintedPairs, matchPlan);
  if (!postCheck.ok) {
    for (const { provision } of mintedPairs) {
      entries.push({
        ...entryBase(provision),
        status: 'POST-CHECK-FAILED',
        reason: postCheck.reason,
        write: null,
      });
    }
    return { dealId, entries, ok: false, matchPlan };
  }

  for (const { provision, row, regionRow, reuseRegionId } of mintedPairs) {
    entries.push({
      ...entryBase(provision),
      status: 'MINTED',
      write: {
        op: 'insert',
        cardRow: row,
        regionRow,
        reuseRegionId,
      },
    });
  }
  return { dealId, entries, ok: true, matchPlan };
}

// Plans the whole run: one buildDealMintPlan per requested deal.
// `dealDataById` is { [dealId]: { cards, provisions, regions } }.
function buildRunPlan(dealIds, dealDataById, options = {}) {
  const dealPlans = (dealIds || []).map((dealId) => {
    const data = (dealDataById && dealDataById[dealId]) || {};
    return buildDealMintPlan(dealId, data.cards || [], data.provisions || [], data.regions || [], options);
  });
  return { dealPlans };
}

// All-or-nothing PER DEAL (not per-run, unlike prune-cards.js): only deals
// whose own plan is `ok` contribute writes; a refused deal contributes zero,
// but does not block other, clean deals in the same run.
function plannedInserts(runPlan) {
  const rows = [];
  for (const dealPlan of (runPlan && runPlan.dealPlans) || []) {
    if (!dealPlan.ok) continue;
    for (const entry of dealPlan.entries) {
      if (entry.write) rows.push(entry);
    }
  }
  return rows;
}

function summarize(runPlan) {
  const counts = {
    minted: 0,
    skippedAmbiguous: 0,
    skippedTitleTaken: 0,
    skippedRegionHashTaken: 0,
    postCheckFailed: 0,
  };
  for (const dealPlan of (runPlan && runPlan.dealPlans) || []) {
    for (const entry of dealPlan.entries) {
      if (entry.status === 'MINTED') counts.minted += 1;
      else if (entry.status === 'SKIPPED-AMBIGUOUS') counts.skippedAmbiguous += 1;
      else if (entry.status === 'SKIPPED-TITLE-TAKEN') counts.skippedTitleTaken += 1;
      else if (entry.status === 'SKIPPED-REGION-HASH-TAKEN') counts.skippedRegionHashTaken += 1;
      else if (entry.status === 'POST-CHECK-FAILED') counts.postCheckFailed += 1;
    }
  }
  return counts;
}

/* ── report formatting ───────────────────────────────────────────────────── */

function shortId(id) {
  return id ? String(id).slice(0, 8) : '(unknown)';
}

function formatEntryLine(e) {
  const keys = e.codedFeatureKeys && e.codedFeatureKeys.length ? e.codedFeatureKeys.join(',') : '(none)';
  const write = e.write
    ? `${e.write.reuseRegionId
      ? `REUSE parser_regions(${shortId(e.write.reuseRegionId)})`
      : `INSERT parser_regions(${e.write.regionRow.region_key})`} + INSERT provision_cards (excerpt_id=${e.write.cardRow.excerpt_id})`
    : 'none';
  const reason = e.reason ? `  [${e.reason}]` : '';
  return `  ${shortId(e.provisionId)}  ${(e.category || '(untitled)').padEnd(40)}  len=${String(e.textLength).padEnd(6)}  ${e.status.padEnd(28)}  coded: ${keys}  write: ${write}${reason}`;
}

function formatDealTable(dealPlan) {
  const lines = [`deal ${dealPlan.dealId} — ${dealPlan.ok ? 'clean' : 'NOT CLEAN'} (${dealPlan.entries.length} candidate(s))`];
  for (const e of dealPlan.entries) lines.push(formatEntryLine(e));
  if (dealPlan.entries.length === 0) lines.push('  (no card-less coded provisions found)');
  return lines.join('\n');
}

function formatRunReport(runPlan) {
  const counts = summarize(runPlan);
  const lines = [
    `mint-cards — ${runPlan.dealPlans.length} deal(s)`,
    `  minted: ${counts.minted}  skipped-ambiguous: ${counts.skippedAmbiguous}  skipped-title-taken: ${counts.skippedTitleTaken}  skipped-region-hash-taken: ${counts.skippedRegionHashTaken}  post-check-failed: ${counts.postCheckFailed}`,
  ];
  for (const dealPlan of runPlan.dealPlans) {
    lines.push('');
    lines.push(formatDealTable(dealPlan));
  }
  return lines.join('\n');
}

/* ── CLI / DB plumbing ───────────────────────────────────────────────────── */

function loadDotEnvLocal() {
  const p = path.join(__dirname, '..', '..', '.env.local');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
}

function usage() {
  console.error(
    'Usage: node scripts/curation/mint-cards.js [--deal <uuid>[,<uuid>...] | --all] ' +
    '[--apply --backup <path>] [--json]',
  );
  process.exit(1);
}

function parseArgs(argv) {
  const args = {
    deals: [], all: false, apply: false, backup: null, json: false, reportDb: null,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--deal') {
      const raw = argv[++i] || '';
      args.deals.push(...raw.split(',').map((s) => s.trim()).filter(Boolean));
    } else if (a === '--all') {
      args.all = true;
    } else if (a === '--apply') {
      args.apply = true;
    } else if (a === '--backup') {
      args.backup = argv[++i];
    } else if (a === '--json') {
      args.json = true;
    } else if (a === '--report-db') {
      args.reportDb = true;
    } else if (a === '--no-report-db') {
      args.reportDb = false;
    } else {
      console.error(`Unknown arg: ${a}`);
      usage();
    }
  }
  if (!args.all && args.deals.length === 0) usage();
  return args;
}

async function fetchDealIds(sb, args) {
  let query = sb.from('deals').select('id');
  if (!args.all) query = query.in('id', args.deals);
  const { data, error } = await query;
  if (error) throw new Error(`Deal fetch failed: ${error.message}`);
  if (!data || data.length === 0) {
    throw new Error(args.all ? 'No deals in the corpus.' : `No deal(s) found for id(s): ${args.deals.join(', ')}`);
  }
  return data.map((d) => d.id);
}

async function fetchProvisionsForDeal(sb, dealId) {
  const { data, error } = await sb
    .from('provisions')
    .select('id, type, category, full_text, ai_metadata, created_at')
    .eq('deal_id', dealId);
  if (error) throw new Error(`provisions fetch failed (deal ${dealId}): ${error.message}`);
  return data || [];
}

async function fetchCardsForDeal(sb, dealId) {
  const { data, error } = await sb
    .from('provision_cards')
    .select('id, excerpt_id, provision_instance_id, region_id, region_hash, provision_type, short_title, region_full_text')
    .eq('deal_id', dealId);
  if (error) throw new Error(`provision_cards fetch failed (deal ${dealId}): ${error.message}`);
  return data || [];
}

async function fetchRegionsForDeal(sb, dealId) {
  const { data, error } = await sb
    .from('parser_regions')
    .select('id, region_key')
    .eq('deal_id', dealId);
  if (error) throw new Error(`parser_regions fetch failed (deal ${dealId}): ${error.message}`);
  return data || [];
}

// PostgREST caps a select response at 1,000 rows by default. A backup that
// silently stops there is not recoverable, so every dump reads until an
// under-full page proves the table is exhausted.
const BACKUP_PAGE_SIZE = 1000;
async function fetchAllRowsByColumn(sb, table, column, value) {
  const rows = [];
  for (let start = 0; ; start += BACKUP_PAGE_SIZE) {
    const { data, error } = await sb
      .from(table)
      .select('*')
      .eq(column, value)
      .order('id', { ascending: true })
      .range(start, start + BACKUP_PAGE_SIZE - 1);
    if (error) throw new Error(`Backup dump failed (${table}, ${column}=${value}): ${error.message}`);
    const page = data || [];
    rows.push(...page);
    if (page.length < BACKUP_PAGE_SIZE) return rows;
  }
}

// BEFORE any write: dump every provision_cards + claims + parser_regions row
// for every affected deal to `backupPath`. Local rather than reusing
// prune-cards' dumpBackup because a mint rollback must also be able to
// delete the minted parser_regions rows, which prune's dump doesn't cover.
// Same gate semantics: refuses (throws) if the file already exists or any
// dump read fails.
async function dumpBackup(sb, dealIds, backupPath) {
  if (fs.existsSync(backupPath)) {
    throw new Error(`Backup path already exists, refusing to overwrite: ${backupPath}`);
  }
  const deals = {};
  const provisions = {};
  const provision_cards = {};
  const claims = {};
  const parser_regions = {};
  for (const dealId of dealIds) {
    deals[dealId] = await fetchAllRowsByColumn(sb, 'deals', 'id', dealId);
    provisions[dealId] = await fetchAllRowsByColumn(sb, 'provisions', 'deal_id', dealId);
    provision_cards[dealId] = await fetchAllRowsByColumn(sb, 'provision_cards', 'deal_id', dealId);
    claims[dealId] = await fetchAllRowsByColumn(sb, 'claims', 'deal_id', dealId);
    parser_regions[dealId] = await fetchAllRowsByColumn(sb, 'parser_regions', 'deal_id', dealId);
  }
  const payload = { dumpedAt: new Date().toISOString(), dealIds, deals, provisions, provision_cards, claims, parser_regions };
  fs.writeFileSync(backupPath, JSON.stringify(payload, null, 2));
  return payload;
}

// The only writes this tool ever performs: INSERT into parser_regions, then
// INSERT into provision_cards, per deal in that order (all region inserts
// first, then all card inserts). Rerun-reuse entries skip the region insert
// and anchor to the pre-existing region id. Any insert error aborts the
// REMAINDER of that deal (recorded in dealErrors) without touching other
// deals — per-deal all-or-nothing is preserved on the failure side; rows
// already inserted for a failed deal are recoverable via the backup.
async function executeWrites(sb, runPlan) {
  let minted = 0;
  let regionsInserted = 0;
  let regionsReused = 0;
  const dealErrors = [];

  for (const dealPlan of runPlan.dealPlans) {
    if (!dealPlan.ok) continue;
    const entries = dealPlan.entries.filter((e) => e.status === 'MINTED');
    if (entries.length === 0) continue;

    try {
      // Phase 1: all region inserts (or reuses) for this deal.
      for (const e of entries) {
        if (e.write.reuseRegionId) {
          e.write.cardRow.region_id = e.write.reuseRegionId;
          regionsReused += 1;
          continue;
        }
        const { data, error } = await sb
          .from('parser_regions')
          .insert(e.write.regionRow)
          .select('id')
          .single();
        if (error) throw new Error(`parser_regions insert failed (provision ${e.provisionId}): ${error.message}`);
        if (!data || !data.id) throw new Error(`parser_regions insert returned no id (provision ${e.provisionId})`);
        e.write.cardRow.region_id = data.id;
        regionsInserted += 1;
      }

      // Phase 2: all card inserts for this deal.
      const rows = entries.map((e) => e.write.cardRow);
      const { error } = await sb.from('provision_cards').insert(rows);
      if (error) throw new Error(`provision_cards insert failed (deal ${dealPlan.dealId}): ${error.message}`);
      minted += rows.length;
    } catch (err) {
      dealErrors.push({ dealId: dealPlan.dealId, error: err.message });
      // Abort the remainder of this deal; other deals proceed.
    }
  }

  return { minted, regionsInserted, regionsReused, dealErrors };
}

function writeReportFile(report) {
  const dir = path.join(__dirname, '..', '..', 'reports');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(dir, `mint-cards-${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify(report, null, 2));
  return file;
}

/* ── main ────────────────────────────────────────────────────────────────── */

async function main() {
  loadDotEnvLocal();
  const args = parseArgs(process.argv);

  const gate = checkBackupGate(args, fs.existsSync);
  if (!gate.ok) {
    console.error(gate.reason);
    process.exit(1);
  }

  const { createClient } = require('@supabase/supabase-js');
  const dbUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!dbUrl || !key) { console.error('Supabase creds required (env / .env.local).'); process.exit(1); }
  const sb = createClient(dbUrl, key);

  const dealIds = await fetchDealIds(sb, args);
  console.log(`mint-cards — ${dealIds.length} deal(s), ${args.apply ? 'APPLY' : 'dry-run'}`);

  // Order of operations under --apply: backup FIRST, before target
  // selection / post-mint verification (which happen while building the
  // plan below), then verify, then (only if clean) write — mirrors
  // prune-cards.js exactly.
  if (args.apply) {
    try {
      await dumpBackup(sb, dealIds, args.backup);
      console.log(`Backup written: ${args.backup}`);
    } catch (err) {
      console.error(err.message);
      process.exit(1);
    }
  }

  const dealDataById = {};
  for (const dealId of dealIds) {
    const [cards, provisions, regions] = await Promise.all([
      fetchCardsForDeal(sb, dealId),
      fetchProvisionsForDeal(sb, dealId),
      fetchRegionsForDeal(sb, dealId),
    ]);
    dealDataById[dealId] = { cards, provisions, regions };
  }

  const runPlan = buildRunPlan(dealIds, dealDataById);
  console.log(formatRunReport(runPlan));

  // The full dealPlans embed whole provision/card/region rows (raw text and
  // ai_metadata) — serializing them verbatim produced 160 MB report files.
  // The persisted report carries a slim projection; the full objects stay
  // in-memory only.
  const slimEntry = (e) => ({
    provisionId: e.provision ? e.provision.id : (e.provisionId || null),
    category: e.provision ? e.provision.category : (e.category || null),
    type: e.provision ? e.provision.type : (e.type || null),
    status: e.status,
    codedKeys: e.codedKeys || null,
    textLen: e.provision && typeof e.provision.full_text === 'string' ? e.provision.full_text.length : null,
    excerptId: e.cardRow ? e.cardRow.excerpt_id : null,
    regionKey: e.regionRow ? e.regionRow.region_key : null,
  });
  const report = {
    generatedAt: new Date().toISOString(),
    apply: args.apply,
    summary: summarize(runPlan),
    deals: runPlan.dealPlans.map((dp) => ({
      dealId: dp.dealId,
      ok: dp.ok,
      entries: (dp.entries || []).map(slimEntry),
    })),
  };

  if (args.json) console.log(JSON.stringify(report, null, 2));

  const reportDb = resolveReportDbFlag(args);

  if (!args.apply) {
    console.log('\nDry-run complete: no writes. Re-run with --apply --backup <path> to commit.');
    writeReportFile(report);
    if (reportDb) {
      await persistReport(sb, {
        kind: 'mint-cards',
        generatedAt: report.generatedAt,
        summary: { ...report.summary, apply: false },
        payload: report,
      });
    }
    return;
  }

  const result = await executeWrites(sb, runPlan);
  console.log(`Executed: minted ${result.minted} card(s), inserted ${result.regionsInserted} region(s), reused ${result.regionsReused} region(s).`);
  for (const de of result.dealErrors) {
    console.error(`  ! deal ${de.dealId}: aborted mid-mint — ${de.error} (restore from backup if partial rows landed)`);
  }
  report.executed = result;
  const reportFile = writeReportFile(report);
  console.log(`Report written: ${reportFile}`);
  if (reportDb) {
    await persistReport(sb, {
      kind: 'mint-cards',
      generatedAt: report.generatedAt,
      summary: { ...report.summary, apply: true, dealErrors: result.dealErrors.length },
      payload: report,
    });
  }
  if (result.dealErrors.length > 0) process.exitCode = 1;
}

module.exports = {
  codedFeatureKeys,
  mintRegionKey,
  buildMintedRegionRow,
  buildMintedCardRow,
  selectMintCandidates,
  applyRegionHashGuards,
  runPostMintCheck,
  buildDealMintPlan,
  buildRunPlan,
  plannedInserts,
  summarize,
  checkBackupGate,
  formatDealTable,
  formatRunReport,
  dumpBackup,
  fetchAllRowsByColumn,
  executeWrites,
  parseArgs,
};

if (require.main === module) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
