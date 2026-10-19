'use strict';

process.env.PRODUCT_PHASE2_HELPER_ONLY = '1';

const assert = require('node:assert/strict');
const test = require('node:test');
const { buildAgreementStructure } = require('../lib/product/agreement-structure');
const {
  FACT_BUDGET_BYTES_PER_FACT, buildAgreementSectionDraft, definedTermOf, deterministicRoutingDecision, directDefinitionSpanIds, factBudgetFor, listedClosureSpanIds, normaliseLeanResponse,
} = require('../lib/product/agreement-draft');
const { ABLATION_VARIANTS, variantAvailability } = require('../lib/product/cost-ablation');
const { CLAUDE_CLI_PROVIDER_ID, REQUEST_PROFILES } = require('../lib/product/product-model-config');
const { substantiveSections } = require('../lib/product/source-context');
const { conchoSource, createSyntheticConchoModel } = require('./product-phase-2.test.js');
const schemaV2 = require('../contracts/product/legal-schema.v2.json');

// Work package E3 part 2 (plan finding (185)), Ben's brief (finding (177)):
// "It can experiment, tear up ideas etc. cone at completely fresh". The
// experiments that need no new model behaviour, behind request-profile
// flags: the routing from the words, the definitions the section uses,
// the fact budget.

test('deterministic routing decides only from the heading rules and anchoring defined terms, never from an AI classification or nothing', () => {
  assert.deepEqual(deterministicRoutingDecision([{ section_family: 'NO_SHOP', provenance: 'SECTION_FAMILY_RULE_CLASSIFIED' }]).response, {
    families: ['NO_SHOP'], disposition: 'FAMILY_ASSIGNED', rationale: 'Deterministic: NO_SHOP by SECTION_FAMILY_RULE_CLASSIFIED.', deterministic_disagreements: [],
  });
  assert.deepEqual(deterministicRoutingDecision([{ section_family: 'MAE_DEFINITION', provenance: 'SECTION_FAMILY_DEFINED_TERM_ANCHORED' }, { section_family: 'REPRESENTATIONS', provenance: 'SECTION_FAMILY_RULE_CLASSIFIED' }]).response.families, ['MAE_DEFINITION', 'REPRESENTATIONS']);
  assert.equal(deterministicRoutingDecision([]), null, 'no evidence: the model routes');
  assert.equal(deterministicRoutingDecision([{ section_family: 'NO_SHOP', provenance: 'SECTION_FAMILY_AI_CLASSIFIED' }]), null);
  assert.equal(deterministicRoutingDecision([{ section_family: 'NO_SHOP', provenance: 'SECTION_FAMILY_RULE_CLASSIFIED' }, { section_family: 'TERMINATION', provenance: 'SECTION_FAMILY_AI_CLASSIFIED' }]), null, 'one uncertain family and the model routes the whole section');
});

test('the defined term of a definition paragraph, the direct definitions of a section, and the fact budget', () => {
  assert.equal(definedTermOf('"Takeover Proposal" means any proposal'), 'Takeover Proposal');
  assert.equal(definedTermOf('(a) “Closing Date” shall mean the date'), 'Closing Date');
  assert.equal(definedTermOf('Section 8.3 Definitions. The following terms'), null);
  const defs = [{ span_id: 'a', exact_text: '"Takeover Proposal" means x' }, { span_id: 'b', exact_text: '"Superior Proposal" means y' }, { span_id: 'c', exact_text: 'no readable term' }, { span_id: 'd', exact_text: '"Proposal" means z' }];
  assert.deepEqual([...directDefinitionSpanIds('the Company may furnish information to a Person that has made a Takeover Proposal', defs)], ['a', 'c', 'd'], 'a used term, an unreadable paragraph (kept), and a term that is a word of another term');
  assert.deepEqual([...directDefinitionSpanIds('nothing defined here', defs)], ['c']);
  assert.equal(FACT_BUDGET_BYTES_PER_FACT, 290);
  assert.deepEqual(factBudgetFor(8578), { operative_bytes: 8578, expected: 30, ceiling: 63, basis: factBudgetFor(8578).basis });
  assert.equal(factBudgetFor(100).expected, 1);
  assert.equal(factBudgetFor(100).ceiling, 5);
});

