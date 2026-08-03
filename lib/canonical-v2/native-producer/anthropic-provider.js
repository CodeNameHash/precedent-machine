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
// No-shop family (spec section 3): the registry's own controlled
// vocabularies, single-sourced -- imported directly (both are already
// exported from contract-bundle.js), never hand-copied as a frozen literal,
// so this shaping layer's codebooks can never drift from the resolver's own
// enum gate.
const {
  NO_SHOP_ACTION_CODES_V2: NO_SHOP_ACTION_CODES,
  NO_SHOP_EXCEPTION_PREREQUISITE_CODES_V2: NO_SHOP_EXCEPTION_PREREQUISITE_CODES,
} = require('../contract-bundle');

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

// share_count_assertions is new under PROMPT_VERSION 5 and, deliberately,
// NOT added to REQUIRED_RESPONSE_LISTS: every recorded pre-PROMPT_VERSION-5
// response fixture this repo replays (F28/Skechers/Modiv) predates this
// array, and strict-additivity means those byte-identical replay tests must
// keep working unmodified. A response missing this key (or carrying a
// non-array) is treated as an empty list, never a schema failure.
const SHARE_COUNT_ASSERTIONS_KEY = 'share_count_assertions';

const QUALIFIER_CLAIM_KEY = 'NATIVE_CAPITALISATION_QUALIFIER_CANDIDATE';
const LIMB_ASSERTION_CLAIM_KEY = 'NATIVE_CAPITALISATION_LIMB_ASSERTION_CANDIDATE';
const BRING_DOWN_TIER_CLAIM_KEY = 'NATIVE_BRING_DOWN_TIER_CANDIDATE';
const OPEN_WORLD_CLAIM_KEY = 'OPEN_WORLD_PROPOSITION';
// P1 cap-table numeric promotions (docs/superpowers/specs/2026-08-02-p1-
// captable-numerics-design.md section 3): a distinct generic key and
// proposal_kind from OPEN_WORLD, so the resolver's own routing (which keys
// on proposal_kind === 'OPEN_WORLD' vs everything else) never has to guess
// which array a candidate came from.
const SHARE_COUNT_CLAIM_KEY = 'NATIVE_CAPITALISATION_SHARE_COUNT_CANDIDATE';
const SHARE_COUNT_PROPOSAL_KIND = 'SHARE_COUNT';
const SHARE_COUNT_KINDS = Object.freeze([
  'AUTHORIZED', 'ISSUED_OUTSTANDING', 'RESERVED', 'TREASURY', 'OUTSTANDING_AWARDS',
]);

// Termination-fee family (docs/superpowers/specs/2026-08-02-family-
// termination-fee-design.md section 3): three new generic keys, each with
// its own non-OPEN_WORLD proposal_kind -- the same "distinct generic key
// and proposal_kind from OPEN_WORLD" discipline the SHARE_COUNT promotion
// established, so the resolver's own proposal_kind === 'OPEN_WORLD' routing
// never has to guess which array a candidate came from. These are shaped
// from the SEPARATE termination-fee-producer-prompt.js response (its own
// response schema, never merged into REQUIRED_RESPONSE_LISTS or the
// capitalisation module's own arrays -- spec section 3's "deliberately NOT
// the share_count precedent" pin).
const FEE_AMOUNT_CLAIM_KEY = 'NATIVE_TERMINATION_FEE_AMOUNT_CANDIDATE';
const FEE_AMOUNT_PROPOSAL_KIND = 'FEE_AMOUNT';
const FEE_TRIGGER_CLAIM_KEY = 'NATIVE_TERMINATION_FEE_TRIGGER_CANDIDATE';
const FEE_TRIGGER_PROPOSAL_KIND = 'FEE_TRIGGER';
const FEE_TAIL_PERIOD_CLAIM_KEY = 'NATIVE_TERMINATION_FEE_TAIL_PERIOD_CANDIDATE';
const FEE_TAIL_PERIOD_PROPOSAL_KIND = 'FEE_TAIL_PERIOD';
// The trigger enum this shaping layer tags onto taxonomy_codes/codebooks --
// duplicated here as a literal (never imported from contract-bundle.js,
// matching this file's own SHARE_COUNT_KINDS precedent of a hand-carried
// list): the governed TERMINATION_FEE_TRIGGER claim definition's own
// allowed_canonical_values (contract-bundle.js V15) is the single source of
// truth this list must stay a content-superset of; a table-driven test pins
// that relationship.
const FEE_TRIGGER_CODES = Object.freeze([
  'CHANGE_IN_RECOMMENDATION_TERMINATION',
  'NO_SOLICIT_BREACH_TERMINATION',
  'STOCKHOLDER_APPROVAL_FAILURE_TERMINATION',
  'OUTSIDE_DATE_TERMINATION',
  'COUNTERPARTY_COVENANT_BREACH_TERMINATION',
  'INTERVENING_EVENT_RECOMMENDATION_CHANGE_TERMINATION',
  'SUPERIOR_PROPOSAL_TERMINATION',
]);
const FEE_SIDES = Object.freeze(['SELLER', 'BUYER']);

