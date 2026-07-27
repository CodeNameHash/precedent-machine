const { isCanonicalV2QueryEnabled } = require('../../../lib/canonical-v2/feature-flags');
const { createCanonicalQueryHandler } = require('../../../lib/canonical-v2/query-api-handler');
const { getCanonicalV2ServingClient } = require('../../../lib/canonical-v2/serving-client');

export const config = {
  api: { bodyParser: { sizeLimit: '32kb' } },
  maxDuration: 10,
};

export default createCanonicalQueryHandler({
  enabled: isCanonicalV2QueryEnabled,
  getClient: getCanonicalV2ServingClient,
  maxConcurrent: 2,
});
