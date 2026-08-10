'use strict';

const PREVIEW_SCHEMA = 'CANONICAL_V2_RENDERED_ROW_PREVIEW/V1';

const FAMILY_ROUTES = Object.freeze({
  CLOSING_CONDITIONS: Object.freeze({
    configId: 'conditions',
    projectionModule: 'lib/canonical-v2/closing-conditions-product-projection.js',
    projectionExport: 'projectClosingConditionProductSurfaces',
  }),
  TERMINATION: Object.freeze({
    configId: 'termination-rights',
    projectionModule: 'lib/canonical-v2/termination-product-projection.js',
    projectionExport: 'projectTerminationRightsProductSurfaces',
  }),
});

module.exports = { FAMILY_ROUTES, PREVIEW_SCHEMA };
