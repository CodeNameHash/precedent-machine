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
function rowFromBucket(item, index, source, thresholds) {
  const tagged = isTagged(item);
  const code = tagged ? String(item.code).toUpperCase() : '';
  const label = (code && MATERIAL_CONTRACT_BUCKET_CODES[code]) ||
    (tagged && item.label) ||
    (typeof item === 'string' ? item : `Contract type ${index + 1}`);
  const threshold = thresholdText((tagged && (item.threshold ?? item.qualifier)) ?? thresholds.get(code));
  return {
    id: `material-contracts-${code || index}-${index}`,
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
      label: MATERIAL_CONTRACT_BUCKET_CODES[code] || meta.label || code,
      threshold: 'No $ threshold',
      evidence: text,
      present: true,
    });
  }
  return rows;
}

const materialContractsConfig = {
  id: 'material-contracts',
  title: 'Material Contracts',
  layoutSlot: 'material-contracts',
  selectRows(reviewDeal) {
    const source = (reviewDeal?.cards || []).find(isMaterialContractsCard);
    if (!source) return [];
    const featureRows = rowsFromFeatures(source);
    return featureRows.length ? featureRows : rowsFromText(source);
  },
  columns: [
    { id: 'bucket', header: 'Bucket', width: '24rem', renderCell: (row) => row.label },
    { id: 'threshold', header: 'Threshold', width: '12rem', renderCell: (row) => row.threshold },
    { id: 'evidence', header: 'Evidence', renderCell: (row) => row.evidence },
  ],
  empty: { copy: 'No material-contract rows found.' },
};

export { materialContractsConfig };
