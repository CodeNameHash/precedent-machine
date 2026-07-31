const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  METSERA_COHORT_EXECUTION_INPUT_SCHEMA,
  METSERA_COHORT_REQUEST_SCHEMA,
  compileMetseraExclusivityCohortExecution,
} = require('../lib/canonical-v2/metsera-exclusivity-cohort-executor');
const {
  compileMetseraExclusivityProcessPhrasebookAdmission,
} = require('../lib/canonical-v2/metsera-exclusivity-process-phrasebook-admission');
const {
  compileMetseraExclusivityProductAdmission,
} = require('../lib/canonical-v2/metsera-exclusivity-product-admission');
const {
  compileMetseraExclusivityProductRow,
} = require('../lib/canonical-v2/metsera-exclusivity-product-row');

const RUNNER = path.join(
  __dirname,
  '../scripts/canonical-v2-prepare-metsera-pilot-inputs.mjs',
);
const EXPECTED_RECEIPT_KEYS = [
  'authority_limits',
  'authority_state',
  'controlled_code_registry_binding',
  'controlled_code_state',
  'event_slot_bindings',
  'exact_source_slices',
  'external_operation_state',
  'frozen_contract_pair_digest',
  'governed_deal_admission_id',
  'identities',
  'materialisation_receipt_id',
  'materialisation_state',
  'occurrence_slot_bindings',
  'participant_event_bindings',
  'revisions',
  'schema_version',
  'source_document_bindings',
  'source_interval_state',
];
const OUTPUT_FILE_NAMES = [
  'materialisation-input.json',
  'materialisation-receipt.json',
  'cohort-request.json',
  'cohort-execution-input.json',
];

function runPrepareScript(args) {
  return spawnSync(process.execPath, [RUNNER, ...args], {
    encoding: 'utf8',
    timeout: 120_000,
  });
}

function mkTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test('requires --out-dir and --source-dir', () => {
  const missingOutDir = runPrepareScript(['--source-dir', mkTempDir('metsera-src-')]);
  assert.notEqual(missingOutDir.status, 0);
  assert.match(missingOutDir.stderr, /requires --out-dir/);

  const missingSourceDir = runPrepareScript(['--out-dir', mkTempDir('metsera-out-')]);
  assert.notEqual(missingSourceDir.status, 0);
  assert.match(missingSourceDir.stderr, /requires --source-dir/);
});

test('fails closed and names the fetch script when a sealed source file is missing', () => {
  const emptySourceDir = mkTempDir('metsera-src-empty-');
  const outDir = mkTempDir('metsera-out-');
  const run = runPrepareScript(['--source-dir', emptySourceDir, '--out-dir', outDir]);
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /missing sealed source bytes for/);
  assert.match(run.stderr, /fetch-metsera-sealed-sources\.mjs/);
  assert.deepEqual(fs.readdirSync(outDir), []);
});

