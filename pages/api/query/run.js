import { getServiceSupabase } from '../../../lib/supabase';
const { runQuery } = require('../../../lib/query/engine');
const { decodePayload } = require('../../../lib/query/fixtures');
const { slugToKind } = require('../../../lib/query/types');
const { attachExtractionVersions } = require('../../../lib/query/prov');
// Module-level (deals, provisions) cache — shared with
// pages/api/query/field-options.js so both routes warm the same cache
// within a serverless instance instead of each paying their own
// multi-second full-corpus fetch. See lib/query/context-cache.js for the
// TTL/inflight-dedupe details (unchanged from this file's original inline
// version, just relocated so it's reusable).
const { loadContext } = require('../../../lib/query/context-cache');

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'GET or POST only' });
  const sb = getServiceSupabase();
  if (!sb) return res.status(500).json({ error: 'Supabase not configured' });

  const source = req.method === 'GET' ? req.query : req.body;
  let kind = slugToKind(source.kind);
  let payload = source.payload;
  try {
    let savedQuery = null;
    const id = source.id || source.query_id;
    if (id && id !== 'adhoc') {
      const { data, error } = await sb.from('saved_queries').select('*').eq('id', id).single();
      if (error) throw new Error(error.message);
      savedQuery = data;
      kind = savedQuery.query_kind;
      payload = savedQuery.query_payload;
    } else {
      if (typeof payload === 'string') payload = decodePayload(payload);
      if (!payload && source.query_payload) payload = source.query_payload;
    }

    const { deals, provisions } = await loadContext(sb);

    const result = await runQuery(kind, payload, { context: { deals, provisions } });
    // WP-3 (M4-02): one extra, serial, read-only batch fetch — never
    // per-cell — to resolve each cell's `_prov.extraction_version` off
    // provision_cards.provenance. No-ops (issues zero queries) when the
    // result carries no `_prov` stubs at all.
    await attachExtractionVersions(result, { provisions: provisions || [], sb });
    if (savedQuery) {
      await sb.from('saved_queries').update({
        last_run_at: new Date().toISOString(),
        run_count: Number(savedQuery.run_count || 0) + 1,
      }).eq('id', savedQuery.id);
    }
    return res.status(200).json({ result, saved_query: savedQuery });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'query failed' });
  }
}
