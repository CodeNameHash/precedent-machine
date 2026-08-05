'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { compileFixtureContractV34 } = require('../lib/canonical-v2/contract-bundle');
const { resolveCandidates } = require('../lib/canonical-v2/native-producer/candidate-resolution');
const { resolveDurableArtifactRoot } = require('../lib/canonical-v2/durable-artifact-root');
const { loadAdmittedSourceForExecution } = require('../lib/canonical-v2/native-producer/unified-runner-validate');

const ROOT = path.resolve(__dirname, '..');
const LIVE_ARTIFACT_ROOT = resolveDurableArtifactRoot();
const RESULT_PATH = LIVE_ARTIFACT_ROOT && path.join(LIVE_ARTIFACT_ROOT, 'final-output', 'execution-result.json');
const MANIFEST = require('./fixtures/canonical-v2/m3-12-call-pilot-manifest.json');
const LIVE_EXECUTION_RESULT_ID = '7c5eeece5741d77ac5ecc493783be657447d8c183b25e25daf20e41a38910b2f';

function replay(workItemId) {
  const execution = JSON.parse(fs.readFileSync(RESULT_PATH, 'utf8'));
  assert.equal(execution.execution_result_id, LIVE_EXECUTION_RESULT_ID);
  const workItem = execution.work_results.find((entry) => entry.work_item_id === workItemId);
  assert.ok(workItem, `missing immutable live work item ${workItemId}`);
  const source = MANIFEST.sources.find((entry) => entry.source_id === workItem.source_id);
  assert.ok(source, `missing manifest source ${workItem.source_id}`);
  const admitted = loadAdmittedSourceForExecution({ source, root_dir: ROOT });
  return resolveCandidates({
    run_receipt: workItem.run_receipt,
    contract_vocabulary: compileFixtureContractV34(),
    admitted_source_context: admitted.context,
  });
}

function unresolvedCountValues(resolution) {
  return resolution.review_queue
    .filter((entry) => entry.has_resolution === false && entry.reasons.includes('COUNT_KIND_UNCORROBORATED'))
    .map((entry) => entry.raw_value)
    .sort();
}

function assertPublishedChildCitation(entry, parentSectionReference) {
  const citation = entry.compiled_candidate.citation_validation;
  assert.ok(citation && citation.accepted === true, 'resolved row keeps an accepted citation record');
  assert.equal(entry.section_reference, parentSectionReference, 'resolved row retains its governed parent scope');
  assert.equal(entry.source_citation, citation.derived_citation, 'resolved row publishes the derived child citation separately');
  assert.equal(entry.citation_context.parent_section_reference, parentSectionReference);
  assert.equal(entry.citation_context.child_section_reference, citation.derived_citation);
  assert.ok(entry.citation_context.child_clause_quote.includes(entry.claim.raw_value));
}

test('immutable live M3 capitalisation and no-other-reps checkpoint replays conservatively', {
  skip: !RESULT_PATH || !fs.existsSync(RESULT_PATH),
}, () => {
  const skechersCapitalisation = replay('skechers-capitalisation-3-7');
  assert.equal(skechersCapitalisation.resolved.filter((entry) => (
    entry.claim.claim_definition_key === 'CAPITALIZATION_SHARE_COUNT'
      || entry.claim.claim_definition_key === 'RESERVED_SHARE_POOL'
  )).length, 6);
  assert.deepEqual(unresolvedCountValues(skechersCapitalisation), [
    '1,301,556 shares of Company Common Stock',
    '10,000,000 shares of Company Preferred Stock',
    '500,000,000 shares of Company Class A Common Stock',
    '650,778 shares of Company Common Stock',
    '75,000,000 shares of Class B Common Stock',
  ]);
  assert.equal(skechersCapitalisation.open_world.filter((entry) => (
    entry.claim_definition_key === 'NATIVE_CAPITALISATION_LIMB_ASSERTION_CANDIDATE'
  )).length, 27);

  const skechersNoOtherReps = replay('skechers-no-other-reps-3-28');
  assert.equal(skechersNoOtherReps.open_world.length, 0);
  assert.deepEqual(
    skechersNoOtherReps.resolved.map((entry) => entry.claim.claim_definition_key).sort(),
    [
      'EXTRA_CONTRACTUAL_RELIANCE_DISCLAIMER_PRESENT',
      'NON_RELIANCE_ACKNOWLEDGMENT_PRESENT',
      'NO_OTHER_REPRESENTATIONS_DISCLAIMER_PRESENT',
      'NO_OTHER_REPRESENTATIONS_DISCLAIMER_PRESENT',
    ],
  );
  for (const entry of skechersNoOtherReps.resolved) {
    assertPublishedChildCitation(entry, '3.28');
  }

  const topBuildCapitalisation = replay('topbuild-capitalisation-3-1-b');
  assert.deepEqual(unresolvedCountValues(topBuildCapitalisation), [
    '10,000,000 shares of preferred stock',
    '250,000,000 Company Shares',
  ]);
  assert.equal(topBuildCapitalisation.open_world.filter((entry) => (
    entry.claim_definition_key === 'NATIVE_CAPITALISATION_LIMB_ASSERTION_CANDIDATE'
  )).length, 21);
});

test('immutable live M3 track-B rows publish child citations with their source context', {
  skip: !RESULT_PATH || !fs.existsSync(RESULT_PATH),
}, () => {
  const antitrust = replay('modiv-antitrust-consents-5-5');
  assert.deepEqual(
    antitrust.resolved.map((entry) => entry.source_citation).sort(),
    ['5.5(b)', '5.5(d)'],
  );
  for (const entry of antitrust.resolved) {
    assertPublishedChildCitation(entry, '5.5');
    assert.ok(entry.citation_context.parent_chapeau_quote.includes('Appropriate Action; Consents; Filings'));
  }

  const closing = replay('modiv-closing-conditions-6-1');
  assert.deepEqual(
    closing.resolved.map((entry) => entry.source_citation).sort(),
    ['6.1(a)', '6.1(b)', '6.1(b)', '6.1(c)', '6.1(d)'],
  );
  for (const entry of closing.resolved) {
    assertPublishedChildCitation(entry, '6.1');
  }
  const s4StopOrder = closing.resolved.find((entry) => (
    entry.claim.attributes.s4_component === 'NO_STOP_ORDER'
  ));
  assert.ok(s4StopOrder.citation_context.child_clause_quote.includes('pending or threatened in writing proceeding seeking a stop order'));
  const listing = closing.resolved.find((entry) => entry.claim.claim_definition_key === 'LISTING_CONDITION');
  assert.ok(listing.citation_context.child_clause_quote.includes('subject to official notice of issuance'));

  const termination = replay('topbuild-termination-company-6-3');
  assert.deepEqual(
    termination.resolved.map((entry) => entry.source_citation).sort(),
    ['6.3(a)(i)(A)', '6.3(a)(i)(B)', '6.3(a)(ii)', '6.3(b)', '6.3(b)'],
  );
  for (const entry of termination.resolved) {
    assertPublishedChildCitation(entry, '6.3');
    assert.ok(entry.citation_context.parent_chapeau_quote.includes('by the Company if:'));
  }
  assert.ok(termination.open_world.some((entry) => entry.raw_value.includes('Parent Stockholder Approval')));
  assert.ok(termination.open_world.some((entry) => entry.raw_value.includes('Sections ‎5.3(a)(i) or ‎5.3(a)(ii)')));
});
