// Shared (deals, provisions) corpus cache for the query surface's API
// routes. Extracted out of pages/api/query/run.js's original module-level
// cache so pages/api/query/field-options.js (item 1 of Ben's query-surface
// UX pass — dependent value options for the builder's "value" field) can
// reuse the SAME warm cache within a serverless instance instead of paying
// its own multi-second full-corpus fetch on every provision-type/field
// change while someone builds a query. Same TTL/inflight-dedupe behavior as
// before; behavior for run.js is unchanged, just relocated.
//
// PostgREST caps an unranged select() at 1000 rows, so provisions are paged
// through (see fetchAllProvisions) rather than fetched in one call.

const DEAL_SELECT = 'id, acquirer, target, value_usd, announce_date, sector, metadata';
// Trimmed to the columns the query engine actually reads: types.js/
// derived-fields.js pull ai_metadata + full_text (quote text and
// spanHash()-keyed provenance joins in lib/query/prov.js both need
// full_text, so it stays), category/type drive classification, created_at
// is select-order-only (kept cheap, dropping it would only save pagination
// stability). No column here is unused by lib/query/**.
const PROVISION_SELECT = 'id, deal_id, type, category, full_text, ai_metadata, created_at';
const PROVISION_PAGE_SIZE = 1000;

// WP-7 (M5-06) demo-dryrun: staging deals (ingest_status: 'staging', e.g.
// the demo dry-run's DRYRUN-<timestamp> deal) must never surface in a query
// result. Mirrors the pages/api/home.js / pages/api/deals.js isStagingDeal
// pattern — local, not shared, per this repo's existing convention.
function isStagingDeal(deal) {
  const meta = deal && deal.metadata && typeof deal.metadata === 'object' ? deal.metadata : {};
  return meta.ingest_status === 'staging';
}

async function fetchAllProvisions(sb) {
  const out = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await sb
      .from('provisions')
      .select(PROVISION_SELECT)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + PROVISION_PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data || []));
    if (!data || data.length < PROVISION_PAGE_SIZE) break;
    offset += PROVISION_PAGE_SIZE;
  }
  return out;
}

// ── Module-level context cache ───────────────────────────────────────────
// Every query run — regardless of kind — re-fetched the ENTIRE deals table
// plus every provision row (paginated, ~12,600 rows with full_text) before
// doing any query work. That's a multi-second full-corpus fetch on every
// click into a saved/adhoc query. Cache the (deals, provisions) pair at
// module scope for a short TTL: warm hits (same serverless instance, within
// the window) skip both fetches entirely. Cold starts / a fresh Lambda
// instance still pay the full fetch once — this does not fix that, only
// repeat hits within an instance's lifetime.
const CONTEXT_CACHE_TTL_MS = 60_000;
let contextCache = null; // { deals, provisions, fetchedAt }
let contextCacheInflight = null; // Promise, so concurrent cold requests share one fetch

async function loadContext(sb) {
  const now = Date.now();
  if (contextCache && now - contextCache.fetchedAt < CONTEXT_CACHE_TTL_MS) {
    return contextCache;
  }
  if (contextCacheInflight) return contextCacheInflight;
  contextCacheInflight = (async () => {
    const [{ data: dealRows, error: dErr }, allProvisions] = await Promise.all([
      sb.from('deals').select(DEAL_SELECT).order('announce_date', { ascending: false }),
      fetchAllProvisions(sb),
    ]);
    if (dErr) throw new Error(dErr.message);
    // Staging deals (WP-7 demo-dryrun) never belong in query context —
    // filter here so the CACHED context is always staging-free.
    const deals = (dealRows || []).filter((deal) => !isStagingDeal(deal));
    const liveDealIds = new Set(deals.map((deal) => deal.id));
    const provisions = (allProvisions || []).filter((p) => liveDealIds.has(p.deal_id));
    const entry = { deals, provisions, fetchedAt: Date.now() };
    contextCache = entry;
    return entry;
  })();
  try {
    return await contextCacheInflight;
  } finally {
    contextCacheInflight = null;
  }
}

module.exports = { loadContext, isStagingDeal, DEAL_SELECT, PROVISION_SELECT };
