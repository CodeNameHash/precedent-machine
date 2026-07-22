const { isCanonicalV2ReviewEnabled } = require('../../../lib/canonical-v2/feature-flags');
const { createCanonicalReviewContextHandler } = require('../../../lib/canonical-v2/review-api-handler');
const { getCanonicalV2ServingClient } = require('../../../lib/canonical-v2/serving-client');

export const config = { maxDuration: 10 };

export default createCanonicalReviewContextHandler({
  enabled: isCanonicalV2ReviewEnabled,
  getClient: getCanonicalV2ServingClient,
  maxConcurrent: 2,
});
