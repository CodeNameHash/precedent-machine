'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const {
  GATE_METRICS, assertNoUnexplainedRise, bytesSentHistogram, callUsage, ledgerFromRows, pipelineRequestOf, renderLedger, timeline,
} = require('../lib/product/extraction-cost-ledger');

// Work package E1 (implementer E): the ledger from stored rows, on a small
// run in the API provider's stored shape (two text blocks, usage with the
// cache split), with a failed attempt, a split section and a recorded
// failure response, and the gate on its metrics.

const RUN = '11111111-2222-4333-8444-555555555555';
const ATTEMPT_A = 'aaaaaaaa-0000-4000-8000-000000000001';
const ATTEMPT_B = 'bbbbbbbb-0000-4000-8000-000000000002';
const ATTEMPT_B_FAILED = 'bbbbbbbb-0000-4000-8000-000000000003';

function invocation(token, kind) {
  return sha256Hex(['PRODUCT_MODEL_INVOCATION/V1', token, kind].join('\x1f'));
}

function span(id, node, kind, start, end, text) {
  return { run_id: RUN, span_id: id, source_document_id: 'doc', structure_node_id: node, kind, coordinate_system: 'UTF8_CANONICAL_TEXT_HALF_OPEN', start_byte: start, end_byte: end, text_sha256: sha256Hex(text), exact_text: text };
}

const TEXT = 'Section 1.1 The Company shall deliver the certificate. Section 1.2 Parent shall pay the fee within ten days. Definitions: Fee means money.';
const spans = [
  span('s-full-1', 'n1', 'SECTION', 0, 55, TEXT.slice(0, 55)),
  span('s-op-1', 'n1', 'OPERATIVE', 12, 55, TEXT.slice(12, 55)),
  span('s-full-2', 'n2', 'SECTION', 56, 110, TEXT.slice(56, 110)),
  span('s-op-2a', 'n2', 'OPERATIVE', 68, 90, TEXT.slice(68, 90)),
  span('s-op-2b', 'n2', 'OPERATIVE', 90, 110, TEXT.slice(90, 110)),
  span('s-def', 'n3', 'DEFINITION', 111, 139, TEXT.slice(111, 139)),
];
const byId = new Map(spans.map((item) => [item.span_id, item]));
const forModel = (id) => { const item = byId.get(id); return { span_id: id, source_document_id: 'doc', structure_node_id: item.structure_node_id, kind: item.kind, start_byte: item.start_byte, end_byte: item.end_byte, exact_text: item.exact_text }; };

function apiCall({ id, node, kind, stable, section, usage, outputText, failed = false, at, durationMs, invocationId, cost, model = 'claude-opus-5;effort=high', stop = 'end_turn' }) {
  const request = {
    model: 'claude-opus-5', max_tokens: 128000, output_config: { effort: 'high' }, system: 'x',
    messages: [{ role: 'user', content: [{ type: 'text', text: JSON.stringify({ call_kind: kind, prompt_version: 'P/V1', ...stable }), cache_control: { type: 'ephemeral', ttl: '1h' } }, { type: 'text', text: JSON.stringify(section) }] }],
  };
  const message = { id: `msg_${id}`, type: 'message', role: 'assistant', model: 'claude-opus-5', stop_reason: stop, content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: outputText }], usage };
  const input = usage.input_tokens + (usage.cache_read_input_tokens || 0) + (usage.cache_creation_input_tokens || 0);
  return {
    run_id: RUN, model_call_id: id, structure_node_id: node, call_kind: kind, prompt_version: 'P/V1', provider_id: 'ANTHROPIC_API', model_id: model,
    request,
    response: failed ? { schema_version: 'PRODUCT_MODEL_FAILURE_RESPONSE/V1', status: 'PROVIDER_RESPONSE_REJECTED', provider_completion_confirmed: false, raw_response: message, usage: { status: 'KNOWN', input_tokens: input, output_tokens: usage.output_tokens }, cost: { status: 'KNOWN', cost_microusd: cost }, validation_error: { name: 'E', code: 'ANTHROPIC_API_OUTPUT_TRUNCATED', message: 'the answer ran past the output cap' } } : message,
    input_tokens: input, output_tokens: usage.output_tokens, cost_microusd: cost, duration_ms: durationMs, created_at: new Date(at).toISOString(), invocation_id: invocationId,
  };
}

