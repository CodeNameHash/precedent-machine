import { getProductSupabase } from '../../../../lib/supabase';

const { createComparisonRunsHandler } = require('../../../../lib/product/comparison-handlers');

export default createComparisonRunsHandler({ getClient: getProductSupabase });

export const config = { maxDuration: 60 };
