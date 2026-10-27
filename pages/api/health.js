// What this deployment is, without a session (work package 53, plan finding
// (289)): the commit Vercel built, the Supabase project it talks to (the ref
// only, never a key) and the schema version new submissions use. It exists
// because a whole day was lost to a deployment talking to a database nobody
// could identify from outside, and an alias serving a build older than the
// repository. Nothing here is a secret: the ref and the commit are on the
// public invoice already.
export default function handleHealth(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'GET only' });
  }
  const refOf = (url) => {
    try {
      const match = /^([a-z0-9]+)\.supabase\.co$/.exec(new URL(url).hostname);
      return match ? match[1] : null;
    } catch { return null; }
  };
  const kindOf = (key) => (String(key || '').startsWith('sb_secret_') ? 'secret'
    : String(key || '').startsWith('eyJ') ? 'legacy-jwt' : 'missing');
  // Two databases (work package 53, finding (291)): the V1 corpus pages read
  // one project, the product another, so health names both.
  const v1Url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const productUrl = process.env.PRODUCT_SUPABASE_URL || v1Url;
  const supabaseRef = refOf(productUrl);
  res.setHeader('Cache-Control', 'private, no-store');
  return res.status(200).json({
    ok: Boolean(supabaseRef),
    commit: process.env.VERCEL_GIT_COMMIT_SHA || null,
    ref: process.env.VERCEL_GIT_COMMIT_REF || null,
    deployment: process.env.VERCEL_URL || null,
    // The product database first (what /review and /compare read), then the
    // V1 corpus database behind the index and deal pages.
    supabase_ref: supabaseRef,
    key_kind: kindOf(process.env.PRODUCT_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY),
    v1_ref: refOf(v1Url),
    v1_key_kind: kindOf(process.env.SUPABASE_SERVICE_ROLE_KEY),
    // The effective version the routes will use, not merely the env: with the
    // variable unset the selection module falls back to its default.
    schema: process.env.NEXT_PUBLIC_PRODUCT_LEGAL_SCHEMA_VERSION || process.env.PRODUCT_LEGAL_SCHEMA_VERSION
      || require('../../lib/product/legal-schema-selection').DEFAULT_VERSION || null,
  });
}