function leanAnswer(request, copies = 1) {
  const family = request.family_contracts.find((item) => item.family_key === 'NO_SHOP');
  const subtype = family.subtypes[0];
  const operative = request.source_closure.operative[0];
  const sentence = operative.exact_text.split(/(?<=\.)\s+/)[0];
  const proposals = [];
  const groups = [];
  for (let index = 1; index <= copies; index += 1) {
    groups.push({ client_ref: `g${index}`, family_key: 'NO_SHOP', subtype_key: subtype.subtype_key });
    proposals.push({
      client_ref: `p${index}`, group_ref: `g${index}`, family_key: 'NO_SHOP', subtype_key: subtype.subtype_key, fact_type: family.required_fact_types[0], statement: sentence,
      headline: { label: subtype.label || subtype.subtype_key, distinguishing_refs: [`c${index}`], summary: 'The no-shop covenant' },
      components: [{ ref: `c${index}`, kind: 'OPERATION', label: 'the covenant', quote: sentence, source_span_id: operative.span_id, occurrence: 0, origin: 'OWN', gap_before: false, children: [] }],
    });
  }
  return { proposals, groups, links: [], coverage: Object.fromEntries(Object.keys(request.response_contract.allowed_fact_types_by_family).map((key) => [key, key === 'NO_SHOP' ? 'FOUND' : 'NOT_FOUND'])) };
}

async function runConcho63(profile, { copies = 1 } = {}) {
  const sourceDocument = await conchoSource();
  const agreementStructure = buildAgreementStructure(sourceDocument);
  const node = substantiveSections(agreementStructure).find((item) => item.reference === '6.3');
  const synthetic = createSyntheticConchoModel();
  const seen = [];
  const model = { async complete(input) {
    seen.push(input);
    if (input.call_kind !== 'EXTRACTION') return synthetic.complete(input);
    const response = leanAnswer(input.request, copies);
    return { provider_id: 'SYNTHETIC', model_id: 'FRESH/V1', raw_request: input.request, raw_response: response, response, input_tokens: 10, output_tokens: 5, cost_microusd: 0, duration_ms: 1 };
  } };
  const result = await buildAgreementSectionDraft({ sourceDocument, agreementStructure, legalSchema: schemaV2, model, node, requestProfile: profile });
  return { result, seen, sourceDocument };
}

test('routing_mode deterministic_first routes Concho 6.3 (No Solicitation) from its heading with no routing call; the residual and the extraction run as before', async () => {
  const { result, seen } = await runConcho63({ ...REQUEST_PROFILES.DEFAULT, routing_mode: 'deterministic_first' });
  assert.deepEqual(seen.map((input) => input.call_kind), ['RESIDUAL', 'EXTRACTION'], 'no ROUTING call');
  assert.equal(result.routing.routing_source, 'DETERMINISTIC');
  assert.equal(result.routing.model_call_id, null);
  assert.deepEqual(result.routing.families, ['NO_SHOP']);
  assert.equal(result.routing.disposition, 'FAMILY_ASSIGNED');
  // model_calls is sorted by model_call_id, a content hash: the kinds, not their order, are pinned.
  assert.deepEqual(result.model_calls.map((call) => call.call_kind).sort(), ['EXTRACTION', 'RESIDUAL']);
  const note = result.issues.find((issue) => issue.code === 'ROUTING_DETERMINISTIC');
  assert.ok(note, 'the section says the words routed it');
  assert.deepEqual(JSON.parse(note.message).families, ['NO_SHOP']);
  assert.equal(result.proposals.length, 1);
  assert.equal(result.proposals[0].validation_status, 'VALID', JSON.stringify(result.issues.map((issue) => [issue.code, issue.message]).slice(0, 6)));
  // The section's own coverage is the routing's: no call behind it; the per-family coverage the extraction writes keeps the extraction call.
  assert.ok(result.coverage.some((item) => item.subject_kind === 'SECTION' && item.model_call_id === null));
  // Without the flag the routing call is made and the routing is the model's.
  const plain = await runConcho63(REQUEST_PROFILES.DEFAULT);
  assert.deepEqual(plain.seen.map((input) => input.call_kind), ['ROUTING', 'RESIDUAL', 'EXTRACTION']);
  assert.equal(plain.result.routing.routing_source, undefined);
});

