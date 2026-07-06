import { getServiceSupabase } from '../../lib/supabase';
const { QUALITY_METRICS_TABLE } = require('../../lib/deal-quality-metrics');

const DEAL_LIST_SELECT = [
  'id',
  'acquirer',
  'target',
  'value_usd',
  'announce_date',
  'sector',
  'created_at',
  'created_by',
  'ingest_status:metadata->>ingest_status',
  'ultimateParent:metadata->>ultimateParent',
  'ultimate_parent:metadata->>ultimate_parent',
  'parent_entity:metadata->>parent_entity',
  'acquirerUltimateParent:metadata->>acquirerUltimateParent',
  'acquirer_ultimate_parent:metadata->>acquirer_ultimate_parent',
  'acquirer_display:metadata->>acquirer_display',
  'target_display:metadata->>target_display',
  'target_entity:metadata->>target_entity',
  'advisors_v2:metadata->advisors_v2',
  'advisors:metadata->advisors',
  'deal_facts:metadata->deal_facts',
  'headlineConsiderationType:metadata->>headlineConsiderationType',
  'headline_consideration_type:metadata->>headline_consideration_type',
  'considerationType:metadata->>considerationType',
  'consideration_type:metadata->>consideration_type',
].join(', ');

function includeStaging(req) {
  return req.query.includeStaging === '1' || req.query.include_staging === '1';
}

function isStagingDeal(deal) {
  const meta = deal && deal.metadata && typeof deal.metadata === 'object' ? deal.metadata : {};
  return meta.ingest_status === 'staging';
}

