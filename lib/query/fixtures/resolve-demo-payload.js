/* lib/query/fixtures/resolve-demo-payload.js
 *
 * The demo-set fixture (demo-set.json) references deals by NAME SUBSTRING —
 * not by id — because ids are environment-stable but names are the
 * reviewable, PR-diffable form (per WP-1 spec). This module resolves those
 * substring tokens against a live `deals` array at run time:
 *
 *   "@deal:Redfin"  -> the single matching deal's id (throws if 0 or >1 match)
 *   "@all_deals"    -> every deal id in the corpus, in the given order
 *
 * Used by both scripts/query-demo-check.js (live, real corpus) and
 * tests/query/demo-set.test.js (offline, a small stub deals array).
 */

function resolveDealId(deals, nameSubstring) {
  const needle = String(nameSubstring || '').toLowerCase();
  const matches = (deals || []).filter((d) => `${d.acquirer || ''} ${d.target || ''}`.toLowerCase().includes(needle));
  if (matches.length === 0) throw new Error(`BLOCKED_DEAL_MISSING: no deal matches "${nameSubstring}"`);
  if (matches.length > 1) {
    throw new Error(`BLOCKED_DEAL_AMBIGUOUS: "${nameSubstring}" matches ${matches.length} deals: ${matches.map((d) => `${d.acquirer} / ${d.target}`).join(', ')}`);
  }
  return matches[0].id;
}

function resolveDemoPayload(payload, deals) {
  if (Array.isArray(payload)) return payload.map((v) => resolveDemoPayload(v, deals));
  if (payload && typeof payload === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(payload)) out[k] = resolveDemoPayload(v, deals);
    return out;
  }
  if (typeof payload === 'string' && payload === '@all_deals') return (deals || []).map((d) => d.id);
  if (typeof payload === 'string' && payload.startsWith('@deal:')) return resolveDealId(deals, payload.slice('@deal:'.length));
  return payload;
}

module.exports = { resolveDealId, resolveDemoPayload };
