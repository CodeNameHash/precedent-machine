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

const { validateProvisionRow } = require('../../../lib/feature-validation');

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

  // Schema conformance: every row's feature bag validated against the rubric.
  const schema = { rows: (provisions || []).length, rows_with_errors: 0, rows_with_warnings: 0, top: {} };
  for (const p of provisions || []) {
    const r = validateProvisionRow(p);
    if (r.errors.length) schema.rows_with_errors += 1;
    else if (r.warnings.length) schema.rows_with_warnings += 1;
    for (const v of [...r.errors, ...r.warnings]) {
      const k = `${v.kind}:${v.key || '?'}`;
      schema.top[k] = (schema.top[k] || 0) + 1;
    }
  }
  schema.top = Object.fromEntries(Object.entries(schema.top).sort((a, b) => b[1] - a[1]).slice(0, 12));

  // Novelty: proposed codes awaiting approval + extraction flags. These are
  // things the taxonomy did NOT cleanly absorb — surfaced, never buried.
  const novelty = { proposed_codes: [], flags: [] };
  for (const p of provisions || []) {
    if (typeof p.category === 'string' && p.category.startsWith('[PROPOSED]')) {
      novelty.proposed_codes.push({ provision_id: p.id, type: p.type, category: p.category });
    }
    const flags = ((p.ai_metadata || {}).features || {}).flags;
    if (Array.isArray(flags)) {
      for (const f of flags) {
        if (f && (f.concern || f.text)) {
          novelty.flags.push({ provision_id: p.id, type: p.type, category: p.category, concern: f.concern || null, text: (f.text || '').slice(0, 300) });
        }
      }
    }
  }

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
    schema,
    novelty,
  });
}
