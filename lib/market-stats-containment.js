const MARKET_STATS_CONTAINED_BODY = Object.freeze({
  error: Object.freeze({
    code: 'MARKET_STATS_DISABLED',
    message: 'Market statistics are temporarily disabled.',
  }),
});

function marketStatsContainedHandler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      error: {
        code: 'METHOD_NOT_ALLOWED',
        message: 'POST only.',
      },
    });
  }
  return res.status(503).json(MARKET_STATS_CONTAINED_BODY);
}

module.exports = {
  MARKET_STATS_CONTAINED_BODY,
  marketStatsContainedHandler,
};
