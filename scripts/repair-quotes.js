#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────
   scripts/repair-quotes.js — deterministic near-miss quote repairs.
   ───────────────────────────────────────────────────────────────────────────
   The trust layer (lib/verification.js) flags feature quotes that don't
   appear verbatim in the deal's source text. Most flags are matcher gaps
   (fixed in lib/verification.js); the remainder are NEAR-MISSES: the model
   lightly paraphrased an identifiable source span (dropped "any"/"further"/
   "(b)", typo'd a word, silently elided a clause). Those are repaired here —
   never by inventing text, only by replacing the stored quote with the EXACT
   substring of deals.metadata.full_text it was derived from.

   Each entry in REPAIRS pins one repair:
     • provision_id + find — the exact stored text being replaced (`find`
       must occur exactly once in the flagged quote string)
     • spanStart / spanEnd — normalized anchor phrases locating the source
       span. spanStart must occur EXACTLY ONCE in the normalized source;
       spanEnd (optional — omit when the span IS the start phrase) must occur
       exactly once within maxSpan chars after it. Any ambiguity aborts that
       repair — we never guess.
   The normalized span is mapped back to raw full_text offsets (binary search
   + local refinement) so the replacement is verbatim source text, original
   casing and punctuation included. The repaired quote is then re-verified
   with the same quoteAppearsIn the QA gate uses before anything is written.

   Dry-run by default; prints OLD → NEW per repair. --apply writes:
     • provisions.ai_metadata.features with the repaired strings (all other
       metadata preserved)
     • a `corrections` row per provision (the repo's edit-history convention,
       same shape as pages/api/provisions.js PATCH logging)

   Usage:
     node scripts/repair-quotes.js               # dry-run, all repairs
     node scripts/repair-quotes.js --deal Concho # dry-run, one deal
     node scripts/repair-quotes.js --apply

   Creds from env / .env.local, same pattern as scripts/ingest-qa.js.
   ───────────────────────────────────────────────────────────────────────── */

const fs = require('fs');
const path = require('path');
const { normalizeForMatch, quoteAppearsIn } = require('../lib/verification');

// Deals mid-re-ingest are never touched, even if listed in REPAIRS.
const SKIP_DEAL_IDS = new Set([
  '885edae5-49e8-464a-9f33-edd229119d7c', // Pfizer / Metsera
  'af4940e1-a645-437c-acfa-4a53e8d9f7ac', // Beach Acquisition / Skechers
]);

/* ── repair manifest (quote-fidelity pass, July 2026) ────────────────────── */

const REPAIRS = [
  {
    deal: 'Forest City',
    provision_id: 'f959d4d8-930a-4453-82ee-aee370f0dc50',
    note: 'model dropped "any" before "Taxes"',
    find: 'surrender any right to claim a refund or offset of Taxes that exceed $5,000,000 in the aggregate',
    spanStart: 'surrender any right to claim a refund or offset of any taxes',
    spanEnd: '$5,000,000 in the aggregate',
    maxSpan: 200,
  },
  {
    deal: 'Red Hat',
    provision_id: '15ccb685-5aba-434a-9511-b7dbe2fd20cc',
    note: 'model dropped "respective" (Section 6.01 lead-in)',
    find: 'The obligation of each party to effect the Merger',
    spanStart: 'the respective obligation of each party to effect the merger',
  },
  {
    deal: 'Red Hat',
    provision_id: 'e795bf04-1926-4556-b30e-dd391631720b',
    note: 'model rewrote carveout (d) lead "changes in" as "any change in"',
    find: 'any change in the financial, credit, banking or securities markets in the United States',
    spanStart: 'changes in the financial, credit, banking or securities markets in the united states',
  },
  {
    deal: 'Covance',
    provision_id: 'fddc5886-c1f9-4840-95bf-c5aaf87f3f0d',
    note: 'model rewrote "the parties hereto" as "the Company and Parent"',
    find: 'the Company and Parent acknowledge and agree that either the Company or Parent seeking an injunction or injunctions to prevent breaches of this Agreement and to enforce specifically the terms and provisions of this Agreement in accordance with this Section 8.10 shall not be required to provide any bond or other security in connection with any such order or injunction.',
    spanStart: 'the parties hereto acknowledge and agree that either the company or parent seeking',
    spanEnd: 'any bond or other security in connection with any such order or injunction.',
    maxSpan: 700,
  },
  {
    deal: 'Mr. Cooper',
    provision_id: '49eb220d-e353-4cd3-bec2-c9692925ee0c',
    note: 'model dropped "taken as a whole," from the (iii) solvency limb',
    find: 'and (iii) Cavalier and its Subsidiaries shall have adequate capital',
    spanStart: 'and (iii) cavalier and its subsidiaries, taken as a whole, shall have adequate capital',
  },
  {
    deal: 'Concho',
    provision_id: '3a12735c-7499-4312-ac3d-59f94f358f9e',
    note: 'model dropped the "(b)" enumeration marker inside the elision',
    find: 'or the Company or Parent terminates this Agreement pursuant to Section 8.1(b)(ii) (End Date) or Parent terminates this Agreement pursuant to Section 8.1(b)(iii) (Company Terminable Breach)',
    spanStart: 'or (b) the company or parent terminates this agreement pursuant to section 8.1(b)(ii) (end date) or parent terminates',
    spanEnd: '(company terminable breach)',
    maxSpan: 400,
  },
  {
    deal: 'Concho',
    provision_id: 'cabc903b-772c-4104-8e0b-dc77f9160bdd',
    note: 'model dropped the "(b)" enumeration marker inside the elision (parent variant)',
    find: 'or the Company or Parent terminates this Agreement pursuant to Section 8.1(b)(ii) (End Date) or the Company terminates this Agreement pursuant to Section 8.1(b)(iii) (Parent Terminable Breach)',
    spanStart: 'or (b) the company or parent terminates this agreement pursuant to section 8.1(b)(ii) (end date) or the company terminates',
    spanEnd: '(parent terminable breach)',
    maxSpan: 400,
  },
  {
    deal: 'Cooper Tire',
    provision_id: 'd9ba515d-64b0-4557-a4ae-f7722fd9efd7',
    note: 'model typo "reasonablyly" — exact parent-side span exists in source',
    find: 'liabilities or obligations that would not reasonablyly be expected to have, individually or in the aggregate, a Parent Material Adverse Effect',
    spanStart: 'liabilities or obligations that would not reasonably be expected to have, individually or in the aggregate, a parent material adverse effect',
  },
  {
    deal: 'Starwood',
    provision_id: '72b2d170-9d55-455a-9e21-546277b26594',
    note: 'model silently elided the indemnification-agreements clause (no ellipsis)',
    find: 'the governing or organizational documents of any subsidiary of Starwood; provided that any person to whom expenses are advanced provides an undertaking',
    spanStart: 'the governing or organizational documents of any subsidiary of starwood, as applicable, and any indemnification agreements',
    spanEnd: 'provided that any person to whom expenses are advanced provides an undertaking',
    maxSpan: 600,
  },
  {
    deal: 'Bioverativ',
    provision_id: '17a4c2bb-54e8-42e3-bc9a-fb1d02132e7d',
    note: 'model dropped "further," from the second proviso',
    find: 'provided, however, that the right to terminate this Agreement under this Section 8.01(b)(i)',
    spanStart: 'provided, further, however, that the right to terminate this agreement under this section 8.01(b)(i)',
  },
  {
    deal: 'Anadarko',
    provision_id: '9a55034e-a3c1-40ef-970b-947fb6845836',
    note: 'model rewrote the "neither...nor...shall be construed" negation as "shall not be construed" and silently elided the (or to request or authorize the Company...) parenthetical',
    find: "shall not be construed to require Parent or any of Parent's Subsidiaries to undertake ... any efforts or to take any action if such efforts or action would, or would reasonably be expected to, result in a Substantial Detriment",
    spanStart: 'neither the provisions of this section 7.1 nor any other provision of this agreement shall be construed to require parent',
    spanEnd: 'result in a substantial detriment',
    maxSpan: 700,
  },
  {
    deal: 'Prometheus',
    provision_id: '850a1d33-64b9-4de8-a37c-6a7fa2221048',
    note: 'model silently elided "by virtue of the Merger automatically and without any action on the part of the Company, Parent or the holder thereof," (no ellipsis) — fixes both instrumentVesting[2].text and instrumentTreatments[2].text in one pass, since the latter\'s stored text carries the former as its literal prefix',
    find: 'shall be automatically fully vested',
    spanStart: 'shall by virtue of the merger automatically and without any action on the part of the company, parent or the holder thereof, be automatically fully vested',
  },
];

/* ── env / CLI ───────────────────────────────────────────────────────────── */

function loadDotEnvLocal() {
  const p = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
}

function parseArgs(argv) {
  const args = { apply: false, deal: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') args.apply = true;
    else if (a === '--dry-run') args.apply = false;
    else if (a === '--deal') args.deal = argv[++i];
    else { console.error(`Unknown arg: ${a}`); process.exit(1); }
  }
  return args;
}

/* ── span location (exported for tests) ──────────────────────────────────── */

// Count non-overlapping occurrences.
function countOccurrences(hay, needle) {
  if (!needle) return 0;
  let n = 0;
  let i = 0;
  while ((i = hay.indexOf(needle, i)) !== -1) { n += 1; i += needle.length; }
  return n;
}

/**
 * Locate the UNIQUE normalized span [ns, ne) anchored by spanStart/spanEnd.
 * Returns null (with a reason via out.reason) on any ambiguity.
 */
function locateNormSpan(normSource, spanStart, spanEnd, maxSpan = 600) {
  const startN = normalizeForMatch(spanStart);
  const startCount = countOccurrences(normSource, startN);
  if (startCount !== 1) return { error: `spanStart occurs ${startCount}x (need exactly 1)` };
  const ns = normSource.indexOf(startN);
  if (!spanEnd) return { ns, ne: ns + startN.length };
  const endN = normalizeForMatch(spanEnd);
  const window = normSource.slice(ns, ns + Math.max(maxSpan, startN.length + endN.length));
  const endCount = countOccurrences(window, endN);
  if (endCount !== 1) return { error: `spanEnd occurs ${endCount}x within window (need exactly 1)` };
  const rel = window.indexOf(endN);
  if (rel < 0) return { error: 'spanEnd not found in window' };
  return { ns, ne: ns + rel + endN.length };
}

/**
 * Map a normalized span back to the raw source and return the verbatim raw
 * substring whose normalization EQUALS normSource.slice(ns, ne). Binary
 * search gives approximate raw offsets; local refinement (±24 chars, wide
 * enough for a straddled [[MARKER]]) finds the exact boundaries, then the
 * span is tightened to the smallest raw slice that still normalizes to the
 * target. Returns null if no raw slice reproduces the target exactly.
 */
function findRawSpan(raw, normSource, ns, ne) {
  const target = normSource.slice(ns, ne);
  const nlen = (k) => normalizeForMatch(raw.slice(0, k)).length;
  const bisect = (goal) => {
    let lo = 0;
    let hi = raw.length;
    let ans = raw.length;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (nlen(mid) >= goal) { ans = mid; hi = mid - 1; } else lo = mid + 1;
    }
    return ans;
  };
  const a0 = Math.max(0, bisect(ns + 1) - 1);
  const b0 = bisect(ne);
  const W = 24;
  for (let a = Math.max(0, a0 - W); a <= Math.min(raw.length - 1, a0 + W); a++) {
    for (let b = Math.min(raw.length, b0 + W); b > Math.max(a, b0 - W - 1); b--) {
      if (normalizeForMatch(raw.slice(a, b)) !== target) continue;
      // Tighten to the smallest raw slice still normalizing to the target.
      // Leading/trailing pipeline markers must be jumped WHOLE — cutting into
      // "[[/SECTION]]" one char at a time changes its normalization and
      // strands the marker on the span.
      let s = a;
      let e = b;
      for (;;) {
        const lead = raw.slice(s, e).match(/^(?:\[\[\/?[A-Za-z0-9_ -]+\]\]|[\s«»])+/);
        if (lead && normalizeForMatch(raw.slice(s + lead[0].length, e)) === target) { s += lead[0].length; continue; }
        if (s < e && normalizeForMatch(raw.slice(s + 1, e)) === target) { s += 1; continue; }
        break;
      }
      for (;;) {
        const tail = raw.slice(s, e).match(/(?:\[\[\/?[A-Za-z0-9_ -]+\]\]|[\s«»])+$/);
        if (tail && normalizeForMatch(raw.slice(s, e - tail[0].length)) === target) { e -= tail[0].length; continue; }
        if (e > s && normalizeForMatch(raw.slice(s, e - 1)) === target) { e -= 1; continue; }
        break;
      }
      return raw.slice(s, e).trim();
    }
  }
  return null;
}

