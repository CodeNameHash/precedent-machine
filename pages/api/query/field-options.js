import { getServiceSupabase } from '../../../lib/supabase';
const { loadContext } = require('../../../lib/query/context-cache');
const { fieldsForProvisionType, valueOptionsForField } = require('../../../lib/query/field-meta');

// Item 1 of Ben's query-surface UX pass: the builder's "field" and "value"
// controls need REAL choices instead of a free-text box — a field dropdown
// scoped to the chosen provision_type, and (for coded/enum fields) a value
// dropdown built from what actually occurs in the live corpus, human
// labeled via lib/taxonomy.js where a taxonomy dictionary exists.
//
//   GET /api/query/field-options?provision_type=COVENANT_NO_SOLICITATION
//     -> { fields: [{key,label,type,unit,coded,boolean,numeric}, ...] }
//
//   GET /api/query/field-options?provision_type=COVENANT_NO_SOLICITATION&field=forceTheVoteType
//     -> { type, unit, label, options: [{code,label,count}, ...] }
//
// Read-only; shares run.js's module-level corpus cache (lib/query/context-cache.js)
// rather than opening a second full-corpus fetch path.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  const { provision_type: provisionType, field } = req.query;
  if (!provisionType) return res.status(400).json({ error: 'provision_type is required' });

  const sb = getServiceSupabase();
  if (!sb) return res.status(500).json({ error: 'Supabase not configured' });

  try {
    const { provisions } = await loadContext(sb);
    if (!field) {
      return res.status(200).json({ fields: fieldsForProvisionType(provisionType) });
    }
    return res.status(200).json(valueOptionsForField(provisionType, field, provisions));
  } catch (err) {
    return res.status(400).json({ error: err.message || 'field-options failed' });
  }
}
