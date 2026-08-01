#!/usr/bin/env node
/**
 * scripts/confirm-kind-ruling.mjs
 *
 * The queue -> Ben-confirms -> corpus write path (design spec, section "4.
 * Ruling corpus"; plan, "Task 4: ruling corpus", audit A6d: "the loop needs
 * real storage and a script"). This is the ONLY code path that writes
 * contracts/ruling-corpus/ruling-corpus.v1.json. It reads one item out of a
 * persisted `RESOLUTION_REVIEW_QUEUE/V1` artifact (the "Pinned
 * implementation decisions" section: "the resolver's `review_queue` bucket
 * is persisted by the run driver as a content-addressed
 * `RESOLUTION_REVIEW_QUEUE/V1` JSON artifact alongside the run receipt"),
 * takes the human's ruling on the command line, and appends a VERIFIED
 * ruling-corpus entry, recomputing the corpus's content address.
 *
 * AI DRAFTS CAN NEVER ENTER THE CORPUS THROUGH THIS SCRIPT. This script
 * never reads a drafted "answer" field and never calls a model; it only
 * accepts --kind/--code typed on the command line by the person invoking
 * it, and it always constructs `provenance_tag: 'VERIFIED'` itself -- there
 * is no flag that lets a caller write anything else.
 *
 * REVIEWER IDENTITY IS MANDATORY (design spec, "Pinned implementation
 * decisions"): --reviewer is required. This script refuses to write a
 * ruling without it.
 *
 * QUEUE ITEM SHAPE. `qualifier-kind-lexicon.js` and the queue-item schema
 * that will carry QUALIFIER_KIND_* reasons are being built in a parallel
 * task (Task 2/3 of the same plan) and do not exist yet at the time this
 * script is written, so this script depends on nothing from them. It reads
 * whatever object sits at `queue.review_queue[--index]` (or `queue.items`,
 * for forward compatibility with a differently-named array) and requires
 * that item to carry the three ruling-key fields directly:
 * `normalised_phrase` (or `quote`, zero-width-normalised here the same way
 * the lexicon does), `attachment_position`, and `concept_family`. A queue
 * item missing any of these is refused, not guessed at.
 *
 * Usage:
 *   node scripts/confirm-kind-ruling.mjs \
 *     --queue <path-to-RESOLUTION_REVIEW_QUEUE-V1.json> \
 *     --index <n> \
 *     --kind <KNOWLEDGE|TEMPORAL|ACCURACY|THRESHOLD> \
 *     [--code <CODE>] \
 *     --reviewer <name-or-email> \
 *     [--corpus <path-to-ruling-corpus.v1.json>] \
 *     [--lexicon-version <n>]
 *
 * --corpus defaults to contracts/ruling-corpus/ruling-corpus.v1.json.
 * --lexicon-version defaults to the corpus's own
 * QUALIFIER_KIND_LEXICON_VERSION import when that module exists; since it
 * does not yet, it is REQUIRED until that module lands (fails closed rather
 * than guessing a version number that would corrupt the receipt pin).
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { normaliseForMatching } = require('../lib/canonical-v2/zero-width-normalise');
const {
  buildRulingCorpus,
  appendRuling,
  QUALIFIER_KINDS,
  ATTACHMENT_POSITIONS,
} = require('../lib/canonical-v2/native-producer/ruling-corpus');

const DEFAULT_CORPUS_PATH = 'contracts/ruling-corpus/ruling-corpus.v1.json';

class ConfirmKindRulingError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfirmKindRulingError';
  }
}

function fail(message) {
  throw new ConfirmKindRulingError(message);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const flag = token.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      args[flag] = true;
    } else {
      args[flag] = next;
      i += 1;
    }
  }
  return args;
}

function requireStringArg(args, name) {
  const value = args[name];
  if (typeof value !== 'string' || value.length === 0) {
    fail(`--${name} is required`);
  }
  return value;
}

/**
 * Resolves the queue item's ruling-key fields. Exported for tests so they
 * can exercise the field-selection logic without shelling out.
 */
export function resolveQueueItemKeyFields(item) {
  if (!item || typeof item !== 'object') {
    fail('the selected queue item is not an object');
  }
  const attachmentPosition = item.attachment_position;
  if (!ATTACHMENT_POSITIONS.includes(attachmentPosition)) {
    fail(`the selected queue item's attachment_position must be one of ${ATTACHMENT_POSITIONS.join(', ')}`);
  }
  const conceptFamily = item.concept_family;
  if (typeof conceptFamily !== 'string' || conceptFamily.length === 0) {
    fail("the selected queue item is missing a non-empty 'concept_family'");
  }
  const rawPhrase = typeof item.normalised_phrase === 'string' && item.normalised_phrase.length > 0
    ? item.normalised_phrase
    : item.quote;
  if (typeof rawPhrase !== 'string' || rawPhrase.length === 0) {
    fail("the selected queue item is missing both 'normalised_phrase' and 'quote'");
  }
  const normalisedPhrase = normaliseForMatching(rawPhrase);
  return { normalised_phrase: normalisedPhrase, attachment_position: attachmentPosition, concept_family: conceptFamily };
}