// No-shop family (docs/superpowers/specs/2026-08-02-family-no-shop-design.md
// section 3): FIVE new generic claim keys, ONE shared proposal_kind
// `NO_SHOP` (deliberately singular, unlike the fee family's three --
// spec section 3 pins exactly this shape: "one proposal_kind NO_SHOP (!=
// OPEN_WORLD)"), so the resolver's own proposal_kind === 'OPEN_WORLD'
// routing never has to guess which array a candidate came from. Shaped
// from the SEPARATE no-shop-producer-prompt.js response (its own response
// schema, never merged into REQUIRED_RESPONSE_LISTS or the capitalisation/
// termination-fee modules' own arrays).
const NO_SHOP_ACTION_CLAIM_KEY = 'NATIVE_NO_SHOP_ACTION_CANDIDATE';
const NO_SHOP_EXCEPTION_PREREQUISITE_CLAIM_KEY = 'NATIVE_NO_SHOP_EXCEPTION_PREREQUISITE_CANDIDATE';
const NO_SHOP_NOTICE_PERIOD_CLAIM_KEY = 'NATIVE_NO_SHOP_NOTICE_PERIOD_CANDIDATE';
const NO_SHOP_MATCH_PERIOD_CLAIM_KEY = 'NATIVE_NO_SHOP_MATCH_PERIOD_CANDIDATE';
const NO_SHOP_REMATCH_PERIOD_CLAIM_KEY = 'NATIVE_NO_SHOP_REMATCH_PERIOD_CANDIDATE';
const NO_SHOP_PROPOSAL_KIND = 'NO_SHOP';

// period_role -> generic claim key, mechanical (spec section 3): "The
// provider maps period_role -> key mechanically and rejects an unknown role
// as a typed provider error (fail-closed, the existing
// NativeProducerAnthropicError shape)." Three roles resolve to three
// DIFFERENT concepts downstream (NOSOL-NOTICE / NOSOL-MATCH / NOSOL-REMATCH)
// -- distinct concepts get distinct keys so RESOLUTION_UNCONDITIONAL (a Map
// keyed on generic_claim_key alone) never needs a concept minted inside a
// handler (P1 audit M-2 precedent).
const NO_SHOP_PERIOD_ROLE_TO_CLAIM_KEY = Object.freeze({
  NOTICE: NO_SHOP_NOTICE_PERIOD_CLAIM_KEY,
  INITIAL_MATCH: NO_SHOP_MATCH_PERIOD_CLAIM_KEY,
  SUBSEQUENT_MATCH: NO_SHOP_REMATCH_PERIOD_CLAIM_KEY,
});
const NO_SHOP_PERIOD_ROLES = Object.freeze(Object.keys(NO_SHOP_PERIOD_ROLE_TO_CLAIM_KEY));

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

