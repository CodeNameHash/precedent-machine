import { getServiceSupabase } from '../../../lib/supabase';

const { createPublishedFactsHandler } = require('../../../lib/product/published-facts-handler');

export default createPublishedFactsHandler({ getClient: getServiceSupabase });

export const config = { maxDuration: 60 };
