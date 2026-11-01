import { getProductSupabase } from '../../../../lib/supabase';

const { createComparisonMarketHandler } = require('../../../../lib/product/comparison-handlers');

export default createComparisonMarketHandler({ getClient: getProductSupabase });

export const config = { maxDuration: 60 };