test('definitions_scope direct sends whole only the definitions the section\'s own words use and lists the rest by first words', async () => {
  const { result, seen } = await runConcho63({ ...REQUEST_PROFILES.DEFAULT, definitions_scope: 'direct' });
  const extraction = seen.find((input) => input.call_kind === 'EXTRACTION');
  const definitions = extraction.request.source_closure.definitions;
  const whole = definitions.filter((span) => span.exact_text);
  const listed = definitions.filter((span) => span.text_in === 'agreement block');
  assert.ok(definitions.length > 0);
  assert.ok(whole.length > 0, 'the terms the section uses go whole');
  assert.equal(whole.length + listed.length, definitions.length);
  const own = extraction.request.source_closure.full_section.exact_text;
  for (const span of whole) {
    const term = definedTermOf(span.exact_text);
    if (term) assert.ok(own.includes(term), `${term} is in the section's own words`);
  }
  for (const span of listed) {
    const term = definedTermOf(span.exact_text) || definedTermOf(span.first_words);
    assert.ok(typeof span.first_words === 'string' && span.first_words.length > 0);
    if (term) assert.ok(!new RegExp(`(^|[^A-Za-z])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z])`).test(own), `${term} is not in the section's own words`);
  }
  assert.equal(result.proposals[0].validation_status, 'VALID');
  const control = await runConcho63(REQUEST_PROFILES.DEFAULT);
  assert.equal(control.seen.find((input) => input.call_kind === 'EXTRACTION').request.source_closure.definitions.filter((span) => span.exact_text).length, definitions.length, 'without the flag every definition goes whole');
  // A definition the section never names is listed, not sent: the rule on a closure with one transitive definition.
  const { leanClosureForModel } = require('../lib/product/agreement-draft');
  const shaped = leanClosureForModel({
    operative: [], chapeau: [], cross_references: [], full_section: { span_id: 'f', exact_text: 'The Company shall not solicit any Takeover Proposal.' },
    definitions: [{ span_id: 'd1', structure_node_id: 'n', kind: 'DEFINITION', start_byte: 0, end_byte: 10, exact_text: '"Takeover Proposal" means an offer from a Person' }, { span_id: 'd2', structure_node_id: 'n', kind: 'DEFINITION', start_byte: 20, end_byte: 30, exact_text: '"Person" means an individual or entity' }],
  }, { aliases: null, cachedAgreement: false, directDefinitions: true, nodesById: new Map() });
  assert.equal(shaped.definitions[0].exact_text, '"Takeover Proposal" means an offer from a Person');
  assert.equal(shaped.definitions[1].text_in, 'agreement block');
  assert.equal(shaped.definitions[1].exact_text, undefined);
});

test('fact_budget puts the section\'s budget in the request as a check, and an answer past the ceiling is a note, never a hold', async () => {
  const { result, seen } = await runConcho63({ ...REQUEST_PROFILES.DEFAULT, fact_budget: true });
  const extraction = seen.find((input) => input.call_kind === 'EXTRACTION');
  const budget = extraction.request.fact_budget;
  assert.ok(budget.operative_bytes > 0 && budget.expected >= 1 && budget.ceiling === budget.expected * 2 + 3);
  assert.match(extraction.request.scope_instruction, /a check, not a target/);
  assert.equal(result.issues.find((issue) => issue.code === 'FACT_BUDGET_EXCEEDED'), undefined);
  const over = await runConcho63({ ...REQUEST_PROFILES.DEFAULT, fact_budget: true }, { copies: budget.ceiling + 1 });
  const note = over.result.issues.find((issue) => issue.code === 'FACT_BUDGET_EXCEEDED');
  assert.ok(note, 'the note');
  assert.equal(JSON.parse(note.message).proposals, budget.ceiling + 1);
  assert.equal(note.kind, 'NOTE');
  assert.ok(over.result.proposals.length >= 1, 'the facts are compiled as the validator sees them, not cut to the budget');
});

