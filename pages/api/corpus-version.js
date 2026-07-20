// GET /api/corpus-version — a cheap, cacheable fingerprint of corpus
// content, so expensive corpus-wide answers (corpus-stats, query runs,
// deal-to-market snapshots) can be cached INDEFINITELY and invalidated by
// CONTENT CHANGE rather than by clock (Ben, r13: "cache per week and just
// test if there has been an update to the corpus since").
//
// How it composes: clients fetch this version (itself edge-cached 60s, so
// the probe costs the DB at most one round of aggregates per minute) and
// append it as `&v=<version>` to corpus-stats/query URLs. The version is
// part of the edge-cache key, so a version bump is an automatic cache miss
// for every dependent URL — no purging, no TTL guessing. Staleness upper
// bound = this endpoint's own 60s cache.
//
// What bumps the version, with today's schema (created_at only):
//   - new deals / provisions / claims (ingest) — max(created_at) moves;
//   - reprocess flows that delete + reinsert cards/claims — same;
//   - deletions — row counts move.
// What does NOT bump it yet: in-place UPDATEs (corrections editing an
// existing row). That needs an `updated_at` column + trigger; this handler
// probes for it and folds it in automatically once it exists. Ben-side SQL
// (Supabase dashboard, one-time):
//   alter table provisions add column if not exists updated_at timestamptz;
//   alter table claims     add column if not exists updated_at timestamptz;
//   alter table deals      add column if not exists updated_at timestamptz;
//   create or replace function touch_updated_at() returns trigger as
//     $$ begin new.updated_at = now(); return new; end $$ language plpgsql;
//   -- one BEFORE UPDATE trigger per table, plus:
//   create index if not exists provisions_created_at_idx on provisions (created_at desc);
//   create index if not exists claims_created_at_idx on claims (created_at desc);
import crypto from 'crypto';
import { getServiceSupabase } from '../../lib/supabase';

export const config = { maxDuration: 30 };

const TABLES = ['deals', 'provisions', 'claims'];

async function tableFingerprint(sb, table) {
  const [{ count }, latestCreated] = await Promise.all([
    sb.from(table).select('id', { count: 'exact', head: true }),
    sb.from(table).select('created_at').order('created_at', { ascending: false }).limit(1),
  ]);
  const parts = {
    count: count ?? null,
    maxCreatedAt: latestCreated.data?.[0]?.created_at ?? null,
    maxUpdatedAt: null,
  };
  // updated_at may not exist yet (see header comment) — probe and fold it
  // in when it does; a 42703 undefined-column error just means "not yet".
  const updated = await sb.from(table).select('updated_at').order('updated_at', { ascending: false, nullsFirst: false }).limit(1);
  if (!updated.error) parts.maxUpdatedAt = updated.data?.[0]?.updated_at ?? null;
  return parts;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'GET only' });
  }
  const sb = getServiceSupabase();
  if (!sb) return res.status(500).json({ error: 'Supabase not configured' });
  try {
    const components = {};
    await Promise.all(TABLES.map(async (table) => {
      components[table] = await tableFingerprint(sb, table);
    }));
    const version = crypto.createHash('sha1').update(JSON.stringify(components)).digest('hex').slice(0, 12);
    // 60s edge cache = the probe's own cost ceiling AND the staleness upper
    // bound for every version-keyed dependent cache.
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).json({ version, components });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'corpus-version failed' });
  }
}
