import { getServiceSupabase } from '../../../../lib/supabase';

const { createProductReviewHandler } = require('../../../../lib/product/review-handler');

export default createProductReviewHandler({ getClient: getServiceSupabase });
