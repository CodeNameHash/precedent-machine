'use strict';

// Feedback anywhere (work package 3): POST from any signed-in page, GET and
// PATCH for the admin page. The record carries the exact context the reader
// was looking at and the declared reviewer level, if any. Feedback is
// trusted only when the reviewer cookie names an active partner or senior
// associate; nothing changes a fact automatically.

const { getProductActor, requireSameOriginMutation, ProductRequestAuthError } = require('./request-auth');
const {
  reviewerForRequest, adminActor, isReviewerLevel, TRUSTED_LEVELS,
} = require('./reviewers');

const KINDS = new Set(['WRONG_ANSWER', 'MISSING', 'UNCLEAR', 'OTHER']);
const STATUSES = new Set(['open', 'accepted', 'rejected', 'done']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BODY_MAX = 10000;
const SHORT_MAX = 500;
const NOTE_MAX = 2000;
const FACT_IDS_MAX = 50;
const SHORT_FIELDS = Object.freeze(['page_path', 'section_key', 'table_key', 'row_subject', 'column_id', 'cell_code', 'cell_label']);

function badRequest(res, message) {
  return res.status(400).json({ error: message });
}

// The GET filters, each checked against its allowed set. Returns
// { filters } or { error }.
function readFilters(query = {}) {
  const status = first(query.status);
  const run = first(query.run);
  const level = first(query.level);
  const kind = first(query.kind);
  if (status && !STATUSES.has(status)) return { error: 'Invalid status filter' };
  if (run && !UUID.test(run)) return { error: 'Invalid run filter' };
  if (level && !isReviewerLevel(level)) return { error: 'Invalid level filter' };
  if (kind && !KINDS.has(kind)) return { error: 'Invalid kind filter' };
  return { filters: { status, run_id: run, author_level: level, kind } };
}

function first(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

function errorStatus(error) {
  if (error instanceof ProductRequestAuthError) return error.code === 'CSRF_REQUIRED' ? 403 : 401;
  if (error?.code === 'UNAUTHENTICATED') return 401;
  if (error?.code === 'FORBIDDEN') return 403;
  return 500;
}

function sendError(res, error, label) {
  const status = errorStatus(error);
  if (status === 401) return res.status(401).json({ error: 'UNAUTHENTICATED' });
  if (status === 403) return res.status(403).json({ error: 'FORBIDDEN' });
  console.error(`[product-feedback:${label}]`, error);
  return res.status(500).json({ error: 'Feedback could not be saved' });
}

function createProductFeedbackHandler({
  getClient,
  actorResolver = getProductActor,
  reviewerResolver = reviewerForRequest,
  adminCheck = adminActor,
} = {}) {
  if (typeof getClient !== 'function') throw new TypeError('getClient is required');
  return async function productFeedbackHandler(req, res) {
    res.setHeader('Cache-Control', 'private, no-store');
    if (!['GET', 'POST', 'PATCH'].includes(req.method)) {
      res.setHeader('Allow', 'GET, POST, PATCH');
      return res.status(405).json({ error: 'GET, POST or PATCH only' });
    }
    const client = getClient();
    if (!client) return res.status(500).json({ error: 'Product database is not configured' });
    try {
      const actor = await actorResolver(req);
      if (req.method !== 'GET') requireSameOriginMutation(req);
      const admin = adminCheck(actor);
      if (req.method === 'POST') {
        const body = req.body && typeof req.body === 'object' ? req.body : {};
        if (!KINDS.has(body.kind)) return res.status(400).json({ error: 'A valid kind is required' });
        const text = typeof body.body === 'string' ? body.body.trim() : '';
        if (!text) return res.status(400).json({ error: 'Feedback text is required' });
        if (text.length > BODY_MAX) return badRequest(res, `Feedback text is longer than ${BODY_MAX} characters`);
        if (typeof body.run_id !== 'string' || !UUID.test(body.run_id)) return badRequest(res, 'A valid run_id is required');
        const shortValues = {};
        for (const name of SHORT_FIELDS) {
          const value = typeof body[name] === 'string' ? body[name] : null;
          if (value !== null && value.length > SHORT_MAX) return badRequest(res, `${name} is longer than ${SHORT_MAX} characters`);
          shortValues[name] = value;
        }
        const reviewer = await reviewerResolver({ req, client });
        const level = reviewer && reviewer.active !== false && isReviewerLevel(reviewer.level) ? reviewer.level : null;
        const trusted = Boolean(level && TRUSTED_LEVELS.has(level));
        const row = {
          run_id: body.run_id,
          ...shortValues,
          fact_ids: Array.isArray(body.fact_ids)
            ? [...new Set(body.fact_ids.filter((id) => typeof id === 'string' && UUID.test(id)))].slice(0, FACT_IDS_MAX)
            : [],
          kind: body.kind,
          body: text,
          author_id: actor,
          author_name: level && reviewer?.name ? reviewer.name : actor,
          author_level: level,
          trusted,
          status: 'open',
        };
        const result = await client.from('product_feedback').insert(row).select().maybeSingle();
        if (result.error) throw result.error;
        return res.status(201).json({ schema_version: 'PRODUCT_FEEDBACK/V1', feedback: result.data, trusted });
      }
      if (!admin) {
        const error = new Error('admin only');
        error.code = 'FORBIDDEN';
        throw error;
      }
      if (req.method === 'GET') {
        const parsed = readFilters(req.query || {});
        if (parsed.error) return badRequest(res, parsed.error);
        let query = client.from('product_feedback').select('*').order('created_at', { ascending: false }).limit(500);
        for (const [column, value] of Object.entries(parsed.filters)) if (value) query = query.eq(column, value);
        const result = await query;
        if (result.error) throw result.error;
        return res.status(200).json({ schema_version: 'PRODUCT_FEEDBACK/V1', feedback: result.data || [] });
      }
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      if (!body.id || !UUID.test(body.id)) return res.status(400).json({ error: 'A valid id is required' });
      if (!STATUSES.has(body.status)) return res.status(400).json({ error: 'A valid status is required' });
      const note = typeof body.resolution_note === 'string' ? body.resolution_note.trim() : '';
      if (body.status !== 'open' && !note) return badRequest(res, 'A resolution note is required');
      if (note.length > NOTE_MAX) return badRequest(res, `The resolution note is longer than ${NOTE_MAX} characters`);
      // Reopening clears the resolution, so an open item never carries a
      // stale resolver, time or note.
      const reopened = body.status === 'open';
      const result = await client.from('product_feedback').update({
        status: body.status,
        resolved_by: reopened ? null : actor,
        resolved_at: reopened ? null : new Date().toISOString(),
        resolution_note: reopened ? null : note,
      }).eq('id', body.id).select().maybeSingle();
      if (result.error) throw result.error;
      if (!result.data) return res.status(404).json({ error: 'Feedback not found' });
      return res.status(200).json({ schema_version: 'PRODUCT_FEEDBACK/V1', feedback: result.data });
    } catch (error) {
      return sendError(res, error, req.method.toLowerCase());
    }
  };
}

module.exports = {
  KINDS, STATUSES, BODY_MAX, SHORT_MAX, readFilters, createProductFeedbackHandler,
};
