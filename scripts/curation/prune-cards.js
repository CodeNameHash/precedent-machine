#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────
   scripts/curation/prune-cards.js — Ben-gated duplicate-card prune.

   Deterministic, decisions-file-driven prune of duplicate `provision_cards`
   rows with a keep / rehome / delete / add-to-row (verify-then-hold) action
   ladder. This tool never discovers or guesses its own targets — it only
   acts on cards explicitly listed in a checked-in decisions file
   (scripts/curation/decisions/*.json).

   Every destructive step is gated:
     - dry-run by default (writes nothing, makes zero DB writes)
     - --apply requires --backup <path>: a full dump of provision_cards +
       claims for every affected deal, written BEFORE any write; refuses to
       proceed if the backup path already exists or the dump fails
     - human-correction skip+flag: cards whose matched provision (or a
       corrections-table row) shows a human already touched this category
       are never written to, no matter what the decisions file says
     - the whole run is all-or-nothing: any verification failure, flag, or
       ambiguity anywhere in the run means ZERO writes for the whole run

   DRY-RUN IS THE DEFAULT: prints a per-deal table of every decision with
   verification results, writes nothing. --deal filters to one deal.

   Usage:
     node scripts/curation/prune-cards.js --decisions scripts/curation/decisions/2026-07-pilot-prune.json
     node scripts/curation/prune-cards.js --decisions <file> --deal <uuid>
     node scripts/curation/prune-cards.js --decisions <file> --apply --backup reports/prune-backup.json
     [--json]
   ───────────────────────────────────────────────────────────────────────── */

const fs = require('fs');
const path = require('path');

/* ── pure helpers (exported for tests — no DB, no network) ───────────────── */

// Whitespace-normalized, case-insensitive comparison key.
function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

// Resolves a decisions-file card reference (full uuid or 8+-char prefix)
// against a deal's cards. Never guesses: zero matches -> missing, more than
// one match -> ambiguous.
function resolveCardRef(ref, cards) {
  const needle = String(ref || '').toLowerCase();
  if (!needle) return { ok: false, reason: 'missing', candidates: [] };
  const matches = (cards || []).filter((c) => String(c.id || '').toLowerCase().startsWith(needle));
  if (matches.length === 0) return { ok: false, reason: 'missing', candidates: [] };
  if (matches.length > 1) {
    return { ok: false, reason: 'ambiguous', candidates: matches.map((c) => c.id) };
  }
  return { ok: true, card: matches[0] };
}

// Is `needleText` (whitespace-normalized, case-insensitive) a substring of
// at least one provision's full_text? Returns the covering provision ids.
function textCovered(needleText, provisions) {
  const needle = normalizeText(needleText);
  if (!needle) return { covered: false, coveringIds: [] };
  const coveringIds = (provisions || [])
    .filter((p) => p && normalizeText(p.full_text).includes(needle))
    .map((p) => p.id);
  return { covered: coveringIds.length > 0, coveringIds };
}

// The same-deal provision(s) that "correspond to" a card: either the
// provision's full_text contains the card's region text, or (fallback) an
// exact category === short_title match. Used only for the human-correction
// gate, per spec.
function findMatchedProvisions(card, provisions) {
  const byText = textCovered(card.region_full_text, provisions).coveringIds;
  if (byText.length > 0) {
    const idSet = new Set(byText);
    return (provisions || []).filter((p) => idSet.has(p.id));
  }
  return (provisions || []).filter((p) => p && p.category === card.short_title);
}

// Before ANY write to a card: has a human already corrected this category,
// either directly on the matched provision (ai_metadata.user_corrected) or
// via a logged correction row referencing this short_title? Never override —
// only ever used to SKIP + flag.
function humanCorrectionFlag(card, provisions, corrections) {
  const matched = findMatchedProvisions(card, provisions);
  const viaProvision = matched.some((p) => p && p.ai_metadata && p.ai_metadata.user_corrected === true);
  if (viaProvision) return true;
  const viaCorrections = (corrections || []).some((c) => {
    const beforeCat = c && c.before && c.before.category;
    const afterCat = c && c.after && c.after.category;
    return beforeCat === card.short_title || afterCat === card.short_title;
  });
  return viaCorrections;
}

// Plans a single decision line against one deal's cards/provisions/
// corrections. Never touches the network. Returns a report entry; entries
// with a truthy `write` are the only ones that may ever reach the DB, and
// only when the WHOLE run is `ok`.
function planDecision(dealId, decision, cards, provisions, corrections) {
  const base = {
    dealId,
    cardRef: decision.card,
    action: decision.action,
    note: decision.note || null,
  };

  const resolved = resolveCardRef(decision.card, cards);
  if (!resolved.ok) {
    return {
      ...base,
      cardId: null,
      shortTitle: null,
      status: resolved.reason === 'ambiguous' ? 'ERROR-AMBIGUOUS' : 'ERROR-MISSING',
      candidates: resolved.candidates,
      coveringProvisionIds: [],
      flagged: false,
      write: null,
      ok: false,
    };
  }

  const card = resolved.card;
  const entry = {
    ...base,
    cardId: card.id,
    shortTitle: card.short_title,
    coveringProvisionIds: [],
    flagged: false,
    write: null,
  };

  if (decision.action === 'keep') {
    return { ...entry, status: 'KEEP', ok: true };
  }

  if (decision.action === 'verify-then-hold') {
    const { covered, coveringIds } = textCovered(decision.mustContainInKeptRow, provisions);
    return {
      ...entry,
      status: covered ? 'COVERED' : 'NOT-COVERED',
      coveringProvisionIds: coveringIds,
      mustContainInKeptRow: decision.mustContainInKeptRow,
      addToRow: decision.addToRow || null,
      ok: covered,
    };
  }

  if (decision.action === 'delete' || decision.action === 'rehome') {
    // Human-correction gate: SKIP + flag, never override, regardless of
    // verification outcome.
    if (humanCorrectionFlag(card, provisions, corrections)) {
      return { ...entry, status: 'FLAGGED-HUMAN-CORRECTION', flagged: true, ok: false };
    }

    if (decision.action === 'delete') {
      const { covered, coveringIds } = textCovered(card.region_full_text, provisions);
      if (!covered) {
        return { ...entry, status: 'NEEDS-RECONFIRM', coveringProvisionIds: coveringIds, ok: false };
      }
      return {
        ...entry,
        status: 'PLANNED-DELETE',
        coveringProvisionIds: coveringIds,
        write: { op: 'delete', table: 'provision_cards', id: card.id },
        ok: true,
      };
    }

    // rehome: title-only patch, never a delete, no verification defined.
    return {
      ...entry,
      status: 'PLANNED-REHOME',
      oldTitle: card.short_title,
      newTitle: decision.newTitle,
      write: { op: 'update', table: 'provision_cards', id: card.id, patch: { short_title: decision.newTitle } },
      ok: true,
    };
  }

  return { ...entry, status: 'ERROR-UNKNOWN-ACTION', ok: false };
}

// Plans every decision for one deal.
function buildDealPlan(dealId, decisions, cards, provisions, corrections) {
  const entries = (decisions || []).map((d) => planDecision(dealId, d, cards, provisions, corrections));
  const ok = entries.every((e) => e.ok);
  return { dealId, entries, ok };
}

// Plans the whole run: every deal in the decisions file (or just
// `options.dealFilter` if given). `dealDataById` is
// { [dealId]: { cards, provisions, corrections } }.
function buildRunPlan(decisionsFile, dealDataById, options = {}) {
  const allDealIds = Object.keys((decisionsFile && decisionsFile.deals) || {});
  const dealIds = options.dealFilter ? allDealIds.filter((id) => id === options.dealFilter) : allDealIds;
  const dealPlans = dealIds.map((dealId) => {
    const data = (dealDataById && dealDataById[dealId]) || {};
    return buildDealPlan(
      dealId,
      decisionsFile.deals[dealId],
      data.cards || [],
      data.provisions || [],
      data.corrections || [],
    );
  });
  const ok = dealPlans.length > 0 && dealPlans.every((p) => p.ok);
  return { label: decisionsFile && decisionsFile.label, dealPlans, ok };
}

// All-or-nothing at the whole-run level: if ANY deal/decision failed
// verification or was flagged, NOTHING is planned to write — even entries
// that individually resolved cleanly.
function plannedWrites(plan) {
  if (!plan || !plan.ok) return [];
  const writes = [];
  for (const dealPlan of plan.dealPlans) {
    for (const entry of dealPlan.entries) {
      if (entry.write) writes.push(entry);
    }
  }
  return writes;
}

// Pure gate for --apply/--backup: apply requires a backup path, and refuses
// to clobber an existing backup file.
function checkBackupGate(args, existsFn) {
  if (!args || !args.apply) return { ok: true };
  if (!args.backup) {
    return { ok: false, reason: '--apply requires --backup <path> (dump-before-write is mandatory).' };
  }
  const exists = typeof existsFn === 'function' ? existsFn(args.backup) : fs.existsSync(args.backup);
  if (exists) {
    return { ok: false, reason: `Refusing to overwrite existing backup file: ${args.backup}` };
  }
  return { ok: true };
}

/* ── report formatting ───────────────────────────────────────────────────── */

function shortId(id) {
  return id ? String(id).slice(0, 8) : '(unresolved)';
}

function formatEntryLine(e) {
  const flags = [];
  if (e.flagged) flags.push('FLAGGED-HUMAN-CORRECTION');
  if (e.status === 'ERROR-AMBIGUOUS') flags.push(`ambiguous (${(e.candidates || []).map(shortId).join(', ')})`);
  if (e.status === 'ERROR-MISSING') flags.push('missing card');

  const verification = e.coveringProvisionIds && e.coveringProvisionIds.length > 0
    ? `covered by [${e.coveringProvisionIds.map(shortId).join(', ')}]`
    : (e.status === 'NEEDS-RECONFIRM' || e.status === 'NOT-COVERED' ? 'NOT-FOUND' : '—');

  const write = e.write
    ? (e.write.op === 'delete' ? 'DELETE provision_cards' : `UPDATE provision_cards.short_title -> "${e.write.patch.short_title}"`)
    : (e.action === 'rehome' && e.newTitle ? `(would UPDATE short_title -> "${e.newTitle}")` : 'none');

  return `  ${shortId(e.cardId)}  ${(e.shortTitle || '(unresolved)').padEnd(40)}  ${e.action.padEnd(17)}  ${e.status.padEnd(24)}  verify: ${verification}  write: ${write}${flags.length ? `  [${flags.join('; ')}]` : ''}`;
}

function formatDealTable(dealPlan) {
  const lines = [`deal ${dealPlan.dealId} — ${dealPlan.ok ? 'clean' : 'NOT CLEAN'}`];
  for (const e of dealPlan.entries) lines.push(formatEntryLine(e));
  return lines.join('\n');
}

function formatRunReport(plan) {
  const lines = [`${plan.label || 'prune-cards'} — ${plan.dealPlans.length} deal(s), overall ${plan.ok ? 'CLEAN' : 'NOT CLEAN'}`];
  for (const dealPlan of plan.dealPlans) {
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
    'Usage: node scripts/curation/prune-cards.js --decisions <path> ' +
    '[--deal <uuid>] [--apply --backup <path>] [--json]',
  );
  process.exit(1);
}

function parseArgs(argv) {
  const args = { decisions: null, deal: null, apply: false, backup: null, json: false };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--decisions') args.decisions = argv[++i];
    else if (a === '--deal') args.deal = argv[++i];
    else if (a === '--apply') args.apply = true;
    else if (a === '--backup') args.backup = argv[++i];
    else if (a === '--json') args.json = true;
    else { console.error(`Unknown arg: ${a}`); usage(); }
  }
  if (!args.decisions) usage();
  return args;
}

