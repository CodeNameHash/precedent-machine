#!/usr/bin/env node
/**
 * scripts/draft-kind-rulings.mjs
 *
 * Task 7 (separable) of docs/superpowers/plans/2026-08-01-claim-identity-
 * provenance-plan.md ("AI review drafter"), per design spec
 * docs/superpowers/specs/2026-08-01-claim-identity-provenance-design.md,
 * "5. Provenance tags" -> "AI review drafter" subsection, plus "4. Ruling
 * corpus" and "Pinned implementation decisions" (the persisted
 * `RESOLUTION_REVIEW_QUEUE/V1` artifact this script reads).
 *
 * WHAT THIS DOES. Reads a persisted `RESOLUTION_REVIEW_QUEUE/V1` JSON
 * artifact (the run driver's on-disk review queue -- see
 * scripts/confirm-kind-ruling.mjs and scripts/queue-volume-dry-run.mjs for
 * the same artifact read elsewhere), picks out the items that need a
 * qualifier-KIND decision (reasons include `QUALIFIER_KIND_DISAGREEMENT`,
 * `QUALIFIER_KIND_UNCLASSIFIED`, or `RULING_LEXICON_CONFLICT` --
 * qualifier-kind-lexicon.js and ruling-corpus.js's own typed outcomes), and
 * for each one composes a SELF-CONTAINED prompt (the quote, the four kind
 * definitions, the exception-connective binding-rule summary, and the
 * current VERIFIED rulings from the ruling corpus) and asks a cheap model
 * to draft a recommended ruling with reasons anchored to the quoted words.
 *
 * MODEL BACKEND: `claude -p`, NOT Codex. The repo's CLAUDE.md routing
 * mechanics say gpt-5.x (Codex) is reachable "only through the Codex CLI
 * (`codex exec` / `codex review`), local terminal sessions only." THIS
 * ENVIRONMENT DOES NOT HAVE THE CODEX CLI AVAILABLE, so this script drives
 * the cheap model through the Claude Code subscription CLI instead --
 * `claude -p <prompt> --model haiku` style, the same zero-API-token
 * subscription backend documented in lib/llm-cli-client.js and used by
 * scripts/canonical-v2-f28-live-extraction-run.mjs's `runClaudeCli`. The
 * exact command is injectable via `--runner` (see below) precisely so a
 * future environment with Codex available -- or a test's stub -- can swap
 * it in without editing this file.
 *
 * DRAFTS NEVER ENTER THE QUEUE FILE OR THE RULING CORPUS. This script only
 * ever READS `--queue` and (read-only) the ruling-corpus file; the only
 * file it writes is a SEPARATE drafts artifact, `<queue-path>.drafts.json`
 * by default (or `--out`). It never calls `writeFileSync` on the queue path
 * or the corpus path, and it never requires or calls anything in
 * ruling-corpus.js's write path (`appendRuling`) -- only a human, through
 * scripts/confirm-kind-ruling.mjs, can write a VERIFIED ruling into the
 * corpus. A draft missing quote-anchored reasons (any
 * `reasons_anchored_to_quote` entry that is not a verbatim substring of the
 * quote) is rejected by this script itself and never written to the drafts
 * artifact -- the spec requires reasons anchored to the quoted words, and a
 * script that wrote an unanchored "reason" would be worse than no draft.
 *
 * PROMPT_VERSION. `DRAFTER_PROMPT_VERSION` below is pinned into every
 * draft's `answer_provenance.pins`, per the spec's provenance-tag pinning
 * rule for AI answers ("pins model, prompt version, skill/ruleset
 * version"). Bump it whenever the composed prompt's instructions change in
 * a way that could change a model's answer; `skill_version` pins
 * .claude/skills/ruling-drafter/SKILL.md's own version.
 *
 * NO SECRETS IN PROMPTS. The composed prompt contains only: the queued
 * quote (already public deal text drawn from an admitted SEC filing), the
 * kind lexicon's own public definitions, and the ruling corpus's own
 * content (phrases, kinds, codes -- never reviewer PII beyond a name/email
 * already present in the corpus file, which this script does not add to or
 * redact further than the corpus already stores).
 *
 * Usage:
 *   node scripts/draft-kind-rulings.mjs \
 *     --queue <path-to-RESOLUTION_REVIEW_QUEUE-V1.json> \
 *     [--out <path, default <queue>.drafts.json>] \
 *     [--corpus <path, default contracts/ruling-corpus/ruling-corpus.v1.json>] \
 *     [--model <cli model alias, default "haiku">] \
 *     [--runner <shell command to run instead of the default `claude -p`>] \
 *     [--skill-version <n, default 1>] \
 *     [--dry-run]
 *
 * --dry-run prints every composed prompt (with its queue item ref) to
 * stdout and calls no runner and writes no drafts artifact -- a safe way to
 * inspect exactly what would be sent to the model before spending a call.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { normaliseForMatching } = require('../lib/canonical-v2/zero-width-normalise');
// Read-only requires. This script never calls anything in either module's
// write/mutation surface -- ruling-corpus.js's `appendRuling` and
// candidate-resolution.js are not imported at all (the latter is the file
// boundary this task must stay out of; the former is the corpus's only
// write path and belongs solely to scripts/confirm-kind-ruling.mjs).
const {
  QUALIFIER_KINDS,
  ACCURACY_CODE_WHITELIST,
  AUTO_BINDING_CONNECTIVE_PHRASES,
} = require('../lib/canonical-v2/native-producer/qualifier-kind-lexicon');
const { ATTACHMENT_POSITIONS, validateRulingCorpus } = require('../lib/canonical-v2/native-producer/ruling-corpus');

export const DRAFTER_PROMPT_VERSION = 1;
export const DEFAULT_MODEL = 'haiku';
export const DEFAULT_SKILL_VERSION = 1;
export const DEFAULT_CORPUS_PATH = 'contracts/ruling-corpus/ruling-corpus.v1.json';

const QUEUE_ARTIFACT_SCHEMA = 'RESOLUTION_REVIEW_QUEUE/V1';
export const DRAFTS_ARTIFACT_SCHEMA = 'RESOLUTION_REVIEW_QUEUE_DRAFTS/V1';

// The three typed reasons that mean "this item needs a human (or a draft
// for the human) to pick a qualifier KIND" -- qualifier-kind-lexicon.js's
// two doubt-routing outcomes, plus ruling-corpus.js's lexicon-conflict
// outcome. Any other review-queue reason (PARTY_UNRESOLVED,
// ASSERTION_SCOPE_AMBIGUOUS, MULTI_SPAN_COMPOSED, ...) is out of scope for
// this drafter -- a kind ruling would not answer the question it raises.
export const KIND_REVIEW_REASONS = Object.freeze([
  'QUALIFIER_KIND_DISAGREEMENT',
  'QUALIFIER_KIND_UNCLASSIFIED',
  'RULING_LEXICON_CONFLICT',
]);

export class DraftKindRulingsError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'DraftKindRulingsError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new DraftKindRulingsError(code, message, details);
}

// ─── CLI args ───

export function parseArgs(argv) {
  const args = {
    model: DEFAULT_MODEL,
    corpus: DEFAULT_CORPUS_PATH,
    skillVersion: DEFAULT_SKILL_VERSION,
    dryRun: false,
    runner: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    switch (token) {
      case '--queue': args.queue = argv[++i]; break;
      case '--out': args.out = argv[++i]; break;
      case '--corpus': args.corpus = argv[++i]; break;
      case '--model': args.model = argv[++i]; break;
      case '--runner': args.runner = argv[++i]; break;
      case '--skill-version': args.skillVersion = Number.parseInt(argv[++i], 10); break;
      case '--dry-run': args.dryRun = true; break;
      default: fail('UNRECOGNISED_ARGUMENT', `unrecognised argument: ${token}`, { token });
    }
  }
  if (!args.queue) fail('MISSING_QUEUE', '--queue is required');
  if (!args.out) args.out = `${args.queue}.drafts.json`;
  if (!Number.isInteger(args.skillVersion) || args.skillVersion < 1) {
    fail('INVALID_SKILL_VERSION', '--skill-version must be a positive integer');
  }
  return args;
}

// ─── Queue / corpus loading (read-only) ───

export function loadQueueArtifact(queuePath) {
  let raw;
  try {
    raw = readFileSync(queuePath, 'utf8');
  } catch (error) {
    fail('QUEUE_FILE_UNREADABLE', `could not read queue artifact at ${queuePath}: ${error.message}`, { queuePath });
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    fail('QUEUE_FILE_INVALID_JSON', `queue artifact at ${queuePath} is not valid JSON: ${error.message}`, { queuePath });
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    fail('QUEUE_FILE_INVALID_SHAPE', `queue artifact at ${queuePath} must be a JSON object`, { queuePath });
  }
  if (parsed.schema_version !== QUEUE_ARTIFACT_SCHEMA) {
    fail(
      'QUEUE_FILE_WRONG_SCHEMA',
      `queue artifact at ${queuePath} has schema_version "${parsed.schema_version}", expected "${QUEUE_ARTIFACT_SCHEMA}"`,
      { queuePath, schema_version: parsed.schema_version },
    );
  }
  if (!Array.isArray(parsed.review_queue)) {
    fail('QUEUE_FILE_MISSING_QUEUE', `queue artifact at ${queuePath} has no 'review_queue' array`, { queuePath });
  }
  return parsed;
}

export function loadVerifiedCorpusEntries(corpusPath) {
  if (!existsSync(corpusPath)) return [];
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(corpusPath, 'utf8'));
  } catch (error) {
    fail('CORPUS_FILE_INVALID_JSON', `ruling corpus at ${corpusPath} is not valid JSON: ${error.message}`, { corpusPath });
  }
  validateRulingCorpus(parsed);
  return parsed.rulings.filter((entry) => entry.provenance_tag === 'VERIFIED');
}

/**
 * Selects the review-queue items that need a qualifier-KIND draft. Returns
 * `{index, item}` pairs so a draft can carry back a stable reference into
 * the ORIGINAL queue artifact's array (the same index
 * scripts/confirm-kind-ruling.mjs's `--index` accepts).
 */
