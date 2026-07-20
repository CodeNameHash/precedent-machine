import React from 'react';
import taxonomy from '../../../lib/taxonomy.js';

const { MATERIAL_CONTRACT_BUCKET_CODES, MATERIAL_CONTRACT_BUCKET_META } = taxonomy;

// Spec §5 (REBUILD-SPECS.md): Ben's two complaints on the old shape --
// (1) contract-type titles repeated. The old renderer cross-listed every
//     OTHER bucket that co-occurred in the same evidence text as a nested
//     "alsoCovered" checklist item under EACH row (withDerivedRows()), so a
//     source card mentioning three contract types produced three rows, each
//     also listing the other two nested underneath -- every title rendered
//     N times instead of once. Fixed by not cross-listing at all: a detected
//     bucket is ONE row, full stop.
// (2) bucket coverage was a synthetic first ROW (ComputedRollupHeader via a
//     `rollup: true` row prepended to the table body) -- a mid-table row,
//     not a footer. Fixed by moving coverage to config.renderFooter, reusing
//     the CoverageFooter primitive exactly as conditions.config.js does.
function cardCode(card) {
  return String(card?.provision_subtype || card?.canonical_code || card?.provision_code || '').trim().toUpperCase();
}
function cardFeatures(card) {
  if (card?.features && typeof card.features === 'object') return card.features;
  const meta = card?.ai_metadata;
  if (meta?.features && typeof meta.features === 'object') return meta.features;
  return {};
}
function isMaterialContractsCard(card) {
  const code = cardCode(card);
  const title = `${card?.short_title || ''} ${card?.defined_term || ''}`;
  return card?.provision_type === 'MATERIAL_CONTRACT' ||
    code === 'REP-T-MATERIAL-CONTRACTS' ||
    /material\s+contracts?/i.test(title);
}
// FIX 1 (Fable investigation): the real "Material Contracts" rep card
// (provision_type REPRESENTATION, subtype REP-T-MATERIAL-CONTRACTS -- e.g.
// QXO/TopBuild §3.1(p), carrying materialContractsBuckets) must always win
// over an unrelated DEFINITION card whose title merely matches the loose
// /material\s+contracts?/i regex (e.g. an inline "Material Contract" defined
// term embedded in a Supplier Contracts definition). provenance.source_doc_
// offset_start is 0 corpus-wide so array order/position can't be used as a
// tiebreak -- selection must be structural (provision_type/subtype/kind),
// never sort-based.
function isMaterialContractsRepCard(card) {
  const type = String(card?.provision_type || card?.type || '').trim().toUpperCase();
  return card?.kind !== 'definition' &&
    type === 'REPRESENTATION' &&
    cardCode(card) === 'REP-T-MATERIAL-CONTRACTS';
}
function isTagged(item) {
  return item && typeof item === 'object' && !Array.isArray(item) && typeof item.code === 'string';
}
function textOf(card) {
  return String(card?.primary_quote || card?.defined_value || card?.region_full_text || '').trim();
}
function thresholdText(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'object') return raw.threshold || raw.value || raw.qualifier || raw.text || raw.label || null;
  return String(raw);
}
// EXTRACTION GAP (punch-list #24) + MC1 stopgap mining (punch-list round 3):
// no card in production has ever populated a structured per-bucket dollar
// threshold -- materialContractsBuckets[].threshold and
// materialContractsDollarThresholds are both empty in real extraction runs
// (confirmed against the live Metsera "Material Contracts" card, which has
// no `features` at all). BUT the $ figures ($500,000 / $2,000,000 / $50,000
// -style) ARE present verbatim in the card's primary_quote, one per
// numbered "Specified Contract" clause -- Metsera has ~12 distinct $ figures
// in one blob, so a single global regex would misattribute the wrong
// figure to the wrong bucket. Instead, mine PER BUCKET: anchor on that
// bucket's own taxonomy synonym match, bound the search to the clause the
// anchor sits in (using the numbered-list markers "(i)"..."(xxi)" this
// boilerplate reliably uses, falling back to a fixed character window when
// no such markers exist), and take the $ figure nearest the anchor.
// MC3 (punch-list round 4): a bucket whose own clause has no $ figure is not
// necessarily a data gap -- many buckets (NONCOMPETE, ROFR_ROFN,
// SINGLE_SOURCE, JV_PARTNERSHIPS, exclusivity, ...) are type-based with NO
// dollar floor by design ("any Contract that..."). So a missing $ figure
// falls back through a second, narrower mine for a non-dollar quantitative
// test (percentage / "top N" gates) anchored the same way, and only then to
// ANY_LABEL -- never a bare "see text" escape hatch.
// This is a STOPGAP: it recovers most buckets' thresholds from existing
// text, but the durable fix is an upstream extract.js/rubric.js change that
// emits a real per-bucket dollarThreshold (or explicit "no floor" flag) at
// extraction time -- once that lands, thresholdsByCode()/item.threshold
// will take priority over mining (see resolveThreshold() below) and this
// regex path can be deleted.
const ANY_LABEL = 'Any';
const DOLLAR_RE = /\$[\d,]+(?:\.\d+)?/g;
const PERCENT_RE = /\b\d{1,3}(?:\.\d+)?\s?%/;
const TOP_N_RE = /\btop\s+(\d+)\b/i;
// Numbered-list clause markers like "(i)" "(ii)" ... "(xxi)" -- lowercase
// roman numerals only, so upper-case sub-clause letters such as (A)/(B)/(C)
// (used for sub-limbs WITHIN one numbered clause, e.g. Metsera clause (xi))
// are not mistaken for separate clause boundaries.
const CLAUSE_MARKER_RE = /\([ivxlcdm]{1,7}\)/g;
const PROXIMITY_FALLBACK_CHARS = 400;
function findDollarAmounts(text) {
  const out = [];
  const re = new RegExp(DOLLAR_RE.source, 'g');
  let m = re.exec(text);
  while (m) {
    out.push({ index: m.index, text: m[0] });
    m = re.exec(text);
  }
  return out;
}
function findClauseMarkers(text) {
  const out = [];
  const re = new RegExp(CLAUSE_MARKER_RE.source, 'g');
  let m = re.exec(text);
  while (m) {
    out.push(m.index);
    m = re.exec(text);
  }
  return out;
}
function earliestSynonymIndex(text, synonyms) {
  let best = -1;
  for (const syn of synonyms || []) {
    if (!(syn instanceof RegExp)) continue;
    const re = new RegExp(syn.source, syn.flags.includes('g') ? syn.flags : `${syn.flags}g`);
    const m = re.exec(text);
    if (m && (best === -1 || m.index < best)) best = m.index;
  }
  return best;
}
function clauseWindow(text, markers, anchorIndex) {
  if (markers.length) {
    let start = 0;
    let end = text.length;
    for (const markerIndex of markers) {
      if (markerIndex <= anchorIndex) start = markerIndex;
      else { end = markerIndex; break; }
    }
    return [start, end];
  }
  return [Math.max(0, anchorIndex - PROXIMITY_FALLBACK_CHARS), Math.min(text.length, anchorIndex + PROXIMITY_FALLBACK_CHARS)];
}
// Anchor on `meta`'s taxonomy synonym for this bucket, bound the search to
// that clause, and return the nearest $ figure -- or null if the bucket's
// own clause carries none (an honest "can't isolate it" signal, never a
// guess). See the stopgap comment above ANY_LABEL.
function mineThresholdFromText(text, meta) {
  if (!text || !meta) return null;
  const anchorIndex = earliestSynonymIndex(text, meta.synonyms);
  if (anchorIndex === -1) return null;
  const dollars = findDollarAmounts(text);
  if (!dollars.length) return null;
  const markers = findClauseMarkers(text);
  const [start, end] = clauseWindow(text, markers, anchorIndex);
  const inWindow = dollars.filter((d) => d.index >= start && d.index < end);
  if (!inWindow.length) return null;
  inWindow.sort((a, b) => Math.abs(a.index - anchorIndex) - Math.abs(b.index - anchorIndex));
  return inWindow[0].text;
}
// Same anchor-and-window approach as mineThresholdFromText, but for the
// non-dollar quantitative gates a handful of buckets use instead of a $
// figure (e.g. "top 20 suppliers/customers"). Deliberately narrow --
// percentage and top-N are unambiguous materiality gates; things like a
// clause's day/month notice period are NOT a materiality threshold and are
// left alone rather than guessed at.
function mineNonDollarTest(text, meta) {
  if (!text || !meta) return null;
  const anchorIndex = earliestSynonymIndex(text, meta.synonyms);
  if (anchorIndex === -1) return null;
  const markers = findClauseMarkers(text);
  const [start, end] = clauseWindow(text, markers, anchorIndex);
  const window = text.slice(start, end);
  const topMatch = window.match(TOP_N_RE);
  if (topMatch) return `Top ${topMatch[1]}`;
  const pctMatch = window.match(PERCENT_RE);
  if (pctMatch) return pctMatch[0].replace(/\s+/, '');
  return null;
}
function formatDollarAmount(raw) {
  const digits = String(raw).replace(/[^0-9.]/g, '');
  if (!digits) return String(raw);
  const [whole, frac] = digits.split('.');
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `$${withCommas}${frac ? `.${frac}` : ''}`;
}
// MC2: dollar figures always render "$" + thousands separators, whether they
// arrived as a bare digit string ("2000000", the shape a structured
// threshold or upstream extraction is likeliest to hand back) or already
// carry a "$" (mined text, which inherits the source document's own commas
// verbatim and so is usually already formatted -- reformatting is a no-op).
function formatThresholdDisplay(text) {
  if (text === null || text === undefined) return text;
  const str = String(text).trim();
  if (!str) return str;
  if (/^\$?[\d,]+(?:\.\d+)?$/.test(str)) return formatDollarAmount(str);
  if (/\$[\d,]+(?:\.\d+)?/.test(str)) return str.replace(DOLLAR_RE, (m) => formatDollarAmount(m));
  return str;
}
// MC3: the single per-bucket trigger resolver. Priority: a real structured
// threshold always wins; else mine the bucket's own clause (evidence text,
// then the full card text) for a $ figure; else mine the same window for a
// non-dollar quantitative gate; else the bucket is honestly type-based --
// "Any" contract of that type triggers disclosure, never a bare "see text".
function resolveThreshold(structuredThreshold, evidenceText, fullText, meta) {
  if (structuredThreshold) return formatThresholdDisplay(structuredThreshold);
  const mined = mineThresholdFromText(evidenceText, meta) || mineThresholdFromText(fullText, meta);
  if (mined) return formatThresholdDisplay(mined);
  const nonDollar = mineNonDollarTest(evidenceText, meta) || mineNonDollarTest(fullText, meta);
  return nonDollar || ANY_LABEL;
}
function thresholdsByCode(features) {
  const out = new Map();
  const list = Array.isArray(features.materialContractsDollarThresholds) ? features.materialContractsDollarThresholds : [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const code = String(item.bucket || item.code || '').toUpperCase();
    if (code) out.set(code, thresholdText(item.threshold ?? item.value ?? item.qualifier));
  }
  return out;
}
function rowFromBucket(item, index, source, thresholds) {
  const tagged = isTagged(item);
  const code = tagged ? String(item.code).toUpperCase() : '';
  const label = (code && MATERIAL_CONTRACT_BUCKET_CODES[code]) ||
    (tagged && item.label) ||
    (typeof item === 'string' ? item : `Contract type ${index + 1}`);
  // Ben (round 6): the Evidence column must show the PROVISION TEXT, not the
  // canonical code. The bucket item's `.text` is the code (e.g. "SINGLE_SOURCE");
  // the actual §3.13 clause lives in `.quotes[0]`.
  const evidence = (tagged && (Array.isArray(item.quotes) && item.quotes[0])) || (tagged && item.text) || textOf(source);
  const structuredThreshold = thresholdText((tagged && (item.threshold ?? item.qualifier)) ?? thresholds.get(code));
  const meta = code && MATERIAL_CONTRACT_BUCKET_META[code];
  return {
    id: `material-contracts-${code || index}-${index}`,
    code,
    itemCode: code || null,
    featureKeys: ['materialContractsBuckets'],
    label,
    threshold: resolveThreshold(structuredThreshold, evidence, textOf(source), meta),
    evidence,
    source,
    sourceCard: source,
    present: true,
  };
}
function rowsFromFeatures(source) {
  const features = cardFeatures(source);
  const buckets = Array.isArray(features.materialContractsBuckets) ? features.materialContractsBuckets : [];
  if (!buckets.length) return [];
  const thresholds = thresholdsByCode(features);
  return buckets.map((item, index) => rowFromBucket(item, index, source, thresholds));
}
function rowsFromText(source) {
  const text = textOf(source);
  if (!text) return [];
  const rows = [];
  for (const [code, meta] of Object.entries(MATERIAL_CONTRACT_BUCKET_META || {})) {
    if (code === 'OTHER') continue;
    const hit = (meta.synonyms || []).some((re) => re.test(text));
    if (!hit) continue;
    rows.push({
      id: `material-contracts-${code}`,
      code,
      itemCode: code,
      featureKeys: ['materialContractsBuckets'],
      label: MATERIAL_CONTRACT_BUCKET_CODES[code] || meta.label || code,
      threshold: resolveThreshold(null, text, text, meta),
      evidence: text,
      source,
      sourceCard: source,
      present: true,
    });
  }
  return rows;
}

