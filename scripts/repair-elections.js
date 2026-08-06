#!/usr/bin/env node
/*
  ELECTION-REDO-SPEC-2026-07-16 step 3 — data repair.

  Dry-run by default. Re-runs the fixed buildElectionMechanism/
  buildElectionCarrierProvision extraction (lib/parser-v2/elections.js,
  lib/parser-v2/consideration-equity.js) against every deal's stored
  consideration_equity_provisions / provisions rows and classifies each
  existing (or missing) election_mechanisms row into one of four buckets:

    DELETE          — the stored row is a false positive: re-running the
                       fixed extraction (negative guard included) on its own
                       region_full_text now correctly yields no mechanism.
    UPDATE          — the fixed extraction still finds a genuine election,
                       but the per-option numbers/labels/default treatment
                       differ from what's stored (the QXO bug class: cap
                       clause dumped into cash_per_share_formula instead of
                       the real $/share number).
    CREATE          — a CONSID provision carries genuine election language
                       but has NO election_mechanisms row at all yet (the
                       Skechers bug class).
    NEEDS_REVIEW    — the fixed extraction still can't resolve real
                       per-option numbers from the stored region_full_text
                       (every option falls back to a formula dump). This is
                       the LabCorp/Covance class: the region_full_text itself
                       is the wrong clause (an Exchange Fund boilerplate
                       paragraph, not the Merger Consideration paragraph),
                       which no regex can fix — it needs a human to re-point
                       the region at the correct provision. NEVER
                       auto-applied, even with --apply.

  Usage:
    node scripts/repair-elections.js --all
    node scripts/repair-elections.js --deal QXO
    node scripts/repair-elections.js --all --apply   (DELETE/UPDATE/CREATE only;
                                                        NEEDS_REVIEW is always
                                                        printed, never applied)

  --apply is intentionally NOT exercised by this handoff — deliverable is the
  dry-run script and its dry-run output for review, per
  docs/archive/handoffs/ELECTION-REDO-SPEC-2026-07-16.md step 3 ("review them ALL"
  before --apply).
*/

const fs = require('node:fs');
const { createClient } = require('@supabase/supabase-js');
const { buildElectionMechanism, enforceElectionInvariants } = require('../lib/parser-v2/elections');
const { buildElectionCarrierProvision } = require('../lib/parser-v2/consideration-equity');
const { writeElectionMechanism, writeConsiderationEquity, fetchTransactionContext } = require('../lib/parser-v2/store');

function loadDotEnvLocal() {
  const text = fs.existsSync('.env.local') ? fs.readFileSync('.env.local', 'utf8') : '';
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!m || process.env[m[1]]) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
}

function parseArgs(argv) {
  const args = { deal: null, all: false, apply: false };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--deal') args.deal = argv[++i];
    else if (arg === '--all') args.all = true;
    else if (arg === '--apply') args.apply = true;
    else throw new Error(`Unknown arg: ${arg}`);
  }
  if (!args.deal && !args.all) throw new Error('Provide --deal <substring> or --all');
  return args;
}

async function fetchDeals(sb, args) {
  const { data, error } = await sb.from('deals').select('id, acquirer, target').limit(2000);
  if (error) throw new Error(error.message);
  return (data || []).filter((deal) => {
    if (args.all) return true;
    return `${deal.acquirer || ''} ${deal.target || ''}`.toLowerCase().includes(String(args.deal).toLowerCase());
  });
}

async function fetchConsiderationRows(sb, dealId) {
  const { data, error } = await sb
    .from('consideration_equity_provisions')
    .select('id, deal_id, region_full_text, transaction_step_id')
    .eq('deal_id', dealId);
  if (error) throw new Error(error.message);
  return data || [];
}

async function fetchExistingMechanism(sb, provisionId) {
  const { data: mech, error: mechErr } = await sb
    .from('election_mechanisms')
    .select('*')
    .eq('provision_id', provisionId)
    .maybeSingle();
  if (mechErr && !/PGRST116/.test(mechErr.code || '')) throw new Error(mechErr.message);
  if (!mech) return null;
  const { data: options, error: optErr } = await sb
    .from('election_options')
    .select('*')
    .eq('election_mechanism_id', mech.id)
    .order('display_order', { ascending: true });
  if (optErr) throw new Error(optErr.message);
  return { ...mech, options: options || [] };
}

async function fetchUnlinkedConsidProvisions(sb, dealId) {
  const { data, error } = await sb
    .from('provisions')
    .select('id, deal_id, type, category, full_text, ai_metadata, region_id, consideration_equity_provision_id')
    .eq('deal_id', dealId)
    .eq('type', 'CONSID')
    .is('consideration_equity_provision_id', null);
  if (error) throw new Error(error.message);
  return data || [];
}

