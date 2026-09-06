'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');

const legalSchema = require('../contracts/product/legal-schema.v1.json');
const { contentId } = require('../lib/canonical-v2/canonical-bytes');
const { buildAgreementStructure } = require('../lib/product/agreement-structure');
const {
  buildAgreementDraft, validateAgreementDraft,
} = require('../lib/product/agreement-draft');
const { applyReviewCommand, initialiseReviewState } = require('../lib/product/review-state');
const {
  ProductPhase2Store, crossSectionRelationshipStagingInput,
} = require('../lib/product/phase-2-store');
const {
  resolveRecordedCrossSectionRelationships,
  resolveCrossSectionRelationshipCandidates,
} = require('../lib/product/cross-section-relationship-resolver');

const node71 = '1'.repeat(64);
const node73 = '3'.repeat(64);
const closure71 = 'a'.repeat(64);
const closure73 = 'b'.repeat(64);
const terminationSpanId = 'c'.repeat(64);
const targetLocatorSpanId = 'd'.repeat(64);
const relationshipSpanId = 'e'.repeat(64);
const fullSectionSpanId = 'f'.repeat(64);
const terminationId = '7'.repeat(64);
const feeId = '9'.repeat(64);
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

function span(spanId, structureNodeId, startByte, endByte, exactText, kind = 'SUPPORTING_EVIDENCE') {
  return {
    span_id: spanId,
    structure_node_id: structureNodeId,
    start_byte: startByte,
    end_byte: endByte,
    exact_text: exactText,
    kind,
  };
}

function proposal({
  proposalId, structureNodeId, sourceClosureId, sourceSpanIds,
  familyKey, subtypeKey, factType, statement,
}) {
  return {
    proposal_id: proposalId,
    structure_node_id: structureNodeId,
    source_closure_id: sourceClosureId,
    source_span_ids: sourceSpanIds,
    family_key: familyKey,
    subtype_key: subtypeKey,
    fact_type: factType,
    statement,
    validation_status: 'VALID',
  };
}

function fixture() {
  const termination = proposal({
    proposalId: terminationId,
    structureNodeId: node71,
    sourceClosureId: closure71,
    sourceSpanIds: [terminationSpanId],
    familyKey: 'TERMINATION',
    subtypeKey: 'SUPERIOR_PROPOSAL',
    factType: 'TERMINATION_RIGHT',
    statement: 'The Company may terminate under Section 7.1(c).',
  });
  const fee = proposal({
    proposalId: feeId,
    structureNodeId: node73,
    sourceClosureId: closure73,
    sourceSpanIds: [relationshipSpanId],
    familyKey: 'TERMINATION_FEE',
    subtypeKey: 'FEE_TRIGGER',
    factType: 'FEE_TRIGGER',
    statement: 'The Company must pay the fee following termination under Section 7.1(c).',
  });
  const spans = [
    span(terminationSpanId, node71, 100, 160, 'The Company may terminate under Section 7.1(c).'),
    span(targetLocatorSpanId, node71, 110, 150, 'terminate under Section 7.1(c)'),
    span(relationshipSpanId, node73, 400, 480, 'pay the fee following termination under Section 7.1(c)'),
    span(fullSectionSpanId, node73, 350, 520, 'Section 7.3 Termination Fee.', 'FULL_SECTION'),
  ];
  const sourceClosures = [{
    source_closure_id: closure71,
    structure_node_id: node71,
    full_section_span_id: terminationSpanId,
    spans: [spans[0]],
  }, {
    source_closure_id: closure73,
    structure_node_id: node73,
    full_section_span_id: fullSectionSpanId,
    spans: [spans[1], spans[2], spans[3]],
  }];
  const candidate = {
    schema_version: 'PRODUCT_CROSS_SECTION_RELATIONSHIP_CANDIDATE/V1',
    candidate_id: '8'.repeat(64),
    from_proposal_id: feeId,
    relationship_type: 'REQUIRES',
    source_closure_id: closure73,
    source_span_ids: [relationshipSpanId],
    target_source_span_ids: [targetLocatorSpanId],
    target: {
      structure_node_id: node71,
      family_key: 'TERMINATION',
      subtype_key: 'SUPERIOR_PROPOSAL',
      fact_type: 'TERMINATION_RIGHT',
      source_span_ids: [targetLocatorSpanId],
    },
  };
  return { proposals: [termination, fee], spans, sourceClosures, candidate };
}

