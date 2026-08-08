'use strict';
//
// STEP 2F2 PROBE, 2026-08-08. The ONLY change in this version is the
// `open_world_candidates` element schema in RESPONSE_SHAPE below. The
// instructions are byte-identical to the previous version, deliberately, so
// that a change in open-world yield can be attributed to the response shape
// and to nothing else.
//
// The hypothesis under test: showing a model `"open_world_candidates":[]` --
// an empty array with no element schema -- teaches it that empty is the
// answer. Measured across TopBuild's 22 measurable family runs, the 11
// prompts showing that pre-filled empty averaged 2.5 open-world rows with 5
// returning zero; the 11 not showing one averaged 21.1 with 1 returning zero.
// That correlation is confounded -- the pre-filled prompts are also the terse
// ones -- which is why this is a three-family probe and not a sweep of all
// thirteen. THIS family is the decisive control: it is the only pre-filled
// prompt that is NOT terse, so if yield moves here, prompt length is not the
// explanation.
const PROMPT_ID = 'native-producer-remedies-misc/v1'; const PROMPT_VERSION = 2;
const RESPONSE_SHAPE = `{"boilerplate_assertions":[{"assertion_kind":"GOVERNING_LAW | FORUM_FALLBACK | WAIVER_OR_SURVIVAL | CONSTRUCTION_OR_EXPENSES | TPB_EXCEPTION | ASSIGNMENT_DETAIL | NOTICE","quote":"<one exact governed fact>"}],"mechanics":[{"surface":"SOLE_REMEDY_EVIDENCE | FEE_ELECTION_EVIDENCE | DAMAGES_WAIVER | LITIGATION_EXTENSION | EXPEDITED_PROCEEDING","quote":"<verbatim mechanism>","detail":"<factual description>"}],"open_world_candidates":[{"observed_quote":"<verbatim>","why_unmapped":"<brief>","nearest_concept":null}]}`;
const INSTRUCTIONS = `Capture remedies and miscellaneous boilerplate evidence only. Put governing law, forum fallback, waiver or survival, construction or expenses, third-party-beneficiary exceptions, assignment and notices in boilerplate_assertions. Put sole-remedy, fee-election, damages-waiver, litigation-extension and expedited-proceeding evidence in mechanics. Never duplicate one fact across the two lists. Sole-remedy and fee-election economics belong to termination fees. A mechanics surface label routes exact evidence only and is not a governed legal code. Do not calculate periods or address data. Do not classify fee triggers, conditions, financing protections, or D&O claims. Never assert a negative. Return JSON only.`;
function buildRemediesMiscProducerPrompt({ source_text: sourceText, governed_scope: governedScope }) { if (typeof sourceText !== 'string' || !sourceText) throw new TypeError('source_text must be a non-empty string'); if (!governedScope || typeof governedScope !== 'object') throw new TypeError('governed_scope must be an object'); return { prompt_id: PROMPT_ID, prompt_version: PROMPT_VERSION, messages: [{ role: 'user', content: [INSTRUCTIONS, 'RESPONSE SHAPE:', RESPONSE_SHAPE, 'SOURCE TEXT:', sourceText].join('\n\n') }] }; }
module.exports = { PROMPT_ID, PROMPT_VERSION, RESPONSE_SHAPE, INSTRUCTIONS, buildRemediesMiscProducerPrompt };
