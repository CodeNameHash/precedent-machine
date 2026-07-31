const { createHash } = require('node:crypto');
const { Pool } = require('pg');

const EXPECTED_PROJECT_REF = 'sjumbznveyyiizhwvixj';
const EXPECTED_POOLER_HOST = 'aws-1-us-west-2.pooler.supabase.com';
const EXPECTED_POOLER_USER = `canonical_v2_preview.${EXPECTED_PROJECT_REF}`;
const MAX_SQL_RESULT_ROWS = 1;
const MAX_REVIEW_RESULT_ROWS = 200;
const MAX_REVIEW_RESULT_BYTES = 2 * 1024 * 1024;
const MAX_EXACT_DETAIL_RESULT_BYTES = 256 * 1024;
const MAX_MARKET_RESULT_BYTES = 256 * 1024;
const MAX_QUERY_RESULT_ROWS = 50;
const MAX_QUERY_RESULT_BYTES = 1024 * 1024;
const QUERY_RPC_SPEC = Object.freeze({
  params: Object.freeze([
    ['p_environment', 'text'],
    ['p_contract_fingerprint', 'text'],
    ['p_query_semantics_digest', 'text'],
    ['p_metric_key', 'text'],
    ['p_metric_version', 'integer'],
    ['p_concept_key', 'text'],
    ['p_party_role', 'text'],
    ['p_party_value', 'text'],
    ['p_party_capacity', 'text'],
    ['p_basis_key', 'text'],
    ['p_sector', 'text'],
    ['p_buyer', 'text'],
    ['p_merger_form', 'text'],
    ['p_adviser_either', 'text'],
    ['p_lawyer_either', 'text'],
    ['p_year_from', 'integer'],
    ['p_year_to', 'integer'],
    ['p_min_value_usd', 'numeric'],
    ['p_max_value_usd', 'numeric'],
    ['p_min_canonical_value', 'numeric'],
    ['p_max_canonical_value', 'numeric'],
    ['p_fee_side', 'text'],
    ['p_payer_capacity', 'text'],
    ['p_payee_capacity', 'text'],
    ['p_trigger_code', 'text'],
    ['p_payment_timing', 'text'],
    ['p_trigger_condition', 'text'],
    ['p_criterion_code', 'text'],
    ['p_contract_scope_code', 'text'],
    ['p_cash_flow_direction_code', 'text'],
    ['p_measurement_period_code', 'text'],
    ['p_comparison_operator', 'text'],
    ['p_page_size', 'integer'],
    ['p_after_governed_deal_key', 'text'],
    ['p_after_row_serving_key', 'text'],
  ]),
  maxPayloadRows: MAX_QUERY_RESULT_ROWS,
  maxPayloadBytes: MAX_QUERY_RESULT_BYTES,
});
const RPC_SPECS = Object.freeze({
  canonical_v2_active_product_query_results: Object.freeze({
    params: Object.freeze([
      ['p_environment', 'text'],
      ['p_serving_namespace_id', 'text'],
      ['p_corpus_release_id', 'text'],
      ['p_product_query_definition_id', 'text'],
      ['p_after_product_query_result_identity', 'text'],
      ['p_page_size', 'integer'],
    ]),
    maxPayloadRows: MAX_QUERY_RESULT_ROWS,
    maxPayloadBytes: MAX_QUERY_RESULT_BYTES,
  }),
  canonical_v2_active_review_context: Object.freeze({
    params: Object.freeze([
      ['p_environment', 'text'],
      ['p_contract_fingerprint', 'text'],
      ['p_request_digest', 'text'],
      ['p_application_deal_id', 'uuid'],
      ['p_page_size', 'integer'],
      ['p_after_row_serving_key', 'text'],
    ]),
    maxPayloadRows: MAX_REVIEW_RESULT_ROWS,
    maxPayloadBytes: MAX_REVIEW_RESULT_BYTES,
  }),
  canonical_v2_exact_detail: Object.freeze({
    params: Object.freeze([
      ['p_environment', 'text'],
      ['p_serving_namespace_id', 'text'],
      ['p_corpus_release_id', 'text'],
      ['p_contract_fingerprint', 'text'],
      ['p_application_deal_id', 'uuid'],
      ['p_row_serving_key', 'text'],
      ['p_source_detail_reference_id', 'text'],
    ]),
    maxPayloadRows: null,
    maxPayloadBytes: MAX_EXACT_DETAIL_RESULT_BYTES,
  }),
  canonical_v2_market_cohort: Object.freeze({
    params: Object.freeze([
      ['p_environment', 'text'],
      ['p_serving_namespace_id', 'text'],
      ['p_corpus_release_id', 'text'],
      ['p_contract_fingerprint', 'text'],
      ['p_cohort_digest', 'text'],
      ['p_metric_key', 'text'],
      ['p_metric_version', 'integer'],
      ['p_concept_key', 'text'],
      ['p_party_role', 'text'],
      ['p_party_value', 'text'],
      ['p_party_capacity', 'text'],
      ['p_basis_key', 'text'],
      ['p_subject_deal_key', 'text'],
      ['p_sector', 'text'],
      ['p_buyer', 'text'],
      ['p_merger_form', 'text'],
      ['p_adviser_either', 'text'],
      ['p_lawyer_either', 'text'],
      ['p_year_from', 'integer'],
      ['p_year_to', 'integer'],
      ['p_min_value_usd', 'numeric'],
      ['p_max_value_usd', 'numeric'],
    ]),
    maxPayloadRows: null,
    maxPayloadBytes: MAX_MARKET_RESULT_BYTES,
  }),
  canonical_v2_active_query_page: QUERY_RPC_SPEC,
  canonical_v2_active_query_page_v2: QUERY_RPC_SPEC,
});