test('a source-proved candidate resolves to one cross-section link without copying either fact', () => {
  const value = fixture();
  const proposalsBefore = structuredClone(value.proposals);
  const result = resolveCrossSectionRelationshipCandidates({
    candidates: [value.candidate],
    proposals: value.proposals,
    spans: value.spans,
    sourceClosures: value.sourceClosures,
    legalSchema,
  });

  assert.equal(result.links.length, 1);
  assert.deepEqual(result.issues, []);
  assert.deepEqual(value.proposals, proposalsBefore);
  assert.match(result.links[0].fact_link_id, /^[0-9a-f]{64}$/);
  assert.deepEqual({ ...result.links[0], fact_link_id: null }, {
    schema_version: 'PRODUCT_FACT_LINK/V2',
    fact_link_id: null,
    from_proposal_id: feeId,
    to_proposal_id: terminationId,
    relationship_type: 'REQUIRES',
    source_closure_id: closure73,
    source_span_ids: [relationshipSpanId],
    target_source_span_ids: [targetLocatorSpanId],
  });
});

test('ambiguous or missing targets stay open and source-linked instead of producing a guessed link', () => {
  const value = fixture();
  const duplicateTarget = {
    ...value.proposals[0],
    proposal_id: '6'.repeat(64),
    statement: 'A second termination right uses the same located source.',
  };
  const ambiguous = resolveCrossSectionRelationshipCandidates({
    candidates: [value.candidate],
    proposals: [...value.proposals, duplicateTarget],
    spans: value.spans,
    sourceClosures: value.sourceClosures,
    legalSchema,
  });
  assert.deepEqual(ambiguous.links, []);
  assert.equal(ambiguous.issues.length, 1);
  assert.equal(ambiguous.issues[0].code, 'CROSS_SECTION_RELATIONSHIP_UNRESOLVED');
  assert.match(ambiguous.issues[0].message, /TARGET_AMBIGUOUS/);
  assert.equal(ambiguous.issues[0].state, 'OPEN');
  assert.equal(ambiguous.issues[0].source_closure_id, closure73);
  assert.deepEqual(ambiguous.issues[0].source_span_ids, [relationshipSpanId]);

  const missing = resolveCrossSectionRelationshipCandidates({
    candidates: [{
      ...value.candidate,
      target: { ...value.candidate.target, fact_type: 'OUTSIDE_DATE' },
    }],
    proposals: value.proposals,
    spans: value.spans,
    sourceClosures: value.sourceClosures,
    legalSchema,
  });
  assert.deepEqual(missing.links, []);
  assert.match(missing.issues[0].message, /TARGET_NOT_FOUND/);
});

test('absent relationship proof and forbidden relationship types remain source-linked issues', () => {
  const value = fixture();
  const absentProof = resolveCrossSectionRelationshipCandidates({
    candidates: [{ ...value.candidate, source_span_ids: [] }],
    proposals: value.proposals,
    spans: value.spans,
    sourceClosures: value.sourceClosures,
    legalSchema,
  });
  assert.deepEqual(absentProof.links, []);
  assert.match(absentProof.issues[0].message, /RELATIONSHIP_SOURCE_NOT_EXACT/);
  assert.deepEqual(absentProof.issues[0].source_span_ids, [fullSectionSpanId]);

  const forbiddenType = resolveCrossSectionRelationshipCandidates({
    candidates: [{ ...value.candidate, relationship_type: 'EXTENDS' }],
    proposals: value.proposals,
    spans: value.spans,
    sourceClosures: value.sourceClosures,
    legalSchema,
  });
  assert.deepEqual(forbiddenType.links, []);
  assert.match(forbiddenType.issues[0].message, /RELATIONSHIP_TYPE_NOT_ALLOWED/);
  assert.deepEqual(forbiddenType.issues[0].source_span_ids, [relationshipSpanId]);
});

