#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────
   scripts/cleanup-fragment-definitions.js — UI Feedback Round 3, item 16
   data-repair (docs/archive/handoffs/UI-FEEDBACK-R3-SPEC-2026-07-18.md).

   DRY-RUN BY DEFAULT. Prints every card it WOULD delete (deal + term/
   title) and writes NOTHING unless invoked with --apply. Per the R3
   handoff's implementation gate: dry-run output is for Fable review before
   --apply, and scripts/ingest-qa.js must be run after any --apply.

   Two independent cleanup passes over `provision_cards`, corpus-wide (or
   scoped to one deal with --deal <uuid|substring>):

   1. Fragment defined terms (provision_type = 'DEFINITION'): mid-sentence/
      mid-phrase captures minted by ingestion ("from", "to the extent",
      "made available", "under common control with", a lowercase
      "knowledge", stray "wise"/"likewise"/"otherwise") that are not real
      defined terms. Same rule as the render-time filter in
      components/review-v2/provisionIndexHelpers.js#isFragmentDefinedTerm
      (imported directly here, single source of truth for the rule) --
      defined_term starts lowercase, OR is a bare blocklisted stopword/
      connector phrase, OR is shorter than 3 characters.

   2. Same-deal duplicate collapse for NON-DEFINITION cards: two cards on
      the same deal sharing (section_ref, short_title, provision_subtype)
      are the same provision extracted twice (Theravance: two 6.1
      "Information to Regulators" cards, 5eea8833… and a2e67986…). Keeps
      the card with the LONGER captured text (region_full_text ||
      primary_quote); the shorter duplicate is deleted.

   Usage:
     node scripts/cleanup-fragment-definitions.js                    # dry run, all deals
     node scripts/cleanup-fragment-definitions.js --deal Theravance   # dry run, one deal
     node scripts/cleanup-fragment-definitions.js --apply             # WRITE deletes
     [--json]

   Flags:
     --deal <uuid|substring>   filter to deals whose id or target/acquirer
                               name matches (case-insensitive substring)
     --apply                   delete the flagged rows (dry-run without it)
     --json                    also print the full plan as JSON
   ───────────────────────────────────────────────────────────────────────── */

const path = require('path');

function parseArgs(argv) {
  const args = { apply: false, json: false, deal: null };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--apply') args.apply = true;
    else if (a === '--json') args.json = true;
    else if (a === '--deal') { args.deal = argv[i + 1]; i += 1; }
  }
  return args;
}

// ── pure planning helpers (exported for tests -- no DB, no network) ────────

function sectionRefNumber(ref) {
  return String(ref || '').split('|')[0].trim();
}