function listRowToDeal(row, provisionCounts) {
  const metadata = {
    ...(row.ingest_status ? { ingest_status: row.ingest_status } : {}),
    ...(row.ultimateParent ? { ultimateParent: row.ultimateParent } : {}),
    ...(row.ultimate_parent ? { ultimate_parent: row.ultimate_parent } : {}),
    ...(row.parent_entity ? { parent_entity: row.parent_entity } : {}),
    ...(row.acquirerUltimateParent ? { acquirerUltimateParent: row.acquirerUltimateParent } : {}),
    ...(row.acquirer_ultimate_parent ? { acquirer_ultimate_parent: row.acquirer_ultimate_parent } : {}),
    ...(row.acquirer_display ? { acquirer_display: row.acquirer_display } : {}),
    ...(row.target_display ? { target_display: row.target_display } : {}),
    ...(row.target_entity ? { target_entity: row.target_entity } : {}),
    ...(row.advisors_v2 ? { advisors_v2: row.advisors_v2 } : {}),
    ...(row.advisors ? { advisors: row.advisors } : {}),
    ...(row.deal_facts ? { deal_facts: row.deal_facts } : {}),
    ...(row.headlineConsiderationType ? { headlineConsiderationType: row.headlineConsiderationType } : {}),
    ...(row.headline_consideration_type ? { headline_consideration_type: row.headline_consideration_type } : {}),
    ...(row.considerationType ? { considerationType: row.considerationType } : {}),
    ...(row.consideration_type ? { consideration_type: row.consideration_type } : {}),
  };

  return {
    id: row.id,
    acquirer: row.acquirer,
    target: row.target,
    value_usd: row.value_usd,
    announce_date: row.announce_date,
    sector: row.sector,
    created_at: row.created_at,
    created_by: row.created_by,
    metadata,
    provision_count: provisionCounts.has(row.id) ? provisionCounts.get(row.id) : null,
  };
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

export default async function handler(req, res) {
  const sb = getServiceSupabase();
  if (!sb) return res.status(500).json({ error: 'Supabase not configured' });

  if (req.method === 'GET') {
    const { id } = req.query;
    const showStaging = includeStaging(req);
    if (id) {
      const { data, error } = await sb.from('deals')
        .select('*')
        .eq('id', id).single();
      if (error) return res.status(404).json({ error: error.message });
      if (!showStaging && isStagingDeal(data)) return res.status(404).json({ error: 'Deal is staging' });
      const { data: topologyRows, error: topologyErr } = await sb
        .from('deal_topology')
        .select('*, primary_step:transaction_steps(*)')
        .eq('deal_id', id)
        .limit(1);
      if (!topologyErr && topologyRows && topologyRows[0]) {
        data.deal_topology = topologyRows[0];
      }
      return res.json({ deal: data });
    }
    const { data, error } = await sb.from('deals')
      .select(DEAL_LIST_SELECT)
      .order('announce_date', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    const rows = showStaging ? (data || []) : (data || []).filter((deal) => !isStagingDeal({ metadata: { ingest_status: deal.ingest_status } }));
    const provisionCounts = await fetchProvisionCounts(sb, rows.map((deal) => deal.id).filter(Boolean));
    const deals = rows.map((row) => listRowToDeal(row, provisionCounts));
    return res.json({ deals });
  }

  if (req.method === 'POST') {
    const { acquirer, target, value_usd, announce_date, sector, metadata, created_by } = req.body;
    const { data, error } = await sb.from('deals')
      .insert({ acquirer, target, value_usd, announce_date, sector, metadata, created_by })
      .select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ deal: data });
  }

  if (req.method === 'PATCH') {
    const { id, ...updates } = req.body;
    // P8 item 5: server-side merge for the metadata column so concurrent
    // PATCHes from different tabs/users don't clobber each other's keys.
    // The client may still send a full pre-merged metadata blob (back-compat),
    // but if BOTH the existing row and the incoming update specify a metadata
    // object we deep-merge them shallow-key-wise and additionally deep-merge
    // the `custom_taxonomy_extensions` sub-object (per-featureKey list union).
    if (updates && updates.metadata && typeof updates.metadata === 'object' && !Array.isArray(updates.metadata)) {
      const { data: existing, error: readErr } = await sb.from('deals')
        .select('metadata').eq('id', id).single();
      if (!readErr && existing && existing.metadata && typeof existing.metadata === 'object') {
        const merged = { ...existing.metadata, ...updates.metadata };
        const existingFacts = (existing.metadata.deal_facts && typeof existing.metadata.deal_facts === 'object') ? existing.metadata.deal_facts : null;
        const incomingFacts = (updates.metadata.deal_facts && typeof updates.metadata.deal_facts === 'object') ? updates.metadata.deal_facts : null;
        if (existingFacts || incomingFacts) {
          const factsMerged = { ...(existingFacts || {}) };
          if (incomingFacts) {
            for (const [key, value] of Object.entries(incomingFacts)) {
              const prior = factsMerged[key] && typeof factsMerged[key] === 'object' ? factsMerged[key] : {};
              factsMerged[key] = value && typeof value === 'object' && !Array.isArray(value)
                ? { ...prior, ...value }
                : value;
            }
          }
          merged.deal_facts = factsMerged;
        }
        const existingExt = (existing.metadata.custom_taxonomy_extensions && typeof existing.metadata.custom_taxonomy_extensions === 'object') ? existing.metadata.custom_taxonomy_extensions : null;
        const incomingExt = (updates.metadata.custom_taxonomy_extensions && typeof updates.metadata.custom_taxonomy_extensions === 'object') ? updates.metadata.custom_taxonomy_extensions : null;
        if (existingExt || incomingExt) {
          const extMerged = { ...(existingExt || {}) };
          if (incomingExt) {
            for (const [key, list] of Object.entries(incomingExt)) {
              if (!Array.isArray(list)) { extMerged[key] = list; continue; }
              const prior = Array.isArray(extMerged[key]) ? extMerged[key] : [];
              // Union by code; the incoming entry wins on conflict.
              const byCode = new Map();
              for (const e of prior) if (e && e.code) byCode.set(e.code, e);
              for (const e of list) if (e && e.code) byCode.set(e.code, e);
              extMerged[key] = [...byCode.values()];
            }
          }
          merged.custom_taxonomy_extensions = extMerged;
        }
        updates.metadata = merged;
      }
    }
    const { data, error } = await sb.from('deals').update(updates).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ deal: data });
  }

  if (req.method === 'DELETE') {
    const { id } = req.body;
    const { error } = await sb.from('deals').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
