import { getProductSupabase } from '../../../lib/supabase';

const { createPublishedFactsHandler } = require('../../../lib/product/published-facts-handler');

export default createPublishedFactsHandler({ getClient: getProductSupabase });

export const config = { maxDuration: 60 };
