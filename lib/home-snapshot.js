const snapshot = require('./generated/home-deal-directory-v1.json');

const SNAPSHOT_SCHEMA_VERSION = 'home-deal-directory/v1';
const MAX_DEALS = 100;
const DEAL_KEYS = [
  'id',
  'deal_name',
  'buyer_display',
  'target_display',
  'signing_date',
  'value',
  'value_band',
  'value_provenance',
  'consideration_type',
  'buyer_profile',
  'sector',
  'structure',
  'merger_form',
  'advisors',
];
const ADVISOR_KEYS = [
  'buyer_firms',
  'seller_firms',
  'buyer_lawyers',
  'seller_lawyers',
];
const FORBIDDEN_KEYS = new Set(['full_text', 'ai_metadata', 'metadata', 'features']);

function assertExactKeys(value, expected, label) {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new Error(`${label} has an invalid field set`);
  }
}

function assertNoForbiddenKeys(value, path = 'snapshot') {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key)) throw new Error(`${path}.${key} is forbidden`);
    assertNoForbiddenKeys(child, `${path}.${key}`);
  }
}

function validateDeal(deal, index) {
  if (!deal || typeof deal !== 'object' || Array.isArray(deal)) {
    throw new Error(`deal ${index} must be an object`);
  }
  assertExactKeys(deal, DEAL_KEYS, `deal ${index}`);
  if (typeof deal.id !== 'string' || !deal.id) throw new Error(`deal ${index} has no id`);
  if (typeof deal.deal_name !== 'string' || !deal.deal_name) {
    throw new Error(`deal ${index} has no deal_name`);
  }
  if (!deal.advisors || typeof deal.advisors !== 'object' || Array.isArray(deal.advisors)) {
    throw new Error(`deal ${index} has invalid advisors`);
  }
  assertExactKeys(deal.advisors, ADVISOR_KEYS, `deal ${index} advisors`);
  for (const key of ADVISOR_KEYS) {
    if (!Array.isArray(deal.advisors[key])) {
      throw new Error(`deal ${index} advisors.${key} must be an array`);
    }
  }
}

function validateDealDirectorySnapshot(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('home deal-directory snapshot must be an object');
  }
  assertExactKeys(value, ['_meta', 'deals'], 'home deal-directory snapshot');
  if (!value._meta || value._meta.schema_version !== SNAPSHOT_SCHEMA_VERSION) {
    throw new Error(`home deal-directory snapshot must use ${SNAPSHOT_SCHEMA_VERSION}`);
  }
  if (!Array.isArray(value.deals) || value.deals.length > MAX_DEALS) {
    throw new Error(`home deal-directory snapshot exceeds ${MAX_DEALS} deals`);
  }
  if (value._meta.deal_count !== value.deals.length) {
    throw new Error('home deal-directory snapshot count does not match its rows');
  }
  const ids = new Set();
  value.deals.forEach((deal, index) => {
    validateDeal(deal, index);
    if (ids.has(deal.id)) throw new Error(`duplicate deal id ${deal.id}`);
    ids.add(deal.id);
  });
  assertNoForbiddenKeys(value);
  return value;
}

const validatedSnapshot = validateDealDirectorySnapshot(snapshot);

function getHomePayload() {
  return { deals: validatedSnapshot.deals };
}

module.exports = {
  ADVISOR_KEYS,
  DEAL_KEYS,
  MAX_DEALS,
  SNAPSHOT_SCHEMA_VERSION,
  getHomePayload,
  validateDealDirectorySnapshot,
};
