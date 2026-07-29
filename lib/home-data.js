// F3: shared data-shaping for the deals index. Extracted out of
// pages/api/home.js so both the /api/home route (client fetch, CDN-cached)
// and pages/index.js's getStaticProps (ISR snapshot, first-paint data) build
// the exact same { deals, search_index } shape from one code path — no
// duplicated logic to drift.
const { dealRow, dealName, resolveBuyerDisplay, resolveTargetDisplay } = require('./query/types');
const { getFeatures } = require('./feature-compare');
const { getDisplayAdvisors } = require('./canonical-advisors');
const QUALITY_METRICS_TABLE = 'deal_quality_metrics';

// DEALS-INDEX-SPEC item 8 (F1): targeted metadata->> selects instead of the
// whole `metadata` column. The 40 deals' full metadata totals ~31.7MB
// (full_text + classified_sections + extraction_runs) that this endpoint
// never uses — this select ships only the keys dealRow()/dealName()/the
// column registry actually read.
const DEAL_SELECT = [
  'id',
  'acquirer',
  'target',
  'value_usd',
  'announce_date',
  'sector',
  'ingest_status:metadata->>ingest_status',
  'acquirer_display:metadata->>acquirer_display',
  'ultimateParent:metadata->>ultimateParent',
  'ultimate_parent:metadata->>ultimate_parent',
  'parent_entity:metadata->>parent_entity',
  'target_display:metadata->>target_display',
  'target_entity:metadata->>target_entity',
  'headlineConsiderationType:metadata->>headlineConsiderationType',
  'considerationType:metadata->>considerationType',
  'deal_facts:metadata->deal_facts',
  'buyer_profile:metadata->>buyer_profile',
  'merger_form:metadata->>merger_form',
  'value_provenance:metadata->value_provenance',
  'advisors_v2:metadata->advisors_v2',
  'advisors:metadata->advisors',
].join(', ');

// F2: slim provisions select — drop full_text (nothing here reads it;
// getFeatures() reads ai_metadata) and page past Supabase's silent 1000-row
// cap so the search index covers the full corpus (12,786 rows @ 2026-07-18),
// not just the first ~8%.
const PROVISION_SELECT = 'id, deal_id, type, category, ai_metadata';
const PROVISION_PAGE_SIZE = 1000;

function isStagingDeal(row) {
  return row && row.ingest_status === 'staging';
}

function rowToDeal(row) {
  const metadata = {
    ...(row.ingest_status ? { ingest_status: row.ingest_status } : {}),
    ...(row.acquirer_display ? { acquirer_display: row.acquirer_display } : {}),
    ...(row.ultimateParent ? { ultimateParent: row.ultimateParent } : {}),
    ...(row.ultimate_parent ? { ultimate_parent: row.ultimate_parent } : {}),
    ...(row.parent_entity ? { parent_entity: row.parent_entity } : {}),
    ...(row.target_display ? { target_display: row.target_display } : {}),
    ...(row.target_entity ? { target_entity: row.target_entity } : {}),
    ...(row.headlineConsiderationType ? { headlineConsiderationType: row.headlineConsiderationType } : {}),
    ...(row.considerationType ? { considerationType: row.considerationType } : {}),
    ...(row.deal_facts ? { deal_facts: row.deal_facts } : {}),
    ...(row.buyer_profile ? { buyer_profile: row.buyer_profile } : {}),
    ...(row.merger_form ? { merger_form: row.merger_form } : {}),
    ...(row.value_provenance ? { value_provenance: row.value_provenance } : {}),
    ...(row.advisors_v2 ? { advisors_v2: row.advisors_v2 } : {}),
    ...(row.advisors ? { advisors: row.advisors } : {}),
  };
  return {
    id: row.id,
    acquirer: row.acquirer,
    target: row.target,
    value_usd: row.value_usd,
    announce_date: row.announce_date,
    sector: row.sector,
    metadata,
  };
}

function sizeBand(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n < 1e9) return '<$1B';
  if (n < 1e10) return '$1B-$10B';
  return '>$10B';
}

function publicDeal(deal, provisionCounts, dealStructures, mergerForms) {
  const row = dealRow(deal);
  const meta = deal.metadata || {};
  const advisors = getDisplayAdvisors(meta);
  const valueProvenance = meta.value_provenance && typeof meta.value_provenance === 'object' ? meta.value_provenance : null;
  return {
    id: deal.id,
    deal_name: row.deal_name,
    buyer_display: resolveBuyerDisplay(deal),
    target_display: resolveTargetDisplay(deal),
    signing_date: row.signing_date,
    value: row.total_deal_value,
    value_band: sizeBand(row.total_deal_value),
    value_provenance: valueProvenance,
    consideration_type: row.consideration_type,
    buyer_profile: meta.buyer_profile || null,
    sector: deal.sector || null,
    structure: (dealStructures && dealStructures.get(deal.id)) || null,
    merger_form: meta.merger_form || (mergerForms && mergerForms.get(deal.id)) || null,
    advisors: {
      buyer_firms: advisors.buyerFirms,
      seller_firms: advisors.sellerFirms,
      buyer_lawyers: advisors.buyerLawyers || [],
      seller_lawyers: advisors.sellerLawyers || [],
    },
    provision_count: provisionCounts.has(deal.id) ? provisionCounts.get(deal.id) : null,
  };
}

function canonicalStructureCode(raw) {
  if (raw == null) return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    if ('value' in raw) return canonicalStructureCode(raw.value);
    if ('code' in raw) return canonicalStructureCode(raw.code);
    return null;
  }
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toUpperCase().replace(/[\s-]+/g, '_');
  return code || null;
}

