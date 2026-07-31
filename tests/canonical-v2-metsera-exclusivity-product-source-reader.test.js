const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  AUTHORITY_LIMITS,
  METSERA_PRODUCT_SOURCE_READER_SCHEMA,
  SELECTED_SOURCE_ACTION,
  compileMetseraExclusivityProductSourceReader,
} = require(
  '../lib/canonical-v2/metsera-exclusivity-product-source-reader',
);
const {
  PRODUCT_ACTIVE_RELEASE_RESOLUTION_SCHEMA,
} = require('../lib/canonical-v2/product-rerun-compiler');
const {
  PRODUCT_CANDIDATE_RESULT_WRITE_SET_SCHEMA,
  buildProcessPhrasebookProductChain,
  buildProductCandidateResultWriteEnvelope,
  validateProductCandidateResultWriteSet,
} = require('../lib/canonical-v2/product-candidate-result-write');
const {
  compileMetseraExclusivityProductAdmission,
} = require('../lib/canonical-v2/metsera-exclusivity-product-admission');
const {
  compileMetseraExclusivityProductQuery,
  compileMetseraExclusivityProductRow,
} = require('../lib/canonical-v2/metsera-exclusivity-product-row');
const {
  compileMetseraExclusivityProductResultSet,
} = require('../lib/canonical-v2/metsera-exclusivity-product-result-set');
const {
  compileMetseraExclusivityProductPresentation,
} = require('../lib/canonical-v2/metsera-exclusivity-product-presentation');
const {
  compileMetseraExclusivityProductSurfaces,
} = require('../lib/canonical-v2/metsera-exclusivity-product-surfaces');
const {
  buildMetseraRealProcessAdmission,
} = require('./fixtures/canonical-v2/metsera-real-process-admission');
const {
  executeMetseraTestCohort,
} = require(
  './fixtures/canonical-v2/metsera-external-cohort-execution',
);
const {
  authority,
} = require(
  './fixtures/canonical-v2/agreement-candidate-product-materialisation-inputs',
);
const {
  contentId,
} = require('../lib/canonical-v2/canonical-bytes');

function validCandidate() {
  const {
    input: authorityInput,
    context: authorityContext,
  } = authority();
  const processAdmission = buildMetseraRealProcessAdmission({
    authority_context: authorityContext,
    authority_input: authorityInput,
  });
  const productAdmission = compileMetseraExclusivityProductAdmission({
    process_phrasebook_admission: processAdmission,
  });
  const query = compileMetseraExclusivityProductQuery(
    productAdmission,
    authorityContext,
    authorityInput,
  );
  const row = compileMetseraExclusivityProductRow(
    productAdmission,
    authorityContext,
    authorityInput,
  );
  const resultSet = compileMetseraExclusivityProductResultSet(
    productAdmission,
    row,
    authorityContext,
    authorityInput,
  );
  const presentation =
    compileMetseraExclusivityProductPresentation(row, resultSet);
  const cohortEvidence =
    executeMetseraTestCohort(productAdmission, row);
  const surfaces = compileMetseraExclusivityProductSurfaces(
    productAdmission,
    row,
    resultSet,
    presentation,
    authorityContext,
    authorityInput,
    cohortEvidence,
  );
  const writeSet = {
    schema_version: PRODUCT_CANDIDATE_RESULT_WRITE_SET_SCHEMA,
    candidate_release_binding: {
      candidate_release_manifest_id:
        authorityContext.candidate_release_manifest
          .candidate_release_manifest_id,
      candidate_release_manifest_payload_digest:
        authorityContext.candidate_release_manifest
          .canonical_payload_digest,
      corpus_release_id:
        authorityContext.candidate_release_manifest.corpus_release_id,
      product_query_definition_id: query.query_definition_id,
      release_state: 'CANDIDATE_NOT_ACTIVE',
      authority_state: 'NOT_GRANTED',
    },
    process_pilot_materialisation_receipt:
      processAdmission.materialisation_receipt,
    product_admission: productAdmission,
    product_row: row,
    product_result_set: resultSet,
    product_presentation: presentation,
    product_surfaces: surfaces,
  };
  const validation = validateProductCandidateResultWriteSet(
    buildProductCandidateResultWriteEnvelope({
      adapter_identifier: 'PROCESS_PHRASEBOOK_PRODUCT_CHAIN',
      domain_carrier: buildProcessPhrasebookProductChain(
        writeSet,
        authorityContext,
        authorityInput,
      ),
    }),
  );
  return {
    authorityContext,
    authorityInput,
    candidateRecord: validation.candidateRecord,
  };
}

