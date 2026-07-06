import schema from './index';
import { CATEGORY_SUMMARY_FEATURES as LEGACY_CATEGORY_SUMMARY_FEATURES } from '../category-summary-features';

const { getFeature } = schema;

function withSchemaMetadata(row) {
  const keys = Array.isArray(row?.keys) ? row.keys : [];
  const schemaFeatures = keys
    .map((key) => getFeature(key))
    .filter(Boolean);

  return {
    ...row,
    schemaFeatures,
    primaryFeature: schemaFeatures[0] || null,
  };
}

function getCategorySummaryRows(type) {
  return (LEGACY_CATEGORY_SUMMARY_FEATURES[type] || []).map(withSchemaMetadata);
}

const CATEGORY_SUMMARY_FEATURES = Object.fromEntries(
  Object.keys(LEGACY_CATEGORY_SUMMARY_FEATURES).map((type) => [type, getCategorySummaryRows(type)]),
);

export {
  CATEGORY_SUMMARY_FEATURES,
  getCategorySummaryRows,
};
