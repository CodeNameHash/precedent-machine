const { errorBody, MarketStatsError, asMarketStatsError } = require('./errors');
const { parseMarketStatsRequest } = require('./request');
const { calculateMarketStats } = require('./service');
const { loadMarketDataset } = require('./source');

function sendError(res, error) {
  const typed = asMarketStatsError(error);
  return res.status(typed.status).json(errorBody(typed));
}

function createMarketStatsHandler({
  getSupabase,
  validateMetricSpec,
  validateMetricResult,
  loadDataset = loadMarketDataset,
}) {
  return async function marketStatsHandler(req, res) {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return sendError(res, new MarketStatsError('METHOD_NOT_ALLOWED', 'POST only.'));
    }

    try {
      const request = parseMarketStatsRequest(req.body, validateMetricSpec);
      const supabase = typeof getSupabase === 'function' ? getSupabase() : null;
      if (!supabase) {
        throw new MarketStatsError('DATA_SOURCE_NOT_CONFIGURED', 'The market corpus is not configured.');
      }
      const dataset = await loadDataset(supabase, request.specs);
      const response = calculateMarketStats(request, dataset, validateMetricResult);
      res.setHeader('Cache-Control', 'private, no-store');
      return res.status(200).json(response);
    } catch (error) {
      return sendError(res, error);
    }
  };
}

module.exports = {
  createMarketStatsHandler,
  sendError,
};
