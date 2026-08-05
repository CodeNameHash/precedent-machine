'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  COMPARISON_BASIS,
  adaptNativeNeutralDefinitionOpenWorldRecords,
  buildNeutralDefinedTermSameTermComparison,
  normaliseDefinedTermIdentity,
} = require('../lib/canonical-v2/neutral-defined-term-comparison-consumer');
const { shapeDefinedTermsProposals } = require('../lib/canonical-v2/native-producer/anthropic-provider');

function record({ dealId, recordId, term, text, evidence }) {
  return {
    deal_id: dealId,
    neutral_record_id: recordId,
    definition_envelope: {
      defined_term: term,
      definition_kind: 'TERM_DEFINITION',
      definition_head_quote: `"${term}" means`,
      definition_body_quote: text,
      cross_reference_target: null,
      owner_hint: null,
    },
    source_evidence: evidence,
  };
}

test('groups Law records across deals without treating their definitions as equivalent', () => {
  const topBuildText = '"Law" means any statute, regulation or ordinance.';
  const skechersText = '“Law” means any federal, state, local or foreign law.';
  const result = buildNeutralDefinedTermSameTermComparison({ neutral_records: [
    record({ dealId: 'topbuild', recordId: 'topbuild-law', term: 'Law', text: topBuildText, evidence: [{ excerpt_id: 'topbuild-evidence' }] }),
    record({ dealId: 'skechers', recordId: 'skechers-law', term: 'LAW', text: skechersText, evidence: [{ excerpt_id: 'skechers-evidence' }] }),
  ] });
  assert.equal(result.groups.length, 1);
  assert.equal(result.groups[0].normalised_defined_term_identity, 'law');
  assert.equal(result.groups[0].comparison_basis, COMPARISON_BASIS);
  assert.equal(result.market_statistics, 'NOT_CALCULATED');
  assert.deepEqual(result.groups[0].records.map((entry) => entry.definition_envelope.definition_body_quote), [skechersText, topBuildText]);
  assert.deepEqual(result.groups[0].records.map((entry) => entry.source_evidence), [[{ excerpt_id: 'skechers-evidence' }], [{ excerpt_id: 'topbuild-evidence' }]]);
});

test('does not merge different defined terms or single-deal duplicates', () => {
  const result = buildNeutralDefinedTermSameTermComparison({ neutral_records: [
    record({ dealId: 'topbuild', recordId: 'topbuild-law', term: 'Law', text: 'Law one.', evidence: [{ excerpt_id: 'a' }] }),
    record({ dealId: 'skechers', recordId: 'skechers-regulation', term: 'Regulation', text: 'Regulation two.', evidence: [{ excerpt_id: 'b' }] }),
    record({ dealId: 'topbuild', recordId: 'topbuild-law-2', term: 'LAW', text: 'Law three.', evidence: [{ excerpt_id: 'c' }] }),
  ] });
  assert.deepEqual(result.groups, []);
});

test('permits the same native occurrence identifier in different deals but rejects a duplicate within one deal', () => {
  const first = record({ dealId: 'topbuild', recordId: 'shared-occurrence', term: 'Law', text: 'Law one.', evidence: [{ excerpt_id: 'a' }] });
  const second = record({ dealId: 'skechers', recordId: 'shared-occurrence', term: 'Law', text: 'Law two.', evidence: [{ excerpt_id: 'b' }] });
  assert.equal(buildNeutralDefinedTermSameTermComparison({ neutral_records: [first, second] }).groups.length, 1);
  assert.throws(
    () => buildNeutralDefinedTermSameTermComparison({ neutral_records: [first, { ...first }] }),
    /unique within their deal/i,
  );
});

test('normalises punctuation and case only for defined-term identity', () => {
  assert.equal(normaliseDefinedTermIdentity(' “Governing-Law.” '), 'governing law');
  const firstText = '“Governing-Law.” means the law of Delaware.';
  const secondText = '"governing law" means the law selected under Section 9.9.';
  const result = buildNeutralDefinedTermSameTermComparison({ neutral_records: [
    record({ dealId: 'topbuild', recordId: 'topbuild-governing-law', term: 'Governing-Law.', text: firstText, evidence: [{ excerpt_id: 'a' }] }),
    record({ dealId: 'skechers', recordId: 'skechers-governing-law', term: 'governing law', text: secondText, evidence: [{ excerpt_id: 'b' }] }),
  ] });
  assert.equal(result.groups[0].normalised_defined_term_identity, 'governing law');
  assert.equal(result.groups[0].records[0].definition_envelope.defined_term, 'governing law');
  assert.equal(result.groups[0].records[1].definition_envelope.defined_term, 'Governing-Law.');
  assert.equal(result.groups[0].records[0].definition_envelope.definition_body_quote, secondText);
  assert.equal(result.groups[0].records[1].definition_envelope.definition_body_quote, firstText);
});

test('adapts existing native open-world neutral records without changing exact definition text or evidence', () => {
  const topBuildSource = '"Law" means any statute, regulation or ordinance.';
  const skechersSource = '“LAW” means any federal, state, local or foreign law.';
  const native = (source, term) => shapeDefinedTermsProposals({
    definition_envelopes: [{
      section_reference: '1.1', defined_term: term, definition_kind: 'TERM_DEFINITION',
      definition_head_quote: source.slice(0, source.indexOf(' means') + ' means'.length), definition_body_quote: source,
      cross_reference_target: null, owner_hint: 'REFERENCE_UNIVERSE',
    }], open_world_candidates: [],
  }, source).proposals;
  const topBuild = adaptNativeNeutralDefinitionOpenWorldRecords({ deal_id: 'topbuild', open_world: native(topBuildSource, 'Law') });
  const skechers = adaptNativeNeutralDefinitionOpenWorldRecords({ deal_id: 'skechers', open_world: native(skechersSource, 'LAW') });
  const result = buildNeutralDefinedTermSameTermComparison({ neutral_records: [...topBuild, ...skechers] });
  assert.equal(result.groups.length, 1);
  assert.deepEqual(result.groups[0].records.map((entry) => entry.definition_envelope.definition_body_quote), [skechersSource, topBuildSource]);
  assert.deepEqual(result.groups[0].records.map((entry) => entry.source_evidence), [skechers[0].source_evidence, topBuild[0].source_evidence]);
});

test('native adapter fails closed when a neutral envelope lacks exact source evidence', () => {
  assert.throws(() => adaptNativeNeutralDefinitionOpenWorldRecords({
    deal_id: 'topbuild',
    open_world: [{
      claim_definition_key: 'OPEN_WORLD_PROPOSITION', subject_occurrence_id: 'record-1',
      attributes: { definition_envelope: { defined_term: 'Law', definition_body_quote: '"Law" means any law.' } },
      evidence: [],
    }],
  }), /source_evidence/i);
});
