'use strict';

const { contentId } = require('../canonical-bytes');

const PROMPT_ID = 'native-producer-no-other-reps-fraud/v1';
const PROMPT_VERSION = 1;
const RESPONSE_VERSION = 'NATIVE_NO_OTHER_REPS_FRAUD_PRODUCER/V1';
const SUBJECT_SCHEMA = 'NATIVE_NO_OTHER_REPS_FRAUD_SUBJECT/V1';
const EXCERPT_SCHEMA = 'NATIVE_NO_OTHER_REPS_FRAUD_EXCERPT/V1';

const RESPONSE_LISTS = Object.freeze([
  'no_other_reps_assertions',
  'non_reliance_assertions',
  'independent_investigation_assertions',
  'fraud_carveout_assertions',
  'willful_breach_definitions',
  'open_world_candidates',
]);

const GENERIC_KEYS = Object.freeze({
  NO_OTHER_REPS: 'NATIVE_NO_OTHER_REPS_DISCLAIMER_CANDIDATE',
  NON_RELIANCE: 'NATIVE_NON_RELIANCE_ACKNOWLEDGMENT_CANDIDATE',
  EXTRA_CONTRACTUAL: 'NATIVE_EXTRA_CONTRACTUAL_RELIANCE_DISCLAIMER_CANDIDATE',
  INDEPENDENT_INVESTIGATION: 'NATIVE_INDEPENDENT_INVESTIGATION_ACKNOWLEDGMENT_CANDIDATE',
  FRAUD_CARVEOUT: 'NATIVE_FRAUD_CARVEOUT_CANDIDATE',
  WILLFUL_BREACH_DEFINITION: 'NATIVE_WILLFUL_BREACH_DEFINITION_CANDIDATE',
});

const RESPONSE_SHAPE = `{
  "no_other_reps_assertions": [{
    "section_reference": "<verbatim reference>",
    "representation_side": "TARGET | BUYER",
    "assertion_quote": "<verbatim complete disclaimer>",
    "representation_maker_ref": "<verbatim maker phrase or null>",
    "agreement_scope_quote": "<verbatim words limiting the represented material to the agreement or null>"
  }],
  "non_reliance_assertions": [{
    "section_reference": "<verbatim reference>",
    "representation_side": "TARGET | BUYER",
    "assertion_quote": "<verbatim complete non-reliance acknowledgment>",
    "relying_party_ref": "<verbatim relying party phrase>",
    "disclaimed_representation_party_ref": "<verbatim party whose representations are disclaimed or null>",
    "agreement_scope_quote": "<verbatim agreement-only scope words>",
    "extra_contractual_scope_quote": "<verbatim extra-contractual materials disclaimer or null>"
  }],
  "independent_investigation_assertions": [{
    "section_reference": "<verbatim reference>",
    "representation_side": "TARGET | BUYER",
    "assertion_quote": "<verbatim acknowledgment>",
    "investigating_party_ref": "<verbatim party phrase>"
  }],
  "fraud_carveout_assertions": [{
    "section_reference": "<verbatim reference>",
    "representation_side": "TARGET | BUYER",
    "assertion_quote": "<verbatim fraud carve-out>"
  }],
  "willful_breach_definitions": [{
    "section_reference": "<verbatim reference>",
    "definition_quote": "<verbatim complete definition>",
    "defined_term_ref": "<verbatim defined term>"
  }],
  "open_world_candidates": [{
    "observed_quote": "<verbatim text>",
    "why_unmapped": "<reason>"
  }]
}`;

const INSTRUCTIONS = `Read one complete no-other-representations, non-reliance or anti-reliance scope. Return positive, quote-backed candidates only.

Every quote and every party or scope reference must be copied character-for-character from the source. A party or scope reference must occur inside its assertion quote. Never infer a missing disclaimer, fraud carve-out, party, scope or definition from silence.

Keep the four legal elements separate: a no-other-representations disclaimer, a party's non-reliance acknowledgment, an independent-investigation acknowledgment and an express fraud carve-out. Use TARGET when the disclaimed representations are the Target/Company's and BUYER when they are the Parent/Buyer group's.

For non-reliance, quote the relying party and the words that limit reliance to representations expressly stated in the agreement. Put a separately quoted disclaimer of data-room material, presentations, projections or other extra-contractual material in extra_contractual_scope_quote. Do not summarise the scope.

For fraud, return only the operative quote. Do not classify fraud type, fraud scope, available damages or legal effect.

Emit a Willful Breach definition only when the complete definition occurs in this source scope. Quote the defined term and full definition. Do not infer a relationship between that definition and any remedy.

Put uncertain scope, remedy effect, cross-referenced definitions and unfamiliar propositions in open_world_candidates. Return only the JSON object.`;

function buildNoOtherRepsFraudProducerPrompt({ source_text: sourceText, governed_scope: governedScope } = {}) {
  if (typeof sourceText !== 'string' || !sourceText) throw new TypeError('source_text must be a non-empty string');
  if (!governedScope || typeof governedScope !== 'object') throw new TypeError('governed_scope must be an object');
  return {
    prompt_id: PROMPT_ID,
    prompt_version: PROMPT_VERSION,
    messages: [{ role: 'user', content: [INSTRUCTIONS, '', 'RESPONSE SHAPE:', RESPONSE_SHAPE, '', 'SOURCE TEXT:', sourceText].join('\n') }],
  };
}

