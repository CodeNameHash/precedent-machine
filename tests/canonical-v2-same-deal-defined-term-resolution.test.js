'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { sha256Hex, utf8ByteLength } = require('../lib/canonical-v2/canonical-bytes');
const {
  OUTCOMES, FINAL_CORPUS_DEFINED_TERM_BINDINGS, finalCorpusDefinedTermBindingForDeal,
  buildFinalCorpusSameDealDefinedTermIndex, buildSameDealDefinedTermIndex, resolveSameDealDefinedTerm,
} = require('../lib/canonical-v2/native-producer/same-deal-defined-term-resolution');
const { buildIdentityAdmittedSourceContext } = require('./helpers/identity-admitted-source');

const CALIBRATION = Object.freeze({
  calibration_id: 'test-stage-2y', codebook_version: 'knowledge/v1', integration_fixture_id: 'stage-2y-unit',
  allowed_assertion_kinds: ['KNOWLEDGE_STANDARD'], generic_party_neutral: true,
  composite_precedence: [{ code: 'AFTER_INQUIRY', patterns: ['due inquiry', 'reasonable inquiry'] }, { code: 'CONSTRUCTIVE' }, { code: 'ACTUAL' }],
});
const LOCAL_TERM_CALIBRATION = Object.freeze({
  calibration_id: 'test-stage-2y-local-terms', codebook_version: 'local-terms/v1', integration_fixture_id: 'stage-2y-local-terms-unit',
  allowed_assertion_kinds: ['PARTY_CAPACITY', 'CONDITION_TERM', 'APPROVAL_TERM', 'KNOWLEDGE_STANDARD'], generic_party_neutral: false,
  composite_precedence: [{ code: 'AFTER_INQUIRY', patterns: ['after due inquiry', 'reasonable inquiry'] }, { code: 'ACTUAL' }],
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

function actualSource(run) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'evidence', 'canonical-v2', run, 'adapter-result.json'), 'utf8')).admitted_source_contexts[0];
}

function actualByteOffsets(text, quote, occurrence = 0) {
  const source = Buffer.from(text, 'utf8');
  const needle = Buffer.from(quote, 'utf8');
  let offset = -1;
  let from = 0;
  for (let index = 0; index <= occurrence; index += 1) {
    offset = source.indexOf(needle, from);
    assert.notEqual(offset, -1, `missing actual agreement quote: ${quote}`);
    from = offset + needle.length;
  }
  return [offset, offset + needle.length];
}

function actualDefinitionEntry({ source, term, assertionKind, code, party = null, head, limb = head, limbOccurrence = 0 }) {
  const text = source.canonical_text.text;
  const [headStart, headEnd] = actualByteOffsets(text, head);
  const [limbStart, limbEnd] = actualByteOffsets(text, limb, limbOccurrence);
  const evidence = head === limb && headStart === limbStart
    ? [{ evidence_role: 'OPERATIVE_TEXT', absolute_start: headStart, absolute_end: headEnd, claim_evidence_id: sha256Hex(`local:${term}:only`), excerpt_id: sha256Hex(`local:${term}:only-excerpt`) }]
    : [
      { evidence_role: 'DEFINITION', absolute_start: headStart, absolute_end: headEnd, claim_evidence_id: sha256Hex(`local:${term}:head:${party || 'none'}`), excerpt_id: sha256Hex(`local:${term}:head-excerpt:${party || 'none'}`) },
      { evidence_role: 'OPERATIVE_TEXT', absolute_start: limbStart, absolute_end: limbEnd, claim_evidence_id: sha256Hex(`local:${term}:limb:${party || 'none'}:${limbOccurrence}`), excerpt_id: sha256Hex(`local:${term}:limb-excerpt:${party || 'none'}:${limbOccurrence}`) },
    ];
  return {
    ok: true,
    section_reference: 'LOCAL',
    candidate: {
      claim: {
        claim_definition_key: 'NATIVE_DEFINED_TERM_CANDIDATE',
        claim_occurrence_id: sha256Hex(`${term}:${assertionKind}:${code}:${party || 'none'}:${limbOccurrence}`),
        raw_value: limb,
        attributes: {
          assertion_kind: assertionKind,
          defined_term_ref: assertionKind === 'KNOWLEDGE_STANDARD' ? null : term,
          knowledge_term_ref: assertionKind === 'KNOWLEDGE_STANDARD' ? term : null,
          definition_party: assertionKind === 'KNOWLEDGE_STANDARD' ? null : party,
          knowledge_party: assertionKind === 'KNOWLEDGE_STANDARD' ? party : null,
          resolved_code: assertionKind === 'KNOWLEDGE_STANDARD' ? null : code,
          standard_code: assertionKind === 'KNOWLEDGE_STANDARD' ? code : null,
          definition_head_quote: head,
          limb_quote: limb,
        },
        evidence,
      },
    },
  };
}

