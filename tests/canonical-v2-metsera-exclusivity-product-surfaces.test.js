const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  AUTHORITY_LIMITS,
  METSERA_PRODUCT_SURFACES_SCHEMA,
  SURFACES,
  compileMetseraExclusivityProductSurfaces,
} = require(
  '../lib/canonical-v2/metsera-exclusivity-product-surfaces',
);

test('fails closed without the exact Product chain', () => {
  assert.throws(
    () => compileMetseraExclusivityProductSurfaces({}, {}, {}, {}),
    /Metsera|invalid|changed|fields|authority context and input are required/i,
  );
  assert.equal(
    METSERA_PRODUCT_SURFACES_SCHEMA,
    'METSERA_EXCLUSIVITY_PRODUCT_SURFACES/V1',
  );
});

test('requires one pure executed cohort result and content-addressed receipt', () => {
  const surfaceSource = fs.readFileSync(
    require.resolve(
      '../lib/canonical-v2/metsera-exclusivity-product-surfaces',
    ),
    'utf8',
  );
  const executorSource = fs.readFileSync(
    require.resolve(
      '../lib/canonical-v2/metsera-exclusivity-cohort-executor',
    ),
    'utf8',
  );
  const runnerSource = fs.readFileSync(
    path.join(
      __dirname,
      '../scripts/canonical-v2-staging-metsera-exclusivity-p8.mjs',
    ),
    'utf8',
  );
  assert.match(surfaceSource, /validateMetseraExclusivityProductPresentation/);
  assert.match(surfaceSource, /SUBJECT_INCLUDED_NO_INDEPENDENT_PEERS/);
  assert.match(
    surfaceSource,
    /validateMetseraExclusivityCohortExecutionEvidence/,
  );
  assert.doesNotMatch(
    surfaceSource,
    /function buildMetsera|function compileMetseraExclusivityCohortExecution/,
  );
  assert.match(executorSource, /EXECUTED_BOUNDED_PURE_COMPILER/);
  assert.match(executorSource, /SUBJECT_COHORT_MEMBERSHIP_RECEIPT\/V1/);
  assert.match(executorSource, /selected_filter_digest/);
  assert.match(executorSource, /selected_candidate_digest/);
  assert.match(executorSource, /counts_digest/);
  assert.match(executorSource, /independent_peer_count/);
  assert.match(
    runnerSource,
    /compileMetseraExclusivityCohortExecution/,
  );
  assert.match(runnerSource, /--cohort-request/);
  assert.match(runnerSource, /--cohort-execution-input/);
  assert.doesNotMatch(
    runnerSource,
    /buildMetseraExclusivityExecutedCohortEvidence|METSERA_P8_BOUNDED_COHORT_EXECUTION/,
  );
  assert.match(surfaceSource, /validateMetseraExclusivityProductRow\([\s\S]*authorityContext[\s\S]*authorityInput/);
  assert.doesNotMatch(
    `${surfaceSource}\n${executorSource}`,
    /service[_-]?role|supabase|canonical-writer|production.*write/i,
  );
  assert.deepEqual(SURFACES, [
    'COMPARE',
    'CORPUS_CONTEXT',
    'QUERY',
    'REVIEW',
  ]);
  assert.deepEqual(new Set(Object.values(AUTHORITY_LIMITS)), new Set(['NONE']));
});

test('uses the exact five-file phase boundary', () => {
  const allowlist = JSON.parse(fs.readFileSync(
    path.join(
      __dirname,
      '../.github/phase-allowlists/wp-metsera-exclusivity-product-surfaces-v1.json',
    ),
    'utf8',
  ));
  assert.deepEqual(allowlist.allowed, [
    '.github/phase-allowlists/wp-metsera-exclusivity-product-surfaces-v1.json',
    'lib/canonical-v2/metsera-exclusivity-cohort-executor.js',
    'lib/canonical-v2/metsera-exclusivity-product-surfaces.js',
    'scripts/canonical-v2-staging-metsera-exclusivity-p8.mjs',
    'tests/canonical-v2-metsera-exclusivity-product-surfaces.test.js',
  ]);
});
