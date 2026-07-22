const { createHash } = require('node:crypto');
const { Pool } = require('pg');

const EXPECTED_PROJECT_REF = 'sjumbznveyyiizhwvixj';
const EXPECTED_POOLER_HOST = 'aws-1-us-west-2.pooler.supabase.com';
const EXPECTED_POOLER_USER = `canonical_v2_preview.${EXPECTED_PROJECT_REF}`;
const RPC_SPECS = Object.freeze({
  canonical_v2_active_review_context: Object.freeze({
    params: Object.freeze([
      ['p_environment', 'text'],
      ['p_contract_fingerprint', 'text'],
      ['p_request_digest', 'text'],
      ['p_application_deal_id', 'uuid'],
      ['p_page_size', 'integer'],
      ['p_after_row_serving_key', 'text'],
    ]),
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
  }),
});

let servingClient = null;
let servingClientIdentity = null;

function connectionIdentity(connectionString) {
  return createHash('sha256').update(connectionString).digest('hex');
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

function createPostgresServingClient({ connectionString, PoolClass = Pool } = {}) {
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
        if (result.rowCount !== 1 || !result.rows[0]?.data) {
          return { data: null, error: { message: 'Canonical serving response is empty.' } };
        }
        return { data: result.rows[0].data, error: null };
      } catch {
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
    servingClient = createPostgresServingClient({ connectionString });
    servingClientIdentity = identity;
  }
  return servingClient;
}

module.exports = {
  EXPECTED_POOLER_HOST,
  EXPECTED_POOLER_USER,
  RPC_SPECS,
  createPostgresServingClient,
  getCanonicalV2ServingClient,
  validateConnectionString,
};
