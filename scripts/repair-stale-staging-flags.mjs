// One-off corpus repair (2026-07-19, WP-7 live-gate finding): six real
// corpus deals (Summit Materials, Catalent, Endeavor, Frontier/Verizon,
// Noble Africa, Juniper) still carry metadata.ingest_status='staging' from
// their 2026-07-06 ingest — the flow never flipped them on finalize. The
// staging filters (Package A /api/home, WP-7 query exclusion) correctly
// hide staging deals, so these six were invisible on the deals index and
// broke 15/20 demo-set expectations. Flip them to 'clean' (the value their
// corpus siblings carry). Real dry-run artifacts (metadata.dryrun === true
// or DRYRUN-* target names) are never touched.
//
// Usage: node scripts/repair-stale-staging-flags.mjs         (dry-run)
//        node scripts/repair-stale-staging-flags.mjs --apply
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const env = fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const get = (k) => (env.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1];
const sb = createClient(get('NEXT_PUBLIC_SUPABASE_URL') || get('SUPABASE_URL'), get('SUPABASE_SERVICE_ROLE_KEY'));
const APPLY = process.argv.includes('--apply');

const { data, error } = await sb.from('deals').select('id,target,metadata').eq('metadata->>ingest_status', 'staging');
if (error) { console.error('fetch failed:', error.message); process.exit(1); }
console.log(`${APPLY ? 'APPLY' : 'DRY-RUN'}: ${data.length} deals with ingest_status=staging`);
for (const d of data) {
  const meta = d.metadata || {};
  if (meta.dryrun === true || /^DRYRUN-/.test(d.target || '')) {
    console.log('SKIP (dry-run artifact):', d.target);
    continue;
  }
  console.log(`  ${d.target}: staging -> clean`);
  if (APPLY) {
    const { error: upErr } = await sb.from('deals').update({ metadata: { ...meta, ingest_status: 'clean' } }).eq('id', d.id);
    if (upErr) { console.error('  FAILED:', upErr.message); process.exit(1); }
  }
}
if (APPLY) {
  const { count } = await sb.from('deals').select('*', { count: 'exact', head: true }).eq('metadata->>ingest_status', 'staging');
  console.log('remaining staging-tagged:', count);
}
