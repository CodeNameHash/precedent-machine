#!/usr/bin/env node
/**
 * scripts/canonical-v2-corroboration-collision-report.mjs
 *
 * Step 2X-C collision scan (PLAN.md Step 2X-C; DECISIONS.md §15):
 * run the SAME functions candidate-resolution.js calls
 * (`generalCovenantPrimaryMatchingCodes`, `taxCooperationPrimaryMatchingKinds`)
 * against every candidate's own byte-verified quote -- never a re-implemented
 * copy of the pattern tables -- and count how many quotes match more than one
 * code or kind.
 *
 * SCOPE (widened 2026-08-08 after Ben's §15 ruling).
 * - resolved + open_world: quote from `resolution.json` `claim.raw_value` /
 *   `raw_value` (byte-verified).
 * - review_queue / held: quote from (1) `raw_value` already on the review
 *   row when `pushReviewUnresolved` wrote it, else (2) a unique join from
 *   `normalised_phrase` to `run-receipt.json` compiled_candidates'
 *   `claim.raw_value` via `normaliseForMatching`. When several candidates
 *   share one normalised phrase, the quote is accepted only if every hit's
 *   `raw_value` is byte-identical; otherwise the row is excluded with a
 *   counted reason. A normalised phrase alone is NEVER treated as a quote.
 * - Tax cooperation held rows are identified by the joined candidate's
 *   `attributes.assertion_kind` (TAXM-* concept keys are not the kind).
 *
 * Zero model calls, zero network, zero writes to evidence/. Read-only over
 * committed run directories; the only write is the Markdown report this
 * script prints (or, with --write, saves under docs/codex-program/notes/).
 *
 * Usage:
 *   node scripts/canonical-v2-corroboration-collision-report.mjs
 *   node scripts/canonical-v2-corroboration-collision-report.mjs --json
 *   node scripts/canonical-v2-corroboration-collision-report.mjs --write <path>
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

const {
  generalCovenantPrimaryMatchingCodes,
} = require('../lib/canonical-v2/native-producer/general-covenant-corroboration');
const {
  taxCooperationPrimaryMatchingKinds,
} = require('../lib/canonical-v2/native-producer/tax-cooperation-corroboration');
const {
  normaliseForMatching,
} = require('../lib/canonical-v2/zero-width-normalise');

const EVIDENCE_ROOT = path.join(REPO_ROOT, 'evidence/canonical-v2');
const TAX_COOPERATION_KINDS = Object.freeze(['TAX_OPINION_COOPERATION', 'TRANSFER_COOPERATION']);

function parseArgs(argv) {
  const args = { json: false, write: null };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--json') { args.json = true; continue; }
    if (argv[i] === '--write') { args.write = argv[i += 1]; continue; }
    throw new Error(`UNKNOWN_ARGUMENT: ${argv[i]}`);
  }
  return args;
}

function readJsonIfPresent(absolutePath) {
  return fs.existsSync(absolutePath) ? JSON.parse(fs.readFileSync(absolutePath, 'utf8')) : null;
}

function listRunDirs(suffixMatch) {
  return fs.readdirSync(EVIDENCE_ROOT)
    .filter((name) => name.includes(suffixMatch))
    .filter((name) => fs.existsSync(path.join(EVIDENCE_ROOT, name, 'resolution.json')))
    .sort();
}

function compiledCandidateQuoteIndex(run) {
  const receipt = readJsonIfPresent(path.join(EVIDENCE_ROOT, run, 'run-receipt.json'));
  const byNorm = new Map();
  for (const entry of receipt?.compiled_candidates || []) {
    const claim = entry?.candidate?.claim;
    if (typeof claim?.raw_value !== 'string' || claim.raw_value.length === 0) continue;
    const key = normaliseForMatching(claim.raw_value);
    if (!byNorm.has(key)) byNorm.set(key, []);
    byNorm.get(key).push(claim);
  }
  return byNorm;
}

/**
 * Resolve a byte-verified quote for a review_queue row.
 * Fail closed: never invent a quote from normalised_phrase alone.
 * @returns {{ quote: string|null, how: string }}
 */
