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
// Sidebar redesign r6 (Ben, "clearer on this deal's treatment vs
// alternatives, click an option to see its deals"): every categorical value/
// instrument consideration-or-vesting label now carries `deals: [{ id,
// name, cardId }]` (name = "<acquirer_display||acquirer> /
// <target_display||target>", cardId resolved via claims.excerpt_id ->
// provision_cards.id where available), and numeric distributions carry a
// capped-at-40 `values: [{ value, dealId, dealName, cardId }]` point list.
// The client renders these as expandable option rows with "See deal"/"See
// provision" links -- see components/review-v2/ClauseSidebar.jsx.
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
function looksLikeJsonVerbatim(verbatim) {
  const trimmed = verbatim.trim();
  return trimmed.startsWith('{') && trimmed.endsWith('}');
}

function extractNumeric(claim) {
  if (claim.canonical !== null && claim.canonical !== undefined) {
    const n = Number(claim.canonical);
    if (Number.isFinite(n)) return n;
  }
  const fv = claim.provenance && typeof claim.provenance === 'object' ? claim.provenance.feature_value : null;
  const payload = fv && typeof fv === 'object' && fv.value && typeof fv.value === 'object' ? fv.value : fv;
  if (payload && typeof payload === 'object') {
    // ONLY 'amount'/'value' -- these are the field's headline dollar/day
    // figure. Deliberately NOT 'percentage_of_equity'/'days'/'months' here:
    // those are real fields on the SAME object but a different unit (e.g.
    // companyTerminationFee.percentage_of_equity is a percent, not a
    // dollar amount) — falling through to them mixed units into one
    // min/median/max and produced a bogus $7.01 "minimum fee" that was
    // actually a 7.01% figure from a claim with no `amount` set.
    for (const key of ['amount', 'value']) {
      const raw = payload[key];
      if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
      if (typeof raw === 'string') {
        const m = raw.replace(/[$,]/g, '').match(/-?\d+(\.\d+)?/);
        if (m) return Number(m[0]);
      }
    }
  }
  // Free-text verbatim (prose, or a bare number/code) only -- NOT a
  // JSON-encoded blob. A JSON verbatim already had its shot via the
  // `payload` branch above; scanning its raw text for "the first digit
  // run" picks up whatever field happens to sort first in the JSON (e.g.
  // percentage_of_equity's "7.01%" ahead of a later `amount` field),
  // producing a bogus outlier completely unrelated to the headline figure.
  if (typeof claim.verbatim === 'string' && !looksLikeJsonVerbatim(claim.verbatim)) {
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

// "<acquirer_display||acquirer> / <target_display||target>" — same flat
// metadata fields pages/api/deals.js and lib/home-data.js already read
// (metadata.acquirer_display / metadata.target_display), not the deeper
// deal_facts.parties resolution lib/deal-display.js does for the main
// review header -- this is a compact peer-list label, not the canonical
// display name, so the simple flat fallback is enough.
function dealLabel(deal) {
  const meta = (deal && deal.metadata) || {};
  const acquirer = meta.acquirer_display || deal.acquirer;
  const target = meta.target_display || deal.target;
  return [acquirer, target].filter(Boolean).join(' / ') || deal.id;
}

function buildDealsById(deals) {
  const map = new Map();
  for (const d of deals) map.set(d.id, { id: d.id, name: dealLabel(d) });
  return map;
}

// provision_cards.id (the id `?card=` deep-links expect) is NOT what claims
// carry directly -- claims reference provision_cards.excerpt_id (the
// re-ingest-stable anchor), not the card's uuid primary key. cardIdByKey is
// built once per request from the SAME provision_cards fetch already used
// for dealsWithCode, keyed `${deal_id}|${excerpt_id}` -> card id.
function cardIdForClaim(claim, cardIdByKey) {
  if (!claim || !claim.excerpt_id) return null;
  return cardIdByKey.get(`${claim.deal_id}|${claim.excerpt_id}`) || null;
}

function dealEntryForClaim(claim, dealsById, cardIdByKey) {
  const d = dealsById.get(claim.deal_id);
  return { id: claim.deal_id, name: d ? d.name : claim.deal_id, cardId: cardIdForClaim(claim, cardIdByKey) };
}

// One featureKey's corpus distribution: categorical value/counts (this
// deal's own value flagged) for enum/coded attributes, or a numeric
// min/median/max + this deal's position for number-valued ones. peerClaims
// is already scoped to the peer set + this attribute. Each distribution
// option/point also carries the deals behind it (sidebar redesign, item 1:
// click an option -> expand its deals -> "See deal"/"See provision").
function buildFeatureDistribution(attribute, peerClaims, subjectDealId, dealsById, cardIdByKey) {
  const label = attributeLabel(attribute);
  if (isNumericAttribute(attribute, peerClaims)) {
    const byDeal = new Map();
    const claimByDeal = new Map();
    for (const cl of peerClaims) {
      if (byDeal.has(cl.deal_id)) continue; // one value per deal
      const n = extractNumeric(cl);
      if (n !== null) { byDeal.set(cl.deal_id, n); claimByDeal.set(cl.deal_id, cl); }
    }
    const nums = [...byDeal.values()].sort((a, b) => a - b);
    if (!nums.length) return null;
    const thisDealValue = subjectDealId && byDeal.has(subjectDealId) ? byDeal.get(subjectDealId) : null;
    const rank = thisDealValue !== null ? nums.filter((n) => n <= thisDealValue).length : null;
    const values = [...byDeal.entries()]
      .map(([dealId, value]) => {
        const d = dealsById.get(dealId);
        return { value, dealId, dealName: d ? d.name : dealId, cardId: cardIdForClaim(claimByDeal.get(dealId), cardIdByKey) };
      })
      .sort((a, b) => a.value - b.value)
      .slice(0, 40);
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
      values,
    };
  }
  const counts = new Map();
  const dealsByValue = new Map(); // value -> Map(dealId -> {id,name,cardId})
  let thisDealValue = null;
  for (const cl of peerClaims) {
    if (cl.canonical === null || cl.canonical === undefined) continue;
    counts.set(cl.canonical, (counts.get(cl.canonical) || 0) + 1);
    if (!dealsByValue.has(cl.canonical)) dealsByValue.set(cl.canonical, new Map());
    const dmap = dealsByValue.get(cl.canonical);
    if (!dmap.has(cl.deal_id)) dmap.set(cl.deal_id, dealEntryForClaim(cl, dealsById, cardIdByKey));
    if (subjectDealId && cl.deal_id === subjectDealId && thisDealValue === null) thisDealValue = cl.canonical;
  }
  if (!counts.size) return null;
  const values = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([value, count]) => ({
      value,
      label: valueLabel(attribute, value),
      count,
      isThisDeal: value === thisDealValue,
      deals: [...(dealsByValue.get(value) || new Map()).values()],
    }));
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
function buildInstrumentDistribution(itemCode, peerClaims, peerIds, dealsById, cardIdByKey, subjectDealId) {
  const claimsByDeal = new Map();
  for (const cl of peerClaims) {
    if (!peerIds.has(cl.deal_id)) continue;
    if (!claimsByDeal.has(cl.deal_id)) claimsByDeal.set(cl.deal_id, []);
    claimsByDeal.get(cl.deal_id).push(cl);
  }
  const considerationCounts = new Map();
  const considerationDeals = new Map(); // label -> Map(dealId -> entry)
  const vestingCounts = new Map();
  const vestingDeals = new Map();
  let dealsWithInstrument = 0;
  // This-deal's own treatment for the lead line (sidebar redesign, item 1) --
  // same instrument-row shape as every peer, just for subjectDealId.
  let thisDealConsideration = null;
  let thisDealVesting = null;
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
    // Instrument rows aren't tied to one specific claim -- best-effort: the
    // first claim in this deal's code-scoped set that resolves to a card id.
    const cardId = dealClaims.map((cl) => cardIdForClaim(cl, cardIdByKey)).find(Boolean) || null;
    const d = dealsById.get(dealId);
    const dealEntry = { id: dealId, name: d ? d.name : dealId, cardId };
    if (subjectDealId && dealId === subjectDealId) {
      thisDealConsideration = matches[0].considerationLabel || null;
      thisDealVesting = matches[0].vestingLabel || null;
    }
    for (const row of matches) {
      if (row.considerationLabel) {
        considerationCounts.set(row.considerationLabel, (considerationCounts.get(row.considerationLabel) || 0) + 1);
        if (!considerationDeals.has(row.considerationLabel)) considerationDeals.set(row.considerationLabel, new Map());
        considerationDeals.get(row.considerationLabel).set(dealId, dealEntry);
      }
      if (row.vestingLabel) {
        vestingCounts.set(row.vestingLabel, (vestingCounts.get(row.vestingLabel) || 0) + 1);
        if (!vestingDeals.has(row.vestingLabel)) vestingDeals.set(row.vestingLabel, new Map());
        vestingDeals.get(row.vestingLabel).set(dealId, dealEntry);
      }
    }
  }
  const toList = (counts, dealsMap, thisDealLabel) => [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({
      label,
      count,
      deals: [...(dealsMap.get(label) || new Map()).values()],
      isThisDeal: thisDealLabel !== null && label === thisDealLabel,
    }));
  return {
    itemCode,
    dealsWithInstrument,
    peerSetSize: claimsByDeal.size,
    considerationDistribution: toList(considerationCounts, considerationDeals, thisDealConsideration),
    vestingDistribution: toList(vestingCounts, vestingDeals, thisDealVesting),
    thisDeal: (thisDealConsideration || thisDealVesting) ? { considerationLabel: thisDealConsideration, vestingLabel: thisDealVesting } : null,
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
      // id + excerpt_id: additive columns beyond the pre-existing deal_id/
      // provision_subtype select, needed to resolve claims.excerpt_id ->
      // provision_cards.id (the card uuid `?card=` deep-links expect) --
      // see cardIdByKey below. Still the one query, still scoped to `code`.
      sb.from('provision_cards').select('deal_id, provision_subtype, id, excerpt_id').eq('provision_subtype', code),
    ]);
    if (dealsErr) throw new Error(dealsErr.message);
    if (cardsErr) throw new Error(cardsErr.message);

    const stagingFree = (deals || []).filter((d) => !(d.metadata && d.metadata.ingest_status === 'staging'));
    const firmsByDeal = new Map(stagingFree.map((d) => [d.id, dealFirms(d)]));
    const subject = subjectDealId ? stagingFree.find((d) => d.id === subjectDealId) : null;
    const dealsById = buildDealsById(stagingFree);
    const cardIdByKey = new Map();
    for (const c of cards || []) {
      if (c.excerpt_id) cardIdByKey.set(`${c.deal_id}|${c.excerpt_id}`, c.id);
    }

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
      // excerpt_id: additive column, the durable anchor into provision_cards
      // (claims reference provision_cards.excerpt_id, not its uuid `id`
      // directly) -- needed to resolve a per-deal cardId for rowContext's
      // deal lists. See cardIdForClaim/cardIdByKey above.
      .select('deal_id, attribute, canonical, verbatim, evidence_quote, provenance, id, created_at, excerpt_id')
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
        // r11 (Ben: "No corpus comparison captured — surely we have notice
        // period coded?"): the main claims fetch is scoped to the CLICKED
        // card's subtype code, but peer deals park the same attribute on
        // sibling subtypes (noticePeriod/matchingPeriod live across the
        // NOSOL family) — the code-scoped pool came back empty for exactly
        // the well-covered keys. Fetch the requested attributes UNSCOPED
        // by code (single-column .in() filter, small result, edge-cached
        // like everything else here) and build distributions from that.
        const { data: attrClaims, error: attrErr } = await sb
          .from('claims')
          .select('deal_id, attribute, canonical, verbatim, evidence_quote, provenance, id, created_at, excerpt_id')
          .in('attribute', requestedFeatureKeys)
          .limit(4000);
        if (attrErr) throw new Error(attrErr.message);
        rowContext.features = requestedFeatureKeys
          .map((attribute) => {
            const peerClaims = (attrClaims || []).filter((cl) => cl.attribute === attribute && peerIds.has(cl.deal_id));
            return buildFeatureDistribution(attribute, peerClaims, subjectDealId, dealsById, cardIdByKey);
          })
          .filter(Boolean);
      }
      if (itemCode && !itemLabel) {
        // ALL claims for this code (not just equityAwardTreatment) --
        // buildFeaturesForCard needs outstandingInstruments/
        // instrumentTreatments/instrumentVesting/instrumentType/
        // vestingAcceleration too, since most deals' equityAwardTreatment
        // is unstructured prose (shape 1) and rowsForCard falls back to
        // those parallel-claim shapes (shape 2/3) to classify per
        // instrument. Filtering to one attribute here under-counted every
        // deal that hadn't been re-extracted onto the keyed-map shape.
        rowContext.instrument = buildInstrumentDistribution(itemCode, claims || [], peerIds, dealsById, cardIdByKey, subjectDealId);
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
