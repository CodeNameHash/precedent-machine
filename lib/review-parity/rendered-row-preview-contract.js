'use strict';

const PREVIEW_SCHEMA = 'CANONICAL_V2_RENDERED_ROW_PREVIEW/V1';
const SECTION_PREVIEW_SCHEMA = 'CANONICAL_V2_RENDERED_SECTION_PREVIEW/V1';

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
  MATERIAL_CONTRACTS: Object.freeze({
    configId: 'material-contracts',
    projectionModule: 'lib/canonical-v2/material-contracts-product-projection.js',
    projectionExport: 'projectMaterialContractsProductSurfaces',
  }),
  ANTITRUST_REGULATORY: Object.freeze({
    configId: 'antitrust-regulatory',
    projectionModule: 'lib/canonical-v2/antitrust-product-projection.js',
    projectionExport: 'projectAntitrustProductSurfaces',
  }),
  PROXY_MEETING: Object.freeze({
    configId: 'votes-approvals-meeting',
    projectionModule: 'lib/canonical-v2/proxy-meeting-product-projection.js',
    projectionExport: 'projectProxyMeetingProductSurfaces',
  }),
  GENERAL_COVENANTS: Object.freeze({
    configId: 'general-covenants',
    projectionModule: 'lib/canonical-v2/general-covenants-product-projection.js',
    projectionExport: 'projectGeneralCovenantsProductSurfaces',
  }),
  EMPLOYEE_MATTERS: Object.freeze({
    configId: 'employee-benefits',
    projectionModule: 'lib/canonical-v2/employee-dno-product-projection.js',
    projectionExport: 'projectEmployeeDnoProductSurfaces',
  }),
  SPECIFIC_PERFORMANCE_REMEDIES: Object.freeze({
    configId: 'misc-boilerplate',
    projectionModule: 'lib/canonical-v2/remedies-misc-product-projection.js',
    projectionExport: 'projectRemediesMiscProductSurfaces',
  }),
  TERMINATION_FEE: Object.freeze({
    configId: 'termination-fees',
    projectionModule: 'lib/canonical-v2/termination-product-projection.js',
    projectionExport: 'projectTerminationFeeProductSurfaces',
  }),
  // NOT ROUTED, measured 2026-08-10, in three distinct states — the distinction
  // matters because only the third needs new architecture:
  //
  // (a) CONFIG LINK UNKNOWN. A cards-shaped projection exists but the review
  //     config it feeds was not identified: DNO_INDEMNIFICATION (31 claims) and
  //     MISC_BOILERPLATE (114) via `projectEmployeeDnoProductSurfaces` /
  //     `projectRemediesMiscProductSurfaces`, and CONSIDERATION (7). Routing
  //     them with a guessed configId produced CLAIM_RENDERED_NO_ROW, so the
  //     guesses are removed rather than shipped. Finding the right config is
  //     cheap; guessing it is how a wrong mapping becomes a fixture.
  //
  // (b) NO CANONICAL-V2 PROJECTION MODULE AT ALL: NO_SHOP (365 resolved claims,
  //     the largest family in the corpus), MERGER_STRUCTURE_CLOSING (103),
  //     KEY_DEFINED_TERMS (76). The review page does show no-shop content, so
  //     it is served from somewhere other than a V2 claim projection — which
  //     means a V2 resolved claim cannot today be traced to the row a lawyer
  //     reads. That is a lineage gap, not necessarily a blank page.
  //
  // (c) PROJECTION RETURNS NO CARDS — needs an adapter, see below.
  //
  // INTERIM_OPERATING and MAE_DEFINITION are deliberately ABSENT, and their
  // absence is a finding rather than an omission. Measured 2026-08-10 over the
  // latest run per (deal, family): neither
  // `projectIocWaveAClaims` nor `projectKeyTermsMaeClaims` returns a `cards`
  // array. They emit projection records of a different shape entirely — IOC has
  // no cards key, MAE has `mae_review_cards` for the disproportionality rollup
  // only. So 221 resolved claims across the two largest remaining families have
  // NO claim-to-review-card path in the projection layer. Adding a route here
  // would not fix that; building the adapter would. Recorded in
  // `docs/core/ROUTE-TO-GOOD-EXTRACTION.md`.
});

module.exports = { FAMILY_ROUTES, PREVIEW_SCHEMA, SECTION_PREVIEW_SCHEMA };
