'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { runNativeExtraction } = require('../lib/canonical-v2/native-producer/native-extraction-run');
const { shapeClosingConditionProposals } = require('../lib/canonical-v2/native-producer/anthropic-provider');
const { resolveCandidates } = require('../lib/canonical-v2/native-producer/candidate-resolution');
const { buildNativeWriteSet } = require('../lib/canonical-v2/native-producer/native-write-set-adapter');
const { validateResolvedCanonicalWriteSet } = require('../lib/canonical-v2/validate-write-set');
const { buildReviewQueueArtifact } = require('../lib/canonical-v2/native-producer/review-queue-artifact');
const { PUBLICATION_DISPOSITIONS } = require('../lib/canonical-v2/publication-disposition');
const { buildIdentityAdmittedSourceContext } = require('./helpers/identity-admitted-source');

const RUNNER_PATH = path.join(__dirname, '..', 'scripts', 'canonical-v2-live-extraction-run.mjs');
const SECTION_REFERENCE = '7.1';
const QUOTE = 'A Party may not rely on the failure of a condition if such failure was primarily caused by such Party\'s material breach.';
const SOURCE = `AGREEMENT AND PLAN OF MERGER\n\nARTICLE VII\n\nSection ${SECTION_REFERENCE} Conditions to Closing.\n${QUOTE}\n`;

test('the live runner V44 contract preserves PRIMARILY_CAUSED through resolution and validation', async () => {
  const runner = await import(pathToFileURL(RUNNER_PATH).href);
  assert.equal(runner.LIVE_CONTRACT_BUNDLE_VERSION, 'compileFixtureContractV44');
  const contractBundle = runner.compileLiveContractBundle();
  const documentHash = sha256Hex(Buffer.from(SOURCE, 'utf8'));
  const receipt = await runNativeExtraction({
    source_text: SOURCE,
    document_hash: documentHash,
    section_references: [SECTION_REFERENCE],
    contract_bundle: contractBundle,
    definitions: { known_definitions: [] },
    provider: async ({ governed_scope: governedScope }) => ({
      provider_id: 'live-runner-v44-test/v1',
      model_id: 'stub',
      prompt: 'live-runner-v44-test',
      ...shapeClosingConditionProposals({
        closing_condition_assertions: [{
          section_reference: SECTION_REFERENCE,
          assertion_kind: 'FRUSTRATION_CAUSATION',
          causation_standard: 'PRIMARILY_CAUSED',
          quote: QUOTE,
        }],
        open_world_candidates: [],
      }, governedScope.source_text),
    }),
  });
  assert.ok(receipt.compiled_candidates.every((entry) => entry.ok === true));

  const dealKey = 'live-runner-v44-test';
  const admittedSourceContext = buildIdentityAdmittedSourceContext(SOURCE, {
    dealKey,
    dealAdmissionId: sha256Hex(`deal-admission:${dealKey}`),
  });
  const resolution = resolveCandidates({
    run_receipt: receipt,
    contract_vocabulary: contractBundle,
    admitted_source_context: admittedSourceContext,
  });
  const causation = resolution.resolved.find((entry) => (
    entry.resolved_claim_definition_key === 'FRUSTRATION_CAUSATION_STANDARD'
  ));
  assert.ok(causation);
  assert.equal(causation.claim.canonical_value, 'PRIMARILY_CAUSED');

  const reviewQueueArtifact = buildReviewQueueArtifact({
    resolution,
    run_receipt_id: receipt.run_receipt_id,
  });
  const publicationGate = {
    resolution_receipt_id: resolution.resolution_receipt.resolution_receipt_id,
    review_queue_artifact_id: reviewQueueArtifact.review_queue_artifact_id,
  };
  const adapterResult = buildNativeWriteSet({
    run_receipt: {
      ...receipt,
      compiled_candidates: resolution.resolved.map((entry) => entry.compiled_candidate),
    },
    source_text: SOURCE,
    document_hash: documentHash,
    admitted_source_context: admittedSourceContext,
    resolution,
    publication_gate: publicationGate,
  });
  const provisionsById = new Map(
    resolution.resolved.map((entry) => [entry.provision_instance.provision_instance_id, entry.provision_instance]),
  );
  const validation = validateResolvedCanonicalWriteSet({
    writeSet: {
      ...adapterResult.write_set,
      provisions: [...provisionsById.values()],
      components: adapterResult.write_set.components || [],
    },
    contractBundle,
    admittedSourceContexts: adapterResult.admitted_source_contexts,
    publicationGate,
  });
  assert.equal(validation.accepted, true);
  assert.equal(validation.residuals.length, 0);
  assert.equal(validation.quarantines.length, 0);
  assert.ok(adapterResult.write_set.claims.some((claim) => (
    claim.claim_definition_key === 'FRUSTRATION_CAUSATION_STANDARD'
      && claim.canonical_value === 'PRIMARILY_CAUSED'
  )));
  assert.ok(adapterResult.write_set.publication_dispositions.length > 0);
  assert.ok(adapterResult.write_set.publication_dispositions.every((sidecar) => (
    sidecar.disposition === PUBLICATION_DISPOSITIONS.WITHHELD
  )));
});

test('the live run manifest records the exported live contract identity', () => {
  const runnerSource = fs.readFileSync(RUNNER_PATH, 'utf8');
  assert.match(runnerSource, /contract_bundle_version:\s*LIVE_CONTRACT_BUNDLE_VERSION/);
});
