#!/usr/bin/env node
/*
  scripts/backfill/promote-canonical.js

  Canonical-resolution promotion pass for public.claims.

  For every claims row with canonical IS NULL, look at
  provenance.feature_value.value (the extraction-time value captured at
  parse time — see scripts/backfill/claims-from-normalized.js
  buildProvenance()) and promote it into `canonical` IFF it is an EXACT
  member of that attribute's own closed vocabulary:

    - boolean-typed attribute + a real JSON boolean value -> "TRUE"/"FALSE"
      (matches the format of the 45 pre-existing boolean canonicals).
    - enum-typed attribute (registry `enumSet`) + an exact string match.
    - taxonomy-coded attribute (lib/taxonomy.js `taxonomyForFeatureKey`) +
      an exact code match, whether the value is a bare code string or a
      tagged {code, label, text} object.

  NEVER fabricates: numeric/date/free-text attributes, near-misses that would
  need case-folding or an alias table, and list-shaped feature_value (each
  item already carries its own code, this pass only fills a single scalar
  canonical) are all left null. Rows whose provenance.recoded_from is set
  carry a stale pre-reconciliation value under the new field's key and are
  skipped (logged, not silently dropped).

  Idempotent: only rows with canonical IS NULL are ever considered, so a
  promoted row is inert on every subsequent run.

  Spec + investigation: $CLAUDE_JOB_DIR/tmp/normalizer-lift.md
  (WP-CANONICAL-LIFT, 2026-07-08) — ~3,088 promotable / ~12.05% coverage.

  --- Usage ---

  Dry-run against the live claims table (default; writes nothing):
    node scripts/backfill/promote-canonical.js

  Apply (writes `canonical` + a `promoted_from_feature_value` provenance
  flag; this is the prod-write path, run by Ben, not by an agent):
    node scripts/backfill/promote-canonical.js --apply

  Offline verification against the normalized-v1.json snapshot instead of
  Supabase (claims mirrors these triples 1:1 — see
  claims-from-normalized.js). Useful when DB credentials aren't available,
  e.g. in a sandboxed dev/review environment; --apply is a no-op in this
  mode, there is nothing to write to:
    node scripts/backfill/promote-canonical.js --from-normalized docs/schema-shape/normalized-v1.json
*/

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const { getFeature } = require(path.join(REPO_ROOT, 'lib/schema/index.js'));
const { taxonomyForFeatureKey, isValidTaxonomyCode } = require(path.join(REPO_ROOT, 'lib/taxonomy.js'));

const DEFAULT_REPORT = 'docs/reprocess/promote-canonical-dry-run.md';
const DEFAULT_JSON_REPORT = 'docs/reprocess/promote-canonical-dry-run.json';
const FETCH_PAGE_SIZE = 1000;
const UPDATE_CONCURRENCY = 20;

function loadDotEnvFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return false;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !(match[1] in process.env)) process.env[match[1]] = match[2].replace(/^"|"$/g, '');
  }
  return true;
}

function loadDotEnvLocal(envFile) {
  if (envFile) return loadDotEnvFile(path.resolve(envFile));
  return loadDotEnvFile(path.join(REPO_ROOT, '.env.local'));
}

function parseArgs(argv) {
  const args = {
    apply: false,
    envFile: null,
    fromNormalized: null,
    out: DEFAULT_REPORT,
    jsonOut: DEFAULT_JSON_REPORT,
    limit: null,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--apply') args.apply = true;
    else if (arg === '--dry-run') args.apply = false;
    else if (arg === '--env-file') args.envFile = argv[++i];
    else if (arg === '--from-normalized') args.fromNormalized = path.resolve(argv[++i]);
    else if (arg === '--out') args.out = argv[++i];
    else if (arg === '--json-out') args.jsonOut = argv[++i];
    else if (arg === '--limit') args.limit = Number(argv[++i]);
    else throw new Error(`Unknown arg: ${arg}`);
  }
  return args;
}

/**
 * Pull the taxonomy code out of a feature_value.value payload. The value is
 * either a bare code string, or a tagged {code, label, text, ...} object
 * (the shape every taxonomy-coded single-value field extracts to — see
 * lib/parser-v2/extract.js and the materialityQualifier example in
 * normalizer-lift.md).
 */
