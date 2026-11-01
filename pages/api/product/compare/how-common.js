import { getProductSupabase } from '../../../../lib/supabase';

const { createComparisonHowCommonHandler } = require('../../../../lib/product/comparison-handlers');

export default createComparisonHowCommonHandler({ getClient: getProductSupabase });

export const config = { maxDuration: 60 };
