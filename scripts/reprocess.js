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

   Claims rematerialize (DATA-1/GAP-A — ON by default since Ben's 2026-07-23
   sign-off): dry-run also prints the claims rematerialize PLAN
   (scripts/reprocess/rematerialize-claims.js, read-only); --apply runs the
   rematerialize WRITE path for exactly the reprocessed deal ids, STRICT by
   default (any ambiguity/coverage failure ⇒ exit 1, writes nothing —
   extraction writes above are already committed, so claims stay stale until
   a manual rerun). --no-rematerialize restores the old warn-only behavior;
   --rematerialize-partial maps onto rematerialize-claims.js's own --partial.

   LLM calls go through the injectable CLI client (lib/llm-cli-client.js) —
   Claude Max / ChatGPT subscription, zero API tokens. Credentials from
   env / .env.local, same as ingest-local.

   ─── v1 reclassification (2026-08-02) apply order — DOCUMENTED HERE, NOT
   EXECUTED by the code-only build slice (docs/superpowers/specs/
   2026-08-02-v1-reclassification-design.md §4, audit A-C3: reprocess.js
   NEVER writes cards). Ben gates every step below in the morning; run in
   this exact per-deal order, comparator-fixture deals FIRST
   (TopBuild/Skechers/Modiv, hand-verified), then the corpus:

     1. node scripts/reprocess.js --deal <name> --classify-only --apply
        --v1-reclass
        (rewrites only the reviewed, identity-pinned classifications)
     2. node scripts/reprocess.js --deal <name> --types REP-T,REP-B,MISC
        --apply --no-rematerialize --v1-reclass
        (re-extracts the parent types — R3 cards live under MISC_BOILERPLATE
        too; the anti-reliance element scan runs inside this step)
     3. node scripts/backfill/extract-to-cards.js --deal <id> --apply
        --extraction-version m2-01-reclass-v1
        (the ONLY production card writer — its upsert/replaceDeal semantics
        are what the scout verified; the extraction_version label MUST be
        bumped for this pass so the comparator's isComparisonReceiptStale
        fires on pre-reclass receipts — see extract-to-cards.js's
        DEFAULT_EXTRACTION_VERSION comment)
     4. node scripts/reprocess/rematerialize-claims.js --deal <id>
        followed by the same command with --apply after the dry-run is clean

   Pre-write safety gate: scripts/safety-check-reclass-rules.js must be
   green (pinned flip set) before step 1 runs for the corpus; the 29-card
   AI-only-split hand review (REP-T-CONSENT / REP-T-REGSTATUS populations)
   is a manual review against the ruling doc, recorded in the slice's dated
   handoff, and gates step 2 for those specific cards.
   ───────────────────────────────────────────────────────────────────────── */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PROVISION_TYPES } = require('../lib/rubric');
const {
  toCompactSections,
  buildPriorLookup,
  classifyBreakdown,
  diffClassifications,
} = require('../lib/parser-v2/snapshot');
const { attachRegionIdsToSections, persistParserRegions } = require('../lib/parser-v2/region-store');
const { MODEL_READONLY_KEYS } = require('../lib/schema/prompt');
const {
  V1_RECLASS_EXTRACTION_VERSION,
  V1_FIXTURE_DEAL_IDS,
  EXPECTED_R1R2_FLIPS,
  R1R2_CARD_RULINGS,
  V1_RECLASSIFICATION_PIN_TARGETS,
} = require('./reprocess/v1-reclassification-pins');

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

/* ── EXT-4 guard: per-type reprocess vs. cross-type post-pass features ───────
   REP runs now rejoin stored Knowledge definitions before writing, so their
   MODEL_READONLY knowledge fields are rebuilt. COND citedProvisionNames
   still depends on other provision families and remains unsafe here. */
const CROSS_TYPE_POST_PASS_FEATURES = {
  // resolveCondCitedProvisionNames (extract.js:6380) — stamped onto any
  // provision whose type starts with "COND" (COND, COND-M, COND-B, COND-S).
  citedProvisionNames: ['COND', 'COND-M', 'COND-B', 'COND-S'],
};

