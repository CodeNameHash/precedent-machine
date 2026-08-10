'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const {
  assessCorroborationLadder,
  assessDeterministicCorroborationAtRung,
  ANCHOR_STEM_DECLARATION_DIGEST,
  normaliseForm,
  criterionIdentity,
} = require('../lib/canonical-v2/native-producer/corroboration-ladder');
const { corroborateGeneralCovenantCode } = require('../lib/canonical-v2/native-producer/general-covenant-corroboration');
const { corroborateRestrictionCategory } = require('../lib/canonical-v2/native-producer/ioc-corroboration');
const { GENERAL_COVENANT_FOLLOW_ON_OWNERS } = require('../lib/canonical-v2/p0-product-surface-routing');

function evidence(quote) {
  return {
    source_text: quote,
    spans: [{
      absolute_start: 0,
      absolute_end: Buffer.byteLength(quote),
      text_sha256: crypto.createHash('sha256').update(Buffer.from(quote)).digest('hex'),
    }],
  };
}

function candidate(family, quote, code, extra = {}) {
  const attributes = family === 'GENERAL_COVENANTS'
    ? { covenant_code: code, owner_id: GENERAL_COVENANT_FOLLOW_ON_OWNERS[code], ...extra }
    : family === 'MATERIAL_CONTRACTS'
      ? { bucket_code: code, ...extra }
      : { restriction_category: code, assertion_kind: 'RESTRICTION_PRESENT', ...extra };
  return {
    claim: { raw_value: quote, canonical_value: code, attributes },
    non_corroboration_gates: { structural_passed: true, enum_passed: true, evidence_passed: true },
  };
}

function assess(family, quote, code, options = {}) {
  return assessCorroborationLadder({ family, candidate: candidate(family, quote, code, options.attributes), verified_evidence: options.evidence || evidence(quote) });
}

function rungs(result) { return result.rungs.map((item) => item.derivation); }

test('rung 0 is a parity wrapper for each existing corroborator', () => {
  const generalQuote = 'The Company shall issue a press release only with Parent consent.';
  const iocQuote = 'The Company shall not incur indebtedness.';
  const materialQuote = 'The Company has entered into a supply agreement.';
  assert.equal(corroborateGeneralCovenantCode({ quote: generalQuote, code: 'COV-PUBLICITY' }).outcome, 'RESOLVED');
  assert.equal(corroborateRestrictionCategory({ quote: iocQuote, asserted_category: 'INDEBTEDNESS' }).outcome, 'RESOLVED');
  assert.equal(assess('GENERAL_COVENANTS', generalQuote, 'COV-PUBLICITY').rungs[0].derivation, 'MATCH');
  assert.equal(assess('INTERIM_OPERATING', iocQuote, 'INDEBTEDNESS').rungs[0].derivation, 'MATCH');
  assert.equal(assess('MATERIAL_CONTRACTS', materialQuote, 'SUPPLY').rungs[0].derivation, 'MATCH');
  assert.equal(assess('INTERIM_OPERATING', 'The Company shall not act.', 'INDEBTEDNESS').rungs[0].derivation, 'EMPTY');
  assert.equal(assess('INTERIM_OPERATING', iocQuote, 'NOT_A_CATEGORY').rungs[0].derivation, 'INAPPLICABLE');
});

test('normalisation changes form, never topic vocabulary', () => {
  const modalVariant = 'Merger Sub will not conduct other business activities.';
  const result = assess('GENERAL_COVENANTS', modalVariant, 'COV-MERGESUB');
  assert.equal(result.rungs[0].derivation, 'EMPTY');
  assert.equal(result.rungs[1].derivation, 'MATCH');
  assert.equal(normaliseForm('Merger Sub will not').includes('shall'), true);
  for (const familyCase of [
    ['INTERIM_OPERATING', 'The Company must not incur indebtedness.', 'INDEBTEDNESS'],
    ['MATERIAL_CONTRACTS', 'The Company will enter into a supply agreement.', 'SUPPLY'],
  ]) assert.notEqual(assess(...familyCase).rungs[1].derivation, 'INAPPLICABLE');
  assert.equal(assess('GENERAL_COVENANTS', 'Merger Sub will issue a press release.', 'COV-MERGESUB').rungs[1].derivation, 'POSITIVE_CONTRADICTION');
  const strictTax = assess('INTERIM_OPERATING', 'The Company shall not file any Tax Returns.', 'TAX_ELECTIONS');
  assert.deepEqual(rungs(strictTax).slice(0, 3), ['MATCH', 'MATCH', 'MATCH']);
});