// A rebuilt mechanism is "usable" (worth an UPDATE/CREATE proposal, not a
// NEEDS_REVIEW flag) only when at least one option resolved a real number --
// i.e. the region text actually carries the option's own defined-term
// economics. If every option fell back to a bare formula dump, the region
// text itself is unusable (LabCorp/Covance class) and no amount of regex
// tuning fixes that; a human has to re-point the region.
function mechanismHasRealNumbers(mechanism) {
  return mechanism.options.some((o) => o.cashPerShare !== null || o.stockPerShare !== null);
}

function optionsSummary(options) {
  return options.map((o) => ({
    optionType: o.option_type || o.optionType,
    optionLabel: o.option_label || o.optionLabel,
    cashPerShare: o.cash_per_share ?? o.cashPerShare ?? null,
    cashPerShareFormula: Boolean(o.cash_per_share_formula ?? o.cashPerShareFormula),
    stockPerShare: o.stock_per_share ?? o.stockPerShare ?? null,
    stockPerShareFormula: Boolean(o.stock_per_share_formula ?? o.stockPerShareFormula),
  }));
}

function mechanismChanged(existing, rebuilt) {
  const before = JSON.stringify({
    electionType: existing.election_type,
    defaultTreatment: existing.default_treatment,
    options: optionsSummary(existing.options),
  });
  const after = JSON.stringify({
    electionType: rebuilt.electionType,
    defaultTreatment: rebuilt.defaultTreatment,
    options: optionsSummary(rebuilt.options),
  });
  return before !== after;
}

async function classifyDeal(sb, deal) {
  const findings = [];
  const rows = await fetchConsiderationRows(sb, deal.id);
  for (const row of rows) {
    const existing = await fetchExistingMechanism(sb, row.id);
    let rebuilt = null;
    try {
      rebuilt = buildElectionMechanism({ regionFullText: row.region_full_text });
      if (rebuilt) enforceElectionInvariants(rebuilt, row.region_full_text);
    } catch (err) {
      findings.push({
        action: 'NEEDS_REVIEW',
        reason: `re-extraction threw: ${err.message}`,
        provisionId: row.id,
        existing: existing ? optionsSummary(existing.options) : null,
      });
      continue;
    }

    if (existing && !rebuilt) {
      findings.push({
        action: 'DELETE',
        reason: 'fixed extraction (negative guard) no longer finds an election in this region_full_text — false positive.',
        provisionId: row.id,
        electionMechanismId: existing.id,
        existing: optionsSummary(existing.options),
      });
      continue;
    }
    if (!existing && !rebuilt) continue; // correctly nothing here, nothing to do
    if (!existing && rebuilt) {
      if (!mechanismHasRealNumbers(rebuilt)) {
        findings.push({
          action: 'NEEDS_REVIEW',
          reason: 'election signals detected but no option resolved a real per-share number from this region_full_text.',
          provisionId: row.id,
          rebuilt: optionsSummary(rebuilt.options),
        });
        continue;
      }
      findings.push({
        action: 'CREATE',
        reason: 'election language detected on a consideration_equity_provisions row with no election_mechanisms row.',
        provisionId: row.id,
        rebuilt: optionsSummary(rebuilt.options),
        rebuiltElectionType: rebuilt.electionType,
        rebuiltDefaultTreatment: rebuilt.defaultTreatment,
        _mechanism: rebuilt,
        _regionFullText: row.region_full_text,
        _transactionStepId: row.transaction_step_id || null,
      });
      continue;
    }
    // existing && rebuilt
    if (!mechanismHasRealNumbers(rebuilt)) {
      findings.push({
        action: 'NEEDS_REVIEW',
        reason: 'stored row is a plausible election, but re-extraction still cannot resolve real per-option numbers from this region_full_text — likely the region itself points at the wrong clause (needs a human to re-point it, e.g. Covance/LabCorp: region_full_text is an Exchange Fund boilerplate paragraph, not Merger Consideration).',
        provisionId: row.id,
        electionMechanismId: existing.id,
        existing: optionsSummary(existing.options),
        rebuilt: optionsSummary(rebuilt.options),
      });
      continue;
    }
    if (mechanismChanged(existing, rebuilt)) {
      findings.push({
        action: 'UPDATE',
        reason: 'fixed extraction resolves real per-option numbers/labels/default-treatment that differ from the stored row.',
        provisionId: row.id,
        electionMechanismId: existing.id,
        existing: optionsSummary(existing.options),
        existingDefaultTreatment: existing.default_treatment,
        rebuilt: optionsSummary(rebuilt.options),
        rebuiltDefaultTreatment: rebuilt.defaultTreatment,
        _mechanism: rebuilt,
        _regionFullText: row.region_full_text,
        _transactionStepId: row.transaction_step_id || null,
      });
    }
  }

  // Skechers class: a CONSID provision that was never even linked into
  // consideration_equity_provisions at all.
  const unlinked = await fetchUnlinkedConsidProvisions(sb, deal.id);
  for (const row of unlinked) {
    const carrier = buildElectionCarrierProvision({
      type: row.type,
      code: (row.ai_metadata && row.ai_metadata.code) || null,
      text: row.full_text,
      features: (row.ai_metadata && row.ai_metadata.features) || {},
    });
    if (!carrier || !carrier.electionMechanism) continue;
    if (!mechanismHasRealNumbers(carrier.electionMechanism)) {
      findings.push({
        action: 'NEEDS_REVIEW',
        reason: 'unlinked CONSID provision carries election language but no option resolved a real per-share number.',
        provisionId: row.id,
        rebuilt: optionsSummary(carrier.electionMechanism.options),
      });
      continue;
    }
    findings.push({
      action: 'CREATE',
      reason: 'unlinked CONSID provision (no consideration_equity_provisions row at all) carries a genuine election.',
      provisionId: row.id,
      rebuilt: optionsSummary(carrier.electionMechanism.options),
      rebuiltElectionType: carrier.electionMechanism.electionType,
      rebuiltDefaultTreatment: carrier.electionMechanism.defaultTreatment,
      _carrier: carrier,
      _sourceProvisionRow: row,
    });
  }

  return findings;
}