// P1 cap-table numeric promotions (spec section 3): mechanical, structural
// shaping only -- exactly like shapeOpenWorldCandidate, no content-dependent
// branching. count_kind enum membership, corroboration, attribute
// verbatim-ness, and the actual number parse are ALL resolver-stage
// concerns (candidate-resolution.js); this function's only job is to turn
// one response-array entry into one typed, evidenced proposal, or drop it
// as a residual when its quote cannot be byte-verified.
function shapeShareCountAssertion(assertion, sourceBytes, ordinalFor, dropCounter) {
  if (!assertion || typeof assertion !== 'object') return null;
  const evidence = evidenceFromQuote(sourceBytes, assertion.quote);
  if (!evidence) {
    if (assertion.quote) dropCounter.record('SHARE_COUNT_QUOTE_UNVERIFIED', assertion.quote);
    return null;
  }
  const sectionReference = assertion.section_reference ?? null;
  const partyMaking = assertion.party_making ?? null;
  const countKind = assertion.count_kind ?? null;
  const limbPath = isNonEmptyLimbPath(assertion.limb_path) ? assertion.limb_path : null;
  const subjectId = mintSubjectId({
    kind: 'SHARE_COUNT_ASSERTION',
    section_reference: sectionReference,
    party_making: partyMaking,
    count_kind: countKind,
    share_class: assertion.share_class ?? null,
    plan: assertion.plan ?? null,
    quote: assertion.quote ?? null,
  });
  return {
    kind: 'claim',
    proposal_kind: SHARE_COUNT_PROPOSAL_KIND,
    subject_occurrence_id: subjectId,
    claim_definition_key: SHARE_COUNT_CLAIM_KEY,
    claim_definition_version: 1,
    ordinal: ordinalFor(`${subjectId}:${SHARE_COUNT_CLAIM_KEY}`),
    state: 'PRESENT',
    raw_value: assertion.quote,
    canonical_value: null,
    attributes: {
      section_reference: sectionReference,
      party_making: partyMaking,
      count_kind: countKind,
      share_class_ref: assertion.share_class ?? null,
      plan_ref: assertion.plan ?? null,
      limb_path: limbPath,
    },
    allowed_attributes: [
      'section_reference', 'party_making', 'count_kind', 'share_class_ref', 'plan_ref', 'limb_path',
    ],
    taxonomy_codes: countKind && SHARE_COUNT_KINDS.includes(countKind) ? { count_kind: countKind } : {},
    codebooks: { count_kind: SHARE_COUNT_KINDS },
    evidence: [evidence],
    extraction_version: RESPONSE_VERSION,
    normalisation_version: RESPONSE_VERSION,
    derivation_version: RESPONSE_VERSION,
  };
}

// Termination-fee family shaping functions (spec section 3): mechanical,
// structural shaping only -- exactly like shapeShareCountAssertion above,
// no content-dependent branching. fee_side/trigger_code enum membership,
// corroboration, attribute verbatim-ness (fee_term_ref/payer_party), and
// the actual amount/period parse are ALL resolver-stage concerns
// (candidate-resolution.js); each function's only job is to turn one
// termination-fee-producer-prompt.js response-array entry into one typed,
// evidenced proposal, or drop it as a residual when its quote cannot be
// byte-verified.

