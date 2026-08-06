/* ─────────────────────────────────────────────────────────────────────────
   lib/feature-compare.js — GENERAL, DYNAMIC cross-deal comparison engine.
   ───────────────────────────────────────────────────────────────────────────
   Corpus's differentiation is clause-level QUALITATIVE comparison nobody else
   has: "across the SELECTED deals, how is THIS structured term drafted?" — rep
   materiality qualifiers, IOC permitted-exceptions, efforts standards, consent
   standards, knowledge qualifiers, MAE carve-out sets, no-shop fiduciary
   standards, cure periods, outside-date length, and so on.

   This module is the engine. Two properties:

   1. GENERAL — DRIVEN OFF the declared `type` of each feature in lib/rubric.js
      FEATURES, so every provision type's comparable terms fall out automatically:

        enum ─────────────→ distribution over the schema's ordered `options`
        object / tagged ──→ distribution over canonical codes (taxonomy codebook)
        list / list-tagged→ SET membership ("pandemic carve-out in 14/17 deals")
        boolean ──────────→ Yes/No rate across deals
        currency/pct/dur ─→ numeric distribution (median / IQR)  — LOWER priority
        text / tiers ─────→ SKIPPED (free text is not distributable)

   2. DYNAMIC — everything recomputes over EXACTLY the selected cohort. The
      cohort is defined either by an explicit `filters.dealIds` array (hand-
      picked comparison set) or by sector/size/year/side filters. Nothing is
      precomputed against a fixed global corpus: modal value, counts,
      dealFraction, and the outlier baseline are all relative to the cohort,
      and the cohort `n` is always returned prominently.

   TRUST GUARDRAILS (hard rules):
     1. Every SURFACED datapoint carries a quote + provision_id for
        clickthrough. A datapoint with no resolvable citation is dropped —
        uncited is untrusted.
     2. featureOutliers NEVER asserts "off-market" on a feature whose SELECTED-
        cohort n < minN (default 12). Below that it exposes "differs from N of
        M deals in this cohort" as information only.

   CommonJS (matches lib/expected-sets.js): consumed by the API route, the
   report script, tests, and the thin lib/rep-materiality.js demo wrapper.
   ───────────────────────────────────────────────────────────────────────── */

const { FEATURES } = require('./rubric');
const { taxonomyForFeatureKey, labelForCode } = require('./taxonomy');
const { familyType, provisionCode } = require('./expected-sets');
const { parseMoneyAmount } = require('./parse-money');

// Cap on a full_text fallback quote (mirrors EVIDENCE_SLICE in lib/citable.js).
const EVIDENCE_SLICE = 600;
// Default sample-size floor below which "off-market" is never asserted.
const DEFAULT_MIN_N = 12;

const NONCOMPARABLE_TYPES = new Set(['text', 'tiers']);
const NUMERIC_TYPES = new Set(['currency', 'percentage', 'duration', 'number']);

// Map a feature's declared schema `type` to a comparison KIND (or null when
// the feature is not distributable).
function featureKind(def) {
  const t = def && def.type;
  if (!t || NONCOMPARABLE_TYPES.has(t)) return null;
  if (t === 'boolean') return 'boolean';
  if (NUMERIC_TYPES.has(t)) return 'numeric';
  if (t === 'enum') return 'enum';
  if (t === 'object' || t === 'tagged') return 'coded';
  if (t === 'list' || t === 'list-tagged') return 'set';
  return null;
}

// ── value-model helpers (CommonJS mirror of lib/citable.js discriminators) ──

function getFeatures(provision) {
  if (!provision) return {};
  let meta = provision.ai_metadata;
  if (typeof meta === 'string') { try { meta = JSON.parse(meta); } catch { return {}; } }
  if (!meta || typeof meta !== 'object' || !meta.features) return {};
  const feats = meta.features;
  return feats && typeof feats === 'object' && !Array.isArray(feats) ? feats : {};
}

