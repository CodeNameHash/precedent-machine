import { getServiceSupabase } from '../../../lib/supabase';
const { runQuery } = require('../../../lib/query/engine');
const { decodePayload } = require('../../../lib/query/fixtures');
const { slugToKind } = require('../../../lib/query/types');

const DEAL_SELECT = 'id, acquirer, target, value_usd, announce_date, sector, metadata';
const PROVISION_SELECT = 'id, deal_id, type, category, full_text, ai_metadata, created_at';

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

    const [{ data: deals, error: dErr }, { data: provisions, error: pErr }] = await Promise.all([
      sb.from('deals').select(DEAL_SELECT).order('announce_date', { ascending: false }),
      sb.from('provisions').select(PROVISION_SELECT).order('created_at', { ascending: true }),
    ]);
    if (dErr) throw new Error(dErr.message);
    if (pErr) throw new Error(pErr.message);

    const result = await runQuery(kind, payload, { context: { deals: deals || [], provisions: provisions || [] } });
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
