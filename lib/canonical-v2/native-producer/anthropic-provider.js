/**
 * lib/canonical-v2/native-producer/anthropic-provider.js
 *
 * The first real backend behind provider-interface.js's injected-provider
 * seam. `createAnthropicProvider(...)` returns a function matching that
 * seam's signature exactly -- `({governed_scope, definitions, contract_bundle})
 * => providerOutput` -- so this module is interchangeable with a recorded
 * fixture in tests and with `--replay` in the CLI. It never imports
 * provider-interface.js or candidate-proposal-compiler.js and never calls
 * either; it only has to produce output shaped so they accept it.
 *
 * SCOPE. This file builds the prompt (via the frozen
 * capitalisation-producer-prompt.js), calls the model, parses the response
 * with the repo's existing tolerant JSON parser, and validates the response
 * against the prompt's own RESPONSE_SHAPE contract. It then performs a
 * MECHANICAL, STRUCTURAL translation from that response into the proposal
 * shape candidate-proposal-compiler.js expects -- one proposal per
 * qualifier / limb assertion / bring-down tier / open-world candidate --
 * using fixed, generic "_CANDIDATE" claim_definition_keys. This is NOT
 * legal classification: every response produces the same bucket structure
 * regardless of content, so there is no judgment call about which real
 * production claim type a proposition belongs to. That reconciliation is
 * deliberately left to a later stage.
 *
 * Every emitted claim's evidence is a byte-exact span located in the exact
 * source_text the model was given (see `locateQuoteBytes`). A quote the
 * model returned that cannot be found byte-for-byte in the source is
 * DROPPED -- the specific candidate it would have backed is skipped, never
 * fabricated with an invented offset. This mirrors the prompt's own EVIDENCE
 * RULE ("a quote that does not reproduce exactly is discarded and the
 * proposal with it").
 *
 * FAILURE CONTRACT. A malformed, incomplete, or oversized model response is
 * a typed `NativeProducerAnthropicError`, never an empty `proposals: []`.
 * An empty array can only result from a WELL-FORMED response whose
 * structural lists were genuinely empty, or one whose quotes all failed
 * byte-verification (a hallucination signal, not "nothing here" -- callers
 * should treat proposals: [] alongside dropped_quote_mismatches > 0 as
 * suspect, not as a clean negative).
 *
 * QUALIFIERS LIVE AT THE REPRESENTATION LEVEL, NOT NESTED IN A LIMB
 * (PROMPT_VERSION 2, see capitalisation-producer-prompt.js and
 * docs/handoffs/F28-FIRST-LIVE-RUN.md defect 2). A qualifier's scope is
 * described entirely by its `attachment.governs_path` -- a limb_path array,
 * or null for a representation-wide chapeau qualifier -- so nesting a
 * qualifier inside one specific limb object would be redundant for ITEM
 * qualifiers and structurally impossible for CHAPEAU/TRAILING qualifiers,
 * which do not belong to any single limb. `attachment.scope_reading` is
 * NEVER read from the model's response (there is no such field in the
 * contract): it is always computed here, deterministically, by
 * qualifier-attachment.js, from `attachment.position` and the qualifier's
 * own byte-verified quote text.
 */

'use strict';

const { contentId } = require('../canonical-bytes');
const { parseJSON } = require('../../parser-v2/parse-json');
const { MODEL: DEFAULT_MODEL } = require('../../model');
const {
  PROMPT_ID,
  PROMPT_VERSION,
  CONTROLLED_VOCABULARIES,
  buildCapitalisationProducerPrompt,
} = require('./capitalisation-producer-prompt');
const { resolveQualifierAttachment } = require('./qualifier-attachment');

const PROVIDER_ID = 'native-producer-anthropic/v1';
const RESPONSE_VERSION = 'NATIVE_PRODUCER_ANTHROPIC/V1';
const SUBJECT_DOMAIN = 'NATIVE_PRODUCER_SUBJECT/V1';
const EXCERPT_DOMAIN = 'NATIVE_PRODUCER_EXCERPT/V1';

const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_MAX_TOKENS = 8000;
const DEFAULT_MAX_RESPONSE_CHARS = 200000;

const REQUIRED_RESPONSE_LISTS = Object.freeze([
  'representation_instances',
  'bring_down_conditions',
  'open_world_candidates',
]);