export function selectKindReviewItems(queueArtifact) {
  const selected = [];
  queueArtifact.review_queue.forEach((item, index) => {
    const reasons = Array.isArray(item && item.reasons) ? item.reasons : [];
    if (reasons.some((reason) => KIND_REVIEW_REASONS.includes(reason))) {
      selected.push({ index, item });
    }
  });
  return selected;
}

/** The quote text an item carries, preferring the already-normalised field. */
function itemQuote(item) {
  const raw = (typeof item.normalised_phrase === 'string' && item.normalised_phrase.length > 0 && item.normalised_phrase)
    || (typeof item.quote === 'string' && item.quote.length > 0 && item.quote)
    || (typeof item.raw_value === 'string' && item.raw_value.length > 0 && item.raw_value)
    || null;
  return raw;
}

// ─── Prompt composition ───

const KIND_DEFINITIONS_TEXT = `Qualifier KIND definitions (four families; a quote fires exactly one KIND, or is split into more than one part that each fire one, per the binding rule below):
- KNOWLEDGE: the qualifier limits a representation to a party's knowledge ("to the knowledge of", "known to", "aware of" family).
- TEMPORAL: the qualifier dates the representation or the qualifier itself ("as of" plus a calendar date or a closed symbolic date: "the date hereof", "the date of this Agreement", "the Closing Date", "the Effective Time").
- ACCURACY: the qualifier states a truth/completeness standard ("true and correct", "correct and complete", "in all respects", "in all material respects" family).
- THRESHOLD: the qualifier states a materiality, monetary, percentage, or de minimis threshold ("material to ...", dollar amounts, percentages, de minimis carve-outs).`;