async function fetchCardsForDeal(sb, dealId) {
  const { data, error } = await sb
    .from('provision_cards')
    .select('id, excerpt_id, provision_type, short_title, region_full_text')
    .eq('deal_id', dealId);
  if (error) throw new Error(`provision_cards fetch failed (deal ${dealId}): ${error.message}`);
  return data || [];
}

async function fetchProvisionsForDeal(sb, dealId) {
  const { data, error } = await sb
    .from('provisions')
    .select('id, category, full_text, ai_metadata')
    .eq('deal_id', dealId);
  if (error) throw new Error(`provisions fetch failed (deal ${dealId}): ${error.message}`);
  return data || [];
}

async function fetchCorrectionsForDeal(sb, dealId) {
  const { data, error } = await sb
    .from('corrections')
    .select('before, after')
    .eq('deal_id', dealId);
  if (error) throw new Error(`corrections fetch failed (deal ${dealId}): ${error.message}`);
  return data || [];
}

// BEFORE any write: dump every provision_cards + claims row for every
// affected deal to `backupPath`. Refuses (throws) if the file already
// exists or the dump fails — caller must not proceed past this on error.
async function dumpBackup(sb, dealIds, backupPath) {
  if (fs.existsSync(backupPath)) {
    throw new Error(`Backup path already exists, refusing to overwrite: ${backupPath}`);
  }
  const provision_cards = {};
  const claims = {};
  for (const dealId of dealIds) {
    const { data: cards, error: cardsErr } = await sb.from('provision_cards').select('*').eq('deal_id', dealId);
    if (cardsErr) throw new Error(`Backup dump failed (provision_cards, deal ${dealId}): ${cardsErr.message}`);
    provision_cards[dealId] = cards || [];

    const { data: dealClaims, error: claimsErr } = await sb.from('claims').select('*').eq('deal_id', dealId);
    if (claimsErr) throw new Error(`Backup dump failed (claims, deal ${dealId}): ${claimsErr.message}`);
    claims[dealId] = dealClaims || [];
  }
  const payload = { dumpedAt: new Date().toISOString(), dealIds, provision_cards, claims };
  fs.writeFileSync(backupPath, JSON.stringify(payload, null, 2));
  return payload;
}