const QUALIFIER_CLAIM_KEY = 'NATIVE_CAPITALISATION_QUALIFIER_CANDIDATE';
const LIMB_ASSERTION_CLAIM_KEY = 'NATIVE_CAPITALISATION_LIMB_ASSERTION_CANDIDATE';
const BRING_DOWN_TIER_CLAIM_KEY = 'NATIVE_BRING_DOWN_TIER_CANDIDATE';
const OPEN_WORLD_CLAIM_KEY = 'OPEN_WORLD_PROPOSITION';

const ACCURACY_CODES = Object.freeze(Object.keys(CONTROLLED_VOCABULARIES.ACCURACY_STANDARD));
const KNOWLEDGE_CODES = Object.freeze(Object.keys(CONTROLLED_VOCABULARIES.KNOWLEDGE_STANDARD));
const QUALIFIER_CODES = Object.freeze([...ACCURACY_CODES, ...KNOWLEDGE_CODES]);

/**
 * A typed, fail-closed error. Every field the caller needs to decide what
 * happened is on the instance -- never just a message string to parse.
 */
class NativeProducerAnthropicError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'NativeProducerAnthropicError';
    this.code = code;
    this.details = details;
  }
}

function requirePlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new NativeProducerAnthropicError('INVALID_INPUT', `${label} must be a plain object`);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Response-shape validation.
// ---------------------------------------------------------------------------

