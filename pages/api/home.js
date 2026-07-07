import { getServiceSupabase } from '../../lib/supabase';
const { runQuery } = require('../../lib/query/engine');
const { featuredQueries, encodePayload } = require('../../lib/query/fixtures');
const { dealRow, dealName, featureDefsForWpType, kindToSlug } = require('../../lib/query/types');
const { getFeatures } = require('../../lib/feature-compare');

const DEAL_SELECT = 'id, acquirer, target, value_usd, announce_date, sector, metadata';
const PROVISION_SELECT = 'id, deal_id, type, category, full_text, ai_metadata, created_at';
const FIELD_PATH = 'field_path';

function sizeBand(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n < 1e9) return '<$1B';
  if (n < 1e10) return '$1B-$10B';
  return '>$10B';
}

function publicDeal(deal) {
  const row = dealRow(deal);
  return {
    id: deal.id,
    deal_name: row.deal_name,
    parties: row.deal_name,
    signing_date: row.signing_date,
    value: row.total_deal_value,
    value_band: sizeBand(row.total_deal_value),
    consideration_type: row.consideration_type,
    sector: deal.sector || null,
  };
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
      href: `/review/${provision.deal_id}/provision/${provision.id}`,
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
      href: `/review/${provision.deal_id}/provision/${provision.id}`,
    };
  });
}

async function featuredFromDb(sb) {
  const { data, error } = await sb
    .from('saved_queries')
    .select('*')
    .eq('is_featured', true)
    .order('updated_at', { ascending: false })
    .limit(6);
  if (error) return null;
  if (!data || data.length === 0) return null;
  return data.map((row) => ({
    id: row.id,
    query_kind: row.query_kind,
    title: row.title,
    description: row.description,
    href: `/query/${kindToSlug(row.query_kind)}/${row.id}`,
    preview: row.description || 'Saved corpus query',
  }));
}

const SNAPSHOT_PREFERRED = [
  { title: 'Median term fee', provision_type: 'TERMINATION_FEE', [FIELD_PATH]: 'fee_amount_percent', chart_kind: 'HISTOGRAM' },
  { title: 'Outside date extensions', provision_type: 'TERMINATION_RIGHT', [FIELD_PATH]: 'outside_date_extension_months', chart_kind: 'HISTOGRAM' },
  { title: 'Go-shop presence', provision_type: 'COVENANT_NO_SOLICITATION', [FIELD_PATH]: 'go_shop', chart_kind: 'BAR' },
  { title: 'Matching rights days', provision_type: 'COVENANT_NO_SOLICITATION', [FIELD_PATH]: 'matching_rights_days', chart_kind: 'HISTOGRAM' },
  { title: 'No-shop type distribution', provision_type: 'COVENANT_NO_SOLICITATION', [FIELD_PATH]: 'no_shop_type', chart_kind: 'BAR' },
  { title: 'MAE carve-out count', provision_type: 'REPRESENTATION', [FIELD_PATH]: 'maeLimbs', chart_kind: 'BAR' },
];

const SNAPSHOT_TYPES = [
  'TERMINATION_FEE',
  'TERMINATION_RIGHT',
  'COVENANT_NO_SOLICITATION',
  'REPRESENTATION',
  'CONSIDERATION',
  'COVENANT_INTERIM_OPERATING',
  'CLOSING_CONDITION',
];

const SNAPSHOT_FIELD_TYPES = new Set(['boolean', 'enum', 'currency', 'percentage', 'duration', 'number', 'decimal', 'int', 'tagged', 'object']);

function chartKindFor(def) {
  return ['boolean', 'enum', 'tagged', 'object'].includes(def.type) ? 'BAR' : 'HISTOGRAM';
}

async function buildSnapshots(context) {
  const byKey = new Map();
  for (const preferred of SNAPSHOT_PREFERRED) byKey.set(`${preferred.provision_type}:${preferred.field_path}`, { ...preferred, preferred: true });
  for (const provisionType of SNAPSHOT_TYPES) {
    for (const def of featureDefsForWpType(provisionType)) {
      if (!SNAPSHOT_FIELD_TYPES.has(def.type)) continue;
      const key = `${provisionType}:${def.key}`;
      if (!byKey.has(key)) {
        byKey.set(key, {
          title: def.label,
          provision_type: provisionType,
          [FIELD_PATH]: def.key,
          chart_kind: chartKindFor(def),
          preferred: false,
        });
      }
    }
  }

  const scored = [];
  for (const snap of byKey.values()) {
    const payload = {
      provision_type: snap.provision_type,
      [FIELD_PATH]: snap.field_path,
      deal_filter: {},
      chart_kind: snap.chart_kind,
    };
    try {
      const result = await runQuery('MARKET_RANGE', payload, { context });
      if (result.n > 0) scored.push({ ...snap, payload, result });
    } catch {
      // Missing optional schema fields degrade by disappearing from the live set.
    }
  }

  scored.sort((a, b) => {
    const preferred = Number(b.preferred) - Number(a.preferred);
    if (preferred) return preferred;
    return b.result.n - a.result.n || a.title.localeCompare(b.title);
  });

  return scored.slice(0, 6).map((snap) => ({
    title: snap.title,
    provision_type: snap.provision_type,
    [FIELD_PATH]: snap.field_path,
    chart_kind: snap.chart_kind,
    href: `/query/market-range/adhoc?payload=${encodePayload(snap.payload)}`,
    result: snap.result,
  }));
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  const sb = getServiceSupabase();
  if (!sb) return res.status(500).json({ error: 'Supabase not configured' });

  try {
    const [{ data: deals, error: dErr }, { data: provisions, error: pErr }] = await Promise.all([
      sb.from('deals').select(DEAL_SELECT).order('announce_date', { ascending: false }),
      sb.from('provisions').select(PROVISION_SELECT).order('created_at', { ascending: true }),
    ]);
    if (dErr) throw new Error(dErr.message);
    if (pErr) throw new Error(pErr.message);

    const context = { deals: deals || [], provisions: provisions || [] };
    const snapshots = await buildSnapshots(context);

    const dealsById = new Map((deals || []).map((deal) => [deal.id, deal]));
    const dbFeatured = await featuredFromDb(sb);
    const searchIndex = [
      ...(deals || []).map((deal) => ({ type: 'deal', label: dealName(deal), detail: [deal.sector, deal.announce_date].filter(Boolean).join(' · '), href: `/review/${deal.id}` })),
      ...provisionHits(provisions, dealsById),
      ...definedTerms(provisions, dealsById),
    ];

    return res.status(200).json({
      featured_queries: dbFeatured || featuredQueries(deals || []),
      market_snapshots: snapshots,
      deals: (deals || []).map(publicDeal),
      search_index: searchIndex,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'newhome failed' });
  }
}