const BINDING_RULE_TEXT = `Exception-connective binding rule (governs multi-marker quotes):
- Auto-binding connectives: "except", "except for", "except as", "other than", "excluding". "provided that" and "subject to" are NOT auto-binding (they can introduce independent obligations) -- treat a quote containing them as genuinely ambiguous rather than resolving it yourself.
- A marker found INSIDE a bound "except ..." (etc.) clause is part of that clause's own host qualifier, never a separate, free-standing qualifier. Example: "true and correct, except for inaccuracies that are not material ..." is ONE ACCURACY unit, not ACCURACY + THRESHOLD.
- A bound clause can extend through a comma when the text after the comma is still part of the same exception (e.g. a list "except for X, Y and Z, ..." or a clause with its own internal comma like "..., as amended, or other applicable ... Laws"). Do not assume the first comma ends the clause.
- Only a representation-level (CHAPEAU) ACCURACY qualifier may resolve to a registered accuracy-standard claim. An ITEM-attached (limb-level) ACCURACY qualifier is NOT a rep-level claim and must be flagged as such if you believe that is the correct kind.`;

function formatAccuracyWhitelist() {
  return ACCURACY_CODE_WHITELIST
    .map((pair) => `  - "${pair.phrase}" -> ${pair.code}`)
    .join('\n');
}

