'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const legalSchema = require('../contracts/product/legal-schema.v1.json');
const { buildAgreementDraft, validateAgreementDraft } = require('../lib/product/agreement-draft');
const { buildAgreementStructure } = require('../lib/product/agreement-structure');
const { REGISTERED_FAMILY_KEYS } = require('../lib/product/family-taxonomy');
const { callKey, createRecordedModelAdapter } = require('../lib/product/model-adapter');
const { activeExtractionFromProviderEvidence, adaptRecordedFamilyResponse } = require('../lib/product/provider-recording-adapter');
const { initialiseReviewState, applyReviewCommand } = require('../lib/product/review-state');
const { buildReviewView } = require('../lib/product/review-view');
const { createSecIntakeAdapter } = require('../lib/product/sec-intake');
const { substantiveSections } = require('../lib/product/source-context');

const ROOT = path.resolve(__dirname, '..');
const MODIV_URL = 'https://www.sec.gov/Archives/edgar/data/1645873/000114036126018656/ef20072329_ex2-1.htm';
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function providerResponse(entry, fallbackSourceText) {
  const source = readJson(entry.path);
  assert.equal(source.schema_version, entry.source_schema);
  if (entry.source_schema === 'NATIVE_PRODUCER_RECORDED_RESPONSE/V1') {
    return { raw: source.raw_response_text, model: source.model, sourceText: fallbackSourceText };
  }
  assert.match(entry.source_schema, /^NATIVE_PRODUCER_RECORDED_RUN\/V[123]$/);
  const call = source.calls[entry.call_index];
  assert.ok(call.request_key);
  const prompt = call.request_messages.map((message) => typeof message.content === 'string' ? message.content : '').join('\n');
  const marker = prompt.lastIndexOf('SOURCE TEXT');
  assert.notEqual(marker, -1, entry.path);
  const lineEnd = prompt.indexOf('\n', marker);
  assert.notEqual(lineEnd, -1, entry.path);
  return { raw: call.raw_response_text, model: source.provider_model_id || source.model, sourceText: prompt.slice(lineEnd + 1).replace(/^\s*\n/, '') };
}

async function modivSource() {
  const raw = fs.readFileSync(path.join(ROOT, 'tests/fixtures/canonical-v2/mae-definition-family/modiv-raw-fetched.htm'));
  return createSecIntakeAdapter({
    fetchImpl: async () => ({
      status: 200,
      url: MODIV_URL,
      headers: new Headers({ 'content-type': 'text/html', 'content-length': String(raw.length) }),
      body: null,
      arrayBuffer: async () => raw,
    }),
    clock: () => new Date('2026-09-05T12:00:00Z'),
  }).intake({ url: MODIV_URL });
}

function analysisFromDraft(draft, sourceDocument, agreementStructure) {
  const closureIds = new Map();
  for (const closure of draft.source_closures) for (const span of closure.spans) {
    if (!closureIds.has(span.span_id)) closureIds.set(span.span_id, []);
    closureIds.get(span.span_id).push(closure.source_closure_id);
  }
  return {
    schema_version: 'AGREEMENT_ANALYSIS_READ/V1',
    kind: 'draftAnalysis',
    analysis_run_id: '00000000-0000-4000-8000-000000000004',
    draft_analysis_id: draft.draft_analysis_id,
    source_document: sourceDocument,
    agreement_structure: agreementStructure,
    sections: draft.section_routings,
    residual_passes: draft.residual_passes,
    model_calls: draft.model_calls,
    source_closures: draft.source_closures,
    spans: draft.spans.map((span) => ({ ...span, source_closure_ids: closureIds.get(span.span_id) || [] })),
    proposals: draft.proposals,
    proposition_groups: draft.proposition_groups,
    fact_links: draft.fact_links,
    issues: draft.issues,
    coverage_assertions: draft.coverage_assertions,
  };
}

