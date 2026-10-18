'use strict';

// Phase 6 (plan section 6, "Internal cutover and live use"): one client the
// cutover scripts share, over the product's own HTTP boundaries and nothing
// else. Two transports with one interface:
//
//   createHttpCutoverClient({ baseUrl, token })   the deployment, through
//     the internal bearer token (lib/product/request-auth.js; Ben,
//     2026-09-14: "Server side route is fine."), the same routes the
//     browser calls;
//   createInProcessCutoverClient({ handlers })     the same route handlers
//     called in-process with a request and response double, for the tests
//     and for a direct database run (createStoreCutoverClient) when the
//     operator holds the service-role key and not the token.
//
// Nothing here decides a review item, wakes a worker or touches a sandbox:
// the run route is deliberately absent. Ben: "everything to be driven by
// coding and not just a layer on top so all edits need to be repeatable
// across corpus".

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class CutoverRequestError extends Error {
  constructor(method, path, status, body) {
    super(`${method} ${path} -> ${status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
    this.name = 'CutoverRequestError';
    this.status = status;
    this.body = body;
  }
}

function requireRunId(runId) {
  if (!UUID.test(runId || '')) throw new TypeError('a run id (UUID) is required');
  return runId;
}

function queryString(query) {
  const entries = Object.entries(query || {}).filter(([, value]) => value !== undefined && value !== null && value !== '');
  if (entries.length === 0) return '';
  return `?${new URLSearchParams(entries.map(([key, value]) => [key, String(value)])).toString()}`;
}

function createHttpCutoverClient({ baseUrl, token, fetchImpl = globalThis.fetch } = {}) {
  if (typeof baseUrl !== 'string' || !/^https?:\/\//.test(baseUrl)) throw new TypeError('baseUrl must be an http(s) URL');
  if (typeof token !== 'string' || token.length === 0) throw new TypeError('token is required');
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');
  const base = baseUrl.replace(/\/$/, '');
  async function call(method, path, body) {
    const response = await fetchImpl(`${base}${path}`, {
      method,
      headers: { authorization: `Bearer ${token}`, accept: 'application/json', ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'manual',
    });
    const text = await response.text();
    let value;
    try { value = JSON.parse(text); } catch { value = text; }
    if (!response.ok) throw new CutoverRequestError(method, path, response.status, value);
    return value;
  }
  async function page(path) {
    const response = await fetchImpl(`${base}${path}`, {
      method: 'GET', headers: { authorization: `Bearer ${token}`, accept: 'text/html' }, redirect: 'manual',
    });
    const text = await response.text();
    return { status: response.status, content_type: String(response.headers.get('content-type') || ''), length: text.length, html: /<html/i.test(text) };
  }
  return Object.freeze({
    transport: 'http',
    base_url: base,
    submitIntake: (submission) => call('POST', '/api/product/intake', submission),
    getAnalysis: (runId) => call('GET', `/api/product/analysis/${requireRunId(runId)}`),
    getPreview: (runId) => call('GET', `/api/product/analysis/${requireRunId(runId)}/preview`),
    getReview: (runId) => call('GET', `/api/product/review/${requireRunId(runId)}`),
    reviewCommand: (runId, body) => call('POST', `/api/product/review/${requireRunId(runId)}`, body),
    getPublishedFacts: (query = {}) => call('GET', `/api/product/published-facts${queryString(query)}`),
    getPage: page,
  });
}

function responseDouble() {
  return {
    headers: {}, statusCode: null, body: null,
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
    end() { return this; },
  };
}

// handlers: { intake, analysis, preview, review, publishedFacts }, each a
// Next-style (req, res) handler built from its factory (the same code the
// routes export). The bearer header is not needed: the handlers are built
// with an actor resolver already.
function createInProcessCutoverClient({ handlers } = {}) {
  if (!handlers || typeof handlers !== 'object') throw new TypeError('handlers are required');
  async function call(handler, method, path, { query = {}, body } = {}) {
    if (typeof handler !== 'function') throw new TypeError(`no handler for ${method} ${path}`);
    const res = responseDouble();
    await handler({ method, query, headers: { 'x-pm-csrf': 'same-origin' }, body }, res);
    if (res.statusCode === null) throw new CutoverRequestError(method, path, 0, 'handler sent no response');
    if (res.statusCode < 200 || res.statusCode >= 300) throw new CutoverRequestError(method, path, res.statusCode, res.body);
    return res.body;
  }
  return Object.freeze({
    transport: 'in-process',
    base_url: null,
    submitIntake: (submission) => call(handlers.intake, 'POST', '/api/product/intake', { body: submission }),
    getAnalysis: (runId) => call(handlers.analysis, 'GET', `/api/product/analysis/${requireRunId(runId)}`, { query: { id: runId } }),
    getPreview: (runId) => call(handlers.preview, 'GET', `/api/product/analysis/${requireRunId(runId)}/preview`, { query: { id: runId } }),
    getReview: (runId) => call(handlers.review, 'GET', `/api/product/review/${requireRunId(runId)}`, { query: { id: runId } }),
    reviewCommand: (runId, body) => call(handlers.review, 'POST', `/api/product/review/${requireRunId(runId)}`, { query: { id: runId }, body }),
    getPublishedFacts: (query = {}) => call(handlers.publishedFacts, 'GET', '/api/product/published-facts', { query }),
    // No page shell in-process: the HTML pages need the Next runtime.
    getPage: async () => null,
  });
}

// A direct database transport for an operator holding the service-role
// key: the real handler factories over a Supabase client, the actor fixed
// (the login user the bearer token would name). The SEC adapter is the
// real one, so an intake fetches from the SEC exactly as the route does.
function createStoreCutoverClient({ client, actor } = {}) {
  if (!client || typeof client.rpc !== 'function') throw new TypeError('a server-side Supabase client is required');
  if (typeof actor !== 'string' || actor.length === 0) throw new TypeError('actor is required');
  const { createProductIntakeHandler } = require('./intake-handler');
  const { createProductAnalysisHandler } = require('./analysis-handler');
  const { createProductPreviewHandler } = require('./preview-handler');
  const { createProductReviewHandler } = require('./review-handler');
  const { createPublishedFactsHandler } = require('./published-facts-handler');
  const { ProductPhase3Store } = require('./phase-3-store');
  const { requireSameOriginMutation } = require('./request-auth');
  const getClient = () => client;
  const actorResolver = async () => actor;
  const storeFactory = (supabase) => new ProductPhase3Store({ client: supabase });
  return createInProcessCutoverClient({ handlers: {
    intake: createProductIntakeHandler({ getClient, storeFactory, actorResolver, requireMutation: requireSameOriginMutation }),
    analysis: createProductAnalysisHandler({ getClient, storeFactory, actorResolver }),
    preview: createProductPreviewHandler({ getClient, storeFactory, actorResolver }),
    review: createProductReviewHandler({ getClient, storeFactory, actorResolver }),
    publishedFacts: createPublishedFactsHandler({ getClient, storeFactory, actorResolver }),
  } });
}

// The scripts' shared argument reading: --base-url <url> with
// PRODUCT_INTERNAL_TOKEN (the deployment), else SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY with --actor (default AUTH_USERNAME or "ben").
function cutoverClientFromEnvironment({ baseUrl = null, actor = null, env = process.env, createClient = null } = {}) {
  if (baseUrl) {
    if (!env.PRODUCT_INTERNAL_TOKEN) throw new Error('PRODUCT_INTERNAL_TOKEN is not set (needed with --base-url)');
    return createHttpCutoverClient({ baseUrl, token: env.PRODUCT_INTERNAL_TOKEN });
  }
  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('give --base-url (with PRODUCT_INTERNAL_TOKEN) or set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  const factory = createClient || require('@supabase/supabase-js').createClient;
  return createStoreCutoverClient({ client: factory(url, key), actor: actor || env.AUTH_USERNAME || 'ben' });
}

module.exports = {
  CutoverRequestError,
  createHttpCutoverClient,
  createInProcessCutoverClient,
  createStoreCutoverClient,
  cutoverClientFromEnvironment,
  responseDouble,
};
