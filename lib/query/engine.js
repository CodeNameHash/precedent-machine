const { executeDealCompare } = require('./executors/deal-compare');
const { executeProvisionCrossCut } = require('./executors/provision-cross-cut');
const { executeMarketRange } = require('./executors/market-range');
const { executeFilterThenList } = require('./executors/filter-then-list');
const { executeDealToMarket } = require('./executors/deal-to-market');
const { PROVISION_CARD_TYPES, QUERY_KINDS, fieldDef } = require('./types');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertDealIds(ids, context) {
  assert(Array.isArray(ids) && ids.length > 0, 'deal_ids must be a non-empty array');
  const known = new Set((context.deals || []).map((deal) => deal.id));
  for (const id of ids) assert(known.has(id), `deal_id does not exist: ${id}`);
}

function assertProvisionType(type) {
  assert(PROVISION_CARD_TYPES.includes(type), `invalid provision_type: ${type}`);
}

function assertField(type, fieldPath) {
  assert(fieldDef(type, fieldPath), `field_path does not resolve: ${type}.${fieldPath}`);
}

function validate(kind, payload, context) {
  assert(QUERY_KINDS.includes(kind), `invalid query_kind: ${kind}`);
  assert(payload && typeof payload === 'object' && !Array.isArray(payload), 'query_payload must be an object');
  if (kind === 'DEAL_COMPARE') {
    assertDealIds(payload.deal_ids, context);
    assert(payload.deal_ids.length >= 2 && payload.deal_ids.length <= 4, 'DEAL_COMPARE requires 2-4 deals');
    for (const type of payload.provision_types || []) assertProvisionType(type);
    return;
  }
  if (kind === 'PROVISION_CROSS_CUT') {
    assertDealIds(payload.deal_ids, context);
    assertProvisionType(payload.provision_type);
    for (const field of payload.columns || []) assertField(payload.provision_type, field);
    return;
  }
  if (kind === 'MARKET_RANGE') {
    assertProvisionType(payload.provision_type);
    assertField(payload.provision_type, payload.field_path);
    return;
  }
  if (kind === 'FILTER_THEN_LIST') {
    for (const filter of payload.filters || []) {
      assertProvisionType(filter.provision_type);
      assertField(filter.provision_type, filter.field);
      // r15 show-all mode: op/value are ignored when mode:'all', but the
      // mode value itself is still validated — reject anything but 'all'.
      if (filter.mode !== undefined) assert(filter.mode === 'all', `invalid filter mode: ${filter.mode}`);
    }
    return;
  }
  if (kind === 'DEAL_TO_MARKET') {
    assertDealIds([payload.deal_id], context);
    for (const type of payload.provision_types || []) assertProvisionType(type);
  }
}

function executeQuery(kind, payload, context) {
  if (kind === 'DEAL_COMPARE') return executeDealCompare(payload, context);
  if (kind === 'PROVISION_CROSS_CUT') return executeProvisionCrossCut(payload, context);
  if (kind === 'MARKET_RANGE') return executeMarketRange(payload, context);
  if (kind === 'FILTER_THEN_LIST') return executeFilterThenList(payload, context);
  if (kind === 'DEAL_TO_MARKET') return executeDealToMarket(payload, context);
  throw new Error(`invalid query_kind: ${kind}`);
}

async function runQuery(kind, payload, options = {}) {
  const context = options.context || {};
  validate(kind, payload, context);
  return executeQuery(kind, payload, context);
}

module.exports = { runQuery, validate, executeQuery };