test('all 25 legal contracts supersede the audited producer prompt gaps with reusable B validator roles', () => {
  assert.deepEqual(legalSchema.families.map((family) => family.family_key).sort(), [...REGISTERED_FAMILY_KEYS].sort());
  assert.equal(legalSchema.families.every((family) => family.state === 'DEFINED'), true);
  for (const family of legalSchema.families) {
    assert.ok(family.required_fact_types.length > 0, family.family_key);
    assert.ok(family.subtypes.every((subtype) => subtype.required_roles.length > 0), family.family_key);
    assert.equal(family.prompt_audit.status, 'CONTRACT_SUPERSEDES_PROMPT_OUTPUT_GAPS');
    assert.ok(fs.existsSync(path.join(ROOT, family.prompt_audit.source_prompt)), family.prompt_audit.source_prompt);
    assert.deepEqual(new Set(family.prompt_audit.gaps_filled), new Set([
      'ATOMIC_FACT_STATEMENT', 'EXACT_SOURCE_SPANS', 'REQUIRED_ROLE_COVERAGE',
      'TYPED_RELATIONSHIPS', 'FOUR_STATE_ABSENCE',
    ]));
  }
});

test('actual provider responses for all 25 families pass their real response shaper and exact active-contract adapter', async () => {
  const fixture = readJson('tests/fixtures/product/provider-family-recordings.v1.json');
  assert.equal(fixture.recordings.length, 25);
  const modiv = await modivSource();
  const evidence = [];
  for (const entry of fixture.recordings) {
    const recorded = providerResponse(entry, modiv.canonical_text);
    assert.equal(typeof recorded.model, 'string');
    assert.ok(recorded.raw.length > 20, entry.family_key);
    const item = adaptRecordedFamilyResponse({
      familyKey: entry.family_key,
      legalContract: legalSchema.families.find((family) => family.family_key === entry.family_key),
      rawResponse: recorded.raw,
      sourceText: recorded.sourceText,
      sourceRecording: entry.path,
    });
    assert.equal(item.adapter_family, entry.family_key);
    assert.match(item.source_text_sha256, /^[0-9a-f]{64}$/);
    assert.equal(item.mapped_proposal_count + item.unmapped_proposal_count, item.native_proposal_count);
    assert.equal(item.proposals.every((proposal) => proposal.exact_quote === null || recorded.sourceText.includes(proposal.exact_quote)), true, entry.family_key);
    evidence.push(item);
  }
  for (const item of evidence) {
    assert.ok(item.native_proposal_count + item.residual_count > 0, item.family_key);
    assert.equal(item.proposals.every((proposal) => proposal.exact_quote === null || recordedQuoteIsExact(proposal.exact_quote)), true, item.family_key);
    if (item.mapped_proposal_count === 0) {
      assert.ok(item.incompatibilities.length > 0, item.family_key);
      assert.equal(item.incompatibilities.every((problem) => typeof problem.code === 'string'), true);
    } else {
      assert.equal(item.proposals.filter((proposal) => proposal.active_mapping).every((proposal) => {
        const contract = legalSchema.families.find((family) => family.family_key === item.family_key);
        return contract.required_fact_types.includes(proposal.active_mapping.fact_type)
          && contract.subtypes.some((subtype) => subtype.subtype_key === proposal.active_mapping.subtype_key);
      }), true, item.family_key);
    }
  }
});

function recordedQuoteIsExact(quote) { return typeof quote === 'string' && quote.length > 0; }

