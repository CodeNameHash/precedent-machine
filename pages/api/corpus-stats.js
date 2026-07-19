// GET /api/corpus-stats — corpus-wide context for one provision code.
// Powers the review page's reader sidebar: prevalence ("27 of 34 deals"),
// common feature values (with FRIENDLY labels resolved server-side from the
// feature registry + taxonomy), and a similarity-ranked comparable-deal
// list, refinable by the full deal-fact filter vocabulary: sector, signing
// year, deal size, law firm (either side), buyer, and merger form.
//
// Sidebar redesign (Ben, "corpus context, not verbatim"): three optional
// query params add a `rowContext` block scoped to exactly what a clicked
// row needs, alongside the unchanged "Refine the peer set" summary below:
//   - featureKeys=csv  -> per-key value distributions (categorical, this
//                          deal's own value flagged) OR a numeric
//                          min/median/max + this deal's position, for
//                          attributes whose registry valueType is 'number'
//                          (or that carry a nested numeric field, e.g.
//                          companyTerminationFee.amount).
//   - itemCode=CODE    -> instrument-scoped equity distribution.
//                          equityAwardTreatment is unstructured prose
//                          (claims.canonical is always null for it),
//                          classified into consideration/vesting pills
//                          client-side by components/review/table-configs/
//                          equity-awards.config.js. Reused HERE
//                          (rowsForCard) against every peer deal's
//                          reconstructed features so the corpus
//                          distribution is classified by the exact same
//                          logic the table itself uses, not a second,
//                          drifting copy of the regexes.
//   - itemLabel=text   -> drill-down item frequency ("appears in 31 of 40
//                          deals") for one list entry (e.g. one NOSOL
//                          prohibited act), matched by taxonomy code when
//                          itemCode is also given, else by resolved label.
//
// Cheap by design: provision_cards is ~6k rows and claims ~70k; both hits
// are single-column filters, the group-by happens here, and the response is
// a small summary. The corpus only changes on re-extract/correction, so the
// response is edge-cacheable per query string. rowContext reuses the SAME
// single claims fetch as the existing featureSummary/peers logic (one
// `sb.from('claims')` call total) -- see the perf note in the handler below.
import { getServiceSupabase } from '../../lib/supabase';
import { rowsForCard as equityRowsForCard } from '../../components/review/table-configs/equity-awards.config.js';

const { FEATURES } = require('../../lib/schema/features');
const taxonomy = require('../../lib/taxonomy');
const { buildFeaturesForCard } = require('../../lib/queries/claims-adapter');

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

// -- rowContext helpers (sidebar redesign) ---------------------------------

// Best-effort numeric extraction for a claim: canonical first (many number
// attributes DO carry a parseable canonical), then a nested numeric field
// off the rich provenance.feature_value (e.g. companyTerminationFee's
// `{ amount, percentage_of_equity, ... }`), then a $/,-stripped scan of the
// raw verbatim text. Returns null rather than a guess when nothing parses.
function extractNumeric(claim) {
  if (claim.canonical !== null && claim.canonical !== undefined) {
    const n = Number(claim.canonical);
    if (Number.isFinite(n)) return n;
  }
  const fv = claim.provenance && typeof claim.provenance === 'object' ? claim.provenance.feature_value : null;
  const payload = fv && typeof fv === 'object' && fv.value && typeof fv.value === 'object' ? fv.value : fv;
  if (payload && typeof payload === 'object') {
    for (const key of ['amount', 'value', 'days', 'months', 'percentage_of_equity']) {
      const raw = payload[key];
      if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
      if (typeof raw === 'string') {
        const m = raw.replace(/[$,]/g, '').match(/-?\d+(\.\d+)?/);
        if (m) return Number(m[0]);
      }
    }
  }
  if (typeof claim.verbatim === 'string') {
    const m = claim.verbatim.replace(/[$,]/g, '').match(/-?\d+(\.\d+)?/);
    if (m) return Number(m[0]);
  }
  return null;
}

function median(sortedNums) {
  if (!sortedNums.length) return null;
  const mid = Math.floor(sortedNums.length / 2);
  return sortedNums.length % 2 ? sortedNums[mid] : (sortedNums[mid - 1] + sortedNums[mid]) / 2;
}