let servingClient = null;
let servingClientIdentity = null;

function connectionIdentity(connectionString) {
  return createHash('sha256').update(connectionString).digest('hex');
}

function safeDatabaseDiagnostic(error) {
  const message = typeof error?.message === 'string' ? error.message : '';
  return /^permission denied for (function|schema|table|relation|sequence) [a-z0-9_.(), ]+$/i.test(message)
    ? message
    : null;
}

function validateConnectionString(connectionString) {
  let parsed;
  try {
    parsed = new URL(connectionString);
  } catch {
    throw new TypeError('Canonical staging database URL is invalid.');
  }
  const username = decodeURIComponent(parsed.username);
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)
    || parsed.hostname !== EXPECTED_POOLER_HOST
    || parsed.port !== '6543'
    || parsed.pathname !== '/postgres'
    || username !== EXPECTED_POOLER_USER
    || !parsed.password
    || parsed.searchParams.get('sslmode') !== 'require'
    || parsed.searchParams.get('uselibpqcompat') !== 'true') {
    throw new TypeError('Canonical serving connection is outside the isolated staging role.');
  }
  return connectionString;
}

function exactParamKeys(params, spec) {
  if (!params || typeof params !== 'object' || Array.isArray(params)) return false;
  const actual = Object.keys(params).sort().join(',');
  const expected = spec.params.map(([key]) => key).sort().join(',');
  return actual === expected;
}

function boundedRpcData(result, spec) {
  if (!result || !Number.isInteger(result.rowCount) || result.rowCount < 1) {
    return { data: null, error: { message: 'Canonical serving response is empty.' } };
  }
  if (result.rowCount > MAX_SQL_RESULT_ROWS
    || !Array.isArray(result.rows)
    || result.rows.length !== result.rowCount) {
    return { data: null, error: { message: 'Canonical serving response exceeded its bounds.' } };
  }
  const data = result.rows[0]?.data;
  if (data == null) {
    return { data: null, error: { message: 'Canonical serving response is empty.' } };
  }
  if (spec.maxPayloadRows !== null
    && (!Array.isArray(data.rows) || data.rows.length > spec.maxPayloadRows)) {
    return { data: null, error: { message: 'Canonical serving response exceeded its bounds.' } };
  }
  let encodedBytes;
  try {
    const encoded = JSON.stringify(data);
    if (encoded === undefined) throw new TypeError('response is not JSON encodable');
    encodedBytes = Buffer.byteLength(encoded, 'utf8');
  } catch {
    return { data: null, error: { message: 'Canonical serving response exceeded its bounds.' } };
  }
  if (encodedBytes > spec.maxPayloadBytes) {
    return { data: null, error: { message: 'Canonical serving response exceeded its bounds.' } };
  }
  return { data, error: null };
}

function createPostgresServingClient({ connectionString, PoolClass = Pool, onError = null } = {}) {
  validateConnectionString(connectionString);
  const pool = new PoolClass({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 1000,
    idleTimeoutMillis: 5000,
    query_timeout: 3000,
    statement_timeout: 2500,
    allowExitOnIdle: true,
    application_name: 'canonical-v2-preview-serving',
    ssl: { rejectUnauthorized: false },
  });
  return Object.freeze({
    async rpc(name, params) {
      const spec = RPC_SPECS[name];
      if (!spec || !exactParamKeys(params, spec)) {
        return { data: null, error: { message: 'Unsupported canonical serving request.' } };
      }
      const values = spec.params.map(([key]) => params[key]);
      const argumentsSql = spec.params.map(([, type], index) => `$${index + 1}::${type}`).join(', ');
      try {
        const result = await pool.query({
          text: `SELECT public.${name}(${argumentsSql}) AS data`,
          values,
        });
        return boundedRpcData(result, spec);
      } catch (error) {
        if (typeof onError === 'function') {
          onError({
            rpc: name,
            code: typeof error?.code === 'string' ? error.code : null,
            severity: typeof error?.severity === 'string' ? error.severity : null,
            routine: typeof error?.routine === 'string' ? error.routine : null,
            constraint: typeof error?.constraint === 'string' ? error.constraint : null,
            diagnostic: safeDatabaseDiagnostic(error),
          });
        }
        if (error?.code === '55P03') {
          return {
            data: null,
            error: {
              code: 'AT_CAPACITY',
              message: 'Canonical serving is at capacity.',
            },
          };
        }
        return { data: null, error: { message: 'Canonical serving query failed.' } };
      }
    },
  });
}

function getCanonicalV2ServingClient(env = process.env) {
  if (env.CANONICAL_V2_ENVIRONMENT !== 'staging') return null;
  const connectionString = env.CANONICAL_V2_STAGING_DATABASE_URL;
  if (!connectionString) return null;
  const identity = connectionIdentity(connectionString);
  if (!servingClient || servingClientIdentity !== identity) {
    servingClient = createPostgresServingClient({
      connectionString,
      onError(details) {
        console.error('Canonical serving RPC failed.', details);
      },
    });
    servingClientIdentity = identity;
  }
  return servingClient;
}

module.exports = {
  EXPECTED_POOLER_HOST,
  EXPECTED_POOLER_USER,
  MAX_EXACT_DETAIL_RESULT_BYTES,
  MAX_MARKET_RESULT_BYTES,
  MAX_QUERY_RESULT_BYTES,
  MAX_QUERY_RESULT_ROWS,
  MAX_REVIEW_RESULT_BYTES,
  MAX_REVIEW_RESULT_ROWS,
  MAX_SQL_RESULT_ROWS,
  RPC_SPECS,
  boundedRpcData,
  createPostgresServingClient,
  getCanonicalV2ServingClient,
  validateConnectionString,
};
