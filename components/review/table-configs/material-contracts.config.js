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
// no such markers exist), and take the $ figure nearest the anchor. A
// bucket whose own clause has no $ figure (e.g. JV_PARTNERSHIPS,
// EXCLUSIVITY_MFN on Metsera) honestly falls back to NO_THRESHOLD_LABEL
// rather than borrowing a neighboring clause's number.
// This is a STOPGAP: it recovers most buckets' thresholds from existing
// text, but the durable fix is an upstream extract.js/rubric.js change that
// emits a real per-bucket dollarThreshold at extraction time -- once that
// lands, thresholdsByCode()/item.threshold will take priority over mining
// (see mineThresholdFromText() call sites below) and this regex path can be
// deleted.
const NO_THRESHOLD_LABEL = 'No $ threshold captured -- see text';
const DOLLAR_RE = /\$[\d,]+(?:\.\d+)?/g;
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
// guess). See the stopgap comment above NO_THRESHOLD_LABEL.
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
  const evidence = (tagged && item.text) || textOf(source);
  const structuredThreshold = thresholdText((tagged && (item.threshold ?? item.qualifier)) ?? thresholds.get(code));
  const meta = code && MATERIAL_CONTRACT_BUCKET_META[code];
  // Mining only runs when no real (structured) threshold was extracted --
  // structured data always wins. Try the bucket's own isolated text first,
  // then the full card text (still anchored + clause-windowed, so no
  // cross-bucket misattribution risk) as a second attempt.
  const mined = !structuredThreshold && meta
    ? (mineThresholdFromText(evidence, meta) || mineThresholdFromText(textOf(source), meta))
    : null;
  return {
    id: `material-contracts-${code || index}-${index}`,
    code,
    label,
    threshold: structuredThreshold || mined || NO_THRESHOLD_LABEL,
    evidence,
    source,
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
      label: MATERIAL_CONTRACT_BUCKET_CODES[code] || meta.label || code,
      threshold: mineThresholdFromText(text, meta) || NO_THRESHOLD_LABEL,
      evidence: text,
      source,
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

function renderThreshold(row, ctx) {
  const ThresholdCellWithHoverQuote = ctx?.primitives?.ThresholdCellWithHoverQuote;
  if (!ThresholdCellWithHoverQuote) return row.threshold;
  return React.createElement(ThresholdCellWithHoverQuote, {
    threshold: row.threshold,
    evidence: row.evidence,
    source: row.source,
  });
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
    const source = (reviewDeal?.cards || []).find(isMaterialContractsCard);
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
