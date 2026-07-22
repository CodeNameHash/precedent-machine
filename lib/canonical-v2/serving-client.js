const { createClient } = require('@supabase/supabase-js');

let servingClient = null;
let servingClientIdentity = null;

function getCanonicalV2ServingClient(env = process.env) {
  if (env.CANONICAL_V2_ENVIRONMENT !== 'staging') return null;
  const url = env.CANONICAL_V2_STAGING_SUPABASE_URL;
  const key = env.CANONICAL_V2_STAGING_SERVING_KEY;
  if (!url || !key) return null;
  const identity = `${url.length}:${key.length}`;
  if (!servingClient || servingClientIdentity !== identity) {
    servingClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    servingClientIdentity = identity;
  }
  return servingClient;
}

module.exports = { getCanonicalV2ServingClient };
