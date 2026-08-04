'use strict';

const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  DurableArtifactRootError,
  resolveDurableArtifactRoot,
} = require('../lib/canonical-v2/durable-artifact-root');

test('standard evidence checks may omit an external artefact root', () => {
  assert.equal(resolveDurableArtifactRoot({ environment: {} }), null);
});

test('certification fails closed when no durable artefact root is configured', () => {
  assert.throws(
    () => resolveDurableArtifactRoot({ environment: {}, certificationMode: true }),
    (error) => error instanceof DurableArtifactRootError && error.code === 'DURABLE_ARTIFACT_ROOT_REQUIRED',
  );
});

test('durable artefact roots must be absolute and outside every temporary root', () => {
  for (const temporaryRoot of ['/tmp/m3-evidence', '/private/tmp/m3-evidence', '/var/tmp/m3-evidence', path.join(os.tmpdir(), 'm3-evidence')]) {
    assert.throws(
      () => resolveDurableArtifactRoot({ root: temporaryRoot }),
      (error) => error instanceof DurableArtifactRootError && error.code === 'DURABLE_ARTIFACT_ROOT_TEMPORARY',
    );
  }
  assert.throws(
    () => resolveDurableArtifactRoot({ root: 'relative/evidence' }),
    (error) => error instanceof DurableArtifactRootError && error.code === 'DURABLE_ARTIFACT_ROOT_NOT_ABSOLUTE',
  );
});

test('a durable absolute root is accepted without creating it', () => {
  assert.equal(
    resolveDurableArtifactRoot({ root: '/Users/example/canonical-v2-evidence' }),
    '/Users/example/canonical-v2-evidence',
  );
});