/**
 * Given the requested --types (already validated/uppercased, pre-group-
 * expansion), returns the list of { feature, types } conflicts where a
 * requested type (after group expansion, e.g. COND -> COND-M/COND-B/COND-S)
 * would strip a MODEL_READONLY cross-type post-pass feature. Empty array
 * means the per-type reprocess is safe (e.g. NOSOL/MISC/TERMF — the happy
 * path — never conflicts).
 */
function stripRiskConflicts(types) {
  const requested = new Set();
  for (const t of types || []) {
    for (const g of expandGroup(t)) requested.add(g);
  }
  const conflicts = [];
  for (const [feature, affectedTypes] of Object.entries(CROSS_TYPE_POST_PASS_FEATURES)) {
    // Only guard features that are actually locked (MODEL_READONLY) today —
    // if a feature is ever promoted off that list, per-type reprocess could
    // legitimately repopulate it and this guard should stand down for it.
    if (!MODEL_READONLY_KEYS.has(feature)) continue;
    const hitTypes = affectedTypes.filter((t) => requested.has(t));
    if (hitTypes.length > 0) conflicts.push({ feature, types: hitTypes });
  }
  return conflicts;
}

/** Human-readable refusal message for a non-empty stripRiskConflicts() result. */
function formatStripRiskError(conflicts) {
  const lines = conflicts.map(
    (c) => `  - "${c.feature}" (MODEL_READONLY) is populated only by the all-types cross-type ` +
      `post-pass and would be permanently stripped from: ${c.types.join(', ')}`,
  );
  return (
    `Refusing per-type --apply reprocess: it would unrecoverably strip cross-type ` +
    `post-pass feature(s):\n${lines.join('\n')}\n` +
    `Re-run with --allow-strip to override (data loss is permanent for MODEL_READONLY ` +
    `keys until a full all-types re-ingest), or use a full all-types reprocess/ingest instead.`
  );
}

/* ── DATA-1 (GAP-A) end-of-run warning ────────────────────────────────────── */

/**
 * Prominent warning printed after a per-type --apply extraction (not
 * --classify-only), naming the exact rematerialize command to run. This
 * script writes `provisions` only — `claims` (what the review UI and
 * precedent search actually read) go stale immediately and stay stale until
 * scripts/reprocess/rematerialize-claims.js is run by hand. See
 * reports/CODEBASE-REVIEW-2026-07-15.md DATA-1 — wiring it in automatically
 * is a bigger decision left to Ben; this only makes the gap loud.
 */