test('recorded section output resolves a later section link after both facts exist', () => {
  const terminationText = 'The Company may terminate under Section 7.1(c).';
  const feeText = 'The Company must pay the fee following termination under Section 7.1(c).';
  const sourceText = `${terminationText}\n\n${feeText}`;
  const terminationStart = 0;
  const feeStart = Buffer.byteLength(`${terminationText}\n\n`);
  const component71 = span('1'.repeat(64), node71, terminationStart,
    Buffer.byteLength(terminationText), terminationText, 'FULL_SECTION');
  const component73 = span('2'.repeat(64), node73, feeStart,
    feeStart + Buffer.byteLength(feeText), feeText, 'FULL_SECTION');
  const crossReference71 = span('4'.repeat(64), node71, terminationStart,
    Buffer.byteLength(terminationText), terminationText, 'CROSS_REFERENCE');
  const targetEvidence = span(terminationSpanId, node71, terminationStart,
    Buffer.byteLength(terminationText), terminationText);
  const feeEvidence = span(relationshipSpanId, node73, feeStart,
    feeStart + Buffer.byteLength(feeText), feeText);
  const target = fixture().proposals[0];
  target.source_span_ids = [terminationSpanId];
  const fee = fixture().proposals[1];
  fee.source_span_ids = [relationshipSpanId];
  const rawFee = {
    client_ref: 'fee-local', family_key: fee.family_key, subtype_key: fee.subtype_key,
    fact_type: fee.fact_type, statement: fee.statement,
    evidence_quotes: [{ quote: feeText, source_span_id: component73.span_id, occurrence: 0 }],
  };
  const results = [{
    node_id: node71,
    source_closure: {
      source_closure_id: closure71, structure_node_id: node71,
      full_section_span_id: component71.span_id, spans: [component71, targetEvidence],
    },
    spans: [component71, targetEvidence], proposals: [target], model_calls: [],
  }, {
    node_id: node73,
    source_closure: {
      source_closure_id: closure73, structure_node_id: node73,
      full_section_span_id: component73.span_id,
      spans: [component73, crossReference71, feeEvidence],
    },
    spans: [component73, crossReference71, feeEvidence], proposals: [fee],
    model_calls: [{
      model_call_id: '5'.repeat(64), call_kind: 'EXTRACTION', response: {
        proposals: [rawFee],
        cross_section_links: [{
          from_ref: 'fee-local', relationship_type: 'REQUIRES',
          evidence_quotes: [{ quote: feeText, source_span_id: component73.span_id, occurrence: 0 }],
          target: {
            structure_node_id: node71, family_key: target.family_key,
            subtype_key: target.subtype_key, fact_type: target.fact_type,
            evidence_quotes: [{
              quote: terminationText, source_span_id: crossReference71.span_id, occurrence: 0,
            }],
          },
        }],
      },
    }],
  }];
  const resolved = resolveRecordedCrossSectionRelationships({
    sourceDocument: { source_document_id: '0'.repeat(64), canonical_text: sourceText },
    results,
    legalSchema,
  });
  assert.equal(resolved.links.length, 1);
  assert.deepEqual(resolved.issues, []);
  assert.equal(resolved.links[0].from_proposal_id, feeId);
  assert.equal(resolved.links[0].to_proposal_id, terminationId);
  assert.equal(resolved.links[0].source_closure_id, closure73);
  assert.ok(resolved.source_closures.find((item) => item.source_closure_id === closure73)
    .spans.some((item) => item.span_id === resolved.links[0].source_span_ids[0]));
});

