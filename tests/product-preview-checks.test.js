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

const RUNS = {
  'deepseek-run': {
    status: 200,
    body: {
      schema_version: 'PRODUCT_PREVIEW_WORKSPACE/V2',
      analysis: { sections: [{ structure_node_id: 'n1' }], proposals: [{ proposal_id: 'p1' }] },
      sections_without_facts: [
        { section_reference: '5.16', reason: 'READ_AS_IMMATERIAL', families: [] },
        { section_reference: '3.30', reason: 'RETURNED_NOTHING', families: ['REPRESENTATIONS'] },
      ],
    },
  },
  'claude-run': {
    status: 200,
    body: { analysis: { sections: [], proposals: [] }, sections_without_facts: [] },
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
  ]);
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
