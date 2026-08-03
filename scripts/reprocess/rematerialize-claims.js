#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────
   scripts/reprocess/rematerialize-claims.js — claims-only rematerialize
   (GAP-A/GAP-B).

   scripts/reprocess.js writes `provisions` only; `claims` (what the review
   UI actually reads, see lib/queries/claims-adapter.js) go stale after a
   type refresh. This script re-runs the EXISTING claim writer
   (lib/parser-v2/store-claims.js) for one or more deals WITHOUT rewriting
   any `provision_cards` row — it only needs to figure out, deterministically,
   which stored `provisions` row now corresponds to each existing
   `provision_cards` row.

   Match ladder (per deal, per provision_type bucket):
     1. unique short_title === category
     2. unique exact region_full_text === full_text
     3. unique normalizeHead(region_full_text) === normalizeHead(full_text)

   The ladder never guesses: any leftover ambiguity, or any unmatched
   provision that carries coded (taxonomy-tagged) features, is a hard stop —
   the whole run exits 1 and writes nothing, even under --apply.

   DRY-RUN IS THE DEFAULT: prints the full plan, writes nothing. --apply
   performs the writes (claims upsert + stale-claim cleanup on matched cards
   only), and only if every requested deal cleared the ladder with zero
   ambiguities and zero coverage failures.

   Usage:
     node scripts/reprocess/rematerialize-claims.js --deal <uuid>[,<uuid>...]
     node scripts/reprocess/rematerialize-claims.js --deal <uuid> --apply
     node scripts/reprocess/rematerialize-claims.js --all --json
   ───────────────────────────────────────────────────────────────────────── */

const fs = require('fs');
const path = require('path');
const { FEATURES } = require('../../lib/schema/features');
const {
  atomicValues,
  buildClaimRowsForCard,
  upsertClaims,
  deleteStaleClaimsForSurvivors,
} = require('../../lib/parser-v2/store-claims');
const { provisionType } = require('../../lib/parser-v2/store-cards');
const { persistReport, resolveReportDbFlag } = require('../../lib/reports/persist-report');

