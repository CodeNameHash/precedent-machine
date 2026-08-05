import { getServiceSupabase } from '../../../../lib/supabase';
import { fetchReviewDealCards } from '../../../../lib/queries/review-deal';
import { trimReviewDealForWire } from '../../../../lib/queries/review-deal-wire';
import { attachCanonicalV2Preview } from '../../../../lib/canonical-v2/review-preview-assembly';

// Cap runaway executions: when Supabase stalls, uncapped functions run the
// full 300s each holding a DB connection (2026-07-19 pile-up).
export const config = { maxDuration: 60 };

function fail(res, status, error) {
  return res.status(status).json({ error });
}

// E4 (2026-07-19 pre-demo audit): a non-uuid `id` (garbage in the URL, a
// stray trailing token, a hand-typed slug) reached fetchReviewDealCards()'s
// Supabase `.eq('id', dealId)` queries unchecked. Postgres's uuid column
// rejects the literal at the SQL level ("invalid input syntax for type
// uuid"), which surfaced as a generic thrown Error and got mapped to a 500
// below — reads as a server bug, not "this deal doesn't exist". Reject the
// obviously-malformed shape up front as a 404, same as a well-formed uuid
// that just doesn't match any row.
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return fail(res, 405, 'GET only');
  }

  const dealId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
  if (!dealId) return fail(res, 400, 'deal id required');
  if (!UUID_RE.test(dealId)) return fail(res, 404, 'Deal not found');
  const rawMode = Array.isArray(req.query.mode) ? req.query.mode[0] : req.query.mode;
  const mode = rawMode === 'admin' ? 'admin' : 'user';

  const sb = getServiceSupabase();
  if (!sb) return fail(res, 500, 'Supabase not configured');

  try {
    const reviewDeal = await fetchReviewDealCards(dealId, sb, { mode });
    // Canonical V2 dark-bridge preview (pre-production activation phase,
    // see docs/codex-program/ADR-001-dark-bridge-flattening-is-scaffolding.md):
    // read-time only, gated by isDarkBridgeIntegrationEnabled() inside
    // attachCanonicalV2Preview itself, so this is a no-op (same reference)
    // everywhere the gate isn't explicitly on. Attached here rather than
    // inside fetchReviewDealCards so the preview stays scoped to this one
    // served route — fetchReviewDealCards is also called directly by
    // scripts/demo-dryrun.js, which has no reason to carry preview concerns.
    const previewedReviewDeal = await attachCanonicalV2Preview(reviewDeal, { env: process.env });
    // Q6 (perf quick-wins): response is deal_id-scoped provision-card data,
    // identical for every viewer of this deal — no user-specific content —
    // safe to cache at the CDN edge with SWR.
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');
    // Q1/Q2: trim sections[]/definitions[]/resolvedReferences/
    // region_full_text/full provenance off the wire — see
    // lib/queries/review-deal-wire.js for what and why.
    return res.status(200).json({ reviewDeal: trimReviewDealForWire(previewedReviewDeal) });
  } catch (error) {
    return fail(res, 500, error.message || String(error));
  }
}
