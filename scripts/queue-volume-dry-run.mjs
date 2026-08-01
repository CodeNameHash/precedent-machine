#!/usr/bin/env node
/**
 * scripts/queue-volume-dry-run.mjs
 *
 * Queue-volume dry run (design spec, "Recall and volume instrumentation",
 * item 3; audit finding B6: "one human verifier; the number has never been
 * computed"). Reads N persisted `RESOLUTION_REVIEW_QUEUE/V1` JSON artifacts
 * -- the "Pinned implementation decisions" section: "the resolver's
 * `review_queue` bucket is persisted by the run driver as a
 * content-addressed `RESOLUTION_REVIEW_QUEUE/V1` JSON artifact alongside
 * the run receipt" -- and reports, BEFORE the 50-deal corpus is attempted:
 *
 *   1. Projected review-queue items per deal (and in total), so the human
 *      review bottleneck can be priced against real numbers instead of a
 *      guess.
 *   2. A corpus exact-key hit-rate estimate: of all queue items seen across
 *      the N deals, what fraction share an EXACT ruling-corpus key with an
 *      item from an earlier-processed deal? This is a leave-one-out
 *      approximation of "how many of these items would the corpus already
 *      have answered, had it been built from the deals processed so far" --
 *      the design spec is explicit that this is a HYPOTHESIS TO MEASURE,
 *      not a promise ("recurring quotes often embed deal-specific dates and
 *      numbers, so the cross-deal exact-match rate must be MEASURED").
 *
 * KEY STRATEGY. Task 4's ruling-corpus key is
 * (normalised phrase, attachment position, concept family) -- see
 * lib/canonical-v2/native-producer/ruling-corpus.js and
 * scripts/confirm-kind-ruling.mjs's `resolveQueueItemKeyFields`, which this
 * script mirrors for consistency. TODAY's `candidate-resolution.js` review
 * queue items do not yet carry `attachment_position` / `concept_family` /
 * a quote field (that wiring is a later integration task) -- an item that
 * DOES carry the triple gets a `TASK4_ALIGNED_KEY`; every other item falls
 * back to a documented, less precise `PROXY_KEY` built from
 * (resolved_claim_definition_key, concept_key, sorted reasons) so the
 * script still produces a number today rather than refusing to run. Every
 * item's `key_strategy` is reported, both per-item and in aggregate, so a
 * reader can see exactly how much of the reported hit rate rests on the
 * weaker proxy -- never a silently blended number.
 *
 * DETERMINISTIC, NO FILE WRITES BEYOND --out. This script never mutates
 * its inputs and never writes to the ruling corpus or any pipeline state;
 * it is read-only instrumentation. Files are processed in the order given
 * on the command line, and that order is the "earlier-processed deal"
 * ordering the hit-rate calculation uses -- callers who care about a
 * particular chronology (e.g. actual deal-signing order) must pass files
 * in that order themselves.
 *
 * Usage:
 *   node scripts/queue-volume-dry-run.mjs <queue-artifact.json> [<queue-artifact.json> ...] [--out <path>]
 *
 * Each positional argument is a path to a `RESOLUTION_REVIEW_QUEUE/V1` JSON
 * file: `{schema_version: 'RESOLUTION_REVIEW_QUEUE/V1', review_queue: [...]}`.
 * The deal id for each file is, in order of preference: the artifact's own
 * `deal_key` field, its `document_hash` field, or the file's own basename
 * (without extension). Prints the JSON report to stdout; with --out, also
 * writes it to that path.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { basename, extname } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { normaliseForMatching } = require('../lib/canonical-v2/zero-width-normalise');

const QUEUE_ARTIFACT_SCHEMA = 'RESOLUTION_REVIEW_QUEUE/V1';
const REPORT_SCHEMA = 'QUEUE_VOLUME_DRY_RUN_REPORT/V1';

export class QueueVolumeDryRunError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'QueueVolumeDryRunError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new QueueVolumeDryRunError(code, message, details);
}

/**
 * Reads and validates one `RESOLUTION_REVIEW_QUEUE/V1` artifact file.
 * Exported for tests.
 * @param {string} filePath
 * @returns {{deal_id: string, source_file: string, review_queue: object[]}}
 */
export function loadQueueArtifact(filePath) {
  let raw;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch (error) {
    fail('QUEUE_FILE_UNREADABLE', `could not read queue artifact at ${filePath}: ${error.message}`, { filePath });
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    fail('QUEUE_FILE_INVALID_JSON', `queue artifact at ${filePath} is not valid JSON: ${error.message}`, { filePath });
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    fail('QUEUE_FILE_INVALID_SHAPE', `queue artifact at ${filePath} must be a JSON object`, { filePath });
  }
  if (parsed.schema_version !== QUEUE_ARTIFACT_SCHEMA) {
    fail(
      'QUEUE_FILE_WRONG_SCHEMA',
      `queue artifact at ${filePath} has schema_version "${parsed.schema_version}", expected "${QUEUE_ARTIFACT_SCHEMA}"`,
      { filePath, schema_version: parsed.schema_version },
    );
  }
  if (!Array.isArray(parsed.review_queue)) {
    fail('QUEUE_FILE_MISSING_QUEUE', `queue artifact at ${filePath} has no 'review_queue' array`, { filePath });
  }

  const dealId = (typeof parsed.deal_key === 'string' && parsed.deal_key.length > 0 && parsed.deal_key)
    || (typeof parsed.document_hash === 'string' && parsed.document_hash.length > 0 && parsed.document_hash)
    || basename(filePath, extname(filePath));

  return { deal_id: dealId, source_file: filePath, review_queue: parsed.review_queue };
}