function shapeFeeAmountAssertion(assertion, sourceBytes, ordinalFor, dropCounter) {
  if (!assertion || typeof assertion !== 'object') return null;
  const evidence = evidenceFromQuote(sourceBytes, assertion.quote);
  if (!evidence) {
    if (assertion.quote) dropCounter.record('FEE_AMOUNT_QUOTE_UNVERIFIED', assertion.quote);
    return null;
  }
  const sectionReference = assertion.section_reference ?? null;
  const feeSide = assertion.fee_side ?? null;
  const payerParty = assertion.payer_party ?? null;
  const feeTermRef = assertion.fee_term_ref ?? null;
  const subjectId = mintSubjectId({
    kind: 'FEE_AMOUNT_ASSERTION',
    section_reference: sectionReference,
    fee_side: feeSide,
    payer_party: payerParty,
    fee_term_ref: feeTermRef,
    quote: assertion.quote ?? null,
  });
  return {
    kind: 'claim',
    proposal_kind: FEE_AMOUNT_PROPOSAL_KIND,
    subject_occurrence_id: subjectId,
    claim_definition_key: FEE_AMOUNT_CLAIM_KEY,
    claim_definition_version: 1,
    ordinal: ordinalFor(`${subjectId}:${FEE_AMOUNT_CLAIM_KEY}`),
    state: 'PRESENT',
    raw_value: assertion.quote,
    canonical_value: null,
    attributes: {
      section_reference: sectionReference,
      fee_side: feeSide,
      payer_party: payerParty,
      fee_term_ref: feeTermRef,
    },
    allowed_attributes: ['section_reference', 'fee_side', 'payer_party', 'fee_term_ref'],
    taxonomy_codes: feeSide && FEE_SIDES.includes(feeSide) ? { fee_side: feeSide } : {},
    codebooks: { fee_side: FEE_SIDES },
    evidence: [evidence],
    extraction_version: RESPONSE_VERSION,
    normalisation_version: RESPONSE_VERSION,
    derivation_version: RESPONSE_VERSION,
  };
}

function shapeFeeTriggerAssertion(assertion, sourceBytes, ordinalFor, dropCounter) {
  if (!assertion || typeof assertion !== 'object') return null;
  const evidence = evidenceFromQuote(sourceBytes, assertion.quote);
  if (!evidence) {
    if (assertion.quote) dropCounter.record('FEE_TRIGGER_QUOTE_UNVERIFIED', assertion.quote);
    return null;
  }
  const sectionReference = assertion.section_reference ?? null;
  const feeSide = assertion.fee_side ?? null;
  const triggerCode = assertion.trigger_code ?? null;
  const subjectId = mintSubjectId({
    kind: 'FEE_TRIGGER_ASSERTION',
    section_reference: sectionReference,
    fee_side: feeSide,
    trigger_code: triggerCode,
    quote: assertion.quote ?? null,
  });
  return {
    kind: 'claim',
    proposal_kind: FEE_TRIGGER_PROPOSAL_KIND,
    subject_occurrence_id: subjectId,
    claim_definition_key: FEE_TRIGGER_CLAIM_KEY,
    claim_definition_version: 1,
    ordinal: ordinalFor(`${subjectId}:${FEE_TRIGGER_CLAIM_KEY}`),
    state: 'PRESENT',
    raw_value: assertion.quote,
    canonical_value: null,
    attributes: {
      section_reference: sectionReference,
      fee_side: feeSide,
      trigger_code: triggerCode,
    },
    allowed_attributes: ['section_reference', 'fee_side', 'trigger_code'],
    taxonomy_codes: triggerCode && FEE_TRIGGER_CODES.includes(triggerCode) ? { trigger_code: triggerCode } : {},
    codebooks: { trigger_code: FEE_TRIGGER_CODES, fee_side: FEE_SIDES },
    evidence: [evidence],
    extraction_version: RESPONSE_VERSION,
    normalisation_version: RESPONSE_VERSION,
    derivation_version: RESPONSE_VERSION,
  };
}

