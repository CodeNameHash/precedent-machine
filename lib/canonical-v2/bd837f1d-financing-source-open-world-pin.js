'use strict';

const { contentId, sha256Hex } = require('./canonical-bytes');

const SCHEMA_VERSION = 'BD837F1D_FINANCING_SOURCE_OPEN_WORLD_PIN/V1';
const SOURCE_CARD_ID = 'bd837f1d-ca2c-4e18-b2c0-1fa9c9c235a4';
const SOURCE_DOCUMENT_URL = 'https://www.sec.gov/Archives/edgar/data/1621563/000095010324016694/dp221092_ex0201.htm';
const SOURCE_DOCUMENT_SHA256 = 'ee1270aa81ccfb8480071c09b98cceb77768a81ebeb2d294132efed983bab8ec';
const SECTION_REFERENCE = '11.14';
const EXACT_EVIDENCE = 'no Debt Financing Sources Related Party will have any liability to the Company or any of its Subsidiaries in connection with this Agreement, the Debt Financing or any of the transactions contemplated hereby or thereby or the performance of any services thereunder, whether in law or in equity, whether in contract or in tort or otherwise.';

function buildBd837f1dFinancingSourceOpenWorldPin() {
  const evidenceSha256 = sha256Hex(EXACT_EVIDENCE);
  const body = {
    schema_version: SCHEMA_VERSION,
    source_card_id: SOURCE_CARD_ID,
    source_document_url: SOURCE_DOCUMENT_URL,
    source_document_sha256: SOURCE_DOCUMENT_SHA256,
    section_reference: SECTION_REFERENCE,
    exact_evidence: EXACT_EVIDENCE,
    exact_evidence_sha256: evidenceSha256,
    disposition: 'OPEN_WORLD_EXACT_EVIDENCE',
    governed_concept_key: null,
    governed_claim_definition_key: null,
    reason: 'FINANCING_SOURCE_PROTECTION_NOT_YET_GOVERNED',
  };
  return Object.freeze({
    ...body,
    open_world_candidate_id: contentId(SCHEMA_VERSION, body),
  });
}

module.exports = {
  EXACT_EVIDENCE,
  SCHEMA_VERSION,
  SECTION_REFERENCE,
  SOURCE_CARD_ID,
  SOURCE_DOCUMENT_SHA256,
  SOURCE_DOCUMENT_URL,
  buildBd837f1dFinancingSourceOpenWorldPin,
};
