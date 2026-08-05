const { executeProvisionCrossCut } = require('./executors/provision-cross-cut');
const { executeMarketRange } = require('./executors/market-range');
const { executeFilterThenList } = require('./executors/filter-then-list');
const { PROVISION_CARD_TYPES, QUERY_KINDS, fieldDef } = require('./types');
const { assertNoDarkAuthorityRecords } = require('./dark-authority-fence');

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
  }
}

function executeQuery(kind, payload, context) {
  assertNoDarkAuthorityRecords(
    context?.provisions || [],
    'Query cannot admit a VALIDATED_NOT_SERVED provision.',
  );
  if (kind === 'PROVISION_CROSS_CUT') return executeProvisionCrossCut(payload, context);
  if (kind === 'MARKET_RANGE') return executeMarketRange(payload, context);
  if (kind === 'FILTER_THEN_LIST') return executeFilterThenList(payload, context);
  throw new Error(`invalid query_kind: ${kind}`);
}

async function runQuery(kind, payload, options = {}) {
  const context = options.context || {};
  assertNoDarkAuthorityRecords(
    context.provisions || [],
    'Query cannot admit a VALIDATED_NOT_SERVED provision.',
  );
  validate(kind, payload, context);
  return executeQuery(kind, payload, context);
}

module.exports = { runQuery, validate, executeQuery };
