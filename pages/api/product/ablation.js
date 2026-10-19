const { createProductAblationHandler } = require('../../../lib/product/ablation-handler');

// Work package E2: the ablation job on the experiments sandbox, through the
// deployment's wake path; PRODUCT_INTERNAL_TOKEN alone opens it.
export const config = { maxDuration: 60 };
export default createProductAblationHandler();
