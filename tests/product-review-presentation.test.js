'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  authoredSectionHeading,
  commonRoleHelp,
  primaryProposalSource,
  presentCitationChoices,
  proposalRepairState,
  presentReviewEvidence,
} = require('../lib/product/review-presentation');

test('review section heading uses stored title or exact owned full-section opening only', () => {
  const node = { node_id: 'section-5-1', reference: '5.1' };
  const routing = {
    structure_node_id: node.node_id,
    section_reference: '5.1',
    rationale: 'A long model explanation that must never become the heading.',
  };
  const sourceClosure = {
    source_closure_id: 'closure-5-1', structure_node_id: node.node_id,
    section_reference: '5.1', full_section_span_id: 'full-5-1',
  };
  const fullSpan = {
    span_id: 'full-5-1', structure_node_id: node.node_id,
    source_closure_ids: ['closure-5-1'], kind: 'FULL_SECTION',
    exact_text: '5.1 Conduct of Business by the Company Pending the Closing. Between signing and closing, the Company shall operate normally.',
  };

  assert.equal(authoredSectionHeading({ node: { ...node, title: ' Stored title ' }, routing, sourceClosure, spans: [fullSpan] }), 'Stored title');
  assert.equal(authoredSectionHeading({ node, routing, sourceClosure, spans: [fullSpan] }), 'Conduct of Business by the Company Pending the Closing');
  assert.equal(authoredSectionHeading({
    node, routing, sourceClosure,
    spans: [{ ...fullSpan, exact_text: 'Section 5.1. Conduct of Business by the Company Pending the Closing. Operative text.' }],
  }), 'Conduct of Business by the Company Pending the Closing');
  assert.equal(authoredSectionHeading({ node, routing, sourceClosure, spans: [] }), 'Agreement section');
  assert.equal(authoredSectionHeading({
    node, routing, sourceClosure,
    spans: [{ ...fullSpan, structure_node_id: 'other-section' }],
  }), 'Agreement section');
  assert.equal(authoredSectionHeading({
    node, routing, sourceClosure,
    spans: [{ ...fullSpan, exact_text: '5.2 Wrong section. Operative text.' }],
  }), 'Agreement section');
  assert.equal(authoredSectionHeading({
    node, routing, sourceClosure,
    spans: [{ ...fullSpan, exact_text: '5.1 Heading without a sentence delimiter' }],
  }), 'Agreement section');
  assert.equal(authoredSectionHeading({
    node, routing, sourceClosure,
    spans: [{ ...fullSpan, exact_text: `5.1 ${'Long heading '.repeat(20)}. Operative text.` }],
  }), 'Agreement section');
});

const ownNode = 'own';
const contextNode = 'context';
const nodes = [
  { node_id: ownNode, reference: '6.3', title: 'No solicitation' },
  { node_id: contextNode, reference: '9.1', title: 'Definitions' },
];

test('review evidence keeps a failed claimed quote separate from outside-section context', () => {
  const proposal = {
    unmatched_evidence: [{
      quote: 'The Company ... solicit',
      reason: 'NOT_EXACT_CONTIGUOUS_SOURCE_TEXT',
      source_span_id: 'full-section',
      component_structure_node_id: ownNode,
      component_kind: 'FULL_SECTION',
    }],
    context_only_evidence: [{
      quote: 'Acquisition Proposal has the meaning given...',
      source_span_id: 'definition',
      component_structure_node_id: contextNode,
      component_kind: 'CROSS_REFERENCE',
    }],
  };

  assert.deepEqual(presentReviewEvidence(proposal, nodes), {
    unmatched: [{
      category: 'Claimed quote did not match the source',
      quote: 'The Company ... solicit',
      reason: 'The claimed quote is not exact contiguous source text.',
      source_span_id: 'full-section',
      section_reference: 'Section 6.3',
      component_kind: 'FULL_SECTION',
      source_context: {
        kind: 'UNMATCHED',
        attempted_quote: 'The Company ... solicit',
        reason: 'The claimed quote is not exact contiguous source text.',
        section_reference: 'Section 6.3',
      },
    }],
    contextOnly: [{
      category: 'Supporting context outside the owned section',
      quote: 'Acquisition Proposal has the meaning given...',
      reason: 'The text belongs to a different agreement section or subclause.',
      source_span_id: 'definition',
      section_reference: 'Section 9.1',
      component_kind: 'CROSS_REFERENCE',
      source_context: {
        kind: 'CONTEXT_ONLY',
        attempted_quote: 'Acquisition Proposal has the meaning given...',
        reason: 'The text belongs to a different agreement section or subclause.',
        section_reference: 'Section 9.1',
      },
    }],
  });
});

