'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const contract = require('../lib/canonical-v2/content-reviewed-definition-reclassification-contract');

const ROOT = path.resolve(__dirname, '..');
const digest = (character) => character.repeat(64);

function proposal() {
  const exactText = '"Superior Proposal" means a bona fide written proposal.';
  return contract.buildContentReviewedDefinitionReclassificationProposal({
    provision_type: 'DEFINITION', provision_subtype: 'DEF-SUPERIOR',
    source_structure: { provision_instance_id: digest('1'), section_reference: 'Section 1.1', structural_path: ['ARTICLE_I', 'SECTION_1.1'] },
    exact_text: exactText,
    source_evidence: [{ evidence_id: digest('2'), source_document_id: digest('3'), absolute_start: 0, absolute_end: Buffer.byteLength(exactText), exact_quote: exactText }],
    old_owner: 'NO_SHOP', proposed_new_owner: 'KEY_DEFINED_TERMS',
    reviewed_reason: 'The exact definition text defines Superior Proposal and belongs with comparable defined terms.',
    reviewer_attestation_reference: digest('4'), one_use_nonce: 'definition-reclass-nonce-0001',
  });
}

function rehash(value) {
  const { proposal_id: ignored, ...body } = value;
  value.proposal_id = contentId(contract.SCHEMA, body);
  return value;
}

test('builds a non-mutating content-reviewed reclassification proposal with every required binding', () => {
  const value = proposal();
  assert.equal(value.authority, 'NONE');
  assert.equal(value.mutation_authority, 'NONE');
  assert.equal(value.consumption_state, 'UNCONSUMED_PROPOSAL_ONLY');
  assert.equal(value.predecessor_decision_identity, 'NONE');
  assert.deepEqual(contract.validateContentReviewedDefinitionReclassificationProposal(value), value);
});

test('rejects subtype-only, missing exact evidence, and swapped owner or reviewer bindings', () => {
  assert.throws(() => contract.buildContentReviewedDefinitionReclassificationProposal({ provision_subtype: 'DEF-SUPERIOR' }), (error) => error.code === 'RECLASSIFICATION_EXACT_KEY_SET_REQUIRED');
  const missingEvidence = structuredClone(proposal()); missingEvidence.source_evidence = []; rehash(missingEvidence);
  assert.throws(() => contract.validateContentReviewedDefinitionReclassificationProposal(missingEvidence), (error) => error.code === 'RECLASSIFICATION_EVIDENCE_REQUIRED');
  const swappedOwners = structuredClone(proposal()); [swappedOwners.old_owner, swappedOwners.proposed_new_owner] = [swappedOwners.proposed_new_owner, swappedOwners.old_owner]; rehash(swappedOwners);
  assert.throws(() => contract.validateContentReviewedDefinitionReclassificationProposal(swappedOwners), (error) => error.code === 'RECLASSIFICATION_DECISION_ID_INVALID');
  const swappedReviewer = structuredClone(proposal()); swappedReviewer.reviewer_attestation_reference = digest('5'); rehash(swappedReviewer);
  assert.throws(() => contract.validateContentReviewedDefinitionReclassificationProposal(swappedReviewer), (error) => error.code === 'RECLASSIFICATION_DECISION_ID_INVALID');
});

test('rejects replayed one-use decision identities and non-proposal authority states', () => {
  const value = proposal();
  assert.throws(() => contract.validateContentReviewedDefinitionReclassificationProposalSet([value, structuredClone(value)]), (error) => error.code === 'RECLASSIFICATION_DECISION_REPLAY');
  const issued = structuredClone(value); issued.mutation_authority = 'GRANTED'; rehash(issued);
  assert.throws(() => contract.validateContentReviewedDefinitionReclassificationProposal(issued), (error) => error.code === 'RECLASSIFICATION_STATE_INVALID');
});

test('contract has no direct database or write path', () => {
  const source = fs.readFileSync(path.join(ROOT, 'lib/canonical-v2/content-reviewed-definition-reclassification-contract.js'), 'utf8');
  assert.doesNotMatch(source, /writeFile|mkdir|node:https|node:http|\bfetch\s*\(|supabase|createClient|INSERT\s+INTO|UPDATE\s+|DELETE\s+|\.from\s*\(/i);
});