function evidence(sourceText, quote) {
  if (typeof quote !== 'string' || !quote) return null;
  const sourceBytes = Buffer.from(sourceText, 'utf8');
  const needle = Buffer.from(quote, 'utf8');
  const start = sourceBytes.indexOf(needle);
  if (start < 0) return null;
  return {
    evidence_role: 'OPERATIVE_TEXT',
    excerpt_id: contentId(EXCERPT_SCHEMA, { quote, start, end: start + needle.length }),
    document_ordinal: 0,
    absolute_start: start,
    absolute_end: start + needle.length,
    ordinal: 0,
  };
}

function contained(quote, value) {
  return value == null || (typeof value === 'string' && value.length > 0 && quote.includes(value));
}

function shapeCandidate({ key, quote, sectionReference, representationSide = null, attributes = {}, sourceText, ordinal }) {
  const edge = evidence(sourceText, quote);
  if (!edge) return { residual: { reason: 'QUOTE_UNVERIFIED', quote_preview: String(quote || '').slice(0, 120) } };
  if (!Object.values(attributes).every((value) => contained(quote, value))) {
    return { residual: { reason: 'ATTRIBUTE_NOT_IN_ASSERTION_QUOTE', quote_preview: quote.slice(0, 120) } };
  }
  const subject = contentId(SUBJECT_SCHEMA, { section_reference: sectionReference, representation_side: representationSide, quote });
  return {
    proposal: {
      kind: 'claim',
      proposal_kind: 'NO_OTHER_REPS_FRAUD',
      subject_occurrence_id: subject,
      claim_definition_key: key,
      claim_definition_version: 1,
      ordinal,
      state: 'PRESENT',
      raw_value: quote,
      canonical_value: true,
      attributes: { section_reference: sectionReference, representation_side: representationSide, ...attributes },
      allowed_attributes: ['section_reference', 'representation_side', ...Object.keys(attributes)],
      taxonomy_codes: {},
      codebooks: {},
      evidence: [edge],
      extraction_version: RESPONSE_VERSION,
      normalisation_version: RESPONSE_VERSION,
      derivation_version: RESPONSE_VERSION,
    },
  };
}

function shapeNoOtherRepsFraudProposals(parsed, sourceText) {
  const proposals = [];
  const evidenceResiduals = [];
  let ordinal = 0;
  function push(fields) {
    const shaped = shapeCandidate({ ...fields, sourceText, ordinal: ordinal++ });
    if (shaped.proposal) proposals.push(shaped.proposal);
    else evidenceResiduals.push(shaped.residual);
  }
  for (const row of parsed.no_other_reps_assertions || []) {
    push({
      key: GENERIC_KEYS.NO_OTHER_REPS,
      quote: row.assertion_quote,
      sectionReference: row.section_reference,
      representationSide: row.representation_side,
      attributes: {
        representation_maker_ref: row.representation_maker_ref ?? null,
        agreement_scope_quote: row.agreement_scope_quote ?? null,
      },
    });
  }
  for (const row of parsed.non_reliance_assertions || []) {
    push({
      key: GENERIC_KEYS.NON_RELIANCE,
      quote: row.assertion_quote,
      sectionReference: row.section_reference,
      representationSide: row.representation_side,
      attributes: {
        relying_party_ref: row.relying_party_ref,
        disclaimed_representation_party_ref: row.disclaimed_representation_party_ref ?? null,
        agreement_scope_quote: row.agreement_scope_quote,
      },
    });
    if (row.extra_contractual_scope_quote) {
      push({
        key: GENERIC_KEYS.EXTRA_CONTRACTUAL,
        quote: row.assertion_quote,
        sectionReference: row.section_reference,
        representationSide: row.representation_side,
        attributes: {
          relying_party_ref: row.relying_party_ref,
          extra_contractual_scope_quote: row.extra_contractual_scope_quote,
        },
      });
    }
  }
  for (const row of parsed.independent_investigation_assertions || []) {
    push({
      key: GENERIC_KEYS.INDEPENDENT_INVESTIGATION,
      quote: row.assertion_quote,
      sectionReference: row.section_reference,
      representationSide: row.representation_side,
      attributes: { investigating_party_ref: row.investigating_party_ref },
    });
  }
  for (const row of parsed.fraud_carveout_assertions || []) {
    push({
      key: GENERIC_KEYS.FRAUD_CARVEOUT,
      quote: row.assertion_quote,
      sectionReference: row.section_reference,
      representationSide: row.representation_side,
    });
  }
  for (const row of parsed.willful_breach_definitions || []) {
    push({
      key: GENERIC_KEYS.WILLFUL_BREACH_DEFINITION,
      quote: row.definition_quote,
      sectionReference: row.section_reference,
      attributes: { defined_term_ref: row.defined_term_ref },
    });
  }
  for (const row of parsed.open_world_candidates || []) {
    const edge = evidence(sourceText, row.observed_quote);
    evidenceResiduals.push(edge ? {
      reason: 'OPEN_WORLD_CANDIDATE',
      quote_preview: row.observed_quote.slice(0, 120),
      why_unmapped: row.why_unmapped,
      evidence: [edge],
    } : {
      reason: 'QUOTE_UNVERIFIED',
      quote_preview: String(row.observed_quote || '').slice(0, 120),
    });
  }
  return { proposals, evidence_residuals: evidenceResiduals };
}

module.exports = {
  GENERIC_KEYS,
  INSTRUCTIONS,
  PROMPT_ID,
  PROMPT_VERSION,
  RESPONSE_LISTS,
  RESPONSE_SHAPE,
  buildNoOtherRepsFraudProducerPrompt,
  shapeNoOtherRepsFraudProposals,
};