function isCitable(v) {
  return v != null && typeof v === 'object' && !Array.isArray(v) && 'value' in v && !('code' in v);
}
function isTagged(v) {
  return v != null && typeof v === 'object' && !Array.isArray(v) && typeof v.code === 'string' && v.code.length > 0;
}
function unwrap(v) { return isCitable(v) ? v.value : v; }

function citableQuotes(v) {
  if (!isCitable(v)) return [];
  if (Array.isArray(v.quotes)) return v.quotes.filter((q) => typeof q === 'string').map((q) => q.trim()).filter(Boolean);
  if (typeof v.text === 'string') { const t = v.text.trim(); return t ? [t] : []; }
  return [];
}

function fullTextQuote(provision) {
  const full = provision && typeof provision.full_text === 'string' ? provision.full_text.trim() : '';
  if (!full) return [];
  return [full.length > EVIDENCE_SLICE ? `${full.slice(0, EVIDENCE_SLICE)}…` : full];
}

// The single best supporting quote for a scalar/coded feature value.
// Precedence: citable quotes → tagged .text → the clause's own full_text.
function firstQuote(raw, provision) {
  const cq = citableQuotes(raw);
  if (cq.length) return [cq[0]];
  if (isTagged(raw) && raw.text) return [String(raw.text).trim()];
  const inner = unwrap(raw);
  if (isTagged(inner) && inner.text) return [String(inner.text).trim()];
  return fullTextQuote(provision);
}

// ── scalar extractors ──

function enumValue(raw) {
  const inner = unwrap(raw);
  if (inner == null || inner === '') return null;
  if (typeof inner === 'string') return inner.trim();
  if (typeof inner === 'number' || typeof inner === 'boolean') return String(inner);
  if (isTagged(inner)) return String(inner.code).trim();
  return null;
}

function codeFromItem(item) {
  if (item == null || item === '') return null;
  if (isTagged(item)) return String(item.code).trim().toUpperCase();
  if (typeof item === 'string') return item.trim().toUpperCase();
  return null;
}

// The dominant canonical code for an object/tagged feature (handles a mixed
// list by picking the modal code, tie-broken by drafting order).
function codedValue(raw) {
  const inner = unwrap(raw);
  if (inner == null || inner === '') return null;
  const list = Array.isArray(inner) ? inner : [inner];
  const counts = new Map();
  const order = [];
  for (const item of list) {
    const code = codeFromItem(item);
    if (!code) continue;
    if (!counts.has(code)) order.push(code);
    counts.set(code, (counts.get(code) || 0) + 1);
  }
  if (!order.length) return null;
  let best = order[0];
  for (const c of order) if (counts.get(c) > counts.get(best)) best = c;
  return best;
}

function boolValue(raw) {
  const inner = unwrap(raw);
  if (typeof inner === 'boolean') return inner;
  if (inner === 'true') return true;
  if (inner === 'false') return false;
  return null;
}

// Delegates to the one shared "exactly one figure or nothing" parser (see
// lib/parse-money.js's header for the full backstory -- this was one of six
// independent, duplicate implementations of the same rule, three already
// fixed for the identical branch-conditional-headline defect before this
// consolidation). unwrap() stays local: it is this module's own CommonJS
// mirror of lib/citable.js's discriminators (see the header comment on the
// "value-model helpers" section above for why it isn't imported directly),
// not part of the shared parser's job. No scale-word support here (never
// had any, and a duration/percentage value must never be scaled by a
// coincidental "million").
function numericValue(raw) {
  const inner = unwrap(raw);
  return parseMoneyAmount(inner);
}

