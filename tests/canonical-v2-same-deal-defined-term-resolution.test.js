'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { sha256Hex, utf8ByteLength } = require('../lib/canonical-v2/canonical-bytes');
const {
  OUTCOMES, buildSameDealDefinedTermIndex, resolveSameDealDefinedTerm,
} = require('../lib/canonical-v2/native-producer/same-deal-defined-term-resolution');
const { buildIdentityAdmittedSourceContext } = require('./helpers/identity-admitted-source');

const CALIBRATION = Object.freeze({
  calibration_id: 'test-stage-2y', codebook_version: 'knowledge/v1', integration_fixture_id: 'stage-2y-unit',
  allowed_assertion_kinds: ['KNOWLEDGE_STANDARD'], generic_party_neutral: true,
  composite_precedence: [{ code: 'AFTER_INQUIRY', patterns: ['due inquiry', 'reasonable inquiry'] }, { code: 'CONSTRUCTIVE' }, { code: 'ACTUAL' }],
});

function offsets(text, quote) {
  const before = text.slice(0, text.indexOf(quote));
  return [utf8ByteLength(before), utf8ByteLength(before) + utf8ByteLength(quote)];
}

function fixture({ party = 'TARGET', code = 'ACTUAL', head = '“Knowledge” means', limb = 'actual knowledge after due inquiry', corrupt = null, documentHash = null } = {}) {
  const text = `§ 1. ${head} ${limb}.`;
  const source = buildIdentityAdmittedSourceContext(text, { dealKey: 'fixture', dealAdmissionId: sha256Hex('stage2y-fixture') });
  const [headStart, headEnd] = offsets(text, head);
  const [limbStart, limbEnd] = offsets(text, limb);
  const claim = {
    claim_definition_key: 'NATIVE_DEFINED_TERM_CANDIDATE', claim_occurrence_id: sha256Hex(`${head}:${limb}:${party}:${code}`),
    attributes: { assertion_kind: 'KNOWLEDGE_STANDARD', knowledge_term_ref: 'Knowledge', knowledge_party: party, standard_code: code, definition_head_quote: head, limb_quote: limb },
    evidence: [
      { claim_evidence_id: sha256Hex(`head:${head}:${limb}`), excerpt_id: sha256Hex(`head-excerpt:${head}:${limb}`), evidence_role: 'DEFINITION', absolute_start: corrupt === 'utf16' ? text.indexOf(head) : headStart, absolute_end: headEnd },
      { claim_evidence_id: sha256Hex(`limb:${head}:${limb}`), excerpt_id: sha256Hex(`limb-excerpt:${head}:${limb}`), evidence_role: 'OPERATIVE_TEXT', absolute_start: limbStart, absolute_end: corrupt === 'end' ? limbEnd - 1 : limbEnd },
    ],
  };
  const receipt = { document_hash: documentHash || source.document_hash, resolved_sections: [{ section_reference: '1', start: 0, end: utf8ByteLength(text) }], compiled_candidates: [{ ok: true, section_reference: '1', candidate: { kind: 'claim', claim } }] };
  return { source, receipt };
}

function index(items, calibration = CALIBRATION) {
  return buildSameDealDefinedTermIndex({ key_defined_term_receipts: items.map((item) => item.receipt), admitted_source_context: items[0].source, calibration });
}

test('Stage 2Y is inert without explicit calibrated receipts', () => {
  const item = fixture();
  const result = resolveSameDealDefinedTerm({ index: buildSameDealDefinedTermIndex({}), term_ref: 'Knowledge', use_party: 'TARGET', requested_kind: 'KNOWLEDGE_STANDARD' });
  assert.equal(result.outcome, OUTCOMES.INERT);
  assert.equal(index([item]).status, 'CALIBRATED');
});

test('byte verification rejects wrong offsets, UTF-16 hostile offsets and document mismatches', () => {
  for (const corrupt of ['end', 'utf16']) {
    const item = fixture({ head: '“Knowledge” means', corrupt });
    assert.equal(resolveSameDealDefinedTerm({ index: index([item]), term_ref: 'Knowledge', use_party: 'TARGET', requested_kind: 'KNOWLEDGE_STANDARD' }).outcome, OUTCOMES.UNVERIFIED_DEFINITION);
  }
  const item = fixture();
  const mismatch = { ...item.receipt, document_hash: sha256Hex('other') };
  assert.equal(buildSameDealDefinedTermIndex({ key_defined_term_receipts: [mismatch], admitted_source_context: item.source, calibration: CALIBRATION }).status, 'INERT');
});

test('same-document service distinguishes absent, generic, ambiguity, conflict and composite precedence', () => {
  const target = fixture({ party: 'TARGET', code: 'ACTUAL' });
  const buyer = fixture({ party: 'BUYER', code: 'ACTUAL' });
  const resolved = resolveSameDealDefinedTerm({ index: index([target]), term_ref: 'Knowledge', use_party: 'TARGET', requested_kind: 'KNOWLEDGE_STANDARD' });
  assert.equal(resolved.outcome, OUTCOMES.RESOLVED);
  assert.equal(resolved.value, 'AFTER_INQUIRY');
  assert.equal(resolveSameDealDefinedTerm({ index: index([target]), term_ref: 'Knowledge', use_party: 'BUYER', requested_kind: 'KNOWLEDGE_STANDARD' }).outcome, OUTCOMES.NO_DEFINITION);
  const generic = fixture({ party: null, code: 'ACTUAL' });
  assert.equal(resolveSameDealDefinedTerm({ index: index([generic]), term_ref: 'Knowledge', use_party: 'BUYER', requested_kind: 'KNOWLEDGE_STANDARD' }).outcome, OUTCOMES.RESOLVED);
  const ambiguous = { source: target.source, receipt: structuredClone(target.receipt) };
  const ambiguousClaim = ambiguous.receipt.compiled_candidates[0].candidate.claim;
  ambiguousClaim.attributes.definition_head_quote = '“Knowledge”';
  [ambiguousClaim.evidence[0].absolute_start, ambiguousClaim.evidence[0].absolute_end] = offsets(target.source.canonical_text.text, '“Knowledge”');
  ambiguousClaim.claim_occurrence_id = sha256Hex('ambiguous-definition');
  assert.equal(resolveSameDealDefinedTerm({ index: index([target, ambiguous]), term_ref: 'Knowledge', use_party: 'TARGET', requested_kind: 'KNOWLEDGE_STANDARD' }).outcome, OUTCOMES.AMBIGUOUS_DEFINITION);
  const conflicting = { source: target.source, receipt: structuredClone(target.receipt) };
  conflicting.receipt.compiled_candidates[0].candidate.claim.attributes.standard_code = 'CONSTRUCTIVE';
  conflicting.receipt.compiled_candidates[0].candidate.claim.claim_occurrence_id = sha256Hex('conflicting-definition');
  const noCompositeCalibration = { ...CALIBRATION, composite_precedence: [{ code: 'CONSTRUCTIVE' }, { code: 'ACTUAL' }] };
  assert.equal(resolveSameDealDefinedTerm({ index: index([target, conflicting], noCompositeCalibration), term_ref: 'Knowledge', use_party: 'TARGET', requested_kind: 'KNOWLEDGE_STANDARD' }).outcome, OUTCOMES.CONFLICTING_DEFINITION);
  assert.equal(resolveSameDealDefinedTerm({ index: index([target, buyer]), term_ref: 'Knowledge', use_party: 'BUYER', requested_kind: 'KNOWLEDGE_STANDARD' }).value, 'AFTER_INQUIRY');
});
