import { getServiceSupabase } from '../../lib/supabase';
import { applyProvisionPatch } from '../../lib/provisions/apply-patch';

const IMMUTABLE_FIELDS = ['deal_id'];

function includeStaging(req) {
  return req.query.includeStaging === '1' || req.query.include_staging === '1';
}

function isStagingDeal(deal) {
  const meta = deal && deal.metadata && typeof deal.metadata === 'object' ? deal.metadata : {};
  return meta.ingest_status === 'staging';
}

async function fetchStagingDealIds(sb) {
  const { data, error } = await sb.from('deals').select('id, metadata');
  if (error) throw new Error(error.message);
  return new Set((data || []).filter(isStagingDeal).map((deal) => deal.id));
}

async function dealIsStaging(sb, dealId) {
  if (!dealId) return false;
  const { data, error } = await sb.from('deals').select('id, metadata').eq('id', dealId).single();
  if (error) throw new Error(error.message);
  return isStagingDeal(data);
}

function metaObject(value) {
  if (!value) return {};
  if (typeof value === 'string') {
    try { return JSON.parse(value) || {}; } catch { return {}; }
  }
  return typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function considerationEquityId(row) {
  if (!row) return null;
  if (row.consideration_equity_provision_id) return row.consideration_equity_provision_id;
  const meta = metaObject(row.ai_metadata);
  const features = metaObject(meta.features);
  return features.considerationEquityProvisionId || null;
}

async function attachConsiderationEquity(sb, provisions) {
  const rows = Array.isArray(provisions) ? provisions : (provisions ? [provisions] : []);
  const ids = [...new Set(rows.map(considerationEquityId).filter(Boolean))];
  if (ids.length === 0) return provisions;

  const { data: equityRows, error: equityErr } = await sb
    .from('consideration_equity_provisions')
    .select('*')
    .in('id', ids);
  if (equityErr) {
    if (/consideration_equity_provisions|schema cache|does not exist|Could not find/i.test(equityErr.message || '')) {
      return provisions;
    }
    throw equityErr;
  }

  const { data: treatmentRows, error: treatmentErr } = await sb
    .from('consideration_treatments')
    .select('*')
    .in('provision_id', ids)
    .order('source_span_start', { ascending: true });
  if (treatmentErr) throw treatmentErr;

  let electionRows = [];
  let optionRows = [];
  let prorationRows = [];
  let stepRows = [];
  const { data: elections, error: electionErr } = await sb
    .from('election_mechanisms')
    .select('*')
    .in('provision_id', ids);
  if (electionErr) {
    if (!/election_mechanisms|schema cache|does not exist|Could not find/i.test(electionErr.message || '')) {
      throw electionErr;
    }
  } else {
    electionRows = elections || [];
    const electionIds = electionRows.map((row) => row.id).filter(Boolean);
    const prorationIds = electionRows.map((row) => row.proration_rule_id).filter(Boolean);
    const stepIds = electionRows.map((row) => row.transaction_step_id).filter(Boolean);
    if (electionIds.length > 0) {
      const { data: options, error: optionErr } = await sb
        .from('election_options')
        .select('*')
        .in('election_mechanism_id', electionIds)
        .order('display_order', { ascending: true });
      if (optionErr) throw optionErr;
      optionRows = options || [];
    }
    if (prorationIds.length > 0) {
      const { data: prorations, error: prorationErr } = await sb
        .from('proration_rules')
        .select('*')
        .in('id', prorationIds);
      if (prorationErr) throw prorationErr;
      prorationRows = prorations || [];
    }
    if (stepIds.length > 0) {
      const { data: steps, error: stepErr } = await sb
        .from('transaction_steps')
        .select('*')
        .in('id', stepIds);
      if (stepErr && !/transaction_steps|schema cache|does not exist|Could not find/i.test(stepErr.message || '')) throw stepErr;
      stepRows = steps || [];
    }
  }

  const treatmentsByProvision = new Map();
  for (const treatment of treatmentRows || []) {
    if (!treatmentsByProvision.has(treatment.provision_id)) treatmentsByProvision.set(treatment.provision_id, []);
    treatmentsByProvision.get(treatment.provision_id).push(treatment);
  }
  const optionsByElection = new Map();
  for (const option of optionRows) {
    if (!optionsByElection.has(option.election_mechanism_id)) optionsByElection.set(option.election_mechanism_id, []);
    optionsByElection.get(option.election_mechanism_id).push(option);
  }
  const prorationById = new Map(prorationRows.map((row) => [row.id, row]));
  const stepById = new Map(stepRows.map((row) => [row.id, row]));
  const electionByProvision = new Map(electionRows.map((row) => [
    row.provision_id,
    {
      ...row,
      options: optionsByElection.get(row.id) || [],
      proration_rule: row.proration_rule_id ? (prorationById.get(row.proration_rule_id) || null) : null,
      transaction_step: row.transaction_step_id ? (stepById.get(row.transaction_step_id) || null) : null,
    },
  ]));

  const equityById = new Map((equityRows || []).map((row) => [
    row.id,
    {
      ...row,
      treatments: treatmentsByProvision.get(row.id) || [],
      election_mechanism: electionByProvision.get(row.id) || null,
    },
  ]));

  for (const row of rows) {
    const id = considerationEquityId(row);
    if (id && equityById.has(id)) row.consideration_equity = equityById.get(id);
  }
  return provisions;
}

export default async function handler(req, res) {
  const sb = getServiceSupabase();
  if (!sb) return res.status(500).json({ error: 'Supabase not configured' });

  if (req.method === 'GET') {
    const { id, deal_id, type, category } = req.query;
    const showStaging = includeStaging(req);
    if (id) {
      const { data, error } = await sb.from('provisions')
        .select('*, deal:deals(acquirer, target, sector, announce_date)')
        .eq('id', id).single();
      if (error) return res.status(404).json({ error: error.message });
      if (!showStaging) {
        try {
          if (await dealIsStaging(sb, data && data.deal_id)) return res.status(404).json({ error: 'Provision is staging' });
        } catch (err) {
          return res.status(500).json({ error: err.message });
        }
      }
      await attachConsiderationEquity(sb, data);
      return res.json({ provision: data });
    }
    let stagingDealIds = new Set();
    if (!showStaging && deal_id) {
      try {
        if (await dealIsStaging(sb, deal_id)) return res.json({ provisions: [] });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    } else if (!showStaging) {
      try {
        stagingDealIds = await fetchStagingDealIds(sb);
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }
    let q = sb.from('provisions')
      .select('*, deal:deals(acquirer, target, sector, announce_date)');
    if (deal_id) q = q.eq('deal_id', deal_id);
    if (type) q = q.eq('type', type);
    if (category) q = q.eq('category', category);
    q = q.order('created_at', { ascending: true });
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    const provisions = showStaging ? (data || []) : (data || []).filter((row) => !stagingDealIds.has(row.deal_id));
    await attachConsiderationEquity(sb, provisions);
    return res.json({ provisions });
  }

  if (req.method === 'POST') {
    const { deal_id, type, category, full_text, prohibition, exceptions, ai_favorability } = req.body;
    if (!full_text || !full_text.trim()) {
      return res.status(400).json({ error: 'full_text is required' });
    }
    const { data, error } = await sb.from('provisions')
      .insert({ deal_id, type, category, full_text: full_text.trim(), prohibition, exceptions, ai_favorability: ai_favorability || 'neutral' })
      .select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ provision: data });
  }

  if (req.method === 'PATCH') {
    // Extract correction-logging metadata before processing updates
    const { id, reason, user_id, ...updates } = req.body;

    const blocked = IMMUTABLE_FIELDS.filter(f => f in updates);
    if (blocked.length > 0) {
      return res.status(403).json({
        error: `Cannot modify immutable field(s): ${blocked.join(', ')}. Provision text is locked after creation. Use annotations to enrich.`,
      });
    }
    // Only allow updating columns that exist in the DB
    const allowedFields = ['type', 'category', 'prohibition', 'exceptions', 'ai_favorability', 'full_text', 'ai_metadata'];
    const safeUpdates = {};
    for (const key of allowedFields) {
      if (key in updates) safeUpdates[key] = updates[key];
    }
    if ('full_text' in safeUpdates) {
      if (typeof safeUpdates.full_text !== 'string' || !safeUpdates.full_text.trim()) {
        return res.status(400).json({ error: 'full_text cannot be empty' });
      }
      safeUpdates.full_text = safeUpdates.full_text.trim();
    }
    if (!id) {
      return res.status(400).json({ error: 'id is required for PATCH' });
    }

    // Shared apply-and-log core (lib/provisions/apply-patch.js) — same path
    // the Correct-tab submit/review routes use for approved-editor
    // corrections, so the corrections table stays the single source of
    // truth (see docs/handoffs/CORRECT-TAB-SPEC-2026-07-17.md).
    const { provision: data, error } = await applyProvisionPatch(sb, {
      id,
      updates: safeUpdates,
      reason,
      user_id,
    });
    if (error) return res.status(500).json({ error: error.message });

    return res.json({ provision: data });
  }

  if (req.method === 'DELETE') {
    const { id } = req.body;
    const { error } = await sb.from('provisions').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
