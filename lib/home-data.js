// F3: shared data-shaping for the deals index. Extracted out of
// pages/api/home.js so both the /api/home route (client fetch, CDN-cached)
// and pages/index.js's getStaticProps (ISR snapshot, first-paint data) build
// the exact same { deals, search_index } shape from one code path — no
// duplicated logic to drift.
const { dealRow, dealName, resolveBuyerDisplay, resolveTargetDisplay } = require('./query/types');
const { getFeatures } = require('./feature-compare');
const { getDisplayAdvisors } = require('./canonical-advisors');
const { QUALITY_METRICS_TABLE } = require('./deal-quality-metrics');
const { computeDerivedField, parseUsdAmount } = require('./query/derived-fields');

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
  if (!Number.isFinite(n)) return null;
  if (n < 1e9) return '<$1B';
  if (n < 1e10) return '$1B-$10B';
  return '>$10B';
}

function publicDeal(deal, provisionCounts, dealSignals) {
  const row = dealRow(deal);
  const meta = deal.metadata || {};
  const advisors = getDisplayAdvisors(meta);
  const valueProvenance = meta.value_provenance && typeof meta.value_provenance === 'object' ? meta.value_provenance : null;
  const signals = (dealSignals && dealSignals.get(deal.id)) || {};
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
    merger_form: meta.merger_form || null,
    advisors: {
      buyer_firms: advisors.buyerFirms,
      seller_firms: advisors.sellerFirms,
      buyer_lawyers: advisors.buyerLawyers || [],
      seller_lawyers: advisors.sellerLawyers || [],
    },
    provision_count: provisionCounts.has(deal.id) ? provisionCounts.get(deal.id) : null,
    // DEALS-INDEX-SPEC (2026-07-19) item 5: server-side scalars only — never
    // raw provisions.ai_metadata.features — so the payload stays small. See
    // computeDealSignals() below for how each is derived.
    termination_fee: signals.companyTerminationFee || null,
    reverse_termination_fee: signals.reverseTerminationFee || null,
    outside_date_months: signals.outsideDateMonths != null ? signals.outsideDateMonths : null,
    go_shop: signals.goShop != null ? signals.goShop : null,
  };
}

// ── deals-index scalar signals (Ben, 2026-07-19: Company termination fee,
// Reverse termination fee, Outside date, Go-shop columns) ──────────────────
// Computed once per fetchHomeData() call from the SAME provisions array
// already fetched for search_index (fetchAllProvisions) — no extra Supabase
// round trip, and only small scalars are attached to each deal, never the
// raw features object.
function unwrapBool(v) {
  if (v == null) return null;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'object' && !Array.isArray(v) && 'value' in v) return unwrapBool(v.value);
  return Boolean(v);
}

function unwrapNumber(v) {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'object' && !Array.isArray(v) && 'value' in v) return unwrapNumber(v.value);
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function computeDealSignals(provisions, dealsById) {
  const signals = new Map();
  function bucket(dealId) {
    if (!signals.has(dealId)) signals.set(dealId, {});
    return signals.get(dealId);
  }

  for (const provision of provisions || []) {
    const category = provision.category || '';
    const out = bucket(provision.deal_id);
    const feats = getFeatures(provision);

    // Company termination fee: amount from the TERMF-TARGET card's
    // companyTerminationFee claim; pct reuses lib/query/derived-fields.js's
    // feePctOfDealValue derived field (amount / deals.value_usd) — same
    // query-time derivation the Query engine already exposes, not a
    // reimplementation.
    if (category === 'TERMF-TARGET' && feats.companyTerminationFee) {
      const raw = feats.companyTerminationFee;
      const amount = parseUsdAmount(raw && typeof raw === 'object' ? raw.amount : raw);
      if (amount != null) {
        const deal = dealsById.get(provision.deal_id);
        const derived = computeDerivedField('TERMINATION_FEE', 'feePctOfDealValue', provision, deal);
        out.companyTerminationFee = { amount, pct: derived ? derived.value : null };
      }
    }

    // Reverse termination fee: same amount shape on the TERMF-REVERSE card,
    // no deal-value-percentage column requested for this one.
    if (category === 'TERMF-REVERSE' && feats.reverseTerminationFee) {
      const raw = feats.reverseTerminationFee;
      const amount = parseUsdAmount(raw && typeof raw === 'object' ? raw.amount : raw);
      if (amount != null) out.reverseTerminationFee = { amount };
    }

    // Outside date: outsideDateMonthsPostSigning is ALREADY a canonical,
    // deterministically-computed field (lib/parser-v2/extract.js's
    // computeOutsideDateMonths post-pass) — surfaced here, not re-derived.
    if (category === 'TERMR-OUTSIDE' && feats.outsideDateMonthsPostSigning != null) {
      const months = unwrapNumber(feats.outsideDateMonthsPostSigning);
      if (months != null) out.outsideDateMonths = months;
    }

    // Go-shop: goShopPresent lives on the NOSOL-ACQPROPOSAL card. A deal
    // with no such card at all leaves go_shop as null (unknown), distinct
    // from an explicit false (no go-shop) on a card that IS present.
    if (category === 'NOSOL-ACQPROPOSAL' && 'goShopPresent' in feats) {
      const present = unwrapBool(feats.goShopPresent);
      if (present != null) out.goShop = present;
    }
  }

  return signals;
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
  const dealSignals = computeDealSignals(provisions, dealsById);

  const searchIndex = [
    ...deals.map((deal) => ({ type: 'deal', label: dealName(deal), detail: [deal.sector, deal.announce_date].filter(Boolean).join(' · '), href: `/review/${deal.id}` })),
    ...provisionHits(provisions, dealsById),
    ...definedTerms(provisions, dealsById),
  ];

  return {
    deals: deals.map((deal) => publicDeal(deal, provisionCounts, dealSignals)),
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
  computeDealSignals,
};
