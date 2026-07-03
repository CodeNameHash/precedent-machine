/* ─────────────────────────────────────────────────────────────────────────
   GET/POST /api/search/provisions — cross-deal provision search.
   ───────────────────────────────────────────────────────────────────────────
   Query the WHOLE corpus (every provision across every deal) by:
     q            free text (ILIKE on clause text + category, plus a match on
                  the owning deal's acquirer/target and — where present —
                  metadata.parent_entity/target_entity/acquirer_display/
                  target_display, so "AbbVie" finds a deal filed under a
                  merger-sub name like "Bespin Subsidiary, LLC"; ts_rank-
                  ordered when the search_provisions RPC / FTS index is
                  installed, though the RPC path does not yet do the deal-name
                  match — see viaBuilder)
     type         provision type or family, comma list (TERMR → TERMR + party
                  variants TERMR-M/-B/-T); see lib/search.js
     code         canonical code(s), comma list (e.g. DEF-MAE, TERMF-TARGET)
     category     category label substring(s)
     deal_id      restrict to specific deal(s); omit = all deals
     favorability good | neutral | bad
     feature      a feature key that must be present in ai_metadata.features
                  (e.g. "carveouts", "tailProvision") — find every deal whose
                  provisions populate that structured field
     limit/offset pagination (limit ≤ 200)

   Returns { total, limit, offset, results: [{ id, deal:{…}, type, code,
   category, favorability, snippet }], ranked }. Uses the search_provisions
   RPC for ranked results when available, otherwise the PostgREST builder so it
   works on the existing schema with no migration.
   ───────────────────────────────────────────────────────────────────────── */
import { getServiceSupabase } from '../../../lib/supabase';
import {
  parseSearchParams,
  typeFamilyOrConditions,
  pgrstQuote,
  buildSnippet,
  expandFavorability,
} from '../../../lib/search';

const SELECT =
  'id, deal_id, type, category, full_text, ai_favorability, ai_metadata, ' +
  'deal:deals(id, acquirer, target, sector, announce_date)';

function shapeRow(row, q) {
  const meta = row.ai_metadata && typeof row.ai_metadata === 'object' ? row.ai_metadata : {};
  return {
    id: row.id,
    deal: row.deal
      ? {
          id: row.deal.id,
          acquirer: row.deal.acquirer,
          target: row.deal.target,
          sector: row.deal.sector,
          announce_date: row.deal.announce_date,
        }
      : { id: row.deal_id },
    type: row.type,
    code: meta.code || null,
    category: row.category,
    favorability: row.ai_favorability || null,
    snippet: buildSnippet(row.full_text, q),
  };
}

async function viaRpc(sb, p) {
  const { data, error } = await sb.rpc('search_provisions', {
    q: p.q || null,
    type_filter: p.types.length ? p.types : null,
    code_filter: p.codes.length ? p.codes : null,
    deal_filter: p.dealIds.length ? p.dealIds : null,
    fav_filter: p.favorability ? expandFavorability(p.favorability) : null,
    feature_key: p.featureKey || null,
    max_rows: p.limit,
    row_offset: p.offset,
  });
  if (error) return null; // RPC absent / not migrated → caller falls back
  const total = data && data.length ? Number(data[0].total_count) : 0;
  const results = (data || []).map((r) => ({
    id: r.id,
    deal: {
      id: r.deal_id,
      acquirer: r.acquirer,
      target: r.target,
      sector: r.sector,
      announce_date: r.announce_date,
    },
    type: r.type,
    code: r.code || null,
    category: r.category,
    favorability: r.favorability || null,
    snippet: r.snippet,
  }));
  return { total, results, ranked: true };
}

// Deal-level fields worth matching against free text: the parties as filed
// (acquirer/target) PLUS the ultimate-parent + colloquial display names
// captured in deals.metadata (see scripts/ingest-local.js,
// pages/api/ingest/from-url.js, scripts/backfill-parent-entities.js). A
// search for "AbbVie" should surface the Landos deal even though the filed
// acquirer is the merger sub "Bespin Subsidiary, LLC". PostgREST can't easily
// OR a local column against an embedded relation's JSON field in one query,
// so — per the corpus-is-small assumption already made in facets.js — fetch
// the deals table and match client/API-side, then fold the matches into the
// provisions OR-filter as a deal_id.in(...) clause.
async function matchingDealIds(sb, qRaw) {
  const needle = qRaw.toLowerCase();
  const { data, error } = await sb.from('deals').select('id, acquirer, target, metadata');
  if (error || !data) return [];
  return data
    .filter((d) => {
      const meta = d.metadata && typeof d.metadata === 'object' ? d.metadata : {};
      const fields = [
        d.acquirer,
        d.target,
        meta.parent_entity,
        meta.target_entity,
        meta.acquirer_display,
        meta.target_display,
      ];
      return fields.some((f) => typeof f === 'string' && f.toLowerCase().includes(needle));
    })
    .map((d) => d.id);
}

async function viaBuilder(sb, p) {
  let q = sb.from('provisions').select(SELECT, { count: 'exact' });

  if (p.q) {
    const safe = p.q.replace(/[%,()]/g, ' ');
    const orClauses = [`full_text.ilike.%${safe}%`, `category.ilike.%${safe}%`];
    const dealIds = await matchingDealIds(sb, p.q);
    if (dealIds.length) orClauses.push(`deal_id.in.(${dealIds.join(',')})`);
    q = q.or(orClauses.join(','));
  }
  if (p.types.length) q = q.or(typeFamilyOrConditions(p.types).join(','));
  if (p.codes.length) q = q.in('ai_metadata->>code', p.codes);
  if (p.categories.length) {
    q = q.or(p.categories.map((c) => `category.ilike.%${String(c).replace(/[%,()]/g, ' ')}%`).join(','));
  }
  if (p.dealIds.length) q = q.in('deal_id', p.dealIds);
  if (p.favorability) {
    const favVals = expandFavorability(p.favorability);
    q = favVals.length > 1 ? q.in('ai_favorability', favVals) : q.eq('ai_favorability', favVals[0] || p.favorability);
  }
  if (p.featureKey) q = q.not(`ai_metadata->features->${p.featureKey}`, 'is', null);

  // Stable, total ordering for pagination: bulk re-extracts share identical
  // created_at timestamps, so created_at alone is non-deterministic and
  // offset paging would overlap/skip rows. Tie-break on the unique id.
  q = q
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .range(p.offset, p.offset + p.limit - 1);

  const { data, error, count } = await q;
  if (error) throw new Error(error.message);
  return {
    total: count == null ? (data || []).length : count,
    results: (data || []).map((r) => shapeRow(r, p.q)),
    ranked: false,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'GET or POST only' });
  }
  const sb = getServiceSupabase();
  if (!sb) return res.status(500).json({ error: 'Supabase not configured' });

  const p = parseSearchParams(req.method === 'POST' ? req.body : req.query);

  try {
    let out = await viaRpc(sb, p);
    if (!out) out = await viaBuilder(sb, p);
    return res.status(200).json({ limit: p.limit, offset: p.offset, query: p, ...out });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Search failed' });
  }
}
