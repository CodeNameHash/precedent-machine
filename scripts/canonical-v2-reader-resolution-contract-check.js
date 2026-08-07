#!/usr/bin/env node
// PLAN.md Step 2D1 defect 5. The actual proof this defect asks for: diffs a
// committed run's real resolution.json against the SAME deal read back
// through readDealFromLocalCanonicalV2Staging, field by field, through
// canonicalJson (never JSON.stringify -- Postgres jsonb reorders object
// keys on output, and that already produced one false mismatch on
// 2026-08-07). Names every field that does not match, and separates two
// outcomes that look identical from a bare inequality but are not the same
// finding: a mismatch on a field local-staging-deal-reader.js's own
// RESOLVED_ENTRY_ALLOWLISTED_GAPS / OPEN_WORLD_ENTRY_ALLOWLISTED_GAPS /
// CLAIM_DEFINITION_KEYS_WITHOUT_ATTRIBUTES_SECTION_REFERENCE names, with a
// reason, is a KNOWN, checked gap; anything else is a genuine defect this
// script fails on.
//
// Also calls the real product-projection function for CONSIDERATION,
// MAE_DEFINITION and INTERIM_OPERATING against the read-back data -- the
// acceptance bar this defect names is "CONSIDERATION renders", not merely
// "the fields match", so this script proves that directly rather than
// inferring it from a field diff.
//
// Usage: node scripts/canonical-v2-reader-resolution-contract-check.js [db-url]
// [db-url] defaults to LOCAL_CANONICAL_V2_DB_URL or
// postgres://postgres:pm@localhost:55433/pm (the pm-pg3 container Step 2D's
// own notes document as holding all 25 Modiv families).
//
// If the target container's data has drifted from what these five
// resolution.json fixtures describe (another agent may be actively writing
// -- this script only reads), point it at a fresh container instead:
//
//   docker run -d --name pm-pg-reader-contract -e POSTGRES_PASSWORD=pm \
//     -e POSTGRES_DB=pm -p 55436:5432 postgres:16-alpine
//   psql -h localhost -p 55436 -U postgres -d pm \
//     -v ON_ERROR_STOP=1 -f scripts/lib/canonical-v2-local-setup.sql
//   psql -h localhost -p 55436 -U postgres -d pm \
//     -v ON_ERROR_STOP=1 -f supabase/canonical-v2-foundation.sql
//   for dir in modiv-consideration-fullpin-20260807-replay \
//     modiv-representations-20260807-replay modiv-no-other-reps-20260807-replay \
//     modiv-mae-definition-20260807-live modiv-interim-operating-20260807-replay; do
//     node scripts/canonical-v2-local-durable-write.js \
//       "evidence/canonical-v2/$dir" 'postgres://postgres:pm@localhost:55436/pm'
//   done
//   node scripts/canonical-v2-reader-resolution-contract-check.js \
//     'postgres://postgres:pm@localhost:55436/pm'

'use strict';

const path = require('node:path');
const fs = require('node:fs');
const { Client } = require('pg');

const { canonicalJson } = require('../lib/canonical-v2/canonical-bytes');
const {
  readDealFromLocalCanonicalV2Staging,
  RESOLVED_ENTRY_ALLOWLISTED_GAPS,
  OPEN_WORLD_ENTRY_ALLOWLISTED_GAPS,
  CLAIM_DEFINITION_KEYS_WITHOUT_ATTRIBUTES_SECTION_REFERENCE,
} = require('../lib/canonical-v2/local-staging-deal-reader');
const {
  projectConsiderationWaveAClaims, FIELD_DEFINITIONS: CONSIDERATION_FIELD_DEFINITIONS,
} = require('../lib/canonical-v2/consideration-wave-a-product-projection');
const { projectIocWaveAClaims, CLAIM_DEFINITION_KEY: IOC_CLAIM_DEFINITION_KEY } = require('../lib/canonical-v2/ioc-wave-a-product-projection');
const { projectKeyTermsMaeClaims, MAE_CLAIMS } = require('../lib/canonical-v2/key-terms-mae-product-projection');

const REPO_ROOT = path.join(__dirname, '..');
const MODIV_DOCUMENT_HASH = '659bcfaa017718ac735811861565fa2cd4e212657ba68e06ff1eab53e3729968';