function shapeTailPeriodAssertion(assertion, sourceBytes, ordinalFor, dropCounter) {
  if (!assertion || typeof assertion !== 'object') return null;
  const evidence = evidenceFromQuote(sourceBytes, assertion.quote);
  if (!evidence) {
    if (assertion.quote) dropCounter.record('FEE_TAIL_PERIOD_QUOTE_UNVERIFIED', assertion.quote);
    return null;
  }
  const sectionReference = assertion.section_reference ?? null;
  const subjectId = mintSubjectId({
    kind: 'FEE_TAIL_PERIOD_ASSERTION',
    section_reference: sectionReference,
    quote: assertion.quote ?? null,
  });
  return {
    kind: 'claim',
    proposal_kind: FEE_TAIL_PERIOD_PROPOSAL_KIND,
    subject_occurrence_id: subjectId,
    claim_definition_key: FEE_TAIL_PERIOD_CLAIM_KEY,
    claim_definition_version: 1,
    ordinal: ordinalFor(`${subjectId}:${FEE_TAIL_PERIOD_CLAIM_KEY}`),
    state: 'PRESENT',
    raw_value: assertion.quote,
    canonical_value: null,
    attributes: {
      section_reference: sectionReference,
    },
    allowed_attributes: ['section_reference'],
    taxonomy_codes: {},
    codebooks: {},
    evidence: [evidence],
    extraction_version: RESPONSE_VERSION,
    normalisation_version: RESPONSE_VERSION,
    derivation_version: RESPONSE_VERSION,
  };
}

/**
 * Shapes a full termination-fee-producer-prompt.js response into proposals.
 * Mirrors shapeProposals's own contract (parsed response + source text ->
 * {proposals, evidence_residuals}) but over this family's OWN response
 * schema (fee_amount_assertions / fee_trigger_assertions /
 * tail_period_assertions / open_world_candidates) -- never merged into
 * shapeProposals itself, matching the "SEPARATE prompt executions,
 * SEPARATE response schema" wiring pin (spec section 3, audit m-3).
 */
function shapeTerminationFeeProposals(parsed, sourceText) {
  const sourceBytes = Buffer.from(sourceText, 'utf8');
  const ordinalFor = makeOrdinalCounter();
  const dropped = [];
  const dropCounter = {
    record(reason, quote) {
      dropped.push({ reason, quote_preview: String(quote).slice(0, 120) });
    },
  };

  const proposals = [];
  const feeAmountAssertions = Array.isArray(parsed.fee_amount_assertions) ? parsed.fee_amount_assertions : [];
  for (const assertion of feeAmountAssertions) {
    const proposal = shapeFeeAmountAssertion(assertion, sourceBytes, ordinalFor, dropCounter);
    if (proposal) proposals.push(proposal);
  }
  const feeTriggerAssertions = Array.isArray(parsed.fee_trigger_assertions) ? parsed.fee_trigger_assertions : [];
  for (const assertion of feeTriggerAssertions) {
    const proposal = shapeFeeTriggerAssertion(assertion, sourceBytes, ordinalFor, dropCounter);
    if (proposal) proposals.push(proposal);
  }
  const tailPeriodAssertions = Array.isArray(parsed.tail_period_assertions) ? parsed.tail_period_assertions : [];
  for (const assertion of tailPeriodAssertions) {
    const proposal = shapeTailPeriodAssertion(assertion, sourceBytes, ordinalFor, dropCounter);
    if (proposal) proposals.push(proposal);
  }
  const openWorldCandidates = Array.isArray(parsed.open_world_candidates) ? parsed.open_world_candidates : [];
  for (const candidate of openWorldCandidates) {
    const proposal = shapeOpenWorldCandidate(candidate, sourceBytes, ordinalFor, dropCounter);
    if (proposal) proposals.push(proposal);
  }

  return { proposals, evidence_residuals: dropped };
}

// No-shop family shaping functions (spec section 3): mechanical, structural
// shaping only, exactly like the fee family's own shaping functions above --
// no content-dependent branching. action_code/prerequisite_code enum
// membership, corroboration, attribute verbatim-ness, and the actual period
// parse are ALL resolver-stage concerns (candidate-resolution.js); each
// function's only job is to turn one no-shop-producer-prompt.js response-
// array entry into one typed, evidenced proposal, or drop it as a residual
// when its quote cannot be byte-verified.

