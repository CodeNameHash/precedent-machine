'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { compileFixtureContractV34 } = require('../lib/canonical-v2/contract-bundle');
const { resolveCandidates } = require('../lib/canonical-v2/native-producer/candidate-resolution');
const { loadAdmittedSourceForExecution } = require('../lib/canonical-v2/native-producer/unified-runner-validate');

const ARTIFACT_ROOT = process.env.CANONICAL_V2_M3_PILOT_ARTIFACT_ROOT
  || '/private/tmp/canonical-v2-m3-pilot-20260803.L3KSNP';
const MANIFEST_PATH = path.join(ARTIFACT_ROOT, 'iteration-2-preparation', 'attempt-3', 'live-only-manifest.json');
const EXECUTION_PATH = path.join(ARTIFACT_ROOT, 'iteration-2', 'execution-result.json');

function available() {
  return fs.existsSync(MANIFEST_PATH) && fs.existsSync(EXECUTION_PATH);
}

function load() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const execution = JSON.parse(fs.readFileSync(EXECUTION_PATH, 'utf8'));
  return {
    execution,
    sourceById: new Map(manifest.sources.map((source) => [source.source_id, source])),
  };
}

function replay(workItemId) {
  const { execution, sourceById } = load();
  const work = execution.work_results.find((item) => item.work_item_id === workItemId);
  assert.ok(work, `missing sealed work item: ${workItemId}`);
  const admitted = loadAdmittedSourceForExecution({
    artifact_root: ARTIFACT_ROOT,
    source: sourceById.get(work.source_id),
  });
  return resolveCandidates({
    run_receipt: work.run_receipt,
    contract_vocabulary: compileFixtureContractV34(),
    admitted_source_context: admitted.context,
  });
}

test('attempt-3 retained Modiv outputs publish the source-tree child citations', { skip: !available() }, () => {
  const antitrust = replay('modiv-antitrust-consents-5-5');
  const closing = replay('modiv-closing-conditions-6-1');
  assert.deepEqual(
    [...new Set(antitrust.resolved.map((entry) => entry.source_citation))].sort(),
    ['5.5(a)', '5.5(b)', '5.5(c)', '5.5(d)', '5.5(f)', '5.5(g)'],
  );
  assert.deepEqual(
    [...new Set(closing.resolved.map((entry) => entry.source_citation))].sort(),
    ['6.1(a)', '6.1(b)', '6.1(c)', '6.1(d)'],
  );
  assert.ok(antitrust.resolved.every((entry) => entry.source_citation !== '5.5'));
  assert.ok(closing.resolved.every((entry) => entry.source_citation !== '6.1'));
});

test('attempt-3 retained IOC replay resolves only closed categories and preserves source-tree citations', { skip: !available() }, () => {
  const replayed = replay('topbuild-ioc-company-4-1');
  const byRaw = new Map(replayed.resolved.map((entry) => [entry.claim.raw_value, entry]));
  for (const anchor of [
    'waive any claims of substantial value of more than $10,000,000 in the aggregate',
    'materially modify the terms of any Indenture or the Senior Notes',
    'settle or compromise any audit or proceeding relating to a material Tax liability',
    'request any Tax ruling',
    'grant any new rights to severance or termination payments',
  ]) assert.ok([...byRaw.keys()].some((value) => value.includes(anchor)), `missing controlled anchor: ${anchor}`);
  assert.ok(replayed.resolved.every((entry) => /^4\.1\(/.test(entry.source_citation)));
  assert.ok(replayed.resolved.every((entry) => entry.party_source_span), 'IOC claims retain the governing chapeau span');
  assert.ok(replayed.resolved.every((entry) => typeof entry.governing_context_quote === 'string'
    && /Company[\s\S]*Subsidiar/i.test(entry.governing_context_quote)), 'IOC claims retain the governing Company and Subsidiary chapeau text');
  assert.ok(replayed.open_world.some((entry) => entry.raw_value.includes('enter into a joint venture')));
  assert.ok(replayed.open_world.some((entry) => entry.raw_value.includes('acquire, transfer, sell, lease, license')));
  assert.ok(replayed.open_world.some((entry) => entry.raw_value.startsWith('acquire by merging or consolidating')));
  assert.ok(replayed.open_world.some((entry) => entry.raw_value.startsWith('agree, authorize or commit')));
});

test('attempt-3 retained no-shop replay decomposes only exact null-code action verbs', { skip: !available() }, () => {
  const replayed = replay('topbuild-no-shop-company-4-3');
  const actions = replayed.resolved.filter((entry) => (
    entry.resolved_claim_definition_key === 'NO_SHOP_PROHIBITED_ACTION'
      && entry.claim.raw_value.startsWith('solicit, initiate or knowingly facilitate')
  ));
  assert.deepEqual(
    actions.map((entry) => entry.claim.canonical_value).sort(),
    [
      'ENCOURAGE_ACQUISITION_INQUIRY_PROPOSAL_OR_OFFER',
      'FACILITATE_ACQUISITION_INQUIRY_PROPOSAL_OR_OFFER',
      'FURNISH_NONPUBLIC_INFORMATION',
      'INITIATE_ACQUISITION_INQUIRY_PROPOSAL_OR_OFFER',
      'SOLICIT_ACQUISITION_INQUIRY_PROPOSAL_OR_OFFER',
    ],
  );
  assert.ok(actions.every((entry) => entry.source_citation === '4.3(a)'));
  assert.ok(actions.every((entry) => typeof entry.governing_context_quote === 'string'
    && entry.governing_context_quote.includes(entry.claim.raw_value)),
  'no-shop claims retain the exact governing source paragraph');
  assert.ok(replayed.open_world.some((entry) => entry.raw_value.includes('on a reasonably prompt basis')),
    'daily-update timing remains open-world');
});

test('attempt-3 retained no-shop replay closes only source-corroborated claims', { skip: !available() }, () => {
  const replayed = replay('topbuild-no-shop-company-4-3');
  assert.equal(replayed.review_queue.filter((entry) => !entry.has_resolution).length, 0);
  assert.ok(replayed.resolved.every((entry) => entry.source_citation.startsWith('4.3(')));

  const byRaw = new Map(replayed.resolved.map((entry) => [entry.claim.raw_value, entry]));
  assert.equal(
    byRaw.get('a new four (4)-business day notice period').claim.canonical_value,
    '4',
  );
  assert.equal(
    byRaw.get('subject to the first sentence of Section ‎4.3(c)').claim.canonical_value,
    'SUBJECT_TO_INITIAL_PROPOSAL_NOTICE',
  );
  assert.equal(
    byRaw.get('the Company shall, and shall cause its Subsidiaries to, enforce the confidentiality and standstill provisions of any such agreement').claim.canonical_value,
    'ENFORCE',
  );

  const hourNotices = replayed.open_world.filter(
    (entry) => entry.reason === 'NO_SHOP_PERIOD_HOUR_NOTICE_OPEN_WORLD',
  );
  assert.equal(hourNotices.length, 3);
  assert.ok(replayed.open_world.some((entry) => entry.reason === 'NO_SHOP_RUBRIC_OPEN_WORLD'
    && entry.raw_value.includes('return or destroy')));
});