test('the fresh-sheet rungs are on the ladder and the CLI can run the deterministic ones', () => {
  for (const name of ['default', 'deterministic_routing', 'direct_definitions', 'fact_budget', 'anchors_sonnet55']) assert.ok(ABLATION_VARIANTS[name], name);
  assert.deepEqual(ABLATION_VARIANTS.deterministic_routing.replay, ['ROUTING', 'RESIDUAL', 'EXTRACTION'], 'no call: the stored answers route where the words do not');
  assert.equal(ABLATION_VARIANTS.deterministic_routing.profile.routing_mode, 'deterministic_first');
  assert.equal(ABLATION_VARIANTS.direct_definitions.profile.definitions_scope, 'direct');
  assert.equal(ABLATION_VARIANTS.fact_budget.profile.fact_budget, true);
  for (const name of ['default', 'deterministic_routing', 'direct_definitions', 'fact_budget', 'anchors_sonnet55']) assert.equal(variantAvailability(ABLATION_VARIANTS[name], CLAUDE_CLI_PROVIDER_ID).runnable, true, name);
  // Finding (186): on the CLI the all-families block becomes the routed families' contracts; the API keeps it.
  const { profileForProvider } = require('../lib/product/cost-ablation');
  assert.equal(profileForProvider(ABLATION_VARIANTS.default.profile, CLAUDE_CLI_PROVIDER_ID).contracts_scope, 'routed');
  assert.equal(profileForProvider(ABLATION_VARIANTS.default.profile, 'ANTHROPIC_API').contracts_scope, 'all');
  assert.match(variantAvailability(ABLATION_VARIANTS.default, CLAUDE_CLI_PROVIDER_ID).notes.join(' '), /routed families' contracts are sent/);
});

// Plan finding (187): a component that cites a span the request listed
// without its text (a transitive definition under direct_definitions, a
// cross-reference under trimmed) and whose anchors or quote the span does
// not hold resolves to the whole span, never to a hold; the count is in
// the section's note.
test('a component on a listed span resolves to the span when its words cannot, and the listed set follows the same rules as the request', () => {
  const text = 'Section 5.17. The Company shall comply with Section 8.3 absent a Material Adverse Effect. "Material Adverse Effect" means any event that is materially adverse to the Company.';
  const at = (needle) => Buffer.byteLength(text.slice(0, text.indexOf(needle)), 'utf8');
  const own = { span_id: 's1', structure_node_id: 'n1', kind: 'OPERATIVE', start_byte: 0, end_byte: at('"Material'), exact_text: text.slice(0, text.indexOf('"Material')) };
  const def = { span_id: 'd1', structure_node_id: 'n2', kind: 'DEFINITION', start_byte: at('"Material'), end_byte: Buffer.byteLength(text, 'utf8'), exact_text: text.slice(text.indexOf('"Material')) };
  const spansById = new Map([[own.span_id, own], [def.span_id, def]]);
  const sourceDocument = { canonical_text: text };
  const answer = { proposals: [{ client_ref: 'p', components: [
    { ref: 'a', kind: 'OPERATION', quote: 'shall comply with', source_span_id: 's1', occurrence: 0, origin: 'OWN', children: [] },
    { ref: 'b', kind: 'DEFINED_TERM', quote_from: 'means any event', quote_to: 'adverse to everyone', source_span_id: 'd1', occurrence: 0, origin: 'DEFINITION', children: [] },
    { ref: 'c', kind: 'QUALIFIER', quote: 'words the span does not hold', source_span_id: 'd1', occurrence: 0, origin: 'DEFINITION', children: [] },
    { ref: 'd', kind: 'QUALIFIER', quote: 'materially adverse', source_span_id: 'd1', occurrence: 0, origin: 'DEFINITION', children: [] },
  ] }], groups: [], links: [] };
  const { response, stats } = normaliseLeanResponse(answer, { anchors: true, sourceDocument, spansById, listedSpanIds: new Set(['d1']) });
  const [a, b, c, d] = response.proposals[0].components;
  assert.equal(a.quote, 'shall comply with', 'an own-span component is untouched');
  assert.equal(b.quote, def.exact_text, 'anchors the listed span does not hold: the whole span');
  assert.equal(b.quote_resolved_from, 'listed_span');
  assert.equal(c.quote, def.exact_text, 'a quote the listed span does not hold: the whole span');
  assert.equal(d.quote, 'materially adverse', 'a quote the listed span holds stays');
  assert.equal(stats.listed_spans_resolved, 2);
  assert.equal(stats.anchors_unresolved, 0);
  // Without the listed set the same answer loses component b (unresolved anchors) and c is left for the validator to hold.
  const plain = normaliseLeanResponse(answer, { anchors: true, sourceDocument, spansById });
  assert.equal(plain.response.proposals[0].components[1].quote, undefined);
  assert.equal(plain.stats.anchors_unresolved, 1);
  // The listed set follows the request's rules.
  const closureForModel = { operative: [own], chapeau: [], full_section: own, definitions: [def, { span_id: 'd2', structure_node_id: 'n3', kind: 'DEFINITION', start_byte: 0, end_byte: 1, exact_text: '"Person" means anyone' }], cross_references: [{ span_id: 'x1', structure_node_id: 'n83', kind: 'CROSS_REFERENCE', start_byte: 0, end_byte: 1, exact_text: 'Section 8.3 text' }, { span_id: 'x2', structure_node_id: 'n99', kind: 'CROSS_REFERENCE', start_byte: 0, end_byte: 1, exact_text: 'Section 9.9 text' }] };
  const nodesById = new Map([['n83', { reference: '8.3' }], ['n99', { reference: '9.9' }]]);
  assert.deepEqual([...listedClosureSpanIds(closureForModel, { cachedAgreement: false, nodesById })], []);
  assert.deepEqual([...listedClosureSpanIds(closureForModel, { cachedAgreement: false, directDefinitions: true, nodesById })], ['d2'], 'the section names Material Adverse Effect, not Person');
  assert.deepEqual([...listedClosureSpanIds(closureForModel, { cachedAgreement: false, trimmed: true, nodesById })], ['x2'], 'the section names Section 8.3, not 9.9');
  assert.deepEqual([...listedClosureSpanIds(closureForModel, { cachedAgreement: true, nodesById })].sort(), ['d1', 'd2', 'x1', 'x2']);
});

// Plan finding (190): the two levers behind the lean profile that spend the
// fewest new model behaviours for the most tokens. The statement the model
// wrote is the OWN components' words said again; the residual question is
// a second pass over the same paragraphs the extraction already reads.

function mergedAnswer(request, { statement = true } = {}) {
  const answer = leanAnswer(request);
  if (!statement) for (const proposal of answer.proposals) delete proposal.statement;
  if (Array.isArray(request.residual_paragraphs)) {
    answer.paragraph_dispositions = request.residual_paragraphs.map((paragraph) => ({
      source_span_id: paragraph.source_span_id, disposition: 'KNOWN_FAMILY', family_keys: ['NO_SHOP'], rationale: 'Covered by the no-shop covenant.',
    }));
  }
  return answer;
}

async function runConcho63Merged(profile, { statement = true, widen = null, longSectionSplit = null } = {}) {
  const sourceDocument = await conchoSource();
  const agreementStructure = buildAgreementStructure(sourceDocument);
  const node = substantiveSections(agreementStructure).find((item) => item.reference === '6.3');
  const synthetic = createSyntheticConchoModel();
  const seen = [];
  const model = { async complete(input) {
    seen.push(input);
    if (input.call_kind !== 'EXTRACTION') return synthetic.complete(input);
    const response = mergedAnswer(input.request, { statement });
    if (widen && Array.isArray(response.paragraph_dispositions) && response.paragraph_dispositions.length > 0) {
      response.paragraph_dispositions[response.paragraph_dispositions.length - 1] = { ...response.paragraph_dispositions[response.paragraph_dispositions.length - 1], family_keys: [widen] };
    }
    return { provider_id: 'SYNTHETIC', model_id: 'FRESH/V1', raw_request: input.request, raw_response: response, response, input_tokens: 10, output_tokens: 5, cost_microusd: 0, duration_ms: 1 };
  } };
  const result = await buildAgreementSectionDraft({ sourceDocument, agreementStructure, legalSchema: schemaV2, model, node, requestProfile: profile, longSectionSplit });
  return { result, seen };
}

test('statement_mode derived: the model writes no statement and the code derives it from the OWN components in source order', async () => {
  const { result, seen } = await runConcho63Merged({ ...REQUEST_PROFILES.DEFAULT, statement_mode: 'derived' }, { statement: false });
  const extraction = seen.find((input) => input.call_kind === 'EXTRACTION');
  assert.equal(extraction.request.response_contract.proposals[0].statement, undefined, 'the contract asks for no statement');
  assert.match(extraction.request.scope_instruction, /Do not return statement/);
  assert.equal(result.proposals.length, 1);
  const proposal = result.proposals[0];
  assert.equal(proposal.validation_status, 'VALID', JSON.stringify(result.issues.map((issue) => [issue.code, issue.message]).slice(0, 6)));
  // The stored component carries the words as text; the answer's quote was the same words.
  const own = (proposal.components || []).filter((component) => component.origin === 'OWN' || component.origin === undefined);
  assert.ok(own.length > 0);
  assert.equal(proposal.statement, own.map((component) => component.text).join(' '));
  assert.equal(proposal.statement, extraction.request.source_closure.operative[0].exact_text.split(/(?<=\.)\s+/)[0]);
  const note = result.issues.find((issue) => issue.code === 'LEAN_RESPONSE_NORMALISED');
  assert.equal(JSON.parse(note.message).statements_derived, 1);
  // A statement the model does write is kept.
  const written = await runConcho63Merged({ ...REQUEST_PROFILES.DEFAULT, statement_mode: 'derived' }, { statement: true });
  assert.equal(JSON.parse(written.result.issues.find((issue) => issue.code === 'LEAN_RESPONSE_NORMALISED').message).statements_derived, 0);
  // The derivation on a gap and on inherited words.
  const derived = normaliseLeanResponse({ proposals: [{ client_ref: 'p', family_key: 'NO_SHOP', components: [
    { ref: 'a', kind: 'ACTOR', quote: 'the Company', origin: 'OWN', gap_before: false, source_span_id: 's', occurrence: 0 },
    { ref: 'b', kind: 'OPERATION', quote: 'shall not solicit', origin: 'OWN', gap_before: true, source_span_id: 's', occurrence: 0 },
    { ref: 'c', kind: 'DEFINED_TERM', quote: 'any proposal', origin: 'DEFINITION', gap_before: false, source_span_id: 'd', occurrence: 0 },
  ] }] }, { sourceDocument: { canonical_text: '' }, spansById: new Map(), derivedStatement: true });
  assert.equal(derived.response.proposals[0].statement, 'the Company ... shall not solicit');
  assert.equal(derived.response.proposals[0].statement_derived, true);
});

test('residual_mode in_extraction: an unsplit section asks the residual inside its extraction call; the dispositions compile as a residual pass; a family named after the extraction is UNRESOLVED', async () => {
  const profile = { ...REQUEST_PROFILES.DEFAULT, residual_mode: 'in_extraction' };
  const { result, seen } = await runConcho63Merged(profile);
  assert.deepEqual(seen.map((input) => input.call_kind), ['ROUTING', 'EXTRACTION'], 'no RESIDUAL call');
  const extraction = seen.find((input) => input.call_kind === 'EXTRACTION');
  assert.ok(Array.isArray(extraction.request.residual_paragraphs) && extraction.request.residual_paragraphs.length > 0);
  assert.match(extraction.request.residual_instruction, /paragraph_dispositions/);
  assert.ok(Array.isArray(extraction.request.response_contract.paragraph_dispositions));
  assert.deepEqual(result.model_calls.map((call) => call.call_kind).sort(), ['EXTRACTION', 'ROUTING']);
  assert.equal(result.residual_pass.dispositions.length, extraction.request.residual_paragraphs.length);
  assert.ok(result.residual_pass.dispositions.every((item) => item.disposition === 'KNOWN_FAMILY'));
  assert.equal(result.residual_pass.model_call_id, result.model_calls.find((call) => call.call_kind === 'EXTRACTION').model_call_id, 'the extraction call is the residual\'s call');
  const note = result.issues.find((issue) => issue.code === 'RESIDUAL_IN_EXTRACTION');
  assert.ok(note);
  assert.deepEqual(JSON.parse(note.message).widened_after_extraction, []);
  assert.equal(result.proposals[0].validation_status, 'VALID');
  assert.deepEqual(result.routing.families, ['NO_SHOP']);
  // The residual names a family the extraction was not asked for: the
  // routing widens after the fact and the family is UNRESOLVED, not NOT_FOUND.
  const widened = await runConcho63Merged(profile, { widen: 'TERMINATION' });
  assert.deepEqual(widened.result.routing.families, ['NO_SHOP', 'TERMINATION']);
  assert.deepEqual(JSON.parse(widened.result.issues.find((issue) => issue.code === 'RESIDUAL_IN_EXTRACTION').message).widened_after_extraction, ['TERMINATION']);
  assert.ok(widened.result.issues.some((issue) => issue.code === 'RESIDUAL_FAMILY_NOT_EXTRACTED' && issue.family_key === 'TERMINATION'));
  const family = widened.result.coverage.filter((item) => item.subject_kind === 'SECTION_FAMILY' && item.family_key === 'TERMINATION');
  assert.deepEqual(family.map((item) => item.state), ['UNRESOLVED']);
  assert.ok(widened.result.coverage.some((item) => item.subject_kind === 'FACT_TYPE' && item.family_key === 'TERMINATION' && item.state === 'UNRESOLVED'));
  assert.equal(widened.result.proposals[0].validation_status, 'VALID');
  // A section that splits keeps its own residual call: its parts each see some paragraphs.
  const split = await runConcho63Merged(profile, { longSectionSplit: { min_section_bytes: 1000, min_children: 3, group_bytes: 6000 } });
  assert.deepEqual(split.seen.slice(0, 2).map((input) => input.call_kind), ['ROUTING', 'RESIDUAL']);
  assert.ok(split.seen.filter((input) => input.call_kind === 'EXTRACTION').length > 1, 'the section split');
  assert.ok(split.seen.filter((input) => input.call_kind === 'EXTRACTION').every((input) => input.request.residual_paragraphs === undefined));
  assert.ok(!split.result.issues.some((issue) => issue.code === 'RESIDUAL_IN_EXTRACTION'));
});

// Work package E6 (plan finding (191)): the two levers on the tier Ben
// chose ("Sonnet makes sense"), so the confirmation job measures them on
// the model the default is to carry.
test('the Sonnet 5.5 variants of derived_statement and merged_residual carry the same profile flags with claude-sonnet-5-5 at high effort writing the facts', () => {
  const { ESTIMATE_FACTORS } = require('../lib/product/cost-ablation');
  for (const [name, base, flag] of [['derived_statement_sonnet55', 'derived_statement', 'statement_mode'], ['merged_residual_sonnet55', 'merged_residual', 'residual_mode']]) {
    const variant = ABLATION_VARIANTS[name];
    assert.deepEqual(variant.profile, ABLATION_VARIANTS[base].profile, `${name} sends ${base}'s words`);
    assert.equal(variant.profile[flag], ABLATION_VARIANTS[base].profile[flag]);
    assert.deepEqual(variant.models, { EXTRACTION: { model: 'claude-sonnet-5-5', effort: 'high' } });
    assert.deepEqual(variant.replay, ABLATION_VARIANTS[base].replay);
    assert.ok(ESTIMATE_FACTORS[name].output < ESTIMATE_FACTORS[base].output, 'the estimate carries Sonnet\'s measured output ratio');
    assert.deepEqual(variantAvailability(variant, CLAUDE_CLI_PROVIDER_ID), variantAvailability(ABLATION_VARIANTS[base], CLAUDE_CLI_PROVIDER_ID));
  }
  assert.equal(Math.round(ESTIMATE_FACTORS.derived_statement_sonnet55.output * 100), Math.round(0.73 * ESTIMATE_FACTORS.derived_statement.output * 100));
  assert.equal(Math.round(ESTIMATE_FACTORS.merged_residual_sonnet55.output * 100), Math.round(0.73 * ESTIMATE_FACTORS.merged_residual.output * 100));
});
