'use strict';

const PROMPT_ID = 'native-producer-interim-operating/v5';
const IOC_PROMPT_VERSION = 5;

const RESTRICTION_CATEGORIES = Object.freeze([
  'MERGE',
  'CONTRACT',
  'COMP',
  'DEBT',
  'TAX',
  'CHARTER',
  'ISSUE',
  'ACCOUNTING',
  'SETTLE',
  'DIVIDEND',
  'CAPEX',
]);

const RESPONSE_SHAPE = `{
  "ioc_restriction_assertions": [
    {
      "section_reference": "<verbatim section number>",
      "assertion_kind": "RESTRICTION_PRESENT",
      "restriction_category": "MERGE | CONTRACT | COMP | DEBT | TAX | CHARTER | ISSUE | ACCOUNTING | SETTLE | DIVIDEND | CAPEX",
      "threshold_basis": null,
      "quote": "<smallest exact contiguous source span carrying one governed restriction>"
    }
  ],
  "ioc_mechanics": [
    {
      "section_reference": "<verbatim section number>",
      "surface": "AFFIRMATIVE_COVENANT | LONG_TAIL_RESTRICTION | CONSENT_OR_EFFORTS_STANDARD | EXCEPTION | THRESHOLD_OR_NOTICE_WINDOW",
      "quote": "<one complete verbatim mechanism>",
      "detail": "<short factual description; do not classify>",
      "attachment_scope": "RESTRICTION_LIMB | PARENT_COVENANT | null",
      "target_restriction_quote": "<exact quote used for the governed restriction assertion this mechanic modifies, or null>",
      "value_literal": "<exact numeric literal including an explicit scale word, or null>",
      "unit_literal": "<exact unit phrase, or null>",
      "basis_literal": "<exact basis phrase, or null>",
      "period_literal": "<exact period phrase, or null>"
    }
  ],
  "open_world_candidates": [
    {
      "observed_quote": "<verbatim source text>",
      "why_unmapped": "<why no controlled category fits>",
      "nearest_concept": "<nearest controlled category or null>"
    }
  ]
}`;

const INSTRUCTIONS = `You are a senior M&A lawyer extracting interim operating covenants for review.

EVIDENCE. Copy every quote character-for-character from the supplied source. Use a contiguous span. Never paraphrase, normalise, join spans, or insert ellipses.

POSITIVES ONLY. Never assert that a restriction is absent, inapplicable, permitted, or unrestricted. Carve-outs remain part of the quoted evidence. They are not negative claims.

GOVERNED RESTRICTIONS. Emit one RESTRICTION_PRESENT assertion for each listed category that the quote itself supports. Split a limb that contains several governed categories. Do not emit threshold or other numeric assertions.

EVIDENCE-ONLY MECHANICS. Exhaustively capture affirmative covenants, long-tail restrictions, consent or efforts standards, exceptions, thresholds, percentages, ratios, salary gates, per-unit rates, day counts and notice windows in ioc_mechanics. Surface labels route evidence only. They are not legal codes. Do not promote these mechanisms.

MECHANIC COMPLETENESS. Every ioc_mechanics object MUST contain both a surface and one non-empty, exact, contiguous quote. Never output a detail, attachment, value, unit, basis or period without its quote. For a shared qualifier, exception or threshold, quote the smallest complete source limb that proves the qualifier and identifies the restriction limb it governs. Do not emit a second object that only repeats fields from the first object. If no exact quote is available, omit the object rather than inventing evidence.

ATTACHMENT. Shared qualifiers, exceptions and numeric limits attach to the narrowest restriction limb that their wording governs. For RESTRICTION_LIMB, target_restriction_quote must exactly repeat the complete quote used for that governed restriction assertion. The resolver, not you, converts that quote into a component identity, path and span. Use PARENT_COVENANT only when the wording expressly governs every limb in the parent covenant. For PARENT_COVENANT, target_restriction_quote must be null. Never duplicate one qualifier at both levels. If you cannot identify one exact target, keep attachment_scope and target_restriction_quote null.

NUMERIC SHAPE. Preserve the exact value, unit, basis and period phrases. value_literal is the exact number or money expression. unit_literal is the exact currency, share, percentage, per-unit or day unit phrase when the quote supplies one. basis_literal is the exact aggregate, individual, threshold, ordinary-course or other limiting phrase. period_literal is the exact fiscal-year, as-of-date, notice or other time phrase. Each non-null field must occur inside that mechanism quote. An explicit monetary scale word may be normalised for comparison: for example, $25 million means 25000000 USD while the exact "$25 million" text remains evidence. Do not calculate formula-derived amounts, annualise, aggregate an unstated period, or convert foreign currency without a governed rate and date.

QUOTE THE RESTRICTION LIMB, NOT ITS CHAPEAU. A heading or general undertaking is not category evidence. Quote the smallest limb that contains the operative restriction words.

CONTROLLED CATEGORIES. Do not force loans or investments, affirmative obligations, preambles, general exceptions, consent standards, numeric mechanics, notice windows, or another novel shape into the nearest restriction category. Preserve these items in ioc_mechanics or open_world_candidates.

SIDE. Do not infer or emit target or buyer side. The parent-section chapeau supplies the governed party. Never use legacy mutual party scope.

Return only the JSON object described. No prose or markdown fences.`;

function buildIocProducerPrompt({
  source_text: sourceText,
  governed_scope: governedScope,
  known_definitions: knownDefinitions = [],
} = {}) {
  if (typeof sourceText !== 'string' || sourceText.length === 0) {
    throw new TypeError('source_text must be a non-empty string');
  }
  if (!governedScope || typeof governedScope !== 'object' || Array.isArray(governedScope)) {
    throw new TypeError('governed_scope must be an object');
  }
  if (!Array.isArray(knownDefinitions)) {
    throw new TypeError('known_definitions must be an array');
  }

  const definitions = knownDefinitions.length === 0
    ? ''
    : `KNOWN DEFINITIONS:\n${knownDefinitions.map((definition) => `- ${definition.defined_term}`).join('\n')}\n\n`;
  return Object.freeze({
    prompt_id: PROMPT_ID,
    prompt_version: IOC_PROMPT_VERSION,
    messages: Object.freeze([Object.freeze({
      role: 'user',
      content: [
        INSTRUCTIONS,
        '',
        `RESTRICTION CATEGORIES: ${RESTRICTION_CATEGORIES.join(', ')}`,
        '',
        'RESPONSE SHAPE:',
        RESPONSE_SHAPE,
        '',
        definitions,
        'SOURCE TEXT:',
        sourceText,
      ].join('\n'),
    })]),
  });
}

module.exports = Object.freeze({
  PROMPT_ID,
  IOC_PROMPT_VERSION,
  RESTRICTION_CATEGORIES,
  RESPONSE_SHAPE,
  INSTRUCTIONS,
  buildIocProducerPrompt,
});