/**
 * Selects one item out of a RESOLUTION_REVIEW_QUEUE/V1 artifact by index.
 * Exported for tests.
 */
export function selectQueueItem(queueArtifact, index) {
  if (!queueArtifact || typeof queueArtifact !== 'object') {
    fail('the queue artifact is not a JSON object');
  }
  const items = Array.isArray(queueArtifact.review_queue)
    ? queueArtifact.review_queue
    : queueArtifact.items;
  if (!Array.isArray(items)) {
    fail("the queue artifact has neither a 'review_queue' nor an 'items' array");
  }
  if (!Number.isInteger(index) || index < 0 || index >= items.length) {
    fail(`--index ${index} is out of range for a queue of ${items.length} item(s)`);
  }
  return items[index];
}

/**
 * Builds the VERIFIED ruling entry this script will append. Exported for
 * tests so the shape can be checked without touching the filesystem.
 */
export function buildVerifiedRulingEntry({
  keyFields,
  kind,
  code,
  reviewer,
  ruledAt,
  lexiconVersion,
}) {
  if (!QUALIFIER_KINDS.includes(kind)) {
    fail(`--kind must be one of ${QUALIFIER_KINDS.join(', ')}`);
  }
  if (typeof reviewer !== 'string' || reviewer.trim().length === 0) {
    fail('--reviewer is required and must be non-empty; refusing to write an unattributed ruling');
  }
  if (!Number.isInteger(lexiconVersion) || lexiconVersion < 1) {
    fail('--lexicon-version must be a positive integer');
  }
  return {
    normalised_phrase: keyFields.normalised_phrase,
    attachment_position: keyFields.attachment_position,
    concept_family: keyFields.concept_family,
    ruled_kind: kind,
    ruled_code: code == null ? null : code,
    ruler: reviewer.trim(),
    ruled_at: ruledAt,
    provenance_tag: 'VERIFIED',
    lexicon_version_at_ruling: lexiconVersion,
  };
}

function loadCorpus(corpusPath) {
  const raw = readFileSync(corpusPath, 'utf8');
  const parsed = JSON.parse(raw);
  // Round-trip through buildRulingCorpus so validation runs and the id is
  // recomputed from the file's own contents rather than trusted verbatim.
  return buildRulingCorpus({ version: parsed.version, rulings: parsed.rulings });
}

function writeCorpus(corpusPath, corpus) {
  writeFileSync(corpusPath, `${JSON.stringify(corpus, null, 2)}\n`);
}

export function run(argv) {
  const args = parseArgs(argv);

  // --reviewer is checked FIRST and unconditionally, before any file I/O,
  // per the design spec's pinned decision: "it refuses to write a ruling
  // without one."
  const reviewer = requireStringArg(args, 'reviewer');

  const queuePath = requireStringArg(args, 'queue');
  const indexRaw = requireStringArg(args, 'index');
  const index = Number.parseInt(indexRaw, 10);
  if (!Number.isInteger(index) || String(index) !== indexRaw.trim()) {
    fail(`--index must be an integer, got ${JSON.stringify(indexRaw)}`);
  }
  const kind = requireStringArg(args, 'kind');
  const code = typeof args.code === 'string' ? args.code : null;
  const lexiconVersionRaw = requireStringArg(args, 'lexicon-version');
  const lexiconVersion = Number.parseInt(lexiconVersionRaw, 10);
  if (!Number.isInteger(lexiconVersion) || String(lexiconVersion) !== lexiconVersionRaw.trim()) {
    fail(`--lexicon-version must be an integer, got ${JSON.stringify(lexiconVersionRaw)}`);
  }
  const corpusPath = typeof args.corpus === 'string' ? args.corpus : DEFAULT_CORPUS_PATH;

  const queueArtifact = JSON.parse(readFileSync(resolve(queuePath), 'utf8'));
  const item = selectQueueItem(queueArtifact, index);
  const keyFields = resolveQueueItemKeyFields(item);

  const entry = buildVerifiedRulingEntry({
    keyFields,
    kind,
    code,
    reviewer,
    ruledAt: new Date().toISOString(),
    lexiconVersion,
  });

  const resolvedCorpusPath = resolve(corpusPath);
  const corpus = loadCorpus(resolvedCorpusPath);
  const nextCorpus = appendRuling(corpus, entry);
  writeCorpus(resolvedCorpusPath, nextCorpus);

  return { entry, ruling_corpus_id: nextCorpus.ruling_corpus_id, path: resolvedCorpusPath };
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  try {
    const result = run(process.argv.slice(2));
    process.stdout.write(`${JSON.stringify({
      ok: true,
      ruling_corpus_id: result.ruling_corpus_id,
      path: result.path,
      entry: result.entry,
    }, null, 2)}\n`);
  } catch (err) {
    process.stderr.write(`confirm-kind-ruling: ${err.message}\n`);
    process.exitCode = 1;
  }
}
