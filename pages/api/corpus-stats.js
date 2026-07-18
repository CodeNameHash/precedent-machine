// GET /api/corpus-stats — corpus-wide context for one provision code.
// Powers the review page's reader sidebar: prevalence ("27 of 34 deals"),
// common feature values (with FRIENDLY labels resolved server-side from the
// feature registry + taxonomy), and a similarity-ranked comparable-deal
// list, refinable by the full deal-fact filter vocabulary: sector, signing
// year, deal size, law firm (either side), buyer, and merger form.
//
// Cheap by design: provision_cards is ~6k rows and claims ~70k; both hits
// are single-column filters, the group-by happens here, and the response is
// a small summary. The corpus only changes on re-extract/correction, so the
// response is edge-cacheable per query string.
import { getServiceSupabase } from '../../lib/supabase';

const { FEATURES } = require('../../lib/schema/features');
const taxonomy = require('../../lib/taxonomy');

const CACHE = 's-maxage=3600, stale-while-revalidate=86400';

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// "superiorProposalDeterminer" → "Superior proposal determiner";
// "BOARD_LEGAL_AND_FINANCIAL" → "Board legal and financial".
function humanizeKey(raw) {
  const spaced = String(raw || '')
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : String(raw || '');
}

// Registry labels can carry long parentheticals/em-dash tails — keep the head.
function attributeLabel(attribute) {
  const entry = FEATURES[attribute];
  const label = entry && entry.label ? String(entry.label) : null;
  if (!label) return humanizeKey(attribute);
  return label.split(' — ')[0].split(' (')[0].trim() || humanizeKey(attribute);
}

function valueLabel(attribute, code) {
  try {
    const dict = taxonomy.taxonomyForFeatureKey(attribute);
    const label = dict ? taxonomy.labelForCode(String(code), dict) : null;
    if (label) return String(label).split(' — ')[0].trim();
  } catch { /* fall through */ }
  return humanizeKey(code);
}

// Normalize a firm string to its short common name ("Skadden, Arps, Slate…"
// → "Skadden"); good enough for filtering/labels across 40 deals.
function firmShort(raw) {
  const head = String(raw || '').split(',')[0].trim();
  return head.replace(/\s+LLP$|\s+LLC$|\s+L\.L\.P\.$/i, '').trim() || null;
}

function dealFirms(deal) {
  const adv = deal.metadata && deal.metadata.advisors_v2;
  if (!adv) return [];
  const firms = new Set();
  for (const key of ['buyer_firm', 'seller_firm']) {
    const short = firmShort(adv[key]);
    if (short) firms.add(short);
  }
  for (const key of ['buyer_firms', 'seller_firms']) {
    for (const f of adv[key] || []) {
      const short = firmShort(typeof f === 'string' ? f : f && f.firm_raw);
      if (short) firms.add(short);
    }
  }
  const blocks = (adv.raw && adv.raw.blocks) || [];
  for (const b of blocks) {
    for (const f of b.firms || []) {
      const short = firmShort(f && f.firm_raw);
      if (short) firms.add(short);
    }
  }
  return [...firms];
}

function dealPassesFilters(deal, f, firmsByDeal) {
  if (f.sector && String(deal.sector || '') !== f.sector) return false;
  const year = deal.announce_date ? Number(String(deal.announce_date).slice(0, 4)) : null;
  if (f.yearFrom && (!year || year < f.yearFrom)) return false;
  if (f.yearTo && (!year || year > f.yearTo)) return false;
  const value = num(deal.value_usd);
  if (f.minValue && (!value || value < f.minValue)) return false;
  if (f.maxValue && (!value || value > f.maxValue)) return false;
  if (f.buyer && String(deal.acquirer || '') !== f.buyer) return false;
  if (f.form && String((deal.metadata && deal.metadata.merger_form) || '') !== f.form) return false;
  if (f.lawFirm && !(firmsByDeal.get(deal.id) || []).includes(f.lawFirm)) return false;
  return true;
}

