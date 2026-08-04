'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { compileFixtureContractV34 } = require('../lib/canonical-v2/contract-bundle');
const { resolveCandidates } = require('../lib/canonical-v2/native-producer/candidate-resolution');
const { shapeProposals } = require('../lib/canonical-v2/native-producer/anthropic-provider');
const { runNativeExtraction } = require('../lib/canonical-v2/native-producer/native-extraction-run');
const { loadAdmittedSourceForExecution } = require('../lib/canonical-v2/native-producer/unified-runner-validate');

const ROOT = path.resolve(__dirname, '..');
const PILOT_ROOT = process.env.CANONICAL_V2_M3_PILOT_ARTIFACT_ROOT
  || '/private/tmp/canonical-v2-m3-pilot-20260803.L3KSNP';
const EXECUTION_PATH = path.join(PILOT_ROOT, 'final-output', 'execution-result.json');
const MANIFEST = require('./fixtures/canonical-v2/m3-12-call-pilot-manifest.json');
const EXECUTION_ID = '7c5eeece5741d77ac5ecc493783be657447d8c183b25e25daf20e41a38910b2f';

async function replay(workItemId, { reshapeRecordedResponse = false } = {}) {
  const execution = JSON.parse(fs.readFileSync(EXECUTION_PATH, 'utf8'));
  assert.equal(execution.execution_result_id, EXECUTION_ID);
  const prior = execution.work_results.find((entry) => entry.work_item_id === workItemId);
  const manifestItem = MANIFEST.work_items.find((entry) => entry.work_item_id === workItemId);
  const source = MANIFEST.sources.find((entry) => entry.source_id === manifestItem.source_id);
  const admitted = loadAdmittedSourceForExecution({ source, root_dir: ROOT });
  const sectionReference = manifestItem.section_pin.section_reference;
  const runReceipt = await runNativeExtraction({
    source_text: admitted.context.canonical_text.text,
    document_hash: admitted.context.document_hash,
    section_references: [sectionReference],
    contract_bundle: compileFixtureContractV34(),
    definitions: { known_definitions: [] },
    section_family_assignments: [{
      section_reference: sectionReference,
      family_id: manifestItem.family_id,
    }],
    source_tree_limb_citations: true,
    provider: async ({ governed_scope: governedScope }) => {
      const recorded = prior.provider_recording.provider_output;
      if (!reshapeRecordedResponse) return recorded;
      const parsed = JSON.parse(recorded.raw_response_text);
      const { proposals, evidence_residuals: evidenceResiduals } = shapeProposals(
        parsed,
        governedScope.source_text,
      );
      return {
        provider_id: recorded.provider_id,
        model_id: recorded.model_id,
        prompt: recorded.prompt,
        proposals,
        evidence_residuals: evidenceResiduals,
      };
    },
  });
  const resolution = resolveCandidates({
    run_receipt: runReceipt,
    contract_vocabulary: compileFixtureContractV34(),
    admitted_source_context: admitted.context,
  });
  return { runReceipt, resolution };
}

function countClaims(resolution) {
  return resolution.resolved.filter((entry) => (
    entry.claim.claim_definition_key === 'CAPITALIZATION_SHARE_COUNT'
      || entry.claim.claim_definition_key === 'RESERVED_SHARE_POOL'
  ));
}

function citationFor(runReceipt, rawValue) {
  const entry = runReceipt.compiled_candidates.find((candidate) => (
    candidate.candidate.claim && candidate.candidate.claim.raw_value === rawValue
  ));
  assert.ok(entry, `missing replay candidate for ${rawValue}`);
  return entry.citation_validation;
}

test('recorded Skechers and TopBuild capitalisation outputs replay through source-tree child citations', {
  skip: !fs.existsSync(EXECUTION_PATH),
}, async () => {
  const skechers = await replay('skechers-capitalisation-3-7');
  const topBuild = await replay('topbuild-capitalisation-3-1-b');

  assert.equal(skechers.runReceipt.citation_residual_count, 0);
  assert.equal(topBuild.runReceipt.citation_residual_count, 0);
  assert.equal(skechers.resolution.review_queue.length, 13);
  assert.equal(skechers.resolution.open_world.length, 37);
  assert.equal(topBuild.resolution.review_queue.length, 14);
  assert.equal(topBuild.resolution.open_world.length, 29);

  const skechersValues = new Set(countClaims(skechers.resolution).map((entry) => entry.claim.raw_value));
  assert.ok(skechersValues.has('500,000,000 shares of Company Class A Common Stock'));
  assert.ok(skechersValues.has('75,000,000 shares of Class B Common Stock'));
  assert.ok(skechersValues.has('10,000,000 shares of Company Preferred Stock'));
  assert.ok(skechersValues.has('4,682,006 shares of Company Common Stock'));

  const topBuildValues = new Set(countClaims(topBuild.resolution).map((entry) => entry.claim.raw_value));
  assert.ok(topBuildValues.has('250,000,000 Company Shares'));
  assert.ok(topBuildValues.has('10,000,000 shares of preferred stock'));
  assert.ok(topBuildValues.has('1,600,514 Company Shares reserved for issuance under the Company’s Amended and Restated 2015 Long Term Stock Incentive Plan'));

  assert.equal(citationFor(skechers.runReceipt, '4,682,006 shares of Company Common Stock').derived_citation, '3.7(b)');
  assert.equal(citationFor(skechers.runReceipt, '500,000,000 shares of Company Class A Common Stock').derived_citation, '3.7(a)(i)');
  assert.equal(citationFor(topBuild.runReceipt, '1,600,514 Company Shares reserved for issuance under the Company’s Amended and Restated 2015 Long Term Stock Incentive Plan').derived_citation, 'III-INTRO(b)(i)');
  const topBuildAuthorised = citationFor(topBuild.runReceipt, '250,000,000 Company Shares');
  assert.equal(topBuildAuthorised.model_citation, '(b)(i)(A)');
  assert.equal(topBuildAuthorised.derived_citation, 'III-INTRO(b)(i)(A)');
  assert.equal(topBuildAuthorised.validation_source, 'DERIVED_FROM_SOURCE_TREE_LIMB');

  assert.ok(skechers.resolution.open_world.some((entry) => (
    entry.raw_value === '(assuming satisfaction of applicable performance criteria at target levels)'
  )));
  assert.ok(topBuild.resolution.open_world.some((entry) => (
    entry.raw_value === '75,468 Company Shares were issuable upon the vesting of PSU Awards (assuming achievement of the applicable performance goals at the target level).'
  )));
  assert.ok(topBuild.resolution.review_queue.some((entry) => (
    entry.reasons.includes('ASSERTION_SCOPE_AMBIGUOUS')
  )));
});