test('paragraph residuals are UTF-8 exact, ordered, source-linked and visible in Review', async () => {
  const canonicalText = [
    'AGREEMENT AND PLAN OF MERGER', '', 'ARTICLE I', 'COVENANTS', '',
    'Section 1.1. Operational promises.',
    'Buyer shall provide café records.',
    'The parties shall use a novel orbital remedy.',
  ].join('\n');
  const sourceDocument = {
    schema_version: 'SOURCE_DOCUMENT/V1', source_document_id: sha256('phase4-residual'),
    canonical_text: canonicalText, canonical_text_sha256: sha256(canonicalText), retrieval_url: MODIV_URL,
    final_url: MODIV_URL, filing_accession: '0000000000-00-000001', exhibit_filename: 'test.htm', source_map_id: sha256('map'),
  };
  const agreementStructure = buildAgreementStructure({ agreement_id: sourceDocument.source_document_id, canonical_text: canonicalText, canonical_text_sha256: sourceDocument.canonical_text_sha256 });
  const model = {
    async complete({ call_kind: kind, request }) {
      let response;
      if (kind === 'ROUTING') response = {
        families: [], disposition: 'IMMATERIAL', rationale: 'No catalogue family selected.',
        deterministic_disagreements: (request.deterministic_family_evidence || []).map((item) => ({ family_key: item.section_family, reason: 'The residual test isolates open-world review.' })),
      };
      else response = { paragraphs: request.paragraphs.map((paragraph, index) => ({
        source_span_id: paragraph.source_span_id,
        disposition: index === request.paragraphs.length - 1 ? 'UNRESOLVED_UNUSUAL_PROVISION' : 'IMMATERIAL',
        family_keys: [],
        rationale: index === request.paragraphs.length - 1 ? 'Novel remedy needs lawyer classification.' : 'No material residual.',
      })) };
      return { provider_id: 'TEST', model_id: 'TEST', response, raw_response: response };
    },
  };
  const draft = await buildAgreementDraft({ sourceDocument, agreementStructure, legalSchema, model });
  validateAgreementDraft(draft, { sourceDocument, agreementStructure, legalSchema });
  assert.ok(draft.totals.residual_paragraphs >= 3);
  const unusual = draft.issues.find((issue) => issue.code === 'UNRESOLVED_UNUSUAL_PROVISION');
  assert.ok(unusual.source_closure_id);
  assert.equal(unusual.source_span_ids.length, 1);
  assert.equal(draft.spans.find((span) => span.span_id === unusual.source_span_ids[0]).exact_text, 'The parties shall use a novel orbital remedy.');
  const analysis = analysisFromDraft(draft, sourceDocument, agreementStructure);
  const state = initialiseReviewState(analysis);
  const item = state.items.find((candidate) => candidate.source_id === unusual.issue_id);
  assert.deepEqual(item.source_span_ids, unusual.source_span_ids);
  const view = buildReviewView({ analysis, review: { state, version: 0 } });
  assert.equal(view.unusual_provision_count, 1);
  assert.equal(view.can_publish, false);
  assert.throws(() => applyReviewCommand({ ...state, items: state.items.map((candidate) => ({ ...candidate, decision: candidate.item_id === item.item_id ? 'UNRESOLVED' : 'REJECTED' })) }, { type: 'PUBLISH' }, { analysis, legalSchema }), /REVIEW_UNRESOLVED_ITEMS/);
  assert.ok(view.sections.flatMap((section) => section.review_items).some((candidate) => candidate.source_id === unusual.issue_id));
  const swapped = { async complete(input) {
    const value = await model.complete(input);
    if (input.call_kind === 'RESIDUAL') value.response.paragraphs.reverse();
    return value;
  } };
  await assert.rejects(
    () => buildAgreementDraft({ sourceDocument, agreementStructure, legalSchema, model: swapped }),
    /RESIDUAL_PARAGRAPH_ORDER/,
  );
});

