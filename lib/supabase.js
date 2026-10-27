import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase env vars missing — running in offline mode');
}

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// The product's own database (work package 53, plan finding (291)): the V2
// tables live in their own Supabase project, while the V1 corpus pages keep
// reading the project they were built against. One deployment, two databases,
// two clients — the product routes call this, every V1 route keeps
// getServiceSupabase below.
export function getProductSupabase(clientFactory = createClient) {
  const url = process.env.PRODUCT_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.PRODUCT_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return clientFactory(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// Server-side client using service role key for API routes
export function getServiceSupabase(clientFactory = createClient) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return clientFactory(url, key);
}