test('the runtime seam admits deterministic rungs only and preserves contradictions', () => {
  const modalVariant = 'Merger Sub will not conduct other business activities.';
  assert.equal(assessDeterministicCorroborationAtRung({
    family: 'GENERAL_COVENANTS', quote: modalVariant, code: 'COV-MERGESUB', selected_rung: 0,
  }).derivation, 'EMPTY');
  assert.equal(assessDeterministicCorroborationAtRung({
    family: 'GENERAL_COVENANTS', quote: modalVariant, code: 'COV-MERGESUB', selected_rung: 1,
  }).derivation, 'MATCH');
  assert.equal(assessDeterministicCorroborationAtRung({
    family: 'GENERAL_COVENANTS', quote: 'Merger Sub will issue a press release.', code: 'COV-MERGESUB', selected_rung: 1,
  }).derivation, 'POSITIVE_CONTRADICTION');
  assert.throws(() => assessDeterministicCorroborationAtRung({
    family: 'GENERAL_COVENANTS', quote: modalVariant, code: 'COV-MERGESUB', selected_rung: 3,
  }), /integer from 0 through 2/);
});

test('anchor and stem declarations require both signals and have a stable digest', () => {
  assert.match(ANCHOR_STEM_DECLARATION_DIGEST, /^[a-f0-9]{64}$/);
  assert.equal(assess('GENERAL_COVENANTS', 'The Company shall issue a press release and public announcement.', 'COV-PUBLICITY').rungs[2].derivation, 'MATCH');
  assert.equal(assess('GENERAL_COVENANTS', 'The Company shall issue a press memorandum.', 'COV-PUBLICITY').rungs[2].derivation, 'EMPTY');
  assert.equal(assess('GENERAL_COVENANTS', 'The Company shall announce the matter.', 'COV-PUBLICITY').rungs[2].derivation, 'EMPTY');
  assert.equal(assess('GENERAL_COVENANTS', 'The Company shall comply.', 'COV-PUBLICITY').rungs[2].derivation, 'EMPTY');
});

test('rung 3 defers only a valid, fully empty deterministic assessment', () => {
  const empty = assess('MATERIAL_CONTRACTS', 'The Company shall maintain its files.', 'SUPPLY');
  assert.equal(empty.rungs[3].proposed_resolution, 'MODEL_DEFERRED');
  assert.equal(assess('MATERIAL_CONTRACTS', 'The Company shall enter into a supply agreement.', 'SUPPLY').rungs[3].proposed_resolution, 'RESOLVED');
  assert.equal(assess('GENERAL_COVENANTS', 'Merger Sub will not conduct other business activities.', 'COV-MERGESUB').rungs[3].proposed_resolution, 'RESOLVED');
  assert.equal(assess('INTERIM_OPERATING', 'The Company shall incur indebtedness and grant liens.', 'INDEBTEDNESS').rungs[3].proposed_resolution, 'WITHHELD');
  assert.equal(assess('MATERIAL_CONTRACTS', 'The Company shall maintain its files.', 'OTHER').rungs[3].proposed_resolution, 'WITHHELD');
  const invalid = evidence('The Company shall maintain its files.'); invalid.spans[0].absolute_end -= 1;
  assert.equal(assess('MATERIAL_CONTRACTS', 'The Company shall maintain its files.', 'SUPPLY', { evidence: invalid }).rungs[3].proposed_resolution, 'WITHHELD');
});

