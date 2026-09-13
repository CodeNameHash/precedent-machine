import { getServiceSupabase } from '../../../../../lib/supabase';

const { createProductPreviewHandler } = require('../../../../../lib/product/preview-handler');

export default createProductPreviewHandler({ getClient: getServiceSupabase });

// Reads every completed section of a run; allow the same duration as the
// review read so a large agreement is not cut off.
export const config = { maxDuration: 60 };
