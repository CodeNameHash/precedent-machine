// The index's released V2 rows, read at build time so the row is in the
// server HTML rather than only in the browser: the index must show a release
// even if a client fetch fails (work package 53, finding (296)).
const { createClient } = require('@supabase/supabase-js');

// The client is created here rather than through lib/supabase.js: that module
// is ESM, and requiring it from this CommonJS module during next build yields
// an interop stub whose exports are not callable (2026-10-27, "n is not a
// function" at build time).
function productClient() {
  const url = process.env.PRODUCT_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.PRODUCT_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function releasedIndexRows({ client = null } = {}) {
  const db = client || productClient();
  if (!db) return [];
  const heads = await db.from('product_agreement_release_heads')
    .select('source_document_id, release_id, released_with_warning, release_warning');
  if (heads.error) throw new Error(`released index heads: ${heads.error.message}`);
  const releases = await db.from('product_agreement_releases').select('release_id, run_id, summary, published_at');
  if (releases.error) throw new Error(`released index releases: ${releases.error.message}`);
  const sources = await db.from('product_source_documents').select('source_document_id, retrieval_url, payload');
  if (sources.error) throw new Error(`released index sources: ${sources.error.message}`);
  const releaseById = new Map((releases.data || []).map((entry) => [entry.release_id, entry]));
  const sourceById = new Map((sources.data || []).map((entry) => [entry.source_document_id, entry]));
  const nameOf = (party) => (typeof party === 'string' ? party : party?.name) || null;
  return (heads.data || []).map((head) => {
    const release = releaseById.get(head.release_id) || null;
    const source = sourceById.get(head.source_document_id) || null;
    const parties = Array.isArray(source?.payload?.parties) ? source.payload.parties : [];
    const target = nameOf(parties.find((party) => (party?.role || '') === 'COMPANY'));
    const acquirer = nameOf(parties.find((party) => (party?.role || '') === 'PARENT'));
    const facts = (release?.summary?.families || []).flatMap((family) => family.facts || []);
    return {
      id: head.source_document_id,
      deal_name: target && acquirer ? `${target} / ${acquirer}` : (source?.retrieval_url || head.source_document_id),
      signing_date: source?.payload?.agreement_date || null,
      buyer_display: target || null,
      target_display: acquirer || null,
      v2: true,
      review_warning: head.released_with_warning === true,
      released_at: release?.published_at || null,
      fact_count: facts.length,
    };
  });
}

module.exports = { releasedIndexRows };