function shapeNoShopActionAssertion(assertion, sourceBytes, ordinalFor, dropCounter) {
  if (!assertion || typeof assertion !== 'object') return null;
  const evidence = evidenceFromQuote(sourceBytes, assertion.quote);
  if (!evidence) {
    if (assertion.quote) dropCounter.record('NO_SHOP_ACTION_QUOTE_UNVERIFIED', assertion.quote);
    return null;
  }
  const sectionReference = assertion.section_reference ?? null;
  const actionCode = assertion.action_code ?? null;
  const covenantObligor = assertion.covenant_obligor ?? null;
  const subjectId = mintSubjectId({
    kind: 'NO_SHOP_ACTION_ASSERTION',
    section_reference: sectionReference,
    action_code: actionCode,
    covenant_obligor: covenantObligor,
    quote: assertion.quote ?? null,
  });
  return {
    kind: 'claim',
    proposal_kind: NO_SHOP_PROPOSAL_KIND,
    subject_occurrence_id: subjectId,
    claim_definition_key: NO_SHOP_ACTION_CLAIM_KEY,
    claim_definition_version: 1,
    ordinal: ordinalFor(`${subjectId}:${NO_SHOP_ACTION_CLAIM_KEY}`),
    state: 'PRESENT',
    raw_value: assertion.quote,
    canonical_value: null,
    attributes: {
      section_reference: sectionReference,
      action_code: actionCode,
      covenant_obligor: covenantObligor,
    },
    allowed_attributes: ['section_reference', 'action_code', 'covenant_obligor'],
    taxonomy_codes: actionCode ? { action_code: actionCode } : {},
    codebooks: { action_code: NO_SHOP_ACTION_CODES },
    evidence: [evidence],
    extraction_version: RESPONSE_VERSION,
    normalisation_version: RESPONSE_VERSION,
    derivation_version: RESPONSE_VERSION,
  };
}

function shapeNoShopExceptionPrerequisiteAssertion(assertion, sourceBytes, ordinalFor, dropCounter) {
  if (!assertion || typeof assertion !== 'object') return null;
  const evidence = evidenceFromQuote(sourceBytes, assertion.quote);
  if (!evidence) {
    if (assertion.quote) dropCounter.record('NO_SHOP_PREREQUISITE_QUOTE_UNVERIFIED', assertion.quote);
    return null;
  }
  const sectionReference = assertion.section_reference ?? null;
  const prerequisiteCode = assertion.prerequisite_code ?? null;
  const permittedActionContext = assertion.permitted_action_context ?? null;
  const subjectId = mintSubjectId({
    kind: 'NO_SHOP_EXCEPTION_PREREQUISITE_ASSERTION',
    section_reference: sectionReference,
    prerequisite_code: prerequisiteCode,
    permitted_action_context: permittedActionContext,
    quote: assertion.quote ?? null,
  });
  return {
    kind: 'claim',
    proposal_kind: NO_SHOP_PROPOSAL_KIND,
    subject_occurrence_id: subjectId,
    claim_definition_key: NO_SHOP_EXCEPTION_PREREQUISITE_CLAIM_KEY,
    claim_definition_version: 1,
    ordinal: ordinalFor(`${subjectId}:${NO_SHOP_EXCEPTION_PREREQUISITE_CLAIM_KEY}`),
    state: 'PRESENT',
    raw_value: assertion.quote,
    canonical_value: null,
    attributes: {
      section_reference: sectionReference,
      prerequisite_code: prerequisiteCode,
      permitted_action_context: permittedActionContext,
      // covenant_obligor: exception prerequisites have no payer/obligor
      // phrase of their own in the response shape -- the resolver assigns
      // the FIVE resolution-table rows' shared party_field/party_role
      // (covenant_obligor / COVENANT_OBLIGOR, spec section 4 audit m-2)
      // from this same attribute name, left null here since the producer
      // prompt never asks for it on this array; the resolver's own
      // PARTY_UNRESOLVED routing handles the null case honestly.
      covenant_obligor: null,
    },
    allowed_attributes: ['section_reference', 'prerequisite_code', 'permitted_action_context', 'covenant_obligor'],
    taxonomy_codes: prerequisiteCode ? { prerequisite_code: prerequisiteCode } : {},
    codebooks: { prerequisite_code: NO_SHOP_EXCEPTION_PREREQUISITE_CODES },
    evidence: [evidence],
    extraction_version: RESPONSE_VERSION,
    normalisation_version: RESPONSE_VERSION,
    derivation_version: RESPONSE_VERSION,
  };
}