function formatCorpusEntries(entries) {
  if (entries.length === 0) return '  (no VERIFIED rulings in the corpus yet)';
  return entries
    .map((entry) => `  - phrase="${entry.normalised_phrase}" attachment=${entry.attachment_position} family=${entry.concept_family} -> kind=${entry.ruled_kind}${entry.ruled_code ? ` code=${entry.ruled_code}` : ''}`)
    .join('\n');
}

/**
 * Composes one SELF-CONTAINED prompt for a single queue item. Self-
 * contained per CLAUDE.md's Codex-handoff mechanics (this script's own
 * model backend differs, but the same "no conversation history, everything
 * the model needs is in the prompt" discipline applies): the quote, the
 * kind definitions, the binding-rule summary, the current VERIFIED rulings,
 * and the exact JSON shape the model must answer with.
 */
export function composePrompt({ item, verifiedCorpusEntries }) {
  const quote = itemQuote(item);
  if (!quote) {
    fail('ITEM_MISSING_QUOTE', 'queue item has no normalised_phrase/quote/raw_value to draft against', { item });
  }
  const attachmentPosition = item.attachment_position || '(unknown -- infer from context if stated in the reasons; otherwise say so)';
  const conceptFamily = item.concept_family || item.concept_key || '(unknown)';
  const reasons = Array.isArray(item.reasons) ? item.reasons.join(', ') : '(none recorded)';

  return `You are drafting a RECOMMENDATION only. A human reviewer confirms or corrects every draft; nothing you output enters any system of record. Never invent facts not present in the quote below.

TASK: classify the QUOTED WORDS below into exactly one qualifier KIND (${QUALIFIER_KINDS.join(', ')}), and, if the kind is ACCURACY, propose a code from the closed whitelist below (or null if none matches exactly). Every reason you give must be a VERBATIM substring copied from the quoted words -- do not paraphrase, do not quote words that are not in the text below.

QUOTED WORDS (verbatim; quote your reasons from exactly this text):
"""
${quote}
"""

Queue item context: attachment_position=${attachmentPosition}, concept_family=${conceptFamily}, review reasons=[${reasons}].

${KIND_DEFINITIONS_TEXT}

${BINDING_RULE_TEXT}

ACCURACY code whitelist (exact normalised-phrase match only; if the quote does not exactly match one of these, code must be null):
${formatAccuracyWhitelist()}

Auto-binding connective phrases: ${AUTO_BINDING_CONNECTIVE_PHRASES.join(', ')}

Current VERIFIED rulings in the ruling corpus (for context only -- do not assume the quote above matches one of these unless it is an exact phrase match):
${formatCorpusEntries(verifiedCorpusEntries)}

Attachment positions in this system: ${ATTACHMENT_POSITIONS.join(', ')}.

Respond with ONLY a single JSON object, no prose before or after, exactly this shape:
{"drafted_kind": "<one of ${QUALIFIER_KINDS.join('|')}>", "drafted_code": "<a whitelist code or null>", "reasons_anchored_to_quote": ["<verbatim snippet from the quoted words>", "..."]}

"reasons_anchored_to_quote" must contain at least one entry, and every entry must be an exact substring of the quoted words above. If you cannot classify with a reason anchored to the quoted words, respond with "drafted_kind": null and an empty "reasons_anchored_to_quote" array -- do not guess.`;
}

// ─── Model runner (injectable) ───

function childEnv() {
  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY; // force subscription auth, not metered billing -- matches the F28 live-run scripts' convention
  return env;
}

/**
 * Default runner: `claude -p --output-format json --model <model>`, the
 * same subscription-CLI backend scripts/canonical-v2-f28-live-extraction-
 * run.mjs's `runClaudeCli` drives. Returns the raw stdout text.
 */