test('citation choices put shorter owned text first and keep selected text visible through filtering', () => {
  const citationNodes = [
    { node_id: 'section', reference: '6.3', title: 'No solicitation' },
    { node_id: 'subclause', parent_id: 'section', reference: '6.3(a)', title: 'Restrictions' },
    { node_id: 'definition', reference: '1.1', title: 'Definitions' },
  ];
  const spans = [
    { span_id: 'context', structure_node_id: 'definition', kind: 'CROSS_REFERENCE', exact_text: 'Acquisition Proposal means any offer.', start_byte: 1 },
    { span_id: 'broad', structure_node_id: 'section', kind: 'FULL_SECTION', exact_text: 'Section 6.3 contains all restrictions and exceptions.', start_byte: 20 },
    { span_id: 'owned', structure_node_id: 'subclause', kind: 'SUPPORTING_EVIDENCE', exact_text: 'The Company shall not solicit.', start_byte: 10 },
  ];

  assert.deepEqual(
    presentCitationChoices({ spans, nodes: citationNodes, ownedStructureNodeId: 'section', selectedIds: ['context'], filter: 'solicit' }),
    [
      {
        span_id: 'owned', kind: 'SUPPORTING_EVIDENCE', exact_text: 'The Company shall not solicit.',
        section_reference: 'Section 6.3(a)', ownership_label: 'Owned section or subclause',
        breadth_label: 'Source passage', selected: false,
      },
      {
        span_id: 'context', kind: 'CROSS_REFERENCE', exact_text: 'Acquisition Proposal means any offer.',
        section_reference: 'Section 1.1', ownership_label: 'Supporting context',
        breadth_label: 'Source passage', selected: true,
      },
    ],
  );

  const all = presentCitationChoices({ spans, nodes: citationNodes, ownedStructureNodeId: 'section' });
  assert.equal(all[1].span_id, 'broad');
  assert.equal(all[1].breadth_label, 'Broad full section');
  assert.equal(all[2].span_id, 'context');
});

test('primary source retains failed-quote warning only when there is no saved citation', () => {
  const reviewEvidence = presentReviewEvidence({ unmatched_evidence: [{
    quote: 'not exact', reason: 'NOT_EXACT_CONTIGUOUS_SOURCE_TEXT', source_span_id: 'containing',
  }] });
  assert.deepEqual(primaryProposalSource([], reviewEvidence), {
    spanId: 'containing',
    reviewContext: reviewEvidence.unmatched[0].source_context,
  });
  assert.deepEqual(primaryProposalSource(['saved'], reviewEvidence), {
    spanId: 'saved',
    reviewContext: null,
  });
});

test('repair state names missing roles and does not treat one citation as repair of unmatched evidence', () => {
  const requiredRoles = [
    'LEGAL_ACTOR_OR_SUBJECT', 'LEGAL_OPERATION', 'OPERATIVE_OBJECT',
    'TEMPORAL_OR_TRIGGER_SCOPE', 'QUALIFICATIONS',
  ];
  const state = proposalRepairState({
    proposal: { unmatched_evidence: [{ quote: 'not exact' }] },
    savedRoles: { LEGAL_OPERATION: 'must deliver' },
    requiredRoleKeys: requiredRoles,
    savedSourceSpanIds: ['one-valid-citation'],
  });

  assert.equal(state.hasUnmatchedEvidence, true);
  assert.equal(state.needsCitationSelection, false);
  assert.equal(state.citationRepairGuidanceRequired, true);
  assert.deepEqual(state.missingRequiredRoles, [
    { key: 'LEGAL_ACTOR_OR_SUBJECT', label: 'Legal actor or subject', help: 'Who has the right, duty, status or protection.' },
    { key: 'OPERATIVE_OBJECT', label: 'Operative object', help: 'What the legal operation acts on.' },
    { key: 'TEMPORAL_OR_TRIGGER_SCOPE', label: 'Timing or trigger', help: 'When the rule applies or what event triggers it.' },
    { key: 'QUALIFICATIONS', label: 'Qualifications', help: 'Conditions, exceptions, limits or standards that qualify the rule.' },
  ]);
  assert.equal(commonRoleHelp('LEGAL_OPERATION').help, 'What the clause requires, permits, prohibits, states or changes.');
});

test('invalid quote occurrence has a readable review reason', () => {
  assert.equal(
    presentReviewEvidence({ unmatched_evidence: [{ quote: 'text', reason: 'INVALID_OCCURRENCE' }] }).unmatched[0].reason,
    'The requested quote occurrence is not a valid non-negative whole number.',
  );
});
