import { getServiceSupabase } from '../../lib/supabase';
import {
  validateMarketMetricResult,
  validateMarketMetricSpec,
} from '../../lib/market-metrics/index.js';

const { createMarketStatsHandler } = require('../../lib/row-market-stats/handler');

export const config = { maxDuration: 60 };

export default createMarketStatsHandler({
  getSupabase: getServiceSupabase,
  validateMetricSpec: validateMarketMetricSpec,
  validateMetricResult: validateMarketMetricResult,
});
