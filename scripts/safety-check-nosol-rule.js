#!/usr/bin/env node
/* ─────────────────────────────────────────────────────────────────────────
   scripts/safety-check-nosol-rule.js — MANDATORY pre-write safety check for
   the NOSOL title/content classify-rule fix (Fable spec, see
   lib/parser-v2/classify.js "Solicitation; Change in Recommendation" /
   NOSOL content-fallback comments).

   Runs the NEW classify rules (bare \bsolicitation\b + \bacquisition
   proposals?\b title triggers, plus the NOSOL_CONTENT_RE content fallback)
   against every deal's STORED deals.metadata.classified_sections — no
   re-parse, no LLM call, read-only against the DB — and reports every
   section whose classification would change.

   Per section:
     1. articleType = the section's stored articleType (if any).
     2. newType = tryDeterministic(section, articleType) if a deterministic
        rule fires under the NEW code; otherwise the section's stored type
        is assumed unchanged (only deterministic rules changed — AI/cache
        classifications are untouched by this fix).
     3. Content fallback: if newType is COV or MISC and the section text
        matches NOSOL_CONTENT_RE, newType becomes NOSOL.
     4. Flag the section if newType !== storedType.

   Expected result: ONLY Frontier/Verizon's "Solicitation; Change in
   Recommendation" section and SecureWorks/Sophos's no-title-match no-shop
   section should flip to NOSOL. ANY other flip is a STOP signal — do not
   proceed to writes.

   Read-only. Usage:
     node scripts/safety-check-nosol-rule.js
     node scripts/safety-check-nosol-rule.js --json
   ───────────────────────────────────────────────────────────────────────── */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { tryDeterministic: newTryDeterministic, NOSOL_CONTENT_RE } = require('../lib/parser-v2/classify');

/**
 * Loads the PRE-change tryDeterministic (git HEAD's lib/parser-v2/classify.js)
 * into a throwaway sibling module so the title-rule diff isolates exactly
 * what this fix's code changes altered — not artifacts of the fact that the
 * classified_sections snapshot never persists real article context (see
 * below). Writes a temp file inside lib/parser-v2/ (so its relative
 * requires — ../rubric, ../model, etc. — resolve) and removes it afterward.
 */
function loadOldTryDeterministic() {
  const tmpPath = path.join(__dirname, '..', 'lib', 'parser-v2', '_classify-old-snapshot.js');
  const oldSource = execFileSync('git', ['show', 'HEAD:lib/parser-v2/classify.js'], {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8',
  });
  fs.writeFileSync(tmpPath, oldSource);
  try {
    delete require.cache[require.resolve(tmpPath)];
    const old = require(tmpPath);
    return old.tryDeterministic;
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

/**
 * Pure core: given all deals' classified_sections snapshots and the
 * PRE-change tryDeterministic function, return the list of
 * { dealId, dealLabel, sectionNumber, title, oldType, newType, reason }
 * flips the new rules would produce. No I/O — unit-testable.
 *
 * Two independent flip sources, matching the two rule changes:
 *
 *   (1) Title-rule diff — oldTryDeterministic(section, ctx) vs
 *       newTryDeterministic(section, ctx) called with IDENTICAL synthetic
 *       article context (null) for both. The NOSOL title rule fires via
 *       `overrideArticle: true`, so its match/no-match is independent of
 *       article context — passing the SAME (even if inaccurate, since the
 *       compact snapshot never persists real article context — see
 *       lib/parser-v2/snapshot.js toCompactSections) context to both old
 *       and new makes any article-context-dependent noise from OTHER rules
 *       cancel out of the diff identically, isolating exactly the effect
 *       of this fix's rule-table edit.
 *   (2) Content-fallback — stored section.type is COV or MISC (the actual
 *       production-resolved type, which DOES reflect real article context/
 *       AI/fixups) and the section text matches NOSOL_CONTENT_RE.
 *
 * A section already stored as NOSOL/NOSOL-B/NOSOL-M is never reported (no
 * type change, whichever source fired).
 */
function computeFlips(deals, oldTryDeterministic) {
  const flips = [];
  for (const deal of deals) {
    const meta = deal.metadata || {};
    const sections = Array.isArray(meta.classified_sections) ? meta.classified_sections : [];
    const dealLabel = `${deal.acquirer || ''}/${deal.target || ''}`.replace(/^\/|\/$/g, '') || deal.id;
    for (const section of sections) {
      const storedType = section.type || null;
      const sectionArg = {
        title: section.title,
        heading: section.title,
        text: section.text,
        number: section.sectionNumber,
      };

      let newType = storedType;
      let reason = null;

      const oldDet = oldTryDeterministic(sectionArg, null);
      const newDet = newTryDeterministic(sectionArg, null);
      if ((oldDet ? oldDet.type : null) !== (newDet ? newDet.type : null) && newDet && newDet.type === 'NOSOL') {
        newType = 'NOSOL';
        reason = 'title-rule';
      }

      if (['COV', 'MISC', 'IOC-T', 'IOC-B'].includes(newType) && NOSOL_CONTENT_RE.test(section.text || '')) {
        newType = 'NOSOL';
        reason = 'content-fallback';
      }

      if (newType !== storedType) {
        flips.push({
          dealId: deal.id,
          dealLabel,
          sectionNumber: section.sectionNumber || null,
          title: section.title || null,
          oldType: storedType,
          newType,
          reason,
        });
      }
    }
  }
  return flips;
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

  const oldTryDeterministic = loadOldTryDeterministic();
  const flips = computeFlips(deals || [], oldTryDeterministic);

  if (asJson) {
    console.log(JSON.stringify({ dealCount: (deals || []).length, flipCount: flips.length, flips }, null, 2));
    return;
  }

  console.log(`Scanned ${deals ? deals.length : 0} deals.`);
  console.log(`${flips.length} section(s) would flip classification under the new NOSOL rules:\n`);
  for (const f of flips) {
    console.log(`  [${f.dealLabel}] ${f.sectionNumber || '(no #)'} "${f.title}" (${f.reason}) : ${f.oldType} -> ${f.newType}`);
  }

  const expectedDeals = ['frontier', 'secureworks', 'sophos'];
  const unexpected = flips.filter((f) => !expectedDeals.some((e) => f.dealLabel.toLowerCase().includes(e)));
  console.log('');
  if (unexpected.length > 0) {
    console.log(`STOP: ${unexpected.length} unexpected flip(s) outside Frontier/SecureWorks. Do not proceed to writes.`);
    process.exitCode = 1;
  } else {
    console.log('Clean: all flips are within Frontier / SecureWorks-Sophos as expected.');
  }
}

module.exports = { computeFlips };

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
