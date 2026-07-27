import { getServiceSupabase } from '../../../lib/supabase';
const demoSet = require('../../../lib/query/fixtures/demo-set.json');
const { resolveDemoPayload } = require('../../../lib/query/fixtures/resolve-demo-payload');
const { encodePayload } = require('../../../lib/query/fixtures');
const { kindToSlug } = require('../../../lib/query/types');

const DEAL_SELECT = 'id, acquirer, target, value_usd, announce_date, sector, metadata';

// WP-7 (M5-06) demo-dryrun: staging deals must never resolve into a demo
// tile's payload (e.g. an @all_deals reference picking up DRYRUN-<ts>).
// Mirrors pages/api/query/run.js's isStagingDeal.
function isStagingDeal(deal) {
  const meta = deal && deal.metadata && typeof deal.metadata === 'object' ? deal.metadata : {};
  return meta.ingest_status === 'staging';
}

// Server-side resolution of the WP-1 demo-set fixture: each entry's payload
// references deals by name substring ("@deal:Redfin" / "@all_deals" — see
// lib/query/fixtures/resolve-demo-payload.js) rather than by environment id,
// so the client can't turn a demo entry into a runnable /query/<slug>/adhoc
// link on its own. This endpoint resolves against the live corpus once and
// hands back ready-to-use hrefs, one per WP-1 query, for pages/query/index.js
// to render as one-click tiles.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  const sb = getServiceSupabase();
  if (!sb) return res.status(500).json({ error: 'Supabase not configured' });

  try {
    const { data: dealRows, error } = await sb.from('deals').select(DEAL_SELECT).order('announce_date', { ascending: false });
    if (error) throw new Error(error.message);
    const deals = (dealRows || []).filter((deal) => !isStagingDeal(deal));

    const queries = demoSet.map((entry) => {
      try {
        const resolved = resolveDemoPayload(entry.payload, deals || []);
        const slug = kindToSlug(entry.kind);
        return {
          id: entry.id,
          title: entry.title,
          question: entry.question,
          kind: entry.kind,
          slug,
          href: `/query/${slug}/adhoc?payload=${encodePayload(resolved)}`,
          notes: entry.notes || null,
          error: null,
        };
      } catch (err) {
        return {
          id: entry.id,
          title: entry.title,
          question: entry.question,
          kind: entry.kind,
          slug: kindToSlug(entry.kind),
          href: null,
          notes: entry.notes || null,
          error: err.message || 'resolution failed',
        };
      }
    });

    return res.status(200).json({ queries });
  } catch (err) {
    return res.status(400).json({ error: err.message || 'demo-set resolution failed' });
  }
}