// One line per contract type: a single pill, the friendly bucket label as
// its only text. No ordinal wrapper, no nested "also covered" checklist --
// the title renders exactly once, here.
function renderTerm(row, ctx) {
  const PillCell = ctx?.primitives?.PillCell;
  if (!PillCell) return row.label;
  return React.createElement(PillCell, {
    label: row.label,
    value: row.code,
    tone: 'present',
    evidence: row.evidence,
    source: row.source,
  });
}

// MC2: threshold text renders in the agreement's normal body font, not the
// mono/code style ThresholdCellWithHoverQuote hardcodes -- build the same
// hover-quote affordance directly off EvidenceHoverSource instead.
function renderThreshold(row, ctx) {
  const EvidenceHoverSource = ctx?.primitives?.EvidenceHoverSource;
  if (!EvidenceHoverSource) return row.threshold;
  return React.createElement(EvidenceHoverSource, {
    evidence: row.evidence,
    source: row.source,
    as: 'span',
    className: 'text-[11px] text-ink',
  }, row.threshold);
}

function renderEvidence(row, ctx) {
  const EvidenceHoverSource = ctx?.primitives?.EvidenceHoverSource;
  if (!EvidenceHoverSource || !row.evidence) return row.evidence;
  return React.createElement(EvidenceHoverSource, { evidence: row.evidence, source: row.source, as: 'span' }, row.evidence);
}

