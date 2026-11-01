import { getProductSupabase } from '../../../../lib/supabase';

const { createComparisonTablesHandler } = require('../../../../lib/product/comparison-handlers');

export default createComparisonTablesHandler({ getClient: getProductSupabase });

export const config = { maxDuration: 60 };