test('recorded candidates fail closed on one bad quote or partial target overlap', () => {
  const terminationText = 'The Company may terminate under Section 7.1(c).';
  const feeText = 'The Company must pay the fee following termination under Section 7.1(c).';
  const sourceText = `${terminationText}\n\n${feeText}`;
  const feeStart = Buffer.byteLength(`${terminationText}\n\n`);
  const component71 = span('1'.repeat(64), node71, 0,
    Buffer.byteLength(terminationText), terminationText, 'FULL_SECTION');
  const component73 = span('2'.repeat(64), node73, feeStart,
    feeStart + Buffer.byteLength(feeText), feeText, 'FULL_SECTION');
  const crossReference71 = span('4'.repeat(64), node71, 0,
    Buffer.byteLength(terminationText), terminationText, 'CROSS_REFERENCE');
  const narrowTargetEvidence = span(terminationSpanId, node71, 16, 25, 'terminate');
  const feeEvidence = span(relationshipSpanId, node73, feeStart,
    feeStart + Buffer.byteLength(feeText), feeText);
  const target = fixture().proposals[0];
  target.source_span_ids = [terminationSpanId];
  const fee = fixture().proposals[1];
  fee.source_span_ids = [relationshipSpanId];
  const rawFee = {
    client_ref: 'fee-local', family_key: fee.family_key, subtype_key: fee.subtype_key,
    fact_type: fee.fact_type, statement: fee.statement,
    evidence_quotes: [{ quote: feeText, source_span_id: component73.span_id, occurrence: 0 }],
  };
  const candidate = {
    from_ref: 'fee-local', relationship_type: 'REQUIRES',
    evidence_quotes: [
      { quote: feeText, source_span_id: component73.span_id, occurrence: 0 },
      { quote: 'not exact relationship text', source_span_id: component73.span_id, occurrence: 0 },
    ],
    target: {
      structure_node_id: node71, family_key: target.family_key,
      subtype_key: target.subtype_key, fact_type: target.fact_type,
      evidence_quotes: [{
        quote: terminationText, source_span_id: crossReference71.span_id, occurrence: 0,
      }],
    },
  };
  const results = [{
    node_id: node71,
    source_closure: {
      source_closure_id: closure71, structure_node_id: node71,
      full_section_span_id: component71.span_id, spans: [component71, narrowTargetEvidence],
    },
    spans: [component71, narrowTargetEvidence], proposals: [target], model_calls: [],
  }, {
    node_id: node73,
    source_closure: {
      source_closure_id: closure73, structure_node_id: node73,
      full_section_span_id: component73.span_id,
      spans: [component73, crossReference71, feeEvidence],
    },
    spans: [component73, crossReference71, feeEvidence], proposals: [fee],
    model_calls: [{
      model_call_id: '5'.repeat(64), call_kind: 'EXTRACTION',
      response: { proposals: [rawFee], cross_section_links: [candidate] },
    }],
  }];
  const mixedInvalid = resolveRecordedCrossSectionRelationships({
    sourceDocument: { source_document_id: '0'.repeat(64), canonical_text: sourceText },
    results, legalSchema,
  });
  assert.deepEqual(mixedInvalid.links, []);
  assert.match(mixedInvalid.issues[0].message, /RELATIONSHIP_SOURCE_NOT_EXACT/);
  assert.match(mixedInvalid.issues[0].message, /not exact relationship text/);

  candidate.evidence_quotes = [candidate.evidence_quotes[0]];
  const partialTarget = resolveRecordedCrossSectionRelationships({
    sourceDocument: { source_document_id: '0'.repeat(64), canonical_text: sourceText },
    results, legalSchema,
  });
  assert.deepEqual(partialTarget.links, []);
  assert.match(partialTarget.issues[0].message, /TARGET_NOT_FOUND/);
});