function formatRematerializeWarning(dealIds) {
  const ids = (dealIds || []).join(',');
  return (
    '\n' +
    '⚠ ⚠ ⚠  WARNING: claims are NOT materialized by this run  ⚠ ⚠ ⚠\n' +
    'This --apply reprocess wrote `provisions` only. `claims` (what the review UI\n' +
    'and precedent search actually read) are now STALE for the deal(s) above and\n' +
    'will keep serving old codes until you rematerialize them. Run:\n' +
    '\n' +
    `  node scripts/reprocess/rematerialize-claims.js --deal ${ids} --apply\n` +
    '\n' +
    '(dry-run first without --apply to review the plan). This does NOT happen\n' +
    'automatically — ship nothing as "done" until that command has been run.\n'
  );
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

function pinTextHash(text) {
  return crypto.createHash('sha256').update(String(text || '')).digest('hex');
}

function buildV1ReclassificationPinMap() {
  const pins = new Map();
  const expectedCodes = new Map();
  for (const [dealPrefix, sectionNumber, targetCode] of EXPECTED_R1R2_FLIPS) {
    expectedCodes.set(`${dealPrefix}|${sectionNumber}`, targetCode);
  }
  for (const [, dealPrefix, sectionNumber, targetCode] of R1R2_CARD_RULINGS) {
    const key = `${dealPrefix}|${sectionNumber}`;
    const existing = expectedCodes.get(key);
    if (existing && existing !== targetCode) {
      throw new Error(`Conflicting v1 reclassification pin for ${key}: ${existing} vs ${targetCode}`);
    }
    expectedCodes.set(key, targetCode);
  }
  for (const [dealPrefix, sectionNumber, targetCode, title, textHash] of V1_RECLASSIFICATION_PIN_TARGETS) {
    const key = `${dealPrefix}|${sectionNumber}`;
    if (expectedCodes.get(key) !== targetCode) {
      throw new Error(`v1 reclassification identity pin disagrees with ruling for ${key}`);
    }
    if (pins.has(key)) throw new Error(`Duplicate v1 reclassification identity pin for ${key}`);
    pins.set(key, { code: targetCode, type: 'REP-T', title, textHash });
  }
  if (pins.size !== expectedCodes.size) throw new Error('Missing v1 reclassification identity pin');
  return pins;
}

function applyV1ReclassificationPins(dealId, compact, pins = buildV1ReclassificationPinMap()) {
  const dealPrefix = String(dealId || '').slice(0, 8);
  const rows = compact || [];
  const dealPins = [...pins.entries()].filter(([key]) => key.startsWith(`${dealPrefix}|`));
  for (const [key, pin] of dealPins) {
    const sectionNumber = key.slice(dealPrefix.length + 1);
    const matches = rows.filter((section) => String(section.sectionNumber || '') === sectionNumber);
    if (matches.length !== 1) {
      throw new Error(`v1 pin ${key} requires exactly one snapshot section, found ${matches.length}`);
    }
    const section = matches[0];
    if (section.type !== pin.type) {
      throw new Error(`v1 pin ${key} requires ${pin.type}, found ${section.type || '(none)'}`);
    }
    if (section.title !== pin.title || pinTextHash(section.text) !== pin.textHash) {
      throw new Error(`v1 pin ${key} target identity drifted`);
    }
  }
  return rows.map((section) => {
    const key = `${dealPrefix}|${section.sectionNumber || ''}`;
    if (!pins.has(key)) return section;
    const target = pins.get(key);
    const targetCode = target.code;
    const next = { ...section, classifiedBy: 'v1-reclass-pin', confidence: 'high' };
    if (targetCode === 'OPEN_WORLD') {
      delete next.code;
      next.v1Disposition = 'OPEN_WORLD';
    } else {
      next.code = targetCode;
      delete next.v1Disposition;
    }
    return next;
  });
}

async function resolveReclassificationCompact({ deal, before, v1Reclass = false, classify, pins }) {
  if (!v1Reclass) return (await classify()).compact;
  if (!before || before.length === 0) {
    throw new Error('v1 reclassification requires an existing classified_sections snapshot for identity-pin verification');
  }
  return applyV1ReclassificationPins(deal.id, before, pins);
}

function isV1ExtractionTypeSet(types) {
  const expected = new Set(['REP-T', 'REP-B', 'MISC']);
  return Array.isArray(types) && types.length === expected.size && types.every((type) => expected.has(type));
}

function assertV1FixtureScope(deals, args) {
  if (!args?.v1Reclass) return;
  if (args.all) throw new Error('v1 fixture mode rejects --all; select one approved fixture deal.');
  if (!Array.isArray(deals) || deals.length !== 1) {
    throw new Error(`v1 fixture mode requires exactly one selected deal, found ${Array.isArray(deals) ? deals.length : 0}`);
  }
  if (!V1_FIXTURE_DEAL_IDS.includes(deals[0].id)) {
    throw new Error(`v1 fixture mode only permits TopBuild, Skechers, or Modiv (${deals[0].id})`);
  }
}

/* ── DATA-1 (GAP-A) opt-in wiring: --rematerialize ────────────────────────
   Reuses the EXISTING planner/writer exported from
   scripts/reprocess/rematerialize-claims.js (buildDealPlan / formatDealTable
   / fetchProvisions / fetchCards / writeDealClaims) rather than
   reimplementing any matching/write logic here. The rematerialize module is
   only ever required lazily (via defaultRematerializeDeps, called at the
   point of use) so a plain `reprocess.js --apply` run with --rematerialize
   absent never even touches this file, exactly like today.

   Every function below takes an optional `deps` bag (defaulting to the real
   module) precisely so tests can inject fakes without touching the real
   Supabase client or the real rematerialize-claims module. */

function defaultRematerializeDeps() {
  return require('./reprocess/rematerialize-claims');
}

/** Build a { deal, plan } entry per deal via the existing buildDealPlan — no writes. */
async function buildRematerializePlans(sb, deals, deps = defaultRematerializeDeps()) {
  const { fetchProvisions, fetchCards, buildDealPlan } = deps;
  const plans = [];
  for (const deal of deals) {
    const [provisions, cards] = await Promise.all([
      fetchProvisions(sb, deal.id),
      fetchCards(sb, deal.id),
    ]);
    plans.push({ deal, plan: buildDealPlan(deal.id, cards, provisions) });
  }
  return plans;
}

/** Print the per-deal rematerialize plan table (dry-run and pre-write in --apply). */
function printRematerializePlans(plans, deps = defaultRematerializeDeps()) {
  const { formatDealTable } = deps;
  console.log('\n── claims rematerialize plan (--rematerialize) ──');
  for (const { deal, plan } of plans) {
    console.log(`\n═══ ${deal.acquirer || '?'} / ${deal.target || '?'} (${deal.id}) ═══`);
    console.log(formatDealTable(plan));
  }
}

/**
 * --apply --rematerialize write path. STRICT by default: any ambiguity or
 * coverage failure across the selected deals exits with { ok: false } and
 * writes NOTHING (extraction writes for this run are already committed —
 * the caller is responsible for surfacing that plainly). With
 * `partial: true` (--rematerialize-partial), maps onto
 * rematerialize-claims.js's own --partial semantics: unambiguous matches are
 * written regardless, ambiguities/coverage gaps are reported not written,
 * and the run is NOT treated as a failure (same "corpus mode" convention as
 * the standalone script).
 */
async function runRematerializeApply(sb, deals, { partial = false } = {}, deps = defaultRematerializeDeps()) {
  const { writeDealClaims } = deps;
  const plans = await buildRematerializePlans(sb, deals, deps);
  printRematerializePlans(plans, deps);
  const anyFailed = plans.some(({ plan }) => !plan.ok);

  if (anyFailed && !partial) {
    console.error(
      '\n⚠ ⚠ ⚠  RUN --rematerialize FAILED (strict): ambiguity or coverage gap on the ' +
      'deal(s) above  ⚠ ⚠ ⚠\n' +
      'Writing NO claims. Extraction writes above are ALREADY COMMITTED — claims are\n' +
      'now STALE for the listed deal(s) and will keep serving old codes until this is\n' +
      'resolved by hand. Re-run:\n' +
      `\n  node scripts/reprocess/rematerialize-claims.js --deal ${deals.map((d) => d.id).join(',')} --apply --partial\n` +
      '\n(dry-run first without --apply to review the plan.)\n',
    );
    return { ok: false, plans };
  }

  if (anyFailed && partial) {
    console.log(
      '\n--rematerialize-partial: materializing unambiguous matches only; ambiguities ' +
      'and coverage gaps reported above are NOT written.',
    );
  }

  for (const { deal, plan } of plans) {
    const staleDeleted = await writeDealClaims(sb, plan);
    console.log(`  claims: deal ${deal.id} — upserted ${plan.claimRows.length}, deleted ${staleDeleted} stale.`);
  }
  console.log('\nRematerialize complete: claims are up to date for the deal(s) above.');
  return { ok: true, plans };
}

module.exports = {
  parseTypesArg,
  snapshotSectionCounts,
  deterministicEstimate,
  countsForTypes,
  formatClassifyDiff,
  classifiedByTally,
  classifyFromStoredText,
  stripRiskConflicts,
  formatStripRiskError,
  CROSS_TYPE_POST_PASS_FEATURES,
  formatRematerializeWarning,
  parseArgs,
  defaultRematerializeDeps,
  buildRematerializePlans,
  printRematerializePlans,
  runRematerializeApply,
  buildV1ReclassificationPinMap,
  applyV1ReclassificationPins,
  pinTextHash,
  resolveReclassificationCompact,
  isV1ExtractionTypeSet,
  assertV1FixtureScope,
  isV1TypeCompleteAfterClassification,
  hasPendingV1Classification,
  assertV1ApplyOrderNotBypassed,
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
    '[--backend claude|codex] [--model …] [--no-rematerialize | --rematerialize-partial] [--v1-reclass]',
  );
  process.exit(1);
}