function extractCode(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && typeof value.code === 'string') return value.code;
  return null;
}

/**
 * Core decision function — pure and DB-agnostic so it can run against
 * either Supabase rows or normalized-v1.json triples reshaped into the same
 * { attribute, canonical, provenance } shape, and so it's directly unit
 * testable.
 *
 * @param {{attribute: string, canonical: string|null, provenance: object}} row
 * @returns {{promote: boolean, value?: string, tier?: string, reason: string}}
 */
function decidePromotion(row) {
  const attribute = row.attribute;
  const provenance = row.provenance || {};

  if (row.canonical !== null && row.canonical !== undefined && row.canonical !== '') {
    return { promote: false, reason: 'already_canonical' };
  }

  // Stale value from a pre-reconciliation field recoded under this key —
  // never promote (log, don't silently drop). See normalizer-lift.md §4.1.
  if (provenance.recoded_from) {
    return { promote: false, reason: 'recoded_from_stale_value' };
  }

  const fv = provenance.feature_value;
  if (fv === null || fv === undefined) {
    return { promote: false, reason: 'no_feature_value' };
  }
  // Single-value shape only ({value, quotes}). List-shaped feature_value
  // (an array of already-tagged {code,text,label} items, e.g.
  // permittedExceptions / absenceSpecifiedIOCReferences) has no scalar
  // '.value' and is out of scope for this pass — each item already carries
  // its own code; there is no single canonicalKey to fill.
  if (typeof fv !== 'object' || Array.isArray(fv) || !('value' in fv)) {
    return { promote: false, reason: 'not_single_value_shape' };
  }
  const value = fv.value;
  if (value === null || value === undefined || value === '') {
    return { promote: false, reason: 'empty_value' };
  }

  const reg = getFeature(attribute);

  if (reg && reg.valueType === 'boolean') {
    if (typeof value === 'boolean') {
      return { promote: true, value: value ? 'TRUE' : 'FALSE', tier: 'boolean' };
    }
    return { promote: false, reason: 'boolean_field_non_boolean_value' };
  }

  if (reg && reg.valueType === 'enum') {
    if (typeof value === 'string' && Array.isArray(reg.enumSet) && reg.enumSet.includes(value)) {
      return { promote: true, value, tier: 'enum' };
    }
    return { promote: false, reason: 'enum_no_exact_match' };
  }

  const dict = taxonomyForFeatureKey(attribute);
  if (dict) {
    const code = extractCode(value);
    if (code && isValidTaxonomyCode(code, dict)) {
      return { promote: true, value: code, tier: 'taxonomy-code' };
    }
    return { promote: false, reason: 'taxonomy_no_exact_match' };
  }

  // Fallback for fields renamed since extraction whose taxonomy dict is
  // (still) only registered under the pre-rename ai_metadata.feature_key.
  // As of this pass the known renames (regulatoryCooperationScope,
  // divestitureCapDescription, timingAgreementsProhibited) resolve directly
  // above via lib/taxonomy.js — this is defense-in-depth for any rename not
  // yet enumerated there.
  const oldKey = provenance.feature_key;
  if (oldKey && oldKey !== attribute) {
    const oldDict = taxonomyForFeatureKey(oldKey);
    if (oldDict) {
      const code = extractCode(value);
      if (code && isValidTaxonomyCode(code, oldDict)) {
        return { promote: true, value: code, tier: 'taxonomy-code-viaOldKey' };
      }
    }
  }

  if (!reg) return { promote: false, reason: 'registry_unknown' };
  return { promote: false, reason: `no_closed_vocabulary(${reg.valueType})` };
}

async function fetchAllClaimsWithNullCanonical(sb, limit) {
  let from = 0;
  let all = [];
  for (;;) {
    const { data, error } = await sb
      .from('claims')
      .select('id, attribute, canonical, provenance')
      .is('canonical', null)
      .range(from, from + FETCH_PAGE_SIZE - 1);
    if (error) throw new Error(`Failed to read claims: ${error.message}`);
    all = all.concat(data);
    if (data.length < FETCH_PAGE_SIZE) break;
    from += FETCH_PAGE_SIZE;
    if (limit && all.length >= limit) break;
  }
  return limit ? all.slice(0, limit) : all;
}

