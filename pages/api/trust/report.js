/* ─────────────────────────────────────────────────────────────────────────
   GET /api/trust/report?deal_id=… — the deal's trust report.
   ───────────────────────────────────────────────────────────────────────────
   Answers, from stored data alone (no AI calls):
     • quotes   — how many extracted "verbatim" quotes actually appear in the
                  agreement source (verified vs. unverified, with the failing
                  quotes listed for triage)
     • coverage — what % of the agreement's text is captured by some provision,
                  plus the largest uncovered gaps with previews

   Pure read: safe to call repeatedly; cost is a few hundred substring searches.
   ───────────────────────────────────────────────────────────────────────── */
import { getServiceSupabase } from '../../../lib/supabase';
import { verifyDealQuotes, computeCoverage } from '../../../lib/verification';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  const dealId = req.query.deal_id;
  if (!dealId) return res.status(400).json({ error: 'deal_id is required' });

  const sb = getServiceSupabase();
  if (!sb) return res.status(500).json({ error: 'Supabase not configured' });

  const [{ data: deal, error: dErr }, { data: provisions, error: pErr }] = await Promise.all([
    sb.from('deals').select('id, acquirer, target, metadata').eq('id', dealId).single(),
    sb.from('provisions').select('id, type, category, full_text, ai_metadata').eq('deal_id', dealId),
  ]);
  if (dErr) return res.status(404).json({ error: dErr.message });
  if (pErr) return res.status(500).json({ error: pErr.message });

  const sourceText = (deal && deal.metadata && deal.metadata.full_text) || '';
  if (!sourceText) {
    return res.status(200).json({
      deal_id: dealId,
      error: 'No stored source text for this deal — cannot verify',
      quotes: null,
      coverage: null,
    });
  }

  const quotes = verifyDealQuotes(provisions || [], sourceText);
  const coverage = computeCoverage(provisions || [], sourceText);

  // Cap the failure payload; full triage lists can page later if needed.
  const failures = quotes.failures.slice(0, 100);

  return res.status(200).json({
    deal_id: dealId,
    deal: { acquirer: deal.acquirer, target: deal.target },
    provision_count: (provisions || []).length,
    quotes: {
      total: quotes.total,
      verified: quotes.verified,
      unverified: quotes.unverified,
      skipped_too_short: quotes.skipped,
      verified_pct: quotes.total - quotes.skipped > 0
        ? Math.round((quotes.verified / (quotes.total - quotes.skipped)) * 1000) / 10
        : null,
      failures,
    },
    coverage,
  });
}
