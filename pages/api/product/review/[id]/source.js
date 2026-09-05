import { getServiceSupabase } from '../../../../../lib/supabase';

const { createProductSourceHandler } = require('../../../../../lib/product/source-handler');

export default createProductSourceHandler({ getClient: getServiceSupabase });
