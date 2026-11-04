import { getProductSupabase } from '../../../lib/supabase';

const { createProductFeedbackHandler } = require('../../../lib/product/feedback-handler');

export default createProductFeedbackHandler({ getClient: getProductSupabase });

export const config = { maxDuration: 30 };
