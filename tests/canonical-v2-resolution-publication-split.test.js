'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { sha256Hex } = require('../lib/canonical-v2/canonical-bytes');
const { compileFixtureContractV38 } = require('../lib/canonical-v2/contract-bundle');
const { buildImmutableSource } = require('../lib/canonical-v2/source-structure');
const { runNativeExtraction } = require('../lib/canonical-v2/native-producer/native-extraction-run');
const { shapeGeneralCovenantsProposals } = require('../lib/canonical-v2/native-producer/anthropic-provider');
const { resolveCandidates } = require('../lib/canonical-v2/native-producer/candidate-resolution');
const { buildPublicationDispositionV2 } = require('../lib/canonical-v2/publication-disposition');
const { filterResolvedEntriesForPublication } = require('../lib/canonical-v2/publication-serving-filter');

const CONTRACT = compileFixtureContractV38();
const QUOTE = 'Merger Sub will not conduct other business activities.';
const SOURCE_TEXT = `Section 6.11 Merger Sub Compliance.\n\n${QUOTE}\n`;
const EVALUATED_AT = '2026-08-09T12:00:00.000Z';

async function fixture() {
  const source = buildImmutableSource({
    sourceBytes: SOURCE_TEXT,
    sourceOccurrenceKey: 'stage-2y-resolution-publication-split',
  });
  const admittedSourceContext = Object.freeze({
    ...source,
    governed_deal_key: 'deal:stage-2y-resolution-publication-split',
    deal_admission_id: sha256Hex('deal-admission:stage-2y-resolution-publication-split'),
    source_ordinal: 0,
  });
  const response = {
    general_covenants: [{
      section_reference: '6.11',
      covenant_obligor: 'Merger Sub',
      covenant_code: 'COV-MERGESUB',
      definition_cross_references: [],
      quote: QUOTE,
    }],
    open_world_candidates: [],
  };
  const runReceipt = await runNativeExtraction({
    source_text: SOURCE_TEXT,
    document_hash: sha256Hex(Buffer.from(SOURCE_TEXT, 'utf8')),
    section_references: ['6.11'],
    contract_bundle: CONTRACT,
    definitions: { known_definitions: [] },
    section_family_classifier: async () => ({ declined: true }),
    provider: async ({ governed_scope: governedScope }) => {
      const shaped = shapeGeneralCovenantsProposals(response, governedScope.source_text);
      return {
        provider_id: 'stage-2y-resolution-publication-split/v1',
        model_id: 'stub-model',
        prompt: 'stage-2y-resolution-publication-split/v1',
        proposals: shaped.proposals,
        evidence_residuals: shaped.evidence_residuals,
      };
    },
  });
  return { runReceipt, admittedSourceContext };
}

test('a loosened resolver rung reaches resolved review without calibration but cannot publish', async () => {
  const { runReceipt, admittedSourceContext } = await fixture();
  const common = {
    run_receipt: runReceipt,
    contract_vocabulary: CONTRACT,
    admitted_source_context: admittedSourceContext,
  };
  const strict = resolveCandidates(common);
  assert.equal(strict.resolved.length, 0);
  assert.equal(strict.open_world[0].reason, 'GENERAL_COVENANT_CODE_UNCORROBORATED');

  const loosened = resolveCandidates({ ...common, corroboration_rung: 1 });
  assert.equal(loosened.resolved.length, 1);
  assert.equal(loosened.resolved[0].concept_key, 'COV-MERGESUB');
  assert.equal(loosened.review_queue.length, 1);
  assert.equal(loosened.review_queue[0].has_resolution, true);
  assert.equal(loosened.resolved[0].triage.auto_pass, false);
  assert.deepEqual(loosened.resolution_receipt.corroboration_ladder, {
    schema_version: 'STAGE_2Y_CORROBORATION_LADDER/V1',
    selected_rung: 1,
    runtime_scope: 'GENERAL_COVENANTS',
  });

  const resolvedEntry = loosened.resolved[0];
  const disposition = buildPublicationDispositionV2({
    claim_revision_id: resolvedEntry.claim.claim_revision_id,
    run_receipt_id: runReceipt.run_receipt_id,
    resolution_receipt_id: loosened.resolution_receipt.resolution_receipt_id,
    canonical_validation_state: resolvedEntry.claim.publication_state,
    evaluated_at: EVALUATED_AT,
  });
  assert.equal(disposition.authority_id, null);
  assert.equal(disposition.disposition, 'WITHHELD');
  assert.deepEqual(disposition.reason_codes, ['MISSING_CALIBRATION_AUTHORITY']);

  const decorated = { ...resolvedEntry, publication_disposition: disposition };
  assert.deepEqual(filterResolvedEntriesForPublication([decorated]), [decorated]);
  assert.deepEqual(filterResolvedEntriesForPublication(
    [decorated], 'REQUIRE_PUBLISHED', 'a'.repeat(64), EVALUATED_AT,
  ), []);
});

test('runtime corroboration rejects model rungs and keeps default receipts unchanged', async () => {
  const { runReceipt, admittedSourceContext } = await fixture();
  const common = {
    run_receipt: runReceipt,
    contract_vocabulary: CONTRACT,
    admitted_source_context: admittedSourceContext,
  };
  const strict = resolveCandidates(common);
  const explicitStrict = resolveCandidates({ ...common, corroboration_rung: 0 });
  assert.deepEqual(explicitStrict, strict);
  assert.equal(Object.hasOwn(strict.resolution_receipt, 'corroboration_ladder'), false);
  assert.throws(() => resolveCandidates({ ...common, corroboration_rung: 3 }), /integer from 0 through 2/);
});