function shapeNoShopPeriodAssertion(assertion, sourceBytes, ordinalFor, dropCounter) {
  if (!assertion || typeof assertion !== 'object') return null;
  const evidence = evidenceFromQuote(sourceBytes, assertion.quote);
  if (!evidence) {
    if (assertion.quote) dropCounter.record('NO_SHOP_PERIOD_QUOTE_UNVERIFIED', assertion.quote);
    return null;
  }
  const sectionReference = assertion.section_reference ?? null;
  const periodRole = assertion.period_role ?? null;
  // Mechanical period_role -> generic key mapping (spec section 3): an
  // unknown role is a fail-closed, TYPED provider error -- never a guess,
  // never silently coerced to one of the three known roles.
  const claimKey = Object.hasOwn(NO_SHOP_PERIOD_ROLE_TO_CLAIM_KEY, periodRole)
    ? NO_SHOP_PERIOD_ROLE_TO_CLAIM_KEY[periodRole]
    : null;
  if (!claimKey) {
    throw new NativeProducerAnthropicError(
      'NO_SHOP_PERIOD_ROLE_UNKNOWN',
      `period_assertions entry carries an unrecognised period_role: ${JSON.stringify(periodRole)}`,
      { period_role: periodRole, quote_preview: String(assertion.quote).slice(0, 120) },
    );
  }
  const subjectId = mintSubjectId({
    kind: 'NO_SHOP_PERIOD_ASSERTION',
    section_reference: sectionReference,
    period_role: periodRole,
    quote: assertion.quote ?? null,
  });
  return {
    kind: 'claim',
    proposal_kind: NO_SHOP_PROPOSAL_KIND,
    subject_occurrence_id: subjectId,
    claim_definition_key: claimKey,
    claim_definition_version: 1,
    ordinal: ordinalFor(`${subjectId}:${claimKey}`),
    state: 'PRESENT',
    raw_value: assertion.quote,
    canonical_value: null,
    attributes: {
      section_reference: sectionReference,
      period_role: periodRole,
      // covenant_obligor: period claims carry no payer/obligor phrase of
      // their own either (same rationale as the prerequisite shaping
      // function above) -- the resolver's dedicated handler assigns the
      // fixed COVENANT_OBLIGOR party per spec section 4 (audit m-2: "the
      // period obligations' obligor IS the covenant obligor in every
      // corpus form"), never read from this null attribute.
      covenant_obligor: null,
    },
    allowed_attributes: ['section_reference', 'period_role', 'covenant_obligor'],
    taxonomy_codes: {},
    codebooks: { period_role: NO_SHOP_PERIOD_ROLES },
    evidence: [evidence],
    extraction_version: RESPONSE_VERSION,
    normalisation_version: RESPONSE_VERSION,
    derivation_version: RESPONSE_VERSION,
  };
}

/**
 * Shapes a full no-shop-producer-prompt.js response into proposals. Mirrors
 * shapeTerminationFeeProposals's own contract (parsed response + source
 * text -> {proposals, evidence_residuals}) but over this family's OWN
 * response schema (no_shop_action_assertions / exception_prerequisite_
 * assertions / period_assertions / open_world_candidates).
 */