function isNumericAttribute(attribute, sampleClaims) {
  const entry = FEATURES[attribute];
  if (entry && entry.valueType === 'number') return true;
  if (entry && entry.valueType === 'object') {
    // e.g. companyTerminationFee: an 'object' attribute whose canonical is
    // always null but whose feature_value carries a numeric `amount`.
    return sampleClaims.some((cl) => extractNumeric(cl) !== null && !cl.canonical);
  }
  return false;
}

// One featureKey's corpus distribution: categorical value/counts (this
// deal's own value flagged) for enum/coded attributes, or a numeric
// min/median/max + this deal's position for number-valued ones. peerClaims
// is already scoped to the peer set + this attribute.
function buildFeatureDistribution(attribute, peerClaims, subjectDealId) {
  const label = attributeLabel(attribute);
  if (isNumericAttribute(attribute, peerClaims)) {
    const byDeal = new Map();
    for (const cl of peerClaims) {
      if (byDeal.has(cl.deal_id)) continue; // one value per deal
      const n = extractNumeric(cl);
      if (n !== null) byDeal.set(cl.deal_id, n);
    }
    const nums = [...byDeal.values()].sort((a, b) => a - b);
    if (!nums.length) return null;
    const thisDealValue = subjectDealId && byDeal.has(subjectDealId) ? byDeal.get(subjectDealId) : null;
    const rank = thisDealValue !== null ? nums.filter((n) => n <= thisDealValue).length : null;
    return {
      attribute,
      label,
      kind: 'numeric',
      unit: (FEATURES[attribute] && FEATURES[attribute].unit) || null,
      min: nums[0],
      median: median(nums),
      max: nums[nums.length - 1],
      count: nums.length,
      thisDealValue,
      thisDealRank: rank,
    };
  }
  const counts = new Map();
  let thisDealValue = null;
  for (const cl of peerClaims) {
    if (cl.canonical === null || cl.canonical === undefined) continue;
    counts.set(cl.canonical, (counts.get(cl.canonical) || 0) + 1);
    if (subjectDealId && cl.deal_id === subjectDealId && thisDealValue === null) thisDealValue = cl.canonical;
  }
  if (!counts.size) return null;
  const values = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([value, count]) => ({ value, label: valueLabel(attribute, value), count, isThisDeal: value === thisDealValue }));
  return {
    attribute,
    label,
    kind: 'categorical',
    values,
    total: values.reduce((a, v) => a + v.count, 0),
    thisDealValue: thisDealValue !== null ? valueLabel(attribute, thisDealValue) : null,
  };
}

// Instrument-scoped equity distribution (item 2 of the redesign): re-run the
// SAME classification the Equity Awards table uses (equity-awards.config.js
// rowsForCard) against every peer deal's reconstructed features, then tally
// consideration/vesting labels for just the one instrument code clicked.
function buildInstrumentDistribution(itemCode, peerClaims, peerIds) {
  const claimsByDeal = new Map();
  for (const cl of peerClaims) {
    if (!peerIds.has(cl.deal_id)) continue;
    if (!claimsByDeal.has(cl.deal_id)) claimsByDeal.set(cl.deal_id, []);
    claimsByDeal.get(cl.deal_id).push(cl);
  }
  const considerationCounts = new Map();
  const vestingCounts = new Map();
  let dealsWithInstrument = 0;
  for (const [dealId, dealClaims] of claimsByDeal) {
    let features;
    try {
      features = buildFeaturesForCard(dealClaims);
    } catch {
      continue;
    }
    let rows;
    try {
      rows = equityRowsForCard({ id: dealId, features });
    } catch {
      continue;
    }
    const matches = (rows || []).filter((r) => r.instrumentCode === itemCode);
    if (!matches.length) continue;
    dealsWithInstrument += 1;
    for (const row of matches) {
      if (row.considerationLabel) considerationCounts.set(row.considerationLabel, (considerationCounts.get(row.considerationLabel) || 0) + 1);
      if (row.vestingLabel) vestingCounts.set(row.vestingLabel, (vestingCounts.get(row.vestingLabel) || 0) + 1);
    }
  }
  const toList = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count }));
  return {
    itemCode,
    dealsWithInstrument,
    peerSetSize: claimsByDeal.size,
    considerationDistribution: toList(considerationCounts),
    vestingDistribution: toList(vestingCounts),
  };
}