test('prepares byte-identical Metsera P8 input files across two runs and passes the real validators', (t) => {
  const sourceDir = process.env.METSERA_SEALED_SOURCE_DIR;
  if (!sourceDir) {
    t.skip('set METSERA_SEALED_SOURCE_DIR to a directory of verified <accession>.htm sealed sources to run this proof');
    return;
  }
  assert.ok(
    fs.existsSync(sourceDir) && fs.statSync(sourceDir).isDirectory(),
    `METSERA_SEALED_SOURCE_DIR does not exist or is not a directory: ${sourceDir}`,
  );

  const outDirA = mkTempDir('metsera-pilot-inputs-a-');
  const outDirB = mkTempDir('metsera-pilot-inputs-b-');

  const runA = runPrepareScript(['--source-dir', sourceDir, '--out-dir', outDirA]);
  assert.equal(runA.status, 0, runA.stderr);
  const runB = runPrepareScript(['--source-dir', sourceDir, '--out-dir', outDirB]);
  assert.equal(runB.status, 0, runB.stderr);

  // --- Structure/determinism assertions -----------------------------------
  for (const fileName of OUTPUT_FILE_NAMES) {
    const bytesA = fs.readFileSync(path.join(outDirA, fileName));
    const bytesB = fs.readFileSync(path.join(outDirB, fileName));
    assert.ok(
      bytesA.equals(bytesB),
      `${fileName} was not byte-identical across two runs`,
    );
  }

  const summaryA = JSON.parse(runA.stdout);
  const summaryB = JSON.parse(runB.stdout);
  assert.equal(summaryA.subject_deal_key, summaryB.subject_deal_key);
  assert.equal(
    summaryA.subject_product_result_identity,
    summaryB.subject_product_result_identity,
  );
  assert.equal(typeof summaryA.subject_deal_key, 'string');
  assert.ok(summaryA.subject_deal_key.length > 0);
  assert.equal(typeof summaryA.subject_product_result_identity, 'string');
  assert.ok(summaryA.subject_product_result_identity.length > 0);
  for (const fileName of OUTPUT_FILE_NAMES) {
    assert.equal(
      summaryA.files[fileName].sha256,
      summaryB.files[fileName].sha256,
      `${fileName} SHA-256 differed across two runs`,
    );
    assert.match(summaryA.files[fileName].sha256, /^[a-f0-9]{64}$/);
  }

  // --- The materialisation receipt has the exact schema fields the
  // staging runner (scripts/canonical-v2-staging-metsera-exclusivity-p8.mjs,
  // readRealMaterialisationReceipt(), lines ~378-402) checks for. ----------
  const materialisationReceipt = JSON.parse(
    fs.readFileSync(path.join(outDirA, 'materialisation-receipt.json'), 'utf8'),
  );
  assert.deepEqual(
    Object.keys(materialisationReceipt).sort(),
    [...EXPECTED_RECEIPT_KEYS].sort(),
  );

  const materialisationInput = JSON.parse(
    fs.readFileSync(path.join(outDirA, 'materialisation-input.json'), 'utf8'),
  );
  const sourceBytesByIdentity = new Map(
    materialisationInput.source_documents.map((source) => [
      source.source_document_identity,
      fs.readFileSync(path.join(
        sourceDir,
        `${source.citation_identity.accession_number}.htm`,
      )),
    ]),
  );
  assert.equal(
    materialisationInput.source_documents.some(
      (source) => Object.hasOwn(source, 'source_text'),
    ),
    false,
  );
  const cohortRequest = JSON.parse(
    fs.readFileSync(path.join(outDirA, 'cohort-request.json'), 'utf8'),
  );
  const cohortExecutionInput = JSON.parse(
    fs.readFileSync(path.join(outDirA, 'cohort-execution-input.json'), 'utf8'),
  );
  assert.equal(cohortRequest.schema_version, METSERA_COHORT_REQUEST_SCHEMA);
  assert.equal(
    cohortExecutionInput.schema_version,
    METSERA_COHORT_EXECUTION_INPUT_SCHEMA,
  );

  // --- The cohort request/execution-input pair passes the real,
  // unmodified cohort executor validators (not a re-implemented check). ----
  const combinedPilotBaseRelease = requireCombinedPilotBaseRelease();
  const productAuthority = requireProductAuthority(combinedPilotBaseRelease.manifest);
  const candidateReleaseBinding = {
    candidate_release_manifest_id:
      combinedPilotBaseRelease.manifest.candidate_release_manifest_id,
    candidate_release_manifest_payload_digest:
      combinedPilotBaseRelease.manifest.canonical_payload_digest,
    corpus_release_id: combinedPilotBaseRelease.manifest.corpus_release_id,
  };
  const realProcessAdmission = compileMetseraExclusivityProcessPhrasebookAdmission({
    materialisation_input: materialisationInput,
    materialisation_receipt: materialisationReceipt,
    candidate_release_binding: candidateReleaseBinding,
    pilot_product_authority_context: productAuthority.context,
    pilot_product_authority_input: productAuthority.input,
  }, sourceBytesByIdentity);
  const productAdmission = compileMetseraExclusivityProductAdmission({
    process_phrasebook_admission: realProcessAdmission,
  }, sourceBytesByIdentity);
  const productRow = compileMetseraExclusivityProductRow(
    productAdmission,
    productAuthority.context,
    productAuthority.input,
    sourceBytesByIdentity,
  );
  assert.equal(
    summaryA.subject_deal_key,
    productAdmission.admission_input.result_identity.governed_deal_admission_id,
  );
  assert.equal(
    summaryA.subject_product_result_identity,
    productRow.shared_row_adapter_receipt.product_query_result
      .product_query_result_identity,
  );
  assert.doesNotThrow(() => compileMetseraExclusivityCohortExecution({
    cohort_request: cohortRequest,
    cohort_execution_input: cohortExecutionInput,
    product_admission: productAdmission,
    product_row: productRow,
  }));
});

