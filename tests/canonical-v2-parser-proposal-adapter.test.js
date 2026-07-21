const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { contentId, utf8Slice } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContract } = require('../lib/canonical-v2/contract-bundle');
const {
  buildParserProposalEnvelope,
  validateParserProposalEnvelope,
} = require('../lib/canonical-v2/parser-proposal-adapter');
const {
  buildFixtureSourceAdmission,
  buildImmutableSource,
} = require('../lib/canonical-v2/source-structure');

const DEAL_KEY = 'deal:parser-proposal-fixture';
const DEAL_ADMISSION_ID = contentId('DEAL_ADMISSION/V1', DEAL_KEY);

function sourceText(actualKnowledgeTail = 'the conscious awareness of the named individuals') {
  return `AGREEMENT AND PLAN OF MERGER

Page 1 of 3

ARTICLE I
DEFINITIONS

Section 1.01 Definitions.
“Actual Knowledge” means ${actualKnowledgeTail}.
“Business Day” means any day other than Saturday, Sunday or a bank holiday.

ARTICLE II
REPRESENTATIONS AND WARRANTIES

Section 2.01 Capitalization.
The Company represents that its capitalization is accurate.

IN WITNESS WHEREOF, the parties have executed this Agreement.`;
}

function fixture(text = sourceText()) {
  const contract = compileFixtureContract();
  const source = buildImmutableSource({
    sourceBytes: Buffer.from(text, 'utf8'),
    sourceOccurrenceKey: 'parser-proposal-fixture-source',
  });
  const sourceAdmission = buildFixtureSourceAdmission({
    source,
    dealKey: DEAL_KEY,
    dealAdmissionId: DEAL_ADMISSION_ID,
    contractFingerprint: contract.fingerprint,
  });
  const envelope = buildParserProposalEnvelope({
    contract_bundle: contract,
    source,
    source_admission: sourceAdmission,
    governed_deal_key: DEAL_KEY,
    deal_admission_id: DEAL_ADMISSION_ID,
  });
  return { contract, source, sourceAdmission, envelope };
}

function validate(input, envelope = input.envelope, overrides = {}) {
  return validateParserProposalEnvelope({
    envelope,
    contract_bundle: input.contract,
    source: input.source,
    source_admission: input.sourceAdmission,
    governed_deal_key: DEAL_KEY,
    deal_admission_id: DEAL_ADMISSION_ID,
    ...overrides,
  });
}

function allKeys(value, found = new Set()) {
  if (!value || typeof value !== 'object') return found;
  if (Array.isArray(value)) {
    value.forEach((item) => allKeys(item, found));
    return found;
  }
  Object.entries(value).forEach(([key, child]) => {
    found.add(key);
    allKeys(child, found);
  });
  return found;
}

test('legacy structure and definition detection become exact source-backed proposals only', () => {
  const input = fixture();
  const { envelope, source } = input;

  assert.equal(validate(input), true);
  assert.equal(envelope.diagnostics.parser_section_count, 2);
  assert.equal(envelope.diagnostics.definition_candidate_count, 2);
  assert.deepEqual(envelope.section_proposals.map((section) => section.section_number), ['1.01', '2.01']);
  assert.deepEqual(
    envelope.definition_candidates.map((candidate) => candidate.neutral_defined_term),
    ['Actual Knowledge', 'Business Day'],
  );

  for (const proposal of [...envelope.section_proposals, ...envelope.definition_candidates]) {
    const anchor = proposal.evidence_anchor;
    assert.equal(
      utf8Slice(source.canonical_text.text, anchor.absolute_start, anchor.absolute_end),
      anchor.exact_text,
    );
  }
  assert.match(envelope.definition_candidates[0].evidence_anchor.exact_text, /^“Actual Knowledge” means/);
  assert.equal(Object.hasOwn(envelope.parser_projection, 'clean_text'), false);
  assert.doesNotMatch(envelope.section_proposals[0].evidence_anchor.exact_text, /Page 1 of 3/);
});

test('definition candidates remain nested in their structural section without becoming canonical concepts', () => {
  const { envelope } = fixture();
  const definitionSection = envelope.section_proposals[0];
  for (const candidate of envelope.definition_candidates) {
    assert.equal(candidate.parent_structural_section_proposal_id, definitionSection.structural_section_proposal_id);
    assert.ok(candidate.evidence_anchor.absolute_start >= definitionSection.evidence_anchor.absolute_start);
    assert.ok(candidate.evidence_anchor.absolute_end <= definitionSection.evidence_anchor.absolute_end);
  }
  const keys = allKeys(envelope);
  for (const forbidden of [
    'concept_key',
    'canonical_concept_key',
    'state',
    'canonical_value',
    'market_comparability',
    'party',
  ]) assert.equal(keys.has(forbidden), false);
});

test('the adapter is deterministic and one changed source proposition rekeys its lineage', () => {
  const first = fixture();
  const replay = fixture();
  const changed = fixture(sourceText('the actual awareness of the named individuals'));

  assert.deepEqual(first.envelope, replay.envelope);
  assert.notEqual(first.envelope.proposal_envelope_id, changed.envelope.proposal_envelope_id);
  assert.notEqual(
    first.envelope.definition_candidates[0].definition_candidate_proposal_id,
    changed.envelope.definition_candidates[0].definition_candidate_proposal_id,
  );
  assert.equal(
    first.envelope.definition_candidates[1].neutral_defined_term,
    changed.envelope.definition_candidates[1].neutral_defined_term,
  );
});

test('tampered evidence, admission or deal identity fails before canonical writing', () => {
  const input = fixture();
  const badEvidence = structuredClone(input.envelope);
  badEvidence.definition_candidates[0].evidence_anchor.exact_text = 'invented';
  assert.throws(() => validate(input, badEvidence), /mapping mismatch/);

  assert.throws(() => validate(input, input.envelope, {
    deal_admission_id: contentId('DEAL_ADMISSION/V1', 'wrong-deal'),
  }), /source admission/);

  const badAdmission = structuredClone(input.sourceAdmission);
  badAdmission.canonical_payload_digest = '0'.repeat(64);
  assert.throws(() => validate(input, input.envelope, { source_admission: badAdmission }), /source admission/);
});

test('the proposal adapter has no database, model or legacy storage authority', () => {
  const adapter = fs.readFileSync('lib/canonical-v2/parser-proposal-adapter.js', 'utf8');
  assert.doesNotMatch(adapter, /store-cards|store-claims|parser-v2\/store|supabase|anthropic|claude|fetch\s*\(/i);
  const boundary = compileFixtureContract().parser_proposal_boundary_definition;
  assert.equal(boundary.canonical_write_permission, false);
  assert.equal(boundary.absence_decision_permission, false);
  assert.equal(boundary.comparability_decision_permission, false);
  assert.equal(boundary.semantic_identity_permission, false);
  assert.equal(boundary.exact_evidence_required, true);
});
