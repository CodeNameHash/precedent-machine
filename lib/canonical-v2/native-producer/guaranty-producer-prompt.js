'use strict';
// Producer prompt for GUARANTY_FINANCING_PARTY.
//
// v2 (2026-08-08) fixes the false zero found on TopBuild (Step 2F, BREAK 2).
// §7.16 "Waiver of Claims Against Financing Sources" -- a textbook
// non-recourse clause on a $600,000,000 debt-financed acquisition -- resolved
// correctly, was handed to the model, and produced THREE empty arrays. The
// model explained itself in the recording: "it's a lender-liability waiver, a
// distinct mechanism", so not a guaranty. That was a fair reading of v1.
//
// Two things in v1 caused it, and v2 changes exactly those two:
//
//   1. "Extract quoted positive guaranty facts only" opened the instruction
//      and therefore scoped the WHOLE response, including
//      `FINANCING_PARTY_PROTECTION` -- which exists to capture financing-source
//      protections, whose canonical instance is precisely a non-recourse
//      waiver with no guaranty anywhere near it. v2 scopes "positive facts
//      only" to `guaranty_assertions`, where it belongs and does real work.
//
//   2. The response shape showed `"open_world_candidates":[]` -- an empty
//      array with no element schema. Measured across TopBuild's 24 families:
//      the 11 prompts showing that pre-filled empty averaged 2.5 open-world
//      rows and 5 returned zero; the 11 that do not show a pre-filled empty
//      averaged 20.1 and 1 returned zero. Showing the model the field's
//      "default value" is what it learns. v2 shows the element schema.
//
// NOT CHANGED, DELIBERATELY: the "never infer" list. A guaranty family that
// invents a cap or a payment-versus-collection status is worse than one that
// finds nothing, and an empty `guaranty_assertions` remains the CORRECT answer
// on a deal with no guaranty (Modiv, an unfinanced deal, is that case).
const PROMPT_ID = 'native-producer-guaranty/v1';
const PROMPT_VERSION = 2;

const RESPONSE_SHAPE = '{"guaranty_assertions":[{"section_reference":"<verbatim>","assertion_kind":"PERFORMANCE_GUARANTY | GUARANTY_DELIVERED | GUARANTY_IN_EFFECT","guarantor_ref":"<verbatim required>","obligor_ref":"<verbatim optional for performance only>","quote":"<one exact fact>"}],"financing_mechanics":[{"surface":"GUARANTY_DELIVERY | GUARANTY_CORE_TERM | FINANCING_PARTY_PROTECTION","quote":"<one verbatim mechanism>","detail":"<factual description only>"}],"open_world_candidates":[{"observed_quote":"<verbatim>","why_unmapped":"<brief>","nearest_concept":null}]}';

const INSTRUCTIONS = [
  'Extract quoted facts from the source text. Copy every quote exactly.',
  'guaranty_assertions: positive guaranty facts only -- a named guarantor, a guaranty delivered, a guaranty in effect. Never infer no guaranty, no default, an uncapped guaranty, a guaranty cap, or payment-versus-collection status. Split delivery and in-effect facts even when their quotes overlap. An empty list is the correct answer when the text contains no guaranty.',
  'financing_mechanics: preserve guaranty delivery details, core terms and financing-party protections here as exact evidence. FINANCING_PARTY_PROTECTION is NOT conditional on a guaranty being present: a non-recourse provision, a waiver of claims against financing sources, or a limitation on lender liability is a financing-party protection and belongs here even when the agreement contains no guaranty at all. The surface label routes evidence only and is not a governed legal code.',
  'open_world_candidates: any provision in the source text bearing on guarantors, financing sources, or protections given to either, that does not fit the two lists above. Quote it verbatim and say briefly why it did not map. A section was routed to this family because a reader judged it relevant, so returning all three lists empty asserts the section is about none of these subjects -- state that by leaving all three empty only when it is true of the text in front of you, and never by omitting content you can see.',
].join(' ');

function buildGuarantyProducerPrompt({ source_text: sourceText, governed_scope: governedScope } = {}) {
  if (typeof sourceText !== 'string' || !sourceText) throw new TypeError('source_text must be a non-empty string');
  if (!governedScope || typeof governedScope !== 'object') throw new TypeError('governed_scope must be an object');
  return Object.freeze({
    prompt_id: PROMPT_ID,
    prompt_version: PROMPT_VERSION,
    messages: Object.freeze([{
      role: 'user',
      content: [INSTRUCTIONS, 'RESPONSE SHAPE:', RESPONSE_SHAPE, 'SOURCE TEXT:', sourceText].join('\n\n'),
    }]),
  });
}

module.exports = Object.freeze({
  PROMPT_ID, PROMPT_VERSION, RESPONSE_SHAPE, INSTRUCTIONS, buildGuarantyProducerPrompt,
});