// Drill-down item frequency (item 4 of the redesign): how many peer deals'
// claims for `listAttribute` carry this exact item, matched by taxonomy
// code first (stable across deals' varying phrasing), else by resolved
// label text (case-insensitive).
function buildItemFrequency(listAttribute, itemLabel, itemCode, peerClaims, peerIds, peerSetSize) {
  const wantLabel = String(itemLabel || '').trim().toLowerCase();
  const dealsWithItem = new Set();
  for (const cl of peerClaims) {
    if (!peerIds.has(cl.deal_id)) continue;
    if (cl.attribute !== listAttribute) continue;
    const code = cl.canonical ? String(cl.canonical) : null;
    if (itemCode && code && code.toUpperCase() === String(itemCode).toUpperCase()) {
      dealsWithItem.add(cl.deal_id);
      continue;
    }
    const resolvedLabel = code ? valueLabel(listAttribute, code) : null;
    const candidateLabels = [resolvedLabel, cl.verbatim].filter(Boolean).map((s) => String(s).trim().toLowerCase());
    if (wantLabel && candidateLabels.includes(wantLabel)) dealsWithItem.add(cl.deal_id);
  }
  return { label: itemLabel, count: dealsWithItem.size, peerSetSize };
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

    // One claims fetch serves BOTH the legacy featureSummary/peers logic
    // below (which only ever wanted coded/canonical values) AND the new
    // rowContext logic (which also needs uncoded attributes like
    // equityAwardTreatment -- claims.canonical is always null there, the
    // structure lives in provenance.feature_value/verbatim instead). Widen
    // the select + drop the `.not('canonical', 'is', null)` filter that used
    // to run server-side; featureSummary re-applies the same null check
    // itself so its behavior is unchanged.
    const { data: claims, error: claimsErr } = await sb
      .from('claims')
      .select('deal_id, attribute, canonical, verbatim, evidence_quote, provenance, id, created_at')
      .eq('provenance->>code', code)
      .limit(4000);
    if (claimsErr) throw new Error(claimsErr.message);

    const byAttribute = new Map();
    for (const cl of claims || []) {
      if (!peerIds.has(cl.deal_id)) continue;
      if (cl.canonical === null || cl.canonical === undefined) continue;
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

    // rowContext: scoped corpus context for the specific row/item clicked in
    // the sidebar, built off the SAME `claims` fetch above (no extra query).
    const requestedFeatureKeys = req.query.featureKeys
      ? String(req.query.featureKeys).split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    const itemCode = req.query.itemCode ? String(req.query.itemCode).trim() : null;
    const itemLabel = req.query.itemLabel ? String(req.query.itemLabel).trim() : null;

    let rowContext = null;
    if (requestedFeatureKeys.length || itemCode || itemLabel) {
      rowContext = {};
      if (requestedFeatureKeys.length) {
        rowContext.features = requestedFeatureKeys
          .map((attribute) => {
            const peerClaims = (claims || []).filter((cl) => cl.attribute === attribute && peerIds.has(cl.deal_id));
            return buildFeatureDistribution(attribute, peerClaims, subjectDealId);
          })
          .filter(Boolean);
      }
      if (itemCode && !itemLabel) {
        const equityClaims = (claims || []).filter((cl) => cl.attribute === 'equityAwardTreatment');
        rowContext.instrument = buildInstrumentDistribution(itemCode, equityClaims, peerIds);
      }
      if (itemLabel) {
        const listAttribute = requestedFeatureKeys[0] || null;
        if (listAttribute) {
          rowContext.itemFrequency = buildItemFrequency(listAttribute, itemLabel, itemCode, claims || [], peerIds, peerSet.length);
        }
      }
    }

    res.setHeader('Cache-Control', CACHE);
    return res.status(200).json({
      code,
      peerSetSize: peerSet.length,
      dealsWithCode: dealsWithCode.size,
      featureSummary,
      peers,
      options,
      rowContext,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || String(error) });
  }
}