test('recorded capitalisation responses derive source-grounded preferred-stock zero counts', {
  skip: !fs.existsSync(EXECUTION_PATH),
}, async () => {
  const skechers = await replay('skechers-capitalisation-3-7', { reshapeRecordedResponse: true });
  const topBuild = await replay('topbuild-capitalisation-3-1-b', { reshapeRecordedResponse: true });

  const skechersPreferredZero = countClaims(skechers.resolution).find((entry) => (
    entry.claim.raw_value === 'no shares of Company Preferred Stock were issued and outstanding'
  ));
  assert.ok(skechersPreferredZero);
  assert.equal(skechersPreferredZero.claim.canonical_value, '0');
  assert.equal(skechersPreferredZero.claim.attributes.count_kind, 'ISSUED_OUTSTANDING');
  assert.equal(skechersPreferredZero.claim.attributes.share_class_ref, 'Company Preferred Stock');
  assert.equal(skechersPreferredZero.source_citation, '3.7(a)(C)');

  const topBuildPreferredZero = countClaims(topBuild.resolution).find((entry) => (
    entry.claim.raw_value === 'shares of preferred stock, par value $0.01 per share, none of which were outstanding as of the date hereof'
  ));
  assert.ok(topBuildPreferredZero);
  assert.equal(topBuildPreferredZero.claim.canonical_value, '0');
  assert.equal(topBuildPreferredZero.claim.attributes.count_kind, 'ISSUED_OUTSTANDING');
  assert.equal(topBuildPreferredZero.claim.attributes.share_class_ref, 'preferred stock, par value $0.01 per share');
  assert.equal(topBuildPreferredZero.source_citation, 'III-INTRO(b)(i)(B)');

  assert.equal(countClaims(skechers.resolution).filter((entry) => (
    entry.claim.raw_value === 'no shares of Company Preferred Stock were issued and outstanding'
  )).length, 1);
  assert.equal(countClaims(topBuild.resolution).filter((entry) => (
    entry.claim.raw_value === 'shares of preferred stock, par value $0.01 per share, none of which were outstanding as of the date hereof'
  )).length, 1);
});

test('zero-share derivation does not duplicate an already asserted preferred-stock zero', {
  skip: !fs.existsSync(EXECUTION_PATH),
}, () => {
  const execution = JSON.parse(fs.readFileSync(EXECUTION_PATH, 'utf8'));
  const prior = execution.work_results.find((entry) => entry.work_item_id === 'skechers-capitalisation-3-7');
  const parsed = JSON.parse(prior.provider_recording.provider_output.raw_response_text);
  parsed.share_count_assertions.push({
    section_reference: '3.7(a)',
    party_making: 'the Company',
    count_kind: 'ISSUED_OUTSTANDING',
    share_class: 'Company Preferred Stock',
    plan: null,
    quote: 'no shares of Company Preferred Stock were issued and outstanding',
    limb_path: ['(C)'],
  });
  const manifestItem = MANIFEST.work_items.find((entry) => entry.work_item_id === 'skechers-capitalisation-3-7');
  const source = MANIFEST.sources.find((entry) => entry.source_id === manifestItem.source_id);
  const admitted = loadAdmittedSourceForExecution({ source, root_dir: ROOT });
  const { proposals } = shapeProposals(parsed, admitted.context.canonical_text.text);
  const zeroClaims = proposals.filter((proposal) => (
    proposal.claim_definition_key === 'NATIVE_CAPITALISATION_SHARE_COUNT_CANDIDATE'
      && proposal.raw_value === 'no shares of Company Preferred Stock were issued and outstanding'
  ));
  assert.equal(zeroClaims.length, 1);
});
