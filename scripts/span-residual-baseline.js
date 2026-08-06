#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────
   scripts/span-residual-baseline.js — span accounting spec, Part 3 rollout
   gate 1: REPORT-ONLY corpus baseline.
   (docs/archive/handoffs/SPAN-ACCOUNTING-SPEC-2026-07-18.md)

   Runs the Part 1 (subclauses.js) / Part 2 (span-claims.js) / Part 3
   (span-residual.js) machinery over every deal's ALREADY-STORED provisions
   and classified_sections snapshot — no re-extraction, no writes, no
   ingest-path involvement. For each classified section with a real body
   (>=200 chars), the section's stored provisions are mapped back to it by
   CONTENT (lib/parser-v2/attribute-provision-section.js — resilient to
   ai_metadata.startChar drifting relative to a since-overwritten
   classified_sections snapshot; see that module's header), each
   provision's full_text is located against the section text
   (span-claims.js's computeSpanClaims), and the union of claimedSpans is
   passed to computeSectionResidual. Sections that clear the residual
   thresholds are EXTRACTION_INCOMPLETE.

   This is exactly the retroactive check the spec's rollout gate 1 asks for:
   "run over all 40 deals' stored snapshots ... expect Redfin §2.10 and QXO
   §5.2 flagged; investigate anything else large before enforcement." NO
   enforcement, NO ingest-path change — this script only reads and reports.

     node scripts/span-residual-baseline.js

   Writes reports/span-residual-baseline.json. Read-only. Creds from env or
   .env.local (see README / CLAUDE.md: `set -a; . .env.local; set +a`).
   ───────────────────────────────────────────────────────────────────────── */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { computeSpanClaims } = require('../lib/parser-v2/span-claims');
const { computeSectionResidual } = require('../lib/parser-v2/span-residual');
const { STRATEGY_A_TYPES, STRATEGY_C_TYPES } = require('../lib/parser-v2/extract');
const { attributeProvisionsToSections } = require('../lib/parser-v2/attribute-provision-section');

// Part 2 wires span claims for "strategy A (IOC/COND) and strategy C (REP)
// provisions" ONLY — this baseline follows the same scope. Strategy B
// (NOSOL/ANTI/TERMF — multi-code, overlapping spans) and Strategy D (DEF —
// definitions pulled from anywhere in the document, not 1:1 with a single
// classified section's text) were never claimed-against by Part 2's design,
// so checking their sections against this residual model produces noise,
// not signal (confirmed live: DEF sections read 100% residual because DEF
// provisions' full_text is a short excerpt whose surrounding definition can
// legitimately be pulled from elsewhere in the filing, not the "1.1 Certain
// Definitions" section body itself).
const IN_SCOPE_TYPES = new Set([...STRATEGY_A_TYPES, ...STRATEGY_C_TYPES]);

function loadDotEnvLocal() {
  const p = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
}

const MIN_SECTION_CHARS = 200;

// Map each of a deal's stored provisions to the classified section it
// CURRENTLY belongs to, so the residual check sees the SAME set of "what
// did extraction emit for this section" that the live pipeline produced —
// without needing a re-extraction.
//
// Attribution is CONTENT-based (lib/parser-v2/attribute-provision-section.js),
// not a stale-startChar containment check: a provision's ai_metadata.
// startChar is stamped once, when it was last extracted, while
// classified_sections is a snapshot that gets overwritten wholesale by any
// later classification run — the two can disagree about where a section
// starts even though nothing about the provision's own text changed. Before
// this fix, the numeric-containment version of this function was the cause
// of 470 of the 952 sections flagged in the 2026-07-18 baseline run
// (reports/span-residual-baseline.json) reading as zero-provision /
// EXTRACTION_INCOMPLETE: not because extraction dropped anything, but
// because this function couldn't find the (undisturbed) provision under the
// section's new boundaries. See docs/codex-program/ROADMAP.md P5 and
// attribute-provision-section.js's header for the full mechanism.
function groupProvisionsBySection(sections, provisions) {
  const attributed = attributeProvisionsToSections(sections, provisions); // startChar -> [provision, ...]
  const bySection = new Map(); // startChar -> [provision full_text, ...] — this function's contract
  for (const [startChar, provs] of attributed.entries()) {
    bySection.set(startChar, provs.map((prov) => prov.full_text || ''));
  }
  return bySection;
}

async function runForDeal(sb, deal) {
  const metadata = deal.metadata || {};
  const sections = Array.isArray(metadata.classified_sections) ? metadata.classified_sections : [];
  if (!sections.length) return { dealId: deal.id, target: deal.target, acquirer: deal.acquirer, skipped: 'no classified_sections', flaggedSections: [] };

  const { data: provisions, error } = await sb
    .from('provisions')
    .select('type, full_text, ai_metadata')
    .eq('deal_id', deal.id);
  if (error) {
    return { dealId: deal.id, target: deal.target, acquirer: deal.acquirer, skipped: `provisions query error: ${error.message}`, flaggedSections: [] };
  }

  const bySection = groupProvisionsBySection(sections, provisions || []);
  const flaggedSections = [];
  let sectionsChecked = 0;

  for (const sec of sections) {
    if (!IN_SCOPE_TYPES.has(sec.type)) continue; // Strategy A/C only — see IN_SCOPE_TYPES above
    const sectionText = sec.text || '';
    if (sectionText.length < MIN_SECTION_CHARS) continue;
    sectionsChecked++;

    const provTexts = bySection.get(sec.startChar) || [];
    const items = provTexts.map((text) => ({ text }));
    const claimed = computeSpanClaims(sectionText, items);
    const claimedSpans = claimed.flatMap((c) => c.claimedSpans);
    const unlocatedCount = claimed.filter((c) => c.spanUnlocated).length;

    const residual = computeSectionResidual(sectionText, claimedSpans);
    if (residual.flagged) {
      flaggedSections.push({
        sectionNumber: sec.sectionNumber || null,
        title: sec.title || null,
        type: sec.type || null,
        startChar: sec.startChar,
        provisionCount: provTexts.length,
        unlocatedProvisions: unlocatedCount,
        sectionChars: residual.sectionChars,
        residualChars: residual.residualChars,
        residualRatio: Math.round(residual.residualRatio * 1000) / 1000,
        drops: residual.drops.map((d) => ({ marker: d.marker, depth: d.depth, length: d.length, preview: d.preview })),
      });
    }
  }

  return {
    dealId: deal.id,
    target: deal.target,
    acquirer: deal.acquirer,
    sectionsChecked,
    sectionsFlagged: flaggedSections.length,
    flaggedSections,
  };
}

async function main() {
  loadDotEnvLocal();
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (env or .env.local).');
    process.exit(1);
  }
  const sb = createClient(url, key);

  const { data: deals, error } = await sb.from('deals').select('id, target, acquirer, metadata');
  if (error) {
    console.error('deals query failed:', error.message);
    process.exit(1);
  }

  console.log(`[span-residual-baseline] ${deals.length} deals — computing REPORT-ONLY residual (no writes, no re-extraction)...`);

  const perDeal = [];
  for (const deal of deals) {
    // Sequential — this is a report run, not a throughput-sensitive job, and
    // sequential keeps Supabase load predictable across 40 deals' provisions.
    // eslint-disable-next-line no-await-in-loop
    const result = await runForDeal(sb, deal);
    perDeal.push(result);
    const label = `${result.target || '?'} vs ${result.acquirer || '?'}`;
    if (result.skipped) {
      console.log(`  - ${label}: SKIPPED (${result.skipped})`);
    } else {
      console.log(`  - ${label}: ${result.sectionsFlagged}/${result.sectionsChecked} sections flagged`);
    }
  }

  const allFlagged = perDeal.flatMap((d) => (d.flaggedSections || []).map((s) => ({
    dealId: d.dealId,
    target: d.target,
    acquirer: d.acquirer,
    ...s,
  })));
  allFlagged.sort((a, b) => b.residualChars - a.residualChars);

  const totalSectionsChecked = perDeal.reduce((n, d) => n + (d.sectionsChecked || 0), 0);
  const totalSectionsFlagged = perDeal.reduce((n, d) => n + (d.sectionsFlagged || 0), 0);
  const dealsSkipped = perDeal.filter((d) => d.skipped).length;
  // A flagged section with ZERO provisions mapped to it is a
  // provision-to-section ATTRIBUTION miss (this script reconstructs mapping
  // retroactively from ai_metadata.startChar containment, since Part 2's
  // span-claims wiring is inert and was never run live for any of this
  // corpus) — not necessarily a genuine EXTRACTION_INCOMPLETE defect. Report
  // both counts so the headline number isn't read as "952 real drops."
  const zeroProvisionFlags = allFlagged.filter((s) => s.provisionCount === 0).length;

  const report = {
    generatedAt: new Date().toISOString(),
    spec: 'docs/archive/handoffs/SPAN-ACCOUNTING-SPEC-2026-07-18.md Part 3, rollout gate 1 (REPORT-ONLY)',
    note: 'Retroactive reconstruction over STORED provisions/snapshots (Part 2 span-claims wiring is inert by default and was never run live for this corpus). A flagged section with provisionCount:0 is a provision-to-section ATTRIBUTION miss (stale ai_metadata.startChar vs. the current classified_sections snapshot, or a Strategy re-run that changed section boundaries) — investigate zeroProvisionFlags separately from genuine partial-coverage flags before treating this as an extraction-quality signal.',
    dealsTotal: deals.length,
    dealsSkipped,
    totalSectionsChecked,
    totalSectionsFlagged,
    zeroProvisionFlags,
    genuinePartialCoverageFlags: totalSectionsFlagged - zeroProvisionFlags,
    topOffendersBySize: allFlagged.slice(0, 25),
    perDeal,
  };

  const outPath = path.join(__dirname, '..', 'reports', 'span-residual-baseline.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log('');
  console.log(`[span-residual-baseline] ${totalSectionsFlagged}/${totalSectionsChecked} sections flagged EXTRACTION_INCOMPLETE across ${deals.length} deals (${dealsSkipped} skipped).`);
  console.log(`[span-residual-baseline]   of which ${zeroProvisionFlags} are zero-provision ATTRIBUTION misses (retroactive-mapping artifact) and ${totalSectionsFlagged - zeroProvisionFlags} have provisions attributed but still under-covered.`);
  console.log(`[span-residual-baseline] wrote ${outPath}`);
  console.log('');
  console.log('Top 10 by residual size:');
  for (const s of allFlagged.slice(0, 10)) {
    console.log(`  ${s.residualChars.toString().padStart(6)} chars (${(s.residualRatio * 100).toFixed(0)}%)  ${s.target} vs ${s.acquirer}  §${s.sectionNumber || '?'} "${s.title || ''}"`);
  }
}

// Guarded so `require('./span-residual-baseline')` (test files proving
// groupProvisionsBySection's attribution fix in its real habitat, without a
// DB) does not also try to connect to Supabase and exit the process — CLI
// behavior (`node scripts/span-residual-baseline.js`) is unchanged.
if (require.main === module) {
  main().catch((err) => {
    console.error('[span-residual-baseline] fatal:', err);
    process.exit(1);
  });
}

module.exports = { groupProvisionsBySection, runForDeal, IN_SCOPE_TYPES };
