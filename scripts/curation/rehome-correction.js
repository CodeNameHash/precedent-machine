#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────
   scripts/curation/rehome-correction.js — re-home a single correction onto
   an explicitly named provision.

   Generic, gated one-shot: the automatic matcher in
   lib/parser-v2/reapply-corrections.js (matchCorrectionToProvision) sometimes
   can't find the provision a correction belongs to (category/text drift
   after a re-ingest, a card split into a new corpus row, etc). This tool
   lets a human say "this correction belongs on THIS provision" explicitly,
   applies the delta the same way reapplyCorrections would, and — crucially —
   writes a FRESH corrections row anchored to the target provision's own
   identity fields (type/category/full_text), so future automatic matching
   runs can find it without another manual rehome.

   It never discovers targets on its own; both ids are supplied by the
   caller. It never deletes the original corrections row (audit trail stays
   intact) and never touches any table besides provisions/corrections.

   SAFETY: refuses (no write) if the provision's current feature value for
   any key the correction touched is non-null AND differs from the
   correction's BEFORE value — that means the provision has diverged since
   the correction was logged, and a human needs to look before rehoming.

   DRY-RUN IS THE DEFAULT: prints the plan, writes nothing.

   Usage:
     node scripts/curation/rehome-correction.js --correction <uuid> --provision <uuid>
     node scripts/curation/rehome-correction.js --correction <uuid> --provision <uuid> --apply
   ───────────────────────────────────────────────────────────────────────── */

const fs = require('fs');
const path = require('path');
const { computeUserDelta } = require('../../lib/parser-v2/reapply-corrections');

/* ── pure helpers (exported for tests — no DB, no network) ───────────────── */

// Keys the correction's delta touches whose CURRENT value on the target
// provision has already diverged from the correction's recorded BEFORE
// value. Null/absent current values are expected and never conflict.
function findConflicts(delta, currentFeatures, beforeFeatures) {
  const conflicts = [];
  for (const key of Object.keys(delta.featureSet)) {
    const current = currentFeatures[key];
    if (current === null || current === undefined) continue;
    if (JSON.stringify(current) !== JSON.stringify(beforeFeatures[key])) {
      conflicts.push({ key, current, before: beforeFeatures[key] === undefined ? null : beforeFeatures[key] });
    }
  }
  return conflicts;
}

// Builds the full plan for re-homing `correction` onto `provision`. Pure —
// no network. Returns { ok: false, reason, conflicts? } on any refusal, or
// { ok: true, ... } with the exact write payloads under --apply.
function planRehome(correction, provision) {
  if (!correction) return { ok: false, reason: 'correction not found' };
  if (!provision) return { ok: false, reason: 'provision not found' };
  if (correction.deal_id !== provision.deal_id) {
    return {
      ok: false,
      reason: `deal_id mismatch: correction is on deal ${correction.deal_id}, provision is on deal ${provision.deal_id}`,
    };
  }

  const delta = computeUserDelta(correction.before, correction.after);
  if (delta.empty) {
    return { ok: false, reason: 'computeUserDelta(before, after) is empty — nothing to re-home' };
  }

  const currentMeta = provision.ai_metadata || {};
  const currentFeatures = currentMeta.features || {};
  const beforeFeatures = (correction.before && correction.before.features) || {};

  const conflicts = findConflicts(delta, currentFeatures, beforeFeatures);
  if (conflicts.length > 0) {
    return {
      ok: false,
      reason: 'conflict: the provision has diverged since the correction was made — a human must look',
      conflicts,
    };
  }

  const featureChanges = Object.keys(delta.featureSet).map((key) => ({
    key,
    current: currentFeatures[key] === undefined ? null : currentFeatures[key],
    next: delta.featureSet[key],
  }));

  const mergedFeatures = { ...currentFeatures };
  for (const key of Object.keys(delta.featureSet)) mergedFeatures[key] = delta.featureSet[key];
  for (const key of delta.featureDelete) delete mergedFeatures[key];

  const priorReapplied = Array.isArray(currentMeta.reapplied_corrections) ? currentMeta.reapplied_corrections : [];
  const reappliedCorrections = priorReapplied.includes(correction.id)
    ? priorReapplied.slice()
    : [...priorReapplied, correction.id];

  const provisionsUpdate = {
    ...delta.set,
    ai_metadata: {
      ...currentMeta,
      features: mergedFeatures,
      reapplied_corrections: reappliedCorrections,
    },
  };

  const identity = { type: provision.type, category: provision.category, full_text: provision.full_text };
  const beforeFeaturesForRow = {};
  const afterFeaturesForRow = {};
  for (const key of Object.keys(delta.featureSet)) {
    beforeFeaturesForRow[key] = currentFeatures[key] === undefined ? null : currentFeatures[key];
    afterFeaturesForRow[key] = delta.featureSet[key];
  }

  const newCorrectionRow = {
    deal_id: correction.deal_id,
    provision_id: provision.id,
    correction_type: correction.correction_type,
    before: { ...identity, features: beforeFeaturesForRow },
    after: { ...identity, features: afterFeaturesForRow },
    reason: `re-homed correction ${correction.id} onto provision ${provision.id}`,
    context: { kind: 'correction_rehome', original_correction_id: correction.id, tool: 'rehome-correction.js' },
  };

  return {
    ok: true,
    correctionId: correction.id,
    provisionId: provision.id,
    dealId: correction.deal_id,
    delta,
    featureChanges,
    featureDeletes: [...delta.featureDelete],
    provisionsUpdate,
    newCorrectionRow,
  };
}