// Same duplicate-collapse rule as provisionIndexHelpers.js#dedupeBySectionAndTitle,
// but scoped to a single deal's NON-DEFINITION cards and keyed additionally
// by provision_subtype (the render-time dedupe doesn't have subtype handy;
// the data-repair pass does, and it's a stronger, more precise key).
function planDuplicateDeletes(cards) {
  const nonDefinitions = (cards || []).filter((c) => c && c.provision_type !== 'DEFINITION');
  const byKey = new Map();
  for (const card of nonDefinitions) {
    const title = String(card.short_title || '').trim().toLowerCase();
    if (!title) continue; // no title -> not a comparable duplicate candidate
    const key = `${sectionRefNumber(card.section_ref)}|${title}|${String(card.provision_subtype || '').trim().toLowerCase()}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(card);
  }
  const deletes = [];
  for (const group of byKey.values()) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => {
      const lenA = (a.region_full_text || a.primary_quote || '').length;
      const lenB = (b.region_full_text || b.primary_quote || '').length;
      return lenB - lenA; // longest first
    });
    const [keep, ...drop] = sorted;
    for (const card of drop) {
      deletes.push({
        id: card.id,
        reason: 'duplicate',
        keptId: keep.id,
        section_ref: card.section_ref,
        short_title: card.short_title,
        provision_subtype: card.provision_subtype,
        textLength: (card.region_full_text || card.primary_quote || '').length,
        keptTextLength: (keep.region_full_text || keep.primary_quote || '').length,
      });
    }
  }
  return deletes;
}

function planFragmentDeletes(cards, isFragmentDefinedTerm) {
  // A NULL/empty defined_term is a DIFFERENT, out-of-scope data issue (a
  // definition card that never got a term assigned at all) -- NOT the
  // lowercase/stopword-fragment junk this pass targets. The render path
  // (DefinitionsSection) already guards on `d.defined_term` truthiness
  // before ever calling isFragmentDefinedTerm; mirror that guard here so a
  // corpus with many null-defined_term rows (confirmed live on Theravance:
  // 52 of 57 dry-run hits were null, not real fragments) doesn't get them
  // silently swept into a "fragment cleanup" delete.
  const definitions = (cards || []).filter((c) => c && c.provision_type === 'DEFINITION' && c.defined_term);
  return definitions
    .filter((c) => isFragmentDefinedTerm(c.defined_term))
    .map((c) => ({
      id: c.id,
      reason: 'fragment-definition',
      defined_term: c.defined_term,
      section_ref: c.section_ref,
    }));
}

function buildDealPlan(dealLabel, cards, isFragmentDefinedTerm) {
  const fragmentDeletes = planFragmentDeletes(cards, isFragmentDefinedTerm);
  const duplicateDeletes = planDuplicateDeletes(cards);
  return { dealLabel, fragmentDeletes, duplicateDeletes };
}

function formatPlanReport(plans) {
  const lines = [];
  let totalFragments = 0;
  let totalDuplicates = 0;
  for (const plan of plans) {
    if (!plan.fragmentDeletes.length && !plan.duplicateDeletes.length) continue;
    lines.push(`\n${plan.dealLabel}`);
    for (const d of plan.fragmentDeletes) {
      lines.push(`  [fragment-definition] "${d.defined_term}" (${d.section_ref || 'no section'}) — id ${d.id}`);
    }
    for (const d of plan.duplicateDeletes) {
      lines.push(`  [duplicate] "${d.short_title}" (${d.section_ref || 'no section'}, ${d.provision_subtype || 'no subtype'}) — deleting id ${d.id} (${d.textLength} chars), keeping id ${d.keptId} (${d.keptTextLength} chars)`);
    }
    totalFragments += plan.fragmentDeletes.length;
    totalDuplicates += plan.duplicateDeletes.length;
  }
  lines.push(`\nTotal: ${totalFragments} fragment definition(s), ${totalDuplicates} duplicate card(s) flagged for deletion across ${plans.length} deal(s) scanned.`);
  return lines.join('\n');
}

module.exports = { sectionRefNumber, planDuplicateDeletes, planFragmentDeletes, buildDealPlan, formatPlanReport, parseArgs };

// ── DB-touching main (skipped under require(), e.g. from tests) ───────────
if (require.main === module) {
  (async () => {
    const args = parseArgs(process.argv);
    const { isFragmentDefinedTerm } = await import(path.join('..', 'components', 'review-v2', 'provisionIndexHelpers.js'));

    const { createClient } = require('@supabase/supabase-js');
    const dbUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!dbUrl || !key) { console.error('Supabase creds required (env / .env.local).'); process.exit(1); }
    const sb = createClient(dbUrl, key);

    console.log(`Mode: ${args.apply ? 'APPLY (writing deletes)' : 'DRY RUN (no writes — pass --apply to write)'}`);
    if (args.deal) console.log(`Filter: deals matching "${args.deal}"`);

    const { data: allDeals, error: dealsErr } = await sb
      .from('deals')
      .select('id, acquirer, target')
      .order('created_at', { ascending: true });
    if (dealsErr) { console.error(`Deal fetch failed: ${dealsErr.message}`); process.exit(1); }

    const deals = args.deal
      ? (allDeals || []).filter((d) => d.id === args.deal || `${d.acquirer || ''} ${d.target || ''}`.toLowerCase().includes(args.deal.toLowerCase()))
      : (allDeals || []);
    if (!deals.length) { console.error('No matching deals.'); process.exit(1); }

    const plans = [];
    for (const deal of deals) {
      const { data: cards, error: cardsErr } = await sb
        .from('provision_cards')
        .select('id, provision_type, provision_subtype, section_ref, short_title, defined_term, region_full_text, primary_quote')
        .eq('deal_id', deal.id);
      if (cardsErr) { console.error(`Card fetch failed for ${deal.id}: ${cardsErr.message}`); continue; }
      const dealLabel = `${deal.target || deal.id} (acquired by ${deal.acquirer || '?'}) [${deal.id}]`;
      plans.push(buildDealPlan(dealLabel, cards || [], isFragmentDefinedTerm));
    }

    console.log(formatPlanReport(plans));
    if (args.json) console.log(JSON.stringify(plans, null, 2));

    if (!args.apply) {
      console.log('\nDry run complete — no writes. Pass --apply to write (after Fable review of the plan above).');
      return;
    }

    console.log('\nApplying deletes...');
    let deleted = 0;
    let failed = 0;
    for (const plan of plans) {
      const ids = [...plan.fragmentDeletes, ...plan.duplicateDeletes].map((d) => d.id);
      for (const id of ids) {
        // eslint-disable-next-line no-await-in-loop
        const { error } = await sb.from('provision_cards').delete().eq('id', id);
        if (error) { console.error(`  FAILED to delete ${id}: ${error.message}`); failed += 1; }
        else deleted += 1;
      }
    }
    console.log(`\nDeleted ${deleted} row(s), ${failed} failure(s). Run scripts/ingest-qa.js next.`);
    if (failed) process.exitCode = 1;
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
