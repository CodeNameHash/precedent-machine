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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  let supabaseRef = null;
  try {
    const host = new URL(url).hostname;
    const match = /^([a-z0-9]+)\.supabase\.co$/.exec(host);
    supabaseRef = match ? match[1] : null;
  } catch { supabaseRef = null; }
  res.setHeader('Cache-Control', 'private, no-store');
  return res.status(200).json({
    ok: Boolean(supabaseRef),
    commit: process.env.VERCEL_GIT_COMMIT_SHA || null,
    ref: process.env.VERCEL_GIT_COMMIT_REF || null,
    deployment: process.env.VERCEL_URL || null,
    supabase_ref: supabaseRef,
    schema: process.env.NEXT_PUBLIC_PRODUCT_LEGAL_SCHEMA_VERSION || process.env.PRODUCT_LEGAL_SCHEMA_VERSION || null,
    key_kind: (process.env.SUPABASE_SERVICE_ROLE_KEY || '').startsWith('sb_secret_') ? 'secret'
      : (process.env.SUPABASE_SERVICE_ROLE_KEY || '').startsWith('eyJ') ? 'legacy-jwt' : 'missing',
  });
}