// Executes rehomes, then deletes — and ONLY the writes plannedWrites()
// surfaces (i.e. nothing at all unless the whole run is clean). The only
// table ever written is provision_cards.
async function executeWrites(sb, plan) {
  const writes = plannedWrites(plan);
  const rehomes = writes.filter((w) => w.write.op === 'update');
  const deletes = writes.filter((w) => w.write.op === 'delete');

  let rehomed = 0;
  for (const e of rehomes) {
    const { error } = await sb.from('provision_cards').update(e.write.patch).eq('id', e.write.id);
    if (error) throw new Error(`Rehome failed for card ${e.write.id}: ${error.message}`);
    rehomed += 1;
  }

  let deleted = 0;
  for (const e of deletes) {
    const { error } = await sb.from('provision_cards').delete().eq('id', e.write.id);
    if (error) throw new Error(`Delete failed for card ${e.write.id}: ${error.message}`);
    deleted += 1;
  }

  return { rehomed, deleted };
}

function writeReportFile(report) {
  const dir = path.join(__dirname, '..', '..', 'reports');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(dir, `prune-cards-${stamp}.json`);
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

  const decisionsFile = JSON.parse(fs.readFileSync(path.resolve(args.decisions), 'utf-8'));
  const allDealIds = Object.keys(decisionsFile.deals || {});
  if (args.deal && !allDealIds.includes(args.deal)) {
    console.error(`Deal ${args.deal} is not present in ${args.decisions}.`);
    process.exit(1);
  }
  const dealIds = args.deal ? [args.deal] : allDealIds;

  const { createClient } = require('@supabase/supabase-js');
  const dbUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!dbUrl || !key) { console.error('Supabase creds required (env / .env.local).'); process.exit(1); }
  const sb = createClient(dbUrl, key);

  console.log(`${decisionsFile.label || 'prune-cards'} — ${dealIds.length} deal(s), ${args.apply ? 'APPLY' : 'dry-run'}`);

  // Order of operations under --apply: backup FIRST (before the
  // human-correction scan and verifications, which happen while building the
  // plan below), then verify, then (only if clean) write.
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
    const [cards, provisions, corrections] = await Promise.all([
      fetchCardsForDeal(sb, dealId),
      fetchProvisionsForDeal(sb, dealId),
      fetchCorrectionsForDeal(sb, dealId),
    ]);
    dealDataById[dealId] = { cards, provisions, corrections };
  }

  const plan = buildRunPlan(decisionsFile, dealDataById, { dealFilter: args.deal || null });
  console.log(formatRunReport(plan));

  const report = {
    generatedAt: new Date().toISOString(),
    label: plan.label,
    apply: args.apply,
    ok: plan.ok,
    deals: plan.dealPlans,
  };

  if (args.json) console.log(JSON.stringify(report, null, 2));

  if (!plan.ok) {
    console.error('\nVerification failure / flag / ambiguity detected — exiting 1. Zero writes performed.');
    writeReportFile(report);
    process.exitCode = 1;
    return;
  }

  if (!args.apply) {
    console.log('\nDry-run complete: no writes. Re-run with --apply --backup <path> to commit.');
    writeReportFile(report);
    return;
  }

  const result = await executeWrites(sb, plan);
  console.log(`Executed: ${result.rehomed} rehome(s), ${result.deleted} delete(s).`);
  report.executed = result;
  const reportFile = writeReportFile(report);
  console.log(`Report written: ${reportFile}`);
}

module.exports = {
  normalizeText,
  resolveCardRef,
  textCovered,
  findMatchedProvisions,
  humanCorrectionFlag,
  planDecision,
  buildDealPlan,
  buildRunPlan,
  plannedWrites,
  checkBackupGate,
  formatDealTable,
  formatRunReport,
  dumpBackup,
  executeWrites,
  parseArgs,
};

if (require.main === module) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