/* ── pure helpers (exported for tests — no DB, no LLM) ───────────────────── */

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function trimmedOrNull(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

// Strips a leading section-heading line: "Section 5.02 No Solicitation. ",
// "SECTION 5.02. ", etc. — anything from the start through the first period
// that is followed by whitespace, provided the line opens with the word
// "Section" (any case). No heading present -> no-op.
function stripHeading(s) {
  const m = s.match(/^(?:SECTION|Section)\s+[0-9]+(?:\.[0-9]+)*(?:\([A-Za-z0-9]+\))*\s*[^\n]*?\.\s+/);
  return m ? s.slice(m[0].length) : s;
}

// Repeatedly strips leading subsection markers: "(a) ", "(i) ", "(A) ",
// "(1) ", and bare pinpoint refs like "5.02(f) " or "5.02 ".
function stripLeadingMarkers(s) {
  let out = s;
  for (;;) {
    let m = out.match(/^\([A-Za-z0-9]+\)\s*/);
    if (m) { out = out.slice(m[0].length); continue; }
    m = out.match(/^[0-9]+(?:\.[0-9]+)+(?:\([A-Za-z0-9]+\))?\s*/);
    if (m) { out = out.slice(m[0].length); continue; }
    break;
  }
  return out;
}

// Strips a leading sub-heading PHRASE like "No Change in Company Board
// Recommendation or Entry into an Alternative Acquisition Agreement. " /
// "Certain Disclosures. " / "Notice. " — a short capitalized phrase ending
// in a period that contains no operative verb. Provision full_text often
// carries these where the matching card text starts at the operative words,
// which defeated head comparison (corpus run 2026-07-13). Deterministic:
// both sides are normalized identically, and the unique-both-sides rule
// still guards against collisions.
const HEADING_VERBS = /\b(shall|will|may|must|agree|agrees|is|are|was|were|has|have|hereby)\b/i;
function stripHeadingPhrase(s) {
  const m = s.match(/^([A-Z][^.!?]{0,120})\.\s+/);
  if (m && !HEADING_VERBS.test(m[1])) return s.slice(m[0].length);
  return s;
}

// Normalizes a provision/card text down to a comparable "head": strips the
// section heading line, any leading subsection markers, and any leading
// sub-heading phrases, lowercases, collapses whitespace, and takes the
// first 200 characters. (Longer heads were tried and regress: a side whose
// whole normalized text is shorter than the window can never equal a longer
// head — reciprocal/short/elided cases are rung 5's job instead.)
function normalizeHead(text) {
  if (typeof text !== 'string') return '';
  let s = text.trim();
  if (!s) return '';
  s = stripHeading(s);
  for (;;) {
    const before = s;
    s = stripLeadingMarkers(s);
    s = stripHeadingPhrase(s);
    if (s === before) break;
  }
  s = s.toLowerCase().replace(/\s+/g, ' ').trim();
  return s.slice(0, 200);
}

// Full-text normalization for the containment rung: same stripping as the
// head, no truncation.
function normalizeFull(text) {
  if (typeof text !== 'string') return '';
  return text.trim().toLowerCase().replace(/\s+/g, ' ').trim();
}

// Rung 5 — unique fragment containment. Card region text is often an
// assembled excerpt (sometimes with " ... " elisions) of one provision's
// full_text. A card matches iff EVERY ellipsis-separated fragment of its
// normalized text appears in exactly ONE unmatched provision's normalized
// full text, AND that provision contains exactly one such card
// (unique-both-sides — never a guess).
function containmentFragments(text) {
  if (typeof text !== 'string') return [];
  return text
    .split(/\s*(?:\.\.\.|…)\s*/)
    .map((f) => normalizeFull(stripLeadingMarkers(stripHeading(f.trim()))))
    .filter((f) => f.length >= 20);
}

function applyContainmentRung(cardsPool, provisionsPool) {
  const provFull = new Map(provisionsPool.map((p) => [p, normalizeFull(p.full_text)]));
  const candidates = new Map(); // card -> [provisions containing all fragments]
  for (const c of cardsPool) {
    const frags = containmentFragments(c.region_full_text);
    if (!frags.length) continue;
    const hits = provisionsPool.filter((p) => frags.every((f) => provFull.get(p).includes(f)));
    if (hits.length === 1) candidates.set(c, hits[0]);
  }
  const provCounts = new Map();
  for (const p of candidates.values()) provCounts.set(p, (provCounts.get(p) || 0) + 1);
  const matches = [];
  // Track matched CARDS/PROVISIONS by object reference, not by .id. Freshly
  // minted rows (mint-cards.js, pre-insert) have no .id yet — the DB
  // assigns it on insert — so an id-keyed Set collapsed every id-less card
  // to the single key `undefined` after the first match, silently evicting
  // every other still-unmatched id-less card from the pool before the next
  // rung ran. Reference tracking has no such collision (also immune to a
  // hypothetical duplicate id). Existing corpus flows never hit this
  // because DB-loaded cards always carry a real id.
  const matchedCards = new Set();
  const matchedProvisions = new Set();
  for (const [c, p] of candidates.entries()) {
    if (provCounts.get(p) !== 1) continue;
    matches.push({ card: c, provision: p, rung: 5, key: `contain:${p.id}` });
    matchedCards.add(c);
    matchedProvisions.add(p);
  }
  return {
    matches,
    remainingCards: cardsPool.filter((c) => !matchedCards.has(c)),
    remainingProvisions: provisionsPool.filter((p) => !matchedProvisions.has(p)),
  };
}

function groupBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

// Applies one rung of the ladder to a pool of unmatched cards/provisions.
// Only keys that resolve to exactly one card AND exactly one provision are
// matched; everything else (including keys absent on one side) is left in
// the pool for the next rung.
function applyRung(cardsPool, provisionsPool, cardKeyFn, provKeyFn, rung) {
  const cardMap = groupBy(cardsPool, cardKeyFn);
  const provMap = groupBy(provisionsPool, provKeyFn);
  // Reference tracking, not .id tracking — see the comment in
  // applyContainmentRung above for why: id-less (pre-insert) cards would
  // otherwise all collapse to the Set key `undefined` after the first
  // match and vanish from every later rung's pool.
  const matchedCards = new Set();
  const matchedProvisions = new Set();
  const matches = [];
  for (const [key, cGroup] of cardMap.entries()) {
    const pGroup = provMap.get(key);
    if (pGroup && cGroup.length === 1 && pGroup.length === 1) {
      matches.push({ card: cGroup[0], provision: pGroup[0], rung, key });
      matchedCards.add(cGroup[0]);
      matchedProvisions.add(pGroup[0]);
    }
  }
  return {
    matches,
    remainingCards: cardsPool.filter((c) => !matchedCards.has(c)),
    remainingProvisions: provisionsPool.filter((p) => !matchedProvisions.has(p)),
  };
}

const RUNG_DEFS = [
  { rung: 1, name: 'title', cardKey: (c) => trimmedOrNull(c.short_title), provKey: (p) => trimmedOrNull(p.category) },
  { rung: 2, name: 'text', cardKey: (c) => trimmedOrNull(c.region_full_text), provKey: (p) => trimmedOrNull(p.full_text) },
  // Tie-break: identical text stored under two categories (deliberate
  // double-categorization) — pair the one whose title also agrees.
  {
    rung: 3,
    name: 'text+title',
    cardKey: (c) => (trimmedOrNull(c.region_full_text) && trimmedOrNull(c.short_title))
      ? `${trimmedOrNull(c.region_full_text)} ${trimmedOrNull(c.short_title)}` : null,
    provKey: (p) => (trimmedOrNull(p.full_text) && trimmedOrNull(p.category))
      ? `${trimmedOrNull(p.full_text)} ${trimmedOrNull(p.category)}` : null,
  },
  { rung: 4, name: 'head', cardKey: (c) => normalizeHead(c.region_full_text) || null, provKey: (p) => normalizeHead(p.full_text) || null },
];

// Matches all cards/provisions of a SINGLE (deal, type) bucket. Returns
// { matches, ambiguities, unmatchedCards, unmatchedProvisions }.
// `matches` entries: { card, provision, rung, key }.
// `ambiguities` entries: { rung, key, cardIds, provisionIds } — a key that,
// after the FULL ladder ran, still maps to more than one card or more than
// one provision (including "same provision claimed by two cards").
function matchTypeBucket(cards, provisions) {
  const matches = [];
  let remCards = cards;
  let remProvisions = provisions;

  for (const { rung, cardKey, provKey } of RUNG_DEFS) {
    const result = applyRung(remCards, remProvisions, cardKey, provKey, rung);
    matches.push(...result.matches);
    remCards = result.remainingCards;
    remProvisions = result.remainingProvisions;
  }

  {
    const result = applyContainmentRung(remCards, remProvisions);
    matches.push(...result.matches);
    remCards = result.remainingCards;
    remProvisions = result.remainingProvisions;
  }

  const ambiguities = [];
  for (const { rung, cardKey, provKey } of RUNG_DEFS) {
    const cardMap = groupBy(remCards, cardKey);
    const provMap = groupBy(remProvisions, provKey);
    for (const [key, cGroup] of cardMap.entries()) {
      const pGroup = provMap.get(key);
      if (pGroup && (cGroup.length > 1 || pGroup.length > 1)) {
        ambiguities.push({
          rung,
          key,
          cardIds: cGroup.map((c) => c.id),
          provisionIds: pGroup.map((p) => p.id),
        });
      }
    }
  }

  return { matches, ambiguities, unmatchedCards: remCards, unmatchedProvisions: remProvisions };
}

// Matches every card to at most one provision, and vice versa, WITHIN the
// same type bucket. provision_cards.provision_type carries CARD-MODEL types
// (COVENANT_NO_SOLICITATION, TERMINATION_FEE, ...) while provisions.type
// carries RUBRIC types (NOSOL, TERMF, REP-T, ...) — disjoint vocabularies.
// Provisions are therefore mapped through the SAME provisionType() helper
// store-cards.js used to mint provision_type at ingest (baseType + TYPE_MAP,
// unknowns -> MISC_BOILERPLATE), so the bucket predicate mirrors how the
// cards were created. A provisions row carries `type`, which provisionType()
// reads directly. Returns the union across all buckets present in either
// input.
function matchCardsToProvisions(cards, provisions) {
  const provisionTypeOf = new Map(provisions.map((p) => [p, provisionType(p)]));
  const types = new Set([
    ...cards.map((c) => c.provision_type),
    ...provisionTypeOf.values(),
  ]);

  const matches = [];
  const ambiguities = [];
  const unmatchedCards = [];
  const unmatchedProvisions = [];

  for (const type of types) {
    const bucketCards = cards.filter((c) => c.provision_type === type);
    const bucketProvisions = provisions.filter((p) => provisionTypeOf.get(p) === type);
    const result = matchTypeBucket(bucketCards, bucketProvisions);
    matches.push(...result.matches);
    ambiguities.push(...result.ambiguities.map((a) => ({ ...a, type })));
    unmatchedCards.push(...result.unmatchedCards);
    unmatchedProvisions.push(...result.unmatchedProvisions);
  }

  return { matches, ambiguities, unmatchedCards, unmatchedProvisions };
}

// Does a `feature -> raw value` pair carry a taxonomy-coded value that the
// claim writer would materialise into claims.canonical? Decided by the
// writer itself: a feature is coded iff its registry entry is a tag-family
// list (listItemTagFamily set — a wired family belongs on this provision
// even if this extraction returned no codes), or atomicValues() (the exact
// routine store-claims.js uses) yields any atom with a non-null canonical.
// Shape-sniffing for {code,label,text} is deliberately NOT used here: plain
// citable values ({text, value, quotes}) carry a `text` key without being
// coded, and would false-positive.
function provisionHasCodedFeatures(provision) {
  const features = provision && provision.ai_metadata && provision.ai_metadata.features;
  if (!features || typeof features !== 'object') return false;
  for (const [key, value] of Object.entries(features)) {
    const registryEntry = FEATURES[key];
    if (registryEntry && registryEntry.listItemTagFamily) return true;
    if (!registryEntry) continue; // unknown keys never materialise
    if (atomicValues(value, registryEntry).some((atom) => atom.canonical != null)) return true;
  }
  return false;
}

function attachExactTextSupplements(matches, unmatchedProvisions) {
  const matchesBySource = groupBy(matches, ({ card }) => {
    const text = trimmedOrNull(card.region_full_text);
    return text ? `${card.provision_type}\0${text}` : null;
  });
  const supplementalMatches = [];
  const remainingProvisions = [];
  for (const provision of unmatchedProvisions) {
    const text = trimmedOrNull(provision.full_text);
    const key = text ? `${provisionType(provision)}\0${text}` : null;
    const candidates = key ? matchesBySource.get(key) : null;
    if (!candidates || candidates.length !== 1) {
      remainingProvisions.push(provision);
      continue;
    }
    supplementalMatches.push({
      card: candidates[0].card,
      provision,
      primaryProvision: candidates[0].provision,
      matchKind: 'exact-text-supplement',
    });
  }
  return { supplementalMatches, remainingProvisions };
}

// Builds the full per-deal plan: match ladder + coverage check. Never
// touches the network. `cards` / `provisions` are the raw rows selected for
// one deal.
function buildDealPlan(dealId, cards, provisions, options = {}) {
  const matchResult = matchCardsToProvisions(cards, provisions);
  const { supplementalMatches, remainingProvisions: unmatchedProvisions } = attachExactTextSupplements(
    matchResult.matches,
    matchResult.unmatchedProvisions,
  );
  const { matches, ambiguities, unmatchedCards } = matchResult;

  const coverageFailures = unmatchedProvisions
    .filter(provisionHasCodedFeatures)
    .map((p) => ({ provisionId: p.id, type: p.type, category: p.category }));

  const runId = options.runId || `rematerialize-claims-${Date.now()}`;
  const claimOptions = { extractorName: 'rematerialize-claims', runId };

  const claimRows = [];
  const claimIds = new Set();
  const unknownAttributes = [];
  for (const { card, provision } of [...matches, ...supplementalMatches]) {
    const perProvisionOptions = {
      ...claimOptions,
      // provisions carries no extraction_version/extracted_at columns —
      // version lives in ai_metadata when stamped; created_at is the row time.
      extractionVersion: (provision.ai_metadata && provision.ai_metadata.extraction_version) || null,
      extractedAt: provision.extracted_at || provision.created_at || null,
    };
    const { rows, unknownAttributes: unknown } = buildClaimRowsForCard(dealId, card, provision, perProvisionOptions);
    for (const row of rows) {
      if (claimIds.has(row.id)) continue;
      claimIds.add(row.id);
      claimRows.push(row);
    }
    unknownAttributes.push(...unknown);
  }

  const matchedExcerptIds = matches.map((m) => m.card.excerpt_id);
  const keepClaimIds = new Set(claimRows.map((r) => r.id));

  const rungCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const m of matches) rungCounts[m.rung] += 1;

  const ok = ambiguities.length === 0 && coverageFailures.length === 0;

  return {
    dealId,
    cardsTotal: cards.length,
    provisionsTotal: provisions.length,
    matches,
    supplementalMatches,
    ambiguities,
    unmatchedCards,
    unmatchedProvisions,
    coverageFailures,
    rungCounts,
    claimRows,
    unknownAttributes,
    matchedExcerptIds,
    keepClaimIds,
    ok,
  };
}

