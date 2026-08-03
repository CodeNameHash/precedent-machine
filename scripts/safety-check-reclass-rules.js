#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────
   scripts/safety-check-reclass-rules.js — MANDATORY pre-write safety check
   for the v1 reclassification slice (docs/superpowers/specs/
   2026-08-02-v1-reclassification-design.md §3), mechanizing the CLAUDE.md
   "safety check against all deals' section titles" rule for the R1/R2
   classify-rule additions (REP-T-STOCKAPPROVAL/GOVAPPROVAL,
   REP-T-40ACT/ADVISERSACT/INSREG/CFIUS title routing).

   Same pattern as scripts/safety-check-nosol-rule.js: runs the OLD
   (`git show HEAD:`) and NEW `refineSubCode` (classify.js
   SUBCODE_REFINEMENT_RULES) against every deal's stored
   deals.metadata.classified_sections — no re-parse, no LLM call, read-only
   against the DB — and reports every section whose classify-time
   sub-code would change (including sections that previously got NO
   sub-code from classify at all, since R1/R2's old codes — REP-T-CONSENT /
   REP-T-REGSTATUS — were AI-classification-only: no classify.js rule EVER
   stamped them, so every new title-rule match is a fresh stamp, not a
   replacement).

   R3 (REP-B-ANTIRELIANCE / REP-B-NOREP / REP-T-NOREP) is DELIBERATELY OUT
   OF SCOPE for this script — classify.js's SUBCODE_REFINEMENT_RULES for
   the anti-reliance family are UNCHANGED by this slice (the element split
   happens in the EXTRACT phase, not classify — see
   lib/parser-v2/extract.js's expandAntiRelianceElements and the design
   doc's "RELOCATED per audit A-C1" note). A classify-level title-rule diff
   is the wrong tool for a regex-cannot-diff, extract-phase deterministic
   emitter; the design doc's own verification plan for R3 is the 29-card
   hand review (§4), not this script.

   PINNED EXPECTATIONS (design doc §3): this slice's corpus investigation
   enumerated 19 REP-T-CONSENT cards / 17 deals and 10 REP-T-REGSTATUS
   cards / 8 deals as the AI-classified population these rules eventually
   feed (that population is NOT what this CLASSIFY-level script measures —
   it measures the smaller "regular title" subset the new deterministic
   rules can catch; the bulk stays AI-classified against the new CODES
   vocabulary, by design — see the design doc §2 R1/R2 note). This script's
   job is narrower and stricter: assert that the title rules added ONLY
   fire on the intended regular titles and produce ZERO unexpected flips —
   any flip outside the pinned set is a STOP-before-writes signal.

   Two known misclassifications the ruling doc calls out explicitly exit to
   backlog and must NOT land in a new bucket via this classify-level
   change: Bonds (deal id prefix df393645) §3.22, Foreign Matters (deal id
   prefix ce061fd0) §3.26. Both are asserted to receive NO new deterministic
   code from these rules (they must keep falling through to AI/open
   review).

   OFFLINE SLICE NOTE (2026-08-02 build, docs/superpowers/specs/
   2026-08-02-v1-reclassification-design.md, "CODE ONLY... no reads
   needed"): this script is written so it CAN run later against the live
   DB — it was NOT executed as part of this slice (no DB reads performed).
   The design doc's own first-step pin ("the slice's FIRST step is the
   read-only corpus count of REP-T-NOREP, added to the pin by deal +
   section_ref before any rule edits") is therefore also NOT done here —
   see the slice handoff's explicit gap list.

   Usage (once DB creds are available):
     node scripts/safety-check-reclass-rules.js
     node scripts/safety-check-reclass-rules.js --json
   ───────────────────────────────────────────────────────────────────────── */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { refineSubCode: newRefineSubCode } = require('../lib/parser-v2/classify');
const {
  EXPECTED_R1R2_FLIPS,
  R1R2_CARD_RULINGS,
  REP_T_NOREP_PIN,
} = require('./reprocess/v1-reclassification-pins');

// The specific known-miscoded cards the ruling doc pins as MUST-exit-to-
// backlog — asserted to receive NO new deterministic sub-code from this
// slice's rules.
const BACKLOG_EXITS = [
  { dealIdPrefix: 'df393645', sectionNumber: '3.22', label: 'Bonds' },
  { dealIdPrefix: 'ce061fd0', sectionNumber: '3.26', label: 'Foreign Matters' },
];

/**
 * Loads the PRE-change refineSubCode from the last commit before this slice
 * into a throwaway sibling module, same technique as
 * safety-check-nosol-rule.js's loadOldTryDeterministic.
 */
const BASELINE_REF = '1ce030c^';

function loadOldRefineSubCode(ref = BASELINE_REF) {
  const tmpPath = path.join(__dirname, '..', 'lib', 'parser-v2', '_classify-old-snapshot-reclass.js');
  const oldSource = execFileSync('git', ['show', `${ref}:lib/parser-v2/classify.js`], {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8',
  });
  fs.writeFileSync(tmpPath, oldSource);
  try {
    delete require.cache[require.resolve(tmpPath)];
    const old = require(tmpPath);
    return old.refineSubCode;
  } finally {
    fs.unlinkSync(tmpPath);
  }
}

function findDotEnvLocal(start = path.join(__dirname, '..')) {
  let dir = start;
  for (;;) {
    const candidate = path.join(dir, '.env.local');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function loadDotEnvLocal(envPath = findDotEnvLocal()) {
  if (!envPath || !fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

// Codes this slice's rules can possibly stamp — anything else appearing as
// a `newSub` is, by construction, a bug in the diff (not this slice's
// change) and should fail loudly rather than being silently accepted.
const R1R2_NEW_CODES = new Set([
  'REP-T-STOCKAPPROVAL', 'REP-T-GOVAPPROVAL', 'REP-T-40ACT',
]);

function sectionNumberFromRef(value) {
  return String(value || '').split(' | ')[0];
}

function comparePinnedKeys(actualKeys, expectedKeys) {
  const actual = new Set(actualKeys);
  const expected = new Set(expectedKeys);
  return {
    unexpected: [...actual].filter((key) => !expected.has(key)).sort(),
    missing: [...expected].filter((key) => !actual.has(key)).sort(),
  };
}

function flipKey(value) {
  if (Array.isArray(value)) return value.join('|');
  return [String(value.dealId || '').slice(0, 8), value.sectionNumber, value.newSub].join('|');
}

function cardKey(value) {
  if (Array.isArray(value)) return value.slice(0, 3).join('|');
  return [value.id, String(value.deal_id || '').slice(0, 8), sectionNumberFromRef(value.section_ref)].join('|');
}

/**
 * Pure core: given all deals' classified_sections snapshots and the
 * PRE-change refineSubCode function, return the list of
 * { dealId, dealLabel, sectionNumber, title, oldSub, newSub } flips the
 * new R1/R2 rules would produce, restricted to resolvedType 'REP-T'
 * (the only whenType these rules fire under). No I/O — unit-testable.
 */
function computeFlips(deals, oldRefineSubCode) {
  const flips = [];
  for (const deal of deals) {
    const meta = deal.metadata || {};
    const sections = Array.isArray(meta.classified_sections) ? meta.classified_sections : [];
    const dealLabel = `${deal.acquirer || ''}/${deal.target || ''}`.replace(/^\/|\/$/g, '') || deal.id;
    for (const section of sections) {
      if (section.type !== 'REP-T') continue; // R1/R2 rules only fire whenType: 'REP-T'
      const sectionArg = { title: section.title, heading: section.title };
      const oldSub = oldRefineSubCode(sectionArg, 'REP-T') || null;
      const newSub = newRefineSubCode(sectionArg, 'REP-T') || null;
      if (oldSub === newSub) continue;
      flips.push({
        dealId: deal.id,
        dealLabel,
        sectionNumber: section.sectionNumber || null,
        title: section.title || null,
        oldSub,
        newSub,
      });
    }
  }
  return flips;
}

/**
 * Asserts the two known backlog-exit cards receive NO new deterministic
 * sub-code (they must keep falling through to AI/open review — never
 * silently land in a new bucket). Returns violations (empty = clean).
 */
function checkBacklogExits(deals) {
  const violations = [];
  for (const exit of BACKLOG_EXITS) {
    const deal = (deals || []).find((d) => String(d.id || '').startsWith(exit.dealIdPrefix));
    if (!deal) continue; // deal not present in this snapshot — nothing to assert
    const meta = deal.metadata || {};
    const sections = Array.isArray(meta.classified_sections) ? meta.classified_sections : [];
    const section = sections.find((s) => String(s.sectionNumber || '') === exit.sectionNumber);
    if (!section) continue;
    const sectionArg = { title: section.title, heading: section.title };
    const newSub = newRefineSubCode(sectionArg, section.type) || null;
    if (newSub) {
      violations.push({ ...exit, dealId: deal.id, newSub });
    }
  }
  return violations;
}

// This subset deliberately excludes provision_cards. Fixture card replacement
// changes the retired-card population by design, but must never weaken the
// classify-before-write gate used for subsequent fixture deals.
function assertExactDeterministicSafetySubset(deals, oldRefineSubCode = loadOldRefineSubCode()) {
  const flips = computeFlips(deals || [], oldRefineSubCode);
  const flipPin = comparePinnedKeys(
    flips.map(flipKey),
    EXPECTED_R1R2_FLIPS.map(flipKey),
  );
  const backlogViolations = checkBacklogExits(deals || []);
  const invalidCodes = flips.filter((flip) => !R1R2_NEW_CODES.has(flip.newSub));
  if (invalidCodes.length || backlogViolations.length || flipPin.unexpected.length || flipPin.missing.length) {
    throw new Error(
      `v1 deterministic safety subset failed: ${invalidCodes.length} invalid code(s), ` +
      `${backlogViolations.length} backlog violation(s), ${flipPin.unexpected.length} unexpected flip(s), ` +
      `${flipPin.missing.length} missing flip(s)`,
    );
  }
  return { flips, flipPin, backlogViolations };
}

async function main() {
  loadDotEnvLocal();
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');

  const { createClient } = require('@supabase/supabase-js');
  const dbUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!dbUrl || !key) { console.error('Supabase creds required (env / .env.local).'); process.exit(1); }
  const sb = createClient(dbUrl, key);

  const { data: deals, error } = await sb.from('deals').select('id, acquirer, target, metadata');
  if (error) { console.error(`Deal fetch failed: ${error.message}`); process.exit(1); }

  const { data: retiredCards, error: retiredCardsError } = await sb
    .from('provision_cards')
    .select('id, deal_id, provision_subtype, section_ref')
    .in('provision_subtype', ['REP-T-CONSENT', 'REP-T-REGSTATUS', 'REP-T-NOREP']);
  if (retiredCardsError) {
    console.error(`Retired-card fetch failed: ${retiredCardsError.message}`);
    process.exit(1);
  }

  const oldRefineSubCode = loadOldRefineSubCode();
  const flips = computeFlips(deals || [], oldRefineSubCode);
  const backlogViolations = checkBacklogExits(deals || []);

  const invalidCodes = flips.filter((f) => !R1R2_NEW_CODES.has(f.newSub));
  const flipPin = comparePinnedKeys(
    flips.map(flipKey),
    EXPECTED_R1R2_FLIPS.map(flipKey),
  );
  const r1r2Cards = retiredCards.filter((card) =>
    card.provision_subtype === 'REP-T-CONSENT' || card.provision_subtype === 'REP-T-REGSTATUS');
  const noRepCards = retiredCards.filter((card) => card.provision_subtype === 'REP-T-NOREP');
  const r1r2CardPin = comparePinnedKeys(r1r2Cards.map(cardKey), R1R2_CARD_RULINGS.map(cardKey));
  const noRepPin = comparePinnedKeys(noRepCards.map(cardKey), REP_T_NOREP_PIN.map(cardKey));
  const pinIssues = [
    ...flipPin.unexpected,
    ...flipPin.missing,
    ...r1r2CardPin.unexpected,
    ...r1r2CardPin.missing,
    ...noRepPin.unexpected,
    ...noRepPin.missing,
  ];

  if (asJson) {
    console.log(JSON.stringify({
      dealCount: (deals || []).length,
      flipCount: flips.length,
      flips,
      unexpectedCount: invalidCodes.length,
      backlogViolations,
      flipPin,
      r1r2CardReviewCount: R1R2_CARD_RULINGS.length,
      r1r2CardPin,
      repTNoRepCount: noRepCards.length,
      noRepPin,
    }, null, 2));
    if (invalidCodes.length > 0 || backlogViolations.length > 0 || pinIssues.length > 0) process.exitCode = 1;
    return;
  }

  console.log(`Scanned ${deals ? deals.length : 0} deals.`);
  console.log(`${flips.length} REP-T section(s) would get a new/changed sub-code under the R1/R2 rules:\n`);
  for (const f of flips) {
    console.log(`  [${f.dealLabel}] ${f.sectionNumber || '(no #)'} "${f.title}" : ${f.oldSub || '(none)'} -> ${f.newSub}`);
  }

  console.log('');
  if (backlogViolations.length > 0) {
    console.log(`STOP: ${backlogViolations.length} known-backlog card(s) received a new deterministic code instead of exiting to review:`);
    for (const v of backlogViolations) console.log(`  ${v.label} (${v.dealId}) §${v.sectionNumber} -> ${v.newSub}`);
  }
  if (invalidCodes.length > 0) {
    console.log(`STOP: ${invalidCodes.length} flip(s) use a code outside the R1/R2 code set. Do not proceed to writes.`);
    for (const f of invalidCodes) console.log(`  [${f.dealLabel}] ${f.sectionNumber || '(no #)'} : ${f.oldSub || '(none)'} -> ${f.newSub}`);
  }
  if (pinIssues.length > 0) {
    console.log(`STOP: ${pinIssues.length} pinned population difference(s). Do not proceed to writes.`);
    for (const key of pinIssues) console.log(`  ${key}`);
  }
  if (backlogViolations.length === 0 && invalidCodes.length === 0 && pinIssues.length === 0) {
    console.log(`Clean: exact 24-flip set, 29 reviewed R1/R2 cards and ${noRepCards.length} REP-T-NOREP cards match their pins.`);
  } else {
    process.exitCode = 1;
  }
}

module.exports = {
  computeFlips,
  checkBacklogExits,
  assertExactDeterministicSafetySubset,
  loadOldRefineSubCode,
  BACKLOG_EXITS,
  R1R2_NEW_CODES,
  BASELINE_REF,
  comparePinnedKeys,
  flipKey,
  cardKey,
};

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