// The list items for a set feature, each normalized to { key, code, label, text }.
function setItems(raw) {
  const inner = unwrap(raw);
  if (inner == null || inner === '') return [];
  const arr = Array.isArray(inner) ? inner : [inner];
  const out = [];
  for (const item of arr) {
    if (isTagged(item)) {
      const code = String(item.code).trim().toUpperCase();
      out.push({ key: code, code, label: item.label || null, text: (typeof item.text === 'string' && item.text.trim()) || null });
    } else if (typeof item === 'string' && item.trim()) {
      const label = item.trim();
      out.push({ key: label.toLowerCase(), code: null, label, text: null });
    } else if (item && typeof item === 'object') {
      const rawLabel = item.label || item.name || item.value || null;
      const code = item.code ? String(item.code).trim().toUpperCase() : null;
      const key = code || (rawLabel ? String(rawLabel).toLowerCase() : null);
      if (key) out.push({ key, code, label: rawLabel ? String(rawLabel) : code, text: (typeof item.text === 'string' && item.text.trim()) || null });
    }
  }
  return out;
}

// ── deal index + cohort filters ──

const SIZE_BANDS = ['<$1B', '$1B–$10B', '>$10B'];
function sizeBandOf(valueUsd) {
  if (valueUsd == null) return null;
  const n = Number(valueUsd);
  if (!Number.isFinite(n)) return null;
  if (n < 1e9) return '<$1B';
  if (n < 1e10) return '$1B–$10B';
  return '>$10B';
}
function yearOf(announceDate) {
  if (!announceDate) return null;
  const m = String(announceDate).match(/(\d{4})/);
  return m ? Number(m[1]) : null;
}

function dealIndex(deals) {
  const map = new Map();
  for (const d of deals || []) {
    if (!d || d.id == null) continue;
    map.set(d.id, {
      target: d.target || null,
      acquirer: d.acquirer || null,
      sector: d.sector || null,
      value_usd: d.value_usd != null ? d.value_usd : null,
      announce_date: d.announce_date || null,
      sizeBand: sizeBandOf(d.value_usd),
      year: yearOf(d.announce_date),
    });
  }
  return map;
}

// Provisions of a given feature-family type inside the SELECTED cohort. `type`
// is a FEATURES family key (REP-T, IOC, ANTI, …); provision types stored per-
// party collapse to it via familyType(). The cohort is EITHER an explicit
// dealIds subset OR the sector/size/year filters — both just define which
// deals are in scope; side/code select provisions WITHIN each deal.
function filterProvisions(provisions, dIndex, type, filters) {
  const side = filters && filters.side ? String(filters.side).toUpperCase() : null;
  const code = filters && filters.code ? String(filters.code) : null;
  const sector = filters && filters.sector ? String(filters.sector).toLowerCase() : null;
  const sizeBand = filters && filters.sizeBand ? String(filters.sizeBand) : null;
  const year = filters && filters.year != null && filters.year !== '' ? Number(filters.year) : null;
  const dealIdSet = filters && Array.isArray(filters.dealIds) && filters.dealIds.length ? new Set(filters.dealIds) : null;

  const out = [];
  for (const p of provisions || []) {
    if (familyType(p.type) !== type) continue;
    if (side && String(p.type).toUpperCase() !== side) continue;
    if (code && provisionCode(p) !== code) continue;
    if (dealIdSet) {
      if (!dealIdSet.has(p.deal_id)) continue; // explicit hand-picked cohort
    } else {
      const meta = dIndex.get(p.deal_id) || {};
      if (sector && String(meta.sector || '').toLowerCase() !== sector) continue;
      if (sizeBand && meta.sizeBand !== sizeBand) continue;
      if (year != null && meta.year !== year) continue;
    }
    out.push(p);
  }
  return out;
}

function pointBase(p, meta) {
  return { deal_id: p.deal_id, target: meta.target || null, sector: meta.sector || null, provision_id: p.id || null };
}

function round2(x) { return Math.round(x * 100) / 100; }