const answer = (proposals) => JSON.stringify({ proposals, groups: [], links: [], coverage: { TERMINATION: 'FOUND' }, fact_type_coverage: {} });
const proposal = (ref, quote, spanId) => ({
  client_ref: ref, group_ref: `g-${ref}`, family_key: 'TERMINATION', subtype_key: 'X', fact_type: 'Y', statement: `${quote}.`, roles: { actor: 'Company' },
  evidence_quotes: [{ quote, source_span_id: spanId, occurrence: 0 }],
  headline: { label: 'L', distinguishing_refs: ['c1'], summary: 'summary' },
  components: [{ ref: 'c1', kind: 'OPERATION', label: 'deliver', quote, source_span_id: spanId, occurrence: 0, origin: 'OWN', gap_before: false, children: [] }],
  conclusions: { table_key: 't', row_label: 'r', cells: [] },
});

const T0 = Date.parse('2026-10-18T13:00:00Z');
const stableExtraction = { instruction: 'i'.repeat(400), family_contracts: [{ family_key: 'TERMINATION' }], table_shapes: { TERMINATION: [] } };
const calls = [
  apiCall({ id: 'c1', node: 'n1', kind: 'ROUTING', stable: { instruction: 'route' }, section: { section_reference: '1.1', section: forModel('s-full-1') }, usage: { input_tokens: 100, cache_creation_input_tokens: 800, cache_read_input_tokens: 0, output_tokens: 50 }, outputText: '{"families":["TERMINATION"]}', at: T0 + 10000, durationMs: 10000, invocationId: invocation(ATTEMPT_A, 'ROUTING'), cost: 10000 }),
  apiCall({ id: 'c2', node: 'n1', kind: 'RESIDUAL', stable: { instruction: 'residual' }, section: { section_reference: '1.1', paragraphs: [{ paragraph_index: 0, source_span_id: 's-op-1', exact_text: byId.get('s-op-1').exact_text }] }, usage: { input_tokens: 60, cache_creation_input_tokens: 600, cache_read_input_tokens: 0, output_tokens: 40 }, outputText: '{"paragraphs":[]}', at: T0 + 20000, durationMs: 8000, invocationId: invocation(ATTEMPT_A, 'RESIDUAL'), cost: 8000 }),
  apiCall({ id: 'c3', node: 'n1', kind: 'EXTRACTION', stable: stableExtraction, section: { source_closure: { operative: [forModel('s-op-1')], chapeau: [], definitions: [forModel('s-def')], cross_references: [forModel('s-full-2')], full_section: forModel('s-full-1') } }, usage: { input_tokens: 500, cache_creation_input_tokens: 2000, cache_read_input_tokens: 0, output_tokens: 1000 }, outputText: answer([proposal('p1', 'The Company shall deliver the certificate', 's-op-1')]), at: T0 + 80000, durationMs: 50000, invocationId: invocation(ATTEMPT_A, 'EXTRACTION'), cost: 60000 }),
  // Section 2: a first attempt whose extraction ran past the cap, then a committed attempt in two parts.
  apiCall({ id: 'c4', node: 'n2', kind: 'ROUTING', stable: { instruction: 'route' }, section: { section_reference: '1.2', section: forModel('s-full-2') }, usage: { input_tokens: 110, cache_creation_input_tokens: 0, cache_read_input_tokens: 800, output_tokens: 50 }, outputText: '{"families":["TERMINATION"]}', at: T0 + 85000, durationMs: 9000, invocationId: invocation(ATTEMPT_B_FAILED, 'ROUTING'), cost: 2000 }),
  apiCall({ id: 'c5', node: 'n2', kind: 'RESIDUAL', stable: { instruction: 'residual' }, section: { section_reference: '1.2', paragraphs: [{ paragraph_index: 0, source_span_id: 's-op-2a', exact_text: 'x' }, { paragraph_index: 1, source_span_id: 's-op-2b', exact_text: 'y' }] }, usage: { input_tokens: 70, cache_creation_input_tokens: 0, cache_read_input_tokens: 600, output_tokens: 40 }, outputText: '{"paragraphs":[]}', at: T0 + 100000, durationMs: 8000, invocationId: invocation(ATTEMPT_B_FAILED, 'RESIDUAL'), cost: 1500 }),
  apiCall({ id: 'c6', node: 'n2', kind: 'EXTRACTION', stable: stableExtraction, section: { source_closure: { operative: [forModel('s-op-2a'), forModel('s-op-2b')], chapeau: [], definitions: [forModel('s-def')], cross_references: [], full_section: forModel('s-full-2') } }, usage: { input_tokens: 600, cache_creation_input_tokens: 0, cache_read_input_tokens: 2000, output_tokens: 64000 }, outputText: '{"proposals": [', failed: true, stop: 'max_tokens', at: T0 + 400000, durationMs: 290000, invocationId: invocation(ATTEMPT_B_FAILED, 'EXTRACTION'), cost: 1601000 }),
  apiCall({ id: 'c7', node: 'n2', kind: 'ROUTING', stable: { instruction: 'route' }, section: { section_reference: '1.2', section: forModel('s-full-2') }, usage: { input_tokens: 110, cache_creation_input_tokens: 0, cache_read_input_tokens: 800, output_tokens: 50 }, outputText: '{"families":["TERMINATION"]}', at: T0 + 700000, durationMs: 9000, invocationId: invocation(ATTEMPT_B, 'ROUTING'), cost: 2000 }),
  apiCall({ id: 'c8', node: 'n2', kind: 'RESIDUAL', stable: { instruction: 'residual' }, section: { section_reference: '1.2', paragraphs: [{ paragraph_index: 0, source_span_id: 's-op-2a', exact_text: 'x' }, { paragraph_index: 1, source_span_id: 's-op-2b', exact_text: 'y' }] }, usage: { input_tokens: 70, cache_creation_input_tokens: 0, cache_read_input_tokens: 600, output_tokens: 40 }, outputText: '{"paragraphs":[]}', at: T0 + 710000, durationMs: 8000, invocationId: invocation(ATTEMPT_B, 'RESIDUAL'), cost: 1500 }),
  apiCall({ id: 'c9', node: 'n2', kind: 'EXTRACTION', stable: stableExtraction, section: { source_closure: { operative: [forModel('s-op-2a')], chapeau: [], definitions: [forModel('s-def')], cross_references: [], full_section: { ...forModel('s-full-2'), exact_text: '', text_omitted: 'split into parts; see operative' }, extraction_part: { part: 1, of: 2, covers_chapeau: false, mode: 'limbs' } }, part_instruction: 'part 1' }, usage: { input_tokens: 300, cache_creation_input_tokens: 0, cache_read_input_tokens: 2000, output_tokens: 700 }, outputText: answer([proposal('p2', 'Parent shall pay the fee', 's-op-2a')]), at: T0 + 760000, durationMs: 40000, invocationId: invocation(`${ATTEMPT_B}:part-1`, 'EXTRACTION'), cost: 20000 }),
  apiCall({ id: 'c10', node: 'n2', kind: 'EXTRACTION', stable: stableExtraction, section: { source_closure: { operative: [forModel('s-op-2b')], chapeau: [], definitions: [forModel('s-def')], cross_references: [], full_section: { ...forModel('s-full-2'), exact_text: '', text_omitted: 'split into parts; see operative' }, extraction_part: { part: 2, of: 2, covers_chapeau: false, mode: 'limbs' } }, part_instruction: 'part 2' }, usage: { input_tokens: 300, cache_creation_input_tokens: 0, cache_read_input_tokens: 2000, output_tokens: 600 }, outputText: answer([proposal('p3', 'within ten days', 's-op-2b')]), at: T0 + 800000, durationMs: 35000, invocationId: invocation(`${ATTEMPT_B}:part-2`, 'EXTRACTION'), cost: 18000 }),
];