function defaultClaudeRunner(promptText, { model, timeoutMs = 5 * 60 * 1000 } = {}) {
  const result = spawnSync('claude', ['-p', '--output-format', 'json', '--model', model], {
    input: promptText,
    env: childEnv(),
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error) fail('RUNNER_SPAWN_FAILED', `failed to spawn claude -p: ${result.error.message}`, { model });
  if (result.status !== 0) {
    fail('RUNNER_NONZERO_EXIT', `claude -p exited ${result.status}: ${String(result.stderr).slice(0, 800)}`, { model, status: result.status });
  }
  return result.stdout;
}

/**
 * `--runner` invokes an arbitrary shell command instead, receiving the
 * prompt on stdin and expected to print either (a) the raw JSON draft
 * object, or (b) a `claude -p --output-format json`-shaped envelope whose
 * `.result` field is that JSON as text -- `extractRunnerJson` accepts both
 * so a stub test double can just echo canned JSON without emulating the CLI
 * envelope, while the real default runner's actual output still parses.
 */
function shellRunner(command, promptText, { timeoutMs = 5 * 60 * 1000 } = {}) {
  const result = spawnSync(command, {
    input: promptText,
    env: childEnv(),
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 16 * 1024 * 1024,
    shell: true,
  });
  if (result.error) fail('RUNNER_SPAWN_FAILED', `failed to spawn --runner command: ${result.error.message}`, { command });
  if (result.status !== 0) {
    fail('RUNNER_NONZERO_EXIT', `--runner command exited ${result.status}: ${String(result.stderr).slice(0, 800)}`, { command, status: result.status });
  }
  return result.stdout;
}

/** Unwraps either a bare JSON draft object or a `claude -p` CLI envelope. */
export function extractRunnerJson(rawOutput) {
  let parsed;
  try {
    parsed = JSON.parse(rawOutput);
  } catch (error) {
    fail('RUNNER_OUTPUT_NOT_JSON', `runner output is not valid JSON: ${error.message}`, { rawOutput: String(rawOutput).slice(0, 800) });
  }
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      && !('drafted_kind' in parsed) && typeof parsed.result === 'string') {
    // CLI envelope (claude -p --output-format json): unwrap .result, which
    // is itself expected to be the model's JSON answer text.
    if (parsed.is_error) fail('RUNNER_MODEL_ERROR', `claude -p reported an error: ${String(parsed.result).slice(0, 500)}`);
    try {
      return JSON.parse(parsed.result);
    } catch (error) {
      fail('RUNNER_RESULT_NOT_JSON', `claude -p's .result field is not valid JSON: ${error.message}`, { result: String(parsed.result).slice(0, 800) });
    }
  }
  return parsed;
}

export function runModel(promptText, { model, runnerCommand }) {
  const raw = runnerCommand
    ? shellRunner(runnerCommand, promptText, { model })
    : defaultClaudeRunner(promptText, { model });
  return extractRunnerJson(raw);
}

// ─── Draft validation / rejection ───

/**
 * Validates a raw model answer against the queue item's quote and builds
 * the stored draft object, or returns `{rejected: true, reason}` if the
 * answer is unusable -- most importantly, per the spec's requirement that
 * every reason be anchored to the quoted words, when
 * `reasons_anchored_to_quote` is missing, empty, or contains ANY entry that
 * is not a verbatim substring of the quote. A rejected draft is never
 * written to the drafts artifact.
 */
export function buildDraftOrReject({
  queueItemRef, quote, modelAnswer, model, skillVersion,
}) {
  if (!modelAnswer || typeof modelAnswer !== 'object') {
    return { rejected: true, reason: 'MODEL_ANSWER_NOT_AN_OBJECT' };
  }
  const { drafted_kind: draftedKind, drafted_code: draftedCode, reasons_anchored_to_quote: reasons } = modelAnswer;

  if (draftedKind === null) {
    return { rejected: true, reason: 'MODEL_ABSTAINED' };
  }
  if (!QUALIFIER_KINDS.includes(draftedKind)) {
    return { rejected: true, reason: 'INVALID_DRAFTED_KIND' };
  }
  if (draftedCode !== null && draftedCode !== undefined && typeof draftedCode !== 'string') {
    return { rejected: true, reason: 'INVALID_DRAFTED_CODE' };
  }
  if (!Array.isArray(reasons) || reasons.length === 0) {
    return { rejected: true, reason: 'MISSING_ANCHORED_REASONS' };
  }
  const normalisedQuote = normaliseForMatching(quote);
  const unanchored = reasons.filter((reason) => {
    if (typeof reason !== 'string' || reason.length === 0) return true;
    // Anchoring is checked both against the raw quote and its zero-width-
    // normalised form (comparison only, per zero-width-normalise.js's own
    // two-layer rule), so a reason that matches after normalisation is
    // still accepted even if the raw text carries an invisible character
    // the model's own output does not reproduce byte-for-byte.
    return !quote.includes(reason) && !normalisedQuote.includes(normaliseForMatching(reason));
  });
  if (unanchored.length > 0) {
    return { rejected: true, reason: 'UNANCHORED_REASON', details: { unanchored } };
  }

  return {
    rejected: false,
    draft: {
      queue_item_ref: queueItemRef,
      drafted_kind: draftedKind,
      drafted_code: draftedCode === undefined ? null : draftedCode,
      reasons_anchored_to_quote: reasons,
      answer_provenance: {
        tag: 'AI',
        pins: {
          model,
          prompt_version: DRAFTER_PROMPT_VERSION,
          skill_version: skillVersion,
        },
      },
    },
  };
}

