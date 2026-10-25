'use strict';

// Work packages 46 and 47 (plan findings (264) and (265)): the live checks
// of a deployed preview in one command. The checks are asserted here against
// a fake fetch; the point of the test is the report a person reads — the
// sections with no facts, the model header, the timings — and that the
// credential itself never appears in it.

const assert = require('node:assert/strict');
const test = require('node:test');
const { headersFor, runPreviewChecks, renderPreviewChecks, DEFAULT_BASE_URL } = require('../lib/product/preview-checks');

function response({ status = 200, body = {}, headers = {} } = {}) {
  return {
    status,
    text: async () => JSON.stringify(body),
    headers: { get: (name) => headers[name.toLowerCase()] || null },
  };
}

// A preview payload shaped like the deployment's (PRODUCT_PREVIEW_WORKSPACE/V2);
// `sections_without_facts` is computed from it by the page's own projection,
// not read off a field.
function workspace(sections) {
  return {
    schema_version: 'PRODUCT_PREVIEW_WORKSPACE/V2',
    analysis: {
      source_document: { parties: ['Parent Inc.', 'Target Corp.'] },
      agreement_structure: { nodes: sections.map((section, index) => ({ node_id: section.node_id, reference: section.reference, authored_order: index + 1, kind: 'SECTION' })) },
      sections: sections.map((section) => ({ structure_node_id: section.node_id, section_reference: section.reference, families: section.families || [], disposition: section.disposition })),
      source_closures: sections.map((section) => ({ source_closure_id: `c-${section.node_id}`, structure_node_id: section.node_id, section_reference: section.reference, full_section_span_id: `span-${section.node_id}` })),
      spans: sections.map((section) => ({ span_id: `span-${section.node_id}`, kind: 'FULL_SECTION', structure_node_id: section.node_id, start_byte: 0, end_byte: 20, exact_text: `Section ${section.reference} Test.`, source_closure_ids: [`c-${section.node_id}`] })),
      proposals: sections.filter((section) => section.fact).map((section) => ({
        proposal_id: `p-${section.node_id}`, structure_node_id: section.node_id, validation_status: 'VALID',
        statement: 'A fact.', family_key: 'REPRESENTATIONS', subtype_key: 'STATUS_REPRESENTATION',
        headline: { label: 'Representation', distinguishing_component_ids: ['comp'] },
        components: [{ component_id: 'comp', kind: 'TERM', label: 'word', text: 'word', origin: 'OWN', start_byte: 0, end_byte: 4 }],
      })),
      proposition_groups: [], fact_links: [], issues: [], coverage_assertions: [],
    },
    review: { version: 0, state: { status: 'DRAFT', items: [], agreement_coverage: { decision: 'PENDING' } } },
    progress: { status: 'READY', stage: 'READY', completed: sections.length, total: sections.length, generation: 3 },
  };
}

const RUNS = {
  'deepseek-run': {
    status: 200,
    body: workspace([
      { node_id: 'n-516', reference: '5.16', families: [], disposition: 'IMMATERIAL' },
      { node_id: 'n-330', reference: '3.30', families: ['REPRESENTATIONS'], disposition: 'FAMILY_ASSIGNED' },
    ]),
  },
  'claude-run': {
    status: 200,
    body: workspace([{ node_id: 'n-330', reference: '3.30', families: ['REPRESENTATIONS'], disposition: 'FAMILY_ASSIGNED', fact: true }]),
  },
};

function fetchFor(calls, { modelSecondRead = 'MODEL' } = {}) {
  return async (url, { headers }) => {
    calls.push({ url, headers });
    const run = Object.keys(RUNS).find((key) => url.includes(key));
    if (!run) return response({ status: 401, body: { error: 'Unauthorized' } });
    if (url.endsWith('/preview')) {
      const isSecond = calls.filter((call) => call.url === url).length > 1;
      const entry = RUNS[run];
      if (isSecond) return response({ ...entry, headers: modelSecondRead ? { 'x-preview-read': modelSecondRead } : {} });
      return response(entry);
    }
    return response({ status: 200, body: { progress: { status: 'READY' } } });
  };
}

test('the credential goes as a bearer, as a cookie, or both when it has the session shape; no header without one', () => {
  assert.deepEqual(headersFor({ token: 'a'.repeat(40) }), { authorization: `Bearer ${'a'.repeat(40)}` });
  assert.deepEqual(headersFor({ token: 'one.two.three' }), { authorization: 'Bearer one.two.three', cookie: 'pm_session=one.two.three' });
  assert.deepEqual(headersFor({ token: 'pm_session=one.two.three' }), { cookie: 'pm_session=one.two.three' });
  assert.deepEqual(headersFor({ token: 'a'.repeat(40), bypass: 'bypass-value' }), { 'x-vercel-protection-bypass': 'bypass-value', authorization: `Bearer ${'a'.repeat(40)}` });
  assert.deepEqual(headersFor({}), {});
});