function normalizeFilters(filters) {
  const f = filters || {};
  return {
    sector: f.sector || null,
    side: f.side || null,
    sizeBand: f.sizeBand || null,
    year: f.year != null && f.year !== '' ? Number(f.year) : null,
    code: f.code || null,
    dealIds: Array.isArray(f.dealIds) && f.dealIds.length ? f.dealIds.slice() : null,
  };
}

function countCohortDeals(matched) {
  const s = new Set();
  for (const p of matched) s.add(p.deal_id);
  return s.size;
}

// ── per-kind distributions (each receives the feature `key`) ──

function categoricalDistribution(matched, dIndex, kind, def, codebook, absentCode) {
  const buckets = new Map(); // value → { value, label, points[], deals:Set }
  const dealsWith = new Set();
  for (const p of matched) {
    const raw = getFeatures(p)[def.key];
    let value = kind === 'enum' ? enumValue(raw) : codedValue(raw);
    const isAbsent = value == null;
    if (isAbsent) { if (absentCode == null) continue; value = absentCode; }
    const meta = dIndex.get(p.deal_id) || {};
    const quotes = isAbsent ? fullTextQuote(p) : firstQuote(raw, p);
    if (!quotes.length) continue; // TRUST GUARDRAIL: never surface uncited data
    const label = kind === 'coded' || isAbsent ? (labelForCode(value, codebook) || value) : value;
    if (!buckets.has(value)) buckets.set(value, { value, label, points: [], deals: new Set() });
    const b = buckets.get(value);
    b.points.push({ ...pointBase(p, meta), quotes });
    b.deals.add(p.deal_id);
    dealsWith.add(p.deal_id);
  }
  const n = dealsWith.size;
  const distribution = [...buckets.values()].map((b) => ({
    value: b.value,
    label: b.label,
    count: b.points.length,
    dealFraction: n ? round2(b.deals.size / n) : 0,
    points: b.points,
  }));
  if (kind === 'enum' && Array.isArray(def.options)) {
    const rank = new Map(def.options.map((o, i) => [String(o), i]));
    distribution.sort((a, b) => {
      const ra = rank.has(String(a.value)) ? rank.get(String(a.value)) : Infinity;
      const rb = rank.has(String(b.value)) ? rank.get(String(b.value)) : Infinity;
      return ra - rb || b.count - a.count;
    });
  } else {
    distribution.sort((a, b) => b.count - a.count || String(a.value).localeCompare(String(b.value)));
  }
  return { n, distribution };
}

function booleanDistribution(matched, dIndex, key) {
  const yes = { value: true, label: 'Yes', points: [], deals: new Set() };
  const no = { value: false, label: 'No', points: [], deals: new Set() };
  const dealsWith = new Set();
  for (const p of matched) {
    const raw = getFeatures(p)[key];
    const v = boolValue(raw);
    if (v == null) continue;
    const quotes = firstQuote(raw, p);
    if (!quotes.length) continue;
    const meta = dIndex.get(p.deal_id) || {};
    const b = v ? yes : no;
    b.points.push({ ...pointBase(p, meta), quotes });
    b.deals.add(p.deal_id);
    dealsWith.add(p.deal_id);
  }
  const n = dealsWith.size;
  const mk = (b) => ({ value: b.value, label: b.label, count: b.points.length, dealFraction: n ? round2(b.deals.size / n) : 0, points: b.points });
  const distribution = [mk(yes), mk(no)].sort((a, b) => b.count - a.count);
  return { n, distribution, presentRate: n ? round2(yes.deals.size / n) : 0 };
}