const run = {
  run_id: RUN,
  tables: {
    product_analysis_runs: [{ run_id: RUN, status: 'READY', source_generation: 1, model_config: { provider_id: 'ANTHROPIC_API' }, prompt_bundle_version: 'PRODUCT_LAYERED_COMPONENTS/V9', retrieval_url: 'https://www.sec.gov/x/ex21.htm', created_at: new Date(T0).toISOString(), updated_at: new Date(T0 + 900000).toISOString() }],
    product_model_calls: calls,
    product_section_work: [
      { run_id: RUN, node_id: 'n1', authored_order: 1, status: 'COMPLETE', attempts: 1, attempt_token: ATTEMPT_A, error_history: [] },
      { run_id: RUN, node_id: 'n2', authored_order: 2, status: 'COMPLETE', attempts: 2, attempt_token: ATTEMPT_B, error_history: [{ error: { code: 'ANTHROPIC_API_OUTPUT_TRUNCATED', message: 'cap' } }] },
    ],
    product_source_closures: [
      { run_id: RUN, source_closure_id: 'cl1', structure_node_id: 'n1', section_reference: '1.1', payload: { full_section_span_id: 's-full-1' } },
      { run_id: RUN, source_closure_id: 'cl2', structure_node_id: 'n2', section_reference: '1.2', payload: { full_section_span_id: 's-full-2' } },
    ],
    product_source_spans: spans,
    product_proposals: [
      { run_id: RUN, proposal_id: 'pp1', structure_node_id: 'n1', validation_status: 'VALID', payload: { statement: 'The Company shall deliver the certificate.', headline: { label: 'L', summary: 'summary' }, conclusions: { table_key: 't', row_label: 'r', cells: [] } } },
      { run_id: RUN, proposal_id: 'pp2', structure_node_id: 'n2', validation_status: 'VALID', payload: { statement: 'Parent shall pay the fee.', headline: { label: 'L', summary: 'summary' } } },
      { run_id: RUN, proposal_id: 'pp3', structure_node_id: 'n2', validation_status: 'INVALID', payload: { statement: 'within ten days.' } },
    ],
    product_fact_components: [
      { run_id: RUN, proposal_id: 'pp1', component_id: 'k1', text: 'The Company shall deliver the certificate', label: 'deliver' },
      { run_id: RUN, proposal_id: 'pp2', component_id: 'k2', text: 'Parent shall pay the fee', label: 'pay' },
    ],
  },
};

