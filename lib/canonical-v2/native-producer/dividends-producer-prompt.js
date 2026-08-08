'use strict';
// Producer prompt for DIVIDENDS.
//
// v2 (2026-08-08) fixes the false zero found on TopBuild (Step 2F, BREAK 3).
// Both calls returned three empty arrays on text that plainly contains the
// covenant: §4.1(vi)(A) "declare, set aside or pay any dividend or other
// distribution", and its Parent mirror at §4.2(iv)(A).
//
// THE NOTE'S DIAGNOSIS WAS WRONG AND IS CORRECTED HERE. Step 2F recorded this
// as "this family's producer simply does not find its own content when the
// content is a limb rather than a section". Reading v1 shows otherwise: it
// says "Consideration and IOC restrictions remain outside this family", and
// TopBuild's dividend language IS an interim-operating restriction -- limb
// (vi)(A) of a thirty-limb covenant. INTERIM_OPERATING was handed the same two
// sections and resolved 29 claims from them. So the EMPTY GOVERNED LISTS WERE
// CORRECT, and the split between the two families worked as designed.
//
// The real defect is the third array. §4.2(iv)(A) carves out "dividends
// required to be declared and paid pursuant to the terms of the Convertible
// Perpetual Preferred Stock, Series B Preferred Stock" -- a recurring mandated
// dividend, which v1's own instruction says "remain open world" -- and
// `open_world_candidates` came back empty anyway. The prompt named the
// destination and the model did not use it.
//
// Two changes, both aimed at that:
//
//   1. The response shape showed `"open_world_candidates":[]` -- an empty
//      array with no element schema. Measured across TopBuild's 24 families:
//      the 11 prompts showing that pre-filled empty averaged 2.5 open-world
//      rows and 5 returned zero; the 11 that do not show a pre-filled empty
//      averaged 20.1 and 1 returned zero. v2 shows the element schema.
//   2. "Recurring mandated dividends remain open world" was a passing clause
//      stating where they belong. v2 makes it an instruction to emit them,
//      and names preferred-stock dividend requirements as the instance.
//
// NOT CHANGED, DELIBERATELY: the exclusion of consideration and IOC
// restrictions. That boundary is correct and prevents the same covenant being
// extracted twice by two families.
const PROMPT_ID = 'native-producer-dividends/v1';
const PROMPT_VERSION = 2;

const RESPONSE_SHAPE = '{"dividend_assertions":[{"section_reference":"<section>","assertion_kind":"COORDINATION | SPECIAL_DIVIDEND","quote":"<verbatim>","dividend_term_ref":null}],"mechanics":[{"surface":"DIVIDEND_COORDINATION | DIVIDEND_FINAL_PERIOD","quote":"<one verbatim mechanism>","detail":"<factual description only>"}],"open_world_candidates":[{"observed_quote":"<verbatim>","why_unmapped":"<brief>","nearest_concept":null}]}';

const INSTRUCTIONS = [
  'Extract coordination covenants and one-time pre-closing special dividends into dividend_assertions.',
  'Preserve deferred coordination details and final-period mechanics in mechanics as exact evidence.',
  'Never duplicate one fact across the two lists. A mechanics surface label routes evidence only and is not a governed legal code.',
  'Recurring mandated dividends remain open world.',
  'Consideration and IOC restrictions remain outside this family, even when their text is about dividends.',
  'Emit into open_world_candidates, quoted verbatim, every dividend provision the two governed lists above do not take. That includes recurring mandated dividends, dividends required by the terms of preferred stock, and a dividend restriction appearing as a limb of a broader operating covenant. Say briefly why each did not map. A dividend provision you can see in the source text and did not place in any of the three lists is lost, so place it.',
  'Return JSON only.',
].join(' ');

function buildDividendsProducerPrompt({ source_text: sourceText } = {}) {
  if (typeof sourceText !== 'string' || !sourceText) throw new TypeError('source_text must be a non-empty string');
  return {
    prompt_id: PROMPT_ID,
    prompt_version: PROMPT_VERSION,
    messages: [{
      role: 'user',
      content: `${INSTRUCTIONS}\n${RESPONSE_SHAPE}\nSOURCE TEXT:\n${sourceText}`,
    }],
  };
}

module.exports = {
  PROMPT_ID, PROMPT_VERSION, RESPONSE_SHAPE, INSTRUCTIONS, buildDividendsProducerPrompt,
};