test('section extraction assembles and exposes a source-proved cross-section link for review', async () => {
  const terminationText = 'The Company may terminate this Agreement under Section 7.1(c) by written notice to Parent.';
  const feeText = 'Following termination under Section 7.1(c), the Company shall pay Parent the Termination Fee.';
  const sourceText = [
    'ARTICLE VII',
    'TERMINATION',
    'Section 7.1 Termination.',
    terminationText,
    'Section 7.3 Termination Fee.',
    feeText,
  ].join('\n\n');
  const sourceDocumentId = sha256(sourceText);
  const sourceDocument = {
    schema_version: 'SOURCE_DOCUMENT/V1', source_document_id: sourceDocumentId,
    agreement_id: sourceDocumentId, retrieval_url: 'https://example.test/cross-section.htm',
    final_url: 'https://example.test/cross-section.htm', filing_accession: '0000000000-00-000000',
    exhibit_filename: 'cross-section.htm', source_map_id: sha256('cross-section-map'),
    canonical_text: sourceText, canonical_text_sha256: sourceDocumentId,
  };
  const agreementStructure = buildAgreementStructure({
    agreement_id: sourceDocumentId, canonical_text: sourceText,
    canonical_text_sha256: sourceDocumentId,
  });
  const nodes = new Map(agreementStructure.nodes.map((node) => [node.reference, node]));
  assert.ok(nodes.get('7.1'));
  assert.ok(nodes.get('7.3'));
  const routes = new Map([
    ['7.1', ['TERMINATION']],
    ['7.3', ['TERMINATION_FEE']],
  ]);
  const model = {
    async complete({ call_kind: callKind, request }) {
      const reference = request.section_reference || request.source_closure?.section_reference;
      const families = routes.get(reference) || [];
      let response;
      if (callKind === 'ROUTING') {
        response = {
          families, disposition: families.length ? 'FAMILY_ASSIGNED' : 'IMMATERIAL',
          rationale: 'Synthetic source classification.', deterministic_disagreements: [],
        };
      } else if (callKind === 'RESIDUAL') {
        response = { paragraphs: request.paragraphs.map((paragraph) => ({
          source_span_id: paragraph.source_span_id,
          disposition: families.length ? 'KNOWN_FAMILY' : 'IMMATERIAL',
          family_keys: families, rationale: 'Covered by the routed family.',
        })) };
      } else {
        const family = request.family_contracts[0];
        if (reference === '7.3') {
          assert.ok(request.cross_section_target_contracts.TERMINATION.allowed_subtype_keys
            .includes('SUPERIOR_PROPOSAL'));
          assert.ok(request.cross_section_target_contracts.TERMINATION.allowed_fact_types
            .includes('TERMINATION_RIGHT'));
        }
        const sourceComponents = [
          ...request.source_closure.operative, ...request.source_closure.chapeau,
          ...request.source_closure.cross_references, request.source_closure.full_section,
        ];
        const ownedText = reference === '7.1' ? terminationText : feeText;
        const ownedComponent = sourceComponents.find((component) => (
          component.structure_node_id === nodes.get(reference).node_id
          && component.exact_text.includes(ownedText)
        ));
        assert.ok(ownedComponent);
        const isTermination = reference === '7.1';
        const rawProposal = isTermination ? {
          client_ref: 'termination', group_ref: 'termination-group',
          family_key: 'TERMINATION', subtype_key: 'SUPERIOR_PROPOSAL',
          fact_type: 'TERMINATION_RIGHT', statement: terminationText,
          roles: {
            terminating_party: 'Company', action: 'terminate this Agreement',
            superior_proposal_trigger: 'termination under Section 7.1(c)',
          },
          value: null,
          evidence_quotes: [{ quote: terminationText, source_span_id: ownedComponent.span_id, occurrence: 0 }],
        } : {
          client_ref: 'fee', group_ref: 'fee-group',
          family_key: 'TERMINATION_FEE', subtype_key: 'FEE_TRIGGER',
          fact_type: 'FEE_TRIGGER', statement: feeText,
          roles: {
            payer: 'Company', payee: 'Parent', payment_action: 'pay the Termination Fee',
            trigger: 'termination under Section 7.1(c)',
          },
          value: null,
          evidence_quotes: [{ quote: feeText, source_span_id: ownedComponent.span_id, occurrence: 0 }],
        };
        const factTypeCoverage = Object.fromEntries(family.required_fact_types.map((factType) => [
          factType, factType === rawProposal.fact_type ? 'FOUND' : 'NOT_FOUND',
        ]));
        response = {
          proposals: [rawProposal],
          groups: [{
            client_ref: rawProposal.group_ref, family_key: rawProposal.family_key,
            subtype_key: rawProposal.subtype_key,
          }],
          links: [], coverage: { [family.family_key]: 'FOUND' },
          fact_type_coverage: { [family.family_key]: factTypeCoverage },
          cross_section_links: [],
        };
        if (!isTermination) {
          const targetComponent = request.source_closure.cross_references.find((component) => (
            component.structure_node_id === nodes.get('7.1').node_id
            && component.exact_text.includes(terminationText)
          ));
          assert.ok(targetComponent);
          response.cross_section_links.push({
            from_ref: 'fee', relationship_type: 'REQUIRES',
            evidence_quotes: [{ quote: feeText, source_span_id: ownedComponent.span_id, occurrence: 0 }],
            target: {
              structure_node_id: nodes.get('7.1').node_id,
              family_key: 'TERMINATION', subtype_key: 'SUPERIOR_PROPOSAL',
              fact_type: 'TERMINATION_RIGHT',
              evidence_quotes: [{
                quote: terminationText, source_span_id: targetComponent.span_id, occurrence: 0,
              }],
            },
          });
        }
      }
      return {
        provider_id: 'CROSS_SECTION_TEST', model_id: 'SYNTHETIC_MODEL/V1',
        raw_request: request, raw_response: response, response,
        input_tokens: 1, output_tokens: 1, cost_microusd: 0, duration_ms: 1,
      };
    },
  };
  const draft = await buildAgreementDraft({
    sourceDocument, agreementStructure, legalSchema, model,
  });
  validateAgreementDraft(draft, { sourceDocument, agreementStructure, legalSchema });
  assert.equal(draft.legal_schema_revision, legalSchema.schema_revision);
  assert.equal(draft.proposals.length, 2);
  assert.equal(draft.fact_links.length, 1);
  const link = draft.fact_links[0];
  const from = draft.proposals.find((proposal) => proposal.proposal_id === link.from_proposal_id);
  const to = draft.proposals.find((proposal) => proposal.proposal_id === link.to_proposal_id);
  assert.equal(from.structure_node_id, nodes.get('7.3').node_id);
  assert.equal(to.structure_node_id, nodes.get('7.1').node_id);
  assert.notEqual(from.source_closure_id, to.source_closure_id);
  assert.equal(link.source_closure_id, from.source_closure_id);
  assert.equal(link.source_span_ids.length, 1);
  assert.equal(link.target_source_span_ids.length, 1);

  const forgedTargetDraft = structuredClone(draft);
  const forgedTargetBody = {
    ...forgedTargetDraft.fact_links[0],
    target_source_span_ids: [...forgedTargetDraft.fact_links[0].source_span_ids],
  };
  delete forgedTargetBody.fact_link_id;
  forgedTargetDraft.fact_links[0] = {
    ...forgedTargetBody,
    fact_link_id: contentId('PRODUCT_FACT_LINK/V2', forgedTargetBody),
  };
  assert.throws(() => validateAgreementDraft(forgedTargetDraft, {
    sourceDocument, agreementStructure, legalSchema,
  }), /DRAFT_FACT_LINK_SOURCE/);

  const wrongClosureDraft = structuredClone(draft);
  const wrongClosureBody = {
    ...wrongClosureDraft.fact_links[0],
    source_closure_id: to.source_closure_id,
    source_span_ids: [...to.source_span_ids],
    target_source_span_ids: [...to.source_span_ids],
  };
  delete wrongClosureBody.fact_link_id;
  wrongClosureDraft.fact_links[0] = {
    ...wrongClosureBody,
    fact_link_id: contentId('PRODUCT_FACT_LINK/V2', wrongClosureBody),
  };
  assert.throws(() => validateAgreementDraft(wrongClosureDraft, {
    sourceDocument, agreementStructure, legalSchema,
  }), /DRAFT_FACT_LINK_CLOSURE/);

  let review = initialiseReviewState({ ...draft, kind: 'draftAnalysis' });
  const relationship = review.items.find((item) => item.source_id === link.fact_link_id);
  assert.equal(relationship.source_closure_id, link.source_closure_id);
  assert.deepEqual(relationship.source_span_ids, link.source_span_ids);
  review = applyReviewCommand(review, {
    type: 'UPSERT_RELATIONSHIP', item_id: relationship.item_id,
    from_item_id: review.items.find((item) => item.source_id === from.proposal_id).item_id,
    to_item_id: review.items.find((item) => item.source_id === to.proposal_id).item_id,
    relationship_type: 'REQUIRES', source_closure_id: link.source_closure_id,
    source_span_ids: link.source_span_ids,
  }, { analysis: { ...draft, kind: 'draftAnalysis' }, legalSchema });
  assert.equal(review.items.find((item) => item.item_id === relationship.item_id).decision, 'EDITED');
});