test('pipelineRequestOf rebuilds the pipeline request from the API blocks, the CLI string and a plain object', () => {
  const blocks = pipelineRequestOf(calls[2]);
  assert.equal(blocks.layout, 'API_BLOCKS');
  assert.equal(blocks.call_kind, 'EXTRACTION');
  assert.equal(blocks.prompt_version, 'P/V1');
  assert.deepEqual(Object.keys(blocks.request).sort(), ['family_contracts', 'instruction', 'source_closure', 'table_shapes']);
  assert.equal(blocks.request.source_closure.operative[0].span_id, 's-op-1');
  assert.ok(blocks.stable_bytes > 400 && blocks.section_bytes > 100);

  const record = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/product/ncs-v8-extraction-call.v1.json'), 'utf8'));
  const cli = pipelineRequestOf(record);
  assert.equal(cli.layout, 'CLI_STRING');
  assert.equal(cli.call_kind, 'EXTRACTION');
  assert.equal(cli.prompt_version, 'PRODUCT_ALL_FAMILY_EXTRACTOR/V8');
  assert.ok(cli.request.source_closure.operative.length > 0);
  assert.equal(cli.request.call_kind, undefined);

  const plain = pipelineRequestOf({ call_kind: 'ROUTING', prompt_version: 'R/V3', request: { instruction: 'x', section: { start_byte: 0, end_byte: 5, exact_text: 'hello' } } });
  assert.equal(plain.layout, 'PLAIN');
  assert.equal(plain.request.instruction, 'x');
});

test('callUsage reads the cache split, the part and the failure from a stored call', () => {
  const part = callUsage(calls[8]);
  assert.equal(part.part, 1);
  assert.equal(part.part_of, 2);
  assert.equal(part.fresh_input_tokens, 300);
  assert.equal(part.cache_read_tokens, 2000);
  assert.equal(part.failed, false);
  const failed = callUsage(calls[5]);
  assert.equal(failed.failed, true);
  assert.equal(failed.failure_code, 'ANTHROPIC_API_OUTPUT_TRUNCATED');
  assert.equal(failed.output_tokens, 64000);
  assert.equal(failed.stop_reason, 'max_tokens');
  assert.equal(failed.started_at, failed.ended_at - 290000);
});

