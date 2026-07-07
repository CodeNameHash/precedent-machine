import { getServiceSupabase } from '../../../../lib/supabase';

function fail(res, status, error) {
  return res.status(status).json({ error });
}

function first(value) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return fail(res, 405, 'method_not_allowed');

  const dealId = first(req.query.deal_id);
  const key = first(req.query.key);
  if (!key) return fail(res, 400, 'missing_key');

  const sb = getServiceSupabase();
  if (!sb || !dealId) {
    return res.status(200).json({ available: false, key, value: null, message: 'not yet extracted' });
  }

  try {
    const { data, error } = await sb
      .from('provision_cards')
      .select('id, deal_id, type, code, card_json, text')
      .eq('deal_id', dealId)
      .or(`key.eq.${key},field_key.eq.${key},code.eq.${key}`)
      .limit(5);

    if (error) {
      return res.status(200).json({ available: false, key, value: null, message: error.message || 'not yet extracted' });
    }

    return res.status(200).json({ available: true, key, deal_id: dealId, rows: data || [] });
  } catch (error) {
    return res.status(200).json({ available: false, key, value: null, message: error.message || 'not yet extracted' });
  }
}