// The following two helpers replicate exactly how
// scripts/canonical-v2-staging-metsera-exclusivity-p8.mjs (and
// scripts/canonical-v2-prepare-metsera-pilot-inputs.mjs) build the pilot
// candidate release and product authority context, so the test can prove
// the cohort files against the real validators without spawning the DB-
// dependent staging runner.
function requireCombinedPilotBaseRelease() {
  const {
    buildLandosCandidateReleaseFixture,
  } = require('../__fixtures__/canonical-v2/landos-candidate-release');
  const {
    buildFixtureCandidateRelease,
  } = require('../lib/canonical-v2/candidate-release');
  const {
    QUERY_PROJECTION_CONTRACT_DIGEST_V2,
    SERVING_PROJECTION_VERSION_V2,
  } = require('../lib/canonical-v2/serving-projection-contract');
  const fixture = buildLandosCandidateReleaseFixture();
  return buildFixtureCandidateRelease({
    contract_bundle: fixture.contract,
    serving_namespace_id: fixture.servingNamespaceId,
    corpus_release_id: fixture.corpusReleaseId,
    serving_projection_binding: {
      serving_projection_version: SERVING_PROJECTION_VERSION_V2,
      query_projection_contract_digest: QUERY_PROJECTION_CONTRACT_DIGEST_V2,
    },
    members: fixture.members,
    source_specific_members: fixture.sourceSpecificMembers,
    validated_semantic_graphs: fixture.validatedSemanticGraphs,
    correction_authority_selection: fixture.correctionAuthoritySelection,
    deal_directory_entries: fixture.dealDirectoryEntries,
  });
}

function requireProductAuthority(candidateReleaseManifest) {
  const {
    compileCanonicalContractInput,
  } = require('../lib/canonical-v2/canonical-contract-input-compiler');
  const {
    assembleCanonicalContractBundleCurrentRootProposal,
  } = require('../lib/canonical-v2/canonical-contract-bundle-current-root');
  const {
    compileCanonicalContractBundle,
  } = require('../lib/canonical-v2/canonical-contract-bundle-compiler');
  const {
    compilePilotProductAuthorityContext,
  } = require('../lib/canonical-v2/pilot-product-authority-context');
  const contractRoot = path.join(__dirname, '../contracts/canonical-v2/successor');
  const canonicalContractInputCompilation = compileCanonicalContractInput({
    root_directory: contractRoot,
  });
  const proposal = assembleCanonicalContractBundleCurrentRootProposal({
    canonical_contract_input_compilation: canonicalContractInputCompilation,
  });
  const compiledContractBundle = compileCanonicalContractBundle({
    canonical_contract_input_compilation: canonicalContractInputCompilation,
    classification_registry: proposal.registry_assembly.classification_registry,
    dependency_registry: proposal.registry_assembly.dependency_registry,
    governed_registry_bindings: proposal.registry_assembly.governed_registry_bindings,
  });
  const input = {
    canonical_contract_input_compilation: canonicalContractInputCompilation,
    compiled_contract_bundle: compiledContractBundle,
    candidate_release_manifest: candidateReleaseManifest,
  };
  return { input, context: compilePilotProductAuthorityContext(input) };
}
