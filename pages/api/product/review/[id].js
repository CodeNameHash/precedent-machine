import { getServiceSupabase } from '../../../../lib/supabase';

const { createProductReviewHandler } = require('../../../../lib/product/review-handler');

export default createProductReviewHandler({ getClient: getServiceSupabase });

// Saving a review validates the whole 1,600-item state in the database; allow
// more than the default function duration so a slow validation is not cut off.
export const config = { maxDuration: 60 };