test('rung 4 retains positive contradictions and General Covenant specificity', () => {
  const wrongGeneral = assess('GENERAL_COVENANTS', 'The Company shall promptly notify Parent.', 'COV-PUBLICITY');
  assert.equal(wrongGeneral.rungs[0].derivation, 'POSITIVE_CONTRADICTION');
  assert.equal(wrongGeneral.rungs[4].proposed_resolution, 'WITHHELD');
  const specificity = assess('GENERAL_COVENANTS', 'The Company shall promptly notify Parent of Transaction Litigation.', 'COV-NOTIFY');
  assert.equal(specificity.rungs[0].derivation, 'POSITIVE_CONTRADICTION');
  assert.deepEqual(specificity.rungs[0].matched_codes, ['COV-LITNOTIFY']);
  const empty = assess('INTERIM_OPERATING', 'The Company shall maintain its files.', 'INDEBTEDNESS');
  assert.equal(empty.rungs[4].proposed_resolution, 'MODEL_DEFERRED');
  assert.equal(assess('INTERIM_OPERATING', 'The Company shall not incur indebtedness.', 'INDEBTEDNESS').rungs[4].proposed_resolution, 'RESOLVED');
});

test('Material Contracts records non-exclusive bucket hits as ambiguity, never contradiction', () => {
  const result = assess('MATERIAL_CONTRACTS', 'The Company has an inbound license from a supplier under a supply agreement.', 'IP_LICENSES_IN');
  assert.equal(result.rungs[0].derivation, 'AMBIGUOUS');
  assert.equal(result.rungs[0].matched_codes.includes('SUPPLY'), true);
  assert.equal(result.rungs[0].derivation === 'POSITIVE_CONTRADICTION', false);
  assert.equal(result.rungs[4].proposed_resolution, 'MODEL_DEFERRED');
});

test('Material Contract bucket and threshold shapes retain one criterion identity', () => {
  const quote = 'The Company has entered into a supply agreement requiring annual payments of $10,000.';
  const bucket = candidate('MATERIAL_CONTRACTS', quote, 'SUPPLY');
  const threshold = candidate('MATERIAL_CONTRACTS', quote, 'SUPPLY', { threshold_kind: 'USD', threshold_value: '$10,000' });
  assert.equal(
    criterionIdentity({ deal_key: 'deal:example', section_reference: '3.17', candidate: bucket }),
    criterionIdentity({ deal_key: 'deal:example', section_reference: '3.17', candidate: threshold }),
  );
  assert.notEqual(
    criterionIdentity({ deal_key: 'deal:example', section_reference: '3.17', candidate: bucket }),
    criterionIdentity({ deal_key: 'deal:other', section_reference: '3.17', candidate: bucket }),
  );
});

test('IOC multi-match remains ambiguous and cannot model-defer', () => {
  const result = assess('INTERIM_OPERATING', 'The Company shall incur indebtedness and grant liens.', 'INDEBTEDNESS');
  assert.deepEqual(rungs(result).slice(0, 3), ['AMBIGUOUS', 'AMBIGUOUS', 'AMBIGUOUS']);
  assert.equal(result.rungs[3].proposed_resolution, 'WITHHELD');
  assert.equal(result.rungs[4].proposed_resolution, 'WITHHELD');
});

test('evidence failures fail closed, inputs stay unchanged, and every output stays inert', () => {
  const quote = 'The Company shall issue a public announcement.';
  const input = { family: 'GENERAL_COVENANTS', candidate: candidate('GENERAL_COVENANTS', quote, 'COV-PUBLICITY'), verified_evidence: evidence(quote) };
  const before = JSON.stringify(input);
  const result = assessCorroborationLadder(input);
  assert.equal(JSON.stringify(input), before);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(result.rungs.every((item) => item.publication_disposition === 'WITHHELD'), true);
  assert.equal(JSON.stringify(result).includes('ELIGIBLE'), false);
  assert.equal(JSON.stringify(result).includes('PUBLISHED'), false);
  const malformed = { source_text: quote, spans: [] };
  assert.equal(assess('GENERAL_COVENANTS', quote, 'COV-PUBLICITY', { evidence: malformed }).rungs[0].derivation, 'INAPPLICABLE');
  const failedGate = candidate('GENERAL_COVENANTS', quote, 'COV-PUBLICITY'); failedGate.non_corroboration_gates.structural_passed = false;
  assert.equal(assessCorroborationLadder({ family: 'GENERAL_COVENANTS', candidate: failedGate, verified_evidence: evidence(quote) }).rungs[3].proposed_resolution, 'WITHHELD');
});