test('the report names the sections a run left without facts, the model header and the timings, and never the credential', async () => {
  const calls = [];
  const report = await runPreviewChecks({
    baseUrl: DEFAULT_BASE_URL, token: 'secret-token-value-0123456789abcdef', bypass: 'bypass-value',
    runs: ['deepseek-run', 'claude-run'], fetchImpl: fetchFor(calls),
  });
  assert.equal(report.length, 2);
  assert.equal(report[0].status, 200);
  assert.deepEqual(report[0].withoutFacts, [
    { section_reference: '5.16', reason: 'READ_AS_IMMATERIAL', families: [] },
    { section_reference: '3.30', reason: 'RETURNED_NOTHING', families: ['REPRESENTATIONS'] },
  ], 'the page\'s own projection is what the check reports');
  assert.equal(report[0].model, null, 'the first read carries no model header');
  assert.equal(report[0].second.model, 'MODEL', 'the second read is served from the stored projection');
  assert.equal(report[1].withoutFacts.length, 0);
  const text = renderPreviewChecks(report);
  assert.match(text, /deepseek-run: preview 200/);
  assert.match(text, /section with no facts: 5\.16 — READ_AS_IMMATERIAL/);
  assert.match(text, /section with no facts: 3\.30 — RETURNED_NOTHING \(REPRESENTATIONS\)/);
  assert.match(text, /second read: 200 in .* X-Preview-Read=MODEL/);
  assert.match(text, /claude-run: preview 200/);
  assert.match(text, /sections with no facts: none/);
  assert.doesNotMatch(text, /secret-token-value|bypass-value/, 'the report never prints the credential');
  // Every request carried the bypass and the bearer.
  for (const call of calls) {
    assert.equal(call.headers['x-vercel-protection-bypass'], 'bypass-value');
    assert.equal(call.headers.authorization, 'Bearer secret-token-value-0123456789abcdef');
  }
});

test('a refused read is reported as refused, with what to check, and no section list is invented', async () => {
  const report = await runPreviewChecks({
    baseUrl: DEFAULT_BASE_URL, token: 'wrong', runs: ['unknown-run'], fetchImpl: fetchFor([]),
  });
  assert.equal(report[0].status, 401);
  const text = renderPreviewChecks(report);
  assert.match(text, /unknown-run: preview 401/);
  assert.match(text, /the read was refused: check the credential and the bypass secret/);
  assert.doesNotMatch(text, /section with no facts/);
  // Without a token the function refuses to pretend.
  await assert.rejects(() => runPreviewChecks({ runs: ['x'], fetchImpl: fetchFor([]) }), /token or session value/);
  await assert.rejects(() => runPreviewChecks({ token: 't', runs: [], fetchImpl: fetchFor([]) }), /at least one run id/);
});

// The review of 2026-10-25 (findings 3, 4, 5): a redirect or an HTML page is
// not a read, a refusal says what kind of refusal it is, and one flaky
// second read does not lose the report.
test('a 200 that is not the preview workspace is refused, not reported as a run with no sections', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/preview')) return { status: 200, text: async () => '<!DOCTYPE html><html>Login</html>', headers: { get: () => null } };
    return { status: 200, text: async () => '{}', headers: { get: () => null } };
  };
  const report = await runPreviewChecks({ baseUrl: DEFAULT_BASE_URL, token: 't'.repeat(40), runs: ['some-run'], fetchImpl });
  assert.equal(report[0].workspace, false);
  const text = renderPreviewChecks(report);
  assert.match(text, /the answer was not the preview workspace/);
  assert.doesNotMatch(text, /sections with no facts: none/, 'an HTML page must not read as an empty preview');
  assert.equal(calls[0].options.redirect, 'manual', 'a redirect is not followed into a login page');
});

test('the check reports the review state beside the preview: version, decisions and pending count', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.endsWith('/preview')) return { status: 200, text: async () => JSON.stringify(workspace([])), headers: { get: () => null } };
    if (url.includes('/api/product/review/')) {
      return {
        status: 200,
        headers: { get: () => null },
        text: async () => JSON.stringify({ review: { version: 13, status: 'DRAFT', state: {
          items: [{ decision: 'ACCEPTED' }, { decision: 'ACCEPTED' }, { decision: 'REJECTED' }, { decision: 'PENDING' }],
          agreement_coverage: { decision: 'ACCEPTED' },
        } } }),
      };
    }
    return { status: 200, text: async () => '{}', headers: { get: () => null } };
  };
  const report = await runPreviewChecks({ baseUrl: DEFAULT_BASE_URL, token: 't'.repeat(40), runs: ['some-run'], fetchImpl });
  assert.deepEqual(report[0].reviewRead, { status: 200, seconds: report[0].reviewRead.seconds, version: 13, review_status: 'DRAFT', items: 4, accepted: 2, rejected: 1, pending: 1, unresolved: 0, coverage: 'ACCEPTED' });
  const text = renderPreviewChecks(report);
  assert.match(text, /review: version 13, DRAFT, 4 items \(2 accepted, 1 rejected, 1 pending, 0 unresolved\), coverage ACCEPTED/);
});

test('a refusal names what kind of refusal it is, and a flaky second read keeps the first read report', async () => {
  const statuses = { 'run-404': 404, 'run-500': 500 };
  const fetchImpl = async (url) => {
    const run = Object.keys(statuses).find((key) => url.includes(key));
    if (run) return { status: statuses[run], text: async () => '{}', headers: { get: () => null } };
    if (url.includes('flaky-run') && url.endsWith('/preview')) {
      // First read fine, second read throws, run read fine.
      const isSecond = url.includes('flaky-run') && fetchImpl.seen;
      fetchImpl.seen = true;
      if (isSecond) throw new Error('socket hang up');
      return { status: 200, text: async () => JSON.stringify(workspace([])), headers: { get: () => null } };
    }
    return { status: 200, text: async () => '{}', headers: { get: () => null } };
  };
  const report = await runPreviewChecks({ baseUrl: DEFAULT_BASE_URL, token: 't'.repeat(40), runs: ['run-404', 'run-500', 'flaky-run'], fetchImpl });
  const text = renderPreviewChecks(report);
  assert.match(text, /run-404: preview 404/);
  assert.match(text, /the run was not found, or this credential has no access to it/);
  assert.match(text, /run-500: preview 500/);
  assert.match(text, /the deployment failed the read; check its logs/);
  assert.match(text, /flaky-run: preview 200/);
  assert.match(text, /second read failed: socket hang up/);
});
