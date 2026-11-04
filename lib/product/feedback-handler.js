'use strict';

// Feedback anywhere (work package 3): POST from any signed-in page, GET and
// PATCH for the admin page. The record carries the exact context the reader
// was looking at and the reviewer's level; a partner's or senior associate's
// feedback is flagged trusted, nothing changes a fact automatically.

const { getProductActor, requireSameOriginMutation, ProductRequestAuthError } = require('./request-auth');
const { reviewerForRequest, adminActor, isReviewerLevel } = require('./reviewers');

const KINDS = new Set(['WRONG_ANSWER', 'MISSING', 'UNCLEAR', 'OTHER']);
const STATUSES = new Set(['open', 'accepted', 'rejected', 'done']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
        if (!body.run_id || typeof body.run_id !== 'string' || !UUID.test(body.run_id)) return res.status(400).json({ error: 'run_id is required' });
        const reviewer = await reviewerResolver({ req, client });
        const row = {
          run_id: body.run_id,
          page_path: typeof body.page_path === 'string' ? body.page_path.slice(0, 500) : null,
          section_key: typeof body.section_key === 'string' ? body.section_key.slice(0, 200) : null,
          table_key: typeof body.table_key === 'string' ? body.table_key.slice(0, 200) : null,
          row_subject: typeof body.row_subject === 'string' ? body.row_subject.slice(0, 300) : null,
          column_id: typeof body.column_id === 'string' ? body.column_id.slice(0, 120) : null,
          cell_code: typeof body.cell_code === 'string' ? body.cell_code.slice(0, 200) : null,
          cell_label: typeof body.cell_label === 'string' ? body.cell_label.slice(0, 500) : null,
          fact_ids: Array.isArray(body.fact_ids) ? body.fact_ids.filter((id) => typeof id === 'string').slice(0, 50) : [],
          kind: body.kind,
          body: text.slice(0, 10000),
          author_id: actor,
          author_name: reviewer?.name || actor,
          author_level: isReviewerLevel(reviewer?.level) ? reviewer.level : null,
          status: 'open',
        };
        const result = await client.from('product_feedback').insert(row).select().maybeSingle();
        if (result.error) throw result.error;
        return res.status(201).json({ schema_version: 'PRODUCT_FEEDBACK/V1', feedback: result.data, trusted: reviewer?.trusted === true });
      }
      if (!admin) {
        const error = new Error('admin only');
        error.code = 'FORBIDDEN';
        throw error;
      }
      if (req.method === 'GET') {
        let query = client.from('product_feedback').select('*').order('created_at', { ascending: false }).limit(500);
        const status = first(req.query?.status);
        const run = first(req.query?.run);
        const level = first(req.query?.level);
        const kind = first(req.query?.kind);
        if (status) query = query.eq('status', status);
        if (run) query = query.eq('run_id', run);
        if (level) query = query.eq('author_level', level);
        if (kind) query = query.eq('kind', kind);
        const result = await query;
        if (result.error) throw result.error;
        return res.status(200).json({ schema_version: 'PRODUCT_FEEDBACK/V1', feedback: result.data || [] });
      }
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      if (!body.id || !UUID.test(body.id)) return res.status(400).json({ error: 'A valid id is required' });
      if (!STATUSES.has(body.status)) return res.status(400).json({ error: 'A valid status is required' });
      if (body.status !== 'open' && !(typeof body.resolution_note === 'string' && body.resolution_note.trim())) {
        return res.status(400).json({ error: 'A resolution note is required' });
      }
      const result = await client.from('product_feedback').update({
        status: body.status,
        resolved_by: actor,
        resolved_at: body.status === 'open' ? null : new Date().toISOString(),
        resolution_note: typeof body.resolution_note === 'string' ? body.resolution_note.trim().slice(0, 2000) : null,
      }).eq('id', body.id).select().maybeSingle();
      if (result.error) throw result.error;
      if (!result.data) return res.status(404).json({ error: 'Feedback not found' });
      return res.status(200).json({ schema_version: 'PRODUCT_FEEDBACK/V1', feedback: result.data });
    } catch (error) {
      return sendError(res, error, req.method.toLowerCase());
    }
  };
}

module.exports = { KINDS, STATUSES, createProductFeedbackHandler };