function actualIndex(source, entries, calibration = LOCAL_TERM_CALIBRATION) {
  const receipt = {
    document_hash: source.document_hash,
    resolved_sections: [{ section_reference: 'LOCAL', start: 0, end: utf8ByteLength(source.canonical_text.text) }],
    compiled_candidates: entries,
  };
  return buildSameDealDefinedTermIndex({ key_defined_term_receipts: [receipt], admitted_source_context: source, calibration });
}

test('Stage 2Y is inert without explicit calibrated receipts', () => {
  const item = fixture();
  const result = resolveSameDealDefinedTerm({ index: buildSameDealDefinedTermIndex({}), term_ref: 'Knowledge', use_party: 'TARGET', requested_kind: 'KNOWLEDGE_STANDARD' });
  assert.equal(result.outcome, OUTCOMES.INERT);
  assert.equal(index([item]).status, 'CALIBRATED');
});

test('final-corpus bindings select one exact same-deal final receipt and fail closed on document mismatch', () => {
  const binding = finalCorpusDefinedTermBindingForDeal('skechers');
  assert.strictEqual(binding, FINAL_CORPUS_DEFINED_TERM_BINDINGS.skechers);
  const source = actualSource(binding.key_defined_term_run);
  const receipt = JSON.parse(fs.readFileSync(path.join(
    __dirname, '..', binding.key_defined_term_receipt_path,
  ), 'utf8'));
  const index = buildFinalCorpusSameDealDefinedTermIndex({
    binding,
    key_defined_term_receipt: receipt,
    admitted_source_context: source,
  });
  assert.equal(index.status, 'CALIBRATED');
  assert.equal(index.document_hash, binding.document_hash);
  assert.equal(index.calibration_id, binding.calibration.calibration_id);
  assert.equal(buildFinalCorpusSameDealDefinedTermIndex({
    binding: null,
    key_defined_term_receipt: receipt,
    admitted_source_context: source,
  }).status, 'INERT');
  assert.throws(() => buildFinalCorpusSameDealDefinedTermIndex({
    binding,
    key_defined_term_receipt: receipt,
    admitted_source_context: { ...source, document_hash: '0'.repeat(64) },
  }), /final-corpus defined-term document hash mismatch/);
  assert.throws(() => buildFinalCorpusSameDealDefinedTermIndex({
    binding,
    key_defined_term_receipt: { ...receipt, document_hash: '0'.repeat(64) },
    admitted_source_context: source,
  }), /final-corpus defined-term receipt hash mismatch/);
  assert.throws(() => buildFinalCorpusSameDealDefinedTermIndex({
    binding,
    key_defined_term_receipt: { ...receipt, run_receipt_id: '0'.repeat(64) },
    admitted_source_context: source,
  }), /final-corpus defined-term receipt identity mismatch/);
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

test('agreement-local Buyer Parties, Detriment, and Shareholder Approval records resolve only for their asserted capacity', () => {
  const buyerSource = actualSource('skechers-key-defined-terms-20260809-2xk-final');
  const buyerIndex = actualIndex(buyerSource, [actualDefinitionEntry({
    source: buyerSource,
    term: 'Buyer Parties',
    assertionKind: 'PARTY_CAPACITY',
    code: 'BUYER',
    party: 'BUYER',
    head: '“Merger Sub”, and together with Parent, the “Buyer Parties”',
  })]);
  assert.equal(resolveSameDealDefinedTerm({ index: buyerIndex, term_ref: 'Buyer Parties', use_party: 'BUYER', requested_kind: 'PARTY_CAPACITY' }).value, 'BUYER');
  assert.equal(resolveSameDealDefinedTerm({ index: buyerIndex, term_ref: 'Buyer Parties', use_party: 'TARGET', requested_kind: 'PARTY_CAPACITY' }).outcome, OUTCOMES.NO_DEFINITION);

  const detrimentIndex = actualIndex(buyerSource, [actualDefinitionEntry({
    source: buyerSource,
    term: 'Detriment',
    assertionKind: 'CONDITION_TERM',
    code: 'BURDENSOME_CONDITION',
    party: 'BUYER',
    head: '(a “Detriment”)',
  })]);
  assert.equal(resolveSameDealDefinedTerm({ index: detrimentIndex, term_ref: 'Detriment', use_party: 'BUYER', requested_kind: 'CONDITION_TERM' }).value, 'BURDENSOME_CONDITION');

  const approvalSource = actualSource('redhat-key-defined-terms-20260809-2xk-final');
  const approvalIndex = actualIndex(approvalSource, [actualDefinitionEntry({
    source: approvalSource,
    term: 'Shareholder Approval',
    assertionKind: 'APPROVAL_TERM',
    code: 'STOCKHOLDER_APPROVAL',
    party: 'TARGET',
    head: '(the “Shareholder Approval”)',
  })]);
  assert.equal(resolveSameDealDefinedTerm({ index: approvalIndex, term_ref: 'Shareholder Approval', use_party: 'TARGET', requested_kind: 'APPROVAL_TERM' }).value, 'STOCKHOLDER_APPROVAL');
});

test('agreement-local Company Stockholder Approval binds the adopted-by-stockholders form without a literal verb rule', () => {
  const source = actualSource('skywater-key-defined-terms-20260809-2xk-final');
  const index = actualIndex(source, [actualDefinitionEntry({
    source,
    term: 'Company Stockholder Approval',
    assertionKind: 'APPROVAL_TERM',
    code: 'STOCKHOLDER_APPROVAL',
    party: 'TARGET',
    head: '(the “Company Stockholder Approval”)',
  })]);
  const resolved = resolveSameDealDefinedTerm({ index, term_ref: 'Company Stockholder Approval', use_party: 'TARGET', requested_kind: 'APPROVAL_TERM' });
  assert.equal(resolved.outcome, OUTCOMES.RESOLVED);
  assert.equal(resolved.value, 'STOCKHOLDER_APPROVAL');
  assert.equal(resolveSameDealDefinedTerm({ index, term_ref: 'adopted by the stockholders', use_party: 'TARGET', requested_kind: 'APPROVAL_TERM' }).outcome, OUTCOMES.NO_DEFINITION);
});

test('TopBuild composite Knowledge definition resolves identically for Company and Parent and exposes model conflict', () => {
  const source = actualSource('topbuild-key-defined-terms-20260809-2xk-r2-final');
  const head = 'The term “Knowledge,” when used in this Agreement';
  const entries = [
    actualDefinitionEntry({ source, term: 'Knowledge', assertionKind: 'KNOWLEDGE_STANDARD', code: 'ACTUAL', party: 'TARGET', head, limb: 'the actual knowledge of those persons set forth in Section ‎3.1(g)(iii) of the Company Disclosure Letter' }),
    actualDefinitionEntry({ source, term: 'Knowledge', assertionKind: 'KNOWLEDGE_STANDARD', code: 'AFTER_INQUIRY', party: 'TARGET', head, limb: 'after due inquiry of such person’s direct reports', limbOccurrence: 0 }),
    actualDefinitionEntry({ source, term: 'Knowledge', assertionKind: 'KNOWLEDGE_STANDARD', code: 'ACTUAL', party: 'BUYER', head, limb: 'the actual knowledge of those persons set forth in Section ‎3.1(g)(iii) of the Parent Disclosure Letter' }),
    actualDefinitionEntry({ source, term: 'Knowledge', assertionKind: 'KNOWLEDGE_STANDARD', code: 'AFTER_INQUIRY', party: 'BUYER', head, limb: 'after due inquiry of such person’s direct reports', limbOccurrence: 1 }),
  ];
  const index = actualIndex(source, entries);
  for (const party of ['TARGET', 'BUYER']) {
    const resolved = resolveSameDealDefinedTerm({ index, term_ref: 'Knowledge', use_party: party, requested_kind: 'KNOWLEDGE_STANDARD' });
    assert.equal(resolved.outcome, OUTCOMES.RESOLVED);
    assert.equal(resolved.value, 'AFTER_INQUIRY');
  }
  const recordedModelCode = 'ACTUAL';
  const resolved = resolveSameDealDefinedTerm({ index, term_ref: 'Knowledge', use_party: 'BUYER', requested_kind: 'KNOWLEDGE_STANDARD' });
  assert.notEqual(resolved.value, recordedModelCode, 'definition/model conflict must remain explicit for integration');
});
