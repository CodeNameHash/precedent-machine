function nowIso() {
  return new Date().toISOString();
}

function asNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const compact = value.trim().toLowerCase().replace(/[$,\s]/g, '');
    const match = compact.match(/^(\d+(?:\.\d+)?)(bn|b|bil|billion|m|mm|mil|million|k|thousand)?$/);
    if (match) {
      const n = Number(match[1]);
      if (!Number.isFinite(n)) return null;
      const suffix = match[2] || '';
      if (suffix === 'bn' || suffix === 'b' || suffix === 'bil' || suffix === 'billion') return n * 1e9;
      if (suffix === 'm' || suffix === 'mm' || suffix === 'mil' || suffix === 'million') return n * 1e6;
      if (suffix === 'k' || suffix === 'thousand') return n * 1e3;
      return n;
    }
    const n = Number(compact);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function compactSource(opts = {}) {
  const out = {};
  if (opts.source_url) out.source_url = opts.source_url;
  if (opts.source_label) out.source_label = opts.source_label;
  if (opts.quote) out.quote = cleanText(opts.quote);
  if (opts.source_provision_id) out.source_provision_id = opts.source_provision_id;
  if (opts.method) out.method = opts.method;
  out.updated_at = opts.updated_at || nowIso();
  out.locked = opts.locked !== false;
  return out;
}

function buildValueUsdFact(value, opts = {}) {
  const n = asNumber(value);
  if (n === null || n <= 0) return null;
  return {
    value: Math.round(n),
    ...compactSource({ method: 'ingest_metadata', source_label: 'Ingest metadata', ...opts }),
  };
}

function buildPartiesFact(meta = {}, opts = {}) {
  const partyFields = {
    acquirer: meta.acquirer || null,
    target: meta.target || null,
    parent_entity: meta.parent_entity || null,
    target_entity: meta.target_entity || null,
    acquirer_display: meta.acquirer_display || null,
    target_display: meta.target_display || null,
  };
  if (!Object.values(partyFields).some(Boolean)) return null;
  const out = {
    ...partyFields,
    ...compactSource({ method: 'ingest_metadata', source_label: 'Agreement preamble', ...opts }),
  };
  return out;
}

function buildAdvisorsFact(advisors, opts = {}) {
  if (!Array.isArray(advisors) || advisors.length === 0) return null;
  const buyer = [];
  const seller = [];
  for (const row of advisors) {
    const firm = cleanText(row && row.firm);
    if (!firm) continue;
    const party = cleanText(row.party).toLowerCase();
    if (/buyer|parent|acquir/.test(party)) buyer.push(firm);
    else if (/seller|target|company/.test(party)) seller.push(firm);
  }
  const buyer_firms = [...new Set(buyer)];
  const seller_firms = [...new Set(seller)];
  if (buyer_firms.length === 0 && seller_firms.length === 0) return null;
  return {
    buyer_firms,
    seller_firms,
    ...compactSource({ method: 'notice_extraction', source_label: 'Notices section', ...opts }),
  };
}

function unwrapFeature(value) {
  if (value && typeof value === 'object' && !Array.isArray(value) && 'value' in value && !('code' in value)) return value.value;
  return value;
}

function featureText(value) {
  const raw = unwrapFeature(value);
  if (raw === null || raw === undefined) return '';
  if (typeof raw === 'string' || typeof raw === 'number') return String(raw);
  if (raw && typeof raw === 'object') return [raw.code, raw.label, raw.text].filter(Boolean).join(' ');
  return '';
}

function provisionFeatures(provision) {
  if (!provision || typeof provision !== 'object') return {};
  if (provision.features && typeof provision.features === 'object') return provision.features;
  const meta = provision.ai_metadata && typeof provision.ai_metadata === 'object' ? provision.ai_metadata : {};
  return meta.features && typeof meta.features === 'object' ? meta.features : {};
}

function considerationTypeLabel(type) {
  if (type === 'CASH') return 'Cash';
  if (type === 'STOCK') return 'Stock';
  if (type === 'MIXED') return 'Mixed cash/stock';
  if (type === 'MIXED_ELECTION') return 'Mixed election';
  if (type === 'CASH_PLUS_CVR') return 'Cash + CVR';
  if (type === 'STOCK_PLUS_CVR') return 'Stock + CVR';
  if (type === 'MIXED_PLUS_CVR') return 'Mixed + CVR';
  return type || null;
}