test('draft finalisation stages V2 relationship evidence before finalisation', async () => {
  const value = fixture();
  const resolved = resolveCrossSectionRelationshipCandidates({
    candidates: [value.candidate], proposals: value.proposals, spans: value.spans,
    sourceClosures: value.sourceClosures, legalSchema,
  });
  const calls = [];
  const client = {
    from: () => ({}),
    rpc: async (name, parameters) => {
      calls.push({ name, parameters });
      return { data: { ok: true }, error: null };
    },
  };
  const draft = {
    draft_analysis_id: '0'.repeat(64), source_document_id: '2'.repeat(64),
    agreement_structure_id: '4'.repeat(64), legal_schema_version: 'LEGAL_SCHEMA/V1',
    totals: {}, sections: [], residual_passes: [], model_calls: [],
    source_closures: value.sourceClosures, spans: value.spans,
    section_routings: [], proposition_groups: [], proposals: value.proposals,
    fact_links: resolved.links,
    issues: [{
      code: 'CROSS_SECTION_RELATIONSHIP_UNRESOLVED', source_span_ids: [fullSectionSpanId],
    }],
    coverage_assertions: [],
  };
  const unrelatedSpan = span('5'.repeat(64), node73, 600, 700, 'x'.repeat(100));
  draft.spans.push(unrelatedSpan);
  draft.source_closures[1].spans.push(unrelatedSpan);
  const staging = crossSectionRelationshipStagingInput(draft);
  assert.deepEqual(staging.links, resolved.links);
  assert.ok(staging.spans.some((item) => item.span_id === targetLocatorSpanId));
  assert.ok(staging.spans.some((item) => item.span_id === fullSectionSpanId));
  assert.ok(staging.source_closure_spans.some((item) => (
    item.source_closure_id === closure73 && item.span_id === targetLocatorSpanId
  )));
  assert.ok(!staging.spans.some((item) => item.span_id === unrelatedSpan.span_id));
  assert.ok(!staging.source_closure_spans.some((item) => item.span_id === unrelatedSpan.span_id));

  await new ProductPhase2Store({ client }).finalizeDraft({ runId: 'run', draft });
  assert.deepEqual(calls.map((call) => call.name), [
    'product_phase2_stage_cross_section_relationships',
    'product_phase2_finalize_saved_run',
  ]);
  assert.deepEqual(calls[0].parameters.p_staging, staging);
});