// dealStructure is the canonical one-step / two-step-tender dimension. It is
// distinct from metadata.merger_form, which captures the more detailed legal
// form (reverse triangular, double dummy, asset purchase, etc.).
function computeDealStructures(provisions) {
  const structures = new Map();
  for (const provision of provisions || []) {
    const feats = getFeatures(provision);
    const code = canonicalStructureCode(feats.dealStructure);
    if (!code || !provision.deal_id) continue;
    const current = structures.get(provision.deal_id);
    if (!current || (current === 'OTHER' && code !== 'OTHER')) structures.set(provision.deal_id, code);
  }
  return structures;
}

function computeMergerForms(provisions) {
  const mergerForms = new Map();
  for (const provision of provisions || []) {
    const code = canonicalStructureCode(getFeatures(provision).mergerForm);
    if (!code || !provision.deal_id) continue;
    if (!mergerForms.has(provision.deal_id)) mergerForms.set(provision.deal_id, code);
  }
  return mergerForms;
}

function definedTerms(provisions, dealsById) {
  const out = [];
  for (const provision of provisions || []) {
    if (provision.type !== 'DEF') continue;
    const features = getFeatures(provision);
    const label = features.mainConcept && typeof features.mainConcept === 'object' && 'value' in features.mainConcept
      ? features.mainConcept.value
      : features.mainConcept;
    if (!label) continue;
    const deal = dealsById.get(provision.deal_id);
    out.push({
      type: 'term',
      label: String(label).slice(0, 120),
      detail: deal ? dealName(deal) : 'Defined term',
      href: `/review-v1/${provision.deal_id}/provision/${provision.id}`,
    });
  }
  return out.slice(0, 80);
}

function provisionHits(provisions, dealsById) {
  return (provisions || []).slice(0, 250).map((provision) => {
    const deal = dealsById.get(provision.deal_id);
    return {
      type: 'provision',
      label: provision.category || provision.type || 'Provision',
      detail: deal ? dealName(deal) : 'Provision',
      href: `/review-v1/${provision.deal_id}/provision/${provision.id}`,
    };
  });
}

// Pages past Supabase's silent 1000-row cap. Deliberately SERIAL (one
// in-flight request at a time) rather than fanning out all pages in
// parallel — this shared Supabase instance is concurrency-sensitive, and a
// single request should never multiply its own connection footprint. ~13
// round trips over 12,786 rows @ 2026-07-18; still cheaper than the payload
// the old whole-metadata select carried per deal.
async function fetchAllProvisions(sb) {
  const out = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await sb
      .from('provisions')
      .select(PROVISION_SELECT)
      .order('created_at', { ascending: true })
      .range(offset, offset + PROVISION_PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data || []));
    if (!data || data.length < PROVISION_PAGE_SIZE) break;
    offset += PROVISION_PAGE_SIZE;
  }
  return out;
}

async function fetchProvisionCounts(sb, dealIds) {
  const counts = new Map();
  if (!dealIds.length) return counts;
  const { data, error } = await sb
    .from(QUALITY_METRICS_TABLE)
    .select('deal_id, provision_count')
    .in('deal_id', dealIds);
  if (error) return counts;
  for (const row of data || []) {
    if (row && row.deal_id) counts.set(row.deal_id, Number(row.provision_count) || 0);
  }
  return counts;
}

// Builds the { deals, search_index } payload the deals index consumes.
// Shared by pages/api/home.js (live client fetch) and pages/index.js's
// getStaticProps (ISR snapshot rendered at build/revalidate time) so both
// paths produce byte-for-byte the same shape from one code path.
//
// `sb` is an already-constructed Supabase client (getServiceSupabase()).
// Throws on query failure — callers decide how to handle that (500 for the
// API route, fail-soft empty props for getStaticProps).
async function fetchHomeData(sb) {
  // Deliberately serial (not Promise.all-fanned-out): one Supabase round
  // trip in flight at a time per request, out of respect for a shared
  // instance that concurrent load can overwhelm.
  const { data: dealRows, error: dErr } = await sb
    .from('deals').select(DEAL_SELECT).order('announce_date', { ascending: false });
  if (dErr) throw new Error(dErr.message);

  // F5: staging deals never belong on the public index.
  const liveRows = (dealRows || []).filter((row) => !isStagingDeal(row));
  const deals = liveRows.map(rowToDeal);
  const dealsById = new Map(deals.map((deal) => [deal.id, deal]));

  const provisions = await fetchAllProvisions(sb);
  const provisionCounts = await fetchProvisionCounts(sb, deals.map((deal) => deal.id));
  const dealStructures = computeDealStructures(provisions);
  const mergerForms = computeMergerForms(provisions);

  const searchIndex = [
    ...deals.map((deal) => ({ type: 'deal', label: dealName(deal), detail: [deal.sector, deal.announce_date].filter(Boolean).join(' · '), href: `/review/${deal.id}` })),
    ...provisionHits(provisions, dealsById),
    ...definedTerms(provisions, dealsById),
  ];

  return {
    deals: deals.map((deal) => publicDeal(deal, provisionCounts, dealStructures, mergerForms)),
    search_index: searchIndex,
  };
}

module.exports = {
  fetchHomeData,
  // exported for tests / reuse
  DEAL_SELECT,
  PROVISION_SELECT,
  rowToDeal,
  publicDeal,
  isStagingDeal,
  computeDealStructures,
  computeMergerForms,
};
