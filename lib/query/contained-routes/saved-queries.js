// Path fix (S2, incidental): all three of these resolved to lib/lib/... —
// one `../` short, per ROADMAP.md P8: "the archived saved-queries.js will
// not load (imports never re-based when it moved a directory deeper)".
// Needed here because the is_admin repair below has to actually be
// require()-able to be tested for real rather than read as source — see
// tests/auth/critical-routes-repair.test.js. No behavior change: this file
// is still never imported by the live, contained pages/api/saved-queries.js.
import { getServiceSupabase } from '../../supabase.js';
// `require()` inside a file Node auto-detects as ESM (because of the
// `import` above) resolves relative to the wrong base — a Node ESM/CJS
// interop quirk, not a Next.js issue — so these are `import` too, with
// explicit .js extensions as ESM's stricter resolution requires.
import { runQuery } from '../engine.js';
import { attachVersion, versionedPayload } from '../version.js';

const DEAL_SELECT = 'id, acquirer, target, value_usd, announce_date, sector, metadata';
const PROVISION_SELECT = 'id, deal_id, type, category, full_text, ai_metadata, created_at';

function tableMissing(error) {
  return /saved_queries|schema cache|does not exist|Could not find/i.test(error && error.message ? error.message : '');
}

async function queryContext(sb) {
  const [{ data: deals, error: dErr }, { data: provisions, error: pErr }] = await Promise.all([
    sb.from('deals').select(DEAL_SELECT).order('announce_date', { ascending: false }),
    sb.from('provisions').select(PROVISION_SELECT).order('created_at', { ascending: true }),
  ]);
  if (dErr) throw new Error(dErr.message);
  if (pErr) throw new Error(pErr.message);
  return { deals: deals || [], provisions: provisions || [] };
}

async function reviewerUser(sb, requestedId) {
  if (requestedId) {
    const { data, error } = await sb.from('users').select('*').eq('id', requestedId).single();
    if (!error && data) return data;
  }
  const { data: existing, error: existingErr } = await sb
    .from('users')
    .select('*')
    .eq('name', 'Reviewer')
    .order('created_at', { ascending: true })
    .limit(1);
  if (!existingErr && existing && existing[0]) return existing[0];
  // SEC-repair (S2): this bootstrap used to insert is_admin: true, which is
  // the "admin self-grant" the July security review flagged — any caller
  // that raced to be first ever got an admin-flagged Reviewer row for free,
  // satisfying the is_featured admin check below with zero authorization of
  // any kind. is_admin now defaults false here and can only become true via
  // a direct database write; there is no code path left that a request body
  // controls. See pages/api/users.js's repair (lib/broad-corpus/contained-routes/users.js)
  // for the matching fix on the other self-grant path into this same table.
  const { data, error } = await sb.from('users').insert({ name: 'Reviewer', is_admin: false }).select('*').single();
  if (error) throw new Error(error.message);
  return data;
}

export default async function handler(req, res) {
  const sb = getServiceSupabase();
  if (!sb) return res.status(500).json({ error: 'Supabase not configured' });

  if (req.method === 'GET') {
    const { id, owner_user_id, featured } = req.query;
    let q = sb.from('saved_queries').select('*');
    if (id) q = q.eq('id', id).single();
    else {
      if (featured === '1' || featured === 'true') q = q.eq('is_featured', true);
      if (owner_user_id) q = q.eq('owner_user_id', owner_user_id);
      q = q.order('updated_at', { ascending: false });
    }
    const { data, error } = await q;
    if (error) {
      if (tableMissing(error)) return res.status(200).json(id ? { saved_query: null } : { saved_queries: [] });
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json(id ? { saved_query: attachVersion(data) } : { saved_queries: (data || []).map(attachVersion) });
  }

  if (req.method === 'POST') {
    try {
      const { query_kind, title, description, query_payload, owner_user_id } = req.body || {};
      if (!query_kind || !query_payload) return res.status(400).json({ error: 'query_kind and query_payload are required' });
      const context = await queryContext(sb);
      const stampedPayload = versionedPayload(query_payload);
      await runQuery(query_kind, stampedPayload, { context });
      const owner = await reviewerUser(sb, owner_user_id || null);
      const { data, error } = await sb.from('saved_queries').insert({
        owner_user_id: owner.id,
        query_kind,
        title: title || query_kind.replace(/_/g, ' '),
        description: description || null,
        query_payload: stampedPayload,
        is_public: false,
        is_featured: false,
        run_count: 0,
      }).select('*').single();
      if (error) return res.status(tableMissing(error) ? 501 : 500).json({ error: error.message });
      return res.status(200).json({ saved_query: attachVersion(data) });
    } catch (err) {
      return res.status(400).json({ error: err.message || 'save failed' });
    }
  }

  if (req.method === 'PATCH') {
    try {
      const { id, is_featured, owner_user_id, ...updates } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id is required' });
      if (is_featured === true) {
        const owner = await reviewerUser(sb, owner_user_id || null);
        if (!owner.is_admin) return res.status(403).json({ error: 'admin role required to feature queries' });
        updates.is_featured = true;
      } else if (is_featured === false) {
        updates.is_featured = false;
      }
      updates.updated_at = new Date().toISOString();
      if (updates.query_payload) updates.query_payload = versionedPayload(updates.query_payload);
      const { data, error } = await sb.from('saved_queries').update(updates).eq('id', id).select('*').single();
      if (error) return res.status(tableMissing(error) ? 501 : 500).json({ error: error.message });
      return res.status(200).json({ saved_query: attachVersion(data) });
    } catch (err) {
      return res.status(400).json({ error: err.message || 'update failed' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// Exported alongside the default handler (additive, no behavior change) so
// the is_admin bootstrap fix above can be exercised directly with an
// injected fake `sb` — this handler obtains its own Supabase client
// directly with no injection point, so testing it end-to-end would require
// either a real database or reaching into module internals, neither of
// which is warranted for an archive that is not wired into the live app.
// See tests/auth-critical-routes-repair.test.js.
export { reviewerUser };