// Similarity rank for the comparable-deal list: same sector first, then
// size proximity (within 3x), then recency. Not a guess dressed as science —
// just a stable, explainable ordering.
function similarity(deal, subject) {
  let score = 0;
  if (subject && deal.sector && deal.sector === subject.sector) score += 4;
  const a = num(deal.value_usd); const b = subject && num(subject.value_usd);
  if (a && b) {
    const ratio = a > b ? a / b : b / a;
    if (ratio <= 3) score += 2;
    else if (ratio <= 10) score += 1;
  }
  return score;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'GET only' });
  }
  const code = String(req.query.code || '').trim().toUpperCase();
  if (!code) return res.status(400).json({ error: 'code is required' });
  const subjectDealId = req.query.deal_id ? String(req.query.deal_id) : null;

  const filters = {
    sector: req.query.sector ? String(req.query.sector) : null,
    yearFrom: num(req.query.yearFrom),
    yearTo: num(req.query.yearTo),
    minValue: num(req.query.minValue),
    maxValue: num(req.query.maxValue),
    buyer: req.query.buyer ? String(req.query.buyer) : null,
    form: req.query.form ? String(req.query.form) : null,
    lawFirm: req.query.lawFirm ? String(req.query.lawFirm) : null,
  };

  const sb = getServiceSupabase();
  if (!sb) return res.status(500).json({ error: 'Supabase not configured' });

  try {
    const [{ data: deals, error: dealsErr }, { data: cards, error: cardsErr }] = await Promise.all([
      sb.from('deals').select('id, acquirer, target, sector, value_usd, announce_date, metadata'),
      sb.from('provision_cards').select('deal_id, provision_subtype').eq('provision_subtype', code),
    ]);
    if (dealsErr) throw new Error(dealsErr.message);
    if (cardsErr) throw new Error(cardsErr.message);

    const stagingFree = (deals || []).filter((d) => !(d.metadata && d.metadata.ingest_status === 'staging'));
    const firmsByDeal = new Map(stagingFree.map((d) => [d.id, dealFirms(d)]));
    const subject = subjectDealId ? stagingFree.find((d) => d.id === subjectDealId) : null;

    const peerSet = stagingFree.filter((d) => dealPassesFilters(d, filters, firmsByDeal));
    const peerIds = new Set(peerSet.map((d) => d.id));
    const dealsWithCode = new Set((cards || []).map((c) => c.deal_id).filter((id) => peerIds.has(id)));

    const { data: claims, error: claimsErr } = await sb
      .from('claims')
      .select('deal_id, attribute, canonical')
      .eq('provenance->>code', code)
      .not('canonical', 'is', null)
      .limit(4000);
    if (claimsErr) throw new Error(claimsErr.message);

    const byAttribute = new Map();
    for (const cl of claims || []) {
      if (!peerIds.has(cl.deal_id)) continue;
      if (!byAttribute.has(cl.attribute)) byAttribute.set(cl.attribute, new Map());
      const values = byAttribute.get(cl.attribute);
      values.set(cl.canonical, (values.get(cl.canonical) || 0) + 1);
    }
    const featureSummary = [...byAttribute.entries()]
      .map(([attribute, values]) => ({
        attribute,
        label: attributeLabel(attribute),
        values: [...values.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([value, count]) => ({ value, label: valueLabel(attribute, value), count })),
        total: [...values.values()].reduce((a, b) => a + b, 0),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);

    const peers = peerSet
      .filter((d) => dealsWithCode.has(d.id) && d.id !== subjectDealId)
      .sort((a, b) => (similarity(b, subject) - similarity(a, subject))
        || String(b.announce_date || '').localeCompare(String(a.announce_date || '')))
      .slice(0, 8)
      .map((d) => ({
        deal_id: d.id,
        acquirer: d.acquirer,
        target: d.target,
        sector: d.sector,
        value_usd: d.value_usd,
        announce_date: d.announce_date,
        law_firms: firmsByDeal.get(d.id) || [],
      }));

    // Filter option lists come from the WHOLE corpus (not the filtered set)
    // so a chosen filter never hides the other options.
    const options = {
      sectors: [...new Set(stagingFree.map((d) => d.sector).filter(Boolean))].sort(),
      buyers: [...new Set(stagingFree.map((d) => d.acquirer).filter(Boolean))].sort(),
      lawFirms: [...new Set([...firmsByDeal.values()].flat())].sort(),
      forms: [...new Set(stagingFree.map((d) => d.metadata && d.metadata.merger_form).filter(Boolean))].sort()
        .map((f) => ({ value: f, label: humanizeKey(f) })),
      lawFirmCoverage: [...firmsByDeal.values()].filter((f) => f.length).length,
    };

    res.setHeader('Cache-Control', CACHE);
    return res.status(200).json({
      code,
      peerSetSize: peerSet.length,
      dealsWithCode: dealsWithCode.size,
      featureSummary,
      peers,
      options,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || String(error) });
  }
}