function resolveHeldQuote(row, byNorm) {
  if (typeof row.raw_value === 'string' && row.raw_value.length > 0) {
    return { quote: row.raw_value, how: 'raw_value_on_row' };
  }
  if (typeof row.normalised_phrase !== 'string' || row.normalised_phrase.length === 0) {
    return { quote: null, how: 'missing_normalised_phrase' };
  }
  const hits = byNorm.get(row.normalised_phrase) || [];
  if (hits.length === 0) {
    return { quote: null, how: 'norm_join_miss' };
  }
  const uniqueRaws = [...new Set(hits.map((claim) => claim.raw_value))];
  if (uniqueRaws.length === 1) {
    return {
      quote: uniqueRaws[0],
      how: hits.length === 1 ? 'unique_norm_join' : 'identical_raw_norm_join',
    };
  }
  return { quote: null, how: 'norm_join_ambiguous_raw' };
}

function bumpReason(counter, how) {
  counter[how] = (counter[how] || 0) + 1;
}

function generalCovenantQuotes(resolution, run, byNorm, heldStats) {
  const rows = [];
  for (const row of resolution.resolved || []) {
    if (!String(row.generic_claim_key || '').startsWith('NATIVE_GENERAL_COVENANT_')) continue;
    rows.push({
      run,
      source: 'resolved',
      section_reference: row.section_reference,
      asserted_code: row.concept_key,
      quote: row.claim?.raw_value,
    });
  }
  for (const row of resolution.open_world || []) {
    if (!String(row.claim_definition_key || '').startsWith('NATIVE_GENERAL_COVENANT_')) continue;
    rows.push({
      run,
      source: 'open_world',
      section_reference: row.section_reference,
      asserted_code: row.attributes?.covenant_code ?? null,
      quote: row.raw_value,
    });
  }

  for (const row of resolution.review_queue || []) {
    if (!String(row.generic_claim_key || '').startsWith('NATIVE_GENERAL_COVENANT_')) continue;
    heldStats.review_queue_total += 1;
    const resolved = resolveHeldQuote(row, byNorm);
    if (!resolved.quote) {
      bumpReason(heldStats.excluded_reasons, resolved.how);
      continue;
    }
    bumpReason(heldStats.quote_sources, resolved.how);
    heldStats.quotes_checked += 1;
    rows.push({
      run,
      source: 'review_queue',
      section_reference: row.section_reference,
      asserted_code: row.concept_key ?? row.concept_family ?? null,
      quote: resolved.quote,
      hold_reasons: row.reasons || [],
      quote_source: resolved.how,
    });
  }

  return rows.filter((row) => typeof row.quote === 'string' && row.quote.length > 0);
}

function taxCooperationQuotes(resolution, run, byNorm, heldStats) {
  const rows = [];
  for (const row of resolution.resolved || []) {
    const kind = row.claim?.attributes?.assertion_kind;
    if (!TAX_COOPERATION_KINDS.includes(kind)) continue;
    rows.push({
      run,
      source: 'resolved',
      section_reference: row.section_reference,
      asserted_kind: kind,
      quote: row.claim?.raw_value,
    });
  }
  for (const row of resolution.open_world || []) {
    const kind = row.attributes?.assertion_kind;
    if (!TAX_COOPERATION_KINDS.includes(kind)) continue;
    rows.push({
      run,
      source: 'open_world',
      section_reference: row.section_reference,
      asserted_kind: kind,
      quote: row.raw_value,
    });
  }

  for (const row of resolution.review_queue || []) {
    const resolved = resolveHeldQuote(row, byNorm);
    // Identify cooperation held rows by joined claim assertion_kind
    // (TAXM-* concept keys are not the assertion kind). Look up via the
    // normalised phrase, or via normaliseForMatching(raw_value) when the
    // review row already carries the quote.
    const joinKey = typeof row.normalised_phrase === 'string' && row.normalised_phrase.length > 0
      ? row.normalised_phrase
      : (typeof resolved.quote === 'string' ? normaliseForMatching(resolved.quote) : null);
    const hits = joinKey ? (byNorm.get(joinKey) || []) : [];
    const coopKinds = [...new Set(
      hits
        .map((claim) => claim.attributes?.assertion_kind)
        .filter((kind) => TAX_COOPERATION_KINDS.includes(kind)),
    )];

    let assertedKind = null;
    if (coopKinds.length === 1) assertedKind = coopKinds[0];
    else if (coopKinds.length > 1) {
      heldStats.review_queue_total += 1;
      bumpReason(heldStats.excluded_reasons, 'held_kind_ambiguous');
      continue;
    } else if (TAX_COOPERATION_KINDS.includes(row.attributes?.assertion_kind)) {
      assertedKind = row.attributes.assertion_kind;
    } else if (TAX_COOPERATION_KINDS.includes(row.concept_key)) {
      assertedKind = row.concept_key;
    } else if (TAX_COOPERATION_KINDS.includes(row.concept_family)) {
      assertedKind = row.concept_family;
    }
    if (!assertedKind) continue;

    heldStats.review_queue_total += 1;
    if (!resolved.quote) {
      bumpReason(heldStats.excluded_reasons, resolved.how);
      continue;
    }
    bumpReason(heldStats.quote_sources, resolved.how);
    heldStats.quotes_checked += 1;
    rows.push({
      run,
      source: 'review_queue',
      section_reference: row.section_reference,
      asserted_kind: assertedKind,
      quote: resolved.quote,
      hold_reasons: row.reasons || [],
      quote_source: resolved.how,
    });
  }

  return rows.filter((row) => typeof row.quote === 'string' && row.quote.length > 0);
}

