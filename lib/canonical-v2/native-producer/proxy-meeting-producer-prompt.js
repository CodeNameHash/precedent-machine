'use strict';

const PROMPT_ID = 'native-producer-proxy-meeting/v1';
const PROMPT_VERSION = 1;
const RESPONSE_SHAPE = `{
  "proxy_meeting_assertions": [{
    "section_reference":"<verbatim>",
    "assertion_kind":"FILING_DEADLINE | MAILING_DEADLINE | MEETING_DEADLINE | RECORD_DATE_ESTABLISHMENT | BROKER_SEARCH_OBLIGATION | ADJOURNMENT_COUNT_CAP | ADJOURNMENT_DURATION_CAP | ADJOURNMENT_REASON | ADJOURNMENT_CONTROL | ADJOURNMENT_CONSENT_OVERRIDE | RECOMMENDATION_INCLUSION | CONVENE_OBLIGATION | PARENT_ADOPTION",
    "anchor_kind":"AGREEMENT_DATE | MAILING | SEC_CLEARANCE | null",
    "day_kind":"CALENDAR | BUSINESS | null", "limit_basis":"PER_OCCASION | AGGREGATE | null",
    "reason_kind":"QUORUM_ABSENT | INSUFFICIENT_VOTES | SUPPLEMENTAL_DISCLOSURE | LEGAL_REQUIREMENT | null",
    "control_party":"<verbatim or null>", "consenting_party":"<verbatim or null>", "obligated_party":"<verbatim or null>",
    "meeting_ref":"<verbatim or null>", "document_ref":"<verbatim or null>",
    "adoption_mechanism":"SOLE_HOLDER_WRITTEN_CONSENT | ALL_RECORD_HOLDERS_WRITTEN_CONSENT | SOLE_STOCKHOLDER_ADOPTION | WRITTEN_CONSENT | BOARD_ONLY | null", "adoption_timing":"<verbatim or null>",
    "quote":"<one verbatim legal fact>"
  }], "open_world_candidates":[{"observed_quote":"<verbatim>","why_unmapped":"<brief>","nearest_concept":null}]
}`;
const INSTRUCTIONS = `Extract only positive proxy-statement, stockholder-meeting and Parent/Merger Sub adoption covenants. Copy every quote exactly. Split independent filing, mailing, record-date, broker-search and adjournment facts. Never split a respectively-paired cap. Record-date numerics stay open world unless both direction and anchor are explicit; the governed record-date assertion is presence only. In bundled sections, do not extract antitrust, CVR, recommendation-change, vote-failure termination, closing-condition or tender-offer structure material. Schedule TO, Schedule 14D-9, offer commencement, acceptance/payment and stockholder-list mechanics belong to the merger-structure family. A tender-offer minimum condition belongs to closing conditions. When a kind, anchor, basis, reason or party is uncertain, use open_world_candidates. Never assert an absence. Return JSON only.`;
function buildProxyMeetingProducerPrompt({ source_text: sourceText, governed_scope: governedScope, known_definitions: knownDefinitions = [] }) {
  if (typeof sourceText !== 'string' || sourceText.length === 0) throw new TypeError('source_text must be a non-empty string');
  if (!governedScope || typeof governedScope !== 'object') throw new TypeError('governed_scope must be an object');
  const definitions = knownDefinitions.length ? `KNOWN DEFINITIONS:\n${knownDefinitions.map((row) => `- ${row.defined_term}`).join('\n')}\n` : '';
  return { prompt_id: PROMPT_ID, prompt_version: PROMPT_VERSION, messages: [{ role: 'user', content: [INSTRUCTIONS, definitions, 'RESPONSE SHAPE:', RESPONSE_SHAPE, 'SOURCE TEXT:', sourceText].join('\n\n') }] };
}
module.exports = { PROMPT_ID, PROMPT_VERSION, RESPONSE_SHAPE, INSTRUCTIONS, buildProxyMeetingProducerPrompt };