/* ── output formatting ───────────────────────────────────────────────────── */

function formatDealTable(plan) {
  const withCoded = plan.unmatchedProvisions.filter(provisionHasCodedFeatures).length;
  const withoutCoded = plan.unmatchedProvisions.length - withCoded;
  const lines = [];
  lines.push(`  cards: ${plan.cardsTotal}  provisions: ${plan.provisionsTotal}`);
  lines.push(`  matched: ${plan.matches.length} (r1: ${plan.rungCounts[1]}, r2: ${plan.rungCounts[2]}, r3: ${plan.rungCounts[3]}, r4: ${plan.rungCounts[4]}, r5: ${plan.rungCounts[5]})`);
  if (plan.supplementalMatches.length > 0) {
    lines.push(`  exact-text supplemental provisions: ${plan.supplementalMatches.length}`);
  }
  lines.push(`  unmatched cards: ${plan.unmatchedCards.length}`);
  lines.push(`  unmatched provisions: ${plan.unmatchedProvisions.length} (with coded features: ${withCoded}, without: ${withoutCoded})`);
  lines.push(`  ambiguities: ${plan.ambiguities.length}`);
  if (plan.ambiguities.length > 0) {
    for (const a of plan.ambiguities) {
      lines.push(`    ! rung ${a.rung} type ${a.type} key=${JSON.stringify(a.key).slice(0, 80)} cards=${a.cardIds.length} provisions=${a.provisionIds.length}`);
    }
  }
  if (plan.coverageFailures.length > 0) {
    lines.push(`  coverage failures: ${plan.coverageFailures.length}`);
    for (const f of plan.coverageFailures) {
      lines.push(`    ! provision ${f.provisionId} (${f.type} / ${f.category}) unmatched but carries coded features`);
    }
  }
  lines.push(`  claims to upsert: ${plan.claimRows.length}`);
  if (plan.unknownAttributes.length > 0) {
    lines.push(`  registry-unknown attributes skipped: ${[...new Set(plan.unknownAttributes)].join(', ')}`);
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
    'Usage: node scripts/reprocess/rematerialize-claims.js ' +
    '(--deal <uuid>[,<uuid>...] | --all) [--apply] [--partial] [--json] [--run-id <id>]',
  );
  process.exit(1);
}

