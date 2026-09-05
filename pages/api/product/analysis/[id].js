import { getServiceSupabase } from '../../../../lib/supabase';

const { createProductAnalysisHandler } = require('../../../../lib/product/analysis-handler');
const { ProductPhase3Store } = require('../../../../lib/product/phase-3-store');
const { getProductActor } = require('../../../../lib/product/request-auth');

export default createProductAnalysisHandler({
  getClient: getServiceSupabase,
  storeFactory: (client) => new ProductPhase3Store({ client }),
  actorResolver: getProductActor,
});