// Footer strip (outside the table body, via config.renderFooter -- never a
// mid-table row): "N of M contract-type buckets covered" plus the
// not-covered canonical buckets, collapsed. Reuses the CoverageFooter
// primitive conditions.config.js established, exactly per spec.
function renderMaterialContractsFooter(rows, ctx) {
  const CoverageFooter = ctx?.primitives?.CoverageFooter;
  if (!CoverageFooter) return null;
  const canonicalEntries = Object.entries(MATERIAL_CONTRACT_BUCKET_META || {}).filter(([code]) => code !== 'OTHER');
  const presentCodes = new Set((rows || []).map((row) => row.code).filter(Boolean));
  const presentCount = canonicalEntries.filter(([code]) => presentCodes.has(code)).length;
  const totalCount = canonicalEntries.length;
  const absentItems = canonicalEntries
    .filter(([code]) => !presentCodes.has(code))
    .map(([code, meta]) => ({ id: code, code, label: MATERIAL_CONTRACT_BUCKET_CODES[code] || meta.label || code }));
  return React.createElement(CoverageFooter, {
    presentCount,
    totalCount,
    absentItems,
    label: 'contract-type buckets covered',
  });
}

const materialContractsConfig = {
  id: 'material-contracts',
  title: 'Material Contracts',
  layoutSlot: 'material-contracts',
  // Punch-list #23: the section already renders `title` once as the
  // collapsible <h2> above this table (pages/review/[id].js); ProvisionTable
  // used to print config.title a second time in its own chrome strip
  // immediately below, so "Material Contracts" appeared twice back-to-back.
  // Same fix as the MAE section's title dedup (#22) -- opt out of the
  // in-table repeat via ProvisionTable's hideRepeatedTitle flag.
  hideRepeatedTitle: true,
  selectRows(reviewDeal) {
    const cards = reviewDeal?.cards || [];
    // FIX 1: the REP-T-MATERIAL-CONTRACTS rep card always wins; only fall
    // back to the looser title-regex match (excluding definition cards) when
    // no such rep card exists on the deal.
    const source = cards.find(isMaterialContractsRepCard) ||
      cards.find((card) => card?.kind !== 'definition' && isMaterialContractsCard(card)) ||
      cards.find(isMaterialContractsCard);
    if (!source) return [];
    const featureRows = rowsFromFeatures(source);
    return featureRows.length ? featureRows : rowsFromText(source);
  },
  columns: [
    { id: 'bucket', header: 'Contract Type', width: '24rem', renderCell: renderTerm },
    { id: 'threshold', header: 'Threshold', width: '12rem', renderCell: renderThreshold },
    { id: 'evidence', header: 'Evidence', renderCell: renderEvidence },
  ],
  empty: { copy: 'No material-contract rows found.' },
  renderFooter: renderMaterialContractsFooter,
};

export { materialContractsConfig, renderEvidence, renderTerm, renderThreshold };
