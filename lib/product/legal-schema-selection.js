'use strict';

// Selects the legal schema for a run. A run records its schema version when
// it is created and keeps it for life, so V1 runs keep using V1 after V2
// exists (plan Phase 5B). New submissions use the active version, which is
// V1 until the V2 rerun is started deliberately.

const { validateLegalSchema } = require('./legal-schema');

const SCHEMAS = Object.freeze({
  'LEGAL_SCHEMA/V1': require('../../contracts/product/legal-schema.v1.json'),
  'LEGAL_SCHEMA/V2': require('../../contracts/product/legal-schema.v2.json'),
});

const PROMPT_BUNDLES = Object.freeze({
  'LEGAL_SCHEMA/V1': 'PRODUCT_ROUTING_CITATION_REPAIR/V6',
  'LEGAL_SCHEMA/V2': 'PRODUCT_LAYERED_COMPONENTS/V7',
});

const DEFAULT_VERSION = 'LEGAL_SCHEMA/V1';

function legalSchemaForVersion(version) {
  const schema = SCHEMAS[version || DEFAULT_VERSION];
  if (!schema) throw new Error(`PRODUCT_LEGAL_SCHEMA_UNKNOWN: ${version}`);
  return validateLegalSchema(schema);
}

// The version new submissions use. Read from the environment so the V2
// rerun can be switched on for the private preview without a code change.
function activeSubmissionVersion(env = null) {
  // The literal process.env reference is what Next.js inlines for the browser.
  const requested = (env && (env.NEXT_PUBLIC_PRODUCT_LEGAL_SCHEMA_VERSION || env.PRODUCT_LEGAL_SCHEMA_VERSION))
    || process.env.NEXT_PUBLIC_PRODUCT_LEGAL_SCHEMA_VERSION || process.env.PRODUCT_LEGAL_SCHEMA_VERSION || DEFAULT_VERSION;
  if (!SCHEMAS[requested]) throw new Error(`PRODUCT_LEGAL_SCHEMA_UNKNOWN: ${requested}`);
  return { schemaVersion: requested, promptBundleVersion: PROMPT_BUNDLES[requested] };
}

module.exports = { DEFAULT_VERSION, PROMPT_BUNDLES, activeSubmissionVersion, legalSchemaForVersion };