function parseArgs(argv) {
  const args = {
    deal: null, all: false, typesRaw: [], classifyOnly: false,
    apply: false, dryRun: false, backend: 'claude', model: null, allowStrip: false,
    // DATA-1 (GAP-A): default ON per Ben's sign-off (DECISIONS 2026-07-23,
    // D1 flip-on) — --apply now rematerializes claims by default so they can
    // never silently go stale. --no-rematerialize restores the warn-only
    // behavior; --rematerialize is still accepted as an explicit no-op.
    rematerialize: true, rematerializePartial: false, v1Reclass: false, resume: false,
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
    else if (a === '--allow-strip') args.allowStrip = true;
    else if (a === '--rematerialize') args.rematerialize = true;
    else if (a === '--no-rematerialize') args.rematerialize = false;
    else if (a === '--rematerialize-partial') args.rematerializePartial = true;
    else if (a === '--v1-reclass') args.v1Reclass = true;
    else if (a === '--resume') args.resume = true;
    else { console.error(`Unknown arg: ${a}`); usage(); }
  }
  if (!args.deal && !args.all) usage();
  if (args.v1Reclass && args.all) {
    console.error('v1 fixture mode rejects --all; select one approved fixture deal.');
    process.exit(1);
  }
  if (args.apply && args.dryRun) { console.error('--apply and --dry-run are mutually exclusive.'); process.exit(1); }
  if (!args.classifyOnly && args.typesRaw.length === 0) usage();
  if (args.v1Reclass && !args.classifyOnly && args.rematerialize) {
    console.error('v1 reclassification extraction must use --no-rematerialize: backfill cards before materialising claims.');
    process.exit(1);
  }
  try {
    args.types = args.classifyOnly ? [] : parseTypesArg(args.typesRaw);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  if (args.v1Reclass && !args.classifyOnly && !isV1ExtractionTypeSet(args.types)) {
    console.error('v1 reclassification extraction requires exactly --types REP-T,REP-B,MISC.');
    process.exit(1);
  }
  if (args.resume && (!args.v1Reclass || !args.apply || args.classifyOnly)) {
    console.error('--resume is only valid for an applying v1 reclassification extraction.');
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

function hasPendingV1Classification(deal) {
  const marker = deal?.metadata?.v1_reclassification;
  return marker?.version === V1_RECLASS_EXTRACTION_VERSION && marker?.state === 'CLASSIFIED';
}

async function assertV1ApplyOrderNotBypassed(sb, deals, args) {
  if (!args?.apply || args.v1Reclass) return;
  const pendingDeals = (deals || []).filter(hasPendingV1Classification);
  const stale = [];
  for (const deal of pendingDeals) {
    const base = () => sb
      .from('provision_cards')
      .select('id', { count: 'exact', head: true })
      .eq('deal_id', deal.id);
    const [{ count: total, error: totalError }, { count: current, error: currentError }] = await Promise.all([
      base(),
      base().eq('extraction_version', V1_RECLASS_EXTRACTION_VERSION),
    ]);
    if (totalError || currentError) {
      throw new Error(`v1 card-version preflight failed for ${deal.id}: ${(totalError || currentError).message}`);
    }
    if (!total || current !== total) stale.push(deal.id);
  }
  if (stale.length > 0) {
    throw new Error(
      `v1 reclassification apply order is incomplete for ${stale.join(', ')}: ` +
      'use --v1-reclass and --no-rematerialize until the card backfill has replaced every card.',
    );
  }
}

async function assertV1DeterministicSafetySubset(sb) {
  const { assertExactDeterministicSafetySubset } = require('./safety-check-reclass-rules');
  const { data: allDeals, error } = await sb.from('deals').select('id, acquirer, target, metadata');
  if (error) throw new Error(`v1 safety deal fetch failed: ${error.message}`);
  assertExactDeterministicSafetySubset(allDeals || []);
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
async function classifyFromStoredText(sb, deal, client, prior, {
  persistRegions = true,
  rerunPriorCodes = null,
} = {}) {
  const { cleanText, parseStructure } = require('../lib/parser-v2/structural');
  const { classifySections } = require('../lib/parser-v2/classify');
  const fullText = deal.metadata && deal.metadata.full_text;
  if (!fullText) throw new Error('No stored full_text — full re-ingest required (scripts/ingest-local.js)');
  const cleaned = cleanText(fullText);
  const { sections, articles, regions } = parseStructure(cleaned);
  if (sections.length === 0) throw new Error('Parser found no sections in stored full_text');
  const classified = await classifySections(sections, articles, client, { prior, rerunPriorCodes });
  // A --classify-only dry-run must be a true dry-run: persistParserRegions
  // performs a real upsert into parser_regions, so it is skipped (along
  // with region-id attachment, which needs the persisted rows) unless the
  // caller is actually committing.
  if (!persistRegions) {
    return { classified, compact: toCompactSections(classified), sections, articles };
  }
  const persistedRegions = await persistParserRegions(sb, deal.id, cleaned, regions, sections);
  const withRegions = attachRegionIdsToSections(classified, persistedRegions.rows);
  return { classified: withRegions, compact: toCompactSections(withRegions), sections, articles };
}

async function persistSnapshot(sb, deal, compact, {
  resetExtractStatus = false,
  v1Reclass = false,
} = {}) {
  const meta = deal.metadata || {};
  const nextMetadata = {
    ...meta,
    classified_sections: compact,
    classify_run_at: new Date().toISOString(),
    classify_breakdown: classifyBreakdown(compact),
    ...(resetExtractStatus ? { extract_status: {} } : {}),
    ...(v1Reclass ? {
      v1_reclassification: {
        version: V1_RECLASS_EXTRACTION_VERSION,
        state: 'CLASSIFIED',
        classified_at: new Date().toISOString(),
      },
    } : {}),
  };
  const { error } = await sb.from('deals').update({ metadata: nextMetadata }).eq('id', deal.id);
  if (error) throw new Error(`Failed to persist classified sections: ${error.message}`);
  deal.metadata = nextMetadata;
}

/* ── per-deal drivers ────────────────────────────────────────────────────── */

async function reclassifyDeal(sb, deal, client, apply, v1Reclass = false) {
  const meta = deal.metadata || {};
  const before = Array.isArray(meta.classified_sections) ? meta.classified_sections : [];
  const prior = buildPriorLookup(before);
  if (before.length === 0) {
    console.log('  no prior snapshot — every non-deterministic section will need the AI');
  }

  const compact = await resolveReclassificationCompact({
    deal,
    before,
    v1Reclass,
    classify: () => classifyFromStoredText(sb, deal, client, prior, {
      persistRegions: apply,
      rerunPriorCodes: v1Reclass ? new Set(['REP-T-CONSENT', 'REP-T-REGSTATUS']) : null,
    }),
  });
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
  await persistSnapshot(sb, deal, compact, { resetExtractStatus: true, v1Reclass });
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

function isV1TypeCompleteAfterClassification(deal, type) {
  const classifiedAt = Date.parse(deal?.metadata?.v1_reclassification?.classified_at || '');
  const status = deal?.metadata?.extract_status?.[type];
  const completedAt = Date.parse(status?.completed_at || '');
  return status?.status === 'done' && Number.isFinite(classifiedAt) &&
    Number.isFinite(completedAt) && completedAt >= classifiedAt;
}

async function extractDeal(sb, deal, types, client, { resumeV1 = false, stopOnError = false } = {}) {
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
    const { compact } = await classifyFromStoredText(sb, deal, client, null);
    await persistSnapshot(sb, deal, compact);
    snapshot = compact;
    console.log(`  snapshot persisted: ${compact.length} sections`);
  }

  const countsBefore = computeCounts(await fetchAllTypes(sb, deal.id));
  let ok = true;

  for (const type of types) {
    if (resumeV1 && isV1TypeCompleteAfterClassification(deal, type)) {
      console.log(`  → ${type} … resume: already completed after v1 classification`);
      continue;
    }
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
      if (stopOnError) break;
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

  if (apply && args.classifyOnly && args.v1Reclass) {
    await assertV1DeterministicSafetySubset(sb);
  }

  // EXT-4 guard: refuse a per-type --apply reprocess that would strip
  // MODEL_READONLY cross-type post-pass features (see stripRiskConflicts
  // above). Does not apply to --classify-only (no provision writes) or to
  // dry-runs (no writes at all) — only a committing per-type extract can
  // actually strip anything.
  if (apply && !args.classifyOnly) {
    const conflicts = stripRiskConflicts(args.types);
    if (conflicts.length > 0 && !args.allowStrip) {
      console.error(formatStripRiskError(conflicts));
      process.exit(1);
    }
    if (conflicts.length > 0 && args.allowStrip) {
      console.warn(`--allow-strip set: proceeding despite feature-strip risk on ${
        conflicts.map((c) => `${c.feature} (${c.types.join(', ')})`).join('; ')
      }`);
    }
  }

  const deals = await fetchDeals(sb, args);
  assertV1FixtureScope(deals, args);
  await assertV1ApplyOrderNotBypassed(sb, deals, args);
  const mode = args.classifyOnly ? 'classify-only' : `types: ${args.types.join(', ')}`;
  console.log(`Reprocess (${mode}) — ${deals.length} deal(s), ${apply ? 'APPLY' : 'dry-run'}`);

  const client = makeLazyClient(args);
  let allOk = true;

  for (const deal of deals) {
    console.log(`\n═══ ${deal.acquirer || '?'} / ${deal.target || '?'} (${deal.id}) ═══`);
    try {
      let ok;
      if (args.classifyOnly) {
        ok = await reclassifyDeal(sb, deal, client, apply, args.v1Reclass);
      } else if (!apply) {
        ok = await planExtractDeal(deal, args.types);
      } else {
        ok = await extractDeal(sb, deal, args.types, client, {
          resumeV1: args.resume,
          stopOnError: args.v1Reclass,
        });
      }
      if (!ok) allOk = false;
    } catch (err) {
      console.log(`  ERROR: ${err.message}`);
      allOk = false;
    }
  }

  if (!apply && !args.classifyOnly) {
    console.log('\nDry-run complete: no writes, no LLM calls. Re-run with --apply to execute.');
    // --rematerialize (opt-in, absent by default — see parseArgs): print the
    // claims rematerialize PLAN for these same deals too. No writes, no LLM;
    // uses the existing planner (scripts/reprocess/rematerialize-claims.js).
    if (args.rematerialize) {
      const plans = await buildRematerializePlans(sb, deals);
      printRematerializePlans(plans);
    }
  }

  // DATA-1 (GAP-A): a per-type/--apply extraction writes `provisions` only —
  // `claims` (what the review UI actually reads, lib/queries/claims-adapter.js)
  // go stale immediately and are NOT materialized by this script. Make that
  // gap loud rather than silent; do not auto-run the rematerialize (a bigger
  // wiring decision — see reports/CODEBASE-REVIEW-2026-07-15.md DATA-1) unless
  // --rematerialize was explicitly passed, in which case run the write path
  // for exactly these deal ids instead of just printing the warning.
  if (apply && !args.classifyOnly) {
    if (args.rematerialize) {
      const result = await runRematerializeApply(sb, deals, { partial: args.rematerializePartial });
      if (!result.ok) allOk = false;
    } else {
      console.warn(formatRematerializeWarning(deals.map((d) => d.id)));
    }
  }

  if (!allOk) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
