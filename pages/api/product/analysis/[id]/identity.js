import { getProductSupabase } from '../../../../../lib/supabase';

const { createProductIdentityHandler } = require('../../../../../lib/product/identity-handler');

export default createProductIdentityHandler({ getClient: getProductSupabase });
