import { getProductSupabase } from '../../../../../lib/supabase';

const { createProductSourceHandler } = require('../../../../../lib/product/source-handler');

export default createProductSourceHandler({ getClient: getProductSupabase });