function setDistribution(matched, dIndex, codebook, key) {
  const buckets = new Map(); // itemKey → { code, label, points[], deals:Set }
  const dealsWith = new Set();
  for (const p of matched) {
    const raw = getFeatures(p)[key];
    const items = setItems(raw);
    if (!items.length) continue;
    const meta = dIndex.get(p.deal_id) || {};
    let contributed = false;
    const seenThisProvision = new Set();
    for (const it of items) {
      const quotes = it.text ? [it.text] : fullTextQuote(p);
      if (!quotes.length) continue; // uncited item dropped
      const label = it.code ? (labelForCode(it.code, codebook) || it.label || it.code) : (it.label || it.key);
      if (!buckets.has(it.key)) buckets.set(it.key, { code: it.code || null, label, points: [], deals: new Set() });
      const b = buckets.get(it.key);
      b.points.push({ ...pointBase(p, meta), item: it.key, quotes });
      if (!seenThisProvision.has(it.key)) { b.deals.add(p.deal_id); seenThisProvision.add(it.key); }
      contributed = true;
    }
    if (contributed) dealsWith.add(p.deal_id);
  }
  const n = dealsWith.size;
  const distribution = [...buckets.values()].map((b) => ({
    code: b.code,
    label: b.label,
    count: b.deals.size, // SET membership: # of deals containing the item
    dealFraction: n ? round2(b.deals.size / n) : 0,
    occurrences: b.points.length,
    points: b.points,
  })).sort((a, b) => b.count - a.count || String(a.label).localeCompare(String(b.label)));
  return { n, distribution };
}

function quantile(sortedAsc, q) {
  if (!sortedAsc.length) return null;
  const pos = (sortedAsc.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sortedAsc[base + 1] !== undefined) return sortedAsc[base] + rest * (sortedAsc[base + 1] - sortedAsc[base]);
  return sortedAsc[base];
}

function numericDistribution(matched, dIndex, key) {
  const points = [];
  const dealsWith = new Set();
  for (const p of matched) {
    const raw = getFeatures(p)[key];
    const num = numericValue(raw);
    if (num == null) continue;
    const quotes = firstQuote(raw, p);
    if (!quotes.length) continue;
    const meta = dIndex.get(p.deal_id) || {};
    points.push({ ...pointBase(p, meta), value: num, quotes });
    dealsWith.add(p.deal_id);
  }
  const vals = points.map((x) => x.value).sort((a, b) => a - b);
  const n = dealsWith.size;
  return {
    n,
    count: points.length,
    median: quantile(vals, 0.5),
    q1: quantile(vals, 0.25),
    q3: quantile(vals, 0.75),
    min: vals.length ? vals[0] : null,
    max: vals.length ? vals[vals.length - 1] : null,
    points,
  };
}

/**
 * compareFeature(provisions, deals, { type, featureKey, filters, absentCode })
 *   Cross-deal distribution for ONE structured feature on ONE provision type,
 *   computed over EXACTLY the selected cohort. Result shape depends on the
 *   feature's declared kind (see module header). Common fields:
 *     { type, featureKey, label, kind, n, cohortSize, filters }.
 *   `n` = deals in the cohort contributing a cited datapoint for this feature.
 *   Every point keeps quotes + provision_id.
 *
 * Cohort filters: { dealIds } OR { sector, sizeBand, year } — plus provision
 * selectors { side, code }.
 */
function compareFeature(provisions, deals, opts) {
  const { type, featureKey, filters = {}, absentCode = null } = opts || {};
  const defs = FEATURES[type];
  if (!defs) throw new Error(`compareFeature: unknown provision type "${type}"`);
  const def = defs.find((d) => d.key === featureKey && featureKind(d));
  if (!def) throw new Error(`compareFeature: feature "${featureKey}" is not comparable on type "${type}"`);
  const kind = featureKind(def);
  const codebook = taxonomyForFeatureKey(featureKey) || {};
  const dIndex = dealIndex(deals);
  const matched = filterProvisions(provisions, dIndex, type, filters);
  const common = {
    type, featureKey, label: def.label, kind,
    cohortSize: countCohortDeals(matched),
    filters: normalizeFilters(filters),
  };

  if (kind === 'numeric') return { ...common, ...numericDistribution(matched, dIndex, def.key) };
  if (kind === 'set') return { ...common, ...setDistribution(matched, dIndex, codebook, def.key) };
  if (kind === 'boolean') return { ...common, ...booleanDistribution(matched, dIndex, def.key) };
  return { ...common, ...categoricalDistribution(matched, dIndex, kind, def, codebook, absentCode) };
}