function emptyHeldStats() {
  return {
    review_queue_total: 0,
    quotes_checked: 0,
    quote_sources: {},
    excluded_reasons: {},
  };
}

function buildReport() {
  const generalCovenantRuns = listRunDirs('-general-covenants-');
  const taxMattersRuns = listRunDirs('-tax-matters-');

  const generalHeld = emptyHeldStats();
  const taxHeld = emptyHeldStats();

  const generalCovenantRows = [];
  for (const run of generalCovenantRuns) {
    const resolution = readJsonIfPresent(path.join(EVIDENCE_ROOT, run, 'resolution.json'));
    if (!resolution) continue;
    const byNorm = compiledCandidateQuoteIndex(run);
    generalCovenantRows.push(...generalCovenantQuotes(resolution, run, byNorm, generalHeld));
  }

  const taxCooperationRows = [];
  for (const run of taxMattersRuns) {
    const resolution = readJsonIfPresent(path.join(EVIDENCE_ROOT, run, 'resolution.json'));
    if (!resolution) continue;
    const byNorm = compiledCandidateQuoteIndex(run);
    taxCooperationRows.push(...taxCooperationQuotes(resolution, run, byNorm, taxHeld));
  }

  const generalCovenantCollisions = [];
  for (const row of generalCovenantRows) {
    const matches = generalCovenantPrimaryMatchingCodes(row.quote);
    if (matches.length > 1) {
      generalCovenantCollisions.push({ ...row, matching_codes: matches });
    }
  }

  const taxCooperationCollisions = [];
  for (const row of taxCooperationRows) {
    const matches = taxCooperationPrimaryMatchingKinds(row.quote);
    if (matches.length > 1) {
      taxCooperationCollisions.push({ ...row, matching_kinds: matches });
    }
  }

  const generalBySource = Object.freeze({
    resolved_open_world: generalCovenantRows.filter((r) => r.source !== 'review_queue').length,
    review_queue: generalCovenantRows.filter((r) => r.source === 'review_queue').length,
  });
  const taxBySource = Object.freeze({
    resolved_open_world: taxCooperationRows.filter((r) => r.source !== 'review_queue').length,
    review_queue: taxCooperationRows.filter((r) => r.source === 'review_queue').length,
  });

  const generalHeldCollisions = generalCovenantCollisions.filter((r) => r.source === 'review_queue');
  const taxHeldCollisions = taxCooperationCollisions.filter((r) => r.source === 'review_queue');
  const generalResolvedCollisions = generalCovenantCollisions.filter((r) => r.source !== 'review_queue');
  const taxResolvedCollisions = taxCooperationCollisions.filter((r) => r.source !== 'review_queue');

  return {
    schema_version: 'CANONICAL_V2_CORROBORATION_COLLISION_REPORT/V2',
    note: 'Re-derived by scripts/canonical-v2-corroboration-collision-report.mjs. Zero model '
      + 'calls. Checks the SAME functions candidate-resolution.js calls against every '
      + "candidate's own byte-verified quote, including review_queue/held rows joined "
      + 'from run-receipt compiled_candidates. Fail-closed exclusions are counted, never '
      + 'silent.',
    general_covenants: {
      runs_scanned: generalCovenantRuns.length,
      quotes_checked: generalCovenantRows.length,
      quotes_by_source: generalBySource,
      review_queue_total: generalHeld.review_queue_total,
      review_queue_quotes_checked: generalHeld.quotes_checked,
      review_queue_quote_sources: generalHeld.quote_sources,
      review_queue_excluded: generalHeld.review_queue_total - generalHeld.quotes_checked,
      review_queue_excluded_reasons: generalHeld.excluded_reasons,
      collisions: generalCovenantCollisions,
      collisions_resolved_open_world: generalResolvedCollisions.length,
      collisions_review_queue: generalHeldCollisions.length,
    },
    tax_cooperation: {
      runs_scanned: taxMattersRuns.length,
      quotes_checked: taxCooperationRows.length,
      quotes_by_source: taxBySource,
      review_queue_total: taxHeld.review_queue_total,
      review_queue_quotes_checked: taxHeld.quotes_checked,
      review_queue_quote_sources: taxHeld.quote_sources,
      review_queue_excluded: taxHeld.review_queue_total - taxHeld.quotes_checked,
      review_queue_excluded_reasons: taxHeld.excluded_reasons,
      collisions: taxCooperationCollisions,
      collisions_resolved_open_world: taxResolvedCollisions.length,
      collisions_review_queue: taxHeldCollisions.length,
    },
  };
}

