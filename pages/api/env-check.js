// TEMPORARY diagnostic (preview-env debugging, 2026-07-16): reports which
// Supabase env vars exist in this deployment — booleans and key-format
// prefixes only, never values. Remove after the Preview environment is
// confirmed working.
export default function handler(req, res) {
  const keyShape = (v) => {
    if (!v) return null;
    if (v.startsWith('sb_secret_')) return 'sb_secret';
    if (v.startsWith('sb_publishable_')) return 'sb_publishable';
    if (v.startsWith('eyJ')) return 'jwt';
    return 'other';
  };
  // Names only (no values): every env var whose name looks Supabase-ish,
  // to catch spelling variants that the exact-name lookups below miss.
  const supabaseishNames = Object.keys(process.env)
    .filter((k) => /SU[PB]A?B?A?SE|SERVICE_ROLE/i.test(k))
    .sort();
  res.json({
    vercelEnv: process.env.VERCEL_ENV || null,
    supabaseishNames,
    has_NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    has_SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
    has_NEXT_PUBLIC_SUPABASE_ANON_KEY: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    anonKeyShape: keyShape(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    has_SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    serviceKeyShape: keyShape(process.env.SUPABASE_SERVICE_ROLE_KEY),
  });
}
