'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { activeSubmissionVersion, legalSchemaForVersion, DEFAULT_VERSION } = require('../lib/product/legal-schema-selection');

test('a run keeps its own schema version; unknown versions fail loudly', () => {
  assert.equal(legalSchemaForVersion('LEGAL_SCHEMA/V1').schema_version, 'LEGAL_SCHEMA/V1');
  assert.equal(legalSchemaForVersion('LEGAL_SCHEMA/V2').schema_version, 'LEGAL_SCHEMA/V2');
  assert.equal(legalSchemaForVersion(undefined).schema_version, DEFAULT_VERSION);
  assert.throws(() => legalSchemaForVersion('LEGAL_SCHEMA/V9'), /PRODUCT_LEGAL_SCHEMA_UNKNOWN/);
});

test('new submissions default to V1 and switch to V2 with its prompt bundle only when configured', () => {
  assert.deepEqual(activeSubmissionVersion({}), { schemaVersion: 'LEGAL_SCHEMA/V1', promptBundleVersion: 'PRODUCT_ROUTING_CITATION_REPAIR/V6' });
  assert.deepEqual(activeSubmissionVersion({ NEXT_PUBLIC_PRODUCT_LEGAL_SCHEMA_VERSION: 'LEGAL_SCHEMA/V2' }), { schemaVersion: 'LEGAL_SCHEMA/V2', promptBundleVersion: 'PRODUCT_LAYERED_COMPONENTS/V7' });
  assert.throws(() => activeSubmissionVersion({ PRODUCT_LEGAL_SCHEMA_VERSION: 'nope' }), /PRODUCT_LEGAL_SCHEMA_UNKNOWN/);
});