async function fetchTotalClaimsCount(sb) {
  const { count, error } = await sb.from('claims').select('id', { count: 'exact', head: true });
  if (error) throw new Error(`Failed to count claims: ${error.message}`);
  return count;
}

function loadRowsFromNormalized(normalizedPath, limit) {
  const doc = JSON.parse(fs.readFileSync(normalizedPath, 'utf8'));
  let triples = doc.triples;
  if (limit) triples = triples.slice(0, limit);
  const rows = triples
    .map((t) => {
      const meta = t.ai_metadata || {};
      return {
        id: t.id,
        attribute: t.field_key,
        canonical: t.canonicalKey || null,
        provenance: {
          feature_key: meta.feature_key || null,
          feature_value: meta.feature_value === undefined ? null : meta.feature_value,
          recoded_from: meta.recoded_from || null,
        },
      };
    })
    .filter((r) => r.canonical === null || r.canonical === undefined || r.canonical === '');
  return { rows, totalRows: doc.triples.length };
}

async function applyPromotions(sb, toPromote) {
  let applied = 0;
  let failed = 0;
  for (let i = 0; i < toPromote.length; i += UPDATE_CONCURRENCY) {
    const batch = toPromote.slice(i, i + UPDATE_CONCURRENCY);
    const results = await Promise.all(
      batch.map(async ({ row, decision }) => {
        const mergedProvenance = {
          ...(row.provenance || {}),
          promoted_from_feature_value: true,
          promoted_tier: decision.tier,
          promoted_at: new Date().toISOString(),
        };
        const { error } = await sb
          .from('claims')
          .update({ canonical: decision.value, provenance: mergedProvenance })
          .eq('id', row.id)
          .is('canonical', null); // belt-and-braces: never clobber a canonical set since the read
        return { error };
      }),
    );
    for (const r of results) {
      if (r.error) failed += 1;
      else applied += 1;
    }
  }
  return { applied, failed };
}

function buildReport({ sourceLabel, mode, totalRows, nullCanonicalCount, decisions, toPromote }) {
  const byAttribute = new Map(); // attribute -> { promoted, tier }
  const byTier = new Map();
  const byReason = new Map();

  for (const { row, decision } of decisions) {
    if (decision.promote) {
      if (!byAttribute.has(row.attribute)) byAttribute.set(row.attribute, { promoted: 0, tier: decision.tier });
      byAttribute.get(row.attribute).promoted += 1;
      byTier.set(decision.tier, (byTier.get(decision.tier) || 0) + 1);
    } else {
      byReason.set(decision.reason, (byReason.get(decision.reason) || 0) + 1);
    }
  }

  const existingCanonical = totalRows - nullCanonicalCount;
  const beforeCoverage = totalRows > 0 ? existingCanonical / totalRows : 0;
  const afterCoverage = totalRows > 0 ? (existingCanonical + toPromote.length) / totalRows : 0;

  const attributeRows = [...byAttribute.entries()]
    .map(([attribute, v]) => ({ attribute, promoted: v.promoted, tier: v.tier }))
    .sort((a, b) => b.promoted - a.promoted);

  return {
    generatedAt: new Date().toISOString(),
    mode,
    source: sourceLabel,
    totalRows,
    nullCanonicalConsidered: nullCanonicalCount,
    existingCanonical,
    promotable: toPromote.length,
    beforeCoveragePct: Number((beforeCoverage * 100).toFixed(2)),
    afterCoveragePct: Number((afterCoverage * 100).toFixed(2)),
    byTier: Object.fromEntries(byTier),
    byReasonNotPromoted: Object.fromEntries([...byReason.entries()].sort((a, b) => b[1] - a[1])),
    byAttribute: attributeRows,
  };
}