/**
 * comparableFeatures() → for every provision type in FEATURES, the features
 * that are COMPARABLE as a distribution (schema-derived; no data). Free-`text`
 * and `tiers` features are excluded. Each entry: { key, label, featureType,
 * kind, options?, coded? }.
 */
function comparableFeatures() {
  const out = {};
  for (const [type, defs] of Object.entries(FEATURES)) {
    const seen = new Set();
    const list = [];
    for (const def of defs) {
      if (!def || !def.key || seen.has(def.key)) continue;
      const kind = featureKind(def);
      if (!kind) continue;
      seen.add(def.key);
      const entry = { key: def.key, label: def.label, featureType: def.type, kind };
      if (kind === 'enum' && Array.isArray(def.options)) entry.options = def.options.slice();
      if (taxonomyForFeatureKey(def.key)) entry.coded = true;
      list.push(entry);
    }
    if (list.length) out[type] = list;
  }
  return out;
}

/**
 * codeForFeature(provision, featureKey, { absentCode }) → the canonical code
 * for a single provision's object/tagged feature (dominant code of a mixed
 * list), or `absentCode` when absent/unknown. Powers thin per-feature wrappers
 * such as lib/rep-materiality.js (materialityQualifier → MAT_NO_QUALIFIER).
 */
function codeForFeature(provision, featureKey, opts) {
  const absentCode = opts && 'absentCode' in opts ? opts.absentCode : null;
  const codebook = taxonomyForFeatureKey(featureKey) || {};
  const raw = getFeatures(provision)[featureKey];
  const code = codedValue(raw);
  if (code && Object.prototype.hasOwnProperty.call(codebook, code)) return code;
  if (code && !Object.keys(codebook).length) return code; // no codebook → accept as-is
  return absentCode;
}

/**
 * cohortFeatureStats(provisions, deals, { filters }) → the per-feature baseline
 * for the SELECTED cohort: for every comparable feature that has ≥1 cited
 * datapoint in the cohort, a lean stat (no per-point detail):
 *   { type, featureKey, label, kind, n, mode, modeLabel, median, q1, q3,
 *     distribution }
 * This is recomputed per request over the chosen cohort — never a cached
 * global. featureOutliers judges a deal against exactly this.
 */
function cohortFeatureStats(provisions, deals, opts) {
  const filters = (opts && opts.filters) || {};
  const catalog = comparableFeatures();
  const stats = [];
  for (const [type, feats] of Object.entries(catalog)) {
    for (const f of feats) {
      let dist;
      try {
        dist = compareFeature(provisions, deals, { type, featureKey: f.key, filters });
      } catch { continue; }
      if (!dist.n) continue;
      const stat = { type, featureKey: f.key, label: f.label, kind: f.kind, n: dist.n };
      if (f.kind === 'numeric') {
        stat.median = dist.median; stat.q1 = dist.q1; stat.q3 = dist.q3;
        stat.min = dist.min; stat.max = dist.max;
      } else {
        const lean = (dist.distribution || []).map(({ value, code, label, count, dealFraction }) => ({ value, code, label, count, dealFraction }));
        stat.distribution = lean;
        const top = lean[0] || null;
        stat.mode = top ? (top.value !== undefined ? top.value : top.code) : null;
        stat.modeLabel = top ? top.label : null;
      }
      stats.push(stat);
    }
  }
  return stats;
}

