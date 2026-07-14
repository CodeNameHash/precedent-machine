// Static placeholder metrics for the /admin/processing-flow stage cards.
//
// STUB — no metrics pipeline has been built (see WP-PROCESSING-FLOW-MAP-01,
// docs/schema-shape/provision-processing-flow.md § 5). These are fixed
// placeholder numbers, not measurements. Do not wire real per-stage
// duration/failure/quarantine tracking through this route without updating
// this comment and the `stub: true` flag below.
const STAGE_METRICS_STUB = {
  1: { medianDurationMs: null, failuresLast24h: null, quarantineCount: null },
  2: { medianDurationMs: null, failuresLast24h: null, quarantineCount: null },
  3: { medianDurationMs: null, failuresLast24h: null, quarantineCount: null },
  4: { medianDurationMs: null, failuresLast24h: null, quarantineCount: null },
  5: { medianDurationMs: null, failuresLast24h: null, quarantineCount: null },
  6: { medianDurationMs: null, failuresLast24h: null, quarantineCount: null },
  7: { medianDurationMs: null, failuresLast24h: null, quarantineCount: null },
  8: { medianDurationMs: null, failuresLast24h: null, quarantineCount: null },
};

function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method not allowed' });
  }
  return res.status(200).json({
    stub: true,
    note: 'Static placeholders. No last-run metrics pipeline is wired up yet — see WP-PROCESSING-FLOW-MAP-01.',
    metrics: STAGE_METRICS_STUB,
  });
}

module.exports = handler;
module.exports.default = handler;
module.exports.STAGE_METRICS_STUB = STAGE_METRICS_STUB;