/**
 * Resolves one queue item's ruling-corpus exact key, per the strategy
 * documented in the file header. Never throws: an item this cannot key at
 * all (missing every candidate field) gets `key: null`, `key_strategy:
 * 'UNKEYABLE'`, and is excluded from the hit-rate denominator -- it is
 * still counted in the raw per-deal item totals.
 * Exported for tests.
 * @param {object} item
 * @returns {{key: string|null, key_strategy: 'TASK4_ALIGNED_KEY'|'PROXY_KEY'|'UNKEYABLE'}}
 */
export function resolveItemExactKey(item) {
  if (!item || typeof item !== 'object') {
    return { key: null, key_strategy: 'UNKEYABLE' };
  }

  const attachmentPosition = typeof item.attachment_position === 'string' ? item.attachment_position : null;
  const conceptFamily = typeof item.concept_family === 'string' && item.concept_family.length > 0
    ? item.concept_family
    : null;
  const rawPhrase = (typeof item.normalised_phrase === 'string' && item.normalised_phrase.length > 0 && item.normalised_phrase)
    || (typeof item.quote === 'string' && item.quote.length > 0 && item.quote)
    || null;

  if (attachmentPosition && conceptFamily && rawPhrase) {
    const normalisedPhrase = normaliseForMatching(rawPhrase);
    return {
      key: `TASK4/${normalisedPhrase}::${attachmentPosition}::${conceptFamily}`,
      key_strategy: 'TASK4_ALIGNED_KEY',
    };
  }

  const claimDefinitionKey = typeof item.resolved_claim_definition_key === 'string' ? item.resolved_claim_definition_key : '';
  const conceptKey = typeof item.concept_key === 'string' ? item.concept_key : '';
  const reasons = Array.isArray(item.reasons) ? [...item.reasons].sort() : [];

  if (claimDefinitionKey === '' && conceptKey === '' && reasons.length === 0) {
    return { key: null, key_strategy: 'UNKEYABLE' };
  }

  return {
    key: `PROXY/${claimDefinitionKey}::${conceptKey}::${reasons.join(',')}`,
    key_strategy: 'PROXY_KEY',
  };
}

/**
 * Pure analysis over already-loaded queue artifacts (processed in array
 * order). Exported for tests so the CLI's file I/O is not required to
 * exercise the logic.
 * @param {{deal_id: string, source_file: string, review_queue: object[]}[]} artifacts
 * @returns {object} frozen `QUEUE_VOLUME_DRY_RUN_REPORT/V1`
 */
export function analyzeQueueVolume(artifacts) {
  if (!Array.isArray(artifacts) || artifacts.length === 0) {
    fail('NO_ARTIFACTS', 'analyzeQueueVolume requires at least one queue artifact');
  }

  const seenKeys = new Set();
  const deals = [];
  const keyStrategyCounts = { TASK4_ALIGNED_KEY: 0, PROXY_KEY: 0, UNKEYABLE: 0 };
  let totalItems = 0;
  let keyableItems = 0;
  let recurringKeyHits = 0;

  for (const artifact of artifacts) {
    let dealRecurringHits = 0;
    for (const item of artifact.review_queue) {
      totalItems += 1;
      const { key, key_strategy: keyStrategy } = resolveItemExactKey(item);
      keyStrategyCounts[keyStrategy] += 1;
      if (key === null) continue;
      keyableItems += 1;
      if (seenKeys.has(key)) {
        recurringKeyHits += 1;
        dealRecurringHits += 1;
      }
      seenKeys.add(key);
    }
    deals.push({
      deal_id: artifact.deal_id,
      source_file: artifact.source_file,
      review_queue_item_count: artifact.review_queue.length,
      recurring_key_hits_against_earlier_deals: dealRecurringHits,
    });
  }

  const dealCount = deals.length;
  const averageItemsPerDeal = dealCount === 0 ? 0 : totalItems / dealCount;
  const hitRate = keyableItems === 0 ? null : recurringKeyHits / keyableItems;

  const report = {
    schema_version: REPORT_SCHEMA,
    deals,
    totals: {
      deal_count: dealCount,
      review_queue_item_count: totalItems,
      average_items_per_deal: averageItemsPerDeal,
    },
    exact_key_hit_rate: {
      key_strategy_counts: keyStrategyCounts,
      keyable_item_count: keyableItems,
      recurring_key_hit_count: recurringKeyHits,
      hit_rate: hitRate,
    },
  };

  return Object.freeze({
    ...report,
    deals: Object.freeze(deals.map((deal) => Object.freeze(deal))),
    totals: Object.freeze(report.totals),
    exact_key_hit_rate: Object.freeze({
      ...report.exact_key_hit_rate,
      key_strategy_counts: Object.freeze(keyStrategyCounts),
    }),
  });
}

function parseCliArgs(argv) {
  const files = [];
  let outPath = null;
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--out') {
      outPath = argv[i + 1];
      i += 1;
    } else {
      files.push(token);
    }
  }
  return { files, outPath };
}

function main(argv) {
  const { files, outPath } = parseCliArgs(argv);
  if (files.length === 0) {
    fail('NO_INPUT_FILES', 'usage: node scripts/queue-volume-dry-run.mjs <queue-artifact.json> [...] [--out <path>]');
  }

  const artifacts = files.map((filePath) => loadQueueArtifact(filePath));
  const report = analyzeQueueVolume(artifacts);
  const json = `${JSON.stringify(report, null, 2)}\n`;

  process.stdout.write(json);
  if (outPath) {
    writeFileSync(outPath, json);
  }
}

const isMainModule = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`[queue-volume-dry-run] ${error.name}: ${error.message}\n`);
    process.exitCode = 1;
  }
}