// The five families PLAN.md Step 2D1 defect 5 names, each with the freshest
// committed full-pin run (matching Step 2D's own final baseline table in
// docs/codex-program/notes/step-2d-modiv-fan-out.md).
const FAMILIES = [
  { name: 'CONSIDERATION', dir: 'modiv-consideration-fullpin-20260807-replay' },
  { name: 'REPRESENTATIONS', dir: 'modiv-representations-20260807-replay' },
  { name: 'NO_OTHER_REPS_FRAUD', dir: 'modiv-no-other-reps-20260807-replay' },
  { name: 'MAE_DEFINITION', dir: 'modiv-mae-definition-20260807-live' },
  { name: 'INTERIM_OPERATING', dir: 'modiv-interim-operating-20260807-replay' },
];

function loadResolution(dir) {
  return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'evidence', 'canonical-v2', dir, 'resolution.json'), 'utf8'));
}

let failures = 0;
function report(label, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` -- ${detail}` : ''}`);
  if (!ok) failures += 1;
  return ok;
}

// Keys this reader ADDS on purpose that resolution.json's resolved[] shape
// never had (Step 2B3): a genuine extra, not a gap, so never reported.
const RESOLVED_ENTRY_ADDITIVE_KEYS = new Set(['provision_component']);

// Found running this script for real, against real committed data: these
// three claim SUBFIELDS legitimately differ between resolution.json and the
// database, and the cause is a write-time identity re-derivation that
// predates this reader entirely -- native-write-set-adapter.js's own header
// documents it ("WHY IDENTITY MUST BE RE-DERIVED, NOT JUST SHIFTED"): once
// evidence is shifted from the producer's section-local coordinates to the
// document's absolute ones, the excerpt (and everything content-hashed on
// top of it -- the evidence edge id, then claim_revision_id) is rebuilt, not
// merely offset. The reader returns the DATABASE's real value for all three,
// byte-identical to what was WRITTEN -- this is not a read-side gap, it is
// resolution.json (the pre-write resolver output) legitimately differing
// from the write-set the database actually holds. Reported here, distinct
// from RESOLVED_ENTRY_ALLOWLISTED_GAPS (which is about the READER's own
// reconstruction), because conflating the two would hide a genuine, useful
// distinction: fields lost by this reader vs. fields that were never going
// to be the value written, regardless of what reads them back.
const CLAIM_SUBFIELD_WRITE_TIME_REDERIVED_GAPS = Object.freeze({
  claim_revision_id: "recomputed by native-write-set-adapter.js's recomputeRevisionId once evidence is "
    + 'shifted to document-absolute coordinates -- not a read-side gap.',
  evidence: "each edge's excerpt_id is re-derived onto document-absolute coordinates for the same reason -- "
    + "the reader returns the database's real (document-absolute) evidence, byte-identical to what was "
    + "written, just not byte-identical to resolution.json's pre-shift (section-local) evidence.",
  evidence_ids: 'derived from the re-derived evidence array above.',
});

// Compares two plain objects field by field through canonicalJson (never
// JSON.stringify -- see this script's header). Returns one mismatch entry
// per differing field, each tagged allowlisted/reason if it matches a known,
// checked gap, or left unallowlisted (a genuine finding) otherwise.
function diffFields({
  expected, actual, allowlist, additiveKeys = new Set(), fieldPrefix = '',
}) {
  const keys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
  const mismatches = [];
  for (const key of keys) {
    if (additiveKeys.has(key) && !Object.hasOwn(expected, key)) continue;
    const expectedValue = Object.hasOwn(expected, key) ? expected[key] : undefined;
    const actualValue = Object.hasOwn(actual, key) ? actual[key] : undefined;
    const expectedJson = canonicalJson(expectedValue === undefined ? null : expectedValue);
    const actualJson = canonicalJson(actualValue === undefined ? null : actualValue);
    if (expectedJson === actualJson) continue;
    mismatches.push({
      field: `${fieldPrefix}${key}`,
      allowlisted: Object.hasOwn(allowlist, key),
      reason: allowlist[key] || null,
      expected: expectedValue,
      actual: actualValue,
    });
  }
  return mismatches;
}

// Entry-level diff. `claim` is decomposed into its own subfields (not
// compared as one opaque blob) so the write-time-rederived subfields above
// can be told apart from a genuine claim-payload defect; every other
// top-level field is compared as a whole value.
function diffEntry({ expected, actual, allowlist, additiveKeys = new Set() }) {
  const mismatches = [];
  const topLevelKeys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
  for (const key of topLevelKeys) {
    if (key === 'claim') continue; // handled below, decomposed
    if (additiveKeys.has(key) && !Object.hasOwn(expected, key)) continue;
    const expectedValue = Object.hasOwn(expected, key) ? expected[key] : undefined;
    const actualValue = Object.hasOwn(actual, key) ? actual[key] : undefined;
    const expectedJson = canonicalJson(expectedValue === undefined ? null : expectedValue);
    const actualJson = canonicalJson(actualValue === undefined ? null : actualValue);
    if (expectedJson === actualJson) continue;
    let allowlisted = Object.hasOwn(allowlist, key);
    let reason = allowlist[key] || null;
    if (key === 'section_reference') {
      const claimKey = expected.resolved_claim_definition_key;
      if (CLAIM_DEFINITION_KEYS_WITHOUT_ATTRIBUTES_SECTION_REFERENCE.has(claimKey)) {
        allowlisted = true;
        reason = `claim.attributes never carries section_reference for ${claimKey} `
          + '(checked against the whole committed Modiv corpus)';
      }
    }
    mismatches.push({
      field: key, allowlisted, reason, expected: expectedValue, actual: actualValue,
    });
  }
  mismatches.push(...diffFields({
    expected: expected.claim || {},
    actual: actual.claim || {},
    allowlist: CLAIM_SUBFIELD_WRITE_TIME_REDERIVED_GAPS,
    fieldPrefix: 'claim.',
  }));
  return mismatches;
}

function byId(rows, idField) {
  return new Map(rows.map((row) => [row[idField], row]));
}

async function main() {
  const dbUrl = process.argv[2] || process.env.LOCAL_CANONICAL_V2_DB_URL
    || 'postgres://postgres:pm@localhost:55433/pm';
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  let deal;
  try {
    deal = await readDealFromLocalCanonicalV2Staging({
      client, documentHash: MODIV_DOCUMENT_HASH, env: { NODE_ENV: 'development' },
    });
  } finally {
    await client.end();
  }
  console.log(`Read back document_hash=${MODIV_DOCUMENT_HASH}: `
    + `resolved=${deal.resolved.length}, open_world=${deal.open_world.length}, `
    + `ioc_restriction_components=${deal.ioc_restriction_components.length}\n`);

  // Matched by claim_occurrence_id, NOT claim_revision_id. Found running
  // this script for real: resolution.json's claim.claim_revision_id is NOT
  // what ends up written -- native-write-set-adapter.js re-derives it
  // (recomputeRevisionId) once evidence is shifted from section-local to
  // document-absolute coordinates, per its own header ("WHY IDENTITY MUST
  // BE RE-DERIVED, NOT JUST SHIFTED"). claim_occurrence_id is the field
  // that same header documents as NOT re-derived (passed through verbatim)
  // for every claim kind these five families use -- verified directly
  // against all four families here that have any resolved claims: every
  // resolution.json claim_occurrence_id is present in the DB unchanged.
  // Matching on claim_revision_id would have reported every single resolved
  // claim as "not found", which is not this reader's defect -- it is
  // comparing against the wrong identity field entirely.
  const resolvedById = new Map(deal.resolved.map((entry) => [entry.claim.claim_occurrence_id, entry]));
  const openWorldEntriesByClosureId = new Map(deal.open_world_entries.map((entry) => [entry.closure_id, entry]));
  const iocComponentsById = byId(deal.ioc_restriction_components, 'provision_component_id');

  for (const { name, dir } of FAMILIES) {
    console.log(`\n== ${name} (${dir}) ==`);
    const resolution = loadResolution(dir);

    let unexpectedCount = 0;
    let allowlistedCount = 0;
    let matchedCount = 0;
    for (const expectedEntry of resolution.resolved) {
      const claimOccurrenceId = expectedEntry.claim.claim_occurrence_id;
      const actualEntry = resolvedById.get(claimOccurrenceId);
      if (!actualEntry) {
        report(`resolved claim ${claimOccurrenceId} (${expectedEntry.resolved_claim_definition_key}) round-trips`, false, 'not found in the read-back deal at all');
        unexpectedCount += 1;
        continue;
      }
      matchedCount += 1;
      const mismatches = diffEntry({
        expected: expectedEntry,
        actual: actualEntry,
        allowlist: RESOLVED_ENTRY_ALLOWLISTED_GAPS,
        additiveKeys: RESOLVED_ENTRY_ADDITIVE_KEYS,
      });
      for (const mismatch of mismatches) {
        if (mismatch.allowlisted) {
          allowlistedCount += 1;
        } else {
          unexpectedCount += 1;
          report(
            `resolved claim ${claimOccurrenceId} (${expectedEntry.resolved_claim_definition_key}) field "${mismatch.field}"`,
            false,
            `UNEXPECTED mismatch -- expected=${canonicalJson(mismatch.expected === undefined ? null : mismatch.expected)} `
            + `actual=${canonicalJson(mismatch.actual === undefined ? null : mismatch.actual)}`,
          );
        }
      }
    }
    report(
      `${name}: ${matchedCount}/${resolution.resolved.length} resolved claims round-trip `
      + `(${allowlistedCount} allowlisted field gaps, ${unexpectedCount} unexpected)`,
      unexpectedCount === 0,
    );

    // Open-world entries -- only REPRESENTATIONS has any in its own
    // committed run, but this loop is generic so any family with open-world
    // data gets checked the same way.
    if (resolution.open_world.length > 0) {
      let owUnexpected = 0;
      let owAllowlisted = 0;
      let owMatched = 0;
      for (const expectedEntry of resolution.open_world) {
        const closureId = expectedEntry.closure_id;
        const actualEntry = openWorldEntriesByClosureId.get(closureId);
        if (!actualEntry) {
          report(`open-world entry closure_id=${closureId} round-trips`, false, 'not found in the read-back deal at all');
          owUnexpected += 1;
          continue;
        }
        owMatched += 1;
        const mismatches = diffEntry({
          expected: expectedEntry,
          actual: actualEntry,
          allowlist: OPEN_WORLD_ENTRY_ALLOWLISTED_GAPS,
        });
        for (const mismatch of mismatches) {
          if (mismatch.field === 'evidence') {
            // Evidence edges round-trip as the real open_world_evidence_
            // references rows, a superset of resolution.json's own edge
            // fields missing only claim_evidence_id/schema_version (no
            // consumer reads either) -- checked as "both non-empty arrays
            // of real evidence", not byte-identical edge objects.
            const bothNonEmptyArrays = Array.isArray(mismatch.expected) && mismatch.expected.length > 0
              && Array.isArray(mismatch.actual) && mismatch.actual.length > 0;
            if (bothNonEmptyArrays) continue;
          }
          if (mismatch.allowlisted) {
            owAllowlisted += 1;
          } else {
            owUnexpected += 1;
            report(
              `open-world entry closure_id=${closureId} field "${mismatch.field}"`,
              false,
              `UNEXPECTED mismatch -- expected=${canonicalJson(mismatch.expected === undefined ? null : mismatch.expected)} `
              + `actual=${canonicalJson(mismatch.actual === undefined ? null : mismatch.actual)}`,
            );
          }
        }
      }
      report(
        `${name}: ${owMatched}/${resolution.open_world.length} open-world entries round-trip `
        + `(${owAllowlisted} allowlisted field gaps, ${owUnexpected} unexpected)`,
        owUnexpected === 0,
      );
    }

    // ioc_restriction_components -- only INTERIM_OPERATING has any.
    if (Array.isArray(resolution.ioc_restriction_components) && resolution.ioc_restriction_components.length > 0) {
      let icUnexpected = 0;
      for (const expectedComponent of resolution.ioc_restriction_components) {
        const actualComponent = iocComponentsById.get(expectedComponent.provision_component_id);
        if (!actualComponent) {
          report(`ioc_restriction_components ${expectedComponent.provision_component_id} round-trips`, false, 'not found in the read-back deal at all');
          icUnexpected += 1;
          continue;
        }
        if (canonicalJson(expectedComponent) !== canonicalJson(actualComponent)) {
          report(`ioc_restriction_components ${expectedComponent.provision_component_id} is byte-identical`, false, 'canonicalJson differs');
          icUnexpected += 1;
        }
      }
      report(
        `${name}: ${resolution.ioc_restriction_components.length - icUnexpected}/`
        + `${resolution.ioc_restriction_components.length} ioc_restriction_components round-trip`,
        icUnexpected === 0,
      );
    }
  }

  // ── Render checks: the acceptance bar is "CONSIDERATION renders", not
  // merely "the fields match" -- so call the real projection functions
  // against the read-back data, exactly as a serving source would. ──
  console.log('\n== Render checks (calling the real *-product-projection.js functions) ==');

  {
    const considerationKeys = new Set(Object.keys(CONSIDERATION_FIELD_DEFINITIONS));
    const entries = deal.resolved.filter((entry) => considerationKeys.has(entry.resolved_claim_definition_key));
    try {
      const result = projectConsiderationWaveAClaims({ resolved_entries: entries });
      report(`CONSIDERATION renders through projectConsiderationWaveAClaims (${entries.length} entries -> ${result.records.length} records)`, result.records.length > 0);
    } catch (error) {
      report('CONSIDERATION renders through projectConsiderationWaveAClaims', false, `${error.name}: ${error.message}`);
    }
  }

  {
    const maeResolution = loadResolution('modiv-mae-definition-20260807-live');
    // claim_occurrence_id, not claim_revision_id -- see diffEntry's own
    // comment for why the latter cannot be used to match a resolution.json
    // entry back to its written row.
    const maeClaimOccurrenceIds = new Set(maeResolution.resolved.map((entry) => entry.claim.claim_occurrence_id));
    const maeKeys = new Set(Object.keys(MAE_CLAIMS));
    const entries = deal.resolved.filter((entry) => maeClaimOccurrenceIds.has(entry.claim.claim_occurrence_id)
      && maeKeys.has(entry.resolved_claim_definition_key));
    try {
      const result = projectKeyTermsMaeClaims({ resolved_entries: entries, open_world_entries: [] });
      const maeRecords = result.records.filter((record) => record.owner_family === 'MAE_DEFINITION');
      report(`MAE_DEFINITION renders through projectKeyTermsMaeClaims (${entries.length} entries -> ${maeRecords.length} MAE records)`, maeRecords.length > 0);
    } catch (error) {
      report('MAE_DEFINITION renders through projectKeyTermsMaeClaims', false, `${error.name}: ${error.message}`);
    }
  }

  {
    const iocResolution = loadResolution('modiv-interim-operating-20260807-replay');
    const iocClaimOccurrenceIds = new Set(iocResolution.resolved.map((entry) => entry.claim.claim_occurrence_id));
    const entries = deal.resolved.filter((entry) => iocClaimOccurrenceIds.has(entry.claim.claim_occurrence_id)
      && entry.resolved_claim_definition_key === IOC_CLAIM_DEFINITION_KEY);
    try {
      const result = projectIocWaveAClaims({
        resolved_entries: entries,
        ioc_restriction_components: deal.ioc_restriction_components,
      });
      report(`INTERIM_OPERATING renders through projectIocWaveAClaims (${entries.length} entries -> ${result.records.length} records)`, result.records.length > 0);
    } catch (error) {
      report('INTERIM_OPERATING renders through projectIocWaveAClaims', false, `${error.name}: ${error.message}`);
    }
  }

  console.log(
    '\nNO_OTHER_REPS_FRAUD is intentionally NOT render-checked here: '
    + 'no-other-reps-fraud-product-projection.js\'s projectNoOtherRepsFraudProduct reads '
    + 'item.resolution_id, claim.owner_family and item.evidence_only -- fields that do not '
    + 'exist anywhere in this family\'s own committed resolution.json (checked directly against '
    + 'the whole corpus, every family, every run: zero occurrences of resolution_id or '
    + 'evidence_only, and owner_family only ever appears on the unrelated sole-remedy claims). '
    + 'That module was written against a different, older resolver '
    + '(no-other-reps-fraud-resolution.js, exercised only by its own dark-bridge tests), not the '
    + 'native-producer pipeline that actually writes canonical_v2_staging. No field this reader '
    + 'could add would satisfy that contract, because resolution.json itself never carries it -- '
    + 'this is a projection-layer contract mismatch, out of local-staging-deal-reader.js\'s reach, '
    + 'not a reader round-trip gap. Reported here rather than silently worked around.',
  );

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