async function applyFinding(sb, deal, finding) {
  if (finding.action === 'DELETE') {
    const { error } = await sb.from('election_mechanisms').delete().eq('id', finding.electionMechanismId);
    if (error) throw new Error(error.message);
    return;
  }
  if (finding.action === 'UPDATE') {
    // Reuse the row's OWN stored transaction_step_id (already resolved at
    // ingestion time) rather than recomputing it — writeElectionMechanism
    // only needs a provision_id + the mechanism + the step id it should
    // carry, and re-deriving from topology risks picking the wrong step for
    // a multi-step (tender-offer / back-end-merger) deal.
    await writeElectionMechanism(finding.provisionId, finding._mechanism, finding._regionFullText, sb, finding._transactionStepId);
    return;
  }
  if (finding.action === 'CREATE' && finding._carrier) {
    // writeConsiderationEquity writes election_mechanisms/election_options
    // internally (see lib/parser-v2/store.js) — do not also call
    // writeElectionMechanism here, that would double-write.
    const context = await fetchTransactionContext(deal.id, sb);
    const row = finding._sourceProvisionRow;
    const meta = (row.ai_metadata && typeof row.ai_metadata === 'object') ? row.ai_metadata : {};
    const prov = {
      id: row.id,
      type: row.type,
      code: meta.code || null,
      text: row.full_text,
      full_text: row.full_text,
      regionId: row.region_id || null,
      features: {
        ...(meta.features || {}),
        considerationEquity: finding._carrier,
        considerationTreatments: [],
        treatmentGrouping: finding._carrier.treatmentGrouping,
        regionHash: finding._carrier.regionHash,
      },
    };
    const provisionId = await writeConsiderationEquity(deal.id, prov, sb, context);
    await sb.from('provisions').update({ consideration_equity_provision_id: provisionId }).eq('id', row.id);
    return;
  }
  // CREATE without _carrier (rebuilt mechanism on an EXISTING consideration
  // equity row that simply had no election_mechanisms row) reuses UPDATE's
  // write path.
  if (finding.action === 'CREATE' && finding._mechanism) {
    await writeElectionMechanism(finding.provisionId, finding._mechanism, finding._regionFullText, sb, finding._transactionStepId);
  }
}

(async () => {
  loadDotEnvLocal();
  const args = parseArgs(process.argv);
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase creds required');
  const sb = createClient(url, key);
  const deals = await fetchDeals(sb, args);
  console.log(`Election repair ${args.apply ? 'APPLY' : 'dry-run'} — ${deals.length} deal(s) scanned`);

  const tally = { DELETE: 0, UPDATE: 0, CREATE: 0, NEEDS_REVIEW: 0 };
  for (const deal of deals) {
    const findings = await classifyDeal(sb, deal);
    if (!findings.length) continue;
    console.log(`\n=== ${deal.acquirer || '?'} / ${deal.target || '?'} (${deal.id}) ===`);
    for (const finding of findings) {
      tally[finding.action] = (tally[finding.action] || 0) + 1;
      const { _mechanism, _carrier, _regionFullText, _sourceProvisionRow, ...printable } = finding;
      console.log(JSON.stringify(printable, null, 2));
      if (args.apply && finding.action !== 'NEEDS_REVIEW') {
        await applyFinding(sb, deal, finding);
        console.log(`  -> applied ${finding.action}`);
      }
    }
  }
  console.log('\n--- summary ---');
  console.log(JSON.stringify(tally, null, 2));
  if (!args.apply) {
    console.log('\nDry run only — nothing was written. Review every finding above, then re-run with --apply.');
    console.log('NEEDS_REVIEW findings are NEVER applied by this script, even with --apply — they require a human to re-point region_full_text at the correct clause.');
  }
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