function validateResponseShape(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new NativeProducerAnthropicError(
      'MALFORMED_RESPONSE',
      'model response did not parse to a JSON object',
    );
  }
  for (const key of REQUIRED_RESPONSE_LISTS) {
    if (!Array.isArray(parsed[key])) {
      throw new NativeProducerAnthropicError(
        'SCHEMA_MISSING_KEY',
        `model response is missing required top-level array "${key}"`,
        { missing_key: key },
      );
    }
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// Byte-exact quote location. A quote that does not reproduce exactly from
// the source the model was given is never trusted with an invented offset.
// ---------------------------------------------------------------------------

function locateQuoteBytes(sourceBytes, quote) {
  if (typeof quote !== 'string' || quote.length === 0) return null;
  const needle = Buffer.from(quote, 'utf8');
  const start = sourceBytes.indexOf(needle);
  if (start < 0) return null;
  return { start, end: start + needle.length };
}

function evidenceFromQuote(sourceBytes, quote, role = 'OPERATIVE_TEXT') {
  const span = locateQuoteBytes(sourceBytes, quote);
  if (!span) return null;
  const excerptId = contentId(EXCERPT_DOMAIN, { quote, start: span.start, end: span.end });
  return {
    evidence_role: role,
    excerpt_id: excerptId,
    document_ordinal: 0,
    absolute_start: span.start,
    absolute_end: span.end,
    ordinal: 0,
  };
}

// A purely mechanical grammatical observation -- never taken from the
// model -- used as one of a TRAILING/ITEM/CHAPEAU qualifier's
// ambiguity_signals: does a comma (rather than a period, semicolon, or
// nothing) immediately precede the qualifier's own quoted text, skipping
// intervening whitespace. Comma vs. full-stop before a trailing qualifier is
// itself a live signal in the last-antecedent case law, so this is recorded
// even though it does not, on its own, decide scope_reading.
function commaPrecedesQuote(sourceBytes, quoteStart) {
  let i = quoteStart - 1;
  while (i >= 0) {
    const byte = sourceBytes[i];
    if (byte === 0x20 || byte === 0x09 || byte === 0x0a || byte === 0x0d) {
      i -= 1;
      continue;
    }
    return byte === 0x2c; // ','
  }
  return false;
}

// ---------------------------------------------------------------------------
// Mechanical proposal shaping. Fixed generic buckets per RESPONSE_SHAPE slot
// -- see file header. No content-dependent branching, no invented facts.
// ---------------------------------------------------------------------------

function makeOrdinalCounter() {
  const counts = new Map();
  return (key) => {
    const next = (counts.get(key) || 0);
    counts.set(key, next + 1);
    return next;
  };
}

function mintSubjectId(fields) {
  return contentId(SUBJECT_DOMAIN, fields);
}

function isNonEmptyLimbPath(value) {
  return Array.isArray(value) && value.length > 0 && value.every((label) => typeof label === 'string' && label.length > 0);
}

function shapeRepresentationInstance(instance, sourceBytes, ordinalFor, dropCounter) {
  const proposals = [];
  if (!instance || typeof instance !== 'object') return proposals;
  const sectionReference = instance.section_reference ?? null;
  const partyMaking = instance.party_making ?? null;
  const subjectId = mintSubjectId({
    kind: 'REPRESENTATION_INSTANCE',
    section_reference: sectionReference,
    party_making: partyMaking,
    chapeau_quote: instance.chapeau_quote ?? null,
  });

  // Every limb's own path, in document order, captured up front so a
  // TRAILING qualifier's AMBIGUOUS decision-support `readings` (see
  // qualifier-attachment.js) can name every sibling limb without a second
  // pass over the response.
  const siblingLimbPaths = [];
  for (const limb of (Array.isArray(instance.limbs) ? instance.limbs : [])) {
    if (limb && isNonEmptyLimbPath(limb.limb_path)) siblingLimbPaths.push(limb.limb_path);
  }

  for (const limb of (Array.isArray(instance.limbs) ? instance.limbs : [])) {
    if (!limb || typeof limb !== 'object') continue;
    const limbPath = isNonEmptyLimbPath(limb.limb_path) ? limb.limb_path : null;

    const assertionEvidence = evidenceFromQuote(sourceBytes, limb.assertion_quote);
    if (assertionEvidence) {
      proposals.push({
        kind: 'claim',
        proposal_kind: 'GOVERNED',
        subject_occurrence_id: subjectId,
        claim_definition_key: LIMB_ASSERTION_CLAIM_KEY,
        claim_definition_version: 1,
        ordinal: ordinalFor(`${subjectId}:${LIMB_ASSERTION_CLAIM_KEY}`),
        state: 'PRESENT',
        raw_value: limb.assertion_quote,
        canonical_value: null,
        attributes: {
          section_reference: sectionReference,
          party_making: partyMaking,
          limb_path: limbPath,
          subject: limb.subject ?? null,
        },
        allowed_attributes: ['section_reference', 'party_making', 'limb_path', 'subject'],
        taxonomy_codes: {},
        codebooks: {},
        evidence: [assertionEvidence],
        extraction_version: RESPONSE_VERSION,
        normalisation_version: RESPONSE_VERSION,
        derivation_version: RESPONSE_VERSION,
      });
    } else if (limb.assertion_quote) {
      dropCounter.record('LIMB_ASSERTION_QUOTE_UNVERIFIED', limb.assertion_quote);
    }
  }

  // Qualifiers are a flat, representation-level list (not nested inside a
  // limb) precisely because attachment.governs_path already says everything
  // there is to say about which limb (if any) a qualifier modifies -- see
  // the file header and qualifier-attachment.js.
  for (const qualifier of (Array.isArray(instance.qualifiers) ? instance.qualifiers : [])) {
    if (!qualifier || typeof qualifier !== 'object') continue;
    const qualifierEvidence = evidenceFromQuote(sourceBytes, qualifier.quote);
    if (!qualifierEvidence) {
      if (qualifier.quote) dropCounter.record('QUALIFIER_QUOTE_UNVERIFIED', qualifier.quote);
      continue;
    }

    const rawAttachment = qualifier.attachment;
    const position = rawAttachment && typeof rawAttachment === 'object' ? rawAttachment.position : null;
    if (!['CHAPEAU', 'ITEM', 'TRAILING'].includes(position)) {
      // A response that does not conform to the current attachment contract
      // (e.g. a stale recording from before PROMPT_VERSION 2, whose
      // `attachment` was a bare string) is never guessed at: the qualifier
      // is dropped as a typed residual, exactly like an unverifiable quote.
      dropCounter.record('QUALIFIER_ATTACHMENT_MALFORMED', qualifier.quote);
      continue;
    }

    const resolvedAttachment = resolveQualifierAttachment({
      position,
      governs_path: rawAttachment.governs_path,
      quote_text: qualifier.quote,
      items_grammatically_parallel: rawAttachment.ambiguity_signals
        ? rawAttachment.ambiguity_signals.items_grammatically_parallel
        : null,
      comma_before_qualifier: commaPrecedesQuote(sourceBytes, qualifierEvidence.absolute_start),
      sibling_limb_paths: siblingLimbPaths,
    });

    const code = qualifier.code ?? null;
    proposals.push({
      kind: 'claim',
      proposal_kind: 'GOVERNED',
      subject_occurrence_id: subjectId,
      claim_definition_key: QUALIFIER_CLAIM_KEY,
      claim_definition_version: 1,
      ordinal: ordinalFor(`${subjectId}:${QUALIFIER_CLAIM_KEY}`),
      state: 'PRESENT',
      raw_value: qualifier.quote,
      canonical_value: code,
      attributes: {
        section_reference: sectionReference,
        party_making: partyMaking,
        qualifier_kind: qualifier.kind ?? null,
        attachment: resolvedAttachment,
      },
      allowed_attributes: [
        'section_reference', 'party_making', 'qualifier_kind', 'attachment',
      ],
      taxonomy_codes: code ? { qualifier_code: code } : {},
      codebooks: { qualifier_code: QUALIFIER_CODES },
      evidence: [qualifierEvidence],
      extraction_version: RESPONSE_VERSION,
      normalisation_version: RESPONSE_VERSION,
      derivation_version: RESPONSE_VERSION,
    });
  }
  return proposals;
}

function shapeBringDownCondition(condition, sourceBytes, ordinalFor, dropCounter) {
  const proposals = [];
  if (!condition || typeof condition !== 'object') return proposals;
  const sectionReference = condition.section_reference ?? null;
  const subjectId = mintSubjectId({
    kind: 'BRING_DOWN_CONDITION',
    section_reference: sectionReference,
    condition_obligor: condition.condition_obligor ?? null,
    beneficiary: condition.beneficiary ?? null,
    measurement_date_quote: condition.measurement_date_quote ?? null,
  });

  for (const tier of (Array.isArray(condition.tiers) ? condition.tiers : [])) {
    if (!tier || typeof tier !== 'object') continue;
    const tierEvidence = evidenceFromQuote(sourceBytes, tier.covered_scope_quote);
    if (!tierEvidence) {
      if (tier.covered_scope_quote) dropCounter.record('BRING_DOWN_TIER_QUOTE_UNVERIFIED', tier.covered_scope_quote);
      continue;
    }
    const accuracyStandard = tier.accuracy_standard ?? null;
    proposals.push({
      kind: 'claim',
      proposal_kind: 'GOVERNED',
      subject_occurrence_id: subjectId,
      claim_definition_key: BRING_DOWN_TIER_CLAIM_KEY,
      claim_definition_version: 1,
      ordinal: ordinalFor(`${subjectId}:${BRING_DOWN_TIER_CLAIM_KEY}`),
      state: 'PRESENT',
      raw_value: tier.covered_scope_quote,
      canonical_value: accuracyStandard,
      attributes: {
        section_reference: sectionReference,
        condition_obligor: condition.condition_obligor ?? null,
        beneficiary: condition.beneficiary ?? null,
        measurement_date_quote: condition.measurement_date_quote ?? null,
        covered_limb_references: Array.isArray(tier.covered_limb_references) ? tier.covered_limb_references : [],
      },
      allowed_attributes: [
        'section_reference', 'condition_obligor', 'beneficiary',
        'measurement_date_quote', 'covered_limb_references',
      ],
      taxonomy_codes: accuracyStandard ? { accuracy_standard: accuracyStandard } : {},
      codebooks: { accuracy_standard: ACCURACY_CODES },
      evidence: [tierEvidence],
      extraction_version: RESPONSE_VERSION,
      normalisation_version: RESPONSE_VERSION,
      derivation_version: RESPONSE_VERSION,
    });
  }
  return proposals;
}

function shapeOpenWorldCandidate(candidate, sourceBytes, ordinalFor, dropCounter) {
  if (!candidate || typeof candidate !== 'object') return null;
  const evidence = evidenceFromQuote(sourceBytes, candidate.observed_quote);
  if (!evidence) {
    if (candidate.observed_quote) dropCounter.record('OPEN_WORLD_QUOTE_UNVERIFIED', candidate.observed_quote);
    return null;
  }
  const subjectId = mintSubjectId({
    kind: 'OPEN_WORLD_CANDIDATE',
    observed_quote: candidate.observed_quote ?? null,
    why_unmapped: candidate.why_unmapped ?? null,
  });
  return {
    kind: 'claim',
    proposal_kind: 'OPEN_WORLD',
    subject_occurrence_id: subjectId,
    claim_definition_key: OPEN_WORLD_CLAIM_KEY,
    claim_definition_version: 1,
    ordinal: ordinalFor(`${subjectId}:${OPEN_WORLD_CLAIM_KEY}`),
    state: 'PRESENT',
    raw_value: candidate.observed_quote,
    canonical_value: null,
    attributes: {
      why_unmapped: candidate.why_unmapped ?? null,
      nearest_concept: candidate.nearest_concept ?? null,
    },
    allowed_attributes: ['why_unmapped', 'nearest_concept'],
    taxonomy_codes: {},
    codebooks: {},
    evidence: [evidence],
    extraction_version: RESPONSE_VERSION,
    normalisation_version: RESPONSE_VERSION,
    derivation_version: RESPONSE_VERSION,
  };
}

function shapeProposals(parsed, sourceText) {
  const sourceBytes = Buffer.from(sourceText, 'utf8');
  const ordinalFor = makeOrdinalCounter();
  const dropped = [];
  const dropCounter = {
    record(reason, quote) {
      dropped.push({ reason, quote_preview: String(quote).slice(0, 120) });
    },
  };

  const proposals = [];
  for (const instance of parsed.representation_instances) {
    proposals.push(...shapeRepresentationInstance(instance, sourceBytes, ordinalFor, dropCounter));
  }
  for (const condition of parsed.bring_down_conditions) {
    proposals.push(...shapeBringDownCondition(condition, sourceBytes, ordinalFor, dropCounter));
  }
  for (const candidate of parsed.open_world_candidates) {
    const proposal = shapeOpenWorldCandidate(candidate, sourceBytes, ordinalFor, dropCounter);
    if (proposal) proposals.push(proposal);
  }

  // Unverifiable evidence leaves as a typed residual, not a silent omission.
  // The model asserted something we could not evidence; that fact is carried
  // forward and bound into the receipt rather than discarded.
  return { proposals, evidence_residuals: dropped };
}

// ---------------------------------------------------------------------------
// Model call with bounded retry. Every failure mode -- transient call
// failure, malformed JSON, missing schema key, oversized response -- is
// caught here and either retried or converted to a typed failure. Nothing
// silently becomes an empty success.
// ---------------------------------------------------------------------------

async function callModelOnce({ client, model, prompt, maxTokens, maxResponseChars }) {
  let resp;
  try {
    resp = await client.messages.create({
      model,
      max_tokens: maxTokens,
      messages: prompt.messages,
    });
  } catch (err) {
    throw new NativeProducerAnthropicError(
      'TRANSIENT_CALL_FAILED',
      `model call failed: ${err && err.message ? err.message : String(err)}`,
      { cause: err && err.message },
    );
  }

  const raw = (resp && Array.isArray(resp.content))
    ? resp.content.map((c) => c.text || '').join('')
    : '';

  if (raw.length > maxResponseChars) {
    throw new NativeProducerAnthropicError(
      'RESPONSE_TOO_LARGE',
      `model response (${raw.length} chars) exceeds the bounded maximum (${maxResponseChars} chars)`,
      { response_length: raw.length, max_response_chars: maxResponseChars },
    );
  }

  const parsed = parseJSON(raw);
  if (parsed === null) {
    throw new NativeProducerAnthropicError(
      'MALFORMED_RESPONSE',
      'model response could not be parsed as JSON',
      { raw_length: raw.length },
    );
  }

  validateResponseShape(parsed);
  return { parsed, raw };
}

/**
 * @param {object} args
 * @param {string} [args.model]        model id; defaults to lib/model.js MODEL
 * @param {number} [args.maxRetries]   retries AFTER the first attempt (default 2)
 * @param {string} [args.apiKey]       Anthropic API key; falls back to ANTHROPIC_API_KEY
 * @param {object} [args.client]       injected Anthropic-shaped client (tests only --
 *                                     production callers omit this and a real client
 *                                     is constructed from apiKey)
 * @param {number} [args.maxTokens]    max_tokens for the model call (default 8000)
 * @param {number} [args.maxResponseChars] bounded response size (default 200000)
 * @returns {(input: {governed_scope: object, definitions: object, contract_bundle: object}) =>
 *   Promise<object>} a function matching provider-interface.js's injected-provider signature
 */
function createAnthropicProvider({
  model = DEFAULT_MODEL,
  maxRetries = DEFAULT_MAX_RETRIES,
  apiKey,
  client,
  maxTokens = DEFAULT_MAX_TOKENS,
  maxResponseChars = DEFAULT_MAX_RESPONSE_CHARS,
} = {}) {
  if (!Number.isInteger(maxRetries) || maxRetries < 0) {
    throw new NativeProducerAnthropicError('INVALID_CONFIG', 'maxRetries must be a non-negative integer');
  }

  let resolvedClient = client || null;

  function resolveClient() {
    if (resolvedClient) return resolvedClient;
    const key = apiKey || process.env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new NativeProducerAnthropicError(
        'MISSING_API_KEY',
        'no Anthropic API key: pass apiKey, set ANTHROPIC_API_KEY, or inject a client for tests',
      );
    }
    // eslint-disable-next-line global-require
    const Anthropic = require('@anthropic-ai/sdk');
    resolvedClient = new Anthropic({ apiKey: key });
    return resolvedClient;
  }

  return async function anthropicProvider({ governed_scope: governedScope, definitions } = {}) {
    requirePlainObject(governedScope, 'governed_scope');
    const definitionsObj = definitions && typeof definitions === 'object' ? definitions : {};

    const sourceText = governedScope.source_text;
    if (typeof sourceText !== 'string' || sourceText.length === 0) {
      throw new NativeProducerAnthropicError(
        'MISSING_SOURCE_TEXT',
        'governed_scope.source_text must be a non-empty string: this seam has no separate '
          + 'source-text field, so the CLI/caller must carry the admitted text on governed_scope',
      );
    }
    const knownDefinitions = Array.isArray(definitionsObj.known_definitions)
      ? definitionsObj.known_definitions
      : [];

    const prompt = buildCapitalisationProducerPrompt({
      source_text: sourceText,
      governed_scope: governedScope,
      known_definitions: knownDefinitions,
    });

    const activeClient = resolveClient();
    const totalAttempts = maxRetries + 1;
    let lastError = null;
    let result = null;
    let attemptsUsed = 0;

    for (let attempt = 0; attempt < totalAttempts; attempt += 1) {
      attemptsUsed = attempt + 1;
      try {
        // eslint-disable-next-line no-await-in-loop
        result = await callModelOnce({
          client: activeClient,
          model,
          prompt,
          maxTokens,
          maxResponseChars,
        });
        lastError = null;
        break;
      } catch (err) {
        lastError = err;
        // An oversized response is a bounded, structural failure -- retrying
        // the same prompt against the same document will not shrink it.
        if (err instanceof NativeProducerAnthropicError && err.code === 'RESPONSE_TOO_LARGE') {
          break;
        }
      }
    }

    if (lastError) {
      throw new NativeProducerAnthropicError(
        lastError.code === 'RESPONSE_TOO_LARGE' ? 'RESPONSE_TOO_LARGE' : 'RETRIES_EXHAUSTED',
        `native producer model call failed after ${attemptsUsed} attempt(s): ${lastError.message}`,
        { attempts: attemptsUsed, last_code: lastError.code, last_details: lastError.details },
      );
    }

    const { proposals, evidence_residuals: evidenceResiduals } =
      shapeProposals(result.parsed, sourceText);

    return {
      provider_id: PROVIDER_ID,
      model_id: model,
      prompt: prompt.messages,
      prompt_id: prompt.prompt_id,
      prompt_version: prompt.prompt_version,
      proposals,
      evidence_residuals: evidenceResiduals,
      raw_response_length: result.raw.length,
      attempts: attemptsUsed,
    };
  };
}

module.exports = {
  PROVIDER_ID,
  RESPONSE_VERSION,
  NativeProducerAnthropicError,
  QUALIFIER_CLAIM_KEY,
  LIMB_ASSERTION_CLAIM_KEY,
  BRING_DOWN_TIER_CLAIM_KEY,
  OPEN_WORLD_CLAIM_KEY,
  createAnthropicProvider,
  // Exported for the CLI and for tests that want to exercise shaping/parsing
  // directly without a network-shaped client.
  validateResponseShape,
  shapeProposals,
  locateQuoteBytes,
  PROMPT_ID_REEXPORT: PROMPT_ID,
  PROMPT_VERSION_REEXPORT: PROMPT_VERSION,
};