function shapeNoShopProposals(parsed, sourceText) {
  const sourceBytes = Buffer.from(sourceText, 'utf8');
  const ordinalFor = makeOrdinalCounter();
  const dropped = [];
  const dropCounter = {
    record(reason, quote) {
      dropped.push({ reason, quote_preview: String(quote).slice(0, 120) });
    },
  };

  const proposals = [];
  const actionAssertions = Array.isArray(parsed.no_shop_action_assertions) ? parsed.no_shop_action_assertions : [];
  for (const assertion of actionAssertions) {
    const proposal = shapeNoShopActionAssertion(assertion, sourceBytes, ordinalFor, dropCounter);
    if (proposal) proposals.push(proposal);
  }
  const prerequisiteAssertions = Array.isArray(parsed.exception_prerequisite_assertions)
    ? parsed.exception_prerequisite_assertions
    : [];
  for (const assertion of prerequisiteAssertions) {
    const proposal = shapeNoShopExceptionPrerequisiteAssertion(assertion, sourceBytes, ordinalFor, dropCounter);
    if (proposal) proposals.push(proposal);
  }
  const periodAssertions = Array.isArray(parsed.period_assertions) ? parsed.period_assertions : [];
  for (const assertion of periodAssertions) {
    const proposal = shapeNoShopPeriodAssertion(assertion, sourceBytes, ordinalFor, dropCounter);
    if (proposal) proposals.push(proposal);
  }
  const openWorldCandidates = Array.isArray(parsed.open_world_candidates) ? parsed.open_world_candidates : [];
  for (const candidate of openWorldCandidates) {
    const proposal = shapeOpenWorldCandidate(candidate, sourceBytes, ordinalFor, dropCounter);
    if (proposal) proposals.push(proposal);
  }

  return { proposals, evidence_residuals: dropped };
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
  const shareCountAssertions = Array.isArray(parsed[SHARE_COUNT_ASSERTIONS_KEY])
    ? parsed[SHARE_COUNT_ASSERTIONS_KEY]
    : [];
  for (const assertion of shareCountAssertions) {
    const proposal = shapeShareCountAssertion(assertion, sourceBytes, ordinalFor, dropCounter);
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
  SHARE_COUNT_CLAIM_KEY,
  SHARE_COUNT_PROPOSAL_KIND,
  SHARE_COUNT_KINDS,
  FEE_AMOUNT_CLAIM_KEY,
  FEE_AMOUNT_PROPOSAL_KIND,
  FEE_TRIGGER_CLAIM_KEY,
  FEE_TRIGGER_PROPOSAL_KIND,
  FEE_TAIL_PERIOD_CLAIM_KEY,
  FEE_TAIL_PERIOD_PROPOSAL_KIND,
  FEE_TRIGGER_CODES,
  FEE_SIDES,
  NO_SHOP_ACTION_CLAIM_KEY,
  NO_SHOP_EXCEPTION_PREREQUISITE_CLAIM_KEY,
  NO_SHOP_NOTICE_PERIOD_CLAIM_KEY,
  NO_SHOP_MATCH_PERIOD_CLAIM_KEY,
  NO_SHOP_REMATCH_PERIOD_CLAIM_KEY,
  NO_SHOP_PROPOSAL_KIND,
  NO_SHOP_PERIOD_ROLE_TO_CLAIM_KEY,
  NO_SHOP_PERIOD_ROLES,
  NO_SHOP_ACTION_CODES,
  NO_SHOP_EXCEPTION_PREREQUISITE_CODES,
  createAnthropicProvider,
  // Exported for the CLI and for tests that want to exercise shaping/parsing
  // directly without a network-shaped client.
  validateResponseShape,
  shapeProposals,
  shapeTerminationFeeProposals,
  shapeNoShopProposals,
  locateQuoteBytes,
  PROMPT_ID_REEXPORT: PROMPT_ID,
  PROMPT_VERSION_REEXPORT: PROMPT_VERSION,
};