// ─── Orchestration ───

/**
 * Runs the full drafter over an already-loaded queue artifact. Exported for
 * tests so the file-system/CLI plumbing is not required to exercise the
 * logic. `runner` is injectable ({model, promptText, runnerCommand} ->
 * parsed JSON model answer, or a synchronous function) -- tests pass a stub
 * that never shells out.
 */
export function draftKindRulings({
  queueArtifact,
  verifiedCorpusEntries,
  model,
  skillVersion,
  dryRun,
  runner = runModel,
  runnerCommand = null,
}) {
  const selected = selectKindReviewItems(queueArtifact);
  const prompts = [];
  const drafts = [];
  const rejections = [];

  for (const { index, item } of selected) {
    const quote = itemQuote(item);
    const queueItemRef = {
      index,
      normalised_phrase: quote ? normaliseForMatching(quote) : null,
      attachment_position: item.attachment_position || null,
      concept_family: item.concept_family || item.concept_key || null,
    };

    if (!quote) {
      rejections.push({ queue_item_ref: queueItemRef, reason: 'ITEM_MISSING_QUOTE' });
      continue;
    }

    const prompt = composePrompt({ item, verifiedCorpusEntries });
    prompts.push({ queue_item_ref: queueItemRef, prompt });

    if (dryRun) continue;

    const modelAnswer = runner(prompt, { model, runnerCommand });
    const outcome = buildDraftOrReject({
      queueItemRef, quote, modelAnswer, model, skillVersion,
    });
    if (outcome.rejected) {
      rejections.push({ queue_item_ref: queueItemRef, reason: outcome.reason, details: outcome.details || null });
    } else {
      drafts.push(outcome.draft);
    }
  }

  return { prompts, drafts, rejections, selected_count: selected.length };
}

export function buildDraftsArtifact({
  queuePath, drafts, rejections, model, skillVersion,
}) {
  return {
    schema_version: DRAFTS_ARTIFACT_SCHEMA,
    queue_source: queuePath,
    generated_at: new Date().toISOString(),
    drafter_prompt_version: DRAFTER_PROMPT_VERSION,
    skill_version: skillVersion,
    model,
    drafts,
    rejections,
  };
}

// ─── CLI entry point ───

function main(argv) {
  const args = parseArgs(argv);
  const queuePath = resolve(args.queue);
  const corpusPath = resolve(args.corpus);
  const outPath = resolve(args.out);

  const queueArtifact = loadQueueArtifact(queuePath);
  const verifiedCorpusEntries = loadVerifiedCorpusEntries(corpusPath);

  const { prompts, drafts, rejections, selected_count: selectedCount } = draftKindRulings({
    queueArtifact,
    verifiedCorpusEntries,
    model: args.model,
    skillVersion: args.skillVersion,
    dryRun: args.dryRun,
    runnerCommand: args.runner,
  });

  if (args.dryRun) {
    process.stdout.write(`${JSON.stringify({
      ok: true,
      dry_run: true,
      queue: queuePath,
      selected_count: selectedCount,
      prompts,
    }, null, 2)}\n`);
    return;
  }

  const artifact = buildDraftsArtifact({
    queuePath, drafts, rejections, model: args.model, skillVersion: args.skillVersion,
  });
  writeFileSync(outPath, `${JSON.stringify(artifact, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({
    ok: true,
    dry_run: false,
    queue: queuePath,
    out: outPath,
    selected_count: selectedCount,
    drafted_count: drafts.length,
    rejected_count: rejections.length,
  }, null, 2)}\n`);
}

const isMainModule = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`[draft-kind-rulings] ${error.name}: ${error.message}\n`);
    process.exitCode = 1;
  }
}
