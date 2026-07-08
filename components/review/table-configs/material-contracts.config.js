import React from 'react';
import taxonomy from '../../../lib/taxonomy.js';

const { MATERIAL_CONTRACT_BUCKET_CODES, MATERIAL_CONTRACT_BUCKET_META } = taxonomy;

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
function matchingBucketCodes(text) {
  if (!text) return [];
  return Object.entries(MATERIAL_CONTRACT_BUCKET_META || {})
    .filter(([code, meta]) => code !== 'OTHER' && (meta.synonyms || []).some((re) => re.test(text)))
    .map(([code]) => code);
}
function coverageRow(rows) {
  const canonicalCodes = Object.keys(MATERIAL_CONTRACT_BUCKET_CODES || {}).filter((code) => code !== 'OTHER');
  const presentCodes = new Set(rows.map((row) => row.code).filter(Boolean));
  const percent = canonicalCodes.length ? Math.round((presentCodes.size / canonicalCodes.length) * 100) : 0;
  return {
    id: 'material-contracts-coverage',
    label: 'Bucket coverage',
    coverage: `${presentCodes.size}/${canonicalCodes.length} canonical buckets (${percent}%)`,
    detail: 'Structured buckets mapped from material-contracts features or canonical synonym fallback.',
    present: true,
    rollup: true,
  };
}
function withDerivedRows(rows, source) {
  const fallbackText = textOf(source);
  const enriched = rows.map((row, index) => {
    const hits = matchingBucketCodes(row.evidence || fallbackText)
      .filter((code) => code !== row.code)
      .map((code) => ({
        id: `${row.id}-also-${code}`,
        label: MATERIAL_CONTRACT_BUCKET_CODES[code] || code,
        present: true,
        evidence: row.evidence || fallbackText,
        source,
      }));
    return {
      ...row,
      ordinal: index,
      source,
      alsoCovered: hits,
    };
  });
  return enriched.length ? [coverageRow(enriched), ...enriched] : [];
}
function rowFromBucket(item, index, source, thresholds) {
  const tagged = isTagged(item);
  const code = tagged ? String(item.code).toUpperCase() : '';
  const label = (code && MATERIAL_CONTRACT_BUCKET_CODES[code]) ||
    (tagged && item.label) ||
    (typeof item === 'string' ? item : `Contract type ${index + 1}`);
  const threshold = thresholdText((tagged && (item.threshold ?? item.qualifier)) ?? thresholds.get(code));
  return {
    id: `material-contracts-${code || index}-${index}`,
    code,
    label,
    threshold: threshold || 'No $ threshold',
    evidence: (tagged && item.text) || textOf(source),
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
      threshold: 'No $ threshold',
      evidence: text,
      present: true,
    });
  }
  return rows;
}

function renderBucket(row, ctx) {
  const primitives = ctx?.primitives || {};
  if (row.rollup) {
    const Header = primitives.ComputedRollupHeader;
    if (!Header) return `${row.label}: ${row.coverage}`;
    return React.createElement(Header, { label: row.label, value: row.coverage, detail: row.detail, tone: 'info' });
  }
  const PillCell = primitives.PillCell;
  const RomanNumeralOrdinal = primitives.RomanNumeralOrdinal;
  const CoverageChecklist = primitives.CoverageChecklist;
  if (!PillCell) return row.label;
  const bucket = React.createElement(PillCell, {
    label: row.label,
    value: row.code,
    tone: 'present',
    evidence: row.evidence,
    source: row.source,
  });
  const checklist = row.alsoCovered?.length && CoverageChecklist
    ? React.createElement(CoverageChecklist, { items: row.alsoCovered, emptyCopy: '' })
    : null;
  const body = React.createElement('div', { className: 'space-y-1' }, bucket, checklist);
  return RomanNumeralOrdinal ? React.createElement(RomanNumeralOrdinal, { index: row.ordinal }, body) : body;
}

function renderThreshold(row, ctx) {
  if (row.rollup) return null;
  const ThresholdCellWithHoverQuote = ctx?.primitives?.ThresholdCellWithHoverQuote;
  if (!ThresholdCellWithHoverQuote) return row.threshold;
  return React.createElement(ThresholdCellWithHoverQuote, {
    threshold: row.threshold,
    evidence: row.evidence,
    source: row.source,
  });
}

function renderEvidence(row, ctx) {
  if (row.rollup) return row.detail;
  const EvidenceHoverSource = ctx?.primitives?.EvidenceHoverSource;
  if (!EvidenceHoverSource || !row.evidence) return row.evidence;
  return React.createElement(EvidenceHoverSource, { evidence: row.evidence, source: row.source, as: 'span' }, row.evidence);
}

const materialContractsConfig = {
  id: 'material-contracts',
  title: 'Material Contracts',
  layoutSlot: 'material-contracts',
  selectRows(reviewDeal) {
    const source = (reviewDeal?.cards || []).find(isMaterialContractsCard);
    if (!source) return [];
    const featureRows = rowsFromFeatures(source);
    return withDerivedRows(featureRows.length ? featureRows : rowsFromText(source), source);
  },
  columns: [
    { id: 'bucket', header: 'Bucket', width: '24rem', renderCell: renderBucket },
    { id: 'threshold', header: 'Threshold', width: '12rem', renderCell: renderThreshold },
    { id: 'evidence', header: 'Evidence', renderCell: renderEvidence },
  ],
  empty: { copy: 'No material-contract rows found.' },
};

export { materialContractsConfig, renderBucket, renderEvidence, renderThreshold };