test('real Modiv SEC source replays through all-family and paragraph-residual interfaces into publishable Review', async (context) => {
  const sourceDocument = await modivSource();
  const manifest = readJson('tests/fixtures/product/modiv-provider-recordings.v1.json');
  assert.equal(manifest.recordings.length, 25);
  const evidence = [];
  const incompatibleResponses = [];
  for (const family of manifest.recordings) for (const relativePath of family.paths) {
    const source = readJson(relativePath);
    const contract = legalSchema.families.find((item) => item.family_key === family.family_key);
    const calls = source.calls || [source];
    for (const call of calls) {
      if (typeof call.raw_response_text !== 'string' || call.raw_response_text.trim().length === 0) continue;
      const prompt = (call.request_messages || []).map((message) => typeof message.content === 'string' ? message.content : '').join('\n');
      const marker = prompt.lastIndexOf('SOURCE TEXT');
      const lineEnd = marker < 0 ? -1 : prompt.indexOf('\n', marker);
      const sourceText = lineEnd < 0 ? sourceDocument.canonical_text : prompt.slice(lineEnd + 1).replace(/^\s*\n/, '');
      try {
        evidence.push(adaptRecordedFamilyResponse({ familyKey: family.family_key, legalContract: contract, rawResponse: call.raw_response_text, sourceText, sourceRecording: relativePath }));
      } catch (error) {
        incompatibleResponses.push({ family_key: family.family_key, path: relativePath, code: error.code });
      }
    }
  }
  assert.equal(new Set(evidence.map((item) => item.family_key)).size, 25);
  assert.equal(incompatibleResponses.every((item) => typeof item.code === 'string'), true);
  assert.ok(evidence.some((item) => item.mapped_proposal_count > 0));
  const agreementStructure = buildAgreementStructure({ agreement_id: sourceDocument.source_document_id, canonical_text: sourceDocument.canonical_text, canonical_text_sha256: sourceDocument.canonical_text_sha256 });
  const captured = [];
  const bootstrap = { async complete(input) {
    let response;
    if (input.call_kind === 'ROUTING') {
      const families = REGISTERED_FAMILY_KEYS.filter((familyKey) => evidence.some((item) => item.family_key === familyKey
        && item.proposals.some((proposal) => proposal.exact_quote && input.request.section.exact_text.includes(proposal.exact_quote))));
      response = { families, disposition: families.length > 0 ? 'FAMILY_ASSIGNED' : 'IMMATERIAL', rationale: 'Actual recorded provider proposals were matched by exact source quote.', deterministic_disagreements: (input.request.deterministic_family_evidence || []).filter((item) => !families.includes(item.section_family)).map((item) => ({ family_key: item.section_family, reason: 'No compatible actual provider proposal has an exact quote in this section.' })) };
    } else if (input.call_kind === 'RESIDUAL') {
      response = { paragraphs: input.request.paragraphs.map((paragraph) => ({ source_span_id: paragraph.source_span_id, disposition: input.request.routed_families.length > 0 ? 'KNOWN_FAMILY' : 'IMMATERIAL', family_keys: input.request.routed_families, rationale: input.request.routed_families.length > 0 ? 'Exact provider evidence routes this paragraph scope to known families.' : 'Full paragraph scope reviewed with no compatible provider observation.' })) };
    } else response = activeExtractionFromProviderEvidence({ evidence, familyContracts: input.request.family_contracts, sourceClosure: input.request.source_closure });
    captured.push({ input, response });
    return { provider_id: 'REPOSITORY_ACTUAL_PROVIDER_RECORDINGS', model_id: 'MIXED_ACTUAL_PROVIDER_MODELS', response, raw_response: response };
  } };
  await buildAgreementDraft({ sourceDocument, agreementStructure, legalSchema, model: bootstrap });
  const recording = { schema_version: 'PRODUCT_MODEL_RECORDING/V1', fixture_kind: 'ACTUAL_PROVIDER_OUTPUT_ADAPTED_TO_PRODUCT_CONTRACTS', calls: captured.map(({ input, response }) => ({ call_key: callKey(input), provider_id: 'REPOSITORY_ACTUAL_PROVIDER_RECORDINGS', model_id: 'MIXED_ACTUAL_PROVIDER_MODELS', raw_response: response })) };
  const model = createRecordedModelAdapter(recording);
  const draft = await buildAgreementDraft({ sourceDocument, agreementStructure, legalSchema, model });
  model.assertExhausted();
  validateAgreementDraft(draft, { sourceDocument, agreementStructure, legalSchema });
  assert.equal(draft.sections.length, substantiveSections(agreementStructure).length);
  assert.equal(draft.residual_passes.length, draft.sections.length);
  assert.ok(draft.totals.residual_paragraphs > draft.sections.length);
  const global = draft.coverage_assertions.filter((item) => item.subject_kind === 'FAMILY');
  assert.equal(global.length, 25);
  assert.equal(global.some((item) => item.state === 'NOT_RUN'), false);
  for (const node of substantiveSections(agreementStructure)) {
    assert.equal(draft.coverage_assertions.filter((item) => item.subject_kind === 'SECTION_FAMILY' && item.structure_node_id === node.node_id).length, 25);
  }
  const routedFamilies = new Set(draft.section_routings.flatMap((routing) => routing.families));
  assert.ok(routedFamilies.size > 0);
  for (const familyKey of routedFamilies) assert.ok(draft.proposals.some((proposal) => proposal.family_key === familyKey)
    || draft.issues.some((issue) => issue.family_key === familyKey && issue.code === 'ACTIVE_CONTRACT_IDENTIFIER_UNMAPPED'), familyKey);
  assert.ok(draft.proposals.length > 0);
  const recordedIncompatibilities = new Set(draft.model_calls.flatMap((call) => call.response.provider_incompatibilities || [])
    .map((item) => `${item.family_key}\u001f${item.message}\u001f${item.source_span_id}`));
  const productIncompatibilities = draft.issues.filter((issue) => issue.code === 'ACTIVE_CONTRACT_IDENTIFIER_UNMAPPED');
  assert.ok(productIncompatibilities.length > 0);
  assert.equal(productIncompatibilities.every((issue) => recordedIncompatibilities.has(`${issue.family_key}\u001f${issue.message}\u001f${issue.source_span_ids[0]}`)), true);
  const contextOnlyProposals = draft.proposals.filter((proposal) => proposal.source_span_ids.length === 0
    && proposal.context_only_evidence?.length > 0);
  for (const proposal of contextOnlyProposals) {
    const closure = draft.source_closures.find((item) => item.source_closure_id === proposal.source_closure_id);
    const owned = closure.spans.find((span) => span.span_id === closure.full_section_span_id);
    assert.equal(proposal.context_only_evidence.some((evidenceItem) => owned.exact_text.includes(evidenceItem.quote)), false);
  }
  const analysis = analysisFromDraft(draft, sourceDocument, agreementStructure);
  let state = initialiseReviewState(analysis);
  for (const item of state.items.filter((candidate) => candidate.decision === 'PENDING')) {
    state = applyReviewCommand(state, {
      type: 'DECIDE_ITEM', item_id: item.item_id,
      decision: item.kind === 'PROPOSAL' && item.original.validation_status !== 'VALID' ? 'REJECTED' : 'ACCEPTED',
    }, { analysis, legalSchema });
  }
  state = applyReviewCommand(state, { type: 'CONFIRM_AGREEMENT_COVERAGE', confirmed: true }, { analysis, legalSchema });
  state = applyReviewCommand(state, { type: 'PUBLISH' }, { analysis, legalSchema });
  assert.equal(state.status, 'PUBLISHED');
  assert.equal(state.summary.families.length, 25);
  const validProposals = draft.proposals.filter((proposal) => proposal.validation_status === 'VALID');
  const rejectedProposals = state.items.filter((item) => item.kind === 'PROPOSAL' && item.decision === 'REJECTED');
  const publishedFacts = state.summary.families.flatMap((family) => family.facts);
  assert.ok(publishedFacts.length > 0);
  assert.equal(publishedFacts.length, validProposals.length);
  context.diagnostic(`MODIV_PROVIDER_REPLAY proposed=${draft.proposals.length} valid=${validProposals.length} rejected=${rejectedProposals.length} published=${publishedFacts.length}`);
  for (const item of rejectedProposals) {
    const proposal = item.original;
    const family = legalSchema.families.find((candidate) => candidate.family_key === proposal.family_key);
    const subtype = family.subtypes.find((candidate) => candidate.subtype_key === proposal.subtype_key);
    const missingRoles = subtype.required_roles.filter((role) => proposal.roles[role] === undefined
      || proposal.roles[role] === null || proposal.roles[role] === '');
    const reasons = [proposal.source_span_ids.length === 0 ? 'NO_OWNED_EXACT_SOURCE' : null,
      proposal.unmatched_evidence?.length ? 'UNMATCHED_EVIDENCE' : null,
      missingRoles.length ? `MISSING_ROLES:${missingRoles.join(',')}` : null].filter(Boolean);
    context.diagnostic(`MODIV_REJECTED family=${proposal.family_key} fact_type=${proposal.fact_type} reasons=${reasons.join('|') || 'VALUE_OR_CONTRACT_VALIDATION'}`);
  }
});
