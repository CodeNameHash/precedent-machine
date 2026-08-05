// lib/broad-corpus/contained-routes/users.js
//
// The repaired implementation behind pages/api/users.js. NOT wired in —
// that route still resolves to createBroadCorpusContainedHandler(['GET',
// 'POST']) (503) exactly as before. Un-containing it is separate work (see
// ROADMAP.md "Do not... turn them on"); this file exists so the fix is real
// code, reviewable and tested, not just a description, and so wiring it in
// later is a one-line swap — the same shape lib/query/contained-routes/
// already uses for the query family (see pages/api/saved-queries.js).
//
// Restored from git history (pages/api/users.js as of commit ea714a5d^,
// before commit ea714a5d "fix(api): close users and zero-import market
// stats" replaced it with the containment stub), with one fix:
//
// SEC-repair (S2): the July security review's finding was that POST read
// `is_admin` straight off the request body — `insert({ name, is_admin:
// is_admin || false })` — so any caller could self-grant admin on the row
// they were creating. This version no longer reads is_admin from the
// request at all. Every user created through this route is is_admin: false;
// there is no request-controlled path to true. If a real "make someone
// admin" need ever exists, it should be a direct database write, not a body
// parameter on a public create-user call — same reasoning as the matching
// fix in lib/query/contained-routes/saved-queries.js `reviewerUser()`,
// which had the same bug from the other direction (an auto-created
// "Reviewer" row defaulting to is_admin: true).
//
// Written as CommonJS (module.exports), not the original file's `import`/
// `export default` — matching the convention every other directly
// unit-tested lib/ module in this codebase uses (lib/api-auth.js,
// lib/broad-corpus-containment.js, lib/query-containment.js), so it loads
// under plain `node --test` without depending on a given Node version's
// ESM-in-CommonJS auto-detection.
const { getServiceSupabase } = require('../../supabase');

function createUsersHandler({ getSupabase = getServiceSupabase } = {}) {
  return async function handler(req, res) {
    const sb = getSupabase();
    if (!sb) return res.status(500).json({ error: 'Supabase not configured' });

    if (req.method === 'GET') {
      const { data, error } = await sb.from('users').select('*').order('name');
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ users: data });
    }

    if (req.method === 'POST') {
      const { name } = req.body || {};
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: 'name is required' });
      }
      const { data, error } = await sb.from('users').insert({ name, is_admin: false }).select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ user: data });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  };
}

module.exports = { createUsersHandler, default: createUsersHandler() };