// The deal-value for an outlier-eligible (categorical/boolean/numeric) stat.
function dealValueForStat(provision, stat) {
  const raw = getFeatures(provision)[stat.featureKey];
  if (stat.kind === 'enum') return enumValue(raw);
  if (stat.kind === 'coded') return codedValue(raw);
  if (stat.kind === 'boolean') return boolValue(raw);
  if (stat.kind === 'numeric') return numericValue(raw);
  return null;
}

/**
 * featureOutliers(dealProvisions, corpusStats, { minN }) → for one deal, the
 * features whose value DIFFERS from the SELECTED cohort's mode/median.
 * corpusStats MUST be cohortFeatureStats() for the same cohort the deal is
 * being judged against (off-market means off-market for THIS cohort).
 *
 * TRUST GUARDRAIL: `offMarket` is true ONLY when the cohort n ≥ minN
 * (default 12). Below that the divergence is reported as INFORMATION ONLY
 * (offMarket:false, "differs from N of M deals in this cohort"). Set kinds are
 * not evaluated (documented limitation). Every entry keeps a quote.
 *
 * @returns {Array<{ type, featureKey, label, kind, dealValue, dealLabel,
 *   modeValue, modeLabel, median, corpusN, offMarket, differsFrom, ofDeals,
 *   provision_id, quotes }>}
 */
function featureOutliers(dealProvisions, corpusStats, opts) {
  const minN = opts && Number.isFinite(opts.minN) ? opts.minN : DEFAULT_MIN_N;
  const byType = new Map();
  for (const s of corpusStats || []) {
    if (!byType.has(s.type)) byType.set(s.type, []);
    byType.get(s.type).push(s);
  }
  const out = [];
  for (const p of dealProvisions || []) {
    const type = familyType(p.type);
    const stats = byType.get(type);
    if (!stats) continue;
    for (const stat of stats) {
      if (!(stat.kind === 'enum' || stat.kind === 'coded' || stat.kind === 'boolean' || stat.kind === 'numeric')) continue;
      const raw = getFeatures(p)[stat.featureKey];
      const dealValue = dealValueForStat(p, stat);
      if (dealValue == null) continue;
      const quotes = firstQuote(raw, p);
      if (!quotes.length) continue; // never surface an uncited datapoint

      let differs = false;
      let differsFrom = null;
      let modeValue = null;
      let modeLabel = null;
      let dealLabel = String(dealValue);

      if (stat.kind === 'numeric') {
        modeValue = stat.median;
        if (stat.q1 != null && stat.q3 != null && (dealValue < stat.q1 || dealValue > stat.q3)) differs = true;
      } else {
        modeValue = stat.mode;
        modeLabel = stat.modeLabel;
        if (String(dealValue) !== String(stat.mode)) differs = true;
        const share = (stat.distribution || []).find((d) => String(d.value !== undefined ? d.value : d.code) === String(dealValue));
        if (share) dealLabel = share.label || dealLabel;
        const sameDeals = share ? Math.round((share.dealFraction || 0) * stat.n) : 0;
        differsFrom = stat.n - sameDeals;
      }
      if (!differs) continue;

      out.push({
        type,
        featureKey: stat.featureKey,
        label: stat.label,
        kind: stat.kind,
        dealValue,
        dealLabel,
        modeValue,
        modeLabel,
        median: stat.kind === 'numeric' ? stat.median : undefined,
        corpusN: stat.n,
        // HARD RULE: off-market only above the sample-size floor for THIS cohort.
        offMarket: stat.n >= minN,
        differsFrom,
        ofDeals: stat.n,
        provision_id: p.id || null,
        quotes,
      });
    }
  }
  return out;
}

module.exports = {
  compareFeature,
  comparableFeatures,
  cohortFeatureStats,
  featureOutliers,
  codeForFeature,
  featureKind,
  sizeBandOf,
  SIZE_BANDS,
  DEFAULT_MIN_N,
  // low-level helpers exposed for the thin wrapper + tests
  getFeatures,
  codedValue,
  enumValue,
  boolValue,
  numericValue,
  setItems,
};