function writeReport(report, mdPath, jsonPath) {
  const jsonOutPath = path.resolve(jsonPath);
  fs.mkdirSync(path.dirname(jsonOutPath), { recursive: true });
  fs.writeFileSync(jsonOutPath, JSON.stringify(report, null, 2));

  const lines = [
    '# Canonical promotion dry-run',
    '',
    `Generated: ${report.generatedAt}`,
    `Mode: ${report.mode}`,
    `Source: ${report.source}`,
    `Total claim rows: ${report.totalRows}`,
    `Null-canonical rows considered: ${report.nullCanonicalConsidered}`,
    `Existing canonical: ${report.existingCanonical} (${report.beforeCoveragePct}%)`,
    `Promotable this pass: ${report.promotable}`,
    `Coverage after promotion: ${report.existingCanonical + report.promotable} (${report.afterCoveragePct}%)`,
    '',
    '## By tier',
    ...Object.entries(report.byTier).map(([tier, n]) => `- ${tier}: ${n}`),
    '',
    '## Top attributes by promotable volume',
    ...report.byAttribute.slice(0, 30).map((a) => `- ${a.attribute}: ${a.promoted} (${a.tier})`),
    '',
    '## Not promoted, by reason',
    ...Object.entries(report.byReasonNotPromoted).map(([reason, n]) => `- ${reason}: ${n}`),
    '',
  ];
  const mdOutPath = path.resolve(mdPath);
  fs.mkdirSync(path.dirname(mdOutPath), { recursive: true });
  fs.writeFileSync(mdOutPath, lines.join('\n'));
  return { jsonOutPath, mdOutPath };
}

async function run(argv = process.argv) {
  const args = parseArgs(argv);
  loadDotEnvLocal(args.envFile);

  let sb = null;
  let sourceLabel;
  let totalRows;
  let nullCanonicalRows;

  if (args.fromNormalized) {
    sourceLabel = `normalized-v1.json snapshot (${args.fromNormalized})`;
    const loaded = loadRowsFromNormalized(args.fromNormalized, args.limit);
    totalRows = loaded.totalRows;
    nullCanonicalRows = loaded.rows;
  } else {
    // eslint-disable-next-line global-require
    const { createClient } = require('@supabase/supabase-js');
    const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error(
        'Supabase creds required (.env.local, --env-file, or SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY env vars). '
          + 'Use --from-normalized docs/schema-shape/normalized-v1.json to dry-run offline instead.',
      );
    }
    sb = createClient(url, key, { auth: { persistSession: false } });
    sourceLabel = 'public.claims (Supabase)';
    totalRows = await fetchTotalClaimsCount(sb);
    nullCanonicalRows = await fetchAllClaimsWithNullCanonical(sb, args.limit);
  }

  console.log(`[promote-canonical] mode: ${args.apply ? 'APPLY (writes to DB)' : 'DRY-RUN (no writes)'}`);
  console.log(`[promote-canonical] source: ${sourceLabel}`);
  console.log(`[promote-canonical] total claim rows: ${totalRows}, null-canonical considered: ${nullCanonicalRows.length}`);

  const decisions = nullCanonicalRows.map((row) => ({ row, decision: decidePromotion(row) }));
  const toPromote = decisions.filter((d) => d.decision.promote);

  const report = buildReport({
    sourceLabel,
    mode: args.apply ? 'apply' : 'dry-run',
    totalRows,
    nullCanonicalCount: nullCanonicalRows.length,
    decisions,
    toPromote,
  });

  console.log('\n--- PROMOTION SUMMARY ---');
  console.log('promotable:', report.promotable, `(+${(report.afterCoveragePct - report.beforeCoveragePct).toFixed(2)}pp)`);
  console.log('coverage before:', `${report.existingCanonical}/${report.totalRows} (${report.beforeCoveragePct}%)`);
  console.log('coverage after: ', `${report.existingCanonical + report.promotable}/${report.totalRows} (${report.afterCoveragePct}%)`);
  console.log('by tier:', report.byTier);
  console.log('top attributes:', report.byAttribute.slice(0, 10));

  const { jsonOutPath, mdOutPath } = writeReport(report, args.out, args.jsonOut);
  console.log('\nWrote', jsonOutPath);
  console.log('Wrote', mdOutPath);

  if (args.apply) {
    if (!sb) {
      console.log('\n[promote-canonical] --apply is a no-op in --from-normalized mode (nothing to write to).');
    } else {
      console.log(`\n[promote-canonical] --apply requested: writing ${toPromote.length} promotions to public.claims...`);
      const { applied, failed } = await applyPromotions(sb, toPromote);
      console.log(`[promote-canonical] write complete: ${applied} applied, ${failed} failed.`);
    }
  } else {
    console.log('\n[promote-canonical] DRY-RUN: no rows written to the database.');
  }

  return report;
}

module.exports = { decidePromotion, extractCode, run };

if (require.main === module) {
  run().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
