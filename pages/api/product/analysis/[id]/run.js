import { getServiceSupabase } from '../../../../../lib/supabase';

const { createProductRunHandler } = require('../../../../../lib/product/run-handler');

export const config = { maxDuration: 300 };
export default createProductRunHandler({ getClient: getServiceSupabase });