function parseArgs(argv) {
  const args = { deals: [], all: false, apply: false, json: false, runId: null, partial: false, reportDb: null };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--deal') {
      const raw = argv[++i] || '';
      args.deals.push(...raw.split(',').map((s) => s.trim()).filter(Boolean));
    } else if (a === '--all') {
      args.all = true;
    } else if (a === '--apply') {
      args.apply = true;
    } else if (a === '--partial') {
      args.partial = true;
    } else if (a === '--json') {
      args.json = true;
    } else if (a === '--run-id') {
      args.runId = argv[++i];
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

async function fetchDeals(sb, args) {
  let query = sb.from('deals').select('id, acquirer, target');
  if (!args.all) query = query.in('id', args.deals);
  const { data, error } = await query;
  if (error) throw new Error(`Deal fetch failed: ${error.message}`);
  if (!data || data.length === 0) {
    throw new Error(args.all ? 'No deals in the corpus.' : `No deal(s) found for id(s): ${args.deals.join(', ')}`);
  }
  return data;
}

async function fetchProvisions(sb, dealId) {
  const { data, error } = await sb
    .from('provisions')
    .select('id, type, category, full_text, ai_metadata, created_at')
    .eq('deal_id', dealId);
  if (error) throw new Error(`Provision fetch failed: ${error.message}`);
  return data || [];
}

async function fetchCards(sb, dealId) {
  const { data, error } = await sb
    .from('provision_cards')
    .select('id, excerpt_id, provision_instance_id, region_id, provision_type, short_title, region_full_text')
    .eq('deal_id', dealId);
  if (error) throw new Error(`Card fetch failed: ${error.message}`);
  return data || [];
}

async function writeDealClaims(sb, plan) {
  await upsertClaims(sb, plan.claimRows);
  const staleDeleted = await deleteStaleClaimsForSurvivors(
    sb,
    plan.dealId,
    plan.matchedExcerptIds,
    plan.keepClaimIds,
  );
  return staleDeleted;
}

function writeReportFile(report) {
  const dir = path.join(__dirname, '..', '..', 'reports');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(dir, `rematerialize-claims-${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify(report, null, 2));
  return file;
}

function planToReportEntry(deal, plan) {
  return {
    dealId: plan.dealId,
    acquirer: deal.acquirer || null,
    target: deal.target || null,
    cardsTotal: plan.cardsTotal,
    provisionsTotal: plan.provisionsTotal,
    matched: plan.matches.length,
    supplementalMatches: plan.supplementalMatches.length,
    rungCounts: plan.rungCounts,
    unmatchedCards: plan.unmatchedCards.length,
    unmatchedProvisions: plan.unmatchedProvisions.length,
    ambiguities: plan.ambiguities,
    coverageFailures: plan.coverageFailures,
    claimsToUpsert: plan.claimRows.length,
    ok: plan.ok,
  };
}

async function main() {
  loadDotEnvLocal();
  const args = parseArgs(process.argv);

  const { createClient } = require('@supabase/supabase-js');
  const dbUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!dbUrl || !key) { console.error('Supabase creds required (env / .env.local).'); process.exit(1); }
  const sb = createClient(dbUrl, key);

  const deals = await fetchDeals(sb, args);
  console.log(`Rematerialize claims — ${deals.length} deal(s), ${args.apply ? 'APPLY' : 'dry-run'}`);

  const plans = [];
  for (const deal of deals) {
    console.log(`\n═══ ${deal.acquirer || '?'} / ${deal.target || '?'} (${deal.id}) ═══`);
    const [provisions, cards] = await Promise.all([
      fetchProvisions(sb, deal.id),
      fetchCards(sb, deal.id),
    ]);
    const plan = buildDealPlan(deal.id, cards, provisions, { runId: args.runId });
    console.log(formatDealTable(plan));
    plans.push({ deal, plan });
  }

  const anyFailed = plans.some(({ plan }) => !plan.ok);
  const report = {
    generatedAt: new Date().toISOString(),
    apply: args.apply,
    ok: !anyFailed,
    deals: plans.map(({ deal, plan }) => planToReportEntry(deal, plan)),
  };

  console.log('\n── summary ──');
  console.log(`  ${plans.length} deal(s), ${plans.filter(({ plan }) => plan.ok).length} clean, ${plans.filter(({ plan }) => !plan.ok).length} with ambiguity/coverage failures`);

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  }

  if (anyFailed && !args.partial) {
    console.error('\nAmbiguity or coverage failure detected — exiting 1, writing nothing.');
    console.error('(To materialize the unambiguous matches anyway and report the rest, re-run with --partial.)');
    process.exitCode = 1;
    return;
  }
  if (anyFailed && args.partial) {
    // --partial: claimRows/matchedExcerptIds are built from unique-rung
    // matches ONLY, so writing them involves no guessing. Ambiguous cards are
    // untouched (their claims stay stale until a prune resolves the dup) and
    // card-less coded provisions are reported as the per-deal card-less
    // count. This is the corpus mode; the strict default is the pilot
    // acceptance mode.
    console.log('\n--partial: materializing unambiguous matches; ambiguities and card-less provisions reported, not written.');
  }

  if (!args.apply) {
    console.log('\nDry-run complete: no writes. Re-run with --apply to commit.');
    return;
  }

  for (const { plan } of plans) {
    const staleDeleted = await writeDealClaims(sb, plan);
    plan.staleDeleted = staleDeleted;
    console.log(`  deal ${plan.dealId}: upserted ${plan.claimRows.length} claim(s), deleted ${staleDeleted} stale claim(s).`);
  }

  report.deals = plans.map(({ deal, plan }) => ({ ...planToReportEntry(deal, plan), staleDeleted: plan.staleDeleted }));
  const reportFile = writeReportFile(report);
  console.log(`\nReport written: ${reportFile}`);

  if (resolveReportDbFlag(args)) {
    const summary = {
      dealCount: report.deals.length,
      cleanCount: report.deals.filter((d) => d.ok).length,
      failedCount: report.deals.filter((d) => !d.ok).length,
      apply: report.apply,
      pass: report.ok,
    };
    await persistReport(sb, { kind: 'rematerialize-claims', generatedAt: report.generatedAt, summary, payload: report });
  }
}

module.exports = {
  normalizeHead,
  matchCardsToProvisions,
  matchTypeBucket,
  provisionHasCodedFeatures,
  buildDealPlan,
  formatDealTable,
  parseArgs,
  // Additive (SPEC-MECHANICAL-HARDENING-2026-07-23 part A): DB fetch + write
  // entry points, previously CLI-local, now exported so scripts/reprocess.js
  // can drive the SAME planner/writer under --rematerialize instead of
  // reimplementing the fetch/write logic. No behavior change to these
  // functions or to this file's own CLI path (main() below still calls them
  // exactly as before).
  fetchProvisions,
  fetchCards,
  writeDealClaims,
};

if (require.main === module) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