function formatReasonCounts(counts) {
  const entries = Object.entries(counts || {});
  if (entries.length === 0) return 'none';
  return entries.map(([reason, n]) => `\`${reason}\`=${n}`).join(', ');
}

function formatMarkdown(report) {
  const lines = [];
  lines.push('# Step 2X-C collision report');
  lines.push('');
  lines.push(
    'Generated by `node scripts/canonical-v2-corroboration-collision-report.mjs`. '
    + 'Re-derived from committed evidence, zero model calls; regenerate rather than '
    + 'hand-edit this file, and keep the exact command with the number if you cite it '
    + 'elsewhere.',
  );
  lines.push('');
  lines.push('## What this checks');
  lines.push('');
  lines.push(
    'PLAN.md Step 2X-C / DECISIONS.md §15: `guaranty-corroboration.js` and '
    + '`ioc-corroboration.js` already refuse when more than one pattern matches. '
    + '`general-covenant-corroboration.js` and `tax-cooperation-corroboration.js` '
    + 'asserted the same property in a comment. This script runs '
    + '`generalCovenantPrimaryMatchingCodes` and `taxCooperationPrimaryMatchingKinds` '
    + '-- the exact functions candidate-resolution.js calls -- against every committed '
    + "candidate's own byte-verified quote, including **review_queue / held** rows "
    + '(joined from `run-receipt.json` when the review row lacks `raw_value`).',
  );
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(
    '| family | runs | resolved+open_world quotes | held quotes checked | held excluded | '
    + 'collisions (resolved+OW) | collisions (held) | collisions (all) |',
  );
  lines.push('|---|---:|---:|---:|---:|---:|---:|---:|');
  lines.push(
    `| general_covenants | ${report.general_covenants.runs_scanned} | `
    + `${report.general_covenants.quotes_by_source.resolved_open_world} | `
    + `${report.general_covenants.review_queue_quotes_checked} | `
    + `${report.general_covenants.review_queue_excluded} | `
    + `${report.general_covenants.collisions_resolved_open_world} | `
    + `${report.general_covenants.collisions_review_queue} | `
    + `${report.general_covenants.collisions.length} |`,
  );
  lines.push(
    `| tax_cooperation | ${report.tax_cooperation.runs_scanned} | `
    + `${report.tax_cooperation.quotes_by_source.resolved_open_world} | `
    + `${report.tax_cooperation.review_queue_quotes_checked} | `
    + `${report.tax_cooperation.review_queue_excluded} | `
    + `${report.tax_cooperation.collisions_resolved_open_world} | `
    + `${report.tax_cooperation.collisions_review_queue} | `
    + `${report.tax_cooperation.collisions.length} |`,
  );
  lines.push('');
  lines.push('### Held-quote join accounting');
  lines.push('');
  lines.push(
    `- general_covenants review_queue rows: **${report.general_covenants.review_queue_total}** `
    + `(checked ${report.general_covenants.review_queue_quotes_checked}; `
    + `sources: ${formatReasonCounts(report.general_covenants.review_queue_quote_sources)}; `
    + `excluded: ${formatReasonCounts(report.general_covenants.review_queue_excluded_reasons)})`,
  );
  lines.push(
    `- tax_cooperation review_queue rows: **${report.tax_cooperation.review_queue_total}** `
    + `(checked ${report.tax_cooperation.review_queue_quotes_checked}; `
    + `sources: ${formatReasonCounts(report.tax_cooperation.review_queue_quote_sources)}; `
    + `excluded: ${formatReasonCounts(report.tax_cooperation.review_queue_excluded_reasons)})`,
  );
  lines.push('');

  function renderCollisions(title, collisions, matchesKey) {
    lines.push(`## ${title}`);
    lines.push('');
    if (collisions.length === 0) {
      lines.push(
        'Zero collisions across every scanned run (resolved, open_world, and held).',
      );
      lines.push('');
      return;
    }
    for (const [index, row] of collisions.entries()) {
      lines.push(`### ${index + 1}. \`${row.run}\` § ${row.section_reference} (${row.source})`);
      lines.push('');
      lines.push(`- asserted: \`${row.asserted_code ?? row.asserted_kind}\``);
      lines.push(`- matches: \`${row[matchesKey].join('`, `')}\``);
      if (row.hold_reasons?.length) {
        lines.push(`- hold reasons: \`${row.hold_reasons.join('`, `')}\``);
      }
      if (row.quote_source) {
        lines.push(`- quote source: \`${row.quote_source}\``);
      }
      lines.push(`- quote: "${row.quote}"`);
      lines.push('');
    }
  }

  renderCollisions('General covenants collisions', report.general_covenants.collisions, 'matching_codes');
  renderCollisions('Tax cooperation collisions', report.tax_cooperation.collisions, 'matching_kinds');

  lines.push('## Disposition');
  lines.push('');
  const heldCollisions = report.general_covenants.collisions_review_queue
    + report.tax_cooperation.collisions_review_queue;
  if (heldCollisions === 0
    && report.general_covenants.collisions_resolved_open_world === 0
    && report.tax_cooperation.collisions_resolved_open_world === 0) {
    lines.push(
      'Zero collisions on resolved+open_world **and** held. Per DECISIONS.md §15, '
      + 'enforcement of multi-code refusal on the primary-hit path is authorised '
      + '(would be a no-op on this corpus).',
    );
  } else if (heldCollisions > 0) {
    lines.push(
      `**Held collisions are non-zero (${heldCollisions}).** Per DECISIONS.md §15 / `
      + 'Step 2X-C: do **not** enforce multi-code refusal on the primary-hit path. '
      + 'Colliding quotes are published above for Ben. All general-covenant held '
      + 'collisions observed so far already carry `GENERAL_COVENANT_CODE_DOUBLE_FIRE` '
      + '(the existing different-owner double-fire hold), but that is not the same '
      + 'as primary-path multi-match refusal and does not authorise enforcement.',
    );
  } else {
    lines.push(
      'Resolved/open_world collisions are non-zero; do not enforce. See collisions above.',
    );
  }
  lines.push('');
  return lines.join('\n');
}

function main() {
  const args = parseArgs(process.argv);
  const report = buildReport();
  if (args.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }
  const markdown = formatMarkdown(report);
  if (args.write) {
    const outPath = path.resolve(REPO_ROOT, args.write);
    fs.writeFileSync(outPath, markdown);
    process.stderr.write(
      `[collision-report] wrote ${args.write}: `
      + `general_covenants ${report.general_covenants.collisions.length} collisions / `
      + `${report.general_covenants.quotes_checked} quotes `
      + `(held ${report.general_covenants.collisions_review_queue}/`
      + `${report.general_covenants.review_queue_quotes_checked}), `
      + `tax_cooperation ${report.tax_cooperation.collisions.length} collisions / `
      + `${report.tax_cooperation.quotes_checked} quotes `
      + `(held ${report.tax_cooperation.collisions_review_queue}/`
      + `${report.tax_cooperation.review_queue_quotes_checked})\n`,
    );
    return;
  }
  process.stdout.write(markdown);
}

main();