/* ── report formatting ───────────────────────────────────────────────────── */

function formatPlan(plan) {
  if (!plan.ok) {
    const lines = [`REFUSED: ${plan.reason}`];
    if (plan.conflicts && plan.conflicts.length > 0) {
      for (const c of plan.conflicts) {
        lines.push(`  ! ${c.key}: current=${JSON.stringify(c.current)} != before=${JSON.stringify(c.before)}`);
      }
    }
    return lines.join('\n');
  }
  const lines = [
    `Re-home correction ${plan.correctionId} onto provision ${plan.provisionId} (deal ${plan.dealId})`,
    ...(Object.keys(plan.delta.set).length
      ? Object.entries(plan.delta.set).map(([k, v]) => `  scalar ${k}: -> ${JSON.stringify(v)}`)
      : []),
    ...plan.featureChanges.map((c) => `  feature ${c.key}: ${JSON.stringify(c.current)} -> ${JSON.stringify(c.next)}`),
    ...(plan.featureDeletes.length ? [`  features deleted: ${plan.featureDeletes.join(', ')}`] : []),
  ];
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
    'Usage: node scripts/curation/rehome-correction.js --correction <uuid> --provision <uuid> [--apply]',
  );
  process.exit(1);
}

function parseArgs(argv) {
  const args = { correction: null, provision: null, apply: false };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--correction') args.correction = argv[++i];
    else if (a === '--provision') args.provision = argv[++i];
    else if (a === '--apply') args.apply = true;
    else { console.error(`Unknown arg: ${a}`); usage(); }
  }
  if (!args.correction || !args.provision) usage();
  return args;
}

async function fetchCorrection(sb, id) {
  const { data, error } = await sb
    .from('corrections')
    .select('id, deal_id, before, after, correction_type')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`corrections fetch failed: ${error.message}`);
  return data || null;
}

async function fetchProvision(sb, id) {
  const { data, error } = await sb
    .from('provisions')
    .select('id, deal_id, type, category, full_text, ai_metadata')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`provisions fetch failed: ${error.message}`);
  return data || null;
}

// The only two writes this tool ever performs: UPDATE the target provision,
// then INSERT the fresh corrections row. Never touches any other table,
// never deletes the original corrections row.
async function executeRehome(sb, plan) {
  const { error: updErr } = await sb.from('provisions').update(plan.provisionsUpdate).eq('id', plan.provisionId);
  if (updErr) throw new Error(`provisions update failed: ${updErr.message}`);
  const { error: insErr } = await sb.from('corrections').insert(plan.newCorrectionRow);
  if (insErr) throw new Error(`corrections insert failed: ${insErr.message}`);
}

// Fetches both rows, plans, and (only under args.apply, only if the plan is
// ok) executes the writes. Exposed for tests with a mock `sb`.
async function runRehome(sb, args) {
  const correction = await fetchCorrection(sb, args.correction);
  const provision = await fetchProvision(sb, args.provision);
  const plan = planRehome(correction, provision);
  if (plan.ok && args.apply) {
    await executeRehome(sb, plan);
    plan.applied = true;
  } else {
    plan.applied = false;
  }
  return plan;
}

async function main() {
  loadDotEnvLocal();
  const args = parseArgs(process.argv);

  const { createClient } = require('@supabase/supabase-js');
  const dbUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!dbUrl || !key) { console.error('Supabase creds required (env / .env.local).'); process.exit(1); }
  const sb = createClient(dbUrl, key);

  console.log(`rehome-correction — correction ${args.correction} -> provision ${args.provision} (${args.apply ? 'APPLY' : 'dry-run'})`);

  const plan = await runRehome(sb, args);
  console.log(formatPlan(plan));

  if (!plan.ok) {
    process.exitCode = 1;
    return;
  }

  if (!args.apply) {
    console.log('\nDry-run complete: no writes. Re-run with --apply to commit.');
    return;
  }

  console.log('\nApplied: provisions row updated, fresh corrections row inserted.');
}

module.exports = {
  findConflicts,
  planRehome,
  formatPlan,
  fetchCorrection,
  fetchProvision,
  executeRehome,
  runRehome,
  parseArgs,
};

if (require.main === module) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