function deriveConsiderationFactFromProvisions(provisions, opts = {}) {
  const list = Array.isArray(provisions) ? provisions : [];
  const candidates = list.filter((p) => /^CONSID/.test(String(p.type || '')) || /CONSID/.test(String((p.code || p.category || ''))));
  if (candidates.length === 0) return null;

  let hasCash = false;
  let hasStock = false;
  let hasElection = false;
  let hasCvr = false;
  let perShare = null;
  let sourceProvision = null;
  let quote = null;

  for (const p of candidates) {
    const f = provisionFeatures(p);
    const joined = [
      featureText(f.considerationType),
      featureText(f.proration),
      featureText(f.prorationMechanics),
      featureText(f.electionMechanics),
      featureText(f.exchangeRatio),
      featureText(f.exchangeRatioText),
      featureText(f.perShareAmount),
      featureText(f.cashAmount),
      p.full_text,
    ].filter(Boolean).join(' ');
    if (!sourceProvision) {
      sourceProvision = p.id || null;
      quote = cleanText(p.full_text || p.text || '').slice(0, 1200) || null;
    }
    if (!perShare) perShare = cleanText(featureText(f.perShareAmount) || featureText(f.cashAmount));
    if (/\bcvr\b|contingent value right/i.test(joined)) hasCvr = true;
    if (perShare || /\bcash\b|\$\s?\d/i.test(joined)) hasCash = true;
    if (featureText(f.exchangeRatio) || featureText(f.exchangeRatioText) || /\bstock\b|share(?:s)?\s+of\b|all-stock/i.test(joined)) hasStock = true;
    if (/election|proration|mixed-cash-and-stock|mixed[_\s-]?election|cash_election|stock_election/i.test(joined)) hasElection = true;
  }

  let type = null;
  if (hasElection) type = 'MIXED_ELECTION';
  else if (hasCash && hasStock && hasCvr) type = 'MIXED_PLUS_CVR';
  else if (hasCash && hasCvr) type = 'CASH_PLUS_CVR';
  else if (hasStock && hasCvr) type = 'STOCK_PLUS_CVR';
  else if (hasCash && hasStock) type = 'MIXED';
  else if (hasStock) type = 'STOCK';
  else if (hasCash) type = 'CASH';
  if (!type) return null;

  const summary = perShare && hasCvr ? `${perShare} + CVR` : perShare || considerationTypeLabel(type);
  return {
    type,
    summary,
    source_provision_id: sourceProvision,
    quote,
    ...compactSource({ method: 'provision_extraction', source_label: 'Consideration provision', ...opts }),
  };
}

function mergeDealFacts(metadata, patch = {}) {
  const base = metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {};
  const current = base.deal_facts && typeof base.deal_facts === 'object' ? base.deal_facts : {};
  const nextFacts = { ...current };
  for (const [key, value] of Object.entries(patch || {})) {
    if (value === null || value === undefined) continue;
    const prior = nextFacts[key] && typeof nextFacts[key] === 'object' ? nextFacts[key] : {};
    nextFacts[key] = { ...prior, ...value };
  }
  return { ...base, deal_facts: nextFacts };
}

function valueUsdFromDeal(deal) {
  const meta = deal && deal.metadata && typeof deal.metadata === 'object' ? deal.metadata : {};
  const fact = meta.deal_facts && meta.deal_facts.value_usd;
  return asNumber(fact && fact.value) || asNumber(deal && deal.value_usd);
}

function considerationFromMetadata(metadata) {
  const meta = metadata && typeof metadata === 'object' ? metadata : {};
  const fact = meta.deal_facts && meta.deal_facts.consideration;
  if (fact && (fact.summary || fact.type)) {
    return {
      type: fact.type || null,
      summary: fact.summary || considerationTypeLabel(fact.type) || null,
    };
  }
  const legacy = meta.headlineConsiderationType || meta.headline_consideration_type || meta.considerationType || meta.consideration_type || null;
  return legacy ? { type: legacy, summary: considerationTypeLabel(legacy) || legacy } : null;
}

module.exports = {
  asNumber,
  buildAdvisorsFact,
  buildPartiesFact,
  buildValueUsdFact,
  considerationFromMetadata,
  considerationTypeLabel,
  deriveConsiderationFactFromProvisions,
  mergeDealFacts,
  valueUsdFromDeal,
};
