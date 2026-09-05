import { getServiceSupabase } from '../../../lib/supabase';

const { createProductIntakeHandler } = require('../../../lib/product/intake-handler');
const { ProductPhase3Store } = require('../../../lib/product/phase-3-store');
const { getProductActor, requireSameOriginMutation } = require('../../../lib/product/request-auth');

export default createProductIntakeHandler({
  getClient: getServiceSupabase,
  storeFactory: (client) => new ProductPhase3Store({ client }),
  actorResolver: getProductActor,
  requireMutation: requireSameOriginMutation,
});