test('bytesSentHistogram counts how many times each byte went', () => {
  const histogram = bytesSentHistogram([{ start: 0, end: 10 }, { start: 0, end: 10 }, { start: 5, end: 20 }, { start: 100, end: 101 }]);
  assert.equal(histogram.bytes_covered, 21);
  assert.equal(histogram.byte_sends, 36);
  assert.deepEqual(histogram.buckets.map((bucket) => [bucket.bucket, bucket.bytes, bucket.byte_sends]), [['0', 80, 0], ['1-2', 16, 21], ['3-5', 5, 15]]);
});

test('timeline separates idle, one-call and two-call minutes from the calls alone', () => {
  const usages = calls.map((call) => callUsage(call));
  const time = timeline(usages);
  assert.equal(time.max_concurrency, 2);
  assert.ok(time.idle_minutes > 0, 'the gap between the failed attempt and the retry is idle');
  assert.ok(time.gaps_over_two_minutes.length >= 1);
  assert.equal(time.wall_minutes, Number(((T0 + 800000 - (T0 + 10000 - 10000)) / 60000).toFixed(1)));
});

test('ledgerFromRows totals the run, prices the failed and uncommitted calls, profiles what was sent and the output, and states the floor', () => {
  const ledger = ledgerFromRows(run);
  assert.equal(ledger.totals.calls, 10);
  assert.equal(ledger.totals.by_call_kind.EXTRACTION.calls, 4);
  assert.equal(ledger.totals.failed.calls, 1);
  assert.equal(ledger.totals.failed.output_tokens, 64000);
  assert.equal(ledger.totals.failed.cost_microusd, 1601000);
  // The first attempt of section 2 (routing, residual and the capped extraction) did not commit.
  assert.equal(ledger.totals.uncommitted_attempts.calls, 3);
  assert.equal(ledger.totals.uncommitted_attempts.cost_microusd, 1604500);
  assert.equal(ledger.totals.cost_usd, Number(((10000 + 8000 + 60000 + 2000 + 1500 + 1601000 + 2000 + 1500 + 20000 + 18000) / 1e6).toFixed(2)));

  const sections = Object.fromEntries(ledger.sections.map((section) => [section.section_reference, section]));
  assert.equal(sections['1.2'].parts, 2);
  assert.equal(sections['1.2'].extraction_calls, 3);
  assert.equal(sections['1.2'].failed_calls, 1);
  assert.equal(sections['1.2'].attempts, 2);
  assert.equal(sections['1.2'].section_bytes, 54);
  assert.equal(sections['1.2'].facts, 2);
  assert.equal(sections['1.2'].valid_facts, 1);

  // Definitions and cross-references were sent with every extraction call; the residual paragraphs resolve to their spans.
  assert.equal(ledger.sent.by_role.definitions.spans, 4);
  assert.equal(ledger.sent.by_role.cross_references.spans, 1);
  assert.equal(ledger.sent.by_role.residual_paragraphs.spans, 5);
  assert.equal(ledger.sent.by_role.routing_section.spans, 3);
  assert.ok(ledger.sent.histogram.mean_sends_per_byte > 3);
  assert.equal(ledger.agreement.sections, 2);
  assert.equal(ledger.agreement.section_bytes, 109);

  // The stable block of the four extraction calls is one set, written once.
  assert.equal(ledger.stable_blocks.EXTRACTION.distinct_sets, 1);
  assert.equal(ledger.stable_blocks.EXTRACTION.writes, 1);
  assert.equal(ledger.stable_blocks.EXTRACTION.key_bytes.instruction, 402 * 4);

  // The output composition reads the three successful answers.
  assert.equal(ledger.output.responses, 3);
  assert.equal(ledger.output.proposals, 3);
  assert.equal(ledger.output.component_nodes, 3);
  assert.equal(ledger.output.component_quote_text, Buffer.byteLength('The Company shall deliver the certificateParent shall pay the feewithin ten days'));
  assert.equal(ledger.output.evidence_quote_count, 3);
  assert.equal(ledger.output.thinking_share_measured, false);

  assert.ok(ledger.floor.input_tokens > 0 && ledger.floor.output_tokens > 0 && ledger.floor.cost_usd >= 0);
  assert.ok(ledger.ratio_to_floor.cost > 1);
  assert.equal(ledger.metrics.valid_facts, 2);
  assert.equal(ledger.metrics.cost_per_valid_fact_usd, Number((ledger.totals.cost_microusd / 1e6 / 2).toFixed(4)));
  assert.equal(ledger.metrics.calls_per_section, 5);

  const markdown = renderLedger(ledger);
  assert.match(markdown, /### Tokens by call kind/);
  assert.match(markdown, /\| 1\.2 \| 54 \| 2 \| 2 \| 2 \| 3 \| 2 \| 1 \|/);
  assert.match(markdown, /Gaps over two minutes/);
});

test('the gate passes an unchanged or lower run, fails an unexplained rise and accepts an explained one', () => {
  const baseline = { cost_per_valid_fact_usd: 0.1436, input_tokens_per_agreement_byte: 43.3, output_tokens_per_agreement_byte: 12.9, output_tokens_per_valid_fact: 3748, call_minutes_per_section: 7.0, calls_per_section: 3.78, sends_per_agreement_byte: 54.2 };
  assert.deepEqual(assertNoUnexplainedRise({ ...baseline }, baseline), { ok: true, explained_rises: [] });
  assert.deepEqual(assertNoUnexplainedRise({ ...baseline, cost_per_valid_fact_usd: 0.05, calls_per_section: 1 }, baseline), { ok: true, explained_rises: [] });
  assert.deepEqual(assertNoUnexplainedRise({ ...baseline, cost_per_valid_fact_usd: 0.16 }, baseline), { ok: true, explained_rises: [] }, 'within the 15 per cent tolerance');
  assert.throws(() => assertNoUnexplainedRise({ ...baseline, cost_per_valid_fact_usd: 0.20 }, baseline), (error) => {
    assert.equal(error.code, 'RUN_COST_RISE_UNEXPLAINED');
    assert.equal(error.failures.length, 1);
    assert.equal(error.failures[0].metric, 'cost_per_valid_fact_usd');
    assert.match(error.message, /cost_per_valid_fact_usd 0\.1436 -> 0\.2 \(\+39\.3%, tolerance 15%\)/);
    return true;
  });
  const explained = assertNoUnexplainedRise({ ...baseline, cost_per_valid_fact_usd: 0.20 }, baseline, { explanations: { cost_per_valid_fact_usd: 'plan finding (18x): the schema grew by two families' } });
  assert.equal(explained.ok, true);
  assert.equal(explained.explained_rises[0].metric, 'cost_per_valid_fact_usd');
  assert.ok(Object.keys(GATE_METRICS).includes('sends_per_agreement_byte'));
});

test('the NCS generation 5 baseline fixture holds the ledger note\'s gate metrics and gates a dearer run', () => {
  const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/product/run-cost-baseline.ncs-generation-5.json'), 'utf8'));
  assert.equal(baseline.run_id, '51577c57-41b1-4b75-bcdf-c84ef2558589');
  for (const metric of Object.keys(GATE_METRICS)) assert.ok(Number.isFinite(baseline.metrics[metric]), `${metric} is in the baseline`);
  assert.equal(Number((baseline.metrics.cost_usd / baseline.metrics.valid_facts).toFixed(4)), baseline.metrics.cost_per_valid_fact_usd);
  assert.deepEqual(assertNoUnexplainedRise(baseline.metrics, baseline.metrics), { ok: true, explained_rises: [] });
  assert.throws(() => assertNoUnexplainedRise({ ...baseline.metrics, output_tokens_per_valid_fact: 4600, sends_per_agreement_byte: 70 }, baseline.metrics), (error) => {
    assert.deepEqual(error.failures.map((entry) => entry.metric), ['output_tokens_per_valid_fact', 'sends_per_agreement_byte']);
    return true;
  });
});