function inactiveResolution(candidateRecord) {
  const body = {
    schema_version: PRODUCT_ACTIVE_RELEASE_RESOLUTION_SCHEMA,
    active_fence_identity: 'a'.repeat(64),
    candidate_release_manifest_id: 'b'.repeat(64),
    candidate_release_manifest_payload_digest: 'c'.repeat(64),
    resolution_state: 'FRESH_EXTERNAL_RESOLUTION',
    execution_authority_state: 'NOT_GRANTED',
  };
  return {
    schema_version: body.schema_version,
    resolution_id: contentId(
      PRODUCT_ACTIVE_RELEASE_RESOLUTION_SCHEMA,
      body,
    ),
    ...body,
  };
}

test('fails closed without the exact candidate record and active resolution', () => {
  assert.throws(
    () => compileMetseraExclusivityProductSourceReader({}, {}, {}),
    /candidate|write set|source reader|canonical JSON/i,
  );
  assert.equal(
    METSERA_PRODUCT_SOURCE_READER_SCHEMA,
    'METSERA_EXCLUSIVITY_PRODUCT_SOURCE_READER/V1',
  );
});

test('uses the existing source reader and grants no runtime authority', () => {
  const source = fs.readFileSync(
    require.resolve(
      '../lib/canonical-v2/metsera-exclusivity-product-source-reader',
    ),
    'utf8',
  );
  assert.match(source, /compileProductSourceReaderAction/);
  assert.match(source, /validateProductActiveReleaseResolution/);
  assert.match(source, /OPEN_SELECTED_SOURCE/);
  assert.equal(SELECTED_SOURCE_ACTION, 'PROCESS_NARRATION_EVIDENCE');
  assert.deepEqual(
    new Set(Object.values(AUTHORITY_LIMITS)),
    new Set(['NONE']),
  );
  assert.doesNotMatch(
    source,
    /service[_-]?role|supabase|production.*write/i,
  );
});

test('preserves a valid candidate through the inactive-release source-reader path', () => {
  const {
    authorityContext,
    authorityInput,
    candidateRecord,
  } = validCandidate();
  const outcome = compileMetseraExclusivityProductSourceReader(
    candidateRecord,
    inactiveResolution(candidateRecord),
    {
      vertical_slice_execution: 'PASS',
      production_authority: 'NONE',
      m1_acknowledgement_id: 'd'.repeat(64),
    },
    authorityContext,
    authorityInput,
  );
  assert.equal(outcome.source_reader_state, 'TYPED_REFUSAL');
  assert.equal(
    outcome.product_source_reader_outcome.disposition,
    'RELEASE_NOT_ACTIVE',
  );
  assert.equal(
    outcome.product_source_reader_outcome.original_result_preserved,
    true,
  );
  assert.throws(
    () => compileMetseraExclusivityProductSourceReader(
      candidateRecord,
      inactiveResolution(candidateRecord),
      {
        vertical_slice_execution: 'PASS',
        production_authority: 'NONE',
        m1_acknowledgement_id: 'd'.repeat(64),
      },
    ),
    /authority|lineage|canonical JSON/i,
  );
});

test('uses the exact five-file phase boundary', () => {
  const allowlist = JSON.parse(fs.readFileSync(
    path.join(
      __dirname,
      '../.github/phase-allowlists/wp-metsera-exclusivity-product-source-reader-v1.json',
    ),
    'utf8',
  ));
  assert.equal(
    allowlist.phase,
    'WP-METSERA-EXCLUSIVITY-PRODUCT-SOURCE-READER-V1',
  );
  assert.equal(allowlist.allowed.length, 5);
});