// Stored quotes are agreement text, not pipeline output: strip the
// [[SECTION]]/[[REF]]/«» ingestion markers a raw source span carries.
// Verification is marker-blind (normalizeForMatch strips them on both
// sides), so this never changes whether the quote verifies.
function stripPipelineMarkers(s) {
  return s
    .replace(/\[\[\/?[A-Za-z0-9_ -]+\]\]/g, '')
    .replace(/\[\[\/?[A-Za-z0-9_ -]*$/g, '')
    .replace(/[«»]/g, '')
    .replace(/ {2,}/g, ' ')
    .trim();
}

/* ── feature-bag rewrite ─────────────────────────────────────────────────── */

// Replace `find` → `replacement` in every quote-bearing string (quotes[]
// entries and citable/tagged .text) of a feature bag. Mutates a CLONE;
// returns { features, paths } where paths lists every rewritten location.
function rewriteQuotes(features, find, replacement) {
  const clone = JSON.parse(JSON.stringify(features));
  const paths = [];
  const walk = (node, p) => {
    if (node === null || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach((v, i) => walk(v, `${p}[${i}]`)); return; }
    if (Array.isArray(node.quotes)) {
      node.quotes.forEach((q, i) => {
        if (typeof q === 'string' && q.includes(find)) {
          node.quotes[i] = q.replace(find, replacement);
          paths.push(`${p}.quotes[${i}]`);
        }
      });
    }
    if (typeof node.text === 'string' && node.text.includes(find) && ('value' in node || 'code' in node)) {
      node.text = node.text.replace(find, replacement);
      paths.push(`${p}.text`);
    }
    for (const [k, v] of Object.entries(node)) {
      if (k === 'quotes') continue;
      if (v && typeof v === 'object') walk(v, p ? `${p}.${k}` : k);
    }
  };
  walk(clone, '');
  return { features: clone, paths };
}

/* ── main ────────────────────────────────────────────────────────────────── */

async function main() {
  loadDotEnvLocal();
  const args = parseArgs(process.argv);

  const { createClient } = require('@supabase/supabase-js');
  const dbUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!dbUrl || !key) { console.error('Supabase creds required (env / .env.local).'); process.exit(1); }
  const sb = createClient(dbUrl, key);

  const wanted = args.deal
    ? REPAIRS.filter((r) => r.deal.toLowerCase().includes(args.deal.toLowerCase()))
    : REPAIRS;
  if (wanted.length === 0) { console.log(`No repairs match "${args.deal}".`); return; }

  console.log(`${args.apply ? 'APPLY' : 'DRY-RUN'} — ${wanted.length} repair(s)\n`);

  const sourceCache = new Map(); // deal_id → { raw, norm }
  let applied = 0;
  let skipped = 0;
  let failed = 0;

  for (const r of wanted) {
    const label = `${r.deal} ${r.provision_id.slice(0, 8)}`;
    const { data: prov, error: pErr } = await sb
      .from('provisions')
      .select('id, deal_id, type, category, ai_metadata')
      .eq('id', r.provision_id)
      .single();
    if (pErr || !prov) { console.log(`FAIL  ${label}: provision fetch — ${pErr ? pErr.message : 'not found'}`); failed += 1; continue; }
    if (SKIP_DEAL_IDS.has(prov.deal_id)) { console.log(`SKIP  ${label}: deal is mid-re-ingest`); skipped += 1; continue; }

    if (!sourceCache.has(prov.deal_id)) {
      const { data: deal, error: dErr } = await sb
        .from('deals')
        .select('id, metadata')
        .eq('id', prov.deal_id)
        .single();
      if (dErr || !deal) { console.log(`FAIL  ${label}: deal fetch — ${dErr ? dErr.message : 'not found'}`); failed += 1; continue; }
      const raw = (deal.metadata && deal.metadata.full_text) || '';
      sourceCache.set(prov.deal_id, { raw, norm: normalizeForMatch(raw) });
    }
    const { raw, norm } = sourceCache.get(prov.deal_id);
    if (!raw) { console.log(`FAIL  ${label}: deal has no stored full_text`); failed += 1; continue; }

    const meta = prov.ai_metadata && typeof prov.ai_metadata === 'object' ? prov.ai_metadata : {};
    const features = meta.features && typeof meta.features === 'object' ? meta.features : {};

    const span = locateNormSpan(norm, r.spanStart, r.spanEnd, r.maxSpan);
    if (span.error) { console.log(`FAIL  ${label}: ${span.error}`); failed += 1; continue; }
    const rawSpan = findRawSpan(raw, norm, span.ns, span.ne);
    if (!rawSpan) { console.log(`FAIL  ${label}: could not map normalized span to raw text`); failed += 1; continue; }
    if (!raw.includes(rawSpan)) { console.log(`FAIL  ${label}: replacement is not verbatim source (bug)`); failed += 1; continue; }
    const replacement = stripPipelineMarkers(rawSpan);

    const { features: repaired, paths } = rewriteQuotes(features, r.find, replacement);
    if (paths.length === 0) {
      console.log(`SKIP  ${label}: find-text not present in any quote-bearing field (already repaired?)`);
      skipped += 1;
      continue;
    }

    // Every repaired string must now verify against the source — hard gate.
    const stillBad = [];
    const check = (node, p) => {
      if (node === null || typeof node !== 'object') return;
      if (Array.isArray(node)) { node.forEach((v, i) => check(v, `${p}[${i}]`)); return; }
      if (Array.isArray(node.quotes)) {
        node.quotes.forEach((q, i) => {
          if (typeof q === 'string' && q.includes(replacement) && quoteAppearsIn(normalizeForMatch(q), norm) === false) stillBad.push(`${p}.quotes[${i}]`);
        });
      }
      if (typeof node.text === 'string' && node.text.includes(replacement) && ('value' in node || 'code' in node) && quoteAppearsIn(normalizeForMatch(node.text), norm) === false) {
        stillBad.push(`${p}.text`);
      }
      for (const [k, v] of Object.entries(node)) {
        if (k === 'quotes') continue;
        if (v && typeof v === 'object') check(v, p ? `${p}.${k}` : k);
      }
    };
    check(repaired, '');
    if (stillBad.length) { console.log(`FAIL  ${label}: repaired quote still unverified at ${stillBad.join(', ')}`); failed += 1; continue; }

    console.log(`OK    ${label} [${r.note}]`);
    console.log(`      paths: ${paths.join(', ')}`);
    console.log(`      - OLD: ${r.find}`);
    console.log(`      + NEW: ${replacement.replace(/\s+/g, ' ')}`);

    if (!args.apply) continue;

    const newMeta = { ...meta, features: repaired };
    const { error: uErr } = await sb.from('provisions').update({ ai_metadata: newMeta }).eq('id', prov.id);
    if (uErr) { console.log(`FAIL  ${label}: update — ${uErr.message}`); failed += 1; continue; }

    // Edit-history convention (pages/api/corrections.js): best-effort insert.
    const { error: cErr } = await sb.from('corrections').insert({
      provision_id: prov.id,
      deal_id: prov.deal_id,
      correction_type: 'feature_change',
      before: { type: prov.type, category: prov.category, features },
      after: { type: prov.type, category: prov.category, features: repaired },
      context: { source: 'scripts/repair-quotes.js', kind: 'quote_fidelity_repair', paths, note: r.note },
      reason: 'Quote-fidelity pass: stored quote replaced with the exact verbatim source span (deterministic near-miss repair)',
      user_id: null,
    });
    if (cErr) console.log(`      (corrections log failed: ${cErr.message})`);
    applied += 1;
  }

  console.log(`\n${args.apply ? `applied ${applied}` : 'dry-run complete'} · skipped ${skipped} · failed ${failed}`);
  if (failed > 0) process.exitCode = 1;
}

module.exports = { locateNormSpan, findRawSpan, rewriteQuotes, countOccurrences, stripPipelineMarkers, REPAIRS };

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
