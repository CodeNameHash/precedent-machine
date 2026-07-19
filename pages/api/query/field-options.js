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

  // The fields list is pure registry/rubric metadata — no corpus needed, so
  // it answers even when Supabase is down/unconfigured (fail-soft: the
  // builder's field dropdown must never depend on DB availability).
  if (!field) {
    try {
      return res.status(200).json({ fields: fieldsForProvisionType(provisionType) });
    } catch (err) {
      return res.status(400).json({ error: err.message || 'field-options failed' });
    }
  }

  // Value options: type/unit/label are static metadata too; only the coded
  // options list needs the corpus. If the DB is down (or Supabase isn't
  // configured), degrade to an empty options list rather than erroring — the
  // client then falls back to a free-text input for coded fields while
  // boolean/numeric controls still render correctly.
  let provisions = [];
  const sb = getServiceSupabase();
  if (sb) {
    try {
      ({ provisions } = await loadContext(sb));
    } catch {
      provisions = [];
    }
  }
  try {
    return res.status(200).json(valueOptionsForField(provisionType, field, provisions));
  } catch (err) {
    return res.status(400).json({ error: err.message || 'field-options failed' });
  }
}
